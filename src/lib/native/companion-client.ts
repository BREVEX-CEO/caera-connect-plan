/**
 * OCADE → Native Companion IPC client (Plan §23).
 *
 * Builds the signed envelopes that `native/companion/safety/src/ipc.rs` verifies.
 * The two sides MUST agree byte-for-byte on the canonical string and the MAC, so
 * both implementations are kept deliberately small and mirrored, and the tests
 * pin the exact canonical format.
 *
 * Guarantees provided here:
 *  - a strictly increasing counter per session (rejects reordering);
 *  - a single-use random nonce per request (rejects exact replay);
 *  - a timestamp so the host can reject stale requests;
 *  - the session key never leaves this module — only the derived MAC is sent.
 *
 * The MAC is standard HMAC-SHA-256. It authenticates each local IPC request and
 * binds its canonical command body to the host-minted session key.
 *
 * ⚠ CROSS-LANGUAGE AGREEMENT: gated by golden vectors, not yet executed in Rust.
 *
 * Both sides now assert the SAME golden MAC table — "MAC parity with the Rust
 * host" in `src/lib/__tests__/companion-client.test.ts` and
 * `mac_matches_typescript_golden_vectors` in
 * `native/companion/safety/src/ipc.rs`. Drift on either side turns one of the
 * two suites red rather than silently rejecting every request as BadMac.
 *
 * The TypeScript half runs and passes. The Rust half type-checks but has never
 * been EXECUTED here, because the MSVC linker is unavailable. Running
 * `cargo test -p caera-companion-safety` on a machine with a linker is what
 * converts this from "compiles" to "verified" — treat it as a release gate.
 */

export const IPC_PROTOCOL = "v1";

export interface IpcEnvelope {
  session_id: string;
  counter: number;
  nonce: string;
  issued_at: number;
  body: string;
  mac: string;
}

/**
 * Canonical string the MAC covers. Mirrors `canonical()` in ipc.rs exactly:
 * "v1\n<session>\n<counter>\n<nonce>\n<issued_at>\n<body>".
 */
export function canonical(e: Omit<IpcEnvelope, "mac">): string {
  return [IPC_PROTOCOL, e.session_id, String(e.counter), e.nonce, String(e.issued_at), e.body].join(
    "\n",
  );
}

/** Constants and primitives for the host-compatible HMAC-SHA-256 signer. */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/** Small dependency-free SHA-256 core shared with the Rust safety crate. */
export function sha256(input: Uint8Array): Uint8Array {
  const bitLength = BigInt(input.length) * 8n;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Number((bitLength >> 32n) & 0xffffffffn), false);
  view.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn), false);

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index++) {
      const s0 =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const s1 =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index++) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choose + SHA256_K[index] + words[index]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  state.forEach((word, index) => digestView.setUint32(index * 4, word, false));
  return digest;
}

/** Mirrors the Rust host's standards-based HMAC-SHA-256 implementation. */
export function computeMac(key: Uint8Array, message: string): string {
  const block = new Uint8Array(64);
  block.set(key.length > 64 ? sha256(key) : key);
  const innerPad = block.map((byte) => byte ^ 0x36);
  const outerPad = block.map((byte) => byte ^ 0x5c);
  const encoded = new TextEncoder().encode(message);
  const inner = new Uint8Array(innerPad.length + encoded.length);
  inner.set(innerPad);
  inner.set(encoded, innerPad.length);
  const innerDigest = sha256(inner);
  const outer = new Uint8Array(outerPad.length + innerDigest.length);
  outer.set(outerPad);
  outer.set(innerDigest, outerPad.length);
  return [...sha256(outer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure randomness is unavailable for companion request signing.");
  }
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Per-session envelope factory. One instance per companion session; the counter
 * is monotonic for the life of that session.
 */
export class CompanionSession {
  private counter = 0;
  private readonly key: Uint8Array;
  private invalidated = false;

  constructor(
    private readonly sessionId: string,
    key: Uint8Array,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
    private readonly nonce: () => string = randomNonce,
  ) {
    if (!sessionId) throw new Error("A companion session needs an id.");
    if (key.length < 16) throw new Error("A companion session key must be at least 16 bytes.");
    // Own a private copy so invalidating this session does not mutate a caller's
    // reusable buffer while still letting us wipe the signer-held key.
    this.key = Uint8Array.from(key);
  }

  /** Build a signed envelope for a command + JSON args. */
  sign(command: string, args: unknown = {}): IpcEnvelope {
    if (this.invalidated) {
      throw new Error("The companion session is closed.");
    }
    this.counter += 1;
    const unsigned = {
      session_id: this.sessionId,
      counter: this.counter,
      nonce: this.nonce(),
      issued_at: this.now(),
      body: `${command}|${JSON.stringify(args ?? {})}`,
    };
    return { ...unsigned, mac: computeMac(this.key, canonical(unsigned)) };
  }

  /** Current counter — exposed for diagnostics and tests. */
  get sequence(): number {
    return this.counter;
  }

  /**
   * Permanently disable this signer and wipe its private key copy.
   *
   * Idempotent so every close path can fail closed without coordinating who
   * reached it first.
   */
  invalidate(): void {
    if (this.invalidated) return;
    this.invalidated = true;
    this.key.fill(0);
  }

  get active(): boolean {
    return !this.invalidated;
  }
}

/** Parse the canonical body back into its command and args. */
export function parseBody(body: string): { command: string; args: unknown } {
  const idx = body.indexOf("|");
  if (idx === -1) return { command: body, args: {} };
  const command = body.slice(0, idx);
  try {
    return { command, args: JSON.parse(body.slice(idx + 1)) };
  } catch {
    return { command, args: {} };
  }
}
