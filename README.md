# keeper-quick-text

从 `hosts/标准测试环境.hosts` 提取仓库路由，通过 Web 页面替换快速部署后的 IP 和域名，并生成新的 `.hosts` 文件。

## 环境要求

- Node.js 18 或更高版本
- 无第三方运行时依赖

## Web 页面

```bash
npm start
```

浏览器访问 [http://127.0.0.1:4173](http://127.0.0.1:4173)，按以下流程操作：

1. 从三个仓库中选择一个。
2. 选择历史记录或输入新的 IP、域名。
3. 检查路由预览并确认生成。

新文件写入项目的 `hosts/` 目录，命名格式为：

```text
<仓库>-<域名>-<北京时间戳>.hosts
```

页面会保留模板中的路由名称、路径和查询参数，只替换所选分段的 IP 与域名。标准测试环境模板不会被修改。

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

## 模板约定

三个仓库及路由均从 `hosts/标准测试环境.hosts` 解析：

- `keeper-sell-supplier`
- `keeper-qua-audit`
- `keeper-second-review`

如需增加或调整页面路由，请优先更新该模板。生成历史中的 IP、域名会自动成为页面的可选项。

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
