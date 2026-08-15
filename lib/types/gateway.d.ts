/**
 * 插件市场宿主席位：PluginMarketGateway。
 * - search：从 mydsh.dev 拉插件大全缓存 + 本地检索；AI 推荐走 mydsh.dev AI 搜索
 * - install：一键安装（在当前 profile 目录跑 pnpm add github:owner/repo）
 * - assess：提交安全评估到 mydsh.dev
 * - installed：读当前 profile 的 package.json dependencies 判断已装
 */
import { Context, Service } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { type MarketAssessResult, type MarketBrowseResult, type MarketInstallResult, type MarketInstalledResult, type MarketPlugin, type MarketSearchResult, type MarketUninstallResult } from './types.ts';
/** 部署可调项（cordis.patch.yml config 可改）。 */
export interface PluginMarketConfig {
    /** mydsh.dev 数据源基址。 */
    readonly marketBaseUrl: string;
    /** 安装用的 profile 名。 */
    readonly profileName: string;
    /** 插件大全缓存时长（毫秒）。 */
    readonly catalogCacheMs: number;
    /** pnpm 安装超时（毫秒）。 */
    readonly installTimeoutMs: number;
    /** 安装命令前缀（pnpm 可执行；默认 npx pnpm@11.7.0 匹配 profile packageManager）。 */
    readonly pnpmCommand: string;
    /** 本机代理（加速 GitHub 下载）；空串不走代理。 */
    readonly proxyUrl: string;
}
/** 插件市场服务：检索 + 安装 + 安全评估 + 已装清单。 */
export declare class PluginMarketGateway extends Service {
    static inject: string[];
    /** Loader 校验的部署配置。 */
    static Config: s<PluginMarketConfig>;
    private readonly config;
    /** 插件大全内存缓存（6 小时失效，增量更新：网站每小时刷新，这里每 6 小时同步一次）。 */
    private catalogCache;
    /** 磁盘缓存路径（重启不丢，避免每次启动重新拉 2MB）。 */
    private readonly catalogDiskPath;
    constructor(ctx: Context, config: PluginMarketConfig);
    /** 插件大全：内存缓存 → 磁盘缓存 → 网络拉取（TTL 内零网络请求）。 */
    catalog(): Promise<MarketPlugin[]>;
    /** 插件分类：按 topics 匹配第一个命中的分类，未命中归 other。 */
    private categoryOf;
    /** 分类浏览：按分类列出插件（星数降序；limit=0 返回全部），附各分类计数。 */
    browse(category: string, limit?: number): Promise<MarketBrowseResult>;
    /** 检索：本地匹配 + 可选 AI 推荐（ai=false 秒回；AI 最多等 6 秒，失败不阻塞）。 */
    search(query: string, ai: boolean): Promise<MarketSearchResult>;
    /** 一键安装：在 profile 目录跑 pnpm add。 */
    install(fullName: string): Promise<MarketInstallResult>;
    /** 卸载：pnpm remove（支持依赖名或 owner/repo 仓库名）。 */
    uninstall(fullName: string): Promise<MarketUninstallResult>;
    /** 在 profile 目录跑 pnpm（走代理 + 匹配版本），返回输出摘要。 */
    private runPnpm;
    /** 提交安全评估到 mydsh.dev。 */
    assess(fullName: string): Promise<MarketAssessResult>;
    /** 已安装依赖及其来源仓库名（依赖名 → github:owner/repo 解析）。 */
    private installedWithSources;
    /** 已安装插件名集合（owner/repo 或依赖名）。 */
    installedNames(): Promise<Set<string>>;
    /** 已安装清单（供 UI 展示：依赖名 + 来源仓库名）。 */
    installed(): Promise<MarketInstalledResult>;
    /** 当前 profile 目录。 */
    private profileDir;
}
/** 路由表：浏览器面板经同源 JSON 接口读写。 */
export declare function makeRoutes(gateway: PluginMarketGateway): import('@deepseek-ai/dsh-host-webserver').WebRoute[];
