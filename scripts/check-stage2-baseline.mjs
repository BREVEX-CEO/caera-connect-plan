import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const baseline = json("release/OCADE_STAGE_2_BASELINE.json");
const persisted = json(".claude/OCADE_STAGE_2_SPEC_HASHES.json");
const failures = [];
let checks = 0;

function check(condition, label) {
  checks += 1;
  if (!condition) failures.push(label);
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function json(path) {
  return JSON.parse(read(path));
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

check(baseline.schemaVersion === 1 && baseline.phase === 20, "baseline schema/phase");
check(baseline.branch === persisted.branch, "baseline branch differs from persisted snapshot");
check(baseline.head === persisted.head, "baseline HEAD differs from persisted snapshot");
check(baseline.olderSpecificationCompleteThroughPhase === 19, "older audit is not sealed");

for (const [key, persistedKey] of [
  ["older", "olderSpecification"],
  ["stage2", "stage2Specification"],
  ["goal", "goalObjective"],
]) {
  const record = persisted[persistedKey];
  check(typeof record?.path === "string" && existsSync(record.path), `${key} source is missing`);
  check(
    baseline.specificationHashes[key] === record.sha256,
    `${key} hash differs from persisted value`,
  );
  check(hash(record.path) === record.sha256, `${key} source hash changed on disk`);
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
  check(existsSync(resolve(root, path)), `Phase 19 checkpoint is missing: ${path}`);
  check(
    hash(resolve(root, path)) === baseline.phase19Checkpoint[hashKey],
    `Phase 19 checkpoint hash changed: ${path}`,
  );
}

if (failures.length > 0) {
  console.error(`OCADE Stage 2 baseline gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 baseline gate: ${checks}/${checks} checks passed`);
console.log(
  `BASELINE: SOURCE ${source}% | RUNTIME 0% | APP COVERAGE 0% | PRODUCTION ${production}%`,
);
console.log("FIRST INCOMPLETE DEPENDENCY: PHASE 21 CANONICAL MODEL-TO-TOOL CONTROL PLANE");
