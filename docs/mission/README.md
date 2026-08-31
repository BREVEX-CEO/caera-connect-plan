# OCADE Mission File Placement

Place these files in the repository exactly as follows:

```text
PLAN.md
CLAUDE.md

docs/
  mission/
    OCADE_EXECUTION_STATE.md
    OCADE_PAYMENT_SUPPORT_REFUNDS_AND_ADMIN_GRANTS.md
    OCADE_CLAUDE_KICKOFF.md
```

## Source of truth
- `PLAN.md` = complete product mission and final acceptance requirements.
- `CLAUDE.md` = permanent behavior/engineering rules for Claude.
- `OCADE_EXECUTION_STATE.md` = durable progress and Auto Continue recovery state.
- `OCADE_PAYMENT_SUPPORT_REFUNDS_AND_ADMIN_GRANTS.md` = commercial support, refund, fraud-control, reconciliation, and safe manual-plan-grant rules.
- `OCADE_CLAUDE_KICKOFF.md` = short instruction to start/resume the mission.

## Important
Do not create a second master plan.

The launch-critical add-on and remaining-gap requirements are already inside the supplied `PLAN.md`, so duplicating them into another mission file would create two competing sources of truth.