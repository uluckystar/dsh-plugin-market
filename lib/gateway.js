/**
 * 插件市场宿主席位：PluginMarketGateway。
 * - search：从 mydsh.dev 拉插件大全缓存 + 本地检索；AI 推荐走 mydsh.dev AI 搜索
 * - install：一键安装（在当前 profile 目录跑 pnpm add github:owner/repo）
 * - assess：提交安全评估到 mydsh.dev
 * - installed：读当前 profile 的 package.json dependencies 判断已装
 */
import { exec as execCallback, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { Service } from '@deepseek-ai/cordis';
import { ProxyAgent } from 'undici';
import s from '@deepseek-ai/schemastery';
import { CORE_BUNDLE_WHITELIST, addBundle, manifestDeclaresProfileBundle, packageDeclaresProfileBundle, patchConflictIds, patchEntryIds, readProfile, removeBundle, } from "./profile-ops.js";
import { MARKET_CATEGORIES, categoryOf, } from "./types.js";
const execAsync = promisify(execCallback);
const VALIDATED_CACHE_FILE = 'plugin_market_validated_bundle_v1.json';
const VALIDATION_CONCURRENCY = 16;
/** 父进程名(跨平台):Linux 读 /proc,其余用 ps。失败返回空串(安全兜底:视为无监督者)。 */
function parentProcessName(ppid) {
    try {
        if (process.platform === 'linux') {
            return readFileSync(`/proc/${ppid}/comm`, 'utf8').trim();
        }
        if (process.platform === 'darwin' || process.platform === 'freebsd') {
            return execFileSync('ps', ['-o', 'comm=', '-p', String(ppid)], { encoding: 'utf8', timeout: 3000 }).trim();
        }
        return '';
    }
    catch {
        return '';
    }
}
/** 脱敏代理地址：不打印 user:pass 凭据（保留协议/主机/端口）。 */
function maskProxyUrl(url) {
    if (url === '')
        return '';
    try {
        const u = new URL(url);
        const auth = u.username !== '' || u.password !== '' ? '***:***@' : '';
        return `${u.protocol}//${auth}${u.host}${u.pathname}${u.search}`;
    }
    catch {
        return url.replace(/\/\/[^@/]+@/, '//***:***@');
    }
}
function friendlyOperationError(error, action) {
    const text = error instanceof Error ? error.message : String(error);
    if (/404|not found|repository not found|could not find/i.test(text))
        return '未找到可安装版本，请确认插件地址。';
    if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|network/i.test(text))
        return '网络或下载失败，请检查网络后重试。';
    switch (action) {
        case 'install': return '安装失败，请稍后重试。';
        case 'uninstall': return '卸载失败，请稍后重试。';
        case 'enable': return '启用失败，请稍后重试。';
        case 'disable': return '停用失败，请稍后重试。';
    }
}
/** 检索关键词切分。 */
function tokenize(s) {
    return (s.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? []);
}
/** 本地相关度打分（名称/双语描述/topics/星数）。 */
function scorePlugin(p, tokens) {
    let score = 0;
    const name = (p.full_name ?? '').toLowerCase();
    const zh = p.zh_desc ?? '';
    const en = p.en_desc ?? '';
    const desc = (p.description ?? '').toLowerCase();
    const tags = (p.topics ?? []).join(' ').toLowerCase();
    for (const t of tokens) {
        if (name.includes(t))
            score += 5;
        if (zh.includes(t))
            score += 4;
        if (en.includes(t))
            score += 4;
        if (desc.includes(t))
            score += 3;
        if (tags.includes(t))
            score += 3;
    }
    score += Math.log1p(p.stargazers_count ?? 0) * 0.5;
    return score;
}
/** 插件市场服务：检索 + 安装 + 安全评估 + 已装清单。 */
export class PluginMarketGateway extends Service {
    static inject = ['webServer'];
    /** Loader 校验的部署配置。 */
    static Config = s.object({
        marketBaseUrl: s.string().default('https://mydsh.dev'),
        profileName: s.string().default('web'),
        catalogCacheMs: s.number().step(1).min(1000).default(6 * 60 * 60 * 1000),
        installTimeoutMs: s.number().step(1).min(5000).default(300 * 1000),
        pnpmCommand: s.string().default('npx -y pnpm@11.7.0'),
        proxyUrl: s.string().default('http://127.0.0.1:7897'),
        githubToken: s.string().default(''),
    });
    config;
    /** GitHub/外部请求代理：Node fetch 默认不读取 HTTP_PROXY，这里显式接入。 */
    fetchDispatcher;
    /** 插件大全内存缓存（6 小时失效，增量更新：网站每小时刷新，这里每 6 小时同步一次）。 */
    catalogCache = null;
    /** 磁盘缓存路径（重启不丢，避免每次启动重新拉 2MB）。 */
    catalogDiskPath;
    /** 生命周期故障记录（安装失败等,full_name → 上次错误)。 */
    lifecycleDiskPath;
    lifecycleFailures = {};
    /** 当前进程已加载的模块名集合(用于「已生效」判断)。 */
    loadedModuleNames = new Set();
    constructor(ctx, config) {
        super(ctx, 'pluginMarket');
        console.log(`[plugin-market] 构造 config: catalogCacheMs=${config?.catalogCacheMs}, marketBaseUrl=${config?.marketBaseUrl}, profileName=${config?.profileName}, pnpmCommand=${config?.pnpmCommand}, proxyUrl=${maskProxyUrl(config?.proxyUrl ?? '')}`);
        // config 兜底默认值：cordis patch 未合并时也能正常工作
        this.config = {
            marketBaseUrl: config?.marketBaseUrl ?? 'https://mydsh.dev',
            profileName: config?.profileName ?? 'web',
            catalogCacheMs: config?.catalogCacheMs ?? 6 * 60 * 60 * 1000,
            installTimeoutMs: config?.installTimeoutMs ?? 300 * 1000,
            pnpmCommand: config?.pnpmCommand ?? 'npx -y pnpm@11.7.0',
            proxyUrl: config?.proxyUrl ?? 'http://127.0.0.1:7897',
            githubToken: config?.githubToken || process.env.PLUGIN_MARKET_GH_TOKEN || '',
        };
        const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
        const safeProfile = this.config.profileName.replace(/[^A-Za-z0-9_.-]/g, '_');
        this.catalogDiskPath = join(base, 'storages', 'plugin_market_catalog.json');
        this.validatedDiskPath = join(base, 'storages', VALIDATED_CACHE_FILE);
        this.lifecycleDiskPath = join(base, 'storages', `plugin_market_lifecycle_${safeProfile}.json`);
        this.fetchDispatcher = this.config.proxyUrl !== '' ? new ProxyAgent(this.config.proxyUrl) : undefined;
        this.loadValidated();
        this.loadLifecycleFailures();
        // 采样当前进程已加载模块(Loader 入口的 moduleName),用于「已启用且已生效」判定。
        try {
            const inventory = ctx.get('pluginInventory');
            if (inventory !== undefined) {
                for (const entry of inventory.list().entries) {
                    if (entry.enabled !== false && entry.fiberPhase === 'active')
                        this.loadedModuleNames.add(entry.moduleName);
                }
            }
        }
        catch { /* inventory 缺席时按「需重启」处理 */ }
        this.ctx.effect(() => {
            const disposers = makeRoutes(this).map(route => this.ctx.webServer.register(route));
            return () => { for (const d of disposers)
                d(); };
        }, 'plugin-market: routes');
    }
    /** 插件大全：内存缓存 → 磁盘缓存 → 网络拉取（TTL 内零网络请求）。 */
    async catalog() {
        const now = Date.now();
        if (this.catalogCache && now - this.catalogCache.at < this.config.catalogCacheMs) {
            console.log(`[plugin-market] catalog 内存缓存命中 (${this.catalogCache.plugins.length} 个, ${Math.round((now - this.catalogCache.at) / 1000)}s 前)`);
            return this.catalogCache.plugins;
        }
        // 磁盘缓存（重启后免重新拉取）
        try {
            if (existsSync(this.catalogDiskPath)) {
                const disk = JSON.parse(readFileSync(this.catalogDiskPath, 'utf8'));
                if (now - disk.at < this.config.catalogCacheMs && Array.isArray(disk.plugins) && disk.plugins.length > 0) {
                    this.catalogCache = { at: disk.at, plugins: disk.plugins };
                    console.log(`[plugin-market] catalog 磁盘缓存命中 (${disk.plugins.length} 个, ${Math.round((now - disk.at) / 1000)}s 前)`);
                    return disk.plugins;
                }
            }
        }
        catch (e) {
            console.log(`[plugin-market] 磁盘缓存读取失败: ${String(e)}`);
        }
        console.log('[plugin-market] catalog 网络拉取…');
        const resp = await fetch(`${this.config.marketBaseUrl}/assets/plugins.json`, {
            headers: { 'user-agent': 'dsh-plugin-market/0.1 (+https://mydsh.dev)' },
        });
        if (!resp.ok)
            throw new Error(`插件大全拉取失败：${resp.status}`);
        const data = await resp.json();
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
        }));
        this.catalogCache = { at: now, plugins };
        // 写磁盘缓存（失败静默，不影响使用）
        try {
            mkdirSync(join(this.catalogDiskPath, '..'), { recursive: true });
            writeFileSync(this.catalogDiskPath, JSON.stringify({ at: now, plugins }), 'utf8');
        }
        catch { /* ignore */ }
        // 后台启动插件有效性校验（非 DSH 插件从列表过滤）
        void this.startValidation(plugins);
        return plugins;
    }
    // ===== 插件有效性校验（防非 DSH 插件混入列表）=====
    /** 校验结果缓存（磁盘）：只信任 bundle-patch-v1 新缓存；旧 topic 快速通道缓存不再读取。 */
    validatedCache = {};
    /** 校验是否已在跑。 */
    validating = false;
    /** 校验磁盘路径。 */
    validatedDiskPath;
    /** fetch options：Node fetch 不会自动读取 HTTP_PROXY，外部请求必须显式 dispatcher。 */
    fetchOptions(headers, signal) {
        const init = { headers };
        if (signal !== undefined)
            init.signal = signal;
        if (this.fetchDispatcher !== undefined)
            init.dispatcher = this.fetchDispatcher;
        return init;
    }
    /** 拉取仓库 package.json：优先 API(token 可用时)，否则走 raw/HEAD，避免未认证 API 60/h 限流。 */
    async fetchPackageManifest(fullName) {
        const [owner, repo] = fullName.split('/');
        if (!owner || !repo)
            return { status: 'missing' };
        const headers = { 'user-agent': 'dsh-plugin-market/0.1 (+https://mydsh.dev)' };
        if (this.config.githubToken !== '') {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 10000);
                const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, this.fetchOptions({
                    ...headers, authorization: `Bearer ${this.config.githubToken}`,
                }, controller.signal));
                clearTimeout(timer);
                if (resp.status === 404)
                    return { status: 'missing' };
                if (resp.ok) {
                    const body = await resp.json();
                    if (body.content === undefined)
                        return { status: 'missing' };
                    try {
                        return { status: 'ok', manifest: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8').replace(/^\uFEFF/, '')) };
                    }
                    catch {
                        return { status: 'missing' };
                    }
                }
            }
            catch {
                // API 不可用时继续尝试 raw；不要因为 token/限流误杀公开插件。
            }
        }
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`, this.fetchOptions(headers, controller.signal));
            clearTimeout(timer);
            if (resp.status === 404)
                return { status: 'missing' };
            if (!resp.ok)
                return { status: 'unavailable' };
            try {
                return { status: 'ok', manifest: JSON.parse((await resp.text()).replace(/^\uFEFF/, '')) };
            }
            catch {
                return { status: 'missing' };
            }
        }
        catch {
            return { status: 'unavailable' };
        }
    }
    /** 加载已缓存的有效性结果。 */
    loadValidated() {
        try {
            if (existsSync(this.validatedDiskPath)) {
                const disk = JSON.parse(readFileSync(this.validatedDiskPath, 'utf8'));
                this.validatedCache = disk;
            }
        }
        catch { /* ignore */ }
    }
    /** 保存有效性结果到磁盘。 */
    saveValidated() {
        try {
            mkdirSync(join(this.validatedDiskPath, '..'), { recursive: true });
            writeFileSync(this.validatedDiskPath, JSON.stringify(this.validatedCache), 'utf8');
        }
        catch { /* ignore */ }
    }
    /** 后台批量校验：拉每个仓库 package.json，只接受 dsh.bundle.patch。 */
    async startValidation(plugins) {
        if (this.validating)
            return;
        this.validating = true;
        try {
            // 按星数降序（热门优先）；skipped 是上轮网络暂不可用，本轮继续重试。
            const todo = [...plugins]
                .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
                .filter(p => this.validatedCache[p.full_name] !== 'valid' && this.validatedCache[p.full_name] !== 'invalid');
            console.log(`[plugin-market] 开始严格校验 ${todo.length} 个插件… proxy=${this.fetchDispatcher !== undefined ? '已配置' : '未配置'}`);
            let cursor = 0;
            let done = 0;
            const worker = async () => {
                while (cursor < todo.length) {
                    const p = todo[cursor++];
                    if (p === undefined)
                        continue;
                    const result = await this.fetchPackageManifest(p.full_name);
                    if (result.status === 'ok') {
                        this.validatedCache[p.full_name] = manifestDeclaresProfileBundle(result.manifest) ? 'valid' : 'invalid';
                    }
                    else if (result.status === 'missing') {
                        this.validatedCache[p.full_name] = 'invalid';
                    }
                    else {
                        this.validatedCache[p.full_name] = 'skipped';
                    }
                    done++;
                    if (done % 20 === 0)
                        this.saveValidated();
                    await new Promise(r => setTimeout(r, 50));
                }
            };
            const workers = Array.from({ length: Math.min(VALIDATION_CONCURRENCY, Math.max(1, todo.length)) }, () => worker());
            await Promise.all(workers);
            this.saveValidated();
            const valid = Object.values(this.validatedCache).filter(v => v === 'valid').length;
            const invalid = Object.values(this.validatedCache).filter(v => v === 'invalid').length;
            const skipped = Object.values(this.validatedCache).filter(v => v === 'skipped').length;
            console.log(`[plugin-market] 严格校验完成：valid=${valid}, invalid=${invalid}, skipped=${skipped}`);
        }
        finally {
            this.validating = false;
        }
    }
    /** 过滤：只显示已严格确认含 dsh.bundle.patch 的插件；未知/跳过/无效都不展示。 */
    filterValid(plugins) {
        // 磁盘文件由独立脚本 validate-plugins.mjs 更新；这里每次读取保证实时。
        try {
            if (existsSync(this.validatedDiskPath)) {
                const disk = JSON.parse(readFileSync(this.validatedDiskPath, 'utf8'));
                this.validatedCache = disk;
            }
        }
        catch { /* 读取失败用内存缓存 */ }
        return plugins.filter(p => this.validatedCache[p.full_name] === 'valid');
    }
    /** 分类浏览：按分类列出插件（星数降序；limit=0 返回全部），附各分类计数。 */
    async browse(category, limit = 50) {
        const cat = (category ?? '').trim();
        const valid = MARKET_CATEGORIES.some(c => c.id === cat) || cat === 'all';
        const target = valid ? cat : 'all';
        const installed = await this.installedNames();
        const catalog = await this.catalog();
        void this.startValidation(catalog);
        const all = this.filterValid(catalog);
        const counts = { all: all.length };
        for (const c of MARKET_CATEGORIES)
            counts[c.id] = 0;
        for (const p of all) {
            const c = categoryOf(p);
            counts[c] = (counts[c] ?? 0) + 1;
        }
        const list = target === 'all'
            ? all
            : all.filter(p => categoryOf(p) === target);
        const sorted = [...list].sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0));
        const plugins = (limit > 0 ? sorted.slice(0, limit) : sorted)
            .map(p => ({ ...p, installed: installed.has(p.full_name) }));
        return { ok: true, category: target, plugins, counts };
    }
    /** 检索：本地匹配 + 可选 AI 推荐（ai=false 秒回；AI 最多等 6 秒，失败不阻塞）。 */
    async search(query, ai) {
        const q = (query ?? '').trim();
        if (q.length === 0)
            return { ok: true, query: q, local: [], ai: [], total: 0 };
        const installed = await this.installedNames();
        const catalog = await this.catalog();
        void this.startValidation(catalog);
        const all = this.filterValid(catalog);
        const tokens = tokenize(q);
        const scored = all
            .map(p => ({ p, s: scorePlugin(p, tokens) }))
            .filter(x => x.s > 0)
            .sort((a, b) => b.s - a.s)
            .slice(0, 20)
            .map(x => ({ ...x.p, installed: installed.has(x.p.full_name) }));
        // AI 推荐（仅 ai=true 时调用；6 秒超时——AI 慢不阻塞本地结果）
        let aiPicks = [];
        if (ai) {
            try {
                const candidates = all.slice(0, 200).map(p => ({
                    full_name: p.full_name, zh_desc: p.zh_desc ?? '', description: p.description ?? '',
                    language: p.language, stars: p.stargazers_count, html_url: p.html_url,
                }));
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 6000);
                const resp = await fetch(`${this.config.marketBaseUrl}/api/ai-search`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'user-agent': 'dsh-plugin-market/0.1' },
                    body: JSON.stringify({ query: q, candidates, exclude: [] }),
                    signal: controller.signal,
                });
                clearTimeout(timer);
                if (resp.ok) {
                    const text = await resp.text();
                    // 流式输出：累积全部 delta.content 成一个 JSON 行，再统一提取 full_name
                    let acc = '';
                    for (const line of text.split('\n')) {
                        if (!line.startsWith('data:'))
                            continue;
                        const payload = line.slice(5).trim();
                        if (payload === '[DONE]' || payload === '')
                            continue;
                        try {
                            const obj = JSON.parse(payload);
                            const delta = obj.choices?.[0]?.delta?.content;
                            if (typeof delta === 'string')
                                acc += delta;
                        }
                        catch { /* 忽略非内容 chunk */ }
                    }
                    const names = new Set();
                    for (const m of acc.matchAll(/"full_name"\s*:\s*"([^"]+)"/g)) {
                        if (m[1] !== undefined)
                            names.add(m[1]);
                    }
                    if (names.size > 0) {
                        aiPicks = [...names]
                            .map(n => all.find(p => p.full_name === n))
                            .filter((p) => p !== undefined)
                            .map(p => ({ ...p, installed: installed.has(p.full_name) }));
                    }
                }
            }
            catch { /* AI 失败不阻塞 */ }
        }
        return { ok: true, query: q, local: scored, ai: aiPicks, total: scored.length };
    }
    /** 一键安装：先校验仓库是有效 DSH 插件（有 dsh.bundle/client 声明或 cordis.patch.yml），再 pnpm add。 */
    async install(fullName) {
        const started = Date.now();
        const name = (fullName ?? '').trim();
        if (this.validPackageName(name) === null) {
            return { ok: false, fullName: name, detail: '仓库名格式应为 owner/repo', restartRequired: false, durationMs: 0 };
        }
        const dir = this.profileDir();
        if (!dir) {
            return { ok: false, fullName: name, detail: '找不到当前插件配置，请检查 DSH 是否正常启动。', restartRequired: false, durationMs: 0 };
        }
        // ---- 有效性校验：必须是真正可直接启用的 DSH 插件（含 dsh.bundle.patch）----
        const manifest = await this.fetchPackageManifest(name);
        if (manifest.status !== 'ok') {
            if (manifest.status === 'missing') {
                this.validatedCache[name] = 'invalid';
                this.saveValidated();
                return { ok: false, fullName: name, detail: '该仓库缺少可安装信息，暂不能作为 DSH 插件安装。', restartRequired: false, durationMs: 0 };
            }
            return { ok: false, fullName: name, detail: '暂时无法确认该项目是否可安装，请稍后重试。', restartRequired: false, durationMs: Date.now() - started };
        }
        if (!manifestDeclaresProfileBundle(manifest.manifest)) {
            this.validatedCache[name] = 'invalid';
            this.saveValidated();
            return {
                ok: false, fullName: name,
                detail: '该项目不是可直接启用的 DSH 插件，已取消安装。',
                restartRequired: false, durationMs: Date.now() - started,
            };
        }
        this.validatedCache[name] = 'valid';
        this.saveValidated();
        try {
            const spec = `github:${name}`;
            await this.runPnpm(dir, ['add', spec]);
            this.clearInstallFailure(name);
            // 安装只负责「装进来」;是否启用由用户显式操作(见 enable)。
            return {
                ok: true, fullName: name,
                detail: '安装完成。下一步：点击「启用」。',
                restartRequired: false, durationMs: Date.now() - started,
            };
        }
        catch (error) {
            const msg = friendlyOperationError(error, 'install');
            console.log(`[plugin-market] 安装失败 ${name}: ${error instanceof Error ? error.message : String(error)}`);
            this.recordInstallFailure(name, msg);
            return { ok: false, fullName: name, detail: msg, restartRequired: false, durationMs: Date.now() - started };
        }
    }
    /** 卸载：pnpm remove（支持依赖名或 owner/repo 仓库名）。 */
    async uninstall(fullName) {
        const started = Date.now();
        const name = (fullName ?? '').trim();
        if (name.length === 0) {
            return { ok: false, fullName: name, detail: '缺少插件名', restartRequired: false, durationMs: 0 };
        }
        if (this.validPackageName(name) === null) {
            return { ok: false, fullName: name, detail: '插件名不合法', restartRequired: false, durationMs: 0 };
        }
        const dir = this.profileDir();
        if (!dir) {
            return { ok: false, fullName: name, detail: '找不到当前插件配置，请检查 DSH 是否正常启动。', restartRequired: false, durationMs: 0 };
        }
        try {
            // 支持传依赖名（@scope/name）或仓库名（owner/repo）——仓库名先解析成依赖名
            const installed = await this.installedWithSources();
            let depName = name;
            if (name.includes('/') && !name.startsWith('@')) {
                const found = Object.entries(installed.sources).find(([, src]) => src === name);
                if (found)
                    depName = found[0];
            }
            const outcome = await this.enqueueProfileMutation(async () => {
                const removed = await this.runPnpm(dir, ['remove', depName]);
                try {
                    const { backup } = removeBundle(dir, depName);
                    return { removed, backupPath: backup };
                }
                catch {
                    return { removed, backupPath: undefined, bundleError: true };
                }
            });
            this.clearInstallFailure(name);
            if (outcome.bundleError === true) {
                return { ok: true, fullName: name, detail: '已卸载，但状态刷新不完整。请重启 DSH 后检查。', restartRequired: true, durationMs: Date.now() - started };
            }
            return { ok: true, fullName: name, detail: '卸载完成。重启 DSH 后移除。', restartRequired: true, durationMs: Date.now() - started, backupPath: outcome.backupPath };
        }
        catch (error) {
            console.log(`[plugin-market] 卸载失败 ${name}: ${error instanceof Error ? error.message : String(error)}`);
            return { ok: false, fullName: name, detail: friendlyOperationError(error, 'uninstall'), restartRequired: false, durationMs: Date.now() - started };
        }
    }
    /** 在 profile 目录跑 pnpm（走代理 + 匹配版本），返回输出摘要。 */
    async runPnpm(dir, args) {
        const quoted = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
        const cmd = `${this.config.pnpmCommand} ${quoted}`;
        const env = { ...process.env };
        if (this.config.proxyUrl !== '') {
            env.HTTPS_PROXY = this.config.proxyUrl;
            env.HTTP_PROXY = this.config.proxyUrl;
        }
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: dir, timeout: this.config.installTimeoutMs, maxBuffer: 4 * 1024 * 1024, shell: '/bin/sh', env,
        });
        return [stdout, stderr].map(t => t.trim()).filter(t => t !== '').join('\n').slice(-1500);
    }
    /** 提交安全评估到 mydsh.dev。 */
    async assess(fullName) {
        const name = (fullName ?? '').trim();
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) {
            return { ok: false, fullName: name, status: 'error', detail: '仓库名格式应为 owner/repo' };
        }
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(`${this.config.marketBaseUrl}/api/security/list`, {
                headers: { 'user-agent': 'dsh-plugin-market/0.1' },
                signal: controller.signal,
            });
            clearTimeout(timer);
            const data = await resp.json();
            const existing = (data.reports ?? []).find(r => r.full_name === name);
            if (existing) {
                return {
                    ok: true, fullName: name, status: 'reported', detail: '已有正式安全报告',
                    risk_score: existing.risk_score,
                };
            }
            // 无报告：引导用户到网页提交（Turnstile 人机验证无法在服务端模拟）
            return {
                ok: true, fullName: name, status: 'pending',
                detail: `该仓库暂无安全报告。请到 ${this.config.marketBaseUrl}/plugins 的「安全报告」tab 提交（需人机验证），提交后会自动评估并邮件通知维护者。`,
            };
        }
        catch (error) {
            return { ok: false, fullName: name, status: 'error', detail: `安全评估服务暂不可用：${error instanceof Error ? error.message : String(error)}` };
        }
    }
    /** 已安装依赖及其来源仓库名（依赖名 → github:owner/repo 解析）。 */
    async installedWithSources() {
        const names = new Set();
        const sources = {};
        const dir = this.profileDir();
        if (!dir)
            return { names, sources };
        try {
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            const deps = pkg.dependencies ?? {};
            for (const [dep, spec] of Object.entries(deps)) {
                // git/github 规格：github:owner/repo 或 git+https://github.com/owner/repo.git
                const m = /(?:github:([^#]+)|github\.com\/([^#/]+\/[^#/.]+))/.exec(spec);
                const ownerRepo = m ? (m[1] ?? m[2])?.replace(/\.git$/, '') : null;
                if (ownerRepo) {
                    names.add(ownerRepo);
                    sources[dep] = ownerRepo;
                }
                else if (dep.startsWith('@deepseek-ai/dsh-') || dep.startsWith('dsh-')) {
                    names.add(dep);
                    sources[dep] = dep;
                }
            }
        }
        catch { /* package.json 缺失时返回空 */ }
        return { names, sources };
    }
    /** 已安装插件名集合（owner/repo 或依赖名）。 */
    async installedNames() {
        return (await this.installedWithSources()).names;
    }
    /** 已安装清单（供 UI 展示：依赖名 + 来源仓库名）。 */
    async installed() {
        const { names, sources } = await this.installedWithSources();
        return { ok: true, profile: this.config.profileName, installed: [...names], sources };
    }
    /** 当前 profile 目录。 */
    profileDir() {
        const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
        const dir = join(base, 'profiles', this.config.profileName);
        return existsSync(dir) ? dir : null;
    }
    // ===== 插件生命周期(生产化)=====
    /** 加载历史安装失败记录。 */
    loadLifecycleFailures() {
        try {
            if (existsSync(this.lifecycleDiskPath)) {
                this.lifecycleFailures = JSON.parse(readFileSync(this.lifecycleDiskPath, 'utf8'));
            }
        }
        catch { /* 损坏视为空 */ }
    }
    /** 记录一次安装失败(写入磁盘,重启后仍可见)。 */
    recordInstallFailure(fullName, error) {
        this.lifecycleFailures[fullName] = error.slice(0, 400);
        try {
            mkdirSync(join(this.lifecycleDiskPath, '..'), { recursive: true });
            writeFileSync(this.lifecycleDiskPath, JSON.stringify(this.lifecycleFailures, null, 2), 'utf8');
        }
        catch { /* 记录失败不阻塞 */ }
    }
    /** 清除安装失败记录(安装成功后)。 */
    clearInstallFailure(fullName) {
        if (this.lifecycleFailures[fullName] === undefined)
            return;
        delete this.lifecycleFailures[fullName];
        try {
            writeFileSync(this.lifecycleDiskPath, JSON.stringify(this.lifecycleFailures, null, 2), 'utf8');
        }
        catch { /* ignore */ }
    }
    /** 包名合法字符(防 shell 注入;enable/disable/uninstall 的输入必经此校验)。 */
    static PACKAGE_NAME_RE = /^[A-Za-z0-9@/._-]+$/;
    /** 校验输入为合法包名/仓库名,不合法返回 null。 */
    validPackageName(name) {
        return PluginMarketGateway.PACKAGE_NAME_RE.test(name) ? name : null;
    }
    /** profile 写操作串行链:install/enable/disable/uninstall 排队执行,杜绝并发写 package.json。 */
    profileMutations = Promise.resolve();
    /** 排队一个会写 profile 的操作(与 pnpm 子进程写互斥)。 */
    enqueueProfileMutation(op) {
        const run = this.profileMutations.then(op, op);
        this.profileMutations = run.then(() => undefined, () => undefined);
        return run;
    }
    /** 依赖名 → 已安装插件目录(node_modules 下,可能为 link 包)。 */
    installedPackageDir(depName) {
        const dir = this.profileDir();
        if (!dir)
            return null;
        const pkgDir = join(dir, 'node_modules', depName);
        return existsSync(join(pkgDir, 'package.json')) ? pkgDir : null;
    }
    /** 是否可作为 profile 启用层安全加载。 */
    isLoadableBundle(depName) {
        const pluginDir = this.installedPackageDir(depName);
        return pluginDir !== null && packageDeclaresProfileBundle(pluginDir);
    }
    /** 当前运行中已经生效的插件模块名。 */
    activeModuleNames() {
        try {
            const inventory = this.ctx.get('pluginInventory');
            if (inventory !== undefined) {
                const active = new Set();
                for (const entry of inventory.list().entries) {
                    if (entry.enabled !== false && entry.fiberPhase === 'active')
                        active.add(entry.moduleName);
                }
                return active;
            }
        }
        catch { /* inventory 缺席时使用启动快照 */ }
        return new Set(this.loadedModuleNames);
    }
    /**
     * 当前已存在的 entry id:优先取运行中 Loader 的真实清单,并补充源码内置
     * base/web-app patch。这样既能捕获 dsh-TUI 这类重复入口,又不依赖
     * profile/node_modules 是否安装了官方 bundle 包。
     */
    coreEntryIds() {
        const ids = new Set();
        try {
            const inventory = this.ctx.get('pluginInventory');
            if (inventory !== undefined) {
                for (const entry of inventory.list().entries)
                    ids.add(String(entry.entryId));
            }
        }
        catch { /* inventory 缺席时走文件兜底 */ }
        // 文件兜底:本地开发版 dsh-web 的 cwd 是 deepseek-harness checkout。
        for (const rel of ['packages/bundle/base/cordis.patch.yml', 'packages/bundle/web-app/cordis.patch.yml']) {
            try {
                const patch = join(process.cwd(), rel);
                if (existsSync(patch)) {
                    for (const id of patchEntryIds(readFileSync(patch, 'utf8')))
                        ids.add(id);
                }
            }
            catch { /* ignore */ }
        }
        return ids;
    }
    /** 已安装表 → 生命周期推导输入。 */
    async lifecycleInput() {
        const installed = await this.installedWithSources();
        const depByRepo = new Map();
        for (const [dep, src] of Object.entries(installed.sources))
            depByRepo.set(src, dep);
        return { depByRepo, repos: installed.names, activeModules: this.activeModuleNames() };
    }
    /**
     * 推导一个插件当前的生命周期状态(用户语言,见类型注释)。
     * @param fullName - owner/repo 或依赖名。
     * @param input - 已安装依赖表(可复用,避免重复读盘)。
     */
    lifecycleFor(fullName, input) {
        const depName = input.depByRepo.get(fullName) ?? (input.repos.has(fullName) ? fullName : undefined);
        // 未安装
        if (depName === undefined) {
            const lastError = this.lifecycleFailures[fullName];
            return lastError !== undefined
                ? { status: 'install-failed', restartRequired: false, lastError }
                : { status: 'not-installed', restartRequired: false };
        }
        // 已安装:是否在启用列表
        const dir = this.profileDir();
        let enabled = false;
        try {
            if (dir)
                enabled = readProfile(dir).bundles.includes(depName);
        }
        catch { /* profile 读取失败按未启用处理 */ }
        const pluginDir = this.installedPackageDir(depName);
        if (pluginDir === null) {
            return {
                status: 'install-failed', restartRequired: false, installedName: depName,
                lastError: '安装不完整，请重新安装。',
            };
        }
        if (!packageDeclaresProfileBundle(pluginDir)) {
            return {
                status: 'incompatible', restartRequired: false, installedName: depName,
                reason: '该插件当前版本不能直接启用，建议卸载或查看插件说明。',
            };
        }
        const conflicts = patchConflictIds(pluginDir, this.coreEntryIds());
        if (!enabled) {
            if (conflicts.length > 0) {
                return {
                    status: 'incompatible', restartRequired: false, installedName: depName,
                    reason: '与当前环境不兼容，启用可能导致启动失败。',
                };
            }
            return input.activeModules.has(depName)
                ? { status: 'disabled-restart', restartRequired: true, installedName: depName }
                : { status: 'installed', restartRequired: false, installedName: depName };
        }
        // 已启用:当前进程是否已加载(已生效 vs 需重启)
        if (input.activeModules.has(depName))
            return { status: 'enabled-active', restartRequired: false, installedName: depName };
        if (conflicts.length > 0) {
            return {
                status: 'incompatible', restartRequired: false, installedName: depName,
                reason: '与当前环境不兼容，重启可能失败，建议先停用。',
            };
        }
        return { status: 'enabled-restart', restartRequired: true, installedName: depName };
    }
    /** 全量生命周期(供列表/已安装页)。 */
    async lifecycle() {
        const input = await this.lifecycleInput();
        const items = {};
        for (const name of input.depByRepo.keys()) {
            items[name] = this.lifecycleFor(name, input);
        }
        for (const failed of Object.keys(this.lifecycleFailures)) {
            if (items[failed] === undefined)
                items[failed] = this.lifecycleFor(failed, input);
        }
        const cap = this.restartCapability();
        // 自拉起 wrapper 随包发布,所有环境(含手动/Docker/systemd/Windows)都可自动重启。
        return { ok: true, profile: this.config.profileName, items, restartCapability: cap, canAutoRestart: true };
    }
    /** 检测当前进程的运行环境:pm2 走监督者拉起,其余走自拉起 wrapper。 */
    restartCapability() {
        // 检测顺序:父进程是谁最可靠(环境变量会被 shell/会话运行时污染,不可信)。
        // 1) PM2:父进程是 PM2 God Daemon(进程名以 PM2 开头)。
        if (/^PM2/i.test(parentProcessName(process.ppid)))
            return 'pm2';
        // 2) Docker:容器标记存在。
        if (existsSync('/.dockerenv'))
            return 'docker';
        // 3) systemd:服务进程由 systemd 注入 INVOCATION_ID(普通 shell 不会有)。
        if (process.env.INVOCATION_ID !== undefined && process.env.INVOCATION_ID !== '')
            return 'systemd';
        // 4) 手动/裸启动(含 Windows)。
        return 'manual';
    }
    /** 自动重启:响应先返回,再触发当前进程退出。PM2 托管 → 直接退出由其拉起;其他环境(手动/Docker/systemd/Windows)→ spawn 自拉起 wrapper,由 wrapper 用相同命令重启,不依赖任何外部监督者。 */
    async restart() {
        const cap = this.restartCapability();
        // 仅 PM2 走「退出→监督者拉起」(实测闭环);Docker/systemd 的 restart policy 不可依赖,统一走 wrapper 自拉起。
        const bySupervisor = cap === 'pm2';
        if (!bySupervisor) {
            const spawned = this.spawnRestartWrapper();
            if (!spawned) {
                return {
                    ok: false,
                    detail: '无法启动自动重启，请手动重启 DSH 后生效。',
                    etaSeconds: 0,
                };
            }
        }
        // 写队列清空后再退出,避免重启打断在途的 profile 写入。
        const done = this.enqueueProfileMutation(async () => undefined);
        void done.then(() => {
            // 先给浏览器 300ms 收响应,再优雅退出。
            setTimeout(() => process.exit(0), 300);
        });
        return {
            ok: true,
            detail: '正在重启 DSH，预计 10–30 秒后恢复。重启后所有对话历史都会保留，仅当前正在进行的任务会中断。',
            etaSeconds: 30,
        };
    }
    /** 以脱离方式 spawn 自拉起 wrapper;返回是否成功发起。 */
    spawnRestartWrapper() {
        try {
            // ESM 下没有 __dirname,用 import.meta.url 定位(编译产物 lib/gateway.js → 包根/scripts/)。
            const here = fileURLToPath(new URL('.', import.meta.url));
            const wrapper = join(here, '..', 'scripts', 'auto-restart-wrapper.mjs');
            if (!existsSync(wrapper))
                return false;
            // 重启命令 = 当前 node + 完整原参数。注意:node 选项(--import/--loader 等)只出现在
            // process.execArgv 而不在 process.argv,必须两者拼接才能完整复现原启动命令。
            const restArgs = [...process.execArgv, ...process.argv.slice(1)];
            // 端口探测参数(防双拉:外部监督者先拉起时 wrapper 放弃):从原参数里找 --port/-p。
            const portIdx = process.argv.findIndex((a, i) => (a === '--port' || a === '-p') && process.argv[i + 1] !== undefined);
            const port = portIdx !== -1 ? String(process.argv[portIdx + 1]) : '';
            const proc = spawn(process.execPath, [wrapper, String(process.pid), port, '--', ...restArgs], {
                cwd: process.cwd(),
                env: process.env,
                stdio: 'ignore',
                detached: true,
            });
            proc.unref();
            return true;
        }
        catch {
            return false;
        }
    }
    /** 单个插件状态(已安装页用)。 */
    async status(fullName) {
        return this.lifecycleFor(fullName.trim(), await this.lifecycleInput());
    }
    /** 启用:加入启用列表(保留依赖关系不动)。冲突或核心组件拒绝,写前备份写后校验。 */
    async enable(fullName) {
        const name = (fullName ?? '').trim();
        if (this.validPackageName(name) === null) {
            return { ok: false, fullName: name, status: 'not-installed', detail: '插件名不合法', restartRequired: false };
        }
        const input = await this.lifecycleInput();
        const depName = input.depByRepo.get(name) ?? (input.repos.has(name) ? name : undefined);
        if (depName === undefined) {
            return { ok: false, fullName: name, status: 'not-installed', detail: '请先安装该插件，再启用。', restartRequired: false };
        }
        if (CORE_BUNDLE_WHITELIST.includes(depName)) {
            return { ok: false, fullName: name, status: 'enabled-active', detail: '这是 DSH 自带组件，无需操作。', restartRequired: false };
        }
        const dir = this.profileDir();
        if (!dir)
            return { ok: false, fullName: name, status: 'installed', detail: '找不到当前插件配置，请检查 DSH 是否正常启动。', restartRequired: false };
        // 可加载校验:不能作为 profile 启用层加载的包不得加入启用列表。
        if (!this.isLoadableBundle(depName)) {
            return {
                ok: false, fullName: name, status: 'incompatible',
                detail: '该插件当前版本不能直接启用，已取消。建议卸载或查看插件说明。',
                restartRequired: false,
            };
        }
        // 启用前冲突检测:patch 与核心撞 id → 拒绝(避免启动失败)
        const pluginDir = this.installedPackageDir(depName);
        if (pluginDir !== null) {
            const conflicts = patchConflictIds(pluginDir, this.coreEntryIds());
            if (conflicts.length > 0) {
                return {
                    ok: false, fullName: name, status: 'incompatible',
                    detail: '该插件与当前环境不兼容，启用可能导致启动失败，已取消。',
                    restartRequired: false,
                };
            }
        }
        try {
            const { backup, changed } = addBundle(dir, depName);
            if (!changed) {
                return { ok: true, fullName: name, status: 'enabled-active', detail: '该插件已启用。', restartRequired: false };
            }
            return {
                ok: true, fullName: name, status: 'enabled-restart',
                detail: '已启用。重启 DSH 后生效。', restartRequired: true, backupPath: backup,
            };
        }
        catch (e) {
            return { ok: false, fullName: name, status: 'installed', detail: friendlyOperationError(e, 'enable'), restartRequired: false };
        }
    }
    /** 禁用:移出启用列表,保留依赖关系(可随时重新启用)。 */
    async disable(fullName) {
        const name = (fullName ?? '').trim();
        if (this.validPackageName(name) === null) {
            return { ok: false, fullName: name, status: 'not-installed', detail: '插件名不合法', restartRequired: false };
        }
        const input = await this.lifecycleInput();
        const depName = input.depByRepo.get(name) ?? (input.repos.has(name) ? name : undefined);
        if (depName === undefined) {
            return { ok: false, fullName: name, status: 'not-installed', detail: '该插件尚未安装。', restartRequired: false };
        }
        const dir = this.profileDir();
        if (!dir)
            return { ok: false, fullName: name, status: 'installed', detail: '找不到当前插件配置，请检查 DSH 是否正常启动。', restartRequired: false };
        try {
            const { backup, changed } = removeBundle(dir, depName);
            if (!changed) {
                return { ok: true, fullName: name, status: 'installed', detail: '该插件已停用。', restartRequired: false };
            }
            return {
                ok: true, fullName: name, status: 'disabled-restart',
                detail: '已停用（仍保留安装，可随时重新启用）。重启 DSH 后生效。', restartRequired: true, backupPath: backup,
            };
        }
        catch (e) {
            return { ok: false, fullName: name, status: 'enabled-restart', detail: friendlyOperationError(e, 'disable'), restartRequired: false };
        }
    }
}
/** 路由表：浏览器面板经同源 JSON 接口读写。 */
export function makeRoutes(gateway) {
    const json = (res, status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(body));
    };
    const MAX_JSON_BODY = 64 * 1024;
    const readJson = async (req) => {
        const chunks = [];
        let total = 0;
        let tooLarge = false;
        await new Promise((resolve) => {
            req.on('data', (c) => {
                total += c.length;
                if (total > MAX_JSON_BODY) {
                    tooLarge = true;
                    req.destroy();
                    resolve();
                    return;
                }
                chunks.push(c);
            });
            req.on('end', () => resolve());
            req.on('error', () => resolve());
        });
        if (tooLarge) {
            const err = new Error('请求体过大');
            err.code = 'body-too-large';
            throw err;
        }
        try {
            return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        }
        catch {
            return {};
        }
    };
    /** 读请求体：超限（>64KB）回复 400、其他异常回复 500，调用方收到 null 应直接返回。 */
    const readBody = async (req, res) => {
        try {
            return (await readJson(req));
        }
        catch (e) {
            const code = e.code;
            if (code === 'body-too-large') {
                json(res, 400, { ok: false, code: 'body-too-large', message: '请求体过大' });
            }
            else {
                json(res, 500, { ok: false, code: 'internal', message: '服务暂不可用，请稍后重试。' });
            }
            return null;
        }
    };
    const respond = (res, promise) => {
        promise.then(v => json(res, 200, v)).catch(e => json(res, 500, { ok: false, code: 'internal', message: '服务暂不可用，请稍后重试。' }));
    };
    /**
     * 同源校验(CSRF 防线):浏览器跨站请求必带 Origin;若 Origin 存在
     * 且与请求 Host 不一致则拒绝。无 Origin 的请求(curl/同源旧客户端)放行。
     * 阻断恶意网页对 127.0.0.1:3080 的 drive-by 安装/卸载。
     */
    const sameOrigin = (req) => {
        const origin = req.headers.origin;
        if (origin === undefined)
            return true;
        try {
            const host = req.headers.host;
            if (host === undefined)
                return false;
            return new URL(origin).host === host;
        }
        catch {
            return false;
        }
    };
    /** 写操作统一入口:先同源校验再转发。 */
    const guarded = (handler) => {
        return (req, res) => {
            if (!sameOrigin(req)) {
                json(res, 403, { ok: false, code: 'cross-origin', message: '请求来源不合法' });
                return;
            }
            Promise.resolve(handler(req, res)).catch(e => {
                if (!res.headersSent)
                    json(res, 500, { ok: false, code: 'internal', message: '服务暂不可用，请稍后重试。' });
            });
        };
    };
    return [
        {
            kind: 'exact', path: '/api/plugin-market/search',
            handler: async (req, res) => {
                const body = await readBody(req, res);
                if (body === null)
                    return;
                respond(res, gateway.search(body.query ?? '', body.ai === true));
            },
        },
        {
            kind: 'exact', path: '/api/plugin-market/install',
            handler: guarded(async (req, res) => {
                const body = await readBody(req, res);
                if (body === null)
                    return;
                respond(res, gateway.install(body.repo ?? ''));
            }),
        },
        {
            kind: 'exact', path: '/api/plugin-market/assess',
            handler: guarded(async (req, res) => {
                const body = await readBody(req, res);
                if (body === null)
                    return;
                respond(res, gateway.assess(body.repo ?? ''));
            }),
        },
        {
            kind: 'exact', path: '/api/plugin-market/uninstall',
            handler: guarded(async (req, res) => {
                const body = await readBody(req, res);
                if (body === null)
                    return;
                respond(res, gateway.uninstall(body.repo ?? ''));
            }),
        },
        {
            kind: 'exact', path: '/api/plugin-market/enable',
            handler: guarded(async (req, res) => {
                const body = await readBody(req, res);
                if (body === null)
                    return;
                respond(res, gateway.enable(body.repo ?? ''));
            }),
        },
        {
            kind: 'exact', path: '/api/plugin-market/disable',
            handler: guarded(async (req, res) => {
                const body = await readBody(req, res);
                if (body === null)
                    return;
                respond(res, gateway.disable(body.repo ?? ''));
            }),
        },
        {
            kind: 'exact', path: '/api/plugin-market/status',
            handler: async (req, res) => {
                const body = await readBody(req, res);
                if (body === null)
                    return;
                respond(res, gateway.status(body.repo ?? ''));
            },
        },
        {
            kind: 'exact', path: '/api/plugin-market/lifecycle',
            handler: async (_req, res) => respond(res, gateway.lifecycle()),
        },
        {
            kind: 'exact', path: '/api/plugin-market/restart',
            handler: guarded(async (_req, res) => respond(res, gateway.restart())),
        },
        {
            kind: 'exact', path: '/api/plugin-market/browse',
            handler: async (req, res) => {
                const body = await readBody(req, res);
                if (body === null)
                    return;
                respond(res, gateway.browse(body.category ?? 'all', Number.isFinite(body.limit) ? body.limit : 50));
            },
        },
        {
            kind: 'exact', path: '/api/plugin-market/installed',
            handler: (_req, res) => respond(res, gateway.installed()),
        },
        {
            kind: 'exact', path: '/api/plugin-market/catalog',
            handler: async (_req, res) => {
                try {
                    respond(res, gateway.catalog());
                }
                catch (e) {
                    json(res, 502, { ok: false, message: String(e) });
                }
            },
        },
    ];
}
