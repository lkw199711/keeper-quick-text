import { isIP } from 'node:net';

export const REPOSITORIES = [
  {
    id: 'keeper-sell-supplier',
    name: 'keeper-sell-supplier',
    description: '自营 / POP 入驻、资质与单品审核',
    templateDomain: 'sell-supplier.jdtest.net'
  },
  {
    id: 'keeper-qua-audit',
    name: 'keeper-qua-audit',
    description: 'POP 品牌与类目审核',
    templateDomain: 'qua-audit.jdtest.net'
  },
  {
    id: 'keeper-second-review',
    name: 'keeper-second-review',
    description: '门店、商家、视频与装修审核',
    templateDomain: 'second-review.jdtest.net'
  }
];

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

export function buildRepositoryTemplates(content) {
  const { sections } = parseHostsDocument(content);

  return REPOSITORIES.map((repository) => {
    const section = sections.find((item) => item.domain === repository.templateDomain);
    if (!section) {
      throw new Error(`模板中缺少仓库 ${repository.name} 的域名 ${repository.templateDomain}`);
    }

    return {
      ...repository,
      defaultIp: section.ip,
      defaultDomain: section.domain,
      routeCount: section.routes.length,
      routes: section.routes
    };
  });
}

export function createHostsDocument({ repository, ip, domain, generatedAt = new Date() }) {
  validateGenerationInput({ repository, ip, domain });

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
    `# 生成时间: ${timestamp}`,
    '# 模板: 标准测试环境.hosts',
    '',
    `${ip}\t\t${domain}`
  ];

  for (const route of repository.routes) {
    if (route.label) lines.push(`#${route.label}`);
    lines.push(`#${replaceUrlDomain(route.url, domain)}`);
  }

  return `${lines.join('\n')}\n`;
}

export function validateGenerationInput({ repository, ip, domain }) {
  if (!repository || !REPOSITORIES.some((item) => item.id === repository.id)) {
    throw new Error('请选择有效仓库。');
  }
  if (!isIP(ip)) {
    throw new Error('请输入有效的 IPv4 或 IPv6 地址。');
  }
  if (!isHostname(domain)) {
    throw new Error('请输入有效域名，不要包含协议、端口或路径。');
  }
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

function replaceUrlDomain(value, domain) {
  const url = new URL(value);
  url.hostname = domain;
  return url.toString();
}
