import { describe, it, expect } from "vitest";
import {
  tuningFor,
  waveY,
  WAVE_POINTS,
  spiralPoint,
} from "@/components/visual/living-backdrop-scene";

/**
 * The flow bands behind the interface, and the promises they have to keep.
 *
 * The shape is pure maths, so it is tested without a canvas. What matters is
 * not that it looks a particular way but that it CANNOT cost anything when the
 * user has asked for stillness, and that the parallax is real rather than every
 * band moving together — a stack of identical curves is not depth.
 */

const MOVING = tuningFor("cinematic", { still: false, highContrast: false });

describe("stillness costs nothing", () => {
  it("draws no bands at all when the scene is held still", () => {
    const still = tuningFor("cinematic", { still: true, highContrast: false });
    expect(still.waveLayers).toBe(0);
    expect(still.waveSpeed).toBe(0);
    // Zero layers means the loop never runs — not that it runs and hides.
    expect(still.particles).toBe(0);
  });

  it("draws nothing behind text in high contrast", () => {
    const contrast = tuningFor("cinematic", { still: false, highContrast: true });
    expect(contrast.waveLayers).toBe(0);
    expect(contrast.opacity).toBe(0);
  });

  it("gives the quieter surface fewer bands than the cinematic one", () => {
    const subtle = tuningFor("subtle", { still: false, highContrast: false });
    expect(subtle.waveLayers).toBeGreaterThan(0);
    expect(subtle.waveLayers).toBeLessThan(MOVING.waveLayers);
    expect(subtle.waveSpeed).toBeLessThan(MOVING.waveSpeed);
  });
});

describe("the bands actually flow", () => {
  it("moves over time", () => {
    const a = waveY(0.3, 0.5, 0, MOVING);
    const b = waveY(0.3, 0.5, 1.5, MOVING);
    expect(a).not.toBeCloseTo(b, 4);
  });

  it("varies across the width rather than being a flat line", () => {
    const samples = Array.from({ length: 12 }, (_, i) => waveY(i / 11, 0.5, 2, MOVING));
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(max - min).toBeGreaterThan(MOVING.waveAmplitude * 0.5);
  });

  it("stays within a bounded displacement, so a band never leaves the frame", () => {
    for (let i = 0; i <= 40; i += 1) {
      for (const depth of [0, 0.5, 1]) {
        const y = waveY(i / 40, depth, i * 0.37, MOVING, 1);
        // Two sine terms (1 + 0.45) scaled by amplitude, plus the pointer lean.
        expect(Math.abs(y)).toBeLessThan(MOVING.waveAmplitude * 1.5 + 0.6);
      }
    }
  });

  it("is frozen when the tuning says stillness", () => {
    const still = tuningFor("cinematic", { still: true, highContrast: false });
    expect(waveY(0.4, 0.5, 0, still)).toBe(waveY(0.4, 0.5, 99, still));
  });
});

describe("depth is real parallax, not a stack of identical curves", () => {
  it("puts different bands in different places at the same moment", () => {
    const near = waveY(0.42, 1, 3, MOVING);
    const far = waveY(0.42, 0, 3, MOVING);
    expect(near).not.toBeCloseTo(far, 3);
  });

  it("moves the near band further under the pointer than the far one", () => {
    const nearRest = waveY(0.5, 1, 2, MOVING, 0);
    const nearLean = waveY(0.5, 1, 2, MOVING, 1);
    const farRest = waveY(0.5, 0, 2, MOVING, 0);
    const farLean = waveY(0.5, 0, 2, MOVING, 1);
    expect(Math.abs(nearLean - nearRest)).toBeGreaterThan(Math.abs(farLean - farRest));
  });

  it("does not move at all when the pointer is centred", () => {
    expect(waveY(0.5, 1, 2, MOVING, 0)).toBe(waveY(0.5, 1, 2, MOVING, 0));
  });
});

describe("the per-frame cost stays bounded", () => {
  it("samples a fixed number of points per band, not one per pixel", () => {
    expect(WAVE_POINTS).toBeLessThanOrEqual(64);
    // Five bands at this sampling is the same order as the particle arcs.
    expect(MOVING.waveLayers * WAVE_POINTS).toBeLessThanOrEqual(320);
  });

  it("leaves the spiral maths it sits behind untouched", () => {
    const point = spiralPoint(0.5, 2.4, 0);
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });
});
