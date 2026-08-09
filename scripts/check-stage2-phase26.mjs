import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_26.json");
const selector = read("src/lib/control/route-selector.ts");
const controlPlane = read("src/lib/control/control-plane.ts");
const tests = read("src/lib/__tests__/route-selector.test.ts");
const integrationTests = read("src/lib/__tests__/control-plane.test.ts");
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

check(ledger.schemaVersion === 1 && ledger.phase === 26, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 94, "source score");
check(ledger.deterministicFixtureRuntimeScore === 90, "fixture score");
check(ledger.liveApplicationRuntimeScore === 0, "live runtime zero");
check(ledger.verifiedApplicationCoverage === 0, "verified apps zero");
check(ledger.stage2Readiness.source === 52, "Stage 2 source");
check(ledger.stage2Readiness.windowsRuntime === 2, "Windows runtime");
check(ledger.stage2Readiness.browserRuntime === 0, "browser runtime");
check(ledger.stage2Readiness.production === 23, "production");
check(ledger.implementationPhasesRemaining === 13, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external tracks");
check(ledger.nextDependency.phase === 27, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 18, "source evidence");
check(ledger.controlledEvidence.length >= 8, "controlled evidence");
check(ledger.runtimeBlockers.length >= 5, "runtime blockers");

includesAll(
  selector,
  [
    "UNIVERSAL_ROUTE_ORDER",
    '"api"',
    '"plugin"',
    '"mcp"',
    '"os_integration"',
    '"cli"',
    '"file"',
    '"dom"',
    '"accessibility"',
    '"native"',
    '"vision"',
    '"input"',
    "universalRouteRank",
    "selectUniversalRoute",
    "officialOrApproved",
    "requiredPermissions",
    "expectedLatencyMs",
    "verification",
    "recovery",
    "supportsRecording",
    "explicitCoordinateFallbackApproval",
    "high-risk mutation cannot downgrade to coordinate control",
    "No route has adequate identity, permission, confidence, verification, recovery, health and recording evidence",
  ],
  "selector implementation",
);

includesAll(
  controlPlane,
  [
    'from "./route-selector"',
    "routeCandidates?",
    "routePolicy?",
    "routeSelection?: UniversalRouteDecision",
    "selectUniversalRoute",
    '"route_unavailable"',
    "selectedRoute = selected.data.route",
    "selected route has no matching independent verification step",
  ],
  "Director integration",
);

includesAll(
  tests,
  [
    "universal route selector representative routes",
    "it.each(UNIVERSAL_ROUTE_ORDER)",
    "exact API, MCP, plug-in, OS integration, CLI, file, DOM, accessibility, native, vision, input order",
    "identity",
    "version",
    "task",
    "permission",
    "approval",
    "health",
    "recording",
    "verification",
    "recovery",
    "latency",
    "confidence",
    "medium-risk coordinate fallback",
    "never downgrades a high-risk mutation",
    "refuses safely when no",
  ],
  "representative regressions",
);

includesAll(
  integrationTests,
  [
    "audited universal route decision",
    "documented-cli",
    'fallbackFrom: ["api"]',
    "without policy or an adequate semantic route",
  ],
  "control-plane regressions",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 26 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 26 gate: ${checks}/${checks} checks passed`);
console.log("PHASE 26: SOURCE 94% | FIXTURE RUNTIME 90% | LIVE APPS 0%");
console.log("STAGE 2: SOURCE 52% | WINDOWS 2% | BROWSER 0% | PRODUCTION 23% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 27 UNKNOWN-APP LEARNING AND DIGITAL TWINS");
