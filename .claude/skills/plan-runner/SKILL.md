---
name: plan-runner
description: Start, resume, pause or reconcile OCADE plan execution using TASKS.md, verified evidence and the required GitHub gates.
---

Use `CLAUDE.md` for scope, approvals, status and finalization. Use the current `plan.md` for requirements and `TASKS.md` for progress.

- For start or resume, set the ledger to RUNNING. Find the first authorized, dependency-ready item in plan order. Locate current plan headings and read only the relevant ranges.
- Split broad items into traceable requirements. Mark a task complete only after independent verification of the task and all descendants. Record proof and continue without pausing for a recap.
- Record external blockers with evidence and keep those items incomplete. Continue independent work. Set PAUSED when the owner asks to pause.
- Before completion, reconcile the entire tracked repository against current plan requirements and linked authorities. Reopen gaps, repair and retest. Have Opus independently verify the evidence and all applicable exact-candidate GitHub checks.
