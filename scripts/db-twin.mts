/**
 * HWE-30 — local database and identity twin (P16).
 *
 * Every migration in this repository ships with a verification script and a
 * rollback script — 33 of each — and NONE had ever been applied to anything.
 * The SQL tests could only read the files and match strings, because there was
 * no database to run them against and no Docker on this machine.
 *
 * PGlite is real PostgreSQL (18.3) compiled to WebAssembly, so the migrations
 * execute against an actual Postgres parser and planner rather than a mock. It
 * needs no service, no container and no administrator rights.
 *
 * THE PART THAT DECIDES WHETHER THIS IS WORTH ANYTHING
 * ---------------------------------------------------
 * PGlite connects as a SUPERUSER, and Postgres superusers BYPASS row-level
 * security. A cross-tenant test run as superuser would pass no matter how
 * broken the policies were — it would be theatre. So the twin creates the
 * `anon` and `authenticated` roles Supabase uses, and every tenant-isolation
 * query runs under `SET ROLE authenticated`. Verified: as superuser a probe
 * table returns both rows; as `authenticated` it returns only the caller's.
 *
 * WHAT THIS IS NOT: it is not the production database. It has no Supabase
 * GoTrue, no realtime, no storage, and no production data. It proves the SQL
 * and the policies are correct; it does not prove a deployment succeeded.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface TwinOptions {
  /** Apply only the first N migrations, for rollback rehearsal. */
  limit?: number;
}

export interface AppliedMigration {
  file: string;
  ok: boolean;
  error?: string;
  ms: number;
}

/**
 * The Supabase surface the migrations depend on.
 *
 * Reproduced faithfully enough that the real policies run unchanged: `auth.uid()`
 * reads the same JWT claim setting PostgREST sets, and the same two roles exist.
 * Anything the migrations reference and this omits shows up immediately as a
 * migration failure rather than as a silent difference.
 */
const SUPABASE_SHIM = `
create schema if not exists auth;
create schema if not exists extensions;

-- extensions.gen_random_uuid() is Supabase's schema-qualified alias. The
-- migrations create pgcrypto themselves (migration 1, line 3) and PGlite ships
-- the real contrib module, so migrations run UNMODIFIED: no substitution and
-- no divergence between what runs here and what would run in production.
create or replace function extensions.gen_random_uuid() returns uuid
  language sql volatile as $$ select gen_random_uuid() $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- The columns real Supabase auth.users exposes that migrations actually touch.
-- A migration installs a handle_new_user trigger reading raw_user_meta_data;
-- omitting it made the trigger fail, which is the twin correctly reporting an
-- inaccurate shim rather than a defect in the migration.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  -- Real Supabase auth.users carries a phone column (GoTrue phone auth). A
  -- migration back-fills public.profiles.phone from it, so omitting it here
  -- made the twin reject a migration that is correct against the hosted
  -- database.
  phone text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  encrypted_password text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reads the exact setting PostgREST populates from the JWT.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create or replace function auth.email() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;

-- Supabase Storage. Reproduce the object-policy columns plus the private
-- bucket fields the provisioning migration owns and verifies.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb
);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

grant usage on schema auth, extensions, public, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth, storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
`;

export class DatabaseTwin {
  private constructor(readonly db: PGlite) {}

  static async create(): Promise<DatabaseTwin> {
    // Real contrib pgcrypto, so migration 1's `CREATE EXTENSION "pgcrypto"`
    // succeeds exactly as written rather than being stripped or stubbed.
    const db = await PGlite.create({ extensions: { pgcrypto, pg_trgm } });
    await db.exec(SUPABASE_SHIM);
    return new DatabaseTwin(db);
  }

  /** Multi-statement superuser SQL, for setup that `query()` cannot take. */
  async execSuperuser(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  /** Migration files in the order APPLY_ORDER.md declares (filename order). */
  static migrationFiles(dir = "supabase/migrations"): string[] {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  }

  /**
   * Apply migrations in declared order, stopping at the first failure.
   *
   * Stopping matters: later migrations reference earlier tables, so continuing
   * past a failure produces a cascade of errors that hides the real one.
   */
  async applyMigrations(opts: TwinOptions = {}): Promise<AppliedMigration[]> {
    const files = DatabaseTwin.migrationFiles();
    const chosen = opts.limit ? files.slice(0, opts.limit) : files;
    const out: AppliedMigration[] = [];
    for (const f of chosen) {
      const sql = readFileSync(join("supabase/migrations", f), "utf8");
      const t0 = Date.now();
      try {
        await this.db.exec(sql);
        out.push({ file: f, ok: true, ms: Date.now() - t0 });
      } catch (e) {
        out.push({
          file: f,
          ok: false,
          error: (e as Error).message?.slice(0, 300),
          ms: Date.now() - t0,
        });
        break;
      }
    }
    return out;
  }

  /** Run one SQL script (verification or rollback) and report honestly. */
  async runScript(dir: string, file: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.db.exec(readFileSync(join(dir, file), "utf8"));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message?.slice(0, 300) };
    }
  }

  /**
   * Run a query AS A TENANT — never as superuser.
   *
   * This is the whole point of the twin. `SET ROLE authenticated` is what makes
   * row-level security actually apply; without it Postgres bypasses every
   * policy and a cross-tenant test proves nothing.
   */
  async asTenant<T = Record<string, unknown>>(
    userId: string,
    sql: string,
  ): Promise<{ rows: T[]; error?: string }> {
    try {
      await this.db.exec(`set role authenticated;`);
      await this.db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
      await this.db.query(`select set_config('request.jwt.claim.role', 'authenticated', false)`);
      const res = await this.db.query<T>(sql);
      return { rows: res.rows };
    } catch (e) {
      return { rows: [], error: (e as Error).message?.slice(0, 300) };
    } finally {
      await this.db.exec(`reset role;`);
    }
  }

  /** Superuser query, for setup and for proving the tenant path differs. */
  async asSuperuser<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const res = await this.db.query<T>(sql);
    return res.rows;
  }

  /** Tables that exist, so the twin can be inspected rather than trusted. */
  async tables(): Promise<string[]> {
    const rows = await this.asSuperuser<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' order by tablename`,
    );
    return rows.map((r) => r.tablename);
  }

  /** Tables with RLS enabled — a table without it is the defect to find. */
  async rlsEnabledTables(): Promise<string[]> {
    const rows = await this.asSuperuser<{ relname: string }>(
      `select c.relname from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        order by c.relname`,
    );
    return rows.map((r) => r.relname);
  }

  async policyCount(): Promise<number> {
    const rows = await this.asSuperuser<{ n: number }>(
      `select count(*)::int as n from pg_policies where schemaname = 'public'`,
    );
    return Number(rows[0]?.n ?? 0);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
