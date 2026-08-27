import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as WorkspaceShell } from "./WorkspaceShell-Bu1RP6V7.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ComingLater-DJcODsXa.js
var import_jsx_runtime = require_jsx_runtime();
/**
* The one screen every retired product now shows.
*
* FICIA, MADEE and CANIA were partially built and are not being shipped. Three
* options were open: delete their routes, leave the half-finished screens in
* place, or keep the route and say plainly that there is nothing behind it yet.
*
* Deleting the routes breaks every existing link and every bookmark, and frees
* the names to be taken by something else later. Leaving the screens up is
* worse: a dashboard full of placeholder figures reads as a working product,
* and the employee and market data behind those screens was never finished
* enough to be shown to anyone.
*
* So the route survives and the page is honest. THE SENTENCE MATTERS: people
* arriving from OCADE reasonably assume every tile in this product is another
* assistant, and these are not — they were a workforce tool, a document tool
* and a market-data tool. Saying "not an AI model" is the part that stops
* someone waiting for a reply that will never come.
*/
function ComingLater({ name, icon: Icon, wasGoingToBe }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspaceShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "flex w-full flex-col items-center gap-4 p-10 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "grid h-14 w-14 place-items-center rounded-2xl border border-border/60 bg-secondary/40 text-muted-foreground",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-6 w-6" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-lg font-semibold tracking-tight text-foreground",
					children: name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium text-foreground",
					children: "Coming later — not an AI model."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "max-w-sm text-sm text-muted-foreground",
					children: [
						name,
						" was ",
						wasGoingToBe,
						". It is not part of this release and there is nothing to open here yet."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/ocade",
					className: "mt-1 rounded-md border border-border/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/60",
					children: "Go to OCADE"
				})
			]
		})
	}) });
}
//#endregion
export { ComingLater as t };
