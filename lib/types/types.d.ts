/**
 * 插件市场共享类型（host 与 client 两个 program 共用）。
 * 本文件必须零 import：它同时被 host（tsconfig.json）与 client
 * （tsconfig.client.json）编译。
 */
/** 插件分类 id（与 mydsh.dev 插件大全的分类一致）。 */
export type MarketCategoryId = 'agent' | 'mcp' | 'devtools' | 'ui' | 'vision' | 'llm' | 'memory' | 'data' | 'integrations' | 'other';
/** 分类定义（id + 匹配 topics）。 */
export interface MarketCategory {
    readonly id: MarketCategoryId;
    readonly topics: readonly string[];
}
/** 内置分类表（镜像 mydsh.dev 的 CATEGORIES）。 */
export declare const MARKET_CATEGORIES: readonly MarketCategory[];
/** mydsh.dev 插件大全中的一条插件（精简投影）。 */
export interface MarketPlugin {
    readonly full_name: string;
    readonly description: string;
    readonly zh_desc?: string;
    readonly en_desc?: string;
    readonly language: string;
    readonly stargazers_count: number;
    readonly forks_count: number;
    readonly topics: readonly string[];
    readonly html_url: string;
    /** 是否已安装到当前 profile。 */
    readonly installed?: boolean;
}
/**
 * 插件分类：按 topics 匹配第一个命中的分类，未命中归 other。
 * host（gateway）与 client（MarketTab）共用，保证分类规则单一来源。
 */
export declare function categoryOf(p: {
    readonly topics?: readonly string[];
}): MarketCategoryId;
/** 分类浏览结果。 */
export interface MarketBrowseResult {
    readonly ok: true;
    /** 分类 id；'all' 表示全部。 */
    readonly category: MarketCategoryId | 'all';
    /** 该分类下插件（按星数降序；limit=0 时返回全部）。 */
    readonly plugins: readonly MarketPlugin[];
    /** 各分类计数（含 all）。 */
    readonly counts: Readonly<Record<string, number>>;
}
/** 检索结果。 */
export interface MarketSearchResult {
    readonly ok: true;
    readonly query: string;
    /** 本地匹配（按相关度排序）。 */
    readonly local: readonly MarketPlugin[];
    /** AI 推荐（mydsh.dev AI 搜索，可能为空）。 */
    readonly ai: readonly MarketPlugin[];
    /** 总命中数。 */
    readonly total: number;
}
/** 一键安装结果。 */
export interface MarketInstallResult {
    readonly ok: boolean;
    readonly fullName: string;
    /** 安装输出摘要（pnpm stdout/stderr 尾部）。 */
    readonly detail: string;
    /** 是否需要重启 profile 生效。 */
    readonly restartRequired: boolean;
    readonly durationMs: number;
}
/** 卸载结果。 */
export interface MarketUninstallResult {
    readonly ok: boolean;
    readonly fullName: string;
    readonly detail: string;
    /** 是否需要重启 profile 生效。 */
    readonly restartRequired: boolean;
    readonly durationMs: number;
    /** 修改前 profile 备份文件路径(可回滚)。 */
    readonly backupPath?: string;
}
/** 安全评估提交结果。 */
export interface MarketAssessResult {
    readonly ok: boolean;
    readonly fullName: string;
    readonly status: 'submitted' | 'reported' | 'pending' | 'error';
    readonly detail: string;
    readonly risk_score?: number;
    readonly needs_review?: boolean;
}
/** 已安装插件清单（依赖名 + 来源仓库名）。 */
export interface MarketInstalledResult {
    readonly ok: true;
    readonly profile: string;
    /** 已装依赖名（如 @deepseek-harness-tui/dsh-tui）。 */
    readonly installed: readonly string[];
    /** 来源仓库名（依赖名 → github:owner/repo 解析，找不到时用依赖名）。 */
    readonly sources: Readonly<Record<string, string>>;
}
/** 统一失败信封。 */
export interface MarketFailure {
    readonly code: string;
    readonly message: string;
}
/**
 * 插件生命周期状态(面向最终用户,内部推导):
 * - not-installed   未安装
 * - installed       已安装未启用
 * - enabled-restart 已启用,重启 DSH 后生效
 * - enabled-active  已启用且已生效(当前运行中)
 * - disabled-restart 已停用,重启 DSH 后完全停用
 * - incompatible    与 DSH 自带组件冲突,不建议启用
 * - install-failed  安装未完成(上次操作失败)
 */
export type MarketPluginStatus = 'not-installed' | 'installed' | 'enabled-restart' | 'enabled-active' | 'disabled-restart' | 'incompatible' | 'install-failed';
/** 单个插件的生命周期详情。 */
export interface MarketPluginLifecycle {
    readonly status: MarketPluginStatus;
    /** 是否需要重启 DSH 才会生效。 */
    readonly restartRequired: boolean;
    /** 冲突/失败原因(用户语言,无内部术语)。 */
    readonly reason?: string;
    /** 依赖名(已安装时)。 */
    readonly installedName?: string;
    /** 上次安装失败的错误摘要。 */
    readonly lastError?: string;
}
/** 生命周期查询结果(status/lifecycle 端点)。 */
export interface MarketLifecycleResult {
    readonly ok: true;
    readonly profile: string;
    /** full_name → 生命周期详情。 */
    readonly items: Readonly<Record<string, MarketPluginLifecycle>>;
}
/** 启用/禁用结果。 */
export interface MarketToggleResult {
    readonly ok: boolean;
    readonly fullName: string;
    readonly status: MarketPluginStatus;
    readonly detail: string;
    /** 是否需要重启 DSH 生效。 */
    readonly restartRequired: boolean;
    /** 修改前 profile 备份文件路径(可回滚)。 */
    readonly backupPath?: string;
}
