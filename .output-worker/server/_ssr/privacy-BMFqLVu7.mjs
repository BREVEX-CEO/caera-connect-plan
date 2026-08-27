import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as PublicPage } from "./PublicPage-CTc9xZld.mjs";
import { n as PrivacyContent, t as PRIVACY_META } from "./LegalContent-DdyAlKW4.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/privacy-BMFqLVu7.js
var import_jsx_runtime = require_jsx_runtime();
function PrivacyPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicPage, {
		eyebrow: PRIVACY_META.eyebrow,
		title: PRIVACY_META.title,
		summary: PRIVACY_META.summary,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivacyContent, {})
	});
}
//#endregion
export { PrivacyPage as component };
