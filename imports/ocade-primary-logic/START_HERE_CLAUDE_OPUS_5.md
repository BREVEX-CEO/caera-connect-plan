# START HERE — Claude Opus 5 OCADE takeover

Work from branch `import/ocade-primary-logic-20260826`.

The complete outcome-driven task is defined in:

`imports/ocade-primary-logic/CLAUDE_OPUS_5_MASTER_EXECUTION_PROMPT.md`

Read that file completely and execute it autonomously. Do not return a plan-only audit and do not ask the user to edit source code.

## Mandatory extraction gate

The donor ZIP is already committed under `.incoming/`. Before integrating production logic, verify and extract it using the existing importer.

Required SHA-256:
`4b9590a17222ba460c26905daba7273076d0bb42163f5a8e6d9cda9076de2e49`

Expected extracted file count:
`2124`

Importer:
`scripts/import-ocade-primary-logic.mjs`

Required verified outputs:

- `imports/ocade-primary-logic/source/src/`
- `imports/ocade-primary-logic/IMPORT_RECEIPT.json`
- `imports/ocade-primary-logic/SOURCE_INVENTORY.json`

Production `src/` must not be bulk-overwritten by extraction. The extracted donor is staged first, then selectively adapted/replaced into the canonical OCADE architecture as required by the master prompt.

GitHub-hosted Actions have previously failed before a runner was assigned, so perform extraction in the Claude coding environment if necessary rather than waiting for Actions.

## Execution rule

Once the extraction gate passes, continue directly through donor integration, duplicate/legacy replacement, routing, Cowork/browser-control repair, error fixing, UI redesign, performance work and final production verification as defined in the master prompt.

Do not stop for approval between phases unless a genuine external credential/account action blocks further work.

Keep coherent checkpoint commits and do not merge to `main` or open the launch gate until the master Definition of Done is satisfied.
