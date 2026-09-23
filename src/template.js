import { isIP } from 'node:net';
import { createHostsContent } from '../public/hosts-content.js';
import { REPOSITORY_CATALOG } from '../public/route-catalog.js';

export { createOutputFilename } from '../public/hosts-content.js';

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;

export function parseHostsDocument(content) {
  const sections = [];
  const metadata = {};
  let currentSection;
  let pendingLabel = '';
  let pendingRepositoryId = '';

  for (const rawLine of String(content).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) {
      pendingLabel = '';
      continue;
    }

    const hostEntry = parseHostEntry(line);
    if (hostEntry) {
      currentSection = { ...hostEntry, repositoryId: pendingRepositoryId || undefined, routes: [] };
      sections.push(currentSection);
      pendingLabel = '';
      pendingRepositoryId = '';
      continue;
    }

    if (!line.startsWith('#')) continue;
    const comment = line.slice(1).trim();
    const metadataMatch = comment.match(/^([^:：]+)[:：]\s*(.+)$/u);
    if (metadataMatch && !/^https?:/iu.test(comment)) {
      metadata[metadataMatch[1].trim()] = metadataMatch[2].trim();
      if (metadataMatch[1].trim() === '仓库段') pendingRepositoryId = metadataMatch[2].trim();
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

export function createHostsDocument({ repository, moduleIds, selections, ip, domain, generatedAt = new Date() }) {
  const validatedSelections = validateGenerationInput({ repository, moduleIds, selections, ip, domain });
  return createHostsContent({ selections: validatedSelections, ip, domain, generatedAt });
}

export function validateGenerationInput({ repository, moduleIds, selections, ip, domain }) {
  const requestedSelections = Array.isArray(selections)
    ? selections
    : [{ repositoryId: repository?.id, moduleIds }];
  const seenRepositoryIds = new Set();
  const validatedSelections = requestedSelections.map((selection) => {
    const selectedRepository = REPOSITORY_CATALOG.find((item) => item.id === selection?.repositoryId);
    if (!selectedRepository || seenRepositoryIds.has(selectedRepository.id)) {
      throw new Error('请选择有效仓库，且不要重复选择。');
    }
    seenRepositoryIds.add(selectedRepository.id);

    const requestedIds = new Set(Array.isArray(selection.moduleIds) ? selection.moduleIds : []);
    const selectedModules = selectedRepository.modules.filter((module) => requestedIds.has(module.id));
    if (selectedModules.length !== requestedIds.size) {
      throw new Error('选择的模块不属于当前仓库或对应仓库。');
    }
    return {
      repository: selectedRepository,
      modules: selectedModules,
      ip: String(selection.ip || ip || '').trim(),
      domain: String(selection.domain || domain || '').trim().toLowerCase()
    };
  });

  if (validatedSelections.length === 0) {
    throw new Error('请至少选择一个仓库。');
  }
  if (validatedSelections.every((selection) => selection.modules.length === 0)) {
    throw new Error('请至少选择一个模块。');
  }
  if (validatedSelections.some((selection) => !isIP(selection.ip))) {
    throw new Error('请为每个仓库输入有效的 IPv4 或 IPv6 地址。');
  }
  if (validatedSelections.some((selection) => !isHostname(selection.domain))) {
    throw new Error('请为每个仓库输入有效域名，不要包含协议、端口或路径。');
  }

  return validatedSelections;
}

export function isHostname(value) {
  return HOSTNAME_PATTERN.test(String(value).trim());
}

function parseHostEntry(line) {
  if (line.startsWith('#')) return undefined;
  const [ip, domain, ...rest] = line.split(/\s+/u);
  if (rest.length > 0 || !isIP(ip) || !isHostname(domain)) return undefined;
  return { ip, domain: domain.toLowerCase() };
}
