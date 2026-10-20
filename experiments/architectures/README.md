# Five-way JARVIS control-architecture benchmark

Isolated experiment for TOFIX H5/H5E/H7. Not product code: nothing in `src/` or the
Device Agent imports it.

Every design drives the product's real device executor (`jarvis-runtime` `Computer` and the
Playwright browser session) on the same tasks and is judged by the same independent oracles
(python-docx, LibreOffice recalculation and PDF render, Pillow PNG decode, the form site's own
server record). Planner outputs are frozen fixtures with identical content for every design, so
the comparison isolates architecture: where planner calls happen, how actions are batched per
device exchange, how a changing page is waited for, and how an interrupted run recovers.

Measured: local execution and check time, actions, exchanges, planner calls and the characters
each would send, oracle verdicts, duplicates, preserved user edits, STOP quiescence.
Modeled, never measured: planner latency (3.1 s, the median recorded provider header time) and
device exchange latency (1.0 s). No authorised model key exists in the sandbox, so model quality
per representation is not measured.

```
xvfb-run -a python3 experiments/architectures/bench.py --runs 5 --tasks doc,form,photo
xvfb-run -a python3 experiments/architectures/bench.py --runs 3 --tasks sheet
```

Tasks: `doc` (300-word formatted essay, DOCX + PDF), `sheet` (live apple.com and samsung.com
research into a workbook with formulas, chart, sources, recommendation and PDF), `form`
(multi-tab dynamic form with upload, confirmation and receipt download, on a local fixture),
`photo` (rocket artwork in the free no-login miniPaint editor, exported PNG). Faults: `crash`
(after a random committed effect, before its result arrives), `user_edit` (the person edits the
document mid-task), `planner_503` (one planner outage), `stop` (STOP at a random moment).

Results and the decision: [the benchmark record](../../docs/audit-checkpoints/architecture-benchmark/README.md).
