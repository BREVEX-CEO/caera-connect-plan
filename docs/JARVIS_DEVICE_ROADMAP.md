# OCADE JARVIS Deep Device Roadmap

## Status

Approved by owner on 2026-09-26.

This document extends the already-implemented OCADE JARVIS web/browser mission. It does not replace or invalidate completed browser work, source-preservation rules, Chat protections, or existing verified Supabase authorities.

The starting repository state for this extension is main commit `907140a155d963b20519f679c0a40763b1bb619d`, which contains the completed JARVIS web/browser implementation plus the uploaded `imports/UI OCADE JARVIS.zip` visual reference.

## Product direction

OCADE JARVIS remains a website-first product at `/ocade-jarvis`. It must answer ordinary questions like a normal conversational assistant and perform explicit work/control requests through permission-bound tasks.

The website/PWA remains the primary interface on desktop, tablet, Android, iPhone and iPad. Desktop deep control is provided by a one-time trusted OCADE Device Agent for Windows and macOS. Mobile remains web/PWA-first; no mandatory Android or iOS application is part of this roadmap.

Provider, model, vendor, runtime, storage and infrastructure identities remain hidden from ordinary customer surfaces.

## Latest UI reference

`imports/UI OCADE JARVIS.zip` is the latest primary visual/code reference. Preserve the ZIP untouched.

Use useful source patterns/components from it as a donor/reference for the production `src/jarvis/` UI, but do not ship its standalone scaffold, fake responses, random graph data, fake status claims, decorative desktop window buttons, duplicate theme controls, placeholder alerts, or unsupported navigation.

Production navigation is:

- Conversations
- Tasks
- Activity
- Allowed Apps
- Devices

Do not expose a customer Plugins tab. Reuse OCADE Settings instead of creating a duplicate settings product. Permissions remain contextual.

The central graph/orb is a genuine round 3D aura/knowledge graph. It starts clean and grows only from real OCADE JARVIS data: conversations, JARVIS memory, tasks, apps, devices, projects and useful work relationships. Ambient visual lines may exist only when clearly decorative and must never imply fake stored relationships.

Double-click enters Orb Focus mode until exit. After approximately eight seconds, nonessential controls may fade while focus remains active.

## Desktop Device Agent

Support Windows 10/11 and modern macOS first. Linux is later.

The Device Agent must be effortless to install and normally invisible. A tiny dormant supervisor may start with the operating system and consume minimal resources. The active control session closes when OCADE/Chrome closes unless one of these conditions applies:

- an already-authorized task is still running;
- the user explicitly enabled Background/Wake Mode;
- a resumable scheduled/background task is active.

If no such condition exists, the execution session ends. The supervisor remains only as required for safe update, enrollment and explicitly enabled background/wake capability.

One tray/menu-bar OCADE presence is allowed. Never create duplicate tray icons.

The user can exit or uninstall the Device Agent. Exit stops device control after warning about active tasks. Uninstall removes local executables/services/cache/device credentials and clearly explains that PC control, background execution and wake features will stop. Cloud conversations/task history remain until separately deleted.

Public production installers must be signed/notarized. Unsigned builds are private development/test artifacts only.

The agent automatically updates from signed OCADE releases and rolls back when a new release fails health checks. Website, agent and browser extension share one versioned protocol contract; incompatible versions fail safely and guide an automatic update.

## Device enrollment and security

Same-account devices pair automatically without QR codes or manual token handling.

Each device still receives its own unique cryptographic device identity and encrypted/rotated credentials automatically. A new-device security notification is shown to the account. A lost device can be revoked immediately from OCADE.

Passwords are never used as persistent device credentials. Stored browser passwords are never extracted by JARVIS. Normal password-manager/browser autofill may be used, and CAPTCHA, OTP, passkey, UAC, administrator-password and equivalent human-authentication boundaries pause for the person.

High-risk actions produce an auditable receipt describing intended action, actual result and approval state.

## Chrome extension

A small official OCADE Chrome extension may be used when genuinely needed for authorized real-browser control.

The extension should be prepared for Chrome Web Store publication. It must have a clear OCADE identity, secure login/account linking, navigation back to `ocade.in` and `/ocade-jarvis`, visible connection/status controls, minimal permissions, and no provider/model/vendor disclosure.

Chrome is first-class. Edge/Chromium follows where compatible. Safari support is added only where technically reliable.

Default browser automation uses a safe OCADE-controlled browser context. The person's existing Chrome/profile is used only when the task needs their authenticated session or the user explicitly requests it. JARVIS controls only its authorized tab/session and never injects into or closes unrelated user tabs.

## Deep PC control

Prefer execution methods in this order:

1. application-native API/scripting/automation;
2. direct file/project operations when safer than visible typing;
3. structured accessibility/UI automation;
4. local screen/vision understanding;
5. re-observed coordinate interaction as the last fallback.

JARVIS automatically detects useful installed applications locally after permission. Allowed Apps uses simple Always Allow / Ask / Never Allow choices.

One task at a time may own mouse/keyboard/UI control. Safe non-conflicting background tasks may run in parallel under bounded resource limits. Physical user mouse/keyboard input immediately pauses UI automation and it remains paused until Continue, except during an explicitly enabled Co-work mode.

Multiple monitors are resolved automatically from task context and JARVIS asks only when genuinely ambiguous.

Direct file/code operations remain inside the selected workspace/task scope unless the person explicitly grants broader access. Whole-computer access is never the silent default. Recycle Bin/Trash is preferred; permanent deletion requires confirmation.

Program installation/uninstallation and major system changes require confirmation at the system-changing step. Restart/shutdown/log-out require confirmation unless the user's current instruction explicitly requested that exact operation.

## Coding and local execution

Within an explicitly selected project/workspace, JARVIS may directly edit files, use terminals, run tests/builds, use Git, perform local commits and use local development tools.

Push, force-push, branch deletion, production deployment and destructive history operations follow stronger permission/confirmation rules.

Provide an OCADE-managed lightweight sandbox/container capability for coding and tool execution. Prefer the smallest secure implementation supported by the host OS. Do not require ordinary users to manually configure Docker Desktop.

Where a bundled/container runtime is necessary, install it automatically only when needed, verify signed/checksummed artifacts, minimize disk usage, enforce CPU/RAM/storage limits and shut idle environments down. Never claim software is bug-free or virus-proof; instead use signed releases, integrity verification, least privilege and isolation.

## Background, remote and recovery

An explicitly started or scheduled device task may continue after the website closes.

If internet connectivity is lost, complete only safe purely local steps that do not require network/intelligence, checkpoint state, then pause at the next boundary. Resume after authenticated reconnect.

Long-running tasks use durable checkpoints. After reboot, restore state automatically, resume safe steps and request approval before a sensitive next action.

Phone, tablet or another signed-in device may remotely control a paired PC. One controller/task owns active UI control at a time; other devices may observe status or queue work.

Completion can use OCADE web notifications plus optional OS notifications. A global STOP JARVIS control must be available from the web UI, active mini-control and tray/menu-bar surface.

## Mini control surface

Desktop may expose an optional movable round OCADE control. By default it appears during active device control; the user may pin it while JARVIS/device control is enabled.

Clicking opens a compact professional mini-chat/status surface with rounded UI and quick access to progress, Stop/Continue, current controller state and Open OCADE.

It must not create duplicate tray icons or become permanent clutter.

## Voice and wake behavior

JARVIS starts text-only.

Voice is enabled only when the user presses Voice or explicitly enables wake/voice behavior. Microphone permission is requested on first Voice use, not when the JARVIS page initially opens.

If TTS is disabled, spoken commands may still be understood and responses remain text-only.

`Hey OCADE` is optional. On PC, wake-word detection should remain local/private and only activate online audio/intelligence after the wake phrase is detected. Background wake requires explicitly enabled Background/Wake Mode.

Voice supports spoken and visible Stop, Pause, Continue and Cancel/End. Speech must be clear and concise and should preserve useful interaction behavior from the preserved original JARVIS source without reviving retired provider-key or old GUI architecture.

## Online intelligence and three capacity slots

JARVIS continues through the existing OCADE server-side Online Intelligence authority and never exposes provider, model or vendor identity.

Exactly three configured server-side capacity/key slots exist: primary, secondary and tertiary.

Failover must remain compliant and technically correct. Rotate to another configured slot only when the failure is actually slot-local or independent capacity is genuinely available. Do not rotate keys merely to evade a project-wide/provider-wide quota.

If all configured Online capacity is genuinely unavailable or exhausted, stop new JARVIS intelligence turns, show a customer-safe temporary timeout/unavailable state, preserve active task checkpoints, and restore service automatically when capacity returns.

The customer sees only OCADE availability/usage language, never the provider or key-slot reason.

## Mobile web/PWA

Android, iPhone and iPad remain website/PWA-first. Add to Home Screen is supported.

No mandatory native mobile app or companion is part of this roadmap.

Mobile has a dedicated Remote PC subsection so a signed-in phone/tablet can start, stop, observe and control tasks on a paired PC even when the phone browser is later minimized, because execution occurs on the PC Agent.

A normal mobile website/PWA must not claim unrestricted OS-wide control of arbitrary third-party apps, persistent always-on-top overlays over other apps, or background wake behavior that the platform does not actually allow. Where the browser/OS exposes supported web capabilities, use them. Unsupported cross-app control is shown as unavailable rather than faked.

The mobile JARVIS UI may provide a compact round launcher/control inside the installed PWA/web surface. It must remain clean, professional and touch-friendly.

## Data and graph

Keep Chat and JARVIS logically separate while reusing approved account/conversation authorities.

JARVIS graph data may include real relationships between conversations, JARVIS memory, tasks, apps, devices, projects and work context. Categories are primarily distinguished through shape, size, structure and restrained accent use rather than a rainbow palette.

Node selection opens a small safe inspector with category, title/summary, date, relationship metadata and type of stored data. Navigation to an underlying object is explicit.

## Implementation sequence

1. Reconcile docs and latest UI ZIP.
2. Preserve and verify current browser JARVIS baseline.
3. Clean/integrate the new JARVIS UI reference.
4. Create the shared website/agent/extension protocol contract.
5. Build the trusted Windows/macOS Device Agent packaging, secure enrollment, updater and rollback.
6. Publish-ready Chrome extension and authorized real-browser path.
7. Deep PC application/file/screen/system control.
8. Coding workspace and lightweight sandbox/container execution.
9. Background execution, checkpointing, reboot recovery and remote device control.
10. Voice/wake and mini-control surface.
11. Mobile PWA + Remote PC control.
12. Only then explore additional mobile-browser capabilities that are genuinely supported.
13. Run full adversarial/security/performance/device verification.
14. Reconcile cleanly and merge to main only when evidence is green.

## Release evidence

No capability is called complete from source code alone.

Report separately:

- SOURCE-PROVEN
- LOCAL TEST
- REAL BROWSER
- REAL WINDOWS
- REAL macOS
- REAL ANDROID WEB/PWA
- REAL iOS WEB/PWA
- DATABASE TEST
- LIVE
- BLOCKED
- UNTESTED

The completed web/browser baseline remains protected throughout this roadmap.
