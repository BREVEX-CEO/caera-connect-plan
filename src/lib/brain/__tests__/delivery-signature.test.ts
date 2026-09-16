import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DELIVERY_TTL_MS, mintDeliveryPath, verifyDelivery } from "@/lib/brain/delivery-signature";

const RELEASE = "ocr-0123456789abcdef";
const OTHER = "ocr-fedcba9876543210";
const NOW = 1_800_000_000_000;

const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test_key_for_signing_only";
});
afterEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
});

function parse(path: string) {
  const url = new URL(path, "https://ocade.example");
  return {
    releaseId: url.pathname.split("/").pop()!,
    expiresAt: url.searchParams.get("e"),
    signature: url.searchParams.get("s"),
  };
}

describe("a minted link opens the door it was minted for", () => {
  it("verifies, for that release, before it expires", async () => {
    const minted = parse(await mintDeliveryPath(RELEASE, NOW));
    expect(minted.releaseId).toBe(RELEASE);
    await expect(verifyDelivery({ ...minted, now: NOW + 1000 })).resolves.toEqual({ ok: true });
  });

  it("names the release in the path, so the link says what it is for", async () => {
    expect(await mintDeliveryPath(RELEASE, NOW)).toMatch(
      /^\/api\/offline\/bytes\/ocr-[0-9a-f]{16}\?e=\d+&s=[0-9a-f]{64}$/,
    );
  });
});

describe("what a link does not open", () => {
  it("refuses a link minted for a different release", async () => {
    /*
     * The release id is inside the signed message, so a link to one artifact
     * cannot be edited into a link to every artifact.
     */
    const minted = parse(await mintDeliveryPath(RELEASE, NOW));
    await expect(verifyDelivery({ ...minted, releaseId: OTHER, now: NOW + 1000 })).resolves.toEqual(
      { ok: false, status: 403 },
    );
  });

  it("refuses an expiry moved forward by hand", async () => {
    // The expiry is signed too. Extending it invalidates the signature rather
    // than extending the link.
    const minted = parse(await mintDeliveryPath(RELEASE, NOW));
    await expect(
      verifyDelivery({ ...minted, expiresAt: String(NOW + 10 * DELIVERY_TTL_MS), now: NOW }),
    ).resolves.toEqual({ ok: false, status: 403 });
  });

  it("refuses a link signed under a different secret", async () => {
    const minted = parse(await mintDeliveryPath(RELEASE, NOW));
    process.env.SUPABASE_SERVICE_ROLE_KEY = "a-different-secret-entirely";
    await expect(verifyDelivery({ ...minted, now: NOW + 1000 })).resolves.toEqual({
      ok: false,
      status: 403,
    });
  });

  it("refuses a request with no signature at all", async () => {
    await expect(
      verifyDelivery({ releaseId: RELEASE, expiresAt: null, signature: null, now: NOW }),
    ).resolves.toEqual({ ok: false, status: 403 });
  });

  it("refuses malformed parameters without doing the work", async () => {
    for (const bad of ["", "not-hex", "0".repeat(63), "0".repeat(65)]) {
      await expect(
        verifyDelivery({ releaseId: RELEASE, expiresAt: String(NOW), signature: bad, now: NOW }),
      ).resolves.toEqual({ ok: false, status: 403 });
    }
  });
});

describe("expiry is distinguished only once the link is known to be genuine", () => {
  it("answers 410 for a real link that has run out", async () => {
    /*
     * 410 rather than 403 is the whole reason the two are separated: it tells
     * the installer to ask for a fresh link and resume from its checkpoint,
     * rather than treat the transfer as refused.
     */
    const minted = parse(await mintDeliveryPath(RELEASE, NOW));
    await expect(verifyDelivery({ ...minted, now: NOW + DELIVERY_TTL_MS + 1 })).resolves.toEqual({
      ok: false,
      status: 410,
    });
  });

  it("answers 403, not 410, for an unsigned request whose expiry has passed", async () => {
    // An unsigned caller learns nothing about whether the expiry it guessed was
    // in range.
    await expect(
      verifyDelivery({
        releaseId: RELEASE,
        expiresAt: String(NOW - 1),
        signature: "0".repeat(64),
        now: NOW,
      }),
    ).resolves.toEqual({ ok: false, status: 403 });
  });

  it("expires on the instant, not after it", async () => {
    const minted = parse(await mintDeliveryPath(RELEASE, NOW));
    await expect(verifyDelivery({ ...minted, now: NOW + DELIVERY_TTL_MS })).resolves.toEqual({
      ok: false,
      status: 410,
    });
    await expect(verifyDelivery({ ...minted, now: NOW + DELIVERY_TTL_MS - 1 })).resolves.toEqual({
      ok: true,
    });
  });
});

describe("a deployment with nothing to sign with", () => {
  it("cannot mint, and says so rather than minting something unverifiable", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(mintDeliveryPath(RELEASE, NOW)).rejects.toThrow(/cannot authorise/i);
  });
});
