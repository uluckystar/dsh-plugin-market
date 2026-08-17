/**
 * 插件市场宿主席位：PluginMarketGateway。
 * - search：从 mydsh.dev 拉插件大全缓存 + 本地检索；AI 推荐走 mydsh.dev AI 搜索
 * - install：一键安装（在当前 profile 目录跑 pnpm add github:owner/repo）
 * - assess：提交安全评估到 mydsh.dev
 * - installed：读当前 profile 的 package.json dependencies 判断已装
 */
import { Context, Service } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { type MarketAssessResult, type MarketBrowseResult, type MarketInstallResult, type MarketInstalledResult, type MarketLifecycleResult, type MarketPlugin, type MarketPluginLifecycle, type MarketRestartResult, type MarketSearchResult, type MarketToggleResult, type MarketUninstallResult } from './types.ts';
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
    /** GitHub token（批量校验插件有效性用，5000 次/小时；空则用未认证 60 次/小时）。 */
    readonly githubToken: string;
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
    /** 生命周期故障记录（安装失败等,full_name → 上次错误)。 */
    private readonly lifecycleDiskPath;
    private lifecycleFailures;
    /** 当前进程已加载的模块名集合(用于「已生效」判断)。 */
    private loadedModuleNames;
    constructor(ctx: Context, config: PluginMarketConfig);
    /** 插件大全：内存缓存 → 磁盘缓存 → 网络拉取（TTL 内零网络请求）。 */
    catalog(): Promise<MarketPlugin[]>;
    /** 校验结果缓存（磁盘）：{full_name: 'valid' | 'invalid' | 'skipped'}。skipped=连续限流后暂不校验（保持可见）。 */
    private validatedCache;
    /** 校验是否已在跑。 */
    private validating;
    /** 校验磁盘路径。 */
    private readonly validatedDiskPath;
    /** 加载已缓存的有效性结果。 */
    private loadValidated;
    /** 保存有效性结果到磁盘。 */
    private saveValidated;
    /** 后台批量校验：拉每个仓库的 package.json，检查 dsh.bundle/client 声明。 */
    private startValidation;
    /** 过滤：invalid 的不显示（每次从磁盘刷新，独立校验脚本更新后无需重启即生效）。 */
    private filterValid;
    /** 分类浏览：按分类列出插件（星数降序；limit=0 返回全部），附各分类计数。 */
    browse(category: string, limit?: number): Promise<MarketBrowseResult>;
    /** 检索：本地匹配 + 可选 AI 推荐（ai=false 秒回；AI 最多等 6 秒，失败不阻塞）。 */
    search(query: string, ai: boolean): Promise<MarketSearchResult>;
    /** 一键安装：先校验仓库是有效 DSH 插件（有 dsh.bundle/client 声明或 cordis.patch.yml），再 pnpm add。 */
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
    /** 加载历史安装失败记录。 */
    private loadLifecycleFailures;
    /** 记录一次安装失败(写入磁盘,重启后仍可见)。 */
    private recordInstallFailure;
    /** 清除安装失败记录(安装成功后)。 */
    private clearInstallFailure;
    /** 包名合法字符(防 shell 注入;enable/disable/uninstall 的输入必经此校验)。 */
    private static readonly PACKAGE_NAME_RE;
    /** 校验输入为合法包名/仓库名,不合法返回 null。 */
    private validPackageName;
    /** profile 写操作串行链:install/enable/disable/uninstall 排队执行,杜绝并发写 package.json。 */
    private profileMutations;
    /** 排队一个会写 profile 的操作(与 pnpm 子进程写互斥)。 */
    private enqueueProfileMutation;
    /** 依赖名 → 已安装插件目录(node_modules 下,可能为 link 包)。 */
    private installedPackageDir;
    /** 是否可作为 profile 启用层安全加载。 */
    private isLoadableBundle;
    /** 当前运行中已经生效的插件模块名。 */
    private activeModuleNames;
    /**
     * 当前已存在的 entry id:优先取运行中 Loader 的真实清单,并补充源码内置
     * base/web-app patch。这样既能捕获 dsh-TUI 这类重复入口,又不依赖
     * profile/node_modules 是否安装了官方 bundle 包。
     */
    private coreEntryIds;
    /** 已安装表 → 生命周期推导输入。 */
    private lifecycleInput;
    /**
     * 推导一个插件当前的生命周期状态(用户语言,见类型注释)。
     * @param fullName - owner/repo 或依赖名。
     * @param input - 已安装依赖表(可复用,避免重复读盘)。
     */
    private lifecycleFor;
    /** 全量生命周期(供列表/已安装页)。 */
    lifecycle(): Promise<MarketLifecycleResult>;
    /** 检测当前进程由谁托管,决定能否安全地「自动重启」:退出后必须有人拉起,否则进程自杀=服务永久下线。 */
    private restartCapability;
    /** 自动重启:响应先返回,再触发当前进程退出,由监督者(PM2/Docker/systemd)自动拉起新进程加载新配置。 */
    restart(): Promise<MarketRestartResult>;
    /** 单个插件状态(已安装页用)。 */
    status(fullName: string): Promise<MarketPluginLifecycle>;
    /** 启用:加入启用列表(保留依赖关系不动)。冲突或核心组件拒绝,写前备份写后校验。 */
    enable(fullName: string): Promise<MarketToggleResult>;
    /** 禁用:移出启用列表,保留依赖关系(可随时重新启用)。 */
    disable(fullName: string): Promise<MarketToggleResult>;
}
/** 路由表：浏览器面板经同源 JSON 接口读写。 */
export declare function makeRoutes(gateway: PluginMarketGateway): import('@deepseek-ai/dsh-host-webserver').WebRoute[];
