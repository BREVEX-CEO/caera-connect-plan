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

  /* ------------------------------------------------------------ planting -- */
  /*
   * SEEDING A ROW IN AN ARBITRARY TABLE, WITHOUT A FIXTURE PER TABLE.
   *
   * An isolation test that skips the tables it could not seed proves nothing
   * about them while looking like it does — and the tables hardest to seed are
   * the interesting ones: messages, vault configuration, invoices, payment
   * events. Each of them refused a naive insert for one of four reasons, and
   * each reason has an answer the schema itself supplies:
   *
   *   a CHECK constraint listing allowed literals  -> read the constraint
   *   an enum type                                 -> read pg_enum
   *   a foreign key                                -> plant the parent first
   *   a row the signup trigger already created     -> use the one that exists
   *
   * So this reads the catalogue instead of guessing, and a table that still
   * cannot be planted is REPORTED rather than skipped quietly.
   */

  private plantCache = new Map<string, Record<string, unknown> | null>();

  /**
   * Literals a CHECK constraint will accept for this column.
   *
   * ONLY the `= ANY (ARRAY[…])` shape, which is what a choice column compiles
   * to. Reading literals out of any constraint that merely mentions the column
   * produced nonsense: `currency ~ '^[A-Z]{3}$'` yielded the regex itself as a
   * "permitted value", and the insert then failed the constraint it was
   * supposed to satisfy.
   */
  private async allowedLiterals(table: string, column: string): Promise<string[]> {
    const rows = await this.asSuperuser<{ def: string }>(
      `select pg_get_constraintdef(oid) as def
         from pg_constraint
        where contype = 'c'
          and conrelid = 'public.${table}'::regclass`,
    );
    const out: string[] = [];
    const shape = new RegExp(
      `\\(?\\b${column}\\b\\)?\\s*=\\s*ANY\\s*\\(\\s*\\(?ARRAY\\[([^\\]]*)\\]`,
      "i",
    );
    for (const { def } of rows) {
      const match = shape.exec(def);
      if (!match) continue;
      for (const literal of match[1].matchAll(/'([^']*)'/g)) out.push(literal[1]);
    }
    return out;
  }

  /**
   * A string that satisfies a simple regex CHECK, when the column has one.
   *
   * Three of the billing tables constrain a currency column with
   * `~ '^[A-Z]{3}$'`, which no generic filler will ever hit by accident. Only
   * anchored character-class-with-length patterns are handled: anything more
   * involved returns null and the table is reported as unplanted rather than
   * seeded with something that quietly fails a different constraint.
   */
  private async regexSample(table: string, column: string): Promise<string | null> {
    const rows = await this.asSuperuser<{ def: string }>(
      `select pg_get_constraintdef(oid) as def
         from pg_constraint
        where contype = 'c' and conrelid = 'public.${table}'::regclass`,
    );
    const shape = new RegExp(`\\b${column}\\b\\s*~\\s*'([^']+)'`, "i");
    for (const { def } of rows) {
      const match = shape.exec(def);
      if (!match) continue;
      const pattern = /^\^\[([^\]]+)\]\{(\d+)(?:,\d+)?\}\$$/.exec(match[1]);
      if (!pattern) return null;
      const set = pattern[1];
      const length = Number(pattern[2]);
      // First literal character of the class, or the first of a range.
      const sample = /A-Z/.test(set) ? "A" : /a-z/.test(set) ? "a" : /0-9/.test(set) ? "0" : set[0];
      return sample.repeat(length);
    }
    return null;
  }

  /** Values an enum type accepts. */
  private async enumValues(typeName: string): Promise<string[]> {
    const rows = await this.asSuperuser<{ enumlabel: string }>(
      `select e.enumlabel from pg_enum e
         join pg_type t on t.oid = e.enumtypid
        where t.typname = '${typeName}' order by e.enumsortorder`,
    );
    return rows.map((r) => r.enumlabel);
  }

  /**
   * Plant one row owned by `ownerId`, or return the one already there.
   * `depth` bounds foreign-key recursion so a cycle cannot hang the run.
   */
  async plantRow(
    table: string,
    ownerId: string,
    depth = 0,
  ): Promise<Record<string, unknown> | null> {
    const key = `${table}:${ownerId}`;
    if (this.plantCache.has(key)) return this.plantCache.get(key) ?? null;
    if (depth > 4) return null;

    const columns = await this.asSuperuser<{
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      has_default: boolean;
    }>(
      `select column_name, data_type, udt_name, is_nullable,
              (column_default is not null) as has_default
         from information_schema.columns
        where table_schema = 'public' and table_name = '${table}'
        order by ordinal_position`,
    );
    const names = columns.map((c) => c.column_name);
    const owner = names.includes("user_id") ? "user_id" : "id";

    // The signup trigger creates profiles and settings rows; use those.
    const existing = await this.asSuperuser<Record<string, unknown>>(
      `select * from public.${table} where ${owner} = '${ownerId}' limit 1`,
    );
    if (existing[0]) {
      this.plantCache.set(key, existing[0]);
      return existing[0];
    }

    const foreignKeys = await this.asSuperuser<{ col: string; ref: string }>(
      `select att.attname as col, cl.relname as ref
         from pg_constraint c
         join pg_class cl on cl.oid = c.confrelid
         join unnest(c.conkey) as k(attnum) on true
         join pg_attribute att on att.attrelid = c.conrelid and att.attnum = k.attnum
        where c.contype = 'f' and c.conrelid = 'public.${table}'::regclass`,
    );
    const fkFor = new Map(foreignKeys.map((f) => [f.col, f.ref]));

    const insertCols: string[] = [owner];
    const insertVals: string[] = [`'${ownerId}'`];
    /*
     * Several tables constrain one timestamp to be after another
     * (`expires_at > started_at`, `finished_at >= started_at`). Giving every
     * timestamp `now()` fails those. Staggering by column order satisfies them,
     * because in every such table the earlier instant is declared first.
     */
    let timestampsUsed = 0;

    for (const column of columns) {
      if (column.column_name === owner) continue;
      if (column.is_nullable === "YES" || column.has_default) continue;

      const referenced = fkFor.get(column.column_name);
      if (referenced && referenced !== "users") {
        const parent = await this.plantRow(referenced, ownerId, depth + 1);
        if (!parent) {
          this.plantCache.set(key, null);
          return null;
        }
        insertCols.push(column.column_name);
        insertVals.push(`'${String(parent.id ?? parent[owner])}'`);
        continue;
      }
      if (referenced === "users") {
        insertCols.push(column.column_name);
        insertVals.push(`'${ownerId}'`);
        continue;
      }

      const allowed = await this.allowedLiterals(table, column.column_name);
      if (allowed.length) {
        /*
         * The LAST permitted value, not the first. Several tables carry a
         * second constraint of the form `status <> 'succeeded' OR (…)`, where
         * the first listed value is the one with extra obligations attached.
         * The last is the ordinary case in every choice list here.
         */
        insertCols.push(column.column_name);
        insertVals.push(`'${allowed[allowed.length - 1]}'`);
        continue;
      }
      const sample = await this.regexSample(table, column.column_name);
      if (sample !== null) {
        insertCols.push(column.column_name);
        insertVals.push(`'${sample}'`);
        continue;
      }
      if (column.data_type === "USER-DEFINED") {
        const values = await this.enumValues(column.udt_name);
        if (!values.length) {
          this.plantCache.set(key, null);
          return null;
        }
        insertCols.push(column.column_name);
        insertVals.push(`'${values[0]}'::public.${column.udt_name}`);
        continue;
      }

      insertCols.push(column.column_name);
      insertVals.push(DatabaseTwin.filler(column.data_type, ownerId, timestampsUsed));
      if (column.data_type.startsWith("timestamp")) timestampsUsed += 1;
    }

    try {
      const inserted = await this.asSuperuser<Record<string, unknown>>(
        `insert into public.${table} (${insertCols.join(", ")})
         values (${insertVals.join(", ")}) returning *`,
      );
      this.plantCache.set(key, inserted[0] ?? null);
      return inserted[0] ?? null;
    } catch {
      this.plantCache.set(key, null);
      return null;
    }
  }

  /** A value Postgres accepts for a column the caller does not care about. */
  private static filler(dataType: string, ownerId: string, nthTimestamp = 0): string {
    switch (dataType) {
      case "uuid":
        return "extensions.gen_random_uuid()";
      case "text":
      case "character varying":
        return "'isolation probe'";
      case "boolean":
        return "false";
      case "integer":
      case "bigint":
      case "smallint":
      case "numeric":
      case "double precision":
        return "0";
      case "jsonb":
      case "json":
        return `'{}'::jsonb`;
      case "timestamp with time zone":
      case "timestamp without time zone":
        // Never `now()` exactly: a column defaulted to now() is often the
        // earlier side of a `later > earlier` check, and an equal instant
        // fails a strict comparison.
        return `now() + interval '${nthTimestamp + 1} day'`;
      case "date":
        return "current_date";
      case "ARRAY":
        return "'{}'";
      case "bytea":
        return `'\\x00'::bytea`;
      default:
        return `'${ownerId}'`;
    }
  }
}
