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

### Reminders, scheduled work and JARVIS data rights (Phase 43, Phase 9) — 2026-09-30

The donor's reminder, background monitor and proactive rules had no active replacement: the "OCADE automations" the donor ledger pointed to were removed on 2026-09-12. Now one schedule table (`jarvis_schedules`, migration `20260930095000`) and OCADE's clock (the Worker's cron, every minute) cover them. A reminder is notified and said in its conversation. Scheduled work starts a task on the computer the person chose, which then carries it on; it starts only with Background Mode and Scheduled work (a new per-computer switch, the class of proactive behaviour the person authorizes) on, the computer online and not busy, JARVIS on and OCADE's emergency stop off, and every refusal is told to the person. Repeats keep the person's wall-clock time across clock changes; runs missed while OCADE was down are skipped, never replayed; each run is claimed once. JARVIS is told the time in the person's own zone. Nothing a page, a file or a result says can schedule anything (the tool is refused once untrusted content was read, and is not offered to the computer-held loop).

Found: the account export and per-class deletion covered none of JARVIS (tasks, activity, memories, schedules, permissions, computers). A "JARVIS" data class now does, with a regression that every `jarvis_` table an account owns is exported.

Production: `20260930095000_jarvis_schedules` applied with its verification in one transaction and recorded (RLS on, read and remove own only, no client insert or update). Security advisor after: no new finding.

Proof: schedule time 4 tests (clock change, weekdays, weekly, missed runs); PostgreSQL 8 (`schedules.test.ts`); agent test for the untrusted-content refusal and the time in the prompt; carry-on journey 33 checks including reminder listed, notified, said, not repeated, scheduled work refused until allowed then started on time and finished on the computer with nobody watching, and removal from a phone.

### OCADE for Android (Phases 29 and 44) — 2026-10-01

There was no Android app: the "installed OCADE experience" was the website's phone layout. Now `android/` builds a native app with the SDK's own tools (`python android/build.py`, no Gradle, no libraries): the phone becomes a JARVIS device of its own kind with a P-256 key made and kept in Android's key store, the same signed protocol file as the Device Agent, and a one-click approval in OCADE that shows the same fingerprint as the phone. It carries the floating OCADE bubble (task, STOP JARVIS, Talk, Open JARVIS; drag and edge snap, kept on screen after rotation, folded when JARVIS opens), a foreground notification with STOP JARVIS, and JARVIS work through Android's own interfaces in the fixed order: apps by their launcher, then an app's controls by ref through the accessibility service, then the screen (screenshot, then a tap or swipe only against that screenshot). Conversations stay in OCADE in the person's browser. The server accepts the `android` kind (`20260930096000_android_devices`, applied to production and recorded), offers a phone for work only when the person chose it or when it is the only device, and shows its own switches (no browser ones).

Setup is one guided walk-through of Android's own screens (notifications, display over other apps, accessibility), each shown by Android, each asked once per walk-through; a decline is said plainly and the rest carry on; after two noes Android's own notification page for OCADE is opened instead of a request Android would refuse unseen.

Found and fixed while testing on the emulators: the page ran under the action bar (edge to edge); the walk-through advanced twice per answer and skipped a screen unseen; a declined permission could loop; a permanently declined one stalled the walk-through; the fingerprint vanished a second after connecting; the bubble's panel was squeezed to the bubble's width; the bubble ignored TalkBack's double-tap (click only through touch).

Evidence (Android 14, Pixel 6a emulator; the Pixel 7 Android 15 emulator hung twice and was replaced by the owner's new AVD during the run): Appium journey `scripts/e2e/android-journey.mjs` 23 checks passing, and 23 with `--decline`; an independent Mobile MCP pass after Appium was released (decline twice and recover through Android's settings, connect, bubble panel from both edges, drag and snap, rotation, Open JARVIS, STOP JARVIS Stopping then Ready, the notification with STOP JARVIS). JARVIS opened Settings on the phone through its launcher and read its controls through accessibility, from a web conversation.

Not executable here: a Play Store release (the owner's Play account and release signing key), physical phones, voice wake on Android, share targets and Android file access (not built: the phone offers apps, accessibility and screen only).

### The consoles on their own origin: admin.ocade.in (Phase 46) — 2026-10-01

Before: the Owner and Staff Consoles were `/admin` on `ocade.in`, and every session of a staff account — including the one that renders chat answers and web pages — carried the account's whole staff authority. A token lifted from the customer site could go straight to the privileged RPCs.

Now `admin.ocade.in` (`admin.` in front of the site host; `admin.localhost` locally) serves only the console, its way in, its code prompt, server calls and static files; the Worker sends every other path to the same address on the site, and the router holds client-side navigation to the same rule (no Chat, JARVIS, Library, bubble or service worker there). The account menu's Owner/Staff Console asks the server for a one-time sign-in for the same account; the console's server redeems it (only on the console origin) into a new session and records it in `public.ocade_console_sessions`. Staff authority belongs only to such a session (`private.ocade_caller_in_console()` inside `ocade_staff_has`, `has_role('admin')` and the support-admin check — migration `20261001090000`), and that session answers its own second factor before anything opens. The console header shows whose account it is; "Sign out of the console" ends only the console's session and returns to the site.

Found on the way:

- A signed-in person who opened `/auth` fresh (a bookmark, a return from the console) was shown the sign-in form: the page is rendered on the server, which has no session, and the browser does not run `beforeLoad` again when it takes over. Fixed with a mount check; regression in the auth journey.
- Four release gates had gone red unnoticed: nine admin reads the bounded-read gate could not see were bounded (now explicit), a conversation button in the case view showed its selection only by colour (now `aria-pressed`), the Worker imported the whole Edge Function handler for one header name (moved to the shared contract), and the reachability exemption for it had gone stale.

Local evidence: PostgreSQL `console-sessions.test.ts` 7 (site session refused even at aal2, console session allowed, older policies follow, console needs its own factor, no browser can record a session, another account's console session is not yours, ending the session ends the record, rollback and reapply); `console-host.test.ts` 5; admin journey with the handoff, a real TOTP challenge on the console origin, the one-time way in refused a second time, customer paths sent to the site, sign-out; auth journey 21.

Release steps (not before the code release): apply `20261001090000` right after the deploy (it makes the old live admin screen's site session a customer session); the deploy creates the `admin.ocade.in` custom domain. No Supabase redirect-URL change is needed: the handoff involves no redirect.

### Apple-supported paths (Phase 45) — 2026-10-01

Evidence is WebKit on Windows (Safari's engine) with iPhone and iPad profiles: compatibility, never physical Apple proof.

Found and fixed:

- Safari dropped a link's query on the first visit in a tab. The one-time isolation reload went to the path alone, and WebKit (no `credentialless` COEP) always takes that reload, so `/ocade-jarvis?connect=…` (approving a computer), `?c=` and `?ask=` arrived bare. It reloads the same address now; browsers journey check fails on WebKit desktop and iPhone without the fix.
- Offline, the service worker answered an uncached page with Chat's document: `/auth` showed Chat and failed to hydrate (React #418), seen on WebKit when the network dropped mid-navigation. It serves the page as last seen, else the offline page; the offline page's link pointed at the removed `/ocade` and opens Chat now. Chat's offline check left an unhandled rejection when its own code was not on the device. Shell journey covers both.

Added: Shortcuts/Siri path — `ocade.in/ocade-jarvis?voice=1` starts listening, `?ask=…` puts words in the box and never sends them (a link is not the person asking); Help says how. Home-screen name `OCADE` from any page; manifest `id`.

Checked: public pages, sign-in by code, Chat, JARVIS and Help on WebKit iPhone and iPad — no console errors, no sideways scroll, 16px fields (no zoom on focus), manifest standalone, apple-touch-icon, service worker active; sign-in crossing into the isolated app works on WebKit. The Playwright iPad MCP loses its page when a click causes the cross-origin-isolation browsing-context switch (a tool limit: the same flow scripted with `noWaitAfter` passes on the same engine).

BLOCKED (hardware/accounts): physical iPhone/iPad/Mac evidence; macOS Device Agent and menu-bar build (needs a Mac and an Apple Developer ID for signing and notarization); no paid remote Apple device was reserved. Not built: Web Push (a closed OCADE on a phone learns of a waiting task only when it is opened again).

### Browser notifications: Web Push (Phases 43 and 45) — 2026-10-01

Before: notifications were rows shown inside OCADE only, so a reminder, a finished or waiting JARVIS task, or a security alert reached nobody while OCADE was closed (the phone gap recorded in Phase 45).

Now each browser can turn notifications on in Settings › Notifications › "On this device" (the browser's own permission, never bypassed; on iPhone/iPad Apple allows it only for OCADE opened from the Home Screen, and Settings says so). The browser's push address is kept per account (`ocade_push_subscriptions`, migration `20261001091000`: written only through `ocade_push_subscribe`, which checks the address and keys; read only by the server; moves to whoever signs in on that browser; twenty per person; deleted with the account; exported under "Devices and grants"). Every notification OCADE records is also encrypted to each of the person's browsers (RFC 8291 `aes128gcm`, WebCrypto only) and signed for by OCADE's key (VAPID, RFC 8292), sent only to the browsers' own push services (Google, Mozilla, Apple, Windows), retried three times, and a browser the service no longer has is forgotten; the notification's delivery says what happened (`ocade_set_notification_delivery`, server only). Security alerts are urgent and always go; optional kinds go when on. The service worker always shows something, opens only OCADE paths, and tags by notification so a resend replaces. Signing out or switching account forgets the subscription in that browser.

Found on the way: two security notifications linked to `/settings/security`, a page that has never existed (settings is a panel) — any page now opens Settings with `?settings=<section>`, and a test checks every notification link opens a real page; the Connect card called a phone a computer; Settings listed unavailable channels from a list that only held available ones (the explanation never showed); a stale comment and test still said recovery codes did not exist.

Evidence: the RFC 8291 worked example reproduced byte for byte; an independent Node decryption reads what was sent and a different key cannot; VAPID JWT verified with Node; PostgreSQL 8 (`push-subscriptions.test.ts`); push journey 15 checks (Settings link and toggle, a stand-in browser receives and decrypts the security alert for a newly connected computer, urgency and VAPID header, a gone browser is forgotten, delivery recorded, the service worker shows it with its tag through Chromium's push-delivery hook, an off-site link opens OCADE, an empty push still shows). Real push service: Firefox subscribed through OCADE's own toggle with Mozilla's service, and Mozilla accepted OCADE's signed, encrypted message (delivery `sent`). Display on a normally started browser is not yet seen: browsers launched by automation either have no push service (Chrome) or did not surface the notification (Firefox); the owner's Chrome asked for remote-debugging consent, which was not given on the owner's behalf.

Release steps: build with `VITE_WEB_PUSH_PUBLIC_KEY` and set the Worker secret `WEB_PUSH_PRIVATE_KEY` from `%USERPROFILE%\.ocade-release\web-push.json` (made on this computer, never committed; back it up); apply `20261001091000`. Without them the channel stays honestly "not configured" and nothing breaks.

### Independent attack review of the new surfaces, and fixes — 2026-10-01

A separate read-only reviewer attacked the console handoff, Web Push, the service worker and the new links. Confirmed and fixed:

- **Major — a session planted in the console's address.** The browser client used the implicit flow, which takes tokens from any address's fragment. With script on ocade.in, an attacker could mint a console session through the handoff, send the staff member to `admin.ocade.in/admin#access_token=…`, let them answer their own code into it, and keep the upgraded session. Now the client uses PKCE (Google answers with a code only the browser that started can exchange) and never takes a session from an address on the console. The same change closes sign-in by link on the site (`ocade.in/#access_token=…` signed the visitor into the link author's account). Regressions: auth journey (Google through PKCE lands signed in; a link carrying another account's tokens signs nobody in), admin journey (a session in the console's address is never taken up). The stub now plays Google's PKCE exchange.
- **Major — notifications outliving a revoked session.** A browser kept showing reminders and task titles after "sign out everywhere". Subscriptions now belong to the session that made them and go with it (`20261001093000`, applied to production and hash-verified); an address moves to another account only when the same browser presents it (the same keys).
- Minor: `/admin` on the site minted a way in on load, so any link could spend it — the console now opens on a press (one press from the account menu); `openConsole` checks the minted account is the caller's. Pushes retried errors that never pass and followed redirects — now only 429/5xx are retried, no redirects, a browser refused five times is forgotten, the message is capped. `?ask=` arrives as one visible line (≤1000 characters). The service worker kept one cached copy per address (one per conversation and per Shortcut's words) — it keeps one per page now. The push handler's link check is the URL parser's.
- Noted, by design: the Primary Owner before enrolling a factor may look at the console (bootstrap rule), as before the move; `?voice=1` starts listening when microphone permission was granted earlier (it is how "Hey OCADE" opens JARVIS).

### The browser extension is retired (Phase 48) — 2026-10-01

Replacement proven before removal (see ToRemove.md): the Device Agent drives the person's own Chrome through Chrome's own remote debugging, with no add-on, covered in the jarvis journey ("the task ran in the person's own browser … in a tab of its own"). Removed `extension/`, the `extension` device kind and protocol entry, its stop (now the phones' own stop, which they lacked: `jarvis_android`, migration `20261001092000`, applied with the release), the extension's branches in JARVIS Devices, the Connect card and the console, its Help answer (now "Can JARVIS work in my own browser?") and the Privacy wording (now the Device Agent and the OCADE app). Production had no extension device.

### Whole-product proof and leaner runtime (Phases 47–48) — 2026-10-01

- Inventory: `docs/CONTROL_INVENTORY.md` maps every route and meaningful control to the journey that presses it. Gaps found and closed with a new `controls` journey (appearance across reload and devices, a notification kind, the export download read back, one other session signed out from Settings and its copied token refused, an email change, sign-out) — 15 checks.
- Bugs it found: Account showed the sign-in form three times after an email change (two siblings shared a React key; every account update duplicated them) and the change looked stuck on "Sending…"; an aal1 answer cached for a session could be reused for the same session's aal2 token issued in the same second (the console bounced to `/` right after the code — a flake, now a regression test); "Failed to fetch" reached the person verbatim; the brand mark's label was on a plain span (not read). The stand-in Supabase now models real sessions (one per sign-in, the one asking spared) and allows `PUT /user`.
- Lighthouse (local production build, mobile preset): Chat 79/100/100/100 (performance/accessibility/best-practices/SEO, LCP 4.0 s simulated 4G, 407 KiB), JARVIS 85/100/100/100, Help 89/100/100/100, sign-in 92/100/100 (SEO 66 because it is `noindex` on purpose). Performance headroom remains (127 KiB unused JS on Chat).
- React development build crawled signed out and in (every page, every settings section, every JARVIS panel): no warnings or page errors.
- Android: Appium journey 23/23 on the phone and 23/23 at tablet size (1600×2560, 320 dpi); an Android 15 tablet AVD booted but its software GPU starved the system UI (ANR) on this computer, so tablet evidence is the phone emulator at tablet size. Independent Mobile MCP pass afterwards: fresh install state, three permissions named "not allowed yet", the three actions.
- Phase 48: the donor files copied into `jarvis-runtime` that nothing ran are removed (19 actions, `core/` with the last provider-key reader and the plugin loader, `memory/`, `dashboard/`, `plugins/`, the donor's broad requirements and setup) — 14,611 lines; the browser extension retired (above); an unused Android helper. Runtime tests 124 passed, health check passes, APK builds.

### Second independent attack audit — 2026-10-01

Three read-only reviewers (database authority and auth; Device Agent and Android; web client and Worker) attacked the whole product as if they had not built it. Every finding was reproduced or reasoned from the code, fixed at its root, and given a regression.

Critical:

- **Answers were free to anyone who released their permit while it streamed.** The browser could release a permit the Edge boundary had claimed, and the boundary's charge at the end then found it released. `20261001094000` refuses a browser release once the transport is claimed; the boundary settles every claimed permit itself however the stream ends (charged once anything arrived, a Stop or dropped connection included; given back when nothing did). Edge-handler tests (stopped part-way is charged and never released; nothing arrived is released) and PostgreSQL (`ledger-against-postgres`).
- **"Running commands" ran any code unasked.** `python`, `node`, `npx` and others were on a no-confirmation list matched by file name. Every command is now shown whole (≤280 characters) and confirmed; the exact command allowed earlier in the same task runs again unasked; publish/install/destroy asks every time; the Device Agent refuses an unconfirmed command itself. Office journey (real repo fix: two asks, the test re-run not asked), carry-on journey (confirmed in the tab, re-run by the computer away), jarvis journey, carry-on PostgreSQL test.

Major:

- An answer's Markdown image was fetched as it rendered (data out through the address a page or file chose). Images render as their words; `img-src` no longer allows other hosts. Chat journey (no request leaves), CSP test.
- A stolen aal2 token could enroll its own authenticator, answer it, and so get fresh proof for staff changes and high-risk actions, and open the console. A factor proves nothing to a session it is newer than (`20261001095000`, applied to production); the console's hand-over refuses a site session anything was enrolled in since it began, and a console session loses staff authority if a newer factor appears (`20261001095100`). PostgreSQL test, admin journey (the session two-step was set up in must sign in again).
- A phishing link could connect an attacker's computer to the victim's account; a stolen session could attach a device that survives "sign out everywhere". Approval needs recent proof, and from another network than the device's it needs the fingerprint the device shows, typed (none is shown to copy); declining deletes only from the device's network. Jarvis journey (other network: no fingerprint, wrong one refused, the device's own typed connects), push journey.
- STOP or Pause during an exchange let the command in its reply start (agent and Android): never starts now, reported as stopped (runtime test).
- Coordinate clicks and typing skipped the payment/sensitive/password rules (Windows and Android): the control under the point is checked the same way (real UI Automation probe window).
- Folder copies followed links out of the workspace; a Downloads link sent downloads elsewhere (real junction test). Office files opened by JARVIS run no macros. Uploads of work-folder files wait for the person. The private-network boundary now covers every tab JARVIS works in, popups, and the person's tab it switched to (test fails without the fix).

Minor, fixed: a lost key-rotation answer stranded the device (same key offered again); any local process could end the agent through its exit port (a per-account secret); NAT64 and CGNAT addresses read as public; release Android builds had a plain-HTTP exception; a bubble question could cross an account switch; any user could delete a pending enrollment by id; staff could act on each other (a colleague is an owner's to act on, nobody gives access they lack — `20261001096000`, applied); the console showed a self-editable profile address (`20261001096100`, applied: it follows the sign-in address); a recovery code worked on a signed-out session; listing a case's conversations was not audited.

Accepted, documented: `script-src 'unsafe-inline'` (TanStack Start's inline bootstrapping; no injection point found); the offline model is for any signed-in account, a signed link lasts six hours, and offline use is counted on the device (a design limit of local inference); the account's own JARVIS task and permission rows are writable by that account (the device exchange re-checks everything); a removal waits ten seconds for an uninterruptible file operation before the key goes; staff invitations trust the address Supabase Auth confirms (owner: keep "Confirm email" on, and turn off password sign-ups if they are not needed); a stolen aal2 token can still remove the real factor through Supabase Auth directly (Supabase Auth's own rule for an aal2 session).

Found while proving the fixes: the factor rule refused the recovery codes made the moment two-step is turned on (MFA journey) — a session whose every factor is newer than it set two-step up itself, so its codes are made (`20261001095200`, applied); with an older factor present, replacing the codes still needs a new sign-in. On Android: the phone now states its fingerprint for either approval path; reading a just-opened app waits for its window; a control whose accessibility click is refused is tapped at its centre after the same rules. Evidence: Appium journey 24/24 allowed and 24/24 declined on the Pixel 6a emulator (Android 14), then an independent Mobile MCP pass on the fresh install. The emulator needed a reboot after nineteen hours (its UiAutomation was stuck and System UI stopped answering), which was an emulator state, not the app.

## Owner addendum run — 2026-10-02 (branch `jarvis/master-phases`)

The owner's 2026-10-02 addendum (`PLAN.md`, `AGENTS.md`, `CLAUDE.md`, `ToRemove.md`, committed unchanged in `a0344857`) reorders the end of the mission: finish the addendum's implementation (universal execution engine, bundled wake model, Owner Console expansion, discovery, cross-device routing), then a source-read audit, a frozen testing-only matrix, one fix wave, cleanup, the full matrix again, a second attack pass and the final real-user pass on the preview. The real-user pass started on 2026-10-01 is therefore paused; what it found is fixed below.

### Caveman Ultra / Ponytail Ultra inspection — 2026-10-02

Three read-only reviewers audited `src/`, `jarvis-runtime/`, `scripts/`, `android/` and `supabase/functions` for over-engineering. Nothing was removed: per `ToRemove.md` the cuts wait for the cleanup wave after the frozen matrix. Candidates, biggest first (about −6,300 lines and a 51.7 MB tracked binary):

- `jarvis-runtime/actions/browser_control.py` donor "native" launch mode, per-OS browser maps and the old session registry (~−940; only `_BrowserSession` isolated/real is used).
- Tracked `jarvis-runtime/packaging/windows/Output/OCADE-Device-Agent-0.2.0-Setup.exe` (51.7 MB, stale 0.2.0): untrack and ignore `Output/`.
- e2e: the stub's hand-written SQL mirror (~~−700, serve REST/RPC from the PGlite `DatabaseTwin`), helpers repeated across 25 journeys (~~−550, one `scripts/e2e/lib.mjs`), dead `DatabaseTwin.plantRow` family (~~−480), regex accessibility checker (~~−350, `eslint-plugin-jsx-a11y`), `live-usage-journey.mjs` with no caller (owner to confirm), `measure-loc.mjs`, 11 `audit:*` aliases.
- Excel/Word adapters (~−660 + tests): `ocade_excel.ps1`, `ocade_word.ps1`, `ocade_sheets` edit engines, `ocade_documents.edit_word`. Retire only after the universal engine (model-written script through the broker + read-back) is measured equal — addendum rule.
- Web: the TypeScript copy of the allowance gate (~~−340, production uses only the Postgres permit RPCs), unused Offline-engine interface fields (~~−150), install telemetry that is never wired (~~−145), unused router methods (~~−100), a second account-data deletion path nothing calls (~~−78), multi-source download (~~−60), test-only helpers (clock formatters, notification delivery, recovery-code format, `proveIdentityWithPassword`), the never-sendable email channel, `ffprobe-static.d.ts`, the WebLLM Nitro alias, three copies of the Supabase fetch helper, nine base64 helpers, two speech-recognition setups, the bubble's copy of the JARVIS turn flow.
- Runtime: Linux desktop branches (no Linux build ships), donor `.gitignore`, `config/__init__.py`, the wake download leftover (`ocade_wake.install`), duplicate Office job runner, gate patterns loaded three times, six temp-file writes, `connect_with_tray`'s own tray.
- Android: protocol asset parsed twice, `dp()`/`button()` copies, dead parameters; shared constants into `ocade_protocol.json`.

### Source-read audit findings fixed — 2026-10-02

- **Major — coordinate clicks were never checked.** `Computer._gate` passed float desktop points to UI Automation, which refused them; the refusal read as "unreadable" and every coordinate click and drag went ahead without the payment/sensitive rules. Points are whole pixels now (real Windows Forms probe: a click and a drop on "Pay now" are blocked).
- **Major — Enter or Space pressed a payment control unchecked** (desktop keys, typed newlines, browser `press`). They are checked like a click on the focused control; a drag is checked at its drop point too (real probe window; real Chromium page).
- Major — `open_app`, window changes and Office edits did not wait after the person's own mouse or keyboard; now they do, as screen input did. STOP did not reach file search, folder copy, control inspection or the 30-second app-list wait; now it does, and a stopped copy goes to the Trash.
- Major — the offline clock's rollback defence was off: the high-water mark was read but never written, so a clock set back inside an expired lease revived it. Read and recorded in one step now (regression).
- Minor — the preview pass showed a chat answer twice until its usage settled (the streamed copy stayed beside the saved reply); fixed and proved with a slow-settlement stub (chat journey fails without the fix). `jarvis.functions` read permissions without a user filter (RLS only); now the one scoped read. The bubble resent at once into an unavailable JARVIS; it now waits like the full page.
- Preview findings judged correct behaviour: `register_browser_device_for_current_user` answering 400 "device cap" for an account that already has two desktop browsers (Settings explains it); the offline model preparing itself on a visit (designed; a browser refused an offline allowance still prepares it — Minor, open for decision).

### Addendum implementation — 2026-10-02

- **Universal engine** (`efb71ea3`): `app_info` describes any installed app from the computer itself — program, version, registered COM automation, file types and link schemes it opens, scripting/SDK/plugin folders beside it or under the vendor's ProgramData/AppData path (proved on this computer: Excel.Application, Word.Application, DaVinci Resolve's `Support/Developer/Scripting`, VLC's Lua extensions, Store apps through their package manifest). `recipe_save` keeps what worked on that computer only, refusing coordinates, personal paths, addresses, codes and secrets; a new major version hides older recipes. `drives`, `file_locate` (names, sizes and dates only), `file_import` (a copy in) and `file_export` (a finished copy beside the original, never over a file) — the last two confirmed. `docs` reads a public https page on the server (re-checked on every redirect; no private names or addresses) and is recorded on the task. The planner prompt: `app_info` first for any app, strongest route first, docs when knowledge may be stale, recipes after success, completed copies by default, one short question with likely choices only when the choice matters.
- **Routine work without nuisance prompts** (owner policy): one shared rule set in `ocade_protocol.json` decides on the server and again on the device — the task's own builds, tests, scripts and git reads run unasked; shells, installs, network tools, publishing and destroying history ask every time; after a task read a web page or documentation, a script is asked once. 37 shared cases run in both test suites; office, carry-on and jarvis journeys updated (the test re-run and git read are no longer questions).
- **Owner Console** (`e1cbff30`): give back usage through an append-only record, suspend/restore an account (Supabase Auth ban, every session ended, devices disconnected, open and scheduled JARVIS work stopped), and an owner-only audited deletion (the account's own address typed exactly; it is stopped first, then the same erasure the customer's own deletion uses). Migration `20261002090000` is NOT applied to production yet (additive; apply with the release).
- **Where the person is** (`82a08e62`): the OCADE app opens JARVIS with the phone's device id; app work asked from the phone runs on the phone; "on my PC" (`start_task on: computer`) goes to the paired computer in the same conversation.
- **Own browser** (`ef88a5ca`): when the browser does not yet allow JARVIS, the agent opens the browser's own permission page and hands over with plain words; Continue resumes. Help updated. (Chrome's "allow for this browser instance" lasts until Chrome restarts — a Chrome-owned boundary; each restart asks once.)
- **Protected apps** (`26c221aa`): password managers, credential prompts and Windows Security are never read or operated (UI Automation inspect/act, coordinates, keys).
