/** 插件市场 browser half：注册到 Settings → 插件 区域的 tab。 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MarketTab, type MarketTabInjected } from './MarketTab.tsx'
import { en, zh, type PluginMarketLocaleKey } from './locales.ts'

export type { MarketTabInjected, MarketTabProps } from './MarketTab.tsx'
export type { PluginMarketLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Plugin market copy. */
    'settings.pluginMarket': PluginMarketLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.pluginMarket'

/** Services required by the Settings registration. */
export const inject = ['slots', 'locale'] as const

/** Contribute the lazy market tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-market: dictionaries')

  const t = ctx.locale.bind(NS)

  async function fetchJson<T>(path: string, body?: unknown): Promise<T> {
    const resp = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json() as T & { ok?: boolean }
    if (data.ok === false) {
      throw new Error((data as { message?: string }).message ?? 'request failed')
    }
    return data
  }

  const injected = (): MarketTabInjected => ({
    search: (query, ai = false) => fetchJson('/api/plugin-market/search', { query, ai }),
    browse: (category, limit = 50) => fetchJson('/api/plugin-market/browse', { category, limit }),
    install: (repo) => fetchJson('/api/plugin-market/install', { repo }),
    uninstall: (repo) => fetchJson('/api/plugin-market/uninstall', { repo }),
    assess: (repo) => fetchJson('/api/plugin-market/assess', { repo }),
    installed: () => fetchJson('/api/plugin-market/installed'),
  })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'market',
    order: 5,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, MarketTab))
}
