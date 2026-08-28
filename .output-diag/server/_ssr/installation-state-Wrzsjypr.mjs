//#region node_modules/.nitro/vite/services/ssr/assets/installation-state-Wrzsjypr.js
var IDLE_INSTALL_STATE = {
	stage: "idle",
	fraction: null,
	etaSeconds: null,
	detail: null,
	problem: null,
	remedies: [],
	observing: false,
	retries: 0,
	path: null
};
var current = IDLE_INSTALL_STATE;
var listeners = /* @__PURE__ */ new Set();
/** The current state. A stable reference between changes, as the store hook needs. */
function installState() {
	return current;
}
function subscribeToInstallState(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
/**
* Publish a new state.
*
* CALLED ONLY BY THE AUTHORITY. A second writer would recreate exactly the
* defect this whole change removed: two things with opinions about whether
* OCADE is preparing, and a screen able to render both at once.
*/
function publishInstallState(state) {
	if (state === current) return;
	current = state;
	for (const listener of listeners) listener(state);
}
/**
* One short sentence for a person, derived from the state.
*
* PRODUCT LANGUAGE ONLY. Never a model name, a vendor, a file name, a
* quantisation, a parameter count, a download size, or the words WebGPU or
* WebAssembly. Somebody meeting OCADE for the first time is not debugging a
* runtime, and a first-run screen that names a third party's model is telling
* the user something about OCADE that OCADE does not want to say.
*/
function describeInstall(state) {
	if (state.problem && isErrorStage(state.stage)) return state.problem;
	switch (state.stage) {
		case "idle": return "Starting OCADE…";
		case "checking_device": return "Preparing this device…";
		case "checking_storage": return "Preparing this device…";
		case "preparing_runtime": return "Optimising for this device…";
		case "waiting_for_source": return "Preparing OCADE…";
		case "downloading": {
			const pct = state.fraction === null ? null : Math.round(state.fraction * 100);
			return pct === null ? "Preparing OCADE…" : `Preparing OCADE — ${pct}%`;
		}
		case "paused": return state.detail ?? "Preparation paused.";
		case "retrying": return "Reconnecting — OCADE will carry on from where it stopped…";
		case "verifying": return "Securing local intelligence…";
		case "loading": return "Starting OCADE…";
		case "warming": return "Almost ready…";
		case "ready": return "OCADE is ready.";
		case "repairing": return "Checking this device…";
		case "insufficient_storage": return "OCADE needs more local storage on this device.";
		case "recoverable_error": return state.problem ?? "OCADE could not finish preparing this device.";
		case "fatal_error": return state.problem ?? "OCADE cannot run its intelligence on this device.";
	}
}
function isErrorStage(stage) {
	return stage === "insufficient_storage" || stage === "recoverable_error" || stage === "fatal_error";
}
/** True while setup is genuinely in progress — the setup screen's condition. */
function isPreparing(stage) {
	return stage === "checking_device" || stage === "checking_storage" || stage === "preparing_runtime" || stage === "waiting_for_source" || stage === "downloading" || stage === "retrying" || stage === "verifying" || stage === "loading" || stage === "warming" || stage === "repairing";
}
//#endregion
export { isPreparing as a, isErrorStage as i, describeInstall as n, publishInstallState as o, installState as r, subscribeToInstallState as s, IDLE_INSTALL_STATE as t };
