/**
 * SHA-256 that can be fed in pieces, paused, written down, and picked up again.
 *
 * WHY THIS EXISTS RATHER THAN `crypto.subtle.digest`.
 *
 * The platform digest takes one buffer. To check a downloaded engine against
 * its published fingerprint, the previous code did this:
 *
 *     crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
 *
 * On a gigabyte of weights that materialises the ENTIRE model in JavaScript
 * memory in one allocation, on the main thread, at the exact moment the user is
 * watching a progress bar. On a phone it is the documented way to have the tab
 * killed — and it happens after a successful download, so the failure lands on
 * the person who waited the longest.
 *
 * WebCrypto has no streaming digest, so this is a real SHA-256 implementation.
 * That is a cost worth paying twice over, because it buys two things the
 * platform primitive cannot give:
 *
 *  1. **Incremental.** Bytes are hashed as they arrive, in fixed blocks, with
 *     nothing but the current block resident. Verification stops being a phase
 *     after the download and becomes a property of it.
 *
 *  2. **Checkpointable.** SHA-256 is a block cipher over 64-byte blocks with a
 *     256-bit running state. At any block boundary the whole computation is
 *     eight 32-bit words plus a byte count — 40 bytes that can be persisted.
 *     So a download interrupted at 70% resumes hashing at 70% instead of
 *     re-reading 700 MB off disk to catch up. Resume becomes free rather than
 *     merely possible.
 *
 * IT IS NOT WEAKER THAN THE PLATFORM'S. This computes the same function over
 * the same bytes and is checked against `crypto.subtle.digest` in
 * `streaming-digest.test.ts` over empty input, sub-block input, exact block
 * multiples, block boundaries ±1, and multi-megabyte random input fed in
 * deliberately awkward splits. If those disagree, this file is wrong and the
 * suite says so. Nothing here relaxes the check to gain speed.
 */

/** SHA-256 round constants: cube roots of the first 64 primes. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Initial state: square roots of the first 8 primes. */
const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const BLOCK_BYTES = 64;

/**
 * A hasher's whole computation, small enough to persist beside a download.
 *
 * `bytes` is the total length consumed so far, which SHA-256 needs for the
 * length field in its final padding block. It is stored as a plain number: a
 * model is measured in gigabytes and `Number.MAX_SAFE_INTEGER` is nine
 * petabytes, so the precision is not in question here.
 */
export interface DigestCheckpoint {
  /** Eight 32-bit state words, lowercase hex, 8 characters each. */
  state: string;
  /** Bytes consumed at the moment of the checkpoint. */
  bytes: number;
}

/**
 * Feed bytes in, get a lowercase hex digest out.
 *
 * The instance is stateful and NOT safe to share between two downloads; each
 * transfer makes its own. `update` may be called with any sized chunk — a
 * partial block is carried until the rest of it arrives.
 */
export class StreamingSha256 {
  private readonly h = new Uint32Array(H0);
  /** Bytes of the current, not-yet-full 64-byte block. */
  private readonly tail = new Uint8Array(BLOCK_BYTES);
  private tailLength = 0;
  private totalBytes = 0;
  private finished = false;

  /** Message schedule, allocated once rather than per block. */
  private readonly w = new Uint32Array(64);

  /**
   * Resume from a checkpoint.
   *
   * A checkpoint is only ever taken on a block boundary, so there is no partial
   * block to restore. An unparseable checkpoint throws rather than silently
   * starting from zero: a hasher that quietly forgets its history would report
   * a mismatch on a perfectly good file, and the caller would then delete it.
   */
  static resume(checkpoint: DigestCheckpoint): StreamingSha256 {
    const hasher = new StreamingSha256();
    if (!/^[0-9a-f]{64}$/.test(checkpoint.state)) {
      throw new Error("Digest checkpoint state is not 64 hex characters.");
    }
    if (!Number.isFinite(checkpoint.bytes) || checkpoint.bytes < 0) {
      throw new Error("Digest checkpoint byte count is not a number.");
    }
    if (checkpoint.bytes % BLOCK_BYTES !== 0) {
      throw new Error("Digest checkpoints are only valid on 64-byte boundaries.");
    }
    for (let i = 0; i < 8; i += 1) {
      hasher.h[i] = Number.parseInt(checkpoint.state.slice(i * 8, i * 8 + 8), 16) >>> 0;
    }
    hasher.totalBytes = checkpoint.bytes;
    return hasher;
  }

  /** Bytes consumed so far. */
  get length(): number {
    return this.totalBytes;
  }

  /** Absorb a chunk. Any length; partial blocks are carried. */
  update(chunk: Uint8Array): this {
    if (this.finished) throw new Error("This digest has already been finalised.");
    let offset = 0;
    const length = chunk.length;

    // Top up a partial block left by the previous call.
    if (this.tailLength > 0) {
      const need = BLOCK_BYTES - this.tailLength;
      const take = Math.min(need, length);
      this.tail.set(chunk.subarray(0, take), this.tailLength);
      this.tailLength += take;
      offset = take;
      if (this.tailLength === BLOCK_BYTES) {
        this.compress(this.tail, 0);
        this.tailLength = 0;
      }
    }

    // Whole blocks straight out of the caller's buffer — no copying.
    while (length - offset >= BLOCK_BYTES) {
      this.compress(chunk, offset);
      offset += BLOCK_BYTES;
    }

    // Whatever is left is the new tail.
    if (offset < length) {
      this.tail.set(chunk.subarray(offset), 0);
      this.tailLength = length - offset;
    }

    this.totalBytes += length;
    return this;
  }

  /**
   * The computation so far, as something that can be written to storage.
   *
   * Returns null when the hasher is mid-block. That is deliberate: a checkpoint
   * that silently dropped the partial block would resume with a state that has
   * skipped bytes and produce a wrong digest for a correct file. Callers align
   * their checkpoints to block boundaries (chunk sizes here are multiples of
   * 64) and treat null as "not a checkpoint moment".
   */
  checkpoint(): DigestCheckpoint | null {
    if (this.finished || this.tailLength !== 0) return null;
    let state = "";
    for (let i = 0; i < 8; i += 1) state += this.h[i].toString(16).padStart(8, "0");
    return { state, bytes: this.totalBytes };
  }

  /** Pad, absorb the length, and return the lowercase hex digest. */
  digest(): string {
    if (this.finished) throw new Error("This digest has already been finalised.");
    this.finished = true;

    const bitLength = this.totalBytes * 8;
    // One 0x80 byte, then zeros, then an 8-byte big-endian bit length.
    const padLength = this.tailLength < 56 ? 56 - this.tailLength : 120 - this.tailLength;
    const padding = new Uint8Array(padLength + 8);
    padding[0] = 0x80;
    // Written as two 32-bit halves: bit lengths beyond 2^53 are not reachable
    // here and a BigInt would be the only alternative.
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    const view = new DataView(padding.buffer);
    view.setUint32(padLength, high, false);
    view.setUint32(padLength + 4, low, false);

    // Absorb padding through the same path, but without counting it.
    const counted = this.totalBytes;
    this.finished = false;
    this.update(padding);
    this.finished = true;
    this.totalBytes = counted;

    let out = "";
    for (let i = 0; i < 8; i += 1) out += this.h[i].toString(16).padStart(8, "0");
    return out;
  }

  /** One 64-byte block, read in place from `data` at `at`. */
  private compress(data: Uint8Array, at: number): void {
    const w = this.w;
    for (let i = 0; i < 16; i += 1) {
      const j = at + i * 4;
      w[i] = ((data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
      const s1 = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = this.h[0];
    let b = this.h[1];
    let c = this.h[2];
    let d = this.h[3];
    let e = this.h[4];
    let f = this.h[5];
    let g = this.h[6];
    let h = this.h[7];

    for (let i = 0; i < 64; i += 1) {
      const S1 =
        (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 =
        (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    this.h[0] = (this.h[0] + a) >>> 0;
    this.h[1] = (this.h[1] + b) >>> 0;
    this.h[2] = (this.h[2] + c) >>> 0;
    this.h[3] = (this.h[3] + d) >>> 0;
    this.h[4] = (this.h[4] + e) >>> 0;
    this.h[5] = (this.h[5] + f) >>> 0;
    this.h[6] = (this.h[6] + g) >>> 0;
    this.h[7] = (this.h[7] + h) >>> 0;
  }
}

/**
 * SHA-256 of a blob, read in bounded pieces.
 *
 * The replacement for `blob.arrayBuffer()` at the call sites that genuinely
 * have a blob and no running hasher — importing a file the user chose, and
 * repairing a staging file whose checkpoint was lost. Memory stays at one
 * `sliceBytes` regardless of how large the blob is.
 */
export async function sha256OfBlobStreaming(
  blob: Blob,
  options?: { sliceBytes?: number; onProgress?: (read: number) => void; signal?: AbortSignal },
): Promise<string | null> {
  const slice = options?.sliceBytes ?? 8 * 1024 * 1024;
  const hasher = new StreamingSha256();
  try {
    /*
     * `blob.stream()` where it exists, `blob.slice()` where it does not.
     *
     * Both read a bounded window. The stream is preferred because it lets the
     * platform choose the read size and avoids one copy per slice; the slice
     * path exists because some older WebView builds expose Blob without
     * `stream()`, and those are exactly the devices least able to afford a
     * whole-file allocation.
     */
    if (typeof blob.stream === "function") {
      const reader = blob.stream().getReader();
      let read = 0;
      for (;;) {
        if (options?.signal?.aborted) return null;
        const { done, value } = await reader.read();
        if (done) break;
        hasher.update(value);
        read += value.length;
        options?.onProgress?.(read);
      }
    } else {
      for (let at = 0; at < blob.size; at += slice) {
        if (options?.signal?.aborted) return null;
        const part = blob.slice(at, Math.min(at + slice, blob.size));
        hasher.update(new Uint8Array(await part.arrayBuffer()));
        options?.onProgress?.(Math.min(at + slice, blob.size));
      }
    }
    return hasher.digest();
  } catch {
    // A blob that cannot be read is UNVERIFIED, never verified. The caller
    // treats null as "could not check", which is not the same as "matched".
    return null;
  }
}
