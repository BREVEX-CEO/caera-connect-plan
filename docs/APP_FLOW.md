# OCADE App Flow

## Customer navigation

Keep the normal product small:

- Chat;
- JARVIS;
- Library;
- Account/Settings;
- Help/Support.

No separate Code or Projects product is required.

## JARVIS normal question

1. User asks a normal question.
2. JARVIS answers conversationally using approved Online intelligence.
3. No artificial task is created unless execution is requested.

If Online intelligence is unavailable, JARVIS shows a bounded unavailable/locked state and does not fall back to Chat Offline.

## JARVIS work request

1. User requests work.
2. JARVIS identifies target device/browser/workspace.
3. JARVIS forms a concise plan.
4. Action broker validates permission/scope.
5. Work begins automatically when safe.
6. JARVIS observes each meaningful result.
7. User may talk/type during execution.
8. Stop/Take Over/Continue remain available.
9. Completion is reported only after verification.

## Existing-browser flow

1. Select user's existing appropriate browser/profile.
2. Use secure CDP/DevTools/Playwright path where available.
3. Fall back to browser/OS accessibility, vision, then fresh PyAutoGUI.
4. Re-observe after state changes.
5. Human handles CAPTCHA/OTP/passkey/security verification.
6. Password-manager autofill may be used without extracting secrets.
7. Stop before final purchase/payment.

## Windows setup

1. User requests deep PC control.
2. OCADE offers Set up this PC.
3. Trusted Device Agent installer runs.
4. Same account pairs device.
5. Unique device identity is created.
6. Necessary permissions are explained/requested.
7. One tray presence remains.
8. Device becomes Ready.

## Windows task

1. Prefer native/direct method.
2. Use existing app window where appropriate.
3. Verify focus.
4. Execute.
5. Physical user input pauses normal automation.
6. Continue re-observes.
7. STOP cancels local work immediately.
8. Verify actual result.

## Excel flow

1. Inspect workbook programmatically.
2. Determine formula/structured solution.
3. Preserve existing workbook behavior.
4. Apply efficient edits.
5. Use Excel UI where needed.
6. Verify calculations/formatting.
7. Save/reopen major tasks.
8. Report exact changes.

## Voice during work

User may ask “what are you doing?” or redirect while task runs. JARVIS answers truthfully from current task state and continues unless instructed otherwise.

## Wake

First enable:

1. explain local wake;
2. use the bundled, signed OCADE wake model (no download);
3. store once;
4. keep across updates/restarts;
5. pre-wake audio remains local.

## Android install

1. User opens OCADE on Android.
2. Chooses Install OCADE.
3. Website guides required installation/permissions.
4. One OCADE identity is installed.
5. User can enable floating bubble and relevant Android permissions.
6. Bubble offers chat, voice, status, STOP and full JARVIS.
7. Remote PC and supported local actions become available.

## iPhone/iPad

1. Add OCADE to Home Screen.
2. Use JARVIS web/PWA.
3. Optional Siri/Shortcut/notification/share integration.
4. Use Remote PC for deep computer work.
5. Unsupported Android-style local overlay/control is not claimed.

## Owner Console

1. Primary Owner signs into normal OCADE.
2. The sidebar shows Owner Console beneath Chat, OCADE JARVIS and Library (staff see Staff Console; customers see nothing).
3. It opens `/admin` inside `ocade.in` (the separate `admin.ocade.in` origin was retired on 2026-10-03).
4. During 2FA bootstrap, view access may work while sensitive mutations remain locked.
5. After strong auth, Owner manages permitted operations.

## Staff grant

1. Owner enters email.
2. Server resolves stable verified user identity.
3. Owner selects role/permissions.
4. Review + fresh auth where required.
5. Grant is audited.
6. Staff's active authorization updates immediately.
7. Staff sees Staff Console only when granted.

## Customer privileged-route attempt

Return to normal customer product without exposing privileged internals.

## Device removal

If device is active:

1. local cancellation;
2. active task-owned input/process stops;
3. task/activity cancelled;
4. credential revoked;
5. late results rejected.

## Recovery

Long tasks checkpoint. Crash/reboot/network recovery reconciles completed steps before continuing. Destructive work is never blindly replayed.

## Remove/uninstall

Explicit removal stops runtime authority, removes local credentials/cache according to product setting, disconnects the device and leaves cloud conversations unless separately deleted.


## Current simplified product flow — 2026-10-06

The customer should express the desired outcome rather than choose an execution technology. OCADE resolves the account, target device and task context, selects the fastest legitimate machine-native or semantic route, executes deterministic work locally, verifies the real result, and returns to Online intelligence only when recovery or a genuine decision is required.

Routine Android setup begins with one **Set up OCADE** action. OCADE performs every step it can automatically and opens only the Android-owned permission screen that genuinely requires the person. After setup the ordinary customer should see readiness, Wake, STOP, Remove device and the floating bubble rather than a collection of technical setup switches.

For familiar applications, cached sanitized capability knowledge can route work immediately. For unfamiliar applications, OCADE discovers the installed application and version, inspects available APIs, scripting, structured interfaces and semantic controls, consults current official documentation when necessary, creates one bounded detailed plan, executes the deterministic segment locally and verifies the requested outcome.

No normal flow should require the customer to choose API, scripting, browser automation, accessibility, vision or mouse control. Vision and fresh coordinates remain an emergency fallback only when a faster trustworthy semantic route does not exist.

## Current execution authority — 2026-10-06

This document remains the domain authority for customer and task flow, while `PLAN.md` is the single current execution roadmap. Older phase-range wording in this file is historical context only and must not be used to limit or restart the current mission. Newer Owner decisions in `PLAN.md` supersede older conflicting implementation detail. Implementation must preserve proven behavior, fix reproduced defects, simplify aggressively, and remove as much obsolete or duplicate active code as safely possible without weakening security, permissions, STOP, recovery, accessibility, fidelity, verification, or real platform support.
