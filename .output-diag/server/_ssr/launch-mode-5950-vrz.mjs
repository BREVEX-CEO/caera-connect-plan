import { n as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/launch-mode-5950-vrz.js
var launch_mode_5950_vrz_exports = /* @__PURE__ */ __exportAll({
	n: () => billingEnabled,
	r: () => launch_mode_exports,
	t: () => FREE_LAUNCH_NOTICE
});
var launch_mode_exports = /* @__PURE__ */ __exportAll$1({
	FREE_LAUNCH_MODE: () => true,
	FREE_LAUNCH_NOTICE: () => FREE_LAUNCH_NOTICE,
	billingEnabled: () => billingEnabled
});
/** True only when an operation may initialize billing or checkout. */
function billingEnabled() {
	return false;
}
/** One sentence for any surface that has to explain the absence of pricing. */
var FREE_LAUNCH_NOTICE = "OCADE is free for every signed-in account during launch. There is nothing to buy, and no plan limits your access to implemented features.";
//#endregion
export { billingEnabled as n, launch_mode_5950_vrz_exports as r, FREE_LAUNCH_NOTICE as t };
