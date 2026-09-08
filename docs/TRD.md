# Technical Requirements Document

## Purpose

This document translates OCADE's product requirements into implementation-level technical requirements. It is intentionally narrower than `PLAN.md` and `docs/ARCHITECTURE.md`: `PLAN.md` owns implementation order and release gates; `ARCHITECTURE.md` explains the target system and boundaries; `Backend Schema.md` owns the logical/physical data contract; `TESTING.md` owns verification. This TRD states what the technical product must support without creating a second implementation plan.

The requirements are derived from the current OCADE plan/codebase and the project's documentation discipline: each document owns one concern and cross-references the others instead of repeating full specifications.

## Product Runtime

OCADE is a browser-first AI workspace centered on Chat, Cowork and Code. Projects, Tasks, Artifacts, Search, Customize, Settings, organizations/Admin, notifications, skills/plugins/connectors, browser control, supported Windows control, mobile/PWA/voice, Offline Intelligence and online intelligence support those three primary surfaces.

The signed-in product runs through the existing React 19 + TypeScript + TanStack Start/Router + Vite 8 application. Tailwind CSS 4 and the existing component primitives remain the UI foundation. Supabase owns Auth, PostgreSQL, private Storage, selective Realtime and Edge Functions. Cloudflare/Wrangler remains the web delivery/deployment path. Browser-local inference uses the existing WebGPU/WebLLM and WASM/wllama authorities with OPFS model storage. Capacitor supports the existing mobile/PWA boundary. Browser and Windows control remain adapters behind shared task/permission contracts.

## Supported Environments

Ordinary OCADE web functionality must work responsively on supported modern desktop and mobile browsers, including Chrome/Edge and Safari/iOS where browser capability permits. Browser-control functionality may depend on the approved Chrome/Edge extension environment and must clearly report that dependency. Supported Windows computer control may depend on the local companion/host and must not be represented as available when the host is absent.

There is no separately marketed desktop OCADE application in this release. Native/Rust/Python source exists only as supporting infrastructure for real Cowork/Code operating-system actions.

## Authentication and Session Requirements

Supabase Auth is the account authority. The product must support configured email/password, verification/OTP and Google OAuth paths, session restore, expiry, revocation and authorized deep-link return. Ordinary MFA may be optional; recent AAL2 is mandatory for dangerous organization, platform-Admin, billing, entitlement and support-content operations defined by policy.

First unseen `/` renders the landing page. Returning authenticated `/` resolves to `/ocade` Chat unless an authorized deep link must be restored. Returning previously-seen signed-out `/` resolves to `/auth`. Successful authentication goes directly to the intended authorized destination or Chat; there is no onboarding wizard and no separate signed-in dashboard.

## Persistent Data Requirements

Supabase PostgreSQL is the only canonical persistent authority for structured ordinary user/account content. Private Supabase Storage is the canonical body/object authority for durable customer files and artifact bodies. Feature code must use typed repositories/server contracts instead of creating independent persistence paths.

Ordinary conversations, messages, projects, tasks, artifacts, memory, settings, notifications, billing, organization content and customer files must not use IndexedDB, localStorage, browser/PC vaults, Cache Storage or OPFS as a competing persistent authority. OPFS is reserved for Offline Intelligence model binaries, verified chunks and model-owned metadata.

When Supabase is temporarily unavailable, an eligible local-inference turn may remain only in open-tab RAM. The UI must mark the turn as unsynchronized, warn before close/reload/sign-out, and synchronize exactly once after connectivity returns. Incognito content is RAM-only and never persists or syncs.

## OCADE Intelligence Requirements

Every AI-generating surface must use one normalized `OcadeIntelligence` boundary after commercial permit acquisition. The boundary must preserve one logical generation identity across retries, tools, subagents, provider-key failover and eligible local fallback.

Online intelligence is pinned to the exact stable API model identifier `gemini-3.1-flash-lite` unless the owner explicitly changes it. Exactly three optional server-side key slots are permitted:

- `GEMINI_API_KEY_PRIMARY`
- `GEMINI_API_KEY_SECONDARY`
- `GEMINI_API_KEY_TERTIARY`

Keys must exist only in server/deployment secret storage. They must never be exposed through browser JavaScript, database-readable rows, source, logs or telemetry. Failover is primary-first and allowed only for key-local authentication/health or pre-output provider/transport failure. Project/provider-wide quota must not trigger key rotation to evade quota. No second provider attempt starts after meaningful output begins.

Automatic mode may use eligible installed Offline Intelligence when online inference is unavailable. Online mode must truthfully report online unavailability rather than silently changing semantics. Local-only must produce zero Gemini/provider DNS lookup, preconnect, health request or fetch.

## Commercial Usage Requirements

Free accounts receive exactly 28 successful logical AI uses per 388-minute account window, shared across Chat, Cowork, Code and online/local execution. Paid tiers use the same canonical permit mechanism with server-authoritative limits/windows; the customer UI may present percentage remaining/used and reset time rather than exposing internal capacities.

Permit acquisition occurs before provider/model initialization or costly execution. Retries, tool continuations, subagents, Gemini-key failover and eligible local fallback remain inside one permit. Meaningful successful output finalizes exactly once. Complete pre-output failure/cancellation releases or does not charge according to canonical permit policy.

Usage exhaustion blocks new AI generation but does not block reading history, manual file editing, Projects, Tasks, Artifacts, Settings or Billing.

## Offline Intelligence Requirements

Offline Intelligence preparation begins automatically and non-blockingly on the first browser/device visit where capability permits, including while the landing page is displayed. It must not delay rendering, registration or sign-in and must not create a second model installer.

Before any transfer, inspect the existing manifest, compatibility metadata, chunks and hashes. Use content-addressed OPFS storage, resumable HTTP range/chunk transfer, durable verified checkpoints and incremental integrity verification. Download only missing/corrupt content and reuse compatible verified chunks across releases.

A verified installation must survive ordinary revisits, sign-in/sign-out, account deletion, service-worker updates and compatible application deployments without full reinstall/redownload. Only explicit `Remove Offline Intelligence` deletes model content. After deliberate removal, a small non-content device flag suppresses automatic reinstall until the user explicitly selects Install Offline Intelligence.

## Chat Requirements

Chat is the signed-in home. It must support conversation creation/opening/rename/archive/trash/restore/permanent delete/export/search, streaming, stop, retry, regenerate, branching/side conversations, attachments, private files, citations/web retrieval, tool calls, project/account memory, compaction, sharing/revocation, Incognito and cross-session/device persistence.

Every visible Chat control must call the canonical data/intelligence/tool authorities or present a precise unavailable state. Provider/model/raw donor identifiers are hidden behind customer-facing OCADE Intelligence terminology unless diagnostic/admin context requires otherwise.

## Cowork Requirements

Normal Cowork and Jarvis Cowork are two presentations over one canonical task, agent/tool, permission, usage, memory, browser/Windows execution and receipt runtime. Switching presentation cannot create a second mission, usage charge, task history or permission system.

A Cowork mission must plan concisely, request approval for meaningful side effects, execute through approved adapters, re-observe current state, verify intended postconditions, record receipts and recover safely from reload, reconnect, stale element/window context and host/extension interruptions. Pause, Take over, Stop and emergency stop must reliably affect the canonical run.

Jarvis adds voice/text input and the OCADE liquid-glass/network orb presentation. Listening, Thinking, Speaking, Working in browser, Working on computer, Waiting for permission, Paused, Complete and error/recovery states are views of the same task state. Heavy rendering must lazy-load and respect reduced motion.

## Code Requirements

Code must support real repository intake, project/repository/session linkage, file-tree/workspace interaction, search, symbols, diagnostics, exact patches, reviewable diffs, conflicts/undo, Git status/diff/branch/worktree/commit/push/PR where authorized, CI observation, permissioned terminal execution, LSP, dev-server/preview, browser verification, durable outputs and parallel sessions/subagents where implemented.

Terminal, Git, LSP, CI and native actions must never fabricate output or success. AI edits remain reviewable and destructive actions require policy/permission. When AI usage is exhausted, manual file editing and non-AI repository inspection remain usable.

## Projects, Tasks, Artifacts, Search and Memory Requirements

Projects are relationship/context containers, not duplicate copies of chats/files/tasks/artifacts. A Project links relevant records and permissions through typed relationships.

Tasks unify foreground missions, scheduled/recurring work, automations, monitors, action-required work and run history. Scheduling is timezone/DST-safe. Tasks requiring a browser extension or Windows host must state that executor requirement before execution.

Artifacts are durable outputs with versions, provenance, integrity, project/conversation/task/run relationships, preview/edit/restore/export/delete behavior and private Storage bodies where applicable.

Search is authorization-filtered and bounded. Growing result sets use stable cursor pagination. Memory follows account/project scope and Supabase persistence rules; Incognito bypasses persistent memory.

## Browser and Windows Control Requirements

Browser automation prefers DOM/accessibility semantics and robust element identity. It must re-observe after navigation, tab/window changes, stale references and reconnects. Extension scope cannot be widened by agent output beyond user-approved mission/site permissions.

Windows automation converges behind one `RemoteExecutor`. Prefer UI Automation/PyWin32/Win32/application APIs first, native/system APIs where appropriate, vision next and PyAutoGUI/raw coordinates only as guarded fallback. Issuing an action is not success; the expected postcondition must be observed. Protected inputs such as passwords, OTPs, CAPTCHAs, CVV/PIN and recovery codes remain user-controlled.

## Skills, Plugins and Connectors Requirements

Capabilities must register through the canonical tool/capability authority and obey account/tenant identity, usage and permissions. A connector icon/source file or partial secret does not make a capability available. Unconfigured integrations must be hidden or precisely unavailable. Revocation must remove access without deleting unrelated user data.

## Organizations and Admin Requirements

Organizations require strict tenant isolation, memberships/invites/roles/groups/seats/policies/settings/usage visibility and audit history. Dangerous operations require recent AAL2 and server-side authorization.

Platform-admin/support abilities are internal and least-privilege. Support access to customer content, if enabled, must be case/account scoped, time-bound, read-only where possible, reasoned and immutably audited. Email may locate an account; the durable mutation identity is the immutable Supabase Auth user ID.

## Payment and Entitlement Requirements

Payments, subscription lifecycle, refunds, disputes/chargebacks/reversals and manual Admin grants are mandatory but implemented as the last major product phase. Browser redirects, client-controlled plan/amount fields, local state and editable profile fields must never grant paid entitlement.

Server-created checkout terms plus signed provider events/server reconciliation feed one idempotent state-application authority and immutable normalized billing events. Manual Free/Pro/Max/custom Admin grants are separate audited entitlements requiring appropriate role, recent AAL2, reason and lifecycle fields; they must never fabricate a provider payment.

## Performance Requirements

The five supplied silent performance killers are production blockers:

1. Eliminate N+1 database request loops through joins/batching/server aggregation.
2. Add only evidence-backed indexes for real WHERE/JOIN/ORDER BY/search patterns and verify query plans.
3. Bound all growing list/search/activity/history endpoints with cursor/keyset pagination; ordinary default page size is approximately 20 unless evidence supports another bounded value.
4. Optimize public images/media through responsive dimensions, efficient formats and lazy loading where quality/compatibility allow.
5. Code-split heavy Code editor, PDF, Jarvis/3D, model runtime, native/media and other non-first-paint feature families.

Final performance budgets and Core Web Vitals gates are owned by `PLAN.md` and `docs/TESTING.md` and must pass with headroom.

## Security and Privacy Requirements

RLS and private Storage policies enforce user/tenant isolation. Privileged functions require narrow authorization and safe search paths. Browser bundles never contain Gemini keys, Supabase service-role credentials, payment secrets or native-only privileged authority. Logs/telemetry contain operational metadata only and exclude secrets and unnecessary customer content.

All externally controlled payloads are validated at trust boundaries. Side effects are idempotent where retries are plausible. Unknown provider/device/host state fails closed rather than becoming fake success.

## Reliability and Operations Requirements

Critical state transitions must tolerate duplicate/reordered/replayed delivery. Tasks and commercial events use idempotency and durable receipts/events. Backup/restore and rollback are release requirements, not optional operations work. The exact verified commit must be the commit deployed.

Operational telemetry may record release SHA, operation/route, safe error category/fingerprint, latency, provider-slot health, task-worker state, Supabase/Edge errors and webhook verification result, but not prompts/files/secrets unless a narrowly approved diagnostic flow explicitly requires content.

## Verification Contract

Implementation is accepted only through the tests and runtime evidence defined in `docs/TESTING.md` and the owning `PLAN.md` phase. A source file, compile, rendered button or unit test does not prove a browser/native/provider journey. Final reachability must show one canonical authority per subsystem, every customer-facing control wired, no known duplicate/dead authority and zero known reproducible repository-controlled defect at the final gate.