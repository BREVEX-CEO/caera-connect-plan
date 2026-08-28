import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-D46NpEQY.mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Wt as LoaderCircle, Y as RefreshCw, kr as Activity } from "../_libs/lucide-react.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as TruthfulFailurePanel } from "./TruthfulFailurePanel-Bg65KPix.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.activity-D_DSkOAk.js
var import_jsx_runtime = require_jsx_runtime();
function ActivityPage() {
	const activity = useQuery({
		queryKey: ["ocade-activity"],
		queryFn: async () => {
			const { data, error } = await supabase.from("activity_log").select("id, created_at, action, feature_id").order("created_at", { ascending: false }).limit(150);
			if (error) throw error;
			return data ?? [];
		},
		refetchInterval: 3e4
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Activity",
			description: "Recent recorded actions from the real account activity ledger. For compliance-chain inspection and clearing controls, use the full Activity settings page.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => void activity.refetch(),
				className: "inline-flex min-h-[24px] items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground hover:text-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), " Refresh"]
			})
		}),
		activity.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "mt-6 p-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
					className: "h-4 w-4 animate-spin",
					"aria-hidden": true
				}), " Reading activity…"]
			})
		}) : activity.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TruthfulFailurePanel, {
			className: "mt-6",
			title: "Activity could not be read",
			failed: activity.error instanceof Error ? activity.error.message : String(activity.error),
			safe: "This was a read-only request. Existing activity records were not edited or cleared by this failure.",
			notDone: "OCADE did not create, delete, rewrite or acknowledge any activity record because this read failed.",
			alternative: "The full Activity settings page reads the same authoritative account records.",
			retry: () => void activity.refetch()
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "mt-6 overflow-hidden p-0",
			children: activity.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "p-5 text-sm text-muted-foreground",
				children: "No recorded activity yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border/40",
				children: activity.data.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-3 px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
						className: "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "break-words text-sm font-medium text-foreground",
							children: row.action
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-0.5 text-xs text-muted-foreground",
							children: [
								row.feature_id ?? "system",
								" · ",
								new Date(row.created_at).toLocaleString()
							]
						})]
					})]
				}, row.id))
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/settings/activity",
			className: "mt-4 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground",
			children: "Open full operational & compliance activity"
		})
	] });
}
//#endregion
export { ActivityPage as component };
