import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as BrandMark } from "./BrandMark-C9Qs_Jak.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AuthShell-DJc19O9f.js
var import_jsx_runtime = require_jsx_runtime();
/**
* The way in.
*
* WHAT THIS TOOK FROM THE REFERENCE, AND WHAT IT DELIBERATELY DID NOT
* -------------------------------------------------------------------
* The auth reference is a full-viewport dark composition: enormous negative
* space, a single column of content pinned to one side, sharp rectangles
* instead of pills, a display weight for the name and a mono face for the
* small technical line above it, and a legal footer sitting on a hairline at
* the bottom of the screen. That LANGUAGE is what is used here.
*
* Its brand, its copy, its media and its links are not. This is OCADE's sign-in
* page; borrowing another product's wording would be both wrong and useless.
*
* WHY THE FORM SITS TO ONE SIDE ON A LARGE SCREEN
* -----------------------------------------------
* A centred card on a 27-inch display is a small box floating in a large void,
* and the void reads as unfinished. Anchoring the column to one edge makes the
* space deliberate — it is composition rather than absence — while on a phone
* the same column simply fills the screen, which is why the layout is one
* column that moves rather than two designs.
*
* WHY THERE IS NO BACKGROUND VIDEO
* --------------------------------
* The reference carries a full-bleed cinematic loop. OCADE is offline-first and
* this is the first screen a person ever sees: a video is megabytes fetched
* before anybody has signed in, on a connection that may be the reason they are
* signing in from a train. The composition holds without it.
*/
function AuthShell({ children, title, subtitle, footer }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-screen bg-background",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			"aria-hidden": true,
			className: "pointer-events-none fixed inset-0 bg-[radial-gradient(70%_50%_at_15%_-10%,oklch(0.5_0.1_315/14%),transparent_60%),radial-gradient(50%_40%_at_100%_100%,oklch(0.68_0.11_78/8%),transparent_65%)]"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative grid min-h-screen grid-rows-[auto_1fr_auto]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-center justify-between px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(1.25rem,2.4vw,2rem)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						"aria-label": "CARCC CADANE home",
						className: "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/support",
						className: "-mr-2 inline-flex min-h-11 items-center rounded-sm px-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
						children: "Support"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					id: "main-content",
					className: "flex min-h-0 items-center justify-center overflow-y-auto px-[clamp(1.25rem,5vw,4.5rem)] py-6 lg:justify-end",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full max-w-[26rem] lg:max-w-[30rem]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground",
								children: "OCADE"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-[clamp(1rem,2vw,1.75rem)] text-[clamp(2rem,4.2vw,3.25rem)] font-extralight leading-[1.05] tracking-[0.01em] text-foreground",
								children: title
							}),
							subtitle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 max-w-[24rem] text-sm leading-relaxed text-muted-foreground",
								children: subtitle
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-[clamp(1.75rem,3.5vw,2.75rem)]",
								children
							})
						]
					})
				}),
				footer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
					className: "border-t border-border/60 px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(1rem,1.7vw,1.6rem)] pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs leading-relaxed text-muted-foreground",
					children: footer
				}) : null
			]
		})]
	});
}
//#endregion
export { AuthShell as t };
