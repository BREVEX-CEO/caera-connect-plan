# OCADE Architecture

Architecture authority, revised 9 October 2026. [Current JARVIS implementation plan](../plan.md) owns new-engine P00–P22 execution and evidence gates; [Testing](TESTING.md) owns release methods. This document owns runtime boundaries, execution contracts, platform behaviour and failure semantics. Requirements below are targets unless labelled current; documentation does not implement or verify them. **30 October 2026 correction:** paths below referring to retired JARVIS planner, desktop agent, Android code or API routes describe historical ownership, not files currently present. Inspect the live branch and follow `plan.md` Sections 21–29 for new-engine code boundaries.

## 1. Protected boundaries and existing owners

CARCC is the company; OCADE is the product. Keep Chat and OCADE JARVIS separate. Chat retains Auto, Online and Offline Intelligence, including the approximately 0.6B model. JARVIS is Online-only at `/ocade-jarvis`: unavailable approved capacity produces a truthful unavailable/waiting state with checkpoints preserved, never a silent switch to Chat's offline model.

The customer starts at `ocade.in`. A signed companion supplies capabilities outside ordinary website permissions. One account, device list, task history and permission model spans website/PWA, desktop tray and Android bubble. Customers do not need a browser extension or developer MCP servers.

| Boundary                   | Existing owner                                                                                  | Responsibility                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Website/PWA                | React/TypeScript under `src/`                                                                   | Conversation, task controls, permissions, device selection, progress and results                |
| JARVIS planning            | `src/jarvis/agent.ts`, `live-deps.ts`, `background.server.ts`, `background-model.server.ts`     | Online planning, bounded decisions, interjections and recovery                                  |
| Task/action authority      | `src/jarvis/task-authority.server.ts`, `jarvis.functions.ts`, `device.server.ts`, `protocol.ts` | Identity, ownership, capabilities, consent, dispatch and settlement                             |
| Desktop execution          | `jarvis-runtime/ocade_device.py`, `ocade_computer.py` and existing adapters                     | Local admission, execution, interruption, observations, evidence and recovery                   |
| Android execution          | `android/src/in/ocade/app/AgentService.java`, `Control.java`, `Identity.java`                   | Legitimate mobile capabilities, local cancellation, signed exchange and permission lifecycle    |
| Durable account data       | Supabase                                                                                        | Identity/RLS, conversations, tasks/activity, permissions, usage, roles, staff audit and support |
| Web delivery/control plane | Existing Cloudflare deployment                                                                  | Authenticated server runtime, assets, release identity and existing storage boundaries          |

Extend these owners. Do not add a parallel agent framework, task database, desktop chat product, generic customer plugin system or controller per application. Python stays outside React `src/`. A narrow independently testable verifier is useful; another planner disguised as a verifier is not.

The privileged console stays at `/admin` inside the normal site, visible only to authorised identities. Retired `admin.ocade.in` and historical role/task systems must not return. Authorisation uses stable UUIDs, server checks and RLS, never frontend email comparisons. Retain assurance, reason and append-only audit for privileged mutations.

## 2. Source baseline and mandatory corrections

Baseline: `f521e23529542d709a9627181341b0e904a8b0c3`. Source review proves implementation shape, not physical-device, hosted-provider, installed-release or performance success. The following are source-traced failure paths, not executed reproductions during the documentation mission.

| Current behaviour                                                                                                      | Decision                                                                                                                                                      | Source and required regression                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A sequence contains up to 12 predicted actions, but each `runDevice` queues one action, waits and writes a checkpoint. | KEEP model batching; ADD separately negotiated device-side batches. Existing sequences remove model calls, not per-action transport waits.                    | `agent.ts:446–555`, `live-deps.ts:101`, `device.server.ts:698–790`; ordering, STOP, permission and ownership cases                                                 |
| `finish_task` accepts model-declared completion; verification is requested by prompt.                                  | REPLACE completion admission with independently checked receipts. Preserve old status compatibility until an explicit forward migration.                      | `agent.ts:633–654`, `protocol.ts:683–708`, `task-authority.server.ts`; forged, absent and mismatched evidence                                                      |
| Python rotation uses a separate exchange and discards returned commands; the server rotates then dispatches.           | FIX with an explicitly non-dispatching rotation-only operation, followed by normal exchange after durable key persistence; do not drop results/running state. | `ocade_identity.py:199–240`, `device.server.ts:587–589,698–790`; queued/running work, response loss and restart                                                    |
| Android observations are not invalidated by external screen changes.                                                   | FIX generations, freshness and target revalidation before mutation.                                                                                           | `Control.java:274–396`, `OcadeAccessibility.java:19–22`; scroll, popup, app switch, rotation and delayed dispatch                                                  |
| Semantic UI actions omit the cancellation token after admission; desktop `ui_act` also bypasses physical-input pause.  | FIX every mutation route, not only screen clicks.                                                                                                             | `ocade_computer.py:313–361`, `ocade_accessibility.py:237–303`, `Control.java:82–102,274–323`; STOP during lookup/gating and user takeover                          |
| Android `cancelGestures` releases a waiter, not the dispatched OS gesture.                                             | Distinguish request, callback and actual quiescence; prevent subsequent dispatch.                                                                             | `Control.java:450–481`; physical interrupted-gesture proof                                                                                                         |
| Ordinary Office errors omit `maybeChanged`; earlier operations or a save may have succeeded.                           | FIX partial-effect state and retain recovery metadata on every post-mutation failure.                                                                         | `actions/ocade_excel.ps1:44–70,140–193`, `actions/ocade_word.ps1:31–122`, `ocade_sheets.py:242–268`, `ocade_computer.py:641–651`; mid-batch and post-save failures |
| Desktop pending results are durable; Android's array is in memory.                                                     | ADD Android durable effect/result reconciliation.                                                                                                             | Existing `ocade_device.py` journal; `AgentService.java:120–145`; process death before/after acknowledgement                                                        |

Preserve existing safety tests. Tests using cooperative mock actions do not prove cancellation of uncooperative native operations. For Office, an already-open workbook can retain earlier edits after a later duplicate-sheet-name failure; a successful save followed by failed read-back can change disk despite an unchanged summary. Reproduce these exact transitions before modifying adapters.

## 3. One execution path and route selection

```text
Person's request/interjection
 -> existing Online planner and task owner
 -> typed intent, scope and required postconditions
 -> existing server authority: identity, grants, confirmation, lease
 -> signed exchange / authenticated event and reconciliation
 -> selected device: fresh admission and bounded local execution
 -> independent observations and durable per-step receipts
 -> verification policy
 -> existing task settlement and customer result
```

The model proposes; authority admits; executor acts; verification evaluates evidence. No model, page, file, screenshot, recipe or tool result grants permissions, extends scope, manufactures consent or settles itself as verified. Provider keys remain server-side; devices receive typed work, not provider credentials.

Prefer the first supported route that preserves the actual request:

1. Application/OS API, COM/object model or native operation.
2. Bounded task-owned script/CLI using a discovered supported interface.
3. Direct file/project transformation with demonstrated format fidelity.
4. Browser DOM/CDP or another authorised structured interface.
5. OS accessibility/semantic controls.
6. Live vision and fresh coordinates where structured methods cannot express the task.

Do not replace an explicitly requested in-app outcome with something superficially similar. Opening a composer is not sending a message; opening Settings is not changing a setting; exporting a preview is not saving an editable project. Capability records distinguish `read`, `prepare`, `mutate` and `verify` effects.

### Online model routing — corrected candidate, 19 October 2026

Standard pins `gemini-3.5-flash-lite` directly on Google’s native streaming API, retaining medium thinking, the output cap and all three configured Supabase server-secret slots. Key-local failures may advance slots within one three-attempt budget; quota retries stay on the same slot and honour Retry-After. No model switch, after-output retry or safety fallback occurs. The obsolete Cloudflare Google proxy and opaque cross-model continuation envelope are removed.

High explicitly selects Workers AI `@cf/google/gemma-4-26b-a4b-it` through its OpenAI-compatible endpoint. It uses a separate server-only `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_WORKERS_AI_TOKEN`, never a Google key. `workers-ai.ts` translates native call/result history, inline images and tools, omits opaque Google signatures/private reasoning, bounds fragments, and withholds calls until a valid successful terminal and EOF. The existing normalized-stream owner still controls delivery and settlement. Both modes use existing token limits and exactly the same completed-task accounting; the warning describes the shared provider allowance, not an invented customer-credit multiplier.

High requires the current acknowledgement, refuses Google-grounded Research, and never falls back to Standard or Offline. Chat exposes it only with explicit Online selected. JARVIS fixes quality in the existing task checkpoint JSON and carries it through foreground/background, progress, finish and restart. The server preserves the saved choice when older clients omit or alter it. The initial confirmation displays the faster-consumption warning, a persistent banner remains while High is selected, and a reminder appears every five minutes; timers are cleared when the control unmounts or returns to Standard.

The included-only guard rereads subscriptions before admission and each dispatch. It accepts only one explicit account-scoped, provisioned, zero-priced Workers Free subscription with zero-priced components; unknown/absent/ambiguous/paid/trial metadata fails closed. **This conservative predicate has synthetic tests, not a qualified real-account readback**; the current connection returns authentication error 10000. It cannot be waived by a browser flag or an operator boolean. The provider’s hard Free-plan limit, rather than an estimated local token counter on a paid shared account, is the cost boundary. No inference is allowed until account eligibility is verified; no automatic upgrade, credits purchase or paid fallback exists. Account upgrades outside OCADE invalidate the qualification and require revalidation before use.

Online consent version `2026-10-19-high` names Standard’s Google processor and High’s Workers AI processor. Standard’s real key/project grouping, free entitlement and active RPM/TPM/RPD, High’s included-only billing response and wire protocol, and all paired customer outcomes remain unqualified. Nothing in this candidate is deployed.

### Discovery and reusable recipes

Extend `ocade_discovery.py`, the discovery actions in `ocade_computer.py` and schemas in `protocol.ts`. Keep installed app/version/automation discovery and local recipe storage. Record app identity, installed version, platform, supported interface, scope, parameter schema, verification method and last-success evidence. Discovery reads lightweight metadata, not continuous private file content.

When required, read current official documentation as untrusted data through validated network boundaries. Recheck redirects/resolved destinations; page-provided commands still pass normal validation and consent.

Recipes contain semantic operations and expected postconditions, never reusable screen coordinates, secrets, private content or globally shared private screenshots. Bind them to app/version/interface/schema; invalidate changed assumptions and disable repeatedly failing recipes until rediscovery. A cache hit never waives fresh permission, observation validity or verification.

An app-specific adapter is justified only by measured fidelity, safety, reliability or performance that the common route cannot achieve. Test an unfamiliar application without adding app-specific code; keep any justified adapter behind the same broker and receipt contract.

## 4. Protocol and bounded local execution

Keep `jarvis-runtime/ocade_protocol.json` as shared version/signing authority and `src/jarvis/protocol.ts` as typed action schema owner. Preserve P-256 signing, canonical body/path/device binding, monotonic replay protection, enrollment/rotation/revocation and public-key-only server identity. Faster notification must not weaken those properties.

The following are proposed contracts, not current fields or permission to migrate during documentation work:

The sole proposed envelope definition is `ExecutionEnvelope` in [section 15](#15-canonical-negotiated-protocol-v2-and-local-execution-authority--target-contract-10-october-2026). Its authenticated fields and limits replace the older sketch here; v1 remains unchanged.

`TypedPrecondition` is a proposed small discriminated union: capability available, expected file identity, expected app/window, observation generation and resource ownership. It is not arbitrary evaluator code. Verification references resolve to authority-approved specifications; the model cannot replace them with always-true checks. Hash canonical serialised bytes. Confirmations bind exact action digest, scope, task, device, expiry and authority revision. No long-lived credentials enter the envelope.

### Admission and execution

1. `task-authority.server.ts` checks the envelope, grants, task/controller, scopes and aggregate budget. Keep single-action compatibility for old clients.
2. `device.server.ts` atomically claims one batch for the selected device. Duplicate identities resolve to existing state. An authenticated event signals available work; the signed exchange remains authoritative.
3. `ocade_device.py` or `AgentService.java` durably records the admitted identity. Same ID/different digest is refused. Completed IDs return receipts without executing again.
4. Immediately before every step check cancellation, monotonic local lease deadline, permission validity, resource ownership and relevant preconditions. A partition cannot extend the lease. Invalidate execution leases on process restart or detected suspend/resume; reacquire authority and observations. Convert expiry conservatively to a monotonic deadline, reject clock uncertainty, and require a fresh online authorisation immediately before high-impact external writes. A device cannot learn unseen remote revocation instantaneously. Stop new work if authority cannot be refreshed within its valid lifetime.
5. Initially retain 12 steps maximum, one shared GUI controller and at most two proven-independent background jobs, with one mutation owner per conflicting resource. Start with a maximum 5-second native mutation lease, renew every 2 seconds while connected, never exceeding 5 seconds from a fresh durable authority check, with a monotonic local deadline derived conservatively at signed admission. No renewal during partition extends it. Renewal must read current durable permission/revocation authority, not repeatedly mint a lease from a stale cached grant; server freshness belongs in the expiry-bound proof. Measure expiry/clock-jump/network-delay boundaries and require release proof of refusal by the deadline. This bounds new mutation admission, not the duration of an already-issued uninterruptible app operation. Offline Chat entitlement leases are separate and do not grant native control. Long renders/builds become explicitly owned jobs with continuing lease/cancel checks, not uninterruptible batches with stale permission snapshots.
6. End at the first failure, stale state, uncertain effect, confirmation or human-authentication boundary. Persist completed steps; replan from observed state without replaying the batch.

Known routine sub-actions use existing task/device grants. Unknown later sensitive actions cannot be pre-confirmed. Human consent and OS-owned prompts suspend/end a batch; do not add a dialog for every harmless cell operation.

### Durable receipt and acknowledgement

Use additive, RLS-reviewed migrations during implementation. Reuse task/activity tables where their lifecycle fits; introduce a table only where transactionality, retention or querying requires it. Specify unique identities and atomic ownership transitions before migration code.

Background planning persists its normalized model turn in a service-written `jarvis_activity` note before admitting an effect. The request's unique `controller` joins that note to its actual action receipts, including all admitted steps of one sequence and documentation reads. Rebuilding history preserves original call IDs, arguments, order and call signatures; unused calls receive explicit unrun results. A failed note write pauses the task without queueing work. A saved turn without receipts is never replayed automatically. Notes are context, never permission or completion evidence; existing queue admission, STOP and settlement remain authoritative. Legacy and foreground actions without such notes retain reconstructed history. Real provider restart qualification remains required.

The normalized assistant turn also retains the original order of supported text and function-call parts. A text part keeps its own opaque signature and thought flag, including an empty signed final text part; call parts reference the existing normalized calls rather than duplicating arguments. The boundary validates part shape, role, bounds and exact call order before accepting history; arbitrary provider payloads are refused. Continuation is released only with a complete provider turn. Thought text is excluded from visible answer tokens. Both JARVIS model transports and foreground continuation carry these parts, and background notes preserve them across requests, including text-only turns. The existing 64 KiB activity-result limit still applies: a refused journal write pauses without effects rather than truncating signatures. Synthesized calls parsed from model prose retain the legacy reconstructed history, because they have no original native call part. Durable original foreground history and cross-surface handoff remain open; this does not claim native image/code-part or live-provider qualification.

The online boundary admits calls only after the provider's explicit terminal `STOP`, not merely SSE EOF. `MAX_TOKENS` may close a text-only answer but never release a call. Content after a terminal result is refused. Withheld calls are not delivered work for allowance settlement or task-start binding; partial text retains its existing separate delivery policy.

```ts
type StepReceipt = {
  protocol: 2;
  accountId: string;
  taskId: string;
  deviceId: string;
  approvedOutcomeDigest: string;
  permissionRevision: CanonicalU64;
  keyEpoch: CanonicalU64;
  cancellationEpoch: CanonicalU64;
  batchId: string;
  stepId: string;
  requestDigest: string;
  controllerEpoch: CanonicalU64;
  effect: "not_started" | "unchanged" | "applied" | "partial" | "unknown";
  execution: "done" | "failed" | "cancelled" | "needs_person";
  verification: "pending" | "passed" | "failed" | "unverifiable";
  evidence: EvidenceReference[];
  recovery?: { kind: "backup" | "native_undo" | "reconcile"; ref: string };
  startedAt?: string;
  endedAt: string;
};
```

Receipts inherit authenticated account/task/device context from the exchange; task-authority validates those bindings, approved outcome-contract digest, request digest and controller epoch before settlement. Never accept a receipt solely by batch ID. Evidence references contain type, task-scoped artifact/state identity, digest where meaningful, capture time, verifier version and retention class. They do not automatically publish absolute paths/screenshots. Evidence may stay local where the product explicitly declares the device-attestation trust boundary; a compromised executor cannot be made independently trustworthy merely by signing its own assertion.

Persist intent/effect progress and receipts atomically through the existing local journal owner. Delete a local pending entry only after durable server acknowledgement. Revocation isolates/deletes local material according to privacy policy while retaining server cancellation truth. A late result after STOP is reconciliation evidence, never renewed execution authority or an automatic completed task.

Exactly-once physical effects are not universally achievable. A crash after save/send/click but before journalling yields unknown outcome. Reads can retry; writes need target-supported idempotency or state reconciliation. An inconclusive irreversible/external action waits for the person, never blindly sends again.

### Events, ownership and reconnect

Keep the shared Realtime subscription and authoritative reads in `changes.ts`; its first-real-event liveness check and fallback are intentional. Add an authenticated device notification channel only after measuring cost and compatibility with existing hosting. It is an optimisation, not another state authority. Reconnect reconciles claimed steps, pending receipts, permission revision and controller epoch before new mutations.

Retain one mutating lane per conflicting resource and one controller per shared GUI session. At most two independently owned background jobs may overlap after contention, permission and cancellation proof. Read-only metadata work may overlap only if it cannot change focus/state. Co-work never means simultaneous competing mouse control. Parallel render/build jobs require owned processes/output identities and measured contention tests before widening concurrency.

Server task ownership and local app/file ownership agree. Take Over changes epoch and cancels prior work. Continue obtains a new lease and observation. Old planners cannot enqueue, renew or settle the new owner's task. Locks require expiry/reconciliation, not indefinite orphaning or automatic abandonment when a browser disconnects.

## 5. Independent verification and settlement

Before effects, translate the request into explicit completion predicates and bind them to the task. User redirects create attributable revisions. A report workflow can require a named editable workbook, specified formulas/totals/sheets, original preservation, final destination, successful reopen and no unresolved calculation errors. Subjective quality requires labelled human review or separately labelled model assessment.

Verification independently reads the target using immutable expected predicates and attributable evidence. Another model agreeing with the planner is insufficient. An exit code, HTTP200, toast, screenshot or file existence is intermediate evidence, not automatically the requested outcome.

- Admit `completed` only when all required predicates pass and no effect remains unknown/unresolved.
- Report a verified subset as partial progress; do not silently relax the specification.
- Verifier failure/inaccessible target/missing evidence means pending or unverifiable, never pass.
- Bound repair attempts and eventual-consistency waits. A new resource, expanded scope or irreversible recovery action requires fresh admission.
- Messaging proof distinguishes prepared, submitted, provider-accepted and delivered. Delivery requires target evidence; a sent-tool call alone is insufficient.

Wire checks into foreground `agent.ts` and background `background.server.ts` before finish, enforce final transition in `task-authority.server.ts`, and preserve sanitisation/acks in `device.server.ts`. Forged/direct server calls cannot bypass settlement policy. Old completed rows remain historical outcomes, not retroactively independently verified results.

The current completion owner invalidates file evidence after a later command or ancestor-directory mutation; edited-file content and workbook sheets must be reread after that change. Populated workbook rows require measured nonnegative integer `filledRows` counts, never formatted extent or a missing count from an older companion. Research is successful evidence only after a complete, nonempty provider turn without refusal; partial text cannot be billed as delivered research or journaled as a successful source. These source guards have isolated remote regression proof; semantic workflow predicates and full cloud/database/provider qualification remain open in the retired `BLOCKED_TESTS.md` checkpoint.

## 6. STOP, takeover, partial effects and recovery

Distinguish STOP requested, device acknowledged and execution quiescent. The website must not say all devices stopped while an offline one has not acknowledged. Server cancellation closes admission immediately; local tray/bubble/UI STOP sets cancellation directly without waiting for network or model inference. A short lease bounds disconnected continuation. Publish measured bounds, not instantaneous remote guarantees.

Carry cancellation through semantic lookup, clipboard, Office, file copy, terminal and gesture paths. Recheck before mutation and between bounded chunks. Cancelling a wait is not cancelling its operation. Track and terminate only task-owned processes, never arbitrary user apps. Already-issued uninterruptible RPCs require preventing subsequent effects and reconciling the final state; they cannot be promised undone.

Physical input immediately pauses competing GUI automation, including when legacy `cowork` is true. Semantic operations that click/focus participate. Continue re-observes and never validates old refs by itself.

Coordinate validity includes monotonic age, app/window identity, geometry, target evidence and relevant generation. Navigation, scroll, popup/content mutation, focus/window movement, resize, monitor/DPI and orientation invalidate affected observations. Define tested target-region validity to avoid needless invalidation from unrelated animation; when validity is uncertain, fail stale. Equal observation IDs alone are not proof of equal screen state.

Office recovery records the disk backup plus whether the app held pre-existing unsaved work. Restore automatically only when the captured pre-state is sufficient and restoration cannot erase later user edits; otherwise ask for scoped recovery. A backup of an earlier disk save does not preserve unsaved in-memory work. Original files and project dependencies remain intact by default.

## 7. Website-first browser and companion lifecycle

Ordinary website code controls its own UI and explicitly granted browser capabilities; it cannot inspect arbitrary other tabs, read all local files or control installed apps. Keep existing public-key enrollment, website approval, fingerprint/expiry/replay/source limits, assurance and revocation. Never add an unauthenticated localhost command server, wildcard-CORS bridge or secret-bearing deep link. Any later local fast path must enforce origin, pairing, authenticated commands, replay protection and identical broker policy; it is not required for the website/cloud path.

| Browser situation                                                   | Route                                                                      | Boundary                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Existing signed-in browser exposes an authorised supported endpoint | `ocade_existing_browser.py` attachment                                     | Preserve tabs/profile and session ownership; never extract cookie/password stores                               |
| Normal browser has no structured endpoint                           | OS accessibility, then fresh visual interaction                            | Do not claim universal CDP attachment or silently reconfigure profile/debugging                                 |
| Controlled browser is appropriate                                   | Product-owned isolated/custom profile through `actions/browser_control.py` | Explain separate session; normal user sign-in if required; no copying/decrypting existing authentication stores |
| Browser/platform unsupported                                        | Supported native/remote route or scoped manual handover                    | No hidden extension/developer-tool installation                                                                 |

Since Chrome136, published policy ignores remote-debugging switches against the default data directory; a non-standard `--user-data-dir` is required. Chrome for Testing is an internal test option, not normal-profile production proof. Revalidate browser versions at release. [Chrome policy](https://developer.chrome.com/blog/remote-debugging-port).

Customer flow: website sign-in → connect computer → signed package/one-time setup → approve device → grant only needed capabilities → complete a verified first task. Return visits show ready/offline/permission-needed. Reboot restores one dormant tray supervisor, not duplicate windows or browser prompts. A permission cannot create a missing native capability.

Keep `ocade_agent.py`, `ocade_identity.py`, `ocade_update.py` and packaging owners. Verify signed manifest and final package hashes, stage updates, health-check and roll back failures. Health is liveness, not whole-workflow proof. Uninstall stops owned work, removes autostart/keys/settings according to data-removal choice and preserves user files. Signing/notarisation/distribution credentials and costs remain release prerequisites; near-zero budget does not permit an unsigned artifact labelled verified.

## 8. Platform support and honest limits

| Platform    | Target                                                                                                    | Evidence/limitations                                                                                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows     | One tray companion; native API/COM, files/scripts, browser, UI Automation and screen fallback             | Real Windows10/11 standard-user lifecycle, UAC refusal, multi-monitor/DPI, sleep/reboot, STOP and Office proof. No protected-desktop/authentication bypass                                                      |
| Android     | Website-led signed APK; one OCADE UI/bubble; intents/native APIs, accessibility and fresh-screen fallback | Physical grants/restricted settings, foreground microphone/background service rules, OEM behaviour, revocation, rotation, secure screens and battery. ADB/Appium are internal tests, not customer prerequisites |
| macOS       | Later signed/notarised menu-bar companion with supported scripting/Accessibility                          | Current semantic UI implementation is Windows-only; coordinate target gating lacks macOS AX. Resolve these plus bundle/update layout; real TCC/hardware/lifecycle evidence before support claims                |
| iPhone/iPad | Safari/PWA, sanctioned share/notification/Shortcuts integration and remote PC                             | No arbitrary native control from a website. App Intents need an exposing app; PWA cannot manufacture them. WebKit/emulator evidence is not physical Apple proof                                                 |

Android may install the official signed APK from `ocade.in`, without a Play Store dependency. Users still grant OS-owned installation/accessibility/overlay/microphone permissions. Ask just in time, explain purpose, and remove capabilities immediately after revocation. The bubble is an entry point to task status/voice/STOP, not another authority. No lock-screen/authentication bypass. Keep wake assets bundled and pre-wake processing local.

iPhone Mirroring is an optional postponed research route, not unrestricted iOS support. It needs a compatible Mac/iPhone, same Apple Account with2FA, proximity, Wi-Fi/Bluetooth and locked phone; unlocking stops mirroring. Camera/mic/Face ID workflows are unavailable. Region/version limits apply. Require physical/public-API/policy evidence; do not adopt private window APIs or developer WebDriverAgent setup as invisible consumer installation. [Apple requirements](https://support.apple.com/en-us/120421).

## 9. Professional application fidelity

| Family               | First route                                                                          | Independent checks                                                                                           | Refusal/fallback                                                                     |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Excel                | Existing COM; formulas/fills/tables; file engine only for proved-preservable formats | Reopen saved workbook; requested formulas/calculated values, original, macros/links and unrelated formatting | Real Excel where required; no silent stripping of unsupported content                |
| Word                 | Existing COM and supported document operations                                       | Reopen; requested text/styles/tables, editable output and preserved content                                  | Protected documents/authentication handover; partial save never called unchanged     |
| PowerPoint           | Discovered supported object model and bounded script                                 | Reopen; slide/content/layout/media checks; rendered review where visual fidelity matters                     | Do not invent an existing PowerPoint editor; narrow adapter only after measured need |
| Fusion/CAD           | Supported installed scripting/API and native format                                  | Reopen; units, bodies/features, dimensions/constraints, dependencies and exports                             | App licence/version and engineering review required; screenshots insufficient        |
| Blender/3D           | Supported Python API/CLI and native project                                          | Reopen `.blend`; objects/materials/units/camera/render settings and requested views                          | Process success alone is not geometry/artistic correctness                           |
| Video/media          | Supported editor scripting/CLI; native project plus owned render                     | Editable project reopen where required; duration, streams, dimensions/fps/audio and representative frames    | An MP4 is not an editable timeline; explain unsupported editor/fidelity limits       |
| IDE/coding           | Files, task-owned terminal/Git and relevant tests                                    | Diff, executable tests/builds and requested environment behaviour                                            | IDE GUI only where useful; publishing confirmation remains                           |
| Unknown business app | Discover API/scripts/formats, then semantic controls                                 | Explicit target state/output predicates and re-read                                                          | If unverifiable, say so; no universal-success promise                                |

Keep adapters behind `ocade_computer.py` and the shared protocol. Do not install paid apps, enable macros or fetch untrusted plugins automatically. Default to completed copies; preserve project dependencies. Authorised overwrite still needs recovery/conflict checks.

Task scripts remain untrusted code. A workspace working directory is not a Windows/macOS sandbox. Process APIs can reach outside it without enforced containment. Require least-privilege admission, environment/credential isolation, owned children and explicit high-risk/network/publishing policy. Do not generalise Linux bubblewrap confinement to other platforms. Broader scripting requires actual platform containment or a clearly consented broader execution scope.

## 10. Natural voice and conversational control

Owners: `src/jarvis/use-voice.ts`, `live-control.ts`, `stop-everywhere.ts`, `agent.ts`; `jarvis-runtime/ocade_wake.py`; Android `WakeService.java`/`WakeModel.java`. Current browser recognition and speech synthesis stop recognition during speech (`use-voice.ts:249–265`), so true simultaneous spoken barge-in is not implemented. Preserve current echo-tail protection until its replacement proves privacy and interruption parity.

Extend one audio/session coordinator per surface. Canonical states: off, permission-pending, local-wake, listening, transcribing, thinking, speaking, interrupted, reconnecting, paused, error. PRD labels map Off=off; Starting=permission-pending; Listening=local-wake/listening (show wake readiness separately); Processing=transcribing/thinking; Speaking=speaking; Paused=paused/interrupted; Error=error; reconnecting displays Processing with a Reconnecting status. These are display labels, not another source enum. Task lifecycle is separate: speaking cannot start/finish/cancel a task. Text remains available.

1. Explicit Voice is the initial entry. Acquire mic after consent; cancelled prompt/unmount/sign-out releases late streams. Multiple starts cannot leak streams or recognisers.
2. Pre-wake audio stays local. Supported companions use the existing bundled model for `OCADE` and `Hey OCADE`; no separate download after installation. Browser wake requires proved-local recognition; otherwise unavailable, not silently remote.
3. Active follow-ups need no repeated wake phrase. Stream recognition where supported. Interim transcripts are previews, not irreversible-action authority. Deduplicate final utterances and bind conversation/session/controller epoch.
4. STOP/Pause/Take Over are local control paths. Stop playback, close action admission and propagate cancellation before awaiting inference/network. Button, keyboard and tray/bubble controls remain if speech fails.
   Audio-only barge-in cancels playback, not task work. Explicit Stop/Take Over or an intent-invalidating redirect closes task admission independently.

5. True barge-in needs one measured duplex strategy: echo cancellation/playback-reference suppression plus bounded voice detection. Test speakers/headphones, self-echo, other speakers, accents/noise and long playback. No competing recognisers; until passed, label half-duplex and provide button interruption.
6. Status questions read authoritative task/receipt state without abandoning work or unnecessary planning calls. Redirects safely interrupt/reconcile before changing intent. Spoken confirmation resolves the exact scoped pending action, not stale banners or background TV audio.
7. TTS failure keeps readable text and releases state. Session generations invalidate late callbacks so old playback cannot reopen an ended mic.
8. If natural streaming audio needs a server voice transport, integrate one selected backend into existing authenticated intelligence, consent and usage accounting. Provider keys stay server-side. Keep browser fallback until measured parity; no separate voice planner/provider-key UI.

Tests: permission delay/End-during-start, rapid pause/resume, unmount, device change, interrupted TTS, stale callbacks, network loss, local STOP during speech, OS suspension and duplicate transcript. Measure speech-start-to-first-audio, interruption-to-silence and task STOP-to-quiescence separately. Never promise background listening beyond OS rules.

## 11. Data, privacy and storage

Supabase remains durable account authority. New batch/receipt data requires tenant RLS, signed device ownership, staff checks and scoped retention. Do not duplicate conversations/messages, usage, roles, support or task stores. Device data cannot mutate grants or task ownership.

Screenshots are transient by default. Retained evidence is task-scoped, access-controlled and explicit. Customer Activity is concise and safe; diagnostics retain timing/error/version/hashes/safe IDs without unnecessary content or secrets. Requested, acknowledged and verified are different states.

Offline model identity is independent of deployment identity. OPFS completed ranges/integrity survive ordinary updates/reloads; repair only interrupted/corrupt data. Explicit Remove/Clear Data and documented platform eviction can reset storage. Offline Chat never inherits native/JARVIS permissions because a model exists locally.

## 12. Performance budgets and evidence

Proposed budgets below are not measured results. Declare reference hardware/OS/browser, warm/cold conditions and workload before acceptance. Keep safety/verification in the measured path.

| Metric                                     | Initial proposed target               | Boundary                                                                  |
| ------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------- |
| Warm capability lookup                     | p95 <=5ms                             | Valid sanitised cache; excludes discovery                                 |
| Local small-step admission                 | p95 <=10ms                            | No network/OS RPC; includes lease/cancel checks                           |
| Local dispatch bookkeeping                 | p95 <=20ms                            | Admission to native adapter call; excludes app work                       |
| Local STOP signal/admission closure        | p95 <=50ms                            | Input to cancellation publication; not quiescence                         |
| Cooperative synthetic-operation quiescence | p95 <=250ms                           | Controlled workload; no universal OS-cancellation guarantee               |
| Remote STOP/dispatch                       | Establish p50/p95/p99                 | Real RTT/events/polls/leases/reconnect; no millisecond end-to-end promise |
| Idle CPU/RAM/energy/network                | Establish baseline and release budget | Separate tray/watchdog/polling/wake; physical mobile energy evidence      |

Record model calls/tokens/cost, network requests, screenshots/bytes, actions, verification time, interventions, uncertain effects and output quality per workflow. Compare equivalent cold/repeated tasks. Existing model sequences, Realtime and caches belong in the baseline. Device busy/idle polling and per-action cloud queues are remaining transport costs; optimise measured bottlenecks rather than line count.

## 13. Failure and release contract

| Injected fault                                           | Required outcome                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Malformed action, forged receipt, extra scope            | Rejected before effect, no grant change                                                                                   |
| Observed permission revocation after queue/between steps | No later admitted mutation; refused/cancelled receipt                                                                     |
| Unseen remote revocation during partition                | No new mutation after the at-most-5-second native lease expires; local STOP remains immediate; report bounded uncertainty |
| STOP during native lookup/Office/copy/gesture/render     | Admission closes; owned cancellable work stops; issued effects reconciled; no false quiescence                            |
| Unexpected UI change                                     | Stale result/re-observation, no wrong-target click                                                                        |
| Browser closes with Background Mode off/on               | Existing orphan/continuation policy, no duplicate planner                                                                 |
| Save succeeds, response lost                             | Read-back/reconciliation, no blind repeat, recovery retained                                                              |
| Device/app/OS restart                                    | Journal/lease/ownership reconciled; old coordinates invalid                                                               |
| Competing controllers                                    | One epoch wins; loser cannot mutate/settle                                                                                |
| Offline device/unreadable safety controls                | No unsafe new work, truthful pending state, bounded lease expiry                                                          |
| Verifier inconclusive/fails                              | Unverified/partial, bounded repair or person; never pass                                                                  |
| Update health/protocol failure                           | Known-good rollback, compatible state, no signature bypass                                                                |

Use existing Python safety/browser/Office/lifecycle tests and TypeScript agent/device/schema/ownership suites. Add focused owning regressions before new infrastructure. Internal Playwright/CDP, Appium/ADB, OS automation and profiling tools are evidence tools, not customer requirements. Isolate test accounts/files/processes; no destructive tests on customer resources.

Label emulator, WebKit, local database and mocks accurately. Physical Android, Office/CAD/video, Mac TCC/lifecycle and iPhone/iPad proof cannot be inferred. Release requires source→artifact→deployed identity, valid signatures, rollback and no unresolved release-scope critical/major issue. GitHub Actions is optional; equivalent attributable evidence is mandatory.

## 14. Provenance, reuse and retirement

Donor sources/ZIPs were removed from the repository on 11 October 2026 and are never reimported. Preserve historical requirements/evidence via versioned references; deleted ledgers are not unquestioned current truth. The historical approximately98% donor capability/logic reuse aspiration never overrides licensing, safety, measured parity or the smallest correct implementation.

Before copying/adapting donor or competitor code, record the exact revision and licence for those bytes. Public visibility/attribution is not commercial permission. Current `FatihMakes/Mark-LV` declares CC BY-NC4.0; do not assume paid OCADE reuse is authorised. Audit the preserved donor's own licence independently and resolve permission before affected distribution. Conceptual techniques can be implemented independently without importing competing runtimes.

Retire active code only after caller/packaging/capability inventory and permission/STOP/recovery/platform replacement proof. Keep distinct browser security/session modes, Office fidelity adapters, journals, update rollback, authentication, accessible fallback and useful adversarial tests. No percentage deletion target or framework rewrite is an acceptance criterion.

## 15. Canonical negotiated protocol v2 and local execution authority — target contract (10 October 2026)

This is a **proposed** change, not a claim of current source implementation. `jarvis-runtime/ocade_protocol.json` is the existing shared signing/version owner, `src/jarvis/protocol.ts` the typed action owner, `task-authority.server.ts` admission, `device.server.ts` signed exchange, Python/Android local dispatch. Continue using established v1 signing bytes for legacy. Authenticate negotiation of `protocol:2` and bind account/device/task, batch and step, approved outcome digest, exact permissions, resource ownership and lease into newly canonical v2 signed bytes. Old v1 client must never receive steps whose required safety semantics it cannot understand. Reject duplicate JSON keys and unknown critical features before canonicalisation. Avoid copying untrusted model identity fields into signed context.

### Exact types and decoding limits

```ts
// PROPOSED v2. All generation/revision fields are unsigned 64-bit canonical decimal strings.
type CanonicalU64 = string;
type ExecutionEnvelope = {
  protocol: 2;
  accountId: string;
  taskId: string;
  deviceId: string;
  controllerEpoch: CanonicalU64;
  cancellationEpoch: CanonicalU64;
  permissionRevision: CanonicalU64;
  keyEpoch: CanonicalU64;
  batchId: string;
  nonce: string;
  requestDigest: string;
  approvedOutcomeDigest: string;
  lease: { id: string; issuedAt: string; expiresAt: string };
  steps: Array<{
    id: string;
    action: DeviceAction;
    scopeRef: string;
    confirmationRef?: string;
    preconditions: TypedPrecondition[];
    verificationRefs: string[];
    replay: "read_only" | "idempotent" | "reconcile_before_retry";
  }>;
  budget: {
    maxSteps: number;
    maxDurationMs: number;
    maxPayloadBytes: number;
    maxOutputBytes: number;
  };
};
```

Do not treat this sketch as a replacement for current schema without full source tracing. Enforce decimal regex `^(0|[1-9][0-9]*)$`, range 0…2^64−1, no leading zeros/plus/minus/exponent/whitespace, comparison via BigInt in TS without JSON numeric serialisation. A zero or wraparound epoch that violates current monotonic server policy is invalid. Local intent journal is durably flushed before a potentially irreversible effect; same batch/id with conflicting digest fails. Preserve effect, execution and verification as three orthogonal statuses. After loss of acknowledgement, independently read target state before attempting retry. A signed device receipt is authenticated reporting, not independent truth against an OS-level compromised executor.

Admission/STOP/Take Over/resource-lock transfer must share the local final-mutation serialisation point. One controller owns global pointer/keyboard/focus per GUI session, including across multiple windows; API/build/render jobs may overlap only with demonstrably disjoint resources and cancellation support. A five-second maximum admission lease measured from fresh issuance and a two-second renewal interval are initial targets, not remote instantaneous revocation promises. Local STOP closes admission immediately; noncancellable native effects may finish and remain UNKNOWN until reconciliation. Prepared scripts must bind actual bytes, interpreter/version and enforceable filesystem/process/network capabilities; **a matching digest does not sandbox an unrestricted child process**.

**Compatibility proof:** cross-language TS/Python/Java golden canonical bytes, 0/max/overflow/leading-zero numeric cases, duplicate keys, unknown-critical options, signature replay/downgrade/key rotation, clock skew/suspend, revoked grant, same-id/different-digest, 12/13-step boundary, payload/output budget, full Windows/Android installed-device exchange and a failure-injected lost-ack write. No v2 release while any mandatory safety semantic is missing on a shipped old client.

### Local-first external boundaries

Online models and OCADE's server-side account coordination are allowed; the selected customer's local computer executes actual professional project mutations and renders, including IDE, native Office, CAD, video and GUI. No default cloud desktops, remote coding sandboxes or silent hosted backup executor. External customer-chosen GitHub/Drive/email/web accounts require separately established intended external identity and permissions. A phone dispatches to an enrolled PC. JARVIS never silently falls back to Chat's Offline Intelligence.

Sources used for technical feasibility: [Chrome 136 remote debugging limits](https://developer.chrome.com/blog/remote-debugging-port); [Windows UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32); [Photoshop UXP scripting](https://developer.adobe.com/photoshop/uxp/scripting/); [Gemini Live session reconnect](https://ai.google.dev/gemini-api/docs/live-api/session-management). These are external **research**, not test results on the current OCADE product.

## 16. Conditional local agent isolation — new 7 October 2026 Windows capabilities

Microsoft's [Execution Containers announcement](https://blogs.windows.com/windowsdeveloper/2026/10/07/microsoft-execution-containers-policy-driven-containment-for-ai-agents/) describes a Windows 11 session container with a separate desktop, account, clipboard and input boundary, plus process containment on supported Windows/macOS/Linux. This is a potentially valuable **local execution option** for high-risk scripts and non-interfering UI work. It is not a replacement for the existing signed OCADE Device Agent, task journal, server authority or permissions. The public [microsoft/mxc source](https://github.com/microsoft/mxc) currently warns that its preview SDK policies can be overly permissive and should not yet be treated as security boundaries. Consequently P08/P11 may only PROBE installed support and build isolated test fixtures; any actual security isolation claim requires pinned SDK/backend/release, policy-denial integration tests, file/network/clipboard/desktop leakage attacks, crash recovery and native app session compatibility. No automatic privileged migration, paid hardware requirement or default cloud desktop. Keep the existing native/UIA first route on unsupported OS versions; explicitly report non-isolated prepared-script limits.

[UFO2 engineering research](https://www.microsoft.com/en-us/research/publication/ufo2-the-desktop-agentos/) supports testing native UIA+vision grounding and multi-action execution, but OCADE maintains one planner and broker, not a copied multiagent engine.

## 17. Exact execution-protocol, result semantics and STOP migration — final detailed blueprint

This section refines existing design/architecture guidance with the latest source-specific details. Where provisional dimensions conflict, latest user decisions **1A / 2A / 3A** and the requirements below control; existing shipped behaviour remains evidence to recheck, not an implementation claim.

### 3.1 Preserve the actual v1 contract

The inspected shared protocol is version **1**, minimum **1**, using P-256/SHA-256 and prefix `OCADE-DEVICE-1`.

The current `DeviceCommand` contains:

`id`, `taskId`, `action`, `confirmed`, `mode`, `sites` (an old agent still accepts a `cowork` field and ignores it).

It does **not** contain existing `controllerEpoch` or `permissionRevision` fields. Earlier documentation examples must not be described as implemented wire types.

Preserve v1 canonical request bytes: prefix, protocol, uppercase method, path, device ID, timestamp and body digest, joined in the existing order. Preserve the exact cross-language signature representation.

### 3.2 Proposed v2 types

Use `protocol` as the wire version field. Epoch/revision fields are **canonical unsigned 64-bit decimal strings**, with no leading zeros except `"0"`, no negatives, no wrapping and maximum `18446744073709551615`.

The new admitted segment must bind:

- Account, task, selected device and enrolled key epoch.
- Controller epoch, cancellation epoch and permission revision.
- Batch/step IDs, request nonce and request digest.
- Approved outcome digest.
- Exact app, browser profile, external account and file/resource references.
- Issued/expiry times and local admission lease.
- Typed steps, trusted preconditions, expected effects and verifier references.
- Resource locks and observation generations.
- Step, duration, output and mutation budgets.
- Replay classification: read-only, idempotent or reconcile-before-retry.

Do not accept executable predicates, arbitrary helper code or model-authored permission claims.

Use authenticated capability negotiation. An old client cannot receive a task whose safety semantics it cannot enforce. Reject duplicate JSON keys, malformed counters, unknown critical fields, conflicting payload reuse, altered digests and downgrade attempts.

New authenticated admission fields must be covered by the v2 signing/verification contract. Keep release-key, device-key and admission-key responsibilities distinct; do not silently reuse a signing key for another authority.

### 3.3 Orthogonal result semantics

Each step records independently:

| Dimension    | Values                                                      |
| ------------ | ----------------------------------------------------------- |
| Effect       | `not_started`, `unchanged`, `applied`, `partial`, `unknown` |
| Execution    | `done`, `failed`, `cancelled`, `needs_person`               |
| Verification | `pending`, `passed`, `failed`, `unverifiable`               |

Evidence includes resource identity, capture time, examiner identity/version, relevant digest or structured result, and retention class.

A signature authenticates the reporting device. It does not establish that a compromised computer reported truthfully.

“Completed and checked” requires all mandatory outcome predicates to pass. A model `finish_task`, success toast, HTTP 200 or file existence cannot substitute.

### 3.4 State migration

Add the richer task states without reinterpreting historical rows:

`received → validated → admitted → executing → verifying → verified`

Alternatives:

`waiting_for_person`, `paused`, `cancelling`, `cancelled`, `failed`, `partial`, `unknown`.

Keep explicit compatibility mapping for legacy `running`, `waiting`, `taken_over`, `stopped`, `blocked`, `failed`, `completed`. Legacy `completed` does not retrospectively prove verification.

### 3.5 STOP, takeover and reconciliation

1. Local STOP synchronously invalidates mutation admission.
2. Cancel queued work and request cancellation of task-owned processes.
3. Release held input where the OS allows it.
4. Preserve effects already applied.
5. Mark uninterruptible or uncertain effects accurately.
6. Fence affected resources until readback resolves them.
7. Take Over withdraws shared GUI ownership before acknowledging human control.
8. Resume requires fresh identity, permissions, observation and leases.
9. Redirect drains/reconciles the old scope before admitting the replacement.
10. Physical takeover wins immediately, including when legacy `cowork` is true.

A five-second admission lease is a bound on new admission, not a promise that every running save or render stops within five seconds. Restart, suspend and clock uncertainty invalidate admission.
