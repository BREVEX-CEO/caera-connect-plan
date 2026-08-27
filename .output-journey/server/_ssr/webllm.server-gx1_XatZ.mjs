//#region node_modules/.nitro/vite/services/ssr/assets/webllm.server-gx1_XatZ.js
var browserOnly = () => {
	throw new Error("OCADE WebLLM is available only inside a user's browser.");
};
var prebuiltAppConfig = { model_list: [] };
var CreateWebWorkerMLCEngine = browserOnly;
//#endregion
export { CreateWebWorkerMLCEngine, prebuiltAppConfig };
