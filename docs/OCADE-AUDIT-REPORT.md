# OCADE production audit — final report

Originally produced on `claude/ocade-production-audit-o0o22j`; reconciled on 23
August 2026 on `codex/ocade-production-completion-20260823`. Historical numbers
remain where useful, but the current release evidence ledgers are authoritative.

The report is split the way the brief asked for: **EXECUTED** means a machine ran
it and I read the output. **SOURCE-FIXED** means the code is written and covered
by tests but the end-to-end path has not run. **EXTERNALLY BLOCKED** requires a
credential, device, distribution identity or independently controlled target.

---

## 1. Final gate

| Gate                                               | Result                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Typecheck                                          | clean                                                                    |
| Lint                                               | 0 errors (pre-existing prettier warnings only)                           |
| Unit suite                                         | **338 files, 5,845 passed, 3 skipped, 0 failed**                         |
| Production build                                   | succeeds                                                                 |
| Asset budget                                       | largest JS 538.9/585.9 KiB; on-device engines 7,768/20,508 KiB, all lazy |
| Stage-2 + release gate scripts                     | 42 run, 40 pass, 2 environment-blocked (below)                           |
| Cowork extension E2E, real Chromium                | **69/69 scenarios** (measured by re-running the suite)                   |
| Chat prompts, shipped pipeline                     | **7/7**                                                                  |
| Real llama.cpp inference                           | **15/15 checks**                                                         |
| One model across three tabs + failover             | **8/8**                                                                  |
| WebGPU / WASM availability                         | **8/8**                                                                  |
| Flow-wave render                                   | **5/5**                                                                  |
| Settings signed-out / visual / signed-in / offline | **16 + 7 + 20 + 13 = 56**                                                |
| Python sidecar suite                               | **294 passed, 20 skipped**                                               |
| Python control engine                              | **30 passed**                                                            |
| Chrome + Edge CDP parity                           | `ok: true`, both browsers                                                |

Two gate scripts fail for environment reasons and are correct to fail:
`deploy:check` refuses without Cloudflare credentials (CI asserts it _must_
refuse rather than deploy), and `browser-catalogue:check` needs huggingface.co,
which is blocked. `browser:cdp-parity` passes, but only when run as a non-root
user — Chrome will not start its sandbox as root, and the managed host sets
`chromiumSandbox: true` deliberately, so root is the thing to avoid rather than
the sandbox. CI itself gets no runner at all (§6).

---

## 1b. Browser-first Cowork, and the adapter that was missing

The intended path for anything touching a web page is

    website → local model → agent loop → extension adapter → extension bridge →
    MV3 extension → the user's own browser

**The adapter did not exist.** `extension-bridge.ts` was imported by exactly two
things — a UI gate that reports whether Cowork can act, and its own test — and by
nothing that runs a task. Every `browser_*` tool the model can emit went the
other way: `use-mission` → a server function → the Node adapters → a native host
driving Playwright over CDP. So the extension was a fully working, tested
executor that nothing executed through, and browser Cowork silently required the
desktop companion that browser-first exists to remove.

Nothing failed, which is why no test caught it. A feature was simply served by
the wrong thing.

`src/lib/native/extension-adapter.ts` is that link, and both dispatch sites in
`use-mission` now try it first, falling through for everything else so PC
control keeps its own path.

Proven in real Chromium (69/69 scenarios): a `browser_read` tool
call comes back with the extension's own observation of a real tab, a navigate is
verified by the extension rather than by the adapter, an unapproved address is
still refused so the adapter cannot widen scope, `browser_key` refuses honestly
because the content script exposes no key dispatch, and a non-browser tool
returns `null` for the PC path. The OCADE tab drives a SECOND tab, which is the
product's real shape.

## 1c. Every route, in a real browser, at two widths

`npm run audit:routes:prod` builds the product and visits all 67 navigable
routes plus a deliberately invalid one, at desktop and phone width, signed out
and signed in: **613/613 and 613/613**.

It checks what a person would notice — that something usable rendered, that no
raw developer error reached the screen, that the page does not scroll sideways,
that no request outside loopback failed, and that every touch target meets the
WCAG 2.5.8 floor of 24x24.

The route list is read from TanStack's generated route tree rather than written
by hand. The hand-written version was wrong in both directions: it invented
`/support`, `/security`, `/callback` and `/verify` — child segments of `/settings`
and `/auth`, not addresses, so four "routes" were really the 404 page passing a
check that something rendered — and it missed `/demo/control`, `/demo/ocade`,
`/demo/settings`, `/auth/callback` and `/auth/verify`.

---

## 2. Defects found, fixed and regression-tested

23 in total. Each was reproduced first, root-caused, fixed, and covered by a test
that fails without the fix.

### Critical — sandbox and path boundaries

1. **Path-boundary escape in the local files pack.** `assertInsideRoot`
   case-folded canonical paths, so a crafted path escaped the sandbox root on a
   case-sensitive filesystem. Now resolves the caller's original path and
   compares unfolded realpaths.
2. **Path escape in the Python control engine's knowledge store.** Backslash
   separators and absolute/drive paths were not rejected. Now normalised and
   rejected, with containment proven by `relative_to`.

### High

3. **Native-host replies were correlated by POSITION.** Every reply went to
   `waiters.shift()`. One timeout desynchronised the stream permanently — the
   late reply went to the _next_ request, and every answer after it belonged to
   the previous question. On a channel that drives a real mouse and keyboard the
   reply that goes astray is the VERIFY step of observe → act → observe → verify.
   Fixed by correlating on a per-request `id` (not `runId`, which names a run and
   is shared across its requests); unmatched replies are dropped, never
   misdelivered.
4. **Login-resume trusted memory.** `handOver` recorded no observation and
   `control.resume` returned to RUNNING without re-reading the page — so the one
   moment the product was guaranteed to hold stale element references was right
   after a person signed in. Now checkpoints at hand-over and re-observes on
   resume, reporting STALE with the new observation.
5. **The app could not reach a local model runtime.** Its own CSP forbade the
   loopback probes it makes to find one.
6. **The Python control engine could not be imported off Windows.** One module
   imported `win32con` at module scope and took the whole test collection with
   it.
7. **Cross-tab model ownership did not exist.** Three tabs each loaded their own
   engine. Implemented with `navigator.locks` + `BroadcastChannel`, with owner
   failover.
8. **A signed-out dead end on `/ocade`.** No sign-in route was offered.

### Medium — found in this pass

9b. **Browser Cowork was executed by the wrong thing.** See §1b: the extension
adapter did not exist, so browser work needed a desktop sidecar.

9c. **A time bomb that went off mid-session.** `dispatchMobileIntent` was the
only time-dependent function in `src/lib/mobile` without an injectable
clock, so it always asked the real one while the tests pin devices to a
fixed date. Device trust expires after 30 days; the suites were pinned to
2026-07-23 and today is 2026-08-22. Thirteen tests began failing partway
through a session in which nothing about them had changed — confirmed
pre-existing by stashing the working tree. Fixed by adding the missing seam,
not by moving the date, which would only reset the fuse.

9d. **Touch targets below the accessibility floor**, on both marketing and
signed-in surfaces: footer links at 14-20px, "All settings" and "Back to
Settings", Refresh buttons, Lab/Studio cross-links, checkbox rows in four
settings panels, and the voice and appearance sliders. Two icon buttons on
/ocade/work were styled 36px and 28px but had no `shrink-0`, so flexbox
squashed them to 20px at phone width — a real defect that only exists on a
narrow screen.

9e. **Three hand-rolled copies of the footer link set** — the shell, the root
404 and the landing page — so 9d had to be found three times and would have
had to be fixed three times.

### Medium

9. **`pointer` told agents to retry the impossible.** A missing `pyautogui` came
   back as a raw `ModuleNotFoundError` under `retryable_failure` — an infinite
   retry on something that cannot succeed until a package is installed. All
   optional imports now route through `require(module, purpose)` and answer
   `unsupported` with a sentence.
10. **Captioning had never executed anywhere.** `ffmpeg-static` is built without
    libfreetype, so the caption branch always took its refusal path.
11. **Video editing tests passed vacuously.** `ffmpeg-static` ships no ffprobe,
    so every editing test returned early on a flag.
12. **ffmpeg decodes a .txt file as "ANSI art"**, so a text file was accepted as
    a video.
13. **The extension's stop latch lived in memory**, so an MV3 worker recycle
    resurrected a stopped run.
14. **Scope was recorded without the granted permission**, so approval could be
    recorded while Chrome had granted nothing.
15. **A website could attempt to change its own approved scope.** Now refused,
    with the attempt surfaced.
16. **Instruction-shaped page text was not stripped**, so page content could try
    to redirect the run.
17. **Asset-budget, Supabase-type and browser-discovery gates were failing.**

### Low

18–23. Misleading load errors that blamed the network for a missing table; a
Phase-35 gate dying on an artefact that never existed; browser discovery missing
snap/Debian/macOS locations; a typecheck error not caught by the test run; a
`require()` in an ESM test; and a settings census that counted a panel still
rendering.

### Defects in my own test harnesses

Nine, each of which would have produced a false report: clicks that bypassed a
modal overlay (661 controls counted that a user could not reach), `#main-content`
counted as a dead link, `window.__net` wiped by navigation, a proxy 403 read as
"reachable", a WebGPU claim made from the wrong page context, a vacuous
`true === true`, a fixed pause that sampled mid-render, an audit ordering bug
where the visual stage ran after settings flipped reduce-motion, and index-walking
a switch list that shrinks as dependent controls disable.

---

## 3. Chat — seven prompts, with timings

The table below remains the deterministic pipeline harness: its timings are
pipeline latency, not production-model latency, and every prompt has ground
truth before the engine answers. Production runtime behaviour is recorded
separately in `release/OCADE_CHAT_RUNTIME_EVIDENCE.json` so fixture timings are
never presented as model timings.

| #   | Prompt                                    | Correct | First token | Total | Answer                                       |
| --- | ----------------------------------------- | ------- | ----------- | ----- | -------------------------------------------- |
| 1   | factual — capital of France               | yes     | 10 ms       | 76 ms | "Paris is the capital of France."            |
| 2   | reasoning — 137 + 486                     | yes     | 3 ms        | 8 ms  | "623"                                        |
| 3   | multi-turn — recall a name two turns back | yes     | 2 ms        | 73 ms | "You said your name is Ada."                 |
| 4   | long — 6,316-character prompt             | yes     | 3 ms        | 58 ms | acknowledges 6,316 characters                |
| 5   | current information — fetched over HTTP   | yes     | 2 ms        | 9 ms  | "4818" (bulletin 4718 + 100)                 |
| 6   | offline — no route to any public host     | yes     | 4 ms        | 73 ms | "Paris is the capital of France."            |
| 7   | image — a real PNG to a vision model      | yes     | 3 ms        | 74 ms | "Received 1 image(s), 96 base64 characters." |

Engines: `qwen2.5:3b`, `llava:7b`. Prompt 5's source is loopback, **not** the
public internet, and says so. Prompt 6 **verifies** it is offline (two public
hosts probed, both refused) rather than assuming it. Prompt 7 inspects what the
engine _received_: the image arrived byte-identical — sending `images: []` fails
the test with "IMAGE DID NOT ARRIVE".

**Fast vs Thinking** — EXECUTED: the thinking flag reaches the engine, is _not_
sent to a model with no reasoning mode, and keep-alive avoids a cold start.

**Vision** — both browser engines refuse an image and name somewhere that can
read one, rather than answering from the text alone. No browser-tier vision model
is claimed.

---

## 4. Real local inference

The current fixed production path executed on Windows with the exact installed
`qwen2.5:3b` digest and `qwen2.5vl:7b` vision runtime: **19 observed, 0 failed,
0 skipped**. It covers text ground truth, streaming, cancellation, retry,
activation, fixed context bounds and a known-image vision readback. The
distribution gate binds that receipt to the model manifest and records the
remaining mirror, signing and licence/provenance blockers.

The small llama.cpp harness below is a separate **15/15 runtime correctness
test**. It proves GGUF load/export/inference mechanics, not general answer
quality.

Two models, answering two different questions.

**Random weights** — for timings and liveness only: cold load 21 ms, warm load
10 ms, first token 8 ms, 8 tokens in 25 ms, every id inside the declared
259-token vocabulary, not stuck repeating one token.

**Trained weights** — for correctness. No weight host is reachable
(huggingface.co and download.pytorch.org both 403), so the weights were _trained_
here: torch from PyPI, three capital-city facts deliberately overfit, exported to
GGUF. The architecture matches llama.cpp's `llama` arch — RMSNorm, no biases,
SwiGLU, and interleaved-pair RoPE (ggml NORM mode, not the split-half NEOX
variant, which is the trap: it trains identically and produces noise on load).

torch completes all three facts before export; llama.cpp completes all three
after it, byte for byte, through hand-built token ids that keep SentencePiece's
whitespace handling out of a runtime assertion. Negative control: expecting
"lyon" fails with `got "paris"`.

**This says nothing about production answer quality.** A 2-layer, 64-wide network
that has memorised three lines is not a language model.

---

## 5. Cowork — 69 scenarios in real Chromium

> **This heading said 45 while the summary table above said 52.** Two numbers
> for the same suite in one document, and both were stale. The count here is
> not copied from anywhere: it is what `npm run extension:e2e` printed on the
> current branch — `69/69 scenarios passed`. When those disagree again, the
> suite is right and this line is wrong.

Every mutation is OBSERVE → ACT → OBSERVE AGAIN → VERIFY, and an action that
changes nothing is reported as _unverified_, never as done.

Proven: DOM/accessibility reads; click, type, navigate; SPA changes with no
navigation; tabs listed, opened, closed, and out-of-scope tabs withheld;
scope refusals on read, act and navigate; PAUSE, RESUME, STOP; STOP as a latch
resume cannot clear; the latch surviving a service-worker recycle; password and
one-time-code refusals with hand-over to the person, and the field verified still
empty; instruction-shaped page text stripped and counted; the website↔extension
bridge, and a website unable to grant or revoke its own scope.

**Not proven, because it does not exist.** File upload through a page's file
chooser, and download management, are NOT implemented in the extension and are
not claimed anywhere in the product. The manifest used to declare an optional
`downloads` permission that no code ever used — a prompt the person was asked
to accept for an ability OCADE did not have — and that declaration has been
removed. `npm run extension:check` now fails on any declared permission the
source never calls, so the manifest cannot drift back into claiming a
capability the extension lacks. `browser_key` remains an honest refusal for the
same reason: the content script exposes no key dispatch, and it says so rather
than pretending.

**Login hand-off** — checkpoint recorded at hand-over; an untouched page resumes
from the same verified state; a page that changed comes back STALE with the new
observation attached; a tab that ended on an unapproved origin is refused by name.

**Screenshots** report honestly unavailable in this configuration rather than
failing silently. **Upload/download and multi-tab task sequencing** are
implemented but not covered by a scenario — SOURCE-FIXED, not proven.

Installation is never faked: the gate shows real `chrome://extensions` →
Developer mode → Load unpacked steps, and states plainly whether Cowork can act
in this browser.

---

## 6. CI

`.github/workflows/ci.yml` (12 jobs) and `.github/workflows/windows-proof.yml`
(3 jobs) both pass `actionlint`. CI now also triggers on `claude/**` branches.

**No job has run.** Every one of the 17 jobs is marked failed 2–3 seconds after
creation with no runner assigned and no steps. On 19 Aug the Linux jobs still ran
for 4–10 minutes while Windows and macOS died instantly; by 22 Aug all of them
die. That is an account-level Actions billing/spending block — the remedy is
**Settings → Billing → Plans and usage**, and Windows bills at 2× Linux, which is
why it stopped first.

So production CI is **NOT PROVEN**. Everything above was executed locally.

---

## 7. Current proof and external blockers

`npm run windows:prove` now passes **10/10** on a real Windows machine. That
includes 297 passing native-sidecar tests (17 capability-based skips), 14/14
live PC-control tests, 30/30 control-engine tests, 69/69 extension scenarios in
Chrome for Testing, and installed Chrome Stable/Edge CDP parity. See
`release/OCADE_WINDOWS_PROOF_EVIDENCE.json`.

The fixed local runtime also has a live 19/19 text, stream, cancellation,
recovery and vision receipt, with the installed model digest matched to the
resolved manifest. This closes the old statement that production weights were
unreachable; it does not prove broad answer quality or redistribution rights.

Still externally blocked: production CI; live Supabase migration apply and
post-apply RLS attacks; signed desktop/store distribution and clean-machine
upgrade/rollback; Android and iOS device matrices; same-origin browser model
mirrors; exact model/control-engine provenance review; production credentials,
support staffing and launch authority. `release/OCADE_RELEASE_BLOCKERS.json`
is the machine-readable authority.

---

## 8. How to re-run any claim here

```
npm run test                  # 338 files
npm run typecheck && npm run lint
npm run build && npm run performance:budget
npm run extension:check && npm run extension:e2e
npm run audit:chat            # the table in §3
npm run audit:real-inference  # §4
npm run audit:model-owner     # three tabs, one model, failover
npm run audit:engines         # WebGPU / WASM
npm run audit:settings        # signed out, visual, signed in, offline
npm run browser:cdp-parity    # needs a non-root user
npm run windows:prove         # Windows only — §7
cd native/python-host && python -m pytest tests/ -q
```
