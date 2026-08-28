/**
 * PRODUCTION-WEIGHT PROOF FOR THE WHOLE INSTALL PATH.
 *
 * Mocks are not enough for this one. A chunked, resumable, incrementally-hashed
 * transfer has failure modes that only appear at real size and over a real
 * socket: a checkpoint that is one chunk out is invisible at 64 KiB and
 * catastrophic at a gigabyte; a digest state restored from the wrong offset
 * produces a mismatch that unit tests with tiny artifacts never reach; a
 * writer whose flushes are too rare loses minutes rather than milliseconds.
 *
 * So this runs the SHIPPED code — `transferModel`, `ModelVault`,
 * `ModelInstallationAuthority` — against:
 *
 *   - a real HTTP server that speaks Range, over a real socket;
 *   - a real artifact of production weight, written to a real disk;
 *   - a real mid-transfer connection failure;
 *   - real SHA-256 verification, checked against Node's own crypto;
 *   - real files on a real filesystem, through the ModelStore contract.
 *
 * WHAT IS SUBSTITUTED, AND WHY IT IS HONEST TO. OPFS, because it exists only
 * inside a browser. `ModelStore` is an interface the authority already accepts
 * by injection, and the implementation below is backed by `node:fs` with the
 * same contract — positioned writes, a size query, a streaming read. Everything
 * about the transfer, the hashing, the checkpointing, the versioned pointer,
 * activation, uninstall and reinstall is the real thing.
 *
 * Run: npx vite-node scripts/e2e/model-install-production-proof.mts -- --write
 */

import http from "node:http";
import { createHash, webcrypto } from "node:crypto";
import {
  mkdirSync,
  rmSync,
  existsSync,
  statSync,
  openSync,
  writeSync,
  closeSync,
  fsyncSync,
  createReadStream,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

if (!globalThis.crypto) (globalThis as { crypto?: Crypto }).crypto = webcrypto as unknown as Crypto;

import { transferModel, type TransferCheckpoint } from "../../src/lib/brain/model-transfer";
import { ModelVault, type ModelFileWriter } from "../../src/lib/brain/model-vault";
import { ModelInstallationAuthority } from "../../src/lib/brain/installation-authority";
import { sha256OfBlobStreaming } from "../../src/lib/brain/streaming-digest";
import { planTransfer } from "../../src/lib/brain/download-plan";
import type { ModelStore } from "../../src/lib/brain/model-store";

const WRITE = process.argv.includes("--write");
const ROOT = process.cwd();
const WORK = resolve(ROOT, ".proof/model-install");
const OUT = "release/OCADE_MODEL_INSTALL_PROOF.json";

/**
 * Production weight.
 *
 * The shipped compatibility engine is 1,117,320,736 bytes. This uses the same
 * order of magnitude so the chunk count, the checkpoint cadence and the hashing
 * cost are the real ones; `--quick` exists for a smoke run and is NOT what the
 * recorded proof is taken from.
 */
const ARTIFACT_BYTES = process.argv.includes("--quick") ? 64 * 1024 * 1024 : 1_117_320_736;

const log = (...parts: unknown[]) => console.log(...parts);
const ms = (n: number) => `${(n / 1000).toFixed(2)}s`;
const mbps = (bytes: number, millis: number) =>
  `${(bytes / (1024 * 1024) / (millis / 1000)).toFixed(1)} MiB/s`;

/* ------------------------------------------------------------- the disk -- */

/**
 * A `ModelStore` backed by real files.
 *
 * Positioned writes through a held file descriptor, `fsync` on flush. That is
 * the same shape OPFS's sync access handle gives, which is the fast path the
 * browser build uses, so what this exercises is the real writer contract rather
 * than a friendlier one.
 */
function diskStore(base: string): ModelStore {
  const pathFor = (key: string) => join(base, ...key.split("/").filter(Boolean));

  const openWriter = async (key: string): Promise<ModelFileWriter> => {
    const file = pathFor(key);
    mkdirSync(dirname(file), { recursive: true });
    let fd = openSync(file, existsSync(file) ? "r+" : "w+");
    return {
      async write(chunk, at) {
        try {
          writeSync(fd, chunk, 0, chunk.length, at);
          return true;
        } catch {
          return false;
        }
      },
      async flush() {
        try {
          fsyncSync(fd);
          return true;
        } catch {
          return false;
        }
      },
      async close() {
        try {
          fsyncSync(fd);
        } catch {
          /* nothing to sync */
        }
        try {
          closeSync(fd);
        } catch {
          /* already closed */
        }
        fd = -1;
      },
    };
  };

  const meta = new Map<string, unknown>();

  const walk = (
    dir: string,
    prefix: string,
    out: { key: string; bytes: number; verified: boolean }[],
  ) => {
    if (!existsSync(dir)) return;
    for (const entry of require("node:fs").readdirSync(dir, { withFileTypes: true })) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, key, out);
      else out.push({ key, bytes: statSync(full).size, verified: false });
    }
  };

  return {
    async sizeOf(key: string) {
      const file = pathFor(key);
      return existsSync(file) ? statSync(file).size : 0;
    },
    async append(key: string, chunk: Uint8Array, at: number) {
      const writer = await openWriter(key);
      const ok = await writer.write(chunk, at);
      await writer.close();
      return ok;
    },
    openWriter,
    async movePath(from: string, to: string) {
      const source = pathFor(from);
      if (!existsSync(source)) return false;
      const target = pathFor(to);
      mkdirSync(dirname(target), { recursive: true });
      require("node:fs").renameSync(source, target);
      return true;
    },
    async readBlob(key: string) {
      const file = pathFor(key);
      if (!existsSync(file)) return null;
      const size = statSync(file).size;
      /*
       * A Blob-alike that STREAMS. Reading a gigabyte with `readFileSync` here
       * would prove the opposite of what this harness is for -- the whole point
       * of the streaming digest is that the artifact is never materialised.
       */
      return {
        size,
        stream() {
          const nodeStream = createReadStream(file, { highWaterMark: 8 * 1024 * 1024 });
          const iterator = nodeStream[Symbol.asyncIterator]();
          return new ReadableStream<Uint8Array>({
            async pull(controller) {
              const { done, value } = await iterator.next();
              if (done) controller.close();
              else controller.enqueue(new Uint8Array(value));
            },
          });
        },
      } as unknown as Blob;
    },
    async remove(key: string) {
      const file = pathFor(key);
      if (!existsSync(file)) return false;
      rmSync(file, { force: true });
      meta.delete(key);
      return true;
    },
    async readMeta(key: string) {
      return (meta.get(key) ?? null) as never;
    },
    async writeMeta(key: string, value: unknown) {
      if (value === null) meta.delete(key);
      else meta.set(key, value);
    },
    async list() {
      const out: { key: string; bytes: number; verified: boolean }[] = [];
      walk(base, "", out);
      return out;
    },
  } as unknown as ModelStore;
}

/** localStorage, in memory, with the same contract the vault expects. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/* ---------------------------------------------------------- the artifact -- */

/**
 * A production-weight artifact on disk, and its true digest.
 *
 * Generated deterministically and hashed with NODE's crypto, not with the
 * implementation under test. If the streaming digest disagrees with this, the
 * streaming digest is wrong — which is the entire point of comparing against an
 * independent implementation rather than against itself.
 */
function makeArtifact(path: string, bytes: number): string {
  mkdirSync(dirname(path), { recursive: true });
  const hash = createHash("sha256");
  const fd = openSync(path, "w");
  const block = Buffer.allocUnsafe(8 * 1024 * 1024);
  let written = 0;
  let seed = 0x12345678;
  while (written < bytes) {
    const size = Math.min(block.length, bytes - written);
    for (let i = 0; i < size; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      block.writeUInt32LE(seed, i);
    }
    const slice = block.subarray(0, size);
    writeSync(fd, slice, 0, size);
    hash.update(slice);
    written += size;
  }
  closeSync(fd);
  return hash.digest("hex");
}

/* ------------------------------------------------------------ the server -- */

interface ServerHandle {
  url: string;
  close: () => Promise<void>;
  requests: () => number;
  /** Kill every in-flight response after this many bytes total. */
  breakAfterBytes: (bytes: number | null) => void;
}

/** A real HTTP server that speaks Range and can be told to drop connections. */
async function serveArtifact(path: string): Promise<ServerHandle> {
  const size = statSync(path).size;
  let requests = 0;
  let served = 0;
  let breakAt: number | null = null;

  const server = http.createServer((req, res) => {
    requests += 1;
    const range = req.headers.range;
    const match = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;

    if (!match) {
      res.writeHead(200, { "content-length": String(size), "accept-ranges": "bytes" });
      createReadStream(path).pipe(res);
      return;
    }

    const start = Number(match[1]);
    const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    if (start >= size) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      res.end();
      return;
    }

    res.writeHead(206, {
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": String(end - start + 1),
      "accept-ranges": "bytes",
    });

    const stream = createReadStream(path, { start, end });
    stream.on("data", (chunk) => {
      served += chunk.length;
      if (breakAt !== null && served >= breakAt) {
        // A real socket destruction, mid-response: what a lift or a handover
        // actually does to a transfer.
        stream.destroy();
        res.destroy();
        return;
      }
      if (!res.write(chunk)) stream.pause();
    });
    stream.on("end", () => res.end());
    res.on("drain", () => stream.resume());
    res.on("close", () => stream.destroy());
  });

  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}/engine`,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections?.();
        server.close(() => done());
      }),
    requests: () => requests,
    breakAfterBytes: (bytes) => {
      breakAt = bytes;
      served = 0;
    },
  };
}

/* --------------------------------------------------------------- the run -- */

interface Measurement {
  step: string;
  ms: number;
  detail?: Record<string, unknown>;
}

async function main() {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });

  const measurements: Measurement[] = [];
  const record = (step: string, millis: number, detail?: Record<string, unknown>) => {
    measurements.push({ step, ms: Math.round(millis), detail });
    log(`  ${step}: ${ms(millis)}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  };

  log(`\nBuilding a production-weight artifact (${(ARTIFACT_BYTES / 1024 ** 3).toFixed(2)} GiB)…`);
  const artifactPath = join(WORK, "source", "engine.bin");
  let t = performance.now();
  const trueDigest = makeArtifact(artifactPath, ARTIFACT_BYTES);
  record("generate artifact", performance.now() - t, { sha256: trueDigest.slice(0, 16) });

  const server = await serveArtifact(artifactPath);
  const storeDir = join(WORK, "store");
  const store = diskStore(storeDir);
  const storage = memoryStorage();
  const vault = new ModelVault({ store, storage });
  const version = "proof-engine-v1";

  const failures: string[] = [];
  const expect = (condition: boolean, what: string) => {
    if (condition) log(`  PASS  ${what}`);
    else {
      log(`  FAIL  ${what}`);
      failures.push(what);
    }
  };

  const plan = planTransfer({ deviceMemoryGb: 8, cores: 8, downlinkMbps: 100 });
  log(
    `\nTransfer plan: ${plan.concurrency} connections, ${(plan.chunkBytes / 1024 ** 2).toFixed(0)} MiB chunks (${plan.because})`,
  );

  /* -------- 1. First install, interrupted partway through ---------------- */

  log("\n1. First install, interrupted mid-transfer");
  server.breakAfterBytes(Math.floor(ARTIFACT_BYTES * 0.35));
  let writer = await vault.openWriter(version);
  t = performance.now();
  const interrupted = await transferModel(
    {
      sources: [{ url: server.url, kind: "ocade_cdn" }],
      totalBytes: ARTIFACT_BYTES,
      sha256: trueDigest,
      plan,
      maxAttemptsPerChunk: 2,
      onCheckpoint: (checkpoint) => {
        vault.patchMeta(version, {
          expectedBytes: ARTIFACT_BYTES,
          sha256: trueDigest,
          digest: checkpoint.digest ?? undefined,
          contiguousChunks: checkpoint.contiguousChunks,
          chunkBytes: checkpoint.chunkBytes,
        });
      },
    },
    { fetchImpl: globalThis.fetch, writer: writer! },
  );
  await writer!.close();
  const interruptMs = performance.now() - t;

  expect(!interrupted.ok, "an interrupted transfer reports a failure rather than success");
  const savedCheckpoint = !interrupted.ok ? interrupted.checkpoint : null;
  expect(savedCheckpoint !== null, "it hands back a checkpoint instead of losing everything");
  const resumeFrom = (savedCheckpoint?.contiguousChunks ?? 0) * (savedCheckpoint?.chunkBytes ?? 0);
  record("interrupted transfer", interruptMs, {
    resumableBytes: resumeFrom,
    fraction: `${((resumeFrom / ARTIFACT_BYTES) * 100).toFixed(1)}%`,
  });
  expect(resumeFrom > 0, "the checkpoint covers real bytes");

  /* -------- 2. Resume from the checkpoint ------------------------------- */

  log("\n2. Resume");
  server.breakAfterBytes(null);
  const requestsBeforeResume = server.requests();
  writer = await vault.openWriter(version);
  t = performance.now();
  const resumed = await transferModel(
    {
      sources: [{ url: server.url, kind: "ocade_cdn" }],
      totalBytes: ARTIFACT_BYTES,
      sha256: trueDigest,
      plan,
      resume: savedCheckpoint as TransferCheckpoint,
      onCheckpoint: (checkpoint) => {
        vault.patchMeta(version, {
          expectedBytes: ARTIFACT_BYTES,
          sha256: trueDigest,
          digest: checkpoint.digest ?? undefined,
          contiguousChunks: checkpoint.contiguousChunks,
          chunkBytes: checkpoint.chunkBytes,
        });
      },
    },
    { fetchImpl: globalThis.fetch, writer: writer! },
  );
  await writer!.close();
  const resumeMs = performance.now() - t;

  expect(resumed.ok, "the resumed transfer completes");
  if (resumed.ok) {
    expect(resumed.verified, "and it is VERIFIED against the published digest");
    expect(resumed.digest === trueDigest, "the streaming digest equals Node's own SHA-256");
    expect(
      resumed.resumedFromBytes === resumeFrom,
      "it resumed at exactly the checkpointed offset, re-fetching nothing before it",
    );
    record("resume to complete", resumeMs, {
      transferred: ARTIFACT_BYTES - resumeFrom,
      throughput: mbps(ARTIFACT_BYTES - resumeFrom, resumeMs),
      retries: resumed.metrics.retries,
      ranged: resumed.metrics.ranged,
      concurrency: resumed.metrics.finalConcurrency,
    });
  }

  /* -------- 3. Integrity of what is actually on disk --------------------- */

  log("\n3. Integrity of the file on disk");
  const onDisk = await vault.bytesOf(version);
  expect(onDisk === ARTIFACT_BYTES, "the stored file is exactly the published size");

  t = performance.now();
  const blob = await vault.readArtifact(version);
  const streamedDigest = blob ? await sha256OfBlobStreaming(blob) : null;
  const verifyMs = performance.now() - t;
  expect(streamedDigest === trueDigest, "re-reading it from disk reproduces the same digest");
  record("independent verification", verifyMs, {
    throughput: mbps(ARTIFACT_BYTES, verifyMs),
  });

  // And an entirely independent check, straight from the filesystem.
  const independent = createHash("sha256");
  await new Promise<void>((done, fail) => {
    createReadStream(join(storeDir, "versions", version, `${version}.bin`))
      .on("data", (c) => independent.update(c))
      .on("end", done)
      .on("error", fail);
  });
  expect(independent.digest("hex") === trueDigest, "and node:crypto agrees, reading the raw file");

  /* -------- 4. Activation --------------------------------------------- */

  log("\n4. Activation");
  vault.writeMeta(version, { verified: true, expectedBytes: ARTIFACT_BYTES, sha256: trueDigest });
  expect(await vault.activate(version), "a verified version activates");
  expect(vault.activeVersion() === version, "and the pointer names it");

  /* -------- 5. Reload: no re-download --------------------------------- */

  log("\n5. Reload — a fresh authority over the same disk");
  const requestsBeforeReload = server.requests();
  const authority = new ModelInstallationAuthority({
    vault,
    fetchImpl: globalThis.fetch,
    probeCapabilities: async () => [
      { path: "wasm_single", available: true, why: "the processor can run OCADE's engine" },
    ],
    resolveTarget: async () => ({
      version,
      totalBytes: ARTIFACT_BYTES,
      sha256: trueDigest,
      sources: [{ url: server.url, kind: "ocade_cdn" }],
    }),
    activateRuntime: async () => ({ ok: true }),
    storageHeadroom: async () => 40 * 1024 ** 3,
    requestPersistence: async () => true,
    hashBlob: (b) => sha256OfBlobStreaming(b),
    plan,
  });

  t = performance.now();
  const reloaded = await authority.install({ reason: "app_bootstrap" });
  const reloadMs = performance.now() - t;
  expect(reloaded.stage === "ready", "the reloaded authority reaches ready");
  expect(
    server.requests() === requestsBeforeReload,
    "WITHOUT a single network request — the engine is already here",
  );
  record("reload to ready", reloadMs);

  /* -------- 6. A corrupt candidate must not replace a working engine ---- */

  log("\n6. A failed upgrade must not destroy the working engine");
  const badVersion = "proof-engine-v2-corrupt";
  /*
   * A DIGEST THE SERVED BYTES DO NOT MATCH.
   *
   * The first attempt at this test declared the digest of a separately
   * generated 32 MiB file -- and the generator is deterministic from a fixed
   * seed, so that file was byte-identical to the first 32 MiB of the artifact
   * being served. The "corrupt" upgrade verified perfectly and activated, and
   * the harness reported three failures that were entirely its own.
   *
   * Flipping one hex digit of the real digest is unambiguous: it is a
   * fingerprint nothing can satisfy, which is exactly what a substituted or
   * truncated transfer looks like from the client's side.
   */
  const corruptDigest = `${trueDigest.slice(0, 63)}${trueDigest[63] === "a" ? "b" : "a"}`;
  const badServer = await serveArtifact(artifactPath);
  const upgradeAuthority = new ModelInstallationAuthority({
    vault,
    fetchImpl: globalThis.fetch,
    probeCapabilities: async () => [
      { path: "wasm_single", available: true, why: "the processor can run OCADE's engine" },
    ],
    resolveTarget: async () => ({
      version: badVersion,
      totalBytes: 32 * 1024 * 1024,
      sha256: corruptDigest,
      sources: [{ url: badServer.url, kind: "ocade_cdn" }],
    }),
    activateRuntime: async () => ({ ok: true }),
    storageHeadroom: async () => 40 * 1024 ** 3,
    requestPersistence: async () => true,
    hashBlob: (b) => sha256OfBlobStreaming(b),
    plan,
  });
  const upgrade = await upgradeAuthority.install({ reason: "user_retry" });
  await badServer.close();

  expect(upgrade.stage === "recoverable_error", "the corrupt upgrade is refused");
  expect(
    vault.activeVersion() === version,
    "and the previously working engine is STILL the active one",
  );
  expect((await vault.bytesOf(version)) === ARTIFACT_BYTES, "with its bytes untouched");
  expect(
    (await vault.bytesOf(badVersion)) === 0,
    "while the corrupt candidate was deleted rather than kept",
  );

  /* -------- 7. Uninstall ------------------------------------------------ */

  log("\n7. Uninstall");
  t = performance.now();
  const removed = await authority.uninstall();
  const uninstallMs = performance.now() - t;
  expect(removed.ok, "uninstall reports success");
  expect(vault.activeVersion() === null, "the pointer is cleared");
  expect((await vault.listVersions()).length === 0, "and nothing is left on disk");
  expect((await vault.bytesOf(version)) === 0, "the artifact is genuinely gone");
  record("uninstall", uninstallMs);

  /* -------- 8. Reinstall ------------------------------------------------ */

  log("\n8. Reinstall");
  t = performance.now();
  const again = await authority.reinstall();
  const reinstallMs = performance.now() - t;
  expect(again.stage === "ready", "a reinstall completes");
  expect(vault.activeVersion() === version, "and the engine is active again");
  expect((await vault.bytesOf(version)) === ARTIFACT_BYTES, "with the full artifact back on disk");
  record("reinstall (full)", reinstallMs, {
    throughput: mbps(ARTIFACT_BYTES, reinstallMs),
  });

  await server.close();

  /* -------- Report ------------------------------------------------------ */

  log("\n" + "=".repeat(70));
  if (failures.length === 0) {
    log(`ALL CHECKS PASSED over ${(ARTIFACT_BYTES / 1024 ** 3).toFixed(2)} GiB of real transfer.`);
  } else {
    log(`${failures.length} CHECK(S) FAILED:`);
    for (const failure of failures) log(`  - ${failure}`);
  }
  log("=".repeat(70) + "\n");

  if (WRITE) {
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      generatedBy: "scripts/e2e/model-install-production-proof.mts",
      artifactBytes: ARTIFACT_BYTES,
      artifactSha256: trueDigest,
      plan,
      passed: failures.length === 0,
      failures,
      measurements,
    };
    mkdirSync(dirname(resolve(ROOT, OUT)), { recursive: true });
    writeFileSync(resolve(ROOT, OUT), `${JSON.stringify(report, null, 2)}\n`);
    log(`Wrote ${OUT}`);
  }

  rmSync(WORK, { recursive: true, force: true });
  process.exit(failures.length === 0 ? 0 : 1);
}

void main().catch((error) => {
  console.error(error);
  rmSync(WORK, { recursive: true, force: true });
  process.exit(1);
});
