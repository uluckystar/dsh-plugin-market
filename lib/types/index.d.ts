/**
 * 插件市场 host 入口：
 * - 挂载 PluginMarketGateway（检索/安装/安全评估/已装清单）
 * - 有 web 服务时注册 /api/plugin-market/* 路由；headless/CLI 自动跳过
 */
import type { Context } from '@deepseek-ai/cordis';
import { type PluginMarketConfig } from './gateway.ts';
export { PluginMarketGateway, type PluginMarketConfig } from './gateway.ts';
export type { MarketPlugin, MarketSearchResult, MarketInstallResult, MarketAssessResult, MarketInstalledResult, MarketFailure, } from './types.ts';
/** 插件名（cordis patch 里 id 与之一致）。 */
export declare const name = "plugin-market";
/** 依赖服务。 */
export declare const inject: readonly ["webServer"];
/** 插件入口。 */
export declare function apply(ctx: Context, config?: Partial<PluginMarketConfig>): void;
