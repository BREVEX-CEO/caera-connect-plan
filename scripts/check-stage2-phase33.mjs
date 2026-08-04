import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_33.json");
const runtime = read("src/lib/mobile/mission-control.ts");
const tests = read("src/lib/__tests__/mobile-mission-control.test.ts");
const ui = read("mobile/www/index.html");
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

check(ledger.schemaVersion === 1 && ledger.phase === 33, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 97, "source score");
check(ledger.controlledWorkflowRuntimeScore === 95, "controlled runtime score");
check(ledger.liveAuthenticatedHardwareProbeScore === 0, "live hardware zero");
check(ledger.stage2Readiness.source === 79, "Stage 2 source");
check(ledger.stage2Readiness.sourceRemaining === 21, "Stage 2 source remaining");
check(ledger.stage2Readiness.production === 35, "production");
check(ledger.implementationPhasesRemaining === 6, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external tracks");
check(ledger.nextDependency.phase === 34, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 40, "source evidence");
check(ledger.controlledEvidence.length >= 20, "controlled evidence");
check(ledger.runtimeBlockers.length >= 8, "runtime blockers");

includesAll(
  runtime,
  [
    "MOBILE_MISSION_RUNTIME_BOUNDARY",
    "pc_task_only",
    "capabilities",
    "taskIds",
    "applicationIds",
    "fileIds",
    "signMobileMissionCommand",
    "verifyMobileMissionCommand",
    "executeMobileMissionCommand",
    "sanitizeMobileMissionSnapshot",
    "never automates the phone screen",
    "canonicalMobileMissionCommand",
  ],
  "runtime contract",
);

includesAll(
  tests,
  [
    "canonicalizes scope order deterministically",
    "signs and verifies a short-lived command bound to device, session and key",
    "rejects tampering after signature",
    "rejects revoked, wrong-device and expired sessions",
    "refuses capabilities, tasks and outputs outside the exact scope",
    "refuses protected or unbounded remote instructions",
    "never turns refusal, missing evidence or a wrong command ID into success",
    "cancels before host execution",
    "keeps disabled previews absent and validates outputs and receipts",
    "refuses a screenshot unless preview is enabled and independently redacted",
    "refuses protected approval summaries and malformed output hashes",
    "has no arbitrary PC or phone-screen automation command",
  ],
  "deterministic tests",
);

includesAll(
  ui,
  [
    "OCADE Companion",
    "Pair this device",
    "Current PC task",
    "Send a new PC task",
    "Add or correct an instruction",
    "Approvals",
    "Outputs and receipts",
    "Emergency stop",
    "Revoke mobile session",
    "What this app can do",
    "never to take arbitrary control",
    "Take arbitrary control of your PC",
  ],
  "honest companion UI",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 33 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 33 gate: ${checks}/${checks} checks passed`);
console.log(
  "PHASE 33: SOURCE 97% | CONTROLLED WORKFLOW RUNTIME 95% | LIVE AUTHENTICATED HARDWARE PROBE 0%",
);
console.log("STAGE 2: SOURCE 79% | WINDOWS 2% | BROWSER 0% | PRODUCTION 35% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 34 AUTHENTICATED RELAY");
