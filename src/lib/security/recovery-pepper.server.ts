/**
 * THE PEPPER, AND WHY A RECOVERY CODE IS NOT HASHED LIKE A PASSWORD.
 *
 * A password hash has to survive an attacker who has the hashes AND knows the
 * algorithm, which is why passwords get bcrypt or Argon2: a slow function is
 * the only defence when the input is guessable.
 *
 * A recovery code is not guessable. It is 50 bits from a uniform source, so
 * there is no dictionary to run and nothing for a work factor to slow down. The
 * threat is different: somebody who reads the table and wants to know which
 * codes it holds. Against that, a KEYED hash is the answer — with the key held
 * outside the database, a stolen table is a list of numbers with nothing to
 * compare them to, and no amount of compute helps.
 *
 * So: HMAC-SHA256 under a server pepper. Fast, constant work, and useless to
 * anybody who has the rows and not the key.
 *
 * IT FAILS CLOSED, LOUDLY. A missing pepper must never fall back to an unkeyed
 * digest or to a constant: both would silently turn every stored hash into
 * something an attacker with the table can reproduce, and neither would show up
 * as an error anywhere. Recovery is simply unavailable until the deployment is
 * configured, and the product says so.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const RECOVERY_PEPPER_VARIABLE = "OCADE_MFA_RECOVERY_PEPPER";

/**
 * Long enough that the key is a key.
 *
 * A short pepper is brute-forcible from a single known (code, hash) pair, which
 * an attacker gets by enrolling an account of their own — so the length is
 * checked rather than assumed. 32 characters is the minimum a deployment can
 * configure and be doing something real.
 */
export const MINIMUM_PEPPER_LENGTH = 32;

export class RecoveryUnconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryUnconfiguredError";
  }
}

function pepper(): string {
  const value = process.env[RECOVERY_PEPPER_VARIABLE];
  if (!value || value.trim().length === 0) {
    throw new RecoveryUnconfiguredError(
      `Recovery codes are not available: this deployment has no ${RECOVERY_PEPPER_VARIABLE}. ` +
        `Set one before offering recovery codes; OCADE will not store them under an unkeyed hash.`,
    );
  }
  if (value.trim().length < MINIMUM_PEPPER_LENGTH) {
    throw new RecoveryUnconfiguredError(
      `Recovery codes are not available: ${RECOVERY_PEPPER_VARIABLE} is shorter than ` +
        `${MINIMUM_PEPPER_LENGTH} characters, which is short enough to recover from a single ` +
        `known code. Set a longer one.`,
    );
  }
  return value;
}

/** True when this deployment can offer recovery codes at all. */
export function recoveryCodesConfigured(): boolean {
  try {
    pepper();
    return true;
  } catch {
    return false;
  }
}

/**
 * The stored form of one code: lowercase hex, 64 characters.
 *
 * BOUND TO THE ACCOUNT. The user id goes into the message, so the same code
 * issued to two accounts produces two different hashes. Without it, an attacker
 * who obtained one valid code could look for its hash across every row and find
 * every account that happens to share it.
 */
export function hashRecoveryCode(userId: string, normalizedCode: string): string {
  return createHmac("sha256", pepper()).update(`${userId}:${normalizedCode}`).digest("hex");
}

/**
 * Compare two stored hashes without leaking where they differ.
 *
 * The database lookup is an indexed equality probe and is the real comparison,
 * so this is for the paths that compare in JavaScript. `===` on a string exits
 * at the first differing byte; over enough samples that timing is a side
 * channel that reveals the value one character at a time.
 */
export function hashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  // `timingSafeEqual` throws on a length mismatch, which is itself a leak of
  // one bit — but hashes here are always 64 hex characters, so a difference in
  // length means malformed input rather than a near miss.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
