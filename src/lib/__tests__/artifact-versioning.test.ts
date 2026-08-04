import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  versionsOf,
  groupIntoLineages,
  findLineage,
  compareVersions,
  restoreVersion,
} from "../artifacts/versioning";
import { saveArtifact, listArtifacts, type Artifact } from "../artifacts/store";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

const artifact = (over: Partial<Artifact>): Artifact => ({
  id: `a-${Math.random().toString(36).slice(2)}`,
  name: "Report",
  kind: "table",
  content: "x",
  createdAt: "2026-07-24T10:00:00.000Z",
  provenance: { producedBy: "test", verified: true, evidence: "ok" },
  sha256: "hash-x",
  byteLength: 1,
  ...over,
  privacyClass: over.privacyClass ?? "on_device",
  compatibleApps: over.compatibleApps ?? ["spreadsheet apps"],
});

describe("building version histories", () => {
  it("orders records oldest-to-newest with the newest marked current", () => {
    const v = versionsOf([
      artifact({ id: "1", createdAt: "2026-07-24T10:00:00.000Z", sha256: "a", content: "a" }),
      artifact({ id: "2", createdAt: "2026-07-24T11:00:00.000Z", sha256: "b", content: "b" }),
      artifact({ id: "3", createdAt: "2026-07-24T12:00:00.000Z", sha256: "c", content: "c" }),
    ]);
    expect(v.map((x) => x.number)).toEqual([1, 2, 3]);
    expect(v[2].current).toBe(true);
    expect(v[0].current).toBe(false);
  });

  /**
   * Rule 1: identical bytes re-saved is the same artifact, not a new version.
   * Counting it would make version numbers meaningless.
   */
  it("collapses identical-hash re-saves into one version", () => {
    const v = versionsOf([
      artifact({ id: "1", createdAt: "2026-07-24T10:00:00.000Z", sha256: "same" }),
      artifact({ id: "2", createdAt: "2026-07-24T11:00:00.000Z", sha256: "same" }),
      artifact({ id: "3", createdAt: "2026-07-24T12:00:00.000Z", sha256: "different" }),
    ]);
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.number)).toEqual([1, 2]);
  });

  it("only collapses CONSECUTIVE identical saves, keeping a genuine revert as a version", () => {
    // a → b → a: the third is content that matches v1 but is a real later state.
    const v = versionsOf([
      artifact({ id: "1", createdAt: "2026-07-24T10:00:00.000Z", sha256: "a" }),
      artifact({ id: "2", createdAt: "2026-07-24T11:00:00.000Z", sha256: "b" }),
      artifact({ id: "3", createdAt: "2026-07-24T12:00:00.000Z", sha256: "a" }),
    ]);
    expect(v).toHaveLength(3);
  });

  it("breaks a timestamp tie deterministically by id", () => {
    const v = versionsOf([
      artifact({ id: "b", createdAt: "2026-07-24T10:00:00.000Z", sha256: "2" }),
      artifact({ id: "a", createdAt: "2026-07-24T10:00:00.000Z", sha256: "1" }),
    ]);
    expect(v[0].artifact.id).toBe("a");
  });
});

describe("grouping into lineages", () => {
  it("groups by name AND kind, so a name clash across kinds doesn't merge", () => {
    const lineages = groupIntoLineages([
      artifact({ name: "Report", kind: "table", sha256: "1" }),
      artifact({ name: "Report", kind: "text", sha256: "2" }),
    ]);
    expect(lineages).toHaveLength(2);
  });

  it("puts the most recently updated lineage first", () => {
    const lineages = groupIntoLineages([
      artifact({ name: "Old", kind: "table", createdAt: "2026-07-24T09:00:00.000Z", sha256: "1" }),
      artifact({ name: "New", kind: "table", createdAt: "2026-07-24T12:00:00.000Z", sha256: "2" }),
    ]);
    expect(lineages[0].name).toBe("New");
  });

  it("finds a specific lineage by name and kind", () => {
    const all = [
      artifact({
        name: "Report",
        kind: "table",
        sha256: "1",
        createdAt: "2026-07-24T10:00:00.000Z",
      }),
      artifact({
        name: "Report",
        kind: "table",
        sha256: "2",
        createdAt: "2026-07-24T11:00:00.000Z",
      }),
    ];
    const lineage = findLineage(all, "Report", "table");
    expect(lineage?.versions).toHaveLength(2);
    expect(lineage?.current.number).toBe(2);
  });
});

/**
 * Rule 2: a comparison reports only what the bytes prove, never a semantic diff.
 */
describe("comparing versions honestly", () => {
  it("reports size change and content change", () => {
    const c = compareVersions(
      { number: 1, current: false, artifact: artifact({ byteLength: 100, sha256: "a" }) },
      { number: 2, current: true, artifact: artifact({ byteLength: 150, sha256: "b" }) },
    );
    expect(c.byteDelta).toBe(50);
    expect(c.summary).toMatch(/\+50 bytes/);
    expect(c.summary).toMatch(/content changed/);
  });

  it("normalises order so from is always the earlier version", () => {
    const c = compareVersions(
      { number: 3, current: true, artifact: artifact({ byteLength: 150 }) },
      { number: 1, current: false, artifact: artifact({ byteLength: 100 }) },
    );
    expect(c.from).toBe(1);
    expect(c.to).toBe(3);
    expect(c.byteDelta).toBe(50);
  });

  /**
   * A drop from verified to unverified between versions is a regression the
   * user needs flagged, not buried.
   */
  it("flags a loss of verification as a regression", () => {
    const c = compareVersions(
      {
        number: 1,
        current: false,
        artifact: artifact({ provenance: { producedBy: "t", verified: true, evidence: "ok" } }),
      },
      {
        number: 2,
        current: true,
        artifact: artifact({ provenance: { producedBy: "t", verified: false, evidence: "x" } }),
      },
    );
    expect(c.lostVerification).toBe(true);
    expect(c.summary).toMatch(/verified to NOT CONFIRMED.*regression/i);
  });

  it("does not flag a regression when verification improves", () => {
    const c = compareVersions(
      {
        number: 1,
        current: false,
        artifact: artifact({ provenance: { producedBy: "t", verified: false, evidence: "x" } }),
      },
      {
        number: 2,
        current: true,
        artifact: artifact({ provenance: { producedBy: "t", verified: true, evidence: "ok" } }),
      },
    );
    expect(c.lostVerification).toBe(false);
  });
});

describe("restoring a version is append-only", () => {
  it("re-saves a prior version's content as a new current version, keeping history", async () => {
    // Two real versions in the store.
    const v1 = await saveArtifact({
      name: "Doc",
      kind: "text",
      content: "first draft",
      provenance: { producedBy: "test", verified: true, evidence: "v1" },
    });
    await saveArtifact({
      name: "Doc",
      kind: "text",
      content: "second draft",
      provenance: { producedBy: "test", verified: true, evidence: "v2" },
    });
    if (!v1.ok) throw new Error("unreachable");

    const lineageBefore = findLineage(listArtifacts(), "Doc", "text")!;
    expect(lineageBefore.versions).toHaveLength(2);
    expect(lineageBefore.current.artifact.content).toBe("second draft");

    // Restore version 1.
    const restored = await restoreVersion(lineageBefore.versions[0]);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error("unreachable");

    const lineageAfter = findLineage(listArtifacts(), "Doc", "text")!;
    // Three saves, but v3 content == v1 content (non-consecutive), so 3 versions.
    expect(lineageAfter.current.artifact.content).toBe("first draft");
    expect(lineageAfter.current.artifact.provenance.producedBy).toMatch(/ocade\.restore:v1/);
    // Nothing was deleted — the second draft is still in history.
    expect(lineageAfter.versions.some((v) => v.artifact.content === "second draft")).toBe(true);
  });

  it("preserves the original's verification status on restore", async () => {
    const original = await saveArtifact({
      name: "Unchecked",
      kind: "text",
      content: "data",
      provenance: { producedBy: "test", verified: false, evidence: "not confirmed" },
    });
    if (!original.ok) throw new Error("unreachable");
    const lineage = findLineage(listArtifacts(), "Unchecked", "text")!;
    const restored = await restoreVersion(lineage.current);
    if (!restored.ok) throw new Error("unreachable");
    // A restore of unverified content stays unverified — no laundering.
    expect(restored.data.provenance.verified).toBe(false);
  });
});
