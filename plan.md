ALWAYS REPLY LIKE A CAVEMAN: Routine chat/status output must be ONE LINE, maximum TWO WORDS total; final outputs and complete reports may be detailed.

# OCADE BY CARCC — Complete Product, JARVIS & Windows/macOS PC Control Master Plan (v9)

**LATEST OWNER SCOPE, 15 NOVEMBER 2026:** Complete the whole OCADE product before real-task benchmarking: (1) JARVIS/PC control, (2) Online Chat/model integrations, (3) Offline Chat/download/offline website, plus settings, customer accounts, safety, all site UI/UX, Help/FAQ/terms/privacy and production workflows. Integrate the five source repositories' useful patterns, the 72-entry trace ledger and the 34 UX principles in Parts 14A–14B. The prior JARVIS-only and two-model-only implementation scope is superseded, but the two-model 16-run historical test remains the initial model comparison. The earlier plan and legacy traceability appendices are preserved for historical reference; this is DOCUMENTATION only, not evidence that coding or benchmark tests passed.

## Part 0. How to read this plan

0.1. This file is the single active authority for the COMPLETE OCADE product's engineering and production-readiness gates. JARVIS is the first coding priority; Online Chat and Offline Chat are subsequent required stages. Earlier JARVIS-only exclusions are overridden by Parts 14A and 14B. The preserved v7 plan lives in `docs/archive/plan-v7-2026-11-14.md`; relevant historical records and existing traceability IDs remain accessible. Where another document disagrees on JARVIS implementation, this plan wins and the disagreement is recorded in Part 21.

0.2. Every statement of status carries one of four evidence labels:
- **VERIFIED** means someone read the code, ran the command or fetched the primary source, and the location is cited.
- **LEDGER** means an earlier session recorded it with evidence, and it has not been re-checked since.
- **HYPOTHESIS** means it is consistent with the evidence but not yet proven.
- **UNKNOWN** means nobody has checked it yet.

0.3. Plain-language explanations appear after the words "In plain terms". They are written for a non-technical reader and never replace the engineering requirement next to them.

0.4. No section of this plan claims that OCADE is ready for public commercial launch. Part 20 defines exactly when that claim may be made.

## Part 1. What OCADE is and what success means

1.1. OCADE BY CARCC is an autonomous computer-control agent. A customer describes a result once on the OCADE website. OCADE then plans and carries out the work on the customer's own Windows or macOS computer, checks the result independently and delivers editable files.

In plain terms: the customer says what they want done; OCADE does it on their own computer and proves it really happened before saying "done".

1.2. The website is the customer's unified interface for JARVIS PC control, Online Chat, Offline Chat, task entry, account access, device pairing, permissions, progress, receipts, files, usage, settings and support. A small native companion on Windows/macOS performs authorized computer operations, remains visible while active and can always be stopped.

1.3. The engineering priorities, in order, are unchanged from plan v7:
1. correct completion;
2. safety;
3. fast response;
4. accuracy;
5. reliable recovery;
6. universality based on capabilities, not on named applications;
7. professional editable output;
8. a simple customer experience;
9. efficient use of resources;
10. maintainability.

1.4. Product success is unchanged. It requires all of the following:
- at least 90 percent independently verified first-attempt success on a hidden-answer task suite, with 95 percent as the ambition;
- zero known critical safety defects;
- no fabricated results;
- the speed targets of Part 15;
- qualification on real Windows 10, Windows 11 and macOS computers.

## Part 2. Current state, stated honestly (14 November 2026, branch head `3a8e567b`)

2.1. **Decision.** JARVIS is NOT READY for public commercial release. No launch date is inferred. Finish all mandatory coding and green GitHub coding/build gates first, then complete the authorized cloud-computer and real-device benchmark campaigns, repair failures and meet every release condition before any controlled beta or public launch.

2.2. **No real benchmark task has passed yet.**
- The owner's two-model comparison has 0 of 16 new runs done.
- The four historical rounds scored 0 of 24 (LEDGER, old plan section 19.4).
- The broad E1 campaign scored 27 of 48 tasks, which is 56 percent (LEDGER).
- The release requirement is 90 percent.

2.3. **The model loop is the bottleneck, not the computer control** (VERIFIED in the 8 November review and in source).
- In round 4, device actions returned in milliseconds, while model turns took 10 to 140 seconds.
- Each planning turn sends about 15,000 input tokens: about 7,900 for the offered operations (measured on 14 November with the real operation registry), about 1,200 for instructions, and up to about 6,000 for history.
- Gemma 4 31B's free tier allows 16,000 input tokens per minute per project (VERIFIED from staging quota logs, 38 refusals naming `GenerateContentInputTokensPerModelPerMinute-FreeTier = 16000`).
- So OCADE can make about one Gemma turn per minute.

In plain terms: OCADE spends almost all of its time waiting for the AI. The AI is slow mostly because OCADE sends it far too much text every time it asks a question.

2.4. **The model is never forced to answer with an action** (VERIFIED, `src/lib/intelligence/edge-handler.ts` lines 501 to 513). The request has no `toolConfig`, so the model may reply in prose. OCADE then spends another turn asking again (`src/lib/jarvis/planner.server.ts` lines 1389 to 1392).

2.5. **The action descriptions sent to the model are simplified in a way that loses rules** (VERIFIED, `providerSchema()` in `planner.server.ts` lines 412 to 433). The server still validates every action fully afterwards, so this is not a safety hole. It causes avoidable invalid proposals and extra turns.

2.6. **Model data-handling boundary.** JARVIS observes the customer's computer, so customer data must only be sent to provider configurations explicitly permitted for that data and region, with approved access, user authorization, and controlled retention. Measure actual provider limits and model capabilities; do not expose confidential observations to an unapproved service.

2.7. **The production Supabase project cannot run JARVIS** (VERIFIED with the Supabase tools on 14 November). It contains only the `ocade-intelligence` function (version 14). The planner's server door, `ocade-intelligence-service`, and the benchmark function exist only on the staging project.



2.10. **Complete OCADE readiness is not yet independently re-scored on this commit.** Prior historical launch-score evidence must not be presented as a current product-wide score; recheck site, chat, installer, companion, security, online/offline and real-device gates.

2.11. **The coding gate is red on the branch head** (VERIFIED). `npm run format:check` fails on `tools/source-research/README.md`. Everything else passed in this session:
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm run jarvis:protocol-check` and `npm run jarvis:no-hardcoded`.
- 205 of 206 security and contract tests; the one failure was environmental, because the container lacked the Python `playwright` package.
- 29 JARVIS TypeScript tests, with 9 environment-dependent skips.
- 250 companion Python tests with no assertion failures; four import errors came from the missing test-only `reportlab` package, which CI installs.

2.12. **Requirements and concepts** (LEDGER):
- 77 of 266 requirements are runtime-verified.
- 142 are coded and build.
- 25 can only be proven at qualification.
- 20 are standing rules.
- 2 optional Linux items are not coded.
- 44 of the 84 architecture concepts pass; concept 84 (zero known critical defects) fails.

2.13. **PC companion state.** A session-only tray lifecycle has not been demonstrated (historical source review). Hosted-runner and real Windows/macOS qualification must distinguish simulated passes from actual working desktop behavior.

## Part 3. Fixed owner decisions (unchanged wording kept in Appendix A; conflicts listed in Part 21)

3.1. **O1.** Windows 10, Windows 11 and macOS are mandatory. Linux is optional and never blocks release.

3.2. **O2 and O14, superseded in adapter scope by latest owner instruction.** Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) and Gemma 4 31B (`gemma-4-31b-it`) remain the **two original benchmark baseline models**, each used alone for the seeded 16-run comparison. Runtime code must become UNIVERSAL/provider-agnostic and able to register additional explicitly authorized models and multiple healthy server-side key slots. No untested model, secret, automatic cross-model failover or quota circumvention is authorized. See Parts 14A.4 and 14B.1.

3.3. **O3.** No paid infrastructure, purchases or unapproved spending. See conflict C1 in Part 21.

3.4. **O4.** One coding agent remains the default coding authority; separate from the new owner-mandated RUNTIME multi-agent planning/delegation design. Multiple runtime agents may reason on independent subtasks only under one authoritative computer mutation controller, scoped permissions, STOP, and independent verification.

3.5. **O5.** Cloud-first qualification before any test on the owner's physical computer, which needs separate approval.

3.6. **O6.** Public deployment only after engineering completion, real-device qualification and owner authorization.

3.7. **O7.** Keep all 266 requirements, all 84 concepts and every research concept traced.

3.8. **O8.** No hardcoded applications, customer journeys, selectors, files, coordinates, commands or answers.

3.9. **O9.** One task authority with explicit permissions, real STOP and real Take Over.

3.10. **O10.** Never fabricate tests, benchmarks or completed work.

3.11. **O11.** No `main` merge, deployment, secret changes, credential exposure or weakened security without explicit owner approval.

3.12. **O12.** Free non-deploying GitHub Actions on this branch are approved. CI stays secrets-free and never contacts production, except protected-environment runs the owner approves one by one. No scheduled automations.

3.13. **O13 — coding first (owner update 15 November 2026).** Complete ALL mandatory coding for the ENTIRE OCADE WEBSITE (JARVIS first, Online Chat second, Offline Chat third), server/backend, device companion, five-repository integration, multi-agent, universal model adapters, UI/UX, settings, security, Help and policy content, integration, compilation, security regressions and deep debloating. Every required GitHub Actions coding/build/check job must be green on the identical candidate commit before beginning the comprehensive cloud-computer benchmark campaign. Focused tests must run during coding. If later benchmarks uncover a defect, reopen the coding stage, fix it and restore the complete green gate before rerunning the task.

3.14. **O15 and O16, with updated test-repair autonomy.** Four seeded tasks × two independently selected permitted models × Windows/macOS = 16 mandatory comparisons. Begin only after 100% coding/build gates are green and the protected cloud test environment is legitimately authorized. Once an authorized test scope, credentials, cost ceiling and environment are approved, routine NON-DESTRUCTIVE code fixes and reruns inside that scope require no new discretionary owner approval; platform-required protected-environment approvals, additional cost, deployment, physical-device access, elevated permissions, live payments and other sensitive operations still require the proper authorization. Never bypass required approval controls.

3.15. **Prior owner decisions recorded on 14 November 2026, as modified by Parts 14A–14B on 15 November 2026.** All remain binding except where the newer complete-product scope and model/runtime-agent policies explicitly supersede them:
- No separate browser extension; zero budget for it.
- Docker only on developer, CI and hosted infrastructure, never required on customer computers.
- The website is the sole customer interface.
- The companion is visible, tray-controlled, session-based by default and always stoppable.
- Pairing without repeated email verification, while keeping secure authentication and revocation.
- Usage caps lifted for testing accounts, while provider limits, budgets and safety still apply.
- New explanatory plan sections should use points and sentences, not new tables; legacy machine-readable Appendix A–E tables remain required for existing parsers.

## Part 4. Engineering operating contract (carried over from plan v7 sections 4 to 11, wording kept)

4.1. The engineering formula is: **objective, evidence, root cause, smallest complete change, proof, simplify, record, next.** Each stage must be met before the next one starts. For example, no fix is written before the failure is reproduced or the missing behaviour is demonstrated.

4.2. The twenty universal engineering rules of plan v7 section 5 remain in force verbatim. They are carried over as a numbered list in Appendix F of the new file. Each rule keeps its purpose, when it applies, how to apply it, how to verify it and the common mistake to avoid.

4.3. The OCADE operating rules of plan v7 section 6 remain verbatim: mindset, architecture, code, testing, performance, security and progress.

4.4. The coding loop, failure and resumption rules, no-overengineering rules, architecture-change rules and owner-approval rules of plan v7 sections 7 to 11 remain verbatim.

## Part 5. Architecture (frozen spine kept; additions explained)

5.1. **The spine stays as it is** (VERIFIED by source reading).
- The customer's request goes to one task authority in Supabase. It owns permissions, the STOP epoch, the journal, timing and settlement.
- The server-side planner (RTAA, in `src/lib/jarvis/planner.server.ts` and `supervisor.ts`) asks the model for the next action or a short guarded list.
- The device's gateway and workers carry the actions out with exact targets (RTVC, in `device-agent/windows/ocade_agent/`).
- A separate verifier process checks the result from independent evidence (`verify_worker.py`).

In plain terms: one part decides what is allowed, one part suggests the next move, one part does it on the computer, and a separate part checks the work. None of them can overrule the others.

5.2. **The safety invariants stay without exception:**
- Every side effect is bound to the account, device, task, permission grant, exact target, confirmation, idempotency key, STOP epoch and deadline. It is re-checked on the server and on the device just before the effect.
- STOP works locally even when the network or the model is unavailable.
- An effect whose outcome is unknown is never repeated automatically.
- Originals are preserved, and later user edits are never overwritten.
- Content from files, websites and apps never grants authority.

5.3. **Execution preference order** (concept 25, kept and confirmed by the owner on 14 November):
1. object models and file formats;
2. operating-system interfaces and scripts;
3. browser DOM through Playwright;
4. accessibility trees (Windows UI Automation, macOS Accessibility);
5. screenshot-based vision, last, with exact target verification before every click.

In plain terms: OCADE first tries the most reliable and fastest way to do something, such as editing a spreadsheet file directly. It only "looks at the screen and clicks" when nothing better works, and even then it double-checks that it is clicking the right window.

5.4. **Website-first companion design** (new; replaces nothing):
- (a) **Session mode is the default.** The website's "Start session" button opens the companion through an operating-system link scheme that the installer registers. The link only wakes the companion. All authority still comes from the device's signed request to the server, so a forged link cannot make the companion do anything.
- (b) While a session or task is active, a tray icon shows the state and offers STOP, Take Over and End session. On Windows it uses `Shell_NotifyIcon` through pywin32, which is already a dependency of `windows_worker.py`. On macOS it uses `NSStatusItem` through pyobjc, which is already used by `mac_worker.py`. So no new dependency is needed.
- (c) The companion exits safely when the task and any long jobs it started have ended and an idle period has passed. It reaps every worker and browser process it started.
- (d) **Always-ready mode** keeps the tray icon running for faster pickup. It needs explicit consent and can be switched off at any time.
- (e) Active computer control is never hidden.

In plain terms: the helper program appears only while it is working, shows a small icon with a stop button, and goes away afterwards unless the customer asks it to stay ready.

5.5. **Pairing without repeated email** (new):
- The installer opens the website in the browser, where the customer is already signed in.
- The website shows a short one-time code bound to that signed-in session.
- The companion sends its device public key together with the code to the existing enrolment door (`device-agent/windows/ocade_agent/device.py` line 142 and `src/routes/api/jarvis.device.ts`).
- The device is then registered under the account.
- Revoking it in the Devices page fences it immediately (concept 66).
- No new authentication system is added.



5.7. **Docker boundary** (new, owner instruction):
- Docker and development containers may be used for development, CI builds, tests and hosted test infrastructure only.
- The customer companion is a frozen native bundle with its runtimes included (W9), and never requires Docker.
- The production website and backend (Cloudflare Workers and Supabase) never depend on the founder's computer.

5.8. **Browser automation without an extension** (owner decision of 14 November):
- OCADE keeps its own dedicated Playwright browser profile, which persists across tasks.
- The customer signs in to sites in that window once, and completes multi-factor and CAPTCHA steps personally.
- The earlier proposal of a browser extension for the customer's own signed-in browser is withdrawn.
- Copying the customer's real browser profile is rejected, because it would expose cookies and passwords and conflict with security rule G7 of plan v7.

## Part 6. The 84 architecture concepts: understanding and use

6.1. The 84 concepts are capabilities and properties of one system, not 84 separate steps to run on every task. The planner offers only the operations a task needs (requirement R-104 in Part 8). Most concepts are enforced by the spine without any per-task choice.

6.2. The full verbatim list of the 84 concepts, with status, destination, build instruction and mandatory proof, is carried over in Appendix B as a numbered list.

6.3. **Decision for each concept.**

6.3.1. **Keep unchanged.** These are verified as passing and sound: 3, 4, 5, 7, 9, 10, 13, 22, 24, 25, 26, 27, 30, 37, 38, 39, 40, 41, 42, 43, 44, 47, 52, 53, 54, 55, 56, 60, 61, 63, 64, 66, 69, 70, 73, 74, 77, 81 and 82.

6.3.2. **Improve with code.** These are partly built; the named work completes them:

| Concepts | Work |
|---|---|
| 1, 2, 6, 8 | Task contract and context: families chosen at goal time; smaller history |
| 11, 12 | Discovery: hosted-runner proof |
| 18, 19, 20, 21 | Planning loop: postcondition guards; recovery hints |
| 28 | Windows inspection: cached UI Automation search |
| 29 | macOS: accessibility for Electron and Chromium apps; scrolling |
| 31 | Persistent dedicated browser profile proof |
| 32, 33, 34, 35 | Targeting, display and foreground: hosted-runner proof |
| 36 | Visual fallback: confidence tests |
| 45, 46 | External tools: schema size and depth limits |
| 48 | Communication-latency measurement |
| 49 | Guarded batches with postconditions |
| 50, 51 | Locks and scheduling: parallel independent milestones |
| 57, 58, 59 | STOP, interference and revalidation: hosted and real-device proof |
| 62 | Restricted Windows token for commands |
| 65, 68 | Signed agent and installer: updater; clean install and uninstall |
| 67 | Grants: an inspect permission separate from control, an owner decision |
| 71, 72 | Deliverables and outcome-first UI: journey audit |
| 75, 76 | Verifier: workbook error scan, image and table checks |
| 78 | Benchmarks |
| 80 | Adversarial tests |
| 83 | Intervention metrics |

6.3.3. **Mechanism replaced, concept kept.** Concepts 14, 15, 17 and 23 (tool routing and filtering): the lexical shortlist and the size-only schema deferral are replaced by operation families chosen at goal time (Part 10, item 10.3). The pre-registered reversal trigger in plan v7 section 27 already fired: held-out recall was 97.1 percent, below the 98 percent target.

6.3.4. **Merged.**
- Concept 16 (vectorised domain blueprints) merges into the existing experience precedent (C9, `precedent()` in `planner.server.ts` lines 917 to 922) and the later verified-route replay. It stays deterministic, with no vector database, as plan v7 section 14 requires.
- Concepts 19 and 49 become one guarded-batch mechanism with postconditions.

6.3.5. **Proven only at qualification.** Concepts 79 and 84, and the proof parts of 54 and 83.

## Part 7. Model selection: Gemma 4 31B versus Gemini 3.5 Flash-Lite

7.1. **Measured facts about Gemma 4 31B** (VERIFIED in the 8 November review from staging logs and run artifacts):
- planning turns of 10 to 140 seconds;
- a first byte often later than 25 seconds;
- 10 HTTP 500 "internal error" responses and one HTTP 503 "high demand";
- 6 to 8 broken streams;
- 51 refusals of the thinking-level setting (Gemma does not accept it);
- 37 quota refusals at 16,000 input tokens per minute;
- text-only answers without a function call;
- no paid tier on the Gemini API.

7.2. **Facts about Gemini 3.5 Flash-Lite.**
- It is the currently configured Standard default (`src/lib/intelligence/online-models.ts` line 4).
- **No equal-conditions benchmark against Gemma has been run** (the 16 runs are pending), so its task success, latency and tool-calling reliability are UNKNOWN for OCADE's workload.

7.3. **Initial benchmark recommendation only** (subject to measurement and future universal-provider capability tests):
- Start the original 16-run comparison with **Gemini 3.5 Flash-Lite and Gemma 4 31B**, then select the best independently qualified default; this does NOT hardcode OCADE around one provider or prevent separately qualified models.
- Reasons:
  - Gemma's measured failure rate and latency are far from the targets.
  - Gemma must not process customer computer data until its provider configuration and data-handling permissions have been verified for the intended users.
- Gemma stays a permitted evaluation model under O2.
- If the 16 runs show Flash-Lite failing where Gemma succeeds, the decision is reopened with that evidence.

In plain terms: Gemma's practical speed, reliability and suitability for customer data still need independent verification. Compare both models fairly.

7.4. **How to make either model much faster and more capable on long tasks.** These are the levers, all inside the existing architecture.
- 7.4.1. Cut every planning turn from about 15,000 to about 4,000 input tokens (Part 10, items 10.3 and 10.4). The model must read the whole prompt before it starts answering, so shorter prompts mean faster first replies and more turns within the per-minute quota.
- 7.4.2. Force a function call (Part 10, item 10.1), so no turn is wasted on prose.
- 7.4.3. Send complete action rules (Part 10, item 10.2), so fewer proposals are refused.
- 7.4.4. Let one model turn plan several safe steps, each with a postcondition the device checks itself (Part 10, item 10.9). The model is then asked again only when something unexpected happens.
- 7.4.5. Keep long work (renders, exports, installs) as device jobs that are polled without model calls. This already exists as `job.*`, with job following in `supervisor.ts`.
- 7.4.6. Keep the asynchronous planning queue that already exists (commit `58693894`: planning turns run after the device's answer, in a queue consumer). Make sure every turn finishes well inside the 150-second Edge Function limit, which becomes much easier once prompts are four times smaller.
- 7.4.7. **Adaptive thinking.** Record per model whether it accepts a thinking setting. Use the lowest setting that keeps accuracy, measured by an A/B test on deterministic local planner fixtures. Gemma already refuses the setting, so it should never be sent to Gemma again after the first refusal on a deployment. That requires the durable capability record, item 10.8.
- 7.4.8. **Checkpoints.** Milestones already persist progress (`milestoneProgress` in `supervisor.ts`). Multi-hour tasks are split into milestones of at most 30 steps each, and every milestone is verified before the next one starts.
- 7.4.9. **Structured observations.**
  - Inspections return only what changed after the first look.
  - Web pages return controls without long prose unless the text is requested.
  - Windows inspection uses one cached query instead of hundreds of small calls.
- 7.4.10. **A faster Gemma variant**, as a HYPOTHESIS and owner decision. The "High" mode already uses `gemma-4-26b-a4b-it` on Cloudflare Workers AI (`online-models.ts` line 5). It is a mixture-of-experts model that uses about 4 billion parameters per token, so it is likely much faster than the dense 31B model. Using it as a planner is not allowed under O2 today, and its free daily allocation and data terms must be checked first.

7.5. **The three Gemini API keys.**
- The owner reports three keys in three separate Google Cloud projects.
- The Supabase tools available to Claude can list functions and run read-only database queries. They cannot and must not read secret values.
- The keys, quotas and project configuration are therefore UNKNOWN from this session. The staging function logs held no provider events in the last 24 hours.
- The safe verification is `npm run model:availability` (`scripts/model-availability.ts`). It reads provider model metadata per key slot without printing keys. It runs inside a protected GitHub Actions environment that the owner approves once, and its output is recorded in `evidence/`.
- The keys are credentials for separate projects. They must never be rotated to escape a project-wide quota refusal (plan v7 rule G9).

## Part 8. The 120 owner requirements, reconciled

8.1. **How they relate to the existing lists.**
- The owner's 120 requirements are a customer-level summary. Most of them map onto the existing 266 requirements and 84 concepts.
- Each item below says what it maps to, its status, the remaining gap and where the work is done.
- Requirements 1 to 101 were supplied as grouped summaries. The exact original wording of items 72 to 73 and 86 to 87 is not in the repository and must be supplied by the owner, so that nothing is lost (conflict C9).

8.2. **Intelligence and autonomy, requirements 1 to 12.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 1 | Planning | PARTIAL | Goal-time families, postcondition guards (Part 10) |
| 2 | Efficient AI calls | FAILING (VERIFIED by the token measurement) | Turns cut to about 4,000 tokens |
| 3 | Tool calling | DEFECT (VERIFIED) | Forced function calls |
| 4 | Complete schemas | DEFECT (VERIFIED) | Full JSON Schema |
| 5 | Prompt optimisation | PARTIAL | Stable prompt prefix, smaller history, deterministic planner fixtures |
| 6 | Guarded action batching | PARTIAL (VERIFIED: batches stop on failure but carry no postconditions) | Postconditions |
| 7 | Autonomous error recovery | PARTIAL | Refusal hints and fault-injection tests |
| 8 | Long-running tasks | CODED | Proof on hosted Windows and macOS |
| 9 | Specialised agents | OWNER OVERRIDE — REQUIRED | Mandatory bounded runtime multi-agent specialists under one authoritative desktop mutation controller (Parts 14A.4, 14B.1); preserve STOP and independent verification |
| 10 | Verified skills and MCP tools | PARTIAL | Schema limits now; verified-route replay later |
| 11 | Model qualification | Harness NOT IMPLEMENTED (LEDGER, requirement 23) | Build the harness |
| 12 | Capability fallback | Passes at the route level (LEDGER) | Durable per-model capability record |

8.3. **PC control, requirements 13 to 25.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 13 | Windows | PARTIAL | Cached inspection, scrolling, hosted proof |
| 14 | macOS | PARTIAL | Electron/Chromium accessibility, scrolling, change events |
| 15 | Browser automation | PARTIAL | Accessibility-snapshot observation, defect D11 |
| 16 | Visual control | PARTIAL | Confidence tests |
| 17 | Exact window targeting | PARTIAL | Wrong-window suite on both systems |
| 18 | STOP | PARTIAL (gates: stop PARTIAL) | Mid-batch STOP tests, real-device proof |
| 19 | Take Over | PARTIAL | Resume reconciliation test |
| 20 | Complete approvals | UNKNOWN, owner reports truncation | Approval text never truncated |
| 21 | File protection | PASSES (LEDGER) | — |
| 22 | Installers | FAILING (gates: 0 of 4) | Clean install, upgrade, rollback, uninstall |
| 23 | Device pairing | Secure today (LEDGER) | No-email flow of Part 5.5 |
| 24 | Resource management | PARTIAL | Idle CPU and memory measured |
| 25 | Failure containment | PARTIAL | Restricted Windows token for commands |

8.4. **Customer experience, requirements 26 to 34.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 26 | Website controls | PARTIAL | Run the existing surface audit on every control |
| 27 | Authentication | PASSES (LEDGER) | Custom outgoing mail server for reliable sign-in emails |
| 28 | Onboarding | PARTIAL | First task completed without help |
| 29 | JARVIS workspace | PARTIAL | Planned-steps panel |
| 30 | Progress | PARTIAL | Shows real receipts |
| 31 | Editable deliverables | PARTIAL | glTF export, defect D19 |
| 32 | Interrupted-session recovery | Passes at the authority level (LEDGER) | Browser-reload test |
| 33 | Accessibility | UNKNOWN | Automated accessibility audit with no serious findings |
| 34 | Localisation | UNKNOWN | English first; another language only after owner approval |

8.5. **Out-of-scope historical IDs 35–40 and 42; retained engineering obligations 41 and 43.**

The original exact text for out-of-scope IDs is preserved in `docs/archive/plan-v7-2026-11-14.md`. Do not implement or count these deferred IDs as required JARVIS coding. Retain their identifiers so the 266-ID historical ledger remains traceable.

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 35 | Out-of-scope historical ID | EXCLUDED | None in this JARVIS-only release |
| 36 | Out-of-scope historical ID | EXCLUDED | None in this JARVIS-only release |
| 37 | Out-of-scope historical ID | EXCLUDED | None in this JARVIS-only release |
| 38 | Out-of-scope historical ID | EXCLUDED | None in this JARVIS-only release |
| 39 | Out-of-scope historical ID | EXCLUDED | None in this JARVIS-only release |
| 40 | Out-of-scope historical ID | EXCLUDED | None in this JARVIS-only release |
| 41 | AI resource controls | REQUIRED | Budget limits, quota protection, per-account rate controls and secure model access |
| 42 | Out-of-scope historical ID | EXCLUDED | None in this JARVIS-only release |
| 43 | Supported model/data geography | REQUIRED | Confirm provider policy and lawful data handling for test/customer traffic |

8.6. **Security and operations, requirements 44 to 51.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 44 | Security testing | PARTIAL | Server-side request forgery decoding, cross-account and injection tests |
| 45 | Credential isolation | PASSES (LEDGER) | Secret canary in CI |
| 46 | Backups | PARTIAL | Paid Supabase plan for backups, restore drill |
| 47 | Monitoring | PARTIAL | Alerts on errors, quota refusals and spending |
| 48 | Deferred policy-page drafting | EXCLUDED | No website policy-page drafting in JARVIS coding; retain privacy and security protections |
| 49 | Incident response | UNKNOWN | Runbook drill |
| 50 | Support | PARTIAL | End-to-end ticket test |
| 51 | Release safety | PARTIAL | Staged release and rollback |

8.7. **Engineering qualification, requirements 52 to 61.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 52 | Green CI | RED (VERIFIED formatting failure) | Fix |
| 53 | Integration tests | Green locally except the database suite, which needs PostgreSQL | Run the database suite |
| 54 | 90 percent first-attempt success | FAILING | — |
| 55 | Two-model qualification | 0 of 16 | — |
| 56 | E1 to E4 | E1 at 56 percent | — |
| 57 | Real Windows and macOS testing | BLOCKED on approval A2 | — |
| 58 | Complete customer workflows | PARTIAL | — |
| 59 | Debloating | NOT STARTED | — |
| 60 | Source-bound release evidence | PASSES (LEDGER) | — |
| 61 | Operational readiness | PARTIAL | — |

8.8. **Invisible PC companion, requirements 62 to 73.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 62 | Website-first operation | PARTIAL | Every control reachable from the website |
| 63 | One-time setup | PARTIAL | Installer finishes pairing in one flow |
| 64 | Dependency discovery and authorised preparation | CODED (LEDGER) | — |
| 65 | Very fast startup | UNKNOWN | Target: ready within 2 seconds of a cold start |
| 66 | Developer-side Docker only | Satisfied by design (VERIFIED: the companion has no Docker dependency) | Recorded in Part 5.7 |
| 67 | Temporary system tray | NOT CODED (VERIFIED) | Part 5.4 |
| 68 | No unnecessary desktop icons | UNKNOWN | Installer creates no desktop shortcut by default |
| 69 | Safe process cleanup | PARTIAL | — |
| 70 | Trusted reconnection | PARTIAL | Test after sleep and network loss |
| 71 | No repeated email verification for pairing | UNKNOWN | Part 5.5 |
| 72 | Unrestricted testing usage | Unlimited grants exist (VERIFIED: `Unlimited` in `entitlement-resolver.ts`) | Assign them to test accounts; provider budgets still apply |
| 73 | Usage within safety and infrastructure limits | Belongs with 72 | Global budget switch |

8.9. **Requirement IDs 74–87 are ACTIVE again under the latest owner instruction.** Offline Chat, local-model download, browser/app-shell offline operation, disconnected mode, persistent model integrity and readiness are mandatory code deliverables under Part 14B.2. The actual disconnected download-and-inference qualification is the FINAL stage of Part 17; original historical wording remains in the archived plan.

8.10. **Customer data and task controls, requirements 88 to 92.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 88 | Delete JARVIS local task data | PARTIAL | Clear JARVIS session records, temporary files, customer-approved companion workspace data and scoped device caches without removing unrelated customer data |
| 89 | Delete account | CODED (VERIFIED `erase.server.ts`) | Database test that no rows remain and devices and task authority are revoked |
| 90 | Complete customer lifecycle | — | End-to-end journey test |
| 91 | Out-of-scope historical ID | EXCLUDED | Original in v7 archive; retain computer-control consent and privacy safeguards |
| 92 | Minimal authentication friction | — | Part 5.5 |

8.11. **Testing and reliability, requirements 93 to 101.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 93 | Android offline browser qualification | ACTIVE CODING / QUALIFICATION | Implement Android offline website test harness before green gate; actual airplane-mode qualification is LAST benchmark stage under Part 14B.2 |
| 94 | All 236 research concepts evaluated | PASSES (LEDGER) | — |
| 95 | Windows/macOS PC-control qualification | QUALIFICATION | Hosted and actual desktop evidence required |
| 96 | Production evidence | QUALIFICATION | — |
| 97 | One-click offline setup | ACTIVE REQUIRED | Verified full model download, storage checks, offline-ready state and test harness coded before green gate; network-disconnect proof LAST in Part 17 |
| 98 | Resource management | — | Part 15 targets |
| 99 | Companion update integrity | PARTIAL | Updater missing |
| 100 | Real-device qualification | BLOCKED on A2 | — |
| 101 | Transparent activity records | Timing passes (LEDGER) | Customer-visible receipts |

8.12. **New requirements, 102 to 120.**

| # | Requirement | How it is met |
|---|---|---|
| 102 | Windows and macOS mandatory, Linux optional | Equals O1 |
| 103 | Study and use all 84 concepts | Part 6 |
| 104 | Dynamic capability selection per task | Goal-time families, Part 10 item 10.3 |
| 105 | No hardcoding | Equals O8; checked by `npm run jarvis:no-hardcoded`, which passes (VERIFIED) |
| 106 | Native interfaces before DOM, accessibility and vision | Part 5.3 |
| 107 | Image understanding and visual fallback | Window previews with zoomed regions, plus confidence checks |
| 108 | One authoritative task controller | Equals O9 |
| 109 | Fewer model calls through safe batching and reusable verified operations | Part 10 item 10.9; Part 13 item 13.1 |
| 110 | Complex CAD, office, browser, coding and video work | Discovery plus scripted jobs, measured in benchmark tasks 3 and 4 |
| 111 | Docker only on developer infrastructure | Part 5.7 |
| 112 | Bundled native runtimes | W9 |
| 113 | Lightweight, temporary, removable companion | Part 5.4 and the uninstall test |
| 114 | No artificial caps during testing | Requirement 72 |
| 115 | Competitor benchmark | Part 16 |
| 116 | Optimise success, latency, interventions, calls, cost and recovery | Part 15 |
| 117 | Parallel independent work with serialised conflicting changes | Part 13 item 13.4 |
| 118 | Root-cause fixes with reruns | Part 4 |
| 119 | Complete PC-control coding before nonessential work | Execution order in Part 9 |
| 120 | Verifiable evidence for every mandatory requirement | The coding ledger records commit identifiers |

## Part 9. Execution order

9.1. **Strict coding-then-qualification order.** One coding authority completes P0 JARVIS safety/planning (Part 10), P1 Windows/macOS control (Part 11), P2 site/onboarding (Part 12), P3 advanced control/security (Part 13), mandatory 72-entry five-repository integration (Part 14A) and the WHOLE SITE features/security/UX in Part 14B. Finish P4 consolidation/debloating, code integration and complete GitHub CI on the same final SHA. Only after every applicable required item is CODED and all site/backend/Windows/macOS companion code/build/CI jobs are GREEN may real-task/cloud benchmarks start (Part 17 and Appendix H). Test failures reopen coding and require the same green gates again. Do not start benchmark campaigns merely because one package's isolated tests passed.

9.2. During coding, run focused tests, compile/typecheck/lint/format, protocol/security regressions, appropriate database tests and affected build checks after each change. Never postpone STOP, approval or wrong-target safety tests. **After EVERY commit, inspect its GitHub Actions checks and fix failing required gates at root cause; rerun until green. While runs are queued/in progress, work on the next independent coding batch without blocking, duplicating or conflicting with those checks. Never declare a running job green.** Require complete JARVIS and whole-site compilation/build CI to be green on the FINAL identical branch-head commit before any real-task/cloud benchmark. Owner approvals for sensitive operations remain binding.

9.3. **Task inventory:** The previous 43 numbered P0–P5 work-package items remain as historical baseline. New Parts 14A–14B add 72 architecture trace entries (overlaps expected), 34 UX heuristics, 16 key protections, 19 SaaS security checks and deduplicated customer/site work; these are new acceptance references and must be reconciled before calculating a unique executable task count. The 266 tracked requirements and 84 concepts remain separate; the original 16 model-comparison runs remain separate tests. Never claim `43` is the entire new work count or add overlapping counts as if they were unique features.

## Part 10. Package P0: safety, task correctness and AI execution (estimated four to six days of coding)

10.0. **Make the coding gate green and synchronise.**
- Problem: the branch head fails formatting.
- Fix: run Prettier on `tools/source-research/README.md`, or remove the research tooling under item 14.3.
- Fix: make CI install the Python `playwright` package where `tests/security/cloud-gates.test.ts` needs it.
- Acceptance: the full coding gate passes on the head commit.

In plain terms: fix the one broken automatic check so that every later change is tested from a clean starting point.

10.1. **Force a function call.**
- Root cause: section 2.4.
- Files: `src/lib/intelligence/edge-handler.ts` (function `providerBody`).
- Change: on the JARVIS surface, add `toolConfig.functionCallingConfig` with mode `ANY` and the list of offered function names. This is the documented Gemini setting, used the same way by the Vercel AI SDK in `packages/google/src/google-prepare-tools.ts` lines 289 to 309 (VERIFIED).
- Change: keep the existing correction turn only as a fallback for a model that refuses the setting.
- Tests: a unit test of the request body, then a staging probe with the owner's run approval. Acceptance: zero turns without a call in 20 probe turns per model.
- Risk: a model may reject the setting. The capability record (item 10.8) then switches back to automatic mode for that model only.

In plain terms: OCADE tells the AI it must always answer with a concrete action, so no question is wasted on a chatty reply.

10.2. **Send complete action rules.**
- Files: `planner.server.ts` (`providerSchema`) and `edge-handler.ts`.
- Change: send each operation's full JSON Schema in the `parametersJsonSchema` field. Only a constant value is converted into a one-value list.
- Change: keep the old simplified conversion only for a model that rejects the full schema with an HTTP 400 response.
- Tests: all 44 operation schemas survive the conversion; the probe accepts them.

10.3. **Offer only the needed families of operations.**
- Root cause: section 2.3.
- Files: `planner.server.ts` (`compileGoal`, `planStep` lines 1221 to 1235 and 1381 to 1388) and `supervisor.ts` (milestone plan schema).
- Change: the goal turn that already runs also returns the families of operations the task needs, chosen from the existing roles in `contracts.ts`.
- Change: step turns send full schemas only for those families and for operations the task has already used.
- Change: every other operation is still listed by name and one-line summary, and its schema is sent the moment the model asks for it. That mechanism already exists.
- Rejected alternative: a separate AI router. The goose project removed one because it cost an extra model call per request (VERIFIED, goose `documentation/static/files/thoughts/plans/2025-12-23-remove-tool-selection-strategy.raw`; the repository was cloned during research and is no longer stored locally).
- Acceptance: a committed measurement test shows that the offered-operation text for a typical task is at most 12,000 characters instead of 31,621.

In plain terms: instead of handing the AI the whole instruction manual on every question, OCADE hands it only the chapters the task needs, and the rest on request.

10.4. **Smaller history.**
- Files: `planner.server.ts` (function `history`), `device-agent/windows/ocade_agent/refs.py`, `windows_worker.py` and `mac_worker.py`.
- Change: lower the newest-observation budget from 16,000 to about 6,000 characters, and the total history budget from 24,000 to about 10,000.
- Change: after the first inspection of a window, `ui.inspect` returns only what changed unless the model asks for everything.
- Acceptance: a typical step turn is at most 4,000 input tokens and the worst case at most 8,000, measured by the committed script. The deterministic planner fixtures give the same decisions as before.

10.5. **Cost metering and budget protection.**
- Files: `planner.server.ts`, `edge-handler.ts` (usage is already read at lines 721 to 730), `src/lib/commercial/generation-gate.ts`, `supabase-ledger.ts`, and one migration.
- Change: charge usage in credits computed from the provider's measured token counts, instead of one unit per task.
- Change: add a daily cost ceiling per account.
- Change: add a global budget switch that queues new turns instead of spending past the owner's monthly budget.
- Acceptance: ledger totals match the provider's reported usage within one percent; the ceiling and the switch have tests.

In plain terms: OCADE keeps an exact running bill of what each task costs, so no customer and no bug can run up an unexpected expense.

10.6. **Gemma request shape.** The Vercel AI SDK moves the system instruction into the first user message for every Gemma model (VERIFIED, `google-model-catalog.ts` line 268 and `convert-to-google-messages.ts` lines 784 to 797). A probe decides whether OCADE must do the same. The result is recorded in the capability record.

10.7. **Two-model benchmark harness.**
- Files: `tests/jarvis/benchmark.py` and `.github/workflows/jarvis-staging-evaluation.yml`.
- Change: the harness takes the model identifier of one of the two allowed models and runs the sixteen-run matrix. The retired three-configuration matrix is deleted. This closes requirement 23's "not implemented" note.

10.8. **Durable per-model capability record.**
- Files: `edge-handler.ts`, which replaces the per-instance `withoutThinking` set, and one migration.
- Change: store, per model and per deployment, whether it accepts forced function calls, full schemas and thinking settings, and its measured token-per-minute limit. A value is learned once and lowered only on a provider refusal.
- This reverses the C12 deferral in plan v7 section 19.4, because forced calls and schemas now depend on it.

10.9. **Postcondition guards on batched steps.**
- Files: `src/lib/jarvis/contracts.ts`, `planner.server.ts` (lines 1439 to 1459), `device-agent/windows/ocade_agent/gateway.py` and the workers.
- Change: each batched step may carry an expected result: an element exists, a value equals, a window title contains, a file hash, or a page address. The device checks it after the step.
- Change: a miss cancels the remaining steps through the existing batch cancellation in migration `20261113120000`.
- Rules: at most one confirmed external effect per batch, always last.
- Acceptance: a test shows that a failing guard cancels the remaining steps, and that STOP in the middle of a batch fences them on hosted Windows and macOS.

In plain terms: the AI may plan a few safe steps at once, and the computer checks after each step that it worked before continuing. One mistake stops the rest automatically.

10.10. **Complete approval details.**
- Files: `src/jarvis/JarvisPanels.tsx` and the confirmation text in `src/lib/jarvis/authority.server.ts`.
- Change: show the exact command, target, file and site with their risk, never truncated. Long text scrolls instead.
- Acceptance: a test renders a 2,000-character command completely.

10.11. **Remove the retired Live and hybrid planner code.**
- Files: `src/lib/intelligence/live-session.ts` and its callers.
- Change: trace every caller and delete the code if no approved feature uses it.
- Acceptance: tests pass and no planner path references it.

10.12. **Safety regression set run on every safety-related change.** Wrong-window refusal, STOP during a network claim (defect D22's regression), STOP in the middle of a batch, unknown-effect handling, and permission revocation in the middle of a turn.

## Part 11. Package P1: complete companion, computer control, browser, installation and recovery (estimated one to two weeks)

11.1. **Windows inspection by cached query.**
- File: `windows_worker.py` (`ui_inspect`, line 285).
- Change: replace the depth-first walk of the first 150 elements with one UI Automation `FindAllBuildCache` call. It uses a cache request for name, control type, bounding rectangle and automation identifier, and a condition of enabled, not off-screen and a control element. This is the pattern used in Microsoft UFO's `ufo/automator/ui_control/inspector.py` lines 228 to 370 (VERIFIED).
- Change: report how many elements were cut off when a limit applies.
- Acceptance: `test_windows_ui.py` passes on the hosted Windows runners, with a median inspection time of at most 300 milliseconds on the fixtures.

11.2. **macOS accessibility for Electron and Chromium applications.**
- File: `mac_worker.py`.
- Change: set `AXManualAccessibility` on the application element, falling back to `AXEnhancedUserInterface`, and wait up to two seconds for the tree.
- Acceptance: a non-empty tree for VS Code or Chrome on the hosted macOS runner.

11.3. **Scrolling.**
- Files: `contracts.ts`, then the regenerated `protocol.json`, plus `windows_worker.py`, `mac_worker.py` and `web_worker.py`.
- Change: add `ui.scroll` and `web.scroll` as reversible operations, using the UI Automation scroll patterns, the macOS accessibility scroll actions and Playwright's scroll-into-view.
- Acceptance: a control below the visible area is reached in the fixtures.

11.4. **Web observation by accessibility snapshot.**
- File: `web_worker.py` (`_observe`, lines 565 to 624).
- Change: use Playwright's `page.aria_snapshot(mode="ai")` and `page.get_by_ref()`. Both exist in the pinned Playwright 1.64.1 (VERIFIED in Playwright's API documentation: aria snapshot since 1.59, get-by-ref since 1.64).
- Change: return controls only by default. Page text comes through `web.read` with a character limit and an optional filter, as OpenClaw does (VERIFIED, `extensions/browser/src/browser-tool-description.ts`).
- Keep: site binding, the rule that only the newest observation's references are valid, the refusal of secret fields, popup, dialog and permission reports, and the settle wait.
- Rollout: switch only after a measured comparison shows at least 40 percent fewer tokens with equal fixture success.

11.5. **Repair hints.** Each device refusal code (in `gateway.py` and the workers) gets one generic sentence naming the fix, so the model does not retry blindly.

11.6. **Tray icon and session mode.** Part 5.4, implemented in `device-agent/windows/ocade_agent/agent.py`. Acceptance:
- the tray appears only during a session or task;
- STOP from the tray fences effects within one second;
- the companion exits after the idle period with no orphaned processes (tested on both hosted systems).

11.7. **Pairing without repeated email.** Part 5.5. Acceptance: on the hosted runners, a fresh install reaches a paired, permitted device in under two minutes, with no email step.

11.8. **Installer, updater and uninstall.**
- Files: `device-agent/windows/packaging/*`, the macOS bundle scripts, and a new updater inside the agent.
- Change: integrity check, staging, rollback, and no update in the middle of an action.
- Acceptance: clean install, upgrade, rollback and uninstall pass on Windows Server 2022 and 2025 runners and on macOS 15.
- Disclosure: certificates are excluded. Unsigned Windows builds show the SmartScreen warning "Windows protected your PC", and unsigned macOS apps need "Open Anyway" in System Settings. Both are stated on the download page.

11.9. **Restricted Windows token** for `shell.run`, `job.*` and verifier re-runs, in `command_worker.py`. Based on the restricted-token design of OpenAI Codex's Windows sandbox (LEDGER from the blueprint; not re-read in this session).

11.10. **Recovery under failure.** Fault-injection tests:
- killing the companion in the middle of a step shows an unknown effect that is never repeated;
- a provider quota refusal queues the task and resumes it;
- a lost network reconnects;
- a device that sleeps resumes safely.

11.11. **Customer journey audit and fixes.**
- Run `tests/web/surface_audit.py` on every page and control.
- Fix dead controls, empty states, error and loading states, responsiveness and accessibility.
- Have a fresh test account complete the whole journey without help: landing page, registration, email verification, onboarding, download, install, pairing, permissions, first task, verified deliverable and continued use.
- Acceptance: zero dead controls, no serious accessibility findings, and a measured first verified task within five minutes of download.

## Part 12. Package P2: JARVIS website, account, device and data lifecycle (coding stage)

12.1. **Website-only JARVIS interaction.** Keep the customer's task entry, device list, exact consent/approval dialogs, execution timeline, STOP, Take Over, receipts and editable outputs inside the website. Reuse the existing components. Verify each JARVIS control and user state with automated interaction tests.

12.2. **Task and session lifecycle.** A fresh registered user can install the companion, pair without repeated email verification, authorize an exact task, start it from the website, inspect actual execution progress, stop it, resume through a safe revalidation, receive independently verified files, end the session and have the temporary companion exit. The workflow must recover appropriately from browser refresh, sleep and device reconnection.

12.3. **Customer data deletion.** A scoped delete-data request removes only JARVIS-owned local task artifacts and applicable server records after explicit confirmation. Account deletion revokes devices and closes authorized sessions. A test proves the absence of data that should have been deleted and never destroys unrelated user files. Existing lawful retention/security obligations are not waived.

12.4. **JARVIS permission, help and support experience.** Present exact task scope, device access, STOP, Take Over, permission changes and support information clearly. Maintain authorization evidence and meaningful privacy controls.

12.5. **Customer acceptance.** A fresh account on a clean, supported Windows or macOS machine completes a first authorized task end to end without developer assistance, with no dead controls, misleading status or unverified completion. Complete coding and focused tests now; final hosted/real-device qualification belongs to P5.

## Part 13. Package P3: advanced PC control, operations and security

13.1. **Verified-route replay.** A verified earlier task's step list, with its values as parameters, may be replayed as one guarded batch without model calls, falling back to normal planning at the first failed guard. Owner decision on O8 wording: the routes are learned from the customer's own verified runs, never hardcoded.

13.2. **Background accessibility actions.** UI Automation and macOS accessibility pattern actions on a leased background window while the person types elsewhere. This is an owner decision, because it changes the quiet rule of plan v7 section 13.

13.3. **"Teach a task" recorder.** The person demonstrates once; clicks are resolved to accessibility elements and passwords are redacted. Post-launch.

13.4. **Parallel independent milestones.** Milestones that touch disjoint windows, files or pages run in parallel under the same authority and locks.



13.6. **Operations:**
- backups using approved resources, with a timed restore drill;
- alerts on error rate, quota refusals and spending;
- support tickets tested end to end;
- an incident runbook drill;
- staged release and rollback.

13.7. **Security:**
- decode embedded IPv4 addresses in 6to4, NAT64 and Teredo IPv6 forms in `web_worker.py` lines 270 to 276;
- limit external tool schema size and depth in `catalog.py`;
- add a secret canary to CI;
- turn on leaked-password protection in Supabase Auth (VERIFIED: currently disabled, per the Supabase security advisor);
- as defence in depth, revoke public execute rights from security-definer functions that only the server calls. The advisor lists 36 such functions callable by signed-in users. Spot checks show that the critical ones call `private.ocade_owner_require` or a staff-permission check (VERIFIED for `ocade_revoke_unlimited` and eleven others). The remaining 24 must be checked one by one.



## Part 14. Package P4: completion, proof-based debloating and removals

14.1. Every coding item builds, and the database suite (`npm run test:jarvis-db`) passes on PostgreSQL.

14.2. Each removal names its traced callers, keeps every test green and records size, startup and memory before and after:
- the retired Live planner path;
- the lexical shortlist, once families replace it;
- the size-only schema deferral;
- the custom web control script, if item 11.4 wins its comparison;
- stale documents listed in `ToRemove.md`.

14.3. **Research-only assets.**
- The 243 `all-repos` submodules were removed in commit `3a8e567b` (VERIFIED).
- `tools/source-research/`, `tests/source-research/` and `evidence/source-research/` remain. They are not product code, they still describe the removed submodules, and `CLAUDE.md` still mentions them.
- Recommendation: move them to an archive branch and keep their findings in `docs/research/`. This is an owner decision.

14.4. **Never removed:** security checks, permissions, STOP and Take Over, recovery and journaling, independent verification, database compatibility, user data, or a useful test.

## Part 14A. Mandatory five-repository integration, advanced AI-agent architecture and pre-benchmark coding requirements (latest owner scope)

14A.0. **LATEST OWNER SCOPE OVERRIDE (15 November 2026).** OCADE now includes the ENTIRE website and product: JARVIS first, online chat second, offline chat/site/model third, accounts, settings, device companion, help, FAQ, user policy pages and customer workflows. This overrides the earlier JARVIS-only scope, exclusion of all chat work and the narrower model-adapter constraint. Original 266 requirement IDs, 84 architecture concepts, and machine-readable appendices remain intact; do not silently rewrite historical baseline evidence. Finish each mandatory scoped item to CODED and verified GREEN CI before beginning real-task/cloud benchmarks. The older plan paragraphs are historical wherever they conflict; owner override is explicit here.

14A.1. **Five source repositories and integration rules.**

1. **NousResearch Hermes Agent** — https://github.com/NousResearch/hermes-agent — constrained tool programs, delegation, skill learning, checkpointing and model-context efficiency.
2. **OpenClaw** — https://github.com/openclaw/openclaw — skill security, extension lifecycle, gateway trust, diagnosis and state recovery.
3. **trycua CUA** — https://github.com/trycua/cua — native computer drivers, action contracts, screen/element grounding, isolated testing and real-device verification.
4. **Microsoft UFO** — https://github.com/microsoft/UFO — application-aware task graphs, event-driven execution, Windows accessibility optimizations and dependency-aware coordination.
5. **n8n Nod** — https://github.com/n8n-io/nod — universal provider adapters, secure credentials, learned tasks, approvals, memory, scheduling and connected-app operation.

For each source item below, independently inspect actual upstream source, current version, dependencies, permissions, license/SPDX, model-weight licenses and target Windows/macOS support; identify matching OCADE code and choose **KEEP, IMPROVE, MERGE, ADD, REPLACE, VERIFY or DEFER**. Copy useful, legally compatible code when it is genuinely better, with attribution and license compliance. Never clone every framework into production or create competing task authorities. Each entry must have affected paths, implementation proof, negative tests, independent acceptance evidence, cost/latency comparison and a traceability disposition. Historical recommendations are NOT proof of a current deficiency. One mutation authority and prompt-injection/STOP/approval safeguards remain immutable.

**Catalog accounting:** 62 existing source-derived recommendation entries are preserved below; 10 separate Nod extensions are numbered 63–72. These are **72 tracked entries**, not necessarily 72 unique missing product features because Nodes 53–62 and 63–72 intentionally refine some of the same mechanisms. Maintain one engineering fix per actual gap, with multiple cross-references, avoiding duplicate implementations.

### 14A.2. Detailed five-repository source-integration ledger (items 1–62)

#### REPO-01. Bounded programmatic action batches (`H01`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE already provides guarded action batches, reportedly up to five steps, so this is an optimization rather than a missing executor.
- **What to add, build, improve or deliberately avoid:** Permit the planner to emit a bounded, inspectable operation program for repetitive read/calculate/write steps. Compile it into existing authorized actions; validate each argument, target and checkpoint; stop at the first unexpected effect. Measure against the existing five-action mechanism before adopting Hermes RPC mechanics.
- **Independent test / finished definition:** On 30 representative repeated workflows, compare p50/p95 time, model calls and first-attempt success to the existing path. Inject STOP, an altered file and a wrong-window event mid-batch; no unauthorized post-STOP effect may occur.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-02. Narrow RPC tool bridge (`H02`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has an existing gateway and worker dispatch; a second independent gateway would duplicate authority.
- **What to add, build, improve or deliberately avoid:** If programmatic execution genuinely helps, expose only a restricted callable interface into OCADE's existing task-authority layer. Enforce allowlists, per-action identity, typed inputs, maximum calls, deadlines, output limits and nonreplayable receipts. Never grant direct OS or secrets access to generated code.
- **Independent test / finished definition:** A generated batch cannot invoke a tool outside its approved manifest or work after cancellation. Audit logs name every inner effect and its parent task.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-03. Decision-preserving context compaction (`H03`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review says planner.server.ts already clips observations but retains relatively large state and context budgets; reducing characters alone can remove important facts.
- **What to add, build, improve or deliberately avoid:** Maintain concise objective, recent verified state, available actions, unresolved obligations, permissions and error summaries. Prune duplicate tool output and old screenshots, not authority constraints or task dependencies. Test token savings against unchanged correct decisions.
- **Independent test / finished definition:** Use a frozen decision-parity corpus with large, multilingual and multi-window tasks. Reject compaction that changes a correct target, permission decision or required action even if it is faster.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-04. Pre-mutation checkpoints (`H04`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **IMPROVE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE journals task effects; prior source review does not prove comprehensive checkpoints for every reversible multi-file operation.
- **What to add, build, improve or deliberately avoid:** Before high-impact editable-file changes, create a task-scoped snapshot or revision record, monitor available disk space and record a restore recipe. Checkpoints must be selective; a large media render must not trigger excessive full copies.
- **Independent test / finished definition:** Corrupt a spreadsheet, CAD assembly and video project in controlled tests. Restore only the agent's changes without erasing customer edits made afterward; external submissions are never blindly undone.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-05. Typed actionable recovery hints (`H05`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE already has generic recovery and refusal reasons; Hermes identifies narrower classes of execution faults.
- **What to add, build, improve or deliberately avoid:** Classify errors into recoverable vs uncertain-effect vs unrecoverable; attach an evidence-based recovery hint and required re-observation. For example, a missing application is different from a failed save with unknown state. Add only classes demonstrated in real logs.
- **Independent test / finished definition:** Replay real failures, recover without duplicate actions, and preserve unknown-effect quarantines. Test retry ceilings and that STOP overrides recovery.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-06. Verified reusable procedure learning (`H06`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **IMPROVE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE's precedent mechanism retrieves similar routes as advice; prior source review says it does not independently replay the prior procedure.
- **What to add, build, improve or deliberately avoid:** Create opt-in, parameterized recipes only after an external verifier validates output; store preconditions, app capability requirements, permissions, parameter placeholders and expiry conditions. Revalidate target observations on every use, rather than replaying recorded clicks.
- **Independent test / finished definition:** A recipe works across renamed files and changed window positions, fails safely if prerequisites differ and never reuses another customer's private observations.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-07. Parallel subagent delegation for independent thinking (`H07`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **EXPERIMENT** — **EXPERIMENT**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior research reference explicitly recommends rejecting additional AI agents now because a single authority and two planner models are the existing contract.
- **What to add, build, improve or deliberately avoid:** Record the owner's newly requested swarm option as an EXPERIMENT, not automatically enabled. Restrict initial delegates to read-only research, independent file inspection or benchmark diagnosis; merge results into one task authority. Compare against a single deterministic script and one planner; use the faster and more reliable implementation.
- **Independent test / finished definition:** Only permit production use after held-out benchmarks show a material win without doubled cost, conflicting edits, inflated latency or additional authorization risk. The controller must cancel all children upon STOP.
- **Adoption decision:** Explicit owner-requested experimental capability. Document the conflict with prior two-model/one-controller rules, run side-by-side tests and ask for the necessary model/security/scope approvals before production activation.

#### REPO-08. Remote and container execution backends (`H08`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **DEFER** — **DEFER**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Hermes supports remote tools, SSH and containers. OCADE already has a separate development/CI environment and a native customer companion.
- **What to add, build, improve or deliberately avoid:** Keep Docker and disposable VMs in developer/CI/cloud test environments. Add optional remote backend abstraction only for authorized tasks that need it; do not impose Docker, hypervisor or Linux installation on each customer.
- **Independent test / finished definition:** A clean Windows/macOS customer installs just the companion. CI can create a disposable test sandbox and prove that no customer device depends on its engine.
- **Adoption decision:** Keep the capability out of mandatory launch work unless independent customer need and benchmark data reverse the decision. Prefer eliminating its complexity over copying an unused subsystem.

#### REPO-09. Persistent provider capability knowledge (`H09`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **ADD** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** source-review evidence source inspection found rejected model parameters cached in an in-memory Map, so incompatibilities are rediscovered after process restarts.
- **What to add, build, improve or deliberately avoid:** Persist supported model/provider/version/tool-calling settings, response limits, reasoning knobs and rejection evidence in a bounded, versioned registry. Keep caches isolated by provider and deployment, with expiry and negative-result verification.
- **Independent test / finished definition:** After restart, a known unsupported parameter is not sent again; after a provider upgrade the capability can be reprobed safely. No tenant data leaks through cache keys.
- **Adoption decision:** Implement the missing bounded capability through an existing OCADE module, preserving the current controller. Copy only small, compatible code after a license/security review; do not import the upstream application wholesale.

#### REPO-10. Deterministic program substitution (`H10`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Simple calculations, file normalization and structured transformations do not require generative reasoning on every instruction.
- **What to add, build, improve or deliberately avoid:** For tasks with a well-defined local operation, use deterministic parsers, native file formats and scripts before model-generated multiagent plans. The AI should choose or describe the goal, not supervise every cell calculation or ordinary filesystem read.
- **Independent test / finished definition:** Benchmark deterministic route vs model route for accuracy, latency and idempotency; the simple path must win or be removed.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-11. Bounded code execution safety (`H11`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has approvals, a command worker and a task authority, but code-driven batches introduce an additional attack surface.
- **What to add, build, improve or deliberately avoid:** Treat generated source as untrusted. Constrain imports, tools, directories, shell use, execution duration, network destinations and output. Prefer approved high-level operations over general shell access; preserve an evidence receipt for each mutation.
- **Independent test / finished definition:** Attempt command injection, unauthorized path traversal, network exfiltration, oversize output, infinite loops and cancellation during execution; every case is blocked or terminates cleanly.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-12. Multi-turn efficiency and resource-budget evaluation (`H12`)

**Source repository:** https://github.com/NousResearch/hermes-agent.  **Origin / status / priority:** NousResearch / Hermes Agent — **VERIFY** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review identifies large prompts and model response delays; improvements were proposed but no reproducible production latency target is established here.
- **What to add, build, improve or deliberately avoid:** Create per-task timing spans for prompt assembly, inference, action dispatch, application wait, verifier and recovery. Establish a baseline before adding another executor or model and track token/quota ceilings.
- **Independent test / finished definition:** Publish task-by-task timing with p50/p95, pass rate, resource usage and cost-equivalent credits. Reject changes that speed up a substep but slow end-to-end completion or lower task success.
- **Adoption decision:** Keep the existing implementation as the default. Add reproducible verification evidence; do not rebuild a feature that already passes the required tests.

#### REPO-13. Skill discovery, eligibility and refresh (`O13`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **IMPROVE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE supports pinned external MCP manifests. OpenClaw demonstrates a richer lifecycle; a second uncontrolled plugin authority is not required.
- **What to add, build, improve or deliberately avoid:** Extend the existing catalog with trusted source discovery, supported OS/app capabilities, eligibility, dependency checks, version pinning, staged refresh and automatic disable on incompatibility. Every skill must carry a declared permission footprint.
- **Independent test / finished definition:** A malicious or incompatible skill cannot become active via discovery alone. Refresh preserves user-edited configuration and rollback to the previous verified version.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-14. External skill and script security scanner (`O14`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **ADD** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review confirms pinned schemas but does not show an equivalent full static-content security scan before third-party skills are accepted.
- **What to add, build, improve or deliberately avoid:** Scan imported scripts, manifests and skill instructions for embedded secrets, prompt injection, dynamic downloads, unsafe shell patterns, hidden network destinations and excessive permissions. Results inform deterministic policy rather than granting AI-based blanket approval.
- **Independent test / finished definition:** Seed a red-team corpus of benign and malicious packages, measure false positives/negatives, quarantine unsafe packages and require approval for high-risk capabilities.
- **Adoption decision:** Implement the missing bounded capability through an existing OCADE module, preserving the current controller. Copy only small, compatible code after a license/security review; do not import the upstream application wholesale.

#### REPO-15. Customer-facing companion security diagnostics (`O15`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has setup and permission mechanisms, but prior source review requests a clearer customer-readable status of system safety.
- **What to add, build, improve or deliberately avoid:** Add a device health panel that checks OS accessibility permissions, gateway binding, update integrity, locked-down command execution, browser access, dependencies and risky configuration. Distinguish fixing automatically from explaining how to fix.
- **Independent test / finished definition:** A new user on Windows and macOS receives accurate actionable explanations for intentionally broken permissions without leaking secrets or demanding irrelevant administrative rights.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-16. Versioned extension provenance (`O16`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Pinned MCP manifests cover part of provenance; lifecycle, compatibility and supply-chain proof need broader qualification.
- **What to add, build, improve or deliberately avoid:** Record source repository, license, version, digest, signed release if available, target OS, permissions, compatible OCADE version, last scan and revocation. Never silently use mutable latest URLs for privileged code.
- **Independent test / finished definition:** A tampered binary or changed manifest is rejected, an obsolete extension is disabled, and the customer can see why a capability is unavailable.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-17. Crash and interrupted-task recovery (`O17`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has durable journaling and leases, but prior source review requests adversarial restart tests comparable to OpenClaw.
- **What to add, build, improve or deliberately avoid:** After a process crash, reconstruct the exact task, authorization generation, in-flight action, external effects and unresolved outputs. Resume only when the last action's outcome is known; otherwise re-observe and request the appropriate approval.
- **Independent test / finished definition:** Force-kill browser, worker, gateway and planner during save, upload and multi-file operations. No duplicate submission or post-STOP mutation is allowed.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-18. Privacy-preserving diagnostic traces (`O18`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Task logs are necessary for recovery but may contain screenshots, file contents or secrets.
- **What to add, build, improve or deliberately avoid:** Separate operational metadata from confidential observations. Redact credentials, filenames when appropriate, personal content and private URLs; support time-bound retention and scoped access. Preserve enough evidence to diagnose failures without logging raw secrets.
- **Independent test / finished definition:** Inject sample passwords and confidential documents; exported logs must not contain recoverable secrets. Recovery must still identify the failed operation and task status.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-19. Broad plugin marketplace (`O19`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **DEFER** — **DEFER**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review explicitly says copying a huge marketplace is not currently material to OCADE's website-based PC-control goal.
- **What to add, build, improve or deliberately avoid:** Record the feature in the competitive backlog only. Prefer a small verified set of native capabilities and approved MCP adapters; avoid duplicated plugin managers, arbitrary installers and unsupported channel integrations.
- **Independent test / finished definition:** No core customer workflow or acceptance metric is blocked by omitting the marketplace. Revisit only when concrete user demand and security coverage justify it.
- **Adoption decision:** Keep the capability out of mandatory launch work unless independent customer need and benchmark data reverse the decision. Prefer eliminating its complexity over copying an unused subsystem.

#### REPO-20. Messaging-channel integrations (`O20`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **DEFER** — **DEFER**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OpenClaw has many messaging channels, but the active OCADE contract is website-first JARVIS control.
- **What to add, build, improve or deliberately avoid:** Do not add WhatsApp, Telegram or social messaging as task authorities by default. Preserve one web-based permission surface and explicit device pairing. Study messaging only as a future notification channel if customers need it.
- **Independent test / finished definition:** Core benchmark pass rate and onboarding are unchanged without channels; any future channel cannot independently approve privileged PC operations.
- **Adoption decision:** Keep the capability out of mandatory launch work unless independent customer need and benchmark data reverse the decision. Prefer eliminating its complexity over copying an unused subsystem.

#### REPO-21. Gateway identity and authorization hardening (`O21`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **VERIFY** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE already uses a central device gateway, identity and per-task authority; the audit does not prove every reauthentication edge case.
- **What to add, build, improve or deliberately avoid:** Review device revocation, pairing expiry, replay resistance, local loopback binding, websocket or RPC origin checks, session fencing and device reassignment. Do not build another gateway unless an existing one fails an objective test.
- **Independent test / finished definition:** An old paired device, stolen session, different account or replayed message cannot resume control; a valid device reconnects without unnecessary email verification.
- **Adoption decision:** Keep the existing implementation as the default. Add reproducible verification evidence; do not rebuild a feature that already passes the required tests.

#### REPO-22. Resource bounds for MCP manifests and schemas (`O22`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **ADD** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** source-review evidence code inspection of catalog.py found manifest and JSON Schema validation but no complete serialized size and nesting limits.
- **What to add, build, improve or deliberately avoid:** Enforce maximum manifest bytes, JSON depth, tool count, schema recursion, string lengths, dynamic URL count and per-skill prompt budget. Keep a deterministic error message if a manifest exceeds the limits.
- **Independent test / finished definition:** Feed nested/cyclic/oversized schemas and hundreds of fake tool entries. Parsing stays within CPU/memory limits, never truncates security-critical descriptions and rejects safely.
- **Adoption decision:** Implement the missing bounded capability through an existing OCADE module, preserving the current controller. Copy only small, compatible code after a license/security review; do not import the upstream application wholesale.

#### REPO-23. Skill permission scoping and revocation (`O23`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** MCP tool calls are pinned and permissioned, but importing a new skill changes the available action surface.
- **What to add, build, improve or deliberately avoid:** Require a per-skill permission proposal mapping to file scope, network domains, external publishing and high-risk commands. Bind the approved scope to task identity, display changes and support immediate revocation.
- **Independent test / finished definition:** A skill that requests broader file access after an update cannot execute until reapproved; revocation cancels dependent pending calls.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-24. Trust boundaries for retrieved content and instructions (`O24`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Untrusted web pages, files and skill instructions may try to redirect the agent. prior source review emphasizes keeping AI interpretation separate from deterministic permission enforcement.
- **What to add, build, improve or deliberately avoid:** Tag every observation by source and trust, prevent retrieved instructions from altering system policy, distinguish a customer's command from quoted website content, and validate all proposed tool effects.
- **Independent test / finished definition:** Test hostile web pages that instruct JARVIS to send data or ignore STOP. No unauthorized effect occurs, even if the planner repeats malicious wording.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-25. Extension update staging and rollback (`O25`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** The existence of pinned manifests does not prove safe upgrade, rollback and compatibility testing.
- **What to add, build, improve or deliberately avoid:** Prepare new versions alongside the active version; run health checks and permission diffs, then activate only between tasks. Keep a known-good version available for rollback and preserve evidence of who authorized the update.
- **Independent test / finished definition:** An update fails mid-install or removes a tool; active task behavior stays stable and the previous extension can be restored without losing user files.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-26. Least-privilege package execution (`O26`)

**Source repository:** https://github.com/openclaw/openclaw.  **Origin / status / priority:** OpenClaw — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** A Windows command worker exists, but prior source review notes that a working-directory restriction is not a full OS access boundary.
- **What to add, build, improve or deliberately avoid:** Use OS-level reduced-privilege process identities, file access controls, named-pipe restrictions and restricted child processes wherever feasible. An external skill does not inherit the full user account authority by default.
- **Independent test / finished definition:** Attempt to read paths outside an approved workspace and spawn elevated commands; prove denial on clean Windows/macOS test machines, not only mocks.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-27. Background accessibility actions (`C27`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Cua can sometimes control accessible elements without foreground focus; OCADE uses foreground input on some Windows routes.
- **What to add, build, improve or deliberately avoid:** Add background actions only for supported, well-identified application APIs or accessibility targets. Never simulate global keyboard input in the background; recheck window and element identity immediately before an effect.
- **Independent test / finished definition:** Work in two simultaneous windows while a user types in another app. The background action must affect only the approved target and must not steal focus or corrupt the user's typing.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-28. Rich per-action delivery evidence (`C28`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has receipts and independent verification; CUA adds route, delivery method and effect-confidence metadata.
- **What to add, build, improve or deliberately avoid:** Extend receipts with attempted mechanism, action ID, target binding, expected effect, observed effect, time spent, retry decision and evidence pointer. Do not duplicate or replace the verifier.
- **Independent test / finished definition:** A test distinguishes delivered input, observed UI change and verified business outcome, and the record survives a crash with no credential leak.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-29. Snapshot-bound element references (`C29`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE already has scoped element references; stale references remain a possible failure after window or page changes.
- **What to add, build, improve or deliberately avoid:** Bind target handles to window generation, observation timestamp, accessibility-tree version and allowed action. Invalidate on navigation, modal transitions, window recreation or app restart; reacquire targets instead of guessing coordinates.
- **Independent test / finished definition:** A button disappears or a modal replaces it between inspect and click. JARVIS refuses stale target use and re-observes before acting.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-30. Postcondition verification of real outcomes (`C30`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **VERIFY** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE's receipt plus independent verifier already separates action delivery from completed customer outcomes.
- **What to add, build, improve or deliberately avoid:** Preserve the existing structure. Expand application-specific independent oracles for spreadsheets, CAD geometry, video timelines and exported files; never call a click or save dialog sufficient proof.
- **Independent test / finished definition:** Hidden-answer tasks verify the file/state independently after JARVIS finishes. A successful click with wrong final content is marked failed.
- **Adoption decision:** Keep the existing implementation as the default. Add reproducible verification evidence; do not rebuild a feature that already passes the required tests.

#### REPO-31. Reproducible desktop benchmarks (`C31`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has E1–E4 and 16-run comparisons planned; their qualified pass evidence is incomplete in prior source review.
- **What to add, build, improve or deliberately avoid:** Version task environments, fixture snapshots, evaluation scripts, oracle criteria, model settings, OS builds and result artifacts. Track first attempt separately from recovery attempts, plus wall-clock task time.
- **Independent test / finished definition:** A second runner reproduces the same result with the same hash/seed; CI and physical-device claims are not conflated. All required coding gates are green before broad real-task campaigns.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-32. Optional isolated desktop test environments (`C32`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** A local VM/container test environment can contain destructive test fixtures; the customer device must still be controlled natively.
- **What to add, build, improve or deliberately avoid:** Provision disposable Windows/macOS-compatible cloud test hosts or VMs, snapshot fixtures and inject failures. Keep virtualization strictly a testing/developer capability; do not force customer installation.
- **Independent test / finished definition:** All destructive fault-injection tests run away from real customer devices. A clean customer installs only OCADE's approved companion, not a general container engine.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-33. Additional narrow planner models (`C33`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **EXPERIMENT** — **EXPERIMENT**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior research reference says specialized form models should be deferred because the approved production planners are two independently tested models.
- **What to add, build, improve or deliberately avoid:** Record the owner's request to support additional models, but isolate each in an experimental adapter until capability, data handling, correctness, cost and latency checks pass. Do not silently route customer tasks to unapproved models or replace the user's chosen planner mid-task.
- **Independent test / finished definition:** A candidate model passes held-out forms and complex tasks, tool-schema tests and STOP/security checks before eligibility is approved. Otherwise it remains disabled with a visible reason.
- **Adoption decision:** Explicit owner-requested experimental capability. Document the conflict with prior two-model/one-controller rules, run side-by-side tests and ask for the necessary model/security/scope approvals before production activation.

#### REPO-34. Foreground focus and input arbitration (`C34`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Foreground keyboard/mouse delivery may collide with actual user typing or a second concurrent JARVIS task.
- **What to add, build, improve or deliberately avoid:** Introduce a per-device input lease: one owner of global input at a time, continuous active-window revalidation, pause-on-human-input policy and immediate STOP fencing. Nonconflicting read-only work can run concurrently.
- **Independent test / finished definition:** When a user changes focus or types during an automation, no keystroke enters the wrong field. Conflicting jobs queue rather than interleave input.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-35. Accessibility tree caching and invalidation (`C35`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has Windows UIA inspection caching; prior research reference explicitly says it is not a missing feature.
- **What to add, build, improve or deliberately avoid:** Measure cache hit rate and stale-target risk on real apps. Invalidate on window reconstruction, active view changes, process restart and structural mismatch; use incremental snapshots when reliable.
- **Independent test / finished definition:** Cache reduces p95 inspection latency without increasing wrong-target errors. A deliberately stale tree is detected before modification.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-36. Coordinate and display normalization (`C36`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **VERIFY** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review doesn't establish complete multi-monitor, mixed-DPI, screen scaling and remote-session coverage.
- **What to add, build, improve or deliberately avoid:** Validate coordinate transforms among logical pixels, physical pixels, screen origins, window client areas and display scales. Anchor clicks to app/element identity rather than naked coordinates.
- **Independent test / finished definition:** Run mixed 100%/150%/200% DPI, secondary negative-origin monitor and window movement. There must be no click outside the exact authorized target.
- **Adoption decision:** Keep the existing implementation as the default. Add reproducible verification evidence; do not rebuild a feature that already passes the required tests.

#### REPO-37. Efficient structural observation before screenshots (`C37`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review identifies repeated full page-body reads and custom control snapshots in web_worker.py; this can waste time and context.
- **What to add, build, improve or deliberately avoid:** Prefer targeted DOM queries, accessibility node diffs and application-native state. Limit screenshots to cases where structured observation fails or cannot express the target. Store observation hashes to avoid resending unchanged state.
- **Independent test / finished definition:** Benchmark a large complex website. Model input, observation latency and tool calls decrease while preserving task correctness on held-out pages.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-38. Vision fallback with verified grounding (`C38`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has visual matching and screenshot-based fallback, but the audit does not prove broad real-app accuracy.
- **What to add, build, improve or deliberately avoid:** Only when native/DOM/accessibility options fail, crop to relevant window, identify target with confidence and relation to nearby labels, confirm current window, then observe the effect. Avoid silent coordinate reuse.
- **Independent test / finished definition:** Run GIMP, CAD, complex canvas and custom dialogs on both OSs; test occlusion, theme, zoom, resized windows and malicious lookalike labels.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-39. Typed computer-action contracts (`C39`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Existing tool calls are schema-validated, but a cross-route semantic contract for observed vs executed outcomes requires complete evidence.
- **What to add, build, improve or deliberately avoid:** Define a common action descriptor for browser, Windows/macOS accessibility, file operations and visual fallback: target, route, consent scope, precondition, postcondition, effect identity, retry safety and cancellation generation.
- **Independent test / finished definition:** The same task has consistent receipts regardless of execution route, and schema fuzzing cannot produce unapproved effects.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-40. Cross-platform device qualification (`C40`)

**Source repository:** https://github.com/trycua/cua.  **Origin / status / priority:** trycua / CUA — **VERIFY** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Windows 10/11 and macOS are mandatory, Linux optional; prior source review warns hosted simulation does not prove real-device operation.
- **What to add, build, improve or deliberately avoid:** Create a device and OS matrix for pairing, accessibility permissions, native operations, tray STOP, install/update/remove, unexpected dialogs and recoveries. Keep evidence per platform and CPU architecture.
- **Independent test / finished definition:** Qualify actual supported Windows/macOS devices, separating cloud host success, mock success and customer-device proof. Zero critical STOP or wrong-window failures.
- **Adoption decision:** Keep the existing implementation as the default. Add reproducible verification evidence; do not rebuild a feature that already passes the required tests.

#### REPO-41. Dependency-aware task graphs (`U41`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE already has ordered milestones. For complex CAD and video work, precedence between files and exports is more important than simple step order.
- **What to add, build, improve or deliberately avoid:** Add a lightweight directed acyclic task graph to the existing supervisor with dependencies, prerequisites, cycle checks, side-effect identities and verified completion. Do not add a second swarm coordinator.
- **Independent test / finished definition:** A car model, component spreadsheet and video export execute in the right order; an intentionally cyclic plan is rejected before any side effect.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-42. Event-driven wakeups and no wasteful polling (`U42`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review recommends moving from unnecessary polling to event-driven status changes while keeping OCADE's existing durable authority.
- **What to add, build, improve or deliberately avoid:** Workers should signal completion, blocked approvals and artifact readiness; the supervisor persists state and wakes only eligible tasks. Poll only when an external application offers no event source, with backoff.
- **Independent test / finished definition:** On long renders, the agent makes few/no model calls while waiting, resumes promptly at completion, and still recovers after a missed event or worker restart.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-43. Device-capability-aware task matching (`U43`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** The user may own several authorized devices, but their task must not silently move between computers.
- **What to add, build, improve or deliberately avoid:** Match required software, OS, RAM/GPU, permissions and user-selected device to available capabilities. Show why a task needs a specific machine; require authorization for reassignment.
- **Independent test / finished definition:** A task demanding a Mac-only app cannot be assigned to an incapable Windows host. No cross-device execution occurs without explicit consent.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-44. Controlled dependency-aware replanning (`U44`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE already retries/replans after failures, but dependent subtasks must preserve confirmed prior effects.
- **What to add, build, improve or deliberately avoid:** Replan only incomplete or invalidated graph nodes. Preserve verified finished artifacts, avoid resubmitting external effects, and require a new authorization when task scope changes.
- **Independent test / finished definition:** Simulate an interrupted 3D export after upstream CAD file completion. Resume without rebuilding unrelated files or duplicating a committed operation.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-45. Experience-based safe route reuse (`U45`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **IMPROVE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE's precedent() helps suggest operation names but not guarded replay of entire paths.
- **What to add, build, improve or deliberately avoid:** Store preconditions, parameters, app version, authority limits and independently verified outcome evidence with each reusable route. Route reuse can accelerate repeated tasks only when revalidation passes.
- **Independent test / finished definition:** A verified spreadsheet fix works with a different filename and window; a changed schema causes re-planning rather than blind replay.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-46. Windows cached accessibility inspection (`U46`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **VERIFY** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior research reference locates the FindAllBuildCache-type design in OCADE windows_worker.py at lines 232–269; it is already implemented.
- **What to add, build, improve or deliberately avoid:** Do not reimplement it. Instrument hits/misses, invalidation cost, scan duration and wrong-target prevention. Improve existing cache only if measured evidence shows an actual bottleneck.
- **Independent test / finished definition:** Run real Windows app matrices and compare cold/hot inspection latency and accuracy, proving no regression.
- **Adoption decision:** Keep the existing implementation as the default. Add reproducible verification evidence; do not rebuild a feature that already passes the required tests.

#### REPO-47. Conflicting subtask resource locks (`U47`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Independent work may run concurrently but two jobs cannot modify the same app window or output file safely.
- **What to add, build, improve or deliberately avoid:** Introduce a single authoritative resource-lock model for app focus, device input, file paths, task output and approval scopes, integrated with the existing supervisor. Acquire locks deterministically to avoid deadlocks.
- **Independent test / finished definition:** Parallel tasks on distinct files finish safely; competing edits serialize and a crash releases stale leases after fencing the old generation.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-48. Cycle and dependency validation (`U48`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Task plans can become cyclic when the model incorrectly makes a result depend on itself.
- **What to add, build, improve or deliberately avoid:** Reject task graphs with cycles, missing prerequisites, impossible device requirements and invalidated output paths before execution. Provide a clear corrective explanation or safe plan repair proposal.
- **Independent test / finished definition:** Adversarial plans with cycles, missing dependencies or contradictory steps fail before any user-file mutation.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-49. Persisted long-job continuation (`U49`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** The task journal exists, but multi-hour plans span app restarts, exports, user interruptions and provider failures.
- **What to add, build, improve or deliberately avoid:** Persist progress by verified subtask, include versioned resource requirements and active effect leases, and provide a controlled Resume/Take Over UI. Avoid sending full history back to AI after each reconnection.
- **Independent test / finished definition:** Kill the agent during a one-hour video export and resume from proven checkpoints without duplicate rendering or lost edits.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-50. App-semantic specialist action selection (`U50`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** The vision and generic computer controls cannot always distinguish CAD-specific operations from ordinary clicks.
- **What to add, build, improve or deliberately avoid:** Discover installed application capabilities and choose native CAD/document/media APIs first. Use task graph semantics to select deterministic workers for common operations without hardcoding customer app names or screenshot coordinates.
- **Independent test / finished definition:** Complete the same geometry, formula and timeline tasks with different installed supported applications, using accurate editable outputs.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-51. User-visible dependency and failure explanations (`U51`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Progress indicators may show steps but not why a downstream task is waiting or which output is blocked.
- **What to add, build, improve or deliberately avoid:** Expose milestone dependencies, exact waiting condition, last verified action, estimated next step only when grounded and user's safe recovery options. Do not invent percentages from planned actions.
- **Independent test / finished definition:** For a blocked export, user sees the actual unmet source-file requirement; STOP and Resume work without losing audit history.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-52. Outcome-oriented multi-app qualification (`U52`)

**Source repository:** https://github.com/microsoft/UFO.  **Origin / status / priority:** Microsoft / UFO — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review documents incomplete real-world benchmark success and unknown full current-SHA native tests.
- **What to add, build, improve or deliberately avoid:** Add held-out evaluation suites requiring correct cross-app deliverables, benchmark hashes, first-attempt and retry metrics, errors per action, runtime and real Windows/macOS evidence. Keep CUA evaluation environment isolated from customer files.
- **Independent test / finished definition:** A second evaluator reproduces strict pass counts on a pinned release candidate; no pass is awarded just because the agent clicked or reported success.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-53. Intent-to-authority interpretation (`N53`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE already has deterministic permission grants but may not fully distinguish what a customer's natural-language request authorizes.
- **What to add, build, improve or deliberately avoid:** Translate goal intent into an explicit action envelope: target apps/files, allowed reads, mutations, network actions, posting and delegation. Use deterministic policy to enforce it; the model can propose scope but cannot grant it.
- **Independent test / finished definition:** A task to draft an email cannot send it unless explicitly authorized. Quoted instructions on a website never expand the customer's permission grant.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-54. Read/prepare/commit effects separation (`N54`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **IMPROVE** — **P0**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Existing approvals may not consistently encode private preparation versus irreversible external submission.
- **What to add, build, improve or deliberately avoid:** Classify operations as observation, reversible local edit, external commit, credential use or irreversible mutation. Require appropriate confirmation with full untruncated details for externally committing actions.
- **Independent test / finished definition:** A form can be filled and previewed without being submitted; a later submit is blocked until separately authorized. No misleading truncated approval text.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-55. Private credential vault and controlled autofill (`N55`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **PROPOSE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** The reviewed JARVIS modules did not establish a general encrypted website-credential vault like Nod's.
- **What to add, build, improve or deliberately avoid:** Use OS secure storage (Windows Credential Manager/macOS Keychain) or another approved encrypted vault; issue short-lived target-bound secret references, never raw password text to model prompts or logs. Autofill only an authorized, origin-verified login form.
- **Independent test / finished definition:** Injected phishing pages cannot request a credential; model/tool logs contain no password, and revocation prevents further use. Do not import a large vault subsystem unless integration analysis justifies it.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-56. Learned parameterized customer workflows (`N56`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **IMPROVE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has precedent and experience storage, but automatic durable learned skills are under-verified.
- **What to add, build, improve or deliberately avoid:** Capture a user-approved reusable workflow only after independent success; separate parameters from observations; include provenance, version, conditions and expiration. Allow user review and deletion.
- **Independent test / finished definition:** Run a learned weekly spreadsheet process against new input files with no guessed paths; it halts safely on structural changes and never publishes without permission.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-57. Protected user-edited skills and instructions (`N57`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** prior source review does not establish robust precedence rules between a user's own edited skill and auto-learned suggestions.
- **What to add, build, improve or deliberately avoid:** Mark user-authored content as immutable to automated learning unless explicitly reviewed; keep version history and change previews. Auto-generated improvements may be proposed, not silently overwrite preferences.
- **Independent test / finished definition:** After auto-learning detects a different route, the original user-created skill remains unchanged; rollback restores prior version exactly.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-58. Memory provenance, consent and deletion (`N58`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **IMPROVE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has an opt-in memory database according to prior code comparison, but source, consent and deletion proof are incomplete.
- **What to add, build, improve or deliberately avoid:** Attach each memory to its originating task evidence, user consent scope, freshness and privacy label. Use retrieval sparingly and allow correction, export and complete authorized deletion.
- **Independent test / finished definition:** A false preference is corrected and not resurfaced; deleting an item removes it from retrieval and related cache after the declared retention interval.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-59. Customer-facing activity and usage explanation (`N59`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **IMPROVE** — **P1**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE already has task receipts and history; the audit calls for clearer explanations of actual actions, errors and approvals.
- **What to add, build, improve or deliberately avoid:** Expose a timeline of objective, devices, apps touched, commands, permissions, verified output, retries, observed failures, usage and model selection. Keep sensitive values redacted and distinguish attempted from completed effects.
- **Independent test / finished definition:** A customer can reconstruct what changed without seeing cryptic logs; exported receipts match independent evidence and never expose secrets.
- **Adoption decision:** Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.

#### REPO-60. Durable scheduled JARVIS work (`N60`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **DEFER** — **DEFER**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE has schedule database support, but unattended JARVIS scheduling was excluded by the current owner-approved testing scope.
- **What to add, build, improve or deliberately avoid:** Preserve planning designs but do not automatically activate cron control of customer PCs. If later approved, use explicit per-schedule task scope, expiry, awake-device checks, one-time occurrence claims and immediate revocation.
- **Independent test / finished definition:** A recurring task never runs after cancellation or device revocation and never creates duplicate effects after retry; otherwise the scheduler stays disabled.
- **Adoption decision:** Keep the capability out of mandatory launch work unless independent customer need and benchmark data reverse the decision. Prefer eliminating its complexity over copying an unused subsystem.

#### REPO-61. Proactive event monitoring (`N61`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **PROPOSE** — **P3**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** Earlier Nod comparison found no equivalent full proactive monitoring in the reviewed OCADE JARVIS flow.
- **What to add, build, improve or deliberately avoid:** Introduce a future opt-in watch mechanism for permitted app events, changed files or task dependencies. Do not wake agents merely to consume tokens; schedule only actual relevant triggers and protect customer privacy.
- **Independent test / finished definition:** An approved watched folder change creates at most one scoped task; unapproved files, notifications or credentials are not read or transmitted.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

#### REPO-62. One-click approved app integrations (`N62`)

**Source repository:** https://github.com/n8n-io/nod.  **Origin / status / priority:** n8n / Nod — **PROPOSE** — **P2**.  **Trace:** consult the named original source file and repository research notes; verify implementation and revision before copying.

- **What exists or what the audit actually establishes:** OCADE supports MCP adapters but the previous comparison noted a less complete account-connection experience than Nod.
- **What to add, build, improve or deliberately avoid:** Add a verified connector journey: choose service, review requested scopes, authenticate via provider-owned flow, test access, rotate/revoke and see connection health. Reuse the central MCP authority; do not give third-party connectors silent PC-control rights.
- **Independent test / finished definition:** A fresh user connects an approved service without copying API keys, revokes it and proves subsequent calls fail. Network and credential limits are tested end to end.
- **Adoption decision:** First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.

## Implementation sequence, relative to the JARVIS coding-first rule

1. **P0: finish correctness and safety foundations first.** Fix authorization intent, STOP/input fencing, command isolation, stale target references, privacy of evidence, trust boundaries, real Windows/macOS qualification readiness, and full current-commit CI. Running tests still require properly authorized environment access.
2. **P1: improve execution speed without changing owner authority.** Measure model/planner latency, compact context with decision parity, optimize browser observations, bounded code-driven batches, provider capability persistence, event-driven job wakes, richer receipts and credential protection.
3. **P2: controlled capability additions.** Reusable learned recipes, skill scanning and provenance, secured OAuth integrations, checkpointing, device capability routing, optional task DAG and actionable customer diagnostics. A proposed feature enters the active coding gate only when it solves a specific measured problem.
4. **P3: optional after reliable release qualification.** Proactive monitoring, unattended scheduling, broad extensions, additional models and swarms stay outside mandatory release unless explicitly approved and independently justified by held-out measurements.
5. **Benchmark hard gate.** Finish mandatory JARVIS coding and restore complete green website/backend/companion CI on a pinned SHA before full cloud-computer real-task benchmarks. Each failing benchmark reopens coding; repeat the green gate on the new SHA before continuing. Distinguish first-attempt results from repair successes.
6. **Finish decision.** No 100% production-readiness claim until the full supported customer journey and real-device STOP, permissions, installation, pairing, task completion and verification pass independently. This report does not calculate a new readiness percentage.


### 14A.4. Binding implementation classification and precedence

- **Mandatory before benchmarks:** Every item marked P0, P1 or P2 REQUIRED after code inspection; all fixes needed to keep JARVIS, the entire website, online/offline chat, security, customer flows, companion and backend CODED and green. No partial item may be mislabeled complete. Evaluate historically deferred items: if they are unnecessary to launch, record verified DEFER with justification, never silently delete.
- **Parallel AI-agent system is MANDATORY, not optional.** Replace earlier H07 experimental/defer wording. Implement a single authoritative coordinator that delegates **independent bounded subtasks** to specialist model or deterministic workers while preserving single owner for each computer/window/file mutation. Before delegation, verify it improves latency, quality or capability; keep deterministic code for simple operations. Run dependency graphs, tool-call budgets, scoped permissions, cancellation propagation, bounded agent depth, failure isolation, checkpointing and verified result reconciliation. Benchmark solo against multi-agent execution later; no unlimited uncontrolled agent swarms. Do not use parallel coding agents unless separately approved—the runtime multi-agent requirement is distinct from the established single coding agent restriction.
- **Universal model compatibility is MANDATORY.** Replace fixed-provider assumptions in adapter design, NOT the existing 16-run baseline. Support capabilities-based configuration for multiple authorized commercial API providers and models; each registered model declares vision, tools, structured schemas, thinking controls, context, token cost, streaming, retry semantics, data-region protections and quota limits. A customer task must have explicit model selection and truthful fallback behavior; no cross-model hidden mutation, automatic substitution of unapproved models, or accidental prompt/secret disclosure. Additional model acceptance requires compatibility/real-task evidence; current Gemini 3.5 Flash-Lite and Gemma 4 31B remain the initial comparison pair, not the only future supported models.
- **Key pooling and health routing are MANDATORY within legitimate provider terms.** Inspect existing Supabase Edge Functions and authorized GitHub protected environments. Add a secure server-side, encrypted logical key-slot registry with project, provider, model, tenant, permissions, rate-window and spending metadata; check health and automatically choose a valid key for the requested supported provider/model and user. Automatically rotate away from expired/failed keys and apply bounded backoff/circuit breakers. Never send raw API keys to frontend, model prompts or logs. Never rotate keys to circumvent project-level quotas or provider restrictions; multiple keys from one quota project do not multiply its allowance. A secret must first be provisioned by the owner; neither invent secrets nor assume they are readable to tools. Test simultaneous tasks, exhausted quota, revoked keys, wrong-provider selection, isolation, billing safety and safe retry.
- **Native-first universal PC control remains MANDATORY.** Discover user apps and tools dynamically. Prefer native APIs, file formats and scripts, then DOM/OS accessibility; screenshot vision is the last fallback. Use relevant pieces of all five repositories only when they actually improve correctness or speed. No hardcoded application, UI coordinate, task answer, benchmark oracle, customer credential or task flow.
- **Customer-side Docker/VMs are NEVER mandatory.** Docker/cloud VMs may help development, CI, isolated tests and explicitly authorized specialist work; packaging and setup on Windows/macOS must not force users to install container tooling. Prove companion cold-start and install time independently.

### 14A.5. Ten additional Nod implementation refinements (items 63–72)

#### REPO-63. Intent-scoped task authorization (Nod extension of N53)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N53`.
- **Classification:** P0 REQUIRED. **Customer benefit:** Prevents an apparently helpful AI action from overstepping customer instructions.
- **Detailed change:** Extend existing task authority to translate natural-language goals into an exact, immutable permission envelope: account, device, named apps/files, allowed reads, local edits, external writes, credential use, duration and revocation. Planner proposals never create permission. Separate inferred intent from granted authority. A document or website must not enlarge that grant.
- **Acceptance evidence:** Draft an email but never send it; an injected page instruction cannot increase scope; stopping or revoking the task prevents subsequent writes.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-64. Read, prepare, and commit action tiers (Nod extension of N54)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N54`.
- **Classification:** P0 REQUIRED. **Customer benefit:** Avoids accidental irreversible submissions.
- **Detailed change:** Classify observation, reversible preparation, external commit, credential release and irreversible mutation. Preserve untruncated approval descriptions showing exact target, contents, consequences and rollback availability. A prepared form is not submitted unless the separate commit is authorized. Preserve idempotency and action receipts.
- **Acceptance evidence:** An approved draft never sends or submits automatically; unknown previous effect blocks blind retry.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-65. Encrypted, origin-bound credential-use vault (Nod extension of N55)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N55`.
- **Classification:** P1 REQUIRED. **Customer benefit:** Allows convenient app access without giving the model control of raw passwords.
- **Detailed change:** Prefer existing operating-system credential stores or a vetted encrypted server vault. Use short-lived origin/target-bound references rather than model-visible plaintext; validate destination domain and TLS, scope access by user/device, rotate and revoke; scrub prompts, screenshots, exceptions and logs. Do not implement a new vault if an existing secure mechanism is sufficient.
- **Acceptance evidence:** Phishing page and malicious plugin receive no passwords; revocation takes effect immediately; secret scanning finds no plaintext.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-66. Reusable independently verified workflows (Nod extension of N56)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N56`.
- **Classification:** P2 REQUIRED. **Customer benefit:** Accelerates repeated work with fewer model calls.
- **Detailed change:** Promote successful task traces into reviewed parameterized skills with version, provenance, app capability requirements, input/output schemas, success oracles and expiration; never save hardcoded user filenames, window positions or selectors as universal instructions. Integrate with existing experience and precedent storage.
- **Acceptance evidence:** Run the learned spreadsheet workflow on new files and an altered app version without incorrect mutations.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-67. Protect user-edited skills and rollback (Nod extension of N57)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N57`.
- **Classification:** P2 REQUIRED. **Customer benefit:** Keeps the customer in control of how their work is performed.
- **Detailed change:** Mark authored instructions as customer-owned; automatic learning may suggest a diff but cannot overwrite the original. Keep revision history, approval records, rollback and deletion. Run regression checks after merging a skill improvement.
- **Acceptance evidence:** Auto-learning retains user-chosen formatting; version restore is byte-equivalent.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-68. Consent-based long-term memory with provenance (Nod extension of N58)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N58`.
- **Classification:** P2 REQUIRED. **Customer benefit:** Reduces repetition without creating a private-data risk.
- **Detailed change:** Build on current opt-in memory. Store source task, timestamp, confidence, consent, privacy label, correction/deletion controls, scope and retention. Retrieve only necessary relevant entries; prevent cross-account or cross-device leakage. Expire uncertain or outdated facts.
- **Acceptance evidence:** Correct a deliberately wrong preference and confirm it stays corrected; deletion propagates to retrieval and caches.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-69. Customer-readable action timeline and receipts (Nod extension of N59)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N59`.
- **Classification:** P1 REQUIRED. **Customer benefit:** Builds trust through understandable, truthful progress.
- **Detailed change:** Translate existing journals into plain-language task objectives, apps accessed, operation attempt versus confirmed effect, approvals, progress, STOP and recovery, verified output links, durations and model usage. Hide internal .py filenames, stack traces, key names or source paths from normal customer views; show them only in restricted redacted developer diagnostics.
- **Acceptance evidence:** Every timeline item matches an actual signed or journaled event; no false completion or leaked internal path.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-70. Durable recurrence with explicit authority (Nod extension of N60)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N60`.
- **Classification:** P3 CONDITIONAL. **Customer benefit:** Enables recurring work without duplicate or surprise actions.
- **Detailed change:** Reuse existing schedule tables if unattended tasks are enabled. Each recurrence stores explicit customer opt-in, exact task scope, allowed device, schedule/expiry, one-time occurrence claim, revocation and offline-device behavior. Do not allow automated background control without visible user-granted permission. If this remains intentionally out of active scope, mark it DEFERRED and explain the prerequisite, not falsely complete.
- **Acceptance evidence:** Cancellation prevents future runs; duplicated event delivery produces only one effect.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-71. Event-driven proactive monitoring (Nod extension of N61)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N61`.
- **Classification:** P3 CONDITIONAL. **Customer benefit:** Allows JARVIS to resume tasks when conditions change.
- **Detailed change:** Watch authorized events such as a completed export, file arrival or paired-device reconnection through efficient event subscriptions; trigger only once per relevant change, without polling the language model. Require separate customer permissions and cost ceilings, and do not broaden scope to unapproved data.
- **Acceptance evidence:** Single file event causes one scoped action; stop/revoke disables listener; irrelevant events consume no model calls.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-72. One-click OAuth and MCP app connections (Nod extension of N62)

- **Source repository:** https://github.com/n8n-io/nod; related earlier entry: `N62`.
- **Classification:** P2 REQUIRED. **Customer benefit:** Simplifies connecting everyday tools while keeping permissions visible.
- **Detailed change:** Reuse existing MCP routing. Provide provider authorization flow, precise scopes, official redirects, safe secret storage, connection tests, health/expiry, disconnect and refresh. Never ask customers to paste secrets into chat. Dynamically expose only authenticated and permitted tools to the planner.
- **Acceptance evidence:** Connect, run a narrow authorized task and disconnect; subsequent access is denied; no credentials appear in logs.
- **Deduplication:** This expands the earlier Nod item rather than creating a second executor or duplicate database.


### 14A.6. Required readiness ledger for the 72 architecture entries

Use one source-of-truth ledger keyed `REPO-01` through `REPO-72`: owner priority, current code path, source link/commit, disposition, exact change, input/output contract, threat model, new tests, real-device dependency, performance baseline and independently verified evidence. Start from the existing 266-ID/84-concept ledgers and **link** to them; never create a competing task authority, separate permissions engine, second secret vault or duplicate execution manager. Deferred items require an explicit signed-off reason. All applicable required and partial entries must be completed and return GREEN code/CI tests before the first benchmark task.


## Part 14B. Entire OCADE website implementation, user experience, online/offline Chat, secret security, policy pages, and green-build prerequisites

**This is implementation work BEFORE any real-task/cloud benchmarking.** P0: JARVIS computer control and core safety. P1: online Chat, universal model routing and customer integration. P2: offline Chat/site model setup and settings. P3: site-wide UX, security, support, policies, production hardening, complete regression suite and cleanup. These are implementation priorities only: no offline-model download/airplane-mode qualification until the LAST stage of benchmarking, but offline feature coding, typechecking and local tests MUST already be green. All applicable 72 architecture entries and any earlier partial mandatory feature must be accounted for. No standalone miniature green commit substitutes for green CI on the whole final branch head.

### 14B.1. Universal online AI and chat architecture

1. **Model-agnostic backend.** Expose a provider-neutral planning/chat API, unified capability contract and streaming state, while preserving distinct chat and JARVIS permissions. Support model families beyond Gemini/Gemma through approved provider adapters; choose by actual vision, tool schema, latency, context, safety and cost rather than hardcoded brand identifiers. The initial 16-run comparison remains Gemini 3.5 Flash-Lite versus Gemma 4 31B and does not authorize live use of untested models.
2. **Supabase key registry.** Register any number of already-authorized key slots against real provider/project/account/model identities, encrypted server-side. Selection uses health, remaining lawful quota, task permission, data-region eligibility, configured priority and service cost. Health rotation handles revoked or failing keys; not quota evasion. Multiple keys in the same project share project-level quota where provider rules say so. Never copy keys from chat, screenshots or test output. Separate staging and production. Require owner-approved secret access and do not assume Supabase/CI secrets have been checked.
3. **Online chat functionality.** Code complete chat initiation, new/edit/regenerate conversation, streaming answer, STOP, history persistence, clear error states, optional attachments, safe file previews, token/status usage, model selector, clipboard copy, exports where supported, context and model availability, rate-limit handling, protected deletion and per-account isolation. Use the same design primitives, not the JARVIS command authority.
4. **Model qualification before release.** Each provider adapter needs positive/negative tests for schema, streaming, long context, images, tool calls, refusals, unknown unsupported parameters, timeouts, retries, rate limiting, pricing/quota reporting, data isolation and approved region use. No hardcoded provider keys in browser bundles or mocks promoted to runtime results.
5. **Mandatory multi-agent JARVIS.** Build a bounded multi-agent coordinator with specialist capabilities, precise scope, one authoritative mutation owner, independent subtask verification, cancellation propagation and evidence aggregation as defined in Part 14A. Agent swarms cannot perform duplicate desktop actions or replace faster deterministic operations. Report actual number of model calls, latency and failure rate.

### 14B.1A. Owner Supabase key registry and customer BYOK Settings (MANDATORY P0; 15 November 2026)

**New owner decision; NOT an implementation claim.** OCADE must provide two independent secure credential sources: (a) owner-managed credentials provisioned in Supabase and (b) a customer's personally supplied BYOK credentials. This requirement precedes whole-product coding GREEN and real-task benchmarking. Preserve existing single task authority, authenticated server-side model gateway, customer consent, STOP, journaling and independent verification. Do not create a second agent execution engine or duplicate key vault.

1. **Unbounded-by-design owner credential registry.** The owner can register, batch-import, enumerate, label, enable, suspend, replace and revoke any legitimately provisioned number of provider keys from the Supabase Dashboard and, where independently secured, an owner-only admin console. Remove the three-fixed-Gemini-slot architectural ceiling. Support at least 100 simulated key records with no additional source edits or redeploys. There is no claim of infinite request capacity or free provider quotas. Store each secret using Supabase Vault or a vetted equivalent encrypted secret manager; store only opaque secret references and nonsecret metadata in protected server-owned tables. Never put one variable per customer/key into Supabase Edge Function environment secrets, and never expose Vault's decrypted secrets view or privileged management RPCs to browser users. Require owner authentication and recent strong authorization for optional bulk-import UI.

2. **Independent owner and user pools.** Credential metadata records provider, endpoint/protocol, model IDs, provider account, actual quota/billing project, owner user or privileged platform owner, encrypted secret reference, permitted task surfaces, data residency, enabled/disabled state, priority, health, rate windows, cost ceilings and timestamps. Do not mix the platform pool with another customer's BYOK pool or assume distinct keys in one provider project have independent quota. Store one record per logical key or provider-account credential; do not hardcode a maximum record count in the application.

3. **Exactly named Settings category.** Add a **sixth authenticated Settings category named BYOK** alongside Account, Preferences, Devices, Privacy & Security and Billing & Usage. Add deep-link support for the query parameter settings=byok, with normal accessible keyboard/mobile focus behavior. This is the customer's real operational connection manager, not merely an informational card or advanced toggle. Never show a working Connected state until authenticated server storage, provider validation and actual routing are implemented. Do not introduce an inert Save or fake preview.

4. **Customer Add BYOK Connection form.** Request friendly connection name, provider (or explicitly supported compatible protocol), provider-specific model ID or safely discovered model, **API Key / Token**, **Gateway URL / API Base URL** (preset for known providers; a validated custom HTTPS URL only if the adapter safely supports it), and provider-required deployment, organization, API version and project fields where applicable. Show the exact accepted endpoint format for the selected adapter; never imply a generic arbitrary URL is compatible. Optional extra headers are schema-allowlisted only; sensitive header values use the secret manager. Provide Test Connection (with explicit warning that a probe may consume the user's quota), Save, Update/Replace key, Disable, Delete, default Chat model, default JARVIS model and per-connection permissions.

5. **BYOK secret security.** Send raw customer key only once via a short-lived authenticated TLS form to a protected backend; encrypt it with Supabase Vault or vetted external secret storage. Never retain plaintext in localStorage, IndexedDB, sessionStorage, URL parameters, browser state beyond entry, logs, observability, prompts, task journals, screenshots, exports or client-readable database rows. Never return the raw key in an API response. Show alias, provider, model and a masked nonsecret fingerprint instead. Server-side account ownership is checked for every listing, test, routing, use, update and delete. Preserve only the required nonsecret audit receipt. Deleting a user removes its associated Vault references and secrets after proper authorization.

6. **Validated gateway and SSRF protection.** Only trusted server code, never browser code or the customer companion, makes key-bearing model calls. Enforce HTTPS and validated host, certificate, port and IP. Deny loopback/private/link-local/reserved IPv4 or IPv6, internal DNS and cloud metadata endpoints; block or revalidate every redirect; protect against DNS rebinding and IPv4-in-IPv6 encodings. Bound response bytes, stream lifetime, redirects, schemas and retry budgets. Do not let a custom URL relay privileged headers, cloud secrets or customer data to an unauthorized endpoint. Validate provider protocol compatibility, not just a successful HTTP 200.

7. **Explicit routing, consent and costs.** Each Chat or JARVIS run binds to one named permitted credential source and model policy. Customer choice: OCADE-managed, or a particular MY BYOK connection. Different defaults are permitted for Chat and JARVIS, but one must not silently replace the other. Fallback between model/provider/credential pools is off by default and requires explicit informed opt-in, compliant data region and provider, customer permissions and a known-safe continuation state. Users may be charged directly by their BYOK provider in addition to any OCADE subscription; show that plainly. JARVIS's single mutation controller and independently verified effects remain unchanged.

8. **Universal capability and provider contract.** Each adapter declares tool/JSON schema support, vision, streams, reasoning controls, roles, context/output limits, token usage, privacy requirements, quota/error semantics, endpoint options and model discovery eligibility. New authorized adapters and model records do not require edits to core planner, UI or fixed Gemini enums. A model discovered on an account is not automatically approved to operate a desktop. Qualify new provider/model combinations on synthetic tasks before enabling consequential agent use.

9. **Distributed health, quota and key routing.** Track health and lawful quota per project/account/model/key separately, with server-wide atomic reservations or leases so concurrent requests do not overallocate one quota. Distinguish invalid/expired keys, 401/403 permission refusal, payment/credits refusal, 429 temporary rate limits, daily or project-wide quota depletion, provider 5xx, gateway protocol incompatibility and connectivity failures. Honor valid Retry-After and resets, bounded backoff with jitter, rate budgets, fair tenant admission and circuit breakers. Only switch to an independently eligible key if the provider terms and explicit model policy allow it; never rotate to bypass a shared provider quota or unauthorized data restrictions.

10. **Truthful UI and revocation.** Show Not connected, Validating, Connected, Temporarily rate-limited, Quota exhausted, Credits unavailable, Invalid/revoked, Incompatible model/gateway, Disabled and Provider unreachable only when grounded in actual backend evidence. Display masked connection metadata, last successful check, per-surface permissions, current selected source and actionable fix guidance. Disable/delete immediately fences new and queued requests, and active steps are re-authorized before their next provider call. Never replay unknown PC operations after a failed model turn or model switch.

11. **Mandatory isolated tests before benchmarks.** Test at least 100 dynamic simulated key slots across multiple provider adapters without source changes; actual Settings BYOK add/test/save/replace/revoke/delete; owner import and isolation; different authenticated customers with the same provider; cross-account and admin denial; gateway SSRF with redirects/DNS rebinding/IPv6/metadata; secret exfiltration attempts; concurrent quota reservations; malformed tool schemas; 401/402/403/429/5xx/reset states; leaked-key detection in traces; fallback consent; STOP and unknown-effect non-replay; storage deletion and database RLS. Use disposable fake-key fixtures; any real validation needs separately authorized credentials and cost. Require the complete final website/companion GitHub CI GREEN on one exact commit before starting real-task benchmarks. Historical baseline model tests are preserved; additional providers are qualified separately.

12. **Single authority and evidence states.** Link these requirements to the existing 72-source-entry, 84-concept and 266-ID ledgers rather than creating duplicate implementation plans. This feature is CODED only after customer Settings, backend gateway, Supabase metadata/Vault lifecycle, routing and all caller paths work; BUILDS only after security tests and full CI pass; QUALIFIED only after independently demonstrated staging/provider behavior. Merely editing this plan leaves runtime code and Supabase production unchanged.

### 14B.1B. Non-conflicting BYOK and OCADE-funded AI, Base URL semantics and transparent Chat/JARVIS limits (P0)

**Non-negotiable invariant:** Customer-selected BYOK credentials never authorize consuming OCADE's provider credentials. A task using OCADE-managed inference never silently calls another customer's BYOK key. This applies to ALL model-mediated work: planner, specialist agents, AI verifier, summary, title, image/vision, compaction, embeddings, retries, recovery and scheduled work. BYOK provider charges belong to the customer; OCADE platform subscription or workflow charges, if any, are separately and truthfully disclosed. No attempt to circumvent upstream provider limits.

1. **Immutable credential-source binding.** The server-side task/turn authority pins account, surface (Chat/JARVIS), credential source (customer_byok or ocade_managed), credential ID, provider, protocol, model, base-URL profile, provider account/quota group, billing party, consent revision, STOP epoch and budget reservation. Browser or model parameters cannot grant or silently change any of these. Changes require a separately authorized new model turn; pending tasks are not silently migrated.
2. **Hard prohibition on subsidized hidden calls.** BYOK-only tasks must make **zero calls using OCADE-funded LLM provider keys**, including helper models, summaries, verification, transcription or recovery. Use qualified customer BYOK models or deterministic local operations. If required BYOK capability is missing, pause with a specific explanation; never use an OCADE-funded backup. Test this at the trusted gateway/ledger boundary rather than merely inspecting labels. User BYOK tokens do not deduct OCADE-managed model allowance, though distinct product workflow allowances can apply only under disclosed billing rules.
3. **Distinct usage and accounting.** Write append-only per-call records for source, credential ID, customer, provider account/project/quota group, model, caller kind (planner/agent/verifier/chat), tokens, returned provider cost or clearly labeled estimate, retries, infrastructure charges, and OCADE product credits (separately). Atomic reservations prevent concurrent leakage or misattribution. BYOK calls cannot increase owner-funded inference counters, and owner-funded calls cannot draw BYOK quota. A project shared by two of the same owner's keys still shares actual provider quota.
4. **Always-visible source in Chat and JARVIS.** At the composer and during tasks show exactly 'OCADE-managed' or 'Your key: [connection alias]', selected model, health and task-scoped usage. Show accessible nonsecret status on partial failures; allow an explicit 'Change connection' action after revalidation. Never imply that a source changed automatically. JARVIS STOP/Take Over remain available when models fail; permissions and journal authority do not depend on any model.
5. **Truthful provider limits.** Show provider-reported RPM/TPM/daily requests/tokens, credits and reset only when genuinely available, with observation time, units and 'provider reported' label. Otherwise display 'Remaining provider quota: unknown' plus optional 'usage observed by OCADE' (not misrepresented as provider-wide usage). Distinguish temporary 429 rate limit, project quota exhausted, expired/revoked key 401, missing model/scope 403, billing/credits denial, unsupported schema, custom gateway blocked, provider 5xx and timeout. Do not make a fabricated countdown or claim unlimited free API calls. Each error identifies the affected connection source, next safe action and whether a retry is permitted.
6. **Explicit Base URL / Gateway URL field.** Settings > BYOK offers provider-specific approved presets, provider-specific path/version/deployment fields, exact wire protocol selection (e.g., OpenAI Chat Completions, OpenAI Responses, Anthropic Messages or Gemini) and a tightly validated custom HTTPS gateway option. Do not treat arbitrary URLs as OpenAI-compatible, assume every provider uses /v1, or append fixed /chat/completions without protocol qualification. Bound timeouts, response sizes, redirects, schema depth, headers and retry budgets. No arbitrary secret-bearing URL queries or unconstrained header injection.
7. **Server-side gateway SSRF protection.** Validate HTTPS certificates and host/IP/port before dialing; reject private/link-local/reserved/loopback IPv4 and IPv6, encoded IPs, internal DNS and cloud metadata; block redirects or re-check every hop, and defend against DNS rebinding with connection-time address checks/approved egress. Credentials never pass through the browser or untrusted tools. A future local-device gateway requires a separate explicitly authorized companion-local transport; a Supabase function must not call private network addresses.
8. **Per-source errors and isolation.** BYOK health failures never mark an OCADE key unhealthy and vice versa; per-model cooldowns do not clear when a sibling succeeds. Different customer's key never appears in candidate selection, routing, analytics or health history. Two tenant accounts using the same vendor remain isolated even if endpoint/model names match. Revocation fences queued calls and rechecks active turns before the next model request.
9. **No unapproved fallback.** Default cross-credential-source failover is disabled. Within BYOK, other customer-owned keys are eligible only after explicit selection/permission and compatible region/provider terms. Changing to OCADE-managed requires informed approval about provider, data handling and any product charges; changing to BYOK requires approval about the customer's external provider fees. Model-switch reasoning may continue only after reconciliation; unknown desktop/browser effects are never repeated automatically.
10. **Mandatory end-to-end test contract.** With owner keys O1/O2, Alice BYOK A1/A2 and Bob BYOK B1, exhaust OCADE-managed quota while Alice runs concurrent BYOK Chat and JARVIS; assert zero owner-key network calls, unchanged owner inference quota/counters, unchanged Bob usage, truthful Alice 429/402/401 errors and safe partial outputs. Reverse the test for OCADE-managed Chat/JARVIS so no user key is used. Probe planner, specialist agents, verifier, summaries, recovery and model-switching; include 100+ dynamic key records, quota races, account deletion, leak scanning, malformed Base URL/SSRF, and STOP under outage. Show no false remaining-quota number. A fake-key pass is coding evidence, not a real provider quota guarantee.

**Release requirement:** Build the Settings UI, authenticated model gateway, secure Supabase credentials and these accounting/authorization checks; require full WEBSITE + companion mandatory CI GREEN on the identical candidate SHA. Documentation is NOT CODED, BUILDS or QUALIFIED proof.

### 14B.2. Offline Chat, local model, and website offline operation (code now; LAST benchmark suite later)

1. **First-time setup.** Provide a clear download/setup flow with model size, RAM/storage/device support, expected resources and customer acceptance; download all model shards, tokenizer files and website assets, verify hashes and manifest versions, and report offline-ready ONLY after a genuinely disconnected local self-test.
2. **Offline website.** Use service-worker/app-shell caching and navigation fallback so the prepared OCADE website opens in supported Chrome/Edge and Android browsers with Wi-Fi and mobile data disabled. Handle refresh/reopen, signed-out behavior, cache corruption, browser storage eviction, update rollback and insufficient quota; never promise offline reliability without a tested support matrix.
3. **Local inference.** Run the installed model on the customer device through supported WASM/WebGPU or other approved on-device runtime as capability allows; never pretend that cloud API calls are local. Preserve private local history, STOP, data delete and no-network verification, including actual runtime failure messages.
4. **Connectivity isolation.** With no internet: lock cloud-dependent Online Chat and cloud JARVIS accurately; allow functioning offline Chat after complete first-time setup; avoid confusing failed connectivity checks with claims of a successful offline model download. On reconnect, update state without duplicating/losing local chat.
5. **Cross-device scope.** Test Windows 10/11 Chrome/Edge, macOS supported browsers, Android Chrome/airplane mode and relevant iOS/Safari constraints only when supported. Do not infer functionality from an emulator alone; real-device checks are release evidence.
6. **Test ordering:** All offline-mode code must be finished and locally regression-tested before the full-site green gate; the **actual model-download, internet-disconnection, offline-site reopen and local inference benchmark suite runs LAST**, after JARVIS and online Chat benchmark campaigns. A failure reopens coding, reestablishes complete green CI on the new SHA, then reruns the affected suite. Treat unavailable real-device permissions as explicit blockers, not passes.

### 14B.3. Settings customization and truthful task progress

1. **Settings:** complete theme (dark/light/system), restrained colors, contrast, type size, language where supported, accessibility and reduced-motion preferences, model selection/availability, a sixth dedicated BYOK Settings category and secure Gateway URL/key manager (Part 14B.1A), device management, app connections, task permissions, account/profile, data export/deletion, local offline model/storage and troubleshooting. Each setting must persist appropriately, survive reload and enforce access boundaries.
2. **Normal customer language:** During active tasks show human descriptions such as “Checking files”, “Preparing workbook”, “Waiting for permission”, “Verifying output”, “Stopped safely”. Never expose internal source filenames such as `jarvis.py`, `planner.server.ts`, a Git commit, stack trace, token, provider-secret slot, internal URL or raw tool identifier in ordinary customer progress/watermark text. Keep a separate permission-controlled redacted diagnostic view for developer troubleshooting. Do not conceal that an AI/companion is controlling the PC; keep clear STOP and activity visibility.
3. **Brand colors:** apply a coherent near-black/graphite visual system with electric cobalt and forest-green accents only where legible and useful. Verify light/dark contrast and semantic status colors. Real task completion and permissions take precedence over decorative design.
4. **Page and control audit:** every route, menu, setting, button, modal, link, account state, device connection and chat task must have implemented behavior, testable outcome and truthful failure/recovery state; no fake demos or placeholder links presented as working.

### 14B.4. Mandatory UX principles applied to the ENTIRE site (34 distinct principles, deduplicated)

The owner demands that every named law be considered across all applicable screens. Treat 100% as full **audit coverage and justified application**, not the impossible assertion that every heuristic must appear in every component or that Doherty's 400 ms always includes network inference. For each principle, map relevant pages and actions to implemented design decisions, capture accessibility/usability tests and document nonapplicability. Related principles must not generate duplicate UI components.

1. **UX-01 — Aesthetic-Usability Effect.** Use a deliberate visual hierarchy, accessible contrast and coherent polish; test that users can still find real controls quickly. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-02 — Choice Overload.** Remove simultaneous competing choices; provide a primary action, then secondary paths only when needed. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-03 — Chunking.** Group long settings, permissions and task details into meaningful labeled sections. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-04 — Cognitive Bias.** Use neutral truthful labels for speed, success, safety and pricing; do not manipulate decisions with misleading defaults. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-05 — Cognitive Load.** Keep the active task screen limited to current goal, next action, progress and intervention. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-06 — Doherty Threshold.** Target perceptible feedback within 400 ms where feasible; differentiate UI acknowledgment from actual AI/desktop completion. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-07 — Fitts's Law.** Make primary mobile and desktop controls easy to reach and large enough for reliable interaction. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-08 — Flow.** Minimize interruption during safe authorized work and offer actionable status instead of intrusive popups. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-09 — Goal-Gradient Effect.** Show truthful verified milestone completion rather than a fabricated progress percentage. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-10 — Hick's Law.** Reduce options on model, settings and device pages through grouping and progressive disclosure. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-11 — Jakob's Law.** Use familiar login, navigation, file upload, task status and settings conventions. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-12 — Law of Common Region.** Use consistent visible boundaries around related controls, receipts and permission data. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-13 — Law of Proximity.** Place labels, validation errors and actions close to their associated inputs. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-14 — Law of Prägnanz.** Favor clear simple shapes and layout rather than unnecessary visual complexity. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-15 — Law of Similarity.** Use consistent iconography, sizes, labels and button treatments for comparable actions. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-16 — Law of Uniform Connectedness.** Visually connect related task steps and files with clear relationships. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-17 — Mental Model.** Match what customers expect from a safe computer assistant: instruct, authorize, monitor, stop, verify. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-18 — Miller's Law.** Use chunking and search instead of forcing users to remember long lists of controls. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-19 — Occam's Razor.** Prefer the smallest coherent interaction that solves the user problem without duplicate controls. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-20 — Paradox of the Active User.** Allow first-task completion without reading a manual; use concise just-in-time guidance. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-21 — Pareto Principle.** Measure and fix the top user errors and bottlenecks first rather than indiscriminately adding features. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-22 — Parkinson's Law.** Bound open-ended setup and task workflows by verifiable steps and sensible safe deadlines. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-23 — Peak-End Rule.** Make the final verified deliverable and recovery experience trustworthy, not just the initial animation. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-24 — Postel's Law.** Accept reasonable user input variability while validating and emitting strict safe actions. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-25 — Selective Attention.** Keep urgent STOP and approval controls distinct from optional notifications. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-26 — Serial Position Effect.** Place essential actions and outcome summaries at prominent first/last positions where helpful. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-27 — Tesler's Law.** Handle unavoidable configuration complexity internally but do not conceal consequential permission choices. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-28 — Von Restorff Effect.** Use restrained distinctive emphasis only for genuinely important controls such as STOP or warning. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-29 — Working Memory.** Preserve context, previous selections and task history so users need not remember transient state. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-30 — Zeigarnik Effect.** Clearly distinguish incomplete, interrupted and completed tasks; provide safe resumption. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-31 — Visual Hierarchy.** Prioritize one clear H1, one primary CTA, meaningful contrast and predictable reading order. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-32 — Progressive Disclosure.** Keep advanced models, integrations, logs and settings accessible without overwhelming newcomers. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-33 — Recognition over Recall.** Expose recent tasks, known devices and file selections instead of requiring names or commands from memory. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.
1. **UX-34 — Feedback Loops.** Every request and state transition gets clear success, error, progress and recovery feedback with honest timing. **Verification:** Include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.

### 14B.5. Exactly 16 API-key and credential protection checks

1. **KEY-01 — Environment storage.** Keep server-only API keys in approved environment/secret managers; never assume generic .env is sufficient protection. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-02 — Ignore local .env.** Exclude secret-bearing local env files from Git and distribution; scan tracked overrides. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-03 — No secret in frontend.** Move provider API calls containing secrets behind authenticated backend boundaries. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-04 — Public variable audit.** Enumerate public prefixed variables and verify none contain credentials. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-05 — Supabase service-role protection.** Never place a service role token in browser bundles, reports or public storage. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-06 — Git history scanning.** Scan relevant history, commits and artifacts for leaked credentials, including old revisions. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-07 — Incident key rotation.** Revoke and replace any confirmed exposed key; do not rotate unrelated keys without explicit authorization. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-08 — Repository secret scanning.** Enable available automated scanning and blocking at code review and CI. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-09 — Host-managed storage.** Provision secrets in authorized Supabase/GitHub/hosting dashboards, with separation of duties. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-10 — Least-privilege scopes.** Restrict each key by provider permissions, project, audience and resources. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-11 — Backend proxy.** Enforce authenticated, scoped, audited server access to provider APIs. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-12 — Screenshots and demos.** Scan images, videos, developer outputs and public examples for keys and private data. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-13 — Redacted logs.** Prevent secrets in task journals, errors, traces, analytics and observability. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-14 — Environment isolation.** Use different authorized key sets for development/staging/production. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-15 — Cost limits.** Set provider usage and spending ceilings with clear failure states and legal quotas. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.
1. **KEY-16 — No credentials in chat.** Never ask users/agents to paste privileged keys into chat messages or AI prompts. **Test:** Positive and negative secret-exposure checks in CI/staging; never print the secret.

### 14B.6. Exactly 19 SaaS/backend security hardening checks

1. **SEC-01 — Row-level security.** Verify database owner/tenant isolation for tables, storage and tasks with authenticated negative tests. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-02 — Authentication on routes.** Every sensitive API and Edge Function checks session and effective authorization, including admin operations. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-03 — Never trust frontend.** Validate roles, scopes, prices and permissions in trusted services regardless of UI validation. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-04 — Rate limiting.** Apply fair per-user/provider quotas and anti-abuse controls; do not circumvent provider limits. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-05 — Input validation.** Validate/sanitize untrusted inputs by context; protect prompt and command boundaries. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-06 — Parameterized queries.** Use bound parameters and eliminate unsafe SQL string interpolation. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-07 — Restrictive CORS.** Allow only intended origins/methods/headers and prevent credential reflection. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-08 — TLS everywhere.** Use HTTPS/WSS with secure cookies and correct forwarded-proxy handling. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-09 — IDOR defense.** Test every resource ID against server-side ownership and delegated access. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-10 — No production debug exposure.** Disable public debug routes, verbose stack traces and unprotected diagnostics. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-11 — Bot protection when applicable.** Use accessible bot-abuse defenses on public forms, without CAPTCHA on every page. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-12 — Admin action auditing.** Record privileged changes with tenant, actor, reason and tamper-evident evidence where feasible. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-13 — Private storage.** Secure bucket/object policies, signed URLs, deletion and file exposure rules. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-14 — Server enforced admin authorization.** Hiding an admin page is not protection; enforce server-side role checks. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-15 — Dependency hygiene.** Audit vulnerable packages, pin risk-sensitive dependencies and apply tested upgrades. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-16 — File upload protection.** Verify file type, size, content, path, scanning and processing limits. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-17 — Independent security review.** Run static scans, dynamic checks and adversarial tests; an AI-only review is not sufficient. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-18 — HTTP security headers.** Set appropriate CSP, HSTS, frame, MIME, referrer and permissions protections. **Test:** Automated negative-access, misuse and regression checks with evidence.
1. **SEC-19 — Webhook signatures.** Verify signatures and replay/idempotency for any external events used by OCADE. **Test:** Automated negative-access, misuse and regression checks with evidence.

### 14B.7. Consolidated web-design, conversion, launch and anti-template checks (duplicate user lists merged)

The original design checklists repeat some 30-item and 20-item lists verbatim. This group intentionally deduplicates them rather than treating repeated advice as extra engineering tasks. Visual clichés (Lucide icons, cards, Inter, dark colors, borders, emoji) are risk indicators **only in context**—not blanket bans, because inappropriate removal can reduce usability or accessibility. Every below item requires a grounded code/design defect before changing it.

1. **DESIGN-01 — Brand and color system.** Keep a restrained midnight/graphite base, forest-green and electric-cobalt accents where suitable. Audit low contrast, harsh gradients, neon rainbow combinations and confusing status colors; customize via tokens. Do not ban an icon or typeface merely because it is fashionable. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-02 — Typography and spacing.** Choose a coherent legible font family/pair, consistent line-height, measured whitespace, aligned grids, strong hierarchy, concise paragraphs and consistent radii; test at real desktop/mobile sizes. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-03 — Avoid template clichés.** Audit generic triple-card hero sections, repetitive bento grids, random gradient text, rainbow highlights, generic buzzwords, fake terminal mocks, decorative left stripes, radial orbs, dot grids, glassmorphism, grain and sparkle effects. Remove only when they hurt clarity, originality, performance or accessibility. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-04 — Responsible motion.** Use meaningful transitions, skeleton loaders for genuine delays and responsive hover/focus states; avoid unnecessary scroll-fade, cursor-following animations, perpetual arrows and misleading progress. Respect reduced-motion settings. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-05 — Honest product evidence.** Use real demonstrations, verified customer stories only with permission, authentic screenshots, clear service descriptions and no fabricated reviews, fake scarcity timers, false guarantees, hidden fees or unsupported achievements. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-06 — Navigation and customer orientation.** Provide tested header/footer, simple menu, responsive drawer, clickable logo, clear CTA per step, accessible site search where useful, meaningful back-to-top/scroll position, working contact links, no dead navigation or placeholder text. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-07 — Responsive and accessible operation.** Eliminate horizontal overflow, tiny tap targets, inaccessible dialogs, unreadable dark mode, weak color contrast and inconsistent mobile states. Provide keyboard/focus order, skip-to-content, alt text and usable touch interfaces. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-08 — Form correctness.** Implement explicit required fields, inline validation, password visibility, safe autofill, password recovery, meaningful errors, loading, success/confirmation dialogs and appropriate bot resistance. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-09 — Meta and discovery hygiene.** Correct page titles, descriptions, favicon, copyright year, canonical and social link preview, sitemap, robots, legitimate analytics and search-index controls for public pages only; avoid indexing private task files. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-10 — Content and conversion clarity.** Explain the exact audience, result, differentiator, privacy implications and realistic first action. Resolve objections in Help/FAQ; keep contact forms minimal, support routes visible and normal response expectations honest. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-11 — Performance and media.** Compress images without visible degradation, verify responsive loading, use skeletons rather than fake content, minimize font and bundle cost, measure typical page loads and first interaction; no universal unsupported guaranteed load time. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-12 — Account and help journeys.** Test landing → register → confirm eligibility → settings → connect device → first task → progress → deliverable → history → disconnect → data export/deletion, plus help, FAQ, errors and account recovery. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-13 — Customer disclosure and policy.** In-site detailed Terms/Conditions, Privacy, Cookie policy/consent, computer-control permissions, data retention/deletion, Help and FAQ with revision date, accessible long-form dialogs and separate route links. Refund policy only if payment flows actually exist; legal text requires qualified review before public launch. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.
1. **DESIGN-14 — Optional micro-features.** Apply dark/light toggle, copy, back-to-top, print stylesheet, sticky header, scroll progress, contact widget, optional WhatsApp, domain email and UTM tracking only if real customer use justifies them and they do not clutter the UI. **Acceptance:** Verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.

### 14B.8. Full customer lifecycle, help, policy and support completion

1. **Lifecycle:** first visit, onboarding, signup/login, secure password recovery, optional supported social login, pairing a Windows/macOS companion, permission grants, authorized task progress, STOP/Take Over, recovery, independent files, history, model and device settings, help, contact, data export/delete and account closure. Cover unauthorized and failure cases. No user is forced to install Docker/VM on their computer.
2. **Support and FAQ:** searchable, versioned, accessible Help and FAQ with installation, permissions, trusted device pairing, supported models, cost/usage disclosure, offline setup, failed tasks, model unavailability, contact and removal instructions. In-site long-form terms/privacy dialogs must also have accessible routes, full text, scroll/focus management and versioned consent. Qualified review is required for binding policy claims.
3. **Commercial optionality:** payments, refunds and billing must not be represented as working unless independently implemented and test-mode qualified; do not silently authorize paid services or live payment activation. Clarify nonbilling scope where owner approval is outstanding.
4. **Asset integrity and provenance:** no unlicensed stock, fabricated testimonials, misleading performance claims or borrowed copyrighted assets; check attribution and reproducible build assets. Official icon systems may be reused but styled deliberately.
5. **Public site health:** responsive Chrome/Edge/Safari checks, protected pages access checks, HTTPS, CSP, genuine privacy controls, metadata and link previews, search indexing of public-only routes, correct contact methods, backup drill, meaningful 404/500, safe robots rules, page speed and mobile performance measurement. Optional WhatsApp/chat widget only if actually supported and useful.

### 14B.9. Debloating and implementation proof BEFORE benchmarking

1. **Audit:** Identify exact existing owner modules and functions first. For each proposed addition, record which one is improved and which old duplicate is removed or retained. Verify callers and rollback before removing code. Never delete security checks, STOP, authorization journals, historical evidence or customer data. Preserve the existing 84 concepts and 266 IDs with mapped statuses.
2. **Source adoption:** Analyze all five linked repositories deeply; use useful tools/patterns where licenses, security, maintenance, performance and Windows/macOS support permit. Do not blindly import five complete projects, inflate bundle size or introduce parallel authorities. Record source link, commit, license, filename and accepted code changes for every adoption.
3. **Required proof:** CODED means code and callers exist; GREEN means full integration, typecheck, lint, format, build, database migration checks, server auth/security, frontend UI/customer workflows, native companion packaging and regression suites all pass. QUALIFIED means later real-device/real-task evidence. Tests may use mocks during coding but must not be presented as real task benchmarks.
4. **Hard benchmark gate:** Every mandatory JARVIS, online/offline Chat, account/settings, security, UI/UX, legal/help and source-integration item must be CODED, checked and no longer PARTIAL without explicit justified exclusion. The **ENTIRE OCADE SITE** and Windows/macOS companion must compile/build with all required GitHub jobs COMPLETED GREEN on the SAME FINAL SHA. A red/pending/skipped critical job blocks ALL real-task/cloud benchmarks. While CI jobs run, keep working on independent code and track each commit; fix all failures, rerun to green. After ANY benchmark repair, freeze a new SHA and rerun all required coding gates before further benchmarks.
5. **Qualification sequence:** After the full gate is green: (i) 16-run Gemini/Gemma baseline; (ii) JARVIS E1–E4 and Windows/macOS/cloud/real-device tasks; (iii) online Chat model/connection/cross-account stress and customer workflow qualification; (iv) full-site responsive/support/security/customer journeys; **(v) LAST: offline model download and true disconnected offline website/chat evaluation**. Record first-attempt pass, retry separate, wall-clock task time, p95, provider calls and all failures. Never count empty/hardcoded mock results as passed tasks.
6. **Status:** Track per-item actual implemented / tested / qualified / deferred evidence and report truthful product-wide public readiness X/100 only from explicit independently verified release gates. Do not claim 100% based on compiling or writing a plan. Deployment, new spend, external credential changes and main merge remain separately approval-gated.


## Part 14C. Consolidated elite architecture: 8 engineering + 8 differentiators + 10 owner upgrades + 12 verification upgrades (15 November 2026)

**38 trace entries, not 38 new subsystems or a claim of implementation.** Record every entry in one readiness ledger with existing module owner, source, priority, permission model, tests, performance/cost evidence and status. Deduplicate overlapping ideas at implementation time: there is ONE task controller, ONE permission authority, ONE privileged secret registry, ONE AI gateway, ONE verifier and ONE source-bound usage ledger. The four sets are preserved separately for traceability; cross-references to existing 72 repository lessons, 84 concepts and 266 requirement IDs must prevent double counting. First protect BYOK/OCADE noninterference, wrong-target safety, STOP and unknown effects; then optimize model calls, verified output, UX and actual business margin.

### 14C.1. Eight elite engineering improvements (ELITE-01 to ELITE-08)

- **ELITE-01 | P0 | Verified Outcome Contracts.** Capture approved artifact/output schema, exact preconditions, irreversible effects and independent acceptance oracle before executing; reject completion without receipt. **Acceptance:** Wrong totals or missing files cannot settle as completed.
- **ELITE-02 | P0 | Deterministic Workflow Compiler.** Compile repeated verified recipes into parameterized native/file/DOM execution with postcondition guards, semantic version checks and STOP fencing. **Acceptance:** Held-out repeated workflows use fewer model calls without reducing verified success.
- **ELITE-03 | P0 | Cost-Aware Model Router.** Choose authorized qualified model by observed cost per verified task, latency, capability and risk, honoring immutable BYOK/OCADE source. **Acceptance:** No cross-source inference call and lower cost at equal success on matched tasks.
- **ELITE-04 | P1 | Customer ProofPack.** Return editable deliverable with redacted source/changed-file hashes, discrepancies, verified checks, time and unresolved exceptions. **Acceptance:** Proof summary agrees with independent verifier and contains no secrets.
- **ELITE-05 | P1 | Certified Workflow Library.** Version, test, expire and revert successful customer-authorized workflows; preserve user edits and do not memorize raw selectors/secrets. **Acceptance:** Cross-file regression and changed-app tests prevent harmful replay.
- **ELITE-06 | P1 | Business Workspaces and Approvals.** Use existing organization/permission schema for client isolation, maker/checker approval, scoped sharing and activity. **Acceptance:** Unauthorized worker cannot read or approve another client's result.
- **ELITE-07 | P0 | Continuous Fault and Recovery Testing.** Inject crashed agent, interrupted write, network outage, stale UI target and quota exhaustion with documented recovery fixtures. **Acceptance:** Unknown effect never repeats automatically and STOP always fences new actions.
- **ELITE-08 | P0 | Contribution-Margin Optimizer.** Measure full cost per verified result including model, provider, infrastructure, retry, support, verification, refunds and revenue. **Acceptance:** Shared budgets and per-workflow margin remain truthful when tasks fail.

### 14C.2. Eight defensible commercial differentiators (MOAT-01 to MOAT-08)

- **MOAT-01 | P0 | Accountant Reconciliation Beachhead.** Target one tested spreadsheet reconciliation, exception list and editable client report before launching broad feature catalog. **Acceptance:** Five consenting design partners demonstrate repeat use and correctness.
- **MOAT-02 | P1 | Vertical Outcome Packs.** Sell narrowly specified verified workflows and supported formats to accountants and service firms. **Acceptance:** Each pack documents scope, acceptance, errors, version and limitations.
- **MOAT-03 | P1 | Evidence-Led Marketing.** Publish only reproducible redacted before/after demonstrations and permissioned customer examples. **Acceptance:** Marketing claims match real tested outcomes and selected comparison conditions.
- **MOAT-04 | P1 | BYOK-Compatible Paid Value.** Charge for orchestration, deliverables, approvals, support and templates independently of which provider funds tokens. **Acceptance:** BYOK external charge and OCADE product charge shown separately; positive margin measured.
- **MOAT-05 | P1 | Permissioned Recurring Work.** Allow schedule only with fresh bounded permission, one occurrence claim and explicit revocation. **Acceptance:** Duplicate triggers cannot cause two business-side mutations.
- **MOAT-06 | P1 | Five-Minute First-Value Journey.** Offer a simple truthful onboarding flow and first verified local or cloud task; install companion only when required. **Acceptance:** Measure fresh-user setup time, success and drop-off rather than promise a universal duration.
- **MOAT-07 | P1 | Fair Competitive Proof Scoreboard.** Compare equivalent apps, budgets and task oracles against each repository/product with uncertainty. **Acceptance:** No unsupported beat-everyone claim; original failures remain included.
- **MOAT-08 | P2 | Accountant and Agency Distribution.** Pilot consent-based referrals and team/agency workflows before paid growth channels. **Acceptance:** Measure paid activation, retention, acquisition cost and account isolation.

### 14C.3. Ten owner universal-model improvements (OWNER-01 to OWNER-10)

- **OWNER-01 | P0 | Universal Model Gateway.** Register protocol adapters, compatible endpoints and approved models without changing the central JARVIS planner. **Acceptance:** A newly authorized provider passes contract tests with no central-code rewrite.
- **OWNER-02 | P0 | 100+ Dynamic API Keys.** Replace three static Gemini slots with secure Supabase owner registry and tenant-scoped BYOK refs. **Acceptance:** At least 100 fake keys concurrently stored/selected/revoked with no redeployment.
- **OWNER-03 | P0 | Intelligent Limit Detection.** Classify 401/403/402/429/5xx, project quota vs model rate, reset and billing separately. **Acceptance:** Correct provider-specific wait, replacement or refusal with no fabricated quota.
- **OWNER-04 | P0 | Model Capability Registry.** Record tool calls, schema, vision, reasoning, streaming, context, cost and residency per adapter/model. **Acceptance:** Unsupported model cannot silently run a restricted JARVIS tool.
- **OWNER-05 | P0 | Bounded Multi-Agent Coordinator.** Delegate independent reasoning with budgets and capability guards while preserving one PC mutation authority. **Acceptance:** Solo-versus-delegated outcomes and overhead recorded; cancellation propagates.
- **OWNER-06 | P0 | Safe Model Switching.** Preserve selected credential source, privacy, journal and effect state across any authorized model handoff. **Acceptance:** No unknown external effect is replayed, including under failover.
- **OWNER-07 | P1 | Measured Intelligent Routing.** Calibrate success, context requirement and latency per task family using held-out tests. **Acceptance:** Cheaper/stronger model chosen only when objective results justify it.
- **OWNER-08 | P0 | Persistent Multi-Hour Checkpoints.** Persist goals, DAG progress, permission epochs, outputs, job state and verified receipts. **Acceptance:** Resume after sleep/crash only after re-observation and authorization.
- **OWNER-09 | P0 | Distributed Reliability and Quotas.** Use atomic per-account/project reservations, fair concurrency and bounded backoff across server instances. **Acceptance:** 100 concurrent simulated requests do not overbook any shared allowance.
- **OWNER-10 | P0 | Universal Integration Tests.** Test 100 keys, provider adapters, malicious base URLs, rate errors, tenant isolation and source funding. **Acceptance:** Full website, server and companion CI green on one commit before benchmarks.

### 14C.4. Twelve verification-first engineering improvements (VERIFY-01 to VERIFY-12)

- **VERIFY-01 | P0 | Proof-Carrying Execution.** Bind each side effect to grant, user, device, target, state, STOP epoch and independent outcome receipt. **Acceptance:** Forged, stale, wrong-window or wrong-user receipt rejected.
- **VERIFY-02 | P0 | External-Effect Reconciliation.** When send/save/submit is uncertain, inspect the target; use compensating action only if safe, approved and verifiable. **Acceptance:** A lost acknowledgement never causes duplicate submission.
- **VERIFY-03 | P0 | Universal PC Capability Broker.** One typed interface prefers native object/file API then scripts, DOM, accessibility and capture-bound vision. **Acceptance:** Same task completes by safe fastest supported route with one authority.
- **VERIFY-04 | P0 | Production Multi-Model Orchestration.** Maintain source, provider, quota group, region, model qualification and cost in all agent subcalls. **Acceptance:** BYOK task consumes zero OCADE-funded inference, even for helper models.
- **VERIFY-05 | P0 | Workflow Compilation and Replay.** Parameterize successful execution with pre/postconditions and invalidate stale app states. **Acceptance:** Repeat task outcome equals independent baseline across new inputs.
- **VERIFY-06 | P0 | Domain-Specific Verifier.** Check workbook formulas/totals, editable documents, browser postconditions, software tests and creative formats. **Acceptance:** Existing but incorrect file remains failed; no fictitious success.
- **VERIFY-07 | P1 | Failure Replay Laboratory.** Store redacted fixtures, capability versions, event order and failure outcomes for replay without real credentials. **Acceptance:** Injected failure reproducible with same seed and no customer data leakage.
- **VERIFY-08 | P0 | Adversarial Resilience.** Test prompt injection, cross-tenant access, SSRF, credential escape, stale clicks and cancellation races. **Acceptance:** Untrusted data cannot grant permissions or trigger an unsafe effect.
- **VERIFY-09 | P1 | Model Drift Protection.** Shadow-qualify changed model endpoints, schema and privacy terms before enabling new route. **Acceptance:** Incompatible provider change disables unsafe candidate cleanly.
- **VERIFY-10 | P0 | Transactional Take Over and Resume.** Fence old controller, let user edit, then reobserve and validate new lease/permissions. **Acceptance:** Late old agent cannot overwrite human work.
- **VERIFY-11 | P1 | Evidence-Gated Releases.** Canary and rollback under owner approvals, exact SHA/CI/test evidence and verified data restoration. **Acceptance:** Rollback drill succeeds without unauthorized deploy.
- **VERIFY-12 | P1 | Matched Independent Benchmarks.** Report reproducible first-attempt success, p95 time, unsafe acts, user interventions and full unit cost. **Acceptance:** No universal 100% superiority assertion without matched data.

### 14C.5. Merge into existing OCADE code owners; no duplicate engines

- **Single task authority and journal:** ELITE-01/07, OWNER-05/06/08, VERIFY-01/02/08/10 and MOAT-05 extend existing planner, supervisor, permission grant, STOP/cancel, local journals and receipt validation, not a new executor.
- **One AI gateway and Supabase secret/usage boundary:** ELITE-03/08, OWNER-01/02/03/04/07/09/10, VERIFY-04/09 and MOAT-04 extend existing edge-handler, model-adapter, quota and budget owners. Part 14B.1B is a strict precondition. No BYOK request may use owner-funded inference keys anywhere in its call graph.
- **One native-first computer control stack:** ELITE-02, VERIFY-03/05, CUA capture-bound target checks and UFO dependency-aware resource leases must flow through existing PC companion, tool contracts and server task authority.
- **One independent verifier, receipt and Library:** ELITE-01/04, VERIFY-06 and MOAT-01/02/03 share output-specific acceptance oracles; a model writing a proof summary cannot self-certify it.
- **Existing task precedents and schedules:** ELITE-02/05, OWNER-05/08 and MOAT-05 use versioned and sandbox-tested recipes without hardcoded app or customer identifiers.
- **Existing Settings, Chat, JARVIS and organization rights:** ELITE-06 and MOAT-04/06 require an actual sixth BYOK Settings category, clear source/limit states, controlled approval and honest payment disclosure.
- **Existing CI, telemetry and release gates:** ELITE-07/08, MOAT-07, OWNER-10 and VERIFY-07/08/09/11/12 use deterministic fixture replay, stress tests, redacted traces and date/commit-qualified results; no false green checks or staged mocks presented as real-world passes.
- **Commercial rollout:** MOAT-01 through MOAT-08 remain experiments tied to observed recurring value, support load and positive contribution; no paid launch or communications without approval and applicable legal readiness.

### 14C.6. Five competitor source implementations: extra mechanisms to adopt, not wholesale engines

1. **Hermes Agent.** Main-branch files agent/credential_pool.py, hermes_cli/runtime_provider.py, hermes_cli/checkpoints.py. Source patterns: persistent credential health states including permanently dead vs temporarily exhausted, classification-aware/reset-aware cooldown, per-model failure scope, careful refresh persistence, bounded selection and checkpoint cleanup. Adopt in a secure Supabase multi-tenant registry only after testing; never equate different keys with independent project quota. https://github.com/NousResearch/hermes-agent
2. **OpenClaw.** Main-branch src/agents/auth-profiles/order.ts, usage-state.ts, credential-state.ts, advance.ts. Source patterns: auth-profile eligibility, explicit provider matching, OAuth refresh fencing, model-scoped cooldown versus provider-wide billing blocks, candidate advancement and reason-coded diagnostics. Adapt to strict user-versus-owner funding pool isolation and consent; do not copy unrestricted fallback behavior. https://github.com/openclaw/openclaw
3. **CUA.** Main-branch libs/cua-driver/README.md and docs/perception-extension.md. Source patterns: versioned typed desktop/MCP driver, background accessibility where supported, capture/snapshot identity on visual targets, stale-capture refusal and reobservation. Review licensing, especially optional AGPL perception assets, before considering code reuse; never force Docker/VM on customers. https://github.com/trycua/cua
4. **UFO³.** Main-branch galaxy/README.md, galaxy/constellation/__init__.py, ufo/llm/base.py. Source patterns: dependency-checked typed DAG nodes, bounded dynamic graph edits, capability-based agent/device placement, safe asynchronous locks and provider-specific model adapters. Keep original OCADE authoritative task graph and forbid permissions or funding-source expansion during DAG rewrites. https://github.com/microsoft/UFO
5. **Nod.** Main-branch src/ports/models.ts, src/providers/pi/models.ts and src/providers/pi/checkpoint.ts. Source patterns: provider-specific credential/endpoint types, dynamic model catalogs, request cost reserve/settle contract, model capability deviations and fail-closed corrupt session checkpoint handling. Reuse trust boundary and UI principle without porting its entire agent runtime. https://github.com/n8n-io/nod
6. **All source adoptions:** Record source URL/path, inspected revision, exact licensed scope, threat model, proof and rollback in existing REPO-01..72 ledger; no claim of reading every file in all five and no source code automatically assumed compatible.

### 14C.7. Additional elite strategies beyond the 38 (commercially justified; not an excuse for feature bloat)

1. **STRAT-01 | P0 | Cost-to-verified-success admission.** Predict and reserve a bounded per-task spend allowance including delegated/verification calls before work starts; cut off or explicitly ask for approval if exhausted. Accept: shared atomic budget is never exceeded under 100 concurrent simulations.
2. **STRAT-02 | P0 | Calibrated uncertainty and human escalation.** When the verifier cannot determine whether an irreversible effect happened, explain uncertainty and request narrow intervention; never claim DONE or retry blindly. Accept: zero duplicated effects under unknown-outcome fault injection.
3. **STRAT-03 | P1 | Workflow-semantic version quarantine.** Track application capability, provider protocol and checker schema versions; invalidate a learned workflow on relevant drift. Accept: old version fails safely until requalified.
4. **STRAT-04 | P1 | Domain-specific success and support tier.** Offer optional additional reviewer/coverage only after measuring its real costs and verification benefit; no guarantee of perfection. Accept: every sold tier clearly identifies supported tests, limits and response conditions.
5. **STRAT-05 | P1 | Outcome-based customer success dashboard.** Track verified minutes saved, weekly repeat use, correction count, service cost and ROI estimates labeled as such. Accept: customer-visible claims trace to observed proof and survey data.
6. **STRAT-06 | P2 | Privacy-preserving partner distribution.** Offer referral/agency workflows with explicit customer permission and redacted sample ProofPacks; never share customer keys, account data, cookies or internal device logs. Accept: partner has no access to another client without grants.
7. **STRAT-07 | P2 | Conditional integration/API channel.** Only after measured repeat product-market fit, consider a single outcome-based API/agency portal that uses the same permission, verifier, BYOK accounting and rate controls. Accept: real qualified demand and positive contribution before build.
8. **STRAT-08 | P1 | Open compatibility and certification matrix.** Publish per-model/adapter verified tool, vision, schema, latency, error and privacy compatibility without model-name marketing; model discovery alone does not certify JARVIS desktop control. Accept: controlled synthetic regression before enabling consequential tasks.

### 14C.8. Acceptance and profit/reliability order

- **P0 before final cloud task benchmarks:** safe side effects, source-bound BYOK/owner usage and Base URL SSRF, key secret isolation, all Chat/JARVIS model-subcall budget attribution, independently verified deliverables, nonduplicating effects, replayable critical regression tests, >=100 simulated key records, full-site/companion green CI on exact SHA.
- **P1 before commercial growth claims:** calibrated quality and cost routing, 7/30-day retention, margin by task and source, tested owner/customer experience, stable incident process, competitive benchmarks and transparent truthful product charges; optional P2 partner/agency features only after positive observed evidence.
- **Customer-business economics:** contribution per verified task = realized product revenue less model expense actually paid by OCADE, hosting, verification, provider/integration, retries, support, payment/refund and other variable costs. BYOK model fees belong to the customer's vendor account, but OCADE work still has platform costs and published workflow charges. Do not label usage free or profitable without receipts.
- **Competitive claims:** benchmark on matched environments and identical signed objectives, with first-attempt success, p95 completion time, cost per verified success, unsafe effects, interventions, support and uncertainty. Never assert OCADE is 100% better than all five without independently reproduced representative evidence.

## Part 15. Performance and resource targets (all measured on at least 30 tasks per category; none achieved yet)

15.1. A simple task, with at most three effects, takes at most 15 seconds at the median and 35 seconds at the 95th percentile. The measured median today is 37 seconds across all tasks.

15.2. Model calls per task are at most three for simple tasks, six for medium tasks and a budgeted 40 for creative work. Today the median is six.

15.3. A planning turn carries at most 4,000 input tokens typically and 8,000 at worst. Today it is about 15,000.

15.4. Unaccounted time is at most 5 percent; today it is 35 percent. Claiming an action while a task is active takes at most half a second at the median.

15.5. The companion is ready within two seconds of a cold start. Idle, without a browser, it uses at most half a percent of CPU and 150 megabytes of memory.

15.6. Every report records:
- first-attempt success;
- median and 95th-percentile time;
- customer interventions;
- model calls, tokens and cost;
- recovery outcomes;
- wrong-target incidents (must be zero).

## Part 16. Competitor benchmark method (requirement 259)

16.1. **The test.**
- Twenty identical, reproducible tasks with hidden answers, across files and office work, browser work, desktop applications and a long job.
- The same seeded inputs and the same hosted Windows and macOS images.
- One injected fault per task, to measure recovery.

16.2. **The competitors.** OCADE is run, and so is every competitor product the owner can lawfully access within its terms: ChatGPT agent and OpenAI Dots, Claude's desktop computer use, Codex, Gemini, Manus, Microsoft Copilot, Cursor and Devin. Paid plans are used only with approval.

16.3. **What is already verified about competitors.**
- Claude offers desktop control on macOS and Windows.
- OpenAI Dots, Grok Bot and Meta Muse run on cloud computers, and Muse also has a Mac app. These come from mostly secondary sources.
- Gemini 4 Argon is in restricted, paid rollout, and Google's announcement names no computer-use benchmark.
- OCADE's strongest verified differences: the independent verifier, exact permissions, local execution and editable outputs.
- No claim of superiority is made until this benchmark runs with a published denominator.

## Part 17. Package P5: qualification and release evidence

17.1. After ALL mandatory coding and GitHub build checks are green, run the exact 16-run two-model comparison specified once in the preserved historical benchmark specification (Appendix H), with current authorizations and staging boundaries. A failed task triggers the autonomous safe repair loop in Part 24; routine reruns inside the approved test scope do not need discretionary reapproval. Record both original failure and successful repair separately.

17.2. Run E1 to E3. Run E4 with at least 100 hidden tasks over at least three days. It must reach at least 90 percent first-attempt success, and the target is never lowered.

17.3. Run real-computer qualification on Windows 10, Windows 11 and macOS after approval A2 and completed hosted qualifications.

17.4. For EVERY failure, retain the failure evidence; investigate root cause; implement a general, non-hardcoded correction; rerun complete-site coding/build/security gates until all green on the new SHA; then rerun the failed task and affected category on the same defined oracle. Never reclassify a retry as first-attempt success. Record commit, environment, actual task duration, model latency, tool usage, corrections and independent verification. Repeat within approved safe test permissions and resource limits until acceptance or a precise blocker.

17.5. **Required benchmark order, after whole-site GREEN CI:** (1) initial two-model 16-run comparison; (2) JARVIS E1–E4 real-task, cloud Windows/macOS and approved actual-PC qualification; (3) authorized additional-model compatibility tests; (4) online Chat, customer account/device/settings, security and full-site responsive workflows; **(5) LAST: local offline-model download, actual internet-off/browser-reopen website test and offline-chat inference on supported Windows/macOS/Android devices.** A failure returns to coding, requires a fresh all-green full-site SHA and then reruns affected tests. No prior CI-only mock is a real-world pass.

## Part 18. JARVIS operating resources

18.1. Complete JARVIS coding and whole-site compilation using existing authorized resources.

18.2. Keep secure rate limits, legitimate AI quotas, minimal model input, usage ceilings and clearly recorded test resource consumption. Do not bypass project quotas or move customer data into disallowed model tiers.

18.3. Missing approved GPU capacity, staging environment, credential access or real-device test permission is reported as a specific qualification blocker rather than patched with fabricated results.



## Part 19. Owner approvals and decisions required

19.1. Authorized model-provider access, compatible customer-data safeguards and a resource budget. This resolves section 2.6 and conflict C1.

19.2. Confirm Flash-Lite as the single customer model, and Gemma as evaluation-only (conflict C2).

19.3. The meaning of "specialised agents" (conflict C3).

19.4. Session-mode idle exit time and the always-ready default (conflict C4).



19.7. Deploy `ocade-intelligence-service` to production only after staging qualification (section 2.7).

19.8. Per-run approval for staging benchmarks (B1), the Windows and macOS runner environment (A1) and real-computer tests (A2).

19.9. Archiving the research tooling (item 14.3).

19.10. Background accessibility actions (item 13.2), and verified-route replay wording under O8 (item 13.1).

19.11. The original wording of owner requirements 72, 73, 86 and 87.

19.12. Production deployment and any `main` merge remain separately approval-gated.

## Part 20. JARVIS engineering GO / NO-GO

20.1. Current status is NO-GO for public deployment until runtime evidence is independently verified.

20.2. **Complete OCADE product release acceptance (100/100% independently verified technical readiness)** requires all mandatory Part 14A and 14B integration, JARVIS, Online Chat, Offline Chat, settings, UX, security, Help and policy implementation, all customer workflows, entire OCADE website and companion compiled, all required GitHub CI green on the identical candidate commit, all critical/security defects resolved, STOP/Take Over and permission gates proven, safe companion installation/upgrade/uninstall, independent deliverable checks, full hosted/real Windows/macOS qualification, benchmark acceptance (including E4 ≥90% first-attempt success) and complete JARVIS customer journeys.

20.3. **Engineering readiness is not authorization to deploy.** A public release still requires explicit owner authorization, regardless of its technical score.

20.4. In every substantive report show **JARVIS technical readiness: X/100%** with commit and evidence source. If no valid engineering readiness calculation exists, report UNVERIFIED, not an invented percentage. Coding complete, CI green and benchmark passes are distinct evidence.

## Part 21. Conflicts and unresolved decisions

21.1. **C1.** The no-spend goal may conflict with permitted model capacity and backup resources. Verify actual limits, secure customer-data handling and authorized resource budgets under approval 19.1.

21.2. **C2.** O2 permits Gemma 4 31B, but customer-data suitability and task reliability are unverified. Use it only for approved evaluation data until those conditions pass.

21.3. **C3 — latest owner override.** Multi-agent runtime delegation is now mandatory. Preserve one authoritative computer mutation controller, scoped deterministic tools and cancellation; use bounded specialist model agents only for independent subtasks. The two original models remain the baseline test pair, but the API must be universal and allow future qualified models. Do not create a second task authority.

21.4. **C4.** Requirement 62's exit-after-task behaviour conflicts with instant pickup. Resolved by session mode staying alive while tasks or jobs run, plus an optional always-ready mode.

21.5. **C5 — resolved for this revision.** Preserve the legacy requirement/concept table formats in Appendices A–E because `scripts/jarvis-traceability.mjs` and `scripts/launch-readiness.mjs` depend on them. The explanatory plan remains pointwise, but traceability data retain their machine-readable row shape. Run both readers in CI; change scripts only if a future separately authorized migration is necessary.

21.6. **C6.** `CLAUDE.md` and the research tooling still refer to the removed submodules (VERIFIED by search). Resolution: item 14.3.

21.7. **C7 — updated model policy.** The original 16 baseline runs still evaluate one model at a time without hidden failover. The new universal provider registry permits further adapters only after explicit authorization and independent qualification; mixing models in one task requires an explicit task-level policy and must never silently change permission scope or retry unknown mutations.

21.8. **C8.** The blueprint's browser-extension proposal (R16) is withdrawn by the owner's decision of 14 November.

21.9. **C9.** The original text of owner requirements 72, 73, 86 and 87 is missing from the repository.

## Part 22. Reading coverage of this revision (honest record)

22.1. **Read in full in these sessions:**
- `AGENTS.md`, `CLAUDE.md`
- `docs/research/OCADE_SOURCE_REVIEW_2026-11-14.md`
- `evidence/source-research/REPORT.md`, `tools/source-research/README.md`
- `src/lib/jarvis/planner.server.ts`, `src/lib/intelligence/edge-handler.ts`

22.2. **Read in part:**
- `plan.md`: lines 1 to 1030, 1235 to 1271, 1272 to 1470, plus Appendix E's state counts.
- The 246-repository blueprint: lines 1 to 819 and 2993 to 3040, plus every heading.
- The architecture review: lines 1 to 70.
- `contracts.ts`: lines 1 to 520 and 1164 to 1240.
- `windows_worker.py`: lines 150 to 494.
- `web_worker.py`: lines 120 to 279 and 540 to 709.
- JARVIS model usage controls and `online-models.ts`.

22.3. **Not yet read, and to be read in staged sessions with a recorded log** before this plan is called exhaustive:
- remaining documentation and non-JARVIS source files are not covered by the historical read ledger;
- `plan.md` Appendix A's verbatim requirement text (lines 1031 to 1234), Appendix C and the Appendix E entries;
- most of `src`, `device-agent`, SQL migrations and the tests; do not claim exhaustive line-by-line review.
The 41-repository integration research (`docs/OCADE_INTEGRATION_RESEARCH.md`) and the repository ledger have not been read beyond their headings.

22.4. **External source code** read during research is no longer stored locally, because the submodules were removed. Findings cite the repository, path and pinned commit, so they can be re-checked by cloning.

22.5. **Applying this revision.** Preserve the Appendix A–E machine-read structures and check the associated scripts without altering their semantics. The original v7 file is archived verbatim; this plan includes the active tracking appendices and one exact preserved benchmark specification. Green CI will be required before P5 benchmarks, but CI was not run merely by committing documentation.



## Appendix A — Historical 266-ID requirement ledger (active JARVIS entries and archived out-of-scope entries)

**Active view:** the 189 requirements that are not yet RUNTIME VERIFIED are listed below, verbatim. The 77 that are (`PASS`) are archived verbatim with their evidence in [archive Appendix A](docs/archive/plan-v6-2026-11-07.md): 1, 2, 4, 5, 6, 9, 11, 12, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 30, 36, 39, 41, 42, 43, 47, 53, 64, 79, 80, 84, 89, 93, 94, 95, 102, 109, 136, 137, 141, 145, 154, 171, 173, 174, 178, 183, 184, 196, 198, 203, 213, 225, 234, 239, 240, 241, 244, 245, 246, 248, 249, 250, 251, 252, 253, 254, 256, 257, 258, 260, 261, 262, 263, 265, 266. They stay requirements (O7) and the standing ones are still checked at every gate (§15).

`PASS` here means RUNTIME VERIFIED. Coding status (NOT CODED, CODED, BUILDS) is tracked separately in Appendix E, so a coded requirement is never shown as verified before qualification.

Format: `STATUS` · **destination** — original text. Status source: independent re-audit at `f04228d`, plus W1 promotions of 36, 39, 41, 80, 171 and 216 with [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177) and `evidence/2026-11-02-recovery/`, and W2/W3 promotions of 30 (mechanism fallback), 94 (live round-trip profile before and after each change) and 137 (shell, engine and diagnostic limits refused before running) with [run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402) (`evidence/2026-11-01-audit/requirements-266.md`, current-review column); it is the conservative lower bound. **S** = standing rule verified at every release gate. **RPC** = needs real-PC validation. **COM** = commercial phase. **W14** = optional Linux; never counted as PASS without evidence and never blocking Windows/macOS release.

Original preamble (1 November 2026): this owner checklist complements the 84 concepts; it does not authorise merging into main, production deployment, payments, certificate acquisition, spending, irreversible changes, or exposing secrets. Preconfigured staging credentials may be used for authorised staging tests with least privilege and strict non-disclosure.

#### OCADE — Complete Commercial Launch Readiness | Continuation Prompt

#### Rules and execution requirements

3. `PARTIAL` · **W13** — Your objective is to make **OCADE BY CARCC** a genuinely functional, independently verified, public-ready commercial software product across every officially supported component and platform.
7. `PARTIAL` · **S** — Read the current `plan.md`, `CLAUDE.md`, `AGENTS.md`, architecture ledger, prior evidence, tests, repository structure, and relevant implementation files before modifying an existing component.
8. `PARTIAL` · **S** — Inspect actual Git history, branch HEAD, local changes, staging configuration, package versions, workflows, tests, and unresolved blockers. Treat historical reports as evidence, not as proof of current functionality.
10. `PARTIAL` · **W0** — Maintain a verified inventory of every application surface, architectural concept, feature, dependency, security boundary, test, and release requirement.
13. `PARTIAL` · **W1** — Fix every reproducible critical and high-priority defect. For any unresolved issue, document the exact blocker and keep the release gate closed.
16. `PARTIAL` · **S** — Implement improvements in small, reversible, reviewable changes with focused regression tests. Run relevant tests after every change and broader tests after integration.

#### Architecture and execution

23. `PARTIAL` · **W4** — Preserve the configured model-routing policies and approved provider credentials. Validate actual model availability, quotas, limits, and failure behavior before making model changes.
28. `PARTIAL` · **W3** — Preserve the intended execution preference: native APIs and object models → supported scripts and CLI → native file/project operations → browser DOM/CDP → Playwright → OS accessibility → vision/coordinates when needed.
29. `PARTIAL` · **W3** — Choose the fastest reliable mechanism for each step based on actual capabilities, permissions, cost, observability, and failure risk.
31. `PARTIAL` · **W4** — Improve the supervisor so it maintains objective, target state, milestones, permissions, available capabilities, current observations, completed actions, unresolved uncertainty, and remaining work.
32. `PARTIAL` · **W1** — Store durable task state independently of Gemini's conversational context so interruptions and context truncation do not destroy progress.
33. `PARTIAL` · **W4** — Add a bounded receding-horizon planner: plan enough to act effectively, execute, observe the result, then replan only when necessary.
34. `PARTIAL` · **W4** — Separate **planning, action execution, result observation, and verification** into explicit interfaces and states.
35. `PARTIAL` · **W1** — Give every action a unique identifier, task identifier, target identity, permission context, deadline, and observable outcome.
37. `PARTIAL` · **W1** — Preserve receipts distinguishing **executed, verified, refused, failed, cancelled, and outcome unknown**. Never infer success from a dispatched command.
38. `PARTIAL` · **W1** — Improve persistent journaling, recovery checkpoints, durable action reconciliation, and crash-safe resumption.
40. `PARTIAL` · **W1** — Implement reliable ownership fences so STOP, Take Over, revocation, sign-out, device removal, and task cancellation prevent new unauthorized actions.
44. `PARTIAL` · **W9** — Add version negotiation and compatibility checking between the website/backend, Device Agent, Gateway, and bundled workers.
45. `PARTIAL` · **W9** — Refuse incompatible components with actionable upgrade instructions rather than continuing unpredictably.

#### Gemini accuracy and grounding

46. `PARTIAL` · **W4** — Fix the demonstrated Python.org wrong-download failure generically. Gemini must distinguish the correct release row, release version, artifact type, platform, architecture, and actual download target.
48. `PARTIAL` · **W4** — Build or strengthen an evidence-grounded **Target Resolution Layer** that connects model-selected intent to an observed, unambiguous DOM element, accessibility element, file, process, or application window.
49. `PARTIAL` · **W4** — Assign temporary observation-scoped identities to discovered elements so the model can refer to concrete targets without inventing coordinates or selectors.
50. `PARTIAL` · **W4** — Preserve useful target metadata: label, role, accessible name, href, text, containing row, nearby headings, bounds, visibility, selected state, and originating observation.
51. `PARTIAL` · **W4** — When several elements have identical names such as “Download,” use their surrounding table row, version, platform, and related attributes to disambiguate.
52. `PARTIAL` · **W4** — Require fresh observations before sensitive actions. Reject stale element references when pages, windows, documents, or processes have changed.
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

#### Execution speed and efficiency

81. `PARTIAL` · **W2** — Optimize for **fastest correct completed task**, not fastest unverified click.
82. `PARTIAL` · **W2** — Instrument planning latency, provider latency, tool startup, execution time, observation time, verification time, retries, and total elapsed task time.
83. `PARTIAL` · **W2** — Remove unnecessary Gemini calls, repeated tool discovery, redundant context generation, repeated file reads, and excessive screenshots.
85. `PARTIAL` · **W2** — Do not batch dependent writes or risky actions when intermediate verification is necessary.
86. `PARTIAL` · **W2** — Cache stable capability metadata, unchanged file hashes, tool schemas, and other reusable observations using safe invalidation rules.
87. `PARTIAL` · **W2** — Use targeted incremental observations rather than re-reading entire files, pages, or tool catalogs on every step.
88. `PARTIAL` · **W2** — Keep frequently needed workers warm where this measurably improves performance without compromising resource usage or STOP behavior.
90. `PARTIAL` · **W2** — Limit retries by error category, risk, elapsed time, and remaining task budget.
91. `PARTIAL` · **W2** — Optimize prompt and context composition without hiding critical observations, permissions, error information, or verification requirements.
92. `PARTIAL` · **W2** — Parallelize independent safe work only when process, file, window, and browser-target isolation can be guaranteed.
96. `PARTIAL` · **W2** — Measure median, p95 and p99 latency, model calls per task, retries, token usage, resource consumption, and completed verified outcomes.

#### Dependencies and runtime management

97. `PARTIAL` · **W9** — Build a **generic Dependency Manager** that identifies capabilities and prerequisites missing from the customer's environment.
98. `PARTIAL` · **W9** — Keep OCADE's own required runtime, libraries, and browser automation components bundled wherever supported. Customers must not need Python or developer tooling merely to start OCADE.
99. `PARTIAL` · **W9** — Distinguish bundled application dependencies from additional dependencies needed for a particular customer-requested task.
100. `PARTIAL` · **W9** — Detect installed tools and versions using reliable platform mechanisms rather than assuming a package exists because one executable appears in PATH.
101. `PARTIAL` · **W9** — Support discovery of relevant runtimes and engines such as Python, Node.js, Java, .NET, FFmpeg, LibreOffice, browser engines, and native application dependencies when tasks require them.
103. `PARTIAL` · **W9** — Inspect OS version, CPU architecture, package architecture, installation scope, existing versions, permissions, disk space, and network availability before proposing installation.
104. `UNTESTED` · **W9** — Support x64 and ARM64 where officially targeted. Treat x86 support as a deliberate compatibility decision with actual build/test evidence.
105. `PARTIAL` · **W9** — Prefer trusted platform package managers, verified vendor distributions, or controlled installation manifests when suitable.
106. `FAIL` · **W9** — Resolve required package version, operating-system support, architecture, integrity hash, authenticity, compatibility, and applicable licence before installation.
107. `PARTIAL` · **W9** — Never blindly run commands copied from unknown webpages or untrusted model outputs.
108. `PARTIAL` · **W9** — Show the exact package, source, version, destination, privileges, expected changes, and security implications before approval.
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
138. `PARTIAL` · **W13** — Do not mark any operating system fully supported until native installation, pairing, execution, STOP, recovery, and independent task verification pass on representative hardware.

#### Browser and application control

139. `PARTIAL` · **W8** — Dynamically discover the actual installed browsers and profiles. Do not assume Chrome, Edge, or a particular profile is available.
140. `PARTIAL` · **W8** — Bind automation to the authorized browser session, exact tab, origin, and target; never silently act in an unrelated session.
142. `PARTIAL` · **W8** — Detect navigation, popups, downloads, redirects, file pickers, permission prompts, authentication challenges, and dynamic content safely.
143. `PARTIAL` · **W8** — Respect anti-bot protections, authentication boundaries, website permissions, and security-sensitive user confirmations.
144. `PARTIAL` · **W8** — Ensure newly encountered applications can be operated through generic discoverable capabilities whenever their interfaces and permissions support it.

#### Customer interface and product features

146. `PARTIAL` · **W10** — Audit and complete Landing, Authentication, Chat, JARVIS, Library, Devices, Apps & Websites, Settings, Usage, and Owner/Staff administration.
147. `PARTIAL` · **W10** — Inventory and test every button, menu, link, route, input, modal, file upload, download, permission dialog, and state transition.
148. `PARTIAL` · **W10** — Make first-use onboarding simple: install, sign in, pair device, grant the specific permissions needed, and complete the first authorized task.
149. `PARTIAL` · **W10** — Show accurate device states such as Ready, local non-network, Permission Required, Busy, Disconnected, and Removed.
150. `PARTIAL` · **W10** — Provide live task progress with current action, completed steps, verified results, remaining work, and user intervention requests.
151. `PARTIAL` · **W10** — Display actual operation details in approval dialogs, not vague summaries supplied by Gemini.
152. `PARTIAL` · **W10** — Ensure STOP, Take Over, Continue, Retry, and Remove Device behave correctly and visibly.
153. `PARTIAL` · **W10** — Finish file delivery, download, preview, editing, and recovery flows for produced artifacts.
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
172. `PARTIAL` · **W11** — Verify database backups through actual restoration drills. Test infrastructure recovery, incident handling, and user-visible service failure behavior.

#### Security, privacy, and operations

175. `PARTIAL` · **W11** — Keep customer content private and separate from other accounts, support systems, model traces, and unrelated customer sessions.
176. `PARTIAL` · **W11** — Make logs useful but redact passwords, authorization headers, tokens, API keys, sensitive file contents, and private data.
177. `PARTIAL` · **W11** — Add structured crash reports, health checks, latency metrics, failure classifications, and diagnostics with privacy-respecting controls.
179. `UNTESTED` · **W11** — Ensure customer data export, account deletion, device revocation, and retention processes operate consistently with published privacy commitments and applicable requirements.
180. `EXCLUDED` · **ARCHIVE** — Historical document-writing requirement, not active JARVIS work; original in `docs/archive/plan-v7-2026-11-14.md`. Keep functional installer help and data protection.
181. `FAIL` · **W11** — Add release notes, troubleshooting documentation, support procedures, incident response, service status communication, and recovery instructions.
182. `EXCLUDED` · **ARCHIVE** — Historical documentation requirement; original in v7 archive. Dependency integrity and secure provenance tests remain active.

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
197. `PARTIAL` · **W4** — Preserve synthetic test fixtures and hidden independent oracles, but never reveal expected customer-task answers to the production planner.
199. `PARTIAL` · **W4** — Include real Gemini-controlled E2E tests rather than only mocked or scripted model responses.
200. `PARTIAL` · **W13** — Test actual spreadsheet reconciliation, document creation, coding repairs, browser research, file manipulation, image operations, video operations, and general PC tasks through reusable capability interfaces.
201. `PARTIAL` · **W4** — Select representative tasks from real customer problems; never special-case the examples in production code.
202. `PARTIAL` · **W4** — Measure first-attempt success, recovery-assisted success, final verified success, intervention frequency, wrong-target incidents, time per task, and model calls.
204. `PARTIAL` · **W4** — Create larger unseen evaluation sets with varying difficulty and fresh inputs. Prevent repeated retries on known fixtures from artificially raising reported success.
205. `FAIL` · **W13** — Require at least **90% independently verified real-task success** on the agreed representative launch suite, plus explicit platform-specific reliability gates.
206. `PARTIAL` · **S** — Require zero known critical security or safety defects, zero unauthorized actions, zero fabricated successes, and zero unresolved release-blocking failures.
207. `PARTIAL` · **W4** — Retest every previously observed bug, including wrong Python download, hallucinated versions, invented URLs, verifier gaming, repeated reads, and Python 3.12 subprocess hanging.
208. `PARTIAL` · **W13** — Repeat regression and integration tests under the actual runtime versions and binaries shipped to customers.
209. `PARTIAL` · **RPC** — Test Windows consumer desktops separately from Windows Server CI runners; test native macOS and supported Linux configurations separately.
210. `PARTIAL` · **W1** — Perform controlled crash, process-kill, network-loss, interrupted-update, permission-revocation, STOP, takeover, and retry-injection tests.
211. `PARTIAL` · **W5** — Verify output quality independently, including edits that appear valid but contain incorrect values, missing content, damaged formatting, or altered unrelated files.
212. `PARTIAL` · **W11** — Review security, privacy, package provenance, and failure recovery before any feature is declared launch-ready.

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
226. `PARTIAL` · **S** — Add granular completion tracking within milestones, but distinguish work completed from launch-gate approval. Do not manipulate weights to show artificially high readiness.
227. `PARTIAL` · **S** — Calculate the score from actual test artifacts, current commit, verified implementation, and explicit gate criteria. Never generate the percentage using Gemini's subjective opinion.
228. `PARTIAL` · **S** — Do not automatically start at 0%. Re-evaluate completed work and existing evidence against these milestone gates and calculate the real baseline.
229. `PARTIAL` · **S** — Report **passed, partial, failed, blocked, and untested** requirements separately from the overall readiness percentage.
230. `PARTIAL` · **S** — Every score must include the tested commit SHA, date, evidence location, supported platforms, remaining blockers, and why each completed milestone qualifies.
231. `PARTIAL` · **S** — Track progress at 10% increments, and whenever useful report the exact verified percentage between those checkpoints without pretending it is a success probability.
232. `PARTIAL` · **S** — At each 10% milestone, report the actual changes made, tests passed, defects fixed, performance impact, remaining work, and whether the next stage is safely unlocked.
233. `PARTIAL` · **S** — If a regression invalidates previously earned readiness, reduce the score accordingly. Never maintain an inflated historic score.

#### Implementation workflow and reporting

235. `PARTIAL` · **S** — Begin by inspecting the actual current branch and calculating the evidence-based readiness baseline.
236. `PARTIAL` · **W0** — Compare current code against every relevant requirement in this prompt and the existing canonical architecture ledger.
237. `PARTIAL` · **W0** — Create or update a single authoritative implementation backlog, preserving the existing plan and eliminating duplicate issue lists where safe.
238. `PARTIAL` · **W0** — Record each issue with severity, precise cause, affected module, required change, reproduction steps, acceptance criteria, test location, and current status.
242. `PARTIAL` · **S** — Before each substantial refactor, measure its expected benefit and preserve functionality, security controls, public interfaces, and regression coverage.
243. `PARTIAL` · **W12** — Remove dead code, duplicate abstractions, obsolete pathways, unused packages, redundant model prompts, unnecessary background workers, and outdated customer-facing branding only after verifying safe removal.
247. `PARTIAL` · **S** — Use the free GitHub Actions environment and disposable test systems intelligently; avoid unnecessary reruns and wasted quota.
255. `PARTIAL` · **S** — Keep a concise live engineering status with: **Current Readiness %, Fixed, Added, Removed, Tests, Speed, Failures, Blockers, Next Work**.
259. `FAIL` · **COM** — Benchmark OCADE against relevant currently available AI assistants and computer-use tools using identical, independently scored tasks. Compare correctness, latency, recovery, customer control, security, privacy, and usability. Do not claim superiority without results.
264. `PARTIAL` · **S** — Work toward full launch-readiness qualification, with every required part implemented, integrated, tested, documented, secure, maintainable, and performant.

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
| 61 | **Graceful Degradation and Honest Blocked States** | PASS | W1 | Offer compatible alternatives only if authorized and outcome-equivalent; otherwise report reason/action required. | JARVIS scope exclusion (see archived v7) |
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

All 236 ideas have a disposition (decided, with destination). The full table is archived verbatim in [archive Appendix C](docs/archive/plan-v6-2026-11-07.md); the sources remain `docs/research/OCADE_complete_heading_and_concept_index.md` and `docs/research/UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md`.

## Appendix D — Defect register (single live list)

**Active view:** open, partial, mitigated, code-fixed (not yet verified on the stated platform) and candidate defects. Fixed defects (D1, D2, D3, D5, D6, D7, D12, D13, D14, D17, D18, D20, D21, D27, D30, D31, D32, D33, D34, D35, D36, D37, D38, D39, D40, D41) and the closed-defect history are archived verbatim in [archive Appendix D](docs/archive/plan-v6-2026-11-07.md); their regression tests stay in the required suites. D22 and D24 stay here: fixed on the hosted runners, not yet on consumer machines.

Severity: CRITICAL = unauthorised action, data loss, secret exposure or wrong-target mutation; HIGH = release-blocking correctness, safety or product failure; MEDIUM; LOW. Sources: run logs and `evidence/2026-11-01-audit/codex-continuation.md`. Record hypothesis → result here so no defect is investigated twice.

| ID | Severity | Defect | Evidence | Status | Package |
|---|---|---|---|---|---|
| D4 | HIGH (risk) | SSRF, DNS-rebinding and redirect-hop enforcement for verifier fetch and actor browser | Playwright routes never see redirect hops (verified experimentally) | MITIGATED (`b86002c`, `2e9ba47`; green in [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177)): hop-by-hop navigation checks and request-time re-resolution. Residual (Node's own resolution inside one fetch; a confirmed form POST redirect) moves to the W11 security review | W1, W11 |
| D8 | HIGH | Device pickup backs off to 30 s; ~34% of live task time unaccounted | `agent.py` claim loop; eval timing | PARTIAL: pickup fixed (Realtime nudge; idle p95 502 ms synthetic, 0.5–0.8 s live; [run 82](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41797737703)). Unaccounted time live 35%: server database round trips (~210 ms each from this container; key lookups cut 12→1). Remaining: measure in the production topology (A1(b)); fold the replay check into claim/receipt if still above 10% | W2 |
| D9 | HIGH | First-attempt real-task success 75% (< 90%): invented facts, dense-table row choice (r1c), checks bent to guesses | `evidence/2026-11-01-eval-s11` … `s14` | PARTIAL: invented facts guarded (W1), checks fixed after a first look (W1), dense tables read as rows (`a403bca`); eval s21 9/11 + 1/2 web (harness and two product fixes found); Full E1 at `00cbd9e`: strict 27/48 after completed-task audit, gaming 0. D25/D26 and Office-reader repairs are in qualification; no >=90% claim (`evidence/2026-11-05-e1/`) | W4 |
| D10 | HIGH | Planner “busy” after ~30–60 calls on the shared free project | `evidence/2026-11-01-eval-s14/README.md` | MITIGATED (`0aa8c3b`): a busy wait records the provider's retry time and the device's next request resumes the task by itself; other waits are never auto-resumed. Daily free quota itself is unchanged (owner decision for paid capacity) | W4 (pacing) |
| D11 | MEDIUM | Windows web ladder `KeyError 'page'` after a browser/context closed | run 37, `4267c43` | OPEN: original primary `TargetClosedError` recovered; stale-context reproduction fails on Linux in run 106. Fresh-open recovery candidate is in qualification; original browser termination remains unexplained (`evidence/2026-11-04-browser-lifecycle/`) | W8 |
| D15 | LOW | Stale Dependabot PRs target deleted `/jarvis-runtime` | open PRs #88, #90 | OPEN (needs A3) | W12 |
| D16 | HIGH (risk) | macOS window previews need Screen Recording permission on consumer Macs; CI runner is pre-authorised, so this path is unverified | `mac_worker.py` preview; Apple privacy model | PARTIAL: Screen Recording and Accessibility are detected before use; without Screen Recording controls still work, the picture and image-grounded clicks are refused with a named reason, and diagnose says where to grant it (`7309946`). Consumer Macs still UNTESTED (RPC) | W7 |
| D19 | MEDIUM | Documents and workbooks cannot be edited in place; presentations and image editing unsupported; video has no open editable timeline; 3D has no open interchange export | `contracts.ts`; `office_worker.py`, `media_worker.py`, `scene_gl.py` | PARTIAL: in-place .docx/.xlsx/.pptx edits, new decks, `image.edit`, OTIO timeline beside every film (`d80ad29`…`9fcdac0`); 3D interchange (glTF) still open | W5 |
| D22 | CRITICAL | Local STOP arriving during a network claim does not fence the returned action | run 41900561913, real warm filesystem MCP worker | FIXED on the hosted runners: the warm-worker STOP regression (`test_agent_recovery`, `OCADE_LOCAL_STOP_CLAIM` with no dispatch) is green on Ubuntu, Windows 2022 and 2025, macOS 15 and macOS 15 Intel in [run 247](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42391671060); a consumer-computer run remains qualification (`evidence/2026-11-05-local-stop/`) | W1 |
| D23 | MEDIUM | Socket TimeoutError escapes the claim polling retry loop | run 41900561913, real signed Device client and agent loop | CODE FIXED (transport normalization and resumed-claim budget, `23efef02`); live busy-family retest is qualification (`evidence/2026-11-05-local-stop/`) | W2 |
| D24 | MEDIUM | macOS frozen Intel startup fails; tee masks the failed checker exit | run 41905297847, job 126838385018 | FIXED on the hosted runner: on macos-15-intel the bundle builds and every frozen worker and the bundled browser start in [package run 26](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42394586673). Earlier: the bundle built, but no Intel worker initialized. Pipefail repaired at c9ba4442; bounded startup stderr is in qualification. ARM64 actually passes all six frozen workers and its packaged-browser fixture. Intel is not qualified (`evidence/2026-11-05-macos-bundle/`) | W7 |

| D25 | HIGH | script_runnable accepts an escaped or missing interpreter; completed program repairs can still fail | full E1 seeds 22/23 config_repair | CODE FIXED (`fdc5b21`, C1): the verifier checks the real interpreter line and full-file budget and never runs a file-supplied shell; repaired programs are re-run with the confirmed command (`command_succeeds`, `5f6db4d`); the live E1 re-run is qualification | W5 |
| D26 | MEDIUM | E1 serves fake ZIP bytes, misses checked-transport CA and probes service after STOP teardown | full E1 release_pick and port_conflict; raw reports retained | CODE FIXED (`fdc5b21`, C1): real CRC-valid ZIP archives and the fixture CA in `release_pick`, and the hidden oracle runs before STOP through a checkpoint; the full E1 re-run is qualification (`evidence/2026-11-05-e1/`) | W4 |

| D28 | HIGH | Intel scene rendering publishes a flat image while scene/hash/size checks report success | published aaf3bad3, run 41970810529, Intel job 127061543475 | MITIGATED (`fdc5b21`, C1): a failed WebGL draw or readback and a uniform saved image are refused, so no false success is reported; a correct render on Intel Macs needs that hardware (qualification, `evidence/2026-11-05-intel-render/`) | W5 |
| D29 | MEDIUM | Intel browser popup classification intermittently omits the off-site closure | unpublished diagnostic run 41971524885, job 127064311487, WEB-009 | CANDIDATE-ONLY; not published-branch proof: empty popups instead of closed_off_site; fixed collector window is a hypothesis, not a confirmed cause. Network binding remains separately tested; no bypass inferred (`evidence/2026-11-05-intel-render/`) | W8 |
| D42 | HIGH | A planning turn's permit key was reused by every retry and doubled as the turn's only mutex: `duplicate_completed` parked tasks and a dead service instance blocked a turn for 30 min (38× HTTP 409) | Benchmark round 4; `authority.server.ts`, `ocade_acquire_generation_permit`, `ocade_claim_generation_transport` | CODE FIXED + TESTED (`a88fd97`, migration `20261110090000`, applied to staging); the benchmark rerun is qualification | MC |
| D43 | HIGH | A provider turn that failed after its first byte ended the task, and a two-model route never asked its second model | Round 4: Gemma 10× HTTP 500, 8× stream errors; C ≈ A | CODE FIXED + TESTED (`e34374a`); staging functions not redeployed yet | MC |
| D44 | HIGH | The benchmark harness compared a task with a step status (`"done"`): no PASS could be recorded | `tests/jarvis/benchmark.py` rounds 1–4 | FIXED + TESTED (`92d3dda`) | MC |
| D45 | HIGH | Windows: apps found only by a Start Menu shortcut could not be launched; a launcher's window was never matched and was named by a program no person can allow | Code review of `discovery.py`, `windows_worker.py` | CODED + unit TESTED (`b75514b`); UIA-015/016 on the hosted Windows runners pending | W6 |
| D46 | HIGH | `ui.send_keys` had no key contract: text corrupted on Windows, no key presses possible on macOS | Code review of both bridges | CODED + TESTED in translation (`6b914dd`); real-window cases on the hosted runners pending | W6, W7 |
| D47 | MEDIUM | One model call per effect and 6–9k input tokens of offered operations per turn against a 16k tokens/min free quota | Registry measurement 10 Nov 2026; round 4: 37× HTTP 429 | OPEN: quota waits now resume by themselves (D42), so this costs time, not the task | W4 |
| D48 | MEDIUM (retired) | Legacy Live-planner goals were refused as `invalid_goal`; the specific cause remains unproven | Historical round 4: all 8 former Live tasks | RETIRED FROM ACTIVE MODEL SCOPE (O15). Diagnostics (`5632e0f`) remain as historical evidence; no rerun planned | MC |
| D49 | HIGH (risk) | Whether the bridge can finish an application task in real Calc and GIMP windows was never observed | No round reached an application effect | OPEN: desktop probe on the hosted matrix (`67d889b`), first run pending | W6, W7 |


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
| 3 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Reclassified: the whole-product objective is closed only by W13/RPC/COM evidence; its code items are the other IDs |
| 7 | STANDING | STANDING | Every gate |
| 8 | STANDING | STANDING | Every gate |
| 10 | CODE | BUILDS | C0/C10: verified inventories that tests keep honest: requirements and coding state (Appendix A, Appendix E), concepts (`npm run jarvis:traceability`), operations and capabilities (`contracts.ts` → `protocol.json`, `jarvis:protocol-check`), dependencies and licences (`requirements.lock`, `npm run licences:check`), security boundaries and threats (`docs/SUPPORT_LEGAL_SECURITY.md` §7.1), tests (`docs/TEST_MATRIX.md`, `test-matrix.test.ts`), release requirements (`npm run readiness`) |
| 13 | CODE | BUILDS | C0: every reproducible critical or high defect in Appendix D is fixed in code (D30–D34 this session; D22, D23, D25, D26 code-fixed earlier) or mitigated with its exact hardware blocker recorded (D16 consumer Macs, D24 and D28 Intel Macs); the release gate stays closed until their qualification passes |
| 16 | STANDING | STANDING | Every gate |
| 23 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; existing harness BUILDS, new two-model-only harness NOT IMPLEMENTED | C10: `npm run model:availability` reads provider metadata per key slot; refusal behaviour is tested in `tests/security/provider-errors.test.ts`. C11: the currently implemented `GEMINI_MODEL` allowlist, streaming and legacy Live route, whole-turn provider failover, `providerQuota` and old comparison harness are historical source facts, **not proof of current O15 compliance**. **Follow-up CODED 13 Nov 2026 (gate green; not deployed, not qualified):** `online-models.ts` `plannerModel`, `edge-handler.ts` one model per turn, `live-session.ts` deleted, `tests/security/model-route.test.ts` and `whole-turn.test.ts` rewritten. Original instruction: approved follow-up work must restrict planner selection to `gemini-3.5-flash-lite` or `gemma-4-31b-it` separately, remove Live/hybrid planner options from the code and harness, preserve safe within-model retry/operational key handling, update `tests/security/model-route.test.ts`, and independently qualify both models before any new benchmark claim. |
| 28 | CODE | BUILDS | C6: the planner prompt orders the routes (typed file, document, media and scene operations; website operations; accessibility after `ui.inspect`; `ui.click_point` last) and the server enforces the tail: a pointer click needs the latest image of the exact window, and a failed mechanism needs a fresh look before the next route (`SYSTEM`, `observedSinceFailure`, `NEXT_ROUTE`; `contracts.test.ts` mechanism fallback) |
| 29 | CODE | BUILDS | C6: only operations the current grants and the computer's engines support are offered (`offeredOperations`, C3); read-only observations may share a turn, every effect runs alone; a failed route is followed by a fresh observation and then the next route (`fallbackRoute`) |
| 31 | CODE | BUILDS | C2, `ec44dd79` |
| 32 | CODE | BUILDS | C2, `ec44dd79` |
| 33 | CODE | BUILDS | C2, `ec44dd79` |
| 34 | CODE | BUILDS | C2, `ec44dd79` |
| 35 | CODE | BUILDS | C2, `ec44dd79` |
| 37 | CODE | BUILDS | C10, `604e808d` |
| 38 | CODE | BUILDS | C2, `ec44dd79` |
| 40 | CODE | BUILDS | C9/C10 session fence |
| 44 | CODE | BUILDS | C4, `e2f7053e` |
| 45 | CODE | BUILDS | C4, `e2f7053e` |
| 46 | CODE | BUILDS | C6: the generic fix: repeated "Download" links carry their row and section, tables are read as rows and headers, a deep address typed from memory is refused, and facts come only from what the task observed (WEB-015, `release_pick` and `web_fact` live tasks, `contracts.test.ts`) |
| 48 | CODE | BUILDS | C6: one target per intent, resolved against what was observed: web controls by observation-scoped selector (`web_worker._one`, stale refused), desktop windows and elements by exact lease (`windows_worker`/`mac_worker`, 59), files by workspace resolution (`sandbox.resolve`), processes by creation identity (`jobs`) |
| 49 | CODE | BUILDS | C6: each observation issues a random token; every control's selector `[data-ocade="<token>-<n>"]` names that observation only, and an older one is `stale_selector` (`_CONTROLS`, `_one`) |
| 50 | CODE | BUILDS | C6: control facts carry tag, type, name, label (accessible name, aria-label, title or text), href, role, box (position and size), state (disabled, checked, selected, pressed, expanded, hidden), containing row and nearest heading for repeated labels, and the observation token (`_CONTROLS`; WEB-001b, WEB-015 in `test_web.py`) |
| 51 | CODE | BUILDS | C6: a repeated label ("Download" per row) carries its row text and section heading, so the planner chooses by version, platform or row (WEB-015, WEB-001b) |
| 52 | CODE | BUILDS | C6: a selector from an older observation, a page that left its site, or a disconnected element is refused (`stale_selector`, `page_left_site`); desktop actions recheck their exact window lease before input (59) |
| 54 | CODE | BUILDS | C6: the prompt requires current facts to come from this task's observations, an address not seen in this task is refused, and the verifier checks the real page, never the model's claim (`SYSTEM`, `contracts.test.ts`, `web_text_contains`) |
| 55 | CODE | BUILDS | C6: visible tables are read as caption, headers and rows of cells with each row's link, hidden rows excluded (`_TABLES`; table case in `test_web.py`) |
| 56 | CODE | BUILDS | C6: an incomplete observation makes the planner look again (targeted reads such as `web.read`, `ui.inspect`, `fs.read_text`, `system.diagnose`) or ask the person with `ask`; a mechanism failure requires a fresh look first (`observedSinceFailure`) |
| 57 | CODE | BUILDS | C6: structured observations come first (page controls and tables, UI Automation and Accessibility trees); a screenshot is used only where structure is missing, such as a canvas, and is looked at with `media.preview` (`SYSTEM`) |
| 58 | CODE | BUILDS | C6: a point is a fraction of the leased window, turned into pixels from its live rectangle under per-monitor DPI awareness v2; the click is refused when the window moved, resized, lost the foreground, lies off every monitor (negative origins included) or is obscured, and the target is re-matched in a fresh capture first (`ui_click_point`, `_window_point`, `_check_point`); macOS uses live window bounds (`mac_worker._leased`). Real DPI and monitor setups are qualification (127) |
| 59 | CODE | BUILDS | C6 audit: every `ui.*` mutation on Windows and macOS re-proves the lease (handle, pid, exe, start time) and refuses gone, minimized, elevated (UIPI) or unresponsive windows (`windows_worker._leased`, `mac_worker._leased`); Windows/macOS runner proof at qualification |
| 60 | CODE | BUILDS | C6: visual grounding is the last route after structured controls fail, needs the latest image of the exact window, re-matches the target in a fresh capture before clicking, and repeated pairs of steps are stopped as a stall (`ui_click_point`, `vision.match`, stall rules in `contracts.test.ts`) |
| 61 | CODE | BUILDS | Visual grounding, `19d21104` |
| 62 | CODE | BUILDS | C6: duplicate buttons (WEB-015, WEB-001b), changing layouts (stale observation refused), dynamic and hidden table rows (`_TABLES`), identical file names (new files never overwrite, `test_sandbox.py`), overlapping windows (`point_obscured`, `test_windows_ui.py`), dialogs (WEB-017: reported, never answered yes), hidden controls (filtered), overlays (obscured points refused) and redirected downloads (`download_off_origin`, `test_download_mark.py`) |
| 63 | CODE | BUILDS | C6: every result returns to the planner before the next effect; edits name the digest they read, so a wrong file is refused before it is overwritten; outputs are new files; and nothing is accepted before the independent verifier passes it (`fs.edit_text` expectSha256, `recovery.test.ts`) |
| 65 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Independent fixture server observations, `2ca015fb` |
| 66 | CODE | BUILDS | C7: a task completes only when the independent verifier worker, reading the real files, pages or windows, returns true for every fixed check (`settleChecks`: unknown is not success; `jarvis_settle_task` refuses partial passes; `verification.test.ts`, `authority.test.sql`) |
| 67 | CODE | BUILDS | C7: the model only proposes checks at task start; the server validates them (`compileGoal`: one well-formed proposal, allowed apps and sites, bound paths, milestone coverage) and stores them immutably (`jarvis_set_outcome`); outcomes are observed by a separate worker; a check that cannot apply is a question, not a repair target (69) (`verification.test.ts`, `contract-binding.test.ts`) |
| 68 | CODE | BUILDS | C7: changing a file or source image a check reads is refused unless the request asks for that file to change (`planStep` fence, `contract-binding.test.ts`), unrelated damage is caught against the kept original (`changes_within` with formatting), and saved formula results are never trusted (recalculation) |
| 69 | CODE | BUILDS | C7: a check that cannot apply to the result (wrong file kind, wrong range shape, region outside the image, a format `changes_within` cannot compare) is `invalid`, not failed work (`verify_worker._invalid`); `planStep` → `invalidChecks` makes the task wait and ask instead of sending the work back for repair |
| 70 | CODE | BUILDS | C7: digests in every write receipt, contents (`file_contains`), parseability (`file_parses`, Office packages reopened), semantics (recalculated cells and ranges, headings, scene and media checks) and application behaviour (a real spreadsheet engine; a repaired program re-run, `command_succeeds`) |
| 71 | CODE | BUILDS | C7: formulas recalculated by a real engine on a private copy `5f6db4d`, now also for single cells (`workbook_cell_equals`, never the saved result) and ranges (`workbook_range_equals` {path,sheet,range,values}, ≤400 cells, row-by-row values, structure such as header rows): `_workbook_grid` |
| 72 | CODE | BUILDS | C7: structure (`document_headings`), contents (`file_contains`, PDF rendered with no blank page), preservation of requested formatting (`changes_within` now compares style, weight, italics, underline, size and font per paragraph and number formats per cell: `_formatted`) |
| 73 | CODE | BUILDS | C7: file properties (`image_size`), decoded render (`scene_render`, passive formats), requested visible change and nothing else (`image_changed_within` {path,source,region?}: pixels visibly changed inside the region, ≤0.2% stray outside, size kept); the source is fenced against edits like any checked file (`planStep`) |
| 74 | CODE | BUILDS | C7: `verify.checks` checks a video through its encoded output: `media_duration`/`media_quality` (FFprobe stream, codec, container, size, loudness, black and silent gaps) and now `image_changed_within` with `time`, which decodes the edited and source frame at that moment (`verify_worker._picture`) so an overlay or colour edit is checked on its pixels; `test_verify_kinds.test_a_video_edit_is_checked_on_its_frame` |
| 75 | CODE | BUILDS | C7: a repaired program is re-run with the command the person confirmed, in a throwaway copy, and must exit 0 and print the expected text (`command_succeeds`); the containment used is reported (bubblewrap, user namespace, sandbox-exec, or copy only on Windows) `5f6db4d` |
| 76 | CODE | BUILDS | C7: page state by a fresh rendered observation through checked transport (`web_text_contains`, `test_verify_web.py`: hidden source text, blocked subresources and unavailable browsers stay unverified), downloaded artifacts by the file checks, and submitted data by the confirmation the site shows |
| 77 | CODE | BUILDS | C7: each check is reported as verified, failed or needs review (`JarvisPanels` task view); unverified checks keep the task from completing and the summary names them; measured notes say what was measured and why something is unobservable (engine missing, no kept original, containment level) |
| 78 | CODE | BUILDS | C11: every action's receipt carries its evidence (digests, paths, measured values, durations) bound to the action record; credentials are redacted on the device before it leaves (`c8fbd54`, MCP output too), and diagnostics carry no content (175, 177) |
| 81 | CODE | BUILDS | C10: a task settles only after the independent verifier (`planStep` → `settle`), and timing counts the verified completion (`taskTiming`: `verifiedAt`, `deliveredAt` only for a completed task); campaign speed is measured on verified outcomes (`live_eval.measures`) |
| 82 | CODE | BUILDS | C10: `taskTiming` reports planning and provider time (`modelMs`, `modelCalls`, provider tokens per call), worker start-up (`workerReadyMs`), observation, execution and verification tool time, planner retries, pickup, the person's waits, pauses, unaccounted time and total elapsed (`timing.test.ts`) |
| 83 | CODE | BUILDS | C3: independent reads share one planning turn (`planStep` batch, `MAX_BATCH`); a check the device cannot run waits instead of re-asking the model (`invalidChecks`); the planner sees one newest observation in full and older ones clipped (`STATE_BUDGET`); discovery runs once per companion start (`agent.run` inventory); long files are read on from `nextOffset` instead of again (87); only the two newest previews are attached (`previewAttachments`) |
| 85 | CODE | BUILDS | C10: only reads are batched; every write or risky action needs a fresh planning turn after the previous result (`tests/security/recovery.test.ts`: mutations require fresh planning) |
| 86 | CODE | BUILDS | C3: capability metadata is discovered once per companion start and kept by the server (`agent.run` inventory); operation schemas are converted once per server instance (`operationSchema`, test `operation schemas are converted once`), invalidated by a new release. File hashes are deliberately recomputed on every read: a hash is evidence, and a cache keyed on size and time could pass a changed file |
| 87 | CODE | BUILDS | C3: `fs.read_text` takes `offset` and returns `nextOffset`/`totalCharacters` (`office_worker.fs_read_text`, contract and `protocol.json`), so a long file is read in parts; observations of pages and windows are already bounded per step; `test_fs_ops.LongTextReads` |
| 88 | CODE | BUILDS | C10: the gateway pre-warms the file workers on start so the first step pays no start-up, and STOP still ends them (`test_prewarmed_workers_spare_the_first_step_its_start_up`, STOP tests in `test_agent.py`) |
| 90 | CODE | BUILDS | C10: bounded by category: verification repairs (`MAX_VERIFICATIONS`), repeated or refused steps (pilot stall rules, `contracts.test.ts`), busy-planner retries with the provider's Retry-After (`planner-wait.test.ts`), per-milestone step budgets, deadlines per action, and never an automatic repeat of an uncertain effect (`recovery.test.ts`) |
| 91 | CODE | BUILDS | C10: the planner prompt keeps every step's operation, status and error code, clips only long observed content with a visible marker, and states grants, checks and milestones every turn (`history`, `contracts.test.ts`: every result of a batch is seen in full) |
| 92 | CODE | BUILDS | C3: independent reads are planned together (`planStep` batch accepts only `risk: read` calls), and every mutation gets fresh planning after the previous result. Dispatch stays one action at a time per task by rule (concept 4): concurrent device actions cannot yet guarantee window and browser-target isolation, which is the condition this requirement sets |
| 96 | CODE | BUILDS | C10: `live_eval.measures` reports p50/p95/p99 of elapsed, verification and unaccounted time, model calls per task, planner retries, tokens, interventions, wrong targets and first-attempt and verified success rates in every campaign summary (`test_eval_audit.py`); resource use (resident memory, CPU time, open files, threads, workers, disk) is sampled by the stability harness `tests/stability.py` |
| 97 | CODE | BUILDS | C4, `e2f7053e` |
| 98 | CODE | BUILDS | C4: the installer freezes the companion with its Python runtime, libraries and its own Chromium (`packaging/ocade-agent.spec`, hashed `requirements.lock`); `check_frozen.py` starts every worker and the bundled browser with an empty developer PATH (Windows installer job) |
| 99 | CODE | BUILDS | C4: bundled components are fixed by the protocol and spec (`catalog.bundled`, the frozen bundle); a task's extra prerequisite is found, proposed and installed separately (`system.dependency` → `system_install_dependency`, 97/105–108), and the person sees which is which before confirming |
| 100 | CODE | BUILDS | C4: installed tools are located through registered App Paths and known install folders before PATH, resolved to the real file, and identified by version metadata and executable headers without running them (`discovery.app_path`, `executable_version`, `executable_architectures`, `_candidate`; `test_jobs.py`) |
| 101 | CODE | BUILDS | C4, `e2f7053e` |
| 103 | CODE | BUILDS | C4, `e2f7053e` |
| 104 | CODE | BUILDS | C4 decision: macOS ARM64 and Intel bundles are built and their frozen workers run (`jarvis-macos-package.yml`, `macos-15`, `macos-15-intel`); Windows x64 is built and installed (`windows-installer-smoke`). Windows on ARM is not a supported target for 0.1.0 (`cryptography` 50.0.1 ships no win_arm64 wheel), and x86 is not supported; Setup now refuses both (`ArchitecturesAllowed=x64os` in `ocade-agent.iss`) |
| 105 | CODE | BUILDS | C4, `e2f7053e` |
| 106 | CODE | BUILDS | C4, `e2f7053e` |
| 107 | CODE | BUILDS | C4, `e2f7053e` |
| 108 | CODE | BUILDS | C4, `e2f7053e` |
| 110 | CODE | BUILDS | C4: permission denied, elevation required (UAC), enterprise policy, insufficient storage and architecture mismatch are distinct diagnostic codes from the operating system's own errors (`dependency_os_error`); installs never elevate and never use a package manager the model chooses |
| 111 | CODE | BUILDS | C4: missing DLLs, `.dylib` and `.so` libraries, missing entry points, failed library initialisation, invalid native images and wrong-architecture loads are recognised from loader status codes and messages (`_dependency_startup_failure`; `test_verified_dependency_reports_loader_and_policy_failures`) |
| 112 | CODE | BUILDS | C4: `system.diagnose` names PATH folders that no longer exist, environment variable names (never values), file associations, one registry key's values (HKCU/HKLM, read-only, redacted) and crash events; configuration files and working directories are read with the file operations (`test_fs_ops.py` Diagnostics) |
| 113 | CODE | BUILDS | C4: quarantine and download-zone marks are observed, code-signature and policy refusals are reported as `dependency_security_policy`, and downloads keep the system mark (170); nothing disables or bypasses SmartScreen, Gatekeeper or application control |
| 114 | CODE | BUILDS | C4, `e2f7053e` |
| 115 | CODE | BUILDS | C4, `e2f7053e` |
| 116 | CODE | BUILDS | C4, `e2f7053e` |
| 117 | CODE | BUILDS | C4, `e2f7053e` |
| 118 | CODE | BUILDS | C4, `e2f7053e` |
| 119 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | C4: the conditions are exercised by `test_jobs` (missing library, architecture mismatch, security policy, interrupted and untrusted downloads, changed proposal), `system.dependency` storage refusal (`insufficient_storage`), and `ocade_agent diagnose`; runs on real clean computers are qualification |
| 120 | CODE | BUILDS | C4: builds install only the hashed locks (`--require-hashes`), the no-hardcoded guard refuses developer paths in production code (`npm run jarvis:no-hardcoded`), dependency installs use pinned public sources with digests, and the frozen check runs with an empty developer PATH |
| 121 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Harness: `packaging/test_install.ps1` and `check_frozen.py` on the clean Windows 10 and 11 machines; owner-directed run deferred |
| 122 | CODE | BUILDS | C6: `packaging/test_install.ps1` installs, runs the installed companion's diagnosis, repairs by reinstalling, uninstalls and checks the person's folder survives; `check_frozen.py` starts every worker and the bundled browser; pairing, task, restart and upgrade paths are covered by `test_agent.py` and the update tests (186–189) |
| 123 | CODE | BUILDS | C6: `check_frozen.py` proves the frozen package's DLLs, Python modules, bundled Chromium, workers and notices by starting them with an empty developer PATH |
| 124 | CODE | BUILDS | C6: the frozen check runs with no developer PATH, the installer carries its own runtime and browser, commands default to Windows PowerShell 5.1 or cmd that ship with Windows, and the no-hardcoded guard refuses developer paths |
| 125 | CODE | BUILDS | C6: Windows control is UI Automation first, Win32 and COM through pywinauto and pywin32 with balanced COM initialisation (`test_effect_receipts.py`, `test_windows_ui.py` in the Windows job); real installed applications are qualification |
| 126 | CODE | BUILDS | C6: input only to the exact leased window while it holds the foreground, after the person's own input has been quiet; minimized, closed, elevated (UIPI) and secure-desktop targets are refused, and inaccessible controls report `pattern_unsupported` (`windows_worker`) |
| 127 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Reclassified: testing real DPI, zoom, monitors and refresh rates needs that hardware; the code that must hold there is 58, and the Windows UI ladder (`test_windows_ui.py`) is the harness |
| 128 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Reclassified: standard accounts, UAC, controlled-folder access, antivirus and OneDrive need those environments; elevation and permission refusals are coded (126, 110), Unicode and long names are tested (`test_sandbox.py`) |
| 129 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Reclassified: sleep, wake, lock, sign-out and network loss need a real computer; reconnection, outage and unknown-effect handling are coded (193, `outage.test.ts`, `test_agent_recovery.py`) and the stability harness runs the long session |
| 130 | CODE | BUILDS | C6: STOP and timeouts end the whole process tree (`test_shell.py`: timeout and STOP end the tree; jobs cancelled by creation identity, `test_jobs.py`); a step in flight is reported unknown, never failed (`authority.test.sql`) |
| 131 | CODE | BUILDS | C6, `5fdfcb11` |
| 132 | CODE | BUILDS | C7: Accessibility and Screen Recording are checked before use; without them control is refused or the preview is withheld with a named reason, `diagnose` says exactly where to grant them, and revoking them takes effect on the next call (`mac_worker`, `agent.diagnose`); a real Mac is qualification |
| 133 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Harness: the macOS package workflow and `check_frozen.py` on Intel and Apple Silicon; owner-directed run deferred |
| 134 | CODE (optional, O1) | NOT CODED | W14: Linux is optional and never blocks release (O1); Linux is offered no desktop control (`discovery.engines`), so nothing claims it |
| 135 | CODE (optional, O1) | NOT CODED | W14: Linux is optional and never blocks release (O1); Linux is offered no desktop control (`discovery.engines`), so nothing claims it |
| 138 | STANDING | STANDING | Reclassified: a rule on what may be claimed (no OS support before representative hardware passes); checked at every gate |
| 139 | CODE | BUILDS | C8: installed browsers and their profiles are discovered, never assumed (`discovery.browsers`, `_profiles`; `test_fs_ops.py` BrowserDiscovery); JARVIS acts in its own bundled browser profile |
| 140 | CODE | BUILDS | C8: actions run only in OCADE's own browser profile, the exact page id, its bound origin and an observation-scoped target (`_bound`, `_one`); every connection is pinned to a checked address (`4436082`); the person signs in there themselves, so no other browser session is ever used |
| 142 | CODE | BUILDS | C8: observations report navigation and redirects (exact addresses), popups, downloads, file pickers (`filePicker`), permission prompts waiting (`permissionPrompts`), sign-in pages (`needsSignIn`) and dynamic content after settling (`test_web.py`) |
| 143 | CODE | BUILDS | C8: OCADE never answers a site's permission prompt, never solves a CAPTCHA or enters a second factor for the person, stays on the bound site, and needs the person's confirmation of the exact effect for anything external (`web_worker`, `confirmation.test.ts`) |
| 144 | CODE | BUILDS | C8: unknown apps are operated through the generic UI Automation and Accessibility operations and reviewed MCP servers; no app-specific dispatch exists (`contracts.test.ts`: the supervisor has no task-specific whitelist) |
| 146 | CODE | BUILDS | C8: every surface has its owner and harness: Landing, Auth, Library and Help (`surface_audit.py`, signed out and signed in), Chat (`ChatWorkspace`), JARVIS and Devices (`jarvis_ui_flow.py`), Settings, Usage, and the Owner/Staff Console, which now also lists a customer's connected computers and removes one (`readCustomer.devices`, `removeCustomerDevice` → `ocade_admin_remove_device`, permission `devices.manage`, migration `20261107094238` with rollback; `staff-authority.test.sql`) beside the emergency pause; signed-in runs on staging are qualification |
| 147 | CODE | BUILDS | C8: `surface_audit.py` inventories every visible control per route (kind, accessible name; `--inventory` JSON: 125 controls on 9 public routes on 7 November 2026), checks every link and route, and presses each distinct enabled button once on a fresh load, failing on one that changes nothing; upload, download, permission and task transitions are driven by `jarvis_ui_flow.py` |
| 148 | CODE | BUILDS | C8: Settings → Devices walks through install, pairing code and keeping the companion running, then the exact permissions; the first task is sent from the JARVIS page; the whole path is driven end to end by `tests/web/jarvis_ui_flow.py` (sign in, pair, grant, request, confirm, verified result), whose staging run is qualification |
| 149 | CODE | BUILDS | C8, `d6e65552` |
| 150 | CODE | BUILDS | C8, `d6e65552` |
| 151 | CODE | BUILDS | C8, `d6e65552` |
| 152 | CODE | BUILDS | C8: the task view has Stop, Take Over, Continue and Retry (Retry only when safe, `canRetry`) and Devices has Remove, each calling its server function and showing the new state (`JarvisPanels`; `confirmation.test.ts` safe retry, `authority.test.sql` state transitions) |
| 153 | CODE | BUILDS | C8: produced files are listed with path and digest; the person picks the copy from the JARVIS folder, the site checks its SHA-256 against what JARVIS saved, previews supported types, saves it to the Library or uses it in the next request (`ArtifactItem`) |
| 155 | CODE | BUILDS | C8: dictation in Chat and JARVIS listens only while the person dictates (one utterance, stopped on cancel or a hidden tab) and names a blocked microphone; JARVIS answers now have Read aloud in the chosen voice (`useReadAloud`, `speakable`), stopped by pressing again, by starting to dictate or by hiding the page; Help says nothing listens in the background; `tests/jarvis/voice.test.ts` |
| 156 | CODE | BUILDS | C8: `tests/web/surface_audit.py` audits every reachable page in Chromium, Firefox and WebKit at desktop and phone sizes (status, broken links, console errors, one h1, lang, alt text, accessible names) and the PWA local non-network contract (manifest, service worker, local non-network shell); session recovery is the signed-in pass |
| 157 | STANDING | STANDING | Reclassified: its own condition defers it ("only after core architecture and cloud gates pass"); checked at the launch gates, with no Android code to complete before then |
| 158 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Manual WebKit phone and local non-network-shell audit, `a7c93e1e` |
| 159 | CODE | BUILDS | C8: the surface audit now fails when a first visit loads more than 950,000 bytes of script (853,462 measured on 7 November 2026); routes and Markdown are split and loaded on demand, the local non-network shell is cached, and the audit covers accessibility and errors |
| 160 | CODE | BUILDS | C8: the button-press audit found no dead control on the public site; the JARVIS voice setting had nothing using it and now drives Read aloud (155); Help named a "Voice" button that does not exist and now names the microphone; no duplicate routes (`src/routes`); the remaining `caera.` storage key is kept so existing installs keep their ID |
| 161 | CODE | BUILDS | C9: task authority (`authority.test.sql`, `milestones`, `effect-resolution`), RLS and privilege over the whole schema (`injection-privilege.test.sql`), sessions (`session-account.test.sql`), staff and owner boundaries with the audit record (`staff-authority.test.sql`: role limits, Primary Owner protected, fresh proof and reason required, removal written with who, whom and why, refusals leave nothing), device ownership (`authority.test.sql`, `device-admission.test.sql`) |
| 162 | CODE | BUILDS | C9: forged/malformed device IDs `d4185c0`, replay and revocation (`authority.test.sql`); expired tokens refused before any network call and ended sessions or owed second factors refused by the database (`requireSession` → `sessionStanding`, `tests/security/session.test.ts`, `session-account.test.sql`); cross-account stop, take over, resume and device removal refused with the task untouched; duplicate Send, queue key and receipt (`authority.test.sql`) |
| 163 | CODE | BUILDS | C9, `50f6300e` |
| 164 | CODE | BUILDS | C2/C9, `50f6300e` |
| 165 | CODE | BUILDS | C9, `d4185c0`: shared per-device budget in `jarvis_device_admit` (entry `handleDeviceRequest` → device route); local per-source brake; queue caps from `50f6300e` |
| 166 | CODE | BUILDS | C9: `callPlanner` names every provider failure (unreachable, HTTP status with the provider's code, quota with Retry-After kept, refusal events, garbled stream, cut-off stream with partial tool calls, final mismatch) as `PlannerUnavailable`, releases the permit when refused before output, and never decides on a partial turn (`tests/security/provider-errors.test.ts`); waiting and busy retry `planner-wait.test.ts` |
| 167 | CODE | BUILDS | C9: workers and commands get a sanitized environment (SHELL-003 in `test_shell.py`, `test_catalog.py`); the service key is a request header, never in what the model reads (`contract-binding.test.ts`); the web bundle is scanned for secrets (`npm run audit:secrets` in `verify:full`); evidence redaction `c8fbd54` |
| 168 | CODE | BUILDS | C9, `a5b3c25`: per-request CSP nonce (`src/server.ts` → `getRouter`), fixed scripts by hash, no `'unsafe-inline'` scripts; HSTS, canonical HTTPS redirect, CSRF middleware for server functions; OCADE sets no cookies |
| 169 | CODE | BUILDS | C9: XSS (chat Markdown renderer, `tests/security/injection.test.ts`), SSRF (`isPushService`; actor pin `4436082`), SQL injection and privilege escalation over the whole schema (no dynamic SQL, fixed search_path, no anonymous account function — migration `20261107075756` — RLS on every table, non-staff refused by every staff function: `injection-privilege.test.sql`), command injection and unsafe deserialization (`tests/test_injection.py`), path traversal (`test_sandbox.py`), IDOR (`authority.test.sql`, `session-account.test.sql`) |
| 170 | CODE | BUILDS | C9: threat model with control and regression test per threat, `docs/SUPPORT_LEGAL_SECURITY.md` §7.1; new controls: third-party MCP output redacted (`Gateway.run`, `test_catalog.py`), downloads keep the system internet mark (`web_download` → `mark_downloaded`, `test_download_mark.py`), off-origin download cancelled and never saved |
| 172 | CODE | BUILDS | C9: logical backup restore drill with row-level security and data fingerprint checks and a corrupt-dump refusal (`tests/jarvis/db/restore.sh`, CI database job); 20 migration rollbacks round-trip (`rollback-roundtrip.sh`); outage behaviour (`outage.test.ts`, provider errors); recovery and incident runbook `docs/OPERATIONS.md`. A restore of the hosted backup itself is a qualification step |
| 175 | CODE | BUILDS | C9: other accounts (RLS, `authority.test.sql`, `session-account.test.sql`), support and staff (no policy or staff function reads content; sharing is the person's time-limited `ocade_support_share`: `injection-privilege.test.sql`), model traces and logs (enumerated health records only, server code logs nothing else: `tests/security/privacy.test.ts`), evidence redaction `c8fbd54` |
| 176 | CODE | BUILDS | C9, `c8fbd54`: credentials in every receipt's evidence redacted at the gateway result boundary (`Gateway.run` → `redact`), count reported; companion and server logs carry no evidence text |
| 177 | CODE | BUILDS | C9: structured local crash reports with no messages or contents (`_run_companion` → `record_crash`, shown by `diagnose`, `test_agent.py`), health endpoint `/api/health` (`src/server.ts` → `releaseHealthResponse`), latency buckets and failure classes (`buildHealthRecord`, `privacy.test.ts`) |
| 179 | CODE | BUILDS | C9: export and per-class deletion (`account-data.functions.ts` → `data-rights.ts`); every table naming an account is exported or excluded with a reason (`tests/security/data-rights.test.ts`); deleting an account is never blocked and keeps others' records without the identity (migration `20261107083209` fixes a RESTRICT that blocked deleting a staff account and a CASCADE that erased customer cases; `account-deletion.test.sql`); device revocation (`authority.test.sql`); activity retention (`jarvis_purge_expired_activity`) |
| 180 | EXCLUDED | HISTORICAL | Non-JARVIS documentation work retained in v7 archive. Existing installer help remains testable. |
| 181 | CODE | BUILDS | C9: `RELEASE_NOTES.md`; `docs/OPERATIONS.md` (support procedure, incident response with the console emergency pause, status communication, recovery for database, website, companion and tasks); JARVIS troubleshooting in Help (`help.tsx`); a public status page does not exist yet and is named as such |
| 182 | EXCLUDED | HISTORICAL | Out of active JARVIS work; prior record archived. |
| 185 | CODE | BUILDS | C5: every Python package the companion ships and its build tool are pinned with hashes (`requirements.lock`, `packaging/build.lock`) and installed with `--require-hashes`; Windows rebuilds the bundle and the installer and requires identical files (`compare_builds.py`), and the macOS package workflow now rebuilds the app and compares it the same way |
| 186 | CODE | BUILDS | C5, `543eeb1a` |
| 187 | CODE | BUILDS | C5: clean install, repair and uninstall keeping the person's files (`test_install.ps1`), upgrade and rollback of signed releases (`activate-update`, `rollback-update`, 186–189), restart resumes from the journal (`test_agent.py`) |
| 188 | CODE | BUILDS | C5, `543eeb1a` |
| 189 | CODE | BUILDS | C5, `543eeb1a` |
| 190 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Reclassified: clean VMs and physical machines are qualification environments; the harness is `test_install.ps1` and `check_frozen.py` |
| 191 | CODE | BUILDS | C10: `tests/stability.py` runs the real gateway and workers through repeated write, read, list, workbook and verify cycles, samples the process tree each cycle, and fails on memory, open-file or thread growth, a call past its bound (pipe hang), workers outliving the gateway, or runaway disk use; a 12-cycle run is in every gate (`test_stability.py`); the long run on target computers is qualification |
| 192 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Reclassified: low memory, slow storage, limited bandwidth, unstable Wi-Fi and constrained accounts are test environments; the harness is `tests/stability.py` plus the outage and recovery suites |
| 193 | CODE | BUILDS | C1: an unreachable computer or planner is a named waiting state, never success (`outage.test.ts`, `provider-errors.test.ts`); a lost response after dispatch is unknown and never repeated automatically (`test_agent.py`, `recovery.test.ts`); the companion reconnects on its own poll loop |
| 194 | CODE | BUILDS | C10: `docs/TEST_MATRIX.md` (versioned) lists every OS, architecture, browser, display, permission and installation dimension with the job or test that covers it; `tests/security/test-matrix.test.ts` fails if a named file or job disappears |
| 195 | CODE | BUILDS | C10: unit, protocol, integration, database, security, accessibility, browser, desktop UI, packaging, installer, performance, stability, disaster-recovery and fault-injection suites, each named in `docs/TEST_MATRIX.md` and run by the local and push gates or the manual jobs |
| 197 | CODE | BUILDS | C10: each live task carries a hidden oracle that runs privilege-dropped before STOP, never shares its answer with the planner, and must fail on the untouched problem (`--selfcheck`; `test_eval_audit.py`, `test_eval_isolation.py`) |
| 199 | CODE | BUILDS | C10: `tests/jarvis/live_eval.py` drives the real planner, server and companion end to end (`jarvis-staging-evaluation.yml`); running it is owner-directed qualification |
| 200 | CODE | BUILDS | C10: live tasks cover spreadsheet reconciliation, document creation, code repairs, browser research and downloads, file organisation, image resizing and video trimming through the generic operations (`GENERATORS`; media oracles in `test_eval_audit.py`) |
| 201 | CODE | BUILDS | C10: task generators draw fresh random content per seed, and production code is guarded against task-specific dispatch or hardcoded journeys (`npm run jarvis:no-hardcoded`, `contracts.test.ts`) |
| 202 | CODE | BUILDS | C10: first-attempt, recovery-assisted and verified success, interventions per task, wrong-target incidents, time per task and model calls are computed for every campaign (`write_summary` → `measures`); the measurements themselves are qualification work |
| 204 | CODE | BUILDS | C10: every seed generates new inputs, names and values for all 18 task kinds, each task runs once per seed with an honest denominator (`write_summary`), and a previously seen fixture cannot be retried into the score |
| 205 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Reclassified: the ≥90% threshold is a qualification result; `tests/jarvis/live_eval.py` hidden-oracle harness exists |
| 206 | STANDING | STANDING | Every gate |
| 207 | CODE | BUILDS | C10: regressions for the observed bugs: wrong Python download (`release_pick`, row disambiguation), hallucinated versions (`web_fact` oracle), invented URLs (deep addresses typed from memory refused, `contracts.test.ts`), verifier gaming (`gaming`, `contract-binding.test.ts`), repeated reads (stall rules) and the Python 3.12 subprocess hang (`test_a_background_child_holding_the_output_does_not_hang_the_call`) |
| 208 | CODE | BUILDS | C10: every CI job installs the exact shipped Python lock with hashes, so regressions run on the shipped versions; the frozen installer is re-checked by `packaging/check_frozen.py` (bundled browser, workers, notices) in the Windows installer job |
| 209 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | Harness: the same installer, frozen and companion suites run per platform; owner-directed run deferred |
| 210 | CODE | BUILDS | C1: companion killed mid-write (`test_a_companion_killed_mid_write_reports_unknown_after_restart_and_never_reruns`), interrupted reads and writes, network loss, interrupted and refused updates (`test_agent_recovery.py`), permission revocation while held (`held-claim-revocation.test.sql`), STOP, Take Over and retry (`authority.test.sql`, `recovery.test.ts`) |
| 211 | CODE | BUILDS | C7: incorrect values (recalculated cells and ranges), missing content (`file_contains`, ranges), damaged formatting and unrelated edits (`changes_within` with formatting), altered checked inputs refused (`planStep` fence); the actor writes only new files under OCADE output or in-place repairs with kept originals |
| 212 | STANDING | STANDING | Reclassified: a review rule applied before anything is declared launch-ready (security, privacy, provenance: `npm run licences:check`, recovery: `docs/OPERATIONS.md`); checked at every launch gate |
| 214 | CODE | BUILDS | `scripts/launch-readiness.mjs` computes the ten-milestone score from `evidence/readiness/gates.json` (`npm run readiness`, in the coding gate) |
| 215 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the repository baseline milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 216 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the device authority milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 217 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the installer and dependencies milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 218 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the computer and browser control milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 219 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the intelligence and grounding milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 220 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the verification and recovery milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 221 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the customer product milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 222 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the security and operations milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 223 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the platform and performance milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 224 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS (`npm run readiness`) | Reclassified: the final release milestone is earned only by qualification evidence; its code items are tracked under their own IDs |
| 226 | STANDING | STANDING | Every gate |
| 227 | STANDING | STANDING | Every gate |
| 228 | STANDING | STANDING | Every gate |
| 229 | STANDING | STANDING | Every gate |
| 230 | STANDING | STANDING | Every gate |
| 231 | STANDING | STANDING | Every gate |
| 232 | STANDING | STANDING | Every gate |
| 233 | STANDING | STANDING | Every gate |
| 235 | STANDING | STANDING | Every gate |
| 236 | CODE | BUILDS | C0: Appendix E compares the code with every requirement, one row per ID with its entry point and test, and is kept current batch by batch |
| 237 | CODE | BUILDS | C0/W12: one backlog: Appendix D for defects, Appendix E for coding state; the stale `HANDOFF-CODEX.md` second backlog is removed |
| 238 | CODE | BUILDS | C0: each defect row records severity, cause, evidence (reproduction or failing test), status with commit, and package; each coding row records the entry point, caller and test location |
| 242 | STANDING | STANDING | Every gate |
| 243 | CODE | BUILDS | W12: removed the unused operation shortlist (about 160 lines and its tests; production uses the capability-filtered list), the never-imported `src/lib/error-capture.ts`, the stale `HANDOFF-CODEX.md`, and 52 MB of media from the working tree (kept in history, `evidence/LARGE_FILES.md`); dead-code scans (TypeScript unused locals and parameters, `vulture` on the companion, unreferenced exports and packages) find nothing else |
| 247 | STANDING | STANDING | Every gate |
| 255 | STANDING | STANDING | Every gate |
| 259 | QUALIFICATION-ONLY | QUALIFICATION-ONLY; harness BUILDS | C10: `live_eval.py --external <tool>` builds the same seeded problems, hands each request and folder to the operator for the other tool, and scores the result with the same hidden oracle (correctness, wall time, interventions); `test_eval_audit.test_another_tool_is_scored_by_the_same_hidden_oracle`. The comparison runs are the owner's, with the tools the owner chooses |
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

**C5 updater and packaging — BUILDS for signed activation at `543eeb1ad1bc85059c9097b69a83746948e45bf0`.** [GitHub Actions run 42221887654](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42221887654) passed the coding gate, including 138 TypeScript and 92 focused Python tests.

- 186 — BUILDS — `activate-update → _activate_release → _installed_release` verifies the signed archive and actual extracted file tree, then `check-update-runtime → Gateway._session` starts and checks every required worker. The manual frozen checker uses the native Windows and macOS executable and bundled browser paths.
- 188 — BUILDS — `activate-update → _activate_release` stages privately and validates protocol, platform, architecture and file hashes before publishing one atomic selection. `run → _select_release` verifies selected files and falls back on damage. `rollback-update → _rollback_release` restores the prior valid release.
- 189 — BUILDS — Normal companion work and activation use `companion_lock`. `_no_active_jobs` also fences a detached or unresolved tracked job. The Windows installer checks the companion mutex and cannot automatically restart the companion. Worker binaries remain in their own release directory throughout activation.
- 185, 187 and 190 remain NOT CODED pending reproducible bundle, upgrade/repair/uninstall and clean-machine harness coverage. Production update signing and native installer qualification require the later owner-directed stage.

**C6 desktop and browser repair — BUILDS for this slice at `5fdfcb11e5d8ee3860147380799bceeef3e4c0bd`.** [GitHub Actions run 42224056912](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42224056912) passed the coding gate, 138 TypeScript tests and 101 focused Python tests.

- 131 — BUILDS — `Gateway → mac_worker.ui_invoke/ui_set_value → _ax_change_events` uses native AX actions, value readback and actual observer notifications. Accessibility checks precede leased access. The focused run loop fixture verifies registration, delivery and removal.
- `discovery.installed_apps/window_identity → windows_worker.apps_list/apps_launch/_leased` binds packaged Windows apps to native shell identities. Windows and macOS `ui_click_point` rechecks exact geometry and hit ownership before input. The synthetic contracts cover negative monitor origins, overlay refusal and stable packaged identity. Native desktop cases still require qualification.
- `web_open → _context` recovers a closed browser context. `_observe → _one` binds shadow-root controls to actual elements in a single tab. The bound opener records late popup events, and `web_close` checks the stored site. Tests cover detached handles, wrong tabs and off-site popup closure.
- 58, 59, 62, 76, 122–130, 132, 134–135, 138–140 and 142–144 remain NOT CODED for remaining native safety, diagnostics, browser security or qualification-harness work. This coding run did not execute a desktop or browser ladder.

**C7 deliverable repair — BUILDS for this slice at `73f5a41be7a1a674dbb875f0d1e80a637f377aed`.** [GitHub Actions run 42225868275](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42225868275) passed format, types, companion imports, protocol and shader compilation, 138 TypeScript tests and 106 focused Python tests.

- `scene.render → media_worker._scene_render → scene_gl.render/_sample_gltf` samples the same signed-distance map as the PNG and saves a standalone glTF beside the editable source project. `verify.checks(file_parses) → _gltf_mesh` reads actual vertex and normal bytes, checks declared bounds and refuses corrupt geometry. `taskView` lists the sidecar from the observed saved hash. Older companion inventories cannot be offered the export field.
- `_media_quality` refuses a video whose complete decode fails. `_workbook_formula` independently reopens the saved formula and cached result. `_command_succeeds` refuses workspace links before running in a throwaway copy and reports the expected-output result without the raw transcript.
- 61, 66–78 and 211 retain any open rows. Full format and content semantics, visual quality, and native isolation for command re-runs still need the remaining code and harness work. The hosted run used file and shader fixtures, without a live task or native GPU qualification.

**C8 customer product — BUILDS for this slice at `d6e65552527dd3db512135d9e50f1f5f4ad09570`.** [GitHub Actions run 42227866928](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42227866928) passed formatting, type and protocol checks, companion compilation/imports, migration and focused tests. `JarvisAccess → setJarvisAccess` checks device ownership and uses the same application identity as the signed action registry, including packaged Windows apps and Mac applications. `listJarvisDevices → JarvisWorkspace/JarvisAccess` reports device, permission and open task states with account-scoped queries. `taskView → TaskPanel` shows durable milestones, exact approvals, STOP, Continue, and a Retry draft only for tasks with no unresolved effects. File controls verify the user-selected local copy against the saved hash before preview, download or explicit Library upload. `useJarvisDictation` records only after a user gesture and cancels on hide or sign-out. The local non-network cache keeps only anonymous shell documents and static assets.

**C9 authority, session and privacy — BUILDS for this slice at `50f6300e8065aedade9d2729e30f4bc7916650be`.** [GitHub Actions run 42229847013](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42229847013) passed format, types, imports, protocol, PostgreSQL contracts and 14 rollback round trips, and 105 focused companion tests. `startTask → jarvis_open_task` relies on the partial unique indexes for concurrent admission, and `advance → jarvis_queue_actions` limits new pending actions under the task lock while preserving repeats. Signed claim replies carry the current detached-job grant into `Agent._loop → jobs.cancel_all`. Jobs match both PID and creation time before orphan termination. `requireSession` checks browser write origin and bypasses the session cache for writes. The browser route guard checks initial DNS and fences off-site writes; subresource redirects and transport DNS rebinding remain open under D4. `eraseAccount → revokeDevice` fences paired devices before erasure, and `exportMyAccountData → streamAccountExport` omits push credentials and device verification fields. SSR errors use the existing coarse health record. A remaining fixed test-count assertion now uses the shared required-test runner.

**C10 receipt and measurement wiring — BUILDS for this slice at `604e808dc3396cc39ae9046fbbf069bb7a01362a`.** [GitHub Actions run 42231649864](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42231649864) passed formatting, types, companion imports, protocol, 15 migration rollback round trips, 143 TypeScript tests, 106 companion tests and six fixture tests. The qualification timing test was excluded by the coding gate. `Gateway.run → taskTiming` records worker readiness, observation, execution and verification separately. `callPlanner → notePlannerCalls → jarvis_note_model_metrics` stores round-trip duration and reported token counts without changing the model service, preserving missing versus zero and deduplicating by hashed permit identity. `plannerWait → jarvis_task_wait_until` limits automatic busy retries. `taskView → TaskPanel` distinguishes execution, independent verification, refusal, failure, cancellation and uncertainty. `jarvis-live.mjs → live_eval.py` requires pre-STOP authority checks and the independent oracle, keeps wrong-target evidence, and separates clean from recovery-assisted outcomes. The existing manual hosted matrix can invoke the lifecycle harness. The coding gate uses only its single synthetic fixture cycle and audit tests.

**Integration transport — BUILDS at `2ca015fb7edf263ca4967d60f872f59aeeb68254`.** [GitHub Actions run 42233846405](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42233846405) passed the focused hosted gate including ten rendered verifier tests, both Edge entry points and 15 disposable rollback checks. The same run generated the eight affected column declarations and two RPC signatures. The generated declarations and typed metrics call passed schema drift, compilation, migrations and focused tests at `14128741d6bf588e47676d4208b5e320bcc14109`, [run 42269028072](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42269028072). `verify_checks → _web_texts → _web_fetch` connects to a vetted numeric address with the requested TLS identity, enforces encoded and decoded byte budgets, and feeds the independent browser only intercepted responses. Trusted HTTP proxies tunnel to the vetted numeric endpoint. The release fixture records actual archive requests at its HTTP server for `live_eval.py` to compare against its private target. The hosted gate parses the tracked scripts, type-checks both Edge entry points, and generates the affected public Supabase blocks against the disposable migrated database.

**Visual and source grounding follow-up — BUILDS at `19d211044414a32d8675f531b7ae0fd890e8120a`.** [GitHub Actions run 42271665419](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42271665419) passed the coding gate and five visual target fixtures, including competing patches and expired observations. `planStep → observedSinceFailure` requires a fresh observation of the same window or tab before retrying a failed mechanism. A visual click requires the latest image of the exact window. The Windows and macOS workers record bounded, expiring images and recheck geometry, focus and hit targets before invoking their pointer APIs. `vision.match` rejects competing matches and the workers record a post-click observation. `planStep` also recognizes case and separator aliases and parent moves when protecting a checked source, while permitting read-only copying. Arbitrary shell writes and native display qualification remain open.

**Screen consent and browser audit follow-up — BUILDS at `a7c93e1e2099a4267df77c33502aa1ecce72c18a`.** [GitHub Actions run 42273524172](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42273524172) passed 146 TypeScript tests, 108 companion tests, five visual fixtures and six evaluation bookkeeping tests. `DeviceAccess → setJarvisAccess` exposes the existing screen grant. `planStep → callPlanner` withholds prior pictures and visual pointer offers when that grant is off. `ui_inspect`, `ui_set_value` and `ui_send_keys` use the native protected-field flags on Windows and Mac. The manual browser audit checks Chromium, Firefox and WebKit at desktop and phone sizes, including local non-network shell behavior. Its synthetic session injection is bound to the top-level audit origin and runs only once per page session. Coding CI exercises the isolated injection and native metadata fixtures without launching the manual browser matrix.

**Session dispatch fence follow-up — BUILDS at `0565d216568313dc34565dee8b094875dc4b3ae8`.** [Hosted coding gate 42275849184](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42275849184) exercised expired and cross-account sessions, screen-grant revocation and a signed companion stopped before pickup after browser sign-out. `startJarvisTask/resumeJarvisTask → jarvis_open_task/jarvis_resume_task` bind the task to the session claim that authenticated the request. The authority checks that session inside the task lock during `jarvis_queue_actions` and `jarvis_claim_action`, so an ended session stops admission and held work even when the companion remains signed in. `jarvis_action_allowed` rechecks screen consent for pointer actions. The state RPC and account export omit the internal session identifier. Existing service and automatic retry calls retain their compatible argument defaults.

**C4 native dependency diagnostics follow-up — BUILDS at `1b8535b015512437f2c4d3eb622ab75805ad2abc`.** [Hosted coding gate 42277739734](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42277739734) exercised executable header fixtures and loader errors through the existing dependency tests. `system_dependency → dependency_candidates → executable_architectures/executable_version` reads PE, ELF, Mach-O and native metadata without running discovered candidates. `system_install_dependency → _stage_dependency` and `verify_dependency → dependency_os_error/_dependency_startup_failure` classify loader and policy failures, and `planStep` presents the coarse diagnosis. Firefox discovery reports bounded configuration IDs. Native clean-machine installation and platform acceptance remain open.

**C6 exact browser origin and upload follow-up — BUILDS for this slice at `971b4b06c65063018e36e2dfe7da1b8b245c7883`.** [Hosted coding gate 42331228556](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42331228556) passed 147 TypeScript tests, 112 companion tests, two real Chromium loopback fixtures and six evaluation bookkeeping tests. `web.open → _bind` stores scheme, host and port alongside the existing page ID. `web.read/fill/select/click/upload/download/screenshot → _bound` and `_scope` check that origin. The existing context route uses the bound opener or current interaction for ambiguous popup requests, and `_follow` checks each navigation hop. Editable controls use the matched element for keystrokes. `web.click` observes the file chooser callback before releasing its listener. `web.upload → _guard → _multipart_body` recovers a missing Chromium file part only from the exact file previously attached to that bound form and only during the current tab's interaction. The fixture independently checked the received file hash and browser teardown. Actor transport DNS pinning, other multipart forms, and platform-wide browser qualification remain open.

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
| C9 | Security, privacy, operations: headers/CSP/CSRF, export and deletion, rate limits, redaction, support and dependency provenance (161–179, 181, 212, 222) | web server, `supabase/*`, `docs/*` |
| C10 | Instrumentation and remaining code items: per-phase timing and token usage, evaluation harness code, stability harness (W1, W2, W4, W13 code items) | `authority.server.ts`, `planner.server.ts`, `tests/jarvis/*` |
| F | Integration and compilation fixes across all batches | all |
| W12 | Deep debloat, consolidation and naming | all |
| Q | Final compilation, full GitHub Actions qualification, then owner-directed model comparison and RPC | — |

**Coding-complete declaration (before W12, and again before Q):** go through all 266 IDs one by one and confirm each is BUILDS, RUNTIME VERIFIED, QUALIFICATION-ONLY with its harness code BUILDS, or STANDING. Any other state means coding is not complete: name the IDs and continue coding. Never report partial completion as complete.

**Coding-gate fidelity (`dc33d54`):** the push gate now runs lint and the whole companion suite (it ran 112 of 202 companion tests and no lint), matching `scripts/ci-local.sh`.

**Staging prerequisite before any qualification run:** apply migration `20261107040622_device_admission_shared_rate_limit.sql` to staging; the server now calls `jarvis_device_admit` on every signed device request.

**Reclassification (7 November 2026):** 3, 205 and 215–224 are milestone or threshold results and move to QUALIFICATION-ONLY; 138 is a claim rule and moves to STANDING; 214 (the score itself) is coded. No requirement was removed or changed; each still needs its qualification evidence.

**C9 sessions, injection, threats, privacy and crash reports (162, 169, 170, 175, 177) — BUILDS (local gate green; hosted run recorded on push).** New: `src/lib/security/session-standing.ts` (the decision moved out of the middleware so it is testable), migration `20261107075756_signed_out_visitors_call_no_account_functions` with rollback (anonymous callers lost two account-function grants), external MCP output redaction, the download internet mark, local crash reports. **Staging prerequisite:** apply `20261107075756` with the other new migrations before qualification.

**C7 range, image and formatting checks; invalid conditions (69, 71, 72, 73, 211) — BUILDS (local gate green; hosted run recorded on push).** New check kinds `workbook_range_equals` and `image_changed_within` (contracts, protocol, `verify_worker`, migration `20261107080533_verifier_checks_ranges_and_image_changes` with rollback). `workbook_cell_equals` no longer trusts a formula's saved result. **Staging prerequisite:** apply `20261107080533`.

**C9/C10 provider errors, secret isolation, licences, operations and locked runtime (166, 167, 180, 181, 182, 208) — BUILDS (local gate green; hosted run recorded on push).** The companion's whole Python dependency tree is now locked with hashes (61 packages); the licence check found two GPL-3.0 modules pulled in by pyautogui and keeps them out of the installer. Manual CI jobs were fixed: the planner-safety job installs Python before the tests that need it, and a stale Windows test fake now models the password-field check.

**C6/C9 targeting metadata, staff authority, deletion and export coverage (48–52, 55, 161, 172, 179; 212 reclassified STANDING) — BUILDS (local gate green; hosted run recorded on push).** Migration `20261107083209_deleting_a_staff_account_keeps_what_they_did` with rollback. **Staging prerequisite:** apply it with the other new migrations.

**C10 speed instrumentation and campaign measures (81, 82, 85, 88, 90, 91, 96, 191, 202) — BUILDS (local gate green; hosted run recorded on push).** New: percentile and outcome measures in every evaluation summary and the stability harness; the rest is recorded from existing code and tests.

**C7 verifier audit (66, 67, 68, 70, 75, 76, 77, 78) — BUILDS, recorded from the code and tests named in each row; no new code was needed.** 74 stays open: requested video edits beyond length, size, codec, loudness and gaps have no check yet.

**C4 dependency diagnosis follow-up (98–100, 110–113, 120) — BUILDS (local gate green; hosted run recorded on push).** New: `system.diagnose` names missing PATH folders and reads one registry key (Windows, read-only); the rest is recorded from existing code and tests. 104 (ARM64 artifacts) and 119 (clean-machine harness) stay open.

**C5/C6/C8 native, installer and browser audit (58, 122–126, 130, 132, 139, 140, 142–144, 187) — BUILDS; 127, 128, 129, 190 reclassified QUALIFICATION-ONLY (real-hardware test campaigns) with their harness; harnesses for 121, 133, 209 recorded.** New: Unicode and long file names tested in the sandbox.

**C10 harnesses and test inventory (193–195, 197, 199–201, 204, 207, 210) — BUILDS (local gate green; hosted run recorded on push).** New: image and video live tasks with hidden oracles, the versioned test matrix and its existence test.

**C6 planner and targeting audit (28, 29, 46, 54, 56, 57, 60, 62, 63) — BUILDS (local gate green; hosted run recorded on push).** New: the browser reports and dismisses a site's alert, confirm and prompt dialogs instead of letting them pass unseen.

**C8 website audit (148, 152, 153, 156, 159; 157 reclassified STANDING) — BUILDS (local gate green; hosted run recorded on push).** New: a first-visit script budget in the surface audit. 146, 147, 155 and 160 stay open.

**C0/W12 ledger, defect register and deep debloat (10, 13, 236–238, 243; 192 reclassified QUALIFICATION-ONLY) — BUILDS (local gate green; hosted run recorded on push).** Appendix D statuses corrected for defects already fixed in code, and this session's defects recorded (D30–D35).

**C3/C4/C5/C7/C8/C10 closing batch (23, 74, 83, 86, 87, 92, 104, 119, 146, 147, 155, 160, 185, 259) — BUILDS (local gate green; hosted run recorded on push).** New: `fs.read_text` offsets, video frames compared by `image_changed_within`, operation schemas converted once, the installer refuses 32-bit and ARM Windows, the macOS bundle is rebuilt and compared, staff device removal through the owner's path with a console screen (D36), JARVIS Read aloud, a dead-control audit, and the model-availability and other-tool comparison harnesses (neither run).

**C13 architecture batch, owner-approved findings #3–#7, #9, #15 (13 Nov 2026; concepts 20, 33, 49, 52, 58, 67; research C1, C4, C8, C10, C24, C25) — TESTED locally (TypeScript 204/204, companion 267 tests with 35 platform skips, DB 19 groups + 25 rollbacks, real end-to-end 7/7 with inline and with background planning); coding gate green on push ([run 43466391898](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43466391898)); full hosted matrix green at `1ab7cca`, [run 43483264661](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43483264661) (attempt 1: 10/11, macos-15-intel stopped at a media download HTTP 429 before its tests; attempt 2: all 11 green, incl. Windows 2022/2025 UIA ladder, macOS 15 and 15 Intel AX ladder with MAC-014, unsigned installer, three-engine site audit); runners are not consumer PCs; not RUNTIME VERIFIED against real models.** The matrix also found that `789deae` (12 Nov) broke MAC-014: a window already focused was no longer activated, so an app-modal alert did not take its keys; fixed in `1ab7cca`. One planner per task, Live/hybrid/failover deleted (`27a72ce`); planning in a Cloudflare Queue consumer after the device's answer (`5869389`; the owner creates queue `ocade-jarvis-planner` once, docs/OPERATIONS.md); guarded batches with the DB stopping the rest at the first failed step (`5355327`, migration `20261113120000`); a secure desktop (UAC, lock screen) refused on Windows before any input; dialogs named in `window_blocked` refusals, element refs `e1…eN`, `@app` task scope (`bdde5c3`, migration `20261113130000`); `web_fixture` import fixed; W12 pass (`0a08929`). Not coded: thinking/output caps per turn type (G6/G7, need a live measurement), and the 12 capabilities listed in `docs/research/OCADE_REPOSITORY_LEDGER_246.md`. Correction: commit `bdde5c3` says "companion 266"; the suite has 267 tests. **Staging prerequisite:** apply migrations `20261113120000` and `20261113130000` and redeploy the three intelligence functions before any rerun.

**246-repository source review batch (14 Nov 2026; concepts 19, 20, 33, 53, 57, 58; research C1, C5, C6, C9, C15, C26–C31) — TESTED locally (TypeScript 206/206, companion 279 tests with 14 platform skips, DB 20 groups + 26 rollbacks, real end-to-end 7/7 inline and with background planning); full hosted matrix green at `2055efd`, [run 43573350104](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43573350104) (all 11 jobs on attempt 1: Windows 2022/2025 UIA ladder with UIA-018/019, macOS 15 and 15 Intel AX ladder with MAC-015/016, unsigned installer, three-engine site audit); runners are not consumer PCs; not RUNTIME VERIFIED against real models.** All 246 repositories attempted: 244 cloned and scanned, 58 read file by file (docs/research/OCADE_SOURCE_REVIEW_2026-11-14.md), 2 unreachable; the ledger now carries source evidence for every row. Coded: unique controls keep their refs across inspections and `ui.inspect changesOnly` lists only changes; `ui.wait` for a control to appear or go (`3c5e1e9`, one loop for both desktops `a89301d`; the first matrix, [run 43569682787](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43569682787), failed MAC-016 on macOS 15 Intel because a closing alert's lease reads as changed, fixed in `2055efd`); web observations wait for in-flight requests and a quiet DOM, ignoring long polls (`3c5e1e9`, `89405c7`); the closest verified earlier route on the same computer guides the planner (`a28ac5e`, migration `20261114090000`); secret fields refused, reading-order documents, hardened LibreOffice, held-input release after STOP, structure-preserving clipping, viewport-first web controls (`89405c7`). Capability coverage 21 of 44 complete (48 %), 53 % counting partials at half; the 95 % target is not met. **Staging prerequisite:** apply migration `20261114090000` with the earlier two before any rerun.

**C12 repair after benchmark round 4 (52, 61, 28–29, 67, 70; concepts 52, 20, 28, 29, 67) — TESTED locally (TypeScript suites, database suite with rollbacks, Linux companion suite); hosted Windows/macOS run pending; not RUNTIME VERIFIED against real models.** Turn lease and per-call permit keys (D42); whole-turn service path with model failover (D43); harness completion (D44); Windows launch and window identity (D45); one keyboard contract (D46); goal-refusal diagnostics (D48); named permission requests; app program paths for the scripted route; desktop probe (D49). Detail and decisions: §19.4 "Engineering after round 4". **Staging prerequisite:** migration `20261110090000` is applied; the three intelligence functions must be redeployed from this branch before the rerun.




**P0/P1 batch, plan v8 items 10.0–10.4, 10.9, 10.10, 11.3, 11.5, 5.5 (15 Nov 2026) — TESTED locally (TypeScript security/contract/e2e 219 pass, 1 environment skip; companion 281 tests OK with 36 platform skips; DB 20 groups + 28 rollbacks; e2e timing suite 30/30; `npm run verify:full` 7/7 gates incl. the whole-site build); coding gate green on push at `06ff900`, [run 43643264538](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43643264538); **full hosted matrix green at `add60cc`, [run 43653329337](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43653329337): all 11 jobs on attempt 1 (Windows 2022/2025 companion suites and UIA ladder incl. UIA-020, macOS 15 and 15 Intel AX ladder incl. MAC-017, Windows tray test, unsigned installer lifecycle, three-engine site audit, DB and planner safety), plus whole-site `verify:full` [run 43653331570](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43653331570) and the push coding gate [run 43653324602](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43653324602) on the same SHA.** The matrix found and this batch fixed three platform defects before green: WinForms list items expose no ScrollItem (line-by-line fallback), the macOS scroll bar refuses AXIncrement (AXValue by pages), and the tray's WM_DESTROY returned None. Runners are not consumer PCs; not RUNTIME VERIFIED against real models.**
- 10.0 — `aff7d90` — Prettier on `tools/source-research/README.md`; coding gate green, [run 43638582310](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/43638582310).
- 10.1, 10.2 — `f1fd57c` — `edge-handler.ts providerBody`: JARVIS turns send `toolConfig.functionCallingConfig.mode = ANY`; operations go as complete `parametersJsonSchema`; the OpenAPI subset (`providerSchema`, moved from the planner) only for a model that refused it. Chat is never forced.
- 10.8 — PARTIAL — `f1fd57c` — the per-instance `withoutThinking` set became one capability record `refused` (thinking, forced_call, json_schema), learned from the provider's 400 text, never from model names. Not durable across instances: a table needs a staging migration and regenerated Supabase types (owner/deploy step).
- W2 defect (new, fixed) — `0aa322a` — the nudge token bucket drained by about one token per task, so from the 11th task every nudge was ignored and pickup fell back to the 60 s poll (the e2e timing suite failed deterministically at task 11). A nudge is now useful when its claim sees the server state change. Synthetic timing: idle pickup p95 410 ms, active pickup p95 295 ms.
- 10.3, 10.4 — `a0e179c` — `compileGoal` asks every milestone for its operation `families`; `planStep` sends schemas only for those families (others by name, first clause, "schema on first call"); migration `20261114210000` (with rollback) accepts the bounded list. History 24k/16k → 12k/9k characters. Measured on the file-task fixture: offered operations 5,869 characters (10,912 by size alone); the whole step turn 10,890 characters, about 2.7k tokens.
- 10.9 — `06ff900` — an `expect` call in a multi-call turn guards the call before it; `actionIntent.expect` (at most 3); `gateway.py expectation_unmet` checks the step's own evidence; migration `20261114220000` (with rollback) cancels the rest of the batch on `expectation_unmet`. Hosted STOP-mid-batch proof on Windows/macOS still to run (manual matrix).
- 10.10 — `06ff900` — a step awaiting approval or an answer shows its summary unclipped; the exact effect was already whole and scrollable (`exactEffect`, 4,000-character test). No browser render test of a 2,000-character command yet.
- 10.7, 10.11 — already done before this batch (`benchmark.py --model` with the two allowed models; `live-session.ts` deleted in `27a72ce`).
- 11.3 (web part) — `web.scroll` (read; whole screens with the mouse wheel; returns the page and `scroll.top/atTop/atBottom`); its test loads a row that appears only on scroll. `ui.scroll` for UIA/AX NOT CODED (needs the Windows/macOS runners to test).
- 13.7 (part) — NAT64 (`64:ff9b::/96`) addresses carrying a private IPv4 are refused by the browser and the verifier fetch (`sandbox.non_public_address`, one check for both); 6to4 and Teredo were already refused.
- 11.5 — `REPAIR_HINTS` in `planner.server.ts history()`: one generic sentence for 30 real refusal codes.
- 5.5 / 11.7 (part) — `ocade_agent enroll` prints and opens `/ocade-jarvis?settings=devices#pair=<code>`; the Devices panel fills the code from the fragment and still requires the person to press Pair, with a warning to pair only the computer in front of them. Not browser-tested signed in (needs a staging account).
- 10.5 (part) — spending ceilings: `modelBudgetReached` before every planner permit (`plannerAccess.acquirePermit`), an account's last 24 hours and every account's month (UTC) against `OCADE_ACCOUNT_DAILY_MODEL_USD` and `OCADE_MONTHLY_MODEL_USD`, estimated from the provider's reported tokens at Flash-Lite's paid prices; migration `20261114230000` (`jarvis_model_tokens`, service role only, with rollback). The owner sets the numbers (Part 19.5); unset means no ceiling. Charging allowances in credits instead of one use per task is NOT CODED (pricing is the owner's decision).
- Session mode (5.4 part) — `--session-minutes N`: the companion ends after N minutes with no running or waiting task and no unfinished job. The default stays always-ready until the owner decides C4. Windows tray (`ocade_agent/tray.py`): a notification-area icon while `run` is active, its menu writes the local STOP file and opens the JARVIS website; closed with the companion (`tests/test_tray.py`, Windows runner only). macOS menu-bar item NOT CODED (AppKit needs the main thread).
- 11.3 (desktop part) — `ui.scroll`: Windows ScrollItem/Scroll patterns, macOS AXScrollToVisible and the scroll bar's AXIncrement/AXDecrement, never the pointer; fixture cases UIA-020 and MAC-017 added (run only on the hosted Windows/macOS matrix).
- 11.2 — `mac_worker._expose_tree`: AXManualAccessibility once per process before a lease is matched, then up to 2 s for a window's children; AXEnhancedUserInterface deliberately not set (side effects on other apps). Native-app regression covered by the MAC ladder; an Electron/Chromium tree on the hosted runner is not yet tested.
- 11.1 — `windows_worker._cached_descendants`: one `FindAllBuildCache` call (control view, not off-screen) with a cache request for name, automation id, control type, box, enabled, password and value, at most 150 elements, `omitted` reports the rest; the old walk stays as the fallback when a provider cannot answer the cached query. Proof is the hosted Windows UIA ladder; the 300 ms median target is unmeasured.
- 12.3 (companion part) — `ocade_agent forget [--browser-profile]`: under the companion lock, cancels unfinished jobs and removes the action journal, job records and crash reports (and OCADE's own browser profile only when asked); the pairing, installed releases and every file in the JARVIS folder stay (`test_agent.ForgetTaskDataTest`). Server-side JARVIS history deletion from the website is not part of this item yet.
- 10.6 — the capability record gains `system_instruction`: a model whose 400 says its developer/system instruction is not enabled is asked once more with the instructions at the start of its first user turn, and the refusal is remembered (`model-route.test.ts`). The live probe of what Gemma 4 31B accepts is qualification.
- 11.4 — MEASURED, not switched: on seven fixture pages Playwright 1.64.1 `aria_snapshot(mode="ai")` was 12–72% of the current observation's size on six ordinary pages, but 5.9 times larger on the long page (`/big`: 88,642 vs 14,995 characters, where the current observation is bounded at 16 KB). Switching needs its own size bound, the site binding, newest-observation selectors and secret-field refusal re-done on refs, and equal fixture success; the 40% rule of item 11.4 is not yet shown for the bounded case.
- Not coded in this batch: credits-based charging (owner decision), 11.6 tray, 11.8 updater work, 11.9, P2–P4.


---

## Appendix F — Preserved complete engineering operating contract from v7

The following original engineering contract is retained for safe JARVIS implementation. If a quoted legacy phrase conflicts with the updated coding-first and benchmark loop in Parts 23–25, the latest explicit owner decision governs. Full untouched text is also in the archived v7.

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


## Appendix G — Research and documentary provenance

1. The full v7 plan, including every historical source statement, is preserved unchanged at `docs/archive/plan-v7-2026-11-14.md`.
2. The 236 research dispositions are archived in `docs/archive/plan-v6-2026-11-07.md`; their supporting heading-and-concept index remains in `docs/research/OCADE_complete_heading_and_concept_index.md`.
3. Review `docs/OCADE_INTEGRATION_RESEARCH.md`, `docs/research/OCADE_246_FULL_SOURCE_ARCHITECTURE_BLUEPRINT.md`, `docs/research/OCADE_REPOSITORY_LEDGER_246.md`, and `docs/research/OCADE_SOURCE_REVIEW_2026-11-14.md` before proposing additions from researched repositories. The 243 source submodules were deleted intentionally; they are not dependencies of this plan.
4. Keep authorizing evidence separate from implementation and implementation separate from independent runtime proof. No claim of complete line-by-line source inspection is made by this revision.

## Appendix H — Exact v7 benchmark and evaluation specification (preserved evidence; no duplicate campaign)

This is the one preserved source of the prior evaluation categories, exact seeded benchmark tasks, applications, historical rounds, results, failure logs and permissions. It is copied without rewriting historical results. Its OLD per-run authorization descriptions and previous configuration alternatives are historical: the latest owner instructions in Parts 3, 17, 23 and 24 govern subsequent runs. Part 17 invokes this specification rather than defining duplicate benchmark tasks. The 16-model comparison and the E1–E4 campaigns remain distinct; historical attempts do not count as new first-attempt passes.

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

### 19.4 Owner-directed model comparison — 4 tasks × 2 standalone models × Windows/macOS (O15, O16)

**Status: 0 of 16 newly scoped evaluations verified.** Historical experiments used three obsolete configurations; their actual outcomes are preserved in the dated table below but do not count as tests of the new two-model comparison. The two-model scope is **coded** (13 Nov 2026: `plannerModel` accepts one allowlisted planner; the Live transport, hybrid route and model-to-model failover are deleted; the benchmark function and harness take the model id, `ocade-intelligence-benchmark/<model>`, `benchmark.py --model`) but **not deployed**: report UNTESTED or BLOCKED until a real run at one commit produces evidence.

**Benchmark applications** (free only, no trials or subscriptions; the names are benchmark requirements, never product logic, O8). Installed and executed in the isolated session container (Ubuntu 24.04, 4 CPU, 15 GB RAM, no GPU) on 7 Nov 2026:

| Application | Version | Licence | Source | Executed here | Platforms (vendor) |
|---|---|---|---|---|---|
| LibreOffice Calc | 24.2.7.2 | MPL-2.0 | Ubuntu archive | `soffice --version`; headless recalculation used by the existing office worker | Windows, macOS, Linux |
| GIMP | 2.10.36 | GPL-3.0+ | Ubuntu archive | batch mode created and saved an `.xcf` with a layer named `Shadow` | Windows, macOS, Linux |
| FreeCAD | 0.21.2 | LGPL-2.0+ | FreeCAD maintainers' PPA `freecad-stable` (not in the noble archive) | `freecadcmd` built a 4200 × 1900 × 1150 mm solid and saved `.FCStd` | Windows, macOS, Linux |
| Blender | 4.0.2 | GPL-2.0+ | Ubuntu archive | background Cycles CPU render to PNG (the Ubuntu build has no OpenImageDenoise, so denoising must be off) | Windows, macOS, Linux |
| DaVinci Resolve Free | — | Blackmagic EULA (free) | — | **BLOCKED**: the download needs Blackmagic's registration form (personal data; not submitted without the owner), and Resolve on Linux needs a discrete GPU with ≥4 GB VRAM (OpenCL 1.2 or CUDA) and 32 GB RAM; this container has no GPU and 15 GB | Windows, macOS, Linux (Rocky 8.6) |

**Tasks** (identical objective text, seeded inputs and hidden oracle for every configuration; the harness supplies only the objective, inputs and scopes, §19.1):
1. **Calc, speed:** change B7 to 128, recalculate, save and verify. Oracle: B7 = 128; every dependent formula's value equals an independent recalculation; file saved and re-opens. Measure the local execution time apart from model time (target: sub-second local execution).
2. **GIMP, speed:** in an already-open project, disable the `Shadow` layer, verify the visual change and save. Oracle: the saved project has `Shadow` hidden and every other layer unchanged; the flattened image differs only where `Shadow` contributed. Target: sub-second local execution.
3. **FreeCAD + Blender + Calc, extreme:** an original, dimensionally consistent electric sports car (body-in-white, chassis, suspension, wheels, interior, materials, renders) plus an editable component spreadsheet. Oracle: the CAD and Blender files re-open; named parts exist; key dimensions (wheelbase, track, overall length/width/height, wheel diameter) agree across CAD, Blender and the spreadsheet within a stated tolerance; renders are non-blank; the spreadsheet's totals recalculate.
4. **Blender + DaVinci Resolve Free + GIMP, extreme (uses Task 3's car):** a 60 s ± 2 s commercial with audio, an editable timeline, a vertical version and a poster. Midway the wheelbase and suspension change and every dependent artifact must follow; an injected application crash must be recovered without redoing finished work. Oracle: §19.3's technical and structural verdicts, plus the changed dimension found in every dependent file; subjective quality is human review at RPC only.

**Only permitted planner models** (server-selected, independently per run; never selected by untrusted request data):
- **Gemini 3.5 Flash-Lite** — `gemini-3.5-flash-lite`; existing production Standard default, streamed text/tool-calling planner; measure actual tool calls, latency, correctness and quotas rather than assuming success.
- **Gemma 4 31B** — `gemma-4-31b-it`; independent streamed text/tool-calling planner with image input; its thinking request must be checked against provider support and its measured quota.
- **No third model and no hybrid.** Each task uses exactly one of the two models for planning, retries and repair. Legacy Live and combined routes are retired from the *approved plan*, not yet removed from runtime source; Gemini Live can remain a separately authorised voice interface, never a planner.

**Quota and the three projects:** each key slot belongs to its own Google Cloud project with separate per-model RPM/TPM/RPD. Obtain the real limits from provider responses, AI Studio and the existing `npm run model:availability` check; log 429s per slot and model. Do not rotate projects to evade project quota restrictions. Both permitted planners run independently, not as a combined model route. Free-tier data-handling restrictions still apply; do not send sensitive or personal customer data to a tier that forbids it.

**Metrics per run:** first-action latency, total time, model calls and tokens (`timing.providerUsage`), CPU/RAM of the companion and each application, interventions, recovery results, oracle verdict, output-quality notes, timestamped intermediate and final screenshots, editable artifacts and the run's commit. Ranking: verified accuracy, then output quality, then completion time, then cost.

**Owner update (12 Nov 2026):** DaVinci Resolve has already been replaced for the benchmark by Blender's Video Sequencer and Kdenlive; CapCut only where officially available. Mandatory new comparison: Windows 4 × 2 = 8, macOS 4 × 2 = 8, total **16 runs**. Linux 8 optional, only if quota and runner time remain.

**How the runs reach the models (prepared, verified):**
- **Legacy staging implementation (historical, not an approved two-model route):** `ocade-intelligence-benchmark` was deployed with `/a`, `/b`, `/c` server-side configurations, alongside the existing `ocade-intelligence-service`. Its credential-free security smoke returned 400/404/403 for the relevant invalid cases. The staging `GEMINI_MODEL` secret and functions have not been changed by this document edit. Before the new two-model qualification, an independently approved code change must remove the obsolete Live/hybrid routes, expose only the two standalone planner options, update the evaluation harness, and verify the security boundary; do not infer the change already happened. Rollback material: `evidence/2026-11-07-staging-function-backup/`.
- Runner side: the existing `.github/workflows/jarvis-staging-evaluation.yml` and `tests/jarvis/benchmark.py` drive the real authority and companion, seeded inputs and hidden oracles on hosted Windows/macOS desktops; its **historical three-configuration matrix must be updated** for the newly authorised two standalone models before any new comparison run. The owner approves each protected-environment run. Linux remains optional.
- Applications on runners: Chocolatey (Windows), Homebrew (macOS) or apt + the FreeCAD PPA (Linux): LibreOffice, GIMP, FreeCAD, Blender, Kdenlive, ffmpeg. CapCut: no Linux build; the Windows/macOS builds need an interactive account sign-in, so it is not installed.

**Historical evaluation matrix (obsolete A/B/C routing; evidence retained for audit only, not a current model option):** all runs below FAILED; no task PASSED.

| Run | System × configuration | Tasks | Result | Cause found |
|---|---|---|---|---|
| [42421618278](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42421618278) | macOS A, B, C | 4 each | 0/12 PASS | A: Gemma's first byte took >25 s, keys failed over, turn deadline lost; B: every Live session refused ("API key not valid" with `?key=`) |
| [42422302152](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42422302152) | Windows A, B, C | 4 each | 0/12 PASS | same, plus the planner's 110 s wait expired before the 140 s turn (duplicate permit); GIMP not found by the harness |
| [42425648457](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42425648457) | Windows + macOS A, B, C | 4 each | 0/24 PASS | | B: Live answered (≈3.7k in / 70 out tokens, ≈10 s) but the adapter closed at `turnComplete` before the asynchronous call; C: apps discovered (`apps.list` found Blender, FreeCAD, GIMP 3.2, Kdenlive, LibreOffice), then OCADE refused the step because the person had not allowed the app (`app:` consent) | Windows A/B/C and macOS A also 0/4 each (turns without a call, duplicate charges). |
| [42427996732](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42427996732) (benchmark function v6, commit `b49a517`) | Windows + macOS A, B, C | 4 each | 0/24 PASS | A furthest: Windows car reached `apps.list` → `apps.launch`, macOS GIMP reached `apps.list` → `ui.inspect` (7 model calls, ≈20k tokens), then "planner busy" or provider_failed; B: all 8 tasks ended `invalid_goal` (the model's checks failed OCADE's validator twice, ≈8k input tokens per task); C: duplicate_completed / planner_stream_incomplete on the Gemma leg |

Verified along the way: real desktop sessions on both runners (timestamped screenshots show Calc with the workbook and GIMP 3.2.6 with the four-layer project, plus a macOS network-permission prompt); OCADE's `apps.list` discovers the installed applications dynamically; real limit discovered: `gemma-4-31b-it` free tier, 16,000 input tokens per minute per project (primary).

**Open after round 4: the architecture review** ([`docs/research/OCADE_ARCHITECTURE_REVIEW_2026-11-08.md`](docs/research/OCADE_ARCHITECTURE_REVIEW_2026-11-08.md), research only, 8 Nov 2026) traces every failure. Its sequence enters this plan through §10 when coding resumes:
1. Per-turn diagnostics in the task report (attempt key, gate outcome, model, goal-rejection branch, first-byte/total ms).
2. **Attempt identity** (confirmed root cause of every `duplicate_completed` and the 38 HTTP 409 stalls): the planning-turn key `jarvis-plan:<task>:<controller>:<steps>` is reused by every retry; give each provider attempt its own key and replay a settled answer.
3. Durable per-model capability record (thinking support, function-call reliability, latency class, TPM), learned from provider responses.
4. Delta prompts (≤ 3k input tokens per step turn; free-tier Gemma TPM is 16,000).
5. Plan-first guarded execution as the default for reversible workspace milestones (the existing step lists, §13).
6. Current owner policy supersedes the review's proposed mixed-model repair path: both planner models must be evaluated and operated **independently**; no combined/hybrid route.
7. Ask for a missing `app:` grant by name.
8. Rerun 4 tasks × 2 standalone models × Windows/macOS = **16 new mandatory runs** after explicitly approved implementation and staging deployment; Linux 8 optional. Historical 24-run results are unchanged.
The 84 concepts are consolidated into 12 mechanisms there (KEEP 48, IMPROVE 17, MERGE 17, REPLACE 1, REMOVE 1); Appendix B keeps all 84 rows until §10 accepts the change.

Defects fixed during the campaign (each with a test where code changed): 25 s first-byte deadline too short for Gemma (now 60 s, turn 140 s, planner 145 s); Live key refused in the URL and headers unsupported by the Edge runtime (now a single-use ephemeral token minted over REST); Live turn closed before asynchronous calls (now settles at `IDLE` or after the last call); no reason logged for provider failures (`ocade.provider_issue`); harness PATH shadowing, Windows version-step hang, Chocolatey 2 flag, GIMP location, missing `app:` consent in the harness. The benchmark function is at version 6. Text-only model answers are now corrected once under a new key (`b49a517`).

**Engineering after round 4 (batch C12, 10 Nov 2026).** Each failure was reproduced from the code path and a failing test before it was changed. Labels are evidence states (§6): none of this is a benchmark result.

| Defect | Root cause (verified in code) | Fix | Evidence |
|---|---|---|---|
| D42 `duplicate_completed`, 38× HTTP 409 `permit_refused` | The billing permit's idempotency key (`jarvis-plan:<task>:<controller>:<steps>`) was also the only mutex of a planning turn. A device poll during a turn's corrective second ask met the settled first permit and parked the task; a dead service instance left the permit claimed for 30 min. JARVIS turns inside a task cost nothing (20261013090000), so a fresh key never double-charges and a settled-answer replay is not needed | Migration `20261110090000`: a 160 s planning-turn lease and a turn counter on the task row (`jarvis_planner_turn`, `jarvis_planner_turn_end`); permit key `jarvis-plan:<task>:<turn>:<call>`; a held turn is left alone; a dead holder is replaced at expiry. Retryable failures (broken stream, 5xx, refused claim) resume by themselves; the three automatic retries count consecutive unanswered turns | TESTED: `tests/jarvis/db/planner-turn.test.sql`, `tests/security/planner-wait.test.ts`; rollback round-trips; applied to staging. `a88fd97` |
| D43 provider failures end a task; C behaves like A | Failover and retry happened only before a provider's first byte; the planner acts only on a complete turn, so a turn broken midway had delivered nothing, yet ended the task, and the second model was never asked | The service door reads the turn to its end before delivering anything: a failed or empty turn goes to the route's next model or is asked again within the same budget (3 upstream requests per model, 140 s); a complete turn without a call goes to the next model (`no_call` logged per model); refused content is never retried | TESTED: `tests/security/whole-turn.test.ts` (6 cases fail on the old handler; chat stream rules unchanged). `e34374a`. Not deployed to staging yet |
| D44 no PASS could be recorded | `benchmark.py` required task status `"done"` (a step status); a completed task is `"completed"` | One `completed()` helper | TESTED: `test_eval_audit`. `92d3dda` |
| D45 Windows apps not launchable or not grantable | `apps.launch` resolved only App Paths/PATH (shortcut-only apps refused); it waited for a window of the launcher's own executable; a launcher's window was named by a program no person can allow | Shortcut targets are launch paths; a new window of a program in the launched folder is accepted; a window is named by the installed app it belongs to (own program, else nearest running installed ancestor in the same folder) | CODED + unit TESTED (`app_key`); real-desktop cases UIA-015/016 await the hosted Windows run. `b75514b` |
| D46 keyboard input had no contract | `ui.send_keys` took a bare string: Windows read it as pywinauto commands (text with `+ ^ % ~ ( ) { }` corrupted), macOS could type characters only (no Enter, Tab or shortcut) | `keys` is a list of `{text}` or `{press}` items (`Mod` = Ctrl/Cmd), validated by the server and translated by one module (`keys.py`) for both bridges | CODED + TESTED (KEY-001…006, contract test); real-window cases await the hosted run. `6b914dd` |
| D48 Retired Live-planner `invalid_goal` (historical diagnostic only) | The legacy Live configuration's goal was refused; the precise validator failure was initially unknown | Additional refusal codes and `no_call` logging were added | Historical diagnostic recorded (`5632e0f`); **no further Live planner evaluation is authorised under current O15** |

Also in C12: CI lint and format gates repaired (`edaf6d2`); an installed app resolves to its program path for the scripted route (`ee93eee`); a missing `app:`/`site:` grant is asked for by name and the task waits (`0e31fd9`); the Edge worker logs the platform's shutdown reason (`ocade.worker_unload`) because Supabase documents the 150 s wall clock as **per worker**, not per request, which is the likely cause of `planner_stream_incomplete` (still a hypothesis until a run shows the log line); a desktop probe drives the real bridge in real Calc and GIMP windows on the hosted matrix without a model (`67d889b`).

**Decisions (C12), with what would reverse them:**
- *Turn lease instead of the review's attempt counter plus settled-answer replay.* The lease separates "who is asking" from "what is charged" in one place; replay would store model output on the permit to avoid a charge that task turns do not incur. Reverse if task turns become chargeable.
- *Whole-turn reading only for the service door.* A person's stream must stay incremental. Reverse if a planner ever consumes partial turns.
- *Durable per-model capability record (review step 3) deferred.* The thinking refusal costs one fast 400 per cold worker and no longer spends an attempt; a table adds a migration and a cache for under 2% of turn time. Revisit if `ocade.provider_issue` shows it dominating.
- *Window identity by folder and ancestry, not AppUserModelID.* Testable without Windows internals and names no application. Reverse if the hosted cases show ancestry missing real launchers.

**Still open:** D47 (offered operations alone contribute 6–9k input tokens per turn and one model call per effect), D49 (desktop probe behaviour in real Calc/GIMP windows), separate **Flash-Lite and Gemma 31B** real-task evaluation after approved runtime changes, and staging deployment of the changed boundary. The former three-model/Live comparison is retired.

**Blockers (exact, current):**
- **B1 Approval per run.** The runner jobs use the protected environment `SUPABASE_SERVICE_ROLE_KEY`, which needs the owner's "Approve" on each run before the job starts (smoke run [42420339443](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42420339443) waits for it). No other credential is missing.
- **B2 Runner versus consumer PC.** GitHub-hosted Windows Server and macOS runners are cloud machines with a desktop session, not consumer Windows 10/11 or consumer Macs; their results are cloud qualification (§6 E7), and A2 still governs the owner's own computer.
- **B3 Hardware.** No GPU on standard runners: Blender renders on CPU, so long renders may not finish within 6 h; a task that runs out of time is recorded FAIL with its measured progress.
- **B4 CapCut** not installed (above); Kdenlive and Blender's Video Sequencer are the editors.

**Order (O16, superseding the old comparison):** the sole planner qualification is the approved two-model independent benchmark (16 mandatory runs). No research, installation, deployment or invocation of a third planner model or hybrid route without a new owner decision; retain earlier runs as historical evidence.


## Part 23. Mandatory coding-complete GREEN gate BEFORE cloud-computer benchmarks (owner addition)

23.1. Finish 100% of mandatory implementation for the **ENTIRE OCADE PRODUCT**, in strict order: JARVIS, Windows/macOS companion and native-first PC control first; online Chat and universal API/model adapters second; offline Chat, downloaded local model and cached website third; then full site settings, UX, account/customer journeys, help/policy pages, security, backends, required 72-entry source integration, bounded multi-agent coordination, secret/key health routing, owner-supplied Supabase credential registry and secure customer BYOK Settings/model gateway with strict per-source noninterference (Parts 14B.1A–14B.1B), the 38-proposal consolidated trace and applicable additional elite strategies (Part 14C), deep debloating and full validation. Include task authority, STOP/Take Over, permission fences, exact approvals, recovery and independent verification throughout. All applicable prior PARTIAL items must be finished or explicitly justified as nonrequired, preserving historical IDs and archived evidence.

23.2. `CODED` means the implementation and callers exist; `BUILDS` means affected build, typecheck, lint, formatting, protocol, relevant unit/security tests and database checks are green; `QUALIFIED` means runtime proof, separately. Neither the presence of source code nor green CI alone implies release qualification.

23.3. Complete source changes in small reversible batches. After each batch run the affected tests, including STOP, approval correctness and wrong-target regressions. Do not defer critical safety tests. **Every commit creates a required CI-follow-up obligation:** correlate checks and logs with the exact commit, monitor them through completion, fix any failed mandatory check without weakening tests, and rerun checks on a new commit until green. While GitHub Actions jobs execute, make progress on other independent, nonconflicting code work; do not wait idle, lose track of red checks, or claim a pending job passed. Integrate and reconcile these streams before moving to benchmarks. Preserve useful tests.

23.4. When all coding items are classified, run the COMPLETE required GitHub compilation/coding validation on one candidate SHA: dependency installation, formatting, linting, TypeScript compilation/typechecking, build, protocol/contract checks, no-hardcoded scan, database/migration tests where supported, **the ENTIRE OCADE WEBSITE including JARVIS, ONLINE CHAT and OFFLINE CHAT, settings, all customer flows, UX, security and user policies**, Windows and macOS companion tests, packaging, and all mandatory source-dependent checks. Every required job must pass, with genuinely unsupported platform skips listed rather than disguised as green. Address stale research links and legacy model callers only when their removal does not damage working features.

23.5. **Hard gate:** Start NO cloud-computer real-task testing, E1–E4 or model performance benchmark until ALL mandatory OCADE-wide coding is finished, including the applicable Part 14A 72-item integration/partial-items ledger and Part 14B whole-site acceptance tasks,, the whole OCADE website and companion compile/build, every required coding/security/website/companion CI job is COMPLETED GREEN on the SAME final commit SHA (not pending, skipped without justification, or green only on earlier commits), required test secrets/environment are explicitly authorized, and the release evaluation harness is ready. Any subsequent commit invalidates the candidate's previous green proof; reverify the new SHA. A benchmark failure reopens coding, and the entire relevant coding/build gate MUST be green again before reruns.

23.6. Record `Coding completeness: independently completed and tested mandatory full-product items / all applicable full-product mandatory items × 100%` separately from technical release readiness. Include JARVIS, online/offline Chat, full-site UX, security, secret/model integrations and source entries. Historical 266-ID and 84-concept tracking remains intact; reconcile overlap so one physical change is not counted several times. Never manufacture 100% through scope exclusions.

## Part 24. Autonomous benchmark → general repair → coding-gate → retest loop (owner addition)

24.1. Once Part 23 is fully green for the ENTIRE SITE on the same final SHA, execute the canonical benchmark configuration in Appendix H. Start with the initial two standalone baseline models on identical seeded objectives, resources and oracles: four tasks × Windows/macOS × Gemini/Gemma (16 runs); qualify additional explicitly authorized provider adapters separately. Then execute E1–E4 and required real-device qualification, online Chat/customer workflow tests, site security/UX tests, and **LAST the offline model download, airplane-mode website open/reopen and disconnected local-inference suite** in dependency order. Never mix the two planners within one task or hardcode application names, steps, selectors or test answers into production routing.

24.2. On ANY task failure, **do not stop for routine discretionary approval** inside an already-authorized, free, safe cloud-computer test scope. Capture the complete trace: failed action and permission scope, model request and response metadata (without secrets), screenshots/structural observations, logs, exact error, task state, whether effects are known or unknown, generated artifacts and independently checked oracle verdict.

24.3. Diagnose and make the smallest general fix to the existing JARVIS code, test harness or environment. Reject task-specific patches, planted benchmark answers, retries of unknown effects, weakened protections, truncated approvals, synthetic oracle passes and threshold changes. Preserve original failing results and distinguish reproducible product defects from quota, missing dependency, environment and flaky-test causes.

24.4. For each fix: run focused regression tests; rebuild the entire site and companion; rerun the entire required coding/build CI until GREEN on the same new commit; then rerun the failed task under the same conditions and rerun the affected category and appropriate hidden-answer tests. While CI runs, continue other independent safe coding improvements; fix and track all red commit checks and never benchmark a still-running or red candidate. Continue this evidence-backed code → green-CI → benchmark → general repair → green-CI → retest cycle within approved time, quota, spending and authorization bounds until every applicable mandatory launch gate passes and independently measured JARVIS engineering readiness reaches 100/100%, or a precise evidenced blocker prevents safe continuation. Do not fabricate 100% or treat repeated retests as new first-attempt successes.

24.5. Record for EVERY task and attempt: ID, objective, original seed, platform, model, tool route, source SHA, fixture hash, start/end timestamps, wall-clock time, time-to-first-safe-action, model latency and tokens, device execution time, API calls, CPU/RAM, monetary or free-tier quota use, user interventions, approval decisions, recoveries, postcondition results, artifacts, verifier/oracle outcome and any unresolved error. Report median, p95 and maximum durations and the first-attempt pass rate over a published denominator. Use monotonic clocks for durations and explicit wall-clock timestamps for audit logs.

24.6. Never bypass protected-environment approval, exceed quotas or budgets, expose keys, use a consumer PC without approval, deploy to production, alter a secret, or spend money under the guise of automatic repair. An authorized initial testing approval may cover repeated NON-DESTRUCTIVE fixes and cloud reruns inside the same already-approved scope. If additional protected approval is required by GitHub or the owner, record the exact blocker rather than silently bypassing it. Use bounded retries/backoff to avoid unending, expensive or destructive loops.

24.7. Require zero known critical/high safety defects, fully passing mandatory safety scenarios, independently verified outputs, the existing ≥90% E4 first-attempt target with ≥95% ambition, and all release gates. A failing real-world task remains a FAIL until it actually passes; do not report public readiness while critical coverage is missing.

## Part 25. Make Gemma 4 31B and JARVIS significantly faster and stronger (owner addition)

25.1. Treat speed as an end-to-end task result, not raw token-generation speed. Re-measure the baseline on identical tasks and compare Gemma 4 31B to Gemini 3.5 Flash-Lite independently, without claiming a winner until the measured 16-run comparison has completed. Provider-specific network, queue, quota and model latency must be separated from device action time.

25.2. Reduce the reported ~15,000 input-token planning turns to a typical ≤4,000, with ≤8,000 in justified complex cases. Offer operation families dynamically at goal creation; load complete schemas only for pertinent tools; replace repetitive history with verified structured state, changed observations, compact failure reasons and milestone checkpoints. Measure tool recall and decision parity on held-out tasks so aggressive compression cannot silently reduce accuracy.

25.3. Use forced structured calls only on providers and models that actually support them, with a durable per-model capability cache. Preserve complete JSON Schema and device/server argument validation. On unsupported parameters, learn the refusal once, use a safe supported request shape and retest; never keep repeatedly sending incompatible thinking or function settings.

25.4. Move planning outside device-request deadlines. Execute small, independently guarded deterministic action batches, locally verify expected postconditions after each step, and contact the model again only for new uncertain decisions, deviations, cross-app interpretation or creative reasoning. Heavy renders or exports run as durable jobs and are polled without wasting planner turns. Keep STOP and Take Over synchronous and authoritative throughout.

25.5. Choose the cheapest, fastest and most accurate available native application object model or file operation first, followed by system scripts, DOM, accessibility, and screenshots only as last fallback. **The multi-agent coordinator is mandatory but bounded**: delegate only independent reasoning that demonstrably benefits from parallel specialist work while one mutation authority controls PC actions. Avoid extra competing controllers, uncontrolled tool swarms, duplicate searches, unnecessary full-screen captures and repeated introspection. Reuse verified routes with parameter and permission checks only when held-out correctness tests prove them safe.

25.6. Strengthen complex multi-hour work by externalizing task objectives, dependencies, budgets, approvals, intermediate deliverables, task journal, verified checkpoints, recovery state and resumption. Favor specialist deterministic workers and domain checks rather than hallucinated model memory or hardcoded application flows. Independently validate final 3D objects, spreadsheets, animations, browser state and other outputs with objective oracles where possible.

25.7. Measure at least 30 tasks per workload category for median/p95 planner latency, time-to-first-action, task completion time, token counts, quota refusals, recoverability, tool-call correctness and verified first-attempt success. Any claimed speedup must compare identical seeds and identical resource constraints and must report failures and statistical uncertainty. No guarantee that software changes can eliminate provider-side inference latency.

## Part 26. Measured complete OCADE product readiness (0–100%) and honest progress (owner addition)

26.1. **Routine chat/status messages:** one single line with no more than two words (Caveman mode). **Final outputs, audits, milestone updates and substantive reports are exempt and may be detailed;** these must start with **COMPLETE OCADE product readiness: X/100%** only when justified by explicitly defined technical gates and independent evidence tied to a commit/time. Historical general-release scores are not a validated JARVIS engineering readiness measurement. Separately show coding coverage, deferred IDs, 84-concept verification, passing technical gates, pending/failed GitHub checks and independent benchmark results. Never invent a score.

26.2. Updating a checklist, writing a plan, compiling source, or completing only simulations is not grounds to raise readiness percentage. Only independently verified gates on the tested commit may change the score. Preserve the established release-gate calculation; do not invent weights or merge code progress with production qualification.

26.3. Report progress at each verified 10% milestone and whenever useful. Say what changed, passed, failed, was excluded with reason, remains blocked, and what must happen next. Maintain distinct `NOT CODED`, `CODED`, `BUILDS`, `RUNTIME VERIFIED`, `PARTIAL`, `FAIL`, `BLOCKED`, and `UNTESTED` states.

26.4. **100/100% JARVIS ENGINEERING GO** is allowed only after all required JARVIS coding and security checks are green; two-model and E1–E4 evaluations meet their mandatory criteria; Windows 10/11 and macOS receive authorized real-device qualification; customer setup, STOP/Take Over, task recovery, verified deliverables and support pass; there are no unresolved critical/high defects; and required technical testing approvals are obtained. Public deployment remains separately approval-gated and cannot be implied by this score. Otherwise the answer is NO-GO with exact unmet technical conditions.
