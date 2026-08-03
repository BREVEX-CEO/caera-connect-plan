import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_29.json");
const workflow = read("src/lib/control/email-web-work.ts");
const tests = read("src/lib/__tests__/email-web-work.test.ts");
const browser = read("src/lib/native/browser-bridge.ts");
const routes = read("src/lib/control/route-selector.ts");
const connectors = read("src/components/settings/ConnectorsPanel.tsx");
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

check(ledger.schemaVersion === 1 && ledger.phase === 29, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 96, "source score");
check(ledger.controlledWorkflowRuntimeScore === 92, "controlled runtime score");
check(ledger.liveEmailConnectorScore === 0, "live connector zero");
check(ledger.liveAuthenticatedWebsiteScore === 0, "live website zero");
check(ledger.stage2Readiness.source === 64, "Stage 2 source");
check(ledger.stage2Readiness.sourceRemaining === 36, "Stage 2 source remaining");
check(ledger.stage2Readiness.browserRuntime === 0, "browser runtime");
check(ledger.stage2Readiness.production === 28, "production");
check(ledger.implementationPhasesRemaining === 10, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external tracks");
check(ledger.nextDependency.phase === 30, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 25, "source evidence");
check(ledger.controlledEvidence.length >= 19, "controlled evidence");
check(ledger.runtimeBlockers.length >= 6, "runtime blockers");

includesAll(
  workflow,
  [
    "EmailConnectorStatus",
    "officialOrApproved",
    "createDraft",
    "sendDraft",
    "verifySent",
    "prepareEmailPreview",
    "verifiedRecipients",
    "validateAttachment",
    "MAX_ATTACHMENT_BYTES",
    "MAX_TOTAL_ATTACHMENT_BYTES",
    "SensitiveContentCategory",
    "previewHash",
    "bindPreviewConfirmation",
    "idempotencyKey",
    "selectUniversalRoute",
    "accountMatches",
    "authenticatedByUser",
    "hasProtectedFields",
    "No fallback was attempted",
    "executeEmailSend",
    "prepareWebWork",
    "executeWebWork",
    "Every web-work step must stay",
    "independent verification expectation",
    "cancelled before submission",
  ],
  "email and web workflow",
);

includesAll(
  tests,
  [
    "email preview and confirmation",
    "connector-first email execution",
    "creates a draft, sends once, and requires a provider receipt verification",
    "never browser-falls back after an ambiguous connector send failure",
    "routes around a connector authenticated as the wrong sender",
    "turns connector exceptions into an honest failure",
    "falls back to an already-authenticated paired browser",
    "refuses browser authentication and protected submissions",
    "refuses a stale confirmation and an attachment mutated after preview",
    "authenticated web editing, uploads and downloads",
    "refuses protected fields, cross-origin steps and unverified mutations",
    "executes a confirmed edit, upload and download",
    "stops on an unverified browser mutation",
  ],
  "controlled end-to-end regressions",
);

includesAll(
  browser,
  [
    "DEFAULT_SITE_POLICY",
    "isProtectedField",
    "BrowserFileHandoff",
    "runBrowserAction",
    "completed_unverified",
  ],
  "browser dependency",
);
includesAll(
  routes,
  ["UNIVERSAL_ROUTE_ORDER", '"api"', '"plugin"', '"dom"', "selectUniversalRoute"],
  "route hierarchy dependency",
);
includesAll(
  connectors,
  [
    "getEmailConnectorStatus",
    "Email and authenticated web work",
    "No email API is connected",
    "does not bundle an OAuth provider",
  ],
  "production connector status",
);
includesAll(
  packs,
  [
    "EMAIL_WEB_WORK_PACK",
    "email.preview",
    "email.send",
    "web.edit",
    "web.transfer",
    "No live OAuth provider is bundled",
  ],
  "skill pack integration",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 29 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 29 gate: ${checks}/${checks} checks passed`);
console.log(
  "PHASE 29: SOURCE 96% | CONTROLLED WORKFLOW RUNTIME 92% | LIVE CONNECTOR 0% | LIVE WEBSITE 0%",
);
console.log("STAGE 2: SOURCE 64% | WINDOWS 2% | BROWSER 0% | PRODUCTION 28% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 30 CREATIVE APPLICATION CONTROL");
