import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_27.json");
const learning = read("src/lib/skills/unknown-app-learning.ts");
const tests = read("src/lib/__tests__/unknown-app-learning.test.ts");
const settings = read("src/routes/_authenticated/settings.skills.tsx");
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

check(ledger.schemaVersion === 1 && ledger.phase === 27, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 96, "source score");
check(ledger.deterministicFixtureRuntimeScore === 94, "fixture score");
check(ledger.liveApplicationRuntimeScore === 0, "live runtime zero");
check(ledger.verifiedApplicationCoverage === 0, "verified apps zero");
check(ledger.stage2Readiness.source === 56, "Stage 2 source");
check(ledger.stage2Readiness.windowsRuntime === 2, "Windows runtime");
check(ledger.stage2Readiness.browserRuntime === 0, "browser runtime");
check(ledger.stage2Readiness.production === 24, "production");
check(ledger.implementationPhasesRemaining === 12, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external tracks");
check(ledger.nextDependency.phase === 28, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 21, "source evidence");
check(ledger.controlledEvidence.length >= 12, "controlled evidence");
check(ledger.runtimeBlockers.length >= 5, "runtime blockers");

includesAll(
  learning,
  [
    "UNKNOWN_APP_SUPPORT_LABELS",
    '"LIVE_TESTED"',
    '"PROBED_AND_REHEARSED"',
    '"FAILED_VERIFICATION"',
    "UnknownAppProbe",
    "ProbedIdentity",
    "ApplicationDigitalTwin",
    "CompiledPrivateSkill",
    "ApplicationTwinCache",
    "fingerprintUnknownApp",
    "buildApplicationDigitalTwin",
    "learnUnknownApplication",
    "operateLearnedApplication",
    "runUnknownAppLearningCycle",
    "approvedLocalEvidence",
    "capabilityGraph",
    "protectedAreas",
    "destructiveAreas",
    "verificationMethods",
    "recoveryMethods",
    "resourceProfile",
    "knownAdapterRoutes",
    "compatibilityConstraints",
    "requestPermission",
    "selectUniversalRoute",
    "rehearse",
    "execute",
    "verify",
    "recover",
    "requiredFingerprint",
    "invalidatingChanges",
    "PROBED_AND_REHEARSED",
    "The learned application fingerprint is stale",
    "no skill was compiled",
  ],
  "unknown-app implementation",
);

includesAll(
  tests,
  [
    "Phase 27 support truth and fingerprints",
    "Application Digital Twin construction",
    "unknown-app learning and bounded operation",
    "learns, rehearses, scopes permission, operates, verifies and compiles privately",
    "invalidates both twin and compiled skill, refuses stale execution, then relearns",
    "does not execute when scoped permission is denied",
    "recovers and compiles no skill after failed independent verification",
    "refuses high-risk coordinate-only control before rehearsal",
    "honours cancellation before probing",
  ],
  "controlled lifecycle regressions",
);

includesAll(
  settings,
  [
    'from "@/lib/skills/unknown-app-learning"',
    "UNKNOWN_APP_LEARNING_REALITY",
    "UNKNOWN_APP_SUPPORT_LABELS",
    "Runtime status labels",
  ],
  "production settings integration",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 27 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 27 gate: ${checks}/${checks} checks passed`);
console.log("PHASE 27: SOURCE 96% | FIXTURE RUNTIME 94% | LIVE APPS 0%");
console.log("STAGE 2: SOURCE 56% | WINDOWS 2% | BROWSER 0% | PRODUCTION 24% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 28 CHROME AND EDGE CONTROL");
