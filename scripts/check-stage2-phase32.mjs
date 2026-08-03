import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_32.json");
const runtime = read("src/lib/skills/resource-governor-runtime.ts");
const tests = read("src/lib/__tests__/resource-governor-runtime.test.ts");
const panel = read("src/components/ocade/ResourceGovernorPanel.tsx");
const studio = read("src/routes/_authenticated/ocade.studio.tsx");
const failures = [];
let checks = 0;

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function json(path) {
  return JSON.parse(read(path));
}

function check(condition, label) {
  checks += 1;
  if (!condition) failures.push(label);
}

function includesAll(source, values, label) {
  for (const value of values) check(source.includes(value), `${label}: ${value}`);
}

check(ledger.schemaVersion === 1 && ledger.phase === 32, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 96, "source score");
check(ledger.controlledWorkflowRuntimeScore === 94, "controlled runtime score");
check(ledger.liveAuthenticatedHardwareProbeScore === 0, "live hardware zero");
check(ledger.stage2Readiness.source === 76, "Stage 2 source");
check(ledger.stage2Readiness.sourceRemaining === 24, "Stage 2 source remaining");
check(ledger.stage2Readiness.production === 34, "production");
check(ledger.implementationPhasesRemaining === 7, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external tracks");
check(ledger.nextDependency.phase === 33, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 35, "source evidence");
check(ledger.controlledEvidence.length >= 15, "controlled evidence");
check(ledger.runtimeBlockers.length >= 7, "runtime blockers");

includesAll(
  runtime,
  [
    "synthetic_profile",
    "host_probe",
    "physicalCores",
    "logicalCores",
    "availableBytes",
    "vramBytes",
    "availableBackends",
    "batteryPercent",
    "thermal",
    "currentLoad",
    "installedTools",
    "memoryBytesPerUnit",
    "storageBytesPerUnit",
    "millisecondsPerUnit",
    "estimate, not a measurement",
    "model",
    "renderer",
    "solver",
    "changesEngineeringAccuracy",
    "classifyHardware",
    "candidateFits",
    "maxParallelism",
    "checkpointEveryMs",
    "warningThresholds",
    "cooperative_then_force_stop",
    "applyReversiblePerformanceProfile",
    "Original settings",
    "restoreSettings",
    "ResourceConcurrencyController",
    "already active",
    "Concurrency limit",
    "emergencyStop",
    "SYNTHETIC_RESOURCE_PROFILES",
    "RESOURCE_GOVERNOR_RUNTIME_BOUNDARY",
  ],
  "runtime contract",
);

includesAll(
  tests,
  [
    "hardware discovery and bounded estimates",
    "repeatable weak, medium and strong selection",
    "reversible profiles",
    "bounded concurrency and cancellation",
    "uses the smaller local model",
    "selects the balanced renderer",
    "selects the full solver",
    "never chooses a solver candidate that changes engineering accuracy",
    "defers hot or low-battery hosts",
    "refuses rather than inventing",
    "authenticated host-probe evidence",
    "records originals",
    "rolls back immediately",
    "rejects duplicate and over-limit",
    "honours AbortSignal and emergency stop",
  ],
  "deterministic tests",
);

includesAll(
  panel,
  [
    "Resource Governor",
    "weak",
    "medium",
    "strong",
    "authenticated hardware snapshot",
    "Firmware, overclocking, drivers, global GPU settings",
    "RESOURCE_GOVERNOR_RUNTIME_BOUNDARY",
  ],
  "honest Studio panel",
);
check(studio.includes("ResourceGovernorPanel"), "Studio production integration");

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 32 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 32 gate: ${checks}/${checks} checks passed`);
console.log(
  "PHASE 32: SOURCE 96% | CONTROLLED WORKFLOW RUNTIME 94% | LIVE AUTHENTICATED HARDWARE PROBE 0%",
);
console.log("STAGE 2: SOURCE 76% | WINDOWS 2% | BROWSER 0% | PRODUCTION 34% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 33 MOBILE COMPANION");
