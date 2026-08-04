import { describe, it, expect, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The evidence-integrity gate — proving each of its six conditions rejects.
 *
 * A gate nobody has watched refuse anything is decoration. This repository has
 * already shipped one fabricated green result (`app-coverage-registry` claiming
 * Blender was installed on a machine without it), and the gate that was
 * supposed to catch it checked only that a file existed. So every condition
 * below is proven to FAIL on a specific, realistic corruption — not merely
 * asserted to be present in the source.
 *
 * SAFETY: the TRACKED snapshot is never written. Each corruption goes to its
 * own temporary file and the gate is pointed at it with `--snapshot`.
 *
 * It did corrupt the tracked file and restore it in `afterEach`, which was safe
 * only while Vitest ran one file at a time. In parallel that made the snapshot
 * a shared mutable resource, and `final-readiness.test.ts` — which only READS
 * it — began failing intermittently on a half-corrupted file. The defect was
 * here, not there. Removing the shared resource beats serialising two suites
 * around it.
 */

const GATE = "scripts/check-evidence-integrity.mjs";
const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";

const ORIGINAL = readFileSync(SNAPSHOT, "utf8");
const WORKSPACE = mkdtempSync(join(tmpdir(), "ocade-evidence-gate-"));
let scratchCounter = 0;

type GateResult = { ok: boolean; stdout: string; stderr: string };

async function runGate(snapshotPath: string = SNAPSHOT): Promise<GateResult> {
  try {
    const { stdout, stderr } = await run(process.execPath, [GATE, "--snapshot", snapshotPath]);
    return { ok: true, stdout, stderr };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

/**
 * Corrupt the snapshot in one specific way, then run the gate against it.
 *
 * Each call writes to its OWN temporary file rather than the tracked snapshot,
 * so nothing else in the suite can observe a half-corrupted state.
 */
async function withCorrupted(
  mutate: (snapshot: { requirements: Record<string, unknown>[] } & Record<string, unknown>) => void,
): Promise<GateResult> {
  const snapshot = JSON.parse(ORIGINAL);
  mutate(snapshot);
  const scratch = join(WORKSPACE, `snapshot-${scratchCounter++}.json`);
  writeFileSync(scratch, JSON.stringify(snapshot, null, 2) + "\n");
  return runGate(scratch);
}

/** The first row currently holding the given status. */
function rowWith(
  snapshot: { requirements: Record<string, unknown>[] },
  status: string,
): Record<string, unknown> {
  const row = snapshot.requirements.find((r) => r.status === status);
  if (!row) throw new Error(`fixture missing: no row with status ${status}`);
  return row;
}

afterAll(() => {
  rmSync(WORKSPACE, { recursive: true, force: true });
});

describe("the evidence-integrity gate rejects false progress", () => {
  it("FAILS when a requirement has no owner", async () => {
    const result = await withCorrupted((s) => {
      delete s.requirements[0].owner;
    });
    expect(result.ok, "an ownerless requirement must break the gate").toBe(false);
    expect(result.stderr).toMatch(/no_owner/);
  });

  it("FAILS when a blocked row names no exit condition", async () => {
    const result = await withCorrupted((s) => {
      delete rowWith(s, "EXTERNALLY BLOCKED").blockerOwner;
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/blocker_unspecified/);
  });

  it("FAILS when evidence cites a file that is not on disk", async () => {
    const result = await withCorrupted((s) => {
      s.requirements[0].evidence = "release/OCADE_THIS_FILE_HAS_NEVER_EXISTED.json — proof of work";
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/evidence_file_missing/);
    expect(result.stderr).toMatch(/OCADE_THIS_FILE_HAS_NEVER_EXISTED\.json/);
  });

  it("FAILS when evidence is bound to a revision that is not the committed one", async () => {
    const result = await withCorrupted((s) => {
      (s.evidenceBindings as Record<string, unknown>).sourceRevision = "0".repeat(40);
      s.head = "0".repeat(40);
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/revision_drift/);
  });

  it("FAILS when a real-target claim retains no raw evidence artefact", async () => {
    const result = await withCorrupted((s) => {
      // Keeps the status, removes the retained artefact — the exact shape of a
      // claim that says "proven on real equipment" and keeps nothing.
      rowWith(s, "REAL TARGET RUNTIME VERIFIED").evidence =
        "observed working on the real device during a manual session";
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/real_target_without_evidence/);
  });

  it("FAILS when a structural-only test is cited as runtime proof", async () => {
    /*
     * The ledger key is `structuralOnly`, and its entries carry no `kind`
     * field. An earlier version of this test looked for `kinds.files` with
     * `kind === "structural"`, found nothing, and returned early — passing
     * while proving nothing. Asserting the fixture exists is what stops that
     * happening again.
     */
    const kinds = JSON.parse(readFileSync("release/OCADE_TEST_KINDS.json", "utf8")) as {
      structuralOnly?: { path: string }[];
    };
    const structural = kinds.structuralOnly ?? [];
    expect(structural.length, "fixture missing: no structural-only tests declared").toBeGreaterThan(
      0,
    );
    const target = structural[0].path;

    const result = await withCorrupted((s) => {
      const row = rowWith(s, "REAL TARGET RUNTIME VERIFIED");
      // Keep a real retained artefact alongside it, so the ONLY thing wrong is
      // the structural test being passed off as runtime proof. Otherwise this
      // would pass for the unrelated real_target_without_evidence reason.
      row.evidence = `release/OCADE_EVIDENCE_REPORT.json and ${target} — runtime proof on the real target`;
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/source_text_as_runtime_proof/);
    expect(result.stderr).toContain(target);
  });

  it("FAILS when a blocked row is weighted as though it were proven", async () => {
    const result = await withCorrupted((s) => {
      rowWith(s, "EXTERNALLY BLOCKED").weight = 1;
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/blocked_but_verified/);
  });

  it("reports a violation count and a per-code breakdown", async () => {
    const result = await withCorrupted((s) => {
      delete s.requirements[0].owner;
      delete s.requirements[1].owner;
    });
    expect(result.stderr).toMatch(/gate FAILED — \d+ violation\(s\)/);
    expect(result.stderr).toMatch(/no_owner: 2/);
  });
});

describe("the tracked snapshot was never touched", () => {
  it("leaves the snapshot byte-identical to how it was found", () => {
    // Stronger than it looks now: with corruption confined to temporary files
    // this can only fail if something reintroduced a write to the real one.
    expect(readFileSync(SNAPSHOT, "utf8")).toBe(ORIGINAL);
  });

  it("passes on the restored snapshot", async () => {
    const result = await runGate();
    expect(result.ok, result.stderr).toBe(true);
    expect(result.stdout).toMatch(/0 violations/);
  });
});
