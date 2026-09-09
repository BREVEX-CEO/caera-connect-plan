# CLAUDE.md

## Purpose

This is the canonical AI coding-agent entry point for OCADE. The repository intentionally does **not** use `AGENTS.md`; do not recreate it unless the owner explicitly changes that decision. Detailed product, technical, flow, design, architecture, schema, rules, testing and implementation requirements live in the documents linked below. Read them instead of duplicating their contents into new instruction files.

## Project

- Product: **OCADE BY CARCC CADANE**.
- Tagline: **Command the Next Era.**
- Repository: `BREVEX-CEO/caera-connect-plan`.
- Product shape: one browser-first AI workspace centered on **Chat, Cowork and Code** with Projects, Tasks, Artifacts, Search, Customize, Settings, organizations/Admin, capabilities, Offline Intelligence and online intelligence.
- Current production-completion implementation authority: root `PLAN.md`.

## Read Order Before Substantial Work

1. `CLAUDE.md` — working rules and documentation map.
2. `docs/PRD.md` — what the product must be and who it serves.
3. `docs/TRD.md` — implementation-level technical requirements and non-functional constraints.
4. `PLAN.md` — exact ordered production-completion implementation plan and final acceptance matrix.
5. `docs/APP_FLOW.md` — routes, redirects, clicks, journeys and UX states.
6. `docs/UI UX Brief.md` — concise product-experience, information-architecture and surface-level UX intent.
7. `docs/DESIGN.md` — detailed visual/interaction system and reference-app interpretation.
8. `docs/ARCHITECTURE.md` — current/target stack, system boundaries and deployment architecture.
9. `docs/Backend Schema.md` — data contract, current Supabase authorities, relationships, RLS/Storage, pagination/indexing and migration rules.
10. `docs/RULES.md` — project-specific must/never engineering rules.
11. `docs/TESTING.md` — test stack, performance killers, production pages/states and definition of done.
12. `docs/MEMORY.md` — current development state, known problems and exact handoff context.
13. `docs/DECISIONS.md` — durable decisions and superseded alternatives.

Supporting evidence/provenance/legal/runbooks elsewhere in `docs/`, `release/`, `imports/`, `supabase/` and `src/primary-logic/` remain valid when they do not conflict with the canonical documents above.

## Authority and Duplication Rules

`PLAN.md` is the only implementation plan. Do not create `PLAN-v2.md`, `codexplan.md`, another completion plan or a second requirements bundle. The previous `docs/mission/*` instruction set is superseded by the canonical documents above.

The documentation is intentionally orthogonal: PRD owns product requirements; TRD owns technical requirements; APP_FLOW owns navigation/journeys; UI UX Brief owns concise experience intent; DESIGN owns detailed UI/UX design-system rules; ARCHITECTURE owns system structure/boundaries; Backend Schema owns the persistent data contract; RULES owns project-specific engineering constraints; TESTING owns verification; MEMORY owns current state; DECISIONS owns why major choices exist. Cross-reference rather than copying entire specifications between files.

For code overlaps, inspect before creating and assign one disposition: KEEP, FIX, COMPLETE, MERGE, REPLACE or REMOVE. Reuse/migrate the canonical authority. Never create a duplicate router, store, database client layer, auth stack, task manager, agent loop, tool registry, model installer, usage/entitlement authority, payment stack, notification stack, browser bridge, native-control engine or design system merely to avoid understanding the existing one.

## Repository and Current Stack

Inspect the live repository before assuming paths are unchanged. The audited implementation plan baseline uses React 19, TypeScript, TanStack Start/Router, Vite 8, Tailwind 4, Supabase, Cloudflare/Wrangler, Vitest, browser E2E tooling, WebLLM/Wllama local runtimes, Capacitor mobile projects, a Cowork extension and Windows/native control source. The repository has extensive scripts and generated evidence; use the actual current `package.json` as command authority.

Target ownership converges incrementally toward `src/app`, `src/features`, `src/core`, `src/platform`, `src/data` and `src/shared`. Do not mass-move the tree cosmetically. Move dependency-closed families only when the owning `PLAN.md` phase calls for it and migrate every caller.

## Development Commands

Use the exact current scripts from `package.json`. Common commands include:

```bash
npm ci
npm run format:check
npm run typecheck
npm run lint
npm test
npm run test:isolation
npm run build
npm run build:stable
npm run performance:budget
npm run browser-safety:check
npm run content-storage:check
npm run controls:check
npm run supabase:types-check
npm run integration:check
npm run mission:check
npm run audit:journey
npm run audit:routes:prod
npm run audit:a11y-runtime
npm run audit:responsive
npm run audit:web-vitals
npm run extension:e2e
npm run windows:prove
npm run model:install-proof
npm run launch:prove
npm run deploy:check
```

Do not blindly run every expensive command after every edit. Run focused tests/checks for the changed authority during phases, then the exact phase checkpoint and final matrix required by `PLAN.md`.

## Product Decisions That Must Not Drift

Persistent ordinary user/account content is Supabase-authoritative. Do not reintroduce IndexedDB/localStorage/browser-vault persistent chat/project/task/artifact/memory data. Private Supabase Storage owns durable customer file/artifact bodies. OPFS is reserved for Offline Intelligence model data and explicitly allowed model metadata/non-content device state.

First unseen root visit shows the landing page; returning authenticated root goes directly to Chat; returning previously-seen signed-out root goes to Sign in. Successful auth goes to the intended deep link or Chat. There is no onboarding wizard and no separate signed-in dashboard.

Online intelligence is pinned to **Gemini 3.1 Flash-Lite** through exactly three optional server-side secret slots. The browser never receives the keys. Use primary-first pre-output health failover only; do not rotate keys to evade provider/project quota. Local-only must create zero provider network traffic. One logical request retains one commercial permit through retry/tool/subagent/key failover/eligible local fallback.

Offline Intelligence starts preparing in the background on first visit where supported. Before fetching, inspect existing model manifest/chunks/hashes. Resume/repair rather than re-download. Valid model content survives revisit, login/logout, account deletion, service-worker updates and application deployment. Only explicit Remove Offline Intelligence deletes it. Deliberate removal suppresses auto-reinstall until the user explicitly chooses Install.

Cowork has **Normal** and **Jarvis** presentations over one runtime. Jarvis is an immersive voice/liquid-glass orb controller/view, not a separate agent/task/permission/usage system. Browser/Windows actions must re-observe postconditions. STOP/takeover/permission state is authoritative.

There is no separate customer-facing desktop product in this release. Native/Windows host code exists only as supporting infrastructure for approved Cowork/Code OS control.

Payments, subscriptions, refunds, disputes, chargebacks and audited Admin grants are the **last implementation phase**. Browser redirects/local state/client amounts/profile text never grant entitlement. Manual grants are explicit audited entitlements tied to immutable Auth user IDs, never fake payments.

## UI/UX Rules

Read `docs/UI UX Brief.md` for the intended experience and `docs/DESIGN.md` for the detailed implementation/design-system rules before modifying product UI. Claude is the primary behavioral/information-architecture reference; ChatGPT and OpenClaw are secondary references for chat polish and agent/computer-use transparency. Use reference products to understand interaction quality and progressive disclosure, not to copy proprietary assets/source/copy or reproduce pixel-for-pixel trade dress.

OCADE remains independently branded. Keep the ordinary app minimal and restrained: narrow rail, focused workspace, one obvious primary action, secondary actions contextual, no old More dashboard, no wall of buttons, no fake controls. Jarvis may be visually expressive, but its rendering cannot become a dependency of Cowork logic and must respect performance/reduced motion.

## Data, API and Security Rules

Read `docs/ARCHITECTURE.md`, `docs/Backend Schema.md` and `docs/RULES.md`. Derive authorization from trusted session/server context, not client-submitted user/org IDs. Keep RLS/Storage policies and generated types synchronized with migrations. Source/live migrations must be reconciled by schema effect before production application; never replay by filename blindly.

Never expose/commit secrets. Never add server secrets with `VITE_`/`PUBLIC_`. Never log Gemini keys, service-role secrets, session tokens, raw protected inputs, payment secrets or unnecessary user content. Dangerous Admin/billing/support-content operations require server-side authorization and recent AAL2 where specified.

Protected inputs such as passwords, OTPs, CAPTCHAs, CVV/PIN and recovery codes remain user-controlled. Automation may stop/hand control to the user rather than read/store/infer/type protected values.

## Donor Rules

The verified `OCADE_PRIMARY_LOGIC` donor contains 2,126 files. Maximize useful donor behavior, especially Chat query/session/rewind/resume/context, Cowork coordinator/recovery, Code/coding-agent logic, tasks, files, Git, LSP, shell safety, permissions, context compaction, memory, tools, agents/subagents, browser/computer control, command UX, progress and recovery.

Direct reuse is acceptable only when provenance-safe, dependency-closed, compatible and stronger than current OCADE. Otherwise adapt/behaviorally port into the existing canonical authority. Do not ship donor duplicate servers/providers/stores/routers/task managers/telemetry/terminal UI merely to increase donor file usage.

## Performance Rules

Treat performance as production correctness. Explicitly prevent the five supplied silent speed killers: N+1 query loops, missing evidence-backed indexes, unbounded list loading, unoptimized media and giant eager JavaScript bundles. Growing feeds are bounded/paginated; heavy Code/PDF/Jarvis/model/native/media features are lazy-loaded; startup requests are batched where practical; resource leaks/orphan workers/processes are fixed. Meet the budgets in `PLAN.md` with headroom.

## Testing and Error Standard

Read `docs/TESTING.md`. Fix root causes. Do not hide failures with blanket ignores, skipped shipped behavior, swallowed exceptions, broad `any`, fake success, fake availability or hand-edited generated evidence.

For UI/runtime work, use real browser automation/control and inspect visible state, console, network, storage and postconditions. For browser/native actions, prove the postcondition rather than trusting the issued action. For Supabase, test adversarial cross-user/org roles. For payment/model/provider paths, test failure/replay/duplicate/concurrency boundaries as defined by the plan.

Final reachable tree must have zero known reproducible repository-controlled defects, zero applicable missing requirements, zero known duplicate canonical authorities and no uninvestigated browser/network/runtime failure in required journeys.

## Documentation Cleanup Rule

Supporting audit/readiness, acceptance, legal, security/breach, deployment, model/CDN, Windows/browser, donor provenance/licence and release-evidence Markdown files may contain historical wording but are not automatically junk. Delete a supporting document only after proving its unique value is preserved, no script/test/workflow/package command references it, and it is not needed for legal, provenance, audit, incident, migration, release or operational recovery. The former standalone ADR decisions are already consolidated in `docs/DECISIONS.md`; new durable decisions belong there rather than in a recreated ADR folder. A smaller file count is not worth breaking evidence or losing history.

## Git and Release Rules

Preserve unknown work. Never reset/clean destructively, force-push or rewrite published Lovable-connected history. For the implementation mission, fetch latest `origin/main`, create one isolated completion branch, keep `main` untouched while incomplete, use recoverable ignored/external snapshots if necessary, and follow `PLAN.md` for checkpoints/final commit/reconciliation.

Do not deploy incomplete implementation. At the final gate, verify the exact reconciled tree, create the final product commit, fetch/reconcile/reverify if `main` moved, fast-forward `main` without force and verify the remote tree. Only then perform controlled Supabase/Edge Function/Cloudflare deployment with backup/restore/rollback readiness and production smoke.

## Memory and Decisions

Update `docs/MEMORY.md` after meaningful sessions or changed next action. Update `docs/DECISIONS.md` when a meaningful architecture/product decision changes. Do not turn either file into a transcript or copy the entire plan into them.

## Completion Standard

Do not voluntarily conclude the production-completion mission while a reachable mandatory `PLAN.md` requirement remains. A phase, unit suite or build passing alone is not mission completion. Continue through implementation, focused proof, integration, runtime/browser proof, final reachability, exhaustive verification, safe main integration and controlled deployment. Optional future improvements remain untouched until the mandatory product is complete.
