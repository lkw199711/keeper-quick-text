import { createHostsContent, createOutputFilename } from './hosts-content.js';
import {
  DEFAULT_DEPLOYMENT_ENVIRONMENT_ID,
  DEPLOYMENT_ENVIRONMENTS,
  REPOSITORY_CATALOG,
  findDeploymentEnvironment,
  getRepositoryEnvironmentAddress,
  getRepositoryRouteCount
} from './route-catalog.js';
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
  deploymentEnvironmentList: document.querySelector('#deployment-environment-list'),
  showStandardTestButton: document.querySelector('#show-standard-test-button'),
  standardTestDialog: document.querySelector('#standard-test-dialog'),
  standardTestContent: document.querySelector('#standard-test-content'),
  copyStandardTestButton: document.querySelector('#copy-standard-test-button'),
  copyStandardTestLabel: document.querySelector('#copy-standard-test-label'),
  repositoryList: document.querySelector('#repository-list'),
  moduleList: document.querySelector('#module-list'),
  moduleSummary: document.querySelector('#module-summary'),
  selectAllButton: document.querySelector('#select-all-button'),
  clearAllButton: document.querySelector('#clear-all-button'),
  addressList: document.querySelector('#address-list'),
  previewSummary: document.querySelector('#preview-summary'),
  previewContent: document.querySelector('#preview-content'),
  routeCount: document.querySelector('#route-count'),
  copyPreviewButton: document.querySelector('#copy-preview-button'),
  copyPreviewLabel: document.querySelector('#copy-preview-label'),
  environmentTitleInput: document.querySelector('#environment-title-input'),
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
  confirmTitle: document.querySelector('#confirm-title'),
  confirmRelatedBranch: document.querySelector('#confirm-related-branch'),
  confirmEnvironment: document.querySelector('#confirm-environment'),
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
  selectedEnvironmentId: DEFAULT_DEPLOYMENT_ENVIRONMENT_ID,
  selectedRepositoryIds: new Set(),
  selectedModuleKeys: new Set(),
  repositoryAddresses: new Map(),
  repositoryBranches: new Map(),
  editingEnvironmentId: undefined,
  pendingDeleteEnvironmentId: undefined
};

init();

async function init() {
  bindEvents();
  renderSavedEnvironments();
  renderDeploymentEnvironments();
  renderRepositories();

  const modeInfo = MODE_INFO[APP_CONFIG.mode];
  if (!modeInfo) {
    showMessage(`runtime-config.js 中的 mode 配置无效：${APP_CONFIG.mode}`, 'error');
    return;
  }
  applyModeUi(modeInfo);

  try {
    state.config = await loadConfig();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function renderDeploymentEnvironments() {
  elements.deploymentEnvironmentList.innerHTML = '';
  for (const environment of DEPLOYMENT_ENVIRONMENTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'deployment-environment-card';
    button.dataset.environmentId = environment.id;
    button.setAttribute('aria-pressed', String(environment.id === state.selectedEnvironmentId));
    button.innerHTML = `
      <strong>${escapeHtml(environment.name)}</strong>
      <span>${escapeHtml(environment.description)}</span>
    `;
    button.addEventListener('click', () => selectDeploymentEnvironment(environment.id));
    elements.deploymentEnvironmentList.append(button);
  }
}

function selectDeploymentEnvironment(environmentId, { keepEditing = false } = {}) {
  if (!findDeploymentEnvironment(environmentId)) return;
  if (!keepEditing) state.editingEnvironmentId = undefined;
  state.selectedEnvironmentId = environmentId;
  state.repositoryAddresses = new Map(getSelectedRepositories().map((repository) => [
    repository.id,
    { ...getDefaultAddress(repository) }
  ]));
  renderDeploymentEnvironments();
  renderAddressFields();
  renderSavedEnvironments();
  updatePreview();
}

function bindEvents() {
  elements.showStandardTestButton.addEventListener('click', openStandardTestDialog);
  elements.copyStandardTestButton.addEventListener('click', copyStandardTestContent);
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

function openStandardTestDialog() {
  elements.standardTestContent.textContent = createStandardTestHostsContent();
  elements.copyStandardTestLabel.textContent = '复制内容';
  elements.standardTestDialog.showModal();
}

async function copyStandardTestContent() {
  try {
    await writeClipboardText(elements.standardTestContent.textContent);
    elements.copyStandardTestLabel.textContent = '已复制';
    setTimeout(() => {
      elements.copyStandardTestLabel.textContent = '复制内容';
    }, 1600);
  } catch {
    elements.copyStandardTestLabel.textContent = '复制失败';
  }
}

function createStandardTestHostsContent() {
  const deploymentEnvironment = findDeploymentEnvironment(DEFAULT_DEPLOYMENT_ENVIRONMENT_ID);
  return createHostsContent({
    deploymentEnvironment,
    selections: REPOSITORY_CATALOG.map((repository) => ({
      repository,
      modules: repository.modules,
      ...getRepositoryEnvironmentAddress(repository, DEFAULT_DEPLOYMENT_ENVIRONMENT_ID)
    }))
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
    const card = document.createElement('article');
    card.className = 'repository-card-shell';
    card.dataset.repositoryId = repository.id;
    card.dataset.selected = 'false';
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
    button.addEventListener('click', () => toggleRepository(repository.id));
    const branchField = document.createElement('label');
    branchField.className = 'repository-branch-field';
    branchField.innerHTML = `
      <span>关联分支 <small>选填</small></span>
      <input class="repository-branch-input" type="text" maxlength="200" placeholder="例如：feature/supplier-audit" autocomplete="off" disabled>
    `;
    const branchInput = branchField.querySelector('.repository-branch-input');
    branchInput.addEventListener('input', () => {
      state.repositoryBranches.set(repository.id, branchInput.value);
      updatePreview();
    });
    card.append(button, branchField);
    elements.repositoryList.append(card);
  }
}

function toggleRepository(repositoryId, { keepEditing = false } = {}) {
  if (!keepEditing) state.editingEnvironmentId = undefined;
  const repository = REPOSITORY_CATALOG.find((item) => item.id === repositoryId);
  if (!repository) return;
  if (state.selectedRepositoryIds.has(repositoryId)) {
    state.selectedRepositoryIds.delete(repositoryId);
    state.repositoryAddresses.delete(repositoryId);
    state.repositoryBranches.delete(repositoryId);
    for (const module of repository.modules) {
      state.selectedModuleKeys.delete(createModuleKey(repositoryId, module.id));
    }
  } else {
    state.selectedRepositoryIds.add(repositoryId);
    for (const module of repository.modules) {
      state.selectedModuleKeys.add(createModuleKey(repositoryId, module.id));
    }
    state.repositoryAddresses.set(repositoryId, { ...getDefaultAddress(repository) });
    state.repositoryBranches.set(repositoryId, '');
  }

  syncRepositorySelectionUi();
}

function syncRepositorySelectionUi() {
  for (const card of elements.repositoryList.querySelectorAll('.repository-card-shell')) {
    const selected = state.selectedRepositoryIds.has(card.dataset.repositoryId);
    card.dataset.selected = String(selected);
    card.querySelector('.repository-card').setAttribute('aria-pressed', String(selected));
    const branchInput = card.querySelector('.repository-branch-input');
    branchInput.disabled = !selected;
    branchInput.value = state.repositoryBranches.get(card.dataset.repositoryId) || '';
  }

  const hasRepositories = state.selectedRepositoryIds.size > 0;
  elements.selectAllButton.disabled = !hasRepositories;
  elements.clearAllButton.disabled = !hasRepositories;
  renderModules();
  renderAddressFields();
  renderSavedEnvironments();
  updatePreview();
}

function renderAddressFields() {
  const repositories = getSelectedRepositories();
  elements.addressList.innerHTML = '';
  if (repositories.length === 0) {
    elements.addressList.innerHTML = '<div class="loading-card">请先选择仓库</div>';
    return;
  }

  for (const repository of repositories) {
    const defaultAddress = getDefaultAddress(repository);
    const address = state.repositoryAddresses.get(repository.id) || { ...defaultAddress };
    state.repositoryAddresses.set(repository.id, address);
    const card = document.createElement('article');
    card.className = 'address-card';
    card.innerHTML = `
      <h3>${escapeHtml(repository.name)}</h3>
      <div class="field-grid">
        <label class="field">
          <span>IP 地址</span>
          <input class="repository-ip-input" name="ip-${escapeHtml(repository.id)}" list="ip-options-${escapeHtml(repository.id)}" placeholder="例如 6.120.39.72" autocomplete="off" value="${escapeHtml(address.ip)}">
          <datalist id="ip-options-${escapeHtml(repository.id)}"></datalist>
          <small>支持 IPv4 和 IPv6</small>
        </label>
        <label class="field">
          <span>访问域名</span>
          <input class="repository-domain-input" name="domain-${escapeHtml(repository.id)}" list="domain-options-${escapeHtml(repository.id)}" placeholder="例如 example.jdtest.net" autocomplete="off" value="${escapeHtml(address.domain)}">
          <datalist id="domain-options-${escapeHtml(repository.id)}"></datalist>
          <small>无需输入 https:// 或路径</small>
        </label>
      </div>
    `;
    const ipInput = card.querySelector('.repository-ip-input');
    const domainInput = card.querySelector('.repository-domain-input');
    renderOptions(card.querySelector(`#ip-options-${repository.id}`), state.config?.ipOptions || [defaultAddress.ip]);
    renderOptions(
      card.querySelector(`#domain-options-${repository.id}`),
      state.config?.domainOptions?.[repository.id] || [defaultAddress.domain]
    );
    ipInput.addEventListener('input', () => {
      address.ip = ipInput.value;
      updatePreview();
    });
    domainInput.addEventListener('input', () => {
      address.domain = domainInput.value;
      updatePreview();
    });
    elements.addressList.append(card);
  }
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
    const repositories = environment.repositoryIds
      .map((repositoryId) => REPOSITORY_CATALOG.find((item) => item.id === repositoryId))
      .filter(Boolean);
    if (repositories.length === 0) continue;
    const modules = environment.selections.flatMap((selection) => {
      const repository = REPOSITORY_CATALOG.find((item) => item.id === selection.repositoryId);
      return repository?.modules.filter((module) => selection.moduleIds.includes(module.id)) || [];
    });
    const environmentLabel = formatEnvironmentDomains(environment);
    const displayName = environment.title;
    const accessibleName = formatSavedEnvironmentReference(environment);
    const card = document.createElement('article');
    card.className = 'saved-environment-card';
    if (environment.id === state.editingEnvironmentId) card.dataset.editing = 'true';
    card.innerHTML = `
      <div class="saved-environment-card-heading">
        <div>
          <strong>${escapeHtml(displayName)}</strong>
          <span>${escapeHtml(repositories.map((repository) => repository.name).join('、'))}</span>
        </div>
        ${environment.id === state.editingEnvironmentId ? '<span class="editing-badge">编辑中</span>' : ''}
      </div>
      <dl class="saved-environment-details">
        <div><dt>环境</dt><dd>${escapeHtml(findDeploymentEnvironment(environment.deploymentEnvironmentId)?.name || '测试环境')}</dd></div>
        ${formatEnvironmentBranches(environment) ? `<div><dt>分支</dt><dd>${escapeHtml(formatEnvironmentBranches(environment))}</dd></div>` : ''}
        <div><dt>域名</dt><dd>${escapeHtml(environmentLabel)}</dd></div>
        <div><dt>IP</dt><dd>${escapeHtml(formatEnvironmentIps(environment))}</dd></div>
        <div><dt>生成</dt><dd>${escapeHtml(formatGeneratedTime(environment.generatedAt))}</dd></div>
        <div><dt>模块</dt><dd>${escapeHtml(modules.map((module) => module.name).join('、'))}</dd></div>
      </dl>
      <div class="saved-environment-footer">
        <time datetime="${escapeHtml(environment.updatedAt)}">${escapeHtml(formatSavedTime(environment.updatedAt))}</time>
        <div class="saved-environment-actions">
          <button class="edit-environment-button" type="button" aria-label="编辑 ${escapeHtml(accessibleName)}">编辑</button>
          <button class="delete-environment-button" type="button" aria-label="删除 ${escapeHtml(accessibleName)}">删除</button>
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
  state.selectedEnvironmentId = environment.deploymentEnvironmentId;
  state.selectedRepositoryIds = new Set(environment.repositoryIds);
  state.selectedModuleKeys = new Set(environment.selections.flatMap((selection) => (
    selection.moduleIds.map((moduleId) => createModuleKey(selection.repositoryId, moduleId))
  )));
  state.repositoryAddresses = new Map(environment.selections.map((selection) => [
    selection.repositoryId,
    { ip: selection.ip, domain: selection.domain }
  ]));
  state.repositoryBranches = new Map(environment.selections.map((selection) => [
    selection.repositoryId,
    selection.relatedBranch
  ]));
  elements.environmentTitleInput.value = environment.title;
  renderDeploymentEnvironments();
  syncRepositorySelectionUi();
  renderPreviewWithGeneratedAt(new Date(environment.generatedAt));
  showMessage(`正在编辑${environment.title ? `「${environment.title}」` : '未命名环境'}，重新生成后会更新该环境。`, 'success');
  document.querySelector('#repo-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDeleteEnvironmentConfirmation(environmentId) {
  const environment = readSavedEnvironments().find((item) => item.id === environmentId);
  if (!environment) return;

  state.pendingDeleteEnvironmentId = environment.id;
  elements.deleteEnvironmentDomain.textContent = formatSavedEnvironmentReference(environment);
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
  showMessage(`已删除${environment.title ? `环境「${environment.title}」` : '未命名环境'}。`, 'success');
}

function renderModules() {
  elements.moduleList.innerHTML = '';
  if (state.selectedRepositoryIds.size === 0) {
    elements.moduleList.innerHTML = '<div class="loading-card">请先选择仓库</div>';
  } else {
    for (const repository of getSelectedRepositories()) {
      for (const module of repository.modules) {
        const moduleKey = createModuleKey(repository.id, module.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'module-card';
        button.dataset.moduleKey = moduleKey;
        button.setAttribute('aria-pressed', String(state.selectedModuleKeys.has(moduleKey)));
        button.innerHTML = `
          <span class="module-repository-name">${escapeHtml(repository.name)}</span>
          <span class="module-name">${escapeHtml(module.name)}</span>
          <span class="module-description">${escapeHtml(module.description)}</span>
          <span class="route-types">
            ${module.routes.map((route) => `<span class="route-type">${route.type === 'audit' ? '审核' : '查询'}</span>`).join('')}
          </span>
        `;
        button.addEventListener('click', () => toggleModule(moduleKey));
        elements.moduleList.append(button);
      }
    }
  }
  updateModuleSelectionUi();
}

function toggleModule(moduleKey) {
  if (state.selectedModuleKeys.has(moduleKey)) {
    state.selectedModuleKeys.delete(moduleKey);
  } else {
    state.selectedModuleKeys.add(moduleKey);
  }
  updateModuleSelectionUi();
  updatePreview();
}

function selectAllModules() {
  state.selectedModuleKeys = new Set(getSelectedRepositories().flatMap((repository) => (
    repository.modules.map((module) => createModuleKey(repository.id, module.id))
  )));
  updateModuleSelectionUi();
  updatePreview();
}

function clearAllModules() {
  state.selectedModuleKeys.clear();
  updateModuleSelectionUi();
  updatePreview();
}

function updateModuleSelectionUi() {
  for (const card of elements.moduleList.querySelectorAll('.module-card')) {
    card.setAttribute('aria-pressed', String(state.selectedModuleKeys.has(card.dataset.moduleKey)));
  }
  const modules = getSelectedModules();
  elements.moduleSummary.textContent = `已选择 ${modules.length} 个模块，共 ${countRoutes(modules)} 条路由`;
}

function updatePreview() {
  const repositories = getSelectedRepositories();
  if (repositories.length === 0) {
    elements.generateButton.disabled = true;
    elements.saveOnlyButton.disabled = true;
    elements.copyPreviewButton.disabled = true;
    elements.previewSummary.textContent = '请先选择仓库';
    elements.routeCount.textContent = '0 条路由';
    elements.previewContent.textContent = '# 等待选择仓库…';
    elements.moduleSummary.textContent = '已选择 0 个模块';
    showMessage('');
    return;
  }
  const modules = getSelectedModules();
  const selections = getSelectedSelections();
  elements.confirmTitle.textContent = getEnvironmentTitle() || '未填写';
  const addressesPresent = selections.every((selection) => selection.ip && selection.domain);
  const inputValid = selections.every((selection) => (
    isIp(selection.ip) && isHostname(selection.domain)
  ));
  const selectionValid = modules.length > 0;

  elements.generateButton.disabled = !inputValid || !selectionValid;
  elements.saveOnlyButton.disabled = !inputValid || !selectionValid;
  elements.copyPreviewButton.disabled = false;
  elements.previewSummary.textContent = `${repositories.length} 个仓库 · ${selections.length} 组地址`;
  elements.routeCount.textContent = `${modules.length} 个模块 · ${countRoutes(modules)} 条路由`;
  elements.previewContent.textContent = createHostsContent({
    deploymentEnvironment: getSelectedDeploymentEnvironment(),
    selections: selections.map((selection) => ({
      ...selection,
      ip: selection.ip || '<IP>',
      domain: selection.domain || '<DOMAIN>'
    }))
  });

  if (!selectionValid) {
    showMessage('请至少选择一个业务模块。', 'error');
  } else if (!addressesPresent) {
    showMessage('请为每个仓库填写 IP 和域名。');
  } else if (!inputValid) {
    showMessage('某个仓库的 IP 或域名格式不正确。', 'error');
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
  const selections = getSelectedSelections();
  elements.confirmRelatedBranch.textContent = formatSelectionBranches(selections) || '未填写';
  elements.confirmEnvironment.textContent = getSelectedDeploymentEnvironment().name;
  elements.confirmRepository.textContent = getSelectedRepositories().map((repository) => repository.name).join('、');
  elements.confirmModules.textContent = modules.map((module) => module.name).join('、');
  elements.confirmIp.textContent = selections.map((selection) => `${selection.repository.name}: ${selection.ip}`).join('；');
  elements.confirmDomain.textContent = selections.map((selection) => `${selection.repository.name}: ${selection.domain}`).join('；');
  elements.confirmRoutes.textContent = `${countRoutes(modules)} 条`;
  elements.dialog.showModal();
}

function saveEnvironmentOnly() {
  updatePreview();
  if (elements.saveOnlyButton.disabled) return;

  const confirmedAt = new Date();
  const environmentTitle = getEnvironmentTitle();
  const wasEditing = Boolean(state.editingEnvironmentId);
  const savedEnvironment = saveLocalEnvironment({
    title: getEnvironmentTitle(),
    generatedAt: confirmedAt.toISOString(),
    deploymentEnvironmentId: state.selectedEnvironmentId,
    repositoryIds: [...state.selectedRepositoryIds],
    selections: serializeSelectedSelections()
  }, confirmedAt);

  if (!savedEnvironment) {
    showMessage('环境保存失败，请检查浏览器是否允许本地存储。', 'error');
    return;
  }
  renderPreviewWithGeneratedAt(confirmedAt);
  showMessage(
    `${wasEditing ? '已更新' : '已保存'}环境${environmentTitle ? `「${environmentTitle}」` : ''}并确认生成时间，未生成或下载文件。`,
    'success'
  );
}

async function generateFile() {
  const modeInfo = MODE_INFO[APP_CONFIG.mode];
  const selections = getSelectedSelections();
  elements.confirmButton.disabled = true;
  elements.confirmButton.textContent = '处理中…';

  try {
    let result;
    let confirmedAt;
    if (usesServer()) {
      result = await generateOnServer();
      confirmedAt = new Date(result.generatedAt);
      if (Number.isNaN(confirmedAt.getTime())) confirmedAt = new Date();
    } else {
      const now = new Date();
      confirmedAt = now;
      const repositoryIds = [...state.selectedRepositoryIds];
      result = {
        filename: createOutputFilename(
          repositoryIds,
          selections.map((selection) => selection.domain),
          now
        ),
        content: createHostsContent({
          deploymentEnvironment: getSelectedDeploymentEnvironment(),
          selections,
          generatedAt: now
        })
      };
    }

    if (downloadsFile()) downloadFile(result.filename, result.content);
    if (APP_CONFIG.mode !== OUTPUT_MODES.SERVER) {
      for (const selection of serializeSelectedSelections()) {
        saveLocalHistory({
          repositoryId: selection.repositoryId,
          ip: selection.ip,
          domain: selection.domain
        });
      }
    }
    saveLocalEnvironment({
      title: getEnvironmentTitle(),
      generatedAt: confirmedAt.toISOString(),
      deploymentEnvironmentId: state.selectedEnvironmentId,
      repositoryIds: [...state.selectedRepositoryIds],
      selections: serializeSelectedSelections()
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

async function generateOnServer() {
  const response = await fetch(apiUrl('/api/hosts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deploymentEnvironmentId: state.selectedEnvironmentId,
      selections: serializeSelectedSelections()
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '服务器生成文件失败。');
  return result;
}

async function refreshConfig() {
  state.config = await loadConfig();
  renderAddressFields();
}

function buildLocalConfig() {
  const history = readLocalHistory();
  const ipOptions = new Set(REPOSITORY_CATALOG.flatMap((item) => (
    Object.values(item.environments).map((address) => address.ip)
  )));
  const domainOptions = Object.fromEntries(
    REPOSITORY_CATALOG.map((item) => [
      item.id,
      new Set(Object.values(item.environments).map((address) => address.domain))
    ])
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
    return value.map(normalizeSavedEnvironment).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeSavedEnvironment(environment) {
  if (!environment || typeof environment.id !== 'string'
    || typeof environment.updatedAt !== 'string') return undefined;

  const requestedRepositoryIds = Array.isArray(environment.repositoryIds)
    ? environment.repositoryIds
    : [environment.repositoryId];
  const repositoryIds = REPOSITORY_CATALOG
    .filter((repository) => requestedRepositoryIds.includes(repository.id))
    .map((repository) => repository.id);
  if (repositoryIds.length === 0) return undefined;

  const requestedSelections = Array.isArray(environment.selections)
    ? environment.selections
    : [{
      repositoryId: environment.repositoryId,
      moduleIds: environment.moduleIds,
      ip: environment.ip,
      domain: environment.domain
    }];
  const selections = repositoryIds.map((repositoryId) => {
    const repository = REPOSITORY_CATALOG.find((item) => item.id === repositoryId);
    const requested = requestedSelections.find((item) => item?.repositoryId === repositoryId);
    const requestedModuleIds = Array.isArray(requested?.moduleIds) ? requested.moduleIds : [];
    return {
      repositoryId,
      ip: String(requested?.ip || environment.ip || '').trim(),
      domain: String(requested?.domain || environment.domain || '').trim().toLowerCase(),
      relatedBranch: String(requested?.relatedBranch ?? environment.relatedBranch ?? '').trim().slice(0, 200),
      moduleIds: repository.modules
        .filter((module) => requestedModuleIds.includes(module.id))
        .map((module) => module.id)
    };
  });
  if (selections.every((selection) => selection.moduleIds.length === 0)) return undefined;
  if (selections.some((selection) => !isIp(selection.ip) || !isHostname(selection.domain))) return undefined;

  const deploymentEnvironmentId = findDeploymentEnvironment(environment.deploymentEnvironmentId)
    ? environment.deploymentEnvironmentId
    : DEFAULT_DEPLOYMENT_ENVIRONMENT_ID;
  const title = String(environment.title || '').trim().slice(0, 60);
  const parsedGeneratedAt = new Date(environment.generatedAt || environment.updatedAt);
  const generatedAt = Number.isNaN(parsedGeneratedAt.getTime())
    ? new Date().toISOString()
    : parsedGeneratedAt.toISOString();
  return {
    ...environment,
    title,
    generatedAt,
    deploymentEnvironmentId,
    repositoryIds,
    selections
  };
}

function saveLocalEnvironment(environment, savedAt = new Date()) {
  try {
    const environments = readSavedEnvironments();
    const existing = state.editingEnvironmentId
      ? environments.find((item) => item.id === state.editingEnvironmentId)
      : environments.find((item) => (
        item.title === environment.title
        &&
        item.deploymentEnvironmentId === environment.deploymentEnvironmentId
        &&
        repositorySetKey(item.repositoryIds) === repositorySetKey(environment.repositoryIds)
        && environmentAddressKey(item) === environmentAddressKey(environment)
      ));
    const savedEnvironment = {
      ...environment,
      id: existing?.id || createEnvironmentId(),
      updatedAt: savedAt.toISOString()
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

function formatGeneratedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
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

function getSelectedRepositories() {
  return REPOSITORY_CATALOG.filter((repository) => state.selectedRepositoryIds.has(repository.id));
}

function getSelectedDeploymentEnvironment() {
  return findDeploymentEnvironment(state.selectedEnvironmentId)
    || findDeploymentEnvironment(DEFAULT_DEPLOYMENT_ENVIRONMENT_ID);
}

function getDefaultAddress(repository) {
  return getRepositoryEnvironmentAddress(repository, state.selectedEnvironmentId)
    || getRepositoryEnvironmentAddress(repository, DEFAULT_DEPLOYMENT_ENVIRONMENT_ID)
    || { ip: '', domain: '' };
}

function getSelectedSelections() {
  return getSelectedRepositories().map((repository) => {
    const address = state.repositoryAddresses.get(repository.id) || { ip: '', domain: '' };
    return {
      repository,
      modules: repository.modules.filter((module) => (
        state.selectedModuleKeys.has(createModuleKey(repository.id, module.id))
      )),
      ip: address.ip.trim(),
      domain: address.domain.trim().toLowerCase(),
      relatedBranch: String(state.repositoryBranches.get(repository.id) || '').trim().slice(0, 200)
    };
  });
}

function serializeSelectedSelections() {
  return getSelectedSelections().map(({ repository, modules, ip, domain, relatedBranch }) => ({
    repositoryId: repository.id,
    moduleIds: modules.map((module) => module.id),
    ip,
    domain,
    relatedBranch
  }));
}

function getSelectedModules() {
  return getSelectedSelections().flatMap((selection) => selection.modules);
}

function createModuleKey(repositoryId, moduleId) {
  return `${repositoryId}:${moduleId}`;
}

function repositorySetKey(repositoryIds) {
  return [...repositoryIds].sort().join('|');
}

function environmentAddressKey(environment) {
  return environment.selections
    .map((selection) => (
      `${selection.repositoryId}:${selection.ip}:${selection.domain}:${selection.relatedBranch || ''}`
    ))
    .sort()
    .join('|');
}

function formatEnvironmentDomains(environment) {
  return environment.selections.map((selection) => selection.domain).join('、');
}

function formatEnvironmentIps(environment) {
  return environment.selections.map((selection) => selection.ip).join('、');
}

function formatEnvironmentBranches(environment) {
  return environment.selections
    .filter((selection) => selection.relatedBranch)
    .map((selection) => `${selection.repositoryId}: ${selection.relatedBranch}`)
    .join('；');
}

function formatSelectionBranches(selections) {
  return selections
    .filter((selection) => selection.relatedBranch)
    .map((selection) => `${selection.repository.name}: ${selection.relatedBranch}`)
    .join('；');
}

function formatSavedEnvironmentReference(environment) {
  return environment.title || '未命名环境';
}

function getEnvironmentTitle() {
  return elements.environmentTitleInput.value.trim().slice(0, 60);
}

function renderPreviewWithGeneratedAt(generatedAt) {
  elements.previewContent.textContent = createHostsContent({
    deploymentEnvironment: getSelectedDeploymentEnvironment(),
    selections: getSelectedSelections(),
    generatedAt
  });
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
