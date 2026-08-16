# dsh-plugin-market · 插件市场

在 DeepSeek Harness 设置页直接浏览 **mydsh.dev 插件大全**——分类浏览、本地/AI 搜索、安装、启用、停用、卸载和安全评估。非官方社区 mydsh.dev 出品。

![dsh-plugin-market](https://img.shields.io/badge/dsh-plugin-market-e63946?style=flat-square)

## 功能

- **分类浏览**：全部 / Agent / MCP / 开发工具 / 界面 / 视觉 / LLM / 记忆 / 数据 / 集成 共 10 类，带计数，按星数排序，加载更多
- **本地搜索**：毫秒级本地匹配（名称 / 中英简介 / 描述 / topics）
- **AI 搜索**：勾选 🤖 AI 后调用 mydsh.dev 的 AI 搜索（gpt-5.6-luna），语义理解你的需求
- **安装后可控启用**：安装只把插件加入当前配置，是否启用由用户明确点击「启用」决定
- **启用 / 停用 / 卸载**：启用后提示是否需要重启；停用保留安装，卸载会清理安装和启用状态
- **生命周期状态**：未安装、已安装未启用、已启用需重启、已启用已生效、不兼容不建议启用、安装失败
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

安装本插件后重启 profile（`pm2 restart dsh-web` 或重启 DSH），在 **设置 → 插件 → 插件市场** 查看。后续通过插件市场安装的插件需要先「启用」，再按提示重启 DSH 后生效。

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
| `POST /api/plugin-market/install` | `{repo}` 安装到当前配置，但不自动启用 |
| `POST /api/plugin-market/enable` | `{repo}` 启用插件，必要时提示重启 |
| `POST /api/plugin-market/disable` | `{repo}` 停用插件，保留安装 |
| `POST /api/plugin-market/uninstall` | `{repo}` 卸载并清理启用状态 |
| `POST /api/plugin-market/status` | `{repo}` 查看单个插件生命周期状态 |
| `GET /api/plugin-market/lifecycle` | 当前配置下全部已安装插件生命周期 |
| `POST /api/plugin-market/assess` | `{repo}` 安全评估 |
| `GET /api/plugin-market/installed` | 已安装清单 |

## 数据源

[MyDSH · DeepSeek Harness 插件大全](https://mydsh.dev/plugins) —— 自动同步官方 dsh-plugin topic 的 3000+ 插件，每个带 AI 中英总结、安全报告。非官方社区。

## License

MIT

## 生命周期管理(生产化,2026-08-17)

插件生命周期七态(面向最终用户):未安装 / 已安装未启用 / 已启用需重启 / 已启用已生效 / 已停用需重启 / 不兼容不建议启用 / 安装失败。

- **安装**:只把插件装进当前配置(加入依赖);是否启用由用户显式操作。
- **启用/停用**:启用=加入启用列表;停用=移出启用列表但保留安装,可随时重新启用。
- **卸载**:移除依赖并移出启用列表。
- **安全性**:每次写配置前自动备份;写后重新读取校验(核心组件保护:DSH 自带底座永不误删);校验失败自动回滚。
- **不兼容检测**:插件与 DSH 自带组件冲突(如重复注册)时,标记「不兼容·不建议启用」并拒绝启用。
- **已生效判定**:启用后,当前运行中的 DSH 已加载该插件 → 「已启用」;否则 → 「已启用·重启后生效」。
- **安装失败记录**:失败原因持久保存,界面显示「重试安装」。
- 验证:`node scripts/lifecycle-smoke.mjs`(临时 profile,15 项断言,不碰真实配置)。
