# Unseen-task evaluation — seed 13 (1 November 2026)

All 11 tasks ran on the frozen commit `48af97e`, once each, with real Gemini, as an unprivileged user,
on Python 3.12 in a disposable Linux container. `summary.json` holds the oracle results.

## Failures

| Task | Cause |
|---|---|
| config_repair | Both planted faults were fixed. The model rewrote the whole config, though, and changed the program's output file name from `<word>_summary.txt` to `summary.txt`, which nobody asked for. Fixed: `fs.edit_text` changes only the exact passages named. |
| crlf_script | The line endings were fixed, but the execute bit was never restored, and the model ran the script with `sh`. Fixed: `fs.list` now reports whether a file is executable. |

## Totals

- **First attempt: 9/11 (82%).**
