import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { $ as Radar, F as Share2, L as Settings, M as ShieldCheck, Tt as Monitor, Yt as LayoutTemplate, _r as Bell, _t as Palette, an as HeartPulse, dr as Brain, hn as FlaskConical, kr as Activity, lr as Cable, pr as Boxes, r as Workflow, tn as Inbox, vt as Package, xn as FileCodeCorner } from "../_libs/lucide-react.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.system-Dp8u5LdS.js
var import_jsx_runtime = require_jsx_runtime();
var ENTRIES = [
	{
		to: "/ocade/code",
		label: "Code",
		icon: FileCodeCorner,
		detail: "Read, write and run code with OCADE, on this device."
	},
	{
		to: "/ocade/automations",
		label: "Automations",
		icon: Workflow,
		detail: "Work that runs on a schedule or on a trigger, without you."
	},
	{
		to: "/ocade/artifacts",
		label: "Files",
		icon: Package,
		detail: "Everything OCADE has produced or been given."
	},
	{
		to: "/ocade/inbox",
		label: "Inbox",
		icon: Inbox,
		detail: "What needs your answer before OCADE can carry on."
	},
	{
		to: "/ocade/monitors",
		label: "Monitors",
		icon: Radar,
		detail: "Pages and sources OCADE watches for change."
	},
	{
		to: "/ocade/studio",
		label: "Studio",
		icon: Palette,
		detail: "Images, audio and video work."
	},
	{
		to: "/ocade/models",
		label: "Models",
		detail: "Local and cloud intelligence runtimes.",
		icon: Boxes
	},
	{
		to: "/ocade/devices",
		label: "Devices",
		detail: "Registered devices and revocation.",
		icon: Monitor
	},
	{
		to: "/ocade/connectors",
		label: "Connectors",
		detail: "Observed runtime connections and provider links.",
		icon: Cable
	},
	{
		to: "/ocade/permissions",
		label: "Permissions",
		detail: "Permission-bearing capabilities and their real state.",
		icon: ShieldCheck
	},
	{
		to: "/ocade/activity",
		label: "Activity",
		detail: "Recorded account and agent activity.",
		icon: Activity
	},
	{
		to: "/ocade/health",
		label: "Health",
		detail: "Truthful capability diagnostics.",
		icon: HeartPulse
	},
	{
		to: "/ocade/shared",
		label: "Shared",
		detail: "Sharing boundary and external-access status.",
		icon: Share2
	},
	{
		to: "/ocade/templates",
		label: "Templates",
		detail: "Reusable prompt starters without fake automation claims.",
		icon: LayoutTemplate
	},
	{
		to: "/ocade/knowledge",
		label: "Knowledge",
		detail: "Durable context and the current indexing boundary.",
		icon: Brain
	},
	{
		to: "/ocade/notifications",
		label: "Notifications",
		detail: "In-app attention and background-delivery status.",
		icon: Bell
	},
	{
		to: "/ocade/lab",
		label: "Lab",
		detail: "Engineering diagnostics, research and governed execution.",
		icon: FlaskConical
	},
	{
		to: "/settings",
		label: "Settings",
		detail: "Account, privacy, appearance and product preferences.",
		icon: Settings
	}
];
function SystemPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "OCADE",
		title: "More",
		description: "Everything OCADE can do that is not on the sidebar. All of it is also reachable with Cmd/Ctrl+K, and most of it by asking in Chat."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
		children: ENTRIES.map((entry) => {
			const Icon = entry.icon;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: entry.to,
				className: "rounded-xl border border-border/60 bg-card/25 p-4 transition hover:bg-accent/30",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-sm font-medium",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: "h-4 w-4 text-muted-foreground",
							"aria-hidden": true
						}),
						" ",
						entry.label
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: entry.detail
				})]
			}, entry.to);
		})
	})] });
}
//#endregion
export { SystemPage as component };
