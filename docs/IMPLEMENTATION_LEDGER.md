# OCADE Implementation Ledger

The durable checkpoint for the current implementation mission. Every session reads this after `AGENTS.md`, `PLAN.md` and `docs/MEMORY.md`, continues from **Next step**, and updates it before any handoff, compaction or stop.

## Identity

- Branch: `jarvis/authority-repair`
- Base: `main` at `a7e4634b5bba766b18d2cfebf139273596e36439`
- Host used for this run: Windows 11 (physical), Node 24, Python 3.12. No WSL, Docker, macOS, Android or iOS hardware on this host.

## Baseline (before any change)

- `npm test`: 89/90 files, 938 passed, 1 failed, 1 skipped. The failure was a test defect: the preservation manifest is checked out with CRLF on Windows and was split on `\n`. Fixed in the test (the snapshot and ZIP were never touched).
- `jarvis-runtime` Python tests on Windows: 8 failures that also fail on the untouched baseline. They are Linux-only assumptions (autostart path, `.desktop` apps, update `.exe` layout). Tracked below as W-1..W-3.

## Error Audit 01 status

Evidence labels: LOCAL TEST (this host), REAL WINDOWS, REAL BROWSER, SOURCE-PROVEN, BLOCKED, UNTESTED.

| ID            | Status                      | Evidence                                                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 023           | Fixed                       | LOCAL TEST (Windows)                                               | One cancellation token per action; the agent keeps exchanging while an action runs (`running`), OCADE answers `cancel`; tray/mini STOP sets the token synchronously; web STOP and task stop/Take Over cancel `claimed` rows; late results are stored only as a stop acknowledgement; UI shows Stopping… until the device confirms. Extension: detach + halt on STOP/cancel.                                                                       |
| 037           | Fixed (fail closed)         | LOCAL TEST (Windows)                                               | Terminal is offered only where bubblewrap confines it (Linux). Windows/macOS report it unavailable and refuse `run`. Linux bubblewrap run: BLOCKED on this host.                                                                                                                                                                                                                                                                                  |
| 051           | Fixed                       | LOCAL TEST (Windows, symlink test skips without symlink privilege) | `mkstemp` exclusive random temp in the resolved parent, fsync, re-check, atomic replace.                                                                                                                                                                                                                                                                                                                                                          |
| 053           | Fixed                       | LOCAL TEST (proxy, address classes)                                | Isolated browser: all traffic through `ocade_egress.EgressProxy` which resolves once, refuses any non-public address, and connects only to checked addresses (rebinding-safe). Own-browser (CDP) tabs: per-request check + response address check. Extension: `Fetch` request guard + `remoteIPAddress` response check (cannot resolve DNS itself; a rebinding response is detected and discarded, not prevented). Real Chrome run: UNTESTED yet. |
| 038           | Fixed                       | LOCAL TEST (fake GUI)                                              | Type/keys/scroll require the current observation; typing re-checks window and user input every 40 chars; STOP ends typing.                                                                                                                                                                                                                                                                                                                        |
| 039           | Fixed                       | LOCAL TEST                                                         | Pending journal written via temp + `os.replace`; damaged journal kept as `pending.damaged`.                                                                                                                                                                                                                                                                                                                                                       |
| 054           | Fixed                       | DATABASE TEST (PGlite)                                             | Dispatch re-runs `refuseAction` and confirmation rules at claim time; refused rows are cancelled with a reason; one action per device at a time.                                                                                                                                                                                                                                                                                                  |
| 055           | Mitigated                   | SOURCE                                                             | Raw shell only inside bubblewrap; unconfirmed commands get no network, no home, no inherited env. Regex remains a UI hint only. Confirmation is bound to the immutable server-written row.                                                                                                                                                                                                                                                        |
| 015, 033      | Fixed                       | LOCAL TEST (Windows)                                               | `fileURLToPath` instead of `URL.pathname`; built-in deterministic ZIP writer (same SHA-256 on rebuild).                                                                                                                                                                                                                                                                                                                                           |
| 036           | Fixed                       | SOURCE                                                             | `detachAll()` on STOP, disconnect, revoke (401/403/410) and when no task is open.                                                                                                                                                                                                                                                                                                                                                                 |
| 004           | Fixed                       | LOCAL TEST                                                         | JARVIS state query keyed by account and never read signed out; root auth listener drops every cached query when the account changes; Settings identity/2-step keyed by account.                                                                                                                                                                                                                                                                   |
| 006           | Fixed                       | LOCAL TEST                                                         | Online client refreshes an expired browser token once and resends the identical request (same permit and idempotency key); a failed refresh signs the browser out and says "Sign in again". Shared with Chat.                                                                                                                                                                                                                                     |
| 009, 013, 014 | Fixed                       | LOCAL TEST, REAL BROWSER (journey)                                 | One owner (account + conversation) for everything on screen. Owner change aborts the run, resolves pending confirmations, clears draft/transcript/task; late answers save to their own conversation and are never painted elsewhere. Root cause of 014: `createdHere` skip was never cleared.                                                                                                                                                     |
| 003, 008      | Fixed                       | LOCAL TEST                                                         | Existence checked server-side (`jarvisConversationExists`); skeleton while loading, Send disabled; missing/failed states with Try again / New conversation.                                                                                                                                                                                                                                                                                       |
| 011           | Fixed                       | LOCAL TEST                                                         | Abort from the answer stream is normalised to Stop at the turn boundary; "Stopped." is persisted; Retry answers the same saved question without saving it twice.                                                                                                                                                                                                                                                                                  |
| 018           | Fixed                       | LOCAL TEST                                                         | Text-only step with an open task: one reminder, then task → waiting ("JARVIS needs your answer"). Never left running without a loop.                                                                                                                                                                                                                                                                                                              |
| 056           | Fixed                       | LOCAL TEST                                                         | Memories passed as JSON-quoted user-role data, never in the system policy.                                                                                                                                                                                                                                                                                                                                                                        |
| 016           | Fixed                       | REAL WINDOWS                                                       | Windows inventory from `Get-StartApps` (AppsFolder ids, UWP included) plus shortcuts; UWP launched via fixed `explorer.exe shell:AppsFolder\<id>`. Calculator opened, process verified, closed.                                                                                                                                                                                                                                                   |
| 017           | Fixed                       | LOCAL TEST                                                         | `open_app` must exactly match (case-insensitive) an app the task's own computer reported; otherwise refused with up to 5 candidates.                                                                                                                                                                                                                                                                                                              |
| 019           | Fixed                       | LOCAL TEST                                                         | `start_task` result gives the planner the computer's system and what it offers; says commands are unavailable where they are.                                                                                                                                                                                                                                                                                                                     |
| 020           | Fixed                       | LOCAL TEST                                                         | `finish_task` writes a terminal checkpoint equal to progress.                                                                                                                                                                                                                                                                                                                                                                                     |
| 021           | Fixed                       | LOCAL TEST                                                         | Device summaries use plain words (no exception text); server `redactLocal` strips drive, UNC and home paths before Activity.                                                                                                                                                                                                                                                                                                                      |
| 024           | Fixed                       | LOCAL TEST                                                         | Allowed Apps grouped per computer; rules stored with the computer's id; device rule wins over account-wide; refusal and confirmation use the task's device.                                                                                                                                                                                                                                                                                       |
| 026           | Fixed                       | SOURCE                                                             | Remove device asks first, names the computer and says its task stops.                                                                                                                                                                                                                                                                                                                                                                             |
| 029, 052      | Fixed                       | LOCAL TEST (Windows)                                               | `requirements-agent.txt`: pinned, agent-only dependency set (donor requirements no longer the agent's).                                                                                                                                                                                                                                                                                                                                           |
| 030           | Fixed                       | LOCAL TEST (Windows)                                               | Spec bundles `actions/ocade_page.js`, egress and tray backends; `--health` imports browser runtime, gates, egress and creates a tray icon.                                                                                                                                                                                                                                                                                                        |
| 031           | Fixed                       | LOCAL TEST                                                         | Damaged identity is a distinct state: no re-enrollment over it, native message with recovery steps; metadata written atomically.                                                                                                                                                                                                                                                                                                                  |
| 032           | Fixed                       | LOCAL TEST                                                         | Uninstall asks the running agent to exit over its single-instance port and waits until it has, before revoking and deleting.                                                                                                                                                                                                                                                                                                                      |
| 034           | Fixed                       | SOURCE                                                             | Tray start failure returns the reason and writes it to the local `agent.log`; mini-control still offers STOP.                                                                                                                                                                                                                                                                                                                                     |
| 043           | Fixed                       | LOCAL TEST                                                         | Task start takes the chosen computer; with several online and none chosen, JARVIS asks the person to choose (no silent most-recent routing). Devices offers "New tasks run on this computer".                                                                                                                                                                                                                                                     |
| 005           | Fixed                       | LOCAL TEST                                                         | Offline preparation and allowance refresh start only once the tab has visited a non-JARVIS route; opening `/ocade-jarvis` directly no longer loads Offline bytes (was reproduced as repeated `/api/offline/bytes` 404s in the journey).                                                                                                                                                                                                           |
| 035           | Fixed (publication BLOCKED) | SOURCE, REAL BROWSER (journey)                                     | Popup shows the collected categories, purpose and destination before Connect; Connect disabled until "I agree"; privacy notice §9 covers JARVIS, the Device Agent and the extension (`/privacy#jarvis`); STORE.md has listing copy, privacy answers and reviewer steps. Store screenshots/tile and upload need the owner's account: BLOCKED.                                                                                                      |
| 040           | Fixed                       | LOCAL TEST (Windows)                                               | Any archive/program/permission failure during staging removes the staged build and refuses the update; tests are platform-correct (W-3 closed).                                                                                                                                                                                                                                                                                                   |
| 041           | Fixed                       | SOURCE                                                             | Voice start is transactional: ended during the permission prompt or failing to start recognition releases the microphone and audio context.                                                                                                                                                                                                                                                                                                       |
| 042           | Resolved by retirement      | SOURCE                                                             | The donor "Hey Jarvis" setup has no active caller; PC wake is reported unavailable until an OCADE "Hey OCADE" model exists (owner/model: BLOCKED).                                                                                                                                                                                                                                                                                                |
| 046           | Fixed (real macOS BLOCKED)  | SOURCE                                                             | Info.plist microphone description, audio-input entitlement; capabilities on macOS reflect Accessibility and Screen Recording grants (AXIsProcessTrusted / CGPreflightScreenCaptureAccess).                                                                                                                                                                                                                                                        |
| 049           | Mitigated                   | LOCAL TEST                                                         | Public enrollment refuses new requests (429) while 200 unapproved enrollments wait; each expires in 10 minutes. Per-IP limits need Cloudflare account rules: BLOCKED.                                                                                                                                                                                                                                                                             |
| 050           | Fixed                       | SOURCE                                                             | `GET` on `/api/jarvis/device` and `/api/jarvis/enroll` returns 405 JSON with `Allow: POST`.                                                                                                                                                                                                                                                                                                                                                       |
| 057           | Fixed                       | SOURCE                                                             | Voice input is offered when recognition exists; "Speak answers" appears only where speech output exists.                                                                                                                                                                                                                                                                                                                                          |
| W-1, W-2      | Fixed                       | REAL WINDOWS                                                       | Runtime tests are platform-correct; autostart test writes and removes the real HKCU Run value (verified absent afterwards).                                                                                                                                                                                                                                                                                                                       |
| Kill switch   | Added                       | DATABASE TEST                                                      | `JARVIS_EXECUTION_DISABLED=1` on the Worker: no device work, running actions cancelled, no task starts; Chat and answers unaffected.                                                                                                                                                                                                                                                                                                              |
| 012           | Fixed                       | LOCAL TEST                                                         | A work request with no computer online shows "Connect a computer" and "Try again" (same saved question) instead of prose only.                                                                                                                                                                                                                                                                                                                    |
| 022           | Mitigated                   | SOURCE                                                             | Failed or blocked tasks offer "Try again", which starts a fresh attempt in the same conversation; the failed attempt stays in history. Same-task idempotent retry needs a schema change (failure code, retry lease): open.                                                                                                                                                                                                                        |
| others        | Open                        | —                                                                  | 010 (model quality eval), 028 (installer/signing: owner), 044 fixed in sw.js comment, 045 (Android WASM refusal) and the company phases.                                                                                                                                                                                                                                                                                                          |

## Windows follow-ups found this run

- W-1 `test_agent::test_autostart_and_uninstall_leave_nothing_behind` fails on Windows (baseline too).
- W-2 `test_computer` workspace/apps tests assume Linux Trash/XDG.
- W-3 `test_update` assumes a POSIX executable layout.

## Browser journey evidence

- `node scripts/e2e/harness.mjs jarvis` on Windows with the real Python device runtime and Playwright Chromium: 117 PASS, 0 FAIL, 2 BLOCKED (confined terminal on this host; real speech service).

## Phase 27 UI progress (visual journey evidence)

- Visual journey (`scripts/e2e/visual-journey.mjs`): 9 screens × desktop/tablet/phone × dark/light, overflow and off-screen-control checks plus screenshots.
- Found and fixed: strong glass was 5–7% opaque, so Settings over JARVIS in light theme was illegible with the orb showing through; now frosted (84–86%).
- Found and fixed: the idle hint sat on top of the graph; removed — the idle screen is the orb and the composer. The composer placeholder wrapped and clipped at 375 px; now "Ask or tell JARVIS anything". Phones now show "N left".
- Orb core redesigned as the silver-white glass sphere the design system names (halo, specular, rim light), neutral on both themes.
- Semantic colours: blue active/enabled, green success, red destructive; one shared Settings switch (was duplicated) is blue when on; JARVIS switches use the same blue.
- Rail: Tasks merged into Conversations (each row shows its latest task and state); no duplicate history destination.
- Task card: truthful stages ("Working"), a progress bar only where a plan exists, finished tasks show the outcome not the plan.

## Tool and environment health (this host)

| Evidence class                 | State                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Playwright Chromium (bundled)  | Available; drives every journey.                                                                                    |
| Real Windows desktop           | Available; used for app launch, autostart, packaged-agent health.                                                   |
| Python device runtime          | Available (Python 3.12, pinned agent requirements installed).                                                       |
| PyInstaller Windows package    | Built; `ocade-agent.exe --health` = 0; removing `actions/ocade_page.js` makes it 1.                                 |
| Inno Setup (Windows installer) | Not installed; installing system software needs the owner's OK. Signed installer: BLOCKED (owner signing identity). |
| Android (Appium, Mobile MCP)   | BLOCKED: no device, emulator or Android SDK on this host.                                                           |
| Linux bubblewrap               | BLOCKED: no WSL or Docker on this host.                                                                             |
| macOS / iOS hardware           | BLOCKED: none available.                                                                                            |
| GitHub MCP                     | Failed to connect (authorization header); git CLI is used instead.                                                  |

## Release evidence — LIVE

- `main` = `848e27cfd4f8edadd709f81450aac05febcccd96` (merge of `jarvis/authority-repair`), pushed 2026-09-28.
- Cloudflare deployed it within ~2 minutes: `https://ocade.in/api/health` reports commit `848e27cf…`, deployment `0f82cea0-892a-421a-a6ef-4a26cb53c883`.
- LIVE HTTP: `GET /api/jarvis/device` and `/api/jarvis/enroll` → 405 JSON; `/`, `/ocade-jarvis`, `/help`, `/privacy` → 200; Help and Privacy serve the new JARVIS sections.
- LIVE REAL BROWSER (built-in browser, signed out): `/ocade-jarvis` renders the new orb and "Sign in to talk to JARVIS" with no console errors.
- No database migration was needed; Supabase and the Edge Function are unchanged.
- Signed-in production smoke needs the owner's account (Google sign-in): BLOCKED on owner.

## MCP wave 1 — 2026-09-29 (owner mandate in CLAUDE.md)

MCP health (minimal safe operation per server):

| MCP                                     | State                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| playwright-real-chrome                  | BLOCKED: needs the Playwright extension installed in the owner's Chrome profile (owner action).                                                                                             |
| chrome-devtools-real-chrome             | BLOCKED: Chrome is not running with remote debugging enabled for autoConnect (owner action: enable it in chrome://inspect).                                                                 |
| playwright-edge                         | Healthy; primary browser actor this wave.                                                                                                                                                   |
| playwright-android-mobile               | Healthy.                                                                                                                                                                                    |
| playwright-firefox                      | Navigation and scripting work; native mouse input broken (server expects Firefox 1549, only 1553 installable). Signed-in local flows ran through the repo's own Playwright Firefox instead. |
| playwright-webkit-desktop / -ios-webkit | Renders blank with a 0-width window (server expects WebKit 2365). Replaced by the repo's Playwright WebKit (2336) in `browsers-journey`.                                                    |
| physical-computer-use                   | Healthy for app windows; the notification area is not exposed, so tray tests used Windows UI Automation plus real mouse input.                                                              |
| filesystem                              | BLOCKED: its tool schema is rejected (JSON Schema dialect); file effects checked with shell reads instead.                                                                                  |
| Supabase                                | Healthy (production reads, advisors, migration apply).                                                                                                                                      |
| Cloudflare                              | Healthy (Worker `ocade-web` listed).                                                                                                                                                        |
| Sentry                                  | Connected, but the organization has no project: OCADE sends nothing to Sentry. BLOCKED until the owner creates a project/DSN.                                                               |
| Appium / Mobile MCP                     | BLOCKED: no Android SDK, emulator or device.                                                                                                                                                |

Evidence from this wave:

- EDGE (local stub): sign-in, answer, separate meter, deep link; Account B cannot open Account A's conversation ("not available") and sees an empty list.
- EDGE + REAL WINDOWS: device enrolled with matching fingerprint and approved in Edge; exactly one agent (second launch exits); exactly one tray icon; tray menu Ready/Open/STOP/Exit; tray STOP ended a running task; mini-control appears while working and its STOP works; tray Exit ends the process and frees the port; JARVIS opened Calculator after the confirmation (process verified, then closed); workspace write succeeded, `../escaped.md` and `C:/Windows/win.ini` refused, nothing written outside; screen observation and Take Over with a live frame.
- Defects found and fixed: tray status never refreshed ("Ready" while working); approval wait crashed on a network blip; a refused permit mid-task orphaned the task; no locked state at zero uses; missing meter before first use; duplicate "See plans"; Offline download started from Help; loopback CSP blocked Firefox/WebKit.
- `browsers-journey`: Chromium, Firefox, WebKit desktop, WebKit iPhone-sized, Chromium Android-sized — 50/50 PASS signed in.
- Public production pages in Firefox MCP and Android-mobile MCP: all 200, no overflow, no page errors.
- SUPABASE LIVE: RLS on every JARVIS table; migration `jarvis_execution_control` applied and verified in production (control present, running, not browser-accessible).
- Advisor note for the owner: leaked-password protection is off in Supabase Auth.
- Minor, recorded: Chromium logs a font-preload timing warning; the font loads once and is used.

## Wave 2 — 2026-09-29

Fixed and proven:

- JARVIS-022: Try again continues the same task from its checkpoint. Root cause of a failing first attempt: `send` read the render's stale (finished) task, so a resumed blocked/failed task refused its tools. The resumed task is now passed through. Real-browser check in the JARVIS journey.
- JARVIS-045: a phone that cannot allocate the Offline model is remembered per release and answers online instead of failing each message (unit test; declared as a device store in the storage gate).
- Phase 31 increment: an operator can list an account's JARVIS devices and remove one. Database function requires the admin role, a second factor and a reason; open tasks stop, queued actions are cancelled, the key is cleared, and `ocade_admin_actions` keeps an append-only record. Migration `20260929100000_admin_device_removal` applied to production and verified (RLS on, not browser-readable, not callable signed out).
- Device Agent mini-control test now runs on Windows (its skip condition was Linux-only).
- Identity gate: `CLAUDE.md` allowed (owner's MCP launch command, never shipped).

Evidence:

- All 15 browser journeys: 655 PASS, 0 FAIL, 2 BLOCKED (confined terminal on Windows; browser speech service).
- Admin journey (new, 10 checks): customer redirected from /admin; refusal without second factor shown in words; removal with second factor; phone width without overflow; key cleared server-side.
- EDGE MCP: admin Devices panel removal flow, screenshot reviewed (no overflow, clean spacing); duplicate email line removed.
- Real PostgreSQL (PGlite twin): device removal 4/4; unit suite 970 pass.
- Device Agent Python: 54 pass; real-Chromium browser control 17/17 with `OCADE_BROWSER_EXECUTABLE`; mini-control on real Windows Tk 7/7.
- `verify:full`: 15 gates pass.
- Still BLOCKED (environment): Firefox MCP native input and WebKit MCP 0×0 viewport (server browser build mismatch).

Production: merge `d8f51375` deployed; `/api/health` reports that commit. Android-sized and Edge MCP on ocade.in: six public pages 200 with no horizontal overflow, signed-out `/admin` goes to sign-in without naming the area, signed-out JARVIS asks for sign-in, no page errors.

Not done in this wave (owner decision or no hardware): staff roles beyond admin (no staff yet), payment operations (no provider chosen), scoped per-feature kill switches beyond the global JARVIS stop, Android companion.

## Wave 3 — 2026-09-29

Phases 29-31 and 34 work:

- Phase 29 (web/PWA scope): floating JARVIS bubble on phone-width screens outside the JARVIS page. Drag with edge snap and persisted placement, off-screen clamp, expand/collapse, current task with progress and Stop, an inline mini chat that runs the same JARVIS turn and saves to a real JARVIS conversation, in-bubble voice with listening/speaking status, hand-off of work requests to full JARVIS (saved once), hide with a Settings > Appearance toggle. Lazy-loaded, so desktop and signed-out first visits do not download it. A bubble over other apps needs the native Android companion (BLOCKED: no Android SDK/device).
- Phase 30 (web scope): Help explains the bubble, Home Screen use and opening JARVIS from an iPhone Shortcut. Voice auto-start from a shortcut is not claimed (needs a gesture on iOS; unverified on a real iPhone).
- Phase 31: the Device Agent and the browser extension can each be paused apart from all device work (admin role, second factor, reason, append-only record). Migration `20260929110000_scoped_jarvis_controls` applied and verified in production.
- Windows mini-control: drawn progress ring and spinner, orb core, rounded STOP, Open OCADE link, glide to the nearer edge after a drag. Rendered and exercised on real Windows (STOP invoked, hides when idle).

Bugs found and fixed:

- Words typed before the page finished loading were wiped by hydration in both Chat and JARVIS and Send stayed off (reproduced with CPU-throttled Chromium; regression check in the polish journey).
- JARVIS cleared the draft when the session arrived (signed-out to signed-in counted as switching owner).
- The bubble raised first-visit JavaScript to 978 KiB (over the 1 MB budget); now lazy, 947 KiB.
- A verification script without a catalogue check (SQL discipline test).
- Test infrastructure: on Windows the detached local servers had visible console windows, and one was stopped by a console Ctrl+C (exit 0xC000013A), failing every later journey. The windows are hidden now, the harness reports a server that exits and restarts it only after a real exit (a probe-based restart started duplicate servers that could not bind, exit 129).
- Dependabot (moderate): `undici` 7.29.0 inside `wrangler`'s local `miniflare` (development server only, not the shipped Worker). Upstream wrangler 4.143.0 still pins it; forcing 7.29.1 made the local server unstable, so it waits for an upstream release.

Evidence:

- All 16 browser journeys: 691 PASS, 0 FAIL, 2 BLOCKED (confined terminal on Windows; browser speech service). Bubble journey 23 checks, admin journey 16 checks.
- Android-sized MCP: bubble drag/snap/persist, keyboard, account isolation, Stop, mini chat screenshots reviewed.
- `verify:full`: 15 gates. Unit suite 973 pass. Device Agent Python 55 pass.
- Production: owner account `careacadane28@gmail.com` does not exist in Auth yet (owner must sign up and enroll a second factor; then one admin-role grant).

## Next step

1. After release: verify production `/api/health` reports the merged commit, then a signed-in production JARVIS smoke (owner account) and a real device connection against ocade.in.
2. Owner actions: signing identity + update release key (028), Chrome Web Store account (035 upload), Android SDK/emulator or device (Android phases), approval to install Inno Setup, a "Hey OCADE" wake model.
3. Open work: 010 eval (needs the real model), staff roles and support/payment operations in admin (owner decisions), scoped feature kill switches, billing provider (owner decision), Android companion (needs SDK/device).

---

## Owner authority reset — 2026-09-29

This ledger preserves earlier evidence exactly as historical context. The current implementation authority is now `PLAN.md` Phases 35–49.

New owner decisions:

- no active OCADE customer browser add-on dependency;
- existing browser/profile first using CDP/DevTools/Playwright where available, then accessibility/vision/PyAutoGUI;
- approximately 98% useful donor capability/logic reuse by copy/adapt/wire into `jarvis-runtime/`;
- immutable donor remains untouched;
- Windows final desktop presence is tray-only;
- Android floating bubble/deep control remains active direction;
- JARVIS is Online-only and must lock rather than use Chat Offline when Online intelligence is unavailable;
- JARVIS remains conversational while working;
- Owner/Backup Owner/Admin/Staff backend is required;
- current TOTP enrollment failure is a tracked bug;
- device removal during active action and safety-control fail-closed behavior require new adversarial proof;
- Appium + Mobile MCP Android testing is now expected because the owner installed the Android environment;
- Inno Setup is installed;
- Sentry, payment-provider work, paid leaked-password protection and public browser-store work are deferred/non-blocking;
- each phase reports evidence-based commercial-launch readiness percentage.

Historical references above to now-retired product paths, previous blocked Android setup, prior owner-account absence or prior tool configuration remain evidence of what was true in those earlier waves; they are not current product authority.

### Next step

Begin `PLAN.md` Phase 35 on the latest reconciled main. Build the donor capability ledger, re-health-check MCP/device environments, then continue Phases 36–49 without restarting already proven unrelated work.

---

## Master Phase 1–49 reset — 2026-09-29

Historical evidence above remains preserved and may contain obsolete product terms that were true at the time. It is not current product authority.

Current authority is the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude starts at Phase 1, revalidates and repairs Phases 1–34 against current main without needlessly rebuilding correct work, then continues Phases 35–49.

The former customer browser-extension requirement is superseded. Current product browser control uses the existing authorized browser/profile with CDP/Playwright/DevTools where available and accessibility/vision/PyAutoGUI fallback.

### Next step

Start Phase 1 on latest `main`, record current environment/source/deploy/database state, complete the donor capability ledger, and continue sequentially through Phase 49 while updating this ledger after every phase.

---

## Master Phase run — session of 2026-09-29 (branch `jarvis/master-phases`)

Baseline: `main` = production = `5d72f73d` (`/api/health`, deployment `3152b6cc`). Donor 58/58 hashes unchanged. Unit 974 pass / 1 skip; runtime Python 55 pass / 5 skip. Supabase migration head (source) `20260929110000_scoped_jarvis_controls`.

MCP health this session: Physical Computer Use, Mobile MCP (Pixel 7, Android 15), Chrome DevTools on the owner's real Chrome — healthy. Playwright real-Chrome MCP BLOCKED (wants its extension), Filesystem MCP BLOCKED (schema dialect), Supabase/Cloudflare MCP absent, GitHub MCP failed auth (git CLI used).

Found and fixed (root causes):

- Device removed during a running action: the agent forgot its key and exited while the action thread kept working. Now the action is cancelled and joined first, browser sessions closed, and no late result is kept (`ocade_device._halt`). Regression: `test_removing_the_device_stops_the_running_action_before_the_key_goes`.
- Unreadable execution controls counted as "not paused" (fail-open). Now device work stops and no task starts until the controls read again (`executionDisabled`). Regression in `execution-controls.test.ts`.
- Lost control channel: an action kept running with OCADE unreachable. Now cancelled after 15 s without a successful exchange. Regression: `test_losing_ocade_during_an_action_stops_it`.
- 2FA setup (owner-reported rejection of fresh codes): no QR code was shown (only a 32-character key to type by hand), each retry silently replaced the key, the app entry was named after the auth host, and every code box had `maxLength=6`, so a pasted "123 456" became "12345". Fixed: QR from Supabase, key grouped with Copy, issuer "OCADE", digits-only box without truncation (Settings, sign-in challenge, email code), fresh-key recovery after two refusals, and an "Enter your code" link when a change needs aal2.
- Talking to JARVIS while it works was impossible: `send` returned early while a turn ran, so typed or spoken "what are you doing?", "wait", "use the other file" were dropped. New `live-control.ts`: status answered at once from the real task, wait/continue pause the loop at the next safe point, redirects reach the planner as the person's words, stop stops.
- Existing browser: the tray agent never used the person's Chrome (`cdp=None`). New `ocade_existing_browser.py` finds a running Chrome/Edge/Brave through the `DevToolsActivePort` the browser writes when remote debugging is on; no add-on. Proven on the owner's running Chrome: JARVIS opened its own tab, clicked, read the result, closed only its tab.
- Windows had no commands at all ("no confined terminal"). Owner direction needs coding work on Windows: commands now run as one program without a shell, inside the workspace, with workspace-bound path arguments, secrets removed from the environment, a hidden window, whole-tree kill on STOP, and non-development programs waiting for confirmation. Linux keeps bubblewrap.
- Test infrastructure: journeys defaulted to a Linux-only browser path; the Playwright headless-shell build crashes on `/ocade-jarvis` (full Chromium does not) — harness now uses full Chromium; stub refresh tokens always returned the default account; stub had no MFA; screen tests never ran on Windows (`$DISPLAY` gate) and simulated user input with `SetCursorPos`, which fires no input hook.

Evidence: 17 browser journeys (mfa new) — 16/17 green in the full run with 865+ checks; live-talk 6/6 and MFA 24/25 (the last fixed after) on real browser + real device runtime. Runtime Python 69 pass / 3 skip (screen tests now run on real Windows). Unit 202 JARVIS/security pass.

## Master Phase run — session of 2026-09-30 (branch `jarvis/master-phases`)

Auth / 2FA (Phase 36 depth, pulled forward because privileged work depended on it):

- An enrolled account was reachable with a stolen password alone: the second-factor challenge was only a client redirect, and PostgREST/Storage/server functions accepted aal1 tokens. Now one database authority (`ocade_enforce_second_factor` as PostgREST `db_pre_request`, a restrictive Storage policy, and `requireSession` for every server function) refuses an aal1 session of an account with a verified factor. DB regressions in `second-factor-enforced.test.ts`.
- Operator RPCs checked `aal2` but not recency: a day-old second factor could still grant plans or stop JARVIS for everyone. They now also require a proof from the last ten minutes. The UI asks for it in place ("Confirm it's you": authenticator code, else an emailed code) and retries once — export, delete account, end sessions, turn off two-step, every admin mutation.
- Turning off two-step needed no fresh proof; "Use a different account" on the challenge kept the old session; sign-out ended every device's session instead of this one.

Online capacity (Phase 21):

- A key Google calls invalid (HTTP 400 `API_KEY_INVALID`) ended the request instead of failing over; a hung key held the whole 110 s budget; an abort during a retry wait escaped as an uncaught 500 without CORS; a safety-blocked prompt produced a non-retryable refusal followed by a retryable "empty answer", which JARVIS treated as an outage and re-sent for ever; the charge for a delivered answer was decided only by the browser, so a modified client could read an answer and release its permit. Fixed in `edge-handler.ts` (per-key 25 s header deadline, immediate failover on key-local 400, `content_blocked`, single refusal, server-side finalize before `final`). 5 regressions fail on the old handler.
- Resume pressed during the busy wait marked the task Working with nobody driving it; a spoken question during the wait was dropped; an allowance-check outage parked the task as "Out of JARVIS uses".

Mobile / Remote PC (Phase 22):

- A service-worker version bump deleted runtime-cached assets — the lazily loaded chunks and `wllama.wasm` — so the first visit after a deploy could leave Offline Chat unable to start offline. Runtime assets now live in a count-capped cache that survives deploys (browser-proven in the shell journey).
- The phone bubble sent a spoken "stop" to the model as a billed question; it now stops everything, and "what are you doing?", "wait" and "continue" act on the real task (bubble journey). Bubble Stop is the confirmed global STOP (all tasks, "Stopped" only once each computer confirms), shared with the page's round STOP.
- A chosen Remote PC target that was removed (or belonged to the previous account) made every task start fail; a phone watching a task it did not start refreshed every 30 s.

Security:

- Device enrollment had one global cap of 200 pending requests, which one script could fill to stop every new computer connecting. Now 5 per source (hashed client address, IPv6 /64) under a 5000 total; the source is server-only and cleared on approval (`20260930092000_enrollment_cap_per_source`).
- OCADE's last operator could delete their own account.
- Terms/Privacy described a support-ticket queue and admin support workspace that were removed (`20260912120000`); corrected.

Owner actions recorded (not executable here): apply migrations `20260930090000`, `20260930091000`, `20260930092000` and deploy `ocade-intelligence` (Supabase MCP absent); enable Supabase security-notification emails for MFA removal; publish a verified support channel on Help.

Phase 22 gap carried to Phase 43: the planning loop runs in the tab that started the turn, so a phone that is minimized long enough leaves the task waiting at its checkpoint (it resumes cleanly). A computer-held planning loop is the Phase 43 build.

### Owner / Admin / Staff (Phases 31, 36, 46) — 2026-09-30

One authority: `public.ocade_staff` (migration `20260930093000_one_staff_authority`). Roles Primary Owner, Backup Owner, Admin, Support, Billing, Operations, Read-only, each with a default permission set and per-person additions and removals. `has_role('admin')`, the support-admin check and the four operator RPCs read it; nothing on the server decides anything from `user_roles` any more (legacy `admin` rows stay inert until the console release is live — `ToRemove.md`).

Rules enforced in the database and proven against PostgreSQL (`staff-authority.test.ts`, 40 tests): access is given by email and held by the account's stable id, or waits as an invitation that one verified sign-up redeems once; removal takes effect on the next request; every change needs the permission, a second factor and a proof from the last ten minutes, and is audited; staff other than the Primary Owner read nothing without this session's second factor; the Primary Owner cannot be removed, locked out or self-deleted and hands ownership only to the Backup Owner; conversations are read only under a case (reason, ≤72 h, customer notified, each read audited); emergency sign-out ends every staff session but the caller's. Attack cases covered: direct table and RPC access as anonymous, customer and staff; AAL1; stale AAL2; self-grant and escalation by every route; replaced, withdrawn, expired and spent invitations; replays; expired cases; forged legacy admin row; rollback and re-apply.

Found while building it:

- An ended session's access token stayed valid at the database until it expired (up to an hour), so "signed out everywhere" and the staff emergency sign-out did not stop a copied token used straight against the API, and server functions verified tokens locally without asking. Fixed (`20260930092500_an_ended_session_stops_at_once`): the per-request check refuses a token whose session is gone (HTTP 401), Storage has the same rule, staff checks require a live session, and `requireSession` asks the database on every call (5 s cache).
- Older RLS policies let an Admin read every profile and usage row through `has_role` with a password alone. `has_role('admin')` now needs this session's second factor for everybody but the Primary Owner.
- An unused policy let a browser session read every account's manual grants; dropped (also the advisor's duplicate-policy warning).
- Closing a case with a short reason surfaced a raw constraint error.
- The test backend answered every `count` query with nothing, so count-based logic (the enrollment cap, system health) was never exercised in a browser; it counts now.

Browser proof: admin journey 52 checks (customer, Admin without and with a second factor on a phone-sized screen, Support, Owner: grant, invitation, removal, permission change, case open/read/close, audit, emergency sign-out, copied token refused).

Supabase advisor review (production, 2026-09-30): 13 definer functions callable by signed-in users — each inspected live: pinned search path, not callable anonymously, every statement scoped to `auth.uid()`; the five operator RPCs add role, second factor and recency. Accepted as intended. 10 RLS tables without policies hold no grants at all for `anon`/`authenticated`: intended, server-only. Unindexed foreign keys on `ocade_service_controls.changed_by` (3 rows) and `ocade_service_control_events.changed_by` (operator events): no query or delete path justifies an index yet. Leaked-password protection is a paid feature: not a blocker.

#### Production database — staff authority deployed 2026-09-30

Applied through the Supabase connector, each in one all-or-nothing call that runs the migration, its verification script and the history record together (the connector runs a multi-statement call as one transaction; proven first with a probe that created a table and then failed — the table did not survive):

| Version          | Name                              | Live evidence                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20260930092500` | `an_ended_session_stops_at_once`  | A real live session served; the same account with an unknown session refused `PT401`; anonymous served                                                                                                                                                                                                                                                                   |
| `20260930093000` | `one_staff_authority`             | One staff row: the previous sole admin is Primary Owner. Owner with password only: reads, every change refused for the authenticator code; with an hour-old proof: refused; a customer with a fresh second factor: not staff, no matrix, table `42501`, grant "Not found", stop refused, sees only their own profile; anonymous `42501` over real HTTP on table and RPCs |
| `20260930093500` | `a_staff_refusal_reads_correctly` | Live sentence: "Confirm it is you before making this change."                                                                                                                                                                                                                                                                                                            |

All 29 function bodies on production hash identically to the repository files. The live site (`main`, `5d72f73d`, deployment `3152b6cc`) answers 200 on `/`, `/ocade-jarvis`, `/api/health` after the change; it keeps working against the new database because the legacy `user_roles` admin row was left in place and `has_role` answers from the staff table.

Advisor after deployment: 26 definer functions callable by signed-in users (13 existing, 13 staff RPCs) and 13 RLS tables without policies (10 existing, 3 staff tables, none with any client grant). All intended; every staff RPC's refusals are regression-tested. Leaked-password protection remains a paid feature.

Still to do when the console release reaches production: remove the inert legacy admin rows (`ToRemove.md`).

#### Two-step recovery — 2026-09-30

Recovery codes restored (they had been deleted because nothing issued them): ten 100-bit codes made and shown once when two-step is turned on; "I lost my authenticator" on the code screen redeems one, which removes the factor and ends every session and signs nobody in. The database holds only SHA-256 hashes, so no server secret is needed. Operators with `sessions.manage` can turn off a customer's two-step when the codes are lost too (`20260930094000_staff_can_turn_off_a_lost_second_factor`, applied to production with its verification in the same transaction; live function body hashes identically to the repository). Proof: mfa journey 40 checks, admin journey 55, unit and PostgreSQL tests 1101.

### Windows Device Agent: delivery, updates and lifecycle (Phase 39) — 2026-09-30

Delivery: `packaging/release.py` builds the program archive, the one-click installer (Inno Setup, per-user, no administrator prompt) and an Ed25519-signed manifest, and publishes them to the private bucket's `agent/` prefix; the site serves only those checked names (`/agent/$file`) and the JARVIS Devices panel offers the installer only when one is really published. The release key lives outside the repository on the owner's computer; its public half is pinned in `ocade_update.py`.

Updates: checked at start, every six hours and when OCADE says the build is too old; never while a task runs; the new build starts only after two idle minutes. Signature, SHA-256 and a real `--health` start are required before anything switches; the installed build is never removed; a build that fails two starts, or whose program is missing or unrunnable, is rolled back and not fetched again until a newer one exists. A laptop that logs in offline no longer rolls a good build back.

Found by installing it for real on this computer (`tests/manual_installed_lifecycle.py`, 28 checks, all passing at the end):

- No installed agent could ever start an update. The hand-over to the newer build used `os.execv`, which on Windows starts a new process from an unquoted command line: the space in `...\OCADE\Device Agent\...` cut the program path in two and the newer build ended at once, silently. Earlier proofs ran from a folder without a space. Now a properly quoted start (`_become`), with a regression that hands over for real through a folder with a space.
- An agent still waiting to be connected had no tray icon and did not answer "exit": uninstalling left it running and starting at every login, with no entry left in Windows to remove it. It is OCADE's one tray icon from the first moment (Waiting to be connected / Offline / Not connected, Connect this computer, Exit), "exit" is answered from the start, the login entry is removed first, and an agent that does not answer is ended. First start without a network waits quietly instead of failing.
- A release labelled with the version already running was reinstalled on every check.

Real evidence on this Windows 11 computer: silent install, login entry, Windows app entry, running at once; approved from a signed-in browser; second start leaves one agent; update 0.3.0 to 0.3.1 fetched from the local site's real route, installed while idle, restarted into, same identity kept; newer program removed, next start runs the older build and the release is not fetched again; uninstall removes program, login entry, key and revokes it in OCADE; reinstall; uninstall while waiting to be connected; uninstall of a frozen agent. Notification area read through UI Automation: exactly one icon, "OCADE JARVIS · Ready", menu Ready / Open OCADE JARVIS / STOP JARVIS / Choose work folder... / Exit. Idle: 0.03% processor, 47 MB private memory, no disk writes.

Donor (Phase 37): `computer_settings`, `system_monitor` and `undo` adapted (`ocade_settings.py`, `ocade_computer` `undo`): volume, mute, brightness and dark mode through the system's own interfaces and read back after every change; a system snapshot; a ten-deep reversal list for file writes (an overwrite now keeps the previous file first), folders, moves, renames, copies and workbook/document edits, which never overwrites what appeared since.

Not executable here: a public installer needs the owner's Windows code-signing certificate (unsigned builds are private test artifacts and SmartScreen warns on them); the release key must be backed up by the owner; macOS packaging is unbuilt (no Apple hardware).

### The computer carries on (Phase 43, and the Phase 22 gap) — 2026-09-30

Before: the planning loop lived in the surface that started the task, so a locked phone or a closed tab left the task waiting at its checkpoint until someone came back.

Now, with Background Mode on for the task's computer, the computer asks OCADE for each next step (`/api/jarvis/continue`, signed with its device key). OCADE plans exactly one step from what the database holds (the conversation, every action of the task and its result) and queues it through the same `queueTaskAction` a tab uses, so permissions, Allowed Apps and confirmations are decided in one place and checked again at dispatch. The loop's lease is the task's `controller`: the computer's id while it holds the loop; a surface that speaks again takes it back and the computer stops at its next write. Deletions, system changes, human checks and questions wait for the person, who is notified. Runaway plans stop at 60 actions. Each step is a billed permit on the `jarvis` surface, charged only when something was delivered.

Model steps for a person who is not there go through a second Edge Function, `ocade-intelligence-service` (platform JWT check off; the handler accepts only a project server key plus the person's id, only for JARVIS, and still claims that person's permit). The browser function is unchanged and keeps the platform JWT check; both share `supabase/functions/_shared/boundary.ts`.

A question about a task driven elsewhere ("what are you doing?") is answered from the task's real state without a model call and without taking the loop over; "stop" and "wait" act on it.

Task changes and the action queue moved into one module (`task-authority.server.ts`) used by the server functions and the computer-held loop.

Proof: PostgreSQL tests 17 (`carry-on.test.ts`: which task may be continued, lease, other devices and accounts, STOP and take-back mid-plan, confirmation, refused permission, invalid action, human check, question, no use, busy, runaway, emergency stop, JARVIS off); handler tests for the server door (wrong key, no key, session token, chat surface, refused permit); runtime tests for the device side; browser journey `carry-on` 24 checks with the real device runtime (tab closed mid-task, computer finishes and writes the file, notification, reopened on a phone; deletion waits; status question costs nothing and takes nothing; STOP from a phone cancels the computer's running step). Unit + database 1128 passed / 1 skipped; runtime 124 passed / 3 skipped; journeys jarvis, bubble, carry-on, online, chat passed.

Release step (with the code release, not before): deploy `ocade-intelligence-service` with `verify_jwt = false` (it reads the same project secrets as `ocade-intelligence`).
