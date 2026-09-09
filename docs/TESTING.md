# Testing Strategy

## Testing Philosophy

OCADE is complete only when the exact shipped tree is proven at the level appropriate to each capability. Source inspection, compilation, a unit test or a rendered control is not enough for browser journeys, Supabase/RLS, model lifecycle, usage, payments, browser/native control, accessibility or deployment behavior. Testing is used to prevent defects before deployment; monitoring is the final safety layer for unexpected production conditions, not a substitute for pre-release proof.

Do not weaken, skip, broadly mock or silence a real regression merely to produce a green report. Any failure discovered during implementation returns to the owning subsystem/phase in `PLAN.md`, is repaired at root cause and is rerun with the exact failed check before broader verification.

## Test Stack

The current repository uses Vitest for unit/integration/domain tests, TypeScript `tsc --noEmit`, ESLint with zero-warning expectation, Prettier, TanStack/Vite route generation and production builds, custom Chromium/Playwright-core-style browser journeys, extension E2E, Windows/native proof scripts, model-install/runtime proof, route/control/browser-safety/accessibility/responsive/web-vitals checks, Supabase types/schema/RLS/security/performance checks, donor/integration ledgers, secret scans, build budgets, deterministic build/release checks and launch/deployment controllers. Use the actual current `package.json` as the command source of truth.

Common current commands include `npm ci`, `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:isolation`, `npm run build`, `npm run build:stable`, `npm run performance:budget`, `npm run browser-safety:check`, `npm run controls:check`, `npm run supabase:types-check`, `npm run integration:check`, `npm run mission:check`, `npm run audit:journey`, `npm run audit:routes:prod`, `npm run audit:a11y-runtime`, `npm run audit:responsive`, `npm run audit:web-vitals`, `npm run extension:e2e`, `npm run windows:prove`, `npm run model:install-proof`, `npm run launch:prove` and `npm run deploy:check` where applicable.

## Unit Testing

Unit tests protect pure/core invariants: task state transitions, permission/risk rules, generation-permit accounting, idempotency, usage-window math, model-manifest/hash/chunk selection, search cursor encoding, billing-event normalization, entitlement calculation, schema validation and other deterministic policies. Time, randomness and provider responses are controlled where needed, but tests must preserve the real invariant rather than test a mock's implementation.

## Integration Testing

Integration tests exercise boundaries between feature/core/data/platform authorities: Supabase repositories, Auth/session state, task/event/receipt persistence, model vault, intelligence routing, provider failover, file upload/quota lifecycle, agent/tool registration, connector permission/revocation, extension bridge and Windows executor contracts. They must include failure/retry/duplicate/cancellation cases, not only successful paths.

## End-to-End Testing

Real browser journeys prove customer-visible flows and inspect visible state, console, network, storage and observed postconditions. Required journeys include first-visit landing → registration/verification → Chat; returning signed-in/signed-out root routing; complete Chat lifecycle; Normal Cowork; Jarvis Cowork with equivalent task state and voice states; browser extension control; supported Windows control; Code repository workflow; Projects/Tasks/Artifacts/Search/Memory; agents/tools/skills/plugins/connectors; organizations/Admin/support-access audit; notifications/trust/legal pages; all error/recovery/payment states; and final production smoke after deployment.

Every visible control reached in E2E must either perform its real behavior or produce the exact intentional unavailable/permission/error state. Blank panels, dead buttons, unexplained console errors, failed network calls or wrong postconditions fail the journey.

## API Testing

Server/Edge Function APIs require authentication/authorization, validation, idempotency and failure-path tests. `OcadeIntelligence` tests cover one-permit behavior, Gemini primary/secondary/tertiary health failover, meaningful-output boundary, Automatic/Online/Local-only modes and zero provider DNS/fetch/preconnect/health traffic in Local-only. Webhook tests cover signature verification, replay, duplicates, stale/out-of-order/cross-environment events and canonical state convergence. Browser redirects/client values never count as entitlement proof.

## Database Testing

Source/live migrations must be semantically reconciled before production apply. Test generated types, table/Storage RLS, grants, privileged functions/search paths, indexes and ownership using anonymous, owner, other-user, organization member/admin/owner, platform Admin/support-grant and service-role contexts as appropriate. Guessed IDs/object paths must not cross user/tenant boundaries.

Growing queries require bounds/pagination tests and query-plan evidence where indexes matter. Backup/restore rehearsal must restore into an isolated target and verify data integrity, key relationships and RLS before being called successful.

## Mocking Strategy

Mocks are acceptable for deterministic domain/unit boundaries and provider failure matrices, but a capability requiring browser/device/database/provider behavior also needs the closest real environment available. Do not claim physical-device delivery, provider payment, extension control or model transfer from a pure mock. Externally unavailable proof remains explicitly unavailable rather than being converted into a pass.

## Test Data

Use isolated deterministic accounts, organizations, repositories, tasks, artifacts and billing/provider fixtures. Tests must clean their own untracked/sandbox data without deleting unrelated working-tree content. Cross-tenant tests need at least two users and two organizations where relevant. Payment tests use sandbox/non-charge configuration until live charging is explicitly authorized.

## Test Naming Conventions

Name tests after observable behavior and invariant, not internal method names alone. Safety/bug regression tests should make the prior failure understandable from the test name. Generated evidence/gate tests should state the claim they enforce and fail when the corresponding source/evidence drifts.

## Coverage Requirements

There is no arbitrary line-percentage target that substitutes for risk coverage. Required coverage is behavior/risk based: every canonical state transition, permission boundary, security-sensitive mutation, usage/billing invariant, storage migration, model lifecycle edge, browser/native side effect and critical customer route must have deterministic or runtime evidence appropriate to the risk. A shipped path with no meaningful proof is incomplete even if overall line coverage is high.

## Five Silent Speed Killers

Performance verification explicitly targets five recurring problems identified in the supplied performance guide.

**N+1 queries:** no per-item database/network fetch loops for related rows. Batch with joins, `.in()` or server-side aggregation and test request/query counts with realistic list sizes.

**Missing indexes:** add indexes only for measured WHERE/JOIN/ORDER BY/search patterns. Inspect `EXPLAIN (ANALYZE, BUFFERS)` or equivalent query-plan evidence before/after; avoid redundant indexes that increase write/storage cost.

**Unbounded lists:** every growing conversations/messages/tasks/artifacts/activity/search/admin feed has a maximum page size. Prefer stable cursor/keyset pagination for continuously changing feeds; bounded offset pagination is allowed for suitable stable admin tables.

**Unoptimized media:** responsive/lazy-load noncritical images and use appropriate modern formats when quality/function allows. Do not ship huge source-resolution images into small UI slots. Model binaries and artifact originals are governed by their own integrity/quality constraints rather than destructive image optimization.

**Giant eager bundles:** lazy-load heavy Code editor/LSP/terminal UI, PDF, Jarvis/Three.js/audio visualizer, local model runtimes, native/platform and media tooling. Route/component splitting must preserve deterministic loading/error states and keep first paint/navigation within the active budgets.

These are deployment blockers, not optional cleanup recommendations.

## Required Production Pages and States

Testing must include applicable public/legal/customer-lifecycle states rather than only happy paths. Required trust/lifecycle coverage includes landing, Sign in/register/verification/recovery/reset, account/settings/data export/deletion, Privacy, Terms, Cookie Policy/preferences only if non-essential cookies exist, Refund, Cancellation, Disclaimer, Accessibility Statement, DPA, Acceptable Use, Security, Responsible Disclosure, Help and real Status. Community Guidelines are required only if a community capability ships; physical Shipping/Return pages are not applicable to this software-only product unless the business changes.

Intentional UX states include 403, 404, 500, Maintenance, Offline, Loading, Empty, No Results, Success, generic Error, Session Expired, Permission Required/Denied, Usage Exhausted, provider unavailable, model preparation, Payment Success, Payment Pending and Payment Failed. Cowork additionally tests extension/Windows-host unavailable, disconnected executor, expired approval, stale context, takeover/pause/emergency stop/partial success/recovery; Jarvis tests microphone denial/revocation and reduced-motion/static fallback. Code tests repository/terminal/patch/conflict/diagnostic/dev-server/preview/CI/host-loss states. Tasks/Artifacts/Projects test their complete lifecycle states.

## Accessibility and Responsive Testing

Target WCAG AA. Verify keyboard operation, visible focus, modal focus trap/return, screen-reader announcements for streaming/task/approval/usage/error states, 44×44 touch targets, 200% zoom, reduced-motion/transparency and no color-only meaning. Required viewport widths include 320, 375, 768, 1024, 1440 and 1920 CSS pixels. Ordinary UI is tested across supported Chrome/Edge/Safari/Firefox where possible; extension control only in genuinely supported environments; Android/iPhone/iPad PWA behavior requires platform-appropriate proof where available.

## Performance Gates

Final budgets must have meaningful safety margin. The current plan targets total JavaScript ≤4,100 KiB, eager JavaScript ≤800 KiB, largest eager chunk ≤425 KiB, CSS ≤135 KiB, LCP <2.5 s, CLS <0.1 and TBT <200 ms unless a later evidence-backed decision updates the canonical budget. Passing by a few bytes without headroom is not considered healthy.

## CI Testing

Portable CI should run deterministic install and the repository's canonical full/portable verification. Platform-specific Windows/mobile/extension evidence runs in the appropriate environment. CI must not mark unavailable hardware/provider proof as passed. Failure artifacts/logs must be privacy-safe and contain no secrets/customer content.

## Required Checks Before a Task Is Complete

Run the smallest focused tests that directly prove the changed authority, then type/lint/build or phase-specific gates as relevant. Database changes require migration/type/RLS tests. UI changes require affected route/browser/a11y/responsive checks. Model/intelligence changes require network/permit/model lifecycle proof. Browser/native changes require postcondition journeys. Payment/Admin changes require signature/idempotency/AAL2/audit/sandbox tests.

## Final Verification

After every `PLAN.md` phase is complete, run the exhaustive matrix from a fresh clean checkout of the exact reconciled tree: deterministic installs; format/type/lint/generators; full/shuffled/isolation/concurrency/fault tests; production build/clean-tree/browser-boundary/secret/dependency/SBOM/licence/release inspection; Supabase source/live/RLS/security/performance/backup/restore; usage/offline leases; Gemini and Local-only isolation; complete Offline Intelligence first-install/resume/corruption/no-redownload/remove/reinstall; all customer browser journeys; extension/Windows/mobile/voice; organizations/Admin/support; accessibility/responsive/performance; and payment/refund/dispute/Admin-grant sandbox lifecycle where configured. Any failure returns to its owning phase and the necessary final cycle is rerun.

## Definition of Done

A change is done when its behavior is wired to the canonical authority, tests appropriate to its risk pass, browser/device/database postconditions are observed where required, no dead/duplicate authority was introduced, generated evidence is current and documentation/memory is updated when the decision/state changed. OCADE production is done only when the exact tested tree is the remote `main` tree and the exact deployed release, with zero known reproducible repository-controlled failures at the final gate.
