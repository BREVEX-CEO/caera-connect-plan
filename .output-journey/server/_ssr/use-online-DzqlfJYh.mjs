import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-online-DzqlfJYh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* Reactive online/offline state (Plan §34). Drives the offline indicator and
* local-first routing decisions in the chat UI.
*/
function useOnline() {
	const [online, setOnline] = (0, import_react.useState)(() => typeof navigator === "undefined" ? true : navigator.onLine);
	(0, import_react.useEffect)(() => {
		const on = () => setOnline(true);
		const off = () => setOnline(false);
		window.addEventListener("online", on);
		window.addEventListener("offline", off);
		setOnline(navigator.onLine);
		return () => {
			window.removeEventListener("online", on);
			window.removeEventListener("offline", off);
		};
	}, []);
	return online;
}
//#endregion
export { useOnline as t };
