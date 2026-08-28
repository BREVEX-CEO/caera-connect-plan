import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-settings-access-CqrFa1Nj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var SettingsAccessContext = (0, import_react.createContext)({
	canEdit: false,
	reason: "Sign in to change this setting."
});
function useSettingsAccess() {
	return (0, import_react.useContext)(SettingsAccessContext);
}
//#endregion
export { useSettingsAccess as n, SettingsAccessContext as t };
