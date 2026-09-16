/**
 * THE SIGNATURE THAT MAKES A PRIVATE ARTIFACT REACHABLE WITHOUT MAKING IT PUBLIC.
 *
 * The bucket has no public access and no custom domain. The only way to the
 * bytes is a link OCADE mints for a signed-in person, which expires. This
 * module is both halves of that: minting and checking, in one file, so the two
 * cannot drift into disagreeing about what was signed.
 *
 * WHAT IS SIGNED, AND WHY EACH PART IS IN THERE:
 *
 *   a version tag   so a future format change cannot be replayed as this one;
 *   the release id  so a link to one artifact is not a link to every artifact;
 *   the expiry      so a leaked link stops working.
 *
 * THE KEY IS THE DEPLOYMENT'S EXISTING SERVER SECRET, with a domain-separating
 * prefix in the signed message. A dedicated secret would be one more thing to
 * provision, rotate and get wrong, for no additional strength: HMAC-SHA-256
 * under a high-entropy key reveals nothing about that key, and the prefix means
 * a signature minted here can never be mistaken for one minted anywhere else.
 *
 * COMPARISON IS CONSTANT TIME. A fast-exit compare over a hex digest leaks it
 * one nibble at a time to anyone willing to measure.
 */

const DOMAIN = "ocade.offline.delivery.v1";

/**
 * How long a link lives.
 *
 * Long enough that an ordinary install finishes inside one — a slow connection
 * pulling half a gigabyte is minutes, not hours — and short enough that a link
 * copied out of a network panel is useless by the time anybody acts on it. A
 * transfer that does outlive one simply asks for another and resumes from its
 * checkpoint, so the ceiling costs a round trip and never a restart.
 */
export const DELIVERY_TTL_MS = 6 * 60 * 60 * 1000;

function key(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!secret) throw new Error("This deployment cannot authorise model delivery.");
  return secret;
}

async function sign(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const imported = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", imported, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let at = 0; at < a.length; at += 1) difference |= a.charCodeAt(at) ^ b.charCodeAt(at);
  return difference === 0;
}

/** The path a browser may fetch this release's bytes from, until it expires. */
export async function mintDeliveryPath(releaseId: string, now: number): Promise<string> {
  const expiresAt = now + DELIVERY_TTL_MS;
  const signature = await sign(`${DOMAIN}.${releaseId}.${expiresAt}`);
  return `/api/offline/bytes/${releaseId}?e=${expiresAt}&s=${signature}`;
}

export type DeliveryVerdict = { ok: true } | { ok: false; status: 403 | 410 };

/** Whether this request may read these bytes. Expiry is checked last. */
export async function verifyDelivery(input: {
  releaseId: string;
  expiresAt: string | null;
  signature: string | null;
  now: number;
}): Promise<DeliveryVerdict> {
  if (!input.expiresAt || !input.signature) return { ok: false, status: 403 };
  if (!/^\d{1,15}$/.test(input.expiresAt)) return { ok: false, status: 403 };
  if (!/^[0-9a-f]{64}$/.test(input.signature)) return { ok: false, status: 403 };

  const expected = await sign(`${DOMAIN}.${input.releaseId}.${input.expiresAt}`);
  if (!equal(expected, input.signature)) return { ok: false, status: 403 };

  /*
   * Only now is the expiry trustworthy, and only now is it worth
   * distinguishing. An unsigned request gets 403 whatever its expiry says; a
   * genuinely minted link that has simply run out gets 410, which is the one
   * case where the client should ask for a new link and resume rather than give
   * up.
   */
  return Number(input.expiresAt) <= input.now ? { ok: false, status: 410 } : { ok: true };
}
