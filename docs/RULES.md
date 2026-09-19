# OCADE Project Rules

## General

- Current owner request and `PLAN.md` govern the active mission.
- CARCC is the company; OCADE is the product.
- Do not use current CADANE branding.
- Keep the current product website-only and Chat-first.
- Prefer fewer maintained lines, fewer authorities and fewer moving parts.

## Code organization

Keep responsibility with the existing authority:
- Chat state in the Chat authority;
- routing in the intelligence router;
- usage in commercial authority;
- Offline lifecycle in one installer/vault;
- durable account state in the account backend.

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
- Auth before protected work.
- Stable idempotency for logical retries.
- Cancellation propagates.
- No client-supplied ownership/entitlement trust.

## Database rules

- Versioned migrations + rollback/verification.
- RLS + grants.
- Strong-auth gates for privileged RPCs.
- Indexed bounded reads.
- Regenerate/destructive multi-row mutations are atomic or recoverable.
- Historical tables are not product requirements.

## Security rules

- Secrets server-side.
- No provider/model/vendor identity in normal UI, public docs, client logs or bundle-visible diagnostics.
- No direct browser write to revocation/entitlement authority.
- Hostile-file assumptions everywhere.
- Cross-account state never survives account switch.
- Admin hidden and role-gated.

## Offline storage rules

Model storage/download is OPFS-only:
- bytes/chunks/checkpoints/metadata/pointers/runtime model assets → OPFS;
- no IndexedDB/Cache Storage/localStorage model copy;
- normal site update does not redownload an unchanged verified release;
- explicit Remove suppresses automatic reinstall until explicit Install.

## Dependency rules

Use platform/native APIs or installed dependencies first. New dependency requires a real need and must reduce rather than multiply maintenance.

## UI rules

- Dark, premium, minimal.
- No dashboard/card walls.
- Responsive desktop/tablet/phone.
- Hide infrastructure details.
- No current unused/future product modules.

## State management

One authority. Async work scoped to account/conversation/request. Avoid duplicate cached “truth” when Query/server state already owns it.

## Testing rules

Reproduce → fix root cause → regression → broader tests → adversarial browser proof. Do not count stub-only proof as live proof.

## Git rules

No force rewrite of shared history. Reconcile latest target before integration. Preserve unrelated verified work.

## Performance rules

Bound reads, uploads, parsing and provider output. Stream/chunk large work. Keep Chat responsive while Offline installs.

## Forbidden practices

- Reintroducing CADANE branding.
- Reintroducing Paddle/live paid checkout.
- Exposing provider/model/vendor/runtime identity.
- Storing Offline model chunks outside OPFS.
- Building current-scope Projects/Tasks/Automations/Monitors/Organizations/Code/native apps without a new mission.
- Weakening tests/security to pass a gate.
- Claiming real hardware/provider/production proof that was not run.
