# START HERE — Claude Opus 5 OCADE takeover

Work from branch:

`import/ocade-primary-logic-20260826`

Do not start from an old `main` snapshot. First reconcile this branch with the current `origin/main` while preserving the import work.

Before using any historical import/audit conclusion, read:

`imports/ocade-primary-logic/CURRENT_SOURCE_REVIEW.md`

That file defines the evidence priority for the CURRENT RAR. `IMPORT_ANALYSIS.json` describes the previous ZIP and is historical only; do not use its old ZIP hash, defect counts, provenance classification or shipping conclusion as a current-RAR conclusion unless independently re-verified.

The complete engineering task is defined in:

`imports/ocade-primary-logic/CLAUDE_OPUS_5_MASTER_EXECUTION_PROMPT.md`

Read both files completely, produce a short execution map, and then execute autonomously. Do not stop after a plan-only audit and do not ask the user to edit source code manually.

## Current archive

`.incoming/OCADE_PRIMARY_LOGIC.rar`

Verified identity:

- SHA-256: `a1ce51f92447ada16a52631a2fdf61ec4d5ff24efa1e078beaa00b6b4741f467`
- Git blob SHA-1: `c3121695459979b5ca77ac14e267488675fba7e4`
- bytes: `10,140,038`
- expected extracted files: `2,123`
- expected extracted directories: `346`
- expected uncompressed bytes: `33,932,339`

The previous ZIP instructions are obsolete.

Extract the RAR into a temporary directory with a trusted RAR-capable tool, verify it, then stage it with:

`node scripts/import-ocade-primary-logic.mjs <extracted-directory> --replace`

Required staging outputs:

- `imports/ocade-primary-logic/source/`
- `imports/ocade-primary-logic/IMPORT_RECEIPT.json`
- `imports/ocade-primary-logic/SOURCE_INVENTORY.json`

Do not blindly overwrite production `src/`. First map the current RAR against current OCADE, then migrate the stronger authorized implementation into canonical OCADE locations, migrate callers, and remove superseded duplicates after verification.

Read any CURRENT licence/authorization actually supplied for the source. If it expressly permits the relevant reuse/modification/integration/commercial/redistribution rights, evaluate direct integration under those terms and preserve mandatory notices. If package metadata conflicts with an explicit current grant, flag and resolve that mismatch rather than treating old reports as controlling.

Keep coherent checkpoint commits. Do not merge to `main` or open the public launch gate until the master Definition of Done is satisfied.
