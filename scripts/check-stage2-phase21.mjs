import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = JSON.parse(read("release/OCADE_STAGE_2_PHASE_21.json"));
const control = read("src/lib/control/control-plane.ts");
const governed = read("src/lib/skills/governed-run.ts");
const tests = read("src/lib/__tests__/control-plane.test.ts");
const failures = [];
let checks = 0;

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function check(condition, label) {
  checks += 1;
  if (!condition) failures.push(label);
}

function includesAll(source, values, label) {
  for (const value of values) check(source.includes(value), `${label}: ${value}`);
}

check(ledger.schemaVersion === 1 && ledger.phase === 21, "ledger schema/phase");
check(ledger.classification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED", "honest classification");
check(ledger.sourceScore === 92 && ledger.runtimeScore === 0, "phase source/runtime scores");
check(ledger.stage2Readiness.source === 32, "Stage 2 source readiness");
check(ledger.stage2Readiness.sourceRemaining === 68, "Stage 2 source remainder");
check(ledger.stage2Readiness.runtime === 0, "Stage 2 runtime must remain zero");
check(ledger.stage2Readiness.verifiedApplicationCoverage === 0, "app coverage must remain zero");
check(ledger.stage2Readiness.production === 16, "Stage 2 production readiness");
check(ledger.implementationPhasesRemaining === 18, "remaining implementation phase count");
check(ledger.externalValidationTracksRemaining === 8, "remaining external validation tracks");
check(ledger.nextDependency.phase === 22, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((value) => value === false),
  "runtime claims must be false",
);
check(ledger.failClosedEvidence.length >= 10, "fail-closed evidence is incomplete");
check(ledger.runtimeBlockers.length >= 4, "runtime blockers are incomplete");

includesAll(
  control,
  [
    "export interface OcadeActionRequest",
    "export interface OcadeBrain",
    "export interface DirectorContext",
    "export class HandsRegistry",
    "export class EyesRegistry",
    "export function verifyObservations",
    "export class InMemoryControlJournal",
    "export async function directBrainProposal",
    "export async function runDirectedAction",
    "export function validateOcadeActionRequest",
    "decodeBrainProposal",
    "validateAgainstSchema",
    "deriveIdempotencyKey",
    "resolveApp",
    "resolveFile",
    "fileIsGranted",
    "requiredResources",
    "createCheckpoint",
    "expectedPostconditions",
    "verificationPlan",
    "rollbackPlan",
    "retryBudget",
    "timeoutMs",
    "Protected actions cannot be authorized",
    "Concurrent duplicate action was refused",
    "observerId !== execution.executorId",
    "The action completed, but its idempotency receipt was not durable",
  ],
  "control-plane contract",
);

includesAll(
  governed,
  [
    "../control/control-plane",
    "governedActionContract",
    "validateOcadeActionRequest(actionContract)",
    "The canonical action contract refused this step",
  ],
  "production integration",
);

includesAll(
  tests,
  [
    "strict Brain and Director boundary",
    "Hands, Eyes, Verifier and journal boundary",
    "unknown_tool",
    "identity_unresolved",
    "unauthorized",
    "resource_unavailable",
    "unverifiable",
    "recovery_missing",
    "checkpoint_failed",
    "replays a verified idempotency receipt",
    "does not allow executor-authored observations",
    "enforces the deadline",
  ],
  "regression evidence",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 21 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 21 gate: ${checks}/${checks} checks passed`);
console.log("PHASE 21: SOURCE 92% | RUNTIME 0% | STAGE 2 SOURCE 32% | PRODUCTION 16%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 22 MULTI-PROVIDER LOCAL MODEL FABRIC");
