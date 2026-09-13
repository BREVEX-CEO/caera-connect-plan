# OCADE Project Memory

## Current mission

The previous core rebuild completed and was merged to `main` at `f0510d7555274e528b4b70817b7f06967106b931`.

The owner then started a new **pre-Cowork production repair mission** because the live/current product still has important product/deployment gaps, including the visible Chat Send/usage verification failure, incomplete Pricing/Usage presentation, offline-model/runtime changes, page-loading bugs and UI work.

`PLAN.md` has been completely replaced with the new mission.

`PLAN2.md` has been deleted.

Cowork/Jarvis implementation is blocked. Cowork may remain only as an unavailable placeholder until the current `PLAN.md` is fully complete and the owner explicitly starts a future mission.

## Default session modes

Every implementation session starts with:

```text
/ponytail ultra
/caveman ultra
```

These remain the default modes unless the owner changes them.

## New mission authorities

Read in this order:

1. `CLAUDE.md`
2. `PLAN.md`
3. `docs/PRD.md`
4. `docs/TRD.md`
5. `docs/APP_FLOW.md`
6. `docs/UI UX Brief.md`
7. `docs/DESIGN.md`
8. `docs/UI_REFERENCE_CHECKLIST.md`
9. `docs/ARCHITECTURE.md`
10. `docs/Backend Schema.md`
11. `docs/RULES.md`
12. `docs/TESTING.md`
13. `docs/MEMORY.md`
14. `docs/DECISIONS.md`

There is no second plan.

## Owner decisions locked for this mission

### Usage

- Free: 28 successful requests / 6h28m, no weekly cap.
- Pro: 140 / 6h28m and 700/week.
- Max: 1,400 / 6h28m and 7,000/week.
- Max is exactly 10× Pro.
- One successful answer = one use.
- Failed generations/internal retries do not add uses.
- Edit→successful regenerate and Regenerate→successful answer each cost one new use.
- Allowance is shared account-wide across supported devices and online/offline paths.

### Pricing

| Tier | Weekly                   | Monthly                  |
| ---- | ------------------------ | ------------------------ |
| Free | Free                     | Free                     |
| Pro  | $8 / €8 / £8 / ₹288      | $28 / €28 / £28 / ₹1,888 |
| Max  | $28 / €28 / £28 / ₹1,888 | $88 / €88 / £88 / ₹5,888 |

Public `/pricing` must return.

### Auth

Supabase Auth only:

- Google;
- email 6-digit OTP;
- phone 6-digit OTP + international country picker;
- optional password where deliberately supported;
- MFA/assurance where required.

Do not delete existing accounts/logged-in users/sessions during cleanup.

### Gemini

Exactly three Supabase secret names:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

When the Gemini deployment phase is reached, explicitly ask the owner for exactly three Gemini API keys as secrets. The owner has said they will provide them.

### Customer identity

Normal customer-facing AI identity is always **OCADE**.

Do not expose raw provider/model/runtime names in normal UI/responses/errors.

### Offline Intelligence

Use the owner-approved private OCADE 0.6B runtime.

- WebGPU-first where verified;
- WASM fallback;
- Fast default + optional Thinking;
- one artifact downloaded initially;
- private OCADE-controlled Cloudflare R2 distribution;
- opaque authorised shards;
- adaptive parallel downloading;
- OPFS/persistent storage;
- no customer browser fetch from Hugging Face/public model host.

If the user intentionally uninstalls Offline Intelligence, set durable `user_uninstalled` suppression. Normal site updates/deploys/browser restarts/sign-in cycles must never redownload automatically. Show that the user uninstalled it and offer **Install Offline**. Only explicit Install clears suppression.

If never installed and offline, show connect-once guidance and remember install intent.

### Routing

```text
Internet + online OCADE healthy → online OCADE
online provider fails before output + Offline ready → local fallback
no Internet + Offline ready → Offline Intelligence
no Internet + Offline absent → install/connect-once guidance
```

Offline mode creates zero provider traffic. Successful fallback costs one use total.

Images require online OCADE. Textual files may be locally extracted only where safely supported.

### Whole-site offline

`ocade.in` is a website and is never offered as an application to install. The owner replaced the earlier "optionally installable as a PWA" decision with this one: no install button, no install prompt, no desktop or native app, no app-store listing, no "add to home screen" wording and no web app manifest. The service worker and the offline shell stay.

When Internet is absent, cached/local-capable OCADE pages and Offline Chat should continue honestly. Payment and cloud-only mutations require Internet.

Official focus:

- Windows Chrome;
- macOS Chrome;
- Android Chrome;
- iPhone/iPad Chrome/WebKit where supported.

Linux is not advertised/certified.

### Chat

Required modern Chat features include attachment `+`, drag/drop/paste, mic, Send/Stop, upload progress/retry, remove/reorder attachments, Copy, Edit, Regenerate, Delete, Retry, code-block Copy, Markdown/tables/links and preview/download.

Up to 100 MB per intentionally supported attachment.

New Chat creates no empty DB conversation before first Send.

### UI

Near-black/charcoal, medium glassmorphism on high-value surfaces, restrained motion, Grok references + owner repair screenshots for structure/density, intentional desktop/tablet/mobile layouts.

## Live Supabase snapshot at documentation reset

Project: `sazhgaisyhkdbrooycdv`

Status when checked: `ACTIVE_HEALTHY`.

Observed live auth state at that check:

- `auth.users`: 4 rows;
- `auth.sessions`: 6 rows;
- `auth.refresh_tokens`: 32 rows;
- `auth.identities`: 3 rows.

These are protected and must not be wiped.

The live public schema still contains many retired product tables even though the repository plan previously reduced the target schema. This confirms that the new Supabase-cleanup phase must compare source/migrations to the **live** database before destructive work.

Examples of currently visible retired families include old Cania, Madee, Ficia, messaging, Projects/Tasks/Automations, organizations/status/support and launch/provider/event tables. Do not blindly drop them; trace callers and preserve legal/financial/security/customer evidence.

The live project currently has an active `ocade-intelligence` Edge Function. Re-fetch its current version before redeployment.

## Supabase cleanup policy

Never delete/truncate:

- auth users;
- identities;
- sessions;
- refresh tokens;
- active auth/MFA state;
- real profiles/settings/roles required by the product;
- real subscriptions/payment evidence;
- legal consent evidence;
- real customer conversations/messages/Library data unless explicitly deleted by the customer.

Clean stale development/launch/test application logs only when proven non-authoritative. Use bounded retention for operational logs that remain useful.

Hidden Admin must make manual Free/Pro/Max entitlement grants/revocations easy and auditable without editing `auth.users`.

## Previous completed core evidence

The prior core mission had reached a merged, verified tree at `f0510d7555274e528b4b70817b7f06967106b931` with the then-current tracked tests/browser checks green. That evidence is historical context only; the new plan supersedes the previous product/deployment assumptions.

Do not repeat old phases just because they appear in Git history. Reproduce current failures and follow the new `PLAN.md` from Phase 0.

## Phase 0 result — audit, baseline and reproduction

Implementation branch: `claude/happy-shannon-ox0ho6`, created from `origin/main`
at `30cbf0dd94bc7cc5fc86f86e4a5061f41dc952ac` (`ci: stop wasting runners on
docs and checkpoint pushes`).

### Baseline gates on the starting tree

- `npm run typecheck` — clean.
- `npm run lint` — clean, two pre-existing `react-refresh` warnings.
- `npm test` — 789 passed, **1 failed**: `pinned-model.test.ts` asserted that
  `PLAN.md` names "Gemini 3.1 Flash-Lite", and the documentation reset removed
  it. Repaired in Phase 0: `docs/TRD.md` is now the single document carrying
  the identifier, which is where trusted deployment configuration belongs.
- `npm run build` — succeeds.

### Sandbox limits that shape every proof in this mission

Outbound HTTPS to `ocade.in` and to `sazhgaisyhkdbrooycdv.supabase.co` is
refused by the egress policy. Production cannot be driven directly from here.
The live database IS reachable through the Supabase MCP tools, so schema,
policy and RPC facts are checked against the real project; everything in a
browser is proved against a served production build and the loopback stub.

### The browser proof harness was itself broken

Every signed-in journey failed before any product code was read, for two
harness reasons, both of which imitate product bugs:

- a build compiled without `VITE_SUPABASE_URL` ships a browser client pointed
  at nothing, so the journeys stop at the sign-in screen;
- a server left running across a rebuild keeps the previous asset manifest, so
  every hashed chunk 404s, nothing hydrates, and every control reads as
  permanently disabled.

`scripts/e2e/harness.mjs` (`npm run audit:browser`) now builds, serves and runs
the journeys as one step, so neither is possible. With it, shell, auth,
offline, library, settings, polish and final all pass on the starting tree.

### The real Send failure, reproduced and root-caused

Reproduced in a real browser: Send takes a permit, writes the conversation and
the message, then releases the permit and answers **"OCADE is still preparing
this device."**

The permit path is healthy end to end — `ocade_acquire_generation_permit`,
`ocade_release_generation_permit` and the rest all exist in the live project,
are granted to `service_role`, and return `granted` when called directly.

The cause is one line in `src/lib/intelligence/online-client.ts`:

```ts
enabled: import.meta.env.VITE_OCADE_ONLINE_INTELLIGENCE === "enabled",
```

Nothing sets that variable — not the production deployment workflow, not any
document. So `probe()` reports online intelligence unavailable in every build
ever shipped, Automatic falls through to the on-device engine, and a device
that has not finished preparing answers with that message. The toast the owner
reported is the same failure on the path where the fallback also fails.

Repairing it is Phase 1 work: the flag is a second authority over whether the
product works, separate from whether the boundary and its secrets exist, and
`docs/RULES.md` forbids exactly that.

### Canonical authority map

| Domain               | Authority                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Identity             | Supabase Auth via `src/integrations/supabase/auth-middleware.ts`                           |
| Chat persistence     | `src/lib/ocade-chat-store.ts` + `ocade.functions.ts`                                       |
| Usage/permits        | `commercial/generation-gate.ts` over `supabase-ledger.ts`, exposed by `usage.functions.ts` |
| Entitlement          | `commercial/entitlement-resolver.ts` (subscription + admin grant, stronger wins)           |
| Online intelligence  | `intelligence/online-client.ts` → `functions/v1/ocade-intelligence`                        |
| Offline intelligence | `brain/` — `installation-authority.ts`, `model-vault.ts`, `adapter.ts`                     |
| Routing              | `intelligence/router.ts`                                                                   |
| Library              | `library/library.functions.ts` over private Supabase Storage                               |
| Payments             | `payments/` + `routes/api/public/payments/webhook.ts`                                      |
| Settings             | `components/settings/settings-panel.tsx`                                                   |

### Known gaps carried into later phases

- `/pricing` returns 404 and `shell-journey.mjs` asserts it must — Phase 6.
- `VITE_AUTH_GOOGLE_ENABLED`, `VITE_AUTH_PHONE_ENABLED` and
  `VITE_AUTH_EMAIL_DELIVERY_READY` default to `false` in the production
  workflow, so the shipped sign-in surface offers less than Supabase does.
  Build flags are a second authority over what auth exists — Phase 2.
- Dictation is rendered permanently disabled — Phase 12.
- R2 is not enabled on the Cloudflare account; `r2_buckets_list` answers
  "Please enable R2 through the Cloudflare Dashboard" — Phase 8 owner action.
- The live public schema still carries retired organization, automation,
  support and status families — Phase 3.

## Phase 1 result — Send repaired at its root

The `VITE_OCADE_ONLINE_INTELLIGENCE` gate is deleted, not set. A build flag
deciding whether the product has its main feature is a second authority over
availability, and the plan forbids that. Online intelligence is now available
exactly when the project is configured and the device has a connection.
Whether the boundary is deployed and keyed is the boundary's own answer, given
at request time as a sanitized refusal — which is honest, where the flag was
silent.

Two tests were added that would have caught it: they call
`createOnlineIntelligenceTransport()` with only configuration and connectivity
supplied, so they exercise the defaults a real build produces. Every other test
in that file supplies its own configuration, which is why the original passed.

Browser proof on this tree, against a served production build:

- an answer streams into the transcript and the conversation survives a reload;
- a successful request costs exactly one use (28 → 27);
- an exhausted allowance refuses, says when it returns, and leaves history,
  Library, Settings and Billing usable;
- a refused request costs nothing (27 before, 27 after);
- the request carries a server-issued permit, and no client script carries a
  key name or the provider endpoint.

All 10 journeys pass (176 checks). `verify:full` passes all 14 gates.

Nothing else on the swept routes is broken: signed out, signed in and at phone
width, every supported route answers 200 and every control on it can be pressed
without throwing. The remaining gaps are the ones listed above, each owned by a
later phase.

## Phase 2 result — authentication, and two defects that made it unusable

### The sign-in surface asks the project

`resolveAuthProviderAvailability` read three `VITE_AUTH_*` build flags, each
defaulting to `false` in production. That is a second authority over what
authentication exists, beside the only real one, and it could drift in both
directions: the live project has Google configured and working, and a
production build with the variable unset offered no Google button at all.

The flags are gone from the code and from both deployment workflows. The screen
asks GoTrue at `/auth/v1/settings` — public, and the same source the dashboard
reflects — in the route loader, and renders only what comes back. A failed read
offers everything, because a sign-in screen that cannot be used is worse than
one that offers a method the project refuses out loud in a second.

The loader deliberately runs on the server as well. A first attempt skipped the
call during SSR; the server's loader result is the one that ships, so the screen
showed every method regardless of what the project said — the same defect in
different clothes. The browser journey catches that now: it turns providers off
at the project and requires them to leave the page.

### `/auth/verify`, `/auth/callback` and `/auth/challenge` were unreachable

`auth.tsx` was the flat-routing PARENT of all three, and its component rendered
no `<Outlet/>`, so every child rendered the sign-in form instead of itself. The
child's `head` still applied, so `/auth/verify` served a document titled "Enter
your code" whose body was the sign-in form. Every route answered 200 and every
title was right, which is why nothing caught it.

Nobody who asked for an email or phone code could enter one, and no Google
handshake could complete. `/auth` is now a leaf (`auth.index.tsx`) and the three
flows are siblings. `route-parents-render-children.test.ts` keeps it that way.

### Entering a code destroyed the screen it was entered on

Underneath that, `verify()` called `e.preventDefault()` AFTER
`await loadSupabaseClient()`. An `await` yields, the handler returns, the
browser treats the submit as unhandled and navigates to the form's action —
this page with an empty query string. `channel` and `identifier` live in that
query string, so the reloaded route failed `validateSearch` and the error
boundary replaced the screen with "Something stopped working". Right code or
wrong, the screen was gone.

`reset-password.tsx` had the same ordering. Both fixed, and
`check-dead-controls.mjs` now reports `late-preventdefault` — a control that
undoes itself is a dead control. Verified against the defect: reintroducing the
old ordering fails the gate.

### Proof

The auth journey drives the whole way in against a served production build:
Google present, both code channels, the country picker, a short number refused
without naming a provider, providers turned off at the project disappearing and
coming back, a deep link carried through, a code requested, the code screen
reached, a wrong code refused in OCADE's words with no provider and no account
named, and the right code signing in and landing on `/library` with the account
on screen. 19 checks. All 10 journeys pass (181 checks); `verify:full` passes
all 14 gates.

### Owner actions this phase cannot complete

Neither is a code change, and the product is honest in either state — the
sign-in screen shows exactly what the project reports.

1. **Email OTP delivery.** Supabase's built-in email sender is rate-limited to
   a handful of messages an hour and is not a production sender. Custom SMTP
   must be configured on the project.
2. **Phone OTP.** Supabase Auth cannot send SMS without an external provider
   (Twilio, MessageBird, Vonage or Textlocal). The provider account and its
   credentials are the owner's to supply. Until then, phone OTP must stay off
   at the project rather than be faked.

Both will be put to the owner together with the three Gemini keys at Phase 4.

## Phase 3 result — the live database is the final app's database

### Library did not exist in production

The most important finding. `ocade_library_items` was absent from the live
project and there was no `library` storage bucket — only `messenger`, from the
retired product. Every Library upload, listing and deletion in production was
addressing a table and a bucket that were not there.

The cause was two repository migrations that had never been applied. The live
project's last migration was `20260911015207`; the tree carried two beyond it.
Both are applied now:

- `one_library_for_everything_a_person_keeps` — the table, its four owner
  policies, the tombstone trigger, `ocade_delete_all_library_items`, and a
  private `library` bucket. The bucket's ceiling is **100 MB**, raised from the
  50 MB the migration carried, because that is the figure `PLAN.md` and
  `docs/TRD.md` both name for one attachment; `LIBRARY_MAX_BYTES` matches it so
  a person is told before spending the upload.
- `remove_the_database_of_the_products_ocade_is_not` — 70 tables and 70
  functions belonging to FICIA, Cania, Madee, the compliance packs, messenger,
  organizations, projects/tasks, automations, the support desk and the status
  page.

**99 public tables became 29.** Auth came through untouched: 4 users, 6
sessions, 32 refresh tokens, 3 identities, and profiles, roles, settings and
the two legal consent receipts all still there.

Every non-empty table that was dropped was read first rather than assumed.
`compliance_events` held a seeded catalogue of Indian tax filing deadlines with
no user column; `country_packs`, `rule_sources`, `launch_gate_items` and the
rest were the same shape. The one row with a real account attached was in
`ocade_outputs`, and its content was the notice OCADE showed when the Send
failure this mission opened with refused to issue a permit — a saved copy of a
failure, not work anybody would miss. That is recorded in the migration itself.

### Two statements in that migration could never have run

`DELETE FROM storage.objects` and `DELETE FROM storage.buckets` are refused by
Supabase: `storage.protect_delete()` raises 42501 and points at the Storage
API. The migration, its rollback and its verification all asserted a bucket
deletion that SQL cannot perform. All three now do what SQL can — drop every
messenger policy, so no role can read, write or list it — and say plainly that
removing the shell is a dashboard action. The bucket held no objects.

### Regenerating the types caught a stale write

`ocade_conversations.project_id` went with the Projects product, and
`ocade.functions.ts` was still writing it on every new conversation. An upsert
naming a column that does not exist is a failed Send, not a warning.
`projectId` and `taskId` are gone from the intelligence contract for the same
reason.

### Manual access grants work, and are proven

`ocade_grant_entitlement` and `ocade_revoke_entitlement` already existed with
the admin check, the AAL2 requirement, the self-grant refusal, the 1–366 day
bound and full attribution. What did not exist was any way to call them: the
hidden Admin screen was read-only, so the one operational task Phase 3 names
was a SQL console job.

`src/lib/admin/access.functions.ts` adds no authority. The two writes go
through the caller's own Supabase client so Postgres still decides; only the
READ uses the admin client, because `ocade_entitlement_grants` has RLS on with
no policy and nothing a browser holds can see a grant.

Proven against the live database inside a transaction that rolls back: a
non-admin is refused, an admin without a second factor is refused, a grant
resolves to `max` through `ocade_active_entitlement_grant`, a self-grant is
refused, 400 days is refused, and revoking returns the account to no grant.
Nothing was left behind — 0 grants, 0 admins afterwards.

### Advisors

Security advisors are clean of anything unintended. Seven `rls_enabled_no_policy`
INFO notices are the server-only tables (permits, leases, MFA recovery, offline
usage) failing closed on purpose. The `SECURITY DEFINER` warnings are functions
that each check the caller inside — except two that did not:
`ocade_org_can_administer` and `ocade_org_is_owner` survived the organizations
product because they depend on a dropped FUNCTION rather than a dropped table,
and every signed-in browser could call them. Dropped, with a verification that
asserts the rule rather than the instance: no definer function reachable by
`authenticated` may fail to bind its caller.

### Owner actions this phase cannot complete

3. **No account has the `admin` role.** All four live accounts are `user`, so
   the hidden Admin screen is unreachable and no grant can be made by anybody.
   Which account becomes an admin is the owner's decision, not one to guess.
4. **Leaked password protection is off** on Supabase Auth (advisor WARN). One
   toggle.

## Phase 4 (partial) — the boundary is deployable, the keys are not mine to set

### OCADE is a website, not an app

New owner decision, applied across the tree. There was no install button to
remove — and Chrome offered to install OCADE anyway, because a web app manifest
with `display: standalone` IS the install offer. `public/manifest.webmanifest`
and the `apple-touch-icon` link are gone, with the icons only they used; the
manifest's `start_url` was `/ocade`, a route that answers 404, so anybody who
did install it got an error page.

The service worker is untouched and the offline shell still works: offline
caching and installability are separate browser features that only appear
related. `ocade-is-a-website.test.ts` holds both halves of that line.

The legal pages named app stores in four places — distribution, refunds,
third-party services and data sharing. They no longer do.

### The Edge Function in this tree could not be deployed at all

`edge-handler.ts` imports `operation-health.ts`, which imported
`OCADE_RELEASE_VERSION` from `@/lib/health` — a VALUE import through the `@/`
alias, which Deno cannot resolve and cannot erase. The constant now lives in
`src/lib/release.ts`, one line with no runtime of its own, so the Cloudflare
liveness handler and the Deno boundary can both read it without importing each
other's world. `contract.ts` had the same shape as a type-only import; it is
relative now too.

### What is deployed is four iterations behind

The live `ocade-intelligence` (version 2) reads a singular `GEMINI_API_KEY`,
defaults to `gemini-3.7-flash`, has no slot failover at all, and requires a
`privacy.storageMode` field the current client does not send. Even with the
three secrets set it would read none of them. Redeploying is mandatory and is
held until the keys exist, so it happens once rather than twice.

The failover policy itself is correct and covered by 20 tests in
`edge-handler.test.ts`, including the two rules that matter: a 429 is answered
rather than rotated around, and no other key is reached for once output has
started.

### The keys cannot be set from here

There is no MCP tool that writes Supabase secrets, so the owner must set them.
Asking for the values in chat would put them in a transcript for no gain.

## Owner actions, with exact steps

1. **Three Gemini secrets.** Supabase dashboard → Project `sazhgaisyhkdbrooycdv`
   → Edge Functions → Secrets → Add new secret, three times:
   `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`,
   `GEMINI_API_KEY_TERTIARY`. Keys come from Google AI Studio
   (aistudio.google.com → Get API key). Secondary and tertiary are optional to
   the code — one key works, and failover is simply not invented for it.
2. **`OCADE_ALLOWED_ORIGINS`**, same screen: `https://ocade.in,https://www.ocade.in`.
   Without it every request is refused `origin_not_allowed` before anything else.
3. **Which account is the owner/admin.** Name one of
   `caeracadane28@gmail.com`, `customhaans@gmail.com`, `haansantoni2@gmail.com`
   and the role is granted here. Nobody holds it today, so Admin is unreachable
   by everybody.
4. **Email codes** need custom SMTP: Authentication → Emails → SMTP Settings.
   Supabase's built-in sender is rate-limited to a few messages an hour and is
   not a production sender. Any provider works (Resend, Postmark, SES, Mailgun);
   it wants host, port, username, password and a From address on a domain you
   control.
5. **Phone codes** need an SMS provider: Authentication → Sign In / Providers →
   Phone → enable, then choose Twilio, MessageBird, Vonage or Textlocal and
   paste that provider's credentials. Twilio wants an Account SID, an Auth Token
   and a Message Service SID.
6. **Leaked password protection**: Authentication → Sign In / Providers →
   Password → enable "Prevent use of leaked passwords". Advisor reports it off.

Until 4 and 5 are done, the sign-in screen shows exactly what the project
reports and no more — it never claims a code was sent when it was not.

## Exact next action

Redeploy `ocade-intelligence` the moment the secrets exist, then prove a real
production answer and a failover. Meanwhile continue with **Phase 5**, the
account-wide allowance, which needs nothing external.

Do not begin implementation of Cowork/Jarvis.
