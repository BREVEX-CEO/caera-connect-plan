import { describe, expect, it } from "vitest";
import { randomBytes as nodeRandomBytes } from "node:crypto";
import {
  RECOVERY_CODE_BITS,
  RECOVERY_CODE_COUNT,
  drawSymbols,
  formatRecoveryCode,
  generateRecoveryCode,
  generateRecoveryCodes,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
} from "@/lib/security/recovery-codes";

const real = (length: number) => new Uint8Array(nodeRandomBytes(length));

describe("a recovery code is readable and hard to guess", () => {
  it("is printed in groups a person can read off paper", () => {
    expect(generateRecoveryCode(real)).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  });

  it("contains nothing that can be misread", () => {
    /*
     * I/L/1, O/0 and U are the confusions that send somebody to support with a
     * credential that was correct. Checked across many draws rather than one,
     * because a single sample would pass by luck.
     */
    for (let i = 0; i < 500; i += 1) {
      expect(generateRecoveryCode(real)).not.toMatch(/[ILOU]/);
    }
  });

  it("carries the entropy it claims", () => {
    expect(RECOVERY_CODE_BITS).toBe(50);
  });

  it("draws from the whole alphabet, not a corner of it", () => {
    // A generator that only ever emitted digits would satisfy every shape test
    // above while losing most of its entropy.
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      for (const character of normalizeRecoveryCode(generateRecoveryCode(real)))
        seen.add(character);
    }
    expect(seen.size).toBe(32);
  });

  it("is not biased towards the low end of the alphabet", () => {
    const counts = new Map<string, number>();
    const draws = 40_000;
    for (let i = 0; i < draws / 10; i += 1) {
      for (const character of normalizeRecoveryCode(generateRecoveryCode(real))) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }
    const expected = draws / 32;
    for (const [character, count] of counts) {
      // Generous: this is catching a systematic skew, not sampling noise.
      expect(Math.abs(count - expected) / expected, character).toBeLessThan(0.25);
    }
  });

  it("stays uniform over an alphabet whose size does NOT divide 256", () => {
    /*
     * THE TEST ABOVE CANNOT FAIL, AND THAT IS THE POINT OF THIS ONE.
     *
     * With 32 symbols, `byte % 32` is already perfectly uniform because 32
     * divides 256 — so replacing the rejection sampling with a bare modulo
     * leaves every measurement above unchanged. Checked by doing exactly that:
     * the suite stayed green, which means it was measuring an arithmetic
     * coincidence rather than the code.
     *
     * At 31 symbols the coincidence is gone: a bare modulo makes the first
     * `256 % 31 = 8` symbols about 12% more likely than the rest. That is the
     * shape of the real defect — introduced by adding one character to the
     * alphabet and noticing nothing — and it is what this measures.
     *
     * MEASURED WITHOUT RANDOMNESS, DELIBERATELY. The first version of this
     * drove the real generator and compared each symbol's share against a
     * tolerance, and the tolerance was ~3.6 standard deviations across 31
     * symbols — about one run in a hundred failed on sampling noise alone. A
     * test that fails once in a hundred runs for no reason teaches people to
     * re-run it, which is how a real failure gets waved through.
     *
     * A perfectly flat byte source removes the noise entirely and measures the
     * property directly: over every byte value 0-255, exactly once each, an
     * unbiased sampler must emit every symbol the same number of times. It is
     * also a strictly SHARPER instrument — a bare modulo is off by exactly one
     * count per early symbol, which no tolerance has to be chosen to detect.
     */
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXY"; // 31 symbols
    expect(alphabet.length).toBe(31);
    expect(256 % alphabet.length).not.toBe(0);

    /*
     * Every byte value, in order, forever. This is not a random source and is
     * not pretending to be one: it is the population the sampler must map
     * evenly, and a sampler that is unbiased over it is unbiased over any
     * source drawing bytes uniformly.
     */
    let next = 0;
    const everyByteEqually = (length: number) => {
      const out = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) {
        out[index] = next % 256;
        next += 1;
      }
      return out;
    };

    /*
     * 248 accepted bytes per 256, and 248 / 31 = 8 symbols each. Asking for
     * exactly one whole sweep's worth means a correct sampler produces a
     * perfectly flat histogram — an exact assertion rather than a tolerance.
     */
    const sweeps = 4;
    const perSymbol = 8 * sweeps;
    const counts = new Map<string, number>();
    for (const character of drawSymbols(perSymbol * alphabet.length, everyByteEqually, alphabet)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }

    expect(counts.size).toBe(alphabet.length);
    for (const symbol of alphabet) {
      // A bare modulo gives the first eight symbols 9 per sweep and the rest 8.
      expect(counts.get(symbol), symbol).toBe(perSymbol);
    }
  });
});

describe("a sheet of codes", () => {
  it("has the number it says", () => {
    expect(generateRecoveryCodes(real)).toHaveLength(RECOVERY_CODE_COUNT);
  });

  it("never repeats a code within one sheet", () => {
    /*
     * A duplicate collides on the table's unique (user_id, code_hash) and a
     * batch of ten silently becomes nine — while the person is told they have
     * ten. Forced here with a random source that always returns the same byte.
     */
    const stuck = (length: number) => new Uint8Array(length).fill(7);
    expect(() => generateRecoveryCodes(stuck, 5)).toThrow(/could not be generated/i);
  });

  it("gives every account a different sheet", () => {
    const first = new Set(generateRecoveryCodes(real));
    const second = new Set(generateRecoveryCodes(real));
    for (const code of second) expect(first.has(code)).toBe(false);
  });
});

describe("reading a code back the way people actually type it", () => {
  it("accepts lower case, missing hyphens and stray spaces", () => {
    const code = generateRecoveryCode(real);
    const canonical = normalizeRecoveryCode(code);
    for (const typed of [
      code.toLowerCase(),
      code.replace("-", ""),
      ` ${code} `,
      code.replace("-", " "),
      code.split("").join(" "),
    ]) {
      expect(normalizeRecoveryCode(typed), typed).toBe(canonical);
    }
  });

  it("folds exactly the characters the alphabet excludes, and nothing else", () => {
    expect(normalizeRecoveryCode("I")).toBe("1");
    expect(normalizeRecoveryCode("L")).toBe("1");
    expect(normalizeRecoveryCode("O")).toBe("0");
    expect(normalizeRecoveryCode("U")).toBe("V");
    // And a character the alphabet DOES contain is left alone. Folding one of
    // these would make two genuinely different codes equal.
    for (const character of "23456789ABCDEFGHJKMNPQRSTVWXYZ") {
      expect(normalizeRecoveryCode(character), character).toBe(character);
    }
  });

  it("recognises its own output and refuses near-misses", () => {
    expect(looksLikeRecoveryCode(generateRecoveryCode(real))).toBe(true);
    for (const nonsense of ["", "ABC", "A1B2C-3D4E", "A1B2C-3D4E56", "!!!!!-!!!!!"]) {
      expect(looksLikeRecoveryCode(nonsense), nonsense).toBe(false);
    }
  });

  it("prints a normalized code back in the shape it was issued in", () => {
    const code = generateRecoveryCode(real);
    expect(formatRecoveryCode(normalizeRecoveryCode(code))).toBe(code);
  });
});
