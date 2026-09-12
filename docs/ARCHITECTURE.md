# OCADE Architecture

## System shape

OCADE is one web product with one authority per domain.

```text
Browser / PWA
├─ App shell + routing
├─ Chat UI
├─ Library UI
├─ Pricing / Billing UI
├─ Settings / Account UI
├─ Offline runtime + OPFS
└─ Service worker / offline cache

Server / Supabase
├─ Supabase Auth
├─ conversations/messages
├─ Library metadata/private Storage
├─ commercial usage + generation permits
├─ subscriptions/payment evidence
├─ manual entitlement grants
├─ settings/notifications
├─ security/admin state
└─ ocade-intelligence Edge Function

Cloudflare
├─ web deployment
└─ private R2 model distribution
```

Cowork/Jarvis runtime is absent during this mission.

## Canonical authorities

### Identity

Supabase Auth only.

### Chat persistence

Supabase conversations/messages are the cloud authority. Local offline work may be queued/cached for later sync, but it must reconcile into the same conversation authority rather than creating a second permanent chat database.

### Usage

One commercial policy and ledger own all usage across online/offline/devices.

Generation sequence:

```text
acquire durable permit
→ choose intelligence route
→ stream/produce output
→ deliver answer
→ finalize permit once
```

Failures release/no-charge according to the policy.

### Online intelligence

One Edge Function boundary owns provider access. Browser never owns Gemini keys.

### Offline Intelligence

One product capability with two internal runtime forms:

- WebGPU-first where verified;
- WASM fallback.

The customer sees only Offline/Offline Intelligence.

### Model storage

Private OCADE R2 delivery → resumable verified shards → OPFS.

The app build version is independent from the model artifact version.

### Files

Library is the only customer-visible file/output authority. Cloud content lives in private Supabase Storage with RLS. Local cached copies are optional/offline helpers, not a second customer file system.

### Entitlement

One final entitlement resolver combines free default, paid subscription and manual Admin grant.

Manual grants are not payment records and never edit `auth.users`.

## Online/offline routing

```text
Auto / OCADE
  internet + provider healthy → online OCADE
  provider failure before output + local ready → Offline Intelligence
  no internet + local ready → Offline Intelligence
  no internet + local absent → install/connect-once guidance

Offline
  provider traffic = 0
  local runtime only
```

Fallback never creates multiple usage charges.

## Private offline-model delivery

The tracked repository should not expose a public model catalogue/name where avoidable.

The browser obtains authorised opaque artifact/shard metadata from OCADE-controlled infrastructure. R2 credentials never reach the browser.

Use immutable shards and integrity checks. Persist verified pieces immediately so a killed browser resumes rather than restarts.

Explicit user uninstall is represented by durable local preference and suppresses future automatic reinstall until the user requests Install.

## PWA/offline architecture

The service worker caches the app shell and stable public/static assets required for honest offline operation.

Do not cache secrets or server-authoritative account state as if it were permanent truth.

Local offline conversations/changes use a deterministic queue and sync process with idempotency/conflict handling.

Payment and other cloud-only mutations are never reported successful while offline.

## Security boundaries

- secrets stay server-side;
- RLS guards user-owned cloud content;
- service-role operations stay server-side;
- admin/manual grants require admin authorization;
- provider errors are sanitized;
- local allowance lease is signed/tamper-resistant;
- storage/model hashes detect corruption/substitution;
- customer-visible diagnostics do not leak private provider/model details unnecessarily.

## Supported deployment targets

- Windows Chrome
- macOS Chrome
- Android Chrome
- iPhone/iPad Chrome/WebKit where browser capabilities permit

Linux is not an advertised/certified target.

## No duplicate-system rule

Do not add a second:

- auth store;
- chat database;
- usage meter;
- entitlement resolver;
- intelligence router;
- offline model lifecycle;
- settings store;
- Library store;
- payment catalogue.

Repair or replace the canonical authority in place.