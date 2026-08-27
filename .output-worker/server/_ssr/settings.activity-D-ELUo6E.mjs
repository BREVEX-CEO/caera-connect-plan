import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Qn as CircleAlert, Y as RefreshCw, h as Trash2, k as Shield, kr as Activity } from "../_libs/lucide-react.mjs";
import { t as useSession } from "./session-Bq1TXK1R.mjs";
import { n as executeAction, r as getAction, t as ActionConfirmationError } from "./actions-n-YCJNPa.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as listLocalOutputActivity } from "./chat-output-flow-Xyxa_okM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.activity-D-ELUo6E.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function windowStart(w) {
	if (w === "all") return null;
	const d = /* @__PURE__ */ new Date();
	d.setDate(d.getDate() - Number(w));
	return d.toISOString();
}
function ActivityPage() {
	const { user } = useSession();
	const [tab, setTab] = (0, import_react.useState)("operational");
	const [win, setWin] = (0, import_react.useState)("30");
	const [q, setQ] = (0, import_react.useState)("");
	const [confirmClear, setConfirmClear] = (0, import_react.useState)(false);
	const [phrase, setPhrase] = (0, import_react.useState)("");
	const [msg, setMsg] = (0, import_react.useState)(null);
	const [localOutputs, setLocalOutputs] = (0, import_react.useState)(null);
	const [localOutputError, setLocalOutputError] = (0, import_react.useState)(null);
	const from = (0, import_react.useMemo)(() => windowStart(win), [win]);
	const opQuery = useQuery({
		queryKey: [
			"activity",
			"operational",
			user?.id,
			from
		],
		enabled: !!user?.id && tab === "operational",
		queryFn: async () => {
			let query = supabase.from("activity_log").select("id, created_at, action, feature_id, tenant_id, metadata").order("created_at", { ascending: false }).limit(500);
			if (from) query = query.gte("created_at", from);
			const { data, error } = await query;
			if (error) throw error;
			return data ?? [];
		}
	});
	const compQuery = useQuery({
		queryKey: [
			"activity",
			"compliance",
			user?.id,
			from
		],
		enabled: !!user?.id && tab === "compliance",
		queryFn: async () => {
			let query = supabase.from("compliance_audit_log").select("id, created_at, action, feature_id, category, tenant_id, preview, result, prev_hash, row_hash").order("created_at", { ascending: false }).limit(500);
			if (from) query = query.gte("created_at", from);
			const { data, error } = await query;
			if (error) throw error;
			return data ?? [];
		}
	});
	const opRows = (opQuery.data ?? []).filter((r) => !q || r.action.toLowerCase().includes(q.toLowerCase()) || (r.feature_id ?? "").toLowerCase().includes(q.toLowerCase()));
	const compRows = (compQuery.data ?? []).filter((r) => !q || r.action.toLowerCase().includes(q.toLowerCase()) || (r.feature_id ?? "").toLowerCase().includes(q.toLowerCase()));
	(0, import_react.useEffect)(() => {
		setMsg(null);
	}, [tab]);
	function refreshLocalOutputs() {
		const result = listLocalOutputActivity();
		if (result.ok) {
			setLocalOutputs(result.data);
			setLocalOutputError(null);
		} else {
			setLocalOutputs(null);
			setLocalOutputError(result.reason);
		}
	}
	(0, import_react.useEffect)(() => {
		refreshLocalOutputs();
	}, []);
	async function clearOldOperational() {
		try {
			await executeAction("activity.clear_operational", {
				confirmed: true,
				confirmPhrase: phrase,
				run: async () => {
					const cutoff = /* @__PURE__ */ new Date();
					cutoff.setDate(cutoff.getDate() - 30);
					const { error } = await supabase.from("activity_log").delete().lt("created_at", cutoff.toISOString());
					if (error) throw error;
				}
			});
			setMsg({
				kind: "success",
				text: "Cleared operational activity older than 30 days."
			});
			setConfirmClear(false);
			setPhrase("");
			opQuery.refetch();
		} catch (e) {
			setMsg({
				kind: "error",
				text: e instanceof ActionConfirmationError ? e.message : e instanceof Error ? e.message : String(e)
			});
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Account · Activity",
			title: "Activity centre",
			description: "See what happened on your account. Operational activity is short-lived. Compliance events are immutable and cannot be edited or cleared."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "inline-flex rounded-lg bg-muted/40 p-1 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						"aria-pressed": tab === "operational",
						onClick: () => setTab("operational"),
						className: cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5", tab === "operational" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), "Operational"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						"aria-pressed": tab === "compliance",
						onClick: () => setTab("compliance"),
						className: cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5", tab === "compliance" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), "Compliance"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					"aria-label": "Activity time window",
					value: win,
					onChange: (e) => setWin(e.target.value),
					className: "rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "7",
							children: "Last 7 days"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "30",
							children: "Last 30 days"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "90",
							children: "Last 90 days"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "All time"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "Filter activity",
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter action or feature…",
					className: "min-w-[220px] flex-1 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => tab === "operational" ? opQuery.refetch() : compQuery.refetch(),
					className: "inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
						className: "h-3.5 w-3.5",
						"aria-hidden": true
					}), "Refresh"]
				})
			]
		}),
		tab === "compliance" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
				className: "mt-0.5 h-3.5 w-3.5 flex-none text-primary",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Compliance events are append-only. Each row is hash-chained to the previous one — they can be verified but never edited or deleted." })]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Retention: 30 days. You can clear operational activity older than 30 days at any time." }), !confirmClear ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => setConfirmClear(true),
				className: "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-foreground hover:bg-accent",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), "Clear eligible…"]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Type \"clear\" to confirm:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						"aria-label": "Type \"clear\" to confirm",
						value: phrase,
						onChange: (e) => setPhrase(e.target.value),
						className: "w-20 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-foreground",
						autoFocus: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: clearOldOperational,
						className: "rounded-md bg-destructive/80 px-2 py-1 font-medium text-white hover:bg-destructive",
						children: "Delete"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							setConfirmClear(false);
							setPhrase("");
						},
						className: "rounded-md border border-border/60 bg-background/40 px-2 py-1",
						children: "Cancel"
					})
				]
			})]
		}),
		msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", msg.kind === "success" ? "border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]" : "border-destructive/30 bg-destructive/10 text-destructive"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
				className: "h-3.5 w-3.5",
				"aria-hidden": true
			}), msg.text]
		}) : null,
		tab === "operational" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 overflow-hidden",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-border/40 px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium text-foreground",
					children: "On-device output activity"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-muted-foreground",
					children: "Exact artifact ids and SHA-256 fingerprints recorded by Chat on this device."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: refreshLocalOutputs,
					className: "rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground",
					children: "Refresh local"
				})]
			}), localOutputError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-3 text-xs text-destructive",
				children: localOutputError
			}) : localOutputs === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-3 text-xs text-muted-foreground",
				children: "Loading local activity…"
			}) : localOutputs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-3 text-xs text-muted-foreground",
				children: "No Chat outputs have been saved on this device."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border/40",
				children: localOutputs.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "grid gap-1 p-3 text-xs sm:grid-cols-[1fr_auto]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium text-foreground",
								children: row.outputName
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate font-mono text-[10px] text-muted-foreground",
								children: [
									"artifact ",
									row.artifactId,
									" · sha256 ",
									row.outputSha256
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[11px] text-muted-foreground",
								children: [
									row.sourceFiles.length,
									" source file",
									row.sourceFiles.length === 1 ? "" : "s",
									" · ",
									row.outputBytes,
									" bytes ·",
									" ",
									row.result === "verified" ? "verified" : "not confirmed"
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
						className: "text-[11px] text-muted-foreground",
						children: new Date(row.at).toLocaleString()
					})]
				}, row.id))
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "mt-4 overflow-hidden",
			children: tab === "operational" ? opQuery.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-6 text-sm text-muted-foreground",
				children: "Loading…"
			}) : opQuery.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-6 text-sm text-destructive",
				children: [
					"Operational activity is unavailable:",
					" ",
					opQuery.error instanceof Error ? opQuery.error.message : "the activity store did not respond."
				]
			}) : opRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-6 text-sm text-muted-foreground",
				children: "No operational activity in this window."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border/40",
				children: opRows.map((r) => {
					const a = getAction(r.action);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "grid grid-cols-[auto_1fr_auto] items-start gap-3 p-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
								className: "mt-0.5 h-4 w-4 text-muted-foreground",
								"aria-hidden": true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-foreground",
									children: a?.title ?? r.action
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "truncate text-xs text-muted-foreground",
									children: [
										r.feature_id ?? "—",
										" ·",
										" ",
										r.metadata?.result ?? "recorded"
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-right text-xs text-muted-foreground",
								children: new Date(r.created_at).toLocaleString()
							})
						]
					}, r.id);
				})
			}) : compQuery.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-6 text-sm text-muted-foreground",
				children: "Loading…"
			}) : compQuery.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-6 text-sm text-destructive",
				children: [
					"Compliance audit is unavailable:",
					" ",
					compQuery.error instanceof Error ? compQuery.error.message : "the audit store did not respond."
				]
			}) : compRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-6 text-sm text-muted-foreground",
				children: "No compliance events in this window."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border/40",
				children: compRows.map((r) => {
					const a = getAction(r.action);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "grid grid-cols-[auto_1fr_auto] items-start gap-3 p-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
								className: "mt-0.5 h-4 w-4 text-primary",
								"aria-hidden": true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-foreground",
										children: a?.title ?? r.action
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-xs text-muted-foreground",
										children: [
											r.category ?? "other",
											" · ",
											r.feature_id ?? "—"
										]
									}),
									r.result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 text-[11px] text-muted-foreground",
										children: ["Result: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: r.result })]
									}) : null,
									r.row_hash ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-0.5 text-[10px] font-mono text-muted-foreground/70",
										children: [
											"hash: ",
											r.row_hash.slice(0, 16),
											"…"
										]
									}) : null
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-right text-xs text-muted-foreground",
								children: new Date(r.created_at).toLocaleString()
							})
						]
					}, r.id);
				})
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-4 text-xs text-muted-foreground",
			children: [
				"Missing something? Some actions ship in later slices — the",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/settings",
					className: "underline underline-offset-4",
					children: "Settings"
				}),
				" ",
				"hub lists what is live today."
			]
		})
	] });
}
//#endregion
export { ActivityPage as component };
