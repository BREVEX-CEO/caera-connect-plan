/**
 * IS THERE A GPU BEHIND THIS WEBGL CONTEXT, OR IS THE CPU PRETENDING?
 *
 * The landing scene is a real-time WebGL system. On hardware it costs a few
 * milliseconds a frame. On a software rasteriser — SwiftShader, llvmpipe,
 * Mesa's softpipe, Microsoft's Basic Render Driver — the same frame costs
 * roughly three hundred, and the cost is paid ON THE MAIN THREAD: the page
 * stops answering taps, scrolls in steps, and drains the battery of the
 * machine least able to spare it.
 *
 * Measured on this repository's own web-vitals harness, which throttles to a
 * mid-tier CPU and has no GPU: the landing route's Total Blocking Time was
 * 2,933 ms against a 200 ms budget. Blocking the scene's chunk at the network
 * layer took the same page to 234 ms. One 1,470 ms task built the scene and
 * every animation frame after it added another ~300 ms.
 *
 * SO THE SCENE DECLINES RATHER THAN DEGRADES. There is no quality setting that
 * rescues a software rasteriser: fewer stars and no bloom still leave a
 * per-frame cost the main thread cannot absorb. The page keeps its identity,
 * its capability cards and every control — everything the canvas shows is real
 * text elsewhere on the page, which is why the canvas is `aria-hidden` in the
 * first place.
 *
 * FAIL OPEN WHEN THE ANSWER IS UNKNOWN. `WEBGL_debug_renderer_info` can be
 * absent — a privacy-hardened profile, a browser that refuses fingerprinting
 * surfaces — and an unknown renderer is treated as hardware. Withholding the
 * product's opening image because the browser would not identify itself is the
 * wrong way to be wrong.
 */

/**
 * The names software rasterisers actually report.
 *
 * Matched case-insensitively against `UNMASKED_RENDERER_WEBGL`, which is a
 * free-form driver string: Chromium's own is
 * "Google Inc. (Google) ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device …))",
 * Mesa reports "llvmpipe (LLVM 15.0.7, 256 bits)", and Windows without a
 * driver reports "Microsoft Basic Render Driver".
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|basic render|\bsoftware\b/i;

/** True only when the string positively identifies a software rasteriser. */
export function isSoftwareRenderer(renderer: string | null | undefined): boolean {
  return typeof renderer === "string" && SOFTWARE_RENDERER.test(renderer);
}

/**
 * Ask the browser what it would draw with, without building anything.
 *
 * A 1x1 context, read once and released. `loseContext` is called rather than
 * left to garbage collection because a browser keeps only a handful of live
 * WebGL contexts and silently kills the oldest — and the one this scene is
 * about to ask for must not be the one it kills.
 *
 * Returns `null` when there is no WebGL at all, which the caller treats as
 * unknown rather than as software: a context that cannot be created will fail
 * again in `createSolarScene`, and that path already reports itself.
 */
export function probeWebglRenderer(): string | null {
  if (typeof document === "undefined") return null;
  let gl: WebGLRenderingContext | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    gl = (canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (!info) return null;
    const renderer = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === "string" ? renderer : null;
  } catch {
    return null;
  } finally {
    try {
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      /* Releasing a probe context is best-effort; nothing depends on it. */
    }
  }
}

/** The one question the scene asks before it builds anything. */
export function scenesShouldRun(renderer: string | null = probeWebglRenderer()): {
  run: boolean;
  renderer: string | null;
} {
  return { run: !isSoftwareRenderer(renderer), renderer };
}
