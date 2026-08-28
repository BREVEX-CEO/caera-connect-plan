//#region node_modules/.nitro/vite/services/ssr/assets/universe-CvRdDAaW.js
/**
* Eight, and only eight.
*
* The count is fixed because the composition depends on it: eight orbits at
* these radii fill the frame without crowding, and a ninth would either
* overlap or push the outermost off screen on a laptop.
*/
var PLANETS = [
	{
		id: "chat",
		name: "Chat",
		benefit: "Ask anything. OCADE generates replies on this device, subject to local engine support.",
		orbit: 1.9,
		speed: .132,
		phase: 0,
		size: .2,
		tilt: .06,
		hue: 88,
		spin: .62,
		axialTilt: .1,
		atmosphere: .55
	},
	{
		id: "files",
		name: "Files",
		benefit: "Attach a 200-page report. OCADE searches it and reads only the parts that matter.",
		orbit: 2.5,
		speed: .104,
		phase: .9,
		size: .17,
		tilt: -.13,
		hue: 152,
		spin: -.44,
		axialTilt: .22,
		atmosphere: .3
	},
	{
		id: "vision",
		name: "Vision",
		benefit: "Drop in a screenshot. OCADE reads it on-device when a supported local vision model is ready.",
		orbit: 3.1,
		speed: -.086,
		phase: 1.9,
		size: .15,
		tilt: .19,
		hue: 232,
		spin: .78,
		axialTilt: .06,
		atmosphere: .72
	},
	{
		id: "links",
		name: "Links",
		benefit: "Capture a page once, and keep reading it after the connection is gone.",
		orbit: 3.7,
		speed: .072,
		phase: 2.7,
		size: .16,
		tilt: -.08,
		hue: 268,
		spin: .51,
		axialTilt: .28,
		atmosphere: .24
	},
	{
		id: "voice",
		name: "Voice",
		benefit: "Speak instead of typing — in Hindi, Tamil, English and more, if your device can.",
		orbit: 4.3,
		speed: -.061,
		phase: 3.6,
		size: .14,
		tilt: .24,
		hue: 12,
		spin: .86,
		axialTilt: .14,
		atmosphere: .62
	},
	{
		id: "projects",
		name: "Projects",
		benefit: "Group conversations and files so context follows the work, not the tab.",
		orbit: 4.9,
		speed: .053,
		phase: 4.4,
		size: .18,
		tilt: -.17,
		hue: 42,
		spin: -.37,
		axialTilt: .19,
		atmosphere: .4
	},
	{
		id: "offline",
		name: "Offline intelligence",
		benefit: "Download a supported local engine for offline work; sign-in, private sync and live web still need a network.",
		orbit: 5.6,
		speed: -.045,
		phase: 5.2,
		size: .21,
		tilt: .11,
		hue: 188,
		spin: .29,
		axialTilt: .33,
		atmosphere: .85
	},
	{
		id: "automations",
		name: "Automations",
		benefit: "Repeat work on a schedule, with a preview and a stop button before anything runs.",
		orbit: 6.3,
		speed: .038,
		phase: 6,
		size: .16,
		tilt: -.22,
		hue: 320,
		spin: .68,
		axialTilt: .08,
		atmosphere: .36
	}
];
Array.from({ length: 8 }, (_, i) => [i, (i + 1) % 8]);
var INTRO_SEEN_KEY = "caera:landing:intro:v1";
/** Milliseconds from the start of the intro at which each phase begins. */
var INTRO_TIMELINE = {
	wordmark: 0,
	established: 1400,
	ignition: 2900,
	ambient: 5200
};
function introPhaseAt(elapsedMs) {
	if (elapsedMs >= INTRO_TIMELINE.ambient) return "ambient";
	if (elapsedMs >= INTRO_TIMELINE.ignition) return "ignition";
	if (elapsedMs >= INTRO_TIMELINE.established) return "established";
	return "wordmark";
}
/**
* Has this browser already watched the opening?
*
* Once per device, remembered in `localStorage`. A cinematic that replays on
* every visit stops being cinematic by the third time and starts being an
* obstacle between someone and the button they came to press — which is also
* why the actions stay visible THROUGH the intro rather than after it.
*/
function introSeen(storage) {
	const store = storage ?? safeLocal();
	try {
		return store?.getItem(INTRO_SEEN_KEY) === "1";
	} catch {
		return false;
	}
}
function markIntroSeen(storage) {
	const store = storage ?? safeLocal();
	try {
		store?.setItem(INTRO_SEEN_KEY, "1");
	} catch {}
}
function forgetIntro(storage) {
	const store = storage ?? safeLocal();
	try {
		store?.removeItem(INTRO_SEEN_KEY);
	} catch {}
}
function safeLocal() {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}
/**
* How much to draw, decided from what the device can carry.
*
* `prefers-reduced-motion` is absolute and wins over everything: someone who
* has asked their operating system to stop animations has usually done it
* because animation makes them ill, and a landing page is not the place to
* second-guess that.
*/
function chooseRenderTier(input) {
	if (input.reducedMotion) return "static";
	if (input.droppedFrames) return "reduced";
	const cores = input.cores ?? 4;
	const memory = input.memoryGb ?? 4;
	if (cores <= 2 || memory <= 2) return "reduced";
	if (input.viewportWidth < 640 && cores <= 4) return "reduced";
	return "full";
}
/** Star count for a tier. Zero on static: a still field is just noise. */
function starCountFor(tier) {
	switch (tier) {
		case "full": return 520;
		case "reduced": return 160;
		default: return 0;
	}
}
//#endregion
export { introSeen as a, introPhaseAt as i, chooseRenderTier as n, markIntroSeen as o, forgetIntro as r, starCountFor as s, PLANETS as t };
