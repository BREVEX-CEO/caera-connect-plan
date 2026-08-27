import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/GlassPanel-YTcQg8L0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DEPTH_CLASS = {
	base: "depth-base",
	raised: "depth-raised",
	elevated: "depth-elevated",
	floating: "depth-floating",
	overlay: "depth-overlay",
	modal: "depth-modal"
};
/**
* The application's surface primitive — now a surface at a DEPTH.
*
* Nearly every screen in the product is built from these, which is exactly why
* the third dimension is introduced here rather than page by page: one change
* gives the whole application consistent depth, and a route written next month
* gets it without knowing this system exists. That is the same argument
* `MotionScope` makes for scroll reveal.
*
* `depth` defaults to `raised` so the common case needs no prop, and the
* transform collapses to the identity when `DepthScene` reports a flat device
* — see styles.css. Nothing about the two-dimensional layout changes.
*/
var GlassPanel = (0, import_react.forwardRef)(function GlassPanel({ className, strong, depth = "raised", lift, flat, ...props }, ref) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref,
		className: cn(strong ? "glass-strong" : "glass", "rounded-lg", !flat && [
			"ocade-depth",
			DEPTH_CLASS[depth],
			lift && "ocade-depth-lift"
		], className),
		...props
	});
});
//#endregion
export { GlassPanel as t };
