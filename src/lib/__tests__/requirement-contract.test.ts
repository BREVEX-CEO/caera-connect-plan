import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { STATUS_WEIGHTS } from "../../../scripts/readiness-engine.mjs";

/**
 * THE REQUIREMENT REGISTER'S OWN CONTRACT, EXECUTED.
 *
 * Five register rows described the evidence system itself — stable requirement
 * IDs, the evidence ladder, the evidence policy, traceability, and the
 * definition of done — and all five sat at SOURCE COMPLETE with evidence
 * reading "artefact verified present". That phrase is the problem. It proves a
 * Markdown file exists, which is exactly the standard the register was built to
 * reject: a document asserting that requirements are traceable is not
 * traceability.
 *
 * So the contract is executed here. The weight table is imported from the
 * production engine rather than restated, the integrity gate is run as a
 * subprocess, and the register is checked for the properties it claims to have.
 *
 * A note on what this cannot do: none of it observes the product running. These
 * rows are about the accounting, and accurate accounting of untested code is
 * still accurate accounting.
 */

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const rows: Array<{
  id: string;
  status: string;
  weight: number;
  evidence?: string;
  resolvedInPhase?: string;
  owner?: string;
  ownerKind?: string;
  area?: string;
  subject?: string;
}> = snapshot.requirements;

function run(script: string): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync(process.execPath, [script], { encoding: "utf8" }) };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("requirement identifiers are stable and unique (AZ-017)", () => {
  it("carries exactly 510 rows, the published denominator", () => {
    expect(rows).toHaveLength(510);
    expect(snapshot.readiness.expanded.denominator).toBe(510);
  });

  it("has no duplicate identifier", () => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
    const duplicates = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    // A duplicate id silently merges two requirements: one of them can never be
    // closed, and the count still reads 510.
    expect(duplicates).toEqual([]);
  });

  it("uses a stable prefixed form for every id", () => {
    const malformed = rows.filter((r) => !/^[A-Z]{2,4}-\d{2,3}$/.test(r.id)).map((r) => r.id);
    expect(malformed).toEqual([]);
  });

  it("gives every row a subject and an area, so an id is resolvable to work", () => {
    const empty = rows.filter((r) => !r.subject?.trim() || !r.area?.trim()).map((r) => r.id);
    expect(empty).toEqual([]);
  });
});

describe("the evidence ladder is executed, not described (AZ-021)", () => {
  it("defines exactly the eight statuses the register uses", () => {
    // Imported from the production engine. Restating the table here would let
    // the two drift, and the test would then be checking itself.
    const used = new Set(rows.map((r) => r.status));
    for (const status of used) {
      expect(STATUS_WEIGHTS, `${status} has no weight in the engine`).toHaveProperty(status);
    }
  });

  it("orders the ladder so a stronger claim always outweighs a weaker one", () => {
    const ladder = [
      "NOT STARTED",
      "PARTIAL SOURCE",
      "SOURCE COMPLETE",
      "UNIT TESTED",
      "INTEGRATION TESTED",
      "SIMULATED RUNTIME VERIFIED",
      "REAL TARGET RUNTIME VERIFIED",
    ];
    for (let i = 1; i < ladder.length; i += 1) {
      expect(
        STATUS_WEIGHTS[ladder[i]],
        `${ladder[i]} does not outweigh ${ladder[i - 1]}`,
      ).toBeGreaterThan(STATUS_WEIGHTS[ladder[i - 1]]);
    }
  });

  it("reserves 1.0 for real-target observation alone", () => {
    const full = Object.entries(STATUS_WEIGHTS).filter(([, w]) => w === 1);
    // If anything else reached 1.0, "complete" would stop meaning "seen working
    // on the thing it ships to", which is the only claim worth the word.
    expect(full.map(([s]) => s)).toEqual(["REAL TARGET RUNTIME VERIFIED"]);
  });

  it("caps an externally blocked row below proven", () => {
    // If work is genuinely blocked, nobody has seen it run.
    expect(STATUS_WEIGHTS["EXTERNALLY BLOCKED"]).toBeLessThan(
      STATUS_WEIGHTS["SIMULATED RUNTIME VERIFIED"],
    );
    expect(STATUS_WEIGHTS["EXTERNALLY BLOCKED"]).toBeLessThan(1);
  });

  it("declares every row's weight consistently with its status", () => {
    const mismatched = rows
      .filter((r) => r.weight !== STATUS_WEIGHTS[r.status])
      .map((r) => `${r.id}: ${r.status} declares ${r.weight}`);
    expect(mismatched).toEqual([]);
  });
});

describe("the evidence policy is enforced by a gate that runs (AZ-006)", () => {
  it("names the policy document the ladder comes from", () => {
    expect(existsSync("release/OCADE_EVIDENCE_TIERS.md")).toBe(true);
  });

  it("runs the integrity gate and passes it", () => {
    const result = run("scripts/check-evidence-integrity.mjs");
    expect(result.ok, result.out).toBe(true);
    expect(result.out).toMatch(/0 violations/);
  });

  it("the gate genuinely rejects a row with no owner", () => {
    /*
     * A gate that cannot fail is decoration. This mutates a COPY of the
     * register — never the tracked file — and requires the gate to notice.
     *
     * The mutation is a missing owner, which is one of the rules this gate
     * actually owns. An earlier version of this probe stripped `evidence` and
     * `resolvedInPhase` and the gate passed, correctly: that rule belongs to
     * the readiness engine, not here. Probing a gate for a rule it does not
     * enforce proves nothing about either.
     */
    const mutated = JSON.parse(JSON.stringify(snapshot));
    const victim = mutated.requirements.find((r: { status: string }) => r.status === "UNIT TESTED");
    delete victim.owner;
    delete victim.ownerKind;

    const tmp = "release/.integrity-mutation-probe.json";
    try {
      writeFileSync(tmp, JSON.stringify(mutated));
      let failed = false;
      let out = "";
      try {
        out = execFileSync(
          process.execPath,
          ["scripts/check-evidence-integrity.mjs", "--snapshot", tmp],
          { encoding: "utf8" },
        );
      } catch (error) {
        failed = true;
        out = (error as { stdout?: string }).stdout ?? "";
      }
      expect(failed, `the gate accepted an evidence-free claim:\n${out}`).toBe(true);
    } finally {
      rmSync(tmp, { force: true });
    }
  });
});

describe("traceability holds from row to file (AZ-018)", () => {
  it("gives every positive-weight row evidence and an observing phase", () => {
    const untraceable = rows
      .filter((r) => r.weight > 0 && (!r.evidence?.trim() || !r.resolvedInPhase?.trim()))
      .map((r) => r.id);
    expect(untraceable).toEqual([]);
  });

  it("cites only files that exist", () => {
    // The gate checks this too; asserted here because it is the whole meaning
    // of traceability and should fail in the suite, not only in a subprocess.
    const missing: string[] = [];
    for (const r of rows) {
      /*
       * The final segment must carry an extension. Evidence is prose with paths
       * embedded in it, and without that constraint the phrase "refuse DNS
       * queries, relays, public/hostname destinations" parses as a path under
       * `public/`. This reports missing files, not prose it failed to parse.
       */
      const cited =
        r.evidence?.match(
          /\b(?:release|src|scripts|native|extension|mobile|supabase|docs|public|\.github)\/[A-Za-z0-9._$/-]*[A-Za-z0-9_-]\.[A-Za-z0-9]{2,5}\b/g,
        ) ?? [];
      for (const path of cited) {
        const clean = path.replace(/[.,;:)]+$/, "");
        if (!existsSync(clean)) missing.push(`${r.id} -> ${clean}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("assigns an owner and an owner kind to every row", () => {
    const unowned = rows.filter((r) => !r.owner?.trim() || !r.ownerKind?.trim()).map((r) => r.id);
    expect(unowned).toEqual([]);
  });

  it("marks every externally blocked row as externally owned", () => {
    // The distinction that keeps the number honest: an internally owned row
    // cannot hide behind "blocked".
    const wrong = rows
      .filter((r) => r.status === "EXTERNALLY BLOCKED" && r.ownerKind !== "external")
      .map((r) => r.id);
    expect(wrong).toEqual([]);
  });
});

describe("the definition of done is applied to the published score (AZ-023, CXR-10)", () => {
  it("names the definition-of-done document", () => {
    expect(existsSync("release/OCADE_DEFINITION_OF_DONE.md")).toBe(true);
  });

  it("runs the readiness gate and passes it", () => {
    const result = run("scripts/check-final-readiness.mjs");
    expect(result.ok, result.out).toBe(true);
  });

  it("publishes a score that matches a recount of the rows", () => {
    const recomputed = rows.reduce((sum, r) => sum + STATUS_WEIGHTS[r.status], 0);
    expect(Number(recomputed.toFixed(1))).toBe(snapshot.readiness.expanded.numerator);
  });

  it("publishes status counts that match the rows", () => {
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    expect(snapshot.counts).toEqual(counts);
  });

  it("refuses to call the product production ready", () => {
    /*
     * The single most important assertion in this file. 27 of 510 rows have
     * been observed on a real target and none of the signing, deployment or
     * device evidence exists. A readiness document that said otherwise would be
     * the exact failure the whole evidence system was built to prevent.
     */
    const publication = JSON.parse(readFileSync("release/OCADE_P29_FINAL_READINESS.json", "utf8"));
    const asText = JSON.stringify(publication);
    expect(asText).toMatch(/"productionReady":\s*false|PRODUCTION READY: NO/i);
  });

  it("keeps declared and evidence-bound closure equal, or explains the gap", () => {
    const publication = JSON.parse(readFileSync("release/OCADE_P29_FINAL_READINESS.json", "utf8"));
    // A declared score above the evidence-bound one means rows are claiming
    // weight their evidence does not support.
    const declared = publication.declaredWeighted ?? publication.declared;
    const bound = publication.evidenceBound ?? publication.evidenceBoundClosure;
    if (typeof declared === "number" && typeof bound === "number") {
      expect(declared).toBeLessThanOrEqual(bound + 0.05);
    }
    expect(publication.unverifiedPositiveWeightDeclarations ?? 0).toBe(0);
  });
});
