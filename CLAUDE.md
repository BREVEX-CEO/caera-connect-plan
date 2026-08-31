# CLAUDE.md

## Project
- Product: OCADE by CARCC CADANE.
- Repository mission authority: `PLAN.md`.
- Mission type: continuous implementation, integration, debugging, testing, verification, and final integration.
- This is NOT an audit-only task.
- Do not assume prior chat context. Read repository files and current evidence.

## Read First
1. Read `PLAN.md` completely.
2. Read `docs/mission/OCADE_EXECUTION_STATE.md`.
3. Read `docs/mission/OCADE_PAYMENT_SUPPORT_REFUNDS_AND_ADMIN_GRANTS.md` before billing/admin-entitlement work.
4. Inspect current Git state before editing.
5. Inspect the existing authority, callers, persistence, tests, Supabase schema, and platform boundaries before changing a subsystem.

## Mission Rule
- Do not voluntarily stop while any reachable `PLAN.md` requirement remains.
- Continue until the whole reachable mission is implemented, connected, tested, debugged, retested, integrated, and working together.
- A completed phase is not mission completion.
- A passing unit test is not mission completion.
- A build passing once is not mission completion.
- A context reset, usage reset, timeout, failed command, flaky test, or browser failure is not permission to abandon the mission.
- After any continuation, resume from the exact unfinished action in `OCADE_EXECUTION_STATE.md`.
- Do not restart completed work unless a regression or changed source of truth requires it.

## Execution Loop
- READ → TRACE → CLASSIFY → IMPLEMENT → RUN → TEST → BREAK → DIAGNOSE → FIX → RETEST → INTEGRATE → BROWSER-PROVE → VERIFY.
- Repeat until the complete reachable `PLAN.md` mission passes together.
- For overlaps assign exactly one: `KEEP`, `FIX`, `COMPLETE`, `MERGE`, `REPLACE`, `REMOVE`.
- Search before creating.
- Reuse the canonical authority.
- Never create a duplicate router, store, auth system, billing stack, entitlement system, usage authority, notification stack, admin stack, task manager, model installer, native bridge, design system, or support system.

## Error Standard
- Fix root causes.
- Do not hide errors to make gates green.
- No blanket ignore rules.
- No disabling tests to claim success.
- No broad `any` as an escape hatch.
- No swallowed exceptions that hide user-visible failures.
- No fake success states.
- No fake availability.
- No knowingly broken reachable route.
- Final reachable tree must have:
  - zero TypeScript errors;
  - zero unresolved imports;
  - zero build errors;
  - zero unexpected lint warnings;
  - zero formatter drift;
  - zero unexpected test stderr;
  - zero known reachable runtime errors;
  - zero applicable missing checklist items;
  - zero known duplicate canonical authorities;
  - no uninvestigated browser console/network failure in required journeys.

## Browser Proof
- Use real browser automation/control for product debugging and final proof.
- Inspect page behavior, console errors, network errors, failed requests, hydration/runtime errors, focus, keyboard behavior, responsive layout, loading/error states, and user-visible postconditions.
- Reproduce failures in the browser.
- Fix the underlying source.
- Rerun the exact failed browser journey.
- Test required widths from `PLAN.md`.
- Do not declare a UI feature complete from source inspection alone.
- Browser success must reflect real state, not mocked decorative success.

## Supabase and Cloudflare
- Use already-authorized Supabase access without repeatedly asking for permission to inspect, query, test, migrate, or debug within the mission's allowed scope.
- Use already-authorized Cloudflare access for inspection, logs, configuration diagnosis, and debugging without repeatedly asking for permission.
- `PLAN.md` remains authoritative about side effects.
- `PLAN.md` currently forbids deploying to Cloudflare; inspection/debugging does not override that rule.
- Do not invent credentials or provider readiness.
- Do not expose secrets in source, logs, screenshots, browser storage, generated evidence, or commits.
- Prefer forward-only Supabase migrations.
- Rerun RLS/grant/security tests after schema changes.

## External Blockers
- Do not finish with `not proven`, `not verified`, or `not done` when another repository-controlled engineering route can solve or prove it.
- Build another focused test, fixture, harness, simulator, diagnostic, or verification path when appropriate.
- If a requirement genuinely needs an unavailable credential, legal approval, independent host, signing identity, provider account, or physical device:
  1. complete every repository-controlled part;
  2. test deterministic substitutes where valid;
  3. fail closed;
  4. hide the capability or show an exact truthful unavailable state;
  5. record the exact external dependency and exact evidence required;
  6. continue every other reachable requirement.
- Never fabricate external proof.

## Payments and Entitlements
- Treat billing as safety-critical.
- Use the existing canonical billing/payment authority; migrate it, do not create a second stack.
- Never grant paid access from:
  - a success URL;
  - redirect query parameters;
  - localStorage;
  - client-controlled plan IDs;
  - client-controlled prices;
  - editable profile metadata;
  - an unsigned/unverified provider event.
- A return page may request server reconciliation, but the server must independently verify provider state and apply the same idempotent authoritative path as the webhook.
- Paid entitlement becomes active only after server-side authoritative verification.
- Server controls plan, catalogue version, amount, currency, cadence, tax policy, entitlement, and usage policy.
- Payment state changes must be atomic, idempotent, replay-safe, duplicate-safe, and ordering-safe.
- Test successful payment, pending confirmation, duplicate webhook, stale webhook, out-of-order webhook, renewal, upgrade, downgrade, cancellation, expiry, failed payment, refund, partial refund, dispute, chargeback, reversal, and recovery.
- A genuinely confirmed successful payment must grant exactly the purchased access without manual intervention.
- Never take live money for a plan the system cannot reliably fulfill.
- Manual/admin plan grants are NOT fake payments. Record them as explicit audited administrative entitlements.
- Never write a fake charge or fake provider transaction for a manual grant.
- Billing/plan changes must never delete, invalidate, reinstall, or redownload Offline Intelligence.

## Fraud and Abuse Controls
- Bind checkout sessions to account/organization, catalogue version, plan, currency, cadence, and an idempotency key.
- Verify provider signatures using the provider's real protocol and raw request body.
- Reject replay, duplicate, stale, cross-environment, cross-account, and unknown-catalogue events.
- Do not trust email alone as authorization.
- Do not trust browser-visible amount or plan state.
- Rate-limit sensitive billing/admin actions.
- Require recent reauthentication and MFA/AAL2 for high-risk billing/admin changes where required by `PLAN.md`.
- Keep immutable/auditable event history for payment, refund, dispute, entitlement, and admin-grant decisions.
- Never claim fraud can be reduced to zero; implement layered prevention, detection, auditability, and recovery.

## Refunds
- Refund requests must reference an authoritative payment/transaction.
- Provider refund execution occurs server-side with provider credentials.
- Do not mark a refund successful before the provider confirms it.
- Persist request, actor, reason, amount, currency, provider reference, provider response ID, timestamps, and final status.
- Make refund processing idempotent.
- Handle partial refunds with an explicit entitlement policy.
- Verified refund/chargeback events update entitlement through the canonical state machine.
- Customer-visible refund state must be truthful.

## Admin Grants and Custom Plans
- Authorized administrators may grant Free, Pro, Max, or an approved custom entitlement without payment.
- Resolve the target account by immutable user ID; email may be used only to locate the account, then bind the action to the resolved user ID.
- Do not let ordinary users edit their own entitlement fields.
- Do not directly mutate arbitrary `profiles.plan_tier` text as the source of truth.
- Use a canonical admin-entitlement/grant authority with:
  - grant ID;
  - target user ID;
  - organization ID when applicable;
  - catalogue/entitlement ID;
  - source `admin_grant`;
  - reason;
  - actor;
  - created time;
  - optional start/end;
  - revocation state;
  - audit event.
- Manual grants must coexist safely with provider subscriptions according to an explicit precedence policy.
- Revocation must not fabricate a refund.
- Provider webhooks must not silently erase a valid active admin grant unless policy explicitly says so.

## Data and Offline Intelligence
- IndexedDB/account-data deletion must never delete the verified OPFS model.
- Sign-out/account deletion must preserve Offline Intelligence unless the user explicitly chooses `Remove Offline Intelligence`.
- Deleting account/private data must not trigger model download, mirror probes, Range requests, or automatic preparation restart.
- Only the canonical model-vault uninstall authority may remove Offline Intelligence.

## File and Naming Standard
- Use descriptive names.
- Follow the repository's existing naming convention.
- No gibberish file, branch, variable, migration, test, evidence, or commit names.
- No names like `emkdknfknkffi949489494`.
- Names must state purpose and scope.
- Prefer examples such as:
  - branch: `claude/ocade-production-completion-20260831`;
  - migration: `20260831_add_admin_entitlement_grants.sql`;
  - test: `payment-entitlement-reconciliation.test.ts`;
  - evidence: `OCADE_PAYMENT_RUNTIME_PROOF.json`.
- Do not append `new`, `v2`, `final-final`, random digits, or `replacement` when the existing authority can be repaired.
- Random IDs are acceptable only for runtime data where uniqueness is required, not for source organization.

## Git
- Fetch latest `origin/main` before implementation.
- Preserve unknown/unrelated work.
- Never reset, clean, force-push, or discard unknown changes.
- Use one clearly named isolated mission branch from the fetched main.
- `PLAN.md` requires no implementation commits.
- Keep recovery state outside normal implementation commits.
- Create exactly one final product commit only after all final gates pass together.
- Fetch `origin/main` immediately before final integration and again before pushing.
- If main advanced, reconcile safely and rerun affected/full gates.
- Fast-forward main.
- Push without force.
- Verify remote SHA and tested tree.
- No later cleanup/fix commit should be required.

## Execution State
- Keep `docs/mission/OCADE_EXECUTION_STATE.md` current during work.
- Update it after meaningful milestones and before likely context/usage interruption.
- Record:
  - fetched main SHA;
  - branch;
  - working-tree status;
  - current phase;
  - completed phases;
  - canonical decisions;
  - files in progress;
  - tests passed;
  - browser journeys passed;
  - current failures;
  - exact next action;
  - external blockers;
  - work that must not be repeated.
- After continuation, read this file before doing new work.

## Final Gate
- Before final conclusion, reread ALL of `PLAN.md` against the final tree.
- Regenerate every required ledger/checklist/evidence file.
- Require zero applicable `MISSING`.
- Require every shipped capability to reach the evidence level required by `PLAN.md`.
- Run the complete final verification matrix together.
- Run production build.
- Run secret/license/SBOM checks.
- Run required browser journeys.
- Run payment/no-charge/fraud/refund/admin-grant tests.
- Run Supabase/RLS/security tests.
- Run required platform/device tests where authority is available.
- Inspect final diff and staged files.
- Only then make the sole final commit, integrate main, push, and verify.

## Completion
- Do not voluntarily conclude while reachable mission work remains.
- The objective is not to finish quickly.
- The objective is to finish the entire reachable `PLAN.md` correctly.