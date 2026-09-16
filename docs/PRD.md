# OCADE Product Requirements

## Product

OCADE is a clean AI workspace centered on Chat, with online intelligence, private Offline Intelligence, Library, Pricing, account controls and secure cross-device usage enforcement.

Cowork is not part of the active implementation mission. It may appear only as an unavailable placeholder until the owner explicitly starts a future Cowork project after `PLAN.md` is complete.

## Primary customer surfaces

- `/` — Chat
- `/library` — Library
- `/pricing` — Pricing
- Account → Settings
- `/auth`
- `/about`
- `/help`
- `/terms`
- `/privacy`
- hidden Admin for real operational needs

Retired broad-product routes remain removed/404.

## Chat

Chat is the product home.

Required behavior:

- signed-out shell is visible;
- Send requires authentication;
- New Chat opens a clean composer without creating an empty database conversation;
- recent history;
- rename/archive/trash/restore/delete where retained by the canonical Chat authority;
- attachments through `+`, drag/drop and paste;
- microphone;
- Send/Stop;
- Auto/OCADE/Offline selector;
- upload progress and retry;
- attachment remove/reorder before send;
- Copy;
- Edit prompt;
- Regenerate;
- Delete;
- Retry failed generation;
- code-block Copy;
- Markdown, tables and links;
- attachment preview/download;
- up to 100 MB per deliberately supported attachment.

Edit→successful regenerate and Regenerate→successful answer each count as one new use. Failed generations cost zero.

## OCADE identity

Normal customers interact only with **OCADE**.

Customer-visible answers, UI, progress states, ordinary errors and exports must not reveal raw provider/model/runtime identities.

If asked what model/provider OCADE is, identify as OCADE rather than exposing backing implementation details.

## Online intelligence

Online OCADE uses one secure server/Edge boundary.

Exactly three Gemini secret slots are permitted:

- `GEMINI_API_KEY_PRIMARY`
- `GEMINI_API_KEY_SECONDARY`
- `GEMINI_API_KEY_TERTIARY`

The keys are server-side secrets only.

When implementation reaches the Gemini deployment phase, the agent must ask the owner for exactly three Gemini API keys as secrets, add them securely where tooling permits, deploy the Edge Function and prove a real production answer.

## Offline Intelligence

Offline Intelligence uses the owner-approved private OCADE 0.6B runtime.

Product labels are only OCADE/Offline/Offline Intelligence.

Internal strategy:

- WebGPU first where genuinely supported;
- WASM fallback where required;
- only one artifact downloaded initially;
- private Cloudflare R2 distribution;
- opaque artifact/shard ids;
- adaptive parallel download;
- OPFS/persistent storage;
- resume, verification and targeted repair;
- Fast default and optional Thinking mode.

Customer browsers must not fetch model bytes from Hugging Face/public model hosts.

If the user manually uninstalls Offline Intelligence, OCADE records that intent and never auto-redownloads because of site updates, deploys, browser restarts or later sign-ins. The UI must say that the user uninstalled it and offer **Install Offline**. Only an explicit Install clears the suppression.

If Offline Intelligence was never installed and the user is offline, OCADE must explain that one Internet connection is required for installation and remember the install request for when connectivity returns.

## Routing

Default behavior:

- Internet + healthy online OCADE → online OCADE.
- Online failure before output + Offline ready → local fallback.
- No Internet + Offline ready → Offline Intelligence.
- No Internet + Offline absent → install/connect-once guidance.

Offline mode creates zero provider traffic.

A successful fallback consumes exactly one use total.

Images require online OCADE. Local document extraction may be used only for textual formats that can be safely supported.

## Usage

One successful user request = one use across all devices and online/offline modes.

Allowances:

- Free: 28 per 6h28m, no weekly cap.
- Pro: 140 per 6h28m and 700 per week.
- Max: 1,400 per 6h28m and 7,000 per week.

Max is exactly 10× Pro.

Usage is account-wide. Exhaustion locks generation everywhere while keeping history, Library, Settings, Billing and Pricing usable.

Offline usage uses a signed/tamper-resistant lease and reconciles later.

## Pricing

Public `/pricing` is required.

| Tier | Weekly                   | Monthly                  |
| ---- | ------------------------ | ------------------------ |
| Free | Free                     | Free                     |
| Pro  | $8 / €8 / £8 / ₹288      | $28 / €28 / £28 / ₹1,888 |
| Max  | $28 / €28 / £28 / ₹1,888 | $88 / €88 / £88 / ₹5,888 |

Use regional currency with manual override. Pricing connects to real checkout, subscription/entitlement and allowance. Payment never processes or queues offline.

## Authentication

Supabase Auth is the only identity authority.

Required:

- Google;
- email 6-digit OTP;
- optional password where deliberately supported;
- MFA/assurance for sensitive actions where required.

Existing users and logged-in sessions must survive database cleanup.

## Library

Library is the single customer file/output authority.

Required:

- All / Images / Files;
- search;
- preview;
- download;
- delete;
- delete-all through Data Controls;
- private storage/RLS;
- cross-device sync for cloud content;
- local availability only where intentionally cached offline.

## Settings

Categories:

- Account
- Appearance
- Notifications
- Data Controls
- Billing
- Advanced

Data Controls owns account export/deletion flows, conversation/file deletion and Offline Intelligence install/remove state.

## Admin

Hidden Admin must provide a clean manual entitlement-grant workflow without editing `auth.users`:

- search user;
- see current tier;
- grant Free/Pro/Max;
- optional start/end;
- reason;
- revoke;
- audit grant/revoke actor.

Manual grants and paid subscriptions remain separate evidence sources resolving into one final entitlement.

## Whole-site offline

`ocade.in` is a website, used in a browser, and is never offered as an application to install. Nothing in the product promotes installing it.

When Internet is unavailable, the cached shell must still open and honestly provide local functionality: Offline Chat when installed, locally available history/Library content, Account/Settings shell, Pricing information and public/legal pages.

Cloud-only mutations such as payment clearly require Internet.

Official target platforms:

- Windows Chrome
- macOS Chrome
- Android Chrome
- iPhone/iPad Chrome/WebKit where capabilities permit

Linux is not an advertised/certified target.

## UI

The product uses a near-black/charcoal foundation with clean grey/white typography, medium glassmorphism on high-value surfaces, restrained motion, thin neutral borders and a large uncluttered workspace.

Design must work intentionally on desktop, tablet and phone and respect reduced-motion/accessibility expectations.

## Release condition

Cowork remains unimplemented until every phase in `PLAN.md` passes together on the exact production/merged tree.
