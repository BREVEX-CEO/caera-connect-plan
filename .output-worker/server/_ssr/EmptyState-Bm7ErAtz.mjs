import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/EmptyState-Bm7ErAtz.js
var import_jsx_runtime = require_jsx_runtime();
function EmptyState({ icon, title, description, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex flex-col items-center justify-center gap-3 p-10 text-center",
		children: [
			icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-muted-foreground",
				children: icon
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-base font-semibold text-foreground",
				children: title
			}),
			description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm text-muted-foreground",
				children: description
			}) : null,
			action
		]
	});
}
//#endregion
export { EmptyState as t };
