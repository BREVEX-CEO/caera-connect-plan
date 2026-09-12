import { describe, expect, it } from "vitest";
import { transferModel, type TransferCheckpoint } from "../model-transfer";
import type { ModelFileWriter } from "../model-store";

/**
 * THE MODEL IS DOWNLOADED ONCE, AND AN INTERRUPTION COSTS SECONDS.
 *
 * `PLAN.md` Phase 7 names the cases this has to survive: first install,
 * parallelism, interruption and resume, corruption repair, and a revisit that
 * does not re-download anything. The vault's half of that — activation,
 * rollback, removal, adopting an older install — is proven in
 * `model-vault.test.ts`. This is the TRANSFER's half, which nothing covered:
 * 921 lines deciding what is re-fetched after something goes wrong.
 *
 * It drives the real engine. The source is a fake ranged server and the writer
 * is an array, so every assertion below is about what the engine actually
 * requested and wrote — not about a description of it.
 */

/** An artifact whose bytes are a function of their offset, so a hole is visible. */
function artifact(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) bytes[i] = (i * 7 + 13) % 251;
  return bytes;
}

async function digestOf(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

interface Server {
  fetch: typeof fetch;
  /** Every range that was actually asked for, in order. */
  ranges: { start: number; end: number }[];
  /** The high-water mark of concurrent in-flight requests. */
  peakConcurrency: number;
}

/**
 * A server that honours Range, one request at a time in the reply but
 * overlapping in flight, so concurrency is observable.
 *
 * `corrupt` returns wrong bytes for a range the first `times` it is asked, which
 * is how a damaged chunk is simulated without touching the engine.
 */
function rangedServer(
  bytes: Uint8Array,
  options: { fail?: (index: number) => boolean; corruptFirstChunk?: boolean } = {},
): Server {
  const server: Server = { fetch: null as never, ranges: [], peakConcurrency: 0 };
  let inFlight = 0;
  let requestIndex = 0;
  server.fetch = (async (_url: string, init?: RequestInit) => {
    const index = requestIndex++;
    inFlight += 1;
    server.peakConcurrency = Math.max(server.peakConcurrency, inFlight);
    try {
      // A turn of the event loop, so overlapping requests genuinely overlap.
      await new Promise((resolve) => setTimeout(resolve, 1));
      const header = new Headers(init?.headers).get("Range") ?? "";
      const match = /bytes=(\d+)-(\d+)/.exec(header);
      if (!match) return new Response(bytes as unknown as BodyInit, { status: 200 });
      const start = Number(match[1]);
      const end = Number(match[2]);
      server.ranges.push({ start, end });
      if (options.fail?.(index)) return new Response(null, { status: 503 });
      const slice = bytes.slice(start, end + 1);
      if (options.corruptFirstChunk && start === 0) slice[0] ^= 0xff;
      return new Response(slice as unknown as BodyInit, {
        status: 206,
        headers: { "content-range": `bytes ${start}-${end}/${bytes.length}` },
      });
    } finally {
      inFlight -= 1;
    }
  }) as unknown as typeof fetch;
  return server;
}

/** A writer that keeps what it was given, so the result can be inspected. */
function arrayWriter(size: number): ModelFileWriter & { bytes: Uint8Array; writes: number } {
  const bytes = new Uint8Array(size);
  return {
    bytes,
    writes: 0,
    async write(chunk: Uint8Array, at: number) {
      this.writes += 1;
      bytes.set(chunk, at);
      return true;
    },
    async flush() {
      return true;
    },
    async close() {},
  };
}

const PLAN = { chunkBytes: 1024, concurrency: 4, because: "test" };
const SIZE = 16 * 1024;

describe("the first install", () => {
  it("fetches the whole artifact in ranged chunks and verifies it", async () => {
    const bytes = artifact(SIZE);
    const server = rangedServer(bytes);
    const writer = arrayWriter(SIZE);

    const result = await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        sha256: await digestOf(bytes),
        plan: PLAN,
      },
      { fetchImpl: server.fetch, writer, sleep: async () => {} },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(result.bytes).toBe(SIZE);
    expect(writer.bytes).toEqual(bytes);
    expect(server.ranges).toHaveLength(SIZE / PLAN.chunkBytes);
  });

  it("uses the parallelism the plan asked for", async () => {
    const bytes = artifact(SIZE);
    const server = rangedServer(bytes);

    await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        plan: PLAN,
      },
      { fetchImpl: server.fetch, writer: arrayWriter(SIZE), sleep: async () => {} },
    );

    expect(server.peakConcurrency).toBeGreaterThan(1);
    expect(server.peakConcurrency).toBeLessThanOrEqual(PLAN.concurrency);
  });
});

describe("an interruption", () => {
  it("keeps every byte it had and resumes from exactly there", async () => {
    const bytes = artifact(SIZE);
    const writer = arrayWriter(SIZE);
    const controller = new AbortController();
    const first = rangedServer(bytes);

    let checkpoint: TransferCheckpoint | null = null;
    const stopping = await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        sha256: await digestOf(bytes),
        plan: { ...PLAN, concurrency: 1 },
        onCheckpoint: (value) => {
          checkpoint = value;
        },
        onProgress: (progress) => {
          // Stop a quarter of the way in, the way a lid closing does.
          if (progress.receivedBytes >= SIZE / 4) controller.abort();
        },
        signal: controller.signal,
      },
      { fetchImpl: first.fetch, writer, sleep: async () => {} },
    );

    expect(stopping.ok).toBe(false);
    if (stopping.ok) return;
    expect(stopping.failure).toBe("cancelled");
    expect(stopping.checkpoint?.contiguousChunks).toBeGreaterThan(0);
    checkpoint = stopping.checkpoint;

    const second = rangedServer(bytes);
    const resumed = await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        sha256: await digestOf(bytes),
        plan: { ...PLAN, concurrency: 1 },
        resume: checkpoint,
      },
      { fetchImpl: second.fetch, writer, sleep: async () => {} },
    );

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.verified).toBe(true);
    expect(writer.bytes).toEqual(bytes);

    // THE POINT OF ALL OF THIS: the second attempt asked only for what was
    // missing. Nothing before the checkpoint was requested again.
    const done = (checkpoint as TransferCheckpoint).contiguousChunks;
    expect(resumed.resumedFromBytes).toBe(done * PLAN.chunkBytes);
    expect(second.ranges).toHaveLength(SIZE / PLAN.chunkBytes - done);
    expect(second.ranges.every((range) => range.start >= done * PLAN.chunkBytes)).toBe(true);
  });

  it("starts over rather than trusting a checkpoint taken against another size", async () => {
    const bytes = artifact(SIZE);
    const server = rangedServer(bytes);
    const result = await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        sha256: await digestOf(bytes),
        plan: PLAN,
        // A checkpoint from a DIFFERENT artifact. Resuming on it would hash a
        // span the digest state does not cover and condemn a good file.
        resume: { contiguousChunks: 4, digest: null, chunkBytes: 1024, totalBytes: SIZE * 2 },
      },
      { fetchImpl: server.fetch, writer: arrayWriter(SIZE), sleep: async () => {} },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(result.resumedFromBytes).toBe(0);
    expect(server.ranges).toHaveLength(SIZE / PLAN.chunkBytes);
  });
});

describe("what damage looks like", () => {
  it("retries a chunk the source failed to serve, and finishes", async () => {
    const bytes = artifact(SIZE);
    // The third request fails once. A single bad response is a bad moment, not
    // a reason to start the model again.
    const server = rangedServer(bytes, { fail: (index) => index === 2 });
    const writer = arrayWriter(SIZE);

    const result = await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        sha256: await digestOf(bytes),
        plan: PLAN,
      },
      { fetchImpl: server.fetch, writer, sleep: async () => {} },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(result.metrics.retries).toBeGreaterThan(0);
    expect(writer.bytes).toEqual(bytes);
  });

  it("refuses an artifact whose digest does not match, rather than installing it", async () => {
    const bytes = artifact(SIZE);
    const server = rangedServer(bytes, { corruptFirstChunk: true });

    const result = await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        sha256: await digestOf(bytes),
        plan: PLAN,
      },
      { fetchImpl: server.fetch, writer: arrayWriter(SIZE), sleep: async () => {} },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toBe("digest_mismatch");
  });

  it("never reports verified when it had no digest to check against", async () => {
    const bytes = artifact(SIZE);
    const result = await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        plan: PLAN,
      },
      { fetchImpl: rangedServer(bytes).fetch, writer: arrayWriter(SIZE), sleep: async () => {} },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Unverified, and honest about it. Nothing may activate on this.
    expect(result.verified).toBe(false);
    expect(result.digest).not.toBeNull();
  });
});

describe("a revisit", () => {
  it("asks the network for nothing at all when the checkpoint is already complete", async () => {
    const bytes = artifact(SIZE);
    const server = rangedServer(bytes);
    const writer = arrayWriter(SIZE);

    // A first attempt that finished, producing a complete checkpoint.
    let complete: TransferCheckpoint | null = null;
    await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        sha256: await digestOf(bytes),
        plan: PLAN,
        onCheckpoint: (value) => {
          complete = value;
        },
      },
      { fetchImpl: server.fetch, writer, sleep: async () => {} },
    );
    expect((complete as unknown as TransferCheckpoint).contiguousChunks).toBe(
      SIZE / PLAN.chunkBytes,
    );

    const revisit = rangedServer(bytes);
    const again = await transferModel(
      {
        sources: [{ url: "https://example.test/model", kind: "ocade_cdn" }],
        totalBytes: SIZE,
        sha256: await digestOf(bytes),
        plan: PLAN,
        resume: complete,
      },
      { fetchImpl: revisit.fetch, writer: arrayWriter(SIZE), sleep: async () => {} },
    );

    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.verified).toBe(true);
    // NOT ONE REQUEST. This is what "does not redownload because of a refresh,
    // a sign-out or a new build" means at the transfer layer.
    expect(revisit.ranges).toHaveLength(0);
  });
});
