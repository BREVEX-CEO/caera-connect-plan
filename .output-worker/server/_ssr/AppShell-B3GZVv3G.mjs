import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as WorkspaceShell } from "./WorkspaceShell-CPYZEH23.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AppShell-B3GZVv3G.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Compatibility wrapper. `WorkspaceShell` is now the single OCADE shell
* (Plan §37); every authenticated page keeps importing `AppShell` and renders
* the unified shell without any call-site change.
*/
function AppShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspaceShell, {
		variant: "app",
		children
	});
}
//#endregion
export { AppShell as t };
