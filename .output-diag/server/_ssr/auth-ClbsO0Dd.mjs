import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase, t as getSupabaseBrowserConfiguration } from "./client-D46NpEQY.mjs";
import { N as redirect, h as createFileRoute, m as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as stringType, o as objectType, r as enumType } from "../_libs/zod.mjs";
import { a as DialogHeader, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-CCT-3-fg.mjs";
import { i as TermsContent, n as PrivacyContent, r as TERMS_META, t as PRIVACY_META } from "./LegalContent-DdyAlKW4.mjs";
import { t as safeNext } from "./safe-next-DgGuzc4L.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth-ClbsO0Dd.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Terms and Privacy, opened without leaving the page you are on.
*
* WHY THIS EXISTS. The signup form linked to `/terms` and `/privacy` with a
* router `<Link>`. Following one navigated away from the form, and everything
* typed into it — email, password, the lot — was gone on the way back.
* Reading the terms before agreeing to them is the one thing a person is most
* likely to do at exactly that moment, and it was the one thing that punished
* them for doing it.
*
* The dialog primitive already in this repository gives focus trapping, an
* Escape handler, an overlay click and a labelled close control. What it does
* not give is a body that scrolls on a phone while the header stays put, which
* is what makes a long legal document readable on a small screen, so that is
* added here.
*
* The words come from `LegalContent`, the same module the standalone routes
* render, so the dialog cannot show a different version of the agreement from
* the page a link would reach.
*/
function LegalDialog({ open, document, onOpenChange }) {
	const meta = document === "terms" ? TERMS_META : PRIVACY_META;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "flex max-h-[85vh] w-[min(46rem,calc(100vw-2rem))] flex-col gap-0 p-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
				className: "shrink-0 border-b border-border/60 px-5 py-4 text-left",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] uppercase tracking-wide text-muted-foreground",
						children: meta.eyebrow
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
						className: "text-base",
						children: meta.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-muted-foreground",
						children: meta.summary
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-sm",
				tabIndex: 0,
				role: "region",
				"aria-label": `${meta.title} content`,
				children: document === "terms" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TermsContent, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivacyContent, {})
			})]
		})
	});
}
var $$splitComponentImporter = () => import("./auth-Bb_s1pl6.mjs");
var searchSchema = objectType({
	next: stringType().optional(),
	message: stringType().optional(),
	reason: enumType(["demo-expired"]).optional(),
	error: stringType().optional(),
	error_description: stringType().optional(),
	provider: stringType().optional()
});
var Route = createFileRoute("/auth")({
	validateSearch: searchSchema,
	beforeLoad: async ({ search }) => {
		if (typeof window === "undefined") return;
		if (!getSupabaseBrowserConfiguration().configured) return;
		const { data } = await supabase.auth.getSession();
		if (data.session) throw redirect({ to: safeNext(search.next) ?? "/home" });
	},
	head: () => ({ meta: [
		{ title: "Sign in — CARCC CADANE" },
		{
			name: "description",
			content: "Sign in to your CARCC CADANE workspace."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as n, LegalDialog as t };
