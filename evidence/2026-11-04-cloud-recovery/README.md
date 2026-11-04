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
