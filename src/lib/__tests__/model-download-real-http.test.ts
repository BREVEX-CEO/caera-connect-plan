import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { downloadModel } from "../brain/model-download";
import { ModelStore } from "../brain/model-store";

/**
 * THE DOWNLOAD PATH, AGAINST A REAL HTTP SERVER.
 *
 * `model-download.test.ts` already covers this logic thoroughly — against a
 * fake fetch. That is the right place for the edge cases, but a fake network
 * only ever behaves the way whoever wrote it imagined HTTP behaves, and range
 * requests are precisely where that assumption breaks: the exact
 * `Content-Range` grammar, the 206 versus 200 decision, an inclusive end
 * offset, a 416 when the client asks for a range past the end.
 *
 * So this serves real bytes over real HTTP, with real `Range` handling, and
 * checks the digest with the platform's own SHA-256 against one computed
 * independently by node:crypto. What it proves that a fake cannot: a resume
 * asks for exactly the missing bytes and the file that results is
 * byte-identical to the original.
 */

/** Deterministic weights. Random once, then fixed for the whole file. */
const WEIGHTS = randomBytes(512 * 1024);
const DIGEST = createHash("sha256").update(WEIGHTS).digest("hex");

let server: Server;
let origin = "";
/** Every Range header the client actually sent, in order. */
const rangeHeaders: (string | undefined)[] = [];
/** Cut the response short after this many bytes, once. */
let truncateAfter: number | null = null;

beforeAll(async () => {
  server = createServer((req, res) => {
    rangeHeaders.push(req.headers.range);
    const range = /^bytes=(\d+)-(\d*)$/.exec(String(req.headers.range ?? ""));

    if (range) {
      const start = Number(range[1]);
      if (start >= WEIGHTS.length) {
        res.writeHead(416, { "content-range": `bytes */${WEIGHTS.length}` });
        return res.end();
      }
      const end = range[2] ? Number(range[2]) : WEIGHTS.length - 1;
      const slice = WEIGHTS.subarray(start, end + 1);
      res.writeHead(206, {
        "content-type": "application/octet-stream",
        "content-length": String(slice.length),
        "content-range": `bytes ${start}-${end}/${WEIGHTS.length}`,
        "accept-ranges": "bytes",
      });
      if (truncateAfter !== null) {
        const cut = truncateAfter;
        truncateAfter = null;
        // Let the bytes actually reach the client before dropping the socket.
        // Destroying in the same tick discards the pending write, and the
        // client then sees a transfer that delivered nothing — which looks
        // like a download that kept no progress when in fact none arrived.
        res.write(slice.subarray(0, cut), () => setTimeout(() => res.destroy(), 60));
        return;
      }
      return res.end(slice);
    }

    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": String(WEIGHTS.length),
      "accept-ranges": "bytes",
    });
    if (truncateAfter !== null) {
      const cut = truncateAfter;
      truncateAfter = null;
      res.write(WEIGHTS.subarray(0, cut), () => setTimeout(() => res.destroy(), 60));
      return;
    }
    res.end(WEIGHTS);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

/** An in-memory store with the real store's contract. */
function memoryStore() {
  const files = new Map<string, Uint8Array>();
  const meta = new Map<string, unknown>();
  return {
    async sizeOf(key: string) {
      return files.get(key)?.length ?? 0;
    },
    async append(key: string, chunk: Uint8Array, at: number) {
      const existing = files.get(key) ?? new Uint8Array(0);
      const next = new Uint8Array(at + chunk.length);
      next.set(existing.subarray(0, at), 0);
      next.set(chunk, at);
      files.set(key, next);
      return true;
    },
    async remove(key: string) {
      return files.delete(key);
    },
    async readBlob(key: string) {
      const bytes = files.get(key);
      return bytes ? new Blob([bytes as unknown as BlobPart]) : null;
    },
    async readMeta(key: string) {
      return meta.get(key) ?? null;
    },
    async writeMeta(key: string, value: unknown) {
      meta.set(key, value);
    },
    bytesOf: (key: string) => files.get(key) ?? new Uint8Array(0),
  } as unknown as ModelStore & { bytesOf: (key: string) => Uint8Array };
}

/*
 * `downloadModel` refuses outright when the browser cannot keep a model between
 * visits, which is right — and it checks that BEFORE it looks at an injected
 * store, so the presence check has to be satisfied for any of this to run. Only
 * the PRESENCE of OPFS is stubbed, exactly as `model-download.test.ts` stubs
 * it; the store holds real bytes and the network is a real socket.
 */
function stubStoragePresence() {
  vi.stubGlobal("navigator", {
    storage: {
      getDirectory: () => Promise.resolve({}),
      estimate: () => Promise.resolve({ quota: 4 * 1024 * 1024 * 1024, usage: 0 }),
    },
  });
  vi.stubGlobal("FileSystemFileHandle", class {});
}

describe("a model downloads over real HTTP", () => {
  beforeEach(() => {
    stubStoragePresence();
    expect(ModelStore.isSupported(), "storage presence stub did not take").toBe(true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fetches every byte and verifies the published digest", async () => {
    rangeHeaders.length = 0;
    const store = memoryStore();
    const result = await downloadModel({
      key: "weights.bin",
      url: `${origin}/weights.bin`,
      expectedBytes: WEIGHTS.length,
      sha256: DIGEST,
      store,
    });

    expect(result.ok, "reason" in result ? result.reason : "").toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.verified).toBe(true);
    expect(store.bytesOf("weights.bin").length).toBe(WEIGHTS.length);
    expect(Buffer.from(store.bytesOf("weights.bin")).equals(WEIGHTS)).toBe(true);
  }, 60_000);

  /**
   * The case a fake network cannot honestly reproduce: the transfer really is
   * cut, the bytes really are on disk, and the resume really does send a Range
   * header the server really parses.
   */
  it("resumes an interrupted transfer and asks for exactly the missing bytes", async () => {
    rangeHeaders.length = 0;
    const store = memoryStore();
    const cut = 200 * 1024;
    truncateAfter = cut;

    const interrupted = await downloadModel({
      key: "weights.bin",
      url: `${origin}/weights.bin`,
      expectedBytes: WEIGHTS.length,
      sha256: DIGEST,
      store,
    });
    expect(interrupted.ok).toBe(false);

    const have = await store.sizeOf("weights.bin");
    expect(have, "the partial transfer must be kept, or a resume is pointless").toBeGreaterThan(0);
    expect(have).toBeLessThan(WEIGHTS.length);

    const resumed = await downloadModel({
      key: "weights.bin",
      url: `${origin}/weights.bin`,
      expectedBytes: WEIGHTS.length,
      sha256: DIGEST,
      store,
    });
    expect(resumed.ok, "reason" in resumed ? resumed.reason : "").toBe(true);
    if (!resumed.ok) throw new Error("unreachable");
    expect(resumed.verified).toBe(true);
    expect(resumed.resumed).toBe(true);

    // Asked for the missing bytes, not the whole file again.
    expect(rangeHeaders.at(-1)).toBe(`bytes=${have}-`);
    // And the result is byte-identical to what the server holds.
    expect(Buffer.from(store.bytesOf("weights.bin")).equals(WEIGHTS)).toBe(true);
  }, 90_000);

  it("DELETES weights whose digest does not match what was published", async () => {
    const store = memoryStore();
    const result = await downloadModel({
      key: "weights.bin",
      url: `${origin}/weights.bin`,
      expectedBytes: WEIGHTS.length,
      // One character off: a real corrupted download looks exactly like this.
      sha256: DIGEST.slice(0, -1) + (DIGEST.endsWith("a") ? "b" : "a"),
      store,
    });
    expect(result.ok).toBe(false);
    expect(await store.sizeOf("weights.bin")).toBe(0);
  }, 60_000);

  it("treats a completed file that answers 416 as complete, not as a failure", async () => {
    const store = memoryStore();
    await store.append("weights.bin", new Uint8Array(WEIGHTS), 0);
    const result = await downloadModel({
      key: "weights.bin",
      url: `${origin}/weights.bin`,
      expectedBytes: WEIGHTS.length,
      sha256: DIGEST,
      store,
    });
    expect(result.ok, "reason" in result ? result.reason : "").toBe(true);
    expect(await store.sizeOf("weights.bin")).toBe(WEIGHTS.length);
  }, 60_000);
});

describe("model storage is reported honestly when absent", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("refuses to download rather than pretending it can keep the weights", async () => {
    const result = await downloadModel({ key: "x", url: `${origin}/weights.bin` });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.failure).toBe("storage_unavailable");
  });
});
