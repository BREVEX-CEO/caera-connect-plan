/**
 * Resolve the REAL model manifest for every device tier — no guessed tags.
 *
 * WHY THIS EXISTS
 * ---------------
 * The plan's §2 matrix names a model per device class in prose ("Qwen3 8B, Q4
 * quantized"). Prose is not a manifest. Shipping a downloader that trusts a
 * hand-typed tag means the first time anyone finds out the tag was wrong is when
 * a user's download 404s, or worse, succeeds and fetches something else.
 *
 * So every field here is READ FROM THE RUNTIME'S OWN REGISTRY, not typed in:
 *
 *   - the tag is confirmed to exist by a 200 on its manifest;
 *   - the manifest digest is computed from the exact bytes received, because
 *     this registry sends no Docker-Content-Digest header (verified, not
 *     assumed — the response carries only Cloudflare and content-type headers);
 *   - the model layer's digest and byte size come from the manifest body;
 *   - the quantization and parameter size come from the config blob, using the
 *     registry's own field names rather than what the keys look like they mean;
 *   - the licence comes from the licence layer blob — fetched and hashed, not
 *     asserted from memory.
 *
 * RAM figures are the one thing the registry cannot tell us. They are DERIVED
 * from the real model byte size by an explicit, stated formula (see ramFor), so
 * the arithmetic can be argued with. They are not vibes, and they are not
 * copied from a blog post.
 *
 * Network: this reads registry.ollama.ai, the same registry the runtime pulls
 * from. It downloads manifests and small config/licence blobs only — never model
 * weights. Run with --write to update the manifest file.
 *
 * Usage: node scripts/resolve-model-manifest.mjs [--write]
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const REGISTRY = "https://registry.ollama.ai/v2/library";
const MANIFEST_ACCEPT = "application/vnd.docker.distribution.manifest.v2+json";
const write = process.argv.includes("--write");
const OUT = "release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json";

/**
 * The device tiers, straight from the plan's §2 matrix. `tag` is a CANDIDATE
 * here — it is only recorded as resolved once its manifest returns 200.
 */
const TIERS = [
  {
    id: "phone",
    deviceClass: "Phone (any)",
    tag: "qwen3:1.7b",
    why: "Phones cannot run more. Standalone chat and voice only; real desktop work routes to the paired PC.",
    acceleration: "CPU (mobile NPU/GPU not used by this runtime)",
  },
  {
    id: "weak-pc",
    deviceClass: "Weak PC, 4-8 GB RAM",
    tag: "qwen3:4b",
    why: "Smallest tier that still handles tool-calling reliably.",
    acceleration: "CPU",
  },
  {
    id: "mid-pc-cpu",
    deviceClass: "Mid PC, 16 GB RAM, no dedicated GPU",
    tag: "qwen3:8b",
    why: "Best accuracy-to-latency balance with no GPU available. This is the tier of the current development host.",
    acceleration: "CPU",
  },
  {
    id: "strong-pc-gpu",
    deviceClass: "Strong PC, 16 GB+ with a capable GPU",
    tag: "qwen3:14b",
    why: "Meaningfully better reasoning once real GPU acceleration exists.",
    acceleration: "GPU (CUDA/ROCm/Metal) with CPU fallback",
  },
  {
    id: "high-end",
    deviceClass: "High-end, 24 GB+ VRAM",
    tag: "qwen3:30b-a3b",
    why: "Mixture-of-experts tier. Needs real VRAM; on a CPU-only host it is slower than the 8B despite being 'bigger'.",
    acceleration: "GPU required for usable latency",
  },
];

/**
 * Weights must be resident, and the runtime needs working space for the KV
 * cache and its own footprint on top. 1.25x the weight size plus 1 GB is the
 * floor at which the model loads at all; 1.6x plus 2 GB is where it stops
 * thrashing. Both are stated so a reader can disagree with the multiplier
 * rather than having to reverse-engineer it.
 */
function ramFor(modelBytes) {
  const GB = 1024 ** 3;
  return {
    minimumRamBytes: Math.ceil(modelBytes * 1.25 + 1 * GB),
    recommendedRamBytes: Math.ceil(modelBytes * 1.6 + 2 * GB),
    formula: "minimum = weights * 1.25 + 1 GiB; recommended = weights * 1.6 + 2 GiB",
  };
}

/**
 * Fetch as raw text and hash the exact bytes received.
 *
 * The registry does not return a Docker-Content-Digest header (verified: the
 * response carries only Cloudflare and content-type headers). Recording `null`
 * would leave the manifest unpinned, so the digest is computed here from the
 * bytes themselves — which is what a content digest is. It is labelled
 * `computed` in the output so nobody mistakes it for a server assertion.
 */
async function getRaw(url, accept) {
  const res = await fetch(url, accept ? { headers: { Accept: accept } } : undefined);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  return {
    text,
    sha256: `sha256:${createHash("sha256").update(text).digest("hex")}`,
    headerDigest: res.headers.get("docker-content-digest"),
  };
}

async function getJson(url, accept) {
  const raw = await getRaw(url, accept);
  return { body: JSON.parse(raw.text), sha256: raw.sha256, headerDigest: raw.headerDigest };
}

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function layer(manifest, mediaType) {
  return manifest.layers?.find((l) => l.mediaType === mediaType) ?? null;
}

async function resolveTier(tier) {
  const [name, ref] = tier.tag.split(":");
  const manifestUrl = `${REGISTRY}/${name}/manifests/${ref}`;

  const {
    body: manifest,
    sha256: manifestSha256,
    headerDigest,
  } = await getJson(manifestUrl, MANIFEST_ACCEPT);

  const modelLayer = layer(manifest, "application/vnd.ollama.image.model");
  if (!modelLayer) throw new Error(`${tier.tag} has no model layer`);

  // Config blob carries the real quantization and parameter count.
  const configDigest = manifest.config?.digest;
  const config = configDigest
    ? await getJson(`${REGISTRY}/${name}/blobs/${configDigest}`).then((r) => r.body)
    : null;

  // Licence is FETCHED, not asserted. If a tier ships a different licence than
  // expected, that has to be visible before we redistribute anything.
  const licenceLayer = layer(manifest, "application/vnd.ollama.image.license");
  let licence = null;
  if (licenceLayer) {
    const text = await getText(`${REGISTRY}/${name}/blobs/${licenceLayer.digest}`);
    licence = {
      digest: licenceLayer.digest,
      bytes: licenceLayer.size,
      sha256OfFetchedText: createHash("sha256").update(text).digest("hex"),
      firstLine:
        text
          .split("\n")
          .find((l) => l.trim().length > 0)
          ?.trim() ?? null,
      identifierGuess: /apache\s*license/i.test(text)
        ? "Apache-2.0"
        : /mit license/i.test(text)
          ? "MIT"
          : "see licence text",
    };
  }

  const totalBytes = (manifest.layers ?? []).reduce((n, l) => n + (l.size ?? 0), 0);

  return {
    ...tier,
    resolved: true,
    resolvedAt: new Date().toISOString(),
    manifestUrl,
    manifestDigest: headerDigest ?? manifestSha256,
    manifestDigestSource: headerDigest
      ? "docker-content-digest response header"
      : "computed from the exact manifest bytes received — this registry sends no Docker-Content-Digest header",
    manifestSchemaVersion: manifest.schemaVersion,
    configDigest: configDigest ?? null,
    model: {
      layerDigest: modelLayer.digest,
      bytes: modelLayer.size,
      gib: Math.round((modelLayer.size / 1024 ** 3) * 100) / 100,
    },
    expectedStorageBytes: totalBytes,
    expectedStorageGib: Math.round((totalBytes / 1024 ** 3) * 100) / 100,
    // Field names are the registry's own. `model_type` is the PARAMETER SIZE
    // ("8.2B") and `architecture` is the CPU architecture of the build
    // ("amd64") — an earlier pass mapped both wrongly, so they are named
    // explicitly here rather than guessed at from the key.
    quantization: config?.file_type ?? null,
    parameterSize: config?.model_type ?? null,
    modelFamily: config?.model_family ?? null,
    weightFormat: config?.model_format ?? null,
    buildArchitecture: config?.architecture ?? null,
    buildOs: config?.os ?? null,
    ...ramFor(modelLayer.size),
    licence,
  };
}

const results = [];
const failures = [];
for (const tier of TIERS) {
  try {
    const r = await resolveTier(tier);
    results.push(r);
    console.log(
      `RESOLVED ${r.tag.padEnd(16)} ${String(r.model.gib).padStart(6)} GiB  ${r.model.layerDigest.slice(0, 23)}  ${r.quantization ?? "?"}  ${r.licence?.identifierGuess ?? "?"}`,
    );
  } catch (error) {
    // An unresolved tier is recorded as UNRESOLVED. It is never quietly given a
    // plausible-looking digest, and it must not be presented as installable.
    failures.push({ tier: tier.id, tag: tier.tag, error: String(error.message ?? error) });
    results.push({ ...tier, resolved: false, error: String(error.message ?? error) });
    console.error(`UNRESOLVED ${tier.tag}: ${error.message ?? error}`);
  }
}

/**
 * Rollback target: the next smaller resolved tier. The smallest tier has none —
 * recorded as null rather than pointing at itself, because "roll back to
 * yourself" is not a recovery path.
 */
const resolvedOrder = results.filter((r) => r.resolved);
for (let i = 0; i < resolvedOrder.length; i++) {
  resolvedOrder[i].rollbackTarget = i === 0 ? null : resolvedOrder[i - 1].tag;
}

const document = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/resolve-model-manifest.mjs",
  registry: REGISTRY,
  updateChannel: "stable",
  provenance:
    "Every tag, digest, byte size, quantization and licence below was READ from the runtime's own registry at the time above. Nothing is hand-typed. RAM figures are derived from the real weight size by the stated formula and are the only computed values here.",
  ownership:
    "These are third-party model weights. CAERA CADANE does not own them and does not claim to. The licence text for each tier is fetched and hashed above and must remain reachable from the product UI before any tier is offered for download.",
  ramFormula: ramFor(0).formula,
  tiers: results,
  unresolved: failures,
};

console.log(`\nresolved ${resolvedOrder.length}/${TIERS.length} tiers`);
if (failures.length > 0) console.log(`UNRESOLVED: ${failures.map((f) => f.tag).join(", ")}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(document, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
} else {
  console.log("(dry run — pass --write to update the manifest)");
}

if (failures.length > 0) process.exit(1);
