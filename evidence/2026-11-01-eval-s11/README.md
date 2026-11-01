# Unseen-task evaluation — seed 11 (1 November 2026)

`tests/jarvis/live_eval.py --seed 11` ran 11 randomized problems once each through real Gemini on the
staging authority. The companion ran as an unprivileged user on the shipped Python 3.12 runtime, on this
disposable Linux container. Hidden oracles checked the real results. Every oracle fails on the untouched
problem (`--selfcheck`, seeds 1–3).

The code was not identical for every task:

- `config_repair` ran on `9408641`.
- The other tasks ran on the working tree that became `d9fd59b`, which changed only the goal prompt and
  the desktop-engine offer.

## Results

| Task | Oracle | Settled | Cause of failure |
|---|---|---|---|
| config_repair | FAIL | completed | Both faults were fixed, but the program output was moved into `OCADE output/`, so the goal check guessed the path. Fixed in `d9fd59b`. |
| crlf_script | FAIL | completed | The CRLF line endings were removed, but the execute bit was not restored. The script was run with `sh`. |
| dedupe_contacts | PASS | completed | — |
| totals_workbook | PASS | **blocked** | The workbook values are correct. The goal checked the input folder with `file_exists`, which a folder failed, so the model wrote copies of the inputs. The verifier now accepts a non-empty folder. |
| log_cause | PASS | completed | — |
| yaml_to_json | PASS | completed | — |
| failing_test | PASS | completed | — |
| biggest_files | PASS | completed | — |
| port_conflict | PASS | completed | — |
| markdown_doc | PASS | completed | — |
| web_fact | FAIL | blocked | The test machine's Xvfb display had died, so the browser could not start; this is an environment fault. The worker reported a generic `tool_error` and the model retried. It is now refused as `browser_unavailable`. The oracle's version parsing was also wrong; it is fixed, and the task failed regardless. |

## Totals

- **Oracle PASS:** 8/11.
- **Correct result and truthful "completed":** 7/11.
- **Excluding the environment fault:** 7/10, which is **70%**.
