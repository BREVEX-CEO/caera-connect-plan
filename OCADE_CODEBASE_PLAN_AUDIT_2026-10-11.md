## 1. Executive verdict

**OCADE has substantial real implementation, but the inspected source does not establish a safe, commercially ready product.** It contains working integration paths for online planning, local device execution, Windows accessibility, Office automation, browser control, Android, offline model storage and account administration. These are more than placeholders.

The largest remaining problems are in the contracts connecting those components:

- Completion can be recorded without verifying the requested output.
- Claimed device segments do not recheck subsequently withdrawn permissions.
- Some cancellation checks occur before further blocking target resolution.
- Missing or unknown acknowledgements can cause recovery evidence to be discarded.
- Undo can overwrite later user edits.
- Office failures can misreport partial effects or successful verification.
- Required verification harnesses can return success with missing coverage.

My weighted **non-payment implementation estimate is 43.3%**. Full PLAN implementation is **42.5%**. These are judgement-based implementation estimates, not measured product reliability.

**Verified operational readiness is undetermined.** No complete acceptance record for this exact candidate was established during this audit. Historical local test records provide useful partial evidence, but do not close the current release gates.

This was read-only. I did not change files, run tests/builds, start applications or agents, mutate databases, commit, push or deploy.

## 2. Verified Git baseline

| Item | Verified value |
|---|---|
| Repository | `BREVEX-CEO/caera-connect-plan` |
| Working branch | `ocade/p00-p22-implementation` |
| HEAD | `d22b0f70a5cfbffb867bd354d1606b6f544b33ab` |
| Remote implementation branch | Same SHA |
| Local main / origin/main / live remote main | `d70484da2ddaa910d221ed7f2aa7858c2346fdbd` |
| Final baseline check | 11 October 2026, approximately 19:18 IST |
| Authoritative PLAN | Current working-tree [PLAN.md](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:3), including §0’s 11 October instructions |
| PLAN SHA-256 | `e03ac1d38b61494d5668885bd3ba7ab12fedd52ce13c3f36fe038678d45340d2` |

The tree was initially clean. Claude edited three files during the audit; those changes were preserved and inspected.

| Uncommitted file | Net lines | Working SHA-256 |
|---|---:|---|
| [ocade_sheets.py](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:220) | +8 | `def9d5f4335ddde35a1b6e3e978b9f8b529580d87f1dff8b2ae080fdf3bb703f` |
| [mfa-journey.mjs](C:/Users/haans/Desktop/caera-connect-plan/scripts/e2e/mfa-journey.mjs) | +2 | `070e13fef4c85942fb5ffbb9fb0e5d2d0677b36fcdc8251079d4f12b4acc3f00` |
| [office-journey.mjs](C:/Users/haans/Desktop/caera-connect-plan/scripts/e2e/office-journey.mjs) | +7 | `d0fa65c40910225ca8f9e87f009e14fd4c391fcc5134ec424016138560c8a6fc` |

The Office journey now uses `automation_server` instead of the removed availability helpers. I have **not** counted that already-repaired call mismatch as a current defect.

The authority map remains:

| Concern | Authority |
|---|---|
| Scope and implementation sequence | [PLAN](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:90) |
| Product requirements | [PRD](C:/Users/haans/Desktop/caera-connect-plan/docs/PRD.md) |
| Protocol and architecture | [Architecture](C:/Users/haans/Desktop/caera-connect-plan/docs/ARCHITECTURE.md) |
| Presentation and interaction | [Design system](C:/Users/haans/Desktop/caera-connect-plan/docs/JARVIS_DESIGN_SYSTEM.md) |
| Security, support and provenance | [Support/legal/security](C:/Users/haans/Desktop/caera-connect-plan/docs/SUPPORT_LEGAL_SECURITY.md) |
| Acceptance evidence | [Testing](C:/Users/haans/Desktop/caera-connect-plan/docs/TESTING.md) |
| Binding decisions | [Decisions](C:/Users/haans/Desktop/caera-connect-plan/docs/DECISIONS.md) |
| Retirement candidates | [ToRemove](C:/Users/haans/Desktop/caera-connect-plan/ToRemove.md) |

Latest instructions preserve local customer-PC execution, separate Chat Offline from online-only JARVIS, prohibit donor reimport, require independent outcomes and retain payments/release deferral.

**Audit coverage limitation:** all 935 tracked paths were inventoried and hashed. The historical checkpoint accounts for 989 baseline paths: 957 text reviews, 26 structural inspections, three empty and three generated files. Of the current paths, **810 matched that checkpoint by raw or LF-normalised content; 125 were changed/new**.

I carried unchanged review provenance forward and inspected changed-file material and relevant call chains. This is **not a claim that I freshly reread every line of all 935 files**. Some large test/diff outputs were truncated; critical implementation paths were subsequently inspected directly, but I cannot provide a defensible fresh full-text coverage percentage. Binary/generated material received structural treatment. The review manifest remained in memory because creating an audit file was prohibited.

## 3. Exact code statistics

### Counting rules

Counts use tracked files only. A physical newline-delimited line counts once, including a final unterminated line. Blank lines contain only whitespace.

Production includes active application/runtime source. Tests, harnesses, configuration, tooling, SQL migrations/rollback, documentation, lockfiles, generated declarations and binary assets are separate. Dependencies and deleted donor files are excluded.

These are **physical source-line counts**, not an assertion that every line is executable. Cross-language comment/effective-code counts were not reliably established.

### Committed HEAD versus inspected working tree

| Classification | Files | HEAD lines | Working lines | Working blank lines | Working bytes |
|---|---:|---:|---:|---:|---:|
| Production source | 221 | **54,177** | **54,185** | 3,386 | 2,162,160 |
| Tests and harnesses | 301 | 46,115 | 46,124 | 3,798 | 1,903,858 |
| Configuration, infrastructure, migrations and tooling | 342 | 30,484 | 30,484 | 2,584 | 1,266,819 |
| Documentation, legal and evidence | 44 | 43,737 | 43,737 | 4,457 | 3,352,068 |
| Generated source/declarations | 5 | 2,907 | 2,907 | 28 | 87,006 |
| Dependency lockfile | 1 | 8,226 | 8,226 | 0 | 288,052 |
| Binary assets | 21 | — | — | — | 3,755,076 |
| **All tracked files** | **935** | **185,646 text lines** | **185,663 text lines** | **14,253** | **12,815,039** |

Additional useful totals:

- **Tracked code/configuration/test/declaration lines:** **133,700 working**, **133,683 committed**.
- Excluding generated declarations: **130,793 working**.
- Code/configuration/test/declaration bytes: **5,419,843 working**.
- Production nonblank lines: **50,799**. This is not comment-free executable LOC.
- Committed total tracked bytes: **12,811,024**.

Raw byte differences also include working-copy line endings; Git reports only the three dirty files above.

### Language breakdown

“All code” below includes tests, configuration/tooling and generated declarations, but excludes documentation, lockfiles and binaries.

| Language | Production files | Production lines | All code files | All code lines |
|---|---:|---:|---:|---:|
| TypeScript | 147 | 29,863 | 270 | 55,615 |
| TSX | 44 | 14,766 | 44 | 14,766 |
| Python | 14 | 5,840 | 36 | 11,342 |
| Java | 9 | 2,197 | 10 | 2,222 |
| PowerShell | 2 | 321 | 3 | 372 |
| JavaScript | 2 | 478 | 3 | 568 |
| CSS | 2 | 621 | 2 | 621 |
| HTML | 1 | 99 | 1 | 99 |
| SQL | 0 | 0 | 423 | 30,704 |
| MJS | 0 | 0 | 42 | 15,630 |
| MTS | 0 | 0 | 2 | 548 |
| Shell | 0 | 0 | 1 | 43 |
| Other configuration/text | 0 | 0 | 32 | 1,170 |
| **Total** | **221** | **54,185** | **869** | **133,700** |

Supabase Edge Function TypeScript is included in production. SQL migrations and their verification/rollback files are classified separately.

### Major directories

| Directory | Tracked files | All text lines | Production lines |
|---|---:|---:|---:|
| Root files | 23 | 12,865 | 0 |
| `.claude` | 1 | 30 | 0 |
| `.github` | 5 | 272 | 0 |
| `android` | 15 | 2,460 | 2,197 |
| `docs` | 42 | 39,656 | 0 |
| `jarvis-runtime` | 50 | 11,569 | 6,257 |
| `public` | 12 | 686 | 481 |
| `release` | 1 | 9 | 0 |
| `scripts` | 49 | 16,914 | 0 |
| `src` | 310 | 70,229 | 44,990 |
| `supabase` | 427 | 30,973 | 260 |
| **Total** | **935** | **185,663** | **54,185** |

### Comparable previous baseline

Using the same extension filter as the existing LOC script, with imports excluded:

| Revision | Files | Lines | Bytes |
|---|---:|---:|---:|
| `a41983bd` | 825 | 128,310 | 5,224,644 |
| Current committed HEAD | 831 | 129,294 | 5,271,828 |
| **Change** | **+6** | **+984** | **+47,184** |

That filter is narrower than the complete classification above. Its result is not production LOC.

The documented donor removal covered 64 files and 7,732,547 bytes. Those files are absent from the active tree but remain in Git history. Their removal must not be presented as an equivalent reduction in active production code.

## 4. Overall PLAN matching and calculation

I scored **162 requirement groups**. Numbered supplements are individually represented where applicable; broader main-text acceptance obligations are grouped explicitly below. This is an audit scoring model, not an official PLAN progress counter.

| Status | Implementation credit |
|---|---:|
| Implemented — I | 1.00 |
| Partial — P | 0.50 |
| Defective — D | 0.25 |
| Missing — M | 0 |
| Blocked — B | 0 |
| Unverified — U | 0 |

Weights reflect the consequence and complexity of the requirement:

- **1:** baseline bookkeeping/provenance.
- **2:** presentation or measurement.
- **3:** ordinary functional implementation.
- **4:** complex workflow/application integration.
- **5:** authority, security, durability, destructive effects or acceptance gates.

Defective code receives limited implementation credit because an implementation exists; it receives no automatic acceptance credit.

| Measure | Numerator / denominator | Estimate | Unweighted package mean |
|---|---:|---:|---:|
| **A. Non-payment implementation**, excluding P20/P21 | **257 / 593** weighted points; 147 groups | **43.3%** | **46.4%** |
| **B. Full PLAN implementation** | **278.5 / 656**; 162 groups | **42.5%** | **45.2%** |
| **C. Verified readiness** | No complete exact-candidate closure established | **Undetermined** | Not measurable |

For a reproducible acceptance ledger, this audit can award **0/656 = 0% closed final-candidate acceptance credit**. That means no complete candidate-level acceptance closure was established here. **It does not mean zero features work or zero historical tests passed.**

Confidence is moderate in the identified implementation gaps, but low-to-moderate in the percentage estimates. Allow at least **±10 percentage points** for requirement decomposition and partial-credit judgement. These are not statistical confidence intervals.

P20/P21 deferral is intentional and excluded from A. It is not classified as a core-app coding defect.

## 5. P00–P22 scorecard

I/P/M/D/B/U use the definitions above. Package evidence is source evidence unless explicitly stated otherwise.

| Package | I | P | M | D | B | U | Earned / weight | Weighted | Unweighted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| P00 | 7 | 2 | 0 | 0 | 0 | 1 | 15 / 24 | 62.5% | 80.0% |
| P01 | 0 | 2 | 2 | 2 | 0 | 0 | 7.5 / 30 | 25.0% | 25.0% |
| P02 | 0 | 3 | 1 | 3 | 0 | 0 | 11.25 / 35 | 32.1% | 32.1% |
| P03 | 1 | 3 | 0 | 3 | 0 | 0 | 16.25 / 35 | 46.4% | 46.4% |
| P04 | 1 | 3 | 1 | 3 | 0 | 0 | 12.75 / 35 | 36.4% | 40.6% |
| P05 | 0 | 3 | 0 | 1 | 0 | 0 | 8.75 / 20 | 43.8% | 43.8% |
| P06 | 2 | 2 | 1 | 1 | 0 | 0 | 11.25 / 24 | 46.9% | 54.2% |
| P07 | 1 | 5 | 0 | 2 | 0 | 0 | 19 / 38 | 50.0% | 50.0% |
| P08 | 3 | 1 | 0 | 3 | 0 | 1 | 15.25 / 29 | 52.6% | 53.1% |
| P09 | 3 | 2 | 1 | 0 | 0 | 0 | 12 / 19 | 63.2% | 66.7% |
| P10 | 1 | 5 | 1 | 0 | 0 | 0 | 12.5 / 25 | 50.0% | 50.0% |
| P11 | 1 | 5 | 0 | 0 | 0 | 1 | 15 / 30 | 50.0% | 50.0% |
| P12 | 3 | 2 | 0 | 2 | 0 | 0 | 17.5 / 29 | 60.3% | 64.3% |
| P13 | 1 | 1 | 1 | 2 | 0 | 1 | 9.5 / 27 | 35.2% | 33.3% |
| P14 | 2 | 1 | 0 | 0 | 2 | 0 | 7.5 / 17 | 44.1% | 50.0% |
| P15 | 1 | 3 | 0 | 2 | 0 | 1 | 8.5 / 22 | 38.6% | 42.9% |
| P16 | 2 | 5 | 0 | 0 | 0 | 0 | 17.5 / 29 | 60.3% | 64.3% |
| P17 | 0 | 5 | 0 | 1 | 0 | 2 | 10.75 / 32 | 33.6% | 34.4% |
| P18 | 0 | 5 | 1 | 2 | 1 | 1 | 11.5 / 37 | 31.1% | 30.0% |
| P19 | 0 | 2 | 1 | 2 | 0 | 2 | 7.25 / 32 | 22.7% | 21.4% |
| P20 | 2 | 2 | 3 | 0 | 1 | 0 | 12.5 / 30 | 41.7% | 37.5% |
| P21 | 0 | 4 | 0 | 0 | 2 | 1 | 9 / 33 | 27.3% | 28.6% |
| P22 | 2 | 1 | 0 | 0 | 1 | 2 | 10.5 / 24 | 43.8% | 41.7% |

### Requirement register

The numbered entries below follow each package’s supplement. Additional groups cover broader package obligations.

**P00 — baseline and supply chain**  
[PLAN authority](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:349)

1. Preserve checkpoint — **I**.
2. Verify refs/hashes — **I**.
3. Reconcile carried/new historical records — **I**, as retained provenance.
4. Separate text/generated/structural classifications — **I**.
5. Keep CryptoJS structural evidence distinct from clearance — **I**.
6. Reconcile requirements and current findings — **P**.
7. Shipped-component/licence inventory and clearance — **P**; clearance remains open.
8. Dependency repair represented in current source/lockfile — **I**.
9. Dependency audit added to deployment admission — **I**.
10. Exact-candidate full gates, installed identities and P00-B closure — **U**.

Weights: `1,1,1,1,1,3,5,3,3,5`. Historical dependency/test records are not freshly rerun results.

**P01 — independently verified completion**  
[task-authority.server.ts](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:127)

1. Freeze output predicates — **M**.
2. Convert finishing into a verification request — **P**.
3. Separate effect/execution/verification fields — **M**.
4. Bind evidence to exact task/device/resource/outcome — **P**.
5. Trusted mandatory-predicate aggregation — **D**.
6. Completion and commercial settlement exclusively through that gate — **D**.

Weights: six ×5. Same-task readback exists; immutable outcome contracts and sufficient verification do not. C01–C03 block closure.

**P02 — STOP, takeover and stale observations**  
[UIA boundary](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_accessibility.py:288)

1. Token at final native/gesture boundary — **D**.
2. Recheck after resolution, immediately before effect — **D**.
3. App/window/DPI/geometry/generation binding — **P**.
4. Remove physical takeover exemption — **D**.
5. Task-owned held input/process cleanup — **P**.
6. Reconcile noncancellable effects — **M**.
7. Revalidate Continue — **P**.

Weights: seven ×5. Local cancellation exists, but C04–C06 prevent the stated safety equivalence from being accepted.

**P03 — durable operations and acknowledgements**  
[device journal/exchange](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:352)

1. Intent before effect/result before send — **D**, particularly Android write failures.
2. Extend existing journal owner — **I**.
3. Explicit operation ACK plus digest — **P**.
4. Preserve unknown/missing ACK — **D**.
5. Recoverable rotation — **P**.
6. Preserve unresolved effects through revoke/update/crash — **D**.
7. Reconcile before retry — **P**.

Weights: seven ×5. C07–C09 are release blockers.

**P04 — honest Office/file effects**  
[native document adapter](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_document.ps1:97)

1. Exact file/application identity — **P**.
2. Verified task-owned copies — **P**.
3. Resource/application locks — **M**.
4. Typed native edits — **I**.
5. Record mutation before subsequent failure — **D**.
6. Independent reopen/check — **D**.
7. Conditional restore protecting later edits — **D**.
8. Preserve both versions when uncertain — **P**.

Weights: `4,4,5,3,5,5,5,4`. C10–C12 and C28 remain. Macro/protected/disk-full/concurrent-user matrices are not closed.

**P05 — account and staff authority**  
[ownership migration](C:/Users/haans/Desktop/caera-connect-plan/supabase/migrations/20261011090000_ownership_transfer_locks_both_owners.sql:20)

- A. Conditional invitation/owner transfer and two-client proof — **P**.
- B. Actor/operation/target/digest-bound proof and recovery — **D**.
- C. Chat operation ownership/account fencing/scoped rollback — **P**.
- D. Immutable notification IDs, bounded outbox, conditional endpoints — **P**.

Weights: four ×5. Owner-row locking is implemented. Real two-session proof remains blocked in the recorded evidence. Direct API assurance/denial gaps remain C17/C18.

**P06 — complete export and recoverable erasure**  
[data-rights.ts](C:/Users/haans/Desktop/caera-connect-plan/src/lib/account/data-rights.ts:133)

1. Account data-class map — **I**.
2. Stable cutoff/cursor contract — **D**.
3. Partial/excluded/retained manifest — **P**.
4. Durable erasure intent before deletion — **M**.
5. Actual scheduled consumer — **I**.
6. Independent storage/revocation reconciliation — **P**.

Weights: `3,5,3,5,3,5`. C15/C16 remain. Scheduled invocation exists; real outage/identity-deletion recovery is unverified.

**P07 — cold Offline Intelligence**  
[installation authority](C:/Users/haans/Desktop/caera-connect-plan/src/lib/brain/installation-authority.ts:575)

1. Final-byte signing/upstream identity — **I**.
2. Readiness across bytes/signature/runtime/lease/keys/clock — **D**.
3. Durable download frontier — **D**.
4. Fresh-process/two-tab ownership — **P**.
5. Durable pending usage — **P**.
6. Reject conflicting same-ID payload — **P**.
7. Retire usage only on ACK — **P**.
8. Reconcile closure/refund before deleting evidence — **P**.

Weights: `5,5,5,3,5,5,5,5`. Key creation and ciphertext preservation improve recovery. C13/C14 remain; actual cold offline acceptance is open.

**P08 — bounded local segments**  
[segment admission](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/device.server.ts:796)

1. Shared schema/consumers — **I**.
2. Negotiation — **I**.
3. Byte/step/duration/resource caps — **P**.
4. Existing adapters with final checks — **D**.
5. Step journals/checkpoints — **D**.
6. Job versus network/observation deadlines — **D**.
7. Compatible single-action transport — **I**.
8. Measured legacy/new parity — **U**.

Weights: `3,4,4,5,5,3,3,2`. Android retains the compatible single-action path; desktop segments exist. Resource locks and complete bounded-effect limits remain open.

**P09 — wake hints and durable truth**  
[PLAN contract](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:627)

1. Existing web action-change authority — **I**.
2. Negotiated authenticated device wake hints — **M**.
3. Durable fetch as truth — **I**.
4. Coalescing/polling recovery — **I**.
5. Timezone/occurrence/permission/selected-PC schedule binding — **P**.
6. Locked/asleep/offline waiting states — **P**.

Weights: `2,3,4,2,5,3`. No qualified device wake stream was established. Connected latency and disconnected STOP delivery remain unverified.

**P10 — discovery and safe recipes**  
[recipe storage](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_discovery.py:420)

1. Identity/version/interface/examiner discovery — **P**.
2. Description cache without authority caching — **I**.
3. Typed parameterised recipes — **P**.
4. Scope/preconditions/verifier/provenance — **P**.
5. Exclude private inputs/secrets/coordinates — **P**.
6. Version/interface canaries — **M**.
7. Independent recipe quarantine — **P**.

Weights: `3,3,3,5,5,3,3`. Current recipes are substantially textual. The `app@major` key allows one stored recipe per app/version, so independent workflows and quarantine are incomplete.

**P11 — installation and browser experience**  
[browser discovery](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_existing_browser.py:65)

1. Signed installer identity — **U**.
2. Exact fingerprint/account pairing — **I**.
3. Browser profile and external account shown separately — **P**.
4. Supported existing-profile control — **P**.
5. Managed fallback with separate consent — **P**.
6. Update/rollback journal preservation — **P**.
7. Verified uninstall/revocation — **P**.

Weights: `5,5,4,3,4,5,4`. Source paths exist; signature/install/update lifecycle is not proved. Browser discovery remains heuristic.

**P12 — voice lifecycle**  
[use-voice.ts](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/use-voice.ts:151)

1. One lifecycle generation — **D**.
2. Dispose late microphone tracks — **I**.
3. Fence old recogniser/TTS callbacks — **D**.
4. Bounded/cancellable audio — **P**.
5. Separate barge-in/Pause/status/redirect/STOP — **I**.
6. Local-wake privacy claim — **P**.
7. Text/dictation fallback — **I**.

Weights: `5,5,5,3,4,5,2`. C20/C21 remain. Headset, echo, accents and background-device acceptance are unverified.

**P13 — Android**  
[AgentService](C:/Users/haans/Desktop/caera-connect-plan/android/src/in/ocade/app/AgentService.java:177)

1. System consent/foreground service — **I**.
2. Durable pending results — **D**.
3. Observation invalidation — **P**.
4. Final-effect admission — **D**.
5. Interrupted-gesture reconciliation — **M**.
6. Process/OEM/background/revoke proof — **U**.

Weights: `5,5,4,5,5,3`. AtomicFile use is real, but errors are swallowed. Compiling is not physical-device proof.

**P14 — Apple scope**  
[PLAN contract](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:769)

1. Sanctioned adapters behind current broker — **P**.
2. Mac permissions/signing/installed interfaces — **B**.
3. Explicit iOS limits — **I**.
4. Remote paired-PC fallback — **I**.
5. Actual hardware evidence — **B**.

Weights: `3,5,3,3,3`. Apple hardware and signing evidence cannot be inferred from generic Python or web support.

**P15 — truthful visible experience**  
[JarvisPanels](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/JarvisPanels.tsx:734)

1. Selected tokens/layout — **P**.
2. Complete callback/control matrix — **P**.
3. Focus/IME/global state rules — **D**.
4. Durable truthful statuses — **D**.
5. Pair/remove/preference sequencing — **P**.
6. Idle Orb replacement — **I**.
7. Width/theme/input/state acceptance — **U**.

Weights: `2,3,3,5,4,2,3`. C24–C26 remain. The smooth-start contract is partial: signed readiness, actual runnable first result, receipts and every error/denial state are not qualified.

**P16 — bounded online intelligence**  
[real planner dependencies](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/live-deps.ts:41)

1. Existing turn/failure limits — **I**.
2. Account/conversation/generation-bound frames — **P**.
3. Reader/nested iterator cancellation — **P**.
4. Bounded text/token/audio buffers — **P**.
5. Stable capability cache — **I**.
6. Untrusted content handling — **P**.
7. Fresh cited research/private-input scope — **P**.

Weights: `3,5,5,4,3,5,4`. Real provider integration exists. Endless-stream, poisoned-memory and cross-account runtime acceptance remains open.

**P17 — professional applications**  
[native workbook adapter](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_workbook.ps1)

1. Version/edition/API probes — **P**.
2. Frozen native fixtures — **P**.
3. Typed operations/unsupported cases — **P**.
4. Exact file/app/account identity — **P**.
5. Copies — **P**.
6. Reopen/output inspection — **D**.
7. STOP/partial/assets/version-drift proof — **U**.
8. Repeat cost/fidelity measurement — **U**.

Weights: `3,4,3,5,4,5,5,3`. Excel/Word/browser coverage is substantive but partial. PowerPoint, CAD/Fusion, Blender, professional media and connectors are not established as qualified native families.

**P18 — recurring workflows and flagship**  
[PLAN contract](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:880)

- Weekly checked report — **P**.
- Document/PDF pack — **P**.
- Browser reconciliation/status workflow — **P**.
- Versioned safe repeat — **P**.
- Complete before/after differences — **D**.
- Every mandatory artifact has a sufficient durable receipt — **D**.
- Scoped coding workflow — **P**.
- Qualified creative workflow — **M**.
- Thirty held-out cases per workflow and ≥95% target — **U**.
- Five consented partners over two weeks — **B**, external participation/evidence.

Weights: `4,4,4,3,3,5,4,4,4,2`. The flagship must involve substantive work in at least two installed applications, preserved editable originals, independent calculations/reopen and measured interventions. Public sharing needs separate consent.

**P19 — verification integrity and candidate freeze**  
[journey harness](C:/Users/haans/Desktop/caera-connect-plan/scripts/e2e/harness.mjs:324)

- Zero-target accessibility detection — **D**.
- Required BLOCKED journey failure — **D**.
- Meaningful required matrix/harness-integrity repair — **P**.
- Independent adversarial acceptance — **U**.
- Actual user preview/growth evidence — **U**.
- Exact candidate freeze and full campaign — **M**.
- Source/secret/output evidence integrity — **P**.

Weights: `5,4,5,5,3,5,5`.

The ten explicit harness traps remain obligations: fixture-account deletion, assertions swallowed by catches, FK versus CHECK proof, NULL assertions, regex versus RLS proof, secret logging, synthetic push, pointer versus touch, MZ versus signing, and completed-task versus active STOP. They are not collectively closed by a green harness.

**P20 — payments, intentionally deferred**  
[PLAN contract](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:941)

1. Preserve grants — **I**.
2. Retired checkout/tier reconciliation — **P**.
3. One authoritative commercial contract — **M**.
4. Durable webhook IDs/conflicting replay — **M**.
5. Output/payment/cancel/refund reconciliation — **P**.
6. Safety limits for unlimited owners — **I**.
7. Upgrade after verified value — **M**.
8. Merchant/legal approval — **B**.

Weights: `4,2,3,5,5,5,2,4`. Buying clarity, no-card free use, failed/empty-answer handling, renewal, balance, cancellation and refunds are future acceptance work.

**P21 — release, intentionally deferred**  
[PLAN contract](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:970)

1. Source/runtime/schema candidate identity — **P**.
2. Shipped rights clearance — **B**.
3. Signature/install/update/uninstall/rollback — **P**.
4. Hosted/provider/physical workflows — **U**.
5. Production approval — **B**.
6. Unknown-effect/STOP/erasure/settlement/cost monitoring — **P**.
7. In-flight reconciliation during rollback — **P**.

Weights: `5,5,5,5,5,3,5`. Distribution, referrals, localisation and growth claims require consented, measured evidence and approved spending.

**P22 — proof-based cleanup and expansion**  
[ToRemove](C:/Users/haans/Desktop/caera-connect-plan/ToRemove.md)

- Caller/replacement trace — **I**, for recorded removals.
- Comparable size/cost accounting — **P**.
- Replacement/parity proof — **U** for the complete candidate.
- Preserve safety/history/recovery — **I** as the governing implementation direction.
- Cleanup followed by final candidate qualification — **U**.
- Expansion supported by paid demand/bounded experiment — **B**.

Weights: `4,3,5,5,5,2`. Donor removal is complete in the active tree. Some retirement claims are premature: voice-generation and takeover gaps remain.

## 6. Static bug inventory

**28 confirmed source defects, five high-confidence risks, three unverified suspects.** These counts describe this inventory, not every possible defect in the repository.

“Confirmed” means the implementation error is demonstrated by source. Runtime frequency, exploitability and deployed exposure were not tested.

### Confirmed from source — security, authority and recovery

| ID | Severity / confidence | Source | Defect, evidence and user impact | Minimal recommended fix | Verification required |
|---|---|---|---|---|---|
| C01 | Critical / High | [task RLS](C:/Users/haans/Desktop/caera-connect-plan/supabase/migrations/20260926090000_ocade_jarvis_web.sql:583) | Authenticated users retain own-row UPDATE authority over tasks. The application completion check is not a database-enforced terminal-state invariant. A user can mark their own task completed without qualifying receipts. This is an own-account integrity bypass, not evidence of cross-account access. | Restrict terminal transition authority and enforce receipt validation at its trusted owner. | Direct authenticated API completion attempt with no receipt, wrong receipt and valid receipt. |
| C02 | Critical / High | [completionGap](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:157) | A successful trailing read and same-path `file_info` can satisfy completion. Metadata existence does not prove required content, values, formulas, preservation or reopenability. Several effect types also lack artifact-specific coverage. | Freeze outcome predicates and require sufficient independent evidence for each mandatory artifact. | Incorrect-but-existing output, omitted artifact, wrong formula, stale/wrong digest, lying finish. |
| C19 | Critical / High | [direct command execution](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:879) | Windows/macOS command execution explicitly lacks filesystem/network confinement. Argument path checks do not constrain code inside routine scripts/builds. The executable check examines the interpreter/program, not everything a script can access. Approved workspace scope is therefore not enforced against script contents. | Fail closed for work requiring containment until a supported boundary is proved; retain bounded native operations. | Authorised test script attempts out-of-scope reads/writes/network access; verify rejection and no effects. |
| C04 | High / High | [running admission](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/device.server.ts:701), [permission update](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/jarvis.functions.ts:581) | A running segment is checked for action/task status, but not current permissions. Permission changes do not cancel affected claimed work. Later steps can retain the old grant. | Propagate permission revision/revocation to claimed operations and recheck before each effect. | Withdraw permission between two admitted steps; second mutation must be rejected. |
| C05 | High / High | [UIA](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_accessibility.py:288), [Android](C:/Users/haans/Desktop/caera-connect-plan/android/src/in/ocade/app/Control.java:298), [file mutation](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:540) | Cancellation checks precede further pattern/target resolution or blocking file preparation on several paths. A STOP arriving during that work can miss the final dispatch boundary. Android also has later gesture dispatch boundaries. | Recheck under the established admission owner immediately before each actual mutation. | Barriers between resolution/preparation and Invoke, SetValue, rename, copy, launch and gesture. |
| C06 | High / High | [native pause routing](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:326), [pause predicate](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:1112) | `cowork` still exempts native paths from physical user takeover handling. Screen routing was tightened, but the exemption remains elsewhere despite the retirement record. | Remove the remaining exemption while preserving one input owner and explicit resume. | Physical input during native/window/Office work and semantic fallback. |
| C07 | High / High | [desktop ACK handling](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:435), [Android ACK handling](C:/Users/haans/Desktop/caera-connect-plan/android/src/in/ocade/app/AgentService.java:271) | Clients retain only explicitly `retry` outcomes; missing/unknown ACKs are discarded. Desktop shutdown also clears results after exchange success without validating each ACK. Matching outcome digests are absent. | Retire only explicitly accepted matching operation/digest outcomes; preserve/reconcile everything else. | Lost response, missing ACK, partial batch, duplicate/unknown operation and conflicting payload. |
| C08 | High / High | [revocation handling](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:392) | Revocation clears pending/intent journals while effects may remain unresolved. Forgetting credentials becomes loss of recovery evidence. | Remove credentials but retain appropriately scoped unresolved outcomes for reconciliation. | Revoke after effect/before ACK; restart and verify retained partial/unknown evidence. |
| C09 | High / High | [Android persistence](C:/Users/haans/Desktop/caera-connect-plan/android/src/in/ocade/app/AgentService.java:177) | AtomicFile write exceptions are swallowed. Execution can continue after intent persistence failed; running intent can be removed after result persistence failed. | Make journal durability a checked prerequisite; retain intent until result storage succeeds. | Disk-full/write-failure injection at intent and result boundaries. |
| C10 | High / High | [undo restore](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:770) | Backup restoration copies over the current file without checking whether the user edited it later. Undo of a task-created file can likewise remove subsequent user work. | Bind rollback to the task’s resulting version; preserve both versions on mismatch. | User edits between execution and Undo; no later edit may be overwritten/deleted. |
| C17 | High / High | [proof spending](C:/Users/haans/Desktop/caera-connect-plan/src/lib/security/assurance-middleware.ts:144), [DB staff guard](C:/Users/haans/Desktop/caera-connect-plan/supabase/migrations/20260930093500_a_staff_refusal_reads_correctly.sql:14) | Single-use operation proof is consumed in web middleware. Callable privileged DB mutations require role/AAL/recent authentication but do not consume the same target-bound proof. Already-authorised staff can bypass the single-use web contract via direct RPC. | Enforce and consume bound proof transactionally in the mutation authority. | Direct RPC replay and changed-target replay using an already-spent fresh proof. |
| C18 | High / High | [coarse role predicate](C:/Users/haans/Desktop/caera-connect-plan/supabase/migrations/20261003090000_owner_and_staff_consoles_on_ocade_in.sql:45), [usage policy](C:/Users/haans/Desktop/caera-connect-plan/supabase/migrations/20260910110000_usage_tracking.sql:37) | Some direct Data API policies use broad `has_role`, while console authority applies granular denials. A broad administrator role can retain direct reads that the console denies. | Make affected RLS and routes use the same established granular predicate. | Broad role plus explicit denied permission, tested through direct API and console. |

### Confirmed from source — output integrity and persistence

| ID | Severity / confidence | Source | Defect, evidence and user impact | Minimal recommended fix | Verification required |
|---|---|---|---|---|---|
| C03 | High / High | [completion history limit](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:138) | Completion reads only the first 1,000 ascending action records. Later unsettled/mutating actions can be omitted while an earlier qualifying prefix passes. | Validate the complete required operation set; fail closed on truncation. | More than 1,000 records with a later pending/mutating operation. |
| C11 | High / High | [Word mutation](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_document.ps1:61), [failure report](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_document.ps1:123), [summary](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:658) | Mutation can occur before the operation enters `$applied`. A subsequent style/property exception on the first operation leaves unsaved edits in a user-open document, but `unsavedEdits` can be false and the disk comparison can report “not changed.” Workbook multi-property operations have the same accounting weakness. | Record mutation-started before the first write and propagate partial/unknown state independently of completed-operation count. | First operation mutates then throws; both already-open and task-opened Office cases. |
| C12 | High / High | [Word reopen result](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_document.ps1:110), [workbook result](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_workbook.ps1:179), [adapter success](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:617) | `savedAndReopened=false` can accompany `ok=true`, and Python still reports `done`. Detected workbook problems also do not necessarily prevent success. Reopen-required verification is not enforced. | Separate execution from verification; require mandated reopen/predicates before verified success. | Save succeeds but reopened content differs, reopen is unavailable, or formulas contain errors. |
| C13 | High / High | [download failure checkpoint](C:/Users/haans/Desktop/caera-connect-plan/src/lib/brain/model-transfer.ts:730) | Error/cancellation paths await final flush but ignore its failure result before publishing a resume checkpoint. Resume trusts the claimed contiguous/hash frontier. | Publish only the confirmed durable frontier; retain prior checkpoint on failed flush. | Write/flush failure after streamed bytes, then restart/resume and verify the final digest. |
| C14 | High / High | [cached activation](C:/Users/haans/Desktop/caera-connect-plan/src/lib/brain/installation-authority.ts:609), [Repair](C:/Users/haans/Desktop/caera-connect-plan/src/lib/brain/installation-authority.ts:1054) | Repair delegates to installation, whose existing verified/nonzero-file fast path can skip length/digest verification. A corrupted or truncated nonempty artifact can evade Repair. | Force length/digest validation for explicit Repair before activation. | Same-length corruption and truncated nonzero installed model. |
| C15 | High / High | [tombstone query](C:/Users/haans/Desktop/caera-connect-plan/src/lib/library/tombstones.server.ts:29), [zero return](C:/Users/haans/Desktop/caera-connect-plan/src/lib/library/tombstones.server.ts:35) | Global sweeps exclude attempts ≥10, then report zero when no retryable rows remain. Dead-lettered unpurged objects disappear from the reported backlog. A failed round also reports the current batch size rather than the complete backlog. | Report retryable, dead-letter and unknown totals separately; keep unresolved obligations visible. | Only dead-letter rows, more than one failed batch, and count-query failure. |
| C16 | High / High | [export pagination](C:/Users/haans/Desktop/caera-connect-plan/src/lib/account/data-rights.ts:139) | Unique ordering improves determinism, but offset pagination has no stable snapshot. Deleting an earlier row between pages shifts offsets and can omit a later row. | Use the defined cursor/snapshot contract and label cross-service consistency honestly. | Concurrent deletion/insertion/update during a multi-page export. |
| C28 | High / High | [planner timeout](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/agent.ts:48), [Office contract](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:242) | Planner wait is 120 seconds while Office may legitimately execute for 180 seconds. A still-running job can reach timeout/cancellation handling before its declared execution deadline. | Use declared job deadlines/heartbeats and reconcile the in-flight effect before replacement work. | Valid Office job lasting 120–180 seconds, including save during timeout handling. |
| C27 | Medium / High | [document comparison](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_documents.py:198) | Text comparison truncates extraction at 200,000 characters and discards truncation information. Differences exclusively after that boundary can produce an empty difference report. | Preserve incompleteness flags or compare the full relevant content with bounded streaming. | Two large documents differing only beyond the extraction boundary. |

### Confirmed from source — voice, UI and verification

| ID | Severity / confidence | Source | Defect, evidence and user impact | Minimal recommended fix | Verification required |
|---|---|---|---|---|---|
| C20 | Medium / High | [recogniser callbacks](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/use-voice.ts:151), [stopListening](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/use-voice.ts:185) | Old recogniser result/error callbacks lack recogniser/generation ownership checks. Stopping clears `onend` but leaves result/error callbacks capable of affecting the current session. | Fence all callbacks by the existing lifecycle generation and detach retired handlers. | Start/End/Start with delayed old result/error callbacks. |
| C21 | Medium / High | [TTS lifecycle](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/use-voice.ts:255) | Speech sets the state to speaking and stops listening, but has no corresponding utterance error cleanup. Playback errors can leave voice stuck in speaking. | Share generation-checked terminal cleanup between end and error. | Speech-synthesis error, interruption and late completion. |
| C22 | High / High | [accessibility discovery](C:/Users/haans/Desktop/caera-connect-plan/scripts/check-accessibility.mjs:42), [exit logic](C:/Users/haans/Desktop/caera-connect-plan/scripts/check-accessibility.mjs:390) | Missing scan roots can be swallowed into an empty target set; zero findings then produce success. A zero-coverage run can pass a required gate. | Require nonzero expected discovery and fail on missing mandatory roots. | Missing root and zero-target invocation. |
| C23 | High / High | [journey exit](C:/Users/haans/Desktop/caera-connect-plan/scripts/e2e/harness.mjs:324) | BLOCKED is counted, but process failure depends only on failed journeys. Required blocked evidence can exit zero. | Fail the required campaign on BLOCKED/missing evidence; preserve distinct result labels. | All-blocked and mixed pass/blocked required campaigns. |
| C24 | Medium / High | [frame timestamp](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/device.server.ts:673), [caption](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/JarvisTask.tsx:249) | Server receipt time is stored as the live-frame timestamp and displayed as capture time. A delayed old frame can look newly captured. | Carry capture generation/time separately from receipt time and validate freshness. | Delayed/reordered frame delivery and task-generation change. |
| C25 | Medium / High | [JARVIS modal](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/JarvisPanels.tsx:734), [pairing modal](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/JarvisWorkspace.tsx:1294) | These modal paths handle Escape/ARIA but lack owned focus containment/restoration. Existing security dialogs already provide a reusable focus pattern. Keyboard focus can escape behind the modal. | Apply the existing modal-focus owner to affected dialogs. | Tab/Shift-Tab, Escape, focus restoration and assistive navigation. |
| C26 | Low / High | [graph limit](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/graph.ts:76) | The 60-node cap is per category, rather than the intended total visible graph budget. Multiple populated categories exceed that budget. | Apply a total display budget while retaining the complete list alternative. | Populate every category and inspect graph size, keyboard access and responsiveness. |

### High-confidence risks — runtime confirmation required

| ID | Severity | Source | Risk and impact | Minimal response / verification |
|---|---|---|---|---|
| R01 | High | [COM discovery](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:220) | Deriving `<vendor>.Application` and checking its executable does not establish a compatible workbook/document object model. File-association routing is also incomplete for user-selected defaults. The dirty friendly-name change does not resolve that. | Probe required methods/version through a nonmutating examiner; test supported alternative Office suites and changed file associations. |
| R02 | Medium | [browser discovery](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_existing_browser.py:65) | `resources.pak` layout and guessed User Data locations can miss valid Chromium installations/custom profiles. Current discovery does consult Windows default-browser information; this is not a claim that it blindly drives Firefox through Chromium pages. | Test custom install/profile layouts; use supported reported identity/profile mechanisms and explicit refusal. |
| R03 | High | [segment handoff](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:352), [worker bookkeeping](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:500) | Thread liveness, remaining IDs and completed-result queues are observed separately. An interleaving can advertise no running IDs while the local `active` object still causes newly claimed work to be ignored. | Use the existing owner to make handoff state coherent; barrier-test final-step completion concurrent with exchange/next claim. |
| R04 | High | [push lifecycle](C:/Users/haans/Desktop/caera-connect-plan/src/lib/notifications/push-device.ts:52) | Permission/service-worker awaits are not bound to the initiating account operation. A late account-A operation can record or unsubscribe the shared browser endpoint after account B signs in. | Bind account/operation/version before awaits; test account switch during permission, subscription and unsubscribe. |
| R05 | High | [identity submission](C:/Users/haans/Desktop/caera-connect-plan/src/components/security/ConfirmIdentity.tsx:103) | Cancel remains enabled during asynchronous proof submission; submission completion is not fenced to the original request. A late response can affect a newer confirmation request or authentication state. | Fence submission with the existing request owner; test Cancel/new request/account switch during delayed OTP/proof. |

### Unverified suspects — external evidence required

| ID | Severity if realised | Suspect | Required evidence |
|---|---|---|---|
| S01 | High | Runtime code/schema mismatch if deployment lacks the latest required migrations. No deployed mismatch was demonstrated. | Exact deployed source/schema identities and migration verification records. |
| S02 | High | Installer/update artifacts may lack complete signing, notice or lifecycle evidence. Source packaging configuration does not prove an actual shipped artifact. | Artifact digest, signature chain, installed notices and install/update/uninstall/rollback results. |
| S03 | High | Hosted provider configuration, credentials, selected model access or deployment limits may prevent real operation. No current provider outage/configuration failure was established. | Redacted exact-deployment provider/workflow receipts, including failure/recovery. |

## 7. Missing functionality, prioritised

| Priority | Missing qualifying functionality | Packages |
|---|---|---|
| 1 | Immutable outcome contracts and durable receipts covering every mandatory artifact; database-enforced completion authority | P01 |
| 1 | Permission revision/control ownership at every final effect; honest quiescence and noncancellable-effect reconciliation | P02/P08 |
| 1 | Digest-bound operation ACKs and unresolved-effect preservation across revocation, restart and updates | P03/P11 |
| 1 | Resource/application locks and rollback that cannot overwrite later user changes | P04 |
| 1 | One-use target-bound privileged proof enforced in the database; granular RLS parity | P05 |
| 2 | Stable export consistency, durable erasure requests, observable dead letters/backoff and complete erasure receipts | P06 |
| 2 | Explicit Repair integrity checks, durable resume frontier and actual cold-process offline qualification | P07 |
| 2 | Authenticated device wake hints through the current broker, with measured recovery and revocation | P09 |
| 2 | Typed verifier-backed recipes, independent recipe identities/quarantine and version canaries | P10 |
| 2 | Qualified signed installation/update/uninstall and explicit browser-profile/external-account identity | P11 |
| 2 | Complete recogniser/audio lifecycle and real Android gesture/process/OEM qualification | P12/P13 |
| 3 | Qualified PowerPoint/coding/creative adapters with native reopen and fidelity receipts | P17 |
| 3 | Repeatable flagship Excel → Word/PDF workflow, checked calculations, complete differences and intervention measurements | P18 |
| 3 | Truthful first-use/error/partial-result UI and complete accessibility/state matrix | P15/P19 |
| Deferred | Merchant-approved billing, payment reconciliation and production release | P20/P21 |

Generic terminal or GUI capability does not establish qualified application support.

## 8. Debloat opportunities

**No further deletion was proved safe enough to apply in this audit.**

| Candidate | Evidence | Recommended treatment |
|---|---|---|
| Tracked Python cache | `scripts/wake/__pycache__/make_data.cpython-312.pyc`, 11,020 bytes | Confirm no packaging/runtime caller; remove generated cache from tracking in a later authorised change. |
| Remaining takeover exemption | C06 | Remove the bypass after takeover regression proof. This is a safety repair, not merely LOC reduction. |
| Repeated modal-focus implementation | C25; established focus owner already exists | Reuse the existing focus helper rather than add another modal framework. |
| Textual recipe storage keyed only by app/version | [ocade_discovery.py:420](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_discovery.py:420) | Extend the existing record narrowly for independent typed recipes; avoid a second registry/agent engine. |
| Premature retirement entries | Voice and takeover marked more complete than source supports | Correct the owning records after proof; do not delete surviving safety mechanisms on the strength of a checklist. |
| Future duplicate backup/status paths | Existing Office/file owners overlap | Consolidate only after preservation, partial-effect and rollback parity is demonstrated. Two small helpers alone do not justify an abstraction. |

Keep applied migrations, rollback/provenance history, specialised Office adapters, offline authority, recovery records, accessibility and valuable tests.

No unused dependency was proved removable through a complete caller/packaging analysis. The comparable active-code filter shows **+984 lines**, not an established active-code reduction.

## 9. Security, privacy and licensing risks

The most serious authority risks are C01/C02, C04–C10, C17–C19. Their effects differ:

- C01 compromises completion integrity within the user’s own account.
- C17 bypasses the single-use assurance contract for already-authorised staff.
- C18 concerns staff granular denials, not an established ordinary-customer escalation.
- C19 is a scope-enforcement gap in unconstrained execution, not a demonstrated operating-system exploit.

Privacy and recovery obligations remain incomplete around account-switching callbacks, export consistency, erasure dead letters, private-input consent and unresolved-effect retention. Logs and receipts should remain redacted; this audit did not establish a current deployed credential leak.

For dependencies, current source contains the recorded `seroval`/`source-map-js` repairs and deployment audit guard. PLAN records a production audit PASS and an accepted-open development dependency issue. **Those are historical records; no current advisory scan was run here.** They should not be relabelled as a fresh clean security audit.

For provenance:

- Removing donor files does not establish clearance for retained adapted implementation.
- The active runtime’s licence declaration is not independent evidence of the complete chain of rights.
- [THIRD_PARTY_NOTICES](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/THIRD_PARTY_NOTICES.md) and packaging metadata are real source artifacts.
- Listed LGPL components require the actual distribution arrangement and notices to be reviewed against the shipped package.
- Model, asset and dependency clearance remains a P00-B/P21 gate.

This is a source/provenance inventory, not a legal determination that a particular distribution violates a licence.

## 10. Real implementation versus mocks and unverified behaviour

| Area | Real implementation present | Evidence boundary |
|---|---|---|
| Online JARVIS planning | Actual streaming provider calls, tools, permissions and accounting path | [live-deps.ts](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/live-deps.ts:41), [provider boundary](C:/Users/haans/Desktop/caera-connect-plan/supabase/functions/_shared/boundary.ts:220); current hosted acceptance unverified |
| Device execution | Signed exchange, device binding, local adapters and segment execution | Real source; final authority/recovery gaps remain |
| Windows accessibility | UIA inspection and semantic operations | Genuine native integration; final STOP/takeover proof incomplete |
| Office | COM operations, backup/readback and reopen paths | Genuine native work; partial-effect, rollback and verification defects remain |
| File-format fallback | Native-format library handling with refusal of some fidelity-loss cases | Useful implementation; not blanket Office fidelity qualification |
| Browser | Supported control paths, managed/existing-profile mechanisms | Real paths; browser/profile/account matrix incomplete |
| Android | Pairing, foreground service, accessibility, private AtomicFile journals | Real implementation; swallowed durability failures and physical/OEM proof remain |
| Chat Offline | OPFS model authority, lease/runtime activation and encrypted local turns | Real implementation; cold restart, repair and flush-failure acceptance incomplete |
| Owner transfer | Forward locking migration and local database tests | Source repair is substantive; PGlite does not prove two-session locking interleavings |
| Erasure | Scheduled tombstone consumer | Actual invocation path exists; fake-client tests do not prove real Storage outage recovery |
| Journeys | Runnable harnesses and fixtures | Several use stubbed authentication/provider responses or scripted calls; those do not establish full hosted intelligence |
| Windows UI fixture | Synthetic Forms controls | Useful deterministic adapter fixture; not universal app qualification |
| Push | Subscription/delivery code and synthetic test coverage | Synthetic notification is not provider-delivery proof |
| Installer | Packaging configuration and artifact checks | Executable/MZ existence is not signature/install/update proof |
| Touch/Apple | Web or emulated interaction and declared limitations | Pointer emulation is not physical touch; Apple hardware proof remains absent |

PLAN records historical **1,258 tests/15 gates**, **181 Python passes with three skips**, and **22 Office-related passes**. These records are valuable local evidence. I did not inspect a complete result set binding all required acceptance predicates to the exact final candidate, installed artifacts and deployment.

The architecture still follows the intended single planner/broker/local executor direction. There is no justification for adding a parallel agent framework to solve the listed defects.

## 11. Remaining work and dependency order

| Scope | Estimated implementation remaining |
|---|---:|
| Non-payment scope | **56.7%** — 336 / 593 weighted points |
| Full PLAN | **57.5%** — 377.5 / 656 weighted points |
| Verified acceptance remaining | Not measurable from source; complete candidate closure remains open |

These percentages are not calendar estimates. A small authority fix can close significant weighted work; application qualification can consume substantial time despite few source changes.

The dependency order is:

1. Preserve the current baseline and Claude changes; complete P00-A evidence reconciliation.
2. Close P01/P02/P03/P04 safety and durability together.
3. Close P05/P06/P07 account, erasure and offline integrity.
4. Finish bounded segments, wake, discovery, installation and voice through existing owners.
5. Qualify Android, truthful UI and professional application scope.
6. Establish the recurring flagship and held-out workflow evidence.
7. Repair harness integrity, freeze and run P19.
8. Proceed to P20 only after non-payment coding, cleanup and mandatory testing pass.
9. Perform release-scope P22 cleanup, rerun affected P19 and close P00-B.
10. Obtain approval and exact release evidence before P21.

Major blockers are unresolved completion authority, unsafe effect/recovery boundaries, staff/API parity, absent exact-candidate acceptance, hardware/provider proof and shipped-rights/signature clearance.

## 12. Recommended next implementation sequence for Claude

1. **Start with P01 completion authority.** Trace every terminal transition, including direct Data API authority. Freeze mandatory outcomes and make completion depend on their receipts. Address C01–C03 in the existing task owner.

2. **Close P02 final admission and permission withdrawal.** Address C04–C06 and C19. Require explicit rejection at final effect boundaries, retain local STOP independence, and distinguish requested cancellation from quiescence.

3. **Close P03 journal/ACK semantics.** Address C07–C09 and investigate R03. Preserve unknown effects; do not substitute retries for reconciliation.

4. **Close P04 Office and rollback truthfulness.** Address C10–C12/C28, then prove shared-resource ownership, copies, macros/protected files, user edits, save failure and late STOP.

5. **Repair P05 direct authority.** Address C17/C18, then R04/R05 and remaining Chat callback ownership. Preserve the new owner-transfer locking migration; obtain actual two-session proof later.

6. **Repair P06/P07 durability.** Address C13–C16. Verify stable exports, visible dead letters, real erasure recovery and explicit model Repair before broader offline claims.

7. **Complete P08–P12 narrowly.** Enforce remaining segment limits, integrate wake hints through the same broker, qualify discovery, add typed verifier-backed recipes, preserve update journals and fix C20/C21.

8. **Qualify P13–P18.** Fix Android persistence/admission, C24–C27, then prove Excel → Word/PDF on installed applications. Expand PowerPoint/coding/creative coverage only behind demonstrated interfaces and native fixtures.

9. **Repair P19 before trusting its results.** Fix C22/C23 and audit the ten named harness traps. Freeze source/schema/runtime identities, then run targeted regression, sibling paths, real workflows, adversarial attempts and broader mandatory gates.

10. **Keep payments and release deferred.** After those gates pass, implement approved P20, complete measured P22 cleanup, rerun affected qualification and obtain separate P21 approval.

These are recommendations for a subsequent authorised implementation session. **No implementation or testing was started in this audit.**

Final scoreboard:

- **Production code lines:** 54,185 working; 54,177 committed.
- **Total tracked code lines:** 133,700 working, including tests/configuration/generated declarations; 185,663 total tracked text lines.
- **Confirmed static defects:** 28.
- **High-confidence risks:** 5.
- **Unverified suspects:** 3.
- **Non-payment implementation completion:** approximately **43.3%**.
- **Full PLAN implementation completion:** approximately **42.5%**.
- **Verified readiness:** **undetermined**; 0% complete exact-candidate acceptance credit established by this audit.
- **Remaining implementation:** approximately **56.7% non-payment / 57.5% full PLAN**.
- **Most serious blocker:** completion and execution authority are not yet enforced end to end.
- **Immediate next step:** close P01’s trusted completion gate and direct database bypass, then the dependent STOP and recovery boundaries.