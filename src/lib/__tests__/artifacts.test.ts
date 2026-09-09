import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeOutputStore } from "./support/fake-outputs";

/**
 * Real SHA-256 via Web Crypto, real round-trips through a table that behaves
 * like `ocade_outputs`.
 *
 * The integrity tests deliberately alter stored content and check that the
 * verifier notices — a check that compared the stored hash with itself would
 * pass every one of them.
 *
 * WHY THE ACCOUNT IS FAKED RATHER THAN THE STORE. Artifacts are rows now, and
 * what is worth proving is the store's own logic on top of them: the refusal to
 * save without provenance, the mapping from an artifact's file family to a
 * row's kind and mime, and the re-hash. The fake enforces the same rules the
 * server does, so a store that passes here is not passing because the fake was
 * lenient.
 */

const outputs = createFakeOutputStore();
vi.mock("@/lib/ocade-projects.functions", () => outputs.module);

const {
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
} = await import("../artifacts/store");

beforeEach(() => {
  outputs.reset();
});

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
  it("stores it with its provenance and fingerprint", async () => {
    const r = await save();
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.name).toBe("Quarterly summary");
    expect(r.data.sha256).toHaveLength(64);
    // "region,amount" (13) + LF + "North,120" (9) + LF.
    expect(r.data.byteLength).toBe(24);
    expect(r.data.compatibleApps).toContain("spreadsheet apps");
  });

  it("records the file family on the row, so it survives a reload", async () => {
    // The kind is not kept in the browser: it is carried by the row's mime, and
    // read back from it. Losing it would give every exported file the wrong
    // extension after a refresh.
    await save({ kind: "patch" });
    expect(outputs.rows[0]!.mime).toBe("text/x-diff");
    const [artifact] = await listArtifacts();
    expect(artifact!.kind).toBe("patch");
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
    expect(outputs.rows[0]!.verified).toBe(false);
  });

  it("refuses an artifact with no provenance", async () => {
    const r = await save({
      provenance: { producedBy: "   ", verified: true, evidence: "" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/indistinguishable from a checked one/i);
    expect(outputs.rows, "a provenance-less artifact reached the account").toHaveLength(0);
  });

  it("refuses empty content and empty names", async () => {
    expect((await save({ content: "" })).ok).toBe(false);
    expect((await save({ name: "  " })).ok).toBe(false);
    expect(outputs.rows).toHaveLength(0);
  });

  it("keeps newest first", async () => {
    await save({ name: "First" });
    await save({ name: "Second" });
    expect((await listArtifacts()).map((a) => a.name)).toEqual(["Second", "First"]);
  });

  /**
   * An unreachable account is not an empty one. Reporting "you have no
   * artifacts" to somebody whose connection dropped invites them to conclude
   * their work is gone.
   */
  it("reports an unreachable account instead of losing the artifact quietly", async () => {
    const failing = vi
      .spyOn(outputs.module, "createOutput")
      .mockRejectedValueOnce(new Error("Failed to fetch"));
    const r = await save();
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/could not reach your account/i);
    expect(r.reason).toMatch(/Nothing was changed/i);
    expect(r.reason).toMatch(/Failed to fetch/);
    failing.mockRestore();
  });

  it("distinguishes an unreachable account from an empty one when listing", async () => {
    const failing = vi
      .spyOn(outputs.module, "listOutputs")
      .mockRejectedValueOnce(new Error("offline"));
    const inspected = await inspectArtifactStore();
    expect(inspected.ok).toBe(false);
    if (inspected.ok) throw new Error("unreachable");
    expect(inspected.reason).toMatch(/could not reach your account/i);
    failing.mockRestore();
  });
});

describe("reading and deleting", () => {
  it("finds an artifact by id and returns null for one that isn't there", async () => {
    const saved = await save();
    if (!saved.ok) throw new Error("unreachable");
    expect((await getArtifact(saved.data.id))?.name).toBe("Quarterly summary");
    expect(await getArtifact("nope")).toBeNull();
  });

  it("deletes it", async () => {
    const first = await save({ name: "One" });
    await save({ name: "Two" });
    if (!first.ok) throw new Error("unreachable");
    const r = await removeArtifact(first.data.id);
    if (!r.ok) throw new Error("unreachable");
    expect(await listArtifacts()).toHaveLength(1);
  });

  /**
   * A delete that succeeds for an id that never existed lets the UI report
   * "deleted" for something it didn't touch.
   */
  it("refuses to report success for an artifact that wasn't there", async () => {
    const r = await removeArtifact("never-existed");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/nothing was deleted/i);
  });

  it("returns an empty list rather than crashing the surface when unreachable", async () => {
    const failing = vi
      .spyOn(outputs.module, "listOutputs")
      .mockRejectedValueOnce(new Error("offline"));
    // `listArtifacts` is the lenient reader for places that cannot render an
    // error; `inspectArtifactStore` above is the one that must not lie.
    expect(await listArtifacts()).toEqual([]);
    failing.mockRestore();
  });
});

describe("retention", () => {
  it("sets an expiry without changing content integrity", async () => {
    const saved = await save();
    if (!saved.ok) throw new Error("unreachable");
    const retained = await setArtifactRetention(saved.data.id, 30);
    expect(retained.ok).toBe(true);
    if (!retained.ok) throw new Error("unreachable");
    expect(retained.data.expiresAt).toBeTruthy();
    expect((await verifyIntegrity(saved.data.id)).ok).toBe(true);
  });

  it("takes an expiry off again", async () => {
    const saved = await save();
    if (!saved.ok) throw new Error("unreachable");
    await setArtifactRetention(saved.data.id, 30);
    const cleared = await setArtifactRetention(saved.data.id, null);
    if (!cleared.ok) throw new Error("unreachable");
    expect(cleared.data.expiresAt).toBeNull();
    expect(cleared.evidence).toMatch(/kept until you delete it/i);
  });

  it("purges only expired artifacts", async () => {
    const expired = await save({ name: "Expired" });
    if (!expired.ok) throw new Error("unreachable");
    await setArtifactRetention(expired.data.id, 1);
    await save({ name: "Kept" });
    // Push the expiry into the past, which is what a day passing does.
    outputs.corrupt(expired.data.id, { expires_at: "2020-01-01T00:00:00.000Z" });

    const result = await purgeExpiredArtifacts();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.removed).toBe(1);
    expect((await listArtifacts()).map((artifact) => artifact.name)).toEqual(["Kept"]);
  });

  it("refuses an invalid retention window", async () => {
    const saved = await save();
    if (!saved.ok) throw new Error("unreachable");
    expect((await setArtifactRetention(saved.data.id, 0)).ok).toBe(false);
    expect((await setArtifactRetention(saved.data.id, 3651)).ok).toBe(false);
  });

  it("refuses retention for an artifact that isn't there", async () => {
    const r = await setArtifactRetention("00000000-0000-0000-0000-000000000000", 30);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/isn't here/i);
  });
});

/**
 * The check exists to catch content that changed after it was written. A
 * verifier that compared the stored hash with itself would pass all of these.
 */
describe("integrity is checked by re-hashing", () => {
  it("confirms an untouched artifact", async () => {
    const saved = await save();
    if (!saved.ok) throw new Error("unreachable");
    const r = await verifyIntegrity(saved.data.id);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.intact).toBe(true);
    expect(r.evidence).toMatch(/byte-for-byte what was written/i);
  });

  it("CATCHES content that was altered in storage", async () => {
    const saved = await save();
    if (!saved.ok) throw new Error("unreachable");
    outputs.corrupt(saved.data.id, { content: "region,amount\nNorth,999\n" });

    const r = await verifyIntegrity(saved.data.id);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.intact).toBe(false);
    expect(r.data.storedHash).not.toBe(r.data.actualHash);
    expect(r.evidence).toMatch(/has changed since it was stored/i);
    expect(r.evidence).toMatch(/Don't rely on it/i);
  });

  it("catches truncation, not just substitution", async () => {
    const saved = await save();
    if (!saved.ok) throw new Error("unreachable");
    outputs.corrupt(saved.data.id, { content: saved.data.content.slice(0, 10) });

    const r = await verifyIntegrity(saved.data.id);
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
      const r = await save({ kind, name: "Thing" });
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
    const verified = await save();
    const unverified = await save({
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

  /**
   * A row written before provenance existed cannot have a producer. It is shown
   * as unconfirmed rather than given an invented one — the exact lie the
   * provenance columns exist to prevent.
   */
  it("renders a row with no recorded producer as unconfirmed", async () => {
    const saved = await save();
    if (!saved.ok) throw new Error("unreachable");
    outputs.corrupt(saved.data.id, { produced_by: null, verified: false });
    const [artifact] = await listArtifacts();
    expect(describeArtifact(artifact!)).toMatch(/NOT CONFIRMED/);
    expect(artifact!.provenance.producedBy).toMatch(/earlier version of OCADE/);
  });
});
