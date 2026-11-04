# Cloud gate recovery — 4 November 2026

## Baseline

Run [96](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41841842687)
tested `bb7d556ba2987fc3c1cf96e72151d085d4d3c22c`. Seven jobs passed; the
Windows companion job failed two of 160 tests. `run-96.json` records the actual
job outcomes and assertion values. No personal computer was tested.

- `VerifierKinds.test_a_repaired_program_is_rerun_in_a_throwaway_copy`:
  native Python exited 3; the verifier reported PowerShell's normalized exit 1.
- `WindowsUiLadder.test_ui_ladder`, UIA-014: a suspended app passed the hung
  check, reached UI Automation, and returned `unknown/tool_error`.

The existing tests are the failing regressions. Neither assertion is weakened.
No requirement, concept or readiness condition is promoted by this evidence.

## Cloud pre-push bootstrap

`scripts/ci-local.sh` combines the Linux source/build, TypeScript/security,
database, readiness, traceability and strict companion gates. CI invokes the
same core and companion phases. Existing pinned preflight counts remain intact.
Database and TypeScript diagnostic steps still run if the core gate fails.

Manual cloud validation accepts an unpublished candidate commit SHA. It checks
ancestry against the implementation branch before the planner executes. Every
job checks out the candidate; a candidate run does not cancel the branch run.
GitHub commit objects can be uploaded without moving the branch, then validated
before the implementation branch advances. GitHub rejected dispatching directly
on a bare commit SHA with HTTP 422, so this input must first be bootstrapped on
the existing implementation branch. This initial infrastructure update is not
claimed to have passed a pre-push gate; its cloud run is the bootstrap proof.

## Staging access

Owner authorized A1(a). Environment `ocade-staging` restricts access to branch
`ocade/p00-p22-implementation`, requires owner review, and disables admin bypass.
The owner stored the service-role secret in environment `SUPABASE_SERVICE_ROLE_KEY`.
That environment now has the same branch/reviewer/no-bypass protection and staging
URL/public-key variables; the evaluation uses it directly. Secret values are
never read back from GitHub. E1 remains unmeasured until its isolated server runs.

Readiness remains 20/100: 2/10 milestones, 19/42 conditions. Requirements remain
79/266 PASS; concepts remain 45/84 PASS. Fix verification is pending.

## Candidate fixes (verification pending)

PowerShell's documented `-Command` behavior normalizes a nonzero native process
status to 1. The shared `jobs.shell_argv` now preserves that status when the last
command failed, while a later PowerShell error still fails and a later successful
command still succeeds. The verifier reuses only shell argument construction;
its file reading, scratch workspace and result predicates remain independent.
New gateway tests cover native exit 3 and both later-shell-result cases. The
existing verifier regression still requires exactly exit 3.

`IsHungAppWindow` did not detect the suspended fixture in run 96. Before UIA
connects, the lease now requires a bounded `WM_NULL` round trip through
`SendMessageTimeout` (`SMTO_ABORTIFHUNG | SMTO_ERRORONEXIT`, 1000 ms). A timeout
refuses the action; another probe failure also refuses it. The existing real
UIA-014 assertion is retained and additionally requires `maybeChanged == false`.

Sources: [PowerShell command exit status](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pwsh),
[IsHungAppWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-ishungappwindow),
[SendMessageTimeoutW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendmessagetimeoutw),
and the [pywin32 wrapper](https://github.com/mhammond/pywin32/blob/main/win32/src/win32gui.i).

The four focused Windows regressions are now required before the broad matrix,
with an exact test count and no skips. Cloud validation must confirm these fixes;
they are not yet reported as VERIFIED.
