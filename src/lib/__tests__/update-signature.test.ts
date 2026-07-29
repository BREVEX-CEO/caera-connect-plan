import { describe, it, expect, beforeAll } from "vitest";
import { verifyUpdateSignature, signingMessageFor } from "../packaging/update-signature";

/**
 * Self-signed signing-pipeline test (§19.9 packaging).
 *
 * `update-plan.ts` refused an update whose signature field was blank. That is a
 * PRESENCE check: any non-empty string satisfied it. These tests exercise real
 * Ed25519 verification against a key pair generated here — which is exactly the
 * point. A release certificate identifies the PUBLISHER; whether the sign/verify
 * pipeline works at all is a separate question, and it is answerable today.
 *
 * The whole pipeline runs for real: generate a key, hash an artifact, sign the
 * digest, verify it, then attack it four ways and require each attack to fail.
 */

let publicKeyBase64: string;
let sign: (digest: string) => Promise<string>;
let otherPublicKeyBase64: string;

// ArrayBufferLike, not ArrayBuffer: `getRandomValues(...).buffer` is typed as
// the former, and narrowing it would fail typecheck while the tests still pass.
const toBase64 = (bytes: ArrayBufferLike) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  publicKeyBase64 = toBase64(await crypto.subtle.exportKey("raw", pair.publicKey));
  sign = async (digest: string) =>
    toBase64(
      await crypto.subtle.sign(
        { name: "Ed25519" },
        pair.privateKey,
        // Same cast the module uses: this TS lib types Uint8Array as
        // Uint8Array<ArrayBufferLike>, which BufferSource does not accept.
        signingMessageFor(digest) as unknown as BufferSource,
      ),
    );

  const impostor = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  otherPublicKeyBase64 = toBase64(await crypto.subtle.exportKey("raw", impostor.publicKey));
});

describe("a genuine signature verifies", () => {
  it("accepts a signature made over this artifact with the shipped key", async () => {
    const digest = await sha256Hex("installer-bytes-v1");
    const verdict = await verifyUpdateSignature({
      publicKeyBase64,
      signatureBase64: await sign(digest),
      artifactSha256: digest,
    });

    expect(verdict.ok, verdict.ok ? "" : verdict.reason).toBe(true);
    if (!verdict.ok) throw new Error("unreachable");
    expect(verdict.evidence).toMatch(/Ed25519 signature verified/);
  });

  it("is case-insensitive about the digest, since hex case is not meaningful", async () => {
    const digest = await sha256Hex("installer-bytes-v1");
    const signature = await sign(digest);
    const verdict = await verifyUpdateSignature({
      publicKeyBase64,
      signatureBase64: signature,
      artifactSha256: digest.toUpperCase(),
    });
    expect(verdict.ok).toBe(true);
  });
});

describe("the four attacks that matter, each refused", () => {
  it("1. TAMPERED ARTIFACT — a valid signature over different bytes is refused", async () => {
    // The replay that matters: an attacker takes a legitimately signed update
    // and serves it alongside a different installer.
    const signedDigest = await sha256Hex("installer-bytes-v1");
    const servedDigest = await sha256Hex("installer-bytes-TAMPERED");

    const verdict = await verifyUpdateSignature({
      publicKeyBase64,
      signatureBase64: await sign(signedDigest),
      artifactSha256: servedDigest,
    });

    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/modified, or it was signed by someone else/i);
  });

  it("2. WRONG KEY — a signature from another key pair is refused", async () => {
    const digest = await sha256Hex("installer-bytes-v1");
    const verdict = await verifyUpdateSignature({
      publicKeyBase64: otherPublicKeyBase64, // verify against the impostor's key
      signatureBase64: await sign(digest),
      artifactSha256: digest,
    });
    expect(verdict.ok).toBe(false);
  });

  it("3. FORGED SIGNATURE — random bytes of the right length are refused", async () => {
    const digest = await sha256Hex("installer-bytes-v1");
    const forged = toBase64(crypto.getRandomValues(new Uint8Array(64)).buffer);
    const verdict = await verifyUpdateSignature({
      publicKeyBase64,
      signatureBase64: forged,
      artifactSha256: digest,
    });
    expect(verdict.ok).toBe(false);
  });

  it("4. NO SIGNATURE — an empty or blank signature is refused", async () => {
    const digest = await sha256Hex("installer-bytes-v1");
    for (const signatureBase64 of ["", "   "]) {
      const verdict = await verifyUpdateSignature({
        publicKeyBase64,
        signatureBase64,
        artifactSha256: digest,
      });
      expect(verdict.ok).toBe(false);
      if (verdict.ok) throw new Error("unreachable");
      expect(verdict.reason).toMatch(/64-byte Ed25519 signature/);
    }
  });
});

describe("malformed inputs are refusals, never exceptions", () => {
  it("refuses a digest that is not SHA-256 hex", async () => {
    for (const artifactSha256 of ["", "not-a-digest", "a".repeat(63), `${"a".repeat(64)}z`]) {
      const verdict = await verifyUpdateSignature({
        publicKeyBase64,
        signatureBase64: await sign("a".repeat(64)),
        artifactSha256,
      });
      expect(verdict.ok).toBe(false);
      if (verdict.ok) throw new Error("unreachable");
      expect(verdict.reason).toMatch(/not a valid SHA-256/);
    }
  });

  it("refuses a public key of the wrong length", async () => {
    const digest = await sha256Hex("x");
    const shortKey = toBase64(new Uint8Array(16).buffer);
    const verdict = await verifyUpdateSignature({
      publicKeyBase64: shortKey,
      signatureBase64: await sign(digest),
      artifactSha256: digest,
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/32-byte Ed25519 key/);
  });

  it("refuses a placeholder public key, such as the one in tauri.conf.json", async () => {
    // The shipped config still reads REPLACE_WITH_SIGNING_PUBLIC_KEY. That must
    // never verify anything.
    const digest = await sha256Hex("x");
    const verdict = await verifyUpdateSignature({
      publicKeyBase64: "REPLACE_WITH_SIGNING_PUBLIC_KEY",
      signatureBase64: await sign(digest),
      artifactSha256: digest,
    });
    expect(verdict.ok).toBe(false);
  });

  it("never throws, whatever it is handed", async () => {
    const nonsense = [
      { publicKeyBase64: "!!!", signatureBase64: "!!!", artifactSha256: "!!!" },
      { publicKeyBase64: "", signatureBase64: "", artifactSha256: "" },
    ];
    for (const input of nonsense) {
      await expect(verifyUpdateSignature(input)).resolves.toMatchObject({ ok: false });
    }
  });
});

describe("signer and verifier agree on the message", () => {
  it("exposes the exact bytes that get signed", async () => {
    const digest = await sha256Hex("artifact");
    // A signer that signs something else produces signatures that never
    // validate — or validate the wrong thing.
    expect(signingMessageFor(digest)).toEqual(new TextEncoder().encode(digest));
  });

  it("normalises case and whitespace identically on both sides", () => {
    const digest = "A".repeat(64);
    expect(signingMessageFor(`  ${digest}  `)).toEqual(
      new TextEncoder().encode(digest.toLowerCase()),
    );
  });
});
