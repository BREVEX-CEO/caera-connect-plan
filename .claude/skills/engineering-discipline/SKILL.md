---
name: engineering-discipline
description: Implement, debug or review OCADE changes with root-cause analysis, focused checks and independent verification.
---

1. Define the outcome and a check that would distinguish success from failure.
2. Trace the existing owner, entry points, tests and trust boundaries. Reproduce a bug or establish failing acceptance evidence for new behavior.
3. Fix the shared cause with the smallest complete change. Preserve existing contracts, permissions, and unrelated edits.
4. Run focused and neighboring checks. Verify the actual effect and include failure paths, retries and stale inputs where relevant.
5. Review correctness, security, UX and performance. Have the Opus verifier challenge the evidence independently.
6. Record evidence and gaps in PROGRESS.md for plan work. Commit and push each coherent locally verified requirement or small related group immediately when authorized. Follow the final exact-candidate GitHub gate in `CLAUDE.md`.
7. Immediately implement the next independent requirement after every commit and push. Repeat without waiting for earlier CI, regardless of CI status. Fix confirmed failures and continue. No blocking CI watchers, placeholder tasks or intermediate reports while actionable requirements remain. Record individual blockers only in PROGRESS.md, continue unrelated coding and reconciliation, and follow the mandatory output rule in CLAUDE.md: no routine chat in final-report-only mode; otherwise only one verified percentage during coding; no intermediate formal reports or blocker summaries. Preserve local safety checks, owner STOP and final exact-SHA verification.
