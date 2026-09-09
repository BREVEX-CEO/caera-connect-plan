import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PLANETS,
  introPhaseAt,
  introSeen,
  markIntroSeen,
  forgetIntro,
  chooseRenderTier,
  starCountFor,
  INTRO_TIMELINE,
} from "../landing/universe";

/**
 * The landing universe: what it promises, and when it plays.
 *
 * The hero is a Three.js scene now, so the projection, camera and hit-testing
 * cases that used to sit here went with `landing/paint.ts` — they were the
 * geometry of a canvas renderer the product no longer mounts. What remains is
 * what a visitor still meets: eight capabilities that each name a real benefit,
 * an intro that plays once rather than forever, and a quality tier that a
 * reduced-motion preference always wins.
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
