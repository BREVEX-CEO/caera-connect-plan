import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  INTEGRITY_PACK,
  hashFile,
  verifyFile,
  compareFiles,
  constantTimeEquals,
  isWellFormedDigest,
  isTrustedAlgorithm,
  TRUSTED_ALGORITHMS,
  type DigestProvider,
} from "../skills/packs/integrity-pack";

/**
 * REAL CRYPTO TEST.
 *
 * Files are written to disk and hashed with Node's real crypto. Expected
 * digests are computed independently in the test, so a wrong implementation
 * fails here rather than silently passing every file as "verified".
 */

const realDigest: DigestProvider = {
  hashFile: async (path, algorithm) => {
    const buf = await readFile(path);
    return createHash(algorithm).update(buf).digest("hex");
  },
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ocade-integrity-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function fileWith(name: string, content: string) {
  const p = join(dir, name);
  await writeFile(p, content, "utf8");
  return p;
}

/** Independently computed, so the pack cannot mark its own homework. */
function expectedHash(content: string, algorithm = "sha256") {
  return createHash(algorithm).update(Buffer.from(content, "utf8")).digest("hex");
}

describe("hashing a real file", () => {
  it("produces the same digest as an independent calculation", async () => {
    const p = await fileWith("a.txt", "hello world");
    const r = await hashFile(realDigest, p);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.actual).toBe(expectedHash("hello world"));
  });

  it("supports every trusted algorithm", async () => {
    const p = await fileWith("b.txt", "content");
    for (const alg of TRUSTED_ALGORITHMS) {
      const r = await hashFile(realDigest, p, alg);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("unreachable");
      expect(r.actual).toBe(expectedHash("content", alg));
    }
  });

  it("reports an unreadable file as a FAILURE, never a pass", async () => {
    const r = await hashFile(realDigest, join(dir, "missing.txt"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/could not be read/i);
  });
});

/**
 * MD5 and SHA-1 have practical collisions, so a matching digest proves nothing.
 * Accepting them would turn a security check into a reassuring no-op.
 */
describe("weak algorithms are refused for integrity decisions", () => {
  it.each(["md5", "sha1", "MD5", "SHA1"])("refuses %s", async (alg) => {
    const p = await fileWith("c.txt", "x");
    const r = await hashFile(realDigest, p, alg);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/isn't strong enough|known collisions/i);
  });

  it("does not treat md5 or sha1 as trusted", () => {
    expect(isTrustedAlgorithm("md5")).toBe(false);
    expect(isTrustedAlgorithm("sha1")).toBe(false);
    expect(isTrustedAlgorithm("sha256")).toBe(true);
  });
});

describe("verifying against an expected checksum", () => {
  it("confirms a genuine match", async () => {
    const p = await fileWith("good.txt", "trusted content");
    const r = await verifyFile(realDigest, p, expectedHash("trusted content"));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.match).toBe(true);
    expect(r.evidence).toMatch(/matches the expected/i);
  });

  /**
   * A mismatch is a SUCCESSFUL check with a negative answer. Conflating it with
   * "the check failed" is how a failed verification gets read as a pass.
   */
  it("detects tampering and says the file was NOT opened", async () => {
    const p = await fileWith("tampered.txt", "altered content");
    const r = await verifyFile(realDigest, p, expectedHash("original content"));
    expect(r.ok).toBe(true); // the check ran
    if (!r.ok) throw new Error("unreachable");
    expect(r.match).toBe(false); // and the answer is no
    expect(r.evidence).toMatch(/does NOT match/);
    expect(r.evidence).toMatch(/has not opened it/i);
  });

  it("detects a single-byte change", async () => {
    const p = await fileWith("subtle.txt", "aaaaaaaaab");
    const r = await verifyFile(realDigest, p, expectedHash("aaaaaaaaaa"));
    if (!r.ok) throw new Error("unreachable");
    expect(r.match).toBe(false);
  });

  /** A short digest that "matches" a prefix is the classic bypass. */
  it("REFUSES a truncated digest rather than comparing a prefix", async () => {
    const p = await fileWith("d.txt", "content");
    const full = expectedHash("content");
    const r = await verifyFile(realDigest, p, full.slice(0, 32));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't compare a partial one/i);
  });

  it.each(["", "not-hex-at-all", "zzzz", "0123"])("refuses the malformed digest %o", async (d) => {
    const p = await fileWith("e.txt", "content");
    const r = await verifyFile(realDigest, p, d);
    expect(r.ok).toBe(false);
  });

  it("accepts a correct digest regardless of case or surrounding space", async () => {
    const p = await fileWith("f.txt", "content");
    const r = await verifyFile(realDigest, p, `  ${expectedHash("content").toUpperCase()}  `);
    if (!r.ok) throw new Error("unreachable");
    expect(r.match).toBe(true);
  });

  it("validates digest length per algorithm", () => {
    expect(isWellFormedDigest("a".repeat(64), "sha256")).toBe(true);
    expect(isWellFormedDigest("a".repeat(64), "sha512")).toBe(false);
    expect(isWellFormedDigest("a".repeat(128), "sha512")).toBe(true);
  });
});

/**
 * A timing side channel would leak how much of a digest matched, letting an
 * attacker discover a valid one byte by byte.
 */
describe("comparison is constant-time", () => {
  it("agrees with ordinary equality", () => {
    expect(constantTimeEquals("abc", "abc")).toBe(true);
    expect(constantTimeEquals("abc", "abd")).toBe(false);
    expect(constantTimeEquals("abc", "ab")).toBe(false);
    expect(constantTimeEquals("", "")).toBe(true);
  });

  it("takes comparable time whether the difference is first or last", () => {
    const a = "a".repeat(4096);
    const diffFirst = `b${"a".repeat(4095)}`;
    const diffLast = `${"a".repeat(4095)}b`;

    const time = (x: string, y: string) => {
      const start = process.hrtime.bigint();
      for (let i = 0; i < 2000; i++) constantTimeEquals(x, y);
      return Number(process.hrtime.bigint() - start);
    };

    // Warm up so JIT compilation does not skew the first measurement.
    time(a, diffFirst);
    time(a, diffLast);

    const first = time(a, diffFirst);
    const last = time(a, diffLast);
    const ratio = Math.max(first, last) / Math.max(1, Math.min(first, last));

    // A naive early-return comparison shows an enormous ratio here. This is a
    // generous bound: the point is that it does not scale with match length.
    expect(ratio).toBeLessThan(5);
  });
});

describe("comparing two files", () => {
  it("reports identical files", async () => {
    const a = await fileWith("x1.txt", "same");
    const b = await fileWith("x2.txt", "same");
    const r = await compareFiles(realDigest, a, b);
    if (!r.ok) throw new Error("unreachable");
    expect(r.match).toBe(true);
  });

  it("reports different files", async () => {
    const a = await fileWith("y1.txt", "one");
    const b = await fileWith("y2.txt", "two");
    const r = await compareFiles(realDigest, a, b);
    if (!r.ok) throw new Error("unreachable");
    expect(r.match).toBe(false);
  });

  it("fails honestly when either file is missing", async () => {
    const a = await fileWith("z.txt", "one");
    expect((await compareFiles(realDigest, a, join(dir, "nope.txt"))).ok).toBe(false);
    expect((await compareFiles(realDigest, join(dir, "nope.txt"), a)).ok).toBe(false);
  });
});

describe("the pack is honest about itself", () => {
  it("is entirely read-only", () => {
    for (const c of INTEGRITY_PACK.capabilities) expect(c.mutating).toBe(false);
  });

  it("uses direct file access, never vision", () => {
    for (const c of INTEGRITY_PACK.capabilities) expect(c.methods).toEqual(["file"]);
  });
});
