/**
 * Bind model source, live runtime proof, and distributable bytes into one gate.
 *
 * This does not download half a gigabyte merely to make CI green. A mirror is
 * complete only when the reviewed file is actually present and its digest and
 * size match the committed catalogue. Missing bytes remain an external release
 * blocker while the publisher fallback continues to work online.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const ROOT = process.cwd();
const write = process.argv.includes("--write");
const strict = process.argv.includes("--strict");
const OUT = "release/OCADE_MODEL_DISTRIBUTION_PROOF.json";
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const json = (path) => JSON.parse(read(path));
const sourceFailures = [];
const sourceFixed = [];
const executed = [];
const externalBlocked = [];

function requireSource(condition, detail) {
  if (condition) sourceFixed.push(detail);
  else sourceFailures.push(detail);
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

const manifest = json("release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json");
const browser = json("release/OCADE_BROWSER_MODEL_CATALOGUE.json");
const runtime = json("release/OCADE_CHAT_RUNTIME_EVIDENCE.json");
const fixedSource = read("src/lib/local/fixed-model.ts");
const resolverSource = read("src/lib/brain/browser-catalogue.ts");
const downloadSource = read("src/lib/brain/model-download.ts");
const wasmAdapterSource = read("src/lib/brain/adapters/browser-wasm.ts");
const webgpuAdapterSource = read("src/lib/brain/adapters/browser-webgpu.ts");
const noCloudTest = read("src/lib/__tests__/no-cloud-inference.test.ts");
const releaseWorkflow = read(".github/workflows/release.yml");
const provenanceReview = read("docs/legal/CONTROL_ENGINE_PROVENANCE_REVIEW.md");

const tier = manifest.tiers?.[0];
requireSource(
  manifest.tiers?.length === 1 && tier?.resolved === true && tier?.tag === "qwen2.5:3b",
  "the desktop/local runtime manifest resolves exactly one fixed qwen2.5:3b model",
);
requireSource(
  typeof tier?.manifestDigest === "string" && /^sha256:[0-9a-f]{64}$/.test(tier.manifestDigest),
  "the local runtime tag is pinned to a registry manifest digest",
);
requireSource(
  typeof tier?.model?.layerDigest === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(tier.model.layerDigest),
  "the production model layer has an exact content digest and byte size",
);
requireSource(
  fixedSource.includes('export const OCADE_MODEL_ID = "qwen2.5:3b"'),
  "the shipped fixed-model authority matches the resolved manifest",
);
requireSource(
  browser.entries?.length > 0 &&
    browser.entries.every(
      (entry) =>
        /^[0-9a-f]{64}$/.test(entry.sha256) &&
        Number.isInteger(entry.sizeBytes) &&
        entry.sizeBytes > 0,
    ),
  "every browser GGUF has a pinned publisher digest and exact size",
);
requireSource(
  resolverSource.includes("sameOriginGgufUrl") &&
    downloadSource.includes("preferredWeightsUrl") &&
    wasmAdapterSource.includes("preferredWeightsUrl(sameOriginGgufUrl(tier)") &&
    webgpuAdapterSource.includes("preferredWeightsUrl("),
  "the browser engine probes a same-origin mirror before its reviewed publisher fallback",
);
requireSource(
  noCloudTest.includes("public-cloud") || noCloudTest.includes("cloud inference"),
  "a dedicated source gate refuses public-cloud inference",
);

const summary = runtime.summary ?? {};
const steps = new Map((runtime.steps ?? []).map((step) => [step.id, step]));
const evidenceTime = Date.parse(runtime.generatedAt);
const ageDays = Number.isFinite(evidenceTime) ? (Date.now() - evidenceTime) / 86_400_000 : Infinity;
const runtimeGreen =
  runtime.tier === "REAL TARGET RUNTIME VERIFIED" &&
  summary.failed === 0 &&
  summary.skipped === 0 &&
  summary.observed >= 19 &&
  ageDays <= 30 &&
  steps.get("E07")?.detail?.digest === tier?.manifestDigest?.replace(/^sha256:/, "") &&
  steps.get("E08")?.detail?.containsGroundTruth === true &&
  steps.get("E13")?.detail?.readCodeCorrectly === true &&
  steps.get("E13")?.detail?.identifiedTallestBar === true;
if (runtimeGreen) {
  executed.push(
    `live Windows runtime proof is fresh (${runtime.generatedAt}): ${summary.observed} observed, 0 failed, 0 skipped; installed digest, text answer, streaming, cancellation, recovery and vision ground truth passed`,
  );
} else {
  sourceFailures.push(
    "retained production-model runtime evidence is missing, stale, or does not match the manifest",
  );
}

for (const entry of browser.entries ?? []) {
  const localPath = join(ROOT, "public", "models", entry.path);
  if (!existsSync(localPath)) {
    externalBlocked.push({
      id: `browser-model-mirror:${entry.id}`,
      detail: `same-origin browser weight is absent: public/models/${entry.path}`,
      requiredEvidence: `place the reviewed ${entry.sizeBytes}-byte file at that path and rerun this gate`,
    });
    continue;
  }
  const sizeOk = statSync(localPath).size === entry.sizeBytes;
  const digest = await sha256(localPath);
  if (!sizeOk || digest !== entry.sha256) {
    sourceFailures.push(
      `browser mirror ${entry.path} does not match its committed size and SHA-256`,
    );
  } else {
    executed.push(`same-origin browser mirror ${entry.path} matches ${entry.sha256}`);
  }
}

if (!existsSync(join(ROOT, "public", "models", "webllm"))) {
  externalBlocked.push({
    id: "webgpu-model-mirror",
    detail: "the optional same-origin WebGPU model/library mirror is not populated",
    requiredEvidence:
      "mirror the installed WebLLM runtime files under public/models/webllm and verify a third-party-free first load",
  });
}
if (/if:\s*\$\{\{\s*false\s*\}\}/.test(releaseWorkflow)) {
  externalBlocked.push({
    id: "signed-desktop-distribution",
    detail: "desktop publishing is intentionally disabled",
    requiredEvidence:
      "platform signing/notarization identities, trusted updater channel, and clean-machine install/upgrade/rollback proof",
  });
}
if (/Status:\s*\*\*OPEN/i.test(provenanceReview)) {
  externalBlocked.push({
    id: "control-engine-provenance",
    detail: "control-engine provenance review remains open",
    requiredEvidence:
      "clean-room/provenance inventory and qualified commercial-distribution review bound to the release commit",
  });
}
if (tier?.licence?.identifierGuess === "see licence text") {
  externalBlocked.push({
    id: "desktop-model-licence-review",
    detail: `the runtime registry licence is not machine-classified (${tier.licence.firstLine ?? "unknown first line"})`,
    requiredEvidence:
      "review the exact fetched licence digest before redistributing desktop model bytes; runtime-managed pulls may remain separate",
  });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  classification:
    sourceFailures.length > 0
      ? "SOURCE FAILED"
      : externalBlocked.length > 0
        ? "SOURCE-FIXED AND EXECUTED; DISTRIBUTION EXTERNALLY BLOCKED"
        : "EXECUTED AND DISTRIBUTABLE",
  executed,
  sourceFixed,
  sourceFailures,
  externalBlocked,
};

if (write) {
  mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
  writeFileSync(join(ROOT, OUT), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`model distribution: ${report.classification}`);
console.log(
  `  EXECUTED ${executed.length} · SOURCE-FIXED ${sourceFixed.length} · EXTERNALLY BLOCKED ${externalBlocked.length}`,
);
for (const failure of sourceFailures) console.error(`  SOURCE FAILURE: ${failure}`);
for (const blocker of externalBlocked) console.log(`  EXTERNAL: ${blocker.detail}`);

if (sourceFailures.length > 0) process.exit(1);
if (strict && externalBlocked.length > 0) process.exit(2);
