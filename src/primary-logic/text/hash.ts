/**
 * Content hashing for change detection.
 *
 * The donor branched on `typeof Bun !== 'undefined'` and fell back to
 * `require('crypto')`. Neither exists in a browser tab, and the two branches
 * did not even agree on an output — a cache keyed under Bun would miss every
 * entry written under Node. OCADE hashes one way everywhere, so a key written
 * on one surface is found on all of them.
 *
 * FNV-1a is used rather than SHA-256 because every caller is detecting change,
 * not defending against a forger, and these run on a keystroke path. Nothing
 * here is a security boundary: do not use it to compare secrets.
 */

/**
 * djb2 — signed 32-bit. Kept because callers store it as a number and some of
 * those numbers are already on disk in cache directory names.
 */
export function djb2Hash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/** FNV-1a over UTF-16 code units, folded to 64 bits as two 32-bit lanes. */
function fnv1a64(input: string, seedLow = 0x811c9dc5, seedHigh = 0xcbf29ce4): [number, number] {
  let low = seedLow >>> 0;
  let high = seedHigh >>> 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    low = (low ^ (code & 0xff)) >>> 0;
    low = Math.imul(low, 0x01000193) >>> 0;
    high = (high ^ (code >>> 8)) >>> 0;
    high = Math.imul(high, 0x01000193) >>> 0;
  }
  return [low, high];
}

function render([low, high]: [number, number]): string {
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
}

/** Stable hash of one string. */
export function hashContent(content: string): string {
  return render(fnv1a64(content));
}

/**
 * Hash two strings without concatenating them.
 *
 * Seeding the second hash with the first is NOT enough on its own: FNV's state
 * *is* its seed, so chaining is arithmetically identical to hashing `a + b`,
 * and ("ts", "code") collides with ("tsc", "ode"). The boundary has to be fed
 * in explicitly, so `a`'s length is mixed into the seed before `b` is consumed.
 */
export function hashPair(a: string, b: string): string {
  const [low, high] = fnv1a64(a);
  const seedLow = Math.imul(low ^ a.length, 0x01000193) >>> 0;
  const seedHigh = Math.imul(high ^ (a.length >>> 8), 0x01000193) >>> 0;
  return render(fnv1a64(b, seedLow, seedHigh));
}
