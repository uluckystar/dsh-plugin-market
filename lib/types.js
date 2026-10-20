/**
 * 插件市场共享类型（host 与 client 两个 program 共用）。
 * 本文件必须零 import：它同时被 host（tsconfig.json）与 client
 * （tsconfig.client.json）编译。
 */
/** 内置分类表（镜像 mydsh.dev 的 CATEGORIES）。 */
export const MARKET_CATEGORIES = [
    { id: 'bridge', topics: ['ecosystem-bridge', 'compatibility', 'pi-ecosystem', 'pi2dsh', 'adapter', 'bridge'] },
    { id: 'agent', topics: ['agent', 'ai-agent', 'ai-agents', 'agent-skills', 'multi-agent', 'autonomous', 'team', 'crew', 'orchestration'] },
    { id: 'mcp', topics: ['mcp', 'model-context-protocol', 'mcp-server', 'mcp-client'] },
    { id: 'devtools', topics: ['developer-tools', 'cli', 'command-line', 'terminal', 'vscode', 'neovim', 'ide', 'developer', 'sdk', 'tooling', 'debugger'] },
    { id: 'ui', topics: ['ui', 'gui', 'dashboard', 'desktop', 'electron', 'web-ui', 'frontend', 'interface', 'tui', 'webapp', 'web-app', 'react'] },
    { id: 'vision', topics: ['vision', 'image', 'video', 'multimodal', 'ocr', 'screenshot', 'image-generation', 'computer-vision', 'audio'] },
    { id: 'llm', topics: ['llm', 'language-model', 'prompt', 'prompt-engineering', 'chat', 'openai', 'anthropic', 'gemini', 'qwen', 'claude', 'codex', 'claude-code', 'reasoning', 'inference'] },
    { id: 'integrations', topics: ['integration', 'integrations', 'api', 'webhook', 'github', 'slack', 'discord', 'telegram', 'notion', 'obsidian', 'chrome', 'browser', 'google', 'gmail', 'calendar', 'jira', 'linear', 'gitlab', 'whatsapp', 'wechat', 'feishu', 'lark'] },
    { id: 'memory', topics: ['memory', 'knowledge', 'rag', 'vector', 'retrieval', 'search', 'knowledge-base', 'notes', 'semantic'] },
    { id: 'data', topics: ['data', 'database', 'storage', 'sql', 'postgres', 'redis', 'sqlite', 'csv', 'excel', 'spreadsheet'] },
    { id: 'notify', topics: ['notifications', 'notification', 'notify', 'alert', 'messaging', 'email', 'sms'] },
    { id: 'automation', topics: ['automation', 'productivity', 'workflow', 'tools', 'utility', 'utils', 'scheduler', 'cron', 'automation-tools'] },
    { id: 'cloud', topics: ['docker', 'kubernetes', 'cloud', 'deploy', 'deployment', 'server', 'backend', 'devops', 'infra', 'aws', 'azure', 'gcp', 'serverless'] },
    { id: 'other', topics: [] },
];
/**
 * 插件分类：按 topics 匹配第一个命中的分类，未命中归 other。
 * host（gateway）与 client（MarketTab）共用，保证分类规则单一来源。
 */
const categoryCache = new WeakMap();
export function categoryOf(p) {
    const cached = categoryCache.get(p);
    if (cached)
        return cached;
    if (/^(?:pi2dsh|dsh-pi-bridge)$/i.test((p.full_name ?? '').split('/').pop() ?? ''))
        return 'bridge';
    const tags = (p.topics ?? []).map(t => t.trim().toLowerCase().replace(/[_\s]+/g, '-'));
    let best = 'other';
    let bestScore = 0;
    for (const cat of MARKET_CATEGORIES) {
        let score = 0;
        for (const keyword of cat.topics)
            for (const tag of tags) {
                if (tag === keyword)
                    score += 3;
                else if (tag.startsWith(keyword + '-') || tag.endsWith('-' + keyword) || tag.includes('-' + keyword + '-'))
                    score += 1;
            }
        if (score > bestScore) {
            best = cat.id;
            bestScore = score;
        }
    }
    categoryCache.set(p, best);
    return best;
}
