import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAppServer } from '../src/server.js';

test('Web API 返回模板配置并在 hosts 目录生成文件', async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'keeper-quick-text-'));
  const hostsDir = join(temporaryRoot, 'hosts');
  await mkdir(hostsDir);

  const server = createAppServer({ hostsDir });
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
  assert.ok(config.ipOptions.includes('6.120.39.72'));
  assert.ok(config.ipOptions.includes('11.125.76.107'));
  assert.ok(config.domainOptions['keeper-qua-audit'].includes('qua-audit.jdtest.net'));
  assert.ok(config.domainOptions['keeper-qua-audit'].includes('seller-v10.shop.jd.com'));
  assert.ok(config.domainOptions['keeper-qua-audit'].includes('man-keeper.jd.com'));

  const createResponse = await fetch(`${baseUrl}/api/hosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deploymentEnvironmentId: 'production',
      repositoryId: 'keeper-qua-audit',
      moduleIds: ['pop-brand'],
      ip: '10.2.3.4',
      domain: 'qua-preview.example.com'
    })
  });
  const result = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.match(result.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  assert.match(result.relativePath, /^hosts\/keeper-qua-audit-qua-preview\.example\.com-\d{14}\.hosts$/u);
  assert.equal(await readFile(join(temporaryRoot, result.relativePath), 'utf8'), result.content);
  assert.match(result.content, /# 环境: 线上环境/u);
  assert.match(result.content, /#pop品牌审核\n#https:\/\/qua-preview\.example\.com\/keeper\/qua-audit\/brandAudit/u);

  const multiResponse = await fetch(`${baseUrl}/api/hosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selections: [
        {
          repositoryId: 'keeper-qua-audit',
          moduleIds: ['pop-brand'],
          ip: '10.2.3.5',
          domain: 'qua-multi.example.com'
        },
        {
          repositoryId: 'keeper-second-review',
          moduleIds: ['lbs-video'],
          ip: '10.2.3.6',
          domain: 'review-multi.example.com'
        }
      ]
    })
  });
  const multiResult = await multiResponse.json();

  assert.equal(multiResponse.status, 201);
  assert.match(multiResult.relativePath, /^hosts\/multi-repository-\d{14}\.hosts$/u);
  assert.match(multiResult.content, /# 仓库: keeper-qua-audit、keeper-second-review/u);
  assert.match(multiResult.content, /qua-multi\.example\.com\/keeper\/qua-audit\/brandAudit/u);
  assert.match(multiResult.content, /review-multi\.example\.com\/keeper\/takeout\/storeVideoAudit/u);
});

test('Web API 拒绝未知仓库和非法地址', async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'keeper-quick-text-invalid-'));
  const hostsDir = join(temporaryRoot, 'hosts');
  await mkdir(hostsDir);

  const server = createAppServer({ hostsDir });
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
      moduleIds: ['unknown-module'],
      ip: 'not-an-ip',
      domain: 'https://invalid.example.com'
    })
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /有效仓库/u);
});
