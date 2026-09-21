// 部署时只需修改 mode，无需重新构建前端。
// download: 浏览器下载，历史记录保存在当前浏览器。
// server:   文件保存到服务器 hosts/，历史记录来自服务器。
// both:     服务器保存后，同时下载到浏览器。
export const APP_CONFIG = Object.freeze({
  mode: 'download',
  apiBaseUrl: '',
  historyLimit: 20
});

export const OUTPUT_MODES = Object.freeze({
  DOWNLOAD: 'download',
  SERVER: 'server',
  BOTH: 'both'
});
