# OCADE Technical Requirements

## Architectural principles

1. One canonical authority per responsibility.
2. No duplicate auth, usage, intelligence, storage, payment or model-lifecycle systems.
3. Browser-visible state is not the source of truth for security, billing or entitlement.
4. Every network/provider failure is sanitized before reaching the customer.
5. Offline capability must fail honestly when storage/runtime requirements are unavailable.
6. Cowork/Jarvis implementation is forbidden during this mission.

## Web application

The primary app remains the existing React/TanStack web application and Cloudflare deployment architecture.

Required routes:

- `/`
- `/auth` and required callbacks/verification/challenge flows
- `/library`
- `/pricing`
- `/about`
- `/help`
- `/terms`
- `/privacy`
- hidden `/admin` where required

Deep-link refresh must work in production.

## Authentication

Use Supabase Auth only.

Required providers/flows:

- Google OAuth;
- email OTP;
- optional password/account recovery;
- MFA/assurance where required.

No custom password database or reversible credential storage.

Existing `auth.users`, identities, sessions, refresh tokens and MFA state are protected from cleanup migrations.

## Online intelligence

One server-side Edge Function boundary owns online inference.

Exactly three Gemini secrets:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

No secret in client bundles, normal DB rows or logs.

The boundary is pinned to exactly one provider model identifier,
`gemini-3.1-flash-lite`, and the allowlist accepts nothing else. This file is
the only document that carries the identifier: it is trusted server-side
deployment configuration, it never reaches a customer surface, and changing it
requires an owner decision plus the corresponding code and tests.

Failover occurs only before output and only for allowed key-local/auth/transport failures. Shared quota 429s must not be bypassed by key rotation.

## Offline Intelligence

Use the owner-approved private OCADE 0.6B runtime.

Tracked source should use opaque OCADE artifact ids rather than public vendor/model identifiers wherever possible.

Runtime policy:

- WebGPU-first when actually supported;
- WASM fallback;
- customer UI hides runtime names;
- one artifact installed initially;
- fallback artifact acquired only after a real runtime need;
- Fast default, Thinking optional.

## Model distribution

Artifacts are distributed from OCADE-controlled private Cloudflare R2 infrastructure.

Requirements:

- private bucket;
- no public object listing;
- opaque object/shard ids;
- short-lived authorised delivery;
- no R2 credentials in browser;
- integrity hashes;
- immutable shards;
- range/chunk resume;
- WAF/rate protection;
- no browser fetch from Hugging Face/public model host.

Adaptive parallelism measures real throughput and chooses the fastest stable concurrency rather than forcing a fixed maximum.

## Local storage

Use OPFS/persistent browser storage for model bytes and model-owned metadata where supported.

Installation state must distinguish:

- never installed;
- installing;
- ready;
- repair required;
- user intentionally uninstalled;
- browser/storage eviction;
- incompatible model revision.

`user_uninstalled` survives normal app updates, browser restarts and sign-in cycles. Automatic install is suppressed until the user explicitly requests Install.

## PWA/offline shell

Use a service worker/PWA cache strategy that lets the supported OCADE shell reopen without Internet.

Cache only what is safe and useful. Cloud-only mutations are never falsely completed offline.

Offline conversation changes use a deterministic local queue/sync path and reconcile when connectivity returns.

## Usage architecture

One server-authoritative account-wide commercial policy:

- Free: 28 / 6h28m, no weekly cap;
- Pro: 140 / 6h28m, 700/week;
- Max: 1,400 / 6h28m, 7,000/week.

All tiers use simple successful-request counting.

Use durable generation permits/idempotency so retries/fallback do not double-charge.

Offline generation requires a signed local lease and a tamper-evident local counter/event chain that reconciles to the server.

## Billing and entitlements

One final entitlement resolver combines:

- Free default;
- paid subscription;
- manual Admin entitlement grant;
- expiry/revocation.

Manual access never modifies `auth.users`.

Pricing/checkout cannot succeed offline.

## Attachments and Library

Supported attachment size is up to 100 MB per intentionally supported file, with a bounded total message size.

Cloud files use private Supabase Storage and RLS. Library is the single customer file/output authority.

Images require online OCADE for understanding. Offline document extraction may process textual formats only where safe, deterministic and tested.

## Supabase cleanup

Use migrations for schema changes, never ad-hoc destructive DDL.

Preserve auth/account/customer/legal/financial evidence. Remove retired product tables/functions/policies only after dependency tracing.

Stale development/launch/test logs may be deleted only when proven non-authoritative. Active operational logs should use bounded retention where appropriate.

Regenerate TypeScript DB types after final schema changes and run Supabase security/performance advisors.

## UI performance

Target medium glassmorphism, restrained animation and reduced-motion support.

Do not use heavy continuously animated GPU scenes. Offline model downloading/inference must not block basic UI responsiveness.

## Verification

Every phase must include the relevant combination of:

- typecheck;
- lint/format;
- unit tests;
- database tests;
- migration verification;
- secret scans;
- security/RLS advisors;
- production build;
- real-browser tests;
- offline/PWA tests;
- multi-device usage tests;
- customer-visible provider/model leak scans.
