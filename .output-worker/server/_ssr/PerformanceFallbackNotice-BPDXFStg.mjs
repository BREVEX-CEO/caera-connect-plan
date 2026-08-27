import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as describeTrigger } from "./perf-fallback-BFzNUEP9.mjs";
import { dn as Gauge } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PerformanceFallbackNotice-BPDXFStg.js
var import_jsx_runtime = require_jsx_runtime();
/**
* What the automatic performance fallback changed, and why.
*
* A product that quietly turns off half its visuals on a slow machine reads as
* broken to the person using it. This states the trigger, lists every change
* in plain language, and offers the way back — so a stepped-down interface is
* a decision the user can see and reverse, not a mystery.
*
* Renders nothing when the detector has never fired: an explanation of
* something that did not happen is noise.
*/
function PerformanceFallbackNotice({ className }) {
	const { perfFallback, keepFullQuality, resumeAutoFallback } = useAppearance();
	if (!perfFallback.active) return null;
	const applied = !perfFallback.overridden;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		role: "status",
		className: ["rounded-lg border border-border/60 bg-secondary/30 p-3", className ?? ""].join(" "),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, {
					className: "h-4 w-4 text-muted-foreground",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "text-[12.5px] font-medium text-foreground",
					children: applied ? "Visuals reduced for this device" : "Full quality kept on this device"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground",
				children: [describeTrigger(perfFallback.trigger ?? "device", perfFallback.reason), applied ? "" : " You asked OCADE to keep full quality here, so nothing has been turned down — the interface may stutter."]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[11.5px] font-medium text-foreground",
				children: applied ? "What changed" : "What would change"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-1 space-y-1",
				children: perfFallback.changes.map((change) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						"aria-hidden": true,
						className: "text-muted-foreground/60",
						children: "•"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: change })]
				}, change))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2.5 flex flex-wrap gap-2",
				children: applied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: keepFullQuality,
					className: "h-7 rounded-md border border-border/60 px-2.5 text-[11.5px] text-foreground transition-colors hover:bg-secondary/60",
					children: "Keep full quality anyway"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: resumeAutoFallback,
					className: "h-7 rounded-md border border-primary/50 bg-primary/15 px-2.5 text-[11.5px] text-foreground transition-colors hover:bg-primary/25",
					children: "Let OCADE reduce visuals again"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[11px] leading-relaxed text-muted-foreground/80",
				children: "This choice is remembered on this browser only, so a faster computer on the same account is unaffected."
			})
		]
	});
}
//#endregion
export { PerformanceFallbackNotice as t };
