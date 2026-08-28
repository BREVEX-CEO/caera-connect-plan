import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as PublicPage, r as PublicSection } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/team-By8Ty1CC.js
var import_jsx_runtime = require_jsx_runtime();
function TeamPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "People",
		title: "The team behind OCADE",
		summary: "CARCC CADANE publishes only people whose roles are verified. It does not use stock portraits, fictional employees or inflated team counts.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Founder and product leadership",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "flex gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						role: "img",
						"aria-label": "HAANS ANTONI initials",
						className: "grid h-16 w-16 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 font-semibold",
						children: "HA"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-semibold text-foreground",
							children: "HAANS ANTONI"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "CEO, Chairman and Founder" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2",
							children: "Product direction, local intelligence, safety and launch evidence for OCADE."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/founder/haans-antoni",
							className: "mt-2 inline-block text-foreground underline",
							children: "Official founder profile"
						})
					] })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Areas of work",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-3 sm:grid-cols-3",
					children: [
						"Product and design",
						"Local AI and engineering",
						"Safety and launch readiness"
					].map((area) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-xl border border-border/60 p-3 text-foreground",
						children: area
					}, area))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "These are work areas, not claims of separate departments or unlisted employees." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Working character",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "OCADE is being built around direct evidence, local-first execution, explicit permissions and honest failure states. Public records separate the product that exists from future-company, funding and hiring plans." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Work with CARCC CADANE",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No opening is advertised without verified role terms. The careers page records current workstreams and explains when a role can be published." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/careers",
					className: "text-foreground underline",
					children: "View careers"
				})]
			})
		]
	});
}
//#endregion
export { TeamPage as component };
