# OCADE Architecture Authority

## Architectural principle

OCADE must have one clear authority for each responsibility. New work should simplify or strengthen an existing authority before creating another store, router, installer, hook, service, worker, or schema family.

## Customer surfaces

The current product shell is intentionally small: Chat, Library, Cowork placeholder, Pricing/public legal/help pages, Settings, and hidden Admin. Cowork expansion is frozen until the Chat-first production mission is complete.

Chat is the root surface. Library is the private file/output surface. Settings contains Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced. Hidden Admin exists only for authorized operational work such as entitlement grants.

## Identity authority

Supabase Auth is the only identity authority. Active customer methods are Google and email OTP. The browser holds a normal Supabase session; privileged authorization is checked server-side/RLS rather than inferred from visible UI.

Existing Auth users, identities, sessions, and refresh tokens are protected during schema cleanup. Admin entitlement operations never mutate `auth.users` to represent a product tier.

## Persistent account-data authority

Supabase PostgreSQL is canonical for durable conversations/messages, Library metadata, settings, entitlements, usage state, generation permits/events, and other account records used by the current product. Supabase Storage holds Library objects in a private bucket protected by ownership policies.

Local browser persistence is narrowly scoped. OPFS stores Offline runtime artifacts and model-owned metadata. A pending disconnected-chat journal may temporarily hold unsynchronized operations with stable idempotency keys. Device/runtime security state may persist where needed for offline usage enforcement. None of these become competing canonical cloud-account stores.

## Online intelligence authority

The browser never calls the provider with a customer-visible key. Online requests go to the single Supabase Edge Function `ocade-intelligence`.

The boundary verifies the Supabase JWT, validates the normalized request contract, claims the canonical usage permit, invokes the configured connected provider through server-side secrets, streams the response, and settles the logical generation. The current live function is version 6; repository source must be deployed/reconciled before production parity is claimed.

Exactly three server-side key slots exist: `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, and `GEMINI_API_KEY_TERTIARY`. Failover is bounded, health-driven, and only before provider output starts. Key rotation must not be used to evade shared quota.

## Commercial usage authority

One usage authority sits above every intelligence backend. A generation permit/idempotency key is acquired before work. Exactly one successful logical request settles one use; failure settles zero. Retries, duplicate clicks, multiple tabs, reconnect, key failover, and Online→Offline pre-output fallback must not produce duplicate charges.

Offline usage relies on signed/tamper-resistant device allocation/lease state that reconciles to the same account-wide authority rather than becoming an unlimited local bypass.

## Intelligence-routing authority

One router receives customer intent (`Auto`, `Online`, `Offline`) and live availability state.

- Auto uses Online when connected intelligence is healthy, Offline when Internet is absent and local readiness is proven, and may use Offline after a pre-output Online failure.
- Online uses connected intelligence only and is disabled when Internet is unavailable.
- Offline uses the local runtime only and makes zero provider calls.

The UI may describe the route as OCADE Online/Offline but does not expose provider/model/runtime implementation names.

## Offline Intelligence authority

The one approved release is `ocr-2dc0ee44eb397906`, length `484220160`, SHA-256 `2dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800`.

Private OCADE-controlled Cloudflare R2 is the distribution authority. One installer/downloader manages authorized delivery metadata, adaptive ranged transfer, verified checkpointing, resume, authorization refresh, full digest verification, targeted repair, atomic activation, Remove, and reinstall.

OPFS stores the verified active runtime and model-owned assets. Compatible OCADE site deployments do not redownload it. Explicit Remove persists a `user_uninstalled` decision that only explicit Install Offline clears.

The execution preference is WebGPU where real generation succeeds, with WASM fallback before output. This is one lifecycle and one artifact, not two products.

## Conversation and offline-sync authority

Supabase conversations/messages are canonical when connected. A disconnected Offline turn is assigned stable client ids and placed in the minimal pending-sync journal required to survive practical browser interruptions. Reconnect uploads exactly once using idempotency and then retires the pending copy.

Temporary/incognito conversations remain memory-only and never synchronize.

## Attachment and Library authority

One ingestion pipeline serves Chat and Library. It authenticates the user, validates ownership, enforces file/message bounds, verifies declared/detected type, constrains archive/extraction behavior, stores objects privately, extracts supported content as untrusted data, and preserves source metadata.

The normalized attachment representation is passed to intelligence. There is no separate “uploaded but never read” path.

## UI state authority

Each asynchronous feature owns a finite state machine rather than scattered booleans. Loading must resolve to success, empty, error/Retry, cancelled, or a genuine progress state. Permanent “Reading…”/“Loading…” screens are architectural defects.

## Deployment authority

A production release is a compatible tuple: Git commit, frontend build, Supabase Edge Function source/version, database migration/type state, and Offline release manifest. Release verification records these together and smoke-tests the actual deployed combination.

## Observability and privacy

Internal diagnostics may record enumerated route/result/error categories needed to debug production, but must not log prompts, secrets, raw provider keys, sensitive attachment contents, or privileged customer data. Normal customer errors remain concise and sanitized.

## Security boundaries

RLS/server checks protect user data. Admin operations require server-side authorization and auditable grants. File contents are hostile input. Client-provided entitlement, user id, usage count, MIME type, model readiness, payment state, and admin status are never trusted without authoritative verification.

## Simplicity rule

When two implementations provide the same responsibility, trace callers and retain the stronger canonical implementation. Delete the weaker duplicate after tests prove no needed path depends on it. Architecture quality is measured by fewer authorities and clearer contracts, not by the number of modules.
