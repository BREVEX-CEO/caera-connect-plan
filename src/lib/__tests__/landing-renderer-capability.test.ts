import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isSoftwareRenderer,
  probeWebglRenderer,
  scenesShouldRun,
} from "@/lib/landing/renderer-capability";

/**
 * THE ONE DECISION THAT DECIDES WHETHER THE LANDING PAGE ANSWERS TAPS.
 *
 * With the scene running on a software rasteriser the landing route's Total
 * Blocking Time measured 2,933 ms against PLAN.md §26's 200 ms budget; with the
 * scene's chunk blocked it measured 234 ms. So this predicate is worth real
 * tests rather than a glance: a false negative costs every visitor on a machine
 * without a GPU three seconds of a page that ignores them, and a false positive
 * costs every OTHER visitor the product's opening image.
 *
 * The strings below are the ones these renderers actually report, not invented
 * examples.
 */

const SOFTWARE = [
  "Google Inc. (Google) ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))",
  "llvmpipe (LLVM 15.0.7, 256 bits)",
  "Mesa/X.org, softpipe",
  "Microsoft Basic Render Driver",
  "Software Rasterizer",
];

const HARDWARE = [
  "Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
  "Apple GPU",
  "Google Inc. (Intel) ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
  "Mali-G78 MP14",
  "Adreno (TM) 730",
  "AMD Radeon Pro 5500M OpenGL Engine",
];

describe("the renderer behind a WebGL context", () => {
  it("recognises every software rasteriser by the string it really reports", () => {
    for (const renderer of SOFTWARE) {
      expect(isSoftwareRenderer(renderer), renderer).toBe(true);
      expect(scenesShouldRun(renderer).run, renderer).toBe(false);
    }
  });

  it("does not mistake a real GPU for one", () => {
    for (const renderer of HARDWARE) {
      expect(isSoftwareRenderer(renderer), renderer).toBe(false);
      expect(scenesShouldRun(renderer).run, renderer).toBe(true);
    }
  });

  it("fails open when the browser will not say", () => {
    /*
     * A privacy-hardened profile hides `WEBGL_debug_renderer_info` entirely.
     * Unknown is treated as hardware: withholding the product's opening image
     * because the browser would not identify itself is the wrong way to be
     * wrong, and a context that genuinely cannot be created still reports
     * itself through the scene's own failure path.
     */
    expect(isSoftwareRenderer(null)).toBe(false);
    expect(isSoftwareRenderer(undefined)).toBe(false);
    expect(isSoftwareRenderer("")).toBe(false);
    expect(scenesShouldRun(null).run).toBe(true);
  });

  it("carries the renderer it decided on, so a diagnostic can name it", () => {
    expect(scenesShouldRun("llvmpipe (LLVM 15.0.7, 256 bits)")).toEqual({
      run: false,
      renderer: "llvmpipe (LLVM 15.0.7, 256 bits)",
    });
  });

  it("returns null rather than throwing where there is no document", () => {
    // Server rendering reaches this module through the component's import
    // graph; a probe that throws there would take the whole route with it.
    expect(probeWebglRenderer()).toBeNull();
  });
});

describe("the scene component", () => {
  const SOURCE = fileURLToPath(
    new URL("../../components/landing/SolarSystem.tsx", import.meta.url),
  );

  it("asks before it builds, not after", () => {
    const source = readFileSync(SOURCE, "utf8");
    const ask = source.indexOf("scenesShouldRun()");
    const build = source.indexOf("createSolarScene(");
    expect(ask).toBeGreaterThan(0);
    expect(build).toBeGreaterThan(0);
    // Building first and tearing down after would pay the whole cost anyway.
    expect(ask).toBeLessThan(build);
  });

  it("says which of the two things happened, rather than one word for both", () => {
    // "cannot" and "should not" are different facts, and a diagnostic that
    // conflates them cannot tell a broken driver from a missing GPU.
    const source = readFileSync(SOURCE, "utf8");
    expect(source).toContain('data-scene={declined ? "declined"');
    expect(source).toContain('"unavailable"');
  });
});
