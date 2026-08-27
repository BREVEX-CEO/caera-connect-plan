import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { I as Shapes, In as CodeXml, Ot as MonitorCog, P as Sheet, Ut as LockKeyhole, Xn as CircleCheck, Yt as LayoutTemplate, mr as Box, nn as Image, or as ChartColumn, rt as Presentation, vn as FileText, yn as FileOutput } from "../_libs/lucide-react.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as CapabilityBadge } from "./CapabilityBadge-Ci6Z_gpg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.studio-BxQXHt4i.js
var import_jsx_runtime = require_jsx_runtime();
var BLENDER_ROUTE_ORDER = [
	"python_api",
	"cli",
	"plugin",
	"project_file",
	"accessibility",
	"vision_input"
];
var CREATIVE_RUNTIME_BOUNDARY = "Creative control source is available, but no installed Blender or other creative application, GPU renderer, signed adapter, or live project has been validated in this environment. Controlled fixtures are not an installed-application claim.";
var GUARANTEES = [
	"Versioned project checkpoint verified before mutation",
	"Bounded script process with network, read and write scopes",
	"Scene hierarchy, geometry, modifiers and logs inspected afterward",
	"Render and glTF bytes hashed and format-validated",
	"Verified checkpoint restoration on any incomplete result"
];
/**
* Honest production surface for the Phase 30 contract. It describes what is
* implemented without presenting a live Run control before a signed creative
* adapter and installed application have actually been paired.
*/
function CreativeControlPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), " Creative application control"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Blender-first execution with checkpoints, resource admission, bounded scripts, render inspection and verified exports."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-2 py-1 text-[10px] font-medium",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockKeyhole, {
						className: "h-3 w-3",
						"aria-hidden": true
					}), " Adapter required"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-3 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border/60 bg-secondary/20 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-1.5 text-xs font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitorCog, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							}), " Blender route order"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground",
							children: BLENDER_ROUTE_ORDER.map((route, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								index + 1,
								". ",
								route.replaceAll("_", " ")
							] }, route))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-[10px] text-muted-foreground",
							children: "Vision/input is observation-only and cannot authorize a project mutation."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border/60 bg-secondary/20 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 text-xs font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), " Required evidence"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-1 text-[11px] text-muted-foreground",
						children: GUARANTEES.map((guarantee) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["• ", guarantee] }, guarantee))
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 rounded-lg border border-border/60 bg-background/40 p-2 text-[11px] text-muted-foreground",
				children: CREATIVE_RUNTIME_BOUNDARY
			})
		]
	});
}
var ENTRIES = [
	{
		label: "Documents",
		detail: "Draft, revise and save document-style outputs through OCADE Chat and the artifact ledger.",
		status: "READY",
		to: "/ocade",
		icon: FileText
	},
	{
		label: "Reports",
		detail: "Research and structured report drafting use OCADE Chat; saved results remain versioned in Artifacts.",
		status: "READY",
		to: "/ocade",
		icon: LayoutTemplate
	},
	{
		label: "Data analysis",
		detail: "Use the Code workspace for executable analysis or Chat for explanation. OCADE will not claim a notebook ran when no execution host exists.",
		status: "READY",
		to: "/ocade/code",
		icon: ChartColumn
	},
	{
		label: "Websites & apps",
		detail: "The Code workspace is the real implementation surface for source files, patches, analysis and sandboxed execution where available.",
		status: "READY",
		to: "/ocade/code",
		icon: CodeXml
	},
	{
		label: "Exports",
		detail: "Saved outputs, versions, integrity checks and exports live in the existing Artifacts workspace.",
		status: "READY",
		to: "/ocade/artifacts",
		icon: FileOutput
	},
	{
		label: "Images",
		detail: "Chat can offer a visual response for supported answers, but a dedicated image-generation studio is not wired in this build.",
		status: "NOT_CONFIGURED",
		icon: Image
	},
	{
		label: "Diagrams",
		detail: "There is no dedicated diagram editor/generator connected to Studio yet.",
		status: "NOT_CONFIGURED",
		icon: Shapes
	},
	{
		label: "Presentations",
		detail: "A first-class presentation authoring/export runtime has not been connected to OCADE Studio yet.",
		status: "NOT_CONFIGURED",
		icon: Presentation
	},
	{
		label: "Spreadsheets",
		detail: "A first-class spreadsheet workbook editor is not wired here yet; executable data work belongs in Code for now.",
		status: "NOT_CONFIGURED",
		icon: Sheet
	}
];
function StudioPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Studio",
			description: "Create useful outputs. Studio only marks a medium ready when there is a real implementation path behind it; engineering diagnostics have moved to Lab.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/ocade/lab",
				className: "inline-flex min-h-[24px] items-center px-1 py-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground",
				children: "Open Lab"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
			children: ENTRIES.map((entry) => {
				const Icon = entry.icon;
				const card = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "h-full rounded-xl border border-border/60 bg-card/25 p-4 transition hover:bg-accent/25",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "h-4 w-4 text-muted-foreground",
									"aria-hidden": true
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-sm font-medium text-foreground",
									children: entry.label
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilityBadge, { status: entry.status })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm leading-relaxed text-muted-foreground",
							children: entry.detail
						}),
						entry.to ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-3 block text-xs text-foreground underline underline-offset-4",
							children: "Open"
						}) : null
					]
				});
				return entry.to ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: entry.to,
					children: card
				}, entry.label) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: card }, entry.label);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreativeControlPanel, {})
		})
	] });
}
//#endregion
export { StudioPage as component };
