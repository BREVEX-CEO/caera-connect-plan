---
name: plan-runner
description: Execute or reconcile explicitly authorized OCADE work using plan.md, verified evidence and required GitHub gates.
---

Use `CLAUDE.md` for scope, approvals and finalization. Use the current `plan.md` as the requirements and execution authority. Read relevant `PROGRESS.md` task IDs and batch evidence before resuming. Record all live progress, test/CI evidence, defects, blockers and final reports in `PROGRESS.md`, linking independent evidence as needed; do not duplicate progress in `plan.md`.

- Start or resume only on explicit owner direction. Find the first authorized, dependency-ready item in plan order. Locate current headings and read only relevant ranges.
- Split broad items into traceable requirements. Mark a requirement complete only after independent verification of it and all descendants. Record proof and continue independent work within the authorized scope.
- Commit and push each completed coherent requirement or small related group immediately after applicable local checks pass, within owner authorization. After each push, immediately implement the next independent requirement. Repeat without waiting for earlier CI. Inspect available results without blocking; fix confirmed failures and keep going. No blocking CI watch, sleep, placeholder or intermediate report while actionable requirements remain. Record evidence in PROGRESS.md.
- Record external blockers with evidence exclusively in PROGRESS.md and keep those items incomplete; immediately continue other independent tasks, including every unreconciled checklist section. No intermediate blocker reports, audit summaries, formal reports or milestone recaps in chat. Follow the mandatory output rule in CLAUDE.md; keep all interim evidence in PROGRESS.md. Only wait for final verification after reconciling every remaining in-scope item and exhausting independent coding, testing and audit work. Communicate indispensable safety or permission requests minimally. Respect owner WAIT, STOP, PAUSE or HOLD immediately.
- Before completion, reconcile the entire tracked repository against current plan requirements and linked authorities. Reopen gaps, repair and retest. Have Opus independently verify the evidence and all applicable exact-candidate GitHub checks.
