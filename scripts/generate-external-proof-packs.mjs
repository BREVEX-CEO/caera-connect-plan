/** Generate exact owner handoff packs for every externally blocked ledger row. */
import { readFileSync, writeFileSync } from "node:fs";

const blockersPath = "release/OCADE_RELEASE_BLOCKERS.json";
const snapshotPath = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const outputPath = "release/OCADE_EXTERNAL_PROOF_PACKS.json";
const blockers = JSON.parse(readFileSync(blockersPath, "utf8"));
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

const recipes = {
  "web-cloudflare-runtime": {
    code: ["scripts/deploy.mjs", "wrangler.jsonc", "release/OCADE_PRODUCTION_OPERATIONS.json"],
    buildCommands: ["npm.cmd run build", "npm.cmd run deploy:check"],
    testCommands: ["npm.cmd run operations:check", "npm.cmd run launch-authority:check"],
    expectedResult:
      "Authorized deployment reports the exact version from /api/health and retains a verified rollback version.",
    ownerAction:
      "Authorize the production Cloudflare account/domain and provide its deployment secrets through platform secret storage.",
  },
  "supabase-apply-and-rls": {
    code: [
      "supabase/APPLY_ORDER.md",
      "supabase/migrations",
      "supabase/verification",
      "supabase/rollback",
    ],
    buildCommands: ["npm.cmd run supabase:types-check", "npm.cmd run integration:source-check"],
    testCommands: [
      "npm.cmd exec vitest run src/lib/__tests__/db-twin.test.ts",
      "npm.cmd run test:mutation",
    ],
    expectedResult:
      "All ordered migrations apply and two ordinary authenticated tenants fail every cross-tenant read/write attempt.",
    ownerAction:
      "Grant authenticated staging-project authority for migration apply and creation of two disposable unprivileged test users.",
  },
  "desktop-build-sign-update": {
    code: ["native/companion/tauri", "scripts/build-windows-installer.mjs", "scripts/packaging"],
    buildCommands: [
      "npm.cmd run desktop:bundle:windows",
      "cargo check --manifest-path native/companion/tauri/Cargo.toml",
    ],
    testCommands: [
      "cargo test --manifest-path native/companion/tauri/Cargo.toml",
      "npm.cmd run release:source-check",
    ],
    expectedResult:
      "Signed target-OS packages install, upgrade, repair, roll back and uninstall on clean machines with emergency stop preserved.",
    ownerAction:
      "Supply trusted Windows/macOS signing identities, Apple notarization authority and a controlled updater signing key/endpoint.",
  },
  "android-build-sign-device": {
    code: ["mobile", "src/lib/mobile", "scripts/mobile"],
    buildCommands: ["npm.cmd run build", "npx.cmd cap sync android"],
    testCommands: ["npm.cmd exec vitest run src/lib/__tests__/mobile-mission-control.test.ts"],
    expectedResult:
      "A signed build installs on an authorized target and proves pairing, approval, stop, reconnect and revocation without duplicate mutation.",
    ownerAction:
      "Provide an authorized Android emulator/device, release keystore and push-notification project configuration.",
  },
  "ios-build-sign-device": {
    code: ["mobile", "ios", "src/lib/mobile", ".github/workflows/platforms.yml"],
    buildCommands: [
      "npm run build",
      "npx cap sync ios",
      "xcodebuild -workspace ios/App/App.xcworkspace -scheme App build",
    ],
    testCommands: ["npm run test -- src/lib/__tests__/mobile-mission-control.test.ts"],
    expectedResult:
      "The archive validates on macOS/Xcode and an authorized target proves supported App Intent/deep-link control and explicit OS refusals.",
    ownerAction:
      "Provide a macOS/Xcode runner, Apple team provisioning, an authorized iOS target and production entitlements.",
  },
  "browser-cdp-real-matrix": {
    code: [
      "native/browser-host",
      "src/lib/native/browser-bridge.ts",
      "scripts/browser-cdp-parity.mjs",
    ],
    buildCommands: ["npm.cmd run browser:sidecar-build", "npm.cmd run build"],
    testCommands: [
      "npm.cmd run browser:host-check",
      "npm.cmd run browser:cdp-parity",
      "npm.cmd run browser-safety:check",
    ],
    expectedResult:
      "Real Chrome and Edge contexts complete DOM/accessibility/file/tab/stop actions through CDP while the extension-removal gate stays green.",
    ownerAction:
      "Approve a supervised real Chrome and Edge profile session, including any manual authentication handoff required by the validation sites.",
  },
  "real-application-and-device-matrix": {
    code: [
      "src/lib/skills/unknown-app-learning.ts",
      "native/python-host/ocade_native/application_discovery.py",
      "src/lib/control/route-selector.ts",
    ],
    buildCommands: ["npm.cmd run build", "npm.cmd run python:sidecar-build"],
    testCommands: [
      "npm.cmd run unknown-app:runtime-evidence",
      "npm.cmd run test:mutation",
      "npm.cmd run media-lab:check",
    ],
    expectedResult:
      "A varied licensed matrix proves reversible action, cancellation, planted-failure recovery, receipts and safe refusal through discovered routes.",
    ownerAction:
      "Authorize the licensed application/device matrix and supervised reversible validation actions on each target.",
  },
  "db01-schema-authority": {
    code: [
      "release/OCADE_DB01_SCHEMA_AUTHORITY_BLOCKER.json",
      "supabase/APPLY_ORDER.md",
      "scripts/db-twin.mts",
    ],
    buildCommands: ["npm.cmd run supabase:types-check", "npm.cmd run integration:source-check"],
    testCommands: ["npm.cmd exec vitest run src/lib/__tests__/db-twin.test.ts"],
    expectedResult:
      "The authoritative ficia_time_entries definition is recovered, ordered before its consumers and the full empty-database apply passes.",
    ownerAction:
      "Grant read authority to the Supabase project that owns public.ficia_time_entries so its schema, policies, grants, indexes and foreign keys can be exported.",
  },
};

const rows = snapshot.requirements.filter((row) => row.status === "EXTERNALLY BLOCKED");
const packs = blockers.blockers.map((blocker) => {
  const recipe = recipes[blocker.id];
  if (!recipe) throw new Error(`No external proof recipe for blocker ${blocker.id}`);
  const requirementIds = rows
    .filter((row) => String(row.evidence ?? "").includes(`\"${blocker.id}\"`))
    .map((row) => row.id);
  return {
    blockerId: blocker.id,
    area: blocker.area,
    status: "OWNER_ACTION_REQUIRED",
    requirementIds,
    requirementCount: requirementIds.length,
    requiredEvidence: blocker.requiredEvidence,
    ...recipe,
  };
});

const supplemental = [
  {
    blockerId: "external-stakeholder-research",
    area: "research",
    requirementIds: ["AZ-009", "AZ-010", "AZ-011", "AZ-012", "AZ-013", "AZ-014", "AZ-015"],
    requiredEvidence: [
      "Consented current external-human interviews and workflow observations",
      "Pseudonymous coverage across pain points, task frequency, risk, accessibility and regions",
      "Independent review with no raw protected participant content retained",
    ],
    code: ["src/lib/stakeholder-research.ts", "release/OCADE_STAKEHOLDER_RESEARCH_POLICY.json"],
    buildCommands: ["npm.cmd run build"],
    testCommands: ["npm.cmd run stakeholder-research:check"],
    expectedResult:
      "Every research dimension meets distinct-participant, consent, privacy, freshness and review gates.",
    ownerAction:
      "Authorize recruitment and consent for the minimum external participant cohort in OCADE_STAKEHOLDER_RESEARCH_POLICY.json.",
  },
  {
    blockerId: "production-observability-runtime",
    area: "operations",
    requirementIds: ["AZ-385"],
    requiredEvidence: [
      "Live production health, latency, error, refusal and security-alert delivery",
    ],
    code: ["release/OCADE_PRODUCTION_OPERATIONS.json", "scripts/check-production-operations.mjs"],
    buildCommands: ["npm.cmd run build"],
    testCommands: ["npm.cmd run operations:check"],
    expectedResult:
      "Authorized production probes and alert receivers retain fresh bounded monitoring receipts.",
    ownerAction:
      "Authorize the production environment and named alert receivers for one health and alert-delivery exercise.",
  },
  {
    blockerId: "alpha-beta-cohort",
    area: "release-cohort",
    requirementIds: [
      "AZ-416",
      "AZ-417",
      "AZ-418",
      "AZ-419",
      "AZ-420",
      "AZ-421",
      "AZ-422",
      "AZ-426",
    ],
    requiredEvidence: [
      "Consented alpha and beta participants",
      "Real success, refusal, cancellation, failure and recovery receipts",
      "Observed performance, usability and independent security review",
      "Fail-closed exit review",
    ],
    code: ["src/lib/controlled-rollout.ts", "release/OCADE_CONTROLLED_ROLLOUT_POLICY.json"],
    buildCommands: ["npm.cmd run build"],
    testCommands: ["npm.cmd run launch-authority:check", "npm.cmd run blocker-reduction:check"],
    expectedResult:
      "Every cohort gate carries current human/runtime evidence and the independent exit review passes.",
    ownerAction:
      "Authorize a consented external alpha/beta cohort and designate a distinct security/exit reviewer.",
  },
  {
    blockerId: "launch-sign-deploy-support",
    area: "launch-authority",
    requirementIds: ["AZ-429", "AZ-430", "AZ-431", "AZ-432"],
    requiredEvidence: [
      "Trusted signing identity",
      "Authorized deployment with verified rollback",
      "Named support/on-call authority and tested escalation",
      "Explicit announcement approval",
    ],
    code: ["scripts/launch-authority.mjs", "release/OCADE_LAUNCH_AUTHORITY_POLICY.json"],
    buildCommands: ["npm.cmd run build", "npm.cmd run deploy:check"],
    testCommands: ["npm.cmd run launch-authority:check", "npm.cmd run operations:check"],
    expectedResult:
      "Launch authority approves only after signature, deployment, rollback, support and announcement evidence reconcile.",
    ownerAction:
      "Provide signing/deployment authorities, name support contacts and explicitly approve the release announcement.",
  },
  {
    blockerId: "live-incident-drills",
    area: "incident-response",
    requirementIds: ["AZ-433", "AZ-434", "AZ-435", "AZ-436", "AZ-437"],
    requiredEvidence: [
      "Named on-call and incident commander",
      "Live alert acknowledgement and communications drill",
      "Forensic preservation and verified recovery exercise",
      "Reviewed postmortem with owned actions",
    ],
    code: [
      "release/OCADE_PRODUCTION_OPERATIONS.json",
      "release/OCADE_INCIDENT_RESPONSE_RUNBOOK.md",
    ],
    buildCommands: ["npm.cmd run build"],
    testCommands: ["npm.cmd run operations:check", "npm.cmd run launch-authority:check"],
    expectedResult:
      "A real exercise meets acknowledgement, communications, preservation, recovery and postmortem bounds.",
    ownerAction:
      "Assign the incident roles and authorize one supervised production-like incident and recovery drill.",
  },
].map((pack) => ({
  ...pack,
  status: "OWNER_ACTION_REQUIRED",
  requirementCount: pack.requirementIds.length,
}));
packs.push(...supplemental);

const unbound = rows.filter((row) => !packs.some((pack) => pack.requirementIds.includes(row.id)));
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  claimBoundary:
    "These packs make external work executable; they do not claim that owner-only proof has run.",
  externallyBlockedRows: rows.length,
  packedRows: rows.length - unbound.length,
  unboundRows: unbound.map((row) => ({ id: row.id, subject: row.subject, evidence: row.evidence })),
  packs,
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${packs.length} proof packs covering ${output.packedRows}/${rows.length} externally blocked rows.`,
);
if (unbound.length > 0) process.exitCode = 1;
