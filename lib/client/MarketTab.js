import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** 插件市场设置页 tab：分类浏览 / 搜索（本地+AI）/ 已安装管理 + mydsh.dev 引流。 */
import { useEffect, useRef, useState } from 'react';
import { MARKET_CATEGORIES, categoryOf, } from "../types.js";
import css from './MarketTab.module.css';
/** 分类列表（id → 标签 key；与 types.ts 的 MARKET_CATEGORIES 单一来源）。 */
const CATEGORY_LABEL_KEYS = ['all', ...MARKET_CATEGORIES.map(c => c.id)];
/** 状态徽章文案与样式(用户语言)。 */
function statusBadge(status, t) {
    switch (status) {
        case 'installed': return _jsx("span", { className: `${css.tagStatus} ${css.tagStatusInstalled}`, children: t('stInstalled') });
        case 'enabled-restart': return _jsx("span", { className: `${css.tagStatus} ${css.tagStatusRestart}`, children: t('stEnabledRestart') });
        case 'enabled-active': return _jsx("span", { className: `${css.tagStatus} ${css.tagStatusActive}`, children: t('stEnabled') });
        case 'disabled-restart': return _jsx("span", { className: `${css.tagStatus} ${css.tagStatusRestart}`, children: t('stDisabledRestart') });
        case 'incompatible': return _jsx("span", { className: `${css.tagStatus} ${css.tagStatusBad}`, children: t('stIncompatible') });
        case 'install-failed': return _jsx("span", { className: `${css.tagStatus} ${css.tagStatusBad}`, children: t('stFailed') });
        default: return null;
    }
}
/** 按状态渲染动作按钮(用户语言,无内部术语)。 */
function statusActions(p, status, busy, onInstall, onEnable, onDisable, onUninstall, onAssess, t) {
    const btns = [];
    const push = (node) => { btns.push(node); };
    switch (status) {
        case 'enabled-active':
        case 'enabled-restart':
            push(_jsx("button", { type: "button", className: css.btnDisable, disabled: busy?.disabling === true, onClick: () => onDisable(p.full_name), children: busy?.disabling === true ? t('disabling') : t('disable') }, "d"));
            push(_jsx("button", { type: "button", className: css.btnUninstall, disabled: busy?.uninstalling === true, onClick: () => onUninstall(p.full_name), children: busy?.uninstalling === true ? t('uninstalling') : t('uninstall') }, "u"));
            break;
        case 'disabled-restart':
            push(_jsx("button", { type: "button", className: css.btnEnable, disabled: busy?.enabling === true, onClick: () => onEnable(p.full_name), children: busy?.enabling === true ? t('enabling') : t('enable') }, "e"));
            push(_jsx("button", { type: "button", className: css.btnUninstall, disabled: busy?.uninstalling === true, onClick: () => onUninstall(p.full_name), children: busy?.uninstalling === true ? t('uninstalling') : t('uninstall') }, "u"));
            break;
        case 'installed':
            push(_jsx("button", { type: "button", className: css.btnEnable, disabled: busy?.enabling === true, onClick: () => onEnable(p.full_name), children: busy?.enabling === true ? t('enabling') : t('enable') }, "e"));
            push(_jsx("button", { type: "button", className: css.btnUninstall, disabled: busy?.uninstalling === true, onClick: () => onUninstall(p.full_name), children: busy?.uninstalling === true ? t('uninstalling') : t('uninstall') }, "u"));
            break;
        case 'incompatible':
            push(_jsx("button", { type: "button", className: css.btnUninstall, disabled: busy?.uninstalling === true, onClick: () => onUninstall(p.full_name), children: busy?.uninstalling === true ? t('uninstalling') : t('uninstall') }, "u"));
            break;
        case 'install-failed':
            push(_jsx("button", { type: "button", className: css.btnInstall, disabled: busy?.installing === true, onClick: () => onInstall(p.full_name), children: busy?.installing === true ? t('installing') : t('retryInstall') }, "i"));
            push(_jsx("button", { type: "button", className: css.btnUninstall, disabled: busy?.uninstalling === true, onClick: () => onUninstall(p.full_name), children: busy?.uninstalling === true ? t('uninstalling') : t('uninstall') }, "u"));
            break;
        default:
            push(_jsx("button", { type: "button", className: css.btnInstall, disabled: busy?.installing === true, onClick: () => onInstall(p.full_name), children: busy?.installing === true ? t('installing') : t('install') }, "i"));
    }
    push(_jsx("button", { type: "button", className: css.btnAssess, disabled: busy?.assessing === true, onClick: () => onAssess(p.full_name), children: busy?.assessing === true ? t('assessing') : t('assess') }, "a"));
    return _jsx(_Fragment, { children: btns });
}
/** 渲染一个插件行(状态徽章 + 按状态动作 + mydsh 详情引流)。 */
function PluginRow(p, status, busy, onInstall, onEnable, onDisable, onUninstall, onAssess, t) {
    const desc = p.zh_desc ?? p.en_desc ?? p.description ?? t('noDesc');
    // 只有 owner/repo 格式（非依赖名）才可跳 mydsh 详情页
    const isRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.full_name);
    return (_jsxs("div", { className: css.row, children: [_jsxs("div", { className: css.rowMain, children: [_jsxs("div", { className: css.rowName, children: [p.full_name, statusBadge(status, t)] }), _jsx("div", { className: css.rowDesc, children: desc }), _jsxs("div", { className: css.rowMeta, children: [_jsxs("span", { children: ["\u2605 ", p.stargazers_count.toLocaleString()] }), p.language ? _jsxs("span", { children: ["\u00B7 ", p.language] }) : null, isRepo ? (_jsx("a", { className: css.rowLink, href: `https://mydsh.dev/plugin?repo=${encodeURIComponent(p.full_name)}`, target: "_blank", rel: "noopener", children: "mydsh.dev \u2197" })) : null] })] }), _jsx("div", { className: css.rowActions, children: statusActions(p, status, busy, onInstall, onEnable, onDisable, onUninstall, onAssess, t) })] }));
}
/** Render the plugin market Settings tab. */
export function MarketTab({ search, browse, install, uninstall, enable, disable, status, lifecycle, restart, assess, installed, t }) {
    const [view, setView] = useState('browse');
    const [category, setCategory] = useState('all');
    const [query, setQuery] = useState('');
    const [useAi, setUseAi] = useState(false);
    const [browseState, setBrowseState] = useState({ status: 'idle' });
    const [searchState, setSearchState] = useState({ status: 'idle' });
    const [installedState, setInstalledState] = useState(null);
    /** 全量生命周期(状态/冲突/失败记录),拉一次供各行查询。 */
    const [lifecycleState, setLifecycleState] = useState(null);
    const [busyRow, setBusyRow] = useState(null);
    const [busyAction, setBusyAction] = useState('install');
    const [notice, setNotice] = useState('');
    const [mydshLink, setMydshLink] = useState('https://mydsh.dev/plugins');
    // 全量 catalog 本地缓存（一次拉取，切分类零网络请求）
    const [allPlugins, setAllPlugins] = useState(null);
    const [allCounts, setAllCounts] = useState(null);
    // 当前分类可见条数（「加载更多」用，本地切片不重新请求）
    const [visibleCount, setVisibleCount] = useState(50);
    const PAGE = 50;
    /** 当前分类的完整本地列表（缓存命中时零网络）。 */
    function filteredList(cat) {
        if (allPlugins === null)
            return [];
        return cat === 'all' ? allPlugins : allPlugins.filter(p => categoryOf(p) === cat);
    }
    /** 请求序号守卫：分类快速切换时丢弃过期响应，避免旧分类覆盖新分类。 */
    const browseSeq = useRef(0);
    /** 搜索序号守卫：本地/AI 搜索的过期响应不覆盖新结果（AI 搜索可达 6s+）。 */
    const searchSeq = useRef(0);
    const runBrowse = async (cat) => {
        const seq = ++browseSeq.current;
        // 已缓存全量：本地过滤，秒切
        if (allPlugins !== null) {
            const list = filteredList(cat);
            setVisibleCount(PAGE);
            setBrowseState({ status: 'ready', result: { ok: true, category: cat, plugins: list.slice(0, PAGE), counts: allCounts ?? {} } });
            return;
        }
        setBrowseState({ status: 'loading' });
        try {
            // 一次拉全量（limit=0），本地缓存后按分类过滤
            const result = await browse('all', 0);
            if (seq !== browseSeq.current)
                return; // 已有更新的分类请求，丢弃过期响应
            setAllPlugins(result.plugins);
            setAllCounts(result.counts);
            setVisibleCount(PAGE);
            const list = cat === 'all' ? result.plugins : result.plugins.filter(p => categoryOf(p) === cat);
            setBrowseState({ status: 'ready', result: { ...result, category: cat, plugins: list.slice(0, PAGE) } });
        }
        catch (e) {
            if (seq !== browseSeq.current)
                return; // 过期请求的失败不覆盖新状态
            setBrowseState({ status: 'error', message: String(e) });
        }
    };
    /** 「加载更多」：从本地缓存继续切片，瞬时。 */
    const loadMore = () => {
        if (browseState.status !== 'ready' || allPlugins === null)
            return;
        const next = visibleCount + PAGE;
        setVisibleCount(next);
        const list = filteredList(browseState.result.category);
        setBrowseState({ status: 'ready', result: { ...browseState.result, plugins: list.slice(0, next) } });
    };
    const runSearch = async (q, ai) => {
        const queryText = q.trim();
        if (queryText.length === 0)
            return;
        const seq = ++searchSeq.current;
        setSearchState({ status: 'loading' });
        setNotice('');
        try {
            const result = await search(queryText, ai);
            if (seq !== searchSeq.current)
                return; // 已有更新的搜索请求，丢弃过期响应
            setSearchState({ status: 'ready', result });
        }
        catch (e) {
            if (seq !== searchSeq.current)
                return;
            setSearchState({ status: 'error', message: String(e) });
        }
    };
    const loadInstalled = async () => {
        try {
            const result = await installed();
            setInstalledState(result);
        }
        catch (e) {
            setNotice(`⚠️ ${String(e)}`);
        }
    };
    const loadLifecycle = async () => {
        try {
            setLifecycleState(await lifecycle());
        }
        catch { /* 生命周期不可用时行无状态徽章 */ }
    };
    /** 行状态:lifecycle 的 key 是 owner/repo。 */
    const statusOf = (name) => lifecycleState?.items[name]?.status;
    const reasonOf = (name) => lifecycleState?.items[name]?.reason;
    const lastErrorOf = (name) => lifecycleState?.items[name]?.lastError;
    // 首次进入：默认浏览「全部」+ 拉已安装 + 拉生命周期
    useEffect(() => {
        void runBrowse('all');
        void loadInstalled();
        void loadLifecycle();
    }, []);
    const switchView = (v) => {
        setView(v);
        setNotice('');
        if (v === 'browse')
            void runBrowse(category);
        if (v === 'installed')
            void loadInstalled();
        void loadLifecycle();
    };
    const afterMutation = async (ok, detail) => {
        setNotice(ok ? detail : `⚠️ ${detail.slice(0, 200)}`);
        // 刷新已安装状态 + 生命周期 + 当前视图
        await loadInstalled();
        await loadLifecycle();
        if (view === 'browse')
            void runBrowse(category);
    };
    /** 需要重启才生效的插件名(启用/停用成功后设置,驱动「立即重启」入口)。 */
    const [restartPendingFor, setRestartPendingFor] = useState(null);
    /** 自动重启进行中(轮询服务恢复,恢复后自动刷新)。 */
    const [restarting, setRestarting] = useState(false);
    /** 自动重启:确认 → 调后端 → 轮询服务恢复 → 自动刷新页面。 */
    const handleRestartNow = async () => {
        if (!window.confirm(t('confirmRestart')))
            return;
        setRestarting(true);
        setNotice(t('restarting'));
        try {
            await restart();
            // 服务退出+拉起期间请求会失败,轮询直到恢复(最长 90 秒)
            const deadline = Date.now() + 90_000;
            while (Date.now() < deadline) {
                await new Promise(r => setTimeout(r, 2000));
                try {
                    const resp = await fetch('/api/plugin-market/lifecycle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
                    if (resp.ok) {
                        setNotice(t('restartDone'));
                        setRestarting(false);
                        setRestartPendingFor(null);
                        window.location.reload();
                        return;
                    }
                }
                catch { /* 服务尚未恢复,继续轮询 */ }
            }
            setNotice('⚠️ ' + t('restartCap_manual'));
            setRestarting(false);
        }
        catch (e) {
            setNotice(`⚠️ ${String(e)}`);
            setRestarting(false);
        }
    };
    const handleInstall = async (name) => {
        if (!window.confirm(t('confirmInstall').replace('{name}', name)))
            return;
        setBusyRow(name);
        setBusyAction('install');
        setNotice('');
        try {
            await afterMutation(...await install(name).then(r => [r.ok, r.detail]));
        }
        catch (e) {
            setNotice(`⚠️ ${String(e)}`);
        }
        finally {
            setBusyRow(null);
        }
    };
    const handleEnable = async (name) => {
        if (!window.confirm(t('confirmEnable').replace('{name}', name)))
            return;
        setBusyRow(name);
        setBusyAction('enable');
        setNotice('');
        try {
            const r = await enable(name);
            setRestartPendingFor(r.ok && r.restartRequired ? name : null);
            await afterMutation(r.ok, r.ok ? (r.restartRequired ? t('enabledRestartHint') : r.detail) : r.detail);
        }
        catch (e) {
            setNotice(`⚠️ ${String(e)}`);
        }
        finally {
            setBusyRow(null);
        }
    };
    const handleDisable = async (name) => {
        if (!window.confirm(t('confirmDisable').replace('{name}', name)))
            return;
        setBusyRow(name);
        setBusyAction('disable');
        setNotice('');
        try {
            const r = await disable(name);
            setRestartPendingFor(r.ok && r.restartRequired ? name : null);
            await afterMutation(r.ok, r.ok ? (r.restartRequired ? t('disabledRestartHint') : r.detail) : r.detail);
        }
        catch (e) {
            setNotice(`⚠️ ${String(e)}`);
        }
        finally {
            setBusyRow(null);
        }
    };
    const handleUninstall = async (name) => {
        if (!window.confirm(t('confirmUninstall').replace('{name}', name)))
            return;
        setBusyRow(name);
        setBusyAction('uninstall');
        setNotice('');
        try {
            await afterMutation(...await uninstall(name).then(r => [r.ok, r.detail]));
        }
        catch (e) {
            setNotice(`⚠️ ${String(e)}`);
        }
        finally {
            setBusyRow(null);
        }
    };
    const handleAssess = async (name) => {
        setBusyRow(name);
        setBusyAction('assess');
        setNotice('');
        try {
            const result = await assess(name);
            if (result.status === 'reported')
                setNotice(`✅ ${result.detail}（风险分 ${result.risk_score ?? '—'}/100）`);
            else if (result.status === 'pending')
                setNotice(`ℹ️ ${result.detail}`);
            else
                setNotice(`⚠️ ${result.detail}`);
        }
        catch (e) {
            setNotice(`⚠️ ${String(e)}`);
        }
        finally {
            setBusyRow(null);
        }
    };
    /** 行级 busy：只有与当前操作行匹配的行显示进行中。 */
    const busyFor = (name) => {
        if (busyRow !== name)
            return null;
        return {
            installing: busyAction === 'install',
            enabling: busyAction === 'enable',
            disabling: busyAction === 'disable',
            uninstalling: busyAction === 'uninstall',
            assessing: busyAction === 'assess',
        };
    };
    // 已安装视图：优先用 lifecycle(带状态),回退到 sources 展开
    // 行元数据优先取 catalog 缓存(星数/简介),catalog 没有时用依赖名兜底
    const catalogOf = (name) => allPlugins?.find(p => p.full_name === name);
    const lifecycleRows = lifecycleState
        ? Object.entries(lifecycleState.items).map(([name, life]) => {
            const cat = catalogOf(name);
            const desc = cat?.zh_desc ?? cat?.description ?? life.installedName ?? name;
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
            };
        })
        : [];
    const installedRows = lifecycleRows.length > 0
        ? lifecycleRows
        : (installedState
            ? Object.entries(installedState.sources).map(([dep, src]) => {
                const repo = src.includes('/') && !src.startsWith('@') ? src : dep;
                const cat = catalogOf(repo);
                const desc = cat?.zh_desc ?? cat?.description ?? dep;
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
                };
            })
            : []);
    const counts = browseState.status === 'ready' ? browseState.result.counts : null;
    return (_jsxs("div", { className: css.wrap, children: [_jsxs("div", { className: css.introRow, children: [_jsx("p", { className: css.intro, children: t('intro') }), _jsxs("a", { className: css.mydshLink, href: mydshLink, target: "_blank", rel: "noopener", children: ["\uD83C\uDF10 mydsh.dev ", _jsx("span", { "data-i18n": "market_site", children: "\u63D2\u4EF6\u5927\u5168" }), " \u2197"] })] }), _jsxs("div", { className: css.tabs, children: [_jsx("button", { type: "button", className: view === 'browse' ? `${css.tab} ${css.tabActive}` : css.tab, onClick: () => switchView('browse'), children: t('browseTab') }), _jsx("button", { type: "button", className: view === 'search' ? `${css.tab} ${css.tabActive}` : css.tab, onClick: () => switchView('search'), children: t('searchTab') }), _jsxs("button", { type: "button", className: view === 'installed' ? `${css.tab} ${css.tabActive}` : css.tab, onClick: () => switchView('installed'), children: [t('installedTab'), lifecycleState ? `（${Object.keys(lifecycleState.items).length}）` : installedState ? `（${installedState.installed.length}）` : ''] })] }), notice !== '' ? _jsx("p", { className: css.notice, children: notice }) : null, restartPendingFor !== null && !restarting ? (_jsxs("div", { className: css.restartRow, children: [_jsx("span", { className: css.restartHint, children: lifecycleState?.canAutoRestart === false
                            ? t('restartCap_manual')
                            : t(`restartCap_${lifecycleState?.restartCapability ?? 'pm2'}`) }), lifecycleState?.canAutoRestart !== false ? (_jsx("button", { type: "button", className: css.btnRestart, onClick: () => void handleRestartNow(), children: t('restartNow') })) : null] })) : null, restarting ? (_jsxs("div", { className: css.restartRow, children: [_jsx("span", { className: css.restartHint, children: t('restarting') }), _jsx("span", { className: css.restartSpinner, children: "\u23F3" })] })) : null, view === 'browse' ? (_jsxs(_Fragment, { children: [_jsx("div", { className: css.catChips, children: CATEGORY_LABEL_KEYS.map(id => (_jsxs("button", { type: "button", className: category === id ? `${css.catChip} ${css.catChipActive}` : css.catChip, onClick: () => { setCategory(id); void runBrowse(id); }, children: [t(`cat_${id}`), counts && id !== 'all' ? ` ${counts[id] ?? 0}` : ''] }, id))) }), browseState.status === 'loading' ? _jsx("p", { className: css.empty, children: t('loading') }) : null, browseState.status === 'error' ? _jsxs("p", { className: css.error, children: [t('errLoad'), "\uFF1A", browseState.message] }) : null, browseState.status === 'ready' ? (_jsxs("div", { className: css.results, children: [browseState.result.plugins.length === 0 ? (_jsx("p", { className: css.empty, children: t('emptyResult') })) : (browseState.result.plugins.map(p => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t))), allPlugins !== null && browseState.result.plugins.length < filteredList(browseState.result.category).length ? (_jsxs("button", { type: "button", className: css.btnMore, onClick: loadMore, children: [t('loadMore'), "\uFF08", browseState.result.plugins.length, "/", filteredList(browseState.result.category).length, "\uFF09"] })) : null] })) : null] })) : null, view === 'search' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.searchRow, children: [_jsx("input", { className: css.searchInput, type: "search", placeholder: t('searchPh'), value: query, onChange: e => setQuery(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                    void runSearch(query, useAi); } }), _jsx("button", { type: "button", className: css.btnSearch, onClick: () => void runSearch(query, useAi), children: useAi ? t('aiSearchBtn') : t('searchBtn') }), _jsxs("label", { className: css.aiToggle, children: [_jsx("input", { type: "checkbox", checked: useAi, onChange: e => setUseAi(e.target.checked) }), "\uD83E\uDD16 AI"] })] }), searchState.status === 'idle' ? _jsx("p", { className: css.empty, children: t('empty') }) : null, searchState.status === 'loading' ? _jsx("p", { className: css.empty, children: t('searching') }) : null, searchState.status === 'error' ? _jsxs("p", { className: css.error, children: [t('errLoad'), "\uFF1A", searchState.message] }) : null, searchState.status === 'ready' ? (_jsxs("div", { className: css.results, children: [searchState.result.local.length > 0 ? (_jsxs("section", { children: [_jsxs("h3", { className: css.sectionH, children: [t('localTab'), "\uFF08", searchState.result.local.length, "\uFF09"] }), searchState.result.local.map(p => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t))] })) : null, searchState.result.ai.length > 0 ? (_jsxs("section", { children: [_jsxs("h3", { className: css.sectionH, children: [t('aiTab'), "\uFF08", searchState.result.ai.length, "\uFF09"] }), searchState.result.ai.map(p => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t))] })) : null, searchState.result.local.length === 0 && searchState.result.ai.length === 0 ? (_jsx("p", { className: css.empty, children: t('emptyResult') })) : null] })) : null] })) : null, view === 'installed' ? (_jsxs("div", { className: css.results, children: [installedRows.length === 0 ? _jsx("p", { className: css.empty, children: t('noInstalled') }) : null, installedRows.map(p => {
                        const st = statusOf(p.full_name);
                        const reason = reasonOf(p.full_name);
                        const failed = lastErrorOf(p.full_name);
                        return (_jsxs("div", { children: [PluginRow(p, st, busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t), reason ? _jsx("p", { className: css.rowNote, children: reason }) : null, failed ? _jsxs("p", { className: css.rowNote, children: [t('failedHint'), ": ", failed.slice(0, 160)] }) : null] }, p.full_name));
                    })] })) : null] }));
}
