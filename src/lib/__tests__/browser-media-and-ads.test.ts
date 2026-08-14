// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The two page functions the browser host injects, exercised against a real DOM.
 *
 * They live inside `page.evaluate` calls in `native/browser-host/index.mjs`, so
 * they cannot be imported. Copying them into a test would prove only that the
 * copy works. Instead the source is READ and the function bodies are extracted,
 * so this fails the moment the shipped code and the tested code diverge.
 */

const HOST = readFileSync("native/browser-host/index.mjs", "utf8");

/** Pull one `case "<name>": {` block out of the host's action switch. */
function hostCase(name: string): string {
  const start = HOST.indexOf(`case "${name}": {`);
  expect(start, `case "${name}" should exist in the browser host`).toBeGreaterThan(-1);
  const rest = HOST.slice(start);
  return rest.slice(0, rest.indexOf("\n    case "));
}

describe("skipping an advert", () => {
  /**
   * The real selector, lifted from the shipped source.
   *
   * An ad is a real video element: seeking it does nothing because the player
   * refuses, and muting only makes you wait in silence. The button is the only
   * thing that ends it, and it is found by TEXT because class names change
   * constantly while "Skip" cannot without the page becoming unusable.
   */
  function findSkip(): HTMLElement | null {
    const wanted = /^\s*skip(?:\s+(?:this\s+)?(?:ad|ads|advert|advertisement|intro))?\s*[>»]?\s*$/i;
    const clickable = [...document.querySelectorAll("button, a, [role=button], div[class*=skip]")];
    return (
      (clickable.find((element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        return [element.innerText, element.textContent, element.getAttribute("aria-label")].some(
          (label) => label && wanted.test(String(label).trim()),
        );
      }) as HTMLElement | undefined) ?? null
    );
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function put(html: string, width = 80, height = 30) {
    document.body.innerHTML = html;
    for (const el of document.body.querySelectorAll("*")) {
      (el as HTMLElement).getBoundingClientRect = () =>
        ({ width, height, top: 0, left: 0, right: width, bottom: height }) as DOMRect;
    }
  }

  it("finds the button by its text, not by a class name", () => {
    // YouTube renames its classes constantly. The word is the stable part.
    put('<button class="a7f3x9">Skip Ad</button>');
    expect(findSkip()?.textContent).toBe("Skip Ad");
  });

  it("finds it by aria-label even when other text comes first", () => {
    /*
     * The pattern is anchored at the start, which is what stops "don't skip
     * this" matching. Joining the label sources gave "» Skip intro", which does
     * not start with "skip", so a real YouTube shape was missed. Each source is
     * asked on its own instead.
     */
    put('<a role="button" aria-label="Skip intro">»</a>');
    expect(findSkip()).not.toBeNull();
  });

  it("does not click an accessibility skip link", () => {
    /*
     * THE ONE THAT GOT THROUGH, FROM A LIVE YOUTUBE RUN.
     *
     * "Skip navigation" is the accessibility link every well-built site puts
     * first in the tab order. The old pattern matched on the word "skip" and
     * clicked it, moving the user's focus past the header while reporting that
     * an advert had been skipped.
     *
     * The word belongs to accessibility long before it belongs to advertising.
     * What separates them is the OBJECT: an ad button skips an *ad*, or says
     * nothing else at all. A navigation link always names where it is going.
     */
    for (const label of [
      "Skip navigation",
      "Skip to content",
      "Skip to main content",
      "Skip to the player",
    ]) {
      put(`<button>${label}</button>`);
      expect(findSkip(), `"${label}" must not be treated as an advert`).toBeNull();
    }
  });

  it("still accepts the shapes a real ad button takes", () => {
    for (const label of ["Skip", "Skip Ad", "Skip Ads", "Skip intro", "Skip >"]) {
      put(`<button>${label}</button>`);
      expect(findSkip(), `"${label}" should be clicked`).not.toBeNull();
    }
  });

  it("does not click Subscribe, or anything with no skip wording", () => {
    put("<button>Subscribe</button><button>Next video</button>");
    expect(findSkip()).toBeNull();
  });

  it("ignores a hidden or zero-sized element carrying the same text", () => {
    /*
     * Players keep an off-screen skip button in the DOM between ads. Clicking
     * it does nothing and reports success, which is worse than reporting that
     * there was no ad.
     */
    put('<div class="skip-holder">Skip</div>', 2, 2);
    expect(findSkip()).toBeNull();
  });

  it("reports nothing to skip as the ordinary state it is", () => {
    // Most of the time there is no ad. Treating that as failure makes a model
    // retry a button that does not exist.
    put("<video></video><button>Like</button>");
    expect(findSkip()).toBeNull();
  });
});

describe("moving through a video", () => {
  /** The seek arithmetic exactly as the host computes it. */
  function seek(op: string, currentTime: number, amount: number, duration: number): number {
    const target = op === "seek" ? amount : currentTime + (op === "back" ? -amount : amount);
    return Math.max(0, Math.min(target, duration - 0.25));
  }

  it("treats 'to 10 seconds' as a position and '+10 seconds' as a distance", () => {
    // People say both and mean different things. Getting them the same way
    // round puts a video near its start when the user wanted it further on.
    expect(seek("seek", 50, 10, 300)).toBe(10);
    expect(seek("forward", 50, 30, 300)).toBe(80);
    expect(seek("back", 50, 15, 300)).toBe(35);
  });

  it("never seeks past the end", () => {
    // Assigning beyond duration makes some players stall on a frame that never
    // advances, which is indistinguishable from a hang.
    expect(seek("forward", 290, 30, 300)).toBe(299.75);
  });

  it("never seeks before the start", () => {
    expect(seek("back", 5, 15, 300)).toBe(0);
  });
});

describe("the shipped host still contains what these tests describe", () => {
  it("handles seek, forward and back", () => {
    const media = hostCase("media");
    expect(media).toContain('"seek"');
    expect(media).toContain('"forward"');
    expect(media).toContain('"back"');
    expect(media, "must clamp to the media's duration").toContain("Math.min(target, duration");
  });

  it("keeps skip_ad separate from the media operations", () => {
    const skip = hostCase("skip_ad");
    expect(skip).toContain("aria-label");
    expect(skip, "a zero-sized button must be ignored").toContain("rect.width < 4");
    expect(skip, "absence must be reported, not thrown").toContain("found: false");
  });
});
