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
- email 6-digit OTP through the configured Resend SMTP;
- optional password where deliberately supported;
- MFA/assurance where required.

Phone OTP was removed by the owner: sending SMS needs an external provider
OCADE does not have, and a method that can only refuse is worse than an absent
one.

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

## Phase 4 — the boundary is deployed with the three keys

The owner configured `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`,
`GEMINI_API_KEY_TERTIARY` and `OCADE_ALLOWED_ORIGINS` in Supabase.

`ocade-intelligence` is deployed at **version 6**, `verify_jwt: true`,
`ezbr_sha256 819c06dc04a8889398c89e21f5d20ae27a01c4d97e01227ac9bd940d18889054`.
Version 2 had been live: it read a singular `GEMINI_API_KEY`, defaulted to
`gemini-3.7-flash`, had no slot failover, and required a `privacy.storageMode`
field the current client does not send. It would have read none of the three
secrets.

### What is proven, and what is not

Proven here: the failover policy, by 20 tests in `edge-handler.test.ts` —
primary first; 401/403 moves to the next slot immediately; 5xx and a thrown
transport error retry the slot then move on; a 429 retries the same slot and is
then answered honestly rather than rotated around, which is the quota evasion
`docs/RULES.md` #14 forbids; and nothing reaches for another key once output has
started.

NOT proven here, and it must not be claimed: a real Gemini answer through the
deployed function. This sandbox's egress policy refuses
`sazhgaisyhkdbrooycdv.supabase.co` (`CONNECT tunnel failed, response 403`), so
the function cannot be invoked from here at all. `generativelanguage.googleapis
.com` IS reachable, but calling it directly would prove Google's availability
rather than OCADE's boundary.

`function_edge_logs` is empty for the last 24 hours: nothing has invoked the
function since the deploy.

**One Send on ocade.in produces the proof.** Each request writes one
`ocade.health` line — enumerated values only, no prompt, no key, no user id —
carrying the outcome, the error class and which of the three slots served. Those
lines are readable from here through the Supabase logs, so after a single real
message the whole path can be confirmed, including which key answered.

## Phase 2 revisited — phone authentication removed

Owner decision. OCADE signs somebody in two ways: Google, and a six-digit code
to an email address through the configured Resend SMTP.

Sending SMS needs an external provider account OCADE does not have, so a phone
tab could only ever refuse, and a method that cannot authenticate is worse than
an absent one — it is the one somebody reaches for when the others give them
trouble. 437 lines deleted against 108 added: `phone-numbers.ts` and its test,
the country picker, the channel tabs, the `channel` search parameter, the
`phone` availability field, the `type: "sms"` verify branch, the "Phone"
identity label, the stub's phone handling, and the phone assertions in the
journey. Six documentation authorities no longer describe it.

Two defects found while removing it:

- `resend()` loaded the Supabase client BEFORE checking the cooldown, so two
  fast clicks both passed the check and sent two codes.
- `/auth/verify` accepted any non-empty `identifier`; it takes an email address.

## Owner/admin

`caeracadane28@gmail.com` holds the `admin` role. Admin stays hidden — a
non-admin is returned to Chat rather than told the area exists, and
`listAccountAccess` answers 404 rather than 403 for the same reason. Grant and
revoke were proven against the live database in Phase 3 inside a rolled-back
transaction: non-admin refused, admin without a second factor refused,
self-grant refused, 400 days refused, a real grant resolving to `max` through
`ocade_active_entitlement_grant` and back to none after revoke, with 0 grants
and 0 admins left behind.

### Owner actions still open

- **Email codes**: custom SMTP is configured (Resend). Nothing further from
  OCADE's side.
- **Leaked password protection**: Authentication → Sign In / Providers →
  Password → enable "Prevent use of leaked passwords". Advisor reports it off.

## Phase 5 result — one use, on every tier, everywhere

The weighted-work model is gone. `usage-policy.ts` is now one counting model:
`ONE_USE = 1`, `TierAllowance {session, week}`, a single-argument
`checkAllowance`, and `describeUsage` returning exact counts. Deleted with it:
`WorkMeasurement`, `weighWork`, `MINIMUM_WORK`, `costOf`, the `counting`/
`display` shapes, `usedPercent`, and the whole of `token-estimate.ts`.

What that removed beyond the arithmetic:

- a trust boundary — the browser used to report tokens in, tokens out, read
  batches and side effects, every field of which had to be clamped because a
  negative one would credit the account. It reports nothing that costs money
  now, so `finalizeGenerationPermit` takes only an idempotency key;
- a reconciliation — the reservation IS the charge, so `finalize` settles and
  moves nothing, and a permitted request can no longer overrun its allowance
  the way a measured top-up could;
- two answers to "how much have I used" — Pro and Max were shown a percentage
  because the unit behind it was not one anybody could convert into their own
  work. Every tier is shown exact counts;
- `PermitGranted.reserved`, which had no consumer left.

**The commercial rule for a partial or cancelled response**, in one place
(`createBilledRequest`): output that reached the person is one use; nothing
reaching them is zero. Pressing Stop after half an answer is a use, because
half an answer arrived. Whitespace alone is not. Settling twice settles once.
Three regression tests hold each case.

**Bounding what one use may cost.** Everything going in was already bounded (1
MiB body, 256 messages, 128 tools, 200k chars per message, 110s provider
timeout, 3 attempts); nothing bounded what came back. The boundary now sends
`generationConfig.maxOutputTokens = 8192`. That made `MAX_TOKENS` an ordinary
ending, and exposed a real bug: every finish reason other than `STOP` became a
refusal, so a capped answer would have put an error under text the person had
just read and had the client release a permit for output it received. Fixed,
with tests for the cap, for the truncated delivery, and for a genuine `SAFETY`
stop still refusing.

**Usage UI.** One `useCommercialUsage` hook and one query key shared by three
surfaces. `PLAN.md` asks for a meter near the account, a subtle warning near
Send and full detail under Billing: the sidebar meter sits above the account
row, the composer says nothing until three requests remain, and Billing shows
both windows. The browser journey proves the meter and Billing report the same
number after a real send.

Verified: `verify:full` 14 gates; 141 commercial tests including the real
Postgres gate and ledger suites; all 10 browser journeys.

### Carried forward

- **Upgrade action on exhaustion** — `PLAN.md` Phase 5 asks for one, and
  `/pricing` does not exist until Phase 6. Wire it when the route is real
  rather than linking at a 404.
- **Edge Function redeploy** — `maxOutputTokens` and the `MAX_TOKENS` fix are
  in the tree but not in the deployed function. Phase 15 deploys the reconciled
  tree and proves the versions belong together.

## Phase 6 result — Pricing is public again, and honest about checkout

`/pricing` exists, public, in the read frame rather than the workspace shell:
somebody deciding whether to pay has not signed in yet. Weekly/monthly toggle,
currency selector defaulting to the browser's own region (read after mount, so
the server and the first paint cannot disagree about a price), three cards.

**The numbers come from the two authorities, never from the page.** Amounts
come from `payments/pricing.ts`, which refuses to format a price that breaks
the numeric signature; allowance lines come from `commercial/usage-policy.ts`,
so the page that sells the allowance and the gate that enforces it read the
same number. `pricing.test.ts` restates the approved table by hand — a test
that read the catalogue to check the catalogue would pass whatever it said.

**Checkout is not pretended.** No payment provider is configured, so the paid
cards say "Paid plans are not open yet" in one line. There is deliberately no
button that refuses: a control whose only answer is no is worse than the
sentence, because somebody has to press it to find out.

**The way out of the limit, where the limit is met.** "See plans" sits in the
composer notice when the allowance is low or gone, and in Billing's Plan row
for anybody not already on Max. That closes Phase 5's carried-forward Upgrade
action.

**Deleted.** `payments/provider.ts` entirely — 264 lines of payment protocol,
webhook HMAC verification and a `checkoutAllowed` guard with no caller, no
test, and a reachability exemption naming a gate that no longer exists. Its
verification was a second copy of `paddle.server.ts`, which is the one the real
webhook route uses. Also `describeSellablePlan`, `sellablePlansByProductId`,
`sellablePlanByPlanId`, `missingProductIds`, `sellablePlans`, `tierOf`,
`isPlanId`, `isArchivedPlanId`, `ARCHIVED_PLAN_IDS`, `CATALOGUE_VERSION`, and
the `name`, `periodMs`, `benefits`, `desktopDevices`, `mobileDevices`,
`publiclyAvailable` and `productIdEnv` fields — every one unreferenced, and the
device counts a claim nothing in the product enforces.

**Harness bug fixed.** `harness.mjs` built with `node $npm_execpath run build`,
and that variable is only set when npm runs the script — so the documented
`node scripts/e2e/harness.mjs` died with MODULE_NOT_FOUND before building.

Entitlement resolution was already whole and is unchanged: `subscriptions`
(written only by the signature-verified webhook) and `ocade_entitlement_grants`
(written only through the audited admin authority) resolve to one tier, the
stronger answer winning, with Free as the answer to every uncertainty. Both
tables and both functions survived the Phase 3 cleanup; there are no
subscription rows, because nothing has been sold.

Verified: `verify:full` 14 gates; 45 payment tests; all 11 browser journeys
including the new pricing journey, which proves every approved price in all
four currencies at both cadences.

### Genuine external blocker

**Paid checkout needs a payment provider account.** Paddle (or equivalent)
requires business identity and bank verification, which only the owner can
complete. Until those credentials exist, `/pricing` tells the truth and no
checkout is offered. Nothing else in Phase 6 is waiting on it.

## Phase 7/8 progress — identity removed, delivery rebuilt, artifact blocked

### Done and pushed

**The artifact has no public identity and no public source.** The committed
catalogue carried the publisher's repository, the file name, the quantisation
and a public download URL; a module spread the same strings into storage keys,
progress text and network requests; and the adapter's last fallback handed the
repository and file name to the library's own downloader, which fetched weights
from a public model host in the customer's browser. All of it is gone. What
replaces it is `release/OCADE_OFFLINE_RELEASE.json`: an opaque release id
derived from the artifact's own digest, a length, that digest, and two runtime
numbers. `scripts/check-model-identity.mjs` is a `verify:full` gate that reads
the repository rather than the screen and fails on any tracked file naming the
artifact; it assembles the banned strings from fragments so it does not fail
itself.

**One downloader.** The adapter's second transfer path is deleted along with
`model-download.ts` (492 lines). The installation authority mints an authorised
link, transfers in resumable adaptive ranges, checks the digest and stores the
result; the adapter reads what is already on the device and starts an engine.

**Authorised, expiring delivery.** `delivery-signature.ts` mints and verifies
HMAC-signed paths (domain tag + release id + expiry, constant-time compare, 6h
TTL) keyed on the existing server secret, so no new secret to provision.
`/api/offline/bytes/$release` verifies, then streams from the `OCADE_MODELS` R2
binding with full Range support; 403 for an unsigned request, 410 for a genuine
link that ran out — the distinction the installer needs to refresh and resume
rather than give up. Bucket `ocade-private-models` is bound in `wrangler.json`.

**Adaptive download, finished.** Concurrency now climbs a ladder
(1/2/4/8/12/16/24/32) instead of walking ±1 to a ceiling of 8, paid for by
measured throughput with a 5% noise floor, and bounded by `MAX_IN_FLIGHT_BYTES`
(64 MiB) so the ceiling falls out of the chunk size rather than being guessed.
An expired link mid-transfer mints a fresh one and continues from the
checkpoint, once per expiry however many streams noticed.

**Honest empty state.** With no release published, `resolveInstallTarget`
returns null and the authority says "Offline Intelligence is not available in
this version of OCADE yet." A null target used to mean "this backend already
holds the weights" — true of the desktop bridge and the paired computer, both
long gone — which would have blamed the person's device for something OCADE had
not shipped.

Verified: `verify:full` 15 gates; 133 brain tests; all 11 browser journeys.

### Blocked, and why — this session's egress policy

The owner asked for the pipeline to run from this terminal rather than GitHub
Actions. It cannot, and credentials would not change it. The agent proxy denies
these hosts outright (403 to CONNECT, recorded in its own status endpoint):

```text
api.cloudflare.com          upload, bucket verification
r2.cloudflarestorage.com    S3-compatible upload
huggingface.co, cdn-lfs     upstream artifact
modelscope.cn, ollama.com   alternative upstreams
cdn.jsdelivr.net            alternative upstreams
ocade.in                    production verification
```

Reachable: `api.github.com`, `github.com`, `objects.githubusercontent.com`,
`registry.npmjs.org`, `pypi.org`, `generativelanguage.googleapis.com`.

`wrangler` is unauthenticated here and `wrangler login` needs a browser. The
proxy README is explicit that a 403 is an organisation egress denial and must be
reported rather than routed around.

**WebGPU cannot be proved here either.** This sandbox's Chromium exposes no
`navigator.gpu` at all, with or without `--enable-unsafe-swiftshader`
`--use-angle=swiftshader`. A real GPU generation test needs a machine with a
browser that has one.

**What the format question already answers.** The deleted `browser-webgpu.ts`
(Phase 1, commit 1b20bd6) used `@mlc-ai/web-llm`, which consumes MLC-compiled
weights plus a per-architecture compiled kernel library — not the container this
artifact uses. The bundled engine ships one WASM binary with no GPU backend.
So one artifact cannot serve both paths today without a second engine and a
second artifact format, which is the duplicate model authority the owner
forbade. The runtime decision is sited in one place (`loadParams`,
`probeBrowserCapabilities`) so a GPU-capable build of the same engine family
turns it on without a second lifecycle.

## Phase 12 progress — the transcript got its controls

**Edit, Regenerate and Retry are one operation.** `resend(questionId, choice,
newText?)` drops that question and everything after it, from the account as
well as the screen, then asks it. Edit supplies different words, Regenerate
supplies none, Retry is Regenerate on the last question when no answer came.
Three implementations would have been three ways to truncate the history
differently; the browser journey proves the replaced question does not come
back on reload.

**A real bug this surfaced.** `send` built the history it posted from a
`messages` closure. Fine while Send was the only caller, wrong the moment
anything changed the transcript and sent in the same tick — which is exactly
what Regenerate does, so it would have sent the dropped turns back to the
model. The transcript is now a ref that `setMessages` keeps in step, and `send`
reads it synchronously.

Also added: Delete on a single turn (the `deleteMessage` server function had no
caller at all), code-block Copy that reads the rendered node rather than the
Markdown source, table styling, drag-and-drop and clipboard-paste attachment.

Verified: `verify:full` 15 gates; all 11 browser journeys, chat now 21 checks.

### Attachments reach intelligence now

`+`, drag-and-drop and paste all read the file before it is sent. Text,
Markdown, CSV, TSV, JSON and source code are read natively (`File.text()`);
images are carried whole for the online engine. PDFs, Word and Excel are
refused with the reason and what to do instead — pulling the readable fragments
out of a binary container and presenting them as the document would produce an
answer that looks as complete as one built on the whole file.

**The boundary was validating attachments and dropping them.** `parseBody`
accepted the array and `providerBody` never read it, so a file reached the Edge
Function and went nowhere. Attachments are now appended to the last question as
labelled parts — an image as `inline_data`, text between `--- attached file:
name ---` markers — and `NormalizedMessage.images` is deleted, because two ways
to say "this question has a picture with it" is one too many.

**Source references.** A system line is added only when something is attached,
asking OCADE to say which file and where in it. Tabular text keeps its header
row, so "row 3 of sales.csv" is checkable.

**Bounds.** 8 attachments, 200k characters of extracted text each (truncation
announced in the text, never silent), 5 MB per image, 20 MB total, and the body
cap raised from 1 MiB to 24 MiB to fit them. Enforced on both sides.

Composer: remove, reorder, per-file reading state and refusal reason. Transcript
shows which files went with a question.

Verified: `verify:full` 15 gates; 10 attachment tests; 3 new boundary tests; the
online journey now proves a real CSV reaching the boundary with its contents,
an unreadable file staying behind, and the citation instruction being sent.

### Still open in Phase 12

Dictation is honestly disabled. Attachment download from the transcript is not
built (the file is in Library, which has one). PDF/Office reading needs a
parser dependency and an owner decision.

## The runtime now matches what the artifact actually needs

The owner's six commits fixing `prove-offline-artifact.mjs` are evidence about
the artifact, and the product was not running it the same way. Corrected:

- **Sampling.** `BROWSER_SAMPLER` was 0.2/0.9, chosen on the sound reasoning
  that a small model doing arithmetic should be sampled tightly. These weights
  were not tuned for it — at 0.2 this artifact repeats and stalls, which is why
  the proof needed 0.7/0.8/top_k 20/min_p 0 before it would answer a sum. The
  publisher's values win over the theory, and `offline-release.test.ts` now
  fails if the proof and the product drift apart.
- **Deliberation off.** The chat template emits a reasoning block unless told
  not to. On a device this size those are minutes nobody sees and a page that
  looks hung. `enable_thinking: false` on both the load and the completion.
- **The template is used at all.** `jinja: true`, so a conversation is a
  conversation rather than a completion that wanders into inventing the next
  question.
- **Memory.** `n_batch`/`n_ubatch` 64, `n_parallel` 1, `warmup` false. The
  defaults are sized for a machine with room to spare; on a phone they are the
  difference between an engine that starts and a tab the browser kills.
- **`setCompat(null)`.** wllama fetches a compatibility shim from a public CDN
  when it decides the browser needs one. A local-first engine that reaches out
  to a third party to start is not local-first, breaks on a plane, and tells
  that third party when every customer opens OCADE.

The identity gate caught the proof script reintroducing a container name and
was scoped rather than weakened: the two build-time artifact scripts are
excluded, with the reason, because they never ship and must speak the runtime's
own language. Every shipped surface is still covered.

### The release is wired

`release/OCADE_OFFLINE_RELEASE.json` carries `ocr-2dc0ee44eb397906`,
484,220,160 bytes and the full owner-verified digest. Offline Intelligence
moved from "not available in this version" to preparing. The browser journey
asks the delivery handler directly and proves what it refuses: an unsigned
request, a made-up signature, an expired one, and an id shaped to reach for
another object.

## Debloat pass

Before: 45,226 src LOC across 221 files, 15 prod + 22 dev dependencies.
After: 42,749 src LOC across 213 files, same dependencies (none were unused).
Removed: 2,477 lines, 8 files.

**Four systems that could never run.**

1. _Recovery codes._ Redeemable but never issuable — `issueRecoveryCodes` and
   `readRecoveryCodeStatus` had no caller, so "I have lost my phone" led to a
   screen asking for a code the product had no way to give anybody. Deleted the
   generator, the pepper, `mfa.functions.ts`, both tests and the screen.
2. _The error journal._ One writer, no reader; its own comment named a Settings
   screen that does not exist. With it gone `runtime-error-reporting.ts` only
   forwarded to two globals belonging to the editor that scaffolded this
   project, so it went too. The error boundaries still render the error page.
3. _Background Fetch._ ~270 lines across the app and the service worker waiting
   for an event nothing could raise: `startBackgroundFetch` had no caller. The
   installer already resumes from its checkpoint. The service worker now
   touches the shell and nothing else, which is a stronger property than the
   test used to assert, and the test says so.
4. _The `auth_mail` rate limit._ Lost its last caller with the recovery
   functions, and could not have worked: a browser asks Supabase Auth for a
   code directly, so the request never passes through this Worker. Supabase
   enforces it. A policy with no caller is a claim the product cannot keep.

Also removed four server functions with no callers (per-conversation export,
hard delete, two trash reads) and about twenty unused exports.

**Rejected as churn.** A scripted pass that stripped `export` from 203 symbols
nothing imported. It reduced a number, not complexity, and broke type inference
in a way that needed bisecting. Reverted whole. Deleting systems is the work;
shuffling keywords is not.

## Chat completed

Dictation works, through `SpeechRecognition` — no dependency, no recorder, no
upload. Where the browser has no recogniser the control is ABSENT rather than
inert, and the journey asserts its presence matches the browser's capability.
Attachment chips lead to Library, which already owns preview and download.

## Exact next action

Unblock the artifact (see above), then: publish the release, commit the
manifest, prove delivery in a browser, and finish Phases 9–10. The rest of
Phase 12, and Phases 11, 13 and 14, do not depend on it.

Do not begin implementation of Cowork/Jarvis.
