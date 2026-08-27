import { useEffect, useMemo, useRef, useState } from "react";
import {
  ORB_APPEARANCE,
  orbFrameAt,
  qualityFor,
  type OrbQuality,
  type OrbState,
} from "@/lib/orb/state";
import {
  ORB_FRAGMENT_SHADER,
  ORB_VERTEX_SHADER,
  canRenderFull,
  paintOrb,
  uniformsFor,
} from "@/lib/orb/render";
import { assessDevice, readDeviceSignals } from "@/lib/perf-fallback";
import { useAppearance } from "@/lib/use-appearance";
import { cn } from "@/lib/utils";

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
export function OcadeOrbCanvas({
  state,
  amplitude = 0,
  size = 96,
  className,
  decorative = false,
}: {
  state: OrbState;
  /** Live input level, 0–1. Used while listening and speaking. */
  amplitude?: number;
  /** Rendered size in CSS pixels. */
  size?: number;
  className?: string;
  /**
   * True when another element already announces the state in words.
   *
   * The composer shows the label beside the orb, and two live regions saying
   * the same sentence is worse than one — a screen reader reads it twice.
   */
  decorative?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appearance = useAppearance();
  const [quality, setQuality] = useState<OrbQuality>("still");
  const amplitudeRef = useRef(amplitude);
  amplitudeRef.current = amplitude;
  const stateRef = useRef(state);
  stateRef.current = state;

  const reducedMotion = appearance.reducedMotion || appearance.osReducedMotion;

  /*
   * Quality is decided once per mount, after the canvas exists, because the
   * WebGL probe needs a real element. Re-deciding on every render would create
   * and destroy a context on each state change, which is the one thing
   * guaranteed to exhaust the browser's context budget.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setQuality(
      qualityFor({
        reducedMotion,
        webglAvailable: canRenderFull(canvas),
        lowEndDevice: assessDevice(readDeviceSignals()).lowEnd || appearance.lowPerformance,
        smallViewport: typeof window !== "undefined" && window.innerWidth < 768,
      }),
    );
  }, [reducedMotion, appearance.lowPerformance]);

  useEffect(() => {
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
        height: pixels,
      });
      return;
    }

    if (quality === "simple") {
      const context = canvas.getContext("2d");
      if (!context) return;
      let raf = 0;
      const started = performance.now();
      const draw = () => {
        const seconds = (performance.now() - started) / 1000;
        paintOrb(
          context,
          orbFrameAt(stateRef.current, seconds, { amplitude: amplitudeRef.current }),
          { width: pixels, height: pixels },
        );
        raf = requestAnimationFrame(draw);
      };
      draw();
      return () => cancelAnimationFrame(raf);
    }

    /* ------------------------------------------------------------ full -- */
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      // The probe said yes and the real context said no. Step down rather than
      // render nothing: an empty square where the status should be is worse
      // than a cheaper status.
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
    // One triangle that covers the viewport. Two would cost a seam down the
    // diagonal for no benefit at this size.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const locations = {
      resolution: uniform("u_resolution"),
      time: uniform("u_time"),
      core: uniform("u_core"),
      rim: uniform("u_rim"),
      radius: uniform("u_radius"),
      turbulence: uniform("u_turbulence"),
      glow: uniform("u_glow"),
    };

    let raf = 0;
    const started = performance.now();
    const draw = () => {
      const seconds = (performance.now() - started) / 1000;
      const frame = orbFrameAt(stateRef.current, seconds, { amplitude: amplitudeRef.current });
      const values = uniformsFor(frame, seconds, [pixels, pixels]);
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

    /*
     * A lost context is not an error worth showing anybody. The browser
     * reclaims contexts under pressure and hands them back later; stepping down
     * to the painted orb keeps the status visible and costs the person nothing
     * they would notice.
     */
    const onLost = (event: Event) => {
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
  }, [quality, size, state]);

  const label = useMemo(() => ORB_APPEARANCE[state].label, [state]);

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="h-full w-full"
        style={{ width: size, height: size }}
      />
      {decorative ? null : (
        <span role="status" aria-live="polite" className="sr-only">
          {label}
        </span>
      )}
    </span>
  );
}

function compile(gl: WebGLRenderingContext): WebGLProgram | null {
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

function shader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const created = gl.createShader(type);
  if (!created) return null;
  gl.shaderSource(created, source);
  gl.compileShader(created);
  if (!gl.getShaderParameter(created, gl.COMPILE_STATUS)) return null;
  return created;
}
