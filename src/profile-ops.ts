/**
 * Profile 安全读写(纯函数,可独立测试)。
 * 所有写操作遵守:先备份 → 写入 → 重新读取校验 → 失败自动回滚。
 * 白名单:核心 bundle(@deepseek-ai/dsh-base / @deepseek-ai/dsh-web-app)
 * 与本地 link 依赖永不误删。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Profile 清单的最小投影。 */
export interface ProfileManifest {
  readonly dependencies: Record<string, string>
  readonly bundles: string[]
}

/** 白名单:这些 bundle 永远保留在 active 列表(核心底座,删了 DSH 起不来)。 */
export const CORE_BUNDLE_WHITELIST = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']

/** 读取 profile package.json(容错:缺失/损坏抛错)。 */
export function readProfile(dir: string): ProfileManifest {
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) throw new Error('profile 清单不存在')
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch (e) {
    throw new Error(`profile 清单无法解析: ${e instanceof Error ? e.message : String(e)}`)
  }
  const manifest = raw as {
    dependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: string[] } }
  }
  if (typeof manifest !== 'object' || manifest === null) throw new Error('profile 清单格式错误')
  return {
    dependencies: manifest.dependencies ?? {},
    bundles: manifest.dsh?.profile?.bundles ?? [],
  }
}

/** 备份 profile package.json,返回备份路径。 */
export function backupProfile(dir: string): string {
  mkdirSync(dir, { recursive: true })
  const src = join(dir, 'package.json')
  const backup = join(dir, `package.json.bak-${Date.now()}`)
  if (existsSync(src)) {
    // 复制而非改名:写失败时原文件不动
    writeFileSync(backup, readFileSync(src, 'utf8'), 'utf8')
  } else {
    writeFileSync(backup, '{}', 'utf8')
  }
  return backup
}

/** 校验写后的清单:JSON 合法、结构完整、核心 bundle 未被移除。 */
export function validateManifest(dir: string): ProfileManifest {
  const pkgPath = join(dir, 'package.json')
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch (e) {
    throw new Error(`写后校验失败: 清单无法解析(${e instanceof Error ? e.message : String(e)})`)
  }
  const manifest = raw as {
    dependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: string[] } }
  }
  if (typeof manifest !== 'object' || manifest === null) throw new Error('写后校验失败: 清单格式错误')
  const dependencies = manifest.dependencies ?? {}
  if (typeof dependencies !== 'object' || dependencies === null) throw new Error('写后校验失败: 依赖列表缺失')
  const bundles = manifest.dsh?.profile?.bundles ?? []
  if (!Array.isArray(bundles)) throw new Error('写后校验失败: 启用列表缺失')
  for (const core of CORE_BUNDLE_WHITELIST) {
    if (!bundles.includes(core)) {
      throw new Error(`写后校验失败: 核心组件 ${core} 被移除,已回滚`)
    }
  }
  return { dependencies, bundles }
}

/**
 * 安全写入 profile:
 * 1. 备份 → 2. 写入 → 3. 重读校验 → 失败自动回滚(从备份恢复)→ 4. 返回备份路径。
 * @param dir - profile 目录。
 * @param manifest - 完整的新清单(dependencies + bundles)。
 * @returns 备份文件路径(保留供回滚/审计)。
 */
export function writeProfileSafe(dir: string, manifest: ProfileManifest): string {
  const pkgPath = join(dir, 'package.json')
  const backup = backupProfile(dir)
  try {
    const next = {
      ...JSON.parse(readFileSync(pkgPath, 'utf8') || '{}') as Record<string, unknown>,
      dependencies: manifest.dependencies,
      dsh: { profile: { bundles: manifest.bundles } },
    }
    writeFileSync(pkgPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    // 写后重新读取校验(含核心白名单)
    validateManifest(dir)
    return backup
  } catch (e) {
    // 回滚:从备份恢复
    try { renameSync(backup, pkgPath) } catch { /* 回滚失败也保留备份文件供手动恢复 */ }
    throw e
  }
}

/** 把包加入启用列表(幂等;已在则无变化)。 */
export function addBundle(dir: string, packageName: string): { backup: string; changed: boolean } {
  const current = readProfile(dir)
  if (current.bundles.includes(packageName)) return { backup: '', changed: false }
  const backup = writeProfileSafe(dir, {
    dependencies: current.dependencies,
    bundles: [...current.bundles, packageName],
  })
  return { backup, changed: true }
}

/** 把包移出启用列表,但保留依赖(禁用 ≠ 卸载)。核心白名单永远不移。 */
export function removeBundle(dir: string, packageName: string): { backup: string; changed: boolean } {
  if (CORE_BUNDLE_WHITELIST.includes(packageName)) {
    throw new Error(`核心组件 ${packageName} 不可禁用`)
  }
  const current = readProfile(dir)
  if (!current.bundles.includes(packageName)) return { backup: '', changed: false }
  const backup = writeProfileSafe(dir, {
    dependencies: current.dependencies,
    bundles: current.bundles.filter(b => b !== packageName),
  })
  return { backup, changed: true }
}

/**
 * 从 cordis patch 文本提取全部 entry id(顶层行与 insert 列表),
 * 用于冲突检测:插件 patch 与 DSH 自带 entry 撞 id 会导致启动失败。
 * 启发式正则即可(冲突检测是「建议」,不是安全边界)。
 */
export function patchEntryIds(patchText: string): Set<string> {
  const ids = new Set<string>()
  const re = /^\s*- id:\s*([\w@/-]+)\s*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(patchText)) !== null) {
    if (m[1] !== undefined) ids.add(m[1])
  }
  return ids
}

/** 已知的 DSH 自带 entry id(base + web-app bundle patch)。 */
export function knownCoreEntryIds(basePatchDir: string, webPatchDir: string): Set<string> {
  const ids = new Set<string>()
  for (const dir of [basePatchDir, webPatchDir]) {
    const patch = join(dir, 'cordis.patch.yml')
    if (existsSync(patch)) {
      try {
        for (const id of patchEntryIds(readFileSync(patch, 'utf8'))) ids.add(id)
      } catch { /* 读不到忽略 */ }
    }
  }
  return ids
}

/**
 * 检测插件包与 DSH 自带组件的 entry id 冲突。
 * @param pluginDir - 已安装插件包目录(其 cordis.patch.yml)。
 * @param coreIds - 已知核心 entry id。
 * @returns 冲突的 id 列表(空 = 无冲突)。
 */
export function patchConflictIds(pluginDir: string, coreIds: ReadonlySet<string>): string[] {
  const patch = join(pluginDir, 'cordis.patch.yml')
  if (!existsSync(patch)) return []
  try {
    const ids = patchEntryIds(readFileSync(patch, 'utf8'))
    return [...ids].filter(id => coreIds.has(id))
  } catch {
    return []
  }
}
