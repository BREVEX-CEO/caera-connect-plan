/**
 * ONE BILLED REQUEST, FROM THE SURFACE'S POINT OF VIEW.
 *
 * A surface that runs AI work calls `beginBilledRequest` before it routes
 * anywhere, records what it delivered as it delivers it, and settles once at
 * the end:
 *
 *   const billed = await beginBilledRequest();
 *   if (!billed) return;                 // refused, and already explained
 *   try {
 *     ...                                 // route, generate, stream
 *     billed.recordDelivery({ ... });      // output genuinely reached them
 *   } finally {
 *     await billed.settle();               // finalize if delivered, else release
 *   }
 *
 * SETTLING IN A `finally` IS THE POINT. Every way out of a send — an answer, a
 * failure, a thrown storage error, a stop — passes through it, so there is no
 * exit that quietly leaves a reservation held against somebody who received
 * nothing. `settle` is idempotent, so calling it on a path that already
 * finalised does nothing.
 *
 * DELIVERY IS RECORDED, NOT ASSUMED. `settle` releases unless something was
 * actually delivered, which makes the safe outcome the default: a new code path
 * that forgets to record delivery under-charges, and one that forgets to settle
 * is caught by the `finally` it is written inside.
 *
 * THE BROWSER COUNTS; THE SERVER PRICES. On-device inference happens here, so
 * this is the only thing that can count the tokens it produced. It never says
 * what they are worth — the tier, the weighting, the allowance and the window
 * all come from the server, which clamps whatever arrives.
 */
import { toast } from "sonner";
import { getOfflineCurrentDeviceIdentity } from "./device-identity";
import { observeNow, readTrustedClockHighWater } from "@/lib/time/trusted-clock";
import {
  acquireGenerationPermit,
  finalizeGenerationPermit,
  releaseGenerationPermit,
} from "./usage.functions";
import {
  finalizeOfflineGeneration,
  readInstalledOfflineLeases,
  releaseOfflineGeneration,
  reserveOfflineGeneration,
  type OfflineGenerationReservation,
} from "./offline-counter";
import { trustedOfflineTimeNow } from "./offline-lease";
import { ONE_USE } from "./usage-policy";
import { describeReset } from "./use-commercial-usage";
import type { GenerationSurface } from "./generation-gate";

export interface DeliveredWork {
  /** What the person actually received. Partial output still counts. */
  answer?: string;
}

export interface BilledRequest {
  /** Backend-neutral proof that the commercial gate ran before intelligence. */
  readonly permit: {
    id: string;
    generationId: string;
    idempotencyKey: string;
    surface: GenerationSurface;
    source: "server" | "offline_lease";
  };
  /** Record that output genuinely reached the person. Safe to call repeatedly. */
  recordDelivery(work: DeliveredWork): void;
  /** Finalize what was delivered, or release when nothing was. Idempotent. */
  settle(): Promise<void>;
}

/** How long the UI waits for the authoritative allowance service. */
const PERMIT_TIMEOUT_MS = 6000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | "timed_out"> {
  return Promise.race([
    work,
    new Promise<"timed_out">((resolve) => setTimeout(() => resolve("timed_out"), ms)),
  ]);
}

function formatResetAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

/**
 * Acquire a permit for one logical request.
 *
 * Returns null when the request must not proceed; the person has already been
 * told why, and in language that says when their allowance returns rather than
 * only that it is gone.
 */
export async function beginBilledRequest(options?: {
  /** One key per logical request. Generated when not supplied. */
  idempotencyKey?: string;
  generationId?: string;
  surface?: GenerationSurface;
}): Promise<BilledRequest | null> {
  const idempotencyKey = options?.idempotencyKey ?? crypto.randomUUID();
  const generationId = options?.generationId ?? idempotencyKey;
  const surface = options?.surface ?? "chat";

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return beginOfflineBilledRequest({ idempotencyKey, generationId, surface, explain: true });
  }

  const acquisition = acquireGenerationPermit({
    data: { idempotencyKey, generationId, surface },
  });
  let serverPermitId = idempotencyKey;

  try {
    const result = await withTimeout(acquisition, PERMIT_TIMEOUT_MS);

    if (result === "timed_out") {
      /*
       * A timeout cannot become permission. The request may still complete on
       * the server after the browser has stopped waiting, though, so release a
       * late reservation instead of leaving it charged until window expiry.
       */
      void acquisition
        .then(async (lateResult) => {
          if (!lateResult.ok) return;
          await releaseGenerationPermit({ data: { idempotencyKey, reason: "client_timeout" } });
        })
        .catch(() => undefined);
      return (
        (await beginOfflineBilledRequest({ idempotencyKey, generationId, surface })) ??
        unavailablePermit()
      );
    }

    if (!result.ok) {
      if (result.reason === "duplicate_completed") {
        toast.error("That request has already completed.", {
          description: "OCADE did not run or charge it again.",
        });
        return null;
      }
      if (result.reason === "idempotency_conflict") {
        toast.error("That request identity is already in use.", {
          description:
            "OCADE stopped before routing so a different request cannot share its charge.",
        });
        return null;
      }
      toast.error(
        result.exhausted === "week"
          ? "You have used this week's allowance."
          : "You have used this session's allowance.",
        {
          description: `${
            formatResetAt(result.resetsAt)
              ? `It resets ${formatResetAt(result.resetsAt)} (${describeReset(result.resetsInMs ?? 0)})`
              : `It returns ${describeReset(result.resetsInMs ?? 0)}`
          }. Nothing was sent, and nothing was charged.`,
          duration: 10_000,
        },
      );
      return null;
    }
    serverPermitId = result.permitId;
  } catch {
    /*
     * A transport failure is ambiguous: the server may have committed the
     * reservation before the response was lost. A best-effort idempotent
     * release handles that case. It is intentionally not awaited because an
     * unavailable gate must not make the refusal itself hang.
     */
    void releaseGenerationPermit({ data: { idempotencyKey, reason: "acquire_failed" } }).catch(
      () => undefined,
    );
    return (
      (await beginOfflineBilledRequest({ idempotencyKey, generationId, surface })) ??
      unavailablePermit()
    );
  }

  return createBilledRequest({
    permit: {
      id: serverPermitId,
      generationId,
      idempotencyKey,
      surface,
      source: "server",
    },
    settleSuccess: () =>
      finalizeGenerationPermit({ data: { idempotencyKey } }).then(() => undefined),
    settleEmpty: () =>
      releaseGenerationPermit({
        data: { idempotencyKey, reason: "cancelled_before_output" },
      }).then(() => undefined),
  });
}

function unavailablePermit(): null {
  toast.error("OCADE could not verify your usage allowance.", {
    description:
      "Nothing was sent and nothing was charged. Try again when the connection is stable.",
  });
  return null;
}

async function beginOfflineBilledRequest(input: {
  idempotencyKey: string;
  generationId: string;
  surface: GenerationSurface;
  explain?: boolean;
}): Promise<BilledRequest | null> {
  try {
    const identity = await getOfflineCurrentDeviceIdentity();
    if (!identity) throw new Error("This signed-in browser has no verified offline allocation.");
    const installed = await readInstalledOfflineLeases(identity.accountId, identity.deviceId);
    let selected:
      | {
          reservation: OfflineGenerationReservation;
          entry: (typeof installed)[number];
        }
      | undefined;
    let lastError: unknown;
    for (const entry of installed.sort(
      (a, b) => Date.parse(a.lease.payload.expiresAt) - Date.parse(b.lease.payload.expiresAt),
    )) {
      try {
        const reservation = await reserveOfflineGeneration({
          accountId: identity.accountId,
          deviceId: identity.deviceId,
          leaseId: entry.lease.payload.leaseId,
          generationId: input.generationId,
          idempotencyKey: input.idempotencyKey,
          surface: input.surface,
          keys: entry.verificationKeys,
          time: trustedOfflineTimeNow(entry.lease.payload.issuedAt, readTrustedClockHighWater()),
        });
        selected = { reservation, entry };
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!selected) throw lastError ?? new Error("No signed offline allowance is available.");

    const { reservation, entry } = selected;
    return createBilledRequest({
      permit: {
        id: `${reservation.leaseId}:${reservation.idempotencyKey}`,
        generationId: reservation.generationId,
        idempotencyKey: reservation.idempotencyKey,
        surface: reservation.surface,
        source: "offline_lease",
      },
      settleSuccess: async () => {
        await finalizeOfflineGeneration({
          reservation,
          accountId: identity.accountId,
          deviceId: identity.deviceId,
          keys: entry.verificationKeys,
          time: trustedOfflineTimeNow(entry.lease.payload.issuedAt, readTrustedClockHighWater()),
          costHundredths: ONE_USE * 100,
        });
        window.dispatchEvent(new Event("ocade:offline-usage-updated"));
      },
      settleEmpty: async () => {
        await releaseOfflineGeneration({
          reservation,
          accountId: identity.accountId,
          deviceId: identity.deviceId,
          keys: entry.verificationKeys,
          time: trustedOfflineTimeNow(entry.lease.payload.issuedAt, readTrustedClockHighWater()),
        });
        window.dispatchEvent(new Event("ocade:offline-usage-updated"));
      },
    });
  } catch (error) {
    if (input.explain) {
      toast.error("Offline Intelligence is locked on this device.", {
        description:
          error instanceof Error
            ? error.message
            : "Reconnect once so OCADE can verify this device's allowance.",
      });
    }
    return null;
  }
}

function createBilledRequest(input: {
  permit: BilledRequest["permit"];
  settleSuccess(): Promise<void>;
  settleEmpty(): Promise<void>;
}): BilledRequest {
  let anythingDelivered = false;
  let settled = false;

  return {
    permit: input.permit,
    recordDelivery(work) {
      /*
       * ONE QUESTION: DID ANY OUTPUT REACH THEM?
       *
       * This used to keep the longest prompt and the longest answer seen, count
       * read batches and side-effect actions, and estimate tokens from all of
       * it to build a weighted measurement. A successful request costs one use
       * on every tier now, so the only thing worth remembering is whether there
       * was an answer at all.
       */
      if ((work.answer ?? "").trim().length > 0) anythingDelivered = true;
    },

    async settle() {
      if (settled) return;
      settled = true;
      try {
        if (!anythingDelivered) {
          await input.settleEmpty();
          return;
        }
        await input.settleSuccess();
      } catch {
        /*
         * Settling failed. Not surfaced: the person has their answer, and a
         * toast about OCADE's bookkeeping would be noise they can do nothing
         * about. The reservation is already the charge, so the worst outcome
         * is that it stays held until its window expires.
         */
      }
    },
  };
}
