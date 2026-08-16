/**
 * 插件市场宿主席位：PluginMarketGateway。
 * - search：从 mydsh.dev 拉插件大全缓存 + 本地检索；AI 推荐走 mydsh.dev AI 搜索
 * - install：一键安装（在当前 profile 目录跑 pnpm add github:owner/repo）
 * - assess：提交安全评估到 mydsh.dev
 * - installed：读当前 profile 的 package.json dependencies 判断已装
 */

import { exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { Context, Service } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import {
  MARKET_CATEGORIES,
  type MarketAssessResult, type MarketBrowseResult, type MarketInstallResult,
  type MarketInstalledResult, type MarketPlugin, type MarketSearchResult, type MarketUninstallResult,
} from './types.ts'

const execAsync = promisify(execCallback)

/** 部署可调项（cordis.patch.yml config 可改）。 */
export interface PluginMarketConfig {
  /** mydsh.dev 数据源基址。 */
  readonly marketBaseUrl: string
  /** 安装用的 profile 名。 */
  readonly profileName: string
  /** 插件大全缓存时长（毫秒）。 */
  readonly catalogCacheMs: number
  /** pnpm 安装超时（毫秒）。 */
  readonly installTimeoutMs: number
  /** 安装命令前缀（pnpm 可执行；默认 npx pnpm@11.7.0 匹配 profile packageManager）。 */
  readonly pnpmCommand: string
  /** 本机代理（加速 GitHub 下载）；空串不走代理。 */
  readonly proxyUrl: string
  /** GitHub token（批量校验插件有效性用，5000 次/小时；空则用未认证 60 次/小时）。 */
  readonly githubToken: string
}

/** 检索关键词切分。 */
function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? [])
}

/** 本地相关度打分（名称/双语描述/topics/星数）。 */
function scorePlugin(p: MarketPlugin, tokens: string[]): number {
  let score = 0
  const name = (p.full_name ?? '').toLowerCase()
  const zh = p.zh_desc ?? ''
  const en = p.en_desc ?? ''
  const desc = (p.description ?? '').toLowerCase()
  const tags = (p.topics ?? []).join(' ').toLowerCase()
  for (const t of tokens) {
    if (name.includes(t)) score += 5
    if (zh.includes(t)) score += 4
    if (en.includes(t)) score += 4
    if (desc.includes(t)) score += 3
    if (tags.includes(t)) score += 3
  }
  score += Math.log1p(p.stargazers_count ?? 0) * 0.5
  return score
}

/** 插件市场服务：检索 + 安装 + 安全评估 + 已装清单。 */
export class PluginMarketGateway extends Service {
  static inject = ['webServer']

  /** Loader 校验的部署配置。 */
  static Config: s<PluginMarketConfig> = s.object({
    marketBaseUrl: s.string().default('https://mydsh.dev'),
    profileName: s.string().default('web'),
    catalogCacheMs: s.number().step(1).min(1000).default(6 * 60 * 60 * 1000),
    installTimeoutMs: s.number().step(1).min(5000).default(300 * 1000),
    pnpmCommand: s.string().default('npx -y pnpm@11.7.0'),
    proxyUrl: s.string().default('http://127.0.0.1:7897'),
    githubToken: s.string().default(''),
  })

  private readonly config: PluginMarketConfig
  /** 插件大全内存缓存（6 小时失效，增量更新：网站每小时刷新，这里每 6 小时同步一次）。 */
  private catalogCache: { at: number; plugins: MarketPlugin[] } | null = null
  /** 磁盘缓存路径（重启不丢，避免每次启动重新拉 2MB）。 */
  private readonly catalogDiskPath: string

  constructor(ctx: Context, config: PluginMarketConfig) {
    super(ctx, 'pluginMarket')
    console.log(`[plugin-market] 构造 config: catalogCacheMs=${config?.catalogCacheMs}, marketBaseUrl=${config?.marketBaseUrl}, profileName=${config?.profileName}, pnpmCommand=${config?.pnpmCommand}, proxyUrl=${config?.proxyUrl}`)
    // config 兜底默认值：cordis patch 未合并时也能正常工作
    this.config = {
      marketBaseUrl: config?.marketBaseUrl ?? 'https://mydsh.dev',
      profileName: config?.profileName ?? 'web',
      catalogCacheMs: config?.catalogCacheMs ?? 6 * 60 * 60 * 1000,
      installTimeoutMs: config?.installTimeoutMs ?? 300 * 1000,
      pnpmCommand: config?.pnpmCommand ?? 'npx -y pnpm@11.7.0',
      proxyUrl: config?.proxyUrl ?? 'http://127.0.0.1:7897',
      githubToken: config?.githubToken || process.env.PLUGIN_MARKET_GH_TOKEN || '',
    }
    const base = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    this.catalogDiskPath = join(base, 'storages', 'plugin_market_catalog.json')
    this.validatedDiskPath = join(base, 'storages', 'plugin_market_validated.json')
    this.loadValidated()
    this.ctx.effect(() => {
      const disposers = makeRoutes(this).map(route => this.ctx.webServer.register(route))
      return () => { for (const d of disposers) d() }
    }, 'plugin-market: routes')
  }

  /** 插件大全：内存缓存 → 磁盘缓存 → 网络拉取（TTL 内零网络请求）。 */
  async catalog(): Promise<MarketPlugin[]> {
    const now = Date.now()
    if (this.catalogCache && now - this.catalogCache.at < this.config.catalogCacheMs) {
      console.log(`[plugin-market] catalog 内存缓存命中 (${this.catalogCache.plugins.length} 个, ${Math.round((now - this.catalogCache.at) / 1000)}s 前)`)
      return this.catalogCache.plugins
    }
    // 磁盘缓存（重启后免重新拉取）
    try {
      if (existsSync(this.catalogDiskPath)) {
        const disk = JSON.parse(readFileSync(this.catalogDiskPath, 'utf8')) as { at: number; plugins: MarketPlugin[] }
        if (now - disk.at < this.config.catalogCacheMs && Array.isArray(disk.plugins) && disk.plugins.length > 0) {
          this.catalogCache = { at: disk.at, plugins: disk.plugins }
          console.log(`[plugin-market] catalog 磁盘缓存命中 (${disk.plugins.length} 个, ${Math.round((now - disk.at) / 1000)}s 前)`)
          return disk.plugins
        }
      }
    } catch (e) { console.log(`[plugin-market] 磁盘缓存读取失败: ${String(e)}`) }

    console.log('[plugin-market] catalog 网络拉取…')
    const resp = await fetch(`${this.config.marketBaseUrl}/assets/plugins.json`, {
      headers: { 'user-agent': 'dsh-plugin-market/0.1 (+https://mydsh.dev)' },
    })
    if (!resp.ok) throw new Error(`插件大全拉取失败：${resp.status}`)
    const data = await resp.json() as { plugins?: MarketPlugin[] }
    const plugins = (data.plugins ?? []).map(p => ({
      full_name: p.full_name,
      description: p.description ?? '',
      zh_desc: p.zh_desc,
      en_desc: p.en_desc,
      language: p.language ?? '',
      stargazers_count: p.stargazers_count ?? 0,
      forks_count: p.forks_count ?? 0,
      topics: p.topics ?? [],
      html_url: p.html_url ?? `https://github.com/${p.full_name}`,
    }))
    this.catalogCache = { at: now, plugins }
    // 写磁盘缓存（失败静默，不影响使用）
    try {
      mkdirSync(join(this.catalogDiskPath, '..'), { recursive: true })
      writeFileSync(this.catalogDiskPath, JSON.stringify({ at: now, plugins }), 'utf8')
    } catch { /* ignore */ }
    // 后台启动插件有效性校验（非 DSH 插件从列表过滤）
    void this.startValidation(plugins)
    return plugins
  }

  // ===== 插件有效性校验（防非 DSH 插件混入列表）=====

  /** 校验结果缓存（磁盘）：{full_name: 'valid' | 'invalid'}。 */
  private validatedCache: Record<string, 'valid' | 'invalid'> = {}
  /** 校验是否已在跑。 */
  private validating = false
  /** 校验磁盘路径。 */
  private readonly validatedDiskPath: string

  /** 加载已缓存的有效性结果。 */
  private loadValidated(): void {
    try {
      if (existsSync(this.validatedDiskPath)) {
        const disk = JSON.parse(readFileSync(this.validatedDiskPath, 'utf8')) as Record<string, 'valid' | 'invalid'>
        this.validatedCache = disk
      }
    } catch { /* ignore */ }
  }

  /** 保存有效性结果到磁盘。 */
  private saveValidated(): void {
    try {
      mkdirSync(join(this.validatedDiskPath, '..'), { recursive: true })
      writeFileSync(this.validatedDiskPath, JSON.stringify(this.validatedCache), 'utf8')
    } catch { /* ignore */ }
  }

  /** 后台批量校验：拉每个仓库的 package.json，检查 dsh.bundle/client 声明。 */
  private async startValidation(plugins: readonly MarketPlugin[]): Promise<void> {
    if (this.validating) return
    this.validating = true
    try {
      // 按星数降序（热门优先），跳过已校验的
      const todo = [...plugins]
        .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
        .filter(p => this.validatedCache[p.full_name] === undefined)
      console.log(`[plugin-market] 开始校验 ${todo.length} 个插件有效性… githubToken=${this.config.githubToken !== '' ? '已配置(' + this.config.githubToken.slice(0, 4) + '…)' : '空'}`)
      const hasToken = (this.config.githubToken ?? '') !== ''
      const headers: Record<string, string> = { 'user-agent': 'dsh-plugin-market/0.1 (+https://mydsh.dev)' }
      if (hasToken) headers.authorization = `Bearer ${this.config.githubToken}`

      // 串行校验（contents API 有独立次级限流，串行 + 延时最稳）；限流时等待后重试
      for (let i = 0; i < todo.length; i++) {
        const p = todo[i]
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 10000)
          const resp = await fetch(`https://api.github.com/repos/${p.full_name}/contents/package.json`, { headers, signal: controller.signal })
          clearTimeout(timer)
          if (resp.status === 403) {
            console.log(`[plugin-market] 校验限流，等待 30s 后重试（${p.full_name}）`)
            await new Promise(r => setTimeout(r, 30000))
            i-- // 重试当前
            continue
          }
          if (resp.status === 404) {
            this.validatedCache[p.full_name] = 'invalid' // 无 package.json
          } else if (!resp.ok) {
            this.validatedCache[p.full_name] = 'invalid'
          } else {
            const body = await resp.json() as { content?: string }
            if (body.content) {
              const parsed = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) as {
                dsh?: { bundle?: unknown; client?: unknown }
              }
              const hasDsh = parsed.dsh !== undefined && (parsed.dsh.bundle !== undefined || parsed.dsh.client !== undefined)
              this.validatedCache[p.full_name] = hasDsh ? 'valid' : 'invalid'
            } else {
              this.validatedCache[p.full_name] = 'invalid'
            }
          }
        } catch { this.validatedCache[p.full_name] = 'invalid' }
        // 每 2 个存一次盘（进度可恢复）
        if (i % 2 === 0) this.saveValidated()
        // 延时（contents API 限流友好）
        await new Promise(r => setTimeout(r, hasToken ? 400 : 1500))
      }
      this.saveValidated()
      const valid = Object.values(this.validatedCache).filter(v => v === 'valid').length
      const invalid = Object.values(this.validatedCache).filter(v => v === 'invalid').length
      console.log(`[plugin-market] 校验完成：valid=${valid}, invalid=${invalid}（${invalid} 个非 DSH 插件已从列表隐藏）`)
    } finally {
      this.validating = false
    }
  }

  /** 过滤：invalid 的不显示（未校验的暂显示，校验后自动隐藏）。 */
  private filterValid(plugins: readonly MarketPlugin[]): MarketPlugin[] {
    return plugins.filter(p => this.validatedCache[p.full_name] !== 'invalid')
  }

  /** 插件分类：按 topics 匹配第一个命中的分类，未命中归 other。 */
  private categoryOf(p: MarketPlugin): string {
    const topics = new Set((p.topics ?? []).map(t => t.toLowerCase()))
    for (const cat of MARKET_CATEGORIES) {
      if (cat.id === 'other') continue
      if (cat.topics.some(t => topics.has(t))) return cat.id
    }
    return 'other'
  }

  /** 分类浏览：按分类列出插件（星数降序；limit=0 返回全部），附各分类计数。 */
  async browse(category: string, limit = 50): Promise<MarketBrowseResult> {
    const cat = (category ?? '').trim() as MarketBrowseResult['category']
    const valid = MARKET_CATEGORIES.some(c => c.id === cat) || cat === 'all'
    const target: MarketBrowseResult['category'] = valid ? cat : 'all'
    const installed = await this.installedNames()
    const catalog = await this.catalog()
    void this.startValidation(catalog)
    const all = this.filterValid(catalog)

    const counts: Record<string, number> = { all: all.length }
    for (const c of MARKET_CATEGORIES) counts[c.id] = 0
    for (const p of all) {
      const c = this.categoryOf(p)
      counts[c] = (counts[c] ?? 0) + 1
    }

    const list = target === 'all'
      ? all
      : all.filter(p => this.categoryOf(p) === target)
    const sorted = [...list].sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    const plugins = (limit > 0 ? sorted.slice(0, limit) : sorted)
      .map(p => ({ ...p, installed: installed.has(p.full_name) }))

    return { ok: true, category: target, plugins, counts }
  }

  /** 检索：本地匹配 + 可选 AI 推荐（ai=false 秒回；AI 最多等 6 秒，失败不阻塞）。 */
  async search(query: string, ai: boolean): Promise<MarketSearchResult> {
    const q = (query ?? '').trim()
    if (q.length === 0) return { ok: true, query: q, local: [], ai: [], total: 0 }
    const installed = await this.installedNames()
    const catalog = await this.catalog()
    void this.startValidation(catalog)
    const all = this.filterValid(catalog)
    const tokens = tokenize(q)
    const scored = all
      .map(p => ({ p, s: scorePlugin(p, tokens) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map(x => ({ ...x.p, installed: installed.has(x.p.full_name) }))

    // AI 推荐（仅 ai=true 时调用；6 秒超时——AI 慢不阻塞本地结果）
    let aiPicks: MarketPlugin[] = []
    if (ai) {
      try {
      const candidates = all.slice(0, 200).map(p => ({
        full_name: p.full_name, zh_desc: p.zh_desc ?? '', description: p.description ?? '',
        language: p.language, stars: p.stargazers_count, html_url: p.html_url,
      }))
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 6000)
      const resp = await fetch(`${this.config.marketBaseUrl}/api/ai-search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'dsh-plugin-market/0.1' },
        body: JSON.stringify({ query: q, candidates, exclude: [] }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (resp.ok) {
        const text = await resp.text()
        // 流式输出：累积全部 delta.content 成一个 JSON 行，再统一提取 full_name
        let acc = ''
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]' || payload === '') continue
          try {
            const obj = JSON.parse(payload)
            const delta = obj.choices?.[0]?.delta?.content
            if (typeof delta === 'string') acc += delta
          } catch { /* 忽略非内容 chunk */ }
        }
        const names = new Set<string>()
        for (const m of acc.matchAll(/"full_name"\s*:\s*"([^"]+)"/g)) {
          if (m[1] !== undefined) names.add(m[1])
        }
        if (names.size > 0) {
          aiPicks = [...names]
            .map(n => all.find(p => p.full_name === n))
            .filter((p): p is MarketPlugin => p !== undefined)
            .map(p => ({ ...p, installed: installed.has(p.full_name) }))
        }
      }
      } catch { /* AI 失败不阻塞 */ }
    }

    return { ok: true, query: q, local: scored, ai: aiPicks, total: scored.length }
  }

  /** 一键安装：先校验仓库是有效 DSH 插件（有 dsh.bundle/client 声明或 cordis.patch.yml），再 pnpm add。 */
  async install(fullName: string): Promise<MarketInstallResult> {
    const started = Date.now()
    const name = (fullName ?? '').trim()
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) {
      return { ok: false, fullName: name, detail: '仓库名格式应为 owner/repo', restartRequired: false, durationMs: 0 }
    }
    const dir = this.profileDir()
    if (!dir) {
      return { ok: false, fullName: name, detail: '找不到 profile 目录', restartRequired: false, durationMs: 0 }
    }

    // ---- 有效性校验：必须是真正的 DSH 插件（防装上一堆「带 topic 但不是插件」的仓库）----
    try {
      const pkgResp = await fetch(`https://api.github.com/repos/${name}/contents/package.json`, {
        headers: this.config.githubToken !== '' ? { 'user-agent': 'dsh-plugin-market/0.1 (+https://mydsh.dev)', authorization: `Bearer ${this.config.githubToken}` } : { 'user-agent': 'dsh-plugin-market/0.1 (+https://mydsh.dev)' },
      })
      if (pkgResp.status === 404) {
        return { ok: false, fullName: name, detail: '该仓库没有 package.json，不是可安装的 DSH 插件包', restartRequired: false, durationMs: 0 }
      }
      if (pkgResp.ok) {
        const pkg = await pkgResp.json() as { content?: string }
        if (pkg.content) {
          const parsed = JSON.parse(Buffer.from(pkg.content, 'base64').toString('utf8')) as {
            dsh?: { bundle?: unknown; client?: unknown }
          }
          const hasDsh = parsed.dsh !== undefined && (parsed.dsh.bundle !== undefined || parsed.dsh.client !== undefined)
          if (!hasDsh) {
            return {
              ok: false, fullName: name,
              detail: '⚠️ 该仓库不是标准 DSH 插件（package.json 缺少 dsh.bundle / dsh.client 声明）。安装后 DSH 不会加载它。已取消安装。',
              restartRequired: false, durationMs: 0,
            }
          }
        }
      }
    } catch (e) {
      // 校验失败（网络/限流）不阻塞安装，但记录
      console.log(`[plugin-market] 安装前校验跳过: ${String(e)}`)
    }

    try {
      const spec = `github:${name}`
      const detail = await this.runPnpm(dir, ['add', spec])
      return {
        ok: true, fullName: name,
        detail: (detail || '安装完成') + '\n\n⚠️ 需重启 DSH（不是刷新页面）：cordis 插件组合在启动时构建，重启 dsh-web 进程后才生效。',
        restartRequired: true, durationMs: Date.now() - started,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { ok: false, fullName: name, detail: msg.slice(-1500), restartRequired: false, durationMs: Date.now() - started }
    }
  }

  /** 卸载：pnpm remove（支持依赖名或 owner/repo 仓库名）。 */
  async uninstall(fullName: string): Promise<MarketUninstallResult> {
    const started = Date.now()
    const name = (fullName ?? '').trim()
    if (name.length === 0) {
      return { ok: false, fullName: name, detail: '缺少插件名', restartRequired: false, durationMs: 0 }
    }
    const dir = this.profileDir()
    if (!dir) {
      return { ok: false, fullName: name, detail: '找不到 profile 目录', restartRequired: false, durationMs: 0 }
    }
    try {
      // 支持传依赖名（@scope/name）或仓库名（owner/repo）——仓库名先解析成依赖名
      const installed = await this.installedWithSources()
      let depName = name
      if (name.includes('/') && !name.startsWith('@')) {
        const found = Object.entries(installed.sources).find(([, src]) => src === name)
        if (found) depName = found[0]
      }
      const detail = await this.runPnpm(dir, ['remove', depName])
      return { ok: true, fullName: name, detail: detail || '卸载完成', restartRequired: true, durationMs: Date.now() - started }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { ok: false, fullName: name, detail: msg.slice(-1500), restartRequired: false, durationMs: Date.now() - started }
    }
  }

  /** 在 profile 目录跑 pnpm（走代理 + 匹配版本），返回输出摘要。 */
  private async runPnpm(dir: string, args: readonly string[]): Promise<string> {
    const quoted = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')
    const cmd = `${this.config.pnpmCommand} ${quoted}`
    const env: NodeJS.ProcessEnv = { ...process.env }
    if (this.config.proxyUrl !== '') {
      env.HTTPS_PROXY = this.config.proxyUrl
      env.HTTP_PROXY = this.config.proxyUrl
    }
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: dir, timeout: this.config.installTimeoutMs, maxBuffer: 4 * 1024 * 1024, shell: '/bin/sh', env,
    })
    return [stdout, stderr].map(t => t.trim()).filter(t => t !== '').join('\n').slice(-1500)
  }

  /** 提交安全评估到 mydsh.dev。 */
  async assess(fullName: string): Promise<MarketAssessResult> {
    const name = (fullName ?? '').trim()
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) {
      return { ok: false, fullName: name, status: 'error', detail: '仓库名格式应为 owner/repo' }
    }
    try {
      const resp = await fetch(`${this.config.marketBaseUrl}/api/security/list`, {
        headers: { 'user-agent': 'dsh-plugin-market/0.1' },
      })
      const data = await resp.json() as { reports?: Array<{ full_name: string; risk_score: number; reviewed_at?: string }> }
      const existing = (data.reports ?? []).find(r => r.full_name === name)
      if (existing) {
        return {
          ok: true, fullName: name, status: 'reported', detail: '已有正式安全报告',
          risk_score: existing.risk_score,
        }
      }
      // 无报告：引导用户到网页提交（Turnstile 人机验证无法在服务端模拟）
      return {
        ok: true, fullName: name, status: 'pending',
        detail: `该仓库暂无安全报告。请到 ${this.config.marketBaseUrl}/plugins 的「安全报告」tab 提交（需人机验证），提交后会自动评估并邮件通知维护者。`,
      }
    } catch (error) {
      return { ok: false, fullName: name, status: 'error', detail: `安全评估服务暂不可用：${error instanceof Error ? error.message : String(error)}` }
    }
  }

  /** 已安装依赖及其来源仓库名（依赖名 → github:owner/repo 解析）。 */
  private async installedWithSources(): Promise<{ names: Set<string>; sources: Record<string, string> }> {
    const names = new Set<string>()
    const sources: Record<string, string> = {}
    const dir = this.profileDir()
    if (!dir) return { names, sources }
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }
      const deps = pkg.dependencies ?? {}
      for (const [dep, spec] of Object.entries(deps)) {
        // git/github 规格：github:owner/repo 或 git+https://github.com/owner/repo.git
        const m = /(?:github:([^#]+)|github\.com\/([^#/]+\/[^#/.]+))/.exec(spec)
        const ownerRepo = m ? (m[1] ?? m[2])?.replace(/\.git$/, '') : null
        if (ownerRepo) {
          names.add(ownerRepo)
          sources[dep] = ownerRepo
        } else if (dep.startsWith('@deepseek-ai/dsh-') || dep.startsWith('dsh-')) {
          names.add(dep)
          sources[dep] = dep
        }
      }
    } catch { /* package.json 缺失时返回空 */ }
    return { names, sources }
  }

  /** 已安装插件名集合（owner/repo 或依赖名）。 */
  async installedNames(): Promise<Set<string>> {
    return (await this.installedWithSources()).names
  }

  /** 已安装清单（供 UI 展示：依赖名 + 来源仓库名）。 */
  async installed(): Promise<MarketInstalledResult> {
    const { names, sources } = await this.installedWithSources()
    return { ok: true, profile: this.config.profileName, installed: [...names], sources }
  }

  /** 当前 profile 目录。 */
  private profileDir(): string | null {
    const base = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    const dir = join(base, 'profiles', this.config.profileName)
    return existsSync(dir) ? dir : null
  }
}

/** 路由表：浏览器面板经同源 JSON 接口读写。 */
export function makeRoutes(gateway: PluginMarketGateway): import('@deepseek-ai/dsh-host-webserver').WebRoute[] {
  const json = (res: { writeHead(s: number, h: Record<string, string>): void; end(b: string): void }, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }
  const readJson = async (req: { on(event: 'data', cb: (c: Buffer) => void): unknown; on(event: 'end', cb: () => void): unknown }): Promise<unknown> => {
    const chunks: Buffer[] = []
    await new Promise<void>((resolve) => {
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => resolve())
    })
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
  }
  const respond = (res: { writeHead(s: number, h: Record<string, string>): void; end(b: string): void }, promise: Promise<unknown>) => {
    promise.then(v => json(res, 200, v)).catch(e => json(res, 500, { ok: false, code: 'internal', message: String(e) }))
  }

  return [
    {
      kind: 'exact', path: '/api/plugin-market/search',
      handler: async (req, res) => {
        const body = await readJson(req) as { query?: string; ai?: boolean }
        respond(res, gateway.search(body.query ?? '', body.ai === true))
      },
    },
    {
      kind: 'exact', path: '/api/plugin-market/install',
      handler: async (req, res) => {
        const body = await readJson(req) as { repo?: string }
        respond(res, gateway.install(body.repo ?? ''))
      },
    },
    {
      kind: 'exact', path: '/api/plugin-market/assess',
      handler: async (req, res) => {
        const body = await readJson(req) as { repo?: string }
        respond(res, gateway.assess(body.repo ?? ''))
      },
    },
    {
      kind: 'exact', path: '/api/plugin-market/uninstall',
      handler: async (req, res) => {
        const body = await readJson(req) as { repo?: string }
        respond(res, gateway.uninstall(body.repo ?? ''))
      },
    },
    {
      kind: 'exact', path: '/api/plugin-market/browse',
      handler: async (req, res) => {
        const body = await readJson(req) as { category?: string; limit?: number }
        respond(res, gateway.browse(body.category ?? 'all', Number.isFinite(body.limit) ? body.limit : 50))
      },
    },
    {
      kind: 'exact', path: '/api/plugin-market/installed',
      handler: (_req, res) => respond(res, gateway.installed()),
    },
    {
      kind: 'exact', path: '/api/plugin-market/catalog',
      handler: async (_req, res) => {
        try { respond(res, gateway.catalog()) } catch (e) { json(res, 502, { ok: false, message: String(e) }) }
      },
    },
  ]
}
