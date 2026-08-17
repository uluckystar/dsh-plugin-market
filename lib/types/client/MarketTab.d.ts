/** 插件市场设置页 tab：分类浏览 / 搜索（本地+AI）/ 已安装管理 + mydsh.dev 引流。 */
import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type MarketAssessResult, type MarketBrowseResult, type MarketInstallResult, type MarketInstalledResult, type MarketLifecycleResult, type MarketPluginLifecycle, type MarketRestartResult, type MarketSearchResult, type MarketToggleResult, type MarketUninstallResult } from '../types.ts';
/** Registration-side Remote face used by the section. */
export interface MarketTabInjected {
    search: (query: string, ai?: boolean) => Promise<MarketSearchResult>;
    browse: (category: string, limit?: number) => Promise<MarketBrowseResult>;
    install: (repo: string) => Promise<MarketInstallResult>;
    uninstall: (repo: string) => Promise<MarketUninstallResult>;
    enable: (repo: string) => Promise<MarketToggleResult>;
    disable: (repo: string) => Promise<MarketToggleResult>;
    status: (repo: string) => Promise<MarketPluginLifecycle>;
    lifecycle: () => Promise<MarketLifecycleResult>;
    restart: () => Promise<MarketRestartResult>;
    assess: (repo: string) => Promise<MarketAssessResult>;
    installed: () => Promise<MarketInstalledResult>;
}
/** Full component props assembled by the Settings slot renderer. */
export type MarketTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'settings.pluginMarket'> & InjectFace<MarketTabInjected>;
/** Render the plugin market Settings tab. */
export declare function MarketTab({ search, browse, install, uninstall, enable, disable, status, lifecycle, restart, assess, installed, t }: MarketTabProps): ReactNode;
