# OCADE JARVIS — Implementation Handoff Audit

**Audit date:** 2026-09-27  
**Audited source:** `main` at `4c6893e1d7167bb93e511fec9db5e70e464a287a`  
**Decision:** NO-GO for commercial PC control, companion, extension publication, background recovery, voice/wake, and macOS claims.  
**Findings:** 52 — Critical 3, Major 28, Medium 15, Small 4, Minor 2.  

This handoff is read-only guidance. It does not claim that any recommendation has been implemented. The eight product-code changes already present in the checkout predate the strict read-only phase and require independent review.

## Dependency-safe execution plan

### 0. Establish a clean implementation baseline

Preserve the immutable donor ZIP/source and audit artifacts. Review or transplant the pre-existing working-tree changes into a dedicated implementation branch. Add failing regression proofs before repairs. Never rewrite applied migrations; use forward migrations.

### 1. Release and security blockers

1. Disable Windows Terminal until JARVIS-037 is fixed with a proven restricted execution broker.
2. Fix JARVIS-051 with handle-relative, exclusive, reparse-safe filesystem operations.
3. Fix JARVIS-023 with cancellation tokens propagated through device, subprocess tree, Playwright/extension, native UI and server settlement.
4. Fix JARVIS-038 fresh-observation binding and JARVIS-021 local-data redaction.
5. Run the complete escape, race, cancellation, privacy and recovery matrix before any installer is published.

### 2. Server task authority and concurrency

Implement a forward migration and service-authorized RPC state machine for JARVIS-018, 020, 022, 027 and 043. Use expected state/version, selected device, controller lease, idempotency key, checkpoint sequence and terminal settlement. Then reconnect the web controller. Test concurrent tabs/devices, late results, Take Over, Stop, retry, crash/reload and Remote PC.

### 3. Authentication and conversation isolation

Repair JARVIS-004, 006, 009, 011, 013 and 014 in shared auth/conversation lifecycle helpers. Scope each turn, draft and stream by owner plus conversation plus request. Clear account state synchronously at sign-out and validate route identity before render/send.

### 4. Device/app/permission identity

Create one per-device OS-native application catalog and stable launch ID. Use it for inventory, Allowed Apps and launch. Repair JARVIS-016, 017, 024, 025, 026, 031 and 043. Preserve the device identity/RLS authority.

### 5. Protocol, journal and abuse controls

Repair JARVIS-039, 047, 049 and 050. Add response-version validation, typed error states, action/confirmation digest, atomic durable result journal, enrollment rate/quota controls and explicit method responses. Roll out server compatibility first, then clients, then raise minimum version.

### 6. Browser extension

Review/commit the JARVIS-015/033 build changes; repair JARVIS-035/036. Produce one deterministic minimum-permission package. Test real Chrome profile install/link, unrelated tabs, signed-in sessions, forms/uploads/downloads, restart, disable/re-enable, revoke, detach, multi-window and Store upload validation.

### 7. Companion, packaging, update and voice

Repair JARVIS-028, 029, 030, 032, 034, 040, 041, 042, 046 and 052. Remove dormant duplicate runtime code only after provenance/import proof. Build clean locked Windows/macOS artifacts, complete TCC, transactional update/rollback, diagnostic tray health, process-aware uninstall and one signed Hey OCADE model.

### 8. Product correctness, performance and documentation

Repair JARVIS-003, 005, 007, 008, 010, 012, 019 and 048; then 001, 002 and 044. Stream safely, split live state queries, provide selected OS/shell context, preserve honest unavailable/retry states and add factual operating-system evals.

### 9. Release verification

Run source preservation; typecheck/build/lint/format; secret/dependency/SBOM; Supabase migrations/RLS/RPC; Cloudflare deployed identity/routes/headers; protocol/unit/integration; real Chrome extension; real Windows; real macOS; Android web/PWA; iOS/WebKit/PWA; and Remote PC. Publish only when every Critical/Major blocker is proved fixed or the capability is disabled.

## Ponytail/YAGNI/KISS cleanup

Keep one authority chain: `web/PWA -> server task authority -> signed protocol -> Device Agent -> Browser|Computer`. Preserve donor source only in immutable imports. Remove duplicate donor action/core/dashboard/memory/plugin copies and their exclusive dependencies after replacement proof. Keep extension optional for signed-in real Chrome. Do not add native mobile apps, local provider clients, plugin marketplace, local phone dashboard or another memory store without a proven requirement. Expected removal: roughly 12k–16k dormant lines plus substantial transitive packages.

## Finding index

| ID | Severity | Finding |
|---|---|---|
| JARVIS-001 | Small | Current authority documents retain superseded navigation and microphone requirements |
| JARVIS-002 | Small | Device runtime README says live computer-control wiring is unreachable |
| JARVIS-003 | Small | Nonexistent conversation deep links silently masquerade as an empty conversation |
| JARVIS-004 | Major | Sign-out leaves account-owned JARVIS and Settings state visible until asynchronous cleanup or reload |
| JARVIS-005 | Medium | Direct JARVIS startup initializes the Chat Offline runtime that JARVIS cannot use |
| JARVIS-006 | Major | Stale browser auth produces persisted JARVIS questions with no answers |
| JARVIS-007 | Medium | JARVIS buffers Online output and does not stream tokens to the conversation |
| JARVIS-008 | Medium | Conversation refresh renders an actionable false-empty state before history loads |
| JARVIS-009 | Major | A late answer can render inside a different conversation after New conversation or navigation |
| JARVIS-010 | Minor | JARVIS gave misleading Windows Storage Sense advice in a constrained safety prompt |
| JARVIS-011 | Major | Stop aborts Online generation as an unhandled stream error and leaves an unrecoverable question-only turn |
| JARVIS-012 | Medium | Explicit work requests disappear into conversation-only refusals when no eligible device is online |
| JARVIS-013 | Major | Composer drafts cross conversation boundaries and can send an old command into another conversation |
| JARVIS-014 | Major | Browser Back changes the conversation URL while the previous transcript remains on screen |
| JARVIS-015 | Major | Official Chrome extension build/package command fails on Windows before producing any artifact |
| JARVIS-016 | Major | Windows app discovery excludes installed Store/UWP apps, so real launches falsely fail as “not installed” |
| JARVIS-017 | Major | The model can invent an app alias that cannot match the device inventory or Allowed Apps policy |
| JARVIS-018 | Major | A text-only model step can orphan an active task in `running` with no loop controlling it |
| JARVIS-019 | Major | The planner has no selected-device OS context, so Unix commands run under Windows `cmd` and can make unintended changes |
| JARVIS-020 | Major | Completed task progress and durable checkpoint disagree, leaving recovery at step zero |
| JARVIS-021 | Medium | Device exceptions upload absolute local paths and the Windows username into cloud Activity |
| JARVIS-022 | Medium | Failed tasks have no supported Retry action or idempotent retry authority |
| JARVIS-023 | Critical | Global STOP does not interrupt an action already claimed by the Device Agent |
| JARVIS-024 | Major | Allowed Apps collapses every computer into one account-wide app-name policy |
| JARVIS-025 | Medium | Devices UI omits required readiness and current-device identity states |
| JARVIS-026 | Medium | Remove device revokes immediately with no confirmation or identity detail |
| JARVIS-027 | Medium | Device results for unknown or stale action IDs are silently acknowledged and discarded |
| JARVIS-028 | Major | No production Windows installer or signed update channel is published |
| JARVIS-029 | Medium | The documented source setup omits the tray dependency and has no reproducible packaging dependency set |
| JARVIS-030 | Major | Packaged Windows agent crashes because `actions/ocade_page.js` is absent |
| JARVIS-031 | Major | Damaged local identity silently creates a second cloud device authority |
| JARVIS-032 | Major | Uninstall deleted credentials without stopping the running companion |
| JARVIS-033 | Major | Extension build constructed invalid doubled Windows drive paths |
| JARVIS-034 | Medium | Tray startup failure hides the exception and gives no actionable diagnosis |
| JARVIS-035 | Major | Store/privacy package lacks the required extension-specific disclosure and submission assets |
| JARVIS-036 | Major | Disconnect/revoke leaves debugger sessions attached to owned tabs |
| JARVIS-037 | Critical | Windows terminal commands can read and write outside the selected workspace |
| JARVIS-038 | Major | Typing, hotkeys and scrolling do not bind to a fresh screen observation |
| JARVIS-039 | Major | Pending completed results are written non-atomically and silently lost after corruption |
| JARVIS-040 | Major | Missing/mispackaged update executable crashes outside the health-failure rollback path |
| JARVIS-041 | Major | Partial voice startup failures can leave the microphone stream active |
| JARVIS-042 | Major | One-click wake setup downloads a different phrase/model than the Device Agent requires |
| JARVIS-043 | Major | Remote PC cannot select the target computer and silently routes work to the most recently seen agent |
| JARVIS-044 | Minor | Service-worker documentation still asserts that no install manifest exists |
| JARVIS-045 | Medium | Android-class Offline initialization reaches an unsafe WASM allocation and fails without a durable compatibility refusal |
| JARVIS-046 | Major | macOS bundle omits required privacy descriptions and has no TCC permission readiness flow |
| JARVIS-047 | Medium | Clients do not validate response protocol and cannot recover cleanly from forward-version skew |
| JARVIS-048 | Medium | Every active-task tab repeatedly reloads the entire JARVIS account state and runs maintenance |
| JARVIS-049 | Major | Public device enrollment has no visible application-level abuse limit |
| JARVIS-050 | Small | Unsupported GET requests to device API routes fall through to an HTML 200 response |
| JARVIS-051 | Critical | Predictable workspace temporary filename permits a symlink write outside the authorized workspace |
| JARVIS-052 | Medium | The supported source setup installs the retired donor stack and broad privileged dependencies |

## Complete finding specifications

Each entry below is copied from the canonical audit ledger and contains its exact location, evidence, root cause, impact, repair, reuse/reroute/delete guidance and regression requirements where established.

### JARVIS-001 — Current authority documents retain superseded navigation and microphone requirements

**Severity:** Small  
**Evidence:** SOURCE-PROVEN  
**Release blocker:** No  
**Exact locations:** `PLAN.md:87,148,305,309`; `docs/APP_FLOW.md:9,62,137`; `docs/DESIGN.md:66,103-107`; `docs/MEMORY.md:71,123-125`; `docs/PRD.md:69,166`; `docs/TRD.md:57,147`; `docs/UI UX Brief.md:45,135-151`; `docs/UI_REFERENCE_CHECKLIST.md:27,61-66`  
**Authority/components:** JARVIS product navigation and first-use microphone requirement.

**What is wrong:** Earlier passages still require a duplicate History destination and microphone permission on route entry. Later accepted decisions in the same authority set remove History, require text-only startup, and defer microphone permission until the user presses Voice. Readers cannot apply both states.

**Reproduction:** Read the cited earlier and later lines side by side. The lists and permission triggers are mutually exclusive.

**Expected:** Every current authority should state one current production navigation and one microphone trigger, while historical decisions are explicitly marked superseded.

**Actual:** Several current-looking requirement/checklist passages still instruct implementers and testers to validate the rejected behavior.

**Root cause:** The deeper-device continuation appended corrective sections without reconciling the earlier Phase 0–12 prose and checklists.

**Customer/security/performance impact:** No direct runtime security impact. The conflict can create a privacy regression by prompting for microphone access on entry, and can cause UI work to reintroduce the duplicate History surface.

**Exact recommended repair:**

1. In the cited earlier passages, replace the navigation list with `Conversations, Tasks, Activity, Allowed Apps, Devices`.
2. Replace every route-entry microphone requirement with text-only startup and first explicit Voice-use permission.
3. In `PLAN.md`, retain the old rule only inside an explicitly marked superseded decision note or remove it from active done criteria.
4. Keep `docs/DECISIONS.md:223-225`, `docs/JARVIS_DEVICE_ROADMAP.md:131-139`, and the later current sections as the reused authority text.
5. Do not create another navigation or voice document.

**Reroute/connect:** Link UI and QA checklists to the accepted deeper-device decision rather than maintaining parallel lists.  
**Delete later:** Delete only the stale sentences/list items after their historical status is captured in the decision log.  
**Regression tests:** Static documentation assertion for the exact five-item production nav; source/browser test that route entry makes no microphone request and first Voice use does.  
**Required live verification:** Fresh-profile permission inspection on `/ocade-jarvis`.  
**Estimated implementation size:** XS documentation reconciliation plus existing targeted tests.

### JARVIS-002 — Device runtime README says live computer-control wiring is unreachable

**Severity:** Small  
**Evidence:** SOURCE-PROVEN  
**Release blocker:** No  
**Exact locations:** `jarvis-runtime/README.md:43-50`; contradictory active path at `jarvis-runtime/ocade_device.py:34-40,113-123,168-181`; dispatch/capabilities at `jarvis-runtime/ocade_computer.py:141-180`  
**Authority/components:** Device Agent operator documentation; `Agent._execute`; `Computer.capabilities`; `Computer.run`.

**What is wrong:** The README labels desktop/computer/files/apps/screen capabilities “Preserved, not wired yet” and says they are not reachable from OCADE. Current agent code constructs `Computer`, advertises those capabilities, and dispatches every non-browser command to `Computer.run`, which exposes apps, scoped files, terminal, screen, and computer control.

**Reproduction:** Follow `Agent.__init__` to `Computer(workspace)`, then `Agent._execute` for a non-browser action, then `Computer.run`.

**Expected:** Operator documentation should describe which computer actions are currently wired, their platform/evidence limits, and the workspace/confirmation gates.

**Actual:** The guide tells testers/operators the active path does not exist.

**Root cause:** Runtime capabilities were wired after the README’s original browser-only section was written, but the section was not updated.

**Customer/security/performance impact:** Operator/tester impact only. It can suppress required security testing of file, terminal, app, and system-control surfaces or lead support to provide incorrect capability guidance.

**Exact recommended repair:**

1. Rename the section to a current capability matrix.
2. Mark browser, apps, workspace files/terminal, screen/computer actions according to exact platform support and evidence.
3. Keep genuinely unwired modules, including legacy dashboard/plugin/provider-bound behavior, in a smaller “preserved, inactive” list.
4. Reuse `Computer.capabilities()` as the code authority for generated/validated documentation where practical.
5. Link real-hardware proof limits to `docs/TESTING.md`; do not claim Windows/macOS proof from source.

**Reroute/connect:** Documentation should derive the list from `ocade_device.Agent` → `ocade_computer.Computer`, not from the preserved donor module inventory.  
**Delete later:** Remove the blanket “not reachable” paragraph after the matrix replaces it.  
**Regression tests:** A docs/source consistency test asserting every advertised capability is documented and every “live” item has an `Agent._execute` dispatch path.  
**Required live verification:** Sections 42–51 must still prove actual Windows behavior; this finding does not claim it works.  
**Estimated implementation size:** XS documentation update and one consistency test.

### Section 1 progress checkpoint

**Deep Audit Progress: Section 1/64 — Current JARVIS requirement reconstruction**  
**Completed sections: 1/64**  
**Checks executed: 34**  
**Passed: 31**  
**Failed: 3**  
**Blocked: 0**  
**Not yet tested: Route/entry and every live/runtime JARVIS behavior**  
**Real AI generations used: 0**  
**Current account usage remaining: Not yet measured**  
**New findings this section: 2**  
**Running total findings: 2**  
**Critical: 0 | Major: 0 | Medium: 0 | Small: 2 | Minor: 0**

### JARVIS-003 — Nonexistent conversation deep links silently masquerade as an empty conversation

**Severity:** Small  
**Evidence:** REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** No  
**Exact locations:** `src/routes/ocade-jarvis.tsx:10-20`; `src/jarvis/JarvisWorkspace.tsx:165-187`; `src/lib/ocade-chat-store.ts:157-178`; state conversation authority at `src/jarvis/jarvis.functions.ts:113-129`  
**Components/functions:** Route search validation; `JarvisWorkspace` conversation-loading effect; `loadChatMessages`; `readJarvisState`.

**Reproduction:** While signed in, open `/ocade-jarvis?c=11111111-1111-4111-8111-111111111111`. The UUID is valid but has no owned JARVIS conversation row. The URL remains and the main area presents the standard empty prompt with no missing/not-owned explanation.

**Expected:** A deep-link ID must resolve to an owned `surface='jarvis'` conversation. Missing, deleted, cross-account, or wrong-surface IDs should show one safe unavailable state and replace the URL with `/ocade-jarvis` or return to Conversations.

**Actual:** `loadChatMessages` can only distinguish messages from no messages. Zero rows is accepted as a valid empty conversation, so the UI cannot tell a real empty conversation from a nonexistent/not-owned ID.

**Root cause:** Route validation checks UUID syntax only. The loading effect fetches message rows without first resolving the owning conversation record and surface.

**Customer/security/performance impact:** Users following stale links see a misleading new-conversation screen and can lose confidence about whether content was deleted. RLS prevented data disclosure in this test; the defect is state/recovery UX rather than proven IDOR.

**Exact recommended repair:**

1. Resolve the requested ID against the already-loaded `readJarvisState().conversations` list when available.
2. Because that list is capped at 200, add/reuse a server read that selects the exact `ocade_conversations` row under authenticated RLS with both `id` and `surface='jarvis'`; do not infer existence from message count.
3. For a missing result, clear turns/active task, show `This JARVIS conversation is unavailable`, and replace the search with `{}` after the user acknowledges or immediately return to Conversations.
4. Preserve the distinction between a valid zero-message conversation and a missing conversation.

**Reuse:** Existing authenticated Supabase context and the `surface='jarvis'` constraint used by `readJarvisState`.  
**Reroute/connect:** Make `JarvisWorkspace` load the conversation identity before `loadChatMessages`.  
**Delete later:** No duplicate store; delete any client-only existence inference after the canonical read exists.  
**Regression tests:** Valid empty owned conversation; nonexistent UUID; another account's UUID; Chat-surface UUID; deleted/archived JARVIS UUID; deep-link refresh and back behavior.  
**Required live verification:** Repeat with owned, deleted, and foreign disposable conversation IDs under two accounts.  
**Estimated implementation size:** S.

### JARVIS-004 — Sign-out leaves account-owned JARVIS and Settings state visible until asynchronous cleanup or reload

**Severity:** Major  
**Evidence:** REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** Yes — session privacy  
**Exact locations:** `src/jarvis/JarvisWorkspace.tsx:57,84-117,431,588-592`; `src/components/settings/settings-panel.tsx:226-248`; `src/components/settings/SignInMethods.tsx:32-61,130-143`; `src/components/settings/TwoStep.tsx:33-56`; `src/routes/__root.tsx:309-340`  
**Components/functions:** Account-neutral `JARVIS_STATE_KEY`; `useQuery` disabled-state retention; `AccountSettings`; `SignInMethods`; `TwoStep`; root auth-state listener.

**Reproduction:** In a signed-in JARVIS tab, open Settings and sign out. The JARVIS screen switches to signed-out messaging, but the prior account's `28 of 28 JARVIS uses left` remains. For a short period the open Settings dialog still showed the prior email, linked Google identity with Unlink, and two-step state. Closing/reopening allowed failed auth reads to replace some identity state; hard reload removed the retained usage.

**Expected:** The same render that establishes `user=null` must stop rendering every account-owned query/local state. No signed-out or next-account view may inherit the previous account's usage, conversations, graph, tasks, devices, memories, permissions, identities, or MFA state.

**Actual:** `enabled: signedIn` stops future JARVIS fetches but TanStack Query retains `state.data` under the account-neutral key. `buildGraph(state.data)` and the usage display continue reading it. Settings child components own local identity/factor state and their effects do not key/reset on account identity. The root auth listener invalidates the router but does not clear account-owned query caches.

**Root cause:** Authentication state controls fetching but is not part of cache/local-state ownership. Sign-out has no synchronous account-state disposal boundary.

**Customer/security/performance impact:** On a shared device, a signed-out or newly signed-in person can see stale account metadata and potentially JARVIS graph/task/device summaries until state refresh or reload. The live account had no graph items, so only usage and transient Settings PII were visibly proven; source shows the retained object also contains conversations, tasks, devices, permissions, memories, and activity. No cross-account server access was proven.

**Exact recommended repair:**

1. Change the JARVIS query key to include the current user ID, for example `['jarvis','state',user.id]`, and do not instantiate an account-data query key when no user exists.
2. Derive a render-safe state: `const jarvisState = signedIn ? state.data : undefined`; feed only that value to `buildGraph`, panels, permissions, tasks, and usage.
3. In the root auth listener, when `previous !== nowSignedIn`, synchronously remove all account-owned query entries before rendering the new identity. Maintain an explicit prefix registry rather than clearing public/static caches blindly.
4. Make `SignInMethods` depend on `user?.id`, set identities/problem/note to the signed-out defaults before any await, and skip `listIdentities()` when no user exists.
5. Give `TwoStep` the same user-scoped reset and do not list factors signed out.
6. Disable or hide sign-out/account mutation controls when no authenticated user exists.

**Reuse:** Existing root auth event, `useSession`, and TanStack `QueryClient.removeQueries`.  
**Reroute/connect:** Connect every account-owned cache/local state to the authenticated user ID.  
**Delete later:** Remove account-neutral JARVIS/account query keys and mount-only identity/factor effects.  
**Regression tests:** Sign out with populated JARVIS conversations/tasks/devices/memories; immediate DOM assertion before network completion; reopen Settings; sign into a second account in the same tab; back/forward; offline sign-out; assert zero prior-account strings at every frame.  
**Required live verification:** Two disposable accounts in one tab, populated JARVIS graph/task state, no reload between identities.  
**Estimated implementation size:** M across root cache ownership and Settings local state.

### Section 2 progress checkpoint

**Deep Audit Progress: Section 2/64 — JARVIS route and entry**  
**Completed sections: 2/64**  
**Checks executed: 49**  
**Passed: 43**  
**Failed: 5**  
**Blocked: 1**  
**Not yet tested: Initial UI/microphone state and all JARVIS intelligence/task/device surfaces**  
**Real AI generations used: 0**  
**Current account usage remaining: 28/28**  
**New findings this section: 2**  
**Running total findings: 4**  
**Critical: 0 | Major: 1 | Medium: 0 | Small: 3 | Minor: 0**

### JARVIS-005 — Direct JARVIS startup initializes the Chat Offline runtime that JARVIS cannot use

**Severity:** Medium  
**Evidence:** REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** No  
**Exact locations:** `src/routes/__root.tsx:217-248,267-278`; `src/lib/brain/use-installation.ts:1-27,91-139`; engine load at `src/lib/brain/adapters/browser-wasm.ts:423-488`  
**Components/functions:** `BrowserBootstrap`; `useInstallationBootstrap`; installation authority; Wllama adapter.

**Reproduction:** Open or reload the signed-in production route `/ocade-jarvis` without entering Chat or selecting Offline. Production console output repeatedly showed Wllama model-load warnings, including the 4096-vs-40960 context warning and speculative-decoding initialization. CDP showed no failed startup network request and the model was already cached, so this run did not download model bytes.

**Expected:** A direct Online-only JARVIS visit should load the JARVIS UI and its Online/device authorities. It should not download, verify, instantiate, or allocate Chat Offline Intelligence unless the user also enters an Offline-capable Chat flow or explicitly manages that feature.

**Actual:** The root mounts `useInstallationBootstrap({ enabled: Boolean(user) })` for every signed-in route. Its idle callback imports the Offline installation stack and calls `install({reason:'app_bootstrap'})`; an existing model is loaded into Wllama on JARVIS. For a device without it, the same authority can begin the large installation from a JARVIS-only visit.

**Root cause:** Offline preparation is treated as a global authenticated-visit concern, while the later JARVIS product boundary is Online-only and route-specific.

**Customer/security/performance impact:** Direct JARVIS users can pay CPU, RAM, storage, battery, startup noise, and potentially substantial bandwidth for an engine JARVIS never calls. The observed cached load repeated after page reload. No provider traffic or prompt leakage was observed.

**Exact recommended repair:**

1. Make Offline preparation depend on an Offline-capable Chat route or a durable, explicit Offline installation preference rather than `Boolean(user)` alone.
2. At minimum, exclude direct `/ocade-jarvis` startup from `useInstallationBootstrap` and `refreshOfflineAllowance` until the user visits/requests Offline Chat.
3. Keep the existing one installation authority, model vault, verification, resume, and uninstall logic; do not create a JARVIS-specific installer.
4. If navigating from an already-loaded Chat session to JARVIS, avoid a destructive unload; the fix is to prevent unnecessary acquisition/load on direct JARVIS entry.
5. Add route-aware performance telemetry that contains only product-safe stage/timing, never model identity or prompts.

**Reuse:** Existing `useInstallationBootstrap` and installation preference/state.  
**Reroute/connect:** Mount or enable the bootstrap from the Offline-capable Chat boundary.  
**Delete later:** Remove the unconditional authenticated-root trigger after route/pref coverage proves the replacement.  
**Regression tests:** Fresh signed-in `/ocade-jarvis` with empty model storage performs no offline release/model request and imports no Wllama adapter; Chat Offline still installs/loads; navigation from Chat preserves an existing ready engine; reinstall/repair controls still work.  
**Required live verification:** Fresh browser profile with cleared OCADE model storage and network-byte capture on direct JARVIS vs Offline Chat.  
**Estimated implementation size:** S–M.

### Section 3 progress checkpoint

**Deep Audit Progress: Section 3/64 — JARVIS initial UI state**  
**Completed sections: 3/64**  
**Checks executed: 61**  
**Passed: 54**  
**Failed: 6**  
**Blocked: 1**  
**Not yet tested: Real JARVIS conversation, prompt quality, controls, tasks, devices and all deeper surfaces**  
**Real AI generations used: 0**  
**Current account usage remaining: 28/28**  
**New findings this section: 1**  
**Running total findings: 5**  
**Critical: 0 | Major: 1 | Medium: 1 | Small: 3 | Minor: 0**

### JARVIS-006 — Stale browser auth produces persisted JARVIS questions with no answers

**Severity:** Major  
**Evidence:** LIVE, REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** Yes — core conversational path  
**Exact locations:** `src/lib/intelligence/online-client.ts:18-23,145-199`; `src/jarvis/live-deps.ts:37-90`; `src/jarvis/JarvisWorkspace.tsx:218-304`  
**Components/functions:** `browserAccessToken`; `createOnlineIntelligenceTransport().stream`; `liveDeps.model`; `JarvisWorkspace.send`.

**Reproduction:** In an established signed-in Chrome profile, send C1 or C2. Server functions successfully created the conversation and persisted the user message, but the direct Supabase Edge POST returned HTTP 401. JARVIS removed its working state with no answer; only a transient `Online Intelligence is unavailable right now.` toast identified the failure. In a freshly completed Google OAuth context, C3–C5 succeeded immediately against the same production deployment.

**Expected:** Any UI session accepted as signed in must obtain a valid Edge bearer. A recoverable stale access token should refresh once and retry without duplicating the question, permit, charge, or provider generation. An unrecoverable session must become an explicit reauthentication state with a durable Retry path.

**Actual:** `browserAccessToken` trusts `supabase.auth.getSession()` and returns its access token. The transport makes one request. Every non-429 4xx is reduced to a non-retryable generic refusal. The question is already durable before that call, so the transcript becomes question-only after the toast disappears.

**Root cause:** The app has two authentication consumers: server functions/cookies and the browser token used by the Edge transport. There is no refresh/retry convergence when the latter is rejected, and no durable failed-turn representation.

**Customer/security/performance impact:** A returning signed-in customer can send messages that visibly save but never receive answers. They may repeat the prompt, creating clutter and confusion. Failed permits correctly reconciled in this proof, so no usage loss occurred. Repeated auth failures add avoidable traffic but did not reach the model.

**Exact recommended repair:**

1. Move authenticated Edge fetching behind one shared helper that obtains the current session and sends the request.
2. On the first 401 only, call Supabase `refreshSession()`, require a new nonempty access token, and retry the exact same body with the same permit, generation ID, and idempotency key.
3. Never retry other 4xx statuses as authentication and never loop refreshes.
4. If refresh fails, transition the shared session authority to signed out/reauthentication required so server-function and direct-Edge identity cannot remain split.
5. Associate a durable `No answer was delivered`/Retry state with the persisted user turn. Retry must reuse that question rather than append a duplicate.
6. Preserve permit settlement: zero delivered tokens releases the reservation; a successful idempotent retry charges once.

**Reuse:** Supabase browser client session/refresh APIs; existing permit idempotency and settlement; existing auth-return target.  
**Reroute/connect:** Route JARVIS and normal Online transport through the same authenticated-fetch helper.  
**Delete later:** Remove direct one-shot bearer construction from `online-client.ts` after shared coverage exists.  
**Regression tests:** Expired access + valid refresh; invalid refresh; 401 then success; repeated 401; concurrent sends during refresh; duplicate provider/charge prevention; question retry without duplication; second account after sign-out.  
**Required live verification:** Let a disposable session age/expire, then send through JARVIS in the same tab and across two tabs.  
**Estimated implementation size:** M.

### JARVIS-007 — JARVIS buffers Online output and does not stream tokens to the conversation

**Severity:** Medium  
**Evidence:** REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** No  
**Exact locations:** `src/jarvis/live-deps.ts:37-72`; `src/jarvis/agent.ts:343-356`; `src/jarvis/JarvisWorkspace.tsx:253-277`  
**Components/functions:** `liveDeps.model`; `runJarvisTurn`; `hooks.onText`; `liveAnswer`.

**Reproduction:** Send C4 and sample the conversation every 300 ms. For about 5.5 seconds the UI showed only `JARVIS is working`; the complete five-sentence response then appeared in one update while Stop remained active. Source confirms token events are accumulated in `text` and only the resolved `reply.text` reaches `hooks.onText`.

**Expected:** Ordinary conversational text should appear progressively as Online token events arrive, with Stop preserving an honestly delivered partial answer according to product rules.

**Actual:** The Edge response streams, but the JARVIS adapter buffers it to completion. The web UI's `liveAnswer` state is updated once per complete model step, not once per token/chunk.

**Root cause:** `AgentDeps.model` exposes only a resolved `{text, toolCalls}` result. The hook callback is outside the stream consumer.

**Customer/security/performance impact:** First visible answer latency equals full model-step latency. Users see a generic working label and can reasonably think answers are not appearing. Network/model latency is unchanged, but perceived latency and Stop usefulness degrade.

**Exact recommended repair:**

1. Add an optional cumulative-text callback to the model dependency input, for example `onText(partial)`.
2. In `liveDeps.model`, invoke it after every nonempty token event with the cumulative safe answer.
3. Pass `hooks.onText` from `runJarvisTurn` to that callback; keep final output as the single persistence authority.
4. Define tool-call behavior: do not expose hidden planning/tool JSON; stream only customer-facing text events.
5. On abort, preserve only text already displayed and settle usage once.

**Reuse:** Existing SSE parser, `liveAnswer`, `hooks.onText`, Stop signal, and final message persistence.  
**Delete later:** Remove the completion-only `hooks.onText(answer)` path once chunk streaming and final deduplication are covered.  
**Regression tests:** Multiple token chunks; token + final deduplication; tool-only step; text then tool call; abort after partial; navigation during stream; no cross-conversation partial output.  
**Required live verification:** Long answer with visible incremental chunks and Stop at several points.  
**Estimated implementation size:** S–M.

### JARVIS-008 — Conversation refresh renders an actionable false-empty state before history loads

**Severity:** Medium  
**Evidence:** REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** No  
**Exact locations:** `src/jarvis/JarvisWorkspace.tsx:165-187,218-253,625-793`  
**Components/functions:** Conversation-loading effect; `turns`; `send`; empty-state rendering/composer.

**Reproduction:** Refresh the successful C3–C5 conversation deep link. At 0.9 seconds the Conversation region contained `Ask anything, or ask JARVIS to do something in your browser.` and no usage/transcript. At roughly 3.4 seconds the three saved exchanges and 25/28 usage appeared.

**Expected:** A known conversation deep link should show `Opening this conversation…` and keep Send disabled until the transcript identity/history is resolved. The UI must never imply the conversation is empty while it is merely loading.

**Actual:** The effect clears `turns` synchronously and performs an untracked async load. The normal empty state and enabled composer render during that request. `send()` derives model history from the current empty `turns`, so a fast follow-up can omit existing context or race the load's later `setTurns`.

**Root cause:** JARVIS conversation loading has no loading/error/epoch state, unlike the established Chat transcript hook.

**Customer/security/performance impact:** Users see saved answers disappear temporarily and can send a contextless/racy follow-up. Slow networks increase the window. The test did not send during the window, so actual lost/overwritten turns remain a required regression case.

**Exact recommended repair:**

1. Add `loadingConversation`, `conversationLoadError`, and a request epoch/abort guard keyed by account + conversation ID.
2. Render a status message instead of the empty state while loading and disable Send/voice execution until the load completes.
3. On failure, render Retry without clearing the URL into a fake new conversation.
4. If a send must be accepted during loading, await the canonical transcript promise and derive history from its result; the simpler safer UX is to disable Send briefly.
5. Reuse the established Chat loading/failed/retry presentation and stale-result guard patterns rather than creating a second state machine.

**Regression tests:** Slow message load, load failure/retry, immediate Send, rapid conversation switching, account switch during load, refresh with long history, zero-message valid conversation.  
**Required live verification:** Throttled network and delayed database response in a populated conversation.  
**Estimated implementation size:** S–M.

### Section 4 progress checkpoint

**Deep Audit Progress: Section 4/64 — JARVIS real conversation**  
**Completed sections: 4/64**  
**Checks executed: 79**  
**Passed: 68**  
**Failed: 10**  
**Blocked: 1**  
**Not yet tested: Broader prompt quality, message controls, task intent and all execution/device surfaces**  
**Real AI generations used: 3**  
**Current account usage remaining: 25/28**  
**New findings this section: 3**  
**Running total findings: 8**  
**Critical: 0 | Major: 2 | Medium: 3 | Small: 3 | Minor: 0**

### JARVIS-009 — A late answer can render inside a different conversation after New conversation or navigation

**Severity:** Major  
**Evidence:** REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** Yes — conversation identity and execution ownership  
**Exact locations:** `src/jarvis/JarvisWorkspace.tsx:165-187,218-304,467-475,625-793`  
**Components/functions:** Conversation-loading effect; `send`; `setLiveAnswer`; `setTurns`; New conversation `RailButton` handler.

**Reproduction:** Send Q1. While `JARVIS is working` is active, select **New conversation** and type Q2 without sending it. When Q1 completes, its assistant answer renders in the new blank conversation without its user question. Q2 remains in the composer. Reload the new route; the answer disappears because it was never persisted to that new conversation.

**Expected:** A turn owns one account, conversation, route epoch, and task. Navigating or creating a new conversation must either abort that turn or let it finish only for its original conversation. No text or task state may render on another conversation screen.

**Actual:** Route navigation leaves the old `send` promise alive. Its callbacks mutate shared component state after `conversationId` changes. The effect clears state for the new route, then the old promise repopulates `liveAnswer`/`turns` with content from the previous route.

**Root cause:** The JARVIS workspace lacks the request epoch and conversation ownership guard already required for transcript loading. Abort ownership is tied to a ref, but route/screen changes do not abort or invalidate callbacks.

**Customer/security impact:** Customers can see an answer under the wrong conversation and act on false context. A browser-control result or sensitive content from one task could appear beside another task. Account-switch risk is amplified by JARVIS-004. The observed answer persisted only to its original conversation, but current-screen confidentiality and integrity still failed.

**Exact recommended repair:**

1. Capture `{userId, conversationId, runId}` before the first awaited operation in `send`.
2. Maintain a monotonically increasing workspace run epoch and an `AbortController` per run.
3. On New conversation, conversation switch, unmount, or account change, abort and invalidate the active run before navigation/state clearing.
4. Guard every late callback and state write (`onText`, `onTask`, confirmation, takeover, `setTurns`, `setLiveAnswer`, busy/retry state) with the captured owner tuple.
5. Permit final persistence only under the original conversation ID; after navigation, refresh that conversation in storage/state but never paint it on the current screen.
6. Reuse the established Chat transcript epoch/abandon pattern and one shared run owner. Do not create separate guards for each callback.

**Reuse:** Chat request epoch/abandon ownership pattern; existing `AbortController`; existing conversation ID.  
**Reroute/connect:** Route New conversation, conversation links, task links, and sign-out through one `leaveCurrentRun` function before navigation.  
**Delete later:** Remove unguarded direct state callbacks after all paths use the owner-checked callback wrapper.  
**Regression tests:** New conversation during generation; old/new conversation switch; rapid A-B-A navigation; account switch; sign-out; partial streaming; late tool/task update; confirmation/takeover open during navigation; provider ignores abort; correct original-conversation persistence with zero current-screen leakage.  
**Required live verification:** Repeat the exact Q1 navigation race in two tabs and during a real device task.  
**Estimated implementation size:** M.

### JARVIS-010 — JARVIS gave misleading Windows Storage Sense advice in a constrained safety prompt

**Severity:** Minor  
**Evidence:** REAL BROWSER, AUTHORITATIVE EXTERNAL CHECK  
**Release blocker:** No  
**Exact locations:** Model behavior governed by `src/jarvis/protocol.ts:246-294`; production provider path `src/jarvis/live-deps.ts:37-90`; prompt/evaluation coverage under `src/jarvis/__tests__/`  
**Components/functions:** JARVIS system prompt; Online model response; prompt-quality evaluation coverage.

**Reproduction:** Send Q4. The third suggestion says Storage Sense can automatically clean temporary files and move files not opened for a while to OneDrive.

**Expected:** Advice should distinguish file organization, OneDrive backup/sync, and Storage Sense disk-space management. A correct compact answer may suggest manually moving files into OneDrive, then using Files On-Demand/Storage Sense for already synced content.

**Actual:** The answer conflated Storage Sense's ability to make existing cloud-backed content online-only with uploading or moving arbitrary desktop files to OneDrive.

**Root cause:** The model can answer OS-specific operational questions without retrieval, citation, or a factuality check. Existing deterministic tests emphasize routing/safety more than current Windows behavior.

**Customer/security impact:** Low-severity misinformation can make customers expect files to be backed up or moved when they are not. No file operation was attempted in this test.

**Exact recommended repair:**

1. Add this exact prompt to the JARVIS quality eval set with a semantic assertion that Storage Sense does not upload/move arbitrary files.
2. For OS instructions whose behavior varies by version, require the answer to state the relevant scope or use approved current documentation retrieval when available.
3. Keep the general Online model path. Do not hardcode Storage Sense logic into the runtime.
4. Prefer the corrected wording: move chosen desktop files into a OneDrive-synced folder; use Files On-Demand/Storage Sense only for already synced content.

**Reuse:** Existing system prompt and model evaluation harness.  
**Reroute/connect:** Add current Microsoft support sources to any future approved documentation retrieval allowlist.  
**Delete later:** No runtime deletion. Remove any eval fixture only when superseded by a broader Windows file-safety suite.  
**Regression tests:** Exact Q4; Windows 10/11 wording variants; Files On-Demand disabled; Desktop known-folder backup enabled/disabled; answer-only request must create no task.  
**Estimated implementation size:** S (evaluation/prompt policy only).

### Section 5 progress checkpoint

**Deep Audit Progress: Section 5/64 — JARVIS prompt quality and execution-routing boundary**  
**Completed sections: 5/64**  
**Checks executed: 95**  
**Passed: 81**  
**Failed: 13**  
**Blocked: 1**  
**Not yet tested: Message controls, explicit task intent, real device/browser execution and all remaining surfaces**  
**Real AI generations used: 7**  
**Current account usage remaining: 21/28**  
**New findings this section: 2**  
**Running total findings: 10**  
**Critical: 0 | Major: 3 | Medium: 3 | Small: 3 | Minor: 1**

### JARVIS-011 — Stop aborts Online generation as an unhandled stream error and leaves an unrecoverable question-only turn

**Severity:** Major  
**Evidence:** REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** Yes — explicit Stop is a core JARVIS safety control  
**Exact locations:** `src/jarvis/JarvisWorkspace.tsx:218-323,795-806`; `src/jarvis/agent.ts:36-42,166-174,343-356`; `src/jarvis/live-deps.ts:37-90`; `src/lib/intelligence/online-client.ts:145-199`  
**Components/functions:** `JarvisWorkspace.send`; `stop`; `runJarvisTurn`; `liveDeps.model`; Online stream iterator.

**Reproduction:** Send S1, wait for `JARVIS is working`, then select Stop before the response completes. Observe the error toast and unchanged 21/28 usage. Reload the conversation and observe only S1 with no stopped state or Retry.

**Expected:** Stop must end work promptly, settle the permit once, expose no provider/runtime detail, and leave a durable `Stopped` outcome with a safe Retry/Continue choice where appropriate.

**Actual:** Abort reaches the response body iterator, which throws `BodyStreamBuffer was aborted`. `runJarvisTurn` only converts abort to `Stopped` at explicit checkpoints before/around tool execution. It does not normalize abort errors thrown while awaiting `deps.model`. `JarvisWorkspace.send` therefore takes the generic error branch. Its transient in-memory `Stopped.` row is never used, and even that row would not be persisted.

**Root cause:** Abort semantics are split between planner checkpoints and transport exceptions. There is no single abort-normalization boundary around model/tool awaits, and stopped outcomes are UI-only instead of durable turn/task state.

**Customer/security impact:** The highest-priority safety control appears to fail with an internal error. Work does stop and no use was charged in this proof, but users cannot distinguish a successful stop from a crash, cannot recover the turn, and may resend duplicate work. Leaking `BodyStreamBuffer` violates the design rule against exposing runtime terminology.

**Exact recommended repair:**

1. Add one abort-normalization helper at the `runJarvisTurn` boundary. After every awaited model/device/tool operation, if `hooks.signal.aborted` or the error is an abort-class error, throw `new Stopped()`.
2. Keep `liveDeps.model` settlement in `finally`; do not classify abort as provider failure or retry it automatically.
3. Persist a structured stopped outcome associated with the user turn. Reuse existing task `stopped` status for tasks; add a minimal durable turn-status record or assistant status message for conversation-only turns.
4. Render plain product language (`Stopped.`) and a Retry action that reuses the exact saved user turn. Never expose transport exception strings in customer toasts.
5. Preserve already displayed safe text after future streaming support, but never charge twice or duplicate it on Retry.
6. Route global Stop, task-card Stop, composer Stop, voice Stop, mini-control Stop, and tray Stop through this same normalization and persistence authority.

**Reuse:** Existing `Stopped` class; `AbortController`; permit settlement; task `stopped` status; saved user message.  
**Reroute/connect:** All stop entry points to one stop coordinator and one abort-to-`Stopped` normalization path.  
**Delete later:** Remove generic rendering of raw `error.message` for expected cancellation; remove any UI-only stopped row after durable outcome rendering exists.  
**Regression tests:** Stop during permit acquisition, headers, token body, between tokens, model completion, device queue, confirmation, takeover, retry wait, and final persistence; repeated Stop; global Stop; no charge with zero delivery; partial-delivery settlement; reload; Retry; no internal error text.  
**Required live verification:** Repeat S1 at several phases plus a real device action, mini-control, voice, and tray once installed.  
**Estimated implementation size:** M.

### Section 6 progress checkpoint

**Deep Audit Progress: Section 6/64 — Stop, navigation, retry, and message-control integrity**  
**Completed sections: 6/64**  
**Checks executed: 108**  
**Passed: 88**  
**Failed: 19**  
**Blocked: 1**  
**Not yet tested: Explicit task creation, real device/extension execution, Take Over/Continue, and remaining JARVIS surfaces**  
**Real AI generations used: 8 (7 completed, 1 deliberately stopped)**  
**Current account usage remaining: 21/28**  
**New findings this section: 1**  
**Running total findings: 11**  
**Critical: 0 | Major: 4 | Medium: 3 | Small: 3 | Minor: 1**

### JARVIS-012 — Explicit work requests disappear into conversation-only refusals when no eligible device is online

**Severity:** Medium  
**Evidence:** REAL BROWSER, REAL PRODUCT STATE, SOURCE-PROVEN  
**Release blocker:** No by itself; device availability is separately blocked until setup succeeds  
**Exact locations:** `src/jarvis/protocol.ts:266-345`; `src/jarvis/agent.ts:215-339`; `src/jarvis/jarvis.functions.ts:250-342`; `src/jarvis/JarvisPanels.tsx:337-420`  
**Components/functions:** `JARVIS_SYSTEM_PROMPT`; `runJarvisTurn`; `start_task`; `startJarvisTask`; Tasks and Activity panels.

**Reproduction:** With no online Device Agent, send T1. Wait for the final answer, then open Tasks and Activity.

**Expected:** Per PRD and app-flow rules, an explicit app-control request becomes a JARVIS task. If execution cannot start, it should end in a durable blocked/permission-required state with its plan, reason, Connect device action, and safe Retry/Continue path.

**Actual:** The task insert occurs only after online-device selection. `no_device` therefore creates no task or activity. The durable record is indistinguishable from an ordinary question except for free-form assistant prose.

**Root cause:** `startJarvisTask` combines intent persistence with executor allocation. Failure to allocate an executor prevents the product from recording the task state.

**Customer/security impact:** Customers lose task continuity precisely when setup/recovery is needed. They cannot connect a device and continue the saved work, see it in Tasks, audit why it did not run, or retry without restating the command. Two valid resource-bearing model steps were charged as documented, but the UI gives no per-step explanation.

**Exact recommended repair:**

1. Insert the user-authorized task and its plan first under the authenticated account/conversation, with status `blocked` or a dedicated `waiting_for_device` state and no device/controller claim.
2. Attempt device allocation in the same server transaction or immediately after insert. If no eligible device exists, set a bounded blocker code such as `no_device` and customer-safe message.
3. Render **Connect device** and **Retry** from structured blocker state. After enrollment, Retry allocates a device and changes the same task to `running`; it must not create a duplicate task or question.
4. Write one Activity entry for task creation and one for the allocation blocker, without model text, secrets, or raw server errors.
5. Keep server-side device/capability selection as the authority. Do not move allocation logic into the model or browser.

**Reuse:** Existing task schema/status UI, `startJarvisTask` selection logic, Devices connect flow, Activity storage, Resume path.  
**Reroute/connect:** Split task creation from executor allocation; connect blocker actions directly to Devices and idempotent allocation.  
**Delete later:** Remove free-form model-only handling for `no_device` once structured task blockers render deterministically.  
**Regression tests:** No devices; offline device; revoked device; wrong capabilities; permission disabled; device connects after block; concurrent connect/retry; task visible after reload; Activity retention; no duplicate charge/task on allocation retry.  
**Required live verification:** Repeat T1 before, during, and after real Device Agent enrollment.  
**Estimated implementation size:** M.

### Section 8 progress checkpoint

**Deep Audit Progress: Section 8/64 — Explicit task intent and unavailable-device behavior**  
**Completed sections: 8/64**  
**Checks executed: 136**  
**Passed: 106**  
**Failed: 28**  
**Blocked: 2**  
**Not yet tested: Device enrollment/install, real execution, extension loading, browser/native controls, and remaining JARVIS surfaces**  
**Real AI generations used: 10 (9 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 19/28**  
**New findings this section: 1**  
**Running total findings: 14**  
**Critical: 0 | Major: 6 | Medium: 4 | Small: 3 | Minor: 1**

## Section 10 final — JARVIS task execution

### JARVIS-013 — Composer drafts cross conversation boundaries and can send an old command into another conversation

**Severity:** Major  
**Evidence:** REAL BROWSER, SOURCE-PROVEN  
**Release blocker:** Yes — execution intent can attach to the wrong conversation/task  
**Exact locations:** `src/jarvis/JarvisWorkspace.tsx:122-187,218-253,529-535,733-756`  
**Components/functions:** `draft`; conversation-loading effect; `send`; `SectionPanel.onOpenConversation`; composer.

**Reproduction:** In T1, leave the command text in the composer, open Conversations, and select Q3. Wait for Q3's transcript. Observe that the T1 command remains in Q3's composer.

**Expected:** Draft ownership must be explicit. The simplest safe behavior is to clear an unsent draft when conversation identity changes. If drafts are retained, they must be keyed and restored only by their original account + conversation ID.

**Actual:** One global `draft` state survives New conversation, conversation selection, and browser history. Send uses the current `conversationId`, so the old text would persist under and execute within the newly selected conversation.

**Root cause:** Conversation identity drives transcript state but does not drive composer state. No account/conversation draft map or leave-conversation reset exists.

**Customer/security impact:** A stale file, browser, terminal, or application command can be sent into the wrong task context. This can cause unintended execution, disclosure in the wrong transcript, and incorrect memory/history association.

**Exact recommended repair:**

1. On every account or conversation change, clear `draft` synchronously before the new transcript becomes interactive.
2. If product requirements later demand draft retention, store drafts under `{userId, conversationId|'new'}` and restore only an exact owner match; never use one workspace-global draft.
3. Disable Send while conversation identity/history is unresolved, as required by JARVIS-008.
4. Route New conversation, conversation links, browser history, task links, and sign-out through the same owner-change cleanup used by JARVIS-009.

**Reuse:** Conversation owner/epoch repair for JARVIS-008/009; existing route `conversationId`.  
**Reroute/connect:** Connect composer state to the same owner boundary as turns, active task, confirmations, and live output.  
**Delete later:** Remove the unscoped workspace-level draft behavior.  
**Regression tests:** Draft then switch A-B; New conversation; browser Back/Forward; account switch; running task; confirmation open; voice transcript; mobile drawer; restored keyed draft if implemented.  
**Required live verification:** Repeat with harmless browser, file, and terminal commands without selecting Send.  
**Estimated implementation size:** S.

### JARVIS-014 — Browser Back changes the conversation URL while the previous transcript remains on screen

**Severity:** Major  
**Evidence:** REAL BROWSER  
**Release blocker:** Yes — displayed transcript identity disagrees with route identity  
**Exact locations:** `src/routes/ocade-jarvis.tsx:10-38`; `src/router.tsx:5-15`; `src/jarvis/JarvisWorkspace.tsx:165-187,529-535`  
**Components/functions:** Route search validation; `JarvisPage`; browser-history subscription; conversation-loading effect.

**Reproduction:** Open T1, use the Conversations panel to select Q3, wait for Q3 to load, then invoke browser Back. The address changes to T1's UUID. For more than 7.5 seconds the page continues showing Q3. Reload; T1 then appears.

**Expected:** Back/Forward must atomically select the URL's conversation or show a noninteractive loading state. The route UUID and visible transcript must never disagree.

**Actual:** The browser address changed, but the mounted workspace retained the previous conversation. The mismatch persisted beyond normal data-load latency and corrected only after reload.

**Root cause:** The exact production cause requires router instrumentation. The proven failure is between browser history/search synchronization and the `conversationId` prop/effect. There is also no runtime invariant that clears or blocks a transcript when `location.search` and loaded owner disagree.

**Customer/security impact:** Users can read or send content while the URL identifies a different conversation. Shared links, support screenshots, task links, and subsequent sends can be attributed incorrectly. Combined with JARVIS-013/009, this creates a high-risk cross-conversation execution path.

**Exact recommended repair:**

1. Add an integration test using real browser Back/Forward across two populated `?c=` routes and assert URL, route search, visible transcript owner, task owner, and composer owner after each popstate.
2. Instrument `JarvisPage` in development/test to expose the parsed route conversation ID; find whether TanStack receives popstate and rerenders.
3. If router subscription fails, correct router/history initialization at `src/router.tsx`; do not add manual `window.onpopstate` inside JARVIS.
4. Regardless of router fix, render transcript only when `loadedConversationId === conversationId`; otherwise show a disabled loading state.
5. Reuse the single owner/epoch mechanism specified for JARVIS-008/009/013.

**Reuse:** TanStack Router browser history; conversation load epoch; shared owner guard.  
**Reroute/connect:** Browser history search changes through the canonical route authority, then into owner-checked transcript state.  
**Delete later:** Remove any temporary instrumentation after the integration regression passes.  
**Regression tests:** Back/Forward A-B-A; rapid repeated history; deep-link reload; open task link then Back; deleted conversation in history; account sign-out/in; mobile PWA standalone history.  
**Required live verification:** Reproduce in dedicated Chrome and PWA after the router fix, not only the in-app browser.  
**Estimated implementation size:** S–M after root cause instrumentation.

### Section 7 progress checkpoint

**Deep Audit Progress: Section 7/64 — JARVIS conversation identity, persistence, switching, and history controls**  
**Completed sections: 7/64**  
**Checks executed: 123**  
**Passed: 98**  
**Failed: 23**  
**Blocked: 2**  
**Not yet tested: Confirmed deletion, task routing/execution, device/extension setup, and remaining JARVIS surfaces**  
**Real AI generations used: 8 (7 completed, 1 deliberately stopped)**  
**Current account usage remaining: 21/28 at the Section 7 boundary**  
**New findings this section: 2**  
**Running total findings: 13**  
**Critical: 0 | Major: 6 | Medium: 3 | Small: 3 | Minor: 1**

### JARVIS-015 — Official Chrome extension build/package command fails on Windows before producing any artifact

**Severity:** Major  
**Evidence:** LOCAL TEST, SOURCE-PROVEN  
**Release blocker:** Yes — no official Chrome Web Store upload artifact on the supported Windows build host  
**Exact locations:** `extension/build.mjs:14-38`; documented command in `extension/STORE.md:1-5`; Windows coverage path in `scripts/e2e/jarvis-journey.mjs:893-990`  
**Components/functions:** ESM path initialization (`here`, `root`); extension copy/package routine; `zip` subprocess.

**Reproduction:** From the clean Windows checkout at SHA `4c6893e1...`, run the documented `node extension/build.mjs --zip`. The first filesystem operation fails with `ENOENT` while attempting `mkdir 'C:\\C:\\Users\\...\\dist\\extension'`. Supplying `--out dist/extension` moves the first failure but source copies still resolve as `C:\\C:\\Users\\...\\extension\\background.js`.

**Expected:** The documented one-command build should produce `dist/extension/` and `dist/ocade-jarvis-extension.zip` with manifest, scripts, protocol, page semantics, config, and icons on Windows.

**Actual:** `new URL(import.meta.url).pathname` returns a Windows file URL pathname such as `/C:/Users/...`. Passing that directly to `path.dirname/path.resolve` creates a malformed `C:\\C:\\...` path. No official unpacked build or ZIP is produced. If this path bug is fixed, the later unconditional `execFileSync('zip', ...)` also depends on a Unix-style `zip` executable that is not installed on this audited Windows host.

**Root cause:** `extension/build.mjs` converts a file URL with pathname string handling instead of Node's cross-platform `fileURLToPath`. Packaging also relies on an undeclared external CLI rather than a repository dependency or documented Windows-native route.

**Customer/security impact:** Developers cannot follow the published Windows build instructions, load the exact generated extension, or create the claimed Chrome Web Store upload ZIP. Manual packaging risks drift in protocol/config/manifest files. The audit produced a clearly labeled workaround artifact only; it is not proof that the official release pipeline works.

**Exact recommended repair:**

1. Import `fileURLToPath` from `node:url` and replace `path.dirname(new URL(import.meta.url).pathname)` with `path.dirname(fileURLToPath(import.meta.url))`.
2. Replace the external `zip` call with one already-installed cross-platform Node archive dependency if one exists. If none exists, add the smallest audited build-time archive implementation or provide separate PowerShell/Unix packaging branches with deterministic root layout.
3. Fail before copying if required source files are missing, and print the resolved source/output paths.
4. Add a post-build verifier: open the ZIP, require exactly one root-level manifest, validate Manifest V3 JSON, compare protocol/page-script hashes to the source files, and reject extra secrets/source maps.
5. Run the same command on Windows and Linux/macOS CI or release hosts; preserve deterministic file names and normalized timestamps where feasible.

**Reuse:** Existing copy/config/manifest transformation logic and source protocol/page script.  
**Reroute/connect:** Route file URL conversion through `fileURLToPath`; route ZIP creation through one declared cross-platform build authority.  
**Delete later:** Remove the direct `zip` executable dependency and any audit-only PowerShell workaround after the official build passes.  
**Regression tests:** Windows path with drive letter; spaces; non-ASCII user path; explicit relative/absolute `--out`; missing source; archive tool absence; ZIP layout/hash/manifest validation; clean Git status.  
**Required live verification:** Run the repaired documented command on supported Windows, load its unpacked output in real Chrome, then upload the exact ZIP to Chrome Web Store validation without publishing.  
**Estimated implementation size:** S.

**Audit workaround only:** A source-equivalent unpacked directory and ZIP were staged under `dist/extension-audit-workaround-20260927/` and `dist/ocade-jarvis-extension-audit-workaround-20260927.zip` without editing product source. ZIP SHA-256: `E7EDCE2D3933AAAFE69F9AEC2A1934CC9A84A462673DDAC2845133615A227C35`.

### JARVIS-016 — Windows app discovery excludes installed Store/UWP apps, so real launches falsely fail as “not installed”

**Severity:** Major  
**Evidence:** REAL WINDOWS PC, REAL CHROME, REAL DEVICE AGENT, DATABASE-PROVEN, SOURCE-PROVEN  
**Release blocker:** Yes — a normal built-in Windows app cannot be discovered or launched through the documented app-control path  
**Exact locations:** `jarvis-runtime/ocade_computer.py:52-79`; `jarvis-runtime/ocade_computer.py:96-106`; `jarvis-runtime/ocade_computer.py:194-199`; permission/queue authority at `src/jarvis/jarvis.functions.ts:450-488`; device dispatch at `src/jarvis/device.server.ts:443-511`  
**Functions/components:** `installed_apps`; `_launch`; `Computer._open_app`; Allowed Apps; JARVIS confirmation dialog; Device Agent exchange loop.  

**Reproduction:**

1. Connect `OCADE Audit Device 2026-09-27` to the production account and enable **Open apps**.
2. Leave the discovered app policy at **Ask** and send: `JARVIS audit E2: Open Windows Calculator on this PC, verify it is visibly open, then stop. Do not change any files or settings.`
3. Confirm the `Opening Calculator` dialog in the real signed-in Chrome profile.
4. Observe Activity, the task result, Windows processes, the installed AppX package, and `shell:AppsFolder`.

**Expected:** Calculator appears in the device's installed-app inventory, confirmation queues one action, the Device Agent opens it, and JARVIS verifies the visible Calculator window before completing.

**Actual:** Permission gating and confirmation behaved correctly: Activity changed `needs_confirmation` to `queued`, the device claimed the command, and the result was returned. The Device Agent then returned `Calculator is not installed on this computer`; task `9c7ebace-4e90-405a-8849-9570a58c85b6` failed at step 0. No new Calculator process/window appeared. Windows independently returned installed AppX package `Microsoft.WindowsCalculator_11.2607.0.0_x64__8wekyb3d8bbwe`, and `shell:AppsFolder` returned `Calculator`.

**Root cause:** On Windows, `installed_apps()` scans only `.lnk` files below the machine and user Start Menu `Programs` directories. Store/UWP registrations exposed through AppsFolder are omitted. `_open_app()` refuses every name absent from that incomplete list, and `_launch()` only knows shortcut paths. The false absence result is therefore deterministic even though Windows can launch the app.

**Customer/security impact:** Common built-in and Microsoft Store apps are missing from Allowed Apps and cannot be controlled. Customers receive a false device diagnosis after spending model usage and approving the action. Teaching the model to bypass the app authority through terminal commands would weaken the allowlist and is not an acceptable workaround.

**Exact recommended repair:**

1. Keep the current Start Menu shortcut discovery for classic applications.
2. Add a Windows-only native discovery adapter for `shell:AppsFolder` or the package/application activation registry and return a stable launch identifier for each eligible app, including Calculator. Do not use fuzzy shell command construction.
3. Extend the internal app record with an explicit launcher kind such as `shortcut` or `app_user_model_id`; launch the latter with the documented Windows activation API or `explorer.exe shell:AppsFolder\\<AUMID>` as a fixed argument vector.
4. Deduplicate case-insensitively by display name and stable launch identity, preserve the existing 80-character validation, and continue sending names only to OCADE.
5. Verify the selected launch identity still exists at execution time. Return a distinct `app_missing_since_discovery` result for stale inventory rather than claiming the app was never installed.
6. Keep Allowed Apps as the single policy authority. Do not add terminal or free-form executable fallbacks for undiscovered apps.

**Reuse:** Existing normalized app records, Allowed Apps policy, server-side confirmation queue, `_launch` platform split, and Activity result path.  
**Reroute/connect:** Route Store/UWP discovery and activation through one Windows native adapter, then feed its records into the same `installed_apps` list and `_open_app` equality check.  
**Delete later:** Delete any proposed model prompt workaround that tells JARVIS to open missing GUI apps through PowerShell, `start`, URI guesses, or keyboard search.  
**Required regression tests:** Classic `.lnk` app; per-user shortcut; machine shortcut; Calculator/Store app; duplicate classic/UWP name; stale uninstalled package; punctuation/non-ASCII display names; malicious launch identity; exact Allowed Apps Ask/Always/Never behavior; confirmed action executes once; physical window appears; no terminal permission required; inventory refresh after install/uninstall.  
**Required live verification:** Repeat E2 on Windows after repair and prove package discovery, confirmation, process/window creation, visible UI verification, task completion, and Activity consistency.  
**Estimated implementation size:** M.

### Section 10 interim checkpoint

**Deep Audit Progress: Section 10/64 — Real Windows execution and app discovery**  
**Completed sections: 9/64**  
**Checks executed: 162**  
**Passed: 124**  
**Failed: 34**  
**Blocked: 4**  
**Not yet tested: Successful launch of a discovered classic app; extension installation/linking; file, terminal, screen, mouse/keyboard and remaining lifecycle paths**  
**Real AI generations used: 14 (13 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 20/28**  
**New findings this section: 1**  
**Running total findings: 16**  
**Critical: 0 | Major: 8 | Medium: 4 | Small: 3 | Minor: 1**

## Cross-section finding discovered during Section 10 setup

### JARVIS-017 — The model can invent an app alias that cannot match the device inventory or Allowed Apps policy

**Severity:** Major  
**Evidence:** REAL WINDOWS PC, REAL CHROME, REAL DEVICE AGENT, DATABASE-PROVEN, SOURCE-PROVEN  
**Release blocker:** Yes — even an app that the Device Agent discovered cannot be opened reliably  
**Exact locations:** `src/jarvis/protocol.ts:79-83`; `src/jarvis/protocol.ts:266-282`; `src/jarvis/protocol.ts:331-348`; `src/jarvis/permissions.ts:88-95`; `src/jarvis/permissions.ts:150-166`; `src/jarvis/jarvis.functions.ts:450-488`; `jarvis-runtime/ocade_computer.py:194-199`  
**Functions/components:** `deviceAction`; `JARVIS_SYSTEM_PROMPT`; `jarvisTools` computer tool; `appDecision`; `needsConfirmation`; `queueJarvisAction`; `Computer._open_app`.  

**Reproduction:** With `Character Map` present in the connected device inventory and Allowed Apps list, send: `JARVIS audit E3: Open Character Map on this PC, verify the Character Map window is visibly open, then stop. Do not change files or settings.` Confirm the real action.

**Expected:** JARVIS uses the exact advertised app identity `Character Map`, the existing Ask policy applies to that identity, and the device opens the corresponding Start Menu shortcut.

**Actual:** The model planned to use a run command but emitted `open_app` with `name: "charmap"`. Production accepted the arbitrary schema-valid name, treated its separate nonexistent `app:charmap` policy as Ask, and queued it after confirmation. The runtime performs exact case-insensitive display-name matching and returned `charmap is not installed on this computer`. Task `8b0b4f63-5979-4954-9c74-5d32bfa1f68e` failed at step 0; no `charmap` process/window existed. The UI then paraphrased this as `Character Map is not installed`, hiding that the requested app was discovered and the generated alias was wrong.

**Root cause:** The computer tool accepts any regex-valid app name and receives no device-specific app enum or prior inventory result. The server checks the allowlist against the model-provided string without verifying that it names an advertised app. The runtime alone performs exact matching, too late to correct or explain the alias mismatch.

**Customer/security impact:** App control fails nondeterministically based on model wording. A policy set to Always/Never for `Character Map` does not apply to an invented alias such as `charmap`, producing unnecessary confirmations and confusing audit records. Future fuzzy matching at the device would risk launching the wrong application unless selection stays server-authoritative and unambiguous.

**Exact recommended repair:**

1. Give the planning loop a bounded device app inventory before `open_app`, either by requiring the existing `apps` action first or by injecting exact names/opaque app IDs for the selected device into task context.
2. Change `open_app` to carry a stable opaque app ID plus display name. Validate the ID belongs to the task's selected device before creating Activity or checking policy.
3. Resolve Allowed Apps by the same stable ID. Keep the display name for the confirmation text only.
4. If legacy name-only calls must be accepted during migration, require one exact case-insensitive match. On no match, return structured `app_not_found` with a short candidate list; on multiple matches, require explicit selection. Never silently fuzzy-launch.
5. Make the model consume the structured mismatch and retry once with an exact advertised identity without creating a second customer confirmation when the requested logical app is unchanged.
6. Render the exact attempted identity in Activity and the final task explanation so alias failures are diagnosable.

**Reuse:** Device `installed_apps`, Allowed Apps UI, action confirmation flow, existing `apps` action, and exact runtime launcher records.  
**Reroute/connect:** Connect the selected device's authoritative app inventory to the computer tool contract and permission lookup before queue insertion.  
**Delete later:** Remove unconstrained free-text app identity from `open_app` after compatibility migration; remove prompt-only alias guessing.  
**Required regression tests:** Exact display name; executable alias; case-only variant; partial name; two similar apps; renamed/uninstalled app; Always/Ask/Never identity consistency; one confirmation maximum; structured candidates; no wrong-app launch; Activity preserves attempted ID and display name.  
**Required live verification:** Open Character Map, Excel, Chrome, and one similarly named pair through exact inventory identities and prove the visible process/window each time.  
**Estimated implementation size:** M.

### JARVIS-018 — A text-only model step can orphan an active task in `running` with no loop controlling it

**Severity:** Major  
**Evidence:** REAL CHROME, REAL WINDOWS PC, REAL DEVICE AGENT, DATABASE-PROVEN, SOURCE-PROVEN  
**Release blocker:** Yes — multi-step tasks can silently stop between successful actions and require manual recovery  
**Exact locations:** `src/jarvis/agent.ts:152-179`; `src/jarvis/agent.ts:220-283`; `src/jarvis/agent.ts:286-327`; `src/jarvis/agent.ts:340-378`; task UI in `src/jarvis/JarvisWorkspace.tsx` and `src/jarvis/JarvisTaskCard.tsx` where controller ownership is rendered  
**Functions/components:** `runJarvisTurn`; `runDevice`; `runTool`; model-step loop; controller claim; task card Take Over/Resume.  

**Reproduction:** Run E4, a four-step disposable workspace task. After successful `run("mkdir -p jarvis-e4")` and `file_write("jarvis-e4/result.txt")`, observe the assistant emit visible text `Called computer {"action":"file_read","path":"jarvis-e4/result.txt"}` without an actual tool call.

**Expected:** While a durable task is open, a model step must either issue a valid tool, finish/block/fail the task, or enter a bounded recoverable protocol-error state. The same tab should retain the controller until one of those outcomes.

**Actual:** `runJarvisTurn` returned immediately because `reply.toolCalls.length === 0`, leaving task `1087f954-e7b6-4397-8aae-2ec2a819da92` in `running`. The UI changed to `This task is not being worked on in this tab`; Activity had no `file_read` action. The task remained orphaned for more than 20 seconds. Take Over changed it to `taken_over`; Resume created a new controller and planning turn, after which the task continued and completed.

**Root cause:** At `agent.ts:350-355`, any text-only model response ends the turn even when `task` is non-null and unfinished. There is no invariant that an active task must reach a terminal/handoff state before the loop releases its controller, and no automatic transition to `blocked` on protocol-shaped text that resembles a tool call.

**Customer/security impact:** Real work stops without an explicit failure, background work can remain indefinitely `running`, device busy state is misleading, and customers must notice and operate Take Over/Resume. Raw tool-shaped text leaks into the conversation. Repeated resumes consume more paid JARVIS steps and can repeat prior actions when checkpoint data is incomplete.

**Exact recommended repair:**

1. At the no-tool branch, if no task is active, keep the existing conversational return.
2. If a task is active, accept text only when the same step also called `finish_task`; otherwise append one structured protocol reminder and allow one bounded corrective model step.
3. If the correction still has no valid tool, atomically transition the task to `blocked` with a machine-readable `planner_no_action` blocker and release controller ownership. Never leave it `running` without a loop.
4. Do not persist internal `Called <tool> ...` scaffolding as customer-visible assistant prose. Preserve it only in bounded diagnostic telemetry with sensitive arguments redacted.
5. Add a heartbeat/controller lease or `controller_last_seen_at` so a crashed tab deterministically yields a resumable state rather than permanent `running`.
6. Make Resume claim the existing task idempotently from its checkpoint and verify the previous controller is no longer active before issuing another action.

**Reuse:** Existing `FINISHED` statuses, controller UUID authority, `updateTask`, Take Over/Resume UI, checkpoint field, and maximum-step guard.  
**Reroute/connect:** Route unfinished text-only exits into one bounded correction and then structured blocker/lease recovery.  
**Delete later:** Remove raw `Called ...` scaffold text from customer message persistence and remove indefinite unleased `running` states.  
**Required regression tests:** Text-only reply before task start; text-only reply after task start; tool-shaped plain text; empty model reply; provider truncation; tab close; network loss; duplicate Resume; concurrent controllers; one correction maximum; raw tool arguments never visible; task never remains running without an active lease.  
**Required live verification:** Repeat a multi-step file task while forcing a text-only step, close/reopen the tab, and prove deterministic blocked/resume behavior without repeated file writes.  
**Estimated implementation size:** M.

### JARVIS-019 — The planner has no selected-device OS context, so Unix commands run under Windows `cmd` and can make unintended changes

**Severity:** Major  
**Evidence:** REAL WINDOWS PC, REAL DEVICE AGENT, DATABASE-PROVEN, SOURCE-PROVEN  
**Release blocker:** Yes for reliable terminal/coding tasks on Windows  
**Exact locations:** `src/jarvis/agent.ts:110-129`; `src/jarvis/protocol.ts:266-282`; `src/jarvis/protocol.ts:331-348`; `jarvis-runtime/ocade_computer.py:248-285`  
**Functions/components:** `TurnInput`; `systemPrompt`; JARVIS computer `run` tool; `Computer._run`; `Computer._sandboxed`.  

**Reproduction:** In E4, ask JARVIS to create a folder and later print a file in the selected Windows workspace. Inspect Activity and the physical workspace.

**Expected:** The planner knows the selected device runs Windows and uses commands valid for the declared shell, or uses direct file operations when available. It verifies the exact resulting filesystem shape.

**Actual:** JARVIS sent `mkdir -p jarvis-e4`. Windows `cmd /c` exited 0 but treated `-p` as a directory name, creating both `workspace\\-p` and `workspace\\jarvis-e4`. JARVIS then sent `cat result.txt`, which failed because `cat` is unavailable in `cmd`, before retrying `type result.txt` successfully. The final answer claimed the requested folder/file work was completed but did not disclose or detect the unintended `-p` directory. Database action results reported Windows isolation as `timeout` and preserved both the false-success mkdir and failed cat.

**Root cause:** `TurnInput` and `systemPrompt()` contain no selected device platform or shell contract even though `jarvis_devices.platform` is stored. The computer tool accepts one free-form command string. The Windows runtime always executes it through `cmd /c`, so portable intent is interpreted with platform-specific syntax that the model was never told.

**Customer/security impact:** Terminal and coding tasks can fail, create unintended files, or interpret metacharacters differently across Windows/macOS/Linux. Exit code 0 is insufficient proof of the requested effect. In larger tasks this can corrupt a disposable project, make cleanup incomplete, and amplify shell-injection or quoting mistakes.

**Exact recommended repair:**

1. Include the selected device's verified platform and an explicit shell contract in the task planning context after server-side device allocation.
2. Prefer direct structured actions for directory creation, file writes, reads, renames, and deletes. Add the smallest missing structured action such as `file_mkdir` rather than using a shell for basic filesystem work.
3. For `run`, define the exact shell (`cmd.exe` or PowerShell on Windows; POSIX shell elsewhere), quoting rules, and working directory in tool metadata returned to the planner.
4. Add an optional structured expected-effect check for commands that mutate files. At minimum, require a follow-up `file_list` or `file_read` and compare the result with intent before completion.
5. Report unexpected created paths and failed retries in Activity/final result. A later successful command must not erase earlier side effects.
6. Keep workspace path enforcement server/device-side and do not expose a generic cross-platform shell abstraction that rewrites untrusted strings.

**Reuse:** `jarvis_devices.platform`, selected device record, direct file actions, workspace `_inside` guard, Activity results, and task checkpoints.  
**Reroute/connect:** Connect platform/shell metadata to the planner; route basic filesystem operations through structured file actions.  
**Delete later:** Delete prompt-driven use of POSIX shell idioms on Windows and any redundant shell calls replaced by structured file operations.  
**Required regression tests:** Windows `cmd`/PowerShell commands; POSIX commands; mkdir without extra paths; spaces and metacharacters; Unicode; failed command then retry; exit-0 wrong effect; exact file-list verification; output truncation; command cancellation; workspace escape attempts.  
**Required live verification:** Repeat E4 on Windows and one POSIX host; verify only the requested folder/file exists and no failed cross-platform command is needed.  
**Estimated implementation size:** M.

### Evidence and outcomes

- **REAL DEVICE AGENT:** Permission changes reached the selected device; production capabilities became apps/files/screen/terminal/computer-control true and Background Mode true.
- **REAL APP FAILURE:** Calculator confirmation and dispatch were correct, but installed Store/UWP discovery failed (JARVIS-016).
- **REAL APP FAILURE:** A discovered classic app failed because the planner invented `charmap` instead of the exact `Character Map` identity (JARVIS-017).
- **REAL WORKSPACE SUCCESS:** E4 physically created `jarvis-e4/result.txt` containing exactly `OCADE_JARVIS_E4_OK` inside the authorized workspace.
- **REAL TERMINAL SUCCESS WITH DEFECTS:** Windows `type result.txt` returned the exact content, but only after `mkdir -p` created an unintended `-p` directory and `cat` failed (JARVIS-019).
- **DATABASE TEST:** E4 ended `completed`, `current_step=4`, correct device/conversation association, correct final result, and last-action checkpoint. Activity retained every executed command and result.
- **REAL TAKE OVER/RESUME:** Take Over transitioned the orphaned task to `taken_over`; Resume obtained a new controller and completed it. The underlying orphan condition is JARVIS-018.
- **BLOCKED:** Chrome automation policy refused navigation to `chrome://extensions`; no bypass was attempted. The exact unpacked build is ready for a manual Developer Mode load.

### Section 10 progress checkpoint

**Deep Audit Progress: Section 10/64 — JARVIS task execution**  
**Completed sections: 10/64**  
**Checks executed: 191**  
**Passed: 143**  
**Failed: 43**  
**Blocked: 5**  
**Not yet tested: Task status edge cases, expected failures/retries/cancellation, global Stop, permission matrix, extension manual load, deeper Windows control and remaining JARVIS surfaces**  
**Real AI generations used: 26 (25 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 8/28**  
**New findings this section: 4**  
**Running total findings: 19**  
**Critical: 0 | Major: 11 | Medium: 4 | Small: 3 | Minor: 1**

### JARVIS-020 — Completed task progress and durable checkpoint disagree, leaving recovery at step zero

**Severity:** Major  
**Evidence:** REAL WINDOWS PC, REAL CHROME, DATABASE-PROVEN, SOURCE-PROVEN  
**Release blocker:** Yes for dependable long-task recovery/background execution  
**Exact locations:** `src/jarvis/agent.ts:220-283`; `src/jarvis/agent.ts:314-327`; `src/jarvis/protocol.ts:324-348`; production `public.jarvis_tasks.current_step`, `plan`, and `checkpoint`  
**Functions/components:** `runDevice`; optional computer-tool `step`; `finish_task`; `systemPrompt` checkpoint resume context; task progress card.  

**Reproduction:** Complete E4 after its Take Over/Resume recovery, then read task `1087f954-e7b6-4397-8aae-2ec2a819da92` from production.

**Expected:** After four completed plan steps, `current_step` and the durable checkpoint identify the same completed boundary, with enough evidence to resume after the last verified action without replaying earlier mutations.

**Actual:** The row ended `status='completed'`, `current_step=4`, plan length 4, but `checkpoint.step=0` while `checkpoint.lastAction='Running type result.txt'`. Every model-issued computer action omitted the optional `step` argument, so `runDevice` never advanced `task.current_step`. `finish_task` later set `current_step` directly to the full plan length while leaving the checkpoint unchanged. The customer-visible completed state is accurate for the requested file outcome, but the recovery authority contradicts it.

**Root cause:** Plan progress depends on an optional model-provided `step`; it is not derived from successfully verified actions or atomically coupled to checkpoint writes. `finish_task` force-fills progress to `plan.length` regardless of the stored checkpoint and does not write a terminal checkpoint.

**Customer/security impact:** After a browser/device crash, background restart, or cross-controller Resume, the system can repeat already completed file, terminal, browser, or sensitive actions. Progress UI and recovery logic can disagree even though both read the same task row. Duplicate actions are especially risky for sends, uploads, deletions, installs, and code changes.

**Exact recommended repair:**

1. Make plan-step identity explicit and server-validated for task actions; do not rely on an optional free model number.
2. After each action result is verified, atomically update `current_step` and `checkpoint` under the current controller lease in the same server transaction/RPC.
3. Store action ID, verified result status, and an idempotency marker in the checkpoint. Resume must inspect this marker before repeating a mutation.
4. `finish_task(completed)` must require all required plan steps to have verified completion or an explicit justified skip. Write one terminal checkpoint with `step=plan.length` and final action/result identity.
5. If task and checkpoint disagree, render a recovery warning and block blind replay until deterministic reconciliation.
6. Preserve failed attempts and unintended side effects in Activity; completion may summarize recovery but must not erase them.

**Reuse:** Existing task controller, action IDs, Activity results, checkpoint JSON, `updateTask`, and Take Over/Resume flow.  
**Reroute/connect:** Route action settlement through one atomic progress/checkpoint authority; make Resume consume that record.  
**Delete later:** Remove optional model-only progress advancement and the unconditional `currentStep = task.plan.length` completion shortcut.  
**Required regression tests:** Actions with omitted/wrong step; repeated step; parallel controller; failed then successful retry; browser crash after action result but before checkpoint; terminal completion; non-idempotent action; checkpoint/task disagreement; Resume does not replay settled mutation.  
**Required live verification:** Interrupt a four-step disposable task after each step, restart the tab/agent, and prove exact once-only continuation with matching `current_step` and checkpoint.  
**Estimated implementation size:** M.

### Evidence and outcomes

- E1, E2 and E3 were physically unsuccessful and each task correctly ended `failed`; no Calculator or Character Map process/window was present.
- E4 physically achieved the requested file/write/read outcome and ended `completed`; the exact file contents and successful `type result.txt` output matched the final result.
- Activity truthfully retained the failed `cat result.txt` attempt and successful retry, but the final result omitted the failed attempt and unintended `-p` directory already recorded in JARVIS-019.
- The E4 progress/checkpoint contradiction is independently recorded as JARVIS-020.

### Section 11 progress checkpoint

**Deep Audit Progress: Section 11/64 — JARVIS task status accuracy**  
**Completed sections: 11/64**  
**Checks executed: 207**  
**Passed: 154**  
**Failed: 47**  
**Blocked: 6**  
**Not yet tested: Additional expected failures, retries, cancellation/global Stop, full permission matrix, manual extension load and remaining JARVIS surfaces**  
**Real AI generations used: 26 (25 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 8/28**  
**New findings this section: 1**  
**Running total findings: 20**  
**Critical: 0 | Major: 12 | Medium: 4 | Small: 3 | Minor: 1**

### JARVIS-021 — Device exceptions upload absolute local paths and the Windows username into cloud Activity

**Severity:** Medium  
**Evidence:** REAL WINDOWS PC, REAL CHROME, REAL DEVICE AGENT, DATABASE-PROVEN, SOURCE-PROVEN  
**Release blocker:** Yes for paid release privacy/error handling  
**Exact locations:** `jarvis-runtime/ocade_computer.py:168-190`; `jarvis-runtime/ocade_computer.py:203-227`; `jarvis-runtime/ocade_device.py:118-157`; `src/jarvis/device.server.ts:409-431`; production `public.jarvis_activity.summary` and `result`  
**Functions/components:** `Computer.run`; `Computer._inside`; `Computer._file`; `Agent._execute`; `exchangeDevice`; Activity panel.  

**Reproduction:** Send E5: `JARVIS audit E5: In the selected disposable workspace, read the file missing-audit-file.txt and report its exact content. Do not create it, do not retry with another path, and stop if it does not exist.` Then inspect the physical workspace, task, and Activity row.

**Expected:** The device returns a bounded customer-safe error such as `missing-audit-file.txt does not exist`; no local root, username, drive, or installation layout leaves the computer.

**Actual:** The task correctly failed and the file remained absent. The Activity summary uploaded to production contained the Python `FileNotFoundError` text with the full absolute path `C:\\Users\\haans\\Documents\\Codex\\...\\audit-state\\jarvis-workspace\\missing-audit-file.txt`. The customer-facing final answer was sanitized only because the model paraphrased it later; the cloud Activity record retained the sensitive path.

**Root cause:** `Computer.run` catches broad exceptions and directly interpolates `str(e)` into the device result. `Agent._execute` forwards that summary, and `exchangeDevice` persists it verbatim (bounded only by length). File operations do not map expected OS exceptions to structured local error codes before this catch-all boundary.

**Customer/security impact:** Local usernames, drive layout, project names, organization names, and sensitive folder structure can be stored in cloud Activity for 90 days and displayed to account sessions. Similar errors may expose command paths or package locations. This increases privacy impact and makes support logs carry more local metadata than needed.

**Exact recommended repair:**

1. Catch expected filesystem exceptions inside `_file` and return structured codes such as `not_found`, `not_a_file`, `permission_denied`, and `invalid_path`, plus only the workspace-relative path.
2. At the outer `Computer.run` boundary, map remaining exceptions to a stable generic summary and a local-only diagnostic code. Never include `str(e)`, traceback, absolute path, environment variable, or command line in the cloud payload.
3. Add a device-side redaction backstop for Windows drive paths, UNC paths, POSIX home paths, usernames, tokens, and control characters before any `summary` or `detail` is exchanged.
4. Keep detailed diagnostics locally behind an explicit support-export flow with user review; do not upload them through routine Activity.
5. Sanitize both summary and nested result/detail on the server before persistence as defense in depth.
6. Define retention and redaction behavior in the JARVIS privacy/security docs and verify account export/deletion covers Activity.

**Reuse:** Workspace-relative `rel`, structured action result shape, bounded Activity fields, and local pending-result store.  
**Reroute/connect:** Route expected OS errors through structured relative error mapping; route detailed diagnostics to local opt-in support export.  
**Delete later:** Remove catch-all `str(e)` from customer/cloud summaries and purge/redact existing audit rows containing absolute paths after the audit state is retired.  
**Required regression tests:** Missing file; missing folder; access denied; locked file; invalid encoding; symlink/junction escape; Windows drive/UNC path; POSIX home path; username/token redaction; nested detail sanitization; customer message and Activity both safe.  
**Required live verification:** Repeat E5 and confirm task, Activity, Supabase row, logs, and support surfaces contain only the relative name and safe error code.  
**Estimated implementation size:** S.

### Evidence and outcomes

- **PASS:** E5 created a real task, attempted exactly one `file_read`, stopped after the expected failure, and did not create or retry the missing file.
- **PASS:** Task status `failed`, Activity action status `failed`, physical absence, and customer answer agreed.
- **PASS:** Earlier app-permission denial and unavailable-app paths also ended failed without false physical success.
- **FAIL:** The low-level exception disclosed the absolute local path in cloud Activity (JARVIS-021).

### Section 12 progress checkpoint

**Deep Audit Progress: Section 12/64 — JARVIS task failure**  
**Completed sections: 12/64**  
**Checks executed: 220**  
**Passed: 164**  
**Failed: 50**  
**Blocked: 6**  
**Not yet tested: Retry duplication, cancellation/global Stop timing, complete permission matrix, manual extension load and remaining JARVIS surfaces**  
**Real AI generations used: 31 (30 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 3/28**  
**New findings this section: 1**  
**Running total findings: 21**  
**Critical: 0 | Major: 12 | Medium: 5 | Small: 3 | Minor: 1**

### JARVIS-022 — Failed tasks have no supported Retry action or idempotent retry authority

**Severity:** Medium  
**Evidence:** REAL CHROME, DATABASE TEST, SOURCE-PROVEN, DOCUMENTATION MISMATCH  
**Release blocker:** No by itself; it materially weakens recovery and supportability  
**Exact locations:** `src/jarvis/JarvisPanels.tsx:175-223`; `src/jarvis/JarvisTask.tsx:19-61`; `src/jarvis/agent.ts:286-327`; `src/jarvis/jarvis.functions.ts` task-update/start functions; `docs/APP_FLOW.md:88`; production failed tasks E1/E2/E3/E5  
**Functions/components:** Tasks panel; `Controls`; `FINISHED`; `start_task`; `finish_task`; task allocation/controller path.  

**Reproduction:** Open Tasks after E5 fails. Inspect the task list, open the failed conversation, and inspect the task card.

**Expected:** A retryable failure exposes a structured Retry action that continues the same authorized task from its last verified checkpoint, refuses duplicate clicks, and does not repeat completed mutations.

**Actual:** The Tasks panel exposes only the task/conversation button and `Show result`. `Controls` returns `null` for every status in `FINISHED`, including `failed` and `blocked`. There is no Retry server function or idempotency path. The only customer option is to manually send another prompt, which creates a new task/controller and has no durable relationship to the failed task. `docs/APP_FLOW.md` requires async operations to end in a retryable error or terminal error, but the UI and schema do not expose that distinction.

**Root cause:** Task statuses collapse all failures into terminal `failed`/`blocked` without a retryability code, retry token, predecessor relation, or allowed transition. The UI implements Resume only for unfinished statuses and has no failed-task action.

**Customer/security impact:** Recoverable network, device, permission, stale-page, or transient application errors force customers to restate work and spend new model usage. Completed steps may be repeated, duplicate sends/uploads/writes become possible, and support cannot distinguish a safe retry from a terminal failure.

**Exact recommended repair:**

1. Add structured failure metadata: stable `failure_code`, `retryable`, `failed_action_id`, and checkpoint/idempotency state.
2. Add one authenticated `retryJarvisTask` server operation that locks the existing task, verifies account/device/permissions, rejects duplicate concurrent retries, and creates a new controller lease on the same task.
3. Show Retry only for `retryable=true`; show a direct corrective action such as Connect device or Enable permission when that is the blocker.
4. Resume from the last settled action/checkpoint and require action-level idempotency before repeating a mutation.
5. Preserve the prior failed attempt in Activity and append a `Retried` note; do not overwrite history or silently create a second task.
6. Distinguish terminal policy refusal, user decline, unavailable capability, transient transport failure, and stale observation.

**Reuse:** Take Over/Resume controller transfer, checkpoints, Activity, selected device authority, and permission checks.  
**Reroute/connect:** Route failed retryable tasks through the same controller/lease mechanism used by Resume, with additional idempotency validation.  
**Delete later:** Remove manual prompt-restatement guidance once structured Retry exists; avoid a second parallel retry system.  
**Required regression tests:** Single retry; rapid double click; two tabs; device offline then online; permission denied then enabled; transient command failure; terminal refusal; prior write/send/upload; usage charging; one task id; Activity audit trail; no repeated settled action.  
**Required live verification:** Retry E5 after creating the missing file and prove the same task continues once, then repeat with two simultaneous Retry clicks.  
**Estimated implementation size:** M.

### Evidence and outcomes

- **PASS:** Take Over and Resume recovered E4 using the same task ID and a new controller, and Activity recorded both transitions.
- **FAIL:** No Retry control exists for failed/blocked tasks in the Tasks panel or task card.
- **BLOCKED:** Duplicate retry and failed-task idempotency cannot be tested through a supported product action because no retry authority exists.
- **SOURCE-PROVEN:** Finished status handling intentionally removes controls; there is no retry server path.

### Section 13 progress checkpoint

**Deep Audit Progress: Section 13/64 — JARVIS retry and recovery**  
**Completed sections: 13/64**  
**Checks executed: 232**  
**Passed: 170**  
**Failed: 54**  
**Blocked: 8**  
**Not yet tested: Stop timing/global Stop, complete permission matrix, manual extension load, deeper Windows control and remaining JARVIS surfaces**  
**Real AI generations used: 31 (30 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 3/28**  
**New findings this section: 1**  
**Running total findings: 22**  
**Critical: 0 | Major: 12 | Medium: 6 | Small: 3 | Minor: 1**

### JARVIS-023 — Global STOP does not interrupt an action already claimed by the Device Agent

**Severity:** Critical  
**Evidence:** LOCAL TEST AGAINST REAL DEVICE RUNTIME, SOURCE-PROVEN, DATABASE TEST, PARTIAL REAL CHROME  
**Release blocker:** Yes — mandatory safety control does not stop active computer execution  
**Exact locations:** `src/jarvis/JarvisWorkspace.tsx:813-831`; `src/jarvis/jarvis.functions.ts:719-736`; `src/jarvis/device.server.ts:298-306`; `src/jarvis/device.server.ts:352-365`; `src/jarvis/device.server.ts:409-431`; `jarvis-runtime/ocade_agent.py:122-168`; `jarvis-runtime/ocade_device.py:97-168`; `jarvis-runtime/ocade_computer.py:248-295`  
**Functions/components:** web `stopAllJarvis`; device `exchange(input.stop)`; `Presence.stop_jarvis`; mini-control STOP; tray STOP; `Agent.run`; `Agent._execute`; `Computer._run`; `Computer._kill`.  

**Reproduction:**

1. Confirm the web global STOP calls `stopAllJarvis`, and tray/mini STOP only set `agent.stop_all`.
2. Run the real current `Agent._execute` against the disposable workspace with Windows command `ping -n 7 127.0.0.1 > nul`.
3. Set `agent.stop_all` one second after execution starts and measure completion.

**Expected:** Global STOP immediately terminates or safely cancels every active device/browser action, marks its Activity cancelled/stopped, prevents subsequent effects, and releases controller/device busy state.

**Actual:** The local runtime action continued for 5.08 seconds after the stop flag was set, completed after 6.08 seconds total, and returned status `done`. `Agent.run` cannot send its stop exchange while blocked inside `_execute`; `_execute` never reads either stop event; `_run` waits synchronously up to 300 seconds and calls `_kill` only on timeout. Separately, web `stopAllJarvis` cancels only Activity rows in `queued` or `needs_confirmation`, excluding `claimed`. Device-originated Stop cancels queued/confirmation rows but likewise cannot be exchanged until the blocking action returns. E6 proved queued work is cancelled correctly, but not active work.

**Root cause:** Stop is modeled as eventual task/database state and a poll-loop flag, not as a cancellation signal wired into the currently executing subprocess/browser/computer action. The single-threaded exchange loop owns both network polling and synchronous execution, so it cannot receive remote Stop while an action blocks.

**Customer/security impact:** After a customer presses any global STOP surface, an active command can continue for up to 300 seconds; browser/device actions can also continue until their own timeout. A continuing action may write files, send data, navigate, click, or complete a sensitive operation after the customer believes control has stopped. The UI/server may say stopped while physical execution continues.

**Exact recommended repair:**

1. Introduce one per-action cancellation token owned by the Device Agent and available to subprocess, browser, and screen-control executors.
2. Keep a lightweight authenticated stop channel alive independently of the blocking action loop: separate short-poll thread, websocket, or bounded control poll. A tray/mini STOP must set the same local token synchronously before any network request.
3. On Windows, run commands in a Job Object/process group and terminate the full process tree on cancellation; wait for confirmed exit before reporting stopped. Apply equivalent process-group termination on macOS/Linux.
4. Make browser actions interruptible and close/release the owned automation operation without affecting unrelated tabs.
5. Extend server stop operations to mark `claimed` actions `cancelling`, require device cancellation acknowledgement, then settle `cancelled`; timeout to `cancel_failed` with a prominent warning rather than claiming success.
6. The web UI must distinguish `Stopping…`, `Stopped`, and `Could not confirm stop`. Do not toast `JARVIS stopped` until all active devices acknowledge or are marked offline with an unresolved-stop warning.
7. Reject/ignore any late `done` result for an action whose stop generation/idempotency epoch has been cancelled, while retaining it in security telemetry as a late result.

**Reuse:** Existing global web button, tray/mini `Presence.stop_jarvis`, device signed exchange, task/activity statuses, `_kill`, and controller/device identities.  
**Reroute/connect:** Connect every STOP surface to one cancellable execution token and acknowledgement protocol, with the server as durable authority.  
**Delete later:** Remove the assumption that setting `stop_all` or changing task status is sufficient; remove immediate success toasts before acknowledgement.  
**Required regression tests:** Stop queued action; claimed subprocess; subprocess tree; Playwright navigation; page wait; screen action; file write boundary; Stop from web/tray/mini; offline device; late result; repeated Stop; simultaneous devices; maximum acknowledgement latency; no unrelated process/tab termination.  
**Required live verification:** Run a Windows-valid 30-second command that would create a marker at the end, press each Stop surface after claim, and prove process-tree exit, marker absence, cancelled Activity, stopped task, and UI acknowledgement.  
**Estimated implementation size:** L.

### Evidence and outcomes

- **PASS:** Web global STOP is authenticated and account-scoped; source selects every unfinished account task.
- **PASS:** Tray and mini controls reuse `Presence.stop_jarvis`; there are not three independent stop implementations.
- **PASS:** E6 showed queued Activity becomes cancelled and no future file action runs.
- **FAIL:** Active runtime execution ignores the stop flag until synchronous `_execute` returns (JARVIS-023).
- **FAIL:** Server web Stop excludes `claimed` Activity from cancellation/acknowledgement.
- **BLOCKED:** Packaged tray/mini UI live proof awaits the missing packaged companion/dependencies in later sections.

### Section 15 progress checkpoint

**Deep Audit Progress: Section 15/64 — JARVIS global STOP**  
**Completed sections: 15/64**  
**Checks executed: 261**  
**Passed: 189**  
**Failed: 60**  
**Blocked: 12**  
**Not yet tested: Full permission matrix, extension manual load, installer/tray lifecycle, deeper Windows control and remaining JARVIS surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 0/28; live JARVIS generation is rate-limited until reset**  
**New findings this section: 1**  
**Running total findings: 23**  
**Critical: 1 | Major: 12 | Medium: 6 | Small: 3 | Minor: 1**

### JARVIS-024 — Allowed Apps collapses every computer into one account-wide app-name policy

**Severity:** Major  
**Evidence:** REAL CHROME / PRODUCTION DATABASE STATE, SOURCE-PROVEN, DOCUMENTATION CONTRADICTION  
**Release blocker:** Yes for multi-device computer control  
**Exact locations:** `src/jarvis/jarvis.functions.ts:165-190`; `src/jarvis/JarvisPanels.tsx:300-327`; `src/jarvis/permissions.ts:90-95,113-166`; `docs/Backend Schema.md:65-71`; `docs/PRD.md:81-92`; `docs/TESTING.md:83-88`; `docs/ARCHITECTURE.md:99-103`  
**Functions/components/tables/tests:** `readJarvisState`; `AllowedAppsPanel`; `appDecision`; `refuseAction`; `needsConfirmation`; `jarvis_permissions`; `jarvis_devices.installed_apps`; `jarvis-rules.test.ts` Allowed Apps test.

**Reproduction and evidence:**

1. Enroll a device and let it report `installed_apps`; the current audit device reported its discovered app list.
2. In the real Chrome Allowed Apps panel, change Character Map through Ask, Never, Always, and back to Ask. Production persistence showed that the app rule was stored with `device_id = null` every time.
3. Inspect `readJarvisState`: it merges installed apps from every non-revoked device into one lowercase map, then computes one rule per display name.
4. Inspect `AllowedAppsPanel`: each select calls `decide(capability, allowed, null, ...)`, explicitly discarding device identity.
5. Inspect `appDecision`: it considers only rows whose `device_id === null`. Both refusal and confirmation decisions therefore use the same account-wide rule.
6. Compare the documented contract: device-sensitive permission state is required to be scoped and evaluated per device, and the test plan explicitly requires per-device permission differences.

**Expected:** Each discovered application is tied to the device and a stable application identity. A customer can allow an application on one computer while leaving the same-named or different executable on another computer at Ask or Never. Enforcement evaluates the selected target device.

**Actual:** All live-device inventories are flattened by lowercase display name. A single account-global `app:<lowercase display name>` row governs every device. Two different executables with the same display name become indistinguishable, and a permission granted for one computer silently applies to another computer with that name.

**Root cause:** The state DTO and UI model app permissions as `{name, rule}` without `deviceId` or executable identity. The mutation hardcodes `deviceId=null`, while `appDecision` is deliberately restricted to null-device rows. App discovery reports only display strings, so the backend has no durable package/path/publisher identity to authorize.

**Customer/security impact:** A customer who trusts an app on a work computer can unintentionally pre-authorize a same-named program on a home, shared, compromised, or later-enrolled computer. The UI cannot explain which computer an app belongs to. This violates the documented per-device permission boundary and creates an authorization-confusion path before broad desktop control is released.

**Exact recommended repair:**

1. Extend the Device Agent inventory protocol to report a stable local app identifier plus display name, platform/package identity, publisher where available, and device id. Do not authorize by executable path supplied by the model.
2. Represent state as device groups, for example `{deviceId, deviceName, apps:[{appId,name,rule}]}`, instead of one account-wide name map.
3. Store app policy in `jarvis_permissions` with the target `device_id` and a capability key derived from the normalized stable app id. Add a forward migration/index that prevents duplicate `(user_id, device_id, capability)` rows while retaining the existing global capability rows.
4. Change `AllowedAppsPanel` to label and group apps by computer and pass that computer's id to `setJarvisPermission`.
5. Change `appDecision(rows, deviceId, appId)` to prefer the exact device/app row. If account-wide defaults remain a deliberate feature, expose them separately and apply an explicit precedence rule; do not make them the only rule.
6. Pass the selected device and stable app id through `refuseAction` and `needsConfirmation`; verify the requested launch against the inventory signed by that device.
7. Migrate existing account-global `app:*` decisions conservatively to Ask, or require the customer to choose devices before they become effective. Never silently broaden an existing Always rule.

**Reuse:** Existing device-specific permission schema/RLS, `setJarvisPermission`, enrolled-device ownership checks, Allowed Apps tri-state control, and signed Device Agent inventory exchange.  
**Reroute/connect:** Connect each displayed app row and each enforcement decision to the selected device and stable inventory identity.  
**Delete later:** Remove the account-wide `Map<string,string>` merge and the hardcoded null device id for app decisions after migration. Remove display-name-only authorization.  
**Required regression tests:** Two devices with the same app name and different identities; same identity on two devices with different decisions; Always/Ask/Never per device; revoked/offline/removed app; casing/localization change; forged model app name; inventory rename; account isolation; migration of an existing global rule; UI labels the affected device; enforcement uses the task-selected device.  
**Required live verification:** Enroll two disposable agents, assign opposite decisions to the same displayed app, and prove only the intended device executes without confirmation. Repeat after reconnect, rename, revoke, and re-enrollment.  
**Estimated implementation size:** M.

### Evidence and outcomes

- **PASS:** App names are normalized case-insensitively for the current single-device display and exact-name policy lookup.
- **PASS:** Ask is represented by no row; the Section 16 cleanup removed the Character Map test rule and restored the production baseline.
- **PASS:** Revoked devices are excluded from the inventory merge.
- **FAIL:** The UI discards device identity and writes every app choice with `device_id=null`.
- **FAIL:** Enforcement reads only account-global app rows and cannot express different decisions per device.
- **FAIL:** Display names are treated as authorization identities; package/executable/publisher identity is not available to policy evaluation.
- **FAIL:** The current focused unit test covers one account-global list only and does not exercise the documented per-device difference.
- **BLOCKED LIVE MATRIX:** A second authorized audit device is not enrolled, so the multi-device cross-effect is source/database proven rather than executed on two physical agents.

### Section 17 progress checkpoint

**Deep Audit Progress: Section 17/64 — Allowed Apps identity and per-device scope**  
**Completed sections: 17/64**  
**Checks executed: 296**  
**Passed: 214**  
**Failed: 68**  
**Blocked: 14**  
**Not yet tested: Devices lifecycle, current-device identity, extension manual load, installer/tray, deeper Windows control and remaining JARVIS surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 0/28; live JARVIS generation is rate-limited until reset**  
**New findings this section: 1**  
**Running total findings: 24**  
**Critical: 1 | Major: 13 | Medium: 6 | Small: 3 | Minor: 1**

### JARVIS-025 — Devices UI omits required readiness and current-device identity states

**Severity:** Medium  
**Evidence:** REAL CHROME, REAL DEVICE AGENT, SOURCE-PROVEN, REQUIREMENT FAILURE  
**Release blocker:** No by itself; blocks a trustworthy multi-device launch experience  
**Exact locations:** `src/jarvis/JarvisPanels.tsx:342-430`; `src/jarvis/jarvis.functions.ts:36-37,213-220`; `docs/PRD.md:81-92`; audit requirement Section 18  
**Functions/components:** `SidePanel` Devices branch; `readJarvisState`; `JarvisState.devices`; `ONLINE_MS`.

**Reproduction and evidence:**

1. Keep the authorized Device Agent polling and open Devices in the real signed-in Chrome profile.
2. Observe the live row for `OCADE Audit Device 2026-09-27`: the panel says only `Online · Windows`, followed by capability switches.
3. The panel contains no `Ready` or `Needs permission` summary and no current/this-computer marker.
4. Inspect the state mapper: it derives only a boolean `online` from a 60-second `last_seen_at` threshold. It does not derive readiness from required capabilities, task mode, protocol/software compatibility, or permission state, and it does not expose a current-device id.
5. Inspect the renderer: it chooses only `Online` or `Offline`; all connected agents are visually equivalent regardless of whether they can execute the requested work.

**Expected:** Each device row clearly distinguishes Ready, Needs permission, Offline, incompatible/outdated, revoked, and current/this-computer identity where applicable. The state should explain which missing permission or capability blocks work.

**Actual:** Online is treated as the only positive status. The live agent appeared Online although real-browser use was unavailable and the row itself showed `Use my own browser` disabled. Customers must infer readiness from many switches. There is no current-device marker, so same-name or multiple-computer lists cannot be confidently disambiguated.

**Root cause:** The device state contract contains liveness and raw capabilities but no readiness/status reason or authenticated local-device association for the web/extension surface. UI status rendering is a binary expression over `online`.

**Customer/security impact:** Customers can select an Online device that cannot perform the requested action, misunderstand a permission failure as an execution failure, or remove/change the wrong similarly named device. In a multi-device account this weakens confidence in remote control and raises accidental revocation/authorization risk.

**Exact recommended repair:**

1. Add a server-derived status enum and safe reason codes: `ready`, `needs_permission`, `offline`, `incompatible`, `revoked`, and `busy`. Derive it from freshness, protocol/software compatibility, selected task mode, advertised capabilities, and device-scoped permissions.
2. For extension/agent surfaces, bind a locally held signed device id to the page through the authenticated protocol and return `isCurrentDevice` only after proof of that identity. Do not infer current device from name, IP, user agent, or platform.
3. Render an explicit badge and one concise reason/action, such as `Needs permission · Files is off` or `Offline · last seen 4 min ago`.
4. Show stable distinguishing metadata without exposing secrets: device name, platform, kind, and a short fingerprint/suffix. Offer rename before Remove.
5. Keep capability switches as detailed controls; do not use them as a substitute for the summary state.

**Reuse:** Existing signed per-device key, fingerprint helper, liveness timestamp, capability map, device-scoped permission rows, and toggle controls.  
**Reroute/connect:** Connect the selected task's required capability/mode to a server-derived device readiness reason and signed local-device identity.  
**Delete later:** Replace the binary `online ? "Online" : "Offline"` rendering once the status enum is live.  
**Required regression tests:** Ready agent; Online but capability missing; permission off; browser-real unavailable; stale/offline at threshold boundary; incompatible protocol; busy device; same-name devices; authenticated current marker; forged local id; revoked device; reconnect transition; accessible status announcements.  
**Required live verification:** Run two agents/extension identities with different permissions, prove correct status and current marker in Chrome, stop one for over 60 seconds, reconnect it, and verify state transitions without reload or duplicate rows.  
**Estimated implementation size:** M.

### Evidence and outcomes

- **REAL CHROME PASS:** The live authorized device appeared once with its exact configured name, Windows platform, capability controls, Background Mode, Co-work, and Remove device.
- **REAL AGENT PASS:** The polling process remained connected and the UI showed Online; liveness agreed with real runtime polling rather than a static claim.
- **PASS:** Staleness is bounded: the server marks a device offline when `last_seen_at` is at least 60 seconds old, and offline rows remain visible instead of disappearing.
- **PASS:** Revoked rows are excluded from the Connected list.
- **PASS / SOURCE:** Enrollment identity is deduplicated by a unique P-256 public key; re-enrolling the same identity returns `409 already_enrolled`.
- **FAIL:** The UI implements only Online/Offline, not the required Ready/Needs Permission states.
- **FAIL:** No current-device marker or signed current-device association is present.
- **FAIL:** Same-name devices have no fingerprint suffix or other reliable visual disambiguator.
- **BLOCKED LIVE MULTI-DEVICE:** Duplicate-name rendering and current-marker behavior require a second enrolled agent/extension; the implementation already lacks the data/UI needed to pass.

### Section 18 progress checkpoint

**Deep Audit Progress: Section 18/64 — Devices UI**  
**Completed sections: 18/64**  
**Checks executed: 312**  
**Passed: 224**  
**Failed: 74**  
**Blocked: 14**  
**Not yet tested: Enrollment failure/expiry/retry matrix, revoke lifecycle, protocol fuzzing, extension manual load, installer/tray and remaining JARVIS surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 0/28; live JARVIS generation is rate-limited until reset**  
**New findings this section: 1**  
**Running total findings: 25**  
**Critical: 1 | Major: 13 | Medium: 7 | Small: 3 | Minor: 1**

### JARVIS-026 — Remove device revokes immediately with no confirmation or identity detail

**Severity:** Medium  
**Evidence:** REAL CHROME, REAL DEVICE AGENT, SOURCE-PROVEN  
**Release blocker:** No  
**Exact locations:** `src/jarvis/JarvisPanels.tsx:398-461`; `src/jarvis/jarvis.functions.ts:672-697`  
**Functions/components:** Devices list `Remove device` button; `revokeJarvisDevice`.

**Reproduction and evidence:**

1. Enroll and start the audit-created disposable device `OCADE Audit Revoke 2026-09-27`.
2. Open Devices in the real Chrome profile and click its `Remove device` link once.
3. Observe that no confirmation dialog, device fingerprint, task-impact warning, or undo period appears. The mutation runs immediately.
4. Within one refresh cycle the row disappears. On its next signed poll the real agent receives NotEnrolled, exits, and deletes `device.key` and `device.json` locally.

**Expected:** A destructive remote-revoke action identifies the exact device and explains that active work will stop and local re-enrollment will be required, then requires an explicit confirmation. The final result is acknowledged.

**Actual:** One click on a small repeated `Remove device` link permanently nulls the public key, stops tasks, cancels actions, and causes local credentials to be erased. Same-name devices have no fingerprint suffix, compounding wrong-device risk. There is no success toast or undo/recovery affordance.

**Root cause:** The row button directly calls `revokeJarvisDevice`; the component has no pending selection/confirmation state. Device rows expose only name/platform/kind, not a stable human-verifiable fingerprint.

**Customer/security impact:** A stray tap, keyboard activation, automation click, or confusion between same-name computers can disconnect the wrong machine and interrupt work. Recovery requires a fresh enrollment. This is especially risky on mobile or when managing remote machines.

**Exact recommended repair:**

1. Open a confirmation dialog that names the device, platform, kind, short fingerprint, online/busy state, and active-task impact.
2. Require a second explicit `Remove <device name>` action; disable it while submitting and make double submission idempotent.
3. After success, show a durable acknowledgement and a short re-enrollment instruction. If an active task existed, say that its stop is pending until the device acknowledges; align this with the JARVIS-023 cancellation protocol.
4. Return `not_found_or_already_revoked` when no owned active row was changed rather than always returning success.
5. Keep revocation irreversible at the key level; do not offer an insecure undo that restores a nulled credential. Recovery should create a new identity.

**Reuse:** Existing modal/dialog patterns, enrollment fingerprint display, revoke server function, security notification system and device task state.  
**Reroute/connect:** Feed the selected device metadata into a single confirmation dialog, then call the existing revoke authority.  
**Delete later:** Replace the direct one-click mutation handler.  
**Required regression tests:** Cancel confirmation; confirm; double click; same-name devices; active task; offline device; already revoked; cross-account id; mobile tap; screen-reader labels; refresh during mutation; agent acknowledgement/local deletion.  
**Estimated implementation size:** S.

### Evidence and outcomes

- **REAL CHROME / REAL AGENT PASS:** The disposable agent was actively polling before revoke and appeared once in Devices.
- **PASS:** Revoke is authenticated and account-scoped; the update requires both device id and caller user id.
- **PASS:** The device disappeared from the live panel after the state refresh.
- **PASS:** The next real signed agent poll was rejected; the process printed `This device is no longer connected. Its key was removed.` and exited nonzero.
- **PASS:** Local `device.key` and `device.json` no longer exist. The revoked identity therefore cannot sign another request from the agent.
- **PASS / SOURCE:** Revoke nulls the server public key, stamps `revoked_at`, stops unfinished tasks on that device, and cancels queued, claimed, or confirmation-waiting Activity rows.
- **PASS:** The primary audit device stayed connected and Online; revoking the disposable id did not affect the other identity.
- **FAIL:** One click revoked the device without confirmation, fingerprint, active-task warning, or final success message (JARVIS-026).
- **FAIL, ALREADY JARVIS-023:** A device blocked inside a synchronous active action cannot receive the revocation rejection until that action returns; server cancellation alone cannot prove physical execution stopped.

### Section 20 progress checkpoint

**Deep Audit Progress: Section 20/64 — Device revocation**  
**Completed sections: 20/64**  
**Checks executed: 345**  
**Passed: 250**  
**Failed: 79**  
**Blocked: 16**  
**Not yet tested: Key rotation loss/retry, protocol fuzzing, installer/tray, extension manual load and remaining JARVIS execution surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 0/28; live JARVIS generation is rate-limited until reset**  
**New findings this section: 1**  
**Running total findings: 26**  
**Critical: 1 | Major: 13 | Medium: 8 | Small: 3 | Minor: 1**

### JARVIS-027 — Device results for unknown or stale action IDs are silently acknowledged and discarded

**Severity:** Medium  
**Evidence:** LIVE PROTOCOL TEST, SOURCE-PROVEN  
**Release blocker:** No by itself; must be fixed before reliable crash/reconnect recovery  
**Exact locations:** `src/jarvis/device.server.ts:409-431`; `jarvis-runtime/ocade_agent.py:126-168`; `jarvis-runtime/ocade_identity.py:174-194`  
**Functions/components:** `exchange`; `Agent.run`; `Identity.exchange`; `jarvis_activity` result settlement.

**Reproduction and evidence:**

1. Enroll the disposable protocol-test device and authenticate a correctly signed exchange.
2. Submit a syntactically valid `done` result whose UUID `0276ec3b-3462-468d-864b-bd218fd7d28e` does not identify a claimed Activity row for that device.
3. The server returns 200 with a normal command envelope and no rejected-result list.
4. Resubmit the identical logical result under a fresh signed timestamp. The server again returns 200 with no indication that zero rows were settled.

**Expected:** The acknowledgement tells the agent which result ids were durably accepted, already settled, stale, or rejected. The agent retains unacknowledged results for recovery or records an explicit terminal disposition.

**Actual:** The update is scoped safely to matching `id + device_id + status=claimed`, but its affected-row count is ignored. The overall exchange still returns 200. `Agent.run` clears its complete pending-results list immediately after any successful exchange, so an unknown, prematurely expired, already cancelled, or otherwise stale result is irretrievably discarded.

**Root cause:** Results are treated as best-effort update statements rather than an acknowledged message protocol. The response envelope has no per-result settlement field, and the agent equates transport-level 200 with durable acceptance of every result.

**Customer/security impact:** After a disconnect, server timeout, cancellation race, or crash recovery, the computer may have physically completed an action while OCADE records failure/cancellation. The agent then deletes its only durable result. Customers can retry and duplicate file edits, submissions, or commands because cloud state cannot reconcile what really happened.

**Exact recommended repair:**

1. For every submitted result, perform a conditional update with `select(id,status)` or an RPC that returns a terminal disposition.
2. Return `resultAcks:[{id,status:'accepted'|'already_settled'|'stale'|'unknown'|'wrong_state'}]` in the signed device envelope.
3. Remove only accepted/already-settled ids from `pending.json`; retain retryable ids. Quarantine unknown/wrong-state ids with bounded retention and surface a recovery Activity event rather than retrying forever.
4. Include an action generation/idempotency token so a late result can be correlated with the exact claim and cannot settle a newer retry.
5. For an action that physically completed after its cloud lease expired, record `late_result` and require the planner/customer to reconcile before a potentially duplicate retry.

**Reuse:** Existing signed exchange, durable `pending.json`, action UUID, device/task scoping, Activity result JSON and TTL cleanup.  
**Reroute/connect:** Connect database affected-row/disposition data to an explicit per-result acknowledgement consumed by the agent.  
**Delete later:** Remove the blanket `results = []` after any 200 response once per-id acknowledgement exists.  
**Required regression tests:** Valid claimed result; duplicate result; unknown UUID; wrong device; cancelled action; expired queued/claimed action; server 500; lost response; agent restart; late result after Stop/revoke; action-id reuse attempt; bounded quarantine; no duplicate physical execution.  
**Estimated implementation size:** M.

### Evidence and outcomes

- **PASS:** `jarvis-runtime/ocade_protocol.json` is the source contract imported directly by the website server and Python agent. The extension build reads the same JSON and emits its runtime module; the audit-built extension's normalized contract exactly matched the source.
- **PASS:** Missing/old protocol returned 426 `update_required`; a future version returned 400 `unknown_protocol`.
- **PASS:** A timestamp outside the five-minute skew window returned 401 `clock_skew`.
- **PASS:** Missing signature returned 401 `signature_invalid`; a random device UUID returned 401 `device_not_enrolled`.
- **PASS:** Signed malformed JSON, invalid enrollment fields, a missing `results` exchange body, and a non-UUID result id returned 400 `invalid_request`.
- **PASS:** A body over 600,000 characters returned 413 `too_large` before parsing or signature work.
- **PASS:** Section 19's byte-identical replay returned 401 `replayed`; Section 21 proved wrong/old signing authority returns 401.
- **PASS:** Every successful envelope names protocol version and exact device id, and the Python client refuses a response addressed to another device.
- **FAIL:** Unknown/stale but well-shaped result ids receive an indistinguishable 200 and are discarded locally (JARVIS-027).
- **FAIL, ALREADY JARVIS-015:** The intended extension build that generates this shared contract is not runnable on Windows as shipped; equality was proven using the audit workaround package, not the official build command.
- **CLEANUP PASS:** The disposable protocol identity was revoked, disappeared from Devices, and deleted its local key on the next real agent start.
- **BLOCKED:** Live website/Device Agent contract parity is proven, but the real Chrome extension cannot exchange until the browser-security-mandated manual unpacked-extension load.

### Section 22 progress checkpoint

**Deep Audit Progress: Section 22/64 — Device protocol**  
**Completed sections: 22/64**  
**Checks executed: 379**  
**Passed: 278**  
**Failed: 84**  
**Blocked: 17**  
**Not yet tested: Installer/package experience, tray/mini-control, extension manual load, real-browser CDP through JARVIS and remaining execution surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 0/28; live JARVIS generation is rate-limited until reset**  
**New findings this section: 1**  
**Running total findings: 27**  
**Critical: 1 | Major: 13 | Medium: 9 | Small: 3 | Minor: 1**

### JARVIS-028 — No production Windows installer or signed update channel is published

**Severity:** Major  
**Evidence:** REAL WINDOWS BUILD, PRODUCTION HTTP TEST, REAL CHROME, SOURCE/DOC REVIEW  
**Release blocker:** Yes for public Device Agent launch  
**Exact locations:** `jarvis-runtime/packaging/ocade-agent.spec:1-31`; `jarvis-runtime/packaging/windows/ocade-agent.iss:1-49`; `jarvis-runtime/ocade_update.py:1-159`; `src/jarvis/JarvisPanels.tsx:465-473`; `docs/APP_FLOW.md:93-99`; `docs/TRD.md:121-125`; `docs/JARVIS_DEVICE_ROADMAP.md:49-57`  
**Functions/components/routes:** PyInstaller spec; Inno Setup definition; signed updater; Devices `Connect a computer` panel; expected `/agent/manifest.json` release channel.

**Reproduction and evidence:**

1. Open Devices in production: it says `The signed installer for Windows and macOS is not published yet` and provides no download/install control.
2. Request the updater endpoints used by `ocade_update.check`: `/agent/manifest.json` and `/agent/manifest.json.sig`; both return 404. Candidate Windows artifact paths also return 404.
3. The audit installed build-only dependencies into an isolated audit folder and successfully produced a real Windows PyInstaller folder. Its `--health` check returned 0.
4. Windows Authenticode inspection reported `NotSigned`. Inno Setup and `signtool` are unavailable on the test PC, and no compiled setup executable exists in the repository or production.
5. `UPDATE_PUBLIC_KEY` is `None`, so every automatic update is intentionally refused even if an artifact appears.

**Expected:** A normal Windows 10/11 customer clicks a clearly identified download, verifies a trusted publisher through Windows, installs per-user without Python, enrolls through the same account, receives signed updates, can roll back after failed health checks, and can uninstall through Windows Settings.

**Actual:** Only source/build recipes exist. Production has no installer or signed update metadata. The only executable produced during this audit is an unsigned private 164.03 MiB folder artifact, not an installable public release. The customer-visible UI explicitly declares the installer unpublished.

**Root cause:** Packaging architecture was prepared but release engineering is incomplete: owner signing identity, compiled Inno artifact, release manifest/key pin, hosted artifacts, download UI, and production verification are absent.

**Customer/security impact:** Ordinary customers cannot enable documented PC control safely. Distributing the unsigned audit/development folder would trigger trust warnings and create a supply-chain risk. Auto-update and rollback cannot function in production, leaving installed agents vulnerable or protocol-incompatible.

**Exact recommended repair:**

1. Create a reproducible locked Windows build environment and build the one-folder agent from the canonical SHA; record dependency lock, SBOM, source SHA and artifact hashes.
2. Compile `ocade-agent.iss` into a per-user Setup artifact. Sign the agent executable and installer/uninstaller with the owner-controlled Windows code-signing certificate and timestamp service.
3. Generate an Ed25519 update key offline, pin only its public half in `ocade_update.py`, and keep the private signing key outside repository/CI logs.
4. Publish versioned immutable Windows archives and a signed manifest at the exact `/agent/` paths the updater uses. Configure correct content types, cache immutability for artifacts, no-store/short TTL for the manifest, and HTTPS only.
5. Add a production `Set up this PC`/Download control that states publisher, supported OS/architecture, version and privacy scope. Keep source instructions in developer documentation only.
6. Run clean Windows 10 and 11 install, SmartScreen/signature, standard-user, enrollment, update, forced health-failure rollback and Windows Settings uninstall tests before enabling the button.

**Reuse:** Current PyInstaller spec, Inno Setup script, signed-manifest code, update hash/health/rollback logic, enrollment flow and uninstall routine.  
**Reroute/connect:** Connect Devices setup UI to a signed versioned release manifest/artifact, and connect the packaged supervisor to that same signed channel.  
**Delete later:** Remove customer-facing source/Python setup directions after the signed installer is public; never publish the unsigned audit artifact.  
**Required regression tests:** Clean Windows 10/11 x64; no Python installed; standard user; signature chain/timestamp; offline installer failure; interrupted install; existing version; update downgrade/replay; tampered manifest/archive; failed health rollback; locked files; autostart; uninstall offline/online; revoked credential; artifact/hash/SBOM provenance.  
**Estimated implementation size:** L plus release credentials.

### JARVIS-029 — The documented source setup omits the tray dependency and has no reproducible packaging dependency set

**Severity:** Medium  
**Evidence:** REAL WINDOWS ENVIRONMENT, LOCAL BUILD, SOURCE-PROVEN  
**Release blocker:** Yes as part of JARVIS-028; independently breaks the documented developer/source setup  
**Exact locations:** `jarvis-runtime/README.md:10-18`; `jarvis-runtime/setup.py:1-94`; `jarvis-runtime/requirements.txt:1-86`; `jarvis-runtime/ocade_agent.py:147-168`; `jarvis-runtime/packaging/ocade-agent.spec:1-31`  
**Functions/components:** `setup.py main`; `Presence.start_tray`; PyInstaller hidden imports/build command.

**Reproduction and evidence:**

1. Follow the declared dependency manifest: neither `pystray` nor `PyInstaller` is listed in `requirements.txt`, and there is no separate locked build-requirements file.
2. On the real Windows environment, `playwright`, `cryptography`, and `pynput` existed, but `pystray` and `PyInstaller` did not.
3. `Presence.start_tray` catches every import error and returns false without a customer-visible failure, so the required tray presence silently disappears after the documented source setup.
4. The documented PyInstaller command could not start until the audit manually installed PyInstaller and pystray into an isolated non-product audit directory.

**Expected:** Runtime and build dependency sets are explicit, reproducible, pinned/locked and tested. A missing required UI dependency fails packaging/health gates rather than silently deleting the only tray control.

**Actual:** Source setup can report completion without the required tray library. Packaging depends on undeclared tools and whatever unrelated packages happen to be installed in the developer's global Python environment; the audit build searched global site-packages and bundled 1,148 files.

**Root cause:** Runtime, optional feature, and release-build dependencies are mixed into one broad requirements file while two required packaging/tray dependencies are omitted. The tray import failure is intentionally swallowed.

**Customer/security impact:** Development/test agents may run invisibly with no tray STOP/Open/Exit controls. Release artifacts are not reproducible and may accidentally include environment-specific packages, increasing size, attack surface and provenance uncertainty.

**Exact recommended repair:**

1. Add a minimal locked runtime dependency set for the packaged agent, including `pystray`, and a separate locked build requirements file containing the exact PyInstaller/hooks versions.
2. Build in a clean virtual environment/container/VM with no global site-packages; fail if undeclared imports are needed or unexpected packages enter the artifact.
3. Make tray initialization a health requirement on supported desktop builds. If it fails, show one actionable native error/log and refuse to claim normal readiness.
4. Split optional donor modules and heavyweight libraries from the production agent artifact until their capabilities are wired; add them through signed feature bundles only when needed.
5. Record bundle contents and size budget in the release gate.

**Reuse:** Current requirements markers, PyInstaller spec, `--health`, and graceful optional capability pattern.  
**Delete later:** Remove unused donor dependencies from the production package rather than carrying the entire historical requirements set.  
**Required regression tests:** Clean venv install; dependency lock verification; tray import/start; missing tray failure; hidden import audit; build twice/reproducible inventory; no global-site leakage; artifact size budget; `--health` checks required resources and tray backend.  
**Estimated implementation size:** M.

### Evidence and outcomes

- **REAL WINDOWS PASS:** With isolated audit-only build dependencies, the current PyInstaller spec produced a Windows x64 one-folder application; packaged `ocade-agent.exe --health` exited 0.
- **PASS:** The Inno definition is per-user and does not require elevation; it installs versioned files, invokes autostart setup, starts the agent, and calls the agent uninstall hook before deleting versions.
- **PASS / SOURCE:** The updater verifies Ed25519 manifest signature, archive SHA-256, traversal safety and a 30-second health check; it retains one previous version and has a failed-start rollback counter.
- **PASS / SOURCE:** Public unsigned builds are explicitly forbidden by docs/scripts, and the runtime refuses updates while no release key is configured.
- **FAIL:** Production publishes no installer, update manifest, signature or Windows archive; all tested routes returned 404 (JARVIS-028).
- **FAIL:** The audit build is unsigned and therefore a private test artifact only (JARVIS-028).
- **FAIL:** `requirements.txt` omits required `pystray`, while PyInstaller/build hooks have no declared locked build environment (JARVIS-029).
- **FAIL:** Production Devices offers no installer UX and ordinary users would need the documented Python/source path.
- **BLOCKED:** A real compiled Inno Setup install/uninstall could not be executed because Inno Setup and owner signing credentials are absent; installing release tooling would not create a trustworthy owner-signed artifact.
- **WORKSPACE INTEGRITY PASS:** OCADE source was not edited; all downloaded build dependencies, work files and artifacts are under `audit-state`. Git status remained clean.

### Section 23 progress checkpoint

**Deep Audit Progress: Section 23/64 — Device Agent installer**  
**Completed sections: 23/64**  
**Checks executed: 401**  
**Passed: 291**  
**Failed: 92**  
**Blocked: 18**  
**Not yet tested: Packaged startup/tray/autostart/uninstall, extension manual load, real-browser CDP through JARVIS and remaining execution/mobile surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 0/28; live JARVIS generation is rate-limited until reset**  
**New findings this section: 2**  
**Running total findings: 29**  
**Critical: 1 | Major: 14 | Medium: 10 | Small: 3 | Minor: 1**

### JARVIS-030 — Packaged Windows agent crashes because `actions/ocade_page.js` is absent

**Severity:** Major  
**Evidence:** USER SCREENSHOT, REAL WINDOWS REPRODUCTION, CLEAN BUILD, FIXED AND REGRESSION-PROVEN  
**Release blocker:** Fixed in the audit working tree; still blocks release until reviewed, signed and shipped  
**Exact locations:** `jarvis-runtime/actions/browser_control.py:446-471`; `jarvis-runtime/ocade_device.py:61-83,102-106`; `jarvis-runtime/ocade_agent.py:171-196,226-252`; `jarvis-runtime/packaging/ocade-agent.spec:13-27`; `jarvis-runtime/tests/test_agent.py:41-60`  
**Functions/components:** module-level `_OCADE_PAGE`; `Browsers.__init__`; `Agent.__init__`; PyInstaller `Analysis.datas`; `health_check`; packaged `--health`.

**Reproduction and evidence:**

1. Build the original Windows one-folder companion from the current spec and start it with a disposable `OCADE_JARVIS_HOME`.
2. Approve the real enrollment in Chrome.
3. The frozen process constructs `Agent → Browsers → actions.browser_control`; that module reads `Path(__file__).parent / 'ocade_page.js'` at import.
4. The original spec bundles only `ocade_protocol.json`. The process raises `FileNotFoundError` for `_internal\actions\ocade_page.js`, matching the user's screenshot/traceback, and exits instead of becoming a Device Agent.
5. The original `--health` returned 0 because it exited before importing the browser runtime, so release health checks could bless the broken artifact.

**Root cause:** A runtime data dependency was accessed by filesystem path but omitted from the PyInstaller `datas` manifest. The health check tested only argument parsing/process startup rather than importing runtime-critical modules/resources.

**Customer/security impact:** Every packaged Windows companion built from the original spec can enroll successfully and then crash immediately. PC/browser control, tray, STOP, background work and updates never become available, while an apparently connected cloud device row remains. A broken build could also pass update health verification and replace a working version.

**Implemented fix:**

1. Added `actions/ocade_page.js` to `Analysis.datas` with destination `actions`, preserving the source-relative path expected by `browser_control.py`.
2. Added `health_check()` in `ocade_agent.py`; packaged `--health` now imports `actions.browser_control` and requires both page semantics and safety gates to load.
3. Added a focused regression test that exercises the strengthened health check.

**Regression proof:**

- A completely new PyInstaller work/dist directory produced the fixed Windows companion.
- `_internal/actions/ocade_page.js` exists and is 5,388 bytes.
- Fixed packaged `--health` exits 0.
- A fresh fixed packaged identity enrolled through the real personal Chrome profile; six seconds after approval the companion process remained alive, held the single-instance port, polled production and used the expected device id.
- The source health regression test passes, Python compilation passes, and `git diff --check` reports no patch errors.

**Reuse:** The single shared `ocade_page.js`, current source-relative load, PyInstaller spec and signed updater health gate.  
**Delete later:** Delete unsigned audit build folders after release verification; do not ship them.  
**Required regression tests:** Clean Windows build; assert every declared data resource exists; run strengthened `--health`; first enrollment; process survives; browser session construction; Playwright launch/CDP attach; update health gate rejects a build with the resource removed; artifact inventory/SBOM check.  
**Estimated implementation size:** S; implemented.

### JARVIS-031 — Damaged local identity silently creates a second cloud device authority

**Severity:** Major  
**Evidence:** REAL WINDOWS CRASH/RESTART TEST, REAL CHROME, SOURCE-PROVEN, FIXED AND REGRESSION-PROVEN  
**Release blocker:** Fixed in the audit working tree; migration/cleanup UX remains for existing orphan rows  
**Exact locations:** `jarvis-runtime/ocade_identity.py:69-117`; `jarvis-runtime/ocade_device.py:47-63`; `jarvis-runtime/ocade_agent.py:35-44,188-207,252-265`; `jarvis-runtime/tests/test_agent.py:41-72`  
**Functions/components:** `Identity.__init__`; `Identity._save`; `Identity.forget`; `connect`; packaged startup error path.

**Reproduction and evidence:**

1. Enroll the original packaged companion, stop it, and corrupt only its disposable `device.json` while its private key remains.
2. Restart the original build.
3. `Identity.__init__` catches the parse error and silently resets both metadata and key state to empty. Startup treats the computer as new, generates another key, overwrites the local key, opens another enrollment and leaves the previous cloud authority active.
4. Production Devices showed three same-name `DESKTOP-7CF9G0F` rows during combined crash/recovery testing, two offline and one current; the UI could not distinguish them.

**Root cause:** Metadata writes were non-atomic and damaged identity state was collapsed into the same `{}` state as a never-enrolled device. Re-enrollment overwrote the only local key capable of proving/revoking the old authority.

**Customer/security impact:** A partial disk write, security tool, crash, or manual corruption can create orphan active device authorities and duplicate rows. If the old key had been copied before corruption, the customer may believe the new enrollment replaced it while the old credential remains usable until manually revoked.

**Implemented fix:**

1. Device metadata now writes to a restrictive temporary file and atomically replaces `device.json`, matching the existing key-write pattern.
2. `Identity` records a distinct `damaged` state when either credential file exists but parsing/loading fails.
3. CLI connection refuses to enroll over damaged state and gives exact remove/forget/reconnect recovery instructions.
4. Packaged startup shows an actionable native error and returns without creating a new key or browser enrollment.
5. Added regression coverage for damaged-state detection, atomic metadata save, temporary-file cleanup and valid reread.

**Regression proof:**

- Both focused identity/health tests pass.
- A second completely clean Windows build includes the changes and passes strengthened `--health`.
- Starting it against deliberately malformed `device.json`/`device.key` created no new Chrome tab or pending enrollment; the process remained only to display the actionable native error until closed.
- All three audit-created duplicate cloud rows were remotely revoked; production Devices again contains only the primary authorized audit device.

**Reuse:** Existing `forget`, Devices revoke, atomic private-key writer and native Tk message box.  
**Reroute/connect:** Future installer repair should offer a guided `Remove old device and reset this companion` flow after authenticated confirmation, never silent replacement.  
**Delete later:** Remove audit backup credential files after remaining recovery tests; never copy them into release artifacts.  
**Required regression tests:** Truncated JSON; missing key; invalid PEM; metadata/key mismatch; crash during temp write; read-only disk; reinstall with existing identity; lost metadata but valid key; no new enrollment; guided reset; old cloud row revocation; same-name disambiguation.  
**Estimated implementation size:** S; implemented.

### Evidence and outcomes

- **REAL WINDOWS PASS AFTER FIX:** Clean fixed companion build, critical resource inventory, strengthened health check, enrollment handoff, fingerprint approval and sustained polling all passed.
- **PASS:** Single-instance enforcement kept exactly one packaged process and returned `already running` on a second start.
- **PASS:** With no workspace, the packaged companion advertised no Files or Terminal capability; new device-specific Apps/Screen/Computer-control permissions remained off. No PC action ran while dormant.
- **PASS:** Dormant process CPU increased by less than one CPU-second across observed idle intervals; working set was approximately 60–83 MiB. One loopback listener owned the single-instance port.
- **PASS:** The normal first-start flow opened only an OCADE enrollment tab in the existing default Chrome profile and requested no password/token copy.
- **FAIL/FIXED:** Missing packaged `ocade_page.js` crashed every original Windows build after approval (JARVIS-030).
- **FAIL/FIXED:** Damaged metadata silently generated a duplicate active authority (JARVIS-031).
- **FAIL, ALREADY JARVIS-025/JARVIS-026:** Duplicate same-name rows had no fingerprint/current marker, and cleanup required one-click destructive removal.
- **CLEANUP PASS:** All disposable packaged identities were removed from production; the primary source-run audit device remains Online.
- **TEST LIMITATION:** The full lifecycle test module has Windows-specific pre-existing failures in its autostart assertion and was also affected by a live single-instance holder. Focused new tests passed; the Windows autostart test defect is addressed in Section 26.

### Section 24 progress checkpoint

**Deep Audit Progress: Section 24/64 — Device Agent startup**  
**Completed sections: 24/64**  
**Checks executed: 428**  
**Passed: 307**  
**Failed: 102**  
**Blocked: 19**  
**Not yet tested: Tray controls, autostart disable/re-enable, idle/active Exit, packaged uninstall, extension manual load, real-browser JARVIS execution and remaining mobile/cross-platform surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 28/28 after the account window reset**  
**New findings this section: 2**  
**Running total findings: 31**  
**Critical: 1 | Major: 16 | Medium: 10 | Small: 3 | Minor: 1**

### JARVIS-032 — Uninstall deleted credentials without stopping the running companion

**Severity:** Major  
**Evidence:** SOURCE-PROVEN, LOCAL FAILURE MODEL, FIXED, CLEAN PACKAGED WINDOWS REGRESSION  
**Release blocker:** Fixed in the audit working tree; signed installer uninstall must still be verified  
**Exact locations:** `jarvis-runtime/ocade_agent.py:97-165,244-330`; `jarvis-runtime/packaging/windows/ocade-agent.iss:39-50`; `jarvis-runtime/tests/test_agent.py:62-112`  
**Functions/components:** `_record_process`; `_stop_recorded_process`; `uninstall`; `main`; Inno `[UninstallRun]`.

**Reproduction and evidence:** The original `uninstall()` attempted cloud forget, removed the Run value and recursively removed the home directory, but never signalled or terminated the already running process. The Inno script's comment claimed the hook “Stops the agent's work,” although no stop existed. An offline process retains its already loaded metadata/private key in memory and its retry loop can remain active after local files appear removed.

**Root cause:** Single-instance ownership was represented only by a listening socket held in memory. No validated process identity or shutdown path was available to the separate uninstaller process.

**Customer/security impact:** Windows could report the companion uninstalled while its process, tray, in-flight action and loaded device credential remained alive until logout/reboot or server rejection. File deletion alone does not revoke secrets already in process memory.

**Implemented fix:**

1. The running companion atomically writes a permission-restricted `agent-process.json` containing PID, process creation time and resolved executable path after tray startup succeeds.
2. Uninstall reads that record before loading/revoking identity and terminates only when all three process attributes match, preventing stale PID reuse from killing an unrelated application.
3. It waits up to eight seconds, force-kills only the same validated process if graceful termination times out, removes the record, then performs cloud forget, autostart removal and home deletion.
4. Normal exit removes the process record.
5. Added regression tests for exact-process termination and stale/reused PID refusal.

**Regression proof:** A fourth clean PyInstaller build started against an approved local-only identity pointed at a closed loopback server, proving offline persistence. The packaged process wrote the expected record and remained alive. A second packaged `--uninstall` invocation exited 0, terminated the exact original PID, and removed the entire disposable home. Focused tests pass and Python compilation/diff checks pass.

**Reuse:** Declared `psutil`, atomic file pattern, current uninstall message, signed identity forget and Inno uninstall hook.  
**Reroute/connect:** Keep OS uninstall calling the companion hook before deleting versions; expose uninstall failure to the installer instead of continuing silently.  
**Delete later:** Remove unsigned fixed4 build and local harness artifacts after signed clean-VM verification.  
**Required regression tests:** Online and offline uninstall; active long command; active browser action; STOP timeout; stale/corrupt/missing record; PID reuse; executable mismatch; standard user; locked files; cloud revoke success/failure; reboot after uninstall; no Run value, process, tray, key, cache or update files; reinstall afterward.

### Evidence and outcomes

- **FAIL/FIXED:** Original uninstall did not stop a live companion (JARVIS-032).
- **REAL WINDOWS PASS AFTER FIX:** Clean packaged offline process was terminated and its complete disposable home removed.
- **PASS:** Stale PID/executable records do not terminate an unrelated process.
- **PASS:** Existing online forget remains best-effort so an offline user can still remove local control; the Devices UI remains the recovery path for server-side revoke.
- **BLOCKED:** A compiled, owner-signed Inno installer is unavailable, so Windows Settings uninstall UI, Restart Manager interaction and signed uninstaller behavior remain release-gate tests under JARVIS-028.

### Section 27 progress checkpoint

**Deep Audit Progress: Section 27/64 — Device Agent revoke and uninstall**  
**Completed sections: 27/64**  
**Checks executed: 470**  
**Passed: 342**  
**Failed: 104**  
**Blocked: 24**  
**Not yet tested: Signed Windows Settings uninstall, extension manual load, real-browser JARVIS execution and remaining mobile/cross-platform surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 28/28**  
**New findings this section: 1**  
**Running total findings: 32**  
**Critical: 1 | Major: 17 | Medium: 10 | Small: 3 | Minor: 1**

### JARVIS-033 — Extension build constructed invalid doubled Windows drive paths

**Severity:** Major  
**Evidence:** REAL WINDOWS REPRODUCTION, SOURCE FIX, BUILT ARTIFACT, ZIP INVENTORY, REGRESSION TEST  
**Release blocker:** Fixed in the audit working tree; live Chrome installation and store review remain  
**Exact locations:** `extension/build.mjs:13-46`; `extension/build.test.mjs:1-18`; `extension/STORE.md:1-32`  
**Functions/components:** ESM module-directory resolution; Windows ZIP creation; Chrome Web Store upload artifact.

**Reproduction and evidence:** On the current Windows checkout, `node extension/build.mjs --zip` failed before copying a file. `new URL(import.meta.url).pathname` returned `/C:/Users/...`; feeding that URL pathname to `path.resolve` produced `C:\C:\Users\...\dist\extension`, and `mkdirSync` raised `ENOENT`. Even after path correction, the original ZIP branch required the Unix `zip` executable, which is not a standard Windows dependency.

**Root cause:** A file URL was treated as an operating-system path, and the packaging command assumed a Unix tool despite documenting a cross-platform Windows product.

**Customer/security impact:** Windows release builders could not produce either the unpacked extension or Web Store upload. Teams could resort to hand-copied, unreviewed packages whose shared protocol/page semantics or host restriction had drifted.

**Implemented fix:**

1. Resolve the ESM file location with the standard `fileURLToPath(import.meta.url)` API before using `path.dirname`.
2. On Windows, create the ZIP with the built-in BSD tar `-a` archive selection; retain `zip -qr` on Unix.
3. Add a zero-dependency `node:test` regression that builds to a temporary native path and verifies Manifest V3, the single production host permission, shared page semantics and shared protocol module.

**Regression proof:** The built-in Node test passes. The real Windows command now emits `dist/extension` plus a 25,763-byte `dist/ocade-jarvis-extension.zip` with SHA-256 `E15FECC8C530B39DB4CA2BD409CC4730A4775E43A14B17A2C7DB723873D94DAC`. Archive inventory contains exactly the manifest, background/config/protocol/page scripts, popup and three declared icons at the package root.

**Reuse:** Standard-library `fileURLToPath`, Windows built-in tar, existing shared protocol/page sources and manifest rewrite.  
**Delete later:** Delete earlier hand-built `dist/extension-audit-workaround-20260927` and unsigned test ZIPs after live/store validation; keep one reproducible output only.  
**Required regression tests:** Windows/Linux/macOS build; paths with spaces/non-ASCII; custom `--out`; custom server origin; ZIP root layout; manifest/schema load in Chrome; deterministic inventory/hash policy; no secrets/source maps/extra hosts; Web Store upload validation.

### Evidence and outcomes

- **FAIL/FIXED:** The documented Windows build failed with `C:\C:\...` (JARVIS-033).
- **PASS:** Current unpacked output is Manifest V3 and restricts host access to `https://ocade.in/*`.
- **PASS:** Shared `ocade_page.js` and generated `ocade_protocol.js` are included, eliminating the packaged-resource class seen in JARVIS-030.
- **PASS:** Store ZIP exists and its exact inventory/hash were recorded.
- **PENDING ACTION-TIME CONFIRMATION:** Loading the unpacked extension changes the real personal Chrome profile and therefore requires confirmation immediately before the Developer Mode/Load unpacked action. Artifact preparation is complete.

### Section 28 progress checkpoint

**Deep Audit Progress: Section 28/64 — Chrome extension build and package**  
**Completed sections: 28/64**  
**Checks executed: 480**  
**Passed: 350**  
**Failed: 105**  
**Blocked: 25**  
**Not yet tested: Live extension load/link/control/restart/revoke, Chrome Web Store submission validation and remaining execution/mobile/cross-platform surfaces**  
**Real AI generations used: 34 (33 completed model steps, 1 deliberately stopped)**  
**Current account usage remaining: 28/28**  
**New findings this section: 1**  
**Running total findings: 33**  
**Critical: 1 | Major: 18 | Medium: 10 | Small: 3 | Minor: 1**

### JARVIS-034 — Tray startup failure hides the exception and gives no actionable diagnosis

**Severity:** Medium  
**Evidence:** USER-SUPPLIED REAL WINDOWS SCREENSHOT, SOURCE-PROVEN  
**Release blocker:** Yes for the companion installation experience  
**Exact locations:** `jarvis-runtime/ocade_agent.py:156-172,273-281`; `jarvis-runtime/packaging/ocade-agent.spec:23-27`; `jarvis-runtime/requirements.txt:22-30`  
**Functions/components:** `Presence.start_tray`; packaged startup error path; `pystray`/Pillow Windows backend.

**Reproduction and evidence:** The attached real Windows dialog states: `OCADE Device Agent could not start its tray control. Reinstall the companion and try again.` The only path returning that result is the broad `except Exception: return False` around `import pystray` and `from PIL import Image, ImageDraw`. The original exception type, module/backend name, frozen-resource path and traceback are discarded. The packaged health check does not initialize the tray backend, so it can return success before this failure.

**Root cause:** Required tray dependencies/backend initialization are treated as an opaque Boolean and the package health gate verifies browser resources only. The broad catch removes the evidence needed to distinguish a missing hidden import, unsupported backend, Pillow load failure or frozen-runtime conflict.

**Customer/security impact:** The required STOP/Open/Exit control surface is unavailable after install, and the user receives a reinstall loop that cannot repair or diagnose the underlying packaged dependency. A companion without a local emergency control must not claim readiness.

**Exact suggested fix:**

1. Catch `ImportError` and backend initialization errors separately and retain a sanitized error code plus local log containing exception type/module, never secrets.
2. Extend packaged `--health` to instantiate and immediately stop the actual Windows tray backend in a noninteractive smoke mode.
3. Make the installer run that smoke test before enrollment/start and roll back on failure.
4. Build in a clean locked environment, explicitly collect the selected pystray Windows backend and its transitive modules, and verify the installed artifact rather than the source environment.
5. Replace the generic reinstall text with the stable error code and a local diagnostics path; keep startup fail-closed.

**Required regression tests:** Clean Windows 10/11 install; packaged pystray import; icon creation/run/stop; Explorer/taskbar restart; DPI/scaling; missing backend/Pillow; health rejection; installer rollback; one icon only; STOP/Open/Exit after first enrollment.

### Evidence and outcomes

- **BLOCKED BY COMPUTER-USE SECURITY POLICY:** The authorized attempt to open `chrome://extensions` in the real Chrome profile was rejected by the browser-control URL policy. The policy explicitly forbids alternate UI/CDP/workaround attempts, so automated Developer Mode installation cannot proceed through this connection.
- **BLOCKED:** Live unpacked-extension load, account linking, fingerprint approval and extension popup behavior remain unproven until the user manually loads `dist/extension` in Chrome.
- **PASS:** The unpacked folder and ZIP were already built and inventory-validated in Section 28; no additional source/configuration was changed in this section.
- **FAIL:** The attached companion tray-control popup confirms JARVIS-034.

### Section 29 progress checkpoint

**Deep Audit Progress: Section 29/64 — Chrome extension installation and account linking**  
**Completed sections: 29/64**  
**Checks executed: 484**  
**Passed: 350**  
**Failed: 106**  
**Blocked: 28**  
**Not yet tested: User-loaded extension control/restart/revoke, Chrome Web Store readiness, real JARVIS browser/PC work and remaining mobile/cross-platform surfaces**  
**Real AI generations used: 34**  
**Current account usage remaining: 28/28**  
**New findings this section: 1**  
**Running total findings: 34**  
**Critical: 1 | Major: 18 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-035 — Store/privacy package lacks the required extension-specific disclosure and submission assets

**Severity:** Major  
**Evidence:** CURRENT SOURCE, BUILT ZIP, LIVE PRIVACY PAGE, CURRENT OFFICIAL CHROME WEB STORE POLICY  
**Release blocker:** Yes  
**Exact locations:** `extension/STORE.md:1-32`; `extension/popup.html:1-47`; `extension/popup.js:1-31`; `extension/manifest.json:1-14`; `src/routes/privacy.tsx:1-27`; `src/components/legal/LegalContent.tsx:370-535`; `extension/icons/*`  
**Functions/components:** Store listing package; popup connection consent; production privacy notice; Privacy Practices disclosures; reviewer materials.

**Reproduction and evidence:**

1. The extension handles browsing activity: page text, structure, URLs/titles and screenshots can be sent to the user's OCADE task while it operates. `STORE.md` mentions page content, but the popup's pre-connect state only says the browser is not connected and provides Connect; it does not prominently disclose the categories collected, purpose, destination or sharing before key enrollment/collection begins.
2. The live `https://ocade.in/privacy` notice and current source describe generic “feature-specific information” and connectors but do not comprehensively identify the browser extension's page content, browsing activity, screenshots, authenticated-session context, retention, recipients or user controls.
3. Current official Chrome policy requires prominent disclosure and affirmative consent before collection, an accurate policy covering collection/use/sharing and all recipients, and matching Privacy Practices declarations. Web Browsing Activity is permitted only as required for a prominently described user-facing feature.
4. The repository has three toolbar icons, but no store screenshots, promotional tile, long listing copy, support URL package, privacy-field checklist or reviewer test instructions/account flow. Official guidance requires meaningful screenshots/description and testing the locally loaded extension before upload.
5. The ZIP has a valid root manifest, MV3, a 109-character description, declared icons and one narrow OCADE host; these parts pass source/package inspection.

**Root cause:** Runtime code and a short internal `STORE.md` were treated as the publication package. Consent UX, legal disclosure, visual listing assets and reviewer workflow were not made release artifacts with one accountable checklist.

**Customer/security impact:** Users can connect a high-capability `debugger` extension without an adequate pre-collection explanation of browsing data. The item risks Chrome Web Store rejection/removal and creates a material transparency gap for authenticated browsing sessions.

**Exact suggested fix:**

1. Add an extension-specific disclosure in the popup before Connect that names page text/structure, URL/title, screenshots, task-only purpose, OCADE destination, when collection starts/stops and how to disconnect/delete; require an explicit unchecked consent action.
2. Add a dedicated extension section to the production privacy notice with the same categories, processing/sharing parties, retention, security and rights; link it directly from the popup and Store Privacy field.
3. Create a versioned store-submission directory containing long description, privacy/disclosure answers, permission justifications, support/homepage/privacy URLs, category/content rating, reviewer instructions, test account/device setup, screenshots and required promotional images.
4. Validate that every dashboard Privacy Practices answer exactly matches behavior and the policy; document `debugger`, `storage`, `alarms` and browsing-activity necessity.
5. Run a private trusted-tester release first, then stage production review; preserve the reviewed ZIP hash and listing revision.

**Required regression tests:** Disclosure visible before Connect; consent required; no enrollment/network data before consent; privacy link works signed out; disconnect stops polling and revokes key; data inventory/network capture; screenshot/listing dimension validator; reviewer clean-profile flow; private Store install/update/rollback; permission-warning review; dashboard/package/version consistency.

### Evidence and outcomes

- **PASS:** MV3 manifest, version, icons, sub-132-character description, root ZIP layout and single OCADE host permission meet the inspected package requirements.
- **PASS:** Source is readable/unobfuscated and packages page semantics locally rather than loading remote executable code.
- **PASS WITH REVIEW RISK:** `debugger`, `storage` and `alarms` are exercised by implemented behavior, but `debugger` requires strong reviewer justification and proven own-tab enforcement.
- **FAIL:** Extension-specific prominent disclosure/consent and comprehensive privacy coverage are absent (JARVIS-035).
- **FAIL:** Store screenshots, promotional assets, reviewer instructions and a complete submission checklist are absent (JARVIS-035).
- **BLOCKED:** Developer Dashboard ZIP upload, automated package analysis, Privacy Practices fields, trusted-tester publication and Google review require the owner's enrolled Chrome Web Store developer account and a live-loaded functional build.

### Section 30 progress checkpoint

**Deep Audit Progress: Section 30/64 — Chrome Web Store readiness**  
**Completed sections: 30/64**  
**Checks executed: 500**  
**Passed: 360**  
**Failed: 109**  
**Blocked: 31**  
**Not yet tested: User-loaded extension control/restart/revoke, real JARVIS browser/PC work, background/recovery, voice, Remote PC and mobile/cross-platform surfaces**  
**Real AI generations used: 34**  
**Current account usage remaining: 28/28**  
**New findings this section: 1**  
**Running total findings: 35**  
**Critical: 1 | Major: 19 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-036 — Disconnect/revoke leaves debugger sessions attached to owned tabs

**Severity:** Major  
**Evidence:** SOURCE-PROVEN; LIVE INSTALL BLOCKED  
**Release blocker:** Yes  
**Exact locations:** `extension/background.js:144-182,205-250,500-592`; `extension/popup.js:28-31`  
**Functions/components:** `forget`; `ownTabs`; `attached`; `cdp`; revoked-device branch; Disconnect popup action.

**Reproduction and evidence:** `cdp()` adds every attached owned tab id to the module-level `attached` set after `chrome.debugger.attach`. `forget()` optionally notifies OCADE, deletes the IndexedDB key and local connection state, but never calls `chrome.debugger.detach`, clears `attached`, clears `chrome.storage.session.tabs`, resets `active/held/boundary`, or closes/releases the extension-created tabs. The 401/403/410 revoke path calls the same incomplete `forget(false)`. The popup reports the browser disconnected after that local state deletion.

**Root cause:** Device-credential teardown and browser-session teardown were implemented as separate concerns, but only credential state was wired to Disconnect/revoke.

**Customer/security impact:** Chrome can continue displaying the high-trust debugger attachment after the user disconnects or the server revokes the extension. Previously controlled authenticated pages remain open and tracked until the service worker/browser tears down, contradicting the user's expectation that Disconnect immediately ends browser control.

**Exact suggested fix:**

1. Add one idempotent `releaseBrowserSession()` used by manual disconnect, remote revoke, protocol rejection, extension suspension/update and unrecoverable auth failure.
2. Snapshot `ownTabs()`, call `chrome.debugger.detach({tabId})` for every attached owned tab with per-tab error handling, then clear `attached`, session `tabs`, `active`, `held`, `boundary`, queued screenshots/results and stop state.
3. Define and disclose whether owned tabs remain open or close on disconnect; default to leave them open but fully detached so the person keeps their work.
4. Complete browser teardown before deleting the local device key/state and before the popup reports disconnected.
5. Verify server revoke during an active command stops/detaches at the next interruptible boundary; combine with the JARVIS-023 cancellation repair.

**Required regression tests:** Disconnect idle/active; server revoke idle/active; offline disconnect; every debugger target detached; Chrome debugging banner disappears; tabs remain untouched/open by policy; session ownership cleared; reconnect cannot inherit old tabs; service-worker restart; repeated teardown; partial detach failure; unrelated tabs never attached.

### Additional security/race outcomes

- **PASS / SOURCE:** `cdp()` refuses any tab id absent from extension-owned session storage before attaching.
- **PASS / SOURCE:** New work opens background tabs itself; switch/close operations are restricted to the owned list and the final owned tab cannot be closed through the action API.
- **PASS / SOURCE:** Password fields, payment-card entry, purchases, CAPTCHAs, OTPs and passkeys are blocked or handed to the person through shared gates.
- **PASS / SOURCE:** Page code is bundled locally and action arguments enter evaluated code through `JSON.stringify`, not direct source concatenation.
- **FAIL / CARRY JARVIS-023:** Extension STOP only sets `stopRequested`; when `polling` is already true, the new `poll()` returns immediately, active actions and remaining commands have no cancellation signal, and STOP is sent only after the current command batch finishes.
- **FAIL:** Disconnect/revoke does not release debugger targets or ownership state (JARVIS-036).
- **RACE LEAD:** `connect()` has no in-flight/idempotency guard; rapid duplicate Connect messages can generate multiple keys/enrollments before the first `setState`. Live reproduction remains blocked until manual load.
- **BLOCKED:** Existing journey coverage launches a disposable isolated Chromium profile and its happy-path source shows own-tab isolation, but dependencies are absent in this checkout and it does not replace real-profile proof.

### Section 31 progress checkpoint

**Deep Audit Progress: Section 31/64 — Extension tab ownership and browser security**  
**Completed sections: 31/64**  
**Checks executed: 514**  
**Passed: 368**  
**Failed: 113**  
**Blocked: 33**  
**Not yet tested: Manually loaded real-profile extension, duplicate-connect race, real JARVIS browser/PC work, background/recovery, voice, Remote PC and mobile/cross-platform surfaces**  
**Real AI generations used: 34**  
**Current account usage remaining: 28/28**  
**New findings this section: 1**  
**Running total findings: 36**  
**Critical: 1 | Major: 20 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-037 — Windows terminal commands can read and write outside the selected workspace

**Severity:** Critical  
**Evidence:** REAL WINDOWS LOCAL HARNESS, PHYSICAL FILE PROOF, SOURCE-PROVEN  
**Release blocker:** Yes; disable Windows Terminal capability until containment is real  
**Exact locations:** `jarvis-runtime/ocade_computer.py:10-15,141-164,168-190,248-295`; `src/jarvis/permissions.ts:100-140`; Devices copy for `Run commands in the workspace`  
**Functions/components:** `Computer._run`; `_sandboxed`; `_inside`; Windows `cmd /c`; advertised terminal capability and permission.

**Reproduction and evidence:**

1. Select `...\terminal-boundary-36\workspace` as the only workspace.
2. A normal `echo inside>inside.txt` command succeeds inside it.
3. Run `echo escaped>..\outside.txt`. `_inside` validates only the process working directory, then `_sandboxed` executes the unrestricted free-form string through `cmd /c`.
4. The command exits 0 and physically creates `outside.txt` above the selected workspace.
5. Run `type ..\outside.txt`; it exits 0 and returns `escaped`, proving outside-workspace reads can be uploaded in command output.
6. Passing `cwd: '..'` is correctly blocked, but command syntax trivially bypasses that cwd check.
7. The result labels Windows isolation as `timeout`; no filesystem, network, registry, process, CPU or memory sandbox exists. The code comment explicitly defers Windows Job Object limits.

**Root cause:** Workspace validation constrains only `cwd` and file-tool paths. A free-form shell has ambient user privileges and absolute/relative access to the entire user filesystem, processes, network and registry. A timeout/process group is represented as isolation even though it provides no resource or filesystem boundary.

**Customer/security impact:** Any planner mistake, prompt injection from page/file content, compromised model response or malicious command can read or alter files outside the approved folder and return their contents to OCADE. The UI promise “Run commands in the workspace” is false on Windows. This is a direct local confidentiality/integrity boundary failure.

**Exact suggested fix:**

1. Immediately stop advertising/enabling Windows `terminal` unless a proven sandbox is available; existing permission must fail closed with a clear unsupported message.
2. Route ordinary coding/tool execution to the OCADE-managed disposable sandbox described in the roadmap, mounting only a reviewed workspace copy or explicitly selected directory.
3. For local Windows execution, use a dedicated low-privilege execution identity/AppContainer or equivalent broker with an allowlisted workspace handle, denied network by default, Job Object process-tree/CPU/RAM/time limits, restricted token, controlled environment and no inherited user secrets.
4. Replace the free-form shell boundary with structured executable/argument requests where possible. Never treat cwd validation as containment.
5. Kill the entire process tree on Stop/timeout and wait for verified termination; retain bounded stdout/stderr after device-side path/secret redaction.
6. Report the actual isolation mechanism (`appcontainer`, `sandbox`, `none`) from runtime proof. Never label a timeout as isolation.

**Required regression tests:** Relative/absolute/UNC/home traversal; symlink/junction; environment-secret read; registry; network; process spawn/tree survival; background child; device files; workspace mount read/write; outside read/write/delete; timeout/STOP tree kill; CPU/RAM limits; stdout/stderr bounds/redaction; executable/argument metacharacters; clean Windows 10/11 standard user; sandbox unavailable fail-closed.

### Evidence and outcomes

- **PASS:** Normal command execution, disposable `git init`, source-file creation, Python execution (`42`) and `git status` work inside the selected audit workspace.
- **PASS:** A `cwd` parameter outside the workspace is blocked.
- **PASS:** Output and timeout paths are bounded; a one-second injected test timeout returned a stopped result.
- **FAIL:** Free-form command traversal wrote and read outside the workspace (JARVIS-037).
- **FAIL:** Runtime reports `isolation: timeout`, which is not an isolation boundary.
- **INCONCLUSIVE:** One detached-child timeout probe did not leave its delayed marker, but the implementation kills only the direct Windows process and has no Job Object proof; process-tree termination remains unproven, not passed.

### Section 36 progress checkpoint

**Deep Audit Progress: Section 36/64 — Terminal, coding and command containment**  
**Completed sections: 36/64**  
**Checks executed: 559**  
**Passed: 400**  
**Failed: 121**  
**Blocked: 38**  
**Not yet tested: Mouse/keyboard/takeover, active cancellation, background/crash recovery, screen/vision, voice/wake, Remote PC and mobile/cross-platform surfaces**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 37**  
**Critical: 2 | Major: 20 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-038 — Typing, hotkeys and scrolling do not bind to a fresh screen observation

**Severity:** Major  
**Evidence:** REAL WINDOWS SCREEN HARNESS, SOURCE-PROVEN  
**Release blocker:** Yes for mouse/keyboard control  
**Exact locations:** `jarvis-runtime/ocade_computer.py:109-139,321-405`; `src/jarvis/JarvisWorkspace.tsx:349-405,657-829`  
**Functions/components:** `InputGuard`; `Computer.observe`; `_stale`; `_screen`; `screen_type`; `screen_keys`; `screen_scroll`; Take Over/Continue/Co-work.

**Reproduction and evidence:** `screen_click` requires a matching observation id and rejects changed display size/active window/age. In contrast, `screen_type`, `screen_keys` and `screen_scroll` accept no observation id and perform input against whatever window/control is focused at execution time. A notification, dialog, application focus change or delayed command can redirect typing/hotkeys after planning. There is also no semantic field inspection in this fallback path to identify password, payment, OTP or other sensitive targets.

**Root cause:** Freshness validation was implemented only for coordinate clicks. Other ambient-input actions were treated as global operations despite sharing the same race and sensitive-target risk.

**Customer/security impact:** Text or hotkeys intended for one application can be injected into another, potentially sending messages, executing terminal commands or entering data into sensitive fields. Co-work intentionally suppresses user-input pause, widening the focus-change window.

**Exact suggested fix:**

1. Require `observationId` for every screen input action and apply the same age, geometry and active-window checks immediately before input.
2. Capture a target window/process identity and, where platform APIs allow, an accessibility element identity; refuse input when either changed.
3. Add device-side sensitive-field detection for password/payment/authentication surfaces and prohibit secret/card entry regardless of server confirmation.
4. Recheck focus between chunks during long typing; stop on any user input unless Co-work is explicitly active, and still stop on target-window change.
5. Make Take Over synchronously cancel queued/active input and release mouse/keyboard ownership; Continue requires a new observation.
6. Keep direct application APIs and structured automation ahead of screen fallback.

**Required regression tests:** Focus changes before/during type; modal/notification; stale observation; password/card/OTP fields; long text exceeding grace interval; hotkeys; scroll; multiple monitors/DPI; Take Over during action; Continue with fresh observation; Co-work user input and focus change; physical result verification.

### Evidence and outcomes

- **REAL WINDOWS PASS:** Screen capability reported available; a real 1920×1080 observation captured the active ChatGPT window and a bounded JPEG frame.
- **PASS:** Wrong observation id returned `stale` and supplied a fresh observation instead of clicking.
- **PASS:** Negative/out-of-bounds coordinates were rejected.
- **PASS:** Simulated user input caused a non-Co-work screen action to return `needs_confirmation` without scrolling.
- **PASS:** Current machine has one 1920×1080 monitor, so multi-monitor coordinate mapping is not claimed tested.
- **FAIL:** Type/hotkey/scroll have no observation freshness/target binding (JARVIS-038).
- **BLOCKED:** Real click/type was intentionally not fired without a stable disposable target window because the implementation cannot prove the target binding being audited.
- **CARRY JARVIS-023:** Global STOP still does not interrupt an already executing action.

### Section 37 progress checkpoint

**Deep Audit Progress: Section 37/64 — Screen, mouse, keyboard, Take Over and Co-work**  
**Completed sections: 37/64**  
**Checks executed: 571**  
**Passed: 408**  
**Failed: 123**  
**Blocked: 40**  
**Not yet tested: Live Take Over/Continue/Co-work timing, active cancellation, background/crash recovery, voice/wake, Remote PC and mobile/cross-platform surfaces**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 38**  
**Critical: 2 | Major: 21 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-039 — Pending completed results are written non-atomically and silently lost after corruption

**Severity:** Major  
**Evidence:** SOURCE-PROVEN, FOCUSED RECOVERY TEST  
**Release blocker:** Yes for dependable background work  
**Exact locations:** `jarvis-runtime/ocade_device.py:117-178`; `jarvis-runtime/tests/test_agent.py:103-122`  
**Functions/components:** `_load_pending`; `_keep_pending`; `Agent.run`; offline/restart result delivery.

**What is wrong:** `_keep_pending` writes the only durable copy of completed-but-unacknowledged results directly to `pending.json`. A crash, power loss, full disk or antivirus interruption can truncate/partially replace it. `_load_pending` catches every JSON/OS error and returns an empty list, silently converting corruption into acknowledged loss with no quarantine, retry or customer signal.

**Root cause:** The credential metadata adopted an atomic temp-file replacement pattern, but the equally important task-result journal still uses a single non-atomic JSON snapshot and treats malformed data as “no pending work.”

**Customer/security impact:** A real device action may physically complete while its result disappears after a crash. OCADE can leave the task running/failed, retry a non-idempotent action, or misreport state. Background and remote users cannot reliably determine what happened.

**Exact suggested fix:** Use an append-only or atomic journal keyed by immutable action id. Write/fsync a restrictive temporary record, atomically replace, and retain acknowledged/unacknowledged state until the server explicitly identifies accepted result ids. Quarantine malformed journals and expose `Needs recovery`; never return empty silently. Persist action start/completion/idempotency metadata and reconcile before retrying physical actions.

**Required regression tests:** Kill during write/replace/fsync; truncated/invalid JSON; disk full/read-only; two results; restart before/after server acknowledgement; duplicate exchange; stale/unknown id; non-idempotent action; quarantine/recovery UI; permissions and sensitive-data retention.

### Evidence and outcomes

- **PASS:** Existing focused test proves a valid completed result survives one lost exchange and is loaded after restart.
- **PASS:** Offline exchange errors retain current in-memory results and retry after three seconds.
- **PASS:** Idle worker uses a five-second dormant poll rather than a tight loop.
- **PASS:** Server revoke and incompatible protocol fail closed.
- **FAIL:** Pending-result persistence is non-atomic and corruption is silently treated as empty (JARVIS-039).
- **CARRY JARVIS-023:** Background STOP cannot interrupt an active action.
- **BLOCKED:** Real sleep/hibernate, Wi-Fi loss, power kill and crash-during-write require destructive clean-VM testing.

### Section 39 progress checkpoint

**Deep Audit Progress: Section 39/64 — Background execution, offline retry and durable recovery**  
**Completed sections: 39/64**  
**Checks executed: 585**  
**Passed: 415**  
**Failed: 128**  
**Blocked: 42**  
**Not yet tested: Sleep/hibernate and power-kill recovery, signed update rollback, voice/wake, Remote PC and mobile/cross-platform surfaces**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 39**  
**Critical: 2 | Major: 22 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-040 — Missing/mispackaged update executable crashes outside the health-failure rollback path

**Severity:** Major  
**Evidence:** REAL WINDOWS TEST SUITE FAILURE, SOURCE-PROVEN  
**Release blocker:** Yes with JARVIS-028  
**Exact locations:** `jarvis-runtime/ocade_update.py:74-116`; `jarvis-runtime/tests/test_update.py:1-94`; `jarvis-runtime/ocade_agent.py:214-225`  
**Functions/components:** `_executable`; `install`; packaged health gate; staged-file cleanup; update tests.

**Reproduction and evidence:** On Windows, `python -m unittest jarvis-runtime.tests.test_update` runs five tests; three error before their assertions. Test archives contain the portable `ocade-agent` fixture, while `_executable` requires `ocade-agent.exe`. `install()` calls `exe.chmod(0o755)` before its health-check `try`, raising an uncaught `FileNotFoundError`. The staged version and `download.zip` cleanup are not protected by a `finally` block.

**Root cause:** Archive structure/executable presence are assumed after ZIP extraction. Only process launch/timeout is converted to an unhealthy build; validation and filesystem preparation failures escape the rollback contract. Tests were authored with a POSIX-only fixture and never made platform-correct.

**Customer/security impact:** An owner-signed but incorrectly packaged Windows release can make update attempts repeatedly fail with leftover staging/download files instead of a clean refusal/rollback. The update regression suite is red on the primary Windows target, so rollback claims are not currently release evidence.

**Exact suggested fix:** Validate a signed platform manifest that includes the executable relative path and artifact layout; reject missing/non-file/duplicate executable before chmod. Wrap download, extraction, validation and health in transactional cleanup with a staging nonce. Convert expected filesystem/package failures to `UpdateRefused`, preserve current/previous layout, and make Windows/POSIX fixtures emit their actual executable name. Run tests on every supported OS/architecture.

**Required regression tests:** Missing/wrong/nested/duplicate executable; Windows `.exe`; POSIX executable bit; corrupt ZIP; traversal/backslash/reserved names; disk full/locked file; interrupted extraction; health exit/timeout/crash; cleanup; previous version preserved; two failed starts rollback; current layout atomicity; signed channel end-to-end.

### Evidence and outcomes

- **PASS:** Signature refusal without a configured key and archive traversal rejection tests passed.
- **PASS / SOURCE:** Ed25519 manifest verification, SHA-256 comparison and atomic `current.json` replacement are present.
- **FAIL:** Three of five updater tests error on Windows before verifying healthy install/unhealthy rejection/rollback (JARVIS-040).
- **FAIL:** Missing executable escapes the health-failure cleanup path and leaves staging artifacts (JARVIS-040).
- **CARRY JARVIS-028:** Production manifest, signature, archives, signing key and owner-signed installers are unpublished, so no live automatic update can run.
- **BLOCKED:** Real signed upgrade/downgrade/rollback across installed versions requires the owner release channel and clean VMs.

### Section 40 progress checkpoint

**Deep Audit Progress: Section 40/64 — Signed automatic updates and rollback**  
**Completed sections: 40/64**  
**Checks executed: 593**  
**Passed: 418**  
**Failed: 132**  
**Blocked: 43**  
**Not yet tested: Live signed release/update channel, voice/wake, Remote PC, PWA/mobile, Android, iOS/WebKit and macOS surfaces**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 40**  
**Critical: 2 | Major: 23 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-041 — Partial voice startup failures can leave the microphone stream active

**Severity:** Major  
**Evidence:** SOURCE-PROVEN; REAL MICROPHONE PROMPT BLOCKED  
**Release blocker:** Yes for voice  
**Exact locations:** `src/jarvis/use-voice.ts:95-167,186-223,225-288`; `src/jarvis/JarvisWorkspace.tsx:758-778`  
**Functions/components:** `useJarvisVoice.start`; `listen`; `end`; microphone stream/AudioContext lifecycle.

**What is wrong:** `start()` assigns the successful `getUserMedia` stream to `stream.current`, then creates/configures `AudioContext` inside the same `try`. If any later audio-context/analyser/source setup throws, the catch sets `Microphone access was refused` and returns without stopping the already acquired tracks or closing a partially created context. Separately, `listen()` catches a synchronous recognition `start()` failure and only clears its ref; `start()` still sets voice state to `listening` with the microphone stream active even though recognition never started.

**Root cause:** Resource acquisition is not transactional and recognition startup does not return success/failure to its caller.

**Customer/security impact:** Chrome's microphone indicator and live capture can persist while JARVIS reports an error or appears to be listening without transcription. This violates the expected “voice off means microphone released” boundary.

**Exact suggested fix:** Acquire media/audio/recognition into locals, and commit refs/state only after every required stage succeeds. On every failure, abort recognition, stop every track, close any context, clear refs/meter and set `off`. Make `listen()` return a result or throw a typed error. Add `track.onended`, page visibility/navigation and permission-revocation handling through the same idempotent cleanup.

**Required regression tests:** Permission deny; stream succeeds then AudioContext/analyser/source throws; recognizer constructor/start throws; no-speech; service denied; track ends; route/unmount; double start/end; pause/resume; TTS interrupt/end; verify all tracks `readyState=ended`, context closed and UI off after every failure.

### Evidence and outcomes

- **PASS / SOURCE:** Voice controls include Stop, Pause, Continue and End phrase recognition; leaving the page calls `end()`.
- **PASS / SOURCE:** Normal `end()` cancels synthesis, aborts recognition, stops tracks and closes the audio context.
- **PASS / SOURCE:** TTS is skipped while voice is off and response text is still visible.
- **FAIL:** Partial startup cleanup is incomplete (JARVIS-041).
- **BLOCKED:** Clicking Start voice in the real Chrome page focused the control but produced no page-state change; the browser-level microphone permission surface is not exposed to this Computer Use connection.
- **BLOCKED:** No real speech-recognition transcript or audible TTS proof was possible without the browser permission handoff/audio observation.
- **BLOCKED:** Spoken Stop/Pause/Continue/Cancel cannot be called passed from source inspection alone.

### Section 41 progress checkpoint

**Deep Audit Progress: Section 41/64 — Voice input, spoken response and interruption**  
**Completed sections: 41/64**  
**Checks executed: 601**  
**Passed: 421**  
**Failed: 134**  
**Blocked: 46**  
**Not yet tested: Real microphone/TTS after manual permission, wake word, Remote PC, PWA/mobile, Android, iOS/WebKit and macOS surfaces**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 41**  
**Critical: 2 | Major: 24 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-042 — One-click wake setup downloads a different phrase/model than the Device Agent requires

**Severity:** Major  
**Evidence:** SOURCE-PROVEN, FOCUSED UNIT TEST; REAL WAKE AUDIO BLOCKED  
**Release blocker:** Yes for advertised `Hey OCADE` wake  
**Exact locations:** `jarvis-runtime/ocade_wake.py:1-47`; `jarvis-runtime/core/wake_word.py:1-16,27-30,35-106,109-180`; `jarvis-runtime/ocade_agent.py:275-286`  
**Functions/components:** `ocade_wake.model_path`; `available`; `listen`; `wake_word.WAKE_MODEL`; `is_ready`; `install_and_download`; `_wake_while_background`.

**Reproduction and evidence:** The Device Agent requires the exact local file `<OCADE_JARVIS_HOME>/wake/hey_ocade.onnx` before it will start wake listening. The shipped setup helper instead installs/downloads openWakeWord's pretrained `hey_jarvis` model into the package resource directory and checks that donor model with `is_ready()`. It never creates, downloads, verifies or places `hey_ocade.onnx`. The module itself states that OCADE does not ship the required model. The focused wake test passed only the honest unavailable state and voice deep-link construction; no `Hey OCADE` audio could be detected because the required model does not exist.

**Root cause:** Donor `Hey Jarvis` setup code was retained while the OCADE wrapper changed the required phrase, filename and storage location. There is no single owned model manifest/install path connecting setup, availability and runtime.

**Customer/security impact:** Background/Wake Mode can be enabled yet can never hear `Hey OCADE` in a clean installation. A setup path may claim the donor wake model is ready while the agent continues to report the feature unavailable. Users cannot rely on hands-free launch, and support cannot distinguish an absent OCADE model from microphone/runtime failures.

**Exact suggested fix:** Choose and publish one reviewed `Hey OCADE` model artifact with version, SHA-256, license/provenance and supported runtime. Have the signed companion installer place it atomically at a platform-owned model path and record the version. Replace the donor `WAKE_MODEL` setup/check with one shared manifest resolver used by install, availability and detector startup. Do not download via ambient `pip` at runtime in a packaged companion. Surface explicit states (`not installed`, `downloading`, `ready`, `microphone denied`, `model load failed`) and keep wake opt-in.

**Required regression tests:** Clean install; missing/corrupt/wrong-hash/wrong-phrase model; upgrade/rollback; offline setup; microphone deny/revoke; Background/Wake off and on; exact `Hey OCADE` positive samples across accents/noise plus near-phrase negatives; repeated detection debounce; browser closed/open; deep-link authentication; uninstall removes model and releases microphone.

### Evidence and outcomes

- **PASS / SOURCE:** Wake is opt-in to Background/Wake Mode and the detector audio path is local; unavailable wake is not falsely simulated.
- **PASS / FOCUSED TEST:** With no OCADE model, `available()` returned false; `open_voice()` constructed the intended `/ocade-jarvis?voice=1` deep link.
- **FAIL:** The required `wake/hey_ocade.onnx` artifact is absent from the repository/package and has no signed distribution route (JARVIS-042).
- **FAIL:** `install_and_download()` installs/checks `hey_jarvis` in openWakeWord resources rather than the required OCADE model/path (JARVIS-042).
- **BLOCKED:** Real positive/negative `Hey OCADE` microphone samples cannot run without the model and browser/audio permission surface.
- **BLOCKED:** Closed-browser wake, audio-device change, sleep/wake and competing microphone-client recovery require a complete signed companion build on a clean test machine.
- **BLOCKED:** Accuracy, false acceptance/rejection and repeated-trigger debounce have no model corpus or acceptance thresholds.

### Section 42 progress checkpoint

**Deep Audit Progress: Section 42/64 — Hey OCADE wake behavior**  
**Completed sections: 42/64**  
**Checks executed: 608**  
**Passed: 423**  
**Failed: 136**  
**Blocked: 49**  
**Not yet tested: Remote PC, PWA/mobile, Android, iOS/WebKit, macOS, cross-platform protocol and final source-only audit**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 42**  
**Critical: 2 | Major: 25 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-043 — Remote PC cannot select the target computer and silently routes work to the most recently seen agent

**Severity:** Major  
**Evidence:** SOURCE-PROVEN, PRODUCTION DEVICE-STATE OBSERVATION  
**Release blocker:** Yes for multi-computer Remote PC  
**Exact locations:** `docs/APP_FLOW.md:127-133`; `docs/PRD.md:167-178`; `src/jarvis/JarvisPanels.tsx:342-390`; `src/jarvis/jarvis.functions.ts:249-325`; `src/jarvis/JarvisTask.tsx:133-205`  
**Functions/components:** `SectionPanel` Devices/Remote PC branch; `startJarvisTask`; `BrowserPanel`; task/device selection.

**What is wrong:** The documented flow says a mobile user selects a paired PC, then starts, observes, stops and controls that PC's task. The Remote PC panel only lists already-open tasks with `Open` and `Stop`; it offers no target selector or start control. `startJarvisTask` accepts only `where`, never a `deviceId`, and chooses `agents[0]` after sorting devices by latest `last_seen_at`. With two connected computers, ordinary polling/reconnect timing decides which machine receives a command.

**Root cause:** Remote observation/stop UI was added over the generic automatic device chooser, but explicit device identity was never carried from the UI through task creation and authorization.

**Customer/security impact:** A remote instruction can run on the wrong owned PC, against the wrong workspace/apps/signed-in sessions. The risk is highest for files, terminal, screen and mouse/keyboard actions. The feature cannot meet its documented paired-PC control contract.

**Exact suggested fix:** Add an explicit target-device selector populated only from the signed-in user's non-revoked, currently online agents. Pass `deviceId` through a dedicated Remote PC start request; on the server verify ownership, kind=`agent`, freshness, requested capability and per-device permission in the same operation that creates the task. Bind every subsequent control/resume/confirmation to the task's immutable `device_id`; show the selected PC name next to every confirmation and task control. If it goes offline, pause and require an explicit new-device migration rather than silently choosing another.

**Required regression tests:** Two/three online PCs with changing heartbeat order; explicit start on each target; stale/offline/revoked/wrong-account/extension ids; capability and permission mismatch; reconnect; simultaneous starts; no silent fallback; target name in confirmation/activity; remote Stop/Take Over/Continue; task remains bound across refresh and mobile minimization.

### Evidence and outcomes

- **PASS / SOURCE:** Device requests are signed per device and server exchange scopes claim/result/frame operations to the authenticated device id.
- **PASS / SOURCE:** Remote panel exposes task status, progress, device name/online state, Open and Stop.
- **PASS / SOURCE:** Live frames are RLS-scoped and returned only for unfinished tasks; finished-task database logic clears temporary frames.
- **PASS / PRODUCTION:** The connected and stale audit devices remained distinct, and worker reconnect did not create a duplicate pairing.
- **PASS / SOURCE:** Device revoke nulls its public key and stops its open tasks.
- **FAIL:** Remote PC has no explicit target selection/start flow despite the documented contract (JARVIS-043).
- **FAIL:** `startJarvisTask` routes computer work to the most recently seen agent, so multiple-PC targeting is nondeterministic (JARVIS-043).
- **BLOCKED:** Real mobile-to-PC start/observe/control proof requires a second signed-in mobile browser/hardware surface.
- **BLOCKED:** Multi-PC routing and controller races require at least two simultaneously connected agents.

### Section 43 progress checkpoint

**Deep Audit Progress: Section 43/64 — Remote PC pairing and command routing**  
**Completed sections: 43/64**  
**Checks executed: 617**  
**Passed: 428**  
**Failed: 138**  
**Blocked: 51**  
**Not yet tested: Remote observe/Stop/controller races, PWA/mobile, Android, iOS/WebKit, macOS, cross-platform protocol and final source-only audit**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 43**  
**Critical: 2 | Major: 26 | Medium: 11 | Small: 3 | Minor: 1**

### JARVIS-044 — Service-worker documentation still asserts that no install manifest exists

**Severity:** Minor  
**Evidence:** SOURCE-PROVEN, LIVE HTTP  
**Release blocker:** No  
**Exact locations:** `public/sw.js:39-55,97-116`; `public/manifest.webmanifest:1-18`; `src/routes/__root.tsx:93-102`  
**Functions/components:** `OPTIONAL_PRECACHE`; service-worker install commentary; root head links; PWA manifest.

**What is wrong:** The service worker states, “There is no manifest now: OCADE is a website and is never offered as an app to install,” while the root deliberately links `/manifest.webmanifest`, that live route returns `application/manifest+json`, and the manifest uses `display: standalone` with JARVIS as its start URL. The install catch also says a missing manifest should reject installation although the manifest is not in `REQUIRED_PRECACHE`.

**Root cause:** The product decision changed to web/PWA-first, but nearby service-worker rationale and invariant wording were not updated with the code.

**Customer/security impact:** Runtime behavior is currently intact, but maintainers may remove icons/manifest support or write the wrong offline/install test based on a false architectural comment.

**Exact suggested fix:** Update only the stale rationale to state the approved Add to Home Screen behavior. Decide whether the manifest is required for atomic service-worker installation; if yes, add it to required precache and test failure, otherwise remove the false catch comment. Keep install prompts absent if that remains the UX decision.

**Required regression tests:** Manifest linked from root; live content type; start URL/scope/icons; service-worker install with manifest available/missing according to the chosen invariant; offline launch from installed Android and iOS home screen; no custom install prompt.

### Evidence and outcomes

- **PASS / LIVE HTTP:** `/manifest.webmanifest`, `/sw.js` and `/ocade-jarvis` returned 200; manifest content type is `application/manifest+json`.
- **PASS / ARTIFACT:** Declared 192x192 and 512x512 icons match their real dimensions; Apple touch icon is 180x180.
- **PASS / SOURCE:** Manifest start URL is `/ocade-jarvis`, scope is `/`, display is standalone, and theme/background colors are defined.
- **PASS / SOURCE:** Root registers the versioned network-first service worker and links the manifest/touch icon.
- **PASS / SOURCE:** JARVIS has a mobile drawer, `h-dvh`, constrained panels and responsive desktop/mobile rail breakpoints.
- **FAIL:** Service-worker architecture comments contradict the current manifest/PWA implementation (JARVIS-044).
- **BLOCKED:** The existing personal Chrome was not launched with a remote-debugging port, so DevTools device emulation and installability inspection cannot be attached without restarting/modifying that browser session.
- **BLOCKED:** Home-screen installation, standalone relaunch, offline relaunch and orientation/keyboard behavior require Android/iOS hardware or an authorized disposable emulator.

### Section 45 progress checkpoint

**Deep Audit Progress: Section 45/64 — PWA manifest, installability and mobile layout**  
**Completed sections: 45/64**  
**Checks executed: 633**  
**Passed: 437**  
**Failed: 141**  
**Blocked: 55**  
**Not yet tested: Android-class browser/emulator behavior, iOS/WebKit, macOS companion, cross-platform protocol and final source-only audit**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 44**  
**Critical: 2 | Major: 26 | Medium: 11 | Small: 3 | Minor: 2**

### JARVIS-045 — Android-class Offline initialization reaches an unsafe WASM allocation and fails without a durable compatibility refusal

**Severity:** Medium  
**Evidence:** ANDROID-CLASS CHROME/EMULATOR REPRODUCTION, SOURCE-PROVEN; NOT REAL ANDROID HARDWARE  
**Release blocker:** Yes for claiming Offline support on Android-class devices; no for Online-only Remote PC  
**Exact locations:** `src/lib/brain/adapters/browser-wasm.ts:349-403,423-489`; `src/lib/brain/wasm-threads.ts:122-150`; `scripts/prove-offline-artifact.mjs:48-70`  
**Functions/components:** `BrowserWasmAdapter.loadParams`; `ensureLoaded`; `planThreads`; Offline WebAssembly runtime initialization.

**Reproduction and evidence:** Earlier testing in this same current-main audit on an Android-class Chrome/emulator reached Offline engine initialization and produced both `Cannot allocate WebAssembly.Memory` and `Cannot convert a BigInt value to a number`. The source chooses smaller context/thread counts from user-agent/device-memory hints, but it does not preflight the actual model/runtime allocation or convert load failure into a durable device-specific unavailable state. The standalone proof script uses a BigInt Memory64 constructor probe that itself is not evidence that a phone can allocate the model runtime. This evidence is emulator/browser-class evidence and is not promoted to real Android hardware proof.

**Root cause:** Compatibility is inferred from WebAssembly presence, reported memory/cores and thread planning. The model is then loaded in one large operation without a bounded allocation probe, release-specific minimum-memory contract or mobile-safe failure state/cleanup path.

**Customer/security impact:** A user can download a large Offline artifact, then encounter a tab crash or opaque initialization error on a low-memory Android device. Auto may repeatedly retry an impossible local path, wasting storage, battery and usage time instead of routing safely Online.

**Exact suggested fix:** Publish tested minimum memory/browser requirements per Offline release. Before download and activation, run a small bounded allocation/runtime preflight representative of required features without allocating the full model. Apply conservative phone context/thread ceilings. Catch load/allocation failures, dispose partial worker/WASM state, persist a release+device scoped `unavailable` reason, and let Auto select Online without repeated local retries. Offer an explicit Retry after browser/OS/release changes.

**Required regression tests:** Android Chrome on 2/4/6/8 GB real devices; low-memory pressure; emulator; 32/64-bit; Memory64 absent/present; BigInt constructor variance; threaded/single-threaded; allocation/load failure cleanup; no redownload loop; Auto fallback; Offline mode truthful refusal; tab background/restore; PWA standalone; release upgrade clears compatible stale refusal only.

### Evidence and outcomes

- **PASS / SOURCE:** Android/iOS are represented as web/PWA surfaces, and the docs avoid claiming arbitrary mobile OS-wide control.
- **PASS / SOURCE:** Thread planning caps mobile at four threads and low-memory devices at two/four threads.
- **FAIL / ANDROID-CLASS EMULATION:** Offline initialization failed with `Cannot allocate WebAssembly.Memory` and `Cannot convert a BigInt value to a number` (JARVIS-045).
- **FAIL / SOURCE:** No allocation preflight, durable incompatible-device state or guaranteed partial-engine cleanup protects the load boundary (JARVIS-045).
- **BLOCKED:** Real Android hardware, Add to Home Screen, standalone/offline relaunch, microphone/TTS and background/minimize behavior remain untested.
- **BLOCKED:** Mobile-to-PC execution remains blocked by missing explicit PC selection (JARVIS-043) and lack of a second real signed-in mobile surface.

### Section 46 progress checkpoint

**Deep Audit Progress: Section 46/64 — Android-class Chrome, PWA and Offline behavior**  
**Completed sections: 46/64**  
**Checks executed: 639**  
**Passed: 439**  
**Failed: 143**  
**Blocked: 57**  
**Not yet tested: iPhone/iPad WebKit and home-screen lifecycle, macOS companion/control, cross-platform protocol and final source-only audit**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 45**  
**Critical: 2 | Major: 26 | Medium: 12 | Small: 3 | Minor: 2**

### JARVIS-046 — macOS bundle omits required privacy descriptions and has no TCC permission readiness flow

**Severity:** Major  
**Evidence:** SOURCE-PROVEN; REAL macOS BLOCKED  
**Release blocker:** Yes for macOS screen/input/voice release  
**Exact locations:** `jarvis-runtime/packaging/macos/build.sh:18-42`; `jarvis-runtime/packaging/macos/entitlements.plist:1-8`; `jarvis-runtime/ocade_agent.py:61-94`; `jarvis-runtime/ocade_wake.py:34-47`; `jarvis-runtime/ocade_computer.py:145-168`; `jarvis-runtime/actions/computer_control.py:158-253`  
**Functions/components:** generated `Info.plist`; hardened runtime entitlements; LaunchAgent install; local wake microphone; PyAutoGUI screen/input path.

**What is wrong:** The generated app bundle declares only `NSAppleEventsUsageDescription`. The product uses microphone input for wake/voice and screen/input automation that depends on macOS TCC permissions, yet the bundle has no microphone usage description and no first-run readiness/onboarding that detects and guides Microphone, Accessibility, Screen Recording and Automation authorization. Capabilities are inferred from import availability rather than granted TCC state.

**Root cause:** Packaging signs/notarizes the Python bundle, but platform privacy permissions were treated as runtime library concerns instead of part of the macOS product lifecycle and capability contract.

**Customer/security impact:** A clean notarized install can deny or terminate microphone access, return blank screenshots, or fail mouse/keyboard/Apple Events while OCADE still advertises the capability. Users receive fragmented System Settings prompts with no explanation/recovery, and the server can route work to a Mac that cannot execute it.

**Exact suggested fix:** Add accurate purpose strings for every accessed protected resource, beginning with `NSMicrophoneUsageDescription` and camera only if camera remains exposed. Build a signed first-run permission assistant that checks TCC readiness without triggering unrelated prompts, requests each permission only when its feature is enabled, opens the precise Privacy & Security pane on request, and reports capability=false until verified by a harmless functional probe. Keep Apple Events targets narrow; document reauthorization after bundle identity/path change. Publish only after Developer ID signing, notarization, stapling and Gatekeeper assessment pass.

**Required regression tests:** Clean current/supported macOS versions; standard account; deny/allow/revoke each Microphone, Accessibility, Screen Recording and Automation permission; restart/update/path change; blank-screen detection; input no-op detection; wake off/on; app launch Apple Event; LaunchAgent login; uninstall cleanup; signature/notarization/staple/Gatekeeper; no capability advertised before proof.

### Evidence and outcomes

- **PASS / SOURCE:** Build script fails closed without version, Developer ID identity and notary profile; it signs hardened runtime, waits for notarization, staples and produces a final ZIP.
- **PASS / SOURCE:** App is an `LSUIElement` menu-bar style companion and LaunchAgent startup is per-user.
- **FAIL:** `Info.plist` lacks a microphone usage description despite local wake microphone capture (JARVIS-046).
- **FAIL:** No TCC permission readiness/onboarding connects actual macOS grants to advertised capabilities (JARVIS-046).
- **FAIL / CARRY JARVIS-028:** No public signed/notarized macOS artifact or signed update channel is published.
- **BLOCKED:** No macOS hardware/VM, Developer ID identity or notarization profile was available.
- **BLOCKED:** Real Safari/Chrome CDP, app launch, screen capture, mouse/keyboard, voice/wake, tray/menu-bar, autostart, update/rollback and uninstall are untested on macOS.
- **BLOCKED:** Universal/architecture coverage and dependency native-wheel compatibility were not build-proven on Intel and Apple silicon.

### Section 48 progress checkpoint

**Deep Audit Progress: Section 48/64 — macOS companion, permissions, signing and control**  
**Completed sections: 48/64**  
**Checks executed: 654**  
**Passed: 444**  
**Failed: 146**  
**Blocked: 64**  
**Not yet tested: protocol compatibility/version skew, authentication/revoke abuse, performance/load, full hidden-bug and source-only architecture passes, Ponytail and final deliverables**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 46**  
**Critical: 2 | Major: 27 | Medium: 12 | Small: 3 | Minor: 2**

### JARVIS-047 — Clients do not validate response protocol and cannot recover cleanly from forward-version skew

**Severity:** Medium  
**Evidence:** SOURCE-PROVEN, FOCUSED UNIT TEST  
**Release blocker:** Yes before protocol version 2 rollout  
**Exact locations:** `jarvis-runtime/ocade_protocol.json:1-24`; `src/jarvis/device.server.ts:83-107,318-392`; `jarvis-runtime/ocade_identity.py:122-151,181-201`; `jarvis-runtime/ocade_device.py:131-178`; `extension/background.js:75-106,505-551`; `src/jarvis/__tests__/device-protocol.test.ts:1-140`  
**Functions/components:** `readSigned`; `exchange`; `Identity.post`; `Identity.exchange`; extension `post`/`poll`; protocol version negotiation.

**What is wrong:** The server rejects client versions below `minimumVersion` and above `version`, but both execution clients accept a 200 response without checking `reply.protocol`. The Python agent validates only `deviceId`; the extension also validates only `deviceId`. A future server that supports multiple request versions always serializes the current response shape rather than a response for the request version. A newer client receiving `unknown_protocol` (400) is not given a terminal/update state: Python treats it as a retryable network error and the extension exits the poll without a diagnostic state.

**Root cause:** Versioning was added to signed request headers, but no explicit negotiated response contract or compatibility adapter was implemented. Tests cover old request refusal, stale clocks and signatures only for version 1.

**Customer/security impact:** A rolling deployment can strand agents in silent retry/offline loops or let an old client process commands whose response semantics it does not understand. This can produce incorrect status, duplicate/replayed physical work, or unsafe interpretation during protocol evolution.

**Exact suggested fix:** Negotiate one response version per request. Return it in the authenticated envelope and require both clients to equal the requested/supported version before reading commands. Implement explicit per-version request/response codecs while more than one version is accepted. Map `update_required` and `unknown_protocol` to distinct terminal UI states; an ahead client must stop with `server_too_old`, never retry blindly. Roll out server support first, then clients, then raise `minimumVersion`. Bind protocol response semantics to signed/HTTPS server tests and publish compatibility matrices.

**Required regression tests:** Client below minimum; client at minimum/current; client above current; malformed/non-integer version; response missing/wrong version; rolling v1/v2 server/client combinations; old/new command field; update unavailable; retry storm/backoff; no command execution before version validation; extension and Python parity.

### Evidence and outcomes

- **PASS / SOURCE:** Request signatures bind protocol, method, path, device, timestamp and body digest.
- **PASS / SOURCE:** Server rejects below-minimum, above-current, stale-clock and replayed requests.
- **PASS / FOCUSED TEST:** Twelve Device Agent tests passed; one unrelated requested module name was absent and one display-dependent test skipped.
- **FAIL:** Python and extension do not validate the response protocol before processing commands (JARVIS-047).
- **FAIL:** `unknown_protocol` has no actionable client state and can become silent exit/retry behavior (JARVIS-047).
- **BLOCKED:** Real rolling deployment across v1/v2 cannot be tested because only protocol v1 exists and no signed release channel is published.
- **BLOCKED:** TypeScript protocol tests could not run in this checkout because project dependencies/Vitest are not installed; source cases were inspected instead.

### Section 49 progress checkpoint

**Deep Audit Progress: Section 49/64 — Protocol compatibility, downgrade and version skew**  
**Completed sections: 49/64**  
**Checks executed: 661**  
**Passed: 447**  
**Failed: 148**  
**Blocked: 66**  
**Not yet tested: authentication/revoke/key-rotation abuse, performance/load, full hidden-bug and source-only architecture passes, Ponytail and final deliverables**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 47**  
**Critical: 2 | Major: 27 | Medium: 13 | Small: 3 | Minor: 2**

### JARVIS-048 — Every active-task tab repeatedly reloads the entire JARVIS account state and runs maintenance

**Severity:** Medium  
**Evidence:** SOURCE-PROVEN; PRODUCTION LOAD TEST BLOCKED  
**Release blocker:** No for a small pilot; yes before scale  
**Exact locations:** `src/jarvis/JarvisWorkspace.tsx:103-114`; `src/jarvis/jarvis.functions.ts:110-180`; `src/jarvis/JarvisTask.tsx:148-162`; `src/jarvis/jarvis.functions.ts:762-773`  
**Functions/components:** JARVIS state React Query; `readJarvisState`; `jarvis_purge_expired_activity`; `BrowserPanel` live-frame polling; `readJarvisFrame`.

**What is wrong:** While one task is active, every open JARVIS tab calls `readJarvisState` every 2.5 seconds. Each call runs a purge RPC and six database queries that may return up to 1,250 rows, including conversations, all recent tasks, devices, 500 permissions, 200 memories and 200 Activity rows. An expanded live view independently fetches a base64 frame every 1.5 seconds. Multiple observer/controller tabs multiply the same account-wide reads and maintenance writes.

**Root cause:** One broad page-bootstrap query doubles as task liveness synchronization. Task status, Activity, device presence, permissions, graph/history and maintenance have no separate refresh ownership or push/delta channel.

**Customer/security impact:** Active work generates high serverless/database request volume, repeated serialization of private history/memory/action data and large frame transfers even when only task status changed. Many tabs/users can cause avoidable Supabase/Worker load, latency, egress and rate-limit failures; the purge RPC becomes a hot write path.

**Exact suggested fix:** Split immutable/slow account configuration from live task state. Subscribe or poll only the active task, newest Activity cursor and selected device presence; use Supabase Realtime or one bounded event endpoint with backoff/visibility awareness. Refresh conversations/memories/permissions only after their mutations. Move purge to scheduled database maintenance or rate-limit it per account, never every UI poll. Serve live frames through short-lived object storage or a bounded stream keyed by task/frame sequence, stop when hidden/collapsed, and send only changed frames.

**Required regression tests:** One/ten tabs; foreground/background/hidden; active/idle tasks; 1/100/1,000 account rows; query count and bytes/minute budgets; slow network; frame unchanged/changed; reconnect backoff/jitter; purge concurrency; database locks; Realtime disconnect fallback; RLS isolation; no stale Stop/confirmation state.

### Evidence and outcomes

- **PASS / SOURCE:** Device Agent backs off to five seconds while dormant and one second only when a task is busy; extension avoids overlapping `poll()` loops.
- **PASS / SOURCE:** Protocol body, result count, frame size, app count and action text have explicit upper bounds.
- **PASS / SOURCE:** Temporary live frames are cleared when tasks become terminal and frames are requested only while the panel is expanded.
- **PASS / SOURCE:** Orb animation is cancelled on cleanup and honors the existing reduced-motion path.
- **FAIL:** Active-task tabs reload the full account state and run purge maintenance every 2.5 seconds (JARVIS-048).
- **FAIL:** Live-frame polling is an additional 1.5-second base64 database/server-function path without visibility/change sequencing (JARVIS-048).
- **BLOCKED:** Production concurrency/load tests were not run against customer infrastructure under the strict no-infrastructure/no-disruption boundary.
- **BLOCKED:** Browser performance traces on mobile, low-memory hardware and a real multi-tab Remote PC session remain unavailable.

### Section 51 progress checkpoint

**Deep Audit Progress: Section 51/64 — Performance, load and resource exhaustion**  
**Completed sections: 51/64**  
**Checks executed: 678**  
**Passed: 458**  
**Failed: 151**  
**Blocked: 69**  
**Not yet tested: security headers/API abuse and privacy retention, hidden-bug pass, separate source-only architecture audit, Ponytail and final deliverables**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 48**  
**Critical: 2 | Major: 27 | Medium: 14 | Small: 3 | Minor: 2**

### JARVIS-049 — Public device enrollment has no visible application-level abuse limit

**Severity:** Major  
**Evidence:** LIVE HTTP, SOURCE-PROVEN; CLOUDFLARE ACCOUNT RULES NOT AVAILABLE  
**Release blocker:** Yes before publishing installers/extension broadly  
**Exact locations:** `src/routes/api/jarvis/enroll.ts:1-19`; `src/jarvis/device.server.ts:83-191`; `supabase/migrations/20260927090000_jarvis_device_identity.sql:33-76`  
**Functions/components:** public `/api/jarvis/enroll` POST; `readSigned`; `verifySignature`; `enroll`; pending `jarvis_devices` rows.

**What is wrong:** Enrollment must be reachable before account ownership, but no source-visible per-IP/device-key/origin rate limit or bounded enrollment quota protects it. Any caller can generate valid P-256 keys/signatures and repeatedly force WebCrypto verification, expired-row cleanup and service-role inserts of ten-minute pending rows. The 600,000-character body cap limits one request, not request frequency or pending-row cardinality.

**Root cause:** Cryptographic proof of key possession was treated as abuse resistance. It proves the requester owns a disposable key but imposes negligible cost and no account/IP/reputation budget.

**Customer/security impact:** Automated enrollment can consume Worker CPU, Supabase writes/storage/IO and pending-device index capacity, raising cost or denying legitimate companion pairing. It can also create approval-link phishing volume if combined with social engineering.

**Exact suggested fix:** Add an edge-enforced rate limit before application/database work using IP/network reputation plus a keyed hash of public key, with conservative burst and sustained budgets. Add a database cap/unique lifecycle for live pending enrollments and scheduled expiry cleanup independent of new enrollments. Keep error bodies generic and emit aggregate abuse telemetry without storing raw keys/IP longer than required. Document the exact Cloudflare rule/configuration as deployable code and prove it in staging.

**Required regression tests:** Burst/sustained enrollments from one/many IPs and keys; valid companion retry behind NAT; IPv6 rotation; body limit; expired cleanup without new traffic; pending-row cap; concurrent duplicate key; Cloudflare bypass/origin access; 429 retry headers; no legitimate approval lockout; alert/cost budget.

### JARVIS-050 — Unsupported GET requests to device API routes fall through to an HTML 200 response

**Severity:** Small  
**Evidence:** LIVE HTTP, SOURCE-PROVEN  
**Release blocker:** No  
**Exact locations:** `src/routes/api/jarvis/enroll.ts:7-19`; `src/routes/api/jarvis/device.ts:15-34`; route framework fallback for `/api/jarvis/*`  
**Functions/components:** API route method handling and public response headers.

**What is wrong:** Live GET requests to both `/api/jarvis/enroll` and `/api/jarvis/device` returned the application HTML with status 200 and no `Cache-Control`, instead of a JSON `405 Method Not Allowed`/`Allow: POST`. Only POST is declared in source, so unsupported methods fall into the SSR document route.

**Root cause:** API routes define the allowed handler but no explicit method fallback at the edge/router boundary.

**Customer/security impact:** Monitoring and clients can mistake the API for healthy JSON, intermediaries may cache the HTML response under an API path, and scanners receive a much larger application document. It complicates incident diagnosis and weakens a clean API contract.

**Exact suggested fix:** Add a shared API method boundary that returns small JSON `405`, `Allow: POST`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` for every unsupported method, and `404` JSON for unknown API paths. Ensure SSR fallback never handles `/api/`.

**Required regression tests:** GET/HEAD/PUT/PATCH/DELETE/OPTIONS on both routes; content type/body/status/Allow/no-store; POST unchanged; CDN cache key; unknown `/api/jarvis/*`; browser navigation; no HTML fallback.

### Evidence and outcomes

- **PASS / LIVE:** HTTPS JARVIS returned HSTS, CSP, COOP, COEP, CORP, nosniff, strict-origin referrer policy and a restrictive Permissions Policy.
- **PASS / LIVE:** Plain HTTP JARVIS returned 301 to the exact HTTPS path.
- **PASS / SOURCE:** Device POST responses use JSON and `Cache-Control: no-store`; request bodies, frames, result arrays and values are size-bounded.
- **PASS / SOURCE:** Device/activity/task tables use RLS/grant boundaries; Activity is purged at 90 days and terminal tasks clear live frames.
- **PASS / SOURCE:** Customer Activity omits raw action payloads when returned to the panel.
- **FAIL:** Public enrollment has no source-visible application rate/quota defense (JARVIS-049).
- **FAIL / LIVE:** GET to both device API paths returned HTML 200 without no-store (JARVIS-050).
- **FAIL / CARRY JARVIS-048:** Purge/retention maintenance executes on frequent page-state reads rather than owned scheduled maintenance.
- **BLOCKED:** Cloudflare dashboard WAF/rate-limit configuration and Supabase production advisor telemetry were not exposed to this tool session, so an external rule cannot be credited as present or absent.

### Section 52 progress checkpoint

**Deep Audit Progress: Section 52/64 — Security headers, API abuse and privacy retention**  
**Completed sections: 52/64**  
**Checks executed: 687**  
**Passed: 463**  
**Failed: 154**  
**Blocked: 70**  
**Not yet tested: final hidden/missed/leftover bug pass, separate full source-only architecture/security audit, donor capability reconciliation, Ponytail and final deliverables**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 2**  
**Running total findings: 50**  
**Critical: 2 | Major: 28 | Medium: 14 | Small: 4 | Minor: 2**

### JARVIS-051 — Predictable workspace temporary filename permits a symlink write outside the authorized workspace

**Severity:** Critical  
**Evidence:** REAL WINDOWS DISPOSABLE FILESYSTEM REPRODUCTION, SOURCE-PROVEN  
**Release blocker:** Yes  
**Exact locations:** `jarvis-runtime/ocade_computer.py:203-234`; protocol entry at `src/jarvis/protocol.ts:80-91`; dispatch at `jarvis-runtime/ocade_computer.py:164-169`  
**Functions/components:** `Computer._inside`; `Computer._file` `file_write`; predictable `.<name>.ocade-tmp`; `os.replace`.

**Reproduction and evidence:** In a disposable authorized workspace, the audit created `.victim.txt.ocade-tmp` as a symbolic link to `outside.txt` located outside that workspace, then invoked the real `Computer.run({action:'file_write', path:'victim.txt', content:'ESCAPED'})`. JARVIS returned `done` / `Wrote victim.txt`. The outside file changed from `SAFE` to `ESCAPED`, and the resulting workspace `victim.txt` remained a symlink resolving to the outside file. Evidence directory: `audit-state/ocade-symlink-proof-6sgdtib5/`.

**What is wrong:** The destination path is resolved and checked, but the temporary file uses a predictable attacker-precreatable name. `Path.write_text()` follows an existing symlink before `os.replace()` runs. The later parent recheck does not validate the temp entry and cannot undo the outside write.

**Root cause:** Path containment was checked as a string/path-resolution property before opening, while filesystem object identity can change and the temporary name is not securely created. The code lacks no-follow/open-handle semantics.

**Customer/security impact:** Any local process, repository checkout, downloaded archive or malicious project that can place the predictable symlink inside the selected workspace can make an authorized JARVIS file write overwrite an arbitrary file accessible to the user outside the workspace. The workspace security boundary is therefore bypassable even without terminal access.

**Exact suggested fix:** Replace predictable `write_text` with exclusive secure temporary creation in the already validated parent (`os.open` with `O_CREAT|O_EXCL|O_NOFOLLOW` where available, random name, restrictive mode), write/fsync through the returned descriptor, revalidate parent/destination identities, then atomically replace. On Windows use handle-based reparse-point checks and refuse any reparse point in the traversed parent/destination/temp chain. Never follow a pre-existing temp entry; retry a fresh random name. For stronger assurance, move all workspace operations to a small handle-relative filesystem authority and test junctions as well as symlinks.

**Required regression tests:** Precreated temp symlink/junction/hardlink; destination symlink; parent swapped before open/replace; concurrent writers; crash before/after fsync/replace; Windows reparse points; POSIX `O_NOFOLLOW`; network filesystems; permissions; outside sentinel unchanged; atomic valid overwrite retained.

### Evidence and outcomes

- **PASS:** Existing `_inside` rejects ordinary absolute and resolved traversal paths outside the chosen workspace.
- **PASS:** Existing destination symlinks resolve outside and are refused during the initial containment check.
- **PASS:** Workspace-root deletion is refused and permanent deletion still requires server confirmation.
- **PASS:** Read payload and command output sizes are bounded.
- **PASS:** Disposable proof touched only audit-state files and did not alter product source/configuration/infrastructure.
- **FAIL / REAL WINDOWS:** Precreated predictable temp symlink caused a verified outside-workspace overwrite while JARVIS reported success (JARVIS-051).
- **BLOCKED:** Windows junction/parent-swap and POSIX `O_NOFOLLOW` variants require dedicated isolated OS fixtures.
- **BLOCKED:** Concurrent hostile-process timing across every file action was not exhaustively fuzzed after the critical primitive was proven.

### Section 53 progress checkpoint

**Deep Audit Progress: Section 53/64 — Final hidden, missed and leftover runtime bug pass**  
**Completed sections: 53/64**  
**Checks executed: 695**  
**Passed: 468**  
**Failed: 155**  
**Blocked: 72**  
**Not yet tested: separate full source-only architecture/security audit, donor capability reconciliation, dead/duplicate-code inventory, Ponytail and final deliverables**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 51**  
**Critical: 3 | Major: 28 | Medium: 14 | Small: 4 | Minor: 2**

### JARVIS-052 — The supported source setup installs the retired donor stack and broad privileged dependencies

**Severity:** Medium  
**Evidence:** SOURCE-PROVEN  
**Release blocker:** Yes for a supported source-install path; superseded by a minimal signed companion installer for customers  
**Exact locations:** `jarvis-runtime/setup.py:55-76`; `jarvis-runtime/requirements.txt:8-66`; `jarvis-runtime/README.md:9-16,43-51`; active imports in `jarvis-runtime/ocade_agent.py:31-33,230-237` and `jarvis-runtime/ocade_device.py:36-38,66-88`; dormant donor trees `jarvis-runtime/actions/*.py`, `jarvis-runtime/core/*.py`, `jarvis-runtime/dashboard/**`, and `jarvis-runtime/memory/**`  
**Functions/components:** source setup `main`; pip requirements installation; Playwright browser installation; active companion import graph; preserved donor action/plugin/dashboard stack.

**What is wrong:** The documented `python setup.py` path installs every package in the broad donor-era `requirements.txt` and downloads both Chromium and Firefox. The active paired companion imports only the narrow device identity, browser, computer, updater, tray, wake and mini-control surfaces. The README simultaneously says the generic action modules, FastAPI dashboard, plugins, document/media tooling and provider-bound features are preserved and unreachable. Nevertheless the default setup installs their FastAPI/Uvicorn, Google OAuth, Tuya, MQTT, document/media, GPU, Windows automation and other dependencies. The action directory alone contains about 10,637 lines and 387 KB of source; the core/dashboard/memory tree adds about 291 KB. Several dormant modules retain direct `exec`, `shell=True`, provider-key adapters and local-dashboard token logic. They are outside the active `Agent` dispatch but enlarge source installations and the dependency/supply-chain surface.

**Evidence:** `setup.main` unconditionally runs pip against `requirements.txt` and then `playwright install chromium firefox`. `ocade_device.Agent` dispatches only `Browsers` and `Computer`; `ocade_agent` imports the same active runtime plus update/wake/tray code. `core.action_loader.discover_actions` is not called by either active entry point. The README explicitly classifies the larger donor modules as preserved and not wired. Static inventory found 20 action modules; multiple dormant modules import Google/provider helpers, FastAPI dashboard support and optional hardware/media packages that the current web-authority design does not execute.

**Root cause:** The donor tree was copied into the working runtime for provenance and future reference, while the installer and requirements file remained organized around the retired monolithic local JARVIS. A minimal dependency manifest was not made the sole authority for the paired companion.

**Customer/security impact:** Source users download a large, slow, failure-prone environment and grant execution to many unnecessary transitive packages. Install failures in an unused package can block the working companion. More code and dependencies increase vulnerability, licensing, SBOM, update and support burden. Dormant privileged modules can later be wired accidentally without passing the current protocol and permission boundary.

**Exact suggested fix:**
1. Derive one minimal runtime dependency lock from the actual `ocade_agent.py -> ocade_device.py -> {ocade_identity, ocade_computer, browser_control, ocade_update, ocade_mini, ocade_wake}` import graph.
2. Make the signed packaged companion the only customer installation path; keep a small developer setup that installs the same locked runtime set plus a separate build/test extra.
3. Move the unchanged donor tree out of `jarvis-runtime/` into the already existing immutable `imports/ocade-jarvis/source-original/` authority. Delete the duplicate dormant copies only after a path/hash comparison proves nothing unique is lost.
4. Retain and connect only reviewed capabilities through `Computer`, `Browsers` or another single protocol executor. Do not revive `ActionLoader`, the local provider client or the FastAPI phone dashboard.
5. Install one browser engine only when isolated browser control is enabled. The extension/CDP path must not trigger a redundant Playwright browser download.
6. Generate an SBOM and license inventory from the minimal locked release environment and fail packaging when an undeclared import or surplus package appears.

**What to reuse:** The current signed device protocol, `Computer`, `Browsers`, `Identity`, updater transaction design, tray lifecycle and immutable donor import folder.  
**What to reroute/connect:** Any donor capability accepted for production must be expressed as a bounded typed action behind the existing server permission/confirmation protocol. Mobile control remains the OCADE web/PWA surface routed to a paired computer.  
**What to delete later:** Duplicate dormant `jarvis-runtime/actions` modules other than active `browser_control.py` and `ocade_page.js`; unused `core`, `dashboard`, `memory` and provider/plugin code; their exclusive dependencies; source-setup instructions for customers. Deletion requires a donor/current uniqueness manifest first.  
**Required regression tests:** Clean locked install on Windows/macOS/Linux; import-graph allowlist; package/SBOM allowlist; no provider SDK/key prompt; isolated Playwright first use and failure; extension-only install without browser download; tray/wake/PC/browser capabilities; package build; signed update/rollback; dependency CVE/license gate; donor uniqueness/hash check.  

### Architecture/security review outcomes

- **PASS / SOURCE:** The active device loop has one signed network authority and does not call a provider SDK.
- **PASS / SOURCE:** Active command dispatch is substantially smaller than the copied donor action registry and routes through `Browsers` or `Computer`.
- **PASS / SOURCE:** Extension and Device Agent share protocol/page-semantics artifacts.
- **PASS / SOURCE:** Update verification is fail-closed while no release public key is configured.
- **FAIL:** Default source setup installs dependencies for explicitly unreachable legacy modules (JARVIS-052).
- **FAIL / CARRY:** Windows terminal isolation, cancellation, response-version validation, temporary-file safety and update packaging remain release/security blockers already recorded.
- **BLOCKED:** A dependency reachability/SBOM gate is absent, so exact transitive package reduction and vulnerability delta cannot be release-proven from repository source alone.
- **BLOCKED:** macOS/Linux packaging and native permission behavior remain source evidence only.

### Section 54 progress checkpoint

**Deep Audit Progress: Section 54/64 — Separate full source-only architecture and security audit**  
**Completed sections: 54/64**  
**Checks executed: 713**  
**Passed: 477**  
**Failed: 159**  
**Blocked: 77**  
**Not yet tested: donor/current capability reconciliation, dead/duplicate-code inventory, cross-platform packaging-source review, Ponytail and final deliverables**  
**Real AI generations used: 36**  
**Current account usage remaining: 22/28**  
**New findings this section: 1**  
**Running total findings: 52**  
**Critical: 3 | Major: 28 | Medium: 15 | Small: 4 | Minor: 2**

## Final implementation rule

Do not close a finding from source inspection alone when it concerns customer hardware, browser state, security boundary, distribution or recovery. Reproduce the original failure, implement at the narrowest shared authority, run its regression proof, then repeat the real environment test and record the deployed artifact/SHA.

## Post-audit execution note — 2026-09-28

The historical evidence, counters, reproductions, and conclusions above remain preserved as audit evidence. Current implementation work must reproduce applicable findings on the latest main and must follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md` for MCP coordination, durable checkpoints, fix/retest loops, real-device evidence, context/rate-limit recovery, visual verification, cleanup regression, and release gating. This note does not convert historical blocked evidence into a pass and does not change the original audit counters.
