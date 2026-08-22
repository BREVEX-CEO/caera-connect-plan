# OCADE production audit — final report

Branch `claude/ocade-production-audit-o0o22j`. Every number below was produced by
running the thing it describes, on the commit this file ships in.

The report is split the way the brief asked for: **EXECUTED** means a machine ran
it and I read the output. **SOURCE-FIXED** means the code is written and covered
by tests but the end-to-end path has not run here. **NOT PROVEN** means exactly
that, and those four items are listed as prominently as the rest.

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
| Cowork extension E2E, real Chromium                | **45/45 scenarios**                                                      |
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

Timings are **pipeline** latency, not inference latency: no production weights are
reachable from this environment, so the engine is a protocol-faithful fixture.
Every prompt has ground truth that exists before the engine answers.

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

## 5. Cowork — 45 scenarios in real Chromium

Every mutation is OBSERVE → ACT → OBSERVE AGAIN → VERIFY, and an action that
changes nothing is reported as _unverified_, never as done.

Proven: DOM/accessibility reads; click, type, navigate; SPA changes with no
navigation; tabs listed, opened, closed, and out-of-scope tabs withheld;
scope refusals on read, act and navigate; PAUSE, RESUME, STOP; STOP as a latch
resume cannot clear; the latch surviving a service-worker recycle; password and
one-time-code refusals with hand-over to the person, and the field verified still
empty; instruction-shaped page text stripped and counted; the website↔extension
bridge, and a website unable to grant or revoke its own scope.

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

## 7. Not proven

Four items. They are labelled this way in the code and the docs, not only here.

1. **Windows PC control.** Real pointer, real typing, OCR, window and app
   control, on Windows. The harness exists (14 tests driving a real desktop) and
   its protocol driver is executed on Linux, but the Windows API calls have never
   run.
2. **Real Chrome Stable Cowork.** Parity and the extension E2E are proven against
   Chromium. `dl.google.com` is blocked, so Chrome Stable is not present.
3. **Production CI.** §6.
4. **Production-model answer quality.** §4.

All four routes to a Windows machine were tested individually and are closed:
Actions gives no runner; there is no `/dev/kvm`, no `vmx`/`svm` CPU flag and no
qemu; Microsoft's image hosts are blocked; and `list_environments` returns one
Linux cloud environment.

**To close 1, 2 and 4:** run `npm ci && npm run windows:prove` on a Windows PC.
It refuses to run on any other platform, records a missing Chrome Stable as a
FAILED stage rather than a skipped one, and writes `windows-proof-evidence.json`.
See `docs/WINDOWS-PROOF.md`.

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
