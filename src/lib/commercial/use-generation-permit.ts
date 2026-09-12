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
import { estimateTokens } from "./token-estimate";
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
import { costOf, type WorkMeasurement } from "./usage-policy";
import type { GenerationSurface } from "./generation-gate";

export interface DeliveredWork {
  /** What OCADE was given to work from, as it was actually sent. */
  prompt?: string;
  /** What the person actually received. Partial output still counts. */
  answer?: string;
  /** Distinct verified read batches, when the request used tools. */
  readToolBatches?: number;
  /** Distinct verified actions that changed something outside OCADE. */
  sideEffectActions?: number;
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

/** "in about 3 hours", for the sentence shown when an allowance runs out. */
function describeReset(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
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
    settleSuccess: (measurement) =>
      finalizeGenerationPermit({ data: { idempotencyKey, measurement } }).then(() => undefined),
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
      settleSuccess: async (measurement) => {
        await finalizeOfflineGeneration({
          reservation,
          accountId: identity.accountId,
          deviceId: identity.deviceId,
          keys: entry.verificationKeys,
          time: trustedOfflineTimeNow(entry.lease.payload.issuedAt, readTrustedClockHighWater()),
          costHundredths: Math.round(costOf(entry.lease.payload.tier, measurement) * 100),
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
  settleSuccess(measurement: WorkMeasurement): Promise<void>;
  settleEmpty(): Promise<void>;
}): BilledRequest {
  const delivered: Required<Omit<DeliveredWork, "prompt" | "answer">> & {
    prompt: string;
    answer: string;
  } = { prompt: "", answer: "", readToolBatches: 0, sideEffectActions: 0 };
  let anythingDelivered = false;
  let settled = false;

  return {
    permit: input.permit,
    recordDelivery(work) {
      // The longest text seen wins rather than the sum: a streaming path
      // reports the accumulated answer repeatedly, and adding those up would
      // charge for the same tokens once per frame.
      if (work.prompt && work.prompt.length > delivered.prompt.length) {
        delivered.prompt = work.prompt;
      }
      if (work.answer && work.answer.length > delivered.answer.length) {
        delivered.answer = work.answer;
      }
      delivered.readToolBatches = Math.max(delivered.readToolBatches, work.readToolBatches ?? 0);
      delivered.sideEffectActions = Math.max(
        delivered.sideEffectActions,
        work.sideEffectActions ?? 0,
      );
      if (delivered.answer.trim().length > 0) anythingDelivered = true;
    },

    async settle() {
      if (settled) return;
      settled = true;
      try {
        if (!anythingDelivered) {
          await input.settleEmpty();
          return;
        }
        const measurement: WorkMeasurement = {
          billableInputTokens: estimateTokens(delivered.prompt),
          visibleOutputTokens: estimateTokens(delivered.answer),
          readToolBatches: delivered.readToolBatches,
          sideEffectActions: delivered.sideEffectActions,
        };
        await input.settleSuccess(measurement);
      } catch {
        /*
         * Settling failed. Not surfaced: the person has their answer, and a
         * toast about OCADE's bookkeeping would be noise they can do nothing
         * about. The reservation expires with its window, so the worst outcome
         * is that a request is charged at the floor rather than in full.
         */
      }
    },
  };
}
