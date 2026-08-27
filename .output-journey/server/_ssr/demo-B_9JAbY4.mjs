import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { p as Outlet, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as endSession } from "./session-BA6zzQzb.mjs";
import { t as DemoContext } from "./use-demo-Cag2FHQT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/demo-B_9JAbY4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DEMO_FLAG_KEY = "caera:demo";
function readFlag() {
	if (typeof window === "undefined") return false;
	try {
		return window.sessionStorage.getItem(DEMO_FLAG_KEY) === "1";
	} catch {
		return false;
	}
}
function writeFlag(active) {
	if (typeof window === "undefined") return;
	try {
		if (active) window.sessionStorage.setItem(DEMO_FLAG_KEY, "1");
		else window.sessionStorage.removeItem(DEMO_FLAG_KEY);
	} catch {}
}
/**
* Marks the browser as being in demo mode, and owns the way out.
*
* WHAT THIS NO LONGER HOLDS: a fictional company's invoices, timesheets, tasks,
* files and message threads. Those belonged to demo screens for products that
* have been removed, and to a chat that answered from a fixed string.
*
* The conversation is deliberately NOT here either. It lives in the demo
* route's own state, because a demo conversation that survived a provider
* re-render — or a trip to settings and back — would outlive the 28-minute
* session it belongs to. Temporary has to mean temporary.
*/
function DemoProvider({ children }) {
	const navigate = useNavigate();
	const [active, setActive] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		writeFlag(true);
		setActive(true);
	}, []);
	const exit = (0, import_react.useCallback)(() => {
		endSession();
		writeFlag(false);
		setActive(false);
		navigate({
			to: "/",
			replace: true
		});
	}, [navigate]);
	const reset = (0, import_react.useCallback)(() => {
		if (typeof window !== "undefined") window.location.assign("/demo/ocade");
	}, []);
	const value = (0, import_react.useMemo)(() => ({
		active: active || readFlag(),
		reset,
		exit
	}), [
		active,
		reset,
		exit
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoContext.Provider, {
		value,
		children
	});
}
function DemoLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) });
}
//#endregion
export { DemoLayout as component };
