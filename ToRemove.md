# OCADE retirement manifest

## Unused bundled Chromium headless shell removed — 1 November 2026

- **Removed from Windows packaging:** Playwright's `chromium_headless_shell-*` payload, using the pinned SDK's `install --no-shell chromium`. Runtime code launches the explicitly bundled full Chromium executable.
- **Same-SDK measurement:** [cloud run 56](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41341255804), source `52396a3ff5167407d7bd1a792f179508502a02f3`: full 604 files / 752,827,379 bytes → retained 314 files / 461,909,478 bytes. Removed 290 files / 290,917,901 bytes (277.44 MiB; 38.6434%). Every retained runtime file is byte-identical; SDK `.links` cache-registration metadata is excluded from comparison.
- **Parity and independence:** `packaging/compare_browser_payloads.py` permits only headless-shell removal. `packaging/check_frozen.py` runs real frozen MCP workers and a real nonce-bearing local HTTP fixture in bundled Chromium with empty PATH, both before and after installation. Bundle and installer rebuilds had zero differing files; install/diagnose/repair/uninstall passed. [Machine-readable evidence](evidence/2026-11-01-audit/codex-packaging-52396a3.json).
- This proves payload reduction and the measured fixture paths. It does not qualify customer browsers, real-Gemini task accuracy, all browser features, macOS/Linux packages, consumer hardware or task-latency improvement. No source capability or test was removed.

## Fixed finance journey and scripted media/web runners retired — 31 October 2026

- **Removed:** `office.reconcile_workbook`, `office.write_report` and `verify.reconciliation_report` (one hard-wired task: fixed `Reconciliation`/`Summary` sheets, fixed report layout, fixed verifier), `device-agent/windows/tests/qualify_photo_web.py` (fixed Photopea click script) and `device-agent/windows/tests/qualify_media.py` (ran developer-authored media plans), and the `tread` 3D material pattern (could not follow a wheel's own axis).
- **Replacement (parity proven by `tests/jarvis/e2e.test.ts` and `device-agent/windows/tests/test_gateway.py` before removal):** the generic primitives the planner already had — `fs.read_text` (workbook values), `office.write_workbook` (formulas recalculated by a real engine), `office.write_document` (+PDF), `verify.checks` (`workbook_cell_equals`, `file_contains`; a PDF must now also render with no blank page).
- **Not changed:** historical evidence folders (they record what ran; nothing imports them).

## JARVIS planner endpoint retired — 31 October 2026

- **Removed:** the never-deployed `supabase/functions/jarvis-planner` Edge Function, its `JARVIS_PLANNER_KEY` shared secret (`.env.example`, `supabase/config.toml`) and the planner's fetch to it.
- **Replacement (parity proven by `tests/jarvis/e2e.test.ts` before removal):** `src/lib/jarvis/planner.server.ts` acquires a JARVIS generation permit through the existing commercial gate and calls the already-deployed `ocade-intelligence-service` with the existing server key and `x-ocade-user`; that function re-checks the account's online-AI consent, claims the permit and settles it. The repository again owns that function's source (`supabase/functions/ocade-intelligence-service`, the service door in `edge-handler.ts`/`boundary.ts`), restored from before `5568893`.
- **Not changed:** deployed functions, staging or production data, `main`.

## Second debloat pass — 30 October 2026

From `5568893`, on `ocade/p00-p22-implementation`:

- **Retired-JARVIS leftovers removed:** start-task permit binding (`bindPermitToTask`, `taskId`, `startsTask`, free task-turn finalize), the "JARVIS task results" notification category, admin JARVIS device list/removal, customer JARVIS task list, device/task health counters and their staff permission choices (`devices.read`, `devices.manage`, `tasks.read`, `execution.manage`), unused JARVIS preferences (wake, spoken answers, device target), and Help answers for the device agent, own-browser control and device troubleshooting.
- **Experiments and test seams removed:** the opt-in candidate system-prompt A/B (`ocade.prompt` localStorage flag and `system-prompt.ts`), the loopback push-service exemption and its fetch override, the Tailwind test-file exclusions, the vitest-only stylesheet guard, the node-preset Nitro branch for the deleted audit harness, and comments that cited deleted tests.
- **Tooling removed:** direct `esbuild` dev dependency (same 0.28.1 still resolves transitively), `.nvmrc` (duplicate of `.node-version`), `scripts/measure-loc.mjs`, `scripts/deploy.d.mts`, CI failure-evidence upload, Python/Android/Windows-only `.gitattributes` and `.gitignore` rules.
- **Documentation removed:** 13 compatibility pointer stubs and `docs/MEMORY.md` (code comments now cite the canonical document), `docs/design-references` (competitor screenshots and research), `docs/integrations/deepseek-harness.md`, the 9 October competition/redesign research report; broken links to deleted evidence were turned into plain text. AGENTS.md records the DeepSeek intake as retired.
- **Kept on purpose:** migrations, rollback scripts, generated Supabase types, the `jarvis` usage surface, JARVIS data classes in export/erasure, legal text, the JARVIS GUI and its Settings rows, and `OCADE_SYSTEM_PROMPT_REDESIGNED.md` as the owner's candidate specification.

## Old JARVIS engine, tests and audit material retired — 30 October 2026

Owner-ordered cleanup on `ocade/p00-p22-implementation` from `6dff1f04dfbbb9ed2581dbf41ba92d6ca54862ba`, ahead of a new JARVIS architecture (not implemented here). Everything below remains recoverable from that commit.

- **Removed JARVIS engine:** `src/jarvis` planner/agent/engine/protocol/task authority/device/background/schedules/permissions/live control, `/api/jarvis/*`, `/agent/$file`, `src/lib/agent`, the DeepSeek Harness intake (`src/deepseek`, `external/` submodule, link/type scripts), `jarvis-runtime/` (Python device agent), `android/`, `scripts/wake/`, the per-minute JARVIS schedule clock, the server-to-server `ocade-intelligence-service` function and its service-key door, the admin JARVIS device-work pause, and unused JARVIS prompt modules.
- **Kept and disconnected:** the JARVIS page layout, rail, Conversations panel (past JARVIS conversations stay readable, searchable and deletable through the shared conversation authority), composer, phone bubble and Settings rows. Sending, voice, device connection and JARVIS memory controls are disabled and say "OCADE JARVIS is unavailable while it is being rebuilt." JARVIS data remains in the account and in export/erasure under Privacy & Security.
- **Removed tests and QA:** every `__tests__`/`*.test.*` file, `scripts/e2e`, `supabase/verification`, Vitest configs, PGlite/fake-indexeddb/Vitest dev dependencies, static QA checkers and the cloud Android/browser/Python test workflows. `verify:full` now runs routes stability, typecheck, lint, format, build stability, bundle secret scan and Supabase types coverage.
- **Removed evidence:** `experiments/`, `docs/audit-checkpoints`, `docs/audits`, `docs/checklists`, historical ledgers/matrices and root audit/test-result reports.
- **Not changed:** applied migrations, rollback scripts, database schema and data, deployed functions, production deployment, `main`. The database still holds JARVIS tables; the deployed `ocade-intelligence-service` function is not undeployed by this commit.

## Proven fetch duplication removed — 29 October 2026

After working checkpoint `a53f5ba4a80dc3b126894bd8c2f1d34cd4c2e12b`, three parallel agents reviewed KISS/YAGNI/DRY-WET cleanup. Removed the third copy of the same live Supabase fetch adapter by reusing the existing lightweight configuration module. No new product module/package; preserve lazy SDK, exact caller JWT/header handling and existing security/lifecycle boundaries. Fresh network-free parity84cases/808assertionsPASS. Full build/Vitest/browser UNRUN/BLOCKED.

Production physical delta−50lines/−1,390characters; regression test+119physical lines. Proof/review, all source counts. Eight reviewed live UI/helper modules and37direct dependencies were retained: removal was not proven safe. No safety/accessibility/recovery/test feature was removed for a line target. No runtime performance claim is made.

This is a proof-gated retirement list, not another implementation plan or deployment runbook. [Open work](BLOCKED_TESTS.md) orders unresolved implementation and verification; [Testing](docs/TESTING.md) owns release operations. Baseline: f521e23529542d709a9627181341b0e904a8b0c3. No product code was removed during the documentation mission.

## Required proof before every removal

Trace all callers and security roles → identify canonical replacement → record working behaviour and cost → prove replacement on normal/failure/STOP/restart/fidelity cases → remove → rerun targeted and broader evidence → independent adversarial/real-user checks. Record active LOC/modules/dependencies/package size and relevant latency before/after. No percentage quota. Revert a cleanup that loses valid functionality.

| Candidate                                                                                                                                        | Replacement / owning PLAN package                           | Deletion gate                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ~~Model-owned completed transition in src/jarvis/agent.ts~~ — RETIRED 11 Oct 2026 (both copies now route through the `changeTask` evidence gate) | P01 receipt-gated task settlement                           | All terminal paths require contract proof; false finish tests fail closed              |
| Preflight-only semantic cancellation/stale coordinate reuse                                                                                      | P02 final-point checks and observation generations          | STOP race and real platform drift tests pass                                           |
| Rotation exchange that consumes commands; memory-only Android results                                                                            | P03 handshake and durable journal                           | Lost reply/crash/replay tests preserve every effect                                    |
| Office failure reported unchanged after mutation                                                                                                 | P04 effect/recovery metadata                                | Real partial-save/readback failures represented truthfully                             |
| Coarse duplicate staff permission authority                                                                                                      | P05 database predicate                                      | Direct Data API and route tests agree, concurrent owner transfer safe                  |
| Silent partial export/deletion success                                                                                                           | P06 durable reconciliation                                  | All classes counted; unknown counts never complete                                     |
| Network-first offline activation, destructive ciphertext error cleanup                                                                           | P07 local-first verified manifest and quarantine            | Cold offline restart, corrupt bytes and cross-tab key tests                            |
| Repeated cloud round-trip for each deterministic segment step                                                                                    | P08 local bounded segment                                   | Old-agent compatibility and full safety parity before retiring old path                |
| Independent polling/connection owners                                                                                                            | P09 shared authenticated events plus bounded recovery fetch | Loss/reconnect/order tests; never remove all fallback polling                          |
| Giant app-name/menu maps and reusable coordinates                                                                                                | P10 live capability discovery and sanitised recipes         | Unfamiliar app/version drift tests, safe refusal                                       |
| Duplicate browser/installer/privileged action authorities                                                                                        | P11 existing signed companion/broker                        | Installed lifecycle, existing/managed browser parity; no cookie copying                |
| Post-install wake download paths and overlapping audio owners                                                                                    | P11/P12 bundled signed wake and one session owner           | Signature, update, microphone/recovery and real wake proof                             |
| Duplicate Android setup/settings, dead controls, hidden errors                                                                                   | P13/P15 guided flow and canonical settings                  | Every control mapped; denied permission and async failure handled                      |
| Always-mounted expensive Orb/graph and redundant UI trees                                                                                        | P15 lazy shared responsive surfaces                         | Keyboard/mobile/reduced-motion and measured performance parity                         |
| Redundant task summaries/unbounded context                                                                                                       | P16 durable compact checkpoint                              | Goal/permission survives compression and restart                                       |
| App-specific adapters                                                                                                                            | P17 generic broker only where it proves parity              | KEEP Office and other measured fidelity/safety advantages until equivalent replacement |
| Source-string tests/unused helpers/dependencies                                                                                                  | P19/P22 stronger behaviour proof or confirmed no callers    | Never remove unique negative/security/platform evidence                                |
| Retired checkout controls or resurrected payment schema                                                                                          | P20 authoritative new commerce implementation               | Approved provider and settlement proof; preserve required financial history            |

## 19 October 2026 routing correction

Retired the unpublished Google-hosted Gemma-default proxy (`supabase/functions/_shared/gateway.ts`), its automatic model-switch/continuation envelope and gateway-specific tests. Standard’s canonical replacement is the original Gemini boundary; High has a separate Workers AI protocol adapter under the same admission/settlement owner. Existing Google credential, quota, terminal, signature and STOP tests remain. Replacement tests cover explicit High selection, fragmented native calls, private-reasoning isolation, incomplete terminals, cap/safety refusals, screenshot placement and changed/unreadable billing. The screenshot regression failed before its fix. Live wire, UI warnings and paired real-task parity remain blocked, so no deployment or benchmark claim follows.

Measured candidate: 902 active code files / 144,310 lines against 896 / 143,638 at `8e3f2e6` (net +6 files / +672 lines, including required new adapter, UI and tests). This is removal of obsolete wiring, not a claim of net size reduction. No dependency or schema was added. Runtime latency and real task accuracy are UNTESTED; preserve the release blocks in Testing and BLOCKED_TESTS.

## Protected material

Keep immutable imports/source-original/ZIP, applied migrations, licences/notices, signing/update/wake verification, account isolation, task journals, backups, accessibility and unique historical findings. Developer MCP/test tools may remain useful even though customers never install them. Do not deep-index/upload all customer files for convenience. Sanitised recipes must not retain cookies, credentials, raw private screenshots or unrelated contents.

## Historical cleanup

Previous completed cleanup records (browser donor reduction, stale installer artefact, integrated owner console and test-helper retirement) remain in the [baseline version](https://github.com/BREVEX-CEO/caera-connect-plan/blob/f521e23529542d709a9627181341b0e904a8b0c3/ToRemove.md). Those records are dated claims, not fresh verification. In particular, old console migrations are immutable history and must be replayed in chronological order on a fresh database, never applied after the later consolidated authority out of order. Current release operations belong only to Testing.

## October 10 documentation disposition and cleanup gate

**KEEP** established minimum active authorities: PLAN, AGENTS, CLAUDE loader, PRD, Architecture, Design System, Security, Testing, Decisions, dated research, ToRemove and source audit checkpoints. They have different responsibilities and documented existing references; do not delete a file merely to reduce Markdown count or falsify cleanup statistics. **DELETE or merge later only with individually verified reference map, unique-clause relocation, caller/consumer parity, backup in Git and changed-file regression.** Preserve donor ZIP/source-original, existing signed manifests, applied migrations, critical recovery journals and audit evidence. Product code cleanup, Ponytail Ultra or dependency retirement remain future independently tested P22 implementation; documentation-only stage cannot perform them. No additional Markdown deletion is proven safe from the current uploaded handoff alone.

## Proof-gated source-specific retirement inventory — 10 October detailed plan

Superseded on 30 October 2026: every row named code removed with the old JARVIS engine, voice/device runtime or test tooling (see the records above). The full table remains at `5568893`.

## Donor removal manifest — 11 October 2026

Historical owner removal decision; see the [archived plan](https://github.com/BREVEX-CEO/caera-connect-plan/blob/babd3318/PLAN.md). Removed from the tracked tree after `a41983bd` (64 files, 7,732,547 bytes); the bytes remain in Git history (no rewrite). Both donor LICENSE files were the owner's own proprietary licence, still carried by `jarvis-runtime/LICENSE`; no third-party notice files were inside either ZIP. Rights for code adapted earlier remain a P00-B question.

```text
100644 blob 96269e867ab4b01ddd462b0c075b85eb358843ff	imports/UI OCADE JARVIS.zip
100644 blob 206f39f49c386300e9b970df94e6492d018ddee4	imports/ocade-jarvis/CLAUDE.md
100644 blob da4f53534b994f7c947408223d66b566f69d0bfd	imports/ocade-jarvis/LICENSE
100644 blob c85aa51c1681d7bf5c5eeb8b0363bb9742846c45	imports/ocade-jarvis/README.md
100644 blob 3213b453fde9f993b1d1b91a1acc9b73fe86ab4c	imports/ocade-jarvis/ocade jarvis 25-09.zip
100644 blob c229a2511beaccf720a1a4ba2a44e4165926b183	imports/ocade-jarvis/source-original.sha256
100644 blob d0badd760b5f5cbf1267fb1879ee1e47c855e054	imports/ocade-jarvis/source-original/ocade jarvis 25-09/.gitignore
100644 blob 1c2211c7e5e3ab64564a4f797c19ddcb8cb62415	imports/ocade-jarvis/source-original/ocade jarvis 25-09/LICENSE
100644 blob 64dca35add51a421d1f231c97d568f3315a86a71	imports/ocade-jarvis/source-original/ocade jarvis 25-09/README.md
100644 blob 2461fa9a8ae9c026374685d7d467dcef729fce66	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/background_monitor.py
100644 blob 3b2481782f280b5fd4cb14b91b9d95831423b8ab	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/browser_control.py
100644 blob c7442c7cd609476f3a047f4482c9c986bedec23b	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/code_helper.py
100644 blob 3add084d034d1258ee4215d0fa001173326e2908	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_control.py
100644 blob 3167c486ca79892a9216db197a797de90ba54220	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_settings.py
100644 blob 1490633c40711c3ac5977c379d469403b93f8922	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/desktop.py
100644 blob e0fd18c4ebd5db6ffe272a6b90621d67381139fd	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/dev_agent.py
100644 blob 1e618ff37c58fa518184bdc88913ac8d4d28f95b	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_controller.py
100644 blob 345ebd95846d29caee7047e9bd0e65d72cee2a42	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py
100644 blob c130a8d9ac66622b2572e0f5415b82ecaad826d8	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/flight_finder.py
100644 blob 003dabe64b9bd1450526b516a02341bcdac45d17	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/game_updater.py
100644 blob 4aa0b3659582f7a72b70a7d3788e920d9fa71294	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/open_app.py
100644 blob 7a1d8f279a758d25ef477ecf439c1b6774f6d5c5	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/proactive.py
100644 blob 23707ec582b352ab17d8f7f0eb127263e904a4c0	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/reminder.py
100644 blob ef0a68b95a320058e11eaf73d70ec676ccaff747	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/screen_processor.py
100644 blob 4d5bfb33b684a56d51b15a145d7b45d9fd851ee5	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/send_message.py
100644 blob 3fb3f432f7b565fc0472f8c73381f8ea1da8d850	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/system_monitor.py
100644 blob e1d7b154fd47ce1fb705238ae833d55b34b32f4d	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/weather_report.py
100644 blob f8cae33ae48fee9ad833711ed7ba47667a661cdd	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/web_search.py
100644 blob e8dad2fee04b5cc72afc57dc61507781e170f5c6	imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/youtube_video.py
100644 blob 4ea0c242ee259f27590512139e8a0721e8028268	imports/ocade-jarvis/source-original/ocade jarvis 25-09/config/__init__.py
100644 blob b40500f923f160824c883d03a5adf0e25a618a12	imports/ocade-jarvis/source-original/ocade jarvis 25-09/config/jarvis.ico
100644 blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/__init__.py
100644 blob 0dc610ed24707fb18f61a12d690e55902175591e	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/action_loader.py
100644 blob c9c84ec25f21048a72d4279f001f8a75a54a4a29	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/audio_devices.py
100644 blob d8651f19403f255f29344cafd2adcbcc8802bc05	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/avatar.py
100644 blob b426f019aa9c9426702a7eb76b454af6c698d5e4	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/avatar_mesh.py
100644 blob 7309f3aeb4fd56cb10d7aa09493fdf039da828b6	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/confirm.py
100644 blob 71a142d4b2551f2ea3695dfb98e390c1cfd1cb62	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/echo.py
100644 blob 24855a9f9253f55e184d6c9b7193036ef206a9db	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/face_model.obj
100644 blob 45c7bf1a8ff0f14c6908f85ded28f7e209a61a38	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/gemini.py
100644 blob 18cfef101f63e4f193391f25061405884606bd46	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/hotkey.py
100644 blob ccd7bfb56864b1a6925152cbaee0e88454ad6fc8	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/installer.py
100644 blob ce1f13eb3bc3c11ccba26f5d1379647c211b0247	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/llm_client.py
100644 blob 678184a43aec8a5f91b4f5e92ec9b0ea8c9c7c9c	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/plugin_loader.py
100644 blob dd5a47478e9dec75b8cd154198c125ef663f26a6	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/prompt.txt
100644 blob 326116d1e0d150438ec619bf057dd7d54222c13d	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/stt.py
100644 blob 575813ddb4cf7c0fa43801f02e24210397b5d56e	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/tts.py
100644 blob 2deebdb6c78b243cda540e3ab425a98eaeb39612	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/undo.py
100644 blob 9499b44e5fe90c27e8bdfa8202fe73423f1adc9f	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/viseme.py
100644 blob 59ae065923c4a5ba29cc39d3d35086ba0d2b0a88	imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/wake_word.py
100644 blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391	imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/__init__.py
100644 blob d1430c674680c22d82a03548a2f59bc272a85977	imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/server.py
100644 blob d72415e1dadd88072b56f2465973cc58041105fc	imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/app.html
100644 blob fb96be7802b102bc34a7c7d314e5290e579817f8	imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/crypto-js.min.js
100644 blob 5d267f9cb4f81b8e9f903896806361233adb28cc	imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/login.html
100644 blob cf0bfb1912db8a8085a81ce61ad7f9c1909327a7	imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py
100644 blob 452b9367aa99e40fcaa1452d02276880e4d6ba0a	imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/__init__.py
100644 blob 915303e66b071d582fa2066da8d2278e65a2c3d5	imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/config_manager.py
100644 blob b2d18d8bed342433956e1b6fae65d4f3b8effb5e	imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/memory_manager.py
100644 blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391	imports/ocade-jarvis/source-original/ocade jarvis 25-09/plugins/__init__.py
100644 blob b1bfa4235300d7626676f3b532cf87c4abb0ae3b	imports/ocade-jarvis/source-original/ocade jarvis 25-09/plugins/_template.py
100644 blob 401132d1d9682f2242d7c91f0beba48b8f4e1d67	imports/ocade-jarvis/source-original/ocade jarvis 25-09/requirements.txt
100644 blob d7bba74f52838123bea25fc4178b768454a59c98	imports/ocade-jarvis/source-original/ocade jarvis 25-09/setup.py
100644 blob 4d6fd610d5a4a5a2e6a9ec7f08d5170c0e172339	imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py
```
