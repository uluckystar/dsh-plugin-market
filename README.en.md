# dsh-plugin-market

Browse the **mydsh.dev plugin catalog** right inside the DeepSeek Harness settings page (5,596 candidates, **3,656 verified as directly loadable**) — category browsing, local/AI search, install, enable, disable, uninstall, security assessment, and **one-click auto-restart**. Only plugins verified as directly loadable are shown. Built by the unofficial community mydsh.dev.

![version](https://img.shields.io/badge/version-0.1.0-e63946?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![plugins](https://img.shields.io/badge/catalog-3656%20valid-blue?style=flat-square)
![platform](https://img.shields.io/badge/platform-web-lightgrey?style=flat-square)

## Features

- **Category browsing**: 10 categories (All / Agent / MCP / Dev tools / UI / Vision / LLM / Memory / Data / Integrations) with counts, sorted by stars, "load more" pagination
- **Local search**: millisecond local matching (name / zh+en description / topics)
- **AI search**: toggle 🤖 to use mydsh.dev's AI search for semantic understanding of your request
- **Controlled enabling**: install only downloads the plugin; enabling is an explicit user action
- **Enable / Disable / Uninstall**: one-click auto-restart applies changes; disable keeps the install (re-enable anytime); uninstall fully removes and cleans up
- **Seven lifecycle states**: not-installed / installed · off / enabled · restart to apply / enabled / disabled · restart to apply / incompatible · not recommended / install failed
- **One-click auto-restart**: after enable/disable, hit "Restart now" — a confirmation dialog states the expected downtime and impact, then the page auto-refreshes when DSH is back. Works in every environment (PM2 / manual launch / Docker / systemd / Windows)
- **Security assessment**: queries mydsh.dev security reports, guides submission when none exists
- **Safety rails**: automatic backup before every profile write, re-validation after write, auto-rollback on failure; core component protection; incompatible plugins refuse to enable (prevents startup failure); install failures are recorded with retry; plugin-name whitelist + same-origin guard + request body size limit
- **mydsh.dev funnel**: every plugin row links to its detail page (README / install guide / similar picks / Chinese summary)

## Performance

- Plugin catalog **disk-persistent cache** (`$DSH_HOME/storages/plugin_market_catalog.json`, 6h TTL): survives restarts, no repeated 2MB fetches
- Validation cache (`$DSH_HOME/storages/plugin_market_validated_bundle_v1.json`): only repos declaring `dsh.bundle.patch` are marked as shown
- Category switching is **pure local filtering** — zero network requests
- AI search has a 6-second timeout guard; slow AI never blocks local results

## Install

```bash
# Option 1: from GitHub
dsh plugin --profile web add github:uluckystar/dsh-plugin-market

# Option 2: from a local directory (development)
dsh plugin --profile web add /path/to/dsh-plugin-market
```

Restart DSH after installing, then open **Settings → Plugins → Plugin Market**. Plugins installed through the market must be explicitly enabled, then restarted to take effect.

## Configuration (cordis.patch.yml)

```yaml
- id: plugin-market
  name: dsh-plugin-market
  config:
    marketBaseUrl: 'https://mydsh.dev'      # data source
    profileName: 'web'                       # target profile for installs
    pnpmCommand: 'npx -y pnpm@11.7.0'        # pnpm version (match profile packageManager)
    proxyUrl: 'http://127.0.0.1:7897'        # local proxy (speeds up GitHub downloads); may be empty
    catalogCacheMs: 21600000                 # catalog cache TTL (6 hours)
    installTimeoutMs: 300000                 # install timeout
    githubToken: ''                          # optional GitHub API token; raw/HEAD + proxy used otherwise
```

## API

| Endpoint | Description |
|---|---|
| `POST /api/plugin-market/browse` | `{category, limit}` browse by category (limit=0 returns all) |
| `POST /api/plugin-market/search` | `{query, ai}` local + optional AI search |
| `POST /api/plugin-market/install` | `{repo}` install into the current profile, without auto-enabling |
| `POST /api/plugin-market/enable` | `{repo}` enable a plugin, prompting restart when needed |
| `POST /api/plugin-market/disable` | `{repo}` disable a plugin, keeping the install |
| `POST /api/plugin-market/uninstall` | `{repo}` uninstall and clean up enable state |
| `POST /api/plugin-market/status` | `{repo}` lifecycle state of a single plugin |
| `POST /api/plugin-market/lifecycle` | lifecycle of all installed plugins (incl. runtime environment & auto-restart capability) |
| `POST /api/plugin-market/restart` | one-click DSH restart (PM2-managed: supervisor respawns; otherwise the plugin self-restarts via a wrapper) |
| `POST /api/plugin-market/assess` | `{repo}` security assessment |
| `POST /api/plugin-market/installed` | installed plugin list |

## Data source

[MyDSH · DeepSeek Harness Plugin Catalog](https://mydsh.dev/plugins) — automatically syncs DSH plugin candidates (currently 5,596) and strictly validates them via the `dsh.bundle.patch` declaration in package.json (currently 3,656 valid / 1,940 invalid hidden). Only strictly confirmed repos are shown; unknown, unparseable, client-only, and incomplete packages never appear. Unofficial community.

## Development

```bash
pnpm install
pnpm run typecheck   # host + client tsc
pnpm run build       # tsc + tsdown (outputs to lib/)
node scripts/lifecycle-smoke.mjs   # lifecycle safety regression (18 assertions, temp profile, never touches real config)
```

## License

MIT — see [LICENSE](./LICENSE).

## Credits

- [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) — the everything-is-a-plugin agent runtime
- [MyDSH community](https://mydsh.dev) — unofficial plugin catalog data source
