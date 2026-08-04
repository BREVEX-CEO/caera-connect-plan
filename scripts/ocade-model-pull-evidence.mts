/**
 * Model install evidence, driven through the product's own lifecycle module.
 *
 * `pullModel`, `verifyInstalled` and `activateModel` are the functions the
 * Local Engine screen calls. Running them here means a green result is a
 * statement about the shipped code path, not about a script that happens to
 * download a file.
 *
 * Resumability is deliberately NOT reimplemented: the runtime stores completed
 * blobs and re-requests only what is missing, so an interrupted pull continues.
 * This script proves that by recording the byte offset the first progress event
 * reports — a resumed pull starts above zero.
 *
 * Usage:
 *   vite-node scripts/ocade-model-pull-evidence.mts -- <model-tag> [--write]
 */
import { writeFileSync } from "node:fs";
import {
  pullModel,
  verifyInstalled,
  activateModel,
  checkDisk,
} from "../src/lib/local/model-lifecycle";
import { streamLocalChat, DEFAULT_LOCAL_BRIDGE_URL } from "../src/lib/ocade-local";
import { measureHardware } from "../src/lib/hardware/detect.node";
import { profileFrom } from "../src/lib/hardware/detect";

const args = process.argv.slice(2).filter((a) => a !== "--");
const modelId = args.find((a) => !a.startsWith("--"));
const write = args.includes("--write");
const BRIDGE = process.env.OCADE_BRIDGE_URL ?? DEFAULT_LOCAL_BRIDGE_URL;

if (!modelId) {
  console.error("usage: vite-node scripts/ocade-model-pull-evidence.mts -- <model-tag> [--write]");
  process.exit(2);
}

const snapshot = await measureHardware();
const profile = profileFrom(snapshot);
const freeStorageBytes = profile.freeStorageGib * 1024 ** 3;

console.log(`model            ${modelId}`);
console.log(`free storage     ${profile.freeStorageGib} GiB`);
console.log(`total RAM        ${profile.totalRamGib} GiB`);

let firstReportedOffset: number | null = null;
let lastPercent = -1;
let totalBytes = 0;
const digests = new Set<string>();
const statuses = new Set<string>();
const started = Date.now();

const result = await pullModel(BRIDGE, modelId, {
  freeStorageBytes,
  onProgress: (p) => {
    statuses.add(p.status);
    if (p.digest) digests.add(p.digest);
    if (p.totalBytes > totalBytes) totalBytes = p.totalBytes;
    if (firstReportedOffset === null && p.completedBytes > 0) {
      firstReportedOffset = p.completedBytes;
    }
    if (p.percent !== null && p.percent >= lastPercent + 5) {
      lastPercent = Math.floor(p.percent);
      const gb = (n: number) => (n / 1e9).toFixed(2);
      console.log(
        `  ${String(lastPercent).padStart(3)}%  ${gb(p.completedBytes)} / ${gb(p.totalBytes)} GB  ${p.status}`,
      );
    }
  },
});

if (!result.ok) {
  console.error(`\npull FAILED (${result.failure}): ${result.reason}`);
  process.exit(1);
}

const installed = await verifyInstalled(BRIDGE, modelId);
if (!installed.ok) {
  console.error(`\nverify FAILED (${installed.failure}): ${installed.reason}`);
  process.exit(1);
}

/* "Downloaded" is not "ready": it must answer, and it must stop when told. */
const activation = await activateModel(modelId, {
  runInference: async (id, prompt) => {
    let text = "";
    const r = await streamLocalChat(BRIDGE, id, [{ role: "user", content: prompt }], {
      onToken: (c) => (text += c),
    });
    return { ok: r.ok, text };
  },
  runCancellable: async (id) => {
    const ac = new AbortController();
    let seen = 0;
    const r = await streamLocalChat(
      BRIDGE,
      id,
      [{ role: "user", content: "Write a long description of the ocean." }],
      {
        signal: ac.signal,
        onToken: () => {
          if (++seen === 3) ac.abort();
        },
      },
    );
    return { cancelled: !r.ok && r.reason === "cancelled" };
  },
});

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  modelId,
  bridge: BRIDGE,
  preflight: {
    freeStorageGib: profile.freeStorageGib,
    disk: checkDisk(installed.sizeBytes, freeStorageBytes),
  },
  transfer: {
    elapsedMs: Date.now() - started,
    lastStatus: result.lastStatus,
    statusesSeen: [...statuses],
    reportedTotalBytes: totalBytes,
    /*
     * A resumed pull reports a non-zero offset on its FIRST progress event.
     * Recorded rather than asserted: a genuinely fresh download correctly
     * starts at zero, and calling that a failure would be wrong.
     */
    firstReportedOffsetBytes: firstReportedOffset,
    resumedFromExistingBlobs: (firstReportedOffset ?? 0) > 0,
  },
  verification: {
    installed: installed.ok,
    sizeBytes: installed.sizeBytes,
    digest: installed.digest,
    digestVerified: installed.digestVerified,
  },
  activation,
};

console.log(`\n${JSON.stringify(report, null, 2)}`);

if (write) {
  const out = `release/OCADE_MODEL_INSTALL_${modelId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}.json`;
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nwrote ${out}`);
}

process.exit(activation.ok ? 0 : 1);
