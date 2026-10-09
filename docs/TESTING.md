# OCADE verification and release handbook

[PLAN.md](../PLAN.md) is the only implementation work list. This document owns test methods, evidence, release acceptance and recovery. [SUPPORT_LEGAL_SECURITY.md](SUPPORT_LEGAL_SECURITY.md) owns security/commercial contracts; [ARCHITECTURE.md](ARCHITECTURE.md) owns subsystem design. Historical audit matrices describe their own snapshots, not current readiness.

The October documentation mission runs documentation checks only. It does not authorise product fixes, builds that alter product artefacts, test-account writes, physical automation, production database changes, provider charges or deployments. The procedures below are for separately authorised implementation/release work.

## 1. Evidence standard and completion

PARTIAL means only a declared subset has evidence and cannot close a required release gate. A test proves a specific behaviour on a specific source, configuration and environment. Source inspection is not execution; a stub is not Supabase production; WebKit is not an iPhone; health is not workflow completion.

Use status **PASS, FAIL, PARTIAL, BLOCKED or UNTESTED** and a separate evidence class: SOURCE, LOCAL TEST, DATABASE TEST, MCP BROWSER, REAL BROWSER, REAL WINDOWS, ANDROID EMULATOR, REAL ANDROID, WEBKIT COMPATIBILITY, REAL APPLE or LIVE. A simulated Android viewport is browser evidence. A physical environment label requires actual hardware. A code-read finding can be confirmed as a source defect while its reproducer remains UNTESTED.

Every evidence record contains:

- UTC date, source SHA, worktree state and relevant release/configuration identities;
- environment, OS/browser/app versions, real versus stubbed dependencies and test actor;
- exact command or reproducible steps, expected outcome and observed outcome;
- status, redacted logs/receipt/artifact location, defects and unresolved uncertainty;
- execution, verification and user-visible settlement timestamps when relevant;
- next unfinished step, dependency and rollback point.

Do not record secrets, raw tokens, private customer data or reusable private screenshots. Do not transfer old PASS labels to a new SHA without establishing relevance. Keep an exact full-read/partial/search-only/unread path inventory; fetching a file, listing it or reading a truncated result is not a full read.

DONE for a release capability requires its implementation, security boundary, failures, platform behaviour and independent postconditions to pass, with no known reproducible Critical/Major defect and no unexplained required-test failure. A missing required device/provider test remains BLOCKED. A narrowly excluded capability may ship only when scope and public claims explicitly exclude it.

Report phase status Complete/Partial/Blocked, work completed, findings/fixes, tests, blocked evidence and source/deploy identity. If a readiness percentage is reported, disclose the frozen release-checklist numerator/denominator and blocked count. Do not infer a commercial-readiness percentage from line coverage, number of tests, health or documentation completion. Deferred payment collection cannot be counted as a working paid launch.

## 2. Per-change proof and final waves

For each implementation change: read current authority; establish baseline; reproduce; identify owning function and root cause; add meaningful regression; make the smallest fix; run targeted proof; exercise integration and applicable real workflow; attempt to break it; regress nearby paths; record evidence. Do not add sleeps/retries to conceal ownership or timing errors.

Before release:

1. Complete the declared full source-read audit, including security/caller/migration/test paths; resolve valid release-scope defects with regressions.
2. Freeze product source and execute the full release matrix. Record failures immediately; do not patch while still collecting that frozen matrix.
3. Fix the recorded failures, rerun affected evidence and the release matrix on the new frozen source.
4. Apply only parity-proven cleanup from [ToRemove.md](../ToRemove.md), then rerun the same matrix.
5. Run one independent adversarial pass and a final real-user pass on authorised staging/preview. Resolve discovered release blockers and repeat the affected gates.

No endless review loop or rerunning flakes until green. Investigate failures, state the cause and retain the reproducer. When a tool fails, preserve the exact blocker and continue independent work.

## 3. Tools, isolation and low-budget evidence

One actor owns a surface at a time. Playwright/CDP can act in an authorised browser while DevTools observes; do not let desktop input fight it. Appium acts first on Android, then releases/reset state before Mobile MCP independently verifies. One database mutation path and one deployment controller own their respective operations.

Start each wave with a safe read proving target/tool identity. Use exact locked/project-compatible tool versions; verify current tool help rather than copying an obsolete invocation. Customer installation never depends on these developer tools.

Use free local unit/SQL/browser tests and an Android emulator first. Label emulator battery, sensors, background and OEM behaviour limitations. Physical Windows, Android and Apple proof require their legitimate environments. If unavailable, record the exact hardware/app/account dependency as BLOCKED; do not purchase device reservations or subscriptions without owner authorisation. WebKit plus responsive/PWA/Shortcuts contract testing is useful Apple compatibility evidence, not physical-device proof.

Use temporary test homes, isolated app copies/profiles, scoped work folders, ports, keys and accounts. Inspect `jarvis-runtime/tests/conftest.py` before native tests: they must not stop the installed agent, remove the real login entry or read its exit token. A fixture root is not itself a sandbox. Require explicit scope for live account or external-message tests.

## 4. Existing automated gates and their limits

Use `package.json` and `scripts/verify-full.mjs` as the executable gate inventory. Do not maintain a second divergent shell script here. Current `npm run verify:full` includes route stability, typecheck, lint, formatting, unit tests, stable build, secret scanning, Supabase type checks and content/read/control/accessibility/colour/identity/reachability checks.

`.github/workflows/ci.yml` additionally runs `npm audit --omit=dev` after the portable gate. It ignores documentation-only changes and its push filter also ignores workflow paths. Therefore a skipped workflow is not a passing audit, and `verify:full` alone is not dependency-security proof. The production deployment workflow currently calls `verify:full`; before a future production release, explicitly require dependency audit evidence on the exact lockfile too.

Record audit tool/version, advisory ids, severity, affected dependency chain and actual runtime reachability. Reproduce the reported dependency failure against the frozen lockfile; do not describe old output as today's result. Fix by the smallest compatible update and rerun affected real workflows. Never use blanket force-upgrade, disable the audit or reclassify a failure without evidence. Python/native dependencies need their corresponding supply-chain and packaging/signature checks as well.

Use `npm run audit:browser` for the current journey harness after authorised setup. Read `scripts/e2e/harness.mjs` to determine included cases; named journeys outside it require explicit execution. The harness's stand-in Supabase does not prove hosted RLS, auth redirects, storage rules, Realtime or provider billing. Run runtime tests with the isolated Python environment and the existing `jarvis-runtime/tests` suite; unavailable platform tests remain explicit skips/BLOCKED.

Source-string tests can protect inventory/invariants but do not replace behavioural tests. A local database emulator proves the SQL subset it executes, not hosted extension/configuration parity.

## 5. Backend and offline regression contracts

These are acceptance contracts for PLAN work packages, not a competing queue. Extend named existing suites; proposed new cases are not claimed to exist.

| Contract and current source location                                                                                                                    | Required proof and exact integration                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cold offline activation: `src/lib/brain/installation-authority.ts:attemptPath`, `installation-browser.ts:resolveInstallTarget`, `runtime-activation.ts` | Extend `brain/__tests__/an-update-does-not-redownload.test.ts` and `install-once.test.ts` to exercise the real resolver boundary. Persist verified bytes and usable account/lease, close the page, block all network, reopen a fresh document and generate with the actual engine. Assert no remote release dependency and no model redownload. The current mocked resolver does not prove this.                                                                                                          |
| Integrity repair: authority `repair`, vault/store/transfer                                                                                              | Extend `a-verified-model-survives.test.ts` and `model-vault.test.ts`: truncate nonempty verified bytes, corrupt same-length bytes, lose metadata, abort mid-write, fill quota, evict artifact, lose runtime asset. Repair verifies digest/length, retains healthy bytes, recovers or refuses truthfully. Reopen actual runtime after repair.                                                                                                                                                              |
| Concurrent offline journal: `src/lib/chat/unsynced-turns.ts:keyFor/load`                                                                                | Extend `chat/__tests__/offline-turns-reach-the-account.test.ts` with two independent contexts sharing initially empty IndexedDB. Force both first reads before key creation completes; write, close both and reopen. Both messages decrypt and upload exactly once. Corrupt/missing key must not silently delete recoverable rows. Also test sign-out/account switch and deletion-versus-pending-write.                                                                                                   |
| Granular RLS: broad `has_role` policies versus staff overrides                                                                                          | Extend `admin/__tests__/staff-authority.test.ts`, `owner-staff-on-site.test.ts`, `src/lib/__tests__/one-account-cannot-see-another.test.ts` and hosted staging checks. Deny an admin customer/usage permission and attempt app, REST, SQL and RPC reads. Keep valid self-access. Include direct browser bypass, AAL1, expired/revoked session, new factor and Customer A/B.                                                                                                                               |
| Exactly one Primary Owner                                                                                                                               | Extend staff PostgreSQL tests with independent sessions and deliberate barriers between validation and update. Race transfer/revoke, two transfers, demotion/revoke and retries. Verify one primary, correct destination, no false success audit, proper rollback and no self-escalation. A unique index alone proves at most one.                                                                                                                                                                        |
| Complete export: `account/data-rights.ts:readTable/readCascadedTable`                                                                                   | Extend `account/__tests__/data-rights.test.ts` and `data-rights-map.test.ts`. Exceed page size, reorder/concurrently insert/delete, include many parents, inject a middle-page error. Verify stable keys, declared cutoff/snapshot, no lost/duplicate rows and accurate partial status.                                                                                                                                                                                                                   |
| Erasure completion: `account/erase.server.ts`, `library/tombstones.server.ts`                                                                           | Extend `deletion-checks-every-step.test.ts` and `a-deletion-leaves-a-record.test.ts`. Fail storage/remove/count/identity steps independently, exceed batch limit, delete identity, then prove scheduled retry without that account's session. Assert unknown count never becomes zero, foreign paths untouched, retained exceptions explicit and late tokens cannot recreate data.                                                                                                                        |
| Commercial permits and signed leases                                                                                                                    | Extend `commercial/__tests__/gate-against-postgres.test.ts`, `ledger-against-postgres.test.ts`, `offline-capacity-against-postgres.test.ts`, `offline-closure.test.ts`, `offline-counter.test.ts` and `intelligence/__tests__/edge-handler.test.ts`. Race online/offline allocations, duplicate request keys, key rotation, clock rollback, expiry, failed signing, unknown settlement, cancel before output and partial output. Prove one logical charge and no refund of disconnected unreported spend. |
| Session/recovery controls                                                                                                                               | Extend `security/__tests__/second-factor-enforced.test.ts`, `recovery-functions.test.ts`, `mfa.test.ts`, `reauthentication.test.ts` plus auth/admin journeys. Reproduce historical enrolment concerns, prove recovery is single use, revoke after token issue and verify the documented cache/freshness bound.                                                                                                                                                                                            |
| Delivery and canonical origin                                                                                                                           | Extend `brain/__tests__/delivery-signature.test.ts`, `offline-release.test.ts`, `src/lib/__tests__/one-canonical-origin.test.ts`, `service-worker.test.ts`, CSP/public-response suites. Test invalid/expired signatures, ranges/resume, private binding absent, wrong digest, secret leakage, www/HTTPS and authenticated responses excluded from caches.                                                                                                                                                 |

The baseline findings are source-supported, not fixes delivered by this documentation mission. Each package is DONE only after its negative cases and real integration succeed. Rollback preserves installed healthy bytes, queued ciphertext, scoped authorisation and audit history; it never restores a known unsafe security path merely to make a previous version run.

## 6. Website and account matrix

Exercise signed-out, fresh sign-in, returning account, multi-tab, account switch and expired/revoked sessions in existing authorised Chrome, clean Chrome, Edge, Firefox and WebKit. Include mobile Chromium/PWA. Test direct URLs, back/forward, refresh, OAuth destinations, uploads/downloads, popup/navigation, permission refusal, takeover and restart.

Verify every route/control from the canonical product/navigation inventory: visible and hidden drawers, settings, menus, modals, mobile states and role-specific console. For each actionable control: request, pending, disabled, success, refusal, error, retry, cancellation, double click, navigation away/back and account switch. No fake success, silent empty-state read failure or decorative dead control.

Check console/network failures and actual accessibility tree. Test dark/light, 360/375 widths, tablet/desktop, text zoom, keyboard/focus restoration, screen-reader labels, touch targets, safe areas, virtual keyboard, reduced motion, no overflow/layout shifts and honest progress. Follow the exact design tokens in [JARVIS_DESIGN_SYSTEM.md](JARVIS_DESIGN_SYSTEM.md). The existing colour checker must be deliberately reconciled in a future authorised source change if the approved palette changes; never silently weaken the gate.

## 7. Computer-control, completion and fault injection

Extend existing `src/jarvis/__tests__/agent.test.ts`, `device-exchange.test.ts`, `device-protocol.test.ts`, `execution-controls.test.ts`, `live-control.test.ts`, `carry-on.test.ts`, task SQL tests and `jarvis-runtime/tests`. The exact new protocol fields and execution sequence are defined by ARCHITECTURE/PLAN.

| Failure injected                                                            | Required observation                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong model plan or prompt injection in page/file/tool response             | Scope and capability admission refuse unsafe work; model cannot grant authority                                                                         |
| Save commits, response/ack lost                                             | Durable action identity reconciles actual saved result; no blind repeated side effect                                                                   |
| Action/result delivered twice or out of order                               | One mutation, monotonic valid state, idempotent receipt                                                                                                 |
| STOP at admission, queue, input, script, save or verify boundary            | No later admission; bounded local quiescence; irreversible partial effects explicitly reported                                                          |
| Remote STOP while disconnected                                              | Requested/unacknowledged state remains visible; local safety works; no false stopped claim                                                              |
| Observed permission/device/session revocation                               | Next mutation refused, current cancellable work stopped, late results cannot revive task                                                                |
| Unseen remote revocation during partition                                   | Refuse new mutations by Architecture native-lease deadline; test clock rollback, suspend/restart and reconnect; never claim immediate remote quiescence |
| Key rotation response lost or includes commands                             | Rotation recovery retains command identity and signed ownership; no dropped/duplicate execution                                                         |
| Agent/browser/OS restart                                                    | Checkpoint and journal reconcile before resume; no stale lease or duplicate side effect                                                                 |
| Two tasks target one app/document                                           | One mutation owner; deterministic busy/handoff response; unrelated reads do not steal focus                                                             |
| Window/tab/UI/DPI/monitor changes after observation                         | Stale target refused/reobserved; coordinates never replayed against a changed surface                                                                   |
| Verification cannot decide                                                  | Unknown/partial with evidence and recovery choice, never complete                                                                                       |
| Update interrupted, corrupt or signed by wrong key                          | Refuse/rollback safely; previous compatible release recoverable; no signature bypass                                                                    |
| Scope escape, junction/symlink, private-network URL or malicious subprocess | Boundary refuses; originals/secrets/out-of-scope state preserved                                                                                        |

Use independent checks matched to the requested outcome: reopen Excel and recalculate formulas; compare original hashes; inspect document structure; inspect video duration/container/audio; open CAD/3D project and check model properties; run coding regression and inspect Git diff. Merely producing a file is insufficient. An unfamiliar installed app must be selected at test time, with no app-specific source added during that trial.

Required Windows wave: install/connect/tray/autostart; existing-profile browser; files; real Excel/Word; coding in a real repository; multi-app workflow; dynamically discovered API/script; structured-control-insufficient accessibility/vision fallback; local STOP; physical Take Over/Co-work; background/Remote PC with browser closed; restart/reconnect; signed update/rollback; Exit/uninstall/reinstall; active revoke.

Run `manual_installed_lifecycle.py`, existing-browser and update manual harnesses only after reading their scope/setup and confirming isolation. Include long paths, same-name workbooks, open/read-only/locked files, partial save, disk full, focus theft, denied elevation and multi-monitor/DPI where available.

## 8. Android, Apple, voice and background

Android: install the signed APK from the website on a compatible emulator and then supported real hardware. Verify enrolment, account isolation, one guided setup, each denied/revoked permission return path, overlay/bubble, accessibility/intents, orientation, keyboard, task/voice mini-chat, remote-PC targeting, foreground/background, process death, restart, update and uninstall/reinstall.

Run Appium first and Mobile MCP second independently using `scripts/e2e/android-journey.mjs` and the actual companion. Device/emulator capability is explicit. Verify fresh observation binding, stale hierarchy rejection and STOP during active gestures/actions. Never instruct users to disable platform protection.

Voice: verify both OCADE wake phrases, bundled signed wake artifact, microphone lifecycle, pre-wake local processing, visible required Android notification, barge-in, speech cancellation, conversation follow-ups, status/redirect while a task continues, echo/false wake and noisy/quiet speech. Speaker-loop evidence is not a representative human-speaker study. Measure wake idle resources and long-run audio/process cleanup.

Apple: test WebKit, PWA/Home Screen, safe-area/orientation, focus, text zoom, reduced motion, legitimate share/Shortcut/App Intent boundaries where implemented and Remote PC contracts. Physical iPhone/iPad/macOS claims require real-device evidence. Do not invent unrestricted local app control or label unsupported background wake as a defect to bypass OS policy.

## 9. Performance and economics

Capture monotonic timestamps for planner start/end, dispatch, broker admission, executor start/end, verification and visible settlement. Cross-device comparisons require explicit clock alignment/uncertainty. Separate local control overhead from WAN, model inference, rendering, export, application startup and verification.

For each benchmark record hardware, power/thermal state, app/version, warm/cold state, workload, payload size, sample count, failures and p50/p95/p99 when the sample supports them. A target is not a measured result. Prefer distributions and verified completion over the fastest successful demo.

Compare baseline and replacement on the same fixtures: RPC/event counts, bytes uploaded, screenshot count, model tokens/calls, CPU/RAM, idle network, battery where physical evidence exists, total task time and verified success rate. Event delivery must improve latency without losing recovery after missed events. Sanitised capability/recipe caches must prove invalidation on app/version/permission changes.

Measure cost per attempted and per verified workflow, including failed work and support. Establish bounded local segments without hiding failed sub-actions or charging each deterministic click. Keep the first commercial benchmark set narrow and repeatable; no claim of competitor superiority without comparable independently verified runs.

## 10. Supabase migration and release runbook

For a future authorised database release:

1. Freeze source, target project identity and intended migration set. Read current migration history/schema/grants without exposing secrets. Compare deployed and clean-rebuild state.
2. Build a disposable local/staging database through chronological history; verify current functions, policies, grants, triggers and generated types. Applied migrations remain immutable.
3. Reproduce the defect using caller roles; implement a forward migration with verification and rollback/forward-repair design. Test both fresh rebuild and upgrade from the real preceding state.
4. Exercise Customer A/B, Owner, limited Staff, denied Admin and anonymous callers through application and direct Data API. Include revoked sessions/factors, service-role scope and concurrent transactions.
5. Prove backup/restore or compensating forward repair for destructive changes. Identify data a schema rollback cannot recover. Record compatibility with prior/new web/agent versions.
6. Obtain required production-change authorisation; execute only the approved set via one migration authority. Verify postconditions and monitor. On failure stop dependent rollout and execute the reviewed recovery, never improvise historical replay.

Ordering warning: `20261001090000_staff_authority_only_in_the_console.sql` and `20261001095100_the_console_needs_a_sign_in_after_a_new_factor.sql` precede `20261003090000_owner_and_staff_consoles_on_ocade_in.sql`. They can appear in a clean chronological rebuild. Do not replay them after October 3: the newer integrated-console migration replaces the old gate and removes its table/helper. Inspect actual applied history before prescribing production steps.

## 11. Web, model, native and Edge release runbook

Current web deployment is Cloudflare Workers/static assets plus private R2, not a Pages-only pipeline. Read `wrangler.json`, `scripts/deploy.mjs`, `.github/workflows/cloudflare-production.yml` and current provider documentation before executing. Production mutation is outside the documentation mission.

Preconditions:

- frozen reviewed SHA and clean relevant diff; exact lockfiles and generated-type/schema parity;
- applicable automated, dependency/security and real-work gates on that source;
- explicit target/project/environment, secret presence checked without disclosure;
- reviewed backup/rollback version, compatibility and migration order;
- release-scope blockers resolved, external exclusions stated, authorised approval recorded.

Use the existing deploy controller. It uploads an immutable version, stages at zero traffic, verifies exact staged health and entry asset, then promotes and independently probes production. Do not replace it with an unverified direct deploy shortcut. Record commit, package version, Worker version, asset identity and any separate schema/Edge/native/model identities. A versioned health result establishes liveness only; run scoped authenticated smoke tests for actual release behaviour.

Edge Functions, model R2 objects, signed desktop/Android installers and database migrations need separate delivery/verification evidence. Test old clients against new compatible protocol and new clients against supported server versions. Verify exact manifest/package signatures, install interruption, rollback, downgrade policy and key rotation. Offline artifact updates preserve current verified weights until a replacement is verified and activated.

Rollback: use the reviewed compatible Worker/native version and separately authorised controller path; verify health/assets plus affected workflow. A rollback command returning zero is not recovery proof. Schema recovery follows its own contract; web rollback cannot recreate erased data. Retain old compatible immutable assets required by open clients until the retention policy permits removal.

## 12. Paid-launch gate

The current grant system is usable independently of payment collection. Before adding checkout, inspect `entitlement-resolver.ts` and the September 23 payment-retirement migration; do not count historical webhook tests as a live provider integration.

Future billing acceptance requires provider sandbox tests for authenticated checkout, server-selected amounts, exact-byte webhook signatures, replay, duplicate/out-of-order events, lost acknowledgement, renewal, failed collection, cancellation, refund, dispute, entitlement convergence and reconciliation after outage. Test invoices/receipts, audit, permission-limited staff actions, Customer A/B isolation and retained history. Provider/merchant/legal/tax commitments require owner decisions; unresolved ones block paid launch, not independent engineering.

## 13. Documentation-only gate and handoff

For this mission, verify only authorised Markdown changes: current authority hierarchy, requirement preservation, source paths, local links/anchors, document disposition, no competing work queues, model-identity guard compatibility and formatting. Check the final diff includes no source/config/schema/dependency/generated-output changes. Commit/push authorisation is provided by the current owner request; it does not authorise production deployment. Recheck remote main after publishing.

Preserve historical evidence through its retained history/archive and map superseded requirements into the canonical documents. Do not delete legal/licence, immutable donor, recovery or unique test evidence as cosmetic cleanup.

At interruption/reset, record exact checkpoint, files, next unfinished item and blockers in the authorised evidence location. Resume from that checkpoint rather than restarting completed work. The final handoff gives current source/deployment identities, exact PASS/FAIL/BLOCKED/UNTESTED evidence, unresolved defects, recovery instructions and the next PLAN package.
