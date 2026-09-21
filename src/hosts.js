import { isIP } from 'node:net';

const TOKEN_SEPARATOR = /[\s,，;；]+/u;
const COMMENT_PREFIX = '#';

export function parseDeploymentText(text, explicitIp) {
  const tokens = String(text)
    .split(/\r?\n/u)
    .flatMap((line) => line.split(COMMENT_PREFIX, 1)[0].split(TOKEN_SEPARATOR))
    .map((token) => token.trim())
    .filter(Boolean);

  let ip = explicitIp?.trim();
  const domains = [];

  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (!normalized) continue;

    if (!ip && isIP(normalized)) {
      ip = normalized;
      continue;
    }

    if (isHostname(normalized) && normalized !== ip) {
      domains.push(normalized);
    }
  }

  if (!ip || !isIP(ip)) {
    throw new Error('未找到有效 IP，请通过 --ip 指定，或把 IP 放在输入内容中。');
  }

  const uniqueDomains = [...new Set(domains)];
  if (uniqueDomains.length === 0) {
    throw new Error('未找到有效域名。');
  }

  return { ip, domains: uniqueDomains };
}

export function formatHosts({ ip, domains }, { compact = false, sort = true } = {}) {
  const normalizedDomains = sort
    ? [...domains].sort((left, right) => left.localeCompare(right, 'en'))
    : domains;

  if (compact) {
    return `${ip} ${normalizedDomains.join(' ')}\n`;
  }

  const padding = Math.max(ip.length + 2, 18);
  return normalizedDomains.map((domain) => `${ip.padEnd(padding)}${domain}`).join('\n') + '\n';
}

function normalizeToken(token) {
  const withoutPunctuation = token.replace(/^["'`([{<]+|["'`\])}>.]+$/gu, '');

  try {
    const candidate = withoutPunctuation.includes('://')
      ? withoutPunctuation
      : `http://${withoutPunctuation}`;
    const url = new URL(candidate);
    return url.hostname.replace(/^\[|\]$/gu, '').toLowerCase();
  } catch {
    return withoutPunctuation.toLowerCase();
  }
}

function isHostname(value) {
  if (value.length > 253 || !value.includes('.')) return false;

  return value.split('.').every((label) => (
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/iu.test(label)
  ));
}
