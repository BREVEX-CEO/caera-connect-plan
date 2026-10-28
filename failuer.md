# OCADE — failure, risk and blocker report

Audit date: 2026-10-28 UTC. Exact product source: **8acf290b27526cf2bf7abdb098769d24bbccbadf**, branch **ocade/p00-p22-implementation**, repository **BREVEX-CEO/caera-connect-plan**. Base tree: 78f46bb9ea3c01d61b9e1d47e15a08d9152cb1e2. The later report-only commit does not change tested product source.

Latest instructions supersede plan.md's older PC-only campaign: **cloud-only, $0 checks only, testing only**. No owner Windows PC, personal browser, desktop agent, local server, local files or local process was accessed after that instruction. No product/workflow/dependency/schema/configuration fix, installation, deployment, service shutdown, credential change, purchase, task rescue or merge was performed. Only these three Markdown reports are authorized for branch publication.

Current methods: remote GitHub source/API reads; read-only authorized Supabase staging queries; read-only Cloudflare resource metadata; free TinyFish Fetch; isolated V8 function/predicate probes in functions.exec. V8 is not a cloud OS/browser, Python, Vite, Playwright or native Windows runtime. Supabase staging is a separately observed environment, **not attested as the exact candidate deployment**. Production pages/old deployment were not used as candidate tests. No real inference calls were made.

Counts are from [testing results.md](testing%20results.md): **81 discrete checks:49 PASS,11 FAIL,7 PARTIAL,14 BLOCKED,0 UNTESTED;67 assessable completed checks.** The separate227 requirement mappings have0 PASS,4 FAIL,18 PARTIAL,203 BLOCKED,2 UNTESTED. Do not add these overlapping registers. No real JARVIS/cloud-browser/native workflow, provider inference or offline generation executed. Real AI calls0; task timing/CPU/RAM unmeasured; no candidate screenshot available.

## Ten highest-priority findings

These include source-confirmed failures, affected dependency pins/configuration observations, and explicitly labelled unexecuted risks. They are **not ten reproduced end-to-end exploits**. F01 has an upstream critical advisory; OCADE-specific exploitation has not been demonstrated.

| Priority | Finding | Status | Severity / evidence confidence |
| --- | --- | --- | --- |
| F01 | Pinned Pillow release has current security advisories | FAIL | Critical dependency; OCADE exploitability not established — Confirmed pin/advisory match; no exploit execution |
| F02 | Pinned pypdf release has parser/resource-exhaustion advisories | FAIL | High release concern; representative advisory Moderate — Confirmed pin/advisory match; no exploit execution |
| F03 | Result journal can exceed the server exchange limit | FAIL | High, conditional communication deadlock — Confirmed source contract mismatch; integration reproduction blocked |
| F04 | DeepSeek transform path predicate fails on Windows and accepts siblings | FAIL | High Windows build/runtime risk; sibling case lower severity — Two isolated predicate failures; native Vite build blocked |
| F05 | Dedicated Billing Read token is not wired | FAIL | High HIGH-mode configuration blocker — Confirmed full-source configuration wiring gap; live token permissions unknown |
| F06 | Available deployed intelligence target is older than the candidate | FAIL | High audit/release version blocker — Confirmed deployed source/version mismatch |
| F07 | In-flight Library delivery lacks an observable cancellation path | PARTIAL | High STOP/recovery risk — Confirmed source omission; delayed-network behavior is untested |
| F08 | Staging leaked-password protection is disabled | FAIL | Medium configuration finding — Fresh provider advisor observation; no breached-password signup attempted |
| F09 | Service-worker never-cache classifier omits exact /auth | FAIL | Medium cache-boundary gap; disclosure unproven — Confirmed classifier failure only |
| F10 | Windows DeepSeek linker uses bare npx with execFileSync | PARTIAL | Medium build portability risk — Source unchanged; historical Windows failure not freshly reproduced |


## Failed discrete audit assertions

| ID | Test | Actual result | Evidence |
| --- | --- | --- | --- |
| ENV-02 | Staging inference matches candidate | Deployed intelligence source is Oct 19 v7; candidate quotaReturnsAt implementation is absent. | E-STAGING |
| DB-11 | Leaked-password protection | auth_leaked_password_protection WARN: disabled. No signup/password test performed. | E-ADVISORS |
| SW-04 | Never-cache classifier /auth | Expected true; actual false; only the classifier is evaluated, not Cache API/navigation behavior. | E-SW |
| PATH-1 | Windows Vite separators | Expected true; actual false. Exact startsWith predicate; no native build executed. | E-PATH |
| PATH-2 | Sibling prefix isolation | Expected false; actual true. Exact startsWith predicate; no native build executed. | E-PATH |
| COMMAND-01 | Quoted Python semicolon classification | python -c "import PIL; print(PIL.__version__)" is classified as shell-meta before argv parsing; benign quoted code is refused. Equivalent ASCII regex, not a Python execution. | E-COMMAND |
| ACK-4 | Result backlog length 21 | Agent sends 21; server maximum 20; length admissible=false. No live HTTP/Zod/Python run. | E-ACK |
| ACK-5 | Result backlog length 40 | Agent sends 40; server maximum 20; length admissible=false. No live HTTP/Zod/Python run. | E-ACK |
| AI-01 | Dedicated billing-read credential wiring | Full boundary.ts never reads CLOUDFLARE_BILLING_READ_TOKEN; highIncluded receives CF_TOKEN from CLOUDFLARE_WORKERS_AI_TOKEN. | E-BILLING |
| DEP-02 | Pinned Pillow advisory metadata | pillow==12.3.0 has 44 advisory records, including critical GHSA-v9pv-5gc8-w2m6. Version match confirmed; OCADE exploitation unexecuted. | E-DEPS |
| DEP-03 | Pinned pypdf advisory metadata | pypdf==6.19.0 has 11 advisory records; GHSA-39mj-jf6j-2qj3 affects <6.20.0. OCADE PDF extraction invokes PdfReader directly. | E-DEPS |

The11 failed assertions map to9 finding groups: F01,F02,F03,F04,F05,F06,F08,F09,F11. Two backlog sizes and two path cases are separate test inputs, not extra independent vulnerabilities. Partial risks and blockers below are not included in the11.

## Reproduction, causes and recommendations

### F01 — Pinned Pillow release has current security advisories

- **Result:** FAIL.
- **Severity:** Critical dependency; OCADE exploitability not established.
- **Confidence:** Confirmed pin/advisory match; no exploit execution.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [jarvis-runtime/requirements-agent.txt](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/requirements-agent.txt), [jarvis-runtime/ocade_computer.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_computer.py)
- **Confirmed cause / condition:** jarvis-runtime/requirements-agent.txt pins pillow==12.3.0. deps.dev reports 44 advisory records (three PYSEC aliases duplicate GHSA records). Maintainer GHSA-v9pv-5gc8-w2m6 marks >=11.0.0 through 12.3.0 affected and 13.0.0 patched; severity Critical / CVSS3 9.8 in the feed.
- **Reproduction:** Fetch the exact requirements file at 8acf. GET deps.dev /v3/systems/pypi/packages/pillow/versions/12.3.0; follow each advisory. Independently read the maintainer advisory affected range. Do not send malicious files to the owner PC or staging.
- **Actual observation and limits:** Pin and affected range agree. Source invokes PIL.Image.open for allowed image suffixes and thumbnailing. Multi-frame RCE prerequisites and TIFF re-save paths are not proven reachable through OCADE; direct Image.open ReDoS is a separate advisory and source-reachable API. No crash, memory disclosure or code execution was observed here.
- **Evidence:** E-DEPS; DEP-02, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** In a separately authorized change, select a maintained patched release, review wheel/native dependencies, and run isolated hostile-image regression/cancellation tests before release. No upgrade or product change made.
- **Primary references:** [Reference 1](https://github.com/python-pillow/Pillow/security/advisories/GHSA-v9pv-5gc8-w2m6), [Reference 2](https://github.com/python-pillow/Pillow/security/advisories/GHSA-xgh8-jp6q-p5x8), [Reference 3](https://github.com/python-pillow/Pillow/security/advisories/GHSA-xvh5-g6gv-559v)

### F02 — Pinned pypdf release has parser/resource-exhaustion advisories

- **Result:** FAIL.
- **Severity:** High release concern; representative advisory Moderate.
- **Confidence:** Confirmed pin/advisory match; no exploit execution.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [jarvis-runtime/requirements-agent.txt](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/requirements-agent.txt), [jarvis-runtime/ocade_documents.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_documents.py)
- **Confirmed cause / condition:** requirements-agent.txt pins pypdf==6.19.0. deps.dev lists 11 advisory records. Maintainer GHSA-39mj-jf6j-2qj3 affects <6.20.0 and documents an infinite loop on an incomplete xref table. ocade_documents.extract_text constructs PdfReader before its output-character limit is applied.
- **Reproduction:** Compare the exact pin with deps.dev /v3/systems/pypi/packages/pypdf/versions/6.19.0 and the maintainer affected range. Inspect extract_text lines 69–87. A bounded isolated PDF reproducer requires a cloud Python runner and remains BLOCKED.
- **Actual observation and limits:** Affected dependency is present in the source manifest and the PDF-read code invokes it directly. The text-length limit does not bound parser initialization. No actual OCADE hang measured.
- **Evidence:** E-DEPS; DEP-03, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** In a future authorized change, choose a release resolving all listed advisories and isolate parsing with enforced time/memory cancellation, then retest malformed files. Do not treat fixing one advisory as resolving all eleven.
- **Primary references:** [Reference 1](https://github.com/py-pdf/pypdf/security/advisories/GHSA-39mj-jf6j-2qj3)

### F03 — Result journal can exceed the server exchange limit

- **Result:** FAIL.
- **Severity:** High, conditional communication deadlock.
- **Confidence:** Confirmed source contract mismatch; integration reproduction blocked.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [jarvis-runtime/ocade_device.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_device.py), [src/jarvis/device.server.ts](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/src/jarvis/device.server.ts)
- **Confirmed cause / condition:** ocade_device._exchange_loop assigns the entire retained results list to body.results; device.server exchangeInput limits results to 20. A retained backlog of 21 or more cannot satisfy that length constraint. Retention is intentional until receipt ACKs arrive.
- **Reproduction:** Read body construction around lines 438–470 and exchangeInput around lines 487–511. In isolated V8, compare source-derived lengths 0,1,20,21,40 with max=20. For a future integration run, seed an isolated pending journal with 21 valid result/receipt objects and exchange against the same source server; do not seed the owner's agent.
- **Actual observation and limits:** 0/1/20 are length-admissible; 21/40 are not. No HTTP/Zod/Python integration ran. A backlog must first accumulate or persist; a fresh normal-sized exchange is not asserted to fail. Current source server DOES echo id+receipt+outcome; the historical old-server id-only mismatch is not a fresh defect in the matched server.
- **Evidence:** E-ACK; ACK-4/ACK-5, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** A future fix should bound transmitted journal batches while preserving all unsent/unacknowledged entries and STOP/control traffic; verify retries, mixed receipts and replay safety. Nothing changed.


### F04 — DeepSeek transform path predicate fails on Windows and accepts siblings

- **Result:** FAIL.
- **Severity:** High Windows build/runtime risk; sibling case lower severity.
- **Confidence:** Two isolated predicate failures; native Vite build blocked.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [src/deepseek/resolve.ts](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/src/deepseek/resolve.ts)
- **Confirmed cause / condition:** src/deepseek/resolve.ts computes UPSTREAM with node:path.resolve and applies raw id.startsWith(UPSTREAM). Windows native separators differ from Vite-normalized forward-slash IDs. The prefix check also lacks a directory boundary, admitting upstream-other.
- **Reproduction:** Use root C:\repo\external\deepseek-harness\upstream and id C:/repo/external/deepseek-harness/upstream/pkg/file.ts: raw startsWith returns false. Use root /repo/upstream and id /repo/upstream-other/package.ts: raw startsWith returns true. Evaluate the exact guard; do not run or alter owner-PC Vite.
- **Actual observation and limits:** Expected transform true/false respectively; actual false/true. Necessary decorator/builtin lowering may be skipped on Windows. No fresh createRequire/Vite crash observed in this cloud phase.
- **Evidence:** E-PATH; PATH-1/PATH-2, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** In a future fix, normalize both sides consistently and enforce a real path-segment boundary; add native Windows and query-suffixed module-ID integration checks.


### F05 — Dedicated Billing Read token is not wired

- **Result:** FAIL.
- **Severity:** High HIGH-mode configuration blocker.
- **Confidence:** Confirmed full-source configuration wiring gap; live token permissions unknown.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [supabase/functions/_shared/boundary.ts](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/supabase/functions/_shared/boundary.ts), [supabase/functions/_shared/workers-ai.ts](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/supabase/functions/_shared/workers-ai.ts)
- **Confirmed cause / condition:** Full boundary.ts reads CLOUDFLARE_WORKERS_AI_TOKEN into CF_TOKEN and passes it to highIncluded at lines 173 and 256; it never reads CLOUDFLARE_BILLING_READ_TOKEN. highIncluded calls account subscriptions. Supplying only the dedicated billing credential requested by plan.md cannot affect eligibility.
- **Reproduction:** Read the full 285-line boundary file at 8acf; search environment reads and highIncluded call sites. Independently inspect Workers AI helper subscription GET. No secrets need be read. Real subscriptions GET with the connected OAuth account returned 403/code10000; that is a connector scope limit, not proof the app's AI token fails.
- **Actual observation and limits:** Configuration name is absent and one token is used for both subscription eligibility and inference. hardFreePlan passed ten synthetic cases. No HIGH inference was attempted or qualified.
- **Evidence:** E-BILLING; AI-01, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** A future authorized implementation should separate intended read/inference credentials, preserve fail-closed free-plan checks and test least-privilege permissions against staging without incurring inference costs. No credential or code changed.


### F06 — Available deployed intelligence target is older than the candidate

- **Result:** FAIL.
- **Severity:** High audit/release version blocker.
- **Confidence:** Confirmed deployed source/version mismatch.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [supabase/functions/_shared/boundary.ts](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/supabase/functions/_shared/boundary.ts), [src/lib/intelligence/edge-handler.ts](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/src/lib/intelligence/edge-handler.ts)
- **Confirmed cause / condition:** Staging ocade-intelligence and service are active v7 dated Oct 19. Retrieved staging source lacks candidate quotaReturnsAt support. Active Cloudflare serving version is dated Oct 19; no exact Oct 27 candidate target was found.
- **Reproduction:** List/get staging edge functions; compare the returned source with exact 8acf source markers and record version/time. Query Cloudflare worker deployments/versions read-only. Do not test ocade.in as if it were the implementation branch.
- **Actual observation and limits:** Staging v7 updated 2026-10-19T20:00:13.764Z; source missing the candidate quota cache. Real candidate inference/browser execution remains blocked. No deployment was performed.
- **Evidence:** E-STAGING; E-CLOUDFLARE; ENV-02, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** Only after separately authorized staging publication or provision of a $0 isolated runner, attest the exact source/build/version chain and repeat runtime tests. Never import old-version passes.


### F07 — In-flight Library delivery lacks an observable cancellation path

- **Result:** PARTIAL.
- **Severity:** High STOP/recovery risk.
- **Confidence:** Confirmed source omission; delayed-network behavior is untested.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [jarvis-runtime/ocade_computer.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_computer.py)
- **Confirmed cause / condition:** ocade_computer._deliver(path, rel, action) accepts no cancellation event and calls blocking urllib.request.urlopen(..., timeout=600) then reply.read(). The agent may set a cancel event, but this helper does not consult it during its PUT.
- **Reproduction:** Inspect _deliver lines 71–98 and caller cancellation plumbing. A future isolated test should hold a disposable upload response open, press STOP, and measure in-flight effects and new-action admission. This was not executed here.
- **Actual observation and limits:** No fresh 600-second hang or unauthorized upload was observed. Timeout=600 is a socket-operation limit, not a measured total completion time or guaranteed upper bound.
- **Evidence:** E-STOP; JARVIS-01, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** For future review, make delivery cancellation/deadlines explicit and report whether an admitted upload may have completed after STOP; test without destroying user files.


### F08 — Staging leaked-password protection is disabled

- **Result:** FAIL.
- **Severity:** Medium configuration finding.
- **Confidence:** Fresh provider advisor observation; no breached-password signup attempted.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** Environment/provider configuration or unavailable test capability; no product file blamed.
- **Confirmed cause / condition:** Supabase staging Auth advisor reports auth_leaked_password_protection WARN / disabled. This is environment configuration, not a source-line vulnerability.
- **Reproduction:** Read staging security advisors and inspect the single leaked-password warning. Do not change Auth configuration or submit real compromised credentials.
- **Actual observation and limits:** One WARN. Existing RLS and RPC checks do not compensate for password screening. Availability and any provider-plan implications were not assumed.
- **Evidence:** E-ADVISORS; DB-11, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** Separately review whether the feature is available within the approved plan and enable/test it only with authorization; keep authentication protections independently reviewed.
- **Primary references:** [Reference 1](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### F09 — Service-worker never-cache classifier omits exact /auth

- **Result:** FAIL.
- **Severity:** Medium cache-boundary gap; disclosure unproven.
- **Confidence:** Confirmed classifier failure only.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [public/sw.js](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/public/sw.js), [src/routes/auth.index.tsx](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/src/routes/auth.index.tsx)
- **Confirmed cause / condition:** public/sw.js excludes /auth/ descendants using startsWith, but exact /auth returns false; product links use /auth. Navigation caching also checks private/no-store, so classifier output alone does not prove sensitive data is stored.
- **Reproduction:** Extract/evaluate the exact isNeverCached function with /api/jarvis/device, /_serverFn/abc, /auth/verify, /auth, /help. Only /auth disagrees with the intended authentication exclusion. Full Cache API/navigation/account-switch test needs an isolated browser.
- **Actual observation and limits:** Expected true for /auth, actual false. No cross-account cache disclosure or session theft demonstrated.
- **Evidence:** E-SW; SW-4, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** In a future fix, cover the exact root as well as descendants and verify private response caching/account switching in a real browser.


### F10 — Windows DeepSeek linker uses bare npx with execFileSync

- **Result:** PARTIAL.
- **Severity:** Medium build portability risk.
- **Confidence:** Source unchanged; historical Windows failure not freshly reproduced.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [scripts/deepseek-link.mjs](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/scripts/deepseek-link.mjs)
- **Confirmed cause / condition:** scripts/deepseek-link.mjs invokes execFileSync('npx', ['prettier', ...]) without a Windows command-shim strategy. Typical Windows npm installations expose npx.cmd, which is not a directly executable binary for execFileSync.
- **Reproduction:** Inspect the final prettier invocation. A new disposable Windows runner with the exact branch and pinned Node/npm is needed to establish actual behavior. Prior owner-PC ENOENT is historical only and excluded from new counts.
- **Actual observation and limits:** Source-level portability risk remains. No current Windows command was run after the PC prohibition.
- **Evidence:** E-NPX; JARVIS-03, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** A future authorized fix should invoke a deterministic JS/bin entry or platform-safe command path, then test on clean Windows and Linux. No change made.
- **Primary references:** [Reference 1](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows)

### F11 — Quoted Python code is rejected as shell chaining

- **Result:** FAIL.
- **Severity:** Medium task usability/policy limitation.
- **Confidence:** Equivalent ASCII regex probe; not Python execution.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [jarvis-runtime/ocade_computer.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_computer.py)
- **Confirmed cause / condition:** SHELL_META is applied to the raw command before argv parsing, so a semicolon inside python -c quoted program text is treated the same as shell chaining.
- **Reproduction:** Evaluate the source character class against python -c "import PIL; print(PIL.__version__)". It matches. Do not execute it on the owner PC.
- **Actual observation and limits:** The benign example is blocked. This is a conservative policy/usability finding, not a security bypass. A particular failed JARVIS task is not newly reproduced.
- **Evidence:** E-COMMAND; COMMAND-01, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** Define the allowed command contract clearly; if such interpreter programs are supported, use structured argv/interpreter policy while preserving confirmation and confinement. Do not remove security checks wholesale.


### F12 — External native prerequisites remain unqualified

- **Result:** PARTIAL.
- **Severity:** Medium workflow readiness limitation.
- **Confidence:** Confirmed source dependencies; fresh installed-state diagnosis blocked.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [jarvis-runtime/ocade_media.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_media.py), [jarvis-runtime/ocade_computer.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_computer.py), [jarvis-runtime/packaging/ocade-agent.spec](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/packaging/ocade-agent.spec), [jarvis-runtime/ocade_agent.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_agent.py)
- **Confirmed cause / condition:** Media explicitly discovers ffmpeg/ffprobe from PATH; PDF conversion discovers LibreOffice/application converters. Agent packaging does not bundle these executables. Packaged Python imports do not establish an externally callable python command for JARVIS command tasks; health checks do not qualify the whole toolchain.
- **Reproduction:** Review discovery, packaging and health functions. In an isolated cloud OS, vary executable availability and observe capability reporting/refusal, then render/open outputs. No installation or probing of the owner's tools performed.
- **Actual observation and limits:** Historical missing Python/FFmpeg/LibreOffice symptoms are plausible dependency causes, not fresh current cloud failures. No multimedia/document render completed.
- **Evidence:** E-NATIVE; JARVIS-02, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** Document/qualify supported prerequisites and honest capability reporting; future isolated matrix tests should cover absent/present binaries. No dependency installed or bundled here.


### F13 — Windows subtitle filter path escaping needs reproduction

- **Result:** BLOCKED.
- **Severity:** Unrated hypothesis.
- **Confidence:** Source hypothesis only.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** [jarvis-runtime/ocade_media.py](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_media.py)
- **Confirmed cause / condition:** FFmpeg subtitles filter is formed with shown.as_posix() in a filter string; Windows drive-colon and special-character escaping may be interpreted as filter options.
- **Reproduction:** Future disposable Windows FFmpeg run with a caption path containing a drive letter, space and apostrophe; inspect stderr and rendered captions. No such run executed.
- **Actual observation and limits:** No confirmed FFmpeg error in this cloud audit. Do not count as a proven Windows defect.
- **Evidence:** E-NATIVE, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** If reproduced, use the filter's documented escaping/argument strategy and verify actual caption frames.


### B01 — Cloud execution, UI evidence and exact deployment are unavailable at $0

- **Result:** BLOCKED.
- **Severity:** Audit coverage blocker, not a product bug.
- **Confidence:** Connected-tool inventory and exact-head query.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** Environment/provider configuration or unavailable test capability; no product file blamed.
- **Confirmed cause / condition:** No free terminal/container is connected; connector can read/rerun but cannot dispatch workflows. Exact source head has zero workflow runs. Older runs exist on earlier commits and are excluded. TinyFish automation is metered; user selected available $0 checks only.
- **Reproduction:** Inspect available tool capabilities and GET Actions runs with head_sha=8acf. Compare TinyFish rates. Do not rerun an older-source job or spend balance.
- **Actual observation and limits:** No candidate Playwright, Python, emulator, JARVIS workflow, screenshot, model inference or stress suite executed.
- **Evidence:** E-RUNNER; E-COST, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** Future testing needs an already authorized $0 isolated runner or exact-candidate hosted target; never substitute personal PC or old deployment.


### B02 — Staging migration identity cannot be attested

- **Result:** BLOCKED.
- **Severity:** Version assurance blocker.
- **Confidence:** Read-only database metadata.
- **Source/environment:** exact product source 8acf290b27526cf2bf7abdb098769d24bbccbadf; staging/service snapshot when named.
- **Responsible files/configuration:** Environment/provider configuration or unavailable test capability; no product file blamed.
- **Confirmed cause / condition:** supabase_migrations.schema_migrations relation is absent. Existing table/policy matches do not establish every source migration is applied.
- **Reproduction:** Read catalog presence for supabase_migrations.schema_migrations and compare the candidate migration inventory. Do not create a migration table or apply migrations.
- **Actual observation and limits:** 42/42 public tables have RLS and scoped probes passed, but DB deployment cannot be labelled exact 8acf.
- **Evidence:** E-SCHEMA; DB-10, expanded in the master ledger.
- **Measurement:**0 real AI calls; source/metadata/probe only unless stated; no native task completion time or CPU/RAM measure; no candidate screenshots.
- **Recommended resolution, not implemented:** Obtain an authoritative migration/deployment manifest in a separately authorized environment, then repeat checks against that exact state.



## Complete returned Python advisory record inventory

[Exact pins](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/requirements-agent.txt): Pillow12.3.0 and pypdf6.19.0. Per-version [deps.dev metadata](https://docs.deps.dev/api/v3/#getversion) returned44 and11 advisory records respectively. GetAdvisory details were fetched for all55 records (one transient failure succeeded on retry). Three PYSEC records alias GHSA entries, so these form52 alias groups. No malicious payload was executed or supplied to staging or the owner's PC.

**A feed CVSS3 score0 below means no meaningful CVSS3 score was returned; it must not be read as severity NONE.** Several primary pages publish CVSS4 severity instead. The critical Pillow entry has a returned CVSS3 score9.8 and an independently checked maintainer affected range. Each record's concrete API reachability, platform/native-wheel conditions and exploitability still require an isolated runtime. Maintainer package fixes for one record do not automatically prove every record resolved.

| Package / pin | Advisory | Title | CVSS3 returned (0 = unavailable) | Aliases |
| --- | --- | --- | --- | --- |
| pillow / 12.3.0 | [GHSA-22hg-r758-rrw9](https://osv.dev/vulnerability/GHSA-22hg-r758-rrw9) | Pillow: Infinite loop in MIC n_frames when the embedded TIFF | 0 | BIT-pillow-2026-112390, CVE-2026-112390 |
| pillow / 12.3.0 | [GHSA-24rc-8hj2-v98c](https://osv.dev/vulnerability/GHSA-24rc-8hj2-v98c) | Pillow: BMP RLE decoder memory-amplification DoS via unbounded delta escape / absolute mode | 6.5 | CVE-2026-96638 |
| pillow / 12.3.0 | [GHSA-254f-3936-288h](https://osv.dev/vulnerability/GHSA-254f-3936-288h) | Pillow: PdfParser can recurse without limit in get_value() and linearize_page_tree() | 0 | BIT-pillow-2026-112391, CVE-2026-112391 |
| pillow / 12.3.0 | [GHSA-27h8-gf7j-v5hc](https://osv.dev/vulnerability/GHSA-27h8-gf7j-v5hc) | Pillow: NULL dereference in ImagingExpand via rank filters on zero-size images | 0 | BIT-pillow-2026-112392, CVE-2026-112392, PYSEC-2026-4326 |
| pillow / 12.3.0 | [GHSA-332p-7hrc-92wf](https://osv.dev/vulnerability/GHSA-332p-7hrc-92wf) | Pillow: Heap buffer overflow in _tiffWriteProc when saving TIFF to BytesIO | 0 | BIT-pillow-2026-112393, CVE-2026-112393 |
| pypdf / 6.19.0 | [GHSA-39mj-jf6j-2qj3](https://osv.dev/vulnerability/GHSA-39mj-jf6j-2qj3) | pypdf: Possible infinite loop when hitting EOF in standard xref table | 0 | CVE-2026-113794 |
| pillow / 12.3.0 | [GHSA-3j72-p6qg-6xp7](https://osv.dev/vulnerability/GHSA-3j72-p6qg-6xp7) | Pillow: TarIO negative size field causes infinite CPU-spin loop | 0 | CVE-2026-96642 |
| pillow / 12.3.0 | [GHSA-4558-3h8r-v8xp](https://osv.dev/vulnerability/GHSA-4558-3h8r-v8xp) | Pillow: P;2L and P;4L decoders may read 1 to 3 bytes past the passed buffer size | 0 | BIT-pillow-2026-112394, CVE-2026-112394, PYSEC-2026-4327 |
| pillow / 12.3.0 | [GHSA-462x-pgg6-55fp](https://osv.dev/vulnerability/GHSA-462x-pgg6-55fp) | Pillow tiled-TIFF decoder reads past tile buffer in copy4 (Unpack.c:1290) | 6.5 | BIT-pillow-2026-112395, CVE-2026-112395 |
| pillow / 12.3.0 | [GHSA-4rm8-3hmm-39fg](https://osv.dev/vulnerability/GHSA-4rm8-3hmm-39fg) | Pillow: Reachable undefined behavior in native integer operations, potentially leading to denial of service or logic integrity compromise | 6.5 | CVE-2026-96641 |
| pillow / 12.3.0 | [GHSA-4rr5-89j8-mwwm](https://osv.dev/vulnerability/GHSA-4rr5-89j8-mwwm) | Pillow: Heap use-after-free when encoding TIFF to an in-memory buffer | 5.9 | BIT-pillow-2026-112396, CVE-2026-112396, PYSEC-2026-4328 |
| pillow / 12.3.0 | [GHSA-58r4-6rv3-gfh8](https://osv.dev/vulnerability/GHSA-58r4-6rv3-gfh8) | Pillow: Out-of-bounds access in _imagingmorph on a zero-width image | 0 | BIT-pillow-2026-112397, CVE-2026-112397 |
| pypdf / 6.19.0 | [GHSA-5hx5-vpf9-5wcv](https://osv.dev/vulnerability/GHSA-5hx5-vpf9-5wcv) | pypdf: Unvalidated JPEG image data loading | 0 | CVE-2026-113786 |
| pillow / 12.3.0 | [GHSA-5x8w-8jj5-q52h](https://osv.dev/vulnerability/GHSA-5x8w-8jj5-q52h) | Pillow: Heap buffer overflow in FlashPix (FPX) JPEG decoding leads to code execution | 0 | BIT-pillow-2026-112398, CVE-2026-112398 |
| pillow / 12.3.0 | [GHSA-5xm2-6676-qcp9](https://osv.dev/vulnerability/GHSA-5xm2-6676-qcp9) | Pillow: APNG background disposal allocates full canvas before decompression bomb check | 0 | BIT-pillow-2026-112399, CVE-2026-112399 |
| pillow / 12.3.0 | [GHSA-654x-cwwv-5j9c](https://osv.dev/vulnerability/GHSA-654x-cwwv-5j9c) | Pillow: Arrow export leaks stale heap memory when PILLOW_ALIGNMENT > 1 | 0 | CVE-2026-114501 |
| pillow / 12.3.0 | [GHSA-65qm-jvmh-6pqg](https://osv.dev/vulnerability/GHSA-65qm-jvmh-6pqg) | Pillow: GIF seek keeps rejected size after DecompressionBombError, allowing DoS | 0 | BIT-pillow-2026-112400, CVE-2026-112400 |
| pypdf / 6.19.0 | [GHSA-6c7f-9265-g8fw](https://osv.dev/vulnerability/GHSA-6c7f-9265-g8fw) | pypdf: Possible long runtimes for repeated references to the same missing object | 0 | CVE-2026-115572 |
| pypdf / 6.19.0 | [GHSA-6vvc-x485-93v7](https://osv.dev/vulnerability/GHSA-6vvc-x485-93v7) | pypdf: Possible long runtimes/large memory usage when retrieving form fields | 0 | CVE-2026-113789 |
| pillow / 12.3.0 | [GHSA-74r2-7ff9-mjj2](https://osv.dev/vulnerability/GHSA-74r2-7ff9-mjj2) | Pillow: Quadratic GIF comment concatenation allows DoS in Image.open() | 0 | BIT-pillow-2026-112401, CVE-2026-112401 |
| pillow / 12.3.0 | [GHSA-78g4-xqwv-q3g8](https://osv.dev/vulnerability/GHSA-78g4-xqwv-q3g8) | Pillow: Bundled libopenjp2 2.5.4 in all wheels since 11.1.0 carries OSV-2025-219 heap-buffer-overflow write reachable from Image.open().load() | 8.1 |  |
| pypdf / 6.19.0 | [GHSA-7mh2-4gg2-979f](https://osv.dev/vulnerability/GHSA-7mh2-4gg2-979f) | pypdf: Possible large memory usage for streams with multiple filters | 0 | CVE-2026-113795 |
| pillow / 12.3.0 | [GHSA-7mwm-ghpf-9vrm](https://osv.dev/vulnerability/GHSA-7mwm-ghpf-9vrm) | Pillow: Double free in ImagingScaleAffine on calloc failure via Image.transform | 0 | BIT-pillow-2026-112402, CVE-2026-112402 |
| pillow / 12.3.0 | [GHSA-8g5g-8vmr-9782](https://osv.dev/vulnerability/GHSA-8g5g-8vmr-9782) | Pillow: Heap buffer overflow in ImagingJpegDecode | 0 | BIT-pillow-2026-112403, CVE-2026-112403 |
| pypdf / 6.19.0 | [GHSA-9mx8-4j7g-633p](https://osv.dev/vulnerability/GHSA-9mx8-4j7g-633p) | pypdf: Possible infinite loop when removing tree items | 0 | CVE-2026-113793 |
| pillow / 12.3.0 | [GHSA-9v9v-9qvf-h2hj](https://osv.dev/vulnerability/GHSA-9v9v-9qvf-h2hj) | Pillow: Heap over-read in WMF/EMF rendering via 16-bit dimension truncation (Windows builds) | 0 | CVE-2026-96644 |
| pillow / 12.3.0 | [GHSA-c6hw-5grf-ff96](https://osv.dev/vulnerability/GHSA-c6hw-5grf-ff96) | Pillow: OOB read in TiffDecode.c tile and RGBA paths leaks heap memory into pixels | 0 | BIT-pillow-2026-112404, CVE-2026-112404 |
| pypdf / 6.19.0 | [GHSA-cgf9-327m-v77c](https://osv.dev/vulnerability/GHSA-cgf9-327m-v77c) | pypdf: Possible large memory usage when parsing content streams | 0 | CVE-2026-113791 |
| pillow / 12.3.0 | [GHSA-cp9v-662q-vvx9](https://osv.dev/vulnerability/GHSA-cp9v-662q-vvx9) | Pillow: NULL pointer dereference in Image.merge via an unvalidated band 0 | 0 | BIT-pillow-2026-112405, CVE-2026-112405 |
| pillow / 12.3.0 | [GHSA-f2g6-542v-9j58](https://osv.dev/vulnerability/GHSA-f2g6-542v-9j58) | Pillow: Infinite loop in PdfParser.rewrite_pages on page tree Parent cycle | 0 | BIT-pillow-2026-112406, CVE-2026-112406 |
| pypdf / 6.19.0 | [GHSA-f54x-cmq8-qg57](https://osv.dev/vulnerability/GHSA-f54x-cmq8-qg57) | pypdf: Possible large memory usage when parsing arrays and dictionaries | 0 | CVE-2026-113790 |
| pillow / 12.3.0 | [GHSA-fc9g-5qg7-mf45](https://osv.dev/vulnerability/GHSA-fc9g-5qg7-mf45) | Pillow: Quadratic GIF comment copying during save | 0 | BIT-pillow-2026-112891, CVE-2026-112891 |
| pillow / 12.3.0 | [GHSA-g4qv-2jxx-769h](https://osv.dev/vulnerability/GHSA-g4qv-2jxx-769h) | Pillow: PNG eXIf chunk makes EXIF parsing run in quadratic time | 0 | CVE-2026-96643 |
| pillow / 12.3.0 | [GHSA-g7cr-3p24-7wf7](https://osv.dev/vulnerability/GHSA-g7cr-3p24-7wf7) | Pillow: Heap buffer overflow writing JPEG comment after ICC profile fills buffer | 0 | CVE-2026-96778 |
| pillow / 12.3.0 | [GHSA-g842-9rc4-69pw](https://osv.dev/vulnerability/GHSA-g842-9rc4-69pw) | Pillow: Decompression bomb check bypass in SpiderImagePlugin.seek() leads to unbounded allocation DoS | 0 | CVE-2026-96637 |
| pillow / 12.3.0 | [GHSA-gg2r-wvfm-q9rx](https://osv.dev/vulnerability/GHSA-gg2r-wvfm-q9rx) | Pillow: MSP RLE decoder expands a tiny file into unbounded memory | 0 | BIT-pillow-2026-112892, CVE-2026-112892 |
| pypdf / 6.19.0 | [GHSA-gmh7-3g9r-mjh5](https://osv.dev/vulnerability/GHSA-gmh7-3g9r-mjh5) | pypdf: Possible long runtimes for large xref table header limits | 0 | CVE-2026-115580 |
| pillow / 12.3.0 | [GHSA-j4m9-6w36-pw47](https://osv.dev/vulnerability/GHSA-j4m9-6w36-pw47) | Pillow: Invalid free in FreeType glyph rendering when a stroker is active | 0 | BIT-pillow-2026-112893, CVE-2026-112893 |
| pillow / 12.3.0 | [GHSA-jg86-v3jv-hrpm](https://osv.dev/vulnerability/GHSA-jg86-v3jv-hrpm) | Pillow: Quadratic-time DoS in PDF save_all (PdfParser.next_object_id) | 0 | BIT-pillow-2026-112894, CVE-2026-112894 |
| pypdf / 6.19.0 | [GHSA-jr96-gvgh-j3r4](https://osv.dev/vulnerability/GHSA-jr96-gvgh-j3r4) | pypdf: Possible long runtimes for repeated malformed cross-reference entries (Follow-up) | 0 | CVE-2026-115585 |
| pillow / 12.3.0 | [GHSA-mrfp-p49p-3hf2](https://osv.dev/vulnerability/GHSA-mrfp-p49p-3hf2) | Pillow PDF append accepts malformed shared page-tree DAG causing resource exhaustion | 0 | CVE-2026-96640 |
| pillow / 12.3.0 | [GHSA-p4wg-p73j-c528](https://osv.dev/vulnerability/GHSA-p4wg-p73j-c528) | Pillow: Unbounded recursion parsing a PDF page tree or trailer chain (incomplete fix for CVE-2026-42310) | 0 | BIT-pillow-2026-112895, CVE-2026-112895 |
| pillow / 12.3.0 | [GHSA-p8hx-v2p6-rp84](https://osv.dev/vulnerability/GHSA-p8hx-v2p6-rp84) | Pillow: Decompression-bomb protection bypass via multi-frame seek() in MPO and DCX (MpoImageFile.seek / DcxImageFile.seek) | 6.5 | CVE-2026-96636 |
| pillow / 12.3.0 | [GHSA-pchr-8j38-3x4p](https://osv.dev/vulnerability/GHSA-pchr-8j38-3x4p) | Pillow: TIFF encoder ColorMap plane-size mismatch causes a heap out-of-bounds read | 0 | BIT-pillow-2026-112896, CVE-2026-112896 |
| pillow / 12.3.0 | [GHSA-q45j-58j2-45rg](https://osv.dev/vulnerability/GHSA-q45j-58j2-45rg) | Pillow: TiffDecode returns uninitialized memory as pixels for short JPEG strips | 0 | BIT-pillow-2026-112897, CVE-2026-112897 |
| pypdf / 6.19.0 | [GHSA-qfv9-64jg-mh7p](https://osv.dev/vulnerability/GHSA-qfv9-64jg-mh7p) | pypdf: Possible infinite loop in PdfWriter.find_outline_item | 0 | CVE-2026-113792 |
| pillow / 12.3.0 | [GHSA-rfgq-q3w2-pmv2](https://osv.dev/vulnerability/GHSA-rfgq-q3w2-pmv2) | Pillow: Image.quantize() with empty palette leaks uninitialized stack memory | 0 | BIT-pillow-2026-112898, CVE-2026-112898 |
| pillow / 12.3.0 | [GHSA-v9pv-5gc8-w2m6](https://osv.dev/vulnerability/GHSA-v9pv-5gc8-w2m6) | Pillow multi-frame loaders can reuse stale native image storage after mode transitions | 9.8 | CVE-2026-96639 |
| pillow / 12.3.0 | [GHSA-vx6w-vv9f-6gvg](https://osv.dev/vulnerability/GHSA-vx6w-vv9f-6gvg) | Pillow: EPS load(scale) lets Ghostscript render past the decompression bomb limit | 0 | CVE-2026-112899 |
| pillow / 12.3.0 | [GHSA-w889-685w-c8fh](https://osv.dev/vulnerability/GHSA-w889-685w-c8fh) | Pillow: Argument Injection in Ghostscript call, potentially leading into RCE | 0 | BIT-pillow-2026-112900, CVE-2026-112900 |
| pillow / 12.3.0 | [GHSA-xgh8-jp6q-p5x8](https://osv.dev/vulnerability/GHSA-xgh8-jp6q-p5x8) | Pillow: ReDoS in XbmImagePlugin: 512-byte file stalls Image.open() for minutes | 0 | BIT-pillow-2026-112901, CVE-2026-112901 |
| pillow / 12.3.0 | [GHSA-xvh5-g6gv-559v](https://osv.dev/vulnerability/GHSA-xvh5-g6gv-559v) |  Pillow: Memory disclosure and segfault in libtiff encoder via crafted TIFF tags | 0 | CVE-2026-112902 |
| pillow / 12.3.0 | [PYSEC-2026-4326](https://osv.dev/vulnerability/PYSEC-2026-4326) | PYSEC-2026-4326 | 7.5 | BIT-pillow-2026-112392, CVE-2026-112392, GHSA-27h8-gf7j-v5hc |
| pillow / 12.3.0 | [PYSEC-2026-4327](https://osv.dev/vulnerability/PYSEC-2026-4327) | PYSEC-2026-4327 | 8.2 | BIT-pillow-2026-112394, CVE-2026-112394, GHSA-4558-3h8r-v8xp |
| pillow / 12.3.0 | [PYSEC-2026-4328](https://osv.dev/vulnerability/PYSEC-2026-4328) | PYSEC-2026-4328 | 7.5 | BIT-pillow-2026-112396, CVE-2026-112396, GHSA-4rr5-89j8-mwwm |


### Independently checked affected-range examples

- [Pillow critical multi-frame advisory](https://github.com/python-pillow/Pillow/security/advisories/GHSA-v9pv-5gc8-w2m6):12.3.0 lies in the maintainer's affected range;13.0.0 is listed patched. The multi-frame/native-state trigger is not proven through OCADE's actual task path.
- [Pillow XBM parsing advisory](https://github.com/python-pillow/Pillow/security/advisories/GHSA-xgh8-jp6q-p5x8):12.3.0 is affected. OCADE calls Image.open; file suffix restrictions do not establish content-format safety because the decoder inspects content. Actual delay reported by upstream is **not an OCADE-measured delay**.
- [Pillow TIFF re-save advisory](https://github.com/python-pillow/Pillow/security/advisories/GHSA-xvh5-g6gv-559v):12.3.0 affected,13.0.0 listed patched; it requires a particular TIFF save path, unverified in OCADE.
- [pypdf xref-loop advisory](https://github.com/py-pdf/pypdf/security/advisories/GHSA-39mj-jf6j-2qj3):6.19.0 is below the6.20.0 fix. OCADE initializes PdfReader before applying its extracted-text limit; no malformed PDF executed in this campaign.

## Staging advisor backlog (not automatically product failures)

Security snapshot observed2026-10-28T07:15:04.329Z; performance snapshot07:15:03.999Z. Leaked-password protection is the confirmed configuration finding F08. **RLS enabled with no policy normally denies client access** and can be intentional for server-only tables; do not report17 exposed tables. **SECURITY DEFINER EXECUTE is not itself an exploit**; callable functions may enforce ownership/MFA/staff checks. Two narrow denial paths passed, not all41. Unused indexes are not evidence of poor live performance and should not be blindly removed.

| Advisor | Level | Count | Official guidance |
| --- | --- | --- | --- |
| rls_enabled_no_policy | INFO | 17 | [remediation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |
| authenticated_security_definer_function_executable | WARN | 41 | [remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| auth_leaked_password_protection | WARN | 1 | [remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| unindexed_foreign_keys | INFO | 5 | [remediation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |
| unused_index | INFO | 43 | [remediation](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) |


### Every advisor target returned

| Advisor | Target / detail |
| --- | --- |
| rls_enabled_no_policy | Table \`public.ocade_admin_actions\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_device_usage_keys\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_device_usage_leases\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_generation_permits\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_jarvis_task_charges\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_mfa_recovery_attempts\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_mfa_recovery_codes\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_offline_usage_allocations\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_offline_usage_events\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_push_subscriptions\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_service_control_events\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_service_controls\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_staff\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_staff_invites\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_support_cases\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_unlimited_grants\` has RLS enabled, but no policies exist |
| rls_enabled_no_policy | Table \`public.ocade_usage_adjustments\` has RLS enabled, but no policies exist |
| authenticated_security_definer_function_executable | Function `public.has_role(_user_id uuid, _role public.app_role)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/has_role`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_admin_remove_device(device uuid, remove_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_admin_remove_device`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_case_close(p_case uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_case_close`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_case_conversations(p_customer uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_case_conversations`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_case_messages(p_case uuid, p_conversation uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_case_messages`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_case_open(p_customer uuid, p_reason text, p_hours integer, p_conversation uuid, p_assignee uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_case_open`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_factor_added_since_sign_in(p_unverified_too boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_factor_added_since_sign_in`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_grant_entitlement(target_user uuid, grant_tier text, grant_reason text, days integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_grant_entitlement`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_grant_unlimited(p_user uuid, p_until timestamp with time zone, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_grant_unlimited`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_mark_all_notifications_read()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_mark_all_notifications_read`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_mark_notification_read(p_notification_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_mark_notification_read`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_my_entitlement_grant()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_my_entitlement_grant`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_my_staff()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_my_staff`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_push_subscribe(p_endpoint text, p_p256dh text, p_auth text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_push_subscribe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_push_unsubscribe(p_endpoint text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_push_unsubscribe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_read_service_controls()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_read_service_controls`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_record_online_ai_consent(p_version text, p_given boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_record_online_ai_consent`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_revoke_entitlement(grant_id uuid, revoke_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_revoke_entitlement`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_revoke_unlimited(p_user uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_revoke_unlimited`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_save_notification_preferences(p_mute_optional boolean, p_quiet_hours jsonb, p_categories jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_save_notification_preferences`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_session_meets_second_factor()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_session_meets_second_factor`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_set_service_control(control_key text, pause boolean, change_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_set_service_control`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_spend_proof(p_action text, p_target_digest text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_spend_proof`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_adjust_usage(p_user uuid, p_surface text, p_window_kind text, p_delta_hundredths bigint, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_adjust_usage`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_begin_account_deletion(p_user uuid, p_email text, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_begin_account_deletion`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_can(p_permission text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_can`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_end_all_sessions(p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_end_all_sessions`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_end_customer_sessions(p_user uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_end_customer_sessions`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_grant(p_email text, p_role text, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_grant`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_reset_second_factor(p_user uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_reset_second_factor`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_revoke(p_user uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_revoke`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_role_defaults()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_role_defaults`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_set_permissions(p_user uuid, p_granted text[], p_denied text[], p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_set_permissions`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_suspend_account(p_user uuid, p_suspend boolean, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_suspend_account`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_transfer_ownership(p_to uuid, p_reason text, p_stay_owner boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_transfer_ownership`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_staff_withdraw_invite(p_invite uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_staff_withdraw_invite`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_support_share(p_conversation uuid, p_hours integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_support_share`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_support_unshare(p_conversation uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_support_unshare`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.ocade_two_step_set_up_in_this_sign_in()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ocade_two_step_set_up_in_this_sign_in`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.register_browser_device_for_current_user(_browser_install_id text, _kind public.device_kind, _name text, _origin text, _user_agent text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/register_browser_device_for_current_user`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| authenticated_security_definer_function_executable | Function `public.revoke_device_for_current_user(_device_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/revoke_device_for_current_user`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. |
| auth_leaked_password_protection | Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security. |
| unindexed_foreign_keys | Table \`public.ocade_jarvis_task_charges\` has a foreign key \`ocade_jarvis_task_charges_user_id_fkey\` without a covering index. This can lead to suboptimal query performance. |
| unindexed_foreign_keys | Table \`public.ocade_service_control_events\` has a foreign key \`ocade_service_control_events_changed_by_fkey\` without a covering index. This can lead to suboptimal query performance. |
| unindexed_foreign_keys | Table \`public.ocade_service_controls\` has a foreign key \`ocade_service_controls_changed_by_fkey\` without a covering index. This can lead to suboptimal query performance. |
| unindexed_foreign_keys | Table \`public.ocade_support_shares\` has a foreign key \`ocade_support_shares_conversation_fkey\` without a covering index. This can lead to suboptimal query performance. |
| unindexed_foreign_keys | Table \`public.ocade_usage_adjustments\` has a foreign key \`ocade_usage_adjustments_actor_fkey\` without a covering index. This can lead to suboptimal query performance. |
| unused_index | Index \`profiles_email_trgm_idx\` on table \`public.profiles\` has not been used |
| unused_index | Index \`profiles_display_name_trgm_idx\` on table \`public.profiles\` has not been used |
| unused_index | Index \`ocade_entitlement_grants_revoked_by_idx\` on table \`public.ocade_entitlement_grants\` has not been used |
| unused_index | Index \`jarvis_tasks_conversation_idx\` on table \`public.jarvis_tasks\` has not been used |
| unused_index | Index \`jarvis_devices_pending_idx\` on table \`public.jarvis_devices\` has not been used |
| unused_index | Index \`ocade_service_control_events_recent\` on table \`public.ocade_service_control_events\` has not been used |
| unused_index | Index \`ocade_admin_actions_target\` on table \`public.ocade_admin_actions\` has not been used |
| unused_index | Index \`ocade_admin_actions_actor\` on table \`public.ocade_admin_actions\` has not been used |
| unused_index | Index \`browser_grants_device_idx\` on table \`public.browser_grants\` has not been used |
| unused_index | Index \`activity_log_user_time_idx\` on table \`public.activity_log\` has not been used |
| unused_index | Index \`ocade_staff_granted_by\` on table \`public.ocade_staff\` has not been used |
| unused_index | Index \`ocade_staff_invites_invited_by\` on table \`public.ocade_staff_invites\` has not been used |
| unused_index | Index \`ocade_staff_invites_accepted_by\` on table \`public.ocade_staff_invites\` has not been used |
| unused_index | Index \`ocade_support_cases_customer\` on table \`public.ocade_support_cases\` has not been used |
| unused_index | Index \`ocade_support_cases_opened_by\` on table \`public.ocade_support_cases\` has not been used |
| unused_index | Index \`jarvis_schedules_due_idx\` on table \`public.jarvis_schedules\` has not been used |
| unused_index | Index \`jarvis_schedules_conversation_idx\` on table \`public.jarvis_schedules\` has not been used |
| unused_index | Index \`ocade_push_subscriptions_user\` on table \`public.ocade_push_subscriptions\` has not been used |
| unused_index | Index \`ocade_usage_adjustments_user_idx\` on table \`public.ocade_usage_adjustments\` has not been used |
| unused_index | Index \`ocade_unlimited_grants_granted_by\` on table \`public.ocade_unlimited_grants\` has not been used |
| unused_index | Index \`ocade_unlimited_grants_revoked_by\` on table \`public.ocade_unlimited_grants\` has not been used |
| unused_index | Index \`ocade_offline_usage_events_reconcile_idx\` on table \`public.ocade_offline_usage_events\` has not been used |
| unused_index | Index \`ocade_support_cases_assignee\` on table \`public.ocade_support_cases\` has not been used |
| unused_index | Index \`ocade_support_cases_conversation\` on table \`public.ocade_support_cases\` has not been used |
| unused_index | Index \`storage_tombstones_pending_idx\` on table \`public.storage_tombstones\` has not been used |
| unused_index | Index \`storage_tombstones_owner_idx\` on table \`public.storage_tombstones\` has not been used |
| unused_index | Index \`audit_log_user_id_fkey_1153b6e373_idx\` on table \`public.compliance_audit_log\` has not been used |
| unused_index | Index \`browser_grants_approved_by_grant_id_fkey_7991afa0dd_idx\` on table \`public.browser_grants\` has not been used |
| unused_index | Index \`ocade_conversations_user_id_fkey_71b8a96cfd_idx\` on table \`public.ocade_conversations\` has not been used |
| unused_index | Index \`ocade_messages_user_id_fkey_7dbe63062c_idx\` on table \`public.ocade_messages\` has not been used |
| unused_index | Index \`legal_consent_receipts_user_accepted_idx\` on table \`public.legal_consent_receipts\` has not been used |
| unused_index | Index \`ocade_mfa_recovery_codes_user_unused_idx\` on table \`public.ocade_mfa_recovery_codes\` has not been used |
| unused_index | Index \`jarvis_schedules_claimed_idx\` on table \`public.jarvis_schedules\` has not been used |
| unused_index | Index \`ocade_notifications_account_unread_idx\` on table \`public.ocade_notifications\` has not been used |
| unused_index | Index \`ocade_support_shares_live\` on table \`public.ocade_support_shares\` has not been used |
| unused_index | Index \`ocade_device_usage_leases_active_idx\` on table \`public.ocade_device_usage_leases\` has not been used |
| unused_index | Index \`ocade_device_usage_leases_device_idx\` on table \`public.ocade_device_usage_leases\` has not been used |
| unused_index | Index \`ocade_offline_usage_allocations_device_idx\` on table \`public.ocade_offline_usage_allocations\` has not been used |
| unused_index | Index \`ocade_offline_usage_allocations_lease_idx\` on table \`public.ocade_offline_usage_allocations\` has not been used |
| unused_index | Index \`ocade_offline_usage_events_device_idx\` on table \`public.ocade_offline_usage_events\` has not been used |
| unused_index | Index \`ocade_offline_usage_events_user_idx\` on table \`public.ocade_offline_usage_events\` has not been used |
| unused_index | Index \`ocade_entitlement_grants_granted_by_idx\` on table \`public.ocade_entitlement_grants\` has not been used |
| unused_index | Index \`ocade_library_items_conversation_idx\` on table \`public.ocade_library_items\` has not been used |


## Blocked runtime work and unverified hypotheses

| Check | Blocker / limit |
| --- | --- |
| ENV-03 — BLOCKED | No hosted target tied to 8acf was found. Active deployment metadata is Oct 19. Older deployments were not UI-tested. |
| ENV-04 — BLOCKED | Exact-head workflow-runs query returned total_count=0. Connected GitHub tools cannot dispatch a new workflow; no $0 terminal is connected. |
| DB-10 — BLOCKED | supabase_migrations.schema_migrations absent; exact source migration parity cannot be attested. |
| DB-12 — PARTIAL | 41 executable-definer warnings; two scoped refusal paths checked, not all 41. Warnings are not 41 exploits. |
| DB-13 — PARTIAL | 5 unindexed-FK INFO and 43 unused-index INFO observations. No load, latency or saturation test. |
| AI-02 — BLOCKED | Subscriptions GET refused HTTP403/code10000 because connector OAuth lacks this scope; does not establish the application's token permissions. |
| AI-03 — BLOCKED | No live provider request sent; stale staging not credited as candidate. |
| AI-04 — BLOCKED | No Workers AI request sent; predicate tests do not qualify inference. |
| AI-05 — BLOCKED | No provider calls, quota exhaustion or fault injection performed. |
| OFF-03 — BLOCKED | Full 484220160 bytes not read/hashed; expected SHA256 in manifest is not proof of stored bytes. |
| OFF-04 — BLOCKED | No local-model generation executed; no answer accuracy/time/memory measurement. |
| OFF-05 — BLOCKED | No browser storage or interrupted/ranged delivery tests executed. |
| DEP-04 — PARTIAL | Licences recorded for selected npm entries and 25 Python pins. Nonstandard/missing declarations and distribution obligations not legally qualified; transitive Python dependencies not resolved. |
| JARVIS-01 — PARTIAL | _deliver has no cancellation parameter and uses blocking urlopen(timeout=600); in-flight PUT interruption is unproven. Source gap, not fresh observed 600-second hang. |
| JARVIS-02 — PARTIAL | FFmpeg/ffprobe, PDF converter and CLI Python are external prerequisites; packaging/health checks do not establish availability. No fresh OS dependency installation/probe. |
| JARVIS-03 — PARTIAL | deepseek-link invokes bare npx with execFileSync. Historical Windows ENOENT is consistent; no current isolated Windows reproduction. |
| JARVIS-04 — BLOCKED | Source contains geometry/observation fences, but no real focus change or stale-frame reproduction. |
| JARVIS-05 — BLOCKED | No new file, spreadsheet, Word, PDF, photo, video or CAD task completed; no manual rescue. |
| WEB-02 — BLOCKED | 23 route source files inventoried; no page/button/menu/form/mobile/a11y journey executed against candidate. |
| WEB-04 — PARTIAL | CSP connect policy is scoped to self/configured service. OAuth uses safeNext and session validation. Full built headers/redirects/browser enforcement not run. |
| WEB-05 — BLOCKED | Function requires browser-compatible URL; this V8 environment has no URL. No fake parser substituted; real redirect test remains unexecuted. |

All88 numbered plan execution requirements, six prompt scenarios, five elite tasks,90 held-out slots and10 gates are preserved in the master register. No browser page availability result is counted as chess gameplay, JARVIS control or native-device performance.

## Previous failures: cause classification

- **Old id-only server / receipt agent:** a genuine version incompatibility condition, but current matched source sends receipts. It is not reported as a fresh matched-version failure. Backlog length mismatch F03 is a separate current source condition.
- **Missing Python/FFmpeg/LibreOffice:** current source still depends on external/native tooling, but no fresh cloud OS probe ran. Historical absence on the PC is not fresh cloud evidence.
- **CSP/local routing:** remote candidate's online client uses configured Supabase. An earlier local-only endpoint override/relay was an uncommitted test setup, excluded from this audit. No recommendation to weaken CSP follows.
- **Stale screenshot/wrong target/unfinished tasks/repeated actions/excess AI calls:** current source includes safeguards but they were not exercised. Old PC symptoms remain historical; no claim of either fix or fresh reproduction.
- **Video/image/PDF/Notepad/browser/Office/CAD:** no current cloud render, native open, board move, output file, timing or independent correctness inspection occurred.
- **Subtitle path:** F13 is only a hypothesis. Unavailable FFmpeg cloud execution is not proof of a product error.
- **MFA/Google sign-in/prompt injection:** not bypassed or tested through the owner's account. Session unit cases and SQL role probes do not prove real authentication or malicious-document isolation.

## Release decision and change boundary

Evidence supports **0/10 release gates qualified (0%)**,0/5 elite executions,0/90 held-out executions, and0 current-candidate end-to-end JARVIS workflows. These are evidence-completion metrics; product success/accuracy rates remain undefined. Known affected dependencies prevent a clean dependency/security gate even before runtime coverage is obtained.

No product code, fixes, dependency upgrades, security settings, deployments, personal-PC state or main branch changes are included. The report-only commit is based on8acf and must contain exactly testing results.md, failuer.md and passes.md.
