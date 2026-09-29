# OCADE JARVIS Master Commercial-Readiness Plan — Phases 1–49

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
- Read `AGENTS.md`, `CLAUDE.md`, this plan, `ToRemove.md`, `docs/MEMORY.md`, all canonical docs required for the current work, and relevant historical audits.
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
