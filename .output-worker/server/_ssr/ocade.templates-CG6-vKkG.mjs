import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, Hn as ClipboardList, Pt as MessageSquareText, n as Wrench } from "../_libs/lucide-react.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.templates-CG6-vKkG.js
var import_jsx_runtime = require_jsx_runtime();
var TEMPLATES = [
	{
		title: "Research brief",
		icon: Search,
		prompt: "Research this topic, separate verified facts from inference, cite the strongest evidence, and end with the open questions that still matter."
	},
	{
		title: "Work plan",
		icon: ClipboardList,
		prompt: "Turn this goal into an execution plan with milestones, dependencies, risks, owners or decision points, and a clear definition of done."
	},
	{
		title: "Build / debug",
		icon: Wrench,
		prompt: "Inspect the evidence first, identify the smallest root-cause fix, implement it without weakening safety checks, and verify the result before calling it complete."
	},
	{
		title: "Decision memo",
		icon: MessageSquareText,
		prompt: "Compare the realistic options, state the tradeoffs and unknowns, recommend one choice, and explain what evidence would change the recommendation."
	}
];
function TemplatesPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Templates",
			description: "Small reusable starting prompts. These are plain local product templates—no template is presented as an autonomous workflow until a real task runtime is attached to it."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 grid gap-3 md:grid-cols-2",
			children: TEMPLATES.map((template) => {
				const Icon = template.icon;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-xl border border-border/60 bg-card/30 p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: "h-4 w-4 text-muted-foreground",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-medium",
							children: template.title
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm leading-relaxed text-muted-foreground",
						children: template.prompt
					})]
				}, template.title);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-5 text-xs text-muted-foreground",
			children: [
				"Use a template in",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/ocade",
					className: "text-foreground underline underline-offset-4",
					children: "Chat"
				}),
				", then move durable multi-step execution into",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/ocade/tasks",
					className: "text-foreground underline underline-offset-4",
					children: "Tasks"
				}),
				" ",
				"when needed."
			]
		})
	] });
}
//#endregion
export { TemplatesPage as component };
