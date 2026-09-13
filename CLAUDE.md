# OCADE AI Agent Handbook

## Mission

OCADE is in a **pre-Cowork production repair mission**.

Do not implement Cowork or Jarvis during this mission. Cowork may remain only as a clean unavailable placeholder. `PLAN2.md` no longer exists. `PLAN.md` is the only execution plan and must be completed fully before any future Cowork work is considered.

The supported product is:

- Chat;
- Library;
- Pricing;
- Account/Settings;
- authentication;
- online OCADE;
- Offline Intelligence;
- usage/billing;
- About, Help, Terms and Privacy;
- hidden Admin for real operational needs such as manual entitlement grants;
- Cowork placeholder only.

## Default agent modes — mandatory

At the very start of every implementation session, before reading, planning, auditing, editing, testing or continuing prior work, enable and use **both Ponytail Ultra and Caveman Ultra**.

Use:

```text
/ponytail ultra
/caveman ultra
```

These are the default operating modes for the entire session unless the owner explicitly changes them. Do not wait for the owner to request them again and do not silently downgrade either mode.

## Read order

At the start of every implementation session read, in order:

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

## Mandatory workflow

For every substantial change:

```text
READ → TRACE → REPRODUCE → CLASSIFY → DELETE/FIX → READ AGAIN → BUILD → TEST → BREAK → FIX → RETEST → REAL-BROWSER PROVE
```

Before editing:

- inspect the current implementation and every reachable caller;
- reproduce the actual bug when possible;
- identify the one canonical authority that should own the behavior;
- classify old code as KEEP, FIX, REPLACE or DELETE;
- prefer deleting retired/duplicate code over adding compatibility layers;
- never create a second store, auth authority, usage authority, intelligence router, model lifecycle, payment authority or settings authority when one can own the final behavior.

Do not hide failures behind UI. Fix the root path or remove the feature.

## Plan discipline

`PLAN.md` is authoritative.

Do not start Cowork implementation, Jarvis implementation, browser-control work, computer-control work or a separate agent runtime while the current `PLAN.md` mission is incomplete.

Cowork may remain visible only as an unavailable placeholder.

After the complete plan passes, stop and wait for a new explicit owner instruction. Do not automatically invent a successor plan.

## Gemini secret rule

Online OCADE uses exactly three server-side Gemini secret slots:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

When the Gemini deployment phase is reached, explicitly ask the owner to provide exactly three Gemini API keys as secrets. The owner has said they will provide them.

If secure Supabase secret-writing capability is available, add them directly as Supabase secrets. Never place them in source files, Markdown, logs, normal database tables, browser environment variables or generated bundles. If secret-writing is not available, give the owner only the smallest secure action required to set them, then continue after confirmation.

## Authentication rule

Supabase Auth is the only identity authority.

Required customer auth:

- Google;
- email 6-digit OTP;
- phone 6-digit OTP with country picker;
- optional password where deliberately supported;
- MFA/assurance for sensitive actions where required.

Never build custom password storage.

During Supabase cleanup, never delete or truncate existing auth users, identities, sessions, refresh tokens or active MFA/auth state.

## Usage rule

One successful user request equals one use across every device and every generation backend.

Allowances:

```text
Free: 28 / 6h28m, no weekly cap
Pro: 140 / 6h28m, 700 / week
Max: 1,400 / 6h28m, 7,000 / week
```

Max is exactly 10× Pro.

Failed generations, internal retries and provider fallbacks do not multiply usage. Edit→successful regenerate and Regenerate→successful answer each count as one new use.

The allowance is account-wide online/offline. Exhaustion blocks generation everywhere while leaving history, Library, Settings, Billing and Pricing usable.

Offline use must be backed by a signed/tamper-resistant local lease and reconciled later. Never create an unlimited offline bypass.

## Pricing rule

Public `/pricing` must exist.

Approved catalogue:

| Tier | Weekly | Monthly |
| --- | --- | --- |
| Free | Free | Free |
| Pro | $8 / €8 / £8 / ₹288 | $28 / €28 / £28 / ₹1,888 |
| Max | $28 / €28 / £28 / ₹1,888 | $88 / €88 / £88 / ₹5,888 |

Use regional currency with manual override. Real checkout must resolve into one final entitlement authority. Payment never runs or queues while offline.

## OCADE identity rule

The normal customer only interacts with **OCADE**.

Customer-visible answers, UI, progress states, ordinary errors and exports must not expose raw provider/model/runtime identities.

If asked who/what model OCADE is, identify as OCADE rather than exposing the backing provider/runtime.

Sanitize provider errors before they reach the browser.

For Offline Intelligence, use opaque OCADE artifact identifiers and remove obsolete tracked public model catalogue/name leakage. Do not make the impossible claim that local bytes are undiscoverable to a determined device owner; instead minimise disclosure as strongly as browser technology permits.

## Offline Intelligence rule

Use the owner-approved private OCADE 0.6B local runtime.

Internal execution strategy:

- WebGPU first when genuinely supported and proven;
- WASM fallback otherwise;
- customer UI never exposes those implementation terms.

A device initially downloads only the artifact it needs.

Use private OCADE-controlled Cloudflare R2 distribution, opaque artifact/shard ids, secure short-lived delivery, integrity hashes and adaptive parallel downloading. Do not make customer browsers fetch the model from Hugging Face or another public model host.

Use OPFS/persistent browser storage where supported.

### Explicit uninstall is permanent until user reverses it

If the user manually removes Offline Intelligence:

- delete the local model artifacts;
- record `user_uninstalled` independently of app version;
- never auto-redownload on site update, deploy, browser restart, sign-out/sign-in or compatible app update;
- show that they uninstalled it and offer **Install Offline**;
- only an explicit Install clears the suppression.

If it was never installed and the device is offline, explain that the user must connect once to install it, retain the install intent, and begin when connectivity returns.

## Online/offline routing

Default signed-in behavior:

```text
internet + online OCADE healthy → online OCADE
online OCADE fails before output + Offline ready → Offline Intelligence
no internet + Offline ready → Offline Intelligence
no internet + Offline absent → installation/connect-once guidance
```

Offline mode creates zero provider traffic.

A successful fallback consumes exactly one use total.

Images require online OCADE. Offline image understanding must fail clearly rather than pretending the local text runtime can see images. Textual files may be locally extracted only where safely supported.

## Supabase cleanup rule

The live project must be re-verified before migration.

Preserve:

- auth users/identities/sessions/refresh tokens/MFA state;
- real profiles, settings and roles required by final OCADE;
- real subscriptions/payment history;
- legal consent evidence;
- real customer conversations/messages/Library content unless the customer explicitly deletes them.

Remove retired schema/data only after caller tracing and with reversible migrations.

Clear stale development/launch/test application logs only when they are proven not to be customer, financial, legal, auth or security evidence. Prefer bounded retention for logs still required.

Manual access grants must use one auditable entitlement-grant authority and never edit `auth.users` directly.

## Chat requirements

Chat is `/`.

Required normal features include:

- New Chat;
- recent history;
- attachments via `+`, drag/drop and paste;
- microphone;
- Send/Stop;
- upload progress/retry;
- attachment remove/reorder before send;
- Copy;
- Edit prompt;
- Regenerate;
- Delete;
- Retry failed generation;
- code-block Copy;
- Markdown/tables/links;
- attachment preview/download.

Up to 100 MB per attachment where the format is intentionally supported.

New Chat should not create an empty database conversation until first Send.

## Whole-site offline rule

`ocade.in` is a website and is never offered as an application to install. No install button, install prompt, desktop or native app promotion, app-store listing, "add to home screen" wording, or web app manifest.

The service worker and the offline shell stay: a site opens without a connection whether or not it can be installed, and only one of those two is wanted here.

When Chrome has no Internet, the cached shell must still open and provide all honestly local functionality. Payment and other cloud-only mutations require Internet and must never be falsely queued as success.

Official target platforms:

- Windows Chrome;
- macOS Chrome;
- Android Chrome;
- iPhone/iPad Chrome/WebKit where capabilities permit.

Linux is not an advertised/certified target.

## UI rule

Use `docs/design-references/grok/` and owner-supplied repair screenshots as structural references while keeping OCADE branding and implementation original.

Target:

- near-black/charcoal foundation;
- clean white/grey typography;
- medium glassmorphism on sidebar, composer, settings, dialogs, pricing cards, menus and attachment surfaces;
- thin neutral borders;
- restrained highlights;
- large uncluttered workspace;
- subtle motion and progress animation;
- no cinematic or GPU-heavy decorative scenes;
- intentional desktop/tablet/mobile layouts;
- reduced-motion support.

## Repository hygiene

The only Markdown authorities allowed are:

- `CLAUDE.md`
- `PLAN.md`
- `docs/PRD.md`
- `docs/TRD.md`
- `docs/APP_FLOW.md`
- `docs/UI UX Brief.md`
- `docs/DESIGN.md`
- `docs/UI_REFERENCE_CHECKLIST.md`
- `docs/ARCHITECTURE.md`
- `docs/Backend Schema.md`
- `docs/RULES.md`
- `docs/TESTING.md`
- `docs/MEMORY.md`
- `docs/DECISIONS.md`

Do not create extra Markdown files for temporary reports. Fold durable decisions into these authorities. Machine-readable evidence may live in JSON or equivalent generated evidence files.

## Git and checkpoints

Use one isolated implementation branch.

After each `PLAN.md` phase passes:

1. update `docs/MEMORY.md` with phase result, branch, exact checkpoint SHA and next unfinished action;
2. create a descriptive checkpoint commit;
3. push it;
4. verify the remote branch points to the exact SHA;
5. continue automatically.

Never force-push shared history. Never merge a partial phase to `main`.

At the final gate, reconcile latest `origin/main` without force, rerun the complete gate set on that exact reconciled tree, merge/fast-forward to `main`, push and verify the final remote SHA/tree.

## Status output

Keep status concise. A phase-complete message may be one line, for example:

```text
Usage repaired — Phase 5 DONE — committed, verified, pushed — SHA <sha>
```

Concise reporting must never reduce implementation depth, testing, debugging or browser proof.