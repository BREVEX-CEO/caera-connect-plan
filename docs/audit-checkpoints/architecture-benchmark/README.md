# JARVIS control architecture — five-way benchmark and decision (20 October 2026)

Owner request: prototype TOFIX H5 alternatives A–D and an independent fifth design E, compare
them on identical tasks, select the fastest design that clears correctness, safety and
reliability gates, and integrate it. Harness: [experiments/architectures](../../../experiments/architectures/README.md).
Raw per-run records: [20261020/](20261020/).

## What this evidence is, and is not

- **Environment:** Anthropic-managed Linux cloud session (x86_64, Python 3.13.16, Chromium 1194
  under Xvfb, LibreOffice headless), live internet through the session proxy. Code under test:
  `e1401f5` plus the uncommitted harness (`bench.py` SHA-256 `1c5280ac…a726` before its start-time
  commit fix). The records' `commit` field says `0bab7c5` because it was read at the end of the
  run; later commits did not change the code those processes had already imported.
- **Measured:** local execution and postcondition-check time, actions, device exchanges, planner
  calls, planner prompt/output characters, independent oracle verdicts, duplicates, preserved
  user edits, STOP quiescence.
- **Modeled, not measured:** planner latency, 3.1 s per call (median of the recorded 200-status
  provider header times, TOFIX H1 EV-EXCEL-1 — a floor, not a full completion) and device
  exchange latency, 1.0 s (the Agent's active cadence). `modeled_s = calls × 3.1 + exchanges ×
1.0 + measured local seconds`. Human approval wait is excluded and counted separately.
- **Not measured:** model quality per representation. No authorised model key exists in this
  sandbox, so planner outputs are frozen fixtures with the same content for every design. A real
  model that must write a long program for an interface it has not seen will need exception
  calls this benchmark does not charge (see Limits).
- **Not qualified:** native Windows/macOS Office, mobile, the owner's PC. LibreOffice and Linux
  do not stand in for licensed Word/Excel. D's learned local policy does not exist here: its
  hot loop is a deterministic stand-in, so D's numbers measure its hierarchy, not local inference.

## Tasks, oracles and faults

| Task  | What the design must produce                                                                                                                                                                             | Independent oracle                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| doc   | 313-word essay with Title, Heading 1 sections and a bold phrase as DOCX, then PDF                                                                                                                        | python-docx body words (≥300, headings excluded), styles, bold run, no duplicated paragraphs; PDF page count                                                             |
| sheet | Live reads of apple.com and samsung.com (iPhone 18 Pro vs Galaxy S26 Ultra, US, 20 Oct 2026) into a workbook: specs, difference formulas, premium %, price chart, Sources and Recommendation sheets, PDF | LibreOffice recalculates a copy; every formula value equals an independent computation; chart XML plots the price row; every figure appears in text read during that run |
| form  | Local multi-tab site: open the form a link opens in a new tab, fill a field that appears 600 ms after a choice, upload a work-folder file, confirm "Send order", download the receipt                    | The site's own server record: exactly one submission with the right total, plan and attachment; receipt file content                                                     |
| photo | Rocket artwork in the free no-login miniPaint editor (live), exported PNG                                                                                                                                | Pillow decodes the downloaded PNG: 800×600, each of seven declared colours at its shape's centre                                                                         |

Faults, same injection point per seed for every design: `crash` (after a random committed
effect, before its result arrives), `user_edit` (the person adds a paragraph mid-task),
`planner_503` (one planner outage), `stop` (STOP at a random moment).

## Results — 539 runs, 0 harness errors

n = 5 per cell for doc/form/photo, 3 for sheet. Calls and exchanges are medians; time is p50.

| Clean run                     | per-step baseline | sequence baseline | A program | B controller | C skill  | D actors* | E desired state |
| ----------------------------- | ----------------- | ----------------- | --------- | ------------ | -------- | --------- | --------------- |
| doc: calls / modeled s        | 6 / 23.7          | 3 / 11.4          | 1 / 5.2   | 1 / 8.2      | 1 / 5.2  | 2 / 8.3   | 1 / 5.2         |
| sheet: calls / modeled s      | 21 / 93.8         | 4 / 23.1          | 2 / 17.5  | 2 / 24.3     | 2 / 20.3 | 2 / 18.2  | 2 / 18.7        |
| form: calls / modeled s       | 14 / 60.7         | 13 / 56.6         | 4 / 21.7  | 2 / 18.2     | 3 / 18.6 | 2 / 12.2  | 2 / 13.3        |
| photo: calls / modeled s      | 54 / 225.0        | 54 / 225.0        | 2 / 13.9  | 2 / 63.8     | 2 / 13.9 | 2 / 13.9  | 2 / 15.8        |
| photo prompt characters       | 7.39 M            | 7.39 M            | 70 k      | 70 k         | 70 k     | 70 k      | 70 k            |
| oracle pass (all clean cells) | 18/18             | 18/18             | 18/18     | 18/18        | 18/18    | 18/18     | 18/18           |

Measured local work is nearly identical across designs (doc ≈1.07 s, of which PDF render
≈0.85 s; form 2.0–3.3 s; photo ≈5.6 s; sheet 8.7–12.1 s with four live page loads). The
differences are where the planner is asked and how many round trips the work needs.

| Faults                                      | baseline (both) | A              | B              | C              | D*             | E                     |
| ------------------------------------------- | --------------- | -------------- | -------------- | -------------- | -------------- | --------------------- |
| crash (doc, form, photo, sheet)             | 36/36           | 18/18          | 18/18          | 18/18          | 18/18          | **16/18** — photo 3/5 |
| user edit kept (doc)                        | 10/10           | 5/5            | 5/5            | 5/5            | 5/5            | 5/5                   |
| planner 503 once                            | 36/36           | 18/18          | 18/18          | 18/18          | 18/18          | 18/18                 |
| STOP: no effect after STOP / max quiescence | 36/36 / 224 ms  | 18/18 / 225 ms | 18/18 / 268 ms | 18/18 / 220 ms | 18/18 / 224 ms | 18/18 / 221 ms        |
| duplicated outputs                          | 0               | 0              | 0              | 0              | 0              | 0                     |

\*D's local policy is a deterministic stand-in (no licensed local multimodal model available).

What the faults showed:

- **Asynchronous confirmation.** An earlier harness version read "was the order sent?" the
  instant the click returned; A/B/C/D then resubmitted (2–3 orders). Reading only after the page
  settles (bounded 2 s) removed every duplicate for every design. That rule is a property of the
  postcondition, not of any architecture.
- **Hidden interface state.** E resumes by diffing visible facts. After a crash inside a dialog,
  the facts it can see (pixels, field values) do not reveal which tool or dialog is open, and 2/5
  photo recoveries drew wrong. A/C/D resume at the exact journaled step and recovered 5/5.
- **Readiness.** A without device-side waiting needed exception calls on the dynamic form (4 calls
  vs 2). Waiting for the element on the device (B, D, E) is what made the form two calls.
- **Exchanges per goal.** B's one-goal-per-exchange control cost 52 exchanges on photo (63.8 s
  modeled) for the same planner calls as A.

## Decision

**Selected: A — a bounded compiled program, journaled — executed with B's device-side readiness
and E's outcome contract.** It is the fastest design on every task that also passed every fault
cell (with D's stand-in, which is the same mechanism without a real local policy). E is not
selected as the control mechanism: it tied on speed but lost crash recovery on stateful
interfaces. B is not selected: same planner calls, many more exchanges. C's warm replay ties A
but needs a qualification lifecycle and per-version maintenance; it remains a later cache, not
the core. D is BLOCKED for its distinguishing part (local learned policy) and is not selected.

Integrated incrementally into the existing single planner and broker — no new executor, agent
framework or app-specific branch:

| Mechanism                                                                                                                 | Commit    | Effect measured here                                         |
| ------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| Element steps name elements by `target {name, role}`, resolved on the device, waiting ≤5 s, never guessing between two    | `e1401f5` | form: 14 → 2 calls; a form, dialog or editor is one sequence |
| Page settles after open; new tabs followed; covered controls flagged; toolbars and canvases named; element-relative drags | `8180f4d` | miniPaint 1 → 52 controls; rocket PNG produced and verified  |
| Outcome contract: word counts fixed from the person's own request, body counted from the saved file                       | `43a1983` | a 30-word essay can no longer complete a 300-word request    |
| One output per intent; dated file names are not figures; app names by words                                               | `43a1983` | HX-02/03/08 regressions pass                                 |
| Non-progress stop                                                                                                         | `0bab7c5` | four page actions that change nothing require a fresh look   |

The product's existing bounds stay: sequences hold at most 12 steps, so photo is about 6 planner calls
in the product, not the benchmark's 2; raising that bound is a measured opportunity (≈12 s
modeled) that needs device segment and safety review before it is changed. Unknown outcomes are
still read back before anything is redone (server rule), which is the journaled-postcondition
recovery A used here.

## Limits and what would change the decision

- Frozen planner outputs hide planning errors. The photo program needed knowledge (this editor
  applies a colour to the _next_ shape) that was found only by observing failed attempts; a real
  model will pay exception calls for that. Rerun with the staged Gemini route when a test account
  and a no-cost quota are authorised.
- Modeled latencies are constants; real provider and exchange distributions change totals, not
  the ranking by call count, unless per-call latency grows with output length enough to offset
  call counts.
- Four task families, small n. This is a pilot under H7.1 step 2, not the ≥100-run held-out
  qualification; no population success rate is claimed.
