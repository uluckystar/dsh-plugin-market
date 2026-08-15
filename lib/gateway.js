/**
 * 插件市场宿主席位：PluginMarketGateway。
 * - search：从 mydsh.dev 拉插件大全缓存 + 本地检索；AI 推荐走 mydsh.dev AI 搜索
 * - install：一键安装（在当前 profile 目录跑 pnpm add github:owner/repo）
 * - assess：提交安全评估到 mydsh.dev
 * - installed：读当前 profile 的 package.json dependencies 判断已装
 */
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { Service } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { MARKET_CATEGORIES, } from "./types.js";
const execAsync = promisify(execCallback);
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
    });
    config;
    /** 插件大全内存缓存（6 小时失效，增量更新：网站每小时刷新，这里每 6 小时同步一次）。 */
    catalogCache = null;
    /** 磁盘缓存路径（重启不丢，避免每次启动重新拉 2MB）。 */
    catalogDiskPath;
    constructor(ctx, config) {
        super(ctx, 'pluginMarket');
        console.log(`[plugin-market] 构造 config: catalogCacheMs=${config?.catalogCacheMs}, marketBaseUrl=${config?.marketBaseUrl}, profileName=${config?.profileName}, pnpmCommand=${config?.pnpmCommand}, proxyUrl=${config?.proxyUrl}`);
        // config 兜底默认值：cordis patch 未合并时也能正常工作
        this.config = {
            marketBaseUrl: config?.marketBaseUrl ?? 'https://mydsh.dev',
            profileName: config?.profileName ?? 'web',
            catalogCacheMs: config?.catalogCacheMs ?? 6 * 60 * 60 * 1000,
            installTimeoutMs: config?.installTimeoutMs ?? 300 * 1000,
            pnpmCommand: config?.pnpmCommand ?? 'npx -y pnpm@11.7.0',
            proxyUrl: config?.proxyUrl ?? 'http://127.0.0.1:7897',
        };
        const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
        this.catalogDiskPath = join(base, 'storages', 'plugin_market_catalog.json');
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
            const { mkdirSync, writeFileSync } = await import('node:fs');
            mkdirSync(join(this.catalogDiskPath, '..'), { recursive: true });
            writeFileSync(this.catalogDiskPath, JSON.stringify({ at: now, plugins }), 'utf8');
        }
        catch { /* ignore */ }
        return plugins;
    }
    /** 插件分类：按 topics 匹配第一个命中的分类，未命中归 other。 */
    categoryOf(p) {
        const topics = new Set((p.topics ?? []).map(t => t.toLowerCase()));
        for (const cat of MARKET_CATEGORIES) {
            if (cat.id === 'other')
                continue;
            if (cat.topics.some(t => topics.has(t)))
                return cat.id;
        }
        return 'other';
    }
    /** 分类浏览：按分类列出插件（星数降序；limit=0 返回全部），附各分类计数。 */
    async browse(category, limit = 50) {
        const cat = (category ?? '').trim();
        const valid = MARKET_CATEGORIES.some(c => c.id === cat) || cat === 'all';
        const target = valid ? cat : 'all';
        const installed = await this.installedNames();
        const all = await this.catalog();
        const counts = { all: all.length };
        for (const c of MARKET_CATEGORIES)
            counts[c.id] = 0;
        for (const p of all) {
            const c = this.categoryOf(p);
            counts[c] = (counts[c] ?? 0) + 1;
        }
        const list = target === 'all'
            ? all
            : all.filter(p => this.categoryOf(p) === target);
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
        const all = await this.catalog();
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
    /** 一键安装：在 profile 目录跑 pnpm add。 */
    async install(fullName) {
        const started = Date.now();
        const name = (fullName ?? '').trim();
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) {
            return { ok: false, fullName: name, detail: '仓库名格式应为 owner/repo', restartRequired: false, durationMs: 0 };
        }
        const dir = this.profileDir();
        if (!dir) {
            return { ok: false, fullName: name, detail: '找不到 profile 目录', restartRequired: false, durationMs: 0 };
        }
        try {
            const spec = `github:${name}`;
            const detail = await this.runPnpm(dir, ['add', spec]);
            return { ok: true, fullName: name, detail: detail || '安装完成', restartRequired: true, durationMs: Date.now() - started };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { ok: false, fullName: name, detail: msg.slice(-1500), restartRequired: false, durationMs: Date.now() - started };
        }
    }
    /** 卸载：pnpm remove（支持依赖名或 owner/repo 仓库名）。 */
    async uninstall(fullName) {
        const started = Date.now();
        const name = (fullName ?? '').trim();
        if (name.length === 0) {
            return { ok: false, fullName: name, detail: '缺少插件名', restartRequired: false, durationMs: 0 };
        }
        const dir = this.profileDir();
        if (!dir) {
            return { ok: false, fullName: name, detail: '找不到 profile 目录', restartRequired: false, durationMs: 0 };
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
            const detail = await this.runPnpm(dir, ['remove', depName]);
            return { ok: true, fullName: name, detail: detail || '卸载完成', restartRequired: true, durationMs: Date.now() - started };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { ok: false, fullName: name, detail: msg.slice(-1500), restartRequired: false, durationMs: Date.now() - started };
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
            const resp = await fetch(`${this.config.marketBaseUrl}/api/security/list`, {
                headers: { 'user-agent': 'dsh-plugin-market/0.1' },
            });
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
}
/** 路由表：浏览器面板经同源 JSON 接口读写。 */
export function makeRoutes(gateway) {
    const json = (res, status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(body));
    };
    const readJson = async (req) => {
        const chunks = [];
        await new Promise((resolve) => {
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => resolve());
        });
        try {
            return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        }
        catch {
            return {};
        }
    };
    const respond = (res, promise) => {
        promise.then(v => json(res, 200, v)).catch(e => json(res, 500, { ok: false, code: 'internal', message: String(e) }));
    };
    return [
        {
            kind: 'exact', path: '/api/plugin-market/search',
            handler: async (req, res) => {
                const body = await readJson(req);
                respond(res, gateway.search(body.query ?? '', body.ai === true));
            },
        },
        {
            kind: 'exact', path: '/api/plugin-market/install',
            handler: async (req, res) => {
                const body = await readJson(req);
                respond(res, gateway.install(body.repo ?? ''));
            },
        },
        {
            kind: 'exact', path: '/api/plugin-market/assess',
            handler: async (req, res) => {
                const body = await readJson(req);
                respond(res, gateway.assess(body.repo ?? ''));
            },
        },
        {
            kind: 'exact', path: '/api/plugin-market/uninstall',
            handler: async (req, res) => {
                const body = await readJson(req);
                respond(res, gateway.uninstall(body.repo ?? ''));
            },
        },
        {
            kind: 'exact', path: '/api/plugin-market/browse',
            handler: async (req, res) => {
                const body = await readJson(req);
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
