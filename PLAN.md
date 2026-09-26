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
- Current docs must not mention or plan a desktop-wrapper architecture before the web mission is complete.
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
- Keep current docs focused on the web mission and do not document a desktop-wrapper technology before the owner starts that later mission.

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
