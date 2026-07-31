import { beforeAll, describe, expect, it } from "vitest";
import { gateUpdate } from "../packaging/update-gate";
import type { UpdateManifest } from "../packaging/update-plan";
import {
  manifestSigningDigestFor,
  manifestSigningMessageFor,
  verifyUpdateTrust,
  type TrustedUpdateKey,
  type UpdateTrustPolicy,
} from "../packaging/update-trust";

const NOW = 1_785_345_600_000;
const HASH = "a".repeat(64);
const toBase64 = (bytes: ArrayBufferLike) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

type Signer = {
  readonly key: TrustedUpdateKey;
  readonly privateKey: CryptoKey;
};

let primary: Signer;
let rotated: Signer;

async function makeSigner(id: string, epoch: number): Promise<Signer> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  return {
    key: {
      id,
      publicKeyBase64: toBase64(await crypto.subtle.exportKey("raw", pair.publicKey)),
      epoch,
      validFrom: NOW - 86_400_000,
    },
    privateKey: pair.privateKey,
  };
}

beforeAll(async () => {
  primary = await makeSigner("release-primary", 1);
  rotated = await makeSigner("release-rotated", 2);
});

function unsigned(signer = primary, overrides: Partial<UpdateManifest> = {}): UpdateManifest {
  return {
    version: "0.2.0",
    sha256: HASH,
    url: "https://updates.example.invalid/ocade-0.2.0.msi",
    minimumClientVersion: "0.1.0",
    notes: "Security and reliability update.",
    signingKeyId: signer.key.id,
    signedAt: NOW - 1_000,
    signature: "pending",
    ...overrides,
  };
}

async function signed(
  signer = primary,
  overrides: Partial<UpdateManifest> = {},
): Promise<UpdateManifest> {
  const manifest = unsigned(signer, overrides);
  const message = await manifestSigningDigestFor(manifest);
  if (message === null) throw new Error("test manifest was not canonical");
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    signer.privateKey,
    message as unknown as BufferSource,
  );
  return { ...manifest, signature: toBase64(signature) };
}

function policy(
  keys: readonly TrustedUpdateKey[] = [primary.key],
  overrides: Partial<UpdateTrustPolicy> = {},
): UpdateTrustPolicy {
  return {
    keys,
    minimumKeyEpoch: 1,
    evaluationTime: NOW,
    ...overrides,
  };
}

describe("self-signed update trust lab", () => {
  it("verifies a canonical signed manifest and records its key generation", async () => {
    const verdict = await verifyUpdateTrust(await signed(), policy());
    expect(verdict.ok, verdict.ok ? "" : verdict.reason).toBe(true);
    if (!verdict.ok) throw new Error("unreachable");
    expect(verdict.keyId).toBe("release-primary");
    expect(verdict.keyEpoch).toBe(1);
    expect(verdict.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("allows the full gate only after metadata trust and observed artifact hash agree", async () => {
    const manifest = await signed();
    await expect(
      gateUpdate({
        manifest,
        policy: { currentVersion: "0.1.0" },
        trustPolicy: policy(),
        artifactSha256: HASH,
      }),
    ).resolves.toMatchObject({
      action: "apply",
      from: "0.1.0",
      to: "0.2.0",
    });
  });

  it("uses stable canonical bytes independent of object insertion order", () => {
    const a = unsigned();
    const b: UpdateManifest = {
      signature: a.signature,
      signedAt: a.signedAt,
      signingKeyId: a.signingKeyId,
      notes: a.notes,
      minimumClientVersion: a.minimumClientVersion,
      url: a.url,
      sha256: a.sha256,
      version: a.version,
    };
    expect(manifestSigningMessageFor(a)).toEqual(manifestSigningMessageFor(b));
  });
});

describe("manifest metadata is cryptographically bound", () => {
  for (const [label, mutate] of [
    ["version", (manifest: UpdateManifest) => ({ ...manifest, version: "9.9.9" })],
    [
      "download URL",
      (manifest: UpdateManifest) => ({
        ...manifest,
        url: "https://attacker.example.invalid/ocade.msi",
      }),
    ],
    ["artifact hash", (manifest: UpdateManifest) => ({ ...manifest, sha256: "b".repeat(64) })],
    [
      "upgrade floor",
      (manifest: UpdateManifest) => ({ ...manifest, minimumClientVersion: "0.1.9" }),
    ],
    [
      "signing time",
      (manifest: UpdateManifest) => ({ ...manifest, signedAt: (manifest.signedAt as number) - 1 }),
    ],
  ] as const) {
    it(`refuses a valid signature after ${label} is changed`, async () => {
      const manifest = await signed();
      const verdict = await verifyUpdateTrust(mutate(manifest), policy());
      expect(verdict.ok).toBe(false);
      if (verdict.ok) throw new Error("unreachable");
      expect(verdict.reason).toMatch(/signature rejected/i);
    });
  }

  it("refuses a valid manifest served beside different downloaded bytes", async () => {
    const manifest = await signed();
    const decision = await gateUpdate({
      manifest,
      policy: { currentVersion: "0.1.0" },
      trustPolicy: policy(),
      artifactSha256: "c".repeat(64),
    });
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") throw new Error("unreachable");
    expect(decision.reason).toMatch(/hash does not match/i);
  });
});

describe("key rotation and revocation fail closed", () => {
  it("accepts the rotated generation when policy advances its epoch floor", async () => {
    const verdict = await verifyUpdateTrust(
      await signed(rotated),
      policy([primary.key, rotated.key], { minimumKeyEpoch: 2 }),
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error("unreachable");
    expect(verdict.keyEpoch).toBe(2);
  });

  it("refuses an otherwise valid signature from a retired key generation", async () => {
    const verdict = await verifyUpdateTrust(
      await signed(primary),
      policy([primary.key, rotated.key], { minimumKeyEpoch: 2 }),
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/retired epoch/i);
  });

  it("lets revocation override a genuine current signature", async () => {
    const revoked = { ...primary.key, revokedAt: NOW - 500 };
    const verdict = await verifyUpdateTrust(await signed(), policy([revoked]));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/revoked/i);
  });

  it("refuses unknown and duplicate key identities", async () => {
    const unknown = await signed(primary, { signingKeyId: "unknown-key" });
    expect((await verifyUpdateTrust(unknown, policy())).ok).toBe(false);

    const manifest = await signed();
    const duplicate = await verifyUpdateTrust(manifest, policy([primary.key, primary.key]));
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) throw new Error("unreachable");
    expect(duplicate.reason).toMatch(/duplicated/i);
  });
});

describe("time, configuration and downgrade boundaries", () => {
  it("refuses future, stale and expired signing evidence", async () => {
    const future = await signed(primary, { signedAt: NOW + 600_000 });
    expect((await verifyUpdateTrust(future, policy())).ok).toBe(false);

    const stale = await signed(primary, { signedAt: NOW - 10_000 });
    expect(
      (await verifyUpdateTrust(stale, policy([primary.key], { maximumSignatureAgeMs: 1_000 }))).ok,
    ).toBe(false);

    // Past the declared five-minute clock-skew allowance, not merely one
    // millisecond beyond expiry.
    const expiredKey = { ...primary.key, validUntil: NOW - 600_000 };
    expect((await verifyUpdateTrust(await signed(), policy([expiredKey]))).ok).toBe(false);
  });

  it("refuses non-HTTPS, credential-bearing and fragment-bearing manifest URLs", async () => {
    for (const url of [
      "http://updates.example.invalid/a.msi",
      "https://user:pass@updates.example.invalid/a.msi",
      "https://updates.example.invalid/a.msi#swap",
    ]) {
      const verdict = await verifyUpdateTrust(unsigned(primary, { url }), policy());
      expect(verdict.ok).toBe(false);
      if (verdict.ok) throw new Error("unreachable");
      expect(verdict.reason).toMatch(/malformed|non-canonical/i);
    }
  });

  it("keeps a placeholder production key disabled", async () => {
    const placeholder = {
      ...primary.key,
      publicKeyBase64: "REPLACE_WITH_SIGNING_PUBLIC_KEY",
    };
    const verdict = await verifyUpdateTrust(await signed(), policy([placeholder]));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/production updates remain disabled/i);
  });

  it("refuses a downgrade before spending trust on its manifest", async () => {
    const decision = await gateUpdate({
      manifest: unsigned(primary, { version: "0.0.9", signature: "not-valid" }),
      policy: { currentVersion: "0.1.0" },
      trustPolicy: policy([]),
      artifactSha256: HASH,
    });
    expect(decision.action).toBe("refuse");
    if (decision.action !== "refuse") throw new Error("unreachable");
    expect(decision.reason).toMatch(/never auto-downgrade/i);
  });
});
