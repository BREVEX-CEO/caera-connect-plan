import { o as require_jsx_runtime } from "./_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./_ssr/client-D46NpEQY.mjs";
import { N as redirect, h as createFileRoute, m as lazyRouteComponent } from "./_libs/@tanstack/react-router+[...].mjs";
import { Wt as LoaderCircle } from "./_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_._lovable.oauth.consent-CQgZlkXy.js
var import_jsx_runtime = require_jsx_runtime();
function oauth() {
	return supabase.auth.oauth;
}
var $$splitErrorComponentImporter = () => import("./_._lovable.oauth.consent-BrMv-P1V.mjs");
var $$splitComponentImporter = () => import("./_._lovable.oauth.consent-CcabBPYw.mjs");
var Route$1 = createFileRoute("/.lovable/oauth/consent")({
	ssr: false,
	validateSearch: (s) => ({ authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "" }),
	beforeLoad: async ({ search, location }) => {
		if (!search.authorization_id) throw new Error("Missing authorization_id");
		const { data } = await supabase.auth.getSession();
		const next = location.pathname + location.searchStr;
		if (!data.session) throw redirect({
			to: "/auth",
			search: { next }
		});
	},
	loader: async ({ location }) => {
		const authorizationId = new URLSearchParams(location.search).get("authorization_id");
		const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
		if (error) throw error;
		const immediate = data?.redirect_url ?? data?.redirect_to;
		if (immediate && !data?.client) throw redirect({ href: immediate });
		return data;
	},
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	pendingComponent: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		role: "status",
		"aria-live": "polite",
		className: "mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
			className: "h-5 w-5 animate-spin text-muted-foreground",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "Checking this authorization request…"
		})]
	}),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter, "errorComponent")
});
//#endregion
export { oauth as n, Route$1 as t };
