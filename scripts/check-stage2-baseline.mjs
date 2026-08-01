import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * Stage 2 baseline gate.
 *
 * This gate has two kinds of check, and conflating them made it unrunnable
 * anywhere but one laptop:
 *
 *   REPOSITORY-INTRINSIC - the baseline's own schema, phase scoring, arithmetic
 *   and evidence paths. All of it is tracked, so it verifies in any checkout and
 *   in CI, and a failure here is a real defect.
 *
 *   MACHINE-LOCAL PROVENANCE - that the three source specifications still hash
 *   to their recorded values. It reads `.claude/OCADE_STAGE_2_SPEC_HASHES.json`,
 *   which is gitignored (.gitignore:63) and therefore absent from every fresh
 *   checkout, and that file pins ABSOLUTE paths under one user's home
 *   directory. The same applies to the Phase 19 checkpoint under
 *   `.claude/checkpoints/`.
 *
 * Previously the provenance snapshot was read unconditionally at module load,
 * so on any machine but the original the gate died with an unhandled ENOENT
 * before running a single check - not a clean failure, a crash. It was excluded
 * from ci.yml by comment for exactly that reason, which left the intrinsic
 * checks unverified by CI as collateral damage.
 *
 * Now the intrinsic checks always run, and the provenance checks are SKIPPED
 * and reported by name when their snapshot is absent. Skipped is printed as
 * skipped and never counted as passed: absence of a check is not a passing
 * check. When the snapshot IS present, every provenance check runs and can
 * still fail the gate.
 */

const root = process.cwd();
const baseline = json("release/OCADE_STAGE_2_BASELINE.json");
const failures = [];
const skipped = [];
let checks = 0;

function check(condition, label) {
  checks += 1;
  if (!condition) failures.push(label);
}

function skip(label, why) {
  skipped.push(`${label} (${why})`);
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function json(path) {
  return JSON.parse(read(path));
}

function optionalJson(path) {
  return existsSync(resolve(root, path)) ? json(path) : null;
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const SPEC_SNAPSHOT = ".claude/OCADE_STAGE_2_SPEC_HASHES.json";
const persisted = optionalJson(SPEC_SNAPSHOT);
const NO_SNAPSHOT = `${SPEC_SNAPSHOT} is absent; it is gitignored and machine-local`;

check(baseline.schemaVersion === 1 && baseline.phase === 20, "baseline schema/phase");
check(baseline.olderSpecificationCompleteThroughPhase === 19, "older audit is not sealed");

if (persisted) {
  check(baseline.branch === persisted.branch, "baseline branch differs from persisted snapshot");
  check(baseline.head === persisted.head, "baseline HEAD differs from persisted snapshot");
} else {
  skip("baseline branch/HEAD match the persisted snapshot", NO_SNAPSHOT);
}

for (const [key, persistedKey] of [
  ["older", "olderSpecification"],
  ["stage2", "stage2Specification"],
  ["goal", "goalObjective"],
]) {
  const record = persisted?.[persistedKey];
  if (!record) {
    skip(`${key} specification provenance`, NO_SNAPSHOT);
    continue;
  }
  const present = typeof record.path === "string" && existsSync(record.path);
  check(present, `${key} source is missing`);
  check(
    baseline.specificationHashes[key] === record.sha256,
    `${key} hash differs from persisted value`,
  );
  // Only hash it if it is actually there; otherwise the missing-source failure
  // above is the honest report and this would just crash on top of it.
  if (present) check(hash(record.path) === record.sha256, `${key} source hash changed on disk`);
}

check(baseline.phaseScores.length === 19, "Stage 2 must score Phases 21-39 exactly once");
const seen = new Set();
let total = 0;
for (const entry of baseline.phaseScores) {
  check(
    Number.isInteger(entry.phase) && entry.phase >= 21 && entry.phase <= 39,
    `invalid phase number: ${entry.phase}`,
  );
  check(!seen.has(entry.phase), `duplicate phase score: ${entry.phase}`);
  seen.add(entry.phase);
  check(
    Number.isInteger(entry.score) && entry.score >= 0 && entry.score <= 100,
    `invalid phase score: ${entry.phase}`,
  );
  check(
    [
      "VERIFIED WORKING",
      "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
      "PARTIAL",
      "UI-ONLY",
      "SCAFFOLD-ONLY",
      "READY TO APPLY",
      "EXTERNALLY BLOCKED",
      "MISSING",
      "BROKEN",
      "UNVERIFIED",
    ].includes(entry.classification),
    `invalid classification: ${entry.phase}`,
  );
  check(entry.gap.length >= 40, `phase gap is not exact enough: ${entry.phase}`);
  for (const path of entry.evidence) {
    check(existsSync(resolve(root, path)), `baseline evidence is missing: ${path}`);
  }
  total += entry.score;
}
for (let phase = 21; phase <= 39; phase++) {
  check(seen.has(phase), `phase is not scored: ${phase}`);
}

const source = Math.round(total / baseline.phaseScores.length);
check(source === 30, "Stage 2 source baseline calculation changed");
check(baseline.readiness.stage2Source === source, "published Stage 2 source is stale");
check(
  baseline.readiness.stage2SourceRemaining === 100 - source,
  "published Stage 2 source remainder is stale",
);

for (const field of [
  "stage2WindowsRuntime",
  "stage2BrowserRuntime",
  "stage2AnyAppRuntime",
  "stage2MobileRuntime",
  "stage2ApplicationCoverage",
  "stage2Runtime",
]) {
  check(baseline.readiness[field] === 0, `${field} must remain zero without real runtime evidence`);
}

const production = Math.round(
  baseline.readiness.stage2Source * 0.5 +
    baseline.readiness.stage2WindowsRuntime * 0.15 +
    baseline.readiness.stage2BrowserRuntime * 0.1 +
    baseline.readiness.stage2AnyAppRuntime * 0.1 +
    baseline.readiness.stage2MobileRuntime * 0.05 +
    baseline.readiness.stage2ApplicationCoverage * 0.05 +
    baseline.externallyValidatedPackaging * 0.05,
);
check(production === 15, "Stage 2 production baseline calculation changed");
check(baseline.readiness.stage2Production === production, "published production baseline is stale");

check(
  baseline.firstIncompleteDependency.phase === 21 &&
    baseline.firstIncompleteDependency.name === "Canonical model-to-tool control plane",
  "first incomplete dependency is not Phase 21",
);
check(baseline.implementationPhasesRemaining === 19, "remaining phase count is stale");
check(baseline.externalValidationTracksRemaining === 8, "external validation track count is stale");

for (const [pathKey, hashKey] of [
  ["trackedPatch", "trackedPatchSha256"],
  ["untrackedManifest", "untrackedManifestSha256"],
]) {
  const path = baseline.phase19Checkpoint[pathKey];
  // These live under .claude/checkpoints/, gitignored for the same reason as
  // the specification snapshot: they are a point-in-time record of one working
  // tree, not repository content.
  if (!existsSync(resolve(root, path))) {
    skip(`Phase 19 checkpoint integrity: ${path}`, "checkpoint is gitignored and machine-local");
    continue;
  }
  check(
    hash(resolve(root, path)) === baseline.phase19Checkpoint[hashKey],
    `Phase 19 checkpoint hash changed: ${path}`,
  );
}

if (failures.length > 0) {
  console.error(`OCADE Stage 2 baseline gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  if (skipped.length > 0) {
    console.error(`Additionally SKIPPED (not verified, not passed): ${skipped.length}`);
    for (const item of skipped) console.error(`- ${item}`);
  }
  process.exit(1);
}

if (skipped.length > 0) {
  // Never let a partial run read as a full one.
  console.log(
    `OCADE Stage 2 baseline gate: ${checks}/${checks} executable checks passed, ${skipped.length} SKIPPED`,
  );
  for (const item of skipped) console.log(`- SKIPPED: ${item}`);
  console.log(
    "Skipped checks are UNVERIFIED, not passed. Run this on the machine holding the snapshot to close them.",
  );
} else {
  console.log(`OCADE Stage 2 baseline gate: ${checks}/${checks} checks passed`);
}
console.log(
  `BASELINE: SOURCE ${source}% | RUNTIME 0% | APP COVERAGE 0% | PRODUCTION ${production}%`,
);
console.log("FIRST INCOMPLETE DEPENDENCY: PHASE 21 CANONICAL MODEL-TO-TOOL CONTROL PLANE");
