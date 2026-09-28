# OCADE Testing Strategy

## Testing philosophy

OCADE JARVIS must be added without lowering the evidence standard of the existing product.

Every meaningful integration should have a regression before or alongside implementation.

A green test suite is not proof of an unperformed real browser/device flow.

## Existing stack

Use the repository's current Vitest, database-twin/Postgres, browser-journey, build/typecheck/lint/format, secret, identity, storage, and verify:full tooling.

Add only the smallest additional JARVIS-specific test support required by the real integration.

## Preservation tests

- Verify the uploaded ZIP hash/file remains unchanged.
- Verify source-original is not included in autofix/debloat operations.
- Verify production build tooling does not bundle provider secrets or immutable donor files.

## Route/auth tests

- Test /ocade-jarvis signed out.
- Test execution refusal before authentication.
- Test authentication return to /ocade-jarvis.
- Test refresh, deep link, back/forward, and direct route loading.
- Test that Chat remains unaffected.

## Conversation/task tests

- Test ordinary questions remain ordinary answers.
- Test explicit work requests create JARVIS tasks.
- Test plan/current-step/progress/result/Stop/Resume state.
- Test task failure reports blocked state instead of fake success.
- Test Chat/JARVIS history separation.

## GUI tests

- Test dark/light themes.
- Test custom orb accents.
- Test orb growth from real graph data.
- Test pan, zoom, hover, selection, and semantic zoom.
- Test selected-node metadata does not automatically expose private content.
- Test reduced-motion behavior.
- Test 360–375 px, tablet, and desktop widths without overflow.

## Voice tests

- Test microphone permission grant/denial.
- Test typed/voice shared context.
- Test Interrupt, Pause, Continue, and End.
- Test navigation/sign-out while listening/speaking.
- Test wake behavior only where genuinely supported.

## Usage tests

- Test separate Chat and JARVIS allowances.
- Test successful JARVIS internal model/tool accounting.
- Test failed/no-result reconciliation.
- Test concurrency and duplicate execution.
- Test account-wide consistency across browser sessions.

## Browser-control tests

- Test isolated browser control.
- Test authorized real-browser control where available.
- Test multi-tab work.
- Test live panel and Take Over.
- Test Stop during a task.
- Test navigation/dynamic DOM changes.
- Test resize, zoom, responsive breakpoint, scroll-context, and tab-size changes.
- Assert stale coordinates are discarded after geometry changes.
- Test login assistance.
- Test CAPTCHA/passkey/OTP/2FA handoff without bypass.
- Test sensitive-submission confirmation.
- Test final purchase prohibition.
- Test recovery after network/tool failure.

## Permission/security tests

- Test global master disable.
- Test granular capability denial.
- Test per-device permission differences.
- Test prompt-injection attempts to grant permissions.
- Test cross-account, cross-task, and cross-conversation isolation.
- Test untrusted page/tool/file content cannot elevate capability.
- Test secret scanning of browser/runtime bundles.

## Data tests

- Test JARVIS surface discrimination in reused conversation/message storage.
- Test JARVIS memory isolation from Chat memory.
- Test 90-day activity retention.
- Test durable result survival after detailed-log expiry.
- Test raw screenshots are not retained by default.

## Definition of done

A JARVIS phase is done only when targeted tests pass, broader OCADE gates pass, relevant browser journeys pass, and failures/blocked cases are reported truthfully.

The final mission requires build, typecheck, lint, formatting, dependency/security scans, database checks, tests, verify:full, and an adversarial real-browser pass on the exact final tree.

Existing Chat and Offline tests must remain green.

## JARVIS deeper-device verification matrix

The deeper-device mission adds these mandatory evidence classes without weakening the existing web/browser suite:

- REAL WINDOWS
- REAL macOS
- REAL CHROME EXTENSION
- REAL ANDROID WEB/PWA
- REAL iOS WEB/PWA

Verify at minimum:

- same-account automatic enrollment produces unique per-device credentials;
- device revoke kills further claims immediately;
- credential rotation does not cross-bind devices;
- protocol mismatch fails closed and guides update;
- signed update succeeds and failed update rolls back;
- only one tray/menu-bar presence exists;
- close-browser lifecycle matches active-task/background/wake rules;
- one UI-control lease per device;
- physical mouse/keyboard input pauses automation;
- Stop works from web, mini-control and tray;
- multi-monitor target selection;
- file/workspace scope escape attempts;
- Trash vs permanent-delete behavior;
- UAC/admin/CAPTCHA/OTP/passkey handoff;
- extension touches only authorized tabs;
- browser crash/reopen checkpoint recovery;
- network loss/local-step continuation/pause boundary;
- reboot checkpoint recovery;
- concurrent remote-device requests;
- mobile Remote PC start/observe/stop;
- text-only startup and first-use microphone permission;
- local wake detection does not continuously upload microphone audio;
- slot-local Online failover and project-wide quota behavior;
- customer errors contain no provider/model/vendor/key identity;
- existing Chat, Offline Intelligence, JARVIS web/browser, source preservation and Supabase security tests remain green.

A feature is not complete because source exists. Record SOURCE-PROVEN, LOCAL TEST, REAL BROWSER, REAL WINDOWS, REAL macOS, REAL ANDROID WEB/PWA, REAL iOS WEB/PWA, DATABASE TEST, LIVE, BLOCKED and UNTESTED independently.

## Latest autonomous testing authority — 2026-09-28

`docs/TESTING_TOOLCHAIN.md` defines the detailed current test-team roles and must be read before JARVIS/device release work.

- Use Playwright Real Chrome for real browser journeys and Chrome DevTools for browser internals.
- Use Edge, Firefox, desktop WebKit, Android mobile Chromium, and iPhone-like WebKit for cross-browser/web compatibility.
- Use Physical Computer Use or approved Claude Computer control for real Windows installer, tray, Settings, native app, mouse/keyboard, update, uninstall, and physical-result verification.
- Use Appium as primary Android structured automation and Mobile MCP as an independent second pass. Do not let both drive the same screen simultaneously.
- Use BlueStacks or another zero-cost Android environment for Android OS testing when physical Android hardware is unavailable.
- Treat WebKit as Apple-browser compatibility, not native Apple hardware proof.
- Use GitHub, Supabase, Cloudflare, and Sentry-connected tooling to verify source, backend, deployment, and incident state.
- Remove paid/trial-only BrowserStack from the required zero-cost path.
- Test JARVIS security/authority first, then Windows/extension, Android/mobile, Apple web compatibility, then the entire OCADE website.
- Continue independent tests when one subsystem fails and report blocked cases instead of stopping the audit.
- After every cleanup/debloat pass, rerun targeted tests because removal can break previously working paths.
- Final release requires no known Critical or Major release blocker for shipped capabilities plus successful broader regression and deployed-source verification.
