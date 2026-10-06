# OCADE JARVIS Master Commercial-Readiness Plan — Phases 1–49

## Mandatory first action — reconcile the current ledgers before any phase

This is the first execution gate on every fresh session and after any material audit/strategy update. **Do not begin Phase 1 or any later phase before completing this gate.**

1. Re-check the exact current `main` SHA, working tree, deployed source identity where available, database migration state, device/runtime versions, and current test baseline.
2. Read these three current repository authorities **completely, first**:
   - `FULL_ERROR_AUDIT_LEDGER.md`
   - `PONYTAIL_DEBLOAT_LEDGER.md`
   - `ELITE_PRODUCT_STRATEGY.md`
3. Then read `ToRemove.md`, `CLAUDE.md`, `AGENTS.md`, the current Owner instruction, and every domain authority/canonical document relevant to the affected work.
4. Treat the ledgers as evidence to reconcile against the current source, not as permission to blindly patch historical findings. Reproduce each relevant error/debloat claim on current `main`, mark it CURRENT / FIXED / STALE / BLOCKED / UNTESTED, and preserve the original evidence.
5. Build a live **ledger-to-phase reconciliation map** before implementation. Every current Major/Critical release-scope error, valid debloat item, and applicable elite-strategy recommendation must be assigned to the existing phase/wave that owns it. If no phase owns it, add the smallest new phase/gate instead of leaving the requirement orphaned.
6. Update phase acceptance criteria where the current ledgers prove that an older phase is incomplete, unsafe, duplicated, too slow, misleading, or commercially weak. Never mark a phase complete merely because an older report once did.
7. Fix current reproducible release-scope errors **before** polishing or speculative expansion. Root-cause repair takes priority over feature count.
8. After the blocking/current errors for a phase are fixed and verified, continue through the phase implementation in order, preserving already-correct work.
9. After functional parity and real evidence are green, run Ponytail/ToRemove debloat for that completed area: delete/reroute dead, duplicate, obsolete, hard-coded, slow, or unnecessary paths only after the replacement authority is proven.
10. Re-run targeted tests, real workflow verification, adversarial checks, broader regression, security checks, and performance measurements **after cleanup**. Cleanup is not complete until the smaller tree proves the same or better behavior.
11. Only then proceed to the next phase. Final commercial release requires the whole product to pass the same sequence: **ledger reconciliation -> error repair -> phase completion -> debloat -> full revalidation -> release evidence**.

### Required reconciliation output before coding

Keep this short but explicit in the working notes/status:

- current `main` SHA;
- current ledger finding counts/statuses;
- current debloat opportunity count/statuses;
- applicable elite-strategy recommendations;
- which existing phase owns each current blocker;
- what must be fixed before that phase can pass;
- what cleanup is deferred until after behavior is proven;
- what is BLOCKED/UNTESTED because real evidence is unavailable.

Do not rewrite the whole plan every session. Update this plan only when the ledgers expose a real authority/phase gap or the Owner changes direction.

### Mandatory work order

**A. Reconcile evidence.** Read and cross-check the error ledger, debloat ledger, elite strategy, current authorities, donor evidence, source and deployed/runtime state.

**B. Repair trust and correctness.** Reproduce and fix valid current errors first, especially security, STOP/cancellation, ownership, preservation, false-success, update, background, permission, device-control and result-verification failures.

**C. Execute the product phases.** Continue the existing phases using the reconciled acceptance criteria. Preserve working implementations; extend or repair them instead of rebuilding for phase-number purity.

**D. Optimize the universal fast path.** Prefer native/API/script/object-model/direct-file/DOM/CDP/semantic control, event-driven completion, local deterministic execution and bounded verification. Keep vision/input as a last-resort fallback, not the normal architecture. Do not proliferate hard-coded per-app controllers.

**E. Debloat only after proof.** Apply `PONYTAIL_DEBLOAT_LEDGER.md`, `ToRemove.md`, KISS/YAGNI/DRY/WET and delete-before-adding rules. Remove as much active code, branching, duplicated state, stale setup and dead UI as safely possible without reducing capability or evidence.

**F. Revalidate the smaller product.** Repeat unit/integration/browser/device/security/performance/accessibility/update/recovery/real-task evidence on the cleaned implementation. A smaller tree with weaker behavior is a failed cleanup.

**G. Commercial gate.** Ship only the scope with zero known reproducible Critical/Major blockers, truthful supported-platform evidence, verified outputs, safe STOP/recovery, stable updates, acceptable latency/cost and clear remaining BLOCKED/UNTESTED items.

## Owner authority — 2026-09-29

This is the single active execution plan for OCADE JARVIS. It deliberately restores the useful older phases and integrates the newer donor-first/device/admin/commercial-readiness phases into one continuous roadmap from Phase 1 through Phase 49.

Earlier phases are not assumed correct merely because an old report once called them complete. On a fresh clone Claude must inspect the current implementation, run the required evidence for that phase, preserve anything already correct, repair anything incomplete or broken, and move forward only after the phase exit gate is satisfied. Do not rebuild working code just to match a phase number.

The baseline main SHA when this master plan was authored is `2f178f7dab2d55c6985ffad235b19ae01f663513`. Re-check latest `main` at session start.

## Permanent owner decisions

- CARCC is the company. OCADE is the product.
- Chat and OCADE JARVIS remain distinct protected experiences.
- JARVIS is Online-only. It never silently falls back to Chat Offline Intelligence.
- If approved Online capacity is unavailable, JARVIS enters a truthful temporary locked/unavailable state while durable task state is preserved.
- The immutable owner-supplied donor under `imports/ocade-jarvis/source-original/` and the preserved ZIP remain unchanged.
- Target approximately 98% reuse of useful donor capability/logic where safe by copying/adapting it into active `jarvis-runtime/`, renaming/wiring it correctly, and hardening it under OCADE authority.
- Never run production directly from the immutable donor.
- Do not ship the old donor GUI, old provider-key entry/config, old phone dashboard GUI, or generic customer plugin product.
- There is no active OCADE customer browser add-on dependency. Existing authorized Chrome/browser profile is preferred.
- Browser control uses secure CDP/Playwright/DevTools where available, then browser/OS accessibility, local vision, and fresh PyAutoGUI coordinates.
- Windows final local UX uses one OCADE tray identity; no required floating Windows mini-control.
- Android receives the floating JARVIS bubble and legitimate Android deep-control components/permissions.
- iPhone/iPad remain PWA/Home Screen + Apple-supported integrations + Remote PC.
- macOS deep control uses a trusted Device Agent/menu-bar and must receive real macOS evidence before being claimed.
- JARVIS must remain conversational while working. Users may talk/type during execution and ask status, redirect, pause, continue, or stop.
- Hey OCADE pre-wake detection is local where supported.
- Provider/model/vendor/key identity remains hidden from customers.
- Primary Owner/Backup Owner/Admin/Staff authorization is server-side and stable-user-ID based, never frontend email authorization.
- The current OCADE TOTP/2FA enrollment failure is a real bug and must be repaired/proven.
- Device removal during an active action must cancel the local work before device authority is forgotten.
- Physical execution must fail closed when safety-control state cannot be verified.
- Offline Chat model installation must survive normal source merges/deployments without unnecessary redownload.
- Sentry project creation, payment-provider implementation, paid leaked-password protection, public browser-store work, and public signing identity remain separately reported deferred/owner dependencies unless later owner authority changes them.
- Every phase reports evidence-based commercial-launch readiness percentage.

## Global implementation standard for every function, button, executor and workflow

Every meaningful implementation must be treated as a production function, not a demo.

For each function/button/executor/workflow Claude must consider:
- correct input and output;
- account/device/task ownership;
- permissions and role;
- loading/in-progress state;
- disabled state;
- cancellation;
- STOP behavior where applicable;
- success verification;
- recoverable failure;
- terminal failure;
- retries and idempotency;
- duplicate clicks/requests;
- stale state;
- navigation/reload/restart;
- network interruption;
- account switch;
- permission revocation;
- concurrency/races;
- security boundaries;
- accessibility;
- desktop/tablet/mobile UI where applicable;
- logging/audit without leaking secrets;
- cleanup/resource release;
- performance and bounded resource use.

A button is not complete because it renders. It is complete only when its backend authority, visible state, error/recovery path, security rule, regression test and real UI evidence agree.

For every meaningful implementation wave use:

`inspect -> reproduce -> implement/fix -> targeted tests -> integration tests -> applicable MCP/real UI -> inspect actual result -> root-cause repair -> exact retest -> adversarial attempt -> broader regression -> cleanup -> retest`.

Do not claim mathematical zero bugs. The target is zero known/reproducible Critical or Major blockers in shipped scope and no unexplained required-evidence failure.

---

## Phase 1 — Baseline, authority reconciliation, donor preservation and complete inventory

### Purpose
Start from a clean factual baseline and preserve every useful donor capability before any migration decision.

### Build / repair
- Complete the mandatory ledger-first gate at the top of this plan. Read `FULL_ERROR_AUDIT_LEDGER.md`, `PONYTAIL_DEBLOAT_LEDGER.md`, and `ELITE_PRODUCT_STRATEGY.md` completely before Phase 1 work, then read `AGENTS.md`, `CLAUDE.md`, `ToRemove.md`, `docs/MEMORY.md`, all canonical docs required for the current work, and relevant historical audits.
- Run `/caveman ultra` and `/ponytail ultra` before implementation and again after proven cleanup.
- Record exact main SHA, working tree, deployed Cloudflare source identity, Supabase migration head, current Device Agent/protocol version and current test totals.
- Preserve the uploaded ZIP byte-for-byte and preserve `imports/ocade-jarvis/source-original/` unchanged.
- Inventory every donor action/core/memory/dashboard/voice/browser/computer/file/development/wake/confirmation/undo/monitoring/remote-control path.
- Create a donor capability ledger: KEEP, ADAPT, REPLACE, PRESERVE UNUSED, REMOVE FROM ACTIVE.
- Fold the older Phase 0 baseline duties into this phase so the master roadmap begins at Phase 1.
- Record current MCP/tool health and real hardware availability.

### Required proof
- immutable donor hashes unchanged;
- baseline tests recorded;
- exact source/deploy/database identities recorded;
- no execution capability omitted from the donor ledger.

### Exit
Phase 1 is complete only when Claude knows exactly what exists, what is preserved, what is already working, and what must be repaired.

---

## Phase 2 — OCADE JARVIS web GUI and real orb/graph

### Purpose
Replace old active donor GUI behavior with the OCADE web experience while retaining donor execution logic.

### Build / repair
- Keep the old GUI only in immutable provenance.
- Maintain production JARVIS UI under `src/jarvis/`.
- Build the round 3D orb/knowledge graph from real conversations, JARVIS memory, tasks, devices, apps, workspaces and meaningful relationships.
- Support cursor reaction, pan, zoom, semantic zoom, selection, accessible representation and reduced motion.
- Keep the orb simple for new users and grow it only from real data.
- Dim the orb behind conversation/task content without destroying context.
- Maintain dark/light themes and restrained OCADE design language.
- Remove prototype fake replies, fake graph relationships, fake metrics, decorative desktop chrome and duplicate theme/settings controls.
- Verify mobile/tablet/desktop layouts and hydration stability.

### Required proof
- real data drives graph state;
- no horizontal overflow at 360/375;
- dark/light/reduced-motion passes;
- reload/hydration cannot wipe user input;
- old GUI is not on the production path.

### Exit
The JARVIS UI is clean, responsive, data-driven and production-routed without old GUI dependence.

---

## Phase 3 — Route, authentication and account boundaries

### Purpose
Make `/ocade-jarvis` a correct OCADE surface without weakening Chat or authentication.

### Build / repair
- Keep JARVIS in OCADE navigation without replacing Chat.
- Signed-out users may view the safe surface but cannot invoke intelligence, account state or device work.
- Preserve deep-link return after sign-in.
- Keep normal Chat and JARVIS conversation/history logically distinct.
- Ordinary informational questions remain conversation; explicit execution requests become tasks.
- Account switching must clear or re-scope drafts, task state, cached queries and device permissions correctly.
- Refresh/back/forward/multi-tab must preserve correct owner identity.
- Late responses from an old account/conversation must never render into the new one.

### Required proof
Use at least Customer A and Customer B for cross-account isolation and signed-out/direct-route tests.

### Exit
Authentication, route ownership and conversation separation remain correct across reloads, tabs and account changes.

---

## Phase 4 — Hidden server-side Online intelligence authority

### Purpose
Remove donor/customer provider configuration and make OCADE the only intelligence authority.

### Build / repair
- Remove active customer-facing provider-key entry.
- Remove active plaintext provider-key configuration.
- Route JARVIS reasoning and conversation through OCADE's approved server-side Online intelligence authority.
- Keep provider/model/vendor/key identity out of normal UI, logs, exports, errors and device runtime.
- Preserve only the donor concepts needed for orchestration; do not give provider keys to Device Agent/mobile runtime.
- Keep primary/secondary/tertiary configured capacity as legitimate redundancy, not quota evasion.
- If all Online capacity is unavailable, lock JARVIS safely and keep Chat Offline behavior separate.

### Required proof
Secret scan, browser bundle inspection, runtime config inspection, unavailable-capacity tests and normal-answer tests.

### Exit
JARVIS works through OCADE Online intelligence with no customer key management and no Offline fallback.

---

## Phase 5 — JARVIS usage, entitlement and exact account-wide accounting

### Purpose
Make JARVIS usage enforceable, understandable and independent from Chat accounting.

### Build / repair
- Keep server-side JARVIS usage authority distinct from Chat usage.
- Keep owner-approved free-plan accounting behavior and reset windows.
- Ensure account-wide usage is shared correctly across the user's devices.
- Reconcile failed/no-result work rather than charging blindly.
- Make repeated/retried internal work idempotent where required.
- Display clean customer usage state without internal token/provider details.
- Keep Owner unlimited entitlement represented explicitly while internal usage/cost telemetry still records.

### Required proof
Multiple devices/accounts, reset boundary, failed request, retry, concurrent request and meter hydration tests.

### Exit
Usage cannot be bypassed, double-charged or split incorrectly by device.

---

## Phase 6 — Voice foundation and conversational continuity

### Purpose
Make typed and spoken JARVIS use one coherent context.

### Build / repair
- Request microphone only when voice/wake behavior actually needs it.
- Support text-to-text, voice-to-text, text-to-voice and voice-to-voice where platform/audio capability permits.
- Preserve donor STT/TTS/audio-device/echo-guard concepts where useful.
- Add explicit Pause, Continue, Interrupt and End behavior.
- Cleanly release audio on navigation, sign-out, errors and permission revocation.
- Keep spoken and typed turns in the same correct JARVIS context.
- Ensure the user can talk naturally during execution rather than switching to a separate assistant mode.

### Required proof
Permission denial/recovery, device change, interruption, task-in-progress conversation and cleanup tests.

### Exit
Voice is bounded, interruptible and context-correct.

---

## Phase 7 — Existing-browser real-control foundation

### Purpose
Create the first reliable browser execution path using the user's existing browser without an OCADE add-on.

### Build / repair
- Reuse donor `browser_control.py` logic where safe.
- Prefer existing authorized Chrome/profile; detect other installed/default browsers where appropriate.
- Use secure CDP/Playwright/DevTools attachment when available.
- Use semantic DOM/accessibility before vision/coordinates.
- Support multiple tabs/windows, navigation, forms, downloads/uploads, back/forward/reload and existing login state.
- Re-observe after navigation, popup, scroll, zoom, responsive reflow, tab/window change or content mutation.
- Use Take Over and Continue with fresh observation.
- Human handles CAPTCHA, OTP, passkey and protected authentication.
- Never extract browser password/cookie databases.
- Never complete final purchase/payment.

### Required proof
Existing-profile Chrome journey plus clean Chrome, Edge, Firefox and WebKit compatibility passes where applicable.

### Exit
Browser tasks succeed without a customer add-on and without stale-coordinate behavior.

---

## Phase 8 — Tasks, Allowed Apps, Devices and Activity

### Purpose
Turn execution into a first-class, observable OCADE workflow.

### Build / repair
- Represent each task with stable account/conversation/task identity, target device, current step, checkpoint, result and cancellation state.
- Keep task details concise by default and expandable.
- Allowed Apps reflects real capabilities/policy, not a customer plugin marketplace.
- Devices show friendly names and simple Ready/Working/Needs permission/Offline states.
- Activity uses customer language such as “Opened Excel” instead of raw commands.
- Provide global JARVIS execution enable/disable plus appropriate device/capability permissions.
- Remember safe user tool preferences without storing secrets.
- Prevent stale/duplicate task state from leaking between conversations/devices.

### Required proof
Task start/stop/retry, device switch, permission change, activity correctness and multi-account tests.

### Exit
Tasks/devices/activity are real authorities rather than placeholders.

---

## Phase 9 — Data, memory, retention and privacy

### Purpose
Keep JARVIS durable state useful without creating uncontrolled duplicate databases or privacy leakage.

### Build / repair
- Reuse approved account/conversation/message authorities with a clear JARVIS discriminator.
- Keep JARVIS memory logically separate from Chat memory.
- Keep screenshots/frames transient by default.
- Retain only structured durable task results with clear purpose.
- Keep detailed activity retention bounded.
- Keep any future credential vault separate from conversation memory.
- Never retain OTP/CVV/raw provider credentials.
- Ensure delete/archive/retention behavior matches OCADE's current product authorities.

### Required proof
RLS, retention, account isolation, memory namespace and transient-screen tests.

### Exit
JARVIS data is scoped, auditable and privacy-safe.

---

## Phase 10 — Permissions, confirmations and prompt-injection security

### Purpose
Make autonomy safe enough for real device control.

### Build / repair
- Device-sensitive permissions are revalidated at execution time.
- Smart autonomy is default; high-risk actions cross explicit confirmation boundaries.
- Destructive/security-sensitive/public-submission actions use strong confirmation.
- Final payments remain prohibited.
- Treat pages, files, screenshots, model output and tool output as untrusted.
- Prompt injection cannot grant new capability or expand scope.
- STOP and permission revoke affect active and queued work.
- Private-network/router/admin pages require explicit authorization.

### Required proof
Permission bypass, prompt injection, stale grant, account switch, confirmation replay and private-network tests.

### Exit
Policy is enforced in runtime/backend, not only UI.

---

## Phase 11 — Deep-control capability interfaces

### Purpose
Preserve donor desktop/file/app/system capability behind clean OCADE interfaces before broad exposure.

### Build / repair
- Reuse donor computer control, computer settings, app launch, files, screen processing, messaging, reminders, monitoring and developer-agent logic where safe.
- Route them through typed capabilities rather than exposing arbitrary Python/model code.
- Keep unsupported capability hidden/unavailable until a trusted execution path exists.
- Build clear executor interfaces for browser, files, apps, system, terminal, screen and voice.
- Remove direct provider intelligence from device-side executors.
- Preserve donor undo/confirmation concepts under OCADE authority.

### Required proof
Capability registry reports only actually available actions and rejects unsupported operations.

### Exit
The runtime can grow without duplicate ad-hoc execution authorities.

---

## Phase 12 — Foundational web/browser adversarial verification

### Purpose
Prove Phases 1–11 against real failures before deeper hardware expansion.

### Build / repair
Run build/typecheck/lint/format/security/unit/integration/browser journeys and deliberate:
- duplicate send;
- account switch;
- stale result;
- stale coordinate;
- permission revoke;
- cancellation;
- multi-tab;
- malformed state;
- prompt injection;
- session expiry;
- responsive breakpoints;
- cache/service-worker update.

Keep Chat/Offline/Library/Settings/auth regression green.

### Required proof
Use exact evidence labels: SOURCE, LOCAL TEST, MCP BROWSER, REAL BROWSER, DATABASE TEST, LIVE, BLOCKED, UNTESTED.

### Exit
No known Critical/Major foundational web/browser blocker remains.

---

## Phase 13 — Latest UI donor/reference reconciliation

### Purpose
Reconcile the latest JARVIS UI ZIP/reference with the actual production design without carrying prototype scaffolding.

### Build / repair
- Preserve `imports/UI OCADE JARVIS.zip`.
- Reuse useful orb/motion/layout concepts.
- Remove fake responses, random data, placeholder metrics, duplicate history, Plugins surface and unnecessary settings.
- Keep clean OCADE navigation and Settings authority.
- Ensure voice permission timing, task presentation and mobile responsiveness match current owner decisions.
- Verify conversation composer never loses input during hydration.

### Required proof
Visual journey across desktop/tablet/phone, dark/light and loading/error/empty states.

### Exit
UI reference has been distilled into production behavior, not copied blindly.

---

## Phase 14 — Shared protocol and cryptographic device authority

### Purpose
Create one secure contract between OCADE web/cloud and local device runtimes.

### Build / repair
- Version the protocol.
- Give every paired device a unique revocable cryptographic identity.
- Keep private key local.
- Rotate credentials safely.
- Bind requests/results to account, device, task, request, protocol version and timestamp/replay protection.
- Support effortless same-account pairing without manual raw token copying.
- Notify the account of new devices.
- Reject incompatible protocol/agent versions safely.

### Required proof
Enrollment, rotation, replay, revoke, protocol mismatch and cross-account tests.

### Exit
Device identity is unique, revocable, replay-safe and independent from account password.

---

## Phase 15 — Trusted Windows/macOS Device Agent packaging

### Purpose
Turn the active runtime into a customer-installable local execution product.

### Build / repair
- Package Windows 10/11 first and prepare macOS.
- End users must not install Python/dependencies manually.
- Use one Windows tray/menu-bar identity only.
- Start a minimal dormant supervisor at OS login after setup.
- Support health, reconnect, exit, uninstall and credential removal.
- Implement verified update staging, health check and rollback.
- Development installers may be unsigned; public Windows/macOS release signing remains final-release owner action.
- Keep idle CPU/RAM/network extremely low.

### Required proof
Real Windows install/start/duplicate launch/tray/exit/uninstall/reinstall/update health tests.

### Exit
The Device Agent behaves like a reliable product, not a developer script.

---

## Phase 16 — Existing-browser autonomous control without an OCADE add-on

### Purpose
Replace the old extension-era concept completely with existing-browser autonomous control.

### Build / repair
- Remove the assumption that product browser control needs an OCADE add-on.
- Use the normal authorized user Chrome/profile first when browser work is requested.
- Attach through secure CDP/DevTools/Playwright when technically available.
- Fall back to browser/OS accessibility, vision and fresh PyAutoGUI.
- Detect Edge/Firefox/Brave/other installed/default browsers where appropriate.
- Keep isolated browser contexts available for risky/untrusted research not needing personal session state.
- Never extract credential stores.
- Keep browser UI visible by default for user takeover.
- Make browser control work even when DOM automation is unavailable by switching methods safely.

### Required proof
Existing Chrome authenticated journey, browser restart, multi-tab/window, Take Over, download/upload and fallback tests.

### Exit
No active product dependency or user workflow requires an OCADE browser add-on.

---

## Phase 17 — Deep Windows/macOS computer control

### Purpose
Make donor-derived real desktop execution broad and dependable.

### Build / repair
- Reuse donor mouse/keyboard/window/system/app-launch logic.
- Prefer native APIs and existing app windows.
- Maintain live application/process/window mapping.
- Verify foreground target before input.
- Support multi-monitor and DPI scaling.
- Use clipboard safely for complex text and restore previous content where practical.
- User physical input pauses automation; Co-work alternates ownership.
- UAC/admin-password remains a user boundary.
- Avoid unnecessary terminal windows.
- Stop task-owned process trees safely.
- Support common and unknown applications through native -> accessibility -> vision -> coordinates.

### Required proof
Real Windows physical tests across representative apps, DPI/window changes, takeover and STOP.

### Exit
OCADE can perform genuine computer work safely beyond the browser.

---

## Phase 18 — Coding workspace, terminal, Git and isolated execution

### Purpose
Make JARVIS a serious development worker.

### Build / repair
- Scope file/terminal work to selected workspace by default.
- Use direct filesystem operations, terminal commands, Git and tests.
- Use VS Code UI when useful rather than typing every change visually.
- Build lightweight isolation for risky generated/code execution where host support exists.
- Never execute unconstrained model-generated code outside validated/sandboxed authority.
- Support status/diff/branch/fetch/pull/local commit.
- Remote push must be clearly authorized; force-push/history destruction needs stronger confirmation.
- Kill task-owned command process trees on STOP.

### Required proof
Real seeded bug-fix journey with failing test -> edit -> fix -> passing verification.

### Exit
Coding tasks are evidence-backed, scoped and recoverable.

---

## Phase 19 — Background execution, checkpoints, reboot recovery and Remote PC

### Purpose
Allow long work to continue safely beyond one open browser tab.

### Build / repair
- Durable checkpoints before significant boundaries.
- Continue safe local work only where policy/intelligence requirements permit.
- Pause Online-dependent work when disconnected.
- Reconcile state after crash/restart/reboot before resuming.
- Never blindly replay completed destructive actions.
- Support multiple paired computers.
- One UI-control owner per device; different devices may work concurrently.
- Mobile/another device can start, observe and STOP a paired-PC task.
- If one eligible PC is Ready, choose it automatically; ask when ambiguous.

### Required proof
Network loss, browser close, agent restart, reboot simulation, multi-device and late-result tests.

### Exit
Long and remote tasks are durable without unsafe replay.

---

## Phase 20 — Voice, Hey OCADE and correct control surfaces

### Purpose
Combine donor voice/wake strengths with the final OCADE interaction model.

### Build / repair
- Hey OCADE local wake model downloads/verifies once when enabled and remains installed.
- Pre-wake microphone audio stays local.
- Windows uses tray only; do not require a floating desktop mini-control.
- Android floating bubble is the compact mobile control surface.
- Voice can continue while tasks execute.
- Spoken “Stop”, “Wait”, “Continue”, “Use the other file” updates task control immediately.
- Locked-screen security is respected.
- Tray/bubble/web status all reconcile to the same task state.

### Required proof
Wake enable/restart, voice during task, interruption, tray STOP and Android-bubble state tests where available.

### Exit
Voice/wake/control surfaces behave as one coherent OCADE system.

---

## Phase 21 — Online capacity, locked state and recovery

### Purpose
Make intelligence outages bounded and customer-safe.

### Build / repair
- Primary -> secondary -> tertiary capacity selection remains server-side.
- Distinguish slot-local failure from wider provider/project failure.
- Do not use rotation to evade provider-wide limits.
- When all Online capacity is unavailable, stop new JARVIS intelligence turns, preserve task/checkpoint state and show a clear locked/unavailable state.
- Restore automatically when capacity returns.
- Never expose provider/key-slot details.
- Never route to Chat Offline.

### Required proof
Each failure class, all-capacity failure, recovery and in-progress task behavior.

### Exit
JARVIS failure mode is explicit, finite and recoverable.

---

## Phase 22 — Mobile web/PWA and Remote PC foundation

### Purpose
Make the core website usable from Android/iPhone/iPad before deep native/mobile integration.

### Build / repair
- Full responsive JARVIS web/PWA.
- Add-to-Home-Screen friendly behavior.
- Remote PC start/status/STOP from phone/tablet.
- Phone browser may be minimized while PC Agent owns execution.
- Mobile composer/keyboard/task controls remain usable.
- Do not claim unsupported global cross-app control from a pure PWA.
- Keep model/storage/service-worker update behavior stable.

### Required proof
Android-class Chromium and iPhone/iPad WebKit compatibility plus Remote PC.

### Exit
Mobile web is a reliable controller even before deep Android companion features.

---

## Phase 23 — Foundational full verification and merge gate

### Purpose
Close the original foundational roadmap with evidence.

### Build / repair
Re-run:
- protected OCADE regressions;
- browser matrix;
- device protocol;
- Agent packaging;
- browser control;
- voice;
- usage;
- permissions;
- tasks/devices/activity;
- responsive UI;
- recovery/security tests.

Do not depend on paid GitHub Actions; use available trusted local/connector/deployment evidence.

### Exit
The original foundation is proven on current main, not merely accepted from old historical reports.

---

## Phase 24 — Company-scale authority reconciliation and audit ledger

### Purpose
Reconcile the older 57-finding/audit era with current code and current owner authority.

### Build / repair
- Reproduce historical findings on latest main before acting.
- Mark each Reproduced / Fixed / Not reproducible / Superseded / Blocked / Removed.
- Reconcile UI donor, active runtime, schema, deploy identity and MCP toolchain.
- Record one actor/one verifier per physical surface.
- Update durable implementation ledger before long runs or handoff.

### Required proof
Complete current finding ledger and exact latest evidence.

### Exit
No historical issue is silently assumed fixed or silently resurrected.

---

## Phase 25 — Critical and Major safety repair

### Purpose
Eliminate high-severity execution defects before adding more power.

### Build / repair
Re-test and repair as applicable:
- active STOP/cancellation;
- workspace/path/symlink/junction/temp escape;
- terminal/shell boundaries;
- browser private-network/DNS/rebinding/subresource protection;
- session/account ownership;
- stale authentication;
- late responses;
- app identity;
- task authority;
- device permissions;
- update/uninstall;
- debugger/browser detach;
- fresh-screen input;
- voice cleanup;
- enrollment abuse;
- dispatch-time revalidation.

### Required proof
Targeted regression plus strongest available runtime evidence for every still-valid Critical/Major finding.

### Exit
No known Critical/Major safety blocker remains in the scope Claude is about to expand.

---

## Phase 26 — One execution authority

### Purpose
Eliminate duplicate/conflicting execution paths.

### Build / repair
- One broker validates and dispatches device actions.
- Every executor gets cancellation token and immutable validated context.
- Revalidate permission/capability immediately before dispatch.
- Enforce canonical paths/network scope.
- Verify result before settlement.
- Reject late/stale results.
- Keep specialized executors small and capability-focused.
- Avoid duplicate browser/file/app permission authorities.

### Required proof
Cross-executor cancellation, permission revoke, retry/idempotency and result-verification tests.

### Exit
There is one clear execution authority from cloud intent to local result.

---

## Phase 27 — Product UI rebuild and debloat

### Purpose
Make OCADE commercially clean while preserving power.

### Build / repair
- Remove redundant pages/settings/explanations/cards.
- Keep Chat, JARVIS, Library, Settings/Account, Help/Support.
- Keep task controls contextual inside JARVIS.
- Preserve real orb/graph behavior.
- Use OCADE black/white/silver with restrained blue/green/red semantics.
- Use skeleton loading and stable hydration.
- Keep free usage exact and paid usage clean.
- Move long explanations to Help.
- Make errors concise and actionable.

### Required proof
Real visual pass across desktop/tablet/mobile, dark/light/reduced-motion and all important async states.

### Exit
The UI is simpler after the phase than before without hiding necessary control/security state.

---

## Phase 28 — Windows and professional-software elite execution

### Purpose
Make the generic PC control layer strong enough for serious real software rather than a few demos.

### Build / repair
- Use native APIs/scripting/CLI/macros when available.
- Fall back to accessibility, vision and fresh coordinates.
- Support Office, browsers, IDEs, File Explorer, Store/UWP apps, creative/video-editing/CAD/accounting/engineering tools when installed and legally testable.
- Unknown applications should be inspected safely rather than immediately declared unsupported.
- Discover installed apps and user aliases.
- Preserve app-specific automation knowledge where useful without storing secrets.
- Test representative professional software rather than claiming universal proof from one app.
- For video editing, support general workflows such as import media, timeline/navigation, trim/cut operations, text/title/formatting/export where the selected editor exposes accessible/scriptable controls; claim only what was actually tested.
- Keep final user review/confirmation at destructive/publishing boundaries.

### Required proof
Real physical tasks across multiple software families and at least one representative complex creative/professional application available on the machine.

### Exit
The control architecture is general and adaptable; public claims remain evidence-specific rather than “works with every app” without proof.

---

## Phase 29 — Android installed OCADE and floating JARVIS

### Purpose
Add legitimate Android deep control without Play Store dependence.

### Build / repair
- Installation begins from `ocade.in` with simple “Install OCADE” wording.
- Use the Android native components required for true overlay/accessibility/background behavior.
- Guide, never bypass, install/accessibility/overlay/notification/screen-capture restrictions.
- One OCADE identity; no technical helper clutter.
- Floating bubble supports chat, voice, current task/progress, STOP and Open OCADE.
- Use intents/native APIs -> accessibility -> vision -> fresh coordinates.
- Support share/files/media/contact/message/call flows within permissions.
- Final payment/security authentication remains human.
- Keep Chat Offline model persistence stable across normal deployments where storage remains intact.

### Required proof
Pixel emulator/device: Appium full pass, then independent Mobile MCP pass, plus Chrome/DevTools/Playwright web diagnostics.

### Exit
Android deep control is genuinely tested rather than inferred from a mobile viewport.

---

## Phase 30 — iPhone/iPad and macOS supported control

### Purpose
Deliver only Apple capabilities that are technically real and provable.

### Build / repair
- iPhone/iPad: PWA/Home Screen, Siri/Shortcuts, notifications/share flows and Remote PC.
- Do not fake global overlay/arbitrary third-party app control.
- macOS: Device Agent/menu-bar, supported scripting/accessibility/files/browser/vision.
- Hey OCADE on macOS only after required permissions.
- WebKit remains compatibility evidence.
- Seek legitimate real Apple hardware/remote device; paid reservation requires owner approval.
- If Apple blocks a local behavior, use Remote PC/Apple-supported workflow.

### Required proof
WebKit plus real Apple evidence when available, separately labeled.

### Exit
Apple product claims exactly match evidence.

---

## Phase 31 — Owner/Admin/Staff company backend

### Purpose
Give the company a real operational control plane.

### Build / repair
- Canonical privileged surface `admin.ocade.in`.
- Stable server-side roles: Primary Owner, Backup Owner, Admin, Support, Billing, Developer/Operations, Read-only.
- Granular permission overrides.
- Primary Owner can grant staff by email after server resolves verified stable UUID.
- Normal customers see no privileged labels/links/data.
- Staff sees only permitted modules.
- Add customers, usage, devices, JARVIS tasks, security, support, system health and audit modules as real data allows.
- Privileged actions use role/RLS/strong-auth/audit.
- Owner can create scoped temporary Support conversation access.
- Emergency revoke all staff sessions and global JARVIS execution stop.

### Required proof
Primary Owner + Staff + Customer A + Customer B isolation and privilege escalation tests.

### Exit
No admin capability depends on frontend hiding.

---

## Phase 32 — Support, legal and commerce-ready surfaces

### Purpose
Finish company/customer support/legal architecture without blocking current coding on a payment-provider decision.

### Build / repair
- First-party Help/Support and troubleshooting.
- Accurate Terms/Privacy/device-control/permission disclosures.
- Refund/cancellation/payment architecture documentation and hidden UI modules until a real provider exists.
- Do not fake revenue/payment metrics or provider operations.
- Existing entitlement/usage support operations remain functional.
- When future provider work resumes, use hosted/tokenized payment methods and webhook-backed state.
- Keep final purchase prohibited in JARVIS.

### Required proof
Help/legal navigation, access, responsive UI and no fake provider behavior.

### Exit
Support/legal are real and payment-specific UI remains honestly deferred.

---

## Phase 33 — Autonomous testing team and continuous bug hunting

### Purpose
Use all available MCP/test tools as an independent verification team throughout implementation.

### Build / repair
- Existing Chrome: Playwright/CDP actor + Chrome DevTools observer.
- Clean Chrome, Edge, Firefox, desktop WebKit and iPhone/iPad WebKit compatibility.
- Windows: Physical Computer Use.
- Android: Appium first, Mobile MCP second.
- Filesystem for outputs.
- Supabase for Auth/RLS/data.
- Cloudflare for deployed runtime/source identity.
- GitHub for source/merge identity.
- Do not let controllers fight for the same UI.
- Tool failure blocks only its evidence class.
- Test normal, failure, recovery, cancellation, permission, race, account/device switch, restart and adversarial states.

### Required proof
Per-tool health ledger and repeated real journeys during coding, not one ceremonial final run.

### Exit
Every shipped capability has the strongest available evidence.

---

## Phase 34 — Cleanup, release hygiene and first production proof

### Purpose
Simplify the current product only after functionality/security are proven.

### Build / repair
- Run Caveman/Ponytail.
- Review `ToRemove.md`.
- Remove duplicate authorities, stale prototypes, unused dependencies, obsolete files and giant mixed-responsibility code only when replacement proof exists.
- Keep immutable donor/audits/applied migrations.
- Re-run affected tests after every cleanup.
- Merge through reviewed branch/PR.
- Verify deployed production SHA matches merged main.

### Required proof
Clean diff, full regression, production health/source identity.

### Exit
The repo is cleaner without capability/security regression.

---

## Phase 35 — Current-authority re-baseline and donor capability ledger closure

### Purpose
Begin the newest owner-approved hardening wave from the already-built product rather than assuming earlier phases remain perfect.

### Build / repair
- Re-read all active authorities.
- Re-check latest main/deployment/database/agent/Android/MCP state.
- Close every donor ledger classification with exact active replacement path.
- Confirm no immutable donor files are touched.
- Confirm deferred items remain separately tracked.
- Verify Inno Setup/Android environment/browser remote-debugging/test tools actually work now.
- Recalculate commercial-readiness baseline.

### Required proof
Current—not historical—environment and capability status.

### Exit
Every next phase starts from verified current truth.

---

## Phase 36 — TOTP/2FA, active revoke and fail-closed lifecycle repair

### Purpose
Fix the three known high-impact lifecycle/security gaps before further release work.

### Build / repair

#### TOTP/2FA
- Reproduce current fresh authenticator code rejection.
- Trace Supabase enrollment/challenge state, assurance level, factor lifecycle, clock/time-window behavior, retry/cancel and account switch.
- Build clean setup UI with QR/secret handling that never leaks secrets into logs.
- Verify fresh code, wrong code, expired code, replay, cancelled setup, re-enrollment, recovery and privileged challenge.
- Owner may view bootstrap console while sensitive mutations remain locked.
- Require appropriate 2FA for Owner/Admin/Staff privileged work after repair.

#### Active device removal
- Removing/revoking a device during real local work immediately sets cancellation, stops owned input/process/browser work, waits/joins safely, cancels cloud task/action, revokes credentials and rejects late results.

#### Fail closed
- If physical-execution safety/service-control state cannot be read, stop/refuse execution rather than assuming allowed.

### Required proof
Real browser MFA plus real Windows device-remove-mid-action and backend-control-outage adversarial tests.

### Exit
2FA and execution lifecycle safety are production-grade.

---

## Phase 37 — Donor runtime consolidation to ~98% useful reuse

### Purpose
Finish the donor migration without duplicate architectures.

### Build / repair
- For every KEEP/ADAPT donor family, copy/adapt the proven logic into active runtime.
- Rename/wire files cleanly.
- Do not cut/move immutable donor files.
- Preserve donor strengths: browser, mouse/keyboard, app launch, files, document processing, developer agent, screen, confirmations, undo, voice, wake, messaging, reminders, monitoring and remote concepts.
- Replace old GUI/provider-key/customer-plugin/dashboard product paths.
- Consolidate duplicate active implementations.
- Keep model-generated operations behind validated capability/sandbox, not arbitrary execution.
- Add per-family tests and cancellation/security coverage.

### Required proof
Donor ledger shows exact donor -> active runtime mapping and test evidence.

### Exit
Useful donor logic is integrated rather than merely preserved.

---

## Phase 38 — Hardened existing-browser autonomous control

### Purpose
Take Phase 16 from capability to commercial reliability.

### Build / repair
- Existing user Chrome/profile first.
- Automatic safe launch of normal browser/profile when needed.
- Real existing tab reuse when relevant.
- Structured CDP/DOM/accessibility path with automatic fallback.
- Multi-tab/multi-window.
- download/upload chain.
- password-manager interaction without secret extraction.
- human-auth takeover.
- private-network permission.
- stale geometry/focus protection.
- browser crash/restart recovery.
- user mouse/keyboard takeover.
- STOP mid-type/navigation.
- isolated context only when safer/no personal login required.

### Required proof
Playwright/CDP + Chrome DevTools + compatibility browsers + adversarial browser journey.

### Exit
Browser control is reliable enough for daily authenticated workflows.

---

## Phase 39 — Hardened Windows Device Agent and tray

### Purpose
Make Windows local execution commercially dependable.

### Build / repair
- One tray identity.
- Ready/Working/Waiting/Needs permission/Offline/Stopped truthfully.
- Open OCADE, STOP, Pause/Resume where relevant, Exit.
- autostart;
- duplicate protection;
- low idle resources;
- app discovery;
- current-window verification;
- multi-monitor/DPI;
- clipboard restore;
- local cancellation;
- task-owned process trees;
- reconnect;
- update/rollback;
- clean uninstall/reinstall.
- Remove active Windows floating mini-control only after tray replacement proof.

### Required proof
Real Windows Physical Computer Use acceptance suite.

### Exit
The Windows Agent is a polished product surface and reliable local executor.

---

## Phase 40 — Files, Office and elite spreadsheet execution

### Purpose
Make document work substantially smarter than manual clicking.

### Build / repair
- Direct safe filesystem first.
- Explicit folder/workspace grants.
- Trash/undo.
- safe overwrite.
- Excel workbook structural inspection.
- correct formulas/references/lookup logic.
- smart fill/arrays/tables/named ranges/Power Query where appropriate.
- number formats, borders, alignment, conditional formatting, filters, charts/tables where requested.
- preserve unrelated workbook structure/formulas/formatting/macros.
- use real Excel UI where it adds value.
- save/reopen/verify.
- apply same hybrid model to Word/PowerPoint.
- direct PDF extraction/search before visual fallback.

### Required proof
A nontrivial real Excel workbook solved end-to-end with formula and formatting verification.

### Exit
Office work is efficient, accurate and preservation-safe.

---

## Phase 41 — Development, professional and creative/video-editing workflows

### Purpose
Make JARVIS useful across serious software categories using generic control rather than one-off demos.

### Build / repair
- Coding: inspect/edit/test/fix/verify.
- Professional apps: discover capabilities, scripts/CLI/macros/accessibility.
- Creative/video editors: use available scripting/native controls first, accessibility/vision next, coordinates last.
- Support representative workflows such as media import, project navigation, timeline selection, trim/cut, titles/text, format/settings, export where the installed editor exposes safe accessible control.
- CAD/design/accounting/engineering: adapt the same layered control model.
- Unknown app: inspect window/accessibility state and learn the current task safely.
- Store safe user-specific app preferences/aliases, never passwords.
- Never claim “all software works” solely from architecture; maintain tested-app evidence and fallback quality.

### Required proof
VS Code real bug-fix plus representative creative/professional application tasks available on the test PC.

### Exit
The engine is broadly adaptive and evidence-backed across software categories.

---

## Phase 42 — Live conversational JARVIS, wake and partnership

### Purpose
Make JARVIS feel like an active partner while it operates the computer.

### Build / repair
- User can talk/type during execution.
- JARVIS answers “what are you doing?” from real task state and continues.
- User can redirect without losing completed safe work.
- Voice interruption updates cancellation/replanning immediately.
- Hey OCADE model downloads/verifies once and remains.
- pre-wake audio local.
- microphone/speaker/audio-device changes bounded.
- speech output can be muted while voice input remains useful.
- camera/screen permissions requested only when needed.

### Required proof
Live voice conversation during actual browser/Excel/Word task, including redirect, pause, continue and stop.

### Exit
Conversation and execution are simultaneous parts of one JARVIS experience.

---

## Phase 43 — Background work, reminders, proactive behavior and Remote PC

### Purpose
Unify donor background concepts under OCADE Tasks instead of duplicate systems.

### Build / repair
- Adapt donor reminder/background monitor/proactive concepts into canonical task/automation authority.
- User authorizes classes of proactive behavior.
- Long tasks checkpoint.
- Background/reboot recovery reconciles.
- Remote PC works from phone/tablet.
- Multi-PC routing.
- safe notifications/results.
- no blind replay.
- transient screenshots by default.

### Required proof
Scheduled/background, reboot/reconnect, Remote PC and notification journeys.

### Exit
Background automation is durable and controlled.

---

## Phase 44 — Android installed OCADE commercial hardening

### Purpose
Turn the Android foundation into a full supported mobile execution product.

### Build / repair
- Guided website install.
- one OCADE identity.
- floating bubble.
- voice/wake where Android permits.
- app launch/intents/accessibility/vision.
- notifications/share/files/media/contact/message/call.
- account isolation.
- permissions health.
- background/foreground/restart.
- uninstall/reinstall.
- offline Chat model persistence across normal web deployments when underlying storage remains.
- explicit Clear Data/Remove semantics.

### Required proof
Appium then independent Mobile MCP plus web/PWA browser diagnostics and adversarial recovery tests.

### Exit
Android is real-device/emulator proven beyond responsive web.

---

## Phase 45 — Apple-supported paths and real Apple test strategy

### Purpose
Finish Apple support without false claims.

### Build / repair
- iPhone/iPad PWA/Home Screen quality.
- Siri/Shortcuts and supported triggers.
- notifications/share/Remote PC.
- macOS Device Agent/menu-bar.
- macOS accessibility/scripting/files/browser.
- real Apple testing through available hardware/cloud.
- paid cloud requires owner approval.
- keep blocked evidence explicit.

### Required proof
WebKit + physical/remote Apple when available, separately labeled.

### Exit
Every Apple claim has matching evidence.

---

## Phase 46 — Full Owner/Backup Owner/Admin/Staff backend

### Purpose
Complete every privileged workflow and button at production depth.

### Build / repair
- Primary Owner bootstrap to stable UUID.
- Backup Owner grant/protection.
- Admin and staff role/permission matrix.
- Owner Console / Staff Console conditional visibility.
- secure SSO to `admin.ocade.in`.
- staff email -> stable UUID grant.
- pending invite when account absent.
- immediate revoke across sessions.
- 2FA/recent-auth.
- customers/usage/devices/tasks/security/support/system health/audit.
- conversation case access with reason/expiry.
- emergency staff revoke.
- global JARVIS execution STOP.
- no fake data.
- hide payment-specific modules while provider work is deferred.
- every button gets loading/disabled/error/retry/audit/test coverage.

### Required proof
Owner + Backup Owner where available + Staff + Customer A/B browser/database isolation matrix.

### Exit
Privileged operations are usable, auditable and server-enforced.

---

## Phase 47 — Whole-product security, account isolation, UI and performance proof

### Purpose
Attack the integrated product after all major features exist.

### Build / repair
Test:
- auth/session/account switching;
- role escalation;
- RLS/IDOR;
- task/device ownership;
- stale/late work;
- permission revoke;
- prompt injection;
- path/network escape;
- device removal;
- service-control outage;
- restart/recovery;
- rapid/repeated actions;
- mobile/desktop responsive UI;
- accessibility;
- startup;
- memory/CPU;
- idle resource use;
- long-task performance;
- service worker/cache/model persistence.

### Exit
No known Critical/Major integrated-product blocker remains in tested scope.

---

## Phase 48 — Final cleanup and legacy retirement

### Purpose
Remove obsolete active systems only after all replacements have real evidence.

### Build / repair
- Remove active old browser-bridge/add-on product path and forward-retire related schema/control state.
- Remove active Windows floating mini-control.
- Remove active generic customer plugin paths.
- remove duplicate GUI/provider-key/executor systems.
- remove stale dependencies/adapters/docs.
- never rewrite historical donor/audits/applied migrations.
- run Caveman/Ponytail.
- rerun all affected real/MCP tests.

### Exit
The product is simpler and smaller without capability regression.

---

## Phase 49 — Final commercial-launch proof and production identity

### Purpose
Prove the exact release candidate end-to-end.

### Required real-world acceptance journeys
1. Existing authenticated Chrome task.
2. Nontrivial Excel formula/format/save/reopen task.
3. File-management task.
4. VS Code/repository real bug-fix task.
5. Representative professional/creative app task where available.
6. Multi-app browser -> download -> Office/editor -> saved result -> OCADE.
7. STOP during active physical work.
8. User takeover/Co-work.
9. Device restart/reconnect.
10. Tray lifecycle.
11. Active device removal.
12. Android bubble/local/Remote PC journey.
13. Owner/Staff/Customer role isolation.
14. 2FA enrollment/challenge and privileged mutation.
15. Offline Chat model survives a normal web deployment/source update without unnecessary redownload.

### Full release gates
- build;
- typecheck;
- lint/format;
- tests;
- secret/dependency/security gates;
- browser matrix;
- real Windows;
- Android Appium + Mobile MCP;
- Apple compatibility/real evidence where available;
- Supabase Auth/RLS/database;
- Cloudflare production;
- GitHub source identity;
- cleanup regression.

### Final identity checks
- final main SHA;
- deployed Cloudflare SHA;
- Supabase migration head;
- Device Agent version/protocol;
- mobile/runtime version;
- immutable donor preservation state.

### Commercial readiness
Report one evidence-based `Commercial-launch readiness: XX%` with explicit remaining owner/hardware/legal/signing/payment/platform blockers.

100% is allowed only when every required shipped-capability gate is green and remaining deferred items are explicitly outside the launch scope or completed.

---

## Mandatory phase report format

After every phase Claude must report:

`Phase N — Complete / Partial / Blocked`

- Purpose accomplished:
- Tasks completed:
- Files/systems changed:
- Donor files inspected/reused:
- Bugs found:
- Bugs fixed:
- Local tests:
- MCP / real-browser / real-device / physical evidence:
- Security/adversarial evidence:
- Performance/visual evidence where applicable:
- Remaining blockers / untested:
- Commercial-launch readiness: XX%
- Commit / push / deploy identity:
- Exact next phase:

## Fresh-clone execution rule

On a new clean clone, start at Phase 1.

For Phases 1–34, do not mindlessly rewrite already-working implementation. Inspect current main, run the phase proof, fix every gap found, update tests/evidence, and mark the phase complete only when current evidence satisfies this plan.

Then continue Phases 35–49 without stopping for a handoff unless a genuine owner-only action, paid action, unavailable hardware/platform, or destructive approval blocks that specific evidence class. Continue all independent work.

The final goal is a commercially credible OCADE JARVIS that talks naturally while working, controls real software through a safe donor-derived execution engine, verifies its results, survives failure/restart/update, keeps account/security boundaries strong, and exposes only evidence-backed capabilities.
---

# Owner authority addendum — 2026-10-02

This addendum is a follow-up to the existing Phase 1–49 plan. It does not erase or rewrite completed phases, historical evidence, donor provenance, applied migrations, or earlier implementation history. Where this addendum conflicts with an older sentence in this file, this newer owner authority controls future implementation and verification.

## Universal OCADE execution engine instead of per-application product code

OCADE JARVIS must use one universal intelligence-driven execution architecture rather than growing a separate hard-coded controller for every software product. The permanent target is one OCADE task planner and one validated action broker connected to generic browser, computer, files, terminal, mobile, voice, background, and device capabilities. The Online intelligence authority may reason about an unfamiliar application's purpose, commands, menus, file formats, scripting facilities, accessibility controls, documentation, and likely workflows, but every important action must still be grounded in current observed state before execution.

For an unfamiliar installed application, OCADE should first identify the application, version, process, active window, available accessibility/UI tree, supported file/project formats, registered URI or automation interfaces, and any discoverable official API, CLI, scripting, macro, COM, AppleScript, plugin, or documented automation surface. OCADE should use current official documentation when model knowledge may be stale. If an official automation route does not exist or is insufficient, OCADE should use OS accessibility/UI Automation, live screen understanding, screenshots/vision, and finally fresh PyAutoGUI coordinates. Coordinates must never be treated as durable app knowledge and must be refreshed after any layout, focus, scroll, window, display, DPI, navigation, popup, or content mutation.

The intelligence layer may dynamically create small task-specific scripts, command sequences, macros, or temporary helpers when that is the strongest legitimate path for the user's requested task. These temporary task tools must still execute through the local OCADE authority, remain cancellable by STOP, stay within the current task/device/file scope, and be removed or retained only according to explicit lifecycle rules. New system-wide third-party installations, protected elevation, OS-owned permission dialogs, CAPTCHA, OTP, passkey, authenticator, or equivalent human-security boundaries must not be bypassed; OCADE may navigate to the boundary, wait for the user to complete it, detect completion, and immediately continue.

OCADE should learn compact sanitized control recipes after successful work. A recipe may record application identity/version, the reliable control route, stable semantic controls, useful official automation entry points, validation steps, recovery strategy, and measured reliability. It must not store customer passwords, tokens, private file contents, raw screenshots, OTPs, cookies, or other secrets as generic reusable knowledge. When an application version or UI materially changes, stale recipe assumptions must be invalidated and rediscovered rather than blindly replayed.

Specialized adapters may remain only when measured evidence proves that they materially improve reliability, safety, performance, preservation fidelity, or platform integration beyond the universal engine. A new application must not receive bespoke production code merely because JARVIS encountered it. The universal engine must be attempted first. Existing app-specific code that has become redundant must be replaced only after equivalent or better universal-control behavior is proven, then removed through the `ToRemove.md` proof sequence.

The acceptance goal for universal control is that OCADE can encounter an unfamiliar installed application, understand the requested task through the Online intelligence authority plus current official documentation and live observation, select a legitimate execution method, complete the task, independently verify the actual result, recover from normal failures, and do so without requiring someone to first add production source code for that specific application.

## Internal OCADE tool plane and browser control

Customers must not be required to install Playwright MCP, Chrome DevTools MCP, Appium MCP, PyAutoGUI packages, or other developer tooling manually. Development MCPs remain test instruments. The shipped OCADE Device Agent and Android application must expose OCADE-owned internal typed capabilities that provide equivalent product functions through one secure action authority.

The browser capability must support the user's existing authorized browser/profile where technically available, including Chrome, Edge, Brave, Firefox, and other installed/default browsers where practical. A user should complete any required browser/device authorization during setup rather than facing repeated prompts during ordinary work that they already asked JARVIS to perform. OCADE must never weaken or bypass a browser or operating-system security boundary to remove such prompts. If the platform requires a genuine human approval, OCADE may bring the user to the correct prompt once and continue automatically after approval.

For browser work, OCADE should use the fastest reliable path in this order: structured browser/DOM/CDP or equivalent protocol, official browser or site automation interfaces, accessibility, vision, and fresh coordinates. Existing signed-in sessions should be reused without extracting cookies or saved passwords. If Chrome or the selected browser is closed, the Device Agent may open the normal browser/profile automatically for a user-requested browser task. The product must automatically reconnect after normal browser restart/update where supported.

A simple informational request inside JARVIS must remain a conversation and return a normal answer without creating unnecessary device work. A request that asks JARVIS to act, edit, open, control, download, solve, save, send, or otherwise change real state must route into the execution system while remaining in the same conversation. The user may ask questions, ask for status, redirect the task, pause, resume, or stop while execution continues.

## Clarification and target selection

JARVIS must not ask unnecessary questions when context identifies one obvious target. If the user uploads one workbook and says “solve this”, OCADE should use that workbook. If the user says “open Chrome” from an Android phone and does not name another device, OCADE should default to the device the user is currently interacting from. If the user says “open Chrome on my PC”, the same conversation must route the action to the paired PC.

When several plausible files, applications, devices, projects, windows, or destinations exist and choosing the wrong one would materially change the result or create risk, JARVIS should ask one concise clarification and show likely choices rather than asking a vague open question. When one target is overwhelmingly obvious, or when a wrong choice is harmless, easily reversible, and context strongly favors one option, JARVIS may proceed and state what it selected. Destructive, publishing, security, financial, permanent-deletion, or other irreversible boundaries retain explicit confirmation.

For file work, OCADE should preserve the original by default when the user has not clearly asked for overwrite, save the completed copy with a clear name near the source where appropriate, and independently reopen or inspect the result when practical. This behavior applies to Excel, Word, PowerPoint, PDFs, code, media projects, design projects, engineering files, and other supported formats.

## Local file and application discovery

The Device Agent may discover installed applications automatically and maintain lightweight local capability metadata so JARVIS can choose the best app without requiring the user to configure every program manually. The same principle applies to accessible local drives, user folders, external drives, USB storage, and supported network locations. OCADE should maintain lightweight local metadata/indexing rather than continuously uploading or deeply reading every file. File contents should be read only when needed for an authorized task or other explicit product function.

External drives should become discoverable when connected. Learned machine-specific application/file metadata should remain local/device-scoped by default. Generic non-private reliability knowledge may improve reusable OCADE strategies without uploading customers' private screenshots, documents, project contents, credentials, or local secrets.

## Professional work quality

OCADE must choose the strongest execution method for the actual task rather than imitating manual clicking for its own sake. For Excel and other Office tasks, it should inspect the workbook/document structure, choose formulas, tables, arrays, Power Query, direct file manipulation, scripting, application automation, or real UI interaction as appropriate, preserve unrelated content, save safely, and verify the final artifact. The same principle applies to coding, creative work, video editing, CAD, design, accounting, engineering, and other professional software.

Direct project/file modification should be used when it is safer, faster, and semantically correct, but simple work should not become unnecessarily invasive. When an application's own scripting or automation API is the best path, JARVIS may use it and then verify the visible/final application state where practical. When no useful API or script exists, OCADE should use accessibility, vision, and computer-use fallbacks rather than declaring the application unsupported merely because there is no custom adapter.

The product goal is expert-grade, validated work. OCADE must not promise that every result is inherently better than every human professional. It must instead use objective checks, application/file validation, output verification, and iterative correction to reach the strongest demonstrable result.

## Wake word, voice, and always-available companion

The final wake system must support both `OCADE` and `Hey OCADE`, with `OCADE` treated as the fast primary wake phrase while `Hey OCADE` remains fully supported. The production wake model must be CARCC/OCADE-controlled, bundled inside the signed Windows Device Agent and Android OCADE application, and must not require a separate customer model download after the product is installed. This newer rule supersedes older sentences in this plan that say the wake model downloads after Wake Mode is enabled.

The large training corpus must never ship to customers. Hugging Face must not be used as a required source or runtime dependency for the OCADE wake model. Development may use directly licensed datasets, OCADE-generated synthetic speech, owner-approved recordings, or other legitimate direct non-Hugging-Face sources after provenance/license review. The finished bundled model should be small and optimized for extremely low idle CPU, RAM, network, storage, and battery use; literal zero resource use must not be claimed.

Pre-wake audio must remain local. When Wake Mode is enabled, the lightweight companion may remain available in the background like a normal assistant service. On Windows the Device Agent/tray must remain available even when Chrome or `ocade.in` is closed, because wake, background work, reminders, reconnect, and Remote PC depend on it. When necessary, the companion may open OCADE JARVIS automatically. On Android, always-listening wake behavior may use the legitimate foreground-service/notification model required by Android; the user accepts a minimal truthful Wake Mode notification where the platform requires one.

Any nearby person may trigger the wake phrase, while optional owner/speaker recognition may be added as an extra signal for sensitive operations. Speaker recognition must never replace account/device authorization, lock-screen security, recent authentication, or other security boundaries. When the device is locked, JARVIS may answer safe questions/status where the platform allows it but must not perform sensitive file/account/computer actions that require an unlocked session.

During an active JARVIS conversation or task, the user should not need to repeat the wake phrase before every follow-up. Voice input and text output must remain usable when spoken responses are disabled. With spoken replies enabled, JARVIS should speak naturally while working, allow interruption, answer status questions from real task state, and continue or replan without losing already-completed safe work.

## Android and cross-device execution

Windows and Android should share the same planning/task authority, with platform-specific execution adapters rather than separate assistants. Android should use intents/native APIs where available, then Accessibility/UIAutomator-like structured control, UI hierarchy/accessibility, vision, and fresh taps/coordinates. Android must not require separate per-app controllers for every application.

If a user on Android asks to open or use an Android app, OCADE should perform the work on the current Android device when the installed OCADE app has legitimate capability. If the requested work requires a paired PC or the user explicitly names the PC, JARVIS should keep the same conversation and transparently route execution to the paired PC. A user should be able to say from a phone, for example, “Open my PC and finish this Excel file,” and follow the same task until completion.

Initial Android setup should guide the user through the legitimate permissions needed for enabled capabilities so later nuisance prompts are minimized. Android-owned security and permission screens must not be bypassed. Android final evidence uses the stable Pixel 6a Android 14/API 34 Google Play emulator as the primary emulator unless a newer owner decision changes it. A newer Android version may be used as supplementary compatibility evidence only after the stable baseline is green.

iPhone/iPad support remains limited to Apple-supported behavior, PWA/Home Screen, Siri/Shortcuts/App Intents/share/notifications where applicable, and Remote PC. WebKit emulation is compatibility evidence only. Free legitimate remote Apple evidence may be used; any paid reservation remains skipped unless the owner separately approves it.

## Owner Console expansion

The Owner/Staff authority must continue to be server-enforced, audited, and stable-user-ID based. Normal `ocade.in` should expose an Owner Console or Staff Console entry only to legitimately authorized accounts. If keeping privileged operations on `admin.ocade.in` remains materially safer or simpler, retain that separation; if the privileged UI can be presented under normal `ocade.in` without weakening isolation, session authority, 2FA, audit, CSP/origin boundaries, or customer concealment, implementation may choose the smaller and safer architecture. Frontend visibility must never be the authorization boundary.

The Owner customer-management surface should support searching verified OCADE accounts by approved identifiers such as email, name, or account ID and should show safe operational information including verified email, safe profile fields, plan/entitlement, usage state, account creation, devices, sessions, grants, support/security state, and JARVIS/device operational state where appropriate. It must never expose passwords, provider keys, OAuth tokens, raw cookies, MFA secrets, recovery secrets, or equivalent credentials.

Depending on role/permission, the Owner Console should support legitimate plan/access grants and revocation, usage/credit adjustments through append-only authority, session revocation, device removal/revoke, account suspension/disable workflows, supported security recovery, audited account-deletion workflow, and audit history. Permanent account deletion must use a strong audited workflow that first terminates relevant sessions/devices and applies the product's retention/legal/data-deletion rules. The Primary Owner must have strong protection against accidental self-removal or demotion.

Final role testing must include a real temporary entitlement/grant lifecycle and staff-access lifecycle on test accounts when safe: grant, verify the target account receives exactly the intended capability, revoke, and prove the privilege disappears immediately. Do not forge authorization or expose credentials for testing.

## Final test architecture and release sequence

Before merge, execute two deliberately separate assurance waves in addition to normal continuous testing.

First, perform a full source-read audit of the active codebase and current authorities. Read for security defects, races, stale assumptions, duplicate authorities, incorrect lifecycle behavior, dead code, inconsistent policies, error handling, and capability gaps without relying only on existing tests. Reproduce and fix every valid finding, add regression coverage, then rerun the relevant regression suite.

Second, after implementation reaches the final candidate, freeze application source changes temporarily and perform a testing-only evidence wave. During this wave, do not fix product source immediately when a failure is discovered. Finish the complete Windows, browser, Android, Owner/Staff, JARVIS, background, update, file, Office, voice, and security matrix first and record every failure. After the matrix is complete, enter one dedicated fix wave, repair every reproducible release-scope defect at the root cause, run exact regressions and the broader suite, then proceed to cleanup.

The testing-only wave must include actual work, not ceremonial clicking. On Windows verify Device Agent download/install, tray lifecycle, Open OCADE, autostart, background survival, browser control, file discovery, app discovery, Excel, Word/PowerPoint/PDF where available, coding/repository work, multi-app workflows, STOP, Pause/Resume, Take Over, update/rollback, uninstall/reinstall, Remote PC, and software-problem diagnosis. Verify real file/process/application results independently rather than trusting JARVIS's own success message.

For the universal app engine, select several installed applications at runtime, including at least one application that has no specialized OCADE adapter. Do not add app-specific source code merely to make the test pass. Include one case where an official scripting/API route is discovered and used, and one case where structured automation is insufficient and OCADE must use accessibility/vision/fresh-coordinate fallback. Record whether success came from intelligence/planning, documentation/API discovery, app discovery, accessibility, vision, coordinates, file manipulation, or another legitimate route.

For final real-user browser validation, use a preview/staging deployment of the branch first so production/main remain untouched. Use the dedicated authorized Chrome testing profile with Playwright/CDP and Chrome DevTools diagnostics, plus Physical Computer Use for real native/tray interactions. Sign in through Google using the already authorized test account when available; password, OTP, passkey, CAPTCHA, authenticator, or equivalent protected authentication remains a human step. Test the entire reachable product with real tasks, including Owner/Staff surfaces and a temporary grant/revoke cycle on safe test accounts.

For Android, run the full Appium pass first, release/reset controller ownership, then run the independent Mobile MCP pass on the emulator. Include Google sign-in, permission setup, bubble, notification/STOP, Chrome, Files, Settings, at least one additional installed app, basic and complex tasks, background/foreground, orientation, restart/recovery, and Remote PC.

After the dedicated fix wave is green, run Caveman/Ponytail and `ToRemove.md` cleanup. Remove only proven dead/duplicate/obsolete active code and dependencies. Then run the complete acceptance matrix again on the cleaned tree. Follow with a second independent adversarial/attack pass and a final real-user browser/native pass.

No merge to `main` is permitted merely because tests are green. The branch must remain unmerged until all executable Phase 1–49 requirements, this addendum, final source-read audit, frozen testing-only wave, fix wave, cleanup, final regression, adversarial pass, and final real-user pass are complete and the owner explicitly approves the merge.

## Evidence and reporting required by this addendum

The final report must identify the exact branch and SHA, all Phase 1–49 statuses, all addendum requirements, test totals, real-browser/MCP evidence, real Windows evidence, Android emulator/Appium/Mobile MCP evidence, Apple compatibility and blocked physical evidence, Supabase status, Cloudflare preview/production identity, GitHub status, billing-only GitHub Actions limitations separately from real code failures, known accepted limitations, all remaining manual owner-only actions, cleanup/debloat work, unresolved bugs if any, and a conservative commercial-readiness percentage.

A final claim of readiness requires zero known reproducible Critical or Major release blockers and no unexplained required-evidence failure. It does not mean undiscovered bugs are mathematically impossible.

---

# Owner authority extension — 2026-10-03 — Phases 50–56

This extension converts the previously approved post-Phase-49 addenda into explicit numbered phases and adds the newest Owner/Staff/usage/control requirements. It is append-only authority. It does not rewrite or erase Phases 1–49, prior evidence, immutable donor history, applied migrations, or the 2026-10-02 addendum. Where an older sentence conflicts with this newer authority, this section controls future implementation and verification.

## Phase 50 — Universal Gemini/OCADE intelligence-driven software control

### Purpose
Finish the universal execution architecture so Gemini/OCADE intelligence understands real tasks and unfamiliar software while the local OCADE broker remains the validated execution authority.

### Build / repair
- Do not grow separate hard-coded controllers for every application.
- For every task, inspect the real current app/browser/device/file state, application identity/version, process/window, accessibility structure, relevant project/file structure, available official automation surfaces, and current UI.
- Let Gemini/OCADE choose the strongest legitimate route: official API/CLI/script/macro/COM/automation or direct file/project manipulation first; structured browser/app accessibility next; local vision next; fresh PyAutoGUI/computer-use coordinates last.
- Use current official documentation when model knowledge may be stale or insufficient.
- Keep the Device Agent/action broker responsible for account/device/task ownership, scope, permissions, STOP, cancellation, confirmation, idempotency, execution, verification, and recovery. Raw model output must never bypass it.
- Do not add app-specific production code merely because an unfamiliar app appears in testing. Keep a specialized adapter only when measured evidence proves a meaningful reliability, safety, fidelity, performance, or platform advantage.
- Learn only sanitized reusable recipes; never store passwords, tokens, OTPs, cookies, raw private screenshots, or private file contents as generic knowledge.
- Preserve already proven functionality while retiring redundant app-specific paths only after universal equivalence is proven.

### Required proof
- At least one unfamiliar installed application selected at runtime with no new app-specific production code added for that test.
- At least one dynamically discovered official API/script/automation route.
- At least one accessibility/vision/fresh-coordinate fallback case.
- At least one simple task and one complex multi-step task.
- Independent verification of the real result after JARVIS reports success.
- STOP, recovery, stale UI, app restart, rerouting, and user takeover tests.

### Exit
Universal control is complete only when OCADE can understand and operate unfamiliar software through Gemini/OCADE intelligence plus generic execution capabilities without requiring prior per-app coding.

---

## Phase 51 — Wake, browser, background companion and device-runtime hardening

### Purpose
Turn the previously approved wake/browser/device addendum into a commercial runtime phase.

### Build / repair
- Bundle the signed OCADE wake model inside the Windows Device Agent and Android app; no separate customer wake-model download after install.
- Support both `OCADE` and `Hey OCADE`.
- Keep pre-wake audio local and resource use very low.
- Keep the Windows tray/Device Agent available when Chrome or `ocade.in` is closed where wake/background/Remote PC requires it.
- Keep Android Wake Mode truthful through Android's required foreground-service/notification model.
- Prefer the user's existing authorized browser/profile and product-owned browser control; development MCPs remain testing tools only.
- Maintain one action authority across browser, computer, files, terminal, apps, mobile, voice, tasks, background work, and devices.
- Continue fixing runtime/resource/reconnect/update/rollback/tray/bubble regressions until current evidence is green.

### Required proof
Real Windows and Android wake/runtime evidence, existing-browser control, restart/reconnect, update/rollback, STOP, background behavior, and low-resource measurements.

### Exit
Wake, browser, background, tray/bubble and device runtime behave as one reliable OCADE product.

---

## Phase 52 — High-speed Android/mobile control and Remote PC completion

### Purpose
Finish mobile execution so Android control and Remote PC are fast, reliable, account-correct, and share the same intelligence/task authority as Windows.

### Build / repair
- Use one Gemini/OCADE planning authority for PC and Android; only the executor changes by platform.
- Android hierarchy remains intents/native APIs -> Accessibility/UI hierarchy -> vision -> fresh taps/coordinates.
- Do not create per-app Android production controllers merely to make test applications pass.
- Test simple and complex Android tasks, Chrome, Files, Settings, bubble, notifications, Wake Mode, background/foreground, orientation, keyboard, app switching, STOP, restart/recovery, uninstall/reinstall, and Remote PC.
- Reduce unnecessary latency, duplicate observations, repeated setup, excessive screenshots, and redundant network round trips without weakening correctness/security.
- Run Appium first, release/reset controller ownership, then run Mobile MCP independently.
- If a non-owner test account reaches its legitimate usage limit during testing, use the normal audited Owner usage-reset or temporary/permanent unlimited entitlement flow rather than bypassing enforcement.
- The Primary Owner defined in Phase 53 is permanently unlimited while internal usage/cost telemetry still records.

### Required proof
Full Appium and independent Mobile MCP passes, Remote PC routing, simple and complex task success, STOP/recovery, account isolation, and responsive behavior.

### Exit
Mobile control is commercially usable, fast, recoverable, and uses the same universal execution architecture as PC control.

---

## Phase 53 — Integrated Owner and Staff Consoles on normal ocade.in

### Purpose
Remove the separate `admin.ocade.in` product surface and make privileged console visibility a role-driven part of normal `ocade.in` without weakening backend authorization.

### Permanent owner identity
- The initial Primary Owner account is the verified OCADE account for `carecadane28@gmail.com`.
- Bootstrap may locate that verified account by email once, but persistent authorization must resolve/store its stable user UUID/role server-side. Frontend email comparison must never be the authorization boundary.
- The Primary Owner has full product access and permanently unlimited Chat/JARVIS usage while internal usage/cost telemetry continues to record.
- Normal customers see no Owner/Staff Console wording, route hint, disabled menu item, or privileged data.

### Owner Console behavior
- When the Primary Owner signs into normal `ocade.in`, an `Owner Console` navigation entry appears in the normal authenticated product navigation beneath normal product entries such as Chat, JARVIS and Library.
- The Owner Console is served inside the normal `ocade.in` application.
- Retire the active `admin.ocade.in` console/product route only after the integrated replacement has equivalent-or-stronger server-side authorization, recent-auth/2FA, audit, session/CSP isolation, and full regression evidence.
- Sensitive Owner actions require recent 2FA/re-authentication; ordinary viewing does not require repeated nuisance challenges.
- Owner capabilities include safe customer lookup, plans/entitlements, usage reset/adjustment, permanent or time-bounded unlimited access, sessions, devices, staff/roles/permissions, security/support actions, audited deletion flows, global JARVIS controls, system state, and audit history.
- Owner can track staff usage using safe metadata including usage count, time, JARVIS/Chat type, device, plan, last activity, and task-level operational activity where appropriate, but private message contents are not broadly exposed by default.
- Never expose passwords, OAuth tokens, cookies, provider keys, MFA secrets, recovery secrets, or equivalent credentials.

### Staff Console behavior
- When a verified account has an active staff role, a `Staff Console` entry appears automatically in normal `ocade.in` beneath normal product navigation.
- Staff permissions are granular and selected by the Owner per staff member.
- Staff accounts remain on their normal usage limits by default.
- Owner may grant a staff account unlimited usage until manually revoked, unlimited usage until a specified date/time, or return the account to normal limits.
- All grants/revokes are server-side, audited, stable-user-ID based, and reflected immediately.
- If staff role is revoked while Staff Console is open, privileged backend access is revoked immediately, active privileged requests fail closed, the console disappears/redirects automatically, and refresh/relogin must not restore it.
- A revoked former staff account behaves like an ordinary customer unless another active role/entitlement applies.

### Required proof
- Primary Owner signs into normal `ocade.in` and sees Owner Console.
- Normal customer signs in and sees no privileged surface.
- Staff grant -> Staff Console appears -> granular allowed actions work -> disallowed actions fail server-side.
- Staff revoke while console is open -> backend authority disappears immediately -> UI removes/redirects -> refresh/relogin remains revoked.
- Staff normal usage -> temporary unlimited grant -> verify -> timed/permanent behavior -> revoke -> normal limit returns.
- Owner unlimited usage remains unlimited while telemetry records.
- Retired `admin.ocade.in` cannot bypass the integrated authority.

### Exit
Owner and Staff operations are securely integrated into normal `ocade.in` and role/usage changes are immediate, audited, and server-enforced.

---

## Phase 54 — Ownership transfer, additional owners, entitlements and usage authority

### Purpose
Make ownership and privileged-role lifecycle safe, transferable, auditable, and recoverable.

### Build / repair
- Primary Owner may grant an additional Owner role to another verified OCADE account or transfer Primary Owner status to another verified account.
- Ownership grant/transfer requires recent 2FA/re-authentication, explicit high-impact confirmation, target-account verification, audit, and transaction-safe role changes.
- Never allow a transfer to leave the system with no valid Owner.
- Protect the current Primary Owner from accidental self-demotion or self-deletion through ordinary controls.
- A deliberate transfer may change which account is Primary Owner. The former Primary Owner may remain an Owner or be reduced only according to the explicit transfer choice and safeguards.
- Owner-role revocation/transfer/permission change must invalidate privileged sessions/claims immediately where required and force authorization re-evaluation.
- Maintain granular per-staff permissions and audited Owner grants.
- Owner usage remains unlimited by default. Staff/customer limits remain enforced unless an Owner grants a supported temporary/permanent entitlement.
- Owner may reset legitimate testing usage or grant temporary unlimited usage to test accounts/mobile test accounts when needed for the product test matrix; use the normal entitlement authority and audit trail, never a hidden bypass.
- Usage, entitlement, and primary -> secondary -> tertiary Online intelligence capacity/key-rotation behavior remain server-side, hidden from customers, correctly accounted, and tested for recovery/failure without exposing provider identities or keys.

### Required proof
Additional Owner grant, Primary Owner transfer, last-owner protection, staff granular permission grant/revoke, usage reset, timed unlimited, permanent unlimited, expiry/revoke, session invalidation, and audit evidence.

### Exit
Ownership, staff authority, and usage entitlements operate safely without frontend privilege shortcuts or orphaned administrative control.

---

## Phase 55 — Full real-task control, whole-site verification, debloat and second-pass testing

### Purpose
Finish the updated product by proving real work, fixing every reproducible defect, removing redundant hard-coded systems, and proving the cleaned tree again.

### Build / repair
- Continue from the current working tree/failure ledger; do not restart or re-code already proven completed work.
- Test PC control heavily with Gemini/OCADE intelligence across Chrome, files, Office, coding, unfamiliar Windows software, multi-app workflows, creative/professional software, STOP, Take Over, restart/recovery, and Remote PC.
- Include simple and complex tasks. Include DaVinci Resolve or another installed serious video editor when available: discover the strongest legitimate route, perform a real edit/export, and independently verify the output.
- Do not add app-specific production code to make frozen test applications pass.
- Test Android/mobile control deeply and efficiently as defined in Phase 52.
- Sweep the whole site in real Chrome and responsive/mobile contexts. Exercise every relevant page, route, button, menu, form, Devices surface, Owner Console, Staff Console, JARVIS panel, loading/disabled/error/retry state, account switch, permission revoke, session expiry, and security boundary.
- The Devices button/panel, routing, connection, reconnect, revoke, status, stale-device behavior, and related controls must be fully functional and tested.
- Fix every reproducible release-scope defect at root cause and add/update regression coverage.
- Once universal-control equivalence is proven, use Caveman/Ponytail and `ToRemove.md` to remove redundant hard-coded app controllers, duplicate browser/control systems, stale privileged routes, dead code, obsolete wake-download logic, unused build outputs, and unnecessary dependencies.
- Preserve immutable donor/imports, applied migrations, audit evidence, rollback/recovery logic, and specialized paths still proven necessary.
- Rerun the complete affected matrix after cleanup.
- Do not stop after a partial pass because one external evidence class is blocked; continue every independent executable test/fix.

### Required proof
Real simple/complex PC tasks, unfamiliar-app proof, Chrome, Excel, coding, professional/creative task, whole-site button/route sweep, Devices flows, Owner/Staff lifecycle, Android Appium/Mobile MCP, regression suite, performance, security/adversarial, cleanup diff, and cleaned-tree retest.

### Exit
No known reproducible Critical/Major release blocker remains, no unexplained required-evidence failure remains in executable scope, universal control is proven without test-specific app coding, and the cleaned tree passes the required matrices.

---

## Phase 56 — Final commercial-release proof and explicit main-merge gate

### Purpose
Provide the final post-49/post-addendum release proof after every newer requirement is implemented and tested.

### Required final sequence
1. Confirm all executable requirements from Phases 1–56 and all owner addenda are complete or explicitly BLOCKED only by genuine external owner/hardware/legal/signing dependencies.
2. Run the final source-read audit and resolve every valid release-scope finding.
3. Run the final testing-only real-task matrix on the candidate without adding app-specific code to rescue test applications.
4. Fix every reproducible defect at root cause and rerun exact + broad regressions.
5. Run Caveman/Ponytail and `ToRemove.md` final cleanup only on proven redundant code.
6. Rerun the complete cleaned-tree matrix.
7. Run a second independent adversarial/security pass.
8. Run the final real-user Windows/browser/Android/Owner/Staff/whole-site pass against preview/staging.
9. Verify exact source, preview/deploy, Supabase migration/function, Device Agent, Android runtime, protocol, wake-model, and immutable-donor identities.
10. Produce the final commercial-release report with exact branch/SHA, Phase 1–56 status, test totals, real-task evidence, remaining blockers, security state, cleanup performed, deployment identities, and evidence-based readiness percentage.
11. Do not merge to `main` even if all tests are green. Stop at the merge gate and wait for explicit Owner approval.

### Reporting rule
Every meaningful update in Phases 50–56 must stay concise and show current phase/workstream, phases complete out of 56, commercial-readiness percentage, percentage remaining, current blockers, and exact next step. Percentages must be evidence-based.

### Exit
Phase 56 ends only when the release candidate is fully evidenced and waiting solely for the Owner's explicit approval to merge to `main`.

---

# Owner authority addendum — 2026-10-06 — Commercial simplification, universal millisecond-class control and A–Z completion

This addendum is the newest Owner authority and overrides older conflicting implementation detail while preserving historical evidence. The goal is a commercially credible OCADE that feels effortless, fast, clean and trustworthy, with one universal control architecture rather than a growing collection of app-specific automation.

## A. Mandatory starting point: fix the evidence, then simplify

Before new feature expansion:

1. Read `FULL_ERROR_AUDIT_LEDGER.md`, `PONYTAIL_DEBLOAT_LEDGER.md`, `ELITE_PRODUCT_STRATEGY.md`, `FINAL_AUDIT_LEDGER.md`, `docs/DEFERRED_GEMINI_ISSUES.md`, `ToRemove.md`, this `PLAN.md`, and every active authority they reference.
2. Reproduce and fix every valid release-scope error that is still present on current `main`. Never treat an old ledger count as current truth without reproduction.
3. After each fix, run the narrow regression, the relevant real workflow, an adversarial break attempt, and the broader matrix required by the affected authority.
4. Resolve false-success behavior first: OCADE may say a task is complete only after an independent result check proves the requested result.
5. Preserve immutable donor/source provenance, historical audits, applied migrations, legal/licensing evidence, security boundaries, STOP/recovery, and user data. These are not cleanup targets merely to reduce line count.
6. After correctness is proven, run Ponytail Ultra / equivalent deep proof-based cleanup and Caveman-style simplicity review. Cleanup is a first-class product phase, not cosmetic work.

## B. Code-size and simplicity authority

The active product should become materially smaller. Reduce active product, control and UI implementation as far as safely possible whenever equivalent or better behavior can be proved with less code. There is no numeric reduction quota; the correct stopping point is the smallest proven implementation that still preserves required capability, safety, fidelity, recovery, accessibility, verification and commercial reliability. The target applies to active implementation, not immutable donor snapshots, historical audits, already-applied migrations, required generated artifacts, legal/provenance evidence, or tests that still prove real risk.

Reduction rules:

- KISS: prefer the shortest clear linear solution that correctly owns the requirement.
- YAGNI: delete or do not build speculative frameworks, unused extension points, duplicate future-proof abstractions, unused adapters and placeholder systems.
- DRY with judgment: remove true duplicate authorities and repeated mechanics, but never create a high-coupling abstraction merely to remove two similar lines.
- WET threshold: two local copies may be clearer; the third genuinely equivalent implementation is the trigger to consider one small shared helper.
- Prefer one authority per concern.
- Prefer deleting a redundant path over adding a routing layer in front of two equivalent paths.
- Prefer data/configuration over repeated branches.
- Prefer events over polling when an authoritative event exists.
- Prefer existing standard/platform primitives over new frameworks.
- Avoid wrappers that only rename another function.
- Avoid app-name conditionals, giant alias tables, copied menu trees and stored coordinates as the definition of application support.
- No line-count victory may weaken correctness, permissions, accessibility, account isolation, cancellation, update safety, recovery, fidelity or verification.

Every proposed deletion must name the replacement authority and the exact proof required before removal.

## C. Universal control: one engine, no hard-coded application architecture

The final production architecture is one universal OCADE execution engine. Familiar and unfamiliar applications use the same decision path.

Application-specific controllers, aliases, menu maps, click recipes and one-off branches are retirement targets once equivalent or better universal behavior is proven. A specialized adapter may remain only when measured evidence shows a material fidelity, safety, latency or platform advantage that the universal engine cannot yet match. It must remain behind the same canonical broker and may not become a separate execution authority.

The runtime must dynamically discover:

- operating system and device;
- installed application identity and version;
- current active window/project/document;
- available official API/object model;
- local scripting interface;
- CLI/command surface;
- file/project format capability;
- browser DOM/CDP capability;
- OS accessibility/semantic tree;
- Android intent/content/accessibility capability;
- available result-verification method.

For unfamiliar software, OCADE inspects the real installed version and current state, consults current official documentation when required, asks Online intelligence for a bounded plan, validates it, executes deterministic local segments, verifies the real outcome, and returns to intelligence only for recovery or a genuine decision boundary.

## D. Fast-control authority: Gemini is the brain, not the mouse

The normal execution hierarchy is:

1. documented application/native OS API;
2. local CLI, application scripting or object model such as COM where supported;
3. direct file/project transformation when fidelity can be preserved and verified;
4. browser DOM/CDP/structured control;
5. Windows UI Automation / macOS Accessibility / equivalent semantic control;
6. Android intents/content APIs and structured accessibility hierarchy;
7. live vision plus fresh input coordinates only as an emergency fallback when no faster trustworthy semantic route exists.

Do not route ordinary supported work through screenshot -> model -> one click -> screenshot -> model loops.

For a complex known or discoverable task:

user goal -> one detailed bounded plan -> validate -> execute many local machine-native operations -> independent local verification -> recover only if verification fails.

Online intelligence should reason deeply enough to produce a high-quality task plan. Once the plan is approved and bounded, the local executor should not call the model between deterministic sub-actions.

### Latency targets

These are engineering objectives for control overhead, not promises that rendering/exporting/network/model inference takes milliseconds:

- cached intent/capability route: single-digit to tens of milliseconds;
- warm local typed dispatch: target p95 <= 50 ms where the platform permits;
- bounded semantic read/small metadata operation: target <= 100 ms where realistic;
- immediate UI acknowledgement: target <= 100 ms;
- local STOP flag: target <= 100 ms, with controlled cancellable actions quiescing as quickly as the underlying platform permits;
- model inference, app launch, CAD solve/render, media export, upload/download and other intrinsic work are measured separately and must never be falsely described as millisecond completion.

Instrument p50/p95/p99 end-to-end segments. Optimize total verified completion time, not artificial click benchmarks.

## E. Event-driven execution instead of slow polling

Polling means repeatedly asking "is it done yet?" every 400 ms, 1 s, 4 s or 30 s. This introduces avoidable waiting even when the result became available immediately after the previous poll.

The preferred design is event-driven:

executor completes/change occurs -> executor emits authenticated event immediately -> task authority records it -> UI updates immediately.

Replace ordinary high-frequency polling with events/subscriptions/callbacks where there is a trustworthy owner. Keep bounded polling only as reconnect/recovery/fail-safe behavior. Do not remove durable server state, acknowledgements, fencing or recovery merely to gain milliseconds.

Review and either replace or justify the current polling/wait intervals identified by the strategy, including action-result polling, task refresh, STOP acknowledgement and device exchange waits.

## F. Capability cache and learned recipes

Maintain a small sanitized local capability cache keyed by OS/device + app identity/version + interface version where useful.

A recipe may store:

- preferred API/script/semantic route;
- capability identifiers;
- stable semantic selectors;
- required permissions/scopes;
- safe bounded execution pattern;
- independent verification method;
- recovery strategy.

Never store reusable screen coordinates. Never store secrets, raw private screenshots, customer file contents, credentials, cookies, OTPs or MFA material. Invalidate only affected knowledge when app version, interface schema, project context, account scope, security policy or UI generation changes.

## G. Professional software: batch machine-native work

Blender, CAD, Fusion-style engineering, video editing, Office, IDEs and other professional tools must not be defined by manual clicking.

Preferred pattern:

- inspect actual application/version/project;
- discover the strongest supported automation/object model;
- let Online intelligence generate or select a bounded task-specific script/plan;
- execute the complete deterministic segment inside or beside the target application;
- verify semantic/project/output properties independently;
- return to intelligence only on changed assumptions or failed verification.

Examples of the architectural pattern:

- Blender-like tools: native scripting/object API for hundreds of scene changes in one local segment, followed by object/scene/output verification.
- CAD/Fusion-style tools: parametric/object APIs and supported scripting for sketches, dimensions, features, assemblies and exports; verify model properties and exported artifacts.
- Video tools: project/timeline scripting/API where available and media-native tooling where appropriate; verify duration, codec/container, track/timeline/output properties rather than merely checking that a file exists.
- Spreadsheets/documents: object model or structured file operations for bulk work; never enter hundreds of cells manually when a structured transformation exists.
- Browsers: DOM/CDP/structured interaction and assertions before visual interaction.

Heavy computation still takes the time required by the application and hardware. OCADE's job is to eliminate unnecessary orchestration latency.

## H. Vision/input fallback

Vision and raw mouse/touch remain available only because some canvas/custom interfaces expose no adequate semantic control. They are not the default architecture.

When required:

- capture only the relevant fresh window/crop;
- carry window/device/viewport/DPI/generation identity;
- use frame/state deltas where safe;
- reject stale coordinates after any meaningful UI change;
- batch a bounded set of actions when state is stable;
- re-observe after navigation, scroll, zoom, window movement, dialog, monitor/DPI change or other invalidation;
- verify the resulting state.

Do not preserve permanent click coordinates or giant per-app screenshot maps.

## I. Website-first PC architecture

OCADE remains the customer-facing website/PWA. Deep PC control uses one small trusted local Device Agent/broker because normal browser security does not permit unrestricted native window, filesystem, COM, process and OS input control.

The Device Agent is not a second OCADE desktop application. It is the local hands:

- one tray/menu-bar identity;
- autostart after explicit setup;
- very low idle CPU/memory;
- signed authenticated outbound pairing;
- local execution and verification;
- local emergency STOP independent of cloud availability;
- status, STOP, Pause/Resume where meaningful, Open OCADE and Exit;
- safe signed update/health/recovery.

No floating Windows mini-dashboard. No duplicate chat/settings product.

## J. One-button Android setup and minimal customer options

The Android customer experience must collapse setup complexity.

Primary setup surface:

**Set up OCADE**

One press begins a guided setup flow. OCADE automatically completes everything it can legitimately configure and opens only the Android-owned permission/settings screen when Android requires direct user consent.

Customer language stays simple:

- Setting up
- Needs your permission
- Ready

Do not expose implementation vocabulary such as broker, MCP, Appium, UIAutomator, accessibility backend, overlay backend, device key, wake backend, CDP or internal route selection.

After setup, the normal visible controls are intentionally minimal:

- Ready / Offline / Needs permission;
- Wake on/off;
- STOP;
- Remove device;
- floating OCADE bubble.

### Android floating bubble

Keep the Android bubble. Make it visually minimal, responsive and consistent with the website. Collapsed state is a clean OCADE affordance. Expanded state provides:

- mini chat/composer;
- voice/talk;
- concise active task/progress;
- STOP;
- Open OCADE/full JARVIS.

Do not turn the bubble into another settings/dashboard surface.

Routine application discovery is automatic. Remove/hide routine customer-facing "Allowed Apps" complexity once the universal permission model is proven. Ask only at a real new scope/security/consent boundary.

## K. Android distribution and updates without a Play Store launch

Current low-cost direction:

- PWA remains usable without installing a native package.
- Deeper Android control is provided by an optional OCADE-signed APK distributed from the official OCADE website when appropriate.
- Use one stable application ID, one protected long-lived signing authority and monotonically increasing version codes so legitimate in-place Android updates are accepted.
- Publish only release-signed artifacts from the official domain with a signed release manifest, cryptographic hash, version, minimum supported version and rollback/recovery metadata.
- The installed companion checks the signed manifest, downloads only an authenticated update, verifies signature/hash before install handoff, preserves pairing/settings/app data across compatible updates, and asks for Android-owned confirmation only when the OS requires it.
- Never silently install or bypass Android package/security controls.
- Do not implement APK downgrades as rollback. If a released APK is bad, stop rollout and ship a higher-version recovery build; server/web compatibility must fail safe meanwhile.
- Website/PWA code updates through normal verified deployments without forcing APK replacement when native capabilities did not change.
- A Git merge by itself is never considered an Android release. Build/sign/publish/update-manifest/verify is a separate release gate.

### Android "unsupported / unsafe" friction

OCADE itself must not show generic "unsupported" messaging on a compatible device. Detect the exact missing capability and guide the person to the one required action.

Android/Google security warnings are platform-owned and must not be bypassed. Minimize legitimate warning/risk by:

- completing Android developer verification/registration applicable to outside-Play distribution as rollout requirements evolve;
- using a stable package identity and protected release signing key;
- serving APKs only from the official HTTPS domain;
- publishing hashes/release identity;
- avoiding downloaded executable/Dex/native code after install;
- explaining why sensitive permissions are needed at the moment they are requested;
- requesting only the permissions actually required;
- preserving visible STOP and active-control indicators;
- never telling users to disable Play Protect or device security.

If Android Advanced Protection or another platform policy blocks outside-store installation/control, present the PWA/Remote-PC supported path and truthful limitation rather than instructing the user to weaken security.

Re-check current Android developer-verification and sideload requirements before every commercial release because enforcement is changing.

## L. Apple strategy without owned hardware

For current development, maximize legitimate non-physical evidence:

- automated WebKit browser matrix;
- iPhone/iPad responsive viewport matrix;
- PWA manifest/installability/static capability checks;
- touch/keyboard/focus/safe-area/orientation/text-zoom/reduced-motion checks;
- Safari/WebKit API compatibility review;
- Apple-specific source/lifecycle review;
- Shortcut/share/deep-link payload contract tests;
- Remote-PC workflow tests that do not claim local iOS control.

This can establish compatibility evidence, not physical iPhone/iPad proof. Never relabel WebKit emulation as a physical-device pass.

Before broad commercial claims requiring real Apple behavior, use a legitimate real-device service or actual Apple hardware when budget/owner approval permits. iPhone/iPad scope remains PWA/Home Screen + Apple-supported integrations + Remote PC; do not promise Android-style unrestricted cross-app automation.

## M. UI/UX simplification authority

Keep the product visually premium, calm and effortless.

Primary JARVIS experience:

conversation + real-data Orb/threads + current task/status + STOP/Take Over.

Navigation simplification:

- Conversations remains.
- Devices remains.
- Activity is folded into task/history where that removes duplicate surfaces.
- "Allowed Apps" is removed from major navigation after its permission/security function is safely represented by automatic discovery and contextual permission decisions.
- Rare controls move under Advanced; ordinary customers should not choose internal execution tools.

Use the strongest donor visual identity as reference, but reimplement it inside current OCADE web rendering and real OCADE state. Never revive the donor desktop GUI/runtime architecture.

### Shape and surface direction

Prefer soft, premium geometry throughout:

- medium/large rounded rectangles;
- pill/semi-circular controls where appropriate;
- soft bottom sheets/drawers on mobile;
- rounded composer/task cards/dialogs;
- consistent radius tokens rather than arbitrary per-component shapes;
- generous touch targets and spacing;
- restrained borders/shadows;
- no cluttered sci-fi panels merely because JARVIS is visually futuristic.

The reference is the calm usability of modern premium conversational software, not visual copying of another company's proprietary UI.

### Interaction quality

- one obvious primary action per state;
- skeleton/progressive loading instead of layout jumps where useful;
- truthful pending/success/error/blocked states;
- never render failed server reads as "empty";
- immediate local interaction feedback;
- reduced-motion support;
- strong keyboard/focus/dialog lifecycle;
- mobile-first layouts;
- no hidden hover-only mobile actions;
- no fake progress;
- no decorative graph data masquerading as memory/activity;
- expensive visual panels render on demand and remain bounded.

## N. Permission philosophy

Ask once where the platform legitimately permits remembered authorization. Reuse safe scoped grants for routine sub-actions inside the requested task.

Ask again when:

- scope materially expands;
- destructive/permanent deletion occurs;
- financial/public/sensitive submission is reached;
- security/account configuration changes;
- protected OS authentication/elevation is required;
- another existing confirmation rule requires it.

Never replace permission boundaries with permanent unrestricted access.

## O. Customer-visible tool selection is removed

Customers do not select API vs script vs Playwright vs accessibility vs vision vs mouse. The planner/broker chooses the fastest correct legitimate route.

Development/testing tools remain internal evidence tools only.

## P. Usage and cost

Usage should correspond to meaningful intelligence/work, not every deterministic local keypress.

Direction:

- obvious deterministic local sub-actions do not each consume another model turn;
- one complex task should use one detailed planning turn where feasible, bounded local execution, local verification, and model recovery only if needed;
- OCADE's own retry/recovery bug should not silently consume a customer's allowance as though it were new requested work;
- retain server-authoritative accounting, abuse/concurrency limits and truthful task settlement;
- show remaining allowance/task reservation/resumable status clearly;
- measure provider cost per verified completed task, failure cost and support cost before final pricing changes;
- Owner unlimited capacity remains auditable rather than unmetered telemetry.

## Q. STOP, task lifecycle and truth

Unify foreground, background, browser and device work around one lifecycle contract and monotonic cancellation generation.

STOP must:

- set a local cancellation/fence immediately;
- prevent new queued actions;
- cancel owned cancellable local work;
- terminate owned task processes where safe;
- interrupt input automation;
- propagate server/device state;
- distinguish "stop requested" from "device confirmed stopped";
- remain available even if cloud connectivity is impaired.

Completion must be verified from observable output/postconditions. A model statement, tool return code or existing file alone is insufficient.

## R. Testing strategy

Every product change is tested on the cleaned architecture, not only by source inspection.

Required evidence classes include:

- unit/type/lint/build;
- browser semantic and real-browser workflows;
- Windows real Device Agent/tray/control/update/STOP;
- unfamiliar installed application without new app-specific source;
- dynamically discovered API/script application;
- structured-control-insufficient case using live fallback;
- professional project workflow with semantic output verification;
- Android emulator + browser + installed-app automation;
- responsive mobile web;
- WebKit/iOS compatibility matrix;
- security/account isolation;
- Owner/Staff;
- offline/online usage;
- failure/reconnect/background/Remote PC;
- install/update/recovery/uninstall/reinstall;
- cold/warm latency p50/p95/p99;
- memory/CPU/network/battery where applicable;
- accessibility/reduced motion/touch;
- second independent adversarial pass.

Physical-device claims remain blocked unless actually proven on that class of device.

## S. Commercial completion order

1. Reproduce/fix valid current audit failures and trust blockers.
2. Unify task/cancellation/verification semantics.
3. Implement the universal fast execution spine.
4. Introduce event-driven action/result propagation and capability caching.
5. Prove familiar and unfamiliar Windows workflows.
6. Collapse Android setup to one-button guided setup and prove legitimate permissions/control/update.
7. Prove professional workflows through machine-native batch operations.
8. Simplify JARVIS navigation/settings/bubble and adapt donor orb/threads to real data.
9. Run whole-product frozen evidence.
10. Repair reproduced issues.
11. Run aggressive Ponytail/ToRemove debloat and continue removing proven-obsolete active implementation until no further meaningful reduction is safe or useful.
12. Re-run the entire acceptance/security/performance matrix on the smaller tree.
13. Measure commercial reliability, latency and cost per verified task.
14. Deploy only supported/proven scope.
15. Expand to macOS/Apple physical proof and broader commercial ecosystems only after earlier scope is reliable and profitable.

## T. Commercial quality principle

Do not attempt to beat competitors by adding more buttons, more agents, more models or more code.

Compete on:

- faster verified task completion;
- fewer model round trips;
- universal unfamiliar-software handling;
- cross-device continuation;
- trustworthy STOP/recovery;
- preserved user work;
- simple setup;
- minimal cognitive load;
- transparent capability boundaries;
- low cost per verified task;
- real professional output.

The product promise is:

**Tell OCADE the outcome. OCADE chooses the fastest legitimate route, performs the work, verifies the real result, and stays out of the way.**

## U. Elite strategy incorporation without duplication

`ELITE_PRODUCT_STRATEGY.md` remains the complete strategic analysis and rationale produced from the audit. This `PLAN.md` is the execution authority and therefore carries only the selected final decisions, constraints, ordering and acceptance gates rather than duplicating the strategy file verbatim. Every strategy recommendation remains available as supporting rationale, but only recommendations consistent with the latest Owner authority are implementation requirements. When strategy evidence and a newer Owner decision differ, the newer Owner decision in this plan wins.

## V. Final simplification rule — 2026-10-06

There is no percentage target for code reduction. The implementation team must reduce active code, branches, duplicate authorities, hard-coded application logic, polling, customer-facing setup steps, redundant UI, dependencies and maintenance surface as much as safely possible. The correct result is the smallest coherent commercial system that still performs the required work better, faster and more reliably.

The cleanup must prefer removal over replacement layers, prefer one authority over parallel systems, prefer event-driven state over recurring polling, prefer dynamic capability discovery over app-name conditionals, prefer machine-native execution over click automation, and prefer one customer action over several setup controls when the platform permits it.

A smaller codebase is not automatically a better codebase. Cleanup stops wherever further removal would weaken independent verification, STOP, user control, security, account isolation, accessibility, data preservation, recovery, platform compliance, professional-work fidelity, or a measured performance advantage.

All active documentation must point to this plan instead of repeating stale phase ranges. Historical audits, implementation ledgers and immutable donor evidence remain preserved as evidence rather than rewritten into current authority.
