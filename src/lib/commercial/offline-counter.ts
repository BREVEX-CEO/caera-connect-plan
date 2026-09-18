import type { GenerationSurface } from "./generation-gate";
import {
  OFFLINE_LEASE_ALGORITHM,
  offlineEventSigningBytes,
  ownedArrayBuffer,
  sha256Base64,
  verifyOfflineUsageLease,
  type OfflineLeaseVerificationKey,
  type SignedOfflineUsageEvent,
  type SignedOfflineUsageLease,
  type TrustedOfflineTime,
} from "./offline-lease";

const DB_NAME = "ocade-offline-usage";
const DB_VERSION = 1;
const KEY_STORE = "device_keys";
const LEASE_STORE = "leases";
const STATE_STORE = "lease_state";
const EVENT_STORE = "events";
const EMPTY_HASH = "";

interface DeviceKeyRow {
  identity: string;
  accountId: string;
  deviceId: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyBase64: string;
  createdAt: string;
}

interface LeaseRow {
  leaseId: string;
  accountId: string;
  deviceId: string;
  lease: SignedOfflineUsageLease;
  verificationKeys: OfflineLeaseVerificationKey[];
  installedAt: string;
}

interface LeaseStateRow {
  leaseId: string;
  consumedHundredths: number;
  reservations: Record<
    string,
    | number
    | {
        generationId: string;
        surface: GenerationSurface;
        amountHundredths: number;
      }
  >;
  settlements?: Record<
    string,
    { generationId: string; status: "succeeded" | "released"; chargedHundredths: number }
  >;
  nextSequence: number;
  lastHash: string;
}

interface EventRow extends SignedOfflineUsageEvent {
  eventKey: string;
  leaseId: string;
  sequence: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE))
        db.createObjectStore(KEY_STORE, { keyPath: "identity" });
      if (!db.objectStoreNames.contains(LEASE_STORE))
        db.createObjectStore(LEASE_STORE, { keyPath: "leaseId" });
      if (!db.objectStoreNames.contains(STATE_STORE))
        db.createObjectStore(STATE_STORE, { keyPath: "leaseId" });
      if (!db.objectStoreNames.contains(EVENT_STORE)) {
        const events = db.createObjectStore(EVENT_STORE, { keyPath: "eventKey" });
        events.createIndex("by_lease_sequence", ["leaseId", "sequence"], { unique: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Offline usage storage aborted."));
  });
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function identityKey(accountId: string, deviceId: string): string {
  return `${accountId}:${deviceId}`;
}

function reservationAmount(reservation: LeaseStateRow["reservations"][string]): number {
  return typeof reservation === "number" ? reservation : reservation.amountHundredths;
}

async function runExclusive<T>(deviceId: string, action: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || typeof navigator.locks?.request !== "function") {
    throw new Error(
      "Offline usage is unavailable because this browser cannot lock its device counter.",
    );
  }
  return navigator.locks.request(`ocade:offline-usage:${deviceId}`, { mode: "exclusive" }, action);
}

async function readDeviceKey(
  db: IDBDatabase,
  accountId: string,
  deviceId: string,
): Promise<DeviceKeyRow | null> {
  const transaction = db.transaction(KEY_STORE, "readonly");
  const row = (await requestResult(
    transaction.objectStore(KEY_STORE).get(identityKey(accountId, deviceId)),
  )) as DeviceKeyRow | undefined;
  await transactionDone(transaction);
  return row ?? null;
}

/** The public half is exportable; the private half is non-exportable. */
export async function ensureOfflineDeviceKey(accountId: string, deviceId: string): Promise<string> {
  return runExclusive(deviceId, async () => {
    const db = await openDb();
    try {
      const existing = await readDeviceKey(db, accountId, deviceId);
      if (existing) return existing.publicKeyBase64;
      const pair = (await crypto.subtle.generateKey({ name: OFFLINE_LEASE_ALGORITHM }, false, [
        "sign",
        "verify",
      ])) as CryptoKeyPair;
      const publicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
      const row: DeviceKeyRow = {
        identity: identityKey(accountId, deviceId),
        accountId,
        deviceId,
        privateKey: pair.privateKey,
        publicKey: pair.publicKey,
        publicKeyBase64: encodeBase64(publicBytes),
        createdAt: new Date().toISOString(),
      };
      const transaction = db.transaction(KEY_STORE, "readwrite");
      transaction.objectStore(KEY_STORE).add(row);
      await transactionDone(transaction);
      return row.publicKeyBase64;
    } finally {
      db.close();
    }
  });
}

export async function installOfflineUsageLease(input: {
  lease: SignedOfflineUsageLease;
  keys: readonly OfflineLeaseVerificationKey[];
  accountId: string;
  deviceId: string;
  time: TrustedOfflineTime;
  /** Store a verified next-window block without allowing it to generate yet. */
  allowFuture?: boolean;
}): Promise<void> {
  const decision = await verifyOfflineUsageLease(input);
  if (!decision.ok && !(input.allowFuture && decision.reason === "not_yet_valid")) {
    throw new Error(`Offline usage lease refused: ${decision.reason}.`);
  }
  await runExclusive(input.deviceId, async () => {
    const db = await openDb();
    try {
      const existingKey = await readDeviceKey(db, input.accountId, input.deviceId);
      if (!existingKey) throw new Error("This device has no offline usage signing key.");
      const transaction = db.transaction([LEASE_STORE, STATE_STORE], "readwrite");
      transaction.objectStore(LEASE_STORE).put({
        leaseId: input.lease.payload.leaseId,
        accountId: input.accountId,
        deviceId: input.deviceId,
        lease: input.lease,
        verificationKeys: [...input.keys],
        installedAt: new Date(input.time.now).toISOString(),
      } satisfies LeaseRow);
      const existing = (await requestResult(
        transaction.objectStore(STATE_STORE).get(input.lease.payload.leaseId),
      )) as LeaseStateRow | undefined;
      transaction.objectStore(STATE_STORE).put(
        existing ??
          ({
            leaseId: input.lease.payload.leaseId,
            consumedHundredths: 0,
            reservations: {},
            settlements: {},
            nextSequence: input.lease.payload.sequenceStart,
            lastHash: EMPTY_HASH,
          } satisfies LeaseStateRow),
      );
      await transactionDone(transaction);
    } finally {
      db.close();
    }
  });
}

async function appendEvent(input: {
  db: IDBDatabase;
  key: DeviceKeyRow;
  lease: SignedOfflineUsageLease;
  state: LeaseStateRow;
  generationId: string;
  idempotencyKey: string;
  surface: GenerationSurface;
  status: "reserved" | "succeeded" | "released";
  costHundredths: number;
  occurredAt: number;
}): Promise<SignedOfflineUsageEvent> {
  if (input.state.nextSequence > input.lease.payload.sequenceEnd) {
    throw new Error("The signed offline event sequence is exhausted.");
  }
  const payload = {
    version: 1 as const,
    eventId: crypto.randomUUID(),
    leaseId: input.lease.payload.leaseId,
    accountId: input.lease.payload.accountId,
    deviceId: input.lease.payload.deviceId,
    sequence: input.state.nextSequence,
    generationId: input.generationId,
    idempotencyKey: input.idempotencyKey,
    surface: input.surface,
    status: input.status,
    costHundredths: input.costHundredths,
    occurredAt: new Date(input.occurredAt).toISOString(),
    previousHash: input.state.lastHash,
  };
  const bytes = offlineEventSigningBytes(payload);
  const eventHash = await sha256Base64(bytes);
  const deviceSignature = encodeBase64(
    new Uint8Array(
      await crypto.subtle.sign(
        { name: OFFLINE_LEASE_ALGORITHM },
        input.key.privateKey,
        ownedArrayBuffer(bytes),
      ),
    ),
  );
  const event: SignedOfflineUsageEvent = { payload, eventHash, deviceSignature };
  input.state.nextSequence += 1;
  input.state.lastHash = eventHash;
  const transaction = input.db.transaction([EVENT_STORE, STATE_STORE], "readwrite");
  transaction.objectStore(EVENT_STORE).add({
    ...event,
    eventKey: `${payload.leaseId}:${String(payload.sequence).padStart(12, "0")}`,
    leaseId: payload.leaseId,
    sequence: payload.sequence,
  } satisfies EventRow);
  transaction.objectStore(STATE_STORE).put(input.state);
  await transactionDone(transaction);
  return event;
}

async function withLeaseState<T>(input: {
  accountId: string;
  deviceId: string;
  leaseId: string;
  keys: readonly OfflineLeaseVerificationKey[];
  time: TrustedOfflineTime;
  action: (context: {
    db: IDBDatabase;
    key: DeviceKeyRow;
    lease: SignedOfflineUsageLease;
    state: LeaseStateRow;
  }) => Promise<T>;
}): Promise<T> {
  return runExclusive(input.deviceId, async () => {
    const db = await openDb();
    try {
      const read = db.transaction([KEY_STORE, LEASE_STORE, STATE_STORE], "readonly");
      const [key, leaseRow, state] = await Promise.all([
        requestResult(
          read.objectStore(KEY_STORE).get(identityKey(input.accountId, input.deviceId)),
        ),
        requestResult(read.objectStore(LEASE_STORE).get(input.leaseId)),
        requestResult(read.objectStore(STATE_STORE).get(input.leaseId)),
      ]);
      await transactionDone(read);
      if (!key || !leaseRow || !state)
        throw new Error("This device has no usable offline allowance.");
      const typedLease = leaseRow as LeaseRow;
      const decision = await verifyOfflineUsageLease({
        lease: typedLease.lease,
        keys: input.keys,
        accountId: input.accountId,
        deviceId: input.deviceId,
        time: input.time,
      });
      if (!decision.ok) throw new Error(`Offline usage lease refused: ${decision.reason}.`);
      const result = await input.action({
        db,
        key: key as DeviceKeyRow,
        lease: typedLease.lease,
        state: state as LeaseStateRow,
      });
      return result;
    } finally {
      db.close();
    }
  });
}

export interface OfflineGenerationReservation {
  leaseId: string;
  generationId: string;
  idempotencyKey: string;
  surface: GenerationSurface;
  reservedHundredths: number;
}

export async function reserveOfflineGeneration(input: {
  accountId: string;
  deviceId: string;
  leaseId: string;
  generationId: string;
  idempotencyKey: string;
  surface: GenerationSurface;
  keys: readonly OfflineLeaseVerificationKey[];
  time: TrustedOfflineTime;
}): Promise<OfflineGenerationReservation> {
  return withLeaseState({
    ...input,
    action: async ({ db, key, lease, state }) => {
      if (state.settlements?.[input.idempotencyKey]) {
        throw new Error("This offline request has already been settled.");
      }
      const existing = state.reservations[input.idempotencyKey];
      if (existing !== undefined) {
        return {
          leaseId: input.leaseId,
          idempotencyKey: input.idempotencyKey,
          generationId: typeof existing === "number" ? input.generationId : existing.generationId,
          surface: typeof existing === "number" ? input.surface : existing.surface,
          reservedHundredths: reservationAmount(existing),
        };
      }
      const reserved = Object.values(state.reservations).reduce<number>(
        (sum, reservation) => sum + reservationAmount(reservation),
        0,
      );
      const available = lease.payload.allocatedHundredths - state.consumedHundredths - reserved;
      // Paid work is measured after output. Hold the remaining signed block so
      // a result can never cost more than the device had reserved before it
      // ran; settlement returns the unused portion to this same local block.
      const upfront = lease.payload.tier === "free" ? 100 : available;
      if (upfront < (lease.payload.tier === "free" ? 100 : 25)) {
        throw new Error("This device's signed offline allowance is exhausted.");
      }
      if (state.consumedHundredths + reserved + upfront > lease.payload.allocatedHundredths) {
        throw new Error("This device's signed offline allowance is exhausted.");
      }
      state.reservations[input.idempotencyKey] = {
        generationId: input.generationId,
        surface: input.surface,
        amountHundredths: upfront,
      };
      await appendEvent({
        db,
        key,
        lease,
        state,
        generationId: input.generationId,
        idempotencyKey: input.idempotencyKey,
        surface: input.surface,
        status: "reserved",
        costHundredths: upfront,
        occurredAt: input.time.now,
      });
      return {
        leaseId: input.leaseId,
        generationId: input.generationId,
        idempotencyKey: input.idempotencyKey,
        surface: input.surface,
        reservedHundredths: upfront,
      };
    },
  });
}

async function settleOfflineGeneration(input: {
  reservation: OfflineGenerationReservation;
  accountId: string;
  deviceId: string;
  keys: readonly OfflineLeaseVerificationKey[];
  time: TrustedOfflineTime;
  status: "succeeded" | "released";
  costHundredths: number;
}): Promise<number> {
  return withLeaseState({
    ...input,
    leaseId: input.reservation.leaseId,
    action: async ({ db, key, lease, state }) => {
      const held = state.reservations[input.reservation.idempotencyKey];
      if (held === undefined) return 0;
      const charged =
        input.status === "released"
          ? 0
          : lease.payload.tier === "free"
            ? 100
            : Math.max(25, Math.round(input.costHundredths));
      if (charged > reservationAmount(held)) {
        throw new Error("That result exceeds the capacity reserved before it ran.");
      }
      const otherReserved = Object.entries(state.reservations).reduce(
        (sum, [id, reservation]) =>
          sum + (id === input.reservation.idempotencyKey ? 0 : reservationAmount(reservation)),
        0,
      );
      if (state.consumedHundredths + otherReserved + charged > lease.payload.allocatedHundredths) {
        throw new Error("That result exceeds this device's signed offline allowance.");
      }
      delete state.reservations[input.reservation.idempotencyKey];
      state.consumedHundredths += charged;
      state.settlements ??= {};
      state.settlements[input.reservation.idempotencyKey] = {
        generationId: input.reservation.generationId,
        status: input.status,
        chargedHundredths: charged,
      };
      await appendEvent({
        db,
        key,
        lease,
        state,
        generationId: input.reservation.generationId,
        idempotencyKey: input.reservation.idempotencyKey,
        surface: input.reservation.surface,
        status: input.status,
        costHundredths: charged,
        occurredAt: input.time.now,
      });
      return charged;
    },
  });
}

export function finalizeOfflineGeneration(input: {
  reservation: OfflineGenerationReservation;
  accountId: string;
  deviceId: string;
  keys: readonly OfflineLeaseVerificationKey[];
  time: TrustedOfflineTime;
  costHundredths: number;
}): Promise<number> {
  return settleOfflineGeneration({ ...input, status: "succeeded" });
}

export function releaseOfflineGeneration(input: {
  reservation: OfflineGenerationReservation;
  accountId: string;
  deviceId: string;
  keys: readonly OfflineLeaseVerificationKey[];
  time: TrustedOfflineTime;
}): Promise<number> {
  return settleOfflineGeneration({ ...input, status: "released", costHundredths: 0 });
}

/**
 * Drop a finished block and its signed events from this device.
 *
 * Only for a block that has expired and whose events the server has: the chain
 * is verified from its first sequence, so a device that keeps half of one can
 * never report the rest.
 */
export async function forgetOfflineUsageLease(
  accountId: string,
  deviceId: string,
  leaseId: string,
): Promise<void> {
  await runExclusive(deviceId, async () => {
    const db = await openDb();
    try {
      const transaction = db.transaction([LEASE_STORE, STATE_STORE, EVENT_STORE], "readwrite");
      const row = (await requestResult(transaction.objectStore(LEASE_STORE).get(leaseId))) as
        LeaseRow | undefined;
      if (row && row.accountId === accountId && row.deviceId === deviceId) {
        transaction.objectStore(LEASE_STORE).delete(leaseId);
        transaction.objectStore(STATE_STORE).delete(leaseId);
        transaction
          .objectStore(EVENT_STORE)
          .delete(IDBKeyRange.bound(`${leaseId}:`, `${leaseId}:￿`));
      }
      await transactionDone(transaction);
    } finally {
      db.close();
    }
  });
}

export async function listOfflineUsageEvents(
  leaseId: string,
  existingDb?: IDBDatabase,
): Promise<SignedOfflineUsageEvent[]> {
  const db = existingDb ?? (await openDb());
  try {
    const transaction = db.transaction(EVENT_STORE, "readonly");
    const rows = (await requestResult(
      transaction
        .objectStore(EVENT_STORE)
        .index("by_lease_sequence")
        .getAll(IDBKeyRange.bound([leaseId, 0], [leaseId, Number.MAX_SAFE_INTEGER])),
    )) as EventRow[];
    await transactionDone(transaction);
    return rows.map(({ payload, eventHash, deviceSignature }) => ({
      payload,
      eventHash,
      deviceSignature,
    }));
  } finally {
    if (!existingDb) db.close();
  }
}

export async function readInstalledOfflineLeases(
  accountId: string,
  deviceId: string,
): Promise<
  {
    lease: SignedOfflineUsageLease;
    verificationKeys: OfflineLeaseVerificationKey[];
    consumedHundredths: number;
    reservedHundredths: number;
  }[]
> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    const transaction = db.transaction([LEASE_STORE, STATE_STORE], "readonly");
    const [leases, states] = await Promise.all([
      requestResult(transaction.objectStore(LEASE_STORE).getAll()) as Promise<LeaseRow[]>,
      requestResult(transaction.objectStore(STATE_STORE).getAll()) as Promise<LeaseStateRow[]>,
    ]);
    await transactionDone(transaction);
    const stateByLease = new Map(states.map((state) => [state.leaseId, state]));
    return leases
      .filter((row) => row.accountId === accountId && row.deviceId === deviceId)
      .map((row) => {
        const state = stateByLease.get(row.leaseId);
        return {
          lease: row.lease,
          verificationKeys: row.verificationKeys,
          consumedHundredths: state?.consumedHundredths ?? 0,
          reservedHundredths: Object.values(state?.reservations ?? {}).reduce<number>(
            (sum, reservation) => sum + reservationAmount(reservation),
            0,
          ),
        };
      });
  } finally {
    db.close();
  }
}
