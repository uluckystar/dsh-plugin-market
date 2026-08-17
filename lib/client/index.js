/** 插件市场 browser half：注册到 Settings → 插件 区域的 tab。 */
import { MarketTab } from "./MarketTab.js";
import { en, zh } from "./locales.js";
/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.pluginMarket';
/** Services required by the Settings registration. */
export const inject = ['slots', 'locale'];
/** Contribute the lazy market tab to the Plugins settings section. */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-market: dictionaries');
    const t = ctx.locale.bind(NS);
    async function fetchJson(path, body) {
        const resp = await fetch(path, {
            method: body === undefined ? 'GET' : 'POST',
            headers: body === undefined ? undefined : { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!resp.ok) {
            // 后端失败信封:尝试提取用户可读 detail(安装/启用/停用/卸载的失败原因)
            try {
                const body = await resp.json();
                throw new Error(body.detail ?? body.message ?? `HTTP ${resp.status}`);
            }
            catch (e) {
                if (e instanceof Error && e.message !== `HTTP ${resp.status}`)
                    throw e;
                throw new Error(`HTTP ${resp.status}`);
            }
        }
        const data = await resp.json();
        if (data.ok === false) {
            throw new Error(data.detail ?? data.message ?? '操作未完成，请重试。');
        }
        return data;
    }
    const injected = () => ({
        search: (query, ai = false) => fetchJson('/api/plugin-market/search', { query, ai }),
        browse: (category, limit = 50) => fetchJson('/api/plugin-market/browse', { category, limit }),
        install: (repo) => fetchJson('/api/plugin-market/install', { repo }),
        uninstall: (repo) => fetchJson('/api/plugin-market/uninstall', { repo }),
        enable: (repo) => fetchJson('/api/plugin-market/enable', { repo }),
        disable: (repo) => fetchJson('/api/plugin-market/disable', { repo }),
        status: (repo) => fetchJson('/api/plugin-market/status', { repo }),
        lifecycle: () => fetchJson('/api/plugin-market/lifecycle'),
        restart: () => fetchJson('/api/plugin-market/restart'),
        assess: (repo) => fetchJson('/api/plugin-market/assess', { repo }),
        installed: () => fetchJson('/api/plugin-market/installed'),
    });
    ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: 'market',
        order: 5,
        label: () => t('tab'),
        locale: NS,
        inject: injected,
    }, MarketTab));
}
