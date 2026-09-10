# Decision Log

This file records meaningful product/architecture decisions. It preserves why major choices exist without duplicating implementation steps from `PLAN.md` or technical detail from `docs/ARCHITECTURE.md`.

## OCADE is the only shipped product

### Date

2026-08-06; reconciled 2026-09-09.

### Status

Accepted. The earlier placeholder-route treatment for FICIA, MADEE and CANIA is superseded by the current canonical route and navigation plan.

### Context

The repository once presented OCADE, FICIA, MADEE and CANIA as four products. Only OCADE had a credible production path. The other product trees consisted largely of placeholder data and controls, carried most of the repository's lint/type risk around untyped personal and workforce records, and made the overall product appear more complete than it was.

### Decision

OCADE is the only shipped product. FICIA, MADEE and CANIA do not appear as active product destinations or actionable placeholder products. Historical deep links may use an intentional redirect or not-found state when required by `docs/APP_FLOW.md`, but they cannot keep dead product bundles in the shipped graph.

Legacy database objects are not dropped merely to make the schema look tidy. Existing data is preserved until an explicit, reviewed retention or migration decision proves deletion safe.

### Reasoning

One real product is safer and more honest than four partially simulated products. Removing fake product surfaces also eliminates dead controls, misleading privacy choices and unnecessary client code.

### Trade-offs and Consequences

The retired names remain historical business context, not current navigation. Reintroducing one requires normal product intake, architecture and security review; deleted screens are not restored verbatim simply because Git history contains them.

## Document retrieval uses bounded lexical ranking

### Date

2026-08-06; consolidated 2026-09-09.

### Status

Accepted until an evidence-backed replacement is approved.

### Context

Sending every attachment in full made local inference unusably slow on ordinary hardware. A second embedding model would add download, memory and prompt-evaluation costs that defeated the intended local-performance benefit on the measured target machine.

### Decision

Use deterministic BM25-style lexical ranking for bounded document-passage retrieval. Passage construction preserves line boundaries and line numbers, overlaps by one line, treats digits as searchable terms, keeps an over-budget single line as its own passage, sends short documents whole, and reports zero or weak matches honestly instead of presenting unrelated text as relevant.

### Reasoning

This approach is fast, offline-capable, deterministic and debuggable without another resident model. Citation position remains available because line provenance survives passage splitting.

### Trade-offs and Consequences

Lexical matching is weaker for paraphrases and semantic equivalence. Needle tests must prove the answer-bearing line survives retrieval. Revisit the ranking implementation only when representative target hardware and bundle/storage budgets can support a demonstrably better semantic retriever without weakening privacy, latency or citations.

## Intelligence routing refuses or falls back truthfully

### Date

Predates 2026-08-06; reconciled 2026-09-09.

### Status

Accepted; updated for the current Automatic, Online and Local-only modes.

### Context

Silent fallback can make an unavailable engine appear reliable while violating the user's selected privacy or execution semantics. An action that quietly reaches a cloud provider when Local-only was selected is a product failure even if it returns an answer.

### Decision

Routing honors the selected intelligence mode and returns an actionable refusal when no permitted backend can serve the request. Local-only never contacts an online provider. Online reports provider unavailability instead of changing modes. Automatic may use only the explicitly documented eligible fallback path while preserving the same commercial permit and must surface the backend/state truthfully. Dependency failures that would produce incomplete or misleading context fail closed rather than fabricating a complete answer.

### Reasoning

Privacy and mode selection must be structural guarantees, not copy. Centralized refusal reasons and remedies make unavailable states useful without scattering inconsistent error text across callers.

### Trade-offs and Consequences

OCADE will sometimes fail visibly instead of substituting an unapproved backend. Each supported environment needs tested, actionable remediation, and routing policy must remain directly testable without requiring the physical device it describes.

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

Accepted; documentation cleanup decision, partially refined by the documentation-role decision below.

### Context

The repository accumulated `PLAN.md`, mission docs, kickoff docs, payment addenda and `AGENTS.md`/Claude instructions that could compete for authority.

### Decision

Root `PLAN.md` is the sole implementation plan. Root `CLAUDE.md` is the sole AI-agent handbook. Remove `AGENTS.md` and the superseded `docs/mission/*` instruction bundle after unique requirements are merged.

### Reasoning

A single master implementation authority and a single AI handbook reduce contradictory instructions and wasted context.

### Trade-offs and Consequences

Historical evidence/audit/legal/provenance documents may remain as supporting records but cannot override newer canonical decisions.

## Canonical role-specific documentation includes TRD, UI UX Brief and Backend Schema

### Date

2026-09-08

### Status

Accepted; supersedes only the earlier decision to fold these three roles entirely into Architecture/Design.

### Context

The project's document-design guidance calls for focused source-of-truth documents for product, technical requirements, flow, UI/UX intent, backend schema, rules, memory, decisions and testing. The owner explicitly requested separate TRD, UI/UX Brief and Backend Schema documents while retaining `DESIGN.md` and avoiding duplicate master plans.

### Options Considered

Keep all technical/schema detail only in `ARCHITECTURE.md` and all UX intent only in `DESIGN.md`; create three independent duplicate specifications; create three complementary role-specific documents with strict ownership boundaries and cross-references.

### Decision

Keep `PLAN.md` as the sole implementation sequence and `CLAUDE.md` as the sole AI handbook. Add `docs/TRD.md`, `docs/UI UX Brief.md` and `docs/Backend Schema.md` as complementary authorities. `TRD.md` owns implementation-level technical requirements; `UI UX Brief.md` owns concise experience/information-architecture intent while `DESIGN.md` remains the detailed design-system authority; `Backend Schema.md` owns the logical/physical backend data contract while migrations/generated Supabase types remain the physical schema authority.

The canonical role-specific set is therefore PRD, TRD, APP_FLOW, UI UX Brief, DESIGN, ARCHITECTURE, Backend Schema, RULES, TESTING, MEMORY and DECISIONS.

### Reasoning

This preserves the source-of-truth discipline of one purpose per document while making critical requirements easier for engineering agents to locate. Cross-references are cheaper and safer than repeating entire specifications.

### Trade-offs and Consequences

Some facts necessarily appear briefly in multiple documents for context, but detailed ownership remains explicit. Future documentation changes should update the owning file and link to it instead of copying sections. Supporting audit/readiness/legal/provenance/runbook files may remain historical evidence and are not canonical product authority.

## Recent strong authentication gates the grant of access, not its withdrawal

### Date

2026-09-10

### Status

Accepted.

### Context

`PLAN.md` Phase 3 requires recent AAL2 before a dangerous organization, Admin or support action. Applying that literally to every mutation on those surfaces produces a confirmation prompt on acts that reduce risk — suspending a member, revoking an invitation — and the cost lands exactly when an administrator is responding to a compromised account and cannot reach their authenticator.

### Options Considered

Gate every mutation uniformly; gate nothing and rely on the role check; gate by direction.

### Decision

Gate the acts that CREATE or RESTORE access: inviting an address, re-issuing an invitation link, reactivating a suspended member, changing a role, changing policy, transferring ownership, deleting a workspace, removing a member, and the support and status writes that publish to readers. Leave the withdrawing direction reachable from a session whose last proof is old: deactivating a member is not gated, and `ocade_set_organization_member_state` tests the direction rather than the fact of a change. Leave acts that grant nothing ungated, and say why in the migration — organization groups are `(id, organization_id, name, created_at)` with no policy, capability or RLS predicate reading membership.

### Reasoning

Re-issuing an invitation link reads harmless because the address does not change, but the old token stops working and a new valid one starts — the same capability as inviting. Direction, not table, is what separates the dangerous act from the cautious one. A prompt in front of the cautious act is friction with no risk behind it, which is how confirmation prompts stop being read.

### Trade-offs and Consequences

The rule is not "every mutation on this table", so each new mutation needs a decision recorded with it. `organization-assurance.test.ts` pins both halves against real PostgreSQL — the grant refused from a stale session, and the suspension still allowed — so a later change that gates uniformly fails rather than quietly adding friction to incident response. If a group ever gains an effect on access, it joins the gated list.

## Generated Supabase types are regenerated, never hand-corrected

### Date

2026-09-10

### Status

Accepted.

### Context

`src/integrations/supabase/types.ts` is generated from the live database. The generator reads only two facts about a function parameter — its type and whether it has a DEFAULT — so a parameter with a default becomes optional and non-nullable, and one without becomes required and non-nullable, even though Postgres accepts NULL for both. Postgres has no NOT NULL parameter, so the generator cannot express what these functions actually take. Regenerating after Phase 3 turned four correct calls into type errors.

### Options Considered

Hand-edit the generated file; widen the call sites to `any`; change the SQL signatures to carry DEFAULT NULL everywhere; pass values that type-check but change behaviour; cast at the call site.

### Decision

The generated file stays generated. Where a parameter has DEFAULT NULL, omit it and let Postgres apply the default. Where NULL is not meaningful, pass the real value. Where a parameter has no default and NULL IS the meaningful value — an unlimited weekly allowance, a notification with no deep link — launder that one argument through `sqlNullable` in `src/lib/supabase/rpc-null.ts`, at the call site, where a reader can see which parameter and why.

### Reasoning

Hand-editing the file makes the next regeneration destroy the fix silently. `any` at the call site turns off checking for the whole call, which is the defect `scripts/check-supabase-types.mjs` exists to prevent. Substituting a value — an empty string for a missing link, zero for an unlimited allowance — type-checks and stores the wrong thing. Adding DEFAULT NULL to a mid-list parameter forces defaults onto every parameter after it. A named, documented, single-argument cast is the smallest honest answer.

### Trade-offs and Consequences

`sqlNullable` is a cast and could be misused to launder any null; its documentation names the one case it is for, and the three cases it is not. Regenerating types remains a required step after every migration, and `supabase:types-check` fails the build when a migrated table is missing from the file.

## Offline Intelligence prepares on the first visit, and the landing page is protected by deferral rather than by a gate

### Date

2026-09-10

### Status

Accepted. Supersedes the behaviour introduced by an earlier plan revision whose §17 opened with "After authenticated login".

### Context

The root shell gated preparation on `signedIn`. It was added for a real, measured reason: the installer's bootstrap was running inside the same task as hydration, on the public landing page, so an anonymous visitor deciding whether to sign up paid for device probing, catalogue resolution, a storage-persistence request and then a model transfer. It was found through the landing page's Total Blocking Time. The current `PLAN.md` and `docs/TRD.md` require the opposite — preparation begins on the first browser or device visit, including while the landing page is displayed, without blocking landing or auth.

### Options Considered

Keep the sign-in gate and accept the drift; start on first visit and accept whatever it costs the landing page; start on first visit with the work deferred out of the hydration task and the installer loaded on demand; start on first visit but postpone on a metered connection.

### Decision

Preparation starts on the first visit, signed in or not. The landing page is protected by the two mechanisms that actually make it cheap rather than by not doing it: the installer is never imported statically, so the entry bundle does not carry the transfer engine, the streaming digest, the vault or the catalogue; and the start is deferred to an idle callback with a 1.5-second timeout, falling back to a 200 ms timer, so it can never share a task with hydration. A metered connection tunes the transfer rather than postponing it, per `download-plan.ts`: "the local engine is the product, not an optional extra."

### Reasoning

The gate did not make preparation cheaper, it made it not happen — and the cost it was avoiding was a scheduling defect, not an inherent cost of preparing. Deferral fixes the scheduling defect directly and leaves the product behaviour the plan asks for. Measured after the change, the landing page reports LCP 300 ms, CLS 0.0124 and TBT 29 ms against a 200 ms budget, and eager JavaScript is unchanged at 630.8 KiB.

### Trade-offs and Consequences

A visitor who never signs up may transfer a model they never use, on their own bandwidth. That is the trade the plan makes deliberately, and it is bounded by the same explicit Remove control every other visitor has. `preparation-starts-on-first-visit.test.tsx` holds both halves — that it starts without a session, and that the deferral and the dynamic import are still in place — so a future edit cannot reintroduce the gate quietly, and cannot remove the deferral that makes starting acceptable.
