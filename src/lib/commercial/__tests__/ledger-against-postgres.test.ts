import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseCommercialLedger, toHundredths } from "../supabase-ledger";
import type { CommercialUsageLedger, GenerationSurface } from "../generation-gate";
import type { PlanTier } from "@/lib/payments/pricing";
import { ALLOWANCES, windowFor } from "../usage-policy";

/**
 * THE BINDING'S OWN ARGUMENTS, AGAINST THE REAL FUNCTIONS.
 *
 * `supabase-ledger.test.ts` asserts the RPC names and arguments the binding
 * sends, against a mock. The migration's verification calls those same
 * functions, correctly, from SQL. Both pass. Neither proves THE TWO AGREE.
 *
 * That seam is where a whole class of defect lives, and every one of them is a
 * defect about money:
 *
 *   * a `p_surface` the type system allows and the CHECK constraint refuses,
 *   * a `p_tier` capitalised on one side and lower-case on the other,
 *   * a renamed parameter, which PostgREST reports as "function does not
 *     exist" at the moment somebody presses send,
 *   * a null sent for a required parameter, or a number sent where the column
 *     wants hundredths.
 *
 * A mock cannot catch any of them, because a mock believes whatever the caller
 * says. So this drives THE PRODUCTION BINDING — `supabaseCommercialLedger`,
 * unmodified — through a client shim whose only job is to turn an `.rpc()` call
 * into the equivalent SQL against real PostgreSQL. The binding builds the
 * argument names and values; Postgres decides whether they are the ones it
 * declared.
 *
 * WHAT IT DOES NOT COVER: the Supabase client's HTTP transport, which
 * `supabase-ledger.test.ts` owns, and the gate's own rules, which
 * `gate-against-postgres.test.ts` owns against the same twin.
 */

let twin: DatabaseTwin;
let userId: string;

/** A SQL literal for a value the binding produced. Nulls stay untyped. */
function literal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * The smallest client that can carry a real call.
 *
 * `rpc` uses Postgres NAMED-ARGUMENT syntax deliberately: `p_tier => 'free'`
 * fails loudly when the parameter is renamed, which is exactly the failure
 * PostgREST would produce in production and exactly the one positional
 * arguments would hide.
 */
function twinClient(): SupabaseClient<Database> {
  const run = async (sql: string) => {
    try {
      return { data: await twin.asSuperuser(sql), error: null };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      // PGlite reports the SQLSTATE on the error; the binding reads `code` to
      // tell an exhausted allowance from a broken call, so it is passed through.
      const code = (cause as { code?: string } | null)?.code;
      return { data: null, error: { message, code } };
    }
  };

  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      const named = Object.entries(args)
        .map(([key, value]) => `${key} => ${literal(value)}`)
        .join(", ");
      const result = await run(`select * from public.${name}(${named})`);
      /*
       * SCALARS COME BACK AS SCALARS, THE WAY POSTGREST RETURNS THEM.
       *
       * `select * from f()` on a function returning `boolean` produces one row
       * with one column named after the function; PostgREST hands the caller
       * the boolean itself. Returning the row would have made
       * `releasePermit`'s `data === true` false for a release that worked —
       * and the test would have reported a defect in the binding that is
       * really a defect in this shim. A function returning TABLE(...) has its
       * own column names and is left as rows.
       */
      const rows = result.data as Record<string, unknown>[] | null;
      if (rows && rows.length === 1) {
        const keys = Object.keys(rows[0]!);
        if (keys.length === 1 && keys[0] === name) {
          return { data: rows[0]![name] ?? null, error: result.error };
        }
      }
      return result;
    },
    from: (table: string) => {
      const filters: string[] = [];
      let columns = "*";
      let limit = "";
      const builder = {
        select(list: string) {
          columns = list;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push(`${column} = ${literal(value)}`);
          return builder;
        },
        in(column: string, values: unknown[]) {
          filters.push(`${column} in (${values.map(literal).join(", ")})`);
          return builder;
        },
        limit(count: number) {
          limit = ` limit ${count}`;
          return builder;
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          const where = filters.length ? ` where ${filters.join(" and ")}` : "";
          return run(`select ${columns} from public.${table}${where}${limit}`).then(
            resolve,
            reject,
          );
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

/**
 * The production binding, with its durable half proved present.
 *
 * `CommercialUsageLedger` declares `acquirePermit`, `finalizePermit`,
 * `releasePermit`, `expirePermits` and `readCurrent` as OPTIONAL, and
 * `CommercialGenerationGate` falls back to an in-memory reservation when they
 * are absent. That fallback exists so the gate's rules can be tested
 * exhaustively without a database, and it is the right trade — but it means a
 * refactor that dropped one of these methods from the production binding would
 * not fail to compile. It would silently move money-keeping out of Postgres and
 * into a server process, where a restart loses it and two instances disagree.
 *
 * So the presence of every one is asserted here, once, and the rest of the file
 * reads them off the narrowed type.
 */
function productionLedger(): Required<CommercialUsageLedger> {
  const ledger = supabaseCommercialLedger(twinClient());
  for (const method of [
    "acquirePermit",
    "finalizePermit",
    "releasePermit",
    "expirePermits",
    "readCurrent",
  ] as const) {
    expect(
      typeof ledger[method],
      `the production ledger has no ${method}, so the gate would keep money in a server process`,
    ).toBe("function");
  }
  return ledger as Required<CommercialUsageLedger>;
}

const ANCHOR = Date.parse("2026-03-01T00:00:00.000Z");

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(
    applied.filter((migration) => !migration.ok).map((migration) => migration.file),
    "a migration failed",
  ).toEqual([]);

  const rows = await twin.asSuperuser<{ id: string }>(
    `insert into auth.users (id, email, created_at)
     values (gen_random_uuid(), 'ledger-binding-proof@invalid.test', '${new Date(ANCHOR).toISOString()}')
     returning id`,
  );
  userId = rows[0]!.id;
}, 120_000);

afterAll(async () => {
  await twin?.close();
});

/** Everything this account holds, so each test starts from a known ledger. */
async function reset(): Promise<void> {
  await twin.execSuperuser(
    `delete from public.ocade_generation_permits where user_id = '${userId}'`,
  );
  await twin.execSuperuser(`delete from public.ocade_commercial_usage where user_id = '${userId}'`);
}

describe("every surface and tier the types allow is one the database accepts", () => {
  /*
   * THE VOCABULARIES ARE ASSERTED AGAINST EACH OTHER, EXHAUSTIVELY.
   *
   * `GenerationSurface` and `PlanTier` are TypeScript unions; the columns carry
   * CHECK constraints listing the same words. Nothing keeps them in step, and
   * the failure mode is silent until somebody on the newest surface presses
   * send. Listing them here means adding a surface to one side without the
   * other fails in this file rather than in production.
   */
  const surfaces: GenerationSurface[] = [
    "chat",
    "cowork",
    "code",
    "task",
    "automation",
    "background_agent",
    "voice",
    "artifact",
  ];
  const tiers: PlanTier[] = ["free", "pro", "max"];

  it.each(surfaces)("accepts the %s surface", async (surface) => {
    await reset();
    const ledger = productionLedger();
    const outcome = await ledger.acquirePermit({
      userId,
      idempotencyKey: `surface-${surface}`,
      generationId: `generation-${surface}`,
      surface,
      tier: "pro",
      sessionAllowance: ALLOWANCES.pro.session,
      weekAllowance: ALLOWANCES.pro.week,
      reserved: 0.25,
    });
    expect(outcome.outcome, `the database refused the ${surface} surface`).toBe("granted");
    expect(outcome.permitId).toBeTruthy();
  });

  it.each(tiers)("accepts the %s tier", async (tier) => {
    await reset();
    const ledger = productionLedger();
    const outcome = await ledger.acquirePermit({
      userId,
      idempotencyKey: `tier-${tier}`,
      generationId: `generation-${tier}`,
      surface: "chat",
      tier,
      sessionAllowance: ALLOWANCES[tier].session,
      weekAllowance: ALLOWANCES[tier].week,
      reserved: 0.25,
    });
    expect(outcome.outcome, `the database refused the ${tier} tier`).toBe("granted");
  });
});

describe("the binding's own calls settle in the real ledger", () => {
  it("reserves, reports and finalises one request", async () => {
    await reset();
    const ledger = productionLedger();

    const granted = await ledger.acquirePermit({
      userId,
      idempotencyKey: "settle-1",
      generationId: "generation-settle-1",
      surface: "chat",
      tier: "pro",
      sessionAllowance: ALLOWANCES.pro.session,
      weekAllowance: ALLOWANCES.pro.week,
      reserved: 0.25,
    });
    expect(granted.outcome).toBe("granted");
    expect(granted.reserved).toBe(0.25);
    /*
     * Parsed, not merely present. A timestamp the binding cannot read comes
     * back as NaN and every reset countdown built on it renders "Invalid Date"
     * — which is the shape this decodes and therefore the shape worth pinning.
     */
    expect(Number.isFinite(granted.sessionResetAt)).toBe(true);
    expect(Number.isFinite(granted.weekResetAt)).toBe(true);
    expect(granted.weekResetAt).toBeGreaterThan(granted.sessionResetAt);

    const before = await ledger.readCurrent(userId);
    expect(before.map((window) => window.kind).sort()).toEqual(["session", "week"]);
    const session = before.find((window) => window.kind === "session")!;
    // Reserved work is held apart from spent work: an in-flight request is not
    // yet a charge, and reporting it as one would make a cancelled request cost.
    expect(session.reserved).toBe(0.25);
    expect(session.used).toBe(0);

    const charged = await ledger.finalizePermit({
      userId,
      idempotencyKey: "settle-1",
      measuredCost: 2.75,
    });
    expect(charged).toBe(2.75);

    const after = await ledger.readCurrent(userId);
    const settled = after.find((window) => window.kind === "session")!;
    expect(settled.used).toBe(2.75);
    expect(settled.reserved).toBe(0);
  });

  it("charges Free exactly one use however much the request measured", async () => {
    await reset();
    const ledger = productionLedger();
    await ledger.acquirePermit({
      userId,
      idempotencyKey: "free-1",
      generationId: "generation-free-1",
      surface: "chat",
      tier: "free",
      sessionAllowance: ALLOWANCES.free.session,
      weekAllowance: ALLOWANCES.free.week,
      reserved: 1,
    });
    const charged = await ledger.finalizePermit({
      userId,
      idempotencyKey: "free-1",
      measuredCost: 9.5,
    });
    expect(charged, "Free was charged by weight rather than by use").toBe(1);
  });

  it("gives the same permit back for a repeated key rather than reserving twice", async () => {
    await reset();
    const ledger = productionLedger();
    const request = {
      userId,
      idempotencyKey: "double-click",
      generationId: "generation-double-click",
      surface: "chat" as const,
      tier: "pro" as const,
      sessionAllowance: ALLOWANCES.pro.session,
      weekAllowance: ALLOWANCES.pro.week,
      reserved: 0.25,
    };
    const first = await ledger.acquirePermit(request);
    const second = await ledger.acquirePermit(request);
    expect(second.outcome).toBe("granted");
    expect(second.permitId).toBe(first.permitId);

    const windows = await ledger.readCurrent(userId);
    expect(
      windows.find((window) => window.kind === "session")!.reserved,
      "a double-clicked send reserved twice",
    ).toBe(0.25);
  });

  it("releases a reservation once, and says so the second time", async () => {
    await reset();
    const ledger = productionLedger();
    await ledger.acquirePermit({
      userId,
      idempotencyKey: "release-1",
      generationId: "generation-release-1",
      surface: "chat",
      tier: "pro",
      sessionAllowance: ALLOWANCES.pro.session,
      weekAllowance: ALLOWANCES.pro.week,
      reserved: 0.5,
    });
    expect(
      await ledger.releasePermit({
        userId,
        idempotencyKey: "release-1",
        reason: "cancelled_before_output",
      }),
    ).toBe(true);
    expect(
      await ledger.releasePermit({
        userId,
        idempotencyKey: "release-1",
        reason: "cancelled_before_output",
      }),
      "a release the ledger had already applied reported as a second release",
    ).toBe(false);

    const windows = await ledger.readCurrent(userId);
    const session = windows.find((window) => window.kind === "session")!;
    expect(session.used).toBe(0);
    expect(session.reserved).toBe(0);
  });

  it("reports a conflicting reuse of one key rather than granting a second run", async () => {
    await reset();
    const ledger = productionLedger();
    await ledger.acquirePermit({
      userId,
      idempotencyKey: "conflict",
      generationId: "generation-a",
      surface: "chat",
      tier: "pro",
      sessionAllowance: ALLOWANCES.pro.session,
      weekAllowance: ALLOWANCES.pro.week,
      reserved: 0.25,
    });
    const second = await ledger.acquirePermit({
      userId,
      idempotencyKey: "conflict",
      generationId: "generation-b",
      surface: "cowork",
      tier: "pro",
      sessionAllowance: ALLOWANCES.pro.session,
      weekAllowance: ALLOWANCES.pro.week,
      reserved: 0.25,
    });
    expect(second.outcome).toBe("idempotency_conflict");
  });

  it("refuses the request that would exceed the session allowance", async () => {
    await reset();
    const ledger = productionLedger();
    /*
     * Spent directly rather than through twenty-eight acquisitions: what is
     * being proved is that the BINDING reports the database's refusal, not that
     * the database counts — which the migration's own verification already
     * saturates.
     */
    const window = windowFor("session", ANCHOR, Date.now());
    await ledger.reserve({
      userId,
      window,
      amount: ALLOWANCES.free.session,
      allowance: ALLOWANCES.free.session,
    });

    const refused = await ledger.acquirePermit({
      userId,
      idempotencyKey: "over-the-line",
      generationId: "generation-over",
      surface: "chat",
      tier: "free",
      sessionAllowance: ALLOWANCES.free.session,
      weekAllowance: ALLOWANCES.free.week,
      reserved: 1,
    });
    expect(refused.outcome).toBe("session_exhausted");
    expect(refused.permitId).toBeNull();
  });

  it("reads the window rows back through the binding's own PostgREST shape", async () => {
    await reset();
    const ledger = productionLedger();
    const window = windowFor("session", ANCHOR, Date.now());
    await ledger.reserve({ userId, window, amount: 1.5, allowance: ALLOWANCES.pro.session });

    const read = await ledger.read(userId, [window]);
    expect(
      read.get(`session:${window.startsAt}`),
      "the binding's filtered read did not find the row it just wrote",
    ).toBe(1.5);
  });

  it("counts the permits it expired", async () => {
    await reset();
    const ledger = productionLedger();
    await ledger.acquirePermit({
      userId,
      idempotencyKey: "expiring",
      generationId: "generation-expiring",
      surface: "chat",
      tier: "pro",
      sessionAllowance: ALLOWANCES.pro.session,
      weekAllowance: ALLOWANCES.pro.week,
      reserved: 0.25,
    });
    /*
     * `issued_at` moves with it. The table's own check requires
     * `expires_at > issued_at`, so backdating only the expiry would be refused
     * by the constraint — which is the constraint doing its job, and a fixture
     * that fought it would be proving nothing about expiry.
     */
    await twin.execSuperuser(
      `update public.ocade_generation_permits
          set issued_at = now() - interval '1 hour',
              expires_at = now() - interval '1 minute'
        where user_id = '${userId}'`,
    );
    expect(await ledger.expirePermits(userId)).toBe(1);

    const windows = await ledger.readCurrent(userId);
    const session = windows.find((window) => window.kind === "session")!;
    expect(session.reserved, "an expired reservation was still being held").toBe(0);
    expect(session.used, "an expired reservation was charged").toBe(0);
  });
});

describe("hundredths cross the boundary as integers", () => {
  it("stores what the binding converted, not a float", async () => {
    await reset();
    const ledger = productionLedger();
    const window = windowFor("session", ANCHOR, Date.now());
    // 0.1 + 0.2 in floating point is 0.30000000000000004. The policy rounds to
    // a hundredth and the binding converts once; the column must hold 30.
    await ledger.reserve({ userId, window, amount: 0.1 + 0.2, allowance: null });
    const rows = await twin.asSuperuser<{ used_hundredths: string }>(
      `select used_hundredths from public.ocade_commercial_usage
        where user_id = '${userId}' and window_kind = 'session'`,
    );
    expect(Number(rows[0]!.used_hundredths)).toBe(toHundredths(0.3));
  });
});
