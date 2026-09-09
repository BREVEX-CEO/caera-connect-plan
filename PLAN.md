# OCADE Final Production-Completion Plan

## Purpose and authority

This is the sole OCADE implementation plan. It replaces earlier continuation/block plans and incorporates the still-valid requirements from the former `PLAN.md`, Codex plans, mission documents, donor evidence, payment/refund/Admin-grant specification and the current canonical documentation set. Product scope is in `docs/PRD.md`; implementation-level technical requirements in `docs/TRD.md`; routes/journeys in `docs/APP_FLOW.md`; concise experience intent in `docs/UI UX Brief.md`; detailed UI/UX in `docs/DESIGN.md`; system/API/deployment architecture in `docs/ARCHITECTURE.md`; the backend data contract in `docs/Backend Schema.md`; engineering constraints in `docs/RULES.md`; testing in `docs/TESTING.md`; current handoff in `docs/MEMORY.md`; durable decisions in `docs/DECISIONS.md`. Do not create another master plan.

Work from a fresh fetch of `origin/main` on one isolated completion branch. Preserve unknown work. Do not reset/clean destructively, force-push or rewrite published history. `main` remains untouched until the exact reconciled final tree passes the complete final matrix. Focused phase checks run during implementation; the final merge uses the exact verified tree.

Production completion means zero known reproducible repository-controlled defects, no duplicate canonical authorities, every shipped control reachable and truthful, externally unavailable capabilities hidden or precisely unavailable, and the exact tested commit merged and deployed.

## Superseded assumptions

Persistent ordinary user content is no longer browser-local-first. IndexedDB, browser/PC vaults, localStorage content stores and persistent offline outboxes are not canonical for chats, projects, tasks, artifacts, memory, notifications or account files. Supabase PostgreSQL and private Supabase Storage become canonical. OPFS is model-only. Temporary unsynchronized local-inference turns may exist only in open-tab RAM with loss warnings and exactly-once sync on reconnection. There is no legacy customer-content migration because there is no production local dataset to preserve.

First unseen browser/device visit shows the commercial landing page and may begin Offline Intelligence preparation immediately in the background. Returning authenticated root visits go directly to Chat; returning seen-but-signed-out root visits go to Sign in. There is no onboarding wizard or separate signed-in dashboard. Chat is home.

Gemini 3.1 Flash-Lite is the pinned online model until the owner explicitly changes it. Exactly three optional server-side key slots are allowed. Normal and Jarvis Cowork are two presentations over one runtime. There is no separately marketed desktop application in this release; a Windows helper is supporting control infrastructure. Payments/refunds/disputes/Admin grants are implemented last.

## Final product and architecture constraints

OCADE is one browser-first workspace centered on Chat, Cowork and Code, supported by Projects, Tasks, Artifacts, Search, Customize, Settings, organizations/Admin, notifications, skills/plugins/connectors, browser control, supported Windows control, mobile/PWA/voice, Offline Intelligence and online intelligence. One canonical authority owns each subsystem. Search before creating; classify overlaps as KEEP, FIX, COMPLETE, MERGE, REPLACE or REMOVE; migrate callers before deletion; never create `new`, `v2`, parallel stores/routers/agent loops/payment stacks/native engines merely to avoid understanding current code.

The source tree converges incrementally toward `src/app`, `src/features`, `src/core`, `src/platform`, `src/data` and `src/shared` as described in `docs/ARCHITECTURE.md`. Moves must be dependency-closed and useful, not cosmetic.

The entire verified 2,126-file OCADE_PRIMARY_LOGIC donor must be re-evaluated after core boundaries stabilize. Maximize useful direct/adapted reuse, especially Chat session/query/context/rewind/resume, Cowork coordination/recovery, Code/coding-agent logic, agents/subagents, tasks, tools, file operations, Git, LSP/IDE, shell safety, permissions, memory/compaction, browser/computer control, approvals/progress/recovery and reusable UI behavior. Do not ship duplicate donor providers/servers/routers/stores/task managers/telemetry/terminal UI simply to increase reuse count.

## Ordered implementation phases

### Phase 0 — Fresh baseline and evidence repair

Fetch current `origin/main`, inspect Git state and inventory routes, stores, adapters, migrations, Edge Functions, generated files, donor/evidence ledgers and shipped chunks. Repair stale generated evidence, formatting defects, failing tests and obsolete browser journeys before feature work. Regenerate one requirement-to-authority ledger. Gate: install, format, typecheck, zero-warning lint, full/shuffled tests, deterministic build and generator stability have no unexplained repository-controlled failure.

### Phase 1 — Architecture cleanup and one authority per subsystem

Establish import/ownership boundaries, split materially mixed files such as the oversized Chat route, remove dead routes/components/future chunks and compatibility shims only after caller migration, and eliminate obsolete onboarding/local-storage-choice/More-dashboard/demo paths. Gate: one canonical owner per subsystem and no known dead shipped control/route.

### Phase 2 — Supabase canonical persistence

Follow `docs/Backend Schema.md` and move conversations/messages, Projects, Tasks/runs/events/approvals, Artifacts/versions/provenance, Memory, settings, notifications and ordinary account data to typed Supabase repositories; use private Storage for files/artifact bodies. Add RAM-only unsynced turns with idempotent reconnect sync and close/reload/sign-out warnings. Incognito never persists. Add a static prohibition against ordinary content in IndexedDB/localStorage/OPFS/Cache Storage/browser vaults. Gate: ordinary user content has one persistent authority—Supabase/Storage.

### Phase 3 — Supabase security, Auth, MFA and schema reconciliation

Using the data/RLS/migration contract in `docs/Backend Schema.md`, semantically reconcile source/live migrations before applying changes. Repair RLS, grants, Storage policies, privileged functions/search paths, indexes and generated types. Complete email/password, verification/OTP and configured Google OAuth, session restore/expiry/revocation, optional ordinary-user MFA and recent AAL2 for dangerous organization/Admin/support/billing actions. Gate: no client-controlled ownership, unintended elevated function or cross-tenant data path.

### Phase 4 — Commercial usage and offline leases

Complete the existing server-authoritative generation permit: Free exactly 28 successful logical AI requests per 388-minute window; paid dual windows shown as percentage/reset; Max uses the same mechanism at higher capacity. Retries/tools/subagents/failover count once; pre-output failure/cancellation releases. Complete signed device-bound offline allocations with replay/clock rollback/cross-device reconciliation tests. Gate: possible consumption cannot exceed authoritative capacity.

### Phase 5 — OCADE Intelligence, Gemini and model lifecycle

Route every AI-generating surface through one `OcadeIntelligence` boundary after permit acquisition. Pin Gemini 3.1 Flash-Lite and exactly three server secret slots: primary, secondary, tertiary. Use primary-first health failover only before meaningful output; do not rotate to evade project-wide quota; Local-only performs zero provider DNS/fetch/preconnect/health traffic.

Start Offline Intelligence preparation on first visit without blocking landing/auth. Verify manifest/chunks/hashes before fetch, resume interrupted ranges, repair only missing/corrupt chunks, reuse content-addressed chunks across compatible releases, and keep model binaries in OPFS only. Reload, sign-in/out, account deletion, service-worker/application deployment and normal revisit must not reinstall or redownload a verified model. Only explicit Remove Offline Intelligence deletes it; deliberate removal suppresses automatic reinstall until explicit Install. Gate: one model authority and proven zero-unnecessary-redownload behavior.

### Phase 6 — Complete donor re-evaluation

Reassess all 2,126 donor files against post-refactor authorities with deterministic dispositions: direct safe reuse, adapt, behavioral port, current OCADE stronger or reject/remove. Validate provenance, dependency closure, compatibility and runtime reachability for every merged behavior. Gate: maximum useful donor behavior with no parallel donor product architecture.

### Phase 7 — Production Chat

Complete conversation lifecycle, streaming/stop/retry/regenerate, branching/side conversations, attachments/private files, citations/web retrieval, tools, account/project memory, Incognito, sharing/revocation, archive/trash/restore/delete/export/search, cross-session/device persistence, usage/provider/model/session recovery, mobile/keyboard/a11y behavior. Gate: every visible Chat control works against canonical authorities and browser journeys show no unexplained console/network/storage error.

### Phase 8 — Normal Cowork

Complete one outcome-oriented task runtime with concise plan/current step, meaningful approvals, files/research/browser/supported computer operations, receipts/postcondition verification, pause/takeover/stop/emergency stop and crash/reload/reconnect recovery. The Command Center is a collapsible inspector, not a dashboard. Gate: work completes from observed state rather than simulated progress.

### Phase 9 — Jarvis Cowork

Build Jarvis only as a view/controller over the same Cowork runtime. Implement the original liquid-glass/network orb, idle wave/breathing motion, microphone amplitude/frequency reactivity, distinct Listening/Speaking/Thinking/browser-action/computer-action states, user-selectable scoped accents, text fallback, reduced-motion/static fallback and contextual observation panels. Gate: Normal and Jarvis produce identical task history, permissions, usage and receipts.

### Phase 10 — Production Code

Complete real repository intake/mapping, file tree/editing/search/symbols/diagnostics, exact patches/conflicts/review/undo, Git status/diff/branch/worktree/commit/push/PR when authorized, CI status, permissioned terminal/process/LSP/dev-server/preview/browser verification, parallel sessions/subagents and durable task/artifact outputs. Use strong donor coding-agent code where safe. Gate: every success is based on observed repository/tool postconditions.

### Phase 11 — Projects, Tasks, Artifacts, Search and Memory

Finish Projects as the shared context graph; Tasks as the unified home for missions/schedules/automations/monitors/action-required/inbox/runs/Dispatch; Artifacts as the versioned/provenance output library; Search as authorized bounded server-side search plus Cmd/Ctrl+K; Memory as Supabase-backed, scoped, sourced, reviewable/editable/deletable and Incognito-excluded. Gate: one connected workspace graph with no disconnected admin shells or local duplicate stores.

### Phase 12 — Agents, tools, skills, plugins and connectors

Consolidate one agent/subagent lifecycle and one tool/capability registry. Enforce manifest validation, bounded delegation, cancellation/recovery, permissions, usage, plugin isolation/unload, connector consent/scope/revocation/health and fail-closed hooks. Hide unconfigured integrations. Gate: extensions cannot bypass identity, usage, permission or tenant boundaries.

### Phase 13 — Browser extension and Windows host

Complete extension pairing/scoping with minimized permissions, DOM/accessibility-first observation, context reacquisition after navigation/tab/window/stale-element/reconnect and postcondition re-observation. Consolidate PyWin32/UI Automation, Win32/native/Rust, vision and PyAutoGUI behind one Windows `RemoteExecutor`: semantic UIA/Win32/application APIs first, native APIs where appropriate, vision next, PyAutoGUI/coordinates only as guarded fallback. Preserve loopback/origin validation, pairing, protected-input refusal, cancellation and emergency stop. Remove competing engines after callers migrate. Gate: real Chrome/Edge and supported Windows journeys prove safe observed postconditions.

### Phase 14 — Mobile/PWA/voice

Complete Android Chrome/PWA and iPhone/iPad Safari/PWA layouts, safe areas, virtual keyboard/back/deep links/OAuth return, application-shell caching separated from model OPFS, remote task observation, voice permission/cancellation/route shutdown and real push channels only when delivery-proven. Gate: every visible platform feature has real proof or precise unavailable state.

### Phase 15 — Organizations, Admin, notifications and public trust

Complete workspace switching, members/invitations/roles/groups/seats/policies/ownership safeguards, strict tenant isolation, usage/billing overview and immutable audit. Support-content inspection requires time-bound case-scoped read-only grant, recent AAL2, reason/expiry and per-object access events—never unrestricted raw DB browsing. Complete configured notifications and truthful Help/Status/Security/Responsible Disclosure/legal lifecycle states. Gate: server-enforced tenant/support boundaries and real provider truthfulness.

### Phase 16 — Monitoring, backup, restore and rollback

Add privacy-safe structured diagnostics for release/operation/error class/latency/provider slot/task/Edge Function/webhook health without secrets or unnecessary content. Prove scheduled database/Storage backup, isolated restore rehearsal with RLS/integrity checks, versioned releases and previous application/Edge Function/Cloudflare rollback. Gate: recovery is demonstrated, not just documented.

### Phase 17 — Final OCADE UI/UX consolidation

Only after logic/information architecture stabilizes, implement the experience intent in `docs/UI UX Brief.md` and the detailed design system in `docs/DESIGN.md` together. Use Claude as the primary interaction/information-architecture benchmark, ChatGPT for universal chat/composer polish and OpenClaw for transparent autonomy/control patterns, while keeping original OCADE branding/assets/code and avoiding pixel-for-pixel trade dress. Remove duplicate buttons/toolbars, keep one obvious primary action, move secondary actions contextually, remove old More, implement sparse Projects/Tasks/Artifacts/Customize, shared Chat/Cowork/Code shell, complete light/dark appearances and all empty/loading/error/recovery states. Jarvis is the expressive exception; ordinary surfaces remain calm. Gate: visual route/control matrix is coherent, responsive, reachable and distinctly OCADE.

### Phase 18 — Localization, accessibility, performance and defect cleanup

Complete required locales and locale-aware dates/currency/reset text; WCAG AA, keyboard/focus/dialog semantics, announcements, 44×44 targets, zoom and reduced motion/transparency. Explicitly eliminate the five silent speed killers: N+1 queries, missing evidence-backed indexes, unbounded reads, unoptimized media and giant eager bundles. Use query-plan evidence, cursor pagination for growing feeds, bounded admin pagination, optimized responsive media and lazy loading for editor/PDF/Jarvis/model/native/media tooling. Meet the budgets in `docs/TESTING.md`/current build authority with headroom. Gate: zero known accessibility blockers and meaningful performance margin.

### Phase 19 — Payments, refunds, disputes and Admin grants (LAST)

Merge historical subscription/payment authorities into one server-authoritative billing-event/subscription/entitlement system while preserving history. Use server-created checkout intent and authoritative plan/cadence/currency/amount, provider-hosted payment, signed webhook/server reconciliation, normalized immutable events and idempotent atomic state application. Complete activation, renewal, upgrade/downgrade, cancellation/period-end, expiry/failure recovery, billing history, invoices/payment-method management, full/partial refunds, disputes, chargebacks/reversals, fraud/risk rejection and sandbox/live separation.

Admin grants are separate entitlements, never fake payments. Email may locate an account; immutable Auth user ID is the mutation target. Require authorized role, recent AAL2, reason, start/end where applicable, immutable audit and revoke state for Free/Pro/Max/custom grants. A browser redirect, client amount, profile text or guessed provider ID never grants access. Gate: only authoritative server evidence can change commercial access; live charging stays disabled until provider/tax/legal/operational gates are genuine.

### Phase 20 — Final reachability, disposal and documentation reconciliation

Trace every visible route/control → feature use case → core policy → data repository/platform adapter → Supabase/RLS or approved executor → usage/permission/task receipt where applicable → observed postcondition. Rewire remaining disconnected callers. Remove dead modules, superseded local content stores, compatibility shims, duplicate routers/stores/bridges/agent loops/registries/native engines, dead routes/chunks, raw donor extractions, obsolete provider integrations, fake controls and stale contradictory docs after unique useful content is preserved. Regenerate route/donor/parity/gap/control/security/storage/database/release ledgers. Gate: every shipped capability is reachable and every removed authority has no required caller/provenance/legal role.

## Checkpoints and verification

Every phase records changed authorities, remaining callers, migration state, focused tests and runtime evidence. Do not merge partial implementation to `main`. Focused testing follows each phase; any failure returns to its owning phase and is fixed at root cause.

After Phase 20, run the exhaustive final matrix from a fresh clean checkout: deterministic install, format, typecheck, zero-warning lint, generators, full/shuffled/isolation tests, concurrency/fault injection, production build, clean-tree proof, browser/server boundary, secrets, dependencies/SBOM/licences/release package; Supabase source/live parity, generated types, RLS/grants/security/performance advisors, auth/MFA/session/deletion, Storage ownership/quota, backup/restore/rollback; usage permits/offline leases; Gemini three-slot behavior, Automatic/Online/Local-only and zero-provider-network Local-only proof; first-visit model install, interrupted resume, corruption repair, content reuse, no-redownload across revisit/login/logout/account deletion/deployment/service-worker update, remove/reinstall; real browser journeys for landing/auth/Chat/Normal Cowork/Jarvis/extension/Windows/Code/Projects/Tasks/Artifacts/Search/Memory/agents/capabilities/org/Admin/notifications/trust/error states; Chrome/Edge/Safari/Firefox ordinary UI, Chrome/Edge extension, Android/iOS PWA where available, supported Windows, accessibility/responsive/performance; and commercial sandbox activation/renewal/cancel/refund/dispute/Admin-grant lifecycle where configured. Every browser journey inspects console, network, storage and postconditions.

No shipped-feature skip, blanket suppression, ignored rejection, unexplained stderr or hand-edited generated evidence is accepted. External configuration that is genuinely absent remains hidden/unavailable and is not counted as a pass.

## Git integration and deployment

After the complete matrix passes, fetch latest `origin/main`, reconcile upstream without discarding valid work and rerun the complete matrix on that exact tree. Create the final verified product commit, fetch `origin/main` again, reconcile/reverify if it moved, then fast-forward `main` without force and verify the remote SHA/tree. Only then confirm backups/restore/rollback, apply reviewed forward-compatible Supabase migrations, deploy matching Edge Functions/secrets, stage the exact Cloudflare release, run staging smoke/critical journeys, promote that exact release, verify production journeys/monitoring/release SHA and roll back immediately on deployment regression.

## Final definition

OCADE is complete only when the deployed verified release contains one coherent Chat/Cowork/Code workspace; Supabase-authoritative account/organization data; durable private files; complete Normal/Jarvis Cowork and Code; Projects/Tasks/Artifacts/Search/Customize/Settings; agents/capabilities; automatic persistent Offline Intelligence with verified no-redownload behavior; Gemini 3.1 Flash-Lite through one secure three-slot boundary; one usage authority; real browser/supported Windows control; responsive PWA/mobile/voice; Auth/MFA/org/Admin/audited support; truthful notifications/trust/legal states; monitoring/backup/restore/rollback; the final OCADE UI; production accessibility/performance; server-authoritative subscriptions/refunds/disputes/Admin grants; zero known reproducible repository-controlled failures; and one verified remote commit matching the tested/deployed tree.

## OPTIONAL FUTURE IMPROVEMENTS — DO NOT IMPLEMENT

Leave this section empty during implementation. Future suggestions may be written only after every mandatory requirement above has been implemented, wired, tested, merged and successfully deployed.