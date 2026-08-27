import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";

/*
 * CHANGING AN ID IN A REQUEST MUST NOT REACH ANOTHER ACCOUNT.
 *
 * The existing cross-tenant tests prove this for one table. This proves it for
 * EVERY table the schema declares an owner column on, discovered from the
 * schema itself rather than from a list somebody remembered to update — a
 * table added next month is covered the day it is added, and if it is not
 * protected this fails.
 *
 * Four attacks per table, because they fail differently:
 *
 *   READ    — `where user_id = <someone else>`; a policy that filters on
 *             auth.uid() must return nothing rather than trusting the filter.
 *   UPDATE  — the row exists, the policy must not let it be changed.
 *   DELETE  — same, and worse if it works.
 *   FORGE   — insert a row OWNED by someone else; a missing WITH CHECK lets an
 *             attacker plant data in another account rather than read from it.
 *
 * Every query runs under `SET ROLE authenticated` with the attacker's JWT
 * claim. Run as the superuser PGlite connects as, Postgres bypasses RLS
 * entirely and all of this would pass against a schema with no policies at
 * all — see the twin's own note on that.
 */

const ALICE = "a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1";
const BOB = "b0b0b0b0-2222-4222-8222-b0b0b0b0b0b0";

let twin: DatabaseTwin;
/** table -> the column naming its owner */
let owned: Array<{ table: string; column: string }> = [];
/** table -> a row id we planted for Bob, when we could plant one */
const bobsRows = new Map<string, Record<string, unknown>>();

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  const failed = applied.filter((a) => !a.ok);
  expect(failed, `migrations failed: ${JSON.stringify(failed)}`).toHaveLength(0);

  await twin.execSuperuser(`
    insert into auth.users (id, email) values
      ('${ALICE}', 'alice@isolation.test'),
      ('${BOB}',   'bob@isolation.test')
    on conflict (id) do nothing;
  `);

  /*
   * A table is "owned" when it has a user_id column, or when its primary key
   * IS the user id — which is how `profiles` and `user_settings` are shaped.
   */
  const withUserId = await twin.asSuperuser<{ table_name: string }>(`
    select c.table_name
      from information_schema.columns c
      join pg_class pc on pc.relname = c.table_name
      join pg_namespace n on n.oid = pc.relnamespace and n.nspname = 'public'
     where c.table_schema = 'public' and c.column_name = 'user_id'
       and pc.relkind = 'r'
     order by 1`);
  owned = withUserId.map((r) => ({ table: r.table_name, column: "user_id" }));
  owned.push({ table: "profiles", column: "id" });

  // Planted through the twin, which reads CHECK constraints, enum types and
  // foreign keys out of the catalogue rather than guessing at them — a table
  // that cannot be seeded is a table this proves nothing about.
  for (const { table } of owned) {
    const row = await twin.plantRow(table, BOB);
    if (row) bobsRows.set(table, row);
  }
}, 240_000);

afterAll(async () => {
  await twin?.db.close();
});

describe("every table with an owner column", () => {
  it("has at least one, so a broken discovery query cannot pass", () => {
    expect(owned.length).toBeGreaterThan(20);
  });

  it("has RLS enabled on all of them", async () => {
    const enabled = new Set(await twin.rlsEnabledTables());
    const unprotected = owned.map((o) => o.table).filter((t) => !enabled.has(t));
    expect(unprotected).toEqual([]);
  });

  it("could be planted with a row to attack, or is named here", () => {
    const unplanted = owned.map((o) => o.table).filter((t) => !bobsRows.has(t));
    // Reported rather than asserted empty: some tables carry check constraints
    // a generic filler cannot satisfy. What matters is that the list is
    // visible, so nobody mistakes "not tested" for "tested and safe".
    if (unplanted.length) {
      console.warn(`[isolation] could not plant a probe row in: ${unplanted.join(", ")}`);
    }
    /*
     * Locked at what the planter actually reaches today. Raising it is the
     * point of improving the planter; lowering it silently would let coverage
     * rot back to where it started.
     */
    expect(bobsRows.size).toBeGreaterThanOrEqual(34);
  });
});

describe("Alice, naming Bob's id directly", () => {
  it("reads nothing from any owned table", async () => {
    const leaked: string[] = [];
    for (const { table, column } of owned) {
      if (!bobsRows.has(table)) continue;
      const result = await twin.asTenant(
        ALICE,
        `select 1 from public.${table} where ${column} = '${BOB}'`,
      );
      if (result.rows.length > 0) leaked.push(table);
    }
    expect(leaked, "these tables returned another account's rows").toEqual([]);
  });

  it("updates nothing in any owned table", async () => {
    const mutated: string[] = [];
    for (const { table, column } of owned) {
      const row = bobsRows.get(table);
      if (!row) continue;
      const result = await twin.asTenant(
        ALICE,
        `update public.${table} set ${column} = ${column}
          where ${column} = '${BOB}' returning 1`,
      );
      if (result.rows.length > 0) mutated.push(table);
    }
    expect(mutated, "these tables let another account be written to").toEqual([]);
  });

  it("deletes nothing from any owned table", async () => {
    const destroyed: string[] = [];
    for (const { table, column } of owned) {
      if (!bobsRows.has(table)) continue;
      const result = await twin.asTenant(
        ALICE,
        `delete from public.${table} where ${column} = '${BOB}' returning 1`,
      );
      if (result.rows.length > 0) destroyed.push(table);
    }
    expect(destroyed, "these tables let another account's rows be deleted").toEqual([]);
  });

  it("still finds Bob's rows afterwards, so the attacks were really refused", async () => {
    const gone: string[] = [];
    for (const { table, column } of owned) {
      if (!bobsRows.has(table)) continue;
      const rows = await twin.asSuperuser<{ n: string }>(
        `select count(*) as n from public.${table} where ${column} = '${BOB}'`,
      );
      if (Number(rows[0]?.n ?? 0) === 0) gone.push(table);
    }
    expect(gone, "the delete attempt above actually succeeded here").toEqual([]);
  });
});

describe("Alice, forging a row owned by Bob", () => {
  it("cannot insert into any owned table", async () => {
    const forged: string[] = [];
    for (const { table, column } of owned) {
      const template = bobsRows.get(table);
      if (!template) continue;
      const names = Object.keys(template).filter((k) => k !== "created_at" && k !== "updated_at");
      const values = names.map((name) => {
        if (name === column) return `'${BOB}'`;
        if (name === "id" && column !== "id") return "extensions.gen_random_uuid()";
        const value = template[name];
        if (value === null) return "null";
        if (typeof value === "number") return String(value);
        if (typeof value === "boolean") return String(value);
        if (typeof value === "object")
          return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
        return `'${String(value).replace(/'/g, "''")}'`;
      });
      const result = await twin.asTenant(
        ALICE,
        `insert into public.${table} (${names.join(", ")})
         values (${values.join(", ")}) returning 1`,
      );
      // A refusal is either an error or zero rows written. A successful forge
      // is neither, and is the finding.
      if (!result.error && result.rows.length > 0) forged.push(table);
    }
    expect(forged, "these tables accepted a row owned by another account").toEqual([]);
  });
});

describe("a caller with no identity at all", () => {
  it("reads nothing from any owned table", async () => {
    const leaked: string[] = [];
    for (const { table } of owned) {
      if (!bobsRows.has(table)) continue;
      const result = await twin.asTenant(
        "00000000-0000-0000-0000-000000000000",
        `select 1 from public.${table}`,
      );
      if (result.rows.length > 0) leaked.push(table);
    }
    expect(leaked).toEqual([]);
  });
});
