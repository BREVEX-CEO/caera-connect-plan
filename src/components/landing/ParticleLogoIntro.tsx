import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { IntroPhase, RenderTier } from "@/lib/landing/universe";

interface ParticleLogoIntroProps {
  phase: IntroPhase;
  reducedMotion: boolean;
  tier: RenderTier;
}

interface Particle {
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  red: number;
  green: number;
  blue: number;
  size: number;
  delay: number;
}

/** Deterministic random numbers keep the formation identical on every replay. */
function randomGenerator(seed = 0x0cade28) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function easeOutQuint(value: number) {
  const bounded = Math.min(1, Math.max(0, value));
  return 1 - (1 - bounded) ** 5;
}

/**
 * Builds the OCADE seal from depth-scattered particles.
 *
 * The source is the same-origin brand asset, so the animation remains usable
 * offline and never pulls a logo, font or script from a CDN. The canvas is
 * decorative; the real heading directly beneath it remains selectable,
 * keyboard-safe and readable by assistive technology.
 */
export function ParticleLogoIntro({ phase, reducedMotion, tier }: ParticleLogoIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = phase !== "ambient" && !reducedMotion && tier !== "static";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let animationFrame = 0;
    let cancelled = false;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let ratio = 1;
    const startedAt = performance.now();
    const random = randomGenerator();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const image = new Image();
    image.decoding = "async";
    image.src = "/brand/ocade-carcc-mark.png";

    const buildParticles = () => {
      const sampleSize = tier === "full" ? 240 : 180;
      const sample = document.createElement("canvas");
      sample.width = sampleSize;
      sample.height = sampleSize;
      const sampleContext = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return;
      sampleContext.drawImage(image, 0, 0, sampleSize, sampleSize);
      const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
      const step = tier === "full" ? 4 : 5;
      const scale = Math.min(width, height) * 0.52;
      const left = width / 2 - scale / 2;
      const top = height * 0.42 - scale / 2;
      const next: Particle[] = [];

      for (let y = 0; y < sampleSize; y += step) {
        for (let x = 0; x < sampleSize; x += step) {
          const offset = (y * sampleSize + x) * 4;
          const alpha = pixels[offset + 3];
          const luminance = pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
          if (alpha < 72 || luminance < 54) continue;
          const angle = random() * Math.PI * 2;
          const radius = Math.max(width, height) * (0.42 + random() * 0.52);
          next.push({
            startX: width / 2 + Math.cos(angle) * radius,
            startY: height * 0.42 + Math.sin(angle) * radius,
            startZ: -900 + random() * 1_800,
            targetX: left + (x / sampleSize) * scale,
            targetY: top + (y / sampleSize) * scale,
            red: pixels[offset],
            green: pixels[offset + 1],
            blue: pixels[offset + 2],
            size: 0.65 + random() * 1.5,
            delay: random() * 0.34,
          });
        }
      }
      particles = next;
    };

    const draw = (now: number) => {
      if (cancelled) return;
      context.clearRect(0, 0, width, height);
      const elapsed = (now - startedAt) / 1_950;
      context.save();
      context.globalCompositeOperation = "lighter";

      for (const particle of particles) {
        const progress = easeOutQuint((elapsed - particle.delay) / (1 - particle.delay));
        if (progress <= 0) continue;
        const z = particle.startZ * (1 - progress);
        const perspective = 760 / Math.max(120, 760 + z);
        const x =
          (particle.startX + (particle.targetX - particle.startX) * progress - width / 2) *
            perspective +
          width / 2;
        const y =
          (particle.startY + (particle.targetY - particle.startY) * progress - height * 0.42) *
            perspective +
          height * 0.42;
        const opacity = Math.min(1, progress * 1.7) * (0.52 + perspective * 0.36);
        context.fillStyle = `rgba(${particle.red},${particle.green},${particle.blue},${opacity})`;
        context.beginPath();
        context.arc(x, y, Math.max(0.45, particle.size * perspective), 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
      animationFrame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (image.complete && image.naturalWidth > 0) buildParticles();
    });
    observer.observe(canvas);
    resize();
    image.addEventListener("load", buildParticles, { once: true });
    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      image.removeEventListener("load", buildParticles);
      context.clearRect(0, 0, width, height);
    };
  }, [active, tier]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-20 h-[100svh] w-full transition-opacity duration-700",
        phase === "ignition" ? "opacity-0" : "opacity-100",
      )}
    />
  );
}
