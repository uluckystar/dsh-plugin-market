import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** 插件市场设置页 tab：分类浏览 / 搜索（本地+AI）/ 已安装管理 + mydsh.dev 引流。 */
import { useEffect, useState } from 'react';
import css from './MarketTab.module.css';
/** 分类列表（id → 标签 key）。 */
const CATEGORY_LABEL_KEYS = ['all', 'agent', 'mcp', 'devtools', 'ui', 'vision', 'llm', 'memory', 'data', 'integrations', 'other'];
/** 渲染一个插件行（带安装/卸载/评估 + mydsh 详情引流）。 */
function PluginRow(p, busy, onInstall, onUninstall, onAssess, t) {
    const desc = p.zh_desc ?? p.en_desc ?? p.description ?? t('noDesc');
    // 只有 owner/repo 格式（非依赖名）才可跳 mydsh 详情页
    const isRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.full_name);
    return (_jsxs("div", { className: css.row, children: [_jsxs("div", { className: css.rowMain, children: [_jsxs("div", { className: css.rowName, children: [p.full_name, p.installed ? _jsx("span", { className: css.tagInstalled, children: t('installedTag') }) : null] }), _jsx("div", { className: css.rowDesc, children: desc }), _jsxs("div", { className: css.rowMeta, children: [_jsxs("span", { children: ["\u2605 ", p.stargazers_count.toLocaleString()] }), p.language ? _jsxs("span", { children: ["\u00B7 ", p.language] }) : null, isRepo ? (_jsx("a", { className: css.rowLink, href: `https://mydsh.dev/plugin?repo=${encodeURIComponent(p.full_name)}`, target: "_blank", rel: "noopener", children: "mydsh.dev \u2197" })) : null] })] }), _jsxs("div", { className: css.rowActions, children: [p.installed ? (_jsx("button", { type: "button", className: css.btnUninstall, disabled: busy?.uninstalling === true, onClick: () => onUninstall(p.full_name), children: busy?.uninstalling ? t('uninstalling') : t('uninstall') })) : (_jsx("button", { type: "button", className: css.btnInstall, disabled: busy?.installing === true, onClick: () => onInstall(p.full_name), children: busy?.installing ? t('installing') : t('install') })), _jsx("button", { type: "button", className: css.btnAssess, disabled: busy?.assessing === true, onClick: () => onAssess(p.full_name), children: busy?.assessing ? t('assessing') : t('assess') })] })] }));
}
/** Render the plugin market Settings tab. */
export function MarketTab({ search, browse, install, uninstall, assess, installed, t }) {
    const [view, setView] = useState('browse');
    const [category, setCategory] = useState('all');
    const [query, setQuery] = useState('');
    const [useAi, setUseAi] = useState(false);
    const [browseState, setBrowseState] = useState({ status: 'idle' });
    const [searchState, setSearchState] = useState({ status: 'idle' });
    const [installedState, setInstalledState] = useState(null);
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
    const runBrowse = async (cat) => {
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
            setAllPlugins(result.plugins);
            setAllCounts(result.counts);
            setVisibleCount(PAGE);
            const list = cat === 'all' ? result.plugins : result.plugins.filter(p => categoryOf(p) === cat);
            setBrowseState({ status: 'ready', result: { ...result, category: cat, plugins: list.slice(0, PAGE) } });
        }
        catch (e) {
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
    /** 前端分类判断（与后端一致）。 */
    function categoryOf(p) {
        const topics = new Set((p.topics ?? []).map(t => t.toLowerCase()));
        const RULES = [
            ['agent', 'agent', 'ai-agent', 'agent-skills', 'multi-agent', 'autonomous', 'team', 'crew', 'orchestration'],
            ['mcp', 'mcp', 'model-context-protocol', 'mcp-server', 'mcp-client'],
            ['devtools', 'developer-tools', 'cli', 'command-line', 'terminal', 'vscode', 'neovim', 'ide', 'sdk', 'tooling', 'debugger', 'tui'],
            ['ui', 'ui', 'gui', 'dashboard', 'desktop', 'electron', 'web-ui', 'frontend', 'interface', 'webapp', 'react'],
            ['vision', 'vision', 'image', 'video', 'multimodal', 'ocr', 'screenshot', 'computer-vision', 'audio'],
            ['llm', 'llm', 'language-model', 'prompt', 'chat', 'openai', 'anthropic', 'gemini', 'claude', 'codex', 'reasoning', 'inference'],
            ['memory', 'memory', 'knowledge', 'rag', 'vector', 'retrieval', 'search', 'notes', 'semantic'],
            ['data', 'data', 'database', 'storage', 'sql', 'postgres', 'redis', 'sqlite', 'csv', 'excel'],
            ['integrations', 'integration', 'api', 'webhook', 'github', 'slack', 'discord', 'telegram', 'notion', 'obsidian', 'chrome', 'browser', 'google', 'jira', 'linear', 'gitlab'],
        ];
        for (const [id, ...ts] of RULES) {
            if (ts.some(t => topics.has(t)))
                return id;
        }
        return 'other';
    }
    const runSearch = async (q, ai) => {
        const queryText = q.trim();
        if (queryText.length === 0)
            return;
        setSearchState({ status: 'loading' });
        setNotice('');
        try {
            const result = await search(queryText, ai);
            setSearchState({ status: 'ready', result });
        }
        catch (e) {
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
    // 首次进入：默认浏览「全部」+ 拉已安装
    useEffect(() => {
        void runBrowse('all');
        void loadInstalled();
    }, []);
    const switchView = (v) => {
        setView(v);
        setNotice('');
        if (v === 'browse')
            void runBrowse(category);
        if (v === 'installed')
            void loadInstalled();
    };
    const afterMutation = async (ok, detail) => {
        setNotice(ok ? detail : `⚠️ ${detail.slice(0, 200)}`);
        // 刷新已安装状态 + 当前视图
        await loadInstalled();
        if (view === 'browse')
            void runBrowse(category);
    };
    const handleInstall = async (name) => {
        setBusyRow(name);
        setBusyAction('install');
        setNotice('');
        try {
            await afterMutation(...await install(name).then(r => [r.ok, r.ok ? t('restartHint') : r.detail]));
        }
        catch (e) {
            setNotice(`⚠️ ${String(e)}`);
        }
        finally {
            setBusyRow(null);
        }
    };
    const handleUninstall = async (name) => {
        setBusyRow(name);
        setBusyAction('uninstall');
        setNotice('');
        try {
            await afterMutation(...await uninstall(name).then(r => [r.ok, r.ok ? t('uninstalledHint') : r.detail]));
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
            uninstalling: busyAction === 'uninstall',
            assessing: busyAction === 'assess',
        };
    };
    // 已安装视图：按 sources 展开成行（仓库名 + 依赖名）
    const installedRows = installedState
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
        : [];
    const counts = browseState.status === 'ready' ? browseState.result.counts : null;
    return (_jsxs("div", { className: css.wrap, children: [_jsxs("div", { className: css.introRow, children: [_jsx("p", { className: css.intro, children: t('intro') }), _jsxs("a", { className: css.mydshLink, href: mydshLink, target: "_blank", rel: "noopener", children: ["\uD83C\uDF10 mydsh.dev ", _jsx("span", { "data-i18n": "market_site", children: "\u63D2\u4EF6\u5927\u5168" }), " \u2197"] })] }), _jsxs("div", { className: css.tabs, children: [_jsx("button", { type: "button", className: view === 'browse' ? `${css.tab} ${css.tabActive}` : css.tab, onClick: () => switchView('browse'), children: t('browseTab') }), _jsx("button", { type: "button", className: view === 'search' ? `${css.tab} ${css.tabActive}` : css.tab, onClick: () => switchView('search'), children: t('searchTab') }), _jsxs("button", { type: "button", className: view === 'installed' ? `${css.tab} ${css.tabActive}` : css.tab, onClick: () => switchView('installed'), children: [t('installedTab'), installedState ? `（${installedState.installed.length}）` : ''] })] }), notice !== '' ? _jsx("p", { className: css.notice, children: notice }) : null, view === 'browse' ? (_jsxs(_Fragment, { children: [_jsx("div", { className: css.catChips, children: CATEGORY_LABEL_KEYS.map(id => (_jsxs("button", { type: "button", className: category === id ? `${css.catChip} ${css.catChipActive}` : css.catChip, onClick: () => { setCategory(id); void runBrowse(id); }, children: [t(`cat_${id}`), counts && id !== 'all' ? ` ${counts[id] ?? 0}` : ''] }, id))) }), browseState.status === 'loading' ? _jsx("p", { className: css.empty, children: t('loading') }) : null, browseState.status === 'error' ? _jsxs("p", { className: css.error, children: [t('errLoad'), "\uFF1A", browseState.message] }) : null, browseState.status === 'ready' ? (_jsxs("div", { className: css.results, children: [browseState.result.plugins.length === 0 ? (_jsx("p", { className: css.empty, children: t('emptyResult') })) : (browseState.result.plugins.map(p => PluginRow(p, busyFor(p.full_name), handleInstall, handleUninstall, handleAssess, t))), allPlugins !== null && browseState.result.plugins.length < filteredList(browseState.result.category).length ? (_jsxs("button", { type: "button", className: css.btnMore, onClick: loadMore, children: [t('loadMore'), "\uFF08", browseState.result.plugins.length, "/", filteredList(browseState.result.category).length, "\uFF09"] })) : null] })) : null] })) : null, view === 'search' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.searchRow, children: [_jsx("input", { className: css.searchInput, type: "search", placeholder: t('searchPh'), value: query, onChange: e => setQuery(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                    void runSearch(query, useAi); } }), _jsx("button", { type: "button", className: css.btnSearch, onClick: () => void runSearch(query, useAi), children: useAi ? t('aiSearchBtn') : t('searchBtn') }), _jsxs("label", { className: css.aiToggle, children: [_jsx("input", { type: "checkbox", checked: useAi, onChange: e => setUseAi(e.target.checked) }), "\uD83E\uDD16 AI"] })] }), searchState.status === 'idle' ? _jsx("p", { className: css.empty, children: t('empty') }) : null, searchState.status === 'loading' ? _jsx("p", { className: css.empty, children: t('searching') }) : null, searchState.status === 'error' ? _jsxs("p", { className: css.error, children: [t('errLoad'), "\uFF1A", searchState.message] }) : null, searchState.status === 'ready' ? (_jsxs("div", { className: css.results, children: [searchState.result.local.length > 0 ? (_jsxs("section", { children: [_jsxs("h3", { className: css.sectionH, children: [t('localTab'), "\uFF08", searchState.result.local.length, "\uFF09"] }), searchState.result.local.map(p => PluginRow(p, busyFor(p.full_name), handleInstall, handleUninstall, handleAssess, t))] })) : null, searchState.result.ai.length > 0 ? (_jsxs("section", { children: [_jsxs("h3", { className: css.sectionH, children: [t('aiTab'), "\uFF08", searchState.result.ai.length, "\uFF09"] }), searchState.result.ai.map(p => PluginRow(p, busyFor(p.full_name), handleInstall, handleUninstall, handleAssess, t))] })) : null, searchState.result.local.length === 0 && searchState.result.ai.length === 0 ? (_jsx("p", { className: css.empty, children: t('emptyResult') })) : null] })) : null] })) : null, view === 'installed' ? (_jsxs("div", { className: css.results, children: [installedRows.length === 0 ? _jsx("p", { className: css.empty, children: t('noInstalled') }) : null, installedRows.map(p => PluginRow(p, busyFor(p.full_name), handleInstall, handleUninstall, handleAssess, t))] })) : null] }));
}
