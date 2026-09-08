# Product Requirements Document

## Product Overview

OCADE by CARCC CADANE is a browser-first AI workspace that unifies three primary ways of working with intelligence: Chat for conversation and research, Cowork for delegated work and autonomous browser/computer action, and Code for repository-aware software engineering. Projects, Tasks, Artifacts, Search, Customize, Settings, organizations, administration, notifications, Offline Intelligence, online intelligence, and permissioned automation support those three primary surfaces rather than competing with them.

The product identity is **OCADE BY CARCC CADANE** with the tagline **Command the Next Era.** Public identity claims must derive from `src/config/company-facts.ts`; this document defines product behavior, not corporate/legal facts.

The product should feel immediately understandable to someone familiar with Claude, ChatGPT, or modern agent workspaces, while remaining independently implemented and unmistakably OCADE. Claude is the primary reference for information architecture, progressive disclosure, Cowork and Code workflow clarity; ChatGPT is a reference for universal chat discoverability, composer polish, file/media interactions and responsive behavior; OpenClaw is a reference for transparent agent/computer-use state, autonomy controls, observation and recovery. These are behavioral references, not sources for proprietary assets, source code, exact copy, or pixel-for-pixel trade dress.

## Target Users

OCADE is intended for a broad consumer audience while being especially strong for developers, founders, professionals, students, operators, analysts, creators and businesses that want one place to ask questions, create outputs, manage projects, automate work and perform coding or computer tasks. The product should remain usable by non-technical users without hiding advanced capability from technical users.

Organization and administration capabilities additionally serve teams, owners, administrators and support operators who need shared workspaces, seats, policies, auditability, controlled support access, usage visibility and commercial management.

## Problem Statement

Users currently split work across separate chat assistants, coding agents, automation tools, browser-control utilities, project stores, schedulers, file systems and knowledge tools. That fragmentation creates repeated context setup, inconsistent permissions, duplicated data, unclear usage accounting, disconnected task history and a poor transition between asking, planning and actually doing work.

OCADE must solve that by using one coherent account, one canonical data model, one intelligence boundary, one commercial usage authority, one task/receipt authority and one permission system across Chat, Cowork and Code. The user should be able to move from a conversation to a project, delegated task, artifact or code session without re-entering context or encountering competing implementations.

## Goals

OCADE must provide a complete production-grade Chat, Cowork and Code experience that is fast, coherent, secure, recoverable and usable across supported web/PWA/mobile environments. Persistent ordinary user data must be account-backed through Supabase rather than fragmented across browser-local stores. Offline Intelligence must install in the background once, survive normal revisits and application updates, and never re-download unnecessarily. Online intelligence must use the owner-selected Gemini 3.1 Flash-Lite model through one secure server boundary with exactly three optional key slots and one logical usage permit per request.

Cowork must perform real work rather than simulate progress. Normal Cowork provides a restrained work dashboard, while Jarvis Cowork provides an immersive voice/autonomy presentation over the exact same runtime, task, permission, usage and receipt authorities. Code must be a real coding agent with repository intake, editing, search, diagnostics, Git, terminal, LSP, preview, browser verification and reviewable changes.

The product must reach production readiness with zero known reproducible repository-controlled defects at the final gate, every shipped control wired to a real authority, strong security/RLS boundaries, tested recovery paths, production-grade performance, complete lifecycle/error states and a controlled deployment/rollback process.

## Non-Goals

This release does not create a separate customer-facing desktop product. A Windows control host/helper may exist only as supporting infrastructure for Cowork and Code when operating-system access is required. The browser product must not pretend that unsupported native capabilities are available.

The product does not use IndexedDB, localStorage, browser vaults, PC vaults, Cache Storage, OPFS or service-worker caches as persistent authorities for ordinary chats, projects, files, tasks, artifacts, memory, billing, organization content or notifications. OPFS is reserved for Offline Intelligence model binaries/chunks and model-owned metadata. A small amount of non-content device/runtime state is allowed only where the implementation plan explicitly permits it.

The product does not create duplicate routers, stores, agent loops, model installers, task managers, usage authorities, payment stacks, entitlement systems, notification systems, browser bridges, native-control engines or design systems. When multiple historical implementations exist, useful behavior is migrated into the chosen canonical authority and the duplicate is removed after callers are rewired.

The release does not display or advertise connectors, payment delivery, push delivery, native control or platform support that has not been genuinely configured and proven. It does not fabricate uptime, certification, security-review, payment, refund, task-completion or agent-success claims.

## Core Features

### Chat

Chat is the signed-in home and the default OCADE experience. It must support new/open/rename/archive/trash/restore/permanent-delete/export/search, streaming, stop, retry, regenerate, branching, side conversations, attachments, private files, citations, web retrieval, tool calls, project/account memory, compaction, sharing/revocation, Incognito, cross-session continuity and truthful failure/recovery states. Persistent Chat history is Supabase-backed; Incognito remains memory-only.

### Cowork

Cowork delegates outcome-oriented work to OCADE. It must plan, request meaningful approvals, execute tools, browser actions and supported Windows actions, record receipts, re-observe postconditions, recover from disconnects, and expose Pause, Take over, Stop and emergency stop. A click, command or API call is not considered successful until the intended postcondition is observed.

Normal Cowork and Jarvis Cowork are two presentations over one runtime. Normal Cowork uses a minimal work-oriented interface. Jarvis uses the OCADE liquid-glass network orb, voice input/output and live autonomous-control state while sharing the same task history, permissions, memory, usage and receipts.

### Code

Code is a production coding-agent workspace. It must support real repository intake, project linkage, file tree, editing, search, symbols, diagnostics, exact patches, diffs, review, conflicts, undo, Git status/diff/branch/worktree/commit/push/PR where authorized, CI status, permissioned terminal execution, LSP, development server, preview, browser verification, parallel sessions, subagents, durable outputs and recovery. Manual file editing remains available when AI usage is exhausted.

### Projects

Projects are the shared context container for chats, files, repositories, tasks, artifacts, memory, permissions, Code sessions and activity. They must support creation, opening, editing, archive, export and deletion with clean relationships rather than duplicated feature-specific copies.

### Tasks

Tasks unify foreground missions, scheduled work, automations, monitors, action-required notifications, inbox work, run history and Dispatch-style remote work. Scheduling must be timezone/DST-safe and must truthfully state when a browser or local Windows host is required.

### Artifacts

Artifacts are durable outputs produced or managed by OCADE, including documents, reports, PDFs, presentations, spreadsheets, code, images and structured data. Artifacts require versions, provenance, integrity, project/conversation/task/run linkage, preview, editing, restore, export and deletion.

### Search

Search provides authorized account/project search with stable cursor pagination and safe snippets. Cmd/Ctrl+K provides global command/search access. In-memory search indexes may accelerate the current open session but cannot become a persistent content authority.

### Customize

Customize unifies Skills, Connectors and Plugins with Discover/Yours-style views. Only genuinely configured or installable capabilities should be visible. Installed capabilities must obey identity, usage, permission and tenant boundaries.

### Settings

Settings owns Models, Devices, Permissions, Connections, Intelligence, Usage, Billing, Appearance, Voice, Notifications, Privacy, Security, Sessions, Data, Support and account deletion. Advanced or infrequent controls belong here rather than cluttering primary work surfaces.

### Intelligence

Automatic, Online and Local-only are the customer-facing intelligence modes. Normal product UI should say OCADE Intelligence or Offline Intelligence, not expose raw donor/vendor model names. Gemini 3.1 Flash-Lite is the pinned production online model unless the owner explicitly changes it. Offline Intelligence uses the verified local model path and must never generate cloud-provider network traffic in Local-only mode.

### Offline Intelligence

Offline Intelligence preparation begins automatically in the background on first browser/device visit, including the landing page when capability allows. Installation must be content-addressed, resumable and integrity-checked. Once verified, revisits, sign-in/sign-out, account deletion, site deployment, service-worker updates and compatible application upgrades must not trigger a full re-download. Only explicit Remove Offline Intelligence deletes the model; after deliberate removal, automatic reinstallation remains suppressed until the user explicitly chooses Install Offline Intelligence.

### Organizations and Admin

Organizations provide memberships, invitations, roles, groups, seats, policies, settings, usage/billing overview and audit history under strict tenant isolation. Platform administration provides narrowly scoped operational abilities with recent MFA/AAL2 for sensitive actions. Support access to customer content, if enabled, must be time-bound, read-only, case/account scoped, reasoned and immutably audited rather than general raw-database access.

### Payments and Grants

Payments, refunds, disputes, chargebacks and Admin grants are mandatory but are implemented last, after the rest of the product architecture and reliability work is complete. Only authoritative server/provider evidence can change paid access. Redirect URLs, browser state, editable profile text or fake payment records can never grant entitlement. Manual Free/Pro/Max/custom access uses an audited admin-grant authority tied to immutable Auth user IDs.

## User Flows

The canonical user journeys are specified in `docs/APP_FLOW.md`. The product-level requirements are: first-time visitors see the landing page; returning authenticated visitors go directly to OCADE Chat; returning previously-seen signed-out visitors go to Sign in; successful registration/sign-in returns directly to Chat without an onboarding wizard; deep links preserve their intended authorized destination; and logout returns to Sign in.

The core working journeys are Chat conversation → Project/Artifact/Task continuation, Cowork mission → approvals/actions/receipts → durable result, Code repository → change/test/review → durable result, and account/organization administration → secure server-authoritative state changes.

## Future Features

No optional future feature is authorized for implementation before the mandatory production-completion plan is finished. The final plan intentionally reserves future suggestions until after the verified production release. This section therefore remains intentionally empty during the current mission.

## Technical Constraints

The implementation constraints are defined in `PLAN.md`, `docs/ARCHITECTURE.md` and `docs/RULES.md`. The most important product constraints are: Supabase is the canonical persistent ordinary-data authority; private Supabase Storage owns customer files/artifact bodies; OPFS is model-only; Gemini 3.1 Flash-Lite is server-side only with exactly three optional secret slots; Local-only performs no provider network activity; one commercial permit follows one logical AI request through retries/tools/subagents/failover; the verified local model is not re-downloaded unnecessarily; and all side-effectful automation must pass through the shared permission/receipt system.

## Success Metrics

The primary release metrics are product-quality metrics because the current mission is production completion rather than growth experimentation. The exact tested release must have zero known reproducible repository-controlled defects, no applicable missing requirement records, no duplicate canonical authorities, no dead customer-facing controls, no unexplained browser console/network errors in required journeys, and a remote/deployed SHA matching the verified tree.

Performance must meet the final budgets in `PLAN.md`, including LCP below 2.5 seconds, CLS below 0.1, TBT below 200 ms and meaningful JavaScript/CSS headroom. Growing feeds must use bounded pagination; query plans and indexes must be evidence-driven; heavy modules must be lazy-loaded; and production pages must not regress as user/data volume increases.

Commercial success metrics such as conversion, retention or revenue can be added only when the owner defines measurable targets and analytics/consent are genuinely configured. They are not invented here.

## Acceptance Criteria

OCADE is accepted only when every mandatory requirement in `PLAN.md` is implemented, reachable and verified according to `docs/TESTING.md`; the user journeys in `docs/APP_FLOW.md` work without disconnected states; the final UI follows `docs/DESIGN.md`; the implemented system matches `docs/ARCHITECTURE.md`; project-specific constraints in `docs/RULES.md` are satisfied; persistent data and permissions are server-enforced; Offline Intelligence passes no-redownload/removal/reinstall proofs; Gemini and commercial usage pass concurrency/failover/no-double-count tests; Chat, both Cowork modes and Code complete real end-to-end work; production lifecycle/error/legal surfaces are present where applicable; payment/refund/admin-grant behavior passes its final sandbox/reconciliation gates; and the exact verified commit is merged, deployed, smoke-tested and recoverable through rollback.
