import { useEffect, useRef } from "react";

interface DustParticle {
  x: number;
  y: number;
  depth: number;
  radius: number;
  driftX: number;
  driftY: number;
  phase: number;
  warmth: number;
}

interface Ripple {
  x: number;
  y: number;
  bornAt: number;
  strength: number;
}

/**
 * Filmic atmosphere over the real Three.js landing universe.
 *
 * This is deliberately a 2D compositing layer rather than another WebGL
 * context. The solar system already owns the expensive GPU context; opening a
 * second one for dust, lensing and pointer flow would waste memory and make
 * mobile browsers more likely to evict the actual 3D scene.
 *
 * The layer is pointer-transparent. Every click, drag and wheel gesture still
 * reaches the solar-system canvas underneath it. Window-level listeners are
 * used only to paint the interaction response.
 */
export function CosmicInteractionLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowPower = (nav.deviceMemory ?? 4) <= 2 || (nav.hardwareConcurrency ?? 4) <= 2;
    const particleCount = reducedMotion ? 52 : lowPower ? 72 : 132;
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.45);

    let width = 1;
    let height = 1;
    let frame = 0;
    let running = true;
    let last = performance.now();

    const pointer = { x: 0.5, y: 0.45, targetX: 0.5, targetY: 0.45, energy: 0 };
    const trail: Array<{ x: number; y: number; alpha: number }> = [];
    const ripples: Ripple[] = [];

    // Fixed deterministic seed: stable visual density without shipping assets.
    let seed = 0x28cae8a;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    const particles: DustParticle[] = Array.from({ length: particleCount }, () => ({
      x: random(),
      y: random(),
      depth: 0.2 + random() * 0.8,
      radius: 0.35 + Math.pow(random(), 2.8) * 1.8,
      driftX: (random() - 0.5) * 0.0022,
      driftY: (random() - 0.5) * 0.0015,
      phase: random() * Math.PI * 2,
      warmth: random(),
    }));

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onPointerMove = (event: PointerEvent) => {
      pointer.targetX = event.clientX / Math.max(1, width);
      pointer.targetY = event.clientY / Math.max(1, height);
      pointer.energy = Math.min(1, pointer.energy + 0.16);
      if (!reducedMotion) {
        trail.push({ x: event.clientX, y: event.clientY, alpha: 0.22 });
        if (trail.length > 16) trail.shift();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (reducedMotion) return;
      ripples.push({
        x: event.clientX,
        y: event.clientY,
        bornAt: performance.now(),
        strength: event.pointerType === "touch" ? 0.72 : 1,
      });
      if (ripples.length > 6) ripples.shift();
      pointer.energy = 1;
    };

    const drawNebula = (now: number) => {
      const t = reducedMotion ? 0 : now * 0.00004;
      context.save();
      context.globalCompositeOperation = "screen";

      const fields = [
        {
          x: width * (0.72 + Math.sin(t * 0.8) * 0.035),
          y: height * (0.22 + Math.cos(t) * 0.035),
          r: Math.max(width, height) * 0.56,
          inner: "rgba(36, 151, 255, 0.075)",
          mid: "rgba(18, 87, 173, 0.018)",
          outer: "rgba(0, 18, 42, 0)",
        },
        {
          x: width * (0.34 + Math.cos(t * 0.65) * 0.045),
          y: height * (0.72 + Math.sin(t * 0.9) * 0.04),
          r: Math.max(width, height) * 0.48,
          inner: "rgba(30, 232, 224, 0.038)",
          mid: "rgba(20, 107, 122, 0.014)",
          outer: "rgba(2, 15, 28, 0)",
        },
        {
          x: width * (0.88 + Math.sin(t * 0.5) * 0.02),
          y: height * (0.52 + Math.cos(t * 0.55) * 0.03),
          r: Math.max(width, height) * 0.38,
          inner: "rgba(255, 157, 62, 0.034)",
          mid: "rgba(126, 61, 22, 0.012)",
          outer: "rgba(27, 10, 0, 0)",
        },
      ];

      for (const field of fields) {
        const gradient = context.createRadialGradient(field.x, field.y, 0, field.x, field.y, field.r);
        gradient.addColorStop(0, field.inner);
        gradient.addColorStop(0.42, field.mid);
        gradient.addColorStop(1, field.outer);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }
      context.restore();
    };

    const drawDust = (dt: number, now: number) => {
      context.save();
      context.globalCompositeOperation = "screen";
      const px = (pointer.x - 0.5) * 22;
      const py = (pointer.y - 0.5) * 16;

      for (const particle of particles) {
        if (!reducedMotion) {
          particle.x = (particle.x + particle.driftX * dt + 1) % 1;
          particle.y = (particle.y + particle.driftY * dt + 1) % 1;
        }
        const twinkle = 0.58 + Math.sin(now * 0.0012 + particle.phase) * 0.22;
        const x = particle.x * width - px * particle.depth;
        const y = particle.y * height - py * particle.depth;
        const alpha = (0.05 + particle.depth * 0.15) * twinkle;
        context.beginPath();
        context.arc(x, y, particle.radius * particle.depth, 0, Math.PI * 2);
        context.fillStyle =
          particle.warmth > 0.88
            ? `rgba(255, 199, 139, ${alpha * 0.72})`
            : `rgba(176, 222, 255, ${alpha})`;
        context.fill();
      }
      context.restore();
    };

    const drawLiquidPointer = (now: number) => {
      if (reducedMotion) return;
      const x = pointer.x * width;
      const y = pointer.y * height;

      context.save();
      context.globalCompositeOperation = "screen";

      // A refractive-looking lens halo. It is intentionally faint; it should
      // feel like the field responds to the hand, not like a custom cursor.
      const radius = 82 + pointer.energy * 46;
      const lens = context.createRadialGradient(x, y, 2, x, y, radius);
      lens.addColorStop(0, `rgba(154, 239, 255, ${0.045 + pointer.energy * 0.03})`);
      lens.addColorStop(0.35, `rgba(61, 155, 255, ${0.028 + pointer.energy * 0.02})`);
      lens.addColorStop(0.72, "rgba(53, 96, 220, 0.012)");
      lens.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = lens;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      if (trail.length > 1) {
        context.lineCap = "round";
        context.lineJoin = "round";
        for (let i = 1; i < trail.length; i += 1) {
          const previous = trail[i - 1];
          const point = trail[i];
          const life = i / trail.length;
          context.beginPath();
          context.moveTo(previous.x, previous.y);
          const cx = (previous.x + point.x) / 2 + Math.sin(now * 0.002 + i) * 2.4;
          const cy = (previous.y + point.y) / 2 + Math.cos(now * 0.0018 + i) * 2.4;
          context.quadraticCurveTo(cx, cy, point.x, point.y);
          context.strokeStyle = `rgba(91, 207, 255, ${point.alpha * life * 0.24})`;
          context.lineWidth = 1.2 + life * 5.5;
          context.stroke();
          point.alpha *= 0.91;
        }
        while (trail.length && trail[0].alpha < 0.018) trail.shift();
      }
      context.restore();
    };

    const drawRipples = (now: number) => {
      if (reducedMotion || ripples.length === 0) return;
      context.save();
      context.globalCompositeOperation = "screen";

      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const ripple = ripples[i];
        const age = (now - ripple.bornAt) / 1000;
        if (age > 1.35) {
          ripples.splice(i, 1);
          continue;
        }
        const progress = age / 1.35;
        const radius = 26 + progress * Math.min(width, height) * 0.18;
        const alpha = Math.pow(1 - progress, 1.8) * 0.22 * ripple.strength;

        context.beginPath();
        context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        context.strokeStyle = `rgba(132, 226, 255, ${alpha})`;
        context.lineWidth = 1.4 + (1 - progress) * 1.8;
        context.stroke();

        context.beginPath();
        context.arc(ripple.x, ripple.y, radius * 0.72, 0, Math.PI * 2);
        context.strokeStyle = `rgba(74, 130, 255, ${alpha * 0.42})`;
        context.lineWidth = 1;
        context.stroke();
      }
      context.restore();
    };

    const draw = (now: number) => {
      if (!running) return;
      const dt = Math.min(2.5, Math.max(0, (now - last) / 16.667));
      last = now;
      pointer.x += (pointer.targetX - pointer.x) * (reducedMotion ? 1 : 0.085);
      pointer.y += (pointer.targetY - pointer.y) * (reducedMotion ? 1 : 0.085);
      pointer.energy *= reducedMotion ? 0 : 0.94;

      context.clearRect(0, 0, width, height);
      drawNebula(now);
      drawDust(dt, now);
      drawLiquidPointer(now);
      drawRipples(now);

      if (!reducedMotion) frame = requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    draw(performance.now());

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[5] h-screen w-screen opacity-90 mix-blend-screen"
    />
  );
}
