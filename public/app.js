const elements = {
  repositoryList: document.querySelector('#repository-list'),
  ipInput: document.querySelector('#ip-input'),
  domainInput: document.querySelector('#domain-input'),
  ipOptions: document.querySelector('#ip-options'),
  domainOptions: document.querySelector('#domain-options'),
  previewSummary: document.querySelector('#preview-summary'),
  previewContent: document.querySelector('#preview-content'),
  routeCount: document.querySelector('#route-count'),
  generateButton: document.querySelector('#generate-button'),
  message: document.querySelector('#message'),
  dialog: document.querySelector('#confirm-dialog'),
  confirmButton: document.querySelector('#confirm-button'),
  confirmRepository: document.querySelector('#confirm-repository'),
  confirmIp: document.querySelector('#confirm-ip'),
  confirmDomain: document.querySelector('#confirm-domain'),
  confirmRoutes: document.querySelector('#confirm-routes')
};

const state = {
  config: undefined,
  repository: undefined
};

init();

async function init() {
  bindEvents();
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('读取标准测试环境模板失败。');
    state.config = await response.json();
    renderRepositories();
    renderOptions(elements.ipOptions, state.config.ipOptions);
  } catch (error) {
    elements.repositoryList.innerHTML = `<div class="loading-card">${escapeHtml(error.message)}</div>`;
    showMessage(error.message, 'error');
  }
}

function bindEvents() {
  elements.ipInput.addEventListener('input', updatePreview);
  elements.domainInput.addEventListener('input', updatePreview);
  elements.generateButton.addEventListener('click', openConfirmation);
  elements.confirmButton.addEventListener('click', (event) => {
    event.preventDefault();
    generateFile();
  });
}

function renderRepositories() {
  elements.repositoryList.innerHTML = '';
  for (const repository of state.config.repositories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'repository-card';
    button.dataset.repositoryId = repository.id;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `
      <span class="repository-name">${escapeHtml(repository.name)}</span>
      <span class="repository-description">${escapeHtml(repository.description)}</span>
      <span class="repository-meta">${repository.routeCount} 条模板路由 · ${escapeHtml(repository.defaultDomain)}</span>
    `;
    button.addEventListener('click', () => selectRepository(repository.id));
    elements.repositoryList.append(button);
  }
}

function selectRepository(repositoryId) {
  state.repository = state.config.repositories.find((item) => item.id === repositoryId);
  for (const card of elements.repositoryList.querySelectorAll('.repository-card')) {
    card.setAttribute('aria-pressed', String(card.dataset.repositoryId === repositoryId));
  }

  elements.ipInput.disabled = false;
  elements.domainInput.disabled = false;
  elements.ipInput.value = state.repository.defaultIp;
  elements.domainInput.value = state.repository.defaultDomain;
  renderOptions(elements.domainOptions, state.config.domainOptions[repositoryId]);
  showMessage('');
  updatePreview();
  elements.ipInput.focus();
}

function updatePreview() {
  if (!state.repository) return;
  const ip = elements.ipInput.value.trim();
  const domain = elements.domainInput.value.trim().toLowerCase();
  const inputValid = isIp(ip) && isHostname(domain);

  elements.generateButton.disabled = !inputValid;
  elements.previewSummary.textContent = `${state.repository.name} → ${domain || '等待输入域名'}`;
  elements.routeCount.textContent = `${state.repository.routeCount} 条路由`;
  elements.previewContent.textContent = buildPreview(state.repository, ip, domain);

  if (!ip || !domain) {
    showMessage('请填写 IP 和域名。');
  } else if (!inputValid) {
    showMessage('IP 或域名格式不正确。', 'error');
  } else {
    showMessage('');
  }
}

function buildPreview(repository, ip, domain) {
  const targetIp = ip || '<IP>';
  const targetDomain = domain || '<DOMAIN>';
  const lines = [
    '# keeper-quick-text',
    `# 仓库: ${repository.name}`,
    '# 生成时间: 确认后由服务器写入',
    '# 模板: 标准测试环境.hosts',
    '',
    `${targetIp}\t\t${targetDomain}`
  ];

  for (const route of repository.routes) {
    if (route.label) lines.push(`#${route.label}`);
    lines.push(`#${replaceDomain(route.url, targetDomain)}`);
  }
  return lines.join('\n');
}

function openConfirmation() {
  updatePreview();
  if (elements.generateButton.disabled) return;

  elements.confirmRepository.textContent = state.repository.name;
  elements.confirmIp.textContent = elements.ipInput.value.trim();
  elements.confirmDomain.textContent = elements.domainInput.value.trim().toLowerCase();
  elements.confirmRoutes.textContent = `${state.repository.routeCount} 条`;
  elements.dialog.showModal();
}

async function generateFile() {
  elements.confirmButton.disabled = true;
  elements.confirmButton.textContent = '生成中…';

  try {
    const response = await fetch('/api/hosts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repositoryId: state.repository.id,
        ip: elements.ipInput.value.trim(),
        domain: elements.domainInput.value.trim().toLowerCase()
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '文件生成失败。');

    elements.dialog.close();
    elements.previewContent.textContent = result.content;
    showMessage(`已生成 ${result.relativePath}`, 'success');
    await refreshConfig();
  } catch (error) {
    elements.dialog.close();
    showMessage(error.message, 'error');
  } finally {
    elements.confirmButton.disabled = false;
    elements.confirmButton.textContent = '生成文件';
  }
}

async function refreshConfig() {
  const response = await fetch('/api/config');
  if (!response.ok) return;
  state.config = await response.json();
  renderOptions(elements.ipOptions, state.config.ipOptions);
  renderOptions(elements.domainOptions, state.config.domainOptions[state.repository.id]);
}

function renderOptions(datalist, values = []) {
  datalist.replaceChildren(...values.map((value) => {
    const option = document.createElement('option');
    option.value = value;
    return option;
  }));
}

function showMessage(text, type = '') {
  elements.message.textContent = text;
  elements.message.className = `message ${type}`.trim();
}

function replaceDomain(urlValue, domain) {
  try {
    const url = new URL(urlValue);
    url.hostname = domain;
    return url.toString();
  } catch {
    return urlValue;
  }
}

function isIp(value) {
  const ipv4 = value.split('.');
  if (ipv4.length === 4 && ipv4.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255)) return true;
  return /^[0-9a-f:]+$/iu.test(value) && value.includes(':');
}

function isHostname(value) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
