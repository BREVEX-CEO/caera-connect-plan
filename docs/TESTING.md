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
