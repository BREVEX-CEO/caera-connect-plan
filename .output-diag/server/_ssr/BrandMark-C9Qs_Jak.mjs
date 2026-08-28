import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/BrandMark-C9Qs_Jak.js
var import_jsx_runtime = require_jsx_runtime();
/** Compact, accessible lockup built from the official supplied OCADE mark. */
function BrandMark({ className, showWordmark = true }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("ocade-brand-lockup inline-flex items-center gap-2.5", className),
		"aria-label": "OCADE by CARCC CADANE",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "ocade-brand-mark relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[10px]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: "/brand/ocade-carcc-mark.png",
				alt: "",
				width: 32,
				height: 32,
				className: "h-full w-full object-cover",
				decoding: "async"
			})
		}), showWordmark ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col leading-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[15px] font-semibold uppercase tracking-[0.22em] text-foreground",
				children: "OCADE"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-1 text-[8px] font-medium uppercase tracking-[0.24em] text-muted-foreground",
				children: "By CARCC CADANE"
			})]
		}) : null]
	});
}
//#endregion
export { BrandMark as t };
