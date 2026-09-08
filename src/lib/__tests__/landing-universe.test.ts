import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PLANETS,
  DEFAULT_CAMERA,
  MAX_PITCH,
  MIN_PITCH,
  MIN_DISTANCE,
  MAX_DISTANCE,
  clampCamera,
  positionsAt,
  planetAtPointer,
  introPhaseAt,
  introSeen,
  markIntroSeen,
  forgetIntro,
  chooseRenderTier,
  starCountFor,
  INTRO_TIMELINE,
} from "../landing/universe";

/**
 * The landing universe, tested as maths.
 *
 * The renderer is a canvas and cannot be pixel-asserted here, so the geometry,
 * the hit testing, the intro sequencing and the quality tiers all live in pure
 * functions and those are what these tests hold. What is left in the renderer
 * is drawing calls — the part where a mistake is visible immediately.
 *
 * The cases below are the ones that break a scene like this in production: a
 * planet crossing the camera plane and producing an infinity, a hit test that
 * becomes an ellipse on a wide monitor, an intro that replays forever, and a
 * device that cannot carry the frame budget.
 */

describe("the system is eight capabilities, each with a real benefit", () => {
  it("has exactly eight planets", () => {
    // The composition depends on the count: a ninth orbit either overlaps or
    // leaves the frame on a laptop.
    expect(PLANETS).toHaveLength(8);
  });

  it("gives every planet a unique id and a distinct orbit", () => {
    expect(new Set(PLANETS.map((p) => p.id)).size).toBe(8);
    const orbits = PLANETS.map((p) => p.orbit);
    expect(new Set(orbits).size).toBe(8);
    // Ascending, so the legend order matches what the eye sees outward.
    expect([...orbits].sort((a, b) => a - b)).toEqual(orbits);
  });

  it("states a concrete benefit, not a decorative phrase", () => {
    for (const planet of PLANETS) {
      expect(planet.benefit.length, `${planet.id} has no real benefit`).toBeGreaterThan(40);
      // A benefit that could sit on any product's landing page is not a benefit.
      expect(planet.benefit).not.toMatch(/innovat|synerg|next.gen|revolutionar|seamless/i);
    }
  });

  it("names the capabilities the product actually has", () => {
    const ids = PLANETS.map((p) => p.id);
    for (const id of [
      "chat",
      "files",
      "vision",
      "links",
      "voice",
      "projects",
      "offline",
      "automations",
    ]) {
      expect(ids, `${id} is missing`).toContain(id);
    }
  });

  it("varies orbit direction, so the system does not read as one dial", () => {
    const retrograde = PLANETS.filter((p) => p.speed < 0);
    expect(retrograde.length).toBeGreaterThan(0);
    expect(retrograde.length).toBeLessThan(PLANETS.length);
  });
});

describe("projection stays finite in every camera position", () => {
  it("produces finite screen coordinates across a full orbit", () => {
    for (let t = 0; t < 120; t += 0.37) {
      for (const position of positionsAt(t, DEFAULT_CAMERA, 1.78)) {
        expect(Number.isFinite(position.sx), `${position.planet.id} sx at t=${t}`).toBe(true);
        expect(Number.isFinite(position.sy), `${position.planet.id} sy at t=${t}`).toBe(true);
        expect(Number.isFinite(position.sr), `${position.planet.id} sr at t=${t}`).toBe(true);
        expect(position.sr).toBeGreaterThan(0);
      }
    }
  });

  it("survives a camera pulled inside the outermost orbit", () => {
    /*
     * The failure this guards: a planet passing through the camera plane makes
     * the perspective divisor zero, the coordinate becomes Infinity, and the
     * canvas drops the entire frame. The divisor is floored instead.
     */
    const close = clampCamera({ ...DEFAULT_CAMERA, distance: MIN_DISTANCE });
    for (let t = 0; t < 80; t += 0.21) {
      for (const position of positionsAt(t, close, 1.0)) {
        expect(Number.isFinite(position.sx)).toBe(true);
        expect(Number.isFinite(position.sr)).toBe(true);
      }
    }
  });

  it("sorts furthest first, so nearer planets draw on top", () => {
    const positions = positionsAt(3.2, DEFAULT_CAMERA, 1.6);
    const zs = positions.map((p) => p.z);
    expect([...zs].sort((a, b) => a - b)).toEqual(zs);
  });

  it("moves the planets as time advances", () => {
    const a = positionsAt(0, DEFAULT_CAMERA, 1.6).find((p) => p.planet.id === "chat")!;
    const b = positionsAt(6, DEFAULT_CAMERA, 1.6).find((p) => p.planet.id === "chat")!;
    expect(Math.abs(a.sx - b.sx) + Math.abs(a.sy - b.sy)).toBeGreaterThan(0.01);
  });
});

describe("the camera cannot be turned into a broken state", () => {
  it("clamps pitch so the system never flips over", () => {
    expect(clampCamera({ ...DEFAULT_CAMERA, pitch: 99 }).pitch).toBe(MAX_PITCH);
    expect(clampCamera({ ...DEFAULT_CAMERA, pitch: -99 }).pitch).toBe(MIN_PITCH);
  });

  it("clamps distance so the camera cannot fly through the core or off to nothing", () => {
    expect(clampCamera({ ...DEFAULT_CAMERA, distance: 0 }).distance).toBe(MIN_DISTANCE);
    expect(clampCamera({ ...DEFAULT_CAMERA, distance: 9999 }).distance).toBe(MAX_DISTANCE);
  });

  it("leaves yaw unbounded, because spinning right round is fine", () => {
    expect(clampCamera({ ...DEFAULT_CAMERA, yaw: 42 }).yaw).toBe(42);
  });
});

describe("hit testing behaves the way a pointer expects", () => {
  it("finds the planet under the pointer", () => {
    const positions = positionsAt(1.5, DEFAULT_CAMERA, 1.6);
    const target = positions[positions.length - 1];
    const hit = planetAtPointer(positions, target.sx, target.sy, 1.6);
    expect(hit?.planet.id).toBe(target.planet.id);
  });

  it("returns nothing in empty space", () => {
    const positions = positionsAt(1.5, DEFAULT_CAMERA, 1.6);
    // Far outside the projected system.
    expect(planetAtPointer(positions, -5, -5, 1.6)).toBeNull();
  });

  it("corrects for aspect, so the hit area is a circle and not an ellipse", () => {
    /*
     * Without the aspect correction the target is stretched horizontally on a
     * wide monitor: a pointer well to the side of a planet registers as a hit
     * and the one directly above it does not.
     */
    const positions = positionsAt(2, DEFAULT_CAMERA, 2.4);
    const target = positions[positions.length - 1];
    const offset = target.sr * 1.5;
    const horizontal = planetAtPointer(positions, target.sx + offset, target.sy, 2.4);
    const vertical = planetAtPointer(positions, target.sx, target.sy + offset, 2.4);
    // On a 2.4 aspect the horizontal offset is the larger real distance, so it
    // must be the one that misses first.
    expect(Boolean(vertical)).toBe(true);
    expect(horizontal).toBeNull();
  });

  it("prefers the nearer planet where two overlap", () => {
    const near = {
      z: 5,
      sx: 0.5,
      sy: 0.5,
      sr: 0.1,
      planet: PLANETS[0],
      x: 0,
      y: 0,
      depth: 1,
      spinAngle: 0,
    };
    const far = {
      z: -5,
      sx: 0.5,
      sy: 0.5,
      sr: 0.1,
      planet: PLANETS[1],
      x: 0,
      y: 0,
      depth: 0,
      spinAngle: 0,
    };
    expect(planetAtPointer([far, near], 0.5, 0.5, 1)?.planet.id).toBe(PLANETS[0].id);
  });
});

describe("the opening plays once and never blocks the actions", () => {
  it("runs in order and settles into ambient", () => {
    expect(introPhaseAt(0)).toBe("wordmark");
    expect(introPhaseAt(INTRO_TIMELINE.established)).toBe("established");
    expect(introPhaseAt(INTRO_TIMELINE.ignition)).toBe("ignition");
    expect(introPhaseAt(INTRO_TIMELINE.ambient)).toBe("ambient");
    // And stays there rather than looping back to the opening.
    expect(introPhaseAt(60_000)).toBe("ambient");
  });

  it("is short enough not to be an obstacle", () => {
    // Past about six seconds an unskippable opening stops being atmosphere.
    expect(INTRO_TIMELINE.ambient).toBeLessThanOrEqual(6000);
  });

  it("remembers that it has been seen, and can be forgotten for a replay", () => {
    const map = new Map<string, string>();
    const store = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
    expect(introSeen(store)).toBe(false);
    markIntroSeen(store);
    expect(introSeen(store)).toBe(true);
    forgetIntro(store);
    expect(introSeen(store)).toBe(false);
  });

  it("treats storage failure as 'not seen' rather than throwing", () => {
    // Private browsing must not break the landing page.
    const denied = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => markIntroSeen(denied)).not.toThrow();
    expect(introSeen(denied)).toBe(false);
  });
});

describe("rendering scales to the device, and reduced motion always wins", () => {
  const strong = { cores: 12, memoryGb: 16, viewportWidth: 1920 };

  it("gives a capable machine the full scene", () => {
    expect(chooseRenderTier({ reducedMotion: false, ...strong })).toBe("full");
  });

  it("obeys prefers-reduced-motion over every other signal", () => {
    /*
     * Absolute, and deliberately checked against the strongest possible
     * machine: someone who asked their operating system to stop animations
     * usually did it because animation makes them ill.
     */
    expect(chooseRenderTier({ reducedMotion: true, ...strong })).toBe("static");
  });

  it("steps down on a weak processor or little memory", () => {
    expect(
      chooseRenderTier({ reducedMotion: false, cores: 2, memoryGb: 8, viewportWidth: 1920 }),
    ).toBe("reduced");
    expect(
      chooseRenderTier({ reducedMotion: false, cores: 8, memoryGb: 2, viewportWidth: 1920 }),
    ).toBe("reduced");
  });

  it("steps down on a modest phone", () => {
    expect(
      chooseRenderTier({ reducedMotion: false, cores: 4, memoryGb: 4, viewportWidth: 390 }),
    ).toBe("reduced");
  });

  it("steps down once frames have actually been missed", () => {
    // Measured, not guessed: the loop reports this after missing its budget.
    expect(chooseRenderTier({ reducedMotion: false, ...strong, droppedFrames: true })).toBe(
      "reduced",
    );
  });

  it("draws no stars at all when motion is off", () => {
    // A frozen star field is noise, not atmosphere.
    expect(starCountFor("static")).toBe(0);
    expect(starCountFor("reduced")).toBeLessThan(starCountFor("full"));
  });
});

describe("the landing page keeps its promises to a keyboard and a screen reader", () => {
  const LANDING = readFileSync("src/components/landing/LandingUniverse.tsx", "utf8");
  const SCENE = readFileSync("src/components/landing/SolarSystem.tsx", "utf8");
  const PARTICLES = readFileSync("src/components/landing/ParticleLogoIntro.tsx", "utf8");

  it("hides the canvas from assistive technology and offers real buttons instead", () => {
    // A canvas that announces nothing adds noise, not access. The legend is
    // the accessible half and is why the canvas can be hidden.
    expect(SCENE).toMatch(/setAttribute\("aria-hidden", "true"\)/);
    expect(LANDING).toMatch(/aria-describedby=\{`planet-benefit-\$\{planet\.id\}`\}/);
  });

  it("lights a planet on keyboard focus, not only on hover", () => {
    // The capability list moved out of the hero and into its own section, so
    // the handlers are now inline rather than passed down through a legend
    // component — the behaviour they provide is unchanged and still required.
    expect(LANDING).toMatch(/onFocus=\{\(\) => setHovered\(planet\)\}/);
    expect(LANDING).toMatch(/onBlur=\{\(\) => setHovered\(null\)\}/);
  });

  it("puts the actions below the fold rather than over the system", () => {
    /*
     * THIS USED TO REQUIRE THREE BUTTONS ON THE FIRST SCREEN, AT ALL TIMES.
     * That was the right rule for a hero built around a call to action, and the
     * wrong one for this page: the first screen is now the interactive system
     * and nothing else, with the actions a scroll away.
     *
     * The rule it replaces still holds in spirit — nothing an intro phase can
     * hide. The actions live in ordinary sections below the hero, so no phase
     * conditional touches them, which is a stronger guarantee than the old one.
     */
    for (const label of ["Create a free account", "Create account", "Sign in"]) {
      expect(LANDING, `${label} is missing`).toContain(label);
    }
    expect(LANDING, "an action is hidden behind an intro phase").not.toMatch(
      /introRunning \? null : \(\s*<Link/,
    );
    // And the cue that tells the reader they are there.
    expect(LANDING).toMatch(/Scroll down to sign in or get started/);
  });

  it("keeps the hero to one line, not a paragraph", () => {
    /*
     * The tagline is back on the first screen, at the owner's direction, beside
     * the two actions. What the rule was actually protecting against is the
     * page opening with a WALL of explanation — so it is now a length bound
     * rather than a ban: one sentence over the system is fine, the four-clause
     * original was not.
     */
    const tagline = /A private AI assistant that runs on your own hardware[^<]*/.exec(LANDING)?.[0];
    expect(tagline, "the hero tagline is missing").toBeTruthy();
    expect(tagline!.length, "the hero tagline grew back into a paragraph").toBeLessThan(120);
    // And the em-dash clause about what it "cannot" do, which doubled it, stays gone.
    expect(LANDING).not.toMatch(/tells you\s*\n?\s*plainly about the times it cannot/);
  });

  it("gives the wheel back to the page once it has no zoom left", () => {
    /*
     * RE-POINTED, AND THE RULE IS SHARPER THAN IT WAS.
     *
     * This read the old canvas the landing no longer renders, and asserted the
     * blunt version: never prevent default. The live scene does better — it
     * keeps the gesture only while the zoom is still using it, and hands the
     * wheel back once pulled all the way out, so "scroll down to sign in" is
     * obeyable while the hero still zooms.
     */
    expect(SCENE).toMatch(/const used = scene\.zoom\(event\.deltaY\);/);
    expect(SCENE).toMatch(/if \(used !== DECLINED\) event\.preventDefault\(\);/);
    // And it must be able to prevent default at all, which a passive listener
    // cannot: a passive wheel listener makes the zoom silently non-functional.
    expect(SCENE).toMatch(/addEventListener\("wheel", onWheel, \{ passive: false \}\)/);
  });

  it("offers a replay rather than repeating itself", () => {
    expect(LANDING).toMatch(/Replay the opening/);
    expect(LANDING).toMatch(/forgetIntro\(\)/);
  });

  it("forms the same-origin OCADE mark from particles without replacing the real heading", () => {
    expect(LANDING).toMatch(/<ParticleLogoIntro/);
    expect(PARTICLES).toMatch(/\/brand\/ocade-carcc-mark\.png/);
    expect(PARTICLES).toMatch(/requestAnimationFrame/);
    expect(PARTICLES).toMatch(/aria-hidden="true"/);
    expect(PARTICLES).toMatch(/reducedMotion/);
    expect(LANDING).toMatch(/<span className="sr-only">OCADE by CARCC CADANE/);
  });

  it("says so when motion has been reduced, instead of looking broken", () => {
    expect(LANDING).toMatch(/Motion reduced, following your system setting/);
  });
});
