# OCADE Technical Requirements

## Core stack

Retain the current working web stack unless a smaller compatible implementation is proven better. The final product remains browser-first, Cloudflare-deployed and Supabase-backed.

## Authorities

There must be exactly one authority for each:

- identity/session → Supabase Auth;
- persistent account content → Supabase PostgreSQL/private Storage;
- AI usage/entitlement → server-authoritative usage permit system;
- online intelligence → OCADE server/Edge Function Gemini boundary;
- offline model bytes → browser OPFS;
- Chat/history → one conversation/message repository;
- Library → one file/output authority;
- Cowork/Jarvis → OCADE JARVIS runtime after `PLAN2.md`.

## Online intelligence

Use exactly three server-side secret slots:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

Secrets live in Supabase Edge Function/server secret storage, never a normal table or browser bundle.

Primary-first failover is allowed only before output and only for failures another key can reasonably fix. 429 must not rotate to evade project quota. Never restart/fail over after user-visible output begins.

The configured online model is pinned to exactly one identifier, `gemini-3.1-flash-lite`. It is the only model the allowlist accepts; a client-supplied model is refused. Changing it requires an explicit owner decision with corresponding tests and documents. Normal UI says `OCADE`, never the provider/model identifier.

## Offline Intelligence

The internal offline model is Qwen 2.5 1.5B, an implementation detail that must not appear in customer UI/copy.

Storage contract:

- OPFS contains model chunks/binaries and model-owned metadata only;
- normal account content is not persisted there;
- manifest contains model revision, chunk IDs/hashes, total integrity and runtime compatibility;
- model revision is independent of application commit/build SHA.

Install algorithm:

1. read local manifest;
2. validate required chunks;
3. reuse verified installation immediately;
4. fetch missing chunks concurrently with bounded/adaptive parallelism;
5. persist each completed chunk transactionally;
6. resume after interruption;
7. verify complete fingerprint;
8. repair only bad/missing chunks;
9. never full-redownload a valid unchanged model.

Request persistent browser storage where supported. Detect eviction honestly. A new service worker/app deploy must not clear OPFS.

Explicit Remove deletes the model and records user intent so automatic first-visit preparation does not immediately reinstall it until explicit Install.

## Routing

`Auto` chooses online OCADE when usable and may fall back to verified Offline Intelligence when policy permits. `Offline` performs zero provider traffic. All generation routes require the same account usage permit.

## Usage

Free: 28 successful user requests per 388 minutes.

Use one account-wide server ledger plus signed/bounded offline reconciliation. Concurrent devices must not each receive independent capacity. Count one successful user request once; internal tool/model steps are execution detail.

## Authentication

Supabase Auth supports:

- Google OAuth;
- email OTP;
- phone OTP with E.164 normalized numbers/country picker;
- optional password/account recovery when enabled.

Use anti-enumeration wording, resend/backoff controls and safe redirect validation. Production UI exposes a provider only when live Supabase/provider delivery is configured.

## Library

Metadata and authorization live in PostgreSQL; file/image bytes use private Storage where appropriate. Access is owner/account scoped with RLS/signed retrieval as required.

## Cowork/Jarvis

Not implemented during `PLAN.md`. `PLAN2.md` integrates the OCADE JARVIS donor as one runtime. Native/browser helpers are infrastructure only, not a separate desktop product.

## Security

- RLS on customer tables;
- least-privilege RPCs/functions;
- recent stronger authentication for dangerous account/Admin actions where applicable;
- no server secret in browser, logs or generated artifacts;
- no arbitrary native/process/filesystem access without scoped capability and validation;
- all state-changing automation reports success only after postcondition verification.

## Performance

- lazy-load route-specific heavy capabilities;
- no local model/runtime bundle in first paint;
- parallel model download is bounded by device/network safety;
- avoid unbounded reads and N+1 queries;
- paginate growing lists;
- no continuous heavy GPU animation in ordinary UI.
