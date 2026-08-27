import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ft as MessageSquarePlus, N as ShieldAlert, O as Signal, Pt as MessageSquareText } from "../_libs/lucide-react.mjs";
import { n as PublicPage, r as PublicSection } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/support-B-b8zcPc.js
var import_jsx_runtime = require_jsx_runtime();
var ACTION_LINK = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
function SupportPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Support and contact",
		title: "OCADE support",
		summary: "OCADE uses a ticket-based support queue and administrative review workspace. Dedicated domain email addresses will be published only after they are activated and verified.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
					title: "Common questions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Start with setup, local-engine, offline, account, privacy and launch information." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/faq",
						className: ACTION_LINK,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquareText, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Browse the FAQ"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
					title: "Service status",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Check availability, incidents, maintenance and update notices where the status page is available." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/status",
						className: ACTION_LINK,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Signal, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " View OCADE status"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Ticket-based contact",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Signed-in OCADE accounts can create support cases that remain attached to the account and appear in the OCADE administrative support queue. Categories include Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Before authenticated account access opens, this public page is the authoritative contact status: no dedicated support, legal, privacy, security or investor email address is claimed to be active. Those addresses may be added later after their mailboxes and delivery are verified." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/settings/support",
						className: ACTION_LINK,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquarePlus, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Open signed-in support"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Privacy, legal and security requests",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Use a Privacy, Legal or Security ticket when signed-in ticket intake is available. Privacy rights requests may also use the public data-rights route where that route is available. Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card numbers or payment secrets in a ticket." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/data-rights",
						className: ACTION_LINK,
						children: "Data rights"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/privacy",
						className: ACTION_LINK,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Privacy notice"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Investor and partnership enquiries",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Prospective investors and strategic partners may use the Investor or Partnership ticket category when account intake is available. An enquiry starts a private discussion only; it is not an offer of securities, a solicitation to invest or a promise that equity or shareholding will be offered." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/about",
					className: ACTION_LINK,
					children: "About CARCC CADANE"
				})]
			})
		]
	});
}
//#endregion
export { SupportPage as component };
