import { useEffect, useRef, useState } from "react";
import type { QualityTier, SceneHandles } from "@/lib/landing/solar-scene";
import { makeStars, paintUniverse, type Star } from "@/lib/landing/paint";
import {
  DEFAULT_CAMERA,
  starCountFor,
  type RenderTier,
} from "@/lib/landing/universe";
import { URANUS_MOONS } from "@/lib/landing/solar-data";
import { cn } from "@/lib/utils";

export type WorkSceneActivity =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "executing"
  | "paused"
  | "emergency";

const SPEED: Record<WorkSceneActivity, number> = {
  idle: 1,
  listening: 0.72,
  thinking: 1.35,
  speaking: 0.9,
  executing: 1.65,
  paused: 0,
  emergency: 0,
};

function qualityTier(): QualityTier {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "still";
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 4;
  return memory < 4 || cores < 4 ? "reduced" : "full";
}

/**
 * The production wrapper for OCADE's Three.js work system.
 *
 * The renderer owns every GPU allocation; this wrapper owns DOM lifecycle,
 * input and activity. `voiceAmplitude` is the real 0..1 envelope emitted by
 * the local voice host when available, so speaking/listening energy follows
 * audio instead of playing a decorative canned loop.
 */
export function SolarWorkScene({
  activity = "idle",
  voiceAmplitude = 0,
  className,
}: {
  activity?: WorkSceneActivity;
  voiceAmplitude?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandles | null>(null);
  const activityRef = useRef(activity);
  const amplitudeRef = useRef(voiceAmplitude);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [available, setAvailable] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  activityRef.current = activity;
  amplitudeRef.current = Math.max(0, Math.min(1, voiceAmplitude));

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const fallbackCanvas = fallbackCanvasRef.current;
    if (!host || !canvas || !fallbackCanvas) return;

    let disposed = false;
    let animation = 0;
    let previous = performance.now();
    let scene: SceneHandles | null = null;
    let fallbackContext: CanvasRenderingContext2D | null = null;
    let fallbackStars: Star[] = [];
    let fallbackTier: RenderTier = "reduced";
    let fallbackElapsed = 0;
    let fallbackWidth = Math.max(1, host.clientWidth);
    let fallbackHeight = Math.max(1, host.clientHeight);
    let resize: ResizeObserver | null = null;
    const chosenTier = qualityTier();

    const probe = document.createElement("canvas");
    const contextOptions: WebGLContextAttributes = {
      antialias: chosenTier === "full",
      alpha: true,
      powerPreference: "high-performance",
    };
    const probeGl =
      probe.getContext("webgl2", contextOptions) || probe.getContext("webgl", contextOptions);
    const supportsPrecision = (shader: number, precision: number) => {
      try {
        const format = probeGl?.getShaderPrecisionFormat(shader, precision);
        return Boolean(format && typeof format.precision === "number" && format.precision > 0);
      } catch {
        return false;
      }
    };
    const webglAvailable = Boolean(
      probeGl &&
      supportsPrecision(probeGl.VERTEX_SHADER, probeGl.HIGH_FLOAT) &&
      supportsPrecision(probeGl.FRAGMENT_SHADER, probeGl.HIGH_FLOAT),
    );

    const resizeFallback = (width: number, height: number) => {
      if (!fallbackContext) return;
      fallbackWidth = width;
      fallbackHeight = height;
      const dpr = Math.min(window.devicePixelRatio || 1, fallbackTier === "full" ? 2 : 1.35);
      fallbackCanvas.width = Math.max(1, Math.round(width * dpr));
      fallbackCanvas.height = Math.max(1, Math.round(height * dpr));
      fallbackContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now: number) => {
      if (disposed) return;
      const seconds = Math.min(0.1, Math.max(0, (now - previous) / 1000));
      previous = now;
      const state = activityRef.current;
      const audioLift = state === "speaking" || state === "listening" ? amplitudeRef.current * 0.45 : 0;
      const step = seconds * (SPEED[state] + audioLift);
      if (scene) {
        scene.frame(step);
      } else if (fallbackContext) {
        fallbackElapsed += step;
        const positions = paintUniverse(fallbackContext, {
          width: fallbackWidth,
          height: fallbackHeight,
          time: fallbackElapsed,
          camera: DEFAULT_CAMERA,
          tier: fallbackTier,
          stars: fallbackStars,
        });
        const uranus = positions.find((position) => position.planet.id === "offline");
        if (uranus) {
          const centerX = uranus.sx * fallbackWidth;
          const centerY = uranus.sy * fallbackHeight;
          for (let index = 0; index < URANUS_MOONS.length; index += 1) {
            const moon = URANUS_MOONS[index];
            const angle = moon.phase + fallbackElapsed * moon.speed;
            const orbit = Math.max(7, uranus.sr * fallbackWidth) + 3 + (index % 7) * 2.2;
            const x = centerX + Math.cos(angle) * orbit;
            const y = centerY + Math.sin(angle) * orbit * 0.42;
            fallbackContext.globalAlpha = 0.09;
            fallbackContext.strokeStyle = "#a9f0f4";
            fallbackContext.beginPath();
            fallbackContext.moveTo(centerX, centerY);
            fallbackContext.lineTo(x, y);
            fallbackContext.stroke();
            fallbackContext.globalAlpha = 0.52;
            fallbackContext.fillStyle = "#d7fbff";
            fallbackContext.beginPath();
            fallbackContext.arc(x, y, 0.6 + (index % 4) * 0.16, 0, Math.PI * 2);
            fallbackContext.fill();
          }
          fallbackContext.globalAlpha = 1;
        }
      }
      animation = requestAnimationFrame(frame);
    };

    const start = async () => {
      let webglError: unknown = null;
      if (webglAvailable) {
        try {
          // Three.js is an optional renderer. Keep it outside the initial OCADE
          // route graph so the public shell does not pay its production cost.
          const { createSolarScene } = await import("@/lib/landing/solar-scene");
          if (disposed) return;
          scene = createSolarScene(canvas, fallbackWidth, fallbackHeight, chosenTier);
          sceneRef.current = scene;
          setUsingFallback(false);
          setAvailable(true);
        } catch (error) {
          webglError = error;
        }
      }

      if (!scene) {
        fallbackContext = fallbackCanvas.getContext("2d");
        if (!fallbackContext) {
          console.error(
            "[OCADE solar scene] No WebGL or Canvas 2D renderer is available.",
            webglError,
          );
          if (!disposed) setAvailable(false);
          return;
        }
        setUsingFallback(true);
        fallbackTier = chosenTier === "still" ? "static" : chosenTier;
        fallbackStars = makeStars(starCountFor(fallbackTier));
        console.info("[OCADE solar scene] WebGL unavailable; using the verified Canvas 2D renderer.");
        setAvailable(true);
      }

      if (disposed) {
        sceneRef.current = null;
        scene?.dispose();
        return;
      }

      resizeFallback(fallbackWidth, fallbackHeight);
      resize = new ResizeObserver(([entry]) => {
        if (!entry || disposed) return;
        const width = Math.max(1, entry.contentRect.width);
        const height = Math.max(1, entry.contentRect.height);
        scene?.resize(width, height);
        resizeFallback(width, height);
      });
      resize.observe(host);
      animation = requestAnimationFrame(frame);
    };
    void start();

    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      resize?.disconnect();
      sceneRef.current = null;
      scene?.dispose();
    };
  }, []);

  const amplitude = Math.max(0, Math.min(1, voiceAmplitude));
  const brightness =
    activity === "emergency" ? 0.55 : 0.88 + (activity === "speaking" || activity === "listening" ? amplitude * 0.34 : 0);

  return (
    <div
      ref={hostRef}
      data-activity={activity}
      data-testid="solar-work-scene"
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_50%_48%,rgba(19,28,52,0.42),rgba(2,4,10,0.08)_56%,transparent_76%)]",
        activity === "emergency" && "ring-1 ring-destructive/50",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="OCADE solar work system with the Sun, eight planets, and 28 moons orbiting Uranus"
        className={cn(
          "h-full w-full touch-none transition-[filter,opacity] duration-300",
          usingFallback && "hidden",
          !available && "hidden",
          activity === "paused" && "opacity-60 grayscale-[0.35]",
          activity === "emergency" && "opacity-55 grayscale",
        )}
        style={{ filter: `brightness(${brightness}) saturate(${activity === "emergency" ? 0.35 : 1})` }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          sceneRef.current?.setPointer(
            ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
            1 - ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2,
          );
          const drag = dragRef.current;
          if (drag) {
            sceneRef.current?.orbitBy(event.clientX - drag.x, event.clientY - drag.y);
            dragRef.current = { x: event.clientX, y: event.clientY };
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onWheel={(event) => {
          const used = sceneRef.current?.zoom(event.deltaY);
          if (typeof used !== "symbol") event.preventDefault();
        }}
      />
      <canvas
        ref={fallbackCanvasRef}
        role="img"
        aria-label="OCADE solar work system with the Sun, eight planets, and 28 moons orbiting Uranus"
        className={cn(
          "h-full w-full transition-[filter,opacity] duration-300",
          !usingFallback && "hidden",
          activity === "paused" && "opacity-60 grayscale-[0.35]",
          activity === "emergency" && "opacity-55 grayscale",
        )}
        style={{ filter: `brightness(${brightness}) saturate(${activity === "emergency" ? 0.35 : 1})` }}
      />
      {!available ? (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Work system visualization unavailable on this graphics device.
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        OCADE is {activity}.
      </span>
    </div>
  );
}
