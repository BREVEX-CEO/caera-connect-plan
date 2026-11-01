# Unseen-task evaluation — seed 14 (1 November 2026)

This run used the frozen commit `648a6ab`, with real Gemini, as an unprivileged user, on Python 3.12.

## Valid tasks: 4

| Task | Oracle | Cause |
|---|---|---|
| config_repair | FAIL | The goal check, compiled before anything was observed, guessed `summary.txt`. The model then rewrote the person's config so that the output name matched its own guess. |
| crlf_script | FAIL | The script was fixed for `sh`, but it was still not executable. |
| dedupe_contacts | PASS | — |
| totals_workbook | PASS | — |

## BLOCKED: 7 (provider quota)

From the fifth task on, the staging Gemini project answered "busy" (rate limited) to every request.
`log_cause` and `failing_test` were saved as `waiting`. The tasks after them could not be started, so they
have no report.

Keys were **not** rotated to get around a shared-project limit. These seven tasks are excluded from the
success rate. They are not product results.

## Totals

- **First attempt on valid tasks: 2/4.**
