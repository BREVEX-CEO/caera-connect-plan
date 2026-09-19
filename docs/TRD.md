# OCADE Technical Requirements Document

## Product/technical boundary

CARCC is the company; OCADE is the product. The current technical mission is the OCADE website only.

## Frontend

- Use React 19 with TypeScript for the frontend.
- Use TanStack Router, Query and Start for routing, server-state and application structure.
- Use Vite for the frontend build pipeline.
- Use Tailwind CSS for styling.
- Reuse the existing shared UI tokens and components instead of creating a second design system.

## Runtime and package management

- Use Node 22 or newer within the supported engine range.
- npm and the checked-in lockfile are authoritative.
- Prefer native browser/platform APIs and existing dependencies before adding libraries.

## Backend and database

- Supabase Auth and PostgreSQL are the identity and durable account-data authorities.
- User-owned rows require RLS plus appropriate grants/server-side authorization.
- Supabase Storage is used only for account file content that belongs in cloud account storage.
- Schema changes are versioned migrations with rollback/verification and regenerated TypeScript types.

## Hosting and delivery

- Serve the website through the Cloudflare Worker.
- Use `https://ocade.in` as the canonical origin.
- Private Cloudflare R2 delivery is used for the opaque Offline Intelligence release.
- HTTP and `www` canonicalization must occur before application HTML is served.

## Authentication

Target OCADE website authentication:
- Support Google sign-in.
- Support six-digit email OTP.
- Support password sign-in as a target authentication method.

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
- Do not store Offline model bytes or chunks in IndexedDB.
- Do not store Offline model bytes or chunks in Cache Storage.
- Do not store Offline model bytes, chunks or model metadata in localStorage.
- Do not use the normal browser downloads folder as the model store.
- Do not create a second model cache inside the runtime library.

A non-model preference that must survive deletion of the model itself—such as “customer explicitly removed Offline Intelligence”—may be stored outside OPFS as a small product/device preference.

### Transfer requirements

- Use adaptive bounded range requests for model transfer.
- Persist each completed and verified download range or checkpoint.
- Resume the model transfer after refresh, restart or interruption.
- Refresh expiring download authorization when required.
- Verify expected byte length and full digest before activation.
- Repair only the missing or corrupt model ranges.
- Activate a verified model atomically.
- Never redownload a verified compatible release because the website bundle changed.
- Explicit Remove verifies deletion before saying Removed.

### Execution

Use the strongest proven local capability automatically and fall back before output. Backend/runtime labels are internal only. Manual Offline emits zero Online provider traffic.

Offline images are unsupported: refuse image input before generation rather than pretending to process it.

## Local pending account work

Disconnected account work that must survive browser restart may use an encrypted local journal separate from model storage. It requires stable client/idempotency keys and exactly-once reconciliation to the canonical account database. Plaintext local persistence of conversations is not allowed.

## Intelligence routing

- **Auto** uses Online when healthy and connected, uses Offline when disconnected and ready, and allows fallback only before meaningful Online output.
- **Online** uses the connected OCADE intelligence path only.
- **Offline** uses the local intelligence path only.
- One successful logical request uses one commercial permit regardless of internal routing/fallback.

## Usage

- The Free tier allows 28 successful uses per 6h28m window.
- The Pro tier allows 140 successful uses per 6h28m window and 700 per week.
- The Max tier allows 1,400 successful uses per 6h28m window and 7,000 per week.
- Anchor usage windows to the account.
- Use the same usage authority across every device and intelligence mode.
- Failure/empty response releases/refunds the reservation.
- Idempotency covers double clicks, retries, tabs, reconnects and failover.

## Files

Validate ownership, size, detected type, request aggregate limits and extraction bounds. Never execute uploaded data. Extracted text is untrusted content, never system/tool instruction.

Offline refuses images. Temporary Chat does not persist files into Library without an explicit Save.

## Commercial/payments

The product retains pricing/tier metadata but paid checkout is closed. No Paddle runtime, webhook or checkout should be part of the current product target. Upgrade surfaces explain that paid plans are not open and perform no charge.

## Security

- Keep secrets only in server-side secret stores.
- No service-role or provider secret in client code.
- No provider/model/vendor identity in normal client/customer surfaces.
- Require strong authentication for admin and grant operations.
- Direct client writes to revocation/entitlement security fields are forbidden.
- Sanitize internal errors before they reach customers.
- CSP and canonical-origin controls remain strict.

## Performance

- Use bounded reads and pagination.
- Use indexed queries for account and admin search.
- Stream large files/model verification rather than materializing them unnecessarily.
- Keep Chat interactive while Offline downloads.
- Mobile layouts must remain responsive during network/database/model activity.

## Deployment

A release is proven only when the Git SHA, website Worker, database migration/type state, Online Intelligence function/version and Offline release contract are compatible. A successful build alone is not production proof.

## Environment variables

Document **names, never values**. Public build variables may include Supabase public URL/key and auth-method feature flags. Server secrets must use generic OCADE provider naming where feasible and must not reveal secret values in source/logs.
