import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostsContent, createOutputFilename } from '../public/hosts-content.js';
import { findRepository } from '../public/route-catalog.js';
import { APP_CONFIG, OUTPUT_MODES } from '../public/runtime-config.js';
import { createHostsDocument } from '../src/template.js';

test('默认使用无需后端的浏览器下载模式', () => {
  assert.equal(APP_CONFIG.mode, OUTPUT_MODES.DOWNLOAD);
  assert.equal(APP_CONFIG.apiBaseUrl, '');
});

test('前端下载与后端保存生成完全相同的内容', () => {
  const repository = findRepository('keeper-second-review');
  const moduleIds = ['store-qualification', 'lbs-video'];
  const modules = repository.modules.filter((module) => moduleIds.includes(module.id));
  const input = {
    repository,
    ip: '10.8.0.6',
    domain: 'review-preview.example.com',
    generatedAt: new Date('2026-09-21T08:00:00.000Z')
  };

  assert.equal(
    createHostsContent({ ...input, modules }),
    createHostsDocument({ ...input, moduleIds })
  );
});

test('浏览器下载文件名采用仓库、域名和北京时间戳', () => {
  assert.equal(
    createOutputFilename(
      'keeper-second-review',
      'review-preview.example.com',
      new Date('2026-09-21T08:00:00.000Z')
    ),
    'keeper-second-review-review-preview.example.com-20260921160000.hosts'
  );
});
