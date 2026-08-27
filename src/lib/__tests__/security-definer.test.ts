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
