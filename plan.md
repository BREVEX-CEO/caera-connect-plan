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
