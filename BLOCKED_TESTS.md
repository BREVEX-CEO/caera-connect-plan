# Blocked, failed and untested checks

Every check that has not passed lives here, in every testing environment: the owner's PC (held until the owner approves PC testing again), native Windows/macOS/Android/iOS, real providers, the release path and the cloud session's own limits. [PLAN.md](PLAN.md) is the roadmap only; its phase records point here. A phase with any open entry is **PARTIAL**, and every PARTIAL phase is revisited before a production release.

Status words: **BLOCKED** (cannot run in any available environment), **FAIL** (ran and failed; a fix is owed), **UNTESTED** (could run but has not yet), **OPEN** (implementation owed before the test can pass).

Environment of every cloud result named here unless stated: the Anthropic-managed cloud session (Linux x86_64 gVisor VM, Node 22.22, Python 3.13, Chromium 1194 + Xvfb, outbound only through the session proxy, no DNS).

Common safety rules for every PC entry:

- Run only with the owner present and approving that session.
- Use a separate Windows user account, or at least a desktop where Notepad, Word and Excel are closed.
- Use disposable test folders only; never a personal file, account or open document.
- Before the run, list the open windows. Stop at once if any app the test uses is already open.

## Summary

| ID         | Phase        | Check                                                   | Status   | Needs                                                 |
| ---------- | ------------ | ------------------------------------------------------- | -------- | ----------------------------------------------------- |
| REL-00-01  | 00 / release | Production rollback rehearsal                           | BLOCKED  | Cloudflare credentials (GitHub environment or owner)  |
| REL-00-02  | 00 / release | Production deploys only through the approved gate       | FAIL     | Owner: Cloudflare Git auto-deploy setting             |
| CI-00-01   | all          | GitHub Actions cloud workflows                          | BLOCKED  | Actions allowance (renews 1 Nov 2026) or owner choice |
| PC-02-01   | 02           | Windows 11 tabbed Notepad target identity               | BLOCKED  | Owner-approved Windows 11 client                      |
| WIN-02-01  | 02           | UIA barrier interleavings on real apps; 5 s lease timed | BLOCKED  | Isolated Windows VM                                   |
| AND-02-01  | 02           | Interrupted gesture on a device/emulator                | BLOCKED  | Android emulator                                      |
| NET-03-01  | 03           | Packet-loss / reordered / malformed ACK simulator       | UNTESTED | Cloud session (can run)                               |
| AND-03-01  | 03           | Android process death at each journal transition        | BLOCKED  | Android emulator                                      |
| GEM-04-01  | 04           | Three-key failover with real keys                       | BLOCKED  | Two more staging keys                                 |
| GEM-04-02  | 04           | Background Mode step planned by the real model          | UNTESTED | Cloud session + staging key (can run)                 |
| GEM-04-03  | 04           | Durable thought signatures for Background Mode          | OPEN     | Migration + owner deployment gate                     |
| LIVE-04-01 | 04 / 17      | Live video task: captions read on the page              | FAIL     | Fix in media capability                               |
| LIVE-04-02 | 04 / 11 / 17 | Live photo task in a canvas editor (miniPaint)          | FAIL     | Fix in canvas/vision route                            |
| VER-01-01  | 01           | A claim about an effect no check covers is refused      | OPEN     | Verifier contract                                     |
| PERF-05-01 | 05           | Identical 30-step old/new timing; Windows batch timing  | BLOCKED  | Isolated Windows VM                                   |
| AND-05-01  | 05           | Android multi-step segments                             | OPEN     | Android implementation + emulator                     |
| BRW-00-01  | 16           | Firefox and WebKit legs of the browsers journey         | BLOCKED  | Browser downloads (egress refused here)               |
| BRW-00-02  | 16           | Real push service                                       | BLOCKED  | Browser build with a push service                     |
| VOI-13-01  | 13           | Real speech-recognition service                         | BLOCKED  | Reachable speech service                              |
| PC-07-01   | 07           | Licensed Excel and Word automation                      | BLOCKED  | Owner-approved Windows PC with Office                 |

---

## REL-00-01 — Production rollback rehearsal

- **Test:** `npm run deploy:rollback` with `OCADE_ROLLBACK_VERSION_ID` = the version before `37503f09-3c6d-450b-8a3c-c910093faf51`, then `/api/health` reports the old commit, then roll forward.
- **Reason:** the Cloudflare API token lives only in the GitHub `cloudflare-production` environment; this session has none, and GitHub Actions refuses jobs (CI-00-01).
- **Error:** none run.
- **Attempted (17 Oct):** verified the live hotfix instead: `/api/health` reports commit `a729878a` (deployment `37503f09…`); `/`, `/auth`, `/pricing` 200 with 0 page errors; `/auth` not cross-origin isolated, `/` isolated; crafted `/_serverFn/<script>` URLs answer `403 text/plain`, nothing reflected; CSP and `nosniff` present. `verify:full` on `a729878a` 15/15 gates, `npm audit --omit=dev` 0.
- **Remains:** a rollback and roll-forward through `deploy.mjs` (or the Cloudflare dashboard "Versions → Roll back") with the owner present.

## REL-00-02 — Production deploys only through the approved gate

- **Test:** a merge to `main` does not reach production until `cloudflare-production.yml` runs with the approval phrase.
- **Status:** FAIL. The workflow has never run (0 runs) and `ci.yml` on `a729878a` failed in 3 s (billing), yet production reports commit `a729878a` minutes after the merge: Cloudflare's own Git integration builds and deploys `main` on push, outside `verify:full` and the approval gate.
- **Risk:** any future merge to `main` goes live immediately, gated only by Cloudflare's build.
- **Remains:** owner decision — disable Workers Builds automatic production deploys for `main` (keep previews if wanted) so `deploy.mjs` is the only production path, or accept auto-deploy and gate merges to `main` instead.

## CI-00-01 — GitHub Actions cloud workflows

- **Test:** `ci.yml`, `cloud-browser-isolated.yml`, `cloud-python-isolated.yml`, `cloud-android-isolated.yml`.
- **Reason:** GitHub refuses to start jobs ("recent account payments have failed or your spending limit needs to be increased"); runs 38904364149, 38904368896, 38904373137, 39003484385. Nothing charged.
- **Attempted:** everything that does not need Windows or Android ran in the Anthropic cloud session instead (see PLAN work records 16–17 Oct).
- **Remains:** the Windows-VM and Android-emulator jobs, after 1 November 2026 or the owner's choice.

## PC-02-01 — Windows 11 tabbed Notepad: JARVIS writes only into the document it opened

- **Phase / test ID:** Phase 02 (final-effect authority, target identity) · `test_computer.NativeAppTest.test_notepad_written_saved_through_its_dialog_and_read_back` plus the Notepad incident regression.
- **Functionality:** opening an app that reuses a window that is already open (Windows 11 Notepad opens a new tab in the existing window); targeting that tab by its exact title; refusing an ambiguous title; refusing a write after the window shows another document (tab switch); asking before replacing a document's existing text.
- **Why the cloud cannot substitute:** GitHub's Windows runners are Windows Server, which ships the classic, untabbed Notepad and no Microsoft Store apps. The tab-merging behaviour that caused the 16 October incident exists only on Windows 11 client editions. The cloud covers the logic with strict UI Automation fixtures (`test_ui_act.py`, PASS on Linux 16–17 Oct), but not the real tabbed app.
- **Files / functions:** `jarvis-runtime/ocade_accessibility.py` (`_pick`, `_window`, `_same_document`, `act`), `jarvis-runtime/ocade_computer.py` (`_open_app`, `_window`), `jarvis-runtime/tests/test_computer.py` (`NativeAppTest`), `jarvis-runtime/tests/test_ui_act.py`.
- **Risks and precautions:** this test once replaced the text of the owner's unsaved Notepad tab. Run it only in a separate Windows user account, or after confirming no Notepad window exists; the test now skips itself if one does. Create a second, disposable Notepad tab with sample text before the run, to prove it stays untouched.
- **Procedure and expected result:**
  1. In a disposable Windows 11 account, open Notepad with one tab containing the sample text "KEEP ME".
  2. Close it, then run the live test with `OCADE_LIVE_TESTS=1`. Expected: it skips while Notepad is open, and runs once Notepad is closed.
  3. Reopen Notepad with the "KEEP ME" tab. Use OCADE's `open_app` "Notepad". Expected: the result names the new tab's exact window title.
  4. Try `ui_inspect` with the title "Notepad". Expected: refused, "Several windows match" (if two windows) or bound to the exact title.
  5. Read the new tab, switch to the "KEEP ME" tab by hand, then try `set_value` with the earlier observation. Expected: `stale`, "now shows another document".
  6. Try `set_value` on a tab that has text, without confirmation. Expected: `needs_confirmation`.
  7. Check the "KEEP ME" tab afterwards. Expected: unchanged.
- **Status:** BLOCKED — REAL PC TEST DEFERRED.

## WIN-02-01 — UIA barrier interleavings on real apps; the 5-second lease timed

- **Test:** STOP before each UIA fallback route against real Windows apps; a device that cannot reach OCADE stops its running step within `CONTROL_LOSS_S = 5.0` s, measured.
- **Reason:** no isolated Windows environment in the Anthropic session; the Windows VM job is CI-00-01.
- **Attempted:** Linux runtime suite 242 OK (17 Oct), including the lease-loss tests with the lease shortened to 0.5 s.
- **Remains:** the same tests on a Windows VM with the real 5 s constant timed.

## AND-02-01 — Interrupted gesture on Android

- **Test:** STOP during a scroll gesture and a global key; the effect is reported stopped/unknown, never "did not reach".
- **Reason:** no Android emulator in the Anthropic session (no KVM); the emulator job is CI-00-01.
- **Attempted:** `javac` of all Android sources (16 Oct, local, before PC testing was withdrawn).
- **Remains:** emulator run of the Android journey.

## NET-03-01 — Packet-loss / reordered / malformed acknowledgement simulator

- **Test:** results and receipts survive dropped, duplicated, reordered and malformed exchange replies; each result is counted once.
- **Status:** UNTESTED — can run in the cloud session; not yet built as a harness.
- **Remains:** a fault-injecting proxy between the Device Agent and the stub, then the Phase 03 assertions.

## AND-03-01 — Android process death at each journal transition

- **Reason / remains:** as AND-02-01.

## GEM-04-01 — Three-key failover with real keys

- **Test:** a transport failure or refused key on one slot moves to the next under the same attempt budget, against Google.
- **Reason:** one staging key exists (network secret `OCADE Gemini Staging`).
- **Attempted:** fixture tests (edge-handler) PASS; real 429s were honoured with the provider's wait (52 s) and the task completed.
- **Remains:** two more staging keys, or the owner accepts fixture evidence for failover.

## GEM-04-02 — Background Mode step planned by the real model

- **Test:** the carry-on journey with real Gemini planning instead of scripted turns.
- **Status:** UNTESTED. The rebuilt-call shape Background Mode sends is accepted by real Gemini (`scripts/e2e/gemini-contract.mjs`, 12/12 twice).
- **Remains:** a live carry-on scenario in the harness.

## GEM-04-03 — Durable thought signatures for Background Mode

- **Status:** OPEN. Background Mode rebuilds calls from saved steps with Google's skip value; the original signatures are not stored. Storing them needs a migration and the owner's deployment gate.

## LIVE-04-01 — Live video task: captions read on the page

- **Test:** `live-journey.mjs` video → "its captions were read on the page" and "the summary carries what the captions explain".
- **Status:** FAIL (17 Oct, real Gemini). After the `pausedAt` verifier fix the pause is genuine (player record: paused at 30 s), but the player reported no caption tracks (`captionLanguages: []`), so `media captions` was never usable and the summary missed "magnetar".
- **Attempted:** a prompt rule to use `media` instead of clicks (no effect, removed).
- **Remains:** load Commons' timed-text track in the media capability (Phase 17), then rerun.

## LIVE-04-02 — Live photo task in a canvas editor

- **Test:** `live-journey.mjs` photo → an edited PNG in the work folder.
- **Status:** FAIL (17 Oct, real Gemini): 1 203 s, 118 upstream requests, 23 confirmations, no PNG.
- **Remains:** canvas/vision route qualification (Phases 11 and 17).

## VER-01-01 — A claim about an effect no check covers is refused

- **Status:** OPEN (HIGH). When the model writes no check for an effect the person asked for, its completion claim about that effect is still accepted. The video case is closed by the `pausedAt` check; the general case is not.
- **Remains:** derive mandatory checks from the request, or refuse completion text that asserts unchecked effects (Phase 01 verifier contract) — before any release.

## PERF-05-01 — Segment timing

- **Test:** identical 30-step fixtures, old per-action path vs `segment_v1`, p50/p95 incl. durable flush and verification; native Windows batch timing.
- **Reason:** native timing needs a Windows VM (CI-00-01).
- **Remains:** the Linux fixture comparison can run in the cloud session (UNTESTED); Windows BLOCKED.

## AND-05-01 — Android multi-step segments

- **Status:** OPEN. Android devices still receive one step per exchange.

## BRW-00-01 — Firefox and WebKit legs of the browsers journey

- **Reason:** `playwright install firefox webkit` fails (download refused by this session's egress policy). WebKit would not be iOS evidence in any case.
- **Remains:** a session or runner that can download them.

## BRW-00-02 — Real push service

- **Reason:** Playwright's Chromium has no push service; the journey says so and reports BLOCKED.

## VOI-13-01 — Real speech-recognition service

- **Reason:** the browser's own recognition service is not reachable from the session.

## PC-07-01 — Licensed Microsoft Excel and Word: finish, save, reopen and verify a real workbook and document

- **Phase / test ID:** Phase 07 (native file and Office fidelity) · `test_sheets.RealSpreadsheetAppTest.test_finish_the_orders_sheet_in_excel`, `test_files_documents.DeckTest`, Office routes of `office-journey.mjs`.
- **Functionality:** JARVIS driving the person's own licensed Excel and Word through their automation interfaces: formulas calculated by Excel itself, formatting, Save As, reopen, and independent verification of the saved file.
- **Why the cloud cannot substitute:** cloud Windows runners have no licensed Microsoft Office, and activating Office in a disposable VM is not permitted at ₹0. ONLYOFFICE/LibreOffice in the cloud cover file-format fidelity only. They do not cover the licensed Office automation path customers will use. A single PC run on 16 October 2026 passed `test_finish_the_orders_sheet_in_excel`; it must be repeated on the final candidate.
- **Files / functions:** `jarvis-runtime/ocade_sheets.py` (`edit`, `automation_server`), `jarvis-runtime/actions/ocade_workbook.ps1`, `jarvis-runtime/actions/ocade_document.ps1`, `jarvis-runtime/ocade_documents.py`.
- **Risks and precautions:** Excel and Word may already have the owner's files open. Run only with both apps closed, in a disposable folder, and never on an existing workbook or document. The test opens visible windows, so do not use the PC during it.
- **Procedure and expected result:**
  1. Close Excel and Word.
  2. Run the live Office tests with `OCADE_LIVE_TESTS=1` against a temporary workspace.
  3. Expected: the totals are calculated by Excel and kept as formulas; formatting and the other sheets are preserved; the original file is untouched; the copy reopens with the same values.
  4. Then run the office journey on the final candidate. Expected: every check passes, with the report's words read back from the saved `.docx`.
- **Status:** BLOCKED — REAL PC TEST DEFERRED.
