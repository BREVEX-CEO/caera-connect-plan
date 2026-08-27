import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-appearance-DRtxpe7r.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var ThemeContext = (0, import_react.createContext)(null);
function useAppearance() {
	const ctx = (0, import_react.useContext)(ThemeContext);
	if (!ctx) throw new Error("useAppearance must be used inside <ThemeProvider>");
	return ctx;
}
//#endregion
export { useAppearance as n, ThemeContext as t };
