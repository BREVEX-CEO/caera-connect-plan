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
  -- GoTrue refuses sign-in and refresh while this is in the future (an account ban).
  banned_until timestamptz,
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
  /** The `session_id` claim, for functions that must spare the caller's own session. */
  sessionId?: string;
  /**
   * A person who confirms each request afresh: the caller's own live session (one is made if
   * `sessionId` is not given) and a proof no earlier request used. One proof covers one
   * sensitive change, so a test that changes several things confirms each, as a person would.
   */
  confirmEach?: boolean;
  /** The proof's exact time, in seconds (set by `confirmEach`). */
  provedAt?: number;
}

function claimsFor(userId: string, session: TenantSession): Record<string, unknown> {
  const claims: Record<string, unknown> = {
    sub: userId,
    role: "authenticated",
    aal: session.aal ?? "aal1",
  };
  if (session.sessionId) claims["session_id"] = session.sessionId;
  if (!session.omitAmr) {
    // Supabase reports these in SECONDS, which is the detail a millisecond
    // reading gets wrong by a factor of a thousand and silently.
    const proved =
      session.provedAt ?? Math.floor(Date.now() / 1000) - (session.provedSecondsAgo ?? 0);
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

  /** The latest proof `confirmEach` handed out; each next one is a second earlier or now. */
  private lastProof = Number.POSITIVE_INFINITY;

  /** The person's live session, made once they have none. */
  private async liveSession(userId: string): Promise<string> {
    const [found] = (
      await this.db.query<{ id: string }>(
        `select id from auth.sessions where user_id = $1 order by created_at limit 1`,
        [userId],
      )
    ).rows;
    if (found) return found.id;
    return (
      await this.db.query<{ id: string }>(
        `insert into auth.sessions (user_id) values ($1) returning id`,
        [userId],
      )
    ).rows[0]!.id;
  }

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
    /*
     * One transaction per request, as PostgREST does: role and claims are
     * transaction-local, so concurrent calls on PGlite's single connection
     * cannot interleave identities and nothing outlives the request.
     */
    if (session.confirmEach) {
      this.lastProof = Math.min(Math.floor(Date.now() / 1000), this.lastProof - 1);
      session = {
        ...session,
        aal: session.aal ?? "aal2",
        sessionId: session.sessionId ?? (await this.liveSession(userId)),
        provedAt: this.lastProof,
      };
    }
    // Minted before the transaction starts, as a real token is before its request: read
    // inside it, a second boundary could put the proof after now() ("a proof in the future").
    const claims = JSON.stringify(claimsFor(userId, session));
    try {
      const res = await this.db.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
        await tx.query(`select set_config('request.jwt.claim.role', 'authenticated', true)`);
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
        return tx.query<T>(sql);
      });
      return { rows: res.rows };
    } catch (e) {
      return refusal(e);
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
      const res = await this.db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.query(`select set_config('request.jwt.claim.role', 'anon', true)`);
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ role: "anon" }),
        ]);
        return tx.query<T>(sql);
      });
      return { rows: res.rows };
    } catch (e) {
      return refusal(e);
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
}
