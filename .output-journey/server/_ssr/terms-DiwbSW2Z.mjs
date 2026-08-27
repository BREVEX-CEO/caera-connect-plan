import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as PublicPage } from "./PublicPage-CTc9xZld.mjs";
import { i as TermsContent, r as TERMS_META } from "./LegalContent-DdyAlKW4.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/terms-DiwbSW2Z.js
var import_jsx_runtime = require_jsx_runtime();
function TermsPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicPage, {
		eyebrow: TERMS_META.eyebrow,
		title: TERMS_META.title,
		summary: TERMS_META.summary,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TermsContent, {})
	});
}
//#endregion
export { TermsPage as component };
