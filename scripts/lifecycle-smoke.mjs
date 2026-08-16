#!/usr/bin/env node
/**
 * 生命周期状态流最小验证(临时 profile,不污染真实 web profile)。
 * 覆盖:备份/写后校验/核心白名单/回滚/启用/停用/冲突检测。
 * 用法:node scripts/lifecycle-smoke.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  CORE_BUNDLE_WHITELIST, addBundle, backupProfile, patchConflictIds, patchEntryIds,
  readProfile, removeBundle, validateManifest, writeProfileSafe,
} from '../lib/profile-ops.js'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

const root = mkdtempSync(join(tmpdir(), 'market-smoke-'))
const profile = join(root, 'profile')
mkdirSync(join(profile, 'node_modules/@deepseek-ai/dsh-base'), { recursive: true })
mkdirSync(join(profile, 'node_modules/fake-plugin'), { recursive: true })

// 1. 初始 profile(模拟 web profile 结构)
writeFileSync(join(profile, 'package.json'), JSON.stringify({
  name: 'dsh-profile-smoke', private: true,
  dependencies: {
    '@deepseek-ai/dsh-base': 'link:base', 'fake-plugin': 'link:fake',
  },
  dsh: { profile: { bundles: [...CORE_BUNDLE_WHITELIST] } },
}, null, 2))
// 核心 bundle 的 patch(供冲突检测)
writeFileSync(join(profile, 'node_modules/@deepseek-ai/dsh-base/cordis.patch.yml'),
  '- insert:\n    - id: timer\n    - id: hmr\n    - id: llm\n')
// 假插件:无冲突 patch
writeFileSync(join(profile, 'node_modules/fake-plugin/package.json'), JSON.stringify({ name: 'fake-plugin', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
writeFileSync(join(profile, 'node_modules/fake-plugin/cordis.patch.yml'),
  '- insert:\n    - id: fake-entry\n')

console.log('== 基础读写 ==')
check('readProfile 读取正常', readProfile(profile).bundles.length === 2)
const bak = backupProfile(profile)
check('backupProfile 生成备份', existsSync(bak))
const v = validateManifest(profile)
check('validateManifest 通过(核心白名单在)', v.bundles.includes('@deepseek-ai/dsh-base'))

console.log('== 写后校验 + 回滚 ==')
// 恶意写入:移除 dsh-base → 应被拒并回滚
let rolledBack = false
try {
  writeProfileSafe(profile, { dependencies: { 'fake-plugin': 'link:fake' }, bundles: [] })
} catch { rolledBack = true }
check('恶意写入(移除核心)被拒', rolledBack)
check('回滚后清单仍完整', readProfile(profile).bundles.includes('@deepseek-ai/dsh-base'))
check('回滚后依赖仍在', 'fake-plugin' in readProfile(profile).dependencies)

console.log('== 启用/停用(状态流) ==')
const add = addBundle(profile, 'fake-plugin')
check('addBundle 加入启用列表', add.changed && readProfile(profile).bundles.includes('fake-plugin'))
check('addBundle 幂等(重复调用无变化)', !addBundle(profile, 'fake-plugin').changed)
const rem = removeBundle(profile, 'fake-plugin')
check('removeBundle 移出启用列表', rem.changed && !readProfile(profile).bundles.includes('fake-plugin'))
check('removeBundle 保留依赖关系', 'fake-plugin' in readProfile(profile).dependencies)
let coreRefused = false
try { removeBundle(profile, '@deepseek-ai/dsh-base') } catch { coreRefused = true }
check('核心组件禁止停用', coreRefused)

console.log('== 冲突检测(不兼容判定) ==')
const coreIds = patchEntryIds(readFileSync(join(profile, 'node_modules/@deepseek-ai/dsh-base/cordis.patch.yml'), 'utf8'))
check('patchEntryIds 解析核心 id', coreIds.has('timer') && coreIds.has('llm'))
check('无冲突插件:conflictIds 为空', patchConflictIds(join(profile, 'node_modules/fake-plugin'), coreIds).length === 0)
// 造一个冲突插件
mkdirSync(join(profile, 'node_modules/conflict-plugin'), { recursive: true })
writeFileSync(join(profile, 'node_modules/conflict-plugin/package.json'), JSON.stringify({ name: 'conflict-plugin' }))
writeFileSync(join(profile, 'node_modules/conflict-plugin/cordis.patch.yml'),
  '- insert:\n    - id: timer\n    - id: my-thing\n')
const conflicts = patchConflictIds(join(profile, 'node_modules/conflict-plugin'), coreIds)
check('冲突插件:检出 timer 冲突', conflicts.includes('timer') && conflicts.length === 1)

console.log('== 写后备份保留(可回滚) ==')
const { readdirSync } = await import('node:fs')
const baks = readdirSync(profile).filter(f => f.startsWith('package.json.bak-'))
console.log('  备份文件:', baks)
// 备份策略断言:至少一个可回滚备份,且内容是可解析的完整清单
let bakValid = false
try {
  if (baks.length >= 1) {
    const parsed = JSON.parse(readFileSync(join(profile, baks[0]), 'utf8'))
    bakValid = parsed.dependencies !== undefined && Array.isArray(parsed.dsh?.profile?.bundles)
  }
} catch { /* invalid */ }
check('存在可回滚的完整备份', bakValid)

rmSync(root, { recursive: true, force: true })
console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
