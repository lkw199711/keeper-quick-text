export function createHostsContent({
  repository,
  modules,
  selections,
  ip,
  domain,
  deploymentEnvironment,
  relatedBranch,
  generatedAt
}) {
  const normalizedSelections = (selections || [{ repository, modules }]).map((selection) => ({
    ...selection,
    ip: selection.ip || ip,
    domain: selection.domain || domain
  }));
  const repositories = normalizedSelections.map((selection) => selection.repository);
  const selectedModules = normalizedSelections.flatMap((selection) => selection.modules);
  const hasMultipleRepositories = repositories.length > 1;
  const timestamp = generatedAt
    ? formatDisplayTimestamp(generatedAt)
    : '确认后生成';
  const normalizedRelatedBranch = String(relatedBranch || '').trim();
  const lines = [
    '# keeper-quick-text',
    `# 环境: ${deploymentEnvironment?.name || '测试环境'}`,
    `# 仓库: ${repositories.map((item) => item.name).join('、')}`,
    `# 模块: ${formatModuleNames(normalizedSelections, hasMultipleRepositories) || '尚未选择'}`,
    ...(normalizedRelatedBranch ? [`# 关联分支: ${normalizedRelatedBranch}`] : []),
    `# 生成时间: ${timestamp}`,
    '# 路由字典: public/route-catalog.js'
  ];

  for (const selection of normalizedSelections) {
    lines.push('');
    if (hasMultipleRepositories) lines.push(`# 仓库段: ${selection.repository.name}`);
    lines.push(`${selection.ip}\t\t${selection.domain}`);
    for (const module of selection.modules) {
      for (const route of module.routes) {
        lines.push(`#${route.name}`);
        lines.push(`#${createRouteUrl(route.path, selection.domain)}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatModuleNames(selections, includeRepositoryName) {
  return selections.flatMap(({ repository, modules }) => (
    modules.map((module) => includeRepositoryName
      ? `${repository.name} / ${module.name}`
      : module.name)
  )).join('、');
}

function createRouteUrl(path, domain) {
  try {
    return new URL(path, `https://${domain}`).toString();
  } catch {
    return `https://${domain}${path}`;
  }
}

export function createOutputFilename(repositoryIds, domains, date = new Date()) {
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

  const ids = Array.isArray(repositoryIds) ? repositoryIds : [repositoryIds];
  const normalizedDomains = Array.isArray(domains) ? domains : [domains];
  const namePrefix = ids.length === 1
    ? `${ids[0]}-${normalizedDomains[0]}`
    : 'multi-repository';
  return `${namePrefix}-${timestamp}.hosts`;
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
