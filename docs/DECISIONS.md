# Decision Log

This file records meaningful product/architecture decisions. It preserves why major choices exist without duplicating implementation steps from `PLAN.md` or technical detail from `docs/ARCHITECTURE.md`.

## Supabase is the persistent authority for ordinary user content

### Date
2026-09-08

### Status
Accepted; supersedes browser-local/private-sync-first persistence.

### Context
The repository historically supported IndexedDB/localStorage/browser-vault/private-sync paths. The current product requires one enforceable cross-session/cross-device source of truth.

### Options Considered
Keep local-first canonical; use hybrid feature-specific storage; make Supabase/Storage canonical with only temporary RAM-only unsynchronized local turns.

### Decision
Supabase PostgreSQL is canonical for structured ordinary account content and private Supabase Storage for user/artifact bodies. IndexedDB/localStorage/browser vault/PC vault/Cache Storage/OPFS cannot be persistent ordinary-content authorities. OPFS is model-only; Incognito is RAM-only.

### Reasoning
One persistent authority reduces conflicts, duplicate state, cross-device inconsistency and security/search/organization complexity.

### Trade-offs and Consequences
Offline local inference can temporarily continue while Supabase is unavailable, but unsynchronized turns are RAM-only and may be lost if the browser closes before sync. Product/privacy copy must stop claiming ordinary chats remain only on-device.

### Alternatives Rejected
Persistent local chat outbox and automatic legacy upload are rejected because no production legacy local dataset needs migration and they reintroduce the authority being removed.

## Gemini 3.1 Flash-Lite is the pinned online model

### Date
2026-09-08

### Status
Accepted.

### Context
OCADE requires one predictable online model identity and must avoid browser-visible provider keys or silent model drift.

### Options Considered
Provider `latest`; automatic model family switching; one API key; weighted rotation; three prioritized health-failover keys.

### Decision
Use Gemini 3.1 Flash-Lite behind one server-side `OcadeIntelligence` boundary with exactly three optional secret slots: primary, secondary and tertiary. Use primary-first pre-output health failover only.

### Reasoning
Pinned identity improves behavior/test reproducibility; three server-only slots provide operational redundancy without creating multiple model authorities.

### Trade-offs and Consequences
Provider-wide/project-wide quota does not justify rotating keys to evade quota. Another key is never attempted after meaningful output begins. Changing the model requires an explicit owner decision and corresponding tests/docs.

### Alternatives Rejected
Weighted balancing and browser/database-readable keys are rejected for complexity, security and quota-policy reasons.

## Offline Intelligence installs once and is reused

### Date
2026-09-08

### Status
Accepted.

### Context
First-run local intelligence is valuable but repeated large downloads destroy user experience and cost.

### Decision
Begin background model preparation on first browser/device visit when supported, including the landing page. Use the existing content-addressed OPFS vault, verify/reuse chunks, resume interruption and repair only missing/corrupt content. Normal revisit, sign-in/out, account deletion, service-worker/application deployment and compatible upgrades must not trigger full reinstall/redownload. Only explicit Remove Offline Intelligence deletes model content; deliberate removal suppresses automatic reinstall until explicit Install.

### Reasoning
This preserves local availability while making installation a device-level infrastructure event rather than a session/account event.

### Trade-offs and Consequences
OPFS model data survives account deletion by design. A small device-local non-content suppression flag is required after deliberate removal.

## Cowork Normal and Jarvis share one runtime

### Date
2026-09-08

### Status
Accepted.

### Context
OCADE needs a practical professional Cowork surface and an immersive voice/autonomy experience without duplicating agents, tasks, permissions or usage.

### Decision
Normal Cowork and Jarvis are two presentations/controllers over one task/agent/permission/usage/execution/receipt runtime. Jarvis owns only presentation/audio-reactive behavior and contextual observation panels.

### Reasoning
One runtime keeps task history, permissions, usage accounting and recovery identical while allowing a distinctive Jarvis experience.

### Trade-offs and Consequences
Jarvis rendering must be lazy, reduced-motion-aware and unable to become a dependency of task correctness. Switching modes never creates a new mission.

## OCADE uses Claude as primary structural UI benchmark

### Date
2026-09-08

### Status
Accepted.

### Context
The current product UI is functional but too dashboard-like and inconsistent with the desired premium workspace experience.

### Decision
Use Claude as the primary benchmark for information architecture, interaction economy, sparse shell/composer/workspace layouts and progressive disclosure; use ChatGPT as a secondary benchmark for approachable chat/composer/multimodal ergonomics and OpenClaw as a secondary benchmark for transparent autonomy/computer-use state. Target approximately 95% alignment in useful structure/clarity while independently implementing OCADE branding, components, copy and assets.

### Reasoning
These references provide familiar high-quality interaction models while OCADE keeps its own identity and implementation.

### Trade-offs and Consequences
Do not copy proprietary source/assets/exact text/icons or pixel-for-pixel trade dress. The old More dashboard and excessive visible controls are removed/consolidated.

## One canonical authority per subsystem and maximum useful donor reuse

### Date
2026-09-08

### Status
Accepted.

### Context
OCADE contains a 2,126-file donor plus several historical generations of its own implementation.

### Decision
Re-evaluate every donor family after architecture stabilization. Directly reuse donor code when provenance-safe, dependency-closed, compatible and stronger; otherwise adapt/behaviorally port into OCADE's existing authority. Reject duplicate donor servers/providers/routers/stores/task managers/telemetry/terminal UI.

### Reasoning
The goal is maximum useful behavior, especially Chat/Cowork/Code/coding-agent/Git/LSP/tools/permissions/recovery, without creating a second product inside OCADE.

### Trade-offs and Consequences
A high donor-file usage count is not a success metric. Some donor files can remain rejected even when their behavior inspires an OCADE implementation.

## Windows automation uses one RemoteExecutor

### Date
2026-09-08

### Status
Accepted.

### Context
Windows control spans PyWin32/UIA, Win32/native/Rust, vision and PyAutoGUI/coordinate approaches.

### Decision
Consolidate them behind one `RemoteExecutor`. Prefer semantic UIA/Win32/application APIs first, native/system APIs where appropriate, vision next and PyAutoGUI/coordinates only as guarded fallback. Re-observe every meaningful postcondition.

### Reasoning
Semantic automation is more reliable and verifiable than blind coordinates, while fallbacks preserve coverage.

### Trade-offs and Consequences
A click/command being issued is never completion evidence. Protected inputs, permission gates, pairing/origin validation and emergency stop remain mandatory.

## Payments and Admin grants are implemented last

### Date
2026-09-08

### Status
Accepted.

### Context
OCADE must not take money before the rest of the mandatory product is reliable and commercial state must not be controlled by browser redirects or editable profile fields.

### Decision
Complete payments, renewals, upgrades/downgrades, cancellation, refunds, disputes/chargebacks and Admin entitlement grants as the last major implementation phase. Server-created checkout terms, signed provider evidence and one idempotent state-application authority control paid entitlements. Manual Free/Pro/Max/custom grants are separate audited entitlements tied to immutable Auth user IDs.

### Reasoning
This isolates financial risk until product/security/data foundations are stable and keeps payment history separate from entitlement-support actions.

### Trade-offs and Consequences
Live charging stays disabled until provider/tax/legal/refund/reconciliation/rollback gates genuinely pass. Admin grants never fabricate provider payments.

## `PLAN.md` and `CLAUDE.md` are the only master implementation/agent authorities

### Date
2026-09-08

### Status
Accepted; documentation cleanup decision.

### Context
The repository accumulated `PLAN.md`, mission docs, kickoff docs, payment addenda and `AGENTS.md`/Claude instructions that could compete for authority.

### Decision
Root `PLAN.md` is the sole implementation plan. Root `CLAUDE.md` is the sole AI-agent handbook. Canonical role-specific docs live under `docs/` as PRD, APP_FLOW, DESIGN, ARCHITECTURE, RULES, MEMORY, DECISIONS and TESTING. Remove `AGENTS.md` and the superseded `docs/mission/*` instruction bundle after unique requirements are merged.

### Reasoning
A single authority hierarchy reduces contradictory instructions and wasted context.

### Trade-offs and Consequences
Historical evidence/audit/legal/provenance documents may remain as supporting records but cannot override newer canonical decisions.