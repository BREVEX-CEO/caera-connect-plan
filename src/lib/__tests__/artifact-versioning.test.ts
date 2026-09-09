import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeOutputStore } from "./support/fake-outputs";
import type { Artifact } from "../artifacts/store";

/**
 * VERSION HISTORIES, OVER A CHAIN THE ACCOUNT RECORDS.
 *
 * Lineages used to be inferred from name and kind, which was wrong in both
 * directions: renaming a file split its history, and two unrelated files that
 * happened to share a name were shown as versions of each other. `ocade_outputs`
 * carries `lineage_id`, `version` and `parent_output_id`, so a chain is now
 * something a caller states rather than something this layer guesses.
 */

const outputs = createFakeOutputStore();
vi.mock("@/lib/ocade-projects.functions", () => outputs.module);

const { versionsOf, groupIntoLineages, findLineage, compareVersions, restoreVersion } =
  await import("../artifacts/versioning");
const { saveArtifact, listArtifacts } = await import("../artifacts/store");

beforeEach(() => {
  outputs.reset();
});

let made = 0;
const artifact = (over: Partial<Artifact>): Artifact => {
  made += 1;
  return {
    id: `a-${made}`,
    name: "Report",
    kind: "table",
    content: "x",
    createdAt: "2026-07-24T10:00:00.000Z",
    provenance: { producedBy: "test", verified: true, evidence: "ok" },
    sha256: "hash-x",
    byteLength: 1,
    // One chain unless a case says otherwise: these are version-ordering tests,
    // and the grouping tests set their own.
    lineageId: "lineage-default",
    version: made,
    parentId: null,
    compatibleApps: over.compatibleApps ?? ["spreadsheet apps"],
    ...over,
  };
};

describe("building version histories", () => {
  it("orders records oldest-to-newest with the newest marked current", () => {
    const v = versionsOf([
      artifact({ id: "1", version: 1, sha256: "a", content: "a" }),
      artifact({ id: "2", version: 2, sha256: "b", content: "b" }),
      artifact({ id: "3", version: 3, sha256: "c", content: "c" }),
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
      artifact({ id: "1", version: 1, sha256: "same" }),
      artifact({ id: "2", version: 2, sha256: "same" }),
      artifact({ id: "3", version: 3, sha256: "different" }),
    ]);
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.number)).toEqual([1, 2]);
  });

  it("only collapses CONSECUTIVE identical saves, keeping a genuine revert as a version", () => {
    // a → b → a: the third is content that matches v1 but is a real later state.
    const v = versionsOf([
      artifact({ id: "1", version: 1, sha256: "a" }),
      artifact({ id: "2", version: 2, sha256: "b" }),
      artifact({ id: "3", version: 3, sha256: "a" }),
    ]);
    expect(v).toHaveLength(3);
  });

  it("breaks a tie deterministically, for rows that predate versioning", () => {
    // Same version number and same timestamp: without the id tiebreak the order
    // would be whatever the query happened to return, and "v1" would mean a
    // different row on different loads.
    const v = versionsOf([
      artifact({ id: "b", version: 1, createdAt: "2026-07-24T10:00:00.000Z", sha256: "2" }),
      artifact({ id: "a", version: 1, createdAt: "2026-07-24T10:00:00.000Z", sha256: "1" }),
    ]);
    expect(v[0].artifact.id).toBe("a");
  });
});

describe("grouping into lineages", () => {
  it("keeps two artifacts that merely SHARE A NAME apart", () => {
    /*
     * The defect the recorded chain removes. Two unrelated files called
     * "Report" were shown as versions of each other, so opening the history of
     * one offered to restore the other over it.
     */
    const lineages = groupIntoLineages([
      artifact({ name: "Report", kind: "table", lineageId: "one", sha256: "1" }),
      artifact({ name: "Report", kind: "table", lineageId: "two", sha256: "2" }),
    ]);
    expect(lineages).toHaveLength(2);
  });

  it("keeps a RENAMED artifact in its own chain", () => {
    // The other half of the same defect: a rename used to split a history in
    // two and lose everything before it.
    const lineages = groupIntoLineages([
      artifact({ name: "Draft", kind: "text", lineageId: "one", version: 1, sha256: "1" }),
      artifact({ name: "Final", kind: "text", lineageId: "one", version: 2, sha256: "2" }),
    ]);
    expect(lineages).toHaveLength(1);
    expect(lineages[0].versions).toHaveLength(2);
    // Named by the CURRENT version: showing somebody a name they deliberately
    // changed is its own small dishonesty.
    expect(lineages[0].name).toBe("Final");
  });

  it("puts the most recently updated lineage first", () => {
    const lineages = groupIntoLineages([
      artifact({
        name: "Old",
        kind: "table",
        lineageId: "old",
        createdAt: "2026-07-24T09:00:00.000Z",
        sha256: "1",
      }),
      artifact({
        name: "New",
        kind: "table",
        lineageId: "new",
        createdAt: "2026-07-24T12:00:00.000Z",
        sha256: "2",
      }),
    ]);
    expect(lineages[0].name).toBe("New");
  });

  it("finds a specific lineage by its current name and kind", () => {
    const all = [
      artifact({ name: "Report", kind: "table", lineageId: "r", version: 1, sha256: "1" }),
      artifact({ name: "Report", kind: "table", lineageId: "r", version: 2, sha256: "2" }),
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
    if (!v1.ok) throw new Error("unreachable");
    await saveArtifact({
      name: "Doc",
      kind: "text",
      content: "second draft",
      provenance: { producedBy: "test", verified: true, evidence: "v2" },
      // Stated, not guessed from the name.
      parentId: v1.data.id,
    });

    const lineageBefore = findLineage(await listArtifacts(), "Doc", "text")!;
    expect(lineageBefore.versions).toHaveLength(2);
    expect(lineageBefore.current.artifact.content).toBe("second draft");

    // Restore version 1.
    const restored = await restoreVersion(lineageBefore.versions[0]);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error("unreachable");

    const lineageAfter = findLineage(await listArtifacts(), "Doc", "text")!;
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
    const lineage = findLineage(await listArtifacts(), "Unchecked", "text")!;
    const restored = await restoreVersion(lineage.current);
    if (!restored.ok) throw new Error("unreachable");
    // A restore of unverified content stays unverified — no laundering.
    expect(restored.data.provenance.verified).toBe(false);
  });
});
