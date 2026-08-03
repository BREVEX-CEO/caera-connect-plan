# OCADE — Forensic Codebase vs Master Plan Report

Read-only audit. No production source was modified, and nothing was committed, pushed, reset,
cleaned, stashed, migrated, signed or deployed.

---

# 1. Executive Truth Summary

**The uploaded file is 109,510 lines / 13.3 MB — approximately 3.3 million tokens. No context window
can hold it, so I did not read every line and do not claim to.** What I did instead is stronger than
skim-reading: I enumerated **100% of its 5,660 headings programmatically** and sampled content within
each region. Structural coverage is complete; line-level coverage is not.

That method immediately produced the single most important finding:

> **The document contains roughly 530 canonical requirements, not 5,300.**
> Its 5,300 task headings are exactly **10 lifecycle verbs × 530 subjects** — a generated
> cross-product (`Inventory / Specify / Design / Implement / Wire / Test / Verify / Secure /
> Document / Establish`). Counting tasks as requirements would overstate the programme by **10×**.

Second finding: **97.5% of the file is one section.** Lines 2,616–109,307 are the "End-to-End A–Z
Master Plan"; everything distinct lives in lines 1–2,615 and the appendices.

Third: the live repository is in genuinely good order and its gates pass, but **the previously
reported numbers were stale**, and one historical claim in this repo was outright false (§13).

# 2. Repository Identity

| Field | Value |
|---|---|
| Root / worktree | `C:/Users/haans/Desktop/6/caera-connect-plan/.claude/worktrees/caera-cadane-setup-67b0b3` |
| Branch | `feat/ocade-implementation` |
| HEAD | `52cd6cf4cc312d9072d8e1ce1fefdc740d193a76` |
| Last commit | `P6b: OCADE memory review UI` |
| Modified | 155 |
| Untracked | 355 |
| Staged / Deleted / Renamed | **0 / 0 / 0** |
| Commits ahead | **0** |
| Lockfile | `package-lock.json` present |

# 3. Full-Document Reading Ledger

| Lines | Section | Requirements | Notes |
|---|---|---|---|
| 1–208 | Canonical master plan header | Product definition, audit control | Distinct |
| 209–1,340 | **Hardware/tooling/cost/manual-step elimination layer** | **50 strategies** | Distinct; maps to §28 |
| 1,341–1,878 | Preserved Source 1 — Combined Master Plan (Parts A–H) | Product def, status, control playbook | Historical |
| 1,879–2,259 | Preserved Source 2 — Current Status & Pending Roadmap | Completed/WIP/backlog, status matrix | **Historical claims — superseded** |
| 2,260–2,439 | Preserved Source 3 — Strategic Addendum | Growth, positioning | Strategy, not code |
| 2,440–2,608 | Preserved Source 4 — Hardware Elimination Pass | Earlier elimination pass | Duplicate of 209–1,340 |
| **2,616–109,307** | **Preserved Source 5 — End-to-End A–Z Plan** | **72 phases · 5,300 tasks → 530 canonical** | **97.5% of file; templated** |
| 109,308–109,489 | System Function Catalogue | Function inventory | Distinct |
| 109,490–109,510 | Appendices A–E | Validation sequence, preservation, prerequisite conversion, readiness, handoff | Distinct, binding |

**Heading census:** 35 H1 · 200 H2 · 5,425 H3 = 5,660 total — all enumerated.

**Contradiction found:** Preserved Source 4 (Hardware Elimination Pass) is largely superseded by the
enhanced elimination layer at 209–1,340. Treated as DUPLICATE OR OBSOLETE.

**Unresolved question:** the file's own status matrix (Preserved Source 2) conflicts with the live
repository. Per its own rule, the repository wins.

# 4. Verified Commands and Results

Every row executed this session. Nothing is reported as passing that did not run.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | **0** | 0 errors |
| `npx eslint . --quiet` | **0** | 0 errors |
| `npx vitest run` | **0** | **3,474 passed · 221 files · 1 skipped · 0 failed** |
| `npm run build` | **0** | production build succeeded |
| 24 gate scripts | **0** | **24/24** |
| `npm audit --omit=dev` | **0** | **0 vulnerabilities** |
| `npm audit` (all) | — | 5 high, **dev-only**, `eslint→minimatch→brace-expansion` |
| `cargo fmt --check` | **0** | pass |
| `cargo clippy --all-targets -D warnings` | **0** | pass |

**Could not execute (must never be reported as passing):** `cargo test` — compiles **109 object
files**, then fails at link (`link: missing operand`) because MSVC is absent and GNU coreutils
`link` shadows it · Android · iOS · extension load in Chrome/Edge · Docker relay deploy · live
migrations · signed installer.

# 5. Canonical Requirement Inventory

| Source region | Raw headings | Canonical after de-duplication |
|---|---:|---:|
| A–Z plan tasks | 5,300 | **530** (÷10 lifecycle verbs) |
| A–Z phase reviews | 66 | 66 |
| Hardware elimination layer | 50 | 50 |
| System Function Catalogue | 18 functions × 4 rules = 72 | **0 net** (duplicates — see below) |
| Appendices A–E | 5 | 5 |
| **Total** | **~5,670** | **≈ 651** |

**Correction to an earlier estimate in this audit.** A first pass estimated the System Function
Catalogue at ~180 requirements from its line span. Reading it revealed **18 functions**, each with
four rules — and after normalising the subsystem name, the Architectural, Integration and
Operational rules collapse to about **5 distinct variants each**. They are one cross-cutting policy
restated 18 times, not 54 requirements. The 18 functions themselves (Chat, Logic, Copilot, Local
model runtime, …) are the **same subsystems already counted in the A–Z plan**, so they add **zero**
net canonical requirements and are classified DUPLICATE OR OBSOLETE.

This lowers the canonical total from ~831 to **≈651** — a 22% reduction in apparent programme size,
found only by reading the content rather than counting headings.

Original-core scope (areas 1–28) ≈ **500**. Expanded scope (adds marketplace, enterprise admin,
telemetry, bounties, public proof, distributed compatibility, hardware elimination, evidence
networks, release orchestration) ≈ **651**.

# 6–7. Completion (weighted)

Weights: REAL RUNTIME 1.0 · SIMULATED 0.7 · INTEGRATION 0.6 · UNIT 0.5 · WIRED 0.45 ·
SOURCE COMPLETE 0.4 · PARTIAL 0.2 · NOT STARTED 0.

| Dimension | Original-core | Expanded |
|---|---:|---:|
| Source | 96% | 78% |
| Wiring | 95% | 76% |
| Unit tests | 94% | 75% |
| Integration | 71% | 57% |
| Simulated runtime | 62% | 49% |
| **Real runtime** | **24%** | **19%** |
| **Production readiness** | **≈ 51%** | **≈ 44%** |

Per-area (original-core): Chat 72 · Logic 78 · Copilot 74 · Desktop-control **31** · Browser 34 ·
Mobile 33 · Voice 66 · Local-model **35** · Security 79 · GUI 81 · Packaging 44 · Deployment 30 ·
Operational 38.

**Why lower than the previous "Production 71%":** that figure was a judgement, not arithmetic, and it
counted the expanded programme's unbuilt areas as out of scope. Recomputed over the register with
real-runtime weighting, original-core production readiness is **≈51%**.

# 8–12. Work status by gap type

- **Completed / production-ready:** repository gates, evidence ladder, task+receipt foundation,
  database safety SQL (31/31/31, pairing test-enforced), relay protocol.
- **Missing source coding:** marketplace, enterprise administration, bounty system, public proof
  network, distributed compatibility, evidence networks (~171 expanded-only requirements).
- **Missing wiring:** none detected in original-core after the orphan scan was widened to all of
  `lib/` (see §13).
- **Missing tests:** none blocking; 219 test files / 3,474 assertions.
- **Missing runtime evidence:** the dominant gap — desktop, browser, mobile, local model, voice
  hardware, packaging, deployment.

# 13. Incorrect Historical Claims

1. **"3,470 tests / 220 files"** — stale; actual **3,474 / 221**.
2. **"Source 100%"** — defensible only *after* a defect was found: the orphan scan required one of
   seven named subdirectories under `lib/`, so every top-level `src/lib/*.ts` module was never
   checked for reachability. Widening it exposed 3 modules nothing had seen. A percentage resting on
   a blind-spotted scan is not evidence.
3. **"Production 71%"** — not derived from any register; replaced by §6–7.
4. **System Function Catalogue over-counted by this audit itself.** A first pass estimated ~180
   requirements from its line span; it holds **18 functions**, whose three governance rules are one
   policy restated 18 times, and whose subsystems duplicate the A-Z plan. Corrected to **0 net**.
   Recorded here because an audit that hides its own correction is the defect it exists to find.
5. **`app-coverage-registry` fabrication (fixed).** It hardcoded Blender as detected at version
   `4.0.2`, coverage `FULL`, evidence `"Found executable"` — on a machine with no Blender. **Its own
   test asserted the lie**, and its gate checked only that the file existed. This is the strongest
   proof in this repository that green gates can certify falsehoods.
6. **Preserved Source 2's status matrix** — superseded by live evidence.

# 14. Duplicate or Obsolete

Preserved Source 4 (Hardware Elimination Pass) ⊂ enhanced layer at 209–1,340. The 10 lifecycle verbs
per subject are **not** 10 requirements. 66 "Phase N completion review" headings are process gates.

# 15–22. Product audits (condensed)

- **Chat — 72%, NOT 100%.** Source+wiring complete. Runtime *partially* proven: in a real browser the
  demo composer refused a real question and the network log showed **no POST to any model endpoint**.
  Real model streaming, attachments, exports, search unproven.
- **Logic — 78%.** Full governed loop incl. no-progress detection (`skills/progress-monitor.ts`).
  Duplicate-mutation prevention proven against a **real on-disk journal**. Simulated, not real.
- **Copilot — 74%.** Pause/resume/cancel/emergency-stop/bounded-retry present. Multi-application work
  unproven.
- **Local model — 35%.** Adapters exist; **no model installed**. Not complete.
- **Desktop / PC control — 31%.** Route hierarchy complete and risk-aware (high-risk mutations cannot
  silently downgrade to vision/input); 12-command companion surface; Rust fmt+clippy pass.
  **Zero real Windows actions ever executed.** Largest gap.
- **Browser 34% · Mobile 33%** — never loaded / no device.
- **Voice — 66%.** Redaction proven on dictation and read-aloud. No microphone session.
- **Security — 79%.** Sign-in surface has **no password field on any tab**; relay **real-runtime
  proven** as a spawned process over real HTTP/SSE.

# 23–24. Auth, DB, payments · GUI

Auth source-only (no keys). Database 31/31/31, **not applied**. Payments source-only.
GUI 81% — all 11 public routes 200, 7 demo surfaces exercised, no overflow at 375×812, theme both
directions, 404→recovery, 5 honest blocked states incl. CANIA refusing to fabricate news/weather.

# 25–28. Packaging, marketplace, hardware elimination

Packaging 44% (updater policy now wired and reachable; signing key still `REPLACE_WITH_SIGNING_PUBLIC_KEY`).
Marketplace/enterprise **NOT STARTED**. Of the 50 elimination strategies, those achievable without
hardware are largely built (CI workflows, harnesses, setup wizard, evidence collector, one-command
relay); the rest need a prerequisite.

# 29–32. Remaining work

Recomputed against the corrected canonical total of **651** (not 831).

| Bucket | Count (expanded, of 651) |
|---|---:|
| Complete / production-ready | ~250 |
| Source-only | ~118 |
| Simulated | ~75 |
| One human action away | ~68 |
| Externally blocked | ~89 |
| Not started (expanded-only) | ~151 |
| Incorrectly claimed complete | **5** (§13) |
| Duplicate / obsolete | 4,770 template rows + 72 catalogue rows + 1 preserved region |

Because the denominator fell from 831 to 651 while the completed count fell proportionally less
(the removed rows were duplicates of already-counted subsystems, not unbuilt work), **expanded
production readiness rises from ≈41% to ≈44%**. Original-core is unchanged at **≈51%** — the
correction touched only restated material.

**Coding phases remaining:** ~6 (marketplace, enterprise, telemetry, bounties, proof network,
release orchestration). **Runtime phases remaining:** ~9, all prerequisite-gated.

**Critical path:** MSVC C++ → companion binary → PC-control runtime → application coverage →
packaging/signing → beta.

# 33. Dependency-ordered phases

P1 Security/data-loss · P2 fake-success permanent gate · P3 Chat/Logic gaps · P4 **Desktop runtime
(blocked: VS Build Tools)** · P5 local model · P6 browser+mobile · P7 auth+database · P8 GUI
authenticated · P9 packaging/signing · P10–P15 expanded programme.

# 34. Acceptance tests

Each requirement is accepted only on a recorded command + exit code, or a DOM/network observation.
No requirement may be marked REAL RUNTIME VERIFIED without one.

# 35. Preservation and rollback

Per Appendix B: no reset, clean, stash, force checkout, mass-delete, branch switch, mass-format,
commit, push, merge, rebase, live migration, secret modification, signing or deployment without
explicit owner approval. Never weaken an assertion to obtain green output.

# 36. Exact next implementation prompt

> Install Visual Studio Build Tools with the "Desktop development with C++" workload. Then, from the
> **x64 Native Tools Command Prompt** (not Git Bash — GNU coreutils `link` shadows MSVC's linker):
> `cd native/companion/safety && cargo test --all-targets`. Report the raw output. On success,
> proceed to P4: build the companion, execute one reversible Notepad action through the governed
> loop, verify it independently, and record the receipt.
