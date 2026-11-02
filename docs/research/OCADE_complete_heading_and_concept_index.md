# Complete Heading and Concept Index — Universal PC Controller / OCADE

**Single-file reference:** all substantive heading occurrences in `Pasted text(20261030-143347).txt`, with each heading’s intended purpose on one line, followed by **additional concepts from our later research and decisions**.

**Source inventory:** 1,457 source lines; 143 heading occurrences across 7 ordered groups. Repeated source headings are repeated below rather than silently merged. Source line numbers refer to the original TXT.

**Relation to `plan.md`:** this index supports [`plan.md`](../../plan.md) (v4) and does not compete with it. Each entry ends with its identifier (A = source heading, B = named component, C = later concept) and its disposition in `plan.md` Appendix C: ALREADY (implemented, status per the mapped concept), KEEP, IMPROVE, REPLACE, ADD or REJECT, followed by the destination work package or concept. A disposition is a plan decision, not proof of implementation; current verified status lives only in `plan.md`. Corrections to the technical claims are in [`UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md`](UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md).

**Interpretation:** Explanations describe what the source proposes, not evidence that the component exists or works. Original overclaims (zero error, sub-millisecond universal control, immutable UI IDs, hidden/minimized GUI control, unlimited retries, universal safety from MCP alone) remain labelled as unverified or invalid where relevant.

## Part A — Every substantive source heading, in original order

### I. MCP tools and conflict-free execution

1. **1. The Absolute Best: Native DaVinci Resolve Studio MCP Server** _(source L5)_ — Proposes direct software scripting for DaVinci Resolve editing instead of cursor automation; availability and licensing must be checked. **[A1 · plan v4: REPLACE → W3, concept 46]**
2. **2. For OS-Level Control without Mouse Stealing: PC-Control MCP** _(source L13)_ — Introduces Windows-native PC-control tools that can use accessibility interfaces instead of moving the physical cursor. **[A2 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
3. **3. The Best Specialized Automation Plugins for DaVinci Resolve** _(source L19)_ — Lists supplementary editing utilities for silence cuts, visual effects and caption generation. **[A3 · plan v4: REPLACE → W3, concept 46]**
4. **1. The Core Backbone: Universal & OS Control** _(source L30)_ — Groups general-purpose OS, filesystem and browser tools into the core automation foundation. **[A4 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
5. **2. Video Editing & Creative Production** _(source L36)_ — Identifies media-editing MCP bridges and post-production workflow integrations. **[A5 · plan v4: REPLACE → W3, concept 46]**
6. **3. Office & Business Productivity** _(source L41)_ — Covers automation of documents, spreadsheets, messages and cloud office tools. **[A6 · plan v4: ALREADY → W5]**
7. **4. Sales & CRM Automation** _(source L46)_ — Covers authorised CRM/sales operations using service APIs or browser automation. **[A7 · plan v4: REJECT → W8; revisit in COM]**
8. **Direct Comparison: Speed vs. Universality** _(source L50)_ — Compares OS scripting, app-native methods and browser automation by task and speed approach. **[A8 · plan v4: KEEP → W3, concept 25]**
9. **1. Enforce a "Single-Dispatcher" Architecture** _(source L61)_ — Proposes a central dispatcher to arbitrate operations against shared applications or files. **[A9 · plan v4: ALREADY → concepts 3, 4]**
10. **2. Implement strict "Context Isolation" via Multi-Agent Swarms** _(source L67)_ — Separates relevant tools among worker contexts to reduce model confusion and accidental cross-domain actions. **[A10 · plan v4: REJECT + KEEP → concepts 6, 15]**
11. **3. Namespace and Prefix Your Tool Definitions** _(source L76)_ — Gives each tool a distinct qualified name so a model cannot ambiguously select identically named operations. **[A11 · plan v4: ALREADY → concept 22]**
12. **4. Use State-Locking and Semaphores for Local Files** _(source L84)_ — Uses resource locks and file readiness checks to prevent simultaneous conflicting changes. **[A12 · plan v4: ALREADY + IMPROVE → W1, W2, concepts 50–52]**
13. **5. Sandboxing and Graceful Degrade** _(source L89)_ — Limits failed tool effects and selects a compatible fallback instead of failing the entire task. **[A13 · plan v4: ALREADY → concepts 38, 61]**
14. **The Golden Rule Architecture for Zero Conflicts** _(source L94)_ — Illustrates the central orchestrator delegating safely to domain-specific worker toolsets. **[A14 · plan v4: ALREADY + REJECT → concepts 1, 2; requirement 259]**

### II. Universal architecture, discovery and professional workflows

15. **1. The Core Infrastructure (The Big Three Universal MCPs)** _(source L116)_ — Defines the universal three-engine foundation: local code execution, desktop accessibility and web automation. **[A15 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
16. **2. How to Achieve Professional-Grade Execution (Zero Hallucination)** _(source L134)_ — Describes discovery, native execution and validation as a pipeline for professional outcomes. **[A16 · plan v4: ALREADY + IMPROVE → W6, W7, W9, concepts 11, 12, 24]**
17. **Phase A: Environment Discovery (Look Before You Leap)** _(source L138)_ — Requires checking live OS, installed applications and permissions before planning execution. **[A17 · plan v4: ALREADY + IMPROVE → W6, W7, W9, concepts 11, 12, 24]**
18. **Phase B: Native Script Translation** _(source L145)_ — Converts user requests into supported application or OS commands instead of blindly clicking. **[A18 · plan v4: ALREADY + IMPROVE → W6, W7, W9, concepts 11, 12, 24]**
19. **Phase C: Validation & Self-Healing** _(source L156)_ — Checks actual effects and diagnoses failures before a bounded repair attempt. **[A19 · plan v4: ALREADY + IMPROVE → W6, W7, W9, concepts 11, 12, 24]**
20. **3. The Ultimate Structural Rule: Separation of State** _(source L160)_ — Separates temporary inputs and outputs and coordinates access to shared resources. **[A20 · plan v4: ALREADY → concept 7]**
21. **Step 1: Universal Control with "Maximum Depth" (No Hardcoding)** _(source L179)_ — Advocates capability-based software control without predefined lists of customer applications. **[A21 · plan v4: ALREADY → concept 9]**
22. **Step 2: Elevating Output from "Basic" to "Professional" (Cinematic Editing)** _(source L188)_ — Separates domain-level quality decisions from the mechanical work of controlling an editor. **[A22 · plan v4: IMPROVE + REJECT → W4, W5, concepts 16, 75]**
23. **Step 3: The "MCP Toolbox Router" (Eliminating Conflicts)** _(source L196)_ — Introduces the hierarchical router that loads only suitable tools for the current milestone. **[A23 · plan v4: ALREADY + ADD → W4, concepts 14, 15, 17, 23]**
24. **Step 4: Achieving "Super Fast" Local Speed** _(source L216)_ — Considers local IPC and model selection to reduce execution and decision latency. **[A24 · plan v4: ALREADY + REJECT → W2, concepts 42, 43]**

### III. Resizing, speed, native execution and semantic routing

25. **1. What "Even Resized" Means (The Reliability Engine)** _(source L224)_ — Explains how UIA targeting may survive movement, resize and DPI shifts better than raw screen coordinates; IDs are not immutable. **[A25 · plan v4: REJECT + KEEP → W6, W7, concepts 33, 35, 59]**
26. **2. The Blueprint for Ultra-Fast, Universal PC Control** _(source L231)_ — Frames automation as code-first OS operations, accessible desktop interactions and browser/API work. **[A26 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
27. **Tier 1: The OS Execution Layer (Speed Strategy: Code-First)** _(source L249)_ — Uses scripts and direct filesystem or OS interfaces for deterministic operations without GUI interaction. **[A27 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
28. **Tier 2: The System Accessibility Layer (Speed Strategy: Tree Interaction)** _(source L255)_ — Uses Windows UIA or macOS accessibility where an app exposes usable controls. **[A28 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
29. **Tier 3: The Network/API Layer (Speed Strategy: Headless Execution)** _(source L261)_ — Uses browser DOM automation or supported network APIs for authorised web tasks. **[A29 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
30. **3. Elevating Output from "Basic" to "Professional"** _(source L267)_ — Explains the difference between professional task reasoning and merely performing input actions. **[A30 · plan v4: IMPROVE + REJECT → W4, W5, concepts 16, 75]**
31. **Step A: Systemic Introspection (Environment Mapping)** _(source L271)_ — Collects current process, software and system information before acting. **[A31 · plan v4: ALREADY + IMPROVE → W6, W7, W9, concepts 11, 12, 24]**
32. **Step B: Vectorized Domain Blueprints** _(source L278)_ — Proposes retrieval of domain-specific workflow guidance to improve quality and avoid naive steps. **[A32 · plan v4: IMPROVE + REJECT → W4, W5, concepts 16, 75]**
33. **Step C: The Self-Correction Loop (Zero Errors)** _(source L284)_ — Feeds execution errors into a bounded correction workflow instead of asserting that retries always succeed. **[A33 · plan v4: REJECT + KEEP → concepts 60, 77]**
34. **4. Implementation: The Local "Toolbox" Routing Layer** _(source L291)_ — Shows a basic example of embedding-based routing to OS, UI or web tools; it is a prototype, not a production router. **[A34 · plan v4: ALREADY + ADD → W4, concepts 14, 15, 17, 23]**

### IV. MCP landscape and repeated introductory explanations

35. **The Landscape of Universal PC & Application Control MCPs** _(source L350)_ — Introduces the general catalog of local desktop, filesystem, browser and app-specific MCP offerings. **[A35 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
36. **Part 1: The Master Universal Control Catalog** _(source L354)_ — Starts the catalog of proposed universal and specialised automation capabilities. **[A36 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
37. **1. The Core Universal Operating System Engines** _(source L357)_ — Names Windows/macOS desktop and local scripting automation tool families. **[A37 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
38. **2. Local Productivity & Enterprise Layers** _(source L364)_ — Names local files and business productivity integrations for data and office work. **[A38 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
39. **3. Headless Web/SaaS Layers** _(source L369)_ — Names browser-based automation and web-context retrieval tool families. **[A39 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
40. **4. Specialized Professional App Native Bridges** _(source L374)_ — Names optional native bridges for specialised creative applications. **[A40 · plan v4: REPLACE → W3, concept 46]**
41. **Part 2: The "Toolbox Router Method" (Task-Based Execution)** _(source L378)_ — Explains routing by task capability rather than exposing every MCP tool simultaneously. **[A41 · plan v4: ALREADY + ADD → W4, concepts 14, 15, 17, 23]**
42. **Step 1: Enforce Strict Namespace Isolation** _(source L397)_ — Uses domain-qualified tool names to reduce schema collisions and prevent ambiguous calls. **[A42 · plan v4: ALREADY → concept 22]**
43. **Step 2: The Semantic Token Gatekeeper** _(source L404)_ — Limits active model tool schemas to a chosen domain or milestone. **[A43 · plan v4: ALREADY + ADD → W4, concepts 14, 15, 17, 23]**
44. **Step 3: Closed-Loop Telemetry Verification** _(source L410)_ — Verifies an observed application change instead of trusting a tool's return value. **[A44 · plan v4: ALREADY → concept 74]**
45. **1. In Simple Terms: What is Required & Why It’s the Best** _(source L416)_ — Explains the three roles of supervisor, state sensors and execution tools in plain language. **[A45 · plan v4: REJECT → —]**
46. **Why this is the absolute best system:** _(source L423)_ — Claims structural automation can be more robust than screenshot clicking; its universal guarantees are not substantiated. **[A46 · plan v4: REJECT → —]**
47. **2. The Core Backbone vs. The Parts** _(source L428)_ — Differentiates desktop accessibility, local stdio transport and native command/API executors. **[A47 · plan v4: ALREADY → concepts 41–43]**
48. **3. MCP vs. API/UI Automation: Who Wins?** _(source L435)_ — Explains that MCP standardises tool access; native APIs and UI automation provide the actual control. **[A48 · plan v4: KEEP → concept 41]**
49. **4. Honest Lines of Code (LOC) Estimation** _(source L443)_ — Gives an early small LOC estimate for a prototype; not a measured production budget. **[A49 · plan v4: REJECT → —]**
50. **5. How to Best the Entire World with This** _(source L453)_ — Advocates filtered tool contexts, a packaged runtime and outcome verification as differentiators. **[A50 · plan v4: KEEP → COM, requirement 259]**
51. **1. In Simple Terms: What is Required & Why It’s the Best** _(source L465)_ — Repeats the plain-language brain/sensors/hands explanation verbatim or near-verbatim. **[A51 · plan v4: REJECT → —]**
52. **Why this is the absolute best system:** _(source L472)_ — Repeats the claimed structural-control benefits, including overconfident minimized-window claims. **[A52 · plan v4: REJECT → —]**
53. **2. The Core Backbone vs. The Parts** _(source L477)_ — Repeats the comparison of UIA, stdio and local script execution roles. **[A53 · plan v4: ALREADY → concepts 41–43]**
54. **3. MCP vs. API/UI Automation: Who Wins?** _(source L484)_ — Repeats the distinction between the MCP protocol and concrete application-control mechanisms. **[A54 · plan v4: KEEP → concept 41]**
55. **4. Honest Lines of Code (LOC) Estimation** _(source L492)_ — Repeats the early small LOC budget, without adding reliable production evidence. **[A55 · plan v4: REJECT → —]**
56. **5. How to Best the Entire World with This** _(source L502)_ — Repeats the proposed competitive strategy built on context filtering and verification. **[A56 · plan v4: KEEP → COM, requirement 259]**

### V. Actor–critic, realtime control, retries and user interruption

57. **1. Real-Time Thinking: The Continuous Actor-Critic State Loop** _(source L515)_ — Proposes reactive observe–act–critic control instead of executing a long, stale action list. **[A57 · plan v4: ALREADY + REJECT → W4, concepts 5, 17, 19, 20]**
58. **2. Eliminating Errors: Structural Window Locking & Telemetry Verification** _(source L545)_ — Proposes binding to structural controls and checking their values after actions; it overstates immunity to layout changes. **[A58 · plan v4: REJECT + KEEP → W6, W7, concepts 33, 35, 59]**
59. **3. The "Never-Stop" Infinite Optimization Loop** _(source L564)_ — Proposes repeated optimization but wrongly suggests infinite retries; production must use hard limits. **[A59 · plan v4: REJECT + KEEP → concepts 60, 77]**
60. **4. Zero-Latency Execution Pipeline (stdio)** _(source L570)_ — Describes local stdio messages between worker processes; it does not make inference or UIA instantaneous. **[A60 · plan v4: ALREADY + REJECT → W2, concepts 42, 43]**
61. **Phase 1: Structuring the Real-Time Reactive Control Loop** _(source L605)_ — Presents the live observe–act–verify–adapt cycle that reacts to changed application state. **[A61 · plan v4: ALREADY + REJECT → W4, concepts 5, 17, 19, 20]**
62. **Phase 2: The Core Tech Stack & Tools (The Execution Engine)** _(source L636)_ — Identifies native UI access, system scripts and IPC as the implementation stack. **[A62 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
63. **1. Windows Enterprise Automation: pywinauto + UIA (UI Automation Core)** _(source L640)_ — Explains Windows UI Automation through pywinauto, including target element discovery and interaction. **[A63 · plan v4: ALREADY + REJECT → concepts 28, 29]**
64. **2. macOS Native Interface Control: pyobjc + ApplicationServices (Accessibility Core)** _(source L645)_ — Explains the macOS accessibility counterpart using pyobjc and ApplicationServices. **[A64 · plan v4: ALREADY + REJECT → concepts 28, 29]**
65. **3. Deep File System & Sandbox Scripting: Native Python subprocess + shutil + os** _(source L650)_ — Runs scoped Python, subprocess and filesystem operations for tasks that need no GUI. **[A65 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
66. **4. The High-Velocity Communication Pipe: Asynchronous sys.stdin / sys.stdout (stdio)** _(source L655)_ — Uses asynchronous stdin/stdout messages for local worker IPC. **[A66 · plan v4: ALREADY + REJECT → W2, concepts 42, 43]**
67. **Phase 3: The Unified Real-Time Scripting Blueprint** _(source L660)_ — Provides sample Python code for UIA actions and a stdio loop; it is illustrative and needs hardening. **[A67 · plan v4: ALREADY + REJECT → concepts 28, 29]**
68. **Phase 4: Why This Architecture Dominates Globally** _(source L737)_ — Argues for a hybrid gateway and selective tool contexts, but market-superiority claims require measurement. **[A68 · plan v4: ALREADY + REJECT → concepts 1, 2; requirement 259]**
69. **1. Why Receding Horizon Optimization Beats All Planning Models** _(source L747)_ — Explains receding-horizon re-planning after live observation rather than rigid multi-step scripting. **[A69 · plan v4: ALREADY + REJECT → W4, concepts 5, 17, 19, 20]**
70. **2. Handling Live User Interference (Mid-Task Edits)** _(source L755)_ — Examines how concurrent manual user input should change or pause automation. **[A70 · plan v4: IMPROVE → W6, W7, concepts 21, 58]**
71. **Stage 1: Structural Window Tree Locking** _(source L776)_ — Attempts to maintain the correct UI target when a customer moves or resizes a window. **[A71 · plan v4: REJECT + KEEP → W6, W7, concepts 33, 35, 59]**
72. **Stage 2: Synchronous Telemetry State Catch** _(source L780)_ — Detects observed state changes after user edits instead of assuming an earlier action remains valid. **[A72 · plan v4: ALREADY → concept 74]**
73. **Stage 3: Dynamic State Pivot** _(source L784)_ — Recalculates safe next actions from the latest state after user intervention. **[A73 · plan v4: IMPROVE → W6, W7, concepts 21, 58]**
74. **3. Ultimate Lines of Code (LOC) Production Estimation** _(source L788)_ — Provides another early compact LOC estimate, not independently validated. **[A74 · plan v4: REJECT → —]**

### VI. Engineering deep dive, Sections A–G

75. **A. Universal Computer Control** _(source L812)_ — Begins the desktop-control feasibility and limitations analysis. **[A75 · plan v4: KEEP → W6, W7]**
76. **1. Limitations of pywinauto and Windows UI Automation (UIA)** _(source L815)_ — Documents UIA blind spots including graphics canvases, custom controls and virtualised grids. **[A76 · plan v4: KEEP → W6, W7]**
77. **2. States of Window Visibility (Minimized vs. Background)** _(source L823)_ — Separates supported operations on foreground, background, minimized and hidden windows. **[A77 · plan v4: ALREADY → concept 35]**
78. **3. Dynamic Application & Interface Discovery** _(source L837)_ — Discovers installed software, running processes, supported APIs and file associations at runtime. **[A78 · plan v4: ALREADY + IMPROVE → W6, W7, W9, concepts 11, 12, 24]**
79. **4. Reaching Maximum Professional Depth** _(source L845)_ — Escalates to deeper application interfaces when accessible top-level GUI controls are insufficient. **[A79 · plan v4: IMPROVE → W5, W6]**
80. **5. Fallback for Zero-Access Black-Box Software** _(source L852)_ — Uses verified visual anchors and relative coordinates as a last resort for black-box software. **[A80 · plan v4: ADD → W5, concept 36]**
81. **B. Speed and Performance** _(source L859)_ — Begins performance and latency trade-off analysis. **[A81 · plan v4: ADD → W2, concept 78]**
82. **6. Real-World Execution Latencies and Benchmarks** _(source L862)_ — Distinguishes cheap IPC/native calls from slower UIA searches and model inference; figures require real benchmarking. **[A82 · plan v4: ALREADY + REJECT → W2, concepts 42, 43]**
83. **7. Stdio Performance vs. IPC Alternatives** _(source L873)_ — Compares in-process calls, named pipes, local sockets and stdio for IPC. **[A83 · plan v4: ALREADY + REJECT → W2, concepts 42, 43]**
84. **8. Local Model Speed vs. Cloud Model Accuracy** _(source L882)_ — Explains accuracy-versus-latency trade-offs of lightweight local models and capable cloud models. **[A84 · plan v4: REJECT → —]**
85. **9. Deterministic Multi-Action Batching (Avoiding Model Call Bloat)** _(source L889)_ — Batches known deterministic actions to reduce unnecessary model calls and interruptions. **[A85 · plan v4: IMPROVE → W4 (guarded step lists), concept 49]**
86. **10. Background Execution Resource Management** _(source L895)_ — Discusses CPU/GPU/RAM usage and non-invasive background workloads. **[A86 · plan v4: ADD → W2, W13, concept 78]**
87. **C. MCP Architecture and Conflicts** _(source L902)_ — Begins design of MCP control, conflict prevention and lifecycle management. **[A87 · plan v4: ALREADY + IMPROVE → W9, concepts 39–45]**
88. **11. Minimal Practical MCP Server Blueprint** _(source L905)_ — Defines a minimal core set of OS, filesystem, browser and application-bridge tools. **[A88 · plan v4: ALREADY + IMPROVE → W9, concepts 39–45]**
89. **12. MCP Gateway vs. Autonomous Agents** _(source L925)_ — Recommends one gateway to coordinate specialised tools instead of multiple uncontrolled autonomous controllers. **[A89 · plan v4: ALREADY → concepts 3, 4]**
90. **13. Concurrency Protection and Crash Recovery** _(source L930)_ — Uses task identities, resource locks and recovery checks to handle tool crashes and concurrent writes. **[A90 · plan v4: ALREADY + IMPROVE → W1, W2, concepts 50–52]**
91. **14. Managing Large Tool Catalogs** _(source L937)_ — Selects a small set of typed capabilities and schemas for each execution stage. **[A91 · plan v4: ALREADY + ADD → W4, concepts 14, 15, 17, 23]**
92. **15. Handling Server Instability and Anomalies** _(source L943)_ — Sets timeouts, validates schemas and verifies real effects after MCP instability. **[A92 · plan v4: ALREADY + IMPROVE → W9, concepts 39–45]**
93. **D. OD-AVGHHC and Autonomous Execution** _(source L949)_ — Begins the outcome-driven, verifier-gated supervisory design. **[A93 · plan v4: IMPROVE → W4, concept 18]**
94. **16. Integrating Receding Horizon Control inside OD-AVGHHC** _(source L952)_ — Separates high-level milestones, permissions and safety from short-horizon low-level execution. **[A94 · plan v4: IMPROVE → W4, concept 18]**
95. **17. Macroscopic Planning for Unknown Task Horizons** _(source L970)_ — Splits unknown-duration jobs into adaptive milestones rather than guessing every future step. **[A95 · plan v4: IMPROVE → W4, concept 18]**
96. **18. Disambiguating Failed Actions from Lost Confirmations** _(source L977)_ — Reconciles unknown effects before retrying actions whose completion acknowledgements were lost. **[A96 · plan v4: IMPROVE → W1, concept 55]**
97. **19. Professional Deliverable Verification** _(source L984)_ — Checks actual project/file quality and structure instead of reporting success because a file exists. **[A97 · plan v4: IMPROVE → W5, concept 75]**
98. **20. Safeguarding the Self-Healing Engine (Preventing Catastrophes)** _(source L991)_ — Uses finite retries, destructive-operation fences and restricted privileges to prevent runaway repair loops. **[A98 · plan v4: ALREADY → concepts 60, 62]**
99. **E. Complete Backend Rebuild** _(source L998)_ — Begins the replacement-backend topology section; this title is repeated in the source. **[A99 · plan v4: REJECT → —]**
100.  **E. Complete Backend Rebuild** _(source L1002)_ — Repeats the backend-rebuild section label after a stray '21.' copy artifact. **[A100 · plan v4: REJECT → —]**
101.  **21. Minimum Production Architecture Topology** _(source L1005)_ — Defines supervisor, verifier, capability registry, process manager and isolated tool modules. **[A101 · plan v4: ALREADY → concepts 3, 4]**
102.  **22. Revised Lines of Code (LOC) Production Estimate** _(source L1037)_ — Estimates source-code size for the core gateway, runner, UIA, sandbox, verifier and test modules. **[A102 · plan v4: REJECT → —]**
103.  **23. Build vs. Buy Strategy** _(source L1048)_ — Reuses proven protocol SDKs, Playwright and UI automation while building only the product-specific coordinator. **[A103 · plan v4: KEEP → —]**
104.  **24. Interfacing and Connecting with the Existing Front-End** _(source L1053)_ — Describes a structured front-end/backend request contract to preserve compatibility during migration. **[A104 · plan v4: ALREADY → concept 44]**
105.  **25. Architecture Simplification & Objective Success Metrics** _(source L1072)_ — Recommends small shared executors and quantitative reliability, latency and token-use metrics. **[A105 · plan v4: KEEP → W2, W12]**
106.  **F. Security and Operational Reliability** _(source L1081)_ — Begins runtime security, safety and operations planning. **[A106 · plan v4: IMPROVE → W11, concept 62]**
107.  **26. Runtime Sandboxing and Asset Protection** _(source L1084)_ — Defines least-privilege containment, ACLs and restrictions on untrusted code and private assets. **[A107 · plan v4: IMPROVE → W11, concept 62]**
108.  **27. Execution State Control (Stop / Pause / Resume)** _(source L1090)_ — Explores STOP, pause/resume and persistent checkpoints; literal process killing and suspension require safety review. **[A108 · plan v4: ALREADY → concept 57]**
109.  **28. Absolute Window and Target Context Resolution** _(source L1097)_ — Binds actions to process/window/document identity to avoid changing the wrong instance. **[A109 · plan v4: ALREADY → concept 33]**
110.  **G. Verification and Final Recommendation** _(source L1104)_ — Introduces launch tests and the architecture recommendation. **[A110 · plan v4: KEEP → W13]**
111.  **29. Commercial Launch Test Suite Design** _(source L1107)_ — Proposes multi-app qualification scenarios including unknown software, interruptions, crashes and output verification. **[A111 · plan v4: KEEP → W13]**
112.  **30. Definitive Architecture Trade-Off Evaluation** _(source L1128)_ — Compares lightweight UIA, hybrid native/vision and combined Architecture C trade-offs. **[A112 · plan v4: ALREADY + REJECT → concepts 1, 2; requirement 259]**
113.  **Final Architectural Recommendation: Choose Architecture C** _(source L1140)_ — Selects Architecture C as the proposed combination of outcome governance and a local MCP execution layer. **[A113 · plan v4: ALREADY + REJECT → concepts 1, 2; requirement 259]**
114.  **Retractions from Earlier Hypotheses:** _(source L1144)_ — Explicitly retracts earlier zero-error, minimized-window and universal sub-5ms claims. **[A114 · plan v4: KEEP → —]**

### VII. Final architecture, seven workflows, MCP lifecycle and code budget

115. **1. Eliminating Fixed Planning: The Receding-Horizon Vector Selector** _(source L1152)_ — Introduces a state-target formulation and iterative selection of the next useful tool action. **[A115 · plan v4: ALREADY + REJECT → W4, concepts 5, 17, 19, 20]**
116. **How the Adaptive Engine Works Without a Plan** _(source L1187)_ — Defines target-state observations and gap calculation as a planning metaphor, not a proven universal numeric optimiser. **[A116 · plan v4: ALREADY + REJECT → W4, concepts 5, 17, 19, 20]**
117. **Mitigating Architectural Safety Failures** _(source L1193)_ — Adds cycle detection, deterministic action batching and restrictions on destructive operations. **[A117 · plan v4: IMPROVE → W4 (guarded step lists), concept 49]**
118. **2. Deep Resolution of the Seven Production Scenarios** _(source L1199)_ — Introduces seven concrete workflow classes for evaluating universal control. **[A118 · plan v4: KEEP → W13 §20]**
119. **1. Cinematic Video Editing** _(source L1202)_ — Covers native video editing, render failures and technical verification of the exported media. **[A119 · plan v4: KEEP → W13 §20]**
120. **2. Cinematic Photo Editing** _(source L1211)_ — Covers photo editing using supported commands, accessibility and visual fallback plus result checks. **[A120 · plan v4: KEEP → W13 §20]**
121. **3. Local Autonomous Chess Application** _(source L1220)_ — Demonstrates a specialised visual-canvas scenario where an external chess engine and screen understanding may be required. **[A121 · plan v4: KEEP → W13 §20]**
122. **4. Complex Financial Data & Accounting Reconciliations** _(source L1229)_ — Uses structured file/data processing and independent arithmetic checks for large ledgers. **[A122 · plan v4: KEEP → W13 §20]**
123. **5. Engineering CAD / 3D Design** _(source L1238)_ — Uses supported CAD commands/APIs and geometric export checks instead of only clicking geometry. **[A123 · plan v4: KEEP → W13 §20]**
124. **6. Cross-Application Automated Workflows** _(source L1247)_ — Coordinates browser research, local data transformation and presentation/document creation. **[A124 · plan v4: KEEP → W13 §20]**
125. **7. Resilient Handling of System Interruptions** _(source L1256)_ — Handles pop-ups, process crashes, user interference and connectivity disruptions with safe recovery boundaries. **[A125 · plan v4: KEEP → W13 §20]**
126. **3. The Unified Production Architecture Blueprint** _(source L1267)_ — Combines web UI, outcome supervisor, MCP gateway, local execution and independent verifier into one topology. **[A126 · plan v4: ALREADY + REJECT → concepts 1, 2; requirement 259]**
127. **The Five Primary Architectural Components** _(source L1303)_ — Names the five conceptual system components and their responsibilities. **[A127 · plan v4: ALREADY → concepts 3, 4]**
128. **Maximizing Maintenance Efficiency & Eliminating Code Clutter** _(source L1311)_ — Calls for reusing external libraries and consolidating duplicate tools without sacrificing correctness. **[A128 · plan v4: KEEP → W12, concept 81]**
129. **Verification Strategy & Software Test Suite** _(source L1316)_ — Proposes adversarial workflows, simulated interruptions and release verification tests. **[A129 · plan v4: KEEP → W13]**
130. **1. Defitive Performance Verdict: Architecture C vs. The Field** _(source L1322)_ — Claims Architecture C should outperform simpler approaches; such superiority is a hypothesis to benchmark. **[A130 · plan v4: ALREADY + REJECT → concepts 1, 2; requirement 259]**
131. **Circumstances Where Architecture C Will Lose:** _(source L1330)_ — Identifies failure cases where smaller models or graphics-heavy work without APIs can defeat the proposed approach. **[A131 · plan v4: KEEP → W6, W7]**
132. **2. Universal MCP Toolbox & Lifecycle Management** _(source L1335)_ — Describes the capability registry, installation policies, schema exposure and MCP lifecycle automation. **[A132 · plan v4: ALREADY + IMPROVE → W9, concepts 39–45]**
133. **Discovery, Installation, and Lifecycle:** _(source L1357)_ — Defines discovery, version pinning, permission evaluation, authentication and updating stages. **[A133 · plan v4: ALREADY + IMPROVE → W9, concepts 39–45]**
134. **The Smallest Practical Universal MCP Toolbox:** _(source L1366)_ — Introduces the four foundational local tool roles. **[A134 · plan v4: ALREADY + IMPROVE → W9, concepts 39–45]**
135. **3. The Universal Application Fallback Hierarchy** _(source L1373)_ — Defines the app-control fallback sequence: native APIs, UIA, Win32 interaction, then vision. **[A135 · plan v4: IMPROVE → W3, concepts 37, 56, 77]**
136. **4. Eliminating Fixed Planning Steps** _(source L1382)_ — Defines a goal-driven sense–act–verify loop with macro-batching instead of a rigid fixed script. **[A136 · plan v4: ALREADY + REJECT → W4, concepts 5, 17, 19, 20]**
137. **5. Resilient Fault Handling & Verification** _(source L1390)_ — Adds crash reconciliation, cancellation, exact targets and independent output checks. **[A137 · plan v4: IMPROVE → W3, concepts 37, 56, 77]**
138. **6. The Real Total Lines of Code (LOC) Calculation** _(source L1397)_ — Presents a later table estimating MVP, production and tested code footprints. **[A138 · plan v4: REJECT → —]**
139. **Architectural LOC Footprint Table:** _(source L1401)_ — Lists code estimates for routing, MCP, UIA, browser, security, STOP, verification and testing. **[A139 · plan v4: REJECT → —]**
140. **Core Code Variance Assumptions:** _(source L1422)_ — Explains the assumptions separating the 2,500, 6,000 and 9,400 LOC projections. **[A140 · plan v4: REJECT → —]**
141. **7. Lowest-Cost Realistic AI Architecture** _(source L1428)_ — Proposes cloud planning with a small local fallback, which must not silently replace the project's authorised online-only task planner. **[A141 · plan v4: REJECT → —]**
142. **8. Structural Code Reduction Strategy** _(source L1449)_ — Calls for removing hardcoded application journeys and redundant wrappers after parity testing. **[A142 · plan v4: KEEP → W12, concept 81]**
143. **9. The Winning Architecture Blueprint** _(source L1457)_ — Shows an unfinished final heading with no supporting body text in the uploaded file. **[A143 · plan v4: REJECT → —]**

### Source-format caveats

- **Duplicate source sections:** the repeated layperson explanations at L416–L510 and the doubled `E. Complete Backend Rebuild` label at L998 and L1002 are preserved as distinct occurrences.
- **Copy artifact:** L1001 contains only `21.`; it is an orphan number, not a substantive heading.
- **Incomplete final heading:** L1457 contains `9. The Winning Architecture Blueprint` but no explanatory body follows.
- **Subheadings within prose and numbered operational steps:** the source also contains many inline concept labels, examples, table headings and sequence steps; their roles are included below or in the one-line heading descriptions rather than misclassifying every sentence as a formal heading.

## Part B — Named source subcomponents and example tools (not formal standalone headings)

1. **Open Interpreter / local execution MCP** — Runs bounded local commands/scripts instead of driving a GUI unnecessarily. **[B1 · plan v4: REPLACE → W3]**
2. **Filesystem MCP** — Reads, writes, copies, moves and hashes approved local files. **[B2 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
3. **Playwright Browser MCP** — Automates authenticated web user interfaces through browser DOM controls. **[B3 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
4. **Windows Computer Use MCP / pywinauto** — Exposes Windows accessibility structures and supported control actions. **[B4 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
5. **Peekaboo / macOS accessibility** — Proposes native accessibility-driven automation for compatible macOS apps. **[B5 · plan v4: REPLACE → W7, concept 29]**
6. **DaVinci Resolve MCP / scripting bridges** — Connects supported video-editing application scripting features to an agent. **[B6 · plan v4: REPLACE → W3, concept 46]**
7. **FireCut AI** — Examples of creative-domain silence cutting and edit automation. **[B7 · plan v4: REPLACE → W3, concept 46]**
8. **Reactor** — Examples of extensible compositing, Fusion tools and macros. **[B8 · plan v4: REPLACE → W3, concept 46]**
9. **Snap Captions / Magic Subtitle** — Examples of captions/subtitles automation. **[B9 · plan v4: REPLACE → W3, concept 46]**
10. **M365 / Microsoft 365 integrations** — Accesses supported Microsoft business services after required authorization. **[B10 · plan v4: REJECT → W8; revisit in COM]**
11. **Google Workspace integrations** — Accesses supported Google business services after required authorization. **[B11 · plan v4: REJECT → W8; revisit in COM]**
12. **HubSpot / Salesforce connectors** — Performs authorised CRM updates through APIs or web automation. **[B12 · plan v4: REJECT → W8; revisit in COM]**
13. **TinyFish / web context** — Source-document example of a specialised web information tool, not a prerequisite for PC control. **[B13 · plan v4: REJECT → —]**
14. **sys_core** — Discovers processes/apps and handles approved OS commands. **[B14 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
15. **ui_bridge** — Reads and interacts with exposed desktop accessibility controls. **[B15 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
16. **fs_sandbox** — Restricts and verifies file changes in approved task locations. **[B16 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
17. **web_automation** — Performs browser interactions with Playwright and authorised account sessions. **[B17 · plan v4: ALREADY → W3, W6–W8, concepts 26, 27, 28, 29, 30, 41]**
18. **Capability registry / typed schemas** — Maps what each tool can do and validates every requested tool call. **[B18 · plan v4: ALREADY + ADD → W4, concepts 14, 15, 17, 23]**
19. **Async stdio subprocess multiplexer** — Moves MCP protocol messages between the gateway and local tool processes. **[B19 · plan v4: ALREADY + REJECT → W2, concepts 42, 43]**
20. **Task UUID, resource lock and idempotency key** — Identifies actions, prevents conflicting writes and avoids duplicate side effects. **[B20 · plan v4: ALREADY + IMPROVE → W1, W2, concepts 50–52]**
21. **Target state ψ, observed state Sₜ and delta Δ** — A conceptual representation for comparing desired and observed outcomes. **[B21 · plan v4: ALREADY + REJECT → W4, concepts 5, 17, 19, 20]**
22. **Macro batching** — Executes verified deterministic blocks locally without an LLM call for each low-level input. **[B22 · plan v4: IMPROVE → W4 (guarded step lists), concept 49]**
23. **Domain-specific verification** — Checks structure, values, renders, geometry and file quality separately from execution. **[B23 · plan v4: IMPROVE + REJECT → W4, W5, concepts 16, 75]**
24. **Windows AppContainer / Job Objects / ACLs** — Windows containment building blocks; cannot be assumed secure merely by wrapping stdio. **[B24 · plan v4: IMPROVE → W11, concept 62]**
25. **Chrome profile / OAuth / MFA** — Authentication-sensitive automation surfaces with explicit security and permission limits. **[B25 · plan v4: KEEP → W8, concepts 31, 63]**
26. **Visual anchor matching / OpenCV** — Optional last-resort targeting for otherwise inaccessible graphics canvases. **[B26 · plan v4: ADD → W5, concept 36]**
27. **Actor–critic / supervisor–pilot roles** — Separates the high-level objective from immediate controlled actions. **[B27 · plan v4: ALREADY + REJECT → W4, concepts 5, 17, 19, 20]**
28. **Five architectural components** — Supervisor, registry, MCP lifecycle/process manager, execution bridge and verifier. **[B28 · plan v4: ALREADY → concepts 3, 4]**
29. **Seven production scenarios** — Video, photo, chess, financial data, CAD, cross-app workflows and interruptions. **[B29 · plan v4: KEEP → W13 §20]**
30. **LOC estimates: 2,500 / 6,000 / 9,400** — Source-document projections for MVP / production / tested source, not measured actual code requirements. **[B30 · plan v4: REJECT → —]**

## Part C — Additional headings and concepts gathered after the source text

**Distinct from the source:** the following are requirements, refinements and historical lessons established in our subsequent conversation/research; they should not be misrepresented as literal headings from the uploaded TXT.

### Product and user experience

1. **Zero-effort customer workflow** — The customer supplies the outcome once; the product handles routing, execution, recovery and delivery within authorised boundaries. **[C1 · plan v4: KEEP → W10, concept 72]**
2. **Centered minimal prompt** — Start on a clean screen without a prominent dashboard, orb or complicated tool interface. **[C2 · plan v4: KEEP → W10, concept 72]**
3. **Collapsed task input on Send** — Turn the prompt into a compact running experience immediately after submission. **[C3 · plan v4: KEEP → W10, concept 72]**
4. **One subtle ambient status line** — Show one truthful, changing plain-language action beneath the prompt, not a large progress box. **[C4 · plan v4: KEEP → W10, concept 72]**
5. **No script filenames in customer UI** — Keep source paths and subprocess names within optional diagnostics, not the ambient status. **[C5 · plan v4: KEEP → W10, concept 72]**
6. **Small expandable activity link** — Reveal meaningful execution receipts and blockers only when the customer chooses to inspect them. **[C6 · plan v4: KEEP → W10, concept 72]**
7. **Small collapsible history sidebar** — Provide old tasks and conversations without occupying the main workspace. **[C7 · plan v4: KEEP → W10, concept 72]**
8. **Final answer and file links** — Keep completion clean, with actual verified deliverables and correct download paths. **[C8 · plan v4: KEEP → W10, concept 72]**
9. **Minimal monochrome styling** — Use restrained visual hierarchy and accessibility rather than attention-grabbing ornaments. **[C9 · plan v4: KEEP → W10, concept 72]**
10. **Non-prominent STOP access** — Provide genuine cancellation via small site control and device tray, not an oversized UI component. **[C10 · plan v4: KEEP → W10, concept 72]**
11. **Task-adaptive deliverables** — Provide final files and optional editable originals when the task calls for them; avoid unnecessary result clutter. **[C11 · plan v4: KEEP → W5, W10, concept 71]**
12. **Autonomous reversible defaults** — Resolve minor ambiguity with safe reversible choices rather than repeated confirmation dialogs. **[C12 · plan v4: IMPROVE → W4]**

### Device, permissions and login

13. **One installer, automatic trusted pairing** — Install a signed companion once, then auto-discover devices on the same account after appropriate mutual device trust. **[C13 · plan v4: IMPROVE → W9, W10]**
14. **Signed Device Agent** — Runs task actions on the customer-owned computer using scoped authority instead of a hidden cloud desktop. **[C14 · plan v4: ALREADY → concept 65]**
15. **Same-account device discovery** — Discover likely eligible devices without assuming common login grants unrestricted device control. **[C15 · plan v4: IMPROVE → W9, W10]**
16. **Persistent authorised capability scopes** — Remember legitimate permissions and avoid asking again on every routine action. **[C16 · plan v4: IMPROVE → W11, concept 67]**
17. **Official Windows elevation** — Use genuine UAC for protected operations; never emulate credentials or bypass administrator protections. **[C17 · plan v4: KEEP → W9]**
18. **Protected payment/secret boundary** — Pause at payment authorization, passwords, MFA/passkeys or sensitive scope changes while continuing independent work. **[C18 · plan v4: ALREADY → W1]**
19. **Google-first product sign-in** — Offer the preferred simple sign-in surface without conflating product authentication with external website access. **[C19 · plan v4: KEEP → W10]**
20. **Existing authorised browser session** — Prefer browser integrations that respect the actual session/profile and do not copy, read or extract stored secrets. **[C20 · plan v4: KEEP → W8]**
21. **Session expiry and reauthentication** — Refresh credentials only through supported flows; otherwise request an official login step. **[C21 · plan v4: KEEP → W8]**
22. **MFA/CAPTCHA handling** — Let customers complete external security challenges without bypassing them. **[C22 · plan v4: KEEP → W8]**
23. **Explicit-recipient outbound actions** — Perform authorised sends to recipients named in the task; handle untrusted recipients and risky actions cautiously. **[C23 · plan v4: ALREADY → W1]**
24. **Safe deletion to Recycle Bin** — Prefer recoverable deletion and preserve originals where appropriate; irreversible actions need stronger authorization. **[C24 · plan v4: ADD → W3 (typed `trash`)]**
25. **Secrets vault and token isolation** — Keep credentials out of prompts, logs and generic MCP process environments unless their scope requires them. **[C25 · plan v4: ALREADY → concept 64]**

### Real computer control and execution

26. **Dynamic Windows application catalog** — Inventory Win32, UWP/MSIX/Store, Start Menu aliases, associations, running processes and capabilities. **[C26 · plan v4: IMPROVE → W6, concept 12]**
27. **No hardcoded application journeys** — Choose tools by capabilities and current installation evidence, not app-specific demo macros. **[C27 · plan v4: ALREADY → concepts 9, 10]**
28. **Exact PID/HWND/document binding** — Target the correct account, process, window, tab and file; fail closed on ambiguity. **[C28 · plan v4: ALREADY → concept 33]**
29. **Window resize, DPI and multi-monitor resilience** — Requery controls and scale coordinates only when needed; test changed layouts and virtualized controls. **[C29 · plan v4: IMPROVE → W6, W7, concept 34]**
30. **Minimized/hidden-window truthfulness** — Use native APIs for background work; restore when needed, because UIA and synthetic input cannot universally operate hidden windows. **[C30 · plan v4: ALREADY → concept 35]**
31. **User take-over and conflict handling** — Pause affected UI actions when the user edits or changes focus while independent background operations continue. **[C31 · plan v4: IMPROVE → W6, W7, concept 58]**
32. **Native-first execution order** — Prefer supported APIs/object models, scoped commands and file/project formats before DOM/UIA and visual coordinates. **[C32 · plan v4: ALREADY → concept 25]**
33. **Browser DOM and authorised network calls** — Use Playwright or documented APIs without treating a website as permanently automatable. **[C33 · plan v4: ALREADY → concept 30]**
34. **Local bounded filesystem workspace** — Keep task inputs, intermediates and outputs isolated with provenance, rollback and ownership. **[C34 · plan v4: ALREADY → concepts 38, 69]**
35. **Resource-aware scheduler** — Run independent work in parallel but serialize conflicting document, tab, application or file mutations. **[C35 · plan v4: IMPROVE → W2, concept 51]**
36. **Transactional task/side-effect journal** — Record intended and observed changes, acknowledgements and idempotency keys before repeating effects. **[C36 · plan v4: ALREADY → concepts 53, 56, 57]**
37. **Durable checkpoints and recovery** — Restart from independently verified state after crash, disconnect or model outage. **[C37 · plan v4: ALREADY → concepts 53, 56, 57]**
38. **Local STOP safety fence** — Prevent new actions after STOP and accurately report any already committed or in-flight effects. **[C38 · plan v4: ALREADY → concepts 53, 56, 57]**
39. **Bounded receding-horizon planner** — Keep large goal milestones while adjusting immediate actions to current observations with explicit retry limits. **[C39 · plan v4: ALREADY → concept 19]**
40. **Independent professional verifier** — Check spreadsheet values/formulas, document structure, video metadata, CAD geometry and required output quality. **[C40 · plan v4: IMPROVE → W5, concept 75]**
41. **Capability-first tool choice** — Prefer a verified equivalent installed app if the named software is unavailable and the user did not require that exact app. **[C41 · plan v4: ALREADY → concepts 9, 10]**
42. **Untrusted MCP provenance restrictions** — Do not execute unfamiliar registry packages solely because they advertise a matching tool. **[C42 · plan v4: ALREADY → concept 46]**
43. **MCP self-install under established policy** — Prebundle trusted tools and automatically provision approved, pinned components without customer terminal setup. **[C43 · plan v4: ADD → W9]**
44. **No forced local model fallback** — Respect the separate offline Chat capability; desktop execution should not silently switch to an unapproved local planner. **[C44 · plan v4: ALREADY → standing]**

### Lessons from earlier failures and implementation discipline

45. **Pairing and agent-runtime blocker** — Verify the companion is installed, authenticated, paired and reachable before promising any PC action. **[C45 · plan v4: ALREADY → W9]**
46. **Incomplete app discovery** — Account for Windows built-ins and packaged apps; never invent launch commands. **[C46 · plan v4: IMPROVE → W6, concept 12]**
47. **Wrong OS command context** — Bind script generation to the actual Windows shell, environment and permissions. **[C47 · plan v4: ALREADY → W9]**
48. **Wrong-window incident** — Use exact leases and fresh identity checks; opening the wrong window is a critical safety failure. **[C48 · plan v4: ALREADY → concept 33]**
49. **Blocked vs executed tests** — Historical browser QA showed 20 PASS, 5 FAIL, 8 PARTIAL and 8 BLOCKED, with no completed real PC workflow; blocked dispatch is not proof of tool failure. **[C49 · plan v4: KEEP → —]**
50. **Retired previous engine** — The implementation branch retired the old execution engine; the new foundation requires actual coding, not simply configuring an old runner. **[C50 · plan v4: KEEP → —]**
51. **No premature PASS claims** — Treat source inspection, mocks, browser tests, real Windows tests and physical hardware validation as distinct evidence. **[C51 · plan v4: KEEP → S]**
52. **Cloud-first testing** — Run all permitted cloud and simulated checks before seeking owner permission for local-PC operations. **[C52 · plan v4: KEEP → S]**
53. **Representative real-task benchmark** — Measure completion, safety, accuracy, recovery, latency and necessary user interventions on genuine multi-app tasks. **[C53 · plan v4: KEEP → W4, W13, R5]**
54. **90% acceptance target, 95%+ ambition** — Use independently verified outcomes and avoid claiming a guaranteed universal 98% or 100%. **[C54 · plan v4: KEEP → W4, W13, R5]**
55. **Zero known critical safety defects** — Do not accept the build with confirmed privilege, wrong-target, destructive-action or data-leak defects. **[C55 · plan v4: KEEP → R10, concept 84]**
56. **No fake deliverables** — Do not let the test harness create the files that the product agent was supposed to produce. **[C56 · plan v4: KEEP → S]**
57. **Proof-driven debloating** — Delete obsolete code only after tracing callers and establishing functional parity and regression coverage. **[C57 · plan v4: KEEP → W12]**
58. **Source code versus verified implementation** — A design heading or LOC projection does not prove that a corresponding runtime feature has been implemented. **[C58 · plan v4: KEEP → S]**
59. **Owner-controlled GitHub policy** — Use only the implementation branch; never merge main, deploy, spend, enable payments or use the owner’s PC without authorization. **[C59 · plan v4: KEEP → S]**
60. **User-facing MCP invisibility** — Keep plugin discovery, setup, tool selection and process management internal so customers see direct task completion. **[C60 · plan v4: ALREADY → concept 73]**
61. **First vertical-slice milestone** — Prove one end-to-end authorized task through the actual product surface before scaling to arbitrary apps. **[C61 · plan v4: ALREADY → W10]**
62. **Gradual coverage expansion** — Add browser, spreadsheets, media, CAD and complex cross-app work using common infrastructure with real proof. **[C62 · plan v4: KEEP → S]**
63. **User effort as a formal metric** — Count required prompts, security approvals, re-logins and manual fixes in task benchmark results. **[C63 · plan v4: ADD → W4, concept 83]**

## Part D — What to build, in one line

**A minimal, outcome-first customer experience backed by a securely paired local Device Agent, one trusted MCP/capability gateway, native-first application control, a bounded adaptive supervisor and independent deliverable verification, qualified through measured real workflows.**

## Practical boundary

Complete **requirements coverage** means every source idea is evaluated and traced to an implementation choice; it does **not** mean blindly implementing impossible or unsafe statements, installing arbitrary unknown MCP executable code, bypassing login/UAC/MFA, or claiming 100% success without independent evidence.

**Counts:** 143 substantive source-heading occurrences + 30 named source subcomponents + 63 later concepts = 236 one-line explanations, each with a disposition in `plan.md` Appendix C (236/236).
