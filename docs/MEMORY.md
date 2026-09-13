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

Normal `ocade.in` works without requiring PWA installation and should also be optionally installable as a PWA.

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

## Exact next action

Start **Phase 3**: Supabase cleanup. Compare the live `public` schema against
what the final app actually reads, trace callers before removing anything, and
build the manual entitlement-grant workflow — hidden Admin is read-only today
and can show accounts and roles but cannot grant or revoke anything.

Do not begin implementation of Cowork/Jarvis.
