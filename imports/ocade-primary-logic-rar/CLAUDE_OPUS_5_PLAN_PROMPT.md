# Claude Opus 5 — OCADE Primary Logic Convergence — PLAN MODE

## Context

Repository: `BREVEX-CEO/caera-connect-plan`

Planning branch: `import/ocade-primary-logic-rar-20260826`

The owner will upload `OCADE_PRIMARY_LOGIC.rar` to `.incoming/OCADE_PRIMARY_LOGIC.rar`.

Expected SHA-256:

`13f336cedd2ef983a70f4220f625437c06dde8eedb8a49a164f0d351822312ee`

Read `imports/ocade-primary-logic-rar/ARCHIVE_SCAN.md` before evaluating the archive.

The owner states that the RAR is authorized OCADE source supplied for this project. Treat that statement as owner-provided context, not as a reason to skip technical, security, licensing, dependency, or provenance checks required for a commercial build.

## Objective

Produce the authoritative engineering plan for converging the current OCADE repository and the supplied primary-logic source into ONE production OCADE architecture.

The intended implementation after approval is aggressive convergence, not passive archiving: where the supplied source contains a stronger, more complete, or more maintainable implementation of an OCADE responsibility, plan to replace or adapt the weaker existing implementation; where current OCADE is stronger or required by its browser/local-first architecture, keep it; where both duplicate the same responsibility, choose one authority and plan deletion of the superseded implementation after migration and proof.

Do not implement in this session. Do not merge. Do not deploy. Return the plan only.

## Existing product boundaries that must survive unless repository evidence proves a better compatible implementation

- normal OCADE Chat remains local-first; no public hosted-model fallback
- browser WebGPU/WASM inference remains a supported primary path
- local/native inference may remain behind the existing desktop/local boundary
- Supabase remains the current auth/private-sync/data service unless evidence proves a migration is required
- Cloudflare remains the public/deployment edge
- the extension remains the browser-control boundary where appropriate
- filesystem, shell, PTY, PowerShell, process and whole-computer mutation stay behind a trusted local/native boundary, never directly in browser/Cloudflare code
- STOP / PAUSE / TAKE OVER, protected-input refusal, permissions, audit/evidence and honest-failure behavior must not be weakened
- current verified Cloudflare, OAuth, legal and public URLs must remain unchanged unless a concrete blocker makes a change mandatory

## Required investigation

Inspect the complete current repository and the complete extracted RAR. Establish what each actually does, not what old README/audit files claim.

For the RAR, verify the hash, extract it into an isolated staging directory, inventory the whole tree, inspect package/runtime assumptions, resolve/import graph, missing dependencies, broken internal imports, duplicate implementations, security-sensitive file/process/network paths, model/provider stubs, task/agent/tool systems, UI/web surfaces, permissions, sessions/memory/context management, background work, browser/computer control, plugins/skills, Git/IDE/LSP systems, and anything that cannot run in OCADE's current runtime boundaries.

For the current repository, trace the active routes and real call graph for Chat, model routing, agent loop, tool execution, tasks/automations, browser control, computer control/Cowork, files, memory, search, projects, artifacts/outputs, auth, sync, offline/PWA, extension, desktop, mobile, Supabase and Cloudflare.

## Decision matrix

For every major responsibility choose exactly one of:

- KEEP CURRENT
- REPLACE WITH PRIMARY SOURCE
- ADAPT / MERGE INTO ONE AUTHORITY
- MOVE TO EXTENSION
- MOVE TO LOCAL/NATIVE COMPANION
- MOVE TO SHARED CORE
- QUARANTINE / DO NOT SHIP
- DELETE AFTER REPLACEMENT
- DEFER

For each REPLACE or ADAPT decision name the current files, candidate primary-source files, required adapters, migration risk, tests needed, and what becomes deletable afterward.

Do not preserve two execution engines, two routers, two task authorities, two model authorities, two memory authorities, or duplicate customer pages merely because both exist.

## Highest-priority product outcome

The finished architecture should make normal `/ocade` Chat and `/ocade/work` Cowork two presentations of the same OCADE intelligence/action spine rather than separate products.

Target conceptual flow:

User → OCADE session/composer → prompt/context assembly → deterministic fast path when applicable → one local model-routing authority → tool protocol/contract → one agent loop → permission/safety boundary → browser/extension/native executor → re-observation/verification → evidence/audit → shared session/task state.

Evaluate whether the supplied primary source improves any stage of that flow and use it to the maximum technically justified extent without breaking OCADE's runtime/security boundaries.

## Cleanup requirements for the later implementation

Plan removal/consolidation of:

- duplicated pages/routes
- duplicated settings
- duplicated task/automation systems
- duplicated model-routing layers
- duplicate tool/capability registries that are truly competing rather than descriptive/governance layers
- stale internal-only features
- broken/unreachable code
- obsolete experimental architecture
- dead buttons and misleading setup claims
- normal-user exposure of low-level model filenames/hashes/storage internals
- excessive instructions and technical configuration

Do not blindly global-replace legacy/internal terminology. Classify what the code does and either rename the OCADE concept, remove obsolete behavior, or independently replace the implementation.

## UI phase — plan only

Functional convergence comes first. UI polish starts only after the architecture is stable.

The owner will attach three visual references for the implementation phase:

- ECHOID — authentication/login direction
- Operational AI Infrastructure — overall OCADE visual language
- Terranova — selective liquid/refractive glass and spatial overlays

Cowork/Control should become a minimal state-driven OCADE orb experience with clear PAUSE / TAKE OVER / STOP, not a dense control dashboard. 3D/motion must be performance-tiered and lazy-loaded; customer simplicity and responsiveness outrank decoration.

## Supabase

Production Supabase project ref is `sazhgaisyhkdbrooycdv`. Treat `ubantxggjducfmwoydim` as stale unless live evidence contradicts the owner's decision. Do not blindly apply migrations: inspect current live schema/state, diff it against the repository migrations, and plan a reversible application of only what is missing.

## Required plan output

Return one structured document with:

1. executive summary in simple language for a zero-coding owner
2. current OCADE architecture and what actually works
3. current broken/incomplete/duplicate surface
4. full RAR architecture and health
5. current-vs-primary-source responsibility comparison
6. exact replacements/adaptations to perform
7. exact final wiring architecture
8. browser vs extension vs native vs Cloudflare/Supabase boundaries
9. routes/pages/settings to consolidate or remove
10. dead/useless/superseded files grouped by SAFE TO DELETE, DELETE AFTER REPLACEMENT, REVIEW, MUST KEEP
11. dependency/import/build repairs needed in the primary source before any part can become authoritative
12. security risks that must be removed rather than ported
13. final simplified customer-facing route architecture
14. later UI-polish map using the three references
15. performance strategy
16. complete verification/test matrix
17. ordered implementation phases from extraction through final merge
18. merge-to-main requirements
19. final recommendation: how much of the supplied primary source should become authoritative, expressed as specific subsystems rather than a vague percentage

Prioritize findings as CRITICAL / HIGH / MEDIUM / LOW.

Do not stop at an audit. The plan must be implementation-ready: another Opus 5 session should be able to execute it autonomously without asking the owner to make coding decisions.

Keep the owner-facing explanation concise and non-technical; place detailed file/path evidence under each decision for the implementation agent.
