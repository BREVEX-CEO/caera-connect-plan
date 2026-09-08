import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MINIMUM_PEPPER_LENGTH,
  RECOVERY_PEPPER_VARIABLE,
  RecoveryUnconfiguredError,
  hashRecoveryCode,
  hashesMatch,
  recoveryCodesConfigured,
} from "@/lib/security/recovery-pepper.server";

const GOOD = "a".repeat(48);
let original: string | undefined;

beforeEach(() => {
  original = process.env[RECOVERY_PEPPER_VARIABLE];
});
afterEach(() => {
  if (original === undefined) delete process.env[RECOVERY_PEPPER_VARIABLE];
  else process.env[RECOVERY_PEPPER_VARIABLE] = original;
});

describe("a missing or weak pepper stops recovery rather than weakening it", () => {
  it("refuses to hash with no pepper at all", () => {
    delete process.env[RECOVERY_PEPPER_VARIABLE];
    /*
     * THE FAILURE THAT WOULD NEVER BE NOTICED. Falling back to an unkeyed
     * digest here produces a perfectly valid-looking hex string, stores it, and
     * silently turns every recovery code in the database into something anybody
     * with the table can reproduce. Nothing would error, and no screen would
     * look different.
     */
    expect(() => hashRecoveryCode("user-1", "ABCDE12345")).toThrow(RecoveryUnconfiguredError);
    expect(recoveryCodesConfigured()).toBe(false);
  });

  it("refuses a pepper short enough to brute-force from one known code", () => {
    process.env[RECOVERY_PEPPER_VARIABLE] = "a".repeat(MINIMUM_PEPPER_LENGTH - 1);
    expect(() => hashRecoveryCode("user-1", "ABCDE12345")).toThrow(/shorter than/i);
    expect(recoveryCodesConfigured()).toBe(false);
  });

  it("refuses whitespace pretending to be a pepper", () => {
    process.env[RECOVERY_PEPPER_VARIABLE] = "   ";
    expect(() => hashRecoveryCode("user-1", "ABCDE12345")).toThrow(RecoveryUnconfiguredError);
  });

  it("reports itself configured once a real pepper is set", () => {
    process.env[RECOVERY_PEPPER_VARIABLE] = GOOD;
    expect(recoveryCodesConfigured()).toBe(true);
  });

  it("never puts the pepper in the message it throws", () => {
    // An error goes to a log, and a log goes somewhere else.
    process.env[RECOVERY_PEPPER_VARIABLE] = "short-secret-value";
    try {
      hashRecoveryCode("user-1", "ABCDE12345");
      throw new Error("expected a refusal");
    } catch (error) {
      expect(String(error)).not.toContain("short-secret-value");
    }
  });
});

describe("the stored hash", () => {
  beforeEach(() => {
    process.env[RECOVERY_PEPPER_VARIABLE] = GOOD;
  });

  it("is 64 lowercase hex characters, matching the column's constraint", () => {
    // The table CHECKs `^[0-9a-f]{64}$`. A hash in another shape is rejected by
    // the database at write time, which is a failure nobody sees until a real
    // person tries to generate codes.
    expect(hashRecoveryCode("user-1", "ABCDE12345")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same account and code", () => {
    expect(hashRecoveryCode("user-1", "ABCDE12345")).toBe(hashRecoveryCode("user-1", "ABCDE12345"));
  });

  it("BINDS THE CODE TO THE ACCOUNT", () => {
    /*
     * Without the user id in the message, one leaked code would let an attacker
     * search every row for its hash and find every account that happens to hold
     * the same one — turning a single compromised sheet into a list of targets.
     */
    expect(hashRecoveryCode("user-1", "ABCDE12345")).not.toBe(
      hashRecoveryCode("user-2", "ABCDE12345"),
    );
  });

  it("changes completely when the pepper changes", () => {
    const before = hashRecoveryCode("user-1", "ABCDE12345");
    process.env[RECOVERY_PEPPER_VARIABLE] = "b".repeat(48);
    expect(hashRecoveryCode("user-1", "ABCDE12345")).not.toBe(before);
  });

  it("does not contain the code it was made from", () => {
    const code = "ZZZZZ99999";
    expect(hashRecoveryCode("user-1", code)).not.toContain(code.toLowerCase());
  });
});

describe("comparing hashes", () => {
  it("matches identical values and rejects different ones", () => {
    const a = "a".repeat(64);
    expect(hashesMatch(a, a)).toBe(true);
    expect(hashesMatch(a, "b".repeat(64))).toBe(false);
  });

  it("returns false rather than throwing on a length mismatch", () => {
    // `timingSafeEqual` throws when lengths differ, and an exception thrown out
    // of a credential check is a 500 where a "no" belongs.
    expect(hashesMatch("abc", "a".repeat(64))).toBe(false);
    expect(hashesMatch("", "")).toBe(true);
  });
});
