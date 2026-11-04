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
