import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../src/server.js';

const sourceTemplate = fileURLToPath(new URL('../hosts/标准测试环境.hosts', import.meta.url));

test('Web API 返回模板配置并在 hosts 目录生成文件', async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'keeper-quick-text-'));
  const hostsDir = join(temporaryRoot, 'hosts');
  const templateFile = join(hostsDir, '标准测试环境.hosts');
  await mkdir(hostsDir);
  await copyFile(sourceTemplate, templateFile);

  const server = createAppServer({ hostsDir, templateFile });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  context.after(async () => {
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const configResponse = await fetch(`${baseUrl}/api/config`);
  const config = await configResponse.json();

  assert.equal(configResponse.status, 200);
  assert.equal(config.repositories.length, 3);

  const createResponse = await fetch(`${baseUrl}/api/hosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repositoryId: 'keeper-qua-audit',
      ip: '10.2.3.4',
      domain: 'qua-preview.example.com'
    })
  });
  const result = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.match(result.relativePath, /^hosts\/keeper-qua-audit-qua-preview\.example\.com-\d{14}\.hosts$/u);
  assert.equal(await readFile(join(temporaryRoot, result.relativePath), 'utf8'), result.content);
  assert.match(result.content, /#pop品牌审核\n#https:\/\/qua-preview\.example\.com\/keeper\/qua-audit\/brandAudit/u);
});

test('Web API 拒绝未知仓库和非法地址', async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'keeper-quick-text-invalid-'));
  const hostsDir = join(temporaryRoot, 'hosts');
  const templateFile = join(hostsDir, '标准测试环境.hosts');
  await mkdir(hostsDir);
  await copyFile(sourceTemplate, templateFile);

  const server = createAppServer({ hostsDir, templateFile });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  context.after(async () => {
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/hosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repositoryId: 'unknown-repository',
      ip: 'not-an-ip',
      domain: 'https://invalid.example.com'
    })
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /有效仓库/u);
});
