import { describe, it, expect } from "vitest";
import { readHistoryReach } from "@/components/shell/use-history-reach";

/**
 * The shell's Back and Forward buttons were never disabled. On the first page
 * of a session that made Back a control which looked live, took a click and did
 * nothing — the dead button `scripts/check-dead-controls.mjs` exists to forbid,
 * sitting in the chrome of every authenticated screen.
 *
 * The reading rule is what these lock down, especially the fallback: a browser
 * that cannot report its history must not have its buttons disabled on a guess.
 */
describe("history reach decides whether Back and Forward can act", () => {
  it("reports both directions from the Navigation API when it exists", () => {
    expect(readHistoryReach({ canGoBack: true, canGoForward: false })).toEqual({
      canGoBack: true,
      canGoForward: false,
      measured: true,
    });
  });

  it("disables Back on the first entry of a session", () => {
    const reach = readHistoryReach({ canGoBack: false, canGoForward: false });
    expect(reach.canGoBack).toBe(false);
    expect(reach.measured).toBe(true);
  });

  it("leaves both enabled when the browser cannot report history", () => {
    // Firefox and Safari have no Navigation API. Disabling on a guess would
    // break a Back button that genuinely works, which is the worse error.
    for (const nav of [undefined, {}, { canGoBack: true }, { canGoForward: true }]) {
      const reach = readHistoryReach(nav);
      expect(reach).toEqual({ canGoBack: true, canGoForward: true, measured: false });
    }
  });

  it("does not treat a non-boolean as an answer", () => {
    // A partial or polyfilled implementation must fall back rather than coerce.
    const reach = readHistoryReach({
      canGoBack: "yes",
      canGoForward: 0,
    } as unknown as { canGoBack?: boolean; canGoForward?: boolean });
    expect(reach.measured).toBe(false);
    expect(reach.canGoBack).toBe(true);
  });
});
