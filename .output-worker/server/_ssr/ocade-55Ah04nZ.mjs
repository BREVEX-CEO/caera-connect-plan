import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { p as Outlet } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as AppShell } from "./AppShell-DYEjrpCe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-55Ah04nZ.js
var import_jsx_runtime = require_jsx_runtime();
/**
* One shell for every OCADE screen.
*
* Pages used to wrap themselves in `AppShell` individually, so any page that
* forgot lost the sidebar, top bar and module rail entirely. The layout owns
* the chrome now; children render page content only.
*/
function OcadeLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) });
}
//#endregion
export { OcadeLayout as component };
