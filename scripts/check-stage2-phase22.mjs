import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_22.json");
const fabric = read("src/lib/providers/model-fabric.ts");
const catalog = read("src/lib/ocade-models.ts");
const route = read("src/routes/_authenticated/ocade.models.tsx");
const tests = read("src/lib/__tests__/model-fabric.test.ts");
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

check(ledger.schemaVersion === 1 && ledger.phase === 22, "ledger schema/phase");
check(ledger.classification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED", "classification");
check(ledger.sourceScore === 94, "source score");
check(ledger.controlledHttpRuntimeScore === 60, "controlled HTTP score");
check(ledger.liveInstalledProviderRuntimeScore === 0, "live provider runtime must remain zero");
check(ledger.stage2Readiness.source === 36, "Stage 2 source");
check(ledger.stage2Readiness.sourceRemaining === 64, "Stage 2 source remainder");
check(ledger.stage2Readiness.runtime === 0, "Stage 2 runtime claim");
check(ledger.stage2Readiness.production === 18, "Stage 2 production");
check(ledger.implementationPhasesRemaining === 17, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external validation tracks");
check(ledger.nextDependency.phase === 23, "next dependency");
check(ledger.providers.length === 9, "provider count");
check(new Set(ledger.providers).size === 9, "provider ids unique");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 10, "source capability evidence");
check(ledger.runtimeBlockers.length >= 4, "runtime blocker evidence");

includesAll(
  fabric,
  [
    '"ollama"',
    '"lm_studio"',
    '"llama_cpp"',
    '"localai"',
    '"vllm"',
    '"jan"',
    '"koboldcpp"',
    '"openai_compatible"',
    '"openai"',
    "ProviderManifest",
    "ProviderRuntimeState",
    "ModelCapabilities",
    "validateProviderBaseUrl",
    "discoverEnabled",
    "availableRamMb",
    "availableGpuMemoryMb",
    "maxLatencyMs",
    "allowMetered",
    "rateLimitUntil",
    "circuitOpenUntil",
    "lastSuccessfulRequest",
    "failedProviders",
    "Provider request timed out",
    "malformed structured output",
    "malformed tool calls",
    "context_overflow",
    "out_of_memory",
    "createModelFabricBrain",
    "Do not execute tools",
  ],
  "provider fabric",
);

includesAll(
  catalog,
  ["OCADE_MODEL_FABRIC_PROVIDERS", "createDefaultProviderManifests", "getModelFabricProvider"],
  "catalog integration",
);

includesAll(
  route,
  [
    "Local model provider fabric",
    "runFabricTest",
    "ModelProviderFabric",
    "without sending a prompt",
    "health and model discovery only",
  ],
  "model-control integration",
);

includesAll(
  tests,
  [
    "real loopback HTTP failover and circuit behavior",
    "fails over across two available HTTP providers",
    "first:/v1/chat/completions",
    "second:/v1/chat/completions",
    "deterministic unavailable fixtures",
    "opens rate-limit and malformed-output circuits",
    "does not retry another model",
    "enforces request deadlines and cancellation",
    "never to errors or snapshots",
  ],
  "runtime regression evidence",
);

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 22 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 22 gate: ${checks}/${checks} checks passed`);
console.log("PHASE 22: SOURCE 94% | CONTROLLED HTTP 60% | LIVE INSTALLED PROVIDERS 0%");
console.log("STAGE 2: SOURCE 36% | RUNTIME 0% | PRODUCTION 18%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 23 SECURE GENERATED-CODE SANDBOX");
