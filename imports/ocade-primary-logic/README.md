# OCADE primary logic — import record

## What is authoritative

`OCADE_PRIMARY_LOGIC_DISPOSITION.jsonl` is the canonical, archive-hash-bound
record. It has one complete record for every physical archive file, including
the file hash, dependency evidence, broken imports, reachability, OCADE
counterpart, canonical destination, tests, final disposition and exact reason.

`INTEGRATION_REPORT.md` and `INTEGRATION_REPORT.json` are generated views of
that ledger plus the current production-reachability graph. Run
`npm run integration:report` to regenerate them. `npm run integration:check`
validates the complete ledger and fails when either report is stale.

`INTEGRATION_MAP.csv` is the historical decision input from which the richer
JSONL authority was generated. It remains useful provenance but is no longer
the report generator's source of truth.

The raw archive is intentionally absent from the product. To reproduce its
immutable facts, reconstruct the verified historical blob only into disposable
external storage, verify SHA-256
`FD831F6C817AF1DBADCD6CBC67EC17CD11D0A8EDB7E01343FA60766FF11B17CD`,
and run:

`npm run integration:refresh-archive -- --archive <OCADE_PRIMARY_LOGIC.rar> --archive-root <extracted/OCADE_PRIMARY_LOGIC>`

The refresh reads source bytes; it never imports or executes donor code.

The archive's own licence and notice live at `src/primary-logic/LICENSE.md` and
`src/primary-logic/NOTICE.md`, alongside `provenance.json`, which records the
verified hash, byte count and inventory of the artifact that was actually
integrated.

## What was removed, and why

`IMPORT_ANALYSIS.json`, `IMPORT_MANIFEST.json`, `IMPORT_VALIDATION.json`, the
old `CURRENT_SOURCE_REVIEW.md`, and the pending-extraction `source/README.md`
described earlier ZIP/RAR snapshots with different hashes and counts. They sat
beside the final evidence while calling those older artifacts current. A stale
provenance record is worse than none: it is the one a reader trusts. Their
history remains available in Git without presenting them as current authority.

The handoff and upload-instruction documents described work that has since been
done. They are in git history, which is where a completed instruction belongs.

## The execution specifications

`CLAUDE_OPUS_5_MASTER_EXECUTION_PROMPT.md` and `CLAUDE_OPUS_5_UI_PRODUCT_PROMPT.md`
are kept as the record of what was asked for, so a later reader can check the
result against the brief rather than against a summary of it.
