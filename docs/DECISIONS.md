# OCADE Decisions

This file records durable owner-approved product decisions for the current pre-Cowork mission.

## Planning

- `PLAN.md` is the only active execution plan.
- `PLAN2.md` is removed.
- Cowork/Jarvis implementation is blocked until `PLAN.md` is completely finished and the owner explicitly starts a new mission.
- Cowork may remain only as an unavailable placeholder.

## Default agent modes

Every implementation session starts with both:

```text
/ponytail ultra
/caveman ultra
```

They remain the default session modes unless the owner changes them.

## Product surfaces

Keep:

- Chat;
- Library;
- Pricing;
- Account/Settings;
- auth;
- online OCADE;
- Offline Intelligence;
- usage/billing;
- About, Help, Terms, Privacy;
- hidden Admin for real operational work.

Retired broad-product surfaces stay deleted/404.

## Customer identity

All customer-facing AI modes identify as **OCADE**.

Normal UI/responses/errors must not reveal raw provider/model/runtime names.

For Offline Intelligence, use opaque OCADE artifact ids and remove obsolete tracked public model-name/catalogue leakage. Do not claim impossible perfect secrecy from a determined device owner; minimise disclosure as strongly as possible.

## Online provider

Online OCADE uses Gemini behind one server/Edge boundary.

Exactly three Supabase secrets:

- `GEMINI_API_KEY_PRIMARY`
- `GEMINI_API_KEY_SECONDARY`
- `GEMINI_API_KEY_TERTIARY`

When that phase begins, ask the owner for exactly three Gemini API keys as secrets. The owner intends to provide them.

## Authentication

Supabase Auth only.

Required:

- Google;
- email OTP;
- phone OTP;
- optional password where deliberately supported;
- MFA/assurance where required.

Supabase cleanup must not delete existing accounts/logged-in users/sessions.

## Usage

Use simple successful-request counting for all tiers.

- Free: 28 / 6h28m, no weekly cap.
- Pro: 140 / 6h28m, 700/week.
- Max: 1,400 / 6h28m, 7,000/week.
- Max is exactly 10× Pro.

One successful answer = one use.

Failed request/internal retry = zero extra uses.

Edit→successful regenerate and Regenerate→successful answer each cost one use.

Usage is shared account-wide across devices and online/offline paths.

## Pricing

Approved catalogue:

| Tier | Weekly                   | Monthly                  |
| ---- | ------------------------ | ------------------------ |
| Free | Free                     | Free                     |
| Pro  | $8 / €8 / £8 / ₹288      | $28 / €28 / £28 / ₹1,888 |
| Max  | $28 / €28 / £28 / ₹1,888 | $88 / €88 / £88 / ₹5,888 |

Public `/pricing` returns.

Use regional currency plus manual override.

Payment does not process or queue offline.

## Manual user access

Owner/admin must be able to grant/revoke Free/Pro/Max access easily through hidden Admin.

Use a canonical auditable entitlement-grant authority. Never edit `auth.users` directly.

## Offline runtime

Use the owner-approved private OCADE 0.6B local runtime.

- WebGPU-first where verified;
- WASM fallback;
- one artifact downloaded initially;
- fallback artifact only when required;
- Fast default + optional Thinking.

Customer-facing product never exposes those internal runtime labels.

## Model hosting/download

- private OCADE-controlled Cloudflare R2;
- not Hugging Face in customer browser;
- opaque authorised artifact/shard ids;
- private bucket/no public listing;
- adaptive parallel download;
- prefer highest measured stable throughput, not highest fixed concurrency;
- shard checkpoint/resume/targeted repair;
- OPFS/persistent browser storage.

## Explicit uninstall

If a user manually removes Offline Intelligence:

- model bytes are deleted;
- `user_uninstalled` persists across deploys, site updates, browser restarts and sign-in cycles;
- no automatic redownload occurs;
- UI says the user uninstalled it and offers **Install Offline**;
- only explicit Install clears the suppression.

If never installed and currently offline, explain connect-once installation and retain install intent.

## Routing

- Internet + online OCADE healthy → online OCADE.
- Online provider fails before output + Offline ready → local fallback.
- No Internet + Offline ready → local.
- No Internet + Offline absent → install/connect-once guidance.
- Offline mode makes zero provider requests.
- Successful fallback costs one use total.

Images require online OCADE. Offline local extraction may support textual file formats only where safely implemented.

## Whole-site offline

`ocade.in` is a website and is never offered as an application to install. No install prompt, no desktop or native app, no app-store listing, no web app manifest. The service worker and offline shell stay.

When Internet is absent, cached/local-capable OCADE pages and Offline Chat should still work honestly.

Cloud-only mutations such as payment require Internet.

Official target focus:

- Windows Chrome;
- macOS Chrome;
- Android Chrome;
- iPhone/iPad Chrome/WebKit where supported.

Linux is not advertised/certified.

## Chat feature decisions

Required:

- `+` attachment menu;
- drag/drop;
- paste;
- microphone;
- Send/Stop;
- Copy;
- Edit;
- Regenerate;
- Delete;
- Retry;
- code-block Copy;
- Markdown/tables/links;
- upload progress/retry;
- attachment preview/download;
- up to 100 MB per supported attachment.

New Chat does not create an empty database conversation before first Send.

## UI

- near-black/charcoal;
- medium glassmorphism on high-value surfaces;
- restrained motion;
- clean responsive desktop/tablet/mobile structure;
- Grok references + owner repair screenshots for layout/density direction;
- no heavy cinematic/3D scene.
