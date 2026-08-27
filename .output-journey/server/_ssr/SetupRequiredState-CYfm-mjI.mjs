import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Qn as CircleAlert } from "../_libs/lucide-react.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as StatusBadge } from "./StatusBadge-B-3ICXuc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/SetupRequiredState-CYfm-mjI.js
var import_jsx_runtime = require_jsx_runtime();
function SetupRequiredState({ title, description, detail, action, status = "setup_required" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex flex-col items-start gap-3 p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-lg bg-[color:var(--state-warning)]/15 p-2 text-[color:var(--state-warning)]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
						className: "h-5 w-5",
						"aria-hidden": true
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status }) })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-base font-semibold text-foreground",
				children: title
			}),
			description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: description
			}) : null,
			detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground/70",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: "Technical detail:"
					}),
					" ",
					detail
				]
			}) : null,
			action
		]
	});
}
//#endregion
export { SetupRequiredState as t };
