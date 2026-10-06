# OCADE Testing Requirements

## Standard

Tests must demonstrate real behavior, failure handling and recovery.

Unit tests are necessary but insufficient for browser/device/UI capabilities.

## Per-change gate

For each meaningful change:

1. targeted unit/regression;
2. nearby integration;
3. applicable MCP/real UI;
4. inspect actual result;
5. adversarial attempt;
6. broader regression.

## Browser

Use:

- existing Chrome by CDP where available;
- Chrome DevTools;
- clean Chrome;
- Edge;
- Firefox;
- WebKit;
- Android-class Chromium.

Test existing session state, tabs, navigation, downloads/uploads, auth boundaries, takeover, stop, account switch, cache/service worker, responsive UI and diagnostics.

## Windows

Real tasks must include:

- Device Agent/tray;
- existing Chrome;
- Excel formulas/format/save/reopen;
- files;
- VS Code/repo bug repair;
- multi-app workflow;
- STOP mid-action;
- physical takeover;
- Co-work;
- restart/reconnect;
- update/rollback;
- uninstall/reinstall;
- active device revoke.

## Android

Appium first, Mobile MCP second independently.

Test bubble, permissions, local/remote tasks, orientation, background, restart, account isolation, stop and uninstall/reinstall.

## Apple

WebKit compatibility is separate from real Apple hardware proof.

## Auth/admin

Primary Owner, Staff, Customer A/B.

Test role/permission visibility and server enforcement, 2FA, staff grant/revoke, direct URL attacks, conversation grants, audit and emergency controls.

## Storage

Prove Offline Chat model survives normal deployment/source changes without redownload.

Test interrupted download, resume, integrity repair, explicit Remove and browser/platform data-clear behavior.

## Safety

Test:

- prompt injection;
- stale state;
- account switch;
- permission revoke;
- backend control outage;
- active device removal;
- late result;
- path escape;
- private network;
- duplicate action;
- crash/reboot;
- user takeover.

## Visual

Test desktop/tablet/360/375 widths, dark/light, reduced motion, keyboard, loading/error/empty/permission/limit states and no overflow.

## Release

No known Critical/Major blocker in shipped scope.
No unexplained required-tool failure.
Production SHA matches final source.

Report commercial-launch readiness percentage after every phase.


## Current acceptance doctrine — 2026-10-06

Testing must prove both correctness and simplification. After every major cleanup wave, rerun the same real workflows used before cleanup so deleted code cannot silently reduce capability.

Universal-control testing must include a familiar application, an unfamiliar installed application with no new app-specific source added during the test, a dynamically discovered API or scripting route, and a structured-control-insufficient case that requires the last-resort live fallback. Professional workflows should verify the actual project or output semantics rather than merely checking that a file exists.

Performance evidence must separate routing latency, local dispatch latency, device acknowledgement, model planning, application execution and verification. Record p50, p95 and p99 where meaningful. Do not claim millisecond completion for intrinsic work such as rendering, export, compilation, model inference or network transfer.

Android testing must cover one-button setup, permission return paths, bubble mini chat/voice/task state/STOP, signed update behavior, compatible-device messaging and recovery from missing permissions. Apple testing without physical hardware may use WebKit, PWA, responsive, safe-area, orientation, focus, text zoom, reduced-motion, deep-link/share/Shortcut and Remote-PC contract evidence, but must remain labeled compatibility evidence until a legitimate Apple device is tested.

UI testing must verify the simplified navigation, rounded responsive surfaces, loading/error/blocked/empty distinctions, keyboard/focus behavior, touch targets, reduced motion and the absence of customer-facing implementation-tool selection.

## Current execution authority — 2026-10-06

This document governs product verification and release acceptance, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail.
