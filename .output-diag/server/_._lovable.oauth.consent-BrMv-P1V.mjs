import { o as require_jsx_runtime } from "./_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_._lovable.oauth.consent-BrMv-P1V.js
var import_jsx_runtime = require_jsx_runtime();
var SplitErrorComponent = ({ error }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
	className: "mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-8",
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
		className: "text-lg font-medium",
		children: "Authorization request unavailable"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: String(error?.message ?? error)
	})]
});
//#endregion
export { SplitErrorComponent as errorComponent };
