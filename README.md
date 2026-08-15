# dsh-plugin-market · 插件市场

在 DeepSeek Harness 设置页直接浏览 **mydsh.dev 插件大全**（3000+ 插件）——分类浏览、本地/AI 搜索、一键安装与卸载、安全评估。非官方社区 mydsh.dev 出品。

![dsh-plugin-market](https://img.shields.io/badge/dsh-plugin-market-e63946?style=flat-square)

## 功能

- **分类浏览**：全部 / Agent / MCP / 开发工具 / 界面 / 视觉 / LLM / 记忆 / 数据 / 集成 共 10 类，带计数，按星数排序，加载更多
- **本地搜索**：毫秒级本地匹配（名称 / 中英简介 / 描述 / topics）
- **AI 搜索**：勾选 🤖 AI 后调用 mydsh.dev 的 AI 搜索（gpt-5.6-luna），语义理解你的需求
- **一键安装**：`pnpm add github:owner/repo` 到当前 profile，刷新页面即生效
- **一键卸载**：已安装列表直接卸载
- **安全评估**：查询 mydsh.dev 安全报告，无报告则引导提交
- **mydsh.dev 引流**：每个插件带详情页链接（README / 安装方式 / 相似推荐 / 中文总结）

## 性能

- 插件大全**磁盘持久化缓存**（`$DSH_HOME/storages/plugin_market_catalog.json`，6 小时 TTL）：重启不丢、不重复拉取 2MB 数据
- 分类切换**纯本地过滤**，零网络请求
- AI 搜索 6 秒超时保护，慢不阻塞本地结果

## 安装

```bash
# 方式一：从 GitHub 安装
dsh plugin --profile web add github:uluckystar/dsh-plugin-market

# 方式二：从本地目录安装（开发）
dsh plugin --profile web add /path/to/dsh-plugin-market
```

安装后重启 profile（`pm2 restart dsh-web` 或重启 DSH），在 **设置 → 插件 → 插件市场** 查看。

## 配置（cordis.patch.yml）

```yaml
- id: plugin-market
  name: dsh-plugin-market
  config:
    marketBaseUrl: 'https://mydsh.dev'      # 数据源
    profileName: 'web'                       # 安装目标 profile
    pnpmCommand: 'npx -y pnpm@11.7.0'        # pnpm 版本（匹配 profile packageManager）
    proxyUrl: 'http://127.0.0.1:7897'        # 本机代理（加速 GitHub 下载），可置空
    catalogCacheMs: 21600000                 # 插件大全缓存 TTL（6 小时）
    installTimeoutMs: 300000                 # 安装超时
```

## API

| 端点 | 说明 |
|---|---|
| `POST /api/plugin-market/browse` | `{category, limit}` 分类浏览（limit=0 全量） |
| `POST /api/plugin-market/search` | `{query, ai}` 本地 + 可选 AI 搜索 |
| `POST /api/plugin-market/install` | `{repo}` 一键安装 |
| `POST /api/plugin-market/uninstall` | `{repo}` 卸载 |
| `POST /api/plugin-market/assess` | `{repo}` 安全评估 |
| `GET /api/plugin-market/installed` | 已安装清单 |

## 数据源

[MyDSH · DeepSeek Harness 插件大全](https://mydsh.dev/plugins) —— 自动同步官方 dsh-plugin topic 的 3000+ 插件，每个带 AI 中英总结、安全报告。非官方社区。

## License

MIT
