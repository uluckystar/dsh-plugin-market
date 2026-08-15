/** 插件市场 browser half：注册到 Settings → 插件 区域的 tab。 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type PluginMarketLocaleKey } from './locales.ts';
export type { MarketTabInjected, MarketTabProps } from './MarketTab.tsx';
export type { PluginMarketLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Plugin market copy. */
        'settings.pluginMarket': PluginMarketLocaleKey;
    }
}
/** Dictionary namespace owned by this plugin. */
export declare const NS = "settings.pluginMarket";
/** Services required by the Settings registration. */
export declare const inject: readonly ["slots", "locale"];
/** Contribute the lazy market tab to the Plugins settings section. */
export declare function apply(ctx: ClientContext): void;
