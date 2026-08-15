import { useEffect, useRef } from "react";
import { CONTROL_CONSTELLATION, CONTROL_DOMAINS } from "@/lib/work/control-capabilities";
import { motionFor, type ControlState } from "@/lib/work/control-solar";
import { cn } from "@/lib/utils";

const SLOW_FRAME_MS = 11;
const FAST_FRAME_MS = 6.5;

type Quality = "full" | "balanced" | "minimal";

const STATE_HUES: Record<ControlState, { blue: number; red: number; silver: number }> = {
  idle: { blue: 0.58, red: 0.18, silver: 0.76 },
  listening: { blue: 0.94, red: 0.28, silver: 0.82 },
  thinking: { blue: 0.8, red: 0.45, silver: 0.9 },
  observing: { blue: 1, red: 0.36, silver: 0.8 },
  controlling: { blue: 0.96, red: 0.76, silver: 0.86 },
  speaking: { blue: 0.88, red: 0.5, silver: 0.96 },
  paused: { blue: 0.35, red: 0.32, silver: 0.66 },
  stopped: { blue: 0.16, red: 0.5, silver: 0.55 },
  error: { blue: 0.12, red: 1, silver: 0.45 },
};

/**
 * OCADE's operational constellation.
 *
 * Eight rings are the eight control domains. Twenty-eight objects are the
 * visible, named parts of those domains. Unlike the old solar-system metaphor,
 * the geometry is relational: every object connects to the central authority
 * orb and to the neighbours in its own permission ring. State changes affect
 * movement without resetting phase, and Stop/Error settle after one frame.
 *
 * This stays on Canvas 2D deliberately. The landing page already owns the
 * heavyweight WebGL scene; loading another 3D engine beside a local model and
 * a control loop would spend the response budget on decoration. Perspective,
 * depth ordering, glow and parallax are calculated directly and the renderer
 * drops quality if its own measured frame cost becomes expensive.
 */
export function ControlSolarScene({
  state,
  amplitude = 0,
  className,
}: {
  state: ControlState;
  amplitude?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const amplitudeRef = useRef(amplitude);
  stateRef.current = state;
  amplitudeRef.current = amplitude;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "display:block;width:100%;height:100%;";
    wrap.prepend(canvas);
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      canvas.remove();
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 1;
    let height = 1;
    let quality: Quality = "full";
    let meanFrameMs = 0;
    let samples = 0;
    let phase = 0.45;
    let elapsed = 0;
    let last = performance.now();
    let frame = 0;
    let running = true;
    let settled: ControlState | null = null;

    const resize = () => {
      const bounds = wrap.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const dprCap = quality === "full" ? 1.75 : quality === "balanced" ? 1.25 : 1;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (dt: number) => {
      elapsed += dt;
      const control = motionFor({
        state: stateRef.current,
        time: elapsed,
        amplitude: amplitudeRef.current,
      });
      phase += dt * control.orbitRate * 0.36;
      paintCommandConstellation(context, {
        width,
        height,
        phase,
        time: elapsed,
        state: stateRef.current,
        pulse: control.sunPulse,
        scanAngle: control.scan,
        quality,
      });
    };

    resize();
    if (reduced) {
      quality = "balanced";
      resize();
      draw(0);
    } else {
      const loop = (now: number) => {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const current = stateRef.current;
        const held = current === "stopped" || current === "error";
        if (!held || settled !== current) {
          const started = performance.now();
          draw(dt);
          const cost = performance.now() - started;
          meanFrameMs = samples === 0 ? cost : meanFrameMs * 0.9 + cost * 0.1;
          samples += 1;
          settled = held ? current : null;
          if (samples > 45) {
            if (meanFrameMs > SLOW_FRAME_MS && quality !== "minimal") {
              quality = quality === "full" ? "balanced" : "minimal";
              samples = 0;
              resize();
            } else if (meanFrameMs < FAST_FRAME_MS && quality !== "full") {
              quality = quality === "minimal" ? "balanced" : "full";
              samples = 0;
              resize();
            }
          }
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => {
      resize();
      settled = null;
      if (reduced) draw(0);
    });
    observer.observe(wrap);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cn("relative isolate", className)}
      data-control-state={state}
      data-control-domain-count={CONTROL_DOMAINS.length}
      data-control-object-count={CONTROL_CONSTELLATION.length}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,rgba(0,0,0,.18)_50%,rgba(0,0,0,.72)_100%)]"
      />
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-center">
        <p
          aria-live="polite"
          className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.3em] text-foreground/70"
        >
          {motionFor({ state, time: 0, amplitude }).caption}
        </p>
        <p className="mt-1 whitespace-nowrap text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/55">
          8 domains · 28 command objects
        </p>
      </div>
    </div>
  );
}

function paintCommandConstellation(
  context: CanvasRenderingContext2D,
  input: {
    width: number;
    height: number;
    phase: number;
    time: number;
    state: ControlState;
    pulse: number;
    scanAngle: number | null;
    quality: Quality;
  },
) {
  const { width, height, state, phase, time, quality } = input;
  const cx = width * 0.5;
  const cy = height * 0.46;
  const compact = width < 600 || height < 390;
  const radius = Math.min(width * 0.43, height * 0.54);
  const palette = STATE_HUES[state];
  context.clearRect(0, 0, width, height);

  const field = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
  field.addColorStop(0, `rgba(20, 38, 70, ${0.18 * palette.blue})`);
  field.addColorStop(0.52, "rgba(6, 9, 15, 0.34)");
  field.addColorStop(1, "rgba(2, 3, 6, 0.94)");
  context.fillStyle = field;
  context.fillRect(0, 0, width, height);

  const rings = CONTROL_DOMAINS.map((domain, index) => ({
    domain,
    index,
    radiusX: radius * (0.32 + index * 0.085),
    radiusY: radius * (0.13 + index * 0.04),
    tilt: -0.23 + index * 0.065,
  }));

  context.save();
  context.translate(cx, cy);
  for (const ring of rings) {
    context.save();
    context.rotate(ring.tilt);
    context.beginPath();
    context.ellipse(0, 0, ring.radiusX, ring.radiusY, 0, 0, Math.PI * 2);
    context.strokeStyle = `rgba(154, 183, 226, ${0.055 + ring.index * 0.008})`;
    context.lineWidth = ring.index % 2 === 0 ? 0.8 : 0.55;
    context.stroke();
    context.restore();
  }
  context.restore();

  const points = CONTROL_CONSTELLATION.map((object, globalIndex) => {
    const ring = rings[object.domainIndex];
    const groupLength = object.domainIndex < 4 ? 4 : 3;
    const angle =
      phase * (object.domainIndex % 2 === 0 ? 1 : -0.78) +
      (object.objectIndex / groupLength) * Math.PI * 2 +
      object.domainIndex * 0.41;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x0 = cos * ring.radiusX;
    const y0 = sin * ring.radiusY;
    const c = Math.cos(ring.tilt);
    const s = Math.sin(ring.tilt);
    const x = cx + x0 * c - y0 * s;
    const y = cy + x0 * s + y0 * c;
    const depth = (sin + 1) / 2;
    return { ...object, globalIndex, x, y, depth };
  }).sort((a, b) => a.depth - b.depth);

  if (quality !== "minimal") {
    context.save();
    context.lineWidth = 0.55;
    for (const point of points) {
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(point.x, point.y);
      context.strokeStyle = `rgba(85, 151, 255, ${0.018 + point.depth * 0.035})`;
      context.stroke();
    }
    context.restore();
  }

  for (const point of points) {
    const active = (Math.floor(time * 0.7) + point.domainIndex) % 8 === point.domainIndex;
    const size = (compact ? 2.1 : 2.8) + point.depth * (compact ? 2.2 : 3.4);
    const red = state === "error" || (state === "controlling" && point.globalIndex % 7 === 0);
    const base = red ? "238, 62, 74" : point.globalIndex % 5 === 0 ? "213, 220, 232" : "69, 139, 255";
    if (quality === "full") {
      const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 4.5);
      glow.addColorStop(0, `rgba(${base}, ${0.42 + point.depth * 0.24})`);
      glow.addColorStop(1, `rgba(${base}, 0)`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(point.x, point.y, size * 4.5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = `rgba(${base}, ${0.62 + point.depth * 0.35})`;
    context.beginPath();
    context.arc(point.x, point.y, active ? size * 1.2 : size, 0, Math.PI * 2);
    context.fill();
    if (!compact && quality === "full" && point.depth > 0.82 && point.objectIndex === 0) {
      context.font = "500 9px ui-sans-serif, system-ui, sans-serif";
      context.textAlign = "center";
      context.fillStyle = "rgba(214, 222, 236, 0.62)";
      context.fillText(point.label, point.x, point.y + size + 12);
    }
  }

  const pulse = Math.max(0, Math.min(1, input.pulse));
  const orbRadius = (compact ? 23 : 31) * (0.92 + pulse * 0.13);
  const glow = context.createRadialGradient(cx, cy, 0, cx, cy, orbRadius * 3.8);
  glow.addColorStop(0, `rgba(228, 234, 244, ${0.76 * palette.silver})`);
  glow.addColorStop(0.19, `rgba(64, 137, 255, ${0.55 * palette.blue})`);
  glow.addColorStop(0.5, `rgba(235, 53, 68, ${0.17 * palette.red})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(cx, cy, orbRadius * 3.8, 0, Math.PI * 2);
  context.fill();

  const metal = context.createLinearGradient(cx - orbRadius, cy - orbRadius, cx + orbRadius, cy + orbRadius);
  metal.addColorStop(0, "rgba(248,250,255,.96)");
  metal.addColorStop(0.28, "rgba(85,96,116,.9)");
  metal.addColorStop(0.52, "rgba(8,12,20,.98)");
  metal.addColorStop(0.74, "rgba(60,128,238,.92)");
  metal.addColorStop(1, state === "error" ? "rgba(246,49,64,.94)" : "rgba(199,207,220,.9)");
  context.fillStyle = metal;
  context.beginPath();
  context.arc(cx, cy, orbRadius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = state === "error" ? "rgba(255,70,82,.9)" : "rgba(119,171,255,.82)";
  context.lineWidth = 1.2;
  context.stroke();

  context.font = `600 ${compact ? 9 : 11}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(242,246,255,.9)";
  context.fillText("OCADE", cx, cy);

  if (input.scanAngle !== null) {
    context.save();
    context.translate(cx, cy);
    context.rotate(input.scanAngle);
    const sweep = context.createLinearGradient(0, 0, radius, 0);
    sweep.addColorStop(0, "rgba(82,145,255,.52)");
    sweep.addColorStop(1, "rgba(82,145,255,0)");
    context.strokeStyle = sweep;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(orbRadius, 0);
    context.lineTo(radius, 0);
    context.stroke();
    context.restore();
  }
}
