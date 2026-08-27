import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as OcadeOrb } from "./OcadeOrb-CAwPzlLl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/OcadeCompanion-ChgP1je7.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Buddy: the local companion, and a status light.
*
* WHAT BUDDY IS NOT. A second assistant. It has no opinions, no messages and
* nothing to say that OCADE is not already saying — a product with two things
* talking to the user is a product where the user has to work out which one to
* believe.
*
* WHAT IT IS. The corner of the screen that answers "is OCADE attached to this
* computer, and what is it doing right now" without being asked. It was a
* static image, which answered the first half and not the second: the mark sat
* unchanged whether OCADE was idle or halfway through typing into somebody's
* document. Passing a `state` gives it the orb, which is the same object Chat
* and Work show, at the same size and in the same palette. Without a state it
* stays the mark, because a surface that has nothing to report should not
* imply it does.
*/
function OcadeCompanion({ label = "OCADE is standing by", compact = false, state, className }) {
	const diameter = compact ? 56 : 96;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: cn("ocade-companion group pointer-events-none relative isolate flex items-center gap-3", className),
		"aria-label": label,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("relative shrink-0 rounded-full border border-white/15 bg-black/45 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl", compact ? "h-14 w-14" : "h-24 w-24 sm:h-28 sm:w-28"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "absolute inset-[-10%] -z-10 rounded-full bg-[conic-gradient(from_180deg,transparent,rgba(116,84,164,.38),transparent_42%,rgba(203,163,82,.3),transparent_78%)] blur-xl"
			}), state ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "absolute inset-0 grid place-items-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeOrb, {
					state,
					size: diameter,
					decorative: true
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: "/brand/ocade-carcc-mark.png",
				alt: "",
				width: 512,
				height: 512,
				loading: "lazy",
				decoding: "async",
				className: "h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(116,84,164,.24)]"
			})]
		}), !compact ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figcaption", {
			className: "hidden max-w-[12rem] rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-[11px] leading-relaxed text-foreground/80 shadow-xl backdrop-blur-xl sm:block",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mb-1 block text-[9px] font-semibold uppercase tracking-[0.22em] text-primary",
				children: "Local companion"
			}), label]
		}) : null]
	});
}
//#endregion
export { OcadeCompanion as t };
