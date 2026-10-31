# OCADE JARVIS — Canonical Engineering Architecture, Wiring and Gate-First Implementation Plan

> **Binding owner contract | 31 October 2026 | Repository: \`BREVEX-CEO/caera-connect-plan\` | Working branch: \`ocade/p00-p22-implementation\`**
>
> **Single source of truth for JARVIS implementation.** This is a deliberate rewrite of the previous 435 KB \`plan.md\` with duplicated histories, outdated assertions and task examples. \`AGENTS.md\`, \`CLAUDE.md\`, security policies, migrations and authoritative owner approvals still apply. Historical research and \`docs/DECISIONS.md\` are provenance, **not** alternate queues or permission to bypass this plan. Nothing in this document asserts a module is operational merely because it is specified.
>
> **Critical priority:** **Build, wire, repair, debloat and independently qualify all 84 core concepts FIRST. Only AFTER architecture gates pass may the product begin real customer-task acceptance tests.** Unit, protocol, integration, security, contract and infrastructure smoke tests used to establish architecture readiness are allowed before the gate; **do not confuse them with doing user creative/business tasks.**

## 0. OCADE: what we are building and what constitutes success

**OCADE BY CARCC** is a website-first, local-first autonomous computer-work platform. **JARVIS** accepts a customer's outcome (text/voice), uses the customer's authorized device/files/browser, chooses operations dynamically through real online model planning, returns editable artifacts where applicable and independently proves the requested result. This must work for newly encountered applications and tasks whenever an authorized generic capability actually exists. No claim of universal access to arbitrary applications, invisible UIs or 100% accuracy.

**Absolute separation of responsibility:**
- **Gemini (online brain)**: interprets user objective, proposes/updates outcome checks and milestones, chooses the next tool and its arguments, observes real results including permitted visual evidence, decides whether to revise. **Claude as engineer may design and implement infrastructure, not secretly act as Gemini or author customer-task itineraries.**
- **OCADE (hands, legs and eyes)**: authoritative supervisor, scope/consent enforcement, live capability registry and semantic/vector *retrieval*, trusted MCP gateway, signed local agent, OS/file/browser/media/geometry primitives, journal, STOP, independent verifier, user interface and delivery. All actions are typed and policy-gated.
- **Independent verifier**: checks actual effects and delivered output using separate evidence, not model declarations or successful RPC status.
- **Customer**: owns device and grants; security approvals, authentication/MFA, spending, destructive changes and sensitive operations obey explicit policy.

**Nonnegotiables:** no application-specific customer task branches or recipes; no manually scripted demo masquerading as Gemini; no developer-authored scene/timeline decisions during real acceptance; no unapproved network spending, deploys, migrations, GitHub Actions, \`main\` merges, production changes, payment activation or use of the owner's PC. ₹0 new spending ceiling. Never put service-role keys or provider secrets into source control, client bundles, logs or model-visible content.

### 0.1 Explicit implementation policy

1. Inspect current branch SHA, working tree, live code owners, dependency graph, existing tests and relevant \`AGENTS.md\` / \`CLAUDE.md\` / \`docs/DECISIONS.md\` before changing code. Never resurrect retired donor engines or overwrite unrelated work.
2. **No hardcoding** means no customer-app lists, app-name branches, keyword-to-executor mappings, fixed prompts to canned plans, sample-task-shaped worker commands, fixed paths, fixed source clips, fixed GUI click scripts or test-output injection in the production route. Stable protocol enumerations, legitimate app-specific API adapters and file-format codecs can exist if *discovered as capabilities* and do not choose task steps.
3. **Do not confuse capability routing with customer planning.** A vector tool catalog ranks plausible **tools**. Gemini decides **what action** to take; OCADE policy decides **whether** it is allowed; verifier decides **whether it worked**. Relevance score never authorizes effects.
4. Use existing Supabase account/task/consent authorities and online intelligence service; do not add a duplicate backend, duplicate model provider, parallel plan store or unsafe cloud computer.
5. Preserve separate **Offline Chat**. JARVIS is online-only; no silent offline substitution.
6. Prefer minimal shared primitives and delete *proven* dead/duplicate workflows after tests. No arbitrary source-LOC or 84-microservice target.
7. No false "zero bugs" guarantee: the gate requires **no known unresolved critical/high-severity defects**, all mandatory tests green, evidence for every applicable concept and explicit support exclusions.

## 1. Exact dependency topology and who connects to whom

\`\`\`text
Customer OCADE web UI (authenticated, outcome + device/scope)
   |
   v HTTPS authenticated command / consent / STOP
Existing server + Supabase task authority (RLS, user/device/grants, epochs, permits)
   |
   v Versioned TaskContext and durable state transitions
OD-AVGHHC OUTCOME SUPERVISOR (policy, milestones, budgets, locks, journal)
   |                            ^
   | authorize model turn       | verified observations / receipts / remaining outcome
   v                            |
Existing ocade-intelligence-service --> Gemini 3.5 Flash-Lite (ONLINE BRAIN)
   | Gemini-selected tool name + typed arguments + observed-state revision
   v
Toolbox Router / live discovery / semantic-vector capability shortlist
   |
   v POLICY GATE (target identity, grants, permission, risk, STOP epoch, quotas)
   |
   v Trusted signed dispatch envelope through enrolled device channel
Signed local Device Agent (outbound authenticated channel + sandbox)
   |
   v MCP process manager / capability gateway / worker isolation / stdio
   +---- native OS / file-format / scoped command tools
   +---- browser DOM / CDP / Playwright tools
   +---- Windows UIA / pywinauto / Win32 (macOS AX where supported)
   +---- evidence / media / geometry / other general-purpose verified tools
   |
   v Action receipts + before/after observations + preview/media evidence
Durable journal -> Supervisor -> Gemini's NEXT bounded decision
   |
   v Independent verifier -> final settlement -> genuine files + activity + timing
\`\`\`

**Security is lateral to EVERY arrow**: authentication, user/device isolation, explicit scopes, exact target identity, idempotency, STOP/Take Over fencing, resource locks, payload bounds, network/filesystem containment, provenance and audit. The outer routing chain never gives Gemini direct administrator credentials or unguarded shell access.

### 1.1 Precise bootstrap and runtime order (NO customer tasks until gate 10)

**BOOTSTRAP:**
1. \`P00\`: inspect existing code, owner authority and baseline; find real owners, tag component statuses and define SHA-bound evidence.
2. \`P01–P04\`: consolidate versioned contracts, permissions, durable task authority, STOP fencing, trusted device identity and process-level boundary.
3. \`P05–P08\`: establish dynamic discovery, capability manifest schema, health/lifecycle, semantic-vector retrieval, model-visible shortlisted schemas.
4. \`P09–P14\`: connect signed device dispatch, MCP/stdio workers, exact targets, native/browser/UI control, local workspace, resource locks and journal.
5. \`P15–P19\`: connect real online model, multimodal observations, adaptive feedback, independent verification, recovery, timings, and coherent UI.
6. \`P20–P22\`: install/package, adversarial qualification, no-hardcode debloat, evidence audit and **formal ARCHITECTURE_READY decision**.

**AT RUNTIME, once qualified:**
1. User submits an outcome; server authenticates user and obtains appropriate online AI consent.
2. Device authority checks enrollment, key possession, current grant scopes, identity and reachability; task supervisor creates durable task + STOP epoch.
3. Gemini translates goal into outcome checks; supervisor validates checks are within scope and independently verifiable.
4. Device performs current state discovery and preflight; registry ingests only signed trusted manifests and live capability health. No imaginary installed apps.
5. Router applies deterministic trust/grant/target/health filters, then semantic/vector similarity, then schema/token budget limits; it exposes a small, relevant **capability** set, not instructions or a fixed journey.
6. Gemini chooses next bounded typed action **after seeing current observations**; if no safe tool can satisfy goal, Gemini asks user or supervisor settles BLOCKED.
7. Server policy and local agent both recheck task/device/user/target, scope, risk, epoch, idempotency, deadline, resource lock, input schema and permissions immediately before mutation.
8. Supervisor journals intended side effect, issues signed/leased action; MCP gateway launches/addresses reviewed worker; worker performs a **primitive** operation.
9. Worker reports independently observable before/after data, artifact handles, error codes, preview/media evidence and action receipt; journal records whether effect is known/unknown.
10. Supervisor returns bounded untrusted observations (plus visual frames where authorized) to Gemini; it dynamically replans; crash, STOP and user intervention fence the loop.
11. A separate verifier performs actual output checks; any failure returns evidence for **bounded** revision, never silent PASS.
12. On full verified success, settle and deliver original/editable outputs where promised, time breakdown, provenance and truthful activity; otherwise PARTIAL/FAIL/BLOCKED with causes.

### 1.2 Model decision vs router vs verifier — no ambiguity

| Component | Allowed to decide | Forbidden |
|---|---|---|
| Gemini brain | User-task milestones, next operation and data arguments, requested revisions after feedback | Grant itself access, choose secrets, bypass policy, forge receipts, decide final verified PASS |
| OD-AVGHHC supervisor | Which authorized state transition/lease/limits, whether to dispatch or suspend, checkpoint scheduling | Replace Gemini with an app-specific customer workflow |
| Registry + semantic/vector router | Which trusted healthy capabilities are relevant and fit token/context limits | Generate task plans or confer authority based on keyword/vector similarity |
| Policy gate | Exact user/device/target/action/risk permission and STOP/idempotency admissibility | Trust model-written credentials, tool metadata or client claims |
| MCP gateway + workers | Implement primitive approved tool operations and return observed effects | Choose an independent customer itinerary, manufacture deliverables |
| Independent verifier | Evaluate observed postconditions and artifact integrity using independent evidence | Take model/tool success declarations as verified evidence |
| Claude engineer | Design, implement, debug, test infrastructure and build qualifying harness | Secretly direct production model task actions or create output to fake acceptance |

## 2. Technical contracts, protocol ownership and wiring

**Existing owners to examine and adapt, not blindly replace:** \`src/lib/jarvis/contracts.ts\` (typed operations/protocol), \`src/lib/jarvis/authority.server.ts\` (task/grants/STOP/device authority), \`src/lib/jarvis/planner.server.ts\` (online planning + offered tools), \`src/lib/jarvis/supervisor.ts\` (state evaluation), \`src/lib/intelligence/edge-handler.ts\` and \`supabase/functions/ocade-intelligence-service/index.ts\` (actual Gemini service, permits), \`src/integrations/supabase/client.server.ts\` (server-only admin), \`device-agent/windows/\` (local runtime), \`scripts/jarvis-protocol.ts\` (generated schema), \`scripts/jarvis-live.mjs\` (currently a live-test harness), \`tests/jarvis/\` and \`scripts/jarvis-no-hardcoded-journeys.mjs\`. Inspect directory contents before assuming additional paths or functions exist. In particular, a hardcoded \`ENGINES\` list or lexical external-tool ranking requires an audit: stable protocol adapters are not automatically prohibited, but the runtime catalog must not be bounded to an app/task keyword table.

### 2.1 Schema-first contracts (illustrative field requirements; extend existing types instead of introducing parallel definitions)

\`\`\`ts
type TaskContext = {
  protocolVersion: number; taskId: string; userId: string;
  deviceId: string; sessionId: string; outcome: string;
  checkedScopes: string[]; deadlineAt: string; epoch: number;
  stateVersion: number; traceId: string;
};
type CapabilityDescriptor = {
  id: string; namespace: string; version: string; publisher: string;
  inputSchema: unknown; outputSchema: unknown; effects: string[];
  requiredScopes: string[]; supportedTargets: string[];
  availability: "healthy" | "unavailable" | "degraded";
  capabilityHealthAt: string; transport: "local" | "mcp" | "browser";
};
type ActionEnvelope = {
  protocolVersion: number; taskId: string; actionId: string;
  idempotencyKey: string; epoch: number; deviceId: string;
  targetIdentity: Record<string, unknown>; capabilityId: string;
  capabilityVersion: string; arguments: unknown;
  requiredScopes: string[]; deadlineAt: string; traceId: string;
};
type EffectReceipt = {
  taskId: string; actionId: string; epoch: number;
  execution: "not_started" | "started" | "finished" | "failed";
  effect: "none" | "confirmed" | "unknown";
  evidenceRefs: string[]; artifactRefs: string[];
  errorCode?: string; monotonicDurationMs: number; traceId: string;
};
type VerificationDecision = {
  taskId: string; checks: Array<{
    id: string; result: "pass" | "fail" | "unverified";
    independentEvidenceRefs: string[];
  }>; status: "PASS" | "PARTIAL" | "FAIL" | "BLOCKED";
};
\`\`\`

These are **contract requirements**, not permission to redefine shipped types. Use a single canonical schema, generated TS/Python validators and migration/version negotiation where actual runtime schemas differ. Keep existing database status nomenclature; never write new enum variants to Supabase without approved migration. Reject unknown protocol versions, stale epochs, excess payloads, mismatched grants, unapproved effect types and duplicate action IDs.

### 2.2 Per-connection responsibilities

| From → to | Transport / contract | Owner's responsibility | Return evidence |
|---|---|---|---|
| OCADE UI → application server | Authenticated HTTPS; identity and body bounds | Establish user goal and authorized scope | Durable task ID; status URL |
| Server → Supabase | Existing trusted client; RPC/RLS | Verify account/consent/grants and store task/journal | Transactional task status, epoch, permit receipts |
| Supervisor → intelligence service | Existing generation permit + authorized server call | Invoke real Gemini only within model/usage permission | Actual model call ID, tool proposals, usage + latency |
| Device ↔ server authority | Enrolled device key, signed/leased poll and ack | Verify device/account/task binding both ways | Fresh device event receipt + telemetry |
| Device → registry | Signed/versioned capability discovery | Report real executable mechanisms and current health | Capability manifests and health provenance |
| Registry → router → Gemini | Filtered schema/description views (not executable package text) | Offer authorized healthy tools with bounded context | Chosen capability IDs; retrieval diagnostics |
| Supervisor → agent → MCP manager | Leased typed envelope with identity/idempotency | Validate before dispatch and before actual effect | Worker protocol receipt tied to exact attempt |
| MCP manager ↔ worker | Official MCP JSON-RPC over scoped stdio or reviewed equivalent | Initialize/list/call, monitor, cancel and reconcile | Raw operation result and stderr diagnostics |
| Worker → supervisor → Gemini | Sanitized receipt, state diff, preview attachments | Attach *real* observation without prompt-injection authority | Model's next bounded choice |
| Journal/verifier → task settlement | Durable effect record, independent file/target checks | Prove result or label uncertainty | Verified artifact hashes, status, timing |
| Server → UI | Authenticated progress stream / polling | Show accurate state, STOP and final files | Final accessible owner-scoped deliverables |

### 2.3 Semantic/vector router: implement in this order

1. **Manifest ground truth:** each runtime-discovered capability carries canonical description, schemas, permissions, target type, transport, risk, version and health. Manual vendor/task whitelists are not the index. A tool name is not proof a callable implementation exists.
2. **Trust filter first:** discard unapproved publisher, invalid schema, unavailable binary, unhealthy endpoint, missing account/device grant, wrong OS/target, incompatible resource/effect or outdated manifest. This must occur before semantic ranking.
3. **Vector representation:** index embeddings of **capability descriptors and reusable operation semantics**, not app-specific plans or user-generated scripts. Use a lawful, approved available embedding method; if no model/index exists, keep correctness via a dynamic descriptor-based semantic/lexical shortlist and mark *vector integration BLOCKED*, never fake embeddings or declare the 84-point gate passed.
4. **Query:** use the current outcome, remaining postconditions, target characteristics and last observation to retrieve candidates. Combine semantic similarity with schema/permission/health/fidelity/latency scores under versioned, auditable ranking. A lexical overlap score alone is **not** a full hierarchical vector system.
5. **Hierarchical narrowing:** goal → current milestone → domain capability group → exact callable tool/schema; choose bounded top-K without flooding Gemini. Capability group means operational semantics, not hardcoded task types.
6. **Gemini last-mile decision:** offer short trusted tool descriptions, exact input schemas and current observed state. Gemini chooses an action; server validates parameters, risk and target. Retrieval itself cannot execute.
7. **Refresh and fallback:** invalidate indexes on schema/health/permission/target changes; refresh after failures/user edits. If an equivalent tool becomes available, shortlist can change without source edits; never automatically install unknown MCP binaries.
8. **Verification:** unseen wording, unseen app, renamed files, new dynamic healthy tool, removed tool, poor similarity, stale embedding, malicious metadata, long catalog, cross-user scope and offline catalog are all mandatory regression cases.

### 2.4 MCP/STDIO process contract

- Per task/device authority opens a managed local gateway; the manager launches only signed, pinned, trusted executables with scoped working directory, environment, network and permissions. Do not grant generic shell/admin privileges.
- Perform MCP version/capability initialization, \`tools/list\`, validated \`tools/call\`; associate each JSON-RPC request ID with exact task/action/lease. Follow the actual MCP SDK framing semantics used by the worker; **never invent framing or dump arbitrary text to stdout**. Logs go to stderr.
- Multiplex worker streams without mixing response IDs or tenants. Apply quotas, timeouts, stream size limits, heartbeat/health, schema checks, cancellation and dead-child cleanup.
- Reconcile ambiguous effects from the journal/actual target before any retry. An MCP return code is **not** independent verification.
- \`pywinauto\`/UIA owns Windows structural GUI control, Playwright/CDP owns scoped browser state, native scripts/object models own supported deterministic operations, safe vision handles inaccessible canvases **only as last resort**. Workers expose generic inspect/invoke/read/write/preview-style capabilities as justified by existing contracts.

### 2.5 Permission and STOP invariants

- Validate user identity, grants, account, device key, task status, control epoch, allowed source/destination, process/window/tab/file target, action ID and deadline at **both** server and device; enforce before each write and at late dispatch.
- Keep an append-only effect journal with states proposed → authorized → attempted → acknowledged/effect-known OR effect-unknown → independently verified. These may map to existing DB statuses; do not mutate shipped schema without permission.
- STOP locally fences new actions independent of connectivity; remote STOP means request, delivery, ACK and quiescence are distinct. Already committed effects cannot be undone by cancellation. Take Over suspends colliding UI actions.
- Safeguard UAC, MFA, OAuth, credentials, secrets, payments, external sends, irreversible deletes and other sensitive effects. No automatic spending or bypasses.
- Admin/service-role Supabase secrets remain in a server-only trusted boundary, **not** model/worker logs, prompts, public UI or GitHub. The live harness must not use production accounts or real customer data.

## 3. Exactly 84 required architectural concepts: build order, wiring and evidence

**Source:** Curated from the previously supplied \`OCADE_JARVIS_Essential_Architecture_Concepts.md\`. These **84** are the authoritative architecture checklist; the older 143/30/63 research catalog is not a runtime shopping list. Titles are retained, numbered continuously and ordered by engineering dependency. **A design heading does not equal an implementation.** Each entry needs code owner, dependency proof, automated test, status and environment-specific evidence. No vendor/task-specific demo routes count.

### Foundation, authority and architecture

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 1 | **OD-AVGHHC — Outcome-Driven Adaptive Verifier-Gated Hierarchical Hybrid Control** | One outcome state machine owns authorization, milestones, tool effects and completion; connect authenticated task authority to the model pilot, gateway, durable journal and independent verifier. | Trace one task across every boundary; reject unverified completion and unowned mutations. |
| 2 | **Architecture C — Unified Hybrid Control** | Use one local-first hybrid execution spine, not a second planner or agent swarm; supervisor delegates only scoped tool calls to device-side generic executors. | A single trace links web request, server task, device lease, worker receipt and verifier. |
| 3 | **Five Primary Architectural Components** | Assign one owner each for supervisor, registry, process manager/MCP gateway, execution bridge and independent verifier; connect through versioned contracts. | No overlapping owners or duplicate executable paths; contract tests pass. |
| 4 | **Single-Dispatcher Architecture** | Serialize each resource mutation through one per-task dispatcher; distribute independent read-only work only when safe. | Concurrent actions against one document are ordered and auditable. |
| 5 | **Supervisor–Pilot / Actor–Critic Separation** | Gemini pilot proposes next typed action; supervisor enforces grants and retry budget; verifier critiques actual observed effects separately. | Replacing Gemini output with unsafe commands never bypasses policy. |
| 6 | **Hierarchical Control and Context Isolation** | Retain outcome and milestone contexts above bounded tool-action contexts; expose minimal current schemas and observations. | Unrelated tool schemas and untrusted documents cannot leak into authority. |
| 7 | **Separation of State** | Keep desired goal, proposed intent, authorized dispatch, observed effects and verified outcome in separately owned records. | A worker's claimed success cannot update verified outcome directly. |
| 8 | **Outcome and Target-State Definition** | Translate consented user intent to model-proposed, policy-reviewed checks; persist clear measurable postconditions before mutations. | Ambiguous or unverifiable checks return an explicit question or BLOCKED. |
| 9 | **Zero Hardcoded Application or Customer-Task Journeys** | Remove keyword-to-app workflows, fixed output names, canned procedural paths and demo scripts from runtime; allow vetted generic adapters. | Metamorphic tests with unseen apps, filenames and paraphrases reach the same dynamic routing mechanism. |
| 10 | **Capability-First Tool Selection** | Candidate tools derive from current executable capability descriptors and actual target availability, not app names. | Changing installed equivalent executors changes candidates without changing planner code. |

### Adaptive intelligence, vector routing and discovery

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 11 | **Environment Discovery and Systemic Introspection** | Device reports OS, processes, windows, profiles, file associations, available APIs, drivers, hardware, permissions and target identity to registry. | Fresh discovery matches actual device conditions; unreported tools cannot execute. |
| 12 | **Dynamic Application and Interface Discovery** | Discover installed and active applications and their supported automation surfaces at runtime; avoid static app lists. | Unknown legitimate installed application appears when its supported control surface is discoverable. |
| 13 | **Dynamic Capability Registry and Typed Schemas** | Normalize reviewed tool manifests with IDs, version, input/output JSON schemas, supported effects, permission scope, target and health. | Malformed, duplicate, stale or permissionless manifests are excluded. |
| 14 | **MCP Toolbox Router** | Match model goal and current step to authorized healthy capabilities; shortlist, then Gemini makes final typed selection. | Candidate selection is dynamic and does not create an action plan. |
| 15 | **Semantic Token Gatekeeper** | Expose only bounded shortlisted tool definitions in a Gemini turn; maintain safety invariant for non-shortlisted operations. | Prompt length stays bounded and rejected tools cannot be invoked through fabricated names. |
| 16 | **Vectorized Domain Blueprints** | Index general capability descriptions, schemas and quality criteria with versioned embeddings; retrieve guidance, never executable task templates. | A changed tool manifest invalidates embeddings; vector results carry no authority. |
| 17 | **Receding-Horizon Vector Selector** | Recompute tool candidates from latest observed state and unfinished outcome instead of emitting a fixed multi-step task. | Revised environment or a failure produces an updated candidate set. |
| 18 | **Macroscopic Planning for Unknown Task Horizons** | Gemini sets adaptable milestone intent; supervisor limits turn duration and persisted costs/permissions. | A long job can checkpoint without assuming a fixed step count. |
| 19 | **Bounded Receding-Horizon Planning** | Allow one or a small safe batch of Gemini-selected operations; reobserve before each irreversible step. | Cycle detection, task budget and STOP all terminate unsafe nonprogress. |
| 20 | **Real-Time Observe–Act–Verify–Adapt Loop** | After each effect, return structured receipt plus permitted screen/media evidence to supervisor and Gemini. | A deliberately failed action causes feedback or stop, never fake success. |
| 21 | **Dynamic State Pivot and Self-Correction** | On user edits or worker error, refresh target identity and outcome delta before bounded repair. | No stale coordinates or old file versions are reused after takeover. |
| 22 | **Tool Namespace Isolation** | Use stable fully qualified names and immutable manifest IDs across gateway/registry/providers. | Two tools with same short name cannot cross-call. |
| 23 | **Large Tool Catalog Filtering** | Keep full trusted catalog server/device side and send only stage-relevant tool schemas to Gemini. | Adding 100 irrelevant tools does not overwhelm the next planning turn. |
| 24 | **Live Capability and Dependency Preflight** | Check executable, API support, auth, codecs, browser profile, worker startup, network, rights and grant before proposing execution. | Missing dependencies cause clear unavailable/blocked evidence before mutation. |

### Universal execution and computer control

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 25 | **Native-First Execution Hierarchy** | Dispatch fastest safe supported API/object model first; then bounded scripts, formats, DOM/CDP/Playwright, accessibility and vision last. | Fallback transitions include reason and independently recheck effect. |
| 26 | **Native OS and File-Format Operations** | Offer generic filesystem, document format, OS inspection and project-file operations through typed sandboxed tools. | File integrity and ownership preserved, paths constrained to scope. |
| 27 | **Scoped Script and Command Execution** | Use allowlisted or reviewed bounded commands with quotas and argument schemas, never unrestricted model-generated shell. | Injection, path traversal and forbidden executable requests fail closed. |
| 28 | **Windows UI Automation — pywinauto / UIA / Win32** | Use live accessibility trees and exact PID/HWND/process-start identity for native controls, with optional lower-level Win32 only when justified. | Wrong-window, duplicate-title and focus-swap regression tests pass. |
| 29 | **macOS Accessibility — pyobjc / ApplicationServices** | Provide a native AX bridge behind the same interface when macOS is a supported target; do not call Linux tests macOS proof. | OS-specific entitlement and real device tests gate macOS claims. |
| 30 | **Browser DOM / CDP / Playwright Automation** | Bind to the precise authorized browser, profile, tab and origin; prefer semantic DOM/ARIA and official APIs. | Unexpected navigation, lost tab and login challenges pause safely. |
| 31 | **Authenticated Browser Profile and Session Binding** | Use permitted existing sessions without exporting passwords/cookies; revoke tool authority when profile identity changes. | Cross-profile execution and token extraction are rejected. |
| 32 | **Structured Accessibility-Tree Interaction** | Inspect semantic controls, roles, state and geometry freshly before invoking action; avoid stale element IDs. | Changed UI tree triggers rediscovery rather than blind click. |
| 33 | **Exact PID / HWND / Document / Tab Targeting** | Store lease-bound account/device/process/window/file/tab identity and validate immediately before mutation. | Spoofed window title or stale PID cannot redirect operation. |
| 34 | **Window Resize, DPI and Multi-Monitor Resilience** | Requery accessibility state, transforms and visual anchors after display changes; never presume persistent coordinates. | DPI/display movement trials do not select wrong target. |
| 35 | **Foreground, Background and Minimized-Window State Handling** | Differentiate API-capable background work from GUI operations requiring a visible foreground; restore only with consent. | No claim of universal hidden-window clicking or cursor-free execution. |
| 36 | **Visual Anchors / OpenCV as Last-Resort Fallback** | Use bounded vision matching with confidence, fresh screenshots and explicit target checks only where semantic interfaces fail. | Low-confidence target, resize drift or unexpected overlay blocks effect. |
| 37 | **Dynamic Universal Application Fallback Hierarchy** | Select execution mechanism by current capability quality, privacy, fidelity and target state, independent of application names. | A missing native path falls back safely without fixed app-specific script. |
| 38 | **Approved Filesystem Sandbox** | Create per-task bounded input, intermediate and output roots, preserving originals, ACLs and provenance. | Symlink traversal, overwrites and cross-account file access are blocked. |

### MCP, STDIO and tool-runtime wiring

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 39 | **Trusted MCP Gateway and Capability Dictionary** | Local device runtime owns MCP connections; server receives signed sanitized manifests, not arbitrary shell hooks. | Only approved manifests can dispatch; remote tools cannot grant themselves permissions. |
| 40 | **Official MCP Tool/Server Lifecycle** | Initialize, negotiate protocol versions, enumerate capabilities, health-check, call and shutdown reviewed MCP workers. | Worker restart and protocol mismatch generate honest errors. |
| 41 | **Core OS, Filesystem, Browser and Accessibility Tool Roles** | Implement minimum stable general-purpose capabilities as composable workers; additional render/data tools remain optional typed plugins. | No customer must manually install developer MCP infrastructure. |
| 42 | **Async STDIO — sys.stdin / sys.stdout** | Transport JSON-RPC MCP frames over child stdin/stdout; stdout is protocol-only and diagnostics go to stderr. | Large outputs, partial frames and worker termination are handled correctly. |
| 43 | **STDIO Subprocess Multiplexing** | Process manager associates each child stream, request ID, task lease, cancellation and timeout with its correct pending call. | Parallel responses never cross tasks or mutate wrong resource. |
| 44 | **Tool Schema Pinning and Validation** | Use existing shared contracts; reject unknown operation, schema drift, excess payloads and invalid result shape at all boundaries. | Contract compatibility tests cover TS↔Python and service↔device. |
| 45 | **Tool Discovery, Versioning and Health Checks** | Cache trusted manifests by version/health TTL; verify package provenance and readiness before enabling a tool. | Revoked/crashed/updated tools disappear from offered candidates. |
| 46 | **Approved External MCP Provenance and Permissions** | Treat third-party tool descriptions as untrusted; require policy, publisher verification, pinning and explicit scope. | Malicious MCP tool metadata cannot exfiltrate secrets or bypass consent. |
| 47 | **Lazy Worker Activation and Isolation** | Spawn vetted workers on demand with scoped environment, quotas, sandbox and resource locks; reap idle workers. | Dead process does not strand a task or leak child processes. |
| 48 | **IPC Latency and Throughput Measurement** | Measure dispatch, queue, worker and serialization times; optimize bottlenecks empirically. | p50/p95 latencies and overhead captured for real runs. |
| 49 | **Deterministic Safe Multi-Action Batching** | Batch only model-selected, preauthorized idempotent/reversible operations inside one identity/STOP lease. | Cancellation or partial batch returns per-effect receipts. |

### State, security, safety and recovery

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 50 | **Resource Locking and Semaphores** | Acquire canonical per-resource locks before writes; release on confirmed settle or lease expiration. | Two concurrent tasks cannot overwrite same file/window state. |
| 51 | **Concurrency Protection and Resource-Aware Scheduling** | Queue conflicting writes; permit parallel independent reads/renders under CPU/GPU limits. | Load cannot starve STOP, verifier or responsive UI. |
| 52 | **Task UUIDs and Idempotency Keys** | Assign task/action attempt and effect IDs stable across retries, reconnects and server callbacks. | Replayed requests do not duplicate irreversible effects. |
| 53 | **Transactional Side-Effect Journal** | Write intent and preconditions before action, then evidence/acknowledgment and final classification after action. | Crash between commit and ACK remains UNKNOWN until reconciled. |
| 54 | **Execution, Effect and Verification State Separation** | Represent requested/authorized/dispatched/observed/verified independently in durable state. | An RPC 200, saved path or LLM text never directly settles PASS. |
| 55 | **Lost-Confirmation / Unknown-Effect Reconciliation** | Check external state and idempotency journal before any repeat after timeout/disconnect. | Unknown POST/send/delete is never blindly retried. |
| 56 | **Durable Checkpoints and Crash Recovery** | Persist outcome, consent, exact target, open actions, completed receipts and current epoch. | Process restart reconstructs task without replaying completed operations. |
| 57 | **Local STOP / Pause / Take Over / Resume** | Local kill fence blocks new effects immediately; remote STOP has separate acknowledgment and reconciliation states. | STOP works when cloud/model unavailable; in-flight effects reported truthfully. |
| 58 | **Live User Interference Detection** | Detect human focus/file/tab edits and suspend conflicting UI operations without blocking independent safe work. | Take-over never overwrites newer user changes. |
| 59 | **Target Revalidation After State Changes** | Recheck live process/window/tab/file identity and lease epoch before every mutation and after recovery. | Old handles, URLs and document versions are refused. |
| 60 | **Bounded Retry and Cycle Detection** | Cap steps, token use, time and attempts; change strategy only with observed evidence. | Infinite/self-repeating tool cycles terminate as BLOCKED. |
| 61 | **Graceful Degradation and Honest Blocked States** | Offer compatible alternatives only if authorized and outcome-equivalent; otherwise report reason/action required. | No silently substituted offline model, paid tool or fake artifact. |
| 62 | **Least-Privilege Runtime Sandboxing / ACLs** | Run worker per scoped user/task boundaries with network, path, process and operating-system permission constraints. | Escapes, untrusted downloads and privilege escalation fail closed. |
| 63 | **Scoped Authentication, Consent, OAuth and MFA** | Authenticate user and device independently; preserve account isolation, grants and official login/UAC/MFA challenges. | Cross-tenant, stale grant and forged scope tests fail closed. |
| 64 | **Secrets Vault and Credential Isolation** | Keep provider/service admin keys server side only; never expose to tool schemas, model turns, logs, client or child process. | Secret scans and prompt/worker injection tests show no credential leakage. |

### Device runtime and customer experience

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 65 | **Signed Local Device Agent** | Package outbound-authenticated companion; validate update signature, identity and task lease. | Untrusted binary or disconnected device cannot receive privileged action. |
| 66 | **Secure Device Pairing and Revocation** | Pair by authenticated account and device-held key; allow explicit revoke and immediate policy fencing. | Removed device cannot resume or accept a task. |
| 67 | **Persistent Authorized Capability Scopes** | Persist least-privilege grants with purpose, target, epoch and expiry; reask only for new/sensitive scope. | Expired permission and cross-account reuse rejected. |
| 68 | **One-Installer Self-Contained Runtime** | Ship signed OS-specific executable with bundled reviewed workers, libraries and startup diagnostics. | Clean-machine smoke test without developer Python/Node/Docker passes on each advertised OS. |
| 69 | **Scoped Local Workspace and Output Provenance** | Stage files under task workspace; preserve editable origins and source licenses where needed. | Every delivered artifact has verified path, owner and hash. |
| 70 | **Task Activity, Timing and Progress Telemetry** | Record monotonic timestamps for authorization, planning, queue, execution, render, verification and delivery. | Total elapsed and phase sums are explainable; no invented speed. |
| 71 | **Safe Output Delivery and Editable Artifacts** | Return genuine completed files/links and editable project when requested and supported; expose partial evidence when blocked. | Download/readback verification and native-open test pass. |
| 72 | **Minimal Outcome-First User Experience** | Expose natural-language goal, device/scope confirmation, calm status, STOP, activity and delivery, not infrastructure details. | UI reflects real receipts, errors and waiting states. |
| 73 | **Internal MCP Complexity Hidden from Customers** | Install and discover tool services inside signed companion; never require consumer MCP setup. | A fresh customer path contains no CLI/MCP configuration step. |

### Independent verification, optimization and release

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 74 | **Closed-Loop Telemetry Verification** | Collect structured before/after state plus output and nonmodel measurements for each action. | An unobserved write cannot count as completed. |
| 75 | **Independent Professional Deliverable Verification** | Verifier reads actual output via independent method and checks outcome-specific integrity/quality criteria. | An actor-authored PASS does not override verifier failure. |
| 76 | **Postcondition and Output-Integrity Checks** | Validate file opens, dimensions, metadata, structural formula/geometry consistency, requested values and quality. | Corrupt, mislabeled or low-fidelity output is PARTIAL/FAIL. |
| 77 | **Evidence-Based Adaptive Recovery** | Feed verifier failures and observed artifacts back to Gemini for bounded correction without losing original state. | Each repair has new evidence, no blind repeated clicks. |
| 78 | **Real-World Latency and Resource Benchmarks** | Track Gemini time, tool dispatch, native execution, rendering, queue, verifier and customer intervention. | p50/p95, actual wall time and measurable efficiency compared to baseline. |
| 79 | **Real Unprepared End-to-End Task Qualification** | Use previously unseen genuine tasks only after the architecture gate; no prerecorded execution trace. | Actual model-driven output, process trace and independent result are present. |
| 80 | **Adversarial Security and Wrong-Target Tests** | Exercise permissions, stolen/expired leases, duplicate effects, changed window/tab, user edits, crashes and prompt injection. | No critical unauthorized side effects across suite. |
| 81 | **Proof-Driven Debloating and Regression Protection** | Remove unused/duplicate/hardcoded paths with caller trace and parity tests, not line-count goals. | No lost supported operations or degraded STOP/security coverage. |
| 82 | **PASS / PARTIAL / FAIL / BLOCKED / UNTESTED Evidence States** | Maintain per-concept SHA/environment/test IDs and reason; distinguish mocks from live tests. | No unknown/unproven component marked PASS. |
| 83 | **Measured Task Success and User-Intervention Metrics** | Evaluate independently verified task success and count prompts, approvals, retries, time and user actions. | ≥90% benchmark gate only with published denominator and eligible coverage. |
| 84 | **Zero Known Critical Safety-Defect Release Gate** | Require zero known critical/high-severity release blockers and green mandatory architecture tests. | Any proven credential leak, wrong-target mutation or unsafe retry vetoes task acceptance and release. |


## 4. P00–P22 implementation workstreams — exact dependency sequence

**Implementation work includes architecture-specific tests. Do NOT attempt the actual 4K/video/customer-task qualification until ALL of §5 passes.** Continue fixing independent items when one subsystem is blocked, but no shortcut into task tests.

| Package | Dependencies | Engineering deliverable and wiring | Entry → exit proof |
|---|---|---|---|
| **P00** | None | Baseline current SHA, decisions, ownership map, 84-item ledger, hardcode inventory and existing real test evidence; no parallel plan. | No file changes outside authorized branch; historical claims correctly labeled. |
| **P01** | P00 | Canonical versioned protocol, types, schema generator, request IDs, error taxonomy, cross-language validators. | TS/Python/API contract tests, negative input rejection. |
| **P02** | P01 | Existing user identity, permission, online consent and Supabase RLS enforcement. | Forged user/device/tenant/grant rejected. |
| **P03** | P01–P02 | Durable task authority, supervisor, goal/check contract, milestones, lifecycle persistence. | Replay and state-machine transition proofs. |
| **P04** | P02–P03 | STOP/pause/resume/takeover, epoch fencing, bounded deadlines and effect risk. | Local STOP independent of provider; no post-STOP dispatch. |
| **P05** | P01–P04 | Signed trusted device enrollment, pairing, revoke, outbound authenticated channel. | Cross-user and revoked-device tests; actual agent reachable. |
| **P06** | P05 | Dynamic OS/software/browser/file/environment discovery and target identity. | Unseen legitimate capability found; no fabricated app launch. |
| **P07** | P06 | Capability schema, registry, manifest provenance, namespace/version/health checks. | Invalid/unavailable tool excluded; precise healthy manifests. |
| **P08** | P07 | Hierarchical semantic/vector tool retrieval, descriptor indexing, top-K tool schema budgeting. | Live embedding/index if claimed; paraphrase, unknown app, stale index tests. |
| **P09** | P05–P08 | Agent process manager, trusted MCP initialization, STDIO multiplexer, lifecycle, worker isolation. | Real worker/tool-call contract, worker crash/restart and concurrency proof. |
| **P10** | P09 | Local filesystem/native execution, scoped scripts, safe project formats, target handles and file ownership. | Sandbox/ACL/symlink tests and verified read/write receipts. |
| **P11** | P09 | Browser profile/tab/DOM/CDP/Playwright bridge with session/origin gates. | Wrong tab/origin, challenge, detached tab, navigation change. |
| **P12** | P09 | Windows pywinauto/UIA + Win32 bridge, discovered accessible controls, live PID/HWND and focus bounds; macOS AX only when qualified. | Wrong-window and resize/DPI tests on actual advertised OS. |
| **P13** | P10–P12 | Policy-driven mechanism fallback, safe vision-last path, resource locks, bounded worker dispatch. | App-independent fallback, conflict and low-confidence refusal tests. |
| **P14** | P03–P13 | Side-effect journal, idempotency, ACK reconciliation, durable checkpoint/restart and exact target revalidation. | Disconnect between effect and ACK; repeated command never duplicates effect. |
| **P15** | P02–P14 | Existing server permit/generation gate → deployed intelligence function → real authorized Gemini planner. | Real model function-call path separately from mocked provider tests. |
| **P16** | P15 | Multimodal screenshot/frame/media observation, safe serialization, consent and Gemini's bounded observe/act/replan loop. | Real model sees preview on next turn and chooses revision; no developer-authored task itinerary. |
| **P17** | P14–P16 | Independent effect/outcome verifier and professional artifact checks; validate claims/lineage. | Deliberately broken output fails; model/tool PASS can't bypass verifier. |
| **P18** | P14–P17 | Robust fault recovery, retries, state pivot, simultaneous human changes, UNKNOWN effects, no unapproved fallback. | Controlled fault-injection suite green. |
| **P19** | P03–P18 | User-facing goal/status/STOP/consent/activity/delivery, real timing and provenance ledger. | Accessibility + truthful streaming/reporting and customer files proof. |
| **P20** | P05–P19 | Signed/self-contained installer, worker bundle, startup checks, environment-specific isolation. | Clean OS installation without development runtime; unproven platforms excluded. |
| **P21** | P00–P20 | Security, schema, network, provider errors, routing, high-volume tool catalog, performance and adversarial architecture tests; safe debloat. | No failing critical tests, independent SHA-bound evidence for all applicable concepts. |
| **P22** | P21 | Formal architecture readiness review, missing evidence report, veto/approval decision and freeze of generic runtime contracts. | All 84 entries PASS or an explicitly justified, tested unsupported-platform exclusion; no known critical/high-severity defects; release gate recorded. |

**Package status reporting:** \`package | current SHA | owner | actual environment | code state | tests passed/failed/skipped | blocker | first needed next action\`. Do not label \`CODED\` as \`VERIFIED\`. If a package is blocked, pursue independent dependency-ready engineering; never bypass its gate.

## 5. Architecture readiness gates — mandatory before any customer-task acceptance test

**The user explicitly requires architecture-first.** Gate status defaults to **NOT VERIFIED**, regardless of optimistic historical checkpoint notes. Real Gemini task qualification only begins after the architecture is established and reliable.

| Gate | Must be demonstrated with evidence | Fail/blocked response |
|---|---|---|
| **G0 — repository integrity** | Only approved implementation branch, single code owner per subsystem, current contracts and historical decisions reconciled, secret scan clean. | Fix source/authority conflict. |
| **G1 — zero hardcoded journeys** | Static scan **and** dynamic metamorphic tests show no app/task-name-dependent production route, fixed scene, fixed edit script or fixed output; generic adapters remain. | Refactor and retest; no task qualification. |
| **G2 — identity/authority** | Live user+device grants, RLS, authenticated task/migration checks, consent, scopes, idempotency, exact device binding. | No delegated mutations. |
| **G3 — local agent/device** | Trusted bundled runtime, signed/reviewed worker startup, pairing, revocation, live reachability on claimed platform. | No computer-control claims. |
| **G4 — capability catalog** | Actual OS/application/tool discovery, reviewed manifest inventory, live health, missing-dependency handling, no invented app support. | No router READY. |
| **G5 — semantic/vector routing** | The actual vector/embedding layer if specified exists, is versioned and tested; top-K dynamic schema selection and permissions work. Lexical-only is PARTIAL. | Complete vector wiring or remain blocked. |
| **G6 — MCP/STDIO execution** | Real JSON-RPC MCP initialize/list/call, worker lifecycle, keyed multiplexing, schema validation and crash health tests. | No dispatch. |
| **G7 — controlled native/browser/UI** | Native/file/command, Playwright, UIA and vision-last fallback work as advertised; exact PID/HWND/tab/file identity preserved. | No unverified platform/use claim. |
| **G8 — STOP, isolation and recovery** | Server+agent epoch checks, immediate local fence, locks, journal, replay-safe idempotency and lost-ACK reconciliation green. | Hard veto on task tests. |
| **G9 — genuine Gemini brain** | Real authorized \`gemini-3.5-flash-lite\` access confirmed at existing approved no-cost provider project; model selects actual tools, reads feedback/previews, uses generation permit and consent. Three key slots checked individually and same-project 429 not misused. | Mock tests may continue but **real task qualification BLOCKED**; no Claude substitute. |
| **G10 — independent verification** | Independent file/output/target postconditions and failure cases, legitimate original/editable output ownership, real elapsed timing. | No PASS settlement. |
| **G11 — architecture regression and safety** | All applicable 84 entries traced to code/evidence, zero failing mandatory tests, zero **known** critical/high-severity safety bugs, no unresolved wrong-target/secret/data loss. | Fix and rerun. |
| **G12 — documented go/no-go** | Review records SHA, executed tests, actual environments, platform coverage, omissions and owner approval boundaries. All earlier gates PASS. | Stay in architecture phase. |

**Applicability rule:** a concept tied to a platform not yet supported still needs an explicit capability exclusion, no falsely offered feature, tests for safe exclusion and a separately tracked validation gate before claiming that platform. Never silently turn BLOCKED into N/A. The owner requires the architecture as a whole, not an attractive subset.

**Definition of complete:** architecture exists, connectors are wired, code builds, mandatory tests pass, effects are safe, live permitted subsystems produce authentic receipts, no known unresolved critical/high-severity defects, every advertised platform/function has appropriate real proof. This does not mean a metaphysical guarantee of zero bugs. If credentials, real OS hardware, billing authority or device permission are missing, mark **BLOCKED** and keep engineering other components; do not run creative task tests or claim ready.

### 5.1 Required architecture test ladder (allowed BEFORE task tests)

1. Static source/dependency/security audit, no-hardcode guard, artifact provenance and secret scan.
2. Unit/schema/property/metamorphic tests for contracts, discovery, policy, router and invalid inputs.
3. MCP/STDIO worker boot/list/call/timeout/partial-response tests in disposable cloud environment.
4. Integration tests: task authority, RPC, permissions, signed agent messages, lock/journal/STOP, actual server action receipts.
5. Negative/adversarial tests: wrong process/tab/profile/account, symlink traversal, stale epoch, lost ACK, unsafe retry, malicious MCP metadata, forged model tool arguments, STOP during model outage, quota error handling.
6. Actual authorized Gemini **capability smoke tests** (tool selection and visual-input feedback), not customer creative acceptance tasks, within checked free-tier and consent rules.
7. Real OS-level tests only on an authorized cloud Windows/macOS environment (or after separate owner permission for personal PC); Linux mocks do not qualify Windows GUI.
8. Package, self-install, service/worker health, redacted activity, genuine independent verifier and task-state metrics.
9. Full architecture review with tracked PASS / FAIL / PARTIAL / BLOCKED / UNTESTED. Stop before task qualification if any mandatory item is non-PASS.

### 5.2 Concrete developer checks (run ONLY in approved free environments)

\`\`\`sh
npm run jarvis:protocol-check
npm run jarvis:no-hardcoded
npm run test:jarvis
npm run test:jarvis-db
npm run typecheck
npm run lint
npm run build
npm run verify:full
\`\`\`

Run only when required dependencies and local/testing permissions exist; report skipped/blocked. No GitHub Actions or paid cloud execution. Add focused failing regression tests for every repaired bug; do not rerun massive suites unnecessarily. Never make fixture-created deliverables count as customer agent work.

## 6. POST-GATE ONLY — autonomous real customer-task acceptance

**Only after G0–G12 PASS**, run genuine previously unseen end-to-end tasks through the **real OCADE user surface and signed agent**, using authorized staging/synthetic accounts and independent verifier. Test harness supplies **only** the user's objective, permitted inputs/scopes and clock instrumentation, not a prepared task plan, creative steps or finished output.

**Initial owner-required acceptance cases (examples for benchmark, NEVER production app/task routing):**

1. **4K editable 3D image:** customer requests a photorealistic red-and-black supercar designed from a blank editable scene, with final **3840 × 2160** image and real editable 3D project when the prompt requests it. Gemini chooses model primitives, geometry, materials, cameras, lighting, renders and iterations by inspecting actual previews. No Claude-authored car JSON, scene template, generator file or predetermined step sequence.
2. **Exactly 30-second cinematic ad:** customer supplies approved footage or requests legally sourced material; Gemini selects actual footage, cuts, effects, color, graphics, sound and properly licensed/original music, observes timeline/contact sheets and rendered output, revises and exports a genuine **30-second** playable video and editable project if supported. No preset shot list, constant timings, preassembled edit decision list, hardcoded target website, author.py or developer-created output.
3. **Unseen broad capability tasks:** choose representative independent tasks spanning native/structured data, browser, file transformation, desktop-control and recovery, without adding task-specific execution code or teaching the router user phrases. Run only when permissions, app availability and environment evidence exist.

**Model-only planning proof:** retain redacted provider request/response lineage, selected tool+arguments, preflight state, tool receipts, preview received by model, correction and verifier outcome. Claude may repair code and tests after an observed failure, then **rerun Gemini**, but cannot manually fill missing scenes, edits or user-task plan. Gemini text alone, mocked provider, canned output, scripted demo files and fake screenshot/video checks are NOT passing acceptance evidence.

### 6.1 Timing and independent completion metrics

Record monotonic UTC-correlated task timestamps with \`submittedAt\`, \`authorizedAt\`, \`firstModelAt\`, \`firstEffectAt\`, \`lastEffectAt\`, \`verifiedAt\` and \`deliveredAt\`. Measure:
- **Actual elapsed** user prompt → independently verified delivery.
- Model latency per actual call, token usage and real provider code; tool discovery, queue, policy, MCP dispatch, rendering, verification, retries, wait-for-user and recovery times.
- Number of tool calls, corrections, crashes, duplicates prevented, user approvals, relogins, manual interventions and costs (must stay ₹0 unapproved).
- Validity (format/dimensions/metadata/readability), editable source, task-specific visual/audio/technical quality and external verifier decision.
- Success fraction = **independently verified complete eligible tasks ÷ all eligible attempted tasks**; publish denominator and failed/blocked counts separately. Commercial readiness target **≥90% genuine real-task success, no known critical safety bugs**, not a fabricated universal guarantee.

**Outcome states:** PASS only with real effect + independent checks; PARTIAL when deliverable incomplete; FAIL when attempted and checks fail; BLOCKED when environment/consent/provider/tool is unavailable; UNTESTED when not attempted. Missing test equipment is never PASS.

## 7. Live provider, credential and infrastructure constraints

- Target online planner is the existing configured **\`gemini-3.5-flash-lite\`**, subject to verification of real availability/identity and permitted use in the current provider account. Gemini text/function output does not itself generate images/videos: discovered reviewed tools execute those effects. No unapproved alternate planner, no offline JARVIS fallback.
- Existing server-side primary/secondary/tertiary staging key **slots**, not assumed healthy, free or independent. Inspect slots **without reading/exposing actual values**. Confirm no-cost billing status and quota through approved account controls before real calls. Never rotate on a shared-project 429 as if each key had its own quota. Honor actual retry-after and vendor terms; no unauthorized quota circumvention.
- Live staging Supabase URL, service-role secret and synthetic account configuration are *environment settings*, never code, GitHub secrets dump or screenshots. Protect service-role bypass of RLS and use only trusted isolated staging. Owner reportedly approved staging migration \`20261030120000\` and a prior session reported applying it; independently confirm deployed schema/version. **This plan does not authorize further migration or deployment.**
- A previous checkpoint reported successful mock/local tests, a coded preview path, a drafted live test harness, but **no independently demonstrated live Gemini planner call and no completed product-led task**. Treat this as historical information until current SHA/deployed evidence is checked. Previous manually scripted image/video outputs are not acceptance.
- Cloud-first free testing. Native Windows/macOS UI qualification needs real authorized platform. Android emulator only at end and only if relevant/authorized; iOS browser coverage cannot be misrepresented as a native iOS simulator test.
- Repository policy: edit and commit only \`ocade/p00-p22-implementation\`; no \`main\` merge, deployment, new billed service, GitHub Actions, payment activation, or owner's PC without explicit separate permission. No scheduling or background automations.
- Preserve no-secret logging, real credentials kept server-side and trusted MCP package provenance. Do not copy historical vendor/task lists from the retired 435 KB document back into live execution routing.

## 8. Execution discipline and future agent continuation

**Read order:** \`AGENTS.md\` → \`CLAUDE.md\` → **this \`plan.md\`** → \`docs/DECISIONS.md\` for unresolved owner policy only → existing code owners and SHA-bound test evidence. Do not load huge historical transcripts, previously removed donor code or a competing master plan.

**At each engineering session:**
1. Identify first dependency-ready P00–P22 item lacking actual PASS evidence. Find existing implementation before creating code.
2. Reproduce bug; trace root cause; implement smallest fully safe shared fix; preserve tests/security. Do not write a customer task script.
3. Run targeted automated contract/security/regression tests. Record results and actual environment.
4. Update 84-item traceability with concept IDs, file/owner, dependency, SHA, executable tests, observed result, status. A checklist is not evidence.
5. Continue architecture work until **G0–G12 are verifiably PASS**. Do **not** jump to the 3D/ad/customer-task tests to make progress look better.
6. Report only: **Phase / workstream | Implemented | PASS/FAIL/PARTIAL/BLOCKED | Exact tests/evidence | Next dependency**. No filler or repeated huge plan. No claims of 100% reliability without measurement.

**Final engineering requirement:** Deliver one minimal, maintainable, dynamically discoverable, model-planned, policy-enforced, locally executed, independently verified OCADE system. The build and wiring must be real. **Architecture qualification precedes customer-task acceptance, never the reverse.**
