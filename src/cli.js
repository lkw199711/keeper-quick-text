#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { formatHosts, parseDeploymentText } from './hosts.js';

const HELP = `keeper-quick-text

把快速部署得到的 IP、域名或 URL 拼接成 hosts 内容。

用法：
  quick-text <IP> <域名或 URL...>
  quick-text --ip <IP> --file <部署结果文件>
  cat deploy.log | quick-text --ip <IP>

选项：
  -i, --ip <IP>       指定目标 IP
  -f, --file <文件>   从文件读取部署结果；使用 - 表示标准输入
  -o, --output <文件> 把结果写入文件，而不是标准输出
      --compact       把全部域名合并为一行
      --no-sort       保留域名的输入顺序
  -h, --help          显示帮助
  -v, --version       显示版本
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ip: { type: 'string', short: 'i' },
      file: { type: 'string', short: 'f' },
      output: { type: 'string', short: 'o' },
      compact: { type: 'boolean', default: false },
      'no-sort': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false }
    }
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  if (values.version) {
    process.stdout.write('0.1.0\n');
    return;
  }

  const inputs = [...positionals];
  let ip = values.ip;
  if (!ip && inputs.length > 0) {
    ip = inputs.shift();
  }

  let inputText = inputs.join('\n');
  if (values.file) {
    inputText += `\n${await readInput(values.file)}`;
  } else if (!process.stdin.isTTY) {
    inputText += `\n${await readInput('-')}`;
  }

  const result = formatHosts(parseDeploymentText(inputText, ip), {
    compact: values.compact,
    sort: !values['no-sort']
  });

  if (values.output) {
    await writeFile(values.output, result, 'utf8');
    process.stderr.write(`已写入 ${values.output}\n`);
  } else {
    process.stdout.write(result);
  }
}

async function readInput(file) {
  if (file === '-') {
    let content = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) content += chunk;
    return content;
  }

  return readFile(file, 'utf8');
}

main().catch((error) => {
  process.stderr.write(`错误：${error.message}\n`);
  process.exitCode = 1;
});
