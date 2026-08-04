import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_28.json");
const manifest = json("extension/manifest.json");
const background = read("extension/background.js");
const protocol = read("src/lib/native/extension-protocol.ts");
const bridge = read("src/lib/native/extension-bridge.ts");
const policy = read("src/lib/native/browser-bridge.ts");
const runtimeTests = read("src/lib/__tests__/extension-runtime-real.test.ts");
const packageTests = read("src/lib/__tests__/extension-package.test.ts");
const settings = read("src/routes/_authenticated/settings.browser.tsx");
const readme = read("extension/README.md");
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

check(ledger.schemaVersion === 1 && ledger.phase === 28, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 96, "source score");
check(ledger.controlledExtensionRuntimeScore === 94, "controlled runtime score");
check(ledger.liveChromeRuntimeScore === 0, "live Chrome zero");
check(ledger.liveEdgeRuntimeScore === 0, "live Edge zero");
check(ledger.verifiedApplicationCoverage === 0, "verified apps zero");
check(ledger.stage2Readiness.source === 60, "Stage 2 source");
check(ledger.stage2Readiness.sourceRemaining === 40, "Stage 2 source remaining");
check(ledger.stage2Readiness.browserRuntime === 0, "browser runtime");
check(ledger.stage2Readiness.production === 26, "production");
check(ledger.implementationPhasesRemaining === 11, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external tracks");
check(ledger.nextDependency.phase === 29, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 25, "source evidence");
check(ledger.controlledEvidence.length >= 22, "controlled evidence");
check(ledger.runtimeBlockers.length >= 5, "runtime blockers");

check(manifest.manifest_version === 3, "Manifest V3");
check(
  Array.isArray(manifest.host_permissions) && manifest.host_permissions.length === 0,
  "no hosts",
);
check(manifest.incognito === "not_allowed", "incognito refusal");
check(manifest.optional_permissions.includes("downloads"), "optional downloads");
check(manifest.optional_host_permissions.length === 2, "optional origins");
check(manifest.background.type === "module", "module worker");

includesAll(
  background,
  [
    '"connect"',
    '"tabs.list"',
    '"tab.activate"',
    '"tab.create"',
    '"page.summary"',
    '"page.a11y"',
    '"page.screenshot"',
    '"page.navigate"',
    '"page.wait"',
    '"page.verify"',
    '"form.fill"',
    '"form.submit"',
    '"file.upload"',
    '"file.drop"',
    '"file.download"',
    '"run.progress"',
    '"run.cancel"',
    '"emergency.stop"',
    "chrome.runtime.getManifest",
    "chrome.runtime.id",
    "ensureOriginPermission",
    "ensureDownloadsPermission",
    "collectDom",
    "collectA11y",
    "openShadowRoots",
    "sameOrigin",
    "fillApprovedFields",
    "dropApprovedFile",
    "waitForPage",
    "maskProtected",
    "unmaskProtected",
    "runStates",
    "cancelledRuns",
    "pairingExpiresAt",
    "sender?.tab?.incognito",
  ],
  "actual extension runtime",
);

includesAll(
  protocol,
  [
    "ExtensionIdentity",
    "AccessibilitySnapshot",
    "summariseAccessibility",
    "summarisePage",
    "screenshotRedaction",
    "validateRequest",
    "file.drop",
    "run.progress",
  ],
  "closed protocol",
);

includesAll(
  bridge,
  [
    "ExtensionBrowserBridge",
    "data.identity.runtimeId !== this.opts.extensionId",
    "summariseAccessibility",
    "wrapUntrustedContent",
    "authenticationFailure",
    "file.drop",
    "run.progress",
    "page.verify",
  ],
  "application bridge",
);

includesAll(
  policy,
  [
    "DEFAULT_SITE_POLICY",
    "allowOrigins",
    "denyOrigins",
    "readOrigins",
    "fillOrigins",
    "allowPrivate: false",
    "isProtectedField",
    "runBrowserAction",
    "BrowserActionReceipt",
    "getBrowserRunProgress",
    "cancelBrowserRun",
    "emergencyStopBrowserControl",
  ],
  "browser policy and receipts",
);

includesAll(
  runtimeTests,
  [
    "actual MV3 service worker in the controlled web lab",
    "runInContext(BACKGROUND_SOURCE",
    "pairs with verified identity and requests only the active origin",
    "executes the real accessibility collector and never returns field values",
    "heals a stale selector, submits, and independently verifies both receipts",
    "refuses duplicate semantic controls and ignores a hidden duplicate",
    "masks protected controls during capture and restores the live page afterward",
    "hands approved bytes to the real upload adapter and drives the real download API",
    "creates a permitted tab, waits for a dynamic target, and performs an approved drop",
    "isolates malicious page instructions and refuses protected form data before injection",
    "enforces origin denial, cancellation, emergency stop, and suspend re-pairing",
    "crossOriginFrame",
    "shadowHost",
  ],
  "actual worker web-lab regressions",
);

includesAll(
  packageTests,
  ["loadable MV3 source package", "no blanket host grant", "actual service worker"],
  "extension package tests",
);

includesAll(
  settings,
  [
    "Browser extension paired",
    "bridgeIdentity.runtimeId",
    "Each website still requires its own",
    "Browser control isn't connected",
  ],
  "production settings integration",
);

includesAll(
  readme,
  [
    "real source-runtime",
    "not a claim that Chrome or Edge was loaded",
    "Real-browser verification",
    "Store listing + signing",
  ],
  "honest extension documentation",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 28 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 28 gate: ${checks}/${checks} checks passed`);
console.log(
  "PHASE 28: SOURCE 96% | CONTROLLED EXTENSION RUNTIME 94% | LIVE CHROME 0% | LIVE EDGE 0%",
);
console.log("STAGE 2: SOURCE 60% | WINDOWS 2% | BROWSER 0% | PRODUCTION 26% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 29 EMAIL AND WEB WORK");
