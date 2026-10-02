# Final testing-only matrix (owner addendum 2026-10-02)

Product source is frozen while this matrix runs. Every failure is recorded here first; fixes happen
only in the fix wave that follows, each with a regression, and the affected rows are run again.

Status: `PASS`, `FAIL (#n)`, `BLOCKED (why)`, `PENDING`. Failures are listed below the table.

| #   | Area                                     | How it is tested                                                                                    | Status                       |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | Unit, database, runtime suites           | `vitest run`, `pytest jarvis-runtime/tests`, typecheck, lint, format, audits                        | PASS (F3 test fixed)         |
| 2   | Browser journeys (all)                   | `node scripts/e2e/harness.mjs` (production build, stand-in Supabase, real Device Agent runtime)     | FAIL (F4): 20/21             |
| 3   | Preview identity                         | Cloudflare version and alias, Supabase project, health, no production change                        | PASS                         |
| 4   | Real Chrome: sign-in and Chat            | the owner's Chrome profile on the preview, Google sign-in, real answers, DevTools console/network   | PASS (F1 minor)              |
| 5   | JARVIS conversation while working        | real model: question, task, status question mid-task, redirect, Pause/Resume, STOP                  | FAIL (F2), task part PENDING |
| 6   | Windows Device Agent lifecycle           | build installer, install, one tray, autostart, enrollment, update, rollback, uninstall, reinstall   | PENDING                      |
| 7   | Existing-browser control                 | the person's Chrome: permission page hand-over, signed-in site task, tabs, upload/download, STOP    | PENDING                      |
| 8   | Files and discovery                      | locate, import (copy), export completed copy, drives, undo, scope refusals                          | PENDING                      |
| 9   | Excel / Word / PDF                       | workbook solve to a completed copy, formulas verified on reopen; document edit; PDF read            | PENDING                      |
| 10  | Coding                                   | real repo bug: run tests, edit, rerun, git diff — routine commands unasked, risky ones asked        | PENDING                      |
| 11  | Multi-app workflow                       | data from one app into another, verified                                                            | PENDING                      |
| 12  | Unknown app, no adapter                  | an installed app chosen at test time, driven only through app_info/ui/vision                        | PENDING                      |
| 13  | Dynamically discovered API or script     | an app whose official automation (COM/CLI/scripting folder) is found by app_info and used           | PENDING                      |
| 14  | Accessibility/vision/coordinate fallback | an app with no structured route: screen + fresh coordinates, gates checked                          | PENDING                      |
| 15  | Background and Remote PC                 | task continues with the browser closed; phone or second surface controls the PC task                | PENDING                      |
| 16  | Owner Console                            | every module, give back usage, suspend/restore, staff grant/revoke lifecycle, entitlement lifecycle | PENDING                      |
| 17  | Android (Appium, then Mobile MCP)        | Pixel 6a API 34: permissions, bubble, Wake Mode, phone task, "on my PC" routing, STOP, reinstall    | PENDING                      |
| 18  | Wake on Windows                          | bundled signed model, tray line, both phrases spoken by local voices through the speaker loop       | PENDING                      |
| 19  | Security attacks                         | private network, path/junction escape, prompt injection from a page, replay, stale, account switch  | PENDING                      |
| 20  | Responsive, accessibility, PWA           | phone/tablet widths, keyboard, service worker, offline                                              | PENDING                      |
| 21  | Apple                                    | WebKit compatibility only; physical Apple hardware BLOCKED (none available)                         | PENDING                      |

## Failures

- **F1 (Minor)** — row 4. The Offline engine is prepared and warmed in a browser whose offline allowance was refused (device limit): a model download and CPU spent on a browser that cannot answer offline. Evidence: preview tab console shows the engine loading after the first keystroke while `register_browser_device_for_current_user` answers 400 (device cap).
- **F3 (test only)** — row 1. `offline-turns-reach-the-account` waited a fixed 20 ms for an encrypted IndexedDB write; under load (training running) the simulated restart read an empty journal. Product writes are queued correctly; the test now waits for the record itself. Full suite then 1194 passed under the same load. Runtime 146 passed, 4 skipped; npm audit and pip-audit clean.
- **F4 (Minor)** — row 2. The admin journey saw React error #418 (server and client HTML differ during hydration) on `admin.localhost/auth/challenge?next=/admin`, after the second-factor step on the console origin. Seen once before (2026-10-01) without a URL; now located. The other 20 journeys passed. To reproduce with a development build in the fix wave.
- **F2 (Major)** — row 5. JARVIS does not know the person's devices: asked "which of my devices are connected right now?" it answered that it has no list and is "operating directly on this computer" (untrue: it runs in OCADE, and the account has DESKTOP-7CF9G0F and an audit device, both offline). The planner is not given device state, so status answers about devices are invented.

Evidence notes: preview Worker version `28da3ac2` (branch `e3f2f509`) at the `final-check` alias; production still `5d72f73d` (deployment `3152b6cc`). Real Chrome reached through Chrome's own remote-debugging permission (allowed for the owner's test session); the DevTools and Playwright MCP connectors stayed unresponsive after approval, so the same connection was driven with Playwright over CDP.
