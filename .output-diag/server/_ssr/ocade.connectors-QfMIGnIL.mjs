import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { En as Earth, Y as RefreshCw, lr as Cable, on as HardDrive } from "../_libs/lucide-react.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as CapabilityBadge } from "./CapabilityBadge-Ci6Z_gpg.mjs";
import { t as useCapabilityReports } from "./use-capabilities-CcKUWNkb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.connectors-QfMIGnIL.js
var import_jsx_runtime = require_jsx_runtime();
var CONNECTORS = [
	{
		id: "browser",
		label: "Browser bridge",
		description: "The permissioned bridge OCADE uses for browser control.",
		to: "/settings/browser",
		icon: Earth
	},
	{
		id: "privateSync",
		label: "Private Sync",
		description: "Account sync for content whose storage mode allows it.",
		to: "/settings/privacy",
		icon: RefreshCw
	},
	{
		id: "localAI",
		label: "Local model runtime",
		description: "On-device models and the local inference engine.",
		to: "/ocade/models",
		icon: HardDrive
	}
];
function ConnectorsPage() {
	const reports = useCapabilityReports();
	const byId = new Map(reports.map((report) => [report.id, report]));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Connectors",
			description: "Connections OCADE can actually observe today. Gmail, Drive, Slack, Notion and other app connectors are not shown as connected until a real connector implementation and account grant exist."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 grid gap-3 md:grid-cols-2",
			children: CONNECTORS.map((connector) => {
				const report = byId.get(connector.id);
				const Icon = connector.icon;
				if (!report) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: connector.to,
					className: "rounded-xl border border-border/60 bg-card/30 p-4 transition hover:bg-accent/30",
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
									children: connector.label
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilityBadge, { status: report.status })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm leading-relaxed text-muted-foreground",
							children: report.detail
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-[11px] text-muted-foreground/70",
							children: connector.description
						})
					]
				}, connector.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 rounded-xl border border-dashed border-border/60 p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-sm font-medium",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cable, { className: "h-4 w-4" }), " App connectors"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "No first-class Gmail, Google Drive, Slack, Notion, Microsoft 365, Jira, Linear, Figma or Canva account connection is configured by this build yet. OCADE will not display fake connected accounts."
			})]
		})
	] });
}
//#endregion
export { ConnectorsPage as component };
