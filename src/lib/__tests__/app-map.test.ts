import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fingerprintApp,
  lookupAppMap,
  saveAppMap,
  recordMapUse,
  findControl,
  forgetAppMap,
  clearAppMaps,
  listAppMaps,
  isStableAnchor,
  rejectUnstableControls,
  type MappedControl,
} from "../skills/app-map";

const NOW = new Date("2026-07-23T10:00:00Z");

const controls: MappedControl[] = [
  {
    id: "menu.file.export",
    label: "File → Export",
    method: "accessibility",
    anchor: "menu:File/Export",
  },
  { id: "btn.save", label: "Save", method: "accessibility", anchor: "aria:Save" },
];

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

/**
 * Inspect once, reuse many times — that is where the speed comes from. But a
 * saved map is only valid while the app is unchanged.
 */
describe("learning an app once", () => {
  it("saves a map that a later task can reuse without re-inspecting", () => {
    const fp = fingerprintApp({
      version: "24.8",
      windowTitle: "Calc",
      controlCount: 2,
      locale: "en",
    });
    saveAppMap(
      { appId: "calc", displayName: "Calc", version: "24.8", fingerprint: fp, controls },
      NOW,
    );

    const found = lookupAppMap("calc", fp);
    expect(found.status).toBe("fresh");
    if (found.status !== "fresh") throw new Error("unreachable");
    expect(found.map.controls).toHaveLength(2);
  });

  it("says plainly when an app has never been inspected", () => {
    const r = lookupAppMap("unseen", "any");
    expect(r.status).toBe("missing");
    if (r.status !== "missing") throw new Error("unreachable");
    expect(r.reason).toMatch(/hasn't inspected/i);
  });

  it("finds a control by id, and returns null rather than a near-match", () => {
    const fp = "fp1";
    const saved = saveAppMap(
      { appId: "calc", displayName: "Calc", version: "24.8", fingerprint: fp, controls },
      NOW,
    );
    expect(findControl(saved, "btn.save")?.label).toBe("Save");
    expect(findControl(saved, "btn.sav")).toBeNull();
    expect(findControl(saved, "")).toBeNull();
  });
});

/**
 * Acting on a stale map is how an automation clicks the wrong thing. A changed
 * app must force a re-probe, not a guess.
 */
describe("detecting that an app changed", () => {
  it("marks a map STALE when the version changes", () => {
    const before = fingerprintApp({
      version: "24.8",
      windowTitle: "Calc",
      controlCount: 2,
      locale: "en",
    });
    saveAppMap(
      { appId: "calc", displayName: "Calc", version: "24.8", fingerprint: before, controls },
      NOW,
    );

    const after = fingerprintApp({
      version: "25.2",
      windowTitle: "Calc",
      controlCount: 2,
      locale: "en",
    });
    const r = lookupAppMap("calc", after);
    expect(r.status).toBe("stale");
    if (r.status !== "stale") throw new Error("unreachable");
    expect(r.reason).toMatch(/inspect it again/i);
  });

  /**
   * A patch release can change the layout without changing the visible version,
   * and a plugin can add menu items to an otherwise-identical build.
   */
  it("detects a LAYOUT change even when the version string is identical", () => {
    const before = fingerprintApp({
      version: "24.8",
      windowTitle: "Calc",
      controlCount: 2,
      locale: "en",
    });
    const after = fingerprintApp({
      version: "24.8",
      windowTitle: "Calc",
      controlCount: 7,
      locale: "en",
    });
    expect(before).not.toBe(after);
  });

  /** Menu labels are localised, so a language change invalidates label anchors. */
  it("detects a language change", () => {
    const en = fingerprintApp({
      version: "24.8",
      windowTitle: "Calc",
      controlCount: 2,
      locale: "en",
    });
    const hi = fingerprintApp({
      version: "24.8",
      windowTitle: "Calc",
      controlCount: 2,
      locale: "hi",
    });
    expect(en).not.toBe(hi);
  });

  it("still returns the old map alongside the warning, so context is not lost", () => {
    saveAppMap(
      { appId: "calc", displayName: "Calc", version: "24.8", fingerprint: "old", controls },
      NOW,
    );
    const r = lookupAppMap("calc", "new");
    if (r.status !== "stale") throw new Error("unreachable");
    expect(r.map.controls).toHaveLength(2);
  });

  it("re-learning after a change RESETS the success count", () => {
    saveAppMap(
      { appId: "calc", displayName: "Calc", version: "24.8", fingerprint: "old", controls },
      NOW,
    );
    recordMapUse("calc");
    recordMapUse("calc");
    expect(listAppMaps()[0].uses).toBe(2);

    // Those successes were against a different layout; they say nothing here.
    saveAppMap(
      { appId: "calc", displayName: "Calc", version: "25.0", fingerprint: "new", controls },
      NOW,
    );
    expect(listAppMaps()[0].uses).toBe(0);
  });

  it("re-saving an UNCHANGED map keeps its proven track record", () => {
    saveAppMap(
      { appId: "calc", displayName: "Calc", version: "24.8", fingerprint: "same", controls },
      NOW,
    );
    recordMapUse("calc");
    saveAppMap(
      { appId: "calc", displayName: "Calc", version: "24.8", fingerprint: "same", controls },
      NOW,
    );
    expect(listAppMaps()[0].uses).toBe(1);
  });
});

/**
 * A coordinate anchor breaks on resize, DPI change and theme change — and a
 * broken coordinate silently clicks whatever is now in that spot.
 */
describe("anchors must be stable", () => {
  it.each(["menu:File/Export", "aria:Save", "#export-button", "role=button[name=Save]"])(
    "accepts the stable anchor %s",
    (a) => {
      expect(isStableAnchor(a)).toBe(true);
    },
  );

  it.each([
    "120,340",
    "(120, 340)",
    "[12;44]",
    "x=120 y=340", // space-separated — slipped through an earlier version
    "x:120 y:340",
    "  12 , 44 ",
    "120.5, 340.25",
    "-8,-12",
  ])("REJECTS the positional anchor %s", (a) => {
    expect(isStableAnchor(a)).toBe(false);
  });

  it("rejects an empty anchor", () => {
    expect(isStableAnchor("")).toBe(false);
    expect(isStableAnchor("   ")).toBe(false);
  });

  it("filters positional controls out of a learned map, with a reason", () => {
    const { kept, rejected } = rejectUnstableControls([
      ...controls,
      { id: "btn.ok", label: "OK", method: "vision_input", anchor: "480,220" },
    ]);
    expect(kept).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/resized|scaling/i);
  });
});

describe("housekeeping and resilience", () => {
  it("forgets one app without touching the others", () => {
    saveAppMap({ appId: "a", displayName: "A", version: null, fingerprint: "1", controls }, NOW);
    saveAppMap({ appId: "b", displayName: "B", version: null, fingerprint: "1", controls }, NOW);
    forgetAppMap("a");
    expect(listAppMaps().map((m) => m.appId)).toEqual(["b"]);
  });

  it("clears everything on request", () => {
    saveAppMap({ appId: "a", displayName: "A", version: null, fingerprint: "1", controls }, NOW);
    clearAppMaps();
    expect(listAppMaps()).toHaveLength(0);
  });

  it("survives corrupt storage rather than throwing", () => {
    localStorage.setItem("caera:appmaps:v1", "{not json");
    expect(() => listAppMaps()).not.toThrow();
    expect(listAppMaps()).toEqual([]);
  });

  it("discards malformed rows instead of acting on them", () => {
    localStorage.setItem("caera:appmaps:v1", JSON.stringify([{ nope: true }, 42, null]));
    expect(listAppMaps()).toEqual([]);
  });

  it("discards forged control maps and invalid success metadata", () => {
    localStorage.setItem(
      "caera:appmaps:v1",
      JSON.stringify([
        {
          appId: "forged",
          displayName: "Forged",
          version: "1",
          fingerprint: "fp",
          controls: [
            {
              id: "danger",
              label: "Danger",
              method: "vision_input",
              anchor: "120,340",
            },
          ],
          learnedAt: "not-a-date",
          uses: -1,
        },
      ]),
    );
    expect(listAppMaps()).toEqual([]);
  });

  it("does not expose mutable references to the durable map", () => {
    saveAppMap({ appId: "a", displayName: "A", version: null, fingerprint: "1", controls }, NOW);
    const first = listAppMaps();
    first[0].controls[0].anchor = "480,220";
    first[0].uses = 999;
    expect(listAppMaps()[0]).toMatchObject({ uses: 0 });
    expect(listAppMaps()[0].controls[0].anchor).toBe("menu:File/Export");
  });

  it("reports failed durable writes instead of claiming a map was saved or forgotten", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
      clear: () => undefined,
    });
    expect(() =>
      saveAppMap({ appId: "a", displayName: "A", version: null, fingerprint: "1", controls }, NOW),
    ).toThrow(/could not be saved/i);
    expect(forgetAppMap("a")).toBe(false);
    expect(clearAppMaps()).toBe(false);
  });

  it("recording a use for an unknown app is a no-op, not a crash", () => {
    expect(() => recordMapUse("nope")).not.toThrow();
  });
});
