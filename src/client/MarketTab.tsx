/** 插件市场设置页 tab：分类浏览 / 搜索（本地+AI）/ 已安装管理 + mydsh.dev 引流。 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginMarketLocaleKey } from './locales.ts'
import {
  MARKET_CATEGORIES, categoryOf,
  type MarketAssessResult, type MarketBrowseResult, type MarketInstallResult,
  type MarketInstalledResult, type MarketLifecycleResult, type MarketPlugin, type MarketPluginLifecycle,
  type MarketPluginStatus, type MarketRestartResult, type MarketSearchResult, type MarketToggleResult, type MarketUninstallResult,
} from '../types.ts'
import css from './MarketTab.module.css'

/** Registration-side Remote face used by the section. */
export interface MarketTabInjected {
  search: (query: string, ai?: boolean) => Promise<MarketSearchResult>
  browse: (category: string, limit?: number) => Promise<MarketBrowseResult>
  install: (repo: string) => Promise<MarketInstallResult>
  uninstall: (repo: string) => Promise<MarketUninstallResult>
  enable: (repo: string) => Promise<MarketToggleResult>
  disable: (repo: string) => Promise<MarketToggleResult>
  status: (repo: string) => Promise<MarketPluginLifecycle>
  lifecycle: () => Promise<MarketLifecycleResult>
  restart: () => Promise<MarketRestartResult>
  assess: (repo: string) => Promise<MarketAssessResult>
  installed: () => Promise<MarketInstalledResult>
}

/** Full component props assembled by the Settings slot renderer. */
export type MarketTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginMarket'>
  & InjectFace<MarketTabInjected>

/** 分类列表（id → 标签 key；与 types.ts 的 MARKET_CATEGORIES 单一来源）。 */
const CATEGORY_LABEL_KEYS = ['all', ...MARKET_CATEGORIES.map(c => c.id)] as const

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
type RowBusy = { readonly installing: boolean; readonly enabling: boolean; readonly disabling: boolean; readonly uninstalling: boolean; readonly assessing: boolean } | null

/** 状态徽章文案与样式(用户语言)。 */
function statusBadge(status: MarketPluginStatus | undefined, t: (key: PluginMarketLocaleKey) => string): ReactNode {
  switch (status) {
    case 'installed': return <span className={`${css.tagStatus} ${css.tagStatusInstalled}`}>{t('stInstalled')}</span>
    case 'enabled-restart': return <span className={`${css.tagStatus} ${css.tagStatusRestart}`}>{t('stEnabledRestart')}</span>
    case 'enabled-active': return <span className={`${css.tagStatus} ${css.tagStatusActive}`}>{t('stEnabled')}</span>
    case 'disabled-restart': return <span className={`${css.tagStatus} ${css.tagStatusRestart}`}>{t('stDisabledRestart')}</span>
    case 'incompatible': return <span className={`${css.tagStatus} ${css.tagStatusBad}`}>{t('stIncompatible')}</span>
    case 'install-failed': return <span className={`${css.tagStatus} ${css.tagStatusBad}`}>{t('stFailed')}</span>
    default: return null
  }
}

/** 按状态渲染动作按钮(用户语言,无内部术语)。 */
function statusActions(
  p: MarketPlugin,
  status: MarketPluginStatus | undefined,
  busy: RowBusy,
  onInstall: (name: string) => void,
  onEnable: (name: string) => void,
  onDisable: (name: string) => void,
  onUninstall: (name: string) => void,
  onAssess: (name: string) => void,
  t: (key: PluginMarketLocaleKey) => string,
): ReactNode {
  const btns: ReactNode[] = []
  const push = (node: ReactNode) => { btns.push(node) }
  switch (status) {
    case 'enabled-active':
    case 'enabled-restart':
      push(<button key="d" type="button" className={css.btnDisable} disabled={busy?.disabling === true} onClick={() => onDisable(p.full_name)}>{busy?.disabling === true ? t('disabling') : t('disable')}</button>)
      push(<button key="u" type="button" className={css.btnUninstall} disabled={busy?.uninstalling === true} onClick={() => onUninstall(p.full_name)}>{busy?.uninstalling === true ? t('uninstalling') : t('uninstall')}</button>)
      break
    case 'disabled-restart':
      push(<button key="e" type="button" className={css.btnEnable} disabled={busy?.enabling === true} onClick={() => onEnable(p.full_name)}>{busy?.enabling === true ? t('enabling') : t('enable')}</button>)
      push(<button key="u" type="button" className={css.btnUninstall} disabled={busy?.uninstalling === true} onClick={() => onUninstall(p.full_name)}>{busy?.uninstalling === true ? t('uninstalling') : t('uninstall')}</button>)
      break
    case 'installed':
      push(<button key="e" type="button" className={css.btnEnable} disabled={busy?.enabling === true} onClick={() => onEnable(p.full_name)}>{busy?.enabling === true ? t('enabling') : t('enable')}</button>)
      push(<button key="u" type="button" className={css.btnUninstall} disabled={busy?.uninstalling === true} onClick={() => onUninstall(p.full_name)}>{busy?.uninstalling === true ? t('uninstalling') : t('uninstall')}</button>)
      break
    case 'incompatible':
      push(<button key="u" type="button" className={css.btnUninstall} disabled={busy?.uninstalling === true} onClick={() => onUninstall(p.full_name)}>{busy?.uninstalling === true ? t('uninstalling') : t('uninstall')}</button>)
      break
    case 'install-failed':
      push(<button key="i" type="button" className={css.btnInstall} disabled={busy?.installing === true} onClick={() => onInstall(p.full_name)}>{busy?.installing === true ? t('installing') : t('retryInstall')}</button>)
      push(<button key="u" type="button" className={css.btnUninstall} disabled={busy?.uninstalling === true} onClick={() => onUninstall(p.full_name)}>{busy?.uninstalling === true ? t('uninstalling') : t('uninstall')}</button>)
      break
    default:
      push(<button key="i" type="button" className={css.btnInstall} disabled={busy?.installing === true} onClick={() => onInstall(p.full_name)}>{busy?.installing === true ? t('installing') : t('install')}</button>)
  }
  push(<button key="a" type="button" className={css.btnAssess} disabled={busy?.assessing === true} onClick={() => onAssess(p.full_name)}>{busy?.assessing === true ? t('assessing') : t('assess')}</button>)
  return <>{btns}</>
}

/** 渲染一个插件行(状态徽章 + 按状态动作 + mydsh 详情引流)。 */
function PluginRow(
  p: MarketPlugin,
  status: MarketPluginStatus | undefined,
  busy: RowBusy,
  onInstall: (name: string) => void,
  onEnable: (name: string) => void,
  onDisable: (name: string) => void,
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
          {statusBadge(status, t)}
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
        {statusActions(p, status, busy, onInstall, onEnable, onDisable, onUninstall, onAssess, t)}
      </div>
    </div>
  )
}

/** Render the plugin market Settings tab. */
export function MarketTab({ search, browse, install, uninstall, enable, disable, status, lifecycle, restart, assess, installed, t }: MarketTabProps): ReactNode {
  const [view, setView] = useState<'browse' | 'search' | 'installed'>('browse')
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [useAi, setUseAi] = useState(false)
  const [browseState, setBrowseState] = useState<ViewState>({ status: 'idle' })
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' })
  const [installedState, setInstalledState] = useState<MarketInstalledResult | null>(null)
  /** 全量生命周期(状态/冲突/失败记录),拉一次供各行查询。 */
  const [lifecycleState, setLifecycleState] = useState<MarketLifecycleResult | null>(null)
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'install' | 'enable' | 'disable' | 'uninstall' | 'assess'>('install')
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

  /** 请求序号守卫：分类快速切换时丢弃过期响应，避免旧分类覆盖新分类。 */
  const browseSeq = useRef(0)
  /** 搜索序号守卫：本地/AI 搜索的过期响应不覆盖新结果（AI 搜索可达 6s+）。 */
  const searchSeq = useRef(0)

  const runBrowse = async (cat: string) => {
    const seq = ++browseSeq.current
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
      if (seq !== browseSeq.current) return // 已有更新的分类请求，丢弃过期响应
      setAllPlugins(result.plugins)
      setAllCounts(result.counts)
      setVisibleCount(PAGE)
      const list = cat === 'all' ? result.plugins : result.plugins.filter(p => categoryOf(p) === cat)
      setBrowseState({ status: 'ready', result: { ...result, category: cat as MarketBrowseResult['category'], plugins: list.slice(0, PAGE) } })
    } catch (e) {
      if (seq !== browseSeq.current) return // 过期请求的失败不覆盖新状态
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

  const runSearch = async (q: string, ai: boolean) => {
    const queryText = q.trim()
    if (queryText.length === 0) return
    const seq = ++searchSeq.current
    setSearchState({ status: 'loading' })
    setNotice('')
    try {
      const result = await search(queryText, ai)
      if (seq !== searchSeq.current) return // 已有更新的搜索请求，丢弃过期响应
      setSearchState({ status: 'ready', result })
    } catch (e) {
      if (seq !== searchSeq.current) return
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

  const loadLifecycle = async () => {
    try {
      setLifecycleState(await lifecycle())
    } catch { /* 生命周期不可用时行无状态徽章 */ }
  }

  /** 行状态:lifecycle 的 key 是 owner/repo。 */
  const statusOf = (name: string): MarketPluginStatus | undefined => lifecycleState?.items[name]?.status
  const reasonOf = (name: string): string | undefined => lifecycleState?.items[name]?.reason
  const lastErrorOf = (name: string): string | undefined => lifecycleState?.items[name]?.lastError

  // 首次进入：默认浏览「全部」+ 拉已安装 + 拉生命周期
  useEffect(() => {
    void runBrowse('all')
    void loadInstalled()
    void loadLifecycle()
  }, [])

  const switchView = (v: typeof view) => {
    setView(v)
    setNotice('')
    if (v === 'browse') void runBrowse(category)
    if (v === 'installed') void loadInstalled()
    void loadLifecycle()
  }

  const afterMutation = async (ok: boolean, detail: string) => {
    setNotice(ok ? detail : `⚠️ ${detail.slice(0, 200)}`)
    // 刷新已安装状态 + 生命周期 + 当前视图
    await loadInstalled()
    await loadLifecycle()
    if (view === 'browse') void runBrowse(category)
  }

  /** 需要重启才生效的插件名(启用/停用成功后设置,驱动「立即重启」入口)。 */
  const [restartPendingFor, setRestartPendingFor] = useState<string | null>(null)
  /** 自动重启进行中(轮询服务恢复,恢复后自动刷新)。 */
  const [restarting, setRestarting] = useState(false)

  /** 自动重启:确认 → 调后端 → 轮询服务恢复 → 自动刷新页面。 */
  const handleRestartNow = async () => {
    if (!window.confirm(t('confirmRestart'))) return
    setRestarting(true)
    setNotice(t('restarting'))
    try {
      await restart()
      // 服务退出+拉起期间请求会失败,轮询直到恢复(最长 90 秒)
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const resp = await fetch('/api/plugin-market/lifecycle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
          if (resp.ok) {
            setNotice(t('restartDone'))
            setRestarting(false)
            setRestartPendingFor(null)
            window.location.reload()
            return
          }
        } catch { /* 服务尚未恢复,继续轮询 */ }
      }
      setNotice('⚠️ ' + t('restartCap_manual'))
      setRestarting(false)
    } catch (e) {
      setNotice(`⚠️ ${String(e)}`)
      setRestarting(false)
    }
  }

  const handleInstall = async (name: string) => {
    if (!window.confirm(t('confirmInstall').replace('{name}', name))) return
    setBusyRow(name); setBusyAction('install'); setNotice('')
    try { await afterMutation(...await install(name).then(r => [r.ok, r.detail] as [boolean, string])) }
    catch (e) { setNotice(`⚠️ ${String(e)}`) }
    finally { setBusyRow(null) }
  }

  const handleEnable = async (name: string) => {
    if (!window.confirm(t('confirmEnable').replace('{name}', name))) return
    setBusyRow(name); setBusyAction('enable'); setNotice('')
    try {
      const r = await enable(name)
      setRestartPendingFor(r.ok && r.restartRequired ? name : null)
      await afterMutation(r.ok, r.ok ? (r.restartRequired ? t('enabledRestartHint') : r.detail) : r.detail)
    } catch (e) { setNotice(`⚠️ ${String(e)}`) }
    finally { setBusyRow(null) }
  }

  const handleDisable = async (name: string) => {
    if (!window.confirm(t('confirmDisable').replace('{name}', name))) return
    setBusyRow(name); setBusyAction('disable'); setNotice('')
    try {
      const r = await disable(name)
      setRestartPendingFor(r.ok && r.restartRequired ? name : null)
      await afterMutation(r.ok, r.ok ? (r.restartRequired ? t('disabledRestartHint') : r.detail) : r.detail)
    } catch (e) { setNotice(`⚠️ ${String(e)}`) }
    finally { setBusyRow(null) }
  }

  const handleUninstall = async (name: string) => {
    if (!window.confirm(t('confirmUninstall').replace('{name}', name))) return
    setBusyRow(name); setBusyAction('uninstall'); setNotice('')
    try { await afterMutation(...await uninstall(name).then(r => [r.ok, r.detail] as [boolean, string])) }
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
      enabling: busyAction === 'enable',
      disabling: busyAction === 'disable',
      uninstalling: busyAction === 'uninstall',
      assessing: busyAction === 'assess',
    }
  }

  // 已安装视图：优先用 lifecycle(带状态),回退到 sources 展开
  // 行元数据优先取 catalog 缓存(星数/简介),catalog 没有时用依赖名兜底
  const catalogOf = (name: string): MarketPlugin | undefined =>
    allPlugins?.find(p => p.full_name === name)
  const lifecycleRows: MarketPlugin[] = lifecycleState
    ? Object.entries(lifecycleState.items).map(([name, life]) => {
        const cat = catalogOf(name)
        const desc = cat?.zh_desc ?? cat?.description ?? life.installedName ?? name
        return {
          full_name: name,
          description: desc,
          zh_desc: desc,
          language: cat?.language ?? '',
          stargazers_count: cat?.stargazers_count ?? 0,
          forks_count: cat?.forks_count ?? 0,
          topics: cat?.topics ?? [],
          html_url: cat?.html_url ?? `https://github.com/${name}`,
          installed: true,
        }
      })
    : []
  const installedRows: MarketPlugin[] = lifecycleRows.length > 0
    ? lifecycleRows
    : (installedState
      ? Object.entries(installedState.sources).map(([dep, src]) => {
          const repo = src.includes('/') && !src.startsWith('@') ? src : dep
          const cat = catalogOf(repo)
          const desc = cat?.zh_desc ?? cat?.description ?? dep
          return {
            full_name: repo,
            description: desc,
            zh_desc: desc,
            language: cat?.language ?? '',
            stargazers_count: cat?.stargazers_count ?? 0,
            forks_count: cat?.forks_count ?? 0,
            topics: cat?.topics ?? [],
            html_url: cat?.html_url ?? `https://github.com/${repo}`,
            installed: true,
          }
        })
      : [])

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
          {t('installedTab')}{lifecycleState ? `（${Object.keys(lifecycleState.items).length}）` : installedState ? `（${installedState.installed.length}）` : ''}
        </button>
      </div>

      {notice !== '' ? <p className={css.notice}>{notice}</p> : null}

      {/* 重启生效入口:启用/停用后需要重启时出现;可自动重启 → 按钮,否则 → 指引文案 */}
      {restartPendingFor !== null && !restarting ? (
        <div className={css.restartRow}>
          <span className={css.restartHint}>
            {lifecycleState?.canAutoRestart === false
              ? t('restartCap_manual')
              : t(`restartCap_${lifecycleState?.restartCapability ?? 'pm2'}`)}
          </span>
          {lifecycleState?.canAutoRestart !== false ? (
            <button type="button" className={css.btnRestart} onClick={() => void handleRestartNow()}>
              {t('restartNow')}
            </button>
          ) : null}
        </div>
      ) : null}
      {restarting ? (
        <div className={css.restartRow}>
          <span className={css.restartHint}>{t('restarting')}</span>
          <span className={css.restartSpinner}>⏳</span>
        </div>
      ) : null}

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
                browseState.result.plugins.map(p => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t))
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
                  {searchState.result.local.map(p => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t))}
                </section>
              ) : null}
              {searchState.result.ai.length > 0 ? (
                <section>
                  <h3 className={css.sectionH}>{t('aiTab')}（{searchState.result.ai.length}）</h3>
                  {searchState.result.ai.map(p => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t))}
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
          {installedRows.map(p => {
            const st = statusOf(p.full_name)
            const reason = reasonOf(p.full_name)
            const failed = lastErrorOf(p.full_name)
            return (
              <div key={p.full_name}>
                {PluginRow(p, st, busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t)}
                {reason ? <p className={css.rowNote}>{reason}</p> : null}
                {failed ? <p className={css.rowNote}>{t('failedHint')}: {failed.slice(0, 160)}</p> : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
