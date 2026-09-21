import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildRepositoryTemplates,
  createHostsDocument,
  createOutputFilename,
  parseHostsDocument
} from '../src/template.js';

const templateFile = fileURLToPath(new URL('../hosts/标准测试环境.hosts', import.meta.url));

test('从标准测试环境提取三个仓库及全部路由', async () => {
  const repositories = buildRepositoryTemplates(await readFile(templateFile, 'utf8'));

  assert.deepEqual(
    repositories.map(({ id, routeCount }) => ({ id, routeCount })),
    [
      { id: 'keeper-sell-supplier', routeCount: 10 },
      { id: 'keeper-qua-audit', routeCount: 4 },
      { id: 'keeper-second-review', routeCount: 7 }
    ]
  );
});

test('生成时替换 IP 和全部路由域名', async () => {
  const [repository] = buildRepositoryTemplates(await readFile(templateFile, 'utf8'));
  const content = createHostsDocument({
    repository,
    ip: '10.1.2.3',
    domain: 'supplier-preview.example.com',
    generatedAt: new Date('2026-09-21T06:30:00.000Z')
  });

  assert.match(content, /10\.1\.2\.3\t\tsupplier-preview\.example\.com/u);
  assert.match(content, /https:\/\/supplier-preview\.example\.com\/keeper\/seller-supplier\/supplier-manage/u);
  assert.doesNotMatch(content, /sell-supplier\.jdtest\.net/u);
  assert.equal(parseHostsDocument(content).sections[0].routes.length, 10);
});

test('拒绝不合法 IP 和带协议的域名', async () => {
  const [repository] = buildRepositoryTemplates(await readFile(templateFile, 'utf8'));

  assert.throws(
    () => createHostsDocument({ repository, ip: '999.1.2.3', domain: 'example.com' }),
    /有效的 IPv4 或 IPv6/u
  );
  assert.throws(
    () => createHostsDocument({ repository, ip: '127.0.0.1', domain: 'https://example.com' }),
    /有效域名/u
  );
});

test('输出文件名包含仓库、域名和北京时间', () => {
  assert.equal(
    createOutputFilename(
      'keeper-qua-audit',
      'qua-preview.example.com',
      new Date('2026-09-21T06:30:45.000Z')
    ),
    'keeper-qua-audit-qua-preview.example.com-20260921143045.hosts'
  );
});
