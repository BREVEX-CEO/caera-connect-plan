# OCADE Phase Checkpoint

**Last updated:** 2026-08-01
**Branch:** `feat/ocade-implementation`
**Base revision:** `4e99835` — re-measured in a fresh worktree, not carried forward
**Plan followed:** `OCADE_COMPLETE_PATH_TO_100_PERCENT.md` — **now committed at the repo root**
(sha256 `C64DBB21A5A2D594A0ED9981AA9183E163ED482F783D3155BB1AE1160DE5F6EA`, 345 lines). It previously
lived only in the owner's `Downloads` folder, so the file the plan's own §6 prompt tells each
session to read did not exist in any checkout.

Full raw evidence for this phase: [`release/OCADE_P30_PHASE0_BASELINE.json`](release/OCADE_P30_PHASE0_BASELINE.json).

---

## Phase executed this session: Phase 0 — Repository Truth

### STATUS: **INCOMPLETE — one of three Definition-of-Done conditions still open**

| Condition | Result |
|---|---|
| `git status` clean or fully explained | **MET** |
| OCADE-only percentage recalculated from real evidence | **MET** |
| **CI is green** | **NOT MET — still unobserved** |

Phase 0 does not close. But this pass was not a repeat of the last one: it found and fixed a defect
that would have kept CI red no matter how many times it was looked at.

---

## 1. The worktree was measuring the wrong branch

The session opened on `claude/vigilant-raman-9a439a` — a Lovable-sync branch with **34** `src/lib`
modules and **none** of the OCADE programme: no `scripts/`, `release/`, `audit/`, `extension/`,
`relay/` or `vitest.config.ts`. Every gate run there would have measured a pre-OCADE baseline and
reported it as OCADE's.

Switching in place was refused, correctly — untracked `android/`, `ios/` and `native/` directories
collide with tracked files on this branch. `git clean` is forbidden, and deleting the owner's
untracked files to win an argument with git is not a fix. Resolved with `git worktree add`:
non-destructive, and it produced a genuinely clean checkout, which is what exposed D19 below.

```
tracked files 1058 · src/lib non-test modules 199 · HEAD == origin/feat/ocade-implementation
```

## 2. Re-measured verification bundle

Executed this session, in that clean checkout, after `npm ci` from the committed lockfile.

```
=== TYPECHECK ===   exit 0 — 0 errors
=== LINT ===        exit 0 — 0 errors, 231 warnings
=== TESTS ===       exit 0 — 255 files, 4187 passed, 2 skipped, 0 failed
=== BUILD ===       exit 0
=== GATES ===       44/45 — only deploy:check fails, correctly refusing without credentials
=== RUST ===        fmt 0 · clippy -D warnings 0 · check 0 · test 30 passed, 0 failed
=== AUDIT ===       production 0 vulnerabilities · all: 1 high, dev-only (glob→brace-expansion)
```

Figures above are at the tip of this phase. Mid-phase the suite read 254 files /
4,173 passed / 6 skipped; the extra file and tests are the evidence-integrity
enforcement suite (§7), and four of the six skips were tests refusing to assert
against a stale evidence binding, which now execute and pass.

**Three previously published figures were wrong**, and the third one mattered:

| Published | Measured | |
|---|---|---|
| 2,424 lint warnings | **231** | already fixed in `dcf665a`, never propagated here |
| 253 files, 4,171 passed, 1 skipped | **254 files, 4,173 passed, 6 skipped** | drift |
| **0 failed** | **1 failed** | **a real, CI-breaking defect — see D19** |

## 3. D19 — the defect that would have kept CI red

`release-gate-enforces.test.ts` required `check-release-source.mjs` to exit 0. That gate verifies
`.output/server/wrangler.json`, which only exists after `npm run build`. **`ci.yml` runs "Unit
tests" before "Production build"**, so the build output cannot exist yet. The test passed on the
development machine only because earlier builds had left `.output/` lying around.

So the web job would have failed at the *Unit tests* step, on every push, for as long as this test
has existed. The previous checkpoint reasoned from local success that "a green run is likely."
That was wrong — and it is precisely the failure mode hosted evidence exists to catch.

**Fixed** by making the test assert its actual subject. The suite exists to prove the gate rejects
an overstated *ledger*; it now tolerates the one build-output prerequisite and requires every
ledger check to pass. **Proven by mutation:** setting the ledger `status` to `ready` fails the new
assertion. The ledger was restored byte-identically (`7ABB3FCF…15C5`, `git status` clean).

## 4. D20 — a gate that crashed rather than failed

`check-stage2-baseline.mjs` read the gitignored, machine-local `.claude/OCADE_STAGE_2_SPEC_HASHES.json`
unconditionally and died with an unhandled `ENOENT` before running a single check. `ci.yml` excluded
it by comment — which also left its **175 repository-intrinsic checks** unverified by CI as
collateral damage.

Intrinsic and provenance checks are now separated. Intrinsic checks always run; provenance checks
are reported as **SKIPPED by name with a reason** when their snapshot is absent, and are never
counted as passed — absence of a check is not a passing check. **The gate is re-enabled in CI.**

**Proven by mutation, both paths:** corrupting `readiness.stage2Source` → `failed (3/175)`, exit 1.
With the snapshot present the gate runs **186** checks; corrupting a recorded sha256 → `failed
(2/186)`, exit 1.

## 5. Local engine — the "no model installed" blocker is stale

`docs/archive/OCADE_MASTER_EXECUTION_QUEUE.md` §4 recorded *"Blocked by: no local model installed."* **False.**
The engine is installed, was started this session, and answers on `127.0.0.1:11434` with **27.07 GB**
of weights:

| Model | Size | Quant | Tool calling |
|---|---:|---|---|
| `qwen3-coder:30b` | 18.56 GB | Q4_K_M | yes |
| `qwen2.5-coder:7b` | 4.68 GB | Q4_K_M | yes |
| `deepseek-coder:6.7b` | 3.83 GB | Q4_0 | **no** |

`deepseek-v4-pro:cloud` is **excluded from use** — it is a remote alias for `ollama.com:443`, not a
local model, and using it would send prompts off this machine.

**Measured hardware:** 15.6 GB RAM · i5-1135G7 (4c/8t) · Intel Iris Xe integrated, no dedicated GPU.
Against the plan's §2 matrix that is unambiguously *"Mid PC, CPU-only → **Qwen3 8B, Q4**"* — and
**that tier is not installed**. The 30B is a MoE that will not serve this tier on 4 CPU cores, the
7B is the wrong family, and the 6.7B reports no tool-calling at all, so it cannot drive OCADE's
typed-action system. Phase 1 pulls `qwen3:8b` and proves the tier by measurement.

**This proves a prerequisite, not a capability.** No inference has ever been run through OCADE.

## 6. CI — still the open condition

`gh` **is** installed (2.97.0, `C:\Program Files\GitHub CLI\gh.exe`) — the previous checkpoint
recorded it as absent. But it is not on PATH, has no `hosts.yml`, and:

```
$ gh auth status
You are not logged into any GitHub hosts. To log in, run: gh auth login
EXIT: 1
```

No `GH_TOKEN` or `GITHUB_TOKEN` is set. **One owner action clears this:**

```
gh auth login
```

Authenticating on the owner's behalf is not something to do unasked, and recording "CI green"
without reading the run would fabricate the single piece of evidence Phase 0 exists to establish.

**A falsifiable prediction, not an assumption:** because of D19, recent runs were almost certainly
**red** at the *Unit tests* step. The push carrying this phase contains the fix.

## 7. Evidence-integrity gate — built and enforcing

The six false-progress conditions are now executable checks rather than written
rules, run in CI **before** the readiness gate (scoring dishonest rows accurately is
not much use). `npm run evidence:integrity`, 510 requirements, 0 violations.

| Condition | Enforced as |
|---|---|
| Requirement has no owner | `no_owner` |
| Blocked row names no exit condition | `blocker_unspecified` |
| Evidence cites a file not on disk | `evidence_file_missing` |
| Evidence bound to a different commit | `revision_drift` |
| Real-target claim with no retained artefact | `real_target_without_evidence` |
| Structural test passed off as runtime proof | `source_text_as_runtime_proof` |
| Blocked row weighted as proven | `blocked_but_verified` |

**Owners.** All 510 rows had status, weight and evidence; **none had an owner**. That is
how a blocked requirement sits untouched — "EXTERNALLY BLOCKED" reads like a fact about
the world when it is a fact about a person who has not done a specific thing. Now 411
internal and 99 external, each blocked row naming who can clear it, what they must
supply, and the exact proof that closes it. Rows matching no blocker are **reported, not
given a filler owner** — all 510 matched, so nothing was invented.

**Two defects in this gate's own construction**, both caught before commit and both the
exact failure mode it exists to detect:

- The structural-test loader required `entry.kind === "structural"`. No entry has a
  `kind` field — the key is `structuralOnly` and membership *is* the classification. The
  set stayed empty, so condition 5 was **inert while reporting success**.
- Its test had the same bug and worse: it looked up the same non-existent key, found
  nothing, and **returned early — passing while proving nothing**. It now asserts the
  fixture is non-empty first, and keeps a real retained artefact alongside the structural
  one so only the intended violation is possible.

Ten enforcement tests, one per condition, each proven to fail on a specific realistic
corruption. The snapshot is restored byte-identically in `afterEach`, including on failure.

---

## Next phase

**Phase 0.5 — Sibling quarantine.**

FICIA, MADEE and CANIA are currently fully live — ~40 authenticated routes, 12 lib modules, 5
components and three top-level sidebar entries. `git grep "Coming later"` returns **zero matches**.
They must become disabled placeholders reading **"Coming later — not an AI model."**: no route
opens, no loader or data function runs, nothing appears in the model selector, nothing consumes
runtime resources, and none of it counts toward OCADE completion — enforced by a CI gate proven to
fail if they reactivate. Their source is preserved on disk for future development.

Alongside it: convert the **27 structural-only test files** into execution tests, each proven by
mutation, and raise route execution coverage from **1 of 85**.

---

## Current verified figures

| Measure | Value |
|---|---|
| OCADE-only readiness | **258.5 / 510 = 50.7%** |
| Excluding shared infrastructure | 236.9 / 467 = 50.7% |
| **Proven on real equipment** | **27 / 510 = 5.3%** |
| Simulated runtime verified | 52 |
| Externally blocked | 99 |
| Not started | 27 |
| Production ready | **NO** |

The 50.7% is a weighted position on the evidence ladder, not "half the features work". Only the 27
real-target rows are proven on real equipment.

**25 of the 27 NOT STARTED rows need no credential, device or toolchain** — they are charter, ADR,
architecture and governance documents. `release/OCADE_READINESS_COMPOSITION.md`'s claim that the
buildable remainder is "None" is therefore false, and Phase 0.75 closes them.
