import { beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";
import { CommercialGenerationGate, type CommercialUsageLedger } from "../generation-gate";
import { AllowanceExhausted } from "../generation-gate";
import { toHundredths } from "../supabase-ledger";
import { ALLOWANCES, ONE_USE, windowFor, type UsageWindow } from "../usage-policy";

/**
 * THE GATE, THE LEDGER AND REAL POSTGRES, TOGETHER.
 *
 * The unit tests prove the gate's rules against an in-memory ledger, and the
 * migration's verification proves the RPCs against a real database. Neither
 * proves the JOIN: that the sequence of calls the gate actually makes, with the
 * arguments it actually builds, produces the right rows in the real schema.
 *
 * That gap is where this kind of defect lives. An off-by-one in the conversion
 * to hundredths, a reservation sent to the wrong window kind, a release that
 * targets a row the reserve never created — every one of those passes both
 * halves and fails in production, on money.
 *
 * So this runs the REAL gate against the REAL migrations in PGlite, through a
 * ledger binding that issues the same SQL the Supabase RPCs do. What it does
 * not exercise is the Supabase client's HTTP transport, which is why
 * `supabase-ledger.test.ts` asserts the exact RPC names and arguments
 * separately.
 */

let twin: DatabaseTwin;
let userId: string;

/**
 * The production RPCs, called directly.
 *
 * Not a reimplementation: `ocade_consume_commercial_work` and
 * `ocade_release_commercial_work` are the functions the migration created, and
 * this calls them with the same arguments the Supabase binding sends.
 */
function postgresLedger(): CommercialUsageLedger {
  const key = (window: UsageWindow) => `${window.kind}:${window.startsAt}`;
  const iso = (window: UsageWindow) => new Date(window.startsAt).toISOString();

  return {
    async read(id, windows) {
      const out = new Map<string, number>();
      for (const window of windows) out.set(key(window), 0);
      const rows = await twin.asServiceRole<{
        window_kind: string;
        window_start: string;
        used_hundredths: string;
      }>(
        `select window_kind, window_start, used_hundredths
           from public.ocade_commercial_usage
          where user_id = '${id}'`,
      );
      for (const row of rows) {
        const startsAt = Date.parse(row.window_start);
        const match = windows.find(
          (window) => window.kind === row.window_kind && window.startsAt === startsAt,
        );
        if (match) out.set(key(match), Number(row.used_hundredths) / 100);
      }
      return out;
    },

    async reserve({ userId: id, window, amount, allowance }) {
      const limit = allowance === null ? "null" : String(toHundredths(allowance));
      try {
        await twin.asServiceRole(
          `select public.ocade_consume_commercial_work(
             '${id}'::uuid, '${window.kind}', '${iso(window)}'::timestamptz,
             ${toHundredths(amount)}::bigint, ${limit}::bigint)`,
        );
      } catch (error) {
        if (String(error).includes("allowance_exhausted")) throw new AllowanceExhausted(window);
        throw error;
      }
    },

    async release({ userId: id, window, amount }) {
      await twin.asServiceRole(
        `select public.ocade_release_commercial_work(
           '${id}'::uuid, '${window.kind}', '${iso(window)}'::timestamptz,
           ${toHundredths(amount)}::bigint)`,
      );
    },
  };
}

async function ledgerRow(kind: "session" | "week"): Promise<number> {
  const rows = await twin.asSuperuser<{ used_hundredths: string }>(
    `select used_hundredths from public.ocade_commercial_usage
      where user_id = '${userId}' and window_kind = '${kind}'`,
  );
  return rows.length === 0 ? 0 : Number(rows[0]!.used_hundredths);
}

async function clearLedger(): Promise<void> {
  await twin.asSuperuser(`delete from public.ocade_commercial_usage where user_id = '${userId}'`);
}

const ANCHOR = Date.parse("2026-01-01T00:00:00.000Z");
const NOW = ANCHOR + 60_000;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  const failed = applied.filter((migration) => !migration.ok);
  expect(failed.map((migration) => migration.file)).toEqual([]);

  const rows = await twin.asSuperuser<{ id: string }>(
    `insert into auth.users (id, email)
     values (gen_random_uuid(), 'commercial-gate-proof@invalid.test')
     returning id`,
  );
  userId = rows[0]!.id;
}, 120_000);

describe("the gate settles against the real ledger", () => {
  it("writes the one use, in hundredths, to both windows", async () => {
    await clearLedger();
    const gate = new CommercialGenerationGate(postgresLedger());
    const result = await gate.acquire({
      userId,
      tier: "pro",
      anchoredAt: ANCHOR,
      now: NOW,
      idempotencyKey: "proof-reserve",
    });
    expect(result.ok).toBe(true);

    // One use, as integer hundredths, in the real column.
    expect(await ledgerRow("session")).toBe(toHundredths(ONE_USE));
    expect(await ledgerRow("week")).toBe(toHundredths(ONE_USE));
  });

  it("leaves the one use exactly where it was when the answer is delivered", async () => {
    await clearLedger();
    const gate = new CommercialGenerationGate(postgresLedger());
    const result = await gate.acquire({
      userId,
      tier: "pro",
      anchoredAt: ANCHOR,
      now: NOW,
      idempotencyKey: "proof-finalize",
    });
    if (!result.ok) throw new Error("expected a permit");

    await result.permit.finalize();
    expect(await ledgerRow("session")).toBe(toHundredths(ONE_USE));
    expect(await ledgerRow("week")).toBe(toHundredths(ONE_USE));
  });

  it("returns the ledger to where it started when nothing was delivered", async () => {
    await clearLedger();
    const gate = new CommercialGenerationGate(postgresLedger());
    const result = await gate.acquire({
      userId,
      tier: "pro",
      anchoredAt: ANCHOR,
      now: NOW,
      idempotencyKey: "proof-release",
    });
    if (!result.ok) throw new Error("expected a permit");

    await result.permit.release("cancelled_before_output");
    expect(await ledgerRow("session")).toBe(0);
    expect(await ledgerRow("week")).toBe(0);
  });

  it("charges Free exactly one use, as a whole hundred", async () => {
    await clearLedger();
    const gate = new CommercialGenerationGate(postgresLedger());
    const result = await gate.acquire({
      userId,
      tier: "free",
      anchoredAt: ANCHOR,
      now: NOW,
      idempotencyKey: "proof-free",
    });
    if (!result.ok) throw new Error("expected a permit");
    await result.permit.finalize();
    expect(await ledgerRow("session")).toBe(toHundredths(ONE_USE));
  });

  it("is refused by the DATABASE when the allowance is gone", async () => {
    /*
     * The refusal that matters. The gate's own pre-check is advisory — two
     * requests can both read "one left" — so this drives the ledger to exactly
     * the allowance and then asks for one more, and the refusal comes from the
     * atomic function rather than from anything JavaScript decided.
     */
    await clearLedger();
    const gate = new CommercialGenerationGate(postgresLedger());
    const session = windowFor("session", ANCHOR, NOW);
    const week = windowFor("week", ANCHOR, NOW);
    for (const window of [session, week]) {
      await twin.asSuperuser(
        `insert into public.ocade_commercial_usage
           (user_id, window_kind, window_start, used_hundredths)
         values ('${userId}', '${window.kind}',
                 '${new Date(window.startsAt).toISOString()}'::timestamptz,
                 ${toHundredths(ALLOWANCES.pro.session)})`,
      );
    }

    const result = await gate.acquire({
      userId,
      tier: "pro",
      anchoredAt: ANCHOR,
      now: NOW,
      idempotencyKey: "proof-exhausted",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("allowance_exhausted");
      expect(result.exhausted).toBe("session");
    }
    // And the refusal added nothing.
    expect(await ledgerRow("session")).toBe(toHundredths(ALLOWANCES.pro.session));
  });

  it("charges a double-clicked send once, in the real ledger", async () => {
    await clearLedger();
    const gate = new CommercialGenerationGate(postgresLedger());
    const first = await gate.acquire({
      userId,
      tier: "pro",
      anchoredAt: ANCHOR,
      now: NOW,
      idempotencyKey: "proof-double",
    });
    const second = await gate.acquire({
      userId,
      tier: "pro",
      anchoredAt: ANCHOR,
      now: NOW,
      idempotencyKey: "proof-double",
    });
    expect(first.ok && second.ok).toBe(true);
    expect(await ledgerRow("session")).toBe(toHundredths(ONE_USE));
  });

  it("keeps the two windows apart, in separate rows carrying the same total", async () => {
    /*
     * Two rows existing is not the guarantee. A reservation that lands in the
     * wrong window and a top-up that lands in the right one still produces two
     * rows — with the session over-charged and the week under-charged — so the
     * TOTALS are what this asserts, alongside the row count and the shape of
     * the primary key.
     */
    await clearLedger();
    const gate = new CommercialGenerationGate(postgresLedger());
    const result = await gate.acquire({
      userId,
      tier: "pro",
      anchoredAt: ANCHOR,
      now: NOW,
      idempotencyKey: "proof-windows",
    });
    if (!result.ok) throw new Error("expected a permit");
    await result.permit.finalize();

    const rows = await twin.asSuperuser<{
      window_kind: string;
      window_start: string;
      used_hundredths: string;
    }>(
      `select window_kind, window_start, used_hundredths
         from public.ocade_commercial_usage
        where user_id = '${userId}' order by window_kind`,
    );
    expect(rows.map((row) => row.window_kind)).toEqual(["session", "week"]);
    // The same use, charged once to each window — not twice to one of them.
    expect(rows.map((row) => Number(row.used_hundredths))).toEqual([
      toHundredths(ONE_USE),
      toHundredths(ONE_USE),
    ]);
    // And each row is anchored to its OWN window, which is what stops the
    // week's total being read out of a row the session opened.
    expect(rows.map((row) => Date.parse(row.window_start))).toEqual([
      windowFor("session", ANCHOR, NOW).startsAt,
      windowFor("week", ANCHOR, NOW).startsAt,
    ]);
  });
});
