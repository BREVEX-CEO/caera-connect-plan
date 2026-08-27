import { h as createFileRoute, m as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as objectType, r as enumType } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pricing-DvtKPwMk.js
var $$splitComponentImporter = () => import("./pricing-CenZVdnE.mjs");
var searchSchema = objectType({
	source: enumType([
		"web",
		"desktop",
		"mobile"
	]).optional(),
	plan: enumType([
		"std_8d",
		"month_1m",
		"year_1y"
	]).optional()
});
var Route = createFileRoute("/pricing")({
	validateSearch: searchSchema,
	head: () => ({ meta: [{ title: "OCADE pricing — India and international plans" }, {
		name: "description",
		content: "Pre-launch OCADE plan pricing in INR and international currencies, with planned UPI, card and PayPal checkout."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
