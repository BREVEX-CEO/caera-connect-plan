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

/*
 * SUPABASE'S DEFAULT PRIVILEGES, WHICH ARE PART OF THE ENVIRONMENT.
 *
 * A Supabase project ships with ALTER DEFAULT PRIVILEGES IN SCHEMA public
 * GRANT ALL ON TABLES / SEQUENCES / FUNCTIONS. Every table a migration creates
 * is therefore born with INSERT, UPDATE, DELETE and TRUNCATE granted DIRECTLY
 * to authenticated, and every function with EXECUTE.
 *
 * THE GRANTEE LIST IS TAKEN FROM THE REAL PROJECT, NOT GUESSED. Two default-ACL
 * entries exist there: supabase_admin's includes anon, and postgres's does not.
 * Migrations run as postgres, so postgres's is the one that applies — and
 * copying supabase_admin's instead would make the twin fail migrations for an
 * anon grant production never makes.
 *
 * WITHOUT THIS, THE TWIN LIED IN THE SAFE DIRECTION. The organizations
 * migration was written so that authenticated may only read, with every
 * mutation behind a guarded function. Its suite asserted exactly that and
 * passed here — and on the real project all six tables had every write grant,
 * and the audit writer was callable by any signed-in browser, because
 * REVOKE ... FROM PUBLIC does not remove a grant made directly to a role.
 * Row-level security still refused the writes, so nothing was open; but the
 * schema said one thing locally and another in production, and the whole point
 * of the twin is that it does not.
 *
 * Reproducing it means a migration that forgets the explicit revoke now fails
 * here, before it is applied to anything.
 */
alter default privileges in schema public
  grant all on tables to authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;

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

/*
 * Real authenticated sessions.
 *
 * Shaped like Supabase's own auth.sessions, including the two details OCADE's
 * session authority actually depends on:
 *
 *   - refreshed_at is timestamp WITHOUT a zone in the real schema, which is
 *     why the session listing converts it explicitly. Declaring it as
 *     timestamptz here would let a conversion bug pass the twin and misreport
 *     every session's age by the server's UTC offset in production.
 *
 *   - refresh_tokens and mfa_amr_claims reference it ON DELETE CASCADE, so
 *     deleting a session row genuinely revokes it. Without the cascade the twin
 *     would report a revocation as working while leaving the refresh token
 *     alive — the failure that matters most here.
 */
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  factor_id uuid,
  aal text default 'aal1',
  not_after timestamptz,
  refreshed_at timestamp,
  user_agent text,
  ip inet,
  tag text
);

create table if not exists auth.refresh_tokens (
  id bigserial primary key,
  session_id uuid references auth.sessions(id) on delete cascade,
  token text,
  user_id text,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists auth.mfa_amr_claims (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references auth.sessions(id) on delete cascade,
  authentication_method text not null,
  created_at timestamptz not null default now()
);

/*
 * Enrolled second factors.
 *
 * Present because "AAL2 for enrolled users" is not a property of the token
 * alone: a session at aal1 is a refusal only when the ACCOUNT has a verified
 * factor, and that fact lives here. A twin without this table can only prove
 * the lenient half of the rule, which is the half that does not protect
 * anybody.
 *
 * The status column carries Supabase's own two values. An unverified
 * enrollment is one
 * somebody began and abandoned, and counting it would let an account lower
 * its own bar by starting a setup it never finishes.
 */
create table if not exists auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friendly_name text,
  factor_type text not null default 'totp',
  status text not null default 'unverified' check (status in ('unverified', 'verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reads the exact setting PostgREST populates from the JWT.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

/*
 * The WHOLE claim set, which is a different thing from the three claims above.
 *
 * auth.uid() reads one flattened setting; aal and amr are only reachable
 * from the claims object, and amr is a nested array — one entry per proof of
 * identity, each carrying the second it happened. Supabase defines this
 * function exactly this way, reading whichever of the two settings the
 * deployment's PostgREST populates, and a rule about how recently somebody
 * proved who they are cannot be written without it.
 */
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb
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

/**
 * How strongly, and how recently, a tenant query's session proved who it is.
 *
 * Defaults describe the ordinary case a test means when it says nothing: one
 * factor, proved a moment ago. That keeps every existing `asTenant` call
 * meaning what it meant before this existed, and makes each assurance test say
 * out loud which of the two properties it is varying.
 */
export interface TenantSession {
  /** The token's assurance level. `aal2` means a second factor was answered. */
  aal?: "aal1" | "aal2";
  /** How long ago this session last proved anything, in seconds. */
  provedSecondsAgo?: number;
  /** Suppress the authentication-methods list entirely, as some tokens do. */
  omitAmr?: boolean;
}

function claimsFor(userId: string, session: TenantSession): Record<string, unknown> {
  const claims: Record<string, unknown> = {
    sub: userId,
    role: "authenticated",
    aal: session.aal ?? "aal1",
  };
  if (!session.omitAmr) {
    // Supabase reports these in SECONDS, which is the detail a millisecond
    // reading gets wrong by a factor of a thousand and silently.
    const proved = Math.floor(Date.now() / 1000) - (session.provedSecondsAgo ?? 0);
    claims["amr"] = [{ method: "password", timestamp: proved }];
  }
  return claims;
}

/**
 * A refusal, in the two forms a caller needs.
 *
 * `error` stays the message string every existing test reads. `errorDetail` is
 * the addition, and it is the field the PRODUCT branches on: OCADE's functions
 * raise with `ERRCODE = 'PT403'` and a machine-readable `DETAIL`, which
 * PostgREST turns into an HTTP status and `error.details`. A test that could
 * only see the message could not tell "not yours" from "does not exist" — a
 * distinction those functions deliberately hide from callers and deliberately
 * keep for tests — and would have to match on prose that gets reworded.
 */
export interface TwinRefusal {
  rows: never[];
  error: string;
  /** SQLSTATE, e.g. `PT403`. */
  errorCode?: string;
  /** The `DETAIL` clause — the stable name for what went wrong. */
  errorDetail?: string;
}

function refusal(cause: unknown): TwinRefusal {
  const error = cause as { message?: string; code?: string; detail?: string };
  return {
    rows: [],
    error: error?.message?.slice(0, 300) ?? String(cause),
    errorCode: error?.code,
    errorDetail: error?.detail,
  };
}

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
    session: TenantSession = {},
  ): Promise<{ rows: T[]; error?: string; errorCode?: string; errorDetail?: string }> {
    try {
      await this.db.exec(`set role authenticated;`);
      await this.db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
      await this.db.query(`select set_config('request.jwt.claim.role', 'authenticated', false)`);
      await this.db.query(`select set_config('request.jwt.claims', $1, false)`, [
        JSON.stringify(claimsFor(userId, session)),
      ]);
      const res = await this.db.query<T>(sql);
      return { rows: res.rows };
    } catch (e) {
      return refusal(e);
    } finally {
      /*
       * CLEAR THE CLAIM, NOT JUST THE ROLE.
       *
       * `set_config(..., false)` is session-scoped, so the JWT claim outlived
       * `reset role` and the NEXT superuser query still saw the last tenant's
       * `auth.uid()`. PostgREST sets these per transaction; leaving one behind
       * makes a superuser probe quietly answer as whoever ran last, which is
       * the opposite of what a superuser probe is for.
       */
      await this.db.exec(`reset role;`);
      await this.db.query(`select set_config('request.jwt.claim.sub', '', false)`);
      await this.db.query(`select set_config('request.jwt.claim.role', '', false)`);
      await this.db.query(`select set_config('request.jwt.claims', '', false)`);
    }
  }

  /**
   * Run a query AS A SIGNED-OUT VISITOR.
   *
   * `anon` is the role PostgREST uses for a request with no token, and until
   * the status page there was nothing in this schema a visitor was meant to
   * read — so the twin had no way to ask what one can see. It does now, and the
   * question matters in both directions: the incident tables must be readable
   * without an account, and everything else must not have become readable with
   * them.
   *
   * No JWT claims are set, because a signed-out request carries none. That is
   * what makes `auth.uid()` NULL here, which is the condition most policies
   * are written against.
   */
  async asAnon<T = Record<string, unknown>>(
    sql: string,
  ): Promise<{ rows: T[]; error?: string; errorCode?: string; errorDetail?: string }> {
    try {
      await this.db.exec(`set role anon;`);
      await this.db.query(`select set_config('request.jwt.claim.sub', '', false)`);
      await this.db.query(`select set_config('request.jwt.claim.role', 'anon', false)`);
      await this.db.query(`select set_config('request.jwt.claims', $1, false)`, [
        JSON.stringify({ role: "anon" }),
      ]);
      const res = await this.db.query<T>(sql);
      return { rows: res.rows };
    } catch (e) {
      return refusal(e);
    } finally {
      await this.db.exec(`reset role;`);
      await this.db.query(`select set_config('request.jwt.claim.role', '', false)`);
      await this.db.query(`select set_config('request.jwt.claims', '', false)`);
    }
  }

  /** Execute runtime SQL with PostgREST's service role, never owner privileges.
   * A transaction serializes role changes on PGlite's single connection.
   */
  async asServiceRole<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    return this.db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      await tx.query(
        "select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)",
      );
      return (await tx.query<T>(sql)).rows;
    });
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
   * `~ '^[A-Z]{3}$'`, which no generic filler will ever hit by accident.
   *
   * WHY THIS WALKS THE PATTERN INSTEAD OF MATCHING ONE SHAPE. The first version
   * handled exactly `^[class]{n}$`, and returned null for anything else — which
   * is safe, but it meant `slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'` could not
   * be satisfied, so no organization could be planted, so no MEMBERSHIP could be
   * planted, so the cross-tenant isolation suite silently skipped both tables and
   * said so in a warning nobody had to act on. A security suite that cannot
   * construct the row it is meant to attack is not proving anything about it.
   *
   * Only anchored sequences of character classes with simple quantifiers are
   * handled. Anything with alternation, groups, backreferences or lookaround
   * still returns null and the table is reported as unplanted, because a string
   * built from a pattern this does not understand would fail a DIFFERENT
   * constraint and be reported as a mystery rather than as "not handled".
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
      return DatabaseTwin.sampleForPattern(match[1]);
    }
    return null;
  }

  /**
   * The shortest string an anchored class-sequence pattern accepts, or null.
   *
   * Exposed as a static so it can be tested directly: it is the piece that
   * decides whether a table can be planted at all, and a bug here presents as a
   * missing security assertion rather than as a failure.
   */
  static sampleForPattern(pattern: string): string | null {
    if (!pattern.startsWith("^") || !pattern.endsWith("$")) return null;
    const body = pattern.slice(1, -1);
    // Anything this walker does not model. Better to refuse than to build a
    // string that satisfies the regex and violates something else.
    if (/[()|\\]/.test(body)) return null;

    let out = "";
    let index = 0;
    while (index < body.length) {
      let member: string;
      if (body[index] === "[") {
        const close = body.indexOf("]", index + 1);
        if (close === -1) return null;
        const set = body.slice(index + 1, close);
        if (set.startsWith("^")) return null; // a negated class has no first member
        member = DatabaseTwin.firstMemberOf(set);
        index = close + 1;
      } else if (/[A-Za-z0-9_\-]/.test(body[index])) {
        member = body[index];
        index += 1;
      } else {
        return null;
      }

      // The quantifier that follows, if any. The SHORTEST accepted count wins:
      // a longer string risks a separate length constraint on the same column.
      let count = 1;
      const quantifier = /^(?:\{(\d+)(?:,(\d*))?\}|\+|\*|\?)/.exec(body.slice(index));
      if (quantifier) {
        if (quantifier[0] === "+") count = 1;
        else if (quantifier[0] === "*" || quantifier[0] === "?") count = 0;
        else count = Number(quantifier[1]);
        index += quantifier[0].length;
      }
      out += member.repeat(count);
    }
    return out.length > 0 ? out : null;
  }

  /** The first literal character a class accepts. */
  private static firstMemberOf(set: string): string {
    if (/0-9/.test(set)) return "0";
    if (/a-z/.test(set)) return "a";
    if (/A-Z/.test(set)) return "A";
    // A literal set such as `[-_.]`; its first character, whatever it is.
    return set[0];
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
   * Nullable columns a trigger nevertheless requires on insert.
   *
   * SQL permits a column to be nullable while a BEFORE INSERT trigger rejects
   * NULL with a clearer domain-specific message. A catalogue-only planter that
   * skips every nullable column therefore misses rows the application can
   * create. Read the trigger functions and satisfy their explicit NULL guards.
   */
  private async triggerRequiredColumns(
    table: string,
    columns: readonly string[],
  ): Promise<Set<string>> {
    const rows = await this.asSuperuser<{ def: string }>(
      `select pg_get_functiondef(p.oid) as def
         from pg_trigger t
         join pg_proc p on p.oid = t.tgfoid
        where t.tgrelid = 'public.${table}'::regclass
          and not t.tgisinternal`,
    );
    const required = new Set<string>();
    for (const column of columns) {
      const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const guard = new RegExp(`\\bNEW\\.\"?${escaped}\"?\\s+IS\\s+NULL\\b`, "i");
      if (rows.some(({ def }) => guard.test(def))) required.add(column);
    }
    return required;
  }

  /** The smallest integer accepted by a simple numeric lower-bound CHECK. */
  private async numericMinimum(table: string, column: string): Promise<number | null> {
    const rows = await this.asSuperuser<{ def: string }>(
      `select pg_get_constraintdef(oid) as def
         from pg_constraint
        where contype = 'c' and conrelid = 'public.${table}'::regclass`,
    );
    const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lowerBound = new RegExp(`\\b${escaped}\\b\\s*(>=|>)\\s*(-?\\d+)`, "i");
    let minimum: number | null = null;
    for (const { def } of rows) {
      const match = lowerBound.exec(def);
      if (!match) continue;
      const candidate = Number(match[2]) + (match[1] === ">" ? 1 : 0);
      minimum = minimum === null ? candidate : Math.max(minimum, candidate);
    }
    return minimum;
  }

  /** The smallest text length accepted by a simple length BETWEEN CHECK. */
  private async textMinimumLength(table: string, column: string): Promise<number | null> {
    const rows = await this.asSuperuser<{ def: string }>(
      `select pg_get_constraintdef(oid) as def
         from pg_constraint
        where contype = 'c' and conrelid = 'public.${table}'::regclass`,
    );
    const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const between = new RegExp(
      `(?:length|char_length)\\(\\(?${escaped}\\)?\\)\\s+BETWEEN\\s+(\\d+)\\s+AND\\s+(\\d+)`,
      "i",
    );
    const lowerBound = new RegExp(
      `(?:length|char_length)\\(\\s*\\(?\\s*${escaped}\\s*\\)?\\s*\\)\\s*>=\\s*(\\d+)`,
      "i",
    );
    for (const { def } of rows) {
      const match = between.exec(def);
      if (match) return Number(match[1]);
      const lowerMatch = lowerBound.exec(def);
      if (lowerMatch) return Number(lowerMatch[1]);
    }
    return null;
  }

  /** Equality relationships used by checks such as expires_at = reset_at. */
  private async equalColumns(
    table: string,
    columns: readonly string[],
  ): Promise<Map<string, string>> {
    const rows = await this.asSuperuser<{ def: string }>(
      `select pg_get_constraintdef(oid) as def
         from pg_constraint
        where contype = 'c' and conrelid = 'public.${table}'::regclass`,
    );
    const known = new Set(columns);
    const peers = new Map<string, string>();
    for (const { def } of rows) {
      const equality = /\b([a-z_][a-z0-9_]*)\b\s*=\s*\b([a-z_][a-z0-9_]*)\b/gi;
      for (const match of def.matchAll(equality)) {
        const left = match[1].toLowerCase();
        const right = match[2].toLowerCase();
        if (!known.has(left) || !known.has(right)) continue;
        peers.set(left, right);
        peers.set(right, left);
      }
    }
    return peers;
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
    const triggerRequired = await this.triggerRequiredColumns(table, names);
    const equalColumns = await this.equalColumns(table, names);

    const insertCols: string[] = [owner];
    const insertVals: string[] = [`'${ownerId}'`];
    const insertedExpressions = new Map<string, string>([[owner, `'${ownerId}'`]]);
    /*
     * Several tables constrain one timestamp to be after another
     * (`expires_at > started_at`, `finished_at >= started_at`). Giving every
     * timestamp `now()` fails those. Staggering by column order satisfies them,
     * because in every such table the earlier instant is declared first.
     */
    let timestampsUsed = 0;

    for (const column of columns) {
      if (column.column_name === owner) continue;
      if (
        (column.is_nullable === "YES" || column.has_default) &&
        !triggerRequired.has(column.column_name)
      ) {
        continue;
      }

      const referenced = fkFor.get(column.column_name);
      if (referenced && referenced !== "users") {
        const parent = await this.plantRow(referenced, ownerId, depth + 1);
        if (!parent) {
          this.plantCache.set(key, null);
          return null;
        }
        insertCols.push(column.column_name);
        const expression = `'${String(parent.id ?? parent[owner])}'`;
        insertVals.push(expression);
        insertedExpressions.set(column.column_name, expression);
        continue;
      }
      if (referenced === "users") {
        insertCols.push(column.column_name);
        const expression = `'${ownerId}'`;
        insertVals.push(expression);
        insertedExpressions.set(column.column_name, expression);
        continue;
      }

      const equalPeer = equalColumns.get(column.column_name);
      const equalExpression = equalPeer ? insertedExpressions.get(equalPeer) : undefined;
      if (equalExpression) {
        insertCols.push(column.column_name);
        insertVals.push(equalExpression);
        insertedExpressions.set(column.column_name, equalExpression);
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
        const expression = `'${allowed[allowed.length - 1]}'`;
        insertVals.push(expression);
        insertedExpressions.set(column.column_name, expression);
        continue;
      }
      const sample = await this.regexSample(table, column.column_name);
      if (sample !== null) {
        insertCols.push(column.column_name);
        const expression = `'${sample}'`;
        insertVals.push(expression);
        insertedExpressions.set(column.column_name, expression);
        continue;
      }

      if (["text", "character varying"].includes(column.data_type)) {
        const minimumLength = await this.textMinimumLength(table, column.column_name);
        if (minimumLength !== null) {
          const expression = `'${"x".repeat(minimumLength)}'`;
          insertCols.push(column.column_name);
          insertVals.push(expression);
          insertedExpressions.set(column.column_name, expression);
          continue;
        }
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

      if (["integer", "bigint", "smallint", "numeric"].includes(column.data_type)) {
        const minimum = await this.numericMinimum(table, column.column_name);
        if (minimum !== null) {
          insertCols.push(column.column_name);
          insertVals.push(String(minimum));
          continue;
        }
      }

      const expression = DatabaseTwin.filler(column.data_type, ownerId, timestampsUsed);
      insertCols.push(column.column_name);
      insertVals.push(expression);
      insertedExpressions.set(column.column_name, expression);
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
