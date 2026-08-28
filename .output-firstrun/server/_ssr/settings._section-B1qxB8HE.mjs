import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-D46NpEQY.mjs";
import { _ as Link, v as Navigate, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { $t as Info, Ar as Accessibility, Bn as Clock, Cn as Eye, Ct as MousePointer2, E as Smartphone, Gn as CircleSlash, It as MemoryStick, Kt as Link2, M as ShieldCheck, N as ShieldAlert, Nn as Copy, Nt as MessageSquare, Ot as MonitorCog, Q as Radio, Rn as CloudOff, St as OctagonX, T as Sparkles, Tn as ExternalLink, U as Scale, Vt as Lock, W as Save, Wt as LoaderCircle, Xt as Laptop, Y as RefreshCw, Zn as CircleArrowUp, Zt as Keyboard, a as WifiOff, at as Plug, bn as FileDown, cn as Globe, ct as Pin, d as User, dr as Brain, h as Trash2, hr as Bot, i as Wifi, ir as Check, it as Plus, jn as Cpu, kr as Activity, lt as PinOff, m as TriangleAlert, nn as Image, on as HardDrive, ot as PlugZap, q as RotateCcw, qt as Link2Off, sr as Captions, vt as Package, zt as LogOut } from "../_libs/lucide-react.mjs";
import { c as stringType, o as objectType } from "../_libs/zod.mjs";
import { n as chooseRenderTier, s as starCountFor } from "./universe-CvRdDAaW.mjs";
import { p as subscribeCompanionAdapter, s as getCompanion, t as COMPANION_UNAVAILABLE_REASON } from "./companion-bridge-CJ48JKAT.mjs";
import { l as getBrowserBridge } from "./tauri-companion-u0J6qjWn.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-VpaXwoLS.mjs";
import { i as recordAction } from "./actions-DmZ4Jhtn.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CA8BQOW2.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as StatusBadge } from "./StatusBadge-B-3ICXuc.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as OCADE_MODEL_ID } from "./fixed-model-DezWsm1J.mjs";
import { r as discoverLocalModels, t as DEFAULT_LOCAL_BRIDGE_URL } from "./ocade-local-D4ziVbup.mjs";
import { r as routeTask, t as PerfLedger } from "./router-policy-DWW41ATq.mjs";
import { t as TOKEN_LIFETIME_MS } from "./pairing-DCQPVIpW.mjs";
import { i as formatSize, l as sha256For, o as resolvedFor, t as WASM_TIERS, u as storageKeyFor } from "./browser-catalogue-BYTmauOS.mjs";
import { n as modelStore, t as ModelStore } from "./model-store-BPT0fGRD.mjs";
import { n as importModelFile } from "./model-download-DGFhh7HL.mjs";
import { t as PairedDesktopAdapter } from "./paired-desktop-BmU9OPp9.mjs";
import { r as useDevicePolicy, t as describeDeviceSource } from "./use-device-policy-3_-2tPN5.mjs";
import { a as savePairing, n as hasPairing, r as pairedCredentials, t as forgetPairing } from "./paired-credentials-DTehWMvo.mjs";
import { a as persistComputerUseSettings, i as normalizeComputerUseSettings, r as loadComputerUseSettings } from "./computer-use-settings-EFoxzXrd.mjs";
import { o as permissionRuleValueFromString, r as loadRules, s as saveRules } from "./permission-settings-DN6ulIHW.mjs";
import { t as GestureControlPanel } from "./GestureControlPanel-B_ZnCKnK.mjs";
import { t as OCADE_IDENTITY } from "./ocade-identity-BWv-E_0R.mjs";
import { n as useChatPrefs } from "./use-chat-prefs-NPtv7oUs.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as useOnline } from "./use-online-DzqlfJYh.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { t as useLocalEngine } from "./use-local-engine-CD0fQoND.mjs";
import { n as formatErrorJournal, r as readErrorJournal, t as clearErrorJournal } from "./error-journal-BvqPVLIA.mjs";
import { m as listLocalProjects } from "./local-projects-B2cSPBm_.mjs";
import { _ as purgeExpiredMemory, b as updateLocalMemory, c as deleteLocalMemory, d as getMemoryEnabled, f as inspectLocalMemory, g as purgeExpiredLocalMemory, l as deleteMemory, n as addLocalMemory, o as clearAllMemory, p as listMemory, r as addMemory, s as clearLocalMemory, v as setLocalMemoryEnabled, x as updateMemory, y as setMemoryEnabled } from "./ocade-projects.functions-DvnscdLs.mjs";
import { t as DiagnosticsPanel } from "./DiagnosticsPanel-BowDafPw.mjs";
import { n as LocalModelLifecyclePanel, t as LocalEngineControl } from "./LocalEngineControl-C-EOGLvZ.mjs";
import { n as useSettingsAccess } from "./use-settings-access-CqrFa1Nj.mjs";
import { r as SettingsField, t as ReadOnlyBanner } from "./SettingsGate-BOwuQuSO.mjs";
import { n as findSection } from "./settings-sections-B_Tmz4a1.mjs";
import { n as Route, r as useDepth } from "./settings._section-D6SV4Knm.mjs";
import { t as activeDevices } from "./device-store-CRf9IOAa.mjs";
import { t as verifyUpdateSignature } from "./update-signature-CRBJR1Bs.mjs";
import { t as PerformanceFallbackNotice } from "./PerformanceFallbackNotice-BPDXFStg.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/radix-ui__react-switch.mjs";
import { t as Root } from "../_libs/radix-ui__react-label.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings._section-B1qxB8HE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* OCADE memory review (Plan §19, decision #31).
*
* Memory is OPT-IN, and everything OCADE remembers is reviewable, editable and
* deletable here. It is deliberately separate from ordinary conversation
* history: deleting a memory does not delete a chat, and vice versa.
*
* Cloud rows use the ready-to-apply migration. When that dependency is absent,
* the panel switches explicitly to on-device storage and never claims sync.
*/
function MemoryPanel() {
	const { user } = useSession();
	const [enabled, setEnabled] = (0, import_react.useState)(null);
	const [rows, setRows] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [notice, setNotice] = (0, import_react.useState)(null);
	const [backend, setBackend] = (0, import_react.useState)("cloud");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [drafts, setDrafts] = (0, import_react.useState)({});
	/** Text for a new, user-authored memory. */
	const [newMemory, setNewMemory] = (0, import_react.useState)("");
	const [memoryScope, setMemoryScope] = (0, import_react.useState)("user");
	const [memoryProjectId, setMemoryProjectId] = (0, import_react.useState)("");
	const [memoryRetention, setMemoryRetention] = (0, import_react.useState)("keep");
	const [projects, setProjects] = (0, import_react.useState)([]);
	async function refresh(forceLocal = false) {
		setError(null);
		if (forceLocal) {
			const local = inspectLocalMemory();
			if (!local.ok) {
				setError(local.reason);
				setEnabled(null);
				setRows(null);
				return;
			}
			setBackend("local");
			setEnabled(local.data.enabled);
			setRows(local.data.enabled ? local.data.rows : []);
			return;
		}
		try {
			const { enabled: on } = await getMemoryEnabled();
			setBackend("cloud");
			setNotice(null);
			setEnabled(on);
			setRows(on ? await listMemory({ data: {} }) : []);
		} catch (e) {
			const cloudReason = e instanceof Error ? e.message : "Cloud memory isn't available yet.";
			const local = inspectLocalMemory();
			if (!local.ok) {
				setError(`${cloudReason} Local fallback also failed: ${local.reason}`);
				setEnabled(null);
				setRows(null);
				return;
			}
			setBackend("local");
			setNotice(`Cloud memory is unavailable (${cloudReason}). Using explicit on-device memory.`);
			setEnabled(local.data.enabled);
			setRows(local.data.enabled ? local.data.rows : []);
		}
	}
	(0, import_react.useEffect)(() => {
		refresh();
		if (user?.id) listLocalProjects(user.id).then((available) => setProjects(available)).catch(() => setProjects([]));
	}, [user?.id]);
	async function toggle(next) {
		setBusy(true);
		try {
			if (backend === "local") {
				const result = setLocalMemoryEnabled(next);
				if (!result.ok) throw new Error(result.reason);
			} else await setMemoryEnabled({ data: { enabled: next } });
			toast.success(next ? `OCADE may now remember things you approve ${backend === "local" ? "on this device" : "in private sync"}.` : "Memory turned off.");
			await refresh(backend === "local");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not change the memory setting.");
		} finally {
			setBusy(false);
		}
	}
	/** Record a memory the user typed. Source is "user" — never inferred. */
	async function addOne() {
		const content = newMemory.trim();
		if (!content) return;
		setBusy(true);
		try {
			if (memoryScope === "project" && !memoryProjectId) throw new Error("Choose a project for project memory.");
			const expiresAt = memoryRetention === "keep" ? null : new Date(Date.now() + Number(memoryRetention) * 24 * 60 * 60 * 1e3).toISOString();
			if (backend === "local") {
				const result = addLocalMemory({
					content,
					scope: memoryScope,
					projectId: memoryScope === "project" ? memoryProjectId : null,
					source: "user",
					expiresAt
				});
				if (!result.ok) throw new Error(result.reason);
			} else await addMemory({ data: {
				content,
				scope: memoryScope,
				projectId: memoryScope === "project" ? memoryProjectId : null,
				source: "user",
				expiresAt
			} });
			setNewMemory("");
			toast.success("OCADE will remember that.");
			await refresh(backend === "local");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not save that memory.");
		} finally {
			setBusy(false);
		}
	}
	async function save(row) {
		const content = drafts[row.id]?.trim();
		if (!content || content === row.content) return;
		try {
			if (backend === "local") {
				const result = updateLocalMemory({
					id: row.id,
					content
				});
				if (!result.ok) throw new Error(result.reason);
			} else await updateMemory({ data: {
				id: row.id,
				content
			} });
			toast.success("Memory updated.");
			await refresh(backend === "local");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not update this memory.");
		}
	}
	async function togglePin(row) {
		try {
			if (backend === "local") {
				const result = updateLocalMemory({
					id: row.id,
					pinned: !row.pinned
				});
				if (!result.ok) throw new Error(result.reason);
			} else await updateMemory({ data: {
				id: row.id,
				pinned: !row.pinned
			} });
			await refresh(backend === "local");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not update this memory.");
		}
	}
	async function remove(row) {
		try {
			if (backend === "local") {
				const result = deleteLocalMemory(row.id);
				if (!result.ok) throw new Error(result.reason);
			} else await deleteMemory({ data: { id: row.id } });
			toast.success("Memory deleted.");
			await refresh(backend === "local");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not delete this memory.");
		}
	}
	async function clearAll() {
		const phrase = window.prompt("This permanently deletes everything OCADE remembers. Your conversations are not affected. Type \"delete memory\" to confirm.");
		if (phrase === null) return;
		if (phrase.trim().toLowerCase() !== "delete memory") {
			toast.error("Confirmation phrase did not match. Nothing was deleted.");
			return;
		}
		try {
			if (backend === "local") {
				const result = clearLocalMemory();
				if (!result.ok) throw new Error(result.reason);
			} else await clearAllMemory();
			toast.success("All memory deleted.");
			await refresh(backend === "local");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not clear memory.");
		}
	}
	async function removeExpired() {
		try {
			const result = backend === "local" ? purgeExpiredLocalMemory() : await purgeExpiredMemory();
			if ("ok" in result && !result.ok) throw new Error(result.reason);
			const removed = "ok" in result ? result.data.removed : result.removed;
			toast.success(removed > 0 ? `${removed} expired ${removed === 1 ? "memory" : "memories"} deleted.` : "No expired memories to delete.");
			await refresh(backend === "local");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not remove expired memory.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Privacy and Data",
			title: "Memory",
			description: "What OCADE remembers between conversations — opt-in, and always yours to review, edit or delete.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded border border-border/60 px-2 py-0.5 text-[10px] uppercase text-muted-foreground",
					children: backend === "local" ? "On-device" : "Private sync"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: enabled ? "active" : "setup_required" })]
			})
		}),
		notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-6 flex items-start gap-3 p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
				className: "mt-0.5 h-4 w-4 flex-none text-[color:var(--warning)]",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "On-device fallback is active"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: notice
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "These items stay in this browser and do not claim to be synced."
					})
				]
			})]
		}) : null,
		error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-6 flex items-start gap-3 p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
				className: "mt-0.5 h-4 w-4 flex-none text-[color:var(--warning)]",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "Memory is unavailable"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: error
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Nothing was stored or changed."
					})
				]
			})]
		}) : null,
		!error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-6 flex flex-wrap items-center justify-between gap-3 p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brain, {
					className: "mt-0.5 h-4 w-4 flex-none text-muted-foreground",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "Let OCADE remember"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-muted-foreground",
						children: "Off by default. When on, OCADE keeps durable notes you approve — separate from your chat history, and stored in the mode shown above."
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => void toggle(!enabled),
				disabled: busy || enabled === null,
				className: "rounded-md border border-border/70 px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50",
				children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : enabled ? "Turn off" : "Turn on"
			})]
		}) : null,
		enabled && rows ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "text-sm font-medium text-foreground",
						children: ["Remembered items ", rows.length > 0 ? `(${rows.length})` : ""]
					}), rows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => void removeExpired(),
							className: "text-xs text-muted-foreground hover:text-foreground",
							children: "Remove expired"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => void clearAll(),
							className: "text-xs text-muted-foreground hover:text-[color:var(--destructive)]",
							children: "Delete all"
						})]
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "mb-3 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							htmlFor: "memory-add",
							className: "text-xs font-medium text-foreground",
							children: "Tell OCADE something to remember"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							id: "memory-add",
							value: newMemory,
							onChange: (e) => setNewMemory(e.target.value),
							rows: 2,
							placeholder: "I prefer short answers. I work in IST.",
							className: "mt-1.5 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 text-sm text-foreground"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-1.5 text-[11px] text-muted-foreground",
									children: ["Scope", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: memoryScope,
										onChange: (event) => {
											const scope = event.target.value;
											setMemoryScope(scope);
											if (scope === "project" && !memoryProjectId) setMemoryProjectId(projects[0]?.id ?? "");
										},
										className: "rounded border border-border/60 bg-background px-2 py-1 text-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "user",
											children: "Private memory"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "project",
											disabled: projects.length === 0,
											children: "Project memory"
										})]
									})]
								}),
								memoryScope === "project" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-1.5 text-[11px] text-muted-foreground",
									children: ["Project", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
										value: memoryProjectId,
										onChange: (event) => setMemoryProjectId(event.target.value),
										className: "rounded border border-border/60 bg-background px-2 py-1 text-foreground",
										children: projects.map((project) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: project.id,
											children: project.name
										}, project.id))
									})]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-1.5 text-[11px] text-muted-foreground",
									children: ["Retention", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: memoryRetention,
										onChange: (event) => setMemoryRetention(event.target.value),
										className: "rounded border border-border/60 bg-background px-2 py-1 text-foreground",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "keep",
												children: "Keep until deleted"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "7",
												children: "7 days"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "30",
												children: "30 days"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "90",
												children: "90 days"
											})
										]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => void addOne(),
								disabled: busy || !newMemory.trim(),
								className: "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50",
								children: "Remember this"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] text-muted-foreground",
								children: "Stored only for you. You can edit or delete it at any time."
							})]
						})
					]
				}),
				rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
					className: "p-4 text-sm text-muted-foreground",
					children: "OCADE hasn't remembered anything yet."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-2",
					children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: drafts[row.id] ?? row.content,
							onChange: (e) => setDrafts((d) => ({
								...d,
								[row.id]: e.target.value
							})),
							rows: 2,
							"aria-label": `Edit remembered item: ${row.content.slice(0, 60)}`,
							className: "w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 text-sm text-foreground"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded border border-border/60 px-1.5 py-0.5",
									children: row.scope
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "rounded border border-border/60 px-1.5 py-0.5",
									children: ["from ", row.source]
								}),
								row.expires_at ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["expires ", new Date(row.expires_at).toLocaleDateString()] }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "ml-auto flex items-center gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => void save(row),
											title: "Save changes",
											className: "rounded p-1 hover:text-foreground",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => void togglePin(row),
											title: row.pinned ? "Unpin" : "Pin",
											className: "rounded p-1 hover:text-foreground",
											children: row.pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PinOff, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => void remove(row),
											title: "Delete",
											className: "rounded p-1 hover:text-[color:var(--destructive)]",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											})
										})
									]
								})
							]
						})]
					}) }, row.id))
				})
			]
		}) : null
	] });
}
/**
* Project live perception readiness from authenticated companion evidence.
* Source availability is not runtime availability: callers must explicitly
* report every external perception provider they have actually connected.
*/
function perceptionRuntimeReadiness(input) {
	const missing = [];
	if (!input.companionAvailable) missing.push("Signed Native Companion");
	const granted = new Set((input.permissions ?? []).filter((permission) => permission.state === "granted" || permission.state === "not_required").map((permission) => permission.id));
	if (!granted.has("accessibility")) missing.push("accessibility permission");
	if (!granted.has("screen_capture")) missing.push("screen-capture permission");
	for (const source of [
		"ocr",
		"icon",
		"vision"
	]) if (!input.providers?.[source]) missing.push(`${source} provider`);
	return {
		sourceReady: true,
		liveReady: missing.length === 0,
		missing
	};
}
function ComputerUsePanel() {
	const [settings, setSettings] = (0, import_react.useState)(loadComputerUseSettings);
	const [status, setStatus] = (0, import_react.useState)({
		available: false,
		reason: COMPANION_UNAVAILABLE_REASON
	});
	const [message, setMessage] = (0, import_react.useState)(null);
	const [stopping, setStopping] = (0, import_react.useState)(false);
	const [applications, setApplications] = (0, import_react.useState)([]);
	const perception = perceptionRuntimeReadiness({
		companionAvailable: status.available,
		permissions: status.permissions
	});
	(0, import_react.useEffect)(() => {
		let current = true;
		const inspect = (adapter = getCompanion()) => {
			adapter.status().then(async (next) => {
				if (!current) return;
				setStatus(next);
				if (!next.available || !adapter.applications) {
					setApplications([]);
					return;
				}
				try {
					const discovered = await adapter.applications();
					if (current) setApplications(discovered);
				} catch {
					if (current) setApplications([]);
				}
			});
		};
		inspect();
		const unsubscribe = subscribeCompanionAdapter(inspect);
		return () => {
			current = false;
			unsubscribe();
		};
	}, []);
	function update(patch) {
		const next = normalizeComputerUseSettings({
			...settings,
			...patch
		});
		setSettings(next);
		const result = persistComputerUseSettings(next);
		setMessage(result.ok ? {
			tone: "ok",
			text: "Computer Use policy saved on this device."
		} : {
			tone: "error",
			text: result.error
		});
		if (result.ok && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ocade:computer-use-settings"));
	}
	async function emergencyStop() {
		setStopping(true);
		setMessage(null);
		try {
			await getCompanion().emergencyStop();
			setMessage({
				tone: "ok",
				text: "The Native Companion acknowledged the emergency stop."
			});
		} catch (error) {
			setMessage({
				tone: "error",
				text: error instanceof Error ? error.message : "No companion acknowledged the emergency stop."
			});
		} finally {
			setStopping(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE · Computer Use",
			title: "Work and Computer Control",
			description: "Choose where OCADE may act. These preferences narrow access; every action still passes runtime permission, risk and verification checks.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => void emergencyStop(),
				disabled: stopping,
				className: "inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/15 disabled:opacity-50",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OctagonX, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), stopping ? "Stopping…" : "Emergency stop"]
			})
		}),
		message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			role: message.tone === "error" ? "alert" : "status",
			className: cn("mb-4 rounded-md border px-3 py-2 text-xs", message.tone === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]"),
			children: message.text
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "p-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
				label: "Computer Use",
				description: "Master permission for browser, this computer, paired devices and background work. Off by default.",
				checked: settings.enabled,
				onChange: (enabled) => update({ enabled })
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: "Control channels"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "A channel can be selected only while the master switch is on. A selected channel still fails closed when its signed connector is unavailable."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 divide-y divide-border/50",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
							icon: Globe,
							label: "Web Control",
							description: "Use an OCADE-managed Chrome or Edge session on sites allowed in Browser control.",
							checked: settings.webControl,
							disabled: !settings.enabled,
							onChange: (webControl) => update({ webControl })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
							icon: Laptop,
							label: "This Computer",
							description: "Use the signed Native Companion for approved apps, files and windows.",
							checked: settings.thisComputer,
							disabled: !settings.enabled,
							onChange: (thisComputer) => update({ thisComputer })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
							icon: Smartphone,
							label: "Paired Devices",
							description: "Allow paired devices to monitor, approve, pause, cancel and stop work.",
							checked: settings.pairedDevices,
							disabled: !settings.enabled,
							onChange: (pairedDevices) => update({ pairedDevices })
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap gap-2 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/browser",
							className: "underline underline-offset-4",
							children: "Browser permissions"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/mobile",
							className: "underline underline-offset-4",
							children: "Mobile pairing"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/devices",
							className: "underline underline-offset-4",
							children: "Device revocation"
						})
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-semibold",
				children: "Sessions and background work"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 divide-y divide-border/50",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
					icon: Radio,
					label: "Background tasks",
					description: "Allow eligible scheduled tasks while OCADE is not the active window.",
					checked: settings.backgroundTasks,
					disabled: !settings.enabled,
					onChange: (backgroundTasks) => update({ backgroundTasks })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
					icon: Smartphone,
					label: "Remote sessions",
					description: "Allow a paired phone to supervise the same task. It never grants arbitrary computer control.",
					checked: settings.remoteSessions,
					disabled: !settings.enabled || !settings.pairedDevices,
					onChange: (remoteSessions) => update({ remoteSessions })
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: "Recording and replay"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "mt-3 block text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mb-1 block text-muted-foreground",
						children: "Session record"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: settings.recordingMode,
						onChange: (event) => update({ recordingMode: event.target.value }),
						disabled: !settings.enabled,
						className: "h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm disabled:opacity-50",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "off",
								children: "Off"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "receipts_only",
								children: "Receipts and redacted evidence only"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "approved_replay",
								children: "Approved workflow replay"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
					label: "Allow approved replays",
					description: "A replay remains bounded to its version, apps, permissions and protected-input rules.",
					checked: settings.replayEnabled,
					disabled: !settings.enabled || settings.recordingMode !== "approved_replay",
					onChange: (replayEnabled) => update({ replayEnabled })
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Protected inputs are always blocked"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Passwords, one-time codes, CAPTCHAs, biometrics, payment details, recovery codes and legal confirmations must be completed by you. This protection cannot be disabled by a setting, connector or app policy."
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: "Companion permissions"
				}),
				status.permissions && status.permissions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 space-y-2",
					children: status.permissions.map((permission) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3 rounded border border-border/60 p-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium",
							children: permission.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-[11px] text-muted-foreground",
							children: permission.guidance
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded border border-border/60 px-2 py-0.5 text-[10px] uppercase",
							children: permission.state.replace("_", " ")
						})]
					}, permission.id))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: status.reason ?? "The OCADE Native Companion isn't connected. Computer control requires the signed companion app."
				}),
				status.installGuidance && status.installGuidance.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 rounded border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium",
						children: "Setup needed"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-1 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground",
						children: status.installGuidance.map((guidance) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: guidance }, guidance))
					})]
				}) : null
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: "Fused screen perception"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "The redaction, state-fingerprint and numbered-target pipeline is source-ready. Live UIA/OCR/icon/vision control remains blocked until every authenticated dependency below is available."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: cn("mt-3 text-xs font-medium", perception.liveReady ? "text-[color:var(--state-success)]" : "text-[color:var(--state-warning)]"),
					children: perception.liveReady ? "Live perception ready" : "Live perception setup required"
				}),
				!perception.liveReady ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground",
					children: perception.missing.map((dependency) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: dependency }, dependency))
				}) : null
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: "Detected applications"
				}),
				applications.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 grid gap-2 sm:grid-cols-2",
					children: applications.map((application) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded border border-border/60 p-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-xs font-medium",
							children: application.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-0.5 truncate font-mono text-[10px] text-muted-foreground",
							children: [
								application.appId,
								" · PID ",
								application.processId
							]
						})]
					}, `${application.processId}:${application.appId}`))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: status.available ? "The authenticated inventory returned no visible applications. No app-specific permission is inferred." : status.reason ?? "The OCADE Native Companion isn't connected. Computer control requires the signed companion app."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/settings/skills",
					className: "mt-3 inline-flex text-xs underline underline-offset-4",
					children: "Review verified adapters and learned app maps"
				})
			]
		})
	] });
}
function SwitchRow({ icon: Icon, label, description, checked, disabled = false, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 gap-2",
			children: [Icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
				className: "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
				"aria-hidden": true
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm font-medium",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: description
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			role: "switch",
			"aria-label": label,
			"aria-checked": checked,
			disabled,
			onClick: () => onChange(!checked),
			className: cn("relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-40", checked ? "bg-primary" : "bg-muted"),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5") })
		})]
	});
}
/**
* Telling somebody their rule is wrong before it disappoints them.
*
* Ported from the archive's `settings/permissionValidation.ts` and
* `shadowedRuleDetection.ts`.
*
* WHY A RULE NEEDS REVIEWING AT ALL
* ---------------------------------
* A permission rule is a small program the user writes about their own safety,
* and the two ways it goes wrong are both silent. It can be MALFORMED, in which
* case it matches nothing and the user believes they have granted something
* they have not. Or it can be UNREACHABLE, shadowed by a broader rule consulted
* first -- writing `Bash(git status)` to allow one command while a plain `Bash`
* deny sits above it means being asked forever and never learning why.
*
* Neither produces an error. Both produce a person who concludes the feature
* does not work.
*
* ADAPTED, AND WHY
* ----------------
* The donor carried rule sources -- project settings, enterprise policy, CLI
* arguments -- and much of its shadow logic was about which source may shadow
* which. Every OCADE rule is the user's own, written on this device, so that
* dimension is gone and what remains is the part about the rules themselves.
* The donor's precedence is kept exactly: deny, then ask, then allow.
*/
/**
* Characters that would make a rule match nothing, invisibly.
*
* Control codes, the soft hyphen, the zero-width and bidirectional marks, and
* the byte-order mark. All of them survive a copy and paste from a web page and
* none of them can be seen in the field afterwards, so a rule carrying one
* looks exactly right and matches exactly nothing.
*/
var UNTYPEABLE = /[\u0000-\u001f\u007f\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/;
/**
* Is this rule well-formed enough to ever match?
*
* Returns null when the rule is fine. Deliberately strict about the things that
* fail SILENTLY and permissive about everything else: a tool name that does not
* exist yet is not an error, because a rule written before an update should
* still be there after it.
*/
function validateRule(rule) {
	const trimmed = rule.trim();
	if (!trimmed) return {
		reason: "A rule needs a tool name.",
		fix: null
	};
	if (UNTYPEABLE.test(trimmed)) return {
		reason: "That rule contains characters that cannot be seen, so it would never match.",
		fix: "Retype it rather than pasting it."
	};
	const opened = (trimmed.match(/\(/g) ?? []).length;
	if (opened !== (trimmed.match(/\)/g) ?? []).length) return {
		reason: "The brackets do not balance, so OCADE cannot tell where the pattern ends.",
		fix: "Write it as Tool(pattern) -- for example Bash(git status)."
	};
	if (opened > 0 && !trimmed.endsWith(")")) return {
		reason: "Anything after the closing bracket is ignored, so this would match the tool alone.",
		fix: "Put the pattern inside the brackets and end the rule there."
	};
	const value = permissionRuleValueFromString(trimmed);
	if (!value.toolName.trim()) return {
		reason: "A rule needs a tool name before the brackets.",
		fix: null
	};
	if (/\(\s*\)$/.test(trimmed)) return {
		reason: "The brackets are empty, so this matches the tool alone rather than a pattern.",
		fix: "Either remove the brackets or put a pattern inside them."
	};
	if (/\(\s*\*\s*\)$/.test(trimmed)) return {
		reason: "A pattern of just * is the same as naming the tool with no brackets.",
		fix: `Write ${value.toolName} on its own if that is what you meant.`
	};
	return null;
}
/**
* Rules that can never apply, because a broader one is consulted first.
*
* The order the permission layer uses is deny, then ask, then allow. So a
* tool-wide deny makes every narrower rule for that tool unreachable, and a
* tool-wide ask makes every narrower ALLOW unreachable -- the person is asked
* before the allow is ever consulted.
*
* A tool-wide rule is not itself shadowed by another tool-wide rule: that is a
* contradiction the precedence resolves, not a rule that never fires.
*/
function findShadowedRules(rules) {
	const parsed = rules.map((rule) => ({
		rule,
		value: permissionRuleValueFromString(rule.rule.trim())
	}));
	const toolWide = (behavior) => parsed.filter((entry) => entry.rule.behavior === behavior && entry.value.ruleContent === void 0);
	const denies = toolWide("deny");
	const asks = toolWide("ask");
	const shadowed = [];
	for (const entry of parsed) {
		if (entry.value.ruleContent === void 0) continue;
		const deny = denies.find((d) => d.value.toolName === entry.value.toolName);
		if (deny) {
			shadowed.push({
				rule: entry.rule,
				shadowedBy: deny.rule,
				reason: `${entry.value.toolName} is blocked entirely, so this rule is never reached.`,
				fix: `Remove the rule blocking ${entry.value.toolName}, or delete this one.`
			});
			continue;
		}
		if (entry.rule.behavior !== "allow") continue;
		const ask = asks.find((a) => a.value.toolName === entry.value.toolName);
		if (ask) shadowed.push({
			rule: entry.rule,
			shadowedBy: ask.rule,
			reason: `${entry.value.toolName} always asks, so this rule never allows anything.`,
			fix: `Remove the rule that always asks about ${entry.value.toolName}, or delete this one.`
		});
	}
	return shadowed;
}
/** Rule text present more than once, whatever the behaviours attached to it. */
function findDuplicateRules(rules) {
	const seen = /* @__PURE__ */ new Map();
	for (const { rule } of rules) {
		const key = rule.trim().toLowerCase();
		seen.set(key, (seen.get(key) ?? 0) + 1);
	}
	return [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}
/**
* The rules, where a person can finally see and write them.
*
* WHAT WAS WRONG BEFORE
* ---------------------
* The rule engine is the strongest thing OCADE imported: exact, prefix and
* wildcard matching, per-segment evaluation of compound commands, deny before
* ask before allow. It was fully wired into every decision the product makes —
* and `saveRules` had no caller anywhere. Nobody could write a rule, so the
* whole engine only ever saw the empty list. A capability nothing can reach is
* not a capability; it is code that passes its tests.
*
* This is deliberately in Advanced. Most people should never need it: the
* permission mode above covers them. Somebody who wants "never ask me about
* git status again" should be able to say so, and see immediately when what
* they wrote cannot work.
*/
var BEHAVIOURS = [
	{
		value: "allow",
		label: "Allow",
		hint: "Goes ahead without asking."
	},
	{
		value: "ask",
		label: "Ask",
		hint: "Always checks with you first."
	},
	{
		value: "deny",
		label: "Never",
		hint: "Refused, whatever the mode says."
	}
];
function PermissionRules() {
	const [rules, setRules] = (0, import_react.useState)(() => loadRules());
	const [draft, setDraft] = (0, import_react.useState)("");
	const [behavior, setBehavior] = (0, import_react.useState)("allow");
	const [message, setMessage] = (0, import_react.useState)(null);
	const problem = (0, import_react.useMemo)(() => draft.trim() ? validateRule(draft) : null, [draft]);
	const shadowed = (0, import_react.useMemo)(() => findShadowedRules(rules), [rules]);
	const duplicates = (0, import_react.useMemo)(() => new Set(findDuplicateRules(rules)), [rules]);
	function persist(next) {
		setRules(next);
		const saved = saveRules(next);
		setMessage(saved.ok ? "Saved on this device." : saved.error);
	}
	function add() {
		const rule = draft.trim();
		if (!rule || problem) return;
		persist([...rules, {
			rule,
			behavior
		}]);
		setDraft("");
	}
	function remove(index) {
		persist(rules.filter((_, position) => position !== index));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "mt-4 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-semibold",
				children: "Rules for particular actions"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: [
					"A rule names a tool, and optionally a pattern inside brackets —",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: "Bash(git status)" }),
					" for one command, ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: "Bash(npm run:*)" }),
					" for anything starting that way. Refusals are checked first, then questions, then permissions."
				]
			}),
			message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "status",
				className: "mt-3 rounded-md border border-border/60 px-3 py-2 text-xs",
				children: message
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-start gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "min-w-56 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "Rule"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: draft,
							onChange: (event) => setDraft(event.target.value),
							onKeyDown: (event) => {
								if (event.key === "Enter") add();
							},
							placeholder: "Bash(git status)",
							"aria-invalid": problem ? true : void 0,
							"aria-describedby": problem ? "rule-problem" : void 0,
							className: "h-10 w-full rounded-md border border-border/70 bg-background px-3 font-mono text-sm"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "sr-only",
						children: "What OCADE should do"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: behavior,
						onChange: (event) => setBehavior(event.target.value),
						className: "h-10 rounded-md border border-border/70 bg-background px-3 text-sm",
						children: BEHAVIOURS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: option.value,
							children: option.label
						}, option.value))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: add,
						disabled: !draft.trim() || problem !== null,
						className: "inline-flex h-10 items-center gap-1.5 rounded-md border border-border/70 px-3 text-sm disabled:opacity-40",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), " Add rule"]
					})
				]
			}),
			problem ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				id: "rule-problem",
				role: "alert",
				className: "mt-2 text-xs text-[color:var(--state-warning)]",
				children: [problem.reason, problem.fix ? ` ${problem.fix}` : ""]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-muted-foreground",
				children: BEHAVIOURS.find((option) => option.value === behavior)?.hint
			}),
			rules.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-5 text-xs text-muted-foreground",
				children: "No rules yet. Without any, the permission setting above decides everything."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-5 space-y-2",
				children: rules.map((entry, index) => {
					const shadow = shadowed.find((item) => item.rule === entry);
					const duplicate = duplicates.has(entry.rule.trim().toLowerCase());
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-md border border-border/60 px-3 py-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
										className: "min-w-0 flex-1 truncate text-xs",
										children: entry.rule
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] uppercase tracking-wider text-muted-foreground",
										children: BEHAVIOURS.find((option) => option.value === entry.behavior)?.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => remove(index),
										"aria-label": `Remove the rule ${entry.rule}`,
										className: "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
											className: "h-3.5 w-3.5",
											"aria-hidden": true
										})
									})
								]
							}),
							shadow ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1.5 flex items-start gap-1.5 text-xs text-[color:var(--state-warning)]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
									className: "mt-0.5 h-3 w-3 shrink-0",
									"aria-hidden": true
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									shadow.reason,
									" ",
									shadow.fix
								] })]
							}) : null,
							duplicate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1.5 text-xs text-muted-foreground",
								children: "This rule is listed more than once. Only the strictest one decides."
							}) : null
						]
					}, `${entry.rule}-${entry.behavior}-${index}`);
				})
			})
		]
	});
}
var PERMISSION_OPTIONS = [
	{
		value: "blocked",
		label: "Blocked",
		description: "Never act."
	},
	{
		value: "read_only",
		label: "Read-only",
		description: "Observe approved state; no mutation."
	},
	{
		value: "ask_every_mutation",
		label: "Ask Every Mutation",
		description: "Confirm every change, type, open, upload, download or command."
	},
	{
		value: "ask_risky",
		label: "Ask Risky Actions",
		description: "Low-risk actions may proceed; risky actions still require approval."
	},
	{
		value: "bounded_workflow",
		label: "Bounded Workflow",
		description: "Allow only the reviewed steps, apps, files and time window."
	},
	{
		value: "session_allowance",
		label: "Session Allowance",
		description: "Allow selected capabilities until this session ends."
	},
	{
		value: "time_limited",
		label: "Time-Limited Allowance",
		description: "Allow selected capabilities for a short fixed duration."
	},
	{
		value: "always_selected_low_risk",
		label: "Always Allow Selected Low-Risk Capabilities",
		description: "Only explicitly selected low-risk capabilities; never a blanket app grant."
	}
];
function PermissionsPanel() {
	const [settings, setSettings] = (0, import_react.useState)(loadComputerUseSettings);
	const [message, setMessage] = (0, import_react.useState)(null);
	function update(patch) {
		const next = normalizeComputerUseSettings({
			...settings,
			...patch
		});
		setSettings(next);
		const result = persistComputerUseSettings(next);
		setMessage(result.ok ? "Permission defaults saved on this device." : result.error);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE · Computer Use",
			title: "Permissions",
			description: "Set the default posture for new app and workflow requests. Runtime risk, protected-input and scope checks can only make this stricter."
		}),
		message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			role: "status",
			className: "mb-4 rounded-md border border-border/60 px-3 py-2 text-xs",
			children: message
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-semibold",
							children: "Default computer-use permission"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-1 block text-xs text-muted-foreground",
							children: "“Any App” is only a routing choice. It never bypasses app identity, signatures, capability checks, risk, scope or confirmation."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: settings.defaultPermission,
							onChange: (event) => update({ defaultPermission: event.target.value }),
							className: "mt-3 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm",
							children: PERMISSION_OPTIONS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: option.value,
								children: option.label
							}, option.value))
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-xs text-muted-foreground",
					children: PERMISSION_OPTIONS.find((option) => option.value === settings.defaultPermission)?.description
				}),
				settings.defaultPermission === "time_limited" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "mt-4 block text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mb-1 flex items-center gap-1 text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), " Allowance duration"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: settings.allowanceMinutes,
						onChange: (event) => update({ allowanceMinutes: Number(event.target.value) }),
						className: "h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm",
						children: [
							5,
							15,
							30,
							60,
							120,
							240,
							480
						].map((minutes) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: minutes,
							children: minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hours`
						}, minutes))
					})]
				}) : null
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Non-overridable boundaries"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-2 space-y-1 text-xs text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Protected inputs and protected fields are always refused." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Expired, revoked, unsigned or mismatched permissions fail closed." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "High-risk actions still need explicit confirmation." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Execution acknowledgement is not independent verification." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "An unavailable connector never becomes simulated success." })
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), " App and site-specific permissions"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "No authenticated native application inventory is available in this browser runtime, so OCADE does not invent app identities or grants. Site permissions and known adapter coverage remain inspectable now."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap gap-3 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/browser",
							className: "underline underline-offset-4",
							children: "Browser site permissions"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/skills",
							className: "underline underline-offset-4",
							children: "Adapter and app coverage"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/$section",
							params: { section: "work" },
							className: "underline underline-offset-4",
							children: "Computer Use channels"
						})
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionRules, {})
	] });
}
var installedEmailConnector = null;
async function getEmailConnectorStatus() {
	if (!installedEmailConnector) return null;
	try {
		return await installedEmailConnector.status();
	} catch {
		return null;
	}
}
function ConnectorsPanel() {
	const [rows, setRows] = (0, import_react.useState)([]);
	const [checking, setChecking] = (0, import_react.useState)(true);
	const refresh = (0, import_react.useCallback)(async () => {
		setChecking(true);
		const [native, browser, email] = await Promise.all([
			getCompanion().status(),
			getBrowserBridge().status(),
			getEmailConnectorStatus()
		]);
		const mobileCount = activeDevices().filter((device) => device.kind === "mobile").length;
		setRows([
			{
				id: "native",
				label: "OCADE Native Companion",
				description: "Signed local route for approved apps, windows, files and OS actions.",
				available: native.available,
				detail: native.available ? `Connected${native.version ? ` · version ${native.version}` : ""}` : native.reason ?? "Native Companion is not connected.",
				to: "/settings/work",
				action: "Computer Use setup",
				icon: Laptop
			},
			{
				id: "browser",
				label: "OCADE managed browser",
				description: "Extensionless Playwright/CDP route with per-site and protected-field boundaries.",
				available: browser.available,
				detail: browser.available ? "Managed Chrome or Edge session is reachable." : browser.reason ?? "Managed browser session is not connected.",
				to: "/settings/browser",
				action: "Browser permissions",
				icon: Globe
			},
			{
				id: "mobile",
				label: "OCADE mobile companion",
				description: "Monitor, approve, pause, cancel and emergency-stop the same task.",
				available: mobileCount > 0,
				detail: mobileCount > 0 ? `${mobileCount} active mobile ${mobileCount === 1 ? "device" : "devices"} in the local pairing registry.` : "No active mobile device is paired in this browser.",
				to: "/settings/mobile",
				action: "Mobile pairing",
				icon: Smartphone
			},
			{
				id: "email_web",
				label: "Email and authenticated web work",
				description: "Connector-first drafts and sends, with a managed-browser fallback for approved authenticated sites.",
				available: Boolean(email?.available && email.authenticated && email.officialOrApproved) || browser.available,
				detail: email?.available && email.authenticated && email.officialOrApproved ? `${email.providerId} is authenticated through its approved ${email.route.toUpperCase()} route.` : browser.available ? "No email API is connected; the managed browser can use explicitly allowed sites after you sign in." : "No approved email connector or managed browser route is available. Draft previews remain local and nothing can be sent.",
				to: "/settings/browser",
				action: "Email and site permissions",
				icon: Plug
			},
			{
				id: "models",
				label: "Local model engines",
				description: "On-device routing, health checks and model setup without public-cloud inference.",
				available: true,
				detail: "The model control centre reports the health of local runtimes on this device.",
				to: "/ocade/models",
				action: "Model control centre",
				icon: Bot
			}
		]);
		setChecking(false);
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
		return subscribeCompanionAdapter(() => {
			refresh();
		});
	}, [refresh]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Extensions",
			title: "Connectors",
			description: "See which structured route OCADE can actually use. A disconnected connector remains unavailable; OCADE does not silently substitute mouse and keyboard.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => void refresh(),
				disabled: checking,
				className: "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-3 text-xs hover:bg-accent disabled:opacity-50",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
					className: cn("h-3.5 w-3.5", checking && "animate-spin"),
					"aria-hidden": true
				}), "Re-check"]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children: rows.map((row) => {
				const Icon = row.icon;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
					className: "p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: "mt-0.5 h-4 w-4 shrink-0",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold",
										children: row.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("rounded-full px-2 py-0.5 text-[10px] font-medium", row.available ? "bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]" : "bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]"),
										children: row.available ? "Available" : "Setup required"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: row.description
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs",
									children: row.detail
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: row.to,
									className: "mt-2 inline-flex text-xs underline underline-offset-4",
									children: row.action
								})
							]
						})]
					})
				}, row.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plug, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Third-party services"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Email connector contracts and their guarded browser fallback are present, but this build does not bundle an OAuth provider or store credentials. Calendar, storage, banking and workspace OAuth connectors remain unimplemented. A connector is shown as available only after its own runtime health and authentication checks pass."
			})]
		})
	] });
}
function AccessibilityPanel() {
	const appearance = useAppearance();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Application",
			title: "Accessibility",
			description: "Keyboard, screen-reader and focus semantics are always enabled. Visual and motion preferences apply immediately and sync through the existing appearance settings path."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Accessibility, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Always-on access"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 divide-y divide-border/50",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FixedCapability, {
					icon: Keyboard,
					label: "Keyboard navigation and skip links",
					description: "Interactive controls remain reachable without a pointer; Escape closes temporary panels."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FixedCapability, {
					icon: Eye,
					label: "Screen-reader semantics and focus indicators",
					description: "Landmarks, labels, live status and visible focus are part of the interface, not an optional mode."
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: "Motion and contrast"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
					label: "Reduce motion",
					description: appearance.osReducedMotion ? "Your operating system requests reduced motion, so it remains on." : "Disable nonessential transitions and animated decoration.",
					checked: appearance.reducedMotion || appearance.osReducedMotion,
					disabled: appearance.osReducedMotion,
					onChange: (reducedMotion) => void appearance.update({ reducedMotion })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
					label: "High contrast",
					description: "Increase structural contrast without changing the selected theme.",
					checked: appearance.highContrast,
					onChange: (highContrast) => void appearance.update({ highContrast })
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointer2, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), " Pointer"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Accessibility pointer mode forces the operating-system cursor and ignores custom cursor artwork."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					"aria-pressed": appearance.cursor === "accessibility",
					type: "button",
					onClick: () => void appearance.update({ cursor: "accessibility" }),
					className: cn("mt-3 rounded-md border px-3 py-1.5 text-xs", appearance.cursor === "accessibility" ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-accent"),
					children: appearance.cursor === "accessibility" ? "System accessibility cursor active" : "Use system accessibility cursor"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/settings/appearance",
					className: "ml-3 inline-flex text-xs underline underline-offset-4",
					children: "Pointer size and appearance"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Captions, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), " Voice and captions"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Captions, speech rate, microphone selection, interruption and emergency mute are available in Voice settings. Unsupported browser speech engines are reported there rather than simulated."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/settings/voice",
					className: "mt-3 inline-flex text-xs underline underline-offset-4",
					children: "Open Voice and captions"
				})
			]
		})
	] });
}
function FixedCapability({ icon: Icon, label, description }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start gap-3 py-3 first:pt-0 last:pb-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
				className: "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-medium",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: description
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded-full bg-[color:var(--state-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[color:var(--state-success)]",
				children: "On"
			})
		]
	});
}
function ToggleRow({ label, description, checked, disabled = false, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3 flex items-start justify-between gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm font-medium",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 text-xs text-muted-foreground",
			children: description
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			role: "switch",
			"aria-label": label,
			"aria-checked": checked,
			disabled,
			onClick: () => onChange(!checked),
			className: cn("relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-50", checked ? "bg-primary" : "bg-muted"),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5") })
		})]
	});
}
var CORE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
var PRE_IDENT = /^[0-9A-Za-z-]+$/;
var NUMERIC = /^(0|[1-9]\d*)$/;
/**
* Strictly parse `major.minor.patch` with an optional `-prerelease`. Build
* metadata (`+…`) is intentionally rejected rather than ignored: an updater that
* silently drops part of a version string can treat two different builds as the
* same. Returns null on any malformed input — callers must fail closed on null.
*/
function parseVersion(raw) {
	if (typeof raw !== "string" || raw.length === 0 || raw.length > 256) return null;
	const [coreAndPre, ...extra] = raw.split("+");
	if (extra.length > 0) return null;
	const dash = coreAndPre.indexOf("-");
	const core = dash === -1 ? coreAndPre : coreAndPre.slice(0, dash);
	const pre = dash === -1 ? "" : coreAndPre.slice(dash + 1);
	const m = CORE.exec(core);
	if (!m) return null;
	let prerelease = [];
	if (dash !== -1) {
		if (pre.length === 0) return null;
		prerelease = pre.split(".");
		for (const id of prerelease) {
			if (!PRE_IDENT.test(id)) return null;
			if (NUMERIC.test(id) === false && /^\d+$/.test(id)) return null;
		}
	}
	return {
		major: Number(m[1]),
		minor: Number(m[2]),
		patch: Number(m[3]),
		prerelease,
		raw
	};
}
function comparePrerelease(a, b) {
	if (a.length === 0 && b.length === 0) return 0;
	if (a.length === 0) return 1;
	if (b.length === 0) return -1;
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i += 1) {
		const ai = a[i];
		const bi = b[i];
		const an = NUMERIC.test(ai);
		const bn = NUMERIC.test(bi);
		if (an && bn) {
			const d = Number(ai) - Number(bi);
			if (d !== 0) return d < 0 ? -1 : 1;
		} else if (an) return -1;
		else if (bn) return 1;
		else if (ai !== bi) return ai < bi ? -1 : 1;
	}
	if (a.length === b.length) return 0;
	return a.length < b.length ? -1 : 1;
}
/** -1 if a < b, 0 if equal precedence, 1 if a > b. */
function compareVersions(a, b) {
	if (a.major !== b.major) return a.major < b.major ? -1 : 1;
	if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
	if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
	const p = comparePrerelease(a.prerelease, b.prerelease);
	return p === 0 ? 0 : p < 0 ? -1 : 1;
}
/**
* Decide what to do with an offered update. Pure and total: every path returns
* one of apply / skip / refuse, and every refuse names why. `skip` means "no
* action needed, nothing wrong" (already current); `refuse` means "an update was
* offered but policy forbids applying it".
*/
function planUpdate(manifest, policy) {
	const requireSignature = policy.requireSignature !== false;
	const requireHash = policy.requireHash !== false;
	const current = parseVersion(policy.currentVersion);
	if (!current) return {
		action: "refuse",
		reason: `unreadable current version "${policy.currentVersion}"`
	};
	const next = parseVersion(manifest.version);
	if (!next) return {
		action: "refuse",
		reason: `unreadable manifest version "${manifest.version}"`
	};
	if (requireSignature && !hasValue(manifest.signature)) return {
		action: "refuse",
		reason: "update is unsigned — refusing (fail closed)"
	};
	if (requireHash && !hasValue(manifest.sha256)) return {
		action: "refuse",
		reason: "update has no content hash — refusing (fail closed)"
	};
	const cmp = compareVersions(next, current);
	if (cmp < 0) return {
		action: "refuse",
		reason: `offered ${next.raw} is older than installed ${current.raw} — never auto-downgrade`
	};
	if (cmp === 0) return {
		action: "skip",
		reason: `already at ${current.raw}`
	};
	if (next.prerelease.length > 0 && policy.allowPrerelease !== true) return {
		action: "skip",
		reason: `${next.raw} is a prerelease and this channel is stable-only`
	};
	if (hasValue(manifest.minimumClientVersion)) {
		const floor = parseVersion(manifest.minimumClientVersion);
		if (!floor) return {
			action: "refuse",
			reason: `manifest minimumClientVersion "${manifest.minimumClientVersion}" is unreadable`
		};
		if (compareVersions(current, floor) < 0) return {
			action: "refuse",
			reason: `staged upgrade required: install ${floor.raw} before ${next.raw} (current ${current.raw})`
		};
	}
	return {
		action: "apply",
		from: current.raw,
		to: next.raw,
		url: manifest.url
	};
}
function hasValue(v) {
	return typeof v === "string" && v.trim().length > 0;
}
var HEX64 = /^[0-9a-f]{64}$/;
var KEY_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/;
var MAX_TEXT = 4096;
var DEFAULT_CLOCK_SKEW_MS = 300 * 1e3;
function boundedText(value, allowEmpty = false) {
	return typeof value === "string" && value.length <= MAX_TEXT && (allowEmpty || value.trim().length > 0);
}
function canonicalManifest(manifest) {
	const keyId = manifest.signingKeyId?.trim();
	const digest = manifest.sha256?.trim().toLowerCase();
	if (!keyId || !KEY_ID.test(keyId)) return null;
	if (!Number.isSafeInteger(manifest.signedAt) || manifest.signedAt <= 0) return null;
	if (!boundedText(manifest.version) || !digest || !HEX64.test(digest)) return null;
	if (manifest.url !== void 0 && !boundedText(manifest.url)) return null;
	if (manifest.minimumClientVersion !== void 0 && !boundedText(manifest.minimumClientVersion)) return null;
	if (manifest.notes !== void 0 && !boundedText(manifest.notes, true)) return null;
	if (manifest.url !== void 0) try {
		const url = new URL(manifest.url);
		if (url.protocol !== "https:" || url.username.length > 0 || url.password.length > 0 || url.hash.length > 0) return null;
	} catch {
		return null;
	}
	return {
		schemaVersion: 1,
		signingKeyId: keyId,
		signedAt: manifest.signedAt,
		version: manifest.version,
		sha256: digest,
		url: manifest.url ?? null,
		minimumClientVersion: manifest.minimumClientVersion ?? null,
		notes: manifest.notes ?? null
	};
}
/**
* Stable bytes for the release signer. Object property order is fixed here;
* callers do not sign arbitrary JSON serialization.
*/
function manifestSigningMessageFor(manifest) {
	const canonical = canonicalManifest(manifest);
	return canonical === null ? null : new TextEncoder().encode(JSON.stringify(canonical));
}
async function sha256Hex(bytes) {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function selectTrustedKey(manifest, policy) {
	const keyId = manifest.signingKeyId?.trim();
	if (!keyId || !KEY_ID.test(keyId)) return {
		ok: false,
		reason: "The signed manifest has no valid signing-key identity."
	};
	if (!Number.isSafeInteger(policy.minimumKeyEpoch) || policy.minimumKeyEpoch < 0) return {
		ok: false,
		reason: "The update trust policy has an invalid key-epoch floor."
	};
	if (!Number.isSafeInteger(policy.evaluationTime) || policy.evaluationTime <= 0) return {
		ok: false,
		reason: "The update trust policy has no valid evaluation time."
	};
	const matches = policy.keys.filter((key) => key.id === keyId);
	if (matches.length !== 1) return {
		ok: false,
		reason: matches.length === 0 ? `Signing key "${keyId}" is not trusted by this build.` : `Signing key "${keyId}" is duplicated in the trust policy.`
	};
	const key = matches[0];
	if (!KEY_ID.test(key.id) || !Number.isSafeInteger(key.epoch) || key.epoch < 0 || !Number.isSafeInteger(key.validFrom) || key.validFrom <= 0) return {
		ok: false,
		reason: `Signing key "${keyId}" has invalid trust metadata.`
	};
	if (key.publicKeyBase64.includes("REPLACE_WITH")) return {
		ok: false,
		reason: "No legitimate update signing key is configured. Production updates remain disabled."
	};
	if (key.epoch < policy.minimumKeyEpoch) return {
		ok: false,
		reason: `Signing key "${keyId}" is from retired epoch ${key.epoch}; epoch ${policy.minimumKeyEpoch} or newer is required.`
	};
	if (key.revokedAt != null && key.revokedAt <= policy.evaluationTime) return {
		ok: false,
		reason: `Signing key "${keyId}" is revoked.`
	};
	return key;
}
/** Verify canonical metadata, rotation, revocation, validity and signature. */
async function verifyUpdateTrust(manifest, policy) {
	const canonical = canonicalManifest(manifest);
	if (canonical === null) return {
		ok: false,
		reason: "The signed update manifest is malformed or non-canonical."
	};
	const selected = selectTrustedKey(manifest, policy);
	if ("ok" in selected) return selected;
	const skew = policy.allowedClockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
	if (!Number.isSafeInteger(skew) || skew < 0) return {
		ok: false,
		reason: "The update trust policy has an invalid clock-skew allowance."
	};
	if (canonical.signedAt > policy.evaluationTime + skew) return {
		ok: false,
		reason: "The update manifest is signed in the future."
	};
	if (canonical.signedAt < selected.validFrom) return {
		ok: false,
		reason: `The update predates signing key "${selected.id}".`
	};
	if (selected.validUntil != null) {
		if (!Number.isSafeInteger(selected.validUntil) || selected.validUntil <= selected.validFrom) return {
			ok: false,
			reason: `Signing key "${selected.id}" has an invalid expiry.`
		};
		if (canonical.signedAt > selected.validUntil || policy.evaluationTime > selected.validUntil + skew) return {
			ok: false,
			reason: `Signing key "${selected.id}" is expired.`
		};
	}
	const maximumAge = policy.maximumSignatureAgeMs;
	if (maximumAge != null) {
		if (!Number.isSafeInteger(maximumAge) || maximumAge <= 0) return {
			ok: false,
			reason: "The update trust policy has an invalid signature age."
		};
		if (policy.evaluationTime - canonical.signedAt > maximumAge) return {
			ok: false,
			reason: "The update manifest signature is stale."
		};
	}
	const message = manifestSigningMessageFor(manifest);
	if (message === null) return {
		ok: false,
		reason: "The signed update manifest cannot be canonicalised."
	};
	const manifestSha256 = await sha256Hex(message);
	const signature = manifest.signature?.trim();
	if (!signature) return {
		ok: false,
		reason: "The update manifest is unsigned."
	};
	const signatureVerdict = await verifyUpdateSignature({
		publicKeyBase64: selected.publicKeyBase64,
		signatureBase64: signature,
		artifactSha256: manifestSha256
	});
	if (!signatureVerdict.ok) return {
		ok: false,
		reason: `Manifest signature rejected: ${signatureVerdict.reason}`
	};
	return {
		ok: true,
		keyId: selected.id,
		keyEpoch: selected.epoch,
		manifestSha256,
		evidence: `Canonical update manifest verified with key ${selected.id} at epoch ${selected.epoch}; ${signatureVerdict.evidence}`
	};
}
/**
* Joins the two halves of the update decision (P21).
*
* `planUpdate` decides whether an update SHOULD be applied — version ordering,
* channel, rollback policy — and checks only that a signature is PRESENT. Its
* own source says so: "this is a PRESENCE check. Whether the signature is
* genuine is decided by `verifyUpdateSignature`".
*
* That function existed, was tested, and was imported by nothing. So the only
* update path reachable from production checked that a signature field was
* non-empty and never verified it — which a malicious manifest satisfies by
* writing any string at all.
*
* This is the gate that runs both, in the order that matters: plan first
* (cheap, and refuses most bad updates without any crypto), verify second, and
* apply only if BOTH agree.
*/
/**
* Decide whether an update may be applied.
*
* Fails closed at every step. An update is applied only when the plan says
* apply AND the signature verifies against a digest the host computed itself.
*/
async function gateUpdate(input) {
	const planned = planUpdate(input.manifest, input.policy);
	if (planned.action !== "apply") return planned;
	const verdict = await verifyUpdateTrust(input.manifest, input.trustPolicy);
	if (!verdict.ok) return {
		action: "refuse",
		reason: `Update trust rejected: ${verdict.reason}`
	};
	if (!input.artifactSha256) return {
		action: "refuse",
		reason: "The downloaded artifact has not been hashed, so there is nothing to verify the signature against."
	};
	const expectedSha256 = input.manifest.sha256?.trim().toLowerCase();
	const observedSha256 = input.artifactSha256.trim().toLowerCase();
	if (!expectedSha256 || observedSha256 !== expectedSha256) return {
		action: "refuse",
		reason: "The downloaded artifact hash does not match the signed update manifest."
	};
	return {
		action: "apply",
		from: planned.from,
		to: planned.to,
		url: planned.url,
		evidence: verdict.evidence
	};
}
/**
* What OCADE would do with an offered update — and why it would refuse.
*
* `update-plan` is the deterministic half of self-update: it decides apply /
* skip / refuse, and every refusal names its reason. It was fully implemented
* and tested but reached by no route or panel, so the rules it enforces were
* invisible to the person they protect.
*
* The rules shown below are evaluated by the REAL engine at render time. They
* are not descriptions of the policy; they are the policy, run.
*
* HONEST STATE: OCADE cannot currently verify an update on this machine. The
* Tauri config still carries a placeholder signing public key, so there is no
* trusted key to check a signature against. The panel says that plainly rather
* than implying updates are ready to install.
*/
var CURRENT_VERSION = "0.1.0";
var SIGNED_AT = 17853456e5;
var SIGNING_KEY_ID = "production-primary";
var ROWS = [
	{
		label: "Properly signed newer build",
		manifest: {
			version: "0.2.0",
			signature: "a-detached-signature",
			sha256: "b".repeat(64),
			url: "https://example.invalid/ocade-0.2.0.msi",
			signingKeyId: SIGNING_KEY_ID,
			signedAt: SIGNED_AT
		}
	},
	{
		label: "Unsigned build",
		manifest: {
			version: "0.2.0",
			signature: "",
			sha256: "b".repeat(64),
			signingKeyId: SIGNING_KEY_ID,
			signedAt: SIGNED_AT
		}
	},
	{
		label: "No content hash",
		manifest: {
			version: "0.2.0",
			signature: "a-detached-signature",
			sha256: "",
			signingKeyId: SIGNING_KEY_ID,
			signedAt: SIGNED_AT
		}
	},
	{
		label: "Older than installed",
		manifest: {
			version: "0.0.9",
			signature: "a-detached-signature",
			sha256: "b".repeat(64),
			signingKeyId: SIGNING_KEY_ID,
			signedAt: SIGNED_AT
		}
	},
	{
		label: "Requires an intermediate upgrade first",
		manifest: {
			version: "0.9.0",
			signature: "a-detached-signature",
			sha256: "b".repeat(64),
			minimumClientVersion: "0.5.0",
			signingKeyId: SIGNING_KEY_ID,
			signedAt: SIGNED_AT
		}
	}
].map((entry) => ({
	...entry,
	decision: planUpdate(entry.manifest, { currentVersion: CURRENT_VERSION })
}));
/**
* The signing key that ships with this build.
*
* Still the placeholder from tauri.conf.json, and that is the point: the gate
* must say "no key is configured" rather than fail signature checks in a way
* that reads as a broken update server.
*/
var SIGNING_PUBLIC_KEY = "REPLACE_WITH_SIGNING_PUBLIC_KEY";
function presentation(decision) {
	switch (decision.action) {
		case "apply": return {
			icon: CircleArrowUp,
			text: `Would install ${decision.to}`
		};
		case "skip": return {
			icon: CircleSlash,
			text: decision.reason
		};
		case "refuse": return {
			icon: ShieldAlert,
			text: decision.reason
		};
	}
}
function UpdatePolicyPanel() {
	const [gated, setGated] = (0, import_react.useState)({});
	(0, import_react.useEffect)(() => {
		let live = true;
		(async () => {
			const out = {};
			for (const row of ROWS) out[row.label] = await gateUpdate({
				manifest: row.manifest,
				policy: { currentVersion: CURRENT_VERSION },
				trustPolicy: {
					keys: [{
						id: SIGNING_KEY_ID,
						publicKeyBase64: SIGNING_PUBLIC_KEY,
						epoch: 1,
						validFrom: SIGNED_AT
					}],
					minimumKeyEpoch: 1,
					evaluationTime: SIGNED_AT
				},
				artifactSha256: null
			});
			if (live) setGated(out);
		})();
		return () => {
			live = false;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), "Update policy"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "What OCADE would do with an offered update, decided by the same code the updater runs. An update with no signature or no content hash is refused — never installed with a warning."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 flex flex-col gap-2",
				children: ROWS.map((row) => {
					const shown = presentation(row.decision);
					const Icon = shown.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-start gap-2 rounded-lg border border-border/70 p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: "mt-0.5 h-3.5 w-3.5 shrink-0",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: row.label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: shown.text
								}),
								gated[row.label] && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: [
										"After signature check:",
										" ",
										gated[row.label].action === "apply" ? `install ${gated[row.label].to}` : gated[row.label].reason
									]
								})] })
							]
						})]
					}, row.label);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-lg border border-border/70 p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-medium",
					children: "Automatic updates are not available yet"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[11px] text-muted-foreground",
					children: "The desktop build still carries a placeholder signing key, so there is no trusted key to check a signature against. Signature verification is implemented and tested, but until a real key pair is generated and the placeholder replaced, OCADE will refuse every update rather than install one it cannot verify."
				})]
			})
		]
	});
}
var Switch = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
	className: cn("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input", className),
	...props,
	ref,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: cn("pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0") })
}));
Switch.displayName = Switch$1.displayName;
var labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
	ref,
	className: cn(labelVariants(), className),
	...props
}));
Label.displayName = Root.displayName;
/**
* OCADE Chat settings.
*
* Every control here changes something the chat screen actually reads on its
* next render — there is no "saved" state that nothing consumes. The engine
* default in particular is the one that matters: it decides whether a new
* conversation starts on the device or in the cloud, which is a privacy
* decision as much as a performance one.
*
* These settings are stored in THIS BROWSER. That is stated on the page rather
* than left to be discovered, because someone who sets "local only" here and
* then opens OCADE on another machine is entitled to know it did not follow
* them.
*/
var ENGINE_CHOICES = [{
	value: "auto",
	label: "Automatic",
	detail: "Lets OCADE choose how to answer. Either way it runs on this device."
}, {
	value: "local",
	label: "On this device only",
	detail: "Never leaves the machine. Requests the device cannot serve are refused with a reason instead of being sent anywhere."
}];
var SEND_CHOICES = [{
	value: "enter",
	label: "Enter sends",
	detail: "Shift+Enter starts a new line."
}, {
	value: "mod_enter",
	label: "Ctrl/Cmd+Enter sends",
	detail: "Enter starts a new line. Useful when you write long, multi-paragraph prompts."
}];
var DENSITY_CHOICES = [{
	value: "comfortable",
	label: "Comfortable"
}, {
	value: "compact",
	label: "Compact"
}];
function ChatSettingsPanel() {
	const { prefs, update, reset, storageError } = useChatPrefs();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Chat",
			description: "How OCADE Chat behaves on this device: which engine new chats start on, how messages are sent, and how the transcript is shown.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "outline",
				size: "sm",
				onClick: reset,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "mr-2 h-4 w-4" }), "Reset to defaults"]
			})
		}),
		storageError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mb-5 flex gap-3 border-destructive/40 p-4 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-5 w-5 shrink-0 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: storageError
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-5 pb-16",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-semibold text-foreground",
								children: "Engine for new chats"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[13px] text-muted-foreground",
							children: "You can still switch engine inside any individual conversation. This only sets where a new one begins."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
							className: "mt-4 grid gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
								className: "sr-only",
								children: "Engine for new chats"
							}), ENGINE_CHOICES.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "radio",
									name: "ocade-default-engine",
									className: "mt-1",
									value: choice.value,
									checked: prefs.defaultEngineTier === choice.value,
									onChange: () => update({ defaultEngineTier: choice.value })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block text-sm font-medium text-foreground",
										children: choice.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-0.5 block text-[13px] text-muted-foreground",
										children: choice.detail
									})]
								})]
							}, choice.value))]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brain, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-foreground",
							children: "Thinking"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex items-center justify-between gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "ocade-thinking",
									className: "text-sm text-foreground",
									children: "Think before answering"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 text-[13px] text-muted-foreground",
									children: "OCADE works the question through before it replies. Better answers on anything with several steps to it, and roughly a third slower. Turn it off for short factual questions where you would rather have the reply now."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1.5 text-[13px] text-muted-foreground",
									children: "This is Chat only. PC control never thinks first — there OCADE has to produce an action it can actually carry out, and thinking makes this model describe the action instead of doing it."
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							id: "ocade-thinking",
							checked: prefs.thinking,
							onCheckedChange: (v) => update({ thinking: v })
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: "Sending messages"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
						className: "mt-3 grid gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
							className: "sr-only",
							children: "Send key"
						}), SEND_CHOICES.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "radio",
								name: "ocade-send-key",
								className: "mt-1",
								value: choice.value,
								checked: prefs.sendKey === choice.value,
								onChange: () => update({ sendKey: choice.value })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm font-medium text-foreground",
									children: choice.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-0.5 block text-[13px] text-muted-foreground",
									children: choice.detail
								})]
							})]
						}, choice.value))]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: "Transcript"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "ocade-render-markdown",
										className: "text-sm text-foreground",
										children: "Format replies"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 text-[13px] text-muted-foreground",
										children: "Render headings, lists and code blocks. Turn off to read exactly what the model produced, character for character."
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									id: "ocade-render-markdown",
									checked: prefs.renderMarkdown,
									onCheckedChange: (v) => update({ renderMarkdown: v })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "ocade-show-timestamps",
										className: "text-sm text-foreground",
										children: "Show message times"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 text-[13px] text-muted-foreground",
										children: "Adds the local time each message was recorded."
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									id: "ocade-show-timestamps",
									checked: prefs.showTimestamps,
									onCheckedChange: (v) => update({ showTimestamps: v })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "ocade-keep-drafts",
										className: "text-sm text-foreground",
										children: "Keep unsent drafts"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 text-[13px] text-muted-foreground",
										children: "Restores what you were typing when you return to a conversation. Turn off on a shared computer so a closed tab discards it."
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									id: "ocade-keep-drafts",
									checked: prefs.keepDrafts,
									onCheckedChange: (v) => update({ keepDrafts: v })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm text-foreground",
								children: "Density"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 flex flex-wrap gap-2",
								children: DENSITY_CHOICES.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									size: "sm",
									variant: prefs.density === choice.value ? "default" : "outline",
									onClick: () => update({ density: choice.value }),
									"aria-pressed": prefs.density === choice.value,
									children: choice.label
								}, choice.value))
							})] })
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
					className: "p-5 text-[13px] text-muted-foreground",
					children: "These preferences are stored in this browser only. They are not synced, and they contain no message content. Opening OCADE on another device gives that device its own settings."
				})
			]
		})
	] });
}
/**
* Parsing the code a computer shows when it agrees to be paired.
*
* Pure, and deliberately apart from the panel that renders it: this is the
* function that decides whether a browser will talk to a given address, and
* the loopback / https rule inside it is a security boundary. A security
* boundary living in a component file is one that gets edited during a layout
* change.
*/
/**
* A pairing code carries three things the browser needs. Parsed strictly:
* a malformed code is refused rather than half-applied, because a partly
* configured pairing fails later in a way nobody can diagnose.
*/
function parsePairingCode(raw) {
	const trimmed = raw.trim();
	if (!trimmed) return {
		ok: false,
		reason: "Enter the code shown on your computer."
	};
	let decoded;
	try {
		decoded = atob(trimmed.replace(/\s+/g, ""));
	} catch {
		return {
			ok: false,
			reason: "That does not look like a pairing code from OCADE."
		};
	}
	const parts = decoded.split("|");
	if (parts.length !== 3) return {
		ok: false,
		reason: "That pairing code is incomplete. Copy the whole thing."
	};
	const [deviceId, bridgeUrl, secret] = parts;
	if (!deviceId || !bridgeUrl || !secret) return {
		ok: false,
		reason: "That pairing code is missing part of its detail."
	};
	let url;
	try {
		url = new URL(bridgeUrl);
	} catch {
		return {
			ok: false,
			reason: "That code contains an address OCADE cannot use."
		};
	}
	const loopback = [
		"localhost",
		"127.0.0.1",
		"[::1]"
	].includes(url.hostname);
	if (url.protocol !== "https:" && !loopback) return {
		ok: false,
		reason: "That computer is offering an unencrypted address, so OCADE will not connect to it."
	};
	return {
		ok: true,
		deviceId,
		bridgeUrl,
		secret
	};
}
function PairedComputerPanel() {
	const [code, setCode] = (0, import_react.useState)("");
	const [paired, setPaired] = (0, import_react.useState)(false);
	const [connection, setConnection] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const check = (0, import_react.useCallback)(async () => {
		if (!hasPairing()) {
			setPaired(false);
			setConnection(null);
			return;
		}
		setPaired(true);
		setBusy("check");
		try {
			const availability = await new PairedDesktopAdapter({ credentials: pairedCredentials }).probe();
			setConnection(availability.available ? {
				reachable: true,
				label: availability.label,
				detail: "Answering now."
			} : {
				reachable: false,
				detail: availability.reason
			});
		} finally {
			setBusy(null);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		check();
	}, [check]);
	const connect = (0, import_react.useCallback)(async () => {
		const parsed = parsePairingCode(code);
		if (!parsed.ok) {
			toast.error(parsed.reason);
			return;
		}
		setBusy("connect");
		try {
			if (!savePairing({
				deviceId: parsed.deviceId,
				bridgeUrl: parsed.bridgeUrl,
				secret: parsed.secret
			})) {
				toast.error("This browser refused to save the pairing.");
				return;
			}
			setCode("");
			await check();
			toast.success("Paired. OCADE will use that computer when it can reach it.");
		} finally {
			setBusy(null);
		}
	}, [code, check]);
	const forget = (0, import_react.useCallback)(async () => {
		forgetPairing();
		setPaired(false);
		setConnection(null);
		toast.success("This browser has forgotten the pairing.");
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Laptop, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: "Paired computer"
					})]
				}), paired ? connection?.reachable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatusBadge, {
					status: "connected",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "mr-1 inline h-3 w-3" }), "Reachable"]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
					status: "paused",
					children: "Not reachable"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
					status: "setup_required",
					children: "Not paired"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[13px] text-muted-foreground",
				children: "Let this browser use the OCADE engine on a computer you own. Answers are generated there — on your hardware, not a company's — and nothing is sent to a third party."
			}),
			paired ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "mt-4 grid gap-2 text-[13px] sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Computer"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "text-foreground",
						children: connection?.label ?? "Paired computer"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Status"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "text-foreground",
						children: connection?.detail ?? "Checking…"
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => void check(),
						disabled: busy !== null,
						children: [busy === "check" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : null, "Check connection"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => void forget(),
						disabled: busy !== null,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link2Off, { className: "mr-2 h-4 w-4" }), "Forget on this browser"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex gap-2 rounded-md border border-border/60 bg-card/40 p-3 text-[12px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
						className: "mt-0.5 h-3.5 w-3.5 shrink-0",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Forgetting removes the pairing from this browser only. To stop this device being served at all, revoke it on the computer itself — that is the change the computer enforces." })]
				})
			] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "ocade-pairing-code",
						className: "text-[13px] text-foreground",
						children: "Pairing code from your computer"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "ocade-pairing-code",
							value: code,
							onChange: (e) => setCode(e.target.value),
							placeholder: "Paste the code shown in OCADE on that computer",
							className: "h-9 min-w-[16rem] flex-1 text-[13px]",
							autoComplete: "off",
							spellCheck: false
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							onClick: () => void connect(),
							disabled: busy !== null || !code.trim(),
							children: [busy === "connect" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link2, { className: "mr-2 h-4 w-4" }), "Pair"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[12px] text-muted-foreground",
						children: "Open OCADE on the computer, approve this device there, and it will show you a code. The approval happens on that computer — a website cannot pair itself. This is not a password and OCADE will never ask for one here."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 text-[12px] text-muted-foreground",
				children: [
					"Each request is signed and usable once, and expires after",
					" ",
					Math.round(TOKEN_LIFETIME_MS / 1e3),
					" seconds, so a captured one cannot be reused. The shared secret signs requests and is never sent anywhere."
				]
			})
		]
	});
}
/**
* OCADE Local Engine settings.
*
* The engine controls and the model lifecycle already existed on the model
* control centre; what did not exist anywhere was a plain answer to the
* question a user actually asks first — "what did OCADE decide about MY
* computer, and why?".
*
* The specification is measured, not typed: every figure below comes from the
* hardware probe on this machine, and the sentence explaining the choice is
* generated by the same tier policy that made it. When measurement fails, the
* page says so and shows what it is falling back to, because "we could not
* measure this device" and "this device is weak" are different facts and lead
* to different actions.
*
* The raw model name is deliberately absent from this page. It belongs in
* About and Licences, where the licence it ships under is also shown.
*/
function Spec({ icon: Icon, label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-white/10 bg-white/[0.02] p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-3.5 w-3.5" }), label]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-sm font-medium text-foreground",
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-0.5 text-[12px] text-muted-foreground",
				children: hint
			}) : null
		]
	});
}
function LocalEngineSettingsPanel() {
	const device = useDevicePolicy();
	const profile = device.profile;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "OCADE",
		title: "Local Engine",
		description: "The AI engine that runs on this computer. It answers without sending anything to a server, and it is bound to this machine only.",
		actions: device.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
			status: "pending",
			children: "Measuring device"
		}) : device.measured ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
			status: "active",
			children: "Device measured"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
			status: "setup_required",
			children: "Estimated in browser"
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-5 pb-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: "This device"
					}),
					device.problem ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-3 rounded-md border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 p-3 text-[13px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-4 w-4 shrink-0 text-[color:var(--state-warning)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground",
							children: device.problem
						})]
					}) : null,
					profile ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spec, {
								icon: MemoryStick,
								label: "Memory",
								value: device.measured ? `${profile.totalRamGib} GB total` : profile.totalRamGib > 0 ? `at least ${profile.totalRamGib} GB` : "not reported",
								hint: device.measured ? `${profile.availableRamGib} GB free right now` : "Browsers cap this figure, so OCADE does not use it to rule engines out."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spec, {
								icon: Cpu,
								label: "Processor",
								value: `${profile.cpuCount} logical cores`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spec, {
								icon: MonitorCog,
								label: "Graphics",
								value: profile.hasDiscreteGpu ? "Dedicated graphics" : profile.gpuCertain ? "No dedicated graphics" : "Could not be confirmed",
								hint: profile.gpuCertain ? void 0 : "OCADE does not assume acceleration it could not verify."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spec, {
								icon: HardDrive,
								label: "Free storage",
								value: `${profile.freeStorageGib} GB`
							})
						]
					}), device.because ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 rounded-md border border-white/10 bg-white/[0.02] p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] uppercase tracking-[0.12em] text-muted-foreground",
							children: "Why this engine"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[13px] text-muted-foreground",
							children: device.because
						})]
					}) : null] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-[13px] text-muted-foreground",
						children: device.loading ? "Reading this device's memory, processor, graphics and free storage…" : "This device could not be measured, so engine selection is running on a browser estimate. Memory-based limits are relaxed rather than guessed at."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-[12px] text-muted-foreground",
						children: describeDeviceSource(device)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[12px] text-muted-foreground",
						children: "Memory limits are measured against TOTAL memory, not the amount free at this instant. Free memory moves constantly as the system releases cache, and selecting on it would refuse engines this machine demonstrably runs."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocalEngineControl, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-5" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocalModelLifecyclePanel, {})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PairedComputerPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GestureControlPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold text-foreground",
					children: "Keeping this computer usable"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "One engine is held in memory at a time. A second resident model on a machine this size makes the system swap, which freezes whatever you are doing rather than merely slowing the reply." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "One request is served at a time. Parallel slots multiply memory use for no benefit when one person is chatting." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Memory is released after a short idle period, so closing the chat gives it back." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "The engine listens on this computer only. It is never reachable from your network or the internet." })
					]
				})]
			})
		]
	})] });
}
/**
* Where the appearance preferences on this screen were actually saved.
*
* Appearance is the one settings area that applies instantly and is therefore
* the easiest to lie about: the switch moves, the interface changes, and a
* failed write is invisible until the next refresh silently reverts it. This
* strip states the truth for each of the three outcomes — saved to the account,
* saved to this browser only, or not saved at all — and offers a retry rather
* than leaving the user to flip the switch again and hope.
*/
function AppearanceSaveState() {
	const { persistence, retryPersist } = useAppearance();
	const { status, scope, message, loadError, loadedFromCloud } = persistence;
	if (status === "error" || scope === "none") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "alert",
		className: "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11.5px] text-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
			className: "mt-[1px] h-3.5 w-3.5 shrink-0 text-destructive",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: message ?? "We couldn't save your motion and depth preferences." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => void retryPersist(),
				className: "mt-1.5 inline-flex h-6 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-foreground hover:bg-secondary/60",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
					className: "h-3 w-3",
					"aria-hidden": true
				}), "Try saving again"]
			})]
		})]
	});
	if (loadError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "status",
		className: "flex items-start gap-2 rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-[11.5px] text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudOff, {
			className: "mt-[1px] h-3.5 w-3.5 shrink-0",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: loadError }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => void retryPersist(),
				className: "mt-1.5 inline-flex h-6 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-foreground hover:bg-secondary/60",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
					className: "h-3 w-3",
					"aria-hidden": true
				}), "Sync these settings to my account"]
			})]
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		role: "status",
		"aria-live": "polite",
		className: "flex items-center gap-1.5 text-[11px] text-muted-foreground",
		children: status === "saving" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
			className: "h-3 w-3 animate-spin",
			"aria-hidden": true
		}), "Saving…"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
			className: "h-3 w-3",
			"aria-hidden": true
		}), scope === "cloud" || loadedFromCloud ? "Motion, depth and appearance are saved to your account, so they come back after a refresh and in new sessions on your other devices." : "Motion, depth and appearance are saved on this browser and restored after a refresh. Sign in to carry them to your other devices."] })
	});
}
/**
* 3D motion, and what this device will actually render.
*
* THE HONEST PART. Most "animation quality" settings are a preference the
* product then ignores. This one shows the tier that was actually CHOSEN for
* this machine, computed from the same function the landing page uses, and says
* which signal decided it. A user on a four-year-old laptop can see that OCADE
* noticed rather than wondering why it looks different from the marketing.
*
* THE SYSTEM PREFERENCE WINS. `prefers-reduced-motion` overrides everything
* here, including a user who has switched motion on in this panel, and the
* panel says so instead of letting the toggle appear to work.
*/
/**
* The strength dial, as three named stops rather than a free slider.
*
* A continuous 0-200 control asks people to tune a number they cannot preview
* precisely, and every value in between is one somebody has to support. Three
* stops are a choice; a slider is a chore.
*/
var DEPTH_STEPS = [
	{
		value: 50,
		label: "Subtle"
	},
	{
		value: 100,
		label: "Balanced"
	},
	{
		value: 160,
		label: "Deep"
	}
];
/** Which stop a stored value belongs to, so an out-of-band number still shows one selected. */
function nearestStep(value) {
	return DEPTH_STEPS.reduce((best, step) => Math.abs(step.value - value) < Math.abs(best.value - value) ? step : best).value;
}
function MotionPanel() {
	const { canEdit } = useSettingsAccess();
	const { reducedMotion, osReducedMotion, depth3d, depthStrength, update } = useAppearance();
	/** Either source of the preference; the depth scene treats them identically. */
	const motionOff = reducedMotion || osReducedMotion;
	const depth = useDepth();
	const [tier, setTier] = (0, import_react.useState)("full");
	const [signals, setSignals] = (0, import_react.useState)({ width: 0 });
	(0, import_react.useEffect)(() => {
		const nav = navigator;
		const measured = {
			cores: nav.hardwareConcurrency,
			memoryGb: nav.deviceMemory,
			width: window.innerWidth
		};
		setSignals(measured);
		setTier(chooseRenderTier({
			reducedMotion: osReducedMotion || reducedMotion,
			cores: measured.cores,
			memoryGb: measured.memoryGb,
			viewportWidth: measured.width
		}));
	}, [osReducedMotion, reducedMotion]);
	const tierWord = tier === "full" ? "Full" : tier === "reduced" ? "Reduced" : "Still frames only";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex flex-col gap-3 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, {
					className: "h-4 w-4 text-muted-foreground",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold text-foreground",
					children: "3D Motion"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadOnlyBanner, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceSaveState, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PerformanceFallbackNotice, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsField, {
				label: "Reduce motion",
				description: "Holds the interface still: no 3D depth, no landing animation, no panel movement. Text, colour, contrast, buttons and layout are unchanged, and everything keeps working.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: motionOff,
					disabled: !canEdit || osReducedMotion,
					onCheckedChange: (next) => void update({ reducedMotion: next }),
					"aria-label": "Reduce motion"
				})
			}),
			osReducedMotion ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-[11.5px] text-muted-foreground",
				children: "Your operating system asks for reduced motion, so OCADE follows it. Change it in your system accessibility settings to enable motion here."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsField, {
				label: "3D depth",
				description: "Surfaces sit at real distances in one perspective scene, so panels layer, cast matching shadows and drift against each other as the pointer moves.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: depth3d && !motionOff,
					disabled: !canEdit || motionOff,
					onCheckedChange: (next) => void update({ depth3d: next }),
					"aria-label": "3D depth"
				})
			}),
			motionOff ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-[11.5px] text-muted-foreground",
				children: "3D depth and animation are switched off automatically while reduced motion is on. Your depth preference is remembered and comes back when you turn motion on again."
			}) : null,
			depth3d && !motionOff ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsField, {
				label: "Depth strength",
				description: "How pronounced the third dimension is. Subtle keeps the layering and almost removes the movement.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-1",
					role: "group",
					"aria-label": "Depth strength",
					children: DEPTH_STEPS.map((step) => {
						const selected = nearestStep(depthStrength) === step.value;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: !canEdit,
							"aria-pressed": selected,
							onClick: () => void update({ depthStrength: step.value }),
							className: cn("h-7 rounded-md border px-2.5 text-[11.5px] transition-colors disabled:opacity-50", selected ? "border-primary/50 bg-primary/15 text-foreground" : "border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"),
							children: step.label
						}, step.value);
					})
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "rounded-md border border-border/60 bg-secondary/25 px-2.5 py-2 text-[11.5px] text-muted-foreground",
				children: [
					"Right now:",
					" ",
					depth.mode === "full" ? "depth and pointer tilt are both active." : depth.mode === "static" ? "depth is active and pointer tilt is off." : depth3d ? "flat — this browser or device cannot composite 3D transforms." : "flat, because you turned 3D depth off."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 rounded-lg border border-border/60 bg-secondary/25 p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[12.5px] font-medium text-foreground",
					children: ["This device renders: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular-nums",
						children: tierWord
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-[11.5px] leading-relaxed text-muted-foreground",
					children: [
						"Chosen from ",
						signals.cores ?? "an unknown number of",
						" processor cores",
						signals.memoryGb ? `, ${signals.memoryGb} GB of memory` : "",
						", and a ",
						signals.width,
						"px viewport. ",
						starCountFor(tier),
						" background stars.",
						tier !== "full" ? " OCADE stepped down so the interface stays responsive rather than stuttering." : ""
					]
				})]
			})
		]
	});
}
/** Plain-language name and remedy for each gap. */
function describeGap(gap) {
	switch (gap) {
		case "no_service_worker": return {
			title: "The app cannot open without a connection",
			action: "This browser has not installed OCADE's offline shell. Private browsing and some managed profiles block it."
		};
		case "shell_not_cached": return {
			title: "Nothing is cached yet",
			action: "Use OCADE once while online and the app itself will be kept on this device."
		};
		case "runtime_not_cached": return {
			title: "The engine runtime is not on this device",
			action: "Ask OCADE one question while online. The runtime is kept after the first use."
		};
		case "no_model": return {
			title: "No engine is installed",
			action: "Download an engine in Settings → Local Intelligence, or install one from a file on this device in Settings → Offline Storage."
		};
		case "model_unverified": return {
			title: "The installed engine is incomplete",
			action: "It did not finish arriving, or did not match its fingerprint. Download it again, or install it from a file."
		};
		case "storage_evictable": return {
			title: "The download could be cleared automatically",
			action: "Ask the browser to keep it, in Settings → Offline Storage. Without that it may be deleted when the device is low on space."
		};
	}
}
/**
* Assess, naming every gap rather than the first one found.
*
* Returning only the first gap would send a user round a loop: fix it, be told
* about the next, fix that, be told about a third. They deserve the whole list
* at once, because some of it can only be done while there is still a network.
*/
function assessOffline(input) {
	const gaps = [];
	if (!input.serviceWorkerActive) gaps.push("no_service_worker");
	else if (input.shellCachedEntries === 0) gaps.push("shell_not_cached");
	if (!input.runtimeCached) gaps.push("runtime_not_cached");
	const verified = input.models.filter((m) => m.verified && m.bytes > 0);
	if (input.models.length === 0) gaps.push("no_model");
	else if (verified.length === 0) gaps.push("model_unverified");
	if (verified.length > 0 && !input.persistent) gaps.push("storage_evictable");
	const canOpenOffline = input.serviceWorkerActive && input.shellCachedEntries > 0;
	const canAnswerOffline = verified.length > 0 && input.runtimeCached;
	const ready = gaps.length === 0;
	return {
		ready,
		gaps,
		canOpenOffline,
		canAnswerOffline,
		summary: summarise({
			ready,
			canOpenOffline,
			canAnswerOffline,
			gaps
		})
	};
}
function summarise(state) {
	if (state.ready) return "OCADE works with no connection: it opens, and it answers on this device.";
	if (state.canOpenOffline && state.canAnswerOffline) return "OCADE opens and answers without a connection. One thing is not yet guaranteed to survive — see below.";
	if (state.canOpenOffline) return "OCADE opens without a connection, but it cannot answer yet. Answering offline needs an engine downloaded to this device.";
	if (state.canAnswerOffline) return "OCADE can answer on this device, but the app itself still needs a connection to open.";
	return "OCADE cannot work without a connection yet.";
}
/**
* Which cached entries count as the engine runtime.
*
* Matched on the URL because that is what Cache Storage stores. Kept beside
* `assessOffline` so the definition of "the runtime is cached" lives in one
* place rather than being re-guessed at each call site.
*/
function isRuntimeAsset(url) {
	return /\.wasm(\?|$)/.test(url) || /wllama|webllm|tokenizer/i.test(url);
}
/**
* Measure the four things offline readiness actually depends on.
*
* Split from `assessOffline` so the policy is pure and testable and this file
* holds only the browser calls. Every one of them is optional in some browser,
* so each failure is caught and reported as "not present" — the safe direction.
* A readiness check that throws is a readiness check that gets wrapped in a
* try/catch at the call site and quietly treated as "fine".
*/
async function measureOfflineReadiness() {
	let serviceWorkerActive = false;
	try {
		serviceWorkerActive = Boolean(navigator.serviceWorker?.controller);
		if (!serviceWorkerActive && navigator.serviceWorker?.getRegistration) {
			const registration = await navigator.serviceWorker.getRegistration();
			serviceWorkerActive = Boolean(registration?.active);
		}
	} catch {}
	let shellCachedEntries = 0;
	let runtimeCached = false;
	try {
		if (typeof caches !== "undefined") for (const name of await caches.keys()) {
			const cache = await caches.open(name);
			for (const request of await cache.keys()) {
				shellCachedEntries += 1;
				if (isRuntimeAsset(request.url)) runtimeCached = true;
			}
		}
	} catch {}
	let models = [];
	try {
		models = await modelStore.list();
	} catch {}
	let persistent = false;
	try {
		persistent = await navigator.storage?.persisted?.() ?? false;
	} catch {}
	return assessOffline({
		serviceWorkerActive,
		shellCachedEntries,
		runtimeCached,
		models,
		persistent
	});
}
/** Names the service worker uses, mapped to what a person would call them. */
var BUCKET_LABELS = [
	{
		match: /^ocade-shell/,
		describes: "The application itself — opens with no connection"
	},
	{
		match: /webllm|wasm|model|weights/i,
		describes: "Engine weights — what answers on this device"
	},
	{
		match: /link|capture/i,
		describes: "Pages you captured, kept readable offline"
	}
];
function describeBucket(name) {
	return BUCKET_LABELS.find((b) => b.match.test(name))?.describes ?? "Cached files";
}
/**
* Measure. Never throws — every API here is optional in some browser, and a
* settings screen that crashes because a quota API is missing is worse than one
* that says "this browser will not tell us".
*/
async function measureStorage() {
	const empty = {
		usageBytes: null,
		quotaBytes: null,
		persistent: false,
		measurable: false,
		buckets: []
	};
	if (typeof navigator === "undefined") return empty;
	let usageBytes = null;
	let quotaBytes = null;
	let measurable = false;
	try {
		if (navigator.storage?.estimate) {
			const estimate = await navigator.storage.estimate();
			usageBytes = estimate.usage ?? null;
			quotaBytes = estimate.quota ?? null;
			measurable = true;
		}
	} catch {}
	let persistent = false;
	try {
		persistent = await navigator.storage?.persisted?.() ?? false;
	} catch {}
	const buckets = [];
	try {
		if (typeof caches !== "undefined") for (const name of await caches.keys()) {
			const keys = await (await caches.open(name)).keys();
			buckets.push({
				name,
				describes: describeBucket(name),
				entries: keys.length,
				bytes: null
			});
		}
	} catch {}
	return {
		usageBytes,
		quotaBytes,
		persistent,
		measurable,
		buckets
	};
}
/**
* Ask the browser to stop evicting our cache.
*
* Returns what actually happened. Chrome grants this silently based on
* engagement; Firefox prompts; Safari may refuse outright. Reporting the real
* outcome is the difference between "your engine is safe offline" being true
* and being a hope.
*/
async function requestPersistentStorage() {
	if (typeof navigator === "undefined" || !navigator.storage?.persist) return {
		granted: false,
		reason: "This browser cannot protect stored data from being cleared automatically."
	};
	try {
		const granted = await navigator.storage.persist();
		return {
			granted,
			reason: granted ? "Your downloaded engine and cached pages will not be cleared automatically." : "The browser declined. It may still clear OCADE's cache when the device runs low on space — the engine would need downloading again."
		};
	} catch {
		return {
			granted: false,
			reason: "The browser refused the request."
		};
	}
}
/** Bytes as a person reads them. Null stays null rather than becoming "0 B". */
function formatBytes(bytes) {
	if (bytes === null) return "unknown";
	if (bytes < 1024) return `${bytes} B`;
	const units = [
		"KB",
		"MB",
		"GB",
		"TB"
	];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
/**
* Delete one cache bucket.
*
* Separated from the report so a caller cannot clear something it has not
* shown the user first.
*/
async function clearBucket(name) {
	try {
		if (typeof caches === "undefined") return false;
		return await caches.delete(name);
	} catch {
		return false;
	}
}
/**
* What OCADE is keeping on this device so it works without a connection.
*
* WHY THIS SCREEN EXISTS AT ALL. OCADE tells people it works offline once an
* engine has been downloaded, and that claim is only honest if they can see
* what has actually been downloaded and how much of their disk it costs. A
* product that says "works offline" while holding nothing is making a promise
* it breaks on the first flight.
*
* Readable without an account, because "how much space will this take" is a
* question people reasonably want answered before signing up. Clearing is a
* local action on local data, so it does NOT need an account either — the
* read-only gate covers synced settings, not the user's own disk.
*/
function OfflineStoragePanel() {
	const [report, setReport] = (0, import_react.useState)(null);
	const [readiness, setReadiness] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const refresh = (0, import_react.useCallback)(async () => {
		const [storage, offline] = await Promise.all([measureStorage(), measureOfflineReadiness()]);
		setReport(storage);
		setReadiness(offline);
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh]);
	const askPersist = async () => {
		setBusy(true);
		const outcome = await requestPersistentStorage();
		setBusy(false);
		(outcome.granted ? toast.success : toast.warning)(outcome.reason);
		refresh();
	};
	const clear = async (name) => {
		setBusy(true);
		const removed = await clearBucket(name);
		setBusy(false);
		if (removed) {
			toast.success("Cleared.", { description: "Anything that was cached will be downloaded again next time you are online." });
			refresh();
		} else toast.error("That cache could not be cleared in this browser.");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex flex-col gap-3 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, {
					className: "h-4 w-4 text-muted-foreground",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold text-foreground",
					children: "Offline Storage"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadOnlyBanner, {}),
			readiness ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("rounded-lg border p-3", readiness.ready ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/5" : "border-border/60 bg-secondary/25"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-start gap-2 text-[13px] text-foreground",
					children: [readiness.ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
						className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-success)]",
						"aria-hidden": true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlugZap, {
						className: "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: readiness.summary })]
				}), readiness.gaps.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2.5 flex flex-col gap-2 border-t border-border/50 pt-2.5",
					children: readiness.gaps.map((gap) => {
						const { title, action } = describeGap(gap);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "text-[11.5px] leading-relaxed",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-medium text-foreground",
									children: [title, "."]
								}),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: action
								})
							]
						}, gap);
					})
				}) : null]
			}) : null,
			report === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex items-center gap-2 text-[12.5px] text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
					className: "h-3.5 w-3.5 animate-spin",
					"aria-hidden": true
				}), " Measuring…"]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border/60 bg-secondary/25 p-3",
					children: [
						report.measurable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[13px] text-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium tabular-nums",
									children: formatBytes(report.usageBytes)
								}),
								" ",
								"used of ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular-nums",
									children: formatBytes(report.quotaBytes)
								}),
								" this browser allows."
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-muted-foreground",
							children: "This browser will not report how much space OCADE is using."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground",
							children: [report.persistent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
								className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-success)]",
								"aria-hidden": true
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
								className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-warning)]",
								"aria-hidden": true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: report.persistent ? "Protected. The browser will not clear OCADE's downloads to reclaim space." : "Not protected. If this device runs low on space the browser may clear OCADE's cache, and a downloaded engine would need downloading again." })]
						}),
						!report.persistent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							className: "mt-2.5",
							disabled: busy,
							onClick: () => void askPersist(),
							children: "Ask the browser to keep it"
						}) : null
					]
				}),
				report.buckets.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[12.5px] text-muted-foreground",
					children: "Nothing is cached yet, so OCADE cannot open or answer without a connection. Visit a page or download an engine while online and it will be kept here."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-col gap-1.5",
					children: report.buckets.map((bucket) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-[12.5px] font-medium text-foreground",
								children: bucket.describes
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[11px] text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "tabular-nums",
										children: bucket.entries
									}),
									" ",
									bucket.entries === 1 ? "file" : "files",
									" ·",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
										className: "font-mono",
										children: bucket.name
									})
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							disabled: busy,
							onClick: () => void clear(bucket.name),
							"aria-label": `Clear ${bucket.describes}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							})
						})]
					}, bucket.name))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11.5px] leading-relaxed text-muted-foreground",
					children: "OCADE answers on this device with no network at all — that is what these files are. The engine can be downloaded once while online, or installed from a file below on a device that never connects."
				})
			] })
		]
	});
}
/**
* Install the engine from a file on this machine, with no connection.
*
* THE GAP THIS CLOSES. Every other route to a working engine starts with a
* download, so OCADE's offline promise had a step in it that could not be done
* offline: the first one. On an air-gapped machine, behind an egress policy
* that blocks the model host, or on a connection nobody will spend 470 MB on,
* "works offline once the engine is downloaded" meant "does not work here".
*
* The imported file is held to the SAME published fingerprint a downloaded one
* is — see `importModelFile`. A file handed over on a USB stick warrants more
* scrutiny than one fetched over TLS, not less, and a mismatch deletes it
* rather than running weights that would load happily and answer nonsense.
*/
function EngineImportPanel() {
	const inputRef = (0, import_react.useRef)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [fraction, setFraction] = (0, import_react.useState)(0);
	const [outcome, setOutcome] = (0, import_react.useState)(null);
	const tier = WASM_TIERS[0];
	const entry = resolvedFor(tier);
	const key = storageKeyFor(tier);
	const supported = ModelStore.isSupported();
	const onPick = async (file) => {
		if (!file || !key) return;
		setBusy(true);
		setFraction(0);
		setOutcome(null);
		try {
			const result = await importModelFile({
				key,
				file,
				sha256: sha256For(tier),
				onProgress: (p) => setFraction(p.fraction)
			});
			if (result.ok) {
				const message = result.verified ? `Engine installed and verified against its published fingerprint (${formatSize(result.bytes)}). OCADE can now answer on this device with no connection.` : `Engine installed (${formatSize(result.bytes)}), but this browser could not check its fingerprint. It will be re-checked next time.`;
				setOutcome({
					ok: true,
					message
				});
				(result.verified ? toast.success : toast.warning)("Engine installed.", { description: message });
			} else {
				setOutcome({
					ok: false,
					message: result.reason
				});
				toast.error("The engine was not installed.", { description: result.reason });
			}
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : "The file could not be read.";
			setOutcome({
				ok: false,
				message
			});
			toast.error("The engine was not installed.", { description: message });
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex flex-col gap-3 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDown, {
					className: "h-4 w-4 text-muted-foreground",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold text-foreground",
					children: "Install the engine from a file"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[12.5px] leading-relaxed text-muted-foreground",
				children: "If this device cannot reach the internet, copy the engine file across and select it here. Nothing is downloaded and no request leaves this machine."
			}),
			entry ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-border/60 bg-secondary/25 p-3 text-[11.5px] leading-relaxed text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-foreground",
					children: ["Expected file: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "font-mono",
						children: entry.path
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular-nums",
							children: formatSize(entry.sizeBytes)
						}),
						" · SHA-256",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "break-all font-mono",
							children: entry.sha256
						})
					]
				})]
			}) : null,
			!supported ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex items-start gap-1.5 text-[12px] leading-relaxed text-[color:var(--state-warning)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
					className: "mt-0.5 h-3.5 w-3.5 shrink-0",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "This browser cannot store a model between visits, so an imported engine would be lost on reload. Importing is disabled rather than allowed to waste the transfer." })]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: inputRef,
				type: "file",
				accept: ".gguf",
				className: "sr-only",
				"aria-label": "Engine file",
				onChange: (e) => void onPick(e.target.files?.[0])
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "outline",
				disabled: busy || !supported || !key,
				onClick: () => inputRef.current?.click(),
				children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
						className: "h-3.5 w-3.5 animate-spin",
						"aria-hidden": true
					}),
					"Installing… ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums",
						children: [Math.round(fraction * 100), "%"]
					})
				] }) : "Choose engine file"
			})] }),
			busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-1 w-full overflow-hidden rounded-full bg-secondary",
				role: "progressbar",
				"aria-label": "Installing engine",
				"aria-valuemin": 0,
				"aria-valuemax": 100,
				"aria-valuenow": Math.round(fraction * 100),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full bg-primary transition-[width]",
					style: { width: `${Math.round(fraction * 100)}%` }
				})
			}) : null,
			outcome ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: outcome.ok ? "flex items-start gap-1.5 text-[12px] leading-relaxed text-[color:var(--state-success)]" : "flex items-start gap-1.5 text-[12px] leading-relaxed text-destructive",
				role: "status",
				children: [outcome.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
					className: "mt-0.5 h-3.5 w-3.5 shrink-0",
					"aria-hidden": true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
					className: "mt-0.5 h-3.5 w-3.5 shrink-0",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: outcome.message })]
			}) : null
		]
	});
}
/**
* Settings → Offline Storage.
*
* The two panels belong on one screen: this is where someone lands when
* offline does not work, and the second panel is the answer for the device
* that can never complete a download. Splitting them across sections would put
* the diagnosis and its only remedy in different places.
*
* A named component rather than a fragment in the section map on purpose —
* `settings-sections-reachable.test.ts` resolves each section to a real
* component file, and that guard is worth keeping intact.
*/
function OfflineSection() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfflineStoragePanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EngineImportPanel, {})]
	});
}
/**
* Account self-service — irreversible deletion.
*
* Deletion is a privileged operation: the caller is authenticated with
* `requireSupabaseAuth`, the target is ALWAYS `context.userId` (never an input
* parameter, so no request can aim this at another account), and the service
* client is imported inside the handler so it never reaches a client bundle.
*
* Order matters. Rows that hang off the account are scrubbed first, then the
* sign-in identity itself; deleting the identity first would leave orphaned
* rows behind on any table without a cascade.
*/
/**
* The user must type this exactly. A typed phrase is the second confirmation
* required for destructive actions — a button alone is not consent.
*/
var DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
var deleteAccountInput = objectType({ confirmation: stringType() });
var deleteMyAccount = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((data) => deleteAccountInput.parse(data)).handler(createSsrRpc("27301031363e284184ead21ac910c33ebfbe9159435c975f26319c6a65fade88"));
/**
* Delete account.
*
* Two confirmations, as the destructive-action rule requires: opening the
* panel, then typing the exact phrase. The list above the field states what
* goes, so nobody discovers the scope afterwards.
*/
function DeleteAccountCard() {
	const navigate = useNavigate();
	const deleteAccount = useServerFn(deleteMyAccount);
	const [armed, setArmed] = (0, import_react.useState)(false);
	const [phrase, setPhrase] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const matches = phrase.trim().toUpperCase() === DELETE_CONFIRMATION;
	async function run() {
		setBusy(true);
		recordAction({ actionId: "account.delete" });
		try {
			await deleteAccount({ data: { confirmation: phrase } });
			await supabase.auth.signOut();
			toast.success("Account deleted.", { description: "Your data has been removed." });
			await navigate({
				to: "/",
				replace: true
			});
		} catch (error) {
			setBusy(false);
			toast.error("Could not delete the account.", { description: error instanceof Error ? error.message : "Please try again." });
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex flex-col gap-4 border-destructive/30 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "h-4 w-4 text-destructive",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold text-foreground",
					children: "Delete account"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] leading-6 text-muted-foreground",
				children: "This permanently removes your profile, chat history and messages, support cases and account records, then deletes your sign-in itself. It cannot be undone and there is no recovery window."
			}),
			armed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-[12px] text-muted-foreground",
						htmlFor: "delete-confirm",
						children: [
							"Type ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-foreground",
								children: DELETE_CONFIRMATION
							}),
							" to confirm."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "delete-confirm",
						value: phrase,
						autoComplete: "off",
						disabled: busy,
						onChange: (event) => setPhrase(event.target.value),
						placeholder: DELETE_CONFIRMATION
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "destructive",
							disabled: !matches || busy,
							onClick: () => void run(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							}), busy ? "Deleting…" : "Delete permanently"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: busy,
							onClick: () => {
								setArmed(false);
								setPhrase("");
							},
							children: "Cancel"
						})]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "outline",
				onClick: () => setArmed(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), "Delete account"]
			}) })
		]
	});
}
/**
* Account.
*
* WHAT IT REPLACED. Four separate placeholder pages — Profile, Account,
* Authentication and Security — none of which rendered anything but a notice
* saying they were not built. Four destinations in the sidebar, four clicks,
* four apologies. This is one page that shows the account that exists and the
* one action anyone reliably wants from it.
*
* DELIBERATELY SMALL. Changing an email or a password is Supabase's own flow
* and belongs behind the sign-in screen rather than reimplemented here; adding
* fields that post nowhere would put the placeholders back with a different
* shape. When those flows exist, they go here.
*/
function AccountPanel() {
	const { canEdit: signedIn, reason } = useSettingsAccess();
	const navigate = useNavigate();
	const [email, setEmail] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		supabase.auth.getUser().then(({ data }) => {
			if (!cancelled) setEmail(data.user?.email ?? null);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	const signOut = async () => {
		setBusy(true);
		recordAction({ actionId: "auth.sign_out" });
		const { error } = await supabase.auth.signOut();
		setBusy(false);
		if (error) {
			toast.error("Could not sign out.", { description: error.message });
			return;
		}
		toast.success("Signed out.");
		await navigate({
			to: "/auth",
			replace: true
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "flex flex-col gap-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, {
					className: "h-4 w-4 text-muted-foreground",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold text-foreground",
					children: "Account"
				})]
			}), signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
				children: "Signed in as"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[14px] text-foreground",
				children: email ?? "…"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "outline",
				disabled: busy,
				onClick: () => void signOut(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), busy ? "Signing out…" : "Sign out"]
			}) })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] leading-relaxed text-muted-foreground",
					children: "An account keeps your conversations, files and approved devices between visits. Everything else in Settings is readable without one."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[12px] text-muted-foreground/70",
					children: reason
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/auth",
					className: "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: "Sign in"
				}) })
			] })]
		}), signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeleteAccountCard, {}) : null]
	});
}
function ImageSettingsPanel() {
	const [state, setState] = (0, import_react.useState)({
		loading: true,
		reachable: false,
		models: []
	});
	const probe = (0, import_react.useCallback)(async () => {
		setState((s) => ({
			...s,
			loading: true
		}));
		const discovery = await discoverLocalModels(DEFAULT_LOCAL_BRIDGE_URL);
		setState({
			loading: false,
			reachable: discovery.reachable,
			models: discovery.models.filter((m) => m.vision),
			reason: discovery.reason
		});
	}, []);
	(0, import_react.useEffect)(() => {
		probe();
	}, [probe]);
	const visionReady = state.models.length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "OCADE",
		title: "Images",
		description: "Reading images you attach to a chat, and creating images from a prompt.",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "outline",
			size: "sm",
			onClick: () => void probe(),
			disabled: state.loading,
			children: [state.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-2 h-4 w-4" }), "Re-check"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-5 pb-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-foreground",
							children: "Reading images"
						})]
					}), state.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
						status: "pending",
						children: "Checking"
					}) : visionReady ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
						status: "active",
						children: "Available on this device"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
						status: "setup_required",
						children: "Setup required"
					})]
				}), visionReady ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[13px] text-muted-foreground",
					children: "Attach an image in chat and ask OCADE to describe it, read a screenshot, pull text out of it, or explain a chart. It runs on this computer, so the image is not uploaded anywhere."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 space-y-1 text-[13px] text-muted-foreground",
					children: state.models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--state-success)]" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-foreground",
								children: model.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"· ",
								(model.sizeBytes / 1e9).toFixed(2),
								" GB on disk"
							] })
						]
					}, model.id))
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[13px] text-muted-foreground",
					children: state.reachable ? "The local engine is running, but no image-reading model is installed. Until one is, OCADE refuses image questions instead of guessing from the file name." : "The local engine is not running on this computer, so OCADE cannot check which image models are installed."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3 text-[13px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-medium text-foreground",
						children: "What is needed"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
						className: "mt-1 list-decimal space-y-1 pl-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Start the OCADE Local Engine in Settings › Local Engine." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Install an image-reading engine from the same page. OCADE selects one that fits this machine and shows the download size before it starts." })]
					})]
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-semibold text-foreground",
								children: "Creating images"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
							status: "setup_required",
							children: "Not available"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[13px] text-muted-foreground",
						children: "OCADE cannot generate images. This is a genuine limitation, not a switch that has been left off:"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "No image generation model ships with OCADE, and none is installed on this computer." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "The local engine OCADE runs serves language and image-reading models. It cannot run an image generation model at all, so installing one would not help by itself." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "OCADE has no public-cloud image-generation fallback." })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3 text-[13px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium text-foreground",
							children: "What would have to be true"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1",
							children: "A reviewed image-generation runtime installed on this machine. When one exists, this page gains the prompt, progress, cancel and save controls — and not before, because a button that produces nothing is worse than no button."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							disabled: true,
							title: "No image generation model or provider is available. The requirements are listed above.",
							"aria-describedby": "ocade-image-generation-reason",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, { className: "mr-2 h-4 w-4" }), "Generate an image"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							id: "ocade-image-generation-reason",
							className: "mt-2 text-[12px] text-muted-foreground",
							children: "Disabled because no image generation model or provider is available on this device."
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "p-5 text-[13px] text-muted-foreground",
				children: "Images you attach are read by the engine you are chatting with. On this device that means they never leave the machine. If you switch to a cloud engine, OCADE asks before the image is sent, every time it would leave."
			})
		]
	})] });
}
var THIRD_PARTY_SUMMARY_default = {
	schemaVersion: 1,
	generatedBy: "scripts/generate-licence-notices.mjs",
	product: "caera-cadane-ocade@0.1.0",
	productionPackages: 283,
	licenceTypes: 14,
	needingReview: [{
		"package": "jszip@3.10.1",
		"licence": "(MIT OR GPL-3.0-or-later)"
	}, {
		"package": "lightningcss@1.33.0",
		"licence": "MPL-2.0"
	}],
	undetermined: [],
	withoutShippedText: 6,
	byLicence: {
		"(MIT AND Zlib)": 1,
		"(MIT OR GPL-3.0-or-later)": 1,
		"0BSD": 1,
		"Apache-2.0": 7,
		"BSD": 1,
		"BSD-2-Clause": 4,
		"BSD-3-Clause": 3,
		"BlueOak-1.0.0": 1,
		"CC-BY-4.0": 1,
		"ISC": 8,
		"MIT": 252,
		"MPL-2.0": 1,
		"Python-2.0": 1,
		"Unlicense": 1
	},
	fullNoticesPath: "release/THIRD_PARTY_NOTICES.md"
};
var OCADE_LOCAL_ENGINE_MODEL_MANIFEST_default = {
	schemaVersion: 1,
	generatedAt: "2026-08-12T11:48:10.422Z",
	generatedBy: "scripts/resolve-model-manifest.mjs",
	registry: "https://registry.ollama.ai/v2/library",
	updateChannel: "stable",
	provenance: "Every tag, digest, byte size, quantization and licence below was READ from the runtime's own registry at the time above. Nothing is hand-typed. RAM figures are derived from the real weight size by the stated formula and are the only computed values here.",
	ownership: "These are third-party model weights. CAERA CADANE does not own them and does not claim to. The licence text for each tier is fetched and hashed above and must remain reachable from the product UI before any tier is offered for download.",
	ramFormula: "minimum = weights * 1.25 + 1 GiB; recommended = weights * 1.6 + 2 GiB",
	tiers: [{
		"id": "every-device",
		"deviceClass": "Every device OCADE runs on",
		"tag": "qwen2.5:3b",
		"why": "The one model, on phones and desktops alike. Small enough for the device with least room, and it emits tool calls without a reasoning pass in front of them — the model this replaced could not be stopped from reasoning and produced no usable call until 2000 tokens and two minutes had gone by.",
		"acceleration": "CPU, with GPU used automatically when the runtime finds one",
		"resolved": true,
		"resolvedAt": "2026-08-12T11:48:10.421Z",
		"manifestUrl": "https://registry.ollama.ai/v2/library/qwen2.5/manifests/3b",
		"manifestDigest": "sha256:357c53fb659c5076de1d65ccb0b397446227b71a42be9d1603d46168015c9e4b",
		"manifestDigestSource": "computed from the exact manifest bytes received — this registry sends no Docker-Content-Digest header",
		"manifestSchemaVersion": 2,
		"configDigest": "sha256:161ddde4c9cd07c9f1ccb4e0167c434bce72caeb3fc1844262fa66bc877b0426",
		"model": {
			"layerDigest": "sha256:5ee4f07cdb9beadbbb293e85803c569b01bd37ed059d2715faa7bb405f31caa6",
			"bytes": 1929903008,
			"gib": 1.8
		},
		"expectedStorageBytes": 1929911945,
		"expectedStorageGib": 1.8,
		"quantization": "Q4_K_M",
		"parameterSize": "3.1B",
		"modelFamily": "qwen2",
		"weightFormat": "gguf",
		"buildArchitecture": "amd64",
		"buildOs": "linux",
		"minimumRamBytes": 3486120584,
		"recommendedRamBytes": 5235328461,
		"formula": "minimum = weights * 1.25 + 1 GiB; recommended = weights * 1.6 + 2 GiB",
		"licence": {
			"digest": "sha256:b5c0e5cf74cf51af1ecbc4af597cfcd13fd9925611838884a681070838a14a50",
			"bytes": 7387,
			"sha256OfFetchedText": "b5c0e5cf74cf51af1ecbc4af597cfcd13fd9925611838884a681070838a14a50",
			"firstLine": "Qwen RESEARCH LICENSE AGREEMENT",
			"identifierGuess": "see licence text"
		},
		"rollbackTarget": null
	}],
	unresolved: []
};
var summary = THIRD_PARTY_SUMMARY_default;
var manifest = OCADE_LOCAL_ENGINE_MODEL_MANIFEST_default;
var shippedTiers = manifest.tiers.filter((tier) => tier.tag === OCADE_MODEL_ID);
function AboutLicencesPanel() {
	const topLicences = (0, import_react.useMemo)(() => Object.entries(summary.byLicence).sort((a, b) => b[1] - a[1]).slice(0, 8), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Application",
		title: "About and licences",
		description: "What this build is, which model weights it can install, and the licences of everything it ships.",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
			status: "active",
			children: summary.product
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-5 pb-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-foreground",
							children: "OCADE"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-3 grid gap-2 text-[13px] sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Assistant"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-foreground",
								children: OCADE_IDENTITY.displayName
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Developed by"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-foreground",
								children: OCADE_IDENTITY.vendor
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Build"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-foreground",
								children: summary.product
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-[13px] text-muted-foreground",
						children: [OCADE_IDENTITY.vendor, " builds OCADE. It does not train the underlying model weights and does not claim to. In ordinary conversation OCADE refers to its engine by capability; the exact model answering any request is always available here and in diagnostics."]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-foreground",
							children: "Model weights"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-muted-foreground",
						children: manifest.ownership
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 -mx-1 overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[560px] text-left text-[13px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "text-[11px] uppercase tracking-[0.12em] text-muted-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-1 pb-2 font-medium",
										children: "Runs on"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-1 pb-2 font-medium",
										children: "Model"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-1 pb-2 font-medium",
										children: "Size"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-1 pb-2 font-medium",
										children: "Quantisation"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-1 pb-2 font-medium",
										children: "Licence"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "text-muted-foreground",
								children: shippedTiers.map((tier) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "border-t border-white/10",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-1 py-2 text-foreground",
											children: "Every device"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-1 py-2 font-mono text-[12px]",
											children: tier.tag
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-1 py-2",
											children: typeof tier.model?.gib === "number" ? `${tier.model.gib} GiB` : "—"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-1 py-2",
											children: tier.quantization ?? "—"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-1 py-2",
											children: tier.licence?.identifierGuess ?? "Not determined — check upstream"
										})
									]
								}, tier.id))
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-[12px] text-muted-foreground",
						children: [
							"Read from ",
							manifest.registry,
							". ",
							manifest.provenance
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Package, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-foreground",
							children: "Bundled software"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-[13px] text-muted-foreground",
						children: [
							summary.productionPackages,
							" production packages across ",
							summary.licenceTypes,
							" licence types."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 grid gap-1 text-[13px] text-muted-foreground sm:grid-cols-2",
						children: topLicences.map(([licence, count]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate text-foreground",
								children: licence
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: count })]
						}, licence))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-[12px] text-muted-foreground",
						children: [
							"The complete notices, including each package's licence text as shipped, are in",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: summary.fullNoticesPath
							}),
							" in this build. They are generated from the installed dependency tree, so they cannot drift from what ships."
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: "Needing review before release"
					})]
				}), summary.needingReview.length === 0 && summary.undetermined.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[13px] text-muted-foreground",
					children: "No bundled package carries copyleft or undetermined terms."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[13px] text-muted-foreground",
					children: "Called out so they cannot be lost in an alphabetical list. A person must confirm the obligations are met for the way this product is distributed."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground",
					children: [summary.needingReview.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-foreground",
							children: entry.package
						}),
						" — ",
						entry.licence
					] }, entry.package)), summary.undetermined.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-foreground",
						children: name
					}), " — licence could not be determined"] }, name))]
				})] })]
			})
		]
	})] });
}
/**
* The errors this browser actually hit.
*
* The page above it promised "error triage" and had none: crashes went to two
* globals that exist only in a development preview, so on the real site they
* went nowhere. Somebody whose screen went blank yesterday had a sentence and
* no evidence.
*
* Everything here is on this device and stays there. There is no upload
* control, because there is nothing to upload to — the copy button puts it on
* the clipboard and the person decides who sees it.
*/
function ErrorJournalPanel() {
	const [entries, setEntries] = (0, import_react.useState)([]);
	const [expanded, setExpanded] = (0, import_react.useState)(null);
	const refresh = (0, import_react.useCallback)(() => setEntries(readErrorJournal()), []);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh]);
	async function copyAll() {
		try {
			await navigator.clipboard.writeText(formatErrorJournal(entries));
			toast.success("Copied. Nothing was sent anywhere.");
		} catch {
			toast.error("This browser would not let the page copy. Select the text instead.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "flex items-center gap-2 text-sm font-semibold text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), "Errors on this device"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: [
						"The last ",
						50,
						" failures this browser hit, kept here and nowhere else. Addresses, tokens and keys are removed before anything is written down."
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => void copyAll(),
					disabled: entries.length === 0,
					className: "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs text-foreground transition hover:bg-accent/30 disabled:opacity-50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
						className: "h-3.5 w-3.5",
						"aria-hidden": true
					}), " Copy"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => {
						clearErrorJournal();
						refresh();
					},
					disabled: entries.length === 0,
					className: "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs text-foreground transition hover:bg-accent/30 disabled:opacity-50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
						className: "h-3.5 w-3.5",
						"aria-hidden": true
					}), " Clear"]
				})]
			})]
		}), entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 rounded-lg border border-dashed border-border/50 p-4 text-xs text-muted-foreground",
			children: "Nothing has gone wrong on this device since the journal was last cleared."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 space-y-2",
			children: entries.map((entry, index) => {
				const key = `${entry.at}-${index}`;
				const open = expanded === key;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg border border-border/50 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: entry.where
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
								dateTime: entry.at,
								children: new Date(entry.at).toLocaleString()
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 break-words text-[13px] text-foreground",
							children: entry.message
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-mono text-[11px] text-muted-foreground",
							children: entry.route
						}),
						entry.stack ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setExpanded(open ? null : key),
							"aria-expanded": open,
							className: "mt-2 text-[11px] text-muted-foreground underline",
							children: open ? "Hide where it happened" : "Show where it happened"
						}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
							className: "mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-background/50 p-2 font-mono text-[11px] text-muted-foreground",
							children: entry.stack
						}) : null] }) : null
					]
				}, key);
			})
		})]
	});
}
/**
* Advanced diagnostics.
*
* Answers the question people actually arrive with: "why did it do that?".
*
* The routing receipt below is not a description of how selection works — it
* is the real `routeTask` decision for this machine, right now, including every
* model it rejected and the reason. If OCADE picked a smaller engine than
* expected, the reason is on this page in the engine's own words.
*
* This is also the one ordinary surface where raw model identifiers appear.
* That is deliberate: a diagnostic that hides the identifier it is diagnosing
* is not a diagnostic.
*/
/** A fresh ledger: this page reports the DECLARED route, not chat's history. */
var previewLedger = new PerfLedger();
function DiagnosticsSettingsPanel() {
	const engine = useLocalEngine();
	const device = useDevicePolicy();
	const online = useOnline();
	const generalRoute = routeTask("general", engine.models, previewLedger, device.policy);
	const visionRoute = routeTask("vision", engine.models, previewLedger, device.policy);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Application",
		title: "Diagnostics",
		description: "Live engine state, the routing decision for this machine with its reasons, and error triage.",
		actions: online ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatusBadge, {
			status: "connected",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wifi, { className: "mr-1 inline h-3 w-3" }), "Online"]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatusBadge, {
			status: "paused",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WifiOff, { className: "mr-1 inline h-3 w-3" }), "Offline"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-5 pb-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorJournalPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-semibold text-foreground",
								children: "Local engine"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
								status: engine.status === "ready" ? "running" : engine.status === "checking" ? "pending" : "disconnected",
								children: engine.status
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => engine.refresh(true),
								children: "Re-probe"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-3 grid gap-2 text-[13px] sm:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Reachable"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-foreground",
								children: engine.reachable ? "yes" : "no"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Runtime version"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-foreground",
								children: engine.version ?? "unknown"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Models installed"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-foreground",
								children: engine.models.length
							})] })
						]
					}),
					engine.reason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[13px] text-muted-foreground",
						children: engine.reason
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-[12px] text-muted-foreground",
						children: [
							"Device measurement:",
							" ",
							device.measured ? `measured on this machine — ${device.profile?.totalRamGib} GB memory, ${device.profile?.hasDiscreteGpu ? "dedicated graphics" : device.profile?.gpuCertain ? "no dedicated graphics" : "graphics unconfirmed"}` : device.problem ?? "running on a browser estimate"
						]
					})
				]
			}),
			[["Ordinary conversation", generalRoute], ["Image questions", visionRoute]].map(([label, route]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-foreground",
							children: label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
							status: route.ok ? "active" : "failed",
							children: route.ok ? route.receipt.basis.replace("_", " ") : "no engine"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[13px] text-muted-foreground",
						children: route.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							"Would use ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-foreground",
								children: route.model.id
							}),
							" (",
							route.model.label,
							")."
						] }) : route.receipt.refusal ?? "No engine could serve this task."
					}),
					route.receipt.rejected.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground",
						children: "Rejected, with reasons"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-1 space-y-1 text-[13px] text-muted-foreground",
						children: route.receipt.rejected.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-foreground",
								children: entry.modelId
							}),
							" —",
							" ",
							entry.why
						] }, `${entry.modelId}:${entry.why}`))
					})] }) : null
				]
			}, label)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mb-2 text-sm font-semibold text-foreground",
				children: "Error triage"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiagnosticsPanel, {})] })
		]
	})] });
}
/**
* Settings sections that are REAL and rendered here rather than falling through
* to the Setup-Required state. Keep in sync with settings-sections.ts statuses.
*/
var IMPLEMENTED_SECTIONS = {
	memory: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoryPanel, {}),
	work: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComputerUsePanel, {}),
	permissions: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionsPanel, {}),
	connectors: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectorsPanel, {}),
	accessibility: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccessibilityPanel, {}),
	updates: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UpdatePolicyPanel, {}),
	chat: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatSettingsPanel, {}),
	"local-engine": () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocalEngineSettingsPanel, {}),
	motion: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionPanel, {}),
	offline: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfflineSection, {}),
	account: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountPanel, {}),
	images: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageSettingsPanel, {}),
	diagnostics: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiagnosticsSettingsPanel, {}),
	about: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AboutLicencesPanel, {})
};
function SectionCatchall() {
	const { section } = Route.useParams();
	const found = findSection(section);
	const { canEdit: canEditSettings } = useSettingsAccess();
	if (!found) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Settings",
		title: "Section not found",
		description: "This settings page does not exist."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
		className: "p-5 text-sm text-muted-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/settings",
			className: "text-primary underline underline-offset-4",
			children: "Back to Settings"
		})
	})] });
	const { group, item } = found;
	if (item.status === "external" && item.externalTo && canEditSettings) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
		to: item.externalTo,
		replace: true
	});
	const Implemented = IMPLEMENTED_SECTIONS[section];
	if (Implemented) return Implemented();
	const Icon = item.icon;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: group.label,
			title: item.label,
			description: item.description,
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
				status: "planned",
				children: "Setup Required"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "flex items-start gap-3 p-5 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-md bg-primary/10 p-2 text-primary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "h-4 w-4",
					"aria-hidden": true
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-foreground",
						children: "This page is planned. Nothing here is enabled yet, so we do not show fake controls or fake data."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: item.description
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2 pt-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings",
							className: "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 text-xs text-foreground hover:bg-accent",
							children: "Back to Settings"
						}), item.externalTo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.externalTo,
							className: "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {
								className: "h-3 w-3",
								"aria-hidden": true
							}), item.externalHint ?? "Open"]
						}) : null]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
				className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-primary",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No feedback or support connector is configured in this build. This destination remains unavailable until the named source slice is implemented and verified." })]
		})
	] });
}
//#endregion
export { SectionCatchall as component };
