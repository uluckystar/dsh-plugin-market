# dsh-plugin-market 生产就绪报告

> 生成时间:2026-08-17 13:15 +0800(生产收口复核)
> 目标:插件市场达到可发布状态(代码、公开仓库、Topic、官方 Discussion 与真实 DSH 验收闭环)
> 验证环境:隔离 `market-test` profile + 主 web profile(3080)复核

## 一、验证矩阵(实测证据)

| 能力 | 验证方式 | 结果 |
|---|---|---|
| 安装真实写依赖 | 隔离 profile 真实 pnpm add | ✅ |
| 启用真实写启用列表 | 隔离 profile 真实 API enable + 检查 bundles | ✅ |
| 启用后重启生效 | 隔离实例重启 → 状态 enabled-active(进程真实加载) | ✅ |
| 停用真实移除启用列表、保留安装 | 隔离 profile 真实 API disable + 检查 | ✅ |
| 卸载真实清理依赖+启用列表 | 隔离 profile 真实 API uninstall + 重启健康 | ✅ |
| 生命周期七态推导 | lifecycle/status API 实测(含 disabled-restart) | ✅ |
| 不兼容检测(冲突) | dsh-TUI → incompatible;enable 被拒,profile 未被改 | ✅ |
| 不可加载插件防护 | client-only 插件 install/enable 被拒(防启动失败) | ✅ |
| 备份/写后校验/回滚 | 恶意写入被拒+自动回滚(smoke) | ✅ |
| 备份轮换 | .bak-* 只保留最近 8 个 | ✅(代码) |
| 核心组件保护 | base/web-app 白名单不可删 | ✅ |
| 输入注入防护(P0) | 恶意 payload 拒绝,无执行(`a b; touch /tmp/pwn2` 实测) | ✅ |
| CSRF 防护(P0) | 跨源 Origin 请求 403,同源放行 | ✅ |
| 写并发防护(H1) | 所有写操作经 enqueueProfileMutation 串行队列(与 pnpm 互斥) | ✅(代码+实测) |
| 分类计数一致性(M12/H2) | 3081 实测:10 分类计数与 categoryOf 逐项比对 NONE mismatch | ✅ |
| 已安装页行元数据(M3/M4) | lifecycle 键为 owner/repo,catalog 回填星数/描述 | ✅(代码) |
| 破坏性操作二次确认(H1-UX) | install/enable/disable/uninstall 均 window.confirm 用户语言 | ✅(代码+bundle) |
| 搜索竞态守卫(M5) | runSearch 请求序号守卫,过期响应丢弃 | ✅(代码) |
| 单元级 smoke | lifecycle-smoke.mjs 18 项(备份/写校验/回滚/增删/冲突/核心保护) | ✅ |
| typecheck / build | host + client 双 tsc + tsdown | ✅ |
| 内部术语扫描 | 市场三视图+locales+gateway 用户文案:dependencies/bundle/pnpm 零出现 | ✅ |
| AI 搜索星数(L8) | 实测 Olalaye/dsh-layered-memory 等 ★0 与 GitHub live API 一致(数据真实,非缺陷) | ✅ |
| AI 搜索链路 | mydsh.dev /api/ai-search SSE 解析 3 条推荐,name 提取正确 | ✅ |
| 严格展示校验 | 5596 个候选经 raw/HEAD package.json 全量校验;3656 valid / 1940 invalid / 0 skipped;只展示 valid | ✅ |

## 二、生产化修复清单(队长汇总四成员产出)

### P0 安全(架构师 t1 → 队长修复,3081 实测)
- P0 命令注入:install/uninstall/enable/disable 输入统一 `validPackageName` 白名单校验,shell 参数仍引用转义。恶意 `$(...)`/分号 payload 拒绝且无执行。
- P0 CSRF:6 个写路由同源守卫(Origin ≠ Host → 403);readJson 64KB body 上限;错误响应不再回传内部路径。

### H1 写 profile 安全(架构师 t1 → 队长修复)
- 写竞态:install/enable/disable/uninstall 全部入 `enqueueProfileMutation` 串行队列(与 pnpm 子进程写互斥,消除丢失更新窗口)。
- 并发去重:队列天然串行,双开页/双击同操作不再并发执行。

### H2-H3 状态与冲突(架构师 t1 → 队长/开发修复)
- H2 patchEntryIds 正则增强:支持含点号与引号 id(`x.timer`、`'@s/p'`),减少漏检/误检。
- H3 卸载清理安装失败记录:uninstall 成功路径清除 lifecycleFailures,无「幽灵失败徽章」。
- 不可加载插件防护:`isLoadableBundle` 校验——只有 dsh.client 无 dsh.bundle 的插件 install/enable 拒绝(防启动失败,该状态由 lifecycle 标记 incompatible)。

### M/L 批量修复(开发 t3,typecheck+build 通过)
- M12 前后端分类单一来源:types.ts 共享 `categoryOf()` + `MARKET_CATEGORIES`,gateway 与 MarketTab 均 import 复用(原前端复制缺 17 个 topic)。
- M13 runBrowse 竞态:useRef 请求序号守卫,过期响应/异常丢弃。
- L14 已安装徽章数:改用 lifecycle items 行数(与已安装页行一致)。
- L16 备份轮换:只留最近 8 个 .bak-*。
- L19 超时:install 前 GitHub 校验与 assess fetch 加 10s AbortController。
- L20 readJson 64KB 上限 + readBody 包装(8 个带 body 路由),guarded 加 catch 兜底。
- L22 构造日志脱敏:proxyUrl user:pass → `***:***`,token 只打「已配置/未配置」。
- L18 startValidation 403 重试上限:已升级为 raw/HEAD + 显式代理 + 并发严格校验,不再依赖未认证 GitHub API 60/h 配额;skipped/unknown 不展示。
- L21 已验证无需改(writeProfileSafe 本就展开保留其他键)。

### UX 体验修复(用户代表 t4 → 队长,3081 复验)
- H1 破坏性操作二次确认:安装/启用/停用/卸载均加用户语言确认弹窗(产品级误触防护)。
- M3/M4 已安装 tab 行元数据:catalog 回填星数/中文描述,无 catalog 条目时回退依赖名;命名与浏览/搜索视图一致。
- M5 勾选 AI 后立即搜索的竞态:runSearch 序号守卫(与 M13 同模式)。
- L6/L7 中文标点统一:半角逗号/括号改为全角(gateway.ts:445、locales.ts disabledRestartHint)。
- L8 已核验非缺陷:AI 推荐 ★0 与 GitHub live API 一致(仓库真实 0 star,catalog 数据正确)。
- L9/L10 外部数据与按钮密度:描述句号不统一属上游仓库简介,安全评估按钮保留为产品设计,记录备查。

## 三、PM 验收清单(t2,全文见 .agent-teams/market-production/t2-acceptance-checklist.md)

- 功能验收 F1-F12:分类浏览/本地+AI 搜索/安装不自动启用/七态按钮流/状态徽章/安全评估/非插件过滤/不兼容处理/已安装清单/失败留痕 全部 ✅(F2 分类一致性原 ❌ → 本次 M12 修复并 3081 实测一致)。
- 状态流七态验收:每态「用户看到什么/下一步」✅;「安装失败」态代码路径完整(只读约束下未人为制造失败,留待上线后补测)。
- 文案验收:面向最终用户、无内部术语、引导清晰 ✅。
- PM 提醒:主 web(3080)运行旧构建,上线前重启后须按清单复验。

## 四、已知边界与上线后迭代(记录,不阻塞发布)

1. 插件间冲突检测未做(两社区插件同 entry id 第二个加载失败无人拦)——单插件冲突(与 DSH 核心)已覆盖。
2. enable changed:false 返回 enabled-active 的边界语义(进程未加载时应为 enabled-restart)——当前 UI 用刷新后 lifecycle 掩盖,可接受。
3. loadedModuleNames 启动时采样一次,热重载后可能 stale(当前 DSH 启动一次加载,风险低)。
4. lifecycle() 每次调用全量重算(性能,当前规模无感)。
5. 供应链:install 用默认分支无版本钉住——社区插件市场定位,README 已声明「安装即信任」,安全评估功能对冲。
6. 安装失败态 UI 实测盲区(隔离实例无现成失败项)——代码路径完整,上线后造失败补测。
7. 死代码:/api/plugin-market/catalog 路由客户端未调用;types.ts needs_review 未使用——无害,下个迭代清理。

## 五、发布与上线复核

1. 公开仓库:推送到 `https://github.com/uluckystar/dsh-plugin-market.git`。
2. GitHub Topics:`deepseek-harness` / `deepseek-harness-plugin` / `dsh-plugin` / `plugin-market` / `mydsh`。
3. 官方 Discussion:已在 deepseek-ai/deepseek-harness Discussions #1758 发布插件市场生产化更新。
4. 主 web(3080):已重启并返回 200;插件市场 browse/status/install-block API 已复核。
5. 验证脚本输出 `plugin_market_validated_bundle_v1.json`;当前目录校验数据 5596 候选 / 3656 有效 / 1940 无效 / 0 跳过。

## 六、隔离环境清理

- 3081 实例与 `~/.dsh/profiles/market-test` 为验证用,已随本报告清理(见交付说明)。
