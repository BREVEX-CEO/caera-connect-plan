/**
 * An account with a verified second factor is reachable only by a session that
 * completed it — proved against real PostgreSQL with every migration applied.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

const ENROLLED = "00000000-0000-4000-8000-00000000e001";
const PLAIN = "00000000-0000-4000-8000-00000000e002";
let twin: DatabaseTwin;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(`
    insert into auth.users (id, email) values
      ('${ENROLLED}', 'enrolled@ocade.invalid'), ('${PLAIN}', 'plain@ocade.invalid')
      on conflict do nothing;
    insert into auth.mfa_factors (user_id, status) values ('${ENROLLED}', 'verified');
    insert into auth.mfa_factors (user_id, status) values ('${PLAIN}', 'unverified');
  `);
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("the second factor, enforced by the database", () => {
  it("refuses an enrolled account's password-only session before any request runs", async () => {
    const out = await twin.asTenant(ENROLLED, `select public.ocade_enforce_second_factor()`);
    expect(out.errorCode).toBe("42501");
    const asked = await twin.asTenant<{ ok: boolean }>(
      ENROLLED,
      `select public.ocade_session_meets_second_factor() as ok`,
    );
    expect(asked.rows[0]?.ok).toBe(false);
  });

  it("lets the same account through once the factor was answered", async () => {
    const out = await twin.asTenant(ENROLLED, `select public.ocade_enforce_second_factor()`, {
      aal: "aal2",
    });
    expect(out.error).toBeUndefined();
  });

  it("never locks out an account without a verified factor (an abandoned setup is not one)", async () => {
    const out = await twin.asTenant(PLAIN, `select public.ocade_enforce_second_factor()`);
    expect(out.error).toBeUndefined();
  });

  it("leaves the service role and anonymous visitors to their own rules", async () => {
    const [row] = await twin.asServiceRole<{ ok: boolean }>(
      `select public.ocade_session_meets_second_factor() as ok`,
    );
    expect(row?.ok).toBe(true);
    const anon = await twin.asAnon(`select public.ocade_enforce_second_factor()`);
    expect(anon.error).toBeUndefined();
  });
});
