# Architecture ledger, 23 November 2026

Regenerated with `node scripts/jarvis-traceability.mjs --write evidence/2026-11-23-traceability`
after a code re-check of concepts 18, 21, 45, 50 and 67 on branch `ocade/p00-p22-implementation`.

- 18 and 21 moved to PASS: durable milestones (`milestones.test.sql`) and fresh observation after a
  take-over (`observedSinceTakeOver`, `contracts.test.ts`).
- 50 moved to PASS: one open task per device and lane resource locks (`parallel-lanes.test.sql`).
- 45 and 67 stay PARTIAL with new evidence: unhealthy MCP servers are withdrawn
  (`test_catalog.py`); grants can expire (`permission-expiry.test.sql`).

`tests/security/traceability.test.ts` compares a fresh regeneration with this ledger, so a later
edit cannot silently restore or add a PASS. The 5 November ledger in `2026-11-05-local-stop/` is
kept as historical evidence.
