# OCADE Stage 2 — Universal PC, Web and Any-App Control: All-Coding Completion Specification

## 0. Relationship to the older OCADE phase file

This is the second execution document.

Codex must first read and complete every remaining requirement in the separately uploaded older OCADE numbered-phase file. It must finish that document through its final integration and honesty audit before beginning this document.

This document then continues with Phase 20 and later phases. It must not restart the repository, replace the existing architecture, delete implemented work, or repeat already verified work.

The implementation order is:

1. Read the older OCADE numbered-phase file.
2. Read the current repository, working tree, checkpoints, tests and audit reports.
3. Complete all unfinished older phases.
4. Run the older file’s final validation and honesty audit.
5. Continue directly into this Stage 2 specification.
6. Finish every dependency-safe Stage 2 phase without voluntarily stopping.
7. Ask for one final commit and push only after the final Stage 2 audit passes.

If requirements conflict, preserve security and user data first, then follow this Stage 2 document for universal PC/web control and coding-only completion.

---

# 1. Final product objective

OCADE must become a local-first, permissioned computer-use operating system in the same broad capability class as advanced desktop work agents.

The user should be able to ask OCADE to operate an installed Windows application or a website. OCADE must inspect the computer, choose the safest and most reliable control route, execute through real software interfaces, observe the changed state, verify the result independently, recover from errors and produce an evidence receipt.

No separate robot, mechanical hand, custom chip, privately owned physical server or dedicated data-centre hardware is required. OCADE uses:

- The user’s existing Windows PC.
- The user’s installed and properly licensed applications.
- A local OCADE desktop companion.
- Chrome and Edge extensions.
- Local models through Ollama, LM Studio and other OpenAI-compatible local servers.
- Optional OpenAI API access when configured.
- Application APIs, plug-ins, MCP-compatible bridges, scripting interfaces, CLIs and supported file formats.
- Windows UI Automation and accessibility.
- Screen understanding, OCR, icon detection and Set-of-Mark perception.
- A permissioned keyboard, mouse, clipboard, file and command executor.
- A mobile web/PWA mission-control interface for monitoring and changing PC tasks.
- Optional managed relay services later, without requiring the user to own a physical server.

The goal is a universal **Any-App Attempt Engine**. It must be able to identify and attempt permitted work in unfamiliar installed software through a route hierarchy and Unknown-App Learning.

OCADE must never state that every application and version has already been proven. It must state exactly whether an application is live-tested, connected, probed, accessibility-controlled, vision-controlled, file-format-only, setup-required or unavailable.

---

# 2. What “all coding” means

For this Stage 2 document, “all coding complete” means every software component, interface, adapter, simulator, preflight, test harness, permission flow, recovery flow, package, setup script and acceptance test is implemented.

When the user’s current PC already contains the required application or toolchain, Codex must perform real runtime verification.

When a compiler, licence, account, application, microphone, GPU backend, cloud credential or other external prerequisite is absent, Codex must still complete:

- Detection.
- Capability interface.
- Adapter.
- Configuration schema.
- Safe simulator or deterministic fixture.
- Unit tests.
- Integration tests.
- Failure tests.
- Setup assistant.
- Exact installation or connection steps.
- Runtime acceptance script.
- Rollback instructions.
- Feature flag.
- Honest user-facing status.
- Exact resume checkpoint.

A missing prerequisite may block physical verification, but it must not leave vague source work or an unexplained TODO.

---

# 3. Core architecture: Brain, Director, Hands, Eyes and Verifier

OCADE must use five cooperating layers.

## 3.1 Brain

The Brain is one or more local or optional cloud models. It interprets the user’s goal, understands documents and screenshots, proposes plans, diagnoses errors and selects tools.

The Brain must never receive unrestricted direct authority over the operating system.

## 3.2 Executive Director

The Director converts model output into a typed, validated, permission-checked execution plan.

The Director must:

- Reject malformed output.
- Reject unknown tools.
- Reject arguments outside the declared schema.
- Resolve application and file identity.
- Calculate risk.
- Check permissions.
- Check resource requirements.
- Add expected postconditions.
- Add a verification method.
- Add a rollback or recovery method.
- Create idempotency keys.
- Create a checkpoint before risky mutations.
- Split broad goals into bounded steps.
- Prevent unlimited loops.

## 3.3 Hands

The Hands are deterministic executors:

- Application API adapters.
- Plug-in and MCP-compatible adapters.
- CLI and scripting adapters.
- Supported file-format adapters.
- Browser DOM executor.
- Windows UI Automation executor.
- Native Windows API executor.
- Screen-vision input executor.
- Keyboard and mouse broker.
- Clipboard broker.
- File broker.
- Sandboxed command runner.
- Sandboxed Python task runner where justified.

The model proposes actions. The Hands perform only validated, permitted actions.

## 3.4 Eyes

The Eyes observe the real state through:

- Application APIs.
- Process and window information.
- Windows accessibility tree.
- Browser DOM and accessibility tree.
- Screenshots.
- OCR.
- Icon and control detection.
- Set-of-Mark overlays.
- File-system metadata.
- File content.
- Logs.
- Application project state.
- Render or solver outputs.
- Network and provider status.

## 3.5 Independent Verifier

The Verifier must not simply trust the executor’s response.

For every mutation it must compare expected and observed postconditions through an independent observation route whenever possible.

Examples:

- After saving a file, reopen or hash it.
- After creating a folder, list the parent directory.
- After changing a browser form, inspect the DOM.
- After creating a Blender object, inspect scene data and render a preview.
- After running a solver, inspect the real solver log and result files.
- After exporting a video, inspect duration, codec, dimensions and playable frames.
- After a GUI click, reobserve the target application and confirm state change.

---

# 4. Typed action contract

Codex must implement or reconcile a canonical action contract equivalent to:

```ts
type RiskLevel = "read" | "low" | "medium" | "high" | "protected";

interface OcadeActionRequest {
  actionId: string;
  taskId: string;
  stepId: string;
  appIdentity: {
    executable?: string;
    product?: string;
    version?: string;
    windowId?: string;
    browserOrigin?: string;
  };
  capability: string;
  route:
    | "api"
    | "plugin"
    | "mcp"
    | "cli"
    | "file"
    | "dom"
    | "accessibility"
    | "native"
    | "vision"
    | "input";
  arguments: Record<string, unknown>;
  risk: RiskLevel;
  requiredPermission: string;
  expectedPostconditions: Postcondition[];
  verificationPlan: VerificationStep[];
  rollbackPlan?: RecoveryStep[];
  timeoutMs: number;
  retryBudget: number;
  idempotencyKey: string;
}
```

Every executor must produce observations and evidence, not a self-declared success Boolean.

---

# 5. Local model fabric and provider routing

OCADE must support at least:

1. Ollama.
2. LM Studio.
3. llama.cpp server.
4. LocalAI.
5. vLLM.
6. Jan local API.
7. KoboldCpp.
8. Generic OpenAI-compatible local endpoints.
9. Optional official OpenAI API.

Each provider must expose:

- Base URL.
- Authentication method.
- Model discovery.
- Health.
- Context size.
- Structured output support.
- Tool-use support.
- Vision support.
- Coding capability.
- Embedding capability.
- Expected RAM and GPU memory.
- Latency.
- Privacy class.
- Cost class.
- Rate-limit state.
- Circuit-breaker state.
- Last successful request.
- Priority.
- User-enabled or disabled state.

## 5.1 Routing logic

Use the smallest capable healthy local model first.

If it cannot satisfy the capability, context, latency or resource requirement, route to a stronger healthy local model.

If the provider times out, returns malformed tool calls, reaches a rate limit, runs out of context, exceeds memory or becomes unhealthy, open its circuit breaker and select the next compatible provider.

Use the optional cloud provider only when enabled and allowed by the task’s privacy policy.

If no provider is capable, split the task, use deterministic tooling, reduce output size or report the missing capability.

## 5.2 Private background use

Local models may privately:

- Classify user intent.
- Inspect an app map.
- Analyse local logs.
- Read approved local help.
- Plan a safe route.
- Generate an application script.
- Diagnose a failure.
- Compare screenshots.
- Propose recovery.
- Estimate resources.

Do not expose hidden chain-of-thought. Show concise activity messages and record tools, apps, files, model class and evidence.

## 5.3 Sandboxed generated code

Do not give a local model an unrestricted `run_python_code` tool.

Provide an ephemeral sandbox with:

- Temporary working directory.
- Explicit input and output paths.
- Read-only or read-write scope.
- Import allowlist.
- Network disabled by default.
- CPU, memory, storage and time limits.
- Process-tree termination.
- Output validation.
- Secret redaction.
- Diff preview.
- Approval for high-risk operations.
- Cleanup after completion.
- Saved script and receipt when the result is accepted.

---

# 6. Universal route hierarchy

For every application action, OCADE must try the strongest reliable route in this order:

1. Official application API.
2. Official or approved plug-in, add-in or MCP-compatible bridge.
3. Documented CLI or scripting interface.
4. Supported project or file-format operation.
5. Browser DOM and browser accessibility tree.
6. Windows UI Automation and accessibility tree.
7. Native Windows APIs.
8. Screen perception using OCR, icons, controls and Set-of-Mark.
9. Permissioned keyboard and mouse input as the final fallback.

The route selector must account for:

- Application identity and version.
- Available interfaces.
- Task type.
- User permission.
- Risk.
- Confidence.
- Expected latency.
- Verification route.
- Recovery route.
- Current application health.
- User recording preference.

A high-risk mutation must not silently downgrade to coordinate clicking.

---

# 7. Windows computer-use runtime

## 7.1 Companion

Codex must complete the existing Tauri/Rust Windows companion rather than creating an unrelated second controller.

The companion must provide:

- Secure IPC.
- Authenticated session.
- Nonces and replay protection.
- Version negotiation.
- Capability discovery.
- Process discovery.
- Window discovery.
- Active-window detection.
- Window focus, move, resize and arrangement.
- Approved screenshot capture.
- Accessibility-tree retrieval.
- Approved keyboard input.
- Approved mouse input.
- Clipboard operations.
- Approved file operations.
- Approved command execution.
- Process monitoring.
- Tray state.
- Overlay state.
- Global emergency stop.
- Pause, resume and cancellation.
- Crash recovery.
- Update and rollback contracts.
- Auditable receipts.

## 7.2 Permissions

The setup assistant must detect missing Windows permissions and open the exact required settings or installer flow.

It may request approval for:

- Installing the companion.
- Installing MSVC/Windows Build Tools when required.
- Firewall rules.
- Startup registration.
- Screen capture.
- Accessibility.
- Approved folders.
- Protocol registration.

It must never bypass Windows security prompts, administrator consent, login, passwords, OTPs, CAPTCHAs, payments, licences or enterprise restrictions.

## 7.3 Low-level input broker

The low-level input broker must:

- Confirm the target window before input.
- Use display-aware coordinates.
- Support multiple monitors and scaling.
- Re-detect the target after layout changes.
- Display pointer movement when recording is enabled.
- Provide a fail-safe hot corner and keyboard emergency stop.
- Prevent input into protected fields.
- Prevent typing secrets returned from logs or memory.
- Rate-limit clicks and keystrokes.
- Cancel immediately.
- Reobserve after every state-changing input.
- Reject coordinates outside the intended window.
- Reject stale screenshots.
- Reject hidden or occluded targets unless the task permits them.

---

# 8. Perception and Omni-Parser layer

Coordinate guessing alone is not reliable enough.

Codex must build a fused perception pipeline using:

- Application identity.
- Window bounds.
- Accessibility nodes.
- OCR text boxes.
- Icons.
- Menus.
- Buttons.
- Inputs.
- Tables.
- Timelines.
- Canvas regions.
- Colour and state indicators.
- Focus.
- Selection.
- Disabled and hidden states.
- Stable visual anchors.
- Set-of-Mark identifiers.

## 8.1 Set-of-Mark

For screens that require visual control:

1. Capture the approved target window, not the entire desktop when unnecessary.
2. Redact protected regions.
3. Detect candidate interactive elements.
4. Merge candidates with accessibility nodes.
5. Draw numbered markers.
6. Send the marked image and structured element table to the selected vision model.
7. Require the model to select an element identifier rather than invent coordinates.
8. Resolve the identifier to current bounds.
9. Revalidate the element before execution.
10. Reobserve after execution.

## 8.2 Screen state fingerprint

Every observation must include a fingerprint based on:

- Application identity.
- Version.
- Window title.
- Window bounds.
- Display scale.
- Accessibility-tree signature.
- Visible-text signature.
- Screenshot perceptual hash.
- Active project or file where detectable.

An action planned against a stale fingerprint must be rejected and replanned.

---

# 9. Unknown-App Learning and universal software control

The system must support any permitted installed software through adaptive probing rather than requiring a prewritten adapter for every product.

When an unknown application is encountered, OCADE must:

1. Identify executable, publisher, signature, product and version.
2. Detect language, theme, display scale and plug-ins where possible.
3. Inspect windows, accessibility nodes, menus, shortcuts and commands.
4. Inspect approved local help, logs and project files.
5. Detect official APIs, scripting, CLIs, plug-ins and supported formats.
6. Build a capability graph.
7. Build a versioned application map.
8. Mark protected and destructive areas.
9. Define verification routes.
10. Define recovery routes.
11. Rehearse using a temporary file, duplicate project, undoable action or no-op.
12. Request a scoped permission.
13. Execute one bounded step.
14. Verify.
15. Save the successful recipe as a private skill pack.
16. Invalidate or revalidate the map after a version, plug-in, locale, theme, scale or layout change.

## 9.1 Support labels

Use only:

- `LIVE_TESTED`
- `VERIFIED_CONNECTOR`
- `PROBED_AND_REHEARSED`
- `GENERIC_DOM`
- `GENERIC_ACCESSIBILITY`
- `GENERIC_NATIVE`
- `VISION_FALLBACK`
- `FORMAT_ONLY`
- `CONNECTOR_REQUIRED`
- `PERMISSION_REQUIRED`
- `APPLICATION_REQUIRED`
- `UNAVAILABLE`
- `FAILED_VERIFICATION`

“Any App” means OCADE may attempt safe discovery and control. It does not mean every task in every application is guaranteed.

---

# 10. Application Digital Twin and skill compiler

Codex must implement an Application Digital Twin framework.

Each application twin must include:

- Identity and versions.
- Windows and views.
- Menus.
- Controls.
- Commands.
- Shortcuts.
- Project and file types.
- Protected areas.
- Common workflows.
- Error states.
- Verification methods.
- Undo and recovery methods.
- Resource profile.
- Known adapter routes.
- Confidence.
- Last verification.
- Compatibility constraints.

The Adaptive Skill Compiler must convert a successful task into a private, version-constrained skill pack containing:

- Trigger and task pattern.
- Required application fingerprint.
- Preconditions.
- Permissions.
- Actions.
- Verification.
- Failure handling.
- Recovery.
- Test fixtures.
- Evidence.
- Invalidating changes.

Skill packs must not silently execute after their fingerprint becomes stale.

---

# 11. Browser and web control

Codex must complete a real Chrome and Edge extension plus a browser-control service.

The extension must support:

- Authenticated pairing.
- Extension and companion identity.
- Per-origin permissions.
- Current tab and window discovery.
- DOM snapshot.
- Accessibility snapshot.
- Screenshot capture.
- Navigation.
- Tab creation and selection.
- Semantic element selection.
- Forms.
- Upload.
- Download.
- File picker handoff.
- Drag-and-drop where safe.
- Selector healing.
- Dynamic-page waiting.
- Iframe boundaries.
- Shadow DOM where permitted.
- Protected fields.
- Login boundaries.
- Sensitive-submit confirmation.
- Prompt-injection isolation.
- Cancellation.
- Emergency stop.
- Progress.
- Evidence receipts.

The web controller must treat page text, emails, documents and advertisements as untrusted content. They cannot change the user’s task, request secrets or grant permissions.

## 11.1 Controlled browser laboratory

Create local test applications for:

- Email.
- Spreadsheet.
- Video upload.
- File storage.
- Dashboard.
- E-commerce without real payment.
- Dynamic forms.
- Uploads and downloads.
- Iframes.
- Shadow DOM.
- Duplicate labels.
- Hidden controls.
- Stale selectors.
- Interrupted navigation.
- Malicious instructions.
- Protected login and payment fields.

All browser functions must be proven first against these controlled pages.

---

# 12. Email, files and web applications

For email, OCADE must prefer an approved OAuth/API connector when available.

If no connector is available, it may use the browser extension.

Sending must support:

- Draft.
- Preview.
- Recipient verification.
- Attachment verification.
- Sensitive-content warning.
- Confirmation policy.
- Send receipt.

For web-based editors and services, prefer:

1. API.
2. Official plug-in.
3. Browser DOM.
4. Browser accessibility.
5. Visual fallback.

Passwords, OTPs, CAPTCHAs, payments and legal confirmation always remain user-controlled.

---

# 13. Creative software: Blender, video and media

Blender is an example, not a special limitation. The same architecture must apply to every creative application.

## 13.1 Blender route

For Blender, OCADE should prefer:

1. Blender Python API.
2. Command-line background execution.
3. A signed or approved Blender plug-in or MCP-compatible bridge.
4. Project-file inspection.
5. Accessibility.
6. Vision and input fallback.

A request such as “create a complete 3D car” must become a structured production plan:

- Analyse the requested style and output.
- Inspect CPU, RAM, GPU, VRAM and storage.
- Detect Blender version and render engines.
- Choose a safe project directory.
- Create versioned `.blend` checkpoints.
- Build a component hierarchy.
- Create or import geometry.
- Apply modifiers.
- Build materials.
- Configure lighting and cameras.
- Generate previews.
- Inspect scene objects and logs.
- Detect missing or invalid geometry.
- Repair.
- Render with a resource-appropriate profile.
- Export requested formats.
- Validate file integrity.
- Produce an evidence receipt.

The model may generate Blender Python, but it must run through a sandboxed adapter with output and scene validation.

## 13.2 Video editors

For CapCut, Premiere Pro, DaVinci Resolve, Descript or another installed lawful editor, OCADE must probe:

- Official API or scripting.
- Plug-ins.
- Project formats.
- Media metadata.
- Timeline accessibility.
- Keyboard shortcuts.
- Export routes.
- Logs.

The workflow must include:

- Preserve originals.
- Create a project copy.
- Import media.
- Inspect codec, frame rate and duration.
- Analyse transcript and scenes.
- Create an edit decision list.
- Rehearse.
- Apply timeline changes.
- Verify sequence duration and clip boundaries.
- Render a preview.
- Export.
- Validate codec, dimensions, audio and playable frames.

OCADE must never display a fake rendered output.

---

# 14. CAD, CAM, GIS and engineering applications

The architecture must support AutoCAD, Fusion 360, SolidWorks, CATIA, Siemens NX, FreeCAD, Revit, GIS tools and similar software when installed and licensed.

Prefer:

- Official APIs.
- Add-ins.
- Macros.
- Python or other scripting.
- Command interfaces.
- Parametric project formats.
- Accessibility.
- Vision fallback.

For a CAD task:

- Detect units.
- Detect product and version.
- Open a duplicate project.
- Determine constraints.
- Generate sketches.
- Apply dimensions.
- Build features.
- Rebuild.
- Inspect failed constraints.
- Repair.
- Validate dimensions.
- Export STEP, STL, DWG, DXF or another requested format.
- Reopen or independently inspect the export.
- Preserve a receipt.

OCADE must distinguish cosmetic performance settings from engineering-model assumptions. It must not silently change dimensions, materials, contacts, constraints, tolerances or accuracy to make a task run faster.

---

# 15. LS-DYNA, CAE and solver workflows

OCADE may control LS-DYNA and other installed licensed solvers through input decks, official commands, scripts, APIs, job managers, logs and post-processors.

The full workflow must include:

- Detect installation and licence.
- Detect CPU, RAM, GPU support and storage.
- Read the input deck.
- Determine units.
- Validate required cards and references.
- Validate materials, sections, contacts, loads and constraints.
- Create a versioned working copy.
- Run a preflight.
- Estimate resources.
- Propose performance settings.
- Require approval before accuracy-affecting changes.
- Launch the actual solver.
- Monitor real logs.
- Detect normal and abnormal termination.
- Parse warnings and errors.
- Check numerical indicators appropriate to the solver.
- Open or invoke post-processing.
- Generate plots and reports from real result files.
- Link every conclusion to actual output.
- Preserve original inputs and all changed versions.

A local model may diagnose and propose changes. It must never invent solver output or claim engineering correctness from a simulator fixture.

---

# 16. Hardware and application performance governor

OCADE must inspect the user’s existing PC before a large task.

It must detect:

- CPU.
- Core count.
- RAM.
- GPU.
- VRAM.
- Supported compute backends.
- Storage and free space.
- Battery and power state where applicable.
- Thermal signals where available.
- Current application load.
- Local model load.
- Renderer or solver requirements.

The Resource Governor must produce:

- Expected memory.
- Expected storage.
- Expected duration range.
- Suitable model.
- Suitable render or preview profile.
- Maximum parallelism.
- Safe fallback.
- Warning threshold.
- Checkpoint frequency.
- Cancellation strategy.

OCADE may adjust reversible session or project performance settings after recording the original values.

It must not alter system firmware, overclocking, drivers, global GPU configuration or accuracy-critical engineering settings without explicit approval and rollback.

A weak PC should receive a smaller model, lower preview quality, fewer concurrent tasks and longer estimates rather than a fake promise.

---

# 17. Mobile mission control without mobile-screen automation

The mobile product does not need to control the phone’s own touch screen.

It must remotely supervise and modify OCADE tasks running on the user’s PC.

The mobile web/PWA interface must support:

- Pairing.
- PC online state.
- Companion health.
- Current task.
- Active application.
- Current step.
- Last verified checkpoint.
- Progress.
- Errors.
- Blockers.
- Screenshots or redacted previews when enabled.
- Outputs.
- Receipts.
- Send a new PC task.
- Add or correct an instruction.
- Approve or deny a bounded action.
- Pause.
- Resume.
- Cancel.
- Emergency stop.
- Revoke the session.
- Download completed outputs.

Every remote mutation must use a short-lived, scoped permission and a signed task command.

---

# 18. Remote transport and NAT traversal without owned servers

OCADE must not require the user to own physical servers.

Implement a transport abstraction supporting:

- Trusted LAN direct connection.
- Local development relay.
- Managed encrypted WebSocket relay.
- Supabase Realtime when configured.
- WebRTC signalling.
- TURN service configuration.
- Future self-hosted relay.

Both PC and mobile should create outbound authenticated connections. Do not require an unauthenticated public inbound port.

The protocol must include:

- Device-bound keys.
- Pairing code or QR.
- Short-lived session tokens.
- Nonces.
- Sequence numbers.
- Idempotency keys.
- Acknowledgements.
- Replay prevention.
- Revocation.
- Reconnect reconciliation.
- Expiry.
- Per-task scopes.
- Per-application scopes.
- Per-file scopes.
- Evidence receipts.

## 18.1 Local coding proof

Before a managed relay exists, Codex must run a multi-process local simulation:

- Virtual mobile client.
- Local relay.
- OCADE server.
- Virtual or real PC companion.

Simulate:

- Latency.
- Packet loss.
- Duplicate commands.
- Lost acknowledgements.
- Relay restart.
- Client restart.
- Companion restart.
- Expired tokens.
- Revoked device.
- Network switching.

This proves the protocol source without a private physical server.

---

# 19. Voice as a software connector

Voice must not delay PC and web control, but its software path must be coding-complete.

Support:

- Windows system voices.
- Local text-to-speech providers.
- Local speech-to-text providers.
- Recorded WAV input.
- Optional ElevenLabs or another configured licensed provider.
- Push-to-talk.
- Captions.
- Interruption.
- Stop speaking.
- Voice selection.
- Language manifest.
- Privacy indicator.
- Emergency mute.
- Provider fallback.

Use original, system-provided or properly licensed voices.

When no microphone is available, validate through recorded audio fixtures.

When no speaker is available, validate generated audio files and metadata.

---

# 20. GPU, renderer and solver abstraction

OCADE does not need to own a GPU. It uses the user’s current CPU or GPU.

Implement:

- Compute-device discovery.
- Renderer registry.
- Solver registry.
- Capability manifests.
- Version detection.
- Resource estimation.
- Queueing.
- Cancellation.
- Progress.
- Partial-output recovery.
- CPU fallback.
- Headless execution.
- Output validation.

For coding-only verification, use small synthetic scenes, known meshes, short media, deterministic solver fixtures and headless software rendering.

Fixtures must be marked test-only and never presented as real engineering or production output.

---

# 21. Packaging, signing, stores and hosting

These items must not block a private Windows beta.

Codex must complete:

- Repeatable local development launch.
- Windows package configuration.
- Development signing.
- Unsigned or development-signed private beta path.
- Installer metadata.
- Update-channel architecture.
- Rollback.
- Release notes.
- Privacy declarations.
- Crash-reporting hooks.
- Monitoring hooks.
- CI workflows.
- Android and iOS project packaging source.
- Store metadata templates.
- Public-hosting deployment scripts.
- Environment validation.
- Backup and restore.
- Disaster-recovery runbooks.

Official certificates, notarisation, public store approval and production hosting remain external actions. Their absence must appear as a release-status boundary, not an unfinished code path.

---

# 22. Universal application coverage

OCADE must be designed to attempt all installed permitted software categories:

- Operating-system tools.
- Browsers.
- Office.
- Email.
- Creative applications.
- Video.
- Audio.
- 3D.
- CAD.
- CAM.
- CAE.
- GIS.
- Engineering solvers.
- Development tools.
- Databases.
- DevOps.
- Communication.
- Finance.
- Accounting.
- BI.
- Security tools.
- Education.
- Healthcare software where lawful and appropriately governed.
- Game engines.
- File transfer.
- Archives.
- Web applications.

Do not create a separate hardcoded architecture for every category. Use the universal route hierarchy, then add verified skill packs for high-value applications.

## 22.1 Initial live-test set

Codex must test installed lawful applications beginning with:

- File Explorer.
- Notepad.
- Calculator.
- Windows Settings.
- Terminal or PowerShell.
- Chrome.
- Edge.
- VS Code or another installed editor.
- Git.
- Excel when installed.
- Blender when installed.
- Any installed CAD, video or engineering application the user approves.
- OCADE itself.

Every test must record version, route, permission, action, expected result, observed result, evidence, recovery and coverage label.

---

# 23. Reliability and non-stop execution

Long tasks must use:

- Durable task graph.
- Dependency ordering.
- Checkpoint after meaningful mutation.
- Idempotency key per step.
- Leases and heartbeats.
- Bounded retries.
- Timeout.
- Resource budget.
- Model fallback.
- Adapter fallback.
- Application-state fingerprint.
- Cancellation.
- Emergency stop.
- Crash recovery.
- Companion reconnect.
- Extension reconnect.
- Network reconnect.
- Partial-output preservation.
- Final verification.

Codex must build an overnight reliability harness that runs reversible tasks against temporary data and controlled test applications.

It must simulate:

- Model failure.
- Malformed tool call.
- Low memory.
- Low storage.
- App crash.
- Stale app map.
- Moved window.
- Changed display scale.
- Extension disconnect.
- Companion restart.
- Network loss.
- Duplicate command.
- Expired approval.
- User cancellation.
- Emergency stop.

No infinite agent loop is permitted. Every loop needs a step budget, time budget, no-progress detector and escalation route.

---

# 24. Security boundaries

OCADE must never automate or capture:

- Passwords.
- OTPs.
- CAPTCHAs.
- Biometrics.
- Recovery codes.
- Payment authentication.
- Protected identifiers.
- Legal confirmation.
- Licence acceptance requiring the user.

OCADE must use:

- Least privilege.
- Scoped paths.
- Scoped applications.
- Scoped tools.
- Scoped time.
- Secret storage.
- Screen redaction.
- Prompt-injection defence.
- Extension isolation.
- IPC authentication.
- Signed remote commands.
- Replay prevention.
- Immutable evidence where required.
- Revocation.
- Emergency stop.
- Recovery.

The user may choose broader low-risk permissions, but the protected-input boundary must remain non-bypassable.

---

# 25. Error diagnosis and self-healing

When a task fails, OCADE must identify the first root failure.

For PC control inspect:

- Companion health.
- Permissions.
- Target application identity.
- Active window.
- Accessibility.
- Display scale.
- Stale screenshot.
- Input route.
- Logs.
- Postcondition mismatch.

For browser control inspect:

- Extension pairing.
- Origin permission.
- Content script.
- Current tab.
- DOM.
- Iframe.
- Selector.
- Navigation state.
- Prompt injection.

For a local model inspect:

- Provider health.
- Endpoint.
- Model availability.
- Context.
- RAM and VRAM.
- Structured-output validity.
- Tool-call validity.
- Timeout.
- Circuit breaker.

For application errors inspect:

- Version.
- Project.
- Recent changes.
- Logs.
- Configuration.
- Plug-ins.
- Storage.
- Memory.
- Licence.
- Network.
- Recovery files.

Before repair, checkpoint. Apply the least invasive reversible fix. Restart only the affected component. Retest the original failure. Compare evidence. Restore if worse.

---

# 26. Measurement and performance

Measure rather than guess:

- OCADE startup.
- Route loading.
- First local-model response.
- Provider fallback.
- Application discovery.
- Screenshot-to-action latency.
- UIA action latency.
- Browser DOM action latency.
- Vision fallback latency.
- CPU.
- RAM.
- GPU.
- VRAM.
- Disk.
- Companion reconnect.
- Extension reconnect.
- Mobile reconnect.
- Wrong-action rate.
- Verification-failure rate.
- Recovery rate.
- Duplicate-action rate.
- Task completion.
- Crash rate.
- Long-run memory growth.

Set regression thresholds from the measured baseline.

---

# 27. Stage 2 execution phases

Codex must start these phases only after completing the older numbered-phase document.

It may use decimal subphases, but it must not create unrelated alphabetical phase systems.

## Phase 20 — Stage transition and exact baseline

Read both specifications, verify completion of the older phases, preserve the working tree, create a checkpoint, persist spec hashes, rerun gates and calculate Stage 2 readiness.

Completion requires an exact source/runtime/app-coverage baseline and exact first incomplete Stage 2 dependency.

## Phase 21 — Canonical model-to-tool control plane

Complete the Brain, Director, Hands, Eyes and Verifier contracts; typed actions; permissions; postconditions; recovery; idempotency and evidence.

Completion requires malformed, unauthorised and unverifiable model actions to fail closed.

## Phase 22 — Multi-provider local model fabric

Complete all required providers, discovery, health, capability manifests, fallback, circuit breakers, resource-aware routing, optional OpenAI routing and secret handling.

Completion requires a real failover test across multiple available providers plus deterministic fixtures for unavailable providers.

## Phase 23 — Secure generated-code sandbox

Complete the ephemeral Python/script runner, scopes, resource limits, network policy, diff preview, output validation, termination and cleanup.

Completion requires tests proving generated code cannot escape approved paths or continue after cancellation.

## Phase 24 — Windows companion and permission setup

Complete and build the existing native companion where possible. Complete permission detection, installation assistance, process/window discovery, UIA, screenshot, input broker, files, commands, stop and recovery.

Completion requires real approved Windows actions on temporary data when the toolchain is available.

## Phase 25 — Perception, Set-of-Mark and state fingerprints

Complete fused UIA/OCR/icon/vision perception, numbered targets, stale-state rejection, protected-region redaction and multi-monitor scaling.

Completion requires controlled desktop tests across moving, resized, scaled and visually changed windows.

## Phase 26 — Universal route selector

Complete API, plug-in/MCP, CLI, file, DOM, accessibility, native, vision and input routes with confidence, risk and fallback rules.

Completion requires representative tests for every route and safe refusal when no route is adequate.

## Phase 27 — Unknown-App Learning and Digital Twins

Complete application probing, fingerprints, maps, rehearsal, skill compilation, cache invalidation, verification and recovery.

Completion requires an unfamiliar controlled test application to be learned, operated, verified, invalidated and relearned.

## Phase 28 — Chrome and Edge control

Complete extension runtime, pairing, origin permissions, DOM, accessibility, upload, download, selector healing, protected boundaries, injection defence, cancellation and receipts.

Completion requires real extension tests plus controlled web-lab end-to-end tests.

## Phase 29 — Email and web work

Complete connector-first email, browser fallback, drafts, previews, recipient and attachment checks, web editing, uploads and downloads.

Completion requires safe end-to-end tests without bypassing authentication or protected submissions.

## Phase 30 — Creative application control

Complete generic creative workflows, Blender adapter, command/script routes, project checkpoints, media validation, render and export verification.

Completion requires real installed-app tests when available and complete deterministic fixtures otherwise.

## Phase 31 — CAD and engineering application control

Complete generic CAD/CAE routing, units, constraints, project duplication, validation, export, recovery and receipts.

Completion requires no engineering assumption or solver result to be fabricated.

## Phase 32 — Resource Governor

Complete hardware discovery, task estimation, model/renderer/solver selection, reversible performance profiles, concurrency control and low-resource fallback.

Completion requires repeatable tests across synthetic weak, medium and strong hardware profiles.

## Phase 33 — Mobile mission control

Complete the mobile/PWA task interface for monitoring, new tasks, instruction correction, approvals, pause, resume, cancellation, emergency stop and outputs.

Completion requires signed scoped commands and no automation of the mobile device itself.

## Phase 34 — Relay and reconnect protocol

Complete LAN mode, local relay, managed relay interface, Supabase/WebSocket/WebRTC abstractions, pairing, sequence numbers, acknowledgements, revocation and reconnect reconciliation.

Completion requires local multi-process fault testing.

## Phase 35 — Voice and multimodal connectors

Complete system/local/licensed voice providers, recorded-audio tests, vision, media and headless connector contracts without delaying PC/web launch.

## Phase 36 — Packaging and coding-only release preparation

Complete local launch, Windows beta packaging, dev signing, update/rollback architecture, CI, store templates, hosting scripts, monitoring and recovery source.

## Phase 37 — Universal application coverage run

Detect and test every approved installed application feasible in the current environment. Publish an evidence-backed coverage registry.

## Phase 38 — Adversarial, reliability and performance proof

Run security, protected-input, stale-state, injection, cancellation, crash, reconnect, overnight and resource tests. Fix every reproducible defect.

## Phase 39 — Final universal-control audit

Audit every active route, tool, permission, model, app, browser message, native command, skill pack, receipt, test and deferred boundary.

Completion requires:

- No fake success.
- No dead control.
- No orphaned active module.
- No unbounded loop.
- No protected-input bypass.
- No secret exposure.
- No unverifiable “done” state.
- All available gates passing.
- Every unverified external item represented by a complete execution package.
- Exact evidence for all claimed supported applications and routes.

Only after this audit may Codex ask for one final commit and push.

---

# 28. Required development cycle

For every phase and meaningful capability:

`READ -> PLAN -> WRITE -> FOCUSED TEST -> DEBUG -> RETEST -> TYPECHECK -> LINT -> FULL TESTS -> BUILD -> REAL NATIVE/BROWSER CHECK -> SECURITY CHECK -> DIFF REVIEW -> CHECKPOINT -> REPORT -> CONTINUE`

Codex must not voluntarily stop after a file, test, report, percentage or phase.

It may stop only for:

- Enforced usage limit.
- Required privileged approval.
- Proven external prerequisite after all unrelated coding is complete.

Before stopping it must record:

- Current phase and subphase.
- Last edited file.
- Last passing test.
- Last full-gate result.
- Exact next command.
- Expected result.
- Current blocker.
- Current readiness values.
- Checkpoint path.

---

# 29. Final definition of completion

Stage 2 source is complete when all universal-control source, adapters, simulators, tests, setup systems and recovery systems are implemented and integrated.

Stage 2 Windows runtime is complete when the companion performs real approved tasks on the current Windows PC and independently verifies them.

Stage 2 browser runtime is complete when Chrome and Edge extension workflows pass controlled and approved real tests.

Stage 2 Any-App architecture is complete when an unfamiliar application can be identified, mapped, rehearsed, controlled through an allowed route, verified, recovered and converted into a versioned skill pack.

Application coverage remains evidence-based. OCADE must never convert “architecture can attempt it” into “every product is proven.”

The supported launch scope may be called complete only when every advertised function is genuinely working or clearly requires a user-supplied application, licence, account or permission through a complete setup flow.
