# OCADE Project Memory

## Current status

OCADE's established Chat product is protected and the new active mission is **OCADE JARVIS**.

The canonical JARVIS route will be **/ocade-jarvis**.

The original JARVIS ZIP is stored under imports/ocade-jarvis/ with README, LICENSE, and preservation-specific CLAUDE instructions.

The current main documentation now treats JARVIS as active rather than future/obsolete work.

## Current JARVIS decision

The original ZIP is the main JARVIS engine foundation rather than a small donor sample.

The uploaded ZIP remains untouched.

An immutable extracted copy will live under imports/ocade-jarvis/source-original/.

A working extracted runtime will live under jarvis-runtime/.

The new OCADE web GUI will live under src/jarvis/.

The old active JARVIS GUI and manual provider-key entry are replacement targets in the working runtime.

The original plugin system remains preserved but unused.

The original FastAPI phone dashboard remains preserved but is not exposed as the final remote-control product.

## Product decisions

JARVIS is Online-only.

JARVIS uses OCADE's existing approved server-side Online intelligence authority.

JARVIS and Chat have separate usage allowances.

Signed-out users may view JARVIS, but execution requires sign-in.

Normal questions receive normal answers and explicit work requests become JARVIS tasks.

JARVIS voice supports Interrupt, Pause, Continue, and End.

The default wake phrase is Hey OCADE where supported.

Browser control is the first deep automation capability.

Playwright/Playwright-MCP capability is integrated and automatically configured.

The browser design supports isolated automation and an authorized real-browser path.

The system re-observes after resize/zoom/layout changes instead of trusting stale coordinates.

Purchases remain prohibited.

## GUI decisions

The GUI uses a clean central 3D orb and real neural graph.

The graph starts simple and grows as JARVIS conversations, memory, tasks, devices, and allowed-app relationships grow.

The graph supports cursor reaction, pan, zoom, hover, selection, and semantic zoom.

Selecting a node shows safe metadata about represented data without automatically opening private underlying content.

The interface supports dark/light themes and optional custom orb accents.

The sidebar is compact by default and expands when needed.

Initial sections are Conversations, History, Tasks, Activity/Logs, Allowed Apps, and Devices.

## Data decisions

JARVIS reuses the existing conversation/message authority with a JARVIS surface discriminator.

JARVIS memory remains logically separate from Chat memory.

Detailed JARVIS activity logs retain for 90 days.

Raw screenshots/visual frames are temporary by default.

Temporary JARVIS tasks are not part of the first mission.

## Important constraints

The JARVIS mission must not break existing Chat, Library, Settings, authentication, Offline Intelligence, usage, public/legal, or Admin behavior.

The web mission is now complete enough to begin the explicitly approved deeper-device roadmap; preserve the completed baseline while extending it.

Do not claim deeper computer/mobile control until genuinely implemented and tested.

## Implementation state (2026-09-26)

The ZIP is preserved byte-for-byte; `imports/ocade-jarvis/source-original/` matches it file for file (58 files) and `source-is-preserved.test.ts` pins both.

`jarvis-runtime/` is the working engine: the old Qt GUI, `main.py`, the avatar, the local LLM client and every plaintext provider-key read are retired from it; all capability modules remain. `ocade_agent.py` is the installed entry point; `ocade_device.py` connects and runs (connect, run, forget).

`/ocade-jarvis` is live in the build: orb/graph GUI, compact rail, Permissions drawer, tasks, live browser panel, confirmation, Take Over, Stop, Resume and browser voice controls.

Intelligence goes through the existing Edge boundary with `surface = "jarvis"`. Migration `20260926090000_ocade_jarvis_web.sql` is applied to production (verification block passed; live permit smoke charged JARVIS, not Chat). `ocade-intelligence` v10 is deployed and its files match the repo.

Browser control is proven locally end to end with a real paired runtime (`npm run audit:jarvis`), including a real Chromium over CDP where JARVIS works in its own tab. Speech-to-text is proven with a fake recogniser; the real speech service and a real-model JARVIS turn were not reachable from the build sandbox.

## Next steps

Run one signed-in JARVIS task on production with a real model and a real paired computer, including voice in a real browser.

Prove the authorized real-browser path on a real desktop, then begin the deeper computer-control phase from the preserved runtime modules.

## Session handoff

Every fresh Claude session runs /ponytail ultra and /caveman ultra first, then reads AGENTS.md, PLAN.md, this file, and JARVIS preservation instructions.

## Approved continuation after browser mission

The latest repository baseline for the next JARVIS mission is main commit `907140a155d963b20519f679c0a40763b1bb619d`, created when the latest `imports/UI OCADE JARVIS.zip` reference was uploaded after the completed browser/web implementation.

The completed browser baseline remains protected. The owner has now explicitly started the deeper-device mission documented in PLAN.md Phases 13–23 and `docs/JARVIS_DEVICE_ROADMAP.md`.

The next work is: reconcile the latest UI ZIP, create the shared protocol, build secure signed Windows/macOS Device Agent packaging, publish-ready Chrome extension, deep PC control, coding/container support, background/checkpoint/remote control, opt-in local wake/voice, and mobile web/PWA Remote PC.

Production sidebar target is Conversations, Tasks, Activity, Allowed Apps and Devices. History is removed as a duplicate.

JARVIS starts text-only. Voice permission occurs on first Voice use.

The Device Agent uses unique per-device credentials even though enrollment is effortless through the same OCADE account.

Mobile has no mandatory native companion in the approved roadmap. Do not fake unsupported mobile OS-wide app control.

The last implementation report's remaining proof gaps still matter: real Online-model path from the restricted sandbox, real speech service, and real authorized-browser proof on an actual desktop. These are evidence gaps, not reasons to discard the completed implementation.

## Deeper-device implementation state (Phases 13–22, 2026-09-26)

Evidence labels follow `docs/JARVIS_DEVICE_ROADMAP.md`. Nothing below is claimed on Windows, macOS, Android or iOS hardware: none was available.

- **UI (Phase 13).** Rail is Conversations, Tasks, Activity, Allowed Apps, Devices; History merged into Tasks; the rail's theme toggle opens OCADE Settings. Glass orb core, category shapes and depth order from the UI ZIP, real data only. Double-click Orb Focus; controls fade after 8 s. Text-only start, microphone on first Voice. LOCAL TEST, REAL BROWSER (Chromium).
- **Protocol and identity (Phase 14).** `jarvis-runtime/ocade_protocol.json` is the one contract (version 1, signing, headers, paths, gates) read by the website, the Device Agent and the extension. Each device enrolls its own P-256 public key; requests are signed with a strictly increasing timestamp (replay refused); old protocol answers 426; one-click approval with matching fingerprints; security notification; automatic key rotation that survives a lost reply; revoke and self-disconnect. Migration `20260927090000_jarvis_device_identity.sql` is applied LIVE (verification passed, rolled-back smoke passed). LIVE: the Python agent enrolled against ocade.in with a signed request (pending 202), and a replayed request was refused (401); the probe row was deleted. DATABASE TEST, LOCAL TEST, REAL BROWSER.
- **Device Agent (Phase 15).** `ocade_agent.py`: one presence (second start exits), autostart, dormant unless a task is open or Background Mode is on, tray and round mini-control with STOP JARVIS, Exit warning, uninstall that revokes the key and removes autostart and cache. `ocade_update.py`: Ed25519-signed manifest, SHA-256, health check, keep one previous version, roll back after failed starts; refuses all updates until the owner sets `UPDATE_PUBLIC_KEY`. PyInstaller build proven on Linux (`--health` passes); Windows Inno Setup and macOS sign/notarize scripts prepared. LOCAL TEST (Linux). REAL WINDOWS / REAL macOS: UNTESTED. Signing, notarization and the release key: BLOCKED (owner credentials).
- **Extension (Phase 16).** `extension/` MV3, permissions debugger/storage/alarms + the one OCADE host; own non-extractable key; acts only in tabs it opened via chrome.debugger; same page semantics file and gates as the agent. Journey-proven in Chromium with the person's tab untouched. Chrome Web Store submission: BLOCKED (owner account); notes in `extension/STORE.md`.
- **Computer control (Phase 17–18).** Apps (locally detected, Always/Ask/Never), workspace-scoped files (Trash first, permanent delete confirmed), commands in the workspace under bubblewrap + rlimits (Linux), screen observe and fresh-observation clicks, physical input pauses until Continue unless Co-work. Risky commands (push, force, hard reset, recursive delete, install, deploy, sudo) and system changes wait for the person. LOCAL TEST (Linux/Xvfb). Windows UI Automation, macOS Accessibility and Windows Job Object limits: UNTESTED.
- **Background, checkpoints, remote (Phase 19).** One controller per task (another tab or device taking over stops the old loop), one open task per device, checkpoints used on resume, results kept on disk across disconnects and restarts, Remote PC in Devices, global STOP JARVIS, task-result notifications. The planning loop still runs in an open OCADE tab (any device); continuing a plan with every OCADE tab closed needs a server-side step authority and is not built.
- **Voice and wake (Phase 20).** Browser "Hey OCADE" runs only on an on-device recogniser; spoken Stop/Pause/Continue/Cancel; answers can stay text-only. PC wake listens locally only in Background/Wake Mode and opens JARVIS with voice on; the "Hey OCADE" model file does not exist yet: BLOCKED.
- **Capacity (Phase 21).** Edge slot policy unchanged (v10). JARVIS shows an OCADE-worded busy state, saves the task and continues it by itself when the wait ends. LOCAL TEST.
- **Mobile (Phase 22).** Manifest + home-screen icon (owner decision supersedes the earlier no-manifest rule), Remote PC and STOP at 375 px. REAL ANDROID / REAL iOS: UNTESTED.

Next owner actions: provide the code-signing identities, the notarization profile, the update release key and the Chrome Web Store account; run the agent and extension once on real Windows and macOS; train or supply the "Hey OCADE" wake model.
