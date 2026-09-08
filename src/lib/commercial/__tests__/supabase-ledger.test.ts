import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  fromHundredths,
  supabaseCommercialLedger,
  toHundredths,
} from "@/lib/commercial/supabase-ledger";
import { AllowanceExhausted } from "@/lib/commercial/generation-gate";
import { windowFor } from "@/lib/commercial/usage-policy";

const ANCHOR = 1_700_000_000_000;
const SESSION = windowFor("session", ANCHOR, ANCHOR);
const WEEK = windowFor("week", ANCHOR, ANCHOR);

/**
 * A Supabase double that records the calls and returns what it is told to.
 *
 * Only the surface this module uses is implemented, and it is cast at the
 * boundary — a hand-written stand-in for the whole client would be a second
 * thing to keep correct.
 */
function fakeSupabase(options: {
  rows?: { window_kind: string; window_start: string; used_hundredths: number }[];
  readError?: { message: string };
  rpcError?: { code?: string; message: string };
  rpcData?: Record<string, unknown>;
}) {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

  const client = {
    from() {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        // The read is bounded; the double has to be able to receive the bound.
        limit: async () =>
          options.readError
            ? { data: null, error: options.readError }
            : { data: options.rows ?? [], error: null },
      };
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return { data: options.rpcData?.[name] ?? null, error: options.rpcError ?? null };
    },
  };

  return { client: client as unknown as SupabaseClient<Database>, rpcCalls };
}

describe("equivalents cross the boundary as integer hundredths", () => {
  it("converts both ways exactly", () => {
    expect(toHundredths(0.25)).toBe(25);
    expect(toHundredths(1)).toBe(100);
    expect(toHundredths(14)).toBe(1400);
    expect(fromHundredths(1400)).toBe(14);
  });

  it("round-trips every value the policy can produce, exactly", () => {
    /*
     * THE PROPERTY THAT MATTERS, rather than a hand-picked example.
     *
     * `weighWork` always returns a whole number of hundredths, so the only
     * thing crossing this boundary is float representation error — 0.1 + 0.2
     * arriving as 0.30000000000000004. Rounding absorbs it; truncating would
     * lose a hundredth per request, systematically in the customer's favour,
     * which is still a ledger that does not add up.
     *
     * Checked across the whole range a session can hold rather than at a few
     * points, because the error is not uniform and a spot check can miss it.
     */
    for (let hundredths = 0; hundredths <= 140_00; hundredths += 1) {
      const equivalents = hundredths / 100;
      expect(toHundredths(equivalents), `${equivalents}`).toBe(hundredths);
    }
    expect(toHundredths(0.1 + 0.2)).toBe(30);
  });

  it("is the exact inverse of reading a value back", () => {
    for (const hundredths of [0, 25, 30, 100, 1234, 14_000, 700_00]) {
      expect(toHundredths(fromHundredths(hundredths))).toBe(hundredths);
    }
  });
});

describe("reading the ledger", () => {
  it("returns zero for a window with no row yet", async () => {
    const { client } = fakeSupabase({ rows: [] });
    const used = await supabaseCommercialLedger(client).read("user-1", [SESSION, WEEK]);
    expect(used.get(`session:${SESSION.startsAt}`)).toBe(0);
    expect(used.get(`week:${WEEK.startsAt}`)).toBe(0);
  });

  it("matches a row to its own window, by kind AND start", async () => {
    const { client } = fakeSupabase({
      rows: [
        {
          window_kind: "session",
          window_start: new Date(SESSION.startsAt).toISOString(),
          used_hundredths: 1234,
        },
        {
          window_kind: "week",
          window_start: new Date(WEEK.startsAt).toISOString(),
          used_hundredths: 5000,
        },
      ],
    });
    const used = await supabaseCommercialLedger(client).read("user-1", [SESSION, WEEK]);
    expect(used.get(`session:${SESSION.startsAt}`)).toBe(12.34);
    expect(used.get(`week:${WEEK.startsAt}`)).toBe(50);
  });

  it("ignores a row whose kind does not match, even at the same instant", async () => {
    // The session and the week can share a start instant. Matching on the
    // timestamp alone would read one window's total into the other.
    const { client } = fakeSupabase({
      rows: [
        {
          window_kind: "week",
          window_start: new Date(SESSION.startsAt).toISOString(),
          used_hundredths: 9999,
        },
      ],
    });
    const used = await supabaseCommercialLedger(client).read("user-1", [SESSION]);
    expect(used.get(`session:${SESSION.startsAt}`)).toBe(0);
  });

  it("THROWS on a failed read rather than reporting an empty ledger", async () => {
    /*
     * Returning zeros would report a full allowance to an account that has
     * spent it. The reservation would still refuse — but the person would be
     * told they had room and then refused, which is worse than the truth now.
     */
    const { client } = fakeSupabase({ readError: { message: "connection reset" } });
    await expect(supabaseCommercialLedger(client).read("user-1", [SESSION])).rejects.toThrow(
      /could not be read/i,
    );
  });
});

describe("reserving and releasing", () => {
  it("sends hundredths, the window kind and the window start", async () => {
    const { client, rpcCalls } = fakeSupabase({});
    await supabaseCommercialLedger(client).reserve({
      userId: "user-1",
      window: SESSION,
      amount: 0.25,
      allowance: 140,
    });
    expect(rpcCalls[0]!.name).toBe("ocade_consume_commercial_work");
    expect(rpcCalls[0]!.args).toMatchObject({
      p_user_id: "user-1",
      p_window_kind: "session",
      p_window_start: new Date(SESSION.startsAt).toISOString(),
      p_cost_hundredths: 25,
      p_limit_hundredths: 14000,
    });
  });

  it("passes a null limit for a window with no allowance", async () => {
    // Free's week is recorded and not capped: the account's own usage screen is
    // built from these rows.
    const { client, rpcCalls } = fakeSupabase({});
    await supabaseCommercialLedger(client).reserve({
      userId: "user-1",
      window: WEEK,
      amount: 1,
      allowance: null,
    });
    expect(rpcCalls[0]!.args["p_limit_hundredths"]).toBeNull();
  });

  it("turns the database's check violation into an exhausted allowance", async () => {
    const { client } = fakeSupabase({
      rpcError: { code: "23514", message: "allowance_exhausted" },
    });
    await expect(
      supabaseCommercialLedger(client).reserve({
        userId: "user-1",
        window: SESSION,
        amount: 0.25,
        allowance: 140,
      }),
    ).rejects.toBeInstanceOf(AllowanceExhausted);
  });

  it("does not mistake an unrelated database failure for exhaustion", async () => {
    /*
     * Reporting a connection failure as "you have run out" would tell somebody
     * their allowance is spent when it is not, and send them to a billing page
     * to fix an outage.
     */
    const { client } = fakeSupabase({ rpcError: { code: "08006", message: "connection failure" } });
    const failure = supabaseCommercialLedger(client).reserve({
      userId: "user-1",
      window: SESSION,
      amount: 0.25,
      allowance: 140,
    });
    await expect(failure).rejects.toThrow(/refused a reservation/i);
    await expect(failure).rejects.not.toBeInstanceOf(AllowanceExhausted);
  });

  it("reports a failed release rather than swallowing it", async () => {
    // It leaves allowance held against somebody who did not use it. That
    // expires with the window, but they deserve better than silence.
    const { client } = fakeSupabase({ rpcError: { message: "timeout" } });
    await expect(
      supabaseCommercialLedger(client).release({
        userId: "user-1",
        window: SESSION,
        amount: 0.25,
      }),
    ).rejects.toThrow(/could not release/i);
  });
});

describe("durable generation permits", () => {
  it("acquires one backend-neutral permit with exact account-scoped identity", async () => {
    const { client, rpcCalls } = fakeSupabase({
      rpcData: {
        ocade_acquire_generation_permit: [
          {
            permit_id: "permit-1",
            outcome: "granted",
            reserved_hundredths: 25,
            session_reset_at: "2026-09-07T10:00:00.000Z",
            week_reset_at: "2026-09-14T10:00:00.000Z",
          },
        ],
      },
    });

    const result = await supabaseCommercialLedger(client).acquirePermit!({
      userId: "user-1",
      idempotencyKey: "logical-1",
      generationId: "generation-1",
      surface: "cowork",
      tier: "pro",
      sessionAllowance: 140,
      weekAllowance: 700,
      reserved: 0.25,
    });

    expect(result).toMatchObject({ permitId: "permit-1", outcome: "granted", reserved: 0.25 });
    expect(rpcCalls[0]).toEqual({
      name: "ocade_acquire_generation_permit",
      args: {
        p_user_id: "user-1",
        p_idempotency_key: "logical-1",
        p_generation_id: "generation-1",
        p_surface: "cowork",
        p_tier: "pro",
        p_session_limit_hundredths: 14_000,
        p_week_limit_hundredths: 70_000,
        p_reserved_hundredths: 25,
      },
    });
  });

  it("fails closed on an unknown database outcome", async () => {
    const { client } = fakeSupabase({
      rpcData: {
        ocade_acquire_generation_permit: [
          {
            permit_id: null,
            outcome: "mystery",
            reserved_hundredths: 0,
            session_reset_at: "2026-09-07T10:00:00.000Z",
            week_reset_at: "2026-09-14T10:00:00.000Z",
          },
        ],
      },
    });
    await expect(
      supabaseCommercialLedger(client).acquirePermit!({
        userId: "user-1",
        idempotencyKey: "logical-1",
        generationId: "generation-1",
        surface: "chat",
        tier: "free",
        sessionAllowance: 28,
        weekAllowance: null,
        reserved: 1,
      }),
    ).rejects.toThrow(/unknown permit outcome/i);
  });

  it("finalizes and releases through durable RPCs rather than process memory", async () => {
    const { client, rpcCalls } = fakeSupabase({
      rpcData: {
        ocade_finalize_generation_permit: [{ charged_hundredths: 275, outcome: "succeeded" }],
        ocade_release_generation_permit: true,
        ocade_expire_commercial_permits: 3,
      },
    });
    const ledger = supabaseCommercialLedger(client);
    await expect(
      ledger.finalizePermit!({ userId: "user-1", idempotencyKey: "logical-1", measuredCost: 2.75 }),
    ).resolves.toBe(2.75);
    await expect(
      ledger.releasePermit!({ userId: "user-1", idempotencyKey: "logical-2", reason: "failed" }),
    ).resolves.toBe(true);
    await expect(ledger.expirePermits!("user-1")).resolves.toBe(3);
    expect(rpcCalls.map((call) => call.name)).toEqual([
      "ocade_finalize_generation_permit",
      "ocade_release_generation_permit",
      "ocade_expire_commercial_permits",
    ]);
  });

  it("does not report a missing durable permit as successfully settled", async () => {
    const { client } = fakeSupabase({
      rpcData: {
        ocade_finalize_generation_permit: [{ charged_hundredths: 0, outcome: "missing" }],
      },
    });
    await expect(
      supabaseCommercialLedger(client).finalizePermit!({
        userId: "user-1",
        idempotencyKey: "lost-request",
        measuredCost: 1,
      }),
    ).rejects.toThrow(/could not finalize that permit/i);
  });

  it("reads the exact server-authored windows and active reservations", async () => {
    const { client } = fakeSupabase({
      rpcData: {
        ocade_read_commercial_usage: [
          {
            window_kind: "session",
            window_start: "2026-09-07T03:32:00.000Z",
            reset_at: "2026-09-07T10:00:00.000Z",
            used_hundredths: 125,
            reserved_hundredths: 25,
          },
          {
            window_kind: "week",
            window_start: "2026-09-07T00:00:00.000Z",
            reset_at: "2026-09-14T00:00:00.000Z",
            used_hundredths: 500,
            reserved_hundredths: 50,
          },
        ],
      },
    });
    await expect(supabaseCommercialLedger(client).readCurrent!("user-1")).resolves.toEqual([
      {
        kind: "session",
        startsAt: Date.parse("2026-09-07T03:32:00.000Z"),
        endsAt: Date.parse("2026-09-07T10:00:00.000Z"),
        used: 1.25,
        reserved: 0.25,
      },
      {
        kind: "week",
        startsAt: Date.parse("2026-09-07T00:00:00.000Z"),
        endsAt: Date.parse("2026-09-14T00:00:00.000Z"),
        used: 5,
        reserved: 0.5,
      },
    ]);
  });
});
