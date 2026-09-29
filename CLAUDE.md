/caveman ultra
/ponytail ultra

# OCADE Claude Instructions

## First action of every session

Run `/caveman ultra` and `/ponytail ultra`, then read `AGENTS.md`, the current owner request, `PLAN.md`, `ToRemove.md`, `docs/MEMORY.md`, and the canonical docs relevant to the phase.

Re-read the exact latest `main` SHA before making claims. Preserve unfinished local work. Never reset, delete, overwrite or re-clone over uncommitted work.

## Active mission

Continue the OCADE JARVIS commercial-readiness mission in `PLAN.md`.

The current owner direction is:
- no OCADE browser add-on dependency;
- existing user Chrome/browser first;
- trusted OCADE Device Agent + tray for Windows/macOS;
- donor-derived Playwright, direct APIs, accessibility, vision and PyAutoGUI control;
- Android installed OCADE experience + floating bubble and supported deep control;
- iPhone/iPad PWA/Apple-supported paths + Remote PC;
- Primary Owner/Backup Owner/Admin/Staff operations backend;
- JARVIS Online-only, conversational while working;
- heavy MCP and real-world verification after every phase.

## Donor mandate

The immutable source at `imports/ocade-jarvis/source-original/` is read-only provenance.

Before implementing any JARVIS execution capability, inspect the matching donor file(s) line-by-line enough to understand the control path, state, dependencies, failure handling and useful algorithms.

Target approximately 98% donor capability/logic reuse where safe. Copy/adapt donor logic into active `jarvis-runtime/`, rename and wire it cleanly, then harden and test it. Do not run production directly from the immutable donor and do not move/cut donor files.

Preserve or adapt useful donor behavior from browser control, computer control, app launch, files, document processing, code helper/dev agent, screen processing, confirmations, undo, voice, wake, reminders, monitoring, messaging and remote-control concepts.

Do not revive the old donor GUI, donor plaintext/provider-key entry, donor generic customer plugin system, or old phone dashboard GUI.

## JARVIS intelligence

JARVIS is Online-only. It must never route to Chat Offline Intelligence.

Provider/model/vendor/key identities remain hidden from customers. Provider keys stay server-side. Use the approved primary -> secondary -> tertiary capacity strategy only as legitimate configured redundancy.

If all approved Online intelligence capacity is unavailable, lock JARVIS Chat into a clear temporary-unavailable state; preserve checkpoints and do not silently switch to Offline.

JARVIS must remain a strong conversational assistant while working. The user may talk naturally during execution. If asked “what are you doing?”, answer truthfully from current task state while continuing unless the user asks to pause/stop/change direction.

## One action authority

All device work must pass through one action broker that validates current account, device, task, permission, app/site scope, confirmation, control lease, idempotency and cancellation state immediately before dispatch.

Preferred control hierarchy:
1. direct/native APIs and file/document operations;
2. application scripting/CLI/macros;
3. structured browser DOM/CDP/accessibility;
4. OS accessibility/UI Automation;
5. local vision/screen understanding;
6. PyAutoGUI with a fresh observation only.

Never let raw model output bypass validation.

## Existing browser control

OCADE does not require a customer browser add-on.

For browser work, prefer the user's existing Chrome/profile and other installed/default browsers when appropriate. Use securely available CDP/DevTools/Playwright attachment first, then accessibility/vision/PyAutoGUI fallback.

For development testing, use Playwright MCP against a running Chrome by CDP channel where available:

`cmd /c npx -y @playwright/mcp@latest --cdp-endpoint=chrome --console-level warning`

Use Chrome DevTools MCP against the existing Chrome:

`cmd /c npx -y chrome-devtools-mcp@latest --autoConnect`

Remote debugging must be enabled by the owner/browser as required by Chrome. Do not reintroduce an OCADE browser add-on as a product dependency.

For clean-browser regression, use isolated Playwright Chrome separately. Use Edge, Firefox and WebKit for compatibility.

## Windows Device Agent

Windows uses one OCADE tray identity. Do not require a floating desktop mini-control.

The tray must expose simple customer states and essential controls: Ready/Working/Waiting/Stopped/Needs permission where appropriate, Open OCADE, STOP JARVIS, Pause/Resume if applicable, and Exit.

The agent should autostart as a lightweight dormant supervisor and keep idle CPU/RAM/network very low.

STOP is synchronous local authority: cancel active mouse/keyboard work, browser work, task-owned process trees, cancellable operations and queued work immediately.

If a device is removed while an action is running, set the local cancellation token and join/terminate owned work before deleting identity/returning. Add a regression that removes a device during an actual running physical action.

If execution-control state cannot be read from the backend, physical execution must fail closed. Add adversarial tests for control-table/backend failure.

## Real PC execution

Discover installed apps. Prefer existing appropriate app windows. Verify foreground window before typing/clicking.

Support multi-monitor and Windows DPI scaling. Any window/layout/focus/monitor/scroll/popup/navigation mutation invalidates stale coordinates.

Use clipboard intelligently for long text and restore previous clipboard where practical.

User physical input pauses normal automation. Co-work deliberately alternates ownership; never let actors race.

Do not constantly open visible terminal windows. Use direct process execution or hidden/nonintrusive shells where safe; show a terminal only when the user/task benefits from it.

## Files, Excel and development acceptance

Files remain scoped to user-granted workspaces/folders by default, with explicit broader grants when necessary. Prefer Trash/Recycle Bin. Protect important overwrites.

Excel acceptance is not “type a value”. Required real-world Excel testing must cover workbook inspection, formulas/references, fill, formatting, preservation, save/reopen and result verification. Use openpyxl/direct operations where best and real Excel UI where required.

Coding acceptance must include a real repo bug/fix journey: inspect -> edit -> run tests -> diagnose -> repair -> verify, optionally using VS Code but preferring direct repo/terminal operations where safer.

## Voice and wake

Hey OCADE uses a small local wake model downloaded and verified once when enabled. Keep it across restarts/updates. Pre-wake audio stays local.

Voice must be interruptible while JARVIS works. User speech can ask status, change direction, pause, continue or stop. Use current task state to respond naturally.

## Android

Use the running Android environment when available. Appium is the primary structured Android tester, then Mobile MCP runs an independent pass after control is released. Use Chrome/DevTools/Playwright for mobile web/PWA diagnostics where applicable.

Android installed OCADE experience uses one user-facing OCADE identity, guided permissions, floating bubble, chat, voice, current task/progress, STOP and Open full JARVIS. Do not bypass Android-owned permission screens.

## Apple

WebKit compatibility tests are required but are not physical Apple evidence.

Seek legitimate real iPhone/iPad/macOS testing. Mobile MCP may list remote physical iOS devices, but do not start a paid/billed reservation without explicit owner approval. If no real environment is available, mark only REAL APPLE evidence BLOCKED and continue independent work.

## Owner/Admin/Staff

Primary Owner identity is server-side and stable; never hardcode frontend email authorization.

Owner Console appears only for Owner. Staff Console appears automatically only for granted staff. Normal customers see no privileged wording/link/data.

Fix the current TOTP/2FA enrollment defect before privileged mutations are considered ready. Owner may be view-only during bootstrap; sensitive mutations remain locked until required assurance is satisfied.

Roles and granular permissions must be enforced server-side/RLS. Staff grants resolve email -> stable user UUID. Disabling/removing a staff role takes effect immediately across active sessions.

## Mandatory MCP execution

Health-check the applicable MCPs at the beginning of each implementation wave. Unavailable tools are BLOCKED evidence, not permission to skip unrelated testing.

Use one active controller per surface:
- Playwright/CDP: browser actor;
- Chrome DevTools: browser diagnostics/observer;
- Physical Computer Use: real Windows/native UI actor;
- Appium: first Android actor;
- Mobile MCP: independent second Android pass;
- Filesystem: file/output verification;
- Supabase: Auth/RLS/database verification;
- Cloudflare: deployed runtime/source identity;
- GitHub: repository/commit/merge authority.

Do not let two controllers click/type into the same surface simultaneously.

### Browser test matrix

Use:
- existing logged-in Chrome by CDP/DevTools where available;
- clean isolated Chrome;
- Edge;
- Firefox;
- desktop WebKit;
- iPhone/iPad WebKit compatibility;
- Android-class Chromium.

Test auth, account switching, multiple tabs, existing session state, download/upload, back/forward, reload, Take Over/Continue, STOP, stale state, responsive layouts, console/network/storage/service-worker errors and performance.

### Real Windows matrix

Use the real Device Agent and Physical Computer Use to prove:
- install and health;
- one tray identity;
- autostart;
- enrollment;
- app discovery;
- existing Chrome task;
- Excel/formula task;
- File Explorer/files task;
- VS Code/code task;
- multi-app workflow;
- STOP during an active action;
- user takeover/Co-work;
- restart/reconnect;
- update/rollback;
- Exit/uninstall/reinstall;
- account/device revoke while action is active.

Verify the actual visible/file/process outcome after JARVIS claims success.

### Android matrix

Use emulator/device + Appium, then reset/release and independently use Mobile MCP. Include onboarding, permissions, floating bubble, foreground/background, orientation, keyboard, app launch/control, files/share, notifications where used, Remote PC, account isolation, STOP, uninstall/reinstall and recovery.

### Security/adversarial matrix

Deliberately test rapid repeat clicks, stale state, network loss, backend-control read failure, permission revoke, account switch, session expiry, malformed action, duplicate action, task restart, device removal mid-action, prompt injection, path escape, private-network navigation, confirmation bypass attempts and late results.

## Fix loop

For every bug:
reproduce -> classify -> isolate root cause -> add/update regression -> fix -> targeted retest -> nearby integration retest -> real MCP/physical verification -> adversarial break attempt -> broader regression.

Do not close a bug because source “looks right”.

## Cleanup

After a capability is proven, run /caveman ultra and /ponytail ultra again. Consolidate duplicate authorities, remove proven dead code and stale dependencies, then rerun the complete affected matrix.

The old active browser-bridge product path and Windows floating mini-control are removal targets only after their replacements are proven. Immutable donor/import/audit evidence remains untouched.

## Reporting

After every phase report:
- Phase X — Complete / Partial / Blocked
- Tasks completed
- Bugs found / fixed
- Local tests
- MCP / real-device evidence
- Remaining blockers
- Current commercial-launch readiness: XX%
- Commit/push/deploy identity

The percentage must reflect actual release gates, not optimism.

Do not stop the mission merely because one external dependency is blocked. Continue every executable independent item through final cleanup and production proof.
