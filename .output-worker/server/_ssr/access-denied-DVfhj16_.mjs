import { h as createFileRoute, m as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as stringType, o as objectType } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access-denied-DVfhj16_.js
var $$splitComponentImporter = () => import("./access-denied-CfLoPsNc.mjs");
var searchSchema = objectType({
	area: stringType().optional(),
	reason: stringType().optional()
});
var Route = createFileRoute("/_authenticated/access-denied")({
	ssr: false,
	validateSearch: searchSchema,
	head: () => ({ meta: [
		{ title: "Access denied — CARCC CADANE" },
		{
			name: "description",
			content: "You do not have permission to open this area of your CARCC CADANE workspace."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
