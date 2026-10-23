# OCADE — MASTER IMPLEMENTATION PLAN

**Implementation priority — owner direction, 23 October 2026**
**Repository:** `BREVEX-CEO/caera-connect-plan` · **Exclusive branch:** `ocade/p00-p22-implementation`
**Pinned DeepSeek Harness source:** `external/deepseek-harness/upstream` at `687f282e8625c6b8d11ff58211a90524be2e4317`
**Audit baseline:** OCADE `5a476453c885610e6f7a7eb5a07cf7fd4b77bb4f`; historical source snapshots below remain evidence, not current runtime certification.

## ABSOLUTE FIRST PRIORITY — MAXIMUM PRACTICAL DEEPSEEK HARNESS INTEGRATION

**OCADE MUST use DeepSeek Harness at the highest practical, compatible and independently verified level, as a real, connected part of ONE OCADE work-completion agent.** Treat the pinned DeepSeek source as implementation material—not merely inspiration, documentation, a Gitlink, or a collection of rewritten demos. Study and selectively **import, incorporate, build, adapt, connect and execute actual useful DeepSeek source files and their required dependencies** within OCADE's supported runtime boundaries. Prioritize DeepSeek's core agent loop, session events/projections, checkpointing, context compaction, tool scheduling/registry, structured plans, durable question/approval presentation, skill/tool discovery, useful MCP integration, and eligible browser/computer interfaces. Assess advanced capabilities (PTC, workflows, LSP, subagents, additional providers) systematically and implement those that deliver measured benefits without bypassing device authority, sandboxing, permissions, cost limits, or user control.

The implementation must **not stop at a reference-only submodule or a few DeepSeek-inspired helper functions**. For each useful upstream capability, record: the upstream path and pinned revision; whether actual upstream source is incorporated, a compatible dependency is reused, or a narrowly adapted implementation is required; its OCADE entry points; feature wiring; tests; performance/accuracy evidence; reason for any exclusion; and shipped/maintained dependencies. Choose **direct source reuse by default where lawful and technically sound**. If direct reuse cannot work safely because of Cordis lifecycle, pnpm, Zod 4, Node-only internals or Cloudflare Workers constraints, demonstrate the incompatibility and use a bounded, tested adaptation instead. Do not force the full upstream executable, unsafe default SDK/sandbox, duplicate Electron UI, standalone credential store, second autonomous task authority or unreviewed local shell execution into OCADE. Preserve required MIT/third-party notices, provenance, and applicable license obligations.

**Maximum capability, minimum duplicated code:** Remove or replace weaker, app-name-hardcoded or duplicate OCADE execution logic only **after** stronger integrated behavior passes matching feature/security/recovery/output tests. Keep OCADE's authenticated customer/device identities, one canonical permission and task-admission authority, verified result and delivery checks, STOP/Take Over/cancellation fencing, budget/payment authority, and local-first PC/device control. Do not reintroduce an inflexible hardcoded supported-app list. Provide a dynamic `@` app picker showing each user's real installed applications, real icons when safely available, and stable device-specific references. Present a simple premium Gemini-quality chat interface using **OCADE's current branding, colors and light/dark theme**. Use Gemini 3.5 Flash-Lite as the existing DEFAULT online model and Gemma 4 via Cloudflare Workers AI only as the explicitly selected HIGH mode, with real availability/capacity and safe routing verified before claims. Offline Chat remains separate; JARVIS planning does not silently fall back to offline or another paid model.

**Success means independently verified completed customer work**—not importing a percentage of the 16,297 upstream files, passing only unit tests, or claiming competitors have been beaten. Benchmark quality, verified completion, task latency, model calls, false successes, recovery, file integrity, resource use, and approved cost on matched real tasks. Identify areas where Muse, Dots, Grok Bot, ChatGPT Agent/Work, Claude, Gemini, Manus, OpenClaw, Cursor and Devin outperform OCADE; use those comparisons as measurable targets, never unsupported victory claims.


## VERIFIED DEEPSEEK SOURCE-FILE ADOPTION BLUEPRINT — FIRST-PRIORITY IMPLEMENTATION CONTRACT

**Owner instruction:** Go deeper than adapting ideas. Inspect the pinned DeepSeek Harness implementation file-by-file and maximize useful *actual source reuse* in the single OCADE agent. Import selected files/dependency-complete packages into a clearly identifiable, maintainable integration boundary and **make the code execute in real tasks**. Do not claim "integrated" merely because source exists under the submodule, a pattern was rewritten, or documentation mentions it. Prefer lawful, safe upstream source reuse where technically possible; explain tested incompatibility wherever adaptation is necessary.

### 1. Exact inventory, number of files, and scope of the import

The pinned upstream source contains **16,297 tracked files**. The original Codex dependency inventory (Appendix A `6) identified a *candidate evaluation envelope*: **33 core packages / 491 files / 145 source files**, plus **23 additional packages / 342 files / 101 source files**, totaling **56 packages / 833 files / 246 source files**. This is NOT an instruction to copy all 833 files or a tested production dependency graph. Its other 587 files include package configuration, tests, fixtures and documentation. The remaining **15,464 repository files** are outside this candidate evaluation envelope; they are not a default product import. External transitive dependencies and selected vendors must still be resolved and reviewed.

Below is a **second, exact-path shortlist** independently cross-checked against the pinned upstream Git tree: **58 paths for the essential foundation, 49 for expanded capabilities, and 6 for strictly gated advanced capabilities**. These are reviewed source *candidates*, not a fabricated already-integrated count. They do not override the dependency closure (an upstream file may require additional sources). Preserve upstream tests and mandatory licences/notices in the engineering repository, not unnecessarily in the shipped client.

**Numerical decision:** Audit the complete 56-package/246-source-file candidate envelope. Evaluate the verified shortlist first, then add any missing transitive source dependencies and other justified source files up to the compatible, useful subset of that 246-file envelope. **There is no compulsory minimum or percentage to copy.** If direct integration of all shortlisted paths fails compatibility/security/performance gates, retain only the tested, dependency-complete subset and document why. Conversely, do not artificially cap the implementation at a tiny wrapper count if real upstream functionality demonstrably helps. Physical file-copy counts, runtime-import counts, transitive package counts and deployed bundle size must be reported separately, based on actual builds.

### 2. Mandatory source-adoption standards

1. **Find and verify the precise pinned upstream file and its imports/exports.** Identify its `package.json`, workspace dependencies, generated files, patches, licences, tests, environmental APIs and side effects.
2. **Choose one explicit disposition per source file:** (D) DIRECT/REAL IMPORT from a compatible package, (V) VENDOR selected source with attribution and dependency closure, (A) ADAPT with an annotated map of retained logic and changed OCADE interface, (R) REFERENCE/TEST ONLY, or (X) EXCLUDE with reason. Direct import is the preferred first *evaluation*, not a license to bypass OCADE boundaries.
3. **Use exactly one task authority.** OCADE Supabase-backed admission, authenticated device identity, permission checks, STOP epoch, payment/model permits, verification and customer data isolation remain binding. No upstream plugin, child agent, tool or generated script may bypass these checks.
4. **Measure before replacing.** Write the upstream/OCADE functional equivalence tests and adversarial cases; introduce a flag-gated reversible implementation; compare the same real task and errors; then remove only the superseded OCADE logic. Keep rollback and an authoritative action receipt path.
5. **Keep runtimes honest.** Cloudflare Workers Node compatibility is incomplete. Never claim that a direct-import path is functional just because its TypeScript compiles. Test actual Worker execution or use a narrow portable adaptation; keep native browser/PC work in the paired OCADE Device Agent. No unapproved new cloud runners or account permissions.
6. **Produce a traceable evidence table for EVERY admitted source file or complete dependency package:** Upstream path+pin → disposition → imported OCADE path/import statement → transitive dependencies and licences → feature it drives → removed OCADE symbol → tests → cost/latency/accuracy delta → rollback. No unsupported “100% DeepSeek integrated” claim.
7. **No accidental product bloat.** Production builds must exclude unused test fixtures, docs, example apps, duplicate UI shells, unused binaries, telemetry, arbitrary plugin installers and local autonomous schedulers. Retain relevant tests in the dev suite; do not delete meaningful historical tests to make the codebase look smaller.

### 3. Source files specifically selected for close evaluation

### Wave A — essential agent/runtime sources (highest priority)

All paths are rooted at the pinned DeepSeek revision; use the `src/` entries beneath each exact package directory.

| Exact upstream package | Verified `src/` files to examine for direct reuse or bounded adaptation | Count | Desired OCADE behavior |
|---|---|---:|---|
| `packages/core/agent-loop` | `agent.ts`, `assistant-stream.ts`, `inbox.ts`, `runtime-context.ts`, `tool-calls.ts`, `index.ts` | 6 | Shared run loop, ordered tool work, cancellation, one foreground/background lifecycle |
| `packages/core/agent` | `types.ts`, `dispatch.ts`, `runtime-types.ts`, `projection.ts` | 4 | Agent state, dispatch and trace projection |
| `packages/core/session` | `types.ts`, `known-event-types.ts`, `repair.ts`, `tool-history.ts`, `seq-ranges.ts`, `preparation.ts` | 6 | Durable event log, correct tool-result matching and recovery |
| `packages/core/scope` | `index.ts`, `store.ts` | 2 | Run-scoped registrations and teardown |
| `packages/core/tools` | `schema.ts`, `json-schema.ts`, `presentation.ts`, `types.ts`, `index.ts` | 5 | Unified typed tool registry, classification and broker metadata |
| `packages/session/session-persistence` | `storage-contract.ts`, `handle.ts`, `revision.ts`, `index.ts` | 4 | Canonical storage contract over OCADE Supabase, not new JSONL/SQLite authority |
| `packages/session/session-projection` | `index.ts`, `types.ts` | 2 | One trustworthy task/UI/delivery projection |
| `packages/session/session-checkpoint-policy` | `index.ts` | 1 | Checkpoint before irreversible actions and safe continuation |
| `packages/compaction/compaction` | `checkpoint.ts`, `tool-pairing.ts`, `types.ts`, `index.ts` | 4 | Context compaction preserving tool/evidence pairs |
| `packages/compaction/compaction-tool-result-pruner` | `config.ts`, `index.ts`, `types.ts` | 3 | Token-efficient pruning with traceable references |
| `packages/llm/llm` | `adapter-failure.ts`, `assembler.ts`, `assistant-stream.ts`, `content.ts`, `message.ts`, `retry-policy.ts`, `types.ts` | 7 | Model output normalization; keep OCADE actual Gemini/Gemma routing and billing |
| `packages/llm/llm-retry` | `index.ts`, `types.ts` | 2 | One typed retry controller, not nested retry loops |
| `packages/plan/plan-mode` | `index.ts`, `types.ts` | 2 | Structured plans without unauthorized effect execution |
| `packages/todo/tool-todo` | `client.ts`, `index.ts`, `types.ts` | 3 | Task progress and unfinished obligations |
| `packages/guard/timeout-policy` | `index.ts` | 1 | Bounded calls with device-level cancellation |
| `packages/guard/repeat-tool-reminder` | `index.ts` | 1 | Loop warnings and repetitive-work detection |
| `packages/context/agent-instructions` | `config.ts`, `digest.ts`, `files.ts`, `render.ts`, `state.ts` | 5 | Scoped instructions with untrusted-content provenance |

### Wave B — enhanced context, connectors, apps and customer interaction

All paths are rooted at the pinned DeepSeek revision; use the `src/` entries beneath each exact package directory.

| Exact upstream package | Verified `src/` files to examine for direct reuse or bounded adaptation | Count | Desired OCADE behavior |
|---|---|---:|---|
| `packages/compaction/compaction-basic` | `region.ts`, `summarizer.ts`, `index.ts`, `config.ts` | 4 | Safe longer-turn summaries after cheaper pruning |
| `packages/compaction/compaction-image-offload` | `image-offload.ts`, `index.ts`, `project-message.ts`, `projection.ts` | 4 | Model-context reduction while keeping original evidence |
| `packages/context/session-reference` | `projection.ts`, `serialization.ts`, `spill.ts`, `uri.ts`, `types.ts` | 5 | References to permitted prior sessions and work |
| `packages/interaction/user-approval` | `index.ts`, `types.ts` | 2 | Approval display only: OCADE alone grants permission |
| `packages/interaction/user-questions` | `projection.ts`, `timed-wait.ts`, `types.ts`, `index.ts` | 4 | Durable questions and cancellation; no implicit timed consent |
| `packages/interaction/tool-ask-user` | `index.ts`, `timed.ts` | 2 | Structured clarification without unsafe default approval |
| `packages/host/open-in-app` | `resolver.ts`, `icons.ts`, `internals.ts`, `shared.ts` | 4 | Real app resolution/icon patterns; explicitly DO NOT import catalog.ts as the inventory |
| `packages/client/ui-input-trigger` | `contract.ts`, `detect.ts`, `menu.ts`, `controller.ts` | 4 | Typed @ mention detection, selection, accessibility, keyboard handling |
| `packages/client/ui-chat` | `use-scroll-follow.ts`, `use-chat-scroll.ts` | 2 | Scroll/user-intent behavior; retain OCADE branding and UI architecture |
| `packages/client/ui-reference` | `user-text-rules.ts` | 1 | Persisted reference render and text escaping |
| `packages/fs/fs-observation-policy` | `index.ts`, `types.ts` | 2 | Read-before-write and post-mutation invalidation |
| `packages/mcp/mcp-client` | `connection.ts`, `server-context.ts`, `tools.ts`, `transport.ts`, `index.ts` | 5 | Approved MCP connectors through one OCADE tool/permission broker |
| `packages/mcp/mcp-resources` | `index.ts`, `render.ts`, `tools.ts` | 3 | Scoped bounded external-resource reads |
| `packages/skill/skill` | `index.ts` | 1 | Reviewed skill registry, not auto-install |
| `packages/skill/skill-filesystem` | `index.ts` | 1 | Bounded authorized skill files |
| `packages/skill/tool-skill` | `index.ts` | 1 | Select and load only the relevant reviewed skills |
| `packages/llm/token-meter` | `estimate.ts`, `projection.ts`, `turn-usage.ts`, `types.ts` | 4 | AI context diagnostics, not OCADE commercial charging authority |

### Wave C — advanced capabilities (gated, not unrestricted)

All paths are rooted at the pinned DeepSeek revision; use the `src/` entries beneath each exact package directory.

| Exact upstream package | Verified `src/` files to examine for direct reuse or bounded adaptation | Count | Desired OCADE behavior |
|---|---|---:|---|
| `packages/ptc-runtime/ptc-runtime` | `index.ts`, `types.ts` | 2 | Typed programmatic-tool interface, never unrestricted shell/code execution |
| `packages/subagent/subagent` | `manager.ts`, `control-types.ts`, `projection.ts`, `archive-admission.ts` | 4 | Parent-owned scoped read-only subtasks; never competing PC controllers |


### 4. Required OCADE replacement map (existing implementation → improved connected implementation)

| Priority | OCADE files / existing responsibility | Source to evaluate | REQUIRED wire-up / replacement and regression proof |
|---|---|---|---|
| P0/P1 | `src/jarvis/engine.ts`; `src/jarvis/agent.ts`; `src/jarvis/background.server.ts` | Core agent-loop (`agent.ts`, `tool-calls.ts`, `inbox.ts`), agent dispatch, session projection | Convert duplicated foreground/background control into a single persisted run transition engine. Keep distinct request/transport surfaces; each authorized call passes OCADE task authority; same event trace gives same status, cost settlement, STOP and delivered output. Retire old independent planners only after parity. |
| P1 | `src/jarvis/JarvisWorkspace.tsx`; `src/jarvis/JarvisBubble.tsx`; `src/jarvis/bubble-state.ts` | Session projection, inbox, interaction events | One account-owned task lifecycle across Chat handoff, Workspace, Bubble and device carry-on; safe navigation, switching users, concurrent work, retry and takeover. Retain OCADE UI rather than importing DeepSeek's web client. |
| P0/P1 | `src/jarvis/task-authority.server.ts`; `src/jarvis/device.server.ts`; Supabase task/activity records | Session event/repair, checkpoint and delivery projections | One durable task/event record and accurate reconstructed delivery. Fix exact file-path identity, DB-unavailable≠no-deliveries, orphan uploads, false-complete terminal prose and replay/STOP races before relying on upstream state. |
| P1 | `src/jarvis/protocol.ts`; `src/jarvis/permissions.ts` | Core tools schema/presentation, scoped tool registry, fs observation | Derive model-facing tools and validation from canonical typed OCADE actions. Dynamically discover capabilities and enforce strict permissions at admission/device execution. Remove app-name-specific routing/prompt heuristics only when the capability-based method fully covers the old feature and unknown apps. Do NOT remove legitimate document/media/format verifiers. |
| P1 | `src/jarvis/live-deps.ts`; `src/jarvis/background-model.server.ts`; `src/lib/intelligence/{router,edge-handler,online-models,workers-ai}.ts` | DeepSeek LLM message/stream assembly, typed retry, token-meter concepts | Preserve Gemini 3.5 Flash-Lite as the configured DEFAULT and opt-in Cloudflare Gemma 4 HIGH. Verify exact available model IDs, quotas, all permitted Gemini key slots, endpoint failures and cost settlement. Reuse upstream streaming/error contracts without new credential stores, quota evasion, silent fallback or a second retry system. |
| P1 | `src/jarvis/engine.ts`; prompt/context assembly; saved task events | Tool-result pruning, compaction, agent instructions, session references | Token-efficient long tasks without discarding permission conditions, provenance, action results, unfinished steps, image references or verification evidence. Benchmark total tokens, turns, speed and errors vs existing. |
| P1 | `jarvis-runtime/ocade_computer.py`; `jarvis-runtime/ocade_discovery.py` | `host/open-in-app` resolver/icons (NOT static catalogue), OCADE capability discovery | Inventory truly installed apps, verified executables, running windows, real icons, APIs/automation surfaces and freshness by stable per-device ID. Do not hardcode app brands; app detection must not falsely assert automation works. |
| P1 | `src/jarvis/mention.tsx`; `src/jarvis/JarvisWorkspace.tsx`; `src/jarvis/jarvis.functions.ts` | `ui-input-trigger` detect/menu/controller; app icon patterns | Structured `@` app+device IDs (not substring matching) with real icons, keyboard menu, duplicates, app revisions, persistence through retry/failure/reload/handover; selecting an app must NOT grant permission. |
| P1 | `jarvis-runtime/ocade_device.py`; `src/jarvis/device.server.ts`; icon migration | Upstream bounded interaction/transport ideas; OCADE native icon code | Keep icon batches out of critical heartbeat/STOP delivery; budget aggregate payload, acknowledge persisted revisions, retry transient failures. Reconcile/apply new schema ONLY in an authorized disposable staging candidate before production approval. |
| P1 | `jarvis-runtime/actions/browser_control.py`; `jarvis-runtime/actions/ocade_page.js`; `jarvis-runtime/ocade_existing_browser.py` | Browser-use interface, optional Playwright/DevTools/Stagehand providers | Prefer OCADE's existing authenticated browser session and semantic DOM execution; benchmark alternative providers on popups, tabs, downloads, ownership and fast reliable actions. No duplicate controller for one browser/tab. |
| P1 | `jarvis-runtime/ocade_computer.py`; `jarvis-runtime/ocade_accessibility.py` | Computer-use interface, optional CUA drivers | Preserve real OS/browser controls and signed paired-device authority. Compare safe native APIs/accessibility/vision; adopt upstream driver components only if actual Windows/macOS tests show better control and STOP, without hidden direct desktop execution. |
| P1 | `src/jarvis/jarvis.functions.ts`; memory storage | Scoped instructions/session references, provenance rules | User-origin authenticated memory only; retrieved pages/files and skills cannot grant instructions or write persistent memory; inspect/delete, cross-account and restart tests. |
| P1 | `jarvis-runtime/ocade_documents.py`; `jarvis-runtime/ocade_sheets.py`; `jarvis-runtime/ocade_media.py`; file action adapters | DeepSeek skills, workflows, bounded tool broker where beneficial | Keep generic actual file-format capabilities and semantic output checks. Remove obsolete hardcoded app-name branches—not working editors/parsers—after verified replacement. Test document, spreadsheet, CAD, photo/video edits, editable projects, render and Open/Download on actual supported apps. |
| P1/P2 | `src/components/chat/MessageList.tsx`; `src/jarvis/JarvisWorkspace.tsx`; `src/styles.css`; `src/shared/ui/tokens/monochrome.css` | `ui-input-trigger`, `ui-chat` scroll behavior, `ui-reference`, deliverable patterns | Premium simple Gemini-quality conversation, single task composer, streamed readable replies, progress, pause/STOP, native file previews, accessibility and real app icons. Preserve OCADE's current color/theme/identity and don't import a second chat framework. |
| P2 with measured need | Existing OCADE approved connector/tool broker | `mcp-client`, `mcp-resources` and `skill` modules | Actually connect a reviewed tool/skill through OCADE permissions, revoke access, audit untrusted output, respect budgets and show verified improvement. Do not enable arbitrary marketplace/plugin installation. |
| P2/P3 with measured need | OCADE workflow/coding capabilities and task history | PTC typed interface, optional LSP, bounded workflow builder, parent-owned read-only subagents | Evaluate faster compiled multi-step execution and parallel independent research; each inner side effect still runs through OCADE broker; never permit a second desktop authority, unrestricted shell or unapproved costs. |

**Do not delete wholesale:** `task-authority.server.ts`, existing device security files, identity/signature checks, STOP fences, `supabase/migrations/`, security verification, real file manipulation libraries, user data controls and tests. Replace the *weaker behavior inside those modules* only when verified. Historical audit F01–F12 and backlog A01–I06 (Appendix B) remain mandatory.

### 5. Entire DeepSeek package families to exclude from the customer build by default

| Source family / exact path | Reason / conditional treatment |
|---|---|
| `.agents/`, `snapshots/`, `website/`, broad `docs/`, `scripts/`, `benchmarks/`, `.github/` | Developer notes, archived evidence, marketing, automation and fixtures. Retain required reference/test data for maintainers; not runtime. |
| `apps/cli/`, `apps/web/`, `apps/desktop/`, `apps/desktop-host/` | Would transplant another product shell/desktop host; keep OCADE React/PWA and Device Agent instead. |
| `packages/bundle/`, `packages/boot/plugin-manager/`, `packages/boot/plugin-market/`, `packages/extensions/` | Broad default executable bundles, plugin markets or uncontrolled dynamic loading. Use explicit reviewed composition, not upstream unsafe defaults. |
| `packages/session/session-persistence-jsonl/`, `packages/storage/storage-json/`, `packages/storage/storage-sqlite/` | Parallel authoritative data stores; OCADE owns canonical Supabase task data. A dev-only export can be retained if justified. |
| `packages/credentials/credentials-local/`, `packages/credentials/deepseek-account/`, `packages/credentials/deepseek-account-platform/` | Avoid duplicate account/key stores and inadvertent new provider spending. |
| `packages/telemetry/`, `packages/session/session-telemetry/`, `packages/session/session-telemetry-otel/` | No new collection or outbound transfer of customer interactions without reviewed privacy design/consent. |
| `packages/schedule/`, autonomous `packages/goal/` drivers, automatic self-resume | No creation of new unattended recurring tasks or quota-reset continuations without explicit owner/customer authorization. Internal active-run progress tracking is distinct. |
| `packages/shell/*-local/`, `packages/terminal/`, `packages/ssh/`, unrestricted `packages/ptc-runtime/ptc-runtime-node/` | Excess shell/network/host authority unless independently isolated, permitted and benchmarked. |
| `packages/subagent/subagent-claude-code/`, `packages/subagent/subagent-codex/` and arbitrary external child-runner adapters | Extra identities, spending and agent authorities; scoped internal read-only subtask evaluation is separate. |
| `packages/host/open-in-app/src/catalog.ts` | Contains a static named-app catalogue; **NEVER use it as OCADE's supported-app list**. Resolver/icon mechanics are different and may be reused. |
| Most `packages/client/` (especially the whole upstream UI shell) | Avoid duplicate design system, app state, navigation and client bundle. Reuse only selected accessible interaction primitives. |
| Broad `native/`, `python/`, Electron/FFI/PTY/browser binaries and patches | Admit only if a chosen, approved capability actually requires them, platform distribution/licence tests pass and size is justified. |
| Upstream test fixtures, mock servers and snapshots | Keep relevant test cases for automated development, but don't package them into the customer runtime. |

**Do not confuse EXCLUDE with deleting the Git submodule:** Keep the complete pinned source accessible for attribution, regression comparison and future justified capabilities. Apply package/source-file exclusion only to what OCADE imports and ships.

### 6. Integration-proof, release and code-size gates

- **Gate 1 — Source truth:** Confirm every proposed path exists at upstream pin and matches the expected license/manifest. Record exact packages, files, entrypoints and dependent APIs.
- **Gate 2 — Runtime compatibility:** Build the candidate in OCADE's real supported TypeScript/Node/Cloudflare and Python/native environments. Any Worker-only Node APIs, pnpm/Zod 4/Cordis mismatch must be addressed without silently creating a shadow service or bypass.
- **Gate 3 — Authoritative policy:** Verify permission, STOP, user/account/device identity, payment quota, action admission, and completion checks for every upstream-origin tool action, including nested or parallel actions.
- **Gate 4 — Product wiring:** Prove each imported capability is reachable from the actual OCADE chat/JARVIS task flow; no dead import, unused library or isolated demo counts as integration. Preserve one active controller per mouse, tab or document.
- **Gate 5 — Task parity and debloat:** On identical inputs and quality checks, new components must be at least as safe and accurate as the existing engine and ideally faster/cheaper; prove fallback/rollback. Only then delete superseded symbols, with updated tests and references.
- **Gate 6 — Native/model/full-system evidence:** Verify real Gemini/Gemma paths, real device/browser work, real file outcomes, interruption/recovery, speech/UI/mobile where promised, native-app icons and exact environment pins; report gaps without guessing success rates.
- **Gate 7 — Public commercial launch:** Close the complete P0/P1 audit backlog, qualify independently verified task-success targets by workflow family, protect personal data/permissions, prove payments and subscriptions only after authorized enablement, licence notices, rollback and owner release approval.

**Must report after each milestone:** Number of actual upstream files/packages incorporated, number excluded with reason, transitive dependency size, code replaced/deleted, live execution path proven, test counts with skipped/blocked details, real task success and false-completion rate, p50/p95 where samples permit, cost/model calls, resource usage and all unresolved blockers. No file-count vanity or invented superiority metrics.

**Final instruction:** Extensive source reuse is a core owner goal. But the winner is OCADE completing actual work correctly, quickly, securely and reproducibly—not maximizing line count. Maintain full original reports in Appendices A and B; update the main actionable plan rather than rewriting or deleting their historical evidence.


---

## CURRENT AUDIT — IMPLEMENTATION-ORDER OVERRIDES

The full 1,018-line Codex audit is reproduced **verbatim in Appendix B** and must be used as the current defect and release-backlog baseline; Appendix A preserves the preceding original DeepSeek integration analysis in full. The audit found genuine progress but only a partial DeepSeek-derived implementation: the pinned packages are **not yet imported as a running upstream engine**; the shared engine remains partially duplicated between foreground and background. There are confirmed defects in icon payload size/acknowledgement, exact-path delivery, delivery failure handling, final-answer truthfulness and `@` mention identity/retry. The candidate's release gates remain **0/10 qualified** (which does not mean 0% of code exists).

Implement in dependency order, with this emphasis:

1. **P0 release safety and truthfulness:** First reconcile security and database schema differences in an isolated candidate, STOP/completion protections, privileged functions, deployment access and tenant isolation. Never mutate production or apply migrations without separate owner approval. Fix wrong-file/false-completion hazards and verified-delivery truthfulness.
2. **Finish the DeepSeek-powered agent core:** Audit and import the largest useful compatible upstream source set, with exact dependency/test inventories and a reversible integration boundary. Unify foreground/background/bubble execution and recovery; persist versioned tasks, context, tool receipts, app references, checkpoints, cancellation and delivery. No second authority or unapproved background recurrence.
3. **Repair the existing integration:** Fix icon aggregate budgets, persistence acknowledgements, native icon readiness, stable app identity and `@` retry/navigation persistence. Make native/browser controls cooperate through one resource owner; replace hardcoded app-name routing with capability discovery.
4. **Verify real work and model routing:** Close spreadsheet/formula, video/project, CAD, browser, document, artifact, interruption and offline defects. Verify the configured Gemini/Gemma paths, quotas, STOP, concurrency and no unintended charges. Retain independent semantic verification, not model self-reporting.
5. **Complete customer and commercial product:** Finish premium OCADE UI, voice, mobile, auth/MFA, staff/owner controls, customer data, deployment/distribution, support, payment/subscription contracts, privacy/licensing/operations and rollout gates. Payments, production deployment, spending and merging into `main` require explicit approval.
6. **Evidence-driven gates:** Test each implemented phase and fix regressions before progressing. Record exact file paths, added/retired code, test failures, blocked environments, cross-device/native checks and comparable real-task results. Finish coding and automated qualification first; real-world customer benchmark tasks may be supplied separately. Do not claim bug-free or 100% launch-ready without independently qualified evidence.

**Plan ownership:** The specific audit checklist (A01–I06) in Appendix B is mandatory tracking, with source paths, priorities and acceptance criteria. Audit findings labeled risks require reproduction before being asserted as bugs. Resolve status contradictions using new evidence; preserve existing test ledgers rather than inventing a second competing status tracker. The report's old time estimates and baseline SHAs are planning snapshots, not promises.

**Owner safety constraints:** Work only on `ocade/p00-p22-implementation`; preserve concurrent changes. No merges to `main`, production deployments, unapproved spending, enabled payments, secret exposure, or unattended scheduled continuations. Staging schema changes and real external actions require appropriate authorization and proof. All work must be reproducible and reversible.

---

## Appendix A — Original Codex DeepSeek/OCADE master analysis (preserved in full)

# OCADE_DEEPSEEK_MASTER_PLAN.md

**Read-only analysis · 23 October 2026**

## 1. Recommendation

Build **one OCADE agent with one execution authority**, using selected DeepSeek Harness components for orchestration, session history, context management, tool scheduling and interaction.

Preserve OCADE’s existing:

- Authentication, account ownership and commercial controls.
- Device identity and authenticated device transport.
- Browser and native-computer drivers.
- Permission enforcement.
- STOP, pause and takeover controls.
- Server-side completion verification.
- Document, spreadsheet and media capabilities.
- Monochrome design system.

Replace duplicated orchestration and fragile prompt-driven behavior incrementally. Do not transplant the complete DeepSeek application, install its default profile, introduce a second permission system or treat its SDK as a small dependency.

**The greatest practical benefit is more reliable coordination of OCADE’s existing capabilities—not another collection of tools.**

DeepSeek Harness is software infrastructure. Importing it does not import model weights, automatically improve reasoning quality or authorize using DeepSeek’s inference services.

This report proposes future work only. **No repository files were changed, no dependencies were installed, no tests or device workflows were executed, and no commits, deployments or scheduled tasks were created.** The report is delivered inline as requested.

---

## 2. Inspected versions and evidence boundaries

### 2.1 Immutable source anchors

| Repository | Inspected revision |
|---|---|
| OCADE | Branch `ocade/p00-p22-implementation`, resolved to `df7c136361744bc73f401a7043634e521378d220` |
| DeepSeek Harness | Gitlink at `external/deepseek-harness/upstream`, pinned to `687f282e8625c6b8d11ff58211a90524be2e4317` |

Source anchors:

- [OCADE inspected commit](https://github.com/BREVEX-CEO/caera-connect-plan/tree/df7c136361744bc73f401a7043634e521378d220)
- [DeepSeek inspected commit](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317)
- [OCADE integration contract](https://github.com/BREVEX-CEO/caera-connect-plan/blob/df7c136361744bc73f401a7043634e521378d220/docs/integrations/deepseek-harness.md)

The local checkouts were older than the remote branch. Analysis therefore used the remote revision above, not an assumption that local HEAD represented the requested branch.

### 2.2 Coverage

| Inventory | Result |
|---|---:|
| OCADE recursive tree entries | 1,240 |
| OCADE ordinary file blobs | 1,126 |
| OCADE submodule gitlinks | 1 |
| OCADE text files available for analysis | 1,074 |
| Remaining OCADE binary assets | 52 |
| DeepSeek file blobs | 16,297 |
| DeepSeek regular files inspected in the in-memory archive | 16,283 |
| DeepSeek symlink blobs inventoried separately | 14 |
| DeepSeek total blob sizes | 133,200,281 bytes |
| DeepSeek package manifests under `packages/` | 342 |
| Package/application/native/vendor manifests inventoried | 357 |

OCADE text collection included 960 files matched to remote Git blob identities and 114 changed or additional files obtained from the remote snapshot.

The analysis combined a complete structural inventory, manifest/dependency analysis, broad source searches and detailed reading of execution-critical code. It is **not a claim that every line of 16,297 DeepSeek files has received a security audit**, nor that binary assets were visually audited.

### 2.3 Important distinctions

The report distinguishes:

- **Observed:** directly present in inspected source.
- **Static risk:** a plausible failure path identified in source that needs a reproducing test.
- **Proposal:** behavior that does not exist yet.
- **Target:** a future measurable acceptance threshold.
- **Historical evidence:** results documented by the repository, not rerun here.

No current runtime performance, production database state, deployment configuration or competitor success rate was measured.

---

## 3. What OCADE already has—and should preserve

OCADE is not starting from an empty agent shell. Replacing its existing boundaries indiscriminately would discard important work.

| Existing capability | Exact paths | Decision and reason |
|---|---|---|
| Foreground agent execution | `src/jarvis/agent.ts` | Preserve behavior and tests while replacing orchestration internals incrementally. |
| Background continuation | `src/jarvis/background.server.ts`, `src/routes/api/jarvis/continue.ts` | Preserve authenticated transport; converge its planning logic with foreground execution. |
| Model transport and commercial permits | `src/jarvis/live-deps.ts`, `src/jarvis/background-model.server.ts`, `src/lib/commercial/` | KEEP. DeepSeek usage estimates must not become billing authority. |
| Task ownership, admission and completion | `src/jarvis/task-authority.server.ts` | KEEP as the authoritative enforcement boundary. |
| Action vocabulary and validation | `src/jarvis/protocol.ts` | KEEP schemas and invariants; reduce duplicated representations and prompt coupling. |
| Permissions | `src/jarvis/permissions.ts`, `src/jarvis/jarvis.functions.ts` | KEEP enforcement; strengthen identity and provenance. |
| Global STOP | `src/jarvis/stop-everywhere.ts`, `src/jarvis/device.server.ts` | KEEP and extend cancellation propagation into the new engine. |
| Local physical execution and cancellation | `jarvis-runtime/ocade_device.py`, `jarvis-runtime/ocade_computer.py` | KEEP. These are actual execution systems. |
| Device identity | `jarvis-runtime/ocade_identity.py` | KEEP. Never replace with a generic localhost trust assumption. |
| Browser control | `jarvis-runtime/actions/browser_control.py`, `jarvis-runtime/actions/ocade_page.js`, `jarvis-runtime/ocade_existing_browser.py` | KEEP and expose through a provider adapter. |
| Accessibility and computer interaction | `jarvis-runtime/ocade_accessibility.py`, `jarvis-runtime/ocade_computer.py` | KEEP. Prefer semantic control before coordinates. |
| Application discovery and learned recipes | `jarvis-runtime/ocade_discovery.py` | KEEP and improve stable application identity, freshness and evidence. |
| Documents, sheets and media | `jarvis-runtime/ocade_documents.py`, `jarvis-runtime/ocade_sheets.py`, `jarvis-runtime/ocade_media.py` | KEEP until an alternative wins equivalent real-work tests. |
| Chat and offline intelligence | `src/lib/intelligence/router.ts`, `src/lib/intelligence/edge-handler.ts`, `src/lib/intelligence/online-models.ts` | Preserve routing and existing online/offline boundaries. |
| UI and design tokens | `src/jarvis/JarvisWorkspace.tsx`, `src/jarvis/JarvisTask.tsx`, `src/jarvis/JarvisPanels.tsx`, `src/styles.css`, `src/shared/ui/tokens/monochrome.css` | KEEP visual identity; improve composition and interaction. |
| Database safeguards | `supabase/migrations/`, `supabase/verification/` | Preserve historical migrations and verification evidence. Additive future changes only after review. |

### Existing safeguards worth protecting

The inspected code already contains:

- Controller ownership and expected-status checks.
- Queue admission through the server.
- A database guard preventing completion from reviving a stopped task.
- Signed device identity.
- Local cancellation before waiting for a network response.
- Durable device intent/result handling.
- Fresh-observation checks.
- Verification invalidation after relevant mutations.
- Explicit spreadsheet `filledRows` checks.
- Completion checks independent of the assistant’s final prose.
- Refusal to present an unconfirmed remote STOP as confirmed quiescence.

See [task authority](https://github.com/BREVEX-CEO/caera-connect-plan/blob/df7c136361744bc73f401a7043634e521378d220/src/jarvis/task-authority.server.ts), [device execution](https://github.com/BREVEX-CEO/caera-connect-plan/blob/df7c136361744bc73f401a7043634e521378d220/jarvis-runtime/ocade_device.py), and the [completion transition guard](https://github.com/BREVEX-CEO/caera-connect-plan/blob/df7c136361744bc73f401a7043634e521378d220/supabase/migrations/20261019104555_completion_cannot_revive_a_stopped_task.sql).

---

## 4. Main findings

### 4.1 Foreground and background execution duplicate agent policy

**Observed:** `runJarvisTurn()` in `src/jarvis/agent.ts` and `carryOn()` in `src/jarvis/background.server.ts` implement different execution paths.

Differences include:

- History reconstruction.
- Tool selection and result handling.
- Limits and stopping rules.
- Recovery behavior.
- Artifact delivery.
- Progress and final-response handling.

Foreground execution uses a 30-model-step limit; background code has a separate 60-action limit. These are different units, but their independent ownership makes behavior harder to reason about.

**Recommendation:** one shared turn state machine and tool-result interpretation layer, with separate foreground, bubble and device transport adapters.

Do not simply concatenate the files or force browser lifecycle code into a server module.

### 4.2 Resume state is insufficiently unified

**Observed:** foreground execution maintains delivery-relevant collections in memory, including changed paths and finished-artifact information. Its checkpoint does not persist all of that state.

**Static risk:** resuming an existing task through a different path may reconstruct less delivery information than a newly started turn.

**Recommendation:** make artifact intent, mutation versions, verification receipts and delivery receipts durable session events. Rebuild them from persisted state on every controller change.

This needs a reproducing test before being labeled a confirmed user-visible bug.

### 4.3 Completion, delivery and final prose need a single projection

**Observed:**

- Foreground delivery is a distinct step.
- Server completion includes `keepDelivered()`.
- Some library retention work occurs before the final task update succeeds.
- Foreground return logic can prefer already accumulated assistant text over a completion result.

**Static risks:**

- A failed completion compare-and-set can leave retained outputs requiring reconciliation.
- Final prose can diverge from the server’s verified outcome.
- Foreground and background paths can produce different delivery behavior.

**Recommendation:** derive the final answer and artifact cards from authoritative completion and delivery receipts. Use idempotent delivery plus reconciliation; do not assume object storage and a database update form one atomic transaction.

### 4.4 The protocol is doing too many jobs

`src/jarvis/protocol.ts` contains action validation, tool definitions, capability mapping, prompt policy, application mention matching and completion-related logic.

Specific weaknesses:

- Model-facing schemas and runtime validation have overlapping representations.
- Prompt V2 construction removes literal English prefixes from another prompt.
- Application mentions resolve by display-name matching.
- Behavior limits and application-routing instructions are embedded in prose.

**Recommendation:** preserve one authoritative action schema and derive model schemas and transport contracts from it where practical. Separate prompt assembly from permission enforcement and tool execution.

Do not remove valid domain-specific checks merely because they are specialized.

### 4.5 Provider capability state should not be a tab-global boolean

In `src/jarvis/live-deps.ts`, web-search availability can become disabled after an unavailable result.

**Static risk:** a transient provider limitation can outlive the request or be represented too broadly.

**Recommendation:** capability snapshots keyed by provider, model, account entitlement and expiry. A transient failure should not silently redefine the capabilities of unrelated future requests.

### 4.6 Application identity is weaker than application discovery

OCADE already discovers installed applications and examines automation surfaces. However:

- UI mentions primarily use names.
- Permission heuristics include English application-name patterns.
- Recipe identity relies partly on display names and major versions.
- Discovery evidence does not prove that an integration works.

**Recommendation:** stable device-scoped application IDs, verified executable/package identity, capability evidence and explicit freshness.

### 4.7 Prompt-injection handling is too coarse in places

Foreground execution marks tool-derived information as untrusted and restricts certain subsequent actions. This is conservative and valuable, but a single broad taint flag can block legitimate work without explaining which information caused the restriction.

**Recommendation:** retain the restriction while moving toward explicit provenance:

- User-authored instruction.
- Retrieved content.
- Tool observation.
- Imported skill.
- Proposed memory.
- Approved action.

A retrieved document must never acquire authority to send, schedule, install, disclose credentials or modify permissions.

### 4.8 Existing auto-continuation must not become an integration default

The inspected source includes busy-retry timers, background continuation and existing scheduling infrastructure. `wrangler.json` contains a cron declaration.

These were inspected, not changed.

For this user’s policy:

- Quota-reset continuation must require manual initiation unless separately authorized.
- DeepSeek schedule packages must remain excluded.
- Goal drivers must not independently restart work.
- A runtime lease heartbeat during an already authorized active run is distinct from a future scheduled continuation, but neither should be repurposed to bypass the restriction.

### 4.9 DeepSeek’s “minimal SDK” is not a safe minimal integration

`packages/bundle/sdk-minimal/cordis.patch.yml` includes a `danger-full-access` sandbox-policy setting, local execution capabilities and a very long stream idle timeout.

Also, `packages/sdk/client/package.json` depends on the Harness CLI package.

**Decision:** do not import the SDK/default bundle as the OCADE integration boundary.

See the [SDK-minimal profile](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/bundle/sdk-minimal/cordis.patch.yml) and [SDK client manifest](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/sdk/client/package.json).

### 4.10 DeepSeek’s browser/PC packages are interfaces, not replacement drivers

These packages register exclusive named providers:

- `packages/browser-use/browser-use`
- `packages/computer-use/computer-use`

They do not, by themselves, supply a complete browser or native-PC implementation.

**Decision:** bind these concepts to OCADE’s existing drivers. Evaluate experimental alternate providers only when a measured capability gap justifies them.

---

## 5. File disposition terminology

The following decisions describe a future integration. They do **not** authorize changes now.

| Decision | Meaning |
|---|---|
| **KEEP** | Preserve an existing OCADE capability, or retain a required upstream dependency substantially unchanged. |
| **INTEGRATE** | Incorporate the useful upstream capability into the single OCADE engine, with boundary adaptations where needed. |
| **ADAPT** | Reuse selected algorithms, contracts or implementation patterns; replace product-specific assumptions. |
| **REPLACE** | Use OCADE’s authority/provider instead of the corresponding upstream implementation. |
| **REMOVE** | Retire superseded OCADE logic only after parity, rollback and acceptance tests pass. |
| **AVOID / EXCLUDE** | Do not include in the initial production dependency or execution graph. |
| **RETAIN AS TESTS/DOCS** | Keep as development evidence/reference, not shipped application behavior. |

**Exclusion means exclusion from the production composition—not deletion from the pinned submodule.**

---

## 6. DeepSeek integration inventory and counts

### 6.1 Practical integration envelope

The manifest analysis identified:

| Candidate scope | Packages | All files in those package directories | Files under `src/` |
|---|---:|---:|---:|
| Core dependency candidate | 33 | 491 | 145 |
| Additional selected capability candidates | 23 | 342 | 101 |
| Combined candidate envelope | **56** | **833** | **246** |

The combined envelope also contains 221 files classified as tests/fixtures by path patterns.

These numbers are **source inventory counts**, not:

- A measured production bundle.
- A claim that all 246 source files should ship.
- The complete transitive external dependency closure.
- A guarantee that the selected packages run unchanged in Cloudflare Workers.

The core closure follows declared workspace dependencies and non-optional peers, excluding development dependencies and optional peers. Build-time generation, package exports, optional features and external lockfile resolution still require validation.

Across the 357 inventoried manifests, the planning classification is:

| Primary package decision | Count |
|---|---:|
| KEEP | 8 |
| INTEGRATE | 7 |
| ADAPT | 41 |
| REPLACE with OCADE-owned boundary | 10 |
| RETAIN AS TESTS/DOCS | 7 |
| EXCLUDE from initial production composition | 284 |

### 6.2 Core package decisions

Counts below are **all files / `src/` files** at the pinned revision.

| Exact DeepSeek directory | Decision | Count | Reason |
|---|---|---:|---|
| `packages/core/agent-loop` | INTEGRATE | 43 / 7 | Ordered model/tool execution, interruption and lifecycle handling. |
| `packages/core/agent` | ADAPT | 22 / 8 | Agent contracts and dispatch; map ownership and model selection to OCADE. |
| `packages/core/session` | ADAPT | 37 / 10 | Event history, reconstruction and tool-history repair. |
| `packages/core/scope` | ADAPT | 10 / 2 | Run-scoped context and cancellation ownership. |
| `packages/core/system-prompt` | ADAPT | 11 / 1 | Structured prompt composition instead of string subtraction. |
| `packages/core/tools` | ADAPT | 30 / 10 | Tool registry/schema and execution hooks; OCADE remains final policy gate. |
| `packages/llm/llm` | ADAPT | 32 / 13 | Provider-neutral stream/message contracts. |
| `packages/llm/llm-retry` | ADAPT | 15 / 3 | Typed retry decisions within OCADE’s budget and manual-resume policy. |
| `packages/llm/token-meter` | ADAPT | 23 / 11 | Context budgeting and diagnostics, not billing authority. |
| `packages/session/session-persistence` | ADAPT | 13 / 5 | Persistence contract backed by OCADE’s database. |
| `packages/session/session-projection` | ADAPT | 10 / 2 | Rebuild UI and execution state from events. |
| `packages/session/session-checkpoint-policy` | INTEGRATE | 11 / 1 | Flush before model calls and effects. |
| `packages/session/working-directory` | ADAPT | 8 / 1 | Bind directory to approved device/workspace scope. |
| `packages/compaction/compaction` | INTEGRATE | 13 / 5 | Compaction contracts and tool-pair integrity. |
| `packages/compaction/compaction-basic` | INTEGRATE, later | 17 / 5 | Summaries after cheaper pruning proves insufficient. |
| `packages/compaction/compaction-tool-result-pruner` | INTEGRATE | 12 / 3 | Model-free result reduction. |
| `packages/compaction/compaction-image-offload` | INTEGRATE | 13 / 4 | Reduce repeated image context while retaining evidence references. |
| `packages/attachment/attachment` | ADAPT | 14 / 6 | Immutable attachment contract mapped to OCADE storage. |
| `packages/interaction/commands` | ADAPT | 11 / 3 | Human command registry, without installing the upstream UI. |
| `packages/interaction/user-approval` | ADAPT | 11 / 2 | Approval request representation; OCADE decides authority. |
| `packages/todo/tool-todo` | INTEGRATE | 14 / 3 | Durable structured progress; “done” still requires verification. |
| `packages/fs/fs` | ADAPT | 8 / 2 | Filesystem vocabulary over approved OCADE operations. |
| `packages/ptc-runtime/ptc-runtime` | ADAPT contract only | 9 / 2 | Preserve an extension boundary; do not enable code execution by default. |
| `packages/sandbox/sandbox` | ADAPT contract only | 13 / 4 | Represent confinement capabilities honestly. |
| `packages/sandbox/sandbox-policy` | ADAPT | 11 / 2 | Translate to OCADE policy; never inherit permissive defaults. |
| `packages/typert/protocol` | KEEP if required | 19 / 8 | Shared protocol types required by the selected graph. |
| `packages/util/brand` | KEEP if required | 7 / 1 | Typed identifiers. |
| `packages/util/values` | KEEP if required | 9 / 2 | Shared value/partial-JSON helpers. |
| `packages/util/crypto` | KEEP if required | 7 / 1 | Required utility layer. |
| `packages/util/timeout` | KEEP if required | 7 / 1 | Required timeout utility. |
| `vendor/cordis` | KEEP if framework integration proceeds | 14 / 9 | Plugin/service composition foundation. |
| `vendor/cosmokit` | KEEP if required | 11 / 7 | Cordis/Schemastery utility dependency. |
| `vendor/schemastery` | KEEP if required | 6 / 1 | Upstream configuration/schema dependency. |

### 6.3 Exact high-value core source files

All paths below are relative to the DeepSeek repository root.

#### Agent loop: seven source files

`packages/core/agent-loop/src/`:

- `agent.ts`
- `assistant-stream.ts`
- `constants.ts`
- `inbox.ts`
- `index.ts`
- `runtime-context.ts`
- `tool-calls.ts`

Use:

- `assistant-stream.ts` for coherent stream accumulation.
- `tool-calls.ts` for ordered scheduling, exclusive barriers and bounded safe concurrency.
- `inbox.ts` for user input arriving during execution.
- `agent.ts` as the execution-policy reference and integration source.
- `index.ts` only after adapting its host/lifecycle assumptions.

The inspected loop does not execute tool calls from error, aborted or max-token terminal outcomes. Preserve this invariant through OCADE’s provider adapter. See [the terminal handling in `agent.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/agent-loop/src/agent.ts#L504).

#### Agent contracts: eight source files

`packages/core/agent/src/`:

`archive-admission.ts`, `consumed-work.ts`, `dispatch.ts`, `index.ts`, `model-selection.ts`, `projection.ts`, `runtime-types.ts`, `types.ts`.

Adapt model selection, ownership, archive admission and consumed-work accounting to existing OCADE policies.

#### Session: ten source files

`packages/core/session/src/`:

`fork.ts`, `index.ts`, `known-event-types.ts`, `preparation.ts`, `repair.ts`, `request-header.ts`, `seq-ranges.ts`, `surface.ts`, `tool-history.ts`, `types.ts`.

Prioritize event representation, projections, repair and tool-call/result pairing. Session forking is optional; it must not automatically create autonomous child agents.

#### Tools: ten source files

`packages/core/tools/src/`:

`index.ts`, `json-schema.ts`, `presentation.ts`, `ptc-calls.ts`, `ptc.ts`, `py-types.ts`, `schema.ts`, `testing.ts`, `ts-types.ts`, `types.ts`.

Prioritize `schema.ts`, `json-schema.ts`, `types.ts`, `presentation.ts` and the relevant execution hooks in `index.ts`.

Keep `testing.ts` in development use. Defer PTC execution and generated Python/TypeScript SDK surfaces until they solve a demonstrated need.

The tool registry is substantial infrastructure, not a tiny wrapper. Avoid importing its entire execution surface merely to obtain schema conversion.

#### Model contract: thirteen source files

`packages/llm/llm/src/`:

`adapter-failure.ts`, `api-key.ts`, `assembler.ts`, `assistant-stream.ts`, `attribution.ts`, `brand.ts`, `call-config.ts`, `content.ts`, `error.ts`, `index.ts`, `message.ts`, `retry-policy.ts`, `types.ts`.

Reuse normalized messages, finish states, failures and stream assembly. Replace credential resolution with OCADE’s server-owned provider configuration.

#### Persistence and checkpoints

- `packages/session/session-persistence/src/errors.ts`
- `packages/session/session-persistence/src/handle.ts`
- `packages/session/session-persistence/src/index.ts`
- `packages/session/session-persistence/src/revision.ts`
- `packages/session/session-persistence/src/storage-contract.ts`
- `packages/session/session-projection/src/index.ts`
- `packages/session/session-projection/src/types.ts`
- `packages/session/session-checkpoint-policy/src/index.ts`

The checkpoint policy flushes before model dispatch and top-level tool execution. Nested tool calls still require OCADE’s own per-effect admission and receipt handling.

#### Context reduction

- `packages/compaction/compaction/src/{brand,checkpoint,index,tool-pairing,types}.ts`
- `packages/compaction/compaction-tool-result-pruner/src/{config,index,types}.ts`
- `packages/compaction/compaction-image-offload/src/{image-offload,index,project-message,projection}.ts`
- `packages/compaction/compaction-basic/src/{config,index,region,summarizer,types}.ts`

The brace notation identifies the exact named files, not an unrestricted directory-copy instruction.

---

## 7. Additional DeepSeek capabilities worth adapting

| Exact directory | Files / source | Practical use and boundary |
|---|---:|---|
| `packages/context/agent-instructions` | 15 / 6 | Load scoped instructions with provenance; do not let retrieved files override user authority. |
| `packages/context/session-reference` | 18 / 7 | Refer to previous work without injecting whole transcripts. Enforce account/project access. |
| `packages/context/time-context` | 17 / 3 | Accurate time and elapsed-work context; not a scheduler. |
| `packages/guard/timeout-policy` | 9 / 1 | Cooperative tool deadlines; combine with device-level cancellation. |
| `packages/guard/repeat-tool-reminder` | 9 / 1 | Advisory loop detection; keep OCADE hard admission limits. |
| `packages/plan/plan-mode` | 13 / 3 | Durable plan-mode interaction; enforce read-only separately. |
| `packages/interaction/tool-ask-user` | 10 / 2 | Structured clarification requests. Disable timeout-as-consent behavior. |
| `packages/interaction/user-questions` | 14 / 4 | Durable pending questions and answers. |
| `packages/skill/skill` | 9 / 1 | Discoverable, bounded skill registry. |
| `packages/skill/skill-filesystem` | 10 / 1 | Approved skill-file loading, without arbitrary installation. |
| `packages/skill/tool-skill` | 9 / 1 | Load only relevant skill context. |
| `packages/fs/fs-observation-policy` | 10 / 2 | Read-before-edit and version checks. |
| `packages/spill/spill` | 8 / 2 | Recoverable references for large results. |
| `packages/spill/spill-policy` | 16 / 4 | Output retention budgets and retrieval notices. |
| `packages/mcp/mcp-client` | 26 / 5 | Approved connector transport and tool registration. |
| `packages/mcp/mcp-resources` | 11 / 3 | Resource discovery and bounded reading. |
| `packages/jobs/jobs` | 12 / 5 | Long-running active-job status and cancellation; not recurring automation. |
| `packages/deliverables/tool-present` | 11 / 2 | Explicit artifact declarations, subject to independent validation. |
| `packages/deliverables/workspace-changes` | 24 / 8 | Change capture and comparison for coding/file workflows. |
| `packages/host/open-in-app` | 18 / 6 | Verified launcher resolution and icon-extraction patterns. |
| `packages/client/ui-input-trigger` | 27 / 14 | `@` detection and keyboard-menu behavior. |
| `packages/client/ui-reference` | 16 / 5 | Structured reference rendering patterns. |
| `packages/client/ui-open-in-app` | 30 / 15 | File/application actions and graceful launch failure UI. |

### Exact files to prioritize

**Instruction/context loading**

- `packages/context/agent-instructions/src/{config,digest,files,index,render,state}.ts`
- `packages/context/session-reference/src/{config,index,projection,serialization,spill,types,uri}.ts`
- `packages/context/time-context/src/{index,request-zone,timestamp}.ts`

**Planning and questions**

- `packages/plan/plan-mode/src/{client,index,types}.ts`
- `packages/todo/tool-todo/src/{client,index,types}.ts`
- `packages/interaction/user-questions/src/{index,projection,timed-wait,types}.ts`
- `packages/interaction/tool-ask-user/src/{index,timed}.ts`

Timed question utilities are optional. An expired approval must deny or remain unanswered, never imply permission.

**MCP**

- `packages/mcp/mcp-client/src/{connection,index,server-context,tools,transport}.ts`
- `packages/mcp/mcp-resources/src/{index,render,tools}.ts`

**Artifacts and changes**

- `packages/deliverables/tool-present/src/{index,types}.ts`
- `packages/deliverables/workspace-changes/src/{capture,compare,git,index,numstat,paths,recorder,types}.ts`

**Important limitation:** plan mode is guidance in the upstream implementation; its README explicitly says tools remain available. OCADE must enforce read-only at admission, not infer safety from the presence of a plan-mode flag. See [plan-mode documentation](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/plan/plan-mode/README.md).

---

## 8. DeepSeek components to replace with OCADE boundaries

| Exact upstream directory | Decision | OCADE replacement |
|---|---|---|
| `packages/browser-use/browser-use` | Replace provider implementation | Existing authenticated OCADE browser actions. |
| `packages/computer-use/computer-use` | Replace provider implementation | Existing Device Agent and computer/accessibility actions. |
| `packages/credentials/credentials` | Replace secret-provider implementation | OCADE server-held credentials and approved references. |
| `packages/credentials/authorization` | Replace authorization authority | Existing authenticated account/approval flows. |
| `packages/session/session-persistence-jsonl` | Replace production storage | Supabase-backed canonical session/event state. JSONL may remain a development export. |
| `packages/settings/settings` | Replace product settings store | Existing OCADE preferences and server policy. |
| `packages/storage/storage` | Replace storage authority | Existing OCADE storage architecture. |
| `packages/storage/storage-domain` | Adapt concepts only | OCADE-owned schema and transactional updates. |
| `packages/storage/storage-json` | Exclude production backend | No competing local settings/task database. |
| `packages/storage/storage-sqlite` | Exclude production backend | No second canonical session/task store. |

Do not let a Cordis service registration bypass an OCADE permission merely because its implementation is available.

---

## 9. What to avoid, and what can be reconsidered later

### 9.1 Exclude from the initial application

| Exact path or family | Reason |
|---|---|
| `apps/cli/` | Unneeded second product entry point and lifecycle. |
| `apps/desktop/`, `apps/desktop-host/` | Do not add an Electron application beside OCADE’s web UI and Device Agent. |
| `apps/web/` | Do not replace OCADE’s application shell. |
| `apps/plugin-market-generator/` | No marketplace generation requirement. |
| `packages/bundle/` | Broad defaults bring unwanted providers, stores and execution capabilities. |
| `packages/sdk/client/`, `packages/sdk/server/`, `packages/sdk/protocol/` | Avoid the CLI/subprocess SDK route as the default integration. Retain protocol docs only if needed later. |
| `packages/boot/plugin-manager/`, `packages/boot/plugin-market/`, `packages/boot/hmr/` | Arbitrary installation, dynamic configuration and hot reload are not needed in the production agent. |
| `packages/extensions/` | Model-mounted dynamic plugins materially expand the execution surface. |
| `packages/schedule/` | Recurring or timed continuation is outside the default authorization policy. |
| `packages/goal/goal-round-driver/` | Avoid autonomous goal continuation outside a manually authorized run. |
| `packages/credentials/credentials-local/` | Do not introduce local provider-key files. |
| `packages/credentials/deepseek-account/`, `packages/credentials/deepseek-account-platform/` | No silent second account system. |
| `packages/identity/anonymous-user-id/`, `packages/host/product-telemetry-otel/`, `packages/telemetry/` | No new outbound telemetry by default. |
| `packages/session/session-telemetry/`, `packages/session/session-telemetry-otel/` | Do not export user session content without explicit product/privacy design. |
| `packages/subagent/subagent-claude-code/`, `packages/subagent/subagent-codex/`, `packages/subagent/subagent-dsh-sdk/`, `packages/subagent/subagent-acp/` | Extra accounts, subprocesses, costs and agent authorities. |
| `packages/shell/*-local/`, `packages/shell/tool-*-persistent/`, `packages/terminal/` | Duplicate shell execution beside OCADE’s controlled device route. |
| `packages/ssh/` | Adds remote execution and credential scope without a current requirement. |
| `packages/host/webserver/`, `packages/api/` | Do not transplant upstream authentication, BFF and host-server topology. |
| Most of `packages/client/` | Avoid wholesale UI-framework migration, skins, localization infrastructure and duplicate state. |
| `.agents/`, `.claude/`, `website/` | Development history, configuration and marketing content are not production capabilities. |
| `python/`, `native/` | Do not bundle whole runtimes/native build trees without a selected feature requiring them. |
| Broad `scripts/` and CI configuration | Reference only. Do not execute upstream install/build scripts during intake. |

### 9.2 Useful later, but gated by evidence

| Capability | Exact paths | Admission condition |
|---|---|---|
| Coding intelligence | `packages/lsp/lsp/`, `packages/lsp/lsp-stdio/`, `packages/lsp/tool-lsp/` | Coding benchmarks show a gap that semantic navigation fixes. Server processes are approved and scoped. |
| Programmatic orchestration | `packages/workflow/workflow/`, `packages/workflow/workflow-ptc/`, `packages/workflow/tool-workflow/` | Repeated workflows justify it; every nested effect still passes OCADE admission. |
| Programmatic tool calling | `packages/ptc-runtime/ptc-runtime-node/` | Proven reduction in calls/latency without weaker cancellation, isolation or auditing. |
| Native process sandbox improvements | `packages/sandbox/sandbox-local/`, `packages/sandbox/sandbox-windows-acl/` | Per-OS functional confinement tests pass. Do not assume an interface equals a working sandbox. |
| Process lifecycle primitives | `packages/subprocess/subprocess/`, `packages/subprocess/subprocess-local/`, `packages/subprocess/win32-process/` | A specific OCADE process-tree termination gap justifies reuse. |
| Additional search providers | `packages/web/web/`, `packages/web/tool-web/`, `packages/web/web-fetch-http/`, `packages/web/web-search-exa/`, `packages/web/web-search-perplexity/` | Existing research routing is insufficient; credentials, cost and SSRF controls are reviewed. |
| DeepSeek inference | `packages/llm/llm-deepseek/` and provider-auth packages | Explicit model/provider decision, entitlement, secrets, privacy and cost review. |
| Office rendering | `packages/document/office-to-pdf/`, `packages/skill/skill-office/` | Better render fidelity than existing OCADE workflows on matched files. |
| Internal parallel agents | `packages/subagent/subagent/`, `packages/subagent/subagent-fork-in-process/`, `packages/subagent/subagent-spawn-in-process/` | Read-only independent subtasks improve performance; parent owns budget and STOP. No autonomous delegation default. |
| Session search | `packages/session-query/` | A demonstrated retrieval need exceeds existing indexed database queries. |

This is how to maximize practical reuse: retain access to the complete pinned source, but admit capabilities individually when their benefit exceeds their dependency and operational cost.

---

## 10. Dependency plan

### 10.1 Compatibility facts

| Area | OCADE | DeepSeek snapshot | Decision |
|---|---|---|---|
| Node engines | `>=22.23.2 <25` | `^22.19.0 || >=24.0.0` | Node 24 is a common supported line; validate actual build tooling. |
| Package manager | npm range `>=10.9.8 <12` | `pnpm@11.28.5` | Do not convert the entire OCADE repository to pnpm merely for integration. |
| Zod | `^3.24.2` | Selected packages use `4.4.3` / `^4.4.3` | Keep an adapter boundary; avoid an unrelated root-wide Zod migration. |
| Plugin framework | Existing OCADE modules | Cordis/Schemastery | Admit only if runtime compatibility and maintenance savings justify it. |
| Browser execution | Existing Python/browser bridge | Optional Playwright/DevTools/Stagehand providers | Keep one active controller per resource. |
| Native execution | Existing Device Agent | Optional native/subprocess/sandbox packages | No duplicate executor by default. |

### 10.2 Selected-core external dependencies

The 33-package manifest closure exposes these external runtime/non-optional-peer names:

- `zod`
- `@standard-schema/spec`

This does **not** mean the integration is “only two dependencies.” It also contains the workspace packages listed earlier, their build requirements and any additional packages activated by feature choices.

Preserve the pinned dependency resolution and inspect the final production graph before approving it.

### 10.3 Optional dependencies that materially expand scope

| Dependency at inspected manifest version | Introduced by | Decision |
|---|---|---|
| `@modelcontextprotocol/client@2.2.0` | MCP client | Reasonable optional addition for approved connectors. |
| `@playwright/mcp@0.0.80` | Experimental Playwright provider | Avoid duplicate browser stack initially. |
| `chrome-devtools-mcp@1.9.0` | Experimental DevTools provider | Optional specialized adapter only. |
| `@browserbasehq/stagehand@4.1.0` | Stagehand native provider | Evaluate only against a concrete browser gap. |
| `@puppeteer/browsers@3.2.2` | Stagehand provider | Browser distribution/runtime cost; avoid by default. |
| `@trycua/cua-driver@0.28.0` | Experimental native computer provider | Do not replace OCADE control without matched evidence. |
| `@earendil-works/pi-ai@^1.1.0` | `llm-pi-ai` | Existing model adapters should remain first choice. |
| `@deepseek-ai/libreoffice-kit@^0.1.5` | Office skill | Adds licensing and binary-distribution considerations. |
| Electron/native PTY/FFI dependencies | Desktop/terminal/native families | Exclude unless a selected feature requires them. |

### 10.4 Upstream patches

The snapshot contains these eight patch files:

- `patches/@earendil-works__pi-ai@1.1.0.patch`
- `patches/@electron__osx-sign@1.3.3.patch`
- `patches/@fortune-sheet__core@1.0.4.patch`
- `patches/@fortune-sheet__react@1.0.4.patch`
- `patches/@yao-pkg__pkg@6.21.0.patch`
- `patches/app-builder-lib@26.17.0.patch`
- `patches/exceljs@4.4.0.patch`
- `patches/node-pty@1.2.0-beta.15.patch`

**Rule:** carry a patch only when its dependency is selected, and verify the patched behavior. Do not silently drop a required patch or copy all eight into OCADE.

### 10.5 Cloudflare runtime constraint

The selected source graph still includes Node-oriented imports, including:

- `node:async_hooks`
- `node:module`
- `node:path`
- Filesystem-related sandbox diagnostics.
- Host-specific lifecycle assumptions.

Cloudflare’s Node compatibility is partial, and some modules are stubs. Successful import or TypeScript compilation does not prove execution compatibility. [Cloudflare Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)

**Architecture decision:** keep the web/control plane on the existing Cloudflare deployment and native execution in the existing Device Agent.

First validate the selected engine in the actual Worker runtime. If the upstream class lifecycle cannot be cleanly adapted:

1. Reuse its portable scheduling, stream and event logic through a narrow derived engine.
2. Retain upstream tests and attribution.
3. Do not add a new Node service merely to avoid understanding the boundary.

A separate runner service is a later architectural option, not a hidden prerequisite.

---

## 11. Proposed architecture

```text
OCADE chat / bubble / task UI
        │
        │ authenticated user intent + selected references
        ▼
OCADE run controller
  task ownership · permission scope · budget · cancellation epoch
        │
        ▼
One agent turn engine
  DeepSeek-derived loop · planning · inbox · context budgeting
        │
        ├── Model adapter → existing OCADE provider/permit system
        │
        ├── Session adapter → canonical Supabase events/projections
        │
        └── Tool broker
              schema → provenance → policy → admission → execution
                    │
                    ├── approved connector/MCP tools
                    ├── bounded server research tools
                    └── authenticated Device Agent
                          browser · accessibility · files · documents
                          sheets · media · approved application automation
                    │
                    ▼
              immutable action receipts
                    │
                    ▼
Independent verification → delivery receipts → final task projection
```

### 11.1 One agent does not mean one giant module

The agent should have one authority chain, while retaining replaceable components.

The model may propose actions. It must not decide:

- Whether a permission exists.
- Whether a stale controller still owns a task.
- Whether a device is trusted.
- Whether a side effect actually happened.
- Whether an artifact satisfies the task.
- Whether a stopped task should resume.
- Whether another paid provider may be used.

### 11.2 Proposed run identity

Every effect should be associated with:

- Account/user ID.
- Conversation ID.
- Task ID.
- Run ID.
- Controller/lease identity.
- Permission revision or cancellation epoch.
- Tool call ID.
- Device/resource identity.
- Idempotency key.
- Input and relevant artifact version.
- Admission decision.
- Result/verification receipt.

These are proposed fields and relationships, not a statement that this complete schema already exists.

### 11.3 Durable event model

Useful event categories:

- User instruction accepted.
- Plan proposed or changed.
- Model request admitted.
- Model attempt failed/interrupted.
- Model turn completed.
- Tool call proposed.
- Permission requested/decided.
- Tool call admitted.
- Tool execution started.
- Tool execution completed/failed/unknown.
- Observation invalidated.
- Artifact verified.
- Artifact delivered.
- Task paused/stopped/completed.

Use one canonical history with derived projections. Avoid maintaining independent “truth” in browser state, JSONL, SQLite and Supabase.

### 11.4 Bounded server execution

The upstream loop is not automatically a drop-in durable Worker workflow.

The OCADE adaptation needs explicit suspension boundaries:

1. Load the current run projection.
2. Acquire/check ownership.
3. Admit a bounded model or tool-planning step.
4. Persist the decision.
5. Queue an authorized device action.
6. Suspend while awaiting its receipt.
7. Continue only while the manually authorized run remains active.

The existing device continuation route is a useful transport seam. It should not retain a separate planning policy.

No cron or timed quota-reset wakeup is required for this design.

---

## 12. Exact OCADE wiring points

| Concern | Existing entry point | Future wiring |
|---|---|---|
| Main chat submission | `src/jarvis/JarvisWorkspace.tsx` → `runJarvisTurn()` | Submit user intent and subscribe to the shared run projection. |
| Bubble execution | `src/jarvis/JarvisBubble.tsx` → `runJarvisTurn()` | Use the same controller/engine contract as the main workspace. |
| Foreground engine | `src/jarvis/agent.ts:478` | Compatibility façade during migration, then shared engine driver. |
| Background engine | `src/jarvis/background.server.ts:135` | Replace duplicated planning with the same turn engine. |
| Device continuation HTTP | `src/routes/api/jarvis/continue.ts` | Preserve device authentication; dispatch into shared engine. |
| Provider/model call | `src/jarvis/live-deps.ts`, `src/jarvis/background-model.server.ts` | Implement the normalized model adapter; retain permits, settlement and provider policies. |
| Action validation | `src/jarvis/protocol.ts` | Feed canonical schemas into the tool registry. |
| Queue admission | `src/jarvis/task-authority.server.ts`, `queueTaskAction()` | Mandatory final gate for every device effect. |
| Task transition | `src/jarvis/task-authority.server.ts`, `changeTask()` | Remain authoritative; consume verification receipts. |
| Device exchange | `src/jarvis/device.server.ts` | Carry run/controller identity, cancellation and result acknowledgements. |
| Local execution | `jarvis-runtime/ocade_device.py` | Preserve journals and execution gate; attach shared tool identity. |
| App discovery | `jarvis-runtime/ocade_computer.py`, `jarvis-runtime/ocade_discovery.py` | Publish stable application/capability records. |
| `@` resolution | `src/jarvis/protocol.ts`, `mentionedApp()`; workspace composer | Replace name-only resolution with structured selected references. |
| Memory read/write | `src/jarvis/jarvis.functions.ts`, `rememberJarvis()` / `forgetJarvis()` | Add provenance, retrieval scope and explicit user-intent handling. |
| Global STOP | `src/jarvis/stop-everywhere.ts` | Cancel model, engine, jobs and device work through the same run identity. |
| Artifact UI | `src/jarvis/JarvisTask.tsx`, `src/jarvis/JarvisPanels.tsx` | Render verified outputs and delivery status from receipts. |

### New modules: planning estimate

A reasonable first implementation would introduce approximately **8–12 focused modules**, covering:

- Engine adapter/driver.
- Session persistence/projection adapter.
- Model adapter.
- Tool registration/broker adapter.
- Verification/delivery projection.
- Application catalog contract.
- Mention reference model.
- Context/provenance handling.

This is an estimate of OCADE-owned integration surfaces, not a commitment to a particular folder layout.

Avoid creating one wrapper file for every upstream package.

---

## 13. Planning, model selection, sessions and memory

### 13.1 Planning

Use structured plans with:

- Desired outcome.
- Current step.
- Dependencies.
- Required resources.
- Completion evidence.
- Known blockers.
- Budget/stop conditions.

DeepSeek todo and plan-mode components can supply the state representation and interaction. OCADE should own the meaning of successful completion.

A plan step marked complete by the model is a progress assertion. A verification receipt is evidence.

### 13.2 Model selection

Preserve existing OCADE routes.

Select models using an explicit capability record:

- Text/tool support.
- Image support.
- Context limit.
- Available research tools.
- Structured-output reliability.
- Latency and cost policy.
- Account availability.
- Consent/entitlement.
- Current temporary failure state.

Use a stronger model when a task requires it, not on every step. Use deterministic tools for calculations, parsing and validation.

Do not add silent provider fallback, key rotation or extra spending to make benchmark runs succeed.

### 13.3 Session recovery

Persist enough information to recover without repeating completed work:

- Full admitted tool calls and receipts.
- Incomplete model attempts.
- Current plan.
- Artifact versions.
- Verification invalidations.
- Pending question/approval.
- Last controller and cancellation revision.
- Delivery state.

On recovery:

1. Reconcile pending device outcomes.
2. Treat unknown outcomes as unknown.
3. Refresh stale observations.
4. Rebuild the projection.
5. Ask for manual continuation when policy requires it.
6. Never replay an external mutation solely because its receipt was lost.

Exactly-once execution cannot be assumed across arbitrary external applications. Idempotency plus reconciliation is the practical design.

### 13.4 Memory

DeepSeek’s session history, context loading and retrieval primitives are useful. They do not automatically provide a trustworthy product memory system.

OCADE should distinguish:

| Memory type | Storage/use |
|---|---|
| Current run state | Durable task/session events. |
| User preferences | Explicitly saved, editable account memory. |
| Project knowledge | Scoped sources with provenance and refresh information. |
| Learned application recipes | Versioned, tested procedures with success/failure evidence. |
| Retrieved external content | Untrusted reference material, not persistent instruction authority. |

For `rememberJarvis()`:

- Retain the memory permission.
- Require appropriate user intent.
- Record source and scope.
- Prevent secrets and webpage instructions from becoming preferences.
- Support correction/deletion.
- Retrieve relevant bounded entries instead of sending every memory on every request.

---

## 14. Browser, PC control and tool execution

### 14.1 Preferred execution order

For each task, choose the most reliable available route:

1. Approved service API or connector.
2. Document/file-format API.
3. Application scripting or automation API.
4. Accessibility tree.
5. DOM/browser semantic action.
6. Screenshot/coordinate interaction.

This is a capability policy, not an absolute rule. The user’s requested application or browser must be respected.

### 14.2 One controller per shared resource

A mouse, keyboard, browser tab or application document should have one mutation owner at a time.

DeepSeek’s `tool-calls.ts` offers useful scheduling behavior:

- Parallel execution only for tools explicitly classified concurrency-safe.
- Exclusive barriers.
- Ordered preparation/results.
- Cancellation that stops admitting new work and drains started work.

OCADE should classify:

| Tool category | Concurrency |
|---|---|
| Independent read-only searches | Bounded parallelism. |
| Reads of independent immutable files | Bounded parallelism. |
| Reads and writes to the same artifact | Serialized or version-checked. |
| Mouse/keyboard/window actions | Serialized per device/desktop. |
| Same browser tab mutations | Serialized. |
| External sends/purchases/deletions | Explicit authority and serialized admission. |

A tool’s declaration of safety is not sufficient when arguments target the same resource.

### 14.3 STOP and timeouts

The upstream timeout policy is cooperative. It supplies an abort signal and waits for tool settlement; it is not a universal process killer.

OCADE must retain:

- Local cancellation gate.
- Process-tree termination where applicable.
- Browser action interruption.
- No new queued work after STOP.
- Server-side transition guard.
- Honest “stop not confirmed” UI when a device is unreachable.

Cancellation of a promise does not prove the operating system or external application has stopped.

### 14.4 Programmatic tool calling

PTC can reduce model round trips for known multi-step operations. It can also hide effects inside one outer call.

If enabled later:

- Every nested effect must pass the same broker.
- Each effect needs its own identity and receipt.
- Cancellation must reach the inner runtime.
- Resource scope and output limits must be enforced.
- No direct access to provider credentials or unrestricted subprocesses.
- The model cannot use PTC to bypass a denied ordinary tool.

Start with OCADE’s existing bounded sequences before adding a general code-execution runtime.

---

## 15. Dynamic application detection and `@` app icons

### 15.1 What already exists

OCADE’s discovery code inspects installed applications and potential integration surfaces, including Windows registration/COM information and application documentation.

That is valuable existing capability. It should be extended, not replaced by a hardcoded app list.

### 15.2 What DeepSeek contributes

Exact source:

- `packages/host/open-in-app/src/catalog.ts`
- `packages/host/open-in-app/src/resolver.ts`
- `packages/host/open-in-app/src/icons.ts`
- `packages/host/open-in-app/src/index.ts`
- `packages/host/open-in-app/src/internals.ts`
- `packages/host/open-in-app/src/shared.ts`

Useful mechanics:

- Resolve a real launcher rather than trusting an installation record.
- Use argument arrays instead of shell-string construction.
- Scrub sensitive inherited environment values.
- Detect early launch failure.
- Invalidate stale resolution after missing-executable errors.
- Extract icons from resolved application artifacts.
- Provide a generic fallback when icon extraction fails.

However, `catalog.ts` is a compile-time catalog of named applications. **Do not use it as OCADE’s master application inventory.** See [the catalog](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/host/open-in-app/src/catalog.ts) and [resolver](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/host/open-in-app/src/resolver.ts).

### 15.3 Proposed application record

Each discovered application should have:

- Device-scoped stable ID.
- Display name and aliases.
- Platform.
- Executable/package/bundle identity.
- Version and identity fingerprint.
- Installation/launch availability.
- Icon reference.
- Supported file types/protocols.
- Candidate automation surfaces.
- Tested capabilities and last verification time.
- Permission state.
- Discovery provenance and expiry.

Distinguish clearly:

- **Installed**
- **Launchable**
- **Automation surface discovered**
- **Automation successfully tested**
- **Authorized for this task**

These states are not interchangeable.

### 15.4 Mention picker

Adapt:

- `packages/client/ui-input-trigger/src/core/contract.ts`
- `packages/client/ui-input-trigger/src/core/detect.ts`
- `packages/client/ui-input-trigger/src/core/menu.ts`
- Relevant keyboard/controller behavior from `src/client/controller.ts`
- Rendering concepts from `packages/client/ui-reference/src/client/user-text-rules.ts`

The existing upstream reference UI focuses on file/session references. Native-app mentions require OCADE-specific records.

When a user selects an application:

- Store a structured reference containing application ID and device ID.
- Render its label and icon.
- Preserve the reference across edits/reloads.
- Revalidate availability before execution.
- Do not convert selection into permission.
- Do not resolve by display name if multiple installations match.

Free-text `@name` can remain a compatibility input, but ambiguous matches should produce a choice.

### 15.5 Icon handling

- Extract icons locally from resolved application metadata.
- Cache by application identity/version.
- Bound image dimensions and byte size.
- Sanitize or rasterize untrusted SVG.
- Do not accept arbitrary icon URLs that create an SSRF or tracking channel.
- Do not expose executable paths to other accounts.
- Use a neutral fallback glyph.

Preserve OCADE’s zero-chroma appearance. Use monochrome presentation or neutral app glyphs with clear names; do not invent altered brand marks where branding terms prohibit modification.

### 15.6 Learned recipes

Extend `jarvis-runtime/ocade_discovery.py` so recipes are keyed by application identity and tested capability, not merely display name.

Each recipe should include:

- Version range.
- Preconditions.
- Resource scope.
- Steps.
- Expected outputs.
- Verification procedure.
- Failure history.
- Quarantine status.

A failed recipe must not loop indefinitely. Discovery documentation and webpage instructions remain untrusted inputs.

---

## 16. Gemini-style chat UI while preserving OCADE colors

Borrow interaction quality, not Google branding.

### Preserve

- `src/shared/ui/tokens/monochrome.css`
- Semantic tokens in `src/styles.css`
- Existing typography.
- Existing light/dark behavior.
- `scripts/check-monochrome.mjs`

### Improve

1. **Composer**
   - Multiline input.
   - Structured app/file references.
   - Attachment previews.
   - Clear selected device/model.
   - Keyboard-accessible mention menu.
   - Draft preservation during busy states.

2. **Conversation**
   - Rich Markdown, tables, code and citations.
   - Stable streaming without scroll jumps.
   - Distinguish current activity from completed work.
   - Allow the user to scroll away without being forced back.

3. **Task presentation**
   - Compact plan with current step.
   - Expandable tool/evidence details.
   - Separate permission request from progress narration.
   - Clear blocker and continuation controls.

4. **Artifact panel**
   - Preview/open/download.
   - Verification status and timestamp.
   - Delivery status.
   - Source task and artifact version.
   - Editable/native project files where requested.

5. **Control**
   - Persistent STOP.
   - Visible device/resource being controlled.
   - Pause/takeover.
   - No “completed” animation before authoritative completion.

Useful references include:

- `packages/client/ui-chat/src/client/chat/use-scroll-follow.ts`
- `packages/client/ui-chat/src/client/chat/use-chat-scroll.ts`
- `packages/client/ui-input-trigger/`
- `packages/client/ui-deliverables/`

Do not import the complete upstream chat client to obtain a few interaction patterns.

---

## 17. Security and verification requirements

### 17.1 Permission enforcement

Admission should combine:

- Authenticated user identity.
- Account/device ownership.
- Task scope.
- Resource scope.
- Current permission revision.
- Action risk.
- Explicit approval where required.
- Current run status.
- Cancellation state.

Check at both server admission and device execution. Permissions can change after a model proposes an action.

Upstream approval hooks are useful interaction mechanisms; they do not replace OCADE’s policy authority.

### 17.2 Supabase

Keep canonical state in OCADE’s database and use ownership-aware authorization for task/session projections.

Required future checks:

- RLS for account/task ownership.
- Private realtime channels where used.
- No service-role key in browser/device payloads.
- Atomic admission and status transitions.
- Idempotency constraints.
- Reconciliation of delivery and task status.
- Retention and deletion behavior for observations and attachments.

Supabase’s realtime authorization model should be applied to any new event subscriptions. [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)

### 17.3 STOP acceptance semantics

Represent at least:

- Stop requested.
- Server has fenced further admission.
- Local/device cancellation requested.
- In-flight work confirmed ended.
- Confirmation unavailable.

A stale worker must not:

- Queue another action.
- Complete a stopped task.
- Charge a stopped/invalid completion.
- Resume after quota recovery.
- Reuse a previous approval for changed arguments.

### 17.4 Verification contract

The independent verifier should evaluate the requested outcome, not just tool success.

| Task type | Minimum evidence |
|---|---|
| Research | Complete provider turn, valid sources, claim/source consistency. |
| File editing | Fresh read of changed content; relevant tests or semantic checks. |
| Spreadsheet | Explicit populated-row counts, expected data/formulas, reopened workbook, error checks. |
| Document | Requested content and structure; render/reopen evidence when layout matters. |
| Presentation | Slide count/content plus rendered review. |
| Video | Duration, streams, captions, audio constraints, playback/render evidence and project file if requested. |
| CAD/design | Geometry or domain-specific oracle, not existence of a file. |
| Browser workflow | Observable target state or transaction receipt. |
| External send | Authorized recipient/content plus service confirmation. |
| Delivery | Accessible output matching the verified version/hash. |

Keep the existing `filledRows` requirement. Formatting 2,000 rows is not evidence of 2,000 populated rows.

Verification evidence must be invalidated when relevant files or parent directories change, or when an opaque command could have changed them.

---

## 18. OCADE code to remove only after replacement is proven

| Exact file/symbol | Future removal or simplification |
|---|---|
| `src/jarvis/agent.ts` bespoke orchestration loop | Replace with shared engine after foreground parity. Keep façade during migration. |
| `src/jarvis/background.server.ts` independent planner | Replace with shared engine; retain authenticated continuation lifecycle. |
| `src/jarvis/agent.ts` in-memory-only delivery reconstruction | Replace with durable artifact/delivery projection. |
| `src/jarvis/agent.ts` `pseudoCall()` compatibility execution | Deprecate after all active providers reliably emit structured calls. Never remove fallback without provider coverage. |
| `src/jarvis/protocol.ts` literal-prefix prompt filtering | Replace with explicit prompt sections. |
| `src/jarvis/protocol.ts` duplicated model tool schema | Derive from canonical schema where representation permits. |
| `src/jarvis/protocol.ts` `mentionedApp()` as primary identity resolution | Replace with structured references; retain conservative text fallback. |
| `src/jarvis/permissions.ts` name-only powerful-app heuristics | Replace primary decision with verified identity/capability metadata; retain conservative fallback until coverage is proven. |
| `src/jarvis/live-deps.ts` broad web-search availability state | Replace with scoped capability cache. |
| `src/jarvis/JarvisWorkspace.tsx` mixed orchestration/UI ownership | Move run control into the shared controller; retain presentation and user-input state. |
| Duplicated foreground/background limits | Replace with one typed policy budget, preserving distinct units. |

Do **not** remove:

- Existing verification checks.
- Python runtime modules merely because they are large.
- Historical migrations.
- Regression tests that document prior failures.
- Provider settlement safeguards.
- Existing domain-specific document/media checks.

The `no-donor-runtime.test.ts` restriction concerns retired donor material. The current intake documentation explicitly distinguishes the newly pinned DeepSeek source. Preserve that distinction rather than weakening the old safeguard broadly.

---

## 19. Tests and documentation to retain

### 19.1 DeepSeek test-support packages

| Exact directory | Total files | Use |
|---|---:|---|
| `packages/test-support/agent-loop-testkit` | 9 | Loop/inbox contract tests. |
| `packages/test-support/llm-mock-server` | 11 | SSE faults, truncation and provider recovery. |
| `packages/test-support/llm-replay` | 9 | Keyless deterministic replay. |
| `packages/test-support/session-snapshot` | 112 | Session invariants and recovery fixtures. |
| `packages/test-support/remote-mock` | 16 | Transport/event contract tests. |
| `packages/test-support/client-runtime` | 37 | Relevant UI interaction tests only. |
| `packages/test-support/loader-smoke` | 16 | Use only if retaining the corresponding loader composition. |

Do not carry all test infrastructure into production bundles.

### 19.2 Particularly valuable exact tests

- `packages/core/agent-loop/tests/cancel.spec.ts`
- `packages/core/agent-loop/tests/resume.spec.ts`
- `packages/core/agent-loop/tests/request-error.spec.ts`
- `packages/core/agent-loop/tests/request-reconstruction.spec.ts`
- `packages/core/agent-loop/tests/request-freeze.spec.ts`
- `packages/core/agent-loop/tests/tool-calls.spec.ts`
- `packages/core/agent-loop/tests/tool-order.spec.ts`
- `packages/core/agent-loop/tests/shutdown-drain.spec.ts`
- `packages/core/agent-loop/tests/resource-lifecycle.spec.ts`
- `packages/core/agent-loop/tests/system-prompt-admission.spec.ts`
- `packages/session/session-checkpoint-policy/tests/crash-recovery.e2e.ts`
- `packages/session/session-checkpoint-policy/tests/session-checkpoint-policy.spec.ts`
- `packages/host/open-in-app/tests/resolver.spec.ts`
- `packages/host/open-in-app/tests/icons.spec.ts`
- `packages/host/open-in-app/tests/launch-detached.spec.ts`
- `packages/host/open-in-app/tests/host-routes.spec.ts`

Adapt tests to OCADE semantics; do not count upstream test presence as a passing OCADE test run.

### 19.3 OCADE regression suites to preserve

- `src/jarvis/__tests__/agent.test.ts`
- `src/jarvis/__tests__/carry-on.test.ts`
- `src/jarvis/__tests__/execution-controls.test.ts`
- `src/jarvis/__tests__/device-exchange.test.ts`
- `src/jarvis/__tests__/device-protocol.test.ts`
- `src/jarvis/__tests__/live-control.test.ts`
- `src/jarvis/__tests__/jarvis-schema-against-postgres.test.ts`
- `src/lib/commercial/__tests__/jarvis-task-is-one-use.test.ts`
- `jarvis-runtime/tests/test_safety.py`
- `jarvis-runtime/tests/test_discovery.py`
- `jarvis-runtime/tests/test_existing_browser.py`
- `jarvis-runtime/tests/test_independent_reopen.py`
- `jarvis-runtime/tests/test_files_documents.py`
- `jarvis-runtime/tests/test_sheets.py`

### 19.4 Documentation disposition

KEEP:

- `LICENSE`
- `SAFETY.md`
- `THIRD_PARTY_NOTICES.md`
- Relevant package READMEs.
- Relevant subsystem design documentation.
- Provenance of copied/adapted code and patches.

RETAIN AS REFERENCE:

- `BENCHMARK.md`
- Relevant `benchmarks/`
- Selected `snapshots/`
- Relevant `docs/`

EXCLUDE from shipped product:

- `.agents/` development history.
- Marketing website.
- Unrelated snapshots and locale copies.
- Upstream brand assets not needed for attribution.

---

## 20. Licensing and provenance

### 20.1 Root license

The inspected DeepSeek root is MIT licensed.

For substantial copied portions, retain the copyright and permission notice. This applies to adapted code as well as unchanged copies. [MIT license requirements](https://opensource.org/license/mit)

Retain:

- Exact upstream commit.
- Original source path.
- Original license.
- Local modification record.
- Applicable third-party notices.

### 20.2 Do not assume every dependency is MIT

The upstream notice inventory includes multiple licenses and special cases.

Examples requiring attention if selected:

- Vendored Cordis/Cosmokit/Schemastery notices.
- Apache/BSD/ISC dependencies.
- `@deepseek-ai/libreoffice-kit`, identified with MPL-2.0 licensing.
- Dual-licensed components.
- Claude SDK terms identified through a separate license reference.
- Native binaries and Office/media conversion distributions.

MPL obligations are file-level and depend on distribution circumstances; they do not automatically require publishing all unrelated proprietary code. Review the actual selected files and distribution model. [Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)

### 20.3 Release requirements

Before shipping a future integration:

1. Produce an SBOM from the actual resolved production graph.
2. Check every distributed package and binary.
3. Include required notices.
4. Preserve patch provenance.
5. Review source-availability obligations where applicable.
6. Keep upstream branding separate from OCADE’s brand.
7. Record that the upstream safety document describes a developer-preview security posture.

This is a release requirement, not a claim of current license clearance or security certification.

---

## 21. Implementation order

No implementation is authorized by this report.

| Phase | Work | Dependencies | Exit condition | Estimated OCADE change surface |
|---|---|---|---|---|
| **0. Baseline and provenance** | Freeze inspected revisions, reconcile stale intake documentation, record current gates and benchmark corpus. | None | Reproducible source/dependency inventory; no readiness claims from old results. | 2–4 documentation/configuration files later. |
| **1. Authority and event contract** | Define run identity, event envelope, verification/delivery projection and manual-continuation policy. | Phase 0 | Contract tests demonstrate no bypass of existing ownership, STOP or billing. | 6–10 new/edited modules/tests; schema changes only if needed. |
| **2. Portable engine adapter** | Integrate stream handling, scheduling, inbox and checkpoints; validate Worker compatibility. | Phase 1 | Keyless replay parity; incomplete turns cannot execute effects. | 8–14 modules/tests, overlapping later phases. |
| **3. Unify execution paths** | Route main workspace, bubble and device continuation through one engine. | Phase 2 | Equivalent foreground/background outcomes and recovery. | 5–8 existing files plus focused tests. |
| **4. Context and memory** | Add result pruning, image references, provenance and bounded retrieval. | Phases 1–3 | Lower context cost without lost authority, evidence or resume state. | 5–8 modules/tests. |
| **5. App catalog and UI** | Stable application IDs, icon pipeline, structured `@` references, richer chat/artifact views. | Stable broker/event contract | Discovery and mention tests pass; monochrome and accessibility checks pass. | 8–12 UI/runtime/contract files. |
| **6. Optional capability expansion** | MCP, selected skills, LSP or PTC only where benchmarks justify them. | Prior phases | Each addition wins a defined task family without safety regression. | 2–6 integration files per admitted capability. |
| **7. Real-work qualification** | Native/browser/domain benchmarks, fault injection, security and release gates. | All selected features | Published results meet thresholds; unresolved cases remain BLOCKED. | Evidence/tests; no feature expansion. |
| **8. Retire duplicate logic** | Remove old planner branches, redundant prompts and compatibility code. | Proven parity and rollback | One production engine; old path no longer needed. | Usually net deletion, measured after implementation. |

These ranges overlap and should not be summed as a promise. A practical first production slice is likely **15–25 OCADE files touched**, with broader UI/capability work bringing the cumulative surface to roughly **30–50**. Actual scope depends on the runtime-compatibility result.

### Rollback design

- Keep the old execution path behind an explicit controlled rollout flag during migration.
- Do not run both paths against the same mutable resource.
- Store engine/version identity with each run.
- Use additive event/schema evolution.
- Stop or reconcile in-flight work before switching engines.
- Preserve STOP and completion enforcement outside either engine.
- Remove the old path only after sufficient parity evidence.

---

## 22. Acceptance tests

### 22.1 Authority and cancellation

| Test | Required result |
|---|---|
| STOP races with queue admission | No action admitted after the authoritative fence. |
| STOP races with completion | Task remains stopped; completion/charge cannot revive it. |
| STOP during nested PTC call | Inner effects stop being admitted; running work is reconciled. |
| STOP while device is offline | UI reports lack of confirmation accurately. |
| Permission revoked after planning | Execution denied at admission/execution. |
| Old controller submits result | Cannot mutate current task authority. |
| User takes over desktop | Automation relinquishes control and refreshes observation before any later resume. |
| Quota resets | No timed continuation without explicit permission. |

### 22.2 Provider and session integrity

- Truncated SSE with partial tool JSON.
- Empty successful-looking provider response.
- Provider error after partial text.
- Max-token termination containing tool-looking content.
- Duplicate model response delivery.
- Crash before and after checkpoint.
- Crash after effect but before receipt.
- Concurrent tabs attempting to resume.
- Context compaction across tool-call/result pairs.
- Lost connection during approval.
- Retry after an unknown external effect.

Required result: no fabricated success, duplicate mutation or reconstructed authority.

### 22.3 Application detection

- Non-English and Unicode names.
- Duplicate names across devices.
- Multiple installed versions.
- Portable applications.
- Removed executable.
- Stale installation record.
- Application installed in an unusual location.
- Malformed or oversized icon.
- Spoofed application name.
- Changed executable identity.
- Discovered API that fails functional verification.
- Recipe invalidated by version change.

### 22.4 Real artifact tasks

- Populate and reopen a spreadsheet with actual requested data.
- Generate a document meeting content and layout requirements.
- Produce a presentation and inspect rendered slides.
- Edit a file, reread it and run relevant checks.
- Produce media meeting requested duration/captions/audio requirements.
- Deliver both final output and editable project when requested.
- Verify CAD/design semantics with a domain oracle.
- Reopen delivered outputs independently.

### 22.5 UI

- Keyboard-only `@` selection.
- Screen-reader labels.
- IME composition.
- Mention removal and editing.
- Draft preservation.
- Scroll stability during streaming.
- Stop button accessibility.
- Accurate pending/failed/delivered states.
- Monochrome token check.
- Small-screen layout.
- No raw implementation details in normal product flows.

---

## 23. Existing readiness evidence

`BLOCKED_TESTS.md` remains the appropriate source for unresolved work. It contains both successful scoped evidence and substantial limitations.

Examples from the inspected record:

- A successful video outcome exists alongside failed attempts.
- CAD semantic-oracle work remains unsuccessful in the recorded runs.
- Some photo workflows succeeded.
- A larger or “elite” prompt variant did not automatically improve results.
- Browser/stub and unit-test results are recorded.
- Native-platform, real-model STOP and full-release gates remain distinct.

These historical records do not establish current release readiness and were not rerun here.

**Implication:** the first success criterion for the integration is preserving existing safeguards and improving failure-prone real tasks. A larger harness or higher unit-test count is not itself progress toward that goal.

Source: [BLOCKED_TESTS.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/df7c136361744bc73f401a7043634e521378d220/BLOCKED_TESTS.md).

---

## 24. Expected speed improvements—and how to measure them

| Mechanism | Expected benefit | Measurement |
|---|---|---|
| Shared durable history | Fewer repeated reads after resume. | Repeated-tool-call rate and tokens after interruption. |
| Model-free result pruning | Smaller prompts without a summarization call. | Input tokens per successful task. |
| Selective image offload | Less repeated screenshot payload. | Image tokens/bytes per task and task success. |
| Dynamic tool retrieval | Fewer irrelevant tool definitions. | Prompt size and incorrect-tool selection. |
| Structured app references | Less application-name disambiguation. | Calls/time from mention to first valid action. |
| Verified recipes | Fewer rediscovery and trial-and-error steps. | Calls per successful repeated workflow. |
| Safe read parallelism | Lower waiting time on independent operations. | Wall time with matched task correctness. |
| Semantic/API control | Fewer fragile coordinate actions. | UI actions per completed task and recovery rate. |
| Deterministic validators | Earlier detection of bad outputs. | Late failure rate and false-completion rate. |
| Optional PTC | Fewer model round trips for known workflows. | End-to-end latency, cancellation and audit parity. |

### Proposed optimization targets

After establishing a baseline:

- **20% lower median wall time** on matched successful tasks.
- **30% fewer model round trips** on repeatable workflows suitable for recipes or bounded orchestration.
- **20% lower model input tokens** on long sessions.
- No statistically meaningful reduction in task success.
- No increase in unauthorized actions or false completion.

These are targets, not predicted or measured achievements.

Model latency, provider capacity and application speed may dominate. Harness changes cannot guarantee a proportional end-to-end speedup.

---

## 25. Competitor comparison

This is a comparison of documented capabilities and proposed benchmark opportunities—not a claim that OCADE currently outperforms any product.

Product information was checked against official sources during this analysis. Availability and packaging can change.

| Product | Documented strength relevant to OCADE | OCADE’s credible opportunity | Benchmark |
|---|---|---|---|
| **ChatGPT Agent / current Work successor** | Broad multi-step work using tools and connected workflows. The current Agent help page carries a retirement notice directing users to Work; historical body text should not be treated as current packaging. [Official page](https://help.openai.com/en/articles/11752874-chatgpt-agent) | Verified local application work and transparent artifact receipts across an explicitly selected device. | Matched research→document→delivery tasks; correctness, interventions, cost and recovery. |
| **Codex** | Repository workflows, worktrees, tools and agent-assisted software development. [Official feature documentation](https://learn.chatgpt.com/docs/features) | Combine coding with native non-code deliverables while retaining reproducible tests and device authority. | Issue fix plus document/spreadsheet/app workflow; test pass and final artifact correctness. |
| **Claude Code / Cowork** | Coding and connected computer work; Cowork documentation describes connectors/browser/computer interaction and app permissions. [Official computer-use documentation](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork) | Stronger measured completion evidence for specific local workflows, plus consistent STOP/recovery across surfaces. | Native-app tasks with hidden quality checks and interruption injection. |
| **Gemini** | Multimodal assistance, agentic workflows and work-system integration. [Gemini at Work announcement](https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/gemini-at-work/) | Comparable conversational usability with independently verified outputs across non-Google applications. | Cross-suite document/spreadsheet tasks, visual grounding and artifact quality. |
| **Manus** | Autonomous multi-step work and browser operation, including a local-browser offering. [Browser Operator](https://manus.im/blog/manus-browser-operator) | Reliable local-app execution and fewer false-completion claims on demanding artifact tasks. | Long browser workflow plus local export/edit/reopen, with recovery tests. |
| **Muse** | Personal-agent workflows, dedicated execution environment and a documented separate safety architecture. [Official announcement](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/) | User-visible evidence, local application breadth and explicit manual-continuation policy. | Personal-work tasks with adversarial retrieved instructions and sensitive-action gates. |
| **Dots** | Persistent personal context, connected apps, delegation to Work/Codex and opt-in local computer capabilities. [Official admin guide](https://learn.chatgpt.com/docs/enterprise/dots-admin-guide) | Transparent, editable memory and measured application-specific recipe reliability. | Memory correction/deletion, cross-session continuity and local-work completion. |
| **Grok Bot** | Persistent cloud computer, browser/files/terminal and connector workflows. [Official Bots overview](https://docs.x.ai/grok-bot/overview) | Strong local-device ownership, artifact verification and shared-resource scheduling. | Concurrent tasks competing for one computer, cancellation and final-output quality. |
| **OpenClaw** | Self-hosted agent infrastructure, memory and browser/computer capabilities. [Official overview](https://docs.openclaw.ai/help/faq/what-is-openclaw), [memory](https://docs.openclaw.ai/concepts/memory) | Better integrated UI, predictable permission boundaries and maintained domain validators. | Setup burden, safe task completion, recovery and memory provenance. |
| **Perplexity Comet** | Browser-centered research and assistant workflows. [Official product page](https://www.perplexity.ai/comet) | Extend research into verified native artifacts and application workflows. | Source-grounded research followed by a validated spreadsheet/report and delivery. |
| **Cursor** | Codebase-aware editing, terminal/tools and agent workflows. [Official Agent documentation](https://cursor.com/docs/agent/overview) | Broader application work while preserving coding quality. | Repository change plus real app validation and non-code deliverables. |
| **Devin** | Software-engineering workflows and documented desktop/computer-use testing. [Official release article](https://cognition.com/blog/introducing-devin-2-2) | Efficient user-owned local workflows and measurable control/verification behavior. | End-to-end software task with actual UI validation, interruptions and delivery. |

### What would not be a credible comparison

Do not claim:

- “Better than all agents.”
- “100% accurate.”
- “Works with every application.”
- “Instant STOP” without defining acknowledgement versus physical quiescence.
- “No hallucinations.”
- Lower cost from a cheaper model while ignoring a lower success rate.
- Better speed by omitting verification performed by the competitor.
- Browser success as proof of native desktop competence.
- A vendor’s advertised benchmark as an independently reproduced result.

---

## 26. Benchmark design for measurable superiority

### 26.1 Two separate experiments

**A. Harness ablation**

Compare old OCADE against proposed OCADE using:

- Same model/provider.
- Same task.
- Same initial environment.
- Same permissions.
- Same budget.
- Same verification oracle.

This isolates the value of the integration.

**B. Product comparison**

Compare OCADE against competitors using their supported configurations. Record model/version, subscription, environment, tool access and date.

Product-level results cannot cleanly attribute differences to the harness alone.

### 26.2 Task corpus

A practical first corpus should cover:

1. Source-grounded research.
2. Browser workflows.
3. Spreadsheet creation/editing.
4. Word-processing/document tasks.
5. Presentations.
6. File organization and editing.
7. Coding and application testing.
8. Native application workflows.
9. Media tasks.
10. Session recovery and memory.
11. Permission and prompt-injection challenges.
12. STOP and takeover.

Include straightforward tasks, ambiguous tasks, long tasks and intentionally blocked tasks.

Correctly reporting “blocked” can be a successful safety outcome. It is not a successful completion of the original work.

### 26.3 Core metrics

| Metric | Definition |
|---|---|
| Verified task success | Independent oracle confirms all required outcomes. |
| False completion | Agent claims success while required outcomes fail. |
| Unauthorized effect | Side effect outside the granted scope. |
| Human interventions | Clarifications, repairs and takeovers needed. |
| Completion time | Wall time through verified delivery. |
| Cost per successful task | Total cost, including failed attempts, divided by successes. |
| Model calls | All planning, retry, summary and verification calls. |
| Recovery correctness | Correct continuation without duplicated effects. |
| STOP admission latency | Time until new actions are fenced. |
| STOP quiescence latency | Time until running work is confirmed ended. |
| Artifact quality | Hidden domain-specific rubric. |
| Resource footprint | Bundle size, memory, startup and device overhead. |

### 26.4 Proposed gates

- Zero unauthorized effects in the qualification corpus.
- Zero false-completion claims in at least 300 representative trials before making a strong reliability claim.
- At least 95% verified success on a clearly defined common-task subset.
- All critical STOP/ownership/permission fault-injection tests pass.
- Local STOP acknowledgement target: p95 under 250 ms on the specified test hardware.
- Remote admission-fence target: p95 under 2 seconds under a defined healthy network.
- Physical quiescence measured separately per tool/application.
- Performance improvement targets from Section 24, with success non-inferiority.

Zero failures in 300 trials is not proof of zero risk; the approximate one-sided 95% upper bound is still around 1% for the sampled failure rate.

Use randomized task order, repeated trials, hidden checks and confidence intervals. Publish raw failures alongside successes.

---

## 27. Main risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| Importing whole Harness | Dependency growth and duplicate authorities. | Allowlisted composition; source and bundle budgets. |
| Worker incompatibility | Runtime failures despite successful build. | Actual Worker-runtime tests before architecture commitment. |
| Zod 3/4 mismatch | Schema/type/runtime incompatibility. | Explicit boundary; no unrelated global migration. |
| Two planners | Divergent recovery and completion behavior. | Shared engine, separate transports. |
| Two persistence systems | Conflicting session truth. | Supabase canonical events; local journals only for execution recovery. |
| Cooperative-only cancellation | Effects continue after UI says stopped. | Device/process controls and honest acknowledgement states. |
| Nested tool bypass | PTC/MCP effects evade policy. | Broker every effect, including inner calls. |
| Premature artifact success | Incorrect or inaccessible output. | Independent verification plus delivery receipt. |
| Stale application identity | Wrong app/version/recipe selected. | Stable IDs, fingerprints and invalidation. |
| Imported instruction injection | External content gains authority. | Provenance and non-escalating trust rules. |
| Unbounded retry/goal driver | Cost or unauthorized continuation. | Explicit budgets and manual continuation policy. |
| Added telemetry | Unexpected data disclosure. | Exclude outbound telemetry by default. |
| Upstream preview churn | Maintenance burden and regressions. | Fixed revision, narrow patch surface and contract tests. |
| License assumptions | Distribution noncompliance. | Resolved-graph SBOM and notices review. |
| Premature deletion | Loss of working capability. | Parity before removal; reversible rollout. |

---

## 28. Final decisions

1. **Keep the pinned DeepSeek repository as immutable reference.**
2. **Use the 33-package core graph as a dependency-review ceiling, not an automatic installation list.**
3. **Prioritize loop semantics, durable events, checkpointing, result pruning and structured progress.**
4. **Adapt selected context, MCP, skill and app-UI capabilities after the core boundary is proven.**
5. **Keep OCADE’s device runtime, browser control, authentication, permissions, STOP, billing and completion verification authoritative.**
6. **Unify foreground, bubble and background planning through one engine.**
7. **Replace display-name application identity with dynamic, device-scoped records and structured `@` references.**
8. **Borrow Gemini-style interaction quality while preserving OCADE’s monochrome tokens and brand.**
9. **Exclude the default bundles, SDK/CLI route, Electron shell, arbitrary plugin installation, local credential stores and schedules.**
10. **Add PTC, extra browser drivers, subagents, Office engines or search providers only after a measured need.**
11. **Retire duplicated OCADE logic only after parity and recovery tests pass.**
12. **Judge success by verified real work, low false completion, safe interruption and cost per successful task.**

The proposed advantage is achievable through a disciplined combination: **DeepSeek’s reusable orchestration machinery, OCADE’s existing execution and safety boundaries, and stronger evidence-driven completion.** No performance or competitive superiority is established until the benchmark plan is executed.

---

## Owner-approved implementation requirements (23 October 2026)

This addendum records the owner's implementation preferences while preserving the preceding Codex assessment as a read-only planning snapshot. It does not claim the integration has been built or tested.

- **One OCADE agent:** Keep the existing OCADE product and combine its proven capabilities with as much of DeepSeek Harness's useful, compatible agent machinery as can be verified. No second independent task authority, desktop controller or customer-facing app.
- **Integrate before debloating:** Adopt proven agent-loop, context, sessions, tools and scheduling capabilities; wire them into OCADE's existing model, Device Agent, browser, file and verification systems. Remove weak or duplicated OCADE mechanisms only after parity, rollback and real-task tests.
- **No hardcoded application catalogue:** Discover installed and authorized applications and capabilities dynamically. The `@` picker must show actual application names and icons, distinguish devices and refresh when installations change.
- **Premium, simple chat:** Build a Gemini-quality interaction experience without copying branding, retaining OCADE's current colors, design identity, simple composer, streaming responses, task progress, STOP, and verified file previews/downloads.
- **Real work, not claimed work:** Prioritize accurate completed documents, spreadsheets, presentations, browser tasks, PC operations, photo/video editing and unfamiliar applications; verify outputs independently, record task times and failures, and respect the owner's confirmed 50-question customer preferences.
- **Hard safety and ownership boundaries:** Keep OCADE's authentication, permissions, paired-device identity, STOP/Take Over, budget/provider limits and completion checks authoritative; do not enable hidden autonomous continuation, unapproved spending, payments or external effects.
- **Branch/release boundary:** Work exclusively on `ocade/p00-p22-implementation`; preserve concurrent changes and pinned upstream attribution. Never merge `main`, deploy or spend without explicit owner approval.

**Implementation sequence:** Verify the dependency/runtime compatibility of the selected components, integrate behind a reversible boundary, unify execution paths, wire discovery and the interface, independently benchmark matched customer tasks, and retire redundant code only after verified improvements. Treat untested performance and competitor superiority as goals, not facts.


---

## Appendix B — Complete Codex engineering audit and production-readiness checklist (verbatim)

**Audit dated 23 October 2026, scoped to OCADE commit `5a476453`. Historical findings and status require re-verification after code changes.**

# OCADE_DEEPSEEK_MASTER_PLAN.md

**Read-only engineering audit — 23 October 2026**

**Assessment: OCADE has substantial working implementation, but it is not qualified for a paid production launch. Claude implemented a useful first slice of the DeepSeek plan—not the complete integration or the complete product.**

The most urgent work is to reconcile production security/schema drift, fix delivery and application-targeting defects, unify execution and recovery behavior, and prove real customer workflows. Importing more of DeepSeek before those foundations work would increase complexity without establishing reliability.

No repository files, database records, deployments, installations, subscriptions, or automations were changed during this audit.

## 1. Audited versions and evidence boundaries

| Item | Audited identity |
|---|---|
| Repository | `BREVEX-CEO/caera-connect-plan` |
| Branch | `ocade/p00-p22-implementation` only |
| Current head | [`5a476453c885610e6f7a7eb5a07cf7fd4b77bb4f`](https://github.com/BREVEX-CEO/caera-connect-plan/commit/5a476453c885610e6f7a7eb5a07cf7fd4b77bb4f) |
| Original master-plan source baseline | `df7c136361744bc73f401a7043634e521378d220` |
| Change since that baseline | Five commits; 40 changed files, including 10 added files; no deleted files |
| DeepSeek gitlink | `external/deepseek-harness/upstream` |
| Pinned upstream commit | [`687f282e8625c6b8d11ff58211a90524be2e4317`](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317) |
| OCADE inventory | 1,250 Git-tree entries: 1,136 blobs and one submodule gitlink |
| Readable OCADE source/document cache | 1,084 text files, combining unchanged verified blobs with the current changes |
| DeepSeek inventory | 16,297 file entries: 16,283 regular files and 14 symlinks |
| Requirements reviewed | `plan.md`, `TOFIX.md`, `BLOCKED_TESTS.md`, `docs/PHASES_STATUS.md`, product, architecture, design, security, testing, device, mobile, owner/staff and decision documents |

The branch head was checked again at the end of inspection and remained `5a476453…`.

This was a repository-wide inventory and cross-subsystem source audit, with deeper examination of execution, permissions, completion, delivery, providers, discovery, persistence and the new changes. It was **not** a runtime execution of every application path or a formal proof that all defects have been found.

All paths below are relative to the named remote repository snapshot. DeepSeek paths are relative to its pinned upstream root unless otherwise stated.

### Evidence labels

- **Confirmed source:** directly established by implementation.
- **Independent isolated check:** actual source logic exercised in memory, without repository writes or live product actions.
- **Recorded test:** Claude’s committed evidence; not independently rerun here.
- **Live metadata:** read-only GitHub, Supabase or Cloudflare observations.
- **Risk:** plausible failure requiring a targeted reproducer.
- **Missing:** requested capability or qualification not established.

The authoritative current source and evidence are available in the [audited tree](https://github.com/BREVEX-CEO/caera-connect-plan/tree/5a476453c885610e6f7a7eb5a07cf7fd4b77bb4f), [complete plan](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5a476453c885610e6f7a7eb5a07cf7fd4b77bb4f/plan.md), [open-test ledger](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5a476453c885610e6f7a7eb5a07cf7fd4b77bb4f/BLOCKED_TESTS.md), and [200-item requirement ledger](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5a476453c885610e6f7a7eb5a07cf7fd4b77bb4f/docs/PHASES_STATUS.md).

## 2. What Claude actually implemented

### 2.1 Commit-level progress

| Commit | Actual contribution |
|---|---|
| `d5a3df66…` | Added the complete master plan and owner implementation requirements. |
| `1b8cff2e…` | Baseline gate/configuration/test maintenance. |
| `db354109…` | DeepSeek-derived execution helpers, durable-delivery work, application mentions and icons. |
| `f1ccc034…` | JARVIS Markdown rendering, Chat-to-JARVIS draft handover, icon-cache adjustment and related UX fixes. |
| `5a476453…` | Persistent background finishing marker and file handover, separate icon database write, updated evidence ledgers. |

These changes are real. Their scope is narrower than the latest ledger’s phrase **“one turn engine for foreground and background.”**

### 2.2 File-by-file disposition of the new work

| Files | Implemented behavior | Assessment |
|---|---|---|
| `src/jarvis/engine.ts` | Shared limits, human-boundary helper, small checkpoint, tool-result formatting, bounded read concurrency, exclusive effect barriers and text pruning. | **KEEP; PARTIAL integration.** It is a shared policy/helper module, not the complete common execution state machine. |
| `src/jarvis/agent.ts` | Uses the scheduler and pruning; foreground delivery reads durable task records. | **KEEP/ADAPT.** Foreground loop still owns substantial execution policy independently. |
| `src/jarvis/background.server.ts` | Uses shared helpers; records a finishing marker; advances file inspection/delivery without another model call. | **KEEP/REPAIR.** Background still has a separate loop, reconstruction path and termination policy. |
| `src/jarvis/task-authority.server.ts` | Computes files needing delivery from recorded actions and outcome checks. | **KEEP/REPAIR.** Incorrect cross-platform path normalization and failure-as-empty behavior remain. |
| `src/jarvis/jarvis.functions.ts` | Authenticated delivery/icon reads; secret-pattern rejection before storing memory. | **KEEP/ADAPT.** Memory provenance and reliable icon persistence remain incomplete. |
| `src/jarvis/live-deps.ts` | Delivery API wiring; research unavailability expires after 30 minutes. | **KEEP/REPLACE scoped state.** Expiry improves the old permanent flag, but the state remains module-global. |
| `src/jarvis/mention.tsx` | Dynamic device/app picker, keyboard behavior, selected-app display and icons. | **KEEP/REPAIR.** Mentions remain name-based, ephemeral and vulnerable to parsing/target-loss cases. |
| `src/jarvis/JarvisWorkspace.tsx` | Mention routing, Markdown answers, handover, scrolling and delivery presentation. | **KEEP/ADAPT.** Do not rewrite the whole workspace; extract only duplicated lifecycle ownership. |
| `src/jarvis/bubble-state.ts` | In-memory Chat/JARVIS handover behavior. | **KEEP/ADAPT.** Draft handover is not durable, structured cross-surface task context. |
| `src/components/chat/MessageList.tsx` | Chat-to-JARVIS handover and follow-bottom integration. | **KEEP.** Add account-switch, attachment and reload qualification. |
| `src/lib/use-follow-bottom.ts` | Shared bottom-follow intent; avoids forcibly scrolling a reader upward in history. | **KEEP.** Complete accessibility and long-transcript tests. |
| `jarvis-runtime/ocade_computer.py` | Native app icon extraction with bounded PNG output and fallback. | **KEEP/REPAIR.** Windows/macOS execution remains unqualified; aggregate transport budget is missing. |
| `jarvis-runtime/ocade_device.py` | Discovers icons off the exchange loop and sends changed icon dictionaries. | **REPAIR.** Whole-batch size and persistence acknowledgement are defective. |
| `src/jarvis/device.server.ts` | Validates icon metadata and stores it separately from ordinary device state. | **REPAIR.** Separate writes preserve the core exchange, but unsuccessful icon storage is not acknowledged distinctly. |
| `src/jarvis/protocol.ts` | Added `holdsSecret` checks. | **KEEP/ADAPT.** Useful filtering, not a complete “secrets can never enter memory” guarantee. |
| `src/integrations/supabase/types.ts` | Added icon-column typing. | **KEEP.** Generated/source types are ahead of both inspected database schemas. |
| `supabase/migrations/20261023120000_a_device_shows_its_apps_own_icons.sql` | Additive `app_icons` column and shape constraint. | **KEEP; NOT DEPLOYED** in either inspected project. |
| Matching `supabase/rollback/…_rollback.sql` and `supabase/verification/…_verify.sql` | Migration companions. | **KEEP.** Presence is not migration/rollback proof. |
| `src/jarvis/THIRD_PARTY_NOTICES.md` | Upstream pin, adapted-source map and MIT notice. | **KEEP.** Verify inclusion in distributed notices. |
| `docs/integrations/deepseek-harness.md`, `external/deepseek-harness/README.md` | Explain reference-only upstream and derived integration. | **KEEP; correct overbroad completion wording.** |
| `src/jarvis/__tests__/engine.test.ts`, `mention.test.ts` | New behavior tests. | **RETAIN; extend with failures identified below.** |
| `src/jarvis/__tests__/{agent,carry-on,device-exchange,jarvis-rules,live-control}.test.ts` | Updated regression coverage. | **RETAIN.** Database and stub results must remain separately labeled. |
| `src/jarvis/__tests__/rest-adapter.ts` | Test support. | **RETAIN AS TEST SUPPORT.** |
| `jarvis-runtime/tests/test_computer.py` | Icon/unit coverage. | **RETAIN.** Mocks do not qualify platform extraction. |
| `scripts/e2e/{chat,jarvis,shell}-journey.mjs` | Updated customer-flow tests. | **RETAIN/REPAIR flaky or sequence-dependent failures.** |
| `src/lib/auth/__tests__/auth-surfaces.test.ts` | Adjusted assertion for password visibility control. | **Test maintenance**, not newly implemented authentication. |
| `.prettierignore`, `eslint.config.js` | Exclude pinned upstream from ordinary application lint/format. | **KEEP.** Audit admitted upstream code separately. |
| `plan.md`, `TOFIX.md`, `BLOCKED_TESTS.md` | Planning and evidence updates. | **KEEP.** Resolve contradictions in place; do not create another competing backlog. |

### 2.3 Original master plan versus current implementation

| Original objective | Current result |
|---|---|
| One authoritative execution lifecycle | **Partial:** shared helpers; foreground/background and Bubble/Workspace lifecycle duplication remains. |
| Durable, resumable sessions | **Partial:** action history and finishing marker; no complete versioned run/checkpoint projection. |
| Correct delivery after reload/background completion | **Implemented first slice; defects remain.** |
| Final answer derived from verified outcome | **Incomplete:** model prose still takes precedence in terminal paths. |
| Provider capability state scoped to identity/configuration | **Partial:** 30-minute expiry added; scoping remains missing. |
| Dynamic application identities | **Partial:** real discovery exists; names remain the public execution reference. |
| `@` application icons | **Implemented in source; database absent; native qualification incomplete.** |
| Controlled memory with provenance | **Partial:** permission gate and pattern filtering; provenance and injection boundaries incomplete. |
| Context compaction/offload/retrieval | **Partial:** head/tail truncation only. |
| Tool registry and capability admission | **Existing typed protocol retained; upstream registry not integrated.** |
| MCP, skills, LSP, programmatic tool calling | **Not integrated.** |
| Subagents | **Not integrated.** |
| Gemini-style polished conversation UX | **Useful incremental improvements; not complete.** |
| Measured faster/better agent | **Not established.** |
| Complete release qualification | **Not established.** |

## 3. What was independently checked

### 3.1 Isolated source checks performed during this audit

These checks exercised actual extracted logic in memory. They did not run the product, write files or operate devices.

| Check | Observed result | Meaning |
|---|---|---|
| `stillMentioned("@Wordpress and @Word", selected Word)` | Returned no selected app. | First substring match masks a later valid mention. |
| `stillMentioned("mail@Word", selected Word)` | Retained selected Word. | Mention retention does not enforce the preceding boundary used by trigger detection. |
| Delivery path `a\b.txt` on a POSIX-compatible interpretation | Became `a/b.txt`. | Delivery changes filename identity rather than preserving the exact target. |
| 200 valid 32×32 PNG icon entries, each 3,172 bytes | Icon validator accepted all 200; JSON body was **848,904 characters**, above the **600,000-character** exchange limit. | Individually valid discovery data can make the whole control exchange fail. |

The icon check establishes a contract defect. It does not claim that a particular customer’s installed applications already produced that exact batch.

### 3.2 Live infrastructure observations

| Surface | Read-only observation | Release implication |
|---|---|---|
| Production Supabase | Latest recorded migration was `20261003090000_owner_and_staff_consoles_on_ocade_in`. | Twenty-one branch migration files postdate the latest production history entry. Reconcile actual objects; do not blindly replay SQL. |
| Production Supabase | `jarvis_task_completion_is_the_servers` and `jarvis_activity_stopped_while_running` were absent from inspected function metadata. Expected completion-related task triggers were absent. | Branch completion/STOP protections cannot be assumed deployed. **P0 release blocker.** |
| Production Supabase | `ocade_case_open` still had the older three-argument signature. | Confirmed backend contract drift relative to staging/current source. |
| Staging Supabase | Migration listing was empty, although later functions and completion triggers exist. | Schema may contain changes, but reproducible migration provenance is missing. |
| Both Supabase projects | No public `app_icons` column. | The new icon feature is not schema-ready in either inspected environment. |
| Both projects’ security advisors | Leaked-password protection disabled. | Resolve for the supported password sign-in path before launch. |
| Security advisors | Authenticated-executable SECURITY DEFINER warnings: staging 41, production 36. | Review each function’s grants, ownership, search path and authorization. A warning is not proof of exploitation. |
| Security advisors | RLS-enabled/no-policy informational findings. | Do not “fix” by adding broad policies. Some service-only tables should deny direct clients. |
| Cloudflare | `ocade-web` exists; latest listed deployment dated **19 October 2026**, version `da643c55-05be-408f-8c46-bc33388a20bd`. | No deployment of the 23 October integration was established. Exact deployed Git SHA still needs release provenance. |
| GitHub | Zero Actions runs returned for audited head SHA. | No GitHub Actions qualification of this exact head was established. Other recorded manual tests remain separate evidence. |

### 3.3 Claude’s recorded tests—not independently rerun

The latest committed ledger reports:

- Vitest: **1,560 passed across 126 files**.
- Python runtime: **251 passed, 30 skipped, zero failed**.
- Static/type/lint/format/policy checks: passed.
- Production npm dependency audit: zero findings.
- Final stub journeys: JARVIS 140, Chat 52, Bubble 26 passed.
- Application picker: four checks passed using LibreOffice icons.
- Background delivery: real-PostgreSQL test evidence.
- No real model or native Windows/macOS/Android qualification for this integration slice.

Important qualifications:

1. The Python result used Playwright **1.63**, while `jarvis-runtime/requirements-agent.txt` pins **1.62.0**. Final qualification must use the exact shipped dependency/browser combination.
2. `JOURNEY-23-01` remains flaky: capacity message, exhausted-allowance composer state and Settings→Devices navigation each failed in a recorded run.
3. `SHELL-23-01` remains a recorded failure: previously opened Chat sometimes returns the offline fallback in the full journey.
4. Windows/macOS icon extraction remains untested on the actual platforms.
5. The production-only npm audit does not close the recorded Vitest development-tool advisory work.
6. None of these counts establishes real-task accuracy, production security or release readiness.

## 4. Confirmed defects and high-priority risks

### F01 — Production database lacks important current security contracts

**Priority: P0 · Evidence: live metadata**

Relevant files:

- `supabase/migrations/20261012090000_completion_is_the_servers.sql`
- `supabase/migrations/20261016090000_task_bound_turns_and_checked_outcomes.sql`
- `supabase/migrations/20261016100000_queue_admission_holds_the_task.sql`
- `supabase/migrations/20261019104555_completion_cannot_revive_a_stopped_task.sql`
- `supabase/migrations/20261006090000_cases_name_their_reader_and_conversation.sql`
- Their existing verification and rollback companions.

**Required change:** reconcile current production objects, grants and dependencies against the release candidate; prepare an ordered migration path and rollback. Staging must first reproduce the same path from a known baseline.

**Acceptance:** direct authenticated attempts to forge completion, revive stopped work, queue against an invalid task, reuse proof or read unshared support content are refused in the candidate environment.

This is a deployment/configuration blocker, not an instruction to change production during this audit.

### F02 — Icon inventories can break the device control exchange

**Priority: P1 · Evidence: independent isolated check plus source**

- `src/jarvis/device.server.ts:228–230`
- `src/jarvis/device.server.ts:437` — `appIconsOf`
- `jarvis-runtime/ocade_device.py:429–433`

The device sends a complete changed icon dictionary through an exchange capped at 600,000 characters. Per-icon and per-app limits permit a larger aggregate.

**Required change:** enforce a serialized aggregate budget before transmission; send icons in bounded, independently acknowledged batches or a separate optional metadata operation. Core receipts, STOP and lease traffic must remain deliverable.

**Acceptance:** a 500-app catalog cannot prevent heartbeat, result receipt, cancellation or revocation exchange.

### F03 — Failed icon persistence can be permanently acknowledged

**Priority: P1 · Evidence: confirmed source**

- `src/jarvis/device.server.ts:658–662`
- `jarvis-runtime/ocade_device.py:481–482`

The server ignores the icon update result; the device treats overall exchange success as icon acceptance. Missing schema or a transient database failure can suppress retransmission of unchanged icons.

**Required change:** acknowledge the stored icon revision explicitly; update `icons_sent` only after that acknowledgement. Retain bounded retry/backoff.

**Acceptance:** fail the first icon write, recover storage, keep the same inventory, and observe eventual icon persistence without restarting the companion.

### F04 — Delivery rewrites valid filename identities

**Priority: P1 · Evidence: independent isolated check**

- `src/jarvis/task-authority.server.ts:203–232`, especially `norm` at line 207.

Global backslash replacement is invalid for POSIX filenames. It can also collapse distinct references into the same delivery key.

**Required change:** preserve submitted execution paths. If canonical identity is necessary, obtain platform-aware identity from the executor and retain the exact display/action path separately.

**Acceptance:** distinguish case, Unicode, whitespace, literal backslashes, separators and aliases according to the actual filesystem. Never deliver or verify a neighboring file.

### F05 — Delivery enumeration treats database failure as “nothing to deliver”

**Priority: P1 · Evidence: confirmed source**

- `src/jarvis/task-authority.server.ts:236–250`
- `src/jarvis/background.server.ts:308–335`
- `src/jarvis/background.server.ts:525–535`

`taskDeliveriesDue` returns `[]` when it cannot establish the outcome/action data. Failure to persist the background finishing marker can fall straight through to finishing.

**Required change:** represent `ready`, `none`, `unavailable` and `invalid` distinctly. Preserve a recoverable delivery state. Do not silently equate unreadable history with no output.

**Acceptance:** inject each database failure; the UI reports pending/partial delivery and recovery succeeds without duplicate uploads or another model-generated finish.

### F06 — Final prose can override the verified result

**Priority: P1 · Evidence: confirmed source; misleading customer outcome remains a targeted test**

- `src/jarvis/agent.ts:1143–1145`
- `src/jarvis/background.server.ts:283–299`

Foreground returns `answer || finishedWith`; background says `text || finish.result`. Existing model prose can remain more optimistic than the verified/delivered outcome.

**Required change:** project terminal status, delivered artifacts and unresolved work from the authoritative task result. Model prose may explain that result, but cannot override it.

**Acceptance:** deliberately supply “Everything is complete” alongside a partial delivery/refused verification. The final card and message must accurately show the unresolved portion.

### F07 — Application mentions have parsing and persistence defects

**Priority: P1 for target preservation; P2 for matching details**

- `src/jarvis/mention.tsx:56–59`
- `src/jarvis/mention.tsx:142`
- `src/jarvis/JarvisWorkspace.tsx:413–440`

Confirmed behavior:

- First-substring matching misses a later valid mention.
- Email-like text can retain a selected app.
- The first chosen device wins; multiple-device mentions are not a complete routing contract.
- The selected app/device is cleared before message persistence succeeds.
- On persistence failure only the text is restored, so retry may use the default device.
- Saved messages do not preserve structured application references.

**Required change:** persist structured `{deviceId, appId, catalogRevision}` references with the turn; preserve them through admission failure, retry, handover and reload. Use the same boundary/parser rules for trigger detection and retained mentions.

**Acceptance:** select Word on PC B while PC A is default; fail saving; retry; execution must still target PC B—or require explicit reselection.

### F08 — Icon cache identity is insufficient

**Priority: P2 · Evidence: confirmed source**

- `src/jarvis/mention.tsx:74–80`

The query key uses app count and first device ID. Same-count inventory changes, icon updates and changes on other devices do not change that identity.

**Required change:** key/invalidate using the actual account/device catalog revision. Keep existing account-switch cache clearing.

**Acceptance:** replace an app with another while preserving count; update an icon; revoke a second device. Picker state must converge without a ten-minute stale window.

### F09 — Shared engine claims exceed the implementation

**Priority: P1 architectural completion · Evidence: confirmed source**

- `src/jarvis/engine.ts`
- `src/jarvis/agent.ts`
- `src/jarvis/background.server.ts`
- `src/jarvis/JarvisWorkspace.tsx`
- `src/jarvis/JarvisBubble.tsx`

The common file is 174 lines of policy/helpers. Foreground still has a 1,173-line planner implementation; background has a separate 618-line driver. Bubble and Workspace continue to own separate UI turn lifecycles.

**Required change:** consolidate shared state transitions and ownership incrementally inside existing modules. Keep distinct presentation and transport adapters.

**Acceptance:** identical recorded model/tool events produce the same status, delivery obligations, usage settlement and resume decision across foreground/background/bubble/workspace.

### F10 — Memory filtering does not establish memory trust

**Priority: P1 security hardening · Evidence: confirmed limitation; exploit not demonstrated**

- `src/jarvis/protocol.ts` — `holdsSecret`
- `src/jarvis/jarvis.functions.ts:921–938`
- `src/jarvis/agent.ts` — `untrustedSeen`

The new filter catches useful credential patterns. It does not prove that every secret representation is detected. The per-turn untrusted-content flag also does not establish provenance across saved history or resumed tasks.

**Required change:** bind memory writes to authenticated user-origin content/explicit intent; retain source, scope, deletion and expiry semantics. Keep pattern filtering as defense in depth. Do not promise perfect secret detection.

**Acceptance:** malicious instructions in prior tool results, retrieved files and resumed history cannot create memory; explicit user preferences can be stored and completely deleted.

### F11 — Research capability suppression is still shared across contexts

**Priority: P2 · Evidence: confirmed source**

- `src/jarvis/live-deps.ts:96–97,197`

The permanent boolean became an expiring timestamp, but remains module-global.

**Required change:** scope capability observations to the relevant account, provider/model, deployment and configuration revision; invalidate on change.

**Acceptance:** an unavailable research capability in one account/configuration does not suppress an available one after account/model/configuration changes.

### F12 — Several recovery paths need focused fault tests

**Priority: P1 · Evidence: risks, not confirmed end-to-end defects**

- `engine.ts`: if one parallel call throws, preserve results from calls already completed rather than losing the whole group’s returned result set.
- `background.server.ts`: the 60-action limit may interrupt deterministic delivery near the budget boundary.
- `device.server.ts`: upload-before-task-settlement can leave an orphan object.
- `agent.ts`/`background.server.ts`: in-memory provenance must survive restart so script-produced files are not later described as produced in the requested editor.
- `JarvisWorkspace.tsx`/`live-deps.ts`: automatic busy continuation must respect explicit manual-continuation settings and STOP.

**Acceptance:** fault injection at every transition produces either a correct resumable state or an honest terminal state, with no duplicate external effect.

## 5. DeepSeek: genuine integration and remaining practical value

### 5.1 What “integrated” currently means

OCADE does **not** install or execute the pinned Harness packages.

There are no newly admitted Cordis, pnpm-workspace or Zod 4 runtime dependencies. The current contract explicitly says portable logic was **re-expressed in OCADE**.

That is a valid integration strategy, provided it is described accurately:

| Capability | Current integration class |
|---|---|
| Ordered bounded tool scheduling | **Derived implementation**, based on upstream `tool-calls.ts`. |
| Tool-result pruning | **Derived implementation** using upstream-style budgets. |
| `@` trigger/menu behavior | **Derived implementation**. |
| App icon extraction | **Approach adapted**, Python implementation using existing dependencies. |
| Durable delivery | **OCADE implementation inspired by event reconstruction**, not upstream session-runtime adoption. |
| Follow-bottom behavior | **Intent adapted**, not wholesale UI adoption. |
| Agent loop/session engine | **Not directly integrated.** |
| Tool registry, compaction engine, skills, MCP, LSP, PTC, subagents | **Not integrated.** |
| Browser/computer drivers | **Existing OCADE drivers retained.** |
| DeepSeek model inference or weights | **Not introduced by Harness integration.** |

The current [integration contract](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5a476453c885610e6f7a7eb5a07cf7fd4b77bb4f/docs/integrations/deepseek-harness.md) is explicit about these boundaries.

### 5.2 Recommended maximum practical integration

“Maximum practical” should mean **the largest proven benefit under one security and execution authority**, not the largest number of upstream packages.

Keep the present OCADE broker and device agent. Complete the portable core improvements first. Add optional ecosystems only when a real task needs them and their benefit is measured.

The following counts are observed regular files/source files within the named upstream directories. They are **not** proposed copy counts or complete transitive dependency totals.

| DeepSeek directory / exact useful files | Files total / `src` | Decision and OCADE wiring |
|---|---:|---|
| `packages/core/agent-loop/src/{agent,assistant-stream,inbox,runtime-context,tool-calls}.ts` | 43 / 7 | **ADAPT further.** Use cancellation, ordering, turn lifecycle and reconstruction behavior to finish `engine.ts`, `agent.ts`, `background.server.ts`. |
| `packages/core/tools/src/{schema,json-schema,presentation,ptc-calls}.ts` and remaining `src` | 30 / 10 | **ADAPT selectively.** Consolidate schema/presentation/effect classification around `protocol.ts`; do not create a second permission authority. |
| `packages/core/session/src/{known-event-types,preparation,repair,seq-ranges}.ts` and remaining `src` | 37 / 10 | **High-priority ADAPT.** Versioned durable events, repair and deterministic reconstruction using existing Supabase task/activity storage. |
| `packages/session/session-checkpoint-policy/src/index.ts` | 11 / 1 | **ADAPT.** Persist recoverable checkpoints at meaningful boundaries. |
| `packages/session/session-projection/src/{index,types}.ts` | 10 / 2 | **ADAPT.** One projection for UI status, resume, verification, delivery and terminal summary. |
| `packages/session/session-format/src/{catalog,chain,context,error,json}.ts` | 18 / 8 | **ADAPT concepts/contracts.** Version persisted run data; retain old-client compatibility. |
| `packages/plan/plan-mode/src/{client,index,types}.ts` | 13 / 3 | **ADAPT narrowly.** Represent goal/constraints/plan revision; planning mode must not execute effects. |
| `packages/todo/tool-todo/src/{client,index,types}.ts` | 14 / 3 | **ADAPT if it improves task visibility.** Use a compact task plan, not a second project-management subsystem. |
| `packages/compaction/compaction-tool-result-pruner/src/{config,index,types}.ts` | 12 / 3 | **KEEP derived implementation; strengthen tests.** |
| `packages/compaction/compaction-basic/src/{region,summarizer,index}.ts` | 17 / 5 | **ADAPT after durable sessions.** Summarization must preserve constraints, permissions, unresolved effects and verification references. |
| `packages/compaction/compaction-image-offload/src/{image-offload,project-message,projection}.ts` | 13 / 4 | **ADAPT when image/context measurements justify it.** Retain references and access checks; do not silently discard evidence. |
| `packages/llm/llm/src/{adapter-failure,assembler,assistant-stream,attribution,call-config}.ts` | 32 / 13 | **ADAPT contracts/tests.** Preserve Gemini and Workers AI adapters and their terminal guarantees. |
| `packages/llm/token-meter/src/{estimate,projection,route-pricing,surface-fold}.ts` | 23 / 11 | **ADAPT accounting concepts.** Actual provider usage remains authoritative; estimates must be labeled. |
| `packages/llm/llm-retry/src/{index,types}.ts` | 15 / 3 | **ADAPT only into the single existing retry owner.** No nested retry stack. |
| `packages/host/open-in-app/src/{catalog,resolver,icons,internals,shared}.ts` | 18 / 6 | **ADAPT identity/resolution more fully.** Current icon approach alone does not solve stable app identity. |
| `packages/client/ui-input-trigger/src/core/{detect,menu}.ts`, `src/client/controller.ts` | 27 / 14 | **KEEP/ADAPT.** Fix parser parity, structured mentions, IME, accessibility and lifecycle. |
| `packages/client/ui-chat/src/client/chat/use-scroll-follow.ts` | Not separately recounted | **RETAIN reference.** Keep OCADE’s shared hook and design tokens. |
| `packages/interaction/user-approval/src/{index,types}.ts` | 11 / 2 | **ADAPT presentation/state patterns only.** OCADE owns authorization and recent-proof requirements. |
| `packages/interaction/user-questions/src/{projection,timed-wait,types}.ts` | 14 / 4 | **ADAPT selectively.** Persist pending questions and safe cancellation; no implicit timed authorization. |
| `packages/sandbox/sandbox-policy/src/{index,session-mode}.ts` | 11 / 2 | **RETAIN as design/test input.** Replace upstream authority with OCADE’s enforced broker/runtime boundary. |
| `packages/fs/fs-observation-policy/src/{index,types}.ts` | 10 / 2 | **ADAPT useful invalidation behavior.** Preserve exact-path and post-mutation verification rules. |
| `packages/mcp/mcp-client/src/{connection,server-context,tools,transport}.ts` | 26 / 5 | **Later gated INTEGRATION.** One useful authenticated connector first; cancellation, schema validation and permissions mandatory. |
| `packages/mcp/mcp-resources/src/{index,render,tools}.ts` | 11 / 3 | **With MCP only.** External resource contents remain untrusted. |
| `packages/skill/{skill,skill-filesystem,tool-skill}/src/index.ts` | 28 / 3 combined | **Later ADAPT/INTEGRATE.** Pinned, reviewed skill discovery with explicit provenance and bounded loading. |
| `packages/skill/skill-office/src/index.ts` and bundled skill material | 23 / 1 | **RETAIN useful guidance; admit selectively.** Preserve deterministic OCADE Office implementations. |
| `packages/lsp/lsp/src/{brand,index,types}.ts`, `packages/lsp/tool-lsp/src/{index,render}.ts` | 20 / 5 combined | **Optional coding capability.** Add only if coding workflows become a shipped commitment. |
| `packages/ptc-runtime/ptc-runtime/src/{index,types}.ts` | 9 / 2 | **Optional ADAPT.** Capability handles into the broker, not unrestricted execution. |
| `packages/ptc-runtime/ptc-runtime-node/src/*` | 47 / 18 | **AVOID in the Worker.** Evaluate only in a separately isolated executor after a demonstrated need. |
| `packages/subagent/subagent/src/*`, `packages/subagent/subagent-fork-in-process/src/index.ts` | 72 / 23 combined | **DEFER.** Read-only research first; parent-owned budget, cancellation and evidence. Never two GUI controllers. |
| `packages/browser-use/browser-use/src/{brand,index}.ts` | 8 / 2 | **RETAIN interface reference.** These files are not a replacement browser driver. |
| `packages/computer-use/computer-use/src/{brand,index}.ts` | 8 / 2 | **RETAIN interface reference.** Do not replace the companion with a package-name abstraction. |
| `packages/test-support/agent-loop-testkit/src/*` | 9 / 3 | **RETAIN AS TEST SOURCE.** Adapt scenarios into existing tests. |
| `packages/test-support/llm-replay/src/index.ts` | 9 / 1 | **RETAIN/ADAPT for deterministic regression replay.** Keep fixtures sanitized. |

### 5.3 Dependencies: what to keep, replace or avoid

**KEEP OCADE’s current runtime foundation**

- React, TanStack Query/Router/Start and existing Tailwind design tokens.
- Supabase client and existing server/database authorization.
- Existing Zod 3 schemas until an independently justified migration.
- Existing Python companion dependencies and deterministic document/media tooling.
- Existing `react-markdown`.
- Existing `@wllama/wllama` offline runtime, subject to actual model qualification.

**DO NOT add merely to claim integration**

- Cordis lifecycle and workspace packages.
- Upstream Zod 4 beside OCADE Zod 3 across the entire application.
- Upstream application bundles, CLI, Electron host and web frontend.
- Upstream local credential, SQLite/JSONL storage and telemetry systems.
- Multiple browser-control providers that target the same session.
- New scheduling/goal-loop packages.
- A second provider retry or user-approval engine.

**Conditional dependencies**

- The pinned MCP client package uses `@modelcontextprotocol/client` `2.2.0`; admit it only with an actual connector and reviewed transport/authentication boundary.
- PTC, LSP and subprocess packages bring executor/lifecycle dependencies. They belong behind a separately controlled runtime, not automatically in the Cloudflare request path.
- Direct adoption of the selected upstream core entails workspace peer dependencies such as Cordis, Schemastery, session projection, scope, tools and persistence. A small-looking entry package is not a small deployment closure.

The earlier core inventory estimated a **33-package closure containing 491 files, 145 under `src`**. A broader candidate inventory covered **56 packages, 833 files, 246 under `src`**. These remain evaluation envelopes—not instructions to import those counts.

**Recommended near-term footprint:** improve approximately **8–15 existing OCADE production modules**, plus their existing tests and only genuinely required migration changes. Add **zero to three small shared modules** only where a clear ownership boundary cannot fit an existing file. Do not pursue a file-count target.

### 5.4 Upstream tests worth preserving

Particularly valuable exact paths include:

- `packages/core/agent-loop/tests/cancel.spec.ts`
- `packages/core/agent-loop/tests/tool-order.spec.ts`
- `packages/core/agent-loop/tests/tool-calls.spec.ts`
- `packages/core/agent-loop/tests/request-error.spec.ts`
- `packages/core/agent-loop/tests/request-reconstruction.spec.ts`
- `packages/core/agent-loop/tests/resume.spec.ts`
- `packages/core/agent-loop/tests/resource-lifecycle.spec.ts`
- `packages/core/agent-loop/tests/shutdown-drain.spec.ts`
- `packages/core/session/tests/canonical-envelopes.spec.ts`
- `packages/core/session/tests/message-projections.spec.ts`
- `packages/core/session/tests/repair.spec.ts`
- `packages/core/session/tests/seq-ranges.spec.ts`
- `packages/compaction/compaction-tool-result-pruner/tests/tool-result-pruner.spec.ts`
- `packages/client/ui-input-trigger/tests/core-detect.client.spec.ts`
- `packages/client/ui-input-trigger/tests/core-menu.client.spec.ts`
- `packages/client/ui-input-trigger/tests/apply.client.spec.ts`

Port meaningful behavior and adversarial scenarios into OCADE’s test owners. Do not import the entire upstream test harness merely to run a handful of cases.

## 6. Architecture and exact wiring

The target remains one OCADE agent with one authority for each responsibility.

```mermaid
flowchart TD
    UI["Chat / JARVIS / Bubble / Mobile"]
    Run["Shared run lifecycle and durable task projection"]
    Model["Gemini / explicit High / permitted Chat Offline route"]
    Tools["Typed capability broker"]
    Auth["Identity, permissions, proof, quota, STOP"]
    Device["Paired Device Agent"]
    Drivers["Files / native APIs / browser / accessibility / vision"]
    Verify["Independent outcome verification"]
    Deliver["Artifact delivery and Library"]
    DB["Supabase task, action and receipt records"]

    UI --> Run
    Run --> Model
    Model --> Tools
    Tools --> Auth
    Auth --> Device
    Device --> Drivers
    Drivers --> DB
    Run <--> DB
    DB --> Verify
    Verify --> Deliver
    Deliver --> DB
    DB --> UI
    Auth -. cancellation and revocation .-> Run
    Auth -. cancellation and revocation .-> Device
```

### Required ownership

| Responsibility | Existing wiring point | Required result |
|---|---|---|
| UI turn admission and lifecycle | `JarvisWorkspace.tsx`, `JarvisBubble.tsx`, `bubble-state.ts` | One account/conversation-owned lifecycle; separate presentation remains. |
| Foreground/background progression | `engine.ts`, `agent.ts`, `background.server.ts` | Shared transition policy and persisted run interpretation. |
| Model selection and terminal validity | `src/lib/intelligence/{router,edge-handler,workers-ai,online-models}.ts` | Explicit model identity, no hidden substitution, no tools from incomplete turns. |
| Tool schema and effect classification | `src/jarvis/protocol.ts` | One canonical typed contract; generated/presented descriptions match validators. |
| Permission and recent proof | `permissions.ts`, `task-authority.server.ts`, security middleware, database predicates | Rechecked at admission and execution; model/page content cannot grant permission. |
| Device identity and cancellation | `device.server.ts`, `ocade_identity.py`, `ocade_device.py`, `ocade_agent.py` | Signed, replay-safe, revocable, bounded control-loss behavior. |
| App identity and discovery | `ocade_computer.py`, `ocade_discovery.py`, `mention.tsx` | Stable scoped references, revisioned metadata and bounded icons. |
| Verification | `task-authority.server.ts`, device read-back operations, workflow oracles | Structural and semantic evidence after the final mutation. |
| Delivery | `task-authority.server.ts`, `device.server.ts`, `background.server.ts`, Library functions | Recoverable transfer, exact identity, deduplication and truthful delivery status. |
| Memory | `jarvis.functions.ts`, `agent.ts`, existing memory storage | User-origin provenance, scope, retention and deletion. |
| Product presentation | `ChatWorkspace.tsx`, `MessageList.tsx`, `JarvisWorkspace.tsx`, `src/styles.css` | Existing OCADE colors, coherent interaction, evidence-backed status. |

### Durable run state that is still needed

Persist enough to reconstruct work without inventing or replaying effects:

- Task/run ID and schema/engine version.
- Account, conversation and selected device.
- Original goal and immutable authorization constraints.
- Structured app references.
- Actual provider/model/prompt variant.
- Plan revision and completed/unresolved steps.
- Model call IDs, tool call IDs and their terminal outcomes.
- Action IDs, receipts and unknown-effect state.
- Cancellation/revocation generation.
- Verification obligations and artifact identities.
- Delivery state and usage-settlement identity.

Extend existing records where possible. A new generic event platform is unnecessary if existing task/activity storage can satisfy these contracts.

## 7. Master coding and release checklist

**Priority meanings:** P0 blocks safe release; P1 blocks reliable promised functionality; P2 improves completeness/performance; P3 is optional expansion.

“Acceptance” below is future proof required before closing the item. Nothing here authorizes implementation or test execution.

### A. Security, schema and release identity

| ID | Priority / state | Exact owners | Remaining work and acceptance |
|---|---|---|---|
| ☐ A01 | P0 · confirmed drift | `supabase/migrations/202610*.sql`; matching verification/rollback files | Reconcile the 21 post-3-October migration files with actual production objects. Prove completion/STOP/proof/support protections on a disposable candidate first. |
| ☐ A02 | P1 · confirmed provenance gap | `supabase/migrations/`, `scripts/check-supabase-types.mjs`, `src/integrations/supabase/types.ts` | Establish staging migration provenance without blindly marking everything applied. Fresh replay and inspected schema must agree. |
| ☐ A03 | P0 · recorded unresolved exposure | `.github/workflows/cloudflare-production.yml`, `scripts/deploy.mjs`; `ENV-20-03` | Resolve the recorded exposed deployment-hook issue through the authorized owner process; prove old access cannot deploy. Do not expose the credential in evidence. |
| ☐ A04 | P0 · unqualified | `src/lib/security/{assurance-middleware,session-middleware,caller-scoped-functions}.ts`; privileged SQL functions | Review every authenticated-executable SECURITY DEFINER finding. Test direct RPC access, target-bound proof, replay, search paths, concurrent ownership changes and granular rights. |
| ☐ A05 | P1 · live configuration issue | Password auth configuration; `src/routes/auth.index.tsx`, `reset-password.tsx` | Resolve disabled leaked-password protection for supported password flows; verify recovery, throttling and safe error behavior. |
| ☐ A06 | P1 · unqualified | `src/lib/security/{sessions.functions,recovery.functions,recovery-codes,mfa}.ts` | Prove expiry, revocation, factor changes, recovery-code single use and account switches. Document and test the existing bounded session-cache behavior. |
| ☐ A07 | P0 · release prerequisite | `scripts/deploy.mjs`, `.github/workflows/cloudflare-production.yml`, `wrangler.json` | Bind deployed Worker, assets, schema and companion version to a frozen SHA. Prove approval isolation and rollback; inspect external build/deploy settings separately. |
| ☐ A08 | P1 · open | `package.json`, `package-lock.json`, `jarvis-runtime/requirements-agent.txt`, packaging files | Resolve recorded dev advisories without corrupting lockfiles. Reproduce installation/build with exact pins; audit production and build chains separately. |

### B. Agent lifecycle, recovery and STOP

| ID | Priority / state | Exact owners | Remaining work and acceptance |
|---|---|---|---|
| ☐ B01 | P1 · partial | `engine.ts`, `agent.ts`, `background.server.ts` | Share execution transitions, budgets and recovery decisions. Same event trace must produce equivalent results on both paths. Depends on A01–A02. |
| ☐ B02 | P1 · confirmed duplication | `JarvisBubble.tsx`, `JarvisWorkspace.tsx`, `bubble-state.ts`, `live-control.ts` | Consolidate turn ownership/admission/settlement; preserve distinct views. Test late callbacks, account changes, navigation, double-send and handover. |
| ☐ B03 | P1 · partial | `engine.ts` checkpoint helpers; `background.server.ts`; task/activity persistence | Persist complete resumable state with versioning and tool-call pairing. Kill/restart at every meaningful boundary without repeating effects. |
| ☐ B04 | P0 qualification | `live-control.ts`, `task-authority.server.ts`, `device.server.ts`, `ocade_device.py`, `ocade_agent.py` | Measure STOP from Workspace, Bubble, tray and mobile during queued, running and blocked calls. No new action admission after authoritative STOP; in-flight effects accurately reconciled. |
| ☐ B05 | P1 · risk | `engine.ts`, `agent.ts` | Preserve completed parallel read results when a sibling fails; record every call’s final state. Test abort before admission and during execution. |
| ☐ B06 | P1 · partial | `task-authority.server.ts`, `ocade_device.py`, Android `AgentService.java` | Ensure action IDs/receipts survive lost replies, process death and reconnect. Unknown external effects require observation/reconciliation, not blind retry. |
| ☐ B07 | P1 · partial | `live-deps.ts`, `JarvisWorkspace.tsx`, existing scheduling functions | Separate short retries within an active authorized run from future automatic continuation. Manual-only settings must survive restart and account switch. No schedule may be created implicitly. |
| ☐ B08 | P1 · risk | `background.server.ts` action limits and finishing marker | Reserve deterministic settlement/delivery capacity or distinguish its budget from planner actions. A nearly exhausted task must not strand verified outputs silently. |
| ☐ B09 | P1 · partial | `protocol.ts`, `permissions.ts`, `ocade_protocol.json` | Keep schema, descriptions and Python/Android decoding aligned. Unknown fields must fail explicitly rather than be silently dropped into a no-op success. |
| ☐ B10 | P2 · partial | `engine.ts`, provider message construction, task projections | Add evidence-preserving context budgets/offload only after measurement. Long sessions retain constraints, pending questions, exact tool IDs and artifact references. |

### C. Verification, files and delivery

| ID | Priority / state | Exact owners | Remaining work and acceptance |
|---|---|---|---|
| ☐ C01 | P1 · confirmed | `task-authority.server.ts` — `deliveriesDue` | Fix F04 exact-path identity. Distinct valid filesystem names remain distinct throughout mutation, verification and delivery. |
| ☐ C02 | P1 · confirmed | `task-authority.server.ts`, `background.server.ts` | Fix F05 failure-as-empty and finishing-marker failure. Delivery becomes resumable and explicitly partial on failure. |
| ☐ C03 | P1 · confirmed precedence problem | `agent.ts`, `background.server.ts`, task cards | Fix F06. Terminal wording derives from verified results and actual delivered artifacts. |
| ☐ C04 | P1 · recorded orphan risk | `device.server.ts`; `src/lib/library/{library.functions,tombstones.server}.ts` | Reconcile uploads whose task never settles. Use existing storage cleanup machinery where suitable; test retry, abort, erasure and duplicate delivery. |
| ☐ C05 | P0/P1 · semantic gap | `task-authority.server.ts`; `experiments/architectures/oracle_{sheet,doc,video,photo,cad}.py` | Add fixed independent checks for supported workflows. Existence, sheet names and nonempty rows are insufficient for correct calculations or reconciliations. |
| ☐ C06 | P1 · partial | `ocade_sheets.py`, `actions/ocade_workbook.ps1`, `ocade_documents.py`, `actions/ocade_document.ps1` | Validate formulas, recalculation, values, styles, charts, layout and reopened files in actual supported applications. Preserve originals byte-for-byte where required. |
| ☐ C07 | P1 · missing native path | `ocade_documents.py`, `actions/ocade_document.ps1`, `actions/ocade_workbook.ps1` | Implement/qualify native Microsoft Office PDF export where promised; retain LibreOffice fallback with truthful provenance. |
| ☐ C08 | P1 · partial | `ocade_computer.py`, file actions and verification | Complete overwrite, external-change, symlink, ancestor-mutation, undo/trash and time-of-check/time-of-use tests. Never claim untouched after a partial mutation. |
| ☐ C09 | P1 · recorded failures | `ocade_media.py`, `ocade_documents.py`, media oracles | Finish video captions/audio/duration/project reliability; repair spreadsheet output errors and CAD semantic quality. Reopen final and editable project files independently. |
| ☐ C10 | P1 · partial | `agent.ts`, `background.server.ts`, file result display | Persist per-artifact production method. Named-app requests must use that app or clearly disclose the actual substitute before claiming fulfillment. |
| ☐ C11 | P1 · unqualified | `src/lib/library/library.functions.ts`, `src/routes/_authenticated/library.tsx` | Prove private preview/Open/Download, exact bytes/names, expired access, pagination, deleted objects and storage outages. No other-account artifact access. |

### D. Models, intelligence, capacity and offline operation

| ID | Priority / state | Exact owners | Remaining work and acceptance |
|---|---|---|---|
| ☐ D01 | P1 · partial | `src/lib/intelligence/{edge-handler,online-models,online-client,contract}.ts` | Qualify the exact configured Gemini model and all key-slot failure modes. No key rotation to evade shared quota; no tool execution from incomplete/empty/refused responses. |
| ☐ D02 | P1 · blocked | `workers-ai.ts`, `quality.ts`, `QualityControl.tsx`, `router.ts` | Establish actual Gemma High availability and included capacity. Test fragmented calls, terminal handling, screenshots, reasoning isolation and accounting. Fail closed when capacity cannot be verified. |
| ☐ D03 | P1 · confirmed partial fix | `src/jarvis/live-deps.ts` | Scope research capability observations correctly; clear on relevant changes. Test both provider and account transitions. |
| ☐ D04 | P1 · capacity blocker | `edge-handler.ts`, `live-deps.ts`, commercial usage policy | One overall retry deadline/budget; distinguish temporary overload from daily exhaustion. Verify no retry storms, hidden model switching or duplicate charging. |
| ☐ D05 | P1 · unqualified | `src/lib/commercial/{generation-gate,supabase-ledger,entitlement-resolver,usage-policy}.ts` | Measure actual cost per verified task and sustainable concurrency. Free-project quota is not a paying-customer capacity plan. |
| ☐ D06 | P2 · experimental | `src/lib/intelligence/system-prompt.ts`, `online-client.ts`, `agent.ts`, `background.server.ts` | Compare default, V2 and unified prompts on fixed code and identical tasks. Select by verified success, false completion and total cost; align foreground/background prompt identity. |
| ☐ D07 | P1 · blocked | `release/OCADE_OFFLINE_RELEASE.json`, `offline-release.functions.ts`, `src/routes/api/offline/bytes.$release.ts`, `wrangler.json` | Qualify the actual signed OCADE model through the private R2 binding. A stand-in model only validates the transport pipeline. |
| ☐ D08 | P1 · partial | `src/lib/brain/{model-transfer,model-store,model-vault,installation-authority,runtime-activation}.ts`; `adapters/browser-wasm.ts` | Test interrupted/resumed download, signatures/hash, insufficient disk/RAM, concurrent tabs, corruption quarantine, upgrade and complete removal. |
| ☐ D09 | P1 · recorded failure | `public/sw.js`, `public/offline.html`, `scripts/e2e/{shell,offline-real}-journey.mjs` | Localize `SHELL-23-01` using the complete failing sequence. Previously prepared Chat must reopen and run the real model offline without stale private data. |
| ☐ D10 | P1 · unqualified | `src/lib/chat/use-chat.ts`, `src/lib/intelligence/{router,offline-transport}.ts` | Qualify Auto/Online/Offline separately; preserve meaningful partial output rules and explicit consent. Test real answer quality and Indian-language cases, not merely emitted text. |

### E. Browser, PC and application discovery

| ID | Priority / state | Exact owners | Remaining work and acceptance |
|---|---|---|---|
| ☐ E01 | P1 · confirmed | `ocade_device.py`, `device.server.ts`, `ocade_computer.py` | Fix icon aggregate budget and persistence acknowledgement, F02–F03. Core control exchange remains independent of optional metadata. |
| ☐ E02 | P1 · partial | `ocade_computer.py`, `ocade_discovery.py`, device schema | Introduce stable, scoped app identities and inventory revisions; retain names for display. Handle duplicate names, version changes, moved executables and stale catalogs. |
| ☐ E03 | P1 · confirmed | `mention.tsx`, `JarvisWorkspace.tsx`, `bubble-state.ts`, persisted turn contract | Fix F07; retain app/device choices through failure, retry, history and handover. Explicitly handle multiple devices. |
| ☐ E04 | P2 · confirmed | `mention.tsx`, `jarvis.functions.ts` | Fix F08 catalog caching; display offline/revoked/stale states honestly. |
| ☐ E05 | P1 · unqualified | `ocade_computer.py` icon extraction; native packaging | Qualify Windows shortcuts/UWP, macOS ICNS and Linux desktop icons, including missing/corrupt/oversized data. A generic fallback is acceptable and must not prevent operation. |
| ☐ E06 | P1 · partial | `ocade_existing_browser.py`, `actions/ocade_page.js`, `ocade_device.py` | Prove tab/window identity, redirects, popups, file upload/download, existing-session access and account isolation. Never copy cookies or bypass CAPTCHA/human verification. |
| ☐ E07 | P1 · partial | `ocade_accessibility.py`, `ocade_computer.py` | Qualify Windows UI Automation and supported macOS accessibility behavior; stale observations and wrong-window actions must refuse safely. |
| ☐ E08 | P0/P1 · platform boundary | `ocade_computer.py` command execution; `ocade_egress.py` | Preserve current disclosures and confirmation rules. Windows/macOS workspace argument checks are not an OS sandbox. Either implement/prove confinement for general generated code or restrict the shipped claim/capability. |
| ☐ E09 | P1 · partial | `ocade_discovery.py` learned recipes; execution selection | Prove unfamiliar-app operation using actual discovered APIs/docs/accessibility. Recipes must expire on incompatible changes and never retain secrets, private content or reusable coordinates. |
| ☐ E10 | P1 · unqualified | `ocade_update.py`, `ocade_identity.py`, `packaging/release.py`, Windows `.iss`, macOS `build.sh`/entitlements | Produce and qualify signed install/update/rollback/uninstall flows on real supported platforms. Verify signature failure, interrupted update, old-client compatibility and preservation of customer work. |

The existing discovery implementation already enumerates Windows Start applications/shortcuts, macOS application bundles and Linux desktop entries. It should not be described as merely a hardcoded app list.

What remains weak is **identity, freshness, capability quality and qualification**, not the complete absence of dynamic discovery.

### F. Chat, UI/UX, voice and mobile

| ID | Priority / state | Exact owners | Remaining work and acceptance |
|---|---|---|---|
| ☐ F01 | P1 · partial | `ChatWorkspace.tsx`, `MessageList.tsx`, `JarvisWorkspace.tsx`, conversation lists/panels | Finish one coherent conversation/navigation experience while preserving Chat/JARVIS capability differences. Handover must preserve intended context and attachments without accidental execution. |
| ☐ F02 | P1 · recorded flakiness | `JarvisWorkspace.tsx`, settings dialog, `scripts/e2e/jarvis-journey.mjs` | Localize capacity-message, exhausted-allowance and Settings→Devices failures. Do not close on a passing rerun or add sleeps as the fix. |
| ☐ F03 | P2 · partial | `src/styles.css`, `src/lib/appearance.tsx`, `use-follow-bottom.ts`, existing Chat/JARVIS components | Complete typography, spacing, mobile layout, long messages, tables/code, reduced motion and light/dark consistency using existing OCADE colors. No new design system dependency. |
| ☐ F04 | P1 · unqualified | Existing dialogs, menus, mention combobox and task controls; visual/polish/control journeys | Keyboard-only and screen-reader flows; focus restoration; live announcements; accessible STOP and error recovery; 200% zoom and narrow layouts. |
| ☐ F05 | P1 · partial | `src/jarvis/use-voice.ts`, `src/lib/chat/use-dictation.ts`, Voice settings | Prove recognition, TTS, interruption, mute/end, permission denial, late callbacks and text continuity on supported browsers. One microphone/session owner. |
| ☐ F06 | P2/P1 if advertised | `use-voice.ts`, `ocade_wake.py`, `android/.../WakeService.java`, `WakeModel.java` | Qualify wake false accepts/rejects, battery/privacy and real accents/languages. A licensed natural voice is additional provider/licensing work, not delivered by browser TTS alone. |
| ☐ F07 | P1 · partial | `android/src/in/ocade/app/{AgentService,Control,Identity,OcadeAccessibility,MainActivity,Bubble}.java` | Complete Android install, permissions, real gestures, process death, reboot, reconnect, durable receipts and STOP. Emulator and physical-device evidence must remain distinct. |
| ☐ F08 | P1 · unqualified | PWA routes, `public/sw.js`, manifest, `docs/MOBILE_DEVICE_CONTROL.md` | Qualify Safari/iOS PWA and remote-PC flows. Do not promise arbitrary local iPhone control or a system-wide overlay. |
| ☐ F09 | P1 · unqualified | `src/lib/notifications/{send.server,web-push,delivery,preference-sync}.ts` | Real push/email provider tests, revocation, expiry, retries and notification preferences. No messages after permission/account revocation; delivery failures visible. |
| ☐ F10 | P1 · unqualified | Shared account/task state; device routes and Android lifecycle | Cross-device history, mobile-to-PC control, sleep/disconnect/reconnect and concurrent user interference. Exactly one controller owns a shared interactive resource. |

### G. Memory, authentication, administration and customer data

| ID | Priority / state | Exact owners | Remaining work and acceptance |
|---|---|---|---|
| ☐ G01 | P1 · partial | `jarvis.functions.ts`, `protocol.ts`, `agent.ts`, memory UI/storage | Fix memory provenance and lifecycle, F10. Verify inspect/delete/disable behavior and no cross-account leakage. |
| ☐ G02 | P1 · recorded configuration mismatch | `auth.index.tsx`, `auth.verify.tsx`, `auth.callback.tsx`, `src/lib/auth/{otp,provider-availability,recovery-link}.ts` | Align numeric-code UX with actual email templates; qualify Google callbacks, expired codes, resend, recovery and safe redirect handling. |
| ☐ G03 | P0 qualification | Supabase RLS/policies; `session-middleware.ts`; account-scoped functions | Cross-account conversation, file, device, memory, support and subscription access tests through both UI and direct APIs. |
| ☐ G04 | P1 · partial | `src/lib/admin/{access.functions,staff.functions,route-gate}.ts`, `ConsoleModules.tsx`, admin route | Prove each role’s read/write reach, proof target, owner transfer, support consent expiry, revocation and audit record. Localize recorded ownership-journey flakiness. |
| ☐ G05 | P1 · unqualified | `src/lib/account/erase.server.ts`, Library tombstones, account export/settings | Complete large export, interrupted deletion, storage failure, identity-last removal and retention reconciliation. “Pending” must never become “erased” without proof. |
| ☐ G06 | P1 · operational | Existing database/storage backup and recovery configuration; testing/security contracts | Rehearse restore and verify tenant isolation, retention and erasure obligations after restoration. Define and measure recovery objectives. |
| ☐ G07 | P1 · unqualified | `device.server.ts`, task/frame storage, logs and notifications | Prove screenshot/frame expiry, secret redaction, log access control and deletion. Installed-app inventory is also customer data. |

### H. Commercial launch, infrastructure and operations

| ID | Priority / state | Exact owners | Remaining work and acceptance |
|---|---|---|---|
| ☐ H01 | P0 for paid launch | `src/lib/payments/pricing.ts`, `BillingSection.tsx`, `src/routes/pricing.tsx`, commercial policies | Resolve conflicting historical plan names/prices with one approved catalog. Keep current code behavior until authorized. Marketing, entitlement and billing must agree. |
| ☐ H02 | P0 for paid launch · missing | Existing commercial/ledger boundaries; future chosen provider integration | Implement sandbox checkout and verified webhook processing only after merchant/provider approval. Test duplicate, reordered, forged, delayed and missing events. |
| ☐ H03 | P0 for paid launch · missing | Entitlement resolver, subscription ledger and billing UI | Complete upgrades, downgrades, renewal, cancellation, refund, failed payment, expiry and reconciliation. An admin grant is not a purchased subscription. |
| ☐ H04 | P0 qualification | `generation-gate.ts`, usage/lease functions and SQL | Prove one charge per server-verified task; no charge for stopped/failed/unverified/duplicate work. Test concurrency across tabs/devices and crash recovery. |
| ☐ H05 | P1 · capacity requirement | Cloudflare Worker/R2, Supabase connections/storage, provider routing | Load-test intended concurrency, request sizes, query bounds and failure recovery. Alert on exhaustion; keep spend ceilings enforceable. |
| ☐ H06 | P1 · unqualified | `wrangler.json`, observability/error paths, existing operations surfaces | Correlate task/model/action/delivery failures without storing sensitive payloads. Establish owner-visible outage and incident signals. |
| ☐ H07 | P0 for launch | Privacy/terms routes, `LegalContent.tsx`, `legal-document-meta.ts`, `docs/SUPPORT_LEGAL_SECURITY.md` | Qualified review of privacy, consumer, payment, tax, cancellation/refund, remote-control consent, subprocessors and applicable jurisdictions. Confirm operational behavior matches published terms. |
| ☐ H08 | P0 for distribution | Upstream/root notices, `THIRD_PARTY_NOTICES.md`, package locks, runtime pins, model release | Complete a distribution-specific license/SBOM review: code, models, browser binaries, fonts, media, codecs, native utilities and signing assets. |
| ☐ H09 | P1 · operational | Help/support routes, console cases, notifications | Prove customer contact, support-case lifecycle, consented access, security reporting, deletion/refund handling and response ownership. |
| ☐ H10 | P0 release gate | `scripts/verify-full.mjs`, existing journeys/oracles, `docs/TESTING.md` | Freeze one candidate, run authorized exact-environment qualification, resolve unexplained failures, conduct independent review, pilot, rollback rehearsal and final approval. |

### I. Optional DeepSeek expansion—after the core product works

| ID | Priority | Existing integration boundary | Admission condition |
|---|---|---|---|
| ☐ I01 | P2 | Durable sessions/context in `engine.ts` and existing persistence | Adopt more session/projection/compaction behavior after B01–B03 and C01–C05. |
| ☐ I02 | P2 | Typed tools, user questions and approval presentation | Use upstream schema/presentation patterns only if they remove duplication and preserve broker authority. |
| ☐ I03 | P3 | MCP/skills behind the existing capability broker | One connector/skill must demonstrably complete a required task better; pin, review, scope and revoke it. |
| ☐ I04 | P3 | Isolated programmatic executor | PTC must reduce measured model round trips without broadening filesystem/network authority. |
| ☐ I05 | P3 | Coding-specific tooling | LSP only for a real coding-product commitment; preserve language-server sandboxing and cancellation. |
| ☐ I06 | P3 | Parent-owned read-only delegation | Subagents only after cost, cancellation, isolation and evidence merging are proven. No concurrent control of the same desktop. |

These optional items are not excuses to postpone correcting the existing product.

### Coverage of the existing 200-item ledger

The checklist above groups rather than duplicates the 200 requirements:

| Existing requirement range | Covered principally by |
|---|---|
| 1–25: reliability, models, capacity, architecture | B, C, D |
| 26–44: task intelligence, control, recovery, verification | B, C, E |
| 45–57: Chat, research, files, memory, voice | D, F, G |
| 58–74: documents, media, unfamiliar apps, deliverables | C, E |
| 75–85: actual offline model | D07–D10 |
| 86–100: desktop/mobile installation and lifecycle | E10, F07–F10 |
| 101–113: UI and accessibility | F01–F04 |
| 114–130: authentication and security | A, B04–B06, G |
| 131–144: entitlements, cost and payments | D05, H01–H04 |
| 145–157: performance, infrastructure and recovery | B, D, E, G06, H05–H06 |
| 158–174: complete qualification | All acceptance conditions, H10 |
| 175–189: legal, support and pilot | H07–H10 |
| 190–200: comparisons, cleanup, independent review and launch | I, Sections 8–11, H10 |

References to `phases.md` and “200 + 190” requirements remain in repository documents, but the current tree does not contain the referenced `phases.md`. The 200-item ledger is present and reviewed. Missing source text for any additional requirement set must be recovered from its existing provenance before claiming complete traceability; it must not be reconstructed from guesswork.

## 8. What to keep, consolidate, remove or avoid

### KEEP

- `task-authority.server.ts` as the final task-settlement authority.
- Server and device permission checks, recent proof, replay protection and STOP enforcement.
- Exact `filledRows`, fresh read-back and mutation-invalidation safeguards.
- Existing provider terminal validation and explicit Gemini/High routing.
- Dynamic app discovery and platform launch resolution.
- Typed Office, spreadsheet, PDF and media adapters with useful deterministic behavior.
- Existing signed-release/update/identity machinery.
- Existing account isolation, RLS, audit and deletion mechanisms.
- Existing React/Tailwind components and OCADE color tokens.
- Regression tests, migration history, license notices and meaningful incident evidence.

### CONSOLIDATE after parity tests

| Current duplication | Canonical replacement | Proof before retirement |
|---|---|---|
| Foreground/background execution decisions | Shared run transition policy in existing engine/task owners | Equivalent traces, STOP, restart, delivery and charging. |
| Bubble/Workspace admission and cleanup | One account-owned run lifecycle | Navigation, late callbacks, handover, double-send and account switch. |
| Final model prose versus task/delivery status | One terminal result projection | Contradictory model output cannot mislabel completion. |
| Tool descriptions versus validator behavior | Shared schema-driven presentation where practical | Unknown fields refused; correct provider schemas; no capability expansion. |
| App-name matching scattered through UI | Structured app references and one parser | Duplicate names, Unicode, multiple devices and reload. |
| Retry layers | One overall retry budget/deadline | No multiplied requests; correct Retry-After; STOP interrupts waits. |
| Redundant observations/context | Bounded event projection and retrieval | Equivalent task quality and preserved evidence. |

### REMOVE only when callers and replacement proof exist

- Superseded lifecycle branches after the canonical lifecycle passes.
- Unused experimental planner/prompt code after a measured decision and reference check.
- Repeated summaries that no longer feed model context, history or customer evidence.
- Dead UI/control paths after reachability and accessibility proof.
- Unused dependencies established by build/caller evidence.

**No whole OCADE subsystem is presently proven safe to delete simply because DeepSeek has a similarly named package.**

### AVOID

- Replacing the companion with Harness browser/computer interface packages.
- Deleting `ocade_media.py`, `ocade_sheets.py` or `ocade_documents.py` before a better replacement proves fidelity and safety.
- A simultaneous React/TanStack/Zod/Cordis migration.
- A new event bus, workflow platform or plugin marketplace before the core workflows are reliable.
- Hardcoded app permission decisions based solely on brand-name regexes.
- Raising sequence limits merely to reduce model calls without local cancellation and resource-control proof.
- Silent paid inference or new provider accounts.
- Automatic schedules, background wakeups or continuation policies not explicitly authorized.
- Treating more tests, more files or more upstream packages as higher product completion.

## 9. Dependency-ordered implementation roadmap

### Phase 0 — Establish the exact candidate and safe database baseline

**Work:** A01–A08; requirement/provenance reconciliation.

**Completion conditions:**

- Candidate SHA, schema version, Worker/asset identity and companion protocol are recorded together.
- Fresh database replay succeeds.
- Staging matches the intended candidate.
- Critical completion, STOP, proof and support predicates pass direct negative tests.
- Deployment access exposure and approval isolation are resolved through the authorized process.
- No implementation permission is inferred from this audit.

**Planning effort:** 1–2 engineer-weeks, excluding owner-controlled access/remediation lead time.

### Phase 1 — Repair the newly introduced integration defects

**Work:** F02–F08 findings; C01–C04; E01–E04.

**Completion conditions:**

- Large app catalogs cannot break control traffic.
- Failed icon writes retry correctly.
- App/device selection survives message-save failure and reload.
- Exact filesystem identity survives delivery.
- Database outages produce pending/partial delivery, not empty success.
- Final status and prose agree with server verification and actual artifacts.

**Planning effort:** 1–2 engineer-weeks.

### Phase 2 — Finish one execution and recovery lifecycle

**Work:** B01–B10; G01; DeepSeek session/projection adaptation.

**Completion conditions:**

- Foreground/background/bubble/workspace consume equivalent persisted state.
- Restart tests cover every model/action/receipt/delivery boundary.
- Unknown effects are reconciled.
- STOP, permission revocation and account switches cannot revive old work.
- Context reduction preserves goal, constraints, evidence and pending work.
- No new optional ecosystem dependency is required for this phase.

**Planning effort:** 2–4 engineer-weeks.

### Phase 3 — Make the core customer workflows genuinely reliable

**Work:** C05–C11; E06–E09; D01–D06.

Prioritize:

1. Spreadsheet reconciliation and correct formulas.
2. Spreadsheet → editable document → PDF.
3. Browser research → structured report/spreadsheet with citations.
4. Correct output delivery and reopening.
5. Image/video tasks within the advertised scope.
6. Unfamiliar application tasks and CAD only with honest capability boundaries.

**Completion conditions:**

- Independent semantic oracles pass.
- Originals and user edits are preserved.
- Named-editor requirements are satisfied or substitutions disclosed accurately.
- No false completion in the frozen qualification corpus.
- Required workflow families meet the repository’s ≥95% success gate.
- Quota interruptions are reported and recovered without duplicate work.

**Planning effort:** 3–5 engineer-weeks; model availability may dominate calendar time.

### Phase 4 — Qualify model capacity, High and actual Offline

**Work:** D02, D04–D10, H04–H06.

**Completion conditions:**

- Standard, High and Offline each pass their own tests.
- Actual offline artifact installs, survives restart and answers with the network disabled.
- Provider quotas/costs support the proposed customer load.
- Retry and outage behavior is bounded.
- Measured p50/p95 latency and cost per verified task exist.
- The sequence-dependent offline-shell failure is resolved.

**Planning effort:** 2–4 engineer-weeks.

### Phase 5 — Complete desktop/browser distribution and control

**Work:** E05–E10; native STOP and Office tests.

**Completion conditions:**

- Signed Windows/macOS packages install, pair, update, roll back and uninstall.
- Native Office and browser tasks pass on supported versions.
- Wrong-window, stale-observation, user-input and disconnection cases are safe.
- Any generated-code confinement claim is independently proven.
- Unsupported platform behavior is disabled or explicitly excluded from claims.

**Planning effort:** 4–7 engineer-weeks plus signing and hardware lead time.

### Phase 6 — Finish UI, voice, mobile and customer account operations

**Work:** F01–F10; G02–G07.

**Completion conditions:**

- Complete keyboard/screen-reader/mobile customer journeys.
- No unexplained journey flakiness.
- Voice end/pause/interrupt never revives the microphone unexpectedly.
- Android lifecycle and physical-device qualification complete.
- iOS claims match Apple-permitted functionality.
- Export, erasure, recovery, staff access and notifications work under failure.

**Planning effort:** 4–7 engineer-weeks.

### Phase 7 — Complete commerce and launch operations

**Work:** H01–H09.

**Completion conditions:**

- Approved catalog and merchant.
- Sandbox payment lifecycle and webhook reconciliation pass.
- Entitlements and usage remain correct under concurrency and retries.
- Legal, license, privacy, support and incident requirements are operational.
- Capacity and economics support paying customers.
- Any live transaction or production change remains separately authorized.

**Planning effort:** 3–5 engineer-weeks plus commercial/legal lead time.

### Phase 8 — Independent qualification and controlled launch decision

**Work:** H10; complete frozen release gates.

**Completion conditions:**

- Exact candidate passes required suites and real workflows.
- No unresolved critical/major defect or unexplained required-test failure.
- Independent adversarial review complete.
- At least five consenting pilot users complete the required pilot.
- Rollback and restore rehearsals pass.
- Public claims match the qualified scope.
- Owner explicitly approves launch.

**Planning effort:** 3–5 engineer-weeks, including qualification work; pilot elapsed time remains additional where required.

**Overall planning range:** approximately **23–41 engineer-weeks** for the broad currently promised product, with substantial uncertainty around native platforms, semantic task quality, commerce and access. Some work can proceed in parallel after Phases 0–2. This is an effort estimate, not a completion percentage or delivery promise.

Optional MCP/PTC/LSP/subagent expansion is additional work and should not delay fixing the existing product.

## 10. Performance and competitor benchmarks

### 10.1 Changes likely to improve speed

These are hypotheses to measure, not achieved results.

| Change | Expected mechanism | Measure |
|---|---|---|
| Bounded parallel independent reads | Overlap research/document latency | Wall time versus the same serialized calls; preserved result order. |
| Deterministic delivery | Avoid a model turn merely to transfer finished files | Model calls and time between verified result and downloadable artifact. |
| Shared durable session projection | Avoid reconstructing large histories repeatedly | Resume latency, database reads and prompt tokens. |
| Better tool schemas | Reduce invalid calls and no-op “successes” | Validation failures and model calls per verified task. |
| Native API/file operations before GUI | Reduce interaction count and visual ambiguity | Total task time, fidelity and human interventions. |
| Revisioned app catalogs/icons | Avoid repeated scans and large exchange payloads | Exchange bytes, catalog freshness and control latency. |
| Evidence-preserving compaction | Reduce repeated prompt/context cost | Input tokens and success on long tasks. |
| One retry budget | Prevent multiplicative upstream attempts | Requests per failure, delay, cancellation latency and cost. |
| Targeted state refresh | Reduce unnecessary polling/screenshots | Requests, CPU, transfer volume and freshness under reconnect. |

Do not raise the 12-action segment limit, introduce PTC or parallelize device actions until measured bottlenecks justify it.

### 10.2 Competitive context

Official documentation shows that competitors already offer substantial combinations of computer access, tools, files, permissions and ongoing work. OCADE’s opportunity is to demonstrate superior outcomes on a defined customer workload.

| Comparator | Relevant reference point | OCADE benchmark to pursue |
|---|---|---|
| **ChatGPT Agent / Work** | Tool-mediated work and controlled computer access. OpenAI’s integration guidance emphasizes actual observations, execution controls and evaluation of success/time/recovery. [Official integration guidance](https://developers.openai.com/api/docs/guides/tools-computer-use-integration#use-your-own-ui-tools) | Better verified completion, fewer interventions and lower cost on the same local Office/browser task suite. Do not infer product limitations from API examples. |
| **Claude / Code / Cowork** | Official guidance describes connectors, browser and screen interaction, including local applications. [Claude computer-use documentation](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork) | Native file fidelity, exact application targeting, reliable STOP and restart without duplicate changes. |
| **Gemini** | Google documents computer use in Gemini 3.5 Flash across browser/mobile/desktop agent scenarios. [Google announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-computer-use-gemini-3-5-flash/) | Compare complete products and orchestration separately from model capability. Test output quality, latency, quotas and UI recovery. |
| **Manus** | Browser Operator supports an authorized local-browser workflow and user intervention. [Manus Browser Operator](https://manus.im/blog/manus-browser-operator) | Cross-app local document fidelity, browser-to-PC continuity and independently verified artifacts. |
| **Muse** | Meta describes a persistent isolated computer/browser and goal-oriented work. [Muse](https://ai.meta.com/muse) | Explicitly scoped local-PC workflows, portable artifacts, reliable resume and measurable privacy/control behavior. |
| **Dots** | Official documentation distinguishes a cloud computer, connected local computer and app/plugin permissions. [Dots computers and apps](https://learn.chatgpt.com/docs/dots#its-computer-and-yours) | Manual-continuation compliance, task-state transparency, device identity and safe multi-device workflows. Always-on operation is not an OCADE default under current owner policy. |
| **Grok Bot** | Official announcement describes agents with computers, memory and cross-app work. [Grok Bot](https://x.ai/news/introducing-grok-bot) | Artifact correctness, permission adherence, cost predictability and recovery on matched tasks. No comparative result is established. |
| **OpenClaw** | Its documentation emphasizes pairing, tool scope, sandboxing and plugin trust. [Security and access control](https://docs.openclaw.ai/help/faq/security-and-access-control) | Easier safe onboarding, stronger tenant isolation, bounded plugin authority and verifiable result delivery. |
| **Codex, Cursor, Devin** | Include when OCADE claims coding-agent competitiveness. | Repository tasks with tests, reviewable diffs, dependency safety and accurate validation reports. LSP/subagents alone do not establish parity. |
| **Perplexity Comet** | Include for browser/research competition. | Citation quality, authenticated browser workflow correctness, action provenance and safe takeover. |

No head-to-head results were produced in this audit. Product tiers, versions, available capabilities and account restrictions must be recorded when benchmark runs are authorized.

### 10.3 Benchmark design

Run two distinct experiments:

1. **OCADE architecture A/B:** same actual model, tools, tasks, devices, quotas and oracles; change only the orchestration/integration.
2. **Product comparison:** actual available competitor products, with their normal capabilities and disclosed constraints.

Use held-out cases across:

- Research and citation verification.
- Spreadsheet reconciliation and formula correctness.
- Editable documents, presentations and PDF layout.
- Browser forms/downloads with account boundaries.
- Unfamiliar local applications.
- Image/video editing and editable project output.
- Long-running/restarted tasks.
- STOP, revocation, prompt injection and unknown-effect recovery.
- Offline installation and actual offline answers.
- Accessibility, onboarding and mobile handover.

Report:

- Verified success and denominator by family.
- False-completion rate.
- Wrong-target or unauthorized effects.
- p50/p95 end-to-end completion time.
- Model calls and input/output tokens.
- Total cost per verified successful task.
- Human interventions and confirmations.
- Duplicate side effects after retries.
- Recovery success after injected failures.
- Artifact fidelity and original-file preservation.
- BLOCKED/unsupported cases separately.

### Proposed measurable superiority criteria

These are proposed targets, not current results:

- Meet the existing **≥95% independently verified success per major workflow family**.
- Observe **zero false completions and zero unauthorized effects** in the frozen release corpus; report sample size and statistical uncertainty.
- For architecture promotion, demonstrate at least a meaningful measured latency/cost improvement—such as **20% lower median time or cost**—with no material loss in success, safety or p95 behavior.
- Measure STOP acknowledgement separately from the time an already-running external operation actually ceases.
- Demonstrate restart recovery without duplicate irreversible effects across a predefined fault-injection matrix.
- Require at least 30 varied tasks per major family for an initial estimate; larger samples and confidence intervals are necessary for strong comparative claims.

The current few successful photo/video/Office cases are useful engineering evidence, not a competitive success rate.

## 11. Release gates and final assessment

### Current qualified release status

| Gate | Requirement | Audit assessment |
|---|---|---|
| R1 | Exact-candidate full verification and reproducible build | **Not qualified.** Recorded suites exist; exact dependency/environment and complete release proof remain. |
| R2 | Real staged account/auth/tenant/commercial journeys | **Not qualified.** Schema provenance, authentication and commercial work remain. |
| R3 | Both provider protocols, all slots, quotas and cost guard | **Partial / not qualified.** Some real slot evidence exists; High/capacity qualification remains. |
| R4 | ≥95% real-task success per major family | **Not qualified.** Current semantic failures and insufficient samples prevent passage. |
| R5 | Native history/restart/ownership/STOP/unknown-effect recovery | **Partial / not qualified.** New delivery work does not close the complete matrix. |
| R6 | Signed Windows/macOS install/update/rollback | **Blocked / unqualified.** |
| R7 | Android and supported iOS lifecycle/control | **Blocked / unqualified.** |
| R8 | Completed independent security triage | **Not qualified.** Production schema drift, exposure/configuration work and independent review remain. |
| R9 | Approved deployment isolation and rollback rehearsal | **Not qualified.** |
| R10 | Capacity, privacy, support and commercial acceptance | **Not qualified.** Paid launch functionality and operational evidence remain. |

The repository’s latest requirement ledger records **0 of 10 release gates qualified**. This audit provides no basis to promote any complete gate to PASS.

### Verified progress

- Five additional commits implement a coherent first integration slice.
- DeepSeek-derived scheduling, pruning and mention behavior exist.
- Durable file handover has materially improved.
- Markdown, draft handover and scrolling improve the customer experience.
- Native discovery, typed tool execution, permissions, STOP, verification and commercial accounting already have substantial implementation worth preserving.
- The new integration adds no upstream runtime dependency stack.
- Licensing attribution for the admitted derived code exists.
- The source and ledgers honestly preserve many unresolved tests.

### What prevents a 100% production-ready claim

1. **Production does not match important current security contracts.**
2. **Staging lacks reproducible migration history.**
3. **New icon transport and acknowledgement defects affect device reliability.**
4. **Delivery identity, failure handling and final-result presentation remain incomplete.**
5. **Execution and resume ownership remain duplicated.**
6. **Independent semantic verification is insufficient for several promised workflows.**
7. **Real-task reliability has not met the frozen family-level gate.**
8. **High mode, actual Offline and sustainable paid capacity remain unqualified.**
9. **Signed native distribution, platform lifecycle and real STOP testing remain incomplete.**
10. **Payments, subscriptions, legal/commercial acceptance and operational rehearsal remain unfinished.**
11. **Known flakiness and the offline-shell failure remain unexplained.**
12. **No authorized head-to-head benchmark establishes competitive superiority.**

**Recommended next authorized coding milestone:** complete Phases 0–2 and demonstrate one end-to-end workflow—real input, correct multi-app execution, independent verification, reliable delivery, interruption/restart and STOP—on a reproducible candidate. Expand proven capability from that foundation while preserving the complete backlog above.