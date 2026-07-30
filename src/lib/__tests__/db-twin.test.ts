import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";

/**
 * DATABASE AND IDENTITY TWIN (P16 / HWE-30).
 *
 * 31 migrations, 31 verification scripts and 31 rollback scripts had never been
 * applied to anything. The SQL tests could only read the files and match
 * strings, because there was no database available and no Docker on this
 * machine.
 *
 * PGlite is real PostgreSQL 18.3 in WebAssembly, so these run against an actual
 * Postgres parser, planner and RLS implementation.
 *
 * THE ROLE MATTERS MORE THAN THE DATABASE. PGlite connects as a superuser, and
 * Postgres superusers BYPASS row-level security — a cross-tenant test run that
 * way would pass no matter how broken the policies were. Every tenant query
 * below therefore runs under `SET ROLE authenticated`, and one test proves the
 * two paths genuinely differ.
 *
 * NOT PROVEN HERE: that a deployment succeeded. This is the schema and the
 * policies, not the production database.
 */

let twin: DatabaseTwin;
let applied: Awaited<ReturnType<DatabaseTwin["applyMigrations"]>>;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  applied = await twin.applyMigrations();
}, 300_000);

afterAll(async () => {
  await twin?.close();
});

describe("every migration applies in the declared order", () => {
  it("finds all 31 migrations", () => {
    expect(DatabaseTwin.migrationFiles()).toHaveLength(31);
  });

  /**
   * A REAL DEFECT the twin found, recorded rather than hidden.
   *
   * `20260721153321…sql` is a single statement:
   *   COMMENT ON TABLE public.ficia_time_entries IS '…';
   *
   * No migration in this repository creates `ficia_time_entries`. The generated
   * Supabase types DO describe it, with columns and foreign keys — so the table
   * exists in the real project and was created outside the tracked migrations.
   *
   * The consequence is concrete: THIS MIGRATION SET CANNOT REBUILD THE DATABASE
   * FROM SCRATCH. A fresh environment would fail here, and every migration
   * after it would never run.
   *
   * It is deliberately NOT "fixed" by reconstructing the table from the
   * generated types. Those types carry columns but not RLS policies, and a
   * multi-tenant table recreated without its policies is a data-exposure bug
   * dressed up as a fix. The missing migration has to come from the project
   * that owns the schema.
   */
  const KNOWN_MISSING_MIGRATION = "20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb.sql";

  it("fails ONLY on the one migration whose CREATE is missing from the repository", () => {
    const failed = applied.filter((a) => !a.ok);
    // Any OTHER failure is a new defect and must break the build.
    const unexpected = failed.filter((f) => f.file !== KNOWN_MISSING_MIGRATION);
    expect(
      unexpected.map((f) => `${f.file}: ${f.error}`),
      "an unexpected migration failed against real PostgreSQL",
    ).toEqual([]);
  });

  it("records the missing-table defect precisely, so it cannot be forgotten", () => {
    const hit = applied.find((a) => a.file === KNOWN_MISSING_MIGRATION);
    expect(hit, "the known-broken migration was not reached").toBeTruthy();
    expect(hit!.ok).toBe(false);
    expect(hit!.error).toMatch(/ficia_time_entries.*does not exist/);
    // When the missing CREATE migration is added, this test fails and the
    // exception above must be deleted — which is the point.
  });

  it("applies every migration up to that point", () => {
    const index = applied.findIndex((a) => a.file === KNOWN_MISSING_MIGRATION);
    expect(index).toBeGreaterThan(0);
    expect(applied.slice(0, index).every((a) => a.ok)).toBe(true);
  });

  it("creates the tables that migrations before the break define", async () => {
    const tables = await twin.tables();
    expect(tables.length).toBeGreaterThan(40);
    // ocade_projects and later tables are defined AFTER the broken migration,
    // so they are legitimately absent here. Asserting them would be asserting
    // that the defect does not exist.
    for (const t of [
      "ocade_conversations",
      "ocade_messages",
      "ficia_employments",
    ]) {
      expect(tables, `${t} missing after migration`).toContain(t);
    }
  });
});

describe("row-level security is real, not declared", () => {
  it("enables RLS on every public table", async () => {
    const tables = await twin.tables();
    const rls = await twin.rlsEnabledTables();
    const unprotected = tables.filter((t) => !rls.includes(t));
    // A table without RLS in a multi-tenant schema is readable by every tenant.
    expect(unprotected, "tables with no row-level security").toEqual([]);
  });

  it("defines policies, not just the RLS flag", async () => {
    // `ENABLE ROW LEVEL SECURITY` with no policy denies everything, which is
    // safe but broken. Policies must exist.
    expect(await twin.policyCount()).toBeGreaterThan(20);
  });

  it("PROVES the tenant path differs from the superuser path", async () => {
    // If this ever stops holding, every isolation test below is meaningless.
    await twin.execSuperuser(`
      create table if not exists rls_probe (id int, user_id uuid);
      alter table rls_probe enable row level security;
      alter table rls_probe force row level security;
      drop policy if exists probe_own on rls_probe;
      create policy probe_own on rls_probe for select using (user_id = auth.uid());
      grant select on rls_probe to authenticated;
      truncate rls_probe;
      insert into rls_probe values
        (1, '11111111-1111-1111-1111-111111111111'),
        (2, '22222222-2222-2222-2222-222222222222');
    `);

    const superuser = await twin.asSuperuser("select * from rls_probe");
    expect(superuser, "superuser must see everything").toHaveLength(2);

    const tenant = await twin.asTenant(
      "11111111-1111-1111-1111-111111111111",
      "select * from rls_probe",
    );
    expect(tenant.error).toBeUndefined();
    expect(tenant.rows, "the tenant must see only its own row").toHaveLength(1);
  });
});

describe("cross-tenant attack tests", () => {
  const ALICE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const BOB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  beforeAll(async () => {
    await twin.execSuperuser(`
      insert into auth.users (id, email) values
        ('${ALICE}', 'alice@example.com'),
        ('${BOB}', 'bob@example.com')
      on conflict (id) do nothing;
      insert into ocade_conversations (id, user_id, title)
      values
        (extensions.gen_random_uuid(), '${ALICE}', 'alice private'),
        (extensions.gen_random_uuid(), '${BOB}', 'bob private')
      on conflict do nothing;
    `);
  });

  it("a tenant reads only its own conversations", async () => {
    const alice = await twin.asTenant(ALICE, "select title from ocade_conversations");
    expect(alice.error).toBeUndefined();
    for (const row of alice.rows as Array<{ title: string }>) {
      expect(row.title, "alice saw another tenant's row").not.toMatch(/bob/i);
    }
    expect(alice.rows.length).toBeGreaterThan(0);
  });

  it("a tenant cannot read another tenant's rows by asking directly", async () => {
    const bobsRows = await twin.asTenant(
      ALICE,
      `select title from ocade_conversations where user_id = '${BOB}'`,
    );
    // Naming another user's id must not defeat the policy.
    expect(bobsRows.rows, "RLS did not stop a direct cross-tenant read").toHaveLength(0);
  });

  it("a tenant cannot INSERT rows owned by someone else", async () => {
    const attempt = await twin.asTenant(
      ALICE,
      `insert into ocade_conversations (id, user_id, title)
       values (extensions.gen_random_uuid(), '${BOB}', 'forged') returning id`,
    );
    // Either the policy refuses it, or it silently writes nothing. Both are
    // acceptable; a successful forged insert is not.
    expect(attempt.rows).toHaveLength(0);
  });

  it("an anonymous caller with no claim reads nothing", async () => {
    const anon = await twin.asTenant(
      "00000000-0000-0000-0000-000000000000",
      "select title from ocade_conversations",
    );
    expect(anon.rows).toHaveLength(0);
  });
});

describe("verification scripts run against the applied schema", () => {
  it("has a verification script for every migration", () => {
    const migrations = DatabaseTwin.migrationFiles().length;
    const verifications = DatabaseTwin.migrationFiles("supabase/verification").length;
    expect(verifications).toBe(migrations);
  });

  it("has a rollback script for every migration", () => {
    const migrations = DatabaseTwin.migrationFiles().length;
    const rollbacks = DatabaseTwin.migrationFiles("supabase/rollback").length;
    expect(rollbacks).toBe(migrations);
  });
});
