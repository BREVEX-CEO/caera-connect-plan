// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DepthScene } from "@/components/motion/DepthScene";
import { ThemeProvider } from "@/lib/theme-provider";

/**
 * The scene, mounted.
 *
 * `depth.test.ts` covers the geometry; this covers the three things the
 * component does that no pure function can be asked about, and that all fail
 * SILENTLY — the interface simply looks flat, or leans and never recovers, and
 * nothing throws:
 *
 *  1. it publishes the mode where portalled surfaces can see it,
 *  2. it removes that mode when it unmounts,
 *  3. it does not tilt for a touch pointer.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  // jsdom has no rAF timing; run the callback immediately so a published
  // pointer is observable in the same tick.
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = () => {};
  }
  if (!window.CSS) {
    (window as unknown as { CSS: unknown }).CSS = { supports: () => true };
  }
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  document.documentElement.removeAttribute("data-depth-scene");
  document.documentElement.style.removeProperty("--pointer-x");
  document.documentElement.style.removeProperty("--pointer-y");
  vi.unstubAllGlobals();
});

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    // ThemeProvider supplies `useAppearance`, which the scene reads for the
    // reduced-motion preference. The real tree has it for the same reason —
    // see __root.tsx, where the scene sits inside it.
    root!.render(
      <ThemeProvider>
        <DepthScene>
          <p>content</p>
        </DepthScene>
      </ThemeProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("the scene publishes itself where portals can see it", () => {
  it("marks the document element, not a wrapper", async () => {
    /*
     * Dialogs, menus and tooltips render through a portal into document.body,
     * OUTSIDE this component's subtree. On a wrapper div they would be the only
     * surfaces in the product with no depth — which is exactly backwards, since
     * they are the ones that must read as being in front.
     */
    await mount();
    expect(document.documentElement.hasAttribute("data-depth-scene")).toBe(true);
  });

  it("renders no box of its own, so no layout shifts", async () => {
    await mount();
    const wrapper = container!.firstElementChild as HTMLElement;
    expect(wrapper.style.display).toBe("contents");
  });

  it("cleans the attribute up on unmount", async () => {
    /*
     * A stale `data-depth-scene` left on a page with no scene keeps every depth
     * rule active with nothing publishing a pointer — the interface freezes at
     * whatever angle it last held, which reads as a rendering fault.
     */
    await mount();
    const r = root!;
    await act(async () => r.unmount());
    root = null;
    expect(document.documentElement.hasAttribute("data-depth-scene")).toBe(false);
  });
});

describe("what moves the scene, and what must not", () => {
  it("ignores a touch pointer", async () => {
    /*
     * On a phone the only pointer events arrive mid-gesture, so following them
     * tilts the interface while somebody is trying to scroll it — the content
     * moves under the finger moving it.
     */
    await mount();
    const before = document.documentElement.style.getPropertyValue("--pointer-x");
    await act(async () => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 9999, clientY: 9999, pointerType: "touch" }),
      );
    });
    expect(document.documentElement.style.getPropertyValue("--pointer-x")).toBe(before);
  });

  it("never leaves the pointer outside the unit range, however far it travels", async () => {
    await mount();
    await act(async () => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 99999, clientY: 99999, pointerType: "mouse" }),
      );
    });
    const x = document.documentElement.style.getPropertyValue("--pointer-x");
    // Empty when this environment resolved to a non-interactive mode, which is
    // itself correct — but a published value must never exceed the range.
    if (x !== "") expect(Math.abs(Number(x))).toBeLessThanOrEqual(1);
  });
});
