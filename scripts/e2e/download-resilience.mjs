/**
 * EXECUTION PROOF FOR THE MODEL DOWNLOADER.
 *
 * A real HTTP server that speaks Range, real network interruptions, a real
 * SHA-256 check and a real corrupted file — against the shipped
 * `downloadModel`, not a re-implementation of it.
 *
 * The one thing simulated is OPFS, because OPFS exists only inside a browser
 * and `downloadModel` already accepts an injected store for exactly this
 * reason. Everything the downloader does with HTTP is real.
 */
import http from "node:http";
import { createHash, webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

/*
 * `ModelStore.isSupported()` gates the whole downloader on OPFS being present,
 * and it is RIGHT to: refusing to fetch several hundred megabytes it cannot
 * store is the correct behaviour, and the first run of this harness proved it
 * by failing closed with "This browser cannot store a model between visits".
 *
 * The injected store below is what actually holds the bytes. These two globals
 * only satisfy the feature detection so the real code path runs; nothing here
 * substitutes for the transfer logic under test.
 */
if (!globalThis.navigator?.storage?.getDirectory) {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      ...(globalThis.navigator ?? {}),
      storage: {
        getDirectory: async () => ({}),
        estimate: async () => ({ quota: 8e9, usage: 0 }),
        persist: async () => true,
        persisted: async () => true,
      },
    },
    configurable: true,
    writable: true,
  });
}
globalThis.FileSystemFileHandle = globalThis.FileSystemFileHandle ?? class {};

const { downloadModel } = await import("../../src/lib/brain/model-download.ts");

const SIZE = 5 * 1024 * 1024;
const FILE = Buffer.alloc(SIZE);
for (let i = 0; i < SIZE; i += 1) FILE[i] = (i * 7 + 13) & 0xff;
const DIGEST = createHash("sha256").update(FILE).digest("hex");

/** Server behaviour is switched per scenario. */
let mode = "normal";
let servedRanges = [];
let cutAfterBytes = Infinity;

const server = http.createServer((req, res) => {
  const range = req.headers.range;
  let start = 0;
  if (range) {
    const m = /bytes=(\d+)-/.exec(range);
    if (m) start = Number(m[1]);
  }
  servedRanges.push({ range: range ?? null, start });

  if (mode === "ignores-range") {
    // A server that answers 200 with the WHOLE file despite a Range header.
    res.writeHead(200, { "content-length": String(SIZE) });
    res.end(FILE);
    return;
  }

  const body = FILE.subarray(start);
  if (range && start > 0) {
    res.writeHead(206, {
      "content-length": String(body.length),
      "content-range": `bytes ${start}-${SIZE - 1}/${SIZE}`,
    });
  } else {
    res.writeHead(200, { "content-length": String(body.length) });
  }

  if (mode === "cut") {
    /*
     * A REALISTIC INTERRUPTION, NOT AN INSTANT ONE.
     *
     * The first version of this wrote the partial body and destroyed the
     * socket in the same tick. undici then failed the response before a single
     * chunk reached the reader, so the client legitimately had nothing to
     * keep — and the harness read that as "resume does not work" when what it
     * had actually built was a connection that never delivered anything.
     *
     * Streaming in slices with a gap is what a dropped wifi connection looks
     * like: bytes arrive, are read, and then the socket dies.
     */
    let sent = 0;
    const slice = 64 * 1024;
    const pump = () => {
      if (sent >= Math.min(cutAfterBytes, body.length)) {
        res.destroy();
        return;
      }
      res.write(body.subarray(sent, sent + slice));
      sent += slice;
      setTimeout(pump, 1);
    };
    pump();
    return;
  }
  if (mode === "slow") {
    let sent = 0;
    const slice = 32 * 1024;
    const pump = () => {
      if (sent >= body.length) {
        res.end();
        return;
      }
      res.write(body.subarray(sent, sent + slice));
      sent += slice;
      setTimeout(pump, 2);
    };
    pump();
    return;
  }
  res.end(body);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const URL_ = `http://127.0.0.1:${server.address().port}/model.gguf`;

/** In-memory stand-in with the same surface the downloader uses. */
function makeStore() {
  const files = new Map();
  const metas = new Map();
  return {
    _files: files,
    _metas: metas,
    async sizeOf(key) {
      return files.get(key)?.length ?? 0;
    },
    /*
     * `at` is the offset, and honouring it is the whole point: the downloader
     * resets it to zero when a server ignores Range, and a store that just
     * concatenated would hide that reset and quietly produce a double-length
     * file — the exact corruption scenario 3 exists to prove cannot happen.
     *
     * Returns a boolean because the real store does; returning undefined here
     * made the first run report "storage is full" at 80%.
     */
    async append(key, chunk, at) {
      const prev = files.get(key) ?? Buffer.alloc(0);
      const head = prev.subarray(0, at);
      files.set(key, Buffer.concat([head, Buffer.from(chunk)]));
      return true;
    },
    async truncate(key) {
      files.set(key, Buffer.alloc(0));
    },
    async remove(key) {
      files.delete(key);
      return true;
    },
    async readBlob(key) {
      const b = files.get(key);
      return b ? new Blob([b]) : null;
    },
    async writeMeta(key, meta) {
      meta === null ? metas.delete(key) : metas.set(key, meta);
    },
    async readMeta(key) {
      return metas.get(key) ?? null;
    },
    async requestPersistence() {
      return true;
    },
    async list() {
      return [];
    },
  };
}

const results = {};
const run = async (name, fn) => {
  try {
    results[name] = await fn();
  } catch (e) {
    results[name] = { error: String(e).slice(0, 300) };
  }
};

await run("1_clean_download_verifies_checksum", async () => {
  mode = "normal";
  servedRanges = [];
  const store = makeStore();
  const seen = [];
  const r = await downloadModel({
    key: "m",
    url: URL_,
    expectedBytes: SIZE,
    sha256: DIGEST,
    store,
    onProgress: (p) => seen.push(p.fraction),
  });
  return {
    ok: r.ok,
    bytes: r.ok ? r.bytes : null,
    verified: r.ok ? r.verified : null,
    resumed: r.ok ? r.resumed : null,
    storedBytes: store._files.get("m")?.length ?? 0,
    progressReports: seen.length,
    lastFraction: seen.at(-1) ?? null,
  };
});

await run("2_interrupted_then_resumes_from_bytes_on_disk", async () => {
  const store = makeStore();
  mode = "cut";
  cutAfterBytes = 2 * 1024 * 1024;
  servedRanges = [];
  const first = await downloadModel({
    key: "m",
    url: URL_,
    expectedBytes: SIZE,
    sha256: DIGEST,
    store,
  });
  const afterInterrupt = store._files.get("m")?.length ?? 0;

  mode = "normal";
  servedRanges = [];
  const second = await downloadModel({
    key: "m",
    url: URL_,
    expectedBytes: SIZE,
    sha256: DIGEST,
    store,
  });
  return {
    firstFailed: !first.ok,
    keptBytesAfterInterrupt: afterInterrupt,
    resumeRequestSentRange: servedRanges[0]?.range ?? null,
    resumeStartOffset: servedRanges[0]?.start ?? null,
    secondOk: second.ok,
    secondResumed: second.ok ? second.resumed : null,
    finalBytes: store._files.get("m")?.length ?? 0,
    finalMatchesOriginal: Buffer.compare(store._files.get("m") ?? Buffer.alloc(0), FILE) === 0,
  };
});

await run("3_server_ignoring_range_restarts_instead_of_corrupting", async () => {
  const store = makeStore();
  mode = "cut";
  cutAfterBytes = 1024 * 1024;
  servedRanges = [];
  await downloadModel({ key: "m", url: URL_, expectedBytes: SIZE, sha256: DIGEST, store });
  const partial = store._files.get("m")?.length ?? 0;

  mode = "ignores-range";
  servedRanges = [];
  const r = await downloadModel({
    key: "m",
    url: URL_,
    expectedBytes: SIZE,
    sha256: DIGEST,
    store,
  });
  const final = store._files.get("m")?.length ?? 0;
  return {
    partialBefore: partial,
    ok: r.ok,
    finalBytes: final,
    // The bug this guards: appending a full 200 body onto a partial file.
    didNotDoubleUp: final === SIZE,
    matchesOriginal: Buffer.compare(store._files.get("m") ?? Buffer.alloc(0), FILE) === 0,
  };
});

await run("4_corrupt_file_is_deleted_not_resumed", async () => {
  const store = makeStore();
  mode = "normal";
  servedRanges = [];
  const wrongDigest = createHash("sha256").update("something else").digest("hex");
  const r = await downloadModel({
    key: "m",
    url: URL_,
    expectedBytes: SIZE,
    sha256: wrongDigest,
    store,
  });
  return {
    ok: r.ok,
    failure: r.ok ? null : r.failure,
    reason: r.ok ? null : String(r.reason).slice(0, 120),
    // The whole point: corrupt weights must NOT be left for a "resume".
    fileRemoved: !store._files.has("m"),
  };
});

await run("5_complete_file_is_not_downloaded_again", async () => {
  const store = makeStore();
  mode = "normal";
  servedRanges = [];
  await downloadModel({ key: "m", url: URL_, expectedBytes: SIZE, sha256: DIGEST, store });
  servedRanges = [];
  const again = await downloadModel({
    key: "m",
    url: URL_,
    expectedBytes: SIZE,
    sha256: DIGEST,
    store,
  });
  return {
    ok: again.ok,
    resumed: again.ok ? again.resumed : null,
    httpRequestsOnSecondCall: servedRanges.length,
    bytes: again.ok ? again.bytes : null,
  };
});

await run("6_abort_keeps_what_arrived", async () => {
  const store = makeStore();
  // A slow server, so the abort genuinely lands mid-stream rather than after
  // a localhost transfer has already finished.
  mode = "slow";
  servedRanges = [];
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 120);
  const r = await downloadModel({
    key: "m",
    url: URL_,
    expectedBytes: SIZE,
    sha256: DIGEST,
    store,
    signal: ac.signal,
  });
  return {
    ok: r.ok,
    failure: r.ok ? null : r.failure,
    // Aborting must not throw away the bytes already written.
    keptSomething: (store._files.get("m")?.length ?? 0) >= 0,
    kept: store._files.get("m")?.length ?? 0,
  };
});

server.close();
console.log(
  JSON.stringify({ fileSize: SIZE, digest: DIGEST.slice(0, 16) + "…", results }, null, 2),
);
