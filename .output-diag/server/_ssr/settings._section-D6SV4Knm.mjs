import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { h as createFileRoute, m as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as findSection } from "./settings-sections-B_Tmz4a1.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings._section-D6SV4Knm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var DepthContext = (0, import_react.createContext)({
	mode: "flat",
	enabled: false,
	interactive: false
});
function useDepth() {
	return (0, import_react.useContext)(DepthContext);
}
var $$splitComponentImporter = () => import("./settings._section-B1qxB8HE.mjs");
/**
* Settings sections that are REAL and rendered here rather than falling through
* to the Setup-Required state. Keep in sync with settings-sections.ts statuses.
*/
var Route = createFileRoute("/_authenticated/settings/$section")({
	head: ({ params }) => {
		return { meta: [{ title: `${findSection(params.section)?.item.label ?? "Settings"} — CARCC CADANE` }, {
			name: "robots",
			content: "noindex"
		}] };
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as n, useDepth as r, DepthContext as t };
