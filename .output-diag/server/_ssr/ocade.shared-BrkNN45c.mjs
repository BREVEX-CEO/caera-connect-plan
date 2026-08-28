import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { F as Share2, mn as FolderKanban, yt as PackageOpen } from "../_libs/lucide-react.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as CapabilityBadge } from "./CapabilityBadge-Ci6Z_gpg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.shared-BrkNN45c.js
var import_jsx_runtime = require_jsx_runtime();
function SharedPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Shared",
			description: "A truthful boundary for content sharing. This build has no public-share link service, so nothing is published merely because a project or artifact exists."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 rounded-xl border border-border/60 bg-card/30 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, {
						className: "h-4 w-4 text-muted-foreground",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-medium",
						children: "Public and external sharing"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilityBadge, { status: "NOT_CONFIGURED" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-relaxed text-muted-foreground",
				children: "No share token, public URL, recipient grant, or anonymous read path is configured. OCADE will not imply that an item was shared when no sharing backend exists."
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid gap-3 sm:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
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
					children: "Keep work private inside your authenticated workspace."
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/ocade/artifacts",
				className: "rounded-xl border border-border/60 p-4 transition hover:bg-accent/30",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-sm font-medium",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PackageOpen, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), "Artifacts"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Review generated outputs without creating a public link."
				})]
			})]
		})
	] });
}
//#endregion
export { SharedPage as component };
