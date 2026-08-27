# OCADE primary logic — import record

## What is authoritative

`INTEGRATION_REPORT.md` and `INTEGRATION_REPORT.json`, regenerated from the
current tree by `npm run integration:report`. `npm run integration:check` fails
the build when they are stale, so they cannot quietly become a claim about a
tree that has moved on.

`INTEGRATION_MAP.csv` is the disposition assigned to each of the archive's 2,126
files. The report reads it and reports where the tree agrees with it.

The archive's own licence and notice live at `src/primary-logic/LICENSE.md` and
`src/primary-logic/NOTICE.md`, alongside `provenance.json`, which records the
verified hash, byte count and inventory of the artifact that was actually
integrated.

## What was removed, and why

`IMPORT_ANALYSIS.json`, `IMPORT_MANIFEST.json` and `IMPORT_VALIDATION.json`
described `OCADE_PRIMARY_LOGIC_RENAMED(1).zip` — a different artifact, with a
different hash and 2,124 files. `CURRENT_SOURCE_REVIEW.md` said in as many words
that they must not be treated as the current source's provenance, and they sat
in the same directory as the thing they were not about. A stale provenance
record is worse than none: it is the one a reader trusts.

The handoff and upload-instruction documents described work that has since been
done. They are in git history, which is where a completed instruction belongs.

## The execution specifications

`CLAUDE_OPUS_5_MASTER_EXECUTION_PROMPT.md` and `CLAUDE_OPUS_5_UI_PRODUCT_PROMPT.md`
are kept as the record of what was asked for, so a later reader can check the
result against the brief rather than against a summary of it.
