/**
 * Recompute the snapshot's derived summary fields from its own rows.
 *
 * WHY THIS EXISTS
 * ---------------
 * `counts`, `readiness` and `evidenceTiers` are all derivable from the rows,
 * but were maintained by hand. Hand-maintained derived data drifts, and it
 * drifted here: `verifiedCommands` still claimed "3919 tests across 236 files"
 * and "gates 28/28" long after the suite reached 4,167 across 253 with 43 gates.
 * Those numbers looked like evidence while being stale, which is the exact
 * failure this register is supposed to prevent.
 *
 * Weights come from the readiness engine itself rather than a second copy, so
 * the two can never disagree.
 *
 * Usage: node scripts/resync-snapshot-summary.mjs [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { STATUS_WEIGHTS } from "./readiness-engine.mjs";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const write = process.argv.includes("--write");

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const rows = snapshot.requirements;

const round = (n) => Math.round(n * 10) / 10;
const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

// Build counts in row order — the engine compares with JSON.stringify, so key
// insertion order is part of the contract, not an incidental detail.
const counts = {};
let expanded = 0;
let originalCore = 0;

for (const row of rows) {
  const weight = STATUS_WEIGHTS[row.status];
  if (weight === undefined) throw new Error(`${row.id}: unknown status "${row.status}"`);
  if (Number(row.weight) !== weight) {
    throw new Error(`${row.id}: weight ${row.weight} but ${row.status} requires ${weight}`);
  }
  counts[row.status] = (counts[row.status] ?? 0) + 1;
  expanded += weight;
  if (row.id.startsWith("AZ-")) originalCore += weight;
}

const originalCoreDenominator = rows.filter((r) => r.id.startsWith("AZ-")).length;

snapshot.counts = counts;
snapshot.readiness = {
  originalCore: {
    numerator: round(originalCore),
    denominator: originalCoreDenominator,
    percent: pct(originalCore, originalCoreDenominator),
  },
  expanded: {
    numerator: round(expanded),
    denominator: rows.length,
    percent: pct(expanded, rows.length),
  },
};
snapshot.evidenceTiers = {
  simulatedRuntime: counts["SIMULATED RUNTIME VERIFIED"] ?? 0,
  hostedRuntime: counts["HOSTED RUNTIME VERIFIED"] ?? 0,
  realTargetRuntime: counts["REAL TARGET RUNTIME VERIFIED"] ?? 0,
  productionReady: counts["PRODUCTION READY"] ?? 0,
};

console.log("Recomputed from rows:");
console.log(`  expanded      ${snapshot.readiness.expanded.numerator} / ${rows.length} = ${snapshot.readiness.expanded.percent}%`);
console.log(`  originalCore  ${snapshot.readiness.originalCore.numerator} / ${originalCoreDenominator} = ${snapshot.readiness.originalCore.percent}%`);
console.log("  counts        " + JSON.stringify(counts));

if (write) {
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${SNAPSHOT}.`);
} else {
  console.log("\nDry run. Pass --write to apply.");
}
