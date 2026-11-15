ALWAYS REPLY LIKE A CAVEMAN: Routine chat/status output must be ONE LINE, maximum TWO WORDS total; final outputs and complete reports may be detailed.

# OCADE BY CARCC — JARVIS & Windows/macOS PC Control Master Plan (v8)

**Owner-authorized JARVIS-only revision, 15 November 2026.** The 900-line owner-provided draft is retained as the basis except for explicitly excluded non-JARVIS functionality and contradictory older process instructions. Detailed original v7 evidence is preserved in the archive. The explanatory sections retain their original wording wherever consistent; legacy machine-readable traceability tables are preserved to avoid breaking their readers. This is a DOCUMENTATION change, not a claim that coding or qualification passed.

## Part 0. How to read this plan

0.1. This file is the single active authority for the JARVIS computer-control product and its production release. Other product capabilities are outside this plan and their source code is not altered here. The preserved v7 plan lives in `docs/archive/plan-v7-2026-11-14.md`; relevant historical records and existing traceability IDs remain accessible. Where another document disagrees on JARVIS implementation, this plan wins and the disagreement is recorded in Part 21.

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

1.2. The website is the customer's primary JARVIS interface for task entry, account access, device pairing, permissions, progress, receipts, files, usage, settings, billing and support. A small native companion on Windows/macOS performs authorized computer operations, remains visible while active and can always be stopped.

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

2.6. **The free Gemini tier cannot serve paying customers** (VERIFIED, Google's Gemini API Additional Terms and pricing page, fetched 14 November 2026):
- Only paid services may be used when an app serves users in the European Economic Area, Switzerland or the United Kingdom.
- Free-tier content may be used to improve Google's products and may be read by human reviewers. Google says not to submit sensitive, confidential or personal information to the unpaid services.
- OCADE sends observations of the customer's own computer.
- Gemini 3.5 Flash-Lite costs $0.30 per million input tokens and $2.50 per million output tokens on the paid tier.
- Gemma 4 has no paid tier on the Gemini API at all.

2.7. **The production Supabase project cannot run JARVIS** (VERIFIED with the Supabase tools on 14 November). It contains only the `ocade-intelligence` function (version 14). The planner's server door, `ocade-intelligence-service`, and the benchmark function exist only on the staging project.

2.8. **No payment system exists** (VERIFIED).
- No payment provider, checkout or webhook endpoint exists (`src/components/settings/BillingSection.tsx` line 14 states that no checkout exists; `supabase/functions` contains only the intelligence functions).
- Paid plans can be granted only by an administrator (`src/lib/commercial/entitlement-resolver.ts`).

2.9. **The current usage allowances would lose money if a customer used them fully** (VERIFIED arithmetic on `src/lib/commercial/usage-policy.ts` lines 65 to 77 and `src/lib/payments/pricing.ts`; Part 18).

2.10. **Commercial readiness is 10 of 100.** 17 of 42 release-gate conditions pass (VERIFIED by recomputing `evidence/readiness/gates.json`). Installer and dependency readiness is 0 of 4 conditions.

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

3.2. **O2 and O14.** The only permitted planner models are Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) and Gemma 4 31B (`gemma-4-31b-it`), each used alone for a whole task. There is no Live planner, no hybrid and no failover between models.

3.3. **O3.** No paid infrastructure, purchases or unapproved spending. See conflict C1 in Part 21.

3.4. **O4.** One coding agent; no parallel coding sub-agents.

3.5. **O5.** Cloud-first qualification before any test on the owner's physical computer, which needs separate approval.

3.6. **O6.** Commercial activity only after engineering completion and real-device qualification.

3.7. **O7.** Keep all 266 requirements, all 84 concepts and every research concept traced.

3.8. **O8.** No hardcoded applications, customer journeys, selectors, files, coordinates, commands or answers.

3.9. **O9.** One task authority with explicit permissions, real STOP and real Take Over.

3.10. **O10.** Never fabricate tests, benchmarks or completed work.

3.11. **O11.** No `main` merge, deployment, payment activation, secret changes, credential exposure or weakened security without explicit owner approval.

3.12. **O12.** Free non-deploying GitHub Actions on this branch are approved. CI stays secrets-free and never contacts production, except protected-environment runs the owner approves one by one. No scheduled automations.

3.13. **O13 — coding first (owner update 15 November 2026).** Complete ALL mandatory JARVIS and computer-control coding, integration, compilation, security regressions and deep debloating. Every required GitHub Actions coding/build/check job must be green on the identical candidate commit before beginning the comprehensive cloud-computer benchmark campaign. Focused tests must run during coding. If later benchmarks uncover a defect, reopen the coding stage, fix it and restore the complete green gate before rerunning the task.

3.14. **O15 and O16, with updated test-repair autonomy.** Four seeded tasks × two independently selected permitted models × Windows/macOS = 16 mandatory comparisons. Begin only after 100% coding/build gates are green and the protected cloud test environment is legitimately authorized. Once an authorized test scope, credentials, cost ceiling and environment are approved, routine NON-DESTRUCTIVE code fixes and reruns inside that scope require no new discretionary owner approval; platform-required protected-environment approvals, additional cost, deployment, physical-device access, elevated permissions, live payments and other sensitive operations still require the proper authorization. Never bypass required approval controls.

3.15. **New owner instructions recorded on 14 November 2026.** They are binding unless the owner withdraws them:
- No separate browser extension; zero budget for it.
- Docker only on developer, CI and hosted infrastructure, never required on customer computers.
- The website is the sole customer interface.
- The companion is visible, tray-controlled, session-based by default and always stoppable.
- Pairing without repeated email verification, while keeping secure authentication and revocation.
- Usage caps lifted for testing accounts, while provider limits, budgets and safety still apply.
- No tables in `plan.md`.

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
- It has a paid tier (VERIFIED pricing) and is OCADE's production Standard default (`src/lib/intelligence/online-models.ts` line 4).
- **No equal-conditions benchmark against Gemma has been run** (the 16 runs are pending), so its task success, latency and tool-calling reliability are UNKNOWN for OCADE's workload.

7.3. **Recommendation** (evidence-based, subject to the 16-run measurement):
- Choose **Gemini 3.5 Flash-Lite as the single customer model**.
- Reasons:
  - Gemma's measured failure rate and latency are far from the targets.
  - Gemma cannot legally process paying or European customers' computer data, because it has no paid tier and the free-tier terms apply.
- Gemma stays a permitted evaluation model under O2.
- If the 16 runs show Flash-Lite failing where Gemma succeeds, the decision is reopened with that evidence.

In plain terms: the measurements so far show Gemma is slow and unreliable on the free service, and Google's rules do not allow the free service for paying or European customers. So the plan uses Flash-Lite for customers, but measures both fairly before final confirmation.

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
| 9 | Specialised agents | CONFLICT C3 | Recommended meaning: specialised deterministic roles under the one controller (verifier, job runner, dependency manager); no extra model agents |
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

8.5. **Global commercial operations, requirements 35 to 43.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 35 | Worldwide payments | NOT CODED | Provider is an owner decision (Part 18) |
| 36 | Currency | Prices exist in USD, EUR, GBP and INR (VERIFIED) | — |
| 37 | Subscriptions | Admin grants only | Connect payment events to entitlements |
| 38 | Secure webhooks | An audit table exists (VERIFIED) | Signature-checked, idempotent endpoint |
| 39 | Taxes | NOT CODED | Merchant-of-record provider, or GST and export invoices with professional advice |
| 40 | Refunds | Policy text exists (VERIFIED) | Refund events revoke access |
| 41 | Cost controls | Counts tasks, not cost (VERIFIED) | Cost-metered credits, daily ceiling, global budget switch |
| 42 | International profitability | Losses at full use (Part 18) | Caps |
| 43 | Market restrictions | EEA and UK forbid the free model tier (VERIFIED) | Paid tier for all customer traffic |

8.6. **Security and operations, requirements 44 to 51.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 44 | Security testing | PARTIAL | Server-side request forgery decoding, cross-account and injection tests |
| 45 | Credential isolation | PASSES (LEDGER) | Secret canary in CI |
| 46 | Backups | PARTIAL | Paid Supabase plan for backups, restore drill |
| 47 | Monitoring | PARTIAL | Alerts on errors, quota refusals and spending |
| 48 | Legal compliance | PARTIAL | Update for the paid model, payment provider, DPDP Act and GDPR; professional review |
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

8.9. **Owner requirement IDs 74–87 excluded from the active JARVIS scope.** These IDs are retained only as historical cross-references in the archived plan. No implementation, campaign, or acceptance criterion is assigned to them here.

8.10. **Customer data and legal experience, requirements 88 to 92.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 88 | Delete JARVIS local task data | PARTIAL | Clear JARVIS session records, temporary files, customer-approved companion workspace data and scoped device caches without removing unrelated customer data |
| 89 | Delete account | CODED (VERIFIED `erase.server.ts`) | Database test that no rows remain; devices revoked; billing cancelled |
| 90 | Complete customer lifecycle | — | End-to-end journey test |
| 91 | Legal dialogs inside the website | Pages exist (VERIFIED routes for terms, privacy and help) | In-site dialogs and versioned consent |
| 92 | Minimal authentication friction | — | Part 5.5 |

8.11. **Testing and reliability, requirements 93 to 101.**

| # | Requirement | Status | Remaining work |
|---|---|---|---|
| 93 | Outside this JARVIS/PC-control scope | EXCLUDED | See historical archive; not a release dependency |
| 94 | All 236 research concepts evaluated | PASSES (LEDGER) | — |
| 95 | Windows/macOS PC-control qualification | QUALIFICATION | Hosted and actual desktop evidence required |
| 96 | Production evidence | QUALIFICATION | — |
| 97 | Outside this JARVIS/PC-control scope | EXCLUDED | See historical archive; not a release dependency |
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

9.1. **Strict coding-then-qualification order.** One coding agent completes P0 (Part 10), P1 (Part 11), P2 (Part 12) and P3 (Part 13), then P4 consolidation, deep debloating and COMPLETE GitHub compilation/coding-gate validation (Part 14). Only after all mandatory coding requirements are CODED and all required code/build/CI checks are GREEN on one fixed candidate commit may P5 cloud-computer benchmarks (Part 17 and Appendix H) begin. Test failures reopen coding and require the same green gates again. Do not start benchmark campaigns merely because one package's isolated tests passed.

9.2. During coding, run focused tests, compile/typecheck/lint/format, protocol/security regressions, appropriate database tests and affected build checks after each change. Never postpone STOP, approval or wrong-target safety tests. **After EVERY commit, inspect its GitHub Actions checks and fix failing required gates at root cause; rerun until green. While runs are queued/in progress, work on the next independent coding batch without blocking, duplicating or conflicting with those checks. Never declare a running job green.** Require complete JARVIS and whole-site compilation/build CI to be green on the FINAL identical branch-head commit before any real-task/cloud benchmark. Owner approvals for sensitive operations remain binding.

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
- Have a fresh test account complete the whole journey without help: landing page, pricing, registration, email verification, onboarding, download, install, pairing, permissions, first task, verified deliverable and continued use.
- Acceptance: zero dead controls, no serious accessibility findings, and a measured first verified task within five minutes of download.

## Part 12. Package P2: JARVIS website, account, device and data lifecycle (coding stage)

12.1. **Website-only JARVIS interaction.** Keep the customer's task entry, device list, exact consent/approval dialogs, execution timeline, STOP, Take Over, receipts and editable outputs inside the website. Reuse the existing components. Verify each JARVIS control and user state with automated interaction tests.

12.2. **Task and session lifecycle.** A fresh registered user can install the companion, pair without repeated email verification, authorize an exact task, start it from the website, inspect actual execution progress, stop it, resume through a safe revalidation, receive independently verified files, end the session and have the temporary companion exit. The workflow must recover appropriately from browser refresh, sleep and device reconnection.

12.3. **Customer data deletion.** A scoped delete-data request removes only JARVIS-owned local task artifacts and applicable server records after explicit confirmation. Account deletion revokes devices and closes authorized sessions; any retention legally required for commercial records is separately disclosed and handled. A test proves the absence of data that should have been deleted, and never destroys unrelated user files.

12.4. **Legal, help and support experience.** Present readable and versioned terms, privacy, computer-control permissions and support information in accessible in-site dialogs; preserve a record of the accepted version. This is customer-facing implementation, not a substitute for professional legal review.

12.5. **Customer acceptance.** A fresh account on a clean, supported Windows or macOS machine completes a first authorized task end to end without developer assistance, with no dead controls, misleading status or unverified completion. Complete coding and focused tests now; final hosted/real-device qualification belongs to P5.

## Part 13. Package P3: commerce, operations and competitive capabilities

13.1. **Verified-route replay.** A verified earlier task's step list, with its values as parameters, may be replayed as one guarded batch without model calls, falling back to normal planning at the first failed guard. Owner decision on O8 wording: the routes are learned from the customer's own verified runs, never hardcoded.

13.2. **Background accessibility actions.** UI Automation and macOS accessibility pattern actions on a leased background window while the person types elsewhere. This is an owner decision, because it changes the quiet rule of plan v7 section 13.

13.3. **"Teach a task" recorder.** The person demonstrates once; clicks are resolved to accessibility elements and passwords are redacted. Post-launch.

13.4. **Parallel independent milestones.** Milestones that touch disjoint windows, files or pages run in parallel under the same authority and locks.

13.5. **Payments** (Part 18):
- checkout;
- a signature-checked, idempotent webhook using the existing `payment_webhook_audit` table;
- entitlements written from payment events;
- renewals and failed-payment recovery;
- cancellation at the end of the period;
- refunds that revoke access;
- invoices and receipts;
- transaction history;
- an administrator reconciliation report.

Everything runs in the provider's test mode until the owner approves live payments.

13.6. **Operations:**
- backups on a paid Supabase plan, with a timed restore drill;
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

13.8. **Legal:**
- Update the Terms, Privacy and Refund text in `src/components/legal/LegalContent.tsx` for the paid model tier, the payment provider, retention, deletion, India's Digital Personal Data Protection Act and the GDPR, and show them as dialogs inside the site with versioned consent.
- A qualified professional must review them; code cannot satisfy this.

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

17.4. For EVERY failure, retain the failure evidence; investigate the root cause; implement a general, non-hardcoded correction; rerun coding gates until all green; then rerun the failed task and affected category on the same defined oracle. Never reclassify a retry as first-attempt success. Record commit, environment, actual task duration, model latency, tool usage, corrections and independent verification. Repeat within previously approved safe test permissions and resource limits until required acceptance is achieved or a precise blocker remains.

## Part 18. Commercial model and profitability

18.1. **Verified unit costs.** Gemini 3.5 Flash-Lite on the paid tier costs $0.30 per million input tokens and $2.50 per million output tokens; thinking tokens count as output.

18.2. **Estimated cost per turn and per task.**
- Assumption: about 1,000 output tokens per turn.
- Today, a turn costs about $0.0070, and a task with six turns about $0.042.
- After Package P0, a turn costs about $0.0037, and a task with four turns about $0.015.

18.3. **The current allowances lose money at full use** (VERIFIED arithmetic on `usage-policy.ts`). One charge is counted per task.
- Pro at $28 a month allows about 3,000 tasks a month, costing about $45 after Package P0.
- Max at $88 a month allows about 30,000, costing about $450.
- Free allows up to about 100 tasks a day.

18.4. **Proposed rules** (owner decides the numbers):
- Worst-case model cost may not exceed 35 percent of the net price.
- That suggests about 600 tasks a month on Pro, about 1,900 on Max, and a Free trial of 10 tasks a month.
- Weekly billing plans should be dropped, because the per-charge payment fee matters more on small charges.

18.5. **Unavoidable fixed costs** to disclose before taking money:
- a paid Supabase plan at about $25 a month, for backups and to avoid pausing;
- paid Gemini usage;
- a domain at about $1 a month.

Cloudflare Workers and a transactional email free tier can stay free. At the assumed average use, about two Pro subscribers cover the fixed costs (HYPOTHESIS).

18.6. **Payment provider** (owner decision).
- First choice: a merchant-of-record provider such as Paddle, because it handles worldwide sales tax, invoices and refunds for a solo India-based founder. Indian-seller eligibility must be confirmed by applying.
- Fallback: Razorpay subscriptions with international cards and settlement in rupees, where OCADE issues GST and export invoices itself under a letter of undertaking, with a chartered accountant's advice.

## Part 19. Owner approvals and decisions required

19.1. A paid Gemini key and a monthly budget cap for customer traffic. This resolves section 2.6 and conflict C1.

19.2. Confirm Flash-Lite as the single customer model, and Gemma as evaluation-only (conflict C2).

19.3. The meaning of "specialised agents" (conflict C3).

19.4. Session-mode idle exit time and the always-ready default (conflict C4).

19.5. The payment provider, the application to it, prices and caps.

19.6. A paid Supabase plan.

19.7. Deploy `ocade-intelligence-service` to production only after staging qualification (section 2.7).

19.8. Per-run approval for staging benchmarks (B1), the Windows and macOS runner environment (A1) and real-computer tests (A2).

19.9. Archiving the research tooling (item 14.3).

19.10. Background accessibility actions (item 13.2), and verified-route replay wording under O8 (item 13.1).

19.11. The original wording of owner requirements 72, 73, 86 and 87.

19.12. Live payments, production deployment and any `main` merge.

## Part 20. GO / NO-GO release conditions

20.1. **Today the answer is NO-GO.** Sections 2.2 to 2.12 explain why.

20.2. **A free, invite-only controlled beta** with at most 20 users and capped spending may start only when all of the following hold:
- ALL mandatory P0–P4 coding and integration work is complete, on a commit with fully green required coding/build CI; the relevant P5 safety and first-task qualifications have subsequently passed.
- A paid model key with a budget cap is configured.
- There are zero open critical or high defects.
- STOP, Take Over and unknown-effect tests pass on hosted Windows and macOS.
- The legal pages are updated.
- Support is live.
- A backup restore drill has been completed.

20.3. **A paid public launch** may start only when all of the following hold:
- Every beta condition holds.
- Packages P3 and P4 are complete.
- Payments work end to end in test mode, and the owner has approved live mode.
- Release gates R1 to R10 of Appendix A pass. This includes E4 at 90 percent or more over at least 100 tasks and three days, and real-computer qualification on all three systems.
- Measured beta economics stay within the caps of Part 18.
- Signing warnings are disclosed.
- `npm run readiness` reports every milestone as passing.

20.4. Every continuation report shows **Public commercial production readiness: X/100%**, computed from the repository's independently evidenced `npm run readiness` milestone results (historical baseline 10/100, not a fresh measurement). Separately report coding completion and benchmark success counts; never substitute a guess or equate green compilation with production readiness. A claim of 100/100 requires every mandatory gate passed on the release commit, including benchmarks and real-device qualification. See Part 25.

## Part 21. Conflicts and unresolved decisions

21.1. **C1.** Owner decision O3 (no paid infrastructure) conflicts with Google's terms for serving customers (section 2.6) and with the need for backups. Resolution requires approval 19.1 and 19.6.

21.2. **C2.** O2 permits Gemma 4 31B, but Gemma has no paid tier and its free tier may not serve these customers. Recommendation: evaluation only.

21.3. **C3.** Owner requirement 9 ("specialised agents") conflicts with plan v7 section 9 (no agent swarms) and with O2 (one model per task). Recommendation: deterministic specialised roles under the one controller.

21.4. **C4.** Requirement 62's exit-after-task behaviour conflicts with instant pickup. Resolved by session mode staying alive while tasks or jobs run, plus an optional always-ready mode.

21.5. **C5 — resolved for this revision.** Preserve the legacy requirement/concept table formats in Appendices A–E because `scripts/jarvis-traceability.mjs` and `scripts/launch-readiness.mjs` depend on them. The explanatory plan remains pointwise, but traceability data retain their machine-readable row shape. Run both readers in CI; change scripts only if a future separately authorized migration is necessary.

21.6. **C6.** `CLAUDE.md` and the research tooling still refer to the removed submodules (VERIFIED by search). Resolution: item 14.3.

21.7. **C7.** The architecture review of 8 November proposed a mixed-model repair path. Owner decision O15 forbids it. O15 wins.

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
- Parts of `usage-policy.ts`, `pricing.ts`, `entitlement-resolver.ts` and `online-models.ts`.

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
180. `PARTIAL` · **W11** — Prepare necessary non-payment legal and governance documentation, licence notices, privacy disclosures, Terms of Service, and installation guidance.
181. `FAIL` · **W11** — Add release notes, troubleshooting documentation, support procedures, incident response, service status communication, and recovery instructions.
182. `UNTESTED` · **W11** — Verify the commercial redistribution rights of bundled runtimes, dependencies, libraries, models, assets, and external components.

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
| 180 | CODE | BUILDS | C9: Terms and Privacy pages (`/terms`, `/privacy`, `LegalContent.tsx`), third-party licence notices generated from the inventory (`THIRD_PARTY_NOTICES.md`, shipped inside the installer by `ocade-agent.spec`), installation and troubleshooting guidance in Help; legal review of the final text is an owner action |
| 181 | CODE | BUILDS | C9: `RELEASE_NOTES.md`; `docs/OPERATIONS.md` (support procedure, incident response with the console emergency pause, status communication, recovery for database, website, companion and tasks); JARVIS troubleshooting in Help (`help.tsx`); a public status page does not exist yet and is named as such |
| 182 | CODE | BUILDS | JARVIS scope exclusion (see archived v7) |
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
| C9 | Security, privacy, operations: headers/CSP/CSRF, export and deletion, rate limits, redaction, support and legal drafts, licence inventory (161–182, 212, 222) | web server, `supabase/*`, `docs/*` |
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

23.1. Finish 100% of the JARVIS-only, release-mandatory implementation: planner and Gemini/Gemma adapters; task authority; permission fences; complete approvals; STOP/Take Over; Windows/macOS native, browser, accessibility and last-resort vision control; worker/job orchestration; recovery; independent verification; companion installers, upgrades, removal; JARVIS website controls; task data lifecycle; cost protections; security; customer subscription integrations required by the approved commercial scope. Classify out-of-scope IDs explicitly instead of silently dropping them.

23.2. `CODED` means the implementation and callers exist; `BUILDS` means affected build, typecheck, lint, formatting, protocol, relevant unit/security tests and database checks are green; `QUALIFIED` means runtime proof, separately. Neither the presence of source code nor green CI alone implies release qualification.

23.3. Complete source changes in small reversible batches. After each batch run the affected tests, including STOP, approval correctness and wrong-target regressions. Do not defer critical safety tests. **Every commit creates a required CI-follow-up obligation:** correlate checks and logs with the exact commit, monitor them through completion, fix any failed mandatory check without weakening tests, and rerun checks on a new commit until green. While GitHub Actions jobs execute, make progress on other independent, nonconflicting code work; do not wait idle, lose track of red checks, or claim a pending job passed. Integrate and reconcile these streams before moving to benchmarks. Preserve useful tests.

23.4. When all coding items are classified, run the COMPLETE required GitHub compilation/coding validation on one candidate SHA: dependency installation, formatting, linting, TypeScript compilation/typechecking, build, protocol/contract checks, no-hardcoded scan, database/migration tests where the runner supports them, **the ENTIRE OCADE WEBSITE compile/build and non-JARVIS regression checks (without expanding this plan to unrelated Chat feature work)**, web/JARVIS UI tests, Windows and macOS companion tests, packaging, security and any mandatory source-dependent gate. Every required job must pass, with genuinely unsupported platform skips listed rather than disguised as green. Address stale research links and legacy model callers only when their removal does not damage working features.

23.5. **Hard gate:** Start NO cloud-computer real-task testing, E1–E4 or two-model performance benchmark until ALL mandatory JARVIS coding is finished, the whole OCADE website and companion compile/build, every required coding/security/website/companion CI job is COMPLETED GREEN on the SAME final commit SHA (not pending, skipped without justification, or green only on earlier commits), required test secrets/environment are explicitly authorized, and the release evaluation harness is ready. Any subsequent commit invalidates the candidate's previous green proof; reverify the new SHA. A benchmark failure reopens coding, and the entire relevant coding/build gate MUST be green again before reruns.

23.6. Record `Coding completeness: completed required IDs / eligible required IDs × 100%` independently from commercial release readiness. Do not manufacture a perfect coding figure merely by marking items out of scope; record the scope-change rationale.

## Part 24. Autonomous benchmark → general repair → coding-gate → retest loop (owner addition)

24.1. Once Part 23 is fully green, execute the single canonical benchmark configuration in Appendix H. Start with the two allowed standalone models on identical seeded objectives, resources and oracle checks: four tasks on Windows and macOS for each model (16 runs). Then execute all mandatory E1–E4, fault injection, professional deliverable, task-accuracy, performance, security and real-device qualifications in dependency order. Never mix the two planners within one task or hardcode application names, steps, selectors or test answers into production routing.

24.2. On ANY task failure, **do not stop for routine discretionary approval** inside an already-authorized, free, safe cloud-computer test scope. Capture the complete trace: failed action and permission scope, model request and response metadata (without secrets), screenshots/structural observations, logs, exact error, task state, whether effects are known or unknown, generated artifacts and independently checked oracle verdict.

24.3. Diagnose and make the smallest general fix to the existing JARVIS code, test harness or environment. Reject task-specific patches, planted benchmark answers, retries of unknown effects, weakened protections, truncated approvals, synthetic oracle passes and threshold changes. Preserve original failing results and distinguish reproducible product defects from quota, missing dependency, environment and flaky-test causes.

24.4. For each fix: run focused regression tests; rebuild the entire site and companion; rerun the entire required coding/build CI until GREEN on the same new commit; then rerun the failed task under the same conditions and rerun the affected category and appropriate hidden-answer tests. While CI runs, continue other independent safe coding improvements; fix and track all red commit checks and never benchmark a still-running or red candidate. Continue this evidence-backed code → green-CI → benchmark → general repair → green-CI → retest cycle within approved time, quota, spending and authorization bounds until every applicable mandatory launch gate passes and independently measured commercial production readiness reaches 100/100%, or a precise evidenced blocker prevents safe continuation. Do not fabricate 100% or treat repeated retests as new first-attempt successes.

24.5. Record for EVERY task and attempt: ID, objective, original seed, platform, model, tool route, source SHA, fixture hash, start/end timestamps, wall-clock time, time-to-first-safe-action, model latency and tokens, device execution time, API calls, CPU/RAM, monetary or free-tier quota use, user interventions, approval decisions, recoveries, postcondition results, artifacts, verifier/oracle outcome and any unresolved error. Report median, p95 and maximum durations and the first-attempt pass rate over a published denominator. Use monotonic clocks for durations and explicit wall-clock timestamps for audit logs.

24.6. Never bypass protected-environment approval, exceed quotas or budgets, expose keys, use a consumer PC without approval, change payments, deploy to production, alter a secret, or spend money under the guise of automatic repair. An authorized initial testing approval may cover repeated NON-DESTRUCTIVE fixes and cloud reruns inside the same already-approved scope. If additional protected approval is required by GitHub or the owner, record the exact blocker rather than silently bypassing it. Use bounded retries/backoff to avoid unending, expensive or destructive loops.

24.7. Require zero known critical/high safety defects, fully passing mandatory safety scenarios, independently verified outputs, the existing ≥90% E4 first-attempt target with ≥95% ambition, and all release gates. A failing real-world task remains a FAIL until it actually passes; do not report public readiness while critical coverage is missing.

## Part 25. Make Gemma 4 31B and JARVIS significantly faster and stronger (owner addition)

25.1. Treat speed as an end-to-end task result, not raw token-generation speed. Re-measure the baseline on identical tasks and compare Gemma 4 31B to Gemini 3.5 Flash-Lite independently, without claiming a winner until the measured 16-run comparison has completed. Provider-specific network, queue, quota and model latency must be separated from device action time.

25.2. Reduce the reported ~15,000 input-token planning turns to a typical ≤4,000, with ≤8,000 in justified complex cases. Offer operation families dynamically at goal creation; load complete schemas only for pertinent tools; replace repetitive history with verified structured state, changed observations, compact failure reasons and milestone checkpoints. Measure tool recall and decision parity on held-out tasks so aggressive compression cannot silently reduce accuracy.

25.3. Use forced structured calls only on providers and models that actually support them, with a durable per-model capability cache. Preserve complete JSON Schema and device/server argument validation. On unsupported parameters, learn the refusal once, use a safe supported request shape and retest; never keep repeatedly sending incompatible thinking or function settings.

25.4. Move planning outside device-request deadlines. Execute small, independently guarded deterministic action batches, locally verify expected postconditions after each step, and contact the model again only for new uncertain decisions, deviations, cross-app interpretation or creative reasoning. Heavy renders or exports run as durable jobs and are polled without wasting planner turns. Keep STOP and Take Over synchronous and authoritative throughout.

25.5. Choose the cheapest, fastest and most accurate available native application object model or file operation first, followed by system scripts, DOM, accessibility, and screenshots only as last fallback. Avoid a second controller, unnecessary model router, tool swarms, duplicate searches, unnecessary full-screen captures and repeated app introspection. Reuse verified routes with parameter and permission checks only when held-out correctness tests prove them safe.

25.6. Strengthen complex multi-hour work by externalizing task objectives, dependencies, budgets, approvals, intermediate deliverables, task journal, verified checkpoints, recovery state and resumption. Favor specialist deterministic workers and domain checks rather than hallucinated model memory or hardcoded application flows. Independently validate final 3D objects, spreadsheets, animations, browser state and other outputs with objective oracles where possible.

25.7. Measure at least 30 tasks per workload category for median/p95 planner latency, time-to-first-action, task completion time, token counts, quota refusals, recoverability, tool-call correctness and verified first-attempt success. Any claimed speedup must compare identical seeds and identical resource constraints and must report failures and statistical uncertainty. No guarantee that software changes can eliminate provider-side inference latency.

## Part 26. Measured commercial production readiness (0–100%) and honest progress (owner addition)

26.1. **Routine chat/status messages:** one single line with no more than two words (Caveman mode). **Final outputs, audits, milestone updates and substantive reports are exempt and may be detailed;** these must start with **Public commercial production readiness: X/100%** from the existing evidence-backed `npm run readiness` output and identify its commit/time. The historical recorded baseline was 10/100; if not rerun on this commit, label it historical. Separately show coding coverage, 266-ID JARVIS-scope statuses, 84-concept verification, passing release conditions, green/pending/failed GitHub checks and independent benchmark results. Never invent a score.

26.2. Updating a checklist, writing a plan, compiling source, or completing only simulations is not grounds to raise readiness percentage. Only independently verified gates on the tested commit may change the score. Preserve the established release-gate calculation; do not invent weights or merge code progress with production qualification.

26.3. Report progress at each verified 10% milestone and whenever useful. Say what changed, passed, failed, was excluded with reason, remains blocked, and what must happen next. Maintain distinct `NOT CODED`, `CODED`, `BUILDS`, `RUNTIME VERIFIED`, `PARTIAL`, `FAIL`, `BLOCKED`, and `UNTESTED` states.

26.4. **100/100% and GO** are allowed only after all required JARVIS coding and security checks are green; two-model and E1–E4 evaluations meet their mandatory criteria; Windows 10/11 and macOS receive authorized real-device qualification; customer setup, STOP/Take Over, task recovery, verified deliverables, support, legal and commercial checks pass; there are no unresolved critical/high defects; and all required owner approvals are obtained. Otherwise the answer is NO-GO with the exact unmet conditions.
