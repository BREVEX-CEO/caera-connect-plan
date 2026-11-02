# OCADE — Master Engineering Plan (v4)

> **The single authority for OCADE engineering scope, architecture, order, status and acceptance.** Version 4, 2 November 2026, branch `ocade/p00-p22-implementation`, written from evidence at `16654be` (code identical to `f04228d`). Read with `AGENTS.md` and `CLAUDE.md`. `docs/research/*` are supporting references; `docs/DECISIONS.md` and dated `evidence/` folders are history. `phases.md` does not exist (checked); it is not an authority.
>
> v4 keeps every one of the 266 requirements (Appendix A) and 84 concepts (Appendix B) verbatim with status and destination, evaluates all 236 research ideas (Appendix C) and holds the only live defect register (Appendix D). Old identifiers are mapped in §25.

## Part I — Start here

### 0. Codex quick start

1. **Your next task:** the first package in §19 whose status is not DONE. Today that is **W0** (green the branch head).
2. **Status lives only here:** Appendices A–D and §3. Update them in the same commit as the evidence. Never start a second ledger.
3. **Frozen decisions** (§6) are not reopened without new measured evidence recorded in §18.
4. **Loop:** reproduce → smallest root-cause fix → focused local checks → format → commit with its test → push → preflight CI → full matrix → update statuses (§24).
5. **PASS needs independent evidence** bound to a commit SHA and environment. Code, mocks, Windows Server runners and pre-authorised macOS runners never prove consumer-desktop behaviour.
6. **Never:** hardcode applications, journeys, selectors, files or answers; fake receipts, deliverables or results; rotate Gemini keys on a project-wide 429; weaken tests or safety checks; touch `main`, production, payments, paid services or the owner's PC.
7. **Read only what the package needs.** Each package names its files. The research documents are background, not required reading.

### 1. What OCADE is

OCADE BY CARCC is an autonomous computer-execution agent. The customer describes a result once. OCADE understands the objective, discovers what the authorised device can do, plans efficiently, operates authorised software **on the customer's own device**, recovers from recoverable errors, independently verifies the output and delivers usable, editable work. Intelligence comes from the authorised online Gemini service; execution stays local. It is not a chatbot, not a cloud desktop, not a set of demos and not a tool that needs technical setup.

**Success means:** ≥90% independently verified first-attempt success on a representative hidden-answer suite (95%+ is the ambition); zero known critical safety defects; no fabricated results; measured speed targets (§15); Windows 10, Windows 11 and macOS qualified on real hardware after cloud qualification.

### 2. Fixed owner decisions

| # | Decision |
|---|---|
| O1 | Windows 10, Windows 11 and macOS are mandatory. |
| O2 | Linux is optional and never blocks Windows/macOS release. |
| O3 | Use the existing authorised Gemini model (`gemini-3.5-flash-lite`, `src/lib/intelligence/online-models.ts`) and free capacity. No paid model upgrade as a default solution. |
| O4 | No paid infrastructure, purchases or unapproved spending. |
| O5 | One coding agent only; no parallel coding sub-agents. Codex must be able to follow this plan alone. |
| O6 | Finish coding and available cloud qualification before requesting real-PC testing. |
| O7 | No access to the owner's physical computer without separate approval. |
| O8 | Commercial activity comes after engineering completion and authorised real-device qualification. |
| O9 | Preserve all 266 requirements, all 84 concepts and trace every relevant research concept. |
| O10 | No hardcoded applications or customer journeys. |
| O11 | Explicit permissions and one task authority; genuine STOP and Take Over. |
| O12 | Never fabricate tests, benchmarks or completed work. |
| O13 | No `main` merge, deployment, payment activation, credential exposure or weakened security. |
| O14 | Free, non-deploying GitHub Actions validation on this branch is approved (1 November 2026); CI stays secrets-free, never contacts production, and no scheduled automations are created. |

**Standing safety invariants:** one task authority; Gemini is the only planner (online-only; never silently replaced by Offline Chat or a local model); every side effect is bound to account, device, task, grant, exact target identity, confirmation, idempotency key, STOP epoch and deadline, and rechecked at server and device immediately before mutation; STOP is local and independent of the model; an uncertain effect is never repeated automatically; originals are preserved and later user edits are never overwritten; no credential extraction and no UAC/MFA/CAPTCHA bypass; no automatic purchases; secrets never reach prompts, workers, pages, logs or CI; untrusted content never grants authority.

### 3. Verified status (2 November 2026)

Separate measurements; never combine them into one percentage.

| Metric | Value | Evidence |
|---|---|---|
| Requirements PASS | **70/266 (26.3%)**; unfinished 196 (159 PARTIAL, 14 FAIL, 5 BLOCKED, 18 UNTESTED) | Appendix A (conservative independent re-audit) |
| Architecture concepts PASS | **41/84 (48.8%)**; unfinished 43 (41 PARTIAL, 1 FAIL, 1 BLOCKED) | Appendix B, `scripts/jarvis-traceability.mjs` |
| Research ideas evaluated | 236/236 with a disposition | Appendix C |
| Commercial readiness | **10/100** (1/10 milestones; 17/42 conditions) | `evidence/readiness/READINESS.md` (`654af50`) |
| Cloud tests | Last all-green full matrix: [run 64](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41352301838) (`654af50`). Head code `f04228d` red ([run 70](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41434622666)). | Actions |
| Real-task success | **27/36 (75%)** first attempt, Linux, 1 Nov; not re-measured | `evidence/2026-11-01-eval-s11`…`s14` |
| Task time (39 live tasks) | Median 37 s, p95 79.7 s; model 56%, device execution 6%, user wait 3%, unaccounted ~34%; median 6 model calls (~3.5 s each) | eval `timing` fields |
| Defects | Critical 0 confirmed; High 12 (Appendix D) | Appendix D |

## Part II — Diagnosis

### 4. Root causes

**Development process (why progress was slow):**

| Cause | Status | Evidence | Remedy |
|---|---|---|---|
| Task measurement was forbidden until every gate passed | CONFIRMED | old plan §1.1/§5/§6; no provider calls in the last 26 commits | Evaluation checkpoints after packages (§20) |
| Architecture and plan restarts | CONFIRMED | `5568893` deleted 228,292 lines; DeepSeek harness added then retired; plan replaced 27 Oct, 31 Oct, 2 Nov | Architecture frozen (§6); changes only via §18 |
| Red head, rerun loops, formatting failures | CONFIRMED | 35/62 runs failed, 10 cancelled; runs 34, 52, 55, 70 failed on formatting | §24 local gate |
| Competing ledgers, evidence bloat | CONFIRMED | five status files; `evidence/` ≈ 339k lines | One ledger; summaries ≤50 KB |

**Product (why tasks fail or are slow) — failure taxonomy of the 9 first-attempt failures in seeds 11–14:**

| Cause class | Count | Examples | Model reasoning? |
|---|---|---|---|
| Missing typed capability (no way to set the executable bit; file edits only through confirmed shell) | 4 | `crlf_script` in s11, s12, s13, s14 | No — tool gap |
| Outcome checks compiled before anything was observed, then the model bent files to match its own guess | 3 | `config_repair` s11, s14; `crlf_script` copies (s12) | Partly — contract design |
| Edit granularity (whole-file rewrite changed an unrelated name) | 1 | `config_repair` s13 | Partly — fixed by `fs.edit_text` |
| Environment/provider | 2 counted elsewhere (browser display died; provider outage) | `web_fact` s11, `totals_workbook` s12 | No |

Earlier batches added dense-table row selection (`r1c`) and invented facts. **Conclusion (CONFIRMED on this sample):** most failures come from OCADE's capability surface and outcome contract, not from raw model reasoning. Engineering can recover most of the gap to 90% before the model becomes the limit.

**Confirmed capability gaps** (from `src/lib/jarvis/contracts.ts`, 35 operations):
- No typed copy, move, rename, create-folder, delete-to-trash or set-attributes (executable bit, read-only) operations. All of these go through `shell.run`, which needs a confirmation per command.
- `shell.run` is capped at 600 s (`timeoutSeconds` max 600). Long renders, exports and installs cannot run. There is no tracked long-running job.
- No read-only system diagnostics without confirmation (process list, service status, recent crash events, installed programs, file associations).
- Documents and workbooks can be created but not edited in place (structure-preserving). Presentations are unsupported. Images can be inspected and previewed but not edited.
- Video produces an MP4 only, with no open editable timeline. 3D scenes are saved only in OCADE's own format, with no open interchange format.
- Windows `shell.run` is PowerShell only (CMD only via PowerShell); macOS uses `sh`.

**Latency (CONFIRMED in code; size PROBABLE):** the device polls with exponential backoff from 1 s to 30 s (`device-agent/windows/ocade_agent/agent.py` claim loop), and every step needs a separate claim round trip after the model call.

## Part III — Architecture

### 5. Alternatives considered

| Alternative | Strengths | Weaknesses | Verdict |
|---|---|---|---|
| A. Current design unchanged | Safe authority, journal, verifier, lean workers | Capability gaps, polling, premature checks, many model calls | Insufficient |
| **B. Current design + capability surface + RTAA/RTVC split + measured speed work** | Reuses ~all verified code; fixes the measured causes; one agent can build it | Free-model accuracy ceiling is unknown | **Chosen** |
| C. Pixel-first computer-use model (screenshot → click loop) | Universal in principle; vendor-maintained | Slow per step; wrong-target risk; weak editability and proof; the authorised free model's computer-use availability is unverified | Rejected as the primary path; evaluated as a last-resort visual fallback (A10, W5) |
| D. Local small-LLM router + vector DB + MCP swarm (reference document) | Low latency for routing | Installer size (GBs), owner rule O3 (online-only planner), duplicated planners, no evidence of accuracy gain at ~40 tools | Rejected |
| E. Cloud VM per customer (ChatGPT agent / Grok style) | Isolation, easy scaling | Cannot touch the customer's local files and apps; violates the product promise and O4 | Rejected |
| F. Full rewrite of authority/gateway | None measured | Throws away verified safety work; repeats the 30 October restart | Rejected |

### 6. Final architecture (frozen)

```text
Customer web UI ──HTTPS──▶ Task authority (Supabase RLS, grants, STOP epoch, journal, timing)
                               │ generation permit + project-wide pacing (no key rotation on 429)
                               ▼
RTAA (server): supervisor + Gemini pilot (gemini-3.5-flash-lite via ocade-intelligence-service)
   outcome contract (after discovery) · milestones · guarded step lists · stall/budget control
                               │ policy gate per step (scope, exact target, risk, confirmation, idempotency, deadline)
                               ▼  content-free wake nudge + signed claim (outbound only)
Device Agent / Local Gateway (installed once)
   RTVC (device): world-state cache · target leases · change detection · user-activity guard
   persistent MCP/STDIO workers: fs · office · shell+jobs · system · web · ui_bridge (UIA|AX) · media · scene · verify
                               │ receipts (effect known/unknown) + observation deltas + previews on demand
                               ▼
Journal ─▶ independent verifier (request-bound checks) ─▶ settlement · deliverables · timing
```

**Responsibilities (no overlap):**

| Owner | Decides / holds | Never |
|---|---|---|
| Task authority | Durable task state, grants, STOP epoch, journal, timing | Plans steps |
| RTAA supervisor | Contract validation, milestones, step-list acceptance, budgets, when to call Gemini | Chooses task-specific actions itself |
| Gemini pilot | Outcome checks (after discovery), next step or short guarded step list, revisions | Grants access, declares PASS, sees secrets |
| Policy gate | Exact permission for each step | Trusts model-written authority |
| RTVC (device) | Observation freshness, exact target identity, local change detection, executing primitives, local guard checks between steps | Chooses customer goals; keeps durable task state |
| Workers | One primitive operation each, with an observed receipt | Choose itineraries; fabricate outputs |
| Verifier | Request-bound postconditions from independent evidence | Accepts model or tool claims |
| Codex (engineer) | Builds infrastructure, tests, harnesses | Directs production tasks; creates outputs to fake acceptance |

**Component verdicts:**

| Component | Verdict | Reason |
|---|---|---|
| Task authority, RLS, grants, journal, STOP, Take Over | KEEP | Verified; defects are local (Appendix D) |
| One generated protocol (`contracts.ts` → `protocol.json`) | KEEP | Verified drift check |
| Planner loop (`planner.server.ts`) | OPTIMIZE | Contract after discovery, guarded step lists, smaller context, thinking-level A/B |
| Outcome checks compiled before observation | REPLACE | Caused 3 of 9 failures; compile after a discovery pass, bind to the request |
| Device claim backoff polling | REPLACE | Content-free wake nudge + no backoff while a task is active + piggyback dispatch |
| MCP over stdio, persistent workers | KEEP | Execution is 6% of task time; stdio is the MCP-recommended local transport |
| Inline base64 previews over JSON-RPC | OPTIMIZE | Pass large binaries as workspace file handles |
| TF-IDF shortlist (≤12 operations) | KEEP | ~40 operations; embeddings only if measured recall <98% |
| `shell.run` as the only file-management path | MERGE into typed primitives | Typed fs operations (copy/move/rename/mkdir/trash/attributes) without per-command confirmation for reversible workspace changes |
| Long-running work | ADD `job.*` | Tracked background processes with progress, STOP, resume/reattach, no 600 s cap |
| Read-only diagnostics | ADD `system.*` read operations | Process, service, crash-event, installed-program and association facts without confirmation |
| Office | OPTIMIZE + ADD | In-place structure-preserving edits for docx/xlsx; presentations (pptx) |
| Images | ADD `image.*` | Non-destructive operations (crop, resize, adjust, composite, text) with the original kept |
| Video timeline | OPTIMIZE | Also write an open editable timeline (OpenTimelineIO) |
| 3D (`scene.render`) | OPTIMIZE | Also export glTF 2.0; external 3D apps used through generic discovery + jobs |
| Windows UIA bridge | OPTIMIZE | Depth, events, packaged apps, focus rules, DPI |
| macOS AX bridge | OPTIMIZE | AXObserver events, permission onboarding, ScreenCaptureKit previews, packaging |
| Browser (dedicated profile) | OPTIMIZE | Installed-browser discovery, tabs, pickers, prompts, structured tables |
| Visual fallback | ADD | Feature/template matching with confidence threshold, last resort |
| Verifier | OPTIMIZE | Request-bound; unrelated-file guard; deeper format checks; sandboxed re-run |
| Installer | OPTIMIZE + ADD | Updater, dependency manager, macOS app bundle |
| Local LLM / vector DB / agent swarm / cloud desktop | REMOVE from consideration | §5 |

### 7. RTAA — Real-Time Adaptive Action (server decision layer)

RTAA is the existing supervisor + Gemini pilot loop, made faster and more accurate. It owns **decisions and durable state**; RTVC (§8) owns **perception and actuation** on the device. They share one task, one journal and one STOP epoch; there is no second planner or state store.

**Loop:** discover → contract → milestone → step or guarded step list → device executes with local guards → observation delta → (only if needed) Gemini → … → verify → deliver.

| # | Question | Decision |
|---|---|---|
| 1 | Why slow today? | Six model calls per task, a claim round trip per step, backoff pickup and full-history prompts. |
| 2 | What needs Gemini? | Interpreting the goal, choosing the method, choosing targets among observed candidates, creative/content decisions, recovering from unexpected states. |
| 3 | What is deterministic? | Policy checks, target revalidation, read batching, guard evaluation, retries of transient transport errors before dispatch, stall detection, verification, packaging results. |
| 4 | Grouping reads | Gemini may request up to 8 independent reads; RTVC runs them in parallel and returns one delta. Any read that shows a change outside the expected scope is surfaced explicitly. |
| 5 | Safe sequences without losing checks | **Guarded step lists** (≤5 steps). Each step carries its own `expect` condition. Each step is policy-validated at dispatch and rechecked on the device before execution. Only read and reversible workspace operations are allowed, plus at most one confirmed external effect, which must be last. Execution stops at the first failed guard, unknown effect, STOP, user activity or lease change. Adoption is gated on E1 showing no accuracy loss. |
| 6 | Plan invalid? | An `expect` guard fails, the target lease changes, the user is active, or the observation contradicts a milestone assumption. Return to Gemini with the delta. |
| 7 | Failed vs unacknowledged | The journal records intent before dispatch. A missing receipt makes the effect `unknown`, and RTVC inspects the target state (hash, existence, value) before anything else. |
| 8 | Never repeat a changed task | An unknown write fences the task until reconciled. The person sees what may have changed and chooses (W1). |
| 9 | Unfamiliar applications | Discovery → structured inspection → generic primitives. No application branches. |
| 10 | Shortest safe route | Native/file/format operations first, then scripts, browser DOM, accessibility, vision. The shortlist offers only healthy, granted mechanisms. |
| 11 | Ambiguity | Choose the reversible default and report it. Ask only when the choice is irreversible, externally visible or materially changes the deliverable. |
| 12 | Fewer calls, same accuracy | Guarded step lists, read batching, composite primitives, contract after discovery. Measured by E-checkpoints, not assumed. |
| 13 | Stale observations | Observation tokens and window/page leases expire on change; stale references are refused (exists). |
| 14 | Long exports, installs, renders | `job.start` returns at once. RTAA polls `job.status` at a bounded rate without model calls until done, failed, STOPped or past its deadline. |
| 15 | Depth vs latency vs accuracy | Measured per E-checkpoint: calls/task, p50/p95 time and success, each with and without step lists and thinking level. Keep whichever wins on success first, then time. |

**Milestones:** the contract (checks) plus up to 6 milestones are stored in durable task state. They are validated by the supervisor, shown to the person and survive restarts. They are not a fixed script: Gemini may revise milestones only with evidence, and checks remain immutable except by an explicit request-scoped clarification.

### 8. RTVC — Real-Time Visual and Computer Control (device perception and actuation)

RTVC is the device-side layer inside the existing agent and workers. It keeps a short-lived **world-state cache**: windows (pid, handle, start time, title), the focused element, open documents and their hashes, browser pages (origin, URL, observation tokens), running jobs and the last user-input time. Evidence sources, in order of preference: application object models and file formats → OS APIs → browser DOM/CDP → UIA/AX trees and events → previews and visual matching.

| # | Question | Decision (with limits) |
|---|---|---|
| 16 | UIA on minimized windows | Not reliable. Many providers do not expose or act on minimized content, and UIA actions may move focus by default (`AutoSetFocus`, Microsoft docs). Policy: refuse with `window_minimized`, or restore with the person's consent when the task needs that window; never claim hidden-window control. |
| 17 | What needs foreground | Synthetic keyboard/mouse input (SendInput, CGEvent) and some application commands. Windows restricts which process may take the foreground (`SetForegroundWindow` rules). Value/invoke patterns usually do not need foreground, but may take focus; `AutoSetFocus` is disabled where the pattern allows it. |
| 18 | Custom-drawn controls | Canvases, games and GPU-drawn UIs expose little or no tree. Use the app's scripting interface or file format first, then visual matching with confidence (W5). Report the limit if neither works. |
| 19 | Button without a stable id | Identify by role + name + ancestor path + relative box from the current observation; tokens are valid only for that observation. AutomationIds are not guaranteed stable across versions. |
| 20 | Resize | The lease survives resize/move; boxes are window fractions recomputed from a fresh inspect; never reuse old coordinates. |
| 21 | Resolution and scaling | Per-monitor DPI-aware process; transforms tested at 100/125/150/200% (runner where possible, RPC for real hardware). |
| 22 | Multiple monitors | Window-relative coordinates only; multi-monitor qualification is RPC (runners have one display). |
| 23 | Two windows of one app | The lease binds pid + window handle (Windows) or window number (macOS) + process start time; title alone never identifies a target. |
| 24 | User changed the active document | Document hash/path in the lease; foreground and focus change events; mismatch fences the next mutation. |
| 25 | Events instead of screenshots | UIA events (focus, structure, property) and macOS AXObserver notifications update the cache; previews are taken only when requested or for canvas targets. |
| 26 | When images help | Canvases, charts, render quality, visual layout checks, ambiguous icon-only controls. |
| 27 | When visual matching | Only when no structured target exists and the app offers no scripting/format path. |
| 28 | Confidence | Below threshold: refuse and ask Gemini for another route. Above threshold: allowed only for reversible steps, followed by mandatory post-action observation. |
| 29 | User moves the mouse or types | Mutations pause while the person's input is newer than OCADE's last action (exists on Windows and macOS); the task shows "waiting for you" until resumed or Take Over ends. |
| 30 | Background work | File, format, command and job operations continue while the person works elsewhere. UI input never runs in background windows. |
| 31 | No physical mouse movement | UIA/AX patterns, DOM actions, file/format operations and commands. Pointer clicks are the last resort and move the pointer. |
| 32 | Unresponsive app | Bounded UI timeouts; `IsHungAppWindow` on Windows and AX timeouts on macOS mark the window `unresponsive`; never kill a customer app without confirmation. |
| 33 | Proof of target | Pre-action lease check + post-action readback of the targeted element/file/page; the receipt carries both. |
| 34 | Faster without losing control | Cached trees with event invalidation, parallel reads, `set_value` instead of typing, file operations instead of UI, warm browser for web tasks. |
| 35 | Fewer AI observations | Deltas instead of full trees, previews on demand, local guard evaluation for step lists. |

### 9. Gemini strategy (accuracy and quota) on the free model

1. **Contract after discovery:** a cheap discovery pass (list, inspect, read) runs first; checks are compiled with that evidence, bound to the request (A1), immutable afterwards.
2. **Grounding:** facts, versions, addresses and file names come only from task observations; unseen deep URLs are refused (exists); "unknown" is allowed.
3. **Structured perception:** table rows with headers and per-row links; document outlines; typed workbook ranges; filtered accessibility trees.
4. **Short tool descriptions:** one precise line each; shortlist ≤12; measure recall.
5. **Guarded step lists and read batching** (§7).
6. **Verifier feedback:** measured results drive at most two repairs.
7. **Error taxonomy** in every refusal and failure.
8. **Thinking level A/B:** Gemini 3-generation models expose `thinking_level` (Google docs; verify for the authorised model). Run the same seeded suite at the default and at a lower level; adopt what maximises success first, then speed, within quota. Preserve thought signatures across function-call turns as required by the provider.
9. **Computer-use tool:** check whether the authorised model exposes it on the free tier; if yes, evaluate it only as a visual fallback provider, never as the planner.
10. **Prompt-injection fencing:** untrusted text is labelled and cannot change scope, recipients or checks.
11. **Quota discipline:** read actual per-minute/per-day limits from provider responses (third-party reports: ~10 RPM, ~500 RPD for Flash-Lite free — unverified); one project-wide pacer; queue instead of failing; checkpoint before every call so quota exhaustion resumes exactly; evaluation ≤60% of the daily budget; never rotate keys on 429.
12. **Beyond the model:** long creative judgment, aesthetic quality and very long horizons may remain below target. If ≥90% cannot be reached after these levers, R5 is recorded BLOCKED with evidence; the target is not lowered.

### 10. Local execution and MCP/STDIO

- **Transport:** keep MCP over stdio for gateway↔worker. It is the MCP-recommended local transport (modelcontextprotocol.io, transports). Named pipes or sockets would not change the measured profile, because execution is 6% of task time. Streamable HTTP is for remote servers and adds an attack surface; rejected for local workers.
- **Payloads:** binaries >256 KB move as workspace file handles plus sha256, not base64 in JSON-RPC.
- **Workers:** persistent per gateway session (exists); fs/office/shell/system/verify start with the gateway; web, media and scene start on first use and stay for the task.
- **Cloud↔device:** a content-free wake nudge on a per-device Supabase Realtime broadcast channel (free plan: 200 concurrent connections, 100 messages/s — Supabase docs). The nudge carries no data. The device still claims with its signed request, so authority is unchanged. While a task is active the device claims without backoff; polling fallback is capped at 10 s idle. The receipt response carries the next dispatched action when one is ready (piggyback).
- **Routing:** deterministic trust/grant/health/OS filters first, then TF-IDF ranking, ≤12 operations. Embeddings only if measured recall on the eval set is <98%.
- **External MCP servers:** pinned by executable and argument hashes (exists); never auto-installed from registries; evaluated in W11 (provenance, licence, permissions).

### 11. Platform engineering

**Windows 10 and 11:**
- UIA patterns (Invoke, Value, Toggle, ExpandCollapse, SelectionItem, Scroll, Text, Window, Grid/Table) with `AutoSetFocus` off where possible.
- Events for focus, structure and property changes.
- Win32 fallback.
- COM object models reached only through confirmed generic scripting.
- Packaged-app discovery (App Paths, Start Menu, `Get-AppxPackage`, file associations).
- Foreground rules and UIPI: elevated windows are refused, with a clear message.
- Per-monitor DPI awareness.
- PowerShell 5.1 and `cmd.exe` as explicit shells.
- Job Objects for containment.
- Recycle Bin deletion.
- Smart App Control/SmartScreen diagnosis without bypass.
- Windows 10 vs 11 differences to cover: packaged inbox apps, default terminal, Start menu, WebView2 presence, UIA provider behaviour, Smart App Control.
- Cloud proxies: `windows-2022` and `windows-2025` runners (Server editions). Consumer qualification is RPC.

**macOS:**
- AXUIElement with AXObserver notifications.
- Accessibility trust check and onboarding (`AXIsProcessTrusted`), with revocation detection.
- Screen previews through ScreenCaptureKit with the Screen Recording permission (`CGWindowListCreateImage` is unavailable when building against the macOS 15 SDK); degrade to AX-only when the permission is not granted.
- CGEvent input only for the foreground app.
- `zsh`/`sh` shells.
- Trash deletion.
- Gatekeeper/quarantine diagnosis without bypass.
- PyInstaller `.app` bundle.
- Apple Silicon (`macos-15`) and Intel (`macos-15-intel`) runners are listed by GitHub's runner-images (verify availability before relying on them).
- Signing and notarisation are paid (COM).

### 12. Professional deliverables (generic, editable, verified)

| Domain | Production path | Editable form | Verification |
|---|---|---|---|
| Spreadsheets | openpyxl + discovered engine recalculation; in-place structure-preserving edits | .xlsx | formulas, typed cell values, ranges, independent recomputation |
| Documents | python-docx; in-place edits preserving styles | .docx (+PDF) | structure, text, styles, page render |
| Presentations | python-pptx (MIT; new dependency justified by requirement 200) | .pptx | slide count, text, layout boxes, render |
| Images | Pillow non-destructive operations; original kept | output + edit list | dimensions, perceptual difference, requested regions changed |
| Video | ffmpeg timeline render | MP4 + OpenTimelineIO (.otio) timeline (Apache-2.0; importable by major editors — verify per editor) | duration, fps, codecs, audio, shot statistics |
| 3D / CAD | `scene.render` primitives or a discovered application (e.g. Blender) via its documented command-line/scripting interface run as a `job` | native project + glTF 2.0 export | geometry statistics, materials, re-open check, render completion |
| Code/config repair | `fs.edit_text` | the file | parse check; re-run in a sandboxed copy with no network and a time limit |

Applications such as Blender or LibreOffice are discovered like any other application. No application name appears in production routing.

### 13. Security, permissions, STOP and recovery

| # | Situation | Required behaviour |
|---|---|---|
| 111 | Wrong window selected | Lease mismatch refuses before effect; post-action readback detects any miss; a wrong-target effect is a CRITICAL defect. |
| 112 | Permission revoked while queued | Recheck at claim and at execution (D3 fix); refuse with `permission_revoked`. |
| 113 | Success with lost confirmation | Effect `unknown`; reconcile from target state before anything else. |
| 114 | Same write twice | Idempotency key + journal; a duplicate is refused. |
| 115 | Redirect to unauthorised site | Navigation bound to granted origins; every redirect hop is checked (D4). |
| 116 | Unrelated file | Writes only inside granted scope; verifier diff guard flags unrelated changes. |
| 117 | Reversible vs irreversible | Risk class per operation from the protocol: read, reversible workspace, external effect, destructive. External and destructive effects need exact confirmation. |
| 118 | STOP during a long operation | Local fence at once; `job` process tree terminated; the receipt says what may have completed. |
| 119 | Possibly completed actions | Shown as "may have changed: …" with inspect/confirm/discard choices. |
| 120 | Recover without repeating danger | Resume only from reconciled state; unknown external effects are never retried automatically. |
| 121 | User regains control | STOP and Take Over are always available locally (tray) and on the web; input pause. |
| 122 | Never removed for speed | Lease checks, policy recheck, idempotency, STOP fence, confirmation of external/destructive effects, verifier independence. |
| 123 | Unfamiliar MCP tools | Never installed automatically; reviewed, pinned, permission-scoped (W11). |
| 124 | Recovered task marked success | Only after the verifier passes on reconciled state. |
| 125 | Immediate refusal | Revoked or expired grant, stale epoch, lease mismatch, elevated target, secure desktop, credential prompt, payment, unknown external effect, untrusted executable. |

Hard limits: steps ≤30 (`MAX_STEPS`), failures ≤5, verification attempts ≤3, step list ≤5, job deadline set per job; STOP is never blocked.

### 14. Independent verification

- The verifier runs in its own worker and never sees hidden test answers.
- Checks are request-bound and immutable after start (A1).
- Each check returns measured evidence.
- A diff guard reports any change outside the declared outputs.
- Format-specific checks are listed in §12.
- Human review is recorded only for subjective quality; it is never automated as PASS.

### 15. Performance targets (by workload)

All targets are to be measured; none is achieved yet unless a baseline is shown.

| Measure | Baseline | Target p50 / p95 |
|---|---|---|
| Task accepted → device claim (task active) | backoff up to 30 s | ≤0.5 s / ≤1.5 s |
| Task accepted → device claim (idle, nudge) | up to ~31 s | ≤1 s / ≤3 s |
| Claim → worker starts the primitive | not measured | ≤150 ms / ≤400 ms |
| File list/metadata (≤1,000 entries) | not measured | ≤50 ms / ≤200 ms |
| Read text ≤10 MB | not measured | ≤200 ms / ≤600 ms |
| UIA/AX action incl. revalidation and readback | not measured | ≤300 ms / ≤1 s |
| Browser action incl. capture | not measured | ≤800 ms / ≤2 s |
| Command start (`shell.run`/`job.start`) | not measured | ≤150 ms / ≤500 ms |
| Model calls — simple / medium / complex creative | median 6 overall | ≤3 / ≤6 / ≤40 (budgeted) |
| End-to-end simple task (≤3 effects) | ~37 s median overall | ≤15 s / ≤35 s |
| End-to-end medium task | — | ≤45 s / ≤120 s |
| Long media/3D | — | render time reported separately; orchestration overhead ≤10% |
| Unaccounted time | ~34% | ≤5% |
| Verification share (file tasks) | not measured | ≤10% |
| Agent idle CPU / RAM without browser | not measured | ≤0.5% / ≤150 MB |

**Measurement:** per-phase timestamps (accepted, wake, claim, dispatch, worker start, effect, observation, verify, delivered), plus per-call model latency and prompt tokens. Targets count as met only over ≥30 tasks per category on the stated platform.

### 16. Quality scorecard (honest)

Current scores are evidence-based judgments. Projected scores are design expectations if the plan succeeds; they are **not achievements**. A category reaches 95 only with the evidence in the last column.

| Category | Current | Projected | Main limit now | Evidence required for 95 |
|---|---|---|---|---|
| Product architecture | 74 | 90 | capability gaps, polling | R1–R10 PASS; E4 ≥95% |
| Universal control coverage | 45 | 80 | canvases, no visual fallback | ≥95% of a pre-registered random sample of 50 installed apps operable for scoped tasks; true universality is impossible |
| Speed | 40 | 88 | polling, call count | §15 targets met on Windows/macOS runners and RPC |
| Task-selection accuracy | unmeasured (50) | 88 | no hidden-target test | ≥98% correct target on hidden-target suite (req. 65) |
| First-attempt completion | 60 (75% measured) | 85–90 | contract, tool gaps, free model | ≥95% on E4 + E5 (≥100 tasks, CI lower bound ≥90%) |
| Reliability and recovery | 65 | 90 | unknown-effect UX, long jobs | fault-injection suite 100% safe outcomes |
| Windows 10 | 25 | 85 | server-only evidence | RPC Windows 10 suite ≥95% |
| Windows 11 | 30 | 88 | server-only evidence | RPC Windows 11 suite ≥95% |
| macOS | 20 | 82 | permissions, packaging, signing | RPC macOS suite ≥95%; signed/notarised build (COM) |
| Security | 75 | 92 | open HIGH defects (D2–D4) | zero open critical/high; external review |
| Permission safety | 80 | 94 | revocation timing (D3) | adversarial suite 100% refusals |
| Independent verification | 65 | 92 | not request-bound (D6) | gaming suite 100% caught; format checks complete |
| Professional output quality | 35 | 75 | no edit-in-place, subjective quality | blind human rating ≥4/5 on ≥20 deliverables (RPC); a free-model ceiling is likely |
| Tool routing | 70 | 90 | recall unmeasured | recall ≥98%, wrong-tool rate ≤2% |
| Application discovery | 55 | 88 | packaged apps, macOS | ≥98% of installed apps found on RPC machines |
| Maintainability | 62 | 88 | ledger sprawl | one ledger; no file >800 lines without reason; green head ≥90% of days |
| Resource efficiency | unmeasured (50) | 85 | no data | §15 resource targets met on low-end RPC hardware |
| Customer usability | 35 | 85 | no completed first task in UI | unassisted first task by 5 non-technical users (closed beta) |
| Competitive differentiation | 50 | 80 | no head-to-head data | benchmark wins in ≥3 pre-registered categories (§17) |
| Commercial readiness potential | 10 | 80 | gates closed | R10 + closed beta + signing (COM) |

### 17. Competitors and the benchmark plan

| Product | Status (verify before quoting) | Likely strength | OCADE angle |
|---|---|---|---|
| Gemini computer use (3.5 Flash tool; Gemini 4 Argon lists computer use as Preview) | API, preview | Vendor model quality | Local execution with proof |
| Claude computer use (desktop app; Mac and Windows) | research preview | Strong reported OSWorld-Verified scores (third-party leaderboards; vendor-reported) | Verified editable outputs, exact approvals |
| ChatGPT agent | paid plans; cloud VM | Web tasks in an isolated VM | Local files and apps |
| Manus "My Computer" | local desktop app (Mac/Windows) | Local files and commands | Independent verification, STOP semantics |
| OpenClaw | open-source, self-hosted; shell + browser | Free, extensible | Safety, permissions, proof |

Answers to 126–140: no reliable public data establishes which competitor is fastest, most accurate on unfamiliar desktop software, or strongest in recovery or low-resource use; vendor benchmarks are self-reported and not comparable. OCADE is objectively weaker today in success rate (75%), platform evidence and polish. Its potential differentiator is **independently proven, editable, locally produced results under exact permissions**. Superiority is shown only by a pre-registered benchmark: identical hidden tasks, identical machines, first attempt, measured time, intervention count and verifier result, run in COM when accounts are available (requirement 259).

### 18. Self-challenge log

- **Rejected:** local LLM routing; vector DB blueprints; agent swarms; cloud desktop; full rewrite; Streamable HTTP for local workers; continuous screenshot streaming; infinite retries; "immutable" automation IDs; hidden-window control claims; auto-installing registry MCP servers; automatic privilege elevation.
- **Kept despite fashion pressure:** stdio, TF-IDF, single authority, pixel control as last resort only.
- **Decisions to reverse if evidence contradicts them:**
  - Guarded step lists, if E1 shows lower success.
  - TF-IDF, if recall <98%.
  - Thinking level, if the A/B favours the other setting.
  - Realtime nudge, if the free limits or reliability fail (fall back to active-task polling).
  - python-pptx, if LibreOffice conversion proves sufficient.
  - OTIO, if target editors cannot import it.
- **Risks introduced by this plan:**
  - Step lists add a new failure mode; mitigated by guards and the read/reversible-only rule.
  - Typed fs operations without per-command confirmation; mitigated by scope limits, reversibility (trash) and verifier diff checks.
  - Jobs add long-lived processes; mitigated by Job Objects or process groups, deadlines and STOP.
  - The Realtime channel adds a dependency; it is content-free and has a polling fallback.
- **Simplest defensible architecture:** the current spine plus the typed capability surface, with no new services.

## Part IV — Execution for Codex

### 19. Work packages (dependency-ordered)

Each package: Objective · Evidence now · Requirements · Approach · Files · Depends · Acceptance · Tests · Risks · Proof · Next. Effort estimates are ranges for one agent; total ≈ 65–120 agent-days before RPC, dominated by evaluation pacing.

| WP | Title | Depends | Requirements (Appendix A) | Concepts (Appendix B) | Effort |
|---|---|---|---|---|---|
| **W0** | Green baseline and one ledger | — | 10, 43, 196, 214–215, 236–238 | 9, 22, 39–41, 44, 82 | 1–2 d |
| **W1** | Safety closure and request-bound contract | W0 | 13, 21, 32, 35–41, 66–69, 79–80, 171, 193, 210, 216, 220 | 4–5, 7, 21, 38, 50, 52–57, 61 | 4–8 d |
| **W2** | Measurement and pickup speed | W1 | 81–92, 94, 96 | 2, 42–43, 47–48, 51, 70, 78 | 3–6 d |
| **W3** | Capability surface (typed fs, jobs, diagnostics, shells, mechanism fallback) | W2 | 28–30, 93, 136–137 | 25–27, 37, 69 | 5–9 d |
| **W4** | Accuracy engine and evaluation loop → E1 | W3 | 23, 31, 33–34, 46–57, 60, 63, 65, 166, 197–199, 201–202, 204, 207, 219 | 6, 8, 10, 14–20, 23, 49, 60, 77, 83 | 6–12 d |
| **W5** | Professional deliverables and visual fallback → E2 | W4 | 61, 70–75, 77, 211 | 36, 74–76 | 7–12 d |
| **W6** | Windows 10/11 | W5 | 58–59, 122–130 | 11–12, 28, 32–35, 58–59 | 5–9 d |
| **W7** | macOS | W5 | 131–132 | 11–12, 29, 32–33, 35, 58–59 | 6–10 d |
| **W8** | Browser and web → E3 | W5 | 62, 76, 139–145 | 30–31, 33 | 3–6 d |
| **W9** | Install, dependencies, versioning, updates | W6, W7 | 44–45, 97–120, 185–190, 217 | 13, 24, 45, 65, 68 | 6–10 d |
| **W10** | Customer product | W9 | 146–160, 221 | 71–73 | 6–12 d |
| **W11** | Security, privacy, operations | W10 | 78, 161–165, 167–170, 172–173, 175–182, 212, 222 | 46, 62–64, 66–67 | 5–8 d |
| **W12** | Proof-based debloat | W11 | 243 | 81 | 2–4 d |
| **W13** | Full cloud qualification → E4 | W12 | 3, 138, 191–192, 194–195, 200, 205, 208, 218, 223–224 | 1, 79–80, 84 | 7–14 d |
| **W14** | Linux (optional) | W5 | 134–135 | — | optional |
| **RPC** | Real-PC validation → E5 (approval A2) | W13 | 121, 133, 209 | — | per approval |
| **COM** | Commercial prerequisites (§23) | RPC | 259 | — | later |

Standing rules (S), verified at every release gate: 1–2, 4–9, 11–12, 14–20, 22, 24–27, 42, 64, 95, 174, 183–184, 203, 206, 213, 225–235, 239–242, 244–258, 260–266. Standing concept: 3.

#### W0 — Green baseline and one ledger
- **Objective:** a green, trustworthy integration head and one ledger.
- **Evidence now:** run 70 red (D1); ledgers disagree (D14).
- **Approach:** finish the in-flight repairs the red tests describe (verifier visibility/origin, revocation, media nested sources, gateway result boundary, actor host prevention); apply the formatter; add a pointer to this file at the top of `evidence/2026-11-01-audit/requirements-266.md`, `evidence/2026-11-01-live/architecture-ledger.md` and `evidence/2026-11-01-audit/codex-continuation.md`; correct concept 29 to PARTIAL in `scripts/jarvis-traceability.mjs` and its ledger with run 45 evidence.
- **Files:** `device-agent/windows/ocade_agent/{verify_worker,gateway,media_worker,web_worker}.py`, `src/lib/jarvis/*`, the new migration, the three ledgers, `scripts/jarvis-traceability.mjs`.
- **Acceptance:** the full matrix is green on the head; `npm run jarvis:traceability` and `npm run readiness` agree with Appendix B and §3.
- **Tests:** existing focused suites, then the full matrix.
- **Risks:** fixes may be larger than the red tests suggest; keep each fix minimal.
- **Proof:** run URL + SHA in Appendix D (D1, D14 closed).
- **Next:** W1.

#### W1 — Safety closure and request-bound contract
- **Objective:** no open high safety defect; checks bound to the request and compiled after discovery.
- **Evidence now:** D2–D7 open; 3 of 9 eval failures came from premature or gamed checks.
- **Approach:**
  - Close D2–D7.
  - Split goal compilation into a read-only discovery step followed by contract compilation.
  - The contract references only request-named inputs or new outputs and is immutable after start.
  - Unknown-effect resolution UI and API: what may have changed, with inspect/confirm/discard.
  - Clear state transitions on network outage.
- **Files:** `src/lib/jarvis/{planner.server,authority.server,supervisor,contracts}.ts`, `src/jarvis/JarvisPanels.tsx`, `verify_worker.py`, migrations via the CLI generator only.
- **Acceptance:** gaming regression refused; revocation mid-turn refused; unknown effect never re-dispatched; zero open HIGH safety defects in Appendix D.
- **Tests:** `tests/security/*`, DB suites, a new gaming fixture with a randomised file name.
- **Risks:** stricter contracts may cause more clarification questions; measure in E1.
- **Proof:** full matrix + Appendix D updates.
- **Next:** W2.

#### W2 — Measurement and pickup speed
- **Objective:** remove waiting that is not model time.
- **Evidence now:** ~34% unaccounted time; backoff to 30 s.
- **Approach:**
  - Per-phase timestamps (§15).
  - Claim without backoff while a task is active.
  - Content-free Realtime wake nudge with a 10 s polling fallback.
  - Piggyback the next dispatch on the receipt response.
  - File-handle payloads above 256 KB.
  - Warm worker start.
- **Files:** `agent.py`, `device.py`, `authority.server.ts`, `jarvis_claim_action` migration (generated), `gateway.py`.
- **Acceptance:** active-task claim p95 ≤1.5 s and idle p95 ≤3 s on Linux and runners; unaccounted ≤10%; Workers request budget computed and documented.
- **Tests:** synthetic-provider timing suite (≥30 tasks); nudge loss falls back to polling; a forged nudge causes no effect.
- **Risks:** Realtime limits (200 connections free); fallback keeps correctness.
- **Proof:** timing summary JSON (≤50 KB).
- **Next:** W3.

#### W3 — Capability surface
- **Objective:** typed primitives for the work that currently forces confirmed shell commands, and long-running jobs.
- **Evidence now:** 4/9 failures were tool gaps; `shell.run` caps at 600 s.
- **Approach:**
  - **Typed fs operations** (`copy`, `move`, `rename`, `mkdir`, `trash`, `set_attributes`) inside granted scope: no confirmation for reversible workspace changes, journaled, with the original kept.
  - **`job.start/status/cancel`:** confirmed command or discovered application CLI; Job Object or process group; progress from a log tail or output files; STOP terminates; reattach or report `unknown` after an agent restart; deadline.
  - **Read-only `system.*`:** processes, services, crash events, installed programs, associations, environment.
  - **Explicit shell choice:** PowerShell, cmd, sh, zsh.
  - **Mechanism fallback:** a failed structured route offers the next allowed mechanism with a fresh observation.
- **Files:** `contracts.ts` (then `npm run jarvis:protocol`), `office_worker.py`/`sandbox.py`, `command_worker.py`, `discovery.py`, `planner.server.ts`.
- **Acceptance:** the `crlf_script`-class tasks pass on the first attempt in a fresh eval sample; a 30-minute job survives STOP correctly and an agent restart reports truthfully; no unconfirmed external effect possible.
- **Tests:** unit + real-worker tests on all three runner OSes; fault injection (kill the agent mid-job).
- **Risks:** a larger tool list; mitigated by the shortlist.
- **Proof:** focused + full matrix.
- **Next:** W4.

#### W4 — Accuracy engine and evaluation loop
- **Objective:** maximise first-attempt success on the free model and measure it continuously.
- **Evidence now:** 75%; no hidden-target test.
- **Approach:**
  - §9 items 2–11.
  - Guarded step lists behind a flag.
  - Generators for every §20 category plus the regression set (requirement 207) and hidden-target accuracy (requirement 65).
  - User-effort count.
  - Project-wide pacer.
  - Thinking-level A/B.
- **Files:** `planner.server.ts`, `tests/jarvis/live_eval.py`, `supabase/functions/ocade-intelligence-service` (pacer; no secrets moved), `web_worker.py`/`office_worker.py` (structured reads).
- **Acceptance:** E1 with ≥40 tasks recorded; ≥85% working target before W5; calls median ≤4; zero gaming; quota never exhausted unexpectedly.
- **Tests:** E1, paced, from the agent container against staging.
- **Risks:** a model ceiling. If below 85%, analyse by category before proceeding; never tune to fixtures.
- **Proof:** E1 summary + failure taxonomy in Appendix D.
- **Next:** W5.

#### W5 — Professional deliverables and visual fallback
- **Objective:** editable, verified professional outputs across documents, sheets, presentations, images, video and 3D.
- **Approach:**
  - The §12 table: in-place docx/xlsx edits, pptx, `image.*`, OTIO timeline, glTF export.
  - Generic external-application use through discovery + `job`.
  - Sandboxed code re-run.
  - Visual matching with a confidence threshold (OpenCV or Pillow-based; choose by measured accuracy and size).
  - Recycle Bin/Trash deletion.
- **Files:** `office_worker.py`, `media_worker.py`, `scene_gl.py`, `verify_worker.py`, new `image` operations in the existing office or media worker (no new worker unless measured), `requirements.txt` (python-pptx, opentimelineio only if justified).
- **Acceptance:** E2 with ≥40 tasks; verifier checks per §12 complete; dependency licences recorded.
- **Tests:** real-file fixtures with hidden oracles; corrupted-input cases.
- **Risks:** installer size; measure before/after.
- **Proof:** E2 summary.
- **Next:** W6 and W7 (either order), then W8.

#### W6 — Windows 10/11
- **Objective:** deep, safe Windows control (§11).
- **Approach:** UIA patterns/events, AutoSetFocus policy, packaged-app discovery, `IsHungAppWindow`, DPI transforms, elevated-window refusal, cmd support, Windows 10 vs 11 differences.
- **Files:** `windows_worker.py`, `discovery.py`, `command_worker.py`, `tests/test_windows_ui.py`.
- **Acceptance:** UIA ladder + new cases green on `windows-2022` and `windows-2025`; consumer-only items UNTESTED with an RPC test written.
- **Risks:** runner differences from consumer editions.
- **Next:** W7.

#### W7 — macOS
- **Objective:** macOS parity (§11).
- **Approach:** AXObserver events; ScreenCaptureKit previews with Screen Recording detection (D16); Accessibility onboarding and revocation; zsh; Trash; `.app` bundle; Intel and Apple Silicon runners.
- **Files:** `mac_worker.py`, `discovery.py`, `packaging/*`, `tests/test_mac_ui.py`.
- **Acceptance:** MAC ladder + new cases green on `macos-15` (and `macos-15-intel` if available); permission-withheld paths tested.
- **Risks:** permission prompts on runners; signing is COM.
- **Next:** W8.

#### W8 — Browser and web
- **Approach:** installed-browser discovery (dedicated profile kept; no cookie or password extraction), tab listing and switching, file pickers, permission prompts, downloads, redirect-hop enforcement, structured tables, D11.
- **Acceptance:** E3 with ≥40 tasks across Linux, Windows and macOS runners (needs A1).
- **Next:** W9.

#### W9 — Install, dependencies, versioning, updates
- **Approach:**
  - Dependency manager (requirements 97–120): detect, propose exact package/source/version/hash/licence, confirm, install unelevated where possible (official UAC only), journal, verify, resume.
  - Version negotiation (44, 45).
  - Updater with integrity check, staging, rollback and no update mid-action (187–189).
  - Reproducible Windows and macOS builds; ARM64 decision recorded; licence inventory (182).
- **Acceptance:** upgrade and rollback between two built versions on both OSes; interrupted update recovers.
- **Next:** W10.

#### W10 — Customer product
- **Approach:**
  - All of requirements 146–160: onboarding, device states, progress, exact approvals, STOP/Take Over/Continue/Retry/Remove, deliverables, Library, Settings, Usage, admin.
  - Accessibility; responsive/PWA; voice within existing scope; Android only if already scoped; iOS browser only.
  - Minimal outcome-first UI (research C1–C12).
- **Acceptance:** website audit with every control exercised; first task completed end to end through the UI on staging.
- **Next:** W11.

#### W11 — Security, privacy, operations
- **Approach:**
  - Headers/CSP/CSRF, threat model, XSS/SQLi/SSRF/IDOR tests.
  - Secret canary, log redaction, crash reports and health, export/deletion.
  - Rate limits/backpressure, migration rollback strategy, legal/support drafts.
  - External MCP review procedure.
- **Acceptance:** zero open critical/high; security suites green.
- **Next:** W12.

#### W12 — Proof-based debloat
- **Approach:** `ToRemove.md` candidates with traced callers and parity tests; archive bulky evidence; measure installer size, startup and memory before and after.
- **Next:** W13.

#### W13 — Full cloud qualification
- **Approach:** §20 campaign including §20.3 creative; fix and rerun the affected categories.
- **Acceptance:** E4 ≥90% (target 95%) on ≥100 tasks over ≥3 days; R1–R9 PASS or BLOCKED only for consumer-hardware items; then request A2.

### 20. Testing and qualification

#### 20.1 Test tiers

| Tier | Where | When |
|---|---|---|
| Focused unit/contract | local container | every change |
| Real-worker integration (MCP, DB, browser) | local container | every change in that owner |
| Preflight CI (format, typecheck, focused security) | GitHub Linux | every push |
| Full matrix (Linux, Windows 2022/2025, macOS 15, installer) | GitHub | after preflight green |
| Live evaluation (real Gemini, paced) | agent container → staging; runners need A1 | E-checkpoints |
| Real-PC | owner-approved machines | RPC |

#### 20.2 Evaluation checkpoints

Every checkpoint uses fresh randomised tasks, hidden oracles, first attempt only and paced quota, and reports the denominator.

| Checkpoint | After | Tasks | Platforms |
|---|---|---|---|
| E1 | W4 | ≥40 | Linux |
| E2 | W5 | ≥40 | Linux |
| E3 | W8 | ≥40 | Linux + Windows/macOS runners (A1) |
| E4 | W13 | ≥100 over ≥3 days | Windows 2022/2025 + macOS runners (A1) |
| E5 | RPC | ≥30 per platform | Windows 10, Windows 11, macOS |

**Outcome states:** PASS only with a real effect and independent checks; PARTIAL; FAIL; BLOCKED; UNTESTED. Success = verified complete ÷ eligible attempted. The harness supplies only the objective, inputs and scopes and never creates deliverables.

**Categories:**
- Organise large file collections.
- Diagnose a program that fails to start.
- Detect and propose repairs for missing dependencies.
- Repair corrupted documents.
- Reconcile complex spreadsheets.
- Produce an editable financial report.
- Modify an existing presentation.
- Multi-tab browser work.
- Authorised online administrative workflows on test sites.
- Extraction across formats.
- Install approved software.
- PowerShell, CMD and zsh operations.
- Popups during long tasks.
- Crash recovery.
- Network loss.
- Changed window or document.
- Complex image editing.
- Editable video project.
- CAD/3D.
- Unknown and randomly named apps.
- STOP and Take Over.
- Permission revocation.
- Redirects.
- Wrong-window adversarial cases.
- DPI and multi-monitor (runner-limited; RPC).
- Install, update and rollback.
- Performance and resources.

#### 20.3 Advanced creative acceptance — 3D supercar and ~60 s advertisement

- **Instruction (given verbatim to OCADE):** "Create an original, premium futuristic supercar in Blender or another suitable available 3D application. Model a detailed exterior and realistic materials, prepare professional lighting and camera compositions, and create a cinematic advertisement approximately 60 seconds long. Include carefully designed camera movements, dramatic presentation, suitable transitions, high-quality rendering and appropriate audio. Deliver the editable 3D project, editable advertisement project, final rendered video, and a report proving that the required outputs were produced correctly."
- **Environment:** the test harness may pre-install Blender (GPL) on the disposable runner, as a customer might have it. OCADE must find it through generic discovery and drive it through its documented command-line/Python interface as `job`s, or choose another available route. Production code never names Blender.
- **Three separate verdicts:**
  1. **Technical validity:** files exist and parse; the video is 60 s ± 2 s, has the stated fps, codec and an audio stream, and contains no blank frames.
  2. **Editable structure:** the 3D project re-opens with named objects and materials, plus a glTF export; the advertisement timeline (.otio or the app's project) re-opens and references existing media.
  3. **Subjective cinematic quality:** human review at RPC only. Geometry quality is measured by object, vertex and material counts and silhouette coverage, not judged automatically as "professional".
- **Recovery test:** the render is interrupted mid-way; the agent must resume from existing frames without re-rendering them.
- **Free-runner limits:** CPU only and a 6-hour job limit; Cycles CPU works headless, while Eevee needs EGL/Mesa (unverified on runners). If the render cannot finish, record FAIL or BLOCKED with the measured frame time, and validate at RPC. Never use prebuilt outputs.

### 21. Release gates

| Gate | Condition |
|---|---|
| R1 | Repository baseline: integrity, contracts, no-hardcode, audits, reproducible builds |
| R2 | Gateway and device authority incl. journal and crash recovery |
| R3 | Installer, dependencies and updates on Windows and macOS |
| R4 | Computer and browser control (UIA, AX, browser) |
| R5 | ≥90% first attempt on E4 (95% ambition) |
| R6 | Independent verification and recovery |
| R7 | Customer product |
| R8 | Security, infrastructure, operations |
| R9 | Platform and performance (§15) |
| R10 | RPC passed; zero known critical defects; all 84 concepts PASS (optional-Linux items excluded explicitly) |

The milestones in `gates.json` map one-to-one to R1–R10.

### 22. Owner approvals (asked only when reached)

| ID | Approval | Why | When |
|---|---|---|---|
| A1 | Let live tasks run on Windows/macOS runners: (a) a protected Actions environment with staging server secrets used only by an isolated server step, or (b) a free staging deployment of the web worker. | Runners cannot reach the server inside the agent container. | Before E3 |
| A2 | Real-PC validation on Windows 10, Windows 11 and macOS with an exact test list, data, duration and STOP procedure. | Consumer-only behaviour. | After W13 |
| A3 | Close stale Dependabot PRs for the deleted `/jarvis-runtime`. | Hygiene. | W12 |

### 23. Commercial stage (deferred; nothing activated)

After RPC, in order:
1. Code signing (Authenticode; Apple Developer ID and notarisation — paid).
2. Staged release and rollback procedure.
3. Hosted backup/PITR and a restore drill.
4. Legal review.
5. Support and incident runbooks.
6. Pricing and payments.
7. Closed beta.
8. Competitor benchmark (259).
9. Deployment and `main` merge with explicit approval.

### 24. Codex operating rules and reporting

1. **Before a package:** read its §19 entry and its Appendix D rows only.
2. **Reproduce locally first** (TypeScript, Python, PostgreSQL, Chromium, Xvfb, ffmpeg). Push a red-only test only when the defect reproduces exclusively on Windows or macOS runners; the fix follows immediately.
3. **Local gate before push:** `npm run format:check`; `npm run typecheck`; focused suites; `npm run jarvis:protocol-check` when contracts change; `npm run jarvis:no-hardcoded`.
4. **CI:** preflight gates the full matrix. Do not push while a run for the previous commit is in flight unless that commit is known-bad. Documentation-only commits use `[skip ci]`.
5. **Failed attempt:** record hypothesis → result in Appendix D before trying again. Never retry an identical failing run. After two failed approaches, write the evidence and choose a different root-cause hypothesis.
6. **Evidence:** summaries ≤50 KB per checkpoint; raw logs stay in Actions artifacts.
7. **Report after each package:** package, SHA, run URL, tests run/passed/failed/skipped, measured speed and accuracy, status changes (IDs), defects opened/closed, blockers, next package.
8. **Never:** scheduled automations, new paid services, secrets in CI, hand-edited `protocol.json`, key rotation on 429, deleting or weakening tests.

### 25. Provenance mapping

| v3 package | v4 package |
|---|---|
| W0, W1, W2 | W0, W1, W2 |
| W3 (accuracy) | W4 |
| W4 (execution core) | W3 (capability surface) and W5 (deliverables) |
| W5 (Windows) | W6 |
| W6 (macOS) | W7 |
| W7 (browser) | W8 |
| W8 (install) | W9 |
| W9 (product) | W10 |
| W10 (security) | W11 |
| W11 (debloat) | W12 |
| W12 (qualification) | W13 |
| W13 (Linux) | W14 |

Older identifiers: P00 → W0; P01–P04 → W1; P05/P20 → W9; P06–P08 → W4 and W6/W7; P09–P10/P13–P14 → W1–W3; P11 → W8; P12 → W6/W7; P15–P16 → W2/W4; P17–P18 → W1/W5; P19 → W10; P21 → W12/W13; P22 → R10; G0–G12 → R1–R10. History: `evidence/2026-10-31-*`, `evidence/2026-11-01-*`, and plan text in git at `0e1bdcb` and `16654be`.

## Appendix A — The 266 requirements (verbatim) with status and destination

Format: `STATUS` · **destination** — original text. Status source: independent re-audit at `f04228d` (`evidence/2026-11-01-audit/requirements-266.md`, current-review column); it is the conservative lower bound. **S** = standing rule verified at every release gate. **RPC** = needs real-PC validation. **COM** = commercial phase. **W14** = optional Linux; never counted as PASS without evidence and never blocking Windows/macOS release.

Original preamble (1 November 2026): this owner checklist complements the 84 concepts; it does not authorise merging into main, production deployment, payments, certificate acquisition, spending, irreversible changes, or exposing secrets. Preconfigured staging credentials may be used for authorised staging tests with least privilege and strict non-disclosure.

#### OCADE — Complete Commercial Launch Readiness | Continuation Prompt

#### Rules and execution requirements

1. `PASS` · **S** — Continue directly from the current OCADE development session. Do not restart the project, repeat completed research unnecessarily, or create another architecture proposal without implementing the required changes.
2. `PASS` · **S** — Work exclusively on `ocade/p00-p22-implementation` in `BREVEX-CEO/caera-connect-plan`. Never merge into `main`, deploy to production, enable payments, spend money, or access my physical computer without my explicit approval.
3. `PARTIAL` · **W13** — Your objective is to make **OCADE BY CARCC** a genuinely functional, independently verified, public-ready commercial software product across every officially supported component and platform.
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
23. `PARTIAL` · **W4** — Preserve the configured model-routing policies and approved provider credentials. Validate actual model availability, quotas, limits, and failure behavior before making model changes.
24. `PASS` · **S** — Keep capability-based execution. No production code may depend on predefined customer applications, filenames, specific user tasks, demonstration journeys, or hardcoded results.
25. `PASS` · **S** — **Never hardcode files, answers, browser paths, application names, selectors, commands, expected output documents, or special-case workflows merely to make a test pass.**
26. `PASS` · **S** — Test fixtures may contain synthetic files and independent expected results, but production logic must solve unfamiliar inputs using general capabilities and observed state.
27. `PASS` · **S** — Do not replace genuine execution with fake receipts, simulated task completions, generated success messages, or pre-created deliverables.
28. `PARTIAL` · **W3** — Preserve the intended execution preference: native APIs and object models → supported scripts and CLI → native file/project operations → browser DOM/CDP → Playwright → OS accessibility → vision/coordinates when needed.
29. `PARTIAL` · **W3** — Choose the fastest reliable mechanism for each step based on actual capabilities, permissions, cost, observability, and failure risk.
30. `FAIL` · **W3** — Add automatic **mechanism fallback** where safe. If DOM interaction fails, inspect available alternatives rather than blindly repeating the same action.
31. `PARTIAL` · **W4** — Improve the supervisor so it maintains objective, target state, milestones, permissions, available capabilities, current observations, completed actions, unresolved uncertainty, and remaining work.
32. `PARTIAL` · **W1** — Store durable task state independently of Gemini's conversational context so interruptions and context truncation do not destroy progress.
33. `PARTIAL` · **W4** — Add a bounded receding-horizon planner: plan enough to act effectively, execute, observe the result, then replan only when necessary.
34. `PARTIAL` · **W4** — Separate **planning, action execution, result observation, and verification** into explicit interfaces and states.
35. `PARTIAL` · **W1** — Give every action a unique identifier, task identifier, target identity, permission context, deadline, and observable outcome.
36. `PARTIAL` · **W1** — Prevent duplicate side effects after retries, server restarts, timeout responses, disconnections, or acknowledgement failures.
37. `PARTIAL` · **W1** — Preserve receipts distinguishing **executed, verified, refused, failed, cancelled, and outcome unknown**. Never infer success from a dispatched command.
38. `PARTIAL` · **W1** — Improve persistent journaling, recovery checkpoints, durable action reconciliation, and crash-safe resumption.
39. `PARTIAL` · **W1** — Do not automatically repeat destructive or externally visible operations when the previous effect is uncertain.
40. `PARTIAL` · **W1** — Implement reliable ownership fences so STOP, Take Over, revocation, sign-out, device removal, and task cancellation prevent new unauthorized actions.
41. `PARTIAL` · **W1** — Ensure an in-flight operation either stops safely or reports honestly what may already have changed.
42. `PASS` · **S** — Keep the Gateway modular. Do not introduce one microservice per tool or turn the 84 architectural concepts into 84 separate services.
43. `PASS` · **W0** — Establish stable typed contracts between planner, task authority, Gateway, workers, verifier, and user interface.
44. `PARTIAL` · **W9** — Add version negotiation and compatibility checking between the website/backend, Device Agent, Gateway, and bundled workers.
45. `PARTIAL` · **W9** — Refuse incompatible components with actionable upgrade instructions rather than continuing unpredictably.

#### Gemini accuracy and grounding

46. `PARTIAL` · **W4** — Fix the demonstrated Python.org wrong-download failure generically. Gemini must distinguish the correct release row, release version, artifact type, platform, architecture, and actual download target.
47. `PASS` · **W4** — Do not fix that failure by hardcoding Python.org, the current version, a specific download address, page row, CSS selector, or table position.
48. `PARTIAL` · **W4** — Build or strengthen an evidence-grounded **Target Resolution Layer** that connects model-selected intent to an observed, unambiguous DOM element, accessibility element, file, process, or application window.
49. `PARTIAL` · **W4** — Assign temporary observation-scoped identities to discovered elements so the model can refer to concrete targets without inventing coordinates or selectors.
50. `PARTIAL` · **W4** — Preserve useful target metadata: label, role, accessible name, href, text, containing row, nearby headings, bounds, visibility, selected state, and originating observation.
51. `PARTIAL` · **W4** — When several elements have identical names such as “Download,” use their surrounding table row, version, platform, and related attributes to disambiguate.
52. `PARTIAL` · **W4** — Require fresh observations before sensitive actions. Reject stale element references when pages, windows, documents, or processes have changed.
53. `PASS` · **W4** — Prevent Gemini from navigating to unobserved deep URLs when the user's task requires following an authoritative source.
54. `PARTIAL` · **W4** — Distinguish verified facts from model memory and assumptions. Never report current external facts without an actual observation or valid trusted source.
55. `PARTIAL` · **W4** — When the source is a complex table, inspect structured rows and columns rather than relying only on a screenshot or an isolated link label.
56. `PARTIAL` · **W4** — When observations are incomplete, gather targeted additional evidence instead of guessing.
57. `PARTIAL` · **W4** — Prefer accessibility and structured browser information when reliable; use screenshots and visual interpretation where structure is unavailable or insufficient.
58. `UNTESTED` · **W6** — Implement coordinate transforms correctly across scrolling, zoom, DPI, display scaling, window movement, resizing, and multiple monitors.
59. `PARTIAL` · **W6** — Refuse ambiguous or wrong-window actions. Bind desktop actions to exact window identities and verify that the target is still valid immediately before execution.
60. `PARTIAL` · **W4** — Improve fallback from structured controls to visual grounding without creating repeated screenshot loops.
61. `FAIL` · **W5** — Implement image-based target matching where necessary, with confidence thresholds, stale-image detection, coordinate validation, and post-action observation.
62. `PARTIAL` · **W8** — Add adversarial tests for duplicate buttons, changing page layouts, dynamic tables, identical filenames, overlapping windows, dialogs, hidden controls, overlays, and redirected downloads.
63. `PARTIAL` · **W4** — Improve Gemini's ability to recover after clicking the wrong target, detecting the mistake before accepting or overwriting an incorrect result.
64. `PASS` · **S** — Do not solve model errors by adding an expanding library of special-case prompts for individual websites or applications.
65. `UNTESTED` · **W4** — Measure target selection accuracy independently by comparing the actual selected object against a hidden expected target.

#### Independent verification

66. `PARTIAL` · **W1** — Strengthen the independent verifier so completion depends on **real postconditions**, not Gemini's confidence or tool-call success.
67. `PARTIAL` · **W1** — Separate model-generated verification proposals from authoritative task acceptance rules and independently observed outcomes.
68. `PARTIAL` · **W1** — Fix verifier gaming: Gemini must never modify a customer's file simply to satisfy an incorrectly specified test.
69. `PARTIAL` · **W1** — Distinguish an invalid verification condition from defective customer work and require clarification or a trustworthy alternative check when necessary.
70. `PARTIAL` · **W5** — Verify file modifications using hashes, actual contents, parseability, expected semantics, and relevant application-level behavior.
71. `PARTIAL` · **W5** — Verify spreadsheets through formulas, recalculated values, ranges, output structure, and independent checks of expected financial or numerical results.
72. `PARTIAL` · **W5** — Verify Word/PDF deliverables through actual document structure, contents, page rendering where necessary, and preservation of requested formatting.
73. `PARTIAL` · **W5** — Verify images through real file properties, requested visible changes, render inspection, and appropriate perceptual checks rather than existence alone.
74. `PARTIAL` · **W5** — Verify videos through actual encoded output, duration, frames, audio, codec/container compatibility, requested edits, and playback checks.
75. `PARTIAL` · **W5** — Verify code repairs by running the relevant command, tests or application and observing the changed behavior.
76. `PARTIAL` · **W8** — Verify browser work by checking actual resulting page state, downloaded artifact, submitted data, or other independently observable effect.
77. `PARTIAL` · **W5** — Where full automatic verification is impossible, report what was proven, what remains uncertain, and what requires human review.
78. `PARTIAL` · **W11** — Record evidence references with each important action while protecting customer data and excluding secrets.
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
93. `PASS` · **W3** — Prefer native file operations and direct APIs over simulated clicking whenever equivalent verified results are possible.
94. `PARTIAL` · **W2** — Profile actual slow paths before optimizing. Benchmark every optimization against the previous implementation.
95. `PASS` · **S** — Never remove security checks or independent verification merely to make a benchmark faster.
96. `PARTIAL` · **W2** — Measure median, p95 and p99 latency, model calls per task, retries, token usage, resource consumption, and completed verified outcomes.

#### Dependencies and runtime management

97. `PARTIAL` · **W9** — Build a **generic Dependency Manager** that identifies capabilities and prerequisites missing from the customer's environment.
98. `PARTIAL` · **W9** — Keep OCADE's own required runtime, libraries, and browser automation components bundled wherever supported. Customers must not need Python or developer tooling merely to start OCADE.
99. `PARTIAL` · **W9** — Distinguish bundled application dependencies from additional dependencies needed for a particular customer-requested task.
100. `PARTIAL` · **W9** — Detect installed tools and versions using reliable platform mechanisms rather than assuming a package exists because one executable appears in PATH.
101. `PARTIAL` · **W9** — Support discovery of relevant runtimes and engines such as Python, Node.js, Java, .NET, FFmpeg, LibreOffice, browser engines, and native application dependencies when tasks require them.
102. `PASS` · **W9** — Do not bundle every possible programming language or framework unnecessarily. Download optional task-specific dependencies only when actually needed and authorized.
103. `PARTIAL` · **W9** — Inspect OS version, CPU architecture, package architecture, installation scope, existing versions, permissions, disk space, and network availability before proposing installation.
104. `UNTESTED` · **W9** — Support x64 and ARM64 where officially targeted. Treat x86 support as a deliberate compatibility decision with actual build/test evidence.
105. `PARTIAL` · **W9** — Prefer trusted platform package managers, verified vendor distributions, or controlled installation manifests when suitable.
106. `FAIL` · **W9** — Resolve required package version, operating-system support, architecture, integrity hash, authenticity, compatibility, and applicable licence before installation.
107. `PARTIAL` · **W9** — Never blindly run commands copied from unknown webpages or untrusted model outputs.
108. `PARTIAL` · **W9** — Show the exact package, source, version, destination, privileges, expected changes, and security implications before approval.
109. `PASS` · **W9** — Request administrator elevation only for an authorized operation that truly requires it. Keep normal OCADE operation unelevated.
110. `UNTESTED` · **W9** — Detect UAC denial, insufficient permissions, missing installation privileges, enterprise policy restrictions, and package-manager failures.
111. `FAIL` · **W9** — Detect missing DLLs, `.dylib` files, `.so` libraries, incompatible native modules, conflicting versions, missing VC++ runtimes, and broken runtime paths where relevant.
112. `PARTIAL` · **W9** — Diagnose missing executable paths, environment variables, file associations, registry entries, configuration files, and working directories.
113. `UNTESTED` · **W9** — Diagnose antivirus, SmartScreen, Gatekeeper, quarantine, and application-control restrictions without disabling or bypassing security protections.
114. `PARTIAL` · **W9** — Provide clear troubleshooting messages when an installation is blocked by legitimate security policies.
115. `FAIL` · **W9** — Make dependency installations resumable, bounded, journaled, and recoverable where the platform supports those guarantees.
116. `PARTIAL` · **W9** — After installation, verify the executable's actual version, architecture, startup behavior, and the exact capability the task requires.
117. `FAIL` · **W9** — Resume the original task automatically only after the dependency is independently verified and the authorization remains valid.
118. `PARTIAL` · **W9** — If installation fails, preserve the original task state, record the exact error, and offer safe recovery or manual administrator assistance.
119. `FAIL` · **W9** — Build real clean-machine tests for missing Python, Node.js, FFmpeg, Office engines, blocked installations, architecture mismatches, insufficient storage, restricted privileges, interrupted downloads, and incompatible versions.
120. `PARTIAL` · **W9** — Ensure installers and dependency workflows work without developer-specific paths, cached packages, local credentials, or preconfigured developer environments.

#### Windows customer readiness

121. `BLOCKED` · **RPC** — Validate the actual Windows installer on clean Windows 10 and Windows 11 consumer environments, not only Windows Server GitHub runners.
122. `PARTIAL` · **W6** — Test fresh installation, first launch, browser bundle, local Gateway startup, pairing, task execution, restart, upgrade, repair, and uninstall.
123. `PARTIAL` · **W6** — Verify all required DLLs, Python modules, Playwright binaries, runtime assets, and MCP workers exist in the distributed package.
124. `PARTIAL` · **W6** — Remove accidental dependencies on Git, Python, Node.js, PowerShell 7, compilers, SDKs, or developer PATH configuration unless explicitly required by a supported optional capability.
125. `PARTIAL` · **W6** — Preserve native Windows UIA, Win32 and COM compatibility with real installed applications and Windows security boundaries.
126. `PARTIAL` · **W6** — Test foreground control, user interference, wrong-window prevention, minimized windows, closed processes, elevated windows, and inaccessible UI controls.
127. `UNTESTED` · **W6** — Test DPI scaling, zoom, high-resolution displays, multiple monitors, different refresh rates, and window repositioning.
128. `UNTESTED` · **W6** — Test standard user accounts, UAC prompts, controlled-folder access, antivirus restrictions, OneDrive folders, Unicode paths, and long filenames.
129. `UNTESTED` · **W6** — Validate background operation after sleep, wake, lock/unlock, restart, network disconnection, sign-out, and device removal.
130. `PARTIAL` · **W6** — Verify that STOP and task cancellation terminate unauthorized subprocess trees and report incomplete effects correctly.

#### macOS and Linux readiness

131. `PARTIAL` · **W7** — Implement real macOS native accessibility support using appropriate platform APIs instead of claiming Windows control provides macOS coverage.
132. `PARTIAL` · **W7** — Support the macOS permission model, including Accessibility and other required user-granted permissions, with clear onboarding and revocation behavior.
133. `BLOCKED` · **RPC** — Validate supported Intel and Apple Silicon devices and actual native execution, packaging, and dependency availability.
134. `PARTIAL` · **W14** — Implement or verify Linux desktop control for explicitly supported X11 and Wayland configurations. Respect compositor and desktop security limitations.
135. `UNTESTED` · **W14** — Handle Linux desktop portals, user-session permissions, packaging differences, executable paths, shared libraries, and distribution compatibility.
136. `PASS` · **W3** — Provide platform-specific implementations behind shared capability contracts rather than contaminating the planner with OS-specific hardcoded journeys.
137. `PARTIAL` · **W3** — If an operation genuinely cannot work on a supported platform, detect the limitation before execution and report it accurately.
138. `PARTIAL` · **W13** — Do not mark any operating system fully supported until native installation, pairing, execution, STOP, recovery, and independent task verification pass on representative hardware.

#### Browser and application control

139. `FAIL` · **W8** — Dynamically discover the actual installed browsers and profiles. Do not assume Chrome, Edge, or a particular profile is available.
140. `PARTIAL` · **W8** — Bind automation to the authorized browser session, exact tab, origin, and target; never silently act in an unrelated session.
141. `PASS` · **W8** — Prefer DOM/CDP/Playwright structured operations where possible and use visual control only when required.
142. `PARTIAL` · **W8** — Detect navigation, popups, downloads, redirects, file pickers, permission prompts, authentication challenges, and dynamic content safely.
143. `PARTIAL` · **W8** — Respect anti-bot protections, authentication boundaries, website permissions, and security-sensitive user confirmations.
144. `PARTIAL` · **W8** — Ensure newly encountered applications can be operated through generic discoverable capabilities whenever their interfaces and permissions support it.
145. `PASS` · **W8** — Test unfamiliar and randomly named applications, files, websites and UI layouts to prove execution is genuinely capability-based.

#### Customer interface and product features

146. `PARTIAL` · **W10** — Audit and complete Landing, Authentication, Chat, JARVIS, Library, Devices, Apps & Websites, Settings, Usage, and Owner/Staff administration.
147. `PARTIAL` · **W10** — Inventory and test every button, menu, link, route, input, modal, file upload, download, permission dialog, and state transition.
148. `PARTIAL` · **W10** — Make first-use onboarding simple: install, sign in, pair device, grant the specific permissions needed, and complete the first authorized task.
149. `PARTIAL` · **W10** — Show accurate device states such as Ready, Offline, Permission Required, Busy, Disconnected, and Removed.
150. `PARTIAL` · **W10** — Provide live task progress with current action, completed steps, verified results, remaining work, and user intervention requests.
151. `PARTIAL` · **W10** — Display actual operation details in approval dialogs, not vague summaries supplied by Gemini.
152. `PARTIAL` · **W10** — Ensure STOP, Take Over, Continue, Retry, and Remove Device behave correctly and visibly.
153. `PARTIAL` · **W10** — Finish file delivery, download, preview, editing, and recovery flows for produced artifacts.
154. `PASS` · **W10** — Preserve separate behavior for online JARVIS and offline Chat; never silently substitute one for the other.
155. `UNTESTED` · **W10** — Complete supported voice, interruption, microphone permission, wake-state reporting, and accessibility features without misleading background-listening claims.
156. `PARTIAL` · **W10** — Validate responsive website and PWA behavior on major desktop and mobile browsers, including accessibility and session recovery.
157. `UNTESTED` · **W10** — Complete any already-scoped Android companion capabilities and tests only after core architecture and cloud gates pass. Do not create unrelated mobile apps.
158. `UNTESTED` · **W10** — Validate iOS browser/PWA behavior using supported hosted browser or simulator testing where available; do not invent native iOS functionality.
159. `PARTIAL` · **W10** — Optimize frontend performance, loading states, code splitting, accessibility, caching, image delivery, international text, reduced motion, and meaningful error feedback.
160. `PARTIAL` · **W10** — Eliminate dead controls, duplicate pages, obsolete branding, broken navigation, and unnecessary interface complexity.

#### Backend and infrastructure

161. `PARTIAL` · **W11** — Audit task authority, database RLS, authentication, privileged operations, staff/owner boundaries, device ownership, and audit logging end to end.
162. `PARTIAL` · **W11** — Test authorization against forged device identities, replayed requests, expired sessions, revoked keys, cross-account access, and duplicate action submission.
163. `PARTIAL` · **W11** — Verify migrations on disposable databases, including forward migration, rollback strategy, data integrity, and permission preservation.
164. `PARTIAL` · **W11** — Implement durable job processing, retry limits, idempotency, queue backpressure, and overload protection where missing.
165. `PARTIAL` · **W11** — Add server-side rate limits and resource budgets that protect availability without allowing a model to bypass task authority.
166. `PARTIAL` · **W4** — Improve provider error handling for timeouts, quota exhaustion, invalid responses, outages, and partial tool execution.
167. `PARTIAL` · **W11** — Prevent server credentials or service-role keys from reaching model-controlled commands, local workers, browser pages, test logs, or customer downloads.
168. `UNTESTED` · **W11** — Enforce TLS, secure headers, safe cookies, CSRF protection, input validation, and appropriate Content Security Policy.
169. `PARTIAL` · **W11** — Test for XSS, SQL injection, SSRF, path traversal, command injection, unsafe deserialization, insecure direct-object references, and privilege escalation.
170. `PARTIAL` · **W11** — Threat-model malicious websites, prompt injection in customer files, untrusted MCP tools, malicious downloads, compromised worker processes, and stolen device credentials.
171. `PARTIAL` · **W1** — Protect local file access through explicit grants, scope enforcement, race-safe writes, version checks, backup behavior, and non-destructive defaults.
172. `PARTIAL` · **W11** — Verify database backups through actual restoration drills. Test infrastructure recovery, incident handling, and user-visible service failure behavior.
173. `PASS` · **W11** — Profile real load and scale only as evidence requires. Avoid premature multi-region complexity or unnecessary infrastructure expenses.

#### Security, privacy, and operations

174. `PASS` · **S** — Preserve MFA and all established owner/staff safeguards. Never weaken security merely to make an automated test pass.
175. `PARTIAL` · **W11** — Keep customer content private and separate from other accounts, support systems, model traces, and unrelated customer sessions.
176. `PARTIAL` · **W11** — Make logs useful but redact passwords, authorization headers, tokens, API keys, sensitive file contents, and private data.
177. `PARTIAL` · **W11** — Add structured crash reports, health checks, latency metrics, failure classifications, and diagnostics with privacy-respecting controls.
178. `PASS` · **W11** — Implement a user-accessible diagnostic report that can explain connection, permission, runtime, dependency, Gateway, browser, and execution failures.
179. `UNTESTED` · **W11** — Ensure customer data export, account deletion, device revocation, and retention processes operate consistently with published privacy commitments and applicable requirements.
180. `PARTIAL` · **W11** — Prepare necessary non-payment legal and governance documentation, licence notices, privacy disclosures, Terms of Service, and installation guidance.
181. `FAIL` · **W11** — Add release notes, troubleshooting documentation, support procedures, incident response, service status communication, and recovery instructions.
182. `UNTESTED` · **W11** — Verify the commercial redistribution rights of bundled runtimes, dependencies, libraries, models, assets, and external components.
183. `PASS` · **S** — Keep all payment, checkout, billing, merchant-of-record, and subscription integration work outside this assignment.
184. `PASS` · **S** — Exclude code-signing certificate acquisition and certificate-signing work from this assignment. Do not compensate by bypassing OS or antivirus security protections.

#### Packaging, updates, and reliability

185. `PARTIAL` · **W9** — Build fully reproducible installers and release artifacts for supported platforms and architectures using declared, version-pinned dependencies.
186. `PARTIAL` · **W9** — Verify package integrity and every bundled worker's startup, not just successful compilation.
187. `PARTIAL` · **W9** — Support clean installation, upgrade, repair, restart, rollback, and uninstall without destroying customer documents or unrelated settings.
188. `FAIL` · **W9** — Implement a safe update mechanism with version compatibility, integrity checks, rollback, and recovery after interrupted updates.
189. `UNTESTED` · **W9** — Never let an update silently execute during a critical customer action or leave partially replaced executables running.
190. `PARTIAL` · **W9** — Test installation on clean VMs and physical machines without developer tools, cached browser binaries, or previously installed OCADE components.
191. `UNTESTED` · **W13** — Run long-duration stability tests to detect CPU spikes, memory leaks, orphaned workers, unreleased handles, output-pipe hangs, and excessive disk usage.
192. `UNTESTED` · **W13** — Test low-memory machines, slow storage, limited bandwidth, unstable Wi-Fi, limited permissions, and constrained user accounts.
193. `PARTIAL` · **W1** — Ensure network outages cause clear state transitions and safe task recovery rather than hidden success or uncontrolled retries.

#### Independent testing and evidence

194. `PARTIAL` · **W13** — Build a permanent, versioned test matrix covering every supported OS, CPU architecture, browser, DPI configuration, permission level, and installation scenario.
195. `PARTIAL` · **W13** — Include unit, protocol, integration, database, security, accessibility, browser, desktop UI, packaging, installer, performance, and disaster-recovery tests.
196. `PASS` · **W0** — Run existing CI suites and eliminate silently skipped essential tests. Required tests must fail the release gate when their prerequisites are unavailable.
197. `PARTIAL` · **W4** — Preserve synthetic test fixtures and hidden independent oracles, but never reveal expected customer-task answers to the production planner.
198. `PASS` · **W4** — Generate randomized test data, application names, filenames, layouts, input values, user instructions, and environmental conditions to detect hardcoding.
199. `PARTIAL` · **W4** — Include real Gemini-controlled E2E tests rather than only mocked or scripted model responses.
200. `PARTIAL` · **W13** — Test actual spreadsheet reconciliation, document creation, coding repairs, browser research, file manipulation, image operations, video operations, and general PC tasks through reusable capability interfaces.
201. `PARTIAL` · **W4** — Select representative tasks from real customer problems; never special-case the examples in production code.
202. `PARTIAL` · **W4** — Measure first-attempt success, recovery-assisted success, final verified success, intervention frequency, wrong-target incidents, time per task, and model calls.
203. `PASS` · **S** — Treat the historical 15/24 clean passes as an existing evidence checkpoint, not proof of a current success rate after subsequent fixes.
204. `PARTIAL` · **W4** — Create larger unseen evaluation sets with varying difficulty and fresh inputs. Prevent repeated retries on known fixtures from artificially raising reported success.
205. `FAIL` · **W13** — Require at least **90% independently verified real-task success** on the agreed representative launch suite, plus explicit platform-specific reliability gates.
206. `PARTIAL` · **S** — Require zero known critical security or safety defects, zero unauthorized actions, zero fabricated successes, and zero unresolved release-blocking failures.
207. `PARTIAL` · **W4** — Retest every previously observed bug, including wrong Python download, hallucinated versions, invented URLs, verifier gaming, repeated reads, and Python 3.12 subprocess hanging.
208. `PARTIAL` · **W13** — Repeat regression and integration tests under the actual runtime versions and binaries shipped to customers.
209. `PARTIAL` · **RPC** — Test Windows consumer desktops separately from Windows Server CI runners; test native macOS and supported Linux configurations separately.
210. `PARTIAL` · **W1** — Perform controlled crash, process-kill, network-loss, interrupted-update, permission-revocation, STOP, takeover, and retry-injection tests.
211. `PARTIAL` · **W5** — Verify output quality independently, including edits that appear valid but contain incorrect values, missing content, damaged formatting, or altered unrelated files.
212. `PARTIAL` · **W11** — Review security, privacy, package provenance, and failure recovery before any feature is declared launch-ready.
213. `PASS` · **S** — Do not delete tests to improve pass rates, reduce validation standards to force a green result, or mark blocked scenarios as passed.

#### Commercial launch readiness: verified 10% milestones

214. `PARTIAL` · **W0** — Implement a measurable **0–100% Commercial Launch Readiness Score**, divided into ten independently verifiable milestones, each worth 10 percentage points.
215. `PARTIAL` · **W0** — **10% — Repository and architecture baseline:** source integrity, contracts, test inventory, dependency audit, security invariants, and reproducible builds verified.
216. `PARTIAL` · **W1** — **20% — Core Gateway and device authority:** pairing, permissions, worker execution, journaling, STOP, takeover, and recovery independently verified.
217. `FAIL` · **W9** — **30% — Installer and dependency readiness:** bundled prerequisites, clean installation, dependency diagnosis, safe authorized repair, upgrade and uninstall tested.
218. `PARTIAL` · **W13** — **40% — Computer and browser control:** generic target discovery, accurate execution, wrong-target protection, browser handling, and supported OS adapters verified.
219. `FAIL` · **W4** — **50% — Gemini intelligence and grounding:** unfamiliar-task planning, correct target selection, observed-source reasoning, adaptive execution, and loop prevention verified.
220. `PARTIAL` · **W1** — **60% — Independent verification and recovery:** trustworthy completion checks, false-success prevention, file protection, checkpoint recovery, and negative/adversarial tests verified.
221. `PARTIAL` · **W10** — **70% — Customer-facing product:** required web pages, authentication, onboarding, Chat, JARVIS, Devices, Library, Settings, approvals, and deliverables verified.
222. `BLOCKED` · **W11** — **80% — Security, infrastructure, and operations:** authorization, privacy, secrets isolation, resilience, observability, backup restoration, support, and operational tests verified.
223. `BLOCKED` · **W13** — **90% — Platform and performance qualification:** all advertised OS/architecture configurations, installation and runtime compatibility, stress tests, and latency targets verified.
224. `BLOCKED` · **W13** — **100% — Final commercial release qualification:** unseen real-task acceptance, complete regression matrix, closed-beta validation, all mandatory gates, and zero known critical release blockers verified.
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
243. `PARTIAL` · **W12** — Remove dead code, duplicate abstractions, obsolete pathways, unused packages, redundant model prompts, unnecessary background workers, and outdated customer-facing branding only after verifying safe removal.
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
| 1 | **OD-AVGHHC — Outcome-Driven Adaptive Verifier-Gated Hierarchical Hybrid Control** | PARTIAL | W13 | One outcome state machine owns authorization, milestones, tool effects and completion; connect authenticated task authority to the model pilot, gateway, durable journal and independent verifier. | Trace one task across every boundary; reject unverified completion and unowned mutations. |
| 2 | **Architecture C — Unified Hybrid Control** | PARTIAL | W2 | Use one local-first hybrid execution spine, not a second planner or agent swarm; supervisor delegates only scoped tool calls to device-side generic executors. | A single trace links web request, server task, device lease, worker receipt and verifier. |
| 3 | **Five Primary Architectural Components** | PASS | S | Assign one owner each for supervisor, registry, process manager/MCP gateway, execution bridge and independent verifier; connect through versioned contracts. | No overlapping owners or duplicate executable paths; contract tests pass. |
| 4 | **Single-Dispatcher Architecture** | PASS | W1 | Serialize each resource mutation through one per-task dispatcher; distribute independent read-only work only when safe. | Concurrent actions against one document are ordered and auditable. |
| 5 | **Supervisor–Pilot / Actor–Critic Separation** | PASS | W1 | Gemini pilot proposes next typed action; supervisor enforces grants and retry budget; verifier critiques actual observed effects separately. | Replacing Gemini output with unsafe commands never bypasses policy. |
| 6 | **Hierarchical Control and Context Isolation** | PARTIAL | W4 | Retain outcome and milestone contexts above bounded tool-action contexts; expose minimal current schemas and observations. | Unrelated tool schemas and untrusted documents cannot leak into authority. |
| 7 | **Separation of State** | PASS | W1 | Keep desired goal, proposed intent, authorized dispatch, observed effects and verified outcome in separately owned records. | A worker's claimed success cannot update verified outcome directly. |
| 8 | **Outcome and Target-State Definition** | PARTIAL | W4 | Translate consented user intent to model-proposed, policy-reviewed checks; persist clear measurable postconditions before mutations. | Ambiguous or unverifiable checks return an explicit question or BLOCKED. |
| 9 | **Zero Hardcoded Application or Customer-Task Journeys** | PASS | W0 | Remove keyword-to-app workflows, fixed output names, canned procedural paths and demo scripts from runtime; allow vetted generic adapters. | Metamorphic tests with unseen apps, filenames and paraphrases reach the same dynamic routing mechanism. |
| 10 | **Capability-First Tool Selection** | PASS | W4 | Candidate tools derive from current executable capability descriptors and actual target availability, not app names. | Changing installed equivalent executors changes candidates without changing planner code. |

#### Adaptive intelligence, vector routing and discovery

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 11 | **Environment Discovery and Systemic Introspection** | PARTIAL | W6, W7 | Device reports OS, processes, windows, profiles, file associations, available APIs, drivers, hardware, permissions and target identity to registry. | Fresh discovery matches actual device conditions; unreported tools cannot execute. |
| 12 | **Dynamic Application and Interface Discovery** | PARTIAL | W6, W7 | Discover installed and active applications and their supported automation surfaces at runtime; avoid static app lists. | Unknown legitimate installed application appears when its supported control surface is discoverable. |
| 13 | **Dynamic Capability Registry and Typed Schemas** | PASS | W9 | Normalize reviewed tool manifests with IDs, version, input/output JSON schemas, supported effects, permission scope, target and health. | Malformed, duplicate, stale or permissionless manifests are excluded. |
| 14 | **MCP Toolbox Router** | PASS | W4 | Match model goal and current step to authorized healthy capabilities; shortlist, then Gemini makes final typed selection. | Candidate selection is dynamic and does not create an action plan. |
| 15 | **Semantic Token Gatekeeper** | PASS | W4 | Expose only bounded shortlisted tool definitions in a Gemini turn; maintain safety invariant for non-shortlisted operations. | Prompt length stays bounded and rejected tools cannot be invoked through fabricated names. |
| 16 | **Vectorized Domain Blueprints** | PARTIAL | W4 | Index general capability descriptions, schemas and quality criteria with versioned embeddings; retrieve guidance, never executable task templates. | A changed tool manifest invalidates embeddings; vector results carry no authority. |
| 17 | **Receding-Horizon Vector Selector** | PASS | W4 | Recompute tool candidates from latest observed state and unfinished outcome instead of emitting a fixed multi-step task. | Revised environment or a failure produces an updated candidate set. |
| 18 | **Macroscopic Planning for Unknown Task Horizons** | PARTIAL | W4 | Gemini sets adaptable milestone intent; supervisor limits turn duration and persisted costs/permissions. | A long job can checkpoint without assuming a fixed step count. |
| 19 | **Bounded Receding-Horizon Planning** | PASS | W4 | Allow one or a small safe batch of Gemini-selected operations; reobserve before each irreversible step. | Cycle detection, task budget and STOP all terminate unsafe nonprogress. |
| 20 | **Real-Time Observe–Act–Verify–Adapt Loop** | PARTIAL | W4 | After each effect, return structured receipt plus permitted screen/media evidence to supervisor and Gemini. | A deliberately failed action causes feedback or stop, never fake success. |
| 21 | **Dynamic State Pivot and Self-Correction** | PARTIAL | W1 | On user edits or worker error, refresh target identity and outcome delta before bounded repair. | No stale coordinates or old file versions are reused after takeover. |
| 22 | **Tool Namespace Isolation** | PASS | W0 | Use stable fully qualified names and immutable manifest IDs across gateway/registry/providers. | Two tools with same short name cannot cross-call. |
| 23 | **Large Tool Catalog Filtering** | PASS | W4 | Keep full trusted catalog server/device side and send only stage-relevant tool schemas to Gemini. | Adding 100 irrelevant tools does not overwhelm the next planning turn. |
| 24 | **Live Capability and Dependency Preflight** | PASS | W9 | Check executable, API support, auth, codecs, browser profile, worker startup, network, rights and grant before proposing execution. | Missing dependencies cause clear unavailable/blocked evidence before mutation. |

#### Universal execution and computer control

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 25 | **Native-First Execution Hierarchy** | PARTIAL | W3 | Dispatch fastest safe supported API/object model first; then bounded scripts, formats, DOM/CDP/Playwright, accessibility and vision last. | Fallback transitions include reason and independently recheck effect. |
| 26 | **Native OS and File-Format Operations** | PASS | W3 | Offer generic filesystem, document format, OS inspection and project-file operations through typed sandboxed tools. | File integrity and ownership preserved, paths constrained to scope. |
| 27 | **Scoped Script and Command Execution** | PASS | W3 | Use allowlisted or reviewed bounded commands with quotas and argument schemas, never unrestricted model-generated shell. | Injection, path traversal and forbidden executable requests fail closed. |
| 28 | **Windows UI Automation — pywinauto / UIA / Win32** | PARTIAL | W6 | Use live accessibility trees and exact PID/HWND/process-start identity for native controls, with optional lower-level Win32 only when justified. | Wrong-window, duplicate-title and focus-swap regression tests pass. |
| 29 | **macOS Accessibility — pyobjc / ApplicationServices** | BLOCKED | W7 | Provide a native AX bridge behind the same interface when macOS is a supported target; do not call Linux tests macOS proof. | OS-specific entitlement and real device tests gate macOS claims. |
| 30 | **Browser DOM / CDP / Playwright Automation** | PASS | W8 | Bind to the precise authorized browser, profile, tab and origin; prefer semantic DOM/ARIA and official APIs. | Unexpected navigation, lost tab and login challenges pause safely. |
| 31 | **Authenticated Browser Profile and Session Binding** | PARTIAL | W8 | Use permitted existing sessions without exporting passwords/cookies; revoke tool authority when profile identity changes. | Cross-profile execution and token extraction are rejected. |
| 32 | **Structured Accessibility-Tree Interaction** | PARTIAL | W6, W7 | Inspect semantic controls, roles, state and geometry freshly before invoking action; avoid stale element IDs. | Changed UI tree triggers rediscovery rather than blind click. |
| 33 | **Exact PID / HWND / Document / Tab Targeting** | PARTIAL | W6, W7, W8 | Store lease-bound account/device/process/window/file/tab identity and validate immediately before mutation. | Spoofed window title or stale PID cannot redirect operation. |
| 34 | **Window Resize, DPI and Multi-Monitor Resilience** | PARTIAL | W6 | Requery accessibility state, transforms and visual anchors after display changes; never presume persistent coordinates. | DPI/display movement trials do not select wrong target. |
| 35 | **Foreground, Background and Minimized-Window State Handling** | PARTIAL | W6, W7 | Differentiate API-capable background work from GUI operations requiring a visible foreground; restore only with consent. | No claim of universal hidden-window clicking or cursor-free execution. |
| 36 | **Visual Anchors / OpenCV as Last-Resort Fallback** | PARTIAL | W5 | Use bounded vision matching with confidence, fresh screenshots and explicit target checks only where semantic interfaces fail. | Low-confidence target, resize drift or unexpected overlay blocks effect. |
| 37 | **Dynamic Universal Application Fallback Hierarchy** | PARTIAL | W3 | Select execution mechanism by current capability quality, privacy, fidelity and target state, independent of application names. | A missing native path falls back safely without fixed app-specific script. |
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
| 45 | **Tool Discovery, Versioning and Health Checks** | PARTIAL | W9 | Cache trusted manifests by version/health TTL; verify package provenance and readiness before enabling a tool. | Revoked/crashed/updated tools disappear from offered candidates. |
| 46 | **Approved External MCP Provenance and Permissions** | PARTIAL | W11 | Treat third-party tool descriptions as untrusted; require policy, publisher verification, pinning and explicit scope. | Malicious MCP tool metadata cannot exfiltrate secrets or bypass consent. |
| 47 | **Lazy Worker Activation and Isolation** | PASS | W2 | Spawn vetted workers on demand with scoped environment, quotas, sandbox and resource locks; reap idle workers. | Dead process does not strand a task or leak child processes. |
| 48 | **IPC Latency and Throughput Measurement** | PARTIAL | W2 | Measure dispatch, queue, worker and serialization times; optimize bottlenecks empirically. | p50/p95 latencies and overhead captured for real runs. |
| 49 | **Deterministic Safe Multi-Action Batching** | PARTIAL | W4 | Batch only model-selected, preauthorized idempotent/reversible operations inside one identity/STOP lease. | Cancellation or partial batch returns per-effect receipts. |

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
| 58 | **Live User Interference Detection** | PARTIAL | W6, W7 | Detect human focus/file/tab edits and suspend conflicting UI operations without blocking independent safe work. | Take-over never overwrites newer user changes. |
| 59 | **Target Revalidation After State Changes** | PARTIAL | W6, W7 | Recheck live process/window/tab/file identity and lease epoch before every mutation and after recovery. | Old handles, URLs and document versions are refused. |
| 60 | **Bounded Retry and Cycle Detection** | PASS | W4 | Cap steps, token use, time and attempts; change strategy only with observed evidence. | Infinite/self-repeating tool cycles terminate as BLOCKED. |
| 61 | **Graceful Degradation and Honest Blocked States** | PASS | W1 | Offer compatible alternatives only if authorized and outcome-equivalent; otherwise report reason/action required. | No silently substituted offline model, paid tool or fake artifact. |
| 62 | **Least-Privilege Runtime Sandboxing / ACLs** | PARTIAL | W11 | Run worker per scoped user/task boundaries with network, path, process and operating-system permission constraints. | Escapes, untrusted downloads and privilege escalation fail closed. |
| 63 | **Scoped Authentication, Consent, OAuth and MFA** | PASS | W11 | Authenticate user and device independently; preserve account isolation, grants and official login/UAC/MFA challenges. | Cross-tenant, stale grant and forged scope tests fail closed. |
| 64 | **Secrets Vault and Credential Isolation** | PASS | W11 | Keep provider/service admin keys server side only; never expose to tool schemas, model turns, logs, client or child process. | Secret scans and prompt/worker injection tests show no credential leakage. |

#### Device runtime and customer experience

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 65 | **Signed Local Device Agent** | PARTIAL | W9 | Package outbound-authenticated companion; validate update signature, identity and task lease. | Untrusted binary or disconnected device cannot receive privileged action. |
| 66 | **Secure Device Pairing and Revocation** | PASS | W11 | Pair by authenticated account and device-held key; allow explicit revoke and immediate policy fencing. | Removed device cannot resume or accept a task. |
| 67 | **Persistent Authorized Capability Scopes** | PARTIAL | W11 | Persist least-privilege grants with purpose, target, epoch and expiry; reask only for new/sensitive scope. | Expired permission and cross-account reuse rejected. |
| 68 | **One-Installer Self-Contained Runtime** | PARTIAL | W9 | Ship signed OS-specific executable with bundled reviewed workers, libraries and startup diagnostics. | Clean-machine smoke test without developer Python/Node/Docker passes on each advertised OS. |
| 69 | **Scoped Local Workspace and Output Provenance** | PASS | W3 | Stage files under task workspace; preserve editable origins and source licenses where needed. | Every delivered artifact has verified path, owner and hash. |
| 70 | **Task Activity, Timing and Progress Telemetry** | PASS | W2 | Record monotonic timestamps for authorization, planning, queue, execution, render, verification and delivery. | Total elapsed and phase sums are explainable; no invented speed. |
| 71 | **Safe Output Delivery and Editable Artifacts** | PARTIAL | W10 | Return genuine completed files/links and editable project when requested and supported; expose partial evidence when blocked. | Download/readback verification and native-open test pass. |
| 72 | **Minimal Outcome-First User Experience** | PARTIAL | W10 | Expose natural-language goal, device/scope confirmation, calm status, STOP, activity and delivery, not infrastructure details. | UI reflects real receipts, errors and waiting states. |
| 73 | **Internal MCP Complexity Hidden from Customers** | PASS | W10 | Install and discover tool services inside signed companion; never require consumer MCP setup. | A fresh customer path contains no CLI/MCP configuration step. |

#### Independent verification, optimization and release

| # | Required concept | Status | Destination | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|---|---|
| 74 | **Closed-Loop Telemetry Verification** | PASS | W5 | Collect structured before/after state plus output and nonmodel measurements for each action. | An unobserved write cannot count as completed. |
| 75 | **Independent Professional Deliverable Verification** | PARTIAL | W5 | Verifier reads actual output via independent method and checks outcome-specific integrity/quality criteria. | An actor-authored PASS does not override verifier failure. |
| 76 | **Postcondition and Output-Integrity Checks** | PARTIAL | W5 | Validate file opens, dimensions, metadata, structural formula/geometry consistency, requested values and quality. | Corrupt, mislabeled or low-fidelity output is PARTIAL/FAIL. |
| 77 | **Evidence-Based Adaptive Recovery** | PASS | W4 | Feed verifier failures and observed artifacts back to Gemini for bounded correction without losing original state. | Each repair has new evidence, no blind repeated clicks. |
| 78 | **Real-World Latency and Resource Benchmarks** | PARTIAL | W2 | Track Gemini time, tool dispatch, native execution, rendering, queue, verifier and customer intervention. | p50/p95, actual wall time and measurable efficiency compared to baseline. |
| 79 | **Real Unprepared End-to-End Task Qualification** | PARTIAL | W13 | Use previously unseen genuine tasks only after the architecture gate; no prerecorded execution trace. | Actual model-driven output, process trace and independent result are present. |
| 80 | **Adversarial Security and Wrong-Target Tests** | PARTIAL | W13 | Exercise permissions, stolen/expired leases, duplicate effects, changed window/tab, user edits, crashes and prompt injection. | No critical unauthorized side effects across suite. |
| 81 | **Proof-Driven Debloating and Regression Protection** | PASS | W12 | Remove unused/duplicate/hardcoded paths with caller trace and parity tests, not line-count goals. | No lost supported operations or degraded STOP/security coverage. |
| 82 | **PASS / PARTIAL / FAIL / BLOCKED / UNTESTED Evidence States** | PASS | W0 | Maintain per-concept SHA/environment/test IDs and reason; distinguish mocks from live tests. | No unknown/unproven component marked PASS. |
| 83 | **Measured Task Success and User-Intervention Metrics** | PARTIAL | W4 | Evaluate independently verified task success and count prompts, approvals, retries, time and user actions. | ≥90% benchmark gate only with published denominator and eligible coverage. |
| 84 | **Zero Known Critical Safety-Defect Release Gate** | FAIL | W13 | Require zero known critical/high-severity release blockers and green mandatory architecture tests. | Any proven credential leak, wrong-target mutation or unsafe retry vetoes task acceptance and release. |

## Appendix C — Research references evaluated (236 ideas)

Sources: `docs/research/OCADE_complete_heading_and_concept_index.md` (A = 143 source headings, B = 30 named components, C = 63 later concepts) and `docs/research/UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md` (U-sections). These are proposals, not evidence. Decisions: KEEP, IMPROVE, REPLACE, ADD, REJECT, ALREADY (already implemented, status per the mapped concept). Status of each idea equals the status of its destination concept or requirement; REJECT items have no runtime work.

| IDs | Idea | Decision | Destination |
|---|---|---|---|
| A1, A3, A5, A40, B6, B7, B8, B9; U§9 (DaVinci native MCP) | Application-specific native bridges and creative plugins | REPLACE with generic discovered mechanisms: confirmed command-line/scripting interfaces, file formats, pinned approved external MCP servers. No app-name branches. | W3, concept 46 |
| A2, A4, A15, A26–A29, A35–A39, A62, A65, B2, B3, B4, B14–B17; U§6, U§12 | Core engines: scoped scripts, filesystem, browser DOM, Windows UIA, macOS AX | ALREADY (fs/office, shell, web, ui_bridge workers) | W3, W6–W8, concepts 26, 27, 28, 29, 30, 41 |
| B1 (Open Interpreter) | Local code-execution MCP | REPLACE by the existing confirmed, contained `shell.run` | W3 |
| B5 (Peekaboo) | macOS accessibility MCP | REPLACE by the existing `mac_worker` | W7, concept 29 |
| A6 | Office and document automation | ALREADY (office worker); deepen verification | W5 |
| A7, B10, B11, B12 | CRM and cloud-office API connectors | REJECT for launch (OAuth connector scope); use authorised browser sessions | W8; revisit in COM |
| B13 (TinyFish) | External web-context service | REJECT (external paid dependency, not needed) | — |
| A8 | Speed versus universality comparison | KEEP as the native-first order | W3, concept 25 |
| A9, A89, A101, A127, B28 | Single dispatcher; gateway over autonomous agents; five components | ALREADY | concepts 3, 4 |
| A10 | Multi-agent swarms for context isolation | REJECT swarms; KEEP context isolation through the per-turn shortlist | concepts 6, 15 |
| A11, A42 | Namespaced tool names | ALREADY | concept 22 |
| A12, A90, B20 | Locks, semaphores, task IDs, idempotency | ALREADY (IDs, idempotency); IMPROVE locks | W1, W2, concepts 50–52 |
| A13 | Sandboxing and graceful degradation | ALREADY | concepts 38, 61 |
| A14, A68, A112, A113, A126, A130 | Architecture C and its claimed superiority | ALREADY (architecture); REJECT superiority claims until benchmarked | concepts 1, 2; requirement 259 |
| A16–A19, A31, A78 | Discovery before acting; native translation; validation and self-healing | ALREADY (discovery, `system.inspect`); IMPROVE packaged-app discovery | W6, W7, W9, concepts 11, 12, 24 |
| A20 | Separation of state | ALREADY | concept 7 |
| A21 | Control without hardcoded application lists | ALREADY (guard) | concept 9 |
| A22, A30, A32, B23; U§2, U§7 | Professional quality via domain blueprints (vector DB, local creative-director LLM) | IMPROVE: short generic domain guidance in the planner prompt and professional verifier checks; REJECT local LLM and vector DB | W4, W5, concepts 16, 75 |
| A23, A34, A41, A43, A91, B18; U§3, U§8 | Toolbox router, semantic gatekeeper, embedding router prototype | ALREADY (TF-IDF shortlist); ADD embeddings only if measured recall <98% | W4, concepts 14, 15, 17, 23 |
| A24, A60, A66, A82, A83, B19; U§4 | stdio “zero latency” | ALREADY (stdio workers); REJECT the zero-latency claim — model and wake time dominate | W2, concepts 42, 43 |
| A84, A141; U§4 (dual local models) | Local model for speed or cost | REJECT (owner O3; online-only planner) | — |
| A85, A117, B22 | Deterministic multi-action batching | IMPROVE: read batching, composite primitives and guarded step lists (read/reversible steps only, each with a local `expect` guard; adopted only if E1 shows no accuracy loss) | W4 (guarded step lists), concept 49 |
| A86 | Background resource management | ADD measurement and limits | W2, W13, concept 78 |
| A25, A58, A71; U§5 | “Immutable” automation IDs and hidden-window control | REJECT the claims; KEEP structural targeting with revalidation and truthful minimized/hidden handling | W6, W7, concepts 33, 35, 59 |
| A33, A59; U§11 (infinite loop) | Zero-error self-correction, infinite optimisation | REJECT infinite retries; KEEP bounded repair | concepts 60, 77 |
| A44, A72 | Closed-loop telemetry verification (read-back) | ALREADY | concept 74 |
| A45, A46, A51, A52; U§10 | Plain-language explanations and overclaims | REJECT as requirements (explanatory only) | — |
| A49, A55, A74, A102, A138, A139, A140, B30 | Lines-of-code estimates | REJECT as planning inputs (not measured) | — |
| A50, A56 | Competitive strategy (context filtering, packaged runtime, verification) | KEEP as hypotheses to benchmark | COM, requirement 259 |
| A48, A54 | MCP versus native APIs/UIA | KEEP: MCP is the transport; APIs/UIA do the work | concept 41 |
| A53, A47 | Core backbone versus parts | ALREADY | concepts 41–43 |
| A57, A61, A69, A115, A116, A136, B21, B27; U§12, U§13 | Receding-horizon actor–critic sense–act–verify loop | ALREADY (bounded loop); REJECT the sub-5 ms cycle claim | W4, concepts 5, 17, 19, 20 |
| A63, A64, A67 | pywinauto and pyobjc stack, sample controller code | ALREADY (stack); REJECT sample code (illustrative, unsafe) | concepts 28, 29 |
| A70, A73; U§13 | Live user interference and state pivot | IMPROVE (detect, pause, rebind, never overwrite user edits) | W6, W7, concepts 21, 58 |
| A75, A76, A131 | UIA limitations; where the architecture loses | KEEP as documented limits and refusal cases | W6, W7 |
| A77 | Window visibility states | ALREADY (partial) | concept 35 |
| A79 | Maximum professional depth | IMPROVE through generic scripting/COM/object models | W5, W6 |
| A80, B26 | Visual anchors / OpenCV last resort | ADD with confidence threshold and post-action check | W5, concept 36 |
| A81 | Real latency benchmarks | ADD (§5.1 targets) | W2, concept 78 |
| A87, A88, A92, A132, A133, A134 | MCP lifecycle, minimal toolbox, instability handling | ALREADY; IMPROVE health/versioning | W9, concepts 39–45 |
| A93, A94, A95 | Outcome-driven supervision with milestones | IMPROVE (milestones in durable task state) | W4, concept 18 |
| A96 | Failed action versus lost confirmation | IMPROVE (unknown-effect resolution) | W1, concept 55 |
| A97 | Professional deliverable verification | IMPROVE | W5, concept 75 |
| A98 | Safeguards for self-healing | ALREADY | concepts 60, 62 |
| A99, A100 | Repeated “backend rebuild” labels | REJECT (duplicate labels) | — |
| A103 | Build versus buy | KEEP (reuse SDKs, Playwright, pywinauto, pyobjc) | — |
| A104 | Front-end/back-end contract | ALREADY (one generated protocol) | concept 44 |
| A105 | Simplification and objective metrics | KEEP | W2, W12 |
| A106, A107, B24 | Runtime sandboxing, ACLs, AppContainer, Job Objects | IMPROVE (Job Objects already used for shell; evaluate least-privilege options) | W11, concept 62 |
| A108 | STOP, pause, resume | ALREADY | concept 57 |
| A109 | Absolute window and target context | ALREADY (partial) | concept 33 |
| A110, A111, A129 | Launch test-suite design | KEEP | W13 |
| A114 | Retractions of earlier overclaims | KEEP | — |
| A118–A125, B29 | Seven production scenarios (video, photo, chess/canvas, finance, CAD, cross-app, interruptions) | KEEP as qualification categories | W13 §20 |
| A128, A142 | Maintenance efficiency, code reduction | KEEP | W12, concept 81 |
| A135, A137 | Fallback hierarchy, resilient fault handling | IMPROVE (runtime mechanism fallback) | W3, concepts 37, 56, 77 |
| A143 | Unfinished final heading | REJECT (no content) | — |
| B25 | Browser profile, OAuth, MFA surfaces | KEEP limits: no secret extraction, person completes challenges | W8, concepts 31, 63 |
| C1–C10 | Minimal outcome-first UI (centred prompt, collapse on send, one status line, hidden internals, expandable activity, small history, final files, monochrome, small STOP) | KEEP | W10, concept 72 |
| C11 | Task-adaptive deliverables | KEEP | W5, W10, concept 71 |
| C12 | Reversible defaults instead of repeated confirmations | IMPROVE (A8) | W4 |
| C13, C15 | One installer; same-account device discovery and pairing | IMPROVE without granting control by login alone | W9, W10 |
| C14 | Signed device agent | ALREADY (request signatures); binary signing is COM | concept 65 |
| C16 | Persistent capability scopes | IMPROVE (purpose and expiry) | W11, concept 67 |
| C17 | Official Windows elevation only | KEEP | W9 |
| C18, C23 | Protected payment/secret boundaries; explicit-recipient sends | ALREADY (external-effect confirmation) | W1 |
| C19 | Google-first product sign-in | KEEP (existing sign-in surface) | W10 |
| C20, C21, C22 | Existing browser session, reauthentication, MFA/CAPTCHA by the person | KEEP limits | W8 |
| C24 | Recoverable deletion to Recycle Bin/Trash | ADD | W3 (typed `trash`) |
| C25 | Secrets vault and token isolation | ALREADY | concept 64 |
| C26, C46 | Full Windows app catalog incl. packaged apps | IMPROVE | W6, concept 12 |
| C27, C41 | No hardcoded journeys; capability-first choice | ALREADY | concepts 9, 10 |
| C28, C48 | Exact PID/HWND/document binding; wrong-window lessons | ALREADY (leases) | concept 33 |
| C29 | Resize, DPI, multi-monitor | IMPROVE | W6, W7, concept 34 |
| C30 | Truthful minimized/hidden handling | ALREADY (partial) | concept 35 |
| C31 | Take-over and conflict handling | IMPROVE | W6, W7, concept 58 |
| C32 | Native-first order | ALREADY (partial) | concept 25 |
| C33 | Browser DOM and authorised network calls | ALREADY | concept 30 |
| C34 | Bounded workspace with provenance | ALREADY | concepts 38, 69 |
| C35 | Resource-aware scheduler | IMPROVE later (one task per device today) | W2, concept 51 |
| C36, C37, C38 | Journal, checkpoints, local STOP | ALREADY | concepts 53, 56, 57 |
| C39 | Bounded receding-horizon planner | ALREADY | concept 19 |
| C40 | Independent professional verifier | IMPROVE | W5, concept 75 |
| C42 | Untrusted MCP provenance restrictions | ALREADY (pinning) | concept 46 |
| C43 | Policy-bound self-install of approved components | ADD | W9 |
| C44 | No forced local model fallback | ALREADY | standing |
| C45, C47 | Pairing/runtime checks; correct OS command context | ALREADY (`diagnose`, `system.inspect`) | W9 |
| C49, C50 | Historical QA results; retired engine | KEEP as history | — |
| C51, C52, C56, C58, C59, C62 | Evidence classes, cloud-first, no fake deliverables, code ≠ verified, owner GitHub policy, gradual coverage | KEEP as standing rules | S |
| C53, C54 | Representative benchmark; 90% target with 95%+ ambition | KEEP | W4, W13, R5 |
| C55 | Zero known critical safety defects | KEEP | R10, concept 84 |
| C57 | Proof-driven debloating | KEEP | W12 |
| C60 | MCP invisible to customers | ALREADY | concept 73 |
| C61 | First vertical slice through the product surface | ALREADY (partial: staging slice to first device step) | W10 |
| C63 | User effort as a formal metric | ADD | W4, concept 83 |

## Appendix D — Defect register (single live list)

Severity: CRITICAL = unauthorised action, data loss, secret exposure or wrong-target mutation; HIGH = release-blocking correctness, safety or product failure; MEDIUM; LOW. Sources: run logs and `evidence/2026-11-01-audit/codex-continuation.md`. Record hypothesis → result here so no defect is investigated twice.

| ID | Severity | Defect | Evidence | Status | Package |
|---|---|---|---|---|---|
| D1 | HIGH | Branch head red: planner safety, media nested-source containment, gateway result boundary, actor bound-host prevention, rendered-verifier/URL transport, formatting and DB revocation steps fail | [run 70](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41434622666), `f04228d` | OPEN | W0 |
| D2 | HIGH | Anonymous web verification: hidden page content passes; private/off-origin observations accepted; same URL fetched 13 times | run 68 (`82098c2`), seven-method negative suite | OPEN (repair in progress) | W1 |
| D3 | HIGH | Dispatch after browser permission was revoked while the claim was held | run 69 (`61b29b1`); migration `20261102061041_enforce_verifier_target_permissions.sql` drafted | OPEN | W1 |
| D4 | HIGH (risk) | SSRF, DNS-rebinding and redirect-hop enforcement for verifier fetch and actor browser not reviewed | source review; route-only interception may not block redirect hops | OPEN, UNVERIFIED | W1, W11 |
| D5 | HIGH | Unknown effects only fence the task; no resolution flow for the person | concept 55; run 57/58 | OPEN | W1 |
| D6 | HIGH | Outcome checks are compiled before anything is observed and are not bound to the request; the model then bends files to match its own guess (3 of 9 eval failures); no guard against edits to unrelated or input files | seeds 11–14 READMEs; requirement 68 | OPEN | W1 |
| D7 | MEDIUM | Original-file compare-and-replace and directory-identity concurrency window | codex-continuation (run 53 scope note) | OPEN | W1 |
| D8 | HIGH | Device pickup backs off to 30 s; ~34% of live task time unaccounted | `agent.py` claim loop; eval timing | OPEN | W2 |
| D9 | HIGH | First-attempt real-task success 75% (< 90%): invented facts, dense-table row choice (r1c), checks bent to guesses | `evidence/2026-11-01-eval-s11` … `s14` | OPEN | W4 |
| D10 | HIGH | Planner “busy” after ~30–60 calls on the shared free project | `evidence/2026-11-01-eval-s14/README.md` | OPEN | W4 (pacing) |
| D11 | MEDIUM | Windows web ladder `KeyError 'page'` once; cause unknown | 1 November Windows run | OPEN | W8 |
| D12 | MEDIUM | CRLF script executable flag fix not verified live | eval s11 `crlf_script` | OPEN | W3 |
| D13 | MEDIUM | Windows `WinError 32` on fixture profile cleanup; lock owner never identified (quiescence wait added, run 64 green) | run 63 | MITIGATED | W9 |
| D14 | LOW | Ledgers disagree: concept 29 recorded BLOCKED although MAC-001…012 pass (run 45); five status files | `scripts/jarvis-traceability.mjs` entry 29 | OPEN | W0 |
| D15 | LOW | Stale Dependabot PRs target deleted `/jarvis-runtime` | open PRs #88, #90 | OPEN (needs A3) | W12 |
| D16 | HIGH (risk) | macOS window previews need Screen Recording permission on consumer Macs; CI runner is pre-authorised, so this path is unverified | `mac_worker.py` preview; Apple privacy model | OPEN, UNVERIFIED | W7 |
| D17 | HIGH | No typed copy/move/rename/mkdir/trash/set-attributes operations; file management and the executable bit go through confirmed `shell.run` (4 of 9 eval failures) | `src/lib/jarvis/contracts.ts` (35 operations); `crlf_script` in s11–s14 | OPEN | W3 |
| D18 | HIGH | `shell.run` capped at 600 s and no tracked long-running job: long renders, exports and installs cannot complete or resume | `contracts.ts` `timeoutSeconds` max 600 | OPEN | W3 |
| D19 | MEDIUM | Documents and workbooks cannot be edited in place; presentations and image editing unsupported; video has no open editable timeline; 3D has no open interchange export | `contracts.ts`; `office_worker.py`, `media_worker.py`, `scene_gl.py` | OPEN | W5 |
| D20 | LOW | Windows shell is PowerShell only; macOS uses `sh` only | `command_worker.py` | OPEN | W3 |

Closed recently (kept for history): approval arguments clipped at 4000 characters (fixed `43c50ed`, run 64); opaque native/page interactions mislabelled reversible (fixed `43c50ed`); unknown-write replay after resume (fenced `83f3142`, run 58); competing-file overwrite on publication (fixed `897675b`, run 49); installed companion started no worker (fixed `947ceee`); minimized macOS window reported as closed (fixed `a7cf182`).
