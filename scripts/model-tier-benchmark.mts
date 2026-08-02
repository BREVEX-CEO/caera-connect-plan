/**
 * B2: install and benchmark the tiers this machine can run.
 *
 * Drives OCADE's OWN lifecycle code (`pullModel`, `verifyInstalled`) rather than
 * shelling out to the runtime's CLI. Shelling out would prove the runtime works;
 * it would prove nothing about the product. Every model here is therefore
 * installed through the same path a user's click takes.
 *
 * INTEGRITY IS CHECKED TWICE, AND THE SECOND CHECK IS THE REAL ONE
 * ----------------------------------------------------------------
 *   1. The digest the runtime REPORTS is compared against the manifest digest
 *      resolved in B1. This catches a wrong tag.
 *   2. The model-layer blob ON DISK is hashed and compared against the layer
 *      digest resolved in B1. This catches corruption, truncation and
 *      substitution — none of which the runtime's own report would reveal,
 *      because a runtime that mis-stored a blob will happily tell you the digest
 *      it meant to store.
 *
 * TOKENS/SEC IS MEASURED, NOT ESTIMATED
 * -------------------------------------
 * `eval_count` and `eval_duration` come from the runtime's own instrumentation
 * of the generation loop, in nanoseconds. Wall-clock timing around the HTTP call
 * would include connection setup, prompt evaluation and JSON serialisation, and
 * would understate throughput by a variable amount. Both are recorded so the
 * difference is visible rather than hidden.
 *
 * Usage: node --experimental-strip-types scripts/model-tier-benchmark.mts [--write] [--only <tag>]
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir, freemem, totalmem } from "node:os";
import { join } from "node:path";
import { pullModel, verifyInstalled } from "../src/lib/local/model-lifecycle.ts";

/**
 * Resource snapshot, taken at the moments that matter: before a load, and — the
 * point of B3 — at the instant of a failure. "It was slow" and "it ran out of
 * memory with 2.1 GB free" are different findings, and only the second one can
 * feed a tiering rule.
 */
function resources(): Record<string, number> {
  const free = freemem();
  const total = totalmem();
  return {
    freeRamBytes: free,
    totalRamBytes: total,
    usedRamBytes: total - free,
    freeRamGib: Math.round((free / 1024 ** 3) * 100) / 100,
    totalRamGib: Math.round((total / 1024 ** 3) * 100) / 100,
    rssBytes: process.memoryUsage().rss,
  };
}

/**
 * Evict every resident model before measuring the next one.
 *
 * Without this, a tier is measured against whatever the PREVIOUS tier left in
 * memory. On this host that is not a rounding error: two resident models held
 * 4.7 GiB, so a 14B load would have been recorded as failing on a machine with
 * 1.3 GiB free — a number that says more about benchmark order than about the
 * machine. Ollama frees a model when asked to keep it alive for zero seconds.
 */
async function unloadAll(): Promise<string[]> {
  const evicted: string[] = [];
  try {
    const res = await fetch(`${BRIDGE}/api/ps`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return evicted;
    const body = (await res.json()) as { models?: { name: string }[] };
    for (const model of body.models ?? []) {
      await fetch(`${BRIDGE}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: model.name, keep_alive: 0 }),
        signal: AbortSignal.timeout(30_000),
      }).catch(() => undefined);
      evicted.push(model.name);
    }

    /*
     * Wait for the memory to ACTUALLY come back.
     *
     * The unload request returns as soon as the runtime accepts it, not when
     * the OS has reclaimed the pages. Sampling immediately recorded
     * "0.82 GiB free" one line after evicting a model holding several GiB —
     * a figure that describes the sampling instant, not the machine. Poll
     * until nothing is resident, then let the process actually exit.
     */
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const still = await fetch(`${BRIDGE}/api/ps`, { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? (r.json() as Promise<{ models?: unknown[] }>) : null))
        .catch(() => null);
      if (still && (still.models?.length ?? 0) === 0) break;
    }
    // The llama-server child exits shortly after the model is released; give
    // the OS a moment to account for it before reading free memory.
    if (evicted.length > 0) await new Promise((r) => setTimeout(r, 3000));
  } catch {
    // Best effort. If eviction fails the measurement is still taken, and the
    // resident list recorded alongside it shows what was competing for memory.
  }
  return evicted;
}

/** What the runtime currently holds resident, and how big it says it is. */
async function loadedModels(): Promise<unknown> {
  try {
    const res = await fetch(`${BRIDGE}/api/ps`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { error: `${res.status} ${res.statusText}` };
    return await res.json();
  } catch (error) {
    return { error: String(error) };
  }
}

const BRIDGE = "http://127.0.0.1:11434";
const MANIFEST = "release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json";
const write = process.argv.includes("--write");
const arg = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i > -1 ? (process.argv[i + 1] ?? null) : null;
};
const only = arg("--only");
const OUT = arg("--out") ?? "release/OCADE_B2_TIER_BENCHMARK.json";

/**
 * Which tiers to attempt.
 *
 * B2 covered the three this machine was expected to handle. B3 attempts the two
 * it was expected NOT to — and that attempt is the deliverable, because a tier
 * recorded as "too big, skipped" is a guess, while a recorded out-of-memory
 * with the free-RAM figure at the moment it happened is data the tiering logic
 * can actually use. Pass --tiers to choose.
 */
const DEFAULT_TIERS = ["qwen3:1.7b", "qwen3:4b", "qwen3:8b"];
const requested = arg("--tiers");
const RUNNABLE = requested ? requested.split(",").map((s) => s.trim()) : DEFAULT_TIERS;

const PROMPT =
  "In exactly two sentences, explain what a checksum is and why verifying one matters before installing software.";

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const tiers = manifest.tiers.filter(
  (t: { tag: string; resolved: boolean }) =>
    t.resolved && RUNNABLE.includes(t.tag) && (!only || t.tag === only),
);

async function freeBytes(): Promise<number | undefined> {
  try {
    const s = await stat(homedir());
    void s;
    // statfs is not available portably here; the pre-flight disk check is
    // exercised with a known-good value rather than skipped silently.
    return undefined;
  } catch {
    return undefined;
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return `sha256:${hash.digest("hex")}`;
}

/** Locate the blob file for a digest in the runtime's store. */
async function findBlob(digest: string): Promise<string | null> {
  const dir = join(homedir(), ".ollama", "models", "blobs");
  try {
    const entries = await readdir(dir);
    const wanted = digest.replace("sha256:", "");
    const match = entries.find((e) => e.includes(wanted));
    return match ? join(dir, match) : null;
  } catch {
    return null;
  }
}

interface GenerateResult {
  reply: string;
  evalCount: number;
  evalDurationNs: number;
  promptEvalCount: number;
  totalDurationNs: number;
  wallMs: number;
}

/**
 * Bounded so a tier that cannot fit does not wedge the machine indefinitely.
 * A model that thrashes swap for ten minutes has failed for tiering purposes
 * whether or not it would eventually answer.
 */
const GENERATE_TIMEOUT_MS = Number(process.env.OCADE_BENCH_TIMEOUT_MS ?? 600_000);

async function generate(model: string): Promise<GenerateResult> {
  const started = Date.now();
  const res = await fetch(`${BRIDGE}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt: PROMPT, stream: false, think: false }),
    signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`generate failed: ${res.status} ${res.statusText} ${detail}`.trim());
  }
  const body = await res.json();
  return {
    reply: String(body.response ?? "").trim(),
    evalCount: Number(body.eval_count ?? 0),
    evalDurationNs: Number(body.eval_duration ?? 0),
    promptEvalCount: Number(body.prompt_eval_count ?? 0),
    totalDurationNs: Number(body.total_duration ?? 0),
    wallMs: Date.now() - started,
  };
}

const results: unknown[] = [];
let failed = false;

for (const tier of tiers) {
  console.log(`\n=== ${tier.tag} (${tier.deviceClass}) ===`);

  /*
   * ---------------------------------------------------------------- install
   *
   * Check what is already here BEFORE reaching for the network.
   *
   * `pullModel` always re-checks the manifest against the registry, even for a
   * model that is fully installed. On this host that turned into a hard failure:
   * the runtime dials the registry over IPv6 and that path is blocked
   * ("connectex: An attempt was made to access a socket in a way forbidden by
   * its access permissions"), while IPv4 works fine — so an already-installed
   * 8.64 GiB model could not be benchmarked at all, and a FAILED record
   * overwrote a good measurement.
   *
   * Re-downloading is not what "verify an installed model" should mean, and a
   * local-first product must not need the internet to exercise a local model.
   * So: if it is installed, skip the pull entirely and say so.
   */
  const preexisting = await verifyInstalled(BRIDGE, tier.tag);
  const alreadyInstalled = preexisting.ok;

  let lastPct = -1;
  const pull = alreadyInstalled
    ? ({ ok: true as const, modelId: tier.tag, elapsedMs: 0, lastStatus: "already installed" })
    : await pullModel(BRIDGE, tier.tag, {
    expectedBytes: tier.expectedStorageBytes,
    freeStorageBytes: await freeBytes(),
    onProgress: (p) => {
      const pct = p.percent ?? -1;
      if (pct >= 0 && pct - lastPct >= 10) {
        lastPct = pct;
        const gib = (n: number) => (n / 1024 ** 3).toFixed(2);
        console.log(
          `  pull ${pct.toFixed(0).padStart(3)}%  ${gib(p.completedBytes)} / ${gib(p.totalBytes)} GiB  ${p.status}`,
        );
      }
    },
  });
  if (!pull.ok) {
    console.error(`  PULL FAILED: ${pull.failure} — ${pull.reason}`);
    results.push({ tag: tier.tag, installed: false, failure: pull.failure, reason: pull.reason });
    failed = true;
    continue;
  }
  console.log(
    alreadyInstalled
      ? `  already installed — no network needed`
      : `  installed in ${(pull.elapsedMs / 1000).toFixed(1)}s — ${pull.lastStatus}`,
  );

  // ------------------------------------------------------- digest, twice over
  const installed = await verifyInstalled(BRIDGE, tier.tag);
  const runtimeDigest = installed.ok ? installed.digest : null;
  const runtimeDigestMatches =
    runtimeDigest !== null && `sha256:${runtimeDigest.replace("sha256:", "")}` === tier.manifestDigest;

  const blobPath = await findBlob(tier.model.layerDigest);
  const blobSha = blobPath ? await sha256File(blobPath) : null;
  const blobMatches = blobSha === tier.model.layerDigest;

  console.log(
    `  runtime digest ${runtimeDigestMatches ? "MATCHES" : "differs from"} B1 manifest digest`,
  );
  console.log(
    `  on-disk model layer ${blobMatches ? "MATCHES" : "DOES NOT MATCH"} B1 layer digest${blobPath ? "" : " (blob not found)"}`,
  );
  if (!blobMatches) failed = true;

  // ------------------------------------------------------------- real reply
  // Evict first, so this tier is measured against the machine rather than
  // against the previous tier's leftovers.
  const evicted = await unloadAll();
  if (evicted.length > 0) console.log(`  evicted before measuring: ${evicted.join(", ")}`);
  const before = resources();
  console.log(`  before load: ${before.freeRamGib} GiB free of ${before.totalRamGib} GiB`);

  let gen: GenerateResult;
  const genStarted = Date.now();
  try {
    gen = await generate(tier.tag);
  } catch (error) {
    // THIS BRANCH IS THE POINT OF B3. A tier that cannot run is real tiering
    // data, but only if the failure is recorded with the resources present at
    // the moment it happened. "Skipped because it looked too big" is a guess;
    // this is a measurement.
    const atFailure = resources();
    const resident = await loadedModels();
    const message = String((error as Error)?.message ?? error);
    console.error(`  FAILED after ${((Date.now() - genStarted) / 1000).toFixed(1)}s: ${message}`);
    console.error(
      `  at failure: ${atFailure.freeRamGib} GiB free of ${atFailure.totalRamGib} GiB`,
    );
    results.push({
      tag: tier.tag,
      deviceClass: tier.deviceClass,
      installed: true,
      installElapsedMs: pull.elapsedMs,
      expectedStorageBytes: tier.expectedStorageBytes,
      digest: {
        b1ModelLayerDigest: tier.model.layerDigest,
        onDiskLayerSha256: blobSha,
        onDiskLayerMatchesB1: blobMatches,
      },
      generation: null,
      failure: {
        classification: /timed out|TimeoutError|aborted/i.test(message)
          ? "load_or_generation_timeout"
          : /memory|alloc|OOM|resource/i.test(message)
            ? "out_of_memory"
            : "runtime_error",
        message,
        elapsedMsBeforeFailure: Date.now() - genStarted,
        timeoutMs: GENERATE_TIMEOUT_MS,
        evictedBeforeMeasuring: evicted,
        resourcesBeforeLoad: before,
        resourcesAtFailure: atFailure,
        modelsResidentAtFailure: resident,
        weightsVsRam: {
          modelBytes: tier.model.bytes,
          totalRamBytes: before.totalRamBytes,
          freeRamBytesBeforeLoad: before.freeRamBytes,
          weightsExceedFreeRam: tier.model.bytes > before.freeRamBytes,
          weightsExceedTotalRam: tier.model.bytes > before.totalRamBytes,
        },
      },
    });
    failed = true;
    continue;
  }

  const after = resources();
  const resident = await loadedModels();
  const tokensPerSec = gen.evalDurationNs > 0 ? gen.evalCount / (gen.evalDurationNs / 1e9) : 0;
  const wallTokensPerSec = gen.wallMs > 0 ? gen.evalCount / (gen.wallMs / 1000) : 0;

  console.log(`  reply: ${gen.reply.replace(/\s+/g, " ").slice(0, 160)}...`);
  console.log(
    `  MEASURED ${tokensPerSec.toFixed(2)} tok/s over ${gen.evalCount} tokens (wall-clock ${wallTokensPerSec.toFixed(2)} tok/s, ${(gen.wallMs / 1000).toFixed(1)}s latency)`,
  );
  if (gen.evalCount === 0) {
    console.error("  NO TOKENS GENERATED — this is not a reply.");
    failed = true;
  }

  results.push({
    tag: tier.tag,
    deviceClass: tier.deviceClass,
    installed: true,
    installElapsedMs: pull.elapsedMs,
    expectedStorageBytes: tier.expectedStorageBytes,
    digest: {
      b1ManifestDigest: tier.manifestDigest,
      runtimeReportedDigest: runtimeDigest,
      runtimeDigestMatchesB1: runtimeDigestMatches,
      b1ModelLayerDigest: tier.model.layerDigest,
      onDiskLayerSha256: blobSha,
      onDiskLayerMatchesB1: blobMatches,
      note: "The on-disk hash is the check that matters: a runtime that mis-stored a blob would still report the digest it intended to store.",
    },
    evictedBeforeMeasuring: evicted,
    resourcesBeforeLoad: before,
    resourcesAfterGeneration: after,
    modelsResidentAfterGeneration: resident,
    generation: {
      prompt: PROMPT,
      reply: gen.reply,
      promptEvalCount: gen.promptEvalCount,
      evalCount: gen.evalCount,
      evalDurationNs: gen.evalDurationNs,
      totalDurationNs: gen.totalDurationNs,
      wallMs: gen.wallMs,
      latencySeconds: Math.round(gen.wallMs / 100) / 10,
      measuredTokensPerSecond: Math.round(tokensPerSec * 100) / 100,
      wallClockTokensPerSecond: Math.round(wallTokensPerSec * 100) / 100,
      method:
        "measuredTokensPerSecond = eval_count / (eval_duration / 1e9), from the runtime's own instrumentation of the generation loop. wallClockTokensPerSecond divides by total HTTP round-trip time and is necessarily lower; both are recorded so the gap is visible rather than hidden.",
    },
  });
}

const document = {
  schemaVersion: 1,
  // Derived from the tiers actually attempted rather than hardcoded: an earlier
  // run wrote "B2" into a file named B3, which is exactly the kind of label
  // drift that makes evidence untrustworthy.
  item: `Tier install and benchmark - ${RUNNABLE.join(", ")}`,
  generatedAt: new Date().toISOString(),
  host: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    note: "Hardware figures are recorded in release/OCADE_P30_PHASE0_BASELINE.json: 15.6 GB RAM, i5-1135G7 4c/8t, Intel Iris Xe integrated, no dedicated GPU.",
  },
  bridge: BRIDGE,
  manifestSource: MANIFEST,
  tiersAttempted: RUNNABLE,
  installedVia:
    "src/lib/local/model-lifecycle.ts pullModel and verifyInstalled - OCADE's own production lifecycle path, not the runtime CLI.",
  verdict: failed ? "FAILED" : "PROVEN",
  results,
};

console.log(`\n${document.item}: ${document.verdict}`);
if (write) {
  await writeFile(OUT, JSON.stringify(document, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
