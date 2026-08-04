import { describe, expect, it, vi } from "vitest";
import {
  deriveScreenStateFingerprint,
  executeMarkedTarget,
  fusePerceptionFrame,
  perceptionRuntimeReadiness,
  resolveSetOfMarkTarget,
  selectMarkerByDescription,
  type PerceptionFrame,
  type RawPerceptionElement,
} from "../control/perception";

describe("perception runtime readiness", () => {
  it("fails closed until companion permissions and external providers are evidenced", () => {
    expect(perceptionRuntimeReadiness({ companionAvailable: false })).toEqual({
      sourceReady: true,
      liveReady: false,
      missing: [
        "Signed Native Companion",
        "accessibility permission",
        "screen-capture permission",
        "ocr provider",
        "icon provider",
        "vision provider",
      ],
    });

    expect(
      perceptionRuntimeReadiness({
        companionAvailable: true,
        permissions: [
          { id: "accessibility", state: "granted" },
          { id: "screen_capture", state: "not_required" },
        ],
        providers: { ocr: true, icon: true, vision: true },
      }),
    ).toEqual({ sourceReady: true, liveReady: true, missing: [] });
  });
});

const OBSERVED = "2026-07-26T02:00:00.000Z";

function element(overrides: Partial<RawPerceptionElement> = {}): RawPerceptionElement {
  return {
    source: "accessibility",
    sourceId: "save-a11y",
    role: "button",
    name: "Save",
    bounds: { x: 100, y: 80, width: 80, height: 30 },
    coordinateSpace: "window_logical",
    confidence: 0.98,
    interactive: true,
    enabled: true,
    visible: true,
    ...overrides,
  };
}

function frame(overrides: Partial<PerceptionFrame> = {}): PerceptionFrame {
  const base: PerceptionFrame = {
    observedAt: OBSERVED,
    display: {
      displayId: "display-left",
      boundsPhysical: { x: -1920, y: 0, width: 1920, height: 1080 },
      scale: 1.5,
      rotation: 0,
    },
    window: {
      appId: "controlled.editor",
      executable: "controlled-editor.exe",
      product: "Controlled Editor",
      version: "1.4.2",
      windowId: "window-7",
      title: "Report - Controlled Editor",
      boundsPhysical: { x: -1800, y: 60, width: 1200, height: 900 },
      displayId: "display-left",
      displayScale: 1.5,
      activeProjectOrFile: "C:/approved/report.ocade",
    },
    screenshot: {
      sha256: "a".repeat(64),
      perceptualHash: "0123456789abcdef",
      width: 1200,
      height: 900,
      protectedRegions: [{ x: -1500, y: 600, width: 300, height: 80 }],
    },
    accessibility: [
      element(),
      element({
        sourceId: "password-a11y",
        role: "textbox",
        name: "Password",
        bounds: { x: 200, y: 360, width: 200, height: 40 },
        protected: true,
      }),
      element({
        sourceId: "hidden-button",
        name: "Hidden action",
        bounds: { x: 420, y: 80, width: 100, height: 30 },
        visible: false,
      }),
    ],
    ocr: [
      element({
        source: "ocr",
        sourceId: "save-ocr",
        bounds: { x: -1650, y: 180, width: 120, height: 45 },
        coordinateSpace: "screen_physical",
        confidence: 0.91,
        interactive: false,
      }),
      element({
        source: "ocr",
        sourceId: "heading-ocr",
        role: "text",
        name: "Quarterly report",
        bounds: { x: 40, y: 30, width: 260, height: 28 },
        coordinateSpace: "window_logical",
        confidence: 0.94,
        interactive: false,
      }),
    ],
    icons: [
      element({
        source: "icon",
        sourceId: "save-icon",
        name: "",
        bounds: { x: 101, y: 81, width: 78, height: 28 },
        confidence: 0.8,
      }),
    ],
    vision: [
      element({
        source: "vision",
        sourceId: "canvas-object",
        role: "canvas-region",
        name: "Selected shape",
        bounds: { x: 300, y: 200, width: 120, height: 100 },
        confidence: 0.77,
      }),
    ],
  };
  return {
    ...base,
    ...overrides,
    display: { ...base.display, ...overrides.display },
    window: { ...base.window, ...overrides.window },
    screenshot: { ...base.screenshot, ...overrides.screenshot },
    accessibility: overrides.accessibility ?? base.accessibility,
    ocr: overrides.ocr ?? base.ocr,
    icons: overrides.icons ?? base.icons,
    vision: overrides.vision ?? base.vision,
  };
}

function plan(input = frame()) {
  const result = fusePerceptionFrame(input);
  if (!result.ok) throw new Error(result.reason);
  return result.data;
}

describe("fused UIA/OCR/icon/vision perception", () => {
  it("merges overlapping evidence and emits current numbered targets", () => {
    const result = plan();
    const save = result.markers.find((marker) => marker.name === "Save");
    expect(save).toMatchObject({
      markerId: "mark-1",
      role: "button",
      sources: ["accessibility", "icon", "ocr"],
    });
    expect(save?.boundsPhysical).toMatchObject({
      x: expect.closeTo(-1650, 0),
      y: expect.closeTo(180, 0),
    });
    expect(result.markers.some((marker) => marker.name === "Hidden action")).toBe(false);
    expect(result.markers.some((marker) => marker.name === "Selected shape")).toBe(true);
    expect(result.evidence.join(" ")).toMatch(/fused|numbered/i);
  });

  it("redacts protected controls before structured output or overlays exist", () => {
    const result = plan();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/password/i);
    expect(result.elements.every((item) => item.name !== "[protected]")).toBe(true);
    expect(result.redactions.length).toBeGreaterThanOrEqual(2);
    expect(result.overlaySvg).not.toContain("Save");
    expect(result.overlaySvg).toContain(">1</text>");
  });

  it("fails closed on malformed, cross-window and source-mismatched candidates", () => {
    const outside = frame({
      ocr: [
        element({
          source: "ocr",
          sourceId: "outside",
          coordinateSpace: "screen_physical",
          bounds: { x: 500, y: 500, width: 40, height: 40 },
        }),
      ],
    });
    expect(fusePerceptionFrame(outside)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/out-of-window|malformed/i),
    });

    const mismatched = frame({
      icons: [element({ source: "vision", sourceId: "forged-source" })],
    });
    expect(fusePerceptionFrame(mismatched).ok).toBe(false);
  });
});

describe("complete screen-state fingerprints", () => {
  it("is deterministic and includes every required state dimension", () => {
    const baseline = deriveScreenStateFingerprint(frame());
    expect(baseline).toMatch(/^screen-v1:[a-f0-9]{64}$/);
    expect(deriveScreenStateFingerprint(frame())).toBe(baseline);

    const variants = [
      frame({ window: { ...frame().window, version: "1.4.3" } }),
      frame({ window: { ...frame().window, title: "Other file" } }),
      frame({
        window: {
          ...frame().window,
          boundsPhysical: { x: -1700, y: 60, width: 1200, height: 900 },
        },
      }),
      frame({ window: { ...frame().window, displayScale: 2 } }),
      frame({
        accessibility: [element({ name: "Save as" }), ...frame().accessibility.slice(1)],
      }),
      frame({
        ocr: [
          ...frame().ocr.slice(0, 1),
          element({
            source: "ocr",
            sourceId: "heading-ocr",
            role: "text",
            name: "Changed visible heading",
            bounds: { x: 40, y: 30, width: 260, height: 28 },
            coordinateSpace: "window_logical",
            interactive: false,
          }),
        ],
      }),
      frame({
        screenshot: {
          ...frame().screenshot,
          perceptualHash: "fedcba9876543210",
        },
      }),
      frame({
        window: {
          ...frame().window,
          activeProjectOrFile: "C:/approved/other.ocade",
        },
      }),
    ];
    for (const variant of variants) {
      expect(deriveScreenStateFingerprint(variant)).not.toBe(baseline);
    }
  });
});

describe("stale-state rejection and multi-monitor scaling", () => {
  it("resolves the current marker into physical and window-logical coordinates", () => {
    const planned = plan();
    const resolved = resolveSetOfMarkTarget({
      planned,
      markerId: "mark-1",
      current: frame(),
      now: new Date("2026-07-26T02:00:00.250Z"),
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.physicalPoint.x).toBeCloseTo(-1590, 0);
    expect(resolved.physicalPoint.y).toBeCloseTo(202.5, 0);
    expect(resolved.windowLogicalPoint).toEqual({ x: 140, y: 95 });
  });

  it.each([
    [
      "moving",
      frame({
        window: {
          ...frame().window,
          boundsPhysical: { x: -1700, y: 60, width: 1200, height: 900 },
        },
      }),
    ],
    [
      "resizing",
      frame({
        window: {
          ...frame().window,
          boundsPhysical: { x: -1800, y: 60, width: 1150, height: 860 },
        },
      }),
    ],
    ["scaling", frame({ window: { ...frame().window, displayScale: 2 } })],
    [
      "visual change",
      frame({ screenshot: { ...frame().screenshot, perceptualHash: "fedcba9876543210" } }),
    ],
  ])("rejects a %s window until OCADE replans", (_label, current) => {
    expect(
      resolveSetOfMarkTarget({
        planned: plan(),
        markerId: "mark-1",
        current,
        now: new Date("2026-07-26T02:00:00.250Z"),
      }),
    ).toMatchObject({
      ok: false,
      stale: true,
      reason: expect.stringMatching(/changed|replan/i),
    });
  });

  it("rejects an aged screenshot and an invented marker id", () => {
    expect(
      resolveSetOfMarkTarget({
        planned: plan(),
        markerId: "mark-1",
        current: frame(),
        now: new Date("2026-07-26T02:00:06.000Z"),
      }),
    ).toMatchObject({ ok: false, stale: true, reason: expect.stringMatching(/stale/i) });
    expect(
      resolveSetOfMarkTarget({
        planned: plan(),
        markerId: "mark-999",
        current: frame(),
      }),
    ).toMatchObject({ ok: false, stale: false, reason: expect.stringMatching(/unknown/i) });
  });
});

describe("post-action independent re-observation", () => {
  it("executes only a current marker and verifies only from a newer observation", async () => {
    const execute = vi.fn(async () => ({ ok: true, evidence: "Input broker clicked once." }));
    const result = await executeMarkedTarget({
      planned: plan(),
      markerId: "mark-1",
      current: frame(),
      now: new Date("2026-07-26T02:00:00.250Z"),
      execute,
      reobserve: async () =>
        frame({
          observedAt: "2026-07-26T02:00:01.000Z",
          screenshot: {
            ...frame().screenshot,
            perceptualHash: "fedcba9876543210",
          },
        }),
      verify: async (before, after) => ({
        verified: before.fingerprint !== after.fingerprint,
        evidence: "Independent observer saw the expected state transition.",
      }),
    });
    expect(result.status).toBe("completed_verified");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("never executes against stale state and never self-promotes an old observation", async () => {
    const execute = vi.fn(async () => ({ ok: true, evidence: "ack" }));
    const stale = await executeMarkedTarget({
      planned: plan(),
      markerId: "mark-1",
      current: frame({
        screenshot: {
          ...frame().screenshot,
          perceptualHash: "fedcba9876543210",
        },
      }),
      now: new Date("2026-07-26T02:00:00.250Z"),
      execute,
      reobserve: async () => frame(),
      verify: async () => ({ verified: true, evidence: "should not run" }),
    });
    expect(stale.status).toBe("refused");
    expect(execute).not.toHaveBeenCalled();

    const oldObservation = await executeMarkedTarget({
      planned: plan(),
      markerId: "mark-1",
      current: frame(),
      now: new Date("2026-07-26T02:00:00.250Z"),
      execute,
      reobserve: async () => frame(),
      verify: async () => ({ verified: true, evidence: "self claim" }),
    });
    expect(oldObservation).toMatchObject({
      status: "completed_unverified",
      reason: expect.stringMatching(/newer/i),
    });
  });

  it("honours cancellation before dispatch", async () => {
    const controller = new AbortController();
    controller.abort();
    const execute = vi.fn(async () => ({ ok: true, evidence: "ack" }));
    expect(
      await executeMarkedTarget({
        planned: plan(),
        markerId: "mark-1",
        current: frame(),
        signal: controller.signal,
        execute,
        reobserve: async () => frame(),
        verify: async () => ({ verified: true, evidence: "verified" }),
      }),
    ).toMatchObject({ status: "refused", reason: expect.stringMatching(/cancelled/i) });
    expect(execute).not.toHaveBeenCalled();
  });
});

/**
 * Selecting a described target — the step where a guess would happen.
 *
 * `resolveSetOfMarkTarget` only ever sees a marker id, so by the time it runs
 * the choice is already made. This is where a model's words become a target,
 * and where "two things are called Remove" has to become a refusal rather than
 * a coin flip that looks like success until it removes the wrong thing.
 */
describe("selecting a marked target by description", () => {
  /** A plan with two independently clickable controls sharing one name. */
  function ambiguousPlan() {
    return plan(
      frame({
        accessibility: [
          element({
            sourceId: "remove-a",
            name: "Remove",
            bounds: { x: 10, y: 10, width: 60, height: 24 },
          }),
          element({
            sourceId: "remove-b",
            name: "Remove",
            bounds: { x: 90, y: 10, width: 60, height: 24 },
          }),
          element({
            sourceId: "save-a11y",
            name: "Save",
            bounds: { x: 10, y: 60, width: 60, height: 24 },
          }),
        ],
        ocr: [],
        icons: [],
        vision: [],
      }),
    );
  }

  it("selects the single element that matches", () => {
    const result = selectMarkerByDescription(ambiguousPlan(), "Save");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.target.name).toBe("Save");
  });

  it("REFUSES an ambiguous description instead of picking one", () => {
    const result = selectMarkerByDescription(ambiguousPlan(), "Remove");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/matches 2 marked elements/);
      // Both are named, so the caller can disambiguate by number — the refusal
      // has to be actionable, not just a "no".
      expect(result.candidateNumbers).toHaveLength(2);
      expect(result.reason).toMatch(/will not guess/);
    }
    // And nothing was selected: there is no `target` to accidentally act on.
    expect((result as { target?: unknown }).target).toBeUndefined();
  });

  it("refuses a description that matches nothing", () => {
    const result = selectMarkerByDescription(ambiguousPlan(), "Publish");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.candidateNumbers).toEqual([]);
  });

  it("refuses when the only match is below the confidence needed to act", () => {
    const low = plan(
      frame({
        accessibility: [element({ sourceId: "save-a11y", name: "Save", confidence: 0.45 })],
        ocr: [],
        icons: [],
        vision: [],
      }),
    );
    const result = selectMarkerByDescription(low, "Save", { minConfidence: 0.9 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/below the confidence/);
    // The same element IS selectable once the bar is set where it can clear it,
    // so this is a threshold being enforced and not an element that never worked.
    expect(selectMarkerByDescription(low, "Save", { minConfidence: 0.4 }).ok).toBe(true);
  });

  it("never selects a protected element by description", () => {
    const secret = plan(
      frame({
        accessibility: [element({ sourceId: "pw-a11y", name: "Password", role: "edit" })],
        ocr: [],
        icons: [],
        vision: [],
      }),
    );
    expect(selectMarkerByDescription(secret, "Password").ok).toBe(false);
    // Nor by the placeholder its name was replaced with.
    expect(selectMarkerByDescription(secret, "[protected]").ok).toBe(false);
  });

  it("does not drag an exact match into ambiguity with a longer label", () => {
    const mixed = plan(
      frame({
        accessibility: [
          element({
            sourceId: "save-a11y",
            name: "Save",
            bounds: { x: 10, y: 10, width: 60, height: 24 },
          }),
          element({
            sourceId: "save-as",
            name: "Save as copy",
            bounds: { x: 90, y: 10, width: 90, height: 24 },
          }),
        ],
        ocr: [],
        icons: [],
        vision: [],
      }),
    );
    const result = selectMarkerByDescription(mixed, "Save");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.target.name).toBe("Save");
    // Containment still applies when nothing matches exactly.
    const partial = selectMarkerByDescription(mixed, "as copy");
    expect(partial.ok).toBe(true);
    if (partial.ok) expect(partial.target.name).toBe("Save as copy");
  });
});
