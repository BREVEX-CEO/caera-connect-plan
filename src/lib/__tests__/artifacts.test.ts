import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveArtifact,
  listArtifacts,
  getArtifact,
  removeArtifact,
  verifyIntegrity,
  exportFilename,
  describeArtifact,
  inspectArtifactStore,
  setArtifactRetention,
  purgeExpiredArtifacts,
  sha256,
  type Artifact,
} from "../artifacts/store";

/**
 * Real SHA-256 via Web Crypto, real storage round-trips.
 *
 * The integrity tests deliberately corrupt stored content and check that the
 * verifier notices — a check that compared the stored hash with itself would
 * pass every one of them.
 */

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

const NOW = new Date("2026-07-23T12:00:00Z");

const save = (over: Partial<Parameters<typeof saveArtifact>[0]> = {}) =>
  saveArtifact({
    name: "Quarterly summary",
    kind: "table",
    content: "region,amount\nNorth,120\n",
    provenance: {
      producedBy: "ocade.data:data.summarise",
      verified: true,
      evidence: "3 rows × 2 columns.",
    },
    now: NOW,
    id: "a-1",
    ...over,
  });

describe("hashing", () => {
  it("produces the known SHA-256 of a known string", async () => {
    const r = await sha256("abc");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    // The published SHA-256("abc").
    expect(r.data).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("gives different digests for content differing by one byte", async () => {
    const a = await sha256("hello");
    const b = await sha256("hellp");
    if (!a.ok || !b.ok) throw new Error("unreachable");
    expect(a.data).not.toBe(b.data);
  });
});

describe("saving an artifact", () => {
  it("refuses to claim a save when browser storage is unavailable", async () => {
    vi.stubGlobal("localStorage", undefined);
    const r = await save();
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/storage.*unavailable/i);
  });

  it("stores it with its provenance and fingerprint", async () => {
    const r = await save();
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.name).toBe("Quarterly summary");
    expect(r.data.sha256).toHaveLength(64);
    // "region,amount" (13) + LF + "North,120" (9) + LF.
    expect(r.data.byteLength).toBe(24);
    expect(r.data.createdAt).toBe(NOW.toISOString());
    expect(r.data.privacyClass).toBe("on_device");
    expect(r.data.compatibleApps).toContain("spreadsheet apps");
  });

  /**
   * An unchecked result must be permanently distinguishable from a checked one.
   * The content looks identical either way.
   */
  it("marks an unverified result NOT CONFIRMED at save time", async () => {
    const r = await save({
      provenance: {
        producedBy: "ocade.web:page.read",
        verified: false,
        evidence: "Could not confirm.",
      },
    });
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/NOT CONFIRMED/);
    expect(r.data.provenance.verified).toBe(false);
  });

  it("refuses an artifact with no provenance", async () => {
    const r = await save({
      provenance: { producedBy: "   ", verified: true, evidence: "" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/indistinguishable from a checked one/i);
  });

  it("refuses empty content and empty names", async () => {
    expect((await save({ content: "" })).ok).toBe(false);
    expect((await save({ name: "  " })).ok).toBe(false);
  });

  it("keeps newest first", async () => {
    await save({ id: "a-1", name: "First" });
    await save({ id: "a-2", name: "Second" });
    expect(listArtifacts().map((a) => a.name)).toEqual(["Second", "First"]);
  });

  it("keeps default save timestamps strictly monotonic within one clock tick", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-25T01:00:00.000Z"));
      const first = await saveArtifact({
        name: "Same tick",
        kind: "text",
        content: "one",
        provenance: { producedBy: "test", verified: true, evidence: "first" },
      });
      const second = await saveArtifact({
        name: "Same tick",
        kind: "text",
        content: "two",
        provenance: { producedBy: "test", verified: true, evidence: "second" },
      });
      if (!first.ok || !second.ok) throw new Error("unreachable");

      expect(Date.parse(second.data.createdAt)).toBeGreaterThan(Date.parse(first.data.createdAt));
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Quota failure is the realistic one, and silently dropping the newest
   * artifact is the worst possible response to it.
   */
  it("reports a storage failure instead of losing the artifact quietly", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
    });
    const r = await save();
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/Nothing was changed/i);
    expect(r.reason).toMatch(/QuotaExceededError/);
  });

  it("refuses to overwrite corrupt artifact storage", async () => {
    store.set("ocade.artifacts.v1", "{not-json");
    const inspected = inspectArtifactStore();
    expect(inspected.ok).toBe(false);
    const r = await save();
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/corrupt/i);
    expect(store.get("ocade.artifacts.v1")).toBe("{not-json");
  });
});

describe("reading and deleting", () => {
  it("finds an artifact by id and returns null for one that isn't there", async () => {
    await save();
    expect(getArtifact("a-1")?.name).toBe("Quarterly summary");
    expect(getArtifact("nope")).toBeNull();
  });

  it("deletes and says how many remain", async () => {
    await save({ id: "a-1" });
    await save({ id: "a-2" });
    const r = removeArtifact("a-1");
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/1 artifacts remain/);
    expect(listArtifacts()).toHaveLength(1);
  });

  /**
   * A delete that succeeds for an id that never existed lets the UI report
   * "deleted" for something it didn't touch.
   */
  it("refuses to report success for an artifact that wasn't there", () => {
    const r = removeArtifact("never-existed");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/nothing was deleted/i);
  });

  it("survives corrupt storage rather than crashing the surface", () => {
    store.set("ocade.artifacts.v1", "{not json");
    expect(listArtifacts()).toEqual([]);
  });
});

describe("retention", () => {
  it("sets an expiry without changing content integrity", async () => {
    await save();
    const retained = setArtifactRetention("a-1", 30, NOW);
    expect(retained.ok).toBe(true);
    if (!retained.ok) throw new Error("unreachable");
    expect(retained.data.expiresAt).toBe("2026-08-22T12:00:00.000Z");
    expect((await verifyIntegrity("a-1")).ok).toBe(true);
  });

  it("purges only expired artifacts", async () => {
    await save({ id: "expired", name: "Expired" });
    setArtifactRetention("expired", 1, NOW);
    await save({ id: "kept", name: "Kept" });
    const result = purgeExpiredArtifacts(new Date("2026-07-25T12:00:00.000Z"));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data).toEqual({ removed: 1, remaining: 1 });
    expect(listArtifacts().map((artifact) => artifact.id)).toEqual(["kept"]);
  });

  it("refuses an invalid retention window", async () => {
    await save();
    expect(setArtifactRetention("a-1", 0).ok).toBe(false);
    expect(setArtifactRetention("a-1", 3651).ok).toBe(false);
  });
});

/**
 * The check exists to catch content that changed after it was written. A
 * verifier that compared the stored hash with itself would pass all of these.
 */
describe("integrity is checked by re-hashing", () => {
  it("confirms an untouched artifact", async () => {
    await save();
    const r = await verifyIntegrity("a-1");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.intact).toBe(true);
    expect(r.evidence).toMatch(/byte-for-byte what was written/i);
  });

  it("CATCHES content that was altered in storage", async () => {
    await save();
    const items: Artifact[] = JSON.parse(store.get("ocade.artifacts.v1")!);
    items[0].content = "region,amount\nNorth,999\n";
    store.set("ocade.artifacts.v1", JSON.stringify(items));

    const r = await verifyIntegrity("a-1");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.intact).toBe(false);
    expect(r.data.storedHash).not.toBe(r.data.actualHash);
    expect(r.evidence).toMatch(/has changed since it was stored/i);
    expect(r.evidence).toMatch(/Don't rely on it/i);
  });

  it("catches truncation, not just substitution", async () => {
    await save();
    const items: Artifact[] = JSON.parse(store.get("ocade.artifacts.v1")!);
    items[0].content = items[0].content.slice(0, 10);
    store.set("ocade.artifacts.v1", JSON.stringify(items));

    const r = await verifyIntegrity("a-1");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.intact).toBe(false);
  });

  it("refuses to verify an artifact that isn't there", async () => {
    expect((await verifyIntegrity("nope")).ok).toBe(false);
  });
});

describe("presentation", () => {
  it("gives each kind a sensible export extension", async () => {
    const kinds = [
      ["gltf", "gltf"],
      ["patch", "diff"],
      ["table", "csv"],
      ["text", "txt"],
      ["receipt", "json"],
    ] as const;
    for (const [kind, ext] of kinds) {
      const r = await save({ kind, id: `k-${kind}`, name: "Thing" });
      if (!r.ok) throw new Error("unreachable");
      expect(exportFilename(r.data)).toBe(`Thing.${ext}`);
    }
  });

  it("makes a filename safe without mangling it beyond recognition", async () => {
    const r = await save({ name: "Q3 / summary: final?" });
    if (!r.ok) throw new Error("unreachable");
    expect(exportFilename(r.data)).toBe("Q3-summary-final.csv");
  });

  it("falls back rather than producing a nameless file", async () => {
    const r = await save({ name: "///" });
    if (!r.ok) throw new Error("unreachable");
    expect(exportFilename(r.data)).toBe("artifact.csv");
  });

  /** Labelled every time it is shown, not only at creation. */
  it("repeats NOT CONFIRMED in the list line", async () => {
    const verified = await save({ id: "v" });
    const unverified = await save({
      id: "u",
      provenance: { producedBy: "ocade.web:page.read", verified: false, evidence: "x" },
    });
    if (!verified.ok || !unverified.ok) throw new Error("unreachable");

    expect(describeArtifact(verified.data)).not.toMatch(/NOT CONFIRMED/);
    expect(describeArtifact(unverified.data)).toMatch(/NOT CONFIRMED/);
    expect(describeArtifact(verified.data)).toMatch(/24 B · from ocade\.data:data\.summarise/);
  });

  it("shows kB for larger artifacts", async () => {
    const r = await save({ content: "x".repeat(5000) });
    if (!r.ok) throw new Error("unreachable");
    expect(describeArtifact(r.data)).toMatch(/4\.9 kB/);
  });
});
