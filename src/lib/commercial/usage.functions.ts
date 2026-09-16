/**
 * THE COMMERCIAL GATE, AS THE PRODUCT CALLS IT.
 *
 * The gate and its ledger are server-side, because the ledger's RPCs are
 * granted to `service_role` alone: a browser must be unable to spend or return
 * its own allowance, and the way to guarantee that is to keep the numbers
 * somewhere the browser has no key for.
 *
 * So a surface calls three functions around one logical request:
 *
 *   acquireGenerationPermit   before routing to any backend
 *   finalizeGenerationPermit  once output has genuinely reached the person
 *   releaseGenerationPermit   on failure, or on cancellation before output
 *
 * THE CLIENT REPORTS NOTHING THAT COSTS MONEY. It used to send a measurement —
 * tokens in, tokens out, tool batches, side effects — which the server weighed
 * into a fractional charge, and every field of it had to be clamped because a
 * negative one would credit the account. A successful request costs one use on
 * every tier, so the browser has nothing left to report and nothing left to get
 * wrong. The tier, the allowance and the window were always server-side and
 * still are.
 *
 * THE IDEMPOTENCY KEY IS BOUND TO THE ACCOUNT, not taken at face value. Two
 * people sending at the same moment with the same client-generated key must not
 * share a permit.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CommercialGenerationGate, type GenerationSurface } from "./generation-gate";
import { supabaseCommercialLedger } from "./supabase-ledger";
import { ALLOWANCES, describeUsage } from "./usage-policy";
import { resolveTierFor, type ResolvedEntitlement } from "./entitlement-resolver";

/**
 * One adapter per server instance. Permit identity, reservations and settlement
 * all live in Postgres, so another instance or a restart observes the same run.
 */
let gate: CommercialGenerationGate | null = null;

/**
 * The gate, built once and reused — see the note above about why one object.
 *
 * ASYNC BECAUSE THE ADMIN CLIENT IS IMPORTED ON DEMAND. This module is reached
 * from route modules the generated route tree imports statically, so a
 * top-level import of the server client put `@supabase/supabase-js` on the
 * client entry chunk's graph, for code that only runs on the server. The
 * handler that calls this already awaits the ledger immediately afterwards.
 */
async function generationGate(): Promise<CommercialGenerationGate> {
  if (!gate) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    gate = new CommercialGenerationGate(supabaseCommercialLedger(supabaseAdmin));
  }
  return gate;
}

export interface PermitGranted {
  ok: true;
  permitId: string;
  tier: ResolvedEntitlement["tier"];
}

export interface PermitRefused {
  ok: false;
  reason: "allowance_exhausted" | "duplicate_completed" | "idempotency_conflict";
  exhausted?: "session" | "week";
  /** How long until the allowance returns, so the message can be exact. */
  resetsInMs?: number;
  resetsAt?: string;
}

export type PermitResult = PermitGranted | PermitRefused;

/**
 * Server-side transports call this before importing a model or native adapter.
 * A browser-held object is not authority: the durable permit row must still
 * belong to the authenticated caller, match the surface and remain reserved.
 * The database also claims the transport atomically. Merely selecting the row
 * would let two concurrent requests race through on the same copied permit.
 */
export async function assertActiveGenerationPermit(input: {
  userId: string;
  permitId: string;
  generationId: string;
  idempotencyKey: string;
  surface: GenerationSurface;
  source: "server" | "offline_lease";
}): Promise<void> {
  if (input.source !== "server") {
    throw new Error("Offline permits cannot authorize a server-side intelligence transport.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: claimed, error } = await supabaseAdmin.rpc("ocade_claim_generation_transport", {
    p_user_id: input.userId,
    p_permit_id: input.permitId,
    p_generation_id: input.generationId,
    p_idempotency_key: input.idempotencyKey,
    p_surface: input.surface,
  });
  if (error || claimed !== true) {
    throw new Error(
      "This generation permit is missing, expired, settled, already claimed, or belongs elsewhere.",
    );
  }
}

/**
 * Ask for permission to run one logical request.
 *
 * NOTHING ROUTES BEFORE THIS RETURNS `ok`. An exhausted account is refused
 * here, before any backend is touched, and it cannot fall back to the local
 * engine — the allowance is one pool across every surface and backend, so
 * "the cloud refused, run it on the device" would spend it twice.
 */
export const acquireGenerationPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { idempotencyKey: string; generationId?: string; surface?: GenerationSurface }) => {
      const key = data?.idempotencyKey?.trim();
      if (!key) throw new Error("A request key is required.");
      if (key.length > 200) throw new Error("That request key is not valid.");
      const generationId = data.generationId?.trim() || key;
      if (generationId.length > 200) throw new Error("That generation identity is not valid.");
      const allowedSurfaces: GenerationSurface[] = ["chat", "cowork"];
      const surface = data.surface ?? "chat";
      if (!allowedSurfaces.includes(surface))
        throw new Error("That generation surface is not valid.");
      return { idempotencyKey: key, generationId, surface };
    },
  )
  .handler(async ({ data, context }): Promise<PermitResult> => {
    const entitlement = await resolveTierFor(context.userId);
    const now = Date.now();

    const result = await (
      await generationGate()
    ).acquire({
      userId: context.userId,
      tier: entitlement.tier,
      anchoredAt: entitlement.anchoredAt,
      now,
      idempotencyKey: data.idempotencyKey,
      generationId: data.generationId,
      surface: data.surface,
    });

    if (!result.ok && result.reason === "allowance_exhausted") {
      return {
        ok: false,
        reason: "allowance_exhausted",
        exhausted: result.exhausted,
        resetsInMs: Math.max(0, result.resetsAt - now),
        resetsAt: new Date(result.resetsAt).toISOString(),
      };
    }
    if (!result.ok) return { ok: false, reason: result.reason };

    return {
      ok: true,
      permitId: result.permit.id,
      tier: entitlement.tier,
    };
  });

/**
 * The answer reached the person. Charge the one use it reserved.
 *
 * Called only once output has genuinely been delivered — not when generation
 * started, and not when a stream opened.
 *
 * NOTHING IS MEASURED HERE ANY MORE, and that removed a whole trust boundary.
 * This used to take a `WorkMeasurement` from the browser — input tokens, output
 * tokens, read batches, side effects, media work — clamp every field because a
 * negative one would credit the account and a NaN would poison the arithmetic,
 * and weigh the result into a fractional cost. A successful request costs one
 * use on every tier, so the browser has nothing left to report and nothing left
 * to get wrong.
 */
export const finalizeGenerationPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { idempotencyKey: string }) => {
    const key = data?.idempotencyKey?.trim();
    if (!key) throw new Error("A request key is required.");
    return { idempotencyKey: key };
  })
  .handler(async ({ data, context }): Promise<{ charged: number }> => {
    const charged = await (
      await generationGate()
    ).finalizePersisted({
      userId: context.userId,
      idempotencyKey: data.idempotencyKey,
    });
    return { charged };
  });

/**
 * Nothing reached the person. Charge nothing.
 *
 * Failures, and cancellations before any output — the two cases where a person
 * would otherwise pay for OCADE's behaviour rather than for their own request.
 */
export const releaseGenerationPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { idempotencyKey: string; reason?: string }) => {
    const key = data?.idempotencyKey?.trim();
    if (!key) throw new Error("A request key is required.");
    return { idempotencyKey: key, reason: data.reason };
  })
  .handler(async ({ data, context }): Promise<{ released: boolean }> => {
    const released = await (
      await generationGate()
    ).releasePersisted({
      userId: context.userId,
      idempotencyKey: data.idempotencyKey,
      reason: data.reason === "cancelled_before_output" ? "cancelled_before_output" : "failed",
    });
    return { released };
  });

export interface CommercialUsageView {
  tier: ResolvedEntitlement["tier"];
  /**
   * Exact counts, on every tier.
   *
   * This carried two shapes — raw numbers on Free, percentages on Pro and Max —
   * because the paid tiers counted a weighted "Standard Work Equivalent" that
   * was not a unit anybody could convert into their own work. The unit is now a
   * successful request, so there is nothing left to hide behind a proportion
   * and nothing left for two shapes to disagree about.
   */
  windows: {
    kind: "session" | "week";
    used: number;
    remaining: number;
    allowance: number;
    /** Requests in flight right now, already held against the allowance. */
    onlineReserved: number;
    /** Capacity already signed or being signed for disconnected devices. */
    offlineAllocated: number;
    resetsInMs: number;
    resetsAt: string;
  }[];
}

/**
 * What this account has spent, and how much of it is left.
 *
 * READ-ONLY, and the numbers are the ones the person is shown: "18 of 28 left".
 */
export const readCommercialUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommercialUsageView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entitlement = await resolveTierFor(context.userId);
    const now = Date.now();
    const ledger = supabaseCommercialLedger(supabaseAdmin);
    if (!ledger.readCurrent) throw new Error("The usage ledger has no server window authority.");
    const current = await ledger.readCurrent(context.userId);
    const offlineResult = process.env.OCADE_LEASE_SIGNING_KEY_ID
      ? await supabaseAdmin.rpc("ocade_read_offline_usage", { p_user_id: context.userId })
      : { data: [], error: null };
    if (offlineResult.error) {
      throw new Error(
        `The usage ledger could not read offline allocations: ${offlineResult.error.message}`,
      );
    }
    const offlineRows = offlineResult.data ?? [];

    const allowance = ALLOWANCES[entitlement.tier];
    const windows: CommercialUsageView["windows"] = [];
    for (const serverWindow of current) {
      const cap = serverWindow.kind === "session" ? allowance.session : allowance.week;
      const window = {
        kind: serverWindow.kind,
        startsAt: serverWindow.startsAt,
        endsAt: serverWindow.endsAt,
      };
      const offlineAllocated = (offlineRows ?? [])
        .filter(
          (row) =>
            ["active", "preissued", "pending_signature"].includes(row.status) &&
            Date.parse(
              serverWindow.kind === "session" ? row.session_window_start : row.week_window_start,
            ) === serverWindow.startsAt,
        )
        .reduce((sum, row) => sum + Number(row.pending_hundredths) / 100, 0);
      const shown = describeUsage(
        {
          kind: window.kind,
          used: Math.max(0, serverWindow.used - offlineAllocated),
          allowance: cap,
          window,
        },
        now,
      );
      // `describeUsage` returns null for a window with no allowance — Free's
      // week is not "100% remaining"; it does not exist, and it is not shown.
      if (shown) {
        windows.push({
          ...shown,
          onlineReserved: Math.round(serverWindow.reserved),
          offlineAllocated: Math.round(offlineAllocated),
          resetsAt: new Date(window.endsAt).toISOString(),
        });
      }
    }

    return { tier: entitlement.tier, windows };
  });
