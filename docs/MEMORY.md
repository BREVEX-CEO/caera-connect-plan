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

| Tier | Weekly | Monthly |
| --- | --- | --- |
| Free | Free | Free |
| Pro | $8 / €8 / £8 / ₹288 | $28 / €28 / £28 / ₹1,888 |
| Max | $28 / €28 / £28 / ₹1,888 | $88 / €88 / £88 / ₹5,888 |

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

## Exact next action

Start **Phase 0 of the new `PLAN.md`**:

1. fetch latest `origin/main` after this documentation reset;
2. create one isolated implementation branch;
3. record branch/SHA/tree here;
4. read the complete current repository and live Supabase state;
5. reproduce the current Send/usage failure and other broken routes;
6. map canonical authorities;
7. verify Cowork is frozen/unavailable and no `PLAN2.md` remains;
8. checkpoint/push/verify the Phase 0 branch before continuing.

Do not begin implementation of Cowork/Jarvis.