import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import {
  StreamingSha256,
  sha256OfBytes,
  sha256OfBlobStreaming,
  type DigestCheckpoint,
} from "../streaming-digest";

/**
 * The streaming digest is only useful if it is the SAME function the publisher
 * hashed with. Every assertion here compares it against the platform's own
 * `crypto.subtle.digest` rather than against a fixture, so a subtle error in
 * padding, endianness or the length field cannot pass by matching a number
 * somebody typed out of the same broken implementation.
 */

async function platform(bytes: Uint8Array): Promise<string> {
  const digest = await webcrypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Deterministic pseudo-random bytes, so a failure is reproducible. */
function noise(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed >>> 0;
  for (let i = 0; i < length; i += 1) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out[i] = (x >>> 24) & 0xff;
  }
  return out;
}

describe("it computes SHA-256, not something that resembles it", () => {
  const sizes = [
    0, // empty
    1,
    55, // one byte short of needing a second padding block
    56, // the exact boundary where padding overflows
    57,
    63,
    64, // one whole block
    65,
    127,
    128,
    1000,
    64 * 1024 + 7,
  ];

  for (const size of sizes) {
    it(`matches the platform digest for ${size} bytes`, async () => {
      const bytes = noise(size, size + 1);
      expect(sha256OfBytes(bytes)).toBe(await platform(bytes));
    });
  }

  it("matches for the empty string's well-known digest", () => {
    expect(sha256OfBytes(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches for a multi-megabyte input", async () => {
    const bytes = noise(5 * 1024 * 1024 + 331, 7);
    expect(sha256OfBytes(bytes)).toBe(await platform(bytes));
  });
});

describe("chunking must not change the answer", () => {
  it("gives the same digest however awkwardly the bytes are split", async () => {
    const bytes = noise(300_000, 42);
    const expected = await platform(bytes);

    // Splits chosen to land on, before and after block boundaries, plus a run
    // of one-byte updates, which is the worst case for the carried tail.
    const splitPlans = [
      [1, 63, 64, 65, 127, 128, 4096],
      [63, 1, 63, 1, 8192],
      [64, 64, 64, 100_000],
      [1, 1, 1, 1, 1, 1, 1],
    ];

    for (const plan of splitPlans) {
      const hasher = new StreamingSha256();
      let at = 0;
      let step = 0;
      while (at < bytes.length) {
        const size = Math.min(plan[step % plan.length], bytes.length - at);
        hasher.update(bytes.subarray(at, at + size));
        at += size;
        step += 1;
      }
      expect(hasher.digest()).toBe(expected);
    }
  });

  it("reports how many bytes it has consumed", () => {
    const hasher = new StreamingSha256();
    hasher.update(noise(100));
    hasher.update(noise(23));
    expect(hasher.length).toBe(123);
  });
});

describe("checkpoints make a resume free instead of merely possible", () => {
  it("resumes to the same digest as an uninterrupted run", async () => {
    const bytes = noise(1024 * 1024 + 512, 9);
    const expected = await platform(bytes);
    // 64 KiB is a block multiple, so a checkpoint is available there.
    const cut = 64 * 1024;

    const first = new StreamingSha256();
    first.update(bytes.subarray(0, cut));
    const saved = first.checkpoint();
    expect(saved).not.toBeNull();
    expect(saved!.bytes).toBe(cut);

    // A completely fresh hasher, as after a browser restart.
    const resumed = StreamingSha256.resume(saved as DigestCheckpoint);
    resumed.update(bytes.subarray(cut));
    expect(resumed.digest()).toBe(expected);
  });

  it("survives several checkpoints in a row", async () => {
    const bytes = noise(640 * 1024, 11);
    const expected = await platform(bytes);
    const step = 64 * 1024;

    let saved: DigestCheckpoint | null = null;
    for (let at = 0; at < bytes.length; at += step) {
      const hasher = saved ? StreamingSha256.resume(saved) : new StreamingSha256();
      hasher.update(bytes.subarray(at, at + step));
      saved = hasher.checkpoint();
      expect(saved).not.toBeNull();
    }
    const final = StreamingSha256.resume(saved as DigestCheckpoint);
    expect(final.digest()).toBe(expected);
  });

  it("REFUSES to checkpoint mid-block rather than quietly losing bytes", () => {
    const hasher = new StreamingSha256();
    hasher.update(noise(100)); // 100 is not a multiple of 64
    expect(hasher.checkpoint()).toBeNull();
  });

  it("refuses a checkpoint that is not on a block boundary", () => {
    expect(() => StreamingSha256.resume({ state: "0".repeat(64), bytes: 100 })).toThrow();
  });

  it("refuses a malformed checkpoint rather than starting from zero", () => {
    // Silently restarting would produce a mismatch for a good file, and the
    // caller would then delete perfectly valid weights.
    expect(() => StreamingSha256.resume({ state: "not hex", bytes: 64 })).toThrow();
    expect(() => StreamingSha256.resume({ state: "0".repeat(63), bytes: 64 })).toThrow();
    expect(() => StreamingSha256.resume({ state: "0".repeat(64), bytes: -64 })).toThrow();
  });

  it("cannot be used after it has been finalised", () => {
    const hasher = new StreamingSha256();
    hasher.update(noise(64));
    hasher.digest();
    expect(() => hasher.update(noise(64))).toThrow();
    expect(() => hasher.digest()).toThrow();
    expect(hasher.checkpoint()).toBeNull();
  });
});

describe("hashing a blob never materialises it", () => {
  it("matches the platform digest through the stream path", async () => {
    const bytes = noise(700_000, 13);
    const blob = new Blob([bytes as BufferSource]);
    expect(await sha256OfBlobStreaming(blob, { sliceBytes: 4096 })).toBe(await platform(bytes));
  });

  it("matches through the slice path when the blob has no stream()", async () => {
    const bytes = noise(300_001, 17);
    const real = new Blob([bytes as BufferSource]);
    // A Blob-alike with `stream` removed, which is what some older WebViews
    // give — and those are the devices least able to afford a full read.
    const sliceOnly = {
      size: real.size,
      slice: (a: number, b: number) => real.slice(a, b),
    } as unknown as Blob;
    expect(await sha256OfBlobStreaming(sliceOnly, { sliceBytes: 8192 })).toBe(
      await platform(bytes),
    );
  });

  it("reports progress that ends at the full size", async () => {
    const bytes = noise(200_000, 19);
    const seen: number[] = [];
    await sha256OfBlobStreaming(new Blob([bytes as BufferSource]), {
      sliceBytes: 16384,
      onProgress: (read) => seen.push(read),
    });
    expect(seen.at(-1)).toBe(bytes.length);
  });

  it("returns null — never a digest — when the blob cannot be read", async () => {
    const broken = {
      size: 10,
      stream: () => {
        throw new Error("storage went away");
      },
    } as unknown as Blob;
    expect(await sha256OfBlobStreaming(broken)).toBeNull();
  });

  it("returns null when cancelled, rather than a digest of a prefix", async () => {
    const controller = new AbortController();
    controller.abort();
    const blob = new Blob([noise(100_000) as BufferSource]);
    expect(await sha256OfBlobStreaming(blob, { signal: controller.signal })).toBeNull();
  });
});
