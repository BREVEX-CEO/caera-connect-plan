import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { G as Route, Lt as Megaphone, M as ShieldCheck, Tn as ExternalLink, Vt as Lock, Wt as LoaderCircle, in as History, m as TriangleAlert, nr as ChevronLeft, tr as ChevronRight, u as UsersRound } from "../_libs/lucide-react.mjs";
import { c as stringType, n as booleanType, o as objectType, r as enumType, t as arrayType } from "../_libs/zod.mjs";
import { n as executeAction, t as ActionConfirmationError } from "./actions-DvPqa8hX.mjs";
import { t as AppShell } from "./AppShell-DYEjrpCe.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-7nZ60itO.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as StatusBadge } from "./StatusBadge-B-3ICXuc.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.launch-gate-DmrjfAVr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Admin Launch Gate — server-side writers.
*
* All mutations go through here so we can:
*   - Verify caller is admin (never trust client claims).
*   - Append an immutable history row per status change.
*   - Write a compliance audit record for every change.
*/
var STATUS = [
	"not_started",
	"in_progress",
	"pending_review",
	"evidence_required",
	"complete",
	"waived"
];
var STAGE = [
	"demo",
	"private_alpha",
	"beta",
	"ga"
];
var updateItemInput = objectType({
	id: stringType().uuid(),
	status: enumType(STATUS).optional(),
	owner: stringType().max(200).nullable().optional(),
	reviewer: stringType().max(200).nullable().optional(),
	evidence_url: stringType().url().max(500).nullable().optional(),
	applicable_modules: arrayType(stringType().max(64)).max(20).optional(),
	due_date: stringType().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
	blocker: booleanType().optional(),
	notes: stringType().max(2e3).nullable().optional(),
	history_note: stringType().max(500).optional()
});
var updateLaunchGateItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => updateItemInput.parse(input)).handler(createSsrRpc("5a3c4a7e00ac6cead90838a2cf13fb371d2a9004e2591d1a0c077569f1991035"));
var updateFlagInput = objectType({
	id: stringType().min(1).max(200),
	description: stringType().max(500).nullable().optional(),
	enabled: booleanType().optional(),
	stage: enumType(STAGE).optional(),
	applicable_modules: arrayType(stringType().max(64)).max(20).optional()
});
var upsertFeatureFlag = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => updateFlagInput.parse(input)).handler(createSsrRpc("d2d824d5f2f877301cf762118da8003984ac8c20ae87ad1b8d9db48aa5cc8289"));
function isoDate(date) {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function parseIsoDate(value) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return isoDate(date) === value ? date : null;
}
function calendarCells(month) {
	const year = month.getUTCFullYear();
	const monthIndex = month.getUTCMonth();
	const first = new Date(Date.UTC(year, monthIndex, 1));
	const start = new Date(first);
	start.setUTCDate(1 - first.getUTCDay());
	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(start);
		date.setUTCDate(start.getUTCDate() + index);
		return {
			iso: isoDate(date),
			day: date.getUTCDate(),
			inMonth: date.getUTCMonth() === monthIndex
		};
	});
}
function OcadeDatePicker({ id, label, value, onChange, endValue, onEndChange, min, max, locale = "en-IN", includeTime = false, time = "09:00", onTimeChange }) {
	const initial = parseIsoDate(value) ?? /* @__PURE__ */ new Date();
	const [month, setMonth] = (0, import_react.useState)(() => new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1)));
	const cells = (0, import_react.useMemo)(() => calendarCells(month), [month]);
	const isRange = Boolean(onEndChange);
	const today = isoDate(/* @__PURE__ */ new Date());
	const formatter = (0, import_react.useMemo)(() => new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC"
	}), [locale]);
	function choose(next) {
		if (!isRange) {
			onChange(next);
			return;
		}
		if (!value || value && endValue) {
			onChange(next);
			onEndChange?.("");
		} else if (next < value) {
			onChange(next);
			onEndChange?.(value);
		} else onEndChange?.(next);
	}
	function shiftMonth(delta) {
		setMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)));
	}
	const monthLabel = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
		timeZone: "UTC"
	}).format(month);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
		className: "rounded-xl border border-border/60 bg-background/35 p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
				className: "px-1 text-xs font-medium text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `grid gap-2 ${isRange ? "sm:grid-cols-2" : ""}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-[11px] text-muted-foreground",
					children: [isRange ? "Start date" : "Date", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id,
						type: "text",
						inputMode: "numeric",
						placeholder: "YYYY-MM-DD",
						value,
						onChange: (event) => onChange(event.target.value),
						"aria-describedby": `${id}-format`,
						className: "mt-1 min-h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm text-foreground"
					})]
				}), isRange ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-[11px] text-muted-foreground",
					children: ["End date", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "text",
						inputMode: "numeric",
						placeholder: "YYYY-MM-DD",
						value: endValue ?? "",
						onChange: (event) => onEndChange?.(event.target.value),
						className: "mt-1 min-h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm text-foreground"
					})]
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				id: `${id}-format`,
				className: "mt-1 text-[10px] text-muted-foreground",
				children: parseIsoDate(value) ? formatter.format(parseIsoDate(value)) : `Format: YYYY-MM-DD · ${locale}`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex items-center justify-between gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Previous month",
						onClick: () => shiftMonth(-1),
						className: "grid h-9 w-9 place-items-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {
							className: "h-4 w-4",
							"aria-hidden": true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-medium",
						"aria-live": "polite",
						children: monthLabel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Next month",
						onClick: () => shiftMonth(1),
						className: "grid h-9 w-9 place-items-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
							className: "h-4 w-4",
							"aria-hidden": true
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "grid",
				"aria-label": `${label} calendar`,
				className: "mt-2 grid grid-cols-7 gap-1",
				children: [[
					"Sun",
					"Mon",
					"Tue",
					"Wed",
					"Thu",
					"Fri",
					"Sat"
				].map((day) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					role: "columnheader",
					className: "py-1 text-center text-[10px] text-muted-foreground",
					children: day
				}, day)), cells.map((cell) => {
					const disabled = Boolean(min && cell.iso < min || max && cell.iso > max);
					const selected = cell.iso === value || cell.iso === endValue;
					const inRange = Boolean(value && endValue && cell.iso > value && cell.iso < endValue);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "gridcell",
						"aria-label": cell.iso,
						"aria-selected": selected,
						disabled,
						onClick: () => choose(cell.iso),
						className: `grid aspect-square min-h-8 place-items-center rounded-md text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-25 ${selected ? "bg-primary text-primary-foreground" : inRange ? "bg-primary/15 text-foreground" : cell.inMonth ? "hover:bg-accent" : "text-muted-foreground/45 hover:bg-accent"}`,
						children: cell.day
					}, cell.iso);
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => choose(today),
					disabled: Boolean(min && today < min || max && today > max),
					className: "min-h-9 rounded-md border border-border/70 px-3 text-xs hover:bg-accent disabled:opacity-40",
					children: "Today"
				}), includeTime ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-[11px] text-muted-foreground",
					children: ["Time", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "time",
						value: time,
						onChange: (event) => onTimeChange?.(event.target.value),
						className: "ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-sm text-foreground"
					})]
				}) : null]
			})
		]
	});
}
var BLOCKER_RESOLUTION_STRATEGIES = [
	{
		id: "portable_runtime",
		label: "Portable runtime or WebAssembly"
	},
	{
		id: "hosted_clean_runner",
		label: "Hosted clean runner"
	},
	{
		id: "emulator_or_simulator",
		label: "Emulator or simulator"
	},
	{
		id: "free_equivalent",
		label: "Legitimate free or open-source equivalent"
	},
	{
		id: "existing_owned_device",
		label: "Another device the user already owns"
	},
	{
		id: "authorised_remote_worker",
		label: "Authorised remote worker with a legitimate tool"
	},
	{
		id: "peer_to_peer",
		label: "Peer-to-peer transport"
	},
	{
		id: "signed_external_evidence",
		label: "Signed external evidence bundle"
	},
	{
		id: "community_skill_or_bounty",
		label: "Community skill or compatibility bounty"
	},
	{
		id: "one_step_human_action",
		label: "One explicit owner action"
	}
];
function BlockerResolutionPolicy() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "mt-6 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " External-blocker proof"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "A blocker is external only after every route below has fresh retained evidence. Any available route keeps the item resolvable; the last route must name one accountable owner action."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2",
				children: BLOCKER_RESOLUTION_STRATEGIES.map((strategy, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-2 rounded-md border border-border/50 p-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums",
						children: [index + 1, "."]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: strategy.label })]
				}, strategy.id))
			})
		]
	});
}
var STAKEHOLDER_RESEARCH_DIMENSIONS = [
	{
		id: "AZ-009",
		key: "interviews",
		label: "Interviews"
	},
	{
		id: "AZ-010",
		key: "workflow_observation",
		label: "Workflow observation"
	},
	{
		id: "AZ-011",
		key: "pain_points",
		label: "Pain points"
	},
	{
		id: "AZ-012",
		key: "task_frequency",
		label: "Task frequency"
	},
	{
		id: "AZ-013",
		key: "risk_mapping",
		label: "Risk mapping"
	},
	{
		id: "AZ-014",
		key: "accessibility",
		label: "Accessibility"
	},
	{
		id: "AZ-015",
		key: "regional_needs",
		label: "Regional needs"
	}
];
function StakeholderResearchBoundary() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "mt-6 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsersRound, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Stakeholder research"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Intake is source-ready, but no production participant is recorded. Synthetic personas and fixtures never count as interviews or observation."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 flex flex-wrap gap-1.5",
				children: STAKEHOLDER_RESEARCH_DIMENSIONS.map((dimension) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-md border border-border/50 px-2 py-1 text-[11px] text-muted-foreground",
					children: [
						dimension.id,
						" · ",
						dimension.label
					]
				}, dimension.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "status",
				className: "mt-3 text-xs text-[color:var(--state-warning)]",
				children: "Externally blocked: recruit consenting human stakeholders and retain independently reviewed, privacy-preserving evidence."
			})
		]
	});
}
var stages = [
	["AZ-429", "Signing"],
	["AZ-430", "Deployment"],
	["AZ-431", "Support readiness"],
	["AZ-432", "Announcement"]
];
function LaunchAuthorityBoundary() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "mt-6 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Megaphone, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Production launch authority"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "These stages are dependency ordered. Announcement remains impossible until trusted signing, independently observed deployment and rollback, staffed support drills, and final readiness all pass."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-3 grid gap-2 sm:grid-cols-4",
				children: stages.map(([id, label], index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-md border border-border/50 p-2 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [
								index + 1,
								". ",
								id
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-[10px] text-[color:var(--state-warning)]",
							children: "Externally blocked"
						})
					]
				}, id))
			})
		]
	});
}
var STATUS_OPTIONS = [
	"not_started",
	"in_progress",
	"pending_review",
	"evidence_required",
	"complete",
	"waived"
];
var STAGE_OPTIONS = [
	"demo",
	"private_alpha",
	"beta",
	"ga"
];
function statusBadgeKind(s) {
	if (s === "complete") return "success";
	if (s === "waived") return "beta";
	if (s === "evidence_required") return "setup_required";
	if (s === "not_started") return "failed";
	if (s === "pending_review") return "pending";
	return "running";
}
function LaunchGatePage() {
	const qc = useQueryClient();
	const items = useQuery({
		queryKey: ["launch_gate_items"],
		queryFn: async () => {
			const { data, error } = await supabase.from("launch_gate_items").select("*").order("category").order("title");
			if (error) throw error;
			return data ?? [];
		}
	});
	const flags = useQuery({
		queryKey: ["feature_flags_admin"],
		queryFn: async () => {
			const { data, error } = await supabase.from("feature_flags").select("*").order("id");
			if (error) throw error;
			return data ?? [];
		}
	});
	const grouped = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const i of items.data ?? []) {
			const list = map.get(i.category) ?? [];
			list.push(i);
			map.set(i.category, list);
		}
		return Array.from(map.entries());
	}, [items.data]);
	const summary = (0, import_react.useMemo)(() => {
		const all = items.data ?? [];
		return {
			total: all.length,
			complete: all.filter((i) => i.status === "complete").length,
			blockers: all.filter((i) => i.blocker && i.status !== "complete" && i.status !== "waived").length
		};
	}, [items.data]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Admin",
			title: "Launch Gate",
			description: "Pre-launch safeguards that block General Availability for regulated modules. Every change is recorded in the compliance audit log.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings/activity",
				className: "rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent",
				children: "View audit log"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-3 sm:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryCard, {
					label: "Items",
					value: summary.total,
					tone: "neutral"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryCard, {
					label: "Complete",
					value: summary.complete,
					tone: "success"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryCard, {
					label: "Open blockers",
					value: summary.blockers,
					tone: summary.blockers > 0 ? "danger" : "success"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BlockerResolutionPolicy, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StakeholderResearchBoundary, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LaunchAuthorityBoundary, {}),
		items.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-8 flex items-center gap-2 text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Loading launch gate…"]
		}) : null,
		items.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-6 p-4 text-sm text-destructive",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mr-2 inline h-4 w-4" }), "Failed to load launch gate items."]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-8 space-y-6",
			children: grouped.map(([category, list]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
				children: category
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: list.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemRow, {
					item,
					onSaved: () => qc.invalidateQueries({ queryKey: ["launch_gate_items"] })
				}, item.id))
			})] }, category))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-10",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "mb-3 flex items-center gap-2 text-sm font-semibold text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), " Feature flag stages"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 max-w-2xl text-xs text-muted-foreground",
					children: "Flags advance one stage at a time from Demo → Private alpha → Beta → GA. Enabled rollout requires explicit capability:* and platform:* coverage, independent evidence, and distinct owner/reviewer approval. Missing or waived controlled-rollout evidence is refused."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureFlagsPanel, {
					flags: flags.data ?? [],
					onSaved: () => qc.invalidateQueries({ queryKey: ["feature_flags_admin"] })
				})
			]
		})
	] });
}
function SummaryCard({ label, value, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("mt-1 text-2xl font-semibold", tone === "danger" && "text-destructive", tone === "success" && "text-[color:var(--accent-ficia,theme(colors.emerald.400))]"),
			children: value
		})]
	});
}
function ItemRow({ item, onSaved }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [status, setStatus] = (0, import_react.useState)(item.status);
	const [owner, setOwner] = (0, import_react.useState)(item.owner ?? "");
	const [reviewer, setReviewer] = (0, import_react.useState)(item.reviewer ?? "");
	const [evidence, setEvidence] = (0, import_react.useState)(item.evidence_url ?? "");
	const [modules, setModules] = (0, import_react.useState)(item.applicable_modules.join(","));
	const [due, setDue] = (0, import_react.useState)(item.due_date ?? "");
	const [blocker, setBlocker] = (0, import_react.useState)(item.blocker);
	const [note, setNote] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [history, setHistory] = (0, import_react.useState)(null);
	async function loadHistory() {
		const { data } = await supabase.from("launch_gate_history").select("id, from_status, to_status, changed_at, note, evidence_url").eq("item_id", item.id).order("changed_at", { ascending: false });
		setHistory(data ?? []);
	}
	async function onSave() {
		setBusy(true);
		setError(null);
		try {
			const result = await executeAction("admin.launch_gate.update", {
				confirmed: true,
				metadata: {
					item_key: item.key,
					to_status: status
				},
				run: () => updateLaunchGateItem({ data: {
					id: item.id,
					status,
					owner: owner || null,
					reviewer: reviewer || null,
					evidence_url: evidence || null,
					applicable_modules: modules.split(",").map((s) => s.trim()).filter(Boolean),
					due_date: due || null,
					blocker,
					history_note: note || void 0
				} })
			});
			if (!result.ok) {
				setError(result.message);
				return;
			}
			setNote("");
			onSaved();
			if (history !== null) await loadHistory();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Update failed");
		} finally {
			setBusy(false);
		}
	}
	const openBlocker = item.blocker && item.status !== "complete" && item.status !== "waived";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-semibold text-foreground",
								children: item.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
								status: statusBadgeKind(item.status),
								children: item.status.replace("_", " ")
							}),
							openBlocker ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-3 w-3" }), " Blocker"]
							}) : null
						]
					}),
					item.description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: item.description
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Owner: ", item.owner ?? "—"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Reviewer: ", item.reviewer ?? "—"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Due: ", item.due_date ?? "—"] }),
							item.applicable_modules.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Modules: ", item.applicable_modules.join(", ")] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Modules: all" }),
							item.evidence_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: item.evidence_url,
								target: "_blank",
								rel: "noreferrer",
								className: "inline-flex items-center gap-1 text-primary hover:underline",
								children: ["Evidence ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3 w-3" })]
							}) : null
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => {
						if (history === null) loadHistory();
						setOpen((v) => !v);
					},
					className: "rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent",
					children: open ? "Close" : "Edit"
				})
			})]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Status"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: status,
						onChange: (e) => setStatus(e.target.value),
						className: "mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm",
						children: STATUS_OPTIONS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: s,
							children: s.replace("_", " ")
						}, s))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Owner"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: owner,
						onChange: (e) => setOwner(e.target.value),
						placeholder: "Name or team",
						className: "mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Reviewer"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: reviewer,
						onChange: (e) => setReviewer(e.target.value),
						placeholder: "Independent reviewer",
						className: "mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeDatePicker, {
					id: `launch-gate-due-${item.id}`,
					label: "Due date",
					value: due,
					onChange: setDue
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Evidence URL"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: evidence,
						onChange: (e) => setEvidence(e.target.value),
						placeholder: "https://…",
						className: "mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Applicable modules (comma-separated: ocade, ficia, madee, cania, core, admin)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: modules,
						onChange: (e) => setModules(e.target.value),
						placeholder: "ocade,ficia",
						className: "mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs sm:col-span-2 inline-flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: blocker,
						onChange: (e) => setBlocker(e.target.checked)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Blocks enabled rollout expansion"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "History note (recorded on status change)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: note,
						onChange: (e) => setNote(e.target.value),
						placeholder: "Why did this change?",
						className: "mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sm:col-span-2 flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-destructive",
						children: error
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: onSave,
							disabled: busy,
							className: "inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
							children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3 w-3 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-3 w-3" }), "Save & audit"]
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "h-3 w-3" }), " Completion history"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-1 text-xs",
						children: (history ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-muted-foreground",
							children: "No transitions recorded yet."
						}) : (history ?? []).map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-foreground",
									children: new Date(h.changed_at).toLocaleString()
								}),
								" ",
								"— ",
								h.from_status ?? "∅",
								" → ",
								h.to_status,
								h.note ? ` · ${h.note}` : ""
							]
						}, h.id))
					})]
				})
			]
		}) : null]
	});
}
function FeatureFlagsPanel({ flags, onSaved }) {
	const [newId, setNewId] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			flags.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "p-4 text-sm text-muted-foreground",
				children: "No feature flags yet. Create one to gate a module's public rollout."
			}) : null,
			flags.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagRow, {
				flag: f,
				onSaved
			}, f.id)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": "New feature flag ID",
							value: newId,
							onChange: (e) => setNewId(e.target.value),
							placeholder: "new.flag.id",
							className: "flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: async () => {
								if (!newId.trim()) return;
								setBusy(true);
								setError(null);
								try {
									const result = await executeAction("admin.feature_flag.upsert", {
										confirmed: true,
										confirmPhrase: window.prompt(`Create disabled Demo flag "${newId.trim()}"? Type "activate" to confirm.`) ?? "",
										metadata: {
											flag_id: newId,
											stage: "demo"
										},
										run: () => upsertFeatureFlag({ data: {
											id: newId.trim(),
											enabled: false,
											stage: "demo",
											applicable_modules: []
										} })
									});
									if (!result.ok) setError(result.message);
									else {
										setNewId("");
										onSaved();
									}
								} catch (cause) {
									if (cause instanceof ActionConfirmationError) setError(cause.message);
									else setError(cause instanceof Error ? cause.message : "Flag creation failed");
								} finally {
									setBusy(false);
								}
							},
							disabled: busy,
							className: "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90",
							children: busy ? "Creating…" : "Create flag"
						})]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 text-xs text-destructive",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mr-1 inline h-3 w-3" }), error]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[11px] text-muted-foreground",
						children: "New flags start in Demo stage, disabled. Advance them through Private alpha → Beta → GA as launch-gate items complete."
					})
				]
			})
		]
	});
}
function FlagRow({ flag, onSaved }) {
	const [stage, setStage] = (0, import_react.useState)(flag.stage);
	const [enabled, setEnabled] = (0, import_react.useState)(flag.enabled);
	const [modules, setModules] = (0, import_react.useState)(flag.applicable_modules.join(","));
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	async function save() {
		setBusy(true);
		setError(null);
		try {
			const res = await executeAction("admin.feature_flag.upsert", {
				confirmed: true,
				confirmPhrase: window.prompt(`Update rollout flag "${flag.id}" to ${stage} (${enabled ? "enabled" : "disabled"})? Type "activate" to confirm.`) ?? "",
				metadata: {
					flag_id: flag.id,
					to_stage: stage,
					to_enabled: enabled
				},
				run: () => upsertFeatureFlag({ data: {
					id: flag.id,
					enabled,
					stage,
					applicable_modules: modules.split(",").map((s) => s.trim()).filter(Boolean)
				} })
			});
			if (!res.ok) setError(res.message);
			else onSaved();
		} catch (e) {
			if (e instanceof ActionConfirmationError) setError(e.message);
			else setError(e instanceof Error ? e.message : "Update failed");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-semibold text-foreground",
						children: flag.id
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[11px] text-muted-foreground",
						children: ["Updated ", new Date(flag.updated_at).toLocaleString()]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Stage"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: stage,
						onChange: (e) => setStage(e.target.value),
						className: "ml-2 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-sm",
						children: STAGE_OPTIONS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: s,
							children: s
						}, s))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "inline-flex items-center gap-2 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: enabled,
						onChange: (e) => setEnabled(e.target.checked)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "Enabled"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "Feature flag modules",
					value: modules,
					onChange: (e) => setModules(e.target.value),
					placeholder: "modules (comma-separated)",
					className: "w-48 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-sm"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: save,
					disabled: busy,
					className: "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
					children: busy ? "Saving…" : "Save"
				})
			]
		}), error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-2 text-xs text-destructive",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mr-1 inline h-3 w-3" }), error]
		}) : null]
	});
}
//#endregion
export { LaunchGatePage as component };
