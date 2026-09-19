# OCADE Technical Requirements Document

## Product/technical boundary

CARCC is the company; OCADE is the product. The current technical mission is the OCADE website only.

## Frontend

- React 19 + TypeScript.
- TanStack Router/Query/Start.
- Vite.
- Tailwind CSS.
- Existing shared UI tokens/components; no second design system.

## Runtime and package management

- Node 22+.
- npm and the checked-in lockfile are authoritative.
- Prefer native browser/platform APIs and existing dependencies before adding libraries.

## Backend and database

- Supabase Auth and PostgreSQL are the identity and durable account-data authorities.
- User-owned rows require RLS plus appropriate grants/server-side authorization.
- Supabase Storage is used only for account file content that belongs in cloud account storage.
- Schema changes are versioned migrations with rollback/verification and regenerated TypeScript types.

## Hosting and delivery

- Cloudflare Worker serves the website.
- Canonical origin: `https://ocade.in`.
- Private Cloudflare R2 delivery is used for the opaque Offline Intelligence release.
- HTTP and `www` canonicalization must occur before application HTML is served.

## Authentication

Target OCADE website authentication:
- Google;
- six-digit email OTP;
- password sign-in.

MFA/strong reauthentication is required for privileged administrative or destructive operations according to risk.

## Online Intelligence

There is one server-side Online Intelligence boundary. The browser sends a normalized OCADE request; the boundary verifies account identity and one generation permit, calls the configured provider, streams normalized events, and settles exactly once.

Provider/model/vendor identity is private implementation configuration. Prefer generic OCADE secret/config names and server-only configuration. Do not place real provider/model identity in client bundles, public docs, normal telemetry, customer errors or customer-visible diagnostics.

Changing the online provider/model is an owner-controlled operational change and must not change the customer contract `Auto | Online | Offline`.

## Offline Intelligence

One opaque OCADE release, one installer, one downloader, one model lifecycle.

### OPFS-only model storage

All Offline model **bytes, partial chunks/ranges, download checkpoints, integrity state, model metadata, active/previous model pointers and runtime-owned model assets** must live in OPFS.

Do not use:
- IndexedDB for model bytes/chunks;
- Cache Storage for model bytes/chunks;
- localStorage for model bytes/chunks/model metadata;
- normal browser downloads;
- a library-internal second model cache.

A non-model preference that must survive deletion of the model itself—such as “customer explicitly removed Offline Intelligence”—may be stored outside OPFS as a small product/device preference.

### Transfer requirements

- Adaptive bounded range requests.
- Persist each completed verified range/checkpoint.
- Resume after refresh/restart/interruption.
- Refresh expiring authorization.
- Verify expected byte length and full digest before activation.
- Repair only missing/corrupt ranges.
- Atomic activation.
- Never redownload a verified compatible release because the website bundle changed.
- Explicit Remove verifies deletion before saying Removed.

### Execution

Use the strongest proven local capability automatically and fall back before output. Backend/runtime labels are internal only. Manual Offline emits zero Online provider traffic.

Offline images are unsupported: refuse image input before generation rather than pretending to process it.

## Local pending account work

Disconnected account work that must survive browser restart may use an encrypted local journal separate from model storage. It requires stable client/idempotency keys and exactly-once reconciliation to the canonical account database. Plaintext local persistence of conversations is not allowed.

## Intelligence routing

- **Auto:** Online when healthy/connected; Offline when disconnected and ready; pre-output fallback only.
- **Online:** connected OCADE only.
- **Offline:** local only.
- One successful logical request uses one commercial permit regardless of internal routing/fallback.

## Usage

- Free 28 / 6h28m.
- Pro 140 / 6h28m + 700/week.
- Max 1,400 / 6h28m + 7,000/week.
- Account-anchored windows.
- Same authority for all devices and modes.
- Failure/empty response releases/refunds the reservation.
- Idempotency covers double clicks, retries, tabs, reconnects and failover.

## Files

Validate ownership, size, detected type, request aggregate limits and extraction bounds. Never execute uploaded data. Extracted text is untrusted content, never system/tool instruction.

Offline refuses images. Temporary Chat does not persist files into Library without an explicit Save.

## Commercial/payments

The product retains pricing/tier metadata but paid checkout is closed. No Paddle runtime, webhook or checkout should be part of the current product target. Upgrade surfaces explain that paid plans are not open and perform no charge.

## Security

- Secrets only in server/provider secret stores.
- No service-role or provider secret in client code.
- No provider/model/vendor identity in normal client/customer surfaces.
- Strong auth for admin/grant operations.
- Direct client writes to revocation/entitlement security fields are forbidden.
- Sanitize internal errors.
- CSP and canonical-origin controls remain strict.

## Performance

- Bounded reads and pagination.
- Indexed account/admin searches.
- Stream large files/model verification rather than materializing them unnecessarily.
- Keep Chat interactive while Offline downloads.
- Mobile layouts must remain responsive during network/database/model activity.

## Deployment

A release is proven only when the Git SHA, website Worker, database migration/type state, Online Intelligence function/version and Offline release contract are compatible. A successful build alone is not production proof.

## Environment variables

Document **names, never values**. Public build variables may include Supabase public URL/key and auth-method feature flags. Server secrets must use generic OCADE provider naming where feasible and must not reveal secret values in source/logs.
