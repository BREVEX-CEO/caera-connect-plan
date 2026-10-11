import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";
import {
  ACCOUNT_DATA_CLASSES,
  exportedTablesFor,
  findAccountDataClass,
  NOT_EXPORTED,
} from "../data-classes";

/**
 * THE MAP THAT ACCESS AND ERASURE BOTH READ, CHECKED AGAINST THE REAL SCHEMA.
 *
 * PLAN.md ??O asks for an export of synchronised account data and deletion of a
 * single data class. Both are driven from `data-classes.ts`, and the way that
 * file fails is silent in both directions: a table that no longer exists makes
 * a deletion clear nothing and an export omit a class, and neither raises an
 * error a person would ever see.
 *
 * So the map is checked against Postgres itself ??? the real migrations applied
 * to PGlite ??? rather than against the generated types alone. The types are
 * regenerated from a project that may be ahead of or behind the migrations in
 * this repository; the migrations are what a deployment actually runs.
 */

let twin: DatabaseTwin;
let tables: Set<string>;
let columns: Map<string, Set<string>>;
let foreignKeys: { child: string; parent: string; rule: string }[];
let ownerColumns: Set<string>;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  await twin.applyMigrations();
  const rows = await twin.asSuperuser<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  );
  tables = new Set(rows.map((row) => row.table_name));
  columns = new Map();
  for (const row of rows) {
    const set = columns.get(row.table_name) ?? new Set<string>();
    set.add(row.column_name);
    columns.set(row.table_name, set);
  }
  foreignKeys = await twin.asSuperuser<{ child: string; parent: string; rule: string }>(
    `select c.relname as child, p.relname as parent, con.confdeltype as rule
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_class p on p.oid = con.confrelid
      where con.contype = 'f'`,
  );
  /*
   * `table.column` for every column that is a foreign key to `auth.users`.
   *
   * This is what "owns" means here. Asserting only that the column EXISTS is
   * not enough and was not enough: `ocade_memory` has both `id` and `user_id`,
   * so a map that named `id` as the owner passed a presence check and would
   * have exported by primary key ??? matching one row, or none, and reporting an
   * empty class as though the account held nothing.
   */
  const accountKeys = await twin.asSuperuser<{ table_name: string; column_name: string }>(
    `select c.relname as table_name, a.attname as column_name
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_class p on p.oid = con.confrelid
       join pg_namespace pn on pn.oid = p.relnamespace
       join unnest(con.conkey) as k(attnum) on true
       join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
      where con.contype = 'f' and pn.nspname = 'auth' and p.relname = 'users'`,
  );
  ownerColumns = new Set(accountKeys.map((row) => `${row.table_name}.${row.column_name}`));
}, 300_000);

afterAll(async () => {
  await twin?.close();
});

describe("the account data map", () => {
  it("found a schema to check against, so an empty read cannot pass", () => {
    /*
     * The reduced schema. Phase 10 removed seventy tables belonging to products
     * OCADE no longer is, so the floor is what the final product actually has ???
     * high enough that an empty read still cannot pass.
     */
    expect(tables.size).toBeGreaterThan(20);
    expect(foreignKeys.length).toBeGreaterThan(20);
  });

  it("names only tables that exist", () => {
    const missing: string[] = [];
    for (const entry of ACCOUNT_DATA_CLASSES) {
      for (const table of exportedTablesFor(entry)) {
        if (!tables.has(table)) missing.push(`${entry.id}: ${table}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("names an owner column that really identifies the account", () => {
    const wrong: string[] = [];
    for (const entry of ACCOUNT_DATA_CLASSES) {
      for (const table of entry.tables) {
        if (!columns.get(table.table)?.has(table.owner)) {
          wrong.push(`${entry.id}: ${table.table} has no ${table.owner}`);
        } else if (!ownerColumns.has(`${table.table}.${table.owner}`)) {
          wrong.push(`${entry.id}: ${table.table}.${table.owner} does not reference auth.users`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("claims a cascade only where deleting the parent really reaches the child", () => {
    /*
     * The deletion path deletes PARENTS and relies on ON DELETE CASCADE to take
     * the children. A cascade claimed here but declared NO ACTION in the schema
     * would leave the children behind ??? rows the person asked to be rid of,
     * still in the database, with the parent that explained them gone.
     *
     * The check follows a CHAIN rather than one edge, because one of these
     * genuinely is a chain: a step receipt hangs off an automation run, which
     * hangs off the automation. Requiring a direct foreign key would have
     * forced the map to describe the schema wrongly in order to pass.
     */
    const reachedByCascade = (parent: string): Set<string> => {
      const reached = new Set<string>();
      const queue = [parent];
      while (queue.length > 0) {
        const current = queue.pop()!;
        for (const edge of foreignKeys) {
          if (edge.parent !== current || edge.rule !== "c" || reached.has(edge.child)) continue;
          reached.add(edge.child);
          queue.push(edge.child);
        }
      }
      return reached;
    };

    const claimed: [string, string][] = [];
    for (const entry of ACCOUNT_DATA_CLASSES) {
      for (const table of entry.tables) {
        for (const child of table.cascades ?? []) claimed.push([child, table.table]);
      }
    }
    expect(claimed.length).toBeGreaterThan(0);

    const notCascading: string[] = [];
    for (const [child, parent] of claimed) {
      if (!reachedByCascade(parent).has(child)) {
        notCascading.push(`deleting ${parent} does not cascade to ${child}`);
      }
    }
    expect(notCascading).toEqual([]);
  });
});

describe("what may and may not be erased", () => {
  it("refuses the three classes that have to be kept, each with a reason", () => {
    for (const id of ["profile", "billing", "legal"] as const) {
      const entry = findAccountDataClass(id);
      expect(entry, id).toBeTruthy();
      expect(entry!.retention, id).toBeTruthy();
      expect(entry!.retention!.length, id).toBeGreaterThan(40);
    }
  });

  it("exports every class, including the ones it will not delete", () => {
    // The access right is not conditional on the erasure right. A class kept
    // for a retention period is exactly the one somebody most needs a copy of.
    for (const entry of ACCOUNT_DATA_CLASSES) {
      expect(exportedTablesFor(entry).length, entry.id).toBeGreaterThan(0);
    }
  });

  it("covers every table the irreversible account deletion clears", () => {
    /*
     * Account deletion and per-class deletion are two paths over one account.
     * A table the irreversible path knows about and this map does not is a
     * table the export silently omits ??? somebody downloads their data, deletes
     * their account, and finds afterwards that a class was never in the file.
     */
    const deletionPath = [
      ...readFileSync("src/lib/account/erase.server.ts", "utf8").matchAll(/from\("(\w+)"\)/g),
    ]
      .map((m) => m[1]!)
      .filter((table) => !(table in NOT_EXPORTED));
    expect(deletionPath).toContain("user_private_records");
    const covered = new Set(ACCOUNT_DATA_CLASSES.flatMap((entry) => exportedTablesFor(entry)));
    for (const table of deletionPath) expect([...covered], table).toContain(table);
  });

  it("exports every account-linked table, or says why not (F-026)", () => {
    // JARVIS tables, private records and usage were all once missing while the
    // export said every table was read in full.
    const covered = new Set<string>(
      ACCOUNT_DATA_CLASSES.flatMap((entry) => exportedTablesFor(entry)),
    );
    const owned = new Set(
      [...ownerColumns].map((column) => column.split(".")[0]!).filter((t) => tables.has(t)),
    );
    expect(owned.size).toBeGreaterThan(20);
    for (const table of owned) {
      expect(covered.has(table) || table in NOT_EXPORTED, table).toBe(true);
    }
    for (const table of Object.keys(NOT_EXPORTED)) {
      expect(owned.has(table) && !covered.has(table), table).toBe(true);
    }
  });
});
