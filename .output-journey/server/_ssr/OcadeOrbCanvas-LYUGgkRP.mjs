import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as qualityFor, r as orbFrameAt, t as ORB_APPEARANCE } from "./OcadeOrb-CAwPzlLl.mjs";
import { i as readDeviceSignals, n as assessDevice } from "./perf-fallback-BFzNUEP9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/OcadeOrbCanvas-LYUGgkRP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Paint one frame with gradients.
*
* Used for `simple` and for `still` — a still orb is this, drawn once. The
* geometry is deliberately identical to the shader's: same centre, same radius
* relationship to the canvas, same light direction, so switching quality mid-
* session does not move the orb.
*/
function paintOrb(context, frame, size) {
	const { width, height } = size;
	context.clearRect(0, 0, width, height);
	if (width <= 0 || height <= 0) return;
	const cx = width / 2;
	const cy = height / 2;
	const radius = Math.min(width, height) * .34 * frame.radius;
	if (radius <= 0) return;
	const core = rgb(frame.core);
	rgb(frame.rim);
	const halo = context.createRadialGradient(cx, cy, radius * .6, cx, cy, radius * 2.1);
	halo.addColorStop(0, rgba(frame.rim, .32 * frame.glow));
	halo.addColorStop(.55, rgba(frame.rim, .1 * frame.glow));
	halo.addColorStop(1, rgba(frame.rim, 0));
	context.fillStyle = halo;
	context.beginPath();
	context.arc(cx, cy, radius * 2.1, 0, Math.PI * 2);
	context.fill();
	const lightX = cx - radius * .35;
	const lightY = cy - radius * .38;
	const body = context.createRadialGradient(lightX, lightY, radius * .08, cx, cy, radius);
	body.addColorStop(0, lighten(core, .34));
	body.addColorStop(.45, core);
	body.addColorStop(1, darken(core, .55));
	context.fillStyle = body;
	context.beginPath();
	context.arc(cx, cy, radius, 0, Math.PI * 2);
	context.fill();
	context.strokeStyle = rgba(frame.rim, .45 + .4 * frame.glow);
	context.lineWidth = Math.max(1, radius * .035);
	context.beginPath();
	context.arc(cx, cy, radius * .99, 0, Math.PI * 2);
	context.stroke();
}
function rgb(colour) {
	return `rgb(${to255(colour[0])}, ${to255(colour[1])}, ${to255(colour[2])})`;
}
function rgba(colour, alpha) {
	return `rgba(${to255(colour[0])}, ${to255(colour[1])}, ${to255(colour[2])}, ${clamp01(alpha).toFixed(3)})`;
}
function lighten(colour, amount) {
	return mix(colour, 255, amount);
}
function darken(colour, amount) {
	return mix(colour, 0, amount);
}
function mix(colour, target, amount) {
	const parts = colour.match(/\d+/g)?.map(Number) ?? [
		0,
		0,
		0
	];
	const t = clamp01(amount);
	const blended = parts.map((value) => Math.round(value + (target - value) * t));
	return `rgb(${blended[0]}, ${blended[1]}, ${blended[2]})`;
}
function to255(value) {
	return Math.max(0, Math.min(255, Math.round(clamp01(value) * 255)));
}
function clamp01(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}
var ORB_VERTEX_SHADER = `#version 100
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;
/**
* The orb, raymarched.
*
* Thirty-two steps is the ceiling, chosen because the surface is a sphere plus
* a small displacement and a march that has not converged by then has missed
* it entirely. The displacement is three sine waves rather than a noise texture
* — no texture upload, no second context resource, and at the amplitudes this
* orb uses the difference is not visible.
*/
var ORB_FRAGMENT_SHADER = `#version 100
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;
uniform vec3  u_core;
uniform vec3  u_rim;
uniform float u_radius;
uniform float u_turbulence;
uniform float u_glow;

float surface(vec3 p) {
  float wobble =
      sin(p.x * 4.0 + u_time * 1.3)
    * sin(p.y * 4.0 - u_time * 1.1)
    * sin(p.z * 4.0 + u_time * 0.7);
  return length(p) - u_radius - wobble * u_turbulence * 0.06;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    surface(p + e.xyy) - surface(p - e.xyy),
    surface(p + e.yxy) - surface(p - e.yxy),
    surface(p + e.yyx) - surface(p - e.yyx)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  vec3 origin = vec3(0.0, 0.0, 2.6);
  vec3 direction = normalize(vec3(uv, -1.4));

  float travelled = 0.0;
  bool hit = false;
  for (int step = 0; step < 32; step++) {
    vec3 point = origin + direction * travelled;
    float distance = surface(point);
    if (distance < 0.002) { hit = true; break; }
    travelled += distance;
    if (travelled > 6.0) break;
  }

  // The halo is drawn whether or not the sphere was hit, so it survives at the
  // silhouette rather than clipping to a hard edge.
  float falloff = 1.0 - smoothstep(u_radius * 0.9, u_radius * 2.2, length(uv) * 2.6);
  vec3 colour = u_rim * falloff * u_glow * 0.35;
  float alpha = falloff * u_glow * 0.5;

  if (hit) {
    vec3 point = origin + direction * travelled;
    vec3 normal = normalAt(point);
    vec3 light = normalize(vec3(-0.55, 0.62, 0.75));
    float lambert = max(dot(normal, light), 0.0);
    float fresnel = pow(1.0 - max(dot(normal, -direction), 0.0), 2.5);
    colour = u_core * (0.22 + 0.78 * lambert) + u_rim * fresnel * (0.5 + u_glow);
    alpha = 1.0;
  }

  gl_FragColor = vec4(colour, alpha);
}
`;
/** The uniform values for a frame. Separated so it can be tested without a GL context. */
function uniformsFor(frame, time, resolution) {
	return {
		resolution,
		time,
		core: frame.core,
		rim: frame.rim,
		radius: .62 * frame.radius,
		turbulence: frame.turbulence,
		glow: frame.glow
	};
}
/**
* Whether this browser can give us a context for the orb.
*
* `failIfMajorPerformanceCaveat` is set because a context that has silently
* fallen back to software rendering will draw the orb correctly and cost more
* than the whole rest of the page. On that machine the painted fallback is both
* faster and indistinguishable, so refusing the context here is how the person
* gets the better of the two.
*/
function canRenderFull(canvas) {
	try {
		const context = canvas.getContext("webgl", {
			alpha: true,
			antialias: false,
			depth: false,
			failIfMajorPerformanceCaveat: true,
			powerPreference: "low-power"
		}) ?? null;
		if (!context) return false;
		context.getExtension("WEBGL_lose_context")?.loseContext();
		return true;
	} catch {
		return false;
	}
}
/**
* The OCADE orb's renderer.
*
* SPLIT FROM `OcadeOrb` SO THE SHADER IS NOT IN THE CHAT BUNDLE.
*
* The raymarching shader, the WebGL setup and the 2D painter are only needed
* once something is actually happening. Chat's first paint is a text box, and
* shipping a renderer to draw a sphere nobody has asked for yet is bytes spent
* before the product has done anything. `OcadeOrb` loads this on first use.
*
* One component, every surface. Chat, Cowork, the composer and the mobile bar
* all render this at different sizes, because "what is OCADE doing" is one
* question and a person who learns the answer in one room must not have to
* learn it again in another.
*
* IT IS TEXT AS WELL AS A PICTURE, ALWAYS. The orb carries a live region with
* the state's label, so a screen-reader user hears "Working on your computer"
* at the moment a sighted user sees crimson. A status indicator that only
* exists as colour and motion is not a status indicator for everybody.
*/
function OcadeOrbCanvas({ state, amplitude = 0, size = 96, className, decorative = false }) {
	const canvasRef = (0, import_react.useRef)(null);
	const appearance = useAppearance();
	const [quality, setQuality] = (0, import_react.useState)("still");
	const amplitudeRef = (0, import_react.useRef)(amplitude);
	amplitudeRef.current = amplitude;
	const stateRef = (0, import_react.useRef)(state);
	stateRef.current = state;
	const reducedMotion = appearance.reducedMotion || appearance.osReducedMotion;
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		setQuality(qualityFor({
			reducedMotion,
			webglAvailable: canRenderFull(canvas),
			lowEndDevice: assessDevice(readDeviceSignals()).lowEnd || appearance.lowPerformance,
			smallViewport: typeof window !== "undefined" && window.innerWidth < 768
		}));
	}, [reducedMotion, appearance.lowPerformance]);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ratio = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
		const pixels = Math.round(size * ratio);
		canvas.width = pixels;
		canvas.height = pixels;
		if (quality === "still") {
			const context = canvas.getContext("2d");
			if (!context) return;
			paintOrb(context, orbFrameAt(state, 0, { quality: "still" }), {
				width: pixels,
				height: pixels
			});
			return;
		}
		if (quality === "simple") {
			const context = canvas.getContext("2d");
			if (!context) return;
			let raf = 0;
			const started = performance.now();
			const draw = () => {
				const seconds = (performance.now() - started) / 1e3;
				paintOrb(context, orbFrameAt(stateRef.current, seconds, { amplitude: amplitudeRef.current }), {
					width: pixels,
					height: pixels
				});
				raf = requestAnimationFrame(draw);
			};
			draw();
			return () => cancelAnimationFrame(raf);
		}
		const gl = canvas.getContext("webgl", {
			alpha: true,
			antialias: false,
			depth: false,
			premultipliedAlpha: false,
			powerPreference: "low-power"
		});
		if (!gl) {
			setQuality("simple");
			return;
		}
		const program = compile(gl);
		if (!program) {
			setQuality("simple");
			return;
		}
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1,
			-1,
			3,
			-1,
			-1,
			3
		]), gl.STATIC_DRAW);
		const position = gl.getAttribLocation(program, "a_position");
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		gl.useProgram(program);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		const uniform = (name) => gl.getUniformLocation(program, name);
		const locations = {
			resolution: uniform("u_resolution"),
			time: uniform("u_time"),
			core: uniform("u_core"),
			rim: uniform("u_rim"),
			radius: uniform("u_radius"),
			turbulence: uniform("u_turbulence"),
			glow: uniform("u_glow")
		};
		let raf = 0;
		const started = performance.now();
		const draw = () => {
			const seconds = (performance.now() - started) / 1e3;
			const values = uniformsFor(orbFrameAt(stateRef.current, seconds, { amplitude: amplitudeRef.current }), seconds, [pixels, pixels]);
			gl.viewport(0, 0, pixels, pixels);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.uniform2f(locations.resolution, values.resolution[0], values.resolution[1]);
			gl.uniform1f(locations.time, values.time);
			gl.uniform3f(locations.core, values.core[0], values.core[1], values.core[2]);
			gl.uniform3f(locations.rim, values.rim[0], values.rim[1], values.rim[2]);
			gl.uniform1f(locations.radius, values.radius);
			gl.uniform1f(locations.turbulence, values.turbulence);
			gl.uniform1f(locations.glow, values.glow);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			raf = requestAnimationFrame(draw);
		};
		draw();
		const onLost = (event) => {
			event.preventDefault();
			cancelAnimationFrame(raf);
			setQuality("simple");
		};
		canvas.addEventListener("webglcontextlost", onLost);
		return () => {
			cancelAnimationFrame(raf);
			canvas.removeEventListener("webglcontextlost", onLost);
			gl.getExtension("WEBGL_lose_context")?.loseContext();
		};
	}, [
		quality,
		size,
		state
	]);
	const label = (0, import_react.useMemo)(() => ORB_APPEARANCE[state].label, [state]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("relative inline-flex shrink-0", className),
		style: {
			width: size,
			height: size
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
			ref: canvasRef,
			"aria-hidden": true,
			className: "h-full w-full",
			style: {
				width: size,
				height: size
			}
		}), decorative ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			role: "status",
			"aria-live": "polite",
			className: "sr-only",
			children: label
		})]
	});
}
function compile(gl) {
	const vertex = shader(gl, gl.VERTEX_SHADER, ORB_VERTEX_SHADER);
	const fragment = shader(gl, gl.FRAGMENT_SHADER, ORB_FRAGMENT_SHADER);
	if (!vertex || !fragment) return null;
	const program = gl.createProgram();
	if (!program) return null;
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
	return program;
}
function shader(gl, type, source) {
	const created = gl.createShader(type);
	if (!created) return null;
	gl.shaderSource(created, source);
	gl.compileShader(created);
	if (!gl.getShaderParameter(created, gl.COMPILE_STATUS)) return null;
	return created;
}
//#endregion
export { OcadeOrbCanvas };
