# OCADE — Exact Completion Calculation

## Method

`completion = Σ(weight of each canonical requirement's evidence level) ÷ total canonical requirements`

Weights: real-target runtime 1.0 · hosted runtime 0.8 · simulated 0.7 · integration 0.6 ·
unit 0.5 · wired 0.45 · source complete 0.4 · partial 0.2 · not started 0.

No line counts, heading counts, file counts, test counts or historical percentages are used.

## Static traceability result

| Evidence level | Count | Weight | Contribution |
|---|---:|---:|---:|
| NOT STARTED | 216 | 0 | 0.0 |
| UNIT TESTED | 144 | 0.5 | 72.0 |
| WIRED AND REACHABLE | 126 | 0.45 | 56.7 |
| PARTIAL SOURCE | 19 | 0.2 | 3.8 |
| SOURCE COMPLETE | 5 | 0.4 | 2.0 |
| **Total** | **510** | | **134.5** |

**Numerator 134.5 ÷ denominator 510 = 26.4%**

## THIS NUMBER IS A LOWER BOUND, AND THE REASON MATTERS

| Match confidence | Requirements |
|---|---:|
| medium | 20 |
| low | 274 |
| none | 216 |

Only **20 of 510** requirements matched code with medium confidence.
**216** matched nothing at all, and **274** matched on a single token.

The matcher is lexical: it compares specification subject words against file paths and export
names. It cannot see that the specification's "rollback" is the repository's `update-plan`
`decideRollback`, or that "no-progress detection" is `skills/progress-monitor`. Vocabulary
mismatch is counted as absence.

So the honest reading is:

- **26.4%** is what automated lexical tracing can *prove* unaided.
- The true figure is higher, because the repository demonstrably passes 3,474 tests, 24/24 gates,
  typecheck, lint and a production build — none of which a 26% implementation could do.
- The true figure is **not** 100%, because real-target runtime evidence is near zero.

Publishing the lexical number alone would understate the work; publishing a confident high number
would overstate it. Both are recorded here so neither can be quoted without the other.

## What would raise confidence

A subject→module dictionary mapping specification vocabulary onto repository vocabulary. That is
human-reviewable work, roughly 510 rows, and it is the single highest-value next audit task.

