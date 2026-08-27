import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-demo-Cag2FHQT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var DemoContext = (0, import_react.createContext)(null);
function useDemo() {
	const value = (0, import_react.useContext)(DemoContext);
	if (!value) throw new Error("useDemo must be used inside DemoProvider (route under /demo/*).");
	return value;
}
//#endregion
export { useDemo as n, DemoContext as t };
