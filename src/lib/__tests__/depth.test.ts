import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEPTH,
  FLAT,
  MAX_TILT_DEGREES,
  SCENE_PERSPECTIVE,
  depthMode,
  normalisePointer,
  tiltFor,
  transformFor,
  type DepthLevel,
} from "../motion/depth";

/**
 * The geometry of the application's third dimension.
 *
 * Pure functions, so the scene can be reasoned about without a browser — the
 * same split `universe.ts` makes between geometry and renderer. The properties
 * asserted here are the ones that produce something that looks BROKEN rather
 * than merely different when they are wrong: an inverted parallax reads as the
 * scene turning inside out, a NaN silently removes an element from the page,
 * and a scale that disagrees with the stylesheet gives a panel a shadow for a
 * depth it is not at.
 */

const LEVELS = Object.keys(DEPTH) as DepthLevel[];

describe("the depth scale", () => {
  it("starts at exactly zero, so opting out does not displace a surface", () => {
    expect(DEPTH.base).toBe(0);
  });

  it("increases strictly, so every level is distinguishable from the next", () => {
    const values = LEVELS.map((l) => DEPTH[l]);
    for (let i = 1; i < values.length; i += 1) {
      expect(
        values[i],
        `${LEVELS[i]} is not further forward than ${LEVELS[i - 1]}`,
      ).toBeGreaterThan(values[i - 1]);
    }
  });

  it("keeps the tilt small enough to read long text through", () => {
    // Past roughly 4° a paragraph loses its baseline. This is an application
    // people work inside for hours, not a hero card.
    expect(MAX_TILT_DEGREES).toBeLessThanOrEqual(4);
    expect(MAX_TILT_DEGREES).toBeGreaterThan(0);
  });

  it("uses a long enough lens that a full-width workspace does not shear", () => {
    expect(SCENE_PERSPECTIVE).toBeGreaterThanOrEqual(1200);
  });
});

describe("the stylesheet and the module agree", () => {
  /*
   * THE FAILURE THIS CATCHES. The Z positions live in two places by necessity:
   * the transform is computed in CSS so it runs on the compositor, and the
   * scale is declared here so it can be reasoned about and tested. Nothing
   * connects them but this test. When they drift, a panel is positioned at one
   * depth and given the shadow of another — which does not throw, does not fail
   * a render test, and looks like a design mistake rather than a bug.
   */
  /*
   * CRLF normalised before matching. This repository has `core.autocrlf=true`
   * and no `.gitattributes`, so a fresh clone on Windows gets CRLF line
   * endings — and the `\n`-based ordering check below would then find nothing
   * and fail on a machine that had changed nothing. `check-final-readiness.mjs`
   * documents the same trap costing a whole gate.
   */
  const css = readFileSync("src/styles.css", "utf8").replace(/\r\n/g, "\n");

  it.each(LEVELS)("declares %s at the same depth in both places", (level) => {
    const rule = new RegExp(`\\.depth-${level}\\s*\\{\\s*--depth-level:\\s*(\\d+)px`, "m").exec(
      css,
    );
    expect(rule, `.depth-${level} is missing from the stylesheet`).toBeTruthy();
    expect(Number(rule![1]), `.depth-${level} disagrees with DEPTH.${level}`).toBe(DEPTH[level]);
  });

  it("declares the same camera distance the module does", () => {
    expect(css).toMatch(new RegExp(`--scene-perspective,\\s*${SCENE_PERSPECTIVE}px`));
  });

  it("declares the same maximum tilt the module does", () => {
    expect(css).toMatch(new RegExp(`--tilt-max:\\s*${MAX_TILT_DEGREES}deg`));
  });

  it("defines the levels UNLAYERED, or they lose to .ocade-depth's default", () => {
    /*
     * Written as `@utility depth-raised` first, and every panel rendered flat
     * while carrying the correct class: Tailwind emits `@utility` inside a
     * cascade layer, and unlayered CSS beats layered CSS regardless of
     * specificity, so `.ocade-depth { --depth-level: 0px }` won every time.
     * Silent, and invisible to every other test.
     */
    // Anchored to the start of a line: the comment above this rule in
    // styles.css quotes `@utility depth-raised` while explaining why it is
    // wrong, and an unanchored pattern matched the prose rather than the code.
    expect(css, "the depth levels are back inside a Tailwind layer").not.toMatch(
      /^@utility\s+depth-(base|raised|elevated|floating|overlay|modal)/m,
    );
    // The default must still come FIRST, so source order lets the levels win.
    expect(css.indexOf("--depth-level: 0px;\n  --depth-boost")).toBeLessThan(
      css.indexOf(".depth-raised"),
    );
  });
});

describe("tilt responds to the pointer", () => {
  it("is flat at the centre of the scene", () => {
    expect(tiltFor("elevated", 0, 0)).toEqual(FLAT);
  });

  it("pushes the edge nearest the pointer AWAY, rather than following it", () => {
    // Following the pointer makes panels appear to flee the cursor.
    const right = tiltFor("elevated", 1, 0);
    expect(right.rotateY).toBeLessThan(0);
    const below = tiltFor("elevated", 0, 1);
    expect(below.rotateX).toBeGreaterThan(0);
  });

  it("moves deeper surfaces further, which is the whole illusion", () => {
    const near = tiltFor("overlay", 1, 0);
    const far = tiltFor("raised", 1, 0);
    expect(Math.abs(near.translateX)).toBeGreaterThan(Math.abs(far.translateX));
  });

  it("does not move a surface at the base plane at all", () => {
    const base = tiltFor("base", 1, 1);
    expect(base.translateX).toBe(0);
    expect(base.translateY).toBe(0);
  });

  it("never exceeds the maximum tilt, however far the pointer is pushed", () => {
    for (const [x, y] of [
      [5, 5],
      [-99, 42],
      [1, -1],
    ]) {
      const t = tiltFor("modal", x, y);
      expect(Math.abs(t.rotateX)).toBeLessThanOrEqual(MAX_TILT_DEGREES);
      expect(Math.abs(t.rotateY)).toBeLessThanOrEqual(MAX_TILT_DEGREES);
    }
  });

  it("scales with intensity, and vanishes at zero", () => {
    expect(tiltFor("elevated", 1, 1, 0)).toEqual(FLAT);
    const half = tiltFor("elevated", 1, 0, 0.5);
    const full = tiltFor("elevated", 1, 0, 1);
    expect(Math.abs(half.rotateY)).toBeCloseTo(Math.abs(full.rotateY) / 2, 5);
  });

  it("treats a non-finite pointer as the centre rather than propagating NaN", () => {
    // A NaN in a transform removes the element from the scene entirely, with
    // no error — the worst possible way for a measurement bug to surface.
    expect(tiltFor("elevated", NaN, 0)).toEqual(FLAT);
    expect(tiltFor("elevated", 0, Infinity).rotateX).toBe(0);
  });
});

describe("the CSS transform it produces", () => {
  it("translates before it rotates, or parallax drifts as a panel turns", () => {
    const css = transformFor("elevated", tiltFor("elevated", 1, 0));
    expect(css.indexOf("translate3d")).toBeLessThan(css.indexOf("rotateX"));
  });

  it("places a surface at its declared depth", () => {
    expect(transformFor("floating")).toContain(`${DEPTH.floating}px)`);
  });

  it("is a single composited translate3d rather than separate axes", () => {
    expect(transformFor("raised")).toMatch(/^translate3d\(/);
  });

  it("never emits NaN into a transform", () => {
    expect(transformFor("modal", tiltFor("modal", NaN, NaN))).not.toMatch(/NaN/);
  });
});

describe("how much depth a device and a person get", () => {
  const base = { reducedMotion: false, osReducedMotion: false, hasDom: true } as const;

  it("gives a capable device the full scene", () => {
    expect(depthMode({ ...base, tier: "full" })).toBe("full");
  });

  it("removes the third dimension entirely under reduced motion, from either source", () => {
    /*
     * A still perspective scene is still a perspective scene: text on tilted
     * planes and shadows implying depth are exactly what someone who set this
     * preference is asking the product to stop doing. Both the OS preference
     * and the in-app switch reach the same state, so neither can be worked
     * around by the other.
     */
    expect(depthMode({ ...base, osReducedMotion: true, tier: "full" })).toBe("flat");
    expect(depthMode({ ...base, reducedMotion: true, tier: "full" })).toBe("flat");
    expect(depthMode({ ...base, reducedMotion: true, tier: "reduced" })).toBe("flat");
  });

  it("goes still on a device measured as unable to animate", () => {
    expect(depthMode({ ...base, tier: "static" })).toBe("static");
    expect(depthMode({ ...base, tier: "reduced" })).toBe("static");
  });

  it("goes fully flat where 3D cannot be composited at all", () => {
    expect(depthMode({ ...base, tier: "full", supports3d: false })).toBe("flat");
  });

  it("goes flat on the server, so markup matches the first client render", () => {
    expect(depthMode({ ...base, tier: "full", hasDom: false })).toBe("flat");
  });
});

describe("normalising a pointer into the scene", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };

  it("puts the centre of the rectangle at the origin", () => {
    expect(normalisePointer(200, 100, rect)).toEqual({ x: 0, y: 0 });
  });

  it("puts the corners at the unit extremes", () => {
    expect(normalisePointer(100, 50, rect)).toEqual({ x: -1, y: -1 });
    expect(normalisePointer(300, 150, rect)).toEqual({ x: 1, y: 1 });
  });

  it("clamps a pointer outside the rectangle instead of running away", () => {
    expect(normalisePointer(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
  });

  it("returns the centre for an unlaid-out element rather than dividing by zero", () => {
    // A real state during the first frame; NaN here would blank the element.
    expect(normalisePointer(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});
