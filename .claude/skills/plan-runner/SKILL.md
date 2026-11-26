---
name: plan-runner
description: Execute or reconcile explicitly authorized OCADE work using plan.md, verified evidence and required GitHub gates.
---

Use `CLAUDE.md` for scope, approvals and finalization. Use the current `plan.md` as the requirements and execution authority. Read relevant `PROGRESS.md` task IDs and batch evidence before resuming. Record all live progress, test/CI evidence, defects, blockers and final reports in `PROGRESS.md`, linking independent evidence as needed; do not duplicate progress in `plan.md`.

- Start or resume only on explicit owner direction. Find the first authorized, dependency-ready item in plan order. Locate current headings and read only relevant ranges.
- Split broad items into traceable requirements. Mark a requirement complete only after independent verification of it and all descendants. Record proof and continue independent work within the authorized scope.
- After each locally verified authorized commit or push, immediately select the next independent task. Keep coding locally while CI runs; batch pushes, inspect available results, fix failures and repeat. Never stop at a milestone or issue an intermediate completion report while independent authorized work remains. Store progress in PROGRESS.md and put brief status alongside the next tool call.
- Record external blockers with evidence and keep those items incomplete; continue other independent tasks. Respect owner WAIT, STOP, PAUSE or HOLD immediately. Only wait for final verification when independent work is exhausted.
- Before completion, reconcile the entire tracked repository against current plan requirements and linked authorities. Reopen gaps, repair and retest. Have Opus independently verify the evidence and all applicable exact-candidate GitHub checks.
