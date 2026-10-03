/caveman ultra
/ponytail ultra

# OCADE Claude Instructions

## First action of every session

Run `/caveman ultra` and `/ponytail ultra`, then read `AGENTS.md`, the current owner request, `PLAN.md`, `ToRemove.md`, `docs/MEMORY.md`, and the canonical docs relevant to the phase.

Re-read the exact latest `main` SHA before making claims. Preserve unfinished local work. Never reset, delete, overwrite or re-clone over uncommitted work.

## Active mission

Execute the OCADE JARVIS master commercial-readiness mission in `PLAN.md` from **Phase 1 through Phase 49**.

On a fresh clean clone, start at Phase 1. Phases 1–34 are validation-and-repair gates as well as implementation phases: inspect the current implementation, preserve anything already correct, run the phase proof, fix every gap found, and do not rebuild working code merely because the phase is older. Then continue directly through Phases 35–49.

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

Do not stop the mission merely because one external dependency is blocked. Continue every executable independent item through Phase 49, final cleanup and production proof.

The phase order is authoritative. After each phase update the durable ledger and report the commercial-launch readiness percentage. Continue to the next phase automatically unless an owner-only destructive/paid/legal/hardware action is genuinely required.
---

# Owner follow-up instructions — 2026-10-02

These instructions are append-only follow-up authority. They do not erase the earlier mission. Where they conflict with an older sentence above, follow this newer section and the matching 2026-10-02 addendum in `PLAN.md`.

## Universal control is now the default engineering direction

Do not solve broad software control by creating a growing list of separate controllers for Excel, DaVinci Resolve, Photoshop, CAD products, IDEs, utilities, or other individual applications. Build and use the universal OCADE execution engine first.

For each task, use the hidden server-side OCADE Online intelligence authority to reason about the requested outcome and the current application. Detect the installed application, version, process/window, accessibility structure, project/file type, available official automation surfaces, and current live UI. Consult current official documentation when the model's knowledge may be stale. Choose the strongest legitimate route in this order when appropriate: official API/CLI/script/macro/COM/automation interface; direct file/project manipulation; structured browser or app accessibility; local screen/vision; fresh PyAutoGUI coordinates last.

A newly encountered application is not a reason to add bespoke production code. Prove the generic engine first. Keep a specialized adapter only when measurements show it materially improves reliability, preservation fidelity, safety, or speed. During Ponytail cleanup, replace and retire redundant app-specific paths only after equivalent or better universal behavior is proven and regression-tested.

The model may propose task-specific scripts and commands, but the local Device Agent remains the execution authority. It must enforce account, device, task, scope, confirmation, cancellation, STOP, and result verification. Do not give remote model output an unchecked direct administrator shell. Routine task-relevant commands may run automatically after the user has requested the task, while protected OS/authentication boundaries and genuinely high-impact actions remain separately governed.

## Internal OCADE MCP-like capability plane

Development MCP servers are testing tools, not customer dependencies. The shipped product must provide OCADE-owned typed capabilities for browser, computer, files, terminal, apps, mobile, voice, tasks, background work, and devices. Customers should not configure Playwright MCP, DevTools MCP, Appium MCP, PyAutoGUI, or equivalent developer packages manually.

For browser tasks, prefer the user's existing authorized browser/profile. Establish product-owned browser control through the Device Agent and supported browser/OS mechanisms. The goal is one-time setup/authorization followed by ordinary requested browser work without nuisance permission prompts. Never bypass a browser or OS security boundary merely to suppress a prompt. If Chrome/Windows requires a genuine human approval, navigate to it, let the user approve it, then continue automatically.

Keep JARVIS conversation and execution in one experience. A simple question should receive a normal answer. A request to act should create/continue a task. While a task runs, answer status questions from real task state, accept redirect/pause/resume/STOP, and do not lose completed safe work.

## Clarification behavior

Ask a question only when missing information materially affects the result or creates risk. If exactly one obvious target exists, proceed. If the user uploaded one workbook and says “solve this,” use it. If several plausible files/apps/devices exist, present concise likely choices. For a harmless and reversible ambiguity with a strong contextual match, OCADE may select the best match and state what it chose.

Preserve originals by default when overwrite intent is unclear. For solved files, create a clear completed copy and verify it. Apply the same logic to spreadsheets, documents, media projects, code, design files, and other project formats.

## Wake and voice supersession

The production wake model is bundled with the signed OCADE Windows companion and Android application. Do not require a separate wake-model download after installation. This supersedes the older “download once when enabled” sentence above.

Support both `OCADE` and `Hey OCADE`. Keep pre-wake detection local and extremely lightweight. The Windows tray/Device Agent stays available even when Chrome or the OCADE website is closed so wake, background work, reminders, reconnect, and Remote PC remain possible. Android may use a truthful foreground-service notification when the OS requires one for Wake Mode.

Do not require the wake phrase repeatedly during an active conversation. Voice input must work with spoken output disabled. With voice output enabled, JARVIS should respond naturally while it continues real work.

Any nearby person may trigger the wake phrase, while optional speaker recognition may be used as an extra signal for sensitive operations. Speaker recognition never replaces account/device authorization or lock-screen security.

## Device and file discovery

Discover installed applications automatically. Maintain lightweight local metadata for accessible files, drives, external storage, and useful app capabilities so future work is faster. Do not continuously upload or deeply read all user files. Read file contents when the authorized task needs them. External drives may become discoverable automatically when connected.

Learn sanitized app/version control recipes locally. Generic reliability knowledge may be reused without storing or uploading private customer screenshots, file contents, credentials, cookies, OTPs, or secrets.

## Android and Remote PC

Use one planning/task authority for Windows and Android. Only the executor changes. On Android, use intents/native APIs, Accessibility/UIAutomator-style structured control, UI hierarchy, vision, and fresh taps/coordinates. Avoid per-app Android controllers unless evidence proves a specialized adapter is necessary.

Default an ambiguous “open Chrome” request to the device from which the user is interacting. If the user names the PC, or the mobile device cannot legitimately perform the required work, keep the same conversation and route execution to the paired PC.

Use the Pixel 6a Android 14/API 34 Google Play emulator as the stable primary Android test environment unless newer owner authority changes this. Run Appium first, then release/reset and run Mobile MCP independently.

## Owner Console expansion

Keep all Owner/Staff authorization server-side and audited. Normal `ocade.in` may expose the authorized Owner/Staff entry. Preserve `admin.ocade.in` if it remains the safer/smaller implementation; only collapse the privileged UI into normal `ocade.in` if isolation, console-session authority, 2FA, audit, CSP/origin boundaries, and customer concealment remain at least as strong.

The Owner customer surface must support safe account search and operational management including plan/access grant and revoke, usage/credit adjustment through correct authority, session revoke, device removal, supported account disable/recovery, audited deletion workflow, and audit history. Never display passwords, raw OAuth tokens, provider keys, cookies, MFA secrets, or equivalent credentials.

Final tests should exercise a temporary entitlement lifecycle and a temporary staff grant lifecycle on safe test accounts: grant, verify, revoke, and prove immediate loss of authority.

## Final execution and testing order

Do not merge to `main` before the entire sequence below is complete and the owner explicitly approves.

First complete all remaining implementation and Phase 1–49 obligations. Then perform a source-read audit of the active codebase and authorities, find defects by reading/reasoning in addition to tests, reproduce valid findings, fix them, and add regressions.

Then freeze application source edits and run one testing-only wave across the whole product. Finish the whole matrix and record all failures before fixing product source. Include real Chrome, clean Chrome, DevTools diagnostics, Windows Device Agent/tray/native apps, files, Office, coding, multi-app tasks, background work, Remote PC, Owner/Staff, Android Appium/Mobile MCP, voice/wake where evidence is available, security, update/rollback, uninstall/reinstall, and source/deployment identity.

During the universal-app portion of that test, select several installed applications at runtime so implementation cannot cheat by adding app-specific support beforehand. Include at least one unfamiliar application without a specialized adapter, one application where an official API/script route is discovered dynamically, and one case that requires accessibility/vision/fresh-coordinate fallback. Do not add app-specific source code during this frozen test.

After the test-only matrix is complete, fix every reproducible release-scope defect at the root cause, run exact regressions and the full matrix again, then run Caveman/Ponytail and `ToRemove.md` cleanup. After cleanup run the complete matrix again, perform a second independent adversarial attack pass, and perform the final real-user pass.

Use a preview/staging deployment for the branch before touching production. For the final real-user browser pass use the dedicated authorized Chrome profile, Playwright/CDP, Chrome DevTools, and Physical Computer Use. Protected Google authentication steps remain human-only. Test real customer work, not just clicks.

Nothing in this section authorizes merging to `main`. Even when green, stop with the final commercial-release report and wait for explicit owner merge approval.

---

# Owner follow-up instructions — 2026-10-03 — Phases 50–56

This is newer append-only authority. Continue from the current working tree; do not restart proven work. `PLAN.md` now continues beyond Phase 49 through Phase 56. Where older instructions stop at Phase 49 or preserve `admin.ocade.in`, follow the newer Phase 50–56 authority.

## Mission continuation
Continue every remaining executable item through Phase 56 without stopping for routine engineering questions. Preserve completed/proven work, fix current findings at root cause, test, debloat only after replacement proof, then retest. Do not merge to `main` until the Owner explicitly approves after Phase 56.

## Universal control
Prioritize Gemini/OCADE intelligence-driven PC and mobile control. Do not add hard-coded per-app production code merely to make a test app pass. The intelligence layer inspects the live app/browser/device/file state and chooses the strongest legitimate route; the local OCADE broker executes, validates, stops, verifies, and recovers.

Test both simple and complex real tasks across Chrome, files, Excel/Office, coding, unfamiliar Windows applications, multi-app workflows, professional/creative software including DaVinci Resolve when available, Android, and Remote PC. Verify the real output independently.

## Integrated Owner/Staff Console
The initial Primary Owner is the verified account `carecadane28@gmail.com`, resolved to a stable server-side user UUID/Owner role. Do not authorize privileged frontend behavior through an email comparison after bootstrap.

Retire active `admin.ocade.in` after the integrated replacement is proven. In normal `ocade.in`:
- Primary Owner sees `Owner Console` in authenticated navigation;
- a granted staff account sees `Staff Console` in authenticated navigation;
- ordinary customers see no privileged entry or hint.

Staff permissions are granular per staff member. Staff uses normal account limits unless the Owner grants timed or permanent unlimited usage. Revocation must remove backend authority immediately and remove/redirect the Staff Console without waiting for a new login. Primary Owner has permanently unlimited Chat/JARVIS usage while internal usage/cost telemetry continues.

Owner may grant another Owner role or transfer Primary Owner status to another verified account using recent 2FA/re-auth, explicit confirmation, audit, stable UUID authority, and last-owner protection. Protect against accidental Primary Owner self-demotion/deletion.

Use normal audited entitlement controls to reset test-account usage or grant temporary/permanent unlimited usage when mobile/PC testing would otherwise be blocked by legitimate limits. Never bypass usage enforcement secretly.

## Whole-product testing
Continue the current test/fix ledger rather than restarting old phases. Test the entire reachable site and every relevant route/button/menu/form/state, especially Devices, Owner Console, Staff Console, JARVIS, auth, usage/entitlements, sessions, devices, role changes, and mobile/desktop responsive behavior.

The Devices surface must work completely: navigation, loading, current/stale states, enrollment, connect, reconnect, revoke, error/retry, account isolation, and immediate authority changes.

Run Appium then independent Mobile MCP for Android. Use Playwright/CDP, Chrome DevTools, Physical Computer Use, filesystem/output verification, Supabase, Cloudflare and GitHub where appropriate. Keep one active controller per surface.

After universal-control proof, run Caveman/Ponytail and `ToRemove.md` cleanup to remove proven redundant hard-coded app paths, duplicate control authorities, stale `admin.ocade.in` code, dead routes, obsolete wake-download logic, dead code and unnecessary dependencies. Preserve anything still required for reliability/security/rollback and preserve immutable donor/history/migrations.

Then rerun the full cleaned-tree matrix, second adversarial/security pass, final real-user pass, and final commercial report. Show short progress updates with current phase, phases complete out of 56, readiness %, % remaining, blockers, and next step. Never inflate the percentage.

Nothing authorizes a merge to `main` before explicit Owner approval.
