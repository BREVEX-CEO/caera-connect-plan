/**
 * SHA-256 of a string, using the platform's own crypto.
 *
 * Separated from `receipt.ts` so the receipt module stays free of environment
 * checks, and so the failure mode is decided in one place.
 *
 * A MISSING DIGEST IS NOT AN EMPTY STRING. When Web Crypto is unavailable —
 * an insecure origin, a locked-down runtime — this returns a marker rather
 * than a hash-shaped value. A receipt whose fingerprint silently became `""`
 * would still compare equal to another unhashable receipt, which is exactly
 * how a verification routine ends up approving anything.
 */

export const UNAVAILABLE = "unavailable:no-web-crypto";

export async function sha256OfText(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return UNAVAILABLE;
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return UNAVAILABLE;
  }
}

/** True when a value is a real digest rather than the unavailable marker. */
export function isRealDigest(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
