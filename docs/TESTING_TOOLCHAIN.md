# OCADE Autonomous Testing Toolchain

## Principle

Testing must prove the real product, not merely source intent.

MCPs and automation tools are development/test instruments. OCADE ships its own Device Agent/mobile runtime.

One active controller owns one surface at a time. Other tools observe or verify sequentially. Never let Playwright and desktop automation fight the same browser or Appium and Mobile MCP drive the same device simultaneously.

## Required tools and roles

### Existing Chrome Playwright/CDP

Primary authenticated-browser actor where available.

Preferred command for a running Chrome with remote debugging enabled:

`cmd /c npx -y @playwright/mcp@latest --cdp-endpoint=chrome --console-level warning`

Use this to exercise the user's actual browser/profile/session state without requiring an OCADE browser add-on.

### Chrome DevTools MCP

Diagnostic/observer authority for existing Chrome:

`cmd /c npx -y chrome-devtools-mcp@latest --autoConnect`

Inspect:

- console;
- network;
- cookies/storage;
- service workers;
- performance;
- memory/runtime warnings;
- failed resources;
- navigation/auth state.

A visually successful journey does not override DevTools errors.

### Clean Chrome

Run an isolated clean Chrome pass for first-time-user/fresh-state regression.

### Edge, Firefox, WebKit

Independent browser compatibility passes.

WebKit iPhone/iPad/desktop evidence is compatibility evidence only, not physical Apple evidence.

### Playwright Android mobile

Web/PWA responsive/mobile Chromium evidence.

### Appium

Primary structured Android device/emulator actor.

### Mobile MCP

Independent second Android verifier after Appium releases control and state is reset/known.

May be used to list legitimate remote physical iOS devices. Do not start billed reservations without owner approval.

### Physical Computer Use

Real Windows/native UI authority:

- Device Agent install/uninstall;
- tray;
- Settings;
- apps;
- File Explorer;
- Excel/Office;
- VS Code;
- Task Manager;
- mouse/keyboard;
- screenshots;
- actual result verification.

### Filesystem

Verify output files, workspace boundaries, generated artifacts, cleanup and no out-of-scope writes.

### Supabase

Verify Auth, MFA, RLS, owner/staff/customer roles, account/device/task ownership, revocation, usage and database state.

### Cloudflare

Verify deployed Worker/site revision, routes, headers/runtime configuration and production/source identity.

### GitHub

Source-control authority for exact base/main SHA, branch, changed files, commits, merge and final source identity.

Sentry is currently deferred/non-blocking until a real project exists.

## Per-function fix loop

For each meaningful capability/button/function:

1. implement or repair;
2. targeted local test;
3. integration test;
4. applicable MCP/real UI;
5. inspect actual result;
6. reproduce any defect;
7. root-cause fix;
8. rerun exact failed test;
9. adversarial break attempt;
10. broader regression.

Do not call a feature complete because the MCP server started.

## Real browser matrix

Test at minimum:

- signed out;
- signed in;
- fresh user;
- returning user;
- account switch;
- Customer A/B isolation;
- Owner/Staff visibility where relevant;
- multiple tabs/windows;
- existing tab;
- existing authenticated state;
- navigation;
- back/forward/reload;
- downloads/uploads;
- browser restart;
- Take Over/Continue;
- STOP mid-action;
- permission/human-auth boundaries;
- zoom/resize/scroll/popup/content mutation;
- console/network errors;
- PWA/service worker/cache/update behavior;
- offline-model persistence across deployment/source changes.

## Real Windows matrix

Required real tasks:

1. existing-profile browser task;
2. Excel workbook task with formulas, fill/format, save/reopen verification;
3. files/File Explorer task;
4. VS Code/repository bug-fix task;
5. multi-app browser -> file -> Office/editor -> save -> OCADE task;
6. STOP during active typing/click/process;
7. physical user takeover;
8. Co-work handoff;
9. app discovery;
10. multi-monitor/DPI where available;
11. agent restart/reconnect;
12. tray lifecycle;
13. update/rollback;
14. Exit/uninstall/reinstall;
15. device removal while active.

Verify the actual physical/file/process state independently.

## Android matrix

- install/onboarding;
- sign-in/account isolation;
- permission guidance;
- overlay/floating bubble;
- accessibility/app control where implemented;
- intents/native actions;
- orientation;
- keyboard/composer;
- background/foreground;
- notification/share/file/media paths;
- Remote PC;
- voice/wake where supported;
- STOP;
- uninstall/reinstall;
- restart/recovery;
- ordinary history clearing vs explicit data clearing behavior.

Run Appium first, then reset/release and run Mobile MCP independently.

Use Chrome DevTools/Playwright for web/PWA diagnostics.

## Apple matrix

WebKit compatibility is mandatory.

Real iPhone/iPad/macOS evidence must be labeled separately.

If real hardware/cloud environment is unavailable, record REAL APPLE BLOCKED and continue all independent work. Never convert emulation into physical proof.

## Owner/Admin/Staff matrix

Use at least:

- Primary Owner;
- Staff;
- Customer A;
- Customer B.

Test:

- customer sees no privileged UI/data;
- Owner Console visibility;
- Staff Console permission filtering;
- direct privileged URL attempts;
- 2FA enrollment/challenge;
- staff grant/revoke;
- immediate privilege removal;
- Backup Owner protections;
- conversation case grant/expiry;
- emergency revoke;
- global JARVIS execution stop;
- audit.

## Security/adversarial matrix

Deliberately test:

- prompt injection;
- stale observation;
- stale auth;
- network drop;
- backend control-read outage;
- task replay/duplicate action;
- repeated clicks;
- account switch;
- permission revoke;
- device revoke;
- device removal mid-action;
- late results;
- path traversal/symlink/junction escape;
- private-network navigation;
- confirmation bypass;
- malicious page/file/tool output;
- crash/restart;
- interrupted update.

## Performance matrix

Measure relevant:

- web bundle/startup;
- Device Agent startup;
- idle CPU/RAM/network;
- browser task latency;
- UI responsiveness;
- long-task memory;
- Android battery/background behavior where testable;
- wake detector idle cost;
- repeated deployment/update model persistence.

## Visual quality

Visual defects are bugs.

Check:

- dark/light;
- 360/375 phone;
- tablet;
- desktop;
- keyboard;
- reduced motion;
- loading/skeleton;
- empty/error/permission/limit states;
- no horizontal overflow;
- mobile keyboard behavior;
- stable layout;
- no fake progress;
- tray/bubble usability.

## Evidence labels

Use exactly:
SOURCE, LOCAL TEST, MCP BROWSER, REAL BROWSER, REAL WINDOWS, REAL ANDROID, WEBKIT COMPATIBILITY, REAL APPLE, DATABASE TEST, LIVE, BLOCKED, UNTESTED.

## Phase report

After every phase report:

- status;
- tasks;
- bugs found/fixed;
- exact tests;
- MCP/real evidence;
- blocked/untested;
- commercial-launch readiness XX%;
- source/deploy identity.

No known Critical/Major blocker may remain for a shipped capability before release.

## Master Phase 1–49 authority

Implementation order, phase gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting follow the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves working behavior, repairs evidence-backed gaps, and continues through Phase 49.
