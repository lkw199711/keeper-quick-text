export function createHostsContent({ repository, modules, ip, domain, generatedAt }) {
  const timestamp = generatedAt
    ? formatDisplayTimestamp(generatedAt)
    : '确认后生成';
  const lines = [
    '# keeper-quick-text',
    `# 仓库: ${repository.name}`,
    `# 模块: ${modules.map((module) => module.name).join('、') || '尚未选择'}`,
    `# 生成时间: ${timestamp}`,
    '# 路由字典: public/route-catalog.js',
    '',
    `${ip}\t\t${domain}`
  ];

  for (const module of modules) {
    for (const route of module.routes) {
      lines.push(`#${route.name}`);
      lines.push(`#${createRouteUrl(route.path, domain)}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function createRouteUrl(path, domain) {
  try {
    return new URL(path, `https://${domain}`).toString();
  } catch {
    return `https://${domain}${path}`;
  }
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

function formatDisplayTimestamp(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date).replaceAll('/', '-');
}
