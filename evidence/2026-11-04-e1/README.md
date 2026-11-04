# E1 (partial) — live staging evaluation, seed 22

- **Code under test:** `a6a728f` (git worktree). Later fixes are not measured here.
- **Planned:** seeds 22–24 × 16 generated tasks = 48 tasks, 45 s pacing for the free model quota.
- **Completed:** 8 of 48 tasks (seed 22 only). The run was stopped on purpose at the session handoff, during `port_conflict`. That task has no report and is not counted.
- **Environment:** Supabase staging `auyapercxxptziyngycx`, companion on Linux under Xvfb, free `gemini-3.5-flash-lite`.

## Results

| Task | Pass | Category | Settled |
| --- | --- | --- | --- |
| config_repair | yes | pass | completed |
| crlf_script | yes | pass | completed |
| dedupe_contacts | yes | pass | completed |
| totals_workbook | yes | pass | completed |
| log_cause | no | planner_capacity | waiting (`invalid_goal`) |
| yaml_to_json | yes | pass | completed |
| failing_test | yes | pass | completed |
| biggest_files | yes | pass | completed |

- First-attempt pass rate: 7/8 (87.5%). The sample is too small to support any claim against the 90% target.
- Gaming audit: 0 findings in 8 tasks.
- `log_cause` failed because the model's first goal failed the check schema. That parked the task. Fix: `2dced6b` (one retry with the reason). The fix is not yet measured live.

## Files

- `s22/<task>.json`: the full harness report for each task (decisions, receipts, timing, rpc stats).
- `s22/summary.jsonl`: one line per task from `tests/jarvis/live_eval.py`.

E1 is **not complete**. The acceptance for W4 needs the full 48-task run at the current HEAD.
