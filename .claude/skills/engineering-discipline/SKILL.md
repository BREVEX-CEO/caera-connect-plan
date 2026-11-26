---
name: engineering-discipline
description: Implement, debug or review OCADE changes with root-cause analysis, focused checks and independent verification.
---

1. Define the outcome and a check that would distinguish success from failure.
2. Trace the existing owner, entry points, tests and trust boundaries. Reproduce a bug or establish failing acceptance evidence for new behavior.
3. Fix the shared cause with the smallest complete change. Preserve existing contracts, permissions, and unrelated edits.
4. Run focused and neighboring checks. Verify the actual effect and include failure paths, retries and stale inputs where relevant.
5. Review correctness, security, UX and performance. Have the Opus verifier challenge the evidence independently.
6. Record evidence and gaps in PROGRESS.md for plan work. Batch coherent locally verified changes into authorized provisional commits; follow the exact-candidate GitHub gate in `CLAUDE.md`.
7. Immediately move to the next independent task and repeat. Continue coding locally while CI runs; do not stop for a commit, milestone, pending CI or nonblocking question. Fix available failures and batch pushes without weakening verification. Respect owner STOP and genuine external blockers; run full final verification on the identical final SHA.
