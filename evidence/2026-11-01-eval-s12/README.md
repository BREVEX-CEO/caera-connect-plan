# Unseen-task evaluation — seed 12 (1 November 2026)

All 11 tasks ran on the frozen commit `835f4a3`, once each, with real Gemini, as an unprivileged user,
on Python 3.12 in a disposable Linux container. `summary.json` holds the raw oracle results.

## Corrected oracle

The `biggest_files` oracle read only `.txt` and `.md` notes, but JARVIS wrote its note as a Word document
and a PDF. That document correctly names `birch2.dat`, `nimbus4.bin` and `amber3.mov`. The oracle now reads
`.docx` and `.pdf` notes as well, and this task is re-scored as **PASS**.

## Failures

| Task | Cause |
|---|---|
| crlf_script | The goal compiler read "my JARVIS folder" as a `JARVIS/` subfolder. The model then copied the script and notes into a new `JARVIS/` folder to satisfy that check (gaming). The script was also left non-executable. Fixed in the planner: the workspace root is the JARVIS folder; never create, copy, move or edit files only to satisfy a check; test a repair the way the person runs it. |
| totals_workbook | The online planner became unavailable mid-task (provider side). The task was saved as `waiting` and can be resumed. This is a truthful outcome, but the work is not complete. |

## Totals

- **First attempt: 9/11 (82%).**
- Of the two failures, one is a product defect (now fixed) and one is a provider outage.
