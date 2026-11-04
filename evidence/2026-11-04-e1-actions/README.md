# Isolated staging evaluation preparation — 4 November 2026

This is infrastructure evidence, not a live success result. No new E1 task has
yet been measured by this workflow. The earlier 7/8 handoff sample remains in
`evidence/2026-11-04-e1/` and is not combined with a new denominator.

Owner approved A1(a): protected staging credentials, existing free limits, no
production deployment. GitHub repository is public and standard hosted runners
are enabled. No Codespaces access is assumed or required.

## Protected environment

The owner placed environment secret `SUPABASE_SERVICE_ROLE_KEY` in an environment
also named `SUPABASE_SERVICE_ROLE_KEY`; the workflow uses that existing environment
directly. Its protection was configured and read back:

- Only branch `ocade/p00-p22-implementation` may use it.
- Required reviewer: repository owner; admin bypass disabled.
- Staging URL: `https://auyapercxxptziyngycx.supabase.co`.
- Enabled staging publishable key stored as a public environment variable.
- Secret presence verified by name only. Its value cannot be read back.

The unused, empty `ocade-staging` environment remains protected. Production
environment and production project were not changed.

## Isolation and measurement

`.github/workflows/jarvis-staging-evaluation.yml` is manual for real evaluation;
its push job only parses the shell entry point and receives no provider secrets.
The normal cloud CI workflow remains secrets-free. No schedule is added.

Only the root server step receives the staging credential. It checks the exact
staging URL and admin access before any task. The companion runs as `ocadelive`,
without sudo or Docker group membership, with the existing harness's environment
allowlist. Checkout does not persist a GitHub credential. No secret is placed in
command arguments or files. Output artifacts are scanned for the credential
before upload, including on ordinary test failure.

Seeds 22–24 run sequentially, 16 generators each, with 45-second pacing. The
workflow fails acceptance below 90% first-attempt success, with any gaming entry,
or with an incomplete denominator. Raw completed task reports remain evidence
if a run ends early; incomplete runs never establish the full E1 target. Results
are stored under the run-specific evidence path with the tested commit recorded.

The workflow and its shell syntax/refusal regressions still require cloud
validation. No requirement, concept or readiness gate is promoted here.

## Hidden target accuracy and interruption handling

The release-table generator retains its expected archive name inside the
harness. After a task, each actual browser download's suggested filename is
compared against that hidden label. All choices remain in order: a wrong choice
followed by a correct one records one wrong and one correct selection. Missing
receipts are explicitly unobservable; non-target families do not inflate this
denominator. This measures browser release-row selection only, not every kind of
desktop or file target.

Every completed task now atomically checkpoints the summary, with only the
completed-task denominator. An interrupted run keeps the preceding valid
checkpoint and raw task reports. Live and oracle-selfcheck modes are distinct.
New bookkeeping acceptance was submitted first as tests-only commit
`da66f72e23b67d626ed746a83e9215c10fd5bec0` in
[run 103](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41852581140).
Verification of the implementation remains pending.

## First Actions attempt

Run [41855114927](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41855114927)
at `6bfa9a5` completed runner setup and verified that `ocadelive` has only its own
group. It stopped at the admin credential preflight before generating any task;
there is no new task-success denominator. The preflight's generic failure did
not distinguish a header/transport problem from a rejected credential.

The preflight had separately built Python HTTP headers, including a bearer value
for opaque keys. The server already has a shared fetch bridge for this case.
The replacement uses that bridge, a 30-second timeout, and reports only a numeric
HTTP status and an allowlisted error category. Secret values and HTTP bodies are
never logged. Surrounding whitespace on copied opaque keys has its own failing
synthetic regression: normalization must not turn an API key into a bearer JWT
or remove a different caller's JWT. This is not evidence that the owner's key is
wrong; its validity remains unverified until the corrected preflight runs.

The 74-second recursive permission walk is removed: the runner's ordinary source
and package permissions already permit reads, so only parent traversal is made
explicit. Artifact scanning covers both raw and trimmed credential forms.
