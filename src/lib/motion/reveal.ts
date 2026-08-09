/**
 * Scroll-driven motion for the whole application.
 *
 * THE FAILURE THIS IS BUILT AROUND. The usual scroll-reveal starts every
 * element at `opacity: 0` in CSS and lets JavaScript add a class when the
 * element scrolls into view. When that JavaScript does not run — a chunk that
 * failed to load, an observer the browser does not implement, an exception in
 * an unrelated effect, a crawler that executes nothing — the page is not
 * "unanimated". It is BLANK, permanently, with the content present in the DOM
 * and invisible. The animation has taken the content hostage.
 *
 * So the resting state here is VISIBLE. An element is only hidden after an
 * observer has been constructed and has actually accepted it, which means the
 * machinery that will reveal it is provably alive. Every failure path — no
 * IntersectionObserver, a throwing constructor, reduced motion, a weak device,
 * server rendering — lands on plain visible content.
 *
 * WHAT MOTION IS FOR HERE. Orientation, not decoration: a short rise and fade
 * as a section arrives tells the eye where the new content begins. It is small
 * (16px, 420ms) on purpose. Anything larger competes with reading, and this is
 * an application people work inside rather than a page they scroll once.
 */

import type { RenderTier } from "../landing/universe";

export interface RevealOptions {
  /** How far into the viewport an element must come before it reveals. */
  rootMargin?: string;
  /** Fraction of the element that must be visible. */
  threshold?: number;
  /** Reveal once and stop observing, rather than re-hiding on scroll out. */
  once?: boolean;
}

export const DEFAULT_REVEAL: Required<RevealOptions> = {
  // Bottom margin is negative so the reveal fires slightly BEFORE the element
  // reaches the fold — motion that starts after you are already reading it
  // reads as a glitch rather than an entrance.
  rootMargin: "0px 0px -12% 0px",
  threshold: 0.05,
  // Re-hiding content the user has already read, because they scrolled up, is
  // the single most disliked behaviour of scroll animation.
  once: true,
};

/**
 * Whether motion should run at all on this device, for this user.
 *
 * The order is a policy: an explicit preference for less motion always wins
 * over a capability check, because a user who asked for stillness on a fast
 * machine still asked for stillness.
 */
export function motionAllowed(input: {
  reducedMotion: boolean;
  osReducedMotion: boolean;
  tier?: RenderTier;
  /** False during server rendering and before hydration. */
  hasDom?: boolean;
}): boolean {
  if (input.hasDom === false) return false;
  if (input.reducedMotion || input.osReducedMotion) return false;
  // A machine that could not carry the landing scene will not carry a hundred
  // simultaneous transitions either. Same measurement, same answer.
  if (input.tier === "static") return false;
  return true;
}

/** True when this browser can actually drive the reveal. */
export function canObserve(scope: { IntersectionObserver?: unknown } = globalThis): boolean {
  return typeof scope.IntersectionObserver === "function";
}

/**
 * The class names a revealable element carries.
 *
 * `revealHidden` is applied only by JavaScript, never by the stylesheet, which
 * is what guarantees the content cannot be stranded invisible.
 */
export const REVEAL_CLASS = "ocade-reveal";
export const REVEAL_HIDDEN_CLASS = "ocade-reveal-hidden";

/**
 * Staggered delay for a group of siblings, in milliseconds.
 *
 * Capped so a long list does not end with items waiting a second and a half to
 * appear — past about five steps a stagger stops reading as choreography and
 * starts reading as lag.
 */
export function staggerDelay(index: number, step = 60, max = 5): number {
  return Math.min(index, max) * step;
}

export interface RevealController {
  /** Register an element. Safe to call with null. */
  observe(element: Element | null): void;
  /** Reveal everything immediately and stop observing. */
  revealAll(): void;
  disconnect(): void;
}

/**
 * Build the controller that hides and later reveals elements.
 *
 * Returns a controller whose `observe` is a no-op when motion is off, so
 * callers never branch on it and can never accidentally hide an element on a
 * path that will not reveal it.
 */
export function createRevealController(
  enabled: boolean,
  options: RevealOptions = {},
  scope: typeof globalThis = globalThis,
): RevealController {
  const settings = { ...DEFAULT_REVEAL, ...options };
  const tracked = new Set<Element>();

  const show = (element: Element) => {
    element.classList.remove(REVEAL_HIDDEN_CLASS);
  };

  if (!enabled || !canObserve(scope)) {
    // Nothing is ever hidden, so nothing needs revealing.
    return { observe: () => {}, revealAll: () => {}, disconnect: () => {} };
  }

  let observer: IntersectionObserver;
  try {
    observer = new scope.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          if (settings.once) {
            observer.unobserve(entry.target);
            tracked.delete(entry.target);
          }
        }
      },
      { rootMargin: settings.rootMargin, threshold: settings.threshold },
    );
  } catch {
    // A browser that has the constructor but rejects these options. Content
    // stays visible rather than being hidden by machinery that just failed.
    return { observe: () => {}, revealAll: () => {}, disconnect: () => {} };
  }

  return {
    observe(element) {
      if (!element || tracked.has(element)) return;
      /*
       * ORDER MATTERS. The element is handed to the observer FIRST and hidden
       * only after that call returns without throwing. Hiding first would open
       * a window — however brief — in which an observer failure leaves the
       * element invisible with nothing left to reveal it.
       */
      try {
        observer.observe(element);
      } catch {
        return;
      }
      tracked.add(element);
      element.classList.add(REVEAL_HIDDEN_CLASS);

      /*
       * An element already on screen at registration must not wait for a
       * scroll that may never come. The observer does fire for these, but only
       * on its first callback tick, and until then the element is hidden. On a
       * page that fits the viewport that flash is the whole animation.
       */
      const rect = element.getBoundingClientRect();
      const viewportHeight = scope.innerHeight || 0;
      if (rect.top < viewportHeight && rect.bottom > 0) {
        show(element);
        if (settings.once) {
          observer.unobserve(element);
          tracked.delete(element);
        }
      }
    },
    revealAll() {
      for (const element of tracked) show(element);
      tracked.clear();
      observer.disconnect();
    },
    disconnect() {
      // Everything still tracked is still HIDDEN, and after disconnect nothing
      // would ever reveal it. Unmounting must not strand content.
      for (const element of tracked) show(element);
      tracked.clear();
      observer.disconnect();
    },
  };
}
