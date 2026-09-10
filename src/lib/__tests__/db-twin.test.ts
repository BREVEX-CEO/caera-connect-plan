import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  callerScopedFunctions,
  TOKEN_AUTHORIZED_FUNCTIONS,
} from "@/lib/security/caller-scoped-functions";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";

/**
 * DATABASE AND IDENTITY TWIN (P16 / HWE-30).
 *
 * 33 migrations, 33 verification scripts and 33 rollback scripts had never been
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
  /**
   * A CENSUS, not a magic number.
   *
   * The literal pins the size of the on-disk migration corpus so that a
   * deletion, or a migration added but never committed, breaks the build. It is
   * meant to be updated — by one — when a migration is genuinely added, and the
   * two parity tests at the bottom of this file then force the paired
   * verification and rollback scripts to arrive with it.
   *
   * Last raised for the PLAN.md Phase 2 move to one persistent authority:
   * a client key that makes message sync idempotent, side conversations
   * anchored in the messages table, and project files and folders that used to
   * live in `localStorage`.
   * Loosening this to a range would defeat the point: an exact count is what
   * catches a migration going missing.
   */
  it("finds all 94 migrations", () => {
    expect(DatabaseTwin.migrationFiles()).toHaveLength(94);
  });

  /**
   * DEFECT DB-01, FIXED — and this is the test that proves it.
   *
   * `20260721153321…sql` was a single unconditional statement:
   *   COMMENT ON TABLE public.ficia_time_entries IS '…';
   *
   * No migration in this repository creates `ficia_time_entries`, so a fresh
   * database failed there and every later migration never ran. This suite
   * carried an explicit exception for it and asserted the failure, precisely so
   * it could not be forgotten.
   *
   * It was NOT fixed by reconstructing the table from the generated Supabase
   * types: those carry columns but no RLS policies, and a multi-tenant
   * timesheet table recreated without its policies is a data-exposure bug
   * dressed up as a fix. That reasoning still stands.
   *
   * It is fixed instead by making the comment conditional. FICIA has been
   * removed from the product, so this repository has no reason to require the
   * table — only to leave the comment untouched where it already applies. On
   * the hosted database the statement behaves exactly as before; on a fresh one
   * it is a no-op.
   *
   * So the exception is gone, and the assertion is now the strong one: EVERY
   * migration applies, in order, against real PostgreSQL.
   */
  it("applies every migration against real PostgreSQL, with no exceptions", () => {
    const failed = applied.filter((a) => !a.ok);
    expect(
      failed.map((f) => `${f.file}: ${f.error}`),
      "a migration failed against real PostgreSQL",
    ).toEqual([]);
    expect(applied).toHaveLength(94);
  });

  it("rebuilds the whole schema from zero, including the tables defined after the old break", async () => {
    const tables = await twin.tables();
    expect(tables.length).toBeGreaterThan(40);
    /*
     * The four OCADE tables below are all defined AFTER the migration that used
     * to fail, so before the fix not one of them could exist in a from-scratch
     * build. They are the difference between "the migration set nearly works"
     * and "the migration set rebuilds the database", and they are the same
     * tables the chat endpoint queries.
     */
    for (const t of [
      "ocade_conversations",
      "ocade_messages",
      "ocade_projects",
      "ocade_memory",
      "ocade_outputs",
      "ocade_automations",
    ]) {
      expect(tables, `${t} missing after migration`).toContain(t);
    }
  });

  it("does not create the FICIA table whose absence caused the defect", async () => {
    // The fix must not have quietly reintroduced the table — that was the
    // rejected option, and it would ship timesheet data with no RLS.
    const tables = await twin.tables();
    expect(tables).not.toContain("ficia_time_entries");
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

describe("a SECURITY DEFINER function reachable from a browser binds its caller", () => {
  /*
   * WHY THIS IS THE DANGEROUS COMBINATION.
   *
   * `SECURITY DEFINER` runs as the function's owner, which means row-level
   * security does not apply inside it. Granting EXECUTE on such a function to
   * `authenticated` therefore hands every signed-in browser a door around RLS
   * — and PostgREST exposes it at `/rest/v1/rpc/<name>`, so it is one fetch
   * away from any page on the internet.
   *
   * That is FINE when the function scopes itself to the caller with
   * `auth.uid()`. It is a cross-account hole when it does not: an id parameter
   * naming somebody else's row is then simply obeyed.
   *
   * Supabase's own advisor flags the combination and stops there, because it
   * cannot tell a correctly-scoped function from a dangerous one. This is the
   * half it cannot check, and it is checked here rather than by reading fifteen
   * function bodies once and hoping the sixteenth is written the same way.
   *
   * A function that genuinely must not be caller-scoped belongs in the
   * exemption list below WITH ITS REASON, or — better — should not be granted
   * to a browser role at all.
   */
  const NOT_CALLER_SCOPED: Record<string, string> = {
    /*
     * No entries. Every browser-reachable definer function in this schema is
     * scoped to its caller, and the empty list is the claim: adding a name here
     * is asserting that a signed-in stranger may reach rows that are not
     * theirs, which needs a reason nobody has yet had.
     */
  };

  it("finds the browser-reachable definer functions at all", async () => {
    // A query that matches nothing would pass the assertion below for the
    // worst possible reason.
    const reachable = await twin.asSuperuser<{ proname: string }>(`
      select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
             or has_function_privilege('anon', p.oid, 'EXECUTE'))
    `);
    expect(reachable.length).toBeGreaterThan(5);
  });

  it("scopes every one of them to auth.uid()", async () => {
    const definitions = new Map(
      (
        await twin.asSuperuser<{ proname: string; definition: string }>(`
          select p.proname, pg_get_functiondef(p.oid) as definition
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.prokind = 'f'
        `)
      ).map((row) => [row.proname, row.definition] as const),
    );
    const scoped = callerScopedFunctions(definitions);

    const reachable = await twin.asSuperuser<{ proname: string }>(`
      select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
             or has_function_privilege('anon', p.oid, 'EXECUTE'))
      order by p.proname
    `);
    const offenders = reachable
      .map((row) => row.proname)
      .filter(
        (name) =>
          !scoped.has(name) &&
          !(name in NOT_CALLER_SCOPED) &&
          !TOKEN_AUTHORIZED_FUNCTIONS.has(name),
      );

    /*
     * If this fails, a function that bypasses RLS became callable from a
     * browser without binding the caller, directly or through a helper. The fix
     * is to scope it or to revoke EXECUTE from `authenticated` and `anon` —
     * NOT to add it to the exemption list, unless a stranger reaching those
     * rows is genuinely intended.
     */
    expect(offenders, "browser-reachable definer functions that ignore the caller").toEqual([]);
  });

  it("exposes none of them to callers with no account at all", async () => {
    /*
     * `anon` is every visitor, signed in or not. A definer function reachable
     * anonymously is reachable by the whole internet, and `auth.uid()` is NULL
     * there — so even a correctly-scoped one is either useless or a leak.
     *
     * The one exception class is a function opened by a CAPABILITY rather than
     * by identity: a shared conversation link is meant to work for somebody with
     * no account, which is what sharing one means. Those are not waved through
     * here — `security-definer.test.ts` asks them a harder set of questions
     * (they must take a token, filter on it, return no account identifier, and
     * answer nothing for a token nobody issued) — but the blanket "no anonymous
     * definer function" rule cannot be the one that judges them.
     */
    const anonymous = await twin.asSuperuser<{ proname: string }>(`
      select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and has_function_privilege('anon', p.oid, 'EXECUTE')
      order by p.proname
    `);
    expect(
      anonymous.map((row) => row.proname).filter((name) => !TOKEN_AUTHORIZED_FUNCTIONS.has(name)),
    ).toEqual([]);
  });

  it("keeps the exemption list honest", async () => {
    // An exemption for a function that no longer exists is dead weight that
    // would silently cover a future function of the same name.
    const existing = await twin.asSuperuser<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    `);
    const names = new Set(existing.map((row) => row.proname));
    expect(Object.keys(NOT_CALLER_SCOPED).filter((name) => !names.has(name))).toEqual([]);
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

describe("deleting an attachment cannot orphan its bytes", () => {
  /**
   * DEFECT DB-03, FIXED.
   *
   * `msg_attachments.storage_path` is the only record of where an uploaded
   * file's bytes live, and the table cascades from BOTH `msg_messages` and
   * `msg_threads`. Deleting a message therefore discarded the path while the
   * object stayed in the bucket — unreachable, still billed, still containing
   * whatever the user uploaded. Someone who deleted a document to make it go
   * away was told it was gone when it was not.
   *
   * Cascade is the hard case precisely because the application code that would
   * normally clean up never runs: Postgres removes the row directly. So the
   * fix has to live in the database, and this test exercises the cascade path
   * rather than a direct delete.
   */
  const OWNER = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  it("records a tombstone when a cascade removes the attachment row", async () => {
    await twin.execSuperuser(`
      insert into auth.users (id, email)
      values ('${OWNER}', 'owner@example.com') on conflict (id) do nothing;
    `);
    // kind='private' avoids the CHECK that demands a tenant_id.
    const thread = await twin.asSuperuser<{ id: string }>(`
      insert into msg_threads (kind, created_by, name)
      values ('private', '${OWNER}', 'twin thread') returning id;
    `);
    const message = await twin.asSuperuser<{ id: string }>(`
      insert into msg_messages (thread_id, author_id, body)
      values ('${thread[0].id}', '${OWNER}', 'has an attachment') returning id;
    `);
    const path = `twin/${message[0].id}/secret.pdf`;
    await twin.execSuperuser(`
      insert into msg_attachments
        (message_id, thread_id, uploaded_by, file_name, mime, size_bytes, storage_path)
      values ('${message[0].id}', '${thread[0].id}', '${OWNER}',
              'secret.pdf', 'application/pdf', 128, '${path}');
    `);

    // Delete the MESSAGE. Nothing touches the attachment directly.
    await twin.execSuperuser(`delete from msg_messages where id = '${message[0].id}';`);

    const rows = await twin.asSuperuser<{ storage_path: string; purged_at: string | null }>(
      `select storage_path, purged_at from storage_tombstones where storage_path = '${path}';`,
    );
    expect(rows, "the cascade lost the storage path; those bytes are unreachable").toHaveLength(1);
    expect(rows[0].purged_at, "a fresh tombstone must be pending, not pre-purged").toBeNull();
  });

  it("does not let a tenant queue a deletion of someone else's file", async () => {
    /*
     * The table is a "delete these bytes" queue, so tenant write access to it
     * is tenant write access to everyone's storage: name another user's path
     * and the sweeper removes their file. Read-only for owners, writes only by
     * the definer trigger and the service role.
     */
    const forged = await twin.asTenant(
      OWNER,
      `insert into storage_tombstones (bucket, storage_path, owner_id)
       values ('message-attachments', 'victim/private.pdf', '${OWNER}') returning id`,
    );
    expect(forged.rows, "a tenant queued a storage deletion").toHaveLength(0);
  });

  it("shows an owner only their own outstanding deletions", async () => {
    const other = await twin.asTenant(
      "dddddddd-dddd-dddd-dddd-dddddddddddd",
      "select storage_path from storage_tombstones",
    );
    expect(other.rows, "a tombstone leaked across tenants").toHaveLength(0);
  });
});

describe("payment state is transactional and tenant-scoped", () => {
  const ALICE = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
  const BOB = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  const SUBSCRIPTION = "sub_db_twin_atomic";

  beforeAll(async () => {
    await twin.execSuperuser(`
      insert into auth.users (id, email) values
        ('${ALICE}', 'payment-alice@example.com'),
        ('${BOB}', 'payment-bob@example.com')
      on conflict (id) do nothing;
    `);
  });

  it("claims and changes an entitlement in the same PostgreSQL transaction", async () => {
    const result = await twin.asSuperuser<{ result: string }>(`
      select public.apply_payment_webhook_event(
        'evt_db_twin_create', 'subscription.created', '2026-08-23T06:00:00Z',
        'sandbox', '${SUBSCRIPTION}', 'upsert', null, '${ALICE}',
        '${SUBSCRIPTION}', 'ctm_db_twin', 'pro_db_twin', 'pri_db_twin',
        'active', '2026-08-23T06:00:00Z', '2026-09-23T06:00:00Z',
        false, 'subscription', false
      ) as result;
    `);
    expect(result[0].result).toBe("upsert");

    const state = await twin.asSuperuser<{ status: string; outcome: string }>(`
      select s.status, e.outcome
      from subscriptions s
      join payment_webhook_events e on e.entity_id = s.paddle_subscription_id
      where s.paddle_subscription_id = '${SUBSCRIPTION}'
        and e.event_id = 'evt_db_twin_create';
    `);
    expect(state).toEqual([{ status: "active", outcome: "upsert" }]);
  });

  it("deduplicates retries and refuses an older event", async () => {
    const duplicate = await twin.asSuperuser<{ result: string }>(`
      select public.apply_payment_webhook_event(
        'evt_db_twin_create', 'subscription.created', '2026-08-23T06:00:00Z',
        'sandbox', '${SUBSCRIPTION}', 'ignore', 'retry', null, null, null,
        null, null, null, null, null, null, null, false
      ) as result;
    `);
    expect(duplicate[0].result).toBe("duplicate");

    const stale = await twin.asSuperuser<{ result: string }>(`
      select public.apply_payment_webhook_event(
        'evt_db_twin_stale', 'subscription.canceled', '2026-08-22T06:00:00Z',
        'sandbox', '${SUBSCRIPTION}', 'update', null, null, '${SUBSCRIPTION}',
        null, null, null, 'canceled', null, null, false, null, false
      ) as result;
    `);
    expect(stale[0].result).toBe("ignore");
    const state = await twin.asSuperuser<{ status: string; reason: string }>(`
      select s.status, e.reason
      from subscriptions s, payment_webhook_events e
      where s.paddle_subscription_id = '${SUBSCRIPTION}'
        and e.event_id = 'evt_db_twin_stale';
    `);
    expect(state).toEqual([{ status: "active", reason: "target_missing_stale_or_terminal" }]);
  });

  it("rolls the event claim back when its entitlement change is invalid", async () => {
    await expect(
      twin.asSuperuser(`
        select public.apply_payment_webhook_event(
          'evt_db_twin_invalid', 'subscription.created', now(), 'sandbox',
          'sub_invalid', 'upsert', null, '${ALICE}', 'sub_invalid', null,
          null, null, 'active', null, null, false, 'subscription', false
        );
      `),
    ).rejects.toThrow(/missing required state/i);
    const rows = await twin.asSuperuser(`
      select event_id from payment_webhook_events
      where event_id = 'evt_db_twin_invalid';
    `);
    expect(rows, "a failed entitlement write left a poisoned idempotency claim").toEqual([]);
  });

  it("does not reveal another tenant's paid state through the helper", async () => {
    await twin.execSuperuser(`
      insert into subscriptions (
        user_id, paddle_subscription_id, paddle_customer_id, product_id,
        price_id, status, current_period_end, environment, kind
      ) values (
        '${BOB}', 'sub_db_twin_bob', 'ctm_bob', 'pro_bob', 'pri_bob',
        'active', now() + interval '1 day', 'sandbox', 'subscription'
      ) on conflict (paddle_subscription_id) do nothing;
    `);
    const probe = await twin.asTenant<{ own: boolean; other: boolean }>(
      ALICE,
      `select
         public.has_active_subscription('${ALICE}', 'sandbox') as own,
         public.has_active_subscription('${BOB}', 'sandbox') as other`,
    );
    expect(probe.error).toBeUndefined();
    expect(probe.rows).toEqual([{ own: true, other: false }]);
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

describe("verification and rollback are executed, not merely present", () => {
  /**
   * WHAT THIS FOUND. Until this ran, the 34 rollback scripts had never been
   * executed against anything. Eleven of them failed, and two carried real
   * defects that would have surfaced at the worst possible moment — halfway
   * through undoing a bad deploy:
   *
   *   - `20260721141946` dropped a type while `feature_flags.stage` still used
   *     it, because the rollback never removed the columns its migration added.
   *   - `20260721133830` was worse: its migration RENAMES `audit_log` to
   *     `compliance_audit_log`, adds three columns to it, adds one to `devices`
   *     and converts `user_settings.main_purpose` from TEXT to an enum. The
   *     rollback undid none of that, so it both failed AND left the schema
   *     half-reversed.
   *
   * Each failure aborted its transaction, taking every later rollback with it —
   * which is why a single defect presented as eleven.
   *
   * A rollback nobody has run is a plan, not a safety net.
   */

  it("runs every verification script immediately after its own migration", async () => {
    /*
     * Interleaved, the way a deploy does it. Running them all against the FINAL
     * schema is a different and wrong test: an early script checks for
     * `audit_log`, which a later migration renames — that is the schema being
     * correct, not the script being stale.
     */
    const local = await DatabaseTwin.create();
    try {
      const migrations = DatabaseTwin.migrationFiles();
      const haveVerify = new Set(DatabaseTwin.migrationFiles("supabase/verification"));
      const failures: string[] = [];

      for (const file of migrations) {
        const applied = await local.runScript("supabase/migrations", file);
        if (!applied.ok) {
          failures.push(`apply ${file}: ${applied.error}`);
          break;
        }
        const verify = file.replace(/\.sql$/, "_verify.sql");
        if (!haveVerify.has(verify)) {
          failures.push(`${file} has no verification script`);
          continue;
        }
        const checked = await local.runScript("supabase/verification", verify);
        if (!checked.ok) failures.push(`verify ${verify}: ${checked.error}`);
      }

      expect(failures.slice(0, 5), "a migration or its verification failed").toEqual([]);
    } finally {
      await local.close();
    }
  }, 300_000);

  it("rolls every migration back, in reverse, against the full schema", async () => {
    /*
     * Reverse order against the FULLY migrated database is the only order a
     * real rollback can take. A script that only works against the schema of
     * its own migration is not a rollback.
     */
    const local = await DatabaseTwin.create();
    try {
      const applied = await local.applyMigrations();
      expect(applied.filter((a) => !a.ok)).toEqual([]);

      const failures: string[] = [];
      for (const file of DatabaseTwin.migrationFiles("supabase/rollback").reverse()) {
        const r = await local.runScript("supabase/rollback", file);
        if (!r.ok) failures.push(`${file}: ${(r.error ?? "").split("\n")[0]}`);
      }
      expect(failures.slice(0, 5), "a rollback failed against the real schema").toEqual([]);
    } finally {
      await local.close();
    }
  }, 300_000);

  it("has no byte-order mark in any SQL file", async () => {
    /*
     * A UTF-8 BOM in `20260803172048_..._rollback.sql` made PostgreSQL report
     * a syntax error pointing at an INVISIBLE character — the least debuggable
     * failure message available. Editors add these silently on Windows.
     *
     * The offending bytes are checked numerically rather than by quoting the
     * character, since pasting a real BOM into this file would trip the
     * irregular-whitespace lint rule, which is how it got here in the first
     * place.
     */
    const { readFileSync } = await import("node:fs");
    const offenders: string[] = [];
    for (const dir of ["supabase/migrations", "supabase/verification", "supabase/rollback"]) {
      for (const file of DatabaseTwin.migrationFiles(dir)) {
        const bytes = readFileSync(`${dir}/${file}`);
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
          offenders.push(`${dir}/${file}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
