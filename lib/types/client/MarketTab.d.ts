/** 插件市场设置页 tab：分类浏览 / 搜索（本地+AI）/ 已安装管理 + mydsh.dev 引流。 */
import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { MarketAssessResult, MarketBrowseResult, MarketInstallResult, MarketInstalledResult, MarketSearchResult, MarketUninstallResult } from '../types.ts';
/** Registration-side Remote face used by the section. */
export interface MarketTabInjected {
    search: (query: string, ai?: boolean) => Promise<MarketSearchResult>;
    browse: (category: string, limit?: number) => Promise<MarketBrowseResult>;
    install: (repo: string) => Promise<MarketInstallResult>;
    uninstall: (repo: string) => Promise<MarketUninstallResult>;
    assess: (repo: string) => Promise<MarketAssessResult>;
    installed: () => Promise<MarketInstalledResult>;
}
/** Full component props assembled by the Settings slot renderer. */
export type MarketTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'settings.pluginMarket'> & InjectFace<MarketTabInjected>;
/** Render the plugin market Settings tab. */
export declare function MarketTab({ search, browse, install, uninstall, assess, installed, t }: MarketTabProps): ReactNode;
