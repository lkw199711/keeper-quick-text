import { createHostsContent, createOutputFilename } from './hosts-content.js';
import { REPOSITORY_CATALOG, getRepositoryRouteCount } from './route-catalog.js';
import { APP_CONFIG, OUTPUT_MODES } from './runtime-config.js';

const LOCAL_HISTORY_KEY = 'keeper-quick-text.history.v1';
const SAVED_ENVIRONMENTS_KEY = 'keeper-quick-text.environments.v1';
const MODE_INFO = {
  [OUTPUT_MODES.DOWNLOAD]: {
    label: '浏览器下载模式',
    action: '确认并下载',
    confirmAction: '下载文件',
    outputDescription: '核对后文件将下载到当前浏览器，不依赖后端服务。',
    dialogNote: '文件将下载到当前浏览器，IP 和域名历史保存在本机。'
  },
  [OUTPUT_MODES.SERVER]: {
    label: '服务器保存模式',
    action: '确认并保存',
    confirmAction: '保存文件',
    outputDescription: '核对后文件将写入服务器的 hosts 目录。',
    dialogNote: '文件将保存到服务器 hosts 目录，不会自动下载到浏览器。'
  },
  [OUTPUT_MODES.BOTH]: {
    label: '服务器保存 + 下载',
    action: '确认保存并下载',
    confirmAction: '保存并下载',
    outputDescription: '核对后文件将保存到服务器，同时下载到当前浏览器。',
    dialogNote: '服务器和当前浏览器将各保留一份相同的 hosts 文件。'
  }
};

const elements = {
  savedEnvironmentList: document.querySelector('#saved-environment-list'),
  savedEnvironmentCount: document.querySelector('#saved-environment-count'),
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
  copyPreviewButton: document.querySelector('#copy-preview-button'),
  copyPreviewLabel: document.querySelector('#copy-preview-label'),
  saveOnlyButton: document.querySelector('#save-only-button'),
  generateButton: document.querySelector('#generate-button'),
  generateActionLabel: document.querySelector('#generate-action-label'),
  outputDescription: document.querySelector('#output-description'),
  message: document.querySelector('#message'),
  modeChip: document.querySelector('#mode-chip'),
  modeLabel: document.querySelector('#mode-label'),
  dialog: document.querySelector('#confirm-dialog'),
  dialogNote: document.querySelector('#dialog-note'),
  confirmButton: document.querySelector('#confirm-button'),
  confirmRepository: document.querySelector('#confirm-repository'),
  confirmModules: document.querySelector('#confirm-modules'),
  confirmIp: document.querySelector('#confirm-ip'),
  confirmDomain: document.querySelector('#confirm-domain'),
  confirmRoutes: document.querySelector('#confirm-routes'),
  deleteEnvironmentDialog: document.querySelector('#delete-environment-dialog'),
  deleteEnvironmentDomain: document.querySelector('#delete-environment-domain'),
  confirmDeleteEnvironmentButton: document.querySelector('#confirm-delete-environment-button')
};

const state = {
  config: undefined,
  repository: undefined,
  selectedModuleIds: new Set(),
  editingEnvironmentId: undefined,
  pendingDeleteEnvironmentId: undefined
};

init();

async function init() {
  bindEvents();
  renderSavedEnvironments();
  renderRepositories();

  const modeInfo = MODE_INFO[APP_CONFIG.mode];
  if (!modeInfo) {
    showMessage(`runtime-config.js 中的 mode 配置无效：${APP_CONFIG.mode}`, 'error');
    return;
  }
  applyModeUi(modeInfo);

  try {
    state.config = await loadConfig();
    renderOptions(elements.ipOptions, state.config.ipOptions);
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function bindEvents() {
  elements.ipInput.addEventListener('input', updatePreview);
  elements.domainInput.addEventListener('input', updatePreview);
  elements.selectAllButton.addEventListener('click', selectAllModules);
  elements.clearAllButton.addEventListener('click', clearAllModules);
  elements.copyPreviewButton.addEventListener('click', copyPreviewContent);
  elements.saveOnlyButton.addEventListener('click', saveEnvironmentOnly);
  elements.generateButton.addEventListener('click', openConfirmation);
  elements.confirmButton.addEventListener('click', (event) => {
    event.preventDefault();
    generateFile();
  });
  elements.confirmDeleteEnvironmentButton.addEventListener('click', deleteSavedEnvironment);
  elements.deleteEnvironmentDialog.addEventListener('close', () => {
    state.pendingDeleteEnvironmentId = undefined;
  });
}

function applyModeUi(modeInfo) {
  elements.modeChip.dataset.mode = APP_CONFIG.mode;
  elements.modeLabel.textContent = modeInfo.label;
  elements.generateActionLabel.textContent = modeInfo.action;
  elements.outputDescription.textContent = modeInfo.outputDescription;
  elements.dialogNote.textContent = modeInfo.dialogNote;
  elements.confirmButton.textContent = modeInfo.confirmAction;
}

async function loadConfig() {
  const localConfig = buildLocalConfig();
  if (!usesServer()) return localConfig;

  const response = await fetch(apiUrl('/api/config'));
  if (!response.ok) {
    throw new Error('后端模式已开启，但无法读取服务器配置；未自动切换为下载模式。');
  }
  const serverConfig = await response.json();
  return APP_CONFIG.mode === OUTPUT_MODES.BOTH
    ? mergeConfigs(serverConfig, localConfig)
    : serverConfig;
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

function selectRepository(repositoryId, { keepEditing = false } = {}) {
  if (!keepEditing) state.editingEnvironmentId = undefined;
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
  renderOptions(
    elements.domainOptions,
    state.config?.domainOptions?.[repositoryId] || [state.repository.defaultDomain]
  );
  renderSavedEnvironments();
  showMessage('');
  updatePreview();
}

function renderSavedEnvironments() {
  const environments = readSavedEnvironments();
  elements.savedEnvironmentCount.textContent = `${environments.length} 个环境`;

  if (environments.length === 0) {
    elements.savedEnvironmentList.innerHTML = '<div class="saved-environment-empty">还没有已保存环境，完成一次生成后会显示在这里。</div>';
    return;
  }

  elements.savedEnvironmentList.innerHTML = '';
  for (const environment of environments) {
    const repository = REPOSITORY_CATALOG.find((item) => item.id === environment.repositoryId);
    if (!repository) continue;
    const modules = repository.modules.filter((module) => environment.moduleIds.includes(module.id));
    const card = document.createElement('article');
    card.className = 'saved-environment-card';
    if (environment.id === state.editingEnvironmentId) card.dataset.editing = 'true';
    card.innerHTML = `
      <div class="saved-environment-card-heading">
        <div>
          <strong>${escapeHtml(environment.domain)}</strong>
          <span>${escapeHtml(repository.name)}</span>
        </div>
        ${environment.id === state.editingEnvironmentId ? '<span class="editing-badge">编辑中</span>' : ''}
      </div>
      <dl class="saved-environment-details">
        <div><dt>IP</dt><dd>${escapeHtml(environment.ip)}</dd></div>
        <div><dt>模块</dt><dd>${escapeHtml(modules.map((module) => module.name).join('、'))}</dd></div>
      </dl>
      <div class="saved-environment-footer">
        <time datetime="${escapeHtml(environment.updatedAt)}">${escapeHtml(formatSavedTime(environment.updatedAt))}</time>
        <div class="saved-environment-actions">
          <button class="edit-environment-button" type="button" aria-label="编辑 ${escapeHtml(environment.domain)}">编辑</button>
          <button class="delete-environment-button" type="button" aria-label="删除 ${escapeHtml(environment.domain)}">删除</button>
        </div>
      </div>
    `;
    card.querySelector('.edit-environment-button').addEventListener('click', () => {
      editSavedEnvironment(environment.id);
    });
    card.querySelector('.delete-environment-button').addEventListener('click', () => {
      openDeleteEnvironmentConfirmation(environment.id);
    });
    elements.savedEnvironmentList.append(card);
  }
}

function editSavedEnvironment(environmentId) {
  const environment = readSavedEnvironments().find((item) => item.id === environmentId);
  if (!environment) return;

  state.editingEnvironmentId = environment.id;
  selectRepository(environment.repositoryId, { keepEditing: true });
  const availableModuleIds = new Set(state.repository.modules.map((module) => module.id));
  state.selectedModuleIds = new Set(
    environment.moduleIds.filter((moduleId) => availableModuleIds.has(moduleId))
  );
  elements.ipInput.value = environment.ip;
  elements.domainInput.value = environment.domain;
  renderModules();
  renderSavedEnvironments();
  updatePreview();
  showMessage(`正在编辑 ${environment.domain}，重新生成后会更新该环境。`, 'success');
  document.querySelector('#repo-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDeleteEnvironmentConfirmation(environmentId) {
  const environment = readSavedEnvironments().find((item) => item.id === environmentId);
  if (!environment) return;

  state.pendingDeleteEnvironmentId = environment.id;
  elements.deleteEnvironmentDomain.textContent = environment.domain;
  elements.deleteEnvironmentDialog.showModal();
}

function deleteSavedEnvironment() {
  const environmentId = state.pendingDeleteEnvironmentId;
  const environments = readSavedEnvironments();
  const environment = environments.find((item) => item.id === environmentId);
  if (!environment) {
    elements.deleteEnvironmentDialog.close();
    return;
  }

  try {
    localStorage.setItem(
      SAVED_ENVIRONMENTS_KEY,
      JSON.stringify(environments.filter((item) => item.id !== environmentId))
    );
  } catch {
    elements.deleteEnvironmentDialog.close();
    showMessage('环境删除失败，请检查浏览器是否允许本地存储。', 'error');
    return;
  }

  if (state.editingEnvironmentId === environmentId) state.editingEnvironmentId = undefined;
  elements.deleteEnvironmentDialog.close();
  renderSavedEnvironments();
  showMessage(`已删除环境 ${environment.domain}。`, 'success');
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
  elements.saveOnlyButton.disabled = !inputValid || !selectionValid;
  elements.copyPreviewButton.disabled = false;
  elements.previewSummary.textContent = `${state.repository.name} → ${domain || '等待输入域名'}`;
  elements.routeCount.textContent = `${modules.length} 个模块 · ${countRoutes(modules)} 条路由`;
  elements.previewContent.textContent = createHostsContent({
    repository: state.repository,
    modules,
    ip: ip || '<IP>',
    domain: domain || '<DOMAIN>'
  });

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

async function copyPreviewContent() {
  try {
    await writeClipboardText(elements.previewContent.textContent);
    elements.copyPreviewLabel.textContent = '已复制';
    setTimeout(() => {
      elements.copyPreviewLabel.textContent = '复制内容';
    }, 1600);
  } catch {
    showMessage('复制失败，请手动选中预览内容。', 'error');
  }
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 某些浏览器暴露了 Clipboard API，但会因权限策略拒绝调用，继续使用兼容方案。
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  let copied = false;
  try {
    textarea.select();
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error('浏览器不支持复制到剪贴板。');
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

function saveEnvironmentOnly() {
  updatePreview();
  if (elements.saveOnlyButton.disabled) return;

  const domain = elements.domainInput.value.trim().toLowerCase();
  const wasEditing = Boolean(state.editingEnvironmentId);
  const savedEnvironment = saveLocalEnvironment({
    repositoryId: state.repository.id,
    moduleIds: [...state.selectedModuleIds],
    ip: elements.ipInput.value.trim(),
    domain
  });

  if (!savedEnvironment) {
    showMessage('环境保存失败，请检查浏览器是否允许本地存储。', 'error');
    return;
  }
  showMessage(`${wasEditing ? '已更新' : '已保存'}环境 ${domain}，未生成或下载文件。`, 'success');
}

async function generateFile() {
  const modeInfo = MODE_INFO[APP_CONFIG.mode];
  const modules = getSelectedModules();
  const ip = elements.ipInput.value.trim();
  const domain = elements.domainInput.value.trim().toLowerCase();
  elements.confirmButton.disabled = true;
  elements.confirmButton.textContent = '处理中…';

  try {
    let result;
    if (usesServer()) {
      result = await generateOnServer({ ip, domain });
    } else {
      const now = new Date();
      result = {
        filename: createOutputFilename(state.repository.id, domain, now),
        content: createHostsContent({
          repository: state.repository,
          modules,
          ip,
          domain,
          generatedAt: now
        })
      };
    }

    if (downloadsFile()) downloadFile(result.filename, result.content);
    if (APP_CONFIG.mode !== OUTPUT_MODES.SERVER) saveLocalHistory({
      repositoryId: state.repository.id,
      ip,
      domain
    });
    saveLocalEnvironment({
      repositoryId: state.repository.id,
      moduleIds: [...state.selectedModuleIds],
      ip,
      domain
    });

    elements.dialog.close();
    elements.previewContent.textContent = result.content;
    showMessage(successMessage(result), 'success');
    await refreshConfig();
  } catch (error) {
    elements.dialog.close();
    showMessage(error.message, 'error');
  } finally {
    elements.confirmButton.disabled = false;
    elements.confirmButton.textContent = modeInfo.confirmAction;
  }
}

async function generateOnServer({ ip, domain }) {
  const response = await fetch(apiUrl('/api/hosts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repositoryId: state.repository.id,
      moduleIds: [...state.selectedModuleIds],
      ip,
      domain
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '服务器生成文件失败。');
  return result;
}

async function refreshConfig() {
  state.config = await loadConfig();
  renderOptions(elements.ipOptions, state.config.ipOptions);
  renderOptions(elements.domainOptions, state.config.domainOptions[state.repository.id]);
}

function buildLocalConfig() {
  const history = readLocalHistory();
  const ipOptions = new Set(REPOSITORY_CATALOG.map((item) => item.defaultIp));
  const domainOptions = Object.fromEntries(
    REPOSITORY_CATALOG.map((item) => [item.id, new Set([item.defaultDomain])])
  );

  for (const item of history) {
    if (!domainOptions[item.repositoryId]) continue;
    ipOptions.add(item.ip);
    domainOptions[item.repositoryId].add(item.domain);
  }

  return {
    ipOptions: [...ipOptions],
    domainOptions: Object.fromEntries(
      Object.entries(domainOptions).map(([key, values]) => [key, [...values]])
    )
  };
}

function mergeConfigs(primary, secondary) {
  const domainOptions = {};
  for (const repository of REPOSITORY_CATALOG) {
    domainOptions[repository.id] = [...new Set([
      ...(primary.domainOptions[repository.id] || []),
      ...(secondary.domainOptions[repository.id] || [])
    ])];
  }
  return {
    ipOptions: [...new Set([...(primary.ipOptions || []), ...(secondary.ipOptions || [])])],
    domainOptions
  };
}

function readLocalHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(item) {
  try {
    const history = readLocalHistory().filter((entry) => !(
      entry.repositoryId === item.repositoryId
      && entry.ip === item.ip
      && entry.domain === item.domain
    ));
    history.unshift({ ...item, savedAt: new Date().toISOString() });
    localStorage.setItem(
      LOCAL_HISTORY_KEY,
      JSON.stringify(history.slice(0, APP_CONFIG.historyLimit))
    );
  } catch {
    // 禁用或写满 localStorage 不影响文件下载。
  }
}

function readSavedEnvironments() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_ENVIRONMENTS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((environment) => {
      const repository = REPOSITORY_CATALOG.find((item) => item.id === environment?.repositoryId);
      if (!repository || !Array.isArray(environment.moduleIds)) return false;
      const availableModuleIds = new Set(repository.modules.map((module) => module.id));
      return typeof environment.id === 'string'
        && typeof environment.ip === 'string'
        && typeof environment.domain === 'string'
        && typeof environment.updatedAt === 'string'
        && isIp(environment.ip)
        && isHostname(environment.domain)
        && environment.moduleIds.some((moduleId) => availableModuleIds.has(moduleId));
    });
  } catch {
    return [];
  }
}

function saveLocalEnvironment(environment) {
  try {
    const environments = readSavedEnvironments();
    const existing = state.editingEnvironmentId
      ? environments.find((item) => item.id === state.editingEnvironmentId)
      : environments.find((item) => (
        item.repositoryId === environment.repositoryId && item.domain === environment.domain
      ));
    const savedEnvironment = {
      ...environment,
      id: existing?.id || createEnvironmentId(),
      updatedAt: new Date().toISOString()
    };
    const nextEnvironments = [
      savedEnvironment,
      ...environments.filter((item) => item.id !== savedEnvironment.id)
    ].slice(0, APP_CONFIG.historyLimit);
    localStorage.setItem(SAVED_ENVIRONMENTS_KEY, JSON.stringify(nextEnvironments));
    renderSavedEnvironments();
    return savedEnvironment;
  } catch {
    // 禁用或写满 localStorage 不影响文件生成。
    return undefined;
  }
}

function createEnvironmentId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatSavedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚更新';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date).replaceAll('/', '-');
}

function downloadFile(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function successMessage(result) {
  if (APP_CONFIG.mode === OUTPUT_MODES.DOWNLOAD) return `已下载 ${result.filename}`;
  if (APP_CONFIG.mode === OUTPUT_MODES.SERVER) return `已保存 ${result.relativePath}`;
  return `已保存 ${result.relativePath}，并下载 ${result.filename}`;
}

function usesServer() {
  return APP_CONFIG.mode === OUTPUT_MODES.SERVER || APP_CONFIG.mode === OUTPUT_MODES.BOTH;
}

function downloadsFile() {
  return APP_CONFIG.mode === OUTPUT_MODES.DOWNLOAD || APP_CONFIG.mode === OUTPUT_MODES.BOTH;
}

function apiUrl(path) {
  return `${APP_CONFIG.apiBaseUrl.replace(/\/$/u, '')}${path}`;
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
