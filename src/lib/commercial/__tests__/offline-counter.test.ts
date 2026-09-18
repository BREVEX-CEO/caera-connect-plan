import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureOfflineDeviceKey,
  finalizeOfflineGeneration,
  forgetOfflineUsageLease,
  installOfflineUsageLease,
  listOfflineUsageEvents,
  readInstalledOfflineLeases,
  releaseOfflineGeneration,
  reserveOfflineGeneration,
} from "../offline-counter";
import type { OfflineUsageLeasePayload } from "../offline-lease";
import {
  importDeviceEventPublicKey,
  signOfflineUsageLease,
  verifyOfflineEventChain,
} from "../offline-lease.server";

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ocade-offline-usage");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("offline usage database remained open"));
  });
}

async function setup(tier: "free" | "pro" = "free", preissued = false) {
  const server = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const key = {
    keyId: "lease-key",
    publicKeyBase64: base64(new Uint8Array(await crypto.subtle.exportKey("raw", server.publicKey))),
    notBefore: "2026-09-01T00:00:00.000Z",
  };
  const payload: OfflineUsageLeasePayload = {
    version: 1,
    keyId: key.keyId,
    leaseId: crypto.randomUUID(),
    accountId: "account-a",
    deviceId: "device-a",
    tier,
    allocatedHundredths: tier === "free" ? 700 : 3500,
    sequenceStart: 1,
    sequenceEnd: 1_000,
    sessionWindowStart: preissued ? "2026-09-07T06:28:00.000Z" : "2026-09-07T00:00:00.000Z",
    sessionResetAt: preissued ? "2026-09-07T12:56:00.000Z" : "2026-09-07T06:28:00.000Z",
    weekWindowStart: "2026-09-01T00:00:00.000Z",
    weekResetAt: "2026-09-08T00:00:00.000Z",
    issuedAt: "2026-09-07T00:00:00.000Z",
    notBefore: preissued ? "2026-09-07T06:28:00.000Z" : "2026-09-07T00:00:00.000Z",
    expiresAt: preissued ? "2026-09-07T12:56:00.000Z" : "2026-09-07T06:28:00.000Z",
    preissued,
  };
  const signed = await signOfflineUsageLease(payload, server.privateKey);
  const publicKey = await ensureOfflineDeviceKey(payload.accountId, payload.deviceId);
  const time = { now: Date.parse("2026-09-07T01:00:00.000Z"), rollbackDetected: false };
  await installOfflineUsageLease({
    lease: signed,
    keys: [key],
    accountId: payload.accountId,
    deviceId: payload.deviceId,
    time,
    allowFuture: preissued,
  });
  return { payload, signed, key, publicKey, time };
}

beforeEach(async () => {
  await deleteDb();
  const tails = new Map<string, Promise<unknown>>();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (name: string, _options: unknown, action: () => Promise<unknown>) => {
          const previous = tails.get(name) ?? Promise.resolve();
          const current = previous.catch(() => undefined).then(action);
          tails.set(name, current);
          try {
            return await current;
          } finally {
            if (tails.get(name) === current) tails.delete(name);
          }
        },
      },
    },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("the browser offline usage counter", () => {
  it("stores a non-exportable private device key and reuses its public identity", async () => {
    const first = await ensureOfflineDeviceKey("account-a", "device-a");
    const second = await ensureOfflineDeviceKey("account-a", "device-a");
    expect(second).toBe(first);
    expect(atob(first)).toHaveLength(32);
  });

  it("reserves atomically, finalizes once and produces a verified hash chain", async () => {
    const { payload, key, publicKey, time } = await setup();
    const reservation = await reserveOfflineGeneration({
      accountId: payload.accountId,
      deviceId: payload.deviceId,
      leaseId: payload.leaseId,
      generationId: "generation-1",
      idempotencyKey: "request-1",
      surface: "chat",
      keys: [key],
      time,
    });
    expect(
      await finalizeOfflineGeneration({
        reservation,
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        keys: [key],
        time,
        costHundredths: 999,
      }),
    ).toBe(100);
    expect(
      await finalizeOfflineGeneration({
        reservation,
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        keys: [key],
        time,
        costHundredths: 100,
      }),
    ).toBe(0);
    await expect(
      reserveOfflineGeneration({
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        leaseId: payload.leaseId,
        generationId: "generation-replayed",
        idempotencyKey: "request-1",
        surface: "chat",
        keys: [key],
        time,
      }),
    ).rejects.toThrow(/already been settled/);
    const events = await listOfflineUsageEvents(payload.leaseId);
    expect(events.map((event) => event.payload.status)).toEqual(["reserved", "succeeded"]);
    const verified = await verifyOfflineEventChain({
      events,
      publicKey: await importDeviceEventPublicKey(publicKey),
      lease: payload,
      afterSequence: 0,
      previousHash: "",
    });
    expect(verified).toMatchObject({ consumedHundredths: 100, lastSequence: 2 });
  });

  it("releases pre-output work without consuming the signed allocation", async () => {
    const { payload, key, time } = await setup();
    const reservation = await reserveOfflineGeneration({
      accountId: payload.accountId,
      deviceId: payload.deviceId,
      leaseId: payload.leaseId,
      generationId: "generation-release",
      idempotencyKey: "request-release",
      surface: "cowork",
      keys: [key],
      time,
    });
    expect(
      await releaseOfflineGeneration({
        reservation,
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        keys: [key],
        time,
      }),
    ).toBe(0);
    expect((await listOfflineUsageEvents(payload.leaseId)).at(-1)?.payload.status).toBe("released");
  });

  it("holds a paid block before work and rejects a settlement above that hold", async () => {
    const { payload, key, time } = await setup("pro");
    const reservation = await reserveOfflineGeneration({
      accountId: payload.accountId,
      deviceId: payload.deviceId,
      leaseId: payload.leaseId,
      generationId: "paid-generation",
      idempotencyKey: "paid-request",
      surface: "cowork",
      keys: [key],
      time,
    });
    expect(reservation.reservedHundredths).toBe(3500);
    await expect(
      finalizeOfflineGeneration({
        reservation,
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        keys: [key],
        time,
        costHundredths: 3501,
      }),
    ).rejects.toThrow(/exceeds the capacity reserved/);
    await expect(
      finalizeOfflineGeneration({
        reservation,
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        keys: [key],
        time,
        costHundredths: 125,
      }),
    ).resolves.toBe(125);
  });

  it("stores a signed next-window block but refuses it until its trusted start", async () => {
    const { payload, key } = await setup("free", true);
    const early = { now: Date.parse("2026-09-07T01:00:00.000Z"), rollbackDetected: false };
    await expect(
      reserveOfflineGeneration({
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        leaseId: payload.leaseId,
        generationId: "early",
        idempotencyKey: "early",
        surface: "chat",
        keys: [key],
        time: early,
      }),
    ).rejects.toThrow(/not_yet_valid/);
    await expect(
      reserveOfflineGeneration({
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        leaseId: payload.leaseId,
        generationId: "after-reset",
        idempotencyKey: "after-reset",
        surface: "chat",
        keys: [key],
        time: { now: Date.parse("2026-09-07T06:28:01.000Z"), rollbackDetected: false },
      }),
    ).resolves.toMatchObject({ generationId: "after-reset" });
  });

  it("serializes concurrent tabs and preserves the first idempotent identity", async () => {
    const { payload, key, time } = await setup();
    const reservations = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        reserveOfflineGeneration({
          accountId: payload.accountId,
          deviceId: payload.deviceId,
          leaseId: payload.leaseId,
          generationId: `generation-${index}`,
          idempotencyKey: "same-logical-request",
          surface: "chat",
          keys: [key],
          time,
        }),
      ),
    );
    expect(new Set(reservations.map((reservation) => reservation.generationId)).size).toBe(1);
    expect(await listOfflineUsageEvents(payload.leaseId)).toHaveLength(1);
  });

  it("cannot reserve an eighth Free use from a seven-use block", async () => {
    const { payload, key, time } = await setup();
    for (let index = 0; index < 7; index += 1) {
      const reservation = await reserveOfflineGeneration({
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        leaseId: payload.leaseId,
        generationId: `generation-${index}`,
        idempotencyKey: `request-${index}`,
        surface: "chat",
        keys: [key],
        time,
      });
      await finalizeOfflineGeneration({
        reservation,
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        keys: [key],
        time,
        costHundredths: 100,
      });
    }
    await expect(
      reserveOfflineGeneration({
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        leaseId: payload.leaseId,
        generationId: "generation-8",
        idempotencyKey: "request-8",
        surface: "cowork",
        keys: [key],
        time,
      }),
    ).rejects.toThrow(/exhausted/);
  });

  it("forgets a finished block, and only the one it was asked to forget", async () => {
    const { payload, key, time } = await setup();
    const reservation = await reserveOfflineGeneration({
      accountId: payload.accountId,
      deviceId: payload.deviceId,
      leaseId: payload.leaseId,
      generationId: "generation-forget",
      idempotencyKey: "request-forget",
      surface: "chat",
      keys: [key],
      time,
    });
    await releaseOfflineGeneration({
      reservation,
      accountId: payload.accountId,
      deviceId: payload.deviceId,
      keys: [key],
      time,
    });
    expect(await listOfflineUsageEvents(payload.leaseId)).toHaveLength(2);

    await forgetOfflineUsageLease("another-account", payload.deviceId, payload.leaseId);
    expect(await listOfflineUsageEvents(payload.leaseId)).toHaveLength(2);

    await forgetOfflineUsageLease(payload.accountId, payload.deviceId, payload.leaseId);
    expect(await listOfflineUsageEvents(payload.leaseId)).toEqual([]);
    expect(await readInstalledOfflineLeases(payload.accountId, payload.deviceId)).toEqual([]);
  });

  it("fails closed without Web Locks and on clock rollback", async () => {
    const { payload, key, time } = await setup();
    await expect(
      reserveOfflineGeneration({
        accountId: payload.accountId,
        deviceId: payload.deviceId,
        leaseId: payload.leaseId,
        generationId: "rollback",
        idempotencyKey: "rollback",
        surface: "chat",
        keys: [key],
        time: { ...time, rollbackDetected: true },
      }),
    ).rejects.toThrow(/clock_rollback/);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
    await expect(ensureOfflineDeviceKey(payload.accountId, payload.deviceId)).rejects.toThrow(
      /cannot lock/,
    );
  });
});
