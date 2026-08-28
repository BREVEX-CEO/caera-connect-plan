import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, _n as Files, dr as Brain, mn as FolderKanban } from "../_libs/lucide-react.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as CapabilityBadge } from "./CapabilityBadge-Ci6Z_gpg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.knowledge-BghROPNK.js
var import_jsx_runtime = require_jsx_runtime();
function KnowledgePage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Knowledge",
			description: "Your durable workspace context, without pretending a global retrieval index exists when it does not."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 rounded-xl border border-border/60 bg-card/30 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brain, {
						className: "h-4 w-4 text-muted-foreground",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-medium",
						children: "Global knowledge index"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilityBadge, { status: "NOT_CONFIGURED" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-relaxed text-muted-foreground",
				children: "OCADE does not currently maintain a separate always-on vector index across every file and conversation. Project context, files and authenticated search remain the authoritative sources until an indexed knowledge service is implemented and privacy-scoped."
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid gap-3 sm:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/ocade/projects",
					className: "rounded-xl border border-border/60 p-4 transition hover:bg-accent/30",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderKanban, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), "Projects"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Durable instructions and workspace context."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/ocade/artifacts",
					className: "rounded-xl border border-border/60 p-4 transition hover:bg-accent/30",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Files, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), "Artifacts"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Generated outputs retained by OCADE."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/ocade/search",
					className: "rounded-xl border border-border/60 p-4 transition hover:bg-accent/30",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), "Search"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Search authenticated OCADE records that actually exist."
					})]
				})
			]
		})
	] });
}
//#endregion
export { KnowledgePage as component };
