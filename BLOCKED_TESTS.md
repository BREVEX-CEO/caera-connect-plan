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

| ID          | Phase        | Check                                                   | Status   | Needs                                                 |
| ----------- | ------------ | ------------------------------------------------------- | -------- | ----------------------------------------------------- |
| REL-00-01   | 00 / release | Production rollback rehearsal                           | BLOCKED  | Cloudflare credentials (GitHub environment or owner)  |
| REL-00-02   | 00 / release | Production deploys only through the approved gate       | FAIL     | Owner: Cloudflare Git auto-deploy setting             |
| CI-00-01    | all          | GitHub Actions cloud workflows                          | BLOCKED  | Actions allowance (renews 1 Nov 2026) or owner choice |
| PC-02-01    | 02           | Windows 11 tabbed Notepad target identity               | BLOCKED  | Owner-approved Windows 11 client                      |
| WIN-02-01   | 02           | UIA barrier interleavings on real apps; 5 s lease timed | BLOCKED  | Isolated Windows VM                                   |
| AND-02-01   | 02           | Interrupted gesture on a device/emulator                | BLOCKED  | Android emulator                                      |
| NET-03-01   | 03           | Packet-loss / reordered / malformed ACK simulator       | UNTESTED | Cloud session (can run)                               |
| AND-03-01   | 03           | Android process death at each journal transition        | BLOCKED  | Android emulator                                      |
| GEM-04-01   | 04           | Three-key failover with real keys                       | BLOCKED  | Two more staging keys                                 |
| GEM-04-02   | 04           | Background Mode step planned by the real model          | UNTESTED | Cloud session + staging key (can run)                 |
| GEM-04-03   | 04           | Durable thought signatures for Background Mode          | OPEN     | Migration + owner deployment gate                     |
| LIVE-04-01  | 04 / 17      | Live video task: captions read on the page              | FAIL     | Wikimedia 429 to clear; rerun                         |
| LIVE-04-02  | 04 / 11 / 17 | Live photo task in a canvas editor (miniPaint)          | FAIL     | Fix in canvas/vision route                            |
| VER-01-01   | 01           | A claim about an effect no check covers is refused      | OPEN     | Verifier contract                                     |
| PERF-05-01  | 05           | Identical 30-step old/new timing; Windows batch timing  | BLOCKED  | Isolated Windows VM                                   |
| AND-05-01   | 05           | Android multi-step segments                             | OPEN     | Android implementation + emulator                     |
| BRW-00-01   | 16           | Firefox and WebKit legs of the browsers journey         | RESOLVED | —                                                     |
| BRW-00-02   | 16           | Real push service                                       | BLOCKED  | Browser build with a push service                     |
| VOI-13-01   | 13           | Real speech-recognition service                         | BLOCKED  | Reachable speech service                              |
| PC-07-01    | 07           | Licensed Excel and Word automation                      | BLOCKED  | Owner-approved Windows PC with Office                 |
| NOTIF-06-01 | 06           | Email delivery of task and security notifications       | BLOCKED  | Staging email provider                                |
| WAKE-06-01  | 06           | Device wake hints and first-step latency                | UNTESTED | Cloud session (can run)                               |
| SCH-06-01   | 06           | Scheduler kill on the deployed Worker cron              | BLOCKED  | Staging deployment                                    |
| WIN-07-01   | 07           | Office helpers restore alerts, quit only own instance   | BLOCKED  | Isolated Windows VM with Office                       |
| WIN-07-02   | 07           | Native Office reopen/layout; locked and corrupt inputs  | BLOCKED  | Isolated Windows VM with Office                       |
| FS-07-01    | 07           | A user edit between undo's comparison and restore       | UNTESTED | Cloud session (can run)                               |
| SEC-08-01   | 08           | A staff proof binds the exact target                    | OPEN     | Proof contract                                        |
| SEC-08-02   | 08           | Recovery against real Supabase Auth                     | BLOCKED  | Staging Supabase project                              |
| UI-08-01    | 08           | Consent dialog: account switch and unmount while asking | UNTESTED | Cloud session (can run)                               |
| SUP-08-01   | 08           | Support share flow on staging                           | BLOCKED  | Staging Supabase project                              |
| DATA-09-01  | 09           | Restore must not bring back erased content              | BLOCKED  | Staging restore                                       |
| DATA-09-02  | 09           | Storage faults during erasure; expired links            | BLOCKED  | Staging Supabase project                              |
| DATA-09-03  | 09           | A very large export on the deployed Worker              | BLOCKED  | Staging deployment                                    |
| OFF-10-01   | 10           | Real Offline Intelligence install and cold answer       | BLOCKED  | R2 read access (owner)                                |
| OFF-10-02   | 10           | Offline answer quality, storage pressure, accounts      | BLOCKED  | As OFF-10-01                                          |
| WIN-11-01   | 11           | Unfamiliar Windows app qualification                    | BLOCKED  | Isolated Windows VM                                   |
| WIN-12-01   | 12           | Windows install, pairing, update, rollback, uninstall   | BLOCKED  | Isolated Windows VM                                   |
| AND-14-01   | 14           | Android app on an emulator or device                    | BLOCKED  | KVM emulator or device                                |
| IOS-15-01   | 15           | Physical iPhone/iPad and macOS behaviour                | BLOCKED  | Apple hardware / macOS runner                         |
| UI-16-01    | 16           | Pixel-baseline visual regression                        | OPEN     | Baseline images + comparison step                     |
| UI-16-02    | 16           | Device refusal: revoked authority, STOP while saving    | UNTESTED | Cloud session (can run)                               |
| SR-16-01    | 16           | Real screen readers (NVDA, VoiceOver, TalkBack)         | BLOCKED  | Windows/macOS/Android with screen reader              |
| APP-17-01   | 17           | Independent reopen in LibreOffice on every CI run       | BLOCKED  | CI-00-01; LibreOffice in the Python job               |
| ONL-17-01   | 17           | ONLYOFFICE opens and recalculates OCADE's files         | BLOCKED  | Owner: edition/licence; a VM where it starts          |
| MED-17-01   | 17           | Creative/media families: editable project + 720p/1080p  | OPEN     | Owner: which family to support first                  |
| WF-18-01    | 18           | Reconcile workflow: 30 held-out real-model cases        | FAIL     | Rerun on fixed code; outcome templates                |
| WF-18-02    | 18           | Client pack workflow: 30 held-out real-model cases      | UNTESTED | Gemini daily quota (resets daily)                     |
| WF-18-03    | 18           | Order status workflow: 30 held-out real-model cases     | UNTESTED | Gemini daily quota (resets daily)                     |
| WF-18-04    | 18 / 01      | Zero falsely verified completions                       | FAIL     | Outcome templates (VER-01-01)                         |
| WF-18-05    | 18           | Five consenting design partners, two weeks              | BLOCKED  | Owner: recruit partners                               |
| WIN-18-01   | 18           | PDF through Word/Excel/PowerPoint on Windows            | OPEN     | Isolated Windows VM with Office                       |
| DEB-19-01   | 19 / 04      | One provider retry budget (no nested retries)           | UNTESTED | Live 429/503 reliability before/after (quota)         |
| DEB-19-02   | 19           | Bubble and Workspace share one turn lifecycle           | OPEN     | Merge with account-switch/STOP/handoff proof          |
| REL-20-01   | 20           | Frozen candidate SHA with an evidence manifest          | OPEN     | Phases 18 and 20 gates closed first                   |
| SEC-20-01   | 20           | Independent adversarial review of release scope         | BLOCKED  | A reviewer independent of this session                |
| PAY-21-01   | 21           | Approved merchant provider, legal/tax/refund terms      | BLOCKED  | Owner decision                                        |
| PAY-21-02   | 21           | Approved price catalogue (one contract)                 | BLOCKED  | Owner: choose between the two proposals               |
| PAY-21-03   | 21           | Sandbox webhook, replay, refund, renewal cycles         | BLOCKED  | PAY-21-01 (provider sandbox account)                  |
| LAU-22-01   | 22           | Post-payment final matrix and controlled launch         | BLOCKED  | Phase 21, REL-20-01, owner launch approval            |

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
- **Status:** FAIL (17 Oct, real Gemini, three runs after the fixes below). Run 1: the player now lists `captionLanguages: ["en"]`, but `media captions` failed; run 2: Wikimedia showed "prove you are human" and the task was correctly handed to the person; run 3: paused exactly at 0:30 and the summary carried the facts (read from the description), but the model never called `captions`.
- **Root causes found and fixed (Phase 17):** Commons' player rebuilds its video, so the page's own track was not the one OCADE read: captions declared as `<track>` files were reported as none; the video's own track never loaded its cues, and `captions` then came back **done with nothing in it** (a false success); `play` on a video that cannot load never settled, hanging the step (`TimeoutError` after 90 s). Now the declared file is read when cues do not arrive, empty captions fail, and `play` says after 10 s that the media is still loading. Fixture tests fail before and pass after (`test_browser_control`).
- **Error now:** the device browser's direct check on the real page: `This video's captions could not be read (the site answered 429)`. Wikimedia's API is rate-limiting this cloud IP (`You are making too many requests to the API`); the first probe before the limit returned the real WebVTT file.
- **Remains:** rerun once the limit clears (or from another network); the model must still choose `captions` when the task says "read its captions".

## LIVE-04-02 — Live photo task in a canvas editor

- **Test:** `live-journey.mjs` photo → an edited PNG in the work folder.
- **Status:** FAIL (17 Oct, real Gemini): 1 203 s, 118 upstream requests, 23 confirmations, no PNG.
- **Remains:** canvas/vision route qualification (Phases 11 and 17).

## VER-01-01 — A claim about an effect no check covers is refused

- **Status:** OPEN (HIGH). When the model writes no check for an effect the person asked for, its completion claim about that effect is still accepted. The video case is closed by the `pausedAt` check; the general case is not.
- **Live evidence (17 Oct):** three real-model reconcile tasks completed with empty result sheets under model-written checks that only named the file (WF-18-04).
- **Remains:** derive mandatory checks from the request, or refuse completion text that asserts unchecked effects (Phase 01 verifier contract) — before any release.

## PERF-05-01 — Segment timing

- **Test:** identical 30-step fixtures, old per-action path vs `segment_v1`, p50/p95 incl. durable flush and verification; native Windows batch timing.
- **Reason:** native timing needs a Windows VM (CI-00-01).
- **Remains:** the Linux fixture comparison can run in the cloud session (UNTESTED); Windows BLOCKED.

## AND-05-01 — Android multi-step segments

- **Status:** OPEN. Android devices still receive one step per exchange.

## BRW-00-01 — Firefox and WebKit legs of the browsers journey

- **RESOLVED (17 Oct).** After the session's network policy changed, Playwright's Firefox 153 and WebKit 26.5 downloaded and their host libraries installed. Browsers journey: Firefox desktop, WebKit desktop and WebKit iPhone-sized 48/48 PASS. WebKit emulation is not iOS evidence (Phase 15 keeps the device checks BLOCKED).

## BRW-00-02 — Real push service

- **Reason:** Playwright's Chromium has no push service; the journey says so and reports BLOCKED.

## VOI-13-01 — Real speech-recognition service

- **Test:** `jarvis-journey.mjs` with `OCADE_SPEECH_BROWSER` (Google Chrome) and `OCADE_SPEECH_WAV`: a spoken question played into the microphone becomes the person's message.
- **Attempted (17 Oct):** installed Google Chrome 155; synthesized "What is the capital of France?" with espeak-ng at 22 kHz and 48 kHz stereo; Chrome's fake device works for `getUserMedia` ("Fake Default Audio Input"), but `webkitSpeechRecognition` fails with `audio-capture`, also with a PulseAudio null sink running.
- **Remains:** a desktop session with a real audio stack (Windows VM or owner-approved PC). Everything else about voice runs with a scripted recogniser and passes, including Interrupt cutting speech without stopping anything else (new 17 Oct).

## NOTIF-06-01 — Email delivery of task and security notifications

- **Test:** a task outcome or security notification is emailed once, with retry and dead-letter state like push.
- **Reason:** no email transport exists (`channels.ts` marks email unavailable and never offers it). Adding one needs a provider account (an API key and a verified sending domain), which only the owner can create; ₹0 rules out paid tiers.
- **Remains:** owner chooses a provider with a free tier; then a sender in `send.server.ts` beside `web-push.ts`, with the same idempotency key and `DELIVERY_ATTEMPTS`.

## WAKE-06-01 — Device wake hints and first-step latency

- **Status:** UNTESTED. The 11 Oct decision kept 1 s / 5 s device polling instead of a push channel until latency is measured. The measurement can run in the cloud session (scripted journey timing); it has not yet.

## SCH-06-01 — Scheduler process kill on the deployed Worker cron

- **Test:** kill the Worker between claim and task creation on a real staging deployment; the next cron tick finishes the claimed occurrence once.
- **Reason:** no staging Worker or database is available to this session (owner gate). The same kill points are proven against real PostgreSQL with the real migrations (`schedules.test.ts`).

## WIN-07-01 — Office helpers restore alerts and quit only their own instance (V24)

- **Test:** with Word/Excel already open on another document: run a doc/sheet job with `close` true and false, a job that throws after Save, and a cancelled job; afterwards the app's `DisplayAlerts` equals its value before, the person's documents are still open, and only an instance OCADE started was quit.
- **Reason:** COM automation exists only on Windows with Office; the Anthropic session is Linux.
- **Attempted (17 Oct):** both helpers changed (`finally` restores the captured `DisplayAlerts`; Word now tracks `$created` and quits only its own instance); both scripts parse under PowerShell 7.4.6 here.
- **Remains:** the run above on a Windows VM (CI-00-01) or the owner-approved PC (PC-07-01).

## WIN-07-02 — Native Office reopen/layout comparison; locked and corrupt inputs

- **Reason:** as WIN-07-01. The file route (python-docx / python-pptx / openpyxl) is proven on Linux (17 Oct tests).

## FS-07-01 — A user edit between undo's comparison and its restore

- **Status:** UNTESTED. Undo now refuses after any change inside a copied folder (V21), but the window between its fingerprint check and the trash/restore is not closed; a deterministic race test can run in the cloud session.

## SEC-08-01 — A staff proof binds the exact target

- **Status:** OPEN. Since 20261017100000 a proof the server spent is adopted only for the database action it was spent on (V12), so a confirmation for "open a support case" cannot pay for ending every staff session. Several changes share one action name ("change who operates OCADE" covers grant, revoke, permissions and withdrawn invites), and the target is not compared: the server's digest of its input cannot be recomputed in SQL.
- **Remains:** pass the server's target digest into each staff RPC and compare it in `private.ocade_staff_require`.

## SEC-08-02 — Recovery against real Supabase Auth

- **Test:** factor deletion and session sign-out failing at the provider, then the same code finishing the recovery (V11).
- **Reason:** the provider calls are Supabase Auth admin APIs; the session has no staging project. The SQL is proven on PostgreSQL (`recovery-operation-sql.test.ts`) and the flow with a faithful mock (`recovery-functions.test.ts`).

## UI-08-01 — Consent dialog: account switch and unmount while asking

- **Status:** UNTESTED. Joining concurrent asks is unit-tested (fails before, passes after); the dialog's "no" on unmount and on account change has no browser step yet (no component test environment exists).

## SUP-08-01 — Support share flow on staging

- **Reason:** as SEC-08-02. Proven on PostgreSQL with the real migrations and in the cloud chat/admin journeys against the stub.

## DATA-09-01 — Restore must not bring back erased content

- **Reason:** restore is a database-provider operation (point-in-time recovery) on a project this session cannot reach; rehearsing it is Phase 20's, the reconciliation against tombstones is this phase's mechanism and is UNTESTED until a staging restore exists.

## DATA-09-02 — Storage faults during erasure; expired download links

- **Reason:** the tombstone sweep is proven against a fake Storage client (11 Oct record); real Supabase Storage failure and signed-URL expiry need a staging project.

## DATA-09-03 — A very large export end to end on the deployed Worker

- **Test:** an account with tens of MB of messages exports completely through the deployed Worker within its memory.
- **Status:** the export is now streamed a page at a time (tests prove one database read per page pulled); the deployed Worker's memory and time limits are not measured here.

## OFF-10-01 — Real Offline Intelligence install and cold offline answer

- **Test:** `offline-real-journey.mjs`: the published release (`ocr-2dc0ee44eb397906`, 484 MB, SHA-256 in `release/OCADE_OFFLINE_RELEASE.json`) installs through OCADE's delivery route, resumes after an interrupted download, answers correctly with the network cut, answers again from the stored model, and Remove deletes it.
- **Reason:** the release lives in the private bucket `ocade-private-models`; the cloud workflow copies it into the local test bucket with the owner's read-only R2 key (`OCADE_R2_*` GitHub secrets). This session has no such key, and GitHub Actions refuses jobs (CI-00-01).
- **Error (17 Oct):** with no release present the journey ran 15 minutes and reported 8 FAILs ("Preparing OCADE · 30 deliveries in 902 s") instead of BLOCKED. Fixed: it now reports BLOCKED with the delivery statuses when no delivery succeeded.
- **Passed instead:** `offline-journey.mjs` (the surface: states in OCADE's own words, no claim that a published release is unavailable).
- **Remains:** the owner adds the read-only R2 key as a session network secret or environment variable, or Actions resumes.

## OFF-10-02 — Offline answer quality, storage pressure, cross-account

- **Reason / remains:** as OFF-10-01; these run on the installed real model.

## WIN-11-01 — Unfamiliar Windows app qualification

- **Reason:** discovery reads Windows executables, COM servers and Start-menu registrations (`test_discovery.py` skips them on Linux). Added in the cloud (17 Oct): a standing test that the runtime's code names no particular application.

## WIN-12-01 — Windows install, pairing, signed update, rollback and uninstall

- **Reason:** the installed lifecycle (`manual_installed_lifecycle.py`, `manual_real_update.py`) needs a Windows VM and the shipped signing certificate. Proven in the cloud (17 Oct): signed-update verification `test_update.py` 28 OK; real existing-browser attachment with Chromium 1194 `test_existing_browser.py` 7 OK (attach, act in its own tab and leave the person's tabs alone, network boundary on a switched tab, reconnect after a browser restart) — those three tests had been skipping here for lack of a browser path.

## AND-14-01 — Android app on an emulator or device

- **Reason:** this VM has no `/dev/kvm`, so no emulator can boot; the emulator job is CI-00-01.
- **Proven here (17 Oct):** Android SDK 35 installed in the session; `android/build.py` compiles and packages the app (`in.ocade.app` 0.1.0, min SDK 30, target 35; APK signed with a throwaway test key, `apksigner verify` OK). This also compiles the Phase 02/03 Android changes. Phone/computer wake-model parity (`test_wake.PhoneParityTest`, compiled `WakeModel.java`) PASS.

## IOS-15-01 — Physical iPhone/iPad and macOS behaviour

- **Reason:** no Apple hardware or macOS runner. WebKit iPhone-sized browser emulation passes (BRW-00-01), which is not device evidence.

## UI-16-01 — Pixel-baseline visual regression

- **Test:** each screen's screenshot at desktop, tablet and phone width, dark and light, compared with an approved baseline image.
- **Status:** OPEN. `visual-journey.mjs` takes every screenshot and fails on overflow, page errors and off-screen controls, and the screenshots were read by eye (17 Oct); there is no approved baseline and no pixel comparison step, so a visual drift that keeps the layout valid is not caught automatically.
- **Remains:** owner-approved baseline images and a comparison step without a new dependency (Playwright's own `toHaveScreenshot` needs `@playwright/test`, which the journeys do not use).

## UI-16-02 — Device refusal: revoked authority and STOP while saving

- **Test:** "Not mine" on a pairing request when the server refuses (authority revoked) and when STOP is pressed while the refusal is saving.
- **Status:** UNTESTED. The failed-network path is proven in the browser (`jarvis-journey`: the request stays open and the button works again; a second click cannot send twice while saving). A server refusal takes the same rejected-promise path but has no browser step yet; STOP has no effect on a pairing request (no task runs).
- **Remains:** a route that answers the refusal with a server error, checked the same way.

## SR-16-01 — Real screen readers

- **Reason:** the journeys drive every control by its accessible role and name (the browser's accessibility tree), which is not a screen reader. NVDA/Narrator need Windows, VoiceOver needs macOS/iOS, TalkBack needs Android; none exist here.
- **Remains:** a run of the main task, STOP and Take Over flows with each screen reader, with the live task line (`aria-live="polite"`) announced without repeating the elapsed-time tick.

## APP-17-01 — Independent reopen in LibreOffice on every run

- **Test:** `jarvis-runtime/tests/test_independent_reopen.py`: OCADE's finished workbook, report and deck opened by LibreOffice 24.2; it recalculates the workbook's formulas itself and must reach the same revenue/tax totals a hand calculation does, keep the chart a chart, read the replaced report text, and render one page per slide; damaged .xlsx/.docx/.pptx are refused and left byte-identical.
- **Result (17 Oct, cloud VM):** 4/4 PASS; a wrong total formula fails it (`['Total', '9705'] != ['Total', '10655']`).
- **Reason open:** the test skips where LibreOffice is absent; the Python CI job does not install it and Actions cannot run (CI-00-01).
- **Remains:** `libreoffice-calc libreoffice-writer libreoffice-impress poppler-utils` in `cloud-python-isolated.yml` once Actions runs.

## ONL-17-01 — ONLYOFFICE opens and recalculates OCADE's files

- **Test:** the files from APP-17-01 opened in ONLYOFFICE with the same totals, text and slides.
- **Status:** BLOCKED. ONLYOFFICE Desktop Editors 10.0.0-169 (AGPL-3.0, free download, SHA-256 `2190edb4…b59c`) was unpacked in the cloud VM, test-only, not installed into the product.
- **Errors:** its `x2t` converter exported formulas as text (`=C2*D2`, no values: it has no calculation engine of its own); its PDF route crashed (`TypeError … AscCommon … decode`, then `Fatal error in v8::ToLocalChecked`) without the font cache the desktop app builds on first run; the desktop app aborts under Xvfb (`Gtk-ERROR: Can't create a GtkStyleContext without a display connection` from its helper process, with and without explicit `DISPLAY`/`GDK_BACKEND=x11`).
- **Attempted:** both conversion routes; libnotify/GTK/NSS libraries installed; two display setups.
- **Remains:** owner decision on the ONLYOFFICE edition and licence (PLAN Phase 17 order, step 1), then a desktop VM (Windows or Linux with a full session) where the editor starts; rerun APP-17-01's checks against it.

## MED-17-01 — Creative and media families

- **Test:** an editable project (video, image or 3D) plus a real 720p/1080p render, reopened and inspected.
- **Status:** OPEN. OCADE advertises no video, 3D or design-tool family and has no adapter for one; building one now would be speculative (PLAN Phase 17: add a capability only for a demonstrated requirement). Browser-based media work is covered by LIVE-04-01/02.
- **Remains:** the owner names the first family and the customer requirement; then probe version, freeze a fixture, typed operations, reopen and render checks.

## WF-18-01 — Reconcile workflow: held-out real-model cases

- **Test:** `live-journey.mjs` with `OCADE_LIVE_TASKS=reconcile`: a seeded ledger.xlsx and bank.csv (one ID missing from the bank, one extra, one amount changed); checked by `workflow_cases.py`: originals byte-identical, Matched lists exactly the agreeing IDs, its total recalculated by LibreOffice equals the true total and is a SUM formula, Unmatched lists exactly the three IDs.
- **Results (17 Oct, real Gemini, cloud VM):** case 1 FAIL (handed back after 1 204 s; root cause fixed in `bbced1f8`: a missing sheet is refused with the sheets it has and how to add it); rerun cases 1–2 2/2 PASS (37 s / 15 requests, 80 s / 16 requests); seeds 3–12 6/10 PASS, 39–183 s, 12–41 requests a case.
- **Error:** the 4 failures (cases 6, 7, 10, 11) all follow `That did not work (ValueError)` (11 times in the batch): a table on a second sheet was named `Table1` again. Fixed in `fe7ddb2f` (names unique in the workbook; a duplicate given name refused in words), but the batch's device had started before the fix, so it ran the old code.
- **Remains:** rerun seeds 3–32 on the fixed code (needs the Gemini daily quota, WF-18-02), then WF-18-04.

## WF-18-02 — Client pack workflow: held-out real-model cases

- **Test:** template.docx + client.xlsx → pack.docx (no placeholder left, every detail present, template styles kept) + pack.pdf carrying the details (through `pdf_export`); originals byte-identical.
- **Results (17 Oct):** case 1 and seeds 3–10: 9/9 PASS, 25–136 s, 12–20 requests, 0 confirmations, 0 failed steps.
- **Reason open:** case 11 was cut off by Gemini's free-tier daily request limit (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, retry after 52 732 s); that is a quota stop, not a result. Per-minute request and input-token limits (429, 24–53 s) were absorbed by the shared retry budget.
- **Remains:** seeds 11–30 once the quota resets (₹0; no paid tier without owner approval).

## WF-18-03 — Order status workflow: held-out real-model cases

- **Test:** status pages served on this machine (one stale, one missing) → status.xlsx with each order's status and update time as its page says, nothing invented for the missing page, a Problems sheet listing exactly the stale and missing orders.
- **Results (17 Oct):** case 1 PASS (40 s, 15 requests, 0 confirmations); seeds 3–12 not reached (daily quota, WF-18-02).
- **Remains:** 29 more cases once the quota resets.

## WF-18-04 — Zero falsely verified completions

- **Status:** FAIL. Reconcile cases 6, 7 and 11 ended "completed" while Matched (and in case 7 Unmatched) was empty. The server checked exactly the checks the model wrote at start_task — `{"path": "reconciliation.xlsx"}`, or that path containing "Matched" and "Unmatched" — and those passed: the file existed and named its sheets.
- **Attempted:** none that closes it: the model cannot know the expected records or total before working them out, so a prompt rule cannot make its own checks strong enough.
- **Fix in place (17 Oct, not yet proven live):** a check `{path, sheet}` now means that sheet exists with rows below its header, judged from the device's own `sheet_inspect` read (`device-exchange.test.ts`: an empty Matched sheet is refused, a filled one completes; fails before, passes after). The model is told to write one for every sheet the person asked for. It still depends on the model writing that check.
- **Remains:** rerun the reconcile cases live (Gemini daily quota) and count false completions; approved outcome templates per workflow (PLAN Phase 18; VER-01-01) so a recurring workflow's checks are fixed by OCADE, not authored by the model.

## WF-18-05 — Design partners

- **Reason:** five consenting accountants or independent professionals observed for two weeks need the owner to recruit them; synthetic fixtures only so far.

## WIN-18-01 — PDF through Office on Windows

- **Status:** OPEN. `pdf_export` uses LibreOffice wherever it is installed (Linux proven, Windows/macOS install paths looked up); Word/Excel/PowerPoint's own PDF export is not built, because it cannot be tested here.

## DEB-19-01 — One provider retry budget

- **Measured (17 Oct, source trace):** the Worker makes up to 3 provider attempts (`MAX_PROVIDER_ATTEMPTS`, inline waits ≤ 2 s) and the browser's `askThroughBusy` asks again up to twice (15 s, 30 s) whenever the answer is busy with no longer wait: a provider failing with 503 and no stated wait costs up to 9 upstream requests per model turn.
- **Status:** UNTESTED, unchanged on purpose. PLAN Phase 19 requires before/after 429/503 reliability on the same fixtures before merging the budgets; the Gemini daily limit was spent the same day (WF-18-02).
- **Remains:** a controlled run (provider stub returning 503/429 with and without waits, plus a live sample), then let only one layer retry.

## DEB-19-02 — Bubble and Workspace turn lifecycle

- **Status:** OPEN. `JarvisBubble` `ask` and `JarvisWorkspace` `send` still run their own turn lifecycles (ToRemove.md). Merging them touches account switch, late callbacks, STOP, admission, settlement and the bubble→workspace handoff; not done without those tests written first.

## REL-20-01 — Frozen candidate and evidence manifest

- **Status:** OPEN. PLAN Phase 20 freezes one SHA and binds every shipped claim to evidence from that SHA. Not frozen: Phase 18 has false completions (WF-18-04) and VER-01-01 is open, so any manifest now would describe a candidate that cannot ship.

## SEC-20-01 — Independent adversarial review

- **Reason:** PLAN Phase 20 requires one adversarial pass by someone other than the implementer; this session wrote the code under review. The automated security gates ran (17 Oct): `npm audit` 0 vulnerabilities (all dependencies), `pip-audit` on the runtime pins found lxml 6.0.2 / CVE-2026-41066 (XML entity resolution can read local files from untrusted XML) and it is fixed (lxml 6.1.0, 262 device tests PASS).

## PAY-21-01 / 02 / 03 — Payments

- **Reason:** PLAN Phase 21 allows billing schema only after an approved merchant provider and legal, tax and refund terms (owner decisions), and live payment activation is outside this session's authority. Two price proposals conflict in PLAN (₹488/week, ₹988/month, ₹9,888/month versus the Essential/Premium/Max 28/88 proposal); no catalogue change is made until one is approved. The core candidate is not qualified either (REL-20-01).
- **Remains:** owner chooses the provider and catalogue; then sandbox webhook signature, duplicate/reordered/forged events, refund, cancel-at-period-end, renewal reconciliation in the cloud, and a low-value live transaction only with approval.

## LAU-22-01 — Final matrix and launch

- **Reason:** depends on Phase 21 and an owner-approved launch; no production promotion from this session.

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
