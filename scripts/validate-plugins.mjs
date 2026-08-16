#!/usr/bin/env node
/**
 * 插件有效性批量校验（独立脚本，不依赖 dsh-web 进程）
 *
 * 读取 $DSH_HOME/storages/plugin_market_catalog.json 的插件列表，
 * 逐个请求 GitHub 的 package.json，检查 dsh.bundle / dsh.client 声明，
 * 结果写入 plugin_market_validated.json（断点续传：已校验的跳过）。
 *
 * dsh-plugin-market 插件的 browse/search 会读取 validated.json，
 * 把 invalid（非 DSH 插件）从列表隐藏——所以本脚本跑完后刷新即生效。
 *
 * 用法：
 *   PLUGIN_MARKET_GH_TOKEN=ghp_xxx node scripts/validate-plugins.mjs
 * 环境变量：
 *   PLUGIN_MARKET_GH_TOKEN  GitHub token（5000/h，建议配置）
 *   DSH_HOME                默认 ~/.dsh
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const base = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const catalogPath = join(base, 'storages', 'plugin_market_catalog.json')
const validatedPath = join(base, 'storages', 'plugin_market_validated.json')
const token = process.env.PLUGIN_MARKET_GH_TOKEN ?? ''

const headers = { 'user-agent': 'dsh-plugin-market/0.1 (+https://mydsh.dev)' }
if (token !== '') headers.authorization = `Bearer ${token}`

/** 校验单个仓库：返回 'valid' | 'invalid' | 'retry' */
async function checkOne(fullName) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(`https://api.github.com/repos/${fullName}/contents/package.json`, {
      headers, signal: controller.signal,
    })
    clearTimeout(timer)
    if (resp.status === 403) return 'retry' // 限流
    if (resp.status === 404) return 'invalid'
    if (!resp.ok) return 'invalid'
    const body = await resp.json()
    if (!body.content) return 'invalid'
    const pkg = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'))
    const hasDsh = pkg.dsh !== undefined && (pkg.dsh.bundle !== undefined || pkg.dsh.client !== undefined)
    return hasDsh ? 'valid' : 'invalid'
  } catch {
    return 'retry' // 网络错误也重试（而不是标 invalid 误杀）
  }
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

  // 按星数降序（热门优先），跳过已校验的
  const todo = [...plugins]
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .filter(p => validated[p.full_name] === undefined)

  console.log(`共 ${plugins.length} 个插件，已校验 ${Object.keys(validated).length}，待校验 ${todo.length}`)
  console.log(`token: ${token !== '' ? '已配置' : '未配置（未认证限流 60/h，会很慢）'}`)

  // 快速通道：catalog 已带 GitHub topics，打了官方 `dsh-plugin` topic 的仓库
  // 100% 是插件（作者主动声明），直接标记 valid，零 API 调用。
  // 一劳永逸：标记过的进 validated.json，之后永不重查；新插件靠增量重跑补上。
  let quick = 0
  const slow = []
  for (const p of todo) {
    if ((p.topics ?? []).includes('dsh-plugin')) {
      validated[p.full_name] = 'valid'
      quick++
    } else {
      slow.push(p)
    }
  }
  if (quick > 0) {
    writeFileSync(validatedPath, JSON.stringify(validated), 'utf8')
    console.log(`[${new Date().toISOString()}] 快速通道：${quick} 个 dsh-plugin topic 仓库直接标记 valid，剩余 ${slow.length} 个逐仓校验`)
  }
  // 剩余的无 topic 候选（可能是没打 topic 的真插件，也可能是无关仓库）
  const rest = [...slow]

  let done = 0
  let retries = 0
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i]
    const result = await checkOne(p.full_name)
    if (result === 'retry') {
      retries++
      if (retries >= 10) {
        console.log('连续限流过多，等待 60s…')
        await new Promise(r => setTimeout(r, 60000))
        retries = 0
      }
      i-- // 重试当前
      await new Promise(r => setTimeout(r, 1000))
      continue
    }
    validated[p.full_name] = result
    done++
    if (done % 20 === 0) {
      writeFileSync(validatedPath, JSON.stringify(validated), 'utf8')
      const v = Object.values(validated).filter(x => x === 'valid').length
      const inv = Object.values(validated).filter(x => x === 'invalid').length
      console.log(`[${new Date().toISOString()}] 进度 ${Object.keys(validated).length}/${plugins.length} (valid=${v}, invalid=${inv})`)
    }
    await new Promise(r => setTimeout(r, token !== '' ? 250 : 1500))
  }

  writeFileSync(validatedPath, JSON.stringify(validated), 'utf8')
  const v = Object.values(validated).filter(x => x === 'valid').length
  const inv = Object.values(validated).filter(x => x === 'invalid').length
  console.log(`[${new Date().toISOString()}] ✅ 完成：valid=${v}, invalid=${inv}`)
}

main().catch(e => { console.error(e); process.exit(1) })
