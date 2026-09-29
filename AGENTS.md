# OCADE Agent Handbook

## Project identity

CARCC is the company. OCADE is the product. Retired CADANE branding must not return.

OCADE has two protected product experiences:
- Chat: conversational product with Auto, Online, and Offline Intelligence.
- OCADE JARVIS: separate Online-only conversational execution product at `/ocade-jarvis`.

JARVIS must never silently fall back to Chat Offline Intelligence. If all approved Online intelligence capacity is unavailable, JARVIS Chat is locked into a truthful temporary-unavailable state while durable task checkpoints are preserved.

## Authority order

1. The owner's latest explicit request.
2. `PLAN.md`.
3. `CLAUDE.md` and this handbook.
4. `docs/COMPANY_PRODUCT_AUTHORITY.md`.
5. `docs/JARVIS_DEVICE_ROADMAP.md`, `docs/MOBILE_DEVICE_CONTROL.md`, `docs/OWNER_ADMIN_BACKEND.md`, `docs/TESTING_TOOLCHAIN.md`, and `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
6. PRD/TRD/ARCHITECTURE/APP_FLOW/DESIGN/Backend Schema/RULES/TESTING.
7. Historical audits and ledgers as evidence only.

New owner-approved authority supersedes older conflicting direction. Never silently revive an older requirement.

## Mandatory donor rule

The immutable JARVIS source under `imports/ocade-jarvis/source-original/` and the preserved ZIP remain untouched forever.

Before implementing a JARVIS capability, inspect the matching donor implementation first. The donor is the primary logic source for browser control, computer control, app launch, files, documents, developer work, screen processing, voice, wake, confirmations, undo, reminders, monitoring, messaging, system control, and remote-control concepts.

Target approximately 98% donor capability/logic reuse where safe. Reuse means copy or adapt proven logic into the active runtime, rename where necessary, wire it through OCADE authorities, harden it, and test it. It does not mean blindly copying obsolete GUI, provider-key entry, unsafe permissions, duplicate authorities, or customer-facing plugin machinery.

Production must never import from or mutate the immutable donor snapshot. Copy/adapt required logic into `jarvis-runtime/` or the correct active runtime location. Python runtime code must not be dumped into React `src/`.

The deliberate donor replacements are:
- old desktop GUI -> OCADE web/JARVIS UI plus tray/mobile bubble;
- donor provider-key handling -> OCADE server-side hidden intelligence authority;
- donor generic customer plugin system -> not used;
- old phone dashboard GUI -> OCADE account/device architecture while preserving useful remote-control concepts.

## Execution architecture

JARVIS work must flow through one validated action authority:
OCADE UI -> Online intelligence/planner -> action broker -> device/browser/file/app/system executor -> observed result -> task settlement.

Every action binds the current account, conversation/task, target device, capability, permission, confirmation state, request/idempotency identity, current control lease, and cancellation token.

Preferred execution order:
1. direct file/API/application automation;
2. native OS/app launch or scripting;
3. structured browser/DOM/CDP/accessibility control;
4. OS accessibility/UI Automation;
5. local screen/vision understanding;
6. PyAutoGUI/fresh coordinates last.

Existing user browser/profile is preferred for user-requested browser work. Do not require an OCADE browser add-on. Use securely available CDP/DevTools/Playwright attachment, OS accessibility, vision, and PyAutoGUI fallback. Never extract saved browser passwords/cookie databases.

## Real PC rules

Windows and later macOS use a small trusted OCADE Device Agent. Windows normal presence is one tray identity only; there is no required floating desktop mini-control. The tray exposes status, Open OCADE, STOP JARVIS, Pause/Resume where applicable, and Exit.

The agent autostarts as a lightweight dormant supervisor after user setup. Idle resource use must remain very low.

Physical user input pauses normal UI automation unless explicit Co-work is active. In Co-work, only one actor owns input at an instant.

STOP must synchronously cancel current input automation, browser work, task-owned processes, cancellable file work, and queued device work. It must not wait only for the next cloud poll.

Coordinate actions require a fresh observation identity. Resize, popup, scroll, focus change, window move, monitor change, DPI change, navigation, tab change, or content mutation invalidates stale coordinates.

UAC/admin-password, CAPTCHA, OTP, passkey, and equivalent human-authentication boundaries are not bypassed.

## Browser rules

Use the user's existing browser/profile when appropriate. If Chrome is closed and Chrome is the intended browser, open the normal profile. Detect other installed/default browsers when the user uses them.

Browser priority:
existing browser -> semantic/DOM/CDP/accessibility -> vision -> PyAutoGUI coordinates.

Take Over pauses automation and re-observes before Continue. Browser password-manager autofill may be triggered normally, but JARVIS never extracts saved passwords.

Final purchase/payment completion is prohibited. Sensitive public submissions, security changes, destructive actions, and similar high-impact actions require confirmation.

## Files, Office, coding and apps

Direct filesystem/document operations are preferred to visual clicking when safer. User-granted workspace/folder scope is the default; broader scope can be granted explicitly for a task.

Delete defaults to Trash/Recycle Bin. Permanent deletion requires stronger confirmation.

Excel tasks should inspect workbook structure, use formulas/fill/tables/Power Query or direct spreadsheet operations intelligently, preserve unrelated formatting/formulas/macros, and verify important results in real Excel when available. Avoid manual repetitive cell entry when a formula or structured operation is better.

Coding tasks prefer filesystem + terminal/Git + tests, using VS Code UI when useful, then verify the real result.

JARVIS should discover installed applications and use native launch/registration, OS launch/search, accessibility, vision and PyAutoGUI as needed without constantly popping terminals on screen.

## Voice and wake

JARVIS remains conversational while working. The user can talk naturally during a task and ask what JARVIS is doing; JARVIS should answer from truthful current task state without abandoning the work.

Hey OCADE is the preferred wake phrase. When enabled, download and verify the small local wake model once, retain it locally, and process pre-wake audio locally. Online voice starts only after wake detection. Locked-screen work must not bypass OS security.

## Mobile and Apple

Android uses OCADE's guided installed mobile experience from `ocade.in`, with one OCADE identity, floating bubble, voice, task status, STOP, supported app control, and Android-owned permission prompts. Use intents/native APIs -> accessibility -> vision -> fresh coordinates.

iPhone/iPad remain PWA/Home Screen first with Siri/Shortcuts, notifications/share flows and Remote PC. Do not fake Android-style unrestricted local control.

Real Apple evidence must come from legitimate Apple hardware or a real-device environment. WebKit compatibility is not physical proof. Paid real-device sessions require owner approval.

## Owner/staff authority

The primary Owner account is mapped server-side to a stable user identity. Do not hardcode owner email checks in frontend authorization.

Roles: Primary Owner, Backup Owner, Admin, Support, Billing, Developer/Operations, Read-only, plus granular permission overrides.

Normal customers see no privileged wording, links, route hints, or data. Owner sees Owner Console; granted staff sees Staff Console. Authorization is always server-side/RLS enforced.

Privileged mutations require appropriate role, fresh 2FA where required, reason, and append-only audit. Conversation content access is exceptional and scoped.

## Testing doctrine

MCP use is mandatory where applicable. A server starting is not test evidence.

After every meaningful capability/function/button group:
implement -> local targeted tests -> applicable MCP -> real visible workflow -> diagnose -> root-cause fix -> exact retest -> adversarial break attempt -> broader regression.

Use Playwright/CDP against the user's existing Chrome where available, Chrome DevTools diagnostics, clean browser passes, Edge, Firefox, WebKit, Android mobile, Appium, Mobile MCP, Physical Computer Use, Filesystem, Supabase, Cloudflare and GitHub as appropriate.

Every phase must report:
- Complete / Partial / Blocked;
- exact work completed;
- bugs found and fixed;
- tests and MCP evidence;
- blocked/untested evidence;
- current commercial-launch readiness percentage;
- commit/push/deploy identity.

Never claim mathematical zero bugs. Completion means no known/reproducible Critical or Major blocker in shipped scope and no unexplained required-test failure.

## Cleanup

Run /caveman ultra and /ponytail ultra at session start and again after functionality is proven. Destructive cleanup happens only after replacement proof and ToRemove.md review.

Preserve immutable donor/import/audit evidence. Remove duplicate active systems, obsolete browser-bridge code, stale GUI paths, customer plugin machinery, dead dependencies and obsolete docs only after their replacements are proven and regression-tested.
