import { describe, it, expect } from "vitest";
import {
  CompanionSession,
  canonical,
  computeMac,
  parseBody,
  IPC_PROTOCOL,
  sha256,
} from "../native/companion-client";

const KEY = new TextEncoder().encode("local-session-key-0123456789");

describe("canonical form (must match ipc.rs byte-for-byte)", () => {
  it("uses the exact newline-joined v1 layout", () => {
    const s = canonical({
      session_id: "s1",
      counter: 7,
      nonce: "abc",
      issued_at: 1000,
      body: "window.list|{}",
    });
    // If this string ever changes, the Rust verifier must change with it.
    expect(s).toBe(`${IPC_PROTOCOL}\ns1\n7\nabc\n1000\nwindow.list|{}`);
    expect(s.split("\n")).toHaveLength(6);
  });
});

describe("computeMac", () => {
  it("produces a standard 64-character HMAC-SHA-256 digest", () => {
    const mac = computeMac(KEY, "message");
    expect(mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same key and message", () => {
    expect(computeMac(KEY, "m")).toBe(computeMac(KEY, "m"));
  });

  it("changes with the key", () => {
    const other = new TextEncoder().encode("different-key-0123456789");
    expect(computeMac(KEY, "m")).not.toBe(computeMac(other, "m"));
  });

  it("changes with the message — including a one-character edit", () => {
    expect(computeMac(KEY, "m1")).not.toBe(computeMac(KEY, "m2"));
    expect(computeMac(KEY, "window.list|{}")).not.toBe(computeMac(KEY, "window.list|{} "));
  });

  it("handles an empty message without throwing", () => {
    expect(computeMac(KEY, "")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches standard SHA-256 vectors used by HMAC", () => {
    const hex = (bytes: Uint8Array) =>
      [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(hex(sha256(new Uint8Array()))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(hex(sha256(new TextEncoder().encode("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("CompanionSession", () => {
  function session(overrides: { now?: () => number; nonce?: () => string } = {}) {
    let n = 0;
    return new CompanionSession(
      "s1",
      KEY,
      overrides.now ?? (() => 1000),
      overrides.nonce ?? (() => `n${++n}`),
    );
  }

  it("rejects a missing id or a weak key", () => {
    expect(() => new CompanionSession("", KEY)).toThrow(/id/i);
    expect(() => new CompanionSession("s", new Uint8Array(4))).toThrow(/16 bytes/i);
  });

  it("increments the counter strictly on every request", () => {
    const s = session();
    expect(s.sign("a").counter).toBe(1);
    expect(s.sign("b").counter).toBe(2);
    expect(s.sign("c").counter).toBe(3);
    expect(s.sequence).toBe(3);
  });

  it("uses a fresh nonce per request", () => {
    const s = session();
    const a = s.sign("x");
    const b = s.sign("x");
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("produces a MAC that verifies against its own canonical form", () => {
    const s = session();
    const env = s.sign("window.list", {});
    const { mac, ...unsigned } = env;
    expect(computeMac(KEY, canonical(unsigned))).toBe(mac);
  });

  it("produces DIFFERENT macs for identical commands (counter + nonce differ)", () => {
    const s = session();
    // This is what defeats replay: the same command never signs the same twice.
    expect(s.sign("window.list").mac).not.toBe(s.sign("window.list").mac);
  });

  it("encodes command and args into the canonical body", () => {
    const s = session();
    const env = s.sign("file.open", { path: "C:/notes.md" });
    expect(env.body).toBe('file.open|{"path":"C:/notes.md"}');
  });

  it("stamps the issue time so the host can reject stale requests", () => {
    const s = session({ now: () => 4242 });
    expect(s.sign("x").issued_at).toBe(4242);
  });

  it("tampering with the body invalidates the MAC", () => {
    const s = session();
    const env = s.sign("app.open", { appId: "notepad" });
    const tampered = { ...env, body: 'app.open|{"appId":"cmd.exe"}' };
    const { mac, ...unsigned } = tampered;
    expect(computeMac(KEY, canonical(unsigned))).not.toBe(mac);
  });

  it("cannot sign again after the session is invalidated", () => {
    const s = session();
    s.sign("window.list");
    s.invalidate();
    expect(s.active).toBe(false);
    expect(() => s.sign("window.list")).toThrow(/closed/i);
    expect(s.sequence).toBe(1);
  });

  it("invalidation is idempotent and does not wipe the caller-owned key buffer", () => {
    const callerKey = Uint8Array.from(KEY);
    const before = Uint8Array.from(callerKey);
    const s = new CompanionSession(
      "s1",
      callerKey,
      () => 1000,
      () => "n1",
    );
    s.invalidate();
    s.invalidate();
    expect(callerKey).toEqual(before);
    expect(s.active).toBe(false);
  });
});

describe("parseBody", () => {
  it("round-trips command and args", () => {
    expect(parseBody('file.open|{"path":"a"}')).toEqual({
      command: "file.open",
      args: { path: "a" },
    });
  });

  it("handles a body with no args", () => {
    expect(parseBody("window.list")).toEqual({ command: "window.list", args: {} });
  });

  it("degrades safely on malformed args instead of throwing", () => {
    expect(parseBody("x|{not json")).toEqual({ command: "x", args: {} });
  });
});

/**
 * CROSS-LANGUAGE PARITY GATE.
 *
 * The TypeScript client and the Rust host must compute byte-identical MACs, or
 * every request is rejected as BadMac and computer control silently stops
 * working. "Mirrored by construction" is not a guarantee — these vectors are
 * the guarantee.
 *
 * The SAME table is asserted in `native/companion/safety/src/ipc.rs`
 * (`mac_matches_typescript_golden_vectors`). If either implementation drifts,
 * one of the two suites goes red immediately.
 *
 * Do NOT regenerate these values to make a failure go away — a change here is a
 * wire-format break that requires both sides to be updated deliberately.
 */
describe("MAC parity with the Rust host", () => {
  const vectors: { name: string; key: number[]; message: string; mac: string }[] = [
    {
      name: "empty body",
      key: new Array(16).fill(0),
      message: "",
      mac: "b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad",
    },
    {
      name: "all-zero key",
      key: new Array(16).fill(0),
      message: "hello",
      mac: "4352b26e33fe0d769a8922a6ba29004109f01688e26acc9e6cb347e5a5afc4da",
    },
    {
      name: "all-ff key",
      key: new Array(16).fill(255),
      message: "hello",
      mac: "a63f5f66bd92dd410d86f90c717b2e2b78b4ff80ddbb420ff8b9b1e6ec9d42d2",
    },
    {
      name: "ascending 32-byte key",
      key: Array.from({ length: 32 }, (_, i) => i),
      message: "execute|{}",
      mac: "66f622a05c403010ddd5321f0c1d1479f751b28289f48d501b5de25febd2d225",
    },
    {
      name: "full canonical envelope",
      key: new Array(32).fill(7),
      message:
        'v1\ns1\n1\n0123456789abcdef0123456789abcdef\n1700000000\nexecute|{"action":{"kind":"window.list"},"confirmed":false}',
      mac: "fd2cb2eb23bcb1e585d297c9749fa9e8735b620f83ff4b6e52f91298dbdf1021",
    },
    {
      // Multi-byte input proves both sides hash UTF-8 BYTES, not UTF-16 units.
      name: "utf-8 multibyte",
      key: new Array(16).fill(1),
      message: "café — naïve ✓",
      mac: "f7d66e600107f2f21a68fc8d71efb98f595925fadd8b18dbbbcd08d9e7c078d5",
    },
  ];

  it.each(vectors)("matches the golden MAC for $name", ({ key, message, mac }) => {
    expect(computeMac(Uint8Array.from(key), message)).toBe(mac);
  });

  it("produces a 64-hex-character MAC for every vector", () => {
    for (const v of vectors) {
      expect(computeMac(Uint8Array.from(v.key), v.message)).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("changes when the key changes", () => {
    const a = computeMac(new Uint8Array(16).fill(0), "same message");
    const b = computeMac(new Uint8Array(16).fill(1), "same message");
    expect(a).not.toBe(b);
  });

  it("changes when a single byte of the message changes", () => {
    const key = new Uint8Array(16).fill(3);
    expect(computeMac(key, "message a")).not.toBe(computeMac(key, "message b"));
  });

  it("covers the canonical string the envelope actually produces", () => {
    const built = canonical({
      session_id: "s1",
      counter: 1,
      nonce: "0123456789abcdef0123456789abcdef",
      issued_at: 1700000000,
      body: 'execute|{"action":{"kind":"window.list"},"confirmed":false}',
    });
    expect(built).toBe(vectors[4].message);
    expect(computeMac(new Uint8Array(32).fill(7), built)).toBe(vectors[4].mac);
  });
});
