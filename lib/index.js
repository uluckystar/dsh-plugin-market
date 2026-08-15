import { PluginMarketGateway } from "./gateway.js";
export { PluginMarketGateway } from "./gateway.js";
/** 插件名（cordis patch 里 id 与之一致）。 */
export const name = 'plugin-market';
/** 依赖服务。 */
export const inject = ['webServer'];
/** 插件入口。 */
export function apply(ctx, config = {}) {
    new PluginMarketGateway(ctx, config);
}
