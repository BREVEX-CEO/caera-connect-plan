import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * PLAN Phase 08 V11 against real PostgreSQL with the real migrations: a spent recovery code
 * lets only the session that spent it finish only the recovery it started.
 */
let twin: DatabaseTwin;
const U = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const HASH = "a".repeat(64);
const sql = <T = Record<string, unknown>>(text: string) => twin.asServiceRole<T>(text);
const begin = async (session: string, factors: string[]) =>
  (
    await sql<{ out: { status: string; factors?: string[] } }>(
      `select public.ocade_begin_mfa_recovery('${U}', '${HASH}', '${session}', array[${factors
        .map((f) => `'${f}'`)
        .join(",")}]::text[]) as out`,
    )
  )[0]!.out;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values ('${U}', 'u@recovery.invalid') on conflict do nothing;`,
  );
  await sql(
    `select public.ocade_replace_mfa_recovery_codes('${U}', array['${HASH}', '${"b".repeat(64)}'])`,
  );
}, 120_000);

afterAll(async () => {
  await twin?.close();
});

describe("a spent recovery code finishes its own recovery (V11)", () => {
  it("spends once, resumes for the same session with the same factors, and never after it finished", async () => {
    expect(await begin(S1, ["f1"])).toEqual({ status: "consumed", factors: ["f1"] });
    // A retry from the same session: the factors it was spent on, not today's list.
    expect(await begin(S1, ["f1", "f-new"])).toEqual({ status: "resume", factors: ["f1"] });
    // Another session brings the same code: it is spent.
    expect((await begin(S2, ["f1"])).status).toBe("rejected");
    await sql(`select public.ocade_finish_mfa_recovery('${U}', '${HASH}')`);
    expect((await begin(S1, ["f1"])).status).toBe("rejected");
  });

  it("no signed-in token can call it", async () => {
    const out = await twin.asTenant(
      U,
      `select public.ocade_begin_mfa_recovery('${U}', '${HASH}', '${S1}', array['f1']::text[])`,
    );
    expect(out.errorCode).toBe("42501");
  });

  it("verifies, rolls back and applies again", async () => {
    const MIGRATION = "20261017110000_a_recovery_finishes_what_its_code_started";
    const verify = () => twin.runScript("supabase/verification", `${MIGRATION}_verify.sql`);
    expect((await verify()).error).toBeUndefined();
    expect(
      (await twin.runScript("supabase/rollback", `${MIGRATION}_rollback.sql`)).error,
    ).toBeUndefined();
    expect((await verify()).error).toBeTruthy();
    expect((await twin.runScript("supabase/migrations", `${MIGRATION}.sql`)).error).toBeUndefined();
    expect((await verify()).error).toBeUndefined();
  });
});
