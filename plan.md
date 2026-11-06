# OCADE — Master Engineering Plan (v5)

> **The single authority for OCADE engineering.** Version 6 (coding-first, owner decision O13, 5 November 2026), first issued as version 5 on 2 November 2026, branch `ocade/p00-p22-implementation`. It is the one place for scope, rules, architecture, order, status and acceptance. `AGENTS.md` and `CLAUDE.md` point here at session start. `docs/research/*` hold supporting research, while `docs/DECISIONS.md` and dated `evidence/` folders are history. None of these compete with this file. `phases.md` does not exist.

| Level | Read when | Sections |
|---|---|---|
| 1 Quick start | Every session (≈2 minutes) | §0–§3 |
| 2 Permanent Engineering Operating Contract | Every session; it binds all work | §4–§11 |
| 3 Frozen architecture | Before touching a component | §12–§14 |
| 4 Execution roadmap | To pick the next coding batch | §15–§16 |
| 5 Verification and release | Coding gate (§17) every batch; the rest at the qualification stage, after coding and debloat | §17–§20 |
| 6 Decision record | Only when a package refers to it, or when challenging a decision | §22–§25, §27 |
| 7 Traceability (lookup data) | When updating status | Appendices A–E |

---

# LEVEL 1 — QUICK START

## 0. Start every session here

1. `git fetch origin ocade/p00-p22-implementation`. Make sure the working tree is clean or holds only your own unfinished work. Read §3 (status) and §15 (package board).
2. **Coding comes first (O13).** Your task is the next **coding batch** in §7: a coherent group of requirement IDs whose code is not yet complete (Appendix E). Pick by code dependency only. An unfinished work package, a red unrelated CI job, a missing benchmark, an evaluation campaign, a cloud-computer workflow or real-PC access never blocks writing missing code.
3. Read the batch's §16 entries, its Appendix D rows and the files it names. Do not read anything else unless the batch refers to it.
4. Work through the §7 coding loop until every requirement in the batch is CODED and BUILDS. Then update Appendix E **once, in the batch commit**.
5. If one item is genuinely blocked, record why in Appendix D and Appendix E, and continue immediately with the next independent batch. Never stop the session because another feature is incomplete.

**Stage order (O13):** C0 coding audit → C1… coding batches until every coding requirement is CODED → integration and compilation fixes → W12 deep debloat and consolidation → final compilation and full GitHub Actions qualification (W13) → owner-directed AI-model comparison and real-PC testing (RPC).

**Current next action: batch C0 (§7): classify every requirement in Appendix E, make every push run only the coding gate (§17), then start batch C1.**

## 1. What OCADE is

OCADE BY CARCC is an autonomous computer-control agent.
- **The customer** describes a desired result once.
- **OCADE** understands the objective, discovers what the authorised device can do, plans efficiently and operates authorised software on the customer's **own** Windows or macOS computer. It resolves recoverable errors, verifies the output independently and delivers usable, editable work.
- **Intelligence** comes from the authorised online Gemini service. **Execution** stays on the customer's device.
- It uses native OS capabilities, PowerShell/CMD/zsh, Windows UI Automation, macOS Accessibility, browser automation, file and application interfaces, and persistent MCP/STDIO workers. Adaptive decisions come from RTAA (§13) and perception and execution from RTVC (§13), under one task authority, with independent verification and safe recovery.
- It is not a chatbot, a cloud desktop, a set of demos, or a product that needs technical setup.

**Engineering priorities, in order:** correct completion · safety · fast response · accuracy · reliable recovery · capability-based universality · professional editable output · simple customer experience · efficient resource use · maintainability.

**Product success:**
- ≥90% independently verified first-attempt success on a representative hidden-answer suite, with 95%+ as the ambition.
- Zero known critical safety defects.
- No fabricated results.
- The speed targets in §18 are met.
- Windows 10, Windows 11 and macOS are qualified on real hardware after cloud qualification.

## 2. Fixed owner decisions (change only by explicit owner instruction)

| # | Decision |
|---|---|
| O1 | Windows 10, Windows 11 and macOS are mandatory. Linux is optional and never blocks release. |
| O2 | Use the existing authorised Gemini model (`gemini-3.5-flash-lite`, `src/lib/intelligence/online-models.ts`) and free capacity. No paid model as a default solution. |
| O3 | No paid infrastructure, purchases or unapproved spending. |
| O4 | One coding agent. No parallel coding sub-agents. |
| O5 | Cloud-first. Finish coding and the available cloud qualification before asking for real-PC testing. Never use the owner's physical computer without separate approval. |
| O6 | Commercial activity comes after engineering completion and authorised real-device qualification. |
| O7 | Keep all 266 requirements and 84 concepts, and trace every research concept (Appendices A–C). |
| O8 | No hardcoded applications, customer journeys, selectors, files or answers. |
| O9 | One task authority with explicit permissions, plus genuine STOP and Take Over. |
| O10 | Never fabricate tests, benchmarks or completed work. |
| O11 | No `main` merge, deployment, payment activation, secret changes, credential exposure or weakened security. |
| O12 | Free, non-deploying GitHub Actions on this branch are approved. CI stays secrets-free and never contacts production. No scheduled automations. |
| O13 | **Coding first** (owner, 5 November 2026). Finish 100% of the approved coding requirements before comprehensive qualification. During coding, only the lightweight coding gate (§17) applies. Live AI tests, E1–E3 campaigns, benchmark scores, full CI matrices, cloud-computer workflows and real-PC tests never block writing code; they run at the qualification stage, where every original acceptance criterion still applies in full. No coding deadline and no benchmark threshold apply to the coding stage. |
| O14 | Keep the existing working model integration (O2) unchanged until the owner authorises a replacement. The owner will supply the tasks that compare Gemini 3.8 Live Extended Thinking, Gemma 4 31B and Gemini 3.5 Flash-Lite after coding is complete. Do not run model benchmarks before then. |

## 3. Status (update in the same commit as new evidence)

Separate measurements. Never merge them into one percentage.

| Metric | Value (5 Nov 2026) | Source |
|---|---|---|
| Coding status | Not yet audited. Batch C0 classifies every requirement in Appendix E (NOT CODED, CODED, BUILDS, RUNTIME VERIFIED, or qualification-only). | Appendix E |
| Requirements PASS (runtime verified) | **77/266** (28.9%). Unfinished: 189 (154 PARTIAL, 12 FAIL, 5 BLOCKED, 18 UNTESTED) | Appendix A |
| Architecture concepts PASS | **44/84** (52.4%). Unfinished: 40 (39 PARTIAL, 1 FAIL) | Appendix B, `npm run jarvis:traceability` |
| Research ideas with a disposition | 236/236 | Appendix C |
| Commercial readiness | **10/100** (1/10 milestones, 17/42 conditions); M2 withdrawn for D22; M6 postconditions also retracted for D25 (`evidence/2026-11-05-local-stop/`) | `npm run readiness`, `evidence/readiness/gates.json`, `evidence/2026-11-02-recovery/` |
| Cloud tests | Full green candidate matrix: [run 99](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41848478811), tested `2d98e0d` (checkout SHA independently confirmed; dispatch metadata head is `3b39e36`). All 8 jobs pass, including 162 companion tests per OS with only allowed skips. Run 96 Windows failures fixed. Run 109 at `00cbd9e`: seven jobs passed, macOS host never acquired. Explicit free Windows 2022/2025 and macOS 15 ARM/Intel matrix registered (`fce7a5b`); Intel host acquired but stale LibreOffice metadata returned HTTP 404; Homebrew refresh registered at `a91c30f`. Run 41970810529 now reaches Intel tests: 9/10 jobs pass, but a saved scene image is flat despite reported verification (D28); an unpublished diagnostic run also exposed intermittent popup classification D29; no candidate code or completion evidence is adopted. Fixed Intel media archives pass actual version/hash/architecture probes; full green qualification remains pending (`evidence/2026-11-05-intel-media/`). Expanded qualification pending (`evidence/2026-11-04-platform-runners/`) | `evidence/2026-11-04-cloud-recovery/run-99.json` |
| Real-task success (real Gemini) | **27/48 (56.25%)** completed plus hidden oracle in full E1 at `00cbd9e`, seeds 22–24, Linux Actions, run 41859445291; original oracle-only 35/48, completed 31/48, gaming 0, target choices 0 (unmeasured). Historical 27/36 (1 November) and 7/8 partial (4 November) retain their original scope | `evidence/2026-11-05-e1/`, historical `evidence/2026-11-01-eval-s11`…`s14` |
| Task time (39 live tasks) | Median 37 s, p95 79.7 s. Model 56% of the time, device execution 6%, unaccounted ~34%. Median 6 model calls. | eval `timing` fields |
| Open defects | Critical 1 awaiting full repair qualification (D22) · High 5 open (D8 partial, D9, D16, D25, D28) + 2 mitigated (D4, D10) · Medium 7 open (D11, D13, D19 partial, D23, D24, D26, D29) · Low 1 (D15) | Appendix D |

---

# LEVEL 2 — PERMANENT ENGINEERING OPERATING CONTRACT

> **These rules apply to every OCADE development session and every coding agent until the owner explicitly changes them.** An AI agent does not remember them between sessions. They bind because the documented startup workflow (`CLAUDE.md` → `AGENTS.md` → this file) leads here every time. Do not copy them into other files. Universal rules are marked **[U]**; OCADE-specific rules are marked **[O]**.

## 4. The engineering formula **[U]**

**Objective → Evidence → Root cause → Smallest complete change → Proof → Simplify → Record → Next.**

| Stage | Needs | Produces | Prevents | Enough when |
|---|---|---|---|---|
| **Objective** | The requirement IDs and the customer outcome | One-sentence success condition plus measurable acceptance | Building the wrong thing | You can state how a tester would know it works |
| **Evidence** | The code owners, the latest run, a reproduction or measurement | A failing test, trace or number | Fixing symptoms and guessing | The problem reproduces, or the missing behaviour is demonstrated |
| **Root cause** | The evidence and the callers of the code involved | The single cause that explains all observations, with every affected caller | Patching one caller while siblings stay broken | The cause predicts the failure, and fixing it should fix every case |
| **Smallest complete change** | The existing owner of the concern | A diff in the owner, plus a regression test | New layers, duplicates and rewrites | No smaller change satisfies the acceptance and the safety rules |
| **Proof** | Focused checks, then broader ones, then an independent outcome check | Results bound to a commit SHA and an environment | False PASS | Acceptance holds on the stated platform |
| **Simplify** | The passing change | Removal of whatever the change made redundant | Leftover scaffolding and orphans | Nothing you added can be removed without failing a test |
| **Record** | The finished batch | Appendix E updated once per batch; a defect note in Appendix D only if one stays open | Rework and lost context | Another agent could resume from the repository alone |

**Research stops** when another fact would not change the decision. Then record the assumption and implement.

**Implementation starts** as soon as the objective, evidence and owner are known. Planning beyond the current coding batch is waste.

**Architecture changes** only when measured evidence shows that the current design cannot meet an acceptance condition (§10).

## 5. Twenty engineering rules **[U]** (rule — why — when — how — verify — mistake to avoid)

| # | Rule | Why | When | How | Verify | Common mistake |
|---|---|---|---|---|---|---|
| 1 | Read the objective before the code | Effort goes to the outcome, not to activity | Every task | Restate the outcome and its acceptance from the requirement IDs | Acceptance is measurable | Starting from a file instead of the customer result |
| 2 | Inspect before changing | Most "new" needs already have an owner | Every change | Search for owners, callers and tests of the concern; read the actual flow end to end | You can name the owner and every caller | Writing a second implementation next to the first |
| 3 | Reproduce before fixing | A fix without a reproduction is a guess | Every defect | Write the failing test or command first | It fails before the fix and passes after | "Fixing" a theory |
| 4 | Fix the shared cause | One fix in the shared path beats N fixes in callers | When several symptoms appear | Find the function every failing path goes through | All sibling cases pass | Guarding only the path in the bug report |
| 5 | Prove necessity | Unneeded work is the largest source of bloat | Before adding anything | Trace it to a requirement ID or a measured defect | It has an ID | Building for imagined future needs |
| 6 | Improve before replacing | Replacements throw away verified behaviour | When a component is weak | Replace only with evidence that targeted fixes cannot meet acceptance (§10) | The replacement passes the old tests plus the new ones | Rewrites driven by taste |
| 7 | Choose the simplest reliable design | Simple designs fail in visible ways | Every design decision | Prefer the existing owner, then the standard library, then platform features, then installed dependencies, then new code | No layer exists without a caller | Factories and interfaces with one implementation |
| 8 | Do not abstract early | Abstractions freeze wrong assumptions | When code repeats | Abstract on the third real use, or when the duplication causes defects | The callers get simpler | DRY that couples unrelated domains |
| 9 | One owner per concern | Duplicated state and validators drift apart | Every new responsibility | Put state, permission and validation in their existing owner | Searching for the concern finds one place | Parallel registries, validators or executors |
| 10 | Clean boundaries | Boundaries contain failures and keep changes local | Interfaces between components | Typed contracts generated from one source; validate untrusted input at the boundary | Contract tests | Passing loosely typed data across trust boundaries |
| 11 | Order by risk and code dependency | Unsafe or blocking work done late causes rework | Choosing the next batch | Safety, then foundations, then what the most code depends on, then polish. Only a real code dependency orders work; tests, campaigns and CI of other features never do | The batch's code prerequisites exist | Waiting for an unrelated package, benchmark or CI job |
| 12 | Treat uncertainty explicitly | Hidden assumptions become defects | Unknown behaviour or limits | Run the smallest experiment or measurement that decides the question; record it | The decision cites the measurement | Long research with no decision |
| 13 | Prefer proven libraries | Mature code beats new code | Before writing infrastructure | Check licence, maintenance, size and security; pin the version | Licence and audit pass | Adding a dependency for something a few lines can do |
| 14 | Write small, explicit code | Small, clear code is easy to verify | Every implementation | Descriptive names, direct control flow, explicit errors, no hidden side effects | Review shows nothing to remove | Clever one-liners; swallowing errors |
| 15 | Verify the effect, not the command | Exit code 0 is not success | Every behaviour change | Check the real output (file, value, page, window) independently | An independent check passes | Trusting a tool's own success message |
| 16 | Catch errors before integration | CI time is the scarcest resource | Before every push | Format, typecheck and focused tests locally | The local gate is green | Using CI as the first test |
| 17 | Protect against regressions | Fixed bugs come back | Every fix | Keep the reproduction as a permanent test; run sibling suites | The test stays in the required suite | Deleting or skipping tests that fail |
| 18 | Measure before optimising | Intuition about speed is usually wrong | Any performance work | Time each phase; change one thing; compare p50/p95 on the same tasks | Before/after numbers | Optimising the 6% while ignoring the 56% |
| 19 | Define done objectively | "Seems to work" is not done | Ending a task | Coding done = CODED and BUILDS (§17 G-Coded). Requirement done = RUNTIME VERIFIED at qualification (§17 G-Requirement) | The §17 gate for that state holds | Calling "implemented" verified, or calling a stub implemented |
| 20 | Leave the repository resumable | Agents lose context | End of every work unit | Commit, update the board, note any in-flight hypothesis | A fresh agent knows the next step | Leaving state only in chat |

## 6. OCADE operating rules **[O]**

**A. Mindset**
1. Understand before acting.
2. Evidence over assumptions.
3. Root causes over symptoms.
4. Clarity over cleverness.
5. Keep working functionality working.
6. Challenge weak assumptions with a measurement, not an opinion.

**B. Architecture**
1. The architecture in Level 3 is frozen. Change it only through §10, which includes the owner-ordered simplification audit (W12).
2. Prefer existing components.
3. Build reusable capability-based operations, never application-specific journeys.
4. Every piece of state and every permission decision has exactly one owner (§12).
5. Verification stays independent of execution.
6. A new component must pass the admission test in §9.

**C. Code**
1. Write the smallest complete solution for the requirement.
2. No line-count targets.
3. Never trade correctness or security for size.
4. No redundant wrappers, repeated logic or unneeded dependencies.
5. Use clear names, simple interfaces and explicit error handling.
6. No premature generalisation.
7. Every change must be testable.
8. Delete dead code only after proving it has no callers.
9. Never simplify away a security check.
10. Never hand-edit generated files (`protocol.json`, Supabase types). Change the source and regenerate.

**D. Execution:** follow the §7 loop.

**E. Testing**
1. Every requirement has measurable acceptance (Appendix A destination plus the package acceptance). That acceptance is proven at the qualification stage; it never blocks writing the code.
2. Every important behaviour has a regression test.
3. Focused checks run before full suites.
4. Never fabricate results.
5. Never weaken a test to get green.
6. A failure is evidence: diagnose it.
7. Windows Server runners are not Windows 10/11 consumer machines, and pre-authorised macOS runners are not consumer Macs.
8. Blockers stay visible.

**F. Performance**
1. Measure first.
2. Target the largest measured bottleneck.
3. Avoid needless model calls and round trips.
4. Batching must never skip a permission or lease check.
5. Compare before and after on the same tasks.
6. Millisecond targets apply per workload (§18) and are not universal promises.

**G. Security**
1. Respect authorisation boundaries.
2. Never automatically repeat an uncertain or destructive effect.
3. STOP and Take Over must always work.
4. Bind every action to the exact window, file, page and device.
5. Least privilege.
6. Never bypass MFA, UAC, CAPTCHA or OS permission prompts.
7. Never extract credentials.
8. Secrets never reach prompts, workers, pages, logs or CI.
9. Never rotate Gemini keys to escape a project-wide 429.
10. Never sacrifice safety for a benchmark.

**H. Progress**
1. One plan (this file).
2. Track verified results, not activity.
3. Do not reopen settled decisions without new evidence (§10).
4. Record coding progress once per batch in Appendix E. Write evidence files only for qualification results; never a report instead of code.
5. No competing status documents.
6. Follow code dependencies only. Never wait for an unrelated package, CI job, benchmark or evaluation.
7. Always report what remains incomplete.

## 7. The coding loop **[U+O]**

Work in **coding batches**: one coherent group of requirement IDs (usually one owner or one capability) finished completely, then one commit. Several commits per session are expected; one enormous commit is not.

1. **Select:** the next batch from Appendix E whose code prerequisites exist (§0).
2. **Inspect:** the owner files, their callers and their existing tests. Check Appendix D so you do not repeat an investigation.
3. **Implement completely:** every function, API connection, database contract, execution path and UI interaction the batch's requirements need, in the existing owner. Fix the shared cause, not one caller. A defect fix keeps or adds one focused regression test.
4. **Wire and prove presence (mandatory):** for every requirement in the batch, confirm it is reachable from a real entry point (route, operation, worker tool, migration, UI control) and actually called; name the entry point and the caller in Appendix E. No placeholders, empty stubs, `NotImplemented`, TODO markers, fake returns or documentation-only "completion". Search the diff for these before committing.
5. **Coding gate (§17 G-Change), locally:**
   - `npm run format:check` and `npm run typecheck`
   - Python compile and imports: `python3 -m compileall -q device-agent/windows/ocade_agent`
   - `npm run jarvis:protocol-check` if contracts changed; `npm run jarvis:no-hardcoded`
   - migration validity: `npm run test:jarvis-db` if SQL changed
   - the existing focused tests of each touched owner (§17.1). Existing tests must stay green; never weaken or delete one to pass.
6. **Repair:** fix what the gate finds in the same batch.
7. **Commit and push:** one commit per finished batch, on this branch only, with a message naming the requirement IDs. Push only when the coding gate is green; the push-triggered CI job (the coding gate) must be green on every pushed commit. If it turns red, fixing it is the next task.
8. **Record:** in the same commit, move the batch's IDs in Appendix E (NOT CODED → CODED → BUILDS) with the commit, entry point and caller. Do not edit §3, §15, Appendices A–D or evidence files for coding progress.
9. **Next:** the next batch. Never stop because another feature is incomplete.

**Not part of the coding loop** (all deferred to the qualification stage, W13): full CI matrix, live AI tasks and E1–E3 campaigns, model comparisons, performance measurement (§18), cloud-computer workflows, real-PC tests and readiness re-scoring. Their criteria are unchanged; they only stop blocking code.

**Batch C0 (first):**
- Classify every requirement in Appendix E: CODE (needs code), QUALIFICATION-ONLY (needs only a measurement, campaign, real-PC run or owner action, plus any harness code it requires) or STANDING (a rule checked at every gate). Classification never removes a requirement or changes its text.
- Make the push-triggered CI run only the coding gate; move the full matrix, packaging, bundle and live-evaluation jobs to manual dispatch for the qualification stage.
- Replace the hard-coded `testsRun == N` pins in `.github/workflows/jarvis-cloud-validation.yml` with one shared check that fails on any unexpected skip or missing test, so adding a test never turns CI red.
- Merge candidate commit `26ec426b` (glTF, macOS AX, verifier and Windows focus work) once its coding gate is green, or drop it and remove every claim that cites it.

**Work states:** NOT CODED → CODED (fully implemented and wired, §7 step 4) → BUILDS (passes the coding gate) → RUNTIME VERIFIED (qualification evidence on the stated platform; Appendix A `PASS`). DONE means RUNTIME VERIFIED for every requirement of a package.

## 8. Failure, recovery and resumption **[U+O]**

- **A test stays red:**
  1. Fix it inside the batch; that is the default.
  2. Never rerun an identical failing CI job hoping for green.
  3. After two failed approaches, choose a new root-cause hypothesis.
  4. If a third attempt fails, record the facts once in Appendix D, mark only that item blocked in Appendix E, and continue with the next independent batch. Never push a red coding gate.
- **Regression found:** it blocks the current batch until it is fixed or proven pre-existing. A pre-existing regression gets an Appendix D entry.
- **Flaky test:** treat it as a defect. Find the race or ordering cause. Never add sleeps or retries to hide it.
- **Interrupted session:** the repository is the memory. On resume:
  1. Do §0.
  2. Run `git log -5` and check the last CI run for the head.
  3. Read Appendix E for the batch in flight.
  4. If uncommitted work exists, finish it or discard it deliberately (never silently).
- **The model or provider is busy:** wait or pace. Never rotate keys. Live evaluations resume from saved tasks.

## 9. No-overengineering rules **[U+O]**

Before adding a component, dependency, abstraction or feature, answer all of these questions. If any answer is "no" or "unknown", do not add it yet.

1. Is it required by a requirement ID or a measured defect?
2. Is there no existing owner that does or could do this?
3. Would improving the existing owner fall short? Show why.
4. Does it solve a real, observed problem rather than a hypothetical one?
5. Would fewer moving parts fail to give the same correctness?
6. Is the dependency necessary, licensed, maintained and pinned?
7. Do customers need it, rather than it merely sounding impressive?
8. Does it improve a measurable outcome (success, speed, safety, maintenance)?
9. Will maintenance get easier, or at least not harder?
10. Does the benefit clearly exceed the complexity?
11. Is there no duplicated responsibility that, removed, would make this unnecessary?
12. Can one agent build and test it within the package?

**Forbidden without §10 evidence:**
- Rewriting a working component.
- A second planner, registry, validator, executor, state store, worker type or status document.
- Agent swarms, local LLMs or vector databases.
- New services.
- Microservices per tool.
- Configuration for values that never change.
- Wrappers that only rename calls.

**Debloat** only with traced callers, a parity test, and measured before/after results (W12).

## 10. When an architecture decision may change

A frozen decision (Level 3) may change only when **all** of these hold:
1. A measurement or reproduced defect shows that the current design cannot meet a stated acceptance condition.
2. Targeted fixes inside the existing owner were tried or are shown to be impossible.
3. The replacement is smaller or equal in moving parts, or its extra cost is justified by the measured gain.
4. The decision, the evidence and the reversal trigger are written into §27 before coding starts.

**Simplification audit (owner-ordered, W12):** a change that removes moving parts (duplicate logic, an unused abstraction, a redundant check) may be made without a new measurement, provided callers are traced, every existing test stays green, and security, recovery, permissions, STOP, Take Over and independent verification are preserved. It never adds an engine, controller, planner, gateway, execution loop or verification system.

Pre-registered reversal triggers are listed in §27. Everything else stays as decided.

## 11. Owner approval and autonomy

**Continue autonomously:** coding batches (§7), refactoring inside an owner, tests, local runs, free CI on this branch, staging tests with existing approved staging credentials (least privilege; never shown to the model or logs), and documentation on this branch.

**Stop and ask (with the exact action, reason, risk and the work that can continue meanwhile):**
- Anything in O11.
- Using the owner's computer or any real customer device.
- New paid services, certificates or quota purchases.
- Production or `main`.
- Changes to secrets.
- Scheduled automations.
- Closing or commenting on PRs and issues.
- The pending approvals A1–A3 (§20).

Never ask for something the plan already authorises.

---

# LEVEL 3 — FROZEN ARCHITECTURE

## 12. Components and ownership (do not duplicate)

```text
Customer web UI ──HTTPS──▶ Task authority (Supabase RLS, grants, STOP epoch, journal, timing)
                               │ generation permit + project-wide pacing
                               ▼
RTAA (server): supervisor + Gemini pilot (via ocade-intelligence-service)
                               │ per-step policy gate (scope, exact target, risk, confirmation, idempotency, deadline)
                               ▼ wake nudge (content-free) + signed claim (device-initiated, outbound only)
Device Agent / Local Gateway (installed once)
   RTVC: world-state cache · target leases · change detection · user-activity guard
   persistent MCP/STDIO workers: fs · office · shell+jobs · system · web · ui_bridge (UIA | AX) · media · scene · verify
                               │ receipts (effect known/unknown) + observation deltas + previews on demand
                               ▼
Journal ─▶ independent verifier ─▶ settlement · deliverables · timing
```

| Owner (code) | Owns | Must never |
|---|---|---|
| Task authority (`src/lib/jarvis/authority.server.ts`, `supabase/migrations/*jarvis*`) | Durable task state, grants, STOP epoch, journal, timing, settlement | Plan steps |
| Protocol (`src/lib/jarvis/contracts.ts` → generated `device-agent/windows/ocade_agent/protocol.json`) | Operation names, schemas, risk classes | Be hand-edited downstream |
| RTAA (`src/lib/jarvis/planner.server.ts`, `supervisor.ts`) | Contract validation, milestones, step-list acceptance, budgets, when to call Gemini | Choose task-specific actions itself |
| Gemini pilot (`supabase/functions/ocade-intelligence-service`) | Outcome checks (after discovery), next step or short guarded list, revisions | Grant access, declare PASS, see secrets |
| Device agent (`agent.py`, `device.py`, `journal.py`) | Signed claims, local STOP fence, receipts | Hold durable task state beyond the journal |
| Gateway (`gateway.py`, `catalog.py`) | Worker lifecycle, pinning, schema validation, sanitised environment | Plan or decide permissions |
| RTVC + workers (`*_worker.py`, `discovery.py`, `sandbox.py`) | Fresh observations, target leases, one primitive per call, observed receipts | Choose goals or fabricate outputs |
| Verifier (`verify_worker.py`) | Request-bound postconditions from independent evidence | Accept model or tool claims |
| Website (`src/jarvis/*`, `src/routes/*`) | Customer goal, consent, approvals, progress, STOP/Take Over, deliverables | Bypass the authority |

**Standing safety invariants:**
- Gemini is the only planner. It is online-only and is never silently replaced by Offline Chat or a local model.
- Every side effect is bound to account, device, task, grant, exact target, confirmation, idempotency key, STOP epoch and deadline. It is rechecked at the server and at the device just before the mutation.
- STOP is local and independent of the model.
- Uncertain effects are never repeated automatically.
- Originals are preserved, and later user edits are never overwritten.
- Untrusted content never grants authority.

## 13. RTAA and RTVC (division of responsibility)

**RTAA — Real-Time Adaptive Action (server).** The loop: discover → compile request-bound checks → milestones (≤6) → next step **or** a guarded step list → device executes → observation delta → call Gemini only when judgment is needed → verify → deliver.

| Gemini decides | Deterministic code decides |
|---|---|
| The goal interpretation, the method, the choice among observed targets, content and creative choices, recovery from unexpected states | Policy, target revalidation, read batching, guard evaluation, transport retries before dispatch, stall detection, verification, packaging |

**Guarded step lists:**
- At most 5 steps, each with an `expect` condition.
- Only read and reversible workspace steps, plus at most one confirmed external effect, which must come last.
- Each step is policy-checked at dispatch and rechecked on the device.
- The list stops at the first failed guard, unknown effect, STOP, user activity or lease change.
- Build them behind a flag during coding; turn them on by default only after the qualification campaign shows no accuracy loss.

**Long work** (renders, exports, installs) runs as `job.*` and is polled without model calls.

**RTVC — Real-Time Visual and Computer Control (device).**
- **Short-lived world-state cache:** windows (pid, handle, start time), focused element, open documents and their hashes, browser pages and observation tokens, jobs, and the last user-input time.
- **Evidence sources, in order of preference:** object models and file formats → OS APIs → browser DOM/CDP → UIA/AX trees and events → previews and visual matching.
- **Targets:** observation tokens and leases expire on change. Minimised windows are refused, or restored with consent. Synthetic input happens only in the foreground. Mutations pause while the person is active. Previews are taken only on demand.
- **Detailed answers and limits:** §22.

## 14. Component decisions (summary; reasons in §22–§25 and §27)

| Verdict | Components |
|---|---|
| KEEP | Task authority, journal, STOP and Take Over, policy gate, one generated protocol, MCP over stdio with persistent workers, window leases, reproducible installer |
| OPTIMIZE | Planner loop (contract after discovery, step lists, smaller context, milestones for long tasks), operation offering (TF-IDF shortlist → capability-filtered list, §27), large payloads passed as file handles, UIA/AX bridges, browser, verifier, office/media/scene workers, installer |
| REPLACE | Outcome checks compiled before observation → compiled after discovery and bound to the request; backoff polling → wake nudge plus active-task claiming plus piggyback dispatch |
| MERGE | Shell-only file management → typed `fs` operations |
| ADD | `job.*` long-running work; read-only `system.*` diagnostics; `image.*`; presentations; open editable exports (OTIO, glTF); visual fallback with confidence; updater; dependency manager; macOS app bundle |
| REJECT | Local LLM or vector database, agent swarms, cloud desktop, full rewrite, localhost HTTP workers, continuous screenshot streaming, unbounded retries, automatic elevation, auto-installed registry MCP servers |

---

# LEVEL 4 — EXECUTION ROADMAP

## 15. Package board (the progress ledger for work)

| WP | Title | Code prerequisite | State (runtime) | In flight / blocker | Requirements | Concepts |
|---|---|---|---|---|---|---|
| W0 | Green baseline and one ledger | — | IN PROGRESS | Run 99 verifies both Windows repairs at candidate `2d98e0d`; shared Linux gate works in CI. Run 109 at `00cbd9e`: seven jobs green, macOS host not acquired; explicit Windows 2022/2025 and macOS 15 ARM/Intel matrix pending. Previous proof: [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177) all green at `5796bb8`; ledgers agree (41→43 concepts after W1) | 10, 43, 196, 214–215, 236–238 | 9, 22, 39–41, 44, 82 |
| W1 | Safety closure and request-bound contract | — | IN PROGRESS | D22 repair published at 04ff4a99; Linux, Windows 2022/2025 and macOS ARM64 pass the actual warm-worker STOP regression and full 162-test suites; complete matrix awaits Intel (`evidence/2026-11-05-local-stop/`).  [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177): D2, D3, D5, D6, D7 fixed; D4 mitigated (residual → W11); outage visible; M2 recovery qualification `evidence/2026-11-02-recovery/` | 13, 21, 32, 35–41, 66–69, 79–80, 171, 193, 210, 216, 220 | 4–5, 7, 21, 38, 50, 52–57, 61 |
| W2 | Measurement and pickup speed | — | BLOCKED (code complete) | Nudge, receipt-carried next step, prewarm, key cache green in [run 82](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41797737703)/[run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402). Met: idle pickup p95 502 ms (30 synthetic tasks) and 0.5–0.8 s live on staging Realtime; claim while running p95 53 ms (synthetic), ~0.2 s live. NOT met: unaccounted ≤10% — live 35% (8.5 of 24 s) from this container ~210 ms per database round trip; the production topology (Worker beside the database) is unmeasured: needs A1(b). Large payloads already bounded (16 KB evidence, 60 KB receipt; files by path + sha256) | 81–92, 94, 96 | 2, 42–43, 47–48, 51, 70, 78 |
| W3 | Capability surface | — | DONE (code) | [run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402) green on all three OSes: `fs.manage` (D17), `job.*` (D18), shell choice (D20), `system.diagnose`, mechanism fallback (concept 37). Live: `crlf_script` and `config_repair` pass first attempt (eval s21, D12) | 28–30, 93, 136–137 | 25–27, 37, 69 |
| W4 | Accuracy engine and evaluation → E1 | — | IN PROGRESS | Shortlist recall: tuning 100%, held-out 97.1% (< 98%); busy planner resumes itself (D10); D6 residual closed; failure categories, gaming audit, 16 generators; tables read as rows (D9); A1(a) approved and staging credential presence verified; D27 staging boundary repaired and protected authentication/isolation smoke passes (run 41972053886); full 48-task E1 at `00cbd9e` finished: strict 27/48 (56.25%), original oracle 35/48, completed 31/48, gaming 0; target choices absent. Protected candidate/family retests are available without changing the full 48-task denominator (`evidence/2026-11-05-e1-repair/`). Office parsing, interpreter validation, deliverable goal selection and harness fixture/teardown repairs are in qualification (`evidence/2026-11-05-e1/`). E1 partial: 7/8 first-attempt passes at `a6a728f`, gaming 0, stopped at handoff (`evidence/2026-11-04-e1/`); the `log_cause` miss (`invalid_goal`) is fixed in `2dced6b`, not yet measured live | 23, 31, 33–34, 46–57, 60, 63, 65, 166, 197–199, 201–202, 204, 207, 219 | 6, 8, 10, 14–20, 23, 49, 60, 77, 83 |
| W5 | Professional deliverables and visual fallback → E2 | — | IN PROGRESS | In-place .docx/.xlsx/.pptx edits, new decks, `image.edit`, OTIO project beside every film; verifier: `script_runnable`, `workbook_formula`, `document_headings`, `local_service_answers`, confirmed re-run `command_succeeds`; clicks matched against the inspected image (concept 36). glTF export and independent geometry verification remain coding work; unpublished candidate completion claims are withdrawn. Open: glTF, E2 | 61, 70–75, 77, 211 | 36, 74–76 |
| W6 | Windows 10/11 | — | IN PROGRESS | Hung and elevated windows refused; per-monitor DPI v2; stale-image click refusal (UIA-013/014 on the runner). Unpublished focus candidate proof does not establish published-branch completion; focus repair remains coding work. Full matrix pending. Open: packaged (UWP) apps, Windows 2022/2025 coverage. Consumer Windows 10/11 proof BLOCKED on A2 | 58–59, 122–130 | 11–12, 28, 32–35, 58–59 |
| W7 | macOS | — | IN PROGRESS | Accessibility revocation and Screen Recording detection with graceful degradation; diagnose names both; zsh and Trash (W3). AXObserver implementation and permission/lifecycle coverage remain coding work; unpublished candidate completion claims are withdrawn. ARM64 bundle starts all six frozen workers and its packaged browser; Intel bundle builds but startup fails (D24), with no Intel PASS claimed (`evidence/2026-11-05-macos-bundle/`). Consumer permission and hardware proof BLOCKED on A2 (D16) | 131–132 | 11–12, 29, 32–33, 35, 58–59 |
| W8 | Browser and web → E3 | — | IN PROGRESS | Tables as rows with links; failed browser launch is not applied; verifier honours the computer's proxy; installed browsers and profile folders discovered (req 139, Linux-verified); file-picker clicks reported (req 142); site permission prompts reported, never answered; every observation lists the other open tabs (switch by page id). Open: D11, Windows/macOS profile paths on real machines, E3 (A1) | 62, 76, 139–145 | 30–31, 33 |
| W9 | Install, dependencies, updates | — | IN PROGRESS | D13 ownership diagnostics and retained-handle fixture repair in cloud qualification; dependency manager and updater not yet implemented. Consumer clean installation BLOCKED on A2 | 44–45, 97–120, 185–190, 217 | 13, 24, 45, 65, 68 |
| W10 | Customer product | — | IN PROGRESS | Protected staging UI first-task harness in qualification: authenticated browser and companion share only the synthetic user's identity; server credential stays with the isolated server. Completion requires both the visible Done and checked state and hidden file oracle. No completed UI task or surface-control PASS claimed | 146–160, 221 | 71–73 |
| W11 | Security, privacy, operations | — | IN PROGRESS | D27 inheritance repaired at 40f9ea66; protected staging admin/UID/canary smoke passes run 41972053886; old-key revocation owner-confirmed (`evidence/2026-11-05-oracle-isolation/`) | 78, 161–165, 167–170, 172–173, 175–182, 212, 222 | 46, 62–64, 66–67 |
| W12 | Proof-based debloat | all coding batches | NOT STARTED | A3 for PR cleanup | 243 | 81 |
| W13 | Full cloud qualification → E4 | W12 | NOT STARTED | needs A1 | 3, 138, 191–192, 194–195, 200, 205, 208, 218, 223–224 | 1, 79–80, 84 |
| W14 | Linux (optional) | — | NOT STARTED | optional | 134–135 | — |
| RPC | Real-PC validation → E5 | W13; A2 | BLOCKED | needs A2 | 121, 133, 209 | — |
| COM | Commercial prerequisites (§20) | RPC | BLOCKED | owner decisions | 259 | — |

- **Standing rules (S)**, checked at every release gate: 1–2, 4–9, 11–12, 14–20, 22, 24–27, 42, 64, 95, 174, 183–184, 203, 206, 213, 225–235, 239–242, 244–258, 260–266. Standing concept: 3.
- **State** is the runtime-verified state. Coding progress lives in Appendix E. A package's prerequisite never blocks coding another package (O13).

## 16. Work packages

Each package follows the same shape: **Problem → Evidence → Outcome → Constraints → Approach → Boundaries → Tests → Acceptance → Proof**. Each one is self-contained; §-references point to detail only where needed.

**Coding use (O13):** *Outcome*, *Approach*, *Constraints* and *Boundaries* define what must be coded. *Tests*, *Acceptance* and *Proof* are the final qualification criteria (W13): they stay in full, but they never block coding this or any other package. Live campaigns (E1–E3) named in an acceptance line run at the qualification stage.

### W0 — Green baseline and one ledger
- **Problem:** the head is red, so no later measurement can be trusted, and status files disagree.
- **Evidence:** [run 70](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41434622666) fails the planner safety, media nested-source, gateway result boundary, actor bound-host, rendered-verifier/URL, formatting and DB revocation steps (D1). Concept 29 shows BLOCKED although MAC-001…012 pass (run 45) (D14).
- **Outcome:** the full matrix is green on the head, and this file is the only live ledger.
- **Constraints:** do not weaken any red test; migrations come only from the Supabase CLI generator; no hand-edited `protocol.json`.
- **Approach:**
  - Finish the in-flight repairs the red tests describe: verifier visibility and origin rules; held-claim permission recheck (draft migration `20261102061041_enforce_verifier_target_permissions.sql`); media nested-source containment; gateway opaque-read uncertainty; actor bound-host prevention.
  - Apply the formatter.
  - Add a one-line pointer to this file at the top of `evidence/2026-11-01-audit/requirements-266.md`, `evidence/2026-11-01-live/architecture-ledger.md` and `evidence/2026-11-01-audit/codex-continuation.md`.
  - Correct concept 29 to PARTIAL in `scripts/jarvis-traceability.mjs` and its ledger, citing run 45.
- **Boundaries:** do not change architecture or add operations.
- **Tests:** `node --experimental-strip-types --no-warnings --test tests/security/*.test.ts tests/jarvis/contracts.test.ts`, `npm run test:jarvis`, `npm run test:jarvis-db`, then the full matrix in CI.
- **Acceptance:** all CI jobs are green on the head; `npm run jarvis:traceability` and `npm run readiness` match Appendix B and §3.
- **Proof:** run URL and SHA in Appendix D (close D1 and D14) and in §3.

### W1 — Safety closure and request-bound contract
- **Problem:** high safety defects are open, and outcome checks are guessed before observation and then "satisfied" by bending files.
- **Evidence:** D2–D7; 3 of 9 eval failures (seeds 11–14) came from premature or gamed checks.
- **Outcome:**
  - No open high safety defect.
  - Checks are compiled after a read-only discovery step, reference only request-named inputs or new outputs, and are immutable after start.
  - Unknown effects are shown to the person with inspect/confirm/discard choices and are never re-dispatched.
- **Constraints:** keep all existing security suites; external effects stay confirmed.
- **Approach:**
  - Split goal compilation into discovery and then the contract inside `planner.server.ts`.
  - Validate checks in the existing shared validator.
  - Add the unknown-effect resolution API and UI in the authority and `JarvisPanels.tsx`.
  - Recheck permission on claim and on execution.
  - Enforce redirect hops.
  - Add the diff guard in `verify_worker.py`.
  - Add clear state transitions on network outage.
- **Boundaries:** do not add a second validator or state store; use migrations from the CLI generator only.
- **Tests:**
  - A gaming regression with a randomised file name: the model edits an input to satisfy a check, and this must be refused.
  - Permission revocation mid-turn.
  - The unknown-effect flow.
  - Redirect to an ungranted origin.
  - Security, DB and real-worker suites.
- **Acceptance:** each test above passes; Appendix D has no open high item among D2–D7; full matrix green.
- **Proof:** run URL; Appendix D updated.

### W2 — Measurement and pickup speed
- **Problem:** about 34% of task time is not model time, and pickup backs off to 30 s.
- **Evidence:** live timing (§3); the `agent.py` claim loop (D8).
- **Outcome:**
  - Per-phase timing.
  - Active-task claim p95 ≤1.5 s; idle pickup p95 ≤3 s.
  - Unaccounted time ≤10%.
- **Constraints:** device-initiated connections only. The nudge carries no data, and authority still comes from the signed claim.
- **Approach:**
  - Timestamps for each phase (§18).
  - Claim without backoff while a task is active.
  - Content-free Supabase Realtime broadcast nudge. Decision (4 Nov, budget): with the nudge connected an idle device polls every 60 s as a safety net, without it it backs off to 30 s; a 10 s cap would let only ~11 idle devices share the free 100k daily Worker requests (8,640 each). Idle device budget: ≤1,440 requests/day with the nudge, ≤2,880 without.
  - Return the next dispatched action in the receipt response.
  - Pass payloads over 256 KB as workspace file handles plus sha256.
  - Start the fs/office/shell/system/verify workers with the gateway.
- **Boundaries:** keep stdio; add no new service.
- **Tests:**
  - A synthetic-provider timing suite of ≥30 tasks.
  - Nudge loss falls back to polling.
  - A forged or replayed nudge causes no effect.
- **Acceptance:** the targets above are met on Linux and on the Windows/macOS runners; the Workers request budget is calculated and recorded.
- **Proof:** timing summary JSON (≤50 KB).

### W3 — Capability surface
- **Problem:** the model must use confirmed shell commands for ordinary file management, and long work cannot run.
- **Evidence:**
  - No typed copy/move/rename/mkdir/trash/set-attributes operations (D17); this caused 4 of 9 eval failures.
  - `shell.run` is capped at 600 s and there is no job tracking (D18).
  - The shell is PowerShell-only on Windows and `sh`-only on macOS (D20).
- **Outcome:**
  - Typed `fs` operations inside granted scope, without per-command confirmation for reversible workspace changes, with originals kept and every operation journaled.
  - `job.start/status/cancel`.
  - Read-only `system.*` diagnostics (processes, services, crash events, installed programs, associations, environment).
  - Explicit shell choice: PowerShell, cmd, sh or zsh.
  - Automatic mechanism fallback offers the next allowed route with a fresh observation.
- **Constraints:** deletion goes to the Recycle Bin or Trash; external or destructive effects still need confirmation; jobs are contained (Job Object or process group), have deadlines and obey STOP.
- **Approach:**
  - Extend `contracts.ts`, then run `npm run jarvis:protocol`.
  - Implement in the existing `office_worker.py`/`sandbox.py`, `command_worker.py` and `discovery.py`.
  - Expose the new operations through the existing shortlist.
- **Boundaries:** no new worker process unless measurement shows a need; no application names.
- **Tests:**
  - Unit and real-worker tests on all three runner OSes.
  - Kill the agent mid-job: the agent reattaches, or reports the job as `unknown`.
  - A 30-minute job is stopped correctly.
  - Scope escape is refused.
- **Acceptance:** the tests pass; a fresh paced sample of `crlf_script`-class tasks passes on the first attempt; no unconfirmed external effect is possible.
- **Proof:** run URL; D12, D17, D18 and D20 closed.

### W4 — Accuracy engine and evaluation loop
- **Problem:** first-attempt success is 75%, below the 90% target, and is not measured continuously.
- **Evidence:** D9 and D10; there is no hidden-target test (requirement 65).
- **Outcome:**
  - A repeatable, quota-paced evaluation.
  - E1 recorded with ≥40 tasks.
  - ≥85% as the working target (measured at qualification).
  - Median model calls ≤4.
  - Zero gaming.
- **Constraints:** never tune to fixtures; oracles stay hidden; never rotate keys; no paid models.
- **Approach (detail in §23):**
  - Grounded facts only.
  - Structured table, outline, workbook and filtered-tree reads.
  - One-line tool descriptions and measured shortlist recall.
  - Read batching and guarded step lists behind a flag.
  - At most 2 verifier-driven repairs.
  - Error categories.
  - Thinking-level A/B.
  - A project-wide pacer with resume.
  - Generators for every §19 category, the regression set (requirement 207), hidden-target accuracy (requirement 65) and user-effort counting.
- **Boundaries:** no second planner; the pacer lives in the existing intelligence service; no secrets move.
- **Tests:** E1 runs from the agent container against staging, paced.
- **Acceptance:** E1 recorded with its denominator; every failure category has an owner package or a fix.
- **Proof:** E1 summary plus a failure taxonomy in Appendix D.

### W5 — Professional deliverables and visual fallback
- **Problem:** existing documents cannot be edited in place; presentations and images are unsupported; video and 3D have no open editable exports; canvas apps have no fallback.
- **Evidence:** D19; requirements 61 and 70–75.
- **Outcome:**
  - In-place docx/xlsx edits that keep structure.
  - pptx support.
  - `image.*` non-destructive operations.
  - An OpenTimelineIO timeline alongside MP4.
  - glTF export.
  - Generic external-application use through discovery plus `job`.
  - Sandboxed re-run of repaired code.
  - Visual matching with a confidence threshold.
  - Format checks in the verifier (§24).
- **Constraints:** no application-name routing; each new dependency is justified, licence-checked and pinned, and its installer size is measured.
- **Approach:** extend `office_worker.py`, `media_worker.py`, `scene_gl.py` and `verify_worker.py`. Add python-pptx and opentimelineio only after checking that no existing capability suffices.
- **Boundaries:** no new worker unless measured.
- **Tests:** real-file fixtures with hidden oracles; corrupted-input cases; low-confidence visual targets are refused.
- **Acceptance:** E2 recorded with ≥40 tasks; the format checks are complete.
- **Proof:** E2 summary; D19 closed.

### W6 — Windows 10/11
- **Problem:** Windows control has only been proven on Server runners, and depth is limited.
- **Evidence:** concepts 28 and 32–35 are PARTIAL; requirements 58, 59 and 122–130.
- **Outcome:**
  - UIA patterns and events, with `AutoSetFocus` off where possible.
  - Packaged-app discovery.
  - Hung-window detection.
  - Per-monitor DPI transforms.
  - Elevated windows refused with a clear message.
  - cmd support.
  - Windows 10 vs 11 differences covered (§25).
- **Constraints:** never claim hidden-window control; foreground rules are respected.
- **Approach:** extend `windows_worker.py`, `discovery.py` and `command_worker.py`.
- **Boundaries:** no application branches.
- **Tests:** the UIA ladder plus new cases on `windows-2022` and `windows-2025`; RPC test scripts written for consumer-only items.
- **Acceptance:** the runner suites are green; consumer-only items are explicitly UNTESTED with RPC tests ready.
- **Proof:** run URL.

### W7 — macOS
- **Problem:** macOS control has only been proven on a pre-authorised runner; there is no package, and no change events.
- **Evidence:** concept 29 (D14); D16.
- **Outcome:**
  - AXObserver events.
  - ScreenCaptureKit previews, with Screen Recording permission detection and graceful degradation without it.
  - Accessibility onboarding and revocation detection.
  - zsh.
  - Trash.
  - `.app` bundle on Apple Silicon, and on Intel if a runner exists.
- **Constraints:** never bypass Gatekeeper; signing is COM.
- **Approach:** extend `mac_worker.py`, `discovery.py` and `packaging/*`.
- **Tests:** the MAC ladder plus new cases on `macos-15` (and `macos-15-intel` if available); permission-withheld paths where the runner allows.
- **Acceptance:** green runner suites; permission flows tested.
- **Proof:** run URL; D16 closed or kept OPEN for RPC with a test written.

### W8 — Browser and web
- **Problem:** the browser lacks discovery of installed browsers, tab handling, file pickers, prompts and hop-level redirect checks.
- **Evidence:** requirements 139 and 142; D11.
- **Outcome:** installed-browser discovery (the dedicated profile is kept); tab list and switch; file pickers; permission prompts; downloads; per-hop origin checks; structured tables.
- **Constraints:** no cookie or password extraction; the person completes MFA and CAPTCHA.
- **Approach:** extend `web_worker.py`.
- **Tests:** the web ladder plus new fixtures.
- **Acceptance:** E3 recorded with ≥40 tasks across Linux and the Windows/macOS runners (needs A1; Linux-only if A1 is pending, recorded as such).
- **Proof:** E3 summary.

### W9 — Install, dependencies, versioning, updates
- **Problem:** there is no dependency manager and no updater, and only Windows is packaged.
- **Evidence:** requirements 97–120 and 185–190.
- **Outcome:**
  - Dependency manager: detect → propose the exact package, source, version, hash and licence → confirm → install unelevated where possible (official prompts only) → journal → verify → resume.
  - Version negotiation.
  - Updater with integrity checks, staging, rollback and no update mid-action.
  - Reproducible Windows and macOS builds.
  - ARM64 decision recorded.
  - Licence inventory.
- **Constraints:** no automatic elevation; signing hooks only (certificates are COM).
- **Tests:** upgrade and rollback between two built versions on both OSes; interrupted update; blocked install; architecture mismatch.
- **Acceptance:** the tests are green on both OSes.

### W10 — Customer product
- **Problem:** no first task has been completed through the website, and not every control has been exercised.
- **Evidence:** requirements 146–160.
- **Outcome:** onboarding; device states; progress; exact approvals; STOP/Take Over/Continue/Retry/Remove; deliverables; Library; Settings; Usage; admin; accessibility; responsive/PWA; voice within existing scope; Android only if already scoped; iOS browser only. Follows the minimal outcome-first UI principles (research C1–C12).
- **Tests:** the website audit with every control; the authenticated flow on staging.
- **Acceptance:** a first task completed end to end through the UI on staging; no dead controls.

### W11 — Security, privacy, operations
- **Problem:** web security and operational readiness are not audited.
- **Evidence:** requirements 161–182; D4.
- **Outcome:** headers/CSP/CSRF; threat model; XSS/SQLi/SSRF/IDOR tests; secret canary; log redaction; crash reports and health; export and deletion; rate limits; migration rollback strategy; legal and support drafts; an external-MCP review procedure.
- **Acceptance:** zero open critical or high defects; security suites green.

### W12 — Deep debloat, consolidation and naming (after every coding requirement is CODED)
- **Problem:** dead code, duplication, misleading names and bulky process artefacts add maintenance cost.
- **Starts when:** every CODE requirement in Appendix E is CODED and BUILDS. Not before: removing code while features are still being written creates defects.
- **Approach:**
  - Find unused code with standard dead-code finders (TypeScript and Python), then trace every caller before removing anything.
  - Remove duplicate logic, abstractions with one caller, obsolete dependencies, unnecessary background processes and redundant checks; process `ToRemove.md`.
  - Rename only names that mislead (for example a function whose name no longer matches what it does); one rename per commit with all references updated.
  - Known candidates: the TF-IDF operation shortlist once the capability-filtered list replaces it (§27); `HANDOFF-CODEX.md` (stale); raw evidence JSON committed under `evidence/` (keep summaries and file hashes, publish raw files as CI artefacts); the duplicate concept ledgers once `scripts/jarvis-traceability.mjs` and `scripts/launch-readiness.mjs` read one source.
  - Simplification audit of the existing architecture (§10): improve existing components; never add an engine, controller, planner, gateway, execution loop or verification system.
  - Measure installer size, startup and memory before and after.
- **Never remove:** security checks, permissions, STOP and Take Over, recovery and journaling, independent verification, database compatibility, user data, or a useful test.
- **Acceptance:** every existing test still passes; no capability lost; each removal names its traced callers (none) in the commit message.

### W13 — Full cloud qualification
- **Problem:** the integrated system has not been qualified.
- **Approach:** the §19 campaign, including the §19.3 creative acceptance. Fix failures and rerun only the affected categories, plus the full matrix.
- **Acceptance:**
  - E4 ≥90% on ≥100 hidden tasks over ≥3 days (95% ambition).
  - R1–R9 PASS, or BLOCKED only for consumer-hardware items.
- **Next:** request A2, then RPC.

---

# LEVEL 5 — VERIFICATION AND RELEASE

## 17. Quality gates (a small number, all mandatory)

| Gate | Applies to | Passes when |
|---|---|---|
| **G-Change** (coding gate) | Every commit and every push | Format, type check, Python compile and imports, protocol/contract check when contracts change, migration validity when SQL changes, and the existing focused tests of each touched owner are green (§7 step 5); a defect fix keeps a regression test; no test was weakened or deleted to pass |
| **G-Coded** | Moving a requirement to CODED or BUILDS (Appendix E) | Fully implemented in the existing owner, reachable from a named entry point and actually called by a named caller; no placeholder, stub, TODO, fake return or documentation-only change; BUILDS also needs G-Change green at that commit |
| **G-Package** | Marking a package DONE (qualification stage) | Acceptance holds with independent outcome evidence; full matrix green on the head; no new critical/high defect; ledgers updated. Never a prerequisite for coding |
| **G-Requirement** | Marking a requirement or concept PASS (= RUNTIME VERIFIED; qualification stage) | Its destination package acceptance covers it, and its evidence (SHA, environment, run or measurement) is recorded. Code existence, mocks, Server runners or pre-authorised macOS runners never establish consumer-platform PASS |
| **G-Release** | R1–R10 (§20) | Every gate condition holds on the stated platforms |

**Regressions:** a regression of a previously passing behaviour blocks further progress until it is fixed or proven pre-existing and recorded.

**Release block:** any critical defect; any unknown-effect repetition; any wrong-target mutation; fabricated evidence; an unmet R-gate.

**Reconsider a design** only under §10.

### 17.1 Test tiers

| Tier | Command or location | When |
|---|---|---|
| Focused TS and security | `node --experimental-strip-types --no-warnings --test tests/security/*.test.ts tests/jarvis/contracts.test.ts` | Every change to server code |
| Companion | `cd device-agent/windows && python3 -m unittest discover -s tests -t .` (or a single test module) | Every change to device code |
| Database | `npm run test:jarvis-db` (local PostgreSQL) | Every change to migrations or authority |
| Integrated | `npm run test:jarvis` | Before pushing cross-owner changes |
| Preflight CI (coding gate) | Linux job triggered by push | Every push; must be green |
| Full matrix | Linux, Windows 2022/2025, macOS 15, installer, bundles | Qualification stage (manual dispatch); during coding only the one platform job for platform-specific code, when needed |
| Live evaluation | `tests/jarvis/live_eval.py` against staging, paced | Qualification stage only, owner-directed (O14) |
| Real PC | Owner-approved machines | RPC only |

## 18. Performance targets (by workload; measured over ≥30 tasks per category)

| Measure | Baseline | Target p50 / p95 |
|---|---|---|
| Claim while a task is active | backoff up to 30 s | ≤0.5 s / ≤1.5 s |
| Idle pickup (with nudge) | up to ~31 s | ≤1 s / ≤3 s |
| Claim → worker starts the primitive | not measured | ≤150 ms / ≤400 ms |
| File list (≤1,000 entries) | not measured | ≤50 ms / ≤200 ms |
| Read text ≤10 MB | not measured | ≤200 ms / ≤600 ms |
| UIA/AX action with revalidation and readback | not measured | ≤300 ms / ≤1 s |
| Browser action with capture | not measured | ≤800 ms / ≤2 s |
| Command or job start | not measured | ≤150 ms / ≤500 ms |
| Model calls, simple / medium / creative | median 6 overall | ≤3 / ≤6 / ≤40 (budgeted) |
| Simple task (≤3 effects) end to end | ~37 s median overall | ≤15 s / ≤35 s |
| Medium task end to end | — | ≤45 s / ≤120 s |
| Long media or 3D | — | Render time reported separately; orchestration overhead ≤10% |
| Unaccounted time | ~34% | ≤5% |
| Verification share (file tasks) | not measured | ≤10% |
| Agent idle CPU / RAM (no browser) | not measured | ≤0.5% / ≤150 MB |

These are targets, not achievements. A target is met only when the measurement on the stated platform shows it. They are measured at the qualification stage and never block coding.

## 19. Evaluation and qualification campaign

### 19.1 Checkpoints

Every checkpoint uses fresh randomised tasks with hidden oracles, first attempt only, paced quota, and a published denominator. Checkpoints run only at the qualification stage; the owner directs them and supplies the model-comparison tasks (O14).

| Checkpoint | After | Tasks | Platforms |
|---|---|---|---|
| E1 | Coding and W12 complete | ≥40 | Linux |
| E2 | Coding and W12 complete | ≥40 | Linux |
| E3 | Coding and W12 complete | ≥40 | Linux, Windows/macOS runners (A1) |
| E4 | W13 | ≥100 over ≥3 days | Windows 2022/2025 and macOS runners (A1) |
| E5 | RPC | ≥30 per platform | Windows 10, Windows 11, macOS |

**Outcome states:**
- **PASS:** a real effect and independent checks.
- **PARTIAL:** an incomplete deliverable.
- **FAIL:** attempted, and the checks fail.
- **BLOCKED:** the environment, consent, provider or tool is unavailable.
- **UNTESTED:** not attempted.

Success = verified complete ÷ eligible attempted. The harness supplies only the objective, the inputs and the scopes; it never creates deliverables.

### 19.2 Categories

**Files and documents:**
- Organise large file collections.
- Repair corrupted documents.
- Reconcile complex spreadsheets.
- Produce an editable financial report.
- Modify an existing presentation.
- Extract information across formats.

**System and software:**
- Diagnose a program that fails to start.
- Detect missing dependencies and propose safe repairs.
- Install approved software.
- PowerShell, CMD and zsh operations.

**Browser:**
- Multi-tab work.
- Authorised online administrative workflows on test sites.

**Media and design:**
- Complex image editing.
- Editable video project.
- CAD/3D.

**Robustness:**
- Popups during long tasks.
- Crash recovery.
- Network loss.
- Changed window or document.
- Unknown and randomly named applications.

**Safety and control:**
- STOP and Take Over.
- Permission revocation.
- Redirects.
- Wrong-window adversarial cases.

**Platform and lifecycle:**
- Display scaling and multiple monitors (runner-limited; full coverage at RPC).
- Install, update and rollback.
- Performance and resource use.

### 19.3 Advanced creative acceptance — 3D supercar and ~60 s advertisement

**Instruction** (given verbatim to OCADE): "Create an original, premium futuristic supercar in Blender or another suitable available 3D application. Model a detailed exterior and realistic materials, prepare professional lighting and camera compositions, and create a cinematic advertisement approximately 60 seconds long. Include carefully designed camera movements, dramatic presentation, suitable transitions, high-quality rendering and appropriate audio. Deliver the editable 3D project, editable advertisement project, final rendered video, and a report proving that the required outputs were produced correctly."

**Environment:** the harness may pre-install Blender (GPL) on the disposable runner, as a customer might have it. OCADE must discover and drive it generically, through its documented command-line/Python interface run as `job`s, or choose another available route. Production code never names Blender.

**Three separate verdicts:**
1. **Technical validity:** files parse; duration 60 s ± 2 s; fps, codec and audio stream present; no blank frames.
2. **Editable structure:** the 3D project re-opens with named objects and materials, plus a glTF export; the advertisement timeline (.otio or the application's own project) re-opens and references existing media.
3. **Subjective cinematic quality:** human review at RPC only. Geometry is measured by counts and coverage and is never automatically labelled "professional".

**Recovery test:** an interrupted render must resume without re-rendering finished frames.

**Free-runner limits:** CPU only, 6-hour jobs. Cycles CPU works headless; Eevee needs EGL/Mesa (unverified). If the render cannot finish, record FAIL or BLOCKED with the measured frame time and validate at RPC.

## 20. Release gates, approvals and the commercial stage

| Gate | Condition |
|---|---|
| R1 | Repository baseline: integrity, contracts, no-hardcode, audits, reproducible builds |
| R2 | Gateway and device authority, including journal and crash recovery |
| R3 | Installer, dependencies and updates on Windows and macOS |
| R4 | Computer and browser control (UIA, AX, browser) |
| R5 | ≥90% first attempt on E4 (95% ambition). If the levers in §23 cannot reach it, record BLOCKED with evidence; never lower the target |
| R6 | Independent verification and recovery |
| R7 | Customer product |
| R8 | Security, infrastructure and operations |
| R9 | Platform and performance (§18) |
| R10 | RPC passed; zero known critical defects; all 84 concepts PASS, with optional-Linux items explicitly excluded |

The milestones in `gates.json` map one-to-one to R1–R10.

| Approval | What | Why | When |
|---|---|---|---|
| A1 | Live tasks on Windows/macOS runners: (a) a protected Actions environment with staging server secrets, used only by an isolated server step, or (b) a free staging deployment of the web worker | Runners cannot reach the server inside the agent container | Before E3 |
| A2 | Real-PC validation on Windows 10, Windows 11 and macOS, with an exact test list, data, duration and STOP procedure | Behaviour that only appears on consumer machines | After W13 |
| A3 | Close the stale Dependabot PRs for the deleted `/jarvis-runtime` | Repository hygiene | W12 |

**Commercial stage (COM, deferred; nothing is activated):**
1. Code signing (Authenticode; Apple Developer ID and notarisation; paid).
2. Staged release and rollback.
3. Hosted backup/PITR and a restore drill.
4. Legal review.
5. Support and incident runbooks.
6. Pricing and payments.
7. Closed beta.
8. Competitor benchmark (requirement 259).
9. Deployment and `main` merge with explicit approval.

---

# LEVEL 6 — DECISION RECORD (consult when a package refers here)

## 22. RTAA and RTVC design answers

| Topic | Decision and limits |
|---|---|
| Minimised windows | UIA is unreliable for them, and UIA actions take focus by default (`AutoSetFocus`). Refuse, or restore with consent. |
| Foreground | Synthetic input needs the foreground, and Windows restricts who may take it (`SetForegroundWindow` rules). Patterns usually do not need it. |
| Custom-drawn controls | Use scripting or the file format first, then visual matching with a confidence threshold. Report the limit. |
| Targets without a stable id | Role + name + ancestry + box from the current observation. Tokens expire on change. |
| Resize, DPI, monitors | Window-relative fractions recomputed from fresh observation; a per-monitor DPI-aware process; multiple monitors qualified at RPC. |
| Two windows of one app | Lease = pid + handle/window number + process start time; never the title alone. |
| Changed document | Document hash/path is part of the lease; focus events; a mismatch fences the next mutation. |
| Events vs screenshots | UIA events and AXObserver notifications update the cache; previews only on demand or for canvas targets. |
| Confidence | Below threshold: refuse. Above: reversible steps only, plus a mandatory post-action check. |
| User activity | Mutations pause while the person's input is newer than OCADE's last action. |
| Background work | File, format, command and job work continues; UI input never targets background windows. |
| Unresponsive app | Bounded timeouts; hung-window detection; never kill a customer app without confirmation. |
| Proof of target | Pre-action lease check plus post-action readback recorded in the receipt. |
| Ambiguity | Take the reversible default and report it; ask only for irreversible, externally visible or materially different outcomes. |
| Failed vs lost acknowledgement | Intent is journaled before dispatch; a missing receipt means `unknown`; reconcile from target state before anything else. |
| Depth vs latency vs accuracy | Decided per checkpoint by success first, then time. |

## 23. Gemini accuracy and quota strategy (free model)

1. **Contract after discovery,** bound to the request.
2. **Grounding:** facts come only from task observations; unseen deep URLs are refused; "unknown" is an allowed answer.
3. **Structured perception:** tables with headers and per-row links; document outlines; typed workbook ranges; filtered accessibility trees.
4. **Tool descriptions:** one precise line each; shortlist ≤12; recall measured, with ≥98% as the target.
5. **Fewer turns:** read batching and guarded step lists.
6. **Repairs:** at most 2, driven by verifier results.
7. **Error categories** on every failure.
8. **Thinking-level A/B** (Gemini 3-generation models expose `thinking_level`; verify for the authorised model). Preserve thought signatures across function-call turns.
9. **Computer-use tool:** if the authorised model offers it on the free tier, evaluate it only as a visual fallback provider.
10. **Prompt-injection fencing:** untrusted text is labelled.
11. **Quota:**
    - Read the real limits from provider responses (third-party reports say ~10 requests/minute and ~500/day for Flash-Lite free; unverified).
    - Pace project-wide.
    - Queue instead of failing.
    - Checkpoint before every call.
    - Evaluation uses ≤60% of the daily budget.
    - Never rotate keys on a 429.
12. **If ≥90% is unreachable** after these levers, record R5 as BLOCKED with evidence.

## 24. Local execution, MCP/STDIO and deliverable formats

- **Transport:** MCP over stdio for gateway↔worker. It is the MCP-recommended local transport (modelcontextprotocol.io). Pipes, sockets and localhost HTTP were rejected: no measured gain, and more attack surface.
- **Payloads:** binaries over 256 KB travel as file handles.
- **Routing:** deterministic filters, then TF-IDF; embeddings only if recall is below 98%.
- **External MCP servers:** pinned by hash and reviewed; never auto-installed.
- **Pickup:** the Supabase Realtime free plan allows 200 concurrent connections and 100 messages/s (Supabase docs); polling is the fallback.

**Deliverables (all generic):**

| Type | Production | Verification |
|---|---|---|
| xlsx | openpyxl plus engine recalculation; in-place edits | Formulas and typed values |
| docx | python-docx; in-place edits keeping styles | Structure and render |
| pptx | python-pptx | Slides, text, layout |
| Images | Pillow non-destructive, original kept | Dimensions, perceptual and regional checks |
| Video | ffmpeg MP4 plus an OpenTimelineIO timeline | Duration, fps, codecs, audio, shots |
| 3D | `scene.render` or a discovered application via `job`, plus glTF | Geometry statistics, re-open |
| Code repair | `fs.edit_text` plus a sandboxed re-run | Parse and run |

## 25. Platform details

**Windows 10/11:**
- UIA Invoke/Value/Toggle/ExpandCollapse/SelectionItem/Scroll/Text/Window/Grid patterns and events.
- Win32 fallback.
- COM only through confirmed generic scripting.
- App Paths, Start Menu, `Get-AppxPackage` and file associations.
- UIPI: elevated windows are refused.
- PowerShell 5.1 and cmd.
- Job Objects.
- Recycle Bin.
- Smart App Control and SmartScreen diagnosis without bypass.
- Differences to cover: packaged inbox apps, default terminal, Start menu, WebView2 presence, UIA providers, Smart App Control.
- Cloud proxies: `windows-2022` and `windows-2025`.

**macOS:**
- AXUIElement plus AXObserver.
- `AXIsProcessTrusted` onboarding and revocation.
- ScreenCaptureKit (`CGWindowListCreateImage` is unavailable in the macOS 15 SDK).
- Screen Recording permission.
- CGEvent input in the foreground only.
- zsh/sh.
- Trash.
- Gatekeeper diagnosis.
- `.app` bundle.
- Runners: `macos-15` and `macos-15-intel` (verify availability).

## 27. Alternatives, competitors, self-challenge and reversal triggers

**Alternatives** (decided; do not reopen without §10):

| Option | Verdict |
|---|---|
| Current design unchanged | Insufficient |
| **Current spine + capability surface + RTAA/RTVC split + measured speed work** | **Chosen** |
| Pixel-first computer-use loop | Rejected as the primary path; visual fallback only |
| Local LLM router + vector DB + agent swarm | Rejected |
| Cloud VM per customer | Rejected |
| Full rewrite | Rejected |

**Competitors** (verify before quoting; no claim of superiority without a pre-registered identical-task benchmark):
- Gemini computer use: 3.5 Flash tool; Gemini 4 Argon lists computer use as Preview.
- Claude computer use: desktop app on Mac and Windows; research preview.
- ChatGPT agent: cloud VM.
- Manus "My Computer": local Mac/Windows.
- OpenClaw: open-source, self-hosted.

OCADE's intended differentiator is independently proven, editable, locally produced work under exact permissions.

**Reversal triggers (pre-registered):**
- Guarded step lists, if qualification-campaign success drops.
- TF-IDF shortlist, if recall falls below 98%. **Fired:** held-out recall 97.1% (W4). Decision (§10): replace it with the deterministic list of every operation the task's grants allow, not embeddings; fewer moving parts. Coded in a coding batch; the old shortlist is removed in W12.
- Thinking level, if the A/B favours the other setting.
- Realtime nudge, if free limits or reliability fail (fall back to active-task polling).
- python-pptx, if LibreOffice conversion suffices.
- OpenTimelineIO, if target editors cannot import it.

**Risks this plan introduces, with mitigations:**
- Step lists: guards, plus read/reversible-only steps.
- Typed fs operations without confirmation: scope limits, trash and the diff guard.
- Jobs: containment, deadlines and STOP.
- The Realtime dependency: content-free nudges and a polling fallback.

**Supporting research:** `docs/research/UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md` (corrected claims and sources) and `docs/research/OCADE_complete_heading_and_concept_index.md` (236 ideas with plan dispositions).

---

# LEVEL 7 — TRACEABILITY (lookup data)

## Appendix A — The 266 requirements (verbatim) with status and destination

`PASS` here means RUNTIME VERIFIED. Coding status (NOT CODED, CODED, BUILDS) is tracked separately in Appendix E, so a coded requirement is never shown as verified before qualification.

Format: `STATUS` · **destination** — original text. Status source: independent re-audit at `f04228d`, plus W1 promotions of 36, 39, 41, 80, 171 and 216 with [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177) and `evidence/2026-11-02-recovery/`, and W2/W3 promotions of 30 (mechanism fallback), 94 (live round-trip profile before and after each change) and 137 (shell, engine and diagnostic limits refused before running) with [run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402) (`evidence/2026-11-01-audit/requirements-266.md`, current-review column); it is the conservative lower bound. **S** = standing rule verified at every release gate. **RPC** = needs real-PC validation. **COM** = commercial phase. **W14** = optional Linux; never counted as PASS without evidence and never blocking Windows/macOS release.

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
30. `PASS` · **W3** — Add automatic **mechanism fallback** where safe. If DOM interaction fails, inspect available alternatives rather than blindly repeating the same action.
31. `PARTIAL` · **W4** — Improve the supervisor so it maintains objective, target state, milestones, permissions, available capabilities, current observations, completed actions, unresolved uncertainty, and remaining work.
32. `PARTIAL` · **W1** — Store durable task state independently of Gemini's conversational context so interruptions and context truncation do not destroy progress.
33. `PARTIAL` · **W4** — Add a bounded receding-horizon planner: plan enough to act effectively, execute, observe the result, then replan only when necessary.
34. `PARTIAL` · **W4** — Separate **planning, action execution, result observation, and verification** into explicit interfaces and states.
35. `PARTIAL` · **W1** — Give every action a unique identifier, task identifier, target identity, permission context, deadline, and observable outcome.
36. `PASS` · **W1** — Prevent duplicate side effects after retries, server restarts, timeout responses, disconnections, or acknowledgement failures.
37. `PARTIAL` · **W1** — Preserve receipts distinguishing **executed, verified, refused, failed, cancelled, and outcome unknown**. Never infer success from a dispatched command.
38. `PARTIAL` · **W1** — Improve persistent journaling, recovery checkpoints, durable action reconciliation, and crash-safe resumption.
39. `PASS` · **W1** — Do not automatically repeat destructive or externally visible operations when the previous effect is uncertain.
40. `PARTIAL` · **W1** — Implement reliable ownership fences so STOP, Take Over, revocation, sign-out, device removal, and task cancellation prevent new unauthorized actions.
41. `PASS` · **W1** — Ensure an in-flight operation either stops safely or reports honestly what may already have changed.
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
80. `PASS` · **W1** — Build regression tests specifically reproducing the false-positive verification and unauthorized source-editing failures already observed.

#### Execution speed and efficiency

81. `PARTIAL` · **W2** — Optimize for **fastest correct completed task**, not fastest unverified click.
82. `PARTIAL` · **W2** — Instrument planning latency, provider latency, tool startup, execution time, observation time, verification time, retries, and total elapsed task time.
83. `PARTIAL` · **W2** — Remove unnecessary Gemini calls, repeated tool discovery, redundant context generation, repeated file reads, and excessive screenshots.
84. `PASS` · **W2** — Batch independent read-only observations where safe, preserving enough output for Gemini to reason correctly.
85. `PARTIAL` · **W2** — Do not batch dependent writes or risky actions when intermediate verification is necessary.
86. `PARTIAL` · **W2** — Cache stable capability metadata, unchanged file hashes, tool schemas, and other reusable observations using safe invalidation rules.
87. `PARTIAL` · **W2** — Use targeted incremental observations rather than re-reading entire files, pages, or tool catalogs on every step.
88. `PARTIAL` · **W2** — Keep frequently needed workers warm where this measurably improves performance without compromising resource usage or STOP behavior.
89. `PASS` · **W2** — Add progress and stall detection for repeated actions, repeated errors, no state change, exhausted budgets, and ineffective retries.
90. `PARTIAL` · **W2** — Limit retries by error category, risk, elapsed time, and remaining task budget.
91. `PARTIAL` · **W2** — Optimize prompt and context composition without hiding critical observations, permissions, error information, or verification requirements.
92. `PARTIAL` · **W2** — Parallelize independent safe work only when process, file, window, and browser-target isolation can be guaranteed.
93. `PASS` · **W3** — Prefer native file operations and direct APIs over simulated clicking whenever equivalent verified results are possible.
94. `PASS` · **W2** — Profile actual slow paths before optimizing. Benchmark every optimization against the previous implementation.
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
137. `PASS` · **W3** — If an operation genuinely cannot work on a supported platform, detect the limitation before execution and report it accurately.
138. `PARTIAL` · **W13** — Do not mark any operating system fully supported until native installation, pairing, execution, STOP, recovery, and independent task verification pass on representative hardware.

#### Browser and application control

139. `PARTIAL` · **W8** — Dynamically discover the actual installed browsers and profiles. Do not assume Chrome, Edge, or a particular profile is available.
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
171. `PASS` · **W1** — Protect local file access through explicit grants, scope enforcement, race-safe writes, version checks, backup behavior, and non-destructive defaults.
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

Status source: `scripts/jarvis-traceability.mjs` / `evidence/2026-11-01-live/architecture-ledger.md` at `f04228d`. That script reads the concept rows below, so keep the row shape `| n | **title** | …`. Concept 29 is PARTIAL from run 45 (D14 fixed); concepts 38 and 55 became PASS with W1 ([run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177)); concepts 25 and 37 with W3 ([run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402): failed routes are followed by a fresh look and the next route, with the reason, and the verifier rechecks the effect).

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
| 25 | **Native-First Execution Hierarchy** | PASS | W3 | Dispatch fastest safe supported API/object model first; then bounded scripts, formats, DOM/CDP/Playwright, accessibility and vision last. | Fallback transitions include reason and independently recheck effect. |
| 26 | **Native OS and File-Format Operations** | PASS | W3 | Offer generic filesystem, document format, OS inspection and project-file operations through typed sandboxed tools. | File integrity and ownership preserved, paths constrained to scope. |
| 27 | **Scoped Script and Command Execution** | PASS | W3 | Use allowlisted or reviewed bounded commands with quotas and argument schemas, never unrestricted model-generated shell. | Injection, path traversal and forbidden executable requests fail closed. |
| 28 | **Windows UI Automation — pywinauto / UIA / Win32** | PARTIAL | W6 | Use live accessibility trees and exact PID/HWND/process-start identity for native controls, with optional lower-level Win32 only when justified. | Wrong-window, duplicate-title and focus-swap regression tests pass. |
| 29 | **macOS Accessibility — pyobjc / ApplicationServices** | PARTIAL | W7 | Provide a native AX bridge behind the same interface when macOS is a supported target; do not call Linux tests macOS proof. | OS-specific entitlement and real device tests gate macOS claims. |
| 30 | **Browser DOM / CDP / Playwright Automation** | PASS | W8 | Bind to the precise authorized browser, profile, tab and origin; prefer semantic DOM/ARIA and official APIs. | Unexpected navigation, lost tab and login challenges pause safely. |
| 31 | **Authenticated Browser Profile and Session Binding** | PARTIAL | W8 | Use permitted existing sessions without exporting passwords/cookies; revoke tool authority when profile identity changes. | Cross-profile execution and token extraction are rejected. |
| 32 | **Structured Accessibility-Tree Interaction** | PARTIAL | W6, W7 | Inspect semantic controls, roles, state and geometry freshly before invoking action; avoid stale element IDs. | Changed UI tree triggers rediscovery rather than blind click. |
| 33 | **Exact PID / HWND / Document / Tab Targeting** | PARTIAL | W6, W7, W8 | Store lease-bound account/device/process/window/file/tab identity and validate immediately before mutation. | Spoofed window title or stale PID cannot redirect operation. |
| 34 | **Window Resize, DPI and Multi-Monitor Resilience** | PARTIAL | W6 | Requery accessibility state, transforms and visual anchors after display changes; never presume persistent coordinates. | DPI/display movement trials do not select wrong target. |
| 35 | **Foreground, Background and Minimized-Window State Handling** | PARTIAL | W6, W7 | Differentiate API-capable background work from GUI operations requiring a visible foreground; restore only with consent. | No claim of universal hidden-window clicking or cursor-free execution. |
| 36 | **Visual Anchors / OpenCV as Last-Resort Fallback** | PARTIAL | W5 | Use bounded vision matching with confidence, fresh screenshots and explicit target checks only where semantic interfaces fail. | Low-confidence target, resize drift or unexpected overlay blocks effect. |
| 37 | **Dynamic Universal Application Fallback Hierarchy** | PASS | W3 | Select execution mechanism by current capability quality, privacy, fidelity and target state, independent of application names. | A missing native path falls back safely without fixed app-specific script. |
| 38 | **Approved Filesystem Sandbox** | PASS | W1 | Create per-task bounded input, intermediate and output roots, preserving originals, ACLs and provenance. | Symlink traversal, overwrites and cross-account file access are blocked. |

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
| 55 | **Lost-Confirmation / Unknown-Effect Reconciliation** | PASS | W1 | Check external state and idempotency journal before any repeat after timeout/disconnect. | Unknown POST/send/delete is never blindly retried. |
| 56 | **Durable Checkpoints and Crash Recovery** | PASS | W1 | Persist outcome, consent, exact target, open actions, completed receipts and current epoch. | Process restart reconstructs task without replaying completed operations. |
| 57 | **Local STOP / Pause / Take Over / Resume** | PARTIAL | W1 | Local kill fence blocks new effects immediately; remote STOP has separate acknowledgment and reconciliation states. | STOP works when cloud/model unavailable; in-flight effects reported truthfully. |
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
| A81 | Real latency benchmarks | ADD (§18 targets) | W2, concept 78 |
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
| A118–A125, B29 | Seven production scenarios (video, photo, chess/canvas, finance, CAD, cross-app, interruptions) | KEEP as qualification categories | W13 §19 |
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
| D1 | HIGH | Branch head red: planner safety, media nested-source containment, gateway result boundary, actor bound-host prevention, rendered-verifier/URL transport, formatting and DB revocation steps fail | [run 70](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41434622666), `f04228d` | FIXED again: run 99 at candidate `2d98e0d` is fully green; exact native exit codes and bounded hung-window probing repair both run 96 failures. See `evidence/2026-11-04-cloud-recovery/run-99.json`. Previous closure: full matrix green in [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177) (`5796bb8`) | W0 |
| D2 | HIGH | Anonymous web verification: hidden page content passes; private/off-origin observations accepted; same URL fetched 13 times | run 68 (`82098c2`), seven-method negative suite | FIXED in `b86002c` ([run 74](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41534326454) step 19, 7/7): one script-free render per URL, same-origin GET only, checked hops, budgets, painted-text rules | W1 |
| D3 | HIGH | Dispatch after browser permission was revoked while the claim was held | run 69 (`61b29b1`) | FIXED by migration `20261102214455_fence_revoked_claims_and_receipt_locks.sql` ([run 74](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41534326454) DB job: held-claim revocation and claim/STOP lock-order cases pass) | W1 |
| D4 | HIGH (risk) | SSRF, DNS-rebinding and redirect-hop enforcement for verifier fetch and actor browser | Playwright routes never see redirect hops (verified experimentally) | MITIGATED (`b86002c`, `2e9ba47`; green in [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177)): hop-by-hop navigation checks and request-time re-resolution. Residual (Node's own resolution inside one fetch; a confirmed form POST redirect) moves to the W11 security review | W1, W11 |
| D5 | HIGH | Unknown effects only fence the task; no resolution flow for the person | concept 55; run 57/58 | FIXED: person-resolution flow (`3938351`), green in [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177) | W1 |
| D6 | HIGH | Outcome checks are compiled before anything is observed and are not bound to the request; the model then bends files to match its own guess (3 of 9 eval failures); no guard against edits to unrelated or input files | seeds 11–14 READMEs; requirement 68 | FIXED (`faa52d6`, green in [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177)): checks fixed after a first look; bound to request/listing/output; gaming guard with randomised regression. Residual closed (`742df24`): changing a check-read file also needs the request to ask for a change, not merely name it | W1 |
| D7 | MEDIUM | Original-file compare-and-replace and directory-identity concurrency window | codex-continuation (run 53 scope note) | FIXED (`2392efa`, race fixture `11d1939`), green on Linux, Windows and macOS in [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177) | W1 |
| D8 | HIGH | Device pickup backs off to 30 s; ~34% of live task time unaccounted | `agent.py` claim loop; eval timing | PARTIAL: pickup fixed (Realtime nudge; idle p95 502 ms synthetic, 0.5–0.8 s live; [run 82](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41797737703)). Unaccounted time live 35%: server database round trips (~210 ms each from this container; key lookups cut 12→1). Remaining: measure in the production topology (A1(b)); fold the replay check into claim/receipt if still above 10% | W2 |
| D9 | HIGH | First-attempt real-task success 75% (< 90%): invented facts, dense-table row choice (r1c), checks bent to guesses | `evidence/2026-11-01-eval-s11` … `s14` | PARTIAL: invented facts guarded (W1), checks fixed after a first look (W1), dense tables read as rows (`a403bca`); eval s21 9/11 + 1/2 web (harness and two product fixes found); Full E1 at `00cbd9e`: strict 27/48 after completed-task audit, gaming 0. D25/D26 and Office-reader repairs are in qualification; no >=90% claim (`evidence/2026-11-05-e1/`) | W4 |
| D10 | HIGH | Planner “busy” after ~30–60 calls on the shared free project | `evidence/2026-11-01-eval-s14/README.md` | MITIGATED (`0aa8c3b`): a busy wait records the provider's retry time and the device's next request resumes the task by itself; other waits are never auto-resumed. Daily free quota itself is unchanged (owner decision for paid capacity) | W4 (pacing) |
| D11 | MEDIUM | Windows web ladder `KeyError 'page'` after a browser/context closed | run 37, `4267c43` | OPEN: original primary `TargetClosedError` recovered; stale-context reproduction fails on Linux in run 106. Fresh-open recovery candidate is in qualification; original browser termination remains unexplained (`evidence/2026-11-04-browser-lifecycle/`) | W8 |
| D12 | MEDIUM | CRLF script executable flag fix not verified live | eval s11 `crlf_script` | FIXED: passes first attempt live (eval s21, `6e7c8cc`) with typed `fs.manage` | W3 |
| D13 | MEDIUM | Windows browser-profile owner can remain alive after worker shutdown | runs 63, 77 and 102 | OPEN: run 123 metadata identifies PID reuse: a newer console helper PID was mistaken for an older system tree's parent, causing a wait on svchost.exe. Timestamp-bound graph edges and native handle-identity repair are in qualification; stale-parent and snapshot-reuse regressions fail first in run 126. The separate retained-handle leak is repaired. Older failures without identity data remain unverified; no timeout increase or ignored failure (`evidence/2026-11-04-browser-lifecycle/`) | W9 |
| D14 | LOW | Ledger regeneration restores five retracted PASSs; concept 29 incorrectly BLOCKED | Run 70 traceability regression; [run 45](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41331983365) | FIXED (`e4af84b`, [run 74](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41534326454)): script, ledger and Appendix B agree (41 PASS) | W0 |
| D15 | LOW | Stale Dependabot PRs target deleted `/jarvis-runtime` | open PRs #88, #90 | OPEN (needs A3) | W12 |
| D16 | HIGH (risk) | macOS window previews need Screen Recording permission on consumer Macs; CI runner is pre-authorised, so this path is unverified | `mac_worker.py` preview; Apple privacy model | PARTIAL: Screen Recording and Accessibility are detected before use; without Screen Recording controls still work, the picture and image-grounded clicks are refused with a named reason, and diagnose says where to grant it (`7309946`). Consumer Macs still UNTESTED (RPC) | W7 |
| D17 | HIGH | No typed copy/move/rename/mkdir/trash/set-attributes operations; file management and the executable bit go through confirmed `shell.run` (4 of 9 eval failures) | `src/lib/jarvis/contracts.ts` (35 operations); `crlf_script` in s11–s14 | FIXED: `fs.manage` copy/move/mkdir/trash/set_attributes ([run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402), three OSes) | W3 |
| D18 | HIGH | `shell.run` capped at 600 s and no tracked long-running job: long renders, exports and installs cannot complete or resume | `contracts.ts` `timeoutSeconds` max 600 | FIXED: `job.start/status/cancel` up to 6 h, deadline/cancel/STOP end the tree; macOS/Linux jobs survive an agent restart, Windows jobs read `lost` after one ([run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402)) | W3 |
| D19 | MEDIUM | Documents and workbooks cannot be edited in place; presentations and image editing unsupported; video has no open editable timeline; 3D has no open interchange export | `contracts.ts`; `office_worker.py`, `media_worker.py`, `scene_gl.py` | PARTIAL: in-place .docx/.xlsx/.pptx edits, new decks, `image.edit`, OTIO timeline beside every film (`d80ad29`…`9fcdac0`); 3D interchange (glTF) still open | W5 |
| D20 | LOW | Windows shell is PowerShell only; macOS uses `sh` only | `command_worker.py` | FIXED: powershell/cmd or sh/bash/zsh ([run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402)) | W3 |
| D21 | LOW | Migrations after `20261030` have no rollback file | `supabase/rollback/` | FIXED: rollbacks for all 12 migrations after 20261030, each proven to restore the exact shape before its migration (function bodies, columns, triggers) and re-apply cleanly (`tests/jarvis/db/rollback-roundtrip.sh`, in `test:jarvis-db`) | W11 |
| D22 | CRITICAL | Local STOP arriving during a network claim does not fence the returned action | run 41900561913, real warm filesystem MCP worker | Repair published at 04ff4a99; full qualification pending in run 41904905940. Actual post-STOP write reproduced, so the plan's unauthorized-action severity definition applies. Linux regression and full suite pass at 23efef02; M2 remains withdrawn, requirements 88/216 and concept 57 PARTIAL (`evidence/2026-11-05-local-stop/`) | W1 |
| D23 | MEDIUM | Socket TimeoutError escapes the claim polling retry loop | run 41900561913, real signed Device client and agent loop | OPEN: transport normalization and resumed-claim budget pass Linux preflight at 23efef02; full qualification/live busy-family retest pending (`evidence/2026-11-05-local-stop/`) | W2 |
| D24 | MEDIUM | macOS frozen Intel startup fails; tee masks the failed checker exit | run 41905297847, job 126838385018 | OPEN: the bundle builds, but no Intel worker initializes. Pipefail repaired at c9ba4442; bounded startup stderr is in qualification. ARM64 actually passes all six frozen workers and its packaged-browser fixture. Intel is not qualified (`evidence/2026-11-05-macos-bundle/`) | W7 |

| D25 | HIGH | script_runnable accepts an escaped or missing interpreter; completed program repairs can still fail | full E1 seeds 22/23 config_repair | OPEN: actual independent reruns exit 1 despite correct old output. Interpreter-line and full-file budget regressions are in qualification; goal compilation now requests the confirmed invocation, not launch flags alone (`evidence/2026-11-05-e1/`) | W5 |
| D26 | MEDIUM | E1 serves fake ZIP bytes, misses checked-transport CA and probes service after STOP teardown | full E1 release_pick and port_conflict; raw reports retained | OPEN: real ZIP/CA and parsing repairs in qualification; pre-teardown independent oracle handshake still required. No raw failures removed or rewritten, denominator remains 48 (`evidence/2026-11-05-e1/`) | W4 |
| D27 | CRITICAL | Evaluation oracle and port-conflict fixture inherit the root server environment after dropping privileges | actual root-to-user synthetic credential canary, run 41915577409 | FIXED: positive environment filter published at 40f9ea66; protected staging admin authentication and actual UID/canary smoke pass run 41972053886 at c6858ce9. Owner reports staging credential replacement; revocation is not independently verified and GitHub metadata is unchanged (`evidence/2026-11-05-oracle-isolation/`) | W11 |

| D28 | HIGH | Intel scene rendering publishes a flat image while scene/hash/size checks report success | published aaf3bad3, run 41970810529, Intel job 127061543475 | OPEN: existing independent pixel assertion fails; candidate WebGL error validation now refuses the failed readback. Exact native cause and a correct render still need proof (`evidence/2026-11-05-intel-render/`) | W5 |
| D29 | MEDIUM | Intel browser popup classification intermittently omits the off-site closure | unpublished diagnostic run 41971524885, job 127064311487, WEB-009 | CANDIDATE-ONLY; not published-branch proof: empty popups instead of closed_off_site; fixed collector window is a hypothesis, not a confirmed cause. Network binding remains separately tested; no bypass inferred (`evidence/2026-11-05-intel-render/`) | W8 |
Closed recently (kept for history): approval arguments clipped at 4000 characters (fixed `43c50ed`, run 64); opaque native/page interactions mislabelled reversible (fixed `43c50ed`); unknown-write replay after resume (fenced `83f3142`, run 58); competing-file overwrite on publication (fixed `897675b`, run 49); installed companion started no worker (fixed `947ceee`); minimized macOS window reported as closed (fixed `a7cf182`).

## Appendix E — Coding ledger (updated once per coding batch)

Coding status is kept separate from runtime verification (Appendix A), so nothing is shown as verified before it is tested.

| State | Meaning | Gate |
|---|---|---|
| NOT AUDITED | Not yet classified by batch C0 | — |
| NOT CODED | Missing, partial, stubbed or not wired | — |
| CODED | Fully implemented in the existing owner and reachable: named entry point and caller, no placeholder, stub, TODO or fake return | §17 G-Coded |
| BUILDS | CODED, and the coding gate is green at the recorded commit | §17 G-Change + G-Coded |
| RUNTIME VERIFIED | Qualification evidence on the stated platform (Appendix A `PASS`) | §17 G-Requirement |
| QUALIFICATION-ONLY | Needs only a measurement, campaign, real-PC run or owner action; any harness code it needs is a CODE item | Verified at W13/RPC/COM |
| STANDING | A rule checked at every gate (the S list in §15) | Every gate |

**Entry format** (one line per requirement as it moves): `ID — state — commit — entry point → caller — note`.

**Initial state (5 November 2026, before C0):**
- RUNTIME VERIFIED (Appendix A `PASS`, 77): 1–2, 4–6, 9, 11–12, 14–15, 17–22, 24–27, 30, 36, 39, 41–43, 47, 53, 64, 79–80, 84, 89, 93–95, 102, 109, 136–137, 141, 145, 154, 171, 173–174, 178, 183–184, 196, 198, 203, 213, 225, 234, 239–241, 244–246, 248–254, 256–258, 260–263, 265–266.
- NOT AUDITED (189): 3, 7–8, 10, 13, 16, 23, 28–29, 31–35, 37–38, 40, 44–46, 48–52, 54–63, 65–78, 81–83, 85–88, 90–92, 96–101, 103–108, 110–135, 138–140, 142–144, 146–153, 155–170, 172, 175–177, 179–182, 185–195, 197, 199–202, 204–212, 214–224, 226–233, 235–238, 242–243, 247, 255, 259, 264.

**C0 classification (base `dd0700cc77808bead5ae5da8986a037b4b80ac92`):** All 189 unfinished IDs below are classified individually. CODE is deliberately conservative: an Appendix A PARTIAL/FAIL/UNTESTED/BLOCKED item remains NOT CODED until its complete implementation and callers are inspected. Existing partial implementations are preserved; this audit does not claim they are absent. Qualification-only items retain a separate harness coding obligation; they cannot satisfy the final declaration until that harness is BUILDS. Historical 77 RUNTIME VERIFIED entries above are unchanged.

| ID | Class | Coding state | Batch / remaining proof |
|---|---|---|---|
| 3 | CODE | NOT CODED | C10 |
| 7 | STANDING | STANDING | Every gate |
| 8 | STANDING | STANDING | Every gate |
| 10 | CODE | NOT CODED | C0/C10 |
| 13 | CODE | NOT CODED | C10 |
| 16 | STANDING | STANDING | Every gate |
| 23 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness NOT CODED | Q; harness audit in C10, owner-directed run deferred |
| 28 | CODE | NOT CODED | C3 offering coded, C6/C10 execution ladder |
| 29 | CODE | NOT CODED | C3 offering coded, C6/C10 mechanism selection |
| 31 | CODE | BUILDS | C2, `ec44dd79` |
| 32 | CODE | BUILDS | C2, `ec44dd79` |
| 33 | CODE | BUILDS | C2, `ec44dd79` |
| 34 | CODE | BUILDS | C2, `ec44dd79` |
| 35 | CODE | BUILDS | C2, `ec44dd79` |
| 37 | CODE | NOT CODED | C10, explicit receipt dispositions |
| 38 | CODE | BUILDS | C2, `ec44dd79` |
| 40 | CODE | NOT CODED | C10 |
| 44 | CODE | BUILDS | C4, `e2f7053e` |
| 45 | CODE | BUILDS | C4, `e2f7053e` |
| 46 | CODE | NOT CODED | C3/C10 |
| 48 | CODE | NOT CODED | C3/C10 |
| 49 | CODE | NOT CODED | C3/C10 |
| 50 | CODE | NOT CODED | C3/C10 |
| 51 | CODE | NOT CODED | C3/C10 |
| 52 | CODE | NOT CODED | C3/C10 |
| 54 | CODE | NOT CODED | C3/C10 |
| 55 | CODE | NOT CODED | C3/C10 |
| 56 | CODE | NOT CODED | C3/C10 |
| 57 | CODE | NOT CODED | C3/C10 |
| 58 | CODE | NOT CODED | C6 |
| 59 | CODE | NOT CODED | C6 |
| 60 | CODE | NOT CODED | C3/C10 |
| 61 | CODE | NOT CODED | C7/C9 |
| 62 | CODE | NOT CODED | C6 |
| 63 | CODE | NOT CODED | C3/C10 |
| 65 | CODE | NOT CODED | C10 |
| 66 | CODE | NOT CODED | C1/C7 |
| 67 | CODE | NOT CODED | C1/C7 |
| 68 | CODE | NOT CODED | C1/C7 |
| 69 | CODE | NOT CODED | C1/C7 |
| 70 | CODE | NOT CODED | C7/C9 |
| 71 | CODE | NOT CODED | C7/C9 |
| 72 | CODE | NOT CODED | C7/C9 |
| 73 | CODE | NOT CODED | C7/C9 |
| 74 | CODE | NOT CODED | C7/C9 |
| 75 | CODE | NOT CODED | C1/C7 |
| 76 | CODE | NOT CODED | C6 |
| 77 | CODE | NOT CODED | C7/C9 |
| 78 | CODE | NOT CODED | C7/C9 |
| 81 | CODE | NOT CODED | C10 |
| 82 | CODE | NOT CODED | C10 |
| 83 | CODE | NOT CODED | C3/C10 |
| 85 | CODE | NOT CODED | C3/C10 |
| 86 | CODE | NOT CODED | C3/C10 |
| 87 | CODE | NOT CODED | C3/C10 |
| 88 | CODE | NOT CODED | C10 |
| 90 | CODE | NOT CODED | C3/C10 |
| 91 | CODE | NOT CODED | C3/C10 |
| 92 | CODE | NOT CODED | C3/C10 |
| 96 | CODE | NOT CODED | C10 |
| 97 | CODE | BUILDS | C4, `e2f7053e` |
| 98 | CODE | NOT CODED | C4 |
| 99 | CODE | NOT CODED | C4 |
| 100 | CODE | NOT CODED | C4 |
| 101 | CODE | BUILDS | C4, `e2f7053e` |
| 103 | CODE | BUILDS | C4, `e2f7053e` |
| 104 | CODE | NOT CODED | C4 |
| 105 | CODE | BUILDS | C4, `e2f7053e` |
| 106 | CODE | BUILDS | C4, `e2f7053e` |
| 107 | CODE | BUILDS | C4, `e2f7053e` |
| 108 | CODE | BUILDS | C4, `e2f7053e` |
| 110 | CODE | NOT CODED | C4 |
| 111 | CODE | NOT CODED | C4 |
| 112 | CODE | NOT CODED | C4 |
| 113 | CODE | NOT CODED | C4 |
| 114 | CODE | BUILDS | C4, `e2f7053e` |
| 115 | CODE | BUILDS | C4, `e2f7053e` |
| 116 | CODE | BUILDS | C4, `e2f7053e` |
| 117 | CODE | BUILDS | C4, `e2f7053e` |
| 118 | CODE | BUILDS | C4, `e2f7053e` |
| 119 | CODE | NOT CODED | C4 |
| 120 | CODE | NOT CODED | C4 |
| 121 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness NOT CODED | RPC; harness audit in C10, owner-directed run deferred |
| 122 | CODE | NOT CODED | C6 |
| 123 | CODE | NOT CODED | C6 |
| 124 | CODE | NOT CODED | C6 |
| 125 | CODE | NOT CODED | C6 |
| 126 | CODE | NOT CODED | C6 |
| 127 | CODE | NOT CODED | C6 |
| 128 | CODE | NOT CODED | C6 |
| 129 | CODE | NOT CODED | C6 |
| 130 | CODE | NOT CODED | C6 |
| 131 | CODE | NOT CODED | C6 |
| 132 | CODE | NOT CODED | C6 |
| 133 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness NOT CODED | RPC; harness audit in C10, owner-directed run deferred |
| 134 | CODE | NOT CODED | C6 |
| 135 | CODE | NOT CODED | C6 |
| 138 | CODE | NOT CODED | C6 |
| 139 | CODE | NOT CODED | C6 |
| 140 | CODE | NOT CODED | C6 |
| 142 | CODE | NOT CODED | C6 |
| 143 | CODE | NOT CODED | C6 |
| 144 | CODE | NOT CODED | C6 |
| 146 | CODE | NOT CODED | C8 |
| 147 | CODE | NOT CODED | C8 |
| 148 | CODE | NOT CODED | C8 |
| 149 | CODE | NOT CODED | C8 |
| 150 | CODE | NOT CODED | C8 |
| 151 | CODE | NOT CODED | C8 |
| 152 | CODE | NOT CODED | C8 |
| 153 | CODE | NOT CODED | C8 |
| 155 | CODE | NOT CODED | C8 |
| 156 | CODE | NOT CODED | C8 |
| 157 | CODE | NOT CODED | C8 |
| 158 | CODE | NOT CODED | C8 |
| 159 | CODE | NOT CODED | C8 |
| 160 | CODE | NOT CODED | C8 |
| 161 | CODE | NOT CODED | C9 |
| 162 | CODE | NOT CODED | C9 |
| 163 | CODE | NOT CODED | C9 |
| 164 | CODE | NOT CODED | C9, backpressure and job ownership |
| 165 | CODE | NOT CODED | C9 |
| 166 | CODE | NOT CODED | C9 |
| 167 | CODE | NOT CODED | C9 |
| 168 | CODE | NOT CODED | C9 |
| 169 | CODE | NOT CODED | C9 |
| 170 | CODE | NOT CODED | C9 |
| 172 | CODE | NOT CODED | C9 |
| 175 | CODE | NOT CODED | C9 |
| 176 | CODE | NOT CODED | C9 |
| 177 | CODE | NOT CODED | C9 |
| 179 | CODE | NOT CODED | C9 |
| 180 | CODE | NOT CODED | C9 |
| 181 | CODE | NOT CODED | C9 |
| 182 | CODE | NOT CODED | C9 |
| 185 | CODE | NOT CODED | C5 |
| 186 | CODE | NOT CODED | C5 |
| 187 | CODE | NOT CODED | C5 |
| 188 | CODE | NOT CODED | C5 |
| 189 | CODE | NOT CODED | C5 |
| 190 | CODE | NOT CODED | C5 |
| 191 | CODE | NOT CODED | C10 |
| 192 | CODE | NOT CODED | C10 |
| 193 | CODE | NOT CODED | C10 |
| 194 | CODE | NOT CODED | C10 |
| 195 | CODE | NOT CODED | C10 |
| 197 | CODE | NOT CODED | C10 |
| 199 | CODE | NOT CODED | C10 |
| 200 | CODE | NOT CODED | C10 |
| 201 | CODE | NOT CODED | C10 |
| 202 | CODE | NOT CODED | C10 |
| 204 | CODE | NOT CODED | C10 |
| 205 | CODE | NOT CODED | C10 |
| 206 | STANDING | STANDING | Every gate |
| 207 | CODE | NOT CODED | C10 |
| 208 | CODE | NOT CODED | C10 |
| 209 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness NOT CODED | RPC; harness audit in C10, owner-directed run deferred |
| 210 | CODE | NOT CODED | C10 |
| 211 | CODE | NOT CODED | C1/C7 |
| 212 | CODE | NOT CODED | C9 |
| 214 | CODE | NOT CODED | C0/C10 |
| 215 | CODE | NOT CODED | C10 |
| 216 | CODE | NOT CODED | C10 |
| 217 | CODE | NOT CODED | C4 |
| 218 | CODE | NOT CODED | C10 |
| 219 | CODE | NOT CODED | C10 |
| 220 | CODE | NOT CODED | C10 |
| 221 | CODE | NOT CODED | C8 |
| 222 | CODE | NOT CODED | C9 |
| 223 | CODE | NOT CODED | C10 |
| 224 | CODE | NOT CODED | C10 |
| 226 | STANDING | STANDING | Every gate |
| 227 | STANDING | STANDING | Every gate |
| 228 | STANDING | STANDING | Every gate |
| 229 | STANDING | STANDING | Every gate |
| 230 | STANDING | STANDING | Every gate |
| 231 | STANDING | STANDING | Every gate |
| 232 | STANDING | STANDING | Every gate |
| 233 | STANDING | STANDING | Every gate |
| 235 | STANDING | STANDING | Every gate |
| 236 | CODE | NOT CODED | C0/C10 |
| 237 | CODE | NOT CODED | C0/C10 |
| 238 | CODE | NOT CODED | C0/C10 |
| 242 | STANDING | STANDING | Every gate |
| 243 | CODE | NOT CODED | W12 |
| 247 | STANDING | STANDING | Every gate |
| 255 | STANDING | STANDING | Every gate |
| 259 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness NOT CODED | COM; harness audit in C10, owner-directed run deferred |
| 264 | STANDING | STANDING | Every gate |

C0 totals: 167 CODE, 5 QUALIFICATION-ONLY, 17 STANDING = 189. No requirement text or runtime PASS has been promoted.

**C0 implementation — BUILDS at `8abf16ce2902b32616fa1cdc984ae90efd02ae9d`, [run 42072451664](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42072451664).** Corrected gate: formatting, types, compilation/imports, protocol, 124 TypeScript tests and 15 Python tests passed, zero skips. Run [42071854271](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42071854271) at `4baa797d318d715569513ad7e9d1547af7b1e751` passed formatting, types, all companion imports, protocol, 123 TypeScript tests and 15 Python tests. Log inspection found `rg: command not found` masked inside the migration predicate; that result does not establish the complete coding gate. The verified correction uses Git's own path comparison and propagates comparison failures. Its regression executes the actual workflow shell against disposable Git histories with docs, SQL, authority and DB-test changes, plus a missing-parent negative control. Entry point `push` on the implementation branch calls `coding-gate` in `.github/workflows/jarvis-cloud-validation.yml`. It checks formatting, TypeScript, Python compilation/imports, canonical protocol, no-hardcoded rules, existing security/contracts tests, and the shared runner's focused regressions. SQL/authority edits also call `test:jarvis-db`. Full matrix, package/bundle and live-evaluation workflows require manual dispatch. No qualification is started.

The existing `tests.run_required.main` loads selected modules/classes/methods or the discovered companion suite and calls `run_required`; all former workflow count pins call that same check. Its regressions cover added tests, missing selections, empty/incompletely executed suites, failures and exact skip allowlists. No existing tests or skip exceptions are removed.

**Candidate disposition:** the unpublished integrated repair is dropped. No candidate code is adopted and no candidate test result establishes published-branch functionality. glTF export, AXObserver, focus, verifier and harness gaps stay in C1/C6/C7/C10 until their implementations pass their own coding gates. Historical diagnostic runs remain historical, with candidate completion claims withdrawn.

**C1 verifier and fixture repair — BUILDS at `fdc5b21a72c54a29fe98e0d3e7fa544679b104aa`, [run 42073714126](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42073714126) (70–75, 197, 207, 211).** Formatting, types, imports/compilation, protocol, 124 TypeScript tests, 68 companion tests and 5 harness tests passed with no unexpected skips. No full requirement or runtime status is promoted by this defect slice; remaining deliverable semantics and harness coverage stay NOT CODED in C7/C10.

- D25: `verify.checks → _check → _script_runnable` validates the actual shebang executable, env argument semantics, supported syntax and complete byte budget. A file-supplied shell is never executed. Unknown interpreter syntax stays unobservable.
- Office false blocks: `verify.checks → _check → _parses` checks bounded ZIP CRCs and reopens DOCX/XLSX/PPTX through independent readers. Malformed packages fail; verification budget overruns remain unobservable.
- D28 truthfulness: `scene.render → media_worker._scene_render → scene_gl.render` checks WebGL draw/readback failures; `verify.checks → _check(scene_render)` rejects a uniform saved image even with valid project metadata. Actual Intel rendering remains qualification work; no Intel fix or PASS is claimed.
- D26: `live_eval.main → run_with_oracle → jarvis-live.mjs --oracle-checkpoint` runs the hidden oracle before STOP, with a private rendezvous and bounded acknowledgement. Missing checkpoints fail. `release_pick` serves real CRC-valid ZIP archives, supplies its fixture CA to checked transport and cleans up its server/certificate. No live task or campaign is run.
- Focused coding checks include every existing verifier, media and gateway test plus synthetic pre-STOP, package and interpreter negative controls. Current model integration is unchanged.

**C2 — BUILDS at `ec44dd79eaa09498afc6cb5835853de0149c5302`.** [GitHub Actions run 42217755830](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42217755830) passed format, types, Python compilation and imports, protocol, migration and rollback checks, 137 TypeScript tests and 30 focused Python tests.

- 31 — BUILDS — `advance → compileGoal → jarvis_set_outcome` stores ordered milestones, immutable check references and budgets. `advance → planStep → milestoneProgress` uses the saved objective, permissions, current milestone, observations and unresolved effects.
- 32 — BUILDS — `jarvis_task_state → advance` reloads the plan and checkpoint. `planStep → jarvis_complete_milestone` requires the current controller's exact independently observed proof. Signed claims without queued actions pick up the next phase. Completion requires the final whole-outcome verifier.
- 33 — BUILDS — `advance → planStep → jarvis_queue_actions` bounds each phase, limits read batches to the remaining budget, and replans after observed results. `followJobs` polls an already confirmed tracked job with a bounded cadence and budget, preserving the decisions needed to finish the milestone.
- 34 — BUILDS — `planStep → advance → jarvis_queue_actions → Agent.handle → Gateway.run` separates proposal, dispatch and execution. `Agent.handle → jarvis_submit_receipt → advance` records actual observations. The independent verifier, called through `verify.checks`, produces the proof used to advance or settle.
- 35 — BUILDS — `intent → jarvis_queue_actions` validates registry capability, target bindings, risk and deadline. `jarvis_claim_action → Agent.handle → Journal.start/finish → jarvis_submit_receipt` binds the unique action and task records to the device, controller and durable outcome.
- 38 — BUILDS — `Agent.handle → Journal.start/finish` records intent before effects and resends saved receipts after lost acknowledgements. `jarvis_complete_milestone → jarvis_task_state` persists the checkpoint across Take Over and Continue. Old controller proofs are rechecked and unresolved effects fence further work.
- 37 remains NOT CODED for C10. Execution receipts and outcome proof persist, but the customer-facing step result still needs explicit refused, failed, cancelled, unknown and verified dispositions.
- 164 remains NOT CODED for C9. Deterministic status reads, durable keys and retry limits are wired. Queue overload protection and safe job termination after a persisted process ID is reused still need work.
- Supabase CLI 2.122.0 generated the migration name in an unlinked runner workspace. The disposable database gate passed advisors, service role and scope checks, rollback and reapply. The signed companion integration verified two saved outputs, two milestone proofs and a final whole-outcome proof.
- Earlier coding runs accidentally executed the synthetic timing fixture. Its callback is now excluded at registration during coding CI. The green run confirms the exclusion. No timing scores qualify any requirement.

**C3 operation offering — BUILDS at `518820e9f8c5146475785a5a72cbe0893909065e`.** [GitHub Actions run 42218311835](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42218311835) passed the coding gate. `advance → planStep → offeredOperations` sends every built-in operation allowed by current grants and device engines to the existing model service. `planStep` resolves returned names against that same list before queueing. The existing provider test exercises the complete list and refusal of an unoffered operation. The remaining execution ladder and mechanism selection work for 28 and 29 stays in C6/C10.

**C4 dependency flow — BUILDS at `e2f7053ef87b0174622a18ddbcdbe85962499d90` for the reviewed portable runtime.** [GitHub Actions run 42221061081](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42221061081) passed format, types, protocol, database and authority checks, 138 TypeScript tests and 87 focused Python tests.

- 44 — BUILDS — Signed protocol headers → handleDeviceRequest, and Gateway._hold → MCP initialize/list_tools. Signed inventory gates the new operations on the reported dependency capability.
- 45 — BUILDS — handleDeviceRequest → Device.request → companion CLI returns upgrade instructions. A bundled worker mismatch pauses in planStep.
- 97 — BUILDS — planStep → system.dependency → command_worker.system_dependency identifies available and missing task prerequisites and returns a reviewed package when one is available.
- 101 — BUILDS — system_dependency → discovery.dependency_candidates discovers Python, Node.js, Java, .NET, FFmpeg, LibreOffice and browsers. Native library diagnosis remains tracked in 111.
- 103 — BUILDS — system_dependency → dependency_platform/dependency_proposal checks native architecture and OS support, then disk, user write permission and pinned source availability.
- 105 — BUILDS — dependency_proposal → system_install_dependency selects a reviewed vendor distribution with no model-controlled source or install command.
- 106 — BUILDS — system_install_dependency → _stage_dependency binds exact version, OS, architecture, source, SHA-256 and licence. verify_dependency independently checks published bytes and runtime.
- 107 — BUILDS — planStep → dependencyApproval and command_worker.system_install_dependency require exact observed metadata. Downloads use pinned HTTPS sources and never execute supplied commands.
- 108 — BUILDS — taskView → exactEffect shows the exact package, source, version, digest, scope, destination and privileges with startup implications before confirmation.
- 114 — BUILDS — planStep → jarvis_task_wait returns the exact diagnostic code and a safe Continue path when an installation or verification fails.
- 115 — BUILDS — Agent.handle → Journal.start/finish and system_install_dependency → _stage_dependency bound and stage the install. Retry preserves receipts and never repeats an uncertain effect.
- 116 — BUILDS — verify.dependency → verify_worker.verify_dependency → discovery.verify_dependency reopens the published executable and checks its integrity, startup, version and architecture.
- 117 — BUILDS — jarvis_submit_receipt → advance → planStep waits for the exact independent proof under current grants. Continue rechecks published work or re-inspects a definitely unapplied install.
- 118 — BUILDS — advance → jarvis_task_wait preserves original task state and the receipt on failure. A fresh controller resumes from inspection or independent verification.
- The reviewed install catalog covers Node.js x64 and ARM64 on Windows and macOS. Discovery returns manual setup when it has no approved package. None of these checks qualifies a consumer installation.
- 98, 99, 104, 119, 120 and 217 still need packaging, explicit bundled prerequisites and clean-machine harness coverage. 100, 110–113 still need broader installed-version and native diagnostic coverage. These remain NOT CODED.

**C5 updater and packaging — CODED for the signed activation path, coding gate pending.** `activate-update → companion_lock → _activate_release` verifies a release signature, platform, architecture, protocol, archive and extracted files, then starts every worker before selecting the new release. `run → _select_release` rechecks the active files and falls back to a previous valid release or the installed base. `rollback-update → _rollback_release` switches the pointer under the same lock. The Windows installer respects the live companion mutex. The existing package spec and frozen checker use the appropriate Windows and macOS bundle paths. The coding fixtures exercise invalid signatures, wrong architecture, unsafe archives, worker startup failure, active-lock refusal and rollback. Bundles and real-machine qualification remain manual.

**Coding batches (order by code dependency; continue past any blocked item):**

| Batch | Scope | Main owners |
|---|---|---|
| C0 | Classify all 189; coding-gate-only push CI; replace `testsRun` pins with one no-unexpected-skip check; merge or drop candidate `26ec426b` | `plan.md` Appendix E, `.github/workflows/*` |
| C1 | Verifier truthfulness: D25 interpreter check, D28 blank render, Office parse false blocks, D26 harness and fixture defects | `verify_worker.py`, `scene_gl.py`, `tests/jarvis/live_eval.py` |
| C2 | Long tasks: milestones with their own checks and step budget, durable milestone state, safe resume (31, 32, 38 and related) | `planner.server.ts`, `authority.server.ts`, `supervisor.ts`, a new migration with rollback |
| C3 | Operation offering: capability-filtered list replacing the TF-IDF shortlist (§27) | `planner.server.ts`, `contracts.ts` |
| C4 | Dependency manager: detect, propose exact package/source/version/hash/licence, confirm, install unelevated, journal, verify, resume (W9: 44–45, 97–120, 217) | `ocade_agent` (new operations through `contracts.ts`), authority permissions |
| C5 | Updater: integrity, staging, rollback, never during an action (185–190) | `packaging/*`, `ocade_agent` |
| C6 | Windows, macOS and browser gaps: packaged (UWP) apps, multi-monitor and DPI transforms, shadow DOM, popups (D29), D11, AXObserver (58–59, 122–135, 139–144) | `windows_worker.py`, `mac_worker.py`, `web_worker.py`, `discovery.py` |
| C7 | Deliverables and visual fallback still open (61, 70–78, 211) | `office_worker.py`, `media_worker.py`, `scene_gl.py`, `verify_worker.py` |
| C8 | Customer product: onboarding, every control wired, approvals, deliverables, voice within scope, PWA (146–160, 221) | `src/jarvis/*`, `src/routes/*`, `src/components/*` |
| C9 | Security, privacy, operations: headers/CSP/CSRF, export and deletion, rate limits, redaction, support and legal drafts, licence inventory (161–182, 212, 222) | web server, `supabase/*`, `docs/*` |
| C10 | Instrumentation and remaining code items: per-phase timing and token usage, evaluation harness code, stability harness (W1, W2, W4, W13 code items) | `authority.server.ts`, `planner.server.ts`, `tests/jarvis/*` |
| F | Integration and compilation fixes across all batches | all |
| W12 | Deep debloat, consolidation and naming | all |
| Q | Final compilation, full GitHub Actions qualification, then owner-directed model comparison and RPC | — |

**Coding-complete declaration (before W12, and again before Q):** go through all 266 IDs one by one and confirm each is BUILDS, RUNTIME VERIFIED, QUALIFICATION-ONLY with its harness code BUILDS, or STANDING. Any other state means coding is not complete: name the IDs and continue coding. Never report partial completion as complete.
