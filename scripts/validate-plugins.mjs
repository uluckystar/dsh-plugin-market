#!/usr/bin/env node
/**
 * 插件有效性批量校验（独立脚本，不依赖 dsh-web 进程）
 *
 * 读取 $DSH_HOME/storages/plugin_market_catalog.json 的插件列表，
 * 逐个请求 GitHub raw package.json，检查 dsh.bundle.patch 声明，
 * 结果写入 plugin_market_validated_bundle_v1.json。
 *
 * 插件市场只展示 valid；invalid/skipped/unknown 都不会展示，避免把不能直接启用
 * 的项目伪装成 DSH 插件。旧 plugin_market_validated.json 不再作为有效证明。
 *
 * 用法：
 *   HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 node scripts/validate-plugins.mjs
 *   PLUGIN_MARKET_RECHECK_VALID=1 node scripts/validate-plugins.mjs  # 重查已 valid 项
 * 环境变量：
 *   DSH_HOME                         默认 ~/.dsh
 *   HTTPS_PROXY / HTTP_PROXY         GitHub 访问代理（Node fetch 通过 undici ProxyAgent 显式使用）
 *   PLUGIN_MARKET_VALIDATE_CONCURRENCY 默认 24
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { ProxyAgent } from 'undici'

const base = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const catalogPath = join(base, 'storages', 'plugin_market_catalog.json')
const validatedPath = join(base, 'storages', 'plugin_market_validated_bundle_v1.json')
const invalidRecheckPath = join(base, 'storages', 'plugin_market_invalid_recheck.json')
const catalogSourcePath = process.env.PLUGIN_MARKET_CATALOG_SOURCE ?? ''
const recheckValid = process.env.PLUGIN_MARKET_RECHECK_VALID === '1' || process.argv.includes('--recheck-valid')
/** invalid 重查周期(天):作者修复声明后无需人工干预,到期自动重查转绿。默认 7 天。 */
const INVALID_RECHECK_DAYS = Number(process.env.PLUGIN_MARKET_INVALID_RECHECK_DAYS ?? '7') || 7
const concurrency = Math.max(1, Number(process.env.PLUGIN_MARKET_VALIDATE_CONCURRENCY ?? '24') || 24)
const maxItems = Math.max(0, Number(process.env.PLUGIN_MARKET_VALIDATE_MAX_ITEMS ?? '0') || 0)
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
const dispatcher = proxyUrl !== '' ? new ProxyAgent(proxyUrl) : undefined

const headers = { 'user-agent': 'dsh-plugin-market/0.1 (+https://mydsh.dev)' }

function fetchOptions(signal) {
  const init = { headers, signal }
  if (dispatcher !== undefined) init.dispatcher = dispatcher
  return init
}

function declaresProfileBundle(pkg) {
  const patch = pkg?.dsh?.bundle?.patch
  return typeof patch === 'string' && patch.trim() !== ''
}

/**
 * 将站点插件目录同步为校验器目录缓存，避免插件市场的 TTL 缓存与站点持续增长脱节。
 * 写入采用临时文件 + rename，校验任务永远只会读到完整 JSON。
 */
function refreshCatalogFromSource() {
  if (catalogSourcePath === '') return
  if (!existsSync(catalogSourcePath)) {
    throw new Error(`插件目录源不存在: ${catalogSourcePath}`)
  }
  const source = JSON.parse(readFileSync(catalogSourcePath, 'utf8'))
  const sourcePlugins = Array.isArray(source) ? source : source.plugins
  if (!Array.isArray(sourcePlugins) || sourcePlugins.length === 0) {
    throw new Error(`插件目录源格式错误或为空: ${catalogSourcePath}`)
  }
  const seen = new Set()
  const plugins = []
  for (const item of sourcePlugins) {
    const fullName = typeof item?.full_name === 'string' ? item.full_name.trim() : ''
    if (!/^[^/\s]+\/[^/\s]+$/.test(fullName) || seen.has(fullName)) continue
    seen.add(fullName)
    plugins.push({
      full_name: fullName,
      description: item.description ?? '',
      zh_desc: item.zh_desc,
      en_desc: item.en_desc,
      language: item.language ?? '',
      stargazers_count: item.stargazers_count ?? 0,
      forks_count: item.forks_count ?? 0,
      topics: Array.isArray(item.topics) ? item.topics : [],
      html_url: item.html_url ?? `https://github.com/${fullName}`,
    })
  }
  if (plugins.length === 0) throw new Error('插件目录源没有合法仓库条目')
  mkdirSync(join(catalogPath, '..'), { recursive: true })
  const tempPath = `${catalogPath}.tmp-${process.pid}`
  writeFileSync(tempPath, JSON.stringify({ at: Date.now(), plugins }), 'utf8')
  renameSync(tempPath, catalogPath)
  console.log(`目录同步完成: ${plugins.length} 个插件 <- ${catalogSourcePath}`)
}

/** 校验单个仓库：返回 'valid' | 'invalid' | 'skipped' */
async function checkOne(fullName) {
  const [owner, repo] = String(fullName).split('/')
  if (!owner || !repo) return 'invalid'
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 12000)
      const resp = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`, fetchOptions(controller.signal))
      clearTimeout(timer)
      if (resp.status === 404) return 'invalid'
      if (!resp.ok) continue
      let pkg
      try {
        pkg = JSON.parse((await resp.text()).replace(/^\uFEFF/, ''))
      } catch {
        return 'invalid'
      }
      return declaresProfileBundle(pkg) ? 'valid' : 'invalid'
    } catch {
      // transient network error: retry once
    }
    await new Promise(r => setTimeout(r, 300))
  }
  return 'skipped'
}

async function main() {
  refreshCatalogFromSource()
  if (!existsSync(catalogPath)) {
    console.error('找不到 catalog 缓存，请先让插件市场跑一次 browse')
    process.exit(1)
  }
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  const plugins = catalog.plugins ?? []
  const validated = existsSync(validatedPath)
    ? JSON.parse(readFileSync(validatedPath, 'utf8'))
    : {}

  let todo = [...plugins]
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .filter(p => {
      const current = validated[p.full_name]
      if (recheckValid) return current !== 'invalid'
      return current !== 'valid' && current !== 'invalid'
    })
  const discoveredTodo = todo.length
  if (maxItems > 0 && todo.length > maxItems) todo = todo.slice(0, maxItems)

  // invalid 自动重查:超过周期(默认 7 天)把 invalid 重新纳入队列,作者补声明后自然转绿。
  // sidecar 文件记录上次全量重查时间;只在到期当轮触发,不占用日常增量校验。
  let recheckInvalid = false
  try {
    const last = JSON.parse(readFileSync(invalidRecheckPath, 'utf8'))
    if (typeof last.at === 'number' && Date.now() - last.at > INVALID_RECHECK_DAYS * 86400_000) recheckInvalid = true
  } catch { recheckInvalid = true } // 无记录 → 首轮触发
  if (recheckInvalid) {
    const invalids = Object.entries(validated).filter(([, v]) => v === 'invalid').map(([k]) => k)
    const invSet = new Set(invalids)
    for (const p of todo) invSet.delete(p.full_name) // 已在 todo 的不重复
    for (const name of invSet) todo.push({ full_name: name })
    console.log(`invalid 到期重查: ${invalids.length} 个(每 ${INVALID_RECHECK_DAYS} 天)`)
  }

  mkdirSync(join(validatedPath, '..'), { recursive: true })
  console.log(`共 ${plugins.length} 个候选，已严格校验 ${Object.keys(validated).length}，本轮待校验 ${todo.length}/${discoveredTodo}${recheckValid ? '（重查 valid/skipped）' : ''}${maxItems > 0 ? `（上限 ${maxItems}）` : ''}`)
  console.log(`proxy: ${proxyUrl !== '' ? '已配置' : '未配置'}；concurrency: ${concurrency}`)

  let cursor = 0
  let done = 0
  const worker = async () => {
    while (cursor < todo.length) {
      const p = todo[cursor++]
      if (!p) continue
      validated[p.full_name] = await checkOne(p.full_name)
      done++
      if (done % 50 === 0) {
        writeFileSync(validatedPath, JSON.stringify(validated), 'utf8')
        const v = Object.values(validated).filter(x => x === 'valid').length
        const inv = Object.values(validated).filter(x => x === 'invalid').length
        const sk = Object.values(validated).filter(x => x === 'skipped').length
        console.log(`[${new Date().toISOString()}] 进度 ${done}/${todo.length} (valid=${v}, invalid=${inv}, skipped=${sk})`)
      }
      await new Promise(r => setTimeout(r, 40))
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, todo.length)) }, () => worker()))
  writeFileSync(validatedPath, JSON.stringify(validated), 'utf8')
  // 记录本轮 invalid 重查时间(不管是否触发,都推进周期,避免每天全量重查 invalid)
  writeFileSync(invalidRecheckPath, JSON.stringify({ at: Date.now() }), 'utf8')
  const v = Object.values(validated).filter(x => x === 'valid').length
  const inv = Object.values(validated).filter(x => x === 'invalid').length
  const sk = Object.values(validated).filter(x => x === 'skipped').length
  console.log(`[${new Date().toISOString()}] ✅ 完成：valid=${v}, invalid=${inv}, skipped=${sk}`)
}

main().catch(e => { console.error(e); process.exit(1) })
