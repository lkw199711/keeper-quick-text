import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRepositoryTemplates,
  createHostsDocument,
  createOutputFilename,
  parseHostsDocument
} from './template.js';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const HOSTS_DIR = join(PROJECT_ROOT, 'hosts');
const TEMPLATE_FILE = join(HOSTS_DIR, '标准测试环境.hosts');
const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 16 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

export function createAppServer(options = {}) {
  const hostsDir = options.hostsDir || HOSTS_DIR;
  const templateFile = options.templateFile || TEMPLATE_FILE;
  const publicDir = options.publicDir || PUBLIC_DIR;

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/api/config') {
        return sendJson(response, 200, await loadConfig({ hostsDir, templateFile }));
      }

      if (request.method === 'POST' && url.pathname === '/api/hosts') {
        const payload = await readJsonBody(request);
        const config = await loadConfig({ hostsDir, templateFile });
        const repository = config.repositories.find((item) => item.id === payload.repositoryId);
        const ip = String(payload.ip || '').trim();
        const domain = String(payload.domain || '').trim().toLowerCase();
        const now = new Date();
        const content = createHostsDocument({ repository, ip, domain, generatedAt: now });
        const filename = createOutputFilename(repository.id, domain, now);

        await mkdir(hostsDir, { recursive: true });
        await writeFile(join(hostsDir, filename), content, { encoding: 'utf8', flag: 'wx' });

        return sendJson(response, 201, {
          filename,
          relativePath: `hosts/${filename}`,
          content
        });
      }

      if (request.method === 'GET') {
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        return serveStatic(response, publicDir, pathname);
      }

      return sendJson(response, 404, { error: '请求不存在。' });
    } catch (error) {
      const status = error.code === 'EEXIST' ? 409 : error.statusCode || 400;
      return sendJson(response, status, { error: error.message || '请求处理失败。' });
    }
  });
}

async function loadConfig({ hostsDir, templateFile }) {
  const templateContent = await readFile(templateFile, 'utf8');
  const repositories = buildRepositoryTemplates(templateContent);
  const history = await loadHistory(hostsDir);
  const ipOptions = new Set(repositories.map((item) => item.defaultIp));
  const domainOptions = Object.fromEntries(
    repositories.map((item) => [item.id, new Set([item.defaultDomain])])
  );

  for (const item of history) {
    ipOptions.add(item.ip);
    if (domainOptions[item.repositoryId]) domainOptions[item.repositoryId].add(item.domain);
  }

  return {
    repositories,
    ipOptions: [...ipOptions],
    domainOptions: Object.fromEntries(
      Object.entries(domainOptions).map(([key, values]) => [key, [...values]])
    )
  };
}

async function loadHistory(hostsDir) {
  let entries;
  try {
    entries = await readdir(hostsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const history = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.hosts') || entry.name === '标准测试环境.hosts') continue;
    try {
      const document = parseHostsDocument(await readFile(join(hostsDir, entry.name), 'utf8'));
      const repositoryId = document.metadata['仓库'];
      for (const section of document.sections) {
        history.push({ repositoryId, ip: section.ip, domain: section.domain });
      }
    } catch {
      // 手工维护的 hosts 文件不应阻止页面启动。
    }
  }
  return history;
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = '';
    let size = 0;

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        const error = new Error('请求内容过大。');
        error.statusCode = 413;
        rejectBody(error);
        request.destroy();
        return;
      }
      raw += chunk;
    });
    request.on('end', () => {
      try {
        resolveBody(JSON.parse(raw || '{}'));
      } catch {
        const error = new Error('请求内容不是有效 JSON。');
        error.statusCode = 400;
        rejectBody(error);
      }
    });
    request.on('error', rejectBody);
  });
}

function serveStatic(response, publicDir, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return sendJson(response, 400, { error: '无效路径。' });
  }

  const filePath = resolve(publicDir, `.${decodedPath}`);
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${sep}`)) {
    return sendJson(response, 403, { error: '禁止访问。' });
  }

  const stream = createReadStream(filePath);
  stream.once('open', () => {
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    stream.pipe(response);
  });
  stream.once('error', () => sendJson(response, 404, { error: '页面不存在。' }));
}

function sendJson(response, statusCode, value) {
  if (response.headersSent) return;
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createAppServer().listen(PORT, HOST, () => {
    process.stdout.write(`keeper-quick-text 已启动：http://${HOST}:${PORT}\n`);
  });
}
