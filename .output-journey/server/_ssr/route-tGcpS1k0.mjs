import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link, b as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as reportRuntimeError } from "./runtime-error-reporting-hYG2bZLi.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-tGcpS1k0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Integration-managed protected layout. Runs client-only because the Supabase
* session lives in localStorage. All routes under src/routes/_authenticated/
* inherit this gate, plus the onboarding gate below.
*/
function AuthedError({ error, reset }) {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportRuntimeError(error, { boundary: "authenticated_route" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: error.message || "Something went wrong loading this section of your workspace."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/home",
						className: "rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent",
						children: "Back to Home"
					})]
				})
			]
		})
	});
}
//#endregion
export { AuthedError as errorComponent };
