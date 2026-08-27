//#region node_modules/.nitro/vite/services/ssr/assets/ocade-identity-BWv-E_0R.js
/**
* OCADE Identity Contract (Plan §12).
*
* The assistant is always presented as "OCADE by CARCC CADANE" in conversation
* UI. Provider identity (OpenAI, Ollama, etc.) is NEVER falsified — it is
* hidden from casual chat but visible in Model Settings, usage records, and
* technical diagnostics, and OCADE truthfully names the selected model when
* directly asked.
*
* This module is the single source of truth for identity strings. Every
* assistant surface (chat header, voice intro, disclosure banner, model
* picker) must import from here.
*/
var OCADE_IDENTITY = {
	displayName: "OCADE",
	vendor: "CARCC CADANE",
	fullName: "OCADE by CARCC CADANE",
	tagline: "Your CARCC CADANE assistant"
};
/**
* Confirmed creator wording (decision #1). Truthful about the OCADE PRODUCT —
* never implies CARCC CADANE trained a third-party foundation model.
*/
function ocadeCreatorStatement() {
	return `I am OCADE, developed and created by ${OCADE_IDENTITY.vendor}.`;
}
/**
* Casual introduction — used in chat greetings, voice hellos, empty states.
* Must never leak provider identity.
*/
function ocadeIntro() {
	return `I'm ${OCADE_IDENTITY.fullName}.`;
}
/**
* Ordinary-chat identity line (decisions #10, #18). Truthful but expressed in
* OCADE capability terms — it never prints the raw runtime/provider/model name.
* The exact model stays available in advanced/technical settings only.
*/
function ocadeChatCapabilityDisclosure(capabilityLabel) {
	return `${ocadeCreatorStatement()} For this request I'm using ${capabilityLabel}. Exact technical details are in advanced settings.`;
}
//#endregion
export { ocadeChatCapabilityDisclosure as n, ocadeIntro as r, OCADE_IDENTITY as t };
