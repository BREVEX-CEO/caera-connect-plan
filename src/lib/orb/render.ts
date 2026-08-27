/**
 * Drawing the orb, at three levels of expense, from one description.
 *
 * WHY THE FALLBACKS ARE THE SAME OBJECT AND NOT A DIFFERENT ONE
 * -------------------------------------------------------------
 * A weak-GPU fallback that swaps a lit sphere for a flat coloured dot is a
 * different product on that machine: the person is no longer looking at the
 * thing everybody else is looking at, and any instruction written about it
 * ("the orb tightens when it is working") stops being true for them.
 *
 * So all three renderers draw the SAME shape from the SAME frame — a sphere,
 * lit from the upper left, with a halo and a rim. `full` raymarches it with a
 * displaced surface; `simple` paints it with radial gradients; `still` paints
 * one frame and stops. The difference is detail and cost, never identity.
 *
 * WHY THE WEBGL PATH IS ONE FRAGMENT SHADER ON A FULL-SCREEN TRIANGLE
 * -------------------------------------------------------------------
 * Because a browser keeps a small number of live WebGL contexts and silently
 * kills the oldest, and OCADE already spends one on the landing scene. One
 * triangle, one shader, no geometry, no textures, no library: the orb costs a
 * single draw call and holds a context that is cheap enough to lose.
 */

import type { OrbFrame } from "./state";

/* ------------------------------------------------------------- 2D canvas -- */

/**
 * Paint one frame with gradients.
 *
 * Used for `simple` and for `still` — a still orb is this, drawn once. The
 * geometry is deliberately identical to the shader's: same centre, same radius
 * relationship to the canvas, same light direction, so switching quality mid-
 * session does not move the orb.
 */
export function paintOrb(
  context: CanvasRenderingContext2D,
  frame: OrbFrame,
  size: { width: number; height: number },
): void {
  const { width, height } = size;
  context.clearRect(0, 0, width, height);
  if (width <= 0 || height <= 0) return;

  const cx = width / 2;
  const cy = height / 2;
  const base = Math.min(width, height) * 0.34;
  const radius = base * frame.radius;
  if (radius <= 0) return;

  const core = rgb(frame.core);
  const rim = rgb(frame.rim);

  // The halo, painted first so the sphere sits inside it.
  const halo = context.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 2.1);
  halo.addColorStop(0, rgba(frame.rim, 0.32 * frame.glow));
  halo.addColorStop(0.55, rgba(frame.rim, 0.1 * frame.glow));
  halo.addColorStop(1, rgba(frame.rim, 0));
  context.fillStyle = halo;
  context.beginPath();
  context.arc(cx, cy, radius * 2.1, 0, Math.PI * 2);
  context.fill();

  /*
   * The body. Offsetting the gradient's inner circle up and left is the whole
   * of the lighting model here, and it is enough: a sphere reads as a sphere
   * from one highlight and one terminator.
   */
  const lightX = cx - radius * 0.35;
  const lightY = cy - radius * 0.38;
  const body = context.createRadialGradient(lightX, lightY, radius * 0.08, cx, cy, radius);
  body.addColorStop(0, lighten(core, 0.34));
  body.addColorStop(0.45, core);
  body.addColorStop(1, darken(core, 0.55));
  context.fillStyle = body;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();

  // The rim light, which is what stops the orb reading as a flat disc.
  context.strokeStyle = rgba(frame.rim, 0.45 + 0.4 * frame.glow);
  context.lineWidth = Math.max(1, radius * 0.035);
  context.beginPath();
  context.arc(cx, cy, radius * 0.99, 0, Math.PI * 2);
  context.stroke();
  void rim;
}

function rgb(colour: readonly [number, number, number]): string {
  return `rgb(${to255(colour[0])}, ${to255(colour[1])}, ${to255(colour[2])})`;
}

function rgba(colour: readonly [number, number, number], alpha: number): string {
  return `rgba(${to255(colour[0])}, ${to255(colour[1])}, ${to255(colour[2])}, ${clamp01(alpha).toFixed(3)})`;
}

function lighten(colour: string, amount: number): string {
  return mix(colour, 255, amount);
}

function darken(colour: string, amount: number): string {
  return mix(colour, 0, amount);
}

function mix(colour: string, target: number, amount: number): string {
  const parts = colour.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const t = clamp01(amount);
  const blended = parts.map((value) => Math.round(value + (target - value) * t));
  return `rgb(${blended[0]}, ${blended[1]}, ${blended[2]})`;
}

function to255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(clamp01(value) * 255)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/* ------------------------------------------------------------------ WebGL -- */

export const ORB_VERTEX_SHADER = `#version 100
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
export const ORB_FRAGMENT_SHADER = `#version 100
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

export interface OrbUniformValues {
  resolution: [number, number];
  time: number;
  core: readonly [number, number, number];
  rim: readonly [number, number, number];
  radius: number;
  turbulence: number;
  glow: number;
}

/** The uniform values for a frame. Separated so it can be tested without a GL context. */
export function uniformsFor(
  frame: OrbFrame,
  time: number,
  resolution: [number, number],
): OrbUniformValues {
  return {
    resolution,
    time,
    core: frame.core,
    rim: frame.rim,
    /*
     * 0.62 is the sphere's radius in the shader's world units at rest, chosen
     * so that a 1.12 scale (listening, the largest state) still leaves the halo
     * room inside the viewport instead of clipping at the edge.
     */
    radius: 0.62 * frame.radius,
    turbulence: frame.turbulence,
    glow: frame.glow,
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
export function canRenderFull(canvas: HTMLCanvasElement): boolean {
  try {
    const context =
      canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "low-power",
      }) ?? null;
    if (!context) return false;
    const lose = context.getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}
