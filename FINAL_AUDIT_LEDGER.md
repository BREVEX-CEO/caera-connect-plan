> Historical evidence only: this document describes its original snapshot and is not current implementation authority. Read [PLAN](PLAN.md) for current work. Old PASS labels, phase instructions and platform claims require current reproduction; original content is retained below.

# OCADE / OCADE JARVIS — Final Audit Ledger

Date: 2026-10-03. Branch `jarvis/master-phases`, head `9f648a1e` before this ledger (95 commits ahead of `main` = `5d72f73d`, which is what production runs). Written on owner instruction to stop all product work: this is a read-only audit of the tree and of the evidence already collected. No test was run and nothing was fixed while writing it.

Status words: **COMPLETE** (implemented and proven by real evidence), **PARTIAL** (implemented; proof incomplete or some cases fail), **FAILED** (proven not working), **BLOCKED** (cannot proceed without an outside dependency), **UNTESTED** (implemented, no adequate proof), **NOT STARTED**.

"Implemented" means the code exists in this tree. "Proven" means a test or a real run showed it working; the evidence is named each time. Stand-in evidence (unit tests, PostgreSQL twin, the local Supabase stub used by the browser journeys) is labelled as such and is weaker than real-device or real-account evidence.

---

## 0. Summary

| Item                                         | Value                                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commercial-launch readiness (evidence-based) | **≈ 70 %**                                                                                                                                                           |
| Remaining                                    | **≈ 30 %**                                                                                                                                                           |
| Phases 1–49                                  | Implemented; the large majority proven on stand-ins and many on real devices; several real-world gates still PARTIAL (see §7)                                        |
| Phases 50–56                                 | 50 PARTIAL · 51 PARTIAL · 52 PARTIAL · 53 COMPLETE in code and tests, live owner changes BLOCKED on owner 2FA · 54 same as 53 · 55 PARTIAL · 56 NOT COMPLETE         |
| Production                                   | Not deployed from this branch. `ocade.in` serves `main` `5d72f73d` (Worker deployment `3152b6cc`, 2026-09-29). The shared Supabase project is partly ahead (see §18) |
| Where work stopped                           | Phase 55/56 final verification, re-running the Android Appium journey on the cleaned tree (§8)                                                                       |

Why not higher: the headline capability (JARVIS doing real, unfamiliar, multi-step work on a PC) is only partly reliable (§10); background/scheduled work cannot run on the preview because a server Edge Function was never deployed (§9, §18); the Windows installer is unsigned (§19); owner-only actions (2FA enrollment, signing certificate, production deploy approval, email template) are outstanding (§21); the final real-user pass and final release report were never completed.

---

## 1. What was implemented (by area)

| Area                                                         | Components (main files)                                                                                                                                                          | Status                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Web app shell, Chat, Library, Settings, auth                 | `src/routes/*`, `src/components/{shell,chat,settings,legal,security}`, `src/lib/{auth,chat,library,account,appearance,notifications,payments}`                                   | COMPLETE (journeys)                                                          |
| Offline Intelligence for Chat (browser engine, leases)       | `src/lib/brain/*`, `src/lib/commercial/offline-*`, `scripts/build-offline-artifact.mjs`                                                                                          | PARTIAL (journeys pass; F1 minor open)                                       |
| Online intelligence boundary (hidden provider, key rotation) | `src/lib/intelligence/*`, `supabase/functions/ocade-intelligence`, `supabase/functions/ocade-intelligence-service`, `supabase/functions/_shared/boundary.ts`                     | PARTIAL (interactive path live; server path not deployed)                    |
| Usage and entitlements                                       | `src/lib/commercial/*`, migrations `20260902110000`…, `20261003090000`                                                                                                           | COMPLETE in code/tests; owner unlimited proven in the real DB                |
| JARVIS web workspace, orb, panels, bubble                    | `src/jarvis/JarvisWorkspace.tsx`, `JarvisPanels.tsx`, `JarvisBubble.tsx`, `Orb.tsx`, `graph.ts`                                                                                  | COMPLETE (journeys + real Chrome sweep)                                      |
| JARVIS planning loop                                         | `src/jarvis/agent.ts`, `protocol.ts`, `live-control.ts`, `live-deps.ts`                                                                                                          | PARTIAL (see §10)                                                            |
| Background / scheduled JARVIS work                           | `src/jarvis/background.server.ts`, `background-model.server.ts`, `schedules.server.ts`                                                                                           | BLOCKED on preview (Edge Function not deployed)                              |
| Device protocol, signed device door                          | `src/jarvis/device.server.ts`, `jarvis-runtime/ocade_identity.py`, `ocade_protocol.json`                                                                                         | COMPLETE (attack scripts, real agent)                                        |
| Windows Device Agent + tray + updater                        | `jarvis-runtime/ocade_agent.py`, `ocade_device.py`, `ocade_update.py`, `packaging/*`                                                                                             | COMPLETE (real install/update/rollback), unsigned                            |
| Universal computer control (broker, apps, files, UI, screen) | `jarvis-runtime/ocade_computer.py`, `ocade_discovery.py`, `ocade_accessibility.py`, `ocade_sheets.py`, `ocade_documents.py`, `actions/ocade_excel.ps1`, `actions/ocade_word.ps1` | PARTIAL (§9, §10)                                                            |
| Existing-browser control                                     | `jarvis-runtime/ocade_existing_browser.py`, `actions/browser_control.py`, `actions/ocade_page.js`                                                                                | PARTIAL (§12)                                                                |
| Wake ("OCADE" / "Hey OCADE"), voice                          | `jarvis-runtime/ocade_wake.py`, `jarvis-runtime/wake/`, `android/.../WakeModel.java`, `WakeService.java`, `src/jarvis/use-voice.ts`                                              | PARTIAL (§13)                                                                |
| Android app (bubble, accessibility control, agent)           | `android/src/in/ocade/app/*.java`, `android/build.py`                                                                                                                            | PARTIAL (§11)                                                                |
| Owner / Staff consoles in `ocade.in`                         | `src/routes/_authenticated/admin.tsx`, `src/components/admin/ConsoleModules.tsx`, `src/lib/admin/*`, migrations `20260930093000`, `20261002090000`, `20261003090000`             | COMPLETE in code/tests; live owner changes BLOCKED (§14)                     |
| Devices surface                                              | `src/jarvis/JarvisPanels.tsx` (Devices), `jarvis.functions.ts` (approve/decline/revoke), `device.server.ts`                                                                      | COMPLETE for list/status/connect/remove; reconnect proven by reinstall (§15) |
| Security hardening                                           | `src/lib/security/*`, CSP in `src/lib/security/public-response.ts`, RLS migrations                                                                                               | COMPLETE for tested vectors (§16)                                            |
| Apple                                                        | WebKit compatibility only                                                                                                                                                        | BLOCKED (no hardware)                                                        |

---

## 2. What was actually tested (evidence inventory)

| Evidence                                                                                                            | Last run                 | Result                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest run` (unit + PostgreSQL twin suites, 109 files)                                                             | 2026-10-03, cleaned tree | 1203 passed, 1 skipped                                                                                                                                                                                                                      |
| `pytest jarvis-runtime/tests` (17 files)                                                                            | 2026-10-03, cleaned tree | 161 passed, 3 skipped                                                                                                                                                                                                                       |
| PostgreSQL twin: `owner-staff-on-site.test.ts` (12), `staff-authority.test.ts` (43)                                 | 2026-10-03               | all passed                                                                                                                                                                                                                                  |
| Browser journeys, `scripts/e2e/harness.mjs` (21 journeys, production build, local Supabase stub, headless Chromium) | 2026-10-03, cleaned tree | 19/21 first run; the 2 failures (`shell` asset check, `admin` hand-over) were test-timing issues, fixed in `9f648a1e`; `shell` then passed 4/4 and `admin` 3/3 in isolation. **The full 21-journey run was not repeated after `9f648a1e`.** |
| Android Appium journey (`android-journey.mjs`), Pixel 6a API 34 emulator                                            | 2026-10-03 (this wave)   | 21 checks passed, then **1 FAILED** ("removed in OCADE, the phone forgets its key and says so") and the run aborted on an emulator `adb` error; the emulator process later exited. Previous wave: 24/24                                     |
| Mobile MCP independent Android pass                                                                                 | earlier wave (row 17)    | passed then; **not repeated this wave**                                                                                                                                                                                                     |
| Real Chrome whole-site sweep on the preview (owner's own Chrome, CDP)                                               | 2026-10-03               | all pages, account menu, 5 Settings sections, 6 JARVIS panels, Owner Console (5 modules), phone width: no errors except the intended 404 page                                                                                               |
| Owner experience on the preview with the real owner account                                                         | 2026-10-03               | sidebar "Owner Console", 5 modules, "Unlimited use", "Unlimited JARVIS use", own usage row                                                                                                                                                  |
| Owner unlimited in the real database                                                                                | 2026-10-03               | one JARVIS window recorded 142 uses (normal limit 28): never refused, still counted                                                                                                                                                         |
| Devices panel on the preview (real account)                                                                         | 2026-10-03               | list, Ready/Offline, last seen, Remove of a stale audit device (revoked, key cleared in DB)                                                                                                                                                 |
| Remote attack pass on the preview + production DB (publishable key only)                                            | 2026-10-03               | 26/26 (`scratchpad/attack2.mjs`: RPC/table denial incl. new unlimited/transfer functions, CSP, HSTS, nosniff, no leaks, `admin.ocade.in` not served)                                                                                        |
| Device-door attack pass on the preview                                                                              | 2026-10-03               | 18/18 (`scratchpad/attack_device.py`: replay, skew, bad signature, oversized body, path escape)                                                                                                                                             |
| Real JARVIS tasks on the preview (hidden intelligence, real PC)                                                     | 2026-10-03               | Excel PASS; file task PASS; DaVinci Resolve **FAILED** (see §10); background takeover PARTIAL (see §9)                                                                                                                                      |
| Device Agent install / update / rollback on the real PC                                                             | 2026-10-03               | 0.3.7 → 0.3.8 → 0.3.9 installed silently over the running agent, adopted healthy, same device id kept                                                                                                                                       |
| Supabase migration identity                                                                                         | 2026-10-03               | `20261002090000` and `20261003090000` applied; 18 function bodies' md5 match the repo                                                                                                                                                       |

---

## 3. What passed

- All unit, PostgreSQL-twin and runtime suites listed in §2.
- 21 browser journeys (each passed in its last run; see the caveat in §2).
- Owner/Staff authority: site-session staff authority, second factor per session, refusal of a factor added in-session, immediate revoke (open console leaves by itself, entry disappears, refresh keeps it gone), staff granular permissions, unlimited until revoked / until a time / revoke, owner-only and never-self rules, Primary Owner hand-over in both directions with exactly one Primary Owner, audit lines — admin journey + PostgreSQL twin.
- Real: owner console visibility, owner unlimited with telemetry, Devices list/remove, whole-site sweep, both attack passes, Excel workbook task, simple file task, agent update/adoption.
- Earlier waves (recorded in `docs/FINAL_MATRIX.md` rows 1, 3, 4, 6, 17, 18, 20, 21): Windows installed lifecycle 28/28, wake on Windows through the speaker loop, Android 24/24 + Mobile MCP, WebKit compatibility.

## 4. What failed (and is not fixed)

| #   | Failure                                                                                                                                                                                | Evidence                                                                                                                                                  | Area                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| X1  | DaVinci Resolve task: asked to cut a 12 s clip to 5 s and export `.mp4`; one run produced a 12.00 s `.mov` and JARVIS reported success; two UI-route runs stopped at the 30-step limit | OpenCV + Windows properties on the output; `jarvis_activity` rows                                                                                         | Gemini (§10, §20)    |
| X2  | Background carry-on on the preview: after the tab closed the computer took the task over, then ended "I could not continue this task safely"                                           | task `Create and read text files`, controller = device id, message at 13:53:37 UTC; `ocade-intelligence-service` absent from the project's Edge Functions | Deployment (§9, §18) |
| X3  | Android journey this wave: "removed in OCADE, the phone forgets its key and says so" failed within 30 s; the run then aborted on an emulator `adb` error                               | journey output 2026-10-03                                                                                                                                 | Android (§11)        |
| X4  | Full 21-journey run after the journey-timing fixes was not repeated                                                                                                                    | —                                                                                                                                                         | Testing              |

## 5. Partially working

- JARVIS universal control: simple file and spreadsheet work succeeds; complex professional-app work (video editing) does not reliably finish or self-verify (§10).
- Background work: takeover works; continuation cannot run until the server Edge Function is deployed (§9).
- Android: onboarding, permissions, bubble, phone control by ref, STOP from bubble, rotation pass; removal feedback failed this wave; emulator unstable (§11).
- Existing-browser control: product path implemented and proven earlier on the owner's Chrome with the permission page; real-model browser tasks not re-run this wave (§12).
- Wake: Windows proven through the speaker loop; a real human voice check and Android real-voice check outstanding (§13).
- Owner/Staff live: viewing proven; any live change blocked until the owner enrolls 2FA (§14).

## 6. Never finished

- Phase 56 final sequence: final source-read audit before freeze (this ledger replaces it, read-only), final real-user Windows/browser/Android pass, final commercial-release report, production identity proof after deploy.
- Mobile MCP pass on this wave; Remote PC from a real signed-in phone (needs the owner's Google sign-in on the phone).
- Real-model runs for: an unfamiliar app end to end with verified output, the person's own Chrome task, a repository bug fix, a multi-app workflow, STOP during a real-model action, the vision/coordinate fallback app (matrix rows 7, 10–14).
- Temporary entitlement and staff-grant lifecycles on real safe test accounts (blocked: owner 2FA).
- End-of-test environment cleanup (§21).

## 7. Phase status

| Phases                                                       | Status                                                                          | Note                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1–34 (foundations, verification gates)                       | COMPLETE / PARTIAL                                                              | Implemented and passing on stand-ins; real-world parts carried into 35–56 |
| 35 Re-baseline, 36 TOTP/2FA + revoke, 37 donor consolidation | COMPLETE                                                                        | 2FA defect fixed (mfa journey), fail-closed lifecycle                     |
| 38 Existing-browser control                                  | PARTIAL                                                                         | product path proven; real-model tasks pending                             |
| 39 Windows agent + tray                                      | COMPLETE (unsigned)                                                             | 28/28 lifecycle earlier; updates today                                    |
| 40 Files/Office/spreadsheets                                 | PARTIAL                                                                         | Excel PASS real; Word real not re-run                                     |
| 41 Development/professional/creative                         | FAILED for creative (Resolve); coding real UNTESTED                             |                                                                           |
| 42 Conversational JARVIS + wake                              | PARTIAL                                                                         |                                                                           |
| 43 Background, reminders, Remote PC                          | BLOCKED                                                                         | server Edge Function not deployed; real phone sign-in                     |
| 44 Android commercial hardening                              | PARTIAL                                                                         |                                                                           |
| 45 Apple                                                     | BLOCKED                                                                         | no hardware; WebKit only                                                  |
| 46 Owner/Backup/Admin/Staff                                  | COMPLETE (code/tests)                                                           | superseded by 53/54                                                       |
| 47 Whole-product security/isolation/UI/perf                  | PARTIAL                                                                         | security passes; performance not re-measured this wave                    |
| 48 Final cleanup                                             | PARTIAL                                                                         | §17                                                                       |
| 49 Final launch proof                                        | NOT COMPLETE                                                                    | no production deploy from this branch                                     |
| 50 Universal control                                         | PARTIAL                                                                         | §10                                                                       |
| 51 Wake/browser/background/runtime                           | PARTIAL                                                                         |                                                                           |
| 52 Android/Remote PC                                         | PARTIAL                                                                         |                                                                           |
| 53 Integrated consoles                                       | COMPLETE (code, twin, journey, real view); live changes BLOCKED (owner 2FA)     |                                                                           |
| 54 Ownership/entitlements/usage                              | COMPLETE (code, twin, journey, real unlimited); live grants BLOCKED (owner 2FA) |                                                                           |
| 55 Real tasks, sweep, debloat, second pass                   | PARTIAL                                                                         |                                                                           |
| 56 Final proof + merge gate                                  | NOT COMPLETE                                                                    | stopped here                                                              |

## 8. Exactly where development stopped

- Last product commit: `9f648a1e` (journey timing fixes). Before it: `f937fb92` cleanup, `79db174c` owner authority files, `2ced6bcc` script-first prompt rule, `d15a2873` F28, `36014db3` F27, `978e8eb6` F26, `4b41879d` agent 0.3.8 fixes, `0b5d2836`/`ed14fa84` F22, `065428a4` integrated consoles.
- Last activity: Phase 55/56 Android re-run on a restarted emulator — 21 checks passed, the removal-feedback check failed, the run aborted on an emulator `adb` error; the emulator process then exited; the local site/stub server was stopped by the owner. Owner instruction then stopped all work.
- Untracked, deliberately not committed: `wrangler.preview.json` (local preview config, to be deleted at cleanup).

## 9. Windows / PC control state — PARTIAL

- Agent build: PyInstaller onedir + Inno Setup, per-user install, versions folder, `current.json` adopt/rollback, single instance, autostart, tray (Ready/Working/Waiting/Paused/Stopping/Offline, STOP, Exit), bundled wake model. Installed on the test PC: **0.3.9** (`%LOCALAPPDATA%\OCADE\Device Agent`), connected to the **preview** through the user environment variable `OCADE_SERVER`.
- Proven: lifecycle 28/28 (earlier), updates 0.3.7→0.3.9 today, STOP/cancellation and fail-closed control (runtime tests), signed protocol and attacks, app discovery (190 apps), Excel through COM with read-back, files scope/import/export/undo, UI Automation by pattern id (F23), unquoted program paths (F24), image-frame coordinates (F25), media/file properties for verification (F28).
- Not proven this wave: real coding task, real multi-app task, STOP during a real-model action, real take-over/co-work with a person.
- Background: the page's loop hands a running task to the computer after its heartbeat stops (proven: controller became the device id), but the computer's continuation calls `ocade-intelligence-service`, which is **not deployed** → it ends "I could not continue this task safely". Scheduled work uses the same path. **BLOCKED** until the Edge Function is deployed.
- macOS: not built (code has macOS branches marked `ponytail:` as unproven).

## 10. Gemini / OCADE universal-control state — PARTIAL (deferred by owner)

Kept exactly as is by owner direction; full list in `docs/DEFERRED_GEMINI_ISSUES.md` (G1–G10). In short: route choice varies (API vs UI) between runs of the same request; long UI tasks hit `MAX_MODEL_STEPS = 30`; the model sometimes writes tool calls as text (mitigated by F26); it once reported a false completion (F28 mitigation added, not re-measured); stale application-API knowledge; clicks outside the observed image; Qt UI limits; real-model evidence missing for rows 7 and 10–14. The script-first prompt rule (`2ced6bcc`) is committed but **not measured**. Device-side defects found during these runs (F22–F28) were fixed with regressions.

## 11. Android / mobile state — PARTIAL

- Implemented: installed app (no Gradle build, `android/build.py`), guided permissions, accessibility control by ref, floating bubble (STOP, Talk, Open JARVIS), Wake Mode foreground service with bundled model, device key and connection, "on my PC" routing.
- Proven: Appium 24/24 and Mobile MCP pass (earlier wave); this wave 21 passed + 1 failed (X3) + abort on emulator error.
- Not proven: real phone (only the emulator), Remote PC from a real signed-in phone, real-voice Wake on Android, uninstall/reinstall this wave.
- Mobile web/PWA: responsive journeys pass; WebKit compatibility only for iOS.

## 12. Browser / Chrome state — PARTIAL

- Product path: the agent attaches to the person's own Chrome through Chrome's own remote-debugging permission (no add-on), or an isolated browser; donor controller trimmed to the two modes used (`actions/browser_control.py`, 605 lines).
- Proven: permission-page hand-over and own-Chrome control on the owner's Chrome (earlier wave); whole-site sweep and owner flows in the owner's real Chrome (CDP) this wave; cross-browser journeys (Chromium, Firefox, WebKit via `browsers-journey`).
- Not proven this wave: a real-model task in the person's signed-in Chrome (row 7, deferred with Gemini).
- Test-only state: the owner's Chrome has remote debugging allowed for this test session; a `%TEMP%\ocade-allow.ps1` watcher may still be running.

## 13. Wake / voice state — PARTIAL

- Bundled OCADE-owned wake model (no download after install), both phrases, local pre-wake audio, idle cost measured low; tray line shows Wake state.
- Proven: Windows through generated local voices over the real speaker → microphone loop; health runs the model once. Android Wake Mode service and notification permission fix (F6).
- Not proven: a real human voice on Windows or Android (owner action), voice interruption with a real model while working (journeys only).

## 14. Owner / Staff / usage state — COMPLETE in code and tests; live changes BLOCKED

- Primary Owner: `caeracadane28@gmail.com`, user id `a7d48c60-6df1-4ce8-b1c9-11f59cf22422`, held by id server-side. The owner's note spelled `carecadane28` — no such account exists.
- Integrated consoles at `ocade.in/admin`; sidebar entry only for staff; revoke immediate; staff limits normal unless an owner grants unlimited (until revoked / until a time); additional Owners; hand-over with stay-or-leave; exactly one Primary Owner; audited.
- Real proof: owner sees the console and is unlimited with usage still recorded (142 in one window).
- Blocked: the owner has **no second factor enrolled**, so the console is view-only for the owner (by design); every live grant/revoke/usage reset and the real staff and entitlement lifecycles wait for the owner's 2FA.
- `admin.ocade.in`: retired before it ever went live (no DNS, no route, code removed).

## 15. Devices state — COMPLETE (with notes)

- Implemented: list with Ready / Busy / Needs permission / Offline + last seen; connect by request + fingerprint + approval; expired-request guidance; per-device switches; Remove; Remote PC view.
- Proven: journeys (connect, expired request, decline, revoke), real preview list and Remove, reconnect across three agent reinstalls with the same device id.
- Note: the owner's account still lists an older offline `DESKTOP-7CF9G0F` (2026-09-27 enrollment of the same PC) beside the current one; it is identified by status and last-seen date but the duplicate name can confuse.
- Android removal feedback failed once this wave (X3).

## 16. Security state — COMPLETE for tested vectors

- RLS and SECURITY DEFINER RPCs denied to anonymous callers (26/26), device door attacks (18/18), CSP with `frame-ancestors 'none'`, HSTS, nosniff, PKCE (tokens in addresses refused), second factor enforcement, in-session-factor refusal, recent proof for privileged changes, ended sessions fail closed, path/junction escape, private-network and payment gates in the runtime.
- Known trade-off (recorded, accepted by owner direction): the consoles share the site's origin; the separate-origin protection against a token lifted from the chat page is replaced by session-bound 2FA, recent proof for changes, the 10-second revoke and the emergency staff sign-out.
- Not done this wave: an authenticated customer-token attack against production (stand-in journeys and the twin cover it), performance/Lighthouse re-measure.

## 17. Debloat / cleanup state — PARTIAL

Done (recorded in `ToRemove.md`): donor browser controller 1556 → 605 lines; stale 51.7 MB installer untracked; unused exports; `admin.ocade.in` code, route and session table; browser add-on and Windows mini-control (earlier); twin planting family (457 lines); orphan `ffprobe-static.d.ts`. Kept on purpose: Excel/Word adapters, Linux confinement branch, test-only exports, per-class data-deletion module, stub SQL mirror and journey helpers, legacy `user_roles` admin row (until the console release is live in production). Not done: the remaining reviewer candidates (TypeScript copy of the allowance gate, journey helper consolidation, stub mirror replacement); the full matrix was not re-run end to end after the last journey fix.

## 18. Supabase / Cloudflare / deployment state

- Cloudflare Worker `ocade-web`: production deployment `3152b6cc` (2026-09-29) = `main` `5d72f73d`. Production deploys only through the manual GitHub workflow `cloudflare-production.yml` with an approval string; pushing `main` does **not** deploy.
- Preview alias `final-check` (`https://final-check-ocade-web.caeracadane28.workers.dev`): last confirmed upload `384a3770` (branch `d15a2873`); `2ced6bcc` and later may not be on it. Preview URLs were turned on for testing.
- Supabase `sazhgaisyhkdbrooycdv` (shared by production and the preview): applied `20261001091000`, `…093000`, `…095000`, `…095200`, `…096000`, `…096100`, `20261002090000`, `20261003090000`. Not applied: `20261001092000` (retire browser extension) and `20261001094000` (permits settled by server) — release steps; `20261001090000` and `20261001095100` must **never** be applied (superseded by `20261003090000`).
- Edge Functions: only `ocade-intelligence` v12 (verify_jwt on) is deployed. `ocade-intelligence-service` is **not deployed** (blocks background/scheduled work); the branch's `ocade-intelligence` changes (F10 preflight accounting) are not deployed.
- Test configuration to revert: Supabase Auth redirect URLs include the preview; Edge secret `OCADE_ALLOWED_ORIGINS` includes the preview origin; Worker preview URLs on.
- GitHub MCP connector fails authentication (git CLI works); GitHub Actions red is a billing limitation.

## 19. Known release blockers

1. `ocade-intelligence-service` Edge Function not deployed (background and scheduled work fail) — release step.
2. Production not deployed from this branch; release order in `docs/MEMORY.md` (Edge Functions, Worker with `VITE_WEB_PUSH_PUBLIC_KEY` and secret `WEB_PUSH_PRIVATE_KEY`, migrations `092000` and `094000`, remove legacy admin row, publish the agent).
3. Windows installer and Android release unsigned (owner's code-signing certificate and Android release key).
4. No Device Agent installer published in production (`/agent/manifest.json` 404).
5. Owner 2FA not enrolled (owner console cannot change anything live).
6. Universal control unreliable for complex professional apps (§10, deferred).
7. F11 (Google sign-in with `?next=` lands signed-out) is live in production until the release ships.
8. Android removal feedback failure (X3) unresolved; emulator instability.

## 20. Deferred Gemini issues

See `docs/DEFERRED_GEMINI_ISSUES.md`: G1 route variance, G2 step limit, G3 text tool calls, G4 false completion, G5 stale API knowledge, G6 clicks outside the image, G7 over-caution, G8 Qt UI limits, G9 needless second launch, G10 missing real-model evidence for rows 7 and 10–14.

## 21. Remaining manual / owner-only actions

- Enroll a second factor on the Primary Owner account (then sign out and in again).
- Approve and run the production release (`cloudflare-production.yml` approval), deploy both Edge Functions, apply `092000`/`094000`, set `WEB_PUSH_PRIVATE_KEY`.
- Provide the Windows code-signing certificate and the Android release signing key; back up `~/.ocade-release/ocade-release.key`.
- Decide F9 (verification-email template text in the Supabase dashboard) and F11 mitigation (allow-list `https://ocade.in/auth/callback**`).
- Optional real-voice wake checks (Windows, Android); Google sign-in on a phone for Remote PC proof; physical Apple hardware or approval for a paid remote device.
- End-of-test cleanup on this PC and the project: remove user env var `OCADE_SERVER`; reinstall or uninstall the test Device Agent; delete `wrangler.preview.json`; stop the `%TEMP%\ocade-allow.ps1` watcher and turn off Chrome remote debugging for the test profile; remove the preview from Supabase redirect URLs and `OCADE_ALLOWED_ORIGINS`; turn Worker preview URLs off; tidy `~/Documents/OCADE-Test-Workspace` and the Resolve test project `OCADE_Edit_Project`.
