window.__ModuleLoader__.load({
	id: "dsh-plugin-market",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/types.js
		/**
		* 插件市场共享类型（host 与 client 两个 program 共用）。
		* 本文件必须零 import：它同时被 host（tsconfig.json）与 client
		* （tsconfig.client.json）编译。
		*/
		/** 内置分类表（镜像 mydsh.dev 的 CATEGORIES）。 */
		const MARKET_CATEGORIES = [
			{
				id: "agent",
				topics: [
					"agent",
					"ai-agent",
					"ai-agents",
					"agent-skills",
					"multi-agent",
					"autonomous",
					"team",
					"crew",
					"orchestration"
				]
			},
			{
				id: "mcp",
				topics: [
					"mcp",
					"model-context-protocol",
					"mcp-server",
					"mcp-client"
				]
			},
			{
				id: "devtools",
				topics: [
					"developer-tools",
					"cli",
					"command-line",
					"terminal",
					"vscode",
					"neovim",
					"ide",
					"developer",
					"sdk",
					"tooling",
					"debugger",
					"tui"
				]
			},
			{
				id: "ui",
				topics: [
					"ui",
					"gui",
					"dashboard",
					"desktop",
					"electron",
					"web-ui",
					"frontend",
					"interface",
					"tui",
					"webapp",
					"web-app",
					"react"
				]
			},
			{
				id: "vision",
				topics: [
					"vision",
					"image",
					"video",
					"multimodal",
					"ocr",
					"screenshot",
					"image-generation",
					"computer-vision",
					"audio"
				]
			},
			{
				id: "llm",
				topics: [
					"llm",
					"language-model",
					"prompt",
					"prompt-engineering",
					"chat",
					"openai",
					"anthropic",
					"gemini",
					"qwen",
					"claude",
					"codex",
					"claude-code",
					"reasoning",
					"inference"
				]
			},
			{
				id: "memory",
				topics: [
					"memory",
					"knowledge",
					"rag",
					"vector",
					"retrieval",
					"search",
					"knowledge-base",
					"notes",
					"semantic"
				]
			},
			{
				id: "data",
				topics: [
					"data",
					"database",
					"storage",
					"sql",
					"postgres",
					"redis",
					"sqlite",
					"csv",
					"excel",
					"spreadsheet"
				]
			},
			{
				id: "integrations",
				topics: [
					"integration",
					"integrations",
					"api",
					"webhook",
					"github",
					"slack",
					"discord",
					"telegram",
					"notion",
					"obsidian",
					"chrome",
					"browser",
					"google",
					"gmail",
					"calendar",
					"jira",
					"linear",
					"gitlab",
					"whatsapp",
					"wechat",
					"feishu",
					"lark"
				]
			},
			{
				id: "other",
				topics: []
			}
		];
		/**
		* 插件分类：按 topics 匹配第一个命中的分类，未命中归 other。
		* host（gateway）与 client（MarketTab）共用，保证分类规则单一来源。
		*/
		function categoryOf(p) {
			const topics = new Set((p.topics ?? []).map((t) => t.toLowerCase()));
			for (const cat of MARKET_CATEGORIES) {
				if (cat.id === "other") continue;
				if (cat.topics.some((t) => topics.has(t))) return cat.id;
			}
			return "other";
		}
		//#endregion
		//#region \0dsh-css:/Volumes/aigo/work/workProject/mydsh-community/plugins/dsh-plugin-market/src/client/MarketTab.module.css.mjs
		const css = ".HXRBOa_wrap{flex-direction:column;gap:12px;padding:4px 2px;display:flex}.HXRBOa_intro{color:var(--text-muted,#777);margin:0;font-size:13px;line-height:1.6}.HXRBOa_searchRow{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.HXRBOa_searchInput{border:1px solid var(--border,#ddd);background:var(--bg,#fff);min-width:200px;color:var(--text,#111);border-radius:8px;outline:none;flex:1;padding:8px 12px;font-size:14px}.HXRBOa_searchInput:focus{border-color:var(--accent,#e63946)}.HXRBOa_btnSearch{cursor:pointer;background:var(--accent,#e63946);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600}.HXRBOa_btnSearch:disabled{opacity:.6;cursor:default}.HXRBOa_aiToggle{color:var(--text-muted,#777);cursor:pointer;align-items:center;gap:4px;font-size:13px;display:flex}.HXRBOa_notice{color:var(--text,#111);background:#e6394612;border:1px solid #e6394640;border-radius:8px;padding:8px 12px;font-size:13px;line-height:1.5}.HXRBOa_empty{color:var(--text-muted,#777);padding:12px 0;font-size:13px}.HXRBOa_error{color:var(--danger,#e63946);font-size:13px}.HXRBOa_results{flex-direction:column;gap:14px;display:flex}.HXRBOa_sectionH{margin:0 0 8px;font-size:14px;font-weight:700}.HXRBOa_row{border:1px solid var(--border,#ddd);background:var(--bg-soft,#8080800d);border-radius:10px;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}.HXRBOa_rowMain{flex:1;min-width:0}.HXRBOa_rowName{word-break:break-all;font-size:14px;font-weight:700}.HXRBOa_tagInstalled{color:#2e8b57;background:#3fb27f1f;border:1px solid #3fb27f59;border-radius:999px;margin-left:6px;padding:1px 8px;font-size:11px;font-weight:600;display:inline-block}.HXRBOa_rowDesc{color:var(--text-muted,#777);margin-top:3px;font-size:13px;line-height:1.55}.HXRBOa_rowMeta{color:var(--text-muted,#999);margin-top:4px;font-size:12px}.HXRBOa_rowActions{flex-direction:column;flex:none;gap:6px;display:flex}.HXRBOa_btnInstall{cursor:pointer;background:var(--accent,#e63946);color:#fff;white-space:nowrap;border:none;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600}.HXRBOa_btnInstall:disabled{opacity:.6;cursor:default}.HXRBOa_btnAssess{cursor:pointer;border:1px solid var(--border,#ddd);color:var(--text,#111);white-space:nowrap;background:0 0;border-radius:8px;padding:6px 14px;font-size:13px}.HXRBOa_btnAssess:disabled{opacity:.6;cursor:default}.HXRBOa_introRow{flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:10px;display:flex}.HXRBOa_mydshLink{color:var(--accent,#e63946);white-space:nowrap;border:1px solid #e6394659;border-radius:999px;flex:none;padding:3px 12px;font-size:12px;font-weight:600;text-decoration:none}.HXRBOa_mydshLink:hover{background:#e6394614}.HXRBOa_tabs{border-bottom:1px solid var(--border,#ddd);gap:6px;padding-bottom:8px;display:flex}.HXRBOa_tab{cursor:pointer;color:var(--text-muted,#777);background:0 0;border:1px solid #0000;border-radius:8px 8px 0 0;padding:6px 14px;font-size:13px;font-weight:600}.HXRBOa_tabActive{color:var(--accent,#e63946);border-color:var(--border,#ddd);background:var(--bg-soft,#8080800d);border-bottom-color:#0000}.HXRBOa_catChips{flex-wrap:wrap;gap:6px;margin:10px 0 4px;display:flex}.HXRBOa_catChip{cursor:pointer;border:1px solid var(--border,#ddd);color:var(--text-muted,#777);background:0 0;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600}.HXRBOa_catChipActive{color:#fff;background:var(--accent,#e63946);border-color:var(--accent,#e63946)}.HXRBOa_btnUninstall{cursor:pointer;white-space:nowrap;border:1px solid var(--danger,#e63946);color:var(--danger,#e63946);background:0 0;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600}.HXRBOa_btnUninstall:disabled{opacity:.6;cursor:default}.HXRBOa_rowLink{color:var(--accent,#e63946);margin-left:8px;font-size:12px;text-decoration:none}.HXRBOa_rowLink:hover{text-decoration:underline}.HXRBOa_btnMore{cursor:pointer;border:1px solid var(--border,#ddd);color:var(--text,#111);background:0 0;border-radius:8px;margin:10px auto 4px;padding:8px 20px;font-size:13px;font-weight:600;display:block}.HXRBOa_btnMore:hover{border-color:var(--accent,#e63946);color:var(--accent,#e63946)}.HXRBOa_tagStatus{vertical-align:middle;border-radius:10px;margin-left:8px;padding:2px 8px;font-size:11px;font-weight:700;display:inline-block}.HXRBOa_tagStatusInstalled{color:#1a56db;background:#e8f0fe}.HXRBOa_tagStatusRestart{color:#b45309;background:#fef3c7}.HXRBOa_tagStatusActive{color:#15803d;background:#dcfce7}.HXRBOa_tagStatusBad{color:#b91c1c;background:#fee2e2}.HXRBOa_btnEnable,.HXRBOa_btnDisable{cursor:pointer;border:1px solid var(--border,#ddd);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600}.HXRBOa_btnEnable{color:#15803d;background:#dcfce7;border-color:#86efac}.HXRBOa_btnEnable:hover{background:#bbf7d0}.HXRBOa_btnDisable{color:#b45309;background:#fef3c7;border-color:#fde68a}.HXRBOa_btnDisable:hover{background:#fde68a}.HXRBOa_btnEnable:disabled,.HXRBOa_btnDisable:disabled{opacity:.6;cursor:default}.HXRBOa_rowNote{color:var(--muted,#666);margin:2px 0 10px 2px;font-size:12px}";
		const tagId = "dsh-plugin-market/MarketTab.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-market";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MarketTab_module_css_default = {
			"btnMore": "HXRBOa_btnMore",
			"rowName": "HXRBOa_rowName",
			"intro": "HXRBOa_intro",
			"tagStatusActive": "HXRBOa_tagStatusActive",
			"wrap": "HXRBOa_wrap",
			"tagStatusInstalled": "HXRBOa_tagStatusInstalled",
			"empty": "HXRBOa_empty",
			"tagStatus": "HXRBOa_tagStatus",
			"tabActive": "HXRBOa_tabActive",
			"catChipActive": "HXRBOa_catChipActive",
			"rowMeta": "HXRBOa_rowMeta",
			"mydshLink": "HXRBOa_mydshLink",
			"catChip": "HXRBOa_catChip",
			"row": "HXRBOa_row",
			"catChips": "HXRBOa_catChips",
			"btnSearch": "HXRBOa_btnSearch",
			"rowDesc": "HXRBOa_rowDesc",
			"tagStatusBad": "HXRBOa_tagStatusBad",
			"btnDisable": "HXRBOa_btnDisable",
			"tab": "HXRBOa_tab",
			"btnEnable": "HXRBOa_btnEnable",
			"results": "HXRBOa_results",
			"rowLink": "HXRBOa_rowLink",
			"error": "HXRBOa_error",
			"searchInput": "HXRBOa_searchInput",
			"introRow": "HXRBOa_introRow",
			"btnInstall": "HXRBOa_btnInstall",
			"sectionH": "HXRBOa_sectionH",
			"rowMain": "HXRBOa_rowMain",
			"tagInstalled": "HXRBOa_tagInstalled",
			"rowActions": "HXRBOa_rowActions",
			"tabs": "HXRBOa_tabs",
			"rowNote": "HXRBOa_rowNote",
			"btnAssess": "HXRBOa_btnAssess",
			"aiToggle": "HXRBOa_aiToggle",
			"searchRow": "HXRBOa_searchRow",
			"notice": "HXRBOa_notice",
			"btnUninstall": "HXRBOa_btnUninstall",
			"tagStatusRestart": "HXRBOa_tagStatusRestart"
		};
		//#endregion
		//#region lib/client/MarketTab.js
		/** 插件市场设置页 tab：分类浏览 / 搜索（本地+AI）/ 已安装管理 + mydsh.dev 引流。 */
		/** 分类列表（id → 标签 key；与 types.ts 的 MARKET_CATEGORIES 单一来源）。 */
		const CATEGORY_LABEL_KEYS = ["all", ...MARKET_CATEGORIES.map((c) => c.id)];
		/** 状态徽章文案与样式(用户语言)。 */
		function statusBadge(status, t) {
			switch (status) {
				case "installed": return (0, react_jsx_runtime.jsx)("span", {
					className: `${MarketTab_module_css_default.tagStatus} ${MarketTab_module_css_default.tagStatusInstalled}`,
					children: t("stInstalled")
				});
				case "enabled-restart": return (0, react_jsx_runtime.jsx)("span", {
					className: `${MarketTab_module_css_default.tagStatus} ${MarketTab_module_css_default.tagStatusRestart}`,
					children: t("stEnabledRestart")
				});
				case "enabled-active": return (0, react_jsx_runtime.jsx)("span", {
					className: `${MarketTab_module_css_default.tagStatus} ${MarketTab_module_css_default.tagStatusActive}`,
					children: t("stEnabled")
				});
				case "disabled-restart": return (0, react_jsx_runtime.jsx)("span", {
					className: `${MarketTab_module_css_default.tagStatus} ${MarketTab_module_css_default.tagStatusRestart}`,
					children: t("stDisabledRestart")
				});
				case "incompatible": return (0, react_jsx_runtime.jsx)("span", {
					className: `${MarketTab_module_css_default.tagStatus} ${MarketTab_module_css_default.tagStatusBad}`,
					children: t("stIncompatible")
				});
				case "install-failed": return (0, react_jsx_runtime.jsx)("span", {
					className: `${MarketTab_module_css_default.tagStatus} ${MarketTab_module_css_default.tagStatusBad}`,
					children: t("stFailed")
				});
				default: return null;
			}
		}
		/** 按状态渲染动作按钮(用户语言,无内部术语)。 */
		function statusActions(p, status, busy, onInstall, onEnable, onDisable, onUninstall, onAssess, t) {
			const btns = [];
			const push = (node) => {
				btns.push(node);
			};
			switch (status) {
				case "enabled-active":
				case "enabled-restart":
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnDisable,
						disabled: busy?.disabling === true,
						onClick: () => onDisable(p.full_name),
						children: busy?.disabling === true ? t("disabling") : t("disable")
					}, "d"));
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnUninstall,
						disabled: busy?.uninstalling === true,
						onClick: () => onUninstall(p.full_name),
						children: busy?.uninstalling === true ? t("uninstalling") : t("uninstall")
					}, "u"));
					break;
				case "disabled-restart":
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnEnable,
						disabled: busy?.enabling === true,
						onClick: () => onEnable(p.full_name),
						children: busy?.enabling === true ? t("enabling") : t("enable")
					}, "e"));
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnUninstall,
						disabled: busy?.uninstalling === true,
						onClick: () => onUninstall(p.full_name),
						children: busy?.uninstalling === true ? t("uninstalling") : t("uninstall")
					}, "u"));
					break;
				case "installed":
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnEnable,
						disabled: busy?.enabling === true,
						onClick: () => onEnable(p.full_name),
						children: busy?.enabling === true ? t("enabling") : t("enable")
					}, "e"));
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnUninstall,
						disabled: busy?.uninstalling === true,
						onClick: () => onUninstall(p.full_name),
						children: busy?.uninstalling === true ? t("uninstalling") : t("uninstall")
					}, "u"));
					break;
				case "incompatible":
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnUninstall,
						disabled: busy?.uninstalling === true,
						onClick: () => onUninstall(p.full_name),
						children: busy?.uninstalling === true ? t("uninstalling") : t("uninstall")
					}, "u"));
					break;
				case "install-failed":
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnInstall,
						disabled: busy?.installing === true,
						onClick: () => onInstall(p.full_name),
						children: busy?.installing === true ? t("installing") : t("retryInstall")
					}, "i"));
					push((0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MarketTab_module_css_default.btnUninstall,
						disabled: busy?.uninstalling === true,
						onClick: () => onUninstall(p.full_name),
						children: busy?.uninstalling === true ? t("uninstalling") : t("uninstall")
					}, "u"));
					break;
				default: push((0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: MarketTab_module_css_default.btnInstall,
					disabled: busy?.installing === true,
					onClick: () => onInstall(p.full_name),
					children: busy?.installing === true ? t("installing") : t("install")
				}, "i"));
			}
			push((0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: MarketTab_module_css_default.btnAssess,
				disabled: busy?.assessing === true,
				onClick: () => onAssess(p.full_name),
				children: busy?.assessing === true ? t("assessing") : t("assess")
			}, "a"));
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: btns });
		}
		/** 渲染一个插件行(状态徽章 + 按状态动作 + mydsh 详情引流)。 */
		function PluginRow(p, status, busy, onInstall, onEnable, onDisable, onUninstall, onAssess, t) {
			const desc = p.zh_desc ?? p.en_desc ?? p.description ?? t("noDesc");
			const isRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.full_name);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MarketTab_module_css_default.row,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: MarketTab_module_css_default.rowMain,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: MarketTab_module_css_default.rowName,
							children: [p.full_name, statusBadge(status, t)]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: MarketTab_module_css_default.rowDesc,
							children: desc
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: MarketTab_module_css_default.rowMeta,
							children: [
								(0, react_jsx_runtime.jsxs)("span", { children: ["★ ", p.stargazers_count.toLocaleString()] }),
								p.language ? (0, react_jsx_runtime.jsxs)("span", { children: ["· ", p.language] }) : null,
								isRepo ? (0, react_jsx_runtime.jsx)("a", {
									className: MarketTab_module_css_default.rowLink,
									href: `https://mydsh.dev/plugin?repo=${encodeURIComponent(p.full_name)}`,
									target: "_blank",
									rel: "noopener",
									children: "mydsh.dev ↗"
								}) : null
							]
						})
					]
				}), (0, react_jsx_runtime.jsx)("div", {
					className: MarketTab_module_css_default.rowActions,
					children: statusActions(p, status, busy, onInstall, onEnable, onDisable, onUninstall, onAssess, t)
				})]
			});
		}
		/** Render the plugin market Settings tab. */
		function MarketTab({ search, browse, install, uninstall, enable, disable, status, lifecycle, assess, installed, t }) {
			const [view, setView] = (0, react.useState)("browse");
			const [category, setCategory] = (0, react.useState)("all");
			const [query, setQuery] = (0, react.useState)("");
			const [useAi, setUseAi] = (0, react.useState)(false);
			const [browseState, setBrowseState] = (0, react.useState)({ status: "idle" });
			const [searchState, setSearchState] = (0, react.useState)({ status: "idle" });
			const [installedState, setInstalledState] = (0, react.useState)(null);
			/** 全量生命周期(状态/冲突/失败记录),拉一次供各行查询。 */
			const [lifecycleState, setLifecycleState] = (0, react.useState)(null);
			const [busyRow, setBusyRow] = (0, react.useState)(null);
			const [busyAction, setBusyAction] = (0, react.useState)("install");
			const [notice, setNotice] = (0, react.useState)("");
			const [mydshLink, setMydshLink] = (0, react.useState)("https://mydsh.dev/plugins");
			const [allPlugins, setAllPlugins] = (0, react.useState)(null);
			const [allCounts, setAllCounts] = (0, react.useState)(null);
			const [visibleCount, setVisibleCount] = (0, react.useState)(50);
			const PAGE = 50;
			/** 当前分类的完整本地列表（缓存命中时零网络）。 */
			function filteredList(cat) {
				if (allPlugins === null) return [];
				return cat === "all" ? allPlugins : allPlugins.filter((p) => categoryOf(p) === cat);
			}
			/** 请求序号守卫：分类快速切换时丢弃过期响应，避免旧分类覆盖新分类。 */
			const browseSeq = (0, react.useRef)(0);
			/** 搜索序号守卫：本地/AI 搜索的过期响应不覆盖新结果（AI 搜索可达 6s+）。 */
			const searchSeq = (0, react.useRef)(0);
			const runBrowse = async (cat) => {
				const seq = ++browseSeq.current;
				if (allPlugins !== null) {
					const list = filteredList(cat);
					setVisibleCount(PAGE);
					setBrowseState({
						status: "ready",
						result: {
							ok: true,
							category: cat,
							plugins: list.slice(0, PAGE),
							counts: allCounts ?? {}
						}
					});
					return;
				}
				setBrowseState({ status: "loading" });
				try {
					const result = await browse("all", 0);
					if (seq !== browseSeq.current) return;
					setAllPlugins(result.plugins);
					setAllCounts(result.counts);
					setVisibleCount(PAGE);
					const list = cat === "all" ? result.plugins : result.plugins.filter((p) => categoryOf(p) === cat);
					setBrowseState({
						status: "ready",
						result: {
							...result,
							category: cat,
							plugins: list.slice(0, PAGE)
						}
					});
				} catch (e) {
					if (seq !== browseSeq.current) return;
					setBrowseState({
						status: "error",
						message: String(e)
					});
				}
			};
			/** 「加载更多」：从本地缓存继续切片，瞬时。 */
			const loadMore = () => {
				if (browseState.status !== "ready" || allPlugins === null) return;
				const next = visibleCount + PAGE;
				setVisibleCount(next);
				const list = filteredList(browseState.result.category);
				setBrowseState({
					status: "ready",
					result: {
						...browseState.result,
						plugins: list.slice(0, next)
					}
				});
			};
			const runSearch = async (q, ai) => {
				const queryText = q.trim();
				if (queryText.length === 0) return;
				const seq = ++searchSeq.current;
				setSearchState({ status: "loading" });
				setNotice("");
				try {
					const result = await search(queryText, ai);
					if (seq !== searchSeq.current) return;
					setSearchState({
						status: "ready",
						result
					});
				} catch (e) {
					if (seq !== searchSeq.current) return;
					setSearchState({
						status: "error",
						message: String(e)
					});
				}
			};
			const loadInstalled = async () => {
				try {
					const result = await installed();
					setInstalledState(result);
				} catch (e) {
					setNotice(`⚠️ ${String(e)}`);
				}
			};
			const loadLifecycle = async () => {
				try {
					setLifecycleState(await lifecycle());
				} catch {}
			};
			/** 行状态:lifecycle 的 key 是 owner/repo。 */
			const statusOf = (name) => lifecycleState?.items[name]?.status;
			const reasonOf = (name) => lifecycleState?.items[name]?.reason;
			const lastErrorOf = (name) => lifecycleState?.items[name]?.lastError;
			(0, react.useEffect)(() => {
				runBrowse("all");
				loadInstalled();
				loadLifecycle();
			}, []);
			const switchView = (v) => {
				setView(v);
				setNotice("");
				if (v === "browse") runBrowse(category);
				if (v === "installed") loadInstalled();
				loadLifecycle();
			};
			const afterMutation = async (ok, detail) => {
				setNotice(ok ? detail : `⚠️ ${detail.slice(0, 200)}`);
				await loadInstalled();
				await loadLifecycle();
				if (view === "browse") runBrowse(category);
			};
			const handleInstall = async (name) => {
				if (!window.confirm(t("confirmInstall").replace("{name}", name))) return;
				setBusyRow(name);
				setBusyAction("install");
				setNotice("");
				try {
					await afterMutation(...await install(name).then((r) => [r.ok, r.detail]));
				} catch (e) {
					setNotice(`⚠️ ${String(e)}`);
				} finally {
					setBusyRow(null);
				}
			};
			const handleEnable = async (name) => {
				if (!window.confirm(t("confirmEnable").replace("{name}", name))) return;
				setBusyRow(name);
				setBusyAction("enable");
				setNotice("");
				try {
					const r = await enable(name);
					await afterMutation(r.ok, r.ok ? r.restartRequired ? t("enabledRestartHint") : r.detail : r.detail);
				} catch (e) {
					setNotice(`⚠️ ${String(e)}`);
				} finally {
					setBusyRow(null);
				}
			};
			const handleDisable = async (name) => {
				if (!window.confirm(t("confirmDisable").replace("{name}", name))) return;
				setBusyRow(name);
				setBusyAction("disable");
				setNotice("");
				try {
					const r = await disable(name);
					await afterMutation(r.ok, r.ok ? r.restartRequired ? t("disabledRestartHint") : r.detail : r.detail);
				} catch (e) {
					setNotice(`⚠️ ${String(e)}`);
				} finally {
					setBusyRow(null);
				}
			};
			const handleUninstall = async (name) => {
				if (!window.confirm(t("confirmUninstall").replace("{name}", name))) return;
				setBusyRow(name);
				setBusyAction("uninstall");
				setNotice("");
				try {
					await afterMutation(...await uninstall(name).then((r) => [r.ok, r.detail]));
				} catch (e) {
					setNotice(`⚠️ ${String(e)}`);
				} finally {
					setBusyRow(null);
				}
			};
			const handleAssess = async (name) => {
				setBusyRow(name);
				setBusyAction("assess");
				setNotice("");
				try {
					const result = await assess(name);
					if (result.status === "reported") setNotice(`✅ ${result.detail}（风险分 ${result.risk_score ?? "—"}/100）`);
					else if (result.status === "pending") setNotice(`ℹ️ ${result.detail}`);
					else setNotice(`⚠️ ${result.detail}`);
				} catch (e) {
					setNotice(`⚠️ ${String(e)}`);
				} finally {
					setBusyRow(null);
				}
			};
			/** 行级 busy：只有与当前操作行匹配的行显示进行中。 */
			const busyFor = (name) => {
				if (busyRow !== name) return null;
				return {
					installing: busyAction === "install",
					enabling: busyAction === "enable",
					disabling: busyAction === "disable",
					uninstalling: busyAction === "uninstall",
					assessing: busyAction === "assess"
				};
			};
			const catalogOf = (name) => allPlugins?.find((p) => p.full_name === name);
			const lifecycleRows = lifecycleState ? Object.entries(lifecycleState.items).map(([name, life]) => {
				const cat = catalogOf(name);
				const desc = cat?.zh_desc ?? cat?.description ?? life.installedName ?? name;
				return {
					full_name: name,
					description: desc,
					zh_desc: desc,
					language: cat?.language ?? "",
					stargazers_count: cat?.stargazers_count ?? 0,
					forks_count: cat?.forks_count ?? 0,
					topics: cat?.topics ?? [],
					html_url: cat?.html_url ?? `https://github.com/${name}`,
					installed: true
				};
			}) : [];
			const installedRows = lifecycleRows.length > 0 ? lifecycleRows : installedState ? Object.entries(installedState.sources).map(([dep, src]) => {
				const repo = src.includes("/") && !src.startsWith("@") ? src : dep;
				const cat = catalogOf(repo);
				const desc = cat?.zh_desc ?? cat?.description ?? dep;
				return {
					full_name: repo,
					description: desc,
					zh_desc: desc,
					language: cat?.language ?? "",
					stargazers_count: cat?.stargazers_count ?? 0,
					forks_count: cat?.forks_count ?? 0,
					topics: cat?.topics ?? [],
					html_url: cat?.html_url ?? `https://github.com/${repo}`,
					installed: true
				};
			}) : [];
			const counts = browseState.status === "ready" ? browseState.result.counts : null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MarketTab_module_css_default.wrap,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: MarketTab_module_css_default.introRow,
						children: [(0, react_jsx_runtime.jsx)("p", {
							className: MarketTab_module_css_default.intro,
							children: t("intro")
						}), (0, react_jsx_runtime.jsxs)("a", {
							className: MarketTab_module_css_default.mydshLink,
							href: mydshLink,
							target: "_blank",
							rel: "noopener",
							children: [
								"🌐 mydsh.dev ",
								(0, react_jsx_runtime.jsx)("span", {
									"data-i18n": "market_site",
									children: "插件大全"
								}),
								" ↗"
							]
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: MarketTab_module_css_default.tabs,
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: view === "browse" ? `${MarketTab_module_css_default.tab} ${MarketTab_module_css_default.tabActive}` : MarketTab_module_css_default.tab,
								onClick: () => switchView("browse"),
								children: t("browseTab")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: view === "search" ? `${MarketTab_module_css_default.tab} ${MarketTab_module_css_default.tabActive}` : MarketTab_module_css_default.tab,
								onClick: () => switchView("search"),
								children: t("searchTab")
							}),
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: view === "installed" ? `${MarketTab_module_css_default.tab} ${MarketTab_module_css_default.tabActive}` : MarketTab_module_css_default.tab,
								onClick: () => switchView("installed"),
								children: [t("installedTab"), lifecycleState ? `（${Object.keys(lifecycleState.items).length}）` : installedState ? `（${installedState.installed.length}）` : ""]
							})
						]
					}),
					notice !== "" ? (0, react_jsx_runtime.jsx)("p", {
						className: MarketTab_module_css_default.notice,
						children: notice
					}) : null,
					view === "browse" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: MarketTab_module_css_default.catChips,
							children: CATEGORY_LABEL_KEYS.map((id) => (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: category === id ? `${MarketTab_module_css_default.catChip} ${MarketTab_module_css_default.catChipActive}` : MarketTab_module_css_default.catChip,
								onClick: () => {
									setCategory(id);
									runBrowse(id);
								},
								children: [t(`cat_${id}`), counts && id !== "all" ? ` ${counts[id] ?? 0}` : ""]
							}, id))
						}),
						browseState.status === "loading" ? (0, react_jsx_runtime.jsx)("p", {
							className: MarketTab_module_css_default.empty,
							children: t("loading")
						}) : null,
						browseState.status === "error" ? (0, react_jsx_runtime.jsxs)("p", {
							className: MarketTab_module_css_default.error,
							children: [
								t("errLoad"),
								"：",
								browseState.message
							]
						}) : null,
						browseState.status === "ready" ? (0, react_jsx_runtime.jsxs)("div", {
							className: MarketTab_module_css_default.results,
							children: [browseState.result.plugins.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: MarketTab_module_css_default.empty,
								children: t("emptyResult")
							}) : browseState.result.plugins.map((p) => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t)), allPlugins !== null && browseState.result.plugins.length < filteredList(browseState.result.category).length ? (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: MarketTab_module_css_default.btnMore,
								onClick: loadMore,
								children: [
									t("loadMore"),
									"（",
									browseState.result.plugins.length,
									"/",
									filteredList(browseState.result.category).length,
									"）"
								]
							}) : null]
						}) : null
					] }) : null,
					view === "search" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: MarketTab_module_css_default.searchRow,
							children: [
								(0, react_jsx_runtime.jsx)("input", {
									className: MarketTab_module_css_default.searchInput,
									type: "search",
									placeholder: t("searchPh"),
									value: query,
									onChange: (e) => setQuery(e.target.value),
									onKeyDown: (e) => {
										if (e.key === "Enter") runSearch(query, useAi);
									}
								}),
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: MarketTab_module_css_default.btnSearch,
									onClick: () => void runSearch(query, useAi),
									children: useAi ? t("aiSearchBtn") : t("searchBtn")
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: MarketTab_module_css_default.aiToggle,
									children: [(0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: useAi,
										onChange: (e) => setUseAi(e.target.checked)
									}), "🤖 AI"]
								})
							]
						}),
						searchState.status === "idle" ? (0, react_jsx_runtime.jsx)("p", {
							className: MarketTab_module_css_default.empty,
							children: t("empty")
						}) : null,
						searchState.status === "loading" ? (0, react_jsx_runtime.jsx)("p", {
							className: MarketTab_module_css_default.empty,
							children: t("searching")
						}) : null,
						searchState.status === "error" ? (0, react_jsx_runtime.jsxs)("p", {
							className: MarketTab_module_css_default.error,
							children: [
								t("errLoad"),
								"：",
								searchState.message
							]
						}) : null,
						searchState.status === "ready" ? (0, react_jsx_runtime.jsxs)("div", {
							className: MarketTab_module_css_default.results,
							children: [
								searchState.result.local.length > 0 ? (0, react_jsx_runtime.jsxs)("section", { children: [(0, react_jsx_runtime.jsxs)("h3", {
									className: MarketTab_module_css_default.sectionH,
									children: [
										t("localTab"),
										"（",
										searchState.result.local.length,
										"）"
									]
								}), searchState.result.local.map((p) => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t))] }) : null,
								searchState.result.ai.length > 0 ? (0, react_jsx_runtime.jsxs)("section", { children: [(0, react_jsx_runtime.jsxs)("h3", {
									className: MarketTab_module_css_default.sectionH,
									children: [
										t("aiTab"),
										"（",
										searchState.result.ai.length,
										"）"
									]
								}), searchState.result.ai.map((p) => PluginRow(p, statusOf(p.full_name), busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t))] }) : null,
								searchState.result.local.length === 0 && searchState.result.ai.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
									className: MarketTab_module_css_default.empty,
									children: t("emptyResult")
								}) : null
							]
						}) : null
					] }) : null,
					view === "installed" ? (0, react_jsx_runtime.jsxs)("div", {
						className: MarketTab_module_css_default.results,
						children: [installedRows.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
							className: MarketTab_module_css_default.empty,
							children: t("noInstalled")
						}) : null, installedRows.map((p) => {
							const st = statusOf(p.full_name);
							const reason = reasonOf(p.full_name);
							const failed = lastErrorOf(p.full_name);
							return (0, react_jsx_runtime.jsxs)("div", { children: [
								PluginRow(p, st, busyFor(p.full_name), handleInstall, handleEnable, handleDisable, handleUninstall, handleAssess, t),
								reason ? (0, react_jsx_runtime.jsx)("p", {
									className: MarketTab_module_css_default.rowNote,
									children: reason
								}) : null,
								failed ? (0, react_jsx_runtime.jsxs)("p", {
									className: MarketTab_module_css_default.rowNote,
									children: [
										t("failedHint"),
										": ",
										failed.slice(0, 160)
									]
								}) : null
							] }, p.full_name);
						})]
					}) : null
				]
			});
		}
		//#endregion
		//#region lib/client/locales.js
		/** Copy dictionaries for the plugin market Settings section. */
		/** Simplified Chinese dictionary and key source of truth. */
		const zh = {
			tab: "插件市场",
			intro: "浏览 mydsh.dev 插件大全：分类浏览、本地/AI 搜索、安装、启用、停用、卸载与安全评估。",
			market_site: "插件大全",
			browseTab: "分类浏览",
			searchTab: "搜索",
			installedTab: "已安装",
			cat_all: "全部",
			cat_agent: "Agent",
			cat_mcp: "MCP",
			cat_devtools: "开发工具",
			cat_ui: "界面",
			cat_vision: "视觉",
			cat_llm: "LLM",
			cat_memory: "记忆",
			cat_data: "数据",
			cat_integrations: "集成",
			cat_other: "其他",
			searchPh: "搜索插件，如 MCP、终端、记忆…",
			searchBtn: "搜索",
			aiSearchBtn: "🤖 AI 搜索",
			searching: "搜索中…",
			loading: "加载中…",
			empty: "输入关键词开始搜索，或用 AI 搜索描述你的需求。",
			emptyResult: "没有匹配的插件，换个关键词或分类试试。",
			noInstalled: "还没有安装任何插件。去「分类浏览」看看吧。",
			localTab: "本地匹配",
			aiTab: "AI 推荐",
			install: "安装",
			installing: "安装中…",
			enabling: "启用中…",
			disabling: "停用中…",
			uninstall: "卸载",
			uninstalling: "卸载中…",
			installed: "已安装",
			installedTag: "已安装",
			stInstalled: "已安装·未启用",
			stEnabledRestart: "已启用·重启后生效",
			stEnabled: "已启用",
			stDisabledRestart: "已停用·重启后生效",
			stIncompatible: "不兼容·不建议启用",
			stFailed: "安装失败",
			enable: "启用",
			disable: "停用",
			retryInstall: "重试安装",
			enabledRestartHint: "✅ 已启用。重启 DSH 后生效。",
			disabledRestartHint: "✅ 已停用（仍保留安装，可随时重新启用）。重启 DSH 后生效。",
			failedHint: "上次安装失败",
			restartHint: "✅ 安装成功。下一步点击「启用」，重启 DSH 后开始使用。",
			uninstalledHint: "✅ 卸载完成，重启 DSH 后移除。",
			confirmInstall: "确认安装 {name}？安装后需要手动启用，可随时卸载。",
			confirmEnable: "确认启用 {name}？启用后需重启 DSH 生效，可随时停用。",
			confirmDisable: "确认停用 {name}？停用后需重启 DSH 生效，插件仍保留安装，可随时重新启用。",
			confirmUninstall: "确认卸载 {name}？将移除插件及其配置，重启 DSH 后完成。",
			assess: "安全评估",
			assessing: "评估中…",
			assessReported: "已有安全报告",
			assessPending: "待人工复核",
			stars: "Star",
			lang: "语言",
			noDesc: "暂无简介",
			errLoad: "加载失败",
			retry: "重试",
			loadMore: "加载更多"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			tab: "Plugin Market",
			intro: "Browse the mydsh.dev plugin catalog: categories, local/AI search, install, enable, disable, uninstall, and security assessment.",
			market_site: "catalog",
			browseTab: "Browse",
			searchTab: "Search",
			installedTab: "Installed",
			cat_all: "All",
			cat_agent: "Agent",
			cat_mcp: "MCP",
			cat_devtools: "Dev tools",
			cat_ui: "UI",
			cat_vision: "Vision",
			cat_llm: "LLM",
			cat_memory: "Memory",
			cat_data: "Data",
			cat_integrations: "Integrations",
			cat_other: "Other",
			searchPh: "Search plugins, e.g. MCP, terminal, memory…",
			searchBtn: "Search",
			aiSearchBtn: "🤖 AI Search",
			searching: "Searching…",
			loading: "Loading…",
			empty: "Type a keyword, or use AI search to describe what you need.",
			emptyResult: "No matching plugins. Try different keywords or categories.",
			noInstalled: "Nothing installed yet. Head to Browse!",
			localTab: "Local matches",
			aiTab: "AI picks",
			install: "Install",
			installing: "Installing…",
			enabling: "Enabling…",
			disabling: "Disabling…",
			uninstall: "Uninstall",
			uninstalling: "Uninstalling…",
			installed: "Installed",
			installedTag: "Installed",
			stInstalled: "Installed · off",
			stEnabledRestart: "Enabled · restart to apply",
			stEnabled: "Enabled",
			stDisabledRestart: "Disabled · restart to apply",
			stIncompatible: "Incompatible · not recommended",
			stFailed: "Install failed",
			enable: "Enable",
			disable: "Disable",
			retryInstall: "Retry install",
			enabledRestartHint: "✅ Enabled. Restart DSH to apply.",
			disabledRestartHint: "✅ Disabled (still installed, re-enable anytime). Restart DSH to apply.",
			failedHint: "Last install failed",
			restartHint: "✅ Installed. Next: click Enable, then restart DSH to use it.",
			uninstalledHint: "✅ Uninstalled — restart DSH to remove.",
			confirmInstall: "Install {name}? You will need to enable it manually; it can be uninstalled anytime.",
			confirmEnable: "Enable {name}? Takes effect after restarting DSH; you can disable it anytime.",
			confirmDisable: "Disable {name}? Takes effect after restarting DSH; the plugin stays installed and can be re-enabled anytime.",
			confirmUninstall: "Uninstall {name}? This removes the plugin and its config after restarting DSH.",
			assess: "Security",
			assessing: "Assessing…",
			assessReported: "Report available",
			assessPending: "Pending review",
			stars: "Stars",
			lang: "Language",
			noDesc: "No description",
			errLoad: "Failed to load",
			retry: "Retry",
			loadMore: "Load more"
		};
		//#endregion
		//#region lib/client/index.js
		/** 插件市场 browser half：注册到 Settings → 插件 区域的 tab。 */
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.pluginMarket";
		/** Services required by the Settings registration. */
		const inject = ["slots", "locale"];
		/** Contribute the lazy market tab to the Plugins settings section. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-plugin-market: dictionaries");
			const t = ctx.locale.bind(NS);
			async function fetchJson(path, body) {
				const resp = await fetch(path, {
					method: body === void 0 ? "GET" : "POST",
					headers: body === void 0 ? void 0 : { "content-type": "application/json" },
					body: body === void 0 ? void 0 : JSON.stringify(body)
				});
				if (!resp.ok) try {
					const body = await resp.json();
					throw new Error(body.detail ?? body.message ?? `HTTP ${resp.status}`);
				} catch (e) {
					if (e instanceof Error && e.message !== `HTTP ${resp.status}`) throw e;
					throw new Error(`HTTP ${resp.status}`);
				}
				const data = await resp.json();
				if (data.ok === false) throw new Error(data.detail ?? data.message ?? "操作未完成，请重试。");
				return data;
			}
			const injected = () => ({
				search: (query, ai = false) => fetchJson("/api/plugin-market/search", {
					query,
					ai
				}),
				browse: (category, limit = 50) => fetchJson("/api/plugin-market/browse", {
					category,
					limit
				}),
				install: (repo) => fetchJson("/api/plugin-market/install", { repo }),
				uninstall: (repo) => fetchJson("/api/plugin-market/uninstall", { repo }),
				enable: (repo) => fetchJson("/api/plugin-market/enable", { repo }),
				disable: (repo) => fetchJson("/api/plugin-market/disable", { repo }),
				status: (repo) => fetchJson("/api/plugin-market/status", { repo }),
				lifecycle: () => fetchJson("/api/plugin-market/lifecycle"),
				assess: (repo) => fetchJson("/api/plugin-market/assess", { repo }),
				installed: () => fetchJson("/api/plugin-market/installed")
			});
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "market",
				order: 5,
				label: () => t("tab"),
				locale: NS,
				inject: injected
			}, MarketTab));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map