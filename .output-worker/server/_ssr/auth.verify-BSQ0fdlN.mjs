import { h as createFileRoute, m as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as stringType, o as objectType, r as enumType } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.verify-BSQ0fdlN.js
var $$splitComponentImporter = () => import("./auth.verify-CHXVts-L.mjs");
var searchSchema = objectType({
	channel: enumType(["phone", "email"]),
	identifier: stringType().min(1),
	next: stringType().optional(),
	intent: enumType(["signin", "signup"]).optional()
});
var Route = createFileRoute("/auth/verify")({
	ssr: false,
	validateSearch: searchSchema,
	head: () => ({ meta: [{ title: "Enter your code — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
