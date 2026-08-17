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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { ProxyAgent } from 'undici'

const base = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const catalogPath = join(base, 'storages', 'plugin_market_catalog.json')
const validatedPath = join(base, 'storages', 'plugin_market_validated_bundle_v1.json')
const recheckValid = process.env.PLUGIN_MARKET_RECHECK_VALID === '1' || process.argv.includes('--recheck-valid')
const concurrency = Math.max(1, Number(process.env.PLUGIN_MARKET_VALIDATE_CONCURRENCY ?? '24') || 24)
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
  if (!existsSync(catalogPath)) {
    console.error('找不到 catalog 缓存，请先让插件市场跑一次 browse')
    process.exit(1)
  }
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  const plugins = catalog.plugins ?? []
  const validated = existsSync(validatedPath)
    ? JSON.parse(readFileSync(validatedPath, 'utf8'))
    : {}

  const todo = [...plugins]
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .filter(p => {
      const current = validated[p.full_name]
      if (recheckValid) return current !== 'invalid'
      return current !== 'valid' && current !== 'invalid'
    })

  mkdirSync(join(validatedPath, '..'), { recursive: true })
  console.log(`共 ${plugins.length} 个候选，已严格校验 ${Object.keys(validated).length}，待校验 ${todo.length}${recheckValid ? '（重查 valid/skipped）' : ''}`)
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
  const v = Object.values(validated).filter(x => x === 'valid').length
  const inv = Object.values(validated).filter(x => x === 'invalid').length
  const sk = Object.values(validated).filter(x => x === 'skipped').length
  console.log(`[${new Date().toISOString()}] ✅ 完成：valid=${v}, invalid=${inv}, skipped=${sk}`)
}

main().catch(e => { console.error(e); process.exit(1) })
