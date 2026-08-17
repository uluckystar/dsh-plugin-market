# Changelog

All notable changes to dsh-plugin-market are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/), versioning follows [SemVer](https://semver.org/lang/zh-CN/).

## [0.1.0] - 2026-08-17

生产化首发(production-ready initial release)。

### 新增

- **插件生命周期七态**:未安装 / 已安装·未启用 / 已启用·重启后生效 / 已启用 / 已停用·重启后生效 / 不兼容·不建议启用 / 安装失败,每行状态徽章 + 按状态渲染操作按钮
- **安装/启用/停用/卸载分离**:安装不自动启用;停用保留安装可随时重新启用;卸载彻底清理
- **一键自动重启生效**:确认弹窗(预估 10–30 秒 / 对话历史保留 / 建议无任务时执行)→ 重启 → 页面自动刷新;适配 PM2 / 手动启动 / Docker / systemd / Windows 全环境
- **破坏性操作二次确认**:安装/启用/停用/卸载均有确认弹窗
- **写配置安全**:自动备份 → 写后重新校验 → 失败自动回滚;备份轮换(保留最近 8 份)
- **核心组件保护**:DSH 自带底座(base/web-app)永不误删误停
- **不兼容检测**:与 DSH 核心组件冲突的插件标记「不兼容」并拒绝启用,防启动失败
- **不可加载防护**:仅声明 `dsh.bundle` 的插件可安装/启用,client-only 插件拒绝(防启动失败)
- **输入与请求防护**:插件名白名单校验(防命令注入)、同源校验(防 CSRF)、请求体 64KB 上限
- **写并发防护**:install/enable/disable/uninstall 全部串行队列,与 pnpm 子进程写互斥
- **安装失败留痕**:失败原因持久化,界面显示「重试安装」;卸载后清理失败记录
- **前后端分类单一来源**:共享 `categoryOf()`(此前前端复制缺 17 个 topic 导致计数与列表不一致)
- **竞态防护**:分类切换与搜索(本地/AI)请求序号守卫,过期响应丢弃
- **已安装页增强**:行元数据回填 catalog 星数与中文描述
- **分类浏览 / 本地搜索 / AI 搜索 / 安全评估 / mydsh.dev 引流**(既有能力保留)

### 修复

- P0 命令注入:uninstall/enable/disable 输入未校验即拼入 shell → 白名单校验
- P0 CSRF:全部写路由无同源校验 → Origin ≠ Host 拒绝
- H1 写竞态:profile 双写者丢失更新 → 串行队列
- H2 patchEntryIds 正则漏检含点号/引号 id
- H3 卸载不清理安装失败记录(幽灵失败徽章)
- fetchJson 吞掉后端错误详情 → 透出 detail/message
- AI 搜索 6s 超时、GitHub 校验 fetch 10s 超时
- 构造日志打印代理凭据 → 脱敏

### 安全说明

插件市场只展示并安装**可直接加载**(dsh.bundle)的插件;安装即信任社区代码,建议使用内置「安全评估」查询 mydsh.dev 安全报告后再启用。

## [0.0.1] - 2026-08-15

初版:分类浏览 + 本地/AI 搜索 + 一键安装 + 安全评估 + mydsh.dev 引流。
