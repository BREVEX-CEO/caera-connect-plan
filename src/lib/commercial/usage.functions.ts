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
 * THE CLIENT SUPPLIES THE MEASUREMENT, AND THE SERVER DECIDES WHAT IT COSTS.
 * That split is deliberate. On-device inference happens in the browser, so the
 * browser is the only thing that can count the tokens it produced — but it
 * never says what those tokens are worth. Weighting, the tier, the allowance
 * and the window all come from the server, so a tampered client can at worst
 * understate its own usage of an engine that costs OCADE nothing to run, and
 * can never grant itself a larger allowance or a plan it has not got.
 *
 * THE IDEMPOTENCY KEY IS BOUND TO THE ACCOUNT, not taken at face value. Two
 * people sending at the same moment with the same client-generated key must not
 * share a permit.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CommercialGenerationGate, type GenerationSurface } from "./generation-gate";
import { supabaseCommercialLedger } from "./supabase-ledger";
import { ALLOWANCES, describeUsage, type WorkMeasurement } from "./usage-policy";
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
  /** Exact use held on Free. Paid internal work units never cross to the UI. */
  reserved?: number;
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
      reserved: entitlement.tier === "free" ? result.permit.reserved : undefined,
    };
  });

function measurementFrom(data: Partial<WorkMeasurement> | undefined): WorkMeasurement {
  /*
   * Clamped and coerced, because these numbers come from a browser. A negative
   * count would credit the account; a NaN would poison the arithmetic. Neither
   * is treated as an attack to reject — a truncated stream can produce either
   * honestly — so both become zero and the request pays the floor.
   */
  const whole = (value: unknown): number => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  return {
    billableInputTokens: whole(data?.billableInputTokens),
    visibleOutputTokens: whole(data?.visibleOutputTokens),
    readToolBatches: whole(data?.readToolBatches),
    sideEffectActions: whole(data?.sideEffectActions),
    mediaWork: whole(data?.mediaWork),
  };
}

/**
 * The answer reached the person. Charge what it actually cost.
 *
 * Called only once output has genuinely been delivered — not when generation
 * started, and not when a stream opened.
 */
export const finalizeGenerationPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { idempotencyKey: string; measurement?: Partial<WorkMeasurement> }) => {
    const key = data?.idempotencyKey?.trim();
    if (!key) throw new Error("A request key is required.");
    return { idempotencyKey: key, measurement: data.measurement };
  })
  .handler(async ({ data, context }): Promise<{ charged: number }> => {
    const charged = await (
      await generationGate()
    ).finalizePersisted({
      userId: context.userId,
      idempotencyKey: data.idempotencyKey,
      measurement: measurementFrom(data.measurement),
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
   * What to show, already shaped by the tier's own rule: exact numbers on Free,
   * proportions on Pro and Max. Shaped on the SERVER so a browser cannot ask for
   * the raw equivalents behind a percentage.
   */
  windows: {
    kind: "session" | "week";
    display: "raw" | "percentage";
    used?: number;
    remaining?: number;
    allowance?: number;
    usedPercent?: number;
    remainingPercent?: number;
    /** Raw on Free; percentage-only on paid plans. */
    onlineReserved?: number;
    onlineReservedPercent?: number;
    /** Capacity already signed or being signed for disconnected devices. */
    offlineAllocated?: number;
    offlineAllocatedPercent?: number;
    resetsInMs: number;
    resetsAt: string;
  }[];
}

/**
 * What this account has spent, and how much of it is left.
 *
 * READ-ONLY and shaped by the tier before it leaves the server. Free is shown
 * exact numbers because it has twenty-eight of something to plan around; Pro
 * and Max are shown proportions, because a Standard Work Equivalent is not a
 * unit anybody can convert into their own work and quoting it would invite
 * people to optimise against the unit rather than do the work.
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
        entitlement.tier,
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
          remainingPercent:
            shown.display === "percentage" ? 100 - (shown.usedPercent ?? 0) : undefined,
          onlineReserved: shown.display === "raw" ? Math.round(serverWindow.reserved) : undefined,
          onlineReservedPercent:
            shown.display === "percentage" && cap
              ? Math.min(100, Math.round((serverWindow.reserved / cap) * 100))
              : undefined,
          offlineAllocated: shown.display === "raw" ? Math.round(offlineAllocated) : undefined,
          offlineAllocatedPercent:
            shown.display === "percentage" && cap
              ? Math.min(100, Math.round((offlineAllocated / cap) * 100))
              : undefined,
          resetsAt: new Date(window.endsAt).toISOString(),
        });
      }
    }

    return { tier: entitlement.tier, windows };
  });
