# OCADE — Claude Engineering Lessons, Root Causes, Planning Methods and Universal AI Instructions

**Consolidated learning document | 3 November 2026**  
**Source:** The connected Claude Code conversation beginning with *“OCADE — Finish Current Work, Full Engineering Audit & Elite Production Strategy”*, its subsequent architecture audit and engineering reports, and the later thinking/coding methodology responses already captured in this conversation.  
**Session:** [Claude Code](https://claude.ai/code/session_01Rz6RtTbYN31UKLZ7KVT71F)  
**Repository:** `BREVEX-CEO/caera-connect-plan`, branch `ocade/p00-p22-implementation`.

> **Source integrity:** This is a thematic, detailed consolidation—not a word-for-word transcript of every tool event. The connected browser showed a *Load later messages* boundary and some collapsed messages. The thinking/coding formulations below are drawn from the earlier Claude-derived texts captured in this conversation, whereas the final W0/W1/W2 status is from the last visible browser response. Any status is a **dated Claude report**, not independently re-tested here. Predictions, targets and disputed claims are labelled accordingly.

## 1. The central lesson

**The goal is not an AI that can click things. It is an agent that delivers correct, independently verified, editable outcomes without damaging the customer's work.** Claude repeatedly concluded that the existing fundamental architecture should be **repaired, connected and measured**, not rebuilt from scratch.

An effective OCADE should follow:

**Customer goal → Understand desired outcome → Discover exact available capabilities → Check authorization and exact target → Choose the fastest reliable method → Execute → Observe actual effect → Verify independently → Correct safely → Deliver evidence-backed result.**

For engineering OCADE itself, Claude's parallel lesson is:

**Know what success means → Inspect evidence → Fix the real shared cause with the smallest complete change → Test and independently prove the effect → Simplify → Record status → Continue.**

These loops are complementary. The first describes the **product's behavior**; the second describes the **developer/agent's workflow**.

## 2. Chronological evolution of Claude's recommendations

| Stage | What Claude reported or changed | Practical lesson |
|---|---|---|
| Finish-current-work instruction | Finish active fixes and tests, then stop coding and give an evidence-based engineering audit. | Freeze the active scope before starting new development. |
| Read-only audit, 2 Nov | Reported `10/100` readiness, `70/266` requirements PASS, `41/84` concepts PASS and red cloud CI at the audited commit `f04228d`. | A strict audit can reduce reported progress when earlier PASS claims lack evidence. |
| Audit of slow progress | Found major churn, all-or-nothing acceptance gates, free-model capacity constraints, cloud/PC waiting, five contradictory ledgers and shared-branch clashes. | Most time was being lost to workflow and integration, not raw computer-action time. |
| `plan.md` v3, `16654be` | Reorganized requirements and concepts, created work packages W0–W13, integrated continuous outcome evaluation and preserved original requirement text. | Order engineering by dependencies and measurable customer outcomes. |
| `plan.md` v4, `ef5cd6b` | Strengthened RTAA/RTVC ownership, performance targets, model accuracy, control methods, research dispositions and Codex handoff; updated architecture references. | Research is useful when it ends in explicit engineering decisions and tests. |
| `plan.md` v5, `6368c80` | Added durable engineering rules, reusable formulas, a self-contained task board, failure logging, quality gates and instructions for future agents. | A plan should tell the next coding agent **how to make correct progress**, not only what to build. |
| Later visible engineering report | Reported W0/W1 finished, W2 started; `20/100` readiness, `76/266` requirements PASS, `43/84` concepts PASS; see §16. | Finishing specific, verified work packages matters more than rewriting the plan again. |

**Version scores are assessments, not tested achievements.** Claude earlier rated the existing architecture near 72–74/100 and stronger proposed plans around 84–90/100. None of these planning scores establish real agent task success.

## 3. What was killing OCADE development — findings from Claude's audit

1. **Constant redesign:** Earlier implementations and plans were repeatedly replaced; Claude cited a particularly large deletion of the old engine on 30 October. This discarded work and forced repeated relearning.
2. **Wrong definition of done:** The older plan postponed measuring real customer tasks until nearly everything was complete. Thus development maximized internal checklists instead of improving actual task completion.
3. **Shared-branch conflicts:** Multiple agents changed overlapping files and pushed successive red test reproductions to one branch. Work could be superseded or CI cancelled before it finished.
4. **Repeated CI churn:** Cloud checks were frequently red; avoidable formatter errors triggered expensive full-suite reruns.
5. **Five competing progress records:** Requirement counts, architecture ledger, readiness gates and agent notes disagreed. Each session spent time reconciling them.
6. **Evidence/report bloat:** Claude reported roughly 339,000 lines of evidence in the repository at the audit snapshot. Large logs should usually be stored as CI artifacts instead of permanent source history.
7. **Provider limits:** The free Gemini project sometimes refused bursts of requests; Claude saw a 75% first-attempt result on the previous evaluation. A stronger plan cannot magically raise model capability.
8. **Delayed cloud-to-PC pickup:** Backoff polling could wait about 30 seconds before a new task was claimed.
9. **Too many unnecessary model calls:** Some routine observation and action choices were sent back to Gemini when deterministic local operations could be faster.
10. **Unverified consumer hardware:** Windows test results came from Windows Server runners; a Mac runner was not equivalent to qualified customer macOS hardware.
11. **Task operations missing or insufficiently healthy:** A broad label such as “files supported” did not always prove that the exact operation, runtime or dependency was ready.
12. **Execution/verification gaps:** Some checks could accept hidden website text, wrong acceptance criteria, stale permissions or insufficient read-back evidence.
13. **Unknown outcomes after interruptions:** Lost acknowledgements and interrupted writes need reconciliation before retry, or the agent could repeat a dangerous mutation.
14. **Overbroad launch requirements:** Windows, macOS, Linux, mobile, voice and very complex creative work competed for the same limited development capacity.
15. **Lack of one canonical defect register:** Bugs were scattered through prose and old reports instead of a small queue with cause, severity and proof.

### The one highest-leverage issue identified by Claude

At the earlier audit, Claude called the **all-or-nothing requirement that prohibited real-task evaluation until every architecture gate passed** the biggest process issue. This hid whether OCADE could satisfy customers, caused progress to be judged by internal tests alone and delayed discovery of accuracy limits. The proposed correction was to evaluate meaningful, hidden-answer real tasks **after relevant safety checks and at each milestone**, without weakening hard safety gates.

**Important qualification:** Fixing the release gate does **not** fix Gemini quotas, unknown effects, packaging, macOS compatibility or unsafe operations. Those remain separate issues.

### What was *not* established as the main problem

- **MCP/STDIO itself:** Claude reported persistent workers and very low local tool-execution time; rewriting the transport without measurements was not justified.
- **The runtime's size:** The audited runtime was comparatively lean. Code-size reduction alone was not the bottleneck.
- **Security testing:** Adversarial tests discovered actual serious faults. The lesson was to order and run tests efficiently, **not** to stop security testing.
- **A need for a completely new architecture:** Claude favored targeted integration fixes over a wholesale rebuild.

## 4. Quantitative snapshot and what the numbers mean

**Earlier read-only audit:**

- **Commercial readiness:** 10/100, with 90 points left.
- **Requirements:** 70 PASS / 159 PARTIAL / 14 FAIL / 5 BLOCKED / 18 UNTESTED = 266.
- **Architecture:** 41 PASS / 41 PARTIAL / 1 FAIL / 1 BLOCKED = 84.
- **Real Gemini tasks:** 27/36 first-attempt successes = 75%, measured on Linux/staging, not consumer PCs.
- **Timing:** approximately 56% model time, 6% active local computer execution, 3% user interaction and 34% unaccounted time in the cited sample. “Unaccounted” was not conclusively proved to be only network polling.
- **Task latency:** about 37 seconds median in the cited evaluation, with about six model calls median.
- **Launch decision:** NO-GO.

**Later visible Claude engineering report (the last response shown in the connected browser):**

- **Commercial readiness:** 20/100, with 80 points left.
- **Requirements:** 76/266 PASS, 190 not fully passed.
- **Concepts:** 43/84 PASS.
- **Known serious issues:** six high-severity defects still open and one mitigated, as Claude described.
- **M2 milestone earned:** core gateway/device authority, backed by the cited 8-job cloud run. It is **not** evidence of customer-PC qualification.
- **W0:** green baseline reported complete.
- **W1:** safety closure reported complete.
- **W2:** speed work in progress, not complete.

**Do not treat these historical figures as current unless the repository and test results have been checked again.**

## 5. What is already good and should be preserved

- One central task authority, with explicit permissions and task identity.
- Local-first execution: Gemini chooses the work; authorized customer-device components do the work.
- Existing MCP/STDIO gateway and persistent workers.
- Native/file/API operations first, then browser structure and accessibility, then vision as a fallback.
- Exact process/window/document targeting and stale-target refusal.
- STOP/Take Over that fences new operations and handles in-flight uncertainty.
- Durable journal, receipts and acknowledgement records.
- A separate independent verifier instead of trusting Gemini's claim that something completed.
- Reproducible build, installer and platform cloud tests where independently supported.
- A strict ban on hardcoded application lists, customer journeys and preprepared passing outputs.
- Tests that deliberately reproduce defects before fixes, when kept isolated from the shared green branch.

The core improvement is to **make these components cooperate through one enforced contract** rather than adding parallel systems.

## 6. What to change, add, remove and measure

### Keep and improve

- **RTAA — adaptive task planning:** Make decisions based on actual observations, use shorter context, batch safe reads, and avoid a model call for every trivial event.
- **RTVC — live visual and computer control:** Prefer structured UI trees, exact window/document IDs, events and native APIs. Use screenshots and coordinates only when structure does not expose the required control. Continuous “human-like video perception” is an aspiration, not a verified necessity for every task.
- **Gateway:** Keep persistent MCP workers, consolidate one authority, reduce idle waiting and preserve crash recovery.
- **Capability router:** A simple, measurable shortlist can be better than a speculative embeddings database when the available tool catalog is small.
- **Verifier:** Bind accepted success criteria to the user's actual request and independently inspect output contents, quality and safety.

### Add or complete

- Operation-level capability preflight, including missing dependencies and supported runtimes.
- Typed, direct file operations and bounded long-running job handling.
- Structured spreadsheet/document/table read-back and meaningful semantic checks.
- Idle-device notification / “nudge” rather than very expensive high-frequency polling.
- Task timing broken down into model, queue, claim, gateway, local action and verification.
- Permission revocation at dispatch time, exact-site browser request boundaries and negative tests.
- Unknown-effect resolution that asks the customer or obtains reliable independent evidence before any retry.
- Secure update and rollback, packaging and missing-dependency handling on both target OS platforms.
- Windows 10/11 and macOS qualification, plus real customer-device tests **only after separate approval**.
- Hidden-answer evaluation on representative unfamiliar tasks; professional document/spreadsheet/video/3D artifact verification.

### Remove or avoid

- Unnecessary rewrites of the whole architecture.
- Speculative vector databases, local AI models and additional supervisor layers without measured need.
- Duplicate gateways, agents, ownership systems and ledgers.
- Repeated screenshots or replanning loops when structured evidence is available.
- Hardcoded app-specific paths, fixed selectors, canned journeys or tests engineered to pass prebuilt examples.
- Blind retries, arbitrary sleeps that hide races and “command exited 0” as the sole success check.
- Large generated log/evidence blobs in Git history where CI artifacts suffice.
- Premature full-suite test runs when formatting, typecheck or focused regression is already failing.

## 7. Claude's two engineering formulas

### Formula A — Smallest verified root-cause change (for coding)

**Objective → Evidence → Root Cause → Smallest Complete Change → Proof → Simplify → Record → Next**

- **Objective:** Specify a testable result, not just an activity.
- **Evidence:** Read actual code, logs, test results and customer outputs.
- **Root Cause:** Find the shared reason that explains both failure and unaffected cases.
- **Smallest Complete Change:** Repair the current owner without speculative additions.
- **Proof:** Run focused checks and independently inspect the real result.
- **Simplify:** Remove only dead or redundant elements made unnecessary.
- **Record:** Save evidence, relevant decisions and a clear next step.
- **Next:** Work on the next dependency-ready incomplete item.

### Formula B — Stronger thinking/decision method (for any AI task)

**Frame → Ground → Crux → Options → Attack → Decide → Act Small → Verify Independently → Record**

- **Frame:** What is the real objective, and what would make the answer wrong?
- **Ground:** What is supported by evidence, and what is an assumption?
- **Crux:** Which one or two uncertainties would actually change the outcome?
- **Options:** Compare at least two different approaches, including “change nothing/remove something” where relevant.
- **Attack:** Look for evidence that would disprove the preferred option; run a pre-mortem.
- **Decide:** Choose by correctness, risk, cost, reversibility and maintenance.
- **Act Small:** Make a focused, complete and reversible change where possible.
- **Verify Independently:** Use a distinct test or read-back, not a repetition of the original assertion.
- **Record:** Keep status, evidence and residual uncertainty available to the next agent.

**Use Formula B to choose the approach; Formula A to implement it.** Neither is a mathematical guarantee of success.

## 8. Coding workflow Claude recommended

**Understand → Locate → Reproduce → Design → Implement → Check → Simplify → Prove → Commit**

| Step | Engineering behavior | Failure it prevents |
|---|---|---|
| Understand | Translate the request into observable acceptance; define scope. | Building the wrong thing. |
| Locate | Find the existing module, callers, ownership and tests. | Duplicate implementation. |
| Reproduce | Write a focused failing test or verify the actual missing behavior. | Fixing an imaginary or wrong cause. |
| Design | Compare reuse, standard library, platform and minimal new code. | Overengineering and dependencies. |
| Implement | Small explicit code, correct target, explicit errors. | Large risky changes. |
| Check | Format → type/lint → focused tests → neighboring integration tests → full matrix at gate. | Unnecessary CI churn and regressions. |
| Simplify | Remove newly redundant code only after parity evidence. | Debloat that breaks behavior. |
| Prove | Inspect actual file, database row, GUI state or result separately. | False PASS claims. |
| Commit | Commit a coherent verified change with its tests and evidence. | Untraceable work and hard-to-resume sessions. |

### Reusable principles, correctly applied

- **KISS:** Fewest moving parts that actually satisfy acceptance; not permission to omit safety.
- **YAGNI:** Implement requirements that are needed now, not speculative future mechanisms; do not omit essential validation.
- **DRY:** Keep one source for each rule or contract; do not combine unrelated modules just because code resembles itself.
- **SOLID / separation of concerns:** One clear owner for state, permissions and responsibilities; no empty layers or gratuitous factories.
- **Measure before optimizing:** Prioritize the actual largest latency, not attractive microbenchmarks.
- **Regression first:** When fixing a confirmed bug, prove it fails before the fix and passes after.
- **Risk-weighted testing:** Focused checks for every change, broader integrated tests when the scope justifies them.
- **No arbitrary code-size targets:** Shorter code is only better when correct, maintainable and complete.
- **No infinite loops:** Repeated failed approaches require re-diagnosis, a new hypothesis or a visible blocker.

## 9. Universal `plan.md` structure from Claude

**The point of the plan is that a fresh agent can find the next task and its acceptance conditions quickly, without reading every historical research report.**

```markdown
# <Project> — Plan

## 0. Quick start
- Objective:
- Verified current status, date and commit:
- Next work item ID and title:
- First files, checks and evidence to read:

## 1. Objective and success criteria
- User outcome:
- Independently testable acceptance criteria:
- Out of scope:

## 2. Fixed decisions and constraints
| ID | Decision | Reason | Evidence required to reconsider |

## 3. Current verified state
| Fact | Evidence | Date/SHA |
- Unknowns and how to check them:

## 4. Architecture and ownership
| Component | Sole responsibility | Must never do |
- Invariants and security boundaries:

## 5. Work board — the one canonical ledger
| ID | Title | Depends on | Status | Acceptance | Evidence |
- Status: NOT STARTED / IMPLEMENTED / TESTED / VERIFIED / DONE / PARTIAL / BLOCKED

## 6. Work items — self-contained
### <ID> — <Title>
- Problem:
- Confirmed evidence:
- Expected customer outcome:
- Constraints and non-goals:
- Existing owner/files:
- Simplest justified approach:
- Rejected alternative and reason:
- Tests:
- Independent acceptance proof:
- Dependencies and next work item:

## 7. Working rules
- Inspect → Reproduce → Fix root cause → Focused test → Broader checks
  → Independent proof → Simplify → Commit → Update board → Next.
- No fake PASS, weakened tests, unauthorized mutations or duplicate ledgers.

## 8. Verification and release gates
| Gate | When required | Observable pass condition | Evidence |

## 9. Decision log
- Date, decision, evidence, rejected options, reversal trigger.

## 10. Failure/defect log
| ID | Severity | Symptom | Hypotheses/results | State | Owner |

## 11. Requirement traceability
| Requirement ID | Text/source | Status | Work item | Evidence |
```

**Scaling:** A tiny bug fix does not need every section. A commercial product does. One work board is better than five conflicting ledgers. A plan should be actionable, not merely longer.

## 10. Claude's permanent thinking prompt (captured from earlier response)

> This is an original, reusable instruction pattern—not Claude's confidential hidden system prompt or private internal reasoning.

```text
You are a rigorous problem solver. Optimise for being correct, not for sounding confident or agreeable.

Frame: Restate the real goal in one sentence and define what a correct answer must satisfy. Ask: "What would make my answer wrong?" If the request is ambiguous in a way that changes the answer, ask one precise question. Otherwise state your assumption and proceed.

Ground: Separate what you know from evidence (files, output, docs, data the user gave) from what you infer or assume. Never present an inference as a fact. Check claims about code, APIs, versions and numbers against a source before relying on them.

Find the crux: Identify the one or two uncertainties that most affect the answer. Spend effort there, not evenly.

Generate alternatives: Before choosing, produce at least two genuinely different approaches. Include the simplest one, and "change nothing / remove something" where relevant. Compare them on correctness, risk, cost, reversibility and maintenance.

Try to break your favourite: Run a pre-mortem ("this failed — why?"). Look for disconfirming evidence and check the conditions under which the idea stops working.

Decide: Choose the strongest surviving option, state why, and identify what evidence would reverse your choice.

Verify independently: Check using a different mechanism than the one that produced the result. If you cannot verify something, label it as unverified.

Report calibrated: Lead with the result, evidence, assumptions and remaining uncertainty. Disagree with a weak plan when a better alternative is supported.

Stop analysing when the next piece of information would not change the decision. Never invent results, sources or completed work.
```

## 11. All-in-one universal coding-agent prompt (Claude-derived, reusable)

Use the block below as a **single project-level instruction**, not in addition to duplicates of the same rules. It applies to general coding tasks; OCADE-specific branch, security and approval rules still belong in the project.

```text
ROLE: You are a principal engineer and rigorous problem solver. Optimise for correct, verified, maintainable results — not agreement, speed of reply or volume of output.

THINK
- Frame the real goal and an acceptance test another person could perform. Ask what would make the conclusion wrong; resolve only meaningful ambiguity.
- Ground important claims in real code, logs, tests, measurements or documentation. Distinguish verified facts, inference and assumption.
- Identify the crux: the uncertainty most likely to change the decision.
- Compare genuinely different approaches, including reuse, removal and the simplest option.
- Attack your preferred approach: predict failure modes and seek disconfirming evidence.
- Decide using correctness, risk, cost, reversibility and maintenance; document what would change the decision.
- Do not blindly agree with the user's proposed means if a better, justified method achieves the goal.

BUILD
- Inspect the existing owner, callers and tests before changing code.
- Reproduce the defect or prove the desired behavior is missing.
- Fix the shared root cause with the smallest complete change; reuse before introducing another component.
- Apply KISS, YAGNI and DRY carefully. Keep responsibilities separated and security checks intact.
- Use clear names, direct control flow, explicit errors and proper trust-boundary validation.
- Check format, types/lint, focused tests, sibling/integration tests and full CI at the appropriate milestone.
- Independently check the actual effect, not just exit codes or an AI message.
- Simplify only what is proven redundant. Measure before optimizing.

TRACK
- Keep one authoritative plan and progress ledger. Work the first dependency-ready incomplete item.
- Distinguish NOT STARTED, IMPLEMENTED, TESTED, VERIFIED, DONE, PARTIAL and BLOCKED.
- DONE means objective acceptance, independent verification, no new critical/high defects and evidence recorded.
- Log failed hypotheses and their results; do not repeat identical failed experiments. Reconsider the model of the problem after repeated failures.
- Leave coherent commits and the exact next action so another session can resume.

NEVER
- Invent results, references, passing tests or finished work.
- Weaken or delete tests merely to make CI green.
- Bypass authorization or security boundaries, or blindly repeat uncertain destructive effects.
- Rewrite functioning components without evidence that focused changes cannot satisfy requirements.

REPORT
- State what changed, what independently passed, what remains unverified, genuine blockers and the next action. Be concise.
```

**Caution:** The original Claude method also mentioned heuristic defaults such as “abstract on the third real use” and “rethink after two failed approaches.” Treat those as guidelines rather than universal laws; a safety-critical case may require a different threshold.

## 12. Independent thinking and self-challenge rules

- **Separate goal from proposed implementation.** The user's desired result matters more than their first suggested tool.
- **Steelman, then attack.** Explain the strongest version of a proposed design before identifying a reproducible weakness.
- **Compare real alternatives.** Maintain current design, make a focused repair, reduce scope of the implementation, or redesign only where evidence warrants it.
- **Challenge without reflexive disagreement.** Disagree when the source or experiment supports it; otherwise state uncertainty.
- **Use a pre-mortem.** What broke, which assumption was wrong, and what test would expose it?
- **Reversal triggers.** Record evidence that would reopen an architecture decision; otherwise stop relitigating it.
- **Scale the process to the task.** Three-line changes do not require 20-page design documents.
- **Different verification route.** A model checking its own story may repeat the same error; use actual read-backs, independent tests, human review where necessary.
- **Avoid generic role-play fluff.** “Think harder,” “elite engineer,” and “100% unbeatable” are weaker than clear tests, error definitions and evidence.
- **No universal guarantee.** Requirements can be ambiguous, external systems change, tests sample behavior and models can be wrong.

## 13. How to structure engineering for fast progress

1. Use a single coding owner/integrator for changes to shared components and contracts.
2. Keep the implementation branch green; put deliberate red-first reproductions on isolated work branches where possible.
3. Before pushing, run formatting and focused checks; only then spend full cross-platform CI resources.
4. Never fix an error by hardcoding a passing file, selector, application name or answer.
5. Tag every task by dependency and acceptance criterion; start with the highest-leverage ready item.
6. Separate safety-critical work from optional product polish and prototype ideas.
7. Measure actual provider calls and latency before changing the model or transport.
8. Use the cheapest safe native operation; avoid synthetic UI clicking if an app supports a direct API/file operation.
9. Maintain exact task/device/window/file/browser identities throughout execution.
10. Use durable receipts and journaled effects; uncertain work remains uncertain until reconciled.
11. Report **code exists**, **test passed**, **real customer task passed** and **customer device qualified** as separate states.
12. Store large logs in build artifacts, not in source history.
13. Avoid plan rewrites unless new evidence materially changes direction.
14. After a failed experiment, change the hypothesis, not merely the timeout.
15. Mark external limits honestly; lack of Windows/macOS hardware, provider quota and code-signing cannot be erased by a prompt.

## 14. Performance goals that Claude proposed (not achieved by the plan)

| Measure | Cited baseline | Proposed target |
|---|---|---|
| Idle task pickup | Up to roughly 30–31 seconds | p95 ≤ 3 seconds after secure nudge/notification |
| Local action dispatch | Needed instrumentation | Milliseconds to a few hundred milliseconds for suitable local operations |
| Model calls per simple task | About six median | About four or fewer median |
| Median complete task | About 37 seconds | Roughly 25 seconds or better on a comparable task set |
| Unaccounted task time | About 34% | ≤ 10%, after correct instrumentation |
| First-attempt success | 75% on earlier task suite | ≥ 90%, aiming higher only with independent evidence |
| Complex cinematic/3D work | Not fully qualified | Correct, editable outputs with real engine/render and independent checks |

**Millisecond-scale local control is not millisecond-scale Gemini reasoning or full 3D/video production.** Real customers need truthful end-to-end performance numbers.

## 15. Claude's planning versus the owner's final constraints

The **earlier audit** recommended a smaller Windows-first paid pilot, a stronger paid Gemini tier, multiple coding agents and early customer testing to reach revenue faster.

The **owner's later decisions** differ and take precedence:

- Windows 10/11 **and** macOS are mandatory engineering targets.
- Linux is optional.
- Free infrastructure/model capacity only; no unapproved spending.
- One coding agent, not competing agents on the same branch.
- Full coding and applicable cloud qualification before requesting personal-PC testing.
- Commercial onboarding/payments/deployment only with later approval.
- All original 266 requirements and 84 concepts remain traceable, with honest evidence statuses.

Thus the historical Windows-first paid recommendation must be treated as **an alternative Claude proposed**, not as approval to change OCADE scope. One-agent, free-only completion may take longer; no one can promise a completion date or zero failures.

## 16. Last visible Claude response — exactly what it accomplished

**The latest browser-visible report said:**

- **W0 completed:** The previously failing safety, source-formatting and database checks were repaired; the cloud test matrix was reported passing.
- **W1 completed:** Unknown-effect confirmation, request-bound verifier checks, protection against overwriting newer user edits, device-unreachable reporting and additional browser-request checks were added or strengthened.
- **Specific safety repairs:** File/media workers were restricted to the named source; browser redirects/popups were prevented from crossing authorized site bounds; web verification stopped accepting hidden text; revoked task authorization and STOP/receipt races were corrected.
- **Readiness increased:** `10/100 → 20/100`, `70/266 → 76/266` requirements PASS, `41/84 → 43/84` concepts PASS, as *reported by Claude*.
- **Evidence:** Cloud run [78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177), all eight jobs reported green, with records under `evidence/2026-11-02-recovery/`.
- **W2 started:** Device polling while executing an active task improved to about 0.5 seconds, with timing added for claim delays and unattributed time. This does **not** mean idle task pickup is now 0.5 seconds.
- **W2 unfinished:** Secure idle wake-up/nudge, a ≥30-task timing suite, worker prewarming and large-payload handling.
- **Known remaining issues:** Playwright fetch/redirect boundary uncertainty, a possible Chromium helper-process leak on Windows, migration rollbacks not all written, certain requirements deliberately PARTIAL and remaining platform/model/provider qualification.
- **Conflict:** Another coding agent was pushing overlapping fixes, and Claude warned that this violates the owner's one-agent decision.
- **Not done:** No merge to `main`, no deployment, no expenditure, no secret rotation.
- **Next intended work:** Continue W2 with idle nudge and timing suite; that next work was **not shown completed** in the visible response.

### Why Claude stopped or appears paused

The visible conversation **does not state a definite technical reason for stopping after the W2 update**. The interface reports that the session is not running and that a new message is needed to resume. The final update says *“Next I'll continue W2”* rather than claiming completion or reporting a crash. Earlier user instructions explicitly asked Claude to finish current work and stop coding for an audit, but the final W2 message by itself does not establish that this same instruction caused the later pause. Do not assume quota exhaustion or a code error without a corresponding message.

## 17. Best combined daily workflow

**For a new decision:** Frame → Ground → Crux → Compare → Attack → Decide.  
**For implementation:** Objective → Evidence → Root Cause → Smallest Complete Change → Proof → Simplify → Record → Next.  
**For each defect:** Reproduce → Differentiate hypotheses → Fix shared cause → Regression check → Independent effect check.  
**For every feature:** Requirement → Acceptance → Owner → Minimal design → Implementation → Relevant tests → Verified outcome.  
**For every session:** Read quick start → Pick dependency-ready item → Work → Record evidence → Update one ledger → Leave an exact next action.  
**For release:** Green platform checks + real task qualification + correct STOP/recovery + security + installation + owner approvals.

### The highest-value permanent rules

**Do not rewrite good architecture without evidence. Do not pretend a plan proves software. Do not overbuild. Do not hardcode customer journeys. Do not mark an unverified outcome as done. Do not repeat an uncertain destructive action. Do not hide failed tests. Do not confuse cloud testing with consumer-machine qualification.**

---

## Appendix — Source checkpoints

- [Claude Code session](https://claude.ai/code/session_01Rz6RtTbYN31UKLZ7KVT71F) — visible audit, v3 plan rewrite and later W0/W1/W2 summary.
- [Audit-era cloud run 70](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41434622666) — source of earlier red-head findings.
- [Later cloud run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177) — Claude's cited green-matrix evidence for W0/W1/M2.
- `plan.md` history: `16654be` (v3), `ef5cd6b` (v4), `6368c80` (v5) as previously discussed in this conversation.
- `docs/research/UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md` and `docs/research/OCADE_complete_heading_and_concept_index.md` — Claude's research reference material.

**Final qualification:** This document consolidates Claude's stated observations and engineering methods, not a fresh independent repository audit. Values and completion claims should be rechecked against the currently selected branch commit and cloud runs before any launch decision.
