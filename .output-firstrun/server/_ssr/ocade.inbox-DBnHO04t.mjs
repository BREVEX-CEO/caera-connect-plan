import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Vn as Clock3, Wn as CircleX, Wt as LoaderCircle, Xn as CircleCheck, m as TriangleAlert, tn as Inbox } from "../_libs/lucide-react.mjs";
import { t as useSession } from "./session-VpaXwoLS.mjs";
import { o as taskFromAutomationRun } from "./unified-task-BYmmu_RT.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as TruthfulFailurePanel } from "./TruthfulFailurePanel-Bg65KPix.mjs";
import { o as listAutomationRuns, s as listAutomations } from "./ocade-automations.functions-DeCgBHjx.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.inbox-DBnHO04t.js
var import_jsx_runtime = require_jsx_runtime();
var PENDING = /* @__PURE__ */ new Set([
	"PLANNING",
	"WAITING_PERMISSION",
	"WAITING_USER"
]);
var FAILURE = /* @__PURE__ */ new Set(["FAILED", "CANCELLED"]);
function InboxPage() {
	const { user } = useSession();
	const fetchAutomations = useServerFn(listAutomations);
	const fetchRuns = useServerFn(listAutomationRuns);
	const automations = useQuery({
		queryKey: [
			"ocade-inbox",
			"automations",
			user?.id
		],
		enabled: !!user?.id,
		queryFn: () => fetchAutomations()
	});
	const runs = useQuery({
		queryKey: [
			"ocade-inbox",
			"runs",
			user?.id
		],
		enabled: !!user?.id,
		queryFn: () => fetchRuns({ data: {} }),
		refetchInterval: 15e3
	});
	const nameOf = (id) => automations.data?.find((item) => item.id === id)?.name ?? "Automation";
	const tasks = (runs.data ?? []).map((run) => taskFromAutomationRun(run, nameOf(run.automation_id)));
	const pending = tasks.filter((task) => PENDING.has(task.status));
	const outcomes = tasks.filter((task) => !PENDING.has(task.status)).slice(0, 30);
	const loading = automations.isPending || runs.isPending;
	const error = automations.error ?? runs.error;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "OCADE",
		title: "Inbox",
		description: "Approvals and background outcomes that actually exist on this account. OCADE does not invent notifications for work that never ran."
	}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 flex items-center gap-2 text-sm text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Reading background work…"]
	}) : error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TruthfulFailurePanel, {
		className: "mt-6",
		title: "Inbox could not be read",
		failed: error instanceof Error ? error.message : String(error),
		safe: "No approval or automation state was changed by this read failure.",
		notDone: "OCADE did not mark any task completed, approved, cancelled or failed on your behalf.",
		alternative: "Open Tasks or Automations directly; their underlying records remain authoritative.",
		retry: () => {
			automations.refetch();
			runs.refetch();
		}
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 grid gap-4 lg:grid-cols-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inbox, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold",
					children: "Needs attention"
				})]
			}), pending.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted-foreground",
				children: "Nothing is waiting for you right now."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border/40",
				children: pending.map((task) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "py-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-2",
						children: [task.status === "WAITING_PERMISSION" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-4 w-4 text-[color:var(--state-warning)]" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, { className: "mt-0.5 h-4 w-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm font-medium",
									children: task.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 text-xs text-muted-foreground",
									children: task.currentStep ?? task.status.replaceAll("_", " ").toLowerCase()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/ocade/tasks",
									className: "mt-2 inline-block text-xs underline underline-offset-4",
									children: "Review task"
								})
							]
						})]
					})
				}, task.id))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold",
					children: "Recent outcomes"
				})]
			}), outcomes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted-foreground",
				children: "No completed background runs yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border/40",
				children: outcomes.map((task) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-start gap-2 py-3",
					children: [FAILURE.has(task.status) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "mt-0.5 h-4 w-4 text-destructive" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "mt-0.5 h-4 w-4 text-[color:var(--state-success)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-medium",
								children: task.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-0.5 text-xs text-muted-foreground",
								children: [
									task.status.toLowerCase(),
									" ·",
									" ",
									new Date(task.finishedAt ?? task.updatedAt).toLocaleString()
								]
							}),
							task.lastError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-destructive",
								children: task.lastError
							}) : null
						]
					})]
				}, task.id))
			})]
		})]
	})] });
}
//#endregion
export { InboxPage as component };
