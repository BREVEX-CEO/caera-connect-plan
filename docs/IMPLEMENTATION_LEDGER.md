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
