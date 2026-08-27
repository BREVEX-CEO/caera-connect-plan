//#region node_modules/.nitro/vite/services/ssr/assets/perf-fallback-BFzNUEP9.js
/**
* Judge the machine from what the browser will tell us before rendering.
*
* Thresholds are deliberately conservative: four cores or less, or 4 GB or
* less of reported memory, is where the layered-blur composite starts costing
* more than one frame on the hardware we have measured. Unknown values are
* treated as capable — guessing "slow" from missing data would step down every
* Safari and Firefox visitor, who report neither.
*/
function assessDevice(signals) {
	if (signals.saveData) return {
		lowEnd: true,
		reason: "your browser is asking sites to use less data and power"
	};
	if (typeof signals.memoryGb === "number" && signals.memoryGb > 0 && signals.memoryGb <= 4) return {
		lowEnd: true,
		reason: `this device reports ${signals.memoryGb} GB of memory`
	};
	if (typeof signals.cores === "number" && signals.cores > 0 && signals.cores <= 4) return {
		lowEnd: true,
		reason: `this device reports ${signals.cores} processor core${signals.cores === 1 ? "" : "s"}`
	};
	return {
		lowEnd: false,
		reason: null
	};
}
/** Read the signals from the live browser. Safe to call during SSR. */
function readDeviceSignals() {
	if (typeof navigator === "undefined") return {};
	const nav = navigator;
	return {
		cores: nav.hardwareConcurrency,
		memoryGb: nav.deviceMemory,
		saveData: nav.connection?.saveData === true,
		viewportWidth: typeof window === "undefined" ? void 0 : window.innerWidth
	};
}
/**
* Exactly what the fallback turns down.
*
* Kept as data so the notice, the tests and any future surface all quote the
* same list. Nothing here removes a control, hides content or changes a
* colour — that distinction is the point of the copy.
*/
var FALLBACK_CHANGES = [
	"Background blur on panels is switched off, so surfaces paint in one pass.",
	"The animated landing scene and ambient glow stop; a still frame stays in place.",
	"Pointer-following depth and the cursor trail are disabled.",
	"Long transitions are shortened. Text, colour, contrast and every control are unchanged."
];
/** One sentence naming the trigger, for the top of the notice. */
function describeTrigger(trigger, reason) {
	if (trigger === "frames") return "OCADE measured dropped frames while the interface was animating, so it stepped the visuals down to keep scrolling and typing responsive.";
	return `OCADE stepped the visuals down before drawing because ${reason ?? "this device reported limited resources"}.`;
}
//#endregion
export { readDeviceSignals as i, assessDevice as n, describeTrigger as r, FALLBACK_CHANGES as t };
