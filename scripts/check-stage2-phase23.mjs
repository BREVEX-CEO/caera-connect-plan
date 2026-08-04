import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_23.json");
const contract = read("src/lib/code/generated-sandbox.ts");
const host = read("src/lib/code/generated-sandbox-node.ts");
const worker = read("scripts/ocade-sandbox-worker.mjs");
const panel = read("src/components/ocade/CodeWorkspacePanel.tsx");
const tests = read("src/lib/__tests__/generated-sandbox.test.ts");
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

check(ledger.schemaVersion === 1 && ledger.phase === 23, "ledger schema/phase");
check(ledger.classification === "PARTIAL", "honest classification");
check(ledger.sourceScore === 90, "source score");
check(ledger.controlledJavascriptRuntimeScore === 84, "controlled JavaScript runtime");
check(ledger.securePythonRuntimeScore === 0, "Python runtime must remain zero");
check(ledger.stage2Readiness.source === 40, "Stage 2 source");
check(ledger.stage2Readiness.runtime === 2, "Stage 2 runtime");
check(ledger.stage2Readiness.production === 20, "Stage 2 production");
check(ledger.implementationPhasesRemaining === 16, "remaining implementation phases");
check(ledger.externalValidationTracksRemaining === 8, "external validation tracks");
check(ledger.nextDependency.phase === 24, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 14, "source evidence");
check(ledger.runtimeBlockers.length >= 4, "runtime blockers");

includesAll(
  contract,
  [
    "GeneratedSandboxRequest",
    "SandboxLimits",
    "allowedImports",
    'network: "disabled" | "approved"',
    "validateGeneratedSandboxRequest",
    "runGeneratedSandbox",
    "acceptGeneratedSandboxResult",
    "processTreeTerminated",
    "temporaryRootRemoved",
    "Read-only input",
    "undeclared output",
    "failed validation",
    "Only a verified sandbox run can be accepted",
    "[REDACTED]",
  ],
  "sandbox contract",
);

includesAll(
  host,
  [
    "--permission",
    "--allow-fs-read",
    "--allow-fs-write",
    "--max-old-space-size",
    "wallTimeMs",
    "storageBytes",
    "outputBytes",
    'stop("cancelled")',
    "rm(root, { recursive: true, force: true })",
    'supportedLanguages: ["javascript"]',
    "refuses non-JavaScript",
    "always denies network access",
  ],
  "Node host",
);

includesAll(
  worker,
  [
    "vm.createContext",
    "codeGeneration: { strings: false, wasm: false }",
    "readText",
    "writeText",
    "Output ${path} was not declared",
    "Sandbox path escapes its scope",
  ],
  "isolated worker",
);

includesAll(
  panel,
  [
    "Secure generated-code sandbox",
    "validateSandboxPlan",
    "Validate sandbox plan",
    "browser validates the plan but never pretends",
  ],
  "Code UI",
);

includesAll(
  tests,
  [
    "rejects path escape",
    "refuses unsupported Python",
    "real Node permission sandbox",
    "cannot traverse to an undeclared output",
    "kills a running script after cancellation",
    "processTreeTerminated: true",
    "fails closed when a host omits",
  ],
  "runtime evidence",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 23 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 23 gate: ${checks}/${checks} checks passed`);
console.log("PHASE 23: SOURCE 90% | CONTROLLED JAVASCRIPT 84% | SECURE PYTHON 0%");
console.log("STAGE 2: SOURCE 40% | RUNTIME 2% | PRODUCTION 20%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 24 WINDOWS COMPANION AND PERMISSION SETUP");
