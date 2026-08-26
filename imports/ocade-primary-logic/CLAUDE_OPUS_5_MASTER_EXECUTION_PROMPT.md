# OCADE — CLAUDE OPUS 5 MASTER INTEGRATION + PRODUCTION EXECUTION PROMPT

## Mission

Take over the current OCADE production-completion branch and finish the source integration, architecture unification, routing, feature wiring, duplicate removal, Cowork/browser/computer-control repair, UI redesign, performance hardening, testing and production proof.

This is not an audit-only task. Use the loop:

**READ → TRACE → PLAN → CODE → RUN → BREAK → FIX → RETEST → VERIFY → COMMIT**

Repeat until the reachable launch-critical surface is coherent and green. Produce a short execution map first, then continue immediately into implementation. Do not stop after the plan and do not ask the user to edit code manually.

Repository: `BREVEX-CEO/caera-connect-plan`

Working branch: `import/ocade-primary-logic-20260826`

Current production base: `main`

Current source archive: `.incoming/OCADE_PRIMARY_LOGIC.rar`

Verified archive identity:

- SHA-256: `a1ce51f92447ada16a52631a2fdf61ec4d5ff24efa1e078beaa00b6b4741f467`
- Git blob SHA-1: `c3121695459979b5ca77ac14e267488675fba7e4`
- Size: `10,140,038` bytes
- Expected extracted file count: `2,123`
- Expected extracted directory count: `346`
- Expected uncompressed bytes: `33,932,339`

The previous ZIP path is obsolete. Do not use old ZIP hashes, names, counts or instructions.

---

# 0. FIRST ACTIONS — REPOSITORY STATE AND BRANCH RECONCILIATION

Before changing product code:

1. Run `git status`.
2. Run `git branch --show-current`.
3. Run `git log --oneline --decorate -30`.
4. Fetch the latest remote refs.
5. Compare `import/ocade-primary-logic-20260826` against `origin/main`.
6. Preserve all useful committed and uncommitted work.
7. Do not reset, clean, discard or overwrite unknown changes.
8. Reconcile the branch with the latest `main` before deep integration. Prefer a clean merge/rebase strategy that preserves the import work and production changes. Resolve conflicts by tracing current production authorities, not by choosing one side blindly.
9. Re-run the compare after reconciliation and record the resulting base/head SHAs in the final report.

At handoff time the branch had diverged from `main`; therefore do not assume the branch is already current.

Do not merge to `main` at the beginning. All integration and verification happens on the working branch first.

---

# 1. VERIFY AND STAGE THE RAR — DO NOT EXTRACT OVER PRODUCTION

The archive is a source input, not a second application to mount beside OCADE.

1. Verify the RAR SHA-256 exactly matches:
   `a1ce51f92447ada16a52631a2fdf61ec4d5ff24efa1e078beaa00b6b4741f467`
2. Extract it with a trusted RAR-capable tool into a temporary directory outside production `src/`.
3. Verify the extracted file count and approximate inventory against the values above.
4. Inspect the top-level structure before staging.
5. Run:
   `node scripts/import-ocade-primary-logic.mjs <extracted-directory> --replace`
6. Confirm generated:
   - `imports/ocade-primary-logic/source/`
   - `imports/ocade-primary-logic/SOURCE_INVENTORY.json`
   - `imports/ocade-primary-logic/IMPORT_RECEIPT.json`
7. Verify no extracted path escaped the staging boundary.
8. Commit the staged inventory/receipt separately before production integration so the migration remains reviewable.

Never bulk-copy the entire staged source tree into production `src/`.

---

# 2. RIGHTS / PROVENANCE / THIRD-PARTY GATE

Do not infer ownership merely from renamed strings, package names or deleted documentation.

Before reusing a module verbatim:

- inspect any licence/authorization/NOTICE files supplied with the source;
- preserve legally required copyright, attribution, licence and provenance notices;
- identify third-party and open-source dependencies and retain their required notices;
- do not remove required provenance simply to make a source appear independently authored;
- do not treat the absence of `Claude`, `Anthropic`, `@ant`, `tengu`, `sk-ant` or other historical identifiers as proof of origin or ownership.

If the applicable rights allow reuse/modification/rebranding, adapt the module normally while preserving mandatory notices. If a particular module is technically useful but cannot be reused under the applicable rights, implement the required behavior independently in OCADE-native code rather than copying that module.

This gate applies per module; it must not become an excuse to stop the entire engineering run if clean-room implementation can achieve the same product behavior.

---

# 3. BUILD A REAL SOURCE MAP BEFORE PORTING

Read the complete staged source and the complete current OCADE architecture before making replacement decisions.

Classify each staged subsystem as one of:

- `REUSE_AND_ADAPT`
- `CLEAN_ROOM_REIMPLEMENT`
- `LOCAL_COMPANION_ONLY`
- `REFERENCE_ONLY`
- `QUARANTINE`
- `DO_NOT_WIRE`
- `OBSOLETE`

For each major subsystem record:

- source paths;
- current OCADE equivalent paths;
- runtime/environment assumptions;
- missing imports/dependencies;
- security boundary;
- browser/native/server compatibility;
- tests currently covering the behavior;
- migration target;
- final canonical authority;
- old code to remove after migration.

Do not program toward old audit documents when reachable code proves otherwise. Current code + newly executed proof outrank stale docs.

---

# 4. REPAIR THE STAGED DEPENDENCY GRAPH WITHOUT POLLUTING PRODUCTION

The source may contain unresolved internal imports, missing dependencies, obsolete package aliases, differing Zod versions, Node/Bun assumptions or incomplete integrations.

Repair methodically:

1. Generate a list of unresolved internal imports.
2. Separate missing local modules from unavailable private/vendor packages.
3. Do not add questionable private packages merely to make compilation pass.
4. Replace unavailable integrations with OCADE-owned interfaces/adapters where needed.
5. Keep Node/Bun filesystem, process, PTY, shell, PowerShell and native execution out of browser/Cloudflare bundles.
6. Move native capabilities behind the existing trusted desktop/local-companion boundary.
7. Normalize schemas/types to OCADE's current dependency versions instead of downgrading the production application to fit the source.
8. Remove or quarantine web/server routes that expose arbitrary filesystem read/write behavior or secrets.
9. Do not introduce public hosted model-provider inference into normal OCADE Chat.

The goal is not to make the staged source a standalone application. The goal is to migrate useful capabilities into the canonical OCADE architecture.

---

# 5. PRESERVE THESE OCADE AUTHORITIES

Unless a concrete bug is proven and repaired without breaking the external contract, preserve:

- TanStack/React production application shell and canonical product router;
- browser-first/local-first normal Chat;
- browser WebGPU local inference authority;
- browser WASM fallback;
- desktop/local Ollama or local-native bridge where currently supported;
- no public-cloud AI inference fallback for normal OCADE Chat;
- Supabase authentication and Private Sync boundaries;
- current production Supabase project and RLS model;
- Cloudflare deployment/domain/public-route contracts;
- legal/public routes;
- OAuth callback contracts;
- Chrome/Edge extension trust boundary;
- desktop/native permission boundary;
- PWA/offline architecture;
- prelaunch/launch readiness gates;
- STOP/PAUSE/TAKE OVER safety behavior;
- truthful failure and audit/evidence recording.

Do not change Cloudflare/public/OAuth URLs as part of this integration unless technically unavoidable. If an external account-side change is genuinely required, isolate that blocker and continue everything else.

---

# 6. TARGET CANONICAL ARCHITECTURE

Unify the product around one execution path:

**Chat `/ocade` or Cowork `/ocade/work`**
→ one shared session/controller API
→ prompt/context assembly
→ fast/deterministic router where appropriate
→ one local-chat/local-model entry
→ local brain/model router
→ tool protocol
→ tool contract validation
→ agent loop
→ permission boundary
→ executor
→ verification
→ evidence/audit ledger
→ shared mission state surfaced back to Chat/Cowork.

Create or converge on a single shared surface API such as:

`useOcadeSession()`

with behavior equivalent to:

- `messages`
- `send()`
- `mission`
- `toolEvents`
- `permissionRequests`
- `pause()`
- `resume()`
- `takeOver()`
- `stop()`
- `retry()`
- `status`

Do not keep Chat and Cowork as two unrelated AI products. They may differ visually, but they must share the same canonical runtime plumbing.

---

# 7. CHAT — WIRE REAL AGENT/TOOL CAPABILITY INTO NORMAL OCADE

Current normal Chat must not remain isolated from the real tool/agent execution layer.

Tasks:

1. Trace `/ocade` from route → composer → message pipeline → model router → persistence.
2. Trace the existing shared chat components/hooks used elsewhere.
3. Replace giant route-local duplicate chat logic with the shared canonical chat/session system where practical.
4. Wire normal Chat into the agent/tool loop through the same tool contract and permission boundary used by Cowork.
5. Preserve a fast plain-chat path when no tool is needed.
6. Preserve local model inference.
7. Add tool-event rendering and clear execution state without turning Chat into a debugging console.
8. Make STOP actually cancel generation/tool/mission work.
9. Ensure deep links to conversations, search results and projects work.
10. Verify streaming, retry, regenerate, cancel, attachments where actually supported, citations/retrieval, offline behavior and persistence.

Every action-capable Chat request must pass through permissions and verification. No hidden bypass path.

---

# 8. TOOL REGISTRY — ONE EXECUTION AUTHORITY

There are multiple registries/catalogs in the codebase. Collapse execution authority.

- Keep one canonical executable tool registry.
- Other catalogs may remain only as descriptive metadata/governance if genuinely required.
- Migrate callers/tests.
- Delete or archive dead duplicate registries after proof.
- Every executable tool must have:
  - stable ID/name;
  - schema validation;
  - permission classification;
  - execution boundary;
  - cancellation support where applicable;
  - normalized success/error result;
  - verification/evidence behavior;
  - tests.

Do not count a tool as working because it appears in a registry. Exercise representative real paths.

---

# 9. COWORK / CONTROL — REBUILD AS A REAL PRODUCT

Rebuild `/ocade/work` as OCADE's mission/control room, not an engineering dashboard.

Functional requirements:

- same canonical session/agent/tool runtime as Chat;
- browser control through the trusted extension/browser boundary;
- computer control through trusted local/native companion boundary;
- explicit scoped permissions;
- high-impact actions require confirmation according to existing policy;
- PAUSE, TAKE OVER and STOP always visible while acting;
- STOP cancels the active mission/action chain, not just the animation;
- PAUSE freezes at a safe boundary;
- TAKE OVER cleanly hands control back to the user;
- reconnect/navigation does not invent phantom running state;
- failures show truthful plain-language state;
- action history/evidence is inspectable without overwhelming the main view;
- no fake execution/success indicators.

Primary visual structure:

- centered state-driven OCADE orb;
- minimal task/composer area;
- mission/activity panel only when relevant;
- permission/confirmation sheets when required;
- compact evidence/result cards;
- emergency STOP in clear crimson treatment.

Orb states must be driven by real runtime state:

- idle
- listening
- understanding
- thinking
- speaking
- acting
- waiting for approval
- paused
- takeover
- stopped
- error
- offline/local-only
- retrieval/network activity

The orb is a state language, not decorative animation.

---

# 10. BROWSER CONTROL

Trace all browser-control paths: extension pairing, permissions, content scripts, background/service worker, page state, browser executor and Cowork/Chat caller.

Verify:

- per-site permission model;
- extension pairing/reconnect;
- tab selection and navigation;
- reading page state;
- click/type/scroll/select actions;
- protected input restrictions;
- downloads/uploads where actually supported;
- cancellation;
- STOP persistence;
- recovery when a tab closes or navigation changes origin;
- no broad host permission regression if current design intentionally uses per-site opt-in;
- action result verification.

Remove duplicate browser executors only after all callers are migrated.

---

# 11. COMPUTER CONTROL / LOCAL COMPANION

Keep filesystem/shell/process/native control behind trusted local boundaries.

Verify desktop/Tauri/Python/local-host paths for:

- explicit device pairing;
- scoped permissions;
- window/screen observation if supported;
- mouse/keyboard control if supported;
- app/process/file actions only within approved capabilities;
- protected input/credential restrictions;
- cancellation and emergency stop;
- audit/evidence;
- disconnect/reconnect behavior;
- no remote unauthenticated arbitrary file endpoints.

Cloudflare/browser code must never directly gain unrestricted host OS capabilities.

---

# 12. MODEL ROUTING — COLLAPSE DUPLICATION

There must be one public surface entry into model inference and one authoritative local runtime router underneath it.

Consolidate overlapping model-routing layers while preserving:

- Fast mode;
- Thinking mode;
- browser WebGPU;
- browser WASM fallback;
- desktop/local bridge where supported;
- context-window authority;
- model download/storage integrity;
- offline operation after model availability;
- no public hosted inference fallback.

Customer UI should use OCADE-native behavior labels such as:

- Fast
- Thinking
- Local Intelligence

Do not expose raw model filenames, hashes, implementation runtimes or unexplained internal names in normal UI. Truthful underlying model/runtime provenance belongs in Advanced diagnostics.

---

# 13. TASKS / AUTOMATIONS — ONE DURABLE ENGINE

Trace every task/automation implementation and route.

Choose one durable canonical authority, then:

- migrate active callers;
- preserve offline/local caching only where useful;
- unify scheduled tasks and automations into one understandable product surface;
- remove duplicate task stores/engines after migration;
- ensure cancellation, pause, retry, history, failure state and permissions are coherent;
- make tasks created from Chat/Cowork appear in the same canonical system.

Target user-facing route:

`/ocade/tasks`

Use tabs/filters rather than separate duplicate products when possible.

---

# 14. MEMORY / CONTEXT / SEARCH / PROJECTS / OUTPUTS

Unify these as connected product capabilities rather than isolated pages.

Memory:

- one user-visible memory authority;
- editable/deletable where promised;
- clear local/private-sync behavior;
- no hidden duplicate stores affecting responses inconsistently.

Search:

- conversations/messages search;
- local-first indexes where available;
- direct deep links to results;
- clear scope and empty/error states.

Projects:

- project context/files/conversations/outputs share one project identity;
- remove duplicate project/studio/code shells if unfinished or redundant;
- context passed into Chat must be visible/understandable.

Outputs/Studio:

- retain only real artifact/output functionality;
- remove placeholder or duplicate creation surfaces;
- link generated outputs back to conversation/project/task provenance where appropriate.

---

# 15. ROUTE CONSOLIDATION

Target signed-in primary product surfaces:

1. `/ocade` — Chat
2. `/ocade/work` — Cowork / Control
3. `/ocade/tasks` — Tasks & Automations
4. `/ocade/projects` — Projects / Files / Context
5. `/ocade/devices` — Devices / Connections / Extension pairing
6. `/settings` — canonical Settings
7. Search and Outputs may be dedicated routes or integrated trays only if that is cleaner, but there must be one canonical path per capability.

Admin/internal diagnostics remain separate and must not compete with main navigation.

For every retired route:

- trace inbound links;
- add redirect/compatibility route when necessary;
- update navigation;
- update tests;
- test direct URL, refresh, back/forward and deep linking.

Hide or feature-gate unfinished future products rather than occupying prime navigation.

---

# 16. SETTINGS — ONE SYSTEM, FEWER OPTIONS

Collapse duplicate settings routers/stores/panels.

Recommended groups:

- General
- Account & Security
- Appearance
- Chat & Voice
- Privacy & Data
- Devices & Control
- Plan & Billing
- Advanced

Rules:

- every visible control must work and persist;
- remove dead/duplicate controls;
- remove cursor customization if it does not materially affect the real product;
- normal storage UI shows simple usage and Manage Storage, not raw IndexedDB/OPFS internals;
- raw model/runtime/provenance/debug details live under Advanced;
- motion/depth should be presets rather than many technical sliders;
- appearance changes should visibly affect supported orb/environment/accent surfaces.

Suggested motion model:

- Motion: Off / Balanced / Immersive
- Depth: Low / Standard / High

Respect `prefers-reduced-motion` and low-performance devices.

---

# 17. UI / DESIGN SYSTEM

The product should feel simpler than the current build while retaining deeper capability underneath.

## Overall language

- black foundation;
- silver/graphite structural UI;
- restrained gold for confirmation/important intent;
- aubergine for depth/identity accents;
- crimson reserved for danger/STOP/destructive actions;
- premium typography;
- minimal borders;
- strong spacing hierarchy;
- spatial depth only where it helps comprehension;
- no generic dashboard-card overload;
- no movie-title treatment;
- no excessive gradients or glowing everything.

## Login / auth

Use the supplied ECHOID reference only as visual inspiration:

- full-viewport dark cinematic composition;
- minimal OCADE branding/navigation;
- right-aligned auth panel on desktop;
- responsive single-column mobile adaptation;
- minimal copy;
- strong keyboard/focus behavior;
- reduced-motion/static fallback;
- background media failure must not break authentication;
- do not copy reference brand names, proprietary copy or fake invite mechanics.

## Signed-in product

Use an Operational-AI-Infrastructure feel:

- precision black/silver surfaces;
- restrained spatial depth;
- minimal navigation;
- plain language;
- no fake metrics, clients or social proof.

## Liquid/refractive glass

Use Terranova-style refractive/liquid-glass inspiration selectively for overlays, modals and focus surfaces. Do not make every panel expensive glass. Provide performance-safe fallbacks.

## Performance tiers

Tier 1 — cinematic:
- Login
- Cowork
- Voice/orb-focused surfaces

Tier 2 — lightweight spatial:
- Projects
- Search
- Outputs
- Tasks

Tier 3 — precision UI:
- Settings
- Privacy
- Security
- Billing

No heavy WebGL everywhere.

---

# 18. AUTHENTICATION / ACCOUNT SECURITY

Preserve and verify:

- explicit Sign In vs Create Account intent;
- no silent account creation from OTP sign-in paths;
- resend cooldown/rate limit behavior;
- password recovery safety;
- current-password verification for ordinary password changes where required;
- Google OAuth callback behavior;
- session persistence and logout;
- protected route redirects;
- auth error messages that do not leak unnecessary account state;
- mobile auth usability.

Do not replace Supabase auth with source-donor auth systems.

---

# 19. SUPABASE / DATA / RLS

Do not blindly apply every migration.

1. Confirm current production Supabase project reference from existing production configuration.
2. Inspect live schema if the environment permits.
3. Diff required migration state against production.
4. Apply only missing safe changes.
5. Preserve RLS.
6. Verify tenant/user ownership boundaries.
7. Verify sync conflicts and offline behavior.
8. Keep rollback notes for every production schema change.

Do not resurrect stale project references from old docs or source packages.

---

# 20. PAYMENTS / BILLING

If payments are not launch-ready, keep paid purchase paths disabled/locked rather than faking completion.

Where payment code exists, verify:

- webhook signature verification;
- idempotency;
- atomic entitlement changes;
- replay resistance;
- price/product mapping;
- failure/retry handling;
- no client-side trust for subscription state.

Do not open paid launch gates without proof.

---

# 21. OFFLINE / PWA / STORAGE

Verify:

- service worker update behavior;
- offline shell;
- local conversations/messages;
- model availability state;
- model storage/download resume/integrity if supported;
- storage quota behavior;
- no data loss from upgrades;
- private sync reconnection;
- clear user messaging when network-only features are unavailable.

Keep UI simple: local-first does not mean exposing every storage implementation detail.

---

# 22. VOICE / VISION / DEVICES

Only expose capabilities that are real.

Voice:

- permission flow;
- listening state;
- stop/cancel;
- transcript/error behavior;
- orb state synchronization;
- no fake continuous listening.

Vision/files:

- supported upload types actually work;
- unsupported upload claims removed;
- permissions and size limits are clear;
- local/private behavior is truthful.

Devices:

- pairing state;
- disconnect/revoke;
- online/offline state;
- extension/native companion distinction understandable to normal users.

---

# 23. SECURITY REVIEW OF IMPORTED/ADAPTED CODE

Before wiring any imported/adapted server/native module, check for:

- unauthenticated filesystem access;
- arbitrary path traversal;
- command injection;
- unsafe shell interpolation;
- leaked secrets/API keys;
- public environment variables containing secrets;
- unsafe token parsing;
- SSRF/open proxy patterns;
- permissive CORS;
- missing authorization;
- insecure WebSocket/session ingress;
- unbounded file uploads;
- untrusted deserialization;
- insecure extension messaging;
- capability escalation across browser/native boundaries.

Do not port unsafe endpoints simply because they are functional.

---

# 24. DELETE DUPLICATION ONLY AFTER MIGRATION

Known duplication classes to trace include:

- multiple Chat implementations;
- multiple model routers;
- multiple tool registries;
- multiple task engines/routes;
- multiple Settings systems;
- multiple memory stores;
- duplicate dictation/voice paths;
- duplicate offline queues;
- multiple browser executors;
- dead 3D/motion surfaces;
- dead marketing/billing shells;
- stale imports/actions/routes.

For each duplicate:

1. identify all callers;
2. choose canonical authority;
3. migrate callers;
4. migrate tests;
5. verify behavior;
6. remove old implementation;
7. search for dead imports/routes/IDs.

Do not keep `old`, `new`, `v2`, `legacy`, `donor` and `canonical` implementations active together.

---

# 25. PERFORMANCE

Target a smooth ChatGPT/Claude-class interaction feel.

Measure/fix:

- route bundle size;
- duplicate dependencies;
- unnecessary hydration/re-renders;
- giant route components;
- expensive selectors/effects;
- GPU/particle load;
- memory leaks;
- long tasks;
- model-worker contention;
- scrolling performance;
- chat streaming jank;
- mobile layout shifts;
- service-worker/update stalls.

Use lazy loading/code splitting for heavy Cowork/3D/native-control surfaces. Do not load cinematic graphics in Settings or ordinary Chat when not needed.

---

# 26. TESTING STRATEGY

After every integration slice run focused tests. At major checkpoints run larger suites.

Required proof categories:

- TypeScript/typecheck
- lint/static analysis
- unit tests
- agent/tool contract tests
- local inference regression tests
- no-public-cloud-inference regression
- auth tests
- Supabase/RLS tests where available
- extension tests
- browser-control tests
- native/local companion tests
- service worker/PWA tests
- route/deep-link tests
- build
- release/launch proof scripts
- E2E/browser tests

For browser QA, use localhost like a real user:

- Chrome desktop;
- responsive/mobile widths;
- keyboard-only navigation;
- reduced motion;
- offline mode;
- loading/error/empty states;
- direct route navigation;
- refresh/back/forward;
- console errors;
- failed network requests;
- Chat send/stop/retry;
- tool permission/approval;
- Cowork pause/takeover/stop;
- browser extension disconnected/connected states.

Do not call a feature working because a file exists or a unit test mocks the entire boundary.

---

# 27. CHECKPOINT COMMITS

Make coherent commits throughout, for example:

1. reconcile branch with main + archive proof;
2. stage/import inventory;
3. dependency/provenance classification;
4. shared Chat/Cowork runtime;
5. tool registry/agent loop consolidation;
6. browser/computer control repair;
7. tasks/memory/projects/search consolidation;
8. route/settings cleanup;
9. UI/orb/auth redesign;
10. performance/security hardening;
11. test/release proof;
12. final dead-code/docs cleanup.

Do not leave all work in one giant unreviewable commit.

---

# 28. FINAL PRODUCTION PROOF

Before proposing merge:

1. working tree clean;
2. branch reconciled with latest `main`;
3. no unresolved merge markers;
4. no accidental source archive extraction into production paths;
5. no duplicate active implementations for migrated systems;
6. no public hosted AI fallback;
7. build green;
8. tests green or every unavoidable exception documented with exact evidence;
9. route audit green;
10. browser/Cowork safety controls proven;
11. auth/OAuth/legal URLs unchanged unless explicitly required;
12. production Supabase changes verified and minimal;
13. no secrets committed;
14. release/launch proof executed;
15. launch gate remains closed unless its independent readiness conditions are genuinely satisfied.

Only after proof is clean should you open/update the final PR and merge according to repository policy.

Do not merge merely because the UI looks finished.

---

# 29. FINAL REPORT FORMAT

At completion report:

## Repository state
- starting branch/head
- final branch/head
- main base used
- commits created

## Archive/import proof
- archive SHA-256
- extracted count
- staging receipt
- classification summary

## What was integrated
For each major subsystem state the final canonical path/authority.

## What was replaced/removed
List duplicate/dead systems removed and redirects/migrations added.

## What was clean-room reimplemented
List behaviors implemented independently rather than copied, with reason.

## UI/product changes
Summarize Chat, Cowork, orb, auth, navigation, Settings and responsive work.

## Tests/proof
List exact commands and pass/fail results.

## External blockers
Only genuine credential/account/provider blockers that could not be completed from the coding environment.

## Merge/launch state
State explicitly whether the branch is safe to merge and whether the public launch gate is still closed/open.

---

# NON-NEGOTIABLE RULES

- Do not start over from old `main`.
- Do not return only an audit or suggestions.
- Do not blindly overwrite production `src/` with the archive.
- Do not mount the source's separate web app as a second OCADE product.
- Do not introduce public-cloud AI inference fallback.
- Do not expose arbitrary filesystem/shell/native execution through Cloudflare/browser routes.
- Do not weaken RLS/auth/permission boundaries to make tests pass.
- Do not fake execution, success, storage, model, device or network states.
- Do not hide legally required provenance/attribution.
- Do not treat string renaming as proof of ownership.
- Do not keep duplicate implementations after callers are migrated and proof is green.
- Do not change public/OAuth/Cloudflare URLs casually.
- Do not merge or open launch gates until production proof is genuinely green.

**Finish the product, not just the import.**
