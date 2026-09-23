/**
 * THE ONE GATE ABOVE EVERY AI SURFACE.
 *
 *   product surface
 *     → CommercialGenerationGate.acquire
 *     → a backend-neutral permit
 *     → OCADE Intelligence
 *     → agent and tools
 *     → success:                        permit.finalize()
 *     → failure or cancel before output: permit.release(reason)
 *
 * NO SURFACE ROUTES WITHOUT A PERMIT, and the permit is acquired BEFORE
 * routing rather than charged after answering. That ordering is the whole
 * design. Charging afterwards means an exhausted account still reaches a
 * backend — it does the work, it costs whatever it costs, and only then is the
 * person told they had nothing left. Reserving first means exhaustion is
 * answered in a few milliseconds, locally, with a truthful reset time.
 *
 * EXHAUSTION CANNOT FALL BACK TO THE LOCAL ENGINE. The allowance is one pool
 * across every surface and every backend, so "the cloud said no, run it on the
 * device" is not a degradation path — it is the allowance being spent twice.
 * The gate is above the router, not inside one branch of it, which is what
 * makes that impossible rather than merely discouraged.
 *
 * THE PERMIT IS BACKEND-NEUTRAL. It carries what was reserved and how to
 * settle it, and nothing about which engine will serve the request. A permit
 * that named a backend would have to be re-issued when the router changed its
 * mind mid-request, and re-issuing is how one request comes to be charged
 * twice.
 *
 * WHAT IS NOT CHARGED, and each of these was a way to overcharge somebody for
 * OCADE's own behaviour:
 *
 *   - a request that failed;
 *   - a request cancelled before any output reached the person;
 *   - OCADE's internal retries and fallback replays;
 *   - internal tool loops and internal subagents;
 *   - a duplicate submission of a request already in flight.
 *
 * Pure of clocks and storage: `now` is a parameter and the ledger is a port,
 * so every rule above is reachable from a test without a database.
 */
import type { PlanTier } from "@/lib/payments/pricing";
import {
  ALLOWANCES,
  ONE_USE,
  type UsageWindow,
  type WindowUsage,
  checkAllowance,
  windowFor,
} from "./usage-policy";

/** Where a generation came from. Chat is the product's only surface. */
export const GENERATION_SURFACES = ["chat"] as const;
export type GenerationSurface = (typeof GENERATION_SURFACES)[number];

export type DurablePermitOutcome =
  | "granted"
  | "duplicate_completed"
  | "idempotency_conflict"
  | "session_exhausted"
  | "week_exhausted";

export interface DurablePermitAcquisition {
  permitId: string | null;
  outcome: DurablePermitOutcome;
  reserved: number;
  sessionResetAt: number;
  weekResetAt: number;
}

export interface DurableWindowUsage {
  kind: "session" | "week";
  startsAt: number;
  endsAt: number;
  used: number;
  reserved: number;
}

/**
 * The ledger the gate settles against.
 *
 * A port rather than a Supabase client, because the rules above are worth
 * testing exhaustively and a database makes exhaustive slow. The production
 * binding calls the two atomic RPCs; `reserve` throws `AllowanceExhausted`
 * when the ledger refuses.
 */
export interface CommercialUsageLedger {
  /** What each window already holds, in successful requests. */
  read(userId: string, windows: UsageWindow[]): Promise<Map<string, number>>;
  /** Add to one window atomically. Throws when it would exceed the allowance. */
  reserve(input: {
    userId: string;
    window: UsageWindow;
    amount: number;
    allowance: number | null;
  }): Promise<void>;
  /** Give work back. Must floor at zero. */
  release(input: { userId: string; window: UsageWindow; amount: number }): Promise<void>;
  /**
   * Production-only durable lifecycle. When present, acquisition and settlement
   * happen in one Postgres transaction and survive process restarts.
   */
  acquirePermit?(input: {
    userId: string;
    idempotencyKey: string;
    generationId: string;
    surface: GenerationSurface;
    tier: PlanTier;
    sessionAllowance: number;
    weekAllowance: number | null;
    reserved: number;
  }): Promise<DurablePermitAcquisition>;
  finalizePermit?(input: { userId: string; idempotencyKey: string }): Promise<number>;
  releasePermit?(input: {
    userId: string;
    idempotencyKey: string;
    reason: ReleaseReason;
  }): Promise<boolean>;
  expirePermits?(userId: string): Promise<number>;
  /** Read the exact server-authored windows used by durable acquisition. */
  readCurrent?(userId: string): Promise<DurableWindowUsage[]>;
}

export class AllowanceExhausted extends Error {
  constructor(readonly window: UsageWindow) {
    super("allowance_exhausted");
    this.name = "AllowanceExhausted";
  }
}

/** Why a permit was released without being charged. */
export type ReleaseReason = "failed" | "cancelled_before_output" | "superseded" | "abandoned";

export interface GenerationPermit {
  readonly id: string;
  readonly accountId: string;
  readonly generationId: string;
  readonly surface: GenerationSurface;
  readonly tier: PlanTier;
  /** Uses currently held against the account. Always one, until settled. */
  readonly reserved: number;
  /** Charge the one use this request reserved. */
  finalize(): Promise<number>;
  /** Give everything back. Safe to call twice. */
  release(reason: ReleaseReason): Promise<void>;
}

export type AcquireResult =
  | { ok: true; permit: GenerationPermit }
  | {
      ok: false;
      reason: "allowance_exhausted";
      /** Which window ran out, so the message can say when it returns. */
      exhausted: "session" | "week";
      resetsAt: number;
    }
  | {
      ok: false;
      reason: "duplicate_completed" | "idempotency_conflict";
      exhausted?: never;
      resetsAt?: never;
    };

export interface AcquireRequest {
  userId: string;
  tier: PlanTier;
  /** When the account's windows are anchored. Usually account creation. */
  anchoredAt: number;
  now: number;
  /**
   * One key per LOGICAL customer request.
   *
   * A double-clicked send, a retried submit and a reconnecting client all
   * arrive with the same key and must share one permit. Without it, the
   * person is charged once per delivery attempt rather than once per thing
   * they asked for.
   */
  idempotencyKey: string;
  /** Stable identity for the generated result; defaults to the request key. */
  generationId?: string;
  /** Product surface acquiring the shared account allowance. */
  surface?: GenerationSurface;
}

function windowKey(window: UsageWindow): string {
  return `${window.kind}:${window.startsAt}`;
}

export class CommercialGenerationGate {
  /** Unit-test fallback permits. Production idempotency lives in Postgres. */
  private readonly inFlight = new Map<string, GenerationPermit>();

  constructor(private readonly ledger: CommercialUsageLedger) {}

  async acquire(request: AcquireRequest): Promise<AcquireResult> {
    const generationId = request.generationId ?? request.idempotencyKey;
    const surface = request.surface ?? "chat";
    const existing = this.inFlight.get(request.idempotencyKey);
    if (existing) return { ok: true, permit: existing };

    const allowance = ALLOWANCES[request.tier];

    if (this.ledger.acquirePermit) {
      const durable = await this.ledger.acquirePermit({
        userId: request.userId,
        idempotencyKey: request.idempotencyKey,
        generationId,
        surface,
        tier: request.tier,
        sessionAllowance: allowance.session,
        weekAllowance: allowance.week,
        reserved: ONE_USE,
      });
      if (durable.outcome === "session_exhausted" || durable.outcome === "week_exhausted") {
        return {
          ok: false,
          reason: "allowance_exhausted",
          exhausted: durable.outcome === "session_exhausted" ? "session" : "week",
          resetsAt:
            durable.outcome === "session_exhausted" ? durable.sessionResetAt : durable.weekResetAt,
        };
      }
      if (durable.outcome === "duplicate_completed" || durable.outcome === "idempotency_conflict") {
        return { ok: false, reason: durable.outcome };
      }
      if (!durable.permitId) {
        throw new Error("The commercial ledger granted a permit without an identity.");
      }
      return {
        ok: true,
        permit: this.createDurablePermit(request, generationId, surface, durable),
      };
    }

    const session = windowFor("session", request.anchoredAt, request.now);
    const week = windowFor("week", request.anchoredAt, request.now);
    const windows = [session, week];

    const used = await this.ledger.read(request.userId, windows);
    const usage: WindowUsage[] = [
      {
        kind: "session",
        used: used.get(windowKey(session)) ?? 0,
        allowance: allowance.session,
        window: session,
      },
      {
        kind: "week",
        used: used.get(windowKey(week)) ?? 0,
        allowance: allowance.week,
        window: week,
      },
    ];

    /*
     * RESERVED AT WHAT IT COSTS, WHICH IS ALWAYS ONE.
     *
     * There is nothing to predict any more. A successful request costs one use
     * on every tier, so the reservation IS the charge and `finalize` has
     * nothing to reconcile. What this once did — reserve a quarter-equivalent
     * floor, then top up or refund the difference against a weighted
     * measurement the browser supplied — is gone with the weighting.
     */
    const verdict = checkAllowance(usage);
    if (!verdict.allowed) {
      return {
        ok: false,
        reason: "allowance_exhausted",
        exhausted: verdict.exhausted,
        resetsAt: verdict.resetsAt,
      };
    }

    /*
     * The pre-check above is advisory; THIS is the decision.
     *
     * Two requests can both read "one left" and both pass the check. The
     * ledger's reserve is atomic and refuses the second, so the race is
     * resolved where the numbers actually live rather than in whichever
     * process read first.
     */
    const reservedWindows: { window: UsageWindow; amount: number }[] = [];
    try {
      for (const entry of usage) {
        await this.ledger.reserve({
          userId: request.userId,
          window: entry.window,
          amount: ONE_USE,
          allowance: entry.allowance,
        });
        reservedWindows.push({ window: entry.window, amount: ONE_USE });
      }
    } catch (error) {
      /*
       * One window took the reservation and another refused it. Give the first
       * one back before answering, or a refused request quietly costs the
       * person their session allowance.
       */
      for (const held of reservedWindows) {
        await this.ledger
          .release({ userId: request.userId, window: held.window, amount: held.amount })
          .catch(() => {
            /* Releasing is best-effort; the window will expire regardless. */
          });
      }
      if (error instanceof AllowanceExhausted) {
        return {
          ok: false,
          reason: "allowance_exhausted",
          exhausted: error.window.kind,
          resetsAt: error.window.endsAt,
        };
      }
      throw error;
    }

    const permit = this.createPermit(request, reservedWindows);
    this.inFlight.set(request.idempotencyKey, permit);
    return { ok: true, permit };
  }

  private createPermit(
    request: AcquireRequest,
    held: { window: UsageWindow; amount: number }[],
  ): GenerationPermit {
    let settled = false;
    let reserved: number = ONE_USE;

    return {
      id: request.idempotencyKey,
      accountId: request.userId,
      generationId: request.generationId ?? request.idempotencyKey,
      surface: request.surface ?? "chat",
      tier: request.tier,
      get reserved() {
        return reserved;
      },

      finalize: async (): Promise<number> => {
        // Settling twice would charge the same answer twice.
        if (settled) return reserved;
        settled = true;
        this.inFlight.delete(request.idempotencyKey);
        /*
         * NOTHING TO RECONCILE. The one use was taken when the request was
         * permitted and the answer costs exactly that, so finalising is only
         * deciding not to give it back.
         */
        return reserved;
      },

      release: async (): Promise<void> => {
        if (settled) return;
        settled = true;
        this.inFlight.delete(request.idempotencyKey);
        for (const entry of held) {
          await this.ledger.release({
            userId: request.userId,
            window: entry.window,
            amount: entry.amount,
          });
        }
        reserved = 0;
      },
    };
  }

  private createDurablePermit(
    request: AcquireRequest,
    generationId: string,
    surface: GenerationSurface,
    acquired: DurablePermitAcquisition,
  ): GenerationPermit {
    let settled = false;
    let reserved = acquired.reserved;
    return {
      id: acquired.permitId!,
      accountId: request.userId,
      generationId,
      surface,
      tier: request.tier,
      get reserved() {
        return reserved;
      },
      finalize: async () => {
        if (settled) return reserved;
        settled = true;
        reserved = await this.finalizePersisted({
          userId: request.userId,
          idempotencyKey: request.idempotencyKey,
        });
        return reserved;
      },
      release: async (reason) => {
        if (settled) return;
        settled = true;
        await this.releasePersisted({
          userId: request.userId,
          idempotencyKey: request.idempotencyKey,
          reason,
        });
        reserved = 0;
      },
    };
  }

  /** Settle a durable permit without relying on the process that acquired it. */
  async finalizePersisted(input: { userId: string; idempotencyKey: string }): Promise<number> {
    if (!this.ledger.finalizePermit) {
      throw new Error("The commercial ledger has no durable permit authority.");
    }
    return this.ledger.finalizePermit({
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /** Release a durable permit without relying on process-local state. */
  async releasePersisted(input: {
    userId: string;
    idempotencyKey: string;
    reason: ReleaseReason;
  }): Promise<boolean> {
    if (!this.ledger.releasePermit) {
      throw new Error("The commercial ledger has no durable permit authority.");
    }
    return this.ledger.releasePermit(input);
  }

  /** Reclaim expired holds before presenting current usage. */
  async expirePersisted(userId: string): Promise<number> {
    return this.ledger.expirePermits?.(userId) ?? 0;
  }
}
