/** 插件市场设置页 tab：分类浏览 / 搜索（本地+AI）/ 已安装管理 + mydsh.dev 引流。 */

import { useEffect, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginMarketLocaleKey } from './locales.ts'
import type {
  MarketAssessResult, MarketBrowseResult, MarketInstallResult,
  MarketInstalledResult, MarketPlugin, MarketSearchResult, MarketUninstallResult,
} from '../types.ts'
import css from './MarketTab.module.css'

/** Registration-side Remote face used by the section. */
export interface MarketTabInjected {
  search: (query: string, ai?: boolean) => Promise<MarketSearchResult>
  browse: (category: string, limit?: number) => Promise<MarketBrowseResult>
  install: (repo: string) => Promise<MarketInstallResult>
  uninstall: (repo: string) => Promise<MarketUninstallResult>
  assess: (repo: string) => Promise<MarketAssessResult>
  installed: () => Promise<MarketInstalledResult>
}

/** Full component props assembled by the Settings slot renderer. */
export type MarketTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginMarket'>
  & InjectFace<MarketTabInjected>

/** 分类列表（id → 标签 key）。 */
const CATEGORY_LABEL_KEYS = ['all', 'agent', 'mcp', 'devtools', 'ui', 'vision', 'llm', 'memory', 'data', 'integrations', 'other'] as const

type ViewState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: MarketBrowseResult }
  | { readonly status: 'error'; readonly message: string }

type SearchState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: MarketSearchResult }
  | { readonly status: 'error'; readonly message: string }

/** 行操作 busy 状态。 */
type RowBusy = { readonly installing: boolean; readonly uninstalling: boolean; readonly assessing: boolean } | null

/** 渲染一个插件行（带安装/卸载/评估 + mydsh 详情引流）。 */
function PluginRow(
  p: MarketPlugin,
  busy: RowBusy,
  onInstall: (name: string) => void,
  onUninstall: (name: string) => void,
  onAssess: (name: string) => void,
  t: (key: PluginMarketLocaleKey) => string,
): ReactNode {
  const desc = p.zh_desc ?? p.en_desc ?? p.description ?? t('noDesc')
  // 只有 owner/repo 格式（非依赖名）才可跳 mydsh 详情页
  const isRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.full_name)
  return (
    <div className={css.row}>
      <div className={css.rowMain}>
        <div className={css.rowName}>
          {p.full_name}
          {p.installed ? <span className={css.tagInstalled}>{t('installedTag')}</span> : null}
        </div>
        <div className={css.rowDesc}>{desc}</div>
        <div className={css.rowMeta}>
          <span>★ {p.stargazers_count.toLocaleString()}</span>
          {p.language ? <span>· {p.language}</span> : null}
          {isRepo ? (
            <a className={css.rowLink} href={`https://mydsh.dev/plugin?repo=${encodeURIComponent(p.full_name)}`} target="_blank" rel="noopener">mydsh.dev ↗</a>
          ) : null}
        </div>
      </div>
      <div className={css.rowActions}>
        {p.installed ? (
          <button
            type="button"
            className={css.btnUninstall}
            disabled={busy?.uninstalling === true}
            onClick={() => onUninstall(p.full_name)}
          >
            {busy?.uninstalling ? t('uninstalling') : t('uninstall')}
          </button>
        ) : (
          <button
            type="button"
            className={css.btnInstall}
            disabled={busy?.installing === true}
            onClick={() => onInstall(p.full_name)}
          >
            {busy?.installing ? t('installing') : t('install')}
          </button>
        )}
        <button
          type="button"
          className={css.btnAssess}
          disabled={busy?.assessing === true}
          onClick={() => onAssess(p.full_name)}
        >
          {busy?.assessing ? t('assessing') : t('assess')}
        </button>
      </div>
    </div>
  )
}

/** Render the plugin market Settings tab. */
export function MarketTab({ search, browse, install, uninstall, assess, installed, t }: MarketTabProps): ReactNode {
  const [view, setView] = useState<'browse' | 'search' | 'installed'>('browse')
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [useAi, setUseAi] = useState(false)
  const [browseState, setBrowseState] = useState<ViewState>({ status: 'idle' })
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' })
  const [installedState, setInstalledState] = useState<MarketInstalledResult | null>(null)
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'install' | 'uninstall' | 'assess'>('install')
  const [notice, setNotice] = useState('')
  const [mydshLink, setMydshLink] = useState('https://mydsh.dev/plugins')
  // 全量 catalog 本地缓存（一次拉取，切分类零网络请求）
  const [allPlugins, setAllPlugins] = useState<readonly MarketPlugin[] | null>(null)
  const [allCounts, setAllCounts] = useState<Readonly<Record<string, number>> | null>(null)
  // 当前分类可见条数（「加载更多」用，本地切片不重新请求）
  const [visibleCount, setVisibleCount] = useState(50)
  const PAGE = 50

  /** 当前分类的完整本地列表（缓存命中时零网络）。 */
  function filteredList(cat: string): readonly MarketPlugin[] {
    if (allPlugins === null) return []
    return cat === 'all' ? allPlugins : allPlugins.filter(p => categoryOf(p) === cat)
  }

  const runBrowse = async (cat: string) => {
    // 已缓存全量：本地过滤，秒切
    if (allPlugins !== null) {
      const list = filteredList(cat)
      setVisibleCount(PAGE)
      setBrowseState({ status: 'ready', result: { ok: true, category: cat as MarketBrowseResult['category'], plugins: list.slice(0, PAGE), counts: allCounts ?? {} } })
      return
    }
    setBrowseState({ status: 'loading' })
    try {
      // 一次拉全量（limit=0），本地缓存后按分类过滤
      const result = await browse('all', 0)
      setAllPlugins(result.plugins)
      setAllCounts(result.counts)
      setVisibleCount(PAGE)
      const list = cat === 'all' ? result.plugins : result.plugins.filter(p => categoryOf(p) === cat)
      setBrowseState({ status: 'ready', result: { ...result, category: cat as MarketBrowseResult['category'], plugins: list.slice(0, PAGE) } })
    } catch (e) {
      setBrowseState({ status: 'error', message: String(e) })
    }
  }

  /** 「加载更多」：从本地缓存继续切片，瞬时。 */
  const loadMore = () => {
    if (browseState.status !== 'ready' || allPlugins === null) return
    const next = visibleCount + PAGE
    setVisibleCount(next)
    const list = filteredList(browseState.result.category)
    setBrowseState({ status: 'ready', result: { ...browseState.result, plugins: list.slice(0, next) } })
  }

  /** 前端分类判断（与后端一致）。 */
  function categoryOf(p: MarketPlugin): string {
    const topics = new Set((p.topics ?? []).map(t => t.toLowerCase()))
    const RULES: ReadonlyArray<readonly [string, ...string[]]> = [
      ['agent', 'agent', 'ai-agent', 'agent-skills', 'multi-agent', 'autonomous', 'team', 'crew', 'orchestration'],
      ['mcp', 'mcp', 'model-context-protocol', 'mcp-server', 'mcp-client'],
      ['devtools', 'developer-tools', 'cli', 'command-line', 'terminal', 'vscode', 'neovim', 'ide', 'sdk', 'tooling', 'debugger', 'tui'],
      ['ui', 'ui', 'gui', 'dashboard', 'desktop', 'electron', 'web-ui', 'frontend', 'interface', 'webapp', 'react'],
      ['vision', 'vision', 'image', 'video', 'multimodal', 'ocr', 'screenshot', 'computer-vision', 'audio'],
      ['llm', 'llm', 'language-model', 'prompt', 'chat', 'openai', 'anthropic', 'gemini', 'claude', 'codex', 'reasoning', 'inference'],
      ['memory', 'memory', 'knowledge', 'rag', 'vector', 'retrieval', 'search', 'notes', 'semantic'],
      ['data', 'data', 'database', 'storage', 'sql', 'postgres', 'redis', 'sqlite', 'csv', 'excel'],
      ['integrations', 'integration', 'api', 'webhook', 'github', 'slack', 'discord', 'telegram', 'notion', 'obsidian', 'chrome', 'browser', 'google', 'jira', 'linear', 'gitlab'],
    ]
    for (const [id, ...ts] of RULES) {
      if (ts.some(t => topics.has(t))) return id
    }
    return 'other'
  }

  const runSearch = async (q: string, ai: boolean) => {
    const queryText = q.trim()
    if (queryText.length === 0) return
    setSearchState({ status: 'loading' })
    setNotice('')
    try {
      const result = await search(queryText, ai)
      setSearchState({ status: 'ready', result })
    } catch (e) {
      setSearchState({ status: 'error', message: String(e) })
    }
  }

  const loadInstalled = async () => {
    try {
      const result = await installed()
      setInstalledState(result)
    } catch (e) {
      setNotice(`⚠️ ${String(e)}`)
    }
  }

  // 首次进入：默认浏览「全部」+ 拉已安装
  useEffect(() => {
    void runBrowse('all')
    void loadInstalled()
  }, [])

  const switchView = (v: typeof view) => {
    setView(v)
    setNotice('')
    if (v === 'browse') void runBrowse(category)
    if (v === 'installed') void loadInstalled()
  }

  const afterMutation = async (ok: boolean, detail: string) => {
    setNotice(ok ? detail : `⚠️ ${detail.slice(0, 200)}`)
    // 刷新已安装状态 + 当前视图
    await loadInstalled()
    if (view === 'browse') void runBrowse(category)
  }

  const handleInstall = async (name: string) => {
    setBusyRow(name); setBusyAction('install'); setNotice('')
    try { await afterMutation(...await install(name).then(r => [r.ok, r.ok ? t('restartHint') : r.detail] as [boolean, string])) }
    catch (e) { setNotice(`⚠️ ${String(e)}`) }
    finally { setBusyRow(null) }
  }

  const handleUninstall = async (name: string) => {
    setBusyRow(name); setBusyAction('uninstall'); setNotice('')
    try { await afterMutation(...await uninstall(name).then(r => [r.ok, r.ok ? t('uninstalledHint') : r.detail] as [boolean, string])) }
    catch (e) { setNotice(`⚠️ ${String(e)}`) }
    finally { setBusyRow(null) }
  }

  const handleAssess = async (name: string) => {
    setBusyRow(name); setBusyAction('assess'); setNotice('')
    try {
      const result = await assess(name)
      if (result.status === 'reported') setNotice(`✅ ${result.detail}（风险分 ${result.risk_score ?? '—'}/100）`)
      else if (result.status === 'pending') setNotice(`ℹ️ ${result.detail}`)
      else setNotice(`⚠️ ${result.detail}`)
    } catch (e) { setNotice(`⚠️ ${String(e)}`) }
    finally { setBusyRow(null) }
  }

  /** 行级 busy：只有与当前操作行匹配的行显示进行中。 */
  const busyFor = (name: string): RowBusy => {
    if (busyRow !== name) return null
    return {
      installing: busyAction === 'install',
      uninstalling: busyAction === 'uninstall',
      assessing: busyAction === 'assess',
    }
  }

  // 已安装视图：按 sources 展开成行（仓库名 + 依赖名）
  const installedRows: MarketPlugin[] = installedState
    ? Object.entries(installedState.sources).map(([dep, src]) => ({
        full_name: src.includes('/') && !src.startsWith('@') ? src : dep,
        description: dep,
        zh_desc: dep,
        language: '',
        stargazers_count: 0,
        forks_count: 0,
        topics: [],
        html_url: `https://github.com/${src.includes('/') && !src.startsWith('@') ? src : dep}`,
        installed: true,
      }))
    : []

  const counts = browseState.status === 'ready' ? browseState.result.counts : null

  return (
    <div className={css.wrap}>
      <div className={css.introRow}>
        <p className={css.intro}>{t('intro')}</p>
        <a className={css.mydshLink} href={mydshLink} target="_blank" rel="noopener">
          🌐 mydsh.dev <span data-i18n="market_site">插件大全</span> ↗
        </a>
      </div>

      <div className={css.tabs}>
        <button type="button" className={view === 'browse' ? `${css.tab} ${css.tabActive}` : css.tab} onClick={() => switchView('browse')}>{t('browseTab')}</button>
        <button type="button" className={view === 'search' ? `${css.tab} ${css.tabActive}` : css.tab} onClick={() => switchView('search')}>{t('searchTab')}</button>
        <button type="button" className={view === 'installed' ? `${css.tab} ${css.tabActive}` : css.tab} onClick={() => switchView('installed')}>
          {t('installedTab')}{installedState ? `（${installedState.installed.length}）` : ''}
        </button>
      </div>

      {notice !== '' ? <p className={css.notice}>{notice}</p> : null}

      {view === 'browse' ? (
        <>
          <div className={css.catChips}>
            {CATEGORY_LABEL_KEYS.map(id => (
              <button
                key={id}
                type="button"
                className={category === id ? `${css.catChip} ${css.catChipActive}` : css.catChip}
                onClick={() => { setCategory(id); void runBrowse(id) }}
              >
                {t(`cat_${id}`)}{counts && id !== 'all' ? ` ${counts[id] ?? 0}` : ''}
              </button>
            ))}
          </div>
          {browseState.status === 'loading' ? <p className={css.empty}>{t('loading')}</p> : null}
          {browseState.status === 'error' ? <p className={css.error}>{t('errLoad')}：{browseState.message}</p> : null}
          {browseState.status === 'ready' ? (
            <div className={css.results}>
              {browseState.result.plugins.length === 0 ? (
                <p className={css.empty}>{t('emptyResult')}</p>
              ) : (
                browseState.result.plugins.map(p => PluginRow(p, busyFor(p.full_name), handleInstall, handleUninstall, handleAssess, t))
              )}
              {allPlugins !== null && browseState.result.plugins.length < filteredList(browseState.result.category).length ? (
                <button type="button" className={css.btnMore} onClick={loadMore}>
                  {t('loadMore')}（{browseState.result.plugins.length}/{filteredList(browseState.result.category).length}）
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {view === 'search' ? (
        <>
          <div className={css.searchRow}>
            <input
              className={css.searchInput}
              type="search"
              placeholder={t('searchPh')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void runSearch(query, useAi) }}
            />
            <button type="button" className={css.btnSearch} onClick={() => void runSearch(query, useAi)}>
              {useAi ? t('aiSearchBtn') : t('searchBtn')}
            </button>
            <label className={css.aiToggle}>
              <input type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} />
              🤖 AI
            </label>
          </div>
          {searchState.status === 'idle' ? <p className={css.empty}>{t('empty')}</p> : null}
          {searchState.status === 'loading' ? <p className={css.empty}>{t('searching')}</p> : null}
          {searchState.status === 'error' ? <p className={css.error}>{t('errLoad')}：{searchState.message}</p> : null}
          {searchState.status === 'ready' ? (
            <div className={css.results}>
              {searchState.result.local.length > 0 ? (
                <section>
                  <h3 className={css.sectionH}>{t('localTab')}（{searchState.result.local.length}）</h3>
                  {searchState.result.local.map(p => PluginRow(p, busyFor(p.full_name), handleInstall, handleUninstall, handleAssess, t))}
                </section>
              ) : null}
              {searchState.result.ai.length > 0 ? (
                <section>
                  <h3 className={css.sectionH}>{t('aiTab')}（{searchState.result.ai.length}）</h3>
                  {searchState.result.ai.map(p => PluginRow(p, busyFor(p.full_name), handleInstall, handleUninstall, handleAssess, t))}
                </section>
              ) : null}
              {searchState.result.local.length === 0 && searchState.result.ai.length === 0 ? (
                <p className={css.empty}>{t('emptyResult')}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {view === 'installed' ? (
        <div className={css.results}>
          {installedRows.length === 0 ? <p className={css.empty}>{t('noInstalled')}</p> : null}
          {installedRows.map(p => PluginRow(p, busyFor(p.full_name), handleInstall, handleUninstall, handleAssess, t))}
        </div>
      ) : null}
    </div>
  )
}
