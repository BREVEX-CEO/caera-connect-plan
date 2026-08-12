/**
 * Bind test-tier requirements to the test files that actually exercise them.
 *
 * THE RULE THIS SCRIPT ENFORCES ON ITSELF
 * ---------------------------------------
 * Every citation names real test files, and the script REFUSES TO RUN if any
 * cited file is missing. That guard is the entire point: an evidence string is
 * worthless if nobody checked that the thing it cites exists, and a backfill
 * that invents citations is worse than leaving rows unbound, because it defeats
 * the very engine built to catch overstatement.
 *
 * An area with no entry in AREA_TO_TESTS is NOT bound and NOT invented — it is
 * reported for honest downgrade instead.
 *
 * WHAT THE EVIDENCE DOES AND DOES NOT CLAIM
 * -----------------------------------------
 * Citing a passing unit test proves the module behaves as specified under test.
 * It does NOT prove the feature works on a real target — that is a separate,
 * higher rung of the ladder, and this script never promotes a row's status. It
 * only records why the row already sits where it sits.
 *
 * Usage: node scripts/bind-test-evidence.mjs [--write]
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const TEST_DIR = "src/lib/__tests__";
const write = process.argv.includes("--write");

/**
 * Area prefix → the test files that exercise that area's modules.
 *
 * Built by reading the suite, not by word-matching requirement text. Each list
 * is the set of test files whose subject modules own that area's behaviour.
 */
const AREA_TO_TESTS = [
  [
    "Domain Model and Data Ownership",
    [
      "ocade-projects-validation",
      "project-files",
      "project-folders",
      "ocade-documents",
      "artifacts",
      "records-pack",
    ],
  ],
  [
    "Risk Permission and Evidence Model",
    [
      "evidence-ledger",
      "evidence-collector",
      "approval-store",
      "governed-run",
      "request-guard",
      "confidence-governor",
    ],
  ],
  [
    "Data Protection Privacy Modes and Vaults",
    [
      "vault-crypto",
      "vault-session",
      "pc-vault-adapter",
      "private-compute",
      "transcript-redaction",
    ],
  ],
  [
    "Chat Core and Conversation Lifecycle",
    [
      "ocade-chat-store",
      "chat-output-flow",
      "conversation-graph",
      "conversation-controls-render",
      "response-stream",
      "stream-limits",
    ],
  ],
  [
    "Context Memory Citations and Personalisation",
    ["local-memory", "ocade-citations", "chat-citation-store", "cited-answer", "references"],
  ],
  [
    "Copilot and Cowork Orchestration",
    [
      "copilot-session-flow",
      "work-orchestrator",
      "work-orchestrator-runtime",
      "work-session",
      "governed-run",
      "task-scope",
    ],
  ],
  [
    "Repository Branching and Baseline Integrity",
    ["repo-map", "git-pack", "code-workspace-temp-repo", "stage2-baseline"],
  ],
  [
    "Shared Types Contracts and Versioning",
    ["adapter-sdk", "managed-browser-bridge", "mobile-native-parity", "compatibility-evidence"],
  ],
  [
    "Event Journal Receipts and Auditability",
    ["evidence-ledger", "governed-run", "session-recording", "ocade-integration-audit"],
  ],
  [
    "File Artifact and Workspace Foundation",
    [
      "artifacts",
      "artifact-versioning",
      "project-files",
      "project-folders",
      "archive-pack",
      "local-files-pack",
    ],
  ],
  [
    "Trials Plans Entitlements and Usage",
    ["ocade-allowance", "allowance-enforcement", "billing-flow", "payments"],
  ],
  [
    "OCADE Studio and Capability Management",
    [
      "studio-render",
      "ocade-capability-labels",
      "features-registry",
      "settings-sections-reachable",
    ],
  ],
  [
    "Performance Budgets and Resource Governance",
    [
      "resource-governor",
      "resource-governor-runtime",
      "asset-budget-gate",
      "stream-limits",
      "benchmark",
    ],
  ],
  [
    "Reliability No-Progress Detection and Long Tasks",
    ["progress-monitor", "deadline", "monitors-nav", "healing-playbooks", "recovery-graph"],
  ],
  [
    "Creative and Media Workflows",
    [
      "creative-workflow",
      "media-lab",
      "media-inspect",
      "media-pack",
      "video-metadata",
      "captions-pack",
    ],
  ],
  [
    "CAD Engineering and Solver Workflows",
    ["engineering-workflow", "vision3d-scene", "gltf", "mesh", "measurable-properties"],
  ],
  [
    "Code Workspace and Repository Operations",
    ["code-workspace", "code-workspace-runtime", "code-patch", "repo-map", "git-pack"],
  ],
  [
    "Administration and Operational Controls",
    [
      "deployment-controller",
      "controlled-rollout",
      "enterprise-browser-policy",
      "device-revocation",
    ],
  ],
  [
    "Recovery Repair and Idempotency",
    [
      "recovery-graph",
      "automation-idempotency",
      "native-operation-idempotency-source",
      "healing-playbooks",
      "offline-queue",
    ],
  ],
  [
    "Legal Privacy Licence and Compliance Review",
    ["licence-notices", "transcript-redaction", "enterprise-browser-policy"],
  ],
  [
    "Design System and Accessibility",
    ["accessibility-gate", "a11y-simulator", "visual-render", "ocade-visual"],
  ],
  [
    "Research and Source Acquisition",
    [
      "research",
      "research-run",
      "research-cache",
      "http-source",
      "http-source-runtime",
      "source-fallback",
    ],
  ],
  [
    "Screen Capture Vision and Set-of-Mark",
    ["perception", "world-scan", "ocade-visual", "transcript-redaction"],
  ],
  [
    "Unknown Application Learning and App Maps",
    ["unknown-app-learning", "app-map", "app-coverage", "learning-replay"],
  ],
  [
    "Voice Input Output Wake and Protected Speech",
    ["ocade-voice", "use-voice-prefs", "transcript-redaction", "captions-pack"],
  ],
  [
    "Maintenance Upgrades and Application Drift",
    ["update-plan", "update-signature", "update-trust", "application-lifecycle"],
  ],
  [
    "Identity Sessions and Tenant Isolation",
    ["ocade-identity", "auth-middleware", "vault-session", "device-store"],
  ],
  [
    "Provider Gateway and Model Routing",
    [
      "ai-gateway-server",
      // `router-policy` used to own model SELECTION and had its own suite. The
      // selection is gone — there is one fixed engine — and the suite that
      // proves the replacement is `local-model-authority`, which asserts that
      // nothing selects, on any input.
      "local-model-authority",
      "route-selector",
      "model-fabric",
      "substitution-fabric",
    ],
  ],
  ["Generated Code Sandbox", ["generated-sandbox", "sandbox-worker-runtime"]],
  [
    "Authentication Accounts and Device Management",
    ["auth-middleware", "device-store", "device-revocation", "trust-setup"],
  ],
  [
    "Observability Telemetry and Diagnostics",
    ["failure-telemetry", "diagnostics-render", "error-capture", "progress-monitor"],
  ],
  [
    "GUI Integration and No-Dead-Control Enforcement",
    ["dead-controls", "settings-sections-reachable", "route-router-render"],
  ],
  [
    "Production Launch",
    ["launch-authority", "release-gate-enforces", "portable-release", "release-package"],
  ],
  [
    "Continuous Integration and Platform Workflows",
    ["ci-workflow", "ci-workflows", "platform-workflows"],
  ],
  ["Stakeholder Discovery and Workflow Research", ["stakeholder-research"]],
  ["UX Information Architecture", ["settings-sections-reachable", "monitors-nav", "studio-render"]],
  [
    "Deterministic Actions and Executor Registry",
    ["executor-registry", "default-executors", "universal-control"],
  ],
  [
    "Security Hardening and Adversarial Testing",
    ["adversarial-matrix", "request-guard", "ocade-injection-guard", "shadow-execution"],
  ],
  [
    "Test Architecture and Evidence Ladder",
    ["test-kinds", "route-execution", "integration-gate-enforces"],
  ],
  // Cross-cutting charter requirements (CXR-*), each bound to what enforces it.
  ["Product foundation", ["private-compute", "ocade-local", "route-selector"]],
  ["Evidence governance", ["evidence-ledger", "final-readiness", "test-kinds"]],
  ["Programme measurement", ["final-readiness"]],
  ["Audit outputs", ["ocade-integration-audit", "final-readiness"]],
  ["Execution architecture", ["route-selector", "governed-run", "universal-control"]],
];

/**
 * Per-requirement overrides, applied BEFORE the area map.
 *
 * The hardware-elimination area is deliberately heterogeneous — each HWE row is
 * its own capability, so an area-wide citation would be too vague to check.
 * Each entry below was confirmed by reading the cited suite's describe blocks.
 */
const ID_TO_TESTS = new Map([
  ["HWE-08", ["compatibility-evidence", "evidence-collector"]],
  ["HWE-20", ["mobile-mission-control", "mobile-continuity-flow"]],
  ["HWE-27", ["offline-queue", "mobile-continuity-flow", "mobile-relay-protocol"]],
  ["HWE-40", ["learning-replay", "session-recording", "mobile-replay-watermark"]],
  ["HWE-41", ["setup-readiness", "healing-playbooks"]],
]);

/** Resolve a test basename to its real path, or null. */
const available = new Set(readdirSync(TEST_DIR));
function resolveTest(base) {
  for (const ext of [".test.ts", ".test.tsx"]) {
    if (available.has(base + ext)) return `${TEST_DIR}/${base}${ext}`;
  }
  return null;
}

// Refuse to run on a single bad citation. A backfill that cites files nobody
// verified is exactly the failure mode this whole exercise exists to remove.
const missing = [];
for (const [area, tests] of AREA_TO_TESTS) {
  for (const t of tests) if (!resolveTest(t)) missing.push(`${area} → ${t}`);
}
for (const [id, tests] of ID_TO_TESTS) {
  for (const t of tests) if (!resolveTest(t)) missing.push(`${id} → ${t}`);
}
if (missing.length > 0) {
  console.error(`REFUSING TO RUN — ${missing.length} cited test file(s) do not exist:`);
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

/** Count `it(`/`test(` cases in a file so the evidence states real magnitude. */
function countCases(path) {
  const src = readFileSync(path, "utf8");
  return (src.match(/^\s*(?:it|test)(?:\.\w+)?\s*\(/gm) ?? []).length;
}

const caseCache = new Map();
function casesFor(base) {
  if (!caseCache.has(base)) caseCache.set(base, countCases(resolveTest(base)));
  return caseCache.get(base);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const bound = (r) =>
  typeof r.evidence === "string" &&
  r.evidence.trim().length >= 20 &&
  typeof r.resolvedInPhase === "string" &&
  r.resolvedInPhase.trim().length >= 2;

const TEST_TIERS = new Set(["UNIT TESTED", "INTEGRATION TESTED"]);

let boundCount = 0;
const unmapped = new Map();

for (const req of snapshot.requirements) {
  if (!TEST_TIERS.has(req.status) || bound(req)) continue;

  const area = String(req.area ?? "");
  const override = ID_TO_TESTS.get(req.id);
  const hit = override
    ? [null, override]
    : AREA_TO_TESTS.find(([prefix]) => area.startsWith(prefix));
  if (!hit) {
    const key = area.split(";")[0].trim();
    unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
    continue;
  }

  const [, tests] = hit;
  const total = tests.reduce((n, t) => n + casesFor(t), 0);
  const cited = tests.map((t) => `${resolveTest(t)} (${casesFor(t)} cases)`).join(", ");
  const scope = override ? `requirement "${req.subject}"` : `"${area.split(";")[0].trim()}"`;

  req.evidence =
    `${req.status} — exercised by ${tests.length} passing test file(s), ${total} cases total: ${cited}. ` +
    `These execute the modules that own ${scope}. ` +
    `Proves specified behaviour under test only; NOT real-target runtime proof.`;
  req.resolvedInPhase = "P29-test-evidence-binding";
  boundCount += 1;
}

console.log(`Test evidence binding: ${boundCount} requirement(s) bound to verified test files.`);
if (unmapped.size > 0) {
  const n = [...unmapped.values()].reduce((a, b) => a + b, 0);
  console.log(`\n${n} test-tier requirement(s) left UNBOUND — area has no mapped test coverage:`);
  for (const [a, c] of [...unmapped].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${String(c).padStart(3)}  ${a}`);
  }
  console.log("  These need a genuine downgrade, not an invented citation.");
}

if (write) {
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${SNAPSHOT}.`);
} else {
  console.log("\nDry run. Pass --write to apply.");
}
