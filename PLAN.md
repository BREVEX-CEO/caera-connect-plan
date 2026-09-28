# OCADE Active Plan — JARVIS Web Integration Mission

## Mission

The active mission is to add **OCADE JARVIS** as a new OCADE product surface without breaking the verified Chat product.

The original JARVIS ZIP is already a substantial working foundation. This mission treats the extracted JARVIS source as the primary JARVIS engine, preserves its capabilities, replaces only the specifically rejected active pieces, and wires it cleanly into OCADE.

The first priority is the web-controlled JARVIS experience at **/ocade-jarvis**. Browser control is the first deep control capability. Deeper computer and mobile control follows only after the JARVIS web surface and browser-control path are stable and verified.

This plan replaces solved historical audit work as the active implementation plan. Historical audits and migrations remain evidence, but they are not active work items unless a regression is reproduced.

## Non-negotiable decisions

- OCADE JARVIS is a current owner-approved mission and must no longer be treated as retired or future-only code.
- OCADE Chat and OCADE JARVIS are separate product experiences, and JARVIS must not break, replace, or weaken Chat.
- The canonical JARVIS route is **/ocade-jarvis**.
- Signed-out users may view the JARVIS surface, but sending a message, starting a task, using voice intelligence, or controlling anything requires authentication.
- JARVIS is **Online-only** in this mission, and no Offline JARVIS mode may be added.
- JARVIS uses OCADE's approved server-side Online intelligence authority, and customers never paste provider API keys.
- Provider, model, vendor, runtime, infrastructure, storage, and secret identities remain hidden from ordinary customer surfaces.
- The original uploaded ZIP remains untouched as source provenance.
- The exact extracted original source snapshot remains immutable.
- A working extracted JARVIS runtime becomes the active JARVIS engine, and its existing folder structure is preserved initially.
- The active old JARVIS GUI is replaced by the new OCADE web GUI.
- The active manual provider/API-key entry UI and plaintext provider-key configuration are removed from the production working runtime.
- The original generic plugin implementation is preserved but remains unused and customer-hidden in the first mission.
- The original FastAPI phone dashboard is preserved but is not exposed as the final OCADE remote-control architecture.
- Playwright and Playwright/MCP browser capability are integrated as first-class JARVIS browser-control tools.
- Existing PyAutoGUI and desktop-control logic is preserved in the working runtime, but OCADE must not claim browser-only OS control that has not been genuinely proven.
- That restriction applied to the earlier web-only mission. The owner has now explicitly started the deeper-device mission, so the approved Device Agent, browser extension, remote/background and mobile-web roadmap may be documented and implemented while preserving the completed web/browser baseline.
- Final purchase or payment actions are prohibited for JARVIS.
- Smart autonomy is the default, and Autonomous mode remains permission-bound rather than unrestricted.

## Repository layout

- The untouched uploaded archive remains under **imports/ocade-jarvis/**.
- The exact extracted immutable snapshot lives under **imports/ocade-jarvis/source-original/**.
- The active working JARVIS Python/runtime code lives under **jarvis-runtime/** and initially mirrors the ZIP's meaningful structure.
- The production OCADE JARVIS web UI and browser-facing integration code lives under **src/jarvis/**.
- The TanStack route exposes **/ocade-jarvis**.
- Python runtime files must not be dumped indiscriminately into the React source tree.

## Phase 0 — Reconcile the baseline

- Read AGENTS.md, CLAUDE.md, this PLAN.md, docs/MEMORY.md, the relevant canonical docs, and imports/ocade-jarvis/CLAUDE.md before editing.
- Run **/ponytail ultra** and **/caveman ultra** before work starts and after every fresh, resumed, or compacted execution context.
- Record the exact main SHA, build state, test totals, database migration head, and deployed Worker identity.
- Run current verification gates so later failures can be attributed correctly.
- Treat Chat, Library, Settings, authentication, existing Offline Intelligence, usage, public/legal surfaces, and Admin as protected regression surfaces.

### Done criteria

- The starting source and production identities are recorded.
- The existing verification baseline is known.
- No JARVIS code is changed before the authorities are read.

## Phase 1 — Preserve, extract, and inventory the full ZIP

- Keep the uploaded ZIP byte-for-byte unchanged.
- Extract a byte-faithful original snapshot to imports/ocade-jarvis/source-original/.
- Create the working JARVIS runtime from the extracted source without deleting meaningful original capabilities.
- Preserve the existing Python folder structure initially.
- Inventory every meaningful module, entry point, action, dependency, voice path, browser path, desktop path, memory/config path, remote-control path, confirmation path, undo path, development-agent path, and UI path.
- Classify each original subsystem as active reuse, active with required wiring, preserved but unused, GUI replacement target, provider-key replacement target, security-hardening target, environment-dependent capability, or unsupported README-only claim.
- Complete the inventory and continue directly into implementation in the same mission unless an owner-only credential or destructive external action is required.

### Done criteria

- The original ZIP and original extracted snapshot are preserved.
- The working runtime exists separately.
- Every major source module has an evidence-based classification.
- No original source was deleted merely because a replacement will be built.

## Phase 2 — Replace the active GUI while preserving the engine

- Remove the old desktop/HUD GUI from the active production path while preserving it in the immutable snapshot.
- Build the new OCADE JARVIS web GUI under src/jarvis/.
- Make the orb the primary idle visual and transition automatically between orb-focused, conversation-focused, voice, task, and browser-control states.
- Keep the initial orb clean and restrained, then grow real neural threads, nodes, density, and structure as JARVIS conversations, tasks, memory, devices, and allowed-app history grows.
- Make the graph a real data-driven visualization rather than random decorative lines.
- Make the graph cursor-reactive, zoomable, pannable, hoverable, selectable, and semantically zoomable.
- Selecting a node shows what category of data is represented and what stored information exists without automatically opening or exposing the full underlying private content.
- Keep the orb visible as a dim background aura when conversation content needs the foreground.
- Support dark and light themes, with monochrome as the default and optional custom orb/accent color.
- Keep the left navigation compact by default and expandable/collapsible when needed.
- Include Conversations, History, Tasks, Activity/Logs, Allowed Apps, and Devices.
- Keep Permissions in a focused drawer or modal.
- Respect reduced-motion preferences.

### Done criteria

- The new GUI renders at /ocade-jarvis without using the old active HUD.
- The orb/graph is real, responsive, accessible, and driven by application data.
- Existing OCADE UI remains unaffected outside intentional navigation changes.
- Desktop, tablet, and phone widths have no horizontal overflow.

## Phase 3 — Route and authentication

- Add JARVIS to the main OCADE navigation without replacing Chat.
- Allow signed-out visitors to load the JARVIS surface.
- Require sign-in before sending, starting a task, invoking intelligence, using account data, or controlling a browser/device.
- Preserve the return target so sign-in from /ocade-jarvis returns there.
- Keep JARVIS conversations logically separate from normal Chat while reusing the approved account/conversation infrastructure.
- Interpret ordinary informational prompts as normal JARVIS answers and explicit work/control requests as tasks.
- Do not automatically convert normal Chat into JARVIS control.

### Done criteria

- Direct route loading, authentication return, navigation, refresh, and deep linking work.
- Signed-out users cannot execute JARVIS actions.
- Chat and JARVIS history remain distinguishable.

## Phase 4 — Remove manual provider configuration and wire Online intelligence

- Remove customer-facing API-key entry from the active runtime.
- Remove active plaintext provider-key files from the production working runtime.
- Route JARVIS intelligence through the existing OCADE server-side Online intelligence authority.
- Keep provider identity and provider keys server-side and out of the browser bundle, JARVIS UI, logs, exports, and customer errors.
- Preserve old provider-key code only in the immutable original snapshot.
- Do not add Offline JARVIS.

### Done criteria

- A signed-in user can ask JARVIS a normal question through the approved Online authority.
- No customer-visible key entry remains.
- No provider secret is present in client code or active runtime configuration.

## Phase 5 — JARVIS usage authority

- Give JARVIS a usage authority separate from Chat while keeping the same Free, Pro, and Max plans.
- Keep the existing Chat allowance unchanged.
- Use separate JARVIS accounting for successful internal model/tool work because agentic tasks consume more resources.
- Show a simple JARVIS usage meter instead of raw internal charges.
- Reconcile failed or no-result internal steps so customers are not blindly charged.
- Allow free-tier JARVIS to choose resource-efficient execution strategies while maintaining safe useful outcomes.
- Anchor enforcement to the account.

### Done criteria

- Chat usage and JARVIS usage change independently.
- Internal JARVIS work is measured without double charging failures.
- Usage is enforced server-side.

## Phase 6 — Voice

- Support typed and voice tasks in the same JARVIS context.
- Request microphone permission when the user first enters JARVIS.
- Use **Hey OCADE** as the default wake phrase where wake behavior is genuinely supported.
- Show explicit Interrupt, Pause, Continue, and End controls.
- Do not overload ordinary orb clicks as the speech-interrupt command.
- Use one professional audio-reactive visual language for user and JARVIS speech.
- Ensure voice stops cleanly on error, navigation, permission loss, or sign-out.

### Done criteria

- Voice start, permission denial, interrupt, pause, resume, end, error, and reconnect states are bounded.
- Voice tasks and typed tasks share the correct context.

## Phase 7 — First real browser-control capability

- Integrate Playwright and required Playwright/MCP capability so customers do not configure them.
- Support an isolated automation browser and an explicitly authorized real-browser path.
- Choose control methods in this order: structured DOM/accessibility information, Playwright/browser tooling, authorized browser integration, visual understanding, and coordinate fallback.
- Allow one task to work across multiple tabs/sites.
- Show a collapsible live browser panel.
- Provide Take Over that pauses automation and returns control to the user.
- Permit ordinary login assistance when safe and authorized, but pause for CAPTCHA, passkeys, OTP/2FA, or other human-authentication boundaries.
- Never bypass CAPTCHA or account-security controls.
- Never perform the final purchase/payment action.
- Require explicit confirmation before sensitive legal, financial, medical, security, or public-posting submissions.
- Re-observe after viewport, tab-size, window-size, zoom, responsive-layout, scroll-context, or screen-size changes.
- Never trust stale coordinates after layout changes.
- Prefer semantic identity and fresh geometry, and use coordinates only after re-anchoring.
- Verify meaningful actions by observing the resulting state before continuing.
- Stop and report when the plan cannot be completed safely.

### Done criteria

- JARVIS completes real browser tasks through OCADE under test accounts.
- Resize, zoom, navigation, dynamic layout, and responsive breakpoints do not cause stale-coordinate clicking.
- Take Over and Stop work reliably.
- Sensitive boundaries behave as documented.

## Phase 8 — Tasks, Allowed Apps, Devices, and Activity

- Represent a JARVIS Task as a multi-step workflow with a plan, current step, progress, result, Stop state, and Resume state.
- Show a concise plan for complex tasks and proceed automatically unless a sensitive action needs approval.
- Detect or enumerate browser/web applications JARVIS can use and expose them through Allowed Apps.
- Prepare Allowed Apps to represent later desktop/mobile software capabilities without claiming unsupported control now.
- Remember preferred coding, editing, engineering, and productivity tools when JARVIS memory is enabled.
- Use remembered preferences automatically when unambiguous and ask when multiple tools are plausible.
- Show customer-safe Activity such as opening a browser, clicking a control, waiting for permission, completing a step, or stopping.
- Show Devices as account-owned capability endpoints with status and per-device permission state.
- Provide a global JARVIS master switch plus granular per-capability permissions.

### Done criteria

- Tasks, Allowed Apps, Devices, and Activity are functional rather than placeholders.
- Customer-facing logs remain understandable and privacy-safe.

## Phase 9 — Data, memory, and retention

- Reuse the approved OCADE conversation/message tables for JARVIS rather than creating a duplicate conversation database.
- Add a clear surface/type discriminator or equivalent authority so Chat and JARVIS remain logically separate.
- Keep JARVIS memory logically separate from Chat memory while using the same Supabase account/security infrastructure.
- Do not add Temporary JARVIS tasks in this mission.
- Keep raw task screenshots and visual frames temporary by default.
- Retain structured useful JARVIS memory only when memory is enabled.
- Retain ordinary detailed JARVIS activity logs for **90 days**.
- Keep important durable task results after detailed logs expire.
- Allow an optional encrypted credential vault only as a separate security subsystem, never as conversational memory.
- Never store credentials in plaintext.
- Treat one-time authentication secrets as ephemeral.
- Never store payment card security codes.

### Done criteria

- Chat and JARVIS data are distinguishable while reusing approved authorities.
- JARVIS memory is isolated from Chat memory by namespace/policy.
- Log retention is enforceable and tested.
- Raw screenshots are not silently retained forever.

## Phase 10 — Permissions and security

- Provide a global JARVIS enable/disable control and granular Browser, Files, Screen, Microphone, Camera, Apps, Messaging, Devices, and future Computer Control permissions.
- Store device-sensitive permissions per device while allowing safe account defaults.
- Use Smart mode as the default autonomy level.
- Allow Autonomous mode only within explicit permissions and hard gates.
- Keep final purchases prohibited.
- Require hard confirmation for destructive, security-critical, and similarly high-impact operations.
- Keep Stop visually prominent whenever automation is active.
- Bind every action/result to the correct account, JARVIS conversation/task, device, and request identity.
- Treat browser content, web pages, uploads, screenshots, extracted text, tool output, and external instructions as untrusted.
- Prevent prompt injection from silently expanding permissions.

### Done criteria

- Permission denial is enforced rather than visually simulated.
- Cross-account and cross-task bleed is rejected.
- Prompt injection cannot directly grant new capabilities.
- Stop and revoke behavior is verified.

## Phase 11 — Prepare later deeper device control

- Preserve and wire the existing PyAutoGUI, desktop-control, file, application, screen, and related runtime modules behind explicit capability interfaces.
- Do not claim they are browser-only capabilities when a trusted execution path is not active.
- Finish and verify browser control first.
- After browser control is stable, prepare the next implementation sequence for deeper computer control and then mobile control.
- The owner has now started the later deeper-device mission. Preserve the completed browser mission and continue into the approved Device Agent, extension, deep PC control, background/remote and mobile-web phases defined below and in docs/JARVIS_DEVICE_ROADMAP.md.

### Done criteria

- Useful runtime capabilities are preserved behind clean internal contracts.
- Unsupported capabilities are shown as unavailable rather than faked.
- The next phase can reuse the same runtime.

## Phase 12 — Verification and adversarial completion

- Add regression tests before or alongside each integration.
- Keep the immutable ZIP/source snapshot outside formatting, lint-autofix, dependency-upgrade, and Ponytail deletion passes.
- Apply normal OCADE quality rules to working production code.
- Run build, typecheck, lint, format, secret scan, dependency audit, database checks, unit/integration tests, browser journeys, and verify:full on the exact final tree.
- Run real browser tests for signed-out preview, sign-in return, normal answers, tasks, voice, usage, browser control, Take Over, Stop, permissions, resize/re-anchor behavior, multiple tabs, login takeover, error recovery, and responsive UI.
- Deliberately attempt cross-conversation, cross-account, stale-coordinate, duplicate-send, concurrency, cancellation, permission-bypass, and prompt-injection failures.
- Report LIVE, REAL BROWSER, LOCAL TEST, DATABASE TEST, SOURCE-PROVEN, BLOCKED, and UNTESTED evidence separately.
- Do not call future computer/mobile capability complete until it is actually executed on supported real hardware.

### Done criteria

- Existing OCADE Chat and Offline regression suites remain green.
- JARVIS tests and browser journeys are green.
- No unresolved Critical or Major JARVIS web-launch blocker remains.
- Source SHA, deployed SHA, migration head, and customer-visible behavior agree.

## Ponytail Ultra rules

- Ponytail Ultra must never delete or rewrite the uploaded original ZIP.
- Ponytail Ultra must never delete or rewrite source-original.
- Ponytail Ultra may simplify the working runtime only after capability proof.
- Ponytail Ultra should prefer routing and reuse over duplicate authorities.
- Ponytail Ultra should remove newly introduced dead integration code, duplicate adapters, obsolete active GUI code, active plaintext key-entry code, and unreachable production wiring after replacement proof.
- YAGNI means **You Aren't Gonna Need It**, so speculative abstractions outside the approved mission should not be added.
- KISS means **Keep It Simple, Stupid**, so the integration should use the smallest clear authority chain that preserves security and capability.
- File-count or LOC reduction is never a reason to weaken functionality, security, tests, evidence, accessibility, or source provenance.

## Completion report

The final handoff must state the exact source SHA, deployed SHA, database migration head, files added/changed/removed, original-source preservation state, working-runtime state, JARVIS route state, voice state, browser-control state, usage state, permissions state, test totals, browser-journey totals, remaining blockers, and exact next phase.

The mission is not complete merely because the ZIP extracts or the GUI renders. It is complete only when the routed JARVIS web experience works end-to-end without breaking the existing OCADE product.


# Approved continuation — deeper device mission

The completed web/browser mission above remains authoritative and protected. Claude's last implementation stopped after the web/browser JARVIS build was merged and deployed, with the remaining proof gaps explicitly recorded: real Online-model path from the restricted sandbox, real speech service, and real-browser control on an actual desktop. The latest uploaded UI ZIP on main is `imports/UI OCADE JARVIS.zip`.

The canonical continuation decisions live in `docs/JARVIS_DEVICE_ROADMAP.md`. The phases below extend the existing plan; they do not replace Phases 0–12.

## Phase 13 — Reconcile latest UI reference and completed baseline

- Preserve every completed browser/web phase and every already-green Chat/Offline regression.
- Preserve `imports/UI OCADE JARVIS.zip` untouched as the latest primary visual/code reference.
- Inspect and reuse useful UI source patterns/components without shipping prototype-only fake replies, random graph data, fake status values, duplicate theme controls, desktop-window chrome, placeholder alerts, Figma-only scaffolding or a customer Plugins surface.
- Production JARVIS navigation becomes Conversations, Tasks, Activity, Allowed Apps and Devices. Remove duplicate History.
- JARVIS Settings reuses OCADE Settings.
- The orb becomes a genuine round 3D aura/knowledge graph driven by real conversations, JARVIS memory, tasks, apps, devices, projects and useful work relationships.
- Double-click enters persistent Orb Focus; nonessential controls may fade after roughly eight seconds while focus remains.
- Correct the earlier microphone behavior: JARVIS opens text-only and requests microphone permission only when Voice is first used.

### Done criteria

- Existing production behavior still passes its baseline.
- The latest UI ZIP is preserved and documented.
- Prototype-only fake behavior is gone from the production path.
- Navigation and voice-permission behavior match owner decisions.

## Phase 14 — Shared protocol and secure device authority

- Create one versioned OCADE device protocol shared by website, Device Agent and browser extension.
- Every paired device gets its own unique cryptographic device identity and automatically rotated credential; users never handle tokens.
- Same-account device enrollment is automatic and effortless, with a customer-safe new-device notification.
- Add instant remote revoke/kill for a lost device.
- Bind commands/results to account, device, task, request, protocol version and permission state.
- New website versions refuse unsafe commands to incompatible agents/extensions and trigger a safe update path.

### Done criteria

- Cross-device identity is unique, revocable and testable.
- No password or shared account token is used as the durable device credential.
- Old/incompatible protocol versions fail closed.

## Phase 15 — Windows/macOS trusted Device Agent

- Support Windows 10/11 and modern macOS first; Linux is later.
- Package the working JARVIS runtime into an OCADE-controlled signed production executable/application so users never install Python or packages manually.
- Use one tiny tray/menu-bar presence only; never duplicate icons.
- Start a minimal dormant supervisor at OS login with bounded resource use.
- Active control ends when OCADE/Chrome closes unless an already-authorized task is still running or the user explicitly enabled Background/Wake Mode.
- Already-authorized background work may finish or pause safely, sync its state, then release active execution.
- Exit stops control after warning about active tasks.
- Uninstall removes the local agent/services/cache/device credentials and clearly states that PC control, background execution and wake features stop; cloud history remains separately managed.
- Auto-update only from signed OCADE releases and roll back automatically when health checks fail.
- Public production installers must be signed/notarized; unsigned artifacts are development-only.

### Done criteria

- One-click setup works without Python/package setup.
- Background lifecycle matches the approved rules.
- Update/rollback and uninstall are verified on real Windows and macOS before production claim.

## Phase 16 — Official browser extension and real-browser control

- Build a minimal official OCADE browser extension when the authorized real-browser path requires it.
- Prepare it for Chrome Web Store publication with clear OCADE identity, secure account linking, navigation to `ocade.in` and `/ocade-jarvis`, visible connection/status controls and minimal permissions.
- Chrome is first-class; Edge/Chromium follows where compatible; Safari support is only added when genuinely reliable.
- Default automation uses a safe OCADE-controlled browser context.
- Use the person's existing Chrome/profile only when the task needs their authenticated session or the user explicitly requests it.
- Control only the authorized OCADE tab/session and never inject into or close unrelated tabs.
- Browser/password-manager autofill may operate normally, but JARVIS never extracts stored passwords and pauses at CAPTCHA, OTP, passkey and equivalent boundaries.

### Done criteria

- The extension passes permission review and browser regression tests.
- Existing-browser control is proven on a real desktop without profile-wide injection.

## Phase 17 — Deep Windows/macOS control

- Prefer application-native APIs/scripting, then direct file/project operations, then accessibility/UI automation, then local vision, then freshly observed coordinates as the last fallback.
- Detect useful installed applications locally after permission.
- Allowed Apps uses simple Always Allow / Ask / Never Allow rules.
- One task at a time owns mouse/keyboard/UI control. Safe non-conflicting background tasks may run in parallel under limits.
- Physical user mouse/keyboard input pauses UI automation immediately and stays paused until Continue, except in explicit Co-work mode.
- Resolve monitor/window automatically from context and ask only when ambiguous.
- Direct code/file operations stay inside the selected workspace unless broader scope is explicitly granted.
- Whole-computer file access is never the silent default.
- Prefer Trash/Recycle Bin; permanent deletion requires confirmation.
- Program install/uninstall and major system-setting changes require confirmation at the system-changing step.
- UAC/admin-password prompts are never bypassed.
- Restart/shutdown/log-out requires confirmation unless the user's current instruction explicitly requested that exact action.

### Done criteria

- Real Windows and real macOS control is independently proven.
- Stop, Take Over, Co-work, multi-monitor, scope and destructive-action rules all work.

## Phase 18 — Coding workspace and lightweight sandbox/container execution

- Within an explicitly selected project/workspace, JARVIS may directly edit files, run terminals, tests, builds, Git and development tools.
- Local edits/tests/commits may run automatically inside approved scope.
- Push, force-push, branch deletion, production deployment and destructive history changes use stronger permission/confirmation rules.
- Provide an OCADE-managed lightweight sandbox/container capability without requiring ordinary users to manually configure Docker Desktop.
- Prefer the smallest secure host-appropriate runtime; lazily install only what is needed.
- Verify signed/checksummed runtime artifacts, isolate workloads, cap CPU/RAM/storage, shut idle environments down and remove unused temporary state.
- Do not claim a runtime is bug-free or virus-proof; use integrity verification, isolation, least privilege and reproducible releases instead.

### Done criteria

- Coding tasks can execute safely and directly inside scoped workspaces.
- Container/sandbox resource use stays bounded and setup remains effortless.

## Phase 19 — Background execution, checkpointing and remote PC control

- Explicitly started or scheduled tasks may continue after the website closes.
- When internet is lost, continue only safe purely local steps that do not need network/intelligence, checkpoint state and pause at the next boundary.
- Long-running tasks create durable checkpoints.
- After reboot, restore state automatically, resume safe steps and request approval before a sensitive next action.
- A signed-in phone/tablet/other device may remotely start, stop, observe and control work on a paired PC.
- One controller/task owns active UI control at a time; others may observe status or queue.
- Add web notifications plus optional OS notifications.
- Provide one global STOP JARVIS control in the website, active mini-control and tray/menu-bar surface.

### Done criteria

- Close-browser, disconnect, reboot and cross-device recovery are proven without repeating completed steps.
- Remote-device takeover cannot create concurrent UI-controller races.

## Phase 20 — Voice, wake and mini-control surface

- JARVIS starts text-only.
- Voice/TTS begins only when the user presses Voice or enables wake/voice behavior.
- If TTS is disabled, voice input can still be understood and responses remain text-only.
- PC `Hey OCADE` wake-word detection stays local/private and only activates Online processing after wake detection.
- Background wake requires explicit Background/Wake Mode.
- Voice supports spoken and visible Stop, Pause, Continue and Cancel/End.
- Preserve useful conversational/voice behavior from the original JARVIS source without restoring retired provider-key or old GUI architecture.
- Desktop may expose an optional movable round OCADE mini-control. By default it appears during active device work; the user may pin it while control is enabled.
- Mini-control shows compact chat/status, task progress, Stop/Continue and Open OCADE.

### Done criteria

- Voice, local wake detection and mini-control are real and interruptible.
- No always-listening cloud audio path exists.

## Phase 21 — Online capacity and customer-safe timeout state

- JARVIS continues through the existing OCADE server-side Online Intelligence authority.
- Provider/model/vendor/key identity remains hidden from customers.
- Exactly three configured server-side capacity/key slots remain primary, secondary and tertiary.
- Fail over only when the failure is actually slot-local or when independent capacity is genuinely available.
- Do not rotate keys merely to evade a project-wide/provider-wide quota.
- If all configured Online capacity is genuinely unavailable/exhausted, stop new JARVIS intelligence turns, preserve active task checkpoints and show a customer-safe temporary timeout/unavailable state until capacity returns.
- Never surface provider names, model names, key-slot names or provider error bodies to customers.

### Done criteria

- Slot-local failover works.
- Project-wide quota does not create pointless key cycling.
- The timeout state is account-safe and recovers automatically.

## Phase 22 — Mobile web/PWA and remote-PC control

- Android, iPhone and iPad remain website/PWA-first with Add to Home Screen.
- No mandatory native mobile companion/app is part of this roadmap.
- Add a dedicated Remote PC subsection so mobile can start, stop, observe and control paired-PC tasks.
- PC execution continues independently when the phone browser is minimized because the PC Agent owns the work.
- A normal mobile website/PWA must not claim unrestricted OS-wide control of arbitrary third-party apps, persistent overlays over other apps or background wake that the platform does not actually permit.
- Use supported browser/OS capabilities where genuinely available and show unsupported cross-app control as unavailable rather than faking it.
- Provide a compact round launcher/control inside the installed PWA/web surface with clean rounded touch UI.

### Done criteria

- Android and iOS web/PWA journeys are verified separately.
- Remote-PC control works from mobile.
- No unsupported native capability is represented as complete.

## Phase 23 — Full verification, adversarial completion and merge

- Run the complete existing verification matrix plus real Windows, real macOS, Chrome-extension, Android web/PWA and iOS web/PWA tests.
- Re-run source preservation, build, typecheck, lint, format, secret scan, dependency audit, database tests, Edge checks, unit/integration tests and browser journeys.
- Test device revocation, credential rotation, update rollback, protocol mismatch, offline/reconnect, crash/reboot recovery, concurrent-device requests, user takeover, Stop, prompt injection, stale screen geometry, malicious page content, file-scope escape, destructive actions and extension-permission abuse.
- Report SOURCE-PROVEN, LOCAL TEST, REAL BROWSER, REAL WINDOWS, REAL macOS, REAL ANDROID WEB/PWA, REAL iOS WEB/PWA, DATABASE TEST, LIVE, BLOCKED and UNTESTED separately.
- Work on a dedicated branch and merge cleanly to `main` only when the relevant phase gates are green.
- Do not treat GitHub Actions as the only release path; the current deployment history shows the Actions job can fail to receive a runner while Cloudflare still deploys from main.

### Done criteria

- All completed browser/web behavior remains green.
- Every newly claimed device capability has real-hardware evidence.
- The final source SHA, deployed SHA, protocol version, agent version, extension version and database migration head agree.

## Owner-approved company-scale continuation — 2026-09-28

This continuation is the newest active authority. It extends the completed and in-progress JARVIS phases above; it does not erase their evidence. Where an earlier phase describes now-superseded navigation, microphone timing, mobile scope, usage presentation, or cleanup order, this continuation wins for current implementation.

### Current authority set

- Read `AGENTS.md`, `CLAUDE.md`, this `PLAN.md`, `ToRemove.md`, `docs/COMPANY_PRODUCT_AUTHORITY.md`, `docs/JARVIS_DESIGN_SYSTEM.md`, `docs/OWNER_ADMIN_BACKEND.md`, `docs/BILLING_AND_GLOBAL_COMMERCE.md`, `docs/MOBILE_DEVICE_CONTROL.md`, `docs/TESTING_TOOLCHAIN.md`, `docs/SUPPORT_LEGAL_SECURITY.md`, and the canonical product/technical docs before implementation.
- Read `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-01.md` before fixing JARVIS. It is the detailed 57-finding error ledger.
- Read `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-02.md` for the executive audit conclusion.
- Preserve the original canonical audit filenames as historical compatibility evidence if they still exist. New implementation references use Error Audit 01 and Error Audit 02.
- Preserve `imports/ocade-jarvis/`, `imports/ocade-jarvis/source-original/`, and `imports/UI OCADE JARVIS.zip` unchanged.
- Run `/caveman ultra` and then `/ponytail ultra` against active production code at appropriate cleanup checkpoints. Both are required, but neither may alter immutable imports, weaken security, hide required UI state, remove device-control capability, or delete code without ToRemove.md evidence.

### Company/product outcome

- OCADE is one global AI product with Chat and JARVIS as the core customer experiences.
- JARVIS is the execution layer for browser, computer, software, coding, files, voice, tasks, multi-application work, Remote PC, and supported mobile-device actions.
- Do not add a separate Code page. Code is produced in conversation or executed through the user's selected IDE/workspace when JARVIS is asked to act.
- Do not add a separate Projects page unless real product evidence later proves a dedicated surface is necessary. Conversations, workspaces, repositories, files, and Library carry project context.
- Tasks primarily live inside JARVIS. A separate permanent Tasks destination is not required unless later evidence proves it materially improves navigation.
- Give JARVIS its own clean Library/output experience while continuing to reuse common OCADE storage and account authorities where appropriate.
- One customer subscription grants Chat and JARVIS access according to the plan's allowances. Free-tier usage remains account-wide and follows the approved 28-use model where applicable.

### Phase 24 — Authority reconciliation and baseline

- Re-read the latest `main` and record the exact source SHA, deployed Cloudflare identity, Supabase migration head, Edge Function identity, extension version, Device Agent version, protocol version, and current test state.
- Reconcile every live behavior against the newest authority documents and Error Audit 01. Do not trust the 2026-09-27 audit as current truth without reproducing each applicable finding on the latest code.
- Build a single implementation ledger that marks every Error Audit 01 finding as reproduced, fixed, no longer reproducible, blocked, superseded, or intentionally removed.
- Reconcile the current code and `imports/UI OCADE JARVIS.zip` so useful orb/graph/motion behavior is reused without importing prototype fake data, duplicate systems, obsolete scaffolding, or donor-only dependencies.
- Confirm the testing MCP/toolchain is available and assign one actor and one verifier per test path. Do not allow competing physical-control tools to click/type simultaneously.

### Phase 25 — Critical and Major safety repair

- Reproduce and repair all four Critical findings before expanding execution capability: active-action STOP/cancellation, workspace terminal escape, temporary-file/symlink workspace escape, and browser private-network/DNS/redirect/subresource boundary bypass.
- Reproduce and repair every Major finding that remains valid on current main, including session ownership, stale authentication, late responses, drafts, browser-history identity, extension packaging, app inventory/identity, planner OS context, task authority, device permissions, installer/update/uninstall, identity duplication, debugger detach, fresh-screen input binding, voice cleanup, Remote PC target selection, enrollment abuse controls, raw-shell confirmation, and dispatch-time revalidation.
- Do not call a finding fixed because code changed. Require targeted regression evidence and strongest-available runtime evidence.

### Phase 26 — One execution authority

- Implement one device-side action broker used by Windows/macOS executors and shared conceptually by the Android companion.
- Every action binds account, device, task, request, permission, confirmation digest where required, protocol version, and idempotency identity.
- Revalidate permissions and capabilities when the action is dispatched, not only when it is queued.
- Make cancellation propagate into subprocesses, browser actions, file operations, accessibility actions, vision loops, and coordinate actions wherever technically possible.
- Enforce canonical workspace handles and safe path resolution. Symlink, junction, temp-path, shell, redirect, DNS, and private-network boundaries must fail closed.
- Prefer typed/native actions first, accessibility/structured UI second, local visual understanding third, and fresh coordinates last. Re-observe before coordinate actions after any screen/layout/focus change.
- Verify the physical or data result before reporting Done.

### Phase 27 — Product UI rebuild and debloat

- Rebuild the customer-facing experience toward `docs/JARVIS_DESIGN_SYSTEM.md`. The expected outcome is a substantially cleaner interface rather than a cosmetic reskin.
- Remove redundant pages, duplicate history/navigation, unnecessary settings, verbose explanations, weak placeholder cards, decorative fake metrics, duplicate theme controls, and exposed internal terminology.
- Keep Chat, JARVIS, Library, Settings/account access, Support/Help, and contextually useful history/navigation easy to reach.
- Make automatic safe defaults replace avoidable settings. Put long explanations into Help.
- Use black/white/silver as the main palette, blue for enabled/active states, green for success, and red for destructive/error states.
- Preserve the silver-white 3D orb, graph, cursor reaction, semantic zoom, pan/zoom, real-data nodes, voice animation, task animation, and reduced-motion equivalent.
- Use skeleton loading, progressive hydration, thin theme-aware scrollbars, soft corners, clean spacing, minimal text, concise errors, and responsive desktop/tablet/mobile states.
- Free users see exact remaining usage. Paid users primarily see plan name and a clean usage percentage/bar.
- Task progress uses truthful stages and only uses percentages when measurable. Detailed logs remain collapsed until requested.

### Phase 28 — Windows and professional-software execution

- Build and test the Windows companion as a polished customer product with guided install, one OCADE tray identity, lightweight autostart supervisor, local exit, website disable, signed/verified update path, rollback, clean uninstall, and credential removal.
- Test real physical Windows using Physical Computer Use/Claude Computer for native UI and Playwright/DevTools for browser verification.
- Support multi-application tasks and professional software through general execution logic rather than hardcoding a few demo applications.
- Test Office applications, IDEs, file workflows, browser workflows, Store/UWP apps, editing software, and at least representative complex/engineering software paths where legally available.
- JARVIS may inspect app-specific CLI, scripting, accessibility, plugin, or macro options before falling back to raw UI control. Installing an integration/plugin requires appropriate user authorization.
- Co-work is a real arbitration mode. Physical user input normally pauses automation; Co-work explicitly coordinates handoff instead of allowing two actors to fight.

### Phase 29 — Android companion and floating JARVIS

- Implement the Android companion as an OCADE-owned runtime distributed through the owner-approved direct OCADE-domain path rather than depending on Google Play.
- Guide installation and every required Android permission. Never bypass Android security prompts, restricted-setting protections, overlay/accessibility consent, notification permission, or screen-capture consent.
- Implement the movable edge-snapping JARVIS mini-app/bubble with quick chat, composer, voice, current task, Stop, expand/open OCADE, permission state, and compact status.
- Keep settings/account complexity on the website rather than bloating the bubble.
- Implement app-launch, intent, notification, gallery/file, share/import, contact/message/call, accessibility/UI, vision, and fresh-coordinate paths within granted Android permissions.
- Prefer Trash/reversible cleanup. Never delete personal media because the model merely guesses it is unused.
- Test using Playwright Android mobile for web/PWA, BlueStacks or another free Android environment for OS behavior, Appium as primary structured automation, and Mobile MCP as independent verification.

### Phase 30 — iPhone/iPad and macOS supported control

- Keep iPhone/iPad web/PWA-first and use Apple-supported Home Screen, Siri/Shortcuts/App Intents where available, Control Center integration where supported, share flows, notifications, and Remote PC.
- Do not claim that a PWA can create an Android-style overlay above every iOS app or arbitrarily drive every third-party application.
- Use WebKit for iPhone/iPad browser compatibility but label it emulated compatibility rather than physical-device proof.
- Keep looking for legitimate zero-cost Apple test environments, but never relabel simulation as real iOS/macOS evidence.
- Build the macOS Device Agent only against supported APIs, TCC permissions, signing/notarization requirements, and a real macOS test environment when available.
- When Apple blocks a local control path, use Remote PC or another supported workflow rather than faking success.

### Phase 31 — Owner/admin company backend

- Implement `admin.ocade.in` as the secure company operations surface, using server-side roles/RLS/authorization rather than frontend hiding.
- Support Owner, Admin, Support, Billing, Developer/Operations, and Read-only roles with least privilege and audited actions.
- Let the owner search and manage customers, usage adjustments, reset windows, plans, complimentary access, subscriptions, invoices, refunds, disputes, sessions, devices, support, staff, incidents, and system health.
- Never expose plaintext customer/staff passwords, MFA secrets, full payment-card data, provider secrets, or raw authentication secrets.
- Represent the owner's unlimited entitlement without disabling cost/usage telemetry.
- Implement a global emergency JARVIS execution kill switch and scoped feature kill switches.
- Conversation-content access is owner-only by default and must require a deliberate, logged, reasoned access path. Staff do not inherit it automatically.

### Phase 32 — Global commerce, support, and legal surfaces

- Implement one-plan access to Chat and JARVIS with clean free/paid usage presentation.
- Use provider-hosted/tokenized payment entry; never store raw card numbers or security codes.
- Support local currency where practical, billing-country confirmation, anti-VPN/anti-abuse controls, receipts, invoices, refunds, partial refunds, dunning, grace periods, cancellation, disputes, and local payment methods where the provider supports the needed lifecycle.
- Do not hardcode an unverified tax threshold. Tax/GST/VAT/sales-tax behavior follows current verified legal/accounting requirements and selected provider capabilities.
- Build first-party Help/Support on the OCADE domain with search, Getting Started, Chat, JARVIS, Devices, Mobile, Billing, Privacy & Security, Troubleshooting, visual guides, and contextual error links.
- Keep Terms, Privacy, Acceptable Use, Refund/Cancellation, and device-control disclosures clean, readable, and integrated where acknowledgement is genuinely required.

### Phase 33 — Autonomous testing team

- Use the tool roles in `docs/TESTING_TOOLCHAIN.md`: Playwright Real Chrome, Chrome DevTools, Playwright WebKit iOS-like, WebKit Desktop, Android Mobile, Firefox, Edge, Appium Mobile, Mobile MCP, Physical Computer Use, and Filesystem MCP, plus GitHub/Supabase/Cloudflare/Sentry-connected tooling where available.
- BrowserStack or any paid/trial-only real-device service is not a mandatory dependency under the zero-extra-cost rule.
- One tool acts while another verifies. Appium and Mobile MCP do not simultaneously drive the same screen. Playwright and physical-computer automation do not race the same foreground browser.
- Test JARVIS first, then Windows/extension, Android/mobile, Apple web compatibility, then the complete OCADE site including Chat, Offline, Library, Settings, authentication, admin, billing, support/legal, accessibility, responsive UI, and deployment.
- Continue independent tests when one subsystem fails. Never stop the entire audit merely because one tool or platform is blocked.
- Aggressively hunt concurrency, stale state, permission races, cancellation, workspace escape, DNS/private-network, prompt injection, authentication, cross-account, cross-device, protocol-skew, installer/update/uninstall, mobile permission, loading, and responsive hidden bugs.

### Phase 34 — Cleanup, release, and production proof

- Run Caveman and Ponytail after functionality/security are proven and again on the final candidate. They must simplify active production code without weakening control, security, performance, UI, accessibility, or supported device behavior.
- Conduct a dedicated repo-structure audit for professional filenames, clear folder ownership, duplicate systems, obsolete dependencies, dead files, giant mixed-responsibility modules, pointless one-function files, and stale prototypes.
- Re-run all targeted and broader tests after cleanup.
- Product implementation merges to main only when no known Critical or Major release blocker remains for the shipped capabilities, required tests are green, blocked capabilities are disabled or honestly marked, and the branch is cleaner than the baseline.
- Merge through a reviewed branch/PR flow. Do not rely on paid GitHub Actions. Use the trusted local/connector verification and existing deployment pipeline.
- Verify production after merge and prove the deployed source identity corresponds to the merged main revision.
- Customer updates after a valid release should be verified, automatic where safe, health-checked, rollback-capable, and require minimal user effort.

### Final definition of done

The mission is complete only when the code, docs, database, deployed product, Device Agent, extension, Android companion/PWA, supported Apple web paths, owner/admin backend, commerce/support surfaces, and public product claims agree with one another. The target is no known Critical or Major release blocker and no reproducible hidden blocker within the tested scope, not a dishonest mathematical claim of zero bugs or an unhackable product.

## MCP orchestration and autonomous fix-loop mandate — 2026-09-28

- `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md` is mandatory for every long-running implementation, audit, test, cleanup, and release mission.
- The presence of many MCPs must increase evidence quality rather than create contention. Assign one actor per browser, desktop, mobile device/emulator, repository write path, database mutation path, and deployment mutation path. Other tools observe or run independent sequential verification.
- Before a test wave, health-check required MCPs and record which evidence classes are available. A broken MCP blocks only its dependent evidence class; continue every independent test.
- Maintain a durable implementation/test ledger so context-window exhaustion, compaction, model fallback, restart, or rate limiting cannot erase progress. Record branch, base/main SHA, completed findings, test results, blockers, tool health, and exact next unfinished step before any handoff.
- Divide the mission into bounded waves instead of trying to build/test all platforms concurrently in one context. Use authority/security, browser, Windows, Android, Apple web compatibility, UI, admin/billing, whole-site regression, cleanup, and final-release waves with explicit entry/exit criteria.
- Every defect follows reproduce → root-cause analysis → regression test → fix → targeted retest → nearby integration test → strongest real runtime/device test → adversarial break attempt → broader subsystem regression. A code change alone never closes a bug.
- Visual errors are real bugs. Responsive layout, spacing, overflow, loading, skeletons, scrollbars, orb/graph behavior, task progress, settings density, mobile bubble, admin UI, and dark/light/reduced-motion states require visual verification in addition to DOM/unit assertions.
- Continue fixing and retesting until release gates are met or a genuine owner-only, hardware, legal, signing, payment, or platform dependency blocks further proof. Tool failure, rate limits, context changes, and a single green pass are not valid reasons to stop.
- Never claim mathematical zero bugs. The release target is no known Critical/Major release blocker, no reproducible hidden blocker in tested scope, and explicit disclosure of blocked evidence.
