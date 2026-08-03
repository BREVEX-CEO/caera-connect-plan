/**
 * File integrity skill pack — a REAL, executed adapter for the security
 * category.
 *
 * Exercised against real files and real hashes in `integrity-pack.test.ts`.
 * This is the check that matters before OCADE opens, installs or trusts
 * anything it did not create: does this file match what it is supposed to be?
 *
 * Design rules, each of which exists because the opposite is a known failure:
 *  - comparison is CONSTANT-TIME, so a timing side channel cannot leak how much
 *    of a digest matched;
 *  - a truncated or mis-typed expected digest is REFUSED, not padded — a short
 *    digest that "matches" a prefix is the classic bypass;
 *  - MD5 and SHA-1 are refused for integrity decisions, because both have
 *    practical collisions and a matching digest proves nothing;
 *  - a file that cannot be read produces a failure, never a pass.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

/** Injected so tests use real crypto and production uses the companion. */
export interface DigestProvider {
  /** Hex digest of the file at `path` using `algorithm`. */
  hashFile(path: string, algorithm: string): Promise<string>;
}

const CAPABILITIES: SkillCapability[] = [
  {
    id: "integrity.hash",
    label: "Calculate a file's checksum",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "integrity.verify",
    label: "Check a file against an expected checksum",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "integrity.compare",
    label: "Check whether two files are identical",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
];

export const INTEGRITY_PACK: SkillPack = {
  appId: "ocade.integrity",
  displayName: "File integrity",
  category: "security_networking",
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
};

/**
 * Algorithms permitted for an integrity DECISION.
 *
 * MD5 and SHA-1 are deliberately absent: both have practical collisions, so a
 * matching digest does not establish that a file is the expected one. Accepting
 * them "because the vendor published one" would turn a security check into a
 * reassuring no-op.
 */
export const TRUSTED_ALGORITHMS = ["sha256", "sha384", "sha512"] as const;
export type TrustedAlgorithm = (typeof TRUSTED_ALGORITHMS)[number];

const DIGEST_LENGTH: Record<TrustedAlgorithm, number> = {
  sha256: 64,
  sha384: 96,
  sha512: 128,
};

export type IntegrityOutcome =
  | { ok: true; match: boolean; algorithm: TrustedAlgorithm; actual: string; evidence: string }
  | { ok: false; reason: string };

export function isTrustedAlgorithm(a: string): a is TrustedAlgorithm {
  return (TRUSTED_ALGORITHMS as readonly string[]).includes(a.toLowerCase());
}

/**
 * A digest must be exactly the right length and hex.
 *
 * A short digest that matches a prefix is the classic bypass, so anything of
 * the wrong length is refused outright rather than padded or compared loosely.
 */
export function isWellFormedDigest(digest: string, algorithm: TrustedAlgorithm): boolean {
  const d = digest.trim().toLowerCase();
  return d.length === DIGEST_LENGTH[algorithm] && /^[0-9a-f]+$/.test(d);
}

/**
 * Constant-time comparison.
 *
 * Returns after examining every character regardless of where the first
 * difference is, so response time cannot reveal how much of the digest matched.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Hash a file with a trusted algorithm. */
export async function hashFile(
  provider: DigestProvider,
  path: string,
  algorithm: string = "sha256",
): Promise<IntegrityOutcome> {
  if (!isTrustedAlgorithm(algorithm)) {
    return {
      ok: false,
      reason: `${algorithm.toUpperCase()} isn't strong enough to prove a file is what it claims to be. OCADE uses ${TRUSTED_ALGORITHMS.join(", ").toUpperCase()}.`,
    };
  }
  try {
    const actual = (await provider.hashFile(path, algorithm)).toLowerCase();
    return {
      ok: true,
      match: true,
      algorithm,
      actual,
      evidence: `${algorithm.toUpperCase()} of ${path}: ${actual.slice(0, 16)}…`,
    };
  } catch {
    // A file that cannot be read is a failure, never a pass.
    return { ok: false, reason: "That file could not be read, so its checksum is unknown." };
  }
}

/**
 * Verify a file against an expected digest.
 *
 * `match: false` is a SUCCESSFUL check with a negative result — the operation
 * worked and the answer is "this file is not what you expected". That is very
 * different from `ok: false`, which means the check could not be performed, and
 * conflating them is how a failed verification gets read as a pass.
 */
export async function verifyFile(
  provider: DigestProvider,
  path: string,
  expected: string,
  algorithm: string = "sha256",
): Promise<IntegrityOutcome> {
  if (!isTrustedAlgorithm(algorithm)) {
    return {
      ok: false,
      reason: `${algorithm.toUpperCase()} cannot establish integrity — it has known collisions.`,
    };
  }
  if (!isWellFormedDigest(expected, algorithm)) {
    return {
      ok: false,
      reason: `That doesn't look like a complete ${algorithm.toUpperCase()} checksum (expected ${DIGEST_LENGTH[algorithm]} hex characters). OCADE won't compare a partial one.`,
    };
  }

  const hashed = await hashFile(provider, path, algorithm);
  if (!hashed.ok) return hashed;

  const match = constantTimeEquals(hashed.actual, expected.trim().toLowerCase());
  return {
    ok: true,
    match,
    algorithm,
    actual: hashed.actual,
    evidence: match
      ? `${path} matches the expected ${algorithm.toUpperCase()} checksum.`
      : `${path} does NOT match the expected checksum. It may have been altered or incompletely downloaded — OCADE has not opened it.`,
  };
}

/** Compare two files by digest. */
export async function compareFiles(
  provider: DigestProvider,
  a: string,
  b: string,
  algorithm: string = "sha256",
): Promise<IntegrityOutcome> {
  const first = await hashFile(provider, a, algorithm);
  if (!first.ok) return first;
  const second = await hashFile(provider, b, algorithm);
  if (!second.ok) return second;

  const match = constantTimeEquals(first.actual, second.actual);
  return {
    ok: true,
    match,
    algorithm: first.algorithm,
    actual: first.actual,
    evidence: match ? "The two files are identical." : "The two files are different.",
  };
}
