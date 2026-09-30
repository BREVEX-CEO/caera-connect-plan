/**
 * RECOVERY CODES: HOW THEY ARE MADE, WRITTEN DOWN, AND CHECKED.
 *
 * Pure and dependency-free on purpose. Every decision here is one where the
 * wrong choice is invisible — a code that reads fine, hashes fine, and is
 * guessable; a comparison that leaks its answer through timing — so all of it
 * is reachable from a test without a database, a browser or a network.
 *
 * WHAT A CODE IS FOR. Not a login factor. Supabase does not expose recovery
 * codes through its TOTP API, so an OCADE code proves exactly one thing: the
 * person holding an already-authenticated session is entitled to have a lost
 * second factor REMOVED. It buys a factor reset and never account access.
 *
 * THE ALPHABET IS DELIBERATELY SMALL. Crockford base32 without I, L, O and U:
 * nothing in it can be confused with anything else when read off a screen and
 * typed on a phone, and U is dropped so the generator cannot produce a word
 * somebody would be embarrassed to read out to support.
 *
 * ENTROPY, COUNTED RATHER THAN ASSUMED. 32 symbols is 5 bits each, and a code
 * is four groups of five: 100 bits. That number is what lets the database hold
 * a plain SHA-256 of each code with no server-held secret: nobody who copied
 * the table could search 2^100 codes, so there is no pepper to configure, to
 * lose, or to be missing on the day somebody needs to recover. (An earlier
 * version used 50-bit codes under a pepper no deployment ever set, and so
 * could never issue a code at all.)
 */

/** Crockford base32 less I, L, O and U. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUP = 5;
const GROUPS = 4;
/** Ten sheets is the number people can actually keep. */
export const RECOVERY_CODE_COUNT = 10;
/** 20 characters × 5 bits. Stated so a future edit cannot silently lower it. */
export const RECOVERY_CODE_BITS = GROUP * GROUPS * Math.log2(ALPHABET.length);

/**
 * Draw random symbols WITHOUT modulo bias.
 *
 * `random % 32` is unbiased only because 32 divides 256 exactly — true today,
 * and exactly the kind of fact that stops being true when somebody adds a
 * character to the alphabet and does not notice the distribution has gone
 * lopsided. Rejection sampling is correct for EVERY alphabet size, so the
 * property does not depend on remembering this comment.
 *
 * THE ALPHABET IS A PARAMETER SO THE PROPERTY CAN BE TESTED. Against the real
 * 32-symbol alphabet a plain modulo is indistinguishable from this, so a test
 * using it would pass whether or not the rejection was here — it would measure
 * a coincidence of arithmetic rather than the code. Exported for the test to
 * drive with an alphabet whose size does NOT divide 256, where the difference
 * is visible.
 */
export function drawSymbols(
  count: number,
  randomBytes: (length: number) => Uint8Array,
  alphabet: string = ALPHABET,
): string {
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let out = "";
  while (out.length < count) {
    // Over-draw: rejections are rare, and one syscall beats one per symbol.
    const bytes = randomBytes(Math.max(8, (count - out.length) * 2));
    for (const byte of bytes) {
      if (byte >= limit) continue;
      out += alphabet[byte % alphabet.length];
      if (out.length === count) break;
    }
  }
  return out;
}

/** One code, as it is shown: `A1B2C-3D4E5-F6G7H-J8K9M`. */
export function generateRecoveryCode(randomBytes: (length: number) => Uint8Array): string {
  const symbols = drawSymbols(GROUP * GROUPS, randomBytes);
  const groups: string[] = [];
  for (let index = 0; index < GROUPS; index += 1) {
    groups.push(symbols.slice(index * GROUP, (index + 1) * GROUP));
  }
  return groups.join("-");
}

/** A fresh sheet. Distinct by construction, not by luck. */
export function generateRecoveryCodes(
  randomBytes: (length: number) => Uint8Array,
  count = RECOVERY_CODE_COUNT,
): string[] {
  const codes = new Set<string>();
  /*
   * A collision at 100 bits is vanishingly unlikely and NOT impossible, and the
   * consequence is not cosmetic: two identical codes collide on the table's
   * unique (user_id, code_hash) constraint, so a batch of ten would silently
   * become a batch of nine and the person would be told they had ten.
   *
   * The loop is bounded so a broken random source cannot hang the request.
   */
  for (let attempt = 0; codes.size < count && attempt < count * 20; attempt += 1) {
    codes.add(generateRecoveryCode(randomBytes));
  }
  if (codes.size < count) {
    throw new Error("Recovery codes could not be generated from this random source.");
  }
  return [...codes];
}

/**
 * Accept a code however the person typed it back.
 *
 * Somebody reading off paper will use lower case, drop the hyphen, or add a
 * space. None of those is a wrong code, and refusing them would send people to
 * support with a credential that was correct. The confusable characters are
 * folded to what the alphabet actually contains, so a hand-written `O` read
 * back as a zero still works.
 *
 * NOT a place for cleverness: only the four confusions the alphabet
 * deliberately excludes are folded. Mapping anything else would make two
 * genuinely different codes equal.
 */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");
}

/** Shape only. Says nothing about whether a code is real. */
export function looksLikeRecoveryCode(input: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${GROUP * GROUPS}}$`).test(normalizeRecoveryCode(input));
}

/**
 * Group a normalized code back into the form it was printed in.
 *
 * So the "you have used this one" line in an audit trail, and anything shown
 * back to a person, matches the sheet in their hand.
 */
export function formatRecoveryCode(normalized: string): string {
  const groups: string[] = [];
  for (let index = 0; index < normalized.length; index += GROUP) {
    groups.push(normalized.slice(index, index + GROUP));
  }
  return groups.join("-");
}

/**
 * What the database stores instead of the code: SHA-256 over the account and
 * the normalized code, lowercase hex.
 *
 * The account is part of it so the same code issued to two accounts (it will
 * not be, at 100 bits) would still be two different rows, and a hash copied
 * from one account's sheet matches nothing on another's.
 */
export async function hashRecoveryCode(userId: string, normalized: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${userId}:${normalized}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
