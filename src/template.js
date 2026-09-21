import { isIP } from 'node:net';
import { REPOSITORY_CATALOG } from '../public/route-catalog.js';

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;

export function parseHostsDocument(content) {
  const sections = [];
  const metadata = {};
  let currentSection;
  let pendingLabel = '';

  for (const rawLine of String(content).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) {
      pendingLabel = '';
      continue;
    }

    const hostEntry = parseHostEntry(line);
    if (hostEntry) {
      currentSection = { ...hostEntry, routes: [] };
      sections.push(currentSection);
      pendingLabel = '';
      continue;
    }

    if (!line.startsWith('#')) continue;
    const comment = line.slice(1).trim();
    const metadataMatch = comment.match(/^([^:：]+)[:：]\s*(.+)$/u);
    if (metadataMatch && !/^https?:/iu.test(comment)) {
      metadata[metadataMatch[1].trim()] = metadataMatch[2].trim();
    }

    if (!currentSection) continue;
    if (/^https?:\/\//iu.test(comment)) {
      currentSection.routes.push({ label: pendingLabel, url: comment });
      pendingLabel = '';
    } else if (comment) {
      pendingLabel = comment;
    }
  }

  return { metadata, sections };
}

export function createHostsDocument({ repository, moduleIds, ip, domain, generatedAt = new Date() }) {
  const modules = validateGenerationInput({ repository, moduleIds, ip, domain });

  const timestamp = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(generatedAt).replaceAll('/', '-');

  const lines = [
    '# keeper-quick-text',
    `# 仓库: ${repository.name}`,
    `# 模块: ${modules.map((module) => module.name).join('、')}`,
    `# 生成时间: ${timestamp}`,
    '# 路由字典: public/route-catalog.js',
    '',
    `${ip}\t\t${domain}`
  ];

  for (const module of modules) {
    for (const route of module.routes) {
      lines.push(`#${route.name}`);
      lines.push(`#${new URL(route.path, `https://${domain}`).toString()}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function validateGenerationInput({ repository, moduleIds, ip, domain }) {
  if (!repository || !REPOSITORY_CATALOG.some((item) => item.id === repository.id)) {
    throw new Error('请选择有效仓库。');
  }
  if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
    throw new Error('请至少选择一个模块。');
  }

  const requestedIds = new Set(moduleIds);
  const modules = repository.modules.filter((module) => requestedIds.has(module.id));
  if (modules.length !== requestedIds.size) {
    throw new Error('选择的模块不属于当前仓库。');
  }
  if (!isIP(ip)) {
    throw new Error('请输入有效的 IPv4 或 IPv6 地址。');
  }
  if (!isHostname(domain)) {
    throw new Error('请输入有效域名，不要包含协议、端口或路径。');
  }

  return modules;
}

export function isHostname(value) {
  return HOSTNAME_PATTERN.test(String(value).trim());
}

export function createOutputFilename(repositoryId, domain, date = new Date()) {
  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date).replace(/[-: ]/gu, '');

  return `${repositoryId}-${domain}-${timestamp}.hosts`;
}

function parseHostEntry(line) {
  if (line.startsWith('#')) return undefined;
  const [ip, domain, ...rest] = line.split(/\s+/u);
  if (rest.length > 0 || !isIP(ip) || !isHostname(domain)) return undefined;
  return { ip, domain: domain.toLowerCase() };
}
