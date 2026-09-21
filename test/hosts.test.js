import assert from 'node:assert/strict';
import test from 'node:test';
import { formatHosts, parseDeploymentText } from '../src/hosts.js';

test('从部署文本中提取 IP、域名和 URL', () => {
  const result = parseDeploymentText(`
    10.20.30.40
    https://seller-test.example.com/path
    api-test.example.com:8080
    seller-test.example.com # 重复项
  `);

  assert.deepEqual(result, {
    ip: '10.20.30.40',
    domains: ['seller-test.example.com', 'api-test.example.com']
  });
});

test('显式 IP 优先，域名去重并默认排序', () => {
  const parsed = parseDeploymentText(
    'z.example.com, a.example.com z.example.com',
    '127.0.0.1'
  );

  assert.equal(formatHosts(parsed), [
    '127.0.0.1         a.example.com',
    '127.0.0.1         z.example.com',
    ''
  ].join('\n'));
});

test('紧凑格式将域名放在同一行', () => {
  const result = formatHosts({
    ip: '::1',
    domains: ['b.example.com', 'a.example.com']
  }, { compact: true });

  assert.equal(result, '::1 a.example.com b.example.com\n');
});

test('缺少 IP 时给出明确错误', () => {
  assert.throws(
    () => parseDeploymentText('example.com'),
    /未找到有效 IP/u
  );
});
