import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { rehearseRecovery } from "../../../../scripts/recovery-rehearsal.mts";

/*
 * RECOVERY, DEMONSTRATED -- PLAN.md Phase 16.
 *
 * The phase gate is "recovery is demonstrated, not just documented", so this
 * suite does not assert that a runbook mentions a restore. It performs one:
 * a live database with two accounts' data in it, a backup, a SECOND empty
 * PostgreSQL that has never seen the schema, the schema rebuilt from
 * `supabase/migrations/` alone, the rows put back, and then the questions that
 * decide whether what came back is the same product:
 *
 *   - Does every table hold the same rows, by digest and not only by count?
 *   - Does every foreign key still validate against the restored rows?
 *   - Are the sequences usable, or does the next insert collide?
 *   - Did row-level security come back WITH the data?
 *   - Can one account read the other's rows in the restored database?
 *   - Can the newest migration be rolled back and re-applied there?
 *
 * The last two are why this is worth the minute it costs. A restore that
 * returns every row and loses the policies has good numbers and is a breach.
 *
 * The run writes `release/OCADE_RECOVERY_REHEARSAL.json`, which carries counts
 * and digests only. `evidenceLeaks` is asserted here rather than trusted: an
 * evidence file that quietly gained a column of restored row values would be
 * the rehearsal leaking the data it exists to protect.
 */

const EVIDENCE = "release/OCADE_RECOVERY_REHEARSAL.json";

describe("a total loss, recovered", () => {
  it("rebuilds the schema, restores the rows and keeps every guarantee", async () => {
    const { report, leaks } = await rehearseRecovery();

    mkdirSync(dirname(EVIDENCE), { recursive: true });
    writeFileSync(EVIDENCE, `${JSON.stringify(report, null, 2)}\n`);

    const failedSteps = report.steps.filter((s) => s.status === "failed");
    expect(
      failedSteps.map((s) => `${s.step}: ${s.detail}`),
      "a step of the recovery did not hold",
    ).toEqual([]);

    // Every named step ran. A rehearsal that returned early would report no
    // failures and prove nothing, which is the shape this catches.
    expect(report.steps.length).toBeGreaterThanOrEqual(10);
    expect(report.recovered).toBe(true);

    // There was real data to lose.
    const restoredRows = report.inventory.reduce((sum, t) => sum + t.rowCount, 0);
    expect(restoredRows).toBeGreaterThan(20);

    // The evidence file names no credential, address or row value.
    expect(leaks).toEqual([]);
  }, 600_000);
});
