import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  createRevealController,
  motionAllowed,
  canObserve,
  staggerDelay,
  REVEAL_HIDDEN_CLASS,
  DEFAULT_REVEAL,
} from "../motion/reveal";

/**
 * Scroll motion must never be able to hide content permanently.
 *
 * THE FAILURE UNDER TEST. The ordinary scroll-reveal sets `opacity: 0` in CSS
 * and lets JavaScript add a class when an element scrolls into view. Every path
 * where that JavaScript does not run — a failed chunk, a missing
 * IntersectionObserver, an exception, a crawler — leaves the page BLANK with
 * the content present in the DOM. The animation holds the content hostage.
 *
 * Each test below takes one of those paths and requires the content to end up
 * visible.
 */

class FakeElement {
  classes = new Set<string>();
  rect: { top: number; bottom: number };
  classList = {
    add: (c: string) => this.classes.add(c),
    remove: (c: string) => this.classes.delete(c),
    contains: (c: string) => this.classes.has(c),
  };
  constructor(top = 2000, bottom = 2200) {
    this.rect = { top, bottom };
  }
  getBoundingClientRect() {
    return this.rect;
  }
  get hidden() {
    return this.classes.has(REVEAL_HIDDEN_CLASS);
  }
}

/** A controllable IntersectionObserver. */
function fakeScope(options: { throwOnConstruct?: boolean; throwOnObserve?: boolean } = {}) {
  const instances: Array<{
    cb: (entries: Array<{ isIntersecting: boolean; target: unknown }>) => void;
    observed: unknown[];
    unobserved: unknown[];
    disconnected: boolean;
  }> = [];

  class FakeIO {
    observed: unknown[] = [];
    unobserved: unknown[] = [];
    disconnected = false;
    cb: (entries: Array<{ isIntersecting: boolean; target: unknown }>) => void;
    constructor(cb: typeof this.cb) {
      if (options.throwOnConstruct) throw new Error("unsupported options");
      this.cb = cb;
      instances.push(this);
    }
    observe(el: unknown) {
      if (options.throwOnObserve) throw new Error("cannot observe");
      this.observed.push(el);
    }
    unobserve(el: unknown) {
      this.unobserved.push(el);
    }
    disconnect() {
      this.disconnected = true;
    }
  }

  return {
    scope: { IntersectionObserver: FakeIO, innerHeight: 800 } as unknown as typeof globalThis,
    instances,
  };
}

describe("content is never stranded invisible", () => {
  it("hides nothing when the browser has no IntersectionObserver", () => {
    const el = new FakeElement();
    const controller = createRevealController(true, {}, {
      innerHeight: 800,
    } as unknown as typeof globalThis);
    controller.observe(el as unknown as Element);
    expect(el.hidden, "content was hidden with nothing able to reveal it").toBe(false);
  });

  it("hides nothing when constructing the observer throws", () => {
    const { scope } = fakeScope({ throwOnConstruct: true });
    const el = new FakeElement();
    const controller = createRevealController(true, {}, scope);
    controller.observe(el as unknown as Element);
    expect(el.hidden).toBe(false);
  });

  it("hides nothing when observing an element throws", () => {
    const { scope } = fakeScope({ throwOnObserve: true });
    const el = new FakeElement();
    const controller = createRevealController(true, {}, scope);
    controller.observe(el as unknown as Element);
    // The element was never accepted, so hiding it would be permanent.
    expect(el.hidden).toBe(false);
  });

  it("hides nothing when motion is disabled", () => {
    const { scope } = fakeScope();
    const el = new FakeElement();
    const controller = createRevealController(false, {}, scope);
    controller.observe(el as unknown as Element);
    expect(el.hidden).toBe(false);
  });

  it("reveals everything still hidden when the controller disconnects", () => {
    // Unmounting mid-scroll must not freeze content in its hidden state.
    const { scope } = fakeScope();
    const el = new FakeElement();
    const controller = createRevealController(true, {}, scope);
    controller.observe(el as unknown as Element);
    expect(el.hidden).toBe(true);
    controller.disconnect();
    expect(el.hidden, "disconnect left content invisible forever").toBe(false);
  });

  it("reveals everything on revealAll", () => {
    const { scope } = fakeScope();
    const el = new FakeElement();
    const controller = createRevealController(true, {}, scope);
    controller.observe(el as unknown as Element);
    controller.revealAll();
    expect(el.hidden).toBe(false);
  });

  it("tolerates a null ref without throwing", () => {
    const { scope } = fakeScope();
    const controller = createRevealController(true, {}, scope);
    expect(() => controller.observe(null)).not.toThrow();
  });
});

describe("the reveal actually reveals", () => {
  it("hides an off-screen element and shows it when it intersects", () => {
    const { scope, instances } = fakeScope();
    const el = new FakeElement(2000, 2200); // well below the fold
    const controller = createRevealController(true, {}, scope);
    controller.observe(el as unknown as Element);
    expect(el.hidden).toBe(true);

    instances[0].cb([{ isIntersecting: true, target: el }]);
    expect(el.hidden).toBe(false);
  });

  it("does not reveal on a non-intersecting entry", () => {
    const { scope, instances } = fakeScope();
    const el = new FakeElement(2000, 2200);
    const controller = createRevealController(true, {}, scope);
    controller.observe(el as unknown as Element);
    instances[0].cb([{ isIntersecting: false, target: el }]);
    expect(el.hidden).toBe(true);
  });

  it("shows an element that is already on screen immediately", () => {
    /*
     * The observer does fire for elements already in view, but only on its
     * first callback tick. On a page that fits the viewport, that delay IS the
     * whole animation — everything flashes in at once after a beat.
     */
    const { scope } = fakeScope();
    const el = new FakeElement(100, 400); // inside an 800px viewport
    const controller = createRevealController(true, {}, scope);
    controller.observe(el as unknown as Element);
    expect(el.hidden, "an element already in view was left hidden").toBe(false);
  });

  it("stops observing after revealing, when once is set", () => {
    const { scope, instances } = fakeScope();
    const el = new FakeElement(2000, 2200);
    const controller = createRevealController(true, { once: true }, scope);
    controller.observe(el as unknown as Element);
    instances[0].cb([{ isIntersecting: true, target: el }]);
    expect(instances[0].unobserved).toContain(el);
  });

  it("does not re-hide content the user has already read", () => {
    // Re-hiding on scroll-up is the most disliked behaviour of scroll
    // animation, so `once` is the default rather than an option nobody sets.
    expect(DEFAULT_REVEAL.once).toBe(true);
  });

  it("ignores a repeat registration of the same element", () => {
    const { scope, instances } = fakeScope();
    const el = new FakeElement(2000, 2200);
    const controller = createRevealController(true, {}, scope);
    controller.observe(el as unknown as Element);
    controller.observe(el as unknown as Element);
    expect(instances[0].observed).toHaveLength(1);
  });
});

describe("who gets motion", () => {
  it("refuses when the user asked for reduced motion", () => {
    expect(motionAllowed({ reducedMotion: true, osReducedMotion: false })).toBe(false);
  });

  it("refuses when the operating system asked for reduced motion", () => {
    expect(motionAllowed({ reducedMotion: false, osReducedMotion: true })).toBe(false);
  });

  it("refuses on a device that cannot carry it", () => {
    // Same measurement the landing scene uses; a machine that gets still
    // frames there will not run a hundred transitions here either.
    expect(motionAllowed({ reducedMotion: false, osReducedMotion: false, tier: "static" })).toBe(
      false,
    );
  });

  it("refuses during server rendering", () => {
    expect(motionAllowed({ reducedMotion: false, osReducedMotion: false, hasDom: false })).toBe(
      false,
    );
  });

  it("allows it on a capable device with no stated preference", () => {
    expect(
      motionAllowed({ reducedMotion: false, osReducedMotion: false, tier: "full", hasDom: true }),
    ).toBe(true);
  });

  it("lets a stated preference beat a capable device", () => {
    // Asking for stillness on a fast machine is still asking for stillness.
    expect(
      motionAllowed({ reducedMotion: true, osReducedMotion: false, tier: "full", hasDom: true }),
    ).toBe(false);
  });

  it("detects observer support", () => {
    expect(canObserve({ IntersectionObserver: function () {} })).toBe(true);
    expect(canObserve({})).toBe(false);
  });
});

describe("stagger", () => {
  it("increases with position", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(2)).toBeGreaterThan(staggerDelay(1));
  });

  it("caps, so a long list does not end in a second of waiting", () => {
    // Past about five steps a stagger stops reading as choreography and starts
    // reading as lag.
    expect(staggerDelay(50)).toBe(staggerDelay(5));
    expect(staggerDelay(50)).toBeLessThanOrEqual(300);
  });
});

describe("the stylesheet cannot strand content on its own", () => {
  const CSS = readFileSync("src/styles.css", "utf8");

  it("never sets the reveal class itself to transparent", () => {
    /*
     * This is the assertion that keeps the whole design honest. If someone
     * later adds `opacity: 0` to `.ocade-reveal`, every guard in the
     * TypeScript becomes irrelevant — the content is hidden by the stylesheet
     * before any script runs.
     */
    const block = CSS.match(/\.ocade-reveal\s*\{[^}]*\}/)?.[0] ?? "";
    expect(block, ".ocade-reveal must only describe a transition").not.toMatch(/opacity\s*:\s*0/);
    expect(block).not.toMatch(/visibility\s*:\s*hidden/);
    expect(block).toMatch(/transition/);
  });

  it("hides only through the JavaScript-applied class", () => {
    const hidden = CSS.match(/\.ocade-reveal-hidden\s*\{[^}]*\}/)?.[0] ?? "";
    expect(hidden).toMatch(/opacity\s*:\s*0/);
  });

  it("forces everything visible under the system reduced-motion preference", () => {
    const reduce = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduce).toMatch(/opacity:\s*1\s*!important/);
    expect(reduce).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  it("only turns on smooth scrolling when motion is welcome", () => {
    const smooth = CSS.match(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{[^}]*\{[^}]*\}[^}]*\}/,
    )?.[0];
    expect(smooth, "smooth scrolling must be inside a no-preference query").toBeTruthy();
    expect(smooth).toMatch(/scroll-behavior:\s*smooth/);
  });
});

describe("the hook wires the same guards", () => {
  const SOURCE = readFileSync("src/lib/motion/use-reveal.ts", "utf8");

  it("asks motionAllowed rather than checking preferences itself", () => {
    // A second copy of the policy is a second thing to get wrong.
    expect(SOURCE).toMatch(/motionAllowed\(/);
  });

  it("reveals on unmount", () => {
    expect(SOURCE).toMatch(/controller\.disconnect\(\)/);
  });

  it("measures the device tier with the same function the scene uses", () => {
    expect(SOURCE).toMatch(/chooseRenderTier/);
  });
});

describe("the observer is configured for reading, not for spectacle", () => {
  it("fires slightly before the element reaches the fold", () => {
    // Motion that starts after you are already reading reads as a glitch.
    expect(DEFAULT_REVEAL.rootMargin).toMatch(/-\d+%/);
  });

  it("needs only a sliver visible", () => {
    expect(DEFAULT_REVEAL.threshold).toBeLessThan(0.2);
  });
});

describe("regression: the controller never leaks observers", () => {
  it("disconnects the underlying observer", () => {
    const { scope, instances } = fakeScope();
    const controller = createRevealController(true, {}, scope);
    controller.observe(new FakeElement() as unknown as Element);
    controller.disconnect();
    expect(instances[0].disconnected).toBe(true);
  });

  it("does not construct an observer at all when motion is off", () => {
    const { scope, instances } = fakeScope();
    createRevealController(false, {}, scope);
    expect(instances).toHaveLength(0);
  });
});

describe("no console noise", () => {
  it("swallows observer failures without logging", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { scope } = fakeScope({ throwOnObserve: true });
    const controller = createRevealController(true, {}, scope);
    controller.observe(new FakeElement() as unknown as Element);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
