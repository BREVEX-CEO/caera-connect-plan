import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { m as TriangleAlert, q as RotateCcw } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/TruthfulFailurePanel-Bg65KPix.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Errors must say what failed without implying that an action happened. This
* shared panel deliberately separates failure, safety, and non-execution so a
* user can tell the difference between "the request failed" and "the action
* partially happened". Callers must only describe facts they can actually
* prove; the component never manufactures a success state.
*/
function TruthfulFailurePanel({ title, failed, safe, notDone, alternative, diagnosticId, retry, retryLabel = "Try again", className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		role: "alert",
		className: cn("rounded-xl border border-destructive/30 bg-destructive/[0.06] p-4", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
				className: "mt-0.5 h-4 w-4 shrink-0 text-destructive",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-3 grid gap-2 text-xs leading-relaxed",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "font-medium text-foreground",
								children: "What failed"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-muted-foreground",
								children: failed
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "font-medium text-foreground",
								children: "What is safe"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-muted-foreground",
								children: safe
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "font-medium text-foreground",
								children: "What OCADE did not do"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-muted-foreground",
								children: notDone
							})] }),
							alternative ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "font-medium text-foreground",
								children: "Alternative"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-muted-foreground",
								children: alternative
							})] }) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap items-center gap-3",
						children: [retry ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: retry,
							className: "inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							}), retryLabel]
						}) : null, diagnosticId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
							className: "text-[10px] text-muted-foreground",
							children: ["Diagnostic ", diagnosticId]
						}) : null]
					})
				]
			})]
		})
	});
}
//#endregion
export { TruthfulFailurePanel as t };
