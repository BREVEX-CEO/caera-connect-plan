# OCADE Phase 3 report (branch `ocade/p00-p22-implementation`, head `9eb1e63`)

Evidence labels: **VERIFIED** = observed in a run or test output named here. **CODE** = read in source, not exercised. **HYPOTHESIS** = inferred, unproven.

## 1. Main root cause (single biggest issue)

**The planning loop runs synchronously inside the device's HTTP request, one model call per mutation, with no persistent observation of the desktop.**

- `advance()` (`src/lib/jarvis/authority.server.ts:256`) runs inside the device receipt/claim door (`authority.server.ts:1072/1088/1094`). Each step therefore costs a full model round-trip while the device's request is held open: device timeout 170 s (`device-agent/windows/ocade_agent/device.py:125`), planner call timeout 145 s (`planner.server.ts:548`), provider turn 140 s and attempt 60 s (`edge-handler.ts:91,97`).
- Only read-only calls are batched (`planner.server.ts:1352-1366`). Every click, keystroke or save waits for a new model turn. A 10-mutation task means at least 10 serial model calls of 5–60 s each (Gemma first byte >25 s, VERIFIED in round 1, run 42421618278).
- The model plans blind between turns. There are no window or dialog event watchers. Obstacles (pop-ups, modal dialogs, format prompts) are found only when an action fails. Until this branch, a failure *after* focus was recorded as "effect unknown" and the task stopped for a person (blocker 2).

Every observed symptom traces to this shape:
- timeouts and `planner_stream_incomplete`
- "planner busy" (turn lease contention)
- slowness
- tasks that stall on the first dialog
- the free-tier token limit (16k input tokens/min, VERIFIED) spent by 6–9k-token prompts repeated per mutation (plan.md D47)

Model quality is a secondary factor. The loop cannot finish real tasks fast enough or reliably enough even with a good model.

## 2. Phase 1: the two authorised blockers

| # | Blocker | Root cause (verified) | Fix | Proof |
|---|---|---|---|---|
| 1 | Windows `_actable`/`hwnd` CI regression | `d9ba41c` added `_actable(window)`, which reads `window["hwnd"]`. Two receipt tests patched only `_leased` and passed `window={}`, which caused `KeyError 'hwnd'` (required job, run 43005106576) | The tests patch the acting lease `_actable` (`63817c8`). Production code is unchanged | Native receipt / COM job green on 43065385915, 43071773075, 43077356900 and 43102359630 (`9eb1e63`) |
| 2 | Focus refusals became "effect unknown" and stalled the task | `mark_effect()` ran *before* bringing the window forward (Windows `ui_send_keys`/`ui_click_point`; macOS `_front`). A later `focus_lost`/`window_blocked` therefore returned `maybeChanged: True`, the receipt became `unknown`, and the supervisor fenced the task (`jarvis_task_wait`) | `mark_effect()` moved to just before the real input (`63817c8`). Focusing a *control* still marks an effect, because it can commit edits. Unknown-effect safeguards are intact: anything after real input is still `maybeChanged: True` | New test `test_a_window_that_does_not_come_forward_changed_nothing` fails on old code and passes now. `tests/security/recovery.test.ts`: "a window that did not come forward changed nothing: the task plans again, no fence". Windows real desktop UIA-017 green (43065385915 onward) |

**Scope disclosure.** These commits went beyond the two literal blockers, because the regression tests for blocker 2 exposed the same stall on the real path:
- `fadfc8d` is test-only (answer the dialog through its lease).
- `fdc998d`: a key that closes its own window was reported as an error → title read first; invoke best-effort.
- `2428a16` and `4dcbf5d`: macOS typed under an app-modal NSAlert while reporting "observed". This was a *false success*, which is a safety issue → `AXModal` check, refused before anything is sent.
- `9eb1e63`: a blocking dialog was never listed, so it could not be leased and answered → macOS modal-panel layer; Windows owned untitled non-tool windows.

Each fix was driven by a failing hosted run. None weakens a safeguard. All are refusals or listings, never bypasses.

## 3. Defect register (prioritised)

| P | Defect | Evidence | State |
|---|---|---|---|
| P0 | Planning runs synchronously in the device request; one model call per mutation | `authority.server.ts:256,1072`; `planner.server.ts:1352`; timeouts above | CODE; symptoms VERIFIED in rounds 1–4 |
| P0 | No obstacle surfacing: dialogs and pop-ups are discovered only on failure; macOS AXObserver is target-window only | worker code; GIMP Escape refused `window_blocked` (probe 43065385915) | VERIFIED (probe) |
| P0 | Prompt size 6–9k tokens/turn vs a 16k TPM free tier | plan.md D47; round 4: 7 calls ≈ 20k tokens | VERIFIED (round 4 numbers in plan) |
| P1 | Live (config B) cannot compile goals: `invalid_goal` on 8/8 tasks | run 42427996732 | VERIFIED; the reason code (`invalid_goal_*`, D48) was added after the run and has not been rerun |
| P1 | compileGoal brittle: fixed validator, 2 attempts, no repair hint | `planner.server.ts:1278-1303` | CODE |
| P1 | `ui.inspect` returns no element handles; 150-descendant / 13 KB cap; owned-dialog controls mixed into the owner's tree | worker inspect | CODE |
| P1 | GTK apps (GIMP) expose no UIA tree; UIA `SetFocus` does not bring GTK windows forward; `_not_in_front` labels a same-pid foreground as `window_blocked` | probe 43065385915 | VERIFIED (probe) |
| P1 | CI `needs` chain: one unit failure or flake skips the whole desktop matrix | `.github/workflows/jarvis-cloud-validation.yml:390,481,570`; WebKit flake in 43077356900 skipped the matrix | VERIFIED |
| P1 | Push runs execute only the coding gate; the full matrix needs a manual dispatch. A dispatch made while a push is in flight can test the previous commit | run 43089136430 tested `4dcbf5d`; push run 43089136894 cancelled, then skipped | VERIFIED |
| P2 | Strict lease (`z.strictObject`) rejects the `apps.list` entry as given (extra `title`), so the model must strip keys | `contracts.ts:76`; `invalid_intent` in run 43062929242 | VERIFIED |
| P2 | Hybrid repair (C) swaps model for one turn only | `planner.server.ts` `repairing`; `edge-handler.ts` ordered route | CODE |
| P2 | No per-task app scope or `@app` selector at task start | `authority.server.ts:571` | CODE |
| P2 | Office in-place edit ignores the LibreOffice `.~lock` file (rename succeeds on macOS/Linux while Calc holds the file) | `office_worker.py:216` | CODE; HYPOTHESIS that it corrupts in practice |
| P2 | `benchmark.py` always exits 0 (`benchmark.py:487`), so a failed campaign shows green | code | CODE |
| P2 | Desktop probe Calc oracle fails: the probe's Name Box shortcut is wrong (128 typed into A1) | probe 43065385915 | VERIFIED; the defect is in the probe, not the product |
| P3 | Website polls every 2 s instead of subscribing | JarvisWorkspace | CODE |
| P3 | Cloudflare `waitUntil` limit is believed to be about 30 s, so background planning likely needs a Queue (hook exists, `src/cloudflare-entry.ts:158`) | — | HYPOTHESIS (limit unverified) |

Reviewed with no defect found:
- 231 database functions; 157 are `SECURITY DEFINER`, all with `search_path` set.
- RLS is on for every table.
- Credential-free probes of the staging functions returned 401/403/404 as designed.

## 4. Configurations A / B / C, model by model

Facts: rounds 1–4 gave **0/24 PASS** for every configuration (plan.md §19.4). No configuration has been rerun since the C12 fixes or since this branch's fixes.

| Config | Model / transport | Best observed (round 4, run 42427996732) | Structural fit |
|---|---|---|---|
| A | `gemma-4-31b-it`, streamed `generateContent` + function calling | Furthest of all: Windows `apps.list` → `apps.launch`; macOS `apps.list` → `ui.inspect` (7 calls, ≈20k tokens), then "planner busy" / `provider_failed` | Good: a text tool-calling model fits a planner. Weak points: slow first byte (>25 s observed), 16k TPM free tier |
| B | `gemini-3.8-live-extended-thinking`, Live API | 8/8 `invalid_goal` (checks failed the validator twice). Earlier rounds: key refused, then the session closed before the async call | **Poor fit**: audio-only output read via transcription, `NON_BLOCKING` calls, a per-turn ephemeral token and session, 1.5 s / 15 s settle (`live-session.ts:78,88,310`). It is built for voice, not for a step planner |
| C | A, then B as fallback / repair | `duplicate_completed` / `planner_stream_incomplete` on the Gemma leg | Inherits A's limits. B adds no repair value while B cannot produce valid goals. The repair swap (`0e2e312`) is untested against real models |
| default | `gemini-3.5-flash-lite` (production Standard) | **Never benchmarked** | HYPOTHESIS: probably the fastest standard tool-caller; unmeasured |
| High | `@cf/google/gemma-4-26b-a4b-it` (Workers AI) | Not benchmarked | Unmeasured |

**Recommendation (an assumption until a rerun confirms it):** use **A's shape** (a streamed text tool-calling model) as the planner. Benchmark `gemini-3.5-flash-lite` against `gemma-4-31b-it` on the same 4 tasks *before* choosing.
- Do not use Live (B) as a planner. Keep it only for the voice front end, where its transport fits.
- C makes sense only as "fast model plans; stronger text model repairs on a verifier failure" (both text models), not as Gemma + Live.

Evidence that would change this: B producing valid goals after the D48 diagnostics, or Flash-Lite failing the tool-call contract.

## 5. Architecture decisions

**KEEP**
- task authority with leases, consent grants (`app:`/`site:`), exact-target lease (pid + hwnd + start time)
- effect marking with unknown-effect fencing
- STOP/Take Over
- independent verification (`verify.checks`)
- allowlisted server-side model route
- three-key failover without quota pooling
- RLS and `SECURITY DEFINER` with `search_path`
- UIA patterns without synthetic input
- `keys.py` single keyboard contract
- the hosted desktop CI ladders (they found every real defect on this branch)

**FIX**
- Move `advance()` out of the device request: the device posts its receipt, gets 202, and receives the next step by nudge or claim. Planning runs in a background worker (queue; not `waitUntil` if its limit is ~30 s).
- Plan short *guarded batches* of mutations (plan-first, §13 step lists): execute locally and stop the batch at the first refusal, unknown effect or verifier miss. This keeps the safety model while cutting model calls.
- Delta prompts ≤3k tokens/turn (D47).
- compileGoal: return the validator's reason to the model on attempt 2.
- Accept an `apps.list` entry as a lease (ignore display-only keys server-side, still validate the identity keys).
- CI: run the desktop matrix on push, or decouple it from the unit jobs; keep checks required.
- `benchmark.py` exits non-zero on FAIL.
- Office edit: refuse when `.~lock.<name>#` exists.

**REPLACE**
- Live as a planner, replaced by a text tool-calling model (Live stays for voice).
- Website 2 s polling, replaced by a Realtime subscription (the nudge already exists).

**ADD**
- Desktop obstacle watcher: Windows `SetWinEventHook` (`EVENT_SYSTEM_DIALOGSTART` / `FOREGROUND`, owned windows); macOS app-level AXObserver (`kAXWindowCreatedNotification`, `kAXFocusedWindowChangedNotification`). New dialogs are reported with their lease in the next observation.
- Element handles in `ui.inspect` (stable within one observation).
- A vision fallback for no-tree apps (GTK, custom-drawn), with confidence thresholds; it already partly exists via region inspect.
- A per-model capability record, learned from provider responses.

**REMOVE**
- Live-specific settle heuristics from the planner path, once B leaves the planner.

## 6. Performance bottlenecks (what makes it slow, stall or time out)

1. Serial model turn per mutation (5–60 s each) inside a held HTTP request.
2. Gemma first byte >25 s (VERIFIED round 1); the attempt timeout is 60 s, the turn 140 s.
3. Prompt size vs 16k TPM: the second or third turn in a minute waits for or hits quota.
4. Live per-turn token mint + session open + 15 s settle when no call arrives.
5. Dialogs discovered only by failing actions (was a permanent stall before blocker 2's fix; now one wasted turn per obstacle).
6. Local execution is *not* the bottleneck: 3 key batches observed in 0.1–0.2 s (Windows probe, 43065385915).

## 7. Recommended repair order

1. Rerun the 24-run benchmark once on this branch after redeploying the staging intelligence functions (needs the owner's B1 approval). Add Flash-Lite as a fourth route. **Measure before redesigning.**
2. Asynchronous `advance` (queue worker plus nudge).
3. Guarded mutation batches plus delta prompts.
4. Obstacle watcher plus element handles.
5. compileGoal repair hint; lenient lease input.
6. CI decoupling; `benchmark.py` exit code; Office lock check.
7. Vision fallback for no-tree apps.

## 8. Tests and verified results on this branch

CI run results:

| Run | Commit | Result |
|---|---|---|
| 43005106576 | `d9ba41c` | Required Windows receipt job FAILED (`KeyError 'hwnd'`), which is blocker 1 |
| 43065385915 | `fdc998d` | Windows 2022/2025, installer and receipt jobs green; macOS 15 and Intel failed at MAC-014 (typing under the NSAlert reported as observed) |
| 43071773075 | `2428a16` | Windows and installer green; macOS 15 Intel failed MAC-014; macOS 15 cancelled (fail-fast) |
| 43077356900 / 43089136430 | `4dcbf5d` | `AXModal` refusal works on real macOS; MAC-014 failed only at "the dialog is listed", cascading MAC-008/009/011/012 to `window_blocked` |
| 43102359630 | `9eb1e63` | Green: coding gate, planner safety, PostgreSQL, Windows receipt (blocker 1), portable build, installer, ubuntu, **macos-15 and macos-15-intel (MAC-013/014 dialog path fully passes)**, **windows-2025 companion tests (UIA ladder incl. UIA-017, WindowListing)**. Cancelled at the 50-min job limit (workflow line 488): windows-2025 during desktop probe (after tests passed); windows-2022 during companion tests: Chocolatey LibreOffice/ffmpeg install took 39 / 44 min |

Not verified:
- any real-model benchmark after C12 or this branch
- Live function calls with real keys
- Flash-Lite and High models
- the Cloudflare `waitUntil` limit
- consumer PCs (runners are Windows Server and macOS cloud machines)
- staging functions run older code: service and intelligence v8 = `d9ba41c`, benchmark v7 = `67d889b`. Neither contains `0e2e312` (git ancestry checked), so C's repair routing is **not deployed**. The blocker fixes are on the device side and reach a PC only through the companion build

Coverage limits:
- 266 requirements and 84 concepts: not re-audited row by row. The plan's own counts are 77 PASS / 154 PARTIAL / 18 UNTESTED / 12 FAIL / 5 BLOCKED, and 44 / 39 / 1.
- 181 migrations: scanned for `SECURITY DEFINER` / `search_path` / RLS only.

## 9. Remaining blockers

- B1: owner approval per benchmark run (protected environment).
- Staging redeploy of the intelligence functions from this branch: needs the owner's go-ahead (deployment).
- B2: runners are not consumer PCs; A2 governs the owner's PC (not used).
- The P0 architecture items above are design work, not yet authorised.
- windows-2022 companion tests on `9eb1e63` and both Windows desktop probes: UNVERIFIED (job time limit hit by the engine install step, not a test failure). Next: cache or preinstall LibreOffice/ffmpeg, or raise `timeout-minutes` at workflow line 488, then rerun only those jobs.

## 10. Strongest practical architecture

Website (Realtime, no polling) → authority (leases, grants, fences; unchanged) → **queue-driven planner worker** → streamed text tool-calling model (Flash-Lite or Gemma, chosen by measurement; a stronger text model for repair on verifier failure) → **guarded batch** of 1–N mutations → companion executes locally (UIA/AX patterns, vision fallback) with an **obstacle watcher** that reports new dialogs as leasable windows → receipts with effect marking → independent verifier → repair or done. Live is used only for voice in and out.