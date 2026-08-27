import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";

/*
 * SECURITY DEFINER IS A HOLE IN ROW-LEVEL SECURITY, ON PURPOSE.
 *
 * A `SECURITY DEFINER` function runs as its owner, so it bypasses every policy
 * on every table it touches. That is exactly why some of them exist — a policy
 * on `user_roles` cannot read `user_roles` to decide whether the caller is an
 * administrator without recursing — and exactly why each one has to check the
 * caller itself. The policies are no longer doing it.
 *
 * `user-isolation.test.ts` cannot see this class of bug at all: it attacks
 * tables, and these functions are the one path that does not go through a
 * table's policies.
 *
 * Supabase's own advisor flags all fifteen of these as WARN and stops there,
 * because from outside it cannot tell an intentional elevated helper from an
 * open door. This tells them apart by reading the body.
 */

let twin: DatabaseTwin;

interface Definer {
  name: string;
  args: string;
  authed: boolean;
  body: string;
}

let definers: Definer[] = [];

const ALICE = "a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1";
const BOB = "b0b0b0b0-2222-4222-8222-b0b0b0b0b0b0";

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((a) => !a.ok)).toHaveLength(0);

  definers = await twin.asSuperuser<Definer>(`
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed,
           pg_get_functiondef(p.oid) as body
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
     order by p.proname`);

  await twin.execSuperuser(`
    insert into auth.users (id, email) values
      ('${ALICE}', 'alice@definer.test'), ('${BOB}', 'bob@definer.test')
    on conflict (id) do nothing;
    insert into public.user_roles (user_id, role) values ('${BOB}', 'admin')
    on conflict do nothing;
  `);
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("elevated functions", () => {
  it("were found, so a broken catalogue query cannot pass", () => {
    expect(definers.length).toBeGreaterThan(20);
    expect(definers.some((d) => d.authed)).toBe(true);
  });

  it("consult the caller whenever a signed-in user can call them", () => {
    /*
     * `auth.uid()` directly, or one of the role helpers that consults it.
     * A function a signed-in user can invoke, which bypasses RLS, and which
     * never asks who is calling, is operating on whatever id it was handed.
     */
    const blind = definers
      .filter((d) => d.authed)
      .filter((d) => !/auth\.uid\(\)/.test(d.body))
      .filter((d) => !/\b(has_role|has_tenant_role|is_tenant_member)\s*\(/.test(d.body))
      .map((d) => `${d.name}(${d.args})`);
    expect(blind, "these bypass RLS and never ask who is calling").toEqual([]);
  });

  it("are never callable by an anonymous visitor", async () => {
    const anon = await twin.asSuperuser<{ name: string }>(`
      select p.proname as name
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
         and has_function_privilege('anon', p.oid, 'EXECUTE')`);
    expect(anon.map((r) => r.name)).toEqual([]);
  });
});

describe("has_role, which every policy depends on", () => {
  it("still answers about the caller, or the policies stop working", async () => {
    const bob = await twin.asTenant<{ r: boolean }>(
      BOB,
      `select public.has_role('${BOB}'::uuid, 'admin'::public.app_role) as r`,
    );
    expect(bob.error).toBeUndefined();
    expect(bob.rows[0]?.r).toBe(true);
  });

  it("refuses to answer about anybody else", async () => {
    /*
     * The finding. RLS on `user_roles` correctly refuses Alice a direct read of
     * Bob's roles — and `/rest/v1/rpc/has_role` handed her the same answer
     * anyway, because SECURITY DEFINER goes around the policy. Any signed-in
     * account could enumerate the deployment's administrators, which is a list
     * whose entire value is telling an attacker which accounts to attack.
     */
    const alice = await twin.asTenant<{ r: boolean }>(
      ALICE,
      `select public.has_role('${BOB}'::uuid, 'admin'::public.app_role) as r`,
    );
    expect(alice.rows[0]?.r).toBe(false);
  });

  it("agrees with what row-level security would have said", async () => {
    const direct = await twin.asTenant(
      ALICE,
      `select role from public.user_roles where user_id = '${BOB}'`,
    );
    expect(direct.rows).toHaveLength(0);
  });

  it("still works with no JWT at all, which is how the server calls it", async () => {
    // service_role and server-side code have no `auth.uid()`; the guard must
    // not apply there or every server-side role check silently returns false.
    const asServer = await twin.asSuperuser<{ r: boolean }>(
      `select public.has_role('${BOB}'::uuid, 'admin'::public.app_role) as r`,
    );
    expect(asServer[0]?.r).toBe(true);
  });

  it("is still executable by authenticated, which the policies require", async () => {
    const [row] = await twin.asSuperuser<{ ok: boolean }>(
      `select has_function_privilege('authenticated',
         'public.has_role(uuid,public.app_role)'::regprocedure, 'EXECUTE') as ok`,
    );
    expect(row?.ok).toBe(true);
  });
});

/*
 * READING `auth.uid()` IN THE BODY IS NOT THE SAME AS OBEYING IT.
 *
 * The assertion above proves each elevated function MENTIONS the caller. It
 * cannot prove where: `auth.uid()` in an INSERT column list satisfies a grep
 * and guards nothing. Every one of these functions takes a run id as its first
 * argument, and a run id is a uuid somebody else's browser has — which is the
 * exact shape of a broken-object-level-authorisation bug. Supabase's advisor
 * flags all fifteen and can say nothing about this, because from outside a
 * guarded function and an open door look identical.
 *
 * So: plant a run owned by Bob, hand its id to Alice, and check that every
 * verb she can reach either refuses or does nothing. The run is re-read after
 * each call — "returned an error" and "changed no row" are different claims,
 * and only the second one is the security property.
 */
describe("a run id belonging to somebody else", () => {
  const BOB_AUTOMATION = "cccccccc-3333-4333-8333-cccccccccccc";
  const BOB_RUN = "dddddddd-4444-4444-8444-dddddddddddd";

  beforeAll(async () => {
    await twin.execSuperuser(`
      insert into public.ocade_automations (id, user_id, name)
      values ('${BOB_AUTOMATION}', '${BOB}', 'bob nightly')
      on conflict (id) do nothing;
      insert into public.ocade_automation_runs
        (id, user_id, automation_id, status, claim_token, worker_id)
      values ('${BOB_RUN}', '${BOB}', '${BOB_AUTOMATION}', 'running',
              '11111111-5555-4555-8555-111111111111', 'bob-worker')
      on conflict (id) do nothing;
    `);
  });

  /** The fields any of these verbs could plausibly move. */
  async function snapshot(): Promise<string> {
    const rows = await twin.asSuperuser<Record<string, unknown>>(`
      select status, worker_id, claim_token, cancel_requested_at, pause_requested_at,
             cancelled_at, finished_at, error, approval_decision, approved_at,
             attempt, next_step_index, execution_steps
        from public.ocade_automation_runs where id = '${BOB_RUN}'`);
    expect(rows).toHaveLength(1);
    return JSON.stringify(rows[0]);
  }

  const ATTEMPTS: { name: string; call: string }[] = [
    { name: "cancel", call: `select public.ocade_request_automation_cancel('${BOB_RUN}')` },
    { name: "pause", call: `select public.ocade_request_automation_pause('${BOB_RUN}')` },
    { name: "resume", call: `select public.ocade_resume_automation_run('${BOB_RUN}')` },
    {
      name: "approve",
      call: `select public.ocade_decide_automation_run('${BOB_RUN}', 'approved', null)`,
    },
    {
      name: "claim",
      call: `select public.ocade_claim_automation_run('${BOB_RUN}', 'alice-worker')`,
    },
  ];

  it.each(ATTEMPTS)("cannot be $name-ed by another signed-in user", async ({ call }) => {
    const before = await snapshot();
    await twin.asTenant(ALICE, call);
    expect(await snapshot()).toBe(before);
  });

  it("cannot be completed by guessing the claim token argument", async () => {
    // The claim token is the worker's proof it holds the lease. Passing a
    // wrong one must fail even for the owner, and passing the RIGHT one must
    // still fail for a stranger — ownership is checked before the token.
    const before = await snapshot();
    await twin.asTenant(
      ALICE,
      `select public.ocade_complete_automation_run('${BOB_RUN}',
         '11111111-5555-4555-8555-111111111111', 'succeeded', null, now())`,
    );
    expect(await snapshot()).toBe(before);
  });

  it("cannot have a receipt appended to its history by a stranger", async () => {
    const before = await twin.asSuperuser<{ n: string }>(
      `select count(*)::text as n from public.ocade_automation_step_receipts where run_id = '${BOB_RUN}'`,
    );
    await twin.asTenant(
      ALICE,
      `select public.ocade_append_automation_receipt('${BOB_RUN}',
         '11111111-5555-4555-8555-111111111111', 0, 'execute', 'op', 'kind',
         'succeeded', true, true, 'forged', now(), now())`,
    );
    const after = await twin.asSuperuser<{ n: string }>(
      `select count(*)::text as n from public.ocade_automation_step_receipts where run_id = '${BOB_RUN}'`,
    );
    expect(after[0]?.n).toBe(before[0]?.n);
  });

  it("is still fully controllable by the person who owns it", async () => {
    // The negative tests above would also pass if these functions did nothing
    // at all for anybody. This is the control that says they work.
    await twin.asTenant(BOB, `select public.ocade_request_automation_pause('${BOB_RUN}')`);
    const rows = await twin.asSuperuser<{ pause_requested_at: string | null }>(
      `select pause_requested_at from public.ocade_automation_runs where id = '${BOB_RUN}'`,
    );
    expect(rows[0]?.pause_requested_at).not.toBeNull();
  });

  it("is invisible to a stranger reading the table directly", async () => {
    const { rows } = await twin.asTenant(
      ALICE,
      `select id from public.ocade_automation_runs where id = '${BOB_RUN}'`,
    );
    expect(rows).toHaveLength(0);
  });
});

/*
 * A BARE auth.uid() IN A POLICY IS A PER-ROW FUNCTION CALL.
 *
 * Postgres cannot hoist `auth.uid()` out of a policy expression, so it is
 * evaluated once for every row examined — the cost scales with the size of the
 * table rather than the size of the answer. Wrapped in a scalar subquery,
 * `(select auth.uid())`, it becomes an InitPlan evaluated once per statement.
 *
 * The two forms are indistinguishable in behaviour and nearly indistinguishable
 * on the page, which is exactly why one crept back in: 160 policies used the
 * fast form and two on `legal_consent_receipts` — the table written on every
 * signup — used the slow one. Supabase's advisor found them on production; this
 * finds them before they get there.
 */
describe("row-level security is written the fast way", () => {
  it("never re-evaluates auth.uid() per row", async () => {
    const slow = await twin.asSuperuser<{ tablename: string; policyname: string }>(`
      select tablename, policyname
        from pg_policies
       where schemaname = 'public'
         and (coalesce(qual, '') ~ 'auth\\.uid\\(\\)'
              or coalesce(with_check, '') ~ 'auth\\.uid\\(\\)')
         and not (coalesce(qual, '') ~ 'SELECT auth\\.uid\\(\\)'
                  or coalesce(with_check, '') ~ 'SELECT auth\\.uid\\(\\)')
       order by tablename, policyname`);
    const named = slow.map((row) => `${row.tablename}.${row.policyname}`);
    expect(named, "wrap these in (select auth.uid())").toEqual([]);
  });

  it("does not evaluate two permissive policies where one would do", async () => {
    // Two policies for the same role and command are both evaluated on every
    // statement. Duplicates cost that on every write and buy nothing.
    const duplicated = await twin.asSuperuser<{ tablename: string; cmd: string; n: string }>(`
      select tablename, cmd, count(*)::text as n
        from pg_policies
       where schemaname = 'public' and permissive = 'PERMISSIVE'
         and roles::text like '%authenticated%'
       group by tablename, cmd
      having count(*) > 1
       order by count(*) desc, tablename`);
    // Several tables legitimately split one command across policies with
    // different subjects; what must not happen is a table carrying more than
    // one policy that says the SAME thing. The consent table had two identical
    // INSERT policies, which is the case this pins.
    const consent = duplicated.filter((row) => row.tablename === "legal_consent_receipts");
    expect(consent).toEqual([]);
  });

  it("keeps one index where two were identical", async () => {
    const covering = await twin.asSuperuser<{ indexname: string }>(`
      select indexname from pg_indexes
       where schemaname = 'public' and tablename = 'legal_consent_receipts'
         and indexdef like '%(user_id, accepted_at DESC)%'`);
    expect(covering).toHaveLength(1);
  });
});
