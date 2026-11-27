Routine chat: follow the one-line, maximum two-word rule in CLAUDE.md. During coding, keep intermediate reports in PROGRESS.md and honor final-report-only requests. Essential safety and required approvals take priority.
USE THE "UX LAWS AND PRINCIPLES" AT AN EXTREME AND USE THEM ALL EFFECTIVELY. Apply the 30 named laws plus the four additional principles throughout OCADE, with measurable usability, accessibility, honest progress, restrained motion and no needless complexity (Part 14B.4 and Appendix G.1).

# OCADE BY CARCC — Complete Product, JARVIS & Windows/macOS PC Control Master Plan (v10)

LATEST OWNER UPDATE, 16 NOVEMBER 2026 — READ PARTS 14F, 27 AND 28: The owner additionally requires genuinely concurrent local subagents with distinct, truthful colored virtual cursor identities; fast native app work without taking over the user's mouse; a compact application-attached floating agent bar with role dropdown, live work/progress, STOP, Pin and an ALWAYS-AVAILABLE instruction composer OUTSIDE the dropdown; foreground-safe background operation using the user's own installed licensed applications and compatible add-ons; and a unified OCADE Live Vision Engine combining native app state, OS accessibility, continuous app-scoped video, event/difference detection, multimodal temporal understanding, targeted screenshots, UI parsing and verified workflow replay. These are owner-approved PLAN REQUIREMENTS, not completed software, measured video speeds or proof of universal simultaneous GUI input. Part 14F governs parallel local execution, floating composer and live vision; Part 27 governs the revised 12 features and eight products; Part 28 governs the recovered original 12 transformative features and named technical/product concepts. All are additive, with shared security and verification gates.

PRIOR OWNER SCOPE, 15 NOVEMBER 2026: Complete the whole OCADE product before real-task benchmarking: (1) JARVIS/PC control, (2) Online Chat/model integrations, (3) Offline Chat/download/offline website, plus settings, customer accounts, safety, all site UI/UX, Help/FAQ/terms/privacy and production workflows. Integrate six repository sources: the original five-source 72-entry ledger in Part 14A, six-source active collaboration requirements in Part 14D, existing elite improvements in Part 14C, and the 34 UX principles in Part 14B. The prior JARVIS-only and two-model-only implementation scope is superseded, but the two-model 16-run historical test remains the initial model comparison. The earlier plan and legacy traceability appendices are preserved for historical reference; this is DOCUMENTATION only, not evidence that coding or benchmark tests passed.

## Part 0. How to read this plan

0.1. This file is the single active authority for the COMPLETE OCADE product's engineering and production-readiness gates. JARVIS is the first coding priority; Online Chat and Offline Chat are subsequent required stages. Earlier JARVIS-only exclusions are overridden by Parts 14A and 14B. Retired documents are recoverable at the pre-cleanup Git commit `5b88b0c5c830ad719dd4cabd8635db53a7a18586`; all 266 requirement IDs and the 84 architecture concepts remain in this plan. Where another document disagrees on JARVIS implementation, this plan wins and the disagreement is recorded in Part 21.

0.1A. [PROGRESS.md](PROGRESS.md) is the sole live progress ledger. At session start read only its relevant task IDs and recent batch evidence; record all implementation status, test/CI evidence, defects, blockers, milestones and final report there. Keep this plan's requirement text, IDs and stages stable. Appendix A/B historical requirement and architecture traceability tables retain their evidence/status fields for compatibility; their presence is not live coding progress. Follow independent evidence requirements and update traceability where required. Never restore a second task ledger.

0.2. Every statement of status carries one of four evidence labels:
- VERIFIED means someone read the code, ran the command or fetched the primary source, and the location is cited.
- LEDGER means an earlier session recorded it with evidence, and it has not been re-checked since.
- HYPOTHESIS means it is consistent with the evidence but not yet proven.
- UNKNOWN means nobody has checked it yet.

0.3. Plain-language explanations appear after the words "In plain terms". They are written for a non-technical reader and never replace the engineering requirement next to them.

0.4. No section of this plan claims that OCADE is ready for public commercial launch. Part 20 defines exactly when that claim may be made.

0.5. Documentation and evidence boundary: The illustrated examples of fast colored subagent pointers and a compact floating status bar are design direction, not independently measured OCADE performance. Do not hardcode the illustrative 38-agent/11.6-second claim, and do not represent unverified media as frame-by-frame inspected. Distinguish REQUIRED / DOCUMENTED from IMPLEMENTED / TESTED. The detailed product requirements are self-contained in Parts 14F, 27 and 28.

0.6. Navigation rule (physical order controls). Numbered Parts and Appendix IDs are preserved historical cross-references, not permission to execute them in numerical order. Read this document's seven execution stages in their physical order: CODING → SECURITY THREAT REGISTER → DEBLOAT → ZERO-ERROR GREEN GATE → PRE-CLOUD BENCHMARK → APPROVED CLOUD-COMPUTER/WHOLE-SITE QUALIFICATION → FINAL REPORT. Later-only evaluations or historical benchmark results referenced inside coding requirements do NOT authorize early tests. No documentation-only item may be claimed implemented.

0.7. All Part and subsection headings: authoritative phase map. Keep original numbered references stable even where physical order differs. This is a routing/index aid, NOT a completion checklist. The headings are organized by execution stage:

- Prerequisites (before Stage 1): Parts 0, 1, 3–9 — authority, scope, architecture, requirements, engineering rules and execution policy.
- Stage 1 — coding: Parts 10–13; 14A.1–14A.6 source integrations; 14B.1–14B.8 full website/Chat/Settings/UX/security (14B.9 points to Stage 3); 14C.1–14C.8 architecture; 14D.1–14D.5 six-source collaboration; 14E.1–14E.10 privacy, Chat, Settings and files; 14F.1–14F.17 multi-agent/vision; Parts 15, 18, 19, 21, 25; 27.0–27.7 revised features/products; 28.0–28.6 transformative features and map; Appendices A, B, C, F (historical §4–§11), G, G.1. Historical technical contract text is retained, not proof of coding.
- Stage 2 — threat remediation: security register `docs/OCADE_SECURITY_THREAT_MODEL_AND_NEGATIVE_TEST_REGISTER.md`; full preserved requirement 23.4A in Stage 2.1. Pre-benchmark safe negative regression tests, no cloud-PC benchmarks.
- Stage 3 — debloat: Part 14 and original subsection 14B.9 (full text in Stage 3.1); preserve security, STOP, existing callers and evidence.
- Stage 4 — whole-product zero-error CI: Part 23, including 23.5 hard benchmark prohibition and same-SHA evidence checks.
- Stage 5 — pre-cloud model benchmarks: Part 16 is a future competitor test specification; Appendix H's preserved historical §19.1–§19.4 real desktop tasks are reference-only here, with no hosted computer execution.
- Stage 6 — hosted 16-run baseline, then approved whole-site cloud/real-device qualification if baseline passes: Parts 17, 24 and execution of Appendix H cases. On failure, return through coding, threat regression, debloat, green CI and pre-cloud gates; never use hardcoded test answers.
- Stage 7 — evidence and final Claude/Codex report: dated Part 2, Part 22 and Appendices D/E in PROGRESS.md; Parts 20/26 and final-report criteria here. Preserve historical entries but do not call them current-SHA proof.

Heading numbering: A legacy numbered Part may appear physically in a later stage because its original ID is a stable cross-reference. Nested Appendix F §4–§11 and Appendix H §19 are historical subsections, not new top-level Parts or permission to benchmark early.

## Part 0A. Active 148-item execution checklist (owner prompt, 23 November 2026)

Source: owner prompt of 23 Nov 2026, starting commit `1cf164bd629015df4bb27d64e90c057683e66862` on `ocade/p00-p22-implementation`. Item wording is copied exactly. Order is the owner's dependency order and matches the master checklist stage order (coding → UX → security → debloat → green CI → staging benchmarks → cloud qualification → launch). `M§n` = section n of [`docs/OCADE_MASTER_COMPLETION_CHECKLIST.md`](docs/OCADE_MASTER_COMPLETION_CHECKLIST.md); `S` = [`docs/OCADE_MASTER_SECURITY_CHECKLIST.md`](docs/OCADE_MASTER_SECURITY_CHECKLIST.md). Task wording and IDs are static. Track each ID only in PROGRESS.md, with independently verified evidence on a named SHA; status words: OPEN, IN PROGRESS, DONE (evidence), BLOCKED (exact blocker).

The dated mapping cross-check is recorded in PROGRESS.md.


### Implementation and verification

1. Verify latest GitHub HEAD, synchronize safely, preserve existing commits and inspect the entire repository. — map: M§0
2. Read every section, subsection and appendix of `plan.md`; identify every incomplete, partial, missing, broken or unverified requirement. — map: M§1
3. Audit all 120 owner requirements, preserving original wording and identifying missing source information. — map: M§2, M§16
4. Audit all 266 original requirements individually; complete every applicable missing coding requirement. — map: M§3
5. Audit all 84 architecture concepts; complete missing implementations and acceptance tests. — map: M§4
6. Audit all 72 repository-integration requirements; finish every applicable incomplete integration. — map: M§5
7. Reconcile all 236 research dispositions and 38 consolidated architecture proposals without duplicating unnecessary functionality. — map: M§6 (14C), M§16
8. Finish every remaining coding requirement throughout Parts 0–26, 14A–14F, 27 and 28. — map: M§1, M§6
9. Complete JARVIS planning, independent verification, durable task execution and autonomous recovery. — map: M§6 (P0–P3, 14A)
10. Complete Windows/macOS native computer control, application discovery, accessibility and browser automation. — map: M§6 (P0–P3, 14F)
11. Complete parallel AI agents, resource coordination, work distribution, safety and cancellation. — map: M§6 (14D, 14F)
12. Complete Live Vision, continuous capture, screen understanding, change detection and correct visual targeting. — map: M§6 (14F.8–14F.12)
13. Complete the floating agent composer, agent indicators, background work and foreground-safe controls. — map: M§6 (14F.4–14F.6)
14. Complete Online Chat, streaming, conversations, model selection, files, history and recovery. — map: M§6 (14B, 14E)
15. Complete Offline Chat, local model integration and offline website functionality. — map: M§6 (14B.2)
16. Complete universal model-provider adapters, secure routing, capability discovery and failure handling. — map: M§6 (14A, 14D.4–14D.4A)
17. Complete Supabase owner-managed credentials, customer BYOK, independent budgets, quotas and usage tracking. — map: M§6 (14B.1A–14B.1B)
18. Complete authentication, accounts, permissions, settings, privacy, Library, devices, notifications and customer data management. — map: M§6 (14B, 14E)
19. Complete R12-01: Live/Background Mode. — map: M§7 R12-01
20. Complete R12-02: Smart Approvals. — map: M§7 R12-02
21. Complete R12-03: Intelligent Privacy. — map: M§7 R12-03
22. Complete R12-04: Seamless Tool Access. — map: M§7 R12-04
23. Complete R12-05: Animated Permission Guide. — map: M§7 R12-05
24. Complete R12-06: Live App Generator. — map: M§7 R12-06
25. Complete R12-07: Automatic Context Discovery. — map: M§7 R12-07
26. Complete R12-08: Passive Ghost Preview. — map: M§7 R12-08
27. Complete R12-09: Time-Travel Timeline. — map: M§7 R12-09
28. Complete R12-10: Private Habit Intelligence. — map: M§7 R12-10
29. Complete R12-11: Simplification Mode. — map: M§7 R12-11
30. Complete R12-12: Cross-Device Handoff. — map: M§7 R12-12
31. Complete Business Money Assistant: Invoice Recovery and Cashflow Guardian. — map: M§7 packages
32. Complete Universal Forms & Claims Assistant: Deadline Guardian, Refund Assistant and Job Application Assistant. — map: M§7 packages
33. Complete Personal & Family Assistant: Micro-Business Ledger and Family Administration. — map: M§7 packages
34. Complete Business Launch Assistant: Client Onboarding Autopilot. — map: M§7 packages
35. Complete T12-01: OCADE LifeOS, including authorized automatic discovery and organization. — map: M§8 T12-01
36. Complete T12-02: Outcome Autopilot, including quiet hours, goals, schedules, budgets and recovery. — map: M§8 T12-02
37. Complete T12-03: Problem Radar, including authorized monitoring, deduplication, alerts and solutions. — map: M§8 T12-03
38. Complete T12-04: Business-in-a-Box, including business records, permissions and integrations. — map: M§8 T12-04
39. Complete T12-05: Opportunity Engine, including opportunity discovery, matching and application tracking. — map: M§8 T12-05
40. Complete T12-06: Work Simulation, including safe rehearsal and verified before/after effects. — map: M§8 T12-06
41. Complete T12-07: Proof Passport, including reliable, privacy-safe evidence of completed work. — map: M§8 T12-07
42. Complete T12-08: Recovery Intelligence, including checkpoints, reconciliation and reliable resumption. — map: M§8 T12-08
43. Complete T12-09: Personal Knowledge Vault, including secure storage, search, portability and deletion. — map: M§8 T12-09
44. Complete T12-10: Human Expert Escalation, including explicit approval and safe handoff. — map: M§8 T12-10
45. Complete T12-11: Verified Skill Network, including reusable private skills and authorized sharing. — map: M§8 T12-11
46. Complete T12-12: Time Reclaimed Dashboard, using measured and verified work results. — map: M§8 T12-12
47. Complete all applicable SkillForge, CheckPoint and LegacyBridge requirements. — map: M§8 SkillForge/CheckPoint/LegacyBridge
48. Complete Ghost Cursor, Instant Mini-Apps and Anti-Scam Guardian. — map: M§8 Ghost Cursor/Mini-Apps/Anti-Scam
49. Complete UI Repair Network, smart screen understanding and dynamic resource selection. — map: M§8 UI Repair/Smart Screen
50. Complete independent approvals, native Background Control and remaining technical improvements. — map: M§8 Independent approvals
51. Audit Skill Marketplace and other optional features against explicit owner approval; do not launch unapproved services. — map: M§8 Skill Marketplace, M§16
52. Complete positive, negative, failure, cancellation and independent acceptance tests for every Part 27/28 capability. — map: M§7, M§8, plan 27.6/28.5
53. Re-read the complete `plan.md` and all linked inventories, find overlooked coding gaps and finish them before advancing. — map: M§0, M§16

### All 34 UX principles — apply throughout every relevant OCADE page, feature and device

54. UX-01 — Aesthetic-Usability Effect: premium visual consistency, clarity and accessibility. — map: M§9
55. UX-02 — Choice Overload: reduce unnecessary decisions and competing controls. — map: M§9
56. UX-03 — Chunking: organize complex information into understandable groups. — map: M§9
57. UX-04 — Cognitive Bias: truthful labels, neutral choices and no misleading defaults. — map: M§9
58. UX-05 — Cognitive Load: simplify every task, form and interaction. — map: M§9
59. UX-06 — Doherty Threshold: provide fast, perceptible feedback without pretending work has finished. — map: M§9
60. UX-07 — Fitts's Law: improve control sizes, placement and accessibility. — map: M§9
61. UX-08 — Flow: minimize interruptions during authorized work. — map: M§9
62. UX-09 — Goal-Gradient Effect: display accurate, evidence-based task progress. — map: M§9
63. UX-10 — Hick's Law: simplify navigation and choices. — map: M§9
64. UX-11 — Jakob's Law: use familiar, intuitive interface conventions. — map: M§9
65. UX-12 — Law of Common Region: visually group related controls. — map: M§9
66. UX-13 — Law of Proximity: place related information and actions together. — map: M§9
67. UX-14 — Law of Prägnanz: favor simple, immediately understandable layouts. — map: M§9
68. UX-15 — Law of Similarity: maintain consistent interface patterns. — map: M§9
69. UX-16 — Law of Uniform Connectedness: clearly connect related workflow steps. — map: M§9
70. UX-17 — Mental Model: match customer expectations for safe AI computer control. — map: M§9
71. UX-18 — Miller's Law: minimize memorization through grouping and search. — map: M§9
72. UX-19 — Occam's Razor: remove unnecessary interaction complexity. — map: M§9
73. UX-20 — Paradox of the Active User: support immediate use without mandatory tutorials. — map: M§9
74. UX-21 — Pareto Principle: prioritize high-impact usability problems. — map: M§9
75. UX-22 — Parkinson's Law: keep workflows bounded and efficient. — map: M§9
76. UX-23 — Peak-End Rule: improve verified deliverables and task-completion experiences. — map: M§9
77. UX-24 — Postel's Law: accept reasonable input variations while enforcing safe outputs. — map: M§9
78. UX-25 — Selective Attention: distinguish critical controls from ordinary information. — map: M§9
79. UX-26 — Serial Position Effect: prioritize essential beginning and ending actions. — map: M§9
80. UX-27 — Tesler's Law: handle necessary complexity internally where safe. — map: M§9
81. UX-28 — Von Restorff Effect: make important warnings and STOP controls distinctive. — map: M§9
82. UX-29 — Working Memory: preserve context, drafts and user selections. — map: M§9
83. UX-30 — Zeigarnik Effect: clearly distinguish and recover unfinished work. — map: M§9
84. UX-31 — Visual Hierarchy: establish predictable information and action priority. — map: M§9
85. UX-32 — Progressive Disclosure: reveal advanced controls when needed. — map: M§9
86. UX-33 — Recognition over Recall: show relevant resources, devices and recent actions. — map: M§9
87. UX-34 — Feedback Loops: provide accurate progress, success, error and recovery feedback. — map: M§9
88. Verify all applicable UX principles across every route, signed-in/out state, desktop, mobile, tablet, keyboard and screen reader; record actual evidence and justified exceptions. — map: M§9, M§10
89. Remove duplicate UI components and unnecessary interactions; optimize consistency, responsiveness, accessibility and customer task completion. — map: M§9, M§12

### Security, optimization and final engineering verification

90. Read and independently review both complete security ledgers. — map: M§11, S (security checklist)
91. Recheck all 16 code-observed security findings and their remaining gaps. — map: M§11, S, docs/OCADE_THREAT_TRIAGE.md
92. Re-audit all 192 security risk hypotheses individually, including previously FIXED entries. — map: M§11, S
93. Implement and independently execute all applicable security tests from the 1,152 proposed negative scenarios. — map: M§11, S
94. Resolve all applicable OPEN/PARTIAL security findings, including malware intake, external MCP isolation, account separation and unauthorized effects. — map: M§11, M§16, S
95. Verify all 16 API-key security requirements and complete tenant, privacy, quota, provider and admin safeguards. — map: M§6 (14B.5–14B.6), M§11
96. Fix every remaining reproducible security vulnerability and release-blocking defect without weakening protections. — map: M§11
97. Review the entire repository for unnecessary, duplicated, obsolete and unreachable code. — map: M§12
98. Remove only proven useless code, dependencies and files while preserving working features, security, user data and historical evidence. — map: M§12
99. Measure and optimize website loading, task responsiveness, memory, CPU, GPU, network usage, model calls and cost. — map: M§12, plan Part 15
100. Optimize JARVIS for lower execution time, fewer unnecessary actions, high accuracy and verified output quality. — map: M§12, plan Part 25
101. Independently measure performance before and after every meaningful optimization; reject regressions. — map: M§12
102. Re-audit the entire codebase against `plan.md` after cleanup and resolve any missing or broken requirement. — map: M§0, M§12
103. Run complete typechecking, formatting, linting, builds, database migrations and rollback tests. — map: M§13
104. Run all mandatory GitHub Actions for the entire website, backend, security and Windows/macOS companions on the SAME final SHA. — map: M§13
105. Fix every failed mandatory job and investigate recurring Windows test hangs until the required checks pass with acceptable repeatability. — map: M§13, M§16
106. Independently inspect all CI evidence; do not count older commits, unapproved skips or successful retries as proof of a fixed underlying defect. — map: M§13, M§17
107. Obtain required staging authorization, reconcile outstanding migrations and validate staging configuration. — map: M§14, M§16
108. Verify authorized real AI providers, model capabilities, quotas, pricing, prompts and safety requirements. — map: M§14
109. Benchmark single-agent versus multi-agent performance on identical tasks, with independent verification. — map: M§14
110. Measure first-attempt accuracy, execution speed, p50/p95 latency, model calls, tokens, costs, recoveries and resource usage. — map: M§14
111. Improve speed and accuracy through genuine general-purpose fixes, without hardcoding tasks, lowering success thresholds or weakening safety. — map: M§14, M§0
112. Rerun mandatory coding/security checks after fixes and continue approved benchmark iterations until their acceptance criteria pass or a documented blocker remains. — map: M§14, M§0
113. Complete the initial 16-run, two-model Windows/macOS real-application comparison using the specified independent outcomes. — map: M§15
114. Complete E1–E3 and E4, including at least 100 hidden tasks over at least three days and at least 90% independently verified first-attempt success. — map: M§15
115. Complete full Windows/macOS cloud-computer testing across real supported applications, AI agents, desktop control, files, permissions and recovery. — map: M§15
116. Test every website route and feature, including all Parts 27/28 products, accounts, settings, Chat, JARVIS, Library, BYOK, offline functions, support and policies. — map: M§10, M§15
117. Test realistic user journeys, network failures, interruptions, parallel work, revocation, STOP, Take Over and wrong-account access. — map: M§15
118. Test actual consumer Windows 10/11 and macOS computers only after obtaining the required explicit authorization. — map: M§15, M§0
119. Complete true offline testing, including model download, complete internet disconnection, website reopening, local inference and reconnection. — map: M§15
120. For every failure, preserve evidence, repair the general cause, repeat required security and CI gates, and retest the failed workflow. — map: M§0, M§15
121. Confirm zero known unresolved applicable mandatory failures or launch-blocking bugs within the independently tested scope. — map: M§17

### Customer readiness and public-launch checklist

122. Verify a new customer can register, authenticate and start using OCADE successfully. — map: M§10, M§17
123. Verify onboarding clearly explains OCADE, available features, limitations and required permissions. — map: M§10, M§6 (14B.8)
124. Verify customers can complete a useful first task without unnecessary setup or assistance. — map: M§6 (14E.7), M§17
125. Verify complete Chat and JARVIS customer journeys from instruction to real, independently verified deliverable. — map: M§6 (14E.7), M§17
126. Verify customers can connect, inspect, revoke and remove authorized apps, websites, devices and AI providers. — map: M§6 (14E.6), M§17
127. Verify installation, startup, pairing, update, repair and uninstallation of supported computer companions. — map: M§6 (P1), M§17
128. Verify every advertised feature actually works for customers under its stated supported conditions. — map: M§6 (14B.7), M§17
129. Verify mobile, tablet and desktop usability, accessibility, keyboard navigation and responsive design. — map: M§9, M§10
130. Verify customer files, conversations, personal memory, tasks and settings persist correctly and remain private. — map: M§6 (14E.1), M§11
131. Verify complete account deletion, data export, recovery, retention rules and cross-account isolation. — map: M§6 (P2), M§11
132. Verify customer pricing, subscriptions, limits, billing, BYOK costs and usage reporting are transparent and enforced; obtain authorization before payment activation. — map: M§6 (14B.1B), M§0
133. Verify quota exhaustion, offline operation, provider downtime and unavailable capabilities produce understandable recovery options. — map: M§6 (14B), M§15
134. Verify STOP, Take Over, cancellation and sensitive-action approval work reliably in real customer workflows. — map: M§6 (P0), M§15
135. Verify scheduled tasks, notifications, background operations and recurring automations obey customer permissions and budgets. — map: M§8 T12-02, M§6 (REPO-60/70)
136. Verify no unsupported, misleading or unverifiable product promises appear on the website. — map: M§6 (14B.7), M§17
137. Verify Help, FAQ, troubleshooting, contact/support, Terms, Privacy, licensing and required customer-facing legal notices. — map: M§6 (14B.8), M§16
138. Verify customer support, issue reporting, incident response, service monitoring, backup and disaster recovery procedures. — map: M§6 (14B.8), M§17
139. Verify production configuration, domain, TLS, secret management, database access, storage protection and release artifacts. — map: M§6 (14B.6), M§17
140. Verify supported platform requirements, installer signing, third-party licenses and applicable commercial/legal obligations. — map: M§16, M§17
141. Perform final independent security review, full customer-journey regression and cross-device acceptance. — map: M§0, M§17
142. Confirm all mandatory tests are green on the final SHA, with no unresolved applicable critical/high safety defects. — map: M§13, M§17
143. Verify actual customer-facing speed, reliability, performance, accessibility and recovery meet documented acceptance targets. — map: M§17, plan Part 15
144. Confirm every mandatory requirement in both master checklists has a verified disposition, with all genuine external blockers documented. — map: M§17
145. Produce a final independent evidence report with exact commits, test results, benchmark metrics, remaining limitations and accurate coding versus launch-readiness scores. — map: M§0, M§17
146. Obtain explicit owner approval for production deployment, public access, payment activation and any authorized `main` merge. — map: M§0, M§17
147. Complete approved production release checks, smoke tests, rollback readiness and customer access verification. — map: M§17
148. Mark OCADE CUSTOMER READY FOR PUBLIC LAUNCH only when every applicable mandatory launch condition has independently passed, no release-blocking issues remain, and explicit launch authorization has been granted. — map: M§17

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

## Part 3. Fixed owner decisions (unchanged wording kept in Appendix A; conflicts listed in Part 21)

3.1. O1. Windows 10, Windows 11 and macOS are mandatory. Linux is optional and never blocks release.

3.2. O2 and O14, superseded in adapter scope by latest owner instruction. Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) and Gemma 4 31B (`gemma-4-31b-it`) remain the two original benchmark baseline models, each used alone for the seeded 16-run comparison. Runtime code must become UNIVERSAL/provider-agnostic and able to register additional explicitly authorized models and multiple healthy server-side key slots. No untested model, secret, automatic cross-model failover or quota circumvention is authorized. See Parts 14A.4 and 14B.1.

3.3. O3. No paid infrastructure, purchases or unapproved spending. See conflict C1 in Part 21.

3.4. O4. One coding agent remains the default coding authority; separate from the new owner-mandated RUNTIME multi-agent planning/delegation design. Runtime agents MUST actually execute independent safe work concurrently, not merely reason or animate cursors. Keep one authoritative task/permission/STOP authority and resource-scoped mutation arbitration, not one serial worker for all independent work. A shared physical desktop has one normal system pointer and keyboard input stream; overlapping GUI input is serialized, while independent native application APIs, isolated application sessions, scripts, file work, rendering and browser contexts may execute in parallel. See Part 14D and owner override Part 14F.

3.5. O5. Cloud-first qualification before any test on the owner's physical computer, which needs separate approval.

3.6. O6. Public deployment only after engineering completion, real-device qualification and owner authorization.

3.7. O7. Keep all 266 requirements, all 84 concepts and every research concept traced.

3.8. O8. No hardcoded applications, customer journeys, selectors, files, coordinates, commands or answers.

3.9. O9. One task authority with explicit permissions, real STOP and real Take Over.

3.10. O10. Never fabricate tests, benchmarks or completed work.

3.11. O11. No `main` merge, deployment, secret changes, credential exposure or weakened security without explicit owner approval.

3.12. O12. Free non-deploying GitHub Actions on this branch are approved. CI stays secrets-free and never contacts production, except protected-environment runs the owner approves one by one. No scheduled automations.

3.13. O13 — coding first (owner update 15 November 2026). Complete ALL mandatory coding for the ENTIRE OCADE WEBSITE (JARVIS first, Online Chat second, Offline Chat third), server/backend, device companion, five-repository integration, multi-agent, universal model adapters, UI/UX, settings, security, Help and policy content, integration, compilation, security regressions and deep debloating. Every required GitHub Actions coding/build/check job must be green on the identical candidate commit before beginning the comprehensive cloud-computer benchmark campaign. Focused tests must run during coding. If later benchmarks uncover a defect, reopen the coding stage, fix it and restore the complete green gate before rerunning the task.

3.14. O15 and O16, with updated test-repair autonomy. Four seeded tasks × two independently selected permitted models × Windows/macOS = 16 mandatory comparisons. Begin only after 100% coding/build gates are green and the protected cloud test environment is legitimately authorized. Once an authorized test scope, credentials, cost ceiling and environment are approved, routine NON-DESTRUCTIVE code fixes and reruns inside that scope require no new discretionary owner approval; platform-required protected-environment approvals, additional cost, deployment, physical-device access, elevated permissions, live payments and other sensitive operations still require the proper authorization. Never bypass required approval controls.

3.15. Prior owner decisions recorded on 14 November 2026, as modified by Parts 14A–14B on 15 November 2026. All remain binding except where the newer complete-product scope and model/runtime-agent policies explicitly supersede them:
- No separate browser extension; zero budget for it.
- Docker only on developer, CI and hosted infrastructure, never required on customer computers.
- The website is the sole customer interface.
- The companion is visible, tray-controlled, session-based by default and always stoppable.
- Pairing without repeated email verification, while keeping secure authentication and revocation.
- Usage caps lifted for testing accounts, while provider limits, budgets and safety still apply.
- New explanatory plan sections should use points and sentences, not new tables; legacy machine-readable Appendix A–E tables remain required for existing parsers.

## Part 4. Engineering operating contract (carried over from plan v7 sections 4 to 11, wording kept)

4.1. The engineering formula is: objective, evidence, root cause, smallest complete change, proof, simplify, record, next. Each stage must be met before the next one starts. For example, no fix is written before the failure is reproduced or the missing behaviour is demonstrated.

4.2. The twenty universal engineering rules of plan v7 section 5 remain in force verbatim. They are carried over as a numbered list in Appendix F of the new file. Each rule keeps its purpose, when it applies, how to apply it, how to verify it and the common mistake to avoid.

4.3. The OCADE operating rules of plan v7 section 6 remain verbatim: mindset, architecture, code, testing, performance, security and progress.

4.4. The coding loop, failure and resumption rules, no-overengineering rules, architecture-change rules and owner-approval rules of plan v7 sections 7 to 11 remain verbatim.

## Part 5. Architecture (frozen spine kept; additions explained)

5.1. The spine stays as it is (VERIFIED by source reading).
- The customer's request goes to one task authority in Supabase. It owns permissions, the STOP epoch, the journal, timing and settlement.
- The server-side planner (RTAA, in `src/lib/jarvis/planner.server.ts` and `supervisor.ts`) asks the model for the next action or a short guarded list.
- The device's gateway and workers carry the actions out with exact targets (RTVC, in `device-agent/windows/ocade_agent/`).
- A separate verifier process checks the result from independent evidence (`verify_worker.py`).

In plain terms: one part decides what is allowed, one part suggests the next move, one part does it on the computer, and a separate part checks the work. None of them can overrule the others.

5.2. The safety invariants stay without exception:
- Every side effect is bound to the account, device, task, permission grant, exact target, confirmation, idempotency key, STOP epoch and deadline. It is re-checked on the server and on the device just before the effect.
- STOP works locally even when the network or the model is unavailable.
- An effect whose outcome is unknown is never repeated automatically.
- Originals are preserved, and later user edits are never overwritten.
- Content from files, websites and apps never grants authority.

5.3. Execution preference order (concept 25, kept and confirmed by the owner on 14 November):
1. object models and file formats;
2. operating-system interfaces and scripts;
3. browser DOM through Playwright;
4. accessibility trees (Windows UI Automation, macOS Accessibility);
5. screenshot-based vision, last, with exact target verification before every click.

16 November owner clarification: The list above ranks action/control mechanisms, not every observation source. OCADE MUST ALSO maintain continuous, permissioned, target-window video awareness and native application-state/event observation as appropriate; selective frame analysis, temporal vision, targeted screenshots and visual UI parsing augment native control. A live video feed is NOT equivalent to a separate desktop pointer, nor does continuous frame delivery require sending every frame to an LLM. The unified perception pipeline and screenshot fallback are specified in Part 14F, without changing the native-first action priority.

In plain terms: OCADE first tries the most reliable and fastest way to do something, such as editing a spreadsheet file directly. It only "looks at the screen and clicks" when nothing better works, and even then it double-checks that it is clicking the right window.

5.4. Website-first companion design (new; replaces nothing):
- (a) Session mode is the default. The website's "Start session" button opens the companion through an operating-system link scheme that the installer registers. The link only wakes the companion. All authority still comes from the device's signed request to the server, so a forged link cannot make the companion do anything.
- (b) While a session or task is active, a tray icon shows the state and offers STOP, Take Over and End session. On Windows it uses `Shell_NotifyIcon` through pywin32, which is already a dependency of `windows_worker.py`. On macOS it uses `NSStatusItem` through pyobjc, which is already used by `mac_worker.py`. So no new dependency is needed.
- (c) The companion exits safely when the task and any long jobs it started have ended and an idle period has passed. It reaps every worker and browser process it started.
- (d) Always-ready mode keeps the tray icon running for faster pickup. It needs explicit consent and can be switched off at any time.
- (e) Active computer control is never hidden.

In plain terms: the helper program appears only while it is working, shows a small icon with a stop button, and goes away afterwards unless the customer asks it to stay ready.

5.5. Pairing without repeated email (new):
- The installer opens the website in the browser, where the customer is already signed in.
- The website shows a short one-time code bound to that signed-in session.
- The companion sends its device public key together with the code to the existing enrolment door (`device-agent/windows/ocade_agent/device.py` line 142 and `src/routes/api/jarvis.device.ts`).
- The device is then registered under the account.
- Revoking it in the Devices page fences it immediately (concept 66).
- No new authentication system is added.


5.6. Post-commit local parallel execution and live vision (16 November 2026). Extend the existing companion with genuinely concurrent safe execution channels, app-attached per-agent colored activity, an outside-dropdown always-visible instruction composer, foreground-safe Background/Live handoff, and continuous target-window video plus native app-state/event perception. The detailed requirements and acceptance tests are in Part 14F; this is NOT a second task authority, a claim of multiple independent physical OS mice, or proof the code already exists.

5.7. Docker boundary (new, owner instruction):
- Docker and development containers may be used for development, CI builds, tests and hosted test infrastructure only.
- The customer companion is a frozen native bundle with its runtimes included (W9), and never requires Docker.
- The production website and backend (Cloudflare Workers and Supabase) never depend on the founder's computer.

5.8. Browser automation without an extension (owner decision of 14 November):
- OCADE keeps its own dedicated Playwright browser profile, which persists across tasks.
- The customer signs in to sites in that window once, and completes multi-factor and CAPTCHA steps personally.
- The earlier proposal of a browser extension for the customer's own signed-in browser is withdrawn.
- Copying the customer's real browser profile is rejected, because it would expose cookies and passwords and conflict with security rule G7 of plan v7.

## Part 6. The 84 architecture concepts: understanding and use

6.1. The 84 concepts are capabilities and properties of one system, not 84 separate steps to run on every task. The planner offers only the operations a task needs (requirement R-104 in Part 8). Most concepts are enforced by the spine without any per-task choice.

6.2. The full verbatim list of the 84 concepts, with status, destination, build instruction and mandatory proof, is carried over in Appendix B as a numbered list.

6.3. Decision for each concept.

6.3.1. Keep unchanged. These are verified as passing and sound: 3, 4, 5, 7, 9, 10, 13, 22, 24, 25, 26, 27, 30, 37, 38, 39, 40, 41, 42, 43, 44, 47, 52, 53, 54, 55, 56, 60, 61, 63, 64, 66, 69, 70, 73, 74, 77, 81 and 82.

6.3.2. Improve with code. These are partly built; the named work completes them:

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

6.3.3. Mechanism replaced, concept kept. Concepts 14, 15, 17 and 23 (tool routing and filtering): the lexical shortlist and the size-only schema deferral are replaced by operation families chosen at goal time (Part 10, item 10.3). The pre-registered reversal trigger in plan v7 section 27 already fired: held-out recall was 97.1 percent, below the 98 percent target.

6.3.4. Merged.
- Concept 16 (vectorised domain blueprints) merges into the existing experience precedent (C9, `precedent()` in `planner.server.ts` lines 917 to 922) and the later verified-route replay. It stays deterministic, with no vector database, as plan v7 section 14 requires.
- Concepts 19 and 49 become one guarded-batch mechanism with postconditions.

6.3.5. Proven only at qualification. Concepts 79 and 84, and the proof parts of 54 and 83.

## Part 7. Model selection: Gemma 4 31B versus Gemini 3.5 Flash-Lite

7.1. Measured facts about Gemma 4 31B (VERIFIED in the 8 November review from staging logs and run artifacts):
- planning turns of 10 to 140 seconds;
- a first byte often later than 25 seconds;
- 10 HTTP 500 "internal error" responses and one HTTP 503 "high demand";
- 6 to 8 broken streams;
- 51 refusals of the thinking-level setting (Gemma does not accept it);
- 37 quota refusals at 16,000 input tokens per minute;
- text-only answers without a function call;
- no paid tier on the Gemini API.

7.2. Facts about Gemini 3.5 Flash-Lite.
- It is the currently configured Standard default (`src/lib/intelligence/online-models.ts` line 4).
- No equal-conditions benchmark against Gemma has been run (the 16 runs are pending), so its task success, latency and tool-calling reliability are UNKNOWN for OCADE's workload.

7.3. Initial benchmark recommendation only (subject to measurement and future universal-provider capability tests):
- Start the original 16-run comparison with Gemini 3.5 Flash-Lite and Gemma 4 31B, then select the best independently qualified default; this does NOT hardcode OCADE around one provider or prevent separately qualified models.
- Reasons:
  - Gemma's measured failure rate and latency are far from the targets.
  - Gemma must not process customer computer data until its provider configuration and data-handling permissions have been verified for the intended users.
- Gemma stays a permitted evaluation model under O2.
- If the 16 runs show Flash-Lite failing where Gemma succeeds, the decision is reopened with that evidence.

In plain terms: Gemma's practical speed, reliability and suitability for customer data still need independent verification. Compare both models fairly.

7.4. How to make either model much faster and more capable on long tasks. These are the levers, all inside the existing architecture.
- 7.4.1. Cut every planning turn from about 15,000 to about 4,000 input tokens (Part 10, items 10.3 and 10.4). The model must read the whole prompt before it starts answering, so shorter prompts mean faster first replies and more turns within the per-minute quota.
- 7.4.2. Force a function call (Part 10, item 10.1), so no turn is wasted on prose.
- 7.4.3. Send complete action rules (Part 10, item 10.2), so fewer proposals are refused.
- 7.4.4. Let one model turn plan several safe steps, each with a postcondition the device checks itself (Part 10, item 10.9). The model is then asked again only when something unexpected happens.
- 7.4.5. Keep long work (renders, exports, installs) as device jobs that are polled without model calls. This already exists as `job.*`, with job following in `supervisor.ts`.
- 7.4.6. Keep the asynchronous planning queue that already exists (commit `58693894`: planning turns run after the device's answer, in a queue consumer). Make sure every turn finishes well inside the 150-second Edge Function limit, which becomes much easier once prompts are four times smaller.
- 7.4.7. Adaptive thinking. Record per model whether it accepts a thinking setting. Use the lowest setting that keeps accuracy, measured by an A/B test on deterministic local planner fixtures. Gemma already refuses the setting, so it should never be sent to Gemma again after the first refusal on a deployment. That requires the durable capability record, item 10.8.
- 7.4.8. Checkpoints. Milestones already persist progress (`milestoneProgress` in `supervisor.ts`). Multi-hour tasks are split into milestones of at most 30 steps each, and every milestone is verified before the next one starts.
- 7.4.9. Structured observations.
  - Inspections return only what changed after the first look.
  - Web pages return controls without long prose unless the text is requested.
  - Windows inspection uses one cached query instead of hundreds of small calls.
- 7.4.10. A faster Gemma variant, as a HYPOTHESIS and owner decision. The "High" mode already uses `gemma-4-26b-a4b-it` on Cloudflare Workers AI (`online-models.ts` line 5). It is a mixture-of-experts model that uses about 4 billion parameters per token, so it is likely much faster than the dense 31B model. Using it as a planner is not allowed under O2 today, and its free daily allocation and data terms must be checked first.

7.5. The three Gemini API keys.
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
| 3 | Tool calling | CODED (VERIFIED 23 Nov: a JARVIS turn is sent with `forced_call` — Gemini mode ANY, `tool_choice` any/required for Anthropic, OpenAI and Workers AI — in `src/lib/intelligence/edge-handler.ts`, `anthropic.ts`, `byok-handler.ts`, `workers-ai.ts`; tests `tests/security/model-route.test.ts`, `anthropic.test.ts`, `openai-responses.test.ts`) | Live provider qualification (Stage 5) |
| 4 | Complete schemas | CODED (VERIFIED 23 Nov: `operationSchema` sends each operation's full JSON Schema from its zod contract, `src/lib/jarvis/planner.server.ts`; `tests/jarvis/contracts.test.ts` "operation schemas are converted once and match a fresh conversion") | Live provider qualification (Stage 5) |
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
| 20 | Complete approvals | CODED (VERIFIED 23 Nov: an approval shows `exactEffect` — the exact operation and every argument, untrimmed — in a scrollable block, and the step summary wraps instead of truncating, `authority.server.ts`, `JarvisPanels.tsx`; `tests/jarvis/contracts.test.ts` exact-effect case) | Browser check at 320 px and screen reader (Stage 6 UX pass) |
| 21 | File protection | PASSES (LEDGER) | — |
| 22 | Installers | PARTIAL (VERIFIED 23 Nov: unsigned Inno Setup build with install, diagnose, repair, uninstall checks in `device-agent/windows/packaging/test_install.ps1` and update checks in `test_update.py`, run on hosted Windows runners; macOS bundle workflow) | Code signing needs a certificate (owner); consumer-PC install is Stage 6 |
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
| 33 | Accessibility | PARTIAL (VERIFIED 23 Nov: axe WCAG 2.2 A/AA, 200% reflow and keyboard focus on 10 signed-out pages in Chromium, 0 problems, `evidence/2026-11-23-accessibility/`; the hosted job also runs Firefox and WebKit) | Signed-in routes, assistive-technology user check |
| 34 | Localisation | UNKNOWN | English first; another language only after owner approval |

8.5. **Out-of-scope historical IDs 35–40 and 42; retained engineering obligations 41 and 43.**

The original exact text for out-of-scope IDs is preserved in [retired source: docs/archive/plan-v7-2026-11-14.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/archive/plan-v7-2026-11-14.md). Do not implement or count these deferred IDs as required JARVIS coding. Retain their identifiers so the 266-ID historical ledger remains traceable.

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
| 52 | Green CI | PARTIAL (23 Nov: the formatting failure on `1cf164b`/`853a9a9` came from two unformatted master checklists, fixed in `8556701`; `verify:full` 8/8 locally) | Same-SHA all-green hosted run on the final SHA (Stage 4) |
| 53 | Integration tests | Green locally except the database suite, which needs PostgreSQL | Run the database suite |
| 54 | 90 percent first-attempt success | FAILING | — |
| 55 | Two-model qualification | 0 of 16 | — |
| 56 | E1 to E4 | E1 at 56 percent | — |
| 57 | Real Windows and macOS testing | BLOCKED on approval A2 | — |
| 58 | Complete customer workflows | PARTIAL | — |
| 59 | Debloating | PARTIAL (Stage 3 report [retired source: docs/DEBLOAT_REPORT.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/DEBLOAT_REPORT.md), 21 Nov: research archive moved out, dead capture code removed, measured) | Re-run after security closure on the final SHA |
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
| 67 | Temporary system tray | CODED (VERIFIED 23 Nov: `device-agent/windows/ocade_agent/tray.py` Windows notification-area icon and macOS menu-bar control with local STOP and Open JARVIS; `tests/test_tray.py` on the Windows runner) | Consumer-PC check (Stage 6) |
| 68 | No unnecessary desktop icons | CODED (VERIFIED 23 Nov: `ocade-agent.iss` [Icons] creates Start-menu entries only, no desktop icon; Always-On is an unchecked task) | Consumer-PC check (Stage 6) |
| 69 | Safe process cleanup | PARTIAL | — |
| 70 | Trusted reconnection | PARTIAL | Test after sleep and network loss |
| 71 | No repeated email verification for pairing | CODED (VERIFIED 23 Nov: the companion opens `#pair=<code>` on the signed-in website; the person confirms with Pair, no email step, `JarvisPanels.tsx` pairing panel → `jarvis_approve_device`) | Consumer-PC pairing check (Stage 6) |
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

9.1. Binding physical execution order (legacy Part/Appendix IDs retained): Complete every mandatory product coding requirement first: JARVIS, website/Settings, online/offline Chat, native Windows/macOS control, BYOK, parallel agents, UX, Parts 14A–14F, 25, 27–28 and all relevant concept/requirement registries. Next read and remediate the entire committed OCADE security threat report and applicable newer audit additions; then safely debloat without weakening security; then require fully completed GREEN coding/security/website/backend/companion CI on one final SHA with zero known unresolved applicable safety defects and zero failing mandatory tests. Only then begin non-cloud model/planner benchmark qualification; after it passes, use approved cloud Windows/macOS computers for the initial hosted 16-run baseline and, if its gates pass, entire-site practical cloud/real-device testing. On any benchmark or cloud failure, return to general non-hardcoded coding repair, threat regression, debloat checks and full fresh-SHA GREEN CI before retesting. Final Claude/Codex progress/readiness reporting comes LAST, strictly separated from merely documented requirements. No launch, deployment, sensitive action or real customer device access is implied.

9.2. MANDATORY CONTINUOUS CODING: Implement → locally test → record in PROGRESS.md → commit → push → immediately start the next dependency-ready coding requirement → repeat. A push starts background CI; it is not a stop, report, approval or waiting point. A dispatched matrix, pending or running CI/build/test, earlier failed candidate, milestone, individual blocker or routine error is never a reason to end the turn while independent authorized work remains. Inspect available results without blocking and repair confirmed failures. Do not use scheduled reminders, polling loops, sleeps, offers to continue or a final chat response as a substitute for the next actionable tool call. Before ending a turn, exhaust independent authorized coding, focused tests, security/debloat and reconciliation; wait for final required CI only when no independent work remains. Verify all mandatory checks on the identical final SHA; never claim unverified completion. Explicit owner WAIT/STOP/PAUSE/HOLD, required approvals, safety, budget and genuine exhaustion of authorized work take precedence. During coding, run focused tests, compile/typecheck/lint/format, protocol/security regressions, appropriate database tests and affected build checks after each change. Never postpone STOP, approval or wrong-target safety tests. Commit and push each completed coherent requirement or small related group immediately after applicable local checks pass, within owner Git authorization. Record all progress, item counts, percentages, blockers and SHA-specific evidence exclusively in PROGRESS.md. Audit every remaining checklist section and communicate indispensable safety or permission requests minimally. After all authorized coding, security remediation, debloat and reconciliation, run and repair every required final gate until complete JARVIS and whole-site compilation/build CI is GREEN on the identical final branch-head SHA before any real-task/cloud benchmark. Never count pending, stale, cancelled or unverified checks as green. Owner scope, permissions and sensitive-action approvals remain binding.

9.3. Task inventory: The previous 43 numbered P0–P5 work-package items remain as historical baseline. New Parts 14A–14B add 72 architecture trace entries (overlaps expected), 34 UX heuristics, 16 key protections, 19 SaaS security checks and deduplicated customer/site work; these are new acceptance references and must be reconciled before calculating a unique executable task count. The 266 tracked requirements and 84 concepts remain separate; the original 16 model-comparison runs remain separate tests. Never claim `43` is the entire new work count or add overlapping counts as if they were unique features.


## EXECUTION STAGE 1 — CODE THE ENTIRE PRODUCT FIRST

All mandatory coding and functionality: JARVIS, website, Settings, online/offline Chat, BYOK, Windows/macOS, native-first computer control, privacy, source adapters, agents, permissions, UX, full customer journeys, Parts 14A–14F, 25, 27–28 and applicable mapped inventory. Run local coding/isolated security tests during implementation, but NO real-task/model comparison or cloud-computer benchmarks. Historical ledger states and newly mapped owner features are NOT current implementation proof.

## Part 10. Package P0: safety, task correctness and AI execution (estimated four to six days of coding)

10.0. Make the coding gate green and synchronise.
- Problem: the branch head fails formatting.
- Fix: preserve formatting checks for current tracked source-research files; the old README is retired.
- Fix: make CI install the Python `playwright` package where `tests/security/cloud-gates.test.ts` needs it.
- Acceptance: the full coding gate passes on the head commit.

In plain terms: fix the one broken automatic check so that every later change is tested from a clean starting point.

10.1. Force a function call.
- Root cause: section 2.4.
- Files: `src/lib/intelligence/edge-handler.ts` (function `providerBody`).
- Change: on the JARVIS surface, add `toolConfig.functionCallingConfig` with mode `ANY` and the list of offered function names. This is the documented Gemini setting, used the same way by the Vercel AI SDK in `packages/google/src/google-prepare-tools.ts` lines 289 to 309 (VERIFIED).
- Change: keep the existing correction turn only as a fallback for a model that refuses the setting.
- Tests: a unit test of the request body, then a staging probe with the owner's run approval. Acceptance: zero turns without a call in 20 probe turns per model.
- Risk: a model may reject the setting. The capability record (item 10.8) then switches back to automatic mode for that model only.

In plain terms: OCADE tells the AI it must always answer with a concrete action, so no question is wasted on a chatty reply.

10.2. Send complete action rules.
- Files: `planner.server.ts` (`providerSchema`) and `edge-handler.ts`.
- Change: send each operation's full JSON Schema in the `parametersJsonSchema` field. Only a constant value is converted into a one-value list.
- Change: keep the old simplified conversion only for a model that rejects the full schema with an HTTP 400 response.
- Tests: all 44 operation schemas survive the conversion; the probe accepts them.

10.3. Offer only the needed families of operations.
- Root cause: section 2.3.
- Files: `planner.server.ts` (`compileGoal`, `planStep` lines 1221 to 1235 and 1381 to 1388) and `supervisor.ts` (milestone plan schema).
- Change: the goal turn that already runs also returns the families of operations the task needs, chosen from the existing roles in `contracts.ts`.
- Change: step turns send full schemas only for those families and for operations the task has already used.
- Change: every other operation is still listed by name and one-line summary, and its schema is sent the moment the model asks for it. That mechanism already exists.
- Rejected alternative: a separate AI router. The goose project removed one because it cost an extra model call per request (VERIFIED, goose `documentation/static/files/thoughts/plans/2025-12-23-remove-tool-selection-strategy.raw`; the repository was cloned during research and is no longer stored locally).
- Acceptance: a committed measurement test shows that the offered-operation text for a typical task is at most 12,000 characters instead of 31,621.

In plain terms: instead of handing the AI the whole instruction manual on every question, OCADE hands it only the chapters the task needs, and the rest on request.

10.4. Smaller history.
- Files: `planner.server.ts` (function `history`), `device-agent/windows/ocade_agent/refs.py`, `windows_worker.py` and `mac_worker.py`.
- Change: lower the newest-observation budget from 16,000 to about 6,000 characters, and the total history budget from 24,000 to about 10,000.
- Change: after the first inspection of a window, `ui.inspect` returns only what changed unless the model asks for everything.
- Acceptance: a typical step turn is at most 4,000 input tokens and the worst case at most 8,000, measured by the committed script. The deterministic planner fixtures give the same decisions as before.

10.5. Cost metering and budget protection.
- Files: `planner.server.ts`, `edge-handler.ts` (usage is already read at lines 721 to 730), `src/lib/commercial/generation-gate.ts`, `supabase-ledger.ts`, and one migration.
- Change: charge usage in credits computed from the provider's measured token counts, instead of one unit per task.
- Change: add a daily cost ceiling per account.
- Change: add a global budget switch that queues new turns instead of spending past the owner's monthly budget.
- Acceptance: ledger totals match the provider's reported usage within one percent; the ceiling and the switch have tests.

In plain terms: OCADE keeps an exact running bill of what each task costs, so no customer and no bug can run up an unexpected expense.

10.6. Gemma request shape. The Vercel AI SDK moves the system instruction into the first user message for every Gemma model (VERIFIED, `google-model-catalog.ts` line 268 and `convert-to-google-messages.ts` lines 784 to 797). A probe decides whether OCADE must do the same. The result is recorded in the capability record.

10.7. Two-model benchmark harness.
- Files: `tests/jarvis/benchmark.py` and `.github/workflows/jarvis-staging-evaluation.yml`.
- Change: the harness takes the model identifier of one of the two allowed models and runs the sixteen-run matrix. The retired three-configuration matrix is deleted. This closes requirement 23's "not implemented" note.

10.8. Durable per-model capability record.
- Files: `edge-handler.ts`, which replaces the per-instance `withoutThinking` set, and one migration.
- Change: store, per model and per deployment, whether it accepts forced function calls, full schemas and thinking settings, and its measured token-per-minute limit. A value is learned once and lowered only on a provider refusal.
- This reverses the C12 deferral in plan v7 section 19.4, because forced calls and schemas now depend on it.

10.9. Postcondition guards on batched steps.
- Files: `src/lib/jarvis/contracts.ts`, `planner.server.ts` (lines 1439 to 1459), `device-agent/windows/ocade_agent/gateway.py` and the workers.
- Change: each batched step may carry an expected result: an element exists, a value equals, a window title contains, a file hash, or a page address. The device checks it after the step.
- Change: a miss cancels the remaining steps through the existing batch cancellation in migration `20261113120000`.
- Rules: at most one confirmed external effect per batch, always last.
- Acceptance: a test shows that a failing guard cancels the remaining steps, and that STOP in the middle of a batch fences them on hosted Windows and macOS.

In plain terms: the AI may plan a few safe steps at once, and the computer checks after each step that it worked before continuing. One mistake stops the rest automatically.

10.10. Complete approval details.
- Files: `src/jarvis/JarvisPanels.tsx` and the confirmation text in `src/lib/jarvis/authority.server.ts`.
- Change: show the exact command, target, file and site with their risk, never truncated. Long text scrolls instead.
- Acceptance: a test renders a 2,000-character command completely.

10.11. Remove the retired Live and hybrid planner code.
- Files: `src/lib/intelligence/live-session.ts` and its callers.
- Change: trace every caller and delete the code if no approved feature uses it.
- Acceptance: tests pass and no planner path references it.

10.12. Safety regression set run on every safety-related change. Wrong-window refusal, STOP during a network claim (defect D22's regression), STOP in the middle of a batch, unknown-effect handling, and permission revocation in the middle of a turn.

## Part 11. Package P1: complete companion, computer control, browser, installation and recovery (estimated one to two weeks)

11.1. Windows inspection by cached query.
- File: `windows_worker.py` (`ui_inspect`, line 285).
- Change: replace the depth-first walk of the first 150 elements with one UI Automation `FindAllBuildCache` call. It uses a cache request for name, control type, bounding rectangle and automation identifier, and a condition of enabled, not off-screen and a control element. This is the pattern used in Microsoft UFO's `ufo/automator/ui_control/inspector.py` lines 228 to 370 (VERIFIED).
- Change: report how many elements were cut off when a limit applies.
- Acceptance: `test_windows_ui.py` passes on the hosted Windows runners, with a median inspection time of at most 300 milliseconds on the fixtures.

11.2. macOS accessibility for Electron and Chromium applications.
- File: `mac_worker.py`.
- Change: set `AXManualAccessibility` on the application element, falling back to `AXEnhancedUserInterface`, and wait up to two seconds for the tree.
- Acceptance: a non-empty tree for VS Code or Chrome on the hosted macOS runner.

11.3. Scrolling.
- Files: `contracts.ts`, then the regenerated `protocol.json`, plus `windows_worker.py`, `mac_worker.py` and `web_worker.py`.
- Change: add `ui.scroll` and `web.scroll` as reversible operations, using the UI Automation scroll patterns, the macOS accessibility scroll actions and Playwright's scroll-into-view.
- Acceptance: a control below the visible area is reached in the fixtures.

11.4. Web observation by accessibility snapshot.
- File: `web_worker.py` (`_observe`, lines 565 to 624).
- Change: use Playwright's `page.aria_snapshot(mode="ai")` and `page.get_by_ref()`. Both exist in the pinned Playwright 1.64.1 (VERIFIED in Playwright's API documentation: aria snapshot since 1.59, get-by-ref since 1.64).
- Change: return controls only by default. Page text comes through `web.read` with a character limit and an optional filter, as OpenClaw does (VERIFIED, `extensions/browser/src/browser-tool-description.ts`).
- Keep: site binding, the rule that only the newest observation's references are valid, the refusal of secret fields, popup, dialog and permission reports, and the settle wait.
- Rollout: switch only after a measured comparison shows at least 40 percent fewer tokens with equal fixture success.

11.5. Repair hints. Each device refusal code (in `gateway.py` and the workers) gets one generic sentence naming the fix, so the model does not retry blindly.

11.6. Tray icon and session mode. Part 5.4, implemented in `device-agent/windows/ocade_agent/agent.py`. Acceptance:
- the tray appears only during a session or task;
- STOP from the tray fences effects within one second;
- the companion exits after the idle period with no orphaned processes (tested on both hosted systems).

11.7. Pairing without repeated email. Part 5.5. Acceptance: on the hosted runners, a fresh install reaches a paired, permitted device in under two minutes, with no email step.

11.8. Installer, updater and uninstall.
- Files: `device-agent/windows/packaging/*`, the macOS bundle scripts, and a new updater inside the agent.
- Change: integrity check, staging, rollback, and no update in the middle of an action.
- Acceptance: clean install, upgrade, rollback and uninstall pass on Windows Server 2022 and 2025 runners and on macOS 15.
- Disclosure: certificates are excluded. Unsigned Windows builds show the SmartScreen warning "Windows protected your PC", and unsigned macOS apps need "Open Anyway" in System Settings. Both are stated on the download page.

11.9. Restricted Windows token for `shell.run`, `job.*` and verifier re-runs, in `command_worker.py`. Based on the restricted-token design of OpenAI Codex's Windows sandbox (LEDGER from the blueprint; not re-read in this session).

11.10. Recovery under failure. Fault-injection tests:
- killing the companion in the middle of a step shows an unknown effect that is never repeated;
- a provider quota refusal queues the task and resumes it;
- a lost network reconnects;
- a device that sleeps resumes safely.

11.11. Customer journey audit and fixes.
- Run `tests/web/surface_audit.py` on every page and control.
- Fix dead controls, empty states, error and loading states, responsiveness and accessibility.
- Have a fresh test account complete the whole journey without help: landing page, registration, email verification, onboarding, download, install, pairing, permissions, first task, verified deliverable and continued use.
- Acceptance: zero dead controls, no serious accessibility findings, and a measured first verified task within five minutes of download.

## Part 12. Package P2: JARVIS website, account, device and data lifecycle (coding stage)

12.1. Website-only JARVIS interaction. Keep the customer's task entry, device list, exact consent/approval dialogs, execution timeline, STOP, Take Over, receipts and editable outputs inside the website. Reuse the existing components. Verify each JARVIS control and user state with automated interaction tests.

12.2. Task and session lifecycle. A fresh registered user can install the companion, pair without repeated email verification, authorize an exact task, start it from the website, inspect actual execution progress, stop it, resume through a safe revalidation, receive independently verified files, end the session and have the temporary companion exit. The workflow must recover appropriately from browser refresh, sleep and device reconnection.

12.3. Customer data deletion. A scoped delete-data request removes only JARVIS-owned local task artifacts and applicable server records after explicit confirmation. Account deletion revokes devices and closes authorized sessions. A test proves the absence of data that should have been deleted and never destroys unrelated user files. Existing lawful retention/security obligations are not waived.

12.4. JARVIS permission, help and support experience. Present exact task scope, device access, STOP, Take Over, permission changes and support information clearly. Maintain authorization evidence and meaningful privacy controls.

12.5. Customer acceptance. A fresh account on a clean, supported Windows or macOS machine completes a first authorized task end to end without developer assistance, with no dead controls, misleading status or unverified completion. Complete coding and focused tests now; final hosted/real-device qualification belongs to P5.

## Part 13. Package P3: advanced PC control, operations and security

13.1. Verified-route replay. A verified earlier task's step list, with its values as parameters, may be replayed as one guarded batch without model calls, falling back to normal planning at the first failed guard. Owner decision on O8 wording: the routes are learned from the customer's own verified runs, never hardcoded.

13.2. Background accessibility actions. UI Automation and macOS accessibility pattern actions on a leased background window while the person types elsewhere. This is an owner decision, because it changes the quiet rule of plan v7 section 13.

13.3. "Teach a task" recorder. The person demonstrates once; clicks are resolved to accessibility elements and passwords are redacted. Post-launch.

13.4. Parallel independent milestones. Milestones that touch disjoint windows, files or pages run in parallel under the same authority and locks. 16 November acceptance clarification: real concurrent device jobs and independent subagent action streams are required, with per-agent colored activity identity and app-scoped monitoring; do not implement a single mouse controller whose actions are merely drawn as many simultaneous cursors. Resource conflicts, shared app main-thread operations and physical desktop pointer/keyboard actions remain arbitrated. See Part 14F.


13.6. Operations:
- backups using approved resources, with a timed restore drill;
- alerts on error rate, quota refusals and spending;
- support tickets tested end to end;
- an incident runbook drill;
- staged release and rollback.

13.7. Security:
- decode embedded IPv4 addresses in 6to4, NAT64 and Teredo IPv6 forms in `web_worker.py` lines 270 to 276;
- limit external tool schema size and depth in `catalog.py`;
- add a secret canary to CI;
- turn on leaked-password protection in Supabase Auth (VERIFIED: currently disabled, per the Supabase security advisor);
- as defence in depth, revoke public execute rights from security-definer functions that only the server calls. The advisor lists 36 such functions callable by signed-in users. Spot checks show that the critical ones call `private.ocade_owner_require` or a staff-permission check (VERIFIED for `ocade_revoke_unlimited` and eleven others). The remaining 24 must be checked one by one.

## Part 14A. Mandatory original five-repository integration plus Ruflo extension, advanced AI-agent architecture and pre-benchmark coding requirements (latest owner scope)

14A.0. LATEST OWNER SCOPE OVERRIDE (15 November 2026). OCADE now includes the ENTIRE website and product: JARVIS first, online chat second, offline chat/site/model third, accounts, settings, device companion, help, FAQ, user policy pages and customer workflows. This overrides the earlier JARVIS-only scope, exclusion of all chat work and the narrower model-adapter constraint. Original 266 requirement IDs, 84 architecture concepts, and machine-readable appendices remain intact; do not silently rewrite historical baseline evidence. Finish each mandatory scoped item to CODED and verified GREEN CI before beginning real-task/cloud benchmarks. The older plan paragraphs are historical wherever they conflict; owner override is explicit here.

14A.1. Six source repositories and integration rules (original five below, Ruflo in Part 14D).

1. NousResearch Hermes Agent — https://github.com/NousResearch/hermes-agent — constrained tool programs, delegation, skill learning, checkpointing and model-context efficiency.
2. OpenClaw — https://github.com/openclaw/openclaw — skill security, extension lifecycle, gateway trust, diagnosis and state recovery.
3. trycua CUA — https://github.com/trycua/cua — native computer drivers, action contracts, screen/element grounding, isolated testing and real-device verification.
4. Microsoft UFO — https://github.com/microsoft/UFO — application-aware task graphs, event-driven execution, Windows accessibility optimizations and dependency-aware coordination.
5. n8n Nod — https://github.com/n8n-io/nod — universal provider adapters, secure credentials, learned tasks, approvals, memory, scheduling and connected-app operation.
6. ruvnet Ruflo — https://github.com/ruvnet/ruflo — durable mission revisions, active specialist swarms, versioned messages, scoped context, conflict-safe work branches and global AI budgeting. See Part 14D.

For each source item below, independently inspect actual upstream source, current version, dependencies, permissions, license/SPDX, model-weight licenses and target Windows/macOS support; identify matching OCADE code and choose KEEP, IMPROVE, MERGE, ADD, REPLACE, VERIFY or DEFER. Copy useful, legally compatible code when it is genuinely better, with attribution and license compliance. Never clone every framework into production or create competing task authorities. Each entry must have affected paths, implementation proof, negative tests, independent acceptance evidence, cost/latency comparison and a traceability disposition. Historical recommendations are NOT proof of a current deficiency. One mutation authority and prompt-injection/STOP/approval safeguards remain immutable.

Catalog accounting: The original 72 tracked items remain the five-source comparison, while the sixth-source collaboration requirements are separately enumerated in Part 14D without duplicating runtime ownership. 62 existing source-derived recommendation entries are preserved below; 10 separate Nod extensions are numbered 63–72. These are 72 tracked entries, not necessarily 72 unique missing product features because Nodes 53–62 and 63–72 intentionally refine some of the same mechanisms. Maintain one engineering fix per actual gap, with multiple cross-references, avoiding duplicate implementations.

### 14A.2. Detailed five-repository source-integration ledger (items 1–62)

Shared rules for REPO-01–62: consult the named original source file and repository research notes; verify implementation and revision before copying. Each item's Adoption code invokes the full corresponding policy below, subject to the binding later owner overrides in 14A.4. All entries retain their individual evidence, change and independent acceptance requirements.

A1. Extend the current implementation rather than replace it. Run a before/after acceptance suite and revert if the change increases risk, complexity, error rate or latency without a material customer benefit.
A2. First search the current repository, tests and runtime logs for an equivalent. If one is present, improve it; if absent, implement the smallest secure extension. Do not claim confirmed absence solely because a filename or feature was not found during this targeted audit.
A3. Explicit owner-requested experimental capability. Document the conflict with prior two-model/one-controller rules, run side-by-side tests and ask for the necessary model/security/scope approvals before production activation.
A4. Keep the capability out of mandatory launch work unless independent customer need and benchmark data reverse the decision. Prefer eliminating its complexity over copying an unused subsystem.
A5. Implement the missing bounded capability through an existing OCADE module, preserving the current controller. Copy only small, compatible code after a license/security review; do not import the upstream application wholesale.
A6. Keep the existing implementation as the default. Add reproducible verification evidence; do not rebuild a feature that already passes the required tests.


#### REPO-01. Bounded programmatic action batches (`H01`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — IMPROVE — P1.

- Evidence: OCADE already provides guarded action batches, reportedly up to five steps, so this is an optimization rather than a missing executor.
- Change: Permit the planner to emit a bounded, inspectable operation program for repetitive read/calculate/write steps. Compile it into existing authorized actions; validate each argument, target and checkpoint; stop at the first unexpected effect. Measure against the existing five-action mechanism before adopting Hermes RPC mechanics.
- Independent acceptance: On 30 representative repeated workflows, compare p50/p95 time, model calls and first-attempt success to the existing path. Inject STOP, an altered file and a wrong-window event mid-batch; no unauthorized post-STOP effect may occur.
- Adoption: A1.

#### REPO-02. Narrow RPC tool bridge (`H02`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — PROPOSE — P2.

- Evidence: OCADE has an existing gateway and worker dispatch; a second independent gateway would duplicate authority.
- Change: If programmatic execution genuinely helps, expose only a restricted callable interface into OCADE's existing task-authority layer. Enforce allowlists, per-action identity, typed inputs, maximum calls, deadlines, output limits and nonreplayable receipts. Never grant direct OS or secrets access to generated code.
- Independent acceptance: A generated batch cannot invoke a tool outside its approved manifest or work after cancellation. Audit logs name every inner effect and its parent task.
- Adoption: A2.

#### REPO-03. Decision-preserving context compaction (`H03`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — IMPROVE — P0.

- Evidence: prior source review says planner.server.ts already clips observations but retains relatively large state and context budgets; reducing characters alone can remove important facts.
- Change: Maintain concise objective, recent verified state, available actions, unresolved obligations, permissions and error summaries. Prune duplicate tool output and old screenshots, not authority constraints or task dependencies. Test token savings against unchanged correct decisions.
- Independent acceptance: Use a frozen decision-parity corpus with large, multilingual and multi-window tasks. Reject compaction that changes a correct target, permission decision or required action even if it is faster.
- Adoption: A1.

#### REPO-04. Pre-mutation checkpoints (`H04`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — IMPROVE — P2.

- Evidence: OCADE journals task effects; prior source review does not prove comprehensive checkpoints for every reversible multi-file operation.
- Change: Before high-impact editable-file changes, create a task-scoped snapshot or revision record, monitor available disk space and record a restore recipe. Checkpoints must be selective; a large media render must not trigger excessive full copies.
- Independent acceptance: Corrupt a spreadsheet, CAD assembly and video project in controlled tests. Restore only the agent's changes without erasing customer edits made afterward; external submissions are never blindly undone.
- Adoption: A1.

#### REPO-05. Typed actionable recovery hints (`H05`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — IMPROVE — P1.

- Evidence: OCADE already has generic recovery and refusal reasons; Hermes identifies narrower classes of execution faults.
- Change: Classify errors into recoverable vs uncertain-effect vs unrecoverable; attach an evidence-based recovery hint and required re-observation. For example, a missing application is different from a failed save with unknown state. Add only classes demonstrated in real logs.
- Independent acceptance: Replay real failures, recover without duplicate actions, and preserve unknown-effect quarantines. Test retry ceilings and that STOP overrides recovery.
- Adoption: A1.

#### REPO-06. Verified reusable procedure learning (`H06`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — IMPROVE — P2.

- Evidence: OCADE's precedent mechanism retrieves similar routes as advice; prior source review says it does not independently replay the prior procedure.
- Change: Create opt-in, parameterized recipes only after an external verifier validates output; store preconditions, app capability requirements, permissions, parameter placeholders and expiry conditions. Revalidate target observations on every use, rather than replaying recorded clicks.
- Independent acceptance: A recipe works across renamed files and changed window positions, fails safely if prerequisites differ and never reuses another customer's private observations.
- Adoption: A1.

#### REPO-07. Parallel subagent delegation for independent thinking (`H07`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — EXPERIMENT — EXPERIMENT.

- Evidence: prior research reference explicitly recommends rejecting additional AI agents now because a single authority and two planner models are the existing contract.
- Change: Record the owner's newly requested swarm option as an EXPERIMENT, not automatically enabled. Restrict initial delegates to read-only research, independent file inspection or benchmark diagnosis; merge results into one task authority. Compare against a single deterministic script and one planner; use the faster and more reliable implementation.
- Independent acceptance: Only permit production use after held-out benchmarks show a material win without doubled cost, conflicting edits, inflated latency or additional authorization risk. The controller must cancel all children upon STOP.
- Adoption: A3.

#### REPO-08. Remote and container execution backends (`H08`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — DEFER — DEFER.

- Evidence: Hermes supports remote tools, SSH and containers. OCADE already has a separate development/CI environment and a native customer companion.
- Change: Keep Docker and disposable VMs in developer/CI/cloud test environments. Add optional remote backend abstraction only for authorized tasks that need it; do not impose Docker, hypervisor or Linux installation on each customer.
- Independent acceptance: A clean Windows/macOS customer installs just the companion. CI can create a disposable test sandbox and prove that no customer device depends on its engine.
- Adoption: A4.

#### REPO-09. Persistent provider capability knowledge (`H09`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — ADD — P1.

- Evidence: source-review evidence source inspection found rejected model parameters cached in an in-memory Map, so incompatibilities are rediscovered after process restarts.
- Change: Persist supported model/provider/version/tool-calling settings, response limits, reasoning knobs and rejection evidence in a bounded, versioned registry. Keep caches isolated by provider and deployment, with expiry and negative-result verification.
- Independent acceptance: After restart, a known unsupported parameter is not sent again; after a provider upgrade the capability can be reprobed safely. No tenant data leaks through cache keys.
- Adoption: A5.

#### REPO-10. Deterministic program substitution (`H10`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — IMPROVE — P1.

- Evidence: Simple calculations, file normalization and structured transformations do not require generative reasoning on every instruction.
- Change: For tasks with a well-defined local operation, use deterministic parsers, native file formats and scripts before model-generated multiagent plans. The AI should choose or describe the goal, not supervise every cell calculation or ordinary filesystem read.
- Independent acceptance: Benchmark deterministic route vs model route for accuracy, latency and idempotency; the simple path must win or be removed.
- Adoption: A1.

#### REPO-11. Bounded code execution safety (`H11`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — IMPROVE — P0.

- Evidence: OCADE has approvals, a command worker and a task authority, but code-driven batches introduce an additional attack surface.
- Change: Treat generated source as untrusted. Constrain imports, tools, directories, shell use, execution duration, network destinations and output. Prefer approved high-level operations over general shell access; preserve an evidence receipt for each mutation.
- Independent acceptance: Attempt command injection, unauthorized path traversal, network exfiltration, oversize output, infinite loops and cancellation during execution; every case is blocked or terminates cleanly.
- Adoption: A1.

#### REPO-12. Multi-turn efficiency and resource-budget evaluation (`H12`)

Source: https://github.com/NousResearch/hermes-agent. NousResearch / Hermes Agent — VERIFY — P0.

- Evidence: prior source review identifies large prompts and model response delays; improvements were proposed but no reproducible production latency target is established here.
- Change: Create per-task timing spans for prompt assembly, inference, action dispatch, application wait, verifier and recovery. Establish a baseline before adding another executor or model and track token/quota ceilings.
- Independent acceptance: Publish task-by-task timing with p50/p95, pass rate, resource usage and cost-equivalent credits. Reject changes that speed up a substep but slow end-to-end completion or lower task success.
- Adoption: A6.

#### REPO-13. Skill discovery, eligibility and refresh (`O13`)

Source: https://github.com/openclaw/openclaw. OpenClaw — IMPROVE — P2.

- Evidence: OCADE supports pinned external MCP manifests. OpenClaw demonstrates a richer lifecycle; a second uncontrolled plugin authority is not required.
- Change: Extend the existing catalog with trusted source discovery, supported OS/app capabilities, eligibility, dependency checks, version pinning, staged refresh and automatic disable on incompatibility. Every skill must carry a declared permission footprint.
- Independent acceptance: A malicious or incompatible skill cannot become active via discovery alone. Refresh preserves user-edited configuration and rollback to the previous verified version.
- Adoption: A1.

#### REPO-14. External skill and script security scanner (`O14`)

Source: https://github.com/openclaw/openclaw. OpenClaw — ADD — P1.

- Evidence: prior source review confirms pinned schemas but does not show an equivalent full static-content security scan before third-party skills are accepted.
- Change: Scan imported scripts, manifests and skill instructions for embedded secrets, prompt injection, dynamic downloads, unsafe shell patterns, hidden network destinations and excessive permissions. Results inform deterministic policy rather than granting AI-based blanket approval.
- Independent acceptance: Seed a red-team corpus of benign and malicious packages, measure false positives/negatives, quarantine unsafe packages and require approval for high-risk capabilities.
- Adoption: A5.

#### REPO-15. Customer-facing companion security diagnostics (`O15`)

Source: https://github.com/openclaw/openclaw. OpenClaw — PROPOSE — P2.

- Evidence: OCADE has setup and permission mechanisms, but prior source review requests a clearer customer-readable status of system safety.
- Change: Add a device health panel that checks OS accessibility permissions, gateway binding, update integrity, locked-down command execution, browser access, dependencies and risky configuration. Distinguish fixing automatically from explaining how to fix.
- Independent acceptance: A new user on Windows and macOS receives accurate actionable explanations for intentionally broken permissions without leaking secrets or demanding irrelevant administrative rights.
- Adoption: A2.

#### REPO-16. Versioned extension provenance (`O16`)

Source: https://github.com/openclaw/openclaw. OpenClaw — IMPROVE — P1.

- Evidence: Pinned MCP manifests cover part of provenance; lifecycle, compatibility and supply-chain proof need broader qualification.
- Change: Record source repository, license, version, digest, signed release if available, target OS, permissions, compatible OCADE version, last scan and revocation. Never silently use mutable latest URLs for privileged code.
- Independent acceptance: A tampered binary or changed manifest is rejected, an obsolete extension is disabled, and the customer can see why a capability is unavailable.
- Adoption: A1.

#### REPO-17. Crash and interrupted-task recovery (`O17`)

Source: https://github.com/openclaw/openclaw. OpenClaw — IMPROVE — P0.

- Evidence: OCADE has durable journaling and leases, but prior source review requests adversarial restart tests comparable to OpenClaw.
- Change: After a process crash, reconstruct the exact task, authorization generation, in-flight action, external effects and unresolved outputs. Resume only when the last action's outcome is known; otherwise re-observe and request the appropriate approval.
- Independent acceptance: Force-kill browser, worker, gateway and planner during save, upload and multi-file operations. No duplicate submission or post-STOP mutation is allowed.
- Adoption: A1.

#### REPO-18. Privacy-preserving diagnostic traces (`O18`)

Source: https://github.com/openclaw/openclaw. OpenClaw — IMPROVE — P0.

- Evidence: Task logs are necessary for recovery but may contain screenshots, file contents or secrets.
- Change: Separate operational metadata from confidential observations. Redact credentials, filenames when appropriate, personal content and private URLs; support time-bound retention and scoped access. Preserve enough evidence to diagnose failures without logging raw secrets.
- Independent acceptance: Inject sample passwords and confidential documents; exported logs must not contain recoverable secrets. Recovery must still identify the failed operation and task status.
- Adoption: A1.

#### REPO-19. Broad plugin marketplace (`O19`)

Source: https://github.com/openclaw/openclaw. OpenClaw — DEFER — DEFER.

- Evidence: prior source review explicitly says copying a huge marketplace is not currently material to OCADE's website-based PC-control goal.
- Change: Record the feature in the competitive backlog only. Prefer a small verified set of native capabilities and approved MCP adapters; avoid duplicated plugin managers, arbitrary installers and unsupported channel integrations.
- Independent acceptance: No core customer workflow or acceptance metric is blocked by omitting the marketplace. Revisit only when concrete user demand and security coverage justify it.
- Adoption: A4.

#### REPO-20. Messaging-channel integrations (`O20`)

Source: https://github.com/openclaw/openclaw. OpenClaw — DEFER — DEFER.

- Evidence: OpenClaw has many messaging channels, but the active OCADE contract is website-first JARVIS control.
- Change: Do not add WhatsApp, Telegram or social messaging as task authorities by default. Preserve one web-based permission surface and explicit device pairing. Study messaging only as a future notification channel if customers need it.
- Independent acceptance: Core benchmark pass rate and onboarding are unchanged without channels; any future channel cannot independently approve privileged PC operations.
- Adoption: A4.

#### REPO-21. Gateway identity and authorization hardening (`O21`)

Source: https://github.com/openclaw/openclaw. OpenClaw — VERIFY — P0.

- Evidence: OCADE already uses a central device gateway, identity and per-task authority; the audit does not prove every reauthentication edge case.
- Change: Review device revocation, pairing expiry, replay resistance, local loopback binding, websocket or RPC origin checks, session fencing and device reassignment. Do not build another gateway unless an existing one fails an objective test.
- Independent acceptance: An old paired device, stolen session, different account or replayed message cannot resume control; a valid device reconnects without unnecessary email verification.
- Adoption: A6.

#### REPO-22. Resource bounds for MCP manifests and schemas (`O22`)

Source: https://github.com/openclaw/openclaw. OpenClaw — ADD — P1.

- Evidence: source-review evidence code inspection of catalog.py found manifest and JSON Schema validation but no complete serialized size and nesting limits.
- Change: Enforce maximum manifest bytes, JSON depth, tool count, schema recursion, string lengths, dynamic URL count and per-skill prompt budget. Keep a deterministic error message if a manifest exceeds the limits.
- Independent acceptance: Feed nested/cyclic/oversized schemas and hundreds of fake tool entries. Parsing stays within CPU/memory limits, never truncates security-critical descriptions and rejects safely.
- Adoption: A5.

#### REPO-23. Skill permission scoping and revocation (`O23`)

Source: https://github.com/openclaw/openclaw. OpenClaw — IMPROVE — P0.

- Evidence: MCP tool calls are pinned and permissioned, but importing a new skill changes the available action surface.
- Change: Require a per-skill permission proposal mapping to file scope, network domains, external publishing and high-risk commands. Bind the approved scope to task identity, display changes and support immediate revocation.
- Independent acceptance: A skill that requests broader file access after an update cannot execute until reapproved; revocation cancels dependent pending calls.
- Adoption: A1.

#### REPO-24. Trust boundaries for retrieved content and instructions (`O24`)

Source: https://github.com/openclaw/openclaw. OpenClaw — IMPROVE — P0.

- Evidence: Untrusted web pages, files and skill instructions may try to redirect the agent. prior source review emphasizes keeping AI interpretation separate from deterministic permission enforcement.
- Change: Tag every observation by source and trust, prevent retrieved instructions from altering system policy, distinguish a customer's command from quoted website content, and validate all proposed tool effects.
- Independent acceptance: Test hostile web pages that instruct JARVIS to send data or ignore STOP. No unauthorized effect occurs, even if the planner repeats malicious wording.
- Adoption: A1.

#### REPO-25. Extension update staging and rollback (`O25`)

Source: https://github.com/openclaw/openclaw. OpenClaw — PROPOSE — P2.

- Evidence: The existence of pinned manifests does not prove safe upgrade, rollback and compatibility testing.
- Change: Prepare new versions alongside the active version; run health checks and permission diffs, then activate only between tasks. Keep a known-good version available for rollback and preserve evidence of who authorized the update.
- Independent acceptance: An update fails mid-install or removes a tool; active task behavior stays stable and the previous extension can be restored without losing user files.
- Adoption: A2.

#### REPO-26. Least-privilege package execution (`O26`)

Source: https://github.com/openclaw/openclaw. OpenClaw — IMPROVE — P0.

- Evidence: A Windows command worker exists, but prior source review notes that a working-directory restriction is not a full OS access boundary.
- Change: Use OS-level reduced-privilege process identities, file access controls, named-pipe restrictions and restricted child processes wherever feasible. An external skill does not inherit the full user account authority by default.
- Independent acceptance: Attempt to read paths outside an approved workspace and spawn elevated commands; prove denial on clean Windows/macOS test machines, not only mocks.
- Adoption: A1.

#### REPO-27. Background accessibility actions (`C27`)

Source: https://github.com/trycua/cua. trycua / CUA — PROPOSE — P2.

- Evidence: Cua can sometimes control accessible elements without foreground focus; OCADE uses foreground input on some Windows routes.
- Change: Add background actions only for supported, well-identified application APIs or accessibility targets. Never simulate global keyboard input in the background; recheck window and element identity immediately before an effect.
- Independent acceptance: Work in two simultaneous windows while a user types in another app. The background action must affect only the approved target and must not steal focus or corrupt the user's typing.
- Adoption: A2.

#### REPO-28. Rich per-action delivery evidence (`C28`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P1.

- Evidence: OCADE has receipts and independent verification; CUA adds route, delivery method and effect-confidence metadata.
- Change: Extend receipts with attempted mechanism, action ID, target binding, expected effect, observed effect, time spent, retry decision and evidence pointer. Do not duplicate or replace the verifier.
- Independent acceptance: A test distinguishes delivered input, observed UI change and verified business outcome, and the record survives a crash with no credential leak.
- Adoption: A1.

#### REPO-29. Snapshot-bound element references (`C29`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P0.

- Evidence: OCADE already has scoped element references; stale references remain a possible failure after window or page changes.
- Change: Bind target handles to window generation, observation timestamp, accessibility-tree version and allowed action. Invalidate on navigation, modal transitions, window recreation or app restart; reacquire targets instead of guessing coordinates.
- Independent acceptance: A button disappears or a modal replaces it between inspect and click. JARVIS refuses stale target use and re-observes before acting.
- Adoption: A1.

#### REPO-30. Postcondition verification of real outcomes (`C30`)

Source: https://github.com/trycua/cua. trycua / CUA — VERIFY — P0.

- Evidence: OCADE's receipt plus independent verifier already separates action delivery from completed customer outcomes.
- Change: Preserve the existing structure. Expand application-specific independent oracles for spreadsheets, CAD geometry, video timelines and exported files; never call a click or save dialog sufficient proof.
- Independent acceptance: Hidden-answer tasks verify the file/state independently after JARVIS finishes. A successful click with wrong final content is marked failed.
- Adoption: A6.

#### REPO-31. Reproducible desktop benchmarks (`C31`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P0.

- Evidence: OCADE has E1–E4 and 16-run comparisons planned; their qualified pass evidence is incomplete in prior source review.
- Change: Version task environments, fixture snapshots, evaluation scripts, oracle criteria, model settings, OS builds and result artifacts. Track first attempt separately from recovery attempts, plus wall-clock task time.
- Independent acceptance: A second runner reproduces the same result with the same hash/seed; CI and physical-device claims are not conflated. All required coding gates are green before broad real-task campaigns.
- Adoption: A1.

#### REPO-32. Optional isolated desktop test environments (`C32`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P1.

- Evidence: A local VM/container test environment can contain destructive test fixtures; the customer device must still be controlled natively.
- Change: Provision disposable Windows/macOS-compatible cloud test hosts or VMs, snapshot fixtures and inject failures. Keep virtualization strictly a testing/developer capability; do not force customer installation.
- Independent acceptance: All destructive fault-injection tests run away from real customer devices. A clean customer installs only OCADE's approved companion, not a general container engine.
- Adoption: A1.

#### REPO-33. Additional narrow planner models (`C33`)

Source: https://github.com/trycua/cua. trycua / CUA — EXPERIMENT — EXPERIMENT.

- Evidence: prior research reference says specialized form models should be deferred because the approved production planners are two independently tested models.
- Change: Record the owner's request to support additional models, but isolate each in an experimental adapter until capability, data handling, correctness, cost and latency checks pass. Do not silently route customer tasks to unapproved models or replace the user's chosen planner mid-task.
- Independent acceptance: A candidate model passes held-out forms and complex tasks, tool-schema tests and STOP/security checks before eligibility is approved. Otherwise it remains disabled with a visible reason.
- Adoption: A3.

#### REPO-34. Foreground focus and input arbitration (`C34`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P0.

- Evidence: Foreground keyboard/mouse delivery may collide with actual user typing or a second concurrent JARVIS task.
- Change: Introduce a per-device input lease: one owner of global input at a time, continuous active-window revalidation, pause-on-human-input policy and immediate STOP fencing. Nonconflicting read-only work can run concurrently.
- Independent acceptance: When a user changes focus or types during an automation, no keystroke enters the wrong field. Conflicting jobs queue rather than interleave input.
- Adoption: A1.

#### REPO-35. Accessibility tree caching and invalidation (`C35`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P1.

- Evidence: OCADE has Windows UIA inspection caching; prior research reference explicitly says it is not a missing feature.
- Change: Measure cache hit rate and stale-target risk on real apps. Invalidate on window reconstruction, active view changes, process restart and structural mismatch; use incremental snapshots when reliable.
- Independent acceptance: Cache reduces p95 inspection latency without increasing wrong-target errors. A deliberately stale tree is detected before modification.
- Adoption: A1.

#### REPO-36. Coordinate and display normalization (`C36`)

Source: https://github.com/trycua/cua. trycua / CUA — VERIFY — P1.

- Evidence: prior source review doesn't establish complete multi-monitor, mixed-DPI, screen scaling and remote-session coverage.
- Change: Validate coordinate transforms among logical pixels, physical pixels, screen origins, window client areas and display scales. Anchor clicks to app/element identity rather than naked coordinates.
- Independent acceptance: Run mixed 100%/150%/200% DPI, secondary negative-origin monitor and window movement. There must be no click outside the exact authorized target.
- Adoption: A6.

#### REPO-37. Efficient structural observation before screenshots (`C37`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P0.

- Evidence: prior source review identifies repeated full page-body reads and custom control snapshots in web_worker.py; this can waste time and context.
- Change: Prefer targeted DOM queries, accessibility node diffs and application-native state. Limit screenshots to cases where structured observation fails or cannot express the target. Store observation hashes to avoid resending unchanged state.
- Independent acceptance: Benchmark a large complex website. Model input, observation latency and tool calls decrease while preserving task correctness on held-out pages.
- Adoption: A1.

#### REPO-38. Vision fallback with verified grounding (`C38`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P1.

- Evidence: OCADE has visual matching and screenshot-based fallback, but the audit does not prove broad real-app accuracy.
- Change: Only when native/DOM/accessibility options fail, crop to relevant window, identify target with confidence and relation to nearby labels, confirm current window, then observe the effect. Avoid silent coordinate reuse.
- Independent acceptance: Run GIMP, CAD, complex canvas and custom dialogs on both OSs; test occlusion, theme, zoom, resized windows and malicious lookalike labels.
- Adoption: A1.

#### REPO-39. Typed computer-action contracts (`C39`)

Source: https://github.com/trycua/cua. trycua / CUA — IMPROVE — P1.

- Evidence: Existing tool calls are schema-validated, but a cross-route semantic contract for observed vs executed outcomes requires complete evidence.
- Change: Define a common action descriptor for browser, Windows/macOS accessibility, file operations and visual fallback: target, route, consent scope, precondition, postcondition, effect identity, retry safety and cancellation generation.
- Independent acceptance: The same task has consistent receipts regardless of execution route, and schema fuzzing cannot produce unapproved effects.
- Adoption: A1.

#### REPO-40. Cross-platform device qualification (`C40`)

Source: https://github.com/trycua/cua. trycua / CUA — VERIFY — P0.

- Evidence: Windows 10/11 and macOS are mandatory, Linux optional; prior source review warns hosted simulation does not prove real-device operation.
- Change: Create a device and OS matrix for pairing, accessibility permissions, native operations, tray STOP, install/update/remove, unexpected dialogs and recoveries. Keep evidence per platform and CPU architecture.
- Independent acceptance: Qualify actual supported Windows/macOS devices, separating cloud host success, mock success and customer-device proof. Zero critical STOP or wrong-window failures.
- Adoption: A6.

#### REPO-41. Dependency-aware task graphs (`U41`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — PROPOSE — P2.

- Evidence: OCADE already has ordered milestones. For complex CAD and video work, precedence between files and exports is more important than simple step order.
- Change: Add a lightweight directed acyclic task graph to the existing supervisor with dependencies, prerequisites, cycle checks, side-effect identities and verified completion. Do not add a second swarm coordinator.
- Independent acceptance: A car model, component spreadsheet and video export execute in the right order; an intentionally cyclic plan is rejected before any side effect.
- Adoption: A2.

#### REPO-42. Event-driven wakeups and no wasteful polling (`U42`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — IMPROVE — P1.

- Evidence: prior source review recommends moving from unnecessary polling to event-driven status changes while keeping OCADE's existing durable authority.
- Change: Workers should signal completion, blocked approvals and artifact readiness; the supervisor persists state and wakes only eligible tasks. Poll only when an external application offers no event source, with backoff.
- Independent acceptance: On long renders, the agent makes few/no model calls while waiting, resumes promptly at completion, and still recovers after a missed event or worker restart.
- Adoption: A1.

#### REPO-43. Device-capability-aware task matching (`U43`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — PROPOSE — P2.

- Evidence: The user may own several authorized devices, but their task must not silently move between computers.
- Change: Match required software, OS, RAM/GPU, permissions and user-selected device to available capabilities. Show why a task needs a specific machine; require authorization for reassignment.
- Independent acceptance: A task demanding a Mac-only app cannot be assigned to an incapable Windows host. No cross-device execution occurs without explicit consent.
- Adoption: A2.

#### REPO-44. Controlled dependency-aware replanning (`U44`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — IMPROVE — P1.

- Evidence: OCADE already retries/replans after failures, but dependent subtasks must preserve confirmed prior effects.
- Change: Replan only incomplete or invalidated graph nodes. Preserve verified finished artifacts, avoid resubmitting external effects, and require a new authorization when task scope changes.
- Independent acceptance: Simulate an interrupted 3D export after upstream CAD file completion. Resume without rebuilding unrelated files or duplicating a committed operation.
- Adoption: A1.

#### REPO-45. Experience-based safe route reuse (`U45`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — IMPROVE — P2.

- Evidence: OCADE's precedent() helps suggest operation names but not guarded replay of entire paths.
- Change: Store preconditions, parameters, app version, authority limits and independently verified outcome evidence with each reusable route. Route reuse can accelerate repeated tasks only when revalidation passes.
- Independent acceptance: A verified spreadsheet fix works with a different filename and window; a changed schema causes re-planning rather than blind replay.
- Adoption: A1.

#### REPO-46. Windows cached accessibility inspection (`U46`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — VERIFY — P0.

- Evidence: prior research reference locates the FindAllBuildCache-type design in OCADE windows_worker.py at lines 232–269; it is already implemented.
- Change: Do not reimplement it. Instrument hits/misses, invalidation cost, scan duration and wrong-target prevention. Improve existing cache only if measured evidence shows an actual bottleneck.
- Independent acceptance: Run real Windows app matrices and compare cold/hot inspection latency and accuracy, proving no regression.
- Adoption: A6.

#### REPO-47. Conflicting subtask resource locks (`U47`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — PROPOSE — P2.

- Evidence: Independent work may run concurrently but two jobs cannot modify the same app window or output file safely.
- Change: Introduce a single authoritative resource-lock model for app focus, device input, file paths, task output and approval scopes, integrated with the existing supervisor. Acquire locks deterministically to avoid deadlocks.
- Independent acceptance: Parallel tasks on distinct files finish safely; competing edits serialize and a crash releases stale leases after fencing the old generation.
- Adoption: A2.

#### REPO-48. Cycle and dependency validation (`U48`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — PROPOSE — P2.

- Evidence: Task plans can become cyclic when the model incorrectly makes a result depend on itself.
- Change: Reject task graphs with cycles, missing prerequisites, impossible device requirements and invalidated output paths before execution. Provide a clear corrective explanation or safe plan repair proposal.
- Independent acceptance: Adversarial plans with cycles, missing dependencies or contradictory steps fail before any user-file mutation.
- Adoption: A2.

#### REPO-49. Persisted long-job continuation (`U49`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — IMPROVE — P1.

- Evidence: The task journal exists, but multi-hour plans span app restarts, exports, user interruptions and provider failures.
- Change: Persist progress by verified subtask, include versioned resource requirements and active effect leases, and provide a controlled Resume/Take Over UI. Avoid sending full history back to AI after each reconnection.
- Independent acceptance: Kill the agent during a one-hour video export and resume from proven checkpoints without duplicate rendering or lost edits.
- Adoption: A1.

#### REPO-50. App-semantic specialist action selection (`U50`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — IMPROVE — P1.

- Evidence: The vision and generic computer controls cannot always distinguish CAD-specific operations from ordinary clicks.
- Change: Discover installed application capabilities and choose native CAD/document/media APIs first. Use task graph semantics to select deterministic workers for common operations without hardcoding customer app names or screenshot coordinates.
- Independent acceptance: Complete the same geometry, formula and timeline tasks with different installed supported applications, using accurate editable outputs.
- Adoption: A1.

#### REPO-51. User-visible dependency and failure explanations (`U51`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — PROPOSE — P2.

- Evidence: Progress indicators may show steps but not why a downstream task is waiting or which output is blocked.
- Change: Expose milestone dependencies, exact waiting condition, last verified action, estimated next step only when grounded and user's safe recovery options. Do not invent percentages from planned actions.
- Independent acceptance: For a blocked export, user sees the actual unmet source-file requirement; STOP and Resume work without losing audit history.
- Adoption: A2.

#### REPO-52. Outcome-oriented multi-app qualification (`U52`)

Source: https://github.com/microsoft/UFO. Microsoft / UFO — IMPROVE — P0.

- Evidence: prior source review documents incomplete real-world benchmark success and unknown full current-SHA native tests.
- Change: Add held-out evaluation suites requiring correct cross-app deliverables, benchmark hashes, first-attempt and retry metrics, errors per action, runtime and real Windows/macOS evidence. Keep CUA evaluation environment isolated from customer files.
- Independent acceptance: A second evaluator reproduces strict pass counts on a pinned release candidate; no pass is awarded just because the agent clicked or reported success.
- Adoption: A1.

#### REPO-53. Intent-to-authority interpretation (`N53`)

Source: https://github.com/n8n-io/nod. n8n / Nod — IMPROVE — P0.

- Evidence: OCADE already has deterministic permission grants but may not fully distinguish what a customer's natural-language request authorizes.
- Change: Translate goal intent into an explicit action envelope: target apps/files, allowed reads, mutations, network actions, posting and delegation. Use deterministic policy to enforce it; the model can propose scope but cannot grant it.
- Independent acceptance: A task to draft an email cannot send it unless explicitly authorized. Quoted instructions on a website never expand the customer's permission grant.
- Adoption: A1.

#### REPO-54. Read/prepare/commit effects separation (`N54`)

Source: https://github.com/n8n-io/nod. n8n / Nod — IMPROVE — P0.

- Evidence: Existing approvals may not consistently encode private preparation versus irreversible external submission.
- Change: Classify operations as observation, reversible local edit, external commit, credential use or irreversible mutation. Require appropriate confirmation with full untruncated details for externally committing actions.
- Independent acceptance: A form can be filled and previewed without being submitted; a later submit is blocked until separately authorized. No misleading truncated approval text.
- Adoption: A1.

#### REPO-55. Private credential vault and controlled autofill (`N55`)

Source: https://github.com/n8n-io/nod. n8n / Nod — PROPOSE — P1.

- Evidence: The reviewed JARVIS modules did not establish a general encrypted website-credential vault like Nod's.
- Change: Use OS secure storage (Windows Credential Manager/macOS Keychain) or another approved encrypted vault; issue short-lived target-bound secret references, never raw password text to model prompts or logs. Autofill only an authorized, origin-verified login form.
- Independent acceptance: Injected phishing pages cannot request a credential; model/tool logs contain no password, and revocation prevents further use. Do not import a large vault subsystem unless integration analysis justifies it.
- Adoption: A2.

#### REPO-56. Learned parameterized customer workflows (`N56`)

Source: https://github.com/n8n-io/nod. n8n / Nod — IMPROVE — P2.

- Evidence: OCADE has precedent and experience storage, but automatic durable learned skills are under-verified.
- Change: Capture a user-approved reusable workflow only after independent success; separate parameters from observations; include provenance, version, conditions and expiration. Allow user review and deletion.
- Independent acceptance: Run a learned weekly spreadsheet process against new input files with no guessed paths; it halts safely on structural changes and never publishes without permission.
- Adoption: A1.

#### REPO-57. Protected user-edited skills and instructions (`N57`)

Source: https://github.com/n8n-io/nod. n8n / Nod — PROPOSE — P2.

- Evidence: prior source review does not establish robust precedence rules between a user's own edited skill and auto-learned suggestions.
- Change: Mark user-authored content as immutable to automated learning unless explicitly reviewed; keep version history and change previews. Auto-generated improvements may be proposed, not silently overwrite preferences.
- Independent acceptance: After auto-learning detects a different route, the original user-created skill remains unchanged; rollback restores prior version exactly.
- Adoption: A2.

#### REPO-58. Memory provenance, consent and deletion (`N58`)

Source: https://github.com/n8n-io/nod. n8n / Nod — IMPROVE — P2.

- Evidence: OCADE has an opt-in memory database according to prior code comparison, but source, consent and deletion proof are incomplete.
- Change: Attach each memory to its originating task evidence, user consent scope, freshness and privacy label. Use retrieval sparingly and allow correction, export and complete authorized deletion.
- Independent acceptance: A false preference is corrected and not resurfaced; deleting an item removes it from retrieval and related cache after the declared retention interval.
- Adoption: A1.

#### REPO-59. Customer-facing activity and usage explanation (`N59`)

Source: https://github.com/n8n-io/nod. n8n / Nod — IMPROVE — P1.

- Evidence: OCADE already has task receipts and history; the audit calls for clearer explanations of actual actions, errors and approvals.
- Change: Expose a timeline of objective, devices, apps touched, commands, permissions, verified output, retries, observed failures, usage and model selection. Keep sensitive values redacted and distinguish attempted from completed effects.
- Independent acceptance: A customer can reconstruct what changed without seeing cryptic logs; exported receipts match independent evidence and never expose secrets.
- Adoption: A1.

#### REPO-60. Durable scheduled JARVIS work (`N60`)

Source: https://github.com/n8n-io/nod. n8n / Nod — DEFER — DEFER.

- Evidence: OCADE has schedule database support, but unattended JARVIS scheduling was excluded by the current owner-approved testing scope.
- Change: Preserve planning designs but do not automatically activate cron control of customer PCs. If later approved, use explicit per-schedule task scope, expiry, awake-device checks, one-time occurrence claims and immediate revocation.
- Independent acceptance: A recurring task never runs after cancellation or device revocation and never creates duplicate effects after retry; otherwise the scheduler stays disabled.
- Adoption: A4.

#### REPO-61. Proactive event monitoring (`N61`)

Source: https://github.com/n8n-io/nod. n8n / Nod — PROPOSE — P3.

- Evidence: Earlier Nod comparison found no equivalent full proactive monitoring in the reviewed OCADE JARVIS flow.
- Change: Introduce a future opt-in watch mechanism for permitted app events, changed files or task dependencies. Do not wake agents merely to consume tokens; schedule only actual relevant triggers and protect customer privacy.
- Independent acceptance: An approved watched folder change creates at most one scoped task; unapproved files, notifications or credentials are not read or transmitted.
- Adoption: A2.

#### REPO-62. One-click approved app integrations (`N62`)

Source: https://github.com/n8n-io/nod. n8n / Nod — PROPOSE — P2.

- Evidence: OCADE supports MCP adapters but the previous comparison noted a less complete account-connection experience than Nod.
- Change: Add a verified connector journey: choose service, review requested scopes, authenticate via provider-owned flow, test access, rotate/revoke and see connection health. Reuse the central MCP authority; do not give third-party connectors silent PC-control rights.
- Independent acceptance: A fresh user connects an approved service without copying API keys, revokes it and proves subsequent calls fail. Network and credential limits are tested end to end.
- Adoption: A2.

### 14A.3. Implementation sequence, relative to the JARVIS coding-first rule

1. P0: finish correctness and safety foundations first. Fix authorization intent, STOP/input fencing, command isolation, stale target references, privacy of evidence, trust boundaries, real Windows/macOS qualification readiness, and full current-commit CI. Running tests still require properly authorized environment access.
2. P1: improve execution speed without changing owner authority. Measure model/planner latency, compact context with decision parity, optimize browser observations, bounded code-driven batches, provider capability persistence, event-driven job wakes, richer receipts and credential protection.
3. P2: controlled capability additions. Reusable learned recipes, skill scanning and provenance, secured OAuth integrations, checkpointing, device capability routing, optional task DAG and actionable customer diagnostics. A proposed feature enters the active coding gate only when it solves a specific measured problem.
4. P3: optional after reliable release qualification. Proactive monitoring, unattended scheduling, broad extensions, additional models and swarms stay outside mandatory release unless explicitly approved and independently justified by held-out measurements.
5. Benchmark hard gate. Finish mandatory JARVIS coding and restore complete green website/backend/companion CI on a pinned SHA before full cloud-computer real-task benchmarks. Each failing benchmark reopens coding; repeat the green gate on the new SHA before continuing. Distinguish first-attempt results from repair successes.
6. Finish decision. No 100% production-readiness claim until the full supported customer journey and real-device STOP, permissions, installation, pairing, task completion and verification pass independently. This report does not calculate a new readiness percentage.


### 14A.4. Binding implementation classification and precedence

- Mandatory before benchmarks: Every item marked P0, P1 or P2 REQUIRED after code inspection; all fixes needed to keep JARVIS, the entire website, online/offline chat, security, customer flows, companion and backend CODED and green. No partial item may be mislabeled complete. Evaluate historically deferred items: if they are unnecessary to launch, record verified DEFER with justification, never silently delete.
- Parallel AI-agent system is MANDATORY, not optional. Replace earlier H07 experimental/defer wording. Implement a single authoritative coordinator that delegates independent bounded subtasks to specialist model or deterministic workers while preserving single owner for each computer/window/file mutation. Before delegation, verify it improves latency, quality or capability; keep deterministic code for simple operations. Run dependency graphs, tool-call budgets, scoped permissions, cancellation propagation, bounded agent depth, failure isolation, checkpointing and verified result reconciliation. Benchmark solo against multi-agent execution later; no unlimited uncontrolled agent swarms. Do not use parallel coding agents unless separately approved—the runtime multi-agent requirement is distinct from the established single coding agent restriction.
- Universal model compatibility is MANDATORY. Replace fixed-provider assumptions in adapter design, NOT the existing 16-run baseline. Support capabilities-based configuration for multiple authorized commercial API providers and models; each registered model declares vision, tools, structured schemas, thinking controls, context, token cost, streaming, retry semantics, data-region protections and quota limits. A customer task must have explicit model selection and truthful fallback behavior; no cross-model hidden mutation, automatic substitution of unapproved models, or accidental prompt/secret disclosure. Additional model acceptance requires compatibility/real-task evidence; current Gemini 3.5 Flash-Lite and Gemma 4 31B remain the initial comparison pair, not the only future supported models.
- Key pooling and health routing are MANDATORY within legitimate provider terms. Inspect existing Supabase Edge Functions and authorized GitHub protected environments. Add a secure server-side, encrypted logical key-slot registry with project, provider, model, tenant, permissions, rate-window and spending metadata; check health and automatically choose a valid key for the requested supported provider/model and user. Automatically rotate away from expired/failed keys and apply bounded backoff/circuit breakers. Never send raw API keys to frontend, model prompts or logs. Never rotate keys to circumvent project-level quotas or provider restrictions; multiple keys from one quota project do not multiply its allowance. A secret must first be provisioned by the owner; neither invent secrets nor assume they are readable to tools. Test simultaneous tasks, exhausted quota, revoked keys, wrong-provider selection, isolation, billing safety and safe retry.
- Native-first universal PC control remains MANDATORY. Discover user apps/tools dynamically. Prefer native APIs, file formats, scripts, DOM and OS accessibility for EFFECTS; screenshot-grounded GUI clicking is the last control fallback. For OBSERVATION, Part 14F VISION mandates app state/DOM/accessibility events AND permissioned live target-window video where useful, with event-triggered model analysis and precise screenshot/ROI fallback. Do not interpret 'screenshot last' as 'no continuous video awareness'. No hardcoded application, UI coordinate, benchmark answer, customer credential or task flow.
- Customer-side Docker/VMs are NEVER mandatory. Docker/cloud VMs may help development, CI, isolated tests and explicitly authorized specialist work; packaging and setup on Windows/macOS must not force users to install container tooling. Prove companion cold-start and install time independently.

### 14A.5. Ten additional Nod implementation refinements (items 63–72)

All ten entries expand their related earlier Nod item rather than creating a second executor or duplicate database.

#### REPO-63. Intent-scoped task authorization (Nod extension of N53)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N53`.
- Classification: P0 REQUIRED. Customer benefit: Prevents an apparently helpful AI action from overstepping customer instructions.
- Detailed change: Extend existing task authority to translate natural-language goals into an exact, immutable permission envelope: account, device, named apps/files, allowed reads, local edits, external writes, credential use, duration and revocation. Planner proposals never create permission. Separate inferred intent from granted authority. A document or website must not enlarge that grant.
- Acceptance evidence: Draft an email but never send it; an injected page instruction cannot increase scope; stopping or revoking the task prevents subsequent writes.

#### REPO-64. Read, prepare, and commit action tiers (Nod extension of N54)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N54`.
- Classification: P0 REQUIRED. Customer benefit: Avoids accidental irreversible submissions.
- Detailed change: Classify observation, reversible preparation, external commit, credential release and irreversible mutation. Preserve untruncated approval descriptions showing exact target, contents, consequences and rollback availability. A prepared form is not submitted unless the separate commit is authorized. Preserve idempotency and action receipts.
- Acceptance evidence: An approved draft never sends or submits automatically; unknown previous effect blocks blind retry.

#### REPO-65. Encrypted, origin-bound credential-use vault (Nod extension of N55)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N55`.
- Classification: P1 REQUIRED. Customer benefit: Allows convenient app access without giving the model control of raw passwords.
- Detailed change: Prefer existing operating-system credential stores or a vetted encrypted server vault. Use short-lived origin/target-bound references rather than model-visible plaintext; validate destination domain and TLS, scope access by user/device, rotate and revoke; scrub prompts, screenshots, exceptions and logs. Do not implement a new vault if an existing secure mechanism is sufficient.
- Acceptance evidence: Phishing page and malicious plugin receive no passwords; revocation takes effect immediately; secret scanning finds no plaintext.

#### REPO-66. Reusable independently verified workflows (Nod extension of N56)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N56`.
- Classification: P2 REQUIRED. Customer benefit: Accelerates repeated work with fewer model calls.
- Detailed change: Promote successful task traces into reviewed parameterized skills with version, provenance, app capability requirements, input/output schemas, success oracles and expiration; never save hardcoded user filenames, window positions or selectors as universal instructions. Integrate with existing experience and precedent storage.
- Acceptance evidence: Run the learned spreadsheet workflow on new files and an altered app version without incorrect mutations.

#### REPO-67. Protect user-edited skills and rollback (Nod extension of N57)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N57`.
- Classification: P2 REQUIRED. Customer benefit: Keeps the customer in control of how their work is performed.
- Detailed change: Mark authored instructions as customer-owned; automatic learning may suggest a diff but cannot overwrite the original. Keep revision history, approval records, rollback and deletion. Run regression checks after merging a skill improvement.
- Acceptance evidence: Auto-learning retains user-chosen formatting; version restore is byte-equivalent.

#### REPO-68. Consent-based long-term memory with provenance (Nod extension of N58)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N58`.
- Classification: P2 REQUIRED. Customer benefit: Reduces repetition without creating a private-data risk.
- Detailed change: Build on current opt-in memory. Store source task, timestamp, confidence, consent, privacy label, correction/deletion controls, scope and retention. Retrieve only necessary relevant entries; prevent cross-account or cross-device leakage. Expire uncertain or outdated facts.
- Acceptance evidence: Correct a deliberately wrong preference and confirm it stays corrected; deletion propagates to retrieval and caches.

#### REPO-69. Customer-readable action timeline and receipts (Nod extension of N59)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N59`.
- Classification: P1 REQUIRED. Customer benefit: Builds trust through understandable, truthful progress.
- Detailed change: Translate existing journals into plain-language task objectives, apps accessed, operation attempt versus confirmed effect, approvals, progress, STOP and recovery, verified output links, durations and model usage. Hide internal .py filenames, stack traces, key names or source paths from normal customer views; show them only in restricted redacted developer diagnostics.
- Acceptance evidence: Every timeline item matches an actual signed or journaled event; no false completion or leaked internal path.

#### REPO-70. Durable recurrence with explicit authority (Nod extension of N60)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N60`.
- Classification: P3 CONDITIONAL. Customer benefit: Enables recurring work without duplicate or surprise actions.
- Detailed change: Reuse existing schedule tables if unattended tasks are enabled. Each recurrence stores explicit customer opt-in, exact task scope, allowed device, schedule/expiry, one-time occurrence claim, revocation and offline-device behavior. Do not allow automated background control without visible user-granted permission. If this remains intentionally out of active scope, mark it DEFERRED and explain the prerequisite, not falsely complete.
- Acceptance evidence: Cancellation prevents future runs; duplicated event delivery produces only one effect.

#### REPO-71. Event-driven proactive monitoring (Nod extension of N61)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N61`.
- Classification: P3 CONDITIONAL. Customer benefit: Allows JARVIS to resume tasks when conditions change.
- Detailed change: Watch authorized events such as a completed export, file arrival or paired-device reconnection through efficient event subscriptions; trigger only once per relevant change, without polling the language model. Require separate customer permissions and cost ceilings, and do not broaden scope to unapproved data.
- Acceptance evidence: Single file event causes one scoped action; stop/revoke disables listener; irrelevant events consume no model calls.

#### REPO-72. One-click OAuth and MCP app connections (Nod extension of N62)

- Source repository: https://github.com/n8n-io/nod; related earlier entry: `N62`.
- Classification: P2 REQUIRED. Customer benefit: Simplifies connecting everyday tools while keeping permissions visible.
- Detailed change: Reuse existing MCP routing. Provide provider authorization flow, precise scopes, official redirects, safe secret storage, connection tests, health/expiry, disconnect and refresh. Never ask customers to paste secrets into chat. Dynamically expose only authenticated and permitted tools to the planner.
- Acceptance evidence: Connect, run a narrow authorized task and disconnect; subsequent access is denied; no credentials appear in logs.


### 14A.6. Required readiness ledger for the 72 architecture entries

Use one source-of-truth ledger keyed `REPO-01` through `REPO-72`: owner priority, current code path, source link/commit, disposition, exact change, input/output contract, threat model, new tests, real-device dependency, performance baseline and independently verified evidence. Start from the existing 266-ID/84-concept ledgers and link to them; never create a competing task authority, separate permissions engine, second secret vault or duplicate execution manager. Deferred items require an explicit signed-off reason. All applicable required and partial entries must be completed and return GREEN code/CI tests before the first benchmark task.

## Part 14B. Entire OCADE website implementation, user experience, online/offline Chat, secret security, policy pages, and green-build prerequisites

This is implementation work BEFORE any real-task/cloud benchmarking. P0: JARVIS computer control and core safety. P1: online Chat, universal model routing and customer integration. P2: offline Chat/site model setup and settings. P3: site-wide UX, security, support, policies, production hardening, complete regression suite and cleanup. These are implementation priorities only: no offline-model download/airplane-mode qualification until the LAST stage of benchmarking, but offline feature coding, typechecking and local tests MUST already be green. All applicable 72 architecture entries and any earlier partial mandatory feature must be accounted for. No standalone miniature green commit substitutes for green CI on the whole final branch head.

### 14B.1. Universal online AI and chat architecture

1. Model-agnostic backend. Expose a provider-neutral planning/chat API, unified capability contract and streaming state, while preserving distinct chat and JARVIS permissions. Support model families beyond Gemini/Gemma through approved provider adapters; choose by actual vision, tool schema, latency, context, safety and cost rather than hardcoded brand identifiers. The initial 16-run comparison remains Gemini 3.5 Flash-Lite versus Gemma 4 31B and does not authorize live use of untested models.
2. Supabase key registry. Register any number of already-authorized key slots against real provider/project/account/model identities, encrypted server-side. Selection uses health, remaining lawful quota, task permission, data-region eligibility, configured priority and service cost. Health rotation handles revoked or failing keys; not quota evasion. Multiple keys in the same project share project-level quota where provider rules say so. Never copy keys from chat, screenshots or test output. Separate staging and production. Require owner-approved secret access and do not assume Supabase/CI secrets have been checked.
3. Online chat functionality. Code complete chat initiation, new/edit/regenerate conversation, streaming answer, STOP, history persistence, clear error states, optional attachments, safe file previews, token/status usage, model selector, clipboard copy, exports where supported, context and model availability, rate-limit handling, protected deletion and per-account isolation. Use the same design primitives, not the JARVIS command authority.
4. Model qualification before release. Each provider adapter needs positive/negative tests for schema, streaming, long context, images, tool calls, refusals, unknown unsupported parameters, timeouts, retries, rate limiting, pricing/quota reporting, data isolation and approved region use. No hardcoded provider keys in browser bundles or mocks promoted to runtime results.
5. Mandatory multi-agent JARVIS. Build a bounded multi-agent coordinator with specialist capabilities, precise scope, one authoritative mutation owner, independent subtask verification, cancellation propagation and evidence aggregation as defined in Part 14A. Agent swarms cannot perform duplicate desktop actions or replace faster deterministic operations. Report actual number of model calls, latency and failure rate.

### 14B.1A. Owner Supabase key registry and customer BYOK Settings (MANDATORY P0; 15 November 2026)

New owner decision; NOT an implementation claim. OCADE must provide two independent secure credential sources: (a) owner-managed credentials provisioned in Supabase and (b) a customer's personally supplied BYOK credentials. This requirement precedes whole-product coding GREEN and real-task benchmarking. Preserve existing single task authority, authenticated server-side model gateway, customer consent, STOP, journaling and independent verification. Do not create a second agent execution engine or duplicate key vault.

1. Unbounded-by-design owner credential registry. The owner can register, batch-import, enumerate, label, enable, suspend, replace and revoke any legitimately provisioned number of provider keys from the Supabase Dashboard and, where independently secured, an owner-only admin console. Remove the three-fixed-Gemini-slot architectural ceiling. Support at least 100 simulated key records with no additional source edits or redeploys. There is no claim of infinite request capacity or free provider quotas. Store each secret using Supabase Vault or a vetted equivalent encrypted secret manager; store only opaque secret references and nonsecret metadata in protected server-owned tables. Never put one variable per customer/key into Supabase Edge Function environment secrets, and never expose Vault's decrypted secrets view or privileged management RPCs to browser users. Require owner authentication and recent strong authorization for optional bulk-import UI.

2. Independent owner and user pools. Credential metadata records provider, endpoint/protocol, model IDs, provider account, actual quota/billing project, owner user or privileged platform owner, encrypted secret reference, permitted task surfaces, data residency, enabled/disabled state, priority, health, rate windows, cost ceilings and timestamps. Do not mix the platform pool with another customer's BYOK pool or assume distinct keys in one provider project have independent quota. Store one record per logical key or provider-account credential; do not hardcode a maximum record count in the application.

3. Exactly named Settings category. Add a sixth authenticated Settings category named BYOK alongside Account, Preferences, Devices, Privacy & Security and Billing & Usage. Add deep-link support for the query parameter settings=byok, with normal accessible keyboard/mobile focus behavior. This is the customer's real operational connection manager, not merely an informational card or advanced toggle. Never show a working Connected state until authenticated server storage, provider validation and actual routing are implemented. Do not introduce an inert Save or fake preview.

4. Customer Add BYOK Connection form. Request friendly connection name, provider (or explicitly supported compatible protocol), provider-specific model ID or safely discovered model, API Key / Token, Gateway URL / API Base URL (preset for known providers; a validated custom HTTPS URL only if the adapter safely supports it), and provider-required deployment, organization, API version and project fields where applicable. Show the exact accepted endpoint format for the selected adapter; never imply a generic arbitrary URL is compatible. Optional extra headers are schema-allowlisted only; sensitive header values use the secret manager. Provide Test Connection (with explicit warning that a probe may consume the user's quota), Save, Update/Replace key, Disable, Delete, default Chat model, default JARVIS model and per-connection permissions.

5. BYOK secret security. Send raw customer key only once via a short-lived authenticated TLS form to a protected backend; encrypt it with Supabase Vault or vetted external secret storage. Never retain plaintext in localStorage, IndexedDB, sessionStorage, URL parameters, browser state beyond entry, logs, observability, prompts, task journals, screenshots, exports or client-readable database rows. Never return the raw key in an API response. Show alias, provider, model and a masked nonsecret fingerprint instead. Server-side account ownership is checked for every listing, test, routing, use, update and delete. Preserve only the required nonsecret audit receipt. Deleting a user removes its associated Vault references and secrets after proper authorization.

6. Validated gateway and SSRF protection. Only trusted server code, never browser code or the customer companion, makes key-bearing model calls. Enforce HTTPS and validated host, certificate, port and IP. Deny loopback/private/link-local/reserved IPv4 or IPv6, internal DNS and cloud metadata endpoints; block or revalidate every redirect; protect against DNS rebinding and IPv4-in-IPv6 encodings. Bound response bytes, stream lifetime, redirects, schemas and retry budgets. Do not let a custom URL relay privileged headers, cloud secrets or customer data to an unauthorized endpoint. Validate provider protocol compatibility, not just a successful HTTP 200.

7. Explicit routing, consent and costs. Each Chat or JARVIS run binds to one named permitted credential source and model policy. Customer choice: OCADE-managed, or a particular MY BYOK connection. Different defaults are permitted for Chat and JARVIS, but one must not silently replace the other. Fallback between model/provider/credential pools is off by default and requires explicit informed opt-in, compliant data region and provider, customer permissions and a known-safe continuation state. Users may be charged directly by their BYOK provider in addition to any OCADE subscription; show that plainly. JARVIS's single mutation controller and independently verified effects remain unchanged.

8. Universal capability and provider contract. Each adapter declares tool/JSON schema support, vision, streams, reasoning controls, roles, context/output limits, token usage, privacy requirements, quota/error semantics, endpoint options and model discovery eligibility. New authorized adapters and model records do not require edits to core planner, UI or fixed Gemini enums. A model discovered on an account is not automatically approved to operate a desktop. Qualify new provider/model combinations on synthetic tasks before enabling consequential agent use.

9. Distributed health, quota and key routing. Track health and lawful quota per project/account/model/key separately, with server-wide atomic reservations or leases so concurrent requests do not overallocate one quota. Distinguish invalid/expired keys, 401/403 permission refusal, payment/credits refusal, 429 temporary rate limits, daily or project-wide quota depletion, provider 5xx, gateway protocol incompatibility and connectivity failures. Honor valid Retry-After and resets, bounded backoff with jitter, rate budgets, fair tenant admission and circuit breakers. Only switch to an independently eligible key if the provider terms and explicit model policy allow it; never rotate to bypass a shared provider quota or unauthorized data restrictions.

10. Truthful UI and revocation. Show Not connected, Validating, Connected, Temporarily rate-limited, Quota exhausted, Credits unavailable, Invalid/revoked, Incompatible model/gateway, Disabled and Provider unreachable only when grounded in actual backend evidence. Display masked connection metadata, last successful check, per-surface permissions, current selected source and actionable fix guidance. Disable/delete immediately fences new and queued requests, and active steps are re-authorized before their next provider call. Never replay unknown PC operations after a failed model turn or model switch.

11. Mandatory isolated tests before benchmarks. Test at least 100 dynamic simulated key slots across multiple provider adapters without source changes; actual Settings BYOK add/test/save/replace/revoke/delete; owner import and isolation; different authenticated customers with the same provider; cross-account and admin denial; gateway SSRF with redirects/DNS rebinding/IPv6/metadata; secret exfiltration attempts; concurrent quota reservations; malformed tool schemas; 401/402/403/429/5xx/reset states; leaked-key detection in traces; fallback consent; STOP and unknown-effect non-replay; storage deletion and database RLS. Use disposable fake-key fixtures; any real validation needs separately authorized credentials and cost. Require the complete final website/companion GitHub CI GREEN on one exact commit before starting real-task benchmarks. Historical baseline model tests are preserved; additional providers are qualified separately.

12. Single authority and evidence states. Link these requirements to the existing 72-source-entry, 84-concept and 266-ID ledgers rather than creating duplicate implementation plans. This feature is CODED only after customer Settings, backend gateway, Supabase metadata/Vault lifecycle, routing and all caller paths work; BUILDS only after security tests and full CI pass; QUALIFIED only after independently demonstrated staging/provider behavior. Merely editing this plan leaves runtime code and Supabase production unchanged.

### 14B.1B. Non-conflicting BYOK and OCADE-funded AI, Base URL semantics and transparent Chat/JARVIS limits (P0)

Non-negotiable invariant: Customer-selected BYOK credentials never authorize consuming OCADE's provider credentials. A task using OCADE-managed inference never silently calls another customer's BYOK key. This applies to ALL model-mediated work: planner, specialist agents, AI verifier, summary, title, image/vision, compaction, embeddings, retries, recovery and scheduled work. BYOK provider charges belong to the customer; OCADE platform subscription or workflow charges, if any, are separately and truthfully disclosed. No attempt to circumvent upstream provider limits.

1. Immutable credential-source binding. The server-side task/turn authority pins account, surface (Chat/JARVIS), credential source (customer_byok or ocade_managed), credential ID, provider, protocol, model, base-URL profile, provider account/quota group, billing party, consent revision, STOP epoch and budget reservation. Browser or model parameters cannot grant or silently change any of these. Changes require a separately authorized new model turn; pending tasks are not silently migrated.
2. Hard prohibition on subsidized hidden calls. BYOK-only tasks must make zero calls using OCADE-funded LLM provider keys, including helper models, summaries, verification, transcription or recovery. Use qualified customer BYOK models or deterministic local operations. If required BYOK capability is missing, pause with a specific explanation; never use an OCADE-funded backup. Test this at the trusted gateway/ledger boundary rather than merely inspecting labels. User BYOK tokens do not deduct OCADE-managed model allowance, though distinct product workflow allowances can apply only under disclosed billing rules.
3. Distinct usage and accounting. Write append-only per-call records for source, credential ID, customer, provider account/project/quota group, model, caller kind (planner/agent/verifier/chat), tokens, returned provider cost or clearly labeled estimate, retries, infrastructure charges, and OCADE product credits (separately). Atomic reservations prevent concurrent leakage or misattribution. BYOK calls cannot increase owner-funded inference counters, and owner-funded calls cannot draw BYOK quota. A project shared by two of the same owner's keys still shares actual provider quota.
4. Always-visible source in Chat and JARVIS. At the composer and during tasks show exactly 'OCADE-managed' or 'Your key: [connection alias]', selected model, health and task-scoped usage. Show accessible nonsecret status on partial failures; allow an explicit 'Change connection' action after revalidation. Never imply that a source changed automatically. JARVIS STOP/Take Over remain available when models fail; permissions and journal authority do not depend on any model.
5. Truthful provider limits. Show provider-reported RPM/TPM/daily requests/tokens, credits and reset only when genuinely available, with observation time, units and 'provider reported' label. Otherwise display 'Remaining provider quota: unknown' plus optional 'usage observed by OCADE' (not misrepresented as provider-wide usage). Distinguish temporary 429 rate limit, project quota exhausted, expired/revoked key 401, missing model/scope 403, billing/credits denial, unsupported schema, custom gateway blocked, provider 5xx and timeout. Do not make a fabricated countdown or claim unlimited free API calls. Each error identifies the affected connection source, next safe action and whether a retry is permitted.
6. Explicit Base URL / Gateway URL field. Settings > BYOK offers provider-specific approved presets, provider-specific path/version/deployment fields, exact wire protocol selection (e.g., OpenAI Chat Completions, OpenAI Responses, Anthropic Messages or Gemini) and a tightly validated custom HTTPS gateway option. Do not treat arbitrary URLs as OpenAI-compatible, assume every provider uses /v1, or append fixed /chat/completions without protocol qualification. Bound timeouts, response sizes, redirects, schema depth, headers and retry budgets. No arbitrary secret-bearing URL queries or unconstrained header injection.
7. Server-side gateway SSRF protection. Validate HTTPS certificates and host/IP/port before dialing; reject private/link-local/reserved/loopback IPv4 and IPv6, encoded IPs, internal DNS and cloud metadata; block redirects or re-check every hop, and defend against DNS rebinding with connection-time address checks/approved egress. Credentials never pass through the browser or untrusted tools. A future local-device gateway requires a separate explicitly authorized companion-local transport; a Supabase function must not call private network addresses.
8. Per-source errors and isolation. BYOK health failures never mark an OCADE key unhealthy and vice versa; per-model cooldowns do not clear when a sibling succeeds. Different customer's key never appears in candidate selection, routing, analytics or health history. Two tenant accounts using the same vendor remain isolated even if endpoint/model names match. Revocation fences queued calls and rechecks active turns before the next model request.
9. No unapproved fallback. Default cross-credential-source failover is disabled. Within BYOK, other customer-owned keys are eligible only after explicit selection/permission and compatible region/provider terms. Changing to OCADE-managed requires informed approval about provider, data handling and any product charges; changing to BYOK requires approval about the customer's external provider fees. Model-switch reasoning may continue only after reconciliation; unknown desktop/browser effects are never repeated automatically.
10. Mandatory end-to-end test contract. With owner keys O1/O2, Alice BYOK A1/A2 and Bob BYOK B1, exhaust OCADE-managed quota while Alice runs concurrent BYOK Chat and JARVIS; assert zero owner-key network calls, unchanged owner inference quota/counters, unchanged Bob usage, truthful Alice 429/402/401 errors and safe partial outputs. Reverse the test for OCADE-managed Chat/JARVIS so no user key is used. Probe planner, specialist agents, verifier, summaries, recovery and model-switching; include 100+ dynamic key records, quota races, account deletion, leak scanning, malformed Base URL/SSRF, and STOP under outage. Show no false remaining-quota number. A fake-key pass is coding evidence, not a real provider quota guarantee.

Release requirement: Build the Settings UI, authenticated model gateway, secure Supabase credentials and these accounting/authorization checks; require full WEBSITE + companion mandatory CI GREEN on the identical candidate SHA. Documentation is NOT CODED, BUILDS or QUALIFIED proof.

### 14B.2. Offline Chat, local model, and website offline operation (code now; LAST benchmark suite later)

OWNER OFFLINE MODEL REPLACEMENT — MANDATORY STAGE 1 CODING (18 November 2026; NOT YET CODED OR BROWSER-QUALIFIED): The former Qwen offline model has been replaced as the selected release artifact by LFM2.5-VL-450M Q5_K_M (GGUF language weights: 260,377,632 bytes; Q8_0 vision projector: 102,815,168 bytes; combined download: 363,192,800 bytes / 363.19 MB). This is a text-and-image-capable model, but OCADE must not claim working offline image understanding until real browser testing proves it. The owner reports that both files are uploaded and independently SHA-256 verified in private Cloudflare R2 bucket `ocade-private-models` under `models/lfm25-vl-450m-q5/`; public access is disabled; Worker `ocade-web` has the `OCADE_MODELS` binding; GitHub Cloudflare secrets already exist; Supabase staging and production are healthy; and the old Qwen R2 object is deleted. Those are reported infrastructure facts, not proof of browser runtime, CI authentication or working product code. The current release manifest still points to the deleted Qwen artifact: correct this before allowing Offline Intelligence activation; never mark the replacement implemented, GREEN or release-ready from an upload alone.

Finish the entire replacement implementation now, before Stage 4's mandatory all-GREEN coding gate:
- Verify existing GitHub Actions Cloudflare authentication and the chosen browser runtime's compatibility with both the Q5 GGUF and Q8_0 vision projector; do not invent a supported runtime, checksum or file name. Update the existing release manifest with exact private object keys, sizes, verified SHA-256 digests, version and a requirement that both files pass integrity and compatibility checks before activation. No stale Qwen download or reasoning configuration may remain on the active offline path.
- Reuse the existing authenticated private R2/Worker delivery, downloader, service worker, OPFS cache and install/update architecture; finish one-click setup, resumable/range downloads, storage/RAM preflight, safe cancellation, retry, atomic two-file installation, corruption detection, rollback and recovery. Never create duplicate downloaders or weaken security, STOP, integrity or account boundaries.
- Implement genuinely local offline Chat using LFM and its vision projector, including image selection/upload, safe decoding and image understanding; ensure no hidden cloud fallback. Retain working WebGPU acceleration where compatible and reliable CPU/WASM fallback where technically supported; show honest unsupported-device/capability states rather than false success.
- Finish unit/integration, manifest/download/vision, failure/rollback and offline-state tests during coding; prove missing/corrupt projector, invalid hash, expired authorization, interrupted transfers, quota/storage limits, cancellation, cache eviction and runtime fallback are safe. Fix root causes without hardcoded responses, benchmark answers, selectors or device-specific shortcuts; rerun affected security, lint, type, build and regression checks until mandatory website + companion CI are fully GREEN on the same final SHA.
- After coding/security/debloat and the all-GREEN gate, retain the actual real-browser image-reading, performance, RAM/storage, desktop/mobile download and disconnected-use benchmarks for the final offline qualification suite in Stage 6, as already ordered below. Do not claim completion without evidence from real supported browsers. No Cloudflare resource modification or deployment without separate owner approval.

OFFLINE MODE CUSTOMER EXPERIENCE AND MULTI-ACCOUNT SECURITY — MANDATORY STAGE 1 CODING (18 November 2026; requirements, NOT implementation evidence):
- One-click offer; no network-type prompts. When online and not already prepared in this browser profile, offer Set up Offline Mode unobtrusively; accepting starts setup using any available permitted connection (Wi-Fi, cellular, tethering or Ethernet), with no separate network-type approval, metered-data dialog or repeated confirmation. Declining dismisses the offer without enabling a composer or silently starting setup; retain the explicit setup entry points in Settings and Offline Chat. Honor actual browser/OS security permissions and consent rules; do not bypass them.
- Strict state-driven Offline Chat UI. If Offline Mode is unprepared, never show an enabled Offline Chat composer. While online, show setup entry and an accessible, smooth animated loader only while real setup/check/repair work is running, with honest progress, pause/cancel/retry, error recovery and no indefinite spinner. If offline before the first successful setup, show “Connect to the internet once to set up Offline Mode.” with a clear pending state, not a false progress animation; automatically refresh the available setup action when connectivity returns. After verified preparation, hide every setup offer, enable the real composer immediately and keep it usable both online and offline; never silently switch that surface to a cloud model. Detect a missing or evicted component and return to the setup/repair state safely.
- One shared installation, isolated accounts. Store the verified runtime/artifacts once per same-origin browser profile, not once per OCADE account. Reuse them across sign-in, sign-out and switching accounts without repeating setup while intact; another browser/device/profile or site-data eviction may require new setup. Never share chat content, history, attachments, prompts, memory, drafts, task journals, receipts, authorization or queued work across accounts. Isolate Offline Chat, Online Chat AND JARVIS in every backend query, conversation key, cache, IndexedDB/OPFS namespace, local persistence, search, export, notification, background worker and cross-tab event. On logout/switch/revocation, lock the previous user's local data, clear decrypted/in-memory state and require legitimate per-account authorization for re-entry, including trusted offline session recovery. Keep the shared model code/files nonpersonal; never mistake shared artifacts for permission to access another account's data. Independently test user A → logout → user B → offline/online/reconnect → user A, multi-tab races, deletions and cross-tenant attacks.
- Settings-only removal, safe account deletion. Expose Remove Offline Mode only in OCADE Settings as the product's normal uninstall control, with a clear confirmation. Never present model removal inside the chat composer. An OCADE account deletion must erase that account's private local/remote chats, memory and tasks as authorized, but leave the shared Offline Mode installation in place by default. In the pre-deletion confirmation, provide an explicit, unchecked checkbox “Also remove Offline Mode from this browser”. When checked, explain that removal affects Offline Chat for all accounts using this browser profile, obtain confirmation and remove the shared offline artifacts after the account deletion flow can safely do so; never remove another account's chats. A website can control its own uninstall UI but cannot prevent a browser, device administrator or user from clearing site data externally; handle such removal honestly.
- Private and simple customer language. The entire customer-facing Offline Mode interface uses human terms “Offline Mode”, “Set up Offline Mode”, “Preparing Offline Mode”, “Offline Chat is ready”, “Remove Offline Mode”; never display “download”, model name/family, file names, component identity, byte/MB/GB amounts, artifact/cache sizes, or technical storage details, even in error text. Internally check available capacity, quota, RAM and eviction signals without showing their measurements. Only surface actionable generic messages such as “Not enough free space to set up Offline Mode” or “Your browser may clear offline files; setup may be needed again.” Explain failures truthfully without leaking internal metadata. Do not make a permanent-availability promise that contradicts browser eviction.
- Speed, resilience and proof. Reuse the single existing installer/delivery path for parallel transfer of both required artifacts, resumable verified chunks, efficient browser-local writes, atomic activation, corruption repair, WebGPU acceleration and supported CPU fallback. Optimize preparation latency without promising a sub-minute setup on every network/device or disabling hash verification. Add normal, failure, accessibility, offline/reconnect, account isolation, deletion-checkbox, network-type and cross-browser compatibility tests during coding; keep real disconnected desktop/mobile qualification last in Stage 6. Continue authorized general fixes until applicable security checks and whole-site/companion CI are GREEN on one exact commit, and never mistake mock passing for real-browser qualification.

1. First-time setup. Provide one-click Set up Offline Mode from Settings and the gated Offline Chat view, with a truthful animated preparation indicator and accessible progress/retry/STOP states. Internally transfer all required artifacts and website assets, check device compatibility and free capacity, verify integrity and manifest versions, and activate only after both model components are valid and a genuinely disconnected local self-test passes. Never expose the model name, weights, projector, model size, byte counts, file paths, cache/storage usage or the word “download” in customer-facing Offline Mode setup, progress, settings, errors, notifications or marketing. Keep technical names, byte counts and hashes in developer-only manifests/logs needed for integrity and audit.
2. Offline website. Use service-worker/app-shell caching and navigation fallback so the prepared OCADE website opens in supported Chrome/Edge and Android browsers with Wi-Fi and mobile data disabled. Handle refresh/reopen, signed-out behavior, cache corruption, browser storage eviction, update rollback and insufficient quota; never promise offline reliability without a tested support matrix.
3. Local inference. Run the installed model on the customer device through supported WASM/WebGPU or other approved on-device runtime as capability allows; never pretend that cloud API calls are local. Preserve private local history, STOP, data delete and no-network verification, including actual runtime failure messages.
4. Connectivity isolation. With no internet: lock cloud-dependent Online Chat and cloud JARVIS accurately; allow functioning offline Chat after complete first-time setup; avoid confusing failed connectivity checks with claims of a successful offline model download. On reconnect, update state without duplicating/losing local chat.
5. Cross-device scope. Test Windows 10/11 Chrome/Edge, macOS supported browsers, Android Chrome/airplane mode and relevant iOS/Safari constraints only when supported. Do not infer functionality from an emulator alone; real-device checks are release evidence.
6. Test ordering: All offline-mode code must be finished and locally regression-tested before the full-site green gate; the actual model-download, internet-disconnection, offline-site reopen and local inference benchmark suite runs LAST, after JARVIS and online Chat benchmark campaigns. A failure reopens coding, reestablishes complete green CI on the new SHA, then reruns the affected suite. Treat unavailable real-device permissions as explicit blockers, not passes.

### 14B.3. Settings customization and truthful task progress

1. Settings: complete theme (dark/light/system), restrained colors, contrast, type size, language where supported, accessibility and reduced-motion preferences, model selection/availability, a sixth dedicated BYOK Settings category and secure Gateway URL/key manager (Part 14B.1A), device management, app connections, task permissions, account/profile, data export/deletion, local offline model/storage and troubleshooting. Each setting must persist appropriately, survive reload and enforce access boundaries.
2. Normal customer language: During active tasks show human descriptions such as “Checking files”, “Preparing workbook”, “Waiting for permission”, “Verifying output”, “Stopped safely”. Never expose internal source filenames such as `jarvis.py`, `planner.server.ts`, a Git commit, stack trace, token, provider-secret slot, internal URL or raw tool identifier in ordinary customer progress/watermark text. Keep a separate permission-controlled redacted diagnostic view for developer troubleshooting. Do not conceal that an AI/companion is controlling the PC; keep clear STOP and activity visibility.
3. Brand colors: apply a coherent near-black/graphite visual system with electric cobalt and forest-green accents only where legible and useful. Verify light/dark contrast and semantic status colors. Real task completion and permissions take precedence over decorative design.
4. Page and control audit: every route, menu, setting, button, modal, link, account state, device connection and chat task must have implemented behavior, testable outcome and truthful failure/recovery state; no fake demos or placeholder links presented as working.

### 14B.4. Mandatory UX principles applied to the ENTIRE site (34 distinct principles, deduplicated)

For every UX ID, include a relevant accessible screen/interaction test and a reasoned exception where the rule does not apply.

The owner demands that every named law be considered across all applicable screens. Treat 100% as full audit coverage and justified application, not the impossible assertion that every heuristic must appear in every component or that Doherty's 400 ms always includes network inference. For each principle, map relevant pages and actions to implemented design decisions, capture accessibility/usability tests and document nonapplicability. Related principles must not generate duplicate UI components.

1. UX-01 — Aesthetic-Usability Effect. Use a deliberate visual hierarchy, accessible contrast and coherent polish; test that users can still find real controls quickly. Premium visual quality cannot disguise broken task controls; maintain distinct emphasis for primary actions, STOP and evidence.
1. UX-02 — Choice Overload. Remove simultaneous competing choices; provide a primary action, then secondary paths only when needed. Offer one default next step for first-time visitors and progressively expose optional models, permissions and integrations.
1. UX-03 — Chunking. Group long settings, permissions and task details into meaningful labeled sections. Group settings, task details, logs and permissions into short labeled panels with clear location and search.
1. UX-04 — Cognitive Bias. Use neutral truthful labels for speed, success, safety and pricing; do not manipulate decisions with misleading defaults. Use neutral consent, quota, price, progress, and AI reliability wording; forbid dark patterns and deceptive defaults.
1. UX-05 — Cognitive Load. Keep the active task screen limited to current goal, next action, progress and intervention. Display the next meaningful task action, current agent/work, blocker and outcome; hide unnecessary implementation clutter.
1. UX-06 — Doherty Threshold. Target perceptible feedback within 400 ms where feasible; differentiate UI acknowledgment from actual AI/desktop completion. Give quick honest interaction acknowledgment and accurate pending/success/error state; never fake model or task completion speed.
1. UX-07 — Fitts's Law. Make primary mobile and desktop controls easy to reach and large enough for reliable interaction. Make composer magic icon, @ picker, file selection, approval, STOP and dialog close usable by mouse, touch and keyboard.
1. UX-08 — Flow. Minimize interruption during safe authorized work and offer actionable status instead of intrusive popups. Allow uninterrupted permitted work, transparent background progress and nonintrusive status; interrupt only for real permission/safety needs.
1. UX-09 — Goal-Gradient Effect. Show truthful verified milestone completion rather than a fabricated progress percentage. Show verified milestones and accurate file/transfer receipts, not invented percent-complete indicators.
1. UX-10 — Hick's Law. Reduce options on model, settings and device pages through grouping and progressive disclosure. Use searchable compact choice sets for plugins, devices, accounts, models, files and Settings; hide advanced options until needed.
1. UX-11 — Jakob's Law. Use familiar login, navigation, file upload, task status and settings conventions. Keep familiar patterns for sign-in, menus, resource mentions, attachment and file dialogs, account linking and status.
1. UX-12 — Law of Common Region. Use consistent visible boundaries around related controls, receipts and permission data. Visually group the authenticated user, private memory, selected project and associated credentials/resources to prevent confusion.
1. UX-13 — Law of Proximity. Place labels, validation errors and actions close to their associated inputs. Place validation, source/provider billing, errors and permission consequences adjacent to the exact affected control.
1. UX-14 — Law of Prägnanz. Favor clear simple shapes and layout rather than unnecessary visual complexity. Prefer simple geometries, readable spacing and clear relationships instead of decorative effects that obscure work.
1. UX-15 — Law of Similarity. Use consistent iconography, sizes, labels and button treatments for comparable actions. Use uniform icon weight, typography, states, button styling, titles and permission labels across Chat, JARVIS and utilities.
1. UX-16 — Law of Uniform Connectedness. Visually connect related task steps and files with clear relationships. Connect dependent agent tasks, source artifacts, review results and version changes visually without false linkages.
1. UX-17 — Mental Model. Match what customers expect from a safe computer assistant: instruct, authorize, monitor, stop, verify. Match real customer expectations: ask, inspect scope, approve, execute, monitor, stop and independently verify.
1. UX-18 — Miller's Law. Use chunking and search instead of forcing users to remember long lists of controls. Keep context visible and options searchable, especially when account, browser or resource inventories are large.
1. UX-19 — Occam's Razor. Prefer the smallest coherent interaction that solves the user problem without duplicate controls. Remove duplicate navigation/routes, model selectors, memory stores, animation systems and capability indexes.
1. UX-20 — Paradox of the Active User. Allow first-task completion without reading a manual; use concise just-in-time guidance. Let the first user finish a safe genuine task without reading instructions or configuring every provider.
1. UX-21 — Pareto Principle. Measure and fix the top user errors and bottlenecks first rather than indiscriminately adding features. Prioritize fixes based on observed first-task failures, drop-offs, leaks, slowdowns, incorrect results and repeated support questions.
1. UX-22 — Parkinson's Law. Bound open-ended setup and task workflows by verifiable steps and sensible safe deadlines. Bound open-ended onboarding and working loops by truthful stages, clear time/usage limits and safe cancellation.
1. UX-23 — Peak-End Rule. Make the final verified deliverable and recovery experience trustworthy, not just the initial animation. Make verified results, editable artifacts, corrections and transparent costs the strongest ending of the experience.
1. UX-24 — Postel's Law. Accept reasonable user input variability while validating and emitting strict safe actions. Accept varied ordinary prompts, typos and mixed languages while validating typed commands and all privileged effects strictly.
1. UX-25 — Selective Attention. Keep urgent STOP and approval controls distinct from optional notifications. Keep STOP, errors needing approval and security warnings prominent; mute marketing and optional alerts during consequential work.
1. UX-26 — Serial Position Effect. Place essential actions and outcome summaries at prominent first/last positions where helpful. Position essential context, current selection and final outcome where they are easiest to find in a workflow.
1. UX-27 — Tesler's Law. Handle unavoidable configuration complexity internally but do not conceal consequential permission choices. Hide irreducible configuration work inside safe defaults, but require informed choice for access, funding, privacy and irreversible effects.
1. UX-28 — Von Restorff Effect. Use restrained distinctive emphasis only for genuinely important controls such as STOP or warning. Reserve distinctive color/emphasis for genuinely important alerts, current active control and core action; no decorative badge inflation.
1. UX-29 — Working Memory. Preserve context, previous selections and task history so users need not remember transient state. Preserve authenticated user's own active resource selection, prompt draft, task checkpoint and correction history across navigations.
1. UX-30 — Zeigarnik Effect. Clearly distinguish incomplete, interrupted and completed tasks; provide safe resumption. Clearly show incomplete, paused, uncertain and finished tasks; enable safe resume without replay of unknown effects.
1. UX-31 — Visual Hierarchy. Prioritize one clear H1, one primary CTA, meaningful contrast and predictable reading order.
1. UX-32 — Progressive Disclosure. Keep advanced models, integrations, logs and settings accessible without overwhelming newcomers.
1. UX-33 — Recognition over Recall. Expose recent tasks, known devices and file selections instead of requiring names or commands from memory.
1. UX-34 — Feedback Loops. Every request and state transition gets clear success, error, progress and recovery feedback with honest timing.

### 14B.4A. UX-lawmapping score and independent page-specific verification (15 November 2026)

Audit status: DOCUMENTATION ONLY, not design or real-user test evidence. The first 30 listed items, UX-01 through UX-30, cover the 30 principles requested by the owner. The current plan additionally includes UX-31 through UX-34 (34 total). The law names and suitable generic application advice are present; however, the shared requirement for accessible screen/interaction tests is not proof of actual UX quality, and one principle cannot sensibly apply to every component. The authoritative Settings code currently displays five categories; the sixth BYOK category is required but not yet implemented, so no tested BYOK UX success can be claimed.

Measurement rule: Per UX ID and relevant route, record actual application decision, screen/device, feature state, accessibility check, task-level usability success/error, negative case, source SHA and supporting screenshot/trace, with explicit nonapplicability when appropriate. Route-level coverage = verified applicable ID/route pairs divided by all required applicable pairs, not "34 items written / 34". Keep severity-weighted security and usability blockers separate from average satisfaction.

1. Critical JARVIS usability (UX-05,07,08,09,17,23,25,28,30,34). STOP must be visible and accessible in any active execution; permissions and Take Over must show exact target, effect and whether the action is reversible. Recovery displays "unknown effect" accurately, never falsely "completed". Prove user comprehension of paused/running/completed and measure actual STOP confirmation rather than animated progress.
2. BYOK limits, billing and gateway clarity (UX-02,03,04,10,11,13,24,27,32,33,34). Show a simple provider preset first; reveal advanced Base URL, wire protocol, account/deployment/region only if needed. Prominently distinguish "OCADE-managed" from "Your API key", who gets billed by the model provider, what OCADE fees still apply, approved model and Chat/JARVIS use. Label unavailable quota numbers unknown; show honest source-specific 401/402/403/429/5xx, retry eligibility, reset time only when reported, and a focusable error beside the field/task. Verify with fresh testers who must identify who pays and what source is selected.
3. Time-to-first-verified-value (UX-01,06,11,18,20,21,23,26,31,32). Minimize new-customer choices, offer a real safe first task, avoid mandatory Docker/VM, explain when companion installation is necessary and measure abandonment, verified first-task success and repeat use. Doherty's 400ms concerns perceptible UI acknowledgment when technically feasible; do not promise task or model completion within that time.
4. Visual consistency and accessibility (UX-12,14,15,16,19,22,29,31,33). Review real long-form approvals, long errors, large account names and gateway URLs across desktop/mobile; meet documented WCAG 2.2 AA criteria where applicable, preserve keyboard focus, screen-reader live announcements, touch targets and reduced motion. Test corrupt/expired connection, offline model, unsupported protocol, storage quota and lost network, not only happy-path screenshots.
5. Evidence vs score. Score documentation completeness separately from implemented component usability and genuine tests. Initial document-only expert opinion: coverage 34/34 named, implementation/test completion UNVERIFIED; do not convert a named-law checklist into claimed 100% UX implementation. Capture five consented first-use formative interviews as qualitative insights, and require independent reproduction before any 100% release gate.
6. De-duplication. Group laws with the same concrete design intervention rather than shipping 34 new widgets. For instance, choice overload/Hick/Progressive Disclosure share one BYOK preset-versus-advanced design; focus and recognition laws share one accurate user-journey design. Different behaviors must remain testable with their own evidence. Do not create extra navigational layers when the existing Settings panel suffices.

### 14B.5. Exactly 16 API-key and credential protection checks

For every KEY ID, run positive and negative secret-exposure checks in CI/staging; never print the secret.

1. KEY-01 — Environment storage. Keep server-only API keys in approved environment/secret managers; never assume generic .env is sufficient protection.
1. KEY-02 — Ignore local .env. Exclude secret-bearing local env files from Git and distribution; scan tracked overrides.
1. KEY-03 — No secret in frontend. Move provider API calls containing secrets behind authenticated backend boundaries.
1. KEY-04 — Public variable audit. Enumerate public prefixed variables and verify none contain credentials.
1. KEY-05 — Supabase service-role protection. Never place a service role token in browser bundles, reports or public storage.
1. KEY-06 — Git history scanning. Scan relevant history, commits and artifacts for leaked credentials, including old revisions.
1. KEY-07 — Incident key rotation. Revoke and replace any confirmed exposed key; do not rotate unrelated keys without explicit authorization.
1. KEY-08 — Repository secret scanning. Enable available automated scanning and blocking at code review and CI.
1. KEY-09 — Host-managed storage. Provision secrets in authorized Supabase/GitHub/hosting dashboards, with separation of duties.
1. KEY-10 — Least-privilege scopes. Restrict each key by provider permissions, project, audience and resources.
1. KEY-11 — Backend proxy. Enforce authenticated, scoped, audited server access to provider APIs.
1. KEY-12 — Screenshots and demos. Scan images, videos, developer outputs and public examples for keys and private data.
1. KEY-13 — Redacted logs. Prevent secrets in task journals, errors, traces, analytics and observability.
1. KEY-14 — Environment isolation. Use different authorized key sets for development/staging/production.
1. KEY-15 — Cost limits. Set provider usage and spending ceilings with clear failure states and legal quotas.
1. KEY-16 — No credentials in chat. Never ask users/agents to paste privileged keys into chat messages or AI prompts.

### 14B.6. Exactly 19 SaaS/backend security hardening checks

For every SEC ID, run automated negative-access, misuse and regression checks with evidence.

1. SEC-01 — Row-level security. Verify database owner/tenant isolation for tables, storage and tasks with authenticated negative tests.
1. SEC-02 — Authentication on routes. Every sensitive API and Edge Function checks session and effective authorization, including admin operations.
1. SEC-03 — Never trust frontend. Validate roles, scopes, prices and permissions in trusted services regardless of UI validation.
1. SEC-04 — Rate limiting. Apply fair per-user/provider quotas and anti-abuse controls; do not circumvent provider limits.
1. SEC-05 — Input validation. Validate/sanitize untrusted inputs by context; protect prompt and command boundaries.
1. SEC-06 — Parameterized queries. Use bound parameters and eliminate unsafe SQL string interpolation.
1. SEC-07 — Restrictive CORS. Allow only intended origins/methods/headers and prevent credential reflection.
1. SEC-08 — TLS everywhere. Use HTTPS/WSS with secure cookies and correct forwarded-proxy handling.
1. SEC-09 — IDOR defense. Test every resource ID against server-side ownership and delegated access.
1. SEC-10 — No production debug exposure. Disable public debug routes, verbose stack traces and unprotected diagnostics.
1. SEC-11 — Bot protection when applicable. Use accessible bot-abuse defenses on public forms, without CAPTCHA on every page.
1. SEC-12 — Admin action auditing. Record privileged changes with tenant, actor, reason and tamper-evident evidence where feasible.
1. SEC-13 — Private storage. Secure bucket/object policies, signed URLs, deletion and file exposure rules.
1. SEC-14 — Server enforced admin authorization. Hiding an admin page is not protection; enforce server-side role checks.
1. SEC-15 — Dependency hygiene. Audit vulnerable packages, pin risk-sensitive dependencies and apply tested upgrades.
1. SEC-16 — File upload protection. Verify file type, size, content, path, scanning and processing limits.
1. SEC-17 — Independent security review. Run static scans, dynamic checks and adversarial tests; an AI-only review is not sufficient.
1. SEC-18 — HTTP security headers. Set appropriate CSP, HSTS, frame, MIME, referrer and permissions protections.
1. SEC-19 — Webhook signatures. Verify signatures and replay/idempotency for any external events used by OCADE.

### 14B.7. Consolidated web-design, conversion, launch and anti-template checks (duplicate user lists merged)

For every DESIGN ID, verify the affected page(s), responsive screens, keyboard/touch flows, loading/error states and real contents.

The original design checklists repeat some 30-item and 20-item lists verbatim. This group intentionally deduplicates them rather than treating repeated advice as extra engineering tasks. Visual clichés (Lucide icons, cards, Inter, dark colors, borders, emoji) are risk indicators only in context—not blanket bans, because inappropriate removal can reduce usability or accessibility. Every below item requires a grounded code/design defect before changing it.

1. DESIGN-01 — Brand and color system. Keep a restrained midnight/graphite base, forest-green and electric-cobalt accents where suitable. Audit low contrast, harsh gradients, neon rainbow combinations and confusing status colors; customize via tokens. Do not ban an icon or typeface merely because it is fashionable.
1. DESIGN-02 — Typography and spacing. Choose a coherent legible font family/pair, consistent line-height, measured whitespace, aligned grids, strong hierarchy, concise paragraphs and consistent radii; test at real desktop/mobile sizes.
1. DESIGN-03 — Avoid template clichés. Audit generic triple-card hero sections, repetitive bento grids, random gradient text, rainbow highlights, generic buzzwords, fake terminal mocks, decorative left stripes, radial orbs, dot grids, glassmorphism, grain and sparkle effects. Remove only when they hurt clarity, originality, performance or accessibility.
1. DESIGN-04 — Responsible motion. Use meaningful transitions, skeleton loaders for genuine delays and responsive hover/focus states; avoid unnecessary scroll-fade, cursor-following animations, perpetual arrows and misleading progress. Respect reduced-motion settings.
1. DESIGN-05 — Honest product evidence. Use real demonstrations, verified customer stories only with permission, authentic screenshots, clear service descriptions and no fabricated reviews, fake scarcity timers, false guarantees, hidden fees or unsupported achievements.
1. DESIGN-06 — Navigation and customer orientation. Provide tested header/footer, simple menu, responsive drawer, clickable logo, clear CTA per step, accessible site search where useful, meaningful back-to-top/scroll position, working contact links, no dead navigation or placeholder text.
1. DESIGN-07 — Responsive and accessible operation. Eliminate horizontal overflow, tiny tap targets, inaccessible dialogs, unreadable dark mode, weak color contrast and inconsistent mobile states. Provide keyboard/focus order, skip-to-content, alt text and usable touch interfaces.
1. DESIGN-08 — Form correctness. Implement explicit required fields, inline validation, password visibility, safe autofill, password recovery, meaningful errors, loading, success/confirmation dialogs and appropriate bot resistance.
1. DESIGN-09 — Meta and discovery hygiene. Correct page titles, descriptions, favicon, copyright year, canonical and social link preview, sitemap, robots, legitimate analytics and search-index controls for public pages only; avoid indexing private task files.
1. DESIGN-10 — Content and conversion clarity. Explain the exact audience, result, differentiator, privacy implications and realistic first action. Resolve objections in Help/FAQ; keep contact forms minimal, support routes visible and normal response expectations honest.
1. DESIGN-11 — Performance and media. Compress images without visible degradation, verify responsive loading, use skeletons rather than fake content, minimize font and bundle cost, measure typical page loads and first interaction; no universal unsupported guaranteed load time.
1. DESIGN-12 — Account and help journeys. Test landing → register → confirm eligibility → settings → connect device → first task → progress → deliverable → history → disconnect → data export/deletion, plus help, FAQ, errors and account recovery.
1. DESIGN-13 — Customer disclosure and policy. In-site detailed Terms/Conditions, Privacy, Cookie policy/consent, computer-control permissions, data retention/deletion, Help and FAQ with revision date, accessible long-form dialogs and separate route links. Refund policy only if payment flows actually exist; legal text requires qualified review before public launch.
1. DESIGN-14 — Optional micro-features. Apply dark/light toggle, copy, back-to-top, print stylesheet, sticky header, scroll progress, contact widget, optional WhatsApp, domain email and UTM tracking only if real customer use justifies them and they do not clutter the UI.

### 14B.8. Full customer lifecycle, help, policy and support completion

1. Lifecycle: first visit, onboarding, signup/login, secure password recovery, optional supported social login, pairing a Windows/macOS companion, permission grants, authorized task progress, STOP/Take Over, recovery, independent files, history, model and device settings, help, contact, data export/delete and account closure. Cover unauthorized and failure cases. No user is forced to install Docker/VM on their computer.
2. Support and FAQ: searchable, versioned, accessible Help and FAQ with installation, permissions, trusted device pairing, supported models, cost/usage disclosure, offline setup, failed tasks, model unavailability, contact and removal instructions. In-site long-form terms/privacy dialogs must also have accessible routes, full text, scroll/focus management and versioned consent. Qualified review is required for binding policy claims.
3. Commercial optionality: payments, refunds and billing must not be represented as working unless independently implemented and test-mode qualified; do not silently authorize paid services or live payment activation. Clarify nonbilling scope where owner approval is outstanding.
4. Asset integrity and provenance: no unlicensed stock, fabricated testimonials, misleading performance claims or borrowed copyrighted assets; check attribution and reproducible build assets. Official icon systems may be reused but styled deliberately.
5. Public site health: responsive Chrome/Edge/Safari checks, protected pages access checks, HTTPS, CSP, genuine privacy controls, metadata and link previews, search indexing of public-only routes, correct contact methods, backup drill, meaningful 404/500, safe robots rules, page speed and mobile performance measurement. Optional WhatsApp/chat widget only if actually supported and useful.

### 14B.9. Debloating and implementation proof — preserved contract located in Stage 3

Navigation only: The full original 14B.9 requirements are executed in Stage 3.1, after the Stage 2 threat-remediation gate. This pointer does NOT claim the debloat work has passed or permit early benchmarks.

## Part 14C. Consolidated elite architecture: 8 engineering + 8 differentiators + 10 owner upgrades + 12 verification upgrades (15 November 2026)

38 trace entries, not 38 new subsystems or a claim of implementation. Record every entry in one readiness ledger with existing module owner, source, priority, permission model, tests, performance/cost evidence and status. Deduplicate overlapping ideas at implementation time: there is ONE task controller, ONE permission authority, ONE privileged secret registry, ONE AI gateway, ONE verifier and ONE source-bound usage ledger. The four sets are preserved separately for traceability; cross-references to existing 72 repository lessons, 84 concepts and 266 requirement IDs must prevent double counting. First protect BYOK/OCADE noninterference, wrong-target safety, STOP and unknown effects; then optimize model calls, verified output, UX and actual business margin.

### 14C.1. Eight elite engineering improvements (ELITE-01 to ELITE-08)

- ELITE-01 | P0 | Verified Outcome Contracts. Capture approved artifact/output schema, exact preconditions, irreversible effects and independent acceptance oracle before executing; reject completion without receipt. Acceptance: Wrong totals or missing files cannot settle as completed.
- ELITE-02 | P0 | Deterministic Workflow Compiler. Compile repeated verified recipes into parameterized native/file/DOM execution with postcondition guards, semantic version checks and STOP fencing. Acceptance: Held-out repeated workflows use fewer model calls without reducing verified success.
- ELITE-03 | P0 | Cost-Aware Model Router. Choose authorized qualified model by observed cost per verified task, latency, capability and risk, honoring immutable BYOK/OCADE source. Acceptance: No cross-source inference call and lower cost at equal success on matched tasks.
- ELITE-04 | P1 | Customer ProofPack. Return editable deliverable with redacted source/changed-file hashes, discrepancies, verified checks, time and unresolved exceptions. Acceptance: Proof summary agrees with independent verifier and contains no secrets.
- ELITE-05 | P1 | Certified Workflow Library. Version, test, expire and revert successful customer-authorized workflows; preserve user edits and do not memorize raw selectors/secrets. Acceptance: Cross-file regression and changed-app tests prevent harmful replay.
- ELITE-06 | P1 | Business Workspaces and Approvals. Use existing organization/permission schema for client isolation, maker/checker approval, scoped sharing and activity. Acceptance: Unauthorized worker cannot read or approve another client's result.
- ELITE-07 | P0 | Continuous Fault and Recovery Testing. Inject crashed agent, interrupted write, network outage, stale UI target and quota exhaustion with documented recovery fixtures. Acceptance: Unknown effect never repeats automatically and STOP always fences new actions.
- ELITE-08 | P0 | Contribution-Margin Optimizer. Measure full cost per verified result including model, provider, infrastructure, retry, support, verification, refunds and revenue. Acceptance: Shared budgets and per-workflow margin remain truthful when tasks fail.

### 14C.2. Eight defensible commercial differentiators (MOAT-01 to MOAT-08)

- MOAT-01 | P0 | Accountant Reconciliation Beachhead. Target one tested spreadsheet reconciliation, exception list and editable client report before launching broad feature catalog. Acceptance: Five consenting design partners demonstrate repeat use and correctness.
- MOAT-02 | P1 | Vertical Outcome Packs. Sell narrowly specified verified workflows and supported formats to accountants and service firms. Acceptance: Each pack documents scope, acceptance, errors, version and limitations.
- MOAT-03 | P1 | Evidence-Led Marketing. Publish only reproducible redacted before/after demonstrations and permissioned customer examples. Acceptance: Marketing claims match real tested outcomes and selected comparison conditions.
- MOAT-04 | P1 | BYOK-Compatible Paid Value. Charge for orchestration, deliverables, approvals, support and templates independently of which provider funds tokens. Acceptance: BYOK external charge and OCADE product charge shown separately; positive margin measured.
- MOAT-05 | P1 | Permissioned Recurring Work. Allow schedule only with fresh bounded permission, one occurrence claim and explicit revocation. Acceptance: Duplicate triggers cannot cause two business-side mutations.
- MOAT-06 | P1 | Five-Minute First-Value Journey. Offer a simple truthful onboarding flow and first verified local or cloud task; install companion only when required. Acceptance: Measure fresh-user setup time, success and drop-off rather than promise a universal duration.
- MOAT-07 | P1 | Fair Competitive Proof Scoreboard. Compare equivalent apps, budgets and task oracles against each repository/product with uncertainty. Acceptance: No unsupported beat-everyone claim; original failures remain included.
- MOAT-08 | P2 | Accountant and Agency Distribution. Pilot consent-based referrals and team/agency workflows before paid growth channels. Acceptance: Measure paid activation, retention, acquisition cost and account isolation.

### 14C.3. Ten owner universal-model improvements (OWNER-01 to OWNER-10)

- OWNER-01 | P0 | Universal Model Gateway. Register protocol adapters, compatible endpoints and approved models without changing the central JARVIS planner. Acceptance: A newly authorized provider passes contract tests with no central-code rewrite.
- OWNER-02 | P0 | 100+ Dynamic API Keys. Replace three static Gemini slots with secure Supabase owner registry and tenant-scoped BYOK refs. Acceptance: At least 100 fake keys concurrently stored/selected/revoked with no redeployment.
- OWNER-03 | P0 | Intelligent Limit Detection. Classify 401/403/402/429/5xx, project quota vs model rate, reset and billing separately. Acceptance: Correct provider-specific wait, replacement or refusal with no fabricated quota.
- OWNER-04 | P0 | Model Capability Registry. Record tool calls, schema, vision, reasoning, streaming, context, cost and residency per adapter/model. Acceptance: Unsupported model cannot silently run a restricted JARVIS tool.
- OWNER-05 | P0 | Bounded Multi-Agent Coordinator. Delegate independent reasoning with budgets and capability guards while preserving one PC mutation authority. Acceptance: Solo-versus-delegated outcomes and overhead recorded; cancellation propagates.
- OWNER-06 | P0 | Safe Model Switching. Preserve selected credential source, privacy, journal and effect state across any authorized model handoff. Acceptance: No unknown external effect is replayed, including under failover.
- OWNER-07 | P1 | Measured Intelligent Routing. Calibrate success, context requirement and latency per task family using held-out tests. Acceptance: Cheaper/stronger model chosen only when objective results justify it.
- OWNER-08 | P0 | Persistent Multi-Hour Checkpoints. Persist goals, DAG progress, permission epochs, outputs, job state and verified receipts. Acceptance: Resume after sleep/crash only after re-observation and authorization.
- OWNER-09 | P0 | Distributed Reliability and Quotas. Use atomic per-account/project reservations, fair concurrency and bounded backoff across server instances. Acceptance: 100 concurrent simulated requests do not overbook any shared allowance.
- OWNER-10 | P0 | Universal Integration Tests. Test 100 keys, provider adapters, malicious base URLs, rate errors, tenant isolation and source funding. Acceptance: Full website, server and companion CI green on one commit before benchmarks.

### 14C.4. Twelve verification-first engineering improvements (VERIFY-01 to VERIFY-12)

- VERIFY-01 | P0 | Proof-Carrying Execution. Bind each side effect to grant, user, device, target, state, STOP epoch and independent outcome receipt. Acceptance: Forged, stale, wrong-window or wrong-user receipt rejected.
- VERIFY-02 | P0 | External-Effect Reconciliation. When send/save/submit is uncertain, inspect the target; use compensating action only if safe, approved and verifiable. Acceptance: A lost acknowledgement never causes duplicate submission.
- VERIFY-03 | P0 | Universal PC Capability Broker. One typed interface prefers native object/file API then scripts, DOM, accessibility and capture-bound vision. Acceptance: Same task completes by safe fastest supported route with one authority.
- VERIFY-04 | P0 | Production Multi-Model Orchestration. Maintain source, provider, quota group, region, model qualification and cost in all agent subcalls. Acceptance: BYOK task consumes zero OCADE-funded inference, even for helper models.
- VERIFY-05 | P0 | Workflow Compilation and Replay. Parameterize successful execution with pre/postconditions and invalidate stale app states. Acceptance: Repeat task outcome equals independent baseline across new inputs.
- VERIFY-06 | P0 | Domain-Specific Verifier. Check workbook formulas/totals, editable documents, browser postconditions, software tests and creative formats. Acceptance: Existing but incorrect file remains failed; no fictitious success.
- VERIFY-07 | P1 | Failure Replay Laboratory. Store redacted fixtures, capability versions, event order and failure outcomes for replay without real credentials. Acceptance: Injected failure reproducible with same seed and no customer data leakage.
- VERIFY-08 | P0 | Adversarial Resilience. Test prompt injection, cross-tenant access, SSRF, credential escape, stale clicks and cancellation races. Acceptance: Untrusted data cannot grant permissions or trigger an unsafe effect.
- VERIFY-09 | P1 | Model Drift Protection. Shadow-qualify changed model endpoints, schema and privacy terms before enabling new route. Acceptance: Incompatible provider change disables unsafe candidate cleanly.
- VERIFY-10 | P0 | Transactional Take Over and Resume. Fence old controller, let user edit, then reobserve and validate new lease/permissions. Acceptance: Late old agent cannot overwrite human work.
- VERIFY-11 | P1 | Evidence-Gated Releases. Canary and rollback under owner approvals, exact SHA/CI/test evidence and verified data restoration. Acceptance: Rollback drill succeeds without unauthorized deploy.
- VERIFY-12 | P1 | Matched Independent Benchmarks. Report reproducible first-attempt success, p95 time, unsafe acts, user interventions and full unit cost. Acceptance: No universal 100% superiority assertion without matched data.

### 14C.5. Merge into existing OCADE code owners; no duplicate engines

- Single task authority and journal: ELITE-01/07, OWNER-05/06/08, VERIFY-01/02/08/10 and MOAT-05 extend existing planner, supervisor, permission grant, STOP/cancel, local journals and receipt validation, not a new executor.
- One AI gateway and Supabase secret/usage boundary: ELITE-03/08, OWNER-01/02/03/04/07/09/10, VERIFY-04/09 and MOAT-04 extend existing edge-handler, model-adapter, quota and budget owners. Part 14B.1B is a strict precondition. No BYOK request may use owner-funded inference keys anywhere in its call graph.
- One native-first computer control stack: ELITE-02, VERIFY-03/05, CUA capture-bound target checks and UFO dependency-aware resource leases must flow through existing PC companion, tool contracts and server task authority.
- One independent verifier, receipt and Library: ELITE-01/04, VERIFY-06 and MOAT-01/02/03 share output-specific acceptance oracles; a model writing a proof summary cannot self-certify it.
- Existing task precedents and schedules: ELITE-02/05, OWNER-05/08 and MOAT-05 use versioned and sandbox-tested recipes without hardcoded app or customer identifiers.
- Existing Settings, Chat, JARVIS and organization rights: ELITE-06 and MOAT-04/06 require an actual sixth BYOK Settings category, clear source/limit states, controlled approval and honest payment disclosure.
- Existing CI, telemetry and release gates: ELITE-07/08, MOAT-07, OWNER-10 and VERIFY-07/08/09/11/12 use deterministic fixture replay, stress tests, redacted traces and date/commit-qualified results; no false green checks or staged mocks presented as real-world passes.
- Commercial rollout: MOAT-01 through MOAT-08 remain experiments tied to observed recurring value, support load and positive contribution; no paid launch or communications without approval and applicable legal readiness.

### 14C.6. Five competitor source implementations: extra mechanisms to adopt, not wholesale engines

1. Hermes Agent. Main-branch files agent/credential_pool.py, hermes_cli/runtime_provider.py, hermes_cli/checkpoints.py. Source patterns: persistent credential health states including permanently dead vs temporarily exhausted, classification-aware/reset-aware cooldown, per-model failure scope, careful refresh persistence, bounded selection and checkpoint cleanup. Adopt in a secure Supabase multi-tenant registry only after testing; never equate different keys with independent project quota. https://github.com/NousResearch/hermes-agent
2. OpenClaw. Main-branch src/agents/auth-profiles/order.ts, usage-state.ts, credential-state.ts, advance.ts. Source patterns: auth-profile eligibility, explicit provider matching, OAuth refresh fencing, model-scoped cooldown versus provider-wide billing blocks, candidate advancement and reason-coded diagnostics. Adapt to strict user-versus-owner funding pool isolation and consent; do not copy unrestricted fallback behavior. https://github.com/openclaw/openclaw
3. CUA. Main-branch libs/cua-driver/README.md and docs/perception-extension.md. Source patterns: versioned typed desktop/MCP driver, background accessibility where supported, capture/snapshot identity on visual targets, stale-capture refusal and reobservation. Review licensing, especially optional AGPL perception assets, before considering code reuse; never force Docker/VM on customers. https://github.com/trycua/cua
4. UFO³. Main-branch galaxy/README.md, galaxy/constellation/__init__.py, ufo/llm/base.py. Source patterns: dependency-checked typed DAG nodes, bounded dynamic graph edits, capability-based agent/device placement, safe asynchronous locks and provider-specific model adapters. Keep original OCADE authoritative task graph and forbid permissions or funding-source expansion during DAG rewrites. https://github.com/microsoft/UFO
5. Nod. Main-branch src/ports/models.ts, src/providers/pi/models.ts and src/providers/pi/checkpoint.ts. Source patterns: provider-specific credential/endpoint types, dynamic model catalogs, request cost reserve/settle contract, model capability deviations and fail-closed corrupt session checkpoint handling. Reuse trust boundary and UI principle without porting its entire agent runtime. https://github.com/n8n-io/nod
6. All source adoptions: Record source URL/path, inspected revision, exact licensed scope, threat model, proof and rollback in existing REPO-01..72 ledger; no claim of reading every file in all five and no source code automatically assumed compatible.

### 14C.7. Additional elite strategies beyond the 38 (commercially justified; not an excuse for feature bloat)

1. STRAT-01 | P0 | Cost-to-verified-success admission. Predict and reserve a bounded per-task spend allowance including delegated/verification calls before work starts; cut off or explicitly ask for approval if exhausted. Accept: shared atomic budget is never exceeded under 100 concurrent simulations.
2. STRAT-02 | P0 | Calibrated uncertainty and human escalation. When the verifier cannot determine whether an irreversible effect happened, explain uncertainty and request narrow intervention; never claim DONE or retry blindly. Accept: zero duplicated effects under unknown-outcome fault injection.
3. STRAT-03 | P1 | Workflow-semantic version quarantine. Track application capability, provider protocol and checker schema versions; invalidate a learned workflow on relevant drift. Accept: old version fails safely until requalified.
4. STRAT-04 | P1 | Domain-specific success and support tier. Offer optional additional reviewer/coverage only after measuring its real costs and verification benefit; no guarantee of perfection. Accept: every sold tier clearly identifies supported tests, limits and response conditions.
5. STRAT-05 | P1 | Outcome-based customer success dashboard. Track verified minutes saved, weekly repeat use, correction count, service cost and ROI estimates labeled as such. Accept: customer-visible claims trace to observed proof and survey data.
6. STRAT-06 | P2 | Privacy-preserving partner distribution. Offer referral/agency workflows with explicit customer permission and redacted sample ProofPacks; never share customer keys, account data, cookies or internal device logs. Accept: partner has no access to another client without grants.
7. STRAT-07 | P2 | Conditional integration/API channel. Only after measured repeat product-market fit, consider a single outcome-based API/agency portal that uses the same permission, verifier, BYOK accounting and rate controls. Accept: real qualified demand and positive contribution before build.
8. STRAT-08 | P1 | Open compatibility and certification matrix. Publish per-model/adapter verified tool, vision, schema, latency, error and privacy compatibility without model-name marketing; model discovery alone does not certify JARVIS desktop control. Accept: controlled synthetic regression before enabling consequential tasks.

### 14C.8. Acceptance and profit/reliability order

- P0 before final cloud task benchmarks: safe side effects, source-bound BYOK/owner usage and Base URL SSRF, key secret isolation, all Chat/JARVIS model-subcall budget attribution, independently verified deliverables, nonduplicating effects, replayable critical regression tests, >=100 simulated key records, full-site/companion green CI on exact SHA.
- P1 before commercial growth claims: calibrated quality and cost routing, 7/30-day retention, margin by task and source, tested owner/customer experience, stable incident process, competitive benchmarks and transparent truthful product charges; optional P2 partner/agency features only after positive observed evidence.
- Customer-business economics: contribution per verified task = realized product revenue less model expense actually paid by OCADE, hosting, verification, provider/integration, retries, support, payment/refund and other variable costs. BYOK model fees belong to the customer's vendor account, but OCADE work still has platform costs and published workflow charges. Do not label usage free or profitable without receipts.
- Competitive claims: benchmark on matched environments and identical signed objectives, with first-attempt success, p95 completion time, cost per verified success, unsafe effects, interventions, support and uncertainty. Never assert OCADE is 100% better than all five without independently reproduced representative evidence.

## Part 14D. Six-repository productive collaboration, universal model gateway and non-conflicting agent teams (mandatory implementation requirements; 15 Nov 2026)

Scope and owner decision: Agents must be genuinely productive, active collaborators assigned to independently useful parts of ONE authorized project, not just a serial planner, researcher, checker or chat-room roleplay. A coordinating director also works actively: monitors changes, performs authorized reviews, assigns precise corrections, and may itself repair a nonconflicting section when it has the appropriate lease. Independent specialists should continue useful work while corrections happen elsewhere. This section is a general product specification, NOT evidence of implemented functionality and NOT an example task or benchmark scenario. No illustrative customer project or demonstration from this conversation may be coded into task routing, model prompts, fixtures, benchmarks or scoring logic.

Sources and provenance: Ruflo https://github.com/ruvnet/ruflo ; UFO³ https://github.com/microsoft/UFO ; Hermes Agent https://github.com/NousResearch/hermes-agent ; OpenClaw https://github.com/openclaw/openclaw ; CUA https://github.com/trycua/cua ; Nod https://github.com/n8n-io/nod . Retain Parts 14A–14C: 72 earlier source-derived entries cover the original five repositories; these 36 new numbered provisions articulate six-repository collaborative implementation requirements. Where a provision overlaps existing ELITE, MOAT, OWNER, VERIFY, STRAT, REPO, 84-concept or 266-ID entries, reference the same implementation and acceptance proof, not an extra subsystem.

### 14D.1. Five foundational rules that all agents obey

1. One project truth: A durable, versioned and authenticated project contract records objective, customer constraints, approvals, output acceptance, team/role assignments, artifact manifest, dependency graph, reference frames and units where applicable, funding source, budget, current decisions, task status, input hashes, output hashes and STOP epoch. Each worker sees the current authorized revision, relevant immutable inputs and exactly what it owns; no worker silently redefines the goal.
2. Parallel independent production; exclusive conflicting writes: Agents concurrently create or transform different approved portions, using isolated workspaces, files or applications. A resource-scoped exclusive lease protects every shared document, file path, app session, window, external account or integration commit where changes could conflict. Read-only work can parallelize when safe. One PC input controller per overlapping session remains authoritative, including for the coordinator. Unowned changes are denied.
3. Dependency-aware live synchronization: Every work package has explicit prerequisites, output schema, acceptance rules and input versions. When an accepted upstream decision/artifact changes, only dependent items are marked stale, notified and reworked. Unaffected work continues. The coordinator cannot accept an old result against a new project revision.
4. Structured collaboration, not endless agent conversation: Typed event/ACK messages deliver TASK_ASSIGNED, TASK_READY, REVISION_CHANGED, ARTIFACT_PROPOSED, ARTIFACT_ACCEPTED, DEPENDENCY_INVALIDATED, CONFLICT, REWORK_REQUESTED, TOOL_DENIED, STOP and RESUME with project/tenant IDs, source revision, event ID, sequence, sender and receiver. Messages are authenticated, deduplicated, permission-limited, bounded and never authority grants. Agents exchange hashes, diffs and specific decisions rather than entire repeated histories.
5. Truthful success and controlled corrections: Agent self-reports do not certify correctness; accepted intermediate and final artifacts require independent oracles/receipts suited to the output. A director may diagnose and correct only after acquiring the current ownership grant. Unknown effects remain quarantined; STOP, Take Over, human revisions and irreversible-action approvals prevail. Do not promise perfection or no mistakes.

### 14D.2. Thirty-six high-impact adaptations: six verified-source themes per repository

Every item below is an implementation target to compare against OCADE's existing code before building. Status defaults to NOT CODED or UNVERIFIED until demonstrated on the target commit. P0 is essential for safe working collaboration; P1 is evidence-backed improvement; P2 is conditional on observed value. Apply current exact-source review, compatibility/licensing, focused tests, rollback strategy and measured performance.

RUFLO — durable active multi-agent teamwork (six requirements)

- RUFLO-01 | P0 | Mission and revision authority: Adapt v3/@claude-flow/cli/src/missions/{schemas,transitions,service,store}.ts strict mission/task states, dependency-cycle validation, expected revisions, request idempotency, event evidence and acceptance guards. Implement through existing Supabase authority and journal rather than duplicating Ruflo's local storage. Pass: concurrent stale requests lose, duplicates have one effect, interrupted work restores exactly.
- RUFLO-02 | P0 | Specialist task graph and assignment: Adapt v3/@claude-flow/swarm/src/coordination/{task-orchestrator,agent-registry}.ts capability matching, queue, dependencies, worker ownership and release. Pass: multiple independent agents produce outputs concurrently, prerequisites block dependents, crashed workers release safely.
- RUFLO-03 | P0 | Priority message delivery: Adapt v3/@claude-flow/swarm/src/message-bus.ts typed queues, ACKs, bounded retries, event-driven dispatch and recipient-aware delivery; persist required messages in the existing task/event outbox. Pass: lost/reordered/duplicated delivery cannot repeat external actions; STOP outranks routine updates.
- RUFLO-04 | P0 | Immutable scoped context delegation: Adapt v3/@claude-flow/cli/src/services/context-delegation.ts bounded source snapshots and hash-checked evidence, with limited tool authority. Pass: irrelevant context, other customers' data and stale observations cannot become accepted project facts.
- RUFLO-05 | P1 | Isolated branch-and-promote work: Adapt principles from services/swarm-memory-branches.ts: private agent drafts with explicit promotion, conflict checking and discard on failure. Prefer existing file/Library revisions; optional copy-on-write only if useful. Pass: two conflicting edits are never silently overwritten.
- RUFLO-06 | P0 | One global AI budget: Adapt services/global-ai-budget.ts plus ai-job-dedup.ts: atomic model-request admission across ALL concurrent agents, provider-specific cooldowns, shared quota-group accounting, bounded retries and deduplicated subjobs. Pass: quota and spend ceilings hold under races; BYOK never consumes an OCADE-funded model call.

UFO³ — dependency-aware live coordination (six requirements)

- UFO-01 | P0 | Typed dynamic task DAG: Reuse UFO³ Galaxy/constellation dependency graph patterns with declared input/output artifacts and invalidation rules. Pass: cycles and missing dependencies are rejected; only ready work is scheduled.
- UFO-02 | P0 | Selective replanning: Change affected graph nodes without restarting an entire project; preserve already verified unaffected progress. Pass: upstream revisions update exactly the dependent tasks.
- UFO-03 | P0 | Capability-based worker placement: Use tool, application, OS, device, model, permission and resource capability to assign specialist jobs. Pass: unsupported workers cannot claim tasks they cannot perform.
- UFO-04 | P1 | Safe multi-device fan-out: Allow separate authorized devices/sessions to perform independent work without cross-device authority leakage. Pass: same-session mutations remain exclusive while isolated devices execute concurrently.
- UFO-05 | P0 | Source revision broadcast: Notify affected agents of new accepted timeline/coordinate/schema/asset versions as applicable to their work; require stale-version acknowledgement and reroute. Pass: integration cannot accept an output built against superseded mandatory inputs.
- UFO-06 | P1 | Recovery-aware reassignment: On missed heartbeat/crash, expire leases, retain durable work receipts and reassign only retry-safe tasks. Pass: no duplicate external submission, permission bypass or lost finished artifact.

HERMES AGENT — long-running intelligence and learning (six requirements)

- HERMES-01 | P0 | Structured checkpoints and handoffs: Preserve goal, lease, accepted project revisions, unresolved obligations, receipts and last verified step; do not substitute unbounded chat history for durable state. Pass: valid restoration after worker/host restart.
- HERMES-02 | P1 | Verified reusable skills: Learn parameterized procedures only from independently verified successes with explicit capability/version/approval preconditions. Pass: changed states cause revalidation, not blind replay.
- HERMES-03 | P1 | Decision-safe memory compaction: Reduce repetitive context and observations while preserving identity, permissions, dependencies, user decisions, uncertainty and acceptance. Pass: held-out decision parity and measured token improvement.
- HERMES-04 | P0 | Credential health classifications: Adapt agent/credential_pool.py, hermes_cli/runtime_provider.py healthy/exhausted/dead states and known reset/cooldown. Pass: provider-level exhaustion is not evaded by rotating same-quota keys.
- HERMES-05 | P1 | Reversible snapshots: Create selective checkpoints before recoverable changes and maintain narrow rollback without erasing concurrent human edits. Pass: recovery after injected corruption preserves user-owned intervening updates.
- HERMES-06 | P1 | Specialized reasoning escalation: Route genuine uncertainty to an authorized qualified model/specialist when measured benefit exceeds cost, without blocking independent deterministic work. Pass: improvement survives equal-budget quality/latency tests.

OPENCLAW — provider resilience and trustworthy integrations (six requirements)

- OPENCLAW-01 | P0 | Provider-specific profile selection: Adapt src/agents/auth-profiles/{order,usage-state,credential-state,advance}.ts matching, health, consent, expiry, refreshing and reason-coded cooldown. Pass: no cross-tenant, cross-funding-source or wrong-provider selection.
- OPENCLAW-02 | P0 | Qualified and consented model switching: Only change to an authorized model/profile compatible with the task's privacy, region, tools and owner/user approval policy. Pass: BYOK failure never silently falls back to OCADE-funded inference.
- OPENCLAW-03 | P1 | Scoped sessions and agent identity: Keep account, organization, device, project, agent, credentials and connector grants separately scoped. Pass: attempts to read another project or tenant fail.
- OPENCLAW-04 | P1 | Integration/skill compatibility manifests: Let specialists access existing authorized app/MCP connectors through one tested capability registry and lifecycle. Pass: revoked connectors immediately fence queued and new calls.
- OPENCLAW-05 | P1 | Event-driven durable continuation: Resume authorized asynchronous jobs, scheduled tasks and exports from receipts/status events, not redundant model polling. Pass: disconnection/retry does not duplicate external effects.
- OPENCLAW-06 | P1 | Clear recovery and model/source UI: Show current selected provider/model/key alias, health, known versus unknown limits, cooldown/error reasons and explicit source-change controls. Pass: Chat/JARVIS never fabricate capacity, reset or success.

CUA — reliable computer operation during multi-agent work (six requirements)

- CUA-01 | P0 | One typed native-first tool broker: Preserve priority: authorized native app/file APIs, scripts/CLI, browser DOM, OS accessibility, capture-bound visual control as last fallback. Pass: all modalities enforce identical approval and device authority.
- CUA-02 | P0 | Exclusive resource leases: Use one valid writer per overlapping window, app session, file and external account while allowing independent read-only inspectors. Pass: no two workers type/click/save concurrently into the same shared live target.
- CUA-03 | P0 | Capture-grounded action freshness: Bind an action to observed window/element/screenshot version and reject changed target or focus. Pass: injected stale screenshots/windows cause safe re-observation.
- CUA-04 | P1 | Nonintrusive background actions: Use background APIs and isolated sessions where supported, foreground UI only under controlled handoff; no mandatory end-user VM/Docker or copied personal browser profile. Pass: unsupported background interactions are disclosed, not invented.
- CUA-05 | P0 | Receipt-bound idempotency and STOP: Record action identity, controller generation, pre/postconditions and ambiguous-effects quarantine. Pass: cancellation and timeout never blindly replay uncertain mutations.
- CUA-06 | P1 | OS/device qualification: Verify Windows/macOS compatibility, DPI, monitors, different app technologies, accessibility permissions and real device failures. Pass: validated driver behavior beyond mock UI tests.

NOD — governed models, checkpoints and verified outcome delivery (six requirements)

- NOD-01 | P0 | Universal endpoint model: Adapt src/ports/models.ts and src/providers/pi/models.ts protocol/provider/credential/capability declarations. Pass: new approved provider/model records work without changing fixed Gemini enums or core planner source.
- NOD-02 | P0 | Atomic reserve-and-settle economics: Reserve provider tokens, money and concurrency for every agent/subcall and settle from actual or labeled-estimate usage. Pass: nested runs never exceed authorized spend or debit the wrong source.
- NOD-03 | P0 | Strict persisted state: Adapt src/providers/pi/checkpoint.ts fail-closed checkpoint validation and interrupted-work recovery. Pass: corrupt/revoked/stale state blocks safely instead of fabricating completion.
- NOD-04 | P1 | Narrow human approval checkpoints: Ask at new-risk, destructive, spending, privacy or permission boundaries, not for every harmless internal handoff. Pass: coordinator or worker cannot self-approve expanded rights.
- NOD-05 | P1 | Generalized repeatable procedures: Convert proven workflows to precondition-checked, parameterized procedures with no customer/example-specific hardcoding. Pass: independent holdout inputs validate correctness.
- NOD-06 | P1 | Complete work and usage observability: Expose factual progress, per-agent changes, provider/source calls, retries, evidence, exceptions and corrective work. Pass: every displayed claim traces to durable receipts.

### 14D.3. Adaptive active-team design (not a fixed agent-role template)

1. Count: Support a configurable number of logical agents; the initial 5–8 productive active-agent target is an operational recommendation, NOT a technical ceiling, guaranteed simultaneous LLM concurrency or minimum for every task. Admit 1, 2, 5, 8 or more only as justified by parallelizable tasks, skill compatibility, actual user need, provider RPM/TPM, memory/CPU/GPU and budget. Automatically deallocate idle agents; refuse agent inflation when it increases cost or error rate. Maintain simple one-agent/deterministic path as a serious competing baseline.
2. Coordinator: Owns decomposition, overall standards, integration schedule, dependency tracking, dynamic conflict resolution and quality review; also performs useful corrective work under a valid resource lease. It cannot override user constraints or be both sole approver and independent verifier of its own consequential changes.
3. Workers: Each specialist has a concrete output to create/edit, not a title alone. Output ownership may be per file, document portion, asset version, independent computation or isolated app session; never assume specialties are limited to a named use case. Workers publish staged artifacts and evidence before integration.
4. Conflict prevention: At scheduling time reject overlapping resource write sets; enforce distributed leases with fencing epochs at execution time, compare-and-swap expected input revisions at integration time, and stop/unblock/replan when user edits intervene. An expired agent cannot continue writing even if it returns later.
5. Model versus computer concurrency: One key can serve many logical agents but all share its real provider-account/project quota; a provider gate serializes or parallelizes model calls within actual token/request/concurrency budgets. Work that does not need a model continues through deterministic operations and durable device jobs. A separate API key never automatically means independent quota. One customer desktop session is not a multi-cursor desktop at the OS input level; the owner nonetheless REQUIRES many genuinely concurrent independently executing agents, each with its own truthful colored virtual pointer/activity overlay where appropriate. Native API, headless, browser-context and isolated-process concurrency MUST NOT be artificially serialized behind a single global mouse mutex. See Part 14F.
6. Live correction loop: Detect mismatched artifacts, version drift or acceptance failures early; assign smallest impacted correction, notify dependencies, reverify changed components and the aggregate output, and preserve unrelated productive progress. Bounded recovery and human escalation protect against recursive churn, repeated mistakes and excessive spend.
7. 84-concept integration: Reuse all applicable existing OCADE concepts as system capabilities, NOT 84 agents or 84 AI requests. Map concepts 1–23 to task/context/tool selection, 24–49 to platform/operations, 50–70 to locking/cancellation/grants/security, 71–84 to deliverable evidence and performance qualification. Keep the authoritative concept-by-concept definitions and statuses in Appendix B, with a one-to-one implementation/proof crosswalk and no extra implementation solely to increase concept usage.

### 14D.4. Confirmed source-code defect: remove Gemini-specific hardcoded models and key slots (P0)

Verified exact OCADE file: src/lib/intelligence/online-models.ts (plural, despite shorthand online-model.ts). On this branch it currently exports DEFAULT_ONLINE_MODEL = "gemini-3.5-flash-lite", HIGH_ONLINE_MODEL = "@cf/google/gemma-4-26b-a4b-it", a hardcoded two-item PLANNER_MODELS list, plannerModel() that returns undefined for all other configured models, and exactly three Gemini-specific provider key slots mapped to GEMINI_API_KEY_PRIMARY, SECONDARY and TERTIARY. These facts establish a specific implementation blocker for universal model selection and flexible credential registries. A document revision alone does not remove the code restriction.

MANDATORY CLAUDE/CODEX IMPLEMENTATION INSTRUCTION: CHANGE ACTUAL CODE, DO NOT ONLY UPDATE PLAN.

1. Audit every actual import/caller of src/lib/intelligence/online-models.ts, planner.server.ts, online intelligence edge-handler/gateway, Chat, JARVIS, source/permit validation, Settings/BYOK, Supabase secrets/usage, tests and legacy environment variables. Preserve current valid owner-funded connections while migrating.
2. Replace the fixed exhaustive model enums and exactly-three-Gemini-slot assumption with dynamic validated model/provider/credential registries. Support hundreds of separate authorized key and model records without editing the model list or core planner each time. Configured/prequalified defaults may remain as seed data, NOT restrictive compile-time allowlists. Model ID comes only from trusted authorized selection, not untrusted client or LLM instructions.
3. Provide provider-specific protocol adapters and qualified Base URL profiles for OpenAI-compatible Chat Completions, Responses API, Anthropic Messages, Gemini and tightly controlled custom HTTPS gateways as supported. Each record declares tools/JSON/vision/audio/stream/usage capabilities, privacy/region, token/context limits, version, validation and suitability for consequential JARVIS tools. Do not assume all gateways speak one OpenAI-like protocol; require per-adapter negative tests.
4. All Chat, JARVIS, coordinator, specialist, summary, transcription, vision, compaction, model-assisted verifier, retry and background calls flow through ONE authenticated source-bound gateway. Each task/turn pins source_kind (customer BYOK versus OCADE-managed), tenant/account, connection ID, provider, model, protocol, quota group, approval revision and cost/token budget. A BYOK-selected task makes ZERO OCADE-funded model-provider calls anywhere in its nested call graph; provider failures never trigger unapproved cross-source fallback.
5. Per-user BYOK keys never deduct OCADE-funded inference quotas/counters; separately disclosed platform subscription/workflow charges are different from provider tokens. Surface current source ("Your key: [masked alias]" versus "OCADE-managed"), selected model, provider errors, observed call counts and trustworthy known/unknown quota resets in BOTH Chat and JARVIS. Provide a user-approved connection-change route, not silent switching.
6. Secure arbitrary Base URL metadata against SSRF/private IP/IPv6/link-local/cloud metadata, unsafe redirects, DNS rebinding and secret-bearing query strings; protect keys with existing Supabase secret/Vault/RLS boundaries. Do not store/log plaintext keys or expose them to agents. Key revocation fences all queued/next calls, including delegated agents.
7. Verify with >=100 synthetic credential entries, owner O1/O2, two unrelated users with BYOK key sets, cross-tenant attacks, concurrency, model capability mismatch, 401/402/403/429/5xx, project-wide versus key-specific rate limits, unknown quotas, explicit switch approvals, BYOK-only delegated teams, pause/STOP and failed network retries. Assert owner-funded model network calls = 0 and owner inference ledger unchanged throughout BYOK-only test graphs.
8. Keep initial historical Gemini/Gemma model-comparison fixtures as unbiased LEGACY benchmarks only; they are not permanent supported-model limits or proof any dynamic model is already production qualified. Do not call this feature implemented until actual settings, models, provider requests, backend ledger, Chat/JARVIS routes and tests work end to end.

### 14D.4A. Owner-approved universal free-tier model discovery, BYOK choices and spending controls (21 Nov 2026; P0)

Owner objective: Complete the existing universal model gateway and the actual customer-facing Chat/JARVIS/Settings experience. Use legitimately authorized, currently available FREE-TIER AI inference as much as provider quotas and terms permit; reuse the owner's already-configured Gemini credentials in Supabase STAGING first. This section is an implementation instruction, NOT proof a provider account, free balance, secret, model entitlement or feature is working.

1. Existing staging Gemini is first, no replacement credentials by default. Inspect the existing Supabase staging project's protected server-side Edge Function/secret configuration through authorized means; determine the existing Gemini key alias(es), protocol, working model(s), rate/credit limits and permitted data handling WITHOUT displaying, exporting, logging, committing, copying into chat, or exposing secret values. Use those already-provisioned staging credentials for owner-approved staging tests after required coding/security gates; do not assume that staging credentials are production credentials, do not silently rotate them, and do not route customer BYOK usage through them. If a key is unavailable, expired, disallowed or quota-exhausted, report its reason and continue other authorized work. Verify the actual staging project before using it, rather than guessing project refs or secret names.
2. Maximise legitimate free usage, not account abuse. Discover providers with free development/API tiers or explicitly granted promotional credits, e.g. Google AI Studio/Gemini, Groq, OpenRouter free models and Cloudflare Workers AI, plus other currently verified options. Provider examples are CANDIDATES ONLY, not a promise of permanent free service, free access to every model or availability in every region. Before enabling each provider, verify its current official terms, eligibility, quota, request/token limits, model tools/vision/function-calling compatibility, retention/privacy and commercial-use permission. Only use OCADE-owned, owner-authorized or customer-supplied keys legitimately issued by the provider. Never discover/use leaked, scraped, third-party, trial-farmed, quota-evading or shared unauthorized keys; never bypass provider limits, verification or billing requirements. Set up eligible no-cost integrations automatically through available authorized tools; where an external console/account-verification step cannot be completed, present the smallest exact owner action and keep coding.
3. All models under one customer key. When a customer connects an OpenAI, Anthropic, Gemini, Groq, OpenRouter or other supported provider key, query its provider-specific model-discovery endpoint when available, retain a refreshed per-key list, and capability-probe eligible models as needed. Show available and unavailable/unverified status accurately; if model listing is unsupported, use current trusted provider metadata plus validated probes. Do not hardcode a list such as GPT-5.6/GPT-6, nor assume a listed model is entitled, free or suitable for JARVIS. Support a customer's multiple providers, keys, accounts, regions and model choices without a fixed three/eight-key architectural limit; do not assume one key equals an independent quota.
4. Simple but complete UX. Settings > BYOK and the Chat/JARVIS model picker present: provider/account/key alias, verified connection, permitted model names, model capability badges (chat, tools, vision etc.), known price/free-status or explicitly UNKNOWN, provider-reported limits, and a manual selected-model choice. Offer a clear Auto (choose a compatible model from this customer's expressly permitted model set) and Manual mode. On task start, bind the exact authorized source/account/model/budget and show it in progress/receipts. Auto must not silently choose a paid model, move to a different funding source or switch privacy region; obtain the consent the task requires.
5. Customer-selected spending policy, per funding source. Implement selectable Free-only / ₹0 paid inference, Custom, and Unlimited (no voluntary OCADE spending ceiling) modes, plus optional per-task, daily and monthly budgets for each customer's provider/account/key and separate limits on owner-funded AI. Custom lets the person set and change the amount and currency with clear reset periods and notices; per-task includes coordinator, specialists, retries, vision and background model calls. Reserve before calls, settle recorded actual costs/usage afterward, prevent concurrent agents from overspending the same budget, and stop/pause with honest messages on depleted quota or budget. Provider charges and upstream hard limits STILL apply in Unlimited mode: it never means free inference or unlimited provider access, nor does it authorize OCADE-funded calls. Provider billing data may be delayed; label estimates and never promise a mathematically perfect hard currency cap if provider metering cannot enforce one.
6. Owner-funded versus BYOK accounting. Customer BYOK calls must not consume OCADE-managed Gemini or other funded allowances, even for delegated agents, summaries, retries or verification. Customer provider-key charges stay with that provider/account; OCADE platform fees are separately disclosed. A Free-only profile must never quietly generate a paid request, and a quota/429/402/credential failure must never silently fall back to a paid provider, another person's key or OCADE staging Gemini. Explicit approved provider/model changes are allowed after a fresh capabilities/privacy/cost check.
7. Free-first execution without unintended cost. For owner-development/benchmark preparation use the existing permitted staging Gemini account and genuinely free provider allocations as available, under a default ₹0 additional paid spend ceiling. No paid API account, paid trial conversion, chargeable hosted GPU/service, subscription or monetary commitment is authorized solely by this standing approval. If only paid access can satisfy a mandatory test, record exact provider, projected charge, test scope and blocker, then request a numeric spend cap before incurring costs. Avoid spamming provider quotas; use accurate backoff and allow the customer to see real quota failures.
8. Security and independent acceptance. Encrypt and tenant-scope credentials; use server-only access, no plaintext logs, no client or agent token exposure, exact provider-host allowlists, SSRF protection, revocation fencing, consented account switch and cost disclosures. Test with 100+ synthetic key/model records, two isolated customers, a user with multiple models under one key, model listing absent/denied/stale, free-to-paid boundary, custom/unlimited settings, request and token caps, time resets, concurrent multi-agent reservation, 401/402/403/429/5xx and provider failure. Confirm for BYOK-only executions OCADE-funded inference requests and debit count remain ZERO. Test with real authorized free-tier models only when the full coding, security, debloat and same-SHA CI gates permit; do not claim benchmarking happened earlier.

Acceptance: Actual working account/key connection, per-key model discovery and suitability filtering, Auto/Manual selection, secure BYOK isolation, Free/Custom/Unlimited spending controls, truthful error/quota reporting and independent end-to-end evidence across Chat, JARVIS and agents. Do not mark complete from UI mockups or a plan-only update. Preserve the strict plan order: ALL CODING -> SECURITY REGISTER -> DEBLOAT -> SAME-SHA GREEN CI -> MODEL BENCHMARK -> REAL WINDOWS/MACOS CLOUD COMPUTER/WHOLE-SITE TESTING -> FINAL CUSTOMER LAUNCH QUALIFICATION.

### 14D.5. Acceptance, sequence, existing owners and anti-bloat controls

- P0 before real-task benchmarking: (a) inspect the live codebase for any matching current mechanisms; (b) implement the smallest shared durable agent-task graph, versioned context, source-aware permits, exclusive resource ownership, typed messaging, conflict-free staging/integration, STOP fencing and independent receipts; (c) remove hardcoded model restrictions with tested dynamic gateway, BYOK isolation and truthful UI; (d) pass deterministic fault injection and full exact-SHA site+companion CI GREEN before any live/real-task benchmark. A plan checklist, generated screenshot, mocking or compiled code alone is not runtime proof.
- Mandatory adversarial conditions: two agents race to modify the same artifact; same message arrives twice or out of order; coordinator is stale; user edits shared work mid-flight; an agent dies while holding a lease; permissions are revoked; BYOK quota fails; provider silently changes model schema; STOP arrives during execution; model returns an unsupported tool call; result is plausible but wrong. No unauthorized effect, duplicate external submission, cross-source bill, unverified completion, stale promotion or loss of unrelated valid work is acceptable.
- P1 optimization and differentiation: enable autosizing, private branches, targeted selective rework, verified learned procedures, cross-device distribution and faster context delegation only when tests show measurable higher quality or speed at equal risk and total cost. Compare single-agent, bounded multi-agent and deterministic-only approaches. Report verified completion rate, p50/p95 time, conflict count, stale dependency misses, model calls, tokens, actual customer/owner cost, interventions and recoverability across independent held-out task classes. Never tune to any illustrative example from the user conversation.
- Owners rather than added frameworks: existing JARVIS supervisor/planner and durable task authority own orchestration; existing companion/controller owns PC mutation; online intelligence gateway + Supabase secrets/usage boundary own model routing and quota; existing Library/revision layer owns staged artifacts; existing independent verifier owns acceptance; existing Chat/JARVIS/Settings own visibility; existing CI/test ledger owns proof. Borrow concepts and legally compatible narrow code, not six complete runtimes.
- Licensing/provenance: For each adopted source path record exact commit/version, applicable license, attribution, transitive dependency risks and expected benefit before copying. Ruflo root MIT terms require notices; re-check concrete files, especially optional extensions and other repositories. Keep permission, privacy, ownership, safety, no mandatory Docker/VM, cost and support constraints unchanged.
- Never assert guarantee: Agent count is not a measure of correctness; no system can ensure zero model mistakes or unlimited provider throughput. Qualification is explicit and measured, and no public deployment, merge, API-key mutation or paid operation occurs without the required approval.

## Part 14E. Personal private memory and complete OCADE experience: composer, @ resources, files, vision, connectors, customization, authentication and security (15 November 2026)

Binding scope: Capture all customer-experience decisions discussed after commit 77a725e, in addition to Part 14D's six-repository agent requirements: exclusive per-customer memory; a user-editable magic prompt enhancer; ChatGPT-style Plugins and Skills discovery; dynamic @ mentions for native PC applications, windows and individually approved browser tabs; intelligent file choice for underspecified instructions; local large-file and video workflows; useful vision; connected external accounts/OAuth/MCP; complete account-to-verified-deliverable journey, personalization, security and exceptional polish. This is a general product contract, NOT a list of domain-specific hardcoded tasks or benchmark examples. Keep the original five-source 72-item ledger, 36 Part 14D capabilities, 84 architecture concepts, 34 UX principles, one task authority, one model gateway, six Settings categories and all release gates. Cross-reference rather than reimplement them.

### 14E.1. Account-private, consented persistent memory and total cross-user isolation (P0)

1. Useful personal context, not unlimited surveillance. OCADE should understand an authenticated customer through their authorized chats, accepted project results, consented preferences and optionally connected data. It must not claim literally complete knowledge of a person, automatically scan private files/screens/accounts, or silently create a sensitive profile. Optional long-term memory defaults and scope must be explained and user-controllable.
2. Ownership invariant: User A's chat, profile, memories, summaries, inferred preferences, embeddings, vector hits, search indices, uploaded files, source citations, screenshots, task and agent context, cached results, API keys, connected accounts, projects, browser tabs, telemetry and derived training-like records MUST NEVER be retrieved for, injected into a prompt for, exposed to, or influence recommendations to User B. Identical names, provider models, accounts at the same vendor, devices, groups or shared API-key projects do not permit leakage. Owner/staff access is not a privacy bypass.
3. Scopes and namespaces: Distinguish temporary turn context, private conversation memory, private project/task memory, optional user-profile long-term memory, and separately permissioned organization-shared data. Only an explicitly granted shared-project resource enters shared context; personal profile memory never becomes organization memory by default. Preserve provenance, consent/source type, creation/update time, sensitivity class, confidence, expiration, owner and effective access scope for every record.
4. Backend security BEFORE retrieval: Derive tenant_id and user_id from validated active session, NEVER from URL/body, model text, external connector username, customer-editable metadata or @ token. Apply RLS plus grants/RPC/Edge Function checks at storage and on every retrieval; filter tenant/user namespace before vector or semantic similarity search, then reauthorize each hydrated source and source citation. Cache keys include tenant/user/project/permissions/revision; never share model context/session cache across users or reuse unrestricted memory summaries in background workers. Service-role callers enforce ownership manually, and inaccessible auth or grants fail closed.
5. Safe memory intelligence: Separate a fact the user explicitly stated, an inferred preference and an unverified guess. User corrections and current instructions supersede stale memories, subject to authorization. Retrieved text is untrusted DATA, not a policy, tool command or permission. Agents and prompt enhancement receive only the smallest relevant authorized subset. Never store passwords, cookies, private tokens, OTP, unnecessary sensitive data or raw screen recordings as memory.
6. Control and deletion: Settings > Preferences provides personal-memory options; Privacy & Security provides Memory On/Off, view, inspect why used, amend, forget, source-disable, export and deletion of personal memory and derived summaries/vector entries. Clarify disabling future learning versus turning off retrieval versus permanent deletion, including honest limits of backup retention. Respect account closure, consent withdrawal, device/connector revocation and organization exit. No silent model training or external provider export of private profiles without user consent.
7. Prove with attack fixtures: Three synthetic users, shared/different orgs, similar names, same provider account/project quotas, Alice/Bob memory canaries, tool/plugin result contamination, semantic retrieval collisions, prompt enhancement, user import/export, Admin/Staff API, RLS/direct SQL, RPC, storage, CDN/cache, asynchronous agents, paused/terminated sessions and account deletion. Assert zero cross-user leakage in network provider payloads, model answers, file suggestions, autocomplete, embeddings, logs, analytics, recommendations and citations.

### 14E.2. Sparkles / magic Enhance Prompt control in BOTH Chat and JARVIS composers (P0)

1. Placement: One small distinctive sparkle icon located at the BOTTOM LEFT of the existing composer, integrated with existing attachment/voice/send controls without replacing them. Tooltip and accessible label "Enhance prompt"; keyboard/Enter/Space, hover/focus, screen reader and mobile touch accessibility. Do not add a separate prompt rewriting screen or redundant input box.
2. Function: On an explicit click, take the user's raw text and propose a cleanly structured, clearer and more actionable version while preserving the EXACT intent, language preference, constraints, negations, quoted text, dates, numbers, units, file paths, URLs, @ resource chips and stable IDs, desired output, cost limits, safety instructions and task boundaries. Improve order, clarity, scope and meaningful acceptance criteria only when genuinely supported; do not invent personal facts, files, app state, permissions or goals. Memory personalization is optional and uses only that user's authenticated, relevant and consented chat/project/profile context.
3. Editable and reversible: Original draft is retained; show Before/After or a clear diff and offer Apply/Keep editing, Restore original/Undo, Retry and optional shorter/clearer version. Enhancement NEVER auto-sends, starts a task, activates agents, approves an external operation, elevates permissions or selects a different BYOK source. The user edits and presses Send independently. Editing while generation is pending invalidates stale enhancement output so it cannot overwrite fresh keystrokes.
4. Premium smooth transition: Sparkle activate → restrained light/shape transition and text morph/crossfade → settled editable result, with no flicker, cursor/focus loss, unexpected scroll or layout jump. Initial microinteraction design target 180–350ms excluding real model latency; preserve actual async loading/error/cancel status while the provider responds. Reduced-motion preference changes the morph to a static or subtle fade and never blocks action. Low-power devices and mobile keyboard/safe-area layout receive separate tests. Do not use distracting constant shimmer.
5. Loss-of-detail defense: Immutable raw and candidate revisions; deterministic check of negative statements, quoted substrings, numbers, resource IDs, hard requirements and paths. If content loss or inconsistent meaning cannot be ruled out, call attention to exact changes and require review; users can reject without losing original. Test difficult multilingual, ambiguous, long, rich Markdown, prompt-injection, memory conflicts, concurrent typing and user account switching.
6. Security, budget and consent: This is a model subcall and must use the current permitted Chat/JARVIS credential source and actual usage admission; if user selected BYOK, all enhancement inference calls use customer BYOK, with ZERO OCADE-funded model-provider calls, per Parts 14B.1B and 14D. If unavailable show truthful reason or offer explicitly labeled deterministic formatting only; no silent different model/provider, leakage of private files into enhancement, hidden credits or extra background model calls. Measure quality by constraint preservation, user edits, accepted prompts and actual task success, not cosmetic length alone.

### 14E.3. One universal @ mention and command palette across authorized resources (P0)

1. Single source: Typing @ in JARVIS (and supported Chat) opens type-to-search for authorized Installed PC Apps, running Windows, individual Browser Tabs, Files, Folders, Devices, Connected Accounts, Connectors, MCP resources and approved Skills. Ctrl+K uses the same registry to search commands, settings and resources; / can list approved skills. One capability catalog, security policy and backend search, not separate permission systems for every surface.
2. Detection: Local signed companion discovers supported installed/running applications, selected device windows, allowed folder roots and active processes. The dedicated product-controlled browser can enumerate its own open page/tab IDs and URLs; do not claim access to all of the customer's ordinary Chrome/browser tabs. Optional personal-browser extension/attachment needs explicit installation and narrow permissions, and is never mandatory. Never copy browser cookie/password profiles or expose debugging ports.
3. Accurate selected tab: Show tab title, favicon, origin/domain, OCADE browser/profile/device, live/closed/unsupported state, read versus interact capability and current navigation generation. User can @ one or multiple authorized tabs. Revalidate tab identity, origin, login, navigation, window ownership and fresh DOM/capture before use. Third-party authentication/CAPTCHA remains human-driven.
4. Typed mention chips: Pick results with stable opaque user+device+resource IDs, type, display name, origin, version and current authorization, not plain title string. Multiple mentions permitted. The backend cannot accept a textually forged @ mention as access grant. On tab close, file rename, app launch/exit or device revoke, refresh list and mark selected chip stale with actionable remedy.
5. Search behavior: Fuzzy/partial names, synonyms, categories and keyboard navigation; show installed/connected/current/recent user-approved targets above unrelated results; distinguish similarly named apps, Google accounts, GitHub organizations and private files. UI reveals only allowed metadata, never secret file names from another user. Add “Needs permission”, “No matching resources”, “Disconnected” and “Unavailable” states with clear next steps.
6. Underspecified request targeting: Rank only authorized evidence, such as selected @ chips, current app, pinned task/project, recent explicit user files and connected account scope; user memory can help rank but never grants permission. If target is consequential or ambiguous between distinct files/accounts, show candidate options and ask ONE precise question rather than guessing. Avoid repeated clarification for harmless unambiguous work.
7. Agent and computer isolation: Resource selection does not grant more than user/device policy. Specialists inherit only selected resource IDs and leased read/write capability; one authoritative controller for conflicting desktop UI action, with distributed resource leases and STOP as in Part 14D. Test forged @ text, stale tab, wrong device, revoked grant, cross-account suggestions and concurrent access.

### 14E.4. Large videos/files: local reference first, resume intelligently (P0)

1. Local reference, not needless upload: For a file selected on the computer, the companion returns a short-lived, opaque, device-bound file handle and metadata (safe display name, permitted canonical path scope, size, type, last modification, resource revision). A literal Windows/macOS file path is a LOCAL locator only; a hosted web server or remote cloud browser cannot open it directly. File path pasted in text must be resolved with user approval and current allowed-root checks, not treated as authorization.
2. Safe low-cost detection: Use stat/metadata, bounded header/signature sniffing and trusted media probe for file type, audio/video tracks, codec, duration, dimensions, timebase and storage size. Detect local permissions, free space, changed file versions, symlink/junction escapes, long paths, removable/network volumes and quota. Do not load an entire multi-GB file into RAM or into a model just to inspect metadata.
3. Route transfer by actual capability: Prefer local native object/file operations; then same-device permitted browser file picker/input; then direct resumable chunked/TUS upload for OCADE storage where supported; then a destination's official multipart/resumable API; then authorized cloud-to-cloud transfer where offered. Avoid using a short-lived Edge Function as an unbounded file tunnel. Other websites may not support resumability; never claim otherwise.
4. Trustworthy upload UX: Real file size, hashed file identity, chunks and verified receipts, progress based on accepted bytes, cancel, retry, resume token, retry limits/backoff, network reconnect, deduplication after confirmation, destination/server acknowledgment, disk/transfer quota and disclosed cost. File sent from client is NOT proof receiver stored the correct full file. Failed/cancelled partial uploads are cleaned up by policy.
5. Smart video understanding: Use locally extracted relevant frames/scenes at precise timestamps plus permitted transcripts and media metadata. Send only needed authorized segments to a vision/audio provider; keep original file locally if work can stay local. Ensure remote provider capability, privacy/data-transfer consent, funding-source identity and cost accounting before upload. Heavy render/export remains a durable job whose state is polled without unnecessary model calls.
6. File/data security: Canonicalize roots and verify inode/file identity before use, prevent path traversal/TOCTOU/UNC escape, malicious MIME spoofing, archive zip-slip, decompression bombs, huge parser payloads, remote SSRF, untrusted embedded macros/executables and accidental disclosure through logs/thumb caches. Reuse existing Library security, retention and receipts; stress-test multi-GB synthetic files with interruption and stale handles.

### 14E.5. OCADE vision and safe “Point & Ask” interaction (P0)

16 November expansion: This earlier four-point vision baseline remains mandatory, but Part 14F.9–14F.15 supersedes any reading that screenshot polling is the main vision engine. Native application state, OS accessibility, continuously available app-scoped window video, event-driven frame selection and temporal understanding are first-class. Targeted screenshots are a precision/fallback observation technique, not the sole vision mechanism. See Part 14F for the named VISION heading, exact upstream source-file references and test gates.

1. Use fastest trustworthy observation first: Native application object/structured APIs → browser DOM/Playwright → OS accessibility/element trees → targeted screenshot and multimodal vision where needed; OCR only when justified. The fact that a model can describe a screenshot does not authorize hidden operations or certify success.
2. Ground vision in live identity: Capture carries device, desktop/session, window/tab/origin, display geometry/scale, timestamp, navigation/screen generation, selected region and permission. Re-observe after popups, scrolling, resizing, user input or stale target; never click old coordinates blindly.
3. User-selected screen region: Let authorized user point, highlight or crop a target; show what will be inspected and selectively redact unrelated sensitive notifications. Camera/microphone/screen recording require their own explicit OS/user permissions and visible active status. Captures remain ephemeral unless storage retention is separately opted into.
4. AI vision funding/privacy: Only qualified selected BYOK or OCADE-managed model may see relevant pixels/frames, with provider privacy disclosure and zero hidden OCADE-funded helper inference on BYOK. Verify resulting saved state through receipts and structured checks; avoid persistent screenshots containing credentials/health/private data.

### 14E.6. Searchable Plugins, Skills and MCP directory with official user approval (P0/P1)

1. Placement and design: In existing Apps & Websites area, provide Plugins and Skills tabs, search bar, Installed, Popular/Recommended, categories, publisher logo, actual supported actions, current connection status, gear/settings and Add dropdown. Adapt the useful interaction model from the user-supplied reference, but use OCADE's own visual identity and legally permitted icons. The three primary product destinations remain Chat, JARVIS and Library; do not invent a competing marketplace product/route before validation.
2. Discovery: Registry stores verified publisher/domain, category/tags, searchable service name/synonyms, available regions, connection mode, actions and required scopes. Partial type-ahead reveals accurate choices, not fake integration statuses. The catalog may list many services, but Connect becomes actionable only for genuinely registered/qualified integrations; prevent malicious look-alike publishers and disguised permissions.
3. Two different approvals: OCADE developer registers an App/integration with external provider and satisfies its review/verification requirements where needed; each customer separately presses Connect, reviews scopes and signs in at the official provider's own authorization screen. GitHub App and Canva developer integrations require provider-specific setup and may have provider review/publication constraints. Login to OCADE itself does not connect arbitrary third-party accounts.
4. Secure OAuth identity and tokens: Authorization code with PKCE, correct redirect URI and state/issuer/audience protections, least requested scopes, encrypted account-bound tokens, refresh and expiry/revocation lifecycle; do not ask for customer passwords/MFA/cookies or send token in model input. Distinguish a user's personal and company accounts, multiple accounts at one provider, and exact permitted repositories/folders. Upgrading permission is explicit and scoped; no silent account switching.
5. MCP is a tool protocol, not a security grant: Expose approved local/remote MCP resources using the current officially supported protocol/authorization and protected-resource metadata where applicable. Remote HTTP servers get correct OAuth audience/issuer-bound tokens; local STDIO processes keep OS-scoped secrets separate. Verify server identity, manifests, tool schemas, permitted hosts, sandbox/capability boundaries, changes/updates and tool-result prompt injection. Reject arbitrary local file/network/execution privileges and hosted private-network SSRF.
6. Skills are recipes, not authority: Users can search, inspect and create versioned reusable natural-language procedures, limited to already authorized tools and explicit dependencies. Skill memory is scoped to its user/project; no arbitrary script or MCP install on a consumer PC from unreviewed skill text. Promote to “verified reusable” only after independent outcomes and version drift checks.
7. Lifecycles and customization: Connect, check, select account, scope resources, activate for Chat/JARVIS/agents, pause, update, reauthorize, revoke or delete with truthful statuses. Show last verified connection test, masked account identity, permission list, per-tool errors and known/unknown provider limits. Revocation fences new and queued tool calls, including delegated agents. “Disable integration” and “revoke provider token” have distinct explained effects.
8. Future custom connector studio (P2): Guided manifest creation, API endpoints, OAuth/MCP configuration, test sandbox, publisher verification, permission inspection, code signing/update lifecycle and controlled public review. No public marketplace or untrusted code execution on customer computers until demonstrated demand and security readiness.

### 14E.7. Full customer flow: sign-in to verified output and return (P0)

1. Arrival and identity: Simple landing → Try Chat → sign in only when identity/private work is required; add OAuth/passkey/email providers only after tested secure linking and step-up authentication, rather than merely listing nonworking sign-in buttons. Do not require native companion to experience Online Chat.
2. First-use privacy: Offer Chat or JARVIS; optional language/theme, memory choice and explanation of permissions. Ask only necessary inputs. No compulsory large survey, all-device access, plugin signup, monitoring or notification opt-in.
3. Task composer: Text, voice and selected attachments, @ resources, Ctrl+K commands, / skills and bottom-left magic Enhancement. If the user gives a goal without naming file/browser/app, suggest authorized candidates and ask only if selecting the wrong one materially changes outcome.
4. Just-in-time connections: Native work guides signed companion Install → Pair → Verify; external-account work guides searchable connector → provider login/approval → scope check. Windows/macOS OS permissions, per-folder grants, Chrome profile and target computer remain separate from general website sign-in.
5. Authorized execution: Show target resources, selected model/credential source, agent/task plan, material risks, cost/budget and limited approvals. Run independent agent jobs in parallel only when justified and safe, retaining STOP and Take Over; avoid nagging prompts for authorized harmless local work.
6. Truthful live feedback: Agent/task ownership, action/event log, upload/render state, current tab/window, waiting on API, actual provider quota refusal and unresolved effects. Use honest asynchronous states; do not fabricate timed progress or claim task completion from generated text.
7. Independent verification and delivery: Verify against user objective with real file/open state, receipts and domain-specific checks. Offer editable output/download, exceptions, exact source-to-result history, safe undo or correction and clear usage. No unauthorized external send, purchase, deletion, deploy or permission expansion.
8. Return and useful retention: Optional save verified skill, approved preferences, legitimate scheduled automation and one-click repeat with NEW authorization and resource rechecks. Preserve resumed state/checkpoints without blindly replaying unknown effects. Measure verified time saved/repeat satisfaction, not dark-pattern engagement.

### 14E.8. Settings: keep six primary categories, add contextual options without duplicate screens (P0)

The binding product requirement remains exactly SIX Settings groups in settings-panel.tsx/settings-dialog.tsx: Account, Preferences, Devices, Privacy & Security, Billing & Usage, BYOK. Organize features as subpanels and settings search, with Apps & Websites hosting connector/Plugin/Skill pages, not six additional top-level Settings routes.

- Account: verified profile, current/signed-in sessions, supported passkeys/identity providers, MFA, account linking, account export/delete; fresh sign-in/assurance for sensitive changes and protection against email-only impersonation.
- Preferences: optional user memory behavior, favorite authorized apps and preferred response style/language, voice, notifications, theme/accent, text density and reduced-motion/skeleton animation settings. Memory reuse is consented, and personalization never changes security rights.
- Devices: enrolled Windows/macOS companion, selected device, browser profile, approved folders/apps/windows/tabs and inspection/control/capture scope, current connection, no mandatory Docker/VM, background capability truth and Take Over/STOP.
- Privacy & Security: inspect/edit/forget/disable/export memory, data retention, current approvals, screen/camera/microphone access, session/device/connector revocation, OAuth scope receipts, consent logs and privacy-aware support access.
- Billing & Usage: actual model calls/tokens and per-agent work, platform costs, quota status (unknown when not reported), BYOK provider bill separation, task budgets and honest error/reset status.
- BYOK: provider/model/adapter/protocol/Base URL, alias, secure API key lifecycle, selected Chat/JARVIS credential source, permissioned subagent inheritance, validation/errors and zero owner-funded inference when user BYOK selected.
- Apps & Websites (existing product area): Plugins/Skills tabs, searchable service catalog, OAuth connectors, MCP, approved custom procedures and per-resource permissions; do not misrepresent these as extra standalone application destinations.

### 14E.9. Ten additional elite refinements and detailed threat mitigation (P0 except gated options)

1. One Capability Catalog: The same typed/authorized registry powers @, Ctrl+K, app discovery, browser tab listing, selected files, plugin search, MCP, skills and agent worker placement; avoid duplicate indexes/permissions. Test thousands of synthetic entries and cross-tenant isolation.
2. Scoped Context Graph: Link only consented user-level facts, accepted project decisions, resource references and verified work in the existing storage; preserve provenance and expiry, not a second global vector memory engine.
3. Minimal Data Movement: Favor local references, targeted frame/screen regions and direct provider transfers over repeated raw uploads. Show exactly when data leaves device, destination, model and cost; receipt-bound verification.
4. Live Interference Dashboard: Customers inspect which agent owns which window/tab/file, current lease and what changed; stop/revoke through backend authority, not cosmetic UI toggles.
5. Safe Cross-Device Handoff (P1): Resume only on separately enrolled authorized machines with explicit new device grants and rechecked data locality; never make raw local paths magically accessible on another device.
6. Predictable Prompt Refinement: Preserve hard constraints through structured diff, one-click Undo and accepted user edit; measured improvements rather than longer verbosity.
7. Trustworthy Animation and Skeletons: Use layout-shaped skeleton loaders while real content loads, avoid flashing/fake progress/shimmer overuse, preserve focus and layout stability, respect reduced-motion. Graceful loading, error, offline, empty, stale and revoked states across entire website, not only home page.
8. Skill Quality and Version Quarantine (P1): Reuse independently verified workflows with current app/schema/tool capability validation; allow user-editable customization without silently broadening grants.
9. Security and authentication depth: Backend verified identity/session liveness, secure OAuth account linking, optional passkeys+MFA, CSRF/state/PKCE, exact redirect and token issuer/audience, narrow role grants, RLS/SQL/RPC/security-invoker checks, owner/staff audit, least privilege agent/device/resource leases, secrets in encrypted server store, redacted telemetry, consent withdrawals, guarded STOP/Take Over and no self-approved external side effect. Protect against prompt injection from files/web/skills/tool descriptions and long-term memory poisoning; no hidden staff or customer cross-profile search.
10. Attack proof matrix: Test User A/B leaks across embeddings, prompt enhancer, cache, vector search, memory, logs, API calls and recommendations; forged @ chips, wrong-tab identity, stale screenshots, rogue MCP/plugin, OAuth token mix-up, 401/403/429, provider-funded call crossover, file symlink and ZIP traversal, multi-GB interruption, concurrent agent conflicts, consent withdrawal and false task-completion. Existing security and task-authority owners must prove denials at API, RLS, RPC, agent and local companion layers. Use OWASP Agent Security https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html and current MCP authorization https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/index.mdx for developer research, not as a substitute for tests.

### 14E.10. Requirements integration and implementation order

- Priority: First prove identity and memory noninterference; then composer and consented enhancement; then the shared @ resource catalog, tab/app/file detection and selection; then local file transfer and grounded vision; then official OAuth providers/MCP/skills and practical plugin directory; then progressive onboarding, Settings grouping, motion and skeleton polish. Independent safe work may proceed in parallel but never bypass current source-bound quota/permission gates.
- Ownership: Extend existing Chat and JARVIS composers, signed companion, typed tool catalog, Supabase account/RLS/conversation/Library data, existing intelligence gateway and source ledgers, Apps & Websites and six-section Settings. Do not install a separate universal plugin framework, global memory database, permissions engine or competing planner. Read actual source and map KEEP/IMPROVE/MERGE/ADD/REPLACE/VERIFY/DEFER before changes.
- Release evidence: Source SHA, executable implementation, focused negative tests, independent full-site/companion CI GREEN on the exact commit, WCAG 2.2 where applicable, authenticated user studies and genuine outcome benchmarks AFTER Part 23 coding gate. A document-only update does not mean any feature works. Neither Chat nor JARVIS may claim an unavailable provider, unsupported browser, model, integration, memory protection or no-error guarantee as implemented.
- External UX research: At implementation time review other public AI products' onboarding/composer/resource-picker/attachment/loading/consent/error experiences along with W3C WCAG 2.2 (https://www.w3.org/TR/WCAG22/) and Microsoft's responsible AI interaction guidance (https://fluent2.microsoft.design/responsible-AI); adapt measurable best practices while respecting intellectual property and the OCADE design language. User testing must check trust and comprehension, not merely visuals. The final exact 30-law UI checklist is intentionally placed at the END of the pre-benchmark plan, immediately before Appendix H.

## Part 14F. OCADE foreground-safe genuinely parallel agents, app-attached floating composer and LIVE VISION ENGINE (16 November 2026; owner-approved, DOCUMENTATION ONLY)

Status and authority: REQUIRED PRODUCT SPECIFICATION, NOT CODED OR BENCHMARK-VERIFIED by this documentation change. This Part adds implementation-grade requirements arising AFTER the previous branch-head commit 03b770d4fc6614e577bd748d1f0628a00e275c03. It complements Part 14D's six-source coordination, Part 14E's account/privacy/composer baseline, Part 5's native-first safety spine and Appendix G.1's 30+4 UX principles. It does not replace them, create an independent permissions system or authorize production deployment. Where older text could imply that only one runtime agent may actually work at a time or that screenshots are the sole source of computer vision, THIS owner update clarifies the intended design.

Illustrative UI references and implementation boundary: The examples depict multiple colored pointer shapes over a repository interface, a small status bar resembling “Rebuilt by 38 agents in 11.6s,” and an app-attached floating composer. They are PRODUCT DIRECTION, NOT measured OCADE results or evidence of independent operating-system cursors. Implement the explicit requirements below, not assumptions about a demonstration. Do not hardcode the examples, app names, 38-agent count, 11.6-second claim, sample roles or demonstration tasks into production logic.

### 14F.1. Non-negotiable user experience and acceptance invariants (P0)

1. REAL parallel work: Multiple admitted subagents each own a genuine concurrently executable workstream with independent task identity, capabilities, process/worker context where applicable, input versions, output ownership, progress events, verification and cancel state. An agent's activity must correspond to actual dispatched/observed work. Several colored pointers driven by ONE serial automation worker are NOT an acceptable implementation.
2. ONE customer project: The subagents collaborate toward one authorized goal, publish independent artifacts and dependencies, and integrate only through versioned, verified state. A coordinator may itself work on an independently leased item. The number of active agents is determined by useful ready work and resource constraints, not a decorative swarm count.
3. Actual computer, actual installed tools: Prefer the user's own Windows/macOS machine and genuinely installed applications, supported plug-ins, scripts, presets, licenses, files and profiles. No mandatory VM, Docker, cloud desktop, duplicated user desktop or remote app installation for the normal customer experience. Isolated local subprocesses and separate application sessions are allowed when supported and licensed.
4. Non-interference first: The user may keep watching video, gaming, typing or working in unrelated applications. Background execution must not steal foreground focus, move the system mouse, type into the user's active window, hijack global shortcuts or require a desktop takeover. If an operation cannot be completed safely without foreground interaction, queue it, ask for an explicit Live handoff, or mark it blocked; never silently violate this invariant.
5. Many colored cursor identities, not many invented OS pointers: Each agent has a stable distinct colored virtual cursor/activity identity and visible evidence-backed progress. The overlay represents that agent's actual app target or operation. Do not claim standard Windows/macOS provides many independent system mouse cursors clicking the SAME ordinary desktop simultaneously. True simultaneous execution is through separate native APIs, app contexts, file operations, scripts, processes or genuinely independent interactive sessions; shared OS pointer input must be arbitrated.
6. Compact, app-specific overlay: The owner wants a screenshot-sized floating agent bar over the TARGET APP ONLY by default, not a permanent global dashboard. It shows truthful active-agent count, current work, live progress, Stop, Pin and expandable role/activity details. Its instruction composer is ALWAYS OUTSIDE the dropdown and stays usable when that dropdown is closed.
7. Continuous instruction changes: The user can inspect, edit instructions, redirect a named agent or the team, pause, stop and safely resume without abandoning unaffected independent work. Changes must be versioned, permission checked and propagated to affected workers.
8. Speed with correctness: Prefer direct edits, application commands, efficient text insertion, batched tool calls, concurrency and event-driven verification. Do not waste time simulating character-by-character typing or animating pointer motion as a substitute for work. No universal 11.6-second, 38-agent, zero-resource-cost or any-complex-task speed promise.
9. Visible, revocable authority: A local STOP must work without model/network availability; Pin never extends permission; the overlay cannot conceal destructive actions, fabricate progress or intercept user input unintentionally. All 30+4 UX laws apply at the highest practically beneficial level.

### 14F.2. ONE unified local execution engine, two explicit interaction modes (P0)

1. Extend the existing signed companion, device gateway, typed capability catalog, Supabase task authority, journal, model budget/router, verifier and worker pool. The product name for the capability may be OCADE Foreground-Safe Parallel Execution Engine, but do NOT create a second task engine, competing planner, second permission store, app-by-app one-off agent framework, duplicated local memory or mandatory cloud desktop.
2. Background mode (default for nonintrusive work): Execute permitted native application APIs, file operations, headless/batch tasks, CLI, background scripting, non-focus-stealing accessibility patterns and isolated browser contexts while the human controls their own desktop. Observe the target app when possible. If a UI-only action would take over the real keyboard/mouse, suspend that step and continue independent work. Keep the compact bar attached to the target window; a user can Pin the bar globally without globally exposing the target's cursor overlays.
3. Live mode (explicit handoff): When a foreground-only app/UI action is essential, clearly identify target app, exact control scope and expected interruption; the user explicitly yields control. Use the single physical pointer/keyboard stream only while the current signed lease allows it; Take Over/Stop immediately fences further actions. Switching back to Background does not make GUI-only actions magically invisible.
4. Both modes share the SAME task graph, source-of-truth project revisions, permission grants, checkpoints, visual observations, agent IDs, usage ledger and independent verification. Switching mode never resets a project, grants extra access, duplicates irreversible effects or loses accepted work.
5. Capability negotiation: For each application and installed version, discover: native API/script/headless availability, plugin compatibility, GUI-only dependencies, current app instance and license session, supported concurrent documents/instances, accessibility support, capture support, hardware requirements and whether focus is needed. Declare UNKNOWN until tested; do not infer from the app name or from a single working version.
6. Isolation is logical and resource-scoped, not mandatory VM isolation: Use separate process/job handles, temp staging directories, file snapshots/worktrees where useful, app-document leases, plugin/app commands and named worker IDs. Every process launched by OCADE is tracked and reaped or explicitly detached under the existing safe-job contract.

### 14F.3. Genuine multi-agent execution, cursor ownership and resource arbitration (P0)

1. Independent work channels: Each subagent owns a task-graph node or safe partition, structured context, capability allowlist, local process/app-session reference, resource lease set, tool-call budget, checkpoint and current observation revision. Its work proceeds concurrently with disjoint nodes. One worker waiting for model output, render completion, network or approval does not freeze other independent workers.
2. Resource model: Canonical resources include project revision, source file/hash, destination file, application process/instance, document, scene, timeline, browser context/tab, OS window, native plugin bridge, GPU-intensive job, external account and irreversible external transaction. Declare read/write sets before admission. Use read sharing where safe, exclusive writer leases with fencing generations for conflicts, optimistic expected-version checks, and transactional staging/promote.
3. No global artificial serialization: The coordinator controls authority and schedules conflicting effects; it is NOT a global execution mutex. Parallelize native script calls against independent instances/documents, file preprocessing, asset generation, API-backed edits, verification, tests and rendering within safe limits. Serialize only operations that share unsafe mutable state, OS input, a non-reentrant application API or a bounded hardware resource.
4. Application thread safety: An app may expose one main UI/event loop or document state that cannot be mutated simultaneously. Agents can still prepare work concurrently, then enqueue validated main-thread operations through a single in-app dispatcher for THAT shared resource. Report queued versus actively executing honestly; do not count a waiting agent as concurrently clicking.
5. Color and pointer semantics: Assign an accessible, stable agent color plus name/shape/pattern (not color alone), keyed to immutable agent ID. Render one independent virtual pointer per active agent where an actual target position/region exists; pointer position comes from the agent's observed target/action metadata and capture geometry, never a random animation. For API/file/headless work without a meaningful pointer coordinate, show a colored agent indicator over the relevant app region/object or in the dropdown, not a fabricated mouse click. Permit user to hide all cursors while work continues.
6. Real-time synchronization: Source revision changes, lease acquisition/release, pending/started/verified effects, app events and verification are broadcast with bounded authenticated event queues. Duplicate, late and reordered messages cannot create effects. On a user edit, compare expected source version; preserve the human's edit, stop conflicting operations, invalidate only affected descendants and rebase/ask where needed.
7. Concurrency policy: Dynamically admit useful agents by ready DAG nodes, capability, CPU/RAM/GPU/VRAM, disk, model/provider quotas, BYOK funding and user foreground workload. Scale down idle workers. Count active executing, waiting, paused and blocked separately; never use an inflated logical-agent count as a success metric.
8. Conflict and recovery: Keep immutable staged inputs/outputs, bounded rollback, exact hash receipts and per-agent last safe checkpoint. A crashed worker loses its lease by fencing epoch, not merely by elapsed time. Unknown side effects are quarantined for inspection; never blind-retry external submissions, saves or destructive edits.

### 14F.4. Exact app-attached floating composer contract (P0, owner-selected layout)

1. Visual reference: Small, restrained, premium, rounded dark/glass or theme-adaptive floating control bar comparable in scale to the owner's screenshot. Compact single-line status first; expandable details below; a separate, ALWAYS PRESENT adjacent/below-bar instruction composer. Use responsive constraints and OS DPI scaling rather than a rigid pixel size. The design is OCADE-original, not copied proprietary UI.
2. Collapsed bar contents, all still visible: OCADE/target app identity; distinct small agent-color indicators; factual number of ACTIVE agents; one short current-work summary such as “Applying effects” or “Classifying files”; truthful activity/progress indicator; expandable chevron; Stop; Pin. A separate composer remains visible and enabled when the role dropdown is collapsed.
3. Expanded dropdown, ONLY agent details: List each agent's stable name/role, color+icon, current task, actual app/file/scene or scoped resource, executing/queued/waiting/blocked/paused/verifying status, latest event timestamp, completed/total verifiable steps or indeterminate progress, current lease and reason if blocked. Roles are dynamically assigned by capabilities and task DAG, not hardcoded to Blender/Effects/Files.
4. Composer OUTSIDE dropdown (explicit owner correction): A text input/composer stays in the compact floating control surface independently of the dropdown's open/closed state. Enter/Send submits an authenticated new instruction; Shift+Enter inserts a newline where multiline is supported; allow targeting all agents or a specific named agent; retain draft while dropdown toggles, target window changes, Pin changes, connection drops or a new instruction is in flight. Never auto-send on collapse.
5. Ongoing instructions: Display accepted/queued/rejected instruction state and exact target agents; use a durable instruction ID, source task revision, authorization and acknowledgement. The coordinator checkpoints affected tasks, revises the DAG, cancels/rebases stale work and leaves unrelated agents running. Sensitive new permissions, purchases, external sends or destructive effects still require separate scoped approval. Never imply that typing in a composer automatically changes already committed work.
6. Live progress, not cosmetic percentages: Progress derives from journaled action transitions, app events, durable render/export jobs, bytes confirmed, actual verified milestones or real per-agent receipts. Show “Working,” “Waiting for app,” “Verifying,” “Blocked by foreground UI,” “Stopped” or “Unknown” if numeric progress is not measurable. Do not fabricate a percent, ETA, progress bar movement or model throughput; avoid continuous motion if no event occurred.
7. Stop semantics: The always-visible Stop button invokes existing local STOP epoch and fences all subagent leases/actions, including when the website or network is offline. Distinguish STOP ALL from optional Pause/Resume and per-agent Stop; cancellation of noninterruptible renders is best-effort and visibly acknowledged only after confirmed state. Stop must never be a UI-only toggle.
8. Pin semantics: Unpinned bar follows the authorized target window and is hidden when another unrelated application has focus, except user-invoked inspector. Pinned bar stays compact and visible across application switches, showing target app identity and live status without stealing focus, typing into the current app, showing target content in unrelated apps or granting new screen-capture scope. Allow Unpin; respect OS window managers, multi-monitor DPI and full-screen/game safety.
9. App attachment: Bind overlay to the actual target window identity (OS handle/window ID + process identity + creation epoch + device/session + task authorization), not only an app name. Handle app restart, title change, multiple windows/documents, window move/resize, negative monitor coordinates, scaling, tab changes, minimization and focus transitions. Never overlay another user's app/window or an unrelated process with a reused handle.
10. Input safety and polish: Prefer a click-through transparent agent-pointer layer with a separately interactive bar/composer. Overlay cannot consume unrelated app clicks or intercept keys except when composer explicitly focused; never draw over password fields/secure OS dialogs. Keyboard navigation, screen-reader status, reduced motion, 200% scaling, high contrast, safe hit targets, accessible agent-color patterns, compact overflow, visible error states and non-obscured Stop are mandatory.
11. Website mirror: The existing website JARVIS task panel mirrors authenticated per-agent roles, progress, STOP, Pin state where relevant and instruction history. Do not create a second state authority or let an offline website pretend that a local instruction was delivered. Local bar remains useful when the browser is minimized or offline, within already authorized scope.

### 14F.5. Live interventions, user edits and truthful task state (P0)

1. Each new instruction is an immutable versioned user intent event with authenticated task/device/session, target agent IDs, original text, client sequence, current project revision and desired priority. Acknowledged does not mean executed; executed does not mean verified.
2. The coordinator computes affected nodes and dependency descendants, records a new project revision, invalidates only conflicting work, sends cancellation/rebase to those workers, preserves accepted independent artifacts and continues unaffected work. When instructions contradict a previous irreversible effect, explain the conflict and request an explicit recovery decision rather than claiming undo.
3. The floating bar displays active agent count, exact role/current operation, last event age, dependency blockers and verification outcome. A user can open an agent's detail to inspect receipts, exact modified files and source of any delay. Redact private file paths and secrets from incidental overlays unless the authorized owner explicitly expands them.
4. A stale UI event, disconnected device, rejected model quota, missing application license, app modal, crashed plugin or uncertain write must show a truthful blocked/unknown state. No simulated activity cursors or progress to disguise an idle worker.
5. The website and native companion share the same event contract, and the native STOP remains effective when Supabase, model provider or website cannot be reached. Reconnect reconciles event sequence and authority before enabling new actions.

### 14F.6. Foreground-safe local automation and actual installed app compatibility (P0)

1. Foreground Protector: Detect current active window/app, fullscreen/exclusive fullscreen, user mouse/keyboard activity (without recording private keystrokes), system load, battery/thermal state, resource pressure and current permission. Throttle/queue expensive or intrusive background jobs; do not promise zero CPU/GPU impact. Avoid overlaying exclusive-fullscreen games, interfering with anti-cheat, screen-recording secure surfaces or hijacking focus.
2. App-native first: Discover supported native API, command line, scripting host, file format, installed plugin/add-on bridge and document model. Reuse the user's existing licensed installation when supported. Do not assume add-ons requiring a viewport, login, hardware context or UI thread work in headless mode, and do not copy/rehost licensed plugins without authorization.
3. Blender reference only (NOT a hardcoded product path): For supported tasks use installed Blender Python/bpy, documented background rendering/CLI, object/scene state, addon capability checks, staged assets and optional in-process main-thread bridge. Concurrent agents can create textures, geometry source, assets, scripts and renders in independent processes; mutation of one shared open Blender scene must be marshaled safely through its supported main thread or isolated documents, not unrestricted concurrent bpy thread writes. A minimized/occluded viewport may not provide fresh visible frames; native state remains available if supported.
4. Other creative apps as capability examples: Premiere/Photoshop supported UXP/extension APIs where available; After Effects documented render automation; DaVinci Resolve supported scripting where licensed and exposed; media preparation via ffmpeg, OpenTimelineIO/FCPXML/AAF where compatible; CAD/DCC/document applications through their supported interfaces. Do not assert all versions expose all APIs, that external timeline formats preserve every feature, or that a GUI-only feature can run invisibly.
5. Safe staged workflow: Copy/derive input → execute on permitted workspace/instance → observe state → verify artifact/format/result → atomically promote or save with expected revision → report receipt. Preserve original user edits and external references. Require explicit permission for destructive changes or external publishing.
6. Fallback policy: If the only route is physical UI interaction and the user is actively using the PC, wait or request Live mode. A second monitor, hidden desktop, patched RDP, unapproved virtual display, mandatory VM, Docker, cloud machine or invisible click-through control is NOT a universal supported substitute.
7. Resource governor: Cap simultaneous heavy GPU jobs on constrained devices, prioritize foreground responsiveness, use app-supported low-priority background processes and OS-specific scheduling, avoid simultaneous redundant render loads, and let the user configure background resource limits. Show truthful estimated impact, current throttling and deferred work.

### 14F.7. Speed: actual throughput, high-speed text and efficient coordination (P0)

1. Direct insertion instead of fake typing: For supported editors/apps use authorized API insertion, batch document updates, native edit commands, clipboard paste with secure clipboard restore where appropriate, DOM fill, direct file writes and transactionally applied diffs. Preserve encoding, caret/selection, formatting, undo and focus. Do not type every character slowly merely to animate an agent.
2. Batch deterministic operations: Compile stable substeps into guarded native scripts, application commands or file transforms; validate inputs once per revision and verify outputs once per meaningful boundary. Avoid model calls per mouse movement, repeated unchanged screenshots, per-character keystrokes or full tool-schema resend.
3. Parallel DAG scheduling: Execute independent work concurrently, run I/O and compute asynchronously, use work-stealing only within lease/capability constraints, prefetch allowed metadata, reuse compiled verified skills and cache immutable observations. Never parallelize overlapping file writes, unbounded model calls or unsupported app mutations.
4. Resource-aware model budget: Share provider quota, concurrency and cost admission across all agents, including BYOK. Deduplicate equivalent subcalls, use small delta context, route trivial deterministic work without an LLM, and escalate only uncertain or visually complex steps to qualified models. No unauthorized model/source switch.
5. Real speed reporting: Separate model wait, observation/capture, perception inference, tool dispatch, app execution, render/export, lock wait, verification, UI event delivery and human approvals. Record wall time and sum of worker CPU time separately; N workers finishing in parallel does not imply N-fold speedup. Compare against a one-agent native-first baseline on identical seeded tasks and device conditions.
6. Video example boundary: The owner's reference image displayed “38 agents” and “11.6s” for another UI. This is NOT a measured OCADE result, not proof of 38 independent desktop pointers, and not a universal task-speed target. Optimize for correct verified completion time, low foreground disruption and cost, not a swarm animation.

### 14F.8. **VISION — OCADE LIVE VISION ENGINE: ten complementary real architectures (P0)**

Primary decision: Vision is a FIRST-CLASS continuous OBSERVATION service within the existing Local Execution Engine, not a screenshot-only polling loop and not a new authority/controller. Primary observation combines native application state/events, browser DOM/CDP or OS accessibility where applicable, plus continuous target-window video for visual context. Screenshots remain available as precise, scoped, on-demand keyframes/fallbacks; screenshots are NOT the sole perception channel. “Live video preview” and “AI continuously understanding video” are DIFFERENT capabilities and must be tested separately.

| # | Architecture / priority | Observation/action role | Trigger and use | Known boundary |
|---|---|---|---|---|
| V01 | **Native app object model, scripting, event callbacks — primary** | Exact structured scene, layer, document, selection, render, plugin and save state | Subscribe to supported app events; read small typed deltas; act via native commands | App/version/license/thread support varies; not every visual effect is represented |
| V02 | **Browser DOM, CDP, Playwright, accessibility snapshots — primary for browser** | Elements, text, attributes, navigation, selection, page state | DOM mutation/navigation/network events, validated tab/origin | Canvas/WebGL/video pixels need visual observation; no access to unrelated personal browser tabs by default |
| V03 | **OS accessibility/UIA/AX trees — primary for supported native UI** | Semantic controls, labels, roles, values, geometry, enabled/visible state | OS accessibility events plus cached scoped inspection | Custom GPU-rendered UI, games and 3D viewports may expose little |
| V04 | **Continuous app/window-scoped video capture — primary visual awareness** | Temporal pixels, viewport changes, motion, visual feedback | Native capture callback/stream while target renders and permission remains | Capture may be blank/stale when minimized, protected, not rendering or OS-blocked |
| V05 | **Event-driven observation and capture scheduling — primary efficiency** | Reacts only when meaningful app/user/tool events occur | App events, scene/document changes, render status, UI actions, idle backstop | Missed events require bounded resync and stale-state detection |
| V06 | **Frame hashing, region differences, temporal keyframes — primary efficiency** | Detects changed areas and filters duplicate frames | Hash/ROI compare, scene change, unexpected UI, agent action | Pixel changes do not alone prove semantic state or save success |
| V07 | **Multimodal temporal/video understanding — selective escalation** | Interprets motion, viewport transformations, animation and visual-only tasks | Significant ambiguous change, keyframe sequence, short bounded clip | Model video input capabilities, FPS, latency, cost and privacy vary; no guarantee every frame is understood |
| V08 | **Targeted screenshots and region crops — precision/fallback** | High-resolution text, precise coordinates, pre/post visual evidence | Ambiguous control, stale target, visual verifier, missing video API | A single image is not a live stream; stale coordinates require revalidation |
| V09 | **OCR + UI/icon parsing + visual grounding — conditional fallback** | Detects text, icons and clickable boxes from captured frames | UI inaccessible through native/DOM/AX, user-selected point/region | OCR/icon detector can misidentify; model output is untrusted until target verified |
| V10 | **Verified workflow recording/replay — execution accelerator** | Reuses known successful typed steps with guards and readback | Repeat task on compatible app state/version | Not a vision source itself; stop/replan when preconditions drift |

Selection rule: Use the cheapest reliable structured source for a fact; keep continuous visual context available where permitted; perform change detection BEFORE expensive AI perception; request a targeted high-resolution frame/short clip only when the current task needs it; use independent saved-result verification to certify effects. “Screenshot last” means last-resort control/grounding when richer semantics are unavailable, not “disable screenshots” or “ignore visual evidence.”

### 14F.9. Continuous target-app capture pipeline, not screenshot polling (P0)

1. Windows: Prefer Windows.Graphics.Capture / WinRT window capture (HWND/window item), Direct3D11 frame-arrival callbacks and GPU-side change/copy where practical. Avoid a full-display recorder and unnecessary CPU readback for every compositor frame. Respect OS capture consent, protected-content restrictions, resize/DPI, GPU resets, minimized/closed windows and target-identity renewal. Screenpipe's Windows Graphics Capture implementation is a concrete reference, not a drop-in license/compatibility guarantee.
2. macOS: Prefer ScreenCaptureKit SCStream with a target-window/application content filter and OS Screen Recording authorization; manage filter/window identity, Retina scale, stream lifecycle and permission revocation. The inspected CUA macOS backend shows ScreenCaptureKit VIDEO RECORDING, not a completed live AI perception loop; adapt native capture semantics without conflating them.
3. Browser: For the OCADE-owned authorized browser use CDP Page.startScreencast / Page.screencastFrame and frame acknowledgements, or browser-native video capture where supported; pair frames with DOM/navigation/accessibility events. OpenClaw and Nod show real browser streaming paths. Their preview streams do NOT establish that every frame is analyzed by an LLM.
4. One capture per target app/window: A shared authorized capture service fans out timestamped frames and structured events to multiple agent subscriptions and the user preview. Avoid N independent 30-FPS capture processes for N agents. Scope every frame to account, device, task, window, process generation, display geometry, capture permission and expiry.
5. Separated preview vs AI rates: Preview may target smooth 15–30 FPS on capable devices when visible and permitted, adapting lower for load/battery/network; AI analysis starts from events/keyframes at a substantially lower adaptive rate (e.g. 0.2–2 FPS, brief higher-rate bursts only when justified). These are INITIAL TUNING HYPOTHESES, not guaranteed rates or provider capability claims. Never send 30 FPS to an expensive model merely because preview renders at 30 FPS.
6. Bounded memory/backpressure: Maintain a latest-N ring buffer and timestamped keyframes, drop superseded frames, avoid unbounded JPEG/base64 copies, separate video encoder from model analysis, use bounded queues/ACKs and cancel stale inference on task revision changes. For agent-specific questions, crop the region of interest from the shared frame and preserve transform/scale metadata.
7. Minimized/occluded/protected windows: Distinguish visible fresh frame, last known frame, unavailable capture, native state still available and genuinely blocked. Do not claim to see a minimized Blender viewport if it stops rendering; continue native-state/headless work when supported, request Live handoff only for unavoidable GUI-only inspection.
8. Permissions/privacy: User grants only the target app/window and task scope. No incidental desktop-wide capture, microphone/camera, passwords, unrelated notifications or secret-bearing screenshots. Redact sensitive regions before model/preview, use ephemeral local buffers by default, and disclose any off-device frame/clip transfer, provider, retention and BYOK cost.

### 14F.10. Event-driven multimodal perception and shared agent world state (P0)

1. Capture → events → filter → understand: Ingest native app state changes, DOM mutations, accessibility notifications, window/process state, render job events and frame-arrival callbacks into a single timestamped event stream. Coalesce bursts and use a bounded idle/backstop refresh to detect missed events. Do not poll the model to wait for renders.
2. Cheap filtering first: Compare hashes, downsampled pixel differences, region-of-interest changes and known expected effects. Skip unchanged frames. Escalate unexpected motion, scene transitions, modal dialogs, missing controls or mismatched expected state to OCR, visual parser or multimodal reasoning.
3. Temporal context: For motion, provide short ordered keyframe sequences or a provider-supported live-video input with accurate timestamps and app-state annotations. Never assume all providers accept video, unlimited FPS, audio, or the same input pricing. Fallback to bounded frame batches if provider lacks true streaming video input.
4. Shared state store: Maintain ONE versioned, permission-scoped per-target observation snapshot: app/document revision, window/process identity, capture generation, native/DOM/AX facts, frame timestamps, relevant crops, visual uncertainty, pending tool effects and user edits. Each subagent subscribes to the smallest authorized portion; all use the same capture source and conflict-aware revision model.
5. Agent-specific perception: Effects agent may receive viewport/keyframe and effect stack; assets agent receives authorized asset list and file events; lighting agent receives scene state and selected viewport region. These are EXAMPLES of dynamically assigned work, never hardcoded roles. Independent agents may reason in parallel; their write authority remains resource-scoped.
6. Confidence and freshness: Track provenance for every observation (native/DOM/AX/frame/OCR/model), capturedAt, observedAt, target/window ID, geometry, revision, confidence and expiry. A visual suggestion is NOT a trusted action target until the local worker revalidates current identity/geometry and relevant preconditions. Unexpected overlay, popup, focus change, user input or navigation invalidates stale coordinate grounding.
7. No fake progress from pixels: An animation playing, a spinner disappearing or a “Saved” toast does not independently prove a file was saved. Prefer native readback, saved-file parse/hash, API confirmation, durable app/job receipts and independent verifier checks.
8. Failure and degradation: On capture loss, model rate limit, app permission denial, OCR failure, plugin crash or high system load, preserve last verified facts with stale labels, continue only safe native operations and show blocked/unknown status. Never secretly switch to full-desktop capture or an unauthorized model to keep the UI animated.

### 14F.11. VISION repository references — inspected implementation files and their exact roles (16 Nov 2026)

Provenance rule: These are source-code REFERENCE POINTS from inspected GitHub implementation files, not code copied into OCADE, not proof of OCADE functionality, and not a claim that any source project implements the entire proposed pipeline. Re-open current upstream revisions and inspect licenses, compatibility and security before reuse. Preserve the source links and exact mechanisms as engineering references.

| Repository | Main inspected file / link | Confirmed mechanism to study | Do NOT assume |
|---|---|---|---|
| **OpenClaw** https://github.com/openclaw/openclaw | https://github.com/openclaw/openclaw/blob/main/extensions/browser/src/browser/screencast/session.ts | CDP Page.startScreencast, Page.screencastFrame, JPEG payloads, WebSocket viewers, frame ACK/backpressure | Browser preview is not automatically continuous AI interpretation or native Blender capture |
| **n8n Nod** https://github.com/n8n-io/nod | https://github.com/n8n-io/nod/blob/main/src/providers/agent-browser/index.ts | Browser view async generator, WebSocket stream_status, latest frame, pacing=ack/maxFps=30, per-frame ACK, separate getScreenshot | Its agent tool screenshot/snapshot path is not proof every streamed frame is sent to AI |
| **n8n Nod** | https://github.com/n8n-io/nod/blob/main/src/runtime/tools.ts | Semantic browser snapshot, typed browser actions and screenshot tool | Browser toolset does not provide native multi-pointer desktop input |
| **Microsoft UFO** https://github.com/microsoft/UFO | https://github.com/microsoft/UFO/blob/main/ufo/automator/ui_control/inspector.py | Windows UI Automation, cached control lookup, Win32 window discovery | UIA is incomplete for custom 3D/canvas viewports |
| **Microsoft UFO** | https://github.com/microsoft/UFO/blob/main/ufo/automator/ui_control/screenshot.py | Control screenshot fallback: pywinauto → PrintWindow → desktop capture | Desktop fallback is not automatically permitted by OCADE's narrow capture grant |
| **CUA** https://github.com/trycua/cua | https://github.com/trycua/cua/blob/main/libs/cua-driver/rust/crates/cua-driver-core/src/video.rs | Cross-platform video recording abstraction: macOS native; Windows/X11 ffmpeg; Wayland compositor routing | Video recording alone is NOT continuous multimodal AI perception |
| **CUA** | https://github.com/trycua/cua/blob/main/libs/cua-driver/rust/crates/platform-macos/src/video_sckit.rs | Native macOS ScreenCaptureKit SCStream recording backend | The inspected recording implementation is not a complete shared per-window live-vision bus |
| **CUA** | https://github.com/trycua/cua/blob/main/libs/cua-driver/rust/crates/cua-driver-core/src/capture_scope.rs | Window/desktop capture scope policy and tool scope | Scope defaults are not permission grants across tenants |
| **Ruflo** https://github.com/ruvnet/ruflo | https://github.com/ruvnet/ruflo/blob/main/v3/@claude-flow/browser/src/infrastructure/agent-browser-adapter.ts | Browser snapshot/screenshot adapter | No general real-time desktop video perception was established |
| **Hermes Agent** https://github.com/NousResearch/hermes-agent | https://github.com/NousResearch/hermes-agent/blob/main/apps/desktop/electron/command-screenshot-capture.ts | Explicit gesture/permission-gated window screenshot, one capture per authorization token | Not a continuous live-video perception engine |
| **Screenpipe** https://github.com/screenpipe/screenpipe | https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-engine/src/event_driven_capture.rs | Event-triggered observation, accessibility, bounded capture, visual probes | Broad personal-screen recording must NOT be copied as an OCADE default |
| **Screenpipe** | https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-screen/src/wgc_capture.rs | Native Windows Graphics Capture and on-demand GPU-side frame copy to avoid constant CPU readback | Performance depends on device/driver and implementation |
| **Screenpipe** | https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-screen/src/frame_comparison.rs | Hash/visual-difference filtering before expensive OCR/analysis | Frame similarity does not certify semantic task correctness |
| **Vision Agents** https://github.com/GetStream/Vision-Agents | https://github.com/GetStream/Vision-Agents/blob/main/agents-core/vision_agents/core/utils/video_forwarder.py | Shared video track with bounded latest-N queue and per-handler FPS routing | Forwarding frames is not automatically safe/action-authorized GUI control |
| **OmniParser** https://github.com/microsoft/OmniParser | https://github.com/microsoft/OmniParser/blob/master/util/utils.py | Visual icon detection, OCR/box fusion, annotated UI grounding | A detected icon is not an authorized or always-correct click target |
| **OpenAdapt** https://github.com/OpenAdaptAI/OpenAdapt | https://github.com/OpenAdaptAI/OpenAdapt/blob/main/packages/flow/README.md | Guarded recorded-workflow replay, saved-result readback and safe mismatch stop | Published demo benchmarks do not predict OCADE speed on every app |
| **Win32CaptureSample** https://github.com/robmikh/Win32CaptureSample | https://github.com/robmikh/Win32CaptureSample | Native Windows.Graphics.Capture reference implementation | Sample is not an OCADE production security/capture service |
| **Gemini Live API examples** https://github.com/google-gemini/gemini-live-api-examples | https://github.com/google-gemini/gemini-live-api-examples | Reference for model-provider video input where the currently approved provider/model actually supports it | Do not assume universal video FPS, quotas, privacy approval, free use or BYOK compatibility |

Combination decision: Use Screenpipe's event/difference ideas and Windows capture implementation + native macOS ScreenCaptureKit and Windows sample + OpenClaw/Nod CDP browser stream + UFO UIA/AX-equivalent semantic observation + Vision Agents' bounded frame fan-out + OmniParser only for unexposed visual UI + OpenAdapt-style guarded replay. Ruflo/Hermes contribute coordination, checkpoints and narrow screenshot security. Implement all as ADAPTERS of the existing OCADE engine, not copied wholesale products.

### 14F.12. Unified observation, action and progress contracts (P0)

1. Agent identity contract: projectId, taskId, agentId, agentRole (dynamic), agentColorId, deviceId, appInstanceId, currentNodeId, executionChannel, resourceReadSet, resourceWriteSet, currentLeaseEpoch, expectedProjectRevision, modelBudgetSource, state and lastHeartbeat. Identity is immutable for one agent run; visual color is presentation, never permission.
2. Observation envelope: observationId, task/device/session, target app/window/tab/process generation, sourceType (native, DOM, AX/UIA, frame, OCR, video-model), source revision, frame/keyframe timestamps, geometry/scale/transform, region, freshness TTL, capture grant, redaction policy, content hash and confidence. Sensitive raw pixels are local and short-lived unless the customer opts into retention.
3. Progress event envelope: eventId, sequence, agentId, taskNodeId, expectedRevision, eventType (ASSIGNED, QUEUED, STARTED, APP_EVENT, FRAME_OBSERVED, ACTION_PROPOSED, ACTION_DISPATCHED, ACTION_CONFIRMED, VERIFYING, VERIFIED, BLOCKED, FAILED, PAUSED, STOPPED, RESUMED), exact target, timestamp, elapsed duration, optional measurable completed/total units, receipt ID, uncertainty and redacted display summary. The bar derives state from events, not from model-generated prose.
4. Instruction envelope: instructionId, account/session/task/device, target agentIds or team, user text, client sequence, expected project revision, allowed scope, acceptedAt, acknowledgedBy, affected nodes, new revision and dispatch status. Retry uses idempotency and revision guards; a message cannot bypass the same task authority used by the website.
5. Action envelope: signed grant, resource lease, STOP epoch, target identity, observation freshness, exact action/typed arguments, idempotency key, deadline, app capability, preconditions, side-effect class and postcondition verifier. Recheck immediately before mutation; no raw pointer coordinates from a remote model without local target validation.
6. Storage and privacy: Persist durable state, audit events, accepted artifacts and necessary checkpoints in existing stores. Use ephemeral local ring buffers for video, bounded retention for screenshots, encrypted account-scoped credentials and privacy-safe diagnostics. Do not create an unbounded global recording archive, new surveillance memory or a second project database.
7. Transport: Prefer authenticated local IPC from companion overlay to local broker, and existing authenticated server/event channels for website mirror. Backpressure, ACKs, monotonic generations, cancellation, stale subscription revocation, reconnection and STOP priority are mandatory. Do not expose raw CDP debugging or unauthenticated WebSocket capture ports.

### 14F.13. Security, consent, safety and noninterference proof (P0)

1. Test exact per-app capture grants and redaction: switching from Blender to banking/password manager, a private chat, a different user's session or an unrelated game must not capture or transmit those surfaces. Pinned status must not imply pinned capture of the whole desktop.
2. Reject unauthorized frame subscriptions, agent escalation, cross-tenant/cross-project task state, forged colored cursor identity, stale window handles, swapped app processes, forged task events, malicious extension/MCP output, replayed instruction IDs and revoked OS Screen Recording grants.
3. Test local STOP with internet disconnected, model provider stalled, overlay minimized, pinned bar, rendering in progress and multiple agents writing independent artifacts. No agent may continue an unauthorized new effect after STOP epoch changes; noninterruptible external jobs must be reported as such.
4. Protect user input: simulate gaming/fullscreen, YouTube, typing in a different app, global hotkeys, IME composition, multi-monitor mixed DPI, window movement, alt-tab, app minimization, app crash and password dialogs. Measure and enforce zero unapproved focus grabs and zero unauthorized system pointer/keyboard events.
5. Protect hardware: monitor CPU/GPU/VRAM, memory, thermal/battery, disk and render pressure. Bound queues, capture buffers, model calls, process count and background job priority. Pause expensive capture/model analysis when a foreground game needs resources; show throttling rather than falsely claiming unchanged speed.
6. License and plugin safety: use only documented and customer-authorized app APIs; do not bypass license checks, anti-cheat, protected screen capture or proprietary extension limits. Verify third-party source licenses and security before integrating upstream code.
7. Security/UX approvals: Routine preauthorized reversible work should not prompt repeatedly; new destructive/external/financial/security-sensitive effects must show exact scope and request explicit approval. A subagent, model or UI overlay cannot self-approve a broader grant.

### 14F.14. Independent acceptance tests and hard negative cases (P0)

| ID | Mandatory test | Passing evidence |
|---|---|---|
| OCV-01 | Four independent subagents execute four genuinely disjoint jobs concurrently on one project | Overlapping actual execution intervals in durable job traces, distinct output hashes and successful integration; not merely four animated cursors |
| OCV-02 | Two agents attempt conflicting edits to one document/scene | Only authorized current writer mutates; other queues/rebases; no silent lost update |
| OCV-03 | Four colored virtual cursor identities are shown over the assigned app | Every visible pointer maps to a real agent ID and observed action/region; API-only worker is not falsely shown clicking |
| OCV-04 | User types and watches video in unrelated app while background agents work | No unauthorized focus/keyboard/mouse hijack; correct project output and user app input preserved |
| OCV-05 | Exclusive-fullscreen game and low-end resource pressure | Overlay respects game/anti-cheat constraints; work throttles/queues; no promise of zero FPS impact |
| OCV-06 | Blender-like native app with shared main-thread state | Independent preparation parallel; shared app mutations serialized safely; project reopens and verifies |
| OCV-07 | Installed plugin/add-on requires UI or license session | Capability marked unsupported/headed-required; no silent headless claim or license bypass |
| OCV-08 | App window closes, restarts, moves or becomes minimized | No wrong-window overlay, stale pointer click or false live frame; recovery/status truthful |
| OCV-09 | Collapsed floating bar | Count, work summary, progress state, Stop, Pin AND outside-dropdown composer remain visible |
| OCV-10 | Expanded agent dropdown | Every agent shows color/role/current action/state/real progress; composer stays outside and usable |
| OCV-11 | Pin and Unpin while switching applications | Unpinned overlay target-only; pinned status global without focus theft or unintended screen capture |
| OCV-12 | Mid-task instruction changes a dependent artifact | Only affected DAG descendants invalidated; unaffected agents continue; revision receipts agree |
| OCV-13 | STOP while several agents and app jobs run; network unplugged | Local STOP fences all new effects and reports noninterruptible jobs accurately |
| OCV-14 | Fast large text insertion | Correct byte/text content, formatting, caret/undo behavior and no per-character fake typing where API insertion exists |
| OCV-15 | Continuous Windows target-window video | Actual timestamped frame arrivals for supported target; no unapproved desktop-wide capture; resize/GPU reset recovery |
| OCV-16 | Continuous macOS target-window video | OS permission respected, target identity maintained, stale/blocked/minimized state detected |
| OCV-17 | Browser live screencast + DOM | Fresh frames with navigation/scroll metadata, ACK/backpressure and correct semantic target identity |
| OCV-18 | Native app state + video + accessibility fusion | Cross-source disagreement produces uncertainty/re-observation, not invented certainty |
| OCV-19 | Unchanged 30-FPS preview over an idle window | Bounded low model-call rate; unchanged frames filtered; measured CPU/VRAM and queue memory |
| OCV-20 | Rapid scene motion and transient modal | Relevant temporal keyframes/short clips used where supported; modal detected without stale action |
| OCV-21 | Screenshot/ROI fallback and OCR/parser | Precise bounded crop, source identity, consent and geometry; stale or ambiguous target safely refused |
| OCV-22 | Save toast displayed but saved file corrupt or unchanged | Independent verifier rejects completion despite visually convincing animation |
| OCV-23 | Screen permission revoked or sensitive app comes to foreground | Frame/model transfer stops promptly; no unauthorized capture or stored secret pixels |
| OCV-24 | Model lacks video input or BYOK quota exhausted | No unauthorized hidden provider call; bounded fallback or blocked state and accurate cost |
| OCV-25 | Multi-agent shared capture fan-out | One source stream, per-agent region subscriptions, bounded latest-N buffers, no N-fold capture cost |
| OCV-26 | One agent crashes, lease expires and resumes | Fencing prevents old writer; only safe work reassigns; no duplicated external effect |
| OCV-27 | Website offline but local bar connected to companion | Local STOP works; instruction status distinguishes queued/undelivered; website reconciles on reconnect |
| OCV-28 | Overlay accessibility and UX | Keyboard/assistive tech, contrast, reduced motion, 200% zoom, mixed DPI and visible Stop pass relevant WCAG 2.2 AA tests |
| OCV-29 | Same task one agent versus N agents | Report first-attempt verified success, median/p95 wall time, per-stage latency, cost, hardware load, interventions and speedup with confidence intervals |
| OCV-30 | User reference “38 agents/11.6s” versus measured OCADE task | Never present reference as OCADE performance; measured results only with reproducible task, device, source SHA and independent oracle |

Additional edge cases: simultaneous task replan and Stop; user edits target file while an agent holds lease; two projects using same GPU; multiple app instances with identical titles; stale video after screen lock; Wayland/Windows/macOS unsupported capture; occluded or DRM/protected frames; 401/403/429 provider errors; changed application/add-on version; non-English/RTL UI; audio/video clip timestamp drift; multi-GB assets; task interrupted after a save request but before acknowledgment; compromised plugin/MCP text; concurrent user/agent pointer intent; hidden fullscreen status; clock skew and out-of-order events.

### 14F.15. Performance and quality qualification: what “fast” means (P0)

1. Extend Part 15 reports with time to first real agent action, true concurrent-active agent count over time, independent work overlap, capture-to-preview latency, event-to-agent-observation latency, perception model calls/frame samples, screenshot fallback frequency, direct text insertion throughput, lock wait, app API call latency, GPU/CPU/RAM/VRAM use, UI focus violations, user foreground responsiveness, model quota/cost and independently verified end-to-end completion.
2. Measure preview FPS and AI perception sampling separately; a smooth preview is NOT evidence of AI perception speed. Record dropped frames, queue length, stale observation rate, capture permission failures and recovery time. Test native-state-only, video-only and combined hybrid perception with identical tasks; keep the simplest mode when richer vision adds no value.
3. Use reproducible Windows 10/11 and macOS real-device tests spanning weak laptop, normal PC and high-end workstation, varied DPI, multiple monitors and supported app versions. Test user actively using unrelated apps and the same app in Live handoff. Do not infer actual performance from mock UI, screenshots or another repository's demo.
4. Compare at least: (A) existing native-first single-agent baseline, (B) parallel agents without extra video AI, (C) parallel agents plus event-driven hybrid vision, and (D) excessive always-on per-frame vision as an anti-baseline. Rank by independently verified success and zero wrong-target effects FIRST, then foreground disruption, wall time, model cost and resource use. Reject a faster configuration if it corrupts projects, violates privacy or hijacks input.
5. Engineering tuning hypotheses (NOT guarantees): smooth preview as resources permit; AI keyframes normally sparse/event-triggered; immediate local visual acknowledgment of instruction receipt; bounded event queues; no arbitrary per-character typing; adaptive worker count; no mandatory video inference during long unchanged renders. Choose thresholds from measured devices and provider capability, not unsupported universal speed claims.

### 14F.16. Source-code ownership, integration order and anti-bloat controls (P0)

1. Map existing owners BEFORE editing: Existing Supabase task/STOP/journal/RPC authority; planner.server.ts and supervisor.ts; device-agent/windows/ocade_agent gateway, workers, job manager, OS accessibility and capture modules; typed operation catalog; verify_worker.py; existing Chat/JARVIS composer/task panel; Settings Devices/Privacy; current provider budget and BYOK selection. These are existing plan destinations, not a claim that a particular new file already exists.
2. Step 1 — capability/contract proof: Inspect actual current source SHA and existing background modes, native app interfaces, screen grants, task events and tests. Write/extend typed agent/observation/progress/instruction contracts and resource leases. Verify no duplicate state owner and no data leak.
3. Step 2 — genuinely parallel worker scheduler: Enable independent device jobs and nonconflicting native actions with durable leases and independent outputs. Add truthful agent IDs/colors and event feeds before adding cursor animation. Verify OCV-01/02/13/26 first.
4. Step 3 — app-attached native overlay: Implement target-window tracking, click-through virtual pointer layer, small floating status bar, Stop/Pin, role dropdown and separate always-visible composer. Use existing theme tokens and all 30+4 UX laws; test app switching, focus and accessibility before visual polish.
5. Step 4 — foreground protector and native app bridges: Add supported background app capability detection, safe staging, main-thread dispatch when needed, resource governor and Live handoff. Start with a few representative supported app technologies but keep routing capability-driven, not hardcoded by app.
6. Step 5 — LIVE VISION core: Implement one permissioned per-window capture bus for Windows/macOS, browser CDP stream, native/DOM/AX event fusion, bounded frame cache and change detector. Keep screenshot/OCR/OmniParser as precise fallbacks. Add temporal model adapter only for genuinely supported, authorized providers and measure incremental benefit.
7. Step 6 — instruction/replanning and verification: Wire the always-visible composer to authenticated versioned project instructions, selective DAG replan, durable STOP, independent verifier and website mirror. Test offline/reconnect and all stale/unknown-effect cases.
8. Step 7 — optimize and qualify: Benchmark model calls, user responsiveness, actual agent overlap, resource cost, app-specific correctness and end-to-end completion. Remove redundant capture loops, polling, duplicate event stores and ornamental cursor activity; preserve fallback modes and safety gates.
9. No code-completion claim: All additions are NOT IMPLEMENTED by this documentation commit. A coding agent must produce code diffs, real tests, exact commit, CI GREEN and independent device qualification before changing status. No benchmark, deployment, credential change, cloud spend, permission expansion or production release is authorized by writing this plan.

### 14F.17. Exact post-previous-commit discussion-to-plan coverage and evidence ledger

Comparison point: Branch feat/byok-owner-key-gateway-plan-20261115, previously observed head commit 03b770d4fc6614e577bd748d1f0628a00e275c03 (15 Nov 2026). Existing sections are kept, not falsely credited as new code. PLAN ADDED means documented in this edit; ALREADY IN PLAN means existing requirement extended/clarified; NOT IMPLEMENTED/UNVERIFIED applies to all newly described runtime functionality until independently tested.

| Owner discussion/approval after that commit | Previous plan coverage | Exact destination after this edit | Documentation outcome / runtime truth |
|---|---|---|---|
| Work on the customer's actual installed Windows/macOS apps without mandatory VM/Docker/cloud computer | Parts 5.7, 14D CUA-04, 14E Devices | 14F.1–14F.2, 14F.6 | ALREADY IN PLAN; greatly expanded; NOT IMPLEMENTED/UNVERIFIED |
| Keep the human free to watch YouTube, game or type while agents work without focus/mouse hijack | Parts 13.2, 14D CUA-04 | 14F.1, 14F.2, 14F.6, OCV-04/05 | PLAN ADDED detailed foreground protector and negative tests; NOT IMPLEMENTED |
| Reuse installed creative apps, compatible plugins/add-ons and licenses | Generic native-first control | 14F.2, 14F.6, OCV-06/07 | PLAN ADDED compatibility matrix, main-thread and license constraints; NOT IMPLEMENTED |
| Real multiple subagents actively editing one project in parallel, not one cursor doing all work | Part 14D active-team graph/locks | 3.4, 13.4, 14D.3, 14F.1–14F.3, OCV-01/02 | ALREADY IN PLAN concept; made explicit as independent execution acceptance; NOT IMPLEMENTED |
| Separate colorful OCADE/subagent cursors linked to actual agent work | No complete app overlay contract | 14F.1, 14F.3–14F.4, OCV-03 | PLAN ADDED; virtual cursors truthful; no fake simultaneous OS pointers |
| Fast text appearing like demo; real work throughput, not fake typing | General Part 15 speed and native-first | 14F.7, 14F.15, OCV-14/29/30 | PLAN ADDED direct insertion, batching, baseline measurements; no unmeasured speed claim |
| Screenshot-sized floating bar only on the app being automated | Part 14E live dashboard general | 14F.4, OCV-08/09/11 | PLAN ADDED app-window attachment, lifecycle and DPI; NOT IMPLEMENTED |
| Pin to monitor background work from other apps | No exact Pin contract | 14F.4, OCV-11 | PLAN ADDED; Pin shows status, not other-app capture |
| Live number of agents, what each is doing, role dropdown, real progress and Stop | Part 14D/14E general progress and STOP | 14F.4–14F.5, OCV-09/10/13 | PLAN ADDED exact UI and factual event semantics |
| Composer must remain OUTSIDE dropdown, always available even collapsed | Earlier composer exists, placement unspecified | 14F.4, OCV-09/10 | PLAN ADDED explicit owner correction |
| Ongoing user instructions and mid-task changes without restarting unaffected agents | Part 14D selective replan | 14F.5, 14F.12, OCV-12 | ALREADY IN PLAN concept; detailed versioned live instruction semantics |
| Continuous app-scoped live video vision should be primary visual awareness; screenshot only precision/fallback | Part 14E.5 described targeted screenshot vision | 5.3, 14E.5, **14F.8–14F.11 VISION** | PLAN ADDED full hybrid perception engine; NOT IMPLEMENTED |
| Include all viable vision architectures, including screenshots, events, OCR and verified replay | Prior generic vision/control order | 14F.8 V01–V10, 14F.9–14F.10 | PLAN ADDED ten-architecture selection policy |
| Inspect six repositories and additional strong GitHub live-vision sources; link implementation files | Part 14D six repo sources, no exact vision matrix | **14F.11 VISION references** | PLAN ADDED inspected source-file matrix and confirmed limitations |
| Share one capture/video state across parallel agents; lower model overhead | Prior model budget and agent coordination | 14F.9–14F.12, OCV-19/25 | PLAN ADDED bounded fan-out, event filtering and per-agent ROI |
| Keep one unified execution engine and avoid separate cloud/dual systems | Parts 5, 14C/14D anti-bloat | 14F.2, 14F.16 | ALREADY IN PLAN; explicit non-duplication requirements |
| Apply UX LAWS AND PRINCIPLES at an extreme, all effectively | Part 14B.4 and Appendix G.1 30+4 | **Literal second line of plan.md**, 14F.1, 14F.4, OCV-28 | PLAN ADDED exact prominent mandate; existing laws retained |


Completion audit rule: The table documents coverage of the owner-approved discussion since the previous commit. It is NOT evidence that a coding agent implemented any new feature. At every later commit, update individual statuses to CODED, TESTED, DEVICE-VERIFIED or BLOCKED only with actual files, CI/run IDs, device conditions and independent proof. Keep the baseline six-source ledger, original requirement IDs, Appendix G.1 UX laws and existing product scope intact.

## Part 15. Performance and resource targets (all measured on at least 30 tasks per category; none achieved yet)

15.1. A simple task, with at most three effects, takes at most 15 seconds at the median and 35 seconds at the 95th percentile. The measured median today is 37 seconds across all tasks.

15.2. Model calls per task are at most three for simple tasks, six for medium tasks and a budgeted 40 for creative work. Today the median is six.

15.3. A planning turn carries at most 4,000 input tokens typically and 8,000 at worst. Today it is about 15,000.

15.4. Unaccounted time is at most 5 percent; today it is 35 percent. Claiming an action while a task is active takes at most half a second at the median.

15.5. The companion is ready within two seconds of a cold start. Idle, without a browser, it uses at most half a percent of CPU and 150 megabytes of memory.

15.6. Every report records:
- when Part 14F parallel/vision mode is used: genuine concurrent-active agent count, agent work overlap, foreground focus violations, capture/preview FPS versus AI sample rate, capture-to-observation latency, screenshot/OCR fallback count, direct text insertion throughput, event queue/backpressure, CPU/GPU/VRAM pressure and measured verified end-to-end speedup versus one-agent native-first baseline;
- first-attempt success;
- median and 95th-percentile time;
- customer interventions;
- model calls, tokens and cost;
- recovery outcomes;
- wrong-target incidents (must be zero).

## Part 18. JARVIS operating resources

18.1. Complete JARVIS coding and whole-site compilation using existing authorized resources.

18.2. Keep secure rate limits, legitimate AI quotas, minimal model input, usage ceilings and clearly recorded test resource consumption. Do not bypass project quotas or move customer data into disallowed model tiers.

18.3. Missing approved GPU capacity, staging environment, credential access or real-device test permission is reported as a specific qualification blocker rather than patched with fabricated results.

## Part 19. Owner approvals and decisions required

19.1. Authorized model-provider access, compatible customer-data safeguards and a resource budget. This resolves section 2.6 and conflict C1.

19.2. Confirm Flash-Lite as the single customer model, and Gemma as evaluation-only (conflict C2).

19.3. The meaning of "specialised agents" (conflict C3).

19.4. Session-mode idle exit time and the always-ready default (conflict C4).


19.5. Standing owner decision — model testing budget (21 Nov 2026): Approve all authorized coding, free provider discovery and no-additional-cost staging/CI/model testing using the existing legitimately provisioned Supabase staging Gemini credentials and other legitimately authorized FREE-TIER API keys, within their documented quotas, terms and data protections. The initial maximum *additional paid spending* is ₹0. This is not an unlimited budget; any paid charge requires the owner's separate explicit monetary ceiling. This does not grant permission to reveal, rotate or copy credentials into the repository or chat.

19.6. Standing owner approval — execution scope (21 Nov 2026): The owner says "approval for all" for the full existing approved `plan.md` coding scope, all applicable security-ledger remediation, debloat, focused/local/authorized free hosted tests, justified non-destructive staging validation when the coding gates permit, free provider onboarding via legitimately accessible accounts, and repeating free benchmark/cloud-computer tests within provider and platform limits. Claude/Codex should proceed without redundant discretionary questions, keep evidence and continue safely. This standing approval does not waive provider-imposed sign-in/review or GitHub protected-environment controls; does not authorize spending above ₹0 additional paid cost, accessing real third-party/customer devices without a specified approved target, weaker security, untrusted credentials or misuse of trials; and does not authorize production deployment or merging to `main` without an explicit release decision. If a paid or externally controlled step is unavoidable, show its exact blocker while progressing on other work.

19.7. Deploy `ocade-intelligence-service` to production only after staging qualification (section 2.7).

19.8. Benchmark and cloud-computer approvals (updated 21 Nov 2026): The owner has already authorized no-additional-cost staging benchmarks (B1) and genuine GitHub-hosted Windows/macOS cloud-runner tests (A1) under 19.5–19.6, to execute ONLY when the preceding coding, security, debloat and green CI gates pass. Do not ask again merely for a routine authorized free rerun. Respect any platform-enforced per-run protected-environment confirmation. Testing an actual private/customer physical computer (A2), paid runners or paid model usage still requires a specific device/access or monetary scope; this is not permission to use an unspecified third-party device.

19.9. Archiving the research tooling (item 14.3).

19.10. Background accessibility actions (item 13.2), and verified-route replay wording under O8 (item 13.1).

19.11. The original wording of owner requirements 72, 73, 86 and 87.

19.12. Production deployment and any `main` merge remain separately approval-gated.

## Part 21. Conflicts and unresolved decisions

21.1. C1. The no-spend goal may conflict with permitted model capacity and backup resources. Verify actual limits, secure customer-data handling and authorized resource budgets under approval 19.1.

21.2. C2. O2 permits Gemma 4 31B, but customer-data suitability and task reliability are unverified. Use it only for approved evaluation data until those conditions pass.

21.3. C3 — reconciled by the 16 November owner override (Part 14F). Runtime subagents must perform GENUINELY CONCURRENT independent production, not merely parallel reasoning. Preserve ONE durable task/permission/STOP authority and exclusive mutation ownership per conflicting resource; do not serialize all unrelated execution through one global computer worker. The ordinary Windows/macOS shared desktop has one arbitrated physical pointer/keyboard stream, while independent native app/API/process/file channels may run concurrently. Colored per-agent virtual cursors must represent real agent actions, never fake simultaneous physical pointers. The two original models remain the benchmark baseline; the provider API must be universal. Do not create a second task authority.

21.4. C4. Requirement 62's exit-after-task behaviour conflicts with instant pickup. Resolved by session mode staying alive while tasks or jobs run, plus an optional always-ready mode.

21.5. C5 — resolved for this revision. Preserve the legacy requirement/concept table formats in Appendices A–E because `scripts/jarvis-traceability.mjs` and `scripts/launch-readiness.mjs` depend on them. The explanatory plan remains pointwise, but traceability data retain their machine-readable row shape. Run both readers in CI; change scripts only if a future separately authorized migration is necessary.

21.6. C6. `CLAUDE.md` and the research tooling still refer to the removed submodules (VERIFIED by search). Resolution: item 14.3.

21.7. C7 — updated model policy. The original 16 baseline runs still evaluate one model at a time without hidden failover. The new universal provider registry permits further adapters only after explicit authorization and independent qualification; mixing models in one task requires an explicit task-level policy and must never silently change permission scope or retry unknown mutations.

21.8. C8. The blueprint's browser-extension proposal (R16) is withdrawn by the owner's decision of 14 November.

21.9. C9. The original text of owner requirements 72, 73, 86 and 87 is missing from the repository.

## Part 25. Make Gemma 4 31B and JARVIS significantly faster and stronger (owner addition)

25.1. Treat speed as an end-to-end task result, not raw token-generation speed. Re-measure the baseline on identical tasks and compare Gemma 4 31B to Gemini 3.5 Flash-Lite independently, without claiming a winner until the measured 16-run comparison has completed. Provider-specific network, queue, quota and model latency must be separated from device action time.

25.2. Reduce the reported ~15,000 input-token planning turns to a typical ≤4,000, with ≤8,000 in justified complex cases. Offer operation families dynamically at goal creation; load complete schemas only for pertinent tools; replace repetitive history with verified structured state, changed observations, compact failure reasons and milestone checkpoints. Measure tool recall and decision parity on held-out tasks so aggressive compression cannot silently reduce accuracy.

25.3. Use forced structured calls only on providers and models that actually support them, with a durable per-model capability cache. Preserve complete JSON Schema and device/server argument validation. On unsupported parameters, learn the refusal once, use a safe supported request shape and retest; never keep repeatedly sending incompatible thinking or function settings.

25.4. Move planning outside device-request deadlines. Execute small, independently guarded deterministic action batches, locally verify expected postconditions after each step, and contact the model again only for new uncertain decisions, deviations, cross-app interpretation or creative reasoning. Heavy renders or exports run as durable jobs and are polled without wasting planner turns. Keep STOP and Take Over synchronous and authoritative throughout.

25.5. Separate actuation from observation: For EFFECTS, prefer native app object/file APIs, then scripts, DOM, accessibility and finally screenshot-grounded GUI control. For PERCEPTION, use Part 14F VISION: app-scoped continuous window video plus native semantic/event observation, adaptive frame analysis and targeted screenshot/ROI precision fallback. The multi-agent coordinator is mandatory but bounded: coordinate genuinely concurrent independent specialist agents and an active corrective coordinator; preserve ONE task/permission/STOP authority, exclusive conflict-scoped mutation leases, source-bound budgets and Parts 14D/14F safety requirements. Do not introduce a global execution mutex, competing controllers, uncontrolled tool swarms, duplicate captures or repeated introspection. Reuse verified routes only when held-out correctness tests prove them safe.

25.6. Strengthen complex multi-hour work by externalizing task objectives, dependencies, budgets, approvals, intermediate deliverables, task journal, verified checkpoints, recovery state and resumption. Favor specialist deterministic workers and domain checks rather than hallucinated model memory or hardcoded application flows. Independently validate final 3D objects, spreadsheets, animations, browser state and other outputs with objective oracles where possible.

25.7. Measure at least 30 tasks per workload category for median/p95 planner latency, time-to-first-action, task completion time, token counts, quota refusals, recoverability, tool-call correctness and verified first-attempt success. Any claimed speedup must compare identical seeds and identical resource constraints and must report failures and statistical uncertainty. No guarantee that software changes can eliminate provider-side inference latency.

## Part 27. Owner-approved 12 revised additions, four outcome packages and eight problem-solving products — additive post-03b770d4 handoff (16 November 2026)

### 27.0. Source, precedence, explicit coverage and preservation contract

OWNER-PROVIDED REQUIREMENTS, 16 NOVEMBER 2026: The owner supplied an exact Part 1 — Revised 12 additions and Part 2 — Revised problem-solving products, grouping eight use cases into four packages. This section records those requirements as binding PRODUCT DESIGN AND ENGINEERING SCOPE. It is an additive specification alongside Part 14F and the independently catalogued transformative features in Part 28. Do not remove, renumber, silently weaken or replace any older content in Parts 0–26 or Appendices A–H. Preserve the original 266-ID ledger, 84 concepts, 72-entry integration ledger, UX-01–UX-34, existing task/security architecture, source references, CI gates, no-deployment conditions and historical evidence. This Part 27 is additive; where it clarifies user-facing approval frequency, privacy handling, context discovery, mode selection or package composition, use the newer explicit owner requirements without bypassing the underlying security policy.


Original 12-feature inventory reconciled: The distinct original list titled “12 potentially transformative OCADE features” is now fully itemized and specified in Part 28.1, with exact feature names, inputs, actions, constraints, failure behavior and acceptance criteria. These T12-01–T12-12 features are additional to the revised R12-01–R12-12 in Part 27.2. Use the mapping in Part 28.6 to reuse existing capabilities rather than building duplicate engines.

Evidence discipline: OWNER-APPROVED / DOCUMENTED means the owner explicitly supplied the requirement and it is written here. IMPLEMENTED, BUILDS, DEVICE-VERIFIED, SECURITY-VERIFIED and BENCHMARKED require separate code/CI/runtime evidence. A documentation commit alone cannot satisfy any acceptance test. Do not infer current integration support, bank compatibility, phone app availability, model capability or user-granted permissions. This section makes no external-source verification claims.

User goal: OCADE is ONE universal authorized assistant that makes existing websites, applications, personal/business administration and local PC work simpler, faster and less interruptive. These 12 capabilities are shared platform behaviors, not 12 independent agent engines. The eight named products are four outcome-focused packages built on the same platform, not eight disconnected backends, permission systems, stores or navigation destinations.

### 27.1. Shared product decisions and safe default behavior

1. One orchestration spine: Reuse the current website-first Chat/JARVIS experience, existing model/provider gateway, Supabase task journal, companion/device broker, capability catalog, Library, permission grants, connector OAuth/MCP registry, private memory and independent artifact verifier. Extend those contracts; do not create separate invoice, forms, habits, timeline or phone task engines.
2. Minimum friction, maximum authority clarity: Authorize a task and its permitted resources once with understandable scope; ordinary read, analyze, organize, prepare, fill and reversible edits within that scope continue without repeated approval prompts. Sensitive/irreversible/out-of-scope effects require just-in-time confirmation or renewed authorization. Provider OAuth, operating-system permission grants, identity assurance and legal platform requirements remain mandatory and cannot be silently bypassed.
3. Effect taxonomy: Classify operations as (A) passive observation/read, (B) reversible authorized preparation/local write, (C) ordinary scoped communication/updates within a clearly approved audience and purpose, (D) consequential sensitive effect such as money movement, important deletion, sensitive external disclosure, new recipient/audience, legally binding submission or material account/permission change. A–B normally auto-run after initial authorization; C may auto-run only when explicitly scoped in advance; D requires a clear action-specific confirmation/step-up as appropriate. A single narrowly bounded batch approval may cover multiple named D effects if the user clearly understands recipients, amount/data, scope and expiry; never use vague perpetual approval for high-risk actions.
4. No autonomous payments: In the Business Money Assistant and all other products, OCADE may read, calculate, reconcile and fill authorized financial details, draft payment instructions or prepare a transfer for inspection, but MUST NOT independently execute or schedule money transfers, purchases, bank payments, withdrawals or charges. A later explicit user-initiated payment flow remains subject to fresh confirmation, provider authentication and platform policies; no plan wording grants silent payment authority.
5. Private data is usable for the task: "Intelligent Privacy" does NOT mean hiding bank numbers, addresses, IDs or confidential fields from the authorized local task engine when those exact values are needed to fill a permitted form. It means data minimization by destination, model, recipient and purpose. Use the real value where authorized and necessary; mask/redact unnecessary external transmission, UI preview, logs, analytics and unrelated agents. Do not invent values or expose complete secrets by default.
6. Live versus Background are presentation/execution modes, not separate products: A simple dropdown chooses Live or Background. Live lets the user deliberately watch/allow relevant UI automation; Background prefers local native APIs, headless/script/file work and safe app bridges without focus theft. A task may have both parallel background workers and an optional visible Live step. Do not promise that all GUI-only operations can run invisibly or that background CPU/GPU use is zero.
7. Default UI simplicity: The user states an outcome. OCADE discovers authorized context, offers one recommended plan, generates simplified task-specific forms when helpful, shows a passive next-action preview, works without nagging and retains STOP, Take Over, permissions, timeline, corrections and accessible explanations. Expert detail is progressively disclosed.
8. UX mandate: The literal second-line instruction at the top of this file to apply "UX LAWS AND PRINCIPLES" at an extreme remains mandatory. Map UX-01–UX-34 to the new mode dropdown, approvals, animated guide, Live App, discovery, preview, timeline, habits, simplification, device handoff and four packages. Exceptional usability must not create deceptive progress, hidden sensitive effects or reduced accessibility.
9. Security boundaries survive simplification: A connected plugin is not a grant to every action it exposes; a discovered file is not necessarily readable; a preview is not authorization; a saved habit is not a new permission; a generated form is not proof the underlying site accepted the data; a resumed device is not automatically entitled to the first device's filesystem.
10. Rollout and tests: Implement shared primitives before product-specific templates. Existing whole-product coding-complete GREEN gate, no-unapproved-spend policy, model BYOK isolation, physical-device consent, independent verification and explicit public-deployment authorization remain unchanged.

### 27.2. REVISED 12 ADDITIONS — exact owner-approved names and detailed requirements

27.2.1. R12-01 — Live / Background Mode (P0).

- Exact UI: One compact two-option dropdown labeled Live and Background, shown in the relevant task/agent controls (website and app-attached overlay where appropriate), with current mode, status and a short plain-language explanation. Do not expose separate "cloud", "dual", "hidden desktop" or "VM" modes as the primary customer decision.
- Live: The user can see the AI's real work and per-agent colored, action-backed cursors on the target application, subject to actual window/capture/OS capabilities. If GUI input is needed, request a deliberate time-limited handoff for the target app; user STOP/Take Over wins. The shared OS pointer/keyboard is arbitrated, while other independent agents can still work concurrently.
- Background: Execute authorized work on the customer's own machine via supported native app APIs, installed plugins, local scripts, CLI/headless processes, separate browser contexts and transactional file changes without disturbing the customer's current app, mouse, typing, gaming or video. Respect CPU/GPU/RAM, thermal, battery and fullscreen limits. GUI-only focus-dependent steps must wait, ask for Live or report unsupported.
- Transitions: Switching modes preserves project/task IDs, grants, checkpoints, work graph and accepted outputs; it does not restart independent work or duplicate external effects. Show "Waiting for Live control" when necessary, not fake background progress. Distinguish background work that is actively executing from queued/paused.
- Tests: Mode switching during render, typing, fullscreen game, app minimize, agent STOP, lost focus and permission revocation; verify no unintended OS input or duplicate job, and truthful task continuity. Integrate with Part 14F.2–14F.6.

27.2.2. R12-02 — Smart Approvals (P0).

- Default: No repetitive approval popup for each ordinary click, file read, navigation, app script, local draft, form field or reversible edit already covered by a scoped task grant. Use a short initial scope summary: who/which account, app, folders/sites, operation types, destinations, time/usage limits and STOP.
- Escalation: Request a single focused approval when the actual operation would transfer money, delete important data, publish/deploy, send sensitive data externally, sign/submit a legally consequential claim, change security permissions, share with a new recipient, purchase something, expose secrets, or materially exceed the existing grant. Differentiate a harmless form draft from final submission. Never hide the provider's own MFA/OAuth/OS dialogs.
- Approval quality: Show exact action, target, recipient/domain, data category, irreversible consequences, cost if any, current state and alternatives. Offer approve once, narrowly bounded batch (where defensible), edit, deny and STOP. Avoid broad "always allow everything" for consequential effects.
- Durable authority: Store scoped consent receipts, expiry, idempotency and revoke/STOP epochs in the existing permission authority. If the target/account/data/recipient changes, re-evaluate the effect before commit. A subagent inherits only approved scope and cannot self-approve.
- Tests: A 50-step benign authorized task should not generate 50 prompts; a newly discovered sensitive external send must still block; expired/denied/changed scopes must fence all subagents. No repeated prompt loops after refusal.

27.2.3. R12-03 — Intelligent Privacy (P0).

- Correct owner meaning: OCADE MAY read and fill the user's real bank details and other sensitive task data when specifically authorized and needed for the requested work. It must not replace needed values with stars or fictitious placeholders inside the authorized form. Protect data from unnecessary external recipients and models rather than making the actual task impossible.
- Field-level purpose binding: Each sensitive value carries source/account, user grant, purpose, target site/form, permitted recipient, retention and destination. Keep values locally where possible; send only the necessary fields to the intended legitimate service. Redact irrelevant values from LLM prompts, screenshots, screen-share previews, task history, diagnostics, notifications and third-party integrations. Never transmit raw banking credentials, MFA codes or secrets to arbitrary models/tools.
- Financial boundaries: Reading balances, statements, invoice data and account numbers and pre-filling authorized forms are separate from executing payments. Do not store card CVV, PIN or online banking passwords as habitual memory; never bypass bank anti-bot/MFA rules. Require user authentication where the bank demands it.
- User controls: Clear privacy preview, what leaves the device, which model/provider receives it, selective field sharing, revoke, delete/retention, audit and separate explicit permission for ongoing financial account access. Existing BYOK data-location/funding isolation remains intact.
- Tests: Real authorized field is filled accurately at the intended destination; unrelated provider, worker, model, analytics and logs see masked/absent value; revoke mid-task prevents new exposure; no hidden external sharing.

27.2.4. R12-04 — Seamless Tool Access (P0).

- Connect once, work continuously within scope: Search/discover supported plugins, skills, MCP tools, local apps and OAuth accounts; connect with provider-required consent once, select resource/account scope and allow OCADE to call the permitted actions across one task or an explicitly scoped ongoing workflow without approval for every harmless tool call.
- No needless restrictions: Remove artificial UI friction, duplicate "allow this tool" prompts, separate plugin approval loops and re-selection of the same authorized account. Do NOT remove actual provider OAuth, platform scopes, security validation, token renewal, rate limits, purchase controls or high-risk confirmations. Tool results are untrusted data.
- Unified capability catalog: Use the existing Part 14E searchable registry for provider, publisher identity, verified action schema, input/output, cost, scope, supported regions, account selection, token health, permission requirements and current capabilities. One task may combine several tools without multiple unrelated agent frameworks.
- Lifecycle: Connection state and grant are inspectable/revocable; expired credentials pause affected work, not unrelated agents; new scope/account/recipient requires an understandable update. Failed/retried tools use idempotency and independent effect checks.
- Tests: Multi-tool benign workflow runs after one scoped connection without approval spam; revoked plugin cannot execute from queued subagent; malicious tool output cannot grant filesystem/network permissions; correct account/tenant is used.

27.2.5. R12-05 — Animated Permission Guide (P0).

- Exact look and controls: A restrained premium glass-gradient onboarding/repair overlay with clear short animated instructions, highlighted relevant OS/browser/app settings, current step, expected permission, reason, progress, Retry/Verify, optional "Open settings", accessible text alternative and an obvious top-right × close button.
- Real permission state: Explain Windows/macOS screen capture, Accessibility, app automation, filesystem/folder, microphone/camera (only if used), browser profile and connector OAuth separately. Where OS APIs permit, open the genuine system settings pane; where they do not, show accurate user-driven steps. Never fake a permission grant or click through secure OS consent on behalf of the user.
- Interaction: Respect reduced motion, screen readers, high contrast, keyboard Escape, safe areas, small windows and mixed-DPI displays. Highlight only a confirmed current setting or actual UI region; avoid stale coordinates and misleading pulsing over the wrong application. × closes the guide without silently granting/denying anything or stopping already-authorized unrelated work.
- Recovery: Remember completed steps by permission/version/device, explain "Denied", "Pending", "Needs restart", "Not supported" and "Revoked", and avoid showing the same guide repeatedly after the permission is already verified.
- Tests: Windows/macOS denied and reauthorized flows, OS updates, reduced motion, guide close/reopen, wrong window, disconnected device, accessibility navigation and no misleading success states.

27.2.6. R12-06 — Live App Generator (P0 platform, P1 expanded coverage).

- Goal: Automatically turn complicated websites, enterprise software and native app workflows into a beautiful, simple, task-specific generated form that asks only for the fields required to accomplish the user's objective. It is a temporary, verified interaction layer over the authorized target, not a new independent hosted application or a bypass of the original site's rules.
- Build: Discover current authorized DOM/accessibility/native app form schema, validation rules, labels, required fields, options, dependencies, attachments, dynamic sections, account/recipient identity and final action semantics. Generate a typed JSON-schema-like internal representation and OCADE design-system form with clear sections, field help, defaults from authorized context, edit/review, errors, draft save and provenance for auto-filled values.
- Execute: Map generated fields back to verified current target controls or official APIs; revalidate against current site/app state before fill and submit. Handle conditional fields, multi-step pages, document uploads, captcha/MFA/user-only challenges, validation messages and unsupported controls honestly. Do not hallucinate fields or submit if target mapping is uncertain.
- Safety: Routine fill can proceed within scope; final submission that sends sensitive data, incurs fees, creates legal obligations or changes accounts requires the correct approval. Generated UI must show original destination and exact data to be sent. Never conceal required disclosures or manipulate choices.
- Tests: Complex dynamic form simplifies without losing required fields, values round-trip exactly, user edits persist, changed source form invalidates stale mapping, and the original site independently confirms success. Accessible on mobile/desktop.

27.2.7. R12-07 — Automatic Context Discovery (P0).

- Replace Smart Dropzones as primary workflow: The user should not have to manually drag relevant documents into a special Smart Dropzone for ordinary tasks. OCADE discovers relevant already-authorized files, folders, browser tabs, connected accounts, app projects, calendars and open applications using the shared capability/context graph.
- Discovery process: Extract the task intent and needed resource types; search only permissioned scopes; rank by relevance, current project, file metadata, recent activity, user-selected account, app identity and verified content matches. Present the chosen resources and why; ask one targeted question only if ambiguity materially affects correctness or privacy. Support explicit override, exclude, pin and "don't search this location".
- Privacy/performance: No silent full-disk indexing, cross-account scraping, unauthorized folder traversal, blanket cloud upload, persistent monitoring of unrelated tabs or automatic opening of sensitive files. Minimize file contents sent to models; use local metadata/content indices only with proper grants and retention. Respect OS and provider APIs.
- Backward compatibility: Preserve any existing Smart Dropzone references and accepted upload flows as optional manual overrides if they exist; remove the REQUIREMENT that users must use them, not historical plan text or functioning accessibility pathways.
- Tests: Task discovers correct authorized invoice/project without manual upload; denies unauthorized directories; handles two similarly named files with a clarification; detects stale/moved files; no unrelated data appears in logs or prompts.

27.2.8. R12-08 — Passive Ghost Preview (P0).

- Behavior: Show a nonblocking preview of the AI's next planned meaningful action (e.g., "Will add three invoice reminders", "Next: update Blender lighting", "Preparing claim draft") in the app-scoped overlay or website task view. Ordinary authorized actions require no approval buttons; preview is informational and can be collapsed/hidden.
- Truth: Distinguish "Planned", "Executing", "Completed", "Blocked" and "Needs confirmation" from actual event receipts. If the plan changes, update the preview. Do not show speculative cursor animation as evidence of an executed action or imply certainty when the target app has changed.
- Interaction: Optional inspect, change instruction, pause, STOP and Take Over remain accessible. If the next effect is sensitive/out-of-scope, surface the normal Smart Approval control separately; do not turn every preview into a permission dialog.
- Scope: App-only by default; pinned redacted summary only when explicitly enabled; no preview over unrelated games, password managers or OS secure surfaces.
- Tests: Preview accurately predicts next authorized step, updates on replan, cannot accidentally authorize a high-risk action, has minimal latency/CPU cost and does not steal focus.

27.2.9. R12-09 — Time-Travel Timeline (P0 history, P1 safe restoration).

- Goal: Let users inspect completed steps, errors, agent actions, revisions, files, approvals, external effects and recovery points in one chronological task timeline. Filter by agent, app, resource, status and time; link entries to actual receipts and changed artifacts.
- Checkpoints: Before significant reversible edits, preserve a safe version/undo point where supported; show "View before", "Compare", "Restore draft" and "Resume from checkpoint" only when technically valid. Coordinate restoration with other agents and newer user edits; never silently roll back accepted work.
- Irreversible boundary: A sent email, bank transaction, published page, externally submitted job application or deleted remote record may NOT be reversible. Label "Recorded only / cannot undo" and offer a corrective workflow where possible, not a fake time machine.
- Security: Timeline metadata and previews are tenant/user scoped; sensitive fields are masked, access to underlying originals is permission-checked, retention and delete controls are honored. Offline local journal and server journal reconcile by IDs, sequence and STOP epoch.
- Tests: Multi-agent concurrent events appear in causal order, partial failures and retries are visible, safe local file restore succeeds, irreversible external effects cannot be mislabeled undoable, and stale checkpoint restore is rejected.

27.2.10. R12-10 — Private Habit Intelligence (P1 opt-in).

- Goal: Learn the individual's recurring workflows and preferred choices from that user's consented, verified task history; offer useful one-click repeats, prefilled templates, suggestions and optional scheduled routines. No cross-user memory sharing, pooled personal histories, default public training or accidental organization-to-personal leakage.
- Memory boundary: User-specific, purpose-bound, inspectable, editable, exportable and forgettable. Store workflow patterns and verified preferences rather than raw passwords, PINs, MFA tokens, bank secrets or complete private documents. If user memory is disabled, no habit learning or covert reconstitution through another store.
- Automation: A recognized habit is a recommendation, not authority to run it indefinitely. Recurring actions require a separate approved schedule, resources, audience, data and revocation. Sensitive sends, financial actions, changed recipients and new permissions remain confirmation-gated.
- Quality: Require repeated verified evidence before suggesting a pattern; label confidence and allow "not relevant", "never suggest" and correction. Avoid manipulative nudges, excessive notifications and false predictions.
- Tests: Two users with identical workflows never share memory, disabled memory leaves no new habit record, forget/revoke works across devices, and no saved habit bypasses action permissions.

27.2.11. R12-11 — Simplification Mode (P0 basic, P1 broad app coverage).

- Goal: Make confusing websites and installed applications easier to understand and operate without forcing the user to learn their entire interface. Provide an optional contextual simplified view: clear next step, essential controls, explanations, accessible navigation, form generation and task-specific guidance.
- Architecture: Build on Live App Generator, semantic DOM/accessibility/native app state and OCADE's app-attached overlay. Use one capability and permission model; do not create an unsupported universal replacement shell that claims to work for every custom GPU canvas or closed app.
- Truth and fidelity: Preserve actual form validation, required disclosures, selected account, original destination, data values, accessibility, user control and final confirmation. Show a "View original" path and allow instant exit. Do not conceal fees, terms, risk, error states or uneditable source content.
- Tests: Novice user completes a representative complex authorized task with fewer errors/steps than original, and a source UI update triggers revalidation rather than silent wrong-field actions; keyboard and screen-reader use remain functional.

27.2.12. R12-12 — Cross-Device Handoff (P1).

- Goal: Continue one OCADE task across the website, phone/mobile web experience and authorized Windows/macOS desktop companion without losing the plan, conversation, accepted artifacts, timeline, approvals, agent status or pending instructions. Do not promise a native iOS/Android app unless one is actually built.
- Task identity: Reuse one durable task ID, revisioned event stream, authenticated user identity, per-device capability map, resource manifests and encrypted checkpoint metadata. The phone may inspect, reply, approve or redirect where supported; local PC work continues only while its own companion remains paired and authorized.
- Security: Device pairing and resource access are separate. A phone login does not grant the phone raw local disk access or remote PC control; a new computer must be explicitly enrolled, its own folders/apps granted and the required data safely transferred or re-discovered. Revalidate identity and step-up for sensitive confirmations; show which device is actually executing.
- Conflict handling: Two devices editing the same instruction use revision checks and a clear conflict/rebase UI; preserve unsent drafts. Network outages, reconnects and expired sessions must not duplicate external submissions or silently restart dangerous effects.
- Tests: Start on desktop, inspect/edit from phone, resume website, preserve task/STOP/approval receipts, reject a stolen device token and verify that an unpaired device cannot execute local PC actions.

### 27.3. FOUR INTELLIGENT PROBLEM-SOLVING PACKAGES — exact eight owner-named products

Packaging decision: The owner rejected eight disconnected systems. Present four coherent user-outcome packages in existing OCADE Chat/JARVIS discovery and onboarding, powered by the same universal tools, agents, Live App Generator, permissions, private Library, task journal, timeline, memory and website/mobile/desktop surfaces. A package is a set of domain workflows/templates, NOT a separate subscription service, new top-level Settings category, standalone database or duplicate orchestration engine. Product names and counts below are EXACT owner-provided labels. All are subject to user-authorized data sources and provider capabilities.

27.3.1. Package BMA — Business Money Assistant (P1; two products).

- BMA-01 Invoice Recovery. Discover user-authorized invoices, customer records, payment terms, dates, receipts and communications from permitted files, email, bookkeeping/CRM tools or manual entry. Normalize invoice ID, customer, amount, currency, due date, paid/unpaid/partially paid/disputed state and evidence source. Detect unpaid or overdue invoices; propose a ranked follow-up plan; prepare polite personalized reminders and supporting invoice attachments; prevent duplicate sends and messages to the wrong customer. Show a human-readable timeline of reminder drafts, sent receipts and replies. Send only within an explicitly authorized recipient/audience and communication scope; confirm new recipients or sensitive external disclosures. A disputed invoice must not be falsely marked collectible; do not threaten or misstate legal rights. Verify paid status against real authorized evidence, not an LLM guess.
- BMA-02 Cashflow Guardian. Read authorized balances, invoice receivables, expense commitments, payroll/rent dates and recurring outflows; produce a transparent cash-in/cash-out calendar, rolling cash runway and conservative/base/optimistic scenarios. Separate confirmed transactions from estimated payments and uncertain assumptions. Flag upcoming cash shortages with date, amount range, source and proposed nonfinancial next actions such as preparing a reminder or reviewing expenses. Never present fabricated bank balances or guaranteed forecasts. Do not execute, schedule or autonomously authorize payments, transfers or purchases.
- Shared money controls: Exact currency/timezone, invoice uniqueness, account identity, duplicate/partial payments, reconciliation, retention, redaction, explicit account consent, provider-required MFA, audit receipts and no autonomous payments. Read/fill real authorized bank details only when needed; no hidden transfer or financial account access expansion.
- Acceptance: Seed fixtures include overdue, partial, disputed, duplicate and already-paid invoices; correct classification and reminder drafts; cash forecast arithmetic independently recomputed with missing-data warnings; zero autonomous money movement; correct sensitive-recipient gate.

27.3.2. Package UFCA — Universal Forms & Claims Assistant (P1; three products).

- UFCA-03 Deadline Guardian. Discover deadlines from authorized documents, emails, calendars, claim portals and user input; extract date, timezone, eligibility, requirements, documents, fees and consequences with source citations and confidence. Produce a deadline dashboard, missing-item checklist and user-approved reminders. Handle timezones, business days, changing portal deadlines and uncertain sources; never invent an official date. Calendar writes and notifications must stay within the user's approved scope. An actual application/claim submission remains separately permission-checked.
- UFCA-04 Refund Assistant. Discover legitimate order/receipt/return-policy information, eligible refund paths, deadlines and evidence; prepare a claim package, Live App and draft communications; fill supported authorized forms. Verify the official recipient/site and refund destination; show policy uncertainty, fees and expected processing without guaranteeing approval. Confirm before sending sensitive financial/identity data externally or making a consequential claim; never falsify evidence or bypass provider checks. Track submitted case/reference numbers and responses with real receipts.
- UFCA-05 Job Application Assistant. Read the user's authorized résumé, portfolio, preferences, experience and selected vacancies; identify requirements, gaps, deadlines and application fields; produce truthful tailored résumés/cover letters and a simple Live App for each site. Never invent qualifications, employment history, certifications or answers; preserve user-approved personal details. Fill forms within scope, but do not auto-submit sensitive personal data to a new employer without informed user authorization. Handle external ATS login, captcha/MFA, accessibility, changing forms, duplicate applications and withdrawal limitations. Track actual submission confirmation, not a model's claim.
- Shared forms architecture: Source-specific schema/field extraction, generated accessible forms, verified field-to-target mapping, attachment handling, data provenance, saved drafts, explicit sensitive submission gate, deadline events and timeline. Do not clone a target website's visual design or bypass its legal/technical access rules.
- Acceptance: Multiple changing form fixtures, incomplete evidence, different timezones, sensitive external send, official-site mismatch, captcha and MFA handoff, duplicate submission prevention, correct receipt/confirmation and honest unsupported states.

27.3.3. Package PFA — Personal & Family Assistant (P1; two products).

- PFA-06 Micro-Business Ledger. Organize authorized receipts, expenses, invoices, categories, clients and simple bookkeeping records into an editable, exportable ledger with source document links, deduplication, date/currency/tax-category uncertainty and audit-friendly correction history. Reconcile totals independently; separate personal and business records by user-selected account/workspace. Support spreadsheet/CSV exports and user-approved accounting integrations. Do not claim to be a licensed accountant, silently file taxes, make payments or alter official financial records without the correct confirmation.
- PFA-07 Family Administration. Organize authorized appointments, school/household paperwork, renewals, bills, insurance records, family checklists and reminders. Keep person/household/member permissions separate; a user's access to their own account does NOT automatically authorize reading another adult's records or sharing a child's sensitive information. Use minimal fields, explicit family-resource grants and user-controlled retention. Prepare forms and calendar entries; sensitive disclosure to schools, insurers, clinics or third parties requires the relevant authorization. Do not infer legal guardianship or access rights from a family relationship.
- Shared privacy: Personal memory is private per user; household collaboration, if later supported, uses explicit role/resource grants rather than cross-user memory sharing. Protect minors' data, medical/financial fields, recipient identity and calendar visibility. Support export, correction, deletion and offline/local-only modes where supported.
- Acceptance: Mixed-user fixture cannot leak another member's records; duplicate receipts reconcile once; exports preserve correct totals; recurring reminder does not become a perpetual right to send private documents.

27.3.4. Package BLA — Business Launch Assistant (P1; one product).

- BLA-08 Client Onboarding Autopilot. Starting from a user-approved new-client brief, contract or intake form, discover required client details, project type, deliverables, milestones, contacts and source files. Build a complete scoped onboarding workflow: create a project workspace in an authorized existing app, folder/document structure, task plan, milestone dates, owner assignments, welcome draft/materials, resource checklist, delivery checklist and first review/approval gates. Reuse existing project/task engine and connectors; do not create a second client-management backend.
- Beyond copying details: Validate missing client information, conflicting terms, deliverable acceptance criteria, dependencies, budgets, deadlines and access permissions; surface clarifications through a simple Live App. Generate editable project artifacts and independently verify the workspace, tasks and documents actually exist. Preserve client-specific confidentiality and separation from other customers.
- External effects: Workspace creation and internal drafts can run automatically within granted scope. Inviting a new client, granting folder access, sending a welcome email with sensitive details, buying a SaaS plan or accepting a contract requires the relevant explicit approval and official provider authentication.
- Acceptance: Authorized fixture creates a complete editable workspace/task plan/checklist from a brief, no wrong-client leakage, no duplicate invitations after retry, missing data shown honestly, and all external recipients/access grants verified.

### 27.4. Unified architecture — implement these additions in existing OCADE components

1. Capability discovery and routing: Extend the existing capability catalog with authorized resource inventories (files/folders, open tabs, apps/projects, connected accounts, calendars, invoices, form schemas), current availability, provider identity, source provenance, permission scope, supported actions, risk classification, cost and freshness. Smart Dropzone is optional, not required. A context candidate is not automatically an authorization grant.
2. Consent and effect gate: Existing task authority stores grant_id, principal/tenant, account, device, task/project, allowed action classes, target resource roots/domains, permitted recipients, sensitive field categories, model funding/data destinations, expiry, revocation generation, user confirmation receipts and idempotency keys. Gate every tool effect at execution time, including replay, delegated agents, generated forms, plugin tools and resumed devices.
3. Privacy-aware dataflow: Use typed field provenance and purpose/destination tags. A bank field may flow from authorized source to authorized target form but not to unrelated remote model/log/preview. The gateway performs minimization/redaction before external inference; task engine still has exact authorized local values when necessary. Test with canary secrets and cross-tenant isolation.
4. Live App schema and renderer: Extend existing website design-system components with typed field schema, conditional dependencies, validation, origin and source links, mapped target controls, consent requirements, draft persistence and verified execution receipts. Reuse in invoice follow-up, refunds, claims, job applications, onboarding and simplification; no domain-specific copy-paste form engines.
5. Preview and timeline: Emit one versioned action/event stream: intent → plan → scoped authorization → planned next action → executing → receipt → independently verified/uncertain/failed → checkpoint/restore eligibility. Ghost Preview subscribes to next safe action; Time-Travel Timeline subscribes to history; agent overlay subscribes to current execution. They must not maintain contradictory duplicate progress models.
6. Habit intelligence: Build an opt-in private workflow-pattern view over accepted task history, with strict per-user/tenant RLS, no shared personal embeddings, explicit retention/forget and separate authorization for any scheduled repetition. No default personal-data pooling for model training or other customers.
7. Cross-device continuity: Use one durable server task ID, signed paired-device identities, scoped device capabilities, event sequence/revision, local companion lease, conflict resolution and encrypted references to artifacts. Mobile is a UI participant; the Windows/macOS companion remains the local executor when PC work is required. Re-enroll/regrant on a new computer.
8. Permission guide: Use one UI component for onboarding and repair with OS-specific capability checks, real provider/OS permission state, accessible glass-gradient presentation, close button, no spoofed system dialogs and no bypass of secure screens. Do not embed an independent native settings framework.
9. Four package templates: Implement domain workflow definitions, input/output schemas, required capabilities, permitted action categories, consent rules, verification oracles and reusable UI templates on the SAME orchestration spine. A package may require connectors the user has not installed; show honest capability-dependent setup and a manual alternative.
10. Data model discipline: Before adding tables, inspect current schema/RLS/migrations. Prefer additive typed columns or narrowly scoped tables for grants, generated form mappings, context candidates, timeline/checkpoints, user-only habits, handoff and package instances only if existing tables cannot represent them safely. Never duplicate tokens, project state or personal memory into product-specific databases.
11. Provider and tool boundaries: Existing BYOK/owner-funded gateway must approve any model used for form understanding, habit suggestion or financial text extraction. No silent paid provider fallback. Official OAuth/MCP restrictions and provider rate limits remain binding even when the UI avoids repeated approvals.
12. Operational reliability: Agent STOP, Take Over, lease fencing, network loss, task replay, retries, provider expiry, OS permission changes and user edits apply consistently across all twelve additions and eight products. Every consequential effect has an independently verifiable receipt or remains explicitly uncertain.

### 27.5. UX and interaction specification across the 12 additions

1. One calm default screen: A user types "Recover unpaid invoices", "Apply to this job", "Organize family paperwork" or another outcome. OCADE finds authorized resources and offers one best next step. Optional package templates appear in contextual discovery, not eight top-level product tabs or a giant onboarding questionnaire.
2. Mode dropdown: Two options only, Live and Background; show a concise availability note ("Background available" / "This step needs Live control") without a technical lecture. Do not hide the true requirement for user input or misrepresent device resource usage.
3. Smart Approvals: Initial scoped consent is compact and legible; routine execution continues. A consequential approval is specific, local to the relevant action, clear about recipient and data, and distinguishable from a passive preview. Do not turn denial into repeated nagging.
4. Animated guide: Glass-gradient, subtle step transitions, highlighted setting, top-right ×, Retry/Verify, keyboard and reduced-motion support. It must explain rather than impersonate system permission dialogs.
5. Generated forms: Ask only necessary questions; show where auto-filled answers came from; preserve draft and edits; validate inline; reveal advanced fields only when necessary. Original target/source remains inspectable.
6. Discovery: Present top relevant authorized resource with confidence/provenance and an easy Change/Exclude action. No hidden mass indexing; one clarification when ambiguity changes the answer.
7. Ghost Preview: Compact next-action text with real agent/target, no ordinary approval buttons, no fake action animation. STOP and edit instruction remain accessible.
8. Timeline: Clear chronological grouping, current checkpoint, error and recovery state, safe undo versus cannot-undo. No misleading "time travel" restoration of external effects.
9. Habit suggestions: Nonintrusive, opt-in, user-correctable; no repeated promotional prompts. Personalization never expands permissions.
10. Simplification: Familiar visual hierarchy, short field groups, simple explanation, "View original" and instant exit. Avoid hiding legal disclosures or errors.
11. Handoff: Same conversation/task and truthful current executor; phone UI must be touch-accessible; clearly show when desktop companion is offline or unavailable.
12. Law-by-law application: Audit UX-01–UX-34 from Part 14B.4 and Appendix G.1, particularly Fitts (STOP/×/approve targets), Hick (two-mode dropdown and package choices), Progressive Disclosure (generated forms/agent details), Doherty (immediate honest acknowledgments), Cognitive Load/Chunking (simplified forms), Jakob (familiar OS permission guidance), Working Memory (drafts and handoff), Zeigarnik/Goal Gradient (real milestones), Peak-End (verified deliverables), Flow (noninterruptive tool use), Occam (one shared engine), and accessibility/contrast/reduced motion. Record screen-specific evidence and justified nonapplicability rather than claiming every law has the same UI effect.

### 27.6. P0/P1 sequencing, dependency graph and negative acceptance suite

Stage A — shared P0 controls: Implement/test two-option mode selection, smart scoped approvals, privacy-aware dataflow, seamless authorized tool access, accessible permission guide, automatic context discovery, truthful Ghost Preview, basic Timeline, basic Live App Generator and Simplification Mode, all integrated with Part 14F's real parallel execution and vision. These are platform capabilities; build and verify them once.

Stage B — P1 package workflows: Implement/test the four packages and eight products using the shared primitives. The package workflow is qualified only on real supported connector/app capabilities; provide a manual-import route when unavailable. No fabricated bank API, ATS automation, government claims API, OAuth registration, customer email permission or installed software compatibility.

Stage C — private/persistent extensions: Add opt-in Private Habit Intelligence, secure cross-device handoff and safe timeline restoration with complete isolation, data retention, conflict and recovery tests. Stage ordering is engineering prioritization, not permission to omit mandatory approved features from the complete-product gate.

Shared independent acceptance matrix (required):

- A01: Ordinary 50-action task completes after one scoped grant with no approval spam; one sensitive external send pauses at the exact effect boundary.
- A02: Authorized bank details fill correctly in a legitimate target form; unrelated provider/model/log/worker cannot see those values; no payment executes.
- A03: Reused OAuth/plugin scope works across a multi-tool task; revoked/expired/new-account scopes stop only affected operations; provider consent/MFA is never bypassed.
- A04: Live/Background switch during concurrent local work preserves task and user input; background GUI-only action waits for handoff rather than stealing focus.
- A05: Glass-gradient permission guide is accurate, closable at top-right ×, accessible, reduced-motion compatible and never fakes OS permission state.
- A06: Generated Live App simplifies a changing multistep form, preserves exact values/required fields, revalidates mapping and independently verifies real submission when approved.
- A07: Context discovery selects only permitted files/tabs/apps, explains relevance, asks on ambiguity and never searches denied locations.
- A08: Ghost Preview is nonblocking, action-backed, current after replan and does not accidentally authorize a sensitive action.
- A09: Timeline records causal multi-agent steps, errors and safe checkpoints; restores reversible draft without overwriting later edits; irreversible effects are explicitly not undoable.
- A10: Private Habit Intelligence never crosses users/tenants, honors Off/forget and does not convert observed repetition into permission.
- A11: Simplification Mode reduces user effort without hiding legal disclosures, errors, recipients or source controls; exiting returns safely to original.
- A12: Phone/website/desktop handoff retains one task identity and exact executing device, rejects unpaired devices, resolves concurrent edits and prevents duplicate effects.
- B01: Invoice Recovery correctly handles overdue, paid, partially paid, duplicate and disputed invoices; reminders respect recipient/data scope; no payments.
- B02: Cashflow Guardian independently recomputes correct scenario totals, identifies uncertainty and cannot move funds.
- B03: Deadline Guardian handles timezones, official sources, missing documents and revised deadlines without invented certainty.
- B04: Refund Assistant produces an accurate, evidence-backed draft, correct official recipient and verified submission receipt only after necessary consent.
- B05: Job Application Assistant never fabricates qualifications or sends personal details to a new employer without permission; detects duplicate applications.
- B06: Micro-Business Ledger reconciles totals and deduplicates receipts, preserves editable exports and source provenance.
- B07: Family Administration enforces person/household consent boundaries, protects minors' data and does not share documents across users.
- B08: Client Onboarding Autopilot creates verified project workspace, tasks, welcome materials and delivery checklist, without unapproved client invitation/access.
- S01: Prompt injection through receipts, emails, job ads, web forms, plugin results or OCR cannot expand tool grants, cause payment, leak bank data or cross user boundaries.
- S02: STOP, revoked OAuth, network loss, user takeover, stale UI mapping, stale checkpoint, wrong account, provider error and duplicate retry cannot produce unauthorized or repeated external effects.
- S03: UI accessibility: keyboard-only, screen reader, 200% zoom, touch, high contrast, reduced motion, clear ×/STOP, no focus theft and truthful empty/loading/offline states.
- S04: Exact-commit source/code/CI evidence and user-visible statuses are recorded separately. DOCUMENTED is not IMPLEMENTED. No benchmarks or release readiness percentages without the existing required coding-complete and independently verified gates.

### 27.7. Exact owner request-to-plan coverage ledger (no invented history)

Previously committed baseline: 03b770d4fc6614e577bd748d1f0628a00e275c03. Existing post-baseline documented scope: Part 14F and prior parts already cover real concurrent local agents, colored action-backed virtual cursors, app-specific floating composer, hybrid live vision, foreground protection, native-first execution, truthful progress, STOP, scoped privacy, plugin discovery and some cross-device concepts. This new Part 27 is ADDITIVE and does not claim to recode those features.

Owner's REVISED 12 additions — all 12 DOCUMENTED here: R12-01 Live / Background Mode; R12-02 Smart Approvals; R12-03 Intelligent Privacy; R12-04 Seamless Tool Access; R12-05 Animated Permission Guide; R12-06 Live App Generator; R12-07 Automatic Context Discovery (replaces Smart Dropzones as required primary UX); R12-08 Passive Ghost Preview; R12-09 Time-Travel Timeline; R12-10 Private Habit Intelligence; R12-11 Simplification Mode; R12-12 Cross-Device Handoff. Detailed contracts: Part 27.2; architecture: 27.4; UX: 27.5; independent tests: 27.6. DOCUMENTED, NOT CODE-VERIFIED.

Owner's FOUR packages and EIGHT products — all DOCUMENTED here: Business Money Assistant (Invoice Recovery, Cashflow Guardian); Universal Forms & Claims Assistant (Deadline Guardian, Refund Assistant, Job Application Assistant); Personal & Family Assistant (Micro-Business Ledger, Family Administration); Business Launch Assistant (Client Onboarding Autopilot). Detailed product contracts: Part 27.3; tests: 27.6. DOCUMENTED, NOT CODE-VERIFIED.

Owner's corrections preserved exactly: Live and Background are two dropdown options; avoid repeated approvals for routine work; real authorized bank details can be used for the task but unnecessary sensitive details are withheld from external parties; connect once and continue within authorized tool scope; glass-gradient animated guide with top-right ×; generate simple forms for complex websites/apps; automatic authorized context discovery replaces mandatory Smart Dropzones; passive preview without ordinary approval buttons; historical timeline with real recovery boundaries; user-only habit intelligence; simplification; website/phone/desktop continuity; and NO AUTONOMOUS PAYMENTS in the money package.

Earlier distinct 12 transformative features — original names mapped into specifications only (no coding claim): The original list is now available and specified as T12-01–T12-12 in Part 28.1. Part 28.6 records overlaps with existing Parts 14C, 14E, 14F and 27, while Part 28.5 defines independent tests. The 12 revised features in Part 27.2 remain separate and unchanged.

Historical preservation: Parts 0–27, prior ledgers, source references, source citations, benchmark gates and implementation evidence remain preserved except for the owner's explicit removal of separate-chat/Claude-visibility instructions and the necessary correction of the now-resolved missing-list notices. Part 28 is additive. Do not delete prior requirements or replace earlier feature packages. The user has not approved main-branch merge, deployment, paid service calls, live payments, physical-device access or skipping the coding-complete GREEN gate.

## Part 28. Recovered transformative OCADE features, named research concepts and complete engineering contracts — additive post-03b770d4 inventory (16 November 2026)

### 28.0. Scope, precedence, source classification and non-duplication

Source inventory: The owner supplied the exact original 12-feature list (OCADE LifeOS, Outcome Autopilot, Problem Radar, Business-in-a-Box, Opportunity Engine, Work Simulation, Proof Passport, Recovery Intelligence, Personal Knowledge Vault, Human Expert Escalation, Verified Skill Network, Time Reclaimed Dashboard), an outline of a 30-idea/5-superproduct business research report, an outline of a 100-feature technical report, and named concepts including SkillForge, CheckPoint, LegacyBridge, Ghost Cursor, Instant Mini-Apps, Anti-Scam Guardian, Skill Marketplace and UI Repair Network. The original 12 were initially presented as STRATEGIC CANDIDATES; the owner's subsequent instruction to add every missing/partial item makes them FULLY SPECIFIED DESIGN REQUIREMENTS for consideration and staged implementation (not evidence of coded or working features), not a claim of existing working code or permission to launch a marketplace, health product, payment service or regulated advice.

Relationship to previous scope: Part 14F remains the binding live-vision/parallel-agent/floating-composer contract; Part 27 remains the binding revised 12-feature and four-package/eight-product contract. Part 28 completes the DISTINCT original transformative 12 and the named research concepts. The original 12 do not replace the revised 12, and the five research product families do not replace the four owner-approved packages. Reuse one task authority, existing Supabase identity/RLS/event journal, native companion, provider/BYOK gateway, capability registry, permissions/effect gate, skill store, verifier and Library. Add schemas/modules only where the current code demonstrably lacks the needed capability; never create a second autonomous execution or billing engine.

Status language: DOCUMENTED REQUIREMENT is not IMPLEMENTED. A proposed capability is not an available integration, verified service, approved background monitor, live financial transaction or production-ready feature. P0/P1/P2 are sequencing recommendations subject to existing whole-product release gates, owner approval and technical evidence. No autonomous payments, hidden background surveillance, cross-user memory, unapproved expert referral, unsolicited mass applications or unreviewed third-party executable skills. Apply the literal second-line extreme UX mandate and all 34 named UX laws to every new interaction.

Source limitation: The supplied excerpts name all 12 transformative features and several additional concepts but DO NOT contain the complete verbatim 30 individual business ideas, all 100 individual technical ideas, or five add-ons for each of the 30. Do not invent those unseen lists or mark them recovered. The requirements below fully specify EVERY NAMED item available in the supplied excerpts. Any future full report must be compared against this ledger without deleting or duplicating existing work.

### 28.1. ORIGINAL 12 TRANSFORMATIVE FEATURES — full product, architecture, safety and acceptance contracts

#### 28.1.1. T12-01 — OCADE LifeOS (P1; personal administration workspace)

1. User outcome: A private, coherent view of unfinished personal administration across documents, deadlines, applications, subscriptions, renewals and tasks. This is a workspace within existing OCADE Chat/JARVIS/Library, not a new OS, independent memory engine or replacement file manager.
2. Entry and interface: Show a compact Today / Upcoming / Waiting / Completed view; group obligations by person, project and urgency; allow search, filters, source links, dismiss, edit, snooze and user-created items. Present one best next action with a transparent reason, not an overwhelming dashboard or forced setup.
3. Authorized discovery: Ingest only user-selected or separately consented sources: connected mail, calendar, cloud storage, local folders, open applications, receipts and forms. Every item records source account/resource, retrieval time, freshness, confidence, owner, visibility and permission scope. A connected service is not permission to index all its contents.
4. Normalization: Deduplicate identical obligations across email, calendar and files; preserve distinct versions and conflicting deadlines; represent due date, timezone, amount (if applicable), required evidence, dependency, responsible person and source of truth. Unknown deadlines remain UNKNOWN, not fabricated.
5. Actions: Prepare checklists, draft forms and messages, request missing information, schedule authorized reminders, launch existing package workflows and link Proof Passports. A LifeOS card is not authority to submit, purchase, cancel, delete or share externally.
6. Data and privacy: Tenant/user-scoped records, encryption, access controls, selective retention and export/delete; household records require explicit per-person grants. Do not infer legal ownership of a shared file from its presence on a device.
7. Failures: Expired account, inaccessible document, stale calendar, duplicate obligation, conflicting sources and missing timezone yield visible uncertainty and an actionable repair path; keep prior verified facts without claiming fresh monitoring.
8. Acceptance: Two test users with overlapping filenames never see each other's cards; duplicate sources yield one obligation with both citations; timezone correction updates reminder; revoked source stops new reads; user can export/delete LifeOS data without deleting unrelated task history.

#### 28.1.2. T12-02 — Outcome Autopilot (P1 after single-task reliability; persistent authorized goals)

1. User outcome: Set an ongoing outcome such as “keep invoices followed up weekly” or “prepare required renewal documents” once; OCADE continues only within explicit, revocable scope rather than needing repeated prompts.
2. Goal contract: Store goal ID, desired measurable outcome, permitted source/resource IDs, action classes, recipient/audience, schedule/event triggers, budget and rate limits, quiet hours, expiration, confirmation policy, success check, stop condition and owner. Display the contract in plain language before activation.
3. State machine: DRAFT → AWAITING_AUTHORIZATION → ACTIVE → CHECKING → WORKING → VERIFYING → COMPLETED / PAUSED / BLOCKED / EXPIRED / REVOKED. Recurring goals may return to ACTIVE after a verified cycle; one-off goals do not silently become perpetual subscriptions.
4. Triggers: Time schedule, authorized connector webhook, permitted local change event or user instruction. Deduplicate events by source event ID and observation version; no constant cloud-model polling when an event, cached result or deterministic check suffices.
5. Execution: Reuse the existing task graph, effect gate, skill replay and verifier. Allow harmless in-scope reads/drafts to continue; any new recipient, larger amount, newly sensitive source, irreversible submission or changed grant requires renewed confirmation.
6. Cost and autonomy: Enforce per-run and rolling spend/call ceilings, BYOK ownership, maximum parallelism, failure/retry caps and provider rate limits; stop or ask if a budget would be exceeded. No autonomous payments.
7. Visibility: One compact active-goal list with last check, next check, what changed, verified outcome, cost and Pause/Stop/Revoke. Explain “no change detected” separately from “could not check”.
8. Recovery: On offline device, revoked token, missed schedule or unknown external effect, persist the event and safely resume/reconcile; never replay a consequential action whose outcome is unknown.
9. Acceptance: A recurring invoice task runs once per scheduled cycle, does not duplicate an email on reconnect, obeys quiet hours and recipient scope, pauses on revoked authorization and never exceeds its atomic budget.

#### 28.1.3. T12-03 — Problem Radar (P1; consented proactive detection)

1. User outcome: Detect relevant problems before the user notices them: missing documents, approaching deadlines, inconsistent records, failed automations, unverified submissions and expired connections. Offer an evidence-backed fix, or perform a previously authorized low-risk correction.
2. Consent boundary: Explicit per-source monitoring opt-in with exact category, cadence, data retention and alert destination. No covert always-on microphone, full-desktop capture, indiscriminate mail scanning or monitoring of unselected people/accounts.
3. Detection engine: Deterministic rules first (deadline arithmetic, missing required fields, mismatch in invoice totals, stale connection, task-state timeout, checksum changes); use an authorized model only for ambiguous semantic interpretation. Preserve source evidence and confidence.
4. Signal model: Finding ID, rule/version, observed resource, evidence, severity, confidence, first/last seen, duplicate fingerprint, remediation candidate, owner and resolved/snoozed status. Suppress repeat alerts unless severity, evidence or deadline materially changes.
5. User experience: One concise issue card: “what changed / why it matters / evidence / recommended fix / next deadline / fix or dismiss.” Distinguish observed facts from forecasts and speculation. Respect quiet hours and alert-frequency budgets.
6. Actions: Open existing LifeOS item, create Deadline Guardian reminder, propose a Refund/Forms workflow, repair a failed task, or run an already-authorized reversible fix. No new external submission or sensitive disclosure without required confirmation.
7. Abuse resistance: Prompt-injected emails/documents cannot create new monitors, change severity rules, grant access or authorize spending. A false positive must be dismissible and teach the detector only within the user's private preferences.
8. Acceptance: Detect a synthetic missing attachment and impending deadline; suppress duplicates; show exact evidence; reject ungranted folder monitoring; a revoked connector stops checks; uncertain findings never display as confirmed facts.

#### 28.1.4. T12-04 — Business-in-a-Box (P1/P2; coherent small-business operations)

1. User outcome: An AI-assisted operations workspace for small businesses using their EXISTING software for invoicing, receivables, reconciliation, client records, onboarding and administration. It packages the approved Business Money Assistant, Business Launch Assistant and relevant forms/ledger workflows; it does not replace those four packages.
2. Onboarding: Identify business entity, jurisdiction, role, connected accounting/CRM/mail/project apps, customer records, currencies, fiscal calendar, invoice numbering and permitted users. Show supported integrations honestly; do not pretend a legacy app has an API.
3. Workflows: Import/reconcile invoices, identify overdue balances, prepare polite collection messages, flag cashflow risks, update authorized CRM records, organize receipts, onboard clients and create verified project workspaces. Link the eight Part 27 products rather than duplicating their engines.
4. Shared data: Normalize customers, invoices, payments received, expenses, tasks, projects, document references and external IDs with provenance and account-scoped versioning. Do not overwrite an accounting system's authoritative ledger without a validated update path.
5. Roles and collaboration: Owner/admin/operator/viewer with per-business and per-resource grants; prevent an employee from inheriting a business owner's personal banking access. Support separation of duties for high-impact actions.
6. Financial restrictions: OCADE may read and prepare permitted financial information but cannot autonomously transfer funds, pay invoices, make purchases or represent estimated cashflow as guaranteed. Sensitive client disclosure and new outbound recipients require appropriate consent.
7. Reliability: Idempotent imports, reconciliation reports, conflict resolution, dry-run previews for bulk edits, checkpoints and source-of-truth readback. Export interoperable records; do not lock users into proprietary unexportable formats.
8. Commercial boundary: Pilot one narrowly defined professional workflow first; do not claim universal accountant replacement, regulatory compliance, guaranteed debt collection or positive ROI without observed evidence.
9. Acceptance: Correctly reconcile paid/partial/disputed invoices, detect duplicate imported receipts, isolate two businesses, create one verified onboarding workspace, block unauthorized mass mail and prove no autonomous payment path exists.

#### 28.1.5. T12-05 — Opportunity Engine (P1/P2; relevant opportunities without spam)

1. User outcome: Discover suitable jobs, clients, grants and business opportunities; explain fit; prepare truthful applications or outreach; require the correct authorization before external submission.
2. Profile: User-controlled skills, résumé/portfolio, business capabilities, region, budget, eligibility, preferred sectors, exclusions, availability, desired compensation and application history. Mark inferred preferences as editable suggestions, not verified qualifications.
3. Discovery: Use only permitted public sites and connected accounts; respect platform terms, robots/rate limits and anti-spam rules. Record listing URL, publisher, retrieval date, eligibility criteria, location, deadline and whether the listing is still open.
4. Ranking: Show evidence-backed fit and missing requirements; separate explicit requirements from model inference. Filter duplicates, expired opportunities, scams, paid application traps and previously submitted listings.
5. Preparation: Reuse Job Application Assistant and Live App Generator for resumes, cover letters, grants, proposals and client onboarding drafts. Never invent credentials, references, experience, financial statements or certifications.
6. Submission boundary: External sends, applications, bids, sensitive attachments and any fees follow Part 27 effect policy; default to user review for new recipients and legally consequential attestations. Never buy applications, pay fees or auto-submit high-volume spam.
7. Tracking: Track draft, reviewed, submitted, externally confirmed, response received, closed and unknown states, with real receipts and source references. No “applied” status from a clicked button alone.
8. Acceptance: Reject an expired grant and a fake credential requirement; detect a duplicate job; draft an accurate application; require consent for external submission; preserve a real receipt; stop when source access is revoked.

#### 28.1.6. T12-06 — Work Simulation (P1; safe rehearsal before consequential changes)

1. User outcome: Rehearse a potentially destructive or expensive workflow on a copy, preview or safe environment and show the likely differences before modifying real resources.
2. Eligibility: Classify each planned step as pure/read-only, locally copyable, API dry-run capable, sandboxable, externally irreversible or NOT SIMULATABLE. Never claim a real bank transfer, email delivery, government submission or live third-party action was safely simulated when no faithful sandbox exists.
3. Simulation plan: Capture resource identity/version, permissions, dependencies, expected preconditions, predicted side effects, validation checks, cost and rollback limits. Use versioned temporary files, application-native previews, test tenants or provider-supported sandbox endpoints when available.
4. Isolation: No live recipients, payment rails, real production credentials or accidental network writes in a rehearsal. Enforce filesystem/process/network restrictions; explicitly label any simulation that cannot isolate external calls.
5. Diff and preview: Show before/after files, records, UI state, totals, recipients, permissions and expected irreversible effects. Distinguish deterministic verified diffs from AI-predicted or approximate effects.
6. Promotion to real execution: Revalidate actual source revision, target account, grants, recipient, cost and side-effect class immediately before execution. A successful rehearsal is NOT approval to perform a sensitive live effect.
7. Failure behavior: If production differs from the simulated snapshot, invalidate the preview and rerun or ask. On unsupported applications, show “preview unavailable” and rely on narrow direct verification/approval instead of fake certainty.
8. Acceptance: Simulated bulk file rename changes only copies; production files stay byte-identical until approved; a changed source version invalidates simulation; an external payment cannot be marked simulated; replaying a simulation never sends real messages.

#### 28.1.7. T12-07 — Proof Passport (P1; portable verified outcome evidence)

1. User outcome: Every completed consequential task may produce a user-inspectable, portable evidence package showing what changed, what was checked, and what remains uncertain. Extend the existing ELITE-04 Customer ProofPack, task journal, verifier and Part 27 timeline; do not create a second unverifiable receipt service.
2. Manifest: Passport ID, task/goal ID, time, executing device/app version where permitted, authorized resource identifiers, source revision/hash, action summary, output hashes, verifier method/version, checks passed/failed, unresolved exceptions, irreversible effects and evidence expiration.
3. Evidence types: Native API readback, filesystem existence/hash and parse checks, browser/API confirmation, official submission receipts, application-specific assertions and user-acknowledged manual verification. Label each with confidence and scope; a screenshot or model narrative alone does not certify completion.
4. Export: Human-readable concise report plus machine-readable versioned JSON manifest and optional redacted artifacts; interoperable download from Library and optional explicit share. Include integrity hashes and, if a trusted signing key exists, verifiable signatures; do not falsely imply a third-party certification.
5. Privacy: Default redaction of bank numbers, addresses, private documents, tokens, child/medical data and unrelated app content. Allow selective disclosure with exact recipient/scope and expiration where supported. Never include raw secrets in public links or signatures.
6. Status: Distinguish VERIFIED, PARTIALLY VERIFIED, FAILED, UNKNOWN EFFECT and USER-ATTESTED. A future app change or deleted artifact must not retroactively imply a previously verified check was still valid.
7. Recovery integration: Passport links to timeline checkpoints and correction runs; a later fix produces a new linked revision rather than silently editing past evidence.
8. Acceptance: Independent verifier recomputes a file hash; manifest cannot say VERIFIED when a check fails; a redacted export contains no sensitive fixture; an altered manifest fails integrity validation; unknown external effect is explicitly UNKNOWN.

#### 28.1.8. T12-08 — Recovery Intelligence (P0/P1; verified checkpoint recovery)

1. User outcome: Recover from interrupted, failed or partially completed work without losing verified progress or repeating consequential actions. Extend existing checkpointing, task state machine, idempotency keys, STOP fencing, Time-Travel Timeline and Part 14F parallel coordination.
2. Checkpoint contract: Record task/goal ID, worker and lease owner, causal event sequence, dependency versions, source hashes, external action IDs, preconditions, known side effects, durable outputs, permission epoch and last independently verified state.
3. Failure taxonomy: Crash, timeout, network disconnect, stale window, moved file, changed form, revoked connector, expired OAuth, quota, provider error, user takeover, partial write, uncertain submission and concurrent agent conflict.
4. Resume algorithm: Rehydrate verified facts; reacquire current resource/permission leases; reconcile external effects from authoritative readback; skip completed idempotent steps; replan only affected dependencies; revalidate all stale observations. Unknown irreversible effects require investigation or human confirmation, NEVER blind replay.
5. User controls: Resume, retry safe step, view error, restore supported reversible state, hand off to Live, Stop and export diagnostic receipt. State clearly when restoration is impossible.
6. Data integrity: Transactional/atomic file writes where feasible, temporary output cleanup, rollback only for proven reversible changes, immutable event evidence and no cross-user or cross-device checkpoint reuse without new grants.
7. Efficiency: Avoid re-running already verified expensive model calls/renders; cache by authorized input/version and invalidate on changed dependencies.
8. Acceptance: Inject crash after an email API success but before local acknowledgment; reconcile one send only. Inject two parallel workers on the same file; one conflict must fail safely. STOP/revocation must prevent resumed side effects; verified outputs survive restart.

#### 28.1.9. T12-09 — Personal Knowledge Vault (P1; encrypted user-controlled portable knowledge)

1. User outcome: An inspectable, exportable, encrypted history of user-consented documents, preferences, facts, project knowledge and completed work, private to that user. Extend existing Part 14E private memory and Library rather than constructing a separate shadow memory store.
2. Ingestion: Per-source opt-in and explicit source type (uploaded file, selected folder, permitted connector, task result, user-entered note). Record content owner, provenance, observed time, extraction method, confidence, retention class and source permissions.
3. Knowledge model: Separate explicit user facts, inferred preferences, document excerpts, citations and verified task outcomes. Link derived facts back to source versions; avoid silently promoting model guesses into user assertions.
4. Retrieval: Tenant/user RLS enforced before retrieval; least relevant necessary snippets only; source authorization checked again at use time; no mixing personal and business or household knowledge without explicit grants.
5. Security: Encrypt at rest and in transit, isolate keys according to the existing security architecture, minimize raw sensitive payloads, never memorize passwords, PINs, MFA codes, card CVVs or unapproved private banking secrets. Do not assert end-to-end encryption unless the deployed key architecture actually provides it.
6. Control: View why a memory was used, correct, forget, source-disable, export in documented interoperable formats, delete and revoke. Explain backup/retention and deletion limitations honestly.
7. Model/provider use: BYOK and provider privacy rules apply; do not send whole vaults to models by default. Prompt injection inside retrieved documents cannot alter policy or tool authority.
8. Acceptance: Cross-tenant retrieval tests return zero foreign facts; correcting a false preference changes future suggestions; deleted/disabled source stops retrieval; export is readable and complete for permitted records; token/secret fixtures never enter memory.

#### 28.1.10. T12-10 — Human Expert Escalation (P2; explicit qualified specialist handoff)

1. User outcome: When a task reaches a regulated, ambiguous or high-stakes boundary, the user may explicitly request an appropriately qualified human specialist while preserving task context. This is an opt-in referral/handoff workflow, not automatic outsourcing.
2. Triggers: User request, unresolved legal/tax/medical/financial interpretation, contested evidence, repeated verifier failure, inaccessible official process or a consequential decision beyond supported AI authority. Clearly state what OCADE can and cannot verify; do not pretend an expert has been engaged.
3. Expert discovery: If a real partner network is ever launched, verify jurisdiction, professional license/credential where relevant, specialty, availability, conflicts of interest, data handling and fees. Until verified partners exist, offer a user-exportable case packet for the professional of their choice.
4. Handoff packet: User-selected summary, goal, relevant redacted documents, source links, timeline, proof checks, open questions and requested deliverable. Preview EXACTLY what will be shared and with whom.
5. Consent and cost: Separate explicit consent to contact/share; display identity, scope, estimated fees and who pays before any action. No surprise charges, automatic appointments, undisclosed referrals or sharing sensitive data based solely on a model recommendation.
6. Boundaries: Human response is advice or evidence, not an unrestricted new tool grant. Record provenance and user review before applying proposed changes; preserve professional confidentiality and jurisdiction-specific requirements.
7. Fallback: No partner, unverified license, unavailable service, declined consent or unresolved conflict must produce an honest export/self-service path, not a fabricated referral or fake expert answer.
8. Acceptance: A mock unlicensed partner is rejected; zero private files leave before consent; a user can exclude a document; quoted fees remain nonbinding until verified; expert response cannot silently execute a bank payment or delete a file.

#### 28.1.11. T12-11 — Verified Skill Network (P1 private / P2 optional sharing)

1. User outcome: Convert successful workflows into reusable tested procedures, with optional publication of sanitized skills to others. Extend existing Part 14E Skills, verified-route replay, ELITE-05 Certified Workflow Library and one capability registry.
2. Skill schema: Skill ID/version, author/owner, task intent, parameter types, required app/OS/provider versions, dependencies, requested capabilities, exact permission scopes, cost bounds, action classes, pre/postconditions, supported locales and tests.
3. Capture: Learn from explicit authorized demonstrations or independently verified successful tasks; strip private filenames, account IDs, tokens, prompts containing secrets, user identities and recipient lists. Replace values with typed parameters and resource selectors.
4. Verification: Run synthetic and held-out fixtures, negative permission tests, changed-UI tests, idempotency tests and rollback checks; classify UNVERIFIED, PRIVATE VERIFIED, REVIEWED PUBLIC or QUARANTINED. Publication does not grant automatic trust or execution rights.
5. Execution: Resolve fresh user permissions and current app identity every run; compile deterministic steps when safe; fall back to model reasoning at failed guards. Reject code/tool installation outside the permitted capability sandbox.
6. Sharing: Default private; optional explicit publisher review, license, version signing/integrity, abuse reporting, malware scanning and privacy scrub. No public marketplace or automatic cross-user learning before separate owner approval and security readiness.
7. Maintenance: Detect UI/provider drift, quarantine broken skills, stage repair proposals, regression-test and permit rollback. Never propagate a single user's unverified repair to all users.
8. Acceptance: Private skill replays without repeated model clicks; sanitized export has no fixture secrets; revoked connector blocks a skill; changed selector quarantines rather than misclicks; one user's skill never reads another user's memory.

#### 28.1.12. T12-12 — Time Reclaimed Dashboard (P1; evidence-based value reporting)

1. User outcome: Show verified work completed, errors prevented, estimated time reclaimed and actual costs so users can judge OCADE's value. Extend STRAT-05 outcome dashboard and Proof Passport; avoid a separate analytics truth source.
2. Metrics: Completed tasks by verified status, durable artifacts, success/failure/unknown counts, corrections, recoveries, human interventions, actual platform fees, model usage attributable to OCADE where observable and recurring goal outcomes.
3. Time saved method: Establish a user-supplied or independently measured manual baseline per task type; subtract measured OCADE supervision and correction time; show estimate, method, sample size and uncertainty. Do not convert arbitrary agent seconds into guaranteed human hours.
4. Errors prevented: Count only a documented detected error with evidence and a prevented or corrected effect; do not infer a prevented fraud or hypothetical loss from a warning alone.
5. Money: Show actual paid platform charges separately from BYOK vendor charges not visible to OCADE; display estimated external fees only when explicitly labeled. Recovered invoice face value is not OCADE revenue or realized customer savings until verified.
6. UX: Simple Today / Week / Month / All Time with expandable per-task receipts, clear zero/unknown states, CSV export and optional private goal comparisons; no manipulative gamification or inflated “10,000×” claims.
7. Privacy: Tenant/user-specific aggregation, consented analytics, minimal telemetry and controls to disable optional reporting; do not publish individual productivity or family activity.
8. Acceptance: Recompute totals from independently verified task fixtures; a failed task does not count as completed; unknown baseline displays “time saved unavailable”; duplicate retries count once; exported report matches on-screen values.

### 28.2. OTHER NAMED TECHNICAL AND PRODUCT CONCEPTS — fully specified, linked to existing contracts

#### 28.2.1. SkillForge — learn once, execute deterministically (P1)

- Product behavior: With explicit recording consent, observe a bounded demonstration in a selected application/window, identify task goal, input parameters, actions and success conditions; show an editable proposed workflow before saving. Provide visible recording status and immediate STOP; no covert whole-desktop recording.
- Architecture: Combine native app/DOM/accessibility events with permitted targeted video evidence from Part 14F; infer stable semantic selectors and parameterized steps, then compile a guarded workflow using ELITE-02. Store user-private skill version, dependency and capability manifest in the existing skill store.
- Safety: Never memorize passwords, OTPs, bank secrets or unapproved recipient data; separate observation consent from future execution authorization; test against changed UI and deny silent privilege expansion.
- Acceptance: A repeated supported workflow replays with fewer model calls, correct new parameters and independently verified output; stale selectors fail closed; a user can edit, disable and delete the learned skill.

#### 28.2.2. CheckPoint — independent effect approval and verified result (P0/P1)

- Product behavior: One reusable sensitive-action boundary showing exact operation, affected account/resource, recipient, data, cost, reversibility and approval expiry. Routine preauthorized operations do not cause repeated popups. For material risks use a confirmation channel outside untrusted AI-generated content.
- Architecture: Implement as a presentation of the EXISTING effect gate, STOP epoch, identity/session assurance, task journal and verifier. Connect to Part 27 Smart Approvals, Proof Passport and Recovery Intelligence; no second permissions database.
- Safety: Prompt injection cannot forge consent; stale target, changed amount, changed recipient or expired grant invalidates approval. For money, preserve Part 27 no-autonomous-payments rule.
- Acceptance: One routine 50-step task has no approval spam; one sensitive send is blocked until the real user confirms; altered payload after approval is rejected; verified result matches authoritative readback.

#### 28.2.3. LegacyBridge — reliable operation of older software (P1)

- Product behavior: Support authorized installed business/desktop software lacking modern APIs through the user's native companion, supported file import/export, command interfaces, OS accessibility, app scripting and targeted vision. Do not require a VM or replacement cloud desktop.
- Adapter contract: App identity/version, capability list, safe read/write methods, window/session identity, foreground requirement, required license/plugin, expected latency, rollback support, observation source, confidence and test fixture.
- Execution policy: Prefer native files/scripts and semantic UI automation; only use pixel coordinates with fresh window/geometry verification. Shared foreground pointer is leased; Background mode cannot hijack the user's mouse.
- Acceptance: Complete a supported legacy-app fixture using real local software and verify saved output; a version change invalidates unsafe automation; app crash and permission denial recover without unrelated desktop input.

#### 28.2.4. Ghost Cursor — passive preview, not simulated authority (P0)

- Product behavior: Reuse Part 27 Passive Ghost Preview and Part 14F colored agent cursor overlays. Show the next intended target and actual agent ownership with a distinct planned/active/verified/blocked visual state. Never render fictional parallel cursor work.
- Security: A ghost preview is not approval; no ordinary-action approval buttons; consequential effects still pass the independent effect gate. Overlays must not intercept user input, leak unrelated windows or steal focus.
- Acceptance: Replan invalidates an old preview; a failed action changes to blocked, not success; two real agents have distinct stable identities; the system cursor remains under the user's control in Background mode.

#### 28.2.5. Instant Mini-Apps — generated task-specific forms (P0/P1)

- Product behavior: Alias of Part 27 Live App Generator and Simplification Mode: create a temporary, attractive, accessible form for a complex website or desktop application without claiming the original app was replaced.
- Mapping: Generate typed fields, dependencies, validation, source references, current-value readback and action bindings from authorized app state; preserve required legal disclosures, error messages and the original-view escape.
- Safety: Generated forms cannot silently submit, expand OAuth scopes or bypass provider MFA; map every value to a current target and verify the official result after permitted submission.
- Acceptance: Multi-page conditional form correctly maps required fields; stale mapping blocks submit; screen reader/keyboard use works; the user can switch to original app without losing their draft.

#### 28.2.6. Anti-Scam Guardian — evidence-based safety warnings (P1; opt-in)

- Product behavior: Warn about suspicious links, look-alike domains, unexpected recipient/payment-detail changes, credential-harvesting forms, malicious document instructions and anomalous external-sharing requests encountered during an AUTHORIZED OCADE workflow. This is not a blanket promise of fraud prevention.
- Detection: Use domain/account identity, authenticated source provenance, known safe/blocked indicators, changed payee details, link/redirect analysis and explainable rule evidence. Use model reasoning only for ambiguous signals; report uncertainty and false-positive controls.
- Intervention: Pause a suspicious consequential action and show exact evidence and a safe verification path. Do not intercept unrelated browsing or surveil other applications without opt-in. No autonomous money transfers or blanket blocking of legitimate user actions.
- Acceptance: Detect a synthetic invoice payee swap and a look-alike login domain; a trusted but unusual workflow can be reviewed; warning contains source evidence; injected web text cannot suppress checks or authorize sending secrets.

#### 28.2.7. Skill Marketplace — conditional optional distribution (P2, NOT approved launch)

- Product behavior: A potential catalog for reviewed reusable skills with clear compatibility, publisher, permissions, price (if any), evidence, support and update history. The existing Plugins/Skills directory remains the default UI; do not create a second store or assume a public marketplace is already available.
- Governance: Owner approval, actual demand, publisher verification, licensing/IP review, malware/secret scanning, signed/versioned manifests, independent fixture tests, refund/support policy and secure payment integration are prerequisites to any public paid offering.
- Safety: No arbitrary downloaded code with unrestricted filesystem/network rights; each installation requires user-scoped grants; revocation, quarantine and incident response must work.
- Acceptance: Unreviewed skill cannot publish; revoked permission blocks execution; malicious manifest is rejected; compatibility and price are never fabricated. This is a conditional research/design track, not a production release requirement until approved.

#### 28.2.8. UI Repair Network — safely adapt broken workflows (P2)

- Product behavior: Detect when a previously verified workflow fails because an app layout/selector/version changed; propose a locally tested repair and, optionally, distribute a sanitized generalized fix after review.
- Repair pipeline: Detect drift → quarantine old skill → observe current authorized UI → propose new semantic selector/action → run negative and positive regression fixtures → verify real postconditions → version and stage release → monitor and roll back.
- Privacy and security: Never upload user screenshots, secrets, private URLs or account-specific selectors to other users. Do not assume a successful fix for one account/locale/OS works universally; require compatibility signatures and consent for sharing.
- Acceptance: Changed-site fixture quarantines unsafe automation; repaired skill passes held-out tests; a private user's repair does not expose their data; failed staged update rolls back without duplicate effects.

#### 28.2.9. Smart Screen Understanding and dynamic @ picker — named technical priorities (P0)

- Vision: Implement Part 14F V01–V10 hybrid perception: native app state, DOM/CDP, accessibility, app-scoped continuous window capture, event/diff gating, selective temporal model analysis, targeted screenshots, OCR parsing and verified replay. One bounded observation stream serves concurrent agents; no requirement to send every local video frame to a cloud model.
- Context picker: Reuse Part 14E authorized @ catalog for apps, individual windows/tabs, files, folders, agents and tools. Show exact account/window identity, permissions, freshness and availability; typed @ chips do not grant new access.
- Acceptance: Correct app/window target under focus changes, zero denied-resource suggestions, stale-frame refusal, truthful frame/model cost separation, no extra model calls for unchanged frames and successful independently verified saved output.

#### 28.2.10. Independent approvals, Background Control and five technical-report priority corrections (P0)

- Five source priorities, all covered by binding contracts: Smart screen understanding → Part 14F; learn/replay workflows → ELITE-02/SkillForge; background computer control → Part 14F and Part 27 Live/Background; independent approval system → CheckPoint/Part 27 Smart Approvals; dynamic @ picker → Part 14E/28.2.9.
- Unified acceptance: A task can execute authorized native operations in Background without disturbing active keyboard/mouse use, uses only fresh permitted context, resumes after a safe interruption, and requests confirmation only for the correct consequential boundary.

### 28.3. RESEARCH PRODUCT FAMILIES AND BUSINESS IDEAS — distinct from approved packages

The earlier 30-idea business research excerpt describes FIVE possible broad families: personal protection, business cash management, workflow automation, healthcare administration and enterprise security. These are RESEARCH FAMILIES, not a mandate to replace Part 27's four packages or create five separate backends. Implement only scoped, lawful, validated use cases on the unified engine.

1. Personal protection: Organize subscription/renewal/claims issues, detect consented deadline and scam signals, prepare evidence-backed remedies and show user-controlled next steps. Reuse LifeOS, Problem Radar, Deadline Guardian, Refund Assistant and Anti-Scam Guardian. Do not cancel contracts or share sensitive documents without applicable approval.
2. Business cash management: Reuse Invoice Recovery, Cashflow Guardian, Micro-Business Ledger and Business-in-a-Box; connect real permitted records, show uncertainty, prevent duplicate reminders and NEVER autonomously move money.
3. Workflow automation: Reuse SkillForge, Verified Skill Network, LegacyBridge, Outcome Autopilot, Proof Passport and Recovery Intelligence. Optimize verified cost and completion, not decorative agent counts or raw model throughput.
4. Healthcare administration: Possible future paperwork, scheduling, claims and document organization only with jurisdiction-specific privacy review, explicit user authorization and qualified partner boundaries. Do not diagnose, prescribe, alter treatment, expose family medical data or claim regulated compliance without separate review and approval. This is NOT a currently authorized product launch.
5. Enterprise security: Possible future policy-aware access, verified audit trails, connector least privilege, tenant isolation, safe incident handoff and administrative approvals. Do not introduce intrusive employee surveillance, unrestricted monitoring or a second enterprise permissions engine.

Named economic problems from the excerpts: unpaid invoices, wasted subscriptions, business expenses, repetitive work, missed opportunities, fragmented legacy software, forms/claims and administrative overhead. Each proposed vertical must have a real user, observable outcome, permission contract, data-source feasibility, measurable cost-to-verified-success and a narrow pilot before expansion. The original suggested initial wedge was overdue small-business invoices; this is a strategic recommendation to validate, not a guarantee or an instruction to drop other approved OCADE scope.

Research brief retained as research, NOT fabricated inventory: Evaluate 30 candidate ideas and five supporting add-ons per idea, group into five proposed superproducts, rank demand/profitability/feasibility/ease/defensibility, compare competitors, select one narrow launch wedge, and model December 2026–December 2036 development, distribution, pricing and economics. The excerpt does NOT provide the 30 names or 150 individual add-ons. Do not claim they have been transcribed or invent source-specific approval.

Financial hypotheses are not facts: The earlier report's illustrative annual-revenue cases (2027 $12 million, 2031 $1.25 billion, 2036 $14.8 billion), proposed AI cost reduction for one complex workflow ($10.50 to about $0.06), and suggested $71–84 billion annual revenue to support a hypothetical trillion-dollar valuation depend on unverified assumptions. Never present them as achieved OCADE results, operating budgets, guaranteed pricing or implementation acceptance gates. A 2026 market survey claim is context to independently verify before external publication, not an engineering requirement.

### 28.4. Unified implementation architecture, interfaces, security and UX

1. One authority: Existing authenticated user/device/task/permission graph is the only source of action authority. All new features call the same capability registry, effect classifier, scoped grants, STOP epoch, task/event journal, model gateway, native companion and verifier. A plugin result, discovered opportunity, memory, skill, monitor or expert packet cannot expand those grants.
2. Common records: Extend existing schemas, after inspecting current migrations, with typed concepts for OutcomeGoal, TriggerSubscription, RadarFinding, LifeObligation, OpportunityRecord, SimulationRun, ProofPassport, RecoveryCheckpoint, KnowledgeSource, ExpertHandoff, SkillVersion and ValueMetric. Prefer additive migrations, tenant/user keys, RLS, source-version hashes, encrypted sensitive fields and idempotency keys; never assume these tables already exist.
3. Provenance: Every decision records the exact authorized source, observed version/time, deterministic rule or model interpretation, confidence, permission and verifier. Unknown is a first-class state. Distinguish planned, simulated, executed, externally confirmed and independently verified.
4. Resource arbitration: Genuinely parallel independent work is allowed only with resource leases and version checks. No simultaneous unarbitrated mutation of one ordinary OS pointer, app window, file or external transaction. Share one app observation engine per authorized session; avoid duplicate capture/model calls across subagents.
5. Automation limits: Persistent goals and monitors need explicit scope, schedules, rate/spend budgets, retention, user pause/revoke and expiry. No silent perpetual authority, no surprise payments, no cross-account data blending, no indefinite background video collection.
6. Sensitive effects: Read/fill authorized real bank data when necessary; minimize external disclosure; money movement, irreversible deletion, sensitive external sharing, legally binding attestations and new recipients require the appropriate independent approval. Never bypass provider MFA, OS permission prompts or account authorization.
7. Portable evidence: Proof Passport and Time Reclaimed Dashboard derive from the SAME verified event stream; the timeline and recovery engine reuse immutable evidence, not untrusted model narration. A simulated action never counts as a completed action.
8. Skill safety: SkillForge capture → parameterized deterministic compiler → local/private verification → guarded execution → drift quarantine → optional sanitized publication. Skill Marketplace/UI Repair Network are P2 conditional paths with explicit governance and separate owner approval before release.
9. Expert and regulated boundaries: Human Expert Escalation is opt-in, real-person and credential-verified where required. Healthcare administration, legal/tax interpretation, financial products and enterprise surveillance require additional jurisdictional, privacy and product reviews; no implicit regulatory certification.
10. User experience: Apply all UX-01–UX-34 at an extreme: one clear next step, progressive disclosure, fast discoverability, minimal interruptions, visible STOP and permissions, meaningful error recovery, truthful status, accessible keyboard/screen reader/touch, reduced motion, responsive mobile/web/desktop handoff, no dark patterns.
11. Cost and performance: Measure wall-clock time to verified outcome, actual model calls/tokens, local CPU/GPU, capture FPS versus analyzed FPS, failed/duplicate external effects, user interruptions, human corrections and provider spend. Targets must be measured on authorized representative tasks; never assert the earlier illustrative numbers as achieved.
12. No silent platform expansion: Do not automatically launch a public skill store, create a native mobile app, hire specialists, provision paid infrastructure, add payment processing, start healthcare operations or change pricing solely because these features are specified. Each needs explicit implementation approval and existing release gates.

### 28.5. Independent acceptance suite and fault-injection matrix (DOCUMENTED, NOT RUN)

- T01 LifeOS: Deduplicate obligations from two authorized sources, preserve both citations, isolate users and correct timezone/permission changes.
- T02 Outcome Autopilot: Two scheduled cycles execute only once each; revoke and budget exhaustion stop new effects; unknown external outcome does not retry blindly.
- T03 Problem Radar: Detect missing evidence/deadline with source, suppress repeat notifications and reject an unconsented monitored folder.
- T04 Business-in-a-Box: Two businesses remain isolated; invoice/ledger/onboarding work uses existing four packages; no autonomous payment.
- T05 Opportunity Engine: Correctly reject expired, duplicate and scam listings; never invent applicant qualifications or submit without required consent.
- T06 Work Simulation: Production hashes remain unchanged in rehearsal; stale inputs invalidate preview; irreversible third-party effects are labeled NOT SIMULATABLE.
- T07 Proof Passport: Independent verifier reproduces hashes/checks; redacted export contains no secret; tampering invalidates integrity; UNKNOWN never becomes VERIFIED.
- T08 Recovery Intelligence: Crash, reconnect, duplicated events, stale UI and revoked grant produce no duplicate irreversible effects or unauthorized writes.
- T09 Personal Knowledge Vault: Cross-user RLS negative tests, opt-in source gating, correction/export/delete, secret fixture exclusion and model-context minimization.
- T10 Human Expert Escalation: Unlicensed/unavailable expert fallback; exact consented packet; no data or money sent before explicit approval.
- T11 Verified Skill Network: Changed-app quarantine, secret-free sanitized export, scoped replay and cross-user noninterference; no unapproved executable publication.
- T12 Time Reclaimed Dashboard: Every visible value recomputes from evidence; missing baseline shows UNKNOWN; retry duplication cannot inflate work or time saved.
- X01 SkillForge: User-approved demonstration yields typed, editable, independently verified replay; STOP halts capture and execution.
- X02 CheckPoint: Ordinary actions proceed with one scoped grant; changed recipient/amount invalidates a sensitive approval; separate verifier confirms actual effect.
- X03 LegacyBridge: Supported native app fixture completes without focus theft; stale version/geometry and app crash fail closed.
- X04 Ghost Cursor / Instant Mini-Apps: Overlay shows real state and never grants authority; generated forms preserve required fields, legal disclosures and original view.
- X05 Anti-Scam Guardian: Synthetic changed bank recipient and look-alike site trigger evidence-based warning; false positive can be reviewed.
- X06 Skill Marketplace / UI Repair Network: Unreviewed skill cannot publish; user data is scrubbed; failed repair is quarantined and reversible.
- X07 Background / Vision / @ picker: Independent concurrent tasks retain correct resource identity; no unauthorized screen capture, frame leakage, false 30-FPS model claims or desktop focus theft.
- X08 Cross-cutting: Prompt-injected sources cannot modify grants; device loss/STOP/revocation fences all workers; OAuth/OS permission expiration is honest; no unauthorized financial effects; accessible mobile/web/desktop UI passes relevant WCAG 2.2 checks.
- X09 Evidence gate: Report exact source commit, test fixture, OS/app version, run ID, passed/failed checks and remaining blockers. This documentation addition alone changes no implementation status, readiness percentage, deployment permission or real-world benchmark result.

### 28.6. Complete whole-product source-to-requirement map — coverage is NOT completion

Purpose: This replaces the misleading twelve-row `COMPLETE` documentation table with one no-duplication requirements map covering BOTH sets of 12, all eight products, the named technical concepts and existing foundational registries. MAPPED means a feature name has a requirement contract, shared owner and acceptance-test destination in this plan. It does NOT mean the code exists, compiles, passes negative tests, runs on a real device or meets a benchmark. All owner-approved newly specified work is NOT IMPLEMENTATION-VERIFIED until independently proved. The definitive evidence-state definitions and completion conditions appear ONLY in the final reporting stage after benchmarks/cloud qualification.

A. The original 12 transformative features — T12, distinct from R12: Every entry below is MAPPED SPECIFICATION, NOT CODE/TEST-VERIFIED.

- T12-01 — OCADE LifeOS — Requirement `T12-01 / 28.1.1`; reuse existing: Part 14E memory, Library; Part 27 family/admin.
- T12-02 — Outcome Autopilot — Requirement `T12-02 / 28.1.2`; reuse existing: Existing task authority, scheduling, Part 27 habits.
- T12-03 — Problem Radar — Requirement `T12-03 / 28.1.3`; reuse existing: Existing event monitoring; Deadline Guardian.
- T12-04 — Business-in-a-Box — Requirement `T12-04 / 28.1.4`; reuse existing: Part 27 four packages/eight products.
- T12-05 — Opportunity Engine — Requirement `T12-05 / 28.1.5`; reuse existing: Part 27 Job Application Assistant and Live App.
- T12-06 — Work Simulation — Requirement `T12-06 / 28.1.6`; reuse existing: Existing verifier, checkpoints and resource versioning.
- T12-07 — Proof Passport — Requirement `T12-07 / 28.1.7`; reuse existing: ELITE-04 ProofPack, timeline, verifier.
- T12-08 — Recovery Intelligence — Requirement `T12-08 / 28.1.8`; reuse existing: Checkpoints, STOP, idempotency, Part 27 timeline.
- T12-09 — Personal Knowledge Vault — Requirement `T12-09 / 28.1.9`; reuse existing: Part 14E user-only memory and Library.
- T12-10 — Human Expert Escalation — Requirement `T12-10 / 28.1.10`; reuse existing: Existing calibrated uncertainty; new opt-in handoff.
- T12-11 — Verified Skill Network — Requirement `T12-11 / 28.1.11`; reuse existing: Part 14E Skills, ELITE-05, guarded replay.
- T12-12 — Time Reclaimed Dashboard — Requirement `T12-12 / 28.1.12`; reuse existing: STRAT-05 outcome dashboard, Proof Passport.

B. The additional/revised 12 owner features — R12, not a substitute for T12: Every entry below is MAPPED ONLY, NOT VERIFIED; requirements in Part 27.2, acceptance in Part 27.6.

- R12-01 — Live / Background Mode
- R12-02 — Smart Approvals
- R12-03 — Intelligent Privacy
- R12-04 — Seamless Tool Access
- R12-05 — Animated Permission Guide
- R12-06 — Live App Generator
- R12-07 — Automatic Context Discovery
- R12-08 — Passive Ghost Preview
- R12-09 — Time-Travel Timeline
- R12-10 — Private Habit Intelligence
- R12-11 — Simplification Mode
- R12-12 — Cross-Device Handoff

C. All four outcome packages and all eight named problem-solving products (Part 27.3):

- Business Money Assistant: Invoice Recovery; Cashflow Guardian.
- Universal Forms & Claims Assistant: Deadline Guardian; Refund Assistant; Job Application Assistant.
- Personal & Family Assistant: Micro-Business Ledger; Family Administration.
- Business Launch Assistant: Client Onboarding Autopilot.
- Mapping: `Part 27.3` contracts, `Part 27.6` acceptance cases. Their presence here is documentation only, not proof of eight built products, authorization to move funds or a new collection of eight execution engines.

D. Named technical concepts and shared execution architecture (Part 28.2; Parts 14D–14F):

- SkillForge, Verified Skill Network, Skill Marketplace, UI Repair Network: reuse one permissioned versioned skill/record/replay/quarantine system, not four competing executors.
- CheckPoint, independent approvals, Recovery Intelligence: reuse one scoped permission/effect journal, STOP, idempotency and independent output verification.
- LegacyBridge, Ghost Cursor, Smart Screen Understanding, Background Control: share one native-first computer-control, accessibility, vision and focus-arbitration spine. Virtual cursors cannot falsely claim independent physical mice.
- Instant Mini-Apps, dynamic @ picker, Anti-Scam Guardian: reuse one site/composer and source-linked permission model; generated interfaces and warnings never grant new authority.
- Mapping: `Part 28.2` concept contracts, `Part 28.4` common architecture, `Part 28.5` X01–X09 security/failure acceptance cases, `Part 14F` real agent/vision contract. State remains NOT CODE-VERIFIED until tested.

E. ALL other numbered requirement families, without double counting:

- 266 historical requirements `Part 8 / Appendix A`; 84 architecture concepts `Part 6 / Appendix B`; 72 original source-integration requirements Part 14A; record dispositions in PROGRESS.md (Ruflo collaboration additional scope: `Part 14D`).
- 34 UX principles `Part 14B.4 / Appendix G.1`; 38 consolidated elite proposals `Part 14C`; full website, settings, authentication, Chat/JARVIS, online/offline AI, BYOK, devices and native companion `Parts 10–14F / 25`.
- Five broad business research families, the incomplete 30-idea/100-feature briefs and named ideas `Part 28.3`. Names never provided in the excerpts are SOURCE NOT SUPPLIED / NOT VERIFIED, not invented or counted as implemented.
- Threat and safety obligations `docs/OCADE_SECURITY_THREAT_MODEL_AND_NEGATIVE_TEST_REGISTER.md`, plus any later independently reconciled threat report in this branch. Their remediation and independent tests are mandatory BEFORE debloat, all-GREEN CI and benchmark entry.
- Performance and release prerequisites `Parts 15, 17, 20, 23, 24, 26`, with full benchmarks and cloud real-computer evaluations ONLY in final execution stages.

Anti-duplication: Every feature/concept maps to the existing code owner after inspection. One authenticated task authority, permission/STOP controller, scoped BYOK/model gateway, plugin trust boundary, native OS driver, user-only memory, Library, action journal and independent verifier; add a new module only if a measured missing capability requires it. One implementation may satisfy several requirements but must retain separately traceable independent acceptance evidence. Never announce a feature, product or audit action as COMPLETE based on this map.

Additional named technical concepts: SkillForge, CheckPoint, LegacyBridge, Ghost Cursor, Instant Mini-Apps, Anti-Scam Guardian, Skill Marketplace, UI Repair Network, Smart Screen Understanding, dynamic @ picker, Background Control and independent approvals are ALL explicitly specified in Part 28.2, with security boundaries and acceptance tests. The five broad research families and the 30/100-idea research brief are in Part 28.3. The already-approved revised 12 and eight products remain detailed in Part 27; the 10 live-vision architectures and inspected GitHub references remain in Part 14F.

Remaining source limitation, NOT an unfinished named feature: Only summaries of the full 30-idea and 100-feature research reports were supplied. Their unprovided individual entries, per-idea five add-ons, complete 2026–2036 business model and full underlying research cannot be verified or reproduced from excerpts. The named requirements above are fully specified; additional unseen ideas are neither invented nor marked complete.

Implementation status: All entries in this Part are DOCUMENTED and NOT CODE-VERIFIED. Future agents must implement and test against the existing coding-complete, security, physical-device and deployment gates before claiming any feature works.

## Appendix A — Historical 266-ID requirement ledger (active JARVIS entries and archived out-of-scope entries)

**Complete view:** all 266 original requirement IDs are listed below. The 77 historical PASS entries have been restored from the retired v6 file; historical PASS is not current qualification evidence. Standing rules remain mandatory at every gate. Track current status in PROGRESS.md.

`PASS` here means RUNTIME VERIFIED. Coding status (NOT CODED, CODED, BUILDS) is tracked separately in PROGRESS.md Appendix E, so a coded requirement is never shown as verified before qualification.

Format: `STATUS` · **destination** — original text. Status source: independent re-audit at `f04228d`, plus W1 promotions of 36, 39, 41, 80, 171 and 216 with [run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177) and `evidence/2026-11-02-recovery/`, and W2/W3 promotions of 30 (mechanism fallback), 94 (live round-trip profile before and after each change) and 137 (shell, engine and diagnostic limits refused before running) with [run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402) ([retired source: evidence/2026-11-01-audit/requirements-266.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/evidence/2026-11-01-audit/requirements-266.md), current-review column); it is the conservative lower bound. **S** = standing rule verified at every release gate. **RPC** = needs real-PC validation. **COM** = commercial phase. **W14** = optional Linux; never counted as PASS without evidence and never blocking Windows/macOS release.

Original preamble (1 November 2026): this owner checklist complements the 84 concepts; it does not authorise merging into main, production deployment, payments, certificate acquisition, spending, irreversible changes, or exposing secrets. Preconfigured staging credentials may be used for authorised staging tests with least privilege and strict non-disclosure.

#### OCADE — Complete Commercial Launch Readiness | Continuation Prompt

#### Rules and execution requirements

1. `PASS` · **S** — Continue directly from the current OCADE development session. Do not restart the project, repeat completed research unnecessarily, or create another architecture proposal without implementing the required changes.
2. `PASS` · **S** — Work exclusively on `ocade/p00-p22-implementation` in `BREVEX-CEO/caera-connect-plan`. Never merge into `main`, deploy to production, enable payments, spend money, or access my physical computer without my explicit approval.
3. `PARTIAL` · **W13** — Your objective is to make **OCADE BY CARCC** a genuinely functional, independently verified, public-ready commercial software product across every officially supported component and platform.
4. `PASS` · **S** — **Do the actual coding.** Inspect, reproduce, fix, implement, integrate, simplify, test, and independently verify. Documentation alone is not progress.
5. `PASS` · **S** — Preserve the existing local-first architecture: Gemini intelligence, task supervisor, local Device Agent, trusted Gateway, MCP/STDIO capability workers, execution controller, independent verifier, and customer-facing website.
6. `PASS` · **S** — Do not rewrite functioning architecture merely to make it appear more advanced. Change architecture only where evidence proves a correctness, security, reliability, performance, scalability, or maintainability benefit.
7. `PARTIAL` · **S** — Read the current `plan.md`, `CLAUDE.md`, architecture ledger, prior evidence, tests, repository structure, and relevant implementation files before modifying an existing component.
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
131. `PARTIAL` · **W7** — Implement real macOS native accessibility support using appropriate platform APIs instead of claiming Windows control provides macOS coverage.
132. `PARTIAL` · **W7** — Support the macOS permission model, including Accessibility and other required user-granted permissions, with clear onboarding and revocation behavior.
133. `BLOCKED` · **RPC** — Validate supported Intel and Apple Silicon devices and actual native execution, packaging, and dependency availability.
134. `PARTIAL` · **W14** — Implement or verify Linux desktop control for explicitly supported X11 and Wayland configurations. Respect compositor and desktop security limitations.
135. `UNTESTED` · **W14** — Handle Linux desktop portals, user-session permissions, packaging differences, executable paths, shared libraries, and distribution compatibility.
136. `PASS` · **W3** — Provide platform-specific implementations behind shared capability contracts rather than contaminating the planner with OS-specific hardcoded journeys.
137. `PASS` · **W3** — If an operation genuinely cannot work on a supported platform, detect the limitation before execution and report it accurately.
138. `PARTIAL` · **W13** — Do not mark any operating system fully supported until native installation, pairing, execution, STOP, recovery, and independent task verification pass on representative hardware.
139. `PARTIAL` · **W8** — Dynamically discover the actual installed browsers and profiles. Do not assume Chrome, Edge, or a particular profile is available.
140. `PARTIAL` · **W8** — Bind automation to the authorized browser session, exact tab, origin, and target; never silently act in an unrelated session.
141. `PASS` · **W8** — Prefer DOM/CDP/Playwright structured operations where possible and use visual control only when required.
142. `PARTIAL` · **W8** — Detect navigation, popups, downloads, redirects, file pickers, permission prompts, authentication challenges, and dynamic content safely.
143. `PARTIAL` · **W8** — Respect anti-bot protections, authentication boundaries, website permissions, and security-sensitive user confirmations.
144. `PARTIAL` · **W8** — Ensure newly encountered applications can be operated through generic discoverable capabilities whenever their interfaces and permissions support it.
145. `PASS` · **W8** — Test unfamiliar and randomly named applications, files, websites and UI layouts to prove execution is genuinely capability-based.
146. `PARTIAL` · **W10** — Audit and complete Landing, Authentication, Chat, JARVIS, Library, Devices, Apps & Websites, Settings, Usage, and Owner/Staff administration.
147. `PARTIAL` · **W10** — Inventory and test every button, menu, link, route, input, modal, file upload, download, permission dialog, and state transition.
148. `PARTIAL` · **W10** — Make first-use onboarding simple: install, sign in, pair device, grant the specific permissions needed, and complete the first authorized task.
149. `PARTIAL` · **W10** — Show accurate device states such as Ready, local non-network, Permission Required, Busy, Disconnected, and Removed.
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
174. `PASS` · **S** — Preserve MFA and all established owner/staff safeguards. Never weaken security merely to make an automated test pass.
175. `PARTIAL` · **W11** — Keep customer content private and separate from other accounts, support systems, model traces, and unrelated customer sessions.
176. `PARTIAL` · **W11** — Make logs useful but redact passwords, authorization headers, tokens, API keys, sensitive file contents, and private data.
177. `PARTIAL` · **W11** — Add structured crash reports, health checks, latency metrics, failure classifications, and diagnostics with privacy-respecting controls.
178. `PASS` · **W11** — Implement a user-accessible diagnostic report that can explain connection, permission, runtime, dependency, Gateway, browser, and execution failures.
179. `UNTESTED` · **W11** — Ensure customer data export, account deletion, device revocation, and retention processes operate consistently with published privacy commitments and applicable requirements.
180. `EXCLUDED` · **ARCHIVE** — Historical document-writing requirement, not active JARVIS work; original in [retired source: docs/archive/plan-v7-2026-11-14.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/archive/plan-v7-2026-11-14.md). Keep functional installer help and data protection.
181. `FAIL` · **W11** — Add release notes, troubleshooting documentation, support procedures, incident response, service status communication, and recovery instructions.
182. `EXCLUDED` · **ARCHIVE** — Historical documentation requirement; original in v7 archive. Dependency integrity and secure provenance tests remain active.
183. `PASS` · **S** — Keep all payment, checkout, billing, merchant-of-record, and subscription integration work outside this assignment.
184. `PASS` · **S** — Exclude code-signing certificate acquisition and certificate-signing work from this assignment. Do not compensate by bypassing OS or antivirus security protections.
185. `PARTIAL` · **W9** — Build fully reproducible installers and release artifacts for supported platforms and architectures using declared, version-pinned dependencies.
186. `PARTIAL` · **W9** — Verify package integrity and every bundled worker's startup, not just successful compilation.
187. `PARTIAL` · **W9** — Support clean installation, upgrade, repair, restart, rollback, and uninstall without destroying customer documents or unrelated settings.
188. `FAIL` · **W9** — Implement a safe update mechanism with version compatibility, integrity checks, rollback, and recovery after interrupted updates.
189. `UNTESTED` · **W9** — Never let an update silently execute during a critical customer action or leave partially replaced executables running.
190. `PARTIAL` · **W9** — Test installation on clean VMs and physical machines without developer tools, cached browser binaries, or previously installed OCADE components.
191. `UNTESTED` · **W13** — Run long-duration stability tests to detect CPU spikes, memory leaks, orphaned workers, unreleased handles, output-pipe hangs, and excessive disk usage.
192. `UNTESTED` · **W13** — Test low-memory machines, slow storage, limited bandwidth, unstable Wi-Fi, limited permissions, and constrained user accounts.
193. `PARTIAL` · **W1** — Ensure network outages cause clear state transitions and safe task recovery rather than hidden success or uncontrolled retries.
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

Status source: `scripts/jarvis-traceability.mjs` / [retired source: evidence/2026-11-01-live/architecture-ledger.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/evidence/2026-11-01-live/architecture-ledger.md) at `f04228d`. That script reads the concept rows below, so keep the row shape `| n | **title** | …`. Concept 29 is PARTIAL from run 45 (D14 fixed); concepts 38 and 55 became PASS with W1 ([run 78](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41547638177)); concepts 25 and 37 with W3 ([run 85](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41806336402): failed routes are followed by a fresh look and the next route, with the reason, and the verifier rechecks the effect).

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
| 18 | **Macroscopic Planning for Unknown Task Horizons** | PASS | W4 | Gemini sets adaptable milestone intent; supervisor limits turn duration and persisted costs/permissions. | A long job can checkpoint without assuming a fixed step count. |
| 19 | **Bounded Receding-Horizon Planning** | PASS | W4 | Allow one or a small safe batch of Gemini-selected operations; reobserve before each irreversible step. | Cycle detection, task budget and STOP all terminate unsafe nonprogress. |
| 20 | **Real-Time Observe–Act–Verify–Adapt Loop** | PARTIAL | W4 | After each effect, return structured receipt plus permitted screen/media evidence to supervisor and Gemini. | A deliberately failed action causes feedback or stop, never fake success. |
| 21 | **Dynamic State Pivot and Self-Correction** | PASS | W1 | On user edits or worker error, refresh target identity and outcome delta before bounded repair. | No stale coordinates or old file versions are reused after takeover. |
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
| 50 | **Resource Locking and Semaphores** | PASS | W1 | Acquire canonical per-resource locks before writes; release on confirmed settle or lease expiration. | Two concurrent tasks cannot overwrite same file/window state. |
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

All 236 ideas have a disposition (decided, with destination). The full table is archived verbatim in [archive Appendix C](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/archive/plan-v6-2026-11-07.md); the sources remain `docs/research/OCADE_complete_heading_and_concept_index.md` and `docs/research/UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md`.

## Appendix F — Preserved complete engineering operating contract from v7

The following original engineering contract is retained for safe JARVIS implementation. If a quoted legacy phrase conflicts with the updated coding-first and benchmark loop in Parts 23–25, the latest explicit owner decision governs. Full untouched text is also in the archived v7.

### 4. The engineering formula **[U]**

**Objective → Evidence → Root cause → Smallest complete change → Proof → Simplify → Record → Next.**

| Stage | Needs | Produces | Prevents | Enough when |
|---|---|---|---|---|
| **Objective** | The requirement IDs and the customer outcome | One-sentence success condition plus measurable acceptance | Building the wrong thing | You can state how a tester would know it works |
| **Evidence** | The code owners, the latest run, a reproduction or measurement | A failing test, trace or number | Fixing symptoms and guessing | The problem reproduces, or the missing behaviour is demonstrated |
| **Root cause** | The evidence and the callers of the code involved | The single cause that explains all observations, with every affected caller | Patching one caller while siblings stay broken | The cause predicts the failure, and fixing it should fix every case |
| **Smallest complete change** | The existing owner of the concern | A diff in the owner, plus a regression test | New layers, duplicates and rewrites | No smaller change satisfies the acceptance and the safety rules |
| **Proof** | Focused checks, then broader ones, then an independent outcome check | Results bound to a commit SHA and an environment | False PASS | Acceptance holds on the stated platform |
| **Simplify** | The passing change | Removal of whatever the change made redundant | Leftover scaffolding and orphans | Nothing you added can be removed without failing a test |
| **Record** | The finished batch | PROGRESS.md Appendix E updated once per batch; a defect note in its Appendix D only if one stays open | Rework and lost context | Another agent could resume from the repository alone |

**Research stops** when another fact would not change the decision. Then record the assumption and implement.

**Implementation starts** as soon as the objective, evidence and owner are known. Planning beyond the current coding batch is waste.

**Architecture changes** only when measured evidence shows that the current design cannot meet an acceptance condition (§10).

### 5. Twenty engineering rules **[U]** (rule — why — when — how — verify — mistake to avoid)

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

### 6. OCADE operating rules **[O]**

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
4. Record coding progress once per batch in PROGRESS.md Appendix E. Write evidence files only for qualification results; never a report instead of code.
5. No competing status documents; PROGRESS.md is the sole live progress ledger.
6. Follow code dependencies only. Never wait for an unrelated package, CI job, benchmark or evaluation.
7. Record what remains incomplete in PROGRESS.md; do not end a turn to issue an interim report while independent authorized work remains.

### 7. The coding loop **[U+O]**

Work in **coding batches**: one coherent group of requirement IDs (usually one owner or one capability) finished completely, then one commit. Several commits per session are expected; one enormous commit is not.

1. **Select:** the next batch from PROGRESS.md Appendix E whose code prerequisites exist (§0).
2. **Inspect:** the owner files, their callers and their existing tests. Check PROGRESS.md Appendix D so you do not repeat an investigation.
3. **Implement completely:** every function, API connection, database contract, execution path and UI interaction the batch's requirements need, in the existing owner. Fix the shared cause, not one caller. A defect fix keeps or adds one focused regression test.
4. **Wire and prove presence (mandatory):** for every requirement in the batch, confirm it is reachable from a real entry point (route, operation, worker tool, migration, UI control) and actually called; name the entry point and the caller in PROGRESS.md Appendix E. No placeholders, empty stubs, `NotImplemented`, TODO markers, fake returns or documentation-only "completion". Search the diff for these before committing.
5. **Coding gate (§17 G-Change), locally:**
   - `npm run format:check` and `npm run typecheck`
   - Python compile and imports: `python3 -m compileall -q device-agent/windows/ocade_agent`
   - `npm run jarvis:protocol-check` if contracts changed; `npm run jarvis:no-hardcoded`
   - migration validity: `npm run test:jarvis-db` if SQL changed
   - the existing focused tests of each touched owner (§17.1). Existing tests must stay green; never weaken or delete one to pass.
6. **Repair:** fix what the gate finds in the same batch.
7. **Commit and push:** one commit per completed coherent requirement or small related group, on the authorized implementation branch only, with a message naming the requirement IDs. Record the batch evidence before committing and push immediately when the applicable LOCAL coding gate is green. Each separate push starts configured candidate CI automatically. Never wait for an earlier run or for matrix dispatch completion before starting the next independent coding batch. Track and repair available CI failures; require every mandatory final check GREEN on the identical final SHA.
8. **Record:** include the batch's IDs and actual local evidence in PROGRESS.md in the same commit; identify the entry point and caller, and distinguish local verification from pending remote CI. Associate exact candidate SHAs and run IDs when known; do not manufacture a self-referential commit SHA. Do not edit §3, §15, Appendices A–D or evidence files for coding progress.
9. **Next:** immediately make the next actionable tool call to select, inspect or implement the next dependency-ready requirement after each push or matrix dispatch. Never finish the response with a status note, reminder or promise to continue. If one requirement is blocked, record it and move to another; if CI fails, repair the confirmed failure and keep going. Only enter the final CI gate after all independent authorized work is exhausted. Respect explicit owner STOP and approval boundaries.

**Not part of the coding loop** (all deferred to the qualification stage, W13): full CI matrix, live AI tasks and E1–E3 campaigns, model comparisons, performance measurement (§18), cloud-computer workflows, real-PC tests and readiness re-scoring. Their criteria are unchanged; they only stop blocking code.

**Batch C0 (first):**
- Classify every requirement in PROGRESS.md Appendix E: CODE (needs code), QUALIFICATION-ONLY (needs only a measurement, campaign, real-PC run or owner action, plus any harness code it requires) or STANDING (a rule checked at every gate). Classification never removes a requirement or changes its text.
- Make the push-triggered CI run only the coding gate; move the full matrix, packaging, bundle and live-evaluation jobs to manual dispatch for the qualification stage.
- Replace the hard-coded `testsRun == N` pins in `.github/workflows/jarvis-cloud-validation.yml` with one shared check that fails on any unexpected skip or missing test, so adding a test never turns CI red.
- Merge candidate commit `26ec426b` (glTF, macOS AX, verifier and Windows focus work) once its coding gate is green, or drop it and remove every claim that cites it.

**Work states:** NOT CODED → CODED (fully implemented and wired, §7 step 4) → BUILDS (passes the coding gate) → RUNTIME VERIFIED (qualification evidence on the stated platform; Appendix A `PASS`). DONE means RUNTIME VERIFIED for every requirement of a package.

### 8. Failure, recovery and resumption **[U+O]**

- **A test stays red:**
  1. Fix it inside the batch; that is the default.
  2. Never rerun an identical failing CI job hoping for green.
  3. After two failed approaches, choose a new root-cause hypothesis.
  4. If a third attempt fails, record the facts once in PROGRESS.md Appendix D, mark only that item blocked in PROGRESS.md Appendix E, and continue with the next independent batch. Never push a red coding gate.
- **Regression found:** it blocks the current batch until it is fixed or proven pre-existing. A pre-existing regression gets a PROGRESS.md Appendix D entry.
- **Flaky test:** treat it as a defect. Find the race or ordering cause. Never add sleeps or retries to hide it.
- **Interrupted session:** the repository is the memory. On resume:
  1. Do §0.
  2. Run `git log -5` and check the last CI run for the head.
  3. Read PROGRESS.md Appendix E for the batch in flight.
  4. If uncommitted work exists, finish it or discard it deliberately (never silently).
- **The model or provider is busy:** wait or pace. Never rotate keys. Live evaluations resume from saved tasks.

### 9. No-overengineering rules **[U+O]**

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

### 10. When an architecture decision may change

A frozen decision (Level 3) may change only when **all** of these hold:
1. A measurement or reproduced defect shows that the current design cannot meet a stated acceptance condition.
2. Targeted fixes inside the existing owner were tried or are shown to be impossible.
3. The replacement is smaller or equal in moving parts, or its extra cost is justified by the measured gain.
4. The decision, the evidence and the reversal trigger are written into §27 before coding starts.

**Simplification audit (owner-ordered, W12):** a change that removes moving parts (duplicate logic, an unused abstraction, a redundant check) may be made without a new measurement, provided callers are traced, every existing test stays green, and security, recovery, permissions, STOP, Take Over and independent verification are preserved. It never adds an engine, controller, planner, gateway, execution loop or verification system.

Pre-registered reversal triggers are listed in §27. Everything else stays as decided.

### 11. Owner approval and autonomy

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

1. The full v7 plan, including every historical source statement, is preserved unchanged at [retired source: docs/archive/plan-v7-2026-11-14.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/archive/plan-v7-2026-11-14.md).
2. The 236 research dispositions are archived in [retired source: docs/archive/plan-v6-2026-11-07.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/archive/plan-v6-2026-11-07.md); their supporting heading-and-concept index remains in `docs/research/OCADE_complete_heading_and_concept_index.md`.
3. Review [retired source: docs/OCADE_INTEGRATION_RESEARCH.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/OCADE_INTEGRATION_RESEARCH.md), `docs/research/OCADE_246_FULL_SOURCE_ARCHITECTURE_BLUEPRINT.md`, `docs/research/OCADE_REPOSITORY_LEDGER_246.md`, and [retired source: docs/research/OCADE_SOURCE_REVIEW_2026-11-14.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/research/OCADE_SOURCE_REVIEW_2026-11-14.md) before proposing additions from researched repositories. The 243 source submodules were deleted intentionally; they are not dependencies of this plan.
4. Keep authorizing evidence separate from implementation and implementation separate from independent runtime proof. No claim of complete line-by-line source inspection is made by this revision.

## Appendix G.1 — Final universal 30-law UX, visual polish and independent design-research gate BEFORE benchmark specification (15 November 2026)

Owner's final mandatory UI/UX gate: Apply ALL 30 original named UX laws/principles in Part 14B.4 across the entire OCADE website and supported companion surfaces with the highest PRACTICALLY BENEFICIAL optimization. “At extremes” means exceptional clarity, reliability, accessibility, polish and consistency, not blindly forcing an inapplicable effect on every element or adding animations that slow work. For each law, document scope, relevant screens, specific acceptance tests, nonapplicability rationale if any, before/after user measures and relevant current source/components. These are the EXACT first 30 names preserved in Part 14B.4; do not rename, replace or multiply them. Keep the existing UX-31 Visual Hierarchy, UX-32 Progressive Disclosure, UX-33 Recognition over Recall, and UX-34 Feedback Loops as four additional principles (34 total) rather than discarding them.

### Final names and whole-product application of the 30 UX laws

The canonical UX-01–UX-34 list in Part 14B.4 contains all 30 original law names, the four additional principles and the detailed whole-product examples formerly repeated here. Apply all 34; the shared verification rule there and the mandatory design gate below both apply.

### Premium design execution: beyond the names

1. Whole-site quality: Apply this to landing, sign-in/sign-up, auth callback, Chat, JARVIS/Orb, prompt enhancer, @ resources, Library/search/download, Plugins/Skills/MCP directory and OAuth callbacks, Apps & Websites, paired devices, all six existing Settings categories, BYOK, permissions/consent, Help/FAQ, privacy/terms, supported mobile/bubble surfaces and privileged owner/staff consoles where applicable. Maintain cohesive typography, restrained spacious layouts, accessible contrast, calibrated elevations, predictable color hierarchy, text wrapping and polished responsive breakpoints. Do not invent a competing design system or take design decisions away from product accessibility.
2. Truly useful skeleton loaders: Use matching layout-shaped skeletons for fetchable content such as file lists, plugin details, account/service cards, verified task result panels and permissioned lists; prevent cumulative layout shift and erroneous stale-content flashing. Show immediate accurate statuses rather than fake progress for waiting on model inference, permissions, provider quotas, unavailable app, external OAuth, large-file transfer and unknown desktop effect. Avoid endless shimmer and excessive placeholder detail. All loading states support cancellation where permitted and explain stalled/timeout/retry or offline states.
3. Professional motion: Smooth small microinteractions for composer Sparkles text refinement, mention chip selection, dropdowns, selected-resource focus, tab transitions, notifications and task state changes. Prefer composited transform/opacity, predictable focus and brief measured duration; throttle expensive work, prevent scroll jumps, retain cursor/selection and support reduced motion. No continuous parallax/scroll hijacking, excessive shine, clutter or animation that can hide STOP, denial, danger or verification evidence. Do not deliberately delay task completion to showcase transitions.
4. AI product UX research: At IMPLEMENTATION time inspect current public and legally usable product/UI guidance for AI assistant composer behavior, context/memory controls, consent/revocation, file processing, model/quota feedback, agent activity, progress, undo, truthful citations, connector onboarding and clear first-task flow. Suggested authoritative references: W3C WCAG 2.2 https://www.w3.org/TR/WCAG22/ ; Microsoft Fluent Responsible AI https://fluent2.microsoft.design/responsible-AI ; OWASP AI Agent Security https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html . Compare multiple competing AI interfaces for *patterns*, without copying proprietary visuals or claiming that an example animation proves a capability. Record date, evidence link, hypothesis and independent customer validation. Use OCADE's design, not a screenshot clone.
5. Accessibility and edge states: Independently audit keyboard-only, visible focus, full screen readers, 200% zoom/reflow, mobile virtual keyboard and safe areas, low vision/color contrast, target size, high-contrast themes, localization/RTL where relevant, prefers-reduced-motion, status live regions, error recovery and media alternatives against WCAG 2.2 AA where applicable. Test loading, empty, offline, denied, wrong account, disconnected device, revoked key, expired OAuth, malformed MCP, wrong/stale tab, memory Off, untrusted content, huge file and STOP mid-task.
6. Permission and privacy comprehension: Have new testers distinguish OCADE sign-in from provider OAuth consent; distinguish user BYOK external charges from OCADE model-funded calls; identify personal memory scope versus project/organization shared resources; identify what @ selection authorizes; and find STOP, Take Over, Undo and Delete controls without coaching. Never label provider/model quota remaining when it is unknown or pretend security through hidden buttons.
7. Measurement and release acceptance: No UX “10/10”, “flawless”, 100% success or full completion based only on written rules, demo screenshots or self-assessment. Run repeatable page-by-page inspection, keyboard/a11y automation PLUS actual usability participants and measured task success, first-value time, misclick/misgrant/error recovery, keyboard completion, layout-shift, responsiveness, animation jank, skeleton duration, memory trust and comprehended cost. Maintain per-screen defect list, exact SHA and severity; blocking auth/privacy/accessibility bugs must pass before the real-task benchmark gate. Component-level nonapplicable principles need a brief reason, not a fake pass.

Benchmark boundary: This final UX/design gate is a CODING/PRE-SECURITY acceptance prerequisite; Appendix H's preserved historical benchmark specification is physically placed after mandatory full-product security, debloat and green-CI gates. It is required during implementation and coding/CI preparation, and it does NOT replace or run the Part 23 full GREEN coding-complete gate or the Part 24 independent real-task testing loop. Do NOT hardcode illustrative user projects into the task corpus, lower benchmark targets, claim that screenshots constitute working interactions or claim a tested UX before actual testing.


## EXECUTION STAGE 2 — REQUIRED SECURITY THREAT REMEDIATION, BEFORE DEBLOAT OR BENCHMARKS

### Stage 2.1. Security threat register and mandatory remediation contract (preserved requirement 23.4A)

Read **`docs/OCADE_SECURITY_THREAT_MODEL_AND_NEGATIVE_TEST_REGISTER.md` in full, plus any subsequent threat-audit Markdown on this branch; identify every applicable issue across website/account/session, database tenant isolation, upload malware, malicious MCP/plugins/extensions, prompt injection, server entitlements/DevTools, weak BYOK models, image support and quota fallback, Windows/macOS isolation, subagent races, cloud/supply chain and privacy. Implement and independently verify the appropriate safe fix; run the proposed negative checks using isolated synthetic fixtures as SECURITY REGRESSION TESTS, not as real-task benchmarks. For false/inapplicable hypotheses, provide exact source and independent evidence rather than a fabricated fix. ZERO unresolved applicable security findings, ZERO untriaged findings and ZERO mandatory failed tests** before Stage 3–6.

23.4A. Mandatory security-threat remediation and zero-error GREEN gate — BEFORE benchmarks or cloud-computer testing. Read **`docs/OCADE_SECURITY_THREAT_MODEL_AND_NEGATIVE_TEST_REGISTER.md` IN FULL, including the 192 root-risk hypotheses, 1,152 negative scenarios, 16 code-observed findings/gaps, mitigation and acceptance criteria; also inspect any newer, separately committed OCADE threat reports if they exist on this branch. Cross-check each finding against the current codebase, plan, all site sections/settings, online/offline Chat, JARVIS, Windows/macOS companion, Supabase/Cloudflare, file uploads/malware, MCP/skills, BYOK/model capability and quota switching, A/B tenant isolation and privacy, multi-agent concurrency, prompt injection, DevTools/entitlement abuse, admin, deployment and supply chain. Before starting ANY JARVIS/model/website/offline benchmark, E1–E4, actual cloud-computer real-task test or remote-PC end-to-end test: (a) assign an exact code/test owner and evidence status to every audit entry; (b) implement and independently verify the complete protection for every applicable vulnerability, implementation gap and unsafe failure path, with no duplicate engines or weakened security; (c) run the applicable negative tests with safe synthetic fixtures in the isolated coding/security-test environment (these are pre-benchmark security regression tests, NOT cloud-PC real-task benchmarks); (d) for hypotheses that are already prevented or genuinely inapplicable, record source-specific proof and a reproducible independent negative test—never relabel an unverified issue as fixed, use silence as evidence, or defer a mandatory safety item. Absolute pre-benchmark gate: 100% applicable findings addressed and security requirements complied with, zero outstanding applicable security defects or mandatory remediations, zero failing/errored mandatory tests, zero untriaged findings, zero unapproved skipped/disabled tests, and every required website/backend/desktop security and build CI check COMPLETED GREEN on the exact final candidate SHA. A genuinely unsupported platform/test must be documented with proof and cannot be counted as passing; unresolved mandatory coverage blocks entry. Any subsequent change, even a documentation or security fix, requires recomputing the final-SHA gate. If ANY condition fails or remains unknown, DO NOT RUN BENCHMARKS OR CLOUD-COMPUTER TESTING**; continue safe coding, isolated negative testing, independent review and CI repairs; record precise blockers in PROGRESS.md and continue independent work. A risk register is not proof of 192 exploited vulnerabilities, and 'zero errors' is an observed acceptance state of the defined required gates, not a claim that undiscovered vulnerabilities cannot exist.


## EXECUTION STAGE 3 — DEBLOAT SAFELY AFTER THREAT REMEDIATION

After all applicable threats are independently resolved or proved inapplicable, consolidate existing components without breaking their callers, safety invariants, tests, user data, measured resource use, permission rules, STOP, recovery, historical evidence or current-SHA CI. A leaner build cannot substitute for verified security.

## Part 14. Package P4: completion, proof-based debloating and removals

14.1. Every coding item builds, and the database suite (`npm run test:jarvis-db`) passes on PostgreSQL.

14.2. Each removal names its traced callers, keeps every test green and records size, startup and memory before and after:
- the retired Live planner path;
- the lexical shortlist, once families replace it;
- the size-only schema deferral;
- the custom web control script, if item 11.4 wins its comparison;
- stale documents and dead code identified by verified dependency checks; record removals in PROGRESS.md.

14.3. Research-only assets.
- The 243 `all-repos` submodules were removed in commit `3a8e567b` (VERIFIED).
- `tools/source-research/`, `tests/source-research/` and `evidence/source-research/` remain. They are not product code, they still describe the removed submodules, and `CLAUDE.md` still mentions them.
- Recommendation: move them to an archive branch and keep their findings in `docs/research/`. This is an owner decision.

14.4. Never removed: security checks, permissions, STOP and Take Over, recovery and journaling, independent verification, database compatibility, user data, or a useful test.

### Stage 3.1. Full preserved 14B.9 debloating and implementation-proof contract

1. Audit: Identify exact existing owner modules and functions first. For each proposed addition, record which one is improved and which old duplicate is removed or retained. Verify callers and rollback before removing code. Never delete security checks, STOP, authorization journals, historical evidence or customer data. Preserve the existing 84 concepts and 266 IDs with mapped statuses.
2. Source adoption: Analyze all five linked repositories deeply; use useful tools/patterns where licenses, security, maintenance, performance and Windows/macOS support permit. Do not blindly import five complete projects, inflate bundle size or introduce parallel authorities. Record source link, commit, license, filename and accepted code changes for every adoption.
3. Required proof: CODED means code and callers exist; GREEN means full integration, typecheck, lint, format, build, database migration checks, server auth/security, frontend UI/customer workflows, native companion packaging and regression suites all pass. QUALIFIED means later real-device/real-task evidence. Tests may use mocks during coding but must not be presented as real task benchmarks.
4. Hard benchmark gate: Every mandatory JARVIS, online/offline Chat, account/settings, security, UI/UX, legal/help and source-integration item must be CODED, checked and no longer PARTIAL without explicit justified exclusion. The ENTIRE OCADE SITE and Windows/macOS companion must compile/build with all required GitHub jobs COMPLETED GREEN on the SAME FINAL SHA. A red/pending/skipped critical job blocks ALL real-task/cloud benchmarks. While CI jobs run, keep working on independent code and track each commit; fix all failures, rerun to green. After ANY benchmark repair, freeze a new SHA and rerun all required coding gates before further benchmarks.
5. Qualification sequence: After the full gate is green: (i) 16-run Gemini/Gemma baseline; (ii) JARVIS E1–E4 and Windows/macOS/cloud/real-device tasks; (iii) online Chat model/connection/cross-account stress and customer workflow qualification; (iv) full-site responsive/support/security/customer journeys; (v) LAST: offline model download and true disconnected offline website/chat evaluation. Record first-attempt pass, retry separate, wall-clock task time, p95, provider calls and all failures. Never count empty/hardcoded mock results as passed tasks.
6. Status: Track per-item actual implemented / tested / qualified / deferred evidence and report truthful product-wide public readiness X/100 only from explicit independently verified release gates. Do not claim 100% based on compiling or writing a plan. Deployment, new spend, external credential changes and main merge remain separately approval-gated.


## EXECUTION STAGE 4 — ENTIRE SITE + COMPANION ALL-GREEN ZERO-ERROR CODING GATE

All mandatory coding, threat regressions, debloat verification and full website/backend/desktop unit, integration, migration, security, protocol, build, lint, format, typecheck and packaging checks must PASS, with ZERO known unresolved applicable safety defects, ZERO mandatory test errors/failures and no unapproved skipped checks. EVERY mandatory CI job must be COMPLETED GREEN on the SAME final candidate SHA; pending and previous-SHA green jobs do not count. Failure blocks ALL benchmarks and cloud-computer tests.

## Part 23. Mandatory coding-complete GREEN gate BEFORE cloud-computer benchmarks (owner addition)

23.1. Finish 100% of mandatory implementation for the ENTIRE OCADE PRODUCT, in strict order: JARVIS, Windows/macOS companion and native-first PC control first; online Chat and universal API/model adapters second; offline Chat, downloaded local model and cached website third; then full site settings, UX, account/customer journeys, help/policy pages, security, backends, required 72-entry source integration, bounded multi-agent coordination, secret/key health routing, owner-supplied Supabase credential registry and secure customer BYOK Settings/model gateway with strict per-source noninterference (Parts 14B.1A–14B.1B), the 38-proposal consolidated trace and applicable additional elite strategies (Part 14C), deep debloating and full validation. Include task authority, STOP/Take Over, permission fences, exact approvals, recovery and independent verification throughout. All applicable prior PARTIAL items must be finished or explicitly justified as nonrequired, preserving historical IDs and archived evidence.

23.2. `CODED` means the implementation and callers exist; `BUILDS` means affected build, typecheck, lint, formatting, protocol, relevant unit/security tests and database checks are green; `QUALIFIED` means runtime proof, separately. Neither the presence of source code nor green CI alone implies release qualification.

23.3. Complete source changes in small reversible batches. After each batch run the affected tests, including STOP, approval correctness and wrong-target regressions. Do not defer critical safety tests. Every commit creates a required CI-follow-up obligation: correlate checks and logs with the exact commit, monitor them through completion, fix any failed mandatory check without weakening tests, and rerun checks on a new commit until green. While GitHub Actions jobs execute, make progress on other independent, nonconflicting code work; do not wait idle, lose track of red checks, or claim a pending job passed. Integrate and reconcile these streams before moving to benchmarks. Preserve useful tests.

23.4. When all coding items are classified, run the COMPLETE required GitHub compilation/coding validation on one candidate SHA: dependency installation, formatting, linting, TypeScript compilation/typechecking, build, protocol/contract checks, no-hardcoded scan, database/migration tests where supported, the ENTIRE OCADE WEBSITE including JARVIS, ONLINE CHAT and OFFLINE CHAT, settings, all customer flows, UX, security and user policies, Windows and macOS companion tests, packaging, and all mandatory source-dependent checks. Every required job must pass, with genuinely unsupported platform skips listed rather than disguised as green. Address stale research links and legacy model callers only when their removal does not damage working features.


23.5. Hard gate: Start NO cloud-computer real-task testing, E1–E4 or any model/online/offline/whole-site performance benchmark until the mandatory security/threat gate in 23.4A is independently verified with zero unresolved applicable issues and zero required coding/security test errors or failures, AND ALL mandatory OCADE-wide coding is finished, including the applicable Part 14A 72-item integration/partial-items ledger and Part 14B whole-site acceptance tasks, the whole OCADE website and companion compile/build, every required coding/security/website/companion CI job is COMPLETED GREEN on the SAME final commit SHA (not pending, skipped without justification, or green only on earlier commits), required test secrets/environment are explicitly authorized, and the release evaluation harness is ready. Any subsequent commit invalidates the candidate's previous green proof; reverify the new SHA. A benchmark failure reopens coding, and the entire relevant coding/build gate MUST be green again before reruns.

23.6. Record `Coding completeness: independently completed and tested mandatory full-product items / all applicable full-product mandatory items × 100%` separately from technical release readiness. Include JARVIS, online/offline Chat, full-site UX, security, secret/model integrations and source entries. Historical 266-ID and 84-concept tracking remains intact; reconcile overlap so one physical change is not counted several times. Never manufacture 100% through scope exclusions.


## EXECUTION STAGE 5 — PRE-CLOUD MODEL / PLANNER BENCHMARKS ONLY

Run bounded authorized model capability, structured tool-call, weak-model, quota, correct abstention, failure-recovery and deterministic hidden-oracle tests against isolated non-cloud-PC fixtures. These are the pre-cloud model/planner benchmark gate, NOT hosted desktop real-task testing. To proceed, every mandatory case must satisfy its defined pre-cloud acceptance criterion and zero unsafe effects; otherwise return to coding, threat regressions, debloat and fresh-SHA CI, fix the general root cause and rerun. The historical 16-run Gemini/Gemma desktop comparison explicitly uses hosted Windows/macOS runners; its exact specification (Appendix H) is preserved here for reference but must be EXECUTED ONLY in Stage 6, after the pre-cloud gate passes. No cloud-PC tests or real application effects in Stage 5.

## Part 16. Competitor benchmark method — specification only in Stage 5; execution in Stage 6 (requirement 259)

16.1. The test.
- Twenty identical, reproducible tasks with hidden answers, across files and office work, browser work, desktop applications and a long job.
- The same seeded inputs and the same hosted Windows and macOS images.
- One injected fault per task, to measure recovery.

16.2. The competitors. OCADE is run, and so is every competitor product the owner can lawfully access within its terms: ChatGPT agent and OpenAI Dots, Claude's desktop computer use, Codex, Gemini, Manus, Microsoft Copilot, Cursor and Devin. Paid plans are used only with approval.

16.3. What is already verified about competitors.
- Claude offers desktop control on macOS and Windows.
- OpenAI Dots, Grok Bot and Meta Muse run on cloud computers, and Muse also has a Mac app. These come from mostly secondary sources.
- Gemini 4 Argon is in restricted, paid rollout, and Google's announcement names no computer-use benchmark.
- OCADE's strongest verified differences: the independent verifier, exact permissions, local execution and editable outputs.
- No claim of superiority is made until this benchmark runs with a published denominator.

## Appendix H — Historical benchmark tasks and evaluation specification (preserved; cloud execution ONLY in Stage 6)

**Stage boundary:** Read these task definitions and historical outcomes in Stage 5; NEVER run hosted Windows/macOS, cloud-PC tasks, E1–E4 or other real-task campaigns until Stage 6's required entry gates pass. This appendix remains a historical task specification, not a Stage 5 execution order.

This is the one preserved source of the prior evaluation categories, exact seeded benchmark tasks, applications, historical rounds, results, failure logs and permissions. It is copied without rewriting historical results. Its OLD per-run authorization descriptions and previous configuration alternatives are historical: the latest owner instructions in Parts 3, 17, 23 and 24 govern subsequent runs. Part 17 invokes this specification rather than defining duplicate benchmark tasks. The 16-model comparison and the E1–E4 campaigns remain distinct; historical attempts do not count as new first-attempt passes.

### 19. Evaluation and qualification campaign

#### 19.1 Checkpoints

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

#### 19.2 Categories

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

#### 19.3 Advanced creative acceptance — 3D supercar and ~60 s advertisement

**Instruction** (given verbatim to OCADE): "Create an original, premium futuristic supercar in Blender or another suitable available 3D application. Model a detailed exterior and realistic materials, prepare professional lighting and camera compositions, and create a cinematic advertisement approximately 60 seconds long. Include carefully designed camera movements, dramatic presentation, suitable transitions, high-quality rendering and appropriate audio. Deliver the editable 3D project, editable advertisement project, final rendered video, and a report proving that the required outputs were produced correctly."

**Environment:** the harness may pre-install Blender (GPL) on the disposable runner, as a customer might have it. OCADE must discover and drive it generically, through its documented command-line/Python interface run as `job`s, or choose another available route. Production code never names Blender.

**Three separate verdicts:**
1. **Technical validity:** files parse; duration 60 s ± 2 s; fps, codec and audio stream present; no blank frames.
2. **Editable structure:** the 3D project re-opens with named objects and materials, plus a glTF export; the advertisement timeline (.otio or the application's own project) re-opens and references existing media.
3. **Subjective cinematic quality:** human review at RPC only. Geometry is measured by counts and coverage and is never automatically labelled "professional".

**Recovery test:** an interrupted render must resume without re-rendering finished frames.

**Free-runner limits:** CPU only, 6-hour jobs. Cycles CPU works headless; Eevee needs EGL/Mesa (unverified). If the render cannot finish, record FAIL or BLOCKED with the measured frame time and validate at RPC.

#### 19.4 Owner-directed model comparison — 4 tasks × 2 standalone models × Windows/macOS (O15, O16)

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

**Open after round 4: the architecture review** ([retired source: docs/research/OCADE_ARCHITECTURE_REVIEW_2026-11-08.md](https://github.com/BREVEX-CEO/caera-connect-plan/blob/5b88b0c5c830ad719dd4cabd8635db53a7a18586/docs/research/OCADE_ARCHITECTURE_REVIEW_2026-11-08.md), research only, 8 Nov 2026) traces every failure. Its sequence enters this plan through §10 when coding resumes:
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


## EXECUTION STAGE 6 — APPROVED CLOUD BASELINE FIRST; IF PASS, ENTIRE CLOUD-PC/WHOLE-SITE TESTING

Only after Stages 1–5 are green on the pinned candidate SHA, start the owner-approved, hosted Windows/macOS 16-run two-model baseline using real apps, real saved artifacts and independent hidden oracles. This baseline is itself the FIRST cloud-computer test and could not honestly have happened before cloud access. If baseline acceptance fails, STOP broader cloud-site testing; perform the Part 24 general non-hardcoded repair loop and restore all earlier phase gates before rerunning. Only after the baseline passes its predefined mandatory criteria run E1–E4, cloud Windows/macOS practical cross-app workflows, all website pages and settings, accounts/auth, library/uploads, MCP security, privacy/tenant isolation, BYOK/model routing, online/offline Chat, desktop companion, STOP/Take Over, parallel agents, accessibility, support/policy and independent output verification. Follow authorized platform scope; approved real-device testing requires separate approval. True offline download/airplane-mode/browser reopen/inference tests are LAST. Any failure returns to coding → security → debloat → all-GREEN CI → model benchmark → hosted validation until actually passed or precisely blocked. Never hardcode task outcomes, selectors, application specifics, fixture answers, bypass approvals or fake pass results.

## Part 17. Package P5: qualification and release evidence

17.1. After ALL mandatory coding and GitHub build checks are green, run the exact 16-run two-model comparison specified once in the preserved historical benchmark specification (Appendix H), with current authorizations and staging boundaries. A failed task triggers the autonomous safe repair loop in Part 24; routine reruns inside the approved test scope do not need discretionary reapproval. Record both original failure and successful repair separately.

17.2. Run E1 to E3. Run E4 with at least 100 hidden tasks over at least three days. It must reach at least 90 percent first-attempt success, and the target is never lowered.

17.3. Run real-computer qualification on Windows 10, Windows 11 and macOS after approval A2 and completed hosted qualifications.

17.4. For EVERY failure, retain the failure evidence; investigate root cause; implement a general, non-hardcoded correction; rerun complete-site coding/build/security gates until all green on the new SHA; then rerun the failed task and affected category on the same defined oracle. Never reclassify a retry as first-attempt success. Record commit, environment, actual task duration, model latency, tool usage, corrections and independent verification. Repeat within approved safe test permissions and resource limits until acceptance or a precise blocker.

17.5. Required benchmark order, after whole-site GREEN CI: (1) initial two-model 16-run comparison; (2) JARVIS E1–E4 real-task, cloud Windows/macOS and approved actual-PC qualification; (3) authorized additional-model compatibility tests; (4) online Chat, customer account/device/settings, security and full-site responsive workflows; (5) LAST: local offline-model download, actual internet-off/browser-reopen website test and offline-chat inference on supported Windows/macOS/Android devices. A failure returns to coding, requires a fresh all-green full-site SHA and then reruns affected tests. No prior CI-only mock is a real-world pass.

## Part 24. Autonomous benchmark → general repair → coding-gate → retest loop (owner addition)

24.1. Once Part 23 is fully green for the ENTIRE SITE on the same final SHA, execute the canonical benchmark configuration in Appendix H. Start with the initial two standalone baseline models on identical seeded objectives, resources and oracles: four tasks × Windows/macOS × Gemini/Gemma (16 runs); qualify additional explicitly authorized provider adapters separately. Then execute E1–E4 and required real-device qualification, online Chat/customer workflow tests, site security/UX tests, and LAST the offline model download, airplane-mode website open/reopen and disconnected local-inference suite in dependency order. Never mix the two planners within one task or hardcode application names, steps, selectors or test answers into production routing.

24.2. On ANY task failure, do not stop for routine discretionary approval inside an already-authorized, free, safe cloud-computer test scope. Capture the complete trace: failed action and permission scope, model request and response metadata (without secrets), screenshots/structural observations, logs, exact error, task state, whether effects are known or unknown, generated artifacts and independently checked oracle verdict.

24.3. Diagnose and make the smallest general fix to the existing JARVIS code, test harness or environment. Reject task-specific patches, planted benchmark answers, retries of unknown effects, weakened protections, truncated approvals, synthetic oracle passes and threshold changes. Preserve original failing results and distinguish reproducible product defects from quota, missing dependency, environment and flaky-test causes.

24.4. For each fix: run focused regression tests; rebuild the entire site and companion; rerun the entire required coding/build CI until GREEN on the same new commit; then rerun the failed task under the same conditions and rerun the affected category and appropriate hidden-answer tests. While CI runs, continue other independent safe coding improvements; fix and track all red commit checks and never benchmark a still-running or red candidate. Continue this evidence-backed code → green-CI → benchmark → general repair → green-CI → retest cycle within approved time, quota, spending and authorization bounds until every applicable mandatory launch gate passes and independently measured JARVIS engineering readiness reaches 100/100%, or a precise evidenced blocker prevents safe continuation. Do not fabricate 100% or treat repeated retests as new first-attempt successes.

24.5. Record for EVERY task and attempt: ID, objective, original seed, platform, model, tool route, source SHA, fixture hash, start/end timestamps, wall-clock time, time-to-first-safe-action, model latency and tokens, device execution time, API calls, CPU/RAM, monetary or free-tier quota use, user interventions, approval decisions, recoveries, postcondition results, artifacts, verifier/oracle outcome and any unresolved error. Report median, p95 and maximum durations and the first-attempt pass rate over a published denominator. Use monotonic clocks for durations and explicit wall-clock timestamps for audit logs.

24.6. Never bypass protected-environment approval, exceed quotas or budgets, expose keys, use a consumer PC without approval, deploy to production, alter a secret, or spend money under the guise of automatic repair. An authorized initial testing approval may cover repeated NON-DESTRUCTIVE fixes and cloud reruns inside the same already-approved scope. If additional protected approval is required by GitHub or the owner, record the exact blocker rather than silently bypassing it. Use bounded retries/backoff to avoid unending, expensive or destructive loops.

24.7. Require zero known critical/high safety defects, fully passing mandatory safety scenarios, independently verified outputs, the existing ≥90% E4 first-attempt target with ≥95% ambition, and all release gates. A failing real-world task remains a FAIL until it actually passes; do not report public readiness while critical coverage is missing.


## EXECUTION STAGE 7 — HISTORICAL PROGRESS, INDEPENDENT COMPLETION CONDITIONS AND FINAL CLAUDE/CODEX REPORT

This is the reporting/evidence phase after all applicable tests, not permission to announce historical claims as current-SHA success. The preserved original Part 2, Part 22 and Appendices D/E in PROGRESS.md are dated evidence/ledger records. No old test result, 'COMPLETE' documentation label, approval text or source-only implementation counts as current runtime qualification.

## Part 2. Current state, stated honestly (14 November 2026, branch head `3a8e567b`)

Moved verbatim to [PROGRESS.md](PROGRESS.md); all live updates belong there.

## Part 22. Reading coverage of this revision (honest record)

Moved verbatim to [PROGRESS.md](PROGRESS.md); all live updates belong there.

## Appendix D — Defect register (single live list)

Moved verbatim to [PROGRESS.md](PROGRESS.md); all live updates belong there.

## Appendix E — Coding ledger (updated once per coding batch)

Moved verbatim to [PROGRESS.md](PROGRESS.md); all live updates belong there.

## Part 20. JARVIS engineering GO / NO-GO

20.1. Public deployment is NO-GO until runtime evidence is independently verified; current status is recorded in PROGRESS.md.

20.2. Complete OCADE product release acceptance (100/100% independently verified technical readiness) requires all mandatory Part 14A and 14B integration, JARVIS, Online Chat, Offline Chat, settings, UX, security, Help and policy implementation, all customer workflows, entire OCADE website and companion compiled, all required GitHub CI green on the identical candidate commit, all critical/security defects resolved, STOP/Take Over and permission gates proven, safe companion installation/upgrade/uninstall, independent deliverable checks, full hosted/real Windows/macOS qualification, benchmark acceptance (including E4 ≥90% first-attempt success) and complete JARVIS customer journeys.

20.3. Engineering readiness is not authorization to deploy. A public release still requires explicit owner authorization, regardless of its technical score.

20.4. In every substantive report show JARVIS technical readiness: X/100% with commit and evidence source. If no valid engineering readiness calculation exists, report UNVERIFIED, not an invented percentage. Coding complete, CI green and benchmark passes are distinct evidence.

## Part 26. Measured complete OCADE product readiness (0–100%) and honest progress (owner addition)

26.1. Follow the mandatory output rule at the top of this plan: no intermediate chat in final-report-only mode; otherwise one line with at most two words during coding. All audit findings, milestones, evidence, blockers and substantive interim reports belong exclusively in PROGRESS.md. A detailed final report is permitted only at the end of the authorized scope after final verification. Readiness scores require explicitly defined technical gates and independent evidence tied to a commit/time. Historical general-release scores are not a validated JARVIS engineering readiness measurement. In the final report separately show coding coverage, deferred IDs, 84-concept verification, passing technical gates, pending/failed GitHub checks and applicable independent benchmark results. Never invent a score.

26.2. Updating a checklist, writing a plan, compiling source, or completing only simulations is not grounds to raise readiness percentage. Only independently verified gates on the tested commit may change the score. Preserve the established release-gate calculation; do not invent weights or merge code progress with production qualification.

26.3. Record in PROGRESS.md every independently verified 10% milestone as it occurs and preserve what changed, passed, failed, was excluded with reason, remains blocked, and what must happen next; deliver the consolidated Claude/Codex progress/readiness report only in the final Stage 7 after applicable testing, without premature completion claims. Urgent safety blockers or permission requests must still be communicated when action is needed. Maintain distinct `NOT CODED`, `CODED`, `BUILDS`, `RUNTIME VERIFIED`, `PARTIAL`, `FAIL`, `BLOCKED`, and `UNTESTED` states.

26.4. 100/100% JARVIS ENGINEERING GO is allowed only after all required JARVIS coding and security checks are green; two-model and E1–E4 evaluations meet their mandatory criteria; Windows 10/11 and macOS receive authorized real-device qualification; customer setup, STOP/Take Over, task recovery, verified deliverables and support pass; there are no unresolved critical/high defects; and required technical testing approvals are obtained. Public deployment remains separately approval-gated and cannot be implied by this score. Otherwise the answer is NO-GO with exact unmet technical conditions.

## FINAL CLAUDE/CODEX REPORT — STATUS DEFINITIONS, COMPLETION CONDITIONS AND PROGRESS (ONLY HERE)

Statuses, by REQUIREMENT ID and feature; NEVER infer a stage from an earlier stage: `SOURCE-NOT-SUPPLIED` (unprovided research), `REQUIREMENT-MAPPED` (specified only), `NOT-CODED`, `PARTIAL`, `CODED` (real implementation+callers), `LOCAL-TESTED` (specific unit/integration or safe negative test), `CI-GREEN` (mandatory full-product tests all completed GREEN at exact SHA), `SECURITY-VERIFIED` (applicable threats addressed with independent negative-test proof), `PRE-CLOUD-BENCHMARK-VERIFIED` (Stage 5), `CLOUD-WORKFLOW-VERIFIED` (Stage 6 authorized real OS/app results), `RELEASE-QUALIFIED` (every applicable mandatory stage independently proven, plus owner-required approvals) or `BLOCKED` with the precise issue. A feature from Parts 27 or 28 is `REQUIREMENT-MAPPED` only until proof says otherwise. Treat earlier dated ledger/code/test statuses as historical, not automatically as current branch results.

Conditions to mark one feature IMPLEMENTED: actual source and live callers at exact SHA; correct interfaces/authorization and data isolation; tests for normal and negative paths; reproducible independent proof. Conditions to mark FULLY COMPLETE/RELEASE-QUALIFIED: all applicable mandatory Coding → Security Threat → Debloat → ALL-GREEN CI → Pre-Cloud Benchmark → Hosted 16-run Baseline → Cloud whole-site/platform/real-device tests have independently passed with exact outputs, genuine receipts, no unresolved critical/high safety defects, zero mandatory failing tests, documented exceptions and explicit approved scopes. A documented name, green source-only build, fabricated simulation or skipped hard case cannot satisfy later gates. 'Zero errors' means zero known unresolved applicable defects/required failing checks within the defined independently tested scope; it is NOT a guarantee of zero unknown vulnerabilities.

Final report, recorded in PROGRESS.md and produced ONLY at this end-of-plan stage: 1) exact source SHA and all requirements vs. genuine implementation coverage; 2) remaining security threats, fixes and proof; 3) debloat changes and before/after metrics; 4) full website/backend/desktop GREEN CI run links/status and zero-error evidence; 5) non-cloud model benchmark outcomes; 6) hosted Gemini/Gemma 16-run baseline and approved cloud Windows/macOS full-site practical task results, independent saved-output verification and failure/regression logs; 7) every failure's GENERAL repair with fresh SHA and rerun (never hardcoded answers or manipulated scores); 8) actual feature status, separate coding and technical readiness, documented exclusions/UNKNOWN/BLOCKED; 9) honest GO/NO-GO and owner approval/deployment boundaries; 10) concise Claude/Codex progress summary of what genuinely works, what is weak, what failed and what remains. Stop false completion claims: if a gate is red, report NO-GO with evidence and continue only authorized safe fixes, not premature release.
