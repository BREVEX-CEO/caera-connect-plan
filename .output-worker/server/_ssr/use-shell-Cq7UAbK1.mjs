import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-shell-Cq7UAbK1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var ShellContext = (0, import_react.createContext)(null);
/**
* Safe accessor — returns null outside a ShellProvider so pages that render
* standalone (auth, onboarding, marketing) don't crash.
*/
function useShell() {
	return (0, import_react.useContext)(ShellContext);
}
//#endregion
export { useShell as n, ShellContext as t };
