/**
 * Resolve the 48 SOURCE COMPLETE requirements that carry zero evidence weight.
 *
 * SOURCE COMPLETE asserts one thing: the artefact exists. That is cheap to
 * check and therefore inexcusable to assert without checking. Each of the 48
 * was checked individually against the tree, and they split three ways:
 *
 *   BIND      — the artefact exists; cite its exact path.
 *   PARTIAL   — something related exists but not what the requirement claims.
 *   DOWNGRADE — nothing exists. `docs/` is empty: there are no ADRs, no context
 *               diagrams, no charter, no roadmap. These rows asserted source
 *               that was never written.
 *
 * The downgrades REDUCE declared readiness. That is the point. A register that
 * only ever moves upward is a marketing document, not an engineering one.
 *
 * Every cited path is verified to exist before writing, and the script refuses
 * to run otherwise.
 *
 * Usage: node scripts/bind-source-evidence.mjs [--write]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const write = process.argv.includes("--write");

/** id → [artefact paths, what the artefact actually provides] */
const BIND = new Map([
  ["AZ-006", [["release/OCADE_EVIDENCE_TIERS.md"], "the evidence-class policy every status in this register is graded against"]],
  ["AZ-017", [["release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json"], "510 stable requirement IDs, each with subject, area, status and weight"]],
  ["AZ-018", [["OCADE_FULL_LINE_COVERAGE_LEDGER.md", "release/OCADE_INTEGRATION_AUDIT.json"], "requirement-to-code traceability"]],
  ["AZ-021", [["release/OCADE_EVIDENCE_TIERS.md"], "the defined evidence ladder from NOT STARTED to PRODUCTION READY"]],
  ["AZ-023", [["release/OCADE_DEFINITION_OF_DONE.md"], "the definition of done applied to every phase"]],
  ["AZ-349", [[".github/workflows/ci.yml"], "the `web` job: typecheck, lint, tests, build and 20+ gates"]],
  ["AZ-350", [[".github/workflows/ci.yml"], "the `rust` job running the companion safety core suite"]],
  ["AZ-351", [[".github/workflows/platforms.yml"], "the `android` job: build plus emulator instrumented tests"]],
  ["AZ-352", [[".github/workflows/platforms.yml"], "the `ios` job: simulator build on macos-latest"]],
  ["AZ-355", [[".github/workflows/ci.yml", "release/THIRD_PARTY_NOTICES.md"], "the `licences:check` CI step and the generated notices file"]],
  ["AZ-356", [[".github/workflows/platforms.yml", ".github/workflows/release.yml"], "artifact upload steps for platform and release builds"]],
  ["HWE-01", [[".github/workflows/platforms.yml"], "the `desktop-windows` job building the companion on hosted Windows runners"]],
  ["HWE-23", [[".github/workflows/platforms.yml"], "the hosted Android emulator matrix with instrumented tests"]],
  ["HWE-24", [[".github/workflows/platforms.yml"], "the hosted macOS runner and iOS simulator lane"]],
  ["HWE-34", [[".github/workflows/platforms.yml"], "APK artifact upload providing a direct download lane"]],
  ["HWE-50", [[".github/workflows/release.yml"], "the cross-platform release build orchestrator"]],
  ["CXR-10", [["release/OCADE_RELEASE_CHECKLIST.md", "release/OCADE_DEFINITION_OF_DONE.md", "scripts/readiness-engine.mjs"], "the release checklist, definition of done, and the engine that refuses production readiness without real-target evidence"]],
]);

/** id → [new status, why the claimed source is not fully there] */
const DOWNGRADE = new Map([
  // Charter: no charter document exists anywhere in the tree.
  ["AZ-001", ["NOT STARTED", "No vision document exists. `docs/` is empty and no file in the tree states a product vision."]],
  ["AZ-002", ["NOT STARTED", "No personas are defined anywhere in the repository."]],
  ["AZ-003", ["NOT STARTED", "No outcomes document exists."]],
  ["AZ-004", ["NOT STARTED", "No non-goals are recorded."]],
  ["AZ-005", ["NOT STARTED", "No ethical-boundaries document exists."]],
  ["AZ-007", ["NOT STARTED", "No governance model is documented."]],
  ["AZ-008", ["NOT STARTED", "No success metrics are defined."]],
  // Traceability gaps: the register has no acceptance, dependency or owner field.
  ["AZ-019", ["NOT STARTED", "Register rows carry only id, subject, area, status, weight, evidence and resolvedInPhase. There is no acceptance-criteria field and no separate acceptance document."]],
  ["AZ-020", ["NOT STARTED", "No requirement dependency graph exists; the register records no dependency field."]],
  ["AZ-022", ["NOT STARTED", "No change-control process is documented."]],
  ["AZ-024", ["NOT STARTED", "No ownership map exists; the register records no owner field."]],
  // Architecture: docs/ is empty.
  ["AZ-041", ["NOT STARTED", "No ADRs exist. `docs/` is empty and no architecture-decision record is present in the tree."]],
  ["AZ-042", ["NOT STARTED", "No context diagrams exist."]],
  ["AZ-043", ["NOT STARTED", "No trust-boundary document exists. Trust boundaries are enforced in code but never described."]],
  ["AZ-044", ["NOT STARTED", "No runtime-boundary document exists."]],
  ["AZ-045", ["NOT STARTED", "No integration-contract document exists. Contracts are implicit in TypeScript types only."]],
  ["AZ-046", ["NOT STARTED", "No ownership map exists."]],
  ["AZ-047", ["NOT STARTED", "No compatibility policy is documented."]],
  ["AZ-048", ["NOT STARTED", "No deprecation policy is documented."]],
  // Product governance: none of these artefacts exist.
  ["AZ-445", ["NOT STARTED", "No roadmap document exists."]],
  ["AZ-446", ["NOT STARTED", "No feature-intake process is documented."]],
  ["AZ-447", ["NOT STARTED", "No architecture-review process is documented."]],
  ["AZ-448", ["NOT STARTED", "No safety-review process is documented."]],
  ["AZ-449", ["NOT STARTED", "No migration policy is documented."]],
  ["AZ-450", ["NOT STARTED", "No portfolio-management process is documented."]],
  // Mobile transport: the claimed capability is absent from the code.
  ["HWE-26", ["NOT STARTED", "Relay minimisation does not exist. `buildMobileTransport` in src/lib/mobile/transport-factory.ts always constructs a WebSocketRelayAdapter; there is no peer-to-peer or LAN-direct path to prefer, so there is nothing to minimise."]],
  ["HWE-35", ["NOT STARTED", "No progressive web app exists: there is no web manifest and no service worker in the tree."]],
  // Partial: related checks run, but the claimed artefact is not there.
  ["AZ-353", ["PARTIAL SOURCE", "No extension CI job exists. src/lib/__tests__/extension-package.test.ts does run inside the `web` job's test step, so packaging rules are checked — but nothing builds, packages or publishes the extension in CI."]],
  ["AZ-354", ["PARTIAL SOURCE", "No database CI job exists. src/lib/__tests__/supabase-sql-discipline.test.ts runs inside the `web` job, so migration discipline is checked statically — but no workflow applies a migration or verifies it against a real database."]],
  ["AZ-387", ["PARTIAL SOURCE", "release/OCADE_RELEASE_CHECKLIST.md contains a single line naming clean-install testing as required. No procedure, no script and no recorded run exist."]],
  ["AZ-388", ["PARTIAL SOURCE", "Covered only by the same one-line checklist entry as AZ-387. No macOS clean-install procedure or evidence exists."]],
]);

// Refuse to run if any cited artefact is missing.
const missing = [];
for (const [id, [paths]] of BIND) {
  for (const p of paths) if (!existsSync(p)) missing.push(`${id} → ${p}`);
}
if (missing.length > 0) {
  console.error(`REFUSING TO RUN — ${missing.length} cited artefact(s) do not exist:`);
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const byId = new Map(snapshot.requirements.map((r) => [r.id, r]));

// Statuses must match what the readiness engine already recognises.
const WEIGHTS = { "NOT STARTED": 0, "PARTIAL SOURCE": 0.2, "SOURCE COMPLETE": 0.4 };

let boundCount = 0;
let downgradedCount = 0;
let declaredDelta = 0;

for (const [id, [paths, provides]] of BIND) {
  const req = byId.get(id);
  if (!req) throw new Error(`Unknown requirement ${id}`);
  req.evidence =
    `SOURCE COMPLETE — artefact verified present: ${paths.join(", ")}. ` +
    `Provides ${provides}. ` +
    `Proves the artefact exists; NOT that it has ever been executed or validated.`;
  req.resolvedInPhase = "P29-source-evidence-binding";
  boundCount += 1;
}

for (const [id, [status, why]] of DOWNGRADE) {
  const req = byId.get(id);
  if (!req) throw new Error(`Unknown requirement ${id}`);
  const before = WEIGHTS[req.status] ?? req.weight ?? 0;
  const after = WEIGHTS[status];
  declaredDelta += after - before;

  req.status = status;
  req.weight = after;
  req.evidence = `DOWNGRADED from SOURCE COMPLETE. ${why} Verified against the working tree, not inferred.`;
  req.resolvedInPhase = "P29-source-evidence-binding";
  downgradedCount += 1;
}

console.log(`Source evidence: ${boundCount} bound to a verified artefact.`);
console.log(`Downgraded:      ${downgradedCount} (claimed source that does not exist).`);
console.log(`Declared readiness change: ${declaredDelta.toFixed(1)} points.`);

if (write) {
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${SNAPSHOT}.`);
} else {
  console.log("\nDry run. Pass --write to apply.");
}
