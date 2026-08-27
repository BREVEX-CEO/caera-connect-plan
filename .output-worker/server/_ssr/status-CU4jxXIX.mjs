import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as PublicPage, r as PublicSection } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status-CU4jxXIX.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OcadeBanner({ title, children, kind = "info", action, dismissible = false }) {
	const [visible, setVisible] = (0, import_react.useState)(true);
	if (!visible) return null;
	const tone = {
		info: "border-primary/35 bg-primary/8",
		success: "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10",
		warning: "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10",
		error: "border-destructive/40 bg-destructive/10"
	}[kind];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
		role: kind === "error" ? "alert" : "status",
		className: `rounded-xl border p-4 ${tone}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-medium text-foreground",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-sm text-muted-foreground",
				children
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [action ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: action.onClick,
					className: "min-h-9 rounded-md border border-border/70 px-3 text-xs",
					children: action.label
				}) : null, dismissible ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": `Dismiss ${title}`,
					onClick: () => setVisible(false),
					className: "min-h-9 rounded-md border border-border/70 px-3 text-xs",
					children: "Dismiss"
				}) : null]
			})]
		})
	});
}
function OcadeDataTable({ caption, columns, rows, onAction, actionLabel = "Details" }) {
	const [query, setQuery] = (0, import_react.useState)("");
	const [sortKey, setSortKey] = (0, import_react.useState)(columns[0]?.key ?? "id");
	const [ascending, setAscending] = (0, import_react.useState)(true);
	const [page, setPage] = (0, import_react.useState)(1);
	const pageSize = 3;
	const filtered = (0, import_react.useMemo)(() => rows.filter((row) => Object.values(row).some((value) => value.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => (ascending ? 1 : -1) * (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "")), [
		rows,
		query,
		sortKey,
		ascending
	]);
	const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
	const safePage = Math.min(page, pages);
	const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": caption,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-muted-foreground",
						children: ["Search table", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "search",
							value: query,
							onChange: (event) => {
								setQuery(event.target.value);
								setPage(1);
							},
							className: "ml-2 min-h-9 rounded-md border border-border/70 bg-background px-3 text-foreground"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-muted-foreground",
						children: ["Sort by", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: sortKey,
							onChange: (event) => setSortKey(event.target.value),
							className: "ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground",
							children: columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: column.key,
								children: column.label
							}, column.key))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setAscending((value) => !value),
						className: "min-h-9 rounded-md border border-border/70 px-3 text-xs",
						children: ascending ? "Ascending" : "Descending"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-x-auto rounded-xl border border-border/60",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "min-w-[560px] w-full text-left text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("caption", {
							className: "sr-only",
							children: caption
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "bg-muted/40",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								scope: "col",
								className: "p-3 font-medium",
								children: column.label
							}, column.key)), onAction ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								scope: "col",
								className: "p-3",
								children: "Actions"
							}) : null] })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: visible.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border/50",
							children: [columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "p-3",
								children: row[column.key]
							}, column.key)), onAction ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "p-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => onAction(row),
									className: "underline",
									children: actionLabel
								})
							}) : null]
						}, row.id)) })
					]
				}), !visible.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "p-4 text-sm text-muted-foreground",
					children: "No rows match this search."
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				"aria-label": `${caption} pages`,
				className: "mt-3 flex justify-between text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: safePage <= 1,
						onClick: () => setPage((value) => Math.max(1, value - 1)),
						className: "min-h-9 rounded-md border border-border/70 px-3 disabled:opacity-40",
						children: "Previous"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"Page ",
						safePage,
						" of ",
						pages
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: safePage >= pages,
						onClick: () => setPage((value) => Math.min(pages, value + 1)),
						className: "min-h-9 rounded-md border border-border/70 px-3 disabled:opacity-40",
						children: "Next"
					})
				]
			})
		]
	});
}
function OcadeSkeleton({ lines = 3, label = "Loading content" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "status",
		"aria-label": label,
		className: "space-y-3 rounded-xl border border-border/50 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-2/5 rounded bg-muted motion-safe:animate-pulse" }),
			Array.from({ length: Math.max(1, lines) }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `h-3 rounded bg-muted/70 motion-safe:animate-pulse ${index === lines - 1 ? "w-3/5" : "w-full"}` }, index))
		]
	});
}
function StatusPage() {
	const [probe, setProbe] = (0, import_react.useState)({
		state: "checking",
		checkedAt: null,
		detail: "Checking this deployment's health endpoint…"
	});
	const check = (0, import_react.useCallback)(async () => {
		setProbe({
			state: "checking",
			checkedAt: null,
			detail: "Checking this deployment's health endpoint…"
		});
		try {
			const response = await fetch("/api/health", { headers: { accept: "application/json" } });
			setProbe({
				state: response.ok ? "available" : "unavailable",
				checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
				detail: response.ok ? `Health endpoint responded ${response.status} in this browser.` : `Health endpoint responded ${response.status}.`
			});
		} catch {
			setProbe({
				state: "unavailable",
				checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
				detail: "This browser could not reach the health endpoint."
			});
		}
	}, []);
	(0, import_react.useEffect)(() => {
		check();
	}, [check]);
	const components = [
		{
			name: "Public web surface",
			state: probe.state,
			detail: probe.detail
		},
		{
			name: "Account authentication",
			state: "unavailable",
			detail: "Production Supabase target is not verified in this build."
		},
		{
			name: "Private Sync",
			state: "unavailable",
			detail: "Not claimed until the correct production data project is verified."
		},
		{
			name: "On-device intelligence",
			state: "checking",
			detail: "Device-specific; open the demo to run a real engine check."
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Pre-launch service checks",
		title: "OCADE status",
		summary: "Current browser observations and known pre-launch dependencies. This is not a historical uptime report and does not claim production availability.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeBanner, {
				title: "Pre-launch status scope",
				kind: "warning",
				action: {
					label: "Refresh",
					onClick: () => void check()
				},
				dismissible: true,
				children: "These checks describe this browser and deployment only. They are not an uptime SLA."
			}),
			probe.state === "checking" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeSkeleton, {
				label: "Checking OCADE components",
				lines: 4
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeDataTable, {
				caption: "OCADE component status",
				columns: [
					{
						key: "name",
						label: "Component"
					},
					{
						key: "state",
						label: "State"
					},
					{
						key: "detail",
						label: "Observation"
					}
				],
				rows: components.map((component, index) => ({
					id: String(index),
					...component
				})),
				onAction: () => void check(),
				actionLabel: "Check again"
			}),
			probe.checkedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground",
				children: ["Last checked ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
					dateTime: probe.checkedAt,
					children: new Date(probe.checkedAt).toLocaleString()
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Incidents and uptime",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No public incident feed or independently measured uptime history is connected. A blank feed must not be read as zero incidents, and no uptime percentage is claimed." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Scheduled maintenance",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No maintenance window is declared. The planned public launch remains 28 August 2026 at 8:28 AM Asia/Kolkata, subject to the fail-closed readiness gate." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Updates",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Status email subscription and a separate status domain are not enabled because no verified delivery provider or production status service is connected." })
			})
		]
	});
}
//#endregion
export { StatusPage as component };
