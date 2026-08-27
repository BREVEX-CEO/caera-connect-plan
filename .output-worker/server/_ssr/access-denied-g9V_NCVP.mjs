import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { N as ShieldAlert } from "../_libs/lucide-react.mjs";
import { t as Route } from "./access-denied-BJifzkGX.mjs";
import { t as AppShell } from "./AppShell-DYEjrpCe.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access-denied-g9V_NCVP.js
var import_jsx_runtime = require_jsx_runtime();
function AccessDeniedPage() {
	const { area, reason } = Route.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mx-auto flex max-w-xl flex-col items-center py-16",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "w-full p-8 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-border/70 bg-muted/30",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "h-5 w-5 text-muted-foreground" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-4 text-lg font-semibold text-foreground",
					children: "Access denied"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: reason ?? `You are signed in, but your account does not have permission to open ${area ?? "this area"}.`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-xs text-muted-foreground",
					children: "Ask a workspace owner or administrator to grant you the required role. This attempt was not recorded as a failure of your account."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/home",
						className: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90",
						children: "Back to Home"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/settings",
						className: "rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent",
						children: "Open Settings"
					})]
				})
			]
		})
	}) });
}
//#endregion
export { AccessDeniedPage as component };
