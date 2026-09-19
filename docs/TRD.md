# OCADE Technical Requirements Document

## Runtime and package authority

OCADE is a TypeScript/React application built with Vite/TanStack and npm. `package.json` and `package-lock.json` are the only JavaScript package authority. The current runtime baseline is Node 22+, React 19, Supabase JS, TanStack Router/Query/Start, Tailwind CSS, and the existing Offline runtime package. Do not add another framework or runtime when the current stack already provides the needed primitive.

## Canonical online architecture

The browser authenticates through Supabase Auth and sends online intelligence work only through the one `ocade-intelligence` Supabase Edge Function. Gemini keys remain server-side in exactly three optional slots named `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, and `GEMINI_API_KEY_TERTIARY`. The browser never receives those values.

Exactly one online model is pinned: `gemini-3.1-flash-lite`. It is the only entry in the server-side allowlist, and changing it requires an explicit owner decision with corresponding tests and documentation. This identifier is an internal operational fact; customer surfaces still say only OCADE Online.

The Edge boundary verifies the JWT, validates the request contract, claims one generation permit through the canonical usage RPC, chooses the first healthy configured server-side key according to policy, streams output, and settles the permit exactly once. A provider failure before output may move to another configured key or Offline through the canonical router; a failure after output begins must not silently restart through a second authority.

The repository and deployed Edge Function must be version-compatible. A successful frontend build is insufficient evidence when the deployed function or database RPC contract is older.

## Canonical data authority

Supabase PostgreSQL is canonical for saved conversations/messages, Library metadata, account settings, entitlements, usage state, generation permits/events, and other durable account data. RLS and server-side authorization are mandatory for user-owned data.

Offline unsynchronized turns use only the minimum local pending-sync journal required to preserve work until reconnection. Each pending operation carries stable client identifiers/idempotency keys. Once successfully reconciled to Supabase, the pending local copy is retired. Local persistence must never become a second long-term cloud account-data authority.

OPFS remains reserved for verified Offline runtime binaries/chunks, activation metadata, and model-owned runtime assets. Explicit uninstall deletes the runtime bytes but does not delete cloud account data.

## Offline release authority

The approved release is:

```text
release id: ocr-2dc0ee44eb397906
byte length: 484220160
sha256: 2dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800
```

Delivery comes from the existing private OCADE-controlled Cloudflare R2 authority using opaque authorized object/release identifiers. The customer browser must not fetch the artifact from a public model host.

One installer controls discovery, download, checkpointing, integrity verification, repair, activation, removal, and reinstall. Do not create a second installer or manifest system for WebGPU or fallback.

The downloader uses adaptive bounded parallel ranges, persists completed verified chunks immediately, resumes after interruption/restart, refreshes expired authorization, repairs only corrupted/missing ranges, verifies the full artifact digest before activation, and activates atomically.

A verified compatible release survives ordinary OCADE deployments, refreshes, browser restarts, and account sign-out/sign-in without redownload. `user_uninstalled` is durable device/runtime state and suppresses all automatic installation until explicit Install Offline.

## Execution backends

The preferred local execution path is WebGPU only where the existing runtime and the approved artifact genuinely generate successfully. WASM is the automatic fallback when WebGPU is unavailable or fails before output. Customer-facing code and UI use capability names such as OCADE Offline Ready/Installing/Repairing rather than exposing backend labels.

The same artifact, usage gate, installer, conversation path, and response contract serve both local execution backends. A second model authority is forbidden unless a future owner-approved mission proves it is unavoidable.

## Routing contract

The routing authority accepts the customer intent `Auto`, `Online`, or `Offline` plus live connectivity/runtime state.

- Auto routes to Online when connectivity and the online boundary are healthy, to Offline when connectivity is absent and Offline is ready, and may fall back before online output if Offline is ready.
- Online routes only to connected intelligence and is disabled when connectivity is absent.
- Offline routes only to the local runtime and emits zero provider traffic.
- All successful paths settle one logical use through the same commercial authority.

Routing decisions must be observable in internal diagnostics without exposing secret/provider identity to normal customers.

## Usage contract

A permit is claimed before intelligence starts. One successful logical response settles one use. Failure/cancellation policy is explicit and tested; failures do not become successful charges through retries. Idempotency prevents double charging from repeated clicks, refreshes, multiple tabs, network retry, key failover, or reconnect.

Offline use draws from a signed/tamper-resistant account allowance mechanism and reconciles to the same canonical account-wide usage state. Offline cannot become an unlimited bypass.

## Attachment ingestion contract

The ingestion authority validates authentication/ownership, declared and detected file type, file size, total-message size, archive structure, decompression ratio, parser resource limits, and extraction bounds. Uploaded bytes are stored privately and are never executed.

Extracted document text is data, not trusted instructions. The intelligence layer separates system/tool authority from document content and preserves source metadata needed for file/page/section/row/cell references.

Images are sent only through connected intelligence paths that actually support them. Offline textual extraction is allowed only for formats the browser can parse safely within resource limits.

## Authentication contract

Supabase Auth is the sole identity authority. Launch methods are Google and six-digit email OTP. Phone auth is absent. Customer passwords are not required for the current flow.

Auth UI must resist useful email enumeration, rapid repeated OTP requests, replay, stale challenge state, duplicate native form submission, open redirects, and cross-account session confusion. Server/project rate limits and application controls are layered rather than treated as substitutes for each other.

## Async-state contract

Every network/database/runtime operation exposed in UI has a finite state model with timeout/retry policy. `loading` can transition only to `success`, `empty`, `error`, `cancelled`, or a documented long-running progress state. A permanent “Reading…” or “Loading…” screen is a bug.

## Performance contract

Prefer bounded reads, pagination, indexed queries, batched independent fetches, route/code splitting where justified, native browser APIs, and existing dependencies. Measure before adding optimization complexity. Review Supabase performance-advisor findings but trace real workload/callers before dropping indexes or policies.

Offline installation must remain responsive on approximately 25 Mbps consumer connections and avoid unbounded memory by streaming/chunking verification rather than holding the entire artifact in memory.

## Security contract

Secrets stay in server/provider secret stores. RLS protects user-owned rows and Library objects. Admin grants use explicit audited database functions/roles rather than editing `auth.users`. Destructive operations require authorization and appropriate confirmation.

Never trust client-provided user ids, entitlement, usage, model readiness, file ownership, MIME type, or payment state. Sanitize provider/database/internal errors before returning them to normal customers.

## Deployment contract

A release is a compatible set consisting of Git SHA, frontend bundle, Supabase Edge Function version/source, database migration state/generated types, and Offline manifest/release. Final production verification records all of them together.

## Repository-wide completion rule

This document is subordinate to the active implementation authority in `PLAN.md` and the engineering rules in `CLAUDE.md`, `docs/RULES.md`, and `docs/TESTING.md`. Complete the active plan, fix root causes with regression coverage, then run the separate adversarial enterprise-grade AI-platform QA pass before calling the product complete. After correctness is proven, apply YAGNI and KISS to remove safely unnecessary code and reduce duplicate authorities and maintenance surface. GitHub Actions is optional; required verification must still run through trusted local or agent execution and the existing direct production authorities.

## Active audit technical requirements

The Worker or Cloudflare edge must enforce HTTPS before application HTML is returned. Canonical-host and scheme handling are tested together.

Send captures account, conversation, request identity, and request-owned cleanup before the first await and rejects stale continuations after every asynchronous boundary. Regenerate preserves the original request options, including Thinking and Research, and uses an atomic or recoverable transcript replacement path.

A delivered answer and a persisted transcript are separate states: usage settlement must not become undelivered merely because transcript persistence fails after output reached the customer.

Offline uninstall reports success only after all intended model/runtime locations are verified absent. A failed OPFS/native deletion remains a retryable error state rather than clearing metadata and claiming removal.

Admin grants require an in-product MFA enrollment/challenge path to reach AAL2, server-side account search, and authoritative post-submit entitlement/audit confirmation.
