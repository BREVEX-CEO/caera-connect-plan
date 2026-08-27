import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { At as Mic, En as Earth, Et as MonitorUp, M as ShieldCheck, Qt as KeyRound } from "../_libs/lucide-react.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as CapabilityBadge } from "./CapabilityBadge-Ci6Z_gpg.mjs";
import { t as useCapabilityReports } from "./use-capabilities-BEAfdjpi.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.permissions-Cr-AHVcy.js
var import_jsx_runtime = require_jsx_runtime();
var POLICIES = [
	{
		id: "computerControl",
		label: "Computer control",
		description: "Native machine actions are permissioned and require a connected companion. Approval remains separate from connection status.",
		to: "/ocade/work",
		icon: MonitorUp
	},
	{
		id: "browser",
		label: "Browser control",
		description: "Browser access uses the browser bridge and its real pairing state.",
		to: "/settings/browser",
		icon: Earth
	},
	{
		id: "voice",
		label: "Microphone & voice",
		description: "Microphone access is controlled by browser/OS permissions and OCADE voice settings.",
		to: "/settings/voice",
		icon: Mic
	},
	{
		id: "privateSync",
		label: "Storage & sync",
		description: "Your selected storage mode determines whether chat content stays local or may sync.",
		to: "/settings/privacy",
		icon: ShieldCheck
	}
];
function PermissionsPage() {
	const reports = useCapabilityReports();
	const byId = new Map(reports.map((report) => [report.id, report]));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Permissions",
			description: "A truthful overview of the permission-bearing capabilities OCADE can observe. Policy editing stays in the existing dedicated settings until a single universal policy writer can safely own every platform."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 grid gap-3 md:grid-cols-2",
			children: POLICIES.map((policy) => {
				const report = byId.get(policy.id);
				const Icon = policy.icon;
				if (!report) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 bg-card/30 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "h-4 w-4 text-muted-foreground",
									"aria-hidden": true
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-sm font-medium",
									children: policy.label
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilityBadge, { status: report.status })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted-foreground",
							children: policy.description
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-xs text-muted-foreground/80",
							children: ["Current evidence: ", report.detail]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: policy.to,
							className: "mt-3 inline-block text-xs underline underline-offset-4",
							children: "Review controls"
						})
					]
				}, policy.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 rounded-xl border border-border/60 p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-2 text-sm font-medium",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "h-4 w-4" }), " Default rule"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Connection is not permission, and permission is not proof of execution. OCADE must verify an action result before presenting it as completed."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/settings/security",
					className: "mt-3 inline-block text-xs underline underline-offset-4",
					children: "Security settings"
				})
			]
		})
	] });
}
//#endregion
export { PermissionsPage as component };
