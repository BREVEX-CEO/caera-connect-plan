# OCADE verification and release handbook

[Open work](../BLOCKED_TESTS.md) is the single unresolved implementation and verification queue. This document owns test methods, evidence, release acceptance and recovery. [SUPPORT_LEGAL_SECURITY.md](SUPPORT_LEGAL_SECURITY.md) owns security/commercial contracts; [ARCHITECTURE.md](ARCHITECTURE.md) owns subsystem design. Historical audit matrices describe their own snapshots, not current readiness.

**Current execution authority — 19 October 2026:** the owner authorizes implementation and testing exclusively through their existing Google Chrome on their PC, operating OCADE as a customer. This supersedes the historical documentation-only mission, cloud-first procedures and PC-test holds below. Do not execute Actions, cloud runners, remote browsers, separate emulators, external test environments or CLI/unit/database/native suites. Source editing, formatting and local candidate serving are engineering work, not workflow passes. Use real authorized staging accounts, disposable data and OCADE's approved scoped companion for supported PC work. Production data, production deployment, merging main, payments and spending still require explicit approval. Gates that cannot be proved through this setup remain BLOCKED; historical results remain historical.

**20 October clarification:** Computer Use may independently inspect the companion's resulting files and native application state. The assistant must not perform an OCADE task itself and count that output as an AI/JARVIS completion. Native APIs, scoped scripts, formats, structured browser/accessibility and vision are execution choices inside the existing approved pipeline. Permitted staging setup is autonomous; mandatory personal security actions stay BLOCKED without repeated setup questions. The requested `TOFIX.md` is a repair handoff linked to the existing evidence queue, not a waiver of a blocked first complete pass.

**22 October 2026 (phases.md), cloud evidence on `ocade/p00-p22-implementation`:** the owner's phases.md authorises disposable cloud testing on this branch. Commands and results at `e5995307`:

| Check                   | Command                                                                                                                                                                                               | Result (class)                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit, database, runtime | `npx vitest run`; `python3 -m pytest jarvis-runtime/tests` (Xvfb for screen tests)                                                                                                                    | 1,535 PASS (LOCAL/DATABASE TEST); runtime: only the 4 container-environment failures known on the baseline                                                                                                      |
| Static gates            | `npm run lint typecheck format:check audit:secrets a11y:check reachability:check reads:check controls:check identity:check content-storage:check monochrome:check supabase:types-check routes:stable` | all PASS except `format:check` on the owner's `phases.md` (left unformatted on purpose)                                                                                                                         |
| Browser journeys        | `PLAYWRIGHT_CHROMIUM=… xvfb-run node scripts/e2e/harness.mjs`                                                                                                                                         | 921 PASS; admin ownership check FAIL once, PASS on rerun (ADMIN-21-01 flaky); BLOCKED: speech service, office apps, push service, live key, offline release, Firefox/WebKit builds (MCP BROWSER, stub Supabase) |
| Real model tasks        | `experiments/architectures/live.ts` + oracles                                                                                                                                                         | [real-task record](audit-checkpoints/real-tasks-20261022/README.md) (LIVE staging, Standard)                                                                                                                    |

A real-model result counts only with its independent oracle; a device action called directly (such as the Shotcut project check) is labelled as such and never counted as a JARVIS completion.

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

Current Chrome regression recipes (19 October): on an unconfigured loopback candidate, enter an unsent disposable draft, press Send, observe the account-service-unavailable sign-in page, return to Chat and verify the exact draft. Open Library and `/admin?module=usage`; both must reach the same clear page with their full destination preserved in `next`, without an internal environment-variable error or protected content. These checks do not qualify hosted authentication or tenant isolation. On Help, search `stop`, expand both STOP answers and verify that recorded stop, device confirmation, delayed delivery and already-made effects are distinguished. Native cancellation/recovery needs a separate real OCADE task with independent device/output evidence.

20 October Settings regression: as a signed-out visitor, open Settings from JARVIS and visit Account, Notifications, Privacy & Security and Billing & Usage. Each must ask for sign-in without account mutation controls or account-data queries. Appearance remains available on this device. The sign-in link preserves `/ocade-jarvis` and its query. Repeat after actual sign-in, sign-out and account switch; the limited anonymous check cannot establish those paths. On staging sign-in, the subtitle must agree with actual available providers.

20 October file-proof regression: create disposable distinct names differing in case, whitespace or separator interpretation where the actual filesystem supports them. Reading another name cannot verify the changed target. A fresh read using the exact submitted target can provide structural proof, but still needs the workflow's semantic postconditions. Alias/canonical-identity compatibility remains a real-device gate; broad mutation invalidation must not be weakened to make aliases pass.

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

Start each wave with a safe read proving target/tool AND HOST identity. Use exact locked/project-compatible tool versions; verify current tool help rather than copying an obsolete invocation. Optional developer MCPs (Microsoft Playwright MCP, Appium MCP, GitHub read/status) must be checked for maintainer, permission scope, isolated cloud-host execution, credentials and tool-output accuracy before use. A locally launched Claude Code stdio MCP executes on Claude's host; it is NOT automatically in GitHub cloud. Do not commit auto-enabled filesystem, desktop or emulator MCP access to the owner's machine. Deterministic existing CLI scripts remain the default for CI; MCP is optional for exploratory remote testing only, never a customer requirement or a substitute for a real device/application.

Use disposable cloud-hosted unit/SQL/browser tests FIRST, then remote Android SDK emulator and suitable remote Linux/Windows interactive application environments, under the current owner scope and [engineering rules](../AGENTS.md). The owner's normal computer, real browser profile, personal documents and locally installed Android Emulator are never default testing targets. Existing main-branch workflows are `cloud-browser-isolated.yml`, `cloud-python-isolated.yml` and `cloud-android-isolated.yml`; reconcile them safely to the candidate source before claiming candidate evidence. All heavy suites are manually initiated with bounded time, included GitHub Free allowance, the existing $0 paid-overage budget, no large persistent artifacts and no unsanctioned provider costs. A green portable/browser/Android smoke run proves only the checks actually performed. Label emulator battery, sensors, background, OEM and real-human limitations. Native Windows Office requires an appropriate interactive remote Windows session and valid app licences—not merely a headless Linux/browser job. WebKit/PWA emulation is not physical iOS evidence. If any provider/hardware/licence is unavailable, record the exact gap as BLOCKED; never buy a machine/device/API subscription or run the owner's PC without separate explicit approval.

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

Run the existing Appium Android journey inside the remote emulator first, and use a separately validated remote Mobile/Appium MCP only when it provides a distinct independent verification benefit. Do not require both MCPs or install them on the owner's computer. Device/emulator capability is explicit. Verify fresh observation binding, stale hierarchy rejection and STOP during active gestures/actions. Never instruct users to disable platform protection.

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

### Corrected AI route qualification (19 October 2026)

Standard is Gemini 3.5 Flash-Lite on all three existing server-only key slots. High is explicit Workers AI Gemma 4, never a Standard fallback. The removed Google-proxy settings are not prerequisites for Standard. Never extract production secret values. Verify each existing slot’s presence, actual project grouping, free entitlement and active limits via authorized metadata/AI Studio. Key count cannot establish quota. A missing staging credential is BLOCKED, not a product failure or permission to reuse production secrets.

Workers AI documents 10,000 Neurons per account per UTC day, shared across models; Paid can bill above it. Gemma 4 is available on Free. The candidate deliberately refuses Paid and unreadable/ambiguous eligibility; its conservative subscription parser must first be checked against the real account. Current billing read is refused (10000), so no inference or account change is permitted. Do not replace this blocker with a guessed quota, estimated token ledger or manual “free” switch. Qualify a fresh free-only account response, server secret configuration and the exact OpenAI-compatible stream before activation. Initial/persistent/five-minute warnings must be tested with time advancement, switching modes, leaving the surface and restored tasks. One completed verified JARVIS task still costs one use.

`scripts/e2e/gemini-contract.mjs` uses the existing staging-key environment variable, pins only Gemini and reports request p50/p95, calls and tokens. It is a protocol probe, not a customer benchmark. `scripts/e2e/workers-ai-contract.mjs` first checks disposable credentials and readable hard-capped Free billing, then probes native arguments/continuation with p50/p95 and token counts. It exits BLOCKED before inference if eligibility is unknown. For High, also replay matched native history, screenshots, fragmented calls, terminal loss, STOP and failures against the Workers endpoint after free eligibility is established. No Google key may travel to Cloudflare, and no Cloudflare token may travel to Google. Verify three-slot credential failover, same-slot quota retry, no model switch and no retry after output. Verify that old clients cannot erase a task’s saved quality, and High cannot invoke the separate Google-grounded research helper.

Run the same seeded JARVIS video/photo/workbook/browser/PC cases through each mode. Independently inspect media, formulas, cells, files and app state. Record candidate, environment, seed, mode, slot name (never value), real calls/tokens/Neurons, elapsed milliseconds, accuracy, failure class, intervention and checker outcome. Report matched denominators and p50/p95, every false completion and failed retest. Require at least **95% independently verified real-task success in every major workflow family** with no unresolved critical findings; fixture tests and arithmetic probes never enter that denominator. Native Windows/macOS/Android/iOS and release gates remain separate blockers.

Primary references checked 19 October: [Gemini model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [project-specific active limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Free-plan model availability](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/), [Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/). Cloudflare’s authenticated catalogue/schema confirms tools, reasoning, vision and a 256,000-token context; API feasibility is not measured task success.

### Production-readiness evidence score (frozen 19 October 2026)

Each gate below is binary and worth 10 points; **score = 100 × fully qualified gates / 10**. A blocked, partial, failed, stale or untested gate scores zero. This is release-evidence coverage, not a software-completion estimate. All gates must pass for launch; a known critical defect blocks it regardless of score. This checklist does not replace the detailed release matrix in this document or [open work](../BLOCKED_TESTS.md). Earlier candidate results below remain dated evidence, not automatic qualification of a changed working tree.

| Gate | Required evidence                                                                      | Current status                                                 |
| ---- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| R1   | Exact candidate full web verification, reproducible build, production dependency audit | BLOCKED: full suites cannot run under Chrome-only authority    |
| R2   | Real staged auth/account/tenant/commercial browser journeys                            | BLOCKED: staging exists; server credentials/account setup open |
| R3   | Both provider protocols, all three key slots, actual free quotas and cost guard        | BLOCKED: staging credentials and billing read                  |
| R4   | At least 95% independent real-task success in every major workflow family              | BLOCKED/FAIL: current complete family matrix not qualified     |
| R5   | Native cross-surface history, restart, ownership, STOP and unknown-effect recovery     | PARTIAL: fixture evidence only                                 |
| R6   | Signed Windows/macOS installation, update and rollback on real executors               | BLOCKED: executors/signing                                     |
| R7   | Android and iOS permission, lifecycle and execution matrix                             | BLOCKED: devices/simulators                                    |
| R8   | Completed security triage with zero known critical findings on release candidate       | PARTIAL: broader triage/release matrix open                    |
| R9   | Approved release gate, auto-deploy isolation and rollback rehearsal                    | FAIL/BLOCKED: REL-00-02 and rehearsal                          |
| R10  | Operational capacity, privacy/rights, support and commercial acceptance                | BLOCKED: outstanding launch matrix                             |

Historical pre-resume corrected-candidate score: **10/100 (R1 only; 1/10 fully qualified gates, 9 open)**. Full web verification passed all 15 gates with 125 files / 1,462 tests; production dependency audit reports zero vulnerabilities. Native portable fixtures passed 24/24 in 1.017 s. These results do not qualify live workflow families.

**Current 19 October working candidate: 0/100 (0/10 fully qualified release gates, 10 open).** Routing and task-authority source changed after that baseline. Focused remote logic regressions do not replace the exact candidate's full R1 verification, PostgreSQL, browser, provider, native, security or release gates. The continuation checkpoint records their actual results and limitations. The free pilot defers payment collection; its release scope must still pass every applicable security, operational and real-work gate before explicit owner release approval.

R4 records separate attempted/independently verified/failed/unsafe/unknown counts for Standard Chat, explicit High Chat, Offline Chat, JARVIS browsers, files/text editing, Excel/spreadsheets, Word/PDF, PowerPoint/presentations, photo editing, video editing and general PC workflows. Preserve editable outputs where supported. Cross-cutting STOP, recovery, permissions, concurrency, installs and voice checks remain mandatory. Report 0 eligible current trials as **UNTESTED**, never as a measured 0% success rate; disclose sample sizes and uncertainty at the 95% threshold.

Do not turn the R4 denominator of 0/5 qualified families into “0% task accuracy”: there are no new eligible completed live tasks on this corrected candidate. Historic failed live media tasks remain open. Report this score after each major milestone alongside counts and concrete blockers.

## 12. Paid-launch gate

The current grant system is usable independently of payment collection. Before adding checkout, inspect `entitlement-resolver.ts` and the September 23 payment-retirement migration; do not count historical webhook tests as a live provider integration.

Future billing acceptance requires provider sandbox tests for authenticated checkout, server-selected amounts, exact-byte webhook signatures, replay, duplicate/out-of-order events, lost acknowledgement, renewal, failed collection, cancellation, refund, dispute, entitlement convergence and reconciliation after outage. Test invoices/receipts, audit, permission-limited staff actions, Customer A/B isolation and retained history. Provider/merchant/legal/tax commitments require owner decisions; unresolved ones block paid launch, not independent engineering.

## 13. Documentation-only gate and handoff

For this mission, verify only authorised Markdown and documentation-only audit-checkpoint changes: current authority hierarchy, requirement preservation, source paths, local links/anchors, document disposition, no competing work queues, model-identity guard compatibility and formatting. Check the final diff includes no source/config/schema/dependency/generated-output changes. Commit/push authorisation is provided by the current owner request; it does not authorise production deployment. Recheck remote main after publishing.

Preserve historical evidence through its retained history/archive and map superseded requirements into the canonical documents. Do not delete legal/licence, recovery or unique test evidence as cosmetic cleanup.

At interruption/reset, record exact checkpoint, files, next unfinished item and blockers in the authorised evidence location. Resume from that checkpoint rather than restarting completed work. The final handoff gives current source/deployment identities, exact PASS/FAIL/BLOCKED/UNTESTED evidence, unresolved defects, recovery instructions and the next dependency-ready open-work entry.

## 14. October 10 local-first readiness and evidence integrity gate

**Full source audit reconciliation:** The recovered [coverage checkpoint](audit-checkpoints/20261010/coverage.json) records 989/989 historical baseline paths (435 saved +262 carried +292 new; 957 full-text, six empty/generated, 26 structural/binary), zero pending baseline paths and hash/range/reviewer provenance. Original local dirty checkpoint bytes and SHA-256 remain preserved; old remote audit commit `deee395fbf5ed709f18354164ccf5f3788f418c6` retains its historical 382/989 observation. PR #74 review checked original hashes, unchanged current contents including explicitly recorded newline-only equivalence, and the 10 changed documents. The added checkpoint is not counted as an extra audited baseline source. Read only changed/new/uncovered content at the next SHA; structural classifications and source reading do not prove installed behaviour or licence clearance.

**Test validity corrections:** Inspect and reproduce current tests that (a) fixed account `INSERT...ON CONFLICT DO NOTHING` then unconditional destructive `DELETE`; (b) accidentally catch an unexpected success; (c) accept SQL NULL as correct assertion; (d) confuse foreign key with CHECK enforcement; (e) report policy/index existence rather than effective account grants; (f) use migration-stage assertions for the current schema; (g) interpret authorised emergency STOP as failed health; (h) inject test notifications into a supposedly independent Web Push deliverability proof; (i) mislabel mock installed browser/native/Android/offline evidence; (j) print recovery codes, bearer token fragments or signed URLs. Reproduce in isolated fixtures, preserve original useful tests and only replace broken assertions with behaviorally falsifiable ones. A source read is not a reproduced failure.

**Comparable ten-task matrix:** (1) Excel→Word/PDF native output; (2) chosen signed-in browser account and status report; (3) cross-window text editing with active user input; (4) coding change via VS Code/Git and actual tests; (5) unknown installed app with no prewritten adapter; (6) STOP between target resolution and native invoke; (7) crash after save before acknowledged result; (8) revoke selected device/grant while work queued; (9) real mic barge-in versus spoken STOP; (10) phone-initiated PC execution after sleep/disconnect. For each record test initial conditions, intended user outcome/predicates, runtime/hardware/versions, permissions, original/OCADE candidate, observed independent file/remote state, reversible versus irreversible effects, screen/GUI user experience, verified completion numerator and total attempts. Unknown or unavailable competitor capabilities remain UNKNOWN, not poor scores or victories.

**Speed/efficiency:** 100 warmups + 1,000 warm trials per local microbench; record p50/p95/p99 and worst case for native admission (initial p95 ≤10ms), cached discovery (≤5ms), local handoff (≤20ms) and local STOP flag (≤50ms) on a named Windows reference device. Separately time disk journal flush, model prompt and response, network round trip, app processing/render, semantic output verification and full user-perceived outcome. Record model tokens/calls, per-task server cost, cpu/peak RSS, IO, thermal impact, work lost on crash, human interventions and real retry count. Hypotheses are not current benchmarks. Competitor outcome results require equivalent workload and permission environment.

**Release/platform proof:** Browser Chrome/Edge/Firefox and Safari/WebKit; local Windows installed UIA + real Microsoft Office/project IDE tasks; Android emulator Pixel 6a API34 x86_64 / Appium, plus separately scoped actual hardware OEM wake/accessibility, which stays BLOCKED if absent; real Mac and Apple-supported Safari/iPhone when hardware access exists, otherwise BLOCKED. Physical installed pairing, signature, update/uninstall, offline OPFS cold-start, subscription/merchant sandbox if approved, direct PostgreSQL two-session RLS/owner transfer, malformed protocol, poisoned model/page instructions, revoked permission, secure logs and data erasure are individually required for shipped claims. Native application support requires installed edition/version proof. Zero skipped required cases may be silently counted as PASS.

**Doc-only PR validation:** only `PLAN.md`, existing specialist Markdown, approved dated audit artifacts and individually justified redundant Markdown may change. Validate all cross-links, 60 decision mappings, syntax/anchors, no unlabelled v2 field conflicts, exact-source references, unchanged product files/lockfiles/config/migrations and no secrets/customer content. Run pinned Prettier only on targeted Markdown and `git diff --check`; review required GitHub CI `verify:full` and dependency audit. If required checks fail beyond documentation scope, leave PR open and report blocker. Do not run a manually approved production deployment, waive a security gate or merge without required checks. Verify remote main SHA and product-tree parity only after a real merge.

## 15. Cross-application benchmark and conditional on-device isolation acceptance

[WindowsWorld, ACL Findings 2026](https://aclanthology.org/2026.findings-acl.750/) evaluates 181 desktop workflow tasks, averaging five subgoals across 17 desktop apps; about 78% are multi-app. Its reported sub-21% multi-app agent success rates are paper results on its controlled benchmark, not OCADE measurements. Add a reproducible process-aware test set with intermediate checkpoints, ≥2/≥3 installed apps, correct target identities and verified final native artefacts. Record exact Windows fixture, benchmark task selection, permission setup, vendor/model/broker versions, trial seeds, allowed initial state, human takeover and actual success rather than model narrative.

If P08 elects to prototype [Microsoft Execution Containers](https://blogs.windows.com/windowsdeveloper/2026/10/07/microsoft-execution-containers-policy-driven-containment-for-ai-agents/), run explicit prohibited-file/network, inter-session input/clipboard, target app discovery, performance overhead, child process escape and journal/restart proof against the **pinned installed MXC implementation**. Do not claim containment from the [current preview repository SDK](https://github.com/microsoft/mxc), which warns its policy profiles may be permissive. Unsupported Windows/enterprise policy must retain secure limited local routes or show a clear capability refusal. No local sandbox test is a blanket proof of safety against all OS-level adversaries.

## 16. Source-specific end-to-end workflow matrix, 60-decision mapping and evidence grades

Scores describe desired qualification gates, not executed product tests or a claim of 10/10 readiness.

### 9.1 Required workflow matrix

Retain the 42 historical benchmark families and make each fixture executable. At minimum:

- Excel totals/schema drift/macros/partial save.
- Word/PDF structure and pagination.
- PowerPoint media/layout/editability.
- Explicit and ambiguous Google identity.
- Human OTP/CAPTCHA boundary.
- Lost browser submission ACK.
- Unknown app discovery and stale observation.
- File conflict/disk full.
- STOP between resolution and Invoke.
- Physical takeover.
- Rotation/crash/restart.
- Sleeping remote PC.
- Cold offline start/corrupt bytes/accounting reconnect.
- Chat admission cancellation/account switch/destructive uncertainty.
- Voice barge-in/redirect.
- Android lifecycle/state verification.
- Supported Apple hardware operation.
- Local coding/test/diff.
- CAD/Blender/media fidelity.
- Schedule/DST/duplicate occurrence.
- Staff transfer/revoke and partial recovery.
- Complete export/erasure.
- Accessibility/route sweep.
- Prompt injection.
- Signed install/update/uninstall.

Each run records SHA, fixture hashes, platform/app versions, allowed effects, independent examiner, result class, cost, timing, interventions and redacted evidence.

Require zero observed forbidden effects or false-success events in qualification. Report sample size and uncertainty; zero observed failures is not a universal zero-bug guarantee.

### 9.2 All 60 owner decisions

The preservation matrix must contain one row per decision with exact clause, destination and acceptance gate.

| Register          | Destination mapping                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Original 01–03    | P00/P10/P17/P22: useful compatible capabilities, single owners and legal reuse                                                              |
| Original 04–10    | PLAN/documentation gates: substantive packages, minimal authorities, preservation, staged implementation and verified merge                 |
| Original 11–16    | P05/P11: identities, human secrets, ambiguity, scoped remembered permission, extension-free browser and popup recovery                      |
| Original 17–18    | P10/P17: unknown-app discovery and deep professional families                                                                               |
| Original 19–21    | P15: Orb, selected design and compact task/STOP UI                                                                                          |
| Original 22–23    | P12/P10: natural voice and private verified recipes                                                                                         |
| Original 24–26    | P19/P13: isolated real-app fixtures, Windows/browser/coding and honest mobile evidence                                                      |
| Original 27–28    | P18/P21/P19: staged vision and independent adversarial proof                                                                                |
| Local-first 1A/2A | Architecture/P08/P11/P17: online planning, customer-device execution, no hidden cloud workspace                                             |
| Later 01–05       | P17/P10/P08/P03: all families, app selection, background control, durable tasks, discovery                                                  |
| Later 06–10       | P11/P02/P04/P03: installation/elevation approval, copies and uncertain-write readback                                                       |
| Later 11–16       | P09/P08/P17/P10/P03/P01: unavailable PCs, concurrency, coding, recipes, outage and checked completion                                       |
| Later 17–23       | P15/P12/P11: compact UI, requested graph, disclosure, palette, truthful progress, voice and optional pairing                                |
| Later 24–30       | PRD/P18/P20/P22: India audience, multi-app demonstration, monthly/free offer, value-first upgrade, repeats/history, sharing and positioning |

Do not use these grouped rows as a substitute for the final 60-row clause register.

Keep both the requested historical 49-phase provenance and the existing 1–56/addenda mapping. They are separate historical indexes, not numbers to silently replace.

### 9.3 Quality rubric

| Domain                  | Current proof                                                 | Target gate                                                                                     |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Source coverage         | SOURCE: 989 baseline paths reconciled; runtime proof separate | Carry hash-equal reads forward; inspect changed/new content; preserve structural/licence limits |
| Research                | RESEARCHED; named deltas resolved                             | Source-linked profiles and fair unavailable labels                                              |
| Architecture/PC control | SOURCE design; runtime UNTESTED                               | Protocol, final admission and native output proof                                               |
| Multi-app               | Planned; UNTESTED                                             | Reopened artifacts and cross-app predicates                                                     |
| UI/Orb/accessibility    | Source findings and calculated tokens                         | Full route/state screenshots, keyboard/touch and idle measurement                               |
| Security/data           | Source risks; hosted proof incomplete                         | Direct RLS/RPC, concurrency, revoke, erasure and injection tests                                |
| Voice                   | SOURCE lifecycle risks                                        | No stale audio/capture; measured interruption                                                   |
| Offline                 | SOURCE implementation; cold proof required                    | Fresh-process offline and accounting reconciliation                                             |
| Pricing                 | Hypothesis; checkout retired                                  | Approved transactions, repeat value and contribution                                            |
| Debloat                 | Exact source inventory                                        | Replacement/caller/parity/rollback evidence                                                     |
| Claude implementability | Detailed contract                                             | Every package has all 15 fields and no competing authority                                      |
| Release                 | Not cleared                                                   | Exact candidate hosted/physical/licence/release gates                                           |

Historical numerical assessments must remain labelled historical/source judgements. Do not manufacture new “SUPER STRONG” scores from document length.

## PR #74 final documentation review evidence — 10 October 2026

Review began at `700d9c94bc482b6d66c4c4bae56e241e22cad914`, against main `9b2fe3e40fd915dcf32316e5daa20ed7295f8ffb`. Reviewed the original 10-Markdown diff and corrected only documentation: formatter issues, conflicting Orb/graph/layout/palette targets, duplicate v2 envelope sketches, incomplete signed receipt context, physical-takeover exemption, divergent performance limits, launch order and P22 dependency cycle. Preserved all 60 owner decisions and final 1A/2A/3A refinements; each decision now has its own falsifiable acceptance gate, still UNTESTED as implementation proof.

- **LOCAL PASS:** 60 unique decision IDs/selected answers; 23 package IDs and ordered supplements; one v2 envelope/receipt definition; 65 relative links and anchors before this evidence addition; selected text/control/button contrast calculations; no secret-pattern matches; `git diff --check`; lock-pinned Prettier 3.9.5 on changed Markdown and checkpoint JSON. PLAN is intentionally excluded by the existing `.prettierignore`, so its formatter invocation is not claimed as a parsed formatting check. Syntax, links and whitespace were checked separately.
- **SOURCE PASS:** recovered 989-path coverage checkpoint; preserved original dirty bytes/hash; 979 unchanged baseline contents (965 exact working-copy hashes and 14 explicitly recorded newline-only equivalents); 10 current document diff reviews. Binary/generated evidence is not semantic text or licence clearance. This required one added documentation-only checkpoint beyond the original 10 Markdown files; no product/config/test/migration/dependency/infrastructure diff.
- **CI at original head:** [manual CI run 38070193981](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/38070193981) passed route stability, typecheck and lint, then failed formatting on nine documents. Those document errors were corrected. Run the unchanged CI workflow at the corrected PR head to establish current portable results; docs-only path filters ordinarily skip it.
- **LOCAL FAIL / merge BLOCKED:** production lockfile audit returned exit 1, one critical (`seroval@1.5.6`) and one high (`source-map-js@1.2.1`) vulnerable package. Exact advisory IDs and next action are in PLAN P00. Lockfile SHA-256: `b6f90fc8079999d8bfbf4ec82cbb980e70ba4b29f68cd447066eb77f541acbfe`. Do not waive the audit or change dependencies in this documentation stage.
- **UNTESTED/BLOCKED implementation proof:** native application outcomes, physical Android/Apple, hosted RLS/security/provider/payment, runtime performance, licence clearance and matched competitor runs remain their existing package gates. This review did not start implementation or manually invoke production deployment.

Merge only if current required checks pass. Guard the exact head SHA, fetch remote main independently after an actual merge and prove product-tree parity. A mergeable flag or successful Workers build alone cannot override the dependency-security gate.

## 17. Founder B01–B50 customer-value and ethical growth acceptance — 11 October 2026

These gates measure product implementation, **not** this documentation PR. Map B01–B50 exact selections from [DECISIONS](DECISIONS.md), resulting user behaviour from [PRD](PRD.md), screen contracts from [Design](JARVIS_DESIGN_SYSTEM.md) and existing P15/P18/P19/P20/P21 work. Do not add a standalone growth agent, billing authority or privileged event instrumentation. This documentation change alone leaves all implementation evidence **UNTESTED**.

1. **First-use/scope:** With a new authorised test user, prove real free Chat with no credit card/Agent; inspect the clear first screen; execute a real fixture and consented personal-file route, including drag/drop, browse and paste where supported. Verify sign-in, permission explanation and denial; select the right account, file and device; no hidden fallback or unconsented persistence. Test desktop, 320px phone, landscape, zoom, accessibility, keyboard/IME and reduced motion. Measure activation and abandonment without collecting private contents.
2. **Native completion/STOP:** A real installed Windows Agent completes first-value Excel totals and editable Word/PDF under the user's approved scope. Independently reopen artifacts, recalculate totals, check preservation, record runtime and human corrections. Deliberately interrupt, disconnect, revoke, hand off Take Over, corrupt inputs, change app edition and crash between save/ack; assert no false Completed or unsafe retry. Missing physical/hosted proof is BLOCKED, not PASS.
3. **Retention:** Run approved fresh-input Repeat on a changed source workbook, changed app version and altered output preference. Prove version checks, source/output identity, idempotency, scoped recipe retrieval, prior error quarantine, explicit share consent and durable record. Test account switch, client confidentiality and deletion; unapproved sharing is zero. Verify day-7/day-30 repeat only with observed cohorts and report sample size and eligibility.
4. **Purchase integrity:** Before live commerce, use approved provider sandbox and final owner/legal terms to inspect one offer, total price/tax, clear allowance, card-free free tier, failed/partial-task usage, concurrency, limits, renewal, failed payment, refund, billing history, user cancellation, spending limit and safe retry. Real payment remains BLOCKED without owner-specific approvals. Record genuinely paid conversion only after independently checked value; never treat checkout redirect or demo impressions as cash or proof.
5. **Evidence-led marketing:** Every published demo has a permitted fixture, real recorded output, timestamp, app/provider version and explicit opt-in when user material appears. Test sanitisation against filename/screenshot/content/metadata leaks. Each claimed comparator win requires a matched legitimate competitor run with comparable end conditions; report uncertainty and limitations. Referral credits require unique attributable verified eligible use, caps, anti-self-referral and reversal, no posting without explicit consent. For each additional language/country, test UI/help/voice where claimed, payments/legal, supported hardware and reachable support before making availability claims.
6. **Business effectiveness:** Pilot five consented design partners over two weeks as qualitative discovery, preserving pre-task time/error baselines; separately test five paid pilot accounts after commercial readiness. Track first verified result, task-success numerator/denominator, false-success count, correction frequency, first-value latency, human intervention, support effort, 7/30-day voluntary use, paid conversion, refunds, CAC where spend exists, marginal cost per verified output, contribution margin, p95 latency and optional referrals. Do not infer causal price psychology from the 28/8 number or forecast a guaranteed billion-dollar outcome. A launch decision is based on independently reproduced release acceptance, meaningful retained value and sustainable delivery; incomplete/noisy data is PARTIAL.

**Regression contract:** Existing privacy, role-scoped staff permission, STOP, customer export/delete, recovery support, truthful disclosures and legal refund protections remain mandatory even for unselected B questions. Any change touching actual customer states requires corresponding API/database, browser, native and adversarial regression, exact SHA plus environment; once a candidate changes, invalidate the affected qualification evidence. Documentation validation can check references, links, contents and diff, but cannot substitute for these real execution gates.
