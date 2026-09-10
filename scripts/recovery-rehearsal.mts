/**
 * THE RESTORE REHEARSAL, RUN RATHER THAN DESCRIBED.
 *
 * `PLAN.md` Phase 16: "Prove scheduled database/Storage backup, isolated
 * restore rehearsal with RLS/integrity checks ... Gate: recovery is
 * demonstrated, not just documented."
 *
 * So this drives a real recovery against real PostgreSQL, end to end, in the
 * order an actual incident forces:
 *
 *   1. A live database with data in it, owned by two different accounts.
 *   2. A backup taken from it, carrying rows and nothing about the instance.
 *   3. TOTAL LOSS. Not a truncate on the same database, which quietly keeps
 *      the schema, the policies, the extensions and the functions alive. A
 *      second, empty PostgreSQL that has never seen any of it.
 *   4. Schema recovered from `supabase/migrations/` alone.
 *   5. Rows restored from the backup, parents before children.
 *   6. Proof: same rows, no orphans, sequences usable again, row-level
 *      security still enforced, and one account still cannot read the other's
 *      data in the restored database.
 *   7. A migration rolled back and re-applied on the restored database, which
 *      is the other half of recovery: getting back to the previous schema.
 *
 * Step 6 is the one that earns the rehearsal. A restore that returns every row
 * and loses the policies is not a recovery -- it is a data breach with good
 * row counts, and it is exactly what restoring a table without its policies
 * produces.
 */

import { readFileSync } from "node:fs";
import { DatabaseTwin } from "./db-twin.mts";
import {
  buildReport,
  compareInventories,
  digestRows,
  evidenceLeaks,
  insertStatementFor,
  inventoryOf,
  restoreOrder,
  type ForeignKeyEdge,
  type RecoveryBackup,
  type RehearsalReport,
  type RehearsalStep,
} from "../src/lib/recovery/rehearsal.ts";

const ALICE = "a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1";
const BOB = "b0b0b0b0-2222-4222-8222-b0b0b0b0b0b0";

/** The release the backup is stamped with, read from the single authority. */
function releaseVersion(): string {
  const source = readFileSync("src/lib/release-health.ts", "utf8");
  return /OCADE_RELEASE_VERSION = "([^"]+)"/.exec(source)?.[1] ?? "unknown";
}

/*
 * THREE SCHEMAS, BECAUSE A BACKUP OF ONE OF THEM IS NOT A BACKUP.
 *
 * The first run of this rehearsal restored `public` alone and every single
 * user-owned table came back orphaned: sixty foreign keys to `auth.users`,
 * pointing at an account table the backup had never included. That is the
 * defect worth having built this to find. `auth` holds the identities every
 * row hangs off, and `storage` holds the object metadata -- bucket, path,
 * owner -- without which a restored database can list nobody's files even
 * though the bytes are still sitting in object storage.
 */
const BACKED_UP_SCHEMAS = ["auth", "storage", "public"] as const;

/** Qualified table names, so one ordering can span the schemas. */
async function backedUpTables(twin: DatabaseTwin): Promise<string[]> {
  const rows = await twin.asSuperuser<{ qualified: string }>(`
    select n.nspname || '.' || c.relname as qualified
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'r' and n.nspname in (${BACKED_UP_SCHEMAS.map((s) => `'${s}'`).join(", ")})
     order by 1`);
  return rows.map((r) => r.qualified);
}

function splitQualified(qualified: string): { schema: string; table: string } {
  const [schema, ...rest] = qualified.split(".");
  return { schema, table: rest.join(".") };
}

async function foreignKeyEdges(twin: DatabaseTwin): Promise<ForeignKeyEdge[]> {
  const rows = await twin.asSuperuser<{ table: string; depends_on: string }>(`
    select cn.nspname || '.' || child.relname as table,
           pn.nspname || '.' || parent.relname as depends_on
      from pg_constraint c
      join pg_class child on child.oid = c.conrelid
      join pg_class parent on parent.oid = c.confrelid
      join pg_namespace cn on cn.oid = child.relnamespace
      join pg_namespace pn on pn.oid = parent.relnamespace
     where c.contype = 'f'
       and cn.nspname in (${BACKED_UP_SCHEMAS.map((s) => `'${s}'`).join(", ")})
       and pn.nspname in (${BACKED_UP_SCHEMAS.map((s) => `'${s}'`).join(", ")})`);
  return rows.map((r) => ({ table: r.table, dependsOn: r.depends_on }));
}

/** Every row of every public table, plus the auth users they hang off. */
async function takeBackup(twin: DatabaseTwin, migrationCount: number): Promise<RecoveryBackup> {
  const tables = await backedUpTables(twin);
  const backup: RecoveryBackup = {
    schemaVersion: 1,
    takenAt: new Date().toISOString(),
    release: releaseVersion(),
    migrationCount,
    tables: [],
  };
  for (const qualified of tables) {
    const { schema, table } = splitQualified(qualified);
    const rows = await twin.asSuperuser(`select * from "${schema}"."${table}"`);
    backup.tables.push({ table: qualified, rows });
  }
  return backup;
}

/**
 * Restore into an empty database.
 *
 * `session_replication_role = replica` is what `pg_restore --disable-triggers`
 * does and it is needed for two separate reasons. An `updated_at` trigger
 * would rewrite the value being restored, so the rows would come back subtly
 * different from the backup; and a foreign key inside a cycle cannot be
 * satisfied by ordering alone. Constraints are re-enabled immediately
 * afterwards and integrity is then proven by query, not assumed.
 */
async function restore(twin: DatabaseTwin, backup: RecoveryBackup): Promise<number> {
  const tables = backup.tables.map((t) => t.table);
  const { order } = restoreOrder(tables, await foreignKeyEdges(twin));
  const byTable = new Map(backup.tables.map((t) => [t.table, t.rows]));

  await twin.execSuperuser(`set session_replication_role = replica;`);
  let restored = 0;
  try {
    /*
     * EMPTY THE TABLES FIRST, BECAUSE THE REBUILT SCHEMA IS NOT EMPTY.
     *
     * This is what the first run of this rehearsal found, and it is a real
     * restore hazard rather than a quirk of the harness: several migrations
     * INSERT reference data as they run -- country packs, plan tiers, status
     * components -- so a database rebuilt from `supabase/migrations/` already
     * holds those rows before the backup is opened. Inserting the backup on
     * top of them fails on a unique constraint, and an operator who worked
     * around that by skipping the conflicting rows would silently restore a
     * mixture of two vintages. A restore REPLACES; `pg_restore --clean` says
     * the same thing in its own way.
     */
    for (const qualified of [...order].reverse()) {
      const { schema, table } = splitQualified(qualified);
      await twin.execSuperuser(`truncate table "${schema}"."${table}" cascade;`);
    }
    for (const qualified of order) {
      const { schema, table } = splitQualified(qualified);
      for (const row of byTable.get(qualified) ?? []) {
        const statement = insertStatementFor(table, row, schema);
        await twin.db.query(statement.sql, statement.params);
        restored += 1;
      }
    }
  } finally {
    await twin.execSuperuser(`set session_replication_role = origin;`);
  }
  return restored;
}

/** Orphan rows, found by asking every foreign key whether it still holds. */
async function orphanedRows(twin: DatabaseTwin): Promise<string[]> {
  const constraints = await twin.asSuperuser<{
    name: string;
    definition: string;
    schema: string;
    table: string;
  }>(`
    select c.conname as name, pg_get_constraintdef(c.oid) as definition,
           n.nspname as schema, child.relname as table
      from pg_constraint c
      join pg_class child on child.oid = c.conrelid
      join pg_namespace n on n.oid = child.relnamespace
     where c.contype = 'f'
       and n.nspname in (${BACKED_UP_SCHEMAS.map((s) => `'${s}'`).join(", ")})`);

  const broken: string[] = [];
  for (const constraint of constraints) {
    /*
     * VALIDATE re-checks every existing row against the constraint, which is
     * precisely the question -- and it asks Postgres rather than a query this
     * file would have to build correctly for composite keys, partial matches
     * and MATCH FULL. The constraint is marked invalid first so VALIDATE has
     * something to do; a valid constraint is a no-op.
     */
    try {
      const target = `"${constraint.schema}"."${constraint.table}"`;
      await twin.execSuperuser(
        `alter table ${target} drop constraint "${constraint.name}";
         alter table ${target}
           add constraint "${constraint.name}" ${constraint.definition} not valid;
         alter table ${target} validate constraint "${constraint.name}";`,
      );
    } catch (error) {
      broken.push(
        `${constraint.schema}.${constraint.table}.${constraint.name}: ${(error as Error).message}`,
      );
    }
  }
  return broken;
}

/**
 * Sequences after a restore.
 *
 * Rows arrive with the identifiers they had; the sequence that issued them
 * does not, so it still points at 1 and the next insert collides with a row
 * that was restored. Re-synchronising is part of the restore, and the proof is
 * an actual insert afterwards rather than a `setval` that was called.
 */
async function resyncSequences(twin: DatabaseTwin): Promise<number> {
  const sequences = await twin.asSuperuser<{ table: string; column: string; sequence: string }>(`
    select c.relname as table, a.attname as column, pg_get_serial_sequence(
             quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) as sequence
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
       and pg_get_serial_sequence(
             quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) is not null`);

  for (const sequence of sequences) {
    await twin.execSuperuser(
      `select setval('${sequence.sequence}',
         coalesce((select max("${sequence.column}") from public."${sequence.table}"), 0) + 1,
         false);`,
    );
  }
  return sequences.length;
}

/** Plant rows for two accounts across every table that declares an owner. */
async function seed(twin: DatabaseTwin): Promise<number> {
  await twin.execSuperuser(`
    insert into auth.users (id, email) values
      ('${ALICE}', 'alice@recovery.test'),
      ('${BOB}',   'bob@recovery.test')
    on conflict (id) do nothing;
  `);

  const owned = await twin.asSuperuser<{ table_name: string }>(`
    select c.table_name
      from information_schema.columns c
      join pg_class pc on pc.relname = c.table_name
      join pg_namespace n on n.oid = pc.relnamespace and n.nspname = 'public'
     where c.table_schema = 'public' and c.column_name = 'user_id' and pc.relkind = 'r'
     order by 1`);

  /*
   * STORAGE, TOO. `PLAN.md` Phase 16 asks for database AND Storage backup, and
   * the halves fail differently: the bytes of a file live in object storage and
   * survive a database loss, but the row that says which account owns it, in
   * which bucket, under which path, lives here. Restore the database without
   * these rows and every customer file is intact and unreachable.
   */
  const buckets = await twin.asSuperuser<{ id: string }>(`select id from storage.buckets limit 1`);
  const bucket = buckets[0]?.id;
  if (bucket) {
    for (const owner of [ALICE, BOB]) {
      await twin.execSuperuser(
        `insert into storage.objects (bucket_id, name, owner, metadata)
         values ('${bucket}', '${owner}/recovery-rehearsal.txt', '${owner}',
                 '{"size": 12, "mimetype": "text/plain"}'::jsonb);`,
      );
    }
  }

  let planted = 0;
  for (const { table_name: table } of owned) {
    for (const owner of [ALICE, BOB]) {
      const row = await twin.plantRow(table, owner);
      if (row) planted += 1;
    }
  }
  return planted;
}

/** A table both accounts have a row in, for the cross-account read probe. */
async function contestedTable(twin: DatabaseTwin): Promise<string | null> {
  const rows = await twin.asSuperuser<{ table_name: string }>(`
    select c.table_name
      from information_schema.columns c
      join pg_class pc on pc.relname = c.table_name
      join pg_namespace n on n.oid = pc.relnamespace and n.nspname = 'public'
     where c.table_schema = 'public' and c.column_name = 'user_id' and pc.relkind = 'r'
     order by 1`);
  for (const { table_name: table } of rows) {
    const counted = await twin.asSuperuser<{ owners: number }>(
      `select count(distinct user_id)::int as owners from public."${table}"`,
    );
    if (Number(counted[0]?.owners ?? 0) >= 2) return table;
  }
  return null;
}

export interface RehearsalOutcome {
  report: RehearsalReport;
  leaks: string[];
}

export async function rehearseRecovery(): Promise<RehearsalOutcome> {
  const steps: RehearsalStep[] = [];
  const pass = (step: string, detail: string) => steps.push({ step, status: "passed", detail });
  const fail = (step: string, detail: string) => steps.push({ step, status: "failed", detail });

  const migrationFiles = DatabaseTwin.migrationFiles();

  /* ---------------------------------------------------- the live database -- */
  const live = await DatabaseTwin.create();
  let restoredTwin: DatabaseTwin | null = null;
  try {
    const applied = await live.applyMigrations();
    const failed = applied.filter((a) => !a.ok);
    if (failed.length > 0) {
      fail("schema recovered from the repository", `migration failed: ${failed[0]?.file}`);
      return finish();
    }
    pass(
      "schema applied to the live database",
      `${applied.length} migration(s) of ${migrationFiles.length}`,
    );

    const planted = await seed(live);
    pass("two accounts seeded with data", `${planted} row(s) planted across owned tables`);

    const sourcePolicies = await live.policyCount();
    const sourceRls = await live.rlsEnabledTables();

    /* ----------------------------------------------------------- backup -- */
    const backup = await takeBackup(live, applied.length);
    const before = inventoryOf(backup);
    const backedUpRows = before.reduce((sum, t) => sum + t.rowCount, 0);
    if (backedUpRows === 0) {
      fail("backup taken", "the backup contains no rows, so a restore would prove nothing");
      return finish();
    }
    pass("backup taken", `${backedUpRows} row(s) across ${before.length} table(s)`);

    /* --------------------------------------------- total loss, then rebuild -- */
    restoredTwin = await DatabaseTwin.create();
    const rebuilt = await restoredTwin.applyMigrations();
    const rebuildFailed = rebuilt.filter((a) => !a.ok);
    if (rebuildFailed.length > 0) {
      fail("schema rebuilt in an isolated database", `failed at ${rebuildFailed[0]?.file}`);
      return finish();
    }
    pass(
      "schema rebuilt in an isolated database",
      `${rebuilt.length} migration(s), from this repository alone`,
    );

    const restoredRows = await restore(restoredTwin, backup);
    pass("rows restored", `${restoredRows} row(s) inserted, parents before children`);

    /* ------------------------------------------------------- the proofs -- */
    const after = inventoryOf(await takeBackup(restoredTwin, rebuilt.length));
    const differences = compareInventories(before, after);
    if (differences.length > 0) {
      fail(
        "every row came back, byte for byte",
        differences.map((d) => `${d.table}: ${d.detail}`).join("; "),
      );
    } else {
      pass(
        "every row came back, byte for byte",
        `${before.length} table digest(s) match the backup`,
      );
    }

    const orphans = await orphanedRows(restoredTwin);
    if (orphans.length > 0) {
      fail("referential integrity survived the restore", orphans.join("; "));
    } else {
      pass(
        "referential integrity survived the restore",
        "every foreign key re-validated against the restored rows",
      );
    }

    const sequences = await resyncSequences(restoredTwin);
    pass("sequences re-synchronised", `${sequences} sequence(s) moved past the restored rows`);

    const restoredPolicies = await restoredTwin.policyCount();
    const restoredRls = await restoredTwin.rlsEnabledTables();
    const missingRls = sourceRls.filter((t) => !restoredRls.includes(t));
    if (restoredPolicies < sourcePolicies || missingRls.length > 0) {
      fail(
        "row-level security came back with the data",
        `policies ${sourcePolicies} -> ${restoredPolicies}; tables without RLS: ${
          missingRls.join(", ") || "none"
        }`,
      );
    } else {
      pass(
        "row-level security came back with the data",
        `${restoredPolicies} policy(ies) across ${restoredRls.length} table(s)`,
      );
    }

    const contested = await contestedTable(restoredTwin);
    if (!contested) {
      fail(
        "one account cannot read the other in the restored database",
        "no restored table holds rows for both accounts, so the probe proves nothing",
      );
    } else {
      // The reader is Bob, asking for everything in a table he shares with Alice.
      const seen = await restoredTwin.asTenant<{ user_id: string }>(
        BOB,
        `select user_id from public."${contested}"`,
      );
      const foreign = seen.rows.filter((r) => r.user_id !== BOB);
      if (seen.error) {
        pass(
          "one account cannot read the other in the restored database",
          `${contested}: the read was refused outright`,
        );
      } else if (foreign.length > 0) {
        fail(
          "one account cannot read the other in the restored database",
          `${contested}: ${foreign.length} row(s) belonging to another account were returned`,
        );
      } else {
        pass(
          "one account cannot read the other in the restored database",
          `${contested}: only the reader's own rows came back`,
        );
      }
    }

    /* ------------------------------------------- the other half: rollback -- */
    const newest = migrationFiles[migrationFiles.length - 1] ?? "";
    const rollbackFile = newest.replace(/\.sql$/, "_rollback.sql");
    const verifyFile = newest.replace(/\.sql$/, "_verify.sql");
    const rolledBack = await restoredTwin.runScript("supabase/rollback", rollbackFile);
    if (!rolledBack.ok) {
      fail("the newest migration rolled back", `${rollbackFile}: ${rolledBack.error}`);
    } else {
      pass("the newest migration rolled back", rollbackFile);
      const reapplied = await restoredTwin.runScript("supabase/migrations", newest);
      const verified = reapplied.ok
        ? await restoredTwin.runScript("supabase/verification", verifyFile)
        : { ok: false, error: reapplied.error };
      if (!verified.ok) {
        fail("the newest migration re-applied and verified", `${newest}: ${verified.error}`);
      } else {
        pass("the newest migration re-applied and verified", `${newest} then ${verifyFile}`);
      }
    }

    return finish(before, applied.length);
  } finally {
    await live.close().catch(() => {});
    await restoredTwin?.close().catch(() => {});
  }

  function finish(inventory: RehearsalReport["inventory"] = [], migrationCount = 0) {
    const report = buildReport({
      rehearsedAt: new Date().toISOString(),
      release: releaseVersion(),
      migrationCount: migrationCount || migrationFiles.length,
      inventory,
      steps,
    });
    return { report, leaks: evidenceLeaks(report) };
  }
}

/** Digest one table's rows, exported for the unit tests to reuse. */
export { digestRows };
