import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { $t as Info, M as ShieldCheck, nr as ChevronLeft } from "../_libs/lucide-react.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { r as ocadeIntro } from "./ocade-identity-BWv-E_0R.mjs";
import { n as LocalModelLifecyclePanel, t as LocalEngineControl } from "./LocalEngineControl-BZ6GwfPb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.models-DdKALNf3.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Local Intelligence — what is running on this device, and how healthy it is.
*
* WHAT THIS PAGE USED TO BE. 874 lines of cloud-provider configuration:
* routing modes across four providers, privacy/cost/speed preference matrices,
* "Test connection" buttons for the Lovable AI Gateway and OpenAI, a model
* fabric listing hosted models, and usage diagnostics for a cloud allowance.
* Roughly forty lines of it concerned the engine that actually answers.
*
* Every one of those controls saved a value that no longer changes anything,
* because OCADE does not use a hosted provider. A settings screen whose
* switches persist and do nothing is worse than no settings screen: it tells
* the user they are in control of something they are not.
*
* So the page is now about the only engine there is. The local lifecycle
* panel and the engine control were already here and already good; they are
* what is left, plus an honest statement of where generation happens.
*/
function OcadeModelsPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen px-4 py-8 sm:px-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Local Intelligence",
			description: "The engine that answers you runs on this device. Nothing here sends your conversations anywhere.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/ocade",
				className: "inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-fg-muted hover:text-fg",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-4 w-4" }), " Back to chat"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto grid max-w-5xl grid-cols-1 gap-6 pb-16",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocalEngineControl, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-5" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocalModelLifecyclePanel, {})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
					className: "p-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-5 w-5 shrink-0 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-sm text-fg-muted",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-medium text-fg",
									children: "Where your words go"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1",
									children: "OCADE generates every reply on this device. Your messages, drafts, attachments and the reasoning behind an answer are not sent to any AI company — not to a third party, and not to us. There is no code left in OCADE that could reach one."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2",
									children: "OCADE still uses the internet for ordinary things: downloading its own engine the first time, looking up current information when a question needs it, and synchronising your chats if you have chosen to. Fetching a fact is not the same as handing over your thinking, and OCADE only does the first."
								})
							]
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
					className: "p-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "h-5 w-5 shrink-0 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-sm text-fg-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium text-fg",
								children: "Identity"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1",
								children: [
									"In conversation OCADE introduces itself as",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-fg",
										children: ocadeIntro()
									}),
									" and refers to its engine by capability rather than by file name. Asked directly which engine is answering, it answers truthfully — the details stay on this page rather than in every reply."
								]
							})]
						})]
					})
				})
			]
		})]
	});
}
//#endregion
export { OcadeModelsPage as component };
