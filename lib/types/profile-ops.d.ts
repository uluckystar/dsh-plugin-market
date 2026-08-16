/**
 * Profile 安全读写(纯函数,可独立测试)。
 * 所有写操作遵守:先备份 → 写入 → 重新读取校验 → 失败自动回滚。
 * 白名单:核心 bundle(@deepseek-ai/dsh-base / @deepseek-ai/dsh-web-app)
 * 与本地 link 依赖永不误删。
 */
/** Profile 清单的最小投影。 */
export interface ProfileManifest {
    readonly dependencies: Record<string, string>;
    readonly bundles: string[];
}
/** 白名单:这些 bundle 永远保留在 active 列表(核心底座,删了 DSH 起不来)。 */
export declare const CORE_BUNDLE_WHITELIST: string[];
/** 判断 package.json 清单是否声明了可作为 profile 启用层加载的 bundle patch。 */
export declare function manifestDeclaresProfileBundle(manifest: unknown): boolean;
/** 判断已安装包是否可安全加入 profile 启用列表。 */
export declare function packageDeclaresProfileBundle(packageDir: string): boolean;
/** 读取 profile package.json(容错:缺失/损坏抛错)。 */
export declare function readProfile(dir: string): ProfileManifest;
/** 备份 profile package.json,返回备份路径。 */
export declare function backupProfile(dir: string): string;
/** 校验写后的清单:JSON 合法、结构完整、核心 bundle 未被移除。 */
export declare function validateManifest(dir: string): ProfileManifest;
/**
 * 安全写入 profile:
 * 1. 备份 → 2. 写入 → 3. 重读校验 → 失败自动回滚(从备份恢复)→ 4. 返回备份路径。
 * @param dir - profile 目录。
 * @param manifest - 完整的新清单(dependencies + bundles)。
 * @returns 备份文件路径(保留供回滚/审计)。
 */
export declare function writeProfileSafe(dir: string, manifest: ProfileManifest): string;
/** 把包加入启用列表(幂等;已在则无变化)。 */
export declare function addBundle(dir: string, packageName: string): {
    backup: string;
    changed: boolean;
};
/** 把包移出启用列表,但保留依赖(禁用 ≠ 卸载)。核心白名单永远不移。 */
export declare function removeBundle(dir: string, packageName: string): {
    backup: string;
    changed: boolean;
};
/**
 * 从 cordis patch 文本提取全部 entry id(顶层行与 insert 列表),
 * 用于冲突检测:插件 patch 与 DSH 自带 entry 撞 id 会导致启动失败。
 * 启发式正则即可(冲突检测是「建议」,不是安全边界)。
 */
export declare function patchEntryIds(patchText: string): Set<string>;
/** 已知的 DSH 自带 entry id(base + web-app bundle patch)。 */
export declare function knownCoreEntryIds(basePatchDir: string, webPatchDir: string): Set<string>;
/**
 * 检测插件包与 DSH 自带组件的 entry id 冲突。
 * @param pluginDir - 已安装插件包目录(其 cordis.patch.yml)。
 * @param coreIds - 已知核心 entry id。
 * @returns 冲突的 id 列表(空 = 无冲突)。
 */
export declare function patchConflictIds(pluginDir: string, coreIds: ReadonlySet<string>): string[];
