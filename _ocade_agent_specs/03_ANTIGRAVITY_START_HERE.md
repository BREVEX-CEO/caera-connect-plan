# OCADE — Antigravity Continuation Entry Point

## Mandatory repository target

Operate only in this existing local worktree:

`C:\Users\haans\Desktop\6\caera-connect-plan\.claude\worktrees\caera-cadane-setup-67b0b3`

Expected branch:

`feat/ocade-implementation`

Expected HEAD at handoff:

`52cd6cf4cc312d9072d8e1ce1fefdc740d193a76`

Do not create another repository, branch or worktree. Do not operate from the parent `caera-connect-plan` checkout.

## Mandatory read order

1. `_ocade_agent_specs/01_OCADE_OLD_PHASES.md`
2. `_ocade_agent_specs/02_OCADE_STAGE_2_UNIVERSAL_CONTROL.md`
3. `CODEX_CONTINUATION_HANDOFF.md`
4. `OCADE_EXECUTION_PROGRESS.md`
5. `OCADE_CHECKPOINT_STATE.json`
6. `OCADE_RUN_STATE.md`, if present
7. `AGENTS.md`, if present
8. Git status, tracked diff, untracked inventory and package/test configuration

The older OCADE file is the first execution contract. Finish any remaining old phases before continuing the Stage 2 phases. Do not restart completed phases.

## Exact Codex handoff

Codex stopped because its account usage limit prevented the mandatory full Vitest rerun.

Phase 33 remains `IN PROGRESS`.

Completed before the interruption:

- Signed and scoped mobile mission-control source was implemented.
- Fail-closed Android and iOS bridges were implemented.
- The first complete test run produced 2,536 passed and 1 failed.
- The sole failure was diagnosed as an obsolete integration assertion.
- A minimal correction was applied.
- Typecheck passed after the correction.
- The complete Vitest rerun did not execute because the Codex account limit was reached.

Reported repository state at handoff:

- Modified tracked paths: approximately 60
- Untracked paths: approximately 442
- Deleted: 0
- Staged: 0
- Commits: 0
- Pushes: 0
- Migrations applied: 0

Treat these numbers as expectations only. Verify the real current state before editing.

## First continuation action

1. Confirm the exact worktree path, branch, HEAD and Git status.
2. Read the Phase 33 handoff and inspect the minimal test correction.
3. Run the complete Vitest suite.
4. Fix only genuine failures using the smallest compatible changes.
5. Rerun focused tests and then the complete suite until green.
6. Run typecheck, lint, production build and all available repository gates.
7. Seal Phase 33 only after the mandatory gates pass.
8. Continue immediately to Phase 34 and every remaining Stage 2 phase.

## Preservation rules

Never:

- Reset, clean, stash or discard the working tree.
- Treat untracked files as disposable.
- Mass-format the repository.
- Switch branch or worktree.
- Delete existing implementation merely because it is deferred.
- Commit, push, merge, rebase or open a pull request without approval.
- Apply live migrations.
- Change secrets.
- Install system-level tools.
- Sign or deploy without approval.
- Fabricate tests, runtime proof, application support or percentages.

## Required cycle

`READ → PLAN → WRITE → FOCUSED TEST → DEBUG → RETEST → TYPECHECK → LINT → FULL TESTS → BUILD → AVAILABLE RUNTIME/NATIVE/BROWSER/SECURITY CHECKS → DIFF REVIEW → CHECKPOINT → REPORT → CONTINUE`

Do not stop after one test, file, report, checkpoint, percentage or phase.

Before any unavoidable stop, update all continuation files with the exact next command, expected result and blocker.
