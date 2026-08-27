import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as PublicPage, r as PublicSection } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/press-BXRBAOHG.js
var import_jsx_runtime = require_jsx_runtime();
function PressPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Press and media",
		title: "CARCC CADANE press kit",
		summary: "Source-bound company and product facts for OCADE coverage. No press coverage, award, customer, funding or incorporation claim is implied.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Company overview",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "CARCC CADANE is the independent pre-launch venture behind OCADE, created and led by Haans Antoni in Bengaluru, Karnataka, India. OCADE is a local-first AI workspace being prepared for a planned public launch on 28 August 2026." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Brand assets",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: "/brand/ocade-carcc-wordmark.png",
						download: true,
						className: "rounded-xl border border-border/70 p-4 text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: "/brand/ocade-carcc-wordmark.png",
							alt: "OCADE by CARCC CADANE wordmark",
							width: 2172,
							height: 724,
							className: "aspect-[3/1] w-full object-contain"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-2 block text-xs",
							children: "Download wordmark PNG"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: "/brand/ocade-carcc-mark.png",
						download: true,
						className: "rounded-xl border border-border/70 p-4 text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: "/brand/ocade-carcc-mark.png",
							alt: "OCADE mark",
							width: 1296,
							height: 1296,
							className: "mx-auto aspect-square w-28 object-contain"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-2 block text-xs",
							children: "Download mark PNG"
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Keep the black background, metallic silver, violet and gold treatment intact. Do not recolour, crop through the mark or imply endorsement." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Key statistics",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "grid gap-3 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs uppercase tracking-wide",
							children: "Product"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "text-foreground",
							children: "1 active product: OCADE"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs uppercase tracking-wide",
							children: "Planned founding and launch"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "text-foreground",
							children: "28 August 2026"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs uppercase tracking-wide",
							children: "Headquarters record"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "text-foreground",
							children: "Bengaluru, Karnataka, India"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs uppercase tracking-wide",
							children: "Verified funding or customers"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "text-foreground",
							children: "None claimed"
						})] })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Recent press releases",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No press release has been published. This empty state is intentional; product journal posts are not relabelled as press releases." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/blog",
					className: "text-foreground underline",
					children: "Read the OCADE journal"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Press contact",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "A dedicated press mailbox has not been verified, so no address is published. Use the official company and founder profiles for sourceable facts until a press contact is confirmed." })
			})
		]
	});
}
//#endregion
export { PressPage as component };
