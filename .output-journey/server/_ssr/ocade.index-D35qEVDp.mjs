import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { h as createFileRoute, m as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as TriangleAlert, q as RotateCcw } from "../_libs/lucide-react.mjs";
import { t as reportRuntimeError } from "./runtime-error-reporting-hYG2bZLi.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.index-D35qEVDp.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Shapes that mean the message was written for whoever wrote the code.
*
* React hands the boundary the raw Error, and this component used to render
* `error.message` straight onto the page. "Cannot read properties of undefined
* (reading 'name')" tells a person nothing they can act on, and tells them the
* product is broken in a way that feels unsafe. A stack frame or a minified
* React code is worse still.
*
* The test is deliberately on the SHAPE rather than on an allow-list of good
* messages: the product's own sentences ("That folder is no longer on this
* computer.") are worth keeping, and there is no way to enumerate them.
*/
var DEVELOPER_SHAPED = [
	/\bundefined\b|\bnull\b/i,
	/is not a function|is not defined|is not an object|is not iterable/i,
	/cannot read propert(y|ies)/i,
	/unexpected token|JSON at position/i,
	/React error #\d+/i,
	/\.[jt]sx?:\d+:\d+/,
	/\bat\s+\S+\s*\(/,
	/^\w*(Type|Reference|Syntax|Range|Eval)Error\b/
];
var GENERIC = "Something here stopped working. Trying again usually clears it.";
/** What may be shown to a person, as opposed to what is worth logging. */
function readableMessage(raw) {
	const message = (raw ?? "").trim();
	if (!message) return GENERIC;
	if (DEVELOPER_SHAPED.some((shape) => shape.test(message))) return GENERIC;
	return message;
}
var ErrorBoundary = class extends import_react.Component {
	state = { error: null };
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error, info) {
		reportRuntimeError(error, {
			boundary: this.props.label ?? "panel",
			componentStack: info.componentStack ?? void 0
		});
	}
	retry = () => this.setState({ error: null });
	render() {
		const { error } = this.state;
		if (!error) return this.props.children;
		const message = readableMessage(error.message);
		if (this.props.fallback) return this.props.fallback(this.retry, message);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "alert",
			className: "flex flex-col items-start gap-2 rounded-lg border border-border/60 bg-secondary/25 p-3 text-xs",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-2 font-medium text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
						className: "h-4 w-4 text-[color:var(--state-warning)]",
						"aria-hidden": true
					}), this.props.label ? `${this.props.label} stopped working` : "This panel stopped working"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: message
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: this.retry,
					className: "inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-muted-foreground hover:text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
						className: "h-3.5 w-3.5",
						"aria-hidden": true
					}), " Try again"]
				})
			]
		});
	}
};
var $$splitComponentImporter = () => import("./ocade.index-B4FX4VCb.mjs");
/**
* What a person chooses, in their words.
*
* Not model names, not runtimes, not "automatic". Two of these are the same
* question anybody actually has — sooner or better — and the third is a
* different promise: nothing leaves this device, including a web lookup.
*/
var Route$1 = createFileRoute("/_authenticated/ocade/")({
	head: () => ({ meta: [{ title: "OCADE — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	validateSearch: (raw) => ({ conversation: typeof raw.conversation === "string" ? raw.conversation : void 0 }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route$1 as n, ErrorBoundary as t };
