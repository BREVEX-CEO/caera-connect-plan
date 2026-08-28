import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/StatusBadge-B-3ICXuc.js
var import_jsx_runtime = require_jsx_runtime();
var styles = {
	active: "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)] ring-[color:var(--state-success)]/30",
	success: "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)] ring-[color:var(--state-success)]/30",
	connected: "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)] ring-[color:var(--state-success)]/30",
	beta: "bg-[color:var(--state-info)]/15 text-[color:var(--state-info)] ring-[color:var(--state-info)]/30",
	running: "bg-[color:var(--state-info)]/15 text-[color:var(--state-info)] ring-[color:var(--state-info)]/30",
	setup_required: "bg-[color:var(--state-warning)]/5 text-[color:var(--state-warning)] ring-[color:var(--state-warning)]/30",
	paused: "bg-[color:var(--state-warning)]/5 text-[color:var(--state-warning)] ring-[color:var(--state-warning)]/30",
	planned: "bg-muted text-muted-foreground ring-border",
	pending: "bg-muted text-muted-foreground ring-border",
	disconnected: "bg-muted text-muted-foreground ring-border",
	failed: "bg-destructive/15 text-destructive ring-destructive/30"
};
var labels = {
	active: "Active",
	beta: "Beta",
	setup_required: "Setup required",
	planned: "Planned",
	connected: "Connected",
	disconnected: "Disconnected",
	running: "Running",
	paused: "Paused",
	failed: "Failed",
	success: "Success",
	pending: "Pending"
};
function StatusBadge({ status, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", styles[status]),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 rounded-full bg-current" }), children ?? labels[status]]
	});
}
//#endregion
export { StatusBadge as t };
