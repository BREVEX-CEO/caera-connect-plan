# OCADE JARVIS — Active Runtime

This directory is the active local execution engine.

The immutable owner-supplied donor remains under `imports/ocade-jarvis/source-original/` and is never modified.

## Donor reuse

The current owner direction is to reuse approximately 98% of useful donor capability/logic where safe.

For each capability:
1. inspect the matching donor file;
2. copy/adapt useful logic into this runtime;
3. rename/wire it into OCADE authorities;
4. remove obsolete GUI/provider-key/customer-plugin behavior;
5. harden scope/cancellation/security;
6. add tests;
7. prove real behavior.

Production must not import from immutable donor files.

## Intelligence

This runtime holds no provider API key and does not make provider/model decisions.

JARVIS intelligence is server-side Online-only OCADE authority.

If Online intelligence is unavailable, JARVIS locks into a customer-safe unavailable state. It never silently uses Chat Offline Intelligence.

## Execution model

One action broker validates account/device/task/permission/confirmation/lease/idempotency/cancellation state before dispatch.

Preferred execution order:
- direct/native APIs and file/document operations;
- app scripting/CLI/macros;
- browser DOM/CDP/accessibility;
- OS accessibility/UI Automation;
- vision;
- PyAutoGUI fresh coordinates.

## Browser

No customer browser add-on is required.

Prefer the user's existing authorized Chrome/browser profile where appropriate.

Use secure CDP/Playwright/DevTools-capable paths, then accessibility/vision/PyAutoGUI fallbacks.

Never extract browser password/cookie stores.

## Windows

The Device Agent is a lightweight tray-based runtime.

No required floating desktop mini-control is part of the final Windows product.

STOP must cancel active local owned work immediately.

Physical user input pauses normal automation unless Co-work is active.

## Files/Office/development

Use direct scoped file/document operations where safer than GUI clicking.

Excel is a first-class target: workbook inspection, formulas, smart fill, formatting, preservation, save/reopen and real verification.

Coding uses filesystem/terminal/Git/tests first and VS Code UI when useful.

Avoid unnecessary visible terminal windows.

## Voice/wake

JARVIS may converse while working.

Hey OCADE uses a small local wake model downloaded/verified once when enabled. Pre-wake audio stays local.

## Android/Apple

Android deep mobile runtime is an OCADE-owned installed experience with legitimate Android permissions and floating bubble.

iPhone/iPad remain PWA/Home Screen + Apple-supported integrations + Remote PC.

## Safety

- human auth boundaries remain human;
- final purchase/payment prohibited;
- scoped files;
- Trash default;
- stale coordinates refused;
- device removal cancels active work;
- unreadable server safety-control state fails closed;
- late cancelled results cannot resurrect execution.

## Testing

Follow `docs/TESTING_TOOLCHAIN.md` and `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.

Real Windows acceptance must prove browser, Excel, files, VS Code, multi-app work, STOP, takeover, tray lifecycle and active device revoke.

Every phase reports commercial-launch readiness percentage.
