# keeper-quick-text

把项目快速部署后得到的 IP、域名或 URL，拼接成可直接复制到本机 `hosts` 文件的内容。

## 环境要求

- Node.js 18 或更高版本
- 无第三方运行时依赖

## 快速使用

```bash
npm link
quick-text 10.20.30.40 seller-test.example.com api-test.example.com
```

输出：

```text
10.20.30.40       api-test.example.com
10.20.30.40       seller-test.example.com
```

也可以直接处理部署日志，工具会从 URL 中提取域名：

```bash
quick-text --ip 10.20.30.40 --file deploy.log
cat deploy.log | quick-text --ip 10.20.30.40
```

写入单独文件：

```bash
quick-text 10.20.30.40 seller-test.example.com --output keeper.hosts
```

合并为一行，并保留输入顺序：

```bash
quick-text 10.20.30.40 b.example.com a.example.com --compact --no-sort
```

查看全部选项：

```bash
quick-text --help
```

> 工具只生成 hosts 文本，不会直接修改系统的 `/etc/hosts`，避免误覆盖已有配置。

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
