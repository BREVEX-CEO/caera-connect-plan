# What the live systems actually say

Read from the running Supabase project on 10 September 2026, not inferred from
this repository. Re-read it before launch; a fact in a document is only as good
as its date, and the previous reading of this file — 27 August — had gone wrong
in both directions by the time it was checked: it reported migration drift that
no longer exists, and it reported a role-enumeration hole as **Open** that the
live database had already closed.

## The project

|          |                                  |
| -------- | -------------------------------- |
| Project  | `OCADE` — `sazhgaisyhkdbrooycdv` |
| Region   | `ap-southeast-2`                 |
| Postgres | 17.6, GA channel                 |
| Status   | `ACTIVE_HEALTHY`                 |

`supabase/config.toml` named a different project until 10 September 2026. It
names this one now, which matters because `supabase db push` reads it.

## Row-level security: verified live

```sql
select count(*) from pg_tables where schemaname='public';                        --  96
select count(*) from pg_policies where schemaname='public';                      -- 185
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;            --   0
```

**Zero public tables without row-level security.** 185 policies across 96
tables. `user-isolation.test.ts` proves the same schema refuses cross-account
reads, writes, deletes and forged inserts on the owned tables, and
`organization-assurance.test.ts` proves the high-risk organization mutations
refuse a session whose last proof is stale.

Seven tables have RLS enabled and NO policy —
`ocade_generation_permits`, the four offline-usage tables and the two MFA
recovery tables. That is closed, not open: RLS with no policy denies everything,
and each also revokes every table privilege from `anon` and `authenticated`. The
verification for `20260910110000_one_read_policy_per_role` asserts that pairing,
so a grant added later cannot quietly make a policy-less table reachable.

## Supabase's own advisors

Read 10 September 2026, after the Phase 3 repairs.

**Performance: `unused_index` only.** Indexes that have not been used yet on a
database with no traffic — a measurement of the absence of traffic, not of need,
and nothing is dropped on that evidence. Nothing about `unindexed_foreign_keys`,
`auth_rls_initplan` or `multiple_permissive_policies`, which are the three that
would matter. All three were present in August and are fixed:
`20260910120000_index_every_cascade_path` covers all twenty-two foreign keys, and
`20260910110000_one_read_policy_per_role` merges the duplicated permissive
policies.

**Security: one warning worth acting on.**

- 47 × `authenticated_security_definer_function_executable`. This is the
  application's own RPC surface. Every one was read on 10 September: each scopes
  by `auth.uid()` or checks `has_role`, including the no-argument ones.
  `security-definer.test.ts` proves it and fails if a future function does not.
- 1 × `anon_security_definer_function_executable` —
  `ocade_read_shared_conversation`. Intentional: it is the share link, it takes
  the token and returns four fields, and `owner_id` never leaves the database.
- 7 × `rls_enabled_no_policy` (INFO) — the closed tables described above.
- 1 × `auth_leaked_password_protection` **disabled**. Supabase can reject
  passwords found in the HaveIBeenPwned corpus and currently does not. This is
  a dashboard setting, not code: Authentication → Providers → Email → "Prevent
  use of leaked passwords". **Turn it on before launch.** It is the only item in
  this document with no repository path.

`has_role` no longer answers about anybody but the caller — verified live rather
than assumed:

```sql
pg_get_functiondef(…) like '%IS DISTINCT FROM%'   -- true
has_function_privilege('authenticated', 'public.has_role(uuid,public.app_role)', 'EXECUTE')  -- true
has_function_privilege('anon',          'public.has_role(uuid,public.app_role)', 'EXECUTE')  -- false
```

## Migration drift: none

95 migration records live; 92 files in `supabase/migrations`. The counts differ
because three source migrations were found to be **already applied by effect**
during the 10 September reconciliation and two others were applied under
generated names — which is exactly why the reconciliation compared SCHEMA EFFECT
rather than filenames. What matters is the comparison that was actually run:

```sql
-- source CREATE TABLE names, following later renames, minus live table names
-- and the reverse. Both sides empty.
```

Source declares 96 tables (two of which later migrations rename away) and live
holds exactly those 96. Nothing is applied to production that is missing here,
and nothing here is missing from production.

Applying a new migration is:

```bash
supabase db push --project-ref sazhgaisyhkdbrooycdv
# then, per migration:
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/verification/<name>_verify.sql
```

## External configuration still missing

`src/lib/auth/provider-availability.ts` is fail-closed in production: a
provider is offered only when its build flag is set, so that nobody is sent
into a provider the live project will reject. `.env.example` ships every flag
`false`. Until the Cloudflare build sets them, the live product will:

| Flag                             | Effect while unset                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_AUTH_GOOGLE_ENABLED`       | No Google sign-in button                                                                                                                                                 |
| `VITE_AUTH_APPLE_ENABLED`        | No Apple sign-in button                                                                                                                                                  |
| `VITE_AUTH_PHONE_ENABLED`        | No phone sign-in                                                                                                                                                         |
| `VITE_AUTH_EMAIL_DELIVERY_READY` | **New email accounts, one-time codes and password reset are all refused**, with a visible reason on the auth screen. Existing members can still sign in with a password. |

Setting a flag is not the whole job — the provider has to be configured in the
Supabase dashboard as well, and the flag only stops the product lying about it.
`docs/deployment/CLOUDFLARE_GITHUB_RELEASE.md` lists where the flags go.

### Online intelligence needs at least one key slot

`supabase/functions/ocade-intelligence` reads exactly three optional secrets and
uses the ones that are set, primary first:

| Secret                     | Required                      | Effect while unset                                         |
| -------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `GEMINI_API_KEY_PRIMARY`   | **Yes** (or `GEMINI_API_KEY`) | Online intelligence answers 503 and says it is unavailable |
| `GEMINI_API_KEY_SECONDARY` | No                            | No second key to fail over to                              |
| `GEMINI_API_KEY_TERTIARY`  | No                            | No third key to fail over to                               |

`GEMINI_API_KEY` is still read as the primary, because it is what earlier
deployments set and a rename that silently turned online intelligence off would
be worse than one alias.

Failover is primary-first and only for the failures that a different key could
actually fix: a key-local refusal (401/403) moves on immediately, a pre-output
5xx or transport failure retries the slot and then moves on. **A 429 never
rotates** — quota belongs to the project, every key would meet the same wall, and
trying them anyway is the evasion `docs/TRD.md` forbids. Nothing is attempted
after output has begun.

The model is pinned to `gemini-3.1-flash-lite` in
`src/lib/intelligence/online-models.ts`, which is a checked-in allowlist rather
than configuration. `GEMINI_MODEL` can override it, and the handler refuses
anything the allowlist does not name — so a mistyped override fails closed with
503 rather than reaching an unintended model.

The audit proves the honest half rather than the working half:
`signup-consent.mjs` asserts that a disabled Create account carries a visible
explanation, and it does.
