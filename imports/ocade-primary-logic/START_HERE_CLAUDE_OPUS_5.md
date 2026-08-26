# START HERE — Claude Opus 5 OCADE takeover

Work from branch:

`import/ocade-primary-logic-20260826`

Do not start from an old `main` snapshot. First reconcile this branch with the current `origin/main` while preserving the import work.

The complete task is defined in:

`imports/ocade-primary-logic/CLAUDE_OPUS_5_MASTER_EXECUTION_PROMPT.md`

Read that file completely, produce a short execution map, and then execute it autonomously. Do not stop after a plan-only audit and do not ask the user to edit source code manually.

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

Never extract the archive directly over production `src/`.

Preserve required licence/copyright/attribution/provenance notices. If a module is not reusable under the applicable rights, implement the required behavior independently in OCADE-native code and continue the run.

Keep coherent checkpoint commits. Do not merge to `main` or open the public launch gate until the master Definition of Done is satisfied.
