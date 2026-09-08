import { describe, expect, it } from "vitest";
import {
  offlineEventSigningBytes,
  resolveTrustedOfflineTime,
  sha256Base64,
  verifyOfflineUsageLease,
  type OfflineUsageEventPayload,
  type OfflineUsageLeasePayload,
  type SignedOfflineUsageEvent,
} from "../offline-lease";
import {
  loadOfflineLeaseSigningAuthority,
  signOfflineUsageLease,
  verifyOfflineEventChain,
} from "../offline-lease.server";

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function authority() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  return {
    pair,
    key: {
      keyId: "lease-key-2026-09",
      publicKeyBase64: base64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
      notBefore: "2026-09-01T00:00:00.000Z",
    },
  };
}

function payload(overrides: Partial<OfflineUsageLeasePayload> = {}): OfflineUsageLeasePayload {
  return {
    version: 1,
    keyId: "lease-key-2026-09",
    leaseId: "11111111-1111-4111-8111-111111111111",
    accountId: "account-a",
    deviceId: "device-a",
    tier: "free",
    allocatedHundredths: 700,
    sequenceStart: 1,
    sequenceEnd: 1_000,
    sessionWindowStart: "2026-09-07T00:00:00.000Z",
    sessionResetAt: "2026-09-07T06:28:00.000Z",
    weekWindowStart: "2026-09-01T00:00:00.000Z",
    weekResetAt: "2026-09-08T00:00:00.000Z",
    issuedAt: "2026-09-07T00:00:00.000Z",
    notBefore: "2026-09-07T00:00:00.000Z",
    expiresAt: "2026-09-07T06:28:00.000Z",
    preissued: false,
    ...overrides,
  };
}

const trusted = { now: Date.parse("2026-09-07T01:00:00.000Z"), rollbackDetected: false };

describe("signed offline usage leases", () => {
  it("loads one signing key while retaining valid prior public keys for rotation", async () => {
    const { pair, key } = await authority();
    const pkcs8 = base64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey)));
    const loaded = await loadOfflineLeaseSigningAuthority({
      OCADE_LEASE_SIGNING_KEY_ID: key.keyId,
      OCADE_LEASE_SIGNING_PRIVATE_KEY: pkcs8,
      OCADE_LEASE_SIGNING_PUBLIC_KEY: key.publicKeyBase64,
      OCADE_LEASE_SIGNING_NOT_BEFORE: key.notBefore,
      OCADE_LEASE_PREVIOUS_VERIFICATION_KEYS: JSON.stringify([
        {
          keyId: "lease-key-previous",
          publicKeyBase64: key.publicKeyBase64,
          notBefore: "2026-08-01T00:00:00.000Z",
          expiresAt: "2026-10-01T00:00:00.000Z",
        },
      ]),
    });
    expect(loaded.verificationKeys.map((candidate) => candidate.keyId)).toEqual([
      key.keyId,
      "lease-key-previous",
    ]);
  });

  it("refuses a signing key paired with the wrong public key", async () => {
    const first = await authority();
    const second = await authority();
    await expect(
      loadOfflineLeaseSigningAuthority({
        OCADE_LEASE_SIGNING_KEY_ID: first.key.keyId,
        OCADE_LEASE_SIGNING_PRIVATE_KEY: base64(
          new Uint8Array(await crypto.subtle.exportKey("pkcs8", first.pair.privateKey)),
        ),
        OCADE_LEASE_SIGNING_PUBLIC_KEY: second.key.publicKeyBase64,
        OCADE_LEASE_SIGNING_NOT_BEFORE: first.key.notBefore,
      }),
    ).rejects.toThrow(/does not match/);
  });

  it("verifies the exact account, device, time and Ed25519 authority", async () => {
    const { pair, key } = await authority();
    const lease = await signOfflineUsageLease(payload(), pair.privateKey);
    const decision = await verifyOfflineUsageLease({
      lease,
      keys: [key],
      accountId: "account-a",
      deviceId: "device-a",
      time: trusted,
    });
    expect(decision.ok).toBe(true);
  });

  it.each([
    ["wrong_account", { accountId: "account-b" }],
    ["wrong_device", { deviceId: "device-b" }],
  ] as const)("refuses %s", async (reason, identity) => {
    const { pair, key } = await authority();
    const lease = await signOfflineUsageLease(payload(), pair.privateKey);
    const decision = await verifyOfflineUsageLease({
      lease,
      keys: [key],
      accountId: "accountId" in identity ? identity.accountId : "account-a",
      deviceId: "deviceId" in identity ? identity.deviceId : "device-a",
      time: trusted,
    });
    expect(decision).toMatchObject({ ok: false, reason });
  });

  it("refuses tampering, unknown authorities and invalid allocation", async () => {
    const { pair, key } = await authority();
    const signed = await signOfflineUsageLease(payload(), pair.privateKey);
    const tampered = { ...signed, payload: { ...signed.payload, allocatedHundredths: 800 } };
    await expect(
      verifyOfflineUsageLease({
        lease: tampered,
        keys: [key],
        accountId: "account-a",
        deviceId: "device-a",
        time: trusted,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "invalid_signature" });
    await expect(
      verifyOfflineUsageLease({
        lease: signed,
        keys: [],
        accountId: "account-a",
        deviceId: "device-a",
        time: trusted,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "unknown_key" });
    const invalid = await signOfflineUsageLease(
      payload({ allocatedHundredths: 0 }),
      pair.privateKey,
    );
    await expect(
      verifyOfflineUsageLease({
        lease: invalid,
        keys: [key],
        accountId: "account-a",
        deviceId: "device-a",
        time: trusted,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "invalid_allocation" });
  });

  it("refuses future, expired and clock-rollback use", async () => {
    const { pair, key } = await authority();
    const signed = await signOfflineUsageLease(payload(), pair.privateKey);
    for (const [time, reason] of [
      [{ now: Date.parse("2026-09-06T23:59:59Z"), rollbackDetected: false }, "not_yet_valid"],
      [{ now: Date.parse("2026-09-07T06:28:00Z"), rollbackDetected: false }, "expired"],
      [{ now: trusted.now, rollbackDetected: true }, "clock_rollback"],
    ] as const) {
      await expect(
        verifyOfflineUsageLease({
          lease: signed,
          keys: [key],
          accountId: "account-a",
          deviceId: "device-a",
          time,
        }),
      ).resolves.toMatchObject({ ok: false, reason });
    }
  });
});

describe("trusted offline time", () => {
  it("advances from signed server time and monotonic elapsed time", () => {
    expect(
      resolveTrustedOfflineTime({
        wallNow: 10_500,
        monotonicNow: 700,
        serverTimeAtSync: 10_000,
        monotonicAtSync: 100,
        durableHighWater: 10_200,
      }),
    ).toEqual({ now: 10_600, rollbackDetected: false });
  });

  it("locks a clock moved materially behind its durable high-water mark", () => {
    expect(
      resolveTrustedOfflineTime({
        wallNow: 1_000,
        monotonicNow: 5,
        serverTimeAtSync: 20_000,
        monotonicAtSync: 0,
        durableHighWater: 50_000,
        rollbackToleranceMs: 100,
      }),
    ).toEqual({ now: 50_000, rollbackDetected: true });
  });
});

describe("device event chain", () => {
  it("verifies signatures, hashes, sequence and one reservation/settlement", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const lease = payload();
    const events: SignedOfflineUsageEvent[] = [];
    for (const event of [
      { status: "reserved" as const, costHundredths: 100 },
      { status: "succeeded" as const, costHundredths: 100 },
    ]) {
      const item: OfflineUsageEventPayload = {
        version: 1,
        eventId: crypto.randomUUID(),
        leaseId: lease.leaseId,
        accountId: lease.accountId,
        deviceId: lease.deviceId,
        sequence: events.length + 1,
        generationId: "generation-a",
        idempotencyKey: "request-a",
        surface: "chat",
        status: event.status,
        costHundredths: event.costHundredths,
        occurredAt: "2026-09-07T01:00:00.000Z",
        previousHash: events.at(-1)?.eventHash ?? "",
      };
      const bytes = offlineEventSigningBytes(item);
      const signature = new Uint8Array(
        await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, Uint8Array.from(bytes)),
      );
      events.push({
        payload: item,
        eventHash: await sha256Base64(bytes),
        deviceSignature: base64(signature),
      });
    }
    await expect(
      verifyOfflineEventChain({
        events,
        publicKey: pair.publicKey,
        lease,
        afterSequence: 0,
        previousHash: "",
      }),
    ).resolves.toMatchObject({ consumedHundredths: 100, lastSequence: 2 });

    const broken = structuredClone(events);
    broken[1].payload.previousHash = "tampered";
    await expect(
      verifyOfflineEventChain({
        events: broken,
        publicKey: pair.publicKey,
        lease,
        afterSequence: 0,
        previousHash: "",
      }),
    ).rejects.toThrow(/not continuous/);
  });
});
