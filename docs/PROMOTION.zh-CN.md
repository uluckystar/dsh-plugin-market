# dsh-plugin-market 软推广素材

## 一句话介绍

把 DeepSeek Harness 的插件安装、启用、停用、卸载和安全评估做进设置页：只展示真实可启用插件，状态清楚，不再靠手改 profile 试错。

## 社区短帖

我给 DSH 做了一个插件市场：`dsh-plugin-market`。

它不是简单列 GitHub 仓库，而是会先校验插件是否真的能作为 DSH 插件直接启用。现在可以在 DSH 的 **设置 → 插件 → 插件市场** 里完成：

- 分类浏览 mydsh.dev 插件大全
- 本地搜索和 AI 语义搜索
- 安装、启用、停用、卸载
- 查看「已启用 / 未启用 / 需重启 / 不兼容」等状态
- 启用或停用后可一键重启生效
- 安装前后有配置备份、写入校验和失败回滚

仓库： https://github.com/uluckystar/dsh-plugin-market

安装：

```bash
dsh plugin --profile web add github:uluckystar/dsh-plugin-market
```

## 配图建议

1. 首图：`docs/assets/dsh-plugin-market-install-flow.gif`，展示完整安装状态流。
2. 功能图：`docs/assets/market-browse.png`，展示分类浏览和只展示可安装插件。
3. 搜索图：`docs/assets/market-search-ai.png`，展示本地 / AI 搜索入口。
4. 状态图：`docs/assets/market-installed.png`，展示已启用、未启用、不兼容状态。

## 推荐标题

- DSH 终于有可用的插件市场了：安装、启用、停用、卸载都不用手改 profile
- 给 DeepSeek Harness 做了一个生产可用的插件市场
- dsh-plugin-market：只展示真实可启用插件的 DSH 插件市场
