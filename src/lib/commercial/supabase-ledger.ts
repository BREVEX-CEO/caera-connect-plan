/** Server-only RPC binding. Amounts cross the database boundary as integer hundredths. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  AllowanceExhausted,
  type CommercialUsageLedger,
  type DurablePermitOutcome,
} from "./generation-gate";
import { ONE_USE, type UsageWindow } from "./usage-policy";

export function toHundredths(equivalents: number): number {
  return Math.round(equivalents * 100);
}

export function fromHundredths(hundredths: number): number {
  return hundredths / 100;
}

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function durableOutcome(value: string): DurablePermitOutcome {
  if (
    value === "granted" ||
    value === "duplicate_completed" ||
    value === "idempotency_conflict" ||
    value === "session_exhausted" ||
    value === "week_exhausted"
  ) {
    return value;
  }
  throw new Error(`The usage ledger returned an unknown permit outcome: ${value}`);
}

function windowKey(window: UsageWindow): string {
  return `${window.kind}:${window.startsAt}`;
}

/** Postgres raises `check_violation` (23514) when the allowance is exceeded. */
function isAllowanceExhausted(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23514" || (error?.message ?? "").includes("allowance_exhausted");
}

export function supabaseCommercialLedger(admin: SupabaseClient<Database>): CommercialUsageLedger {
  return {
    async read(userId, windows) {
      const out = new Map<string, number>();
      for (const window of windows) out.set(windowKey(window), 0);
      if (windows.length === 0) return out;

      const { data, error } = await admin
        .from("ocade_commercial_usage")
        .select("window_kind, window_start, used_hundredths")
        .eq("user_id", userId)
        .in(
          "window_start",
          windows.map((window) => new Date(window.startsAt).toISOString()),
        )

        .limit(windows.length);

      if (error) throw new Error(`The usage ledger could not be read: ${error.message}`);

      for (const row of data ?? []) {
        const startsAt = Date.parse(row.window_start as unknown as string);
        const match = windows.find(
          (window) => window.kind === row.window_kind && window.startsAt === startsAt,
        );
        if (match) out.set(windowKey(match), fromHundredths(Number(row.used_hundredths)));
      }
      return out;
    },

    async reserve({ userId, window, amount, allowance }) {
      const { error } = await admin.rpc("ocade_consume_commercial_work", {
        p_user_id: userId,
        p_window_kind: window.kind,
        p_window_start: new Date(window.startsAt).toISOString(),
        p_cost_hundredths: toHundredths(amount),
        // Null means "record it, do not cap it" — Free's week has no allowance
        // and is still worth recording for the account's own usage screen.
        p_limit_hundredths:
          allowance === null ? (null as unknown as number) : toHundredths(allowance),
      });
      if (!error) return;
      if (isAllowanceExhausted(error)) throw new AllowanceExhausted(window);
      throw new Error(`The usage ledger refused a reservation: ${error.message}`);
    },

    async release({ userId, window, amount }) {
      const { error } = await admin.rpc("ocade_release_commercial_work", {
        p_user_id: userId,
        p_window_kind: window.kind,
        p_window_start: new Date(window.startsAt).toISOString(),
        p_cost_hundredths: toHundredths(amount),
      });
      /*
       * A failed release is reported, never swallowed. It leaves allowance
       * held against an account that did not use it, which expires with the
       * window rather than persisting — but a person who was charged for a
       * failure deserves better than silence about it.
       */
      if (error) throw new Error(`The usage ledger could not release work: ${error.message}`);
    },

    async acquirePermit(input) {
      const { data, error } = await admin.rpc("ocade_acquire_generation_permit", {
        p_user_id: input.userId,
        p_idempotency_key: input.idempotencyKey,
        p_generation_id: input.generationId,
        p_surface: input.surface,
        p_tier: input.tier,
        p_session_limit_hundredths: toHundredths(input.sessionAllowance),
        p_week_limit_hundredths:
          input.weekAllowance === null
            ? (null as unknown as number)
            : toHundredths(input.weekAllowance),
        p_reserved_hundredths: toHundredths(input.reserved),
      });
      if (error) throw new Error(`The usage ledger could not acquire a permit: ${error.message}`);
      const row = firstRow(data);
      if (!row) throw new Error("The usage ledger returned no permit decision.");
      return {
        permitId: row.permit_id,
        outcome: durableOutcome(row.outcome),
        reserved: fromHundredths(Number(row.reserved_hundredths)),
        sessionResetAt: Date.parse(row.session_reset_at),
        weekResetAt: Date.parse(row.week_reset_at),
      };
    },

    async finalizePermit({ userId, idempotencyKey }) {
      const { data, error } = await admin.rpc("ocade_finalize_generation_permit", {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_cost_hundredths: toHundredths(ONE_USE),
      });
      if (error) throw new Error(`The usage ledger could not finalize a permit: ${error.message}`);
      const row = firstRow(data);
      if (!row) throw new Error("The usage ledger returned no finalization decision.");
      if (row.outcome !== "succeeded") {
        throw new Error(`The usage ledger could not finalize that permit: ${row.outcome}`);
      }
      return fromHundredths(Number(row.charged_hundredths));
    },

    async releasePermit({ userId, idempotencyKey, reason }) {
      const { data, error } = await admin.rpc("ocade_release_generation_permit", {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_reason: reason,
      });
      if (error) throw new Error(`The usage ledger could not release a permit: ${error.message}`);
      return data === true;
    },

    async expirePermits(userId) {
      const { data, error } = await admin.rpc("ocade_expire_commercial_permits", {
        p_user_id: userId,
      });
      if (error) throw new Error(`The usage ledger could not expire permits: ${error.message}`);
      return Number(data ?? 0);
    },

    async readCurrent(userId, surface = "chat") {
      const { data, error } = await admin.rpc("ocade_read_commercial_usage", {
        p_user_id: userId,
        ...(surface === "chat" ? {} : { p_surface: surface }),
      });
      if (error)
        throw new Error(`The usage ledger could not read current windows: ${error.message}`);
      return (data ?? []).map((row) => {
        if (row.window_kind !== "session" && row.window_kind !== "week") {
          throw new Error(`The usage ledger returned an unknown window: ${row.window_kind}`);
        }
        return {
          kind: row.window_kind,
          startsAt: Date.parse(row.window_start),
          endsAt: Date.parse(row.reset_at),
          used: fromHundredths(Number(row.used_hundredths)),
          reserved: fromHundredths(Number(row.reserved_hundredths)),
        };
      });
    },
  };
}
