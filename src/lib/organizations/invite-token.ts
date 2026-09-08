/**
 * The invitation token: generated here, hashed here, stored nowhere.
 *
 * WHY THE BROWSER MAKES IT AND THE DATABASE NEVER SEES IT. The invitation
 * functions take a `token_hash` and nothing else, so the plaintext never
 * reaches a statement, a statement log, a replication stream or a backup. The
 * only copy is the link, and the only place that link exists is wherever the
 * person who created it sent it.
 *
 * WHAT THAT COSTS, STATED PLAINLY: a lost link cannot be recovered, only
 * resent — which issues a new token and kills the old one. That is the correct
 * trade for a credential that admits somebody to a workspace.
 *
 * SIZE. 32 bytes from `crypto.getRandomValues`, base64url. Guessing one is
 * 2^256 work, and the unique index on the hash means a collision is a refused
 * insert rather than two invitations that open the same door.
 */

const TOKEN_BYTES = 32;

/** How long a new invitation lives. §F asks for expiring tokens; this is the term. */
export const INVITE_LIFETIME_DAYS = 7;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A fresh token. Show it once, in the link, and never store it. */
export function createInviteToken(source: Crypto = globalThis.crypto): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  source.getRandomValues(bytes);
  return base64url(bytes);
}

/**
 * SHA-256 of the token as lowercase hex — the shape the database constraint
 * requires, so a mis-encoded hash is refused rather than stored.
 */
export async function hashInviteToken(
  token: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle,
): Promise<string> {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** When a token issued now should stop working. */
export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * The link a person actually sends.
 *
 * The token is in the PATH-adjacent query rather than the fragment because the
 * server route must read it to redirect an unauthenticated visitor through
 * sign-in and back. It is a bearer credential either way; what protects it is
 * its lifetime and the fact that accepting it binds to the signed-in account.
 */
export function inviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/invite?token=${encodeURIComponent(token)}`;
}
