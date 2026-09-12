import {
  callerScopedFunctions,
  TOKEN_AUTHORIZED_FUNCTIONS,
} from "@/lib/security/caller-scoped-functions";
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
let helpers: (readonly [string, string])[] = [];

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

  /*
   * The `private` helpers come too, though none of them is browser-reachable.
   * Authorization in this schema is resolved through them — a function that
   * calls `private.ocade_is_support_admin()` IS bound to its caller — and a
   * scope computed without their bodies would call such a function blind.
   */
  helpers = (
    await twin.asSuperuser<{ name: string; body: string }>(`
      select p.proname as name, pg_get_functiondef(p.oid) as body
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.prokind = 'f'`)
  ).map((row) => [row.name, row.body] as const);

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
     * `auth.uid()` directly, or through a function that does. A function a
     * signed-in user can invoke, which bypasses RLS, and which never asks who
     * is calling, is operating on whatever id it was handed.
     *
     * THIS FOLLOWS INDIRECTION rather than reading one function's text, and it
     * shares that definition with the schema gate in `db-twin.test.ts` — see
     * `src/lib/security/caller-scoped-functions.ts` for why, and for the
     * subsystem whose shared authorization helpers the text search could not
     * see.
     */
    const scoped = callerScopedFunctions(
      new Map([...helpers, ...definers.map((d) => [d.name, d.body] as const)]),
    );
    const blind = definers
      .filter((d) => d.authed)
      .filter((d) => !scoped.has(d.name) && !TOKEN_AUTHORIZED_FUNCTIONS.has(d.name))
      .map((d) => `${d.name}(${d.args})`);
    expect(blind, "these bypass RLS and never ask who is calling").toEqual([]);
  });

  it("are never callable by an anonymous visitor unless a token is the authorization", async () => {
    const anon = await twin.asSuperuser<{ name: string }>(`
      select p.proname as name
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
         and has_function_privilege('anon', p.oid, 'EXECUTE')`);
    expect(anon.map((r) => r.name).filter((n) => !TOKEN_AUTHORIZED_FUNCTIONS.has(n))).toEqual([]);
  });

  it("keeps the token-authorized list honest", () => {
    /*
     * A name for a function that no longer exists is a claim about nothing, and
     * it would quietly cover a FUTURE function that happened to take the same
     * name.
     */
    const present = new Set(definers.map((d) => d.name));
    const stale = [...TOKEN_AUTHORIZED_FUNCTIONS.keys()].filter((n) => !present.has(n));
    expect(stale, "named as token-authorized but not a definer function").toEqual([]);
  });
});

/*
 * THE HARDER QUESTION, ASKED OF EVERY TOKEN-AUTHORIZED FUNCTION.
 *
 * These are the only functions in the schema a stranger on the internet can
 * invoke, so "it checks a token" is not something to take on trust from a
 * comment. Each property below is one way the capability model fails in
 * practice: a function that ignores its token authorizes everybody, one that
 * returns an account id turns a share link into a way to learn who shared it,
 * and one that answers differently for a dead token than for an invented one
 * confirms which links were once real.
 */
describe("a function a stranger can call", () => {
  it("takes a token and filters on it", () => {
    for (const name of TOKEN_AUTHORIZED_FUNCTIONS.keys()) {
      const definer = definers.find((d) => d.name === name)!;
      expect(definer, `${name} is not a SECURITY DEFINER function`).toBeDefined();
      expect(definer.args, `${name} takes no token`).toMatch(/token/i);
      const body = definer.body.slice(definer.body.indexOf("AS $"));
      expect(body, `${name} does not filter on its token`).toMatch(/p_token/);
    }
  });

  it("returns no account identifier", () => {
    for (const name of TOKEN_AUTHORIZED_FUNCTIONS.keys()) {
      const definer = definers.find((d) => d.name === name)!;
      /*
       * Read from the RETURNS clause rather than the body: what leaves the
       * function is what the caller sees, and a body may legitimately mention a
       * user id in a predicate it never returns.
       */
      const returns = definer.body.slice(
        definer.body.indexOf("RETURNS"),
        definer.body.indexOf("AS $"),
      );
      for (const forbidden of ["user_id", "owner_id", "created_by", "actor"]) {
        expect(returns.toLowerCase(), `${name} returns ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("answers nothing for a token nobody issued", async () => {
    for (const name of TOKEN_AUTHORIZED_FUNCTIONS.keys()) {
      const attempt = await twin.asAnon(
        `select * from public.${name}('this-token-was-never-issued')`,
      );
      expect(attempt.error, `${name} failed for an unknown token`).toBeUndefined();
      expect(attempt.rows, `${name} answered an unknown token`).toEqual([]);
    }
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
