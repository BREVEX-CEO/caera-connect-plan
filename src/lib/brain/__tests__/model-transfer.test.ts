import { describe, it, expect } from "vitest";
import { transferModel, type TransferCheckpoint } from "../model-transfer";
import { planTransfer } from "../download-plan";
import { sha256OfBytes } from "../streaming-digest";
import type { ModelFileWriter } from "../model-vault";

/**
 * The transfer, driven against a fake network and a fake disk.
 *
 * Every case here is one that was observed or is reachable in production: a
 * connection that drops mid-transfer, a server that ignores Range, a chunk that
 * arrives short, a source that goes away, a disk that fills up, a browser that
 * is closed and reopened. The rule under test throughout is the same one:
 * NOTHING IS EVER REPORTED VERIFIED UNLESS ITS DIGEST WAS COMPUTED AND MATCHED,
 * and progress that was genuinely made is never thrown away.
 */

const KIB = 1024;

/** Deterministic bytes so a failing case is reproducible. */
function artifact(length: number, seed = 3): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed >>> 0;
  for (let i = 0; i < length; i += 1) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out[i] = (x >>> 24) & 0xff;
  }
  return out;
}

/** A disk that records what was written and can be told to fill up. */
function fakeDisk(options?: { failAfterBytes?: number; failFlush?: boolean }) {
  let bytes = new Uint8Array(0);
  let accepted = 0;
  let flushes = 0;
  let opens = 1;

  const writer: ModelFileWriter = {
    async write(chunk, at) {
      if (
        options?.failAfterBytes !== undefined &&
        accepted + chunk.length > options.failAfterBytes
      ) {
        return false;
      }
      accepted += chunk.length;
      if (at + chunk.length > bytes.length) {
        const grown = new Uint8Array(at + chunk.length);
        grown.set(bytes, 0);
        bytes = grown;
      }
      bytes.set(chunk, at);
      return true;
    },
    async flush() {
      flushes += 1;
      return !options?.failFlush;
    },
    async close() {
      flushes += 1;
    },
  };

  return {
    writer,
    get bytes() {
      return bytes;
    },
    get flushes() {
      return flushes;
    },
    get opens() {
      return opens;
    },
    reopen() {
      opens += 1;
      return writer;
    },
  };
}

interface ServerOptions {
  /** Answer 200 with the whole file instead of honouring Range. */
  ignoresRange?: boolean;
  /** Throw a network error on request numbers in this set. */
  failOn?: Set<number>;
  /** Throw on every request after this many. */
  failAfter?: number;
  /** Status to answer with, instead of serving bytes. */
  status?: number;
  /** Corrupt the response for this chunk start offset. */
  corruptAtOffset?: number;
  /** Truncate every ranged response by this many bytes. */
  shortBy?: number;
}

/** A server that speaks Range, and can be told every way to misbehave. */
function fakeServer(data: Uint8Array, options: ServerOptions = {}) {
  let requests = 0;
  const ranges: string[] = [];

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    requests += 1;
    const n = requests;
    if (options.failOn?.has(n)) throw new TypeError("Failed to fetch");
    if (options.failAfter !== undefined && n > options.failAfter) {
      throw new TypeError("Failed to fetch");
    }
    if (options.status && options.status !== 200 && options.status !== 206) {
      return new Response(null, { status: options.status });
    }

    const header =
      init?.headers && typeof (init.headers as Record<string, string>).Range === "string"
        ? (init.headers as Record<string, string>).Range
        : null;
    if (header) ranges.push(header);

    if (!header || options.ignoresRange) {
      return new Response(data as unknown as BodyInit, {
        status: 200,
        headers: { "content-length": String(data.length) },
      });
    }

    const match = /bytes=(\d+)-(\d*)/.exec(header);
    if (!match) return new Response(null, { status: 416 });
    const start = Number(match[1]);
    const end = match[2] === "" ? data.length - 1 : Number(match[2]);
    if (start >= data.length) return new Response(null, { status: 416 });

    let slice = data.slice(start, Math.min(end, data.length - 1) + 1);
    if (options.shortBy) slice = slice.slice(0, Math.max(0, slice.length - options.shortBy));
    if (options.corruptAtOffset === start) {
      slice = slice.slice();
      slice[0] ^= 0xff;
    }
    return new Response(slice as unknown as BodyInit, {
      status: 206,
      headers: {
        "content-range": `bytes ${start}-${start + slice.length - 1}/${data.length}`,
        "content-length": String(slice.length),
      },
    });
  }) as unknown as typeof fetch;

  return {
    fetchImpl,
    get requests() {
      return requests;
    },
    get ranges() {
      return ranges;
    },
  };
}

/** A plan with small chunks so a test artifact still exercises the pool. */
const smallPlan = { chunkBytes: 4 * KIB, concurrency: 3, because: "test" };

const noWait = { sleep: async () => {}, random: () => 0.5 };

describe("a clean first install", () => {
  it("writes every byte and verifies the digest", async () => {
    const data = artifact(64 * KIB + 137);
    const server = fakeServer(data);
    const disk = fakeDisk();

    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(result.bytes).toBe(data.length);
    expect(disk.bytes).toEqual(data);
  });

  it("uses several connections at once on a capable plan", async () => {
    const data = artifact(64 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        plan: { chunkBytes: 4 * KIB, concurrency: 4, because: "test" },
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    // 16 chunks of 4 KiB, each its own ranged request.
    expect(server.ranges.length).toBe(16);
    expect(server.ranges[0]).toBe("bytes=0-4095");
  });

  it("reports progress that ends at exactly the full size", async () => {
    const data = artifact(32 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const seen: number[] = [];
    await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        plan: smallPlan,
        onProgress: (p) => seen.push(p.receivedBytes),
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(seen.at(-1)).toBe(data.length);
  });

  it("never invents an ETA before it has measured throughput", async () => {
    const data = artifact(32 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const etas: (number | null)[] = [];
    await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        plan: smallPlan,
        onProgress: (p) => etas.push(p.etaSeconds),
      },
      // A clock that never advances means no sampling window ever closes, so
      // there is no measured throughput and therefore no honest estimate.
      { fetchImpl: server.fetchImpl, writer: disk.writer, now: () => 1000, ...noWait },
    );
    expect(etas.every((eta) => eta === null)).toBe(true);
  });
});

describe("verification is part of the download, not a phase after it", () => {
  it("refuses a corrupt artifact rather than reporting it verified", async () => {
    const data = artifact(32 * KIB);
    const server = fakeServer(data, { corruptAtOffset: 8 * KIB });
    const disk = fakeDisk();

    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toBe("digest_mismatch");
  });

  it("reports unverified — never verified — when no digest was published", async () => {
    const data = artifact(16 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        plan: smallPlan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(false);
    // The digest is still computed and reported, so a caller can record it.
    expect(result.digest).toBe(sha256OfBytes(data));
  });

  it("retries a short chunk instead of accepting a hole in the file", async () => {
    const data = artifact(16 * KIB);
    // Every ranged response is one byte short, forever. The transfer must give
    // up rather than assemble a file with gaps in it.
    const server = fakeServer(data, { shortBy: 1 });
    const disk = fakeDisk();
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        maxAttemptsPerChunk: 2,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toBe("network");
  });
});

describe("interruption keeps what it already has", () => {
  it("returns a checkpoint after a mid-transfer network failure", async () => {
    const data = artifact(128 * KIB);
    // Enough requests to get past the first checkpoint, then the link dies.
    const server = fakeServer(data, { failAfter: 12 });
    const disk = fakeDisk();

    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        maxAttemptsPerChunk: 2,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toBe("network");
    expect(result.retriable).toBe(true);
    expect(result.checkpoint).not.toBeNull();
    expect(result.checkpoint!.contiguousChunks).toBeGreaterThan(0);
  });

  it("RESUMES from the checkpoint instead of starting again", async () => {
    const data = artifact(128 * KIB);
    const disk = fakeDisk();

    // First attempt: dies partway.
    const first = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        maxAttemptsPerChunk: 2,
      },
      { fetchImpl: fakeServer(data, { failAfter: 12 }).fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(first.ok).toBe(false);
    if (first.ok) return;
    const checkpoint = first.checkpoint as TransferCheckpoint;
    expect(checkpoint.contiguousChunks).toBeGreaterThan(0);

    // Second attempt, a fresh server and a fresh writer — as after a reload.
    const second = fakeServer(data);
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        resume: checkpoint,
      },
      { fetchImpl: second.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(disk.bytes).toEqual(data);
    // The whole point: the resumed run asked only for what was missing.
    expect(result.resumedFromBytes).toBe(checkpoint.contiguousChunks * checkpoint.chunkBytes);
    const firstAsked = Number(/bytes=(\d+)/.exec(second.ranges[0])![1]);
    expect(firstAsked).toBe(result.resumedFromBytes);
  });

  it("does not re-fetch anything when the checkpoint says it is complete", async () => {
    const data = artifact(32 * KIB);
    const disk = fakeDisk();
    const first = fakeServer(data);
    let saved: TransferCheckpoint | null = null;

    await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        onCheckpoint: (c) => {
          saved = c;
        },
      },
      { fetchImpl: first.fetchImpl, writer: disk.writer, ...noWait },
    );

    const offline = fakeServer(data, { failAfter: 0 });
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        resume: saved,
      },
      { fetchImpl: offline.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    // Offline second launch: not one request went out.
    expect(offline.requests).toBe(0);
  });

  it("keeps its progress when the user stops it", async () => {
    const data = artifact(128 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const controller = new AbortController();
    let stopped = false;

    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        plan: smallPlan,
        signal: controller.signal,
        onProgress: (p) => {
          if (!stopped && p.receivedBytes > 32 * KIB) {
            stopped = true;
            controller.abort();
          }
        },
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toBe("cancelled");
    // Stopping is not discarding.
    expect(result.checkpoint).not.toBeNull();
  });

  it("ignores a checkpoint taken against a different size", async () => {
    const data = artifact(32 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        // A checkpoint from a DIFFERENT artifact. Trusting it would resume at
        // an offset that means nothing here.
        resume: { contiguousChunks: 4, digest: null, chunkBytes: 4 * KIB, totalBytes: 999_999 },
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(result.resumedFromBytes).toBe(0);
  });

  it("starts over rather than trusting a checkpoint it cannot parse", async () => {
    const data = artifact(32 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        resume: {
          contiguousChunks: 4,
          digest: { state: "corrupted", bytes: 16384 },
          chunkBytes: 4 * KIB,
          totalBytes: data.length,
        },
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(disk.bytes).toEqual(data);
  });
});

describe("servers that do not do what they are asked", () => {
  it("falls back to a whole-file transfer when Range is ignored", async () => {
    const data = artifact(32 * KIB);
    const server = fakeServer(data, { ignoresRange: true });
    const disk = fakeDisk();

    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(result.metrics.ranged).toBe(false);
    expect(disk.bytes).toEqual(data);
  });

  it("does not append a whole-file 200 onto bytes already on disk", async () => {
    // The corruption this exists to prevent: a resume that meets a server
    // which ignores Range must restart, not concatenate.
    const data = artifact(32 * KIB);
    const disk = fakeDisk();
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
        resume: { contiguousChunks: 4, digest: null, chunkBytes: 4 * KIB, totalBytes: data.length },
      },
      {
        fetchImpl: fakeServer(data, { ignoresRange: true }).fetchImpl,
        writer: disk.writer,
        ...noWait,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(disk.bytes.length).toBe(data.length);
    expect(disk.bytes).toEqual(data);
  });

  it("moves to the next source when the first has gone", async () => {
    const data = artifact(32 * KIB);
    const dead = fakeServer(data, { status: 404 });
    const good = fakeServer(data);
    const disk = fakeDisk();

    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) =>
      String(url).includes("dead")
        ? dead.fetchImpl(url as string, init)
        : good.fetchImpl(url as string, init)) as unknown as typeof fetch;

    const result = await transferModel(
      {
        sources: [
          { url: "https://dead.example/m", kind: "ocade_cdn" },
          { url: "https://good.example/m", kind: "publisher" },
        ],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
      },
      { fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(result.source.kind).toBe("publisher");
    expect(result.metrics.sourceSwitches).toBeGreaterThan(0);
  });

  it("recovers from an intermittent drop without losing the transfer", async () => {
    const data = artifact(64 * KIB);
    // Requests 3, 5 and 8 die — a lift, a tunnel, a handover.
    const server = fakeServer(data, { failOn: new Set([3, 5, 8]) });
    const disk = fakeDisk();

    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(result.metrics.retries).toBeGreaterThan(0);
    expect(disk.bytes).toEqual(data);
  });

  it("refuses honestly when there is nowhere to fetch from", async () => {
    const disk = fakeDisk();
    const result = await transferModel(
      { sources: [], totalBytes: 100, plan: smallPlan },
      { fetchImpl: fakeServer(artifact(100)).fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toBe("no_source");
    expect(result.retriable).toBe(false);
  });

  it("discovers the size when the catalogue did not state one", async () => {
    const data = artifact(20 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: null,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bytes).toBe(data.length);
  });
});

describe("storage that runs out", () => {
  it("calls a refused write insufficient storage, not a network error", async () => {
    const data = artifact(64 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk({ failAfterBytes: 8 * KIB });

    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan: smallPlan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toBe("insufficient_storage");
    // Not worth retrying into the same full disk without the user acting.
    expect(result.retriable).toBe(false);
  });

  it("reports a failing flush as a storage problem worth retrying", async () => {
    const data = artifact(64 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk({ failFlush: true });
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        plan: smallPlan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toBe("storage");
  });
});

describe("memory stays bounded however the transfer goes", () => {
  it("never holds more than the dispatch window in flight", async () => {
    const data = artifact(512 * KIB);
    let peakOutstanding = 0;
    let outstanding = 0;

    const base = fakeServer(data);
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      outstanding += 1;
      peakOutstanding = Math.max(peakOutstanding, outstanding);
      try {
        return await base.fetchImpl(url as string, init);
      } finally {
        outstanding -= 1;
      }
    }) as unknown as typeof fetch;

    const disk = fakeDisk();
    await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        plan: { chunkBytes: 4 * KIB, concurrency: 3, because: "test" },
      },
      { fetchImpl, writer: disk.writer, ...noWait },
    );

    // The whole 512 KiB is 128 chunks; at most a handful may be in flight.
    expect(peakOutstanding).toBeLessThanOrEqual(8);
  });
});

describe("the plan a real device would get still transfers correctly", () => {
  it("works with the mobile plan", async () => {
    const data = artifact(300 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const plan = planTransfer({ mobile: true, deviceMemoryGb: 2, effectiveType: "4g" });
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(disk.bytes).toEqual(data);
  });

  it("works with the desktop plan", async () => {
    const data = artifact(300 * KIB);
    const server = fakeServer(data);
    const disk = fakeDisk();
    const plan = planTransfer({ deviceMemoryGb: 16, cores: 12, downlinkMbps: 100 });
    const result = await transferModel(
      {
        sources: [{ url: "https://cdn.example/m", kind: "ocade_cdn" }],
        totalBytes: data.length,
        sha256: sha256OfBytes(data),
        plan,
      },
      { fetchImpl: server.fetchImpl, writer: disk.writer, ...noWait },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    expect(disk.bytes).toEqual(data);
  });
});
