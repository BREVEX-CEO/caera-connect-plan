import { h as createFileRoute, m as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as stringType, o as objectType } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.callback-BAMtjFHt.js
var $$splitComponentImporter = () => import("./auth.callback-C0xVfg2q.mjs");
var searchSchema = objectType({
	next: stringType().optional(),
	code: stringType().optional(),
	state: stringType().optional(),
	error: stringType().optional(),
	error_description: stringType().optional()
});
var Route = createFileRoute("/auth/callback")({
	ssr: false,
	validateSearch: searchSchema,
	head: () => ({ meta: [{ title: "Signing you in — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
