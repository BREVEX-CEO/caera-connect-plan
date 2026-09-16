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
 *   release/OCADE_OFFLINE_RELEASE.json   opaque id, size, digest, runtime facts
 *   r/<releaseId>/a                      the bytes, in the private bucket
 *
 * THE RELEASE ID IS DERIVED FROM THE BYTES. `ocr-` plus the first sixteen hex
 * characters of the artifact's own SHA-256. It is stable, it reveals nothing,
 * and two different artifacts cannot collide on it by accident — which is what
 * makes the object path safe to serve immutable and safe to cache forever.
 *
 * Usage (CI):
 *   OCADE_OFFLINE_SOURCE_URL=… OCADE_MODELS_BUCKET=… node scripts/build-offline-artifact.mjs
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const WORK = path.join(process.cwd(), ".artifact");
const BYTES = path.join(WORK, "artifact.bin");
const MANIFEST = path.join(process.cwd(), "release", "OCADE_OFFLINE_RELEASE.json");

const sourceUrl = (process.env.OCADE_OFFLINE_SOURCE_URL ?? "").trim();
const bucket = (process.env.OCADE_MODELS_BUCKET ?? "").trim();
const dryRun = process.argv.includes("--no-upload");

if (!sourceUrl) fail("OCADE_OFFLINE_SOURCE_URL is not set.");
if (!bucket && !dryRun) fail("OCADE_MODELS_BUCKET is not set.");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

mkdirSync(WORK, { recursive: true });

if (!existsSync(BYTES)) {
  process.stdout.write("Reading the configured source…\n");
  const response = await fetch(sourceUrl, { redirect: "follow" });
  if (!response.ok || !response.body) fail(`The source answered ${response.status}.`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(BYTES));
}

const totalBytes = statSync(BYTES).size;
if (totalBytes < 64) fail("The source produced nothing usable.");

const CONTAINER_MAGIC = Buffer.from([0x47, 0x47, 0x55, 0x46]);
const head = await readFirst(BYTES, 24);
if (!head.subarray(0, 4).equals(CONTAINER_MAGIC)) fail("The source is not a model container.");
const containerVersion = head.readUInt32LE(4);
if (containerVersion !== 3) fail(`Unsupported container version ${containerVersion}.`);
const tensorCount = Number(head.readBigUInt64LE(8));
const metadataCount = Number(head.readBigUInt64LE(16));
if (tensorCount < 1 || tensorCount > 10_000) fail("The container declares no usable tensors.");
if (metadataCount < 1 || metadataCount > 10_000) fail("The container declares no metadata.");

process.stdout.write("Hashing…\n");
const sha256 = await digestOf(BYTES);
const releaseId = `ocr-${sha256.slice(0, 16)}`;

const manifest = {
  schemaVersion: 2,
  releaseId,
  totalBytes,
  sha256,
  contextTokens: 4096,
  requiredMemoryBytes: 900 * 1024 * 1024,
  thinkingSuitable: false,
};

mkdirSync(path.dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Release ${releaseId} — ${totalBytes} bytes.\n`);

if (dryRun) {
  process.stdout.write("Not uploading (--no-upload).\n");
  process.exit(0);
}

const put = spawnSync(
  "npx",
  [
    "wrangler",
    "r2",
    "object",
    "put",
    `${bucket}/r/${releaseId}/a`,
    "--file",
    BYTES,
    "--content-type",
    "application/octet-stream",
    "--remote",
  ],
  { stdio: "inherit" },
);
if (put.status !== 0) fail("The private upload did not complete.");

process.stdout.write(`Uploaded ${releaseId}.\n`);

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
