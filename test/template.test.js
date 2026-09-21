import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  REPOSITORY_CATALOG,
  findRepository,
  getRepositoryRouteCount
} from '../public/route-catalog.js';
import {
  createHostsDocument,
  createOutputFilename,
  parseHostsDocument
} from '../src/template.js';

const templateFile = fileURLToPath(new URL('../hosts/标准测试环境.hosts', import.meta.url));

test('前端字典定义三个仓库、十一个模块和二十一条路由', () => {
  assert.deepEqual(
    REPOSITORY_CATALOG.map((repository) => ({
      id: repository.id,
      modules: repository.modules.length,
      routes: getRepositoryRouteCount(repository)
    })),
    [
      { id: 'keeper-sell-supplier', modules: 5, routes: 10 },
      { id: 'keeper-qua-audit', modules: 2, routes: 4 },
      { id: 'keeper-second-review', modules: 4, routes: 7 }
    ]
  );

  for (const repository of REPOSITORY_CATALOG) {
    assert.equal(new Set(repository.modules.map((module) => module.id)).size, repository.modules.length);
    for (const module of repository.modules) {
      assert.ok(module.routes.length >= 1);
      assert.equal(new Set(module.routes.map((route) => route.id)).size, module.routes.length);
      assert.ok(module.routes.every((route) => ['audit', 'query'].includes(route.type)));
    }
  }
});

test('前端字典与标准测试环境中的 IP、域名和路由保持一致', async () => {
  const { sections } = parseHostsDocument(await readFile(templateFile, 'utf8'));

  for (const repository of REPOSITORY_CATALOG) {
    const section = sections.find((item) => item.domain === repository.defaultDomain);
    assert.ok(section, `标准测试环境缺少 ${repository.name}`);
    assert.equal(section.ip, repository.defaultIp);

    const catalogRoutes = repository.modules.flatMap((module) => module.routes);
    assert.deepEqual(
      catalogRoutes.map((route) => ({
        label: route.name.toLowerCase(),
        url: new URL(route.path, `https://${repository.defaultDomain}`).toString()
      })),
      section.routes.map((route) => ({
        label: route.label.toLowerCase(),
        url: route.url
      }))
    );
  }
});

test('只生成所选模块并替换 IP 和域名', () => {
  const repository = findRepository('keeper-qua-audit');
  const content = createHostsDocument({
    repository,
    moduleIds: ['pop-brand'],
    ip: '10.1.2.3',
    domain: 'qua-preview.example.com',
    generatedAt: new Date('2026-09-21T06:30:00.000Z')
  });

  assert.match(content, /# 模块: POP 品牌/u);
  assert.match(content, /10\.1\.2\.3\t\tqua-preview\.example\.com/u);
  assert.match(content, /https:\/\/qua-preview\.example\.com\/keeper\/qua-audit\/brandAudit/u);
  assert.doesNotMatch(content, /categoryAudit/u);
  assert.equal(parseHostsDocument(content).sections[0].routes.length, 2);
});

test('拒绝空模块、跨仓库模块和不合法地址', () => {
  const repository = findRepository('keeper-qua-audit');
  const validInput = { repository, ip: '127.0.0.1', domain: 'example.com' };

  assert.throws(
    () => createHostsDocument({ ...validInput, moduleIds: [] }),
    /至少选择一个模块/u
  );
  assert.throws(
    () => createHostsDocument({ ...validInput, moduleIds: ['store-renovation'] }),
    /不属于当前仓库/u
  );
  assert.throws(
    () => createHostsDocument({ ...validInput, moduleIds: ['pop-brand'], ip: '999.1.2.3' }),
    /有效的 IPv4 或 IPv6/u
  );
  assert.throws(
    () => createHostsDocument({ ...validInput, moduleIds: ['pop-brand'], domain: 'https://example.com' }),
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
