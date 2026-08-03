import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_25.json");
const perception = read("src/lib/control/perception.ts");
const computerUsePanel = read("src/components/settings/ComputerUsePanel.tsx");
const tests = read("src/lib/__tests__/perception.test.ts");
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

check(ledger.schemaVersion === 1 && ledger.phase === 25, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 92, "source score");
check(ledger.deterministicFixtureRuntimeScore === 85, "fixture runtime score");
check(ledger.liveDesktopRuntimeScore === 0, "live desktop runtime remains zero");
check(ledger.verifiedApplicationCoverage === 0, "verified apps remain zero");
check(ledger.stage2Readiness.source === 48, "Stage 2 source");
check(ledger.stage2Readiness.windowsRuntime === 2, "Windows runtime");
check(ledger.stage2Readiness.browserRuntime === 0, "browser runtime");
check(ledger.stage2Readiness.production === 22, "Stage 2 production");
check(ledger.implementationPhasesRemaining === 14, "remaining implementation phases");
check(ledger.externalValidationTracksRemaining === 8, "external validation tracks");
check(ledger.nextDependency.phase === 26, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 16, "source evidence");
check(ledger.controlledEvidence.length >= 6, "controlled evidence");
check(ledger.runtimeBlockers.length >= 5, "runtime blockers");

includesAll(
  perception,
  [
    'export type PerceptionSource = "accessibility" | "ocr" | "icon" | "vision"',
    "export interface PerceptionFrame",
    "export interface SetOfMarkPlan",
    "deriveScreenStateFingerprint",
    "fusePerceptionFrame",
    "renderSetOfMarkOverlay",
    "resolveSetOfMarkTarget",
    "executeMarkedTarget",
    "perceptionRuntimeReadiness",
    "protectedRegions",
    "window_logical",
    "display_logical",
    "screen-v1:",
    "The current screen observation is stale",
    "The executor acknowledgement is never treated as verification",
  ],
  "perception implementation",
);

includesAll(
  computerUsePanel,
  [
    'from "@/lib/control/perception"',
    "perceptionRuntimeReadiness",
    "Live perception setup required",
    "Live UIA/OCR/icon/vision control remains blocked",
  ],
  "production integration",
);

includesAll(
  tests,
  [
    "fused UIA/OCR/icon/vision perception",
    "redacts protected controls",
    "complete screen-state fingerprints",
    "stale-state rejection and multi-monitor scaling",
    '"moving",',
    '"resizing",',
    '"scaling",',
    "post-action independent re-observation",
    "never executes against stale state",
  ],
  "controlled regressions",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 25 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 25 gate: ${checks}/${checks} checks passed`);
console.log("PHASE 25: SOURCE 92% | FIXTURE RUNTIME 85% | LIVE DESKTOP 0%");
console.log("STAGE 2: SOURCE 48% | WINDOWS 2% | BROWSER 0% | PRODUCTION 22% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 26 UNIVERSAL ROUTE SELECTOR");
