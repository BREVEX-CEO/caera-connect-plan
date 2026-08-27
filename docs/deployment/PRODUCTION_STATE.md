# What the live systems actually say

Read from the running Supabase project on 27 August 2026, not inferred from
this repository. Re-read it before launch; a fact in a document is only as good
as its date.

## The project

|          |                                  |
| -------- | -------------------------------- |
| Project  | `OCADE` — `sazhgaisyhkdbrooycdv` |
| Region   | `ap-southeast-2`                 |
| Postgres | 17.6.1.155, GA channel           |
| Status   | `ACTIVE_HEALTHY`                 |

## Row-level security: verified live

```sql
select count(*) from pg_tables where schemaname='public';                        -- 68
select count(*) from pg_policies where schemaname='public';                      -- 161
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;            --   0
```

**Zero public tables without row-level security.** 161 policies across 68
tables. `user-isolation.test.ts` proves the same schema refuses cross-account
reads, writes, deletes and forged inserts on 34 owned tables.

## Supabase's own advisors

**Performance: 118 notices, all `INFO: unused_index`** — indexes that have not
been used yet on a database with no traffic. Not a defect. Nothing about
missing indexes, nothing about `auth_rls_initplan`, nothing about multiple
permissive policies, which are the three that would matter.

**Security: 16 warnings.**

- 15 × `authenticated_security_definer_function_executable`. Fourteen are
  intentional elevated helpers that check `auth.uid()` before touching
  anything — `security-definer.test.ts` proves each one does, and fails if a
  future function does not. The fifteenth, `has_role`, did not, and is fixed by
  migration `20260827120000_has_role_answers_only_about_the_caller`.
- 1 × `auth_leaked_password_protection` **disabled**. Supabase can reject
  passwords found in the HaveIBeenPwned corpus and currently does not. This is
  a dashboard setting, not code: Authentication → Providers → Email → "Prevent
  use of leaked passwords". **Turn it on before launch.**

## Migration drift

Production has 54 applied migrations. This repository has 58. Nothing is
applied to production that is missing here — no untracked live changes — but
four repository migrations are not yet applied:

| Migration                                               | What it does                                 | Live impact today                                                                                         |
| ------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `20260824184500_restore_has_role_authenticated_execute` | Grants `authenticated` EXECUTE on `has_role` | **None** — verified live: the grant is already present, so the effect is in place by another route        |
| `20260825180000_expand_support_ticket_categories`       | Widens the ticket category set               | Partially present: `ocade_support_tickets.category` exists live                                           |
| `20260826023255_a405ac19-…`                             | —                                            | Unverified                                                                                                |
| `20260827120000_has_role_answers_only_about_the_caller` | Stops role enumeration                       | **Open**: verified live, the guard is absent, so any signed-in account can still enumerate administrators |

Verified live:

```sql
has_function_privilege('authenticated','public.has_role(uuid,public.app_role)','EXECUTE')  -- true
has_function_privilege('anon',         'public.has_role(uuid,public.app_role)','EXECUTE')  -- false
pg_get_functiondef(…) like '%IS DISTINCT FROM%'                                            -- false
```

**These four migrations are not applied by this work.** Changing a live schema
during a launch window is the operator's call, and each has a verification and
a rollback script beside it. Applying them is:

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

The audit proves the honest half rather than the working half:
`signup-consent.mjs` asserts that a disabled Create account carries a visible
explanation, and it does.
