# Ponytail Debloat Ledger

## Identity and scope
- Audited main: `f277408aaaf5381c949bb62119d84f7fa57ffb09` in `BREVEX-CEO/caera-connect-plan`.
- Ponytail Ultra is used for analysis only. No removal, refactor, dependency change, UI change, or cleanup is authorized.
- Status: **IN PROGRESS / PARTIAL**. Opportunities are proposals, not proof of safe deletion.
- Preserve immutable donor/ZIP provenance, historical audits, applied migrations, legal/license records, security checks, cancellation/STOP, account isolation, recovery and rollback, accessibility, required platform integration and verified fidelity adapters.


## Opportunities (recorded continuously)

### D-001 — Reconcile outdated active roadmap summaries
- Discovery: authority source reading.
- Evidence: `docs/COMPANY_PRODUCT_AUTHORITY.md`, final Master execution roadmap paragraph, still calls PLAN.md Phase 1–49 canonical; `docs/MEMORY.md` also describes Phase 1–49. `CLAUDE.md` has newer 2026-10-03 Phase 50–56 authority.
- Proposal: after owner-approved implementation proof, update only active summaries to reference the actual current plan range. Preserve historical phase evidence and append-only owner instructions.
- Benefit: reduce conflicting navigation and accidental revalidation/restart of superseded instructions.
- Risk: Low for active-summary correction; High if history/authority is deleted wholesale.
- Verification: read all PLAN.md addenda, cross-check authority order and every linked phase reference. No deletion is currently proven safe.


### D-002 — Consolidate active wake-install guidance
- Discovery: authority source reading.
- Evidence: `docs/MOBILE_DEVICE_CONTROL.md`, Voice and wake, says OCADE downloads the model after enablement. `docs/COMPANY_PRODUCT_AUTHORITY.md`, Voice, and `docs/JARVIS_DEVICE_ROADMAP.md`, Voice and wake, require the bundled signed model with no post-install download. Newer AGENTS/CLAUDE addenda supersede the download instruction.
- Proposal: reconcile the active mobile guidance with the bundled-model authority after install/health/update/rollback proof. Preserve older append-only owner statements as historical evidence.
- Benefit: avoid duplicate installer paths and confusing customer instructions.
- Risk: Low for documentation; High for deleting runtime paths before equivalent platform proof.
- Verification: trace both desktop and Android bundle manifests and all wake startup callers; test offline startup, enablement, integrity refusal and rollback. No runtime deletion is proven safe yet.

The opportunities below cover dead/duplicate code, hard-coded paths, configuration/dependencies, architecture, resources, UI/mobile/accessibility and Owner/Staff/Devices/JARVIS simplification. No proposal establishes safe deletion without its named verification; second-pass and unavailable runtime evidence remain incomplete.


### D-003 — One wake-release verifier across desktop and Android
- Discovery: source review, F-001/F-002 in the error ledger.
- Evidence: desktop authenticates `manifest.sig` with the update key; Android omits that asset and trusts manifest-supplied hashes. Android repeats detector timing constants also held in the manifest.
- Proposal: keep platform-specific DSP/execution, but derive packaging/version/hash/timing and verification contracts from one canonical signed release manifest. Do not weaken either platform's validation.
- Benefit: fewer drift-prone authorities and consistent release health/rollback behavior.
- Risk: Medium; cross-language inference parity and bundled offline startup must survive.
- Keep: `WakeModel.java`, local audio processing, signed manifests, privacy boundaries, platform microphone lifecycle, and parity tests.
- Verification before removal: clean checkout signature tests, wrong-signer/tamper tests, final APK/desktop package inspection, inference parity, local audio/permission/STOP/restart evidence.


### D-004 — Consolidate file/Office backup lifecycle
- Discovery: source review and disposable reproduction of F-003.
- Evidence: sheets `backup` and Word `edit_word` duplicate second-resolution naming; Computer uses the sheets helper for general files. Retention is capped in the sheets helper but not the Word copy path.
- Proposal: one minimal backup operation with exclusive identity, bounded retention and restore metadata, shared by files/Word/sheets.
- Benefit: remove duplicate recovery logic and fix naming/retention drift.
- Risk: Medium; backups and undo are must-stay capabilities, never deletion targets until equivalent recovery is proven.
- Verification: same-second edits, identical basenames, original preservation, failed edit, missing backup, changed source, cross-workspace restore refusal and bounded disk usage.


### D-005 — Bound preview and range work at shared entry points
- Discovery: source review and disposable 10 MB preview, F-008.
- Evidence: document/general-file previews duplicate full-read-then-slice behavior; OOXML preview builds complete parts; sheet editing eagerly expands ranges even for operations that can use metadata directly.
- Proposal: small shared bounded text/ZIP readers and numeric range/area validation, with lazy iteration only for operations that need cells. Keep each format's fidelity and refusal rules.
- Benefit: less allocation, latency and duplicate parsing; simpler cancellation and resource limits.
- Risk: Medium; encodings, archive structure, formula translation, whole-column semantics and macros must survive.
- Verification: large/sparse text, ZIP expansion limits, out-of-grid/range budgets, cancellation, legitimate complete-column formatting and identical preview output within the cap. No deletion is proven safe yet.


### D-006 — Share the opaque-key fetch shim and load configuration directly
- Discovery: frontend source reviewer; full reads of the three clients and their import boundary.
- Evidence: `src/integrations/supabase/client.ts:34-59`, `client.server.ts:9-34` and `auth-middleware.ts:7-32` duplicate the opaque-key/apikey fetch shim. `on-demand.ts:36-39` imports the client only to read configuration although `configuration.ts` is lightweight.
- Proposal: share only the pure fetch helper and import configuration directly where no client is needed; preserve the dynamic server/client boundaries.
- Benefit: less duplicate authentication transport logic and avoid needless client loading on configuration reads.
- Risk: Low/Medium; a misplaced shared import could pull server code into browser bundles or alter key/header behavior.
- Keep: separate server/browser clients, every auth/role/session check and JWT/opaque key support.
- Verification before removal: both key formats, apikey/header propagation, browser/server bundling, public-call behavior and measured bundle/network effect. No client removal is proven safe.


### D-007 — Retire the proven stale reachability exemption
- Discovery: fresh reachability gate and tracked-file cross-check, F-011.
- Evidence: `scripts/check-reachability.mjs:60-61` exempts `src/ffprobe-static.d.ts`, which no longer exists.
- Proposal: remove that obsolete entry only in a separately authorized cleanup.
- Benefit: remove dead maintenance metadata and restore the meaningful gate.
- Risk: Low for this precise entry; preserve the checker and all exemptions still required by live declarations.
- Verification: complete tracked source inventory, callers/build/types and a passing reachability run after removal.


### D-008 — Remove obsolete authentication example flags
- Discovery: support source reviewer and whole-source reference search.
- Evidence: `.env.example:10-13` contains false `VITE_AUTH_*` flags without active runtime consumers; `src/lib/auth/provider-availability.ts:1-26` describes replacement by Supabase's auth settings.
- Proposal: retire only those obsolete example flags after current provider detection is proven.
- Benefit: avoid misleading setup switches and unused configuration.
- Risk: Low after reference/build/deployment-template proof; preserve provider availability code, tests and valid secret setup documentation.
- Verification: all runtime, build, deploy and documentation readers; dynamic configured/unconfigured provider behavior. No auth setting has changed.


### D-009 — Retire the removed WebLLM server alias
- Discovery: support source reviewer, target existence and reference searches.
- Evidence: `nitro.config.ts:33-37` aliases `@mlc-ai/web-llm` to absent `src/lib/brain/adapters/webllm.server.ts`; active code/package metadata has no import of that runtime.
- Proposal: remove the stale alias/comment once current wllama offline/client/server paths are proven.
- Benefit: reduce dead bundler configuration and references to an absent implementation.
- Risk: Low/Medium; keep the active offline runtime and its proof gates, licensing and recovery.
- Verification: full browser/server build, dependency/reference checks and real offline inference; check any release-specific build consumers before deletion.


### D-010 — Consolidate future schema generation while preserving applied duplicate history
- Discovery: backend migration chronology source read.
- Evidence: migration pairs `20260722090000`/`20260815123219` (projects/output/memory), `20260722100000`/`20260815123309` (subscriptions), `20260722110000`/`20260815123358` (automations), `20260724211500`/`20260815123622` (worker lifecycle) repeat definitions.
- Proposal: simplify future schema generation/review or create a separately approved disposable baseline snapshot; do not delete/rewrite applied migration, rollback or verification triples.
- Benefit: reduce future duplicate schema work without losing replay/provenance/recovery.
- Risk: HIGH for history changes. These applied files must STAY.
- Verification: empty-database rebuild and exact hosted applied-ledger/schema parity before considering any future baseline process. Historical retired FICIA/messenger/automation paths must not be misreported as current release bugs.


### D-011 — Reconcile packaged desktop icon with the current OCADE identity
- Public icon quality extension2026-10-05: original native-size views of public/icons/ocade-512.png and ocade-192.png show the larger icon visibly softer. Both decode correctly and match manifest dimensions; this is a visual polish opportunity, not broken-image evidence. If separately authorized, verify an existing authoritative high-resolution/vector master before exporting a sharper512 variant. Keep required192/512/Apple/favicon size variants and branding/provenance; no deletion proposed. Risk Low-Medium; verify install/notification/native-size rendering across available platforms before replacing assets.
- Discovery: read-only ICO rendering and packaging source review.
- Evidence: `jarvis-runtime/config/jarvis.ico` decodes at six sizes (16–256 px) to the cyan donor-style circular mark; `packaging/ocade-agent.spec` uses it as the Windows executable icon. The tray generates its own identity separately.
- Proposal: compare executable/installer/tray/web/Android marks against the current design authority and use the approved OCADE asset consistently in future authorized work.
- Benefit: clearer Windows product identity and fewer distinct asset authorities.
- Risk: Low/Medium; keep immutable donor/icon provenance and all required ICO sizes. This is an identity/UX proposal, not a claimed functional failure.
- Verification: executable, installer, taskbar/tray, shortcut and high-DPI appearance; preserve signed-package verification and contrast/accessibility. No asset changed.


### D-012 — Share only identical E2E authentication mechanics
- Discovery: support script source review.
- Evidence: RFC6238 helpers repeat in `scripts/e2e/admin-journey.mjs:29-42` and `mfa-journey.mjs:31-44`; args/storage-key/session-seeding/polling mechanics recur across 26 journeys.
- Proposal: tiny test-only helpers for identical mechanics; remove duplicate bodies only after equivalence proof.
- Benefit: fewer drift-prone copies and clearer journey-specific assertions.
- Risk: Low/Medium; preserve distinct timeouts/rejections/one-time seeding and the stub's independent TOTP authority.
- Verification: representative auth/admin/MFA/browser positive and negative journeys; cancellation, isolated state and current source coverage. No tests or helpers changed.


### D-013 — Reconcile dated MFA failure wording with later recorded recovery
- Discovery: authority/document source cross-check.
- Evidence: `docs/OWNER_ADMIN_BACKEND.md:55` describes a currently failing TOTP flow, while `docs/MEMORY.md:77` and later MFA journey evidence describe repaired enrollment. These dated notes are not fresh live MFA proof.
- Proposal: distinguish historical failure from current active operating guidance after fresh isolated/platform MFA verification.
- Benefit: reduce contradictory setup/support instructions.
- Risk: Medium; preserve dated authority, supersession and original failure evidence.
- Verification: fresh enrollment/challenge/recovery/lockout/session assurance, then update only active wording in future authorized work. D-002 already covers the analogous superseded wake-download sentence.


### D-014 — Share accessible modal lifecycle across Settings, identity proof and drawer
- Evidence: F-048; three custom overlays implement separate partial keyboard/lifecycle behavior.
- Proposal: connect overlays to one suitable existing/native modal authority with focus containment, initial/return focus, inert background and nested-dialog behavior. Keep platform-appropriate drawer layout.
- Benefit: less repeated overlay code and consistent keyboard/mobile accessibility.
- Risk: Medium; confirmation must stay above Settings and Escape must not dismiss the wrong layer.
- Keep: identity proof, responsive layouts, confirmations and route-driven closure.
- Removal safety: no overlay logic can be deleted until Tab/Shift+Tab/Escape, trigger restoration, nested proof, mobile scroll and screen-reader behavior are proved.


### D-015 — Reuse truthful async state handling in Data Controls and notification history
- Notification acknowledgement extension2026-10-05 (F214/F215): retain provider/browser/server outcome distinctions through existing delivery and toggle owners rather than duplicating optimistic success assumptions. Inspect final delivery-status persistence and both unsubscribe results; reuse existing pending/error/retry presentation. Risk Low-Medium; preserve actual subscription/notification ownership and immutable history. Verify ordinary resolved-error/false/rejected/successful outcomes before removing only redundant unchecked branches. No provider, subscription, DB or product change executed.
- Evidence: F-039/F-040; shared Pending exists while Data Controls recreates empty-state logic without errors, notification write result is ignored.
- Proposal: reuse existing read-state component and a small explicit result branch; avoid a new generic state framework.
- Benefit: less duplicate UI logic, meaningful failure/retry states and consistent account-data behavior.
- Risk: Low-Medium; preserve confirmed deletion boundaries and cached content during transient failures.
- Keep: separate conversations/library/offline removal confirmations and server security gates.
- Verification: empty/loading/read refusal/delete refusal/notification write refusal and successful refresh; only superseded branches may be removed afterward.


### D-016 — Keep immutable donor/prototype provenance; avoid reconnecting incomplete systems wholesale
- Evidence: F-037/F-038/F-041/F-042/F-043/F-050/F-051/F-053/F-054 are preserved donor/archive hazards, not proven current shipped paths.
- Proposal: retain archives and source-original; if a capability is needed, adapt only its necessary behavior into current platform authorities after safety/ownership proof. Do not reconnect dynamic installers, raw-shell launchers, prototype controls or donor storage as parallel production systems.
- Benefit: avoids duplicate unsafe lifecycle/storage/launch authorities and nonfunctional UX.
- Risk: High for deletion or wholesale reuse; no immutable archive/source deletion is established safe.
- Must stay: attribution, provenance, visual references, manifests and original bytes. Archived ©2013 MARVEL visual references have unverified licensing; no infringement or shipped asset use is asserted. Current procedural graph use is separate evidence.
- Verification before any authorized reuse/removal: caller and packaging trace, license review, real behavior, failure cleanup, concurrent writes and all relevant platform boundaries.


### D-017 — Replace superseded auth source-string assertions with behavioral abuse proofs
- Evidence: `src/lib/auth/__tests__/auth-surfaces.test.ts:25-130` asserts presence/regex strings; behavior may diverge while strings/comments satisfy checks.
- Proposal: keep architectural/provider-exposure contracts; consolidate repetitive screen-string checks only after equivalent forged-reset, method refusal, throttle and redirect behavior tests exist.
- Benefit: fewer brittle implementation-coupled tests and more useful security evidence.
- Risk: Medium; explicit policy checks must not disappear accidentally.
- Keep: provenance/security intent and meaningful static architecture checks.
- Verification before deletion: same abuse cases plus signed-in/out UI coverage and negative fixtures must fail for unsafe behavior.


### D-018 — Consolidate browser display labels on the existing tested user-agent parser
- Evidence: F-046; `src/lib/browser-install-id.ts:35-49` duplicates `src/lib/security/user-agent.ts`, whose fixtures already distinguish iPhone/macOS and browser variants.
- Proposal: reuse display classification with deliberate output mapping; keep random installation identity and coarse device-kind privacy boundary separate.
- Benefit: fewer competing label authorities and clearer Devices/Session recognition.
- Risk: Low-Medium; visible persisted naming changes require compatibility review.
- Keep: installation ID/storage, account isolation, nonfingerprinting guarantees and unknown-device fallback.
- Verification before removing parser: Windows/Android/iPhone/iPad/desktop fixtures, existing Devices/Session names and real available browser rendering; physical Apple coverage remains separate.


### D-019 — Reduce avoidable per-frame JARVIS Orb work after measuring mobile cost
- Evidence: `src/jarvis/Orb.tsx:122-160,181-188,299-309` performs layout/style reads, node filtering and Set/Map allocation in paint for up to 300 records.
- Proposal: cache layout/theme/static membership until resize/theme/zoom/graph changes; keep the existing 2D canvas and deterministic graph. No measured CPU regression is claimed.
- Benefit: potential lower allocation/layout cost, mobile CPU/battery use and smoother rendering.
- Risk: Medium; stale caches can misalign pointer targeting or theme/zoom appearance.
- Keep: keyboard fallback, reduced motion and deterministic graph semantics.
- Verification before replacing work: representative mobile frame/CPU/battery measurements, theme/resize/zoom/graph transitions, pointer alignment and reduced motion. No deletion is safe merely from a hot-loop source pattern.


### D-020 — Measure growing-table foreign-key scans; retain unproven unused indexes
- Evidence: live performance advisor identifies controls.changed_by, control_events.changed_by and usage_adjustments.actor without covering indexes. Source: `supabase/migrations/20260929090000_jarvis_execution_control.sql:11,22,27`; `20261002090000_owner_customer_operations.sql:81,91`. Singleton controls do not justify automatic indexing. No latency defect measured.
- Proposal: scaled disposable EXPLAIN/account-deletion measurements before targeted future indexes on growing event/adjustment tables; preserve the 21 advisor-labelled unused indexes pending real query/cascade coverage.
- Benefit: potential cheaper actor deletion/SET NULL and lower unnecessary index/storage overhead if evidence supports it.
- Risk: High for dropping indexes from zero-usage telemetry alone; ownership/tombstone/device/cascade paths may need them.
- Keep: applied migration history, security/isolation constraints and recovery indexes.
- Safe order/verification: resolve correctness/isolation issues, measure representative queries/cascades, separately authorize targeted change, then migration/reapply and account-deletion proofs. No index or migration change executed.


### D-021 — Remove duplicate manual Help indexing only after answer-search parity
- Evidence: F-064; manual words omit terms in the published answers.
- Proposal: one plain answer/search authority that renders existing rich content or a small derived index; do not add a general search service for 25 FAQs.
- Benefit: simpler maintenance and discoverable safety/enrollment guidance.
- Risk: Medium for rich React content/link semantics.
- Keep: all FAQs, topic filters, disclosures and links; existing manual words may include useful synonyms.
- Verification before deletion: answer terms, synonym searches, no-match states, keyboard/mobile and link behavior; delete only redundant keyword entries after equivalent coverage.


### D-022 — Prefer shared provider-aware calls and standard JSON parsing in any donor adaptation
- Evidence: F-063/F-065/F-066; donor helpers duplicate provider/result interpretation, then discard array or process outcomes.
- Proposal: preserve original donor; any necessary adaptation should reuse one provider call/normalizer and parse complete JSON with the standard library before bounded fence handling. Keep structured process status rather than string-based success heuristics.
- Benefit: fewer divergent routing/parsing paths and truthful readiness.
- Risk: Medium; provider tool/stream contracts and safe process boundaries need separate proof.
- Keep: immutable source, provider capability distinctions and refusal/error paths.
- Verification before removing adapted duplicate helpers: both provider formats, object/array/fenced/malformed JSON, stream/tool output, nonzero exits, timeouts and save failure. No current product cleanup executed.


### D-023 — Retired share-route robots residue is a conditional small cleanup candidate
- Evidence: `src/routes/robots[.]txt.ts:18-28` retains retired share-route commentary/disallow.
- Proposal: remove only obsolete active-route residue after confirming no served share route or external deployment dependency. Historical rationale can remain in provenance.
- Benefit: less misleading configuration commentary.
- Risk: Low only after deployment/route inventory confirms absence.
- Keep: robots restrictions for API/auth/settings and intentional indexing/security policy.
- Verification before deletion: generated route inventory, current served URLs, crawler output and historical share compatibility; no deletion approved/executed here.


### D-024 — Reconcile current installation invariants and remove only obsolete comments
- Evidence: `src/lib/brain/download-plan.ts:53-63,111-126` describes eight transfers/128 MB while constants set different concurrency and a 64 MiB memory cap; `installation-authority.ts:135-198` retains obsolete rung/runtime-download narratives.
- Proposal: short current safety invariants; move unique historical reasoning to preserved authority/provenance instead of retaining contradictory implementation commentary.
- Benefit: smaller misleading source narratives and clearer lifecycle maintenance.
- Risk: Low runtime, Medium authority/source-regex-test risk.
- Keep: durable checkpoint/streaming rationale, privacy/safety contracts, lazy installation-state split and unique provenance.
- Verification before removing comments: current constants/callers, history value, authority parity, type checks/contracts and static tests; no source formatting/cleanup executed.


### D-025 — Use one type owner for identical model writer contracts
- Evidence: ModelFileWriter shapes in `src/lib/brain/model-store.ts:55-59` and `model-vault.ts:116-123` duplicate the same interface.
- Proposal: type-only import from one responsible owner; retain distinct store/vault lifecycle authorities and safety comments.
- Benefit: less type drift without runtime machinery or a new abstraction.
- Risk: Low-Medium module-boundary/lazy import sensitivity.
- Keep: vault/store ownership, streaming/durable semantics and install-state split.
- Verification before deleting duplicate type: all consumers, typecheck, emitted runtime/import graph and write/flush/resume contracts; no consolidation executed.


### D-026 — Adapt only necessary donor UI/control capabilities through current authorities
- Phone login extension2026-10-05 (F205): donor dashboard/static/login.html:5,27-29,142-146 requests disabled zoom, fixes card width340px, leaves key input with dots-only placeholder and async error without announcement semantics. In a separately authorized adaptation, allow zoom, use viewport-bounded native CSS width, explicit label and live/alert feedback. Keep immutable original/D016; no file is safe to delete from this evidence. Risk Low; verify keyboard/screen reader,320px+zoom, error focus and actual flex behavior. Narrow overflow/browser zoom enforcement unmeasured; no physical platform PASS claimed.
- Evidence: donor desktop.py/file_controller.py contain separate organize engines; game_updater uses per-app IDs/localized coordinate fallbacks; avatar _lids is unconsumed (F-074), updater failsafe mutation F-075.
- Proposal: preserve immutable source; any future adaptation should connect generic scoped controls to the current safety backend, consolidate duplicated organize behavior and either connect required expression state or omit proven-unused animation state.
- Benefit: fewer app-specific paths, unsafe parallel control systems and unused rendering state.
- Risk: High for control deletion/reuse, Medium for visual state changes.
- Must stay: archives, provenance, undo/scope/Stop behavior and platform safety controls.
- Verification before any deletion from a separately authorized adapted implementation: caller/packaging trace, capability parity, undo/scope, locales, actual platform controls, cancellation and visual expression parity. No donor deletion proposed.


### D-027 — Bound and batch donor log rendering if adapted
- Evidence: donor `ui.py:1000-1090` limits rendered document blocks to 600 but retains an unbounded pending queue with character rendering at a 6 ms cadence.
- Proposal: preserve original donor; an adapted UI can use bounded pending history and native Qt batched text insertion instead of a per-character backlog.
- Benefit: bounded retained text and less timer/render work. Actual sustained-load latency/resource impact remains UNTESTED.
- Risk: Medium; animation cadence and message ordering can change.
- Must stay: required diagnostics, error visibility, ordering and original provenance.
- Safe order/verification: measure queue growth with fake burst logs, decide history policy, verify cancellation/unmount and visible ordering before any separately authorized change. No cleanup executed.


### D-028 — Prefer a minimal maintained crypto surface only in an adapted donor dashboard
- Unused vendor API extension2026-10-05 (F222/F223): passive full readable bundle inspection shows ZeroPadding exhausted-zero edge case and shared Blowfish key tables. Donor selected dashboard uses AES/Pkcs7; no current selected-path failure is established. Preserve immutable bundle/license/provenance. Future adapted native/maintained replacement must prove actual AES/protocol bytes and supported instance/edge-case behavior before removing unused adapted algorithms; do not surgically delete arbitrary minified vendor segments. Risk Medium-High for protocol compatibility; no crypto/security probe or cleanup executed.
- Evidence: immutable dashboard includes 60.8 kB full CryptoJS bundle; application references AES, SHA256, Hex/Base64, CBC, Pkcs7 and random primitives. Unused Base64url mode cache defect is F-083.
- Proposal: assess native WebCrypto or a minimal maintained dependency for an adapted dashboard, after proving the exact existing protocol. Do not remove the preserved source bundle.
- Benefit: less shipped adapted code and a smaller maintenance surface; no performance saving measured.
- Risk: High; encryption bytes, key derivation, randomness, padding, mobile/offline behavior and async interfaces must remain compatible.
- Must stay: immutable archive/provenance and required protocol functionality.
- Safe order/verification: inventory consumers, golden byte/protocol vectors, key handling, supported browser/mobile/offline environments, then measure bundle delta before proposing removal. No replacement executed.


### D-029 — Remove only proven dead adapted UI forwarding paths and format claims
- Evidence: donor glance facade targets a nonexistent avatar (F-085), XML dispatch has no XML implementation (F-089), and spreadsheet output duplicates CSV handling without format ownership (F-088).
- Proposal: preserve original; an adaptation should forward to existing HUD ownership, advertise only connected processors and use existing format-specific native writers. Avoid another parallel controller layer.
- Benefit: fewer misleading capabilities and duplicate ownership paths.
- Risk: Medium-High; current facade callers, format fidelity and capability parity require proof.
- Must stay: archives, current operational interfaces, retained content and supported format contracts.
- Safe order/verification: trace all adapted callers/packaging, decide necessary capabilities, verify facade forwarding and reopen format-specific output before any deletion. No cleanup executed.


### D-030 — Make Library controls discoverable on touch and use one truthful open/download contract
- Evidence: `src/routes/_authenticated/library.tsx` hides Download/Delete with opacity-0 except hover/focus and routes both preview/Download to asynchronous window.open (F-091); listing/search has a fixed 500-item completeness gap (F-090).
- Proposal: keep touch actions visible or use one accessible menu, with distinct standard navigation/download semantics and bounded paging. Reuse existing Pending error states.
- Benefit: less misleading action behavior and fewer hidden controls; no extra parallel file subsystem needed.
- Risk: Medium; touch hit targets, keyboard access, popup/download policy and storage URL lifecycle need validation.
- Must stay: Library ownership, upload bounds, failed-read distinction, deletion queue and original file bytes.
- Safe order/verification: real desktop/touch/keyboard route testing, signed URL behavior, 501-item paging, deletion/pending/error parity before separately authorized UI changes. No UI change executed.


### D-031 — Keep one reduced-motion OS rule and separate only the explicit user override
- Evidence: `src/styles.css` repeats the same prefers-reduced-motion universal animation/transition declarations unlayered and inside @layer base; the later base rule additionally sets scroll-behavior. Explicit .reduce-motion override also exists.
- Proposal: consolidate only the redundant OS declarations after cascade verification; retain explicit user override and skeleton/pop animation exceptions.
- Benefit: shorter style authority and less chance of divergent accessibility behavior.
- Risk: Low-Medium; layer precedence and utilities can affect first paint.
- Must stay: pre-hydration OS preference, user setting, animation cleanup and keyboard visibility.
- Safe order/verification: compare emitted CSS/cascade and first-paint reduced-motion browser behavior across themes/platforms before deleting duplicate declarations. No style edits executed.


### D-032 — Shorten obsolete chat-storage and fetch incident commentary while preserving current invariants
- Bootstrap-comment accuracy extension2026-10-05: src/routes/__root.tsx:223-229 still promises preparation on any first supported visit including signed-out, while250-271 requires an account and a Chat visit, then retains prepared state. Shorten obsolete top narrative to current trigger, preserve background retention and unique historical rationale. Risk Low for future comment correction; no code edits, runtime execution or new runtime-defect claim.

- Session-comment accuracy extension2026-10-05: src/lib/session.ts:46-60 promises stored-token fallback on failed refresh, but rejection73 and module-load failure93 settle(null); describe the actual settled signed-out state without claiming an implemented storage fallback. src/lib/security/sessions.functions.ts:63-65 says listing requires no second factor, while middleware69 and session-middleware.ts:75-76 enforce factor-required results. Risk Low for future comment correction; keep mounted/subscription cleanup, lazy loading and current assurance policy. Source-only narrative comparison; no refresh, auth, session or security execution, no current hosted incidence/enforcement claim.

- Shared helper reachability extension2026-10-05: reauthentication.ts:9-18,108-111 says password-proof replaces two active sites, but proveIdentityWithPassword symbol search finds only own declaration/test consumers; IMPLEMENTATION_LEDGER.md:483 calls it test-only and ToRemove.md:194 explicitly preserves intentional test-only exports. Reconcile narrative with current graph while keeping this helper, meaningful fixtures and production assuranceRefusalOf consumers. Risk Low for future comment correction; no safe deletion established. Generic returned-error-to-wrong_password mapping here is not a current live UI finding. Passive source only, no auth/provider/security execution.

- Isolation guidance extension2026-10-05: isolation-upgrade.ts:4-8 describes nonisolated landing and /ocade transition, while current isolation.ts:44-87 isolates `/`, denies /auth and treats /ocade as404. Obsolete allowlist commentary also remains at145-148,212-214 despite current denylist. Shorten historical examples to current chat/auth document crossing while preserving one-attempt, Safari and query/fragment invariants. Risk Low for future comment-only correction; keep code/security policy and unique incident provenance. Passive source comparison only, no isolation/auth/security execution or enforcement claim.
- Evidence: `src/lib/ocade-chat-store.ts:48-64` still says unsynced turns live only in the tab and closing discards them despite the durable encrypted journal; `src/lib/intelligence/online-client.ts:38-75` repeats lengthy fetch-binding/build-flag incident history around a small implementation.
- Proposal: keep concise durable replay, lazy-client and wrapped-fetch invariants; preserve unique incident details in existing historical evidence rather than contradictory current comments. This extends D-024's comment-authority approach.
- Benefit: clearer lifetime ownership and less stale specification; F-095 still needs an actual persistence fix later.
- Risk: Low runtime, Medium provenance/source-contract test risk.
- Must stay: one account authority, offline journal encryption/replay, wrapped fetch, lazy imports and unique recovery rationale.
- Safe order/verification: current call graph and journal lifecycle, source-contract tests, historical reference check, then any separately authorized comment deletion. No source/comment edits executed.


### D-033 — Remove contradictory historical test narratives only after preserving their decision history
- Ordinary fixture narrative extension2026-10-05: src/lib/security/__tests__/reauthentication.test.ts:86-93 names list-read failure fallback, but supplied client has claims only and does not select mock factorsThrows flag supported at39. It covers normal empty-list behavior rather than its advertised outage. Preserve that useful ordinary case; separately name/select explicit read-exception/error fixture when authorized. Risk Low; accurate test evidence and distinct behavior coverage must stay. Passive test-source only, no auth/security execution or enforcement conclusion.
- Evidence: `src/lib/__tests__/ocade-is-a-website.test.ts:5-25` states both the newer PWA/home-screen decision and the older instruction to exclude a manifest, while active assertions require manifest and apple-touch-icon. Nearby static contract tests often repeat long incident narratives already captured in audit history.
- Proposal: retain concise current decision and regression intent, preserve unique old rationale through a dated reference, and remove contradictory present-tense commentary only under later authorization.
- Benefit: less misleading review/maintenance guidance without weakening tests.
- Risk: Low runtime, Medium authority/provenance risk.
- Must stay: current manifest/service-worker assertions, history of the owner's platform decision, and unique incident evidence.
- Safe order/verification: compare latest authority with emitted manifest and browser install/offline behavior; check historical links before comment deletion. No test or comment changed.


### D-034 — Regenerate database types from current schema instead of hand-maintaining retired shapes
- Evidence: `src/integrations/supabase/types.ts:586-603` advertises ocade_console_sessions, dropped by `supabase/migrations/20261003090000_owner_and_staff_consoles_on_ocade_in.sql:82` and asserted absent in owner-staff-on-site.test.ts. The unlimited-grants table omission is F-010; unlimited RPCs ARE present at types.ts2025-2033.
- Proposal: regenerate from the disposable fully migrated schema or approved current schema, verify parity, and let generation remove obsolete shapes. Do not manually prune historical migrations or legitimate retained tables.
- Benefit: fewer stale table contracts and misleading compiler assurances.
- Risk: Low runtime, Medium compiler/caller/schema-version risk.
- Must stay: migration/rollback provenance, actual retained schema and authorization contracts.
- Safe order/verification: generation source identity, current catalog/table/RPC parity, typecheck and callers before replacing a generated file under separate authorization. No regeneration or source changes executed.


### D-035 — Use canonical commercial vocabularies and explicit existing test cleanup
- Shared mock ownership extension2026-10-05: src/lib/security/__tests__/mfa.test.ts:345-356 restores listFactors spy only after successful await/assertions, while existing finally restores environment but omits the spy. Put spy restoration in that existing failure-safe cleanup; preserve shared-client wiring assertion. Risk Low; later-test impact unmeasured. Passive test-source ownership only, no MFA/auth/security/provider execution or behavioral claim.

- Notification fixture ownership extension2026-10-05: src/lib/notifications/__tests__/preference-sync.test.ts:88-101 installs a localStorage global stub but only removes it after successful awaited operations/assertion; no afterEach cleanup import exists. Use existing finally/afterEach Vitest disposal to retain the original no-browser-write assertion even on failure. Risk Low; worker/cross-file impact unmeasured, source only, no test/security execution or product edit.

- Retry-delay ownership extension2026-10-05: src/lib/intelligence/edge-handler.ts:346-357 installs an anonymous once abort listener for each delay; normal timer resolution leaves the listener until signal abort or collection. Use a named callback with removal on settlement, keeping timer cancellation and abort rejection. Risk Low; retry count is bounded and current retention/resource impact unmeasured, so this is an ownership simplification opportunity rather than a demonstrated production leak regression. Verify ordinary completion/abort cleanup with doubles only; no provider or security execution.
- Additional fixture ownership2026-10-05: use-generation-permit.test.ts:59,193,237 directly replaces navigator.onLine while afterEach:62-64 only restores timers; console.warn spy:351 is restored at367 only after successful assertions. Restore the original property descriptor and own spy cleanup even on failure using existing Vitest teardown. Keep permit behavior assertions; risk Low, worker/cross-file impact unmeasured. Source-only opportunity, no auth/permission execution or product edit.
- Navigator fixture extension2026-10-05: src/lib/commercial/__tests__/offline-counter.test.ts:78-100 directly replaces the global navigator descriptor but only restores Vitest mocks. Save/restore the original descriptor or reuse vi.stubGlobal/vi.unstubAllGlobals already used by device-identity.test.ts:37-60. Keep the atomic-counter assertions; verify both absent and present original descriptors and cleanup after failure. Risk Low. Cross-file consequences depend on worker isolation and remain unmeasured; passive source evidence only, no counter/signing/security execution or product edit.
- Fake IndexedDB test ownership extension2026-10-05: offline-turns-reach-the-account.test.ts:124-134 opens a connection on each poll without closing it, including the no-store branch;149-153 repeats an unclosed direct read. afterEach erases records but does not own those handles. Keep persistence/account assertions; close exact owned test connections after transactions and early returns, verify restart/cleanup/version-change semantics. Risk Low; fake-backend resource impact unmeasured, no test/SQL execution or deletion proposed.
- Stream ownership extension2026-10-05: streaming-digest.ts:288-298 returns on abort/read/progress failure without cancel/releaseLock; model-transfer.ts:851-923 has similar early storage/abort returns from its acquired reader. Preserve incremental hashing and sequential fallback; use narrow owned reader cleanup on interruption/error, preserving completion semantics. Risk Low-Medium; verify abort, read failure, storage refusal and successful finish. Resource duration/bytes unmeasured; source only, no runtime edit or fault execution.
- Clipboard fixture extension2026-10-05 (F-187): test_safety.py:348-355 should double pyperclip alongside its existing FakeGui rather than owning real host clipboard state. Keep the restoration assertion, verify absent/headless native backend independence. Low risk; no new abstraction or native clipboard operation executed.
- Conditional OPFS ownership extension2026-10-05 (F-186): model-store.ts:299-306 should release its sync handle on failed truncate/write/flush using the narrow ownership pattern already present at171-180. No resource manager abstraction needed. Risk Low-Medium; preserve failed-write signal and verify ordinary mocked exceptions plus legitimate worker fallback evidence before cleanup. No runtime edit/API probing executed.
- Computer test extension2026-10-05: test_computer.py:22-24,145,155-156 changes shared home/data/dry-system environment without restoring prior values. Apply the existing scoped patch.dict pattern to preserve absent and present keys and test order independence. Keep disposable filesystem isolation and native side-effect admission checks; no native/system action executed.
- Agent test extension2026-10-05: test_agent.py:299 assigns shared webbrowser.open to a list append without restoring it, unlike surrounding scoped unittest.mock.patch calls; use that existing scoped pattern and restore XDG_CONFIG_HOME from setup:42 as well. Keep the behavior tests; verify suite order independence using isolated doubles before any native execution. Risk Low; no test/source edit performed.
- Runtime fixture extension2026-10-05 (F-179): conftest.py:12 and manual_existing_chrome.py:16-40 allocate unowned temporary directories; manual server cleanup also lacks finally. Prefer standard-library scoped ownership and existing pytest teardown over a new resource framework. Risk Low-Medium: keep isolation from installed agent and preserve deliberately retained failed-run evidence; verify success/early-failure disposal before cleanup.
- Second-pass extension2026-10-05: src/lib/brain/__tests__/delivery-signature.test.ts:8,12-14 restores an optional process.env value through unconditional assignment. Preserve the absent-key shape with delete when previously absent, otherwise restore its string. Low risk; verify both prior states with isolated mocks before separately authorized cleanup. Keep all delivery integrity assertions. Source only; no signing/security test executed.
- Evidence: duplicated surface array omits JARVIS in ledger seam coverage (F-102); gate-against-postgres lacks its DatabaseTwin close (F-103).
- Proposal: iterate the exported current surface authority with independently verified DB expectations; use the same simple afterAll disposal already used by neighboring suites. No new generic test framework needed.
- Benefit: fewer drifting vocabulary lists and bounded test database lifetime.
- Risk: Low-Medium; preserve independent behavioral expectations and setup-failure cleanup.
- Must stay: meaningful database seam tests, role-specific assertions and migration checks; do not delete tests just to shrink the suite.
- Safe order/verification: current surface/tier enumeration, assertions per case, isolated repeated-suite resource measurements before separately authorized consolidation/cleanup.

- D035 test-fidelity extension: rest-adapter.ts68-69/95 suppresses cardinality errors F142. Connect the smallest canonical single/maybeSingle contract and one narrow adapter verification; keep useful DB tests, avoid another generalized simulator. Test-only change risk low after explicit contract proof; deletion risk still follows D035 original requirements. Analysis only.


### D-037 — Connect public help/contact guidance to one verified destination
- F109 exposes a Help/legal link loop and an unconnected ticket claim. Proposal: one verified contact-status destination reused by public legal/help content, rather than another bespoke support subsystem. Keep all formal legal/privacy authority and genuine internal support-case functionality. Risk: medium because published promises and operational ownership must be verified. Order: verify channel ownership/availability, connect one destination, check all public links and accessibility; no cleanup or publication performed.

Reconciliation2026-10-04: D036 duplicate exemption proposal consolidated into existing D007. No cleanup executed.


### D-038 — Low risk — Remove confirmed unused Android imports after toolchain verification
- Found by SECOND SOURCE REVIEW2026-10-05: Identity.java25 imports ECGenParameterSpec while key setup uses KeyGenParameterSpec and no symbol use exists in the full reread. Redundant import only; performance benefit negligible, no package/library deletion inferred.
- Proposed cleanup: remove individually confirmed unused imports in a later authorized cleanup; keep all keystore/identity/protocol/runtime code and signing dependencies.
- Verification before deletion: source symbol search plus normal Java compile in an isolated build; do not infer whole dependency obsolescence from one unused import. Risk low; safe order after build-tool selection F114 is corrected/verified. No cleanup executed.


### D-039 — Medium risk — Consolidate JSX tag ownership across static control checkers
- Found by SECOND SOURCE REVIEW2026-10-05: check-accessibility.mjs67-77/299-304 and check-dead-controls.mjs73-91/186-204/265-282 maintain incompatible brace scans/proximity windows/raw regex. F015 and F124 show missed controls from ownership confusion.
- Proposed rerouting: share only tag/attribute ownership using the already-installed TypeScript parser or a verified existing helper; retain separate policy rules, exemptions, reasons and report contracts. Avoid adding a new parser dependency/framework.
- Must stay: accessibility/dead-control policy coverage and exact source location reporting. Safe deletion candidates: duplicate low-level scanners only after parity, not whole gates.
- Verification required: arrows/comparisons/quoted strings/spreads, adjacent controls, nested wrappers, false positives and prior detections with snapshots. Risk Medium, safe cleanup order after ordinary counterexamples are recorded and compatibility checks pass. No cleanup executed.


### D-040 — Medium risk — Drop unsupported incognito flexibility from any future donor adaptation
- SECOND SOURCE REVIEW: donor browser schema advertises unused incognito field F144. Proposed removal applies only to a later adapted schema until real isolation works; preserve immutable donor original and normal required browser capabilities.
- Verification before deletion: consumers/recorded commands/schema contracts, private-profile persistence proof and existing adapted-browser parity. Safe order: stop misleading advertisement, then verify smallest supported implementation before restoring an option. No extra private-browser abstraction or cleanup executed.


### D-041 — Low risk — Reconcile supported computer argument declarations with the existing canonical contracts
- SECOND SOURCE REVIEW: F155 shows drift between src/jarvis/protocol.ts canonical action schemas and manually repeated provider properties. Prefer one existing contract owner or a narrow consistency check rather than another action registry/framework.
- Keep: supported actions, explicit overwrite intent, provider-specific descriptions and platform safety/consent boundaries. No canonical schema or immutable donor deletion authorized.
- Safe order: reconcile omissions first, verify provider compatibility and ordinary supported-action examples, then remove only redundant declarations whose generated replacement is demonstrated equivalent.
- Verification before deletion: schema/argument parity, provider accepted declaration format, import/export path meanings, recipe required arguments and Office copy/overwrite behavior. Risk low for description/property alignment, medium for later schema generation; no changes or cleanup executed.


### D-042 — Medium risk — Use one complete release manifest owner and explicit supported platform delivery
- SECOND SOURCE REVIEW: F156/F157 and macOS packaging show per-platform artifacts and whole-feed publication mixed. Prefer collecting required verified artifacts under the existing release owner and one coherent publication boundary.
- Keep: signatures, hashes, health checks, rollback/permanent launcher, immutable archives and honest unavailable-platform UI. macOS build.sh emits an app zip outside versions layout; install_root requires versions, and the public allowlist/UI only offers current Windows installer. This is unbuilt source coverage, not physical Mac proof.
- Safe order: define actually supported delivery artifacts/layouts, establish full-manifest parity, verify ordinary publication consistency, then remove only redundant packaging paths with proven replacement.
- Verification before removal: Windows installer/update/uninstall/rollback; legitimate macOS signed/notarized/TCC/update evidence; every supported architecture entry and public download path. High risk to delete platform packaging before physical proof. Analysis only, no build, deployment or cleanup executed.


### D-043 — Medium risk — Consolidate only an adapted desktop organizer and its recoverable journal
- SECOND SOURCE REVIEW: donor actions/desktop.py:309-349 and file_controller.py:541-618 implement overlapping organizers with different extension maps, shortcut exclusions and undo behavior; F161 records partial-failure recovery gap.
- Keep both immutable originals/provenance. No file is safe to delete from the preserved source merely because it overlaps. Future adapted runtime can expose one canonical organizer with explicit by-type/by-date policy, shortcut preservation and the existing recovery owner.
- Safe order: compare both intended behaviors, retain required policy differences as data, connect journal registration to completed moves, then remove only redundant adapted implementation after parity proof.
- Verification before deletion: mixed extensions, shortcuts, same-name collisions, partial failure, changed originals and undo. Medium consolidation risk; higher recovery risk if inverse paths are removed before proof. No cleanup or filesystem operation executed.


### D-044 — Medium risk — Share the narrow Word/Excel job communication lifecycle
- SECOND SOURCE REVIEW: ocade_documents.py:164-182 and ocade_sheets.py:229-248 repeat temporary JSON, piped process startup,180-second polling/cancellation and result decoding; F165 shows the same pipe completion defect.
- Prefer one small existing-runtime helper using supported subprocess I/O and owned-child cleanup. Keep separate Office job/result semantics, macro policy, fidelity, backup and platform capability rules.
- Safe order: establish bounded pipe/cancellation completion, verify both engines, then remove only duplicate wrapper lifecycle. Verify stdout/stderr pressure, late results, timeout/STOP, reaping, temp cleanup and actual saved/partial state. No native command/refactor/deletion executed.


### D-045 — Medium risk — Reuse canonical effective-grant selection for Owner display
- SECOND SOURCE REVIEW: F168 contrasts listAccountAccess ad hoc map with canonical entitlement resolver. Connect display to the same starts/time/tier/expiry rules while preserving selected grant identity and explicit revoke semantics.
- Keep audit history, all grants, staff authorization and canonical billing/entitlement authority. Nothing in migration history is safely deletable here.
- Safe order: verify multiple-current/future/expiry fixtures, align display/record selection, then remove only redundant selection logic. Verify revocation leaves other grants visible and account access agrees; no SQL, permission or product change executed.


### D-046 — Low risk — Reuse existing quote-aware formula handling in spreadsheet diagnostics
- SECOND SOURCE REVIEW and pure diagnostic: F174 shows literal text treated as a cell reference. ocade_sheets.py:48-50 already excludes quoted spans for formula checks; reconcile the smallest shared literal handling before reference detection.
- Keep real formula/error/self-reference checks and format fidelity. Avoid adding a new full parser dependency for this narrow case.
- Safe order/verification: quoted cell names, escaped quotes, ordinary other-cell references, true self-reference, qualified/range/named references and unchanged genuine diagnostics; then remove only redundant literal handling if equivalent. No workbook edits/refactor performed.


### D-047 — Medium risk — Share only proven loader mechanics in a future donor adaptation
- Evidence2026-10-05: preserved core/action_loader.py:37-68,111-154,157-221 and core/plugin_loader.py:22-48,142-192,221-285 duplicate identifier/schema defaults, enum normalization, handler signature inspection, validation/import/discovery and collision mechanics. Exact source cross-check; analysis only.
- Proposal: after separately authorized adaptation, reuse a narrow standard-library validator/import helper with separate action/plugin policy wrappers. No new generic framework.
- Must stay: immutable donor/provenance, plugin enablement/settings/notifications, action context and behavior differences. No original deletion is currently safe.
- Benefit: reduce divergent duplicate mechanics without merging different policies.
- Safe order/verification: establish adapted callers; check import-failure isolation, collisions, signature compatibility, enablement and settings behavior; consolidate only proven parity; recheck before any removal. Risk Medium. No cleanup executed.


### D-048 — Medium risk — Reuse donor configuration update mechanics only in a future adaptation
- Evidence2026-10-05: preserved memory/config_manager.py:20-35,64-75,92-104,112-121,206-218,255-265,272-281,349-384 repeat JSON load/fallback/update/write while existing _patch_config:291-305 already owns some identical mechanics. Exact source cross-check; analysis only.
- Proposal: reuse one validated existing update helper for a separately authorized adapted runtime, retaining per-setting normalization and distinct nested merge behavior. Avoid a new configuration framework.
- Must stay: immutable donor original, voice/tuning/schema APIs, nested plugin merges, legitimate frozen-install path expectations and unrelated saved keys. No complete source file is proven safe to delete.
- Benefit: fewer divergent parsing/write paths; performance savings require measurement, not inferred duplicate line count.
- Safe order/verification: inventory setters/callers, establish all current merge semantics, verify absent/corrupt/non-object JSON and retained keys, interrupted and simultaneous owned writes, then remove only redundant adapted bodies. Risk Medium because existing corruption fallback, atomicity and concurrent writer behavior must be deliberately preserved or corrected under separate authorization. No cleanup or new runtime defect claimed.


### D-049 — Medium risk — Own donor overlays through existing reuse or disposal before replacement
- Evidence2026-10-05: preserved ui.py:4934,5023,5036,5070,5084 repeatedly constructs central-widget-parented customization/audio/memory/plugin overlays while references are replaced or old widgets hidden; confirmation5052-5054 already uses deleteLater. F229 shows associated preview ownership drift. Actual sustained retained widget/resource growth UNMEASURED; source-only opportunity, no Qt execution.
- Proposal: one owned overlay per necessary adapted surface or explicit native disposal on closure/replacement; reuse existing confirmation cleanup mechanics where appropriate rather than a new UI resource framework.
- Must stay: immutable donor source, required settings/memory/audio/plugin behavior, pending callback safety and truthful preview cancellation. No original file is safe to delete from this evidence.
- Benefit: fewer hidden retained widgets/callbacks and simpler resize/retheme ownership; savings require measurement.
- Safe order/verification: trace all close/reopen routes and pending workers, verify Qt destruction and stale callback handling, preview Apply/Cancel, resize/retheme and repeated openings before removing redundant adapted constructors. Risk Medium; no cleanup executed.


### D-050 — Avoid copying duplicate unused visual-reference assets into a future adaptation
- Evidence2026-10-05: full ZIP inventory/CRC/SHA256 comparison of imports/UI OCADE JARVIS.zip finds four byte-identical PNG pairs: src/assets/orb-ref1.png and src/imports/image.png; orb-ref2.png and image-1.png; orb-ref3.png and image-2.png; orb-ref4.png and Gemini_Generated_Image_797r14797r14797r.png. Each pair has matching original bytes; duplicate raw payload totals3189621 bytes. Full archived TS/TSX/CSS reference search finds no asset/import/orb-ref references. This is preserved prototype evidence, not current served bundle size or a broken UI claim.
- Source cross-check: archived .figma/make/import-assets.mjs:18-42,70-79 defines a recursive copy hook that would include these PNGs if connected. Full vite.config.ts:1-48 does not import/register frontendAssets, so no current copy-stage execution or served-byte effect is established. Preserve the original; avoid reconnecting unnecessary copy behavior in an adaptation. Actual archived build output is UNTESTED.
- Proposal: any future adapted UI should include only required visual references once, or retain a provenance link rather than shipping unused originals.
- Must stay: immutable archive, reference originals, attribution and licensing/provenance evidence. No current repository deletion is established safe or performed.
- Safe order/verification: inventory actual adaptation consumers and generated asset handling, verify branding/license authority and visual parity, then measure production bundle and responsive rendering before separately authorized removal from an adapted copy.
- Risk: Low for avoiding unused copies in a new adaptation; High for deleting immutable original/provenance. No cleanup executed.


### D-051 — Adapt only the necessary accessible visual behavior from the archived UI
- Evidence2026-10-05: full archived App/OrbCanvas/CSS/member review finds mouse-only graph events245-250; per-frame typed-array allocation280 and Map/filter/sort398,481-483; no visibility/preference scheduling gate; fixed color panel and unused reduced-motion scaffold flag are F235/F236. Existing current Orb optimization opportunity D019 is separate current implementation evidence. No measured archive/mobile performance cost claimed.
- Proposal: a future adaptation should reuse current owned pointer/preference/lifecycle conventions, bound responsive panels, reduce repeated allocations only after measuring, and avoid recreating a second independent canvas/theme/input system.
- Must stay: immutable ZIP, attribution, selected visual fidelity, essential voice feedback, zoom/hover cleanup and original decision evidence. No source deletion or new dependency proposed here.
- Safe order/verification: prove required visuals and actual consumers, keyboard/touch/reduced-motion and320px/zoom behavior, then profile frame/hidden-tab/voice costs and reuse the smallest current implementation before proposing removal from an adapted copy.
- Risk: Medium; interaction, DPI, visual fidelity and platform behavior can change. Entire archived prototype integration remains unproven. Analysis only; no cleanup executed.


### D-052 — Use an indexed current audit status instead of multiplying historical checkpoint copies
- Evidence2026-10-05: exact-line comparison against the already fully second-read2590-line implementation handoff finds1155 matching lines in4132-line OCADE-JARVIS-ERROR-AUDIT-01.md and2074 in3830-line current-main-master-ledger. Matching blocks are exact text spans of at least five lines, not inferred equivalent findings. Canonical error-audit explicitly preserves the prior master record verbatim at103-105. F096 records how repeated historical finding IDs drifted. Unique evidence and old counters must remain historical, not be promoted to current proof.
- Proposal: future audit updates can maintain one concise current status/index referencing immutable dated evidence, with one ID authority, instead of copying every old checkpoint into another active summary.
- Must stay: all existing original audit documents, reproductions, SHA/platform distinctions, unique owner decisions and dated reports; no existing deletion is proved safe in this task.
- Safe order/verification: finish unique-content comparison, map every external/internal link and ID, preserve original bytes/unique evidence, then prove the future index resolves all references and separates current from historical readiness before any separately authorized consolidation.
- Risk: Medium-High for consolidation/deletion because historical provenance can be lost; Low for adding a future accurate index. Analysis only, no historical document rewrite.

- D052 completed cross-check: after the canonical error-audit full review,3827 of3830 master lines match its already reviewed text after removing trailing whitespace only; every matched line checked and differences are1110 cases of zero-vs-two trailing spaces. Three unique execution-note lines fully reviewed. Semantic reuse preserves line mappings and original hashes; it is not byte-identical-file or new current-runtime proof. F237 phase-label inconsistency also repeats in master line8.


## Safe cleanup order (proposal only)
1. Prove each candidate is unused or fully replaced; trace callers, packaging, tests, build and recovery.
2. Prove replacement behavior including permissions, STOP, failure and real platform evidence.
3. Prefer small isolated removal candidates; preserve authority/provenance/history.
4. Run affected checks and full relevant user journeys after any separately authorized cleanup.


## Resume checkpoint
Authority and first source pass974/974 complete. Second pass562/974 complete (57.7%);412/974 remain (42.3%), all BLOCKED by rejected Supabase second-review dispatch; zero ordinary PENDING paths. All available independent ordinary source reads/practical checks and both-ledger accuracy reconciliation are complete. Required platform/customer/provider/deployment evidence remains BLOCKED/UNTESTED.51 unique opportunities are proposals only. No cleanup, product edit, deployment or ledger commit/push has been executed; final commit/push remains conditional on completion of the entire requested audit.

Final checkpoint2026-10-05: all51 opportunity IDs and preservation/risk/verification proposals reconciled; original product and imported archives remain unchanged. Owned test harness stopped; only permitted ledgers differ. Audit remains incomplete because412 second reads and required practical evidence are BLOCKED/UNTESTED; no commit/push or cleanup.
