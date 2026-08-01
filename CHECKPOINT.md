# OCADE Phase Checkpoint

**Last updated:** 2026-07-31
**Branch:** `feat/ocade-implementation`
**Revision:** `23ea85f` (bound), tree clean
**Plan followed:** `OCADE_COMPLETE_PATH_TO_100_PERCENT.md` (supplied by owner; not stored in this repo)

---

## Phase executed this session: Phase 0 — Repository Truth

### STATUS: **INCOMPLETE — blocked on one of three Definition-of-Done conditions**

Phase 0's Definition of Done is: *"`git status` is clean or fully explained, CI is green, and the
OCADE-only percentage is recalculated from real evidence."*

| Condition | Result |
|---|---|
| `git status` clean or fully explained | **MET** |
| OCADE-only percentage recalculated from real evidence | **MET** |
| **CI is green** | **NOT MET — cannot be observed from this environment** |

Phase 0 is therefore **not** complete and Phase 1 must **not** begin. Two of three conditions
are satisfied; the third is a hard blocker recorded in full below.

---

## Raw evidence, per item

### 1. Repository state — MET

Starting state showed a **detached HEAD**, which is a repository-truth defect in its own right:

```
$ git symbolic-ref -q HEAD
DETACHED - no branch

$ git worktree list
C:/Users/haans/Desktop/6/caera-connect-plan/.claude/worktrees/caera-cadane-setup-67b0b3   e61bacc (detached HEAD)
```

Verified non-destructive before touching it — the detached commit was identical to both the
local and remote branch, so nothing was unreachable:

```
$ git rev-parse HEAD                              e61bacce6e51b7948ba7113caeb4d4e14f5bdc2e
$ git rev-parse feat/ocade-implementation         e61bacce6e51b7948ba7113caeb4d4e14f5bdc2e
$ git rev-parse origin/feat/ocade-implementation  e61bacce6e51b7948ba7113caeb4d4e14f5bdc2e
```

Reattached:

```
$ git checkout feat/ocade-implementation
Switched to branch 'feat/ocade-implementation'
Your branch is up to date with 'origin/feat/ocade-implementation'.

$ git symbolic-ref -q HEAD
refs/heads/feat/ocade-implementation
```

Final state — clean, nothing uncommitted:

```
$ git status --porcelain
(no output)

$ git status -sb
## feat/ocade-implementation...origin/feat/ocade-implementation
```

### 2. OCADE-only requirement ledger — MET

The repository ships **four** products behind one login (OCADE, a workforce-management system,
a world-intelligence dashboard, a document builder). Phase 0 requires a ledger for OCADE alone.

Rather than assume the existing 510-row register was already OCADE-scoped, three probes were run
(`scripts/build-ocade-only-ledger.mjs`, output `release/OCADE_ONLY_LEDGER.json`):

```
$ node scripts/build-ocade-only-ledger.mjs --write
Scope probe 1 — foreign requirements : 0 (reviewed exceptions: 1)
Scope probe 2 — borrowed evidence    : 0
Scope probe 3 — migrations OCADE/other: 7/32

OCADE-only readiness      : 258.5/510 = 50.7%
Excluding shared infra    : 236.9/467 = 50.7%
Proven on real equipment  : 27/510 = 5.3%
```

**Both probes were wrong on first run and were corrected by inspection, not by tuning:**

- Probe 2 initially reported **9** requirements borrowing workforce evidence via `records-pack`.
  False. Those files live in `src/lib/skills/packs/` and are OCADE's own capability adapters —
  `records-pack` checks exported ERP/HR files and shares nothing with the bundled workforce
  product but a similar name. Verified by locating each module rather than trusting its name.
- Probe 1 flagged **AZ-163 "resume"** as the document builder. False — its area is
  `Copilot and Cowork Orchestration; Reliability No-Progress Detection and Long Tasks` and its
  evidence is `copilot-session-flow` / `work-orchestrator`. It means resuming a *paused task*.
  Recorded as a **named exception with a stated reason**, not hidden by narrowing the regex.

**Conclusion:** the register is genuinely OCADE-only. The OCADE figure and the register figure
are the same number — now a verified fact rather than an assumption.

**Material finding — the database layer is NOT OCADE-only.** Only **7 of 32** migrations touch
OCADE tables; 25 belong to the other products. The 13 requirements under *Database Schema
Migrations and Rollback* and *Staging Database and Controlled Deployment* are graded against a
set that is ~78% other products' work.

**DB-01 is reclassified.** The missing table is `public.ficia_time_entries` — a **workforce
timesheet** table. It is a real defect for platform-wide disaster recovery, but it is **not an
OCADE defect** and must stop being reported as one blocking OCADE.

### 3. Readiness gate — was FAILING, fixed

The gate failed on entry with 5 errors. Recorded verbatim rather than skipped:

```
$ npm run readiness:check
OCADE final-readiness gate failed (5):
- evidence_binding_drift: Snapshot evidence binding "sourceRevision" does not match the current verification environment.
- source_revision_drift: Snapshot is not bound to the current source revision.
- published_score_stale: Published evidence-bound numerator or denominator differs from the executed calculation.
- published_declared_score_stale: Published declared or evidence-bound percentages differ from the executed calculation.
- published_dimensions_stale: Published status counts or readiness dimensions differ from the executed calculation.
```

Cause — three evidence files were added after the previous binding:

```
$ git diff --name-only 33e2e29..HEAD
release/OCADE_P23_HOSTED_EVIDENCE_BLOCKER.json
release/OCADE_P24_COMPANION_BUILD_EVIDENCE.json
release/OCADE_P29_FINAL_READINESS.json
release/OCADE_RELEASE_BLOCKERS.json
release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json
```

The drift was real and the gate was right to refuse. No source or script changed — only
`release/*.json` — so the evidence remained valid and re-binding was the correct fix. After:

```
$ npm run readiness:check
OCADE final readiness: declared 258.5/510 (50.7%)
Evidence-bound closure: 258.5/510 (50.7%)
Unverified positive-weight declarations: 0
PRODUCTION READY: NO - live, signed, deployed and requirement-bound evidence remains incomplete.
Gate status: honest closure accounting is internally consistent.
```

### 4. Full verification bundle (required by §1.4 after every phase)

```
=== TYPECHECK ===
> tsc --noEmit
(no output — clean)

=== LINT ===
✖ 2424 problems (0 errors, 2424 warnings)

=== TESTS ===
 Test Files  253 passed (253)
      Tests  4171 passed | 1 skipped (4172)

=== BUILD ===
PASS

=== GATES ===
passed: 41/42
failed: deploy:check
```

Lint exits 0: **0 errors**. The 2,424 warnings are pre-existing baseline debt, not regressions.

`deploy:check` fails deliberately and correctly — it refuses to deploy without credentials:

```
$ npm run deploy:check
OCADE deployment controller: BLOCKED
OCADE_DEPLOY_HEALTH_URL must be an HTTPS /api/health URL; CLOUDFLARE_API_TOKEN is missing; CLOUDFLARE_ACCOUNT_ID is missing
```

### 5. CI is green — **NOT MET. This is the blocker.**

The workflow **does** trigger on push to this branch, so runs have been created by the pushes
made during this and prior sessions:

```
$ sed -n '1,8p' .github/workflows/ci.yml
on:
  push:
    branches: ["feat/ocade-implementation", "main"]
  pull_request:
    branches: ["main"]
```

The result cannot be read from this environment:

```
$ command -v gh
gh not installed

$ env | grep -oiE "^(GH_TOKEN|GITHUB_TOKEN|GH_ENTERPRISE_TOKEN)="
none

$ git config --get credential.helper
manager

$ curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/BREVEX-CEO/caera-connect-plan
404
```

The 404 is the repository being **private**, so unauthenticated calls cannot see it. Git pushes
succeed because credentials live in the Windows Credential Manager vault; those are not readable
as a token, and extracting a stored credential to call an API is not something to do unasked.

**This is an observation gap, not missing work.** The workflows exist, are correct, and have been
triggered. Recording "CI green" without reading the run would be fabricating the single piece of
evidence Phase 0 exists to establish.

#### Pre-verification: every command all three CI jobs run, executed locally

Since the run cannot be read, the next best thing was done — each job's commands were run here,
so that if the hosted run is red the failure is genuinely new information rather than something
already visible locally. `ci.yml` defines exactly three jobs on a push to this branch.

**`audit` job** — the only job that runs on `ubuntu-latest`, and the one with least prior signal:

```
$ npm audit --omit=dev
found 0 vulnerabilities
EXIT CODE: 0
```

**`rust` job** — four commands in `native/companion/safety`. `cargo fmt --check` and
`cargo clippy -D warnings` are strict and had not previously been run:

```
$ cargo fmt --check
EXIT: 0

$ cargo clippy --all-targets -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.21s
EXIT: 0

$ cargo check --all-targets
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.07s
EXIT: 0

$ cargo test --all-targets -- --nocapture
test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
EXIT: 0
```

**`web` job** — typecheck, lint, tests, build and 20 gate steps, all recorded in §4 above. Every
gate named in `ci.yml`'s step list is among the 41 that pass. `deploy:check` is **not** in that
list, so its correct credential refusal cannot fail this job.

This raises confidence but **does not close the condition**. Local success on one Windows host is
precisely what "hosted evidence" exists to distinguish itself from. The run still has to be read.

---

## What clears the blocker

Either action is sufficient and takes about a minute:

1. **Read it directly** — open the repository's **Actions** tab, select the most recent run on
   `feat/ocade-implementation`, and report the result of the `web`, `rust` and `audit` jobs.
2. **Install the GitHub CLI** and authenticate, after which this can be verified unattended:
   ```
   gh run list --branch feat/ocade-implementation --limit 5
   gh run view <id> --log
   ```
   Alternatively export a `GITHUB_TOKEN` with `actions:read` scope into the environment.

**Expected but NOT assumed:** every command CI runs passes locally at this revision (above). A
green run is likely. It is not evidence until it is read. Note `deploy:check` is not in `ci.yml`'s
step list, so its correct refusal should not fail the `web` job.

---

## Next phase

**Phase 0 remains the current phase.** Do not start Phase 1 until CI has been read and is green.

Once Phase 0 closes, the next phase is:

> **Phase 1 — Local AI Model Lifecycle Completion**
> Resumable download, digest verification, install to the app-managed directory, branded
> "OCADE Local Engine" throughout the UI, repair path, update path via the existing auto-updater,
> uninstall path. Proven on a clean machine from first launch through to a real verified chat
> reply with no manual steps, plus independent corrupted-file and interrupted-download recovery
> tests.

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

The 50.7% is a weighted position on the evidence ladder, not "half the features work". Only the
27 real-target rows are proven on real equipment.
