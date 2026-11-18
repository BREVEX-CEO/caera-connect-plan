#!/usr/bin/env node
/**
 * PREPARE ONE OFFLINE INTELLIGENCE RELEASE AND PUT IT WHERE OCADE SERVES IT FROM.
 *
 * Runs in CI, never in a customer's browser and never on a developer's laptop
 * by accident: it needs a source, a bucket and a Cloudflare token, and it
 * refuses without all three.
 *
 * WHY THE SOURCE IS AN ENVIRONMENT VARIABLE AND NOT A CONSTANT. Where the
 * upstream weights are built from is deployment configuration, not a fact the
 * repository is allowed to carry — `CLAUDE.md`'s identity rule is explicit that
 * tracked source and customer surfaces use opaque OCADE identifiers only. So
 * this script is told where to read from and never writes that anywhere: not
 * into the manifest, not into an object name, not into its own output.
 *
 * WHAT IT PRODUCES
 *
 *   release/OCADE_OFFLINE_RELEASE.json   opaque id, sizes, digests, runtime facts
 *   .artifact/artifact.bin               both parts back to back, for the proof
 *   models/lfm25-vl-450m-q5/<digest>     each part, in the private bucket
 *
 * TWO PARTS, ONE ARTIFACT. The language weights and the vision projector are
 * separate GGUF files. The browser receives them as one opaque artifact (the
 * delivery route serves both objects as one byte range space), so the installer
 * keeps a single resumable, digest-checked transfer. Each part's own digest is
 * recorded; the whole-artifact digest pins both.
 *
 * THE RELEASE ID IS DERIVED FROM THE BYTES. `ocr-` plus the first sixteen hex
 * characters of the artifact's own SHA-256.
 *
 * Usage (CI):
 *   OCADE_OFFLINE_SOURCE_URL=… OCADE_OFFLINE_PROJECTOR_URL=… OCADE_MODELS_BUCKET=… \
 *     node scripts/build-offline-artifact.mjs
 */
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const WORK = path.join(process.cwd(), ".artifact");
const BYTES = path.join(WORK, "artifact.bin");
const MANIFEST = path.join(process.cwd(), "release", "OCADE_OFFLINE_RELEASE.json");

const sources = [
  (process.env.OCADE_OFFLINE_SOURCE_URL ?? "").trim(),
  (process.env.OCADE_OFFLINE_PROJECTOR_URL ?? "").trim(),
];
/** Server-side object prefix; must equal OFFLINE_OBJECT_PREFIX in offline-objects.server.ts. */
const OBJECT_PREFIX = "models/lfm25-vl-450m-q5/";
const bucket = (process.env.OCADE_MODELS_BUCKET ?? "").trim();
const dryRun = process.argv.includes("--no-upload");

if (!sources[0]) fail("OCADE_OFFLINE_SOURCE_URL is not set.");
if (!sources[1]) fail("OCADE_OFFLINE_PROJECTOR_URL is not set.");
if (!bucket && !dryRun) fail("OCADE_MODELS_BUCKET is not set.");

function fail(message) {
  // Deliberately never echoes the source URL: a failure message is a log line,
  // and a log line is forever.
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/* ------------------------------------------------------------- the bytes -- */

mkdirSync(WORK, { recursive: true });

/*
 * CACHED BYTES ARE REUSED ONLY WHEN THEY ARE KNOWN COMPLETE, FROM THIS SOURCE.
 * A record beside each part names the source and the length it delivered; a
 * file left by another source or a cut-off transfer is fetched again (F-013).
 */
async function fetchPart(sourceUrl, file) {
  const record = `${file}.source.json`;
  const cached = (() => {
    try {
      const saved = JSON.parse(readFileSync(record, "utf8"));
      return saved.url === sourceUrl && statSync(file).size === saved.bytes;
    } catch {
      return false;
    }
  })();
  if (cached) return;
  process.stdout.write("Reading a configured source…\n");
  const response = await fetch(sourceUrl, { redirect: "follow" });
  if (!response.ok || !response.body) fail(`A source answered ${response.status}.`);
  const promised = Number(response.headers.get("content-length") ?? NaN);
  const partial = `${file}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  const got = statSync(partial).size;
  if (Number.isFinite(promised) && got !== promised) fail("A source transfer was cut short.");
  renameSync(partial, file);
  writeFileSync(record, JSON.stringify({ url: sourceUrl, bytes: got }));
}

/**
 * The structural check, per part.
 *
 * Not a substitute for running it — the generation proof in the same workflow
 * does that — but it catches the failure that actually happens: an HTML error
 * page, a Git LFS pointer or a truncated transfer saved under the right name.
 */
const CONTAINER_MAGIC = Buffer.from([0x47, 0x47, 0x55, 0x46]);
async function checkContainer(file) {
  if (statSync(file).size < 64) fail("A source produced nothing usable.");
  const head = await readFirst(file, 24);
  if (!head.subarray(0, 4).equals(CONTAINER_MAGIC)) fail("A source is not a model container.");
  const containerVersion = head.readUInt32LE(4);
  if (containerVersion !== 3) fail(`Unsupported container version ${containerVersion}.`);
  const tensorCount = Number(head.readBigUInt64LE(8));
  const metadataCount = Number(head.readBigUInt64LE(16));
  if (tensorCount < 1 || tensorCount > 10_000) fail("A container declares no usable tensors.");
  if (metadataCount < 1 || metadataCount > 10_000) fail("A container declares no metadata.");
}

const PART_FILES = [path.join(WORK, "part-0.bin"), path.join(WORK, "part-1.bin")];
const parts = [];
for (const [index, file] of PART_FILES.entries()) {
  await fetchPart(sources[index], file);
  await checkContainer(file);
  parts.push({ bytes: statSync(file).size, sha256: await digestOf(file) });
}

/* ------------------------------------------------------ the whole artifact -- */

process.stdout.write("Joining and hashing…\n");
await pipeline(async function* () {
  for (const file of PART_FILES) yield* createReadStream(file);
}, createWriteStream(BYTES));
const totalBytes = statSync(BYTES).size;
if (totalBytes !== parts[0].bytes + parts[1].bytes) fail("The joined artifact has the wrong size.");
const sha256 = await digestOf(BYTES);
const releaseId = `ocr-${sha256.slice(0, 16)}`;

/* ---------------------------------------------------------- the manifest -- */

/**
 * What the browser is told, and nothing more.
 *
 * No repository, no file name, no publisher, no quantisation, no vendor. An
 * opaque id, a length, a digest, and the two runtime numbers the installer
 * needs to refuse honestly before it starts: how much storage the transfer
 * needs and how much memory running it needs.
 */
const manifest = {
  schemaVersion: 3,
  releaseId,
  totalBytes,
  sha256,
  /** Language weights, then the vision projector. */
  parts,
  /** Tokens of context the engine is configured for. */
  contextTokens: 4096,
  /** Working set while running, measured generously. Weights plus KV cache. */
  requiredMemoryBytes: 900 * 1024 * 1024,
  /**
   * Whether deliberating before answering earns its cost here. False: this
   * release has no deliberation mode, and on a device this size extra tokens
   * lengthen the wait without improving the answer.
   */
  thinkingSuitable: false,
  /**
   * Set only by `prove-offline-artifact.mjs --record` after its image PASS,
   * and kept on a rebuild of the same bytes, whose release id is unchanged.
   */
  vision: previousVision(releaseId),
};

function previousVision(id) {
  try {
    const previous = JSON.parse(readFileSync(MANIFEST, "utf8"));
    return previous.releaseId === id && previous.vision === true;
  } catch {
    return false;
  }
}

mkdirSync(path.dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Release ${releaseId} — ${totalBytes} bytes.\n`);

/* ------------------------------------------------------------ the upload -- */

if (dryRun) {
  process.stdout.write("Not uploading (--no-upload).\n");
  process.exit(0);
}

/*
 * EACH PART UNDER THE SERVER'S PREFIX, NAMED BY ITS OWN DIGEST. The delivery
 * route finds a part by its exact size there and serves both as one range
 * space, so no second naming scheme reaches the browser.
 */
for (const [index, file] of PART_FILES.entries()) {
  const put = spawnSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${OBJECT_PREFIX}${parts[index].sha256}`,
      "--file",
      file,
      "--content-type",
      "application/octet-stream",
      "--remote",
    ],
    { stdio: "inherit" },
  );
  if (put.status !== 0) fail("The private upload did not complete.");
}

/*
 * The manifest is NOT uploaded beside the bytes. It is committed, reviewed in a
 * diff, and served from the deployment — one copy, one truth. A second copy in
 * the bucket is a second thing that can disagree with what shipped.
 */

process.stdout.write(`Uploaded ${releaseId}.\n`);

/* ----------------------------------------------------------------- utils -- */

async function readFirst(file, bytes) {
  const chunks = [];
  let read = 0;
  for await (const chunk of createReadStream(file, { start: 0, end: bytes - 1 })) {
    chunks.push(chunk);
    read += chunk.length;
    if (read >= bytes) break;
  }
  return Buffer.concat(chunks).subarray(0, bytes);
}

async function digestOf(file) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}
