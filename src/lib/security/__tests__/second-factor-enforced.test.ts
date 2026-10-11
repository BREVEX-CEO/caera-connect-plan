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

describe("a session that was ended stops at once", () => {
  const gate = (sessionId?: string) =>
    twin.asTenant(PLAIN, `select public.ocade_enforce_second_factor()`, { sessionId });

  it("passes its verification script", async () => {
    const result = await twin.runScript(
      "supabase/verification",
      "20260930092500_an_ended_session_stops_at_once_verify.sql",
    );
    expect(result.error).toBeUndefined();
  });

  it("serves a live session and refuses the same token the moment the session is gone", async () => {
    const [{ id }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${PLAIN}') returning id`,
    );
    expect((await gate(id)).error).toBeUndefined();
    await twin.execSuperuser(`delete from auth.sessions where id = '${id}'`);
    const after = await gate(id);
    // PT401: PostgREST answers 401, which a browser treats as signed out.
    expect(after.errorCode).toBe("PT401");
    expect(after.error).toMatch(/signed out/);
  });

  it("does not accept another account's live session as its own", async () => {
    const [{ id }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${ENROLLED}') returning id`,
    );
    expect((await gate(id)).errorCode).toBe("PT401");
  });

  it("leaves anonymous visitors and tokens that name no session alone", async () => {
    expect((await gate()).error).toBeUndefined();
    expect(
      (await twin.asAnon(`select public.ocade_enforce_second_factor()`)).error,
    ).toBeUndefined();
    expect((await twin.asAnon(`select private.ocade_caller_session_live()`)).errorCode).toBe(
      "42501",
    );
  });
});

describe("one fresh proof covers one sensitive action (P05-B)", () => {
  const digest = "a".repeat(64);
  const spend = (sessionId: string | undefined, provedSecondsAgo = 0, action = "deleteMyAccount") =>
    twin.asTenant<{ ok: boolean }>(
      PLAIN,
      `select public.ocade_spend_proof('${action}', '${digest}') as ok`,
      { sessionId, provedSecondsAgo },
    );

  it("verifies", async () => {
    const result = await twin.runScript(
      "supabase/verification",
      "20261011100000_one_proof_one_action_verify.sql",
    );
    expect(result.error).toBeUndefined();
  });

  it("is spent by the first action and refused for a second, until a new proof", async () => {
    const [{ id }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${PLAIN}') returning id`,
    );
    expect((await spend(id, 5)).rows[0]!.ok).toBe(true);
    expect((await spend(id, 5, "revokeOtherSessions")).rows[0]!.ok).toBe(false);
    expect((await spend(id, 0)).rows[0]!.ok).toBe(true); // proved again: a new proof
  });

  it("refuses a token with no session to spend against", async () => {
    expect((await spend(undefined)).rows[0]!.ok).toBe(false);
  });
});
