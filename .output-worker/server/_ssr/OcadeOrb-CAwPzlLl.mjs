import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/OcadeOrb-CAwPzlLl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SILVER = [
	.82,
	.84,
	.88
];
var GOLD = [
	.87,
	.68,
	.31
];
var AUBERGINE = [
	.45,
	.25,
	.55
];
var CRIMSON = [
	.72,
	.19,
	.31
];
var ASH = [
	.38,
	.39,
	.42
];
var ORB_APPEARANCE = {
	idle: {
		core: SILVER,
		rim: AUBERGINE,
		energy: .18,
		pulseHz: .22,
		turbulence: .1,
		scale: 1,
		label: "Ready"
	},
	listening: {
		core: SILVER,
		rim: GOLD,
		energy: .42,
		pulseHz: .5,
		turbulence: .16,
		scale: 1.12,
		label: "Listening"
	},
	thinking: {
		core: AUBERGINE,
		rim: SILVER,
		energy: .6,
		pulseHz: 1.1,
		turbulence: .42,
		scale: .97,
		label: "Thinking"
	},
	speaking: {
		core: SILVER,
		rim: GOLD,
		energy: .55,
		pulseHz: 1.6,
		turbulence: .22,
		scale: 1.05,
		label: "Speaking"
	},
	acting: {
		core: CRIMSON,
		rim: GOLD,
		energy: .9,
		pulseHz: 2.1,
		turbulence: .55,
		scale: .92,
		label: "Working on your computer"
	},
	approval: {
		core: GOLD,
		rim: GOLD,
		energy: .5,
		pulseHz: .75,
		turbulence: .12,
		scale: 1.08,
		label: "Waiting for you"
	},
	paused: {
		core: ASH,
		rim: SILVER,
		energy: .12,
		pulseHz: .15,
		turbulence: .05,
		scale: .98,
		label: "Paused"
	},
	takeover: {
		core: ASH,
		rim: AUBERGINE,
		energy: .2,
		pulseHz: .3,
		turbulence: .08,
		scale: .95,
		label: "You have the controls"
	},
	stopped: {
		core: ASH,
		rim: ASH,
		energy: 0,
		pulseHz: 0,
		turbulence: 0,
		scale: .9,
		label: "Stopped"
	},
	error: {
		core: CRIMSON,
		rim: CRIMSON,
		energy: .35,
		pulseHz: .4,
		turbulence: .3,
		scale: 1,
		label: "Something went wrong"
	}
};
function qualityFor(environment) {
	if (environment.reducedMotion) return "still";
	if (!environment.webglAvailable) return "simple";
	if (environment.lowEndDevice) return "simple";
	if (environment.smallViewport) return "simple";
	return "full";
}
function orbFrameAt(state, seconds, options = {}) {
	const look = ORB_APPEARANCE[state];
	if ((options.quality ?? "full") === "still" || look.energy === 0) return {
		core: look.core,
		rim: look.rim,
		radius: look.scale,
		turbulence: 0,
		glow: look.energy * .5,
		label: look.label
	};
	const amplitude = clamp01(options.amplitude ?? 0);
	const drive = state === "listening" || state === "speaking" ? Math.max(look.energy * .45, amplitude) : look.energy;
	const breath = Math.sin(seconds * look.pulseHz * Math.PI * 2);
	const radius = look.scale * (1 + breath * .06 * drive);
	const turbulence = look.turbulence * (.7 + .3 * (breath * .5 + .5));
	const glow = clamp01(drive * (.55 + .45 * (breath * .5 + .5)));
	return {
		core: look.core,
		rim: look.rim,
		radius,
		turbulence,
		glow,
		label: look.label
	};
}
function clamp01(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}
/**
* The orb state for what the runtime is doing.
*
* Cowork reports nine internal phases and Chat reports its own; both map here
* so the orb never has two vocabularies. `observing` becomes `thinking` rather
* than `acting` on purpose: reading the screen changes nothing, and colouring
* it crimson would spend the alarm on the safe half of the loop.
*/
function orbStateFor(input) {
	if (input.awaitingApproval) return "approval";
	if (input.userHasControl) return "takeover";
	switch (input.phase) {
		case "listening": return "listening";
		case "thinking":
		case "observing": return "thinking";
		case "speaking": return "speaking";
		case "controlling":
		case "acting": return "acting";
		case "paused": return "paused";
		case "stopped": return "stopped";
		case "error": return "error";
		default: return "idle";
	}
}
/**
* The OCADE orb.
*
* One component, every surface. Chat, Cowork, the composer and the mobile bar
* all render this at different sizes, because "what is OCADE doing" is one
* question and a person who learns the answer in one room must not have to
* learn it again in another.
*
* WHY THE RENDERER IS LOADED RATHER THAN IMPORTED
* -----------------------------------------------
* The renderer carries a raymarching shader, a WebGL setup path and a 2D
* painter. None of it is needed until something is happening: Chat's first
* paint is a text box, and shipping a sphere renderer to a person who has not
* typed anything is bytes spent before the product has done anything.
*
* The placeholder below is a plain circle in the state's own colour, drawn with
* CSS. It appears for the frame or two the chunk takes and reads as the same
* object arriving rather than as a spinner being replaced.
*
* IT IS TEXT AS WELL AS A PICTURE, ALWAYS. The orb carries a live region with
* the state's label, so a screen-reader user hears "Working on your computer"
* at the moment a sighted user sees crimson. A status indicator that exists
* only as colour and motion is not a status indicator for everybody.
*/
var OcadeOrbCanvas = (0, import_react.lazy)(() => import("./OcadeOrbCanvas-LYUGgkRP.mjs").then((module) => ({ default: module.OcadeOrbCanvas })));
function OcadeOrb({ state, amplitude = 0, size = 96, className, decorative = false }) {
	const look = ORB_APPEARANCE[state];
	const label = (0, import_react.useMemo)(() => look.label, [look.label]);
	const placeholder = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		"aria-hidden": true,
		className: "block rounded-full",
		style: {
			width: size,
			height: size,
			background: `radial-gradient(circle at 35% 32%, rgb(${to255(look.core)} / 0.95), rgb(${to255(look.core)} / 0.35) 62%, transparent 72%)`
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("relative inline-flex shrink-0", className),
		style: {
			width: size,
			height: size
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
			fallback: placeholder,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeOrbCanvas, {
				state,
				amplitude,
				size,
				decorative: true
			})
		}), decorative ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			role: "status",
			"aria-live": "polite",
			className: "sr-only",
			children: label
		})]
	});
}
function to255(colour) {
	return colour.map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255)).join(" ");
}
//#endregion
export { qualityFor as a, orbStateFor as i, OcadeOrb as n, orbFrameAt as r, ORB_APPEARANCE as t };
