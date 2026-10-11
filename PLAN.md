# OCADE implementation blueprint

## 0. LATEST BINDING OWNER INSTRUCTIONS — 11 October 2026

**Authority and order:** This section supersedes the older cleanup, hardcoded-application, donor-preservation and test-scheduling instructions wherever they conflict. Preserve the rest of this PLAN.md, P00–P22, AGENTS.md, CLAUDE.md and their security/functional requirements. This is an implementation instruction, **not evidence that the work has happened**. Continue from the latest committed and uncommitted engineering checkpoint; do not reset or overwrite Claude's valid work. Work on the existing implementation branch, not on `main`, until the final gates below pass. Do not confuse this separately published PLAN.md download branch with the implementation branch.

### 0.1 Mandatory execution sequence

**STAGE A — STOP disruptive live tests, inventory and remove donors FIRST.**

1. Inspect exact repository SHA, branch, dirty files, running test sessions and already-finished work. Safely stop repeated GUI-driving test invocations; preserve code changes and unresolved execution journals. Do not terminate customer applications or modify user documents.
2. Identify **every donor archive and extracted donor snapshot**, including the original JARVIS donor ZIP, UI donor ZIP, UI imports, duplicate donor extractions and orphan donor-generated assets, wherever they actually exist (the precise known paths and impacted tests are in Section 0.4). Check callers, package inputs, licences, attributions, generated outputs and dependencies **before deletion**. Delete tracked ZIPs and donor snapshots from the active repository with traceable Git changes; remove broken references and packaging entries. Do **not** recreate, consult for future implementation or reimport them after the removal audit. User explicitly supersedes the old rule to keep immutable donors in the active tree. Preserve required licence/attribution notices and an exact removal manifest plus existing Git history; **do not rewrite Git history**. Do not delete any active product module just because it originated in a donor: migrate/rehome required behaviour first. No unverified vendor rights or customer-data deletion. Clean the active donor dependency and donor-derived source rights separately; deleting original files is not a substitute for clean, OCADE-owned implementation.
3. Count baseline tracked source files, total source lines, source bytes, donor files/bytes, generated artefacts and test files separately. Record exclusions and the exact baseline SHA. Report deletions, additions and **net** change, not invented savings.

**STAGE B — ONE complete, systematic source inventory and hardcoding/debloat audit BEFORE new feature coding.**

4. Inspect every *active, tracked* source, package/config, build, integration, schema, runtime and test file once in reproducible ownership-based passes, explicitly including donor preservation tests, legacy authority documents, import-path collisions and UI entry-point ownership listed in Section 0.4. Use a SHA/path/hash manifest; resume only changed/unreviewed material and never repeatedly reread unchanged files or entire conversations. Identify callers, reachable entry points, production packaging and dynamically loaded references before declaring any code dead. Treat archived/historical Git data separately from shipped code. Record candidate removals and risk.
5. **Zero hardcoded application routing.** Remove literal application-name/alias registries, fixed launch lists, application-specific branches, fixed window-title matches, selectors, remembered coordinates, canned workflows and application-biased planner choices from **active universal-control runtime**. No special first-class preference for an installed application's brand, no fixed catalogue of supported apps and no code that succeeds only for a curated app. Discover installed application identity/version, exposed APIs, OS accessibility capabilities, file types, browser/session interfaces and permission scope *at runtime*. Route by qualified capability and task intent, not by literal name. Use native/object APIs or authorised scripting/CLI where discovered; supported browser DOM/Playwright/CDP; OS UI Automation; fresh observed vision/GUI input only as a last resort. Batch locally admitted deterministic actions through one existing broker; revalidate permissions and STOP before mutations; verify output independently.
6. **The owner withdraws the old "KEEP hardcoded app names" recommendation.** Migrate legacy named native integrations, hardcoded COM identifiers and display/browser/safety name tables toward discovered, typed, versioned capabilities; then delete the obsolete named routing/binding code **after real equivalence and fail-closed safety are demonstrated**. Do not merely rename a fixed map or move it to JSON. If a named binding is technically unavoidable for an explicitly promised native integration, classify it as a blocking exception with exact source and capability gap; do not silently ship it or remove a needed security safeguard. Replace protected-credential checks with an equally strong or stronger generic protected-surface policy **before** removing any denylist. Do not weaken authentication, credential, OTP, protected-desktop, app permission or customer-data controls to achieve a numerical zero.
7. **Extreme real deletion:** Remove proven unused/dead functions, redundant export paths, duplicate controllers, stale compatibility code (only when safe), old installers, duplicate loops/pollers, speculative modules, unneeded wrappers/dependencies and disposable generated caches. Keep a single clear owner for each concern. Consolidate where parity is demonstrated; preserve feature quality, error cases, platform support, signed updates, STOP, accessibility, data recovery, authorization and independently checkable outputs. No arbitrary deletion quota and no line-count code golf. After cleanup, provide a concrete before/after inventory: tracked active source files, source lines, added lines, deleted lines, net change, removed files and bytes, retained exceptions, risks and unresolved candidates.

**STAGE C — FINISH REAL CODING, all P00–P22.**

8. Only after Stages A/B and safe cleanup, continue remaining P00–P22 implementation packages in dependency order. Reuse commits already landed on the working branch (including P01 receipt-gated completion, P02 STOP guards, P03 durability, P08 device segments, P10 recipe quarantine and subsequent checkpointed work where verified). Do not redo valid work or replace existing owners with a second framework. Mark implemented versus partially implemented versus blocked honestly.
9. **No real-app launches or repetitive tests during coding.** Do not automatically open, click, type into or close installed customer desktop applications. In particular, **remove or refactor** the fixed Windows accessibility smoke test `jarvis-runtime/tests/test_computer.py::AccessibilityTest::test_calculator_by_its_buttons` and its canned `7 × 6 = 42` sequence. Replace it with an application-independent, parameterised synthetic UI-accessibility fixture; final live tests must select varied authorised installed applications by runtime discovery. Do not retain the canned scenario merely as an opt-in. Isolate any unavoidable live GUI/Office/browser/device test behind an explicit final-campaign opt-in, not OS checks alone. Do not run full test suites or final GUI testing during this coding stage. Non-interactive compilation/type checks and narrowly necessary isolated safety proofs are permitted to prevent introducing dangerous defects; **never** drive physical applications for those checks. If safety correctness cannot be established without a live test, mark BLOCKED/UNTESTED and do not claim it passes.
10. Do not create production code for a single known application. Use generic discovered interfaces and parameterised actions. If an application requires a native adapter to preserve existing editing fidelity, use a generic adapter mechanism and explicitly prove that the routing itself is brand-independent; keep exception status visible until it meets this requirement.

**STAGE D — ONE COMPREHENSIVE REAL-USER VERIFICATION CAMPAIGN AFTER CODING + DEBLOAT.**

11. Only after implementation and cleanup are complete, inventory every reachable user flow, UI screen/interaction, active file/critical function, authorization boundary, task state, offline/online boundary, browser and desktop agent path, deployment mode and failure recovery. Test the product like a real customer: real saved files, reopen/native fidelity, multi-app tasks, unfamiliar and non-Latin-named installed apps, restarts, crashes, revocation, wrong targets, permission denial, account switching, STOP/Take Over, security, accessibility, performance, memory/idle CPU, corrupted inputs, unreliable networks and independent receipts. Do not repeatedly run one fixed calculator example as a proxy for universal coverage. Include genuine diversity of tools/tasks and negative cases.
12. Use **Android Studio Emulator during this final stage only**; use **Playwright WebKit mobile-device emulation for iPhone/iPad browser/PWA scenarios**, not a physical iOS device. Label WebKit/emulator results as simulated browser coverage; no claim of physical Safari, native iOS integration or background execution proof. Physically untestable/nonshipped features are explicitly BLOCKED or excluded from the declared release scope with truthful product claims, never counted as PASS. Avoid unrelated real-device tests before final stage.
13. Collect all defects into one deduplicated inventory with reproduction and severity, group by shared root cause, repair the smallest owning implementation, then rerun focused checks and the complete affected final suites. Include deterministic/race/adversarial attempts and independently inspect output. **Release blockers require real evidence**, not passing mocks or a single successful demonstration. Repeat until all required tests pass and no known critical/major regression remains.

**STAGE E — MERGE AND REPORT.**

14. Commit small, reversible checkpoints on the working branch; do not merge intermediate work or deploy without the separate release approval. **Merge to main only after the declared P00–P22 release scope is fully coded, donor removal is complete, hardcoded app routing is eliminated or an explicit owner-approved safety-preserving release exception is recorded, debloat has independently verified parity, all required tests are PASS, and there are no outstanding critical/major failures or mandatory BLOCKED/UNTESTED gates.** Do not count emulators as physical-device proof. Production deployment, paid merchant setup and legal clearances retain their separate owner gates.
15. Every short progress report must show: `Current phase Pxx/22`; `Coding %`; `Debloat %`; `Final testing %`; `Overall verified %`; `tracked active files & lines before/after`; `files/lines deleted and net delta`; `PASS/FAIL/BLOCKED/UNTESTED`; `next action`. Calculate percentages from the actual acceptance checklist; no arbitrary estimates or 100% promises.

### 0.2 Specific paused-session evidence and anti-repeat fix

The 11 October paused Claude transcript documents working-branch changes across P01–P16 and debloat; some remain only partially complete. It reports `verify:full` at 15/15 and 1,258 tests passing on one run, but a later full Python run repeatedly opened real apps and exposed `needs_confirmation` failures after user-activity protection. In `jarvis-runtime/tests/test_computer.py`, `test_calculator_by_its_buttons` explicitly launches Calculator, invokes **Clear → Seven → Multiply by → Six → Equals**, then expects **42**. Other Office tests launch native applications. **Those runs must not happen during current coding**. Retain safety and meaningful generic automation coverage behind the final-campaign opt-in, fixing any actual co-work/STOP regression with evidence later. The transcript is a *historical checkpoint*, not a substitute for checking newer code. Preserve already implemented features and never classify failing user-input pause behaviour as a proven environment-only flake without isolating the cause.

### 0.3 No deceptive completion

A full-file source review is a traceable one-time coverage process, not proof that every logical path was executed. Comprehensive final testing covers all reachable behaviour and named risk gates but cannot prove literally zero bugs. If an existing native adapter, protected-app guard, external-provider workflow, software licence or real platform guarantee cannot be removed or verified safely, **do not force unsafe deletion**: report the exact blocker and continue independent work. Accurate blocked reporting is mandatory.

---

Status: **binding target requirements and OPEN implementation packages, not shipped capabilities**. Latest remote main independently checked 10 October 2026: `9b2fe3e40fd915dcf32316e5daa20ed7295f8ffb`. The recovered [coverage checkpoint](docs/audit-checkpoints/20261010/coverage.json) accounts for all 989 historical baseline paths: 957 complete text reads, six empty/generated classifications and 26 structural/binary inspections; this is source evidence, not product verification. No code or production changes are included in this documentation commit.

### 0.4 Verified donor-removal migration — exact GitHub inspection, 11 October 2026

**Latest inspected implementation branch**: `ocade/p00-p22-implementation` at `d90c31c3e2c8374300b6b76520eaf573d85fa47e`; this is an audit snapshot and must be refreshed before deletion. Its tracked `imports/` contained **64 files (~7.73 MB)**, including `imports/UI OCADE JARVIS.zip`, `imports/ocade-jarvis/ocade jarvis 25-09.zip`, the original snapshot and provenance files. These are in the repo tree, not the deployed JARVIS website.

**Confirmed active independent entry points, which must remain intact:** `src/routes/ocade-jarvis.tsx` imports `src/jarvis/JarvisWorkspace.tsx`; `src/jarvis/device.server.ts` imports `jarvis-runtime/ocade_protocol.json`; the local agent starts through `jarvis-runtime/ocade_agent.py` and `ocade_device.py`; Android code lives under `android/`. Inspected routes, agent source, Android, web/agent builds and selected CI jobs do **not** directly import the donor ZIP or original snapshot. This is **source evidence only**, not proof of post-deletion runtime functionality.

**Confirmed mandatory dependency cleanups before committing donor deletion:**

- `src/jarvis/__tests__/source-is-preserved.test.ts` literally hashes both ZIPs, checks the 58-file snapshot and reads `imports/` in several assertions. **Do not delete the whole test.** Replace only those now-retired donor-preservation assertions with donor absence, active runtime ownership and no-donor-runtime-dependency checks. **Preserve** the same test file's checks against locally stored provider keys, legacy desktop GUI return and active adapted capability modules, or relocate each to an existing canonical suite with parity.
- Remove now-stale original-snapshot exclusions from `.prettierignore`, `.gitattributes`, and `eslint.config.js`. Do not delete unrelated ignore or safety rules.
- Reconcile explicit contradictory keep instructions in `AGENTS.md`, `CLAUDE.md`, `ToRemove.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `jarvis-runtime/README.md`, and this `PLAN.md`; update the owning security/licence documentation if relevant. The latest owner mandate authorises donor removal from the active repository, but **not** removal of third-party attribution/rights obligations, unique verified requirements or material needed to rebuild the product.
- Existing `LICENSE` and `jarvis-runtime/LICENSE` remain outside `imports/`; check whether any legally required notices from inside donor archives need a separately retained record. Keep Git history, commit provenance and hashes; **do not force-push or rewrite history**. Removing tracked archives from HEAD does not erase their bytes from earlier commits or clones.
- `jarvis-runtime/ocade_computer.py` currently uses `f"imports/{source.name}"` as a **default folder inside a customer-selected workspace** for the `file_import` action. That is not a reference to the repository donor folder; **preserve working customer-file import behaviour** and distinguish relative workspace paths from repository paths.
- Check all dynamic loaders, test fixtures, documentation links, packaging/installer manifests, copyright/licence obligations and uncommitted changes in the freshest checkout. Replace any genuine runtime dependency **before** removing its source; do not assume this audit proves absence everywhere.

**Retire donor reliance, not functioning OCADE features:** The owner wants no donor ZIP, extracted donor source, UI donor asset or runtime dependency remaining in the active repository; new functionality must be implemented in OCADE-owned modules from current approved requirements, not copied from the archive. Trace any current donor-derived implementation and establish legal clearance or replace/reimplement it independently when required; deleting the ZIP does **not** erase copied code or intellectual-property obligations. Preserve user outcomes, private data boundaries, native file fidelity, STOP and correct recovery throughout the migration. No new donor imports.

**Proof and checkpoint:** Before removal record donor path/byte manifest and source counters; after removal confirm `imports/` is absent from the tracked current tree, review every remaining reference as an intentionally historical string or a genuine unresolved dependency, and record all 64 original tracked file dispositions. Use only non-GUI static/build/isolation checks needed during coding; explicitly reserve full browser, native PC application, Android Studio emulator and Playwright WebKit user-journey proof for the final campaign. If code cannot be verified safely now, report UNTESTED/BLOCKED and preserve an exact rollback commit; never claim "safe" based only on source searches.

---

### 0.5 Stage A/B record and Stage C progress — 11 October 2026 (branch `ocade/p00-p22-implementation`)

**Stage A done** (`9e59e5bc`): all 64 tracked donor files (7,732,547 bytes) removed; manifest in [ToRemove](ToRemove.md); donor licences were the owner's own (kept in `jarvis-runtime/LICENSE`); preservation test replaced by `no-donor-runtime.test.ts` (donor absent, no active reference; provider-key, retired-GUI and runtime-module checks kept).

**Stage B done:** Calculator 7 × 6 test replaced by a synthetic varied-name Windows Forms fixture; every live screen/mouse/window/Office test needs `OCADE_LIVE_TESTS=1` (final campaign). Office edits route by the file type's registered automation server (no `Excel`/`Word` names; adapters `ocade_workbook.ps1`, `ocade_document.ps1`); browsers discovered from the OS; no `.com` guessing; planner prompt names file types. **Recorded exception:** the protected-app denylist (password managers, credential prompts, Windows Security) stays — no generic signal is as strong — now joined by a generic rule (windows hidden from screen capture are protected). Orphan-module and dependency scans: none unused. Active source: 844 files / 131,589 lines at `a41983bd`; 844 / 131,635 after Stage B (+46 net: discovery code and tests).

**Stage C so far:** P01 file-bound evidence (each changed file read back by path); P03 crash-intent journal on desktop and Android; P06 export pages ordered by unique key; P07 cross-tab offline key race fixed (atomic `add`), unreadable turns kept; exchange tolerates an overlong summary or malformed `changed` list (a P04 field that would have stalled agents was found and fixed); P18 "Repeat with new inputs". P05-C (epoch before the allowance await) already present in source. Payments (P20) and release (P21) deferred by owner order.

## 1. Read this first

CARCC is the company; OCADE is the product. Build a website-first assistant at `ocade.in` that delivers independently checked work in the customer's existing applications. Keep Chat, its Auto/Online/Offline Intelligence choices and the approximately 0.6B offline model. Keep JARVIS a separate online-only experience. Never silently route JARVIS to the offline model.

The latest owner-selected initial audience is **Indian students and individual professionals**. The flagship first-value demonstration performs a single verified task across multiple installed PC applications (Excel → Word/PDF). Small agencies and operations teams remain a prospective *paid pilot cohort* to test, not the exclusive customer definition. The first paid outcome hypothesis is a checked weekly Excel report. The next outcomes are client document/PDF packs and authorised browser status collection into a local report. Universal control is the shared capability beneath these workflows; it is not a promise of unrestricted control of every operating system.

The website is the main interface. Native work requires the existing paired companion. No mandatory browser extension, customer MCP installation or app-store dependency. Windows has one tray identity; Android has the guided signed APK and optional bubble. iPhone/iPad initially use Safari/PWA and remote paired-PC work. App Intents require a legitimate installed Apple integration; a PWA alone cannot provide arbitrary App Intents or background native control.

### Authority map

| Concern | Sole active authority |
| --- | --- |
| Ordered implementation, readiness and work records | This file |
| Engineering rules and resumption | [AGENTS.md](AGENTS.md); [CLAUDE.md](CLAUDE.md) only loads it |
| Product, navigation, page/options and commercial requirements | [PRD](docs/PRD.md) |
| Protocols, platform and execution boundaries | [Architecture](docs/ARCHITECTURE.md) |
| Visual tokens and interaction design | [Design system](docs/JARVIS_DESIGN_SYSTEM.md) |
| Security, privacy, operator and legal contracts | [Security](docs/SUPPORT_LEGAL_SECURITY.md) |
| Tests, evidence and release operations | [Testing](docs/TESTING.md) |
| Retirement gates | [ToRemove.md](ToRemove.md) |
| Superseded decisions and provenance | [Decisions](docs/DECISIONS.md) |
| Dated research and inspection inventory | [Research report](OCADE_GLOBAL_AI_COMPETITION_AND_MASTER_REDESIGN.md) |

Historical ledgers, donor documentation and previous PLAN revisions are evidence, not additional instructions. Do not require absent ledgers as startup prerequisites. Retrieve a historical file from Git when its evidence is relevant. Do not turn this plan into another sequence of competing addenda; edit the owning requirement in place and record the decision.

## 2. Evidence and execution discipline

**Stage-specific override:** Section 0 requires cleanup and code completion before the comprehensive test campaign. The per-package testing descriptions below are final acceptance criteria, except isolated non-GUI safety proofs during development. No real apps may be launched by routine checks during coding.

Every item below starts **OPEN** unless a work record supplies current evidence. Source inspection supports a defect hypothesis or implementation description; it does not prove a failing installed workflow. Historical CI passed 1,253 tests and 15 portable gates but its dependency audit failed. This is not a green release baseline. See the report for exact provenance and inspection gaps.

Before each package: fetch main; preserve unrelated changes; record SHA and clean/dirty state; trace all callers of the named authority; reproduce the problem; read its existing tests. Existing symbols are starting points, not permission to edit only the cited lines. New paths explicitly labelled proposed must be introduced only when the current owner cannot accommodate the change clearly.

Implement one root cause at a time. Preserve working behaviour. Run the smallest meaningful regression, sibling paths, relevant real workflow, then an adversarial attempt. Record **PASS / FAIL / PARTIAL / BLOCKED / UNTESTED**, environment, versions, command or interaction, expected/actual result and redacted evidence. A mock passing cannot close a physical-device gate. Do not manufacture a single readiness percentage from unrelated evidence.

Continue independent work when hardware or credentials block one gate; keep the blocked platform out of release claims. Do not claim zero bugs. A release is eligible only when no known Critical/Major defect remains in shipped scope, every required gate has current evidence, rollback is rehearsed and the owner authorises production changes.

### Required work-record format

For every package append a concise record to its section: `SHA; scope; changed paths; reproduced failure; regression; real workflow; negative tests; performance/cost; evidence class; remaining blockers; retirement; rollback; reviewer`. Store test artefacts in the established ignored evidence locations, not a new permanent ledger. Never store customer content, tokens or screenshots without consent and retention rules.

### Global contract for every package

All executable work binds account, device, task, capability scope, confirmation where required, idempotency identity, control epoch/lease and cancellation. Revalidate immediately before mutation, not only at queue admission. Observed local/remote revocation closes admission immediately; unseen remote revocation during a partition is bounded by the short local lease, not magically instantaneous. Use the concrete lease/renewal limits and release tests in Architecture; do not confuse native execution leases with the longer Offline Chat entitlement lease. Restart reconciles durable state before retry. Loss of acknowledgement is **UNKNOWN**, not proof that nothing happened. Concurrent mutations of one document/window/session require one owner. Parallel read-only discovery is allowed within resource limits.

Keep originals or recoverable copies where possible. Undo is capability-specific and may be impossible for an external submission. Never promise universal rollback. Never repeat a non-idempotent effect merely because a timeout expired. STOP blocks new mutations locally without waiting for the planner; an already committed OS action may finish and must be reported truthfully. These rules and the platform/evidence matrix in Testing apply to every package, including UI and commercial work.

## 2A. Earlier owner mandate and source-specific reconciliation — 10 October 2026 (superseded where Section 0 differs)

The canonical owner register in [Decisions](docs/DECISIONS.md) enumerates all **28 previous decisions, the 30 latest selected answers and local-first choices 1A/2A**. These 60 requirements take precedence over contradictory historical product suggestions, subject to actual operating-system permissions and legitimate security boundaries. Historical 49 phases and P00–P22 are provenance/mapping, not new competing instructions.

### The execution model: local customer PC, online planning

- **Online inference is the brain; the authorised customer PC is the hands.** Installed application edits, local repo development, Excel/Word/PDF, CAD, Blender, graphics and video work, OS operations and GUI control execute on a selected paired customer machine. A phone may submit a remote request to that PC. Account/session authority, online AI planning and user-authorised external websites, email, GitHub or Drive are allowed; default remote desktop, hosted project workspace, silent cloud build, cloud render or cloud-computer fallback are prohibited.
- Preserve separate Chat Auto/Online/Offline modes and persistent ~0.6B OPFS Offline Intelligence. JARVIS remains online-only; when the provider goes unavailable, only previously authorised and still-lease-valid deterministic local steps may safely finish. Journal effects and pause requests requiring fresh intelligence/consent. Never route JARVIS to Offline Chat without a newly explicit product decision.
- A planner generates one bounded approved outcome and an authenticated task; local device executes deterministic admitted typed segments. Choose the strongest **installed** app and explain it; ask one focused question only if account/device/file/meaningfully destructive target ambiguity changes the wrong effect. Recommend an installed alternative or a verified official installer, never silently install. Human owns UAC, OTPs, passkeys, CAPTCHA, payments and sensitive consent.
- One physical keyboard/mouse/focus controller owns a desktop session at once. Independent API/COM/CLI/build/render workers may execute concurrently only when their resource/focus effects are truly disjoint, scoped and measurable. Default to background native routes so the user can keep using the computer. Always preserve originals unless explicit in-place authorisation; reconcile uncertain saves and submissions before retries.
- User sees one simple ChatGPT-class interface: Chat · JARVIS · Library, a single natural-language composer, small task card showing selected PC, actual phase and STOP/Take Over; a small non-essential real-data Orb; deeper panels only on demand. Premium calm graphite/white/blue, real skeletons, truthful evidence, accessible responsive states, natural interruptible voice. Promotion/upgrade after real demonstrated value only, transparent free+monthly subscription hypothesis, privacy-controlled sharing and opt-in repeat workflows.

### Audit provenance: independent evidence, not an inflated score

PR #74 review recovered the existing **435 saved +262 carried +292 newly read** records without restarting the audit. The [checkpoint](docs/audit-checkpoints/20261010/coverage.json) preserves exact baseline path/hash/ranges and classification: **957 full text, six empty/generated, 26 structural/binary; zero pending baseline paths**. All original working-copy hashes were checked against the preserved checkout; current unchanged files were verified by exact bytes or explicitly recorded CRLF/LF-only equivalence. The 10 changed documentation files received current diff/consistency review. The original dirty checkpoint SHA-256 `4d7f9e5fb73014911570eae92183278170d37f86867b54735eb561c9d7197a4f` and its bytes remain untouched in that checkout. The archived audit commit `deee395fbf5ed709f18354164ccf5f3788f418c6` still records its historical 382/989; it is not the current denominator. The added checkpoint is outside the 989-path baseline. A binary inspection is not semantic source comprehension or licence clearance, and full source coverage is not runtime proof. At implementation resume, hash current files and inspect only changed/new/uncovered content; P00-A still requires a current reproducible baseline and supply-chain review, and P00-B still blocks distribution until rights and release gates pass.

### Protocol decision and root-cause risks

The present signed command exchange is **protocol v1**; any v2 fields in earlier texts were only drafts. Version 2 retains wire name `protocol` and version-1 canonical signed bytes unchanged. The new `controllerEpoch`, `permissionRevision`, `keyEpoch` values are unsigned 64-bit **canonical decimal strings**, not JS numbers (reject leading zero, whitespace, exponent, overflow, duplicate JSON keys and unsupported critical features). Resolve current protocol field names and signatures solely through [Architecture](docs/ARCHITECTURE.md), changing the established TS/Python/Android schema in one negotiated migration. Reject v2-only work to old clients, stale revisions, wrong digest or account, and ambiguous lease time. No privileged/parallel effect admitted without current authority. Local STOP and final mutation admission must serialize on the same authority boundary; a check before UI target resolution alone cannot prevent a STOP race.

**Source-traced P03/P05/P06 defect hypothesis:** `src/jarvis/device.server.ts:483–507` can produce a success-shaped disconnect envelope after failed database mutations. Reproduce this first, replace the false-success path with durable revocation/readback, and reconcile already claimed commands and local journals. Never delete recovery state or report disconnect as proven without durable proof.

**Source-traced P19 test-integrity concerns:** fixed-account fixtures using `ON CONFLICT DO NOTHING` and unconditional deletion; assertions that catch their own unexpected-success exceptions; SQL NULL counted as true; foreign-key rejection mistaken for CHECK enforcement; schema object/policy existence mistaken for real RLS grants; current-schema tests using obsolete migration-stage assertions; false notification proof contaminated by a test-injected message; emergency STOP interpreted as failing system health; “own browser,” installer, offline model, Android STOP and Office fidelity test names overstating their actual checks; test logs containing recovery codes, tokens or signed links. Reproduce each under isolated fixtures before editing test logic. A test PASS is accepted only when it fails for the actual forbidden behaviour and independently checks the intended postcondition.

### Exact task-work package completion record

For every P00–P22 package, Claude must add an evidence-bound package record **inside the existing package**, not a new master plan: current source SHA and exact files/symbols/callers; reproduced defect or current working behaviour; immutable security/task invariant; KEEP/FIX/ADD/MERGE/REPLACE/REMOVE/POSTPONE disposition; dependency-order code edits; proposed wire/db/API changes; exact UX/permission/account/device changes; STOP/recovery/crash windows; file/process ownership; perf/privacy/billing budgets; unit/real integration/race/failure-injection/hosted/physical cases; independently observed final artifact; compatibility/rollback; deletion/parity gate; evidence class (SOURCE/LOCAL/HOSTED/DEPLOYED/PHYSICAL/RESEARCHED/UNAVAILABLE) and PASS/FAIL/PARTIAL/BLOCKED/UNTESTED. If a symbol is unread or not found, mark proposed NEW and inspect rather than inventing current implementation. No release-ready “10/10” verdict without objective executable evidence.

### High-value application control acceptance and source work order

**P08/P10/P17:** map installed app identity/version → dynamic native API/COM/object model/CLI → scoped native file/project transformation → browser DOM/CDP → Windows UI Automation/accessibility → fresh vision GUI as last resort, choosing by fidelity, safety and latency. A cached recipe is versioned, scoped and independently verified; it cannot contain secrets, private content or reusable screen coordinates or confer privileges. Adobe Photoshop UXP, Fusion SDK, Blender Python API, Resolve scripting, Office COM, IDE/terminal and browser DOM are probeable candidate interfaces, not assumed installed or universally available. For every app family define native action, semantic fallback, GUI contingency, file output predicate, installed version/edition support, refusal and user-visible state.

**P11:** first use is Try Chat → only if requested native work Connect PC → signed installer and device identity verification → human narrow permissions → task on selected PC → independently checked actual files. Chrome 136+ does not honour remote debugging of the default data directory; never promise invisible arbitrary attachment to a user's logged-in profile. Prefer supported existing-profile native/accessibility methods, else explicit isolated managed browser login, preserving external account identity and user consent. No mandatory extension/MCP/store purchase.

**P12:** keep one voice lifecycle with correct microphone acquisition generations, local pre-wake privacy, bounded STT/TTS/audio buffers, cancel late recordings, immediate playback barge-in distinct from task STOP, “what are you doing?” midtask, user redirection after safely draining the old controller, Indian English/Hindi code-switching tests, provider reconnect/session resumption and zero claim of perpetual background mic on unsupported platforms.

**P15:** each actual route/control needs exact idle/loading/denied/executing/verifying/completed/partial/unknown/empty/error/resumed state; keyboard/focus/IME/zoom/a11y and screenshots at 320/360/390/480/768/1024/1280/1440/1920px dark/light. Orb 64px desktop / 48px phone, real-data graph 240–480px on request, initial 60 visible nodes total, accessible list equivalent, no hidden continuous animation; STOP always usable. Colour tokens, component geometry, motion, route options and every menu/control contract live only in Design and PRD, not duplicate state stores.

**P18/P20:** first conspicuous demo is **one naturally requested goal spanning multiple installed PC programs**, exemplified by Excel → editable Word/PDF with independent totals/native-file verification and intact originals. Test student/individual and professional-operations paid willingness-to-pay without prematurely declaring pricing. Free allowance + predictable monthly subscriptions only after licensed merchant/legal/payment gates. Repeat successful workflows with clear consent; history reports actual verified outcomes and measured time, no fabricated productivity claims; permissioned professional sharing and privacy-controlled shareable output. No dark patterns.

### Strong candidate benchmarks, not existing results

Record paired legacy OCADE versus changed OCADE on the exact same Windows machine, input set and permissions; optionally test runnable competitors fairly. Pre-register mandatory outcomes. Track actual verified completion, wall time p50/p95/p99, local dispatch/admission, model calls, network, disk flush, CPU/RAM, voice latency, unnecessary interventions, recovery rates, account privacy, supported edition and cost per *verified completed task*. Existing proposed microbench targets: 100 warmups/1,000 warm trials; local admission p95 ≤10ms; warm capability cache p95 ≤5ms; queue handoff p95 ≤20ms; local STOP recognition p95 ≤50ms. Application/model/network/verification durations are separate real costs that must also appear in the end-to-end result. These are **unproven budgets**, not guaranteed speed claims. Run comparable mandatory fixtures: Excel→Word/PDF, browser account chooser/status export, VS Code safe code edit+real tests, unfamiliar app, background job while user types, GUI STOP barrier, save/ack loss, device/account revoke, voice redirect, remote phone→paired-PC reconnect. Competitors with no run are UNKNOWN, not defeated.

### Newly verified competitive benchmark and local containment experiments

**P18/P19 benchmark research (not OCADE scores):** WindowsWorld (ACL Findings 2026) studies 181 multi-step tasks across 17 desktop applications, about 78% multi-app, with intermediate sub-goal evaluation. Its paper reports studied agents below 21% success on multi-app tasks in its particular simulated benchmark. Instead of copying a headline number into OCADE ratings, select relevant author-provided fixtures or design paired local equivalents: ≥2 and ≥3-app workflows, process checkpoints, wrong-input/focus perturbations, actual final editable output and failed/recovered states. Benchmark the user's own installed-app worker; record whether the benchmark runs on a VM or physical Windows, and do not generalise an author result to OCADE superiority. See https://aclanthology.org/2026.findings-acl.750/ and https://github.com/HITsz-TMG/WindowsWorld.

**P08/P11/P19 local isolation research:** Microsoft's Windows Developer Blog dated 7 October 2026 describes Microsoft Execution Containers (MXC), including lightweight process containment and Windows 11 session containment (separate desktop, input, clipboard and account). Consider it as a **conditional** supported path for high-risk model-authored scripts and user-disruption-free GUI work, never a mandatory dependency or a cloud desktop. Discover OS version, availability, exact SDK/backend, resource-policy enforcement and user-session/account implications before using. The public `microsoft/mxc` repository expressly warns that early-preview SDK profiles can be overly permissive and should **not** be relied on as security boundaries. Require independently tested policy-denial and isolation before enabling; preserve legacy local UIA/native path for unsupported machines. See https://blogs.windows.com/windowsdeveloper/2026/10/07/microsoft-execution-containers-policy-driven-containment-for-ai-agents/ and https://github.com/microsoft/mxc.

**P08/P17 competitor-engineering idea:** Microsoft Research's UFO2 documents app-specific APIs, hybrid UIA+vision and speculative multi-action plans, with optional isolated picture-in-picture desktop. Adapt only its performance/targeting concepts into the existing OCADE broker. Do not introduce a second planner or require Windows features that are absent on user devices. See https://www.microsoft.com/en-us/research/publication/ufo2-the-desktop-agentos/.

### Documentation and legal gates

Preserve original donor ZIP and immutable source snapshot; do not execute commercially restricted Mark-LV derivatives. Pinned JARVIS demo code being MIT does not license its audio/fonts/models. Reuse technical principles with attribution where applicable. Source/artefact licence clearance stays per component.

**Documentation stage only** permits PLAN and established specialist Markdown corrections, validated retirement of purely redundant Markdown, commit/PR and merge **only after applicable checks pass**; it prohibits code/test/config/migration/lockfile/infrastructure/customer-data changes and production deployment. Preserve saved audit branch and local dirty file; never silently reset it. Do not delete source, prior applied migrations, donor evidence or essential historical references. Remote CI dependency audit may be red: do not suppress or waive it to merge; if checks fail, leave the PR open with exact blocker. No blanket deletion just to minimise documentation count.


## 3. Target architecture and contracts

`request → online planner → typed outcome contract → permission/admission → bounded local segment → independent readback → durable receipt → task settlement`

Reuse `src/jarvis/agent.ts`, `protocol.ts`, `live-deps.ts`, `task-authority.server.ts`, `device.server.ts` and the existing Python/Android executors. Keep Supabase as the durable account/task authority and Cloudflare Workers/R2 as the current web/release platform. Do not introduce a second planner, queue, relay, installer, cancellation service or agent framework.

Execution preference is task-specific: supported application API/object model or safe file operation; native OS/script; browser DOM or accessibility; OS accessibility; fresh vision/coordinates. A direct file transformation is not preferred when it would lose macros, formulas, native project structure or metadata. Reuse the Office adapters behind the common broker where they preserve fidelity.

The canonical proposed wire types are `ExecutionEnvelope` and `StepReceipt` in [Architecture, section 4](docs/ARCHITECTURE.md#4-protocol-and-bounded-local-execution). This plan deliberately does not define competing types. Use `batchId`, string `controllerEpoch` and `permissionRevision`, and separate effect/execution/verification fields. Extend the established validated protocol and check cross-language parity from one schema. A segment in this plan means that same bounded batch, never a second transport abstraction. Do not send unvalidated model JSON directly to an executor.

Use server-issued identity/scope, not model-supplied account IDs. Preserve current canonical method/path/device/timestamp/body-digest signing and replay/clock checks. Proposed key ID/nonce/expiry fields require an explicitly negotiated additive signing revision; they are not existing v1 fields. Segment capability and signature-version negotiation must agree, retain old-client v1 compatibility and persist any new replay state. Do not weaken existing checks while adding fields. Enforce count, payload-byte, output-byte, wall-time and tool-specific CPU/memory ceilings before admission. Start at the existing 12-step maximum; adjust only after measurement. A sequence is not an arbitrary script. Explicit command capability remains separately scoped and confirmed when required.

Persist one result per `(device_id, task_id, batch_id, step_id)` with request digest and epoch. Duplicate same digest returns the recorded state; duplicate key with different digest is rejected. Add forward migrations only after inspecting the existing action/checkpoint schema. Use an atomic transaction for claim/lease transition; unique constraints alone do not establish execution ownership. Keep the current task/action tables as authority; add columns or a narrowly scoped child journal only if needed for multiple steps. Maintain old single-action compatibility until both server and installed agents negotiate support.

```text
received -> validated -> admitted -> executing -> verifying -> verified
                           |            |             |
                           +-> cancelled/failed/partial/unknown
```

The conceptual task-state diagram does not erase orthogonal effect state: a cancelled execution can still have an applied/partial effect and pending verification. Write and durably flush intent before the effect. Check epoch, deadline, permission and STOP immediately before each mutation. Write the observed outcome before acknowledgement. On restart, read the journal and independently inspect the effect before deciding whether to replay, compensate or ask the user. Keep model conversation state distinct from effect state.

### Proposed performance budgets, not measured claims

On a documented reference Windows machine, measure 1,000 warm local trials after 100 warmups: admission overhead p95 ≤10 ms; warm capability lookup p95 ≤5 ms; local queue handoff p95 ≤20 ms; local STOP recognition-to-token p95 ≤50 ms and prevention of the next admitted mutation. Report p50/p95/p99 and worst case. Measure durable flush separately and include it in end-to-end action time. Never omit it to meet the dispatch number.

Remote STOP shows requested, received, then quiescent; connected-device acknowledgement target p95 ≤1 s, with network/device conditions recorded. Disconnected devices cannot promise remote immediate stop: admission leases expire and local STOP remains usable. Application completion, rendering, model generation, network and verification times are separate spans. Target ≥50% lower p95 verified workflow time and ≥40% lower model cost than OCADE's old path on paired fixtures; these are trial targets, not competitor claims.

## 3A. Final 1A/2A/3A product decisions — 10 October 2026

- **1A — Orb:** restrained 64 px desktop and 48 px phone, requested expanded graph with real authorised data, keyboard/list alternative and zero hidden idle animation (see [Design](docs/JARVIS_DESIGN_SYSTEM.md)).
- **2A — depth before breadth:** first qualify locally installed Excel, Word, PowerPoint and browsers, then the same broker must support VS Code/Git, CAD/Fusion, Blender and professional media. Retain deep long-term families, not scattered agent engines.
- **3A — flagship:** one real task runs Excel → Word/PDF with two installed applications where applicable, preserves editable originals, reopens/checks formulas, layout and native outputs and measures all customer interventions, timing and cost.

All previous 60 owner choices remain binding. India-first students and independent professionals are the initial research/activation segment, with agencies/business operations a separate validated paid cohort. Online model planning is allowed; substantial project work occurs only on the customer's selected authorised PC. Trustworthy first-use value, voluntary repeats and sustainable subscriptions are goals—not guaranteed revenue forecasts.

### Competitive evidence rule

Dated research and licence decisions are retained in [Global AI Competition](OCADE_GLOBAL_AI_COMPETITION_AND_MASTER_REDESIGN.md). For any claim of superiority, require matched fixture and independently verified output, time, cost and safety results. UNKNOWN/UNAVAILABLE is not a win.

## 3B. Fast PC execution: measurable design

**How fast PC control will work (target, not yet proved):** OCADE's online AI plans once; the paired, authorised **local Device Agent** validates and executes bounded, deterministic action segments on the customer's PC (P08), with durable receipts, independent result checks and immediate local STOP. P09 uses authenticated event wakeups, retaining recovery polling; no cloud/model round trip for each local click after a segment is admitted. **Choose the fastest safe interface per application:** (1) native APIs/object models such as Office COM, installed-app scripting, CLI and scoped file operations; (2) authorised browser DOM/Playwright/CDP where supported by the selected browser/profile; (3) Windows UI Automation/accessibility; (4) fresh screenshot/vision-guided **PyAutoGUI-style** mouse/keyboard fallback only when structured interfaces cannot perform the task. Do not add Playwright/PyAutoGUI as duplicate runtimes or assume access to a customer's ordinary signed-in Chrome profile. Never store/replay stale screen coordinates. Batch only independently admissible steps, keep one foreground input owner, preserve existing permissions and verify real outputs. Measure p50/p95 latency, local resource cost and failure/recovery against the old path; “super fast” is a goal, **not** a verified claim. Existing implementation owners and P01–P17 dependencies remain authoritative.

### 4.1 Current source baseline

The current source establishes:

| Mechanism | Current setting or behaviour |
|---|---|
| Active Device Agent exchange | Approximately one-second cadence |
| Dormant exchange | Five-second cadence |
| Control-loss cancellation | Fifteen seconds |
| Planner action wait | 120 seconds |
| Office job timeout | 180 seconds |
| Planner sequence | Up to 12 actions, still dispatched through individual `runDevice` calls |
| Legacy task ownership heartbeat | Sixty seconds |
| Browser frame panel | Separate 1.5-second polling |
| Web action changes | Realtime wake-up with bounded polling fallback |

The 120/180-second deadline mismatch must be fixed. Do not treat a still-running Office job as harmlessly failed and start another effect.

The current PC is a useful reference fixture: Windows 11 build 26200, i5-1135G7, 15.6 GB RAM, Office `16.0.20326.20144` x64, Chrome `154.0.8037.95`, Edge `153.0.4234.32`. Availability is verified; performance is unmeasured.

### 4.2 Instrumentation

Add measurement points to existing owners:

| Span | Start/end |
|---|---|
| UI response | Input gesture → visible acknowledgement |
| Planning | Accepted model request → validated segment |
| Server admission | Authenticated request → durable admission |
| Transport | Command available → device receipt |
| Local validation | Received segment → admissible step |
| Lock wait | Resource request → acquired lock |
| Native execution | Final admission → application returns |
| Verification | Examiner start → predicate result |
| Settlement | Receipt submission → durable acknowledgement |
| STOP | Local recognition/request → rejection of new mutations; separately measure quiescence |

Use monotonic local clocks for durations. Do not subtract unsynchronised server/device timestamps to invent precise transport latency.

Trace only scoped IDs, operation classes, timings and redacted failures by default. Exclude private document contents, secrets and raw screenshots.

### 4.3 Local segment limits

Initial proposed limits:

- Maximum 12 typed steps.
- Maximum 256 KiB segment metadata.
- Maximum 64 KiB structured receipt per step; larger evidence stays local behind a scoped reference.
- Maximum 30 seconds for a cooperative fast segment.
- Office jobs use separately declared deadlines up to the existing 180-second bound.
- Long renders are separate durable jobs with declared deadlines and cancellation limitations.
- Initial maximum two proven-independent background jobs.
- One controller for the shared interactive GUI session.
- Explicit locks for each mutable file/workbook/project and shared application session.
- Mutation volume limits per adapter; 12 steps must not conceal millions of writes.

Before every mutation: check current epoch, cancellation, lease, permission revision, resource identity, lock ownership and observation freshness.

### 4.4 Delivery choice

Implement in two ordered steps:

**P08:** retain the existing exchange transport and execute admitted segments locally. This removes unnecessary per-step server exchange while preserving the control receiver and durable receipts.

**P09:** extend the same broker endpoint with a negotiated authenticated wake stream. The stream carries minimal wake/heartbeat metadata, never executable commands or permission grants. The device fetches durable work through the normal signed exchange after a wake.

Use the existing Workers/Supabase owners; do not create a second relay or queue. Keep bounded jittered polling as recovery. Expired/revoked streams stop; they cannot renew action permission.

Before enabling wake streams, prove:

- Correct device/topic binding.
- Revocation and expiry.
- No account token or service key on the device.
- Lost/duplicate/reordered wake recovery.
- Worker restarts and connection-limit behaviour.
- Lower measured idle request/resource cost.
- No safety regression.

Supabase Realtime access needs explicit authorization; subscription success alone is not proof of allowed data or prompt revocation. Workers’ connection/runtime limits must be tested on the actual deployment. [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

### 4.5 Proposed performance gates

These are targets to test, not reported results.

| Metric | Initial gate |
|---|---|
| Local UI acknowledgement | p95 ≤100 ms |
| Local validation/admission overhead | p95 ≤10 ms, excluding network and durable storage |
| Local rejection after STOP | p95 ≤50 ms |
| Voice playback interruption | p95 ≤150 ms after recognised local interruption |
| Connected wake/remote control | Target p95 ≤1 second after event transport passes qualification |
| Fast segment overhead | Lower p95 than matched legacy execution, identical output/safety |
| Hidden Orb | Zero continuous animation frames |
| Idle Device Agent | Target <0.5% of one CPU core, excluding optional wake listening |
| Agent memory | Separate broker, browser, Office and wake allocations; no unexplained growth over repeated tasks |
| Private project transmission | Zero unconsented project bytes |
| Recovery | No blind duplicate write; every uncertain operation remains visible |

Publish planning, application load, rendering, human handoff and verification time separately.

### 4.6 Measurement procedure

1. Freeze source SHA, app versions, power mode, hardware and fixture hashes.
2. Run identical legacy and new operations.
3. Separate cold start, warm start, first execution and verified recipe repeat.
4. Use thousands of nonmutating local dispatch samples for broker percentiles.
5. Use repeated real application fixtures for workflow timing.
6. Report sample size beside p50/p95/p99; do not advertise reliable tail behaviour from a handful of runs.
7. Include failures, retries, verification time and human correction.
8. Inject STOP, network partition, sleep and process death at specified barriers.
9. Compare output and collateral changes before accepting faster timing.
10. Treat a speed improvement that weakens verification or takeover as FAIL.

## 4. Ordered implementation packages

Order: P00-A → P01–P07 → P08–P12 → P13–P17 → P18 → P19 candidate gate → P20 → release-scope P22 cleanup → final P19 rerun plus P00-B → P21. Later P22 expansion is separately gated. Independent reads/tests can run in parallel. Mutating the same authority needs one owner. P18 workflow prototypes can begin after P07, but paid release waits for all relevant platform, security and commercial gates. Do not delay safety repairs for visual redesign.

### P00 — Establish a trustworthy baseline and supply-chain gate

**Documentation review checkpoint (10 October 2026):** Source-coverage reconciliation is now recorded in the linked checkpoint; do not repeat its hash-equal reads. Required merge security gate remains **FAIL**: `npm audit --package-lock-only --omit=dev --json` reported `seroval@1.5.6` (critical; [GHSA-p6vx-979v-rg4c](https://github.com/advisories/GHSA-p6vx-979v-rg4c), plus [GHSA-jp82-f5mq-hwhp](https://github.com/advisories/GHSA-jp82-f5mq-hwhp)) and `source-map-js@1.2.1` (high; [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)). This is a lockfile/advisory result, not a demonstrated deployed exploit. No dependency, lockfile or product changes were made. Claude's first implementation action is P00-A: resolve these through the minimum compatible dependency repair and required checks, then proceed to the first unmet safety dependency. Documentation PR merge remains blocked until its required checks pass.

**KEEP** package-lock, pinned workflow actions, existing portable verification. **REPLACE** the assumption that green unit tests imply green CI. Inspect `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, all release workflows, `scripts/verify-full.mjs`, `scripts/deploy.mjs` and `jarvis-runtime/LICENSE`. Current historical audit failures concern production dependencies including seroval and source-map-js; resolve against current advisories, not a guessed fixed version.

1. Re-run the exact lockfile audit in an isolated development checkout, save advisory IDs and dependency paths. Choose the minimum compatible patched transitive/direct release; do not blindly use force-fix or waive critical findings.
2. Run the existing full portable gate, installed-runtime tests and affected production build; inspect bundle/secrets and lockfile diff. Add the same dependency audit to the deployment gate so a manual release cannot bypass it.
3. Audit donor snapshot licences and adapted active code. FatihMakes' current Mark-LV is non-commercial; that does not establish the older snapshot's licence. Preserve originals. Obtain permission or replace restricted derived implementation before distributing commercially. Do not infer permission from public GitHub visibility.
4. Record known defects P01–P07 and coverage gaps before changes. No migrations, credentials or production actions merely to establish baseline.

**Two gates:** P00-A is the recorded current baseline, dependency/licence findings and safe development scope; it unlocks isolated safety repairs even when distribution is blocked. P00-B requires exact source and installed package identities, no unexplained required gate failure and completed licence clearance for shipped code/models/assets. All later implementation dependencies on P00 mean P00-A; public distribution requires P00-B. If permission remains unavailable, distribution of affected code is BLOCKED. **Rollback:** revert dependency change and withhold release, never suppress audit. **Cost/platform:** portable tests first, installed Windows proof separate; no paid service required. **Retire:** obsolete vulnerable versions only after lockfile/build parity.



#### Detailed ordered implementation supplement — P00

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Preserve the dirty checkpoint before any reconciliation.
2. Reverify refs and hash identities.
3. Merge the 262 carried and 292 new inspection records without rereading unchanged files.
4. Record 957 text, six empty/generated and 26 structural/binary classifications separately.
5. Preserve CryptoJS as structural inspection, not licence-cleared source.
6. Reconcile all requirements, historical phase registers and current findings.
7. Inventory shipped components/assets and component licences.

**Target DONE:** counts/hashes/ranges reconcile; documentation is source-backed. Distribution remains blocked for unresolved shipped rights.

**Work record — P00-A (11 October 2026):** SHA base `d70484da`, branch `ocade/p00-p22-implementation`; Windows 11, Node 24.16.0, npm ci. Production audit `npm audit --package-lock-only --omit=dev`: **PASS** (0; seroval/source-map-js fixed by #75 overrides). Dev-only audit: **FAIL/accepted-open** — `sharp <0.35.5` high ([GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)) via `wrangler 4.145.0 → miniflare`; only fix `wrangler 4.149.0` was published 2026-10-08, under the two-week supply-chain age floor; recheck after 2026-10-22. Baseline `verify:full` on main: **FAIL** at `format:check` (three docs); fixed by Prettier, whitespace/emphasis only. Deploy gate gap: `scripts/deploy.mjs --execute` built and uploaded without any dependency audit; it now runs `npm audit --omit=dev` first and stops before build (test fails without the change). After: `verify:full` **PASS** 15/15 gates, 1258 tests; Python runtime 181 PASS/3 skipped. Known flakes (UNTESTED root cause): `staff-authority.test.ts` "unverified address" failed once in three full runs (grant returned an error, not reproduced in 6 isolated runs); `test_computer.py::test_click_needs_the_current_observation` failed once in a `-x` run, passed alone and in the full run. Licence clearance (P00 step 3) and P00-B: **BLOCKED** on owner rights decisions. Evidence class LOCAL.

### P01 — Make task completion depend on independent evidence

**Current:** `src/jarvis/agent.ts` handles `finish_task` around lines 633–654 and can adopt model completion without a mandatory durable verifier receipt. Prompts already ask for verification; wording alone is insufficient.

**ADD** typed outcome predicates in `protocol.ts`; **REPLACE** `finish_task` with a request to settle. Wire `agent.ts` → `live-deps.ts` → `task-authority.server.ts` so the server validates receipt identity, scope, contract digest, terminal state and required predicate coverage before it stores `completed`. Keep an outcome contract immutable once effect execution starts; a changed user goal creates a new version and invalidates obsolete completion evidence.

File predicates include path scope, content digest, parse/open result, required sheets/ranges/values and preservation constraints. Browser predicates use a newly observed server-side record ID or independently queried persistent state, not button text alone. Creative predicates include reopenability, native project structure and requested render/export properties. Content quality can require human review; label it separately from structural verification. A second language model using the executor's narrative is not independent proof.

Use the existing device read/inspect actions for readback in a fresh observation context. Keep verifier credentials read-only where the platform permits. The task authority rejects executor changes to the approved outcome contract and mismatched evidence digests. Initial independent readback protects against mistaken model/tool completion under a trusted broker/device, not malicious scripts with equivalent OS privileges. A same-user process may alter files, verifier code or keys. Stronger workflows require demonstrated OS process protection/read-only verification credentials or independently queried service state; unconstrained script results remain broader-trust/unverified until containment is proved. Signing alone does not establish independence.

**Failure:** missing/contradictory evidence → partial/unknown, preserve artefact, bounded re-observation; no blind repeated write or fabricated evidence to make the verifier pass. A newly admitted bounded repair after independent observation is allowed within authority; an uncertain irreversible action is never blindly replayed. STOP during verification yields cancelled/partial with known effects, not rollback fiction. **Tests:** extend `src/jarvis/__tests__/agent.test.ts`, `device-protocol.test.ts`, `carry-on.test.ts`: lying finish, stale/wrong-task receipt, omitted predicate, digest mismatch, crash after save and before acknowledgement, unreadable artefact. Real Excel reopen and independent recomputation must agree. **DONE:** no terminal completed path bypasses required receipt. **Cost:** deterministic verification first; no default extra model call. **Rollback:** disable new task admission if settlement cannot be trusted; never restore model-owned completion. **Depends:** P00. **Retire:** old direct completed assignment after all callers migrate.



#### Detailed ordered implementation supplement — P01

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Owners: `runJarvisTurn`, `changeTask`, `queueTaskAction`, `exchange`, local executors.

1. Freeze the output predicates before execution.
2. Replace the direct `finish_task` → `completed` assignment with a verification request.
3. Add effect/execution/verification fields.
4. Bind evidence to the exact task/device/resource/outcome.
5. Aggregate mandatory predicates through trusted code.
6. Emit final completion and commercial settlement only through that gate.

**Tests:** lying model, omitted predicate, wrong digest/device/account, unreadable output, contradictory examiner, crash after save.

**Rollback:** disable affected mutation admission; never restore model-owned proof.

**Work record — P01 phase 1 (11 October 2026, branch `ocade/p00-p22-implementation`):** Reproduced: `agent.ts` and `background.server.ts` each turned `finish_task` straight into `completed` (two copies of the same transition). **FIX:** one `finishChange` shared by both loops; `changeTask`, the single status owner, now refuses `completed` (error prefix `NOT_VERIFIED`) unless every task action has settled and a successful read-only action (file_info, sheet_inspect, observe, ui_inspect, …) ran on the same task after its last change; refused steps that never ran are ignored. The open loop returns the refusal to the model; Background Mode records it and plans again. Prompt states the rule. Tests: 5 real-Postgres cases (lying finish, unsettled action, change after read, failed read, honest path) and an agent-loop case that fails without the fix; jarvis suite 195 PASS. Still OPEN: typed per-outcome predicates (digest, sheets/ranges, reopen), crash-after-save reconciliation, commercial settlement through the gate, real Excel reopen. Evidence class LOCAL.

### P02 — Close STOP, takeover and stale-observation races

**Current:** Python `ocade_computer.py` passes semantic actions to `ocade_accessibility.py` without propagating cancellation to the final effect; Android control can resolve a target after an earlier STOP check. `OcadeAccessibility.java` does not currently provide the complete observation invalidation needed by `Control.java`.

1. Thread the existing cancellation token/control epoch into every native semantic mutation and final coordinate/gesture dispatch. Add the final check immediately before Invoke/Toggle/SetValue/Focus/click, including accessibility fallbacks that synthesize physical input.
2. In `ocade_device.py`, `ocade_computer.py`, `ocade_accessibility.py`, `android/src/in/ocade/app/Control.java`, `OcadeAccessibility.java` and `AgentService.java`, bind targets to application/window identity, observation generation, geometry/DPI/orientation, role/name or safe fingerprint and age. Invalidate on accessibility/window/scroll/navigation/overlay/focus/user-input events. Re-observe after takeover, never replay stale coordinates.
3. Keep physical input pause except explicit co-work. One input owner at a time. STOP must release held keys/buttons and terminate only task-owned cancellable processes. OS-dispatched gestures or application saves may be non-cancellable; report that boundary. A cancelled latch alone does not prove Android cancelled the gesture.
4. Change `src/jarvis/stop-everywhere.ts`, `live-control.ts` and the UI only as needed to distinguish request, device acknowledgement and quiescence. Persist epoch increments so reconnect cannot resurrect old work. No cloud model call in the local stop path.

**Tests:** barrier-controlled STOP between resolve and Invoke; permission withdrawal immediately before effect; physical user click during semantic fallback; rotate/scroll/overlay between screenshot and tap; stale resume; disconnected remote STOP; crash/restart with revoked epoch; no mutation admitted after cancellation. Extend runtime `test_safety.py`, `test_ui_act.py`, `test_computer.py`, web execution-control tests and real Android instrumentation. **DONE:** races reproduced then prevented; local latency budget measured; UI does not claim quiescence without evidence. **Cost:** event generations, not continuous full screenshots. **Rollback:** disable unsafe input capability, retain read-only/status. **Depends:** P00; P01 for truthful terminal state. **Retire:** preflight-only cancellation checks after final-point checks cover every path.



#### Detailed ordered implementation supplement — P02

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Owners: `Agent.stop_everything/_start`, `Computer.run/_screen`, accessibility `act`, Android control.

1. Propagate the operation/cancellation token to final native/UIA/gesture boundaries.
2. Recheck after target resolution and immediately before effect.
3. Bind observations to app/window/DPI/geometry/generation.
4. Remove `cowork` as a physical takeover exemption.
5. Release only task-owned held input/processes.
6. Reconcile in-flight noncancellable effects.
7. Revalidate all state before Continue.

**Tests:** barriers between resolution and Invoke; physical click; stale screen; permission revoke; delayed resume callback.

**Target DONE:** no newly admitted mutation after cancellation; quiescence and latency measured separately.

**Work record — P02 phase 1 (11 October 2026):** Reproduced by source trace: `ocade_computer` called `ocade_accessibility.act` without the cancel token, and Android `Control.act` resolved and pressed its target with no STOP check (the screen paths already checked). **FIX:** both now check STOP immediately before Invoke/Toggle/SetValue/click and before the touch fallback, and refuse a control observation older than 60 s (the screen observation limit). Desktop tests: STOP and stale-age cases fail without the fix, `test_ui_act.py` 5/5 PASS; Android compiles (`build.py`), emulator proof deferred to the final test stage (UNTESTED). Still OPEN: control epoch on the wire, window/DPI/orientation binding for UI refs, invalidation on accessibility events, measured STOP latency. Evidence class LOCAL.

### P03 — Preserve commands and outcomes across identity rotation and restart

**Current:** `ocade_identity.py` rotation consumes an exchange response but can ignore its command list, while `device.server.ts` can still dispatch actions in that exchange. Desktop results are more durable than Android's in-memory pending results.

Choose one explicit protocol: rotation-only exchanges must not claim work, and the client persists the new key before a normal work exchange. Bind acknowledgement to the rotation request; support a bounded pending-key recovery transition that preserves immediate rejection of the revoked old key; no dual-key grace authorises work without treating a lost response as a new identity. Trace `rotate`/exchange callers and server dispatch before changing the schema. Preserve queued and running work; rotation cannot reset idempotency state.

Extend `ocade_identity.py`, `ocade_device.py` (desktop loop/journal), `ocade_agent.py` (lifecycle), `src/jarvis/device.server.ts` and Android `Identity.java`/`AgentService.java` with durable result storage using the existing desktop journal approach and Android app-private transactional storage. Acknowledge server receipt before removing local results. Write intent before effect; the unresolved crash window requires P01 readback, not a claim of exactly-once execution.

**Tests:** queued action during rotation; running action during rotation; response loss before/after persisted key; old key replay; duplicate result acknowledgement; process kill after effect and before acknowledgement; Android restart with pending result. Extend `test_agent.py`, `device-exchange.test.ts`, Android lifecycle tests. **DONE:** no lost claimed command and no duplicated external write across the fault matrix. **Resources:** bounded journal retention after server acknowledgement, encrypted/scope-safe where needed; no screenshot journal. **Rollback:** stop new dispatch on incompatible protocol, retain recovery records and old executable for supported rollback. **Depends:** P01/P02. **Retire:** in-memory-only authoritative pending results and ambiguous rotation response path.



#### Detailed ordered implementation supplement — P03

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Owners: `_load_pending`, `_keep_pending`, `_exchange_loop`, `Identity.exchange/rotate`, Android `AgentService`.

1. Persist intent before effect and result before send.
2. Extend the existing journal owner; use transactional local storage rather than another service.
3. Require explicit per-operation acknowledgement and matching digest before retirement.
4. Preserve unknown/missing acknowledgements.
5. Make key rotation an acknowledged recoverable transition.
6. Preserve unresolved results across revoke, update and process death.
7. Reconcile effects before retry.

**Tests:** crash at each boundary; lost ACK; partial result batch; old/new key disagreement; corrupt journal.

**Work record — disconnect false success (11 October 2026, partial P03/P05/P06):** SHA base `d70484da`. Reproduced the §2A hypothesis: `exchange` with `forget` ignored all three write errors and returned a success envelope; tray Pause/Resume ignored their write errors too. **FIX:** forget ends activity and tasks first, revokes the key last with `.select("id")` readback, and throws on any error or zero revoked rows, so a failure leaves a key that can retry; Pause/Resume throw on write error. Desktop uninstall still removes the local key (required) but now says when OCADE did not confirm the disconnect. Regression `device-exchange.test.ts`: 5 new failure-injection cases fail on the old code and pass on the fix (26/26); `test_agent.py` uninstall cases PASS. Android `disconnectPhone` now says when OCADE did not confirm (compiles; emulator UNTESTED). Evidence class LOCAL (real PostgreSQL twin).

**Work record — rotation and durable Android results (11 October 2026):** Reproduced: a rotation exchange (`ocade_identity.rotate`, empty results, no `running` list) went through full dispatch and could claim a queued command whose reply the client discards; the command then sat claimed until timed out as failed, and work could be handed out while another action ran. **FIX:** a rotation-only exchange rotates and returns with no claims and no cancel judgement (real-Postgres test fails on the old code). Android `AgentService` results were memory-only; they now persist in an app-private `AtomicFile` on every change, load on start, keep a damaged file aside, and leave only after OCADE's acknowledgement — the desktop journal's rules. Android compiles; restart-with-pending-result emulator proof deferred (UNTESTED). Still OPEN: intent-before-effect for an action interrupted by a crash, per-operation digest acknowledgement, bounded pending-key recovery tests.

### P04 — Treat partial Office/file effects honestly

**Current:** `actions/ocade_excel.ps1` and `ocade_word.ps1` can mutate/save before readback throws; `ocade_computer.py` relies on `maybeChanged` to expose recovery. Existing backups in `ocade_sheets.py` and `ocade_documents.py` are valuable and must remain.

Set mutation-started before the first workbook/document change and propagate `maybeChanged`, resource identity and backup reference through every exception, timeout and cancellation path. Distinguish newly opened task-owned application instances from a user's already open documents. Never kill a shared Office process to cancel one job. Save to a new output copy unless overwrite is explicit. Preserve macro-enabled formats, formulas, names, charts, styles, metadata and linked resources; an unsupported library conversion must refuse or request an explicit fidelity downgrade.

Use the existing shared Office job machinery. Reopen the actual saved output with the appropriate application after save; read required cells/styles/page properties independently. Align UI waiting time with job heartbeats and tool-specific execution deadlines: the current foreground wait can end before a valid longer Office operation. A timeout means unknown/partial until reconciled. For large file copy/move in `ocade_computer.py`, add chunk-level cancellation or use a cancellable native operation, temporary destination and atomic final rename where supported. Preserve source until destination verification succeeds; cross-volume move is copy-plus-verify-plus-delete, not an atomic rename.

**Tests:** save succeeds then verification fails; exception after sheet addition; STOP during copy; disk full; locked workbook; user edits while task waits; macro preservation; formula recalculation; 2 tasks same file; failure restoring backup. Extend `test_sheets.py`, `test_files_documents.py`, real Excel/Word fixtures. **DONE:** receipts never say unchanged after known mutation; copies reopen and unrelated content matches baseline. **Cost:** bounded batch reads/writes, no cell-by-cell model calls. **Rollback:** restore only after checking no subsequent user change; otherwise preserve both versions and explain. **Depends:** P01–P03. **Retire:** duplicate backup mechanics only after shared parity proof, not the native Office adapters.



#### Detailed ordered implementation supplement — P04

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Owners: `backup`, `office_job`, `edit_with_excel`, Word adapter and native scripts.

1. Resolve exact file/application identity.
2. Create verified task-owned working copies.
3. Acquire resource/application locks.
4. Apply typed native operations.
5. Record mutation before later verification.
6. Reopen and independently check the output.
7. Restore only when no later user change would be overwritten.
8. Preserve both versions when restoration is uncertain.

**Tests:** macros, multiple sheets/workbooks, protected files, disk full, late STOP, user edits while paused, save/ACK loss.

**Work record — P04 phase 1 (11 October 2026):** Reproduced by source trace: `ocade_excel.ps1`/`ocade_word.ps1` save before read-back and reopen; a throw after `Save()` reported "failed" with no `maybeChanged`, and `_unfinished` then told the planner "not changed". A failure on the person's own open workbook left applied edits unsaved in their Office, unmentioned. **FIX:** `_unfinished` compares the file with the kept original (`filecmp`, byte-exact) and registers undo when it differs; both scripts report `unsavedEdits`, which the summary states. Tests: two cases fail without the fix; `test_sheets.py` + `test_files_documents.py` 22/22 PASS including real Excel and Word on this PC. Still OPEN: disk-full, protected files, macros matrix, user edits while paused, effect/execution/verification metadata on the wire. Evidence class LOCAL (real Office 16).

### P05 — Repair account isolation, granular staff rights and owner transfer

**Current:** coarse `has_role` RLS policies can differ from granular staff grants/denials; owner transfer and staff revocation may race because one target read is not locked. A unique primary-owner index proves at most one, not at least one.

Trace `src/lib/admin/access.functions.ts`, `staff.functions.ts`, console callers and every relevant SELECT/write policy. Add a forward migration after the current history; do not rewrite `20261003090000` or replay older console migrations out of order. Use the same database permission predicate as server routes (`ocade_staff_can` or its established owner) for direct Data API access. Enumerate service-role uses and check account scope explicitly where RLS is bypassed.

For transfer/revoke, lock the same owner-authority row and target membership in a consistent order, re-read permission after locking, perform demote/promote atomically, assert affected row counts and exactly one valid primary owner at transaction end. Roll back on failure. Require fresh assurance, reason and immutable audit record. Preserve stable owner identity and unlimited entitlement independently of display email. Never expose secrets through support views.

**Tests:** real local PostgreSQL with two sessions, transfer vs revoke, transfer vs transfer, rollback halfway, target deleted, stale MFA, denied granular permission with broad admin role, ordinary customer direct REST/SQL access, account A identifiers submitted by B. Use existing `src/lib/admin/__tests__` and migration suites; PGlite alone cannot close concurrency proof. **DONE:** API and direct-RLS matrix agree, owner invariant survives interleavings. **Failure/recovery:** fail closed; no automatic privileged retry after assurance expiry. **Platform/cost:** server-only logic shared by all clients, bounded queries/index review. **Rollback:** forward corrective migration and disable privileged mutation UI while inconsistent; never drop audit data. **Depends:** P00. **Retire:** redundant frontend permission authority after one server-derived view is proved.



#### Detailed ordered implementation supplement — P05

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

**P05-A:** invitation withdrawal and owner-transfer/revoke races require conditional database commits and actual two-client tests.

**P05-B:** bind fresh proof to actor, operation, target and digest. Recovery records consumed code, factor mutation and revocation phases truthfully.

**P05-C:** create Chat operation ownership before allowance await. Guard attachment/save/delete/export/resend/refresh callbacks by account and operation. Replace stale whole-snapshot rollback with scoped reconciliation.

**P05-D:** immutable notification operation IDs, bounded outbox, account/version-conditional endpoint updates and separate administrative-effect/delivery results.

**Target DONE:** direct API/RLS and UI invariants agree; stale callbacks/proofs cannot cross accounts.

**Work record — P05-A ownership hand-over (11 October 2026):** Reproduced by source trace: `ocade_staff_transfer_ownership` (20261003090000) checked both roles unlocked; a concurrent removal of the target let the caller demote itself while the promotion touched zero rows, committing no Primary Owner. **FIX:** forward migration `20261011090000_ownership_transfer_locks_both_owners` (+ verify, rollback) locks both rows in one order, re-reads roles under the lock, requires exactly one row per write and exactly one Primary Owner at the end (`40001` otherwise, whole transaction rolled back). PGlite suites PASS; verification fails without the migration. Two-session race proof: **BLOCKED** (no real PostgreSQL locally; a Supabase branch needs owner approval). NOT applied to production. Replaying 20261003090000 after it would restore the unlocked body: apply in order only. Also fixed the recurring `staff-authority` flake: the twin minted the token's proof time inside the transaction, so a second boundary made the proof later than `now()` and the "proof in the future" rule refused it; claims are now minted first (5/5 clean admin runs). Still OPEN: P05-B/C/D.

### P06 — Make export and erasure complete, bounded and recoverable

**Current:** `src/lib/account/data-rights.ts` uses offset pagination without a stable snapshot/order; `erase.server.ts` can proceed after a partial storage sweep; `src/lib/library/tombstones.server.ts` must not turn a failed count into zero pending work. No autonomous retry consumer was established by the inspection.

Define export's consistency contract: extend `AccountDataTable` in `src/lib/account/data-classes.ts` with a table-specific unique-key cursor or singleton strategy. Some settings/preference tables have only `user_id`; commercial usage has different time fields. Never assume every table has `(created_at,id)`. For a true point-in-time export materialise a consistent database snapshot and stream it; otherwise label the bounded read best-effort because a creation cutoff does not freeze later updates/deletions. Explicitly document cross-service consistency limits. Preserve relationships and a manifest of included/excluded classes/counts. Bound memory and page sizes; generate resumable chunks. Do not claim complete export when a class failed.

Persist deletion requests and object tombstones before losing auth context. Wire a proposed bounded erasure sweep into `src/cloudflare-entry.ts:scheduled` beside its existing JARVIS clock work; this consumer does not exist yet. Extend `src/lib/library/tombstones.server.ts` or a narrowly justified account worker and a forward atomic-claim migration. Isolate reminder/erasure failures, cap records and wall time, track oldest pending age. One consumer claims due jobs atomically with backoff, attempt budget, dead-letter/operator state and safe retention. Verify storage/database/provider obligations before terminal deletion-complete status. An unknown count stays unknown. Audit request, retries and completion without retaining erased content. Owner and legal decisions determine retention and account deletion ordering; do not guess external provider erasure from local SQL success.

**Tests:** singleton/no-created_at/composite-key tables; updates to pre-cutoff rows; insertion/deletion during export pages; repeated cursor; storage failure then auth deletion; count-query error; restart; actual scheduled-entrypoint invocation after identity deletion; duplicate delete request; orphan object; revoked account retry; cross-account tombstone; unrecoverable provider error. **DONE:** each account-data class is mapped and reconciled, retries have an actual invocation path and monitored backlog. **STOP:** export cancels safely; erasure once committed is not universally reversible, so cancellation semantics must be explicit before confirmation. **Cost:** bounded pages, no full account payload in RAM. **Rollback:** pause consumer while retaining tombstones; never resurrect deleted data. **Depends:** P05. **Retire:** silent partial-success paths.



#### Detailed ordered implementation supplement — P06

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Owners: account data-class map, `buildAccountExport`, deletion and tombstone owners.

1. Enumerate every account-linked table/storage class.
2. Define cutoff and correct cursor for singleton/composite-key tables.
3. Include partial/excluded/retained classes in the export manifest.
4. Persist erasure intent before deletion.
5. Give pending cleanup an actual scheduled consumer.
6. Independently reconcile storage and access revocation.

**Tests:** concurrent data changes, storage outage, auth deletion before cleanup, restart, orphan objects and wrong account.

**Work record — P06 step 5 and unknown counts (11 October 2026):** Reproduced by source trace: storage tombstones outlive the identity (no FK, by design), but they were retried only "at the next deletion by the same owner", which never comes after erasure; and a failed pending count became `count ?? 0` (unknown reported as nothing pending). **FIX:** one sweep owner `sweepTombstones(ownerId | null)`: null sweeps every account's due objects under a 10-attempt budget (row and last error kept for an operator), each object checked against its own row's owner folder; `cloudflare-entry.ts` `scheduled` runs one bounded batch a minute beside the JARVIS clock; an uncountable backlog reports -1. Tests: 2 fail without the fix, 8/8 PASS. Still OPEN: export cursor/snapshot contract (steps 2–3), erasure intent persistence and receipts, per-attempt backoff timestamps, operator dashboard for dead-lettered rows, real Storage outage proof. Evidence class LOCAL (fake service client).

### P07 — Make Offline Intelligence survive a real cold offline start

**KEEP** the existing model, OPFS vault, installation authority, runtime activation, Web Locks, signed lease and single usage settlement. **Current gap:** `installation-browser.ts` consults an authenticated release resolver before `installation-authority.ts` checks local bytes; a new offline document may fail despite an installed model. Warm-tab tests do not establish cold-start operation.

1. Persist the verified release manifest locally with opaque release ID, length, digest and compatibility version, excluding expiring delivery URLs. On activation, inspect local manifest/bytes and valid offline lease first. Resolve a delivery URL only for missing bytes when online. Expired permission must not be confused with missing files; never bypass lease expiry to make the test pass.
2. Wire `src/lib/brain/installation-browser.ts`, `installation-authority.ts`, `runtime-activation.ts`, `offline-release.ts`, `public/sw.js` and existing offline transport. Retain one authoritative state machine and one download owner across tabs. Repair must re-hash and verify length; cached nonzero/verified flags alone are insufficient after suspected corruption.
3. In `src/lib/chat/unsynced-turns.ts`, make encryption-key creation atomic across tabs with the existing Web Lock/IDB transaction discipline and reread the winning stored key. Quarantine unreadable ciphertext for recoverable diagnosis instead of silently deleting conversations. Bind local data to account, support sign-out/erasure and prevent old-account activation.
4. Keep approximately 462 MiB current model bytes and roughly 900 MiB configured runtime memory as measured configuration, not universal requirements. Request persistent storage where available, explain eviction, resume interrupted downloads, release runtime memory on explicit unload. Benchmark context length/thread count on low-memory devices before changing defaults. WASM is the proven baseline; WebGPU is an experiment only after compatibility, output-quality and thermal evidence.

**Tests:** fresh browser process, installed bytes, network disabled before launch, valid lease; expired lease; evicted OPFS; wrong digest with same length; interrupted range download; two tabs create keys simultaneously; crash mid-install; update without re-download; offline journal sync after reconnection; account switch. Extend brain/commercial/chat tests and `scripts/e2e/offline-journey.mjs`; browser stubs cannot replace actual storage/restart evidence. **DONE:** cold offline use and repair work on declared browser/device matrix. **Privacy/cost:** local pre/post-processing only inside granted scope, no model-byte re-download on ordinary app update. **Rollback:** retain compatible previous manifest/runtime; never discard only conversation copy. **Depends:** P00/P05, independent of native-control work. **Retire:** network-first activation and destructive ciphertext-error cleanup after parity.



#### Detailed ordered implementation supplement — P07

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Preserve final-byte signing and upstream model identity.
2. Define readiness across bytes, signature, runtime, lease, keys and trusted clock.
3. Fix durable download frontier handling.
4. Test fresh-process offline hydration and two-tab storage ownership.
5. Persist pending usage settlement.
6. Reject same ID with different payload.
7. Retire usage only after acknowledgement.
8. Reconcile closure/refund before deleting evidence.

**Target DONE:** actual cold offline operation and independently reconciled balances. No silent JARVIS offline fallback.

**Work record — P07 cold offline activation (11 October 2026):** Reproduced by source trace and test: with no connection `resolveTarget` returned `unreachable` and `attemptPath` stopped with "could not reach your account" before looking at the vault, so a device holding a verified model could not start Offline Intelligence in a new document. **FIX:** on `unreachable`, the authority activates the vault's active version when its metadata is verified and its bytes are present; otherwise it reports unreachable as before. Test fails without the fix; brain suite 171/171 PASS. Still OPEN: app-shell availability of a brand-new offline document (service worker), corrupt-bytes quarantine instead of deletion, cross-tab key race, real cold-offline browser proof (final campaign). Evidence class LOCAL.

### P08 — Execute admitted deterministic segments on the device

**Current:** `agent.ts` sequence loop around 528–555 calls `runDevice` for each action; `live-deps.ts` queues one action and `device.server.ts` claims one. This reduces some planning calls, not per-action cloud dispatch. Raising the sequence limit alone is not the fix.

Implement the canonical ExecutionEnvelope contract in the existing `protocol.ts`, `jarvis-runtime/ocade_protocol.json`, validators, `jarvis.functions.ts`, `live-deps.ts`, `device.server.ts`, `ocade_device.py` (loop/journal), `ocade_computer.py` (adapter), `ocade_agent.py` (lifecycle) and Android service. Negotiate `segment_v1` capability; old agents receive the existing single-action path. Admit only steps whose target, scope and prerequisites are known. Break at unresolved branch, new confirmation, unknown UI state or non-idempotent external commit. Return to the planner on genuine uncertainty.

Local executor loops over bounded steps, journals P03 state, checks P02 immediately before effects and emits P01 receipts. It may use declared previous-step output references after schema validation; it may not evaluate arbitrary model expressions. Verify segment predicates and checkpoints before proceeding. Keep per-app/document mutation locks and separate task deadlines from UI observation waits. Persist monotonic step index and request digest; do not resume from a model summary.

**Tests:** schema parity TS/Python/Android; oversized/deep payload; 12-step boundary; changed scope mid-segment; capability downgrade; crash at every journal boundary; duplicate segment; wrong digest; reordered acknowledgement; STOP between steps; external-write timeout. Compare old and new paths on identical 30-step fixtures, including durable flush and verification time. **DONE:** fewer server exchanges with unchanged output/safety; model calls must not increase and are measured separately because existing model batching already predicts sequences, measured p95 improvement. **Resources:** bounded outputs/ring buffers, no unbounded local queue. **Rollback:** server feature flag stops segment admission; drain/reconcile in-flight work before returning to single actions. **Depends:** P01–P04/P05. **Retire:** old per-action path only after minimum supported installed versions are upgraded; keep compatibility until then.



#### Detailed ordered implementation supplement — P08

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Extend the shared schema and all language consumers together.
2. Add negotiated segment admission.
3. Apply byte/step/duration/resource limits.
4. Execute through existing adapters and final P02 checks.
5. Journal every step and verify checkpoints.
6. Separate job timeout from observation/network wait.
7. Retain compatible single-action transport.
8. Measure legacy/new parity and latency.

**Tests:** 12/13 boundary; malformed references; downgrade; scope change; crash per step; duplicate/reordered segment; uncertain submission.

**Work record — P08 phase 1 (11 October 2026):** Reproduced: a 12-step sequence cost 12 queue→claim→result round trips (one claimed command per exchange). **IMPLEMENTED `segment_v1`:** the desktop agent advertises it; for such a device one exchange claims the task's contiguous queued steps (≤12), re-checking permission and confirmation per step and ending before any step that needs the person; the agent runs them in order with STOP checked before each, reports each result as it lands, lists the steps still to come in `running` (so a server cancel reaches them), and reports steps after a failure or cancel as `skipped` (stored `cancelled`, ignored by the P01 evidence gate). The planner queues the observation-free prefix of a sequence together and settles each in order, withdrawing the rest after a step that did not finish; steps that act on "latest" still wait for the previous result. Old agents and Android receive one step as before; a first step that never started stays `failed`, so a new agent never sends `skipped` to an older server. Also fixed: the running-work check read only one row (`limit(1)`). Tests: 4 real-Postgres segment cases, 3 agent segment/cancel cases, planner withdraw case; jarvis 200 PASS, Python safety/agent 58 PASS. Still OPEN: declared previous-step output references, per-step journal of intent, measured p95 on identical 30-step fixtures (final campaign), Android segments. Evidence class LOCAL.

### P09 — Use events for wakeup, durable state for truth

Extend `src/jarvis/changes.ts`, `device.server.ts`, background scheduling and companion exchange. Reuse authenticated Realtime/task-change notifications to wake a durable fetch; a notification is neither authorisation nor task completion. Retain bounded backoff polling for lost events, reconnect and unsupported environments. Do not add a new relay service until measured scale/latency requires it.

Add task/device revision and last-ack cursor; fetch missing revisions after reconnect and deduplicate repeated/out-of-order wakeups. Subscribe only to authorised account/device topics, renew auth and stop on revocation. One connection owner per session; pause unnecessary visible polling when idle. Mobile background restrictions remain explicit. Online planning stays server-owned; if long tasks outlive one Worker request, continue through the existing checkpoint/background entry point with bounded work and a verified wake source.

**Tests:** drop/duplicate/reorder notifications; websocket unavailable; token expiry; device asleep; server restart; two tabs; forced polling fallback; notification arriving before committed row. **DONE:** no lost task or duplicate effect, recovery delay measured; never remove fallback merely because one event arrived once. **Cost:** compare messages, open connections and idle CPU against baseline, no screenshot heartbeat. **Rollback:** fallback polling with jitter and rate caps. **Depends:** P03/P08. **Retire:** independent polling loops after shared subscription parity; retain fail-safe fetch.



#### Detailed ordered implementation supplement — P09

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Reuse web action-change authority.
2. Add negotiated device wake hints behind the same broker.
3. Fetch durable state after every hint.
4. Coalesce duplicates and preserve polling fallback.
5. Bind schedules to timezone, occurrence ID, current permissions and selected PC.
6. Display waiting states for locked/asleep/offline computers.

**Tests:** missed/reordered events, token expiry, reconnect, DST, duplicate occurrence and stopped-generation renewal.

**Work record — P09 decision (11 October 2026):** The web planner already wakes on Realtime action events with a bounded polling fallback (`changes.ts` `actionChanged`); the desktop and Android agents poll every 1 s while their task runs and every 5 s when idle. A device wake hint needs a push channel the device can authenticate to; without one, a server-held long poll would query the database more often than the 5 s idle poll. Per this package's rule (no new relay until measured), no code change: device first-step latency stays ≤5 s idle, measured in the final campaign. Steps 2 (device wake hints) and 5–6 remain OPEN pending that measurement.

### P10 — Discover capabilities and learn safe recipes

Extend `ocade_discovery.py`, `ocade_computer.py`, `src/jarvis/docs.server.ts` and existing task memory. Collect installed app identity/version, executable signer/path, supported automation interfaces and granted resource scopes. Cache only metadata actually used; no continuous full-content indexing or global file upload.

Use a small versioned record: app identity/version range, interface kind, prerequisite scopes, typed parameter schema, preconditions, steps, verification predicates, recovery limits, source URL/version and last successful evidence. Store sanitised device-local recipes first; account sync is opt-in and excludes secrets, raw private screenshots and customer contents. Invalidate on app/version/interface drift, permission change, failed precondition or changed verifier schema. A cache hit still checks live target/preconditions. Unfamiliar apps follow documented API/script discovery → live semantic tree → fresh vision. Downloaded documentation is untrusted data and cannot grant capabilities.

Compile a recipe only after multiple successful varied fixtures and a negative test. Pin approved script digest and narrowly scoped inputs; do not auto-install dependencies or execute code from a retrieved README. Proposed exploration runs read-only or on a disposable copy; commit needs the normal broker. No giant app-name switch or plugin marketplace in this phase.

**Tests:** app upgrade; forged docs instruction; stale selector; missing API; renamed window; injected credential request; recipe from account A on B; drift forces replan; unfamiliar application chosen after freeze. **DONE:** repeat workflow uses fewer planning calls without reduced proof/fidelity, and safely refuses stale recipes. **Cost:** warm lookup budget; cache measured misses rather than speculative global registry. **Rollback:** invalidate recipe, use canonical planner/action path. **Depends:** P08/P09. **Retire:** static coordinates and redundant maps only after parity; retain compact aliases and advantageous native adapters.



#### Detailed ordered implementation supplement — P10

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Owners: `app_info`, version discovery, `recipes_for`, `save_recipe`.

1. Discover identity/version/interfaces and examiner availability.
2. Cache descriptions, never authorisation.
3. Convert successful workflows into typed parameterised recipes.
4. Store scope, preconditions, verifier references and provenance.
5. Exclude secrets, coordinates and private raw recordings.
6. Canary after interface/version changes.
7. Quarantine a failed recipe without disabling unrelated recipes.

**Target DONE:** repeats reduce planning/intervention while preserving independently verified results.

**Work record — P10 step 7 (11 October 2026):** Discovery (`app_info`: program, version, COM servers, file types, scripting folders, cached per program build) and sanitised device-local recipes (no coordinates, paths, addresses, codes or secrets; a new major version hides old ones) already exist. Gap: a recipe that stopped working kept being offered. **FIX:** `recipe_save` takes `worked: false`; two failures in a row set the recipe aside, a later success restores it, and the planner prompt says to report failures. Tests: `test_discovery.py` 10/10 PASS. Still OPEN: typed parameter schema and verifier references per recipe, multi-fixture compile gate, canary after drift, account sync (opt-in). Evidence class LOCAL.

### P11 — Deliver one extension-free installation and browser experience

Reuse `src/lib/agent/release.ts`, `release.functions.ts`, `src/routes/api/jarvis/enroll.ts`, `ocade_identity.py`, `ocade_existing_browser.py`, `ocade_update.py` and existing packaging. Pair through authenticated website + short-lived one-time code bound to device public key; display device identity and require the local user's consent. Agent uses outbound authenticated exchange. Do not expose unauthenticated localhost/LAN/CDP control, permanent pairing codes or browser-origin trust alone.

Customer flow: sign in → Connect computer → signed installer and provenance → guided pairing → capability check → first verified task. Auto-start only with user consent; one lightweight tray supervisor owns wake/updates/connection. On ordinary Exit stop owned tasks and invalidate active execution leases/epochs while retaining pairing and remembered grants under policy; restart reconnects normally. Explicit device revoke invalidates pairing/grants and requires new consent. Test Exit, sign-out, reboot and revoke separately. Uninstall removes startup hooks, processes and credentials; offer a clear choice for local output/recipe retention without deleting user documents.

For existing signed-in Chrome/Edge, use a supported attachment only when legitimately available. Chrome 136+ default-profile remote debugging restrictions prevent promising automatic DOM access to any ordinary profile. Use OS accessibility/vision against the user's current browser when attachment is unavailable; alternatively offer a product-managed separate browser profile with user sign-in. Never copy cookie/password databases. Browser password manager interaction is normal user-authorised UI, not secret extraction. Do not change browser security flags to conceal automation.

**Tests:** clean non-admin Windows install; website closed/reopened; OS restart; multiple accounts; duplicate agents; revoked pairing; replay/CSRF/origin probes; Chrome default profile versus managed profile; tab/window restart; upload/download scope; partial signed update; rollback; uninstall/reinstall. Use manual installed lifecycle/update/existing-Chrome probes and real signed artefact. **DONE:** no customer developer setup, correct browser/privacy explanation, measured idle supervisor target <0.5% of one CPU core and <100 MiB RSS on reference hardware with wake off (proposed, revise only with evidence). **Cost:** sign/distribution trust has real operational cost; zero app-store fee does not mean free code-signing. **Rollback:** signed last-known-good package, compatible protocol, no signature bypass. **Depends:** P03/P08–P10. **Retire:** duplicate installer/browser authority and post-install wake-download path only after bundled signed parity.



#### Detailed ordered implementation supplement — P11

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Verify signed installer identity.
2. Pair exact fingerprint/account.
3. Show selected browser profile and external account separately.
4. Use supported existing-profile control where available.
5. Offer a managed-profile fallback with separate sign-in/consent.
6. Preserve unresolved journals through update/rollback.
7. Verify uninstall and revoke, not just executable existence.

**Tests:** tampering, occupied port, wrong profile, multi-account chooser, interrupted update, revoked device and existing-profile preservation.

**Work record — P11 Exit stops owned work (11 October 2026):** Reproduced by test: tray Exit with a task running set STOP and ended the exchange loop at once, so OCADE never heard the STOP and the task stayed "running" until orphan detection paused it. **FIX:** after halting, a pending STOP is sent in one last best-effort exchange with the halted step's result; anything not received stays in the result journal for the next start. Test fails without the fix; safety/agent 59/59 PASS. Still OPEN (installed-lifecycle, manual): signed installer identity, pairing fingerprint display, reboot/sign-out/revoke matrix, Chrome default-profile vs managed profile, idle CPU/RSS measurement, uninstall/reinstall. Evidence class LOCAL.

### P12 — Make voice interruptible without duplicating the task engine

**Current:** `src/jarvis/use-voice.ts` stops recognition during speech output and waits before restarting; a button interruption is not spoken barge-in. Output error handling must not leave the speaking state stuck.

Keep one audio-session owner in `use-voice.ts` integrated with `JarvisWorkspace.tsx`, `ocade_wake.py` and Android foreground service. Use the single lifecycle and display-label mapping in Architecture section 10, with a generation ID; do not define another voice enum here. Make start/stop idempotent; ignore old callbacks after generation change. Handle speech output onend/onerror/timeout and release microphone/audio tracks on unmount, revoke or exit.

First repair existing text/voice lifecycle. Then evaluate one streaming provider path through the existing intelligence authority using short-lived session credentials and bounded budgets; no permanent key in the client. Gemini Live is a candidate with interruption and session resumption contracts, not a second task planner. On detected user speech, stop playback and cancel stale audio output only; route the new utterance to the current task. Audio barge-in alone does not cancel task execution. Explicit Stop, Take Over or an unsafe redirect changes task admission/epoch independently. Echo cancellation/VAD must distinguish device output; test headsets and speakers. Local STOP recognition/shortcut bypasses cloud planning; do not rely only on a remote speech model for emergency interruption.

Status questions read task state without replanning. Redirect creates a new intent version, stops unsafe pending steps and preserves committed effects. Wake audio is local until activation, bundled and signed; support OCADE/Hey OCADE as specified by the verified wake model. Browser background microphone limitations require honest UI and companion availability, not hidden always-on promises. Disconnect pauses remote interpretation; reconnect reconciles task/tool state independently of the voice session token.

**Tests:** speak over TTS; false barge-in from speaker echo; output service error; double start; microphone denied/revoked; tab background; device lock; network loss during tool effect; reconnect replay; Indian English and consented Hindi-English utterances; STOP in noise; text-only fallback. **DONE:** no stuck mic/speaking state; explicit task STOP prevents the next admitted effect, while an audio-only interruption/status question leaves valid task execution intact; record end-of-speech-to-first-response p50/p95 and false wake/interruption rates. Initial targets: p95 local playback interruption ≤150 ms after recognised local interruption, provider response measured separately. **Cost:** push-to-talk free baseline; cap streamed minutes, avoid audio during idle. **Rollback:** text and push-to-talk remain usable, disable full-duplex experimentally. **Depends:** P02/P03/P09; no paid audio rollout before P20. **Retire:** overlapping recognisers/wake services only after parity.



#### Detailed ordered implementation supplement — P12

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Owners: `useJarvisVoice` and existing local wake authority.

1. Give mic acquisition, recogniser, provider request, audio queue and playback one generation.
2. Dispose late-returning tracks after cancellation.
3. Fence old recogniser/TTS completion callbacks.
4. Bound queues and cancel speculative audio.
5. Separate barge-in, Pause, status questions, redirect and explicit STOP.
6. Claim local wake only when no pre-wake cloud transmission occurs.
7. Keep text and dictation fallbacks.

**Tests:** Start/End/Start during permission request, late audio, echo, headset change, noisy Indian accents/code-switching and background restrictions.

**Work record — P12 phase 1 and ToRemove voice/UI rows (11 October 2026):** Reproduced by source trace in `useJarvisVoice`: Start → End → Start while the permission prompt was open let the first `getUserMedia` land in the second session (a second microphone stream nobody stopped); the meter's `requestAnimationFrame` loop checked only `audio.current`, so an old loop survived a restart; a cancelled utterance's late `onend` could switch a newer utterance to listening mid-speech (echo). **FIX:** one session number for start/meter/end and one per utterance; a stale callback releases only its own stream and does nothing else. Also: `stopEverywhere` waits on the device acknowledgement event instead of a fixed 1 s sleep (1 s fallback kept); the Orb draws frames only while there is sound (idle and hidden: zero frames; hover, level, drag and zoom repaint); co-work no longer lets JARVIS's clicks, typing or paste continue over the person's own input (foreground-only actions keep the co-work choice). Tests: typecheck/lint; `test_computer.py` 34 PASS with the co-work rule inverted; voice hook and Orb have no DOM test harness here: browser proof in the final campaign (UNTESTED). Still OPEN: barge-in vs task STOP distinction, Hindi/English code-switching tests, provider reconnect. Graph per-category cap deferred until the campaign measures paint cost without the idle loop.

### P13 — Make Android reliable within Android's actual permissions

Extend the existing `android/src/in/ocade/app` classes and signed APK packaging rather than introducing another mobile framework. Guided website onboarding requests only the permissions required for the chosen task: pairing first, Accessibility for app control, notification/foreground service for continuing work, microphone for voice, overlay for optional bubble. Explain denial and revocation with a retry path. Keep OS-owned prompts and protected authentication boundaries.

Apply P02 observation generations and P03 durable journal before claiming dependable mobile execution. Use intents/platform APIs where available, Accessibility for semantic controls and fresh gestures only where necessary. Production APK must not require ADB, root, Termux or a terminal bridge merely because research harnesses do. Retain the bubble as compact status/voice/STOP/Open OCADE; hide app/tool plumbing. Foreground service lifecycle and battery restrictions must not be concealed as a guaranteed background service.

**Tests:** Pixel 6a API 34 x86_64 Google APIs emulator as pinned primary configuration, stable snapshot, 2–4 vCPU/2–4 GiB guest RAM depending on host capacity; separate API 33 fixture only where a research benchmark requires it. Test rotation, keyboard, overlay, notification denial, accessibility revoke, process death, Doze/background limits, reboot, install/update/uninstall, bubble focus and STOP. Real-device OEM/background/wake evidence remains BLOCKED until hardware is available. **DONE:** supported scope passes emulator plus required physical gate; no extrapolation to all OEMs. **Cost:** local emulator/WHPX first; free hosted quota only after checking availability. **Rollback:** last signed compatible APK, disable app-control capability if stale-state safety fails. **Depends:** P02/P03/P08/P11/P12. **Retire:** duplicate permission/setup screens after guided flow parity.



#### Detailed ordered implementation supplement — P13

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Owners: `android/src/in/ocade/app/AgentService.java`, `Control.java`, `Identity.java`, `OcadeAccessibility.java`.

1. Honour system consent and foreground-service rules.
2. Persist pending results.
3. Invalidate targets after rotation/window/overlay changes.
4. Check admission at final effect.
5. Reconcile interrupted gestures.
6. Test process/OEM/background/revoke behaviour.

**Target DONE:** state-verified emulator suite plus separate physical proof. Developer ADB/Termux is not a customer requirement.

**Work record — P13 step 3 (11 October 2026):** `OcadeAccessibility` ignored every event, so a control or screen observation stayed "current" across a new activity, dialog, overlay or rotation until the next read. **FIX:** window-state and window-list changes from other apps (OCADE's own bubble excluded) and configuration changes (rotation, resize, density) invalidate both held observations; the next step reads the screen again. Steps 2 and 4 landed earlier (durable results; STOP at the final effect, 60 s observation age). Compiles (`build.py`); emulator proof deferred to the final campaign (UNTESTED). Still OPEN: guided per-task permission requests, interrupted gesture reconciliation, Doze/process-death/revoke matrix, physical OEM evidence (BLOCKED: no hardware).

### P14 — Stage Apple support honestly

Inspect `jarvis-runtime/packaging/macos/build.sh`, entitlements, install-root assumptions in `ocade_agent.py`, `ocade_computer.py` and update paths. Current source does not prove Windows-equivalent semantic control on macOS. Implement legitimate Accessibility/Apple Events permissions and native bundle lifecycle only after real Mac testing is available. Do not claim an unsigned development launch proves a signed/notarised update installation.

Ship Safari/PWA Chat, files within browser permission and remote paired-PC JARVIS first. iOS Shortcuts integration can open/share/request authorised remote work; App Intents require an actual sanctioned app integration. Evaluate Mac iPhone Mirroring only as a separately labelled option with compatible hardware, pairing, locked/availability constraints and no protected-screen guarantees. Do not build on private APIs or claim Android-style iOS Accessibility control.

**Tests:** WebKit layout/auth/storage/service-worker compatibility; physical Safari install/resume/share; device sleep/reconnect; Mac TCC denial/revoke; update app-bundle path; multi-monitor and keyboard layout; remote STOP from iPhone. **DONE:** per-capability platform table with actual evidence; no blanket universal badge. **Cost:** borrowed/owner-provided legitimate hardware first, paid device services owner-approved; no unsupported virtual Mac. **Rollback:** remove unsupported capability advertisement while retaining remote-PC/PWA. **Depends:** P11; P02/P03 for native execution. **Retire:** unsupported parity claims, not genuine cross-platform code that preserves a security boundary.



#### Detailed ordered implementation supplement — P14

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Add only sanctioned capability adapters behind the same broker.
2. Check Mac permissions/signing and actual installed interfaces.
3. Keep iOS Safari/PWA/Shortcuts/App Intents limitations explicit.
4. Use remote paired PC as the capable fallback.
5. Require actual hardware evidence for platform claims.

**Rollback:** clear unsupported capability refusal, preserving other platforms.

**Work record — P14 (11 October 2026):** No code change. Source keeps the claims honest: the desktop agent reports `accessibility` only on Windows and refuses `ui_inspect`/`ui_act` elsewhere; macOS screen/control capabilities follow TCC grants. Every Mac/iOS capability claim needs real hardware: **BLOCKED** (no Mac or iPhone/iPad; iOS website coverage will be Playwright WebKit emulation, labelled as such, native/physical iOS UNTESTED).

### P15 — Rebuild the visible experience around truthful work state

Implement [PRD](docs/PRD.md)'s complete route/control matrix and [Design system](docs/JARVIS_DESIGN_SYSTEM.md)'s single palette. Keep top-level Chat, JARVIS, Library; JARVIS contains Conversations, Activity, Devices. Keep exactly five Settings groups; use the names/options in PRD, not a second list here. No extra routes for things already well served by a panel.

Start with shared tokens/layout and pending/error/empty/blocked states. Then update `src/jarvis/JarvisWorkspace.tsx`, `JarvisPanels.tsx`, `JarvisTask.tsx`, `Orb.tsx`, settings components, authentication routes, Library, owner/staff console, landing/pricing and root not-found boundary. Reuse `src/lib/use-modal-focus.ts` for dialogs/drawers; restore focus, Escape and keyboard trapping only while modal. Treat read failure differently from an empty result or signed-out state. Catch rejected revoke/export/delete actions and show actionable retry without losing confirmed state.

Browser previews include capture time, target identity and stale/disconnected state; reject older frames for a newer generation. Do not label a retained failed frame live. Orb/graph is optional task context, lazy-mounted, paused when hidden and disabled/reduced under reduced-motion preferences. Avoid continuous idle animation and decorative progress percentages.

**Tests:** every retained control has an event/action and success/failure/disabled state; signed-in query failure; keyboard-only navigation; screen reader names; focus return; 200%/400% zoom; touch; narrow landscape; offline; 404 safe escape; owner links absent for customers; CSS contrast; dark/light; no phantom success. Use existing shell/settings/polish/jarvis/auth/library journeys. **DONE:** full PRD control matrix with evidence, accessible contrast and no required hidden setup. **Cost:** measure main-thread blocking, animation CPU and bundle delta before/after. **Rollback:** coherent UI revert, preserve backend state contracts. **Depends:** P01/P05/P07/P11/P12; UI skeleton work may start earlier. **Retire:** duplicated settings, dead controls and always-mounted expensive visuals only after coverage.



#### Detailed ordered implementation supplement — P15

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Apply the selected tokens/layout.
2. Complete the source-callback control matrix.
3. Implement global state/focus/IME rules.
4. Wire visible statuses to durable truth.
5. Repair pairing/removal/preference sequencing.
6. Replace idle Orb animation while preserving graph/list functionality.
7. Verify each route/state at every required width/theme/input mode.

**Target DONE:** semantic control tests, screenshots, keyboard/touch/assistive checks and idle-resource measurement.

**Owner B11–B20 smooth-start contract (11 October 2026):** Keep the existing three main destinations and one composer. The first viewport communicates the benefit in one honest sentence, offers a usable composer, a genuinely runnable fixture/example and an optional short recorded demonstration, without demanding a payment method. For native work, offer drag/drop, browse, pasted supported input and previously consented file selection. One signed official installer action → readiness check → guided pairing → scoped OS permission with why/what/revoke/local-data explanation. Never auto-grant privilege or silently select wrong file/device. Show current application, meaningful checkpoints, verified final files, re-open/check evidence and next action; no fabricated percentages or estimated savings. On error, state actual cause, preserve already-applied changes and distinguish partial/unknown from failure; direct STOP, takeover, approvals and status always reachable. Optional detail stays discoverable on narrow screens; a nonselected extra convenience feature is not a reason to delete baseline safety or accessibility.

**Work record — P15 failure states (11 October 2026):** Scanned every UI query and mutation for unhandled failures. Reads: all distinguish failure from empty (`Pending`), except the staff-console link, which correctly hides on error. Mutations: Settings > Advanced "Sign out"/"Sign out everywhere else" swallowed thrown errors (the button simply reset). **FIX:** a thrown failure now says "Signing out did not finish. Check your connection and try again."; a cancelled identity check stays silent. Typecheck/lint PASS; browser proof in the final campaign (UNTESTED). Still OPEN: the PRD route/control matrix, token/layout rebuild, focus/IME rules, preview frame generations, every width/theme/input mode.

### P16 — Bound online intelligence, memory and tool selection

Keep the existing online intelligence authority and server-hidden provider routing (`src/jarvis/background-model.server.ts`, `background.server.ts`, `src/lib/intelligence/`). Pin supported structured-output contracts and validate tool arguments. Planner chooses goal decomposition, uncertainty recovery and semantic interpretation; local execution handles deterministic work. Reuse stable prompt prefixes and compact durable checkpoints inspired by Manus; do not repeatedly send unchanged screenshots or full history.

Separate trusted user/task policy from untrusted pages/documents/tool output. Tool responses cannot alter account, scope, confirmation policy or system instructions. Scope discovery returns a bounded capability subset rather than a giant tool catalogue. Maintain existing step/call/failure budgets; show a recoverable limit state, not an infinite loop. Persist only authorised useful task context and sanitised recipes with user visibility/deletion; do not store raw credentials or private content as global knowledge.

Questions during execution read current context without cancelling work. New action requests get a distinct intent/queue decision; ambiguous target asks a concise choice only when context cannot resolve it. Model outage preserves checkpoints and labels JARVIS temporarily unavailable, never silently switches to Offline Intelligence.

**Tests:** malicious webpage instructions; tool-schema spoofing; invalid JSON; timeout/rate limit; partial stream; context compression loses goal; budget exhausted; concurrent user redirect; cached capability revoked; account switch. **DONE:** representative held-out tasks retain correctness with fewer tokens/calls; no provider secrets/names in ordinary customer UI. **Cost:** per-task token/audio/tool budgets, ledger reconciled with actual provider usage. **Rollback:** previous pinned compatible prompt/model configuration with recorded version; no automatic untested fallback. **Depends:** P01/P08/P10/P12. **Retire:** duplicate task summaries/state owners after checkpoint parity.



#### Detailed ordered implementation supplement — P16

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Retain existing turn/failure limits unless measured evidence justifies changes.
2. Bind frames to account, conversation and generation.
3. Cancel readers and nested iterators, not merely release locks.
4. Bound text/token/audio buffers.
5. Cache stable capability descriptions.
6. Treat file/page/tool/memory instructions as untrusted.
7. Keep cited research fresh and scope private inputs explicitly.

**Tests:** endless streams, missing IDs, provider loss, nested abort, poisoned memory, cross-account retrieval and exhausted budget.

**Work record — P16 step: history no longer resends old observations (11 October 2026):** The open planning loop kept every tool result in full: up to 30 observations of 120 elements each were resent on every model call, and their ids were stale anyway. **FIX:** when a newer observation arrives, earlier results in the history keep only their observation id, marked superseded (Background Mode already kept only its last few results in full). Test fails without the change; jarvis 201 PASS. Token savings to be measured on held-out tasks in the final campaign. Still OPEN: structured-output pinning, per-task token budgets, memory-poisoning and cross-account retrieval tests.

### P17 — Add professional application coverage through supported interfaces

Use P10 discovery and P08 broker; do not install whole competitor frameworks. Excel/Word use existing object-model adapters. Browser workflows use supported DOM/accessibility paths. Coding uses scoped filesystem, task-owned terminal/Git and tests; never automatic commit/push unless authorised by the user. Blender uses its installed Python API on a copy; Fusion uses the installed supported API; Resolve/Fusion video work uses the installed scripting documentation and edition/version capability. Old web examples are not proof of current SDK availability.

For each new family, implement a thin typed capability only if existing generic commands cannot safely express the task. Bind script digest, allowed input/output roots, application version and resource limits. Preserve native editable files, external references, units, colour management, timeline/frame rate, fonts and metadata. Rendering/export is separate from editing. Require reopen plus application-native inspection and output-quality checks. APIs may not cover every dialog; use semantic/vision fallback with fresh observations. Unsupported fidelity is a refusal or explicit downgrade, never silent conversion.

**Tests:** Excel macro/formula workbook; Word styled document with images; Blender native scene/reopen/render dimensions; Fusion units/components/export plus native reopen; video project/media relink/frame rate and bounded sample render; coding fixture diff and tests; unfamiliar installed app with no adapter selected after freeze. Include missing licence, unsupported edition, disk full, app crash, user modification and STOP. **DONE:** each advertised application/version has its own current native evidence, not merely a successful click. **Cost:** customer-installed licensed apps; no bundled commercial licence assumption, no default GPU cloud render. **Rollback:** preserve original and outputs, invalidate capability version; avoid killing shared app. **Depends:** P01/P04/P08/P10. **Retire:** specialised adapter only when generic replacement proves superior fidelity/safety/time.



#### Detailed ordered implementation supplement — P17

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

First qualify Excel, Word, PowerPoint and browsers, then coding, CAD/Blender, creative/media and connectors according to installed capability and customer evidence.

For each adapter:

1. Probe version/edition/API.
2. Freeze a native fixture.
3. Define typed operations and unsupported cases.
4. Bind file/app/account identity.
5. Execute on copies.
6. Reopen source and inspect output.
7. Test STOP, partial write, missing assets and version drift.
8. Measure repeat cost/fidelity.

No second universal execution engine.

### P18 — Ship three measurable recurring workflows

1. **Weekly checked Excel report:** accept scoped source workbook/CSV files; agree target columns, totals and exceptions; produce a new editable workbook and concise review summary; verify totals via independent calculation and reopen in Excel. Ask only for unresolved business rules. Record source/output digests and differences without exposing contents in public proof.
2. **Client document/PDF pack:** populate approved templates, preserve styles, validate required fields, render/reopen and compare page/attachment checklist; stop before sending unless the user explicitly authorises delivery. Separate structural completeness from human approval of wording.
3. **Browser status collection:** read authorised sites through the supported browser path, capture source record IDs/timestamps, reconcile into a local workbook/report, identify missing or stale sources. No CAPTCHA/OTP bypass, scraping outside permission or invented missing data.

Wire through existing task templates/prompts, Library and receipts; do not create three independent agents. Add a 'Repeat with new inputs' action using a versioned recipe and fresh validation. Offer a 'What changed?' preview before replacement. Let the user inspect the editable result and evidence; receipt sharing is explicit and redacted by default.

**Owner's 11 October 2026 first-customer experiment (G01–G07, G18, G27):** Preserve India-first students and independent professionals as the main audience; select **accountants** as the first *professional workflow validation niche*, not the exclusive customer market. Prioritise inaccurate totals/reconciliation over cosmetic report generation. Recruit **five consenting design partners for an initial two-week observation**, using both clearly labelled synthetic fixtures and explicitly consented real inputs. This small exploratory cohort cannot establish market-wide reliability or statistical significance. Baseline manual correction time, compare independently verified totals and file fidelity, measure errors, interventions, time-to-first-value and voluntary reuse; accuracy ranks above speed/presentation. Separately seek **five paid pilots** only after P19/P20 merchant, security and margin gates; a design partner is not automatically a paying customer. For B2B discovery, start with accounting/operations firms, maintaining strict account and client-data isolation. Spend on acquisition only when customers voluntarily repeat work and measured unit economics permit it.

**Tests/DONE:** 30 parameterised tasks per workflow, fresh/repeat cases, corrupted input, changed app version, permission withdrawal and recovery; target ≥95% independently verified success on the declared held-out pilot scope, zero falsely verified completions and no critical safety violation. Report confidence/sample size; 30/30 is not proof of universal reliability. Compare competitors only on the same allowed task, model/version, device and time/cost accounting. **Cost:** include human support/recovery minutes in margin. **Rollback:** disable recipe, retain manual output review; no paid guarantee before P20. **Depends:** P01–P12 relevant gates and P15/P16; P17 only for claimed apps. **Retire:** demo-only flows that cannot show a checked customer outcome.



#### Detailed ordered implementation supplement — P18

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

**Flagship:** browser research or local input → Excel calculation → Word/PDF report, optionally PowerPoint. At least two installed applications must perform substantive work.

**Coding:** exact local repository → scoped fix → tests/build → independently checked diff/result.

**Creative:** installed Blender/Fusion/media application → deterministic native edit → reopened source → checked export/render.

Each workflow preserves originals, provides a receipt for every mandatory artifact and records actual elapsed time/interventions. Public sharing is separate consent.

**Owner B01–B10/B41–B47 repeat-value contract:** Prioritise checked accounting totals and cross-app Excel → editable Word/PDF before expanding demo breadth. Run a real free example and user-authorised actual inputs through the same verifier: record accuracy, provenance, elapsed work and human corrections, not claimed universal app support or speculative hours saved. One approved workflow can be repeated with fresh resource scope, rechecked application version and approved output preferences; store only sanitised reusable steps and user-authorised metadata, never retained credentials/raw private inputs or stale coordinates. Give clear before/after and exception-only human review. User can discover weekly finance, monthly client pack, browser reconciliation and regular document uses; expand professional coverage only when repeat demand, fidelity and support costs justify it. The customer controls whether any verified proof/recipe is exported or shared.

### P19 — Close verification holes and freeze the release candidate

Repair `scripts/check-accessibility.mjs` so missing build/root/zero inspected targets cannot pass. Repair `scripts/e2e/harness.mjs`/consumers so BLOCKED is machine-readable and cannot count as a passed release gate despite process exit zero. Preserve useful local skipped-tool reporting but make required release scope fail closed. Inspect every gate's denominator, discovery and skipped-test treatment.

Follow [Testing](docs/TESTING.md): portable exact-lockfile gate, browser matrix, local real PostgreSQL/RLS/concurrency, signed Windows installed lifecycle, actual Office, Android emulator, required physical hardware, security/negative/fault injection, unfamiliar-app test. Freeze source while running the full matrix; write findings immediately, then repair in a separate pass and rerun affected/full required evidence. Do not add a special adapter to pass the unfamiliar-app test.

Run one independent adversarial pass and one real-user preview pass. Audit full release-scope source and list remaining unread files explicitly. Physical iOS/macOS/Android and hosted provider/payment evidence remain BLOCKED when unavailable. Do not expand release claims to bypass these gates.

**DONE:** no required skip/blocked hidden as PASS, no Critical/Major release-scope defect, full evidence manifest bound to candidate SHA. **Resources:** use installed tooling/CLI before adding MCP servers; Playwright/CDP for browser, native UIA for Windows, Appium for mobile testing, GitHub for source/CI, profiling via browser tools/OS. Tools are developer aids, not customer dependencies. **Rollback:** no promotion until proof; invalidate evidence after material code/config change. **Depends:** P00–P18 for shipped scope. **Retire:** brittle source-text tests only after stronger behavioural tests cover the invariant; never delete all negative tests as duplication.



#### Detailed ordered implementation supplement — P19

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Repair unsafe/misleading harnesses before execution:

- Fixed fixture IDs must not delete pre-existing accounts.
- Broad exception handlers must not catch the assertion that should fail.
- FK failure must not masquerade as CHECK enforcement.
- `NULL` must not bypass missing-object assertions.
- Source regex is static evidence, not actual RLS/concurrency proof.
- Recovery codes and signed URLs must never enter logs.
- Synthetic push is not provider delivery.
- Desktop pointer emulation is not physical touch.
- Installer `MZ` bytes are not signature/install proof.
- Completed-task STOP is not active cancellation testing.

Freeze the candidate and run meaningful required tests. Missing required evidence remains BLOCKED/UNTESTED.

**Owner B01–B50 growth evidence gates:** Evaluate the first free real result and optional pairing via actual browser/device user journeys; observe first-screen comprehension, input methods, accurate result, denial/failed install, STOP, receipts, partial save, safe repeat, pricing visibility, checkout decline, free-without-card, successful cancellation, accessible refusal and privacy-safe share. Require real denominators and a dated cohort record for activation, checked task accuracy, 7/30-day voluntary reuse, paid conversion, customer-reported benefit, support and refunds. Source demonstrations and competitor challenges must be independently replayed on comparable authorised inputs, real saved results and software identities. A marketing claim is UNTESTED without matching executed evidence; a small five-person two-week trial is qualitative, not statistically representative.

### P20 — Introduce honest paid access after merchant and margin gates

**Current:** paid checkout/subscription infrastructure was retired; active entitlements are admin grants/free defaults and owner unlimited access. `src/lib/commercial/entitlement-resolver.ts`, settings Billing/Usage and the retirement migration are the baseline. Do not advertise a working subscription or revive old tables by reverting migration history.

**Owner-selected price experiments (G08–G18; 11 October 2026), not approved checkout prices:** India entry **₹288/month**, strictly capped to verified low-cost use; compare India solo **₹888 versus ₹999/month** in distinct consented cohorts; investigate India higher-usage individual **₹2,888/month** only if usage, differentiation and margin justify it. International solo A/B test **US$28 versus US$29/month**, with **US$88/month** as a higher-usage individual candidate. Historical US$19 and ₹999-as-the-only-solo-plan hypotheses are superseded by these experiments; historical team ₹2,999/US$59 figures remain deferred research only, not a purchasable team product. Keep the first legally approved launch simple—Free plus at most **one clearly scoped paid pilot offer**, rather than showing every experimental tier to customers. Each displayed price must state exact currency, billing cadence, taxes/total payable, verified-work allowance, reset, concurrency, refund/cancellation terms and what happens when capacity is exhausted. Use 28/8 **subtly** as optional price identity, not a claim of psychological efficacy or business certainty. Annual billing may be considered **after 90 days of genuine retention and economics evidence**, not automatically launched. Prioritise India **UPI plus cards** when an approved provider actually supports them. Investigate a clearly disclosed time-limited refund policy, with actual terms selected only after legal/provider review. First recruit **five design partners for two weeks** through P18; target five paid pilots only after P19/P20 merchant/legal/security readiness. Define quotas and prices from measured cost per independently verified workflow, not raw clicks or model retries; preserve honest free Chat/offline access plus bounded JARVIS demonstrations, no unlimited subsidised cloud work.

Add forward billing schema only after selecting an approved merchant provider and legal/tax/refund terms. Reuse one entitlement resolver. Server-owned price IDs; verified raw-body webhook signatures; unique event ID; durable inbox; idempotent settlement; out-of-order events compared with authoritative subscription state; refunds/cancellation/proration/dunning explicit. Client redirect is never payment proof. Keep owner unlimited grant separate and audited; staff cannot grant arbitrary unlimited access without permission.

**Tests:** duplicate/reordered/forged events; payment success with browser closed; payment failure after redirect; refund; cancel at period end; grace expiry; quota reservation/release after failed task; two simultaneous jobs; owner/account switch; webhook replay; reconciliation against provider sandbox then authorised low-value live transaction. **DONE:** paid access accurately reconciles; merchant approval and legal commitments recorded; unit economics include provider, audio, hosting, support, tax/payment fees/refunds. **STOP/recovery:** cancellation of a task does not independently reverse a payment; settlement follows explicit terms. **Rollback:** disable new checkout, preserve paid entitlements and reconcile obligations. **Depends:** P05/P06/P18/P19. **Retire:** dead subscription controls before launch; do not destroy historical invoices/records that must be retained.



#### Detailed ordered implementation supplement — P20

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Preserve current entitlements/grants until approved migration.
2. Reconcile retired checkout and legacy tier UI.
3. Define one authoritative price/allowance/currency/tax contract.
4. Use durable webhook/event IDs and reject conflicting replay.
5. Reconcile successful output usage, payment, cancellation and refund.
6. Keep safety limits for commercially unlimited owners.
7. Ask for upgrade after verified value.
8. Require merchant/legal approval before live checkout.

No pricing hypothesis becomes a deployed bill without approval.

**Owner B21–B30 buying contract:** Let a useful result precede the upgrade request. Keep free Chat genuinely useful without requiring a card; limit free native/AI spend honestly. The permitted initial paid pilot offer exposes price, currency, full tax-inclusive payable amount where required, calendar renewal, work allowance, reset, concurrency, throttling, support, user-visible remaining balance, valid refund policy, cancellation and accessible billing history. Do not debit failed or empty answers or count internal retries as customer tasks; partial effects and ambiguous payment settlement must be stated truthfully and reconciled before deduction. A user spending limit cannot authorise work beyond safety or provider limits. Reserved words such as 'faster' or 'priority' require measured resource availability, no deceptive queue privileges. Test plan comparison and customer purchase clarity; first offer remains one approved tier until data supports alternatives. No dark-pattern prompts, urgency clocks, invented testimonials or covert fees.

### P21 — Release safely and grow from proven work

Use existing Workers/R2 release controller, not a new Pages deployment pipeline. `scripts/deploy.mjs` stages an immutable Worker version at zero traffic and probes identity/assets before promotion; extend gates where missing. Health confirms liveness/configuration identity, not successful model calls, RLS, billing or native installation. Signed update manifests must verify the final packaged bytes; never bypass InvalidSignature.

P19 is initial candidate preparation. Perform initial release-scope P22 cleanup after P20 and before final promotion. After P20/cleanup or any later source/schema change, rerun all invalidated tests and the complete required release-scope matrix on the final candidate SHA before promotion. Every P22 cleanup returns through this final candidate gate and separate authorised promotion; earlier green evidence does not cover changed code. Before production, record candidate SHA, installed versions, migration order, compatible rollback version, required secrets present without printing them, R2 artefact persistence, CSP/CORS/origin tests, recovery rehearsal and explicit owner approval. Apply schema changes only in the authorised release phase. Probe actual approved test-account workflows and provider readiness. Promote gradually where the deployment architecture supports it; watch verified-completion failures, unknown outcomes, stop latency, deletion backlog and cost. Roll back traffic on defined thresholds and reconcile in-flight effects; code rollback does not undo database writes.

Growth starts with Indian students and independent professionals, with accountants first among professional discovery partners; accounting/operations firms are a separate prospective paid B2B cohort. Publish explicitly consented before/after evidence: elapsed time, editable output, independently checked totals, failures and exceptions. The proof-led website launch uses measured real-result demonstration clips; first paid-channel experiment is **search intent** (Google/search) within a pre-approved runway-derived test budget. Hindi is the first optional localisation to validate; additional **English-language markets** are selected by actual activation, support and payment demand, not a fixed country-expansion promise. Test verified referral credits only after both referred accounts demonstrate legitimate value and anti-abuse, billing and consent rules pass. No automatic posting, private-data publishing, fake urgency or invented testimonials. Run **monthly fair competitor fixture comparisons** across OCADE's existing research universe (ChatGPT Work/Codex, Claude, Gemini, Copilot, Manus, OpenClaw, Ollama, PhoneHarness and other relevant published agents), recording compatible version/date, same authorised input, real output, time, price/cost and unsupported/unknown outcomes; never claim a win without executed paired proof. Use existing dated research as an index, not a reason to reread competitor repositories on every coding task.

**Growth and psychology experiment (G06/G07/G21–G28):** Journey: source-relevant search/real clip → free Chat → permissioned optional PC pairing → one accurate verified multi-app outcome → transparent upgrade if needed → consented 'Repeat with new inputs' → optional private-safe proof share or verified referral. Measure each conversion/drop-off and its cohort denominator. Use clear defaults, progressive disclosure, reciprocity through real free value, customer agency, authentic social proof and transparent plan comparisons; prohibit dark patterns, fabricated 'time saved', artificial scarcity, covert retention tricks, identity-targeted manipulation and surprise billing. The founder's chosen launch is a **proof-led website event** after demonstrated real task proof and support readiness, not a ceremonial date.

**Executive operating model:** The founder/CEO (acting board/president) owns company direction, runway, ethics and final legal/production approvals. A chief engineer/CTO hat owns P00–P17 implementation, safe release and rollback; AI research/evaluation owns fair head-to-head fixtures and model cost/quality; Product/Design owns first-use accuracy, accessible UI and P15; Security/Legal/Finance owns P05/P06/P19/P20 permissions, licensing, payment, refunds, taxes and budget; Growth/Marketing owns consented demos/search/referrals; Customer Success/Support/Operations owns user interviews, accessible onboarding, incident resolution and recurring-work quality. These are **responsibilities**, not claims of existing employees, a constituted board or authorised hiring. One operator can hold multiple hats initially; hire/specialise only when workload, cash and governance warrant it.

**Capital discipline and scale thesis (G19/G20):** Bootstrap first, assess angel finance later on demonstrated retention and unit economics; the actual monthly test budget is **TBD from documented available cash/runway**, not an approved expenditure. Measure gross margin and contribution margin using successful paid tasks, retries, model/provider costs, infrastructure, support, refunds, payment charges and taxes as applicable; test the existing **≥70% early gross-margin hypothesis**, not a guaranteed result. Keep separate financial scorecards for cash runway, monthly recurring revenue (MRR), annual recurring revenue (ARR = 12 × MRR), realised revenue, operating profit and valuation. Board ambition is a **$1B–$10B valuation and eventual $1B+ ARR/profit-scale outcome**, not a launch forecast, delivery guarantee or reason to violate safety; at US$28/month an illustrative US$1B ARR requires about 2.98 million continuously paying subscribers before churn/taxes, and a $1B valuation is not $1B revenue or profit. Gate spending on measured retention, positive contribution, trustworthy output, customer support capacity and compatible law; reassess positioning/pricing if results contradict the hypothesis.

**Tests/DONE:** signed install/update/uninstall, preview customer journey, rollback and data compatibility, hosted permission/provider checks, reconciled usage; five pilot customers repeat valuable work for four weeks before broad claims. **Cost:** proposed early gross margin ≥70% after variable compute/support accounting; revise price/scope if unmet. **Rollback:** stop acquisition/checkout or revert candidate while honouring existing customers. **Depends:** P19/P20 and owner production approval. **Retire:** stale release instructions and unsupported marketing, never recovery/provenance records.



#### Detailed ordered implementation supplement — P21

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

1. Freeze source/runtime/schema identities.
2. Clear shipped rights.
3. Verify signatures, install/update/uninstall, bindings and rollback.
4. Run applicable hosted/provider/physical workflows.
5. Obtain separate production approval.
6. Monitor unknown outcomes, STOP, erasure backlog, settlement and cost.
7. Reconcile in-flight effects during rollback.

Documentation merge does not authorise this release.

**Owner B31–B50 distribution and loyalty contract:** Use a privacy-safe, proof-first landing/demo funnel. Discovery tests may use search, video creators, professional communities, educator/student communities, accounting groups, software partners and freelancer networks, only with authentic consented material and an owner-approved spend ceiling. Fair referral-credit pilots give both users bounded benefits only after verified legitimate value and abuse screening. Show optional redacted checked outputs and editable files, never leak a user's private input by default. Compare competing assistants monthly only when legitimate test access and matched outcomes exist; record accuracy, time, recovery, cost and failures, not popularity-only leaderboards. Hindi-first localisation and other markets require actual UI, speech/privacy, payment/legal and human support capability validation. Long-term loyalty must come from reliable signed execution, verified task history, saved scope-safe recipes and continuous measured improvement; no addictive streak manipulation or hidden renewal tactics. Scale marketing after evidence of repeat use and positive unit economics, not after view count alone.

### P22 — Proof-based cleanup and gated expansion

Apply Ponytail Ultra after behaviour is proven: search all callers, identify replacement, measure baseline, delete, rerun regression, adversarial and real-user proof. Follow [ToRemove.md](ToRemove.md). No deletion quota. Preserve signatures, cancellation checks, licences, immutable donor sources, applied migrations, recovery, accessibility and unique evidence. Publish changed active LOC/modules/dependencies/package size and relevant p50/p95; do not count immutable history as disposable bloat.

2026: checked Windows work, website/companion trust, Offline reliability and small paid cohort. 2027: team approvals, more proven app families, reliable Android/Apple scope and opt-in reusable recipes, only after retention and margin. 2028: workflow/API distribution and a verification service only if customers pay for it; marketplace only after real supply, demand, sandboxing, licence review, payout/legal readiness and abuse controls. Do not build a foundation model, cloud desktop fleet, hardware device, giant plugin store or distributed agent swarm from a near-zero budget.

Candidate ideas to test: a private difference preview before each recurring run; resume by reconciling reality after a crash; exception-only human review; a receipt portable across organisations without raw data; version-change canary tests that quarantine a recipe before customer damage. Each reuses existing contracts. Measure customer willingness to pay and reduction in support, not novelty. **DONE:** simplified shipped scope retains every required capability and gate; expansion has a paying problem and a bounded experiment. **Rollback:** revert cleanup as a coherent commit; do not restore an unsafe bypass. **Depends:** release-scope cleanup follows P19/P20 and returns through final P19/P00-B before P21; later expansion follows P21. **Retire:** only individually proven obsolete paths.



#### Detailed ordered implementation supplement — P22

The following mandatory steps and verification criteria come from the latest owner-approved source plan; every feature stays OPEN until independently implemented and checked on its intended device.

Apply the exact inventory below only after replacement proof. Any candidate-changing cleanup invalidates affected qualification evidence.

Expand teams, connectors, Apple and professional breadth through the same contracts. Preserve the complete vision without crowding initial navigation or advertising unsupported functions.

## 5. Product-release stop conditions

Do not release affected capability while any of these remains: false completion; lost command/result; stale-target mutation; uncancellable next effect; uncertain account isolation/owner invariant; unsafe partial-save report; unreadable only copy of offline chat; vulnerable shipped dependency without accepted resolution; unlicensed shipped donor/model; unsigned/unverified update; hidden BLOCKED test; missing required physical/native/provider proof; unapproved billing or production action.

Documentation completion does not mean the product implementation above is complete. Keep work status explicit and resume the first OPEN package whose dependencies are satisfied; do not restart all work or append another master plan after a context reset.

## 6. Short implementation prompt — 11 October 2026 owner update

> Resume the existing OCADE P00–P22 implementation branch without discarding committed/uncommitted work. Read Section 0 first: stop real GUI/Office/Calculator testing during coding; inventory and remove both original and UI donor ZIPs/snapshots from the active tree with legal/provenance safeguards; review every active source file once using a hash-backed manifest; remove hardcoded app names/aliases/routing and fixed workflows in favour of discovered capabilities; aggressively delete proven dead/duplicate/unnecessary code and report actual file/line reductions. Then finish all remaining P00–P22 coding without repeated live tests. After code and debloat are complete, perform the comprehensive real-user test campaign, including Android Studio emulator and Playwright WebKit mobile browser emulation; record defects, fix root causes and retest. Preserve security, native fidelity, STOP and recovery. Report phase, coding/debloat/testing/verified percentages, files/lines before/after and blockers at each checkpoint. Merge only on complete, verified PASS gates; do not deploy production without owner approval.
