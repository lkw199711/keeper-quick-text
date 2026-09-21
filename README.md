# keeper-quick-text

通过 Web 页面选择仓库和业务模块，替换快速部署后的 IP、域名，并生成新的 `.hosts` 文件。

## 环境要求

- 下载模式线上运行只需要静态 Web 服务器和现代浏览器
- 服务器保存模式需要 Node.js 18 或更高版本
- 无第三方运行时依赖

## Web 页面

```bash
npm start
```

浏览器访问 [http://127.0.0.1:4173](http://127.0.0.1:4173)，按以下流程操作：

1. 从三个仓库中选择一个。
2. 选择本次需要的一个或多个业务模块。
3. 选择历史记录或输入新的 IP、域名。
4. 检查路由预览并确认生成。

默认情况下，新文件由浏览器直接下载，命名格式为：

```text
<仓库>-<域名>-<北京时间戳>.hosts
```

页面只输出所选模块的路由，并保留名称、路径和查询参数，只替换 IP 与域名。

## 运行模式

在 `public/runtime-config.js` 中修改 `mode`，不需要重新构建前端：

```js
export const APP_CONFIG = Object.freeze({
  mode: 'download',
  apiBaseUrl: '',
  historyLimit: 20
});
```

| mode | 文件去向 | 历史记录 | 是否需要 Node 后端 |
| --- | --- | --- | --- |
| `download` | 浏览器下载 | 浏览器 `localStorage` | 否 |
| `server` | 服务器 `hosts/` | 服务器生成历史 | 是 |
| `both` | 服务器保存并下载 | 合并浏览器与服务器历史 | 是 |

页面顶部会显示当前运行模式。配置为 `server` 或 `both` 但后端不可用时，页面会明确报错，不会静默切换模式。

### 纯静态部署

保持 `mode: 'download'`，把整个 `public/` 目录内容上传到 Nginx 网站目录即可。例如：

```text
/var/www/keeper-quick-text/
├── index.html
├── app.js
├── hosts-content.js
├── route-catalog.js
├── runtime-config.js
└── styles.css
```

无需执行构建命令，也不需要部署 `src/`、`test/` 和 `hosts/`。

### 后端模式

将 `mode` 改为 `server` 或 `both`，部署完整项目并执行 `npm start`。推荐由 Nginx 将页面和 `/api` 代理到同一个域名；如使用同域子路径，可通过 `apiBaseUrl` 配置该路径前缀。

开发时可以启用自动重启：

```bash
npm run dev
```

## 命令行工具

项目仍保留轻量 CLI，可直接拼接 hosts 内容：

```bash
npm link
quick-text 10.20.30.40 seller-test.example.com api-test.example.com
quick-text --ip 10.20.30.40 --file deploy.log
cat deploy.log | quick-text --ip 10.20.30.40
quick-text --help
```

Web 页面和 CLI 都不会直接修改系统的 `/etc/hosts`。

## 路由字典

页面使用 `public/route-catalog.js` 作为仓库、模块和路由的唯一维护入口。字典层级为：

```text
仓库 repository
└── 模块 module
    ├── 审核路由 route[type=audit]
    └── 查询路由 route[type=query]
```

当前包含三个仓库：

- `keeper-sell-supplier`
- `keeper-qua-audit`
- `keeper-second-review`

路由字段包括稳定 ID、显示名称、类型和相对路径。`XX审核` 与 `XX查询` 归入同一个业务模块；只有单页面时模块也可以只配置一条路由。

`hosts/标准测试环境.hosts` 保留为基准样例，测试会检查字典中的 21 条路由与该文件一致，避免迁移时遗漏。后续增加或调整路由只需维护 `public/route-catalog.js`。生成历史中的 IP、域名会自动成为页面的可选项。

## 本地开发

```bash
npm test
npm run check
```

## Git 远端约定

- `origin`：Gitee 主仓库
- `github`：GitHub 镜像仓库

日常推送到主仓库：

```bash
git push origin main
```

同步到 GitHub：

```bash
git push github main
```
