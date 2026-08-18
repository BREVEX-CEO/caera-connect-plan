import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_31.json");
const workflow = read("src/lib/engineering/engineering-workflow.ts");
const tests = read("src/lib/__tests__/engineering-workflow.test.ts");
const panel = read("src/components/ocade/EngineeringControlPanel.tsx");
const studio = read("src/routes/_authenticated/ocade.lab.tsx");
const packs = read("src/lib/skills/pack-registry.ts");
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

check(ledger.schemaVersion === 1 && ledger.phase === 31, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 96, "source score");
check(ledger.controlledWorkflowRuntimeScore === 93, "controlled runtime score");
check(ledger.liveEngineeringApplicationScore === 0, "live engineering application zero");
check(ledger.liveSolverScore === 0, "live solver zero");
check(ledger.stage2Readiness.source === 72, "Stage 2 source");
check(ledger.stage2Readiness.sourceRemaining === 28, "Stage 2 source remaining");
check(ledger.stage2Readiness.production === 32, "production");
check(ledger.implementationPhasesRemaining === 8, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external tracks");
check(ledger.nextDependency.phase === 32, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 30, "source evidence");
check(ledger.controlledEvidence.length >= 16, "controlled evidence");
check(ledger.runtimeBlockers.length >= 7, "runtime blockers");

includesAll(
  workflow,
  [
    "CAD_ROUTE_ORDER",
    '"official_api"',
    '"plugin"',
    '"macro"',
    '"script"',
    '"cli"',
    '"project_file"',
    '"accessibility"',
    '"vision_input"',
    "deterministic_fixture",
    "installed_application",
    "signatureVerified",
    "licenceVerified",
    "duplicateProject",
    "verifyWorkingCopy",
    "sourceSha256",
    "compareEngineeringState",
    "unit system changed",
    "approved engineering change",
    "failedConstraints",
    "underconstrainedSketches",
    "invalidReferences",
    "rebuildSucceeded",
    "contentMatchesFormat",
    "ISO-10303-21",
    "$INSUNITS",
    "binaryTriangles",
    "inspectExport",
    "changed during export",
    "inspectSolverResults",
    "normalTermination",
    "result_file",
    "Solver metric",
    "verifyOriginal",
    "discardWorkingCopy",
    "completed_controlled",
    "engineeringConclusionAllowed",
    "not an engineering or installed-application conclusion",
    "ENGINEERING_RUNTIME_BOUNDARY",
  ],
  "engineering workflow",
);

includesAll(
  tests,
  [
    "engineering admission and routing",
    "duplicate-project CAD workflow",
    "solver result boundary",
    "requires a distinct safe working copy and complete solver criteria",
    "prefers API, plug-in, macro, script and CLI",
    "refuses an unsigned, unlicensed or unavailable",
    "completes only as controlled evidence for a fixture",
    "unapproved material, load or tolerance changes",
    "failed constraints, underconstraint, references or rebuild",
    "exact export bytes, structure, reopen or dimensions fail",
    "bounded execution or original preservation is not proven",
    "never turns fixture metrics into engineering truth",
    "termination, result hashes or acceptance metrics are missing",
    "installed-application evidence",
    "cancels before probing",
    "STEP_BYTES",
  ],
  "deterministic fixtures",
);

includesAll(
  panel,
  [
    "CAD and engineering control",
    "Licensed app required",
    "Preferred control routes",
    "Non-negotiable evidence",
    "ENGINEERING_RUNTIME_BOUNDARY",
  ],
  "honest Studio panel",
);
check(studio.includes("EngineeringControlPanel"), "Studio production integration");
includesAll(
  packs,
  [
    "ENGINEERING_CONTROL_PACK",
    "ocade.engineering.control",
    "engineering.duplicate",
    "engineering.model",
    "engineering.export",
    "engineering.solver",
    "cannot claim to drive a licensed CAD/CAE product",
  ],
  "skill pack integration",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 31 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 31 gate: ${checks}/${checks} checks passed`);
console.log(
  "PHASE 31: SOURCE 96% | CONTROLLED WORKFLOW RUNTIME 93% | LIVE ENGINEERING APP 0% | LIVE SOLVER 0%",
);
console.log("STAGE 2: SOURCE 72% | WINDOWS 2% | BROWSER 0% | PRODUCTION 32% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 32 RESOURCE GOVERNOR");
