# OCADE JARVIS Commercial-Readiness Plan

## Owner authority — 2026-09-29

This plan supersedes older conflicting device/browser/admin direction.

CARCC is the company. OCADE is the product. OCADE Chat and OCADE JARVIS remain separate protected experiences.

The current main baseline when this plan was authored is `8e4828928d4bfac3edeb79a956b717e538a123d4`. Re-check latest `main` before implementation.

The mission is not to rebuild JARVIS from scratch. The mission is to turn the preserved owner-supplied JARVIS runtime into a secure OCADE execution engine, reuse approximately 98% of useful donor capability/logic where safe, remove obsolete GUI/provider-key/customer-plugin paths, integrate deeply with OCADE, and prove it on real browsers/devices/computers.

## Permanent invariants

- `imports/ocade-jarvis/` and `imports/ocade-jarvis/source-original/` remain immutable.
- Production copies/adapts donor logic into `jarvis-runtime/` or the correct active runtime; it never imports from or mutates the immutable donor.
- Old donor GUI is not shipped.
- Customer provider-key entry is not shipped.
- Provider/model/vendor identities and provider keys remain hidden.
- JARVIS is Online-only. No JARVIS request silently falls back to Chat Offline Intelligence.
- If all approved Online capacity is unavailable, lock JARVIS Chat into a truthful temporary-unavailable state and preserve task checkpoints.
- Existing Chat, Offline Intelligence, Library, Settings, auth, public/legal surfaces and usage authorities remain protected regression surfaces.
- No OCADE browser add-on is required or planned as an active product dependency.
- Existing user browser/profile is preferred for user-requested browser work.
- Final purchase/payment execution is prohibited.
- Sensitive/destructive/security/public-submission actions follow confirmation policy.
- MCPs are test instruments, not customer runtime.
- Historical audits remain evidence; they do not override this owner authority.

## Donor capability mandate

Before implementing each capability, inspect the matching donor implementation in `imports/ocade-jarvis/source-original/ocade jarvis 25-09/`.

The capability ledger must deliberately classify every meaningful donor family as KEEP/ADAPT/REPLACE/PRESERVE UNUSED/REMOVE FROM ACTIVE. At minimum classify:
- browser control;
- computer/mouse/keyboard control;
- computer settings/window operations;
- application launch;
- files and Trash/undo;
- document/spreadsheet/PDF/media processing;
- code helper/development agent;
- screen/camera processing;
- action discovery;
- confirmations;
- hotkeys;
- wake word;
- speech input/output/audio devices;
- memory concepts;
- reminders/background monitoring/proactive behavior;
- messaging;
- system monitoring;
- remote phone/dashboard concepts;
- generic plugin framework;
- old GUI/avatar stack.

No donor-integration completion claim is allowed until this ledger is complete and every kept/adapted family has replacement/runtime test evidence.

## Shared execution architecture

One action broker is the sole device-execution authority. It validates immediately before dispatch:
- account ownership;
- target device;
- task/conversation/request identity;
- capability;
- permission and app/site scope;
- confirmation/assurance;
- current control lease;
- idempotency/retry state;
- cancellation state;
- current device capability;
- current safety-control state.

Preferred execution hierarchy:
1. direct APIs, file/document operations and application automation;
2. application scripting/CLI/macros/native OS launch;
3. structured browser DOM/CDP/accessibility;
4. OS accessibility/UI Automation;
5. local visual understanding;
6. PyAutoGUI/fresh coordinates last.

Every meaningful action verifies the resulting state before JARVIS says Done.

## Required conversational behavior

JARVIS must remain a first-class conversational assistant while executing. Typed or spoken questions during work remain in context.

Example:
User: “OCADE, what are you doing?”
JARVIS: “I’m formatting the document for you. You can see the changes on your screen.”

The answer must come from real current task state, not a fabricated status.

User speech may pause, stop, continue, redirect or clarify the task. Replanning begins from a fresh observation.

## Phase 35 — Authority reconciliation and baseline

### Work
- Re-read all current active authorities and this plan.
- Re-check exact `main` SHA, deployed Cloudflare source identity, Supabase migration head, Device Agent version/protocol, Android test environment, browser/MCP health and current bug baseline.
- Record historical audit findings separately from currently reproducible defects.
- Build the donor capability ledger.
- Confirm immutable donor/import files are excluded from formatting/debloat/dependency rewrites.
- Confirm deferred/non-blocking items: Sentry project, payment-provider work, paid Supabase leaked-password feature, public browser-store work.
- Confirm Inno Setup is available for Windows test packaging.
- Confirm Android SDK/emulator/ADB/Appium environment.
- Record real Apple evidence availability separately.

### Acceptance
- No ambiguous authority conflict remains.
- Every active phase has named entry/exit criteria.
- Commercial-launch readiness baseline is reported with evidence.

## Phase 36 — Critical security and lifecycle repair

### Work
- Reproduce and fix OCADE TOTP enrollment rejection using production-like Supabase Auth behavior. Test fresh enrollment, cancel/retry, wrong code, expired code, clock edge, successful enrollment, challenge, recovery and account switching.
- Owner may view bootstrap console while privileged mutations remain locked until required 2FA.
- Fix device removal during an active action: local cancellation must fire synchronously, task-owned work must stop/join/terminate safely, credentials then revoke, and no late action may continue.
- Make physical execution fail closed when safety/service-control state cannot be read. Preserve an explicit emergency environment fallback but do not treat unreadable control state as permission.
- Revalidate permissions/capabilities at dispatch and result settlement.
- Verify late results cannot resurrect stopped/removed work.
- Verify STOP is locally synchronous.
- Harden replay/idempotency, stale-auth, stale-device, cross-account and task-ownership boundaries.

### Adversarial acceptance
- remove device while real typing/process/browser work is active;
- disable staff/device permission mid-action;
- database/control read outage;
- duplicate/replayed exchange;
- account switch during task;
- expired session;
- Stop while action is physically active;
- task result arriving after cancellation.

No known Critical/Major blocker remains in shipped execution authority.

## Phase 37 — Donor runtime consolidation

### Work
- For every KEEP/ADAPT donor family, copy/adapt the useful implementation into active `jarvis-runtime/`; do not cut/move donor files.
- Rename/wire modules where needed to match OCADE ownership.
- Remove donor provider-key entry and direct provider-client use from active execution paths; all intelligence routes through OCADE server authority.
- Do not expose/use the donor generic customer plugin system.
- Preserve remote-control concepts but not old dashboard GUI.
- Consolidate duplicate active computer/browser/file/action logic around one broker.
- Keep direct/nonvisual operations nonintrusive; do not pop visible terminals unless the task/user benefits from one.
- Preserve donor strengths such as undo, confirmations, file processing, app launching, screen capture, voice interruption and monitoring only through current OCADE security boundaries.

### Acceptance
- Donor ledger complete.
- Every adapted family has targeted tests.
- Immutable donor hashes unchanged.
- No active runtime requires old GUI/provider-key/plugin architecture.
- Caveman/Ponytail simplification after proof, then full affected regression.

## Phase 38 — Existing-browser autonomous control

### Product behavior
- Prefer the user's existing appropriate browser/profile for browser work.
- Chrome is first-class, but detect/use Edge, Firefox, Brave or other supported installed/default browser where appropriate.
- If Chrome is closed and Chrome is intended, open the normal user profile.
- Never extract/copy saved password databases or cookies.
- Browser password-manager autofill may operate normally.
- CAPTCHA/OTP/passkey/security verification remains human.
- Take Over pauses; Continue performs a fresh observation.
- Untrusted research may deliberately use an isolated browser for safety when login state is unnecessary.

### Control stack
- securely available CDP/DevTools/Playwright attachment;
- semantic DOM/accessibility;
- OS accessibility/UI Automation;
- vision;
- PyAutoGUI coordinates last.

### Required tests
- existing logged-in Chrome profile;
- multiple tabs/windows;
- existing tab and new tab;
- back/forward/reload;
- download -> local file -> next app;
- scoped upload;
- responsive/zoom/scroll/popup mutation;
- Take Over/Continue;
- STOP during navigation/type;
- password-manager handoff;
- human auth boundary;
- private-network authorization;
- prompt-injection attempt;
- account/session switch.

Playwright MCP acts where possible; Chrome DevTools independently checks console/network/storage/service workers/performance. Clean Chrome, Edge, Firefox and WebKit run independent regression passes.

## Phase 39 — Windows Device Agent and tray hardening

### Product behavior
- One OCADE tray identity only.
- No required floating desktop mini-control.
- Tray states remain customer-simple: Ready, Working, Waiting, Needs permission, Offline/Stopped where applicable.
- Tray controls: Open OCADE, STOP JARVIS, Pause/Resume where meaningful, Exit.
- Start automatically with Windows after setup as a lightweight dormant supervisor.
- No duplicate process/tray.
- Low idle CPU/RAM/network.
- Signed-update architecture remains; unsigned installers are development-only until owner provides public signing identity.

### Control requirements
- installed-app discovery and aliases;
- existing-window preference;
- current foreground/window-map verification;
- multi-monitor;
- 100/125/150% DPI and mixed-scaling resilience;
- click/double/right/move/drag/scroll;
- keyboard/shortcuts;
- clipboard with restoration where practical;
- user input pause;
- Co-work control lease;
- task-owned process-tree cancellation;
- UAC boundary;
- restart/reconnect;
- uninstall/reinstall and identity cleanup.

### Real Windows acceptance
Use Physical Computer Use against the real machine and verify actual results, not only API responses.

## Phase 40 — Files, Office and elite spreadsheet execution

### Files
- scoped direct filesystem operations;
- user-granted folders/workspaces;
- explicit broader grants when requested;
- Trash/Recycle Bin default;
- safe overwrite handling;
- undo for reliably reversible operations;
- upload/download chaining.

### Excel
For real workbook tasks:
- inspect sheets/ranges/tables/formulas/types/errors;
- infer correct formulas;
- prefer fill/table/array/named-range/Power Query/direct operations over repetitive cell entry;
- support formatting, number formats, borders, alignment, conditional formatting, charts, filters and tables where requested;
- preserve unrelated workbook structure, formulas, formatting and VBA/macros;
- open real Excel when appropriate;
- verify calculations;
- save, reopen and verify result.

Required acceptance journey must solve a nontrivial workbook with formulas and formatting, not merely type a value.

### Word/PowerPoint/PDF
Use hybrid direct document manipulation + real app UI where needed + final visual verification. Read/search PDFs directly before visual fallback.

## Phase 41 — Development and professional software execution

### Coding
- repo inspection;
- filesystem edits;
- terminal/Git;
- tests/builds;
- diagnostics;
- VS Code UI when useful;
- verify actual program/result.

A required acceptance journey must identify a real seeded bug, modify files, run failing/passing tests and verify the fix.

### Git
Support status/diff/branch/fetch/pull/local commit. Remote publishing must be clearly authorized by task. Force push/history destruction requires stronger confirmation.

### Professional apps
Support Office, IDEs, CAD/design/accounting/editing and unknown applications using:
native/script/API -> accessibility -> vision -> fresh coordinates.

Software install/uninstall may be performed when explicitly requested, with OS security boundaries and uninstall confirmation.

## Phase 42 — Live voice, wake and partnership

### Work
- preserve donor real-time conversational strengths;
- voice while task execution continues;
- truthful spoken status from current task state;
- interruption/replanning;
- Hey OCADE local wake model downloaded and verified once when enabled;
- retain wake model across restart/update;
- pre-wake audio stays local;
- locked-screen security preserved;
- microphone/camera/screen access requested only when needed, with clear state.

### Acceptance
Test voice question during live Excel/Word/browser work, redirect mid-task, Pause, Continue, Stop and error recovery.

## Phase 43 — Background, checkpoints, reminders and remote PC

- Adapt donor reminder/background-monitor/proactive concepts into canonical OCADE Tasks/notification authority; do not create duplicate reminder systems.
- Proactive behavior only in user-authorized classes.
- Long tasks checkpoint.
- Crash/reboot/network recovery reconciles state before resuming.
- Never blindly replay destructive completed work.
- Multiple paired computers supported.
- Different computers may work concurrently; one UI-control owner per device.
- If one eligible PC is Ready, select it automatically; if ambiguous, ask and remember safe preference.
- Phone command such as “fix the spreadsheet on my PC” routes to the paired Device Agent and streams status/result back.

## Phase 44 — Android installed OCADE and floating JARVIS

### Product
- Installation begins at `ocade.in`.
- Customer wording is “Install OCADE”, not implementation jargon unless Android itself shows it.
- One OCADE identity.
- Floating bubble outside other apps where Android permissions support it.
- Expanded bubble: chat, voice, current task/progress, STOP, Open full JARVIS.
- Android permissions are guided, never bypassed.
- Deep control hierarchy: intents/native APIs -> accessibility -> vision -> fresh coordinates.
- Banking/payment apps obey the same no-final-payment and human-auth boundaries.
- Local/background wake where Android permits it.

### Persistence
Ordinary browser-history clearing must not cause unnecessary model redownload where storage remains intact. Explicit OS/site/app data clearing may remove local data and cannot be bypassed.

### Testing
Pixel emulator/device -> Appium full pass -> reset/release -> Mobile MCP independent full pass -> Chrome/DevTools/Playwright web/PWA diagnostics -> adversarial/recovery regression.

## Phase 45 — Apple-supported paths and real Apple evidence

### iPhone/iPad
PWA/Home Screen first. Use Siri/Shortcuts, notifications/share flows and Remote PC. Do not claim unrestricted Android-style local control.

### macOS
Use trusted Device Agent/menu-bar presence, native scripting/accessibility, direct files, browser control, vision and fresh coordinates. Hey OCADE may run locally after platform permissions.

### Evidence
WebKit compatibility is mandatory but never physical proof.
Seek legitimate real Apple hardware/remote-device evidence. Paid sessions require owner approval. If unavailable, mark REAL APPLE BLOCKED and continue all independent work.

Public macOS deep-control support waits for real Mac runtime proof and signing/notarization requirements.

## Phase 46 — Owner, Backup Owner, Admin and Staff backend

### Identity and visibility
Primary Owner is bootstrapped to a stable server-side user identity. Frontend email checks are forbidden.

Normal customer: no privileged labels, links, route hints or data.
Primary/Backup Owner: Owner Console.
Granted staff: Staff Console with only permitted modules.

Canonical operations surface: `admin.ocade.in`, with secure OCADE SSO.

### Roles
- Primary Owner;
- Backup Owner;
- Admin;
- Support;
- Billing;
- Developer/Operations;
- Read-only;
- granular per-person permission overrides.

Only Primary Owner may promote Backup Owner; require fresh 2FA, explicit confirmation, reason and audit. Backup Owner cannot remove/demote Primary Owner. Admin cannot create/remove/promote Owners.

### Staff workflow
Owner enters an email -> server resolves verified account to stable UUID -> choose role -> choose granular permissions -> Grant Staff -> immediate session/permission propagation -> append audit.

If account does not exist, prepare invite and activate only after verified account creation.

Disabling staff revokes privileged sessions immediately while normal customer account may remain.

### 2FA
Fix TOTP first.
During bootstrap Owner may view console, but sensitive mutations remain locked.
After fix, Owner/Admin/Staff require appropriate 2FA for privileged work.

### Dashboard modules
Overview, Customers, Staff, Usage, Devices, JARVIS Tasks, Security, Support, System Health, Audit. Payment-specific modules stay hidden until payment work resumes.

Every visible button must implement:
backend authority, loading, disabled, success, error, retry/recovery, authorization, audit where needed, regression test and real UI test.

### Customer operations
Search, entitlement/plan, usage adjustments, reset supported windows, complimentary access, revoke sessions, remove devices, disable/recover account, support context and audited actions.

### Conversation privacy
Private by default. Owner may create a reasoned case-specific grant to named Support staff for one conversation/account with expiry and audit. No broad browsing.

### Emergency controls
Global STOP all device/mobile execution while ordinary Chat remains available.
Emergency revoke all staff privileged sessions.

## Phase 47 — Whole-product security, account isolation and UI proof

Use at least:
- Primary Owner;
- Staff account;
- Customer A;
- Customer B.

Prove:
- customer isolation;
- owner/staff permission boundaries;
- account switching;
- conversation/task/device isolation;
- stale session cleanup;
- privileged route concealment;
- mobile isolation;
- device revoke;
- 2FA;
- audit completeness.

Visual correctness is functional correctness. Fail the phase for clipping, overflow, flicker, broken keyboard, confusing control, fake loading, stale progress or inaccessible states.

## Phase 48 — Cleanup and legacy retirement

After all replacement behavior is proven:
- remove obsolete active browser-bridge product code and related active schema/control paths using forward migration only;
- remove Windows floating mini-control from active runtime/packaging because tray is the desktop control surface;
- remove customer-facing donor plugin machinery from active runtime;
- remove duplicate old GUI/provider-key paths;
- remove stale docs/dependencies/temp adapters;
- keep immutable donor/import/audit evidence untouched;
- never rewrite applied migrations; retire with forward migrations;
- run Caveman/Ponytail;
- rerun the entire affected MCP/real-device matrix.

## Phase 49 — Final commercial-release proof

Run from the beginning:
- build/typecheck/lint/format/unit/integration/security gates;
- browser matrix;
- real Windows acceptance suite;
- Android Appium + Mobile MCP;
- Apple compatibility and real hardware where available;
- Owner/Staff/Customer auth matrix;
- real deployment verification;
- production smoke.

Required real-world proof includes:
1. existing-profile browser task;
2. nontrivial Excel/formula/format/save/reopen task;
3. files task;
4. VS Code/repo bug-fix task;
5. multi-app task: browser -> download -> local Office/editor -> save -> OCADE;
6. STOP mid-action;
7. user takeover/Co-work;
8. restart/reconnect;
9. tray lifecycle;
10. device removal during active execution.

Confirm:
- final `main` SHA;
- deployed Cloudflare source SHA;
- Supabase migration head;
- Device Agent version/protocol;
- mobile state;
- no known Critical/Major blocker in shipped scope;
- no unexplained required MCP failure.

Public signing, payment-provider work, Sentry project, paid Supabase leaked-password option and any later store publication remain separately reported owner/deferred dependencies and must not be silently treated as completed.

## Phase reporting format

After every phase:

`Phase X — Complete / Partial / Blocked`

Then report:
- tasks completed;
- exact files/systems changed;
- donor files inspected/reused;
- bugs found/fixed;
- local test results;
- MCP/real-browser/real-device/physical evidence;
- security/adversarial evidence;
- remaining blockers/untested;
- current commercial-launch readiness: XX%;
- commit/push/deploy identity.

The percentage is evidence-based and may go down when new blockers are found.

## Completion rule

Do not stop because one test system is blocked. Continue all independent work.

The mission finishes only when every executable phase is complete, all available required evidence is green, remaining blockers are genuinely owner/hardware/legal/signing/payment/platform dependencies, no known Critical/Major blocker remains in shipped scope, cleanup has been regression-tested, and production identity matches final source.
