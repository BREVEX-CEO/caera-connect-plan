# OCADE Project Rules

## General

- Current owner request and `PLAN.md` govern the active mission.
- CARCC is the company; OCADE is the product.
- Do not use current CADANE branding.
- Keep the current product website-only and Chat-first.
- Prefer fewer maintained lines, fewer authorities and fewer moving parts.

## Code organization

Keep responsibility with the existing authority:

- Keep Chat state in the Chat authority.
- Keep routing decisions in the intelligence router.
- Keep usage accounting in the commercial authority.
- Keep the Offline lifecycle in one installer/vault authority.
- Keep durable account state in the account backend.

Do not build a parallel solution because editing the existing one is harder.

## Naming

Customer-safe names: OCADE, Auto, Online, Offline, Library, Settings.

Provider/model/runtime/vendor names are not customer-facing names.

## Type safety

No broad `any` to bypass a real contract. Validate untrusted network/storage/file data at the boundary.

## Error handling

- Never swallow a failure that changes what the customer believes happened.
- Every customer-visible async operation terminates.
- Errors are actionable and sanitized.
- Do not report successful deletion/install/payment/sync until authoritative success is verified.

## API rules

- Bound body sizes/list lengths/output.
- Authenticate the request before protected work starts.
- Use stable idempotency keys for logical retries.
- Propagate cancellation through the full request path.
- No client-supplied ownership/entitlement trust.

## Database rules

- Use versioned migrations with rollback and verification.
- Use both row-level security and explicit grants.
- Require strong authentication for privileged RPCs.
- Use indexed and bounded reads.
- Regenerate/destructive multi-row mutations are atomic or recoverable.
- Historical tables are not product requirements.

## Security rules

- Keep secrets on the server side.
- No provider/model/vendor identity in normal UI, public docs, client logs or bundle-visible diagnostics.
- No direct browser write to revocation/entitlement authority.
- Treat uploaded files and extracted content as hostile input everywhere.
- Cross-account state never survives account switch.
- Keep the Admin surface hidden and role-gated.

## Offline storage rules

Model storage/download is OPFS-only:

- Store Offline model bytes, chunks, checkpoints, metadata, pointers and runtime model assets in OPFS only.
- Do not keep a duplicate Offline model copy in IndexedDB, Cache Storage or localStorage.
- A normal site update must not redownload an unchanged verified Offline release.
- An explicit Remove action must suppress automatic reinstall until the customer explicitly chooses Install.

## Dependency rules

Use platform/native APIs or installed dependencies first. New dependency requires a real need and must reduce rather than multiply maintenance.

## UI rules

- Keep the interface dark, premium and minimal.
- Do not build dashboard-style card walls.
- Keep the same core functionality responsive across desktop, tablet and phone.
- Hide infrastructure details from normal customers.
- Do not surface unused or future product modules in the current product.

## State management

One authority. Async work scoped to account/conversation/request. Avoid duplicate cached “truth” when Query/server state already owns it.

## Testing rules

Reproduce → fix root cause → regression → broader tests → adversarial browser proof. Do not count stub-only proof as live proof.

## Git rules

No force rewrite of shared history. Reconcile latest target before integration. Preserve unrelated verified work.

## Performance rules

Bound reads, uploads, parsing and provider output. Stream/chunk large work. Keep Chat responsive while Offline installs.

## Forbidden practices

- Do not reintroduce CADANE branding.
- Do not reintroduce Paddle or live paid checkout.
- Do not expose provider, model, vendor or runtime identity.
- Do not store Offline model chunks outside OPFS.
- Do not build Projects, Tasks, Automations, Monitors, Organizations, Code or native apps without a new owner-approved mission.
- Do not weaken tests or security just to pass a gate.
- Do not claim real hardware, provider or production proof that was not actually run.
