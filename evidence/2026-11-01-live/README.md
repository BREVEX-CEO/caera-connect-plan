# Live Gemini runs and cross-platform CI — 1 November 2026

## Environment

- **Model path:** the production task authority and planner from this branch called the
  deployed staging `ocade-intelligence-service` (Gemini). Each run used a new synthetic
  staging account (`ocade-jarvis-p3-*` or `ocade-jarvis-q-*` at example.com).
- **Computer:** this disposable Linux cloud container. The companion ran as an
  unprivileged OS user (`ocadelive`) with an allow-listed environment. It held no server
  keys. The browser was Chromium on Xvfb.
- **Confirmations:** the test operator confirmed each external effect
  (`--confirm-effects`). The exact effect of each confirmation is in each report under
  `confirmations`.
- **Harness inputs:** the harness gave only the person's request and the grants. The
  problems and answer keys were written by Claude. The product never saw the answer
  keys.
- **Verdicts:** every verdict below comes from Claude's own check of the real result:
  rerunning the script, reading the workbook, or comparing with the source site. It
  does not come from the settlement.

## Results

The **Elapsed** column is seconds.

| Run | Problem | Settled | Independent verdict | Elapsed | Model calls |
|---|---|---|---|---|---|
| p1 | Script crashes: a trailing comma in its config and a renamed CSV column | completed | **PASS**: the report gives 4 rows and a total of 575.50. Gemini moved the output under `OCADE output/`. | 78.6 | 13 |
| p2 | Script fails: a missing package and a quantity written as a word | waiting | **FAIL**: the read loop used up the allowance (defect 1) | — | 28 |
| p2b | same | waiting | **FAIL**: Gemini rewrote the script through shell quoting until the allowance ran out (defect 2) | — | 28 |
| p2c | same | completed | **PASS**: `pip install` ran; `fs.replace_text` kept the original; the list is B-220 and C-310 | 65.7 | 10 |
| p3 | A local app does not start because a stray process holds its port | completed | **PASS**: the page serves "ALL GREEN" and the stray process is gone. The run was slow (defect 3). | — | — |
| p4 | Mixed-format invoices to per-client totals in a workbook | completed | **PASS**: 1560.25, 580, 2200, with the void invoice excluded; `=SUM` recalculates to 4340.25 | 38.1 | 6 |
| p5 | Look up the newest Python on python.org and save a note | blocked | **FAIL**: the note was correct, but a goal check guessed page text (defect 4) | 77.0 | 11 |
| p5b | same | completed | **FAIL**: Gemini never opened the site and wrote 3.13.2 from memory. Its weak checks passed this (defect 5). | 23.4 | 4 |
| p5c | same | completed | **PASS**: 3.15.2, Oct. 25, 2026, as the release page says | 36.6 | 6 |
| q1 | Find in a log why the nightly backup failed | completed | **PASS**: "Disk quota exceeded" at 02:13:44 | 22.1 | 5 |
| q2 | `backup.sh` does not run: CRLF line endings and no execute bit | completed | **PASS**: it runs and the archive holds both notes | 47.5 | 8 |
| q3 | Remove duplicate contacts that differ only in case or spaces | completed | **PASS**: exactly 4 people | 26.8 | 5 |
| q5 | Convert YAML settings to JSON | completed | **PASS**: the JSON equals the YAML | 20.9 | 5 |
| q6 | A git merge conflict breaks a project; keep both changes | completed | **PASS**: no conflict markers, tests pass, and both the docstring and the tax parameter are kept. The merge was not committed, and the person did not ask for that. | 47.6 | 7 |

**Success counts:**

- 10 of 14 attempts PASS.
- 6 of 6 PASS on the final code (`3dbc2ad`: p5c, q1–q6).
- The final-code sample is too small to claim a ≥90% rate.
- No Gemini 429 occurred.

**Platform scope:** these runs were Linux only. Live runs on Windows and macOS are
BLOCKED, because staging credentials may not go into CI without the owner's approval.

## Generic defects found in these runs and fixed (each has a regression test)

1. The planner showed only the newest step in full. In a batch of reads, every other
   file was clipped, so Gemini re-read forever. The fix gives the newest steps a shared
   full-text budget and makes the stall guard catch repeated pairs and triples
   (`7ec7134`).
2. Gemini had no safe way to edit an existing file. The fix adds `fs.replace_text`: the
   person confirms it, it needs the sha256 of the version read, and it keeps the
   original (`339e445`).
3. `shell.run` waited until its timeout whenever a background child held its output.
   It now returns 2 s after the command ends, reports `outputHeldOpen`, and tells the
   model how to leave a program running (`563e5ab`).
4. Goal checks guessed text on pages the task only reads (`3dbc2ad`).
5. Requested facts came from model memory instead of the source. The planner now
   requires facts from this task's observations (`3dbc2ad`).

The live harness also had a fix: the companion no longer inherits the harness's server
keys (`7ec7134`).

## Cross-platform CI (GitHub-hosted, free, no secrets, no deployment)

The workflow is `.github/workflows/jarvis-cloud-validation.yml`. Runs 13–15 passed
every job:

- **Linux:** build, the source gates and the database authority tests passed. The 5
  end-to-end tests ran with real Postgres, real MCP workers and LibreOffice; CI had
  been skipping them before.
- **Linux, macOS and Windows:** the companion suites passed, including the shell
  containment tests on every OS.
- **Windows:** the UIA-001…012 ladder passed against an app compiled under a random
  name. The cases were: discovery, launch lease, inspect with boxes and an image,
  set value, invoke, typed keys to a field, forged lease, click after a resize,
  minimized, closed, ambiguous, and a pause while the person types.
- **Windows:** the unsigned installer built, and every frozen worker started.

A GitHub Windows runner is a cloud Windows Server desktop, not a customer PC. Windows
concepts stay PARTIAL.

## Ledger

`architecture-ledger.md` / `.json`: 46 PASS, 36 PARTIAL, 1 BLOCKED (macOS AX), 1 FAIL
(the release gate). This is **G12 no-go**.
