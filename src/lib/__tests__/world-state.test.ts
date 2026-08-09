import { describe, expect, it } from "vitest";
import { compactWorldState, diffWorldState, normalizeWorldState } from "../agent/world-state";

describe("bounded live WorldState", () => {
  it("normalizes hostile host data and sends screen deltas instead of an unbounded tree", () => {
    const before = normalizeWorldState({
      revision: 4,
      applications: [],
      windows: [],
      browser: { tabs: [] },
      screen: {
        monitors: [],
        changedRegions: [],
        graph: { fingerprint: "before", visibleText: ["Editor"], elements: [] },
      },
      input: { heldKeys: [], heldButtons: [], controller: "shared" },
      media: [],
      network: { online: true },
      devices: [],
      task: { status: "running" },
      permissions: [],
      recentActions: [],
    });
    const after = normalizeWorldState({
      ...before,
      revision: 5,
      active: { appId: "editor", windowId: "w1", title: "Report\u0000 - Editor" },
      screen: {
        ...before.screen,
        graph: {
          fingerprint: "after",
          visibleText: Array.from({ length: 500 }, (_, index) => `line ${index}`),
          elements: [
            {
              id: "continue",
              role: "button",
              label: "Continue",
              enabled: true,
              confidence: 9,
              sources: ["accessibility"],
              actions: ["activate"],
            },
          ],
        },
      },
    });
    const delta = diffWorldState(before, after);
    const compact = compactWorldState(after, delta);
    expect(after.active?.title).toBe("Report - Editor");
    expect(after.screen.graph?.visibleText).toHaveLength(120);
    expect(after.screen.graph?.elements[0].confidence).toBe(1);
    expect(delta.changes.join(" ")).toMatch(/active window|appeared/);
    expect(JSON.stringify(compact).length).toBeLessThan(24_000);
  });
});
