import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/LivingIntelligenceBackdrop-BOL1501k.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* One band's height at a horizontal position, in normalised space.
*
* Pure, so the shape can be tested without a canvas. Two sine terms of
* different periods keep the crest from marching in lockstep, which is what
* makes a single sine read as a screensaver rather than as flow. `depth` moves
* the band in parallax — the near bands travel further under the pointer than
* the far ones, and that difference is the whole illusion of depth.
*/
function waveY(x01, depth, elapsed, tuning, pointerY = 0) {
	const travel = elapsed * tuning.waveSpeed;
	const primary = Math.sin(x01 * TAU * 1.15 + travel + depth * 1.7);
	const secondary = Math.sin(x01 * TAU * 2.3 - travel * .62 + depth * .9) * .45;
	const lean = pointerY * (.25 + depth * .75) * .6;
	return (primary + secondary) * tuning.waveAmplitude * (.55 + depth * .45) + lean;
}
/**
* Tuning is derived, never hand-set per surface, so Chat and Work cannot drift
* apart. `still` collapses both intensities to a painted-once scene: that is
* what reduced-motion and low-performance mode both get, and it is a real
* picture rather than a blank panel.
*/
function tuningFor(intensity, opts) {
	if (opts.highContrast) return {
		particles: 0,
		opacity: 0,
		spin: 0,
		breathe: 0,
		maxDpr: 1,
		waveLayers: 0,
		waveAmplitude: 0,
		waveSpeed: 0
	};
	const base = intensity === "cinematic" ? {
		particles: 90,
		opacity: .85,
		spin: .014,
		breathe: .03,
		maxDpr: 2,
		waveLayers: 5,
		waveAmplitude: .055,
		waveSpeed: .42
	} : {
		particles: 34,
		opacity: .38,
		spin: .008,
		breathe: .015,
		maxDpr: 1.5,
		waveLayers: 3,
		waveAmplitude: .035,
		waveSpeed: .28
	};
	if (opts.still) return {
		...base,
		particles: 0,
		spin: 0,
		breathe: 0,
		opacity: base.opacity * .8,
		maxDpr: 1,
		waveLayers: 0,
		waveAmplitude: 0,
		waveSpeed: 0
	};
	return base;
}
var TAU = Math.PI * 2;
/** Deterministic PRNG so a reload does not reshuffle the composition. */
function rng(seed) {
	let s = seed >>> 0;
	return () => {
		s = s * 1664525 + 1013904223 >>> 0;
		return s / 4294967296;
	};
}
/** Spiral point in unit space (centre at 0,0, rim at radius 1). */
function spiralPoint(t, turns, phase) {
	const clamped = Math.min(1, Math.max(0, t));
	const radius = Math.pow(1 - clamped, 1.6);
	const angle = clamped * turns * TAU + phase;
	return {
		x: Math.cos(angle) * radius,
		y: Math.sin(angle) * radius
	};
}
function paintStatic(ctx, w, h, intensity) {
	const cx = w * .5;
	const cy = h * .46;
	const R = Math.max(w, h) * .62;
	const rand = rng(20260817);
	const strong = intensity === "cinematic";
	ctx.clearRect(0, 0, w, h);
	const ground = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
	ground.addColorStop(0, "rgba(24, 30, 66, 0.85)");
	ground.addColorStop(.45, "rgba(12, 15, 34, 0.7)");
	ground.addColorStop(1, "rgba(4, 5, 12, 0)");
	ctx.fillStyle = ground;
	ctx.fillRect(0, 0, w, h);
	const orbs = [
		[
			cx - R * .55,
			cy - R * .3,
			R * .55,
			"rgba(110, 231, 183, 0.16)"
		],
		[
			cx + R * .5,
			cy + R * .34,
			R * .62,
			"rgba(167, 139, 250, 0.16)"
		],
		[
			cx + R * .15,
			cy - R * .5,
			R * .42,
			"rgba(34, 211, 238, 0.12)"
		]
	];
	for (const [ox, oy, orad, colour] of orbs) {
		const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, orad);
		g.addColorStop(0, colour);
		g.addColorStop(1, "rgba(0,0,0,0)");
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(ox, oy, orad, 0, TAU);
		ctx.fill();
	}
	const nodeCount = strong ? 46 : 28;
	const nodes = [];
	for (let i = 0; i < nodeCount; i++) nodes.push({
		x: rand() * w,
		y: rand() * h
	});
	ctx.lineWidth = 1;
	ctx.strokeStyle = strong ? "rgba(148, 197, 255, 0.10)" : "rgba(148, 197, 255, 0.06)";
	const linkDist = Math.min(w, h) * .22;
	for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
		const dx = nodes[i].x - nodes[j].x;
		const dy = nodes[i].y - nodes[j].y;
		if (dx * dx + dy * dy < linkDist * linkDist) {
			ctx.beginPath();
			ctx.moveTo(nodes[i].x, nodes[i].y);
			ctx.lineTo(nodes[j].x, nodes[j].y);
			ctx.stroke();
		}
	}
	ctx.fillStyle = strong ? "rgba(186, 230, 253, 0.20)" : "rgba(186, 230, 253, 0.12)";
	for (const n of nodes) {
		ctx.beginPath();
		ctx.arc(n.x, n.y, 1.2, 0, TAU);
		ctx.fill();
	}
	const arms = strong ? 5 : 3;
	for (let a = 0; a < arms; a++) {
		const phase = a / arms * TAU;
		ctx.beginPath();
		for (let s = 0; s <= 220; s++) {
			const p = spiralPoint(s / 220, 2.4, phase);
			const x = cx + p.x * R;
			const y = cy + p.y * R * .72;
			if (s === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.lineWidth = strong ? 1.6 : 1.1;
		ctx.strokeStyle = strong ? "rgba(99, 102, 241, 0.30)" : "rgba(99, 102, 241, 0.18)";
		ctx.stroke();
	}
	const throat = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .22);
	throat.addColorStop(0, strong ? "rgba(56, 189, 248, 0.28)" : "rgba(56, 189, 248, 0.14)");
	throat.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = throat;
	ctx.beginPath();
	ctx.arc(cx, cy, R * .22, 0, TAU);
	ctx.fill();
}
/**
* Build a scene bound to a live canvas. Returns null when 2D is unavailable —
* callers must treat that as "no backdrop", never as an error worth showing.
*/
function createScene(canvas, opts) {
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) return null;
	const { tuning, intensity } = opts;
	const makeLayer = opts.createLayer ?? ((w, h) => {
		if (typeof document === "undefined") return null;
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		return c;
	});
	let dpr = 1;
	let width = 0;
	let height = 0;
	let layer = null;
	let pointerX = 0;
	let pointerY = 0;
	let easedX = 0;
	let easedY = 0;
	let lastElapsed = 0;
	const rand = rng(991);
	const particles = Array.from({ length: tuning.particles }, () => ({
		t: rand(),
		speed: .035 + rand() * .07,
		phase: rand() * TAU,
		radiusJitter: .9 + rand() * .22,
		hue: rand(),
		size: .9 + rand() * 1.6
	}));
	function resize(cssWidth, cssHeight) {
		const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
		dpr = Math.min(tuning.maxDpr, ratio);
		width = Math.max(1, Math.floor(cssWidth));
		height = Math.max(1, Math.floor(cssHeight));
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		layer = makeLayer(canvas.width, canvas.height);
		if (layer) {
			const lctx = layer.getContext("2d");
			if (lctx) {
				lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				paintStatic(lctx, width, height, intensity);
			}
		}
	}
	function frame(elapsed) {
		if (!ctx || width === 0 || height === 0) return;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.globalAlpha = tuning.opacity;
		if (layer) {
			const scale = 1 + Math.sin(elapsed * .35) * tuning.breathe;
			const angle = elapsed * tuning.spin;
			ctx.save();
			ctx.translate(canvas.width / 2, canvas.height * .46);
			ctx.rotate(angle);
			ctx.scale(scale, scale);
			ctx.drawImage(layer, -canvas.width / 2, -canvas.height * .46);
			ctx.restore();
		}
		if (tuning.waveLayers > 0) {
			const dt = Math.min(.05, Math.max(0, elapsed - lastElapsed));
			const k = 1 - Math.exp(-dt * 4);
			easedX += (pointerX - easedX) * k;
			easedY += (pointerY - easedY) * k;
			ctx.globalCompositeOperation = "lighter";
			for (let i = 0; i < tuning.waveLayers; i += 1) {
				const depth = tuning.waveLayers === 1 ? 1 : i / (tuning.waveLayers - 1);
				const baseline = canvas.height * (.6 + depth * .16);
				const shift = easedX * canvas.width * .035 * (.3 + depth * .7);
				ctx.beginPath();
				for (let n = 0; n <= 48; n += 1) {
					const x01 = n / 48;
					const y = waveY(x01, depth, elapsed, tuning, easedY);
					const px = x01 * canvas.width + shift;
					const py = baseline + y * canvas.height;
					if (n === 0) ctx.moveTo(px, py);
					else ctx.lineTo(px, py);
				}
				ctx.globalAlpha = tuning.opacity * (.1 + depth * .22);
				ctx.strokeStyle = depth > .6 ? "rgba(34, 211, 238, 0.95)" : "rgba(129, 140, 248, 0.95)";
				ctx.lineWidth = (.7 + depth * 1.4) * dpr;
				ctx.lineJoin = "round";
				ctx.stroke();
			}
			ctx.globalCompositeOperation = "source-over";
		}
		lastElapsed = elapsed;
		if (particles.length === 0) {
			ctx.globalAlpha = 1;
			return;
		}
		const cx = canvas.width / 2;
		const cy = canvas.height * .46;
		const R = Math.max(canvas.width, canvas.height) * .62;
		ctx.globalCompositeOperation = "lighter";
		for (const p of particles) {
			const t = (p.t + elapsed * p.speed) % 1;
			const head = spiralPoint(t, 2.4, p.phase);
			const tail = spiralPoint(Math.max(0, t - .035), 2.4, p.phase);
			const hx = cx + head.x * R * p.radiusJitter;
			const hy = cy + head.y * R * .72 * p.radiusJitter;
			const tx = cx + tail.x * R * p.radiusJitter;
			const ty = cy + tail.y * R * .72 * p.radiusJitter;
			const fade = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
			ctx.globalAlpha = tuning.opacity * fade * .75;
			ctx.strokeStyle = p.hue > .7 ? "rgba(167, 139, 250, 0.9)" : "rgba(34, 211, 238, 0.9)";
			ctx.lineWidth = p.size * dpr;
			ctx.lineCap = "round";
			ctx.beginPath();
			ctx.moveTo(tx, ty);
			ctx.lineTo(hx, hy);
			ctx.stroke();
		}
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 1;
	}
	return {
		frame,
		resize,
		/** Pointer position in -1..1. Ignored entirely when no bands are drawn. */
		setPointer: (nx, ny) => {
			pointerX = Math.max(-1, Math.min(1, nx));
			pointerY = Math.max(-1, Math.min(1, ny));
		},
		dispose: () => {
			layer = null;
		}
	};
}
/**
* The Living Intelligence backdrop.
*
* Decorative only: `aria-hidden`, no pointer events, always behind content. It
* carries no information, so a reader who never sees it loses nothing — which
* is the test any purely atmospheric surface has to pass in a product where
* the foreground includes a Stop button.
*
* IT YIELDS. Reduced motion (OS or app), low-performance mode, and a hidden
* tab each stop the loop; high contrast removes the backdrop entirely rather
* than dimming it, because "slightly less texture behind the text" is not what
* somebody asking for high contrast is asking for.
*
* `intensity="subtle"` is for reading surfaces (Chat). `"cinematic"` is for
* Control + Work, where the room should feel like a cockpit — but even there
* the controls above it are opaque, not glass.
*/
function LivingIntelligenceBackdrop({ intensity = "subtle", className }) {
	const canvasRef = (0, import_react.useRef)(null);
	const appearance = useAppearance();
	const still = appearance.reducedMotion || appearance.osReducedMotion || appearance.lowPerformance || appearance.perfFallback.active;
	const highContrast = appearance.highContrast;
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const tuning = tuningFor(intensity, {
			still,
			highContrast
		});
		if (tuning.opacity === 0) return;
		let scene = createScene(canvas, {
			intensity,
			tuning
		});
		if (!scene) return;
		const parent = canvas.parentElement;
		const measure = () => {
			const rect = parent?.getBoundingClientRect();
			scene?.resize(rect?.width ?? window.innerWidth, rect?.height ?? window.innerHeight);
		};
		measure();
		let raf = 0;
		let start = 0;
		const loop = (now) => {
			if (!start) start = now;
			scene?.frame((now - start) / 1e3);
			raf = requestAnimationFrame(loop);
		};
		const stop = () => {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
		};
		const play = () => {
			if (raf || still) return;
			raf = requestAnimationFrame(loop);
		};
		if (still) scene.frame(0);
		else play();
		const onPointer = (event) => {
			const rect = parent?.getBoundingClientRect();
			const w = rect?.width || window.innerWidth;
			const h = rect?.height || window.innerHeight;
			const left = rect?.left ?? 0;
			const top = rect?.top ?? 0;
			scene?.setPointer((event.clientX - left) / w * 2 - 1, (event.clientY - top) / h * 2 - 1);
		};
		if (!still) window.addEventListener("pointermove", onPointer, { passive: true });
		const onVisibility = () => {
			if (document.hidden) stop();
			else play();
		};
		document.addEventListener("visibilitychange", onVisibility);
		let ro = null;
		if (typeof ResizeObserver !== "undefined" && parent) {
			ro = new ResizeObserver(() => {
				measure();
				if (still) scene?.frame(0);
			});
			ro.observe(parent);
		} else window.addEventListener("resize", measure);
		return () => {
			window.removeEventListener("pointermove", onPointer);
			stop();
			document.removeEventListener("visibilitychange", onVisibility);
			if (ro) ro.disconnect();
			else window.removeEventListener("resize", measure);
			scene?.dispose();
			scene = null;
		};
	}, [
		intensity,
		still,
		highContrast
	]);
	if (highContrast) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		"aria-hidden": true,
		className: cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", "bg-[radial-gradient(120%_90%_at_50%_20%,rgba(10,12,24,0.9),rgba(3,4,9,0.96))]", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
			ref: canvasRef,
			className: "size-full"
		})
	});
}
//#endregion
export { LivingIntelligenceBackdrop as t };
