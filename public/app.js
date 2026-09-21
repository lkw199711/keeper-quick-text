import { REPOSITORY_CATALOG, getRepositoryRouteCount } from './route-catalog.js';

const elements = {
  repositoryList: document.querySelector('#repository-list'),
  moduleList: document.querySelector('#module-list'),
  moduleSummary: document.querySelector('#module-summary'),
  selectAllButton: document.querySelector('#select-all-button'),
  clearAllButton: document.querySelector('#clear-all-button'),
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
  confirmModules: document.querySelector('#confirm-modules'),
  confirmIp: document.querySelector('#confirm-ip'),
  confirmDomain: document.querySelector('#confirm-domain'),
  confirmRoutes: document.querySelector('#confirm-routes')
};

const state = {
  config: undefined,
  repository: undefined,
  selectedModuleIds: new Set()
};

init();

async function init() {
  bindEvents();
  renderRepositories();

  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('读取历史 IP 和域名失败。');
    state.config = await response.json();
    renderOptions(elements.ipOptions, state.config.ipOptions);
  } catch (error) {
    showMessage(`${error.message} 请通过 npm start 启动页面。`, 'error');
  }
}

function bindEvents() {
  elements.ipInput.addEventListener('input', updatePreview);
  elements.domainInput.addEventListener('input', updatePreview);
  elements.selectAllButton.addEventListener('click', selectAllModules);
  elements.clearAllButton.addEventListener('click', clearAllModules);
  elements.generateButton.addEventListener('click', openConfirmation);
  elements.confirmButton.addEventListener('click', (event) => {
    event.preventDefault();
    generateFile();
  });
}

function renderRepositories() {
  elements.repositoryList.innerHTML = '';
  for (const repository of REPOSITORY_CATALOG) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'repository-card';
    button.dataset.repositoryId = repository.id;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `
      <span class="repository-name">${escapeHtml(repository.name)}</span>
      <span class="repository-description">${escapeHtml(repository.description)}</span>
      <span class="repository-meta">${repository.modules.length} 个模块 · ${getRepositoryRouteCount(repository)} 条路由</span>
    `;
    button.addEventListener('click', () => selectRepository(repository.id));
    elements.repositoryList.append(button);
  }
}

function selectRepository(repositoryId) {
  state.repository = REPOSITORY_CATALOG.find((item) => item.id === repositoryId);
  state.selectedModuleIds = new Set(state.repository.modules.map((module) => module.id));

  for (const card of elements.repositoryList.querySelectorAll('.repository-card')) {
    card.setAttribute('aria-pressed', String(card.dataset.repositoryId === repositoryId));
  }

  elements.selectAllButton.disabled = false;
  elements.clearAllButton.disabled = false;
  elements.ipInput.disabled = false;
  elements.domainInput.disabled = false;
  elements.ipInput.value = state.repository.defaultIp;
  elements.domainInput.value = state.repository.defaultDomain;
  renderModules();
  renderOptions(elements.domainOptions, state.config?.domainOptions?.[repositoryId] || [state.repository.defaultDomain]);
  showMessage('');
  updatePreview();
}

function renderModules() {
  elements.moduleList.innerHTML = '';
  for (const module of state.repository.modules) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'module-card';
    button.dataset.moduleId = module.id;
    button.setAttribute('aria-pressed', String(state.selectedModuleIds.has(module.id)));
    button.innerHTML = `
      <span class="module-name">${escapeHtml(module.name)}</span>
      <span class="module-description">${escapeHtml(module.description)}</span>
      <span class="route-types">
        ${module.routes.map((route) => `<span class="route-type">${route.type === 'audit' ? '审核' : '查询'}</span>`).join('')}
      </span>
    `;
    button.addEventListener('click', () => toggleModule(module.id));
    elements.moduleList.append(button);
  }
  updateModuleSelectionUi();
}

function toggleModule(moduleId) {
  if (state.selectedModuleIds.has(moduleId)) {
    state.selectedModuleIds.delete(moduleId);
  } else {
    state.selectedModuleIds.add(moduleId);
  }
  updateModuleSelectionUi();
  updatePreview();
}

function selectAllModules() {
  state.selectedModuleIds = new Set(state.repository.modules.map((module) => module.id));
  updateModuleSelectionUi();
  updatePreview();
}

function clearAllModules() {
  state.selectedModuleIds.clear();
  updateModuleSelectionUi();
  updatePreview();
}

function updateModuleSelectionUi() {
  for (const card of elements.moduleList.querySelectorAll('.module-card')) {
    card.setAttribute('aria-pressed', String(state.selectedModuleIds.has(card.dataset.moduleId)));
  }
  const modules = getSelectedModules();
  elements.moduleSummary.textContent = `已选择 ${modules.length} 个模块，共 ${countRoutes(modules)} 条路由`;
}

function updatePreview() {
  if (!state.repository) return;
  const ip = elements.ipInput.value.trim();
  const domain = elements.domainInput.value.trim().toLowerCase();
  const modules = getSelectedModules();
  const inputValid = isIp(ip) && isHostname(domain);
  const selectionValid = modules.length > 0;

  elements.generateButton.disabled = !inputValid || !selectionValid;
  elements.previewSummary.textContent = `${state.repository.name} → ${domain || '等待输入域名'}`;
  elements.routeCount.textContent = `${modules.length} 个模块 · ${countRoutes(modules)} 条路由`;
  elements.previewContent.textContent = buildPreview(state.repository, modules, ip, domain);

  if (!selectionValid) {
    showMessage('请至少选择一个业务模块。', 'error');
  } else if (!ip || !domain) {
    showMessage('请填写 IP 和域名。');
  } else if (!inputValid) {
    showMessage('IP 或域名格式不正确。', 'error');
  } else {
    showMessage('');
  }
}

function buildPreview(repository, modules, ip, domain) {
  const targetIp = ip || '<IP>';
  const targetDomain = domain || '<DOMAIN>';
  const lines = [
    '# keeper-quick-text',
    `# 仓库: ${repository.name}`,
    `# 模块: ${modules.map((module) => module.name).join('、') || '尚未选择'}`,
    '# 生成时间: 确认后由服务器写入',
    '# 路由字典: public/route-catalog.js',
    '',
    `${targetIp}\t\t${targetDomain}`
  ];

  for (const module of modules) {
    for (const route of module.routes) {
      lines.push(`#${route.name}`);
      lines.push(`#${createRouteUrl(route.path, targetDomain)}`);
    }
  }
  return lines.join('\n');
}

function openConfirmation() {
  updatePreview();
  if (elements.generateButton.disabled) return;

  const modules = getSelectedModules();
  elements.confirmRepository.textContent = state.repository.name;
  elements.confirmModules.textContent = modules.map((module) => module.name).join('、');
  elements.confirmIp.textContent = elements.ipInput.value.trim();
  elements.confirmDomain.textContent = elements.domainInput.value.trim().toLowerCase();
  elements.confirmRoutes.textContent = `${countRoutes(modules)} 条`;
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
        moduleIds: [...state.selectedModuleIds],
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

function getSelectedModules() {
  if (!state.repository) return [];
  return state.repository.modules.filter((module) => state.selectedModuleIds.has(module.id));
}

function countRoutes(modules) {
  return modules.reduce((total, module) => total + module.routes.length, 0);
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

function createRouteUrl(path, domain) {
  try {
    return new URL(path, `https://${domain}`).toString();
  } catch {
    return `https://${domain}${path}`;
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
