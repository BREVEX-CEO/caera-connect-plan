import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_24.json");
const safety = read("native/companion/safety/src/lib.rs");
const main = read("native/companion/tauri/src/main.rs");
const platform = read("native/companion/tauri/src/platform.rs");
const bridge = read("src/lib/native/companion-bridge.ts");
const client = read("src/lib/native/tauri-companion.ts");
const settings = read("src/components/settings/ComputerUsePanel.tsx");
const tests = read("src/lib/native/__tests__/tauri-companion.test.ts");
const sourceTests = read("src/lib/__tests__/desktop-companion-source.test.ts");
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

check(ledger.schemaVersion === 1 && ledger.phase === 24, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "classification");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.validationStatus.includes("FULL 2377/2377"), "validation status");
check(ledger.sourceScore === 94, "source score");
check(ledger.controlledWindowsPrimitiveRuntimeScore === 22, "primitive runtime score");
check(ledger.signedCompanionRuntimeScore === 0, "signed runtime remains zero");
check(ledger.verifiedApplicationCoverage === 0, "verified application coverage remains zero");
check(ledger.stage2Readiness.source === 44, "Stage 2 source");
check(ledger.stage2Readiness.runtime === 2, "Stage 2 runtime");
check(ledger.stage2Readiness.production === 21, "Stage 2 production");
check(ledger.implementationPhasesRemaining === 15, "remaining implementation phases");
check(ledger.externalValidationTracksRemaining === 8, "external validation tracks");
check(ledger.nextDependency.phase === 25, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 15, "source capability evidence");
check(ledger.runtimeBlockers.length >= 5, "runtime blocker evidence");

includesAll(
  safety,
  [
    "AccessibilityRead",
    "ActionRisk::ReadOnly",
    "is_protected_text",
    "path_is_allowed",
    "app_is_allowed",
  ],
  "safety core",
);

includesAll(
  platform,
  [
    "pub struct PermissionStatus",
    "fn permission_statuses()",
    '"interactive_desktop"',
    '"accessibility"',
    '"screen_capture"',
    '"input_control"',
    "fn windows_interactive()",
    "pub fn application_inventory(",
    "UIAutomationClient",
    "[protected control]",
    "[protected window]",
    "ACTION_TIMEOUT",
    "child.kill()",
    "sha256_hex(&bytes)",
  ],
  "platform backend",
);

includesAll(
  main,
  [
    "permissions: backend.permissions",
    "install_guidance: backend.install_guidance",
    "fn application_inventory(",
    '"application_inventory"',
    "verify_signed(",
    "operation-journal-v1.jsonl",
    "allowlist-v1.json",
    "emergency_stop",
    "reset_emergency_stop",
  ],
  "signed host",
);

includesAll(
  bridge,
  [
    '"accessibility.read"',
    "CompanionPermissionStatus",
    "CompanionApplication",
    "applications?()",
    'kind: "accessibility"',
  ],
  "browser contract",
);

includesAll(
  client,
  [
    "parsePermissions",
    "async applications()",
    'this.session.sign("application_inventory", {})',
    'output.kind === "accessibility"',
    "isProtectedText",
  ],
  "Tauri client",
);

includesAll(
  settings,
  [
    "Companion permissions",
    "Setup needed",
    "Detected applications",
    "adapter.applications",
    "No app-specific permission is inferred",
  ],
  "settings integration",
);

includesAll(
  `${tests}\n${sourceTests}`,
  [
    "signs authenticated application inventory",
    "normalises permission and setup evidence",
    "accepts only bounded accessibility nodes",
    "reports permission setup honestly",
  ],
  "regression evidence",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 24 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 24 gate: ${checks}/${checks} checks passed`);
console.log("PHASE 24: SOURCE 94% | WINDOWS PRIMITIVES 22% | SIGNED COMPANION 0%");
console.log("STAGE 2: SOURCE 44% | RUNTIME 2% | PRODUCTION 21% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 25 PERCEPTION SET-OF-MARK AND STATE FINGERPRINTS");
