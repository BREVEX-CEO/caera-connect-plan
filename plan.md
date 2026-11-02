# OCADE — Master Engineering Plan (v3)

> **Single authority for engineering scope, order, status and acceptance.** Restructured 2 November 2026 on `ocade/p00-p22-implementation` from baseline `0e1bdcb`. Read with `AGENTS.md` and `CLAUDE.md`; `docs/DECISIONS.md` and dated `evidence/` folders are history. `phases.md` does not exist in the repository (checked at `0e1bdcb`); it is not an authority.
>
> **What changed in v3:** the 266 requirements (Appendix A) and 84 concepts (Appendix B) are preserved word for word, each with a status and a work-package destination. The 236 research concepts are evaluated in Appendix C. Open defects live in Appendix D. The old “finish all 84 concepts and G0–G12 before any task evaluation” rule is replaced by continuous, quota-paced, hidden-answer task evaluation after every work package (owner instruction, 2 November 2026). Old P00–P22 and G0–G12 identifiers are mapped in §11 so no history is lost.

## 0. How to use this plan (one agent)

1. **Status lives here.** Appendices A–D of this file are the only live ledgers for requirements, concepts, research ideas and defects. `evidence/readiness/gates.json` remains the machine-checked commercial score. Older ledgers (`evidence/2026-11-01-audit/requirements-266.md`, `evidence/2026-11-01-live/architecture-ledger.md`, `evidence/2026-11-01-audit/codex-continuation.md`) are frozen history once W0 adds a pointer to this file.
2. **Work in order.** Take the first unfinished work package in §6 whose dependencies are met. Inside it, fix open defects from Appendix D first.
3. **One change loop** (§7): reproduce → smallest root-cause fix → focused tests locally → format → commit with test → push → focused CI → full matrix → update the appendix statuses in the same commit as the evidence.
4. **A status changes only with evidence.** PASS needs an independent test or measurement bound to a commit SHA and environment. Code existence, mocks and CI on Windows Server or a pre-authorised macOS runner never prove consumer-desktop behaviour.
5. **Never** hardcode applications, customer journeys, selectors, files, answers or outputs; never fake receipts or deliverables; never rotate Gemini keys to escape a shared-project rate limit; never weaken a test or a safety check to get green.

## 1. Owner decisions (binding, 2 November 2026)

| # | Decision | Consequence in this plan |
|---|---|---|
| O1 | Windows 10, Windows 11 and macOS are mandatory release platforms. | W5 and W6 are release-blocking. Windows 10 and 11 are qualified separately. |
| O2 | Linux is optional and never blocks Windows/macOS release. | Linux desktop work is W13 (optional). Its requirements stay visible and are never marked PASS without evidence. |
| O3 | Use the existing authorised Gemini model (`gemini-3.5-flash-lite`, `src/lib/intelligence/online-models.ts`) and free capacity only. | Accuracy and speed must come from engineering (§4, §5). If ≥90% is impossible with this model, record BLOCKED with evidence; do not lower the target. |
| O4 | No paid models, infrastructure, purchases or spending. | Code-signing certificates, paid runners, hosted point-in-time recovery and paid competitor accounts are deferred to the commercial phase (§10). |
| O5 | One coding agent only. No parallel coding sub-agents. | §7 is written for a single engineer. |
| O6 | Finish coding and cloud qualification before requesting real-PC testing. | Real-PC validation (RPC, §9) starts only after W12 passes, with separate approval. |
| O7 | No access to the owner's personal computer without separate approval. | — |
| O8 | Commercial preparation, recruitment, payments and launch come later. | §10 lists prerequisites only. Nothing is activated. |
| O9 | No `main` merge, production deployment or payment activation without authorisation. | — |
| O10 | All 266 requirements and 84 concepts stay traceable. | Appendices A and B. |
| O11 | No hardcoded application workflows, fixed answers or benchmark shortcuts. | Standing rule S; enforced by `npm run jarvis:no-hardcoded` plus metamorphic tests. |
| O12 | ≥90% independently verified first-attempt real-task success; higher is the ambition. | Release gate R5 (§8). |
| O13 | Zero known critical safety defects at release qualification. | Release gate R10 and Appendix D. |
| O14 | (1 November 2026, still in force) Free, non-deploying GitHub Actions validation on this branch is approved; CI stays secrets-free and never contacts production. | §7 CI tiers. No scheduled automations. |

**Standing safety invariants (unchanged, from `AGENTS.md` and the previous plan):** one task authority; Gemini is the only planner (online-only, never silently replaced by Offline Chat or a local model); every side effect is bound to account, device, task, grant, target identity, confirmation, idempotency key, STOP epoch and deadline, rechecked at server and device immediately before mutation; STOP is local and independent of the model; unknown effects are never repeated; originals are preserved and later user edits are never overwritten; no credential extraction, no UAC/MFA/CAPTCHA bypass, no automatic purchases; secrets never reach prompts, workers, pages, logs or CI; untrusted content (pages, files, tool output) never grants authority.

## 2. Verified status at `0e1bdcb` (2 November 2026)

These are separate measurements. Do not combine them.

| Metric | Value | Evidence |
|---|---|---|
| Requirements PASS | **70/266 (26.3%)** | Appendix A (conservative re-audit; historical 112/266 was not requalified clause by clause) |
| Requirements unfinished | **196/266**: 159 PARTIAL, 14 FAIL, 5 BLOCKED, 18 UNTESTED | Appendix A |
| Architecture concepts PASS | **41/84 (48.8%)** | Appendix B, `scripts/jarvis-traceability.mjs` |
| Architecture concepts unfinished | **43/84**: 41 PARTIAL, 1 FAIL, 1 BLOCKED | Appendix B (D14: #29 evidence now supports PARTIAL; correct in W0) |
| Commercial readiness | **10/100** (1/10 milestones; 17/42 conditions PASS) | `evidence/readiness/READINESS.md` at `654af50` |
| Cloud test success | Last all-green full matrix: run 64 (`654af50`). **Head `f04228d` is red** (run 70: 5 safety steps, formatting, DB job). 16 of 62 runs green between 1 and 2 November (many deliberate red reproductions). | [run 70](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41434622666), [run 64](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41352301838) |
| Real-task success (real Gemini) | **27/36 = 75%** first attempt on unseen randomised tasks, Linux container, 1 November. Not re-measured since. | `evidence/2026-11-01-eval-s11` … `s14` |
| Measured task time (39 live tasks) | Median 37 s. Model 56% of total time, device execution 6%, user waits 3%, **unaccounted ~34%** (device pickup polling backs off 1 → 30 s, `device-agent/windows/ocade_agent/agent.py`). Median 6 model calls, ~3.5 s each. | eval timing fields |
| Critical defects open | 0 confirmed | Appendix D |
| High defects open | 10 (D1–D6, D8–D10, D16); D4 and D16 are unverified risks | Appendix D |
| Genuine blockers | Consumer Windows 10/11 and macOS hardware (RPC); live Gemini runs on Windows/macOS cloud runners need a server they can reach (approval A1, §9); code signing (paid, deferred); hosted backup/PITR (paid tier, deferred) | §9, §10 |

## 3. Why development has been slow (evidence) and what changes

| Cause | Status | Evidence | Change in v3 |
|---|---|---|---|
| **Definition of done blocked task measurement.** The old plan forbade customer-task evaluation until all 84 concepts and G0–G12 passed on every platform. Work drifted to what CI can measure; success rate has not been re-measured since 1 November. | CONFIRMED | old plan §1.1, §5, §6; last 26 commits made no provider calls | Hidden-answer evaluation after every work package (§8 E-checkpoints), quota-paced. Safety gates stay hard vetoes. |
| Architecture and plan restarts | CONFIRMED (historical) | `5568893` deleted 228,292 lines (old engine, 30 Oct); DeepSeek harness added then retired; plan replaced 27 Oct and 31 Oct; testing authority flipped 19→20 Oct | Architecture frozen (§4). Change only with measured evidence. Plan amended in place, never replaced. |
| Shared-branch red/green churn | CONFIRMED | 35 of 62 runs failed, 10 cancelled by superseding pushes; head red since run 64 | Red reproductions stay local unless the defect only reproduces on Windows/macOS (§7). |
| Preventable formatting failures | CONFIRMED | runs 34, 52, 55, 70 failed on `format:check` | `npm run format:check` locally before every commit. |
| Five status ledgers that disagree | CONFIRMED | e.g. concept #29 says “no AX bridge exists” while MAC-001…012 pass (run 45) | Appendices A–D are the only live ledgers. |
| Evidence bloat in git | CONFIRMED | `evidence/` ≈ 339k lines; single commits of +54k | Commit compact summaries (≤50 KB per milestone); raw output stays in Actions artifacts. |
| Device pickup and model-call latency | CONFIRMED (code), size PROBABLE | §2 timing | W2 targets (§5). |
| Free-tier provider bursts | PROBABLE | planner “busy” after ~30–60 calls; third-party sources report free-tier Flash-Lite limits of roughly 10 requests/minute and 500/day (verify officially in W3) | Project-wide pacing and queueing (W3) instead of failing busy. |
| Scope breadth | CONFIRMED | 3 OSes, mobile, voice, 3D/video, embeddings | Kept (owner O10) but ordered by dependency; Linux optional (O2). |

**Highest-leverage root cause:** the absence of a fast, repeatable, real-model measurement loop. Every other priority was set without it. v3 fixes this first (W0–W3) and keeps it running after every package.

## 4. Target architecture (frozen; improve, do not replace)

```text
Customer web UI ──HTTPS──▶ Server task authority (Supabase RLS, grants, STOP epoch, journal)
                               │  generation permit + project-wide pacing
                               ▼
                     ocade-intelligence-service ──▶ Gemini (gemini-3.5-flash-lite, online only)
                               │  typed tool call(s) chosen by Gemini from a small shortlist
                               ▼
                     Policy gate (scope, target, risk, confirmation, idempotency, deadline)
                               │  wake signal (outbound) + signed claim
                               ▼
Device Agent / Local Gateway (installed once, outbound only)
   └─ persistent MCP/STDIO workers: fs/office · shell · web (Playwright) · ui_bridge (UIA | AX) · media · verify
                               │  receipts + observation deltas + previews on demand
                               ▼
                     Journal ─▶ Independent verifier ─▶ settlement + deliverables + timing
```

**Decision boundaries (unchanged):**

| Component | May decide | Must never |
|---|---|---|
| Gemini | Outcome checks (validated), next operation and arguments, revisions after evidence | Grant itself access, choose secrets, bypass policy, forge receipts, declare verified PASS |
| Supervisor / authority | Allowed transitions, leases, limits, dispatch or suspend, checkpoints | Substitute an app-specific workflow |
| Shortlist router | Which trusted healthy tools fit the turn | Plan tasks or confer authority |
| Policy gate | Exact permission, target, risk, STOP and idempotency admissibility | Trust model-written credentials or client claims |
| Gateway + workers | Execute primitive operations and report observed effects | Choose a customer itinerary or manufacture deliverables |
| Verifier | Judge observed postconditions with independent evidence | Accept model or tool success claims |
| Engineer (agent) | Build, debug and test infrastructure and harnesses | Direct production task actions or create outputs to fake acceptance |

**Component decisions:**

| Component | Decision | Reason |
|---|---|---|
| Task authority, journal, STOP, grants | KEEP | Correct design; defects are local (Appendix D). |
| Gemini pilot + supervisor loop (RTAA) | KEEP, IMPROVE | Fewer calls, request-bound checks, structured reads (W2, W3). |
| Perception (RTVC) | KEEP structured-first; ADD visual matching later | Screenshots on demand only; vision is last resort (W4). A persistent visual stream (Gemini Live) is used only if the authorised model and free tier support it; otherwise targeted frames. Local capture is never presented as continuous cloud perception. |
| Capability discovery + TF-IDF shortlist | KEEP | Measure shortlist recall; add embeddings only if recall <98% (W3). No local embedding model by default. |
| MCP/STDIO persistent workers | KEEP | Execution is 6% of task time; not a bottleneck. |
| Device pickup by backoff polling | REPLACE | Outbound wake signal + short polling while a task runs (W2). |
| Composite primitives (one call does a whole safe edit) | ADD | Fewer model turns without unsafe write batching (W2). |
| Windows UIA bridge | KEEP, IMPROVE | Depth (menus, grids, dialogs, COM via generic scripting), DPI and Windows 10 vs 11 (W5). |
| macOS AX bridge | KEEP, IMPROVE | Permission onboarding, Screen Recording for previews, packaging (W6). |
| Browser (dedicated OCADE profile) | KEEP, IMPROVE | Installed-browser discovery, file pickers, permission prompts (W7). |
| Verifier | KEEP, IMPROVE | Bind to the request, unrelated-file guard, deeper document/media/3D checks, sandboxed re-run of repaired code (W1, W4). |
| Installer | KEEP, ADD | Updater, dependency manager, macOS package (W8). |
| Local LLM router / creative-director vector DB (from research) | REJECT | Owner O3 and online-only rule; adds GBs to installer. |

**MCP/STDIO and gateway contract (unchanged):** official MCP initialise/list/call; stdout carries only protocol frames, logs go to stderr; each request ID is bound to task/action/lease; quotas, timeouts, payload limits, schema checks, cancellation and dead-child cleanup; the gateway launches only pinned trusted executables with sanitised environment and scoped working directory; an MCP return code is not verification. The gateway is the installed, outbound-only Device Agent; customers open no inbound port.

**Gemini key policy (unchanged):** three server-only key slots give pre-output failover for invalid-key or transport faults only. A project-wide 429 is never answered by rotating keys; it is answered by waiting (pacing, `retry-after`) and showing the task as queued.

## 5. Speed and accuracy engineering (the two central priorities)

### 5.1 Speed — measured bottlenecks first

Baseline (39 live tasks, Linux): median 37 s; model 20 s (6 calls × ~3.4 s); device execution 2.7 s; ~34% unaccounted (pickup polling, queueing, transport).

| # | Lever | Package |
|---|---|---|
| S1 | Instrument every phase per task: accepted → wake → claim → dispatch → worker start → effect → observation → verification → delivered, plus model latency and prompt tokens per call. | W2 |
| S2 | While the device has a running task, claim with no backoff (≤1 s interval, bounded by task duration). Idle wake via an outbound authenticated push channel (Supabase Realtime is on the free tier; verify limits) with a polling fallback capped at 10 s. | W2 |
| S3 | Return the next dispatched action in the response to the previous receipt (piggyback), removing one round trip per step. | W2 |
| S4 | Cut model calls: batch independent reads (already allowed); let the model request a short dependency-ordered list of reads executed locally; prefer composite primitives (`fs.edit_text` with several pairs, whole-workbook write, render-and-measure) over many small mutations. Writes stay one per turn unless they are independent new outputs (Codex finding: dependent write batching is unsafe). | W2, W3 |
| S5 | Smaller, stable prompts: fixed system prefix, observation deltas instead of full history, ≤8 tool descriptions of one line each. | W2 |
| S6 | Warm workers: start fs/shell/verify workers with the gateway; start the browser only when the shortlist contains web tools; keep it for the task. | W2 |
| S7 | Observations on demand: accessibility subtree with change detection; JPEG preview only when requested or for canvas apps; no screen scans every step. | W2, W5, W6 |
| S8 | Incremental verification: check each output as it is produced; final verification re-checks only changed artifacts. | W2, W4 |
| S9 | Large files and media: streaming reads, proxy previews, discovered hardware encoders when available, bounded render settings chosen by the model and measured. | W4 |
| S10 | Cross-application work without focus changes for file and native operations; foreground only for UI input. | W5, W6 |

**Targets (cloud measurement first, then RPC):**

| Metric | Baseline | Target |
|---|---|---|
| Task accepted → first device claim | up to ~31 s | p50 ≤1 s, p95 ≤3 s |
| Submit → first verified effect | not measured | p50 ≤8 s |
| Simple task (≤3 effects) end to end | — | p50 ≤20 s, p95 ≤45 s |
| Eval suite end to end | median 37 s, p95 79.7 s | p50 ≤25 s, p95 ≤60 s |
| Model calls per task | median 6, p95 11 | median ≤4, p95 ≤8 |
| Unaccounted time | ~34% | ≤10% |
| Native file operation | not measured | p50 ≤200 ms |
| UIA/AX action incl. revalidation | not measured | p50 ≤500 ms |
| Browser action incl. capture | not measured | p50 ≤1 s |
| Worker cold start / warm reuse | not measured | ≤2 s / 0 s |
| Agent idle CPU / memory (no browser) | not measured | ≤1% / ≤300 MB |
| Verification share of task time | not measured | ≤15% |

Validation: the live eval harness (`tests/jarvis/live_eval.py`) records the timing fields; targets are met only when the median and p95 over ≥30 tasks meet them on the stated platform.

### 5.2 Accuracy from the free model

| # | Lever | Package |
|---|---|---|
| A1 | **Request-bound outcome contract:** checks may reference only files/sites named in the request or new outputs; checks are immutable after start; editing an existing file to satisfy a check is refused unless the request asked for that edit. | W1 |
| A2 | **Grounded facts only:** facts, versions, addresses and file names must come from observations in this task; unseen deep URLs are refused (exists); “unknown” is an allowed answer. | W3 |
| A3 | **Structured perception primitives:** generic table reading (rows, headers, links per row), document outline, typed workbook ranges, filtered accessibility trees with stable observation tokens. Fixes the dense-table row failure (r1c) generically. | W3, W7 |
| A4 | **Short, precise tool descriptions** and a measured shortlist recall ≥98% on the eval set. | W3 |
| A5 | **Plan shape:** reads batched; one mutation per turn with its expected postcondition; replan only when the observation differs from the expectation. | W2, W3 |
| A6 | **Verifier feedback loop:** measured results go back to the model for at most two bounded repairs. | W3 |
| A7 | **Error taxonomy:** each failure carries a category (wrong target, stale, missing dependency, permission, provider) so the model and the eval can act on it. | W3 |
| A8 | **Uncertainty handling:** ask the person only when the choice is irreversible or materially ambiguous; otherwise take the reversible default and report it. | W3 |
| A9 | **Prompt-injection resistance:** untrusted content is fenced and labelled; it can never change scope, recipients or checks. | W1, W3 |
| A10 | **Model options inside the free tier:** measure whether the authorised model exposes reasoning-depth or structured-output settings and whether its computer-use tool is available on the free tier; adopt only what improves the hidden-answer score without exceeding quota. | W3 |
| A11 | **Fair evaluation:** randomised generators with hidden oracles; a regression set for every past failure (requirement 207); first attempt only; failures root-caused and tagged; ≥100 tasks across ≥3 days before a release claim, with a confidence interval. | W3, W12 |

**Quota discipline:** measure the project's real per-minute and per-day limits from provider responses; pace all calls project-wide below the per-minute limit; queue instead of failing; budget at most 60% of the daily limit for evaluation; never rotate keys on a project-wide 429. If the levers above cannot reach 90% on the hidden suite, record R5 as BLOCKED (model capability) with the evidence; the target is not lowered.

## 6. Work packages (dependency order for one agent)

Effort ranges assume one agent, free CI (~15 min per full matrix) and the free model quota; they are estimates, not promises. “E” marks an evaluation checkpoint (§8).

| WP | Objective | Depends on | Requirements (Appendix A) | Concepts (Appendix B) | Effort |
|---|---|---|---|---|---|
| **W0** | Green integration baseline and one-ledger workflow | — | 10, 43, 196, 214–215, 236–238 | 9, 22, 39–41, 44, 82 | 1–2 days |
| **W1** | Close open safety defects; request-bound verification; unknown-effect resolution | W0 | 13, 21, 32, 35–41, 66–69, 79–80, 171, 193, 210, 216, 220 | 4–5, 7, 21, 38, 50, 52–57, 61 | 4–8 days |
| **W2** | Speed: instrumentation, wake, piggyback dispatch, call reduction, warm workers | W1 | 81–94, 96 | 2, 42–43, 47–49, 51, 70, 78 | 3–6 days |
| **W3** | Accuracy: grounding, perception primitives, eval harness, quota pacing → **E1** | W2 | 23, 31, 33–34, 46–57, 60, 63, 65, 166, 197–199, 201–202, 204, 207, 219 | 6, 8, 10, 14–20, 23, 60, 77, 83 | 6–12 days |
| **W4** | Execution core and professional deliverables: mechanism fallback, files, documents, spreadsheets, media, 3D/CAD formats, code-repair verification, visual fallback → **E2** | W3 | 28–30, 61, 70–75, 77, 136–137, 211 | 25–27, 36–37, 69, 74–76 | 6–10 days |
| **W5** | Windows 10/11 desktop completion | W4 | 58–59, 122–130 | 11–12, 28, 32–35, 58–59 | 5–9 days |
| **W6** | macOS desktop completion | W4 | 131–132 | 11–12, 29, 32–33, 35, 58–59 | 5–9 days |
| **W7** | Browser and web completion → **E3** | W4 | 62, 76, 139–145 | 30–31, 33 | 3–6 days |
| **W8** | Installer, dependencies, versioning and updates (Windows + macOS) | W5, W6 | 44–45, 97–120, 185–190, 217 | 13, 24, 45, 65, 68 | 6–10 days |
| **W9** | Customer product surface (web, onboarding, devices, approvals, deliverables, voice, mobile web) | W8 | 146–160, 221 | 71–73 | 6–12 days |
| **W10** | Security, privacy, backend and operations | W9 | 78, 161–165, 167–170, 172–173, 175–182, 212, 222 | 46, 62–64, 66–67 | 5–8 days |
| **W11** | Proof-based debloat and evidence hygiene | W10 | 243 | 81 | 2–4 days |
| **W12** | Full cloud qualification campaign → **E4** | W11 | 3, 138, 191–192, 194–195, 200, 205, 208, 218, 223–224 | 1, 79–80, 84 | 7–14 days (quota-bound) |
| **W13** | Linux desktop (optional, non-blocking) | W4 | 134–135 | — | optional |
| **RPC** | Real-PC validation (Windows 10, Windows 11, macOS) after separate approval → **E5** | W12 | 121, 133, 209 | — | per approval |
| **COM** | Commercial prerequisites (deferred, §10) | RPC | 259 | — | later |

Total before RPC: roughly 59–110 agent-days, dominated by W3/W12 evaluation pacing inside the free quota.

**Standing rules (S)**, verified at every release gate rather than in one package: 1–2, 4–9, 11–12, 14–20, 22, 24–27, 42, 64, 95, 174, 183–184, 203, 206, 213, 225–235, 239–242, 244–258, 260–266. Standing concept: 3.

### W0 — Green integration baseline (first)

- Fix the run 70 failures at `f04228d` (D1): finish the in-flight verifier, revocation, media-scope and gateway-boundary repairs that the red tests describe, then run the full matrix to green.
- Add a pointer at the top of the three frozen ledgers to this file (D14). Correct concept #29 in `scripts/jarvis-traceability.mjs` and the ledger to PARTIAL with run 45 evidence.
- Adopt the §7 loop: local `npm run format:check`, typecheck and focused suites before every push.
- Evidence policy: commit only compact summaries; raw logs stay in Actions artifacts.
- **Exit:** full matrix green on the head; ledgers consistent; `npm run jarvis:traceability` and `npm run readiness` agree with Appendices B and §2.

### W1 — Safety closure and request-bound verification

- Close D2–D7: verifier web visibility and origin rules, held-claim permission recheck, SSRF/DNS/redirect review for verifier and browser, unknown-effect resolution (show the person what may have changed; let them confirm, inspect or discard; never auto-repeat), original-file and directory race, anti-gaming (A1).
- Network outage → clear task state transition (requirement 193).
- **Focused tests:** existing security suites plus a gaming regression (model tries to edit an input to satisfy a check; must be refused), an unknown-effect resolution flow, and permission revocation mid-turn.
- **Exit:** Appendix D has no open critical/high safety defect from this list; full matrix green.

### W2 — Speed

- Implement S1–S8. Measure before and after each change on the same synthetic tasks (synthetic provider for mechanics, a small paced live sample for model time).
- **Exit:** pickup p95 ≤3 s; unaccounted time ≤10%; model calls median ≤5 on the live sample; no safety regression.

### W3 — Accuracy and the evaluation loop

- Implement A2–A11 and quota pacing. Extend `tests/jarvis/live_eval.py` with generators for every category in §8, hidden oracles, the regression set (requirement 207), hidden-target accuracy (requirement 65) and user-effort counting (C63).
- Verify official free-tier limits for the authorised model in the provider console or API responses (no spending).
- **E1:** ≥40 fresh tasks on Linux, paced. Record first-attempt success, calls, timing, failure categories.
- **Exit:** E1 recorded; every failure category has an owner package or a fix; ≥85% first attempt on E1 is the working target before W4 (not a release claim).

### W4 — Execution core and professional deliverables

- Mechanism fallback (requirement 30): when a structured mechanism fails or is unavailable, offer the next allowed mechanism with fresh observation; never repeat the same failing call.
- Deliverables: workbook formulas and ranges (71); document structure and formatting (72); image properties and perceptual difference checks (73); video edit verification — cuts, durations, audio presence, frame statistics (74); code repairs re-run in a sandboxed copy with no network and a time limit (75); 3D/CAD through open interchange formats (glTF/OBJ/STL) with geometry statistics.
- Professional applications (Blender, office suites, editors) are used only through **generic** mechanisms: discovery, confirmed `shell.run` of the application's own command-line or scripting interface, file formats, UI automation. No application-name branches.
- Visual fallback (36, 61): template or feature matching with confidence threshold and post-action check, used only when no structured target exists.
- Recoverable deletion (C24): deletions go to the Recycle Bin/Trash; permanent deletion needs explicit confirmation.
- **E2:** ≥40 tasks including documents, spreadsheets, media and repairs.

### W5 — Windows 10/11 desktop

- UIA depth: menus, context menus, virtualised lists and grids, tabs, dialogs, file pickers; COM object models through confirmed generic scripting; Win32 fallback.
- Packaged-app discovery (UWP/MSIX/Store, App Paths, Start Menu, associations) (C26).
- DPI, zoom and multi-monitor coordinate transforms (58, 127): unit-tested transforms plus runner tests with changed scaling where the runner allows; real multi-monitor stays UNTESTED until RPC.
- Windows 10 vs 11 differences to test explicitly: packaged inbox apps (e.g. the Windows 11 Notepad and Paint are packaged apps), default terminal, Start menu layout and shortcuts, WebView2 presence, UIA provider differences, PowerShell 5.1 availability, Smart App Control (Windows 11). Cloud proxies: `windows-2022` (Windows 10-era build line) and `windows-2025` (Windows 11-era build line). These are Server editions; consumer qualification remains RPC.
- Standard user, UAC denial, OneDrive and Unicode/long paths (128) where the runner allows; sleep/lock (129) at RPC.
- **Exit:** UIA ladder plus new cases green on both runner images; remaining consumer-only items explicitly UNTESTED with an RPC test.

### W6 — macOS desktop

- AX depth equal to W5; Accessibility permission onboarding, revocation detection and plain-language guidance (132).
- Window previews need Screen Recording permission on current macOS (D16): detect, guide, and degrade to AX-only when not granted.
- Packaging: PyInstaller `.app` bundle with the bundled browser, Apple Silicon first; Intel when a free Intel runner exists, otherwise BLOCKED for RPC (133). Gatekeeper/quarantine diagnosis without bypass (113).
- **Exit:** MAC ladder plus new cases green on `macos-14`/`macos-15`; permission flows tested with permission withheld where the runner allows.

### W7 — Browser and web

- Installed-browser discovery (139) for executable choice; keep the dedicated OCADE profile (no cookie or password extraction).
- File pickers, permission prompts, downloads, popups, redirects and auth challenges (142); dense tables (A3); fix D11.
- **E3:** web research and authorised website tasks.

### W8 — Install, dependencies, versioning, updates

- Dependency manager (97–120): detect, propose exact package/source/version/hash/licence, confirm, install unelevated where possible (official UAC only), journal, verify, resume the task.
- Version negotiation and actionable upgrade refusal (44, 45).
- Updater with integrity check, staged replace, rollback and no update during a running action (188, 189); upgrade/repair/rollback tests between two built versions (187).
- Reproducible Windows and macOS builds; ARM64 decision recorded (104). Redistribution licence inventory (182).
- Signing hooks exist; certificates are COM (paid).

### W9 — Customer product

- All surfaces in 146–160: onboarding (install → sign in → pair → grant → first task), device states, live progress, exact approvals, STOP/Take Over/Continue/Retry/Remove, deliverable download/preview, Library, Settings, Usage, admin; accessibility; responsive/PWA; voice per existing scope (155); Android companion only if already scoped (157); iOS browser/PWA only (158).
- Minimal outcome-first UI principles (C1–C12).

### W10 — Security, privacy, operations

- Headers/CSP/CSRF (168); threat model (170); XSS/SQLi/SSRF/IDOR tests (169); secret canary end to end (167); log redaction tests (176); crash reports and health (177); export and deletion (179); rate limits and backpressure (164, 165); migration rollback strategy (163); legal and support drafts (180, 181); disposable restore drill is done, hosted restore is COM (172).

### W11 — Debloat and evidence hygiene

- Execute `ToRemove.md` candidates only with traced callers and parity tests; remove orphans; archive bulky evidence; measure installer size, startup and memory before/after.

### W12 — Full cloud qualification (§8)

- Run every §8.2 category and §8.3 on the runner platforms; record per-category results, timing, calls and blockers; root-cause each failure, fix, and rerun only the affected categories plus the full matrix.
- **Exit:** E4 ≥90% first attempt on ≥100 hidden tasks; R1–R9 PASS or BLOCKED only for consumer-hardware items; then request approval A2.

## 7. One-agent workflow

1. **Before starting:** read this file's §6 row and Appendix D entries for the package. Do not re-investigate a defect whose entry records the cause.
2. **Reproduce locally** (Linux container: TypeScript, Python, PostgreSQL, Chromium, Xvfb, ffmpeg). Push a red-only test commit **only** when the defect reproduces exclusively on Windows or macOS runners; the fix follows before any other work.
3. **Fix the shared root cause.** No sleeps, retries or flags to hide a race.
4. **Local gate before every push:** `npm run format:check`, `npm run typecheck`, focused TS/Python/DB suites for the touched owner, `npm run jarvis:protocol-check` when contracts change, `npm run jarvis:no-hardcoded`.
5. **CI tiers:** preflight (formatting + focused safety, ~2 min) gates the full matrix (~15 min). Do not push again until the previous run finishes unless the earlier commit is known-bad. Documentation-only commits use `[skip ci]`.
6. **Evaluation runs** are manual, quota-paced, from the agent container against staging; never from CI with secrets (§9 A1).
7. **Record:** update Appendices A–D and §2 in the same commit as the evidence. Evidence summaries ≤50 KB per checkpoint.
8. **Report** after each package: package, SHA, tests run/passed/failed/skipped, measured speed and accuracy, status changes (IDs), defects opened/closed, blockers.
9. **Never:** scheduled automations, new paid services, secrets in CI, hand-edited `protocol.json`, rotation on 429, deleting tests to get green.

## 8. Evaluation checkpoints and final cloud qualification

### 8.1 Evaluation checkpoints (E1–E5)

Each checkpoint runs fresh randomised tasks with hidden oracles, first attempt only, paced inside the free quota. Report denominator, PASS/FAIL/BLOCKED counts, failure categories, timing and model calls.

Outcome states: **PASS** only with a real effect and independent checks; **PARTIAL** when the deliverable is incomplete; **FAIL** when attempted and checks fail; **BLOCKED** when the environment, consent, provider or tool is unavailable; **UNTESTED** when not attempted. Success rate = independently verified complete eligible tasks ÷ all eligible attempted tasks; publish the denominator and the failed/blocked counts. The test harness supplies only the objective, permitted inputs and scopes; it never creates deliverables.

| Checkpoint | After | Minimum tasks | Platforms |
|---|---|---|---|
| E1 | W3 | 40 | Linux |
| E2 | W4 | 40 | Linux |
| E3 | W7 | 40 | Linux, Windows runner, macOS runner (needs A1) |
| E4 | W12 | ≥100 over ≥3 days | Windows 2022, Windows 2025, macOS runners (needs A1); Linux optional |
| E5 | RPC | ≥30 per platform | Windows 10, Windows 11, macOS (consumer hardware) |

### 8.2 W12 campaign — categories

General PC tasks; unknown and randomly named applications; editing a real, lawfully reusable photograph; complex file management; browser research and authorised website tasks; spreadsheet processing and reconciliation; professional documents and reports; editing existing user files; repairing broken files and software errors; installing or configuring approved software; interrupted-work recovery; STOP and Take Over; redirects and permission revocation; multiple windows and documents; display scaling and multi-monitor (runner-limited; RPC for real hardware); Windows 10 vs 11 proxies; macOS; adversarial and hidden-answer tests; security and permission tests; performance and resource measurements; install, uninstall, update and rollback.

### 8.3 Advanced creative acceptance (real agent output only)

1. An editable, professionally detailed 3D supercar model.
2. Blender (GPL) or another legitimately available 3D application may be pre-installed on the disposable runner **by the test environment**, as a customer might have it; OCADE must discover and choose it through generic mechanisms.
3. A cinematic supercar advertisement of approximately 60 seconds, edited and rendered by the agent.
4. **Measured checks (test-side oracles only):** editable project re-opens; exported geometry statistics (objects, vertices, materials, bounding box); render completes at the requested resolution with no blank frames; video duration 60 s ± 2 s, frame rate, codec, audio stream present; scene-change and frame-difference statistics; asset provenance and licences; cross-application chain (3D → video → report) recorded in receipts.
5. **Human quality review** of “professional” and “cinematic” is recorded at RPC; cloud results report technical checks only.
6. **Free-runner limits:** CPU-only runners and a 6-hour job limit. Headless rendering is practical with Cycles CPU; Eevee needs EGL/Mesa (unverified on GitHub runners). If the agent cannot finish within these limits, record FAIL or BLOCKED with the measured render time and the RPC validation method. Never use prebuilt answer files or staged outputs.

### 8.4 Release gates

| Gate | Condition | Old mapping |
|---|---|---|
| R1 | Repository baseline: integrity, contracts, no-hardcode, audits, reproducible builds | milestone 10%, G0, G1 |
| R2 | Core gateway and device authority incl. journal and crash recovery | 20%, G2, G3, G6, G8 |
| R3 | Installer, dependencies, updates (Windows + macOS) | 30%, G3 |
| R4 | Computer and browser control (Windows UIA, macOS AX, browser) | 40%, G7 |
| R5 | Gemini grounding: ≥90% first attempt on E4 hidden suite | 50%, G9 |
| R6 | Independent verification and recovery | 60%, G10 |
| R7 | Customer product | 70% |
| R8 | Security, infrastructure, operations | 80% |
| R9 | Platform and performance qualification (targets in §5.1) | 90%, G11 |
| R10 | Final qualification: all mandatory gates, RPC passed, zero known critical safety defects, all 84 concepts PASS or explicitly excluded optional-Linux items | 100%, G12 |

## 9. Owner approvals needed later (free; asked only when the work reaches them)

| ID | Approval | Why | When |
|---|---|---|---|
| A1 | Let live Gemini tasks run on Windows/macOS cloud runners: either (a) a protected GitHub Actions environment holding staging server secrets used only by a server step that is isolated from agent-controlled commands, or (b) a free staging deployment of the web worker that runners can reach. | The device agent on a runner needs a reachable task server; the current server runs only inside the agent container. Without this, E3/E4 on Windows/macOS are BLOCKED. | Before E3 |
| A2 | Real-PC validation on Windows 10, Windows 11 and macOS machines (spare or owner-provided), with an exact test list, data, duration and STOP procedure. | Consumer-only behaviour (DPI, multi-monitor, UAC, antivirus, sleep, OneDrive, Accessibility grants). | After W12 |
| A3 | Close stale Dependabot PRs targeting deleted `/jarvis-runtime`. | Repository hygiene (outward action). | W11 |

## 10. Path to commercial launch (deferred; nothing activated)

After RPC passes, in order: code signing (Windows Authenticode; Apple Developer ID and notarisation — paid, owner); release and rollback procedure with staged channels; hosted backup/PITR and a restore drill; legal review (terms, privacy, licences); support runbooks and incident response; pricing and payments (owner); closed beta with measured success, intervention and retention; competitor benchmark (259) on identical hidden tasks where accounts are available; production deployment and `main` merge with explicit approval.

**Competitive objective (to be proven, not claimed):** win on correct verified completion, local-PC execution speed, native application depth, recovery after interruption, editable professional deliverables, independent proof of success, permissions and privacy, low customer effort and cost. Competitors to benchmark when allowed: Gemini computer use (Gemini 3.5 Flash, Gemini 4 Argon — preview), Claude computer use (desktop app), ChatGPT agent (cloud VM), Manus “My Computer” (local Mac/Windows), OpenClaw (open-source, self-hosted).

## 11. Provenance mapping (old identifiers)

| Old | New |
|---|---|
| P00 | W0 |
| P01–P04 | W1 (contracts, permissions, authority, STOP) |
| P05, P20 | W8 (enrolment kept in W10 audit) |
| P06–P08 | W3 (discovery, registry, shortlist) and W5/W6 (platform discovery) |
| P09–P10, P13–P14 | W1, W2, W4 |
| P11 | W7 |
| P12 | W5, W6 |
| P15–P16 | W2, W3 |
| P17–P18 | W1, W4 |
| P19 | W9 |
| P21 | W11, W12 |
| P22 | R10 |
| G0–G12 | R1–R10 (§8.4) |

History: architecture checkpoint 31 Oct (`evidence/2026-10-31-architecture/`), live Gemini checkpoint 31 Oct (`evidence/2026-10-31-browser/`), cross-platform CI and live repair 1 Nov (`evidence/2026-11-01-live/`), randomised evals (`evidence/2026-11-01-eval-s11` … `s14`), Codex safety checkpoints (`evidence/2026-11-01-audit/codex-continuation.md`). The previous plan text is in git history at `0e1bdcb`.

## Appendix A — The 266 requirements (verbatim) with status and destination

Format: `STATUS` · **destination** — original text. Status source: independent re-audit at `f04228d` (`evidence/2026-11-01-audit/requirements-266.md`, current-review column); it is the conservative lower bound. **S** = standing rule verified at every release gate. **RPC** = needs real-PC validation. **COM** = commercial phase. **W13** = optional Linux; never counted as PASS without evidence and never blocking Windows/macOS release.

Original preamble (1 November 2026): this owner checklist complements the 84 concepts; it does not authorise merging into main, production deployment, payments, certificate acquisition, spending, irreversible changes, or exposing secrets. Preconfigured staging credentials may be used for authorised staging tests with least privilege and strict non-disclosure.

#### OCADE — Complete Commercial Launch Readiness | Continuation Prompt

#### Rules and execution requirements

1. `PASS` · **S** — Continue directly from the current OCADE development session. Do not restart the project, repeat completed research unnecessarily, or create another architecture proposal without implementing the required changes.
2. `PASS` · **S** — Work exclusively on `ocade/p00-p22-implementation` in `BREVEX-CEO/caera-connect-plan`. Never merge into `main`, deploy to production, enable payments, spend money, or access my physical computer without my explicit approval.
3. `PARTIAL` · **W12** — Your objective is to make **OCADE BY CARCC** a genuinely functional, independently verified, public-ready commercial software product across every officially supported component and platform.
4. `PASS` · **S** — **Do the actual coding.** Inspect, reproduce, fix, implement, integrate, simplify, test, and independently verify. Documentation alone is not progress.
5. `PASS` · **S** — Preserve the existing local-first architecture: Gemini intelligence, task supervisor, local Device Agent, trusted Gateway, MCP/STDIO capability workers, execution controller, independent verifier, and customer-facing website.
6. `PASS` · **S** — Do not rewrite functioning architecture merely to make it appear more advanced. Change architecture only where evidence proves a correctness, security, reliability, performance, scalability, or maintainability benefit.
7. `PARTIAL` · **S** — Read the current `plan.md`, `CLAUDE.md`, `AGENTS.md`, architecture ledger, prior evidence, tests, repository structure, and relevant implementation files before modifying an existing component.
8. `PARTIAL` · **S** — Inspect actual Git history, branch HEAD, local changes, staging configuration, package versions, workflows, tests, and unresolved blockers. Treat historical reports as evidence, not as proof of current functionality.
9. `PASS` · **S** — Preserve all existing authorized changes. Never overwrite another developer's edits, delete important tests, or revert unrelated work.
10. `PARTIAL` · **W0** — Maintain a verified inventory of every application surface, architectural concept, feature, dependency, security boundary, test, and release requirement.
11. `PASS` · **S** — Classify every finding as **PASS, PARTIAL, FAIL, BLOCKED, or UNTESTED**. Never label a feature complete solely because code exists.
12. `PASS` · **S** — Separate confirmed defects from inferred risks, missing functionality, incomplete integration, and insufficient testing.
13. `PARTIAL` · **W1** — Fix every reproducible critical and high-priority defect. For any unresolved issue, document the exact blocker and keep the release gate closed.
14. `PASS` · **S** — Do not claim 100% bug-free software. The objective is **100% completion of verified launch requirements, zero known critical safety defects, and at least 90% independently verified success on representative real tasks**.
15. `PASS` · **S** — Prioritize **P0 safety and correctness → P1 production reliability → P2 performance and polish**. Do not prioritize cosmetic features ahead of broken task execution.
16. `PARTIAL` · **S** — Implement improvements in small, reversible, reviewable changes with focused regression tests. Run relevant tests after every change and broader tests after integration.
17. `PASS` · **S** — Use cloud infrastructure for testing first. Only request access to my computer after supported cloud tests pass and real consumer-device testing cannot be completed otherwise.
18. `PASS` · **S** — Prefer existing free, authorized testing environments and already configured services. Do not create unapproved cloud resources or trigger costs.
19. `PASS` · **S** — Keep the repository private or public according to its actual authorized configuration. Never change visibility without approval.
20. `PASS` · **S** — Do not modify production secrets, production data, access policies, or release channels without authorization.

#### Architecture and execution

21. `PASS` · **W1** — Retain **one coherent task-authority system** responsible for task state, permissions, ownership, STOP, takeover, continuation, action dispatch, and truthful completion status.
22. `PASS` · **S** — Keep Gemini as the configured online planning brain. Do not secretly switch to another model, invent a local JARVIS fallback, or create competing autonomous planners.
23. `PARTIAL` · **W3** — Preserve the configured model-routing policies and approved provider credentials. Validate actual model availability, quotas, limits, and failure behavior before making model changes.
24. `PASS` · **S** — Keep capability-based execution. No production code may depend on predefined customer applications, filenames, specific user tasks, demonstration journeys, or hardcoded results.
25. `PASS` · **S** — **Never hardcode files, answers, browser paths, application names, selectors, commands, expected output documents, or special-case workflows merely to make a test pass.**
26. `PASS` · **S** — Test fixtures may contain synthetic files and independent expected results, but production logic must solve unfamiliar inputs using general capabilities and observed state.
27. `PASS` · **S** — Do not replace genuine execution with fake receipts, simulated task completions, generated success messages, or pre-created deliverables.
28. `PARTIAL` · **W4** — Preserve the intended execution preference: native APIs and object models → supported scripts and CLI → native file/project operations → browser DOM/CDP → Playwright → OS accessibility → vision/coordinates when needed.
29. `PARTIAL` · **W4** — Choose the fastest reliable mechanism for each step based on actual capabilities, permissions, cost, observability, and failure risk.
30. `FAIL` · **W4** — Add automatic **mechanism fallback** where safe. If DOM interaction fails, inspect available alternatives rather than blindly repeating the same action.
31. `PARTIAL` · **W3** — Improve the supervisor so it maintains objective, target state, milestones, permissions, available capabilities, current observations, completed actions, unresolved uncertainty, and remaining work.
32. `PARTIAL` · **W1** — Store durable task state independently of Gemini's conversational context so interruptions and context truncation do not destroy progress.
33. `PARTIAL` · **W3** — Add a bounded receding-horizon planner: plan enough to act effectively, execute, observe the result, then replan only when necessary.
34. `PARTIAL` · **W3** — Separate **planning, action execution, result observation, and verification** into explicit interfaces and states.
35. `PARTIAL` · **W1** — Give every action a unique identifier, task identifier, target identity, permission context, deadline, and observable outcome.
36. `PARTIAL` · **W1** — Prevent duplicate side effects after retries, server restarts, timeout responses, disconnections, or acknowledgement failures.
37. `PARTIAL` · **W1** — Preserve receipts distinguishing **executed, verified, refused, failed, cancelled, and outcome unknown**. Never infer success from a dispatched command.
38. `PARTIAL` · **W1** — Improve persistent journaling, recovery checkpoints, durable action reconciliation, and crash-safe resumption.
39. `PARTIAL` · **W1** — Do not automatically repeat destructive or externally visible operations when the previous effect is uncertain.
40. `PARTIAL` · **W1** — Implement reliable ownership fences so STOP, Take Over, revocation, sign-out, device removal, and task cancellation prevent new unauthorized actions.
41. `PARTIAL` · **W1** — Ensure an in-flight operation either stops safely or reports honestly what may already have changed.
42. `PASS` · **S** — Keep the Gateway modular. Do not introduce one microservice per tool or turn the 84 architectural concepts into 84 separate services.
43. `PASS` · **W0** — Establish stable typed contracts between planner, task authority, Gateway, workers, verifier, and user interface.
44. `PARTIAL` · **W8** — Add version negotiation and compatibility checking between the website/backend, Device Agent, Gateway, and bundled workers.
45. `PARTIAL` · **W8** — Refuse incompatible components with actionable upgrade instructions rather than continuing unpredictably.

#### Gemini accuracy and grounding

46. `PARTIAL` · **W3** — Fix the demonstrated Python.org wrong-download failure generically. Gemini must distinguish the correct release row, release version, artifact type, platform, architecture, and actual download target.
47. `PASS` · **W3** — Do not fix that failure by hardcoding Python.org, the current version, a specific download address, page row, CSS selector, or table position.
48. `PARTIAL` · **W3** — Build or strengthen an evidence-grounded **Target Resolution Layer** that connects model-selected intent to an observed, unambiguous DOM element, accessibility element, file, process, or application window.
49. `PARTIAL` · **W3** — Assign temporary observation-scoped identities to discovered elements so the model can refer to concrete targets without inventing coordinates or selectors.
50. `PARTIAL` · **W3** — Preserve useful target metadata: label, role, accessible name, href, text, containing row, nearby headings, bounds, visibility, selected state, and originating observation.
51. `PARTIAL` · **W3** — When several elements have identical names such as “Download,” use their surrounding table row, version, platform, and related attributes to disambiguate.
52. `PARTIAL` · **W3** — Require fresh observations before sensitive actions. Reject stale element references when pages, windows, documents, or processes have changed.
53. `PASS` · **W3** — Prevent Gemini from navigating to unobserved deep URLs when the user's task requires following an authoritative source.
54. `PARTIAL` · **W3** — Distinguish verified facts from model memory and assumptions. Never report current external facts without an actual observation or valid trusted source.
55. `PARTIAL` · **W3** — When the source is a complex table, inspect structured rows and columns rather than relying only on a screenshot or an isolated link label.
56. `PARTIAL` · **W3** — When observations are incomplete, gather targeted additional evidence instead of guessing.
57. `PARTIAL` · **W3** — Prefer accessibility and structured browser information when reliable; use screenshots and visual interpretation where structure is unavailable or insufficient.
58. `UNTESTED` · **W5** — Implement coordinate transforms correctly across scrolling, zoom, DPI, display scaling, window movement, resizing, and multiple monitors.
59. `PARTIAL` · **W5** — Refuse ambiguous or wrong-window actions. Bind desktop actions to exact window identities and verify that the target is still valid immediately before execution.
60. `PARTIAL` · **W3** — Improve fallback from structured controls to visual grounding without creating repeated screenshot loops.
61. `FAIL` · **W4** — Implement image-based target matching where necessary, with confidence thresholds, stale-image detection, coordinate validation, and post-action observation.
62. `PARTIAL` · **W7** — Add adversarial tests for duplicate buttons, changing page layouts, dynamic tables, identical filenames, overlapping windows, dialogs, hidden controls, overlays, and redirected downloads.
63. `PARTIAL` · **W3** — Improve Gemini's ability to recover after clicking the wrong target, detecting the mistake before accepting or overwriting an incorrect result.
64. `PASS` · **S** — Do not solve model errors by adding an expanding library of special-case prompts for individual websites or applications.
65. `UNTESTED` · **W3** — Measure target selection accuracy independently by comparing the actual selected object against a hidden expected target.

#### Independent verification

66. `PARTIAL` · **W1** — Strengthen the independent verifier so completion depends on **real postconditions**, not Gemini's confidence or tool-call success.
67. `PARTIAL` · **W1** — Separate model-generated verification proposals from authoritative task acceptance rules and independently observed outcomes.
68. `PARTIAL` · **W1** — Fix verifier gaming: Gemini must never modify a customer's file simply to satisfy an incorrectly specified test.
69. `PARTIAL` · **W1** — Distinguish an invalid verification condition from defective customer work and require clarification or a trustworthy alternative check when necessary.
70. `PARTIAL` · **W4** — Verify file modifications using hashes, actual contents, parseability, expected semantics, and relevant application-level behavior.
71. `PARTIAL` · **W4** — Verify spreadsheets through formulas, recalculated values, ranges, output structure, and independent checks of expected financial or numerical results.
72. `PARTIAL` · **W4** — Verify Word/PDF deliverables through actual document structure, contents, page rendering where necessary, and preservation of requested formatting.
73. `PARTIAL` · **W4** — Verify images through real file properties, requested visible changes, render inspection, and appropriate perceptual checks rather than existence alone.
74. `PARTIAL` · **W4** — Verify videos through actual encoded output, duration, frames, audio, codec/container compatibility, requested edits, and playback checks.
75. `PARTIAL` · **W4** — Verify code repairs by running the relevant command, tests or application and observing the changed behavior.
76. `PARTIAL` · **W7** — Verify browser work by checking actual resulting page state, downloaded artifact, submitted data, or other independently observable effect.
77. `PARTIAL` · **W4** — Where full automatic verification is impossible, report what was proven, what remains uncertain, and what requires human review.
78. `PARTIAL` · **W10** — Record evidence references with each important action while protecting customer data and excluding secrets.
79. `PASS` · **W1** — Keep the verifier isolated from the planner's unverifiable claims and hidden test answer keys.
80. `PARTIAL` · **W1** — Build regression tests specifically reproducing the false-positive verification and unauthorized source-editing failures already observed.

#### Execution speed and efficiency

81. `PARTIAL` · **W2** — Optimize for **fastest correct completed task**, not fastest unverified click.
82. `PARTIAL` · **W2** — Instrument planning latency, provider latency, tool startup, execution time, observation time, verification time, retries, and total elapsed task time.
83. `PARTIAL` · **W2** — Remove unnecessary Gemini calls, repeated tool discovery, redundant context generation, repeated file reads, and excessive screenshots.
84. `PASS` · **W2** — Batch independent read-only observations where safe, preserving enough output for Gemini to reason correctly.
85. `PARTIAL` · **W2** — Do not batch dependent writes or risky actions when intermediate verification is necessary.
86. `PARTIAL` · **W2** — Cache stable capability metadata, unchanged file hashes, tool schemas, and other reusable observations using safe invalidation rules.
87. `PARTIAL` · **W2** — Use targeted incremental observations rather than re-reading entire files, pages, or tool catalogs on every step.
88. `PASS` · **W2** — Keep frequently needed workers warm where this measurably improves performance without compromising resource usage or STOP behavior.
89. `PASS` · **W2** — Add progress and stall detection for repeated actions, repeated errors, no state change, exhausted budgets, and ineffective retries.
90. `PARTIAL` · **W2** — Limit retries by error category, risk, elapsed time, and remaining task budget.
91. `PARTIAL` · **W2** — Optimize prompt and context composition without hiding critical observations, permissions, error information, or verification requirements.
92. `PARTIAL` · **W2** — Parallelize independent safe work only when process, file, window, and browser-target isolation can be guaranteed.
93. `PASS` · **W2** — Prefer native file operations and direct APIs over simulated clicking whenever equivalent verified results are possible.
94. `PARTIAL` · **W2** — Profile actual slow paths before optimizing. Benchmark every optimization against the previous implementation.
95. `PASS` · **S** — Never remove security checks or independent verification merely to make a benchmark faster.
96. `PARTIAL` · **W2** — Measure median, p95 and p99 latency, model calls per task, retries, token usage, resource consumption, and completed verified outcomes.

#### Dependencies and runtime management

97. `PARTIAL` · **W8** — Build a **generic Dependency Manager** that identifies capabilities and prerequisites missing from the customer's environment.
98. `PARTIAL` · **W8** — Keep OCADE's own required runtime, libraries, and browser automation components bundled wherever supported. Customers must not need Python or developer tooling merely to start OCADE.
99. `PARTIAL` · **W8** — Distinguish bundled application dependencies from additional dependencies needed for a particular customer-requested task.
100. `PARTIAL` · **W8** — Detect installed tools and versions using reliable platform mechanisms rather than assuming a package exists because one executable appears in PATH.
101. `PARTIAL` · **W8** — Support discovery of relevant runtimes and engines such as Python, Node.js, Java, .NET, FFmpeg, LibreOffice, browser engines, and native application dependencies when tasks require them.
102. `PASS` · **W8** — Do not bundle every possible programming language or framework unnecessarily. Download optional task-specific dependencies only when actually needed and authorized.
103. `PARTIAL` · **W8** — Inspect OS version, CPU architecture, package architecture, installation scope, existing versions, permissions, disk space, and network availability before proposing installation.
104. `UNTESTED` · **W8** — Support x64 and ARM64 where officially targeted. Treat x86 support as a deliberate compatibility decision with actual build/test evidence.
105. `PARTIAL` · **W8** — Prefer trusted platform package managers, verified vendor distributions, or controlled installation manifests when suitable.
106. `FAIL` · **W8** — Resolve required package version, operating-system support, architecture, integrity hash, authenticity, compatibility, and applicable licence before installation.
107. `PARTIAL` · **W8** — Never blindly run commands copied from unknown webpages or untrusted model outputs.
108. `PARTIAL` · **W8** — Show the exact package, source, version, destination, privileges, expected changes, and security implications before approval.
109. `PASS` · **W8** — Request administrator elevation only for an authorized operation that truly requires it. Keep normal OCADE operation unelevated.
110. `UNTESTED` · **W8** — Detect UAC denial, insufficient permissions, missing installation privileges, enterprise policy restrictions, and package-manager failures.
111. `FAIL` · **W8** — Detect missing DLLs, `.dylib` files, `.so` libraries, incompatible native modules, conflicting versions, missing VC++ runtimes, and broken runtime paths where relevant.
112. `PARTIAL` · **W8** — Diagnose missing executable paths, environment variables, file associations, registry entries, configuration files, and working directories.
113. `UNTESTED` · **W8** — Diagnose antivirus, SmartScreen, Gatekeeper, quarantine, and application-control restrictions without disabling or bypassing security protections.
114. `PARTIAL` · **W8** — Provide clear troubleshooting messages when an installation is blocked by legitimate security policies.
115. `FAIL` · **W8** — Make dependency installations resumable, bounded, journaled, and recoverable where the platform supports those guarantees.
116. `PARTIAL` · **W8** — After installation, verify the executable's actual version, architecture, startup behavior, and the exact capability the task requires.
117. `FAIL` · **W8** — Resume the original task automatically only after the dependency is independently verified and the authorization remains valid.
118. `PARTIAL` · **W8** — If installation fails, preserve the original task state, record the exact error, and offer safe recovery or manual administrator assistance.
119. `FAIL` · **W8** — Build real clean-machine tests for missing Python, Node.js, FFmpeg, Office engines, blocked installations, architecture mismatches, insufficient storage, restricted privileges, interrupted downloads, and incompatible versions.
120. `PARTIAL` · **W8** — Ensure installers and dependency workflows work without developer-specific paths, cached packages, local credentials, or preconfigured developer environments.

#### Windows customer readiness

121. `BLOCKED` · **RPC** — Validate the actual Windows installer on clean Windows 10 and Windows 11 consumer environments, not only Windows Server GitHub runners.
122. `PARTIAL` · **W5** — Test fresh installation, first launch, browser bundle, local Gateway startup, pairing, task execution, restart, upgrade, repair, and uninstall.
123. `PARTIAL` · **W5** — Verify all required DLLs, Python modules, Playwright binaries, runtime assets, and MCP workers exist in the distributed package.
124. `PARTIAL` · **W5** — Remove accidental dependencies on Git, Python, Node.js, PowerShell 7, compilers, SDKs, or developer PATH configuration unless explicitly required by a supported optional capability.
125. `PARTIAL` · **W5** — Preserve native Windows UIA, Win32 and COM compatibility with real installed applications and Windows security boundaries.
126. `PARTIAL` · **W5** — Test foreground control, user interference, wrong-window prevention, minimized windows, closed processes, elevated windows, and inaccessible UI controls.
127. `UNTESTED` · **W5** — Test DPI scaling, zoom, high-resolution displays, multiple monitors, different refresh rates, and window repositioning.
128. `UNTESTED` · **W5** — Test standard user accounts, UAC prompts, controlled-folder access, antivirus restrictions, OneDrive folders, Unicode paths, and long filenames.
129. `UNTESTED` · **W5** — Validate background operation after sleep, wake, lock/unlock, restart, network disconnection, sign-out, and device removal.
130. `PARTIAL` · **W5** — Verify that STOP and task cancellation terminate unauthorized subprocess trees and report incomplete effects correctly.

#### macOS and Linux readiness

131. `PARTIAL` · **W6** — Implement real macOS native accessibility support using appropriate platform APIs instead of claiming Windows control provides macOS coverage.
132. `PARTIAL` · **W6** — Support the macOS permission model, including Accessibility and other required user-granted permissions, with clear onboarding and revocation behavior.
133. `BLOCKED` · **RPC** — Validate supported Intel and Apple Silicon devices and actual native execution, packaging, and dependency availability.
134. `PARTIAL` · **W13** — Implement or verify Linux desktop control for explicitly supported X11 and Wayland configurations. Respect compositor and desktop security limitations.
135. `UNTESTED` · **W13** — Handle Linux desktop portals, user-session permissions, packaging differences, executable paths, shared libraries, and distribution compatibility.
136. `PASS` · **W4** — Provide platform-specific implementations behind shared capability contracts rather than contaminating the planner with OS-specific hardcoded journeys.
137. `PARTIAL` · **W4** — If an operation genuinely cannot work on a supported platform, detect the limitation before execution and report it accurately.
138. `PARTIAL` · **W12** — Do not mark any operating system fully supported until native installation, pairing, execution, STOP, recovery, and independent task verification pass on representative hardware.

#### Browser and application control

139. `FAIL` · **W7** — Dynamically discover the actual installed browsers and profiles. Do not assume Chrome, Edge, or a particular profile is available.
140. `PARTIAL` · **W7** — Bind automation to the authorized browser session, exact tab, origin, and target; never silently act in an unrelated session.
141. `PASS` · **W7** — Prefer DOM/CDP/Playwright structured operations where possible and use visual control only when required.
142. `PARTIAL` · **W7** — Detect navigation, popups, downloads, redirects, file pickers, permission prompts, authentication challenges, and dynamic content safely.
143. `PARTIAL` · **W7** — Respect anti-bot protections, authentication boundaries, website permissions, and security-sensitive user confirmations.
144. `PARTIAL` · **W7** — Ensure newly encountered applications can be operated through generic discoverable capabilities whenever their interfaces and permissions support it.
145. `PASS` · **W7** — Test unfamiliar and randomly named applications, files, websites and UI layouts to prove execution is genuinely capability-based.

#### Customer interface and product features

146. `PARTIAL` · **W9** — Audit and complete Landing, Authentication, Chat, JARVIS, Library, Devices, Apps & Websites, Settings, Usage, and Owner/Staff administration.
147. `PARTIAL` · **W9** — Inventory and test every button, menu, link, route, input, modal, file upload, download, permission dialog, and state transition.
148. `PARTIAL` · **W9** — Make first-use onboarding simple: install, sign in, pair device, grant the specific permissions needed, and complete the first authorized task.
149. `PARTIAL` · **W9** — Show accurate device states such as Ready, Offline, Permission Required, Busy, Disconnected, and Removed.
150. `PARTIAL` · **W9** — Provide live task progress with current action, completed steps, verified results, remaining work, and user intervention requests.
151. `PARTIAL` · **W9** — Display actual operation details in approval dialogs, not vague summaries supplied by Gemini.
152. `PARTIAL` · **W9** — Ensure STOP, Take Over, Continue, Retry, and Remove Device behave correctly and visibly.
153. `PARTIAL` · **W9** — Finish file delivery, download, preview, editing, and recovery flows for produced artifacts.
154. `PASS` · **W9** — Preserve separate behavior for online JARVIS and offline Chat; never silently substitute one for the other.
155. `UNTESTED` · **W9** — Complete supported voice, interruption, microphone permission, wake-state reporting, and accessibility features without misleading background-listening claims.
156. `PARTIAL` · **W9** — Validate responsive website and PWA behavior on major desktop and mobile browsers, including accessibility and session recovery.
157. `UNTESTED` · **W9** — Complete any already-scoped Android companion capabilities and tests only after core architecture and cloud gates pass. Do not create unrelated mobile apps.
158. `UNTESTED` · **W9** — Validate iOS browser/PWA behavior using supported hosted browser or simulator testing where available; do not invent native iOS functionality.
159. `PARTIAL` · **W9** — Optimize frontend performance, loading states, code splitting, accessibility, caching, image delivery, international text, reduced motion, and meaningful error feedback.
160. `PARTIAL` · **W9** — Eliminate dead controls, duplicate pages, obsolete branding, broken navigation, and unnecessary interface complexity.

#### Backend and infrastructure

161. `PARTIAL` · **W10** — Audit task authority, database RLS, authentication, privileged operations, staff/owner boundaries, device ownership, and audit logging end to end.
162. `PARTIAL` · **W10** — Test authorization against forged device identities, replayed requests, expired sessions, revoked keys, cross-account access, and duplicate action submission.
163. `PARTIAL` · **W10** — Verify migrations on disposable databases, including forward migration, rollback strategy, data integrity, and permission preservation.
164. `PARTIAL` · **W10** — Implement durable job processing, retry limits, idempotency, queue backpressure, and overload protection where missing.
165. `PARTIAL` · **W10** — Add server-side rate limits and resource budgets that protect availability without allowing a model to bypass task authority.
166. `PARTIAL` · **W3** — Improve provider error handling for timeouts, quota exhaustion, invalid responses, outages, and partial tool execution.
167. `PARTIAL` · **W10** — Prevent server credentials or service-role keys from reaching model-controlled commands, local workers, browser pages, test logs, or customer downloads.
168. `UNTESTED` · **W10** — Enforce TLS, secure headers, safe cookies, CSRF protection, input validation, and appropriate Content Security Policy.
169. `PARTIAL` · **W10** — Test for XSS, SQL injection, SSRF, path traversal, command injection, unsafe deserialization, insecure direct-object references, and privilege escalation.
170. `PARTIAL` · **W10** — Threat-model malicious websites, prompt injection in customer files, untrusted MCP tools, malicious downloads, compromised worker processes, and stolen device credentials.
171. `PARTIAL` · **W1** — Protect local file access through explicit grants, scope enforcement, race-safe writes, version checks, backup behavior, and non-destructive defaults.
172. `PARTIAL` · **W10** — Verify database backups through actual restoration drills. Test infrastructure recovery, incident handling, and user-visible service failure behavior.
173. `PASS` · **W10** — Profile real load and scale only as evidence requires. Avoid premature multi-region complexity or unnecessary infrastructure expenses.

#### Security, privacy, and operations

174. `PASS` · **S** — Preserve MFA and all established owner/staff safeguards. Never weaken security merely to make an automated test pass.
175. `PARTIAL` · **W10** — Keep customer content private and separate from other accounts, support systems, model traces, and unrelated customer sessions.
176. `PARTIAL` · **W10** — Make logs useful but redact passwords, authorization headers, tokens, API keys, sensitive file contents, and private data.
177. `PARTIAL` · **W10** — Add structured crash reports, health checks, latency metrics, failure classifications, and diagnostics with privacy-respecting controls.
178. `PASS` · **W10** — Implement a user-accessible diagnostic report that can explain connection, permission, runtime, dependency, Gateway, browser, and execution failures.
179. `UNTESTED` · **W10** — Ensure customer data export, account deletion, device revocation, and retention processes operate consistently with published privacy commitments and applicable requirements.
180. `PARTIAL` · **W10** — Prepare necessary non-payment legal and governance documentation, licence notices, privacy disclosures, Terms of Service, and installation guidance.
181. `FAIL` · **W10** — Add release notes, troubleshooting documentation, support procedures, incident response, service status communication, and recovery instructions.
182. `UNTESTED` · **W10** — Verify the commercial redistribution rights of bundled runtimes, dependencies, libraries, models, assets, and external components.
183. `PASS` · **S** — Keep all payment, checkout, billing, merchant-of-record, and subscription integration work outside this assignment.
184. `PASS` · **S** — Exclude code-signing certificate acquisition and certificate-signing work from this assignment. Do not compensate by bypassing OS or antivirus security protections.

#### Packaging, updates, and reliability

185. `PARTIAL` · **W8** — Build fully reproducible installers and release artifacts for supported platforms and architectures using declared, version-pinned dependencies.
186. `PARTIAL` · **W8** — Verify package integrity and every bundled worker's startup, not just successful compilation.
187. `PARTIAL` · **W8** — Support clean installation, upgrade, repair, restart, rollback, and uninstall without destroying customer documents or unrelated settings.
188. `FAIL` · **W8** — Implement a safe update mechanism with version compatibility, integrity checks, rollback, and recovery after interrupted updates.
189. `UNTESTED` · **W8** — Never let an update silently execute during a critical customer action or leave partially replaced executables running.
190. `PARTIAL` · **W8** — Test installation on clean VMs and physical machines without developer tools, cached browser binaries, or previously installed OCADE components.
191. `UNTESTED` · **W12** — Run long-duration stability tests to detect CPU spikes, memory leaks, orphaned workers, unreleased handles, output-pipe hangs, and excessive disk usage.
192. `UNTESTED` · **W12** — Test low-memory machines, slow storage, limited bandwidth, unstable Wi-Fi, limited permissions, and constrained user accounts.
193. `PARTIAL` · **W1** — Ensure network outages cause clear state transitions and safe task recovery rather than hidden success or uncontrolled retries.

#### Independent testing and evidence

194. `PARTIAL` · **W12** — Build a permanent, versioned test matrix covering every supported OS, CPU architecture, browser, DPI configuration, permission level, and installation scenario.
195. `PARTIAL` · **W12** — Include unit, protocol, integration, database, security, accessibility, browser, desktop UI, packaging, installer, performance, and disaster-recovery tests.
196. `PASS` · **W0** — Run existing CI suites and eliminate silently skipped essential tests. Required tests must fail the release gate when their prerequisites are unavailable.
197. `PARTIAL` · **W3** — Preserve synthetic test fixtures and hidden independent oracles, but never reveal expected customer-task answers to the production planner.
198. `PASS` · **W3** — Generate randomized test data, application names, filenames, layouts, input values, user instructions, and environmental conditions to detect hardcoding.
199. `PARTIAL` · **W3** — Include real Gemini-controlled E2E tests rather than only mocked or scripted model responses.
200. `PARTIAL` · **W12** — Test actual spreadsheet reconciliation, document creation, coding repairs, browser research, file manipulation, image operations, video operations, and general PC tasks through reusable capability interfaces.
201. `PARTIAL` · **W3** — Select representative tasks from real customer problems; never special-case the examples in production code.
202. `PARTIAL` · **W3** — Measure first-attempt success, recovery-assisted success, final verified success, intervention frequency, wrong-target incidents, time per task, and model calls.
203. `PASS` · **S** — Treat the historical 15/24 clean passes as an existing evidence checkpoint, not proof of a current success rate after subsequent fixes.
204. `PARTIAL` · **W3** — Create larger unseen evaluation sets with varying difficulty and fresh inputs. Prevent repeated retries on known fixtures from artificially raising reported success.
205. `FAIL` · **W12** — Require at least **90% independently verified real-task success** on the agreed representative launch suite, plus explicit platform-specific reliability gates.
206. `PARTIAL` · **S** — Require zero known critical security or safety defects, zero unauthorized actions, zero fabricated successes, and zero unresolved release-blocking failures.
207. `PARTIAL` · **W3** — Retest every previously observed bug, including wrong Python download, hallucinated versions, invented URLs, verifier gaming, repeated reads, and Python 3.12 subprocess hanging.
208. `PARTIAL` · **W12** — Repeat regression and integration tests under the actual runtime versions and binaries shipped to customers.
209. `PARTIAL` · **RPC** — Test Windows consumer desktops separately from Windows Server CI runners; test native macOS and supported Linux configurations separately.
210. `PARTIAL` · **W1** — Perform controlled crash, process-kill, network-loss, interrupted-update, permission-revocation, STOP, takeover, and retry-injection tests.
211. `PARTIAL` · **W4** — Verify output quality independently, including edits that appear valid but contain incorrect values, missing content, damaged formatting, or altered unrelated files.
212. `PARTIAL` · **W10** — Review security, privacy, package provenance, and failure recovery before any feature is declared launch-ready.
213. `PASS` · **S** — Do not delete tests to improve pass rates, reduce validation standards to force a green result, or mark blocked scenarios as passed.

#### Commercial launch readiness: verified 10% milestones

214. `PARTIAL` · **W0** — Implement a measurable **0–100% Commercial Launch Readiness Score**, divided into ten independently verifiable milestones, each worth 10 percentage points.
215. `PARTIAL` · **W0** — **10% — Repository and architecture baseline:** source integrity, contracts, test inventory, dependency audit, security invariants, and reproducible builds verified.
216. `PARTIAL` · **W1** — **20% — Core Gateway and device authority:** pairing, permissions, worker execution, journaling, STOP, takeover, and recovery independently verified.
217. `FAIL` · **W8** — **30% — Installer and dependency readiness:** bundled prerequisites, clean installation, dependency diagnosis, safe authorized repair, upgrade and uninstall tested.
218. `PARTIAL` · **W12** — **40% — Computer and browser control:** generic target discovery, accurate execution, wrong-target protection, browser handling, and supported OS adapters verified.
219. `FAIL` · **W3** — **50% — Gemini intelligence and grounding:** unfamiliar-task planning, correct target selection, observed-source reasoning, adaptive execution, and loop prevention verified.
220. `PARTIAL` · **W1** — **60% — Independent verification and recovery:** trustworthy completion checks, false-success prevention, file protection, checkpoint recovery, and negative/adversarial tests verified.
221. `PARTIAL` · **W9** — **70% — Customer-facing product:** required web pages, authentication, onboarding, Chat, JARVIS, Devices, Library, Settings, approvals, and deliverables verified.
222. `BLOCKED` · **W10** — **80% — Security, infrastructure, and operations:** authorization, privacy, secrets isolation, resilience, observability, backup restoration, support, and operational tests verified.
223. `BLOCKED` · **W12** — **90% — Platform and performance qualification:** all advertised OS/architecture configurations, installation and runtime compatibility, stress tests, and latency targets verified.
224. `BLOCKED` · **W12** — **100% — Final commercial release qualification:** unseen real-task acceptance, complete regression matrix, closed-beta validation, all mandatory gates, and zero known critical release blockers verified.
225. `PASS` · **S** — A milestone earns its full 10% only when every mandatory acceptance condition in that milestone passes with recorded evidence. Otherwise mark it PARTIAL or BLOCKED without awarding unearned percentage points.
226. `PARTIAL` · **S** — Add granular completion tracking within milestones, but distinguish work completed from launch-gate approval. Do not manipulate weights to show artificially high readiness.
227. `PARTIAL` · **S** — Calculate the score from actual test artifacts, current commit, verified implementation, and explicit gate criteria. Never generate the percentage using Gemini's subjective opinion.
228. `PARTIAL` · **S** — Do not automatically start at 0%. Re-evaluate completed work and existing evidence against these milestone gates and calculate the real baseline.
229. `PARTIAL` · **S** — Report **passed, partial, failed, blocked, and untested** requirements separately from the overall readiness percentage.
230. `PARTIAL` · **S** — Every score must include the tested commit SHA, date, evidence location, supported platforms, remaining blockers, and why each completed milestone qualifies.
231. `PARTIAL` · **S** — Track progress at 10% increments, and whenever useful report the exact verified percentage between those checkpoints without pretending it is a success probability.
232. `PARTIAL` · **S** — At each 10% milestone, report the actual changes made, tests passed, defects fixed, performance impact, remaining work, and whether the next stage is safely unlocked.
233. `PARTIAL` · **S** — If a regression invalidates previously earned readiness, reduce the score accordingly. Never maintain an inflated historic score.
234. `PASS` · **S** — **100% readiness means all agreed launch requirements passed**, not a guarantee that software can never encounter an unexpected bug.

#### Implementation workflow and reporting

235. `PARTIAL` · **S** — Begin by inspecting the actual current branch and calculating the evidence-based readiness baseline.
236. `PARTIAL` · **W0** — Compare current code against every relevant requirement in this prompt and the existing canonical architecture ledger.
237. `PARTIAL` · **W0** — Create or update a single authoritative implementation backlog, preserving the existing plan and eliminating duplicate issue lists where safe.
238. `PARTIAL` · **W0** — Record each issue with severity, precise cause, affected module, required change, reproduction steps, acceptance criteria, test location, and current status.
239. `PASS` · **S** — Immediately prioritize the most consequential verified failures: Gemini grounding, incorrect verification, unsafe edits, incomplete dependency management, and platform readiness.
240. `PASS` · **S** — Work continuously through the backlog, fixing the root cause rather than adding superficial exceptions or test-specific patches.
241. `PASS` · **S** — After each meaningful change, run focused tests, resolve failures, and then run the appropriate broader integration suite.
242. `PARTIAL` · **S** — Before each substantial refactor, measure its expected benefit and preserve functionality, security controls, public interfaces, and regression coverage.
243. `PARTIAL` · **W11** — Remove dead code, duplicate abstractions, obsolete pathways, unused packages, redundant model prompts, unnecessary background workers, and outdated customer-facing branding only after verifying safe removal.
244. `PASS` · **S** — Do not pursue arbitrary line-count reduction. Optimize for maintainability, correctness, reliability, and measured performance.
245. `PASS` · **S** — Preserve the no-hardcoded-apps rule throughout all changes. Generic capabilities must work against new tasks and new applications without further application-specific coding.
246. `PASS` · **S** — Maintain strict separation between developer tests and customer-distributed runtime artifacts.
247. `PARTIAL` · **S** — Use the free GitHub Actions environment and disposable test systems intelligently; avoid unnecessary reruns and wasted quota.
248. `PASS` · **S** — Fix CI failures from their actual logs. Do not blindly rerun identical failing jobs or alter test expectations without evidence that those expectations are incorrect.
249. `PASS` · **S** — Run all possible tests in cloud environments before requesting any physical-device testing.
250. `PASS` · **S** — Commit coherent implementation changes to the authorized implementation branch with accurate commit messages and supporting tests. Do not merge, deploy, or publish release artifacts.
251. `PASS` · **S** — Do not claim missing approvals are implementation blockers unless the work genuinely cannot proceed using authorized, safe alternatives.
252. `PASS` · **S** — Distinguish work that requires my approval—credentials, real-device access, privileged services, destructive operations, spending, or deployment—from work you can perform independently.
253. `PASS` · **S** — Do not request approvals unnecessarily. Continue independent coding, fixture generation, test development, analysis, and local/cloud validation wherever safe.
254. `PASS` · **S** — When genuine owner approval is required, present the exact requested action, why it is necessary, its risks, and the remaining work that can proceed without it.
255. `PARTIAL` · **S** — Keep a concise live engineering status with: **Current Readiness %, Fixed, Added, Removed, Tests, Speed, Failures, Blockers, Next Work**.
256. `PASS` · **S** — Provide a full evidence report at meaningful milestones, including actual code changes, commit references, platform coverage, measured task outcomes, and unresolved limitations.
257. `PASS` · **S** — Never say “fully complete,” “all fixed,” or “ready for public launch” while critical functionality remains blocked, unimplemented, untested, or unsafe.
258. `PASS` · **S** — Never sacrifice security or verification to achieve higher task success percentages or faster execution times.
259. `FAIL` · **COM** — Benchmark OCADE against relevant currently available AI assistants and computer-use tools using identical, independently scored tasks. Compare correctness, latency, recovery, customer control, security, privacy, and usability. Do not claim superiority without results.
260. `PASS` · **S** — Focus on OCADE's competitive advantage: **reliably completing real customer work on the customer's authorized computer, faster and with independently verified results**.
261. `PASS` · **S** — Maintain launch scope discipline. Do not add unrelated features, unnecessary architectures, speculative integrations, or complex infrastructure that does not improve release readiness.
262. `PASS` · **S** — Do not stop after preparing a checklist, adding a few regression tests, or obtaining one green CI run. Continue implementing the remaining authorized work and re-evaluating the release gates.
263. `PASS` · **S** — If an issue is blocked, record it accurately and continue independent tasks from the next highest-priority workstream.
264. `PARTIAL` · **S** — Work toward full launch-readiness qualification, with every required part implemented, integrated, tested, documented, secure, maintainable, and performant.
265. `PASS` · **S** — Your final release recommendation must be **GO or NO-GO**, supported by real test results. A NO-GO result is required whenever a mandatory safety or launch gate remains unmet.
266. `PASS` · **S** — **Do not ask me to repeat settled decisions. Do not replace coding with planning. Do not hardcode task-specific answers. Do not fake success. Fix root causes, optimize execution, verify everything, and report genuine commercial-launch progress in 10% milestones.**

**Start with the actual current repository state, fix the highest-impact existing failures, and continue implementation toward independently verified public commercial readiness.**

## Appendix B — The 84 architecture concepts (verbatim) with status and destination

Status source: `scripts/jarvis-traceability.mjs` / `evidence/2026-11-01-live/architecture-ledger.md` at `f04228d`. That script reads the concept rows below, so keep the row shape `| n | **title** | …`. Correction pending in W0 (D14): concept 29 is recorded BLOCKED, but run 45 shows MAC-001…012 passing on the macOS runner, which supports PARTIAL.

#### Foundation, authority and architecture

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 1 | **OD-AVGHHC — Outcome-Driven Adaptive Verifier-Gated Hierarchical Hybrid Control** | PARTIAL | W12 | One outcome state machine owns authorization, milestones, tool effects and completion; connect authenticated task authority to the model pilot, gateway, durable journal and independent verifier. | Trace one task across every boundary; reject unverified completion and unowned mutations. |
| 2 | **Architecture C — Unified Hybrid Control** | PARTIAL | W2 | Use one local-first hybrid execution spine, not a second planner or agent swarm; supervisor delegates only scoped tool calls to device-side generic executors. | A single trace links web request, server task, device lease, worker receipt and verifier. |
| 3 | **Five Primary Architectural Components** | PASS | S | Assign one owner each for supervisor, registry, process manager/MCP gateway, execution bridge and independent verifier; connect through versioned contracts. | No overlapping owners or duplicate executable paths; contract tests pass. |
| 4 | **Single-Dispatcher Architecture** | PASS | W1 | Serialize each resource mutation through one per-task dispatcher; distribute independent read-only work only when safe. | Concurrent actions against one document are ordered and auditable. |
| 5 | **Supervisor–Pilot / Actor–Critic Separation** | PASS | W1 | Gemini pilot proposes next typed action; supervisor enforces grants and retry budget; verifier critiques actual observed effects separately. | Replacing Gemini output with unsafe commands never bypasses policy. |
| 6 | **Hierarchical Control and Context Isolation** | PARTIAL | W3 | Retain outcome and milestone contexts above bounded tool-action contexts; expose minimal current schemas and observations. | Unrelated tool schemas and untrusted documents cannot leak into authority. |
| 7 | **Separation of State** | PASS | W1 | Keep desired goal, proposed intent, authorized dispatch, observed effects and verified outcome in separately owned records. | A worker's claimed success cannot update verified outcome directly. |
| 8 | **Outcome and Target-State Definition** | PARTIAL | W3 | Translate consented user intent to model-proposed, policy-reviewed checks; persist clear measurable postconditions before mutations. | Ambiguous or unverifiable checks return an explicit question or BLOCKED. |
| 9 | **Zero Hardcoded Application or Customer-Task Journeys** | PASS | W0 | Remove keyword-to-app workflows, fixed output names, canned procedural paths and demo scripts from runtime; allow vetted generic adapters. | Metamorphic tests with unseen apps, filenames and paraphrases reach the same dynamic routing mechanism. |
| 10 | **Capability-First Tool Selection** | PASS | W3 | Candidate tools derive from current executable capability descriptors and actual target availability, not app names. | Changing installed equivalent executors changes candidates without changing planner code. |

#### Adaptive intelligence, vector routing and discovery

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 11 | **Environment Discovery and Systemic Introspection** | PARTIAL | W5, W6 | Device reports OS, processes, windows, profiles, file associations, available APIs, drivers, hardware, permissions and target identity to registry. | Fresh discovery matches actual device conditions; unreported tools cannot execute. |
| 12 | **Dynamic Application and Interface Discovery** | PARTIAL | W5, W6 | Discover installed and active applications and their supported automation surfaces at runtime; avoid static app lists. | Unknown legitimate installed application appears when its supported control surface is discoverable. |
| 13 | **Dynamic Capability Registry and Typed Schemas** | PASS | W8 | Normalize reviewed tool manifests with IDs, version, input/output JSON schemas, supported effects, permission scope, target and health. | Malformed, duplicate, stale or permissionless manifests are excluded. |
| 14 | **MCP Toolbox Router** | PASS | W3 | Match model goal and current step to authorized healthy capabilities; shortlist, then Gemini makes final typed selection. | Candidate selection is dynamic and does not create an action plan. |
| 15 | **Semantic Token Gatekeeper** | PASS | W3 | Expose only bounded shortlisted tool definitions in a Gemini turn; maintain safety invariant for non-shortlisted operations. | Prompt length stays bounded and rejected tools cannot be invoked through fabricated names. |
| 16 | **Vectorized Domain Blueprints** | PARTIAL | W3 | Index general capability descriptions, schemas and quality criteria with versioned embeddings; retrieve guidance, never executable task templates. | A changed tool manifest invalidates embeddings; vector results carry no authority. |
| 17 | **Receding-Horizon Vector Selector** | PASS | W3 | Recompute tool candidates from latest observed state and unfinished outcome instead of emitting a fixed multi-step task. | Revised environment or a failure produces an updated candidate set. |
| 18 | **Macroscopic Planning for Unknown Task Horizons** | PARTIAL | W3 | Gemini sets adaptable milestone intent; supervisor limits turn duration and persisted costs/permissions. | A long job can checkpoint without assuming a fixed step count. |
| 19 | **Bounded Receding-Horizon Planning** | PASS | W3 | Allow one or a small safe batch of Gemini-selected operations; reobserve before each irreversible step. | Cycle detection, task budget and STOP all terminate unsafe nonprogress. |
| 20 | **Real-Time Observe–Act–Verify–Adapt Loop** | PARTIAL | W3 | After each effect, return structured receipt plus permitted screen/media evidence to supervisor and Gemini. | A deliberately failed action causes feedback or stop, never fake success. |
| 21 | **Dynamic State Pivot and Self-Correction** | PARTIAL | W1 | On user edits or worker error, refresh target identity and outcome delta before bounded repair. | No stale coordinates or old file versions are reused after takeover. |
| 22 | **Tool Namespace Isolation** | PASS | W0 | Use stable fully qualified names and immutable manifest IDs across gateway/registry/providers. | Two tools with same short name cannot cross-call. |
| 23 | **Large Tool Catalog Filtering** | PASS | W3 | Keep full trusted catalog server/device side and send only stage-relevant tool schemas to Gemini. | Adding 100 irrelevant tools does not overwhelm the next planning turn. |
| 24 | **Live Capability and Dependency Preflight** | PASS | W8 | Check executable, API support, auth, codecs, browser profile, worker startup, network, rights and grant before proposing execution. | Missing dependencies cause clear unavailable/blocked evidence before mutation. |

#### Universal execution and computer control

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 25 | **Native-First Execution Hierarchy** | PARTIAL | W4 | Dispatch fastest safe supported API/object model first; then bounded scripts, formats, DOM/CDP/Playwright, accessibility and vision last. | Fallback transitions include reason and independently recheck effect. |
| 26 | **Native OS and File-Format Operations** | PASS | W4 | Offer generic filesystem, document format, OS inspection and project-file operations through typed sandboxed tools. | File integrity and ownership preserved, paths constrained to scope. |
| 27 | **Scoped Script and Command Execution** | PASS | W4 | Use allowlisted or reviewed bounded commands with quotas and argument schemas, never unrestricted model-generated shell. | Injection, path traversal and forbidden executable requests fail closed. |
| 28 | **Windows UI Automation — pywinauto / UIA / Win32** | PARTIAL | W5 | Use live accessibility trees and exact PID/HWND/process-start identity for native controls, with optional lower-level Win32 only when justified. | Wrong-window, duplicate-title and focus-swap regression tests pass. |
| 29 | **macOS Accessibility — pyobjc / ApplicationServices** | BLOCKED | W6 | Provide a native AX bridge behind the same interface when macOS is a supported target; do not call Linux tests macOS proof. | OS-specific entitlement and real device tests gate macOS claims. |
| 30 | **Browser DOM / CDP / Playwright Automation** | PASS | W7 | Bind to the precise authorized browser, profile, tab and origin; prefer semantic DOM/ARIA and official APIs. | Unexpected navigation, lost tab and login challenges pause safely. |
| 31 | **Authenticated Browser Profile and Session Binding** | PARTIAL | W7 | Use permitted existing sessions without exporting passwords/cookies; revoke tool authority when profile identity changes. | Cross-profile execution and token extraction are rejected. |
| 32 | **Structured Accessibility-Tree Interaction** | PARTIAL | W5, W6 | Inspect semantic controls, roles, state and geometry freshly before invoking action; avoid stale element IDs. | Changed UI tree triggers rediscovery rather than blind click. |
| 33 | **Exact PID / HWND / Document / Tab Targeting** | PARTIAL | W5, W6, W7 | Store lease-bound account/device/process/window/file/tab identity and validate immediately before mutation. | Spoofed window title or stale PID cannot redirect operation. |
| 34 | **Window Resize, DPI and Multi-Monitor Resilience** | PARTIAL | W5 | Requery accessibility state, transforms and visual anchors after display changes; never presume persistent coordinates. | DPI/display movement trials do not select wrong target. |
| 35 | **Foreground, Background and Minimized-Window State Handling** | PARTIAL | W5, W6 | Differentiate API-capable background work from GUI operations requiring a visible foreground; restore only with consent. | No claim of universal hidden-window clicking or cursor-free execution. |
| 36 | **Visual Anchors / OpenCV as Last-Resort Fallback** | PARTIAL | W4 | Use bounded vision matching with confidence, fresh screenshots and explicit target checks only where semantic interfaces fail. | Low-confidence target, resize drift or unexpected overlay blocks effect. |
| 37 | **Dynamic Universal Application Fallback Hierarchy** | PARTIAL | W4 | Select execution mechanism by current capability quality, privacy, fidelity and target state, independent of application names. | A missing native path falls back safely without fixed app-specific script. |
| 38 | **Approved Filesystem Sandbox** | PARTIAL | W1 | Create per-task bounded input, intermediate and output roots, preserving originals, ACLs and provenance. | Symlink traversal, overwrites and cross-account file access are blocked. |

#### MCP, STDIO and tool-runtime wiring

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 39 | **Trusted MCP Gateway and Capability Dictionary** | PASS | W0 | Local device runtime owns MCP connections; server receives signed sanitized manifests, not arbitrary shell hooks. | Only approved manifests can dispatch; remote tools cannot grant themselves permissions. |
| 40 | **Official MCP Tool/Server Lifecycle** | PASS | W0 | Initialize, negotiate protocol versions, enumerate capabilities, health-check, call and shutdown reviewed MCP workers. | Worker restart and protocol mismatch generate honest errors. |
| 41 | **Core OS, Filesystem, Browser and Accessibility Tool Roles** | PASS | W0 | Implement minimum stable general-purpose capabilities as composable workers; additional render/data tools remain optional typed plugins. | No customer must manually install developer MCP infrastructure. |
| 42 | **Async STDIO — sys.stdin / sys.stdout** | PASS | W2 | Transport JSON-RPC MCP frames over child stdin/stdout; stdout is protocol-only and diagnostics go to stderr. | Large outputs, partial frames and worker termination are handled correctly. |
| 43 | **STDIO Subprocess Multiplexing** | PASS | W2 | Process manager associates each child stream, request ID, task lease, cancellation and timeout with its correct pending call. | Parallel responses never cross tasks or mutate wrong resource. |
| 44 | **Tool Schema Pinning and Validation** | PASS | W0 | Use existing shared contracts; reject unknown operation, schema drift, excess payloads and invalid result shape at all boundaries. | Contract compatibility tests cover TS↔Python and service↔device. |
| 45 | **Tool Discovery, Versioning and Health Checks** | PARTIAL | W8 | Cache trusted manifests by version/health TTL; verify package provenance and readiness before enabling a tool. | Revoked/crashed/updated tools disappear from offered candidates. |
| 46 | **Approved External MCP Provenance and Permissions** | PARTIAL | W10 | Treat third-party tool descriptions as untrusted; require policy, publisher verification, pinning and explicit scope. | Malicious MCP tool metadata cannot exfiltrate secrets or bypass consent. |
| 47 | **Lazy Worker Activation and Isolation** | PASS | W2 | Spawn vetted workers on demand with scoped environment, quotas, sandbox and resource locks; reap idle workers. | Dead process does not strand a task or leak child processes. |
| 48 | **IPC Latency and Throughput Measurement** | PARTIAL | W2 | Measure dispatch, queue, worker and serialization times; optimize bottlenecks empirically. | p50/p95 latencies and overhead captured for real runs. |
| 49 | **Deterministic Safe Multi-Action Batching** | PARTIAL | W2 | Batch only model-selected, preauthorized idempotent/reversible operations inside one identity/STOP lease. | Cancellation or partial batch returns per-effect receipts. |

#### State, security, safety and recovery

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 50 | **Resource Locking and Semaphores** | PARTIAL | W1 | Acquire canonical per-resource locks before writes; release on confirmed settle or lease expiration. | Two concurrent tasks cannot overwrite same file/window state. |
| 51 | **Concurrency Protection and Resource-Aware Scheduling** | PARTIAL | W2 | Queue conflicting writes; permit parallel independent reads/renders under CPU/GPU limits. | Load cannot starve STOP, verifier or responsive UI. |
| 52 | **Task UUIDs and Idempotency Keys** | PASS | W1 | Assign task/action attempt and effect IDs stable across retries, reconnects and server callbacks. | Replayed requests do not duplicate irreversible effects. |
| 53 | **Transactional Side-Effect Journal** | PASS | W1 | Write intent and preconditions before action, then evidence/acknowledgment and final classification after action. | Crash between commit and ACK remains UNKNOWN until reconciled. |
| 54 | **Execution, Effect and Verification State Separation** | PASS | W1 | Represent requested/authorized/dispatched/observed/verified independently in durable state. | An RPC 200, saved path or LLM text never directly settles PASS. |
| 55 | **Lost-Confirmation / Unknown-Effect Reconciliation** | PARTIAL | W1 | Check external state and idempotency journal before any repeat after timeout/disconnect. | Unknown POST/send/delete is never blindly retried. |
| 56 | **Durable Checkpoints and Crash Recovery** | PASS | W1 | Persist outcome, consent, exact target, open actions, completed receipts and current epoch. | Process restart reconstructs task without replaying completed operations. |
| 57 | **Local STOP / Pause / Take Over / Resume** | PASS | W1 | Local kill fence blocks new effects immediately; remote STOP has separate acknowledgment and reconciliation states. | STOP works when cloud/model unavailable; in-flight effects reported truthfully. |
| 58 | **Live User Interference Detection** | PARTIAL | W5, W6 | Detect human focus/file/tab edits and suspend conflicting UI operations without blocking independent safe work. | Take-over never overwrites newer user changes. |
| 59 | **Target Revalidation After State Changes** | PARTIAL | W5, W6 | Recheck live process/window/tab/file identity and lease epoch before every mutation and after recovery. | Old handles, URLs and document versions are refused. |
| 60 | **Bounded Retry and Cycle Detection** | PASS | W3 | Cap steps, token use, time and attempts; change strategy only with observed evidence. | Infinite/self-repeating tool cycles terminate as BLOCKED. |
| 61 | **Graceful Degradation and Honest Blocked States** | PASS | W1 | Offer compatible alternatives only if authorized and outcome-equivalent; otherwise report reason/action required. | No silently substituted offline model, paid tool or fake artifact. |
| 62 | **Least-Privilege Runtime Sandboxing / ACLs** | PARTIAL | W10 | Run worker per scoped user/task boundaries with network, path, process and operating-system permission constraints. | Escapes, untrusted downloads and privilege escalation fail closed. |
| 63 | **Scoped Authentication, Consent, OAuth and MFA** | PASS | W10 | Authenticate user and device independently; preserve account isolation, grants and official login/UAC/MFA challenges. | Cross-tenant, stale grant and forged scope tests fail closed. |
| 64 | **Secrets Vault and Credential Isolation** | PASS | W10 | Keep provider/service admin keys server side only; never expose to tool schemas, model turns, logs, client or child process. | Secret scans and prompt/worker injection tests show no credential leakage. |

#### Device runtime and customer experience

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 65 | **Signed Local Device Agent** | PARTIAL | W8 | Package outbound-authenticated companion; validate update signature, identity and task lease. | Untrusted binary or disconnected device cannot receive privileged action. |
| 66 | **Secure Device Pairing and Revocation** | PASS | W10 | Pair by authenticated account and device-held key; allow explicit revoke and immediate policy fencing. | Removed device cannot resume or accept a task. |
| 67 | **Persistent Authorized Capability Scopes** | PARTIAL | W10 | Persist least-privilege grants with purpose, target, epoch and expiry; reask only for new/sensitive scope. | Expired permission and cross-account reuse rejected. |
| 68 | **One-Installer Self-Contained Runtime** | PARTIAL | W8 | Ship signed OS-specific executable with bundled reviewed workers, libraries and startup diagnostics. | Clean-machine smoke test without developer Python/Node/Docker passes on each advertised OS. |
| 69 | **Scoped Local Workspace and Output Provenance** | PASS | W4 | Stage files under task workspace; preserve editable origins and source licenses where needed. | Every delivered artifact has verified path, owner and hash. |
| 70 | **Task Activity, Timing and Progress Telemetry** | PASS | W2 | Record monotonic timestamps for authorization, planning, queue, execution, render, verification and delivery. | Total elapsed and phase sums are explainable; no invented speed. |
| 71 | **Safe Output Delivery and Editable Artifacts** | PARTIAL | W9 | Return genuine completed files/links and editable project when requested and supported; expose partial evidence when blocked. | Download/readback verification and native-open test pass. |
| 72 | **Minimal Outcome-First User Experience** | PARTIAL | W9 | Expose natural-language goal, device/scope confirmation, calm status, STOP, activity and delivery, not infrastructure details. | UI reflects real receipts, errors and waiting states. |
| 73 | **Internal MCP Complexity Hidden from Customers** | PASS | W9 | Install and discover tool services inside signed companion; never require consumer MCP setup. | A fresh customer path contains no CLI/MCP configuration step. |

#### Independent verification, optimization and release

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 74 | **Closed-Loop Telemetry Verification** | PASS | W4 | Collect structured before/after state plus output and nonmodel measurements for each action. | An unobserved write cannot count as completed. |
| 75 | **Independent Professional Deliverable Verification** | PARTIAL | W4 | Verifier reads actual output via independent method and checks outcome-specific integrity/quality criteria. | An actor-authored PASS does not override verifier failure. |
| 76 | **Postcondition and Output-Integrity Checks** | PARTIAL | W4 | Validate file opens, dimensions, metadata, structural formula/geometry consistency, requested values and quality. | Corrupt, mislabeled or low-fidelity output is PARTIAL/FAIL. |
| 77 | **Evidence-Based Adaptive Recovery** | PASS | W3 | Feed verifier failures and observed artifacts back to Gemini for bounded correction without losing original state. | Each repair has new evidence, no blind repeated clicks. |
| 78 | **Real-World Latency and Resource Benchmarks** | PARTIAL | W2 | Track Gemini time, tool dispatch, native execution, rendering, queue, verifier and customer intervention. | p50/p95, actual wall time and measurable efficiency compared to baseline. |
| 79 | **Real Unprepared End-to-End Task Qualification** | PARTIAL | W12 | Use previously unseen genuine tasks only after the architecture gate; no prerecorded execution trace. | Actual model-driven output, process trace and independent result are present. |
| 80 | **Adversarial Security and Wrong-Target Tests** | PARTIAL | W12 | Exercise permissions, stolen/expired leases, duplicate effects, changed window/tab, user edits, crashes and prompt injection. | No critical unauthorized side effects across suite. |
| 81 | **Proof-Driven Debloating and Regression Protection** | PASS | W11 | Remove unused/duplicate/hardcoded paths with caller trace and parity tests, not line-count goals. | No lost supported operations or degraded STOP/security coverage. |
| 82 | **PASS / PARTIAL / FAIL / BLOCKED / UNTESTED Evidence States** | PASS | W0 | Maintain per-concept SHA/environment/test IDs and reason; distinguish mocks from live tests. | No unknown/unproven component marked PASS. |
| 83 | **Measured Task Success and User-Intervention Metrics** | PARTIAL | W3 | Evaluate independently verified task success and count prompts, approvals, retries, time and user actions. | ≥90% benchmark gate only with published denominator and eligible coverage. |
| 84 | **Zero Known Critical Safety-Defect Release Gate** | FAIL | W12 | Require zero known critical/high-severity release blockers and green mandatory architecture tests. | Any proven credential leak, wrong-target mutation or unsafe retry vetoes task acceptance and release. |

## Appendix C — Research references evaluated (236 ideas)

Sources: `docs/research/OCADE_complete_heading_and_concept_index.md` (A = 143 source headings, B = 30 named components, C = 63 later concepts) and `docs/research/UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md` (U-sections). These are proposals, not evidence. Decisions: KEEP, IMPROVE, REPLACE, ADD, REJECT, ALREADY (already implemented, status per the mapped concept). Status of each idea equals the status of its destination concept or requirement; REJECT items have no runtime work.

| IDs | Idea | Decision | Destination |
|---|---|---|---|
| A1, A3, A5, A40, B6, B7, B8, B9; U§9 (DaVinci native MCP) | Application-specific native bridges and creative plugins | REPLACE with generic discovered mechanisms: confirmed command-line/scripting interfaces, file formats, pinned approved external MCP servers. No app-name branches. | W4, concept 46 |
| A2, A4, A15, A26–A29, A35–A39, A62, A65, B2, B3, B4, B14–B17; U§6, U§12 | Core engines: scoped scripts, filesystem, browser DOM, Windows UIA, macOS AX | ALREADY (fs/office, shell, web, ui_bridge workers) | W4–W7, concepts 26, 27, 28, 29, 30, 41 |
| B1 (Open Interpreter) | Local code-execution MCP | REPLACE by the existing confirmed, contained `shell.run` | W4 |
| B5 (Peekaboo) | macOS accessibility MCP | REPLACE by the existing `mac_worker` | W6, concept 29 |
| A6 | Office and document automation | ALREADY (office worker); deepen verification | W4 |
| A7, B10, B11, B12 | CRM and cloud-office API connectors | REJECT for launch (OAuth connector scope); use authorised browser sessions | W7; revisit in COM |
| B13 (TinyFish) | External web-context service | REJECT (external paid dependency, not needed) | — |
| A8 | Speed versus universality comparison | KEEP as the native-first order | W4, concept 25 |
| A9, A89, A101, A127, B28 | Single dispatcher; gateway over autonomous agents; five components | ALREADY | concepts 3, 4 |
| A10 | Multi-agent swarms for context isolation | REJECT swarms; KEEP context isolation through the per-turn shortlist | concepts 6, 15 |
| A11, A42 | Namespaced tool names | ALREADY | concept 22 |
| A12, A90, B20 | Locks, semaphores, task IDs, idempotency | ALREADY (IDs, idempotency); IMPROVE locks | W1, W2, concepts 50–52 |
| A13 | Sandboxing and graceful degradation | ALREADY | concepts 38, 61 |
| A14, A68, A112, A113, A126, A130 | Architecture C and its claimed superiority | ALREADY (architecture); REJECT superiority claims until benchmarked | concepts 1, 2; requirement 259 |
| A16–A19, A31, A78 | Discovery before acting; native translation; validation and self-healing | ALREADY (discovery, `system.inspect`); IMPROVE packaged-app discovery | W5, W6, W8, concepts 11, 12, 24 |
| A20 | Separation of state | ALREADY | concept 7 |
| A21 | Control without hardcoded application lists | ALREADY (guard) | concept 9 |
| A22, A30, A32, B23; U§2, U§7 | Professional quality via domain blueprints (vector DB, local creative-director LLM) | IMPROVE: short generic domain guidance in the planner prompt and professional verifier checks; REJECT local LLM and vector DB | W3, W4, concepts 16, 75 |
| A23, A34, A41, A43, A91, B18; U§3, U§8 | Toolbox router, semantic gatekeeper, embedding router prototype | ALREADY (TF-IDF shortlist); ADD embeddings only if measured recall <98% | W3, concepts 14, 15, 17, 23 |
| A24, A60, A66, A82, A83, B19; U§4 | stdio “zero latency” | ALREADY (stdio workers); REJECT the zero-latency claim — model and wake time dominate | W2, concepts 42, 43 |
| A84, A141; U§4 (dual local models) | Local model for speed or cost | REJECT (owner O3; online-only planner) | — |
| A85, A117, B22 | Deterministic multi-action batching | IMPROVE: read batching plus composite primitives; no dependent write batches | W2, concept 49 |
| A86 | Background resource management | ADD measurement and limits | W2, W12, concept 78 |
| A25, A58, A71; U§5 | “Immutable” automation IDs and hidden-window control | REJECT the claims; KEEP structural targeting with revalidation and truthful minimized/hidden handling | W5, W6, concepts 33, 35, 59 |
| A33, A59; U§11 (infinite loop) | Zero-error self-correction, infinite optimisation | REJECT infinite retries; KEEP bounded repair | concepts 60, 77 |
| A44, A72 | Closed-loop telemetry verification (read-back) | ALREADY | concept 74 |
| A45, A46, A51, A52; U§10 | Plain-language explanations and overclaims | REJECT as requirements (explanatory only) | — |
| A49, A55, A74, A102, A138, A139, A140, B30 | Lines-of-code estimates | REJECT as planning inputs (not measured) | — |
| A50, A56 | Competitive strategy (context filtering, packaged runtime, verification) | KEEP as hypotheses to benchmark | COM, requirement 259 |
| A48, A54 | MCP versus native APIs/UIA | KEEP: MCP is the transport; APIs/UIA do the work | concept 41 |
| A53, A47 | Core backbone versus parts | ALREADY | concepts 41–43 |
| A57, A61, A69, A115, A116, A136, B21, B27; U§12, U§13 | Receding-horizon actor–critic sense–act–verify loop | ALREADY (bounded loop); REJECT the sub-5 ms cycle claim | W3, concepts 5, 17, 19, 20 |
| A63, A64, A67 | pywinauto and pyobjc stack, sample controller code | ALREADY (stack); REJECT sample code (illustrative, unsafe) | concepts 28, 29 |
| A70, A73; U§13 | Live user interference and state pivot | IMPROVE (detect, pause, rebind, never overwrite user edits) | W5, W6, concepts 21, 58 |
| A75, A76, A131 | UIA limitations; where the architecture loses | KEEP as documented limits and refusal cases | W5, W6 |
| A77 | Window visibility states | ALREADY (partial) | concept 35 |
| A79 | Maximum professional depth | IMPROVE through generic scripting/COM/object models | W4, W5 |
| A80, B26 | Visual anchors / OpenCV last resort | ADD with confidence threshold and post-action check | W4, concept 36 |
| A81 | Real latency benchmarks | ADD (§5.1 targets) | W2, concept 78 |
| A87, A88, A92, A132, A133, A134 | MCP lifecycle, minimal toolbox, instability handling | ALREADY; IMPROVE health/versioning | W8, concepts 39–45 |
| A93, A94, A95 | Outcome-driven supervision with milestones | IMPROVE (milestones in durable task state) | W3, concept 18 |
| A96 | Failed action versus lost confirmation | IMPROVE (unknown-effect resolution) | W1, concept 55 |
| A97 | Professional deliverable verification | IMPROVE | W4, concept 75 |
| A98 | Safeguards for self-healing | ALREADY | concepts 60, 62 |
| A99, A100 | Repeated “backend rebuild” labels | REJECT (duplicate labels) | — |
| A103 | Build versus buy | KEEP (reuse SDKs, Playwright, pywinauto, pyobjc) | — |
| A104 | Front-end/back-end contract | ALREADY (one generated protocol) | concept 44 |
| A105 | Simplification and objective metrics | KEEP | W2, W11 |
| A106, A107, B24 | Runtime sandboxing, ACLs, AppContainer, Job Objects | IMPROVE (Job Objects already used for shell; evaluate least-privilege options) | W10, concept 62 |
| A108 | STOP, pause, resume | ALREADY | concept 57 |
| A109 | Absolute window and target context | ALREADY (partial) | concept 33 |
| A110, A111, A129 | Launch test-suite design | KEEP | W12 |
| A114 | Retractions of earlier overclaims | KEEP | — |
| A118–A125, B29 | Seven production scenarios (video, photo, chess/canvas, finance, CAD, cross-app, interruptions) | KEEP as qualification categories | W12 §8 |
| A128, A142 | Maintenance efficiency, code reduction | KEEP | W11, concept 81 |
| A135, A137 | Fallback hierarchy, resilient fault handling | IMPROVE (runtime mechanism fallback) | W4, concepts 37, 56, 77 |
| A143 | Unfinished final heading | REJECT (no content) | — |
| B25 | Browser profile, OAuth, MFA surfaces | KEEP limits: no secret extraction, person completes challenges | W7, concepts 31, 63 |
| C1–C10 | Minimal outcome-first UI (centred prompt, collapse on send, one status line, hidden internals, expandable activity, small history, final files, monochrome, small STOP) | KEEP | W9, concept 72 |
| C11 | Task-adaptive deliverables | KEEP | W4, W9, concept 71 |
| C12 | Reversible defaults instead of repeated confirmations | IMPROVE (A8) | W3 |
| C13, C15 | One installer; same-account device discovery and pairing | IMPROVE without granting control by login alone | W8, W9 |
| C14 | Signed device agent | ALREADY (request signatures); binary signing is COM | concept 65 |
| C16 | Persistent capability scopes | IMPROVE (purpose and expiry) | W10, concept 67 |
| C17 | Official Windows elevation only | KEEP | W8 |
| C18, C23 | Protected payment/secret boundaries; explicit-recipient sends | ALREADY (external-effect confirmation) | W1 |
| C19 | Google-first product sign-in | KEEP (existing sign-in surface) | W9 |
| C20, C21, C22 | Existing browser session, reauthentication, MFA/CAPTCHA by the person | KEEP limits | W7 |
| C24 | Recoverable deletion to Recycle Bin/Trash | ADD | W4 |
| C25 | Secrets vault and token isolation | ALREADY | concept 64 |
| C26, C46 | Full Windows app catalog incl. packaged apps | IMPROVE | W5, concept 12 |
| C27, C41 | No hardcoded journeys; capability-first choice | ALREADY | concepts 9, 10 |
| C28, C48 | Exact PID/HWND/document binding; wrong-window lessons | ALREADY (leases) | concept 33 |
| C29 | Resize, DPI, multi-monitor | IMPROVE | W5, W6, concept 34 |
| C30 | Truthful minimized/hidden handling | ALREADY (partial) | concept 35 |
| C31 | Take-over and conflict handling | IMPROVE | W5, W6, concept 58 |
| C32 | Native-first order | ALREADY (partial) | concept 25 |
| C33 | Browser DOM and authorised network calls | ALREADY | concept 30 |
| C34 | Bounded workspace with provenance | ALREADY | concepts 38, 69 |
| C35 | Resource-aware scheduler | IMPROVE later (one task per device today) | W2, concept 51 |
| C36, C37, C38 | Journal, checkpoints, local STOP | ALREADY | concepts 53, 56, 57 |
| C39 | Bounded receding-horizon planner | ALREADY | concept 19 |
| C40 | Independent professional verifier | IMPROVE | W4, concept 75 |
| C42 | Untrusted MCP provenance restrictions | ALREADY (pinning) | concept 46 |
| C43 | Policy-bound self-install of approved components | ADD | W8 |
| C44 | No forced local model fallback | ALREADY | standing |
| C45, C47 | Pairing/runtime checks; correct OS command context | ALREADY (`diagnose`, `system.inspect`) | W8 |
| C49, C50 | Historical QA results; retired engine | KEEP as history | — |
| C51, C52, C56, C58, C59, C62 | Evidence classes, cloud-first, no fake deliverables, code ≠ verified, owner GitHub policy, gradual coverage | KEEP as standing rules | S |
| C53, C54 | Representative benchmark; 90% target with 95%+ ambition | KEEP | W3, W12, R5 |
| C55 | Zero known critical safety defects | KEEP | R10, concept 84 |
| C57 | Proof-driven debloating | KEEP | W11 |
| C60 | MCP invisible to customers | ALREADY | concept 73 |
| C61 | First vertical slice through the product surface | ALREADY (partial: staging slice to first device step) | W9 |
| C63 | User effort as a formal metric | ADD | W3, concept 83 |

## Appendix D — Defect register (single live list)

Severity: CRITICAL = unauthorised action, data loss, secret exposure or wrong-target mutation; HIGH = release-blocking correctness, safety or product failure; MEDIUM; LOW. Sources: run logs and `evidence/2026-11-01-audit/codex-continuation.md`. Record hypothesis → result here so no defect is investigated twice.

| ID | Severity | Defect | Evidence | Status | Package |
|---|---|---|---|---|---|
| D1 | HIGH | Branch head red: planner safety, media nested-source containment, gateway result boundary, actor bound-host prevention, rendered-verifier/URL transport, formatting and DB revocation steps fail | [run 70](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41434622666), `f04228d` | OPEN | W0 |
| D2 | HIGH | Anonymous web verification: hidden page content passes; private/off-origin observations accepted; same URL fetched 13 times | run 68 (`82098c2`), seven-method negative suite | OPEN (repair in progress) | W1 |
| D3 | HIGH | Dispatch after browser permission was revoked while the claim was held | run 69 (`61b29b1`); migration `20261102061041_enforce_verifier_target_permissions.sql` drafted | OPEN | W1 |
| D4 | HIGH (risk) | SSRF, DNS-rebinding and redirect-hop enforcement for verifier fetch and actor browser not reviewed | source review; route-only interception may not block redirect hops | OPEN, UNVERIFIED | W1, W10 |
| D5 | HIGH | Unknown effects only fence the task; no resolution flow for the person | concept 55; run 57/58 | OPEN | W1 |
| D6 | HIGH | Verifier gaming: checks are model-authored, not bound to the request; no guard against edits to unrelated or input files | live runs 1 November; requirement 68 | OPEN | W1 |
| D7 | MEDIUM | Original-file compare-and-replace and directory-identity concurrency window | codex-continuation (run 53 scope note) | OPEN | W1 |
| D8 | HIGH | Device pickup backs off to 30 s; ~34% of live task time unaccounted | `agent.py` claim loop; eval timing | OPEN | W2 |
| D9 | HIGH | First-attempt real-task success 75% (< 90%): invented facts, dense-table row choice (r1c), checks bent to guesses | `evidence/2026-11-01-eval-s11` … `s14` | OPEN | W3 |
| D10 | HIGH | Planner “busy” after ~30–60 calls on the shared free project | `evidence/2026-11-01-eval-s14/README.md` | OPEN | W3 (pacing) |
| D11 | MEDIUM | Windows web ladder `KeyError 'page'` once; cause unknown | 1 November Windows run | OPEN | W7 |
| D12 | MEDIUM | CRLF script executable flag fix not verified live | eval s11 `crlf_script` | OPEN | W4 |
| D13 | MEDIUM | Windows `WinError 32` on fixture profile cleanup; lock owner never identified (quiescence wait added, run 64 green) | run 63 | MITIGATED | W8 |
| D14 | LOW | Ledgers disagree: concept 29 recorded BLOCKED although MAC-001…012 pass (run 45); five status files | `scripts/jarvis-traceability.mjs` entry 29 | OPEN | W0 |
| D15 | LOW | Stale Dependabot PRs target deleted `/jarvis-runtime` | open PRs #88, #90 | OPEN (needs A3) | W11 |
| D16 | HIGH (risk) | macOS window previews need Screen Recording permission on consumer Macs; CI runner is pre-authorised, so this path is unverified | `mac_worker.py` preview; Apple privacy model | OPEN, UNVERIFIED | W6 |

Closed recently (kept for history): approval arguments clipped at 4000 characters (fixed `43c50ed`, run 64); opaque native/page interactions mislabelled reversible (fixed `43c50ed`); unknown-write replay after resume (fenced `83f3142`, run 58); competing-file overwrite on publication (fixed `897675b`, run 49); installed companion started no worker (fixed `947ceee`); minimized macOS window reported as closed (fixed `a7cf182`).
