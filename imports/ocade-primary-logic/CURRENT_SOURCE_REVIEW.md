# OCADE current source review authority

This file governs review of the current primary-logic archive on `import/ocade-primary-logic-20260826`.

## Current artifact

`.incoming/OCADE_PRIMARY_LOGIC.rar`

Verified staging identity:

- SHA-256: `a1ce51f92447ada16a52631a2fdf61ec4d5ff24efa1e078beaa00b6b4741f467`
- Git blob SHA-1: `c3121695459979b5ca77ac14e267488675fba7e4`
- bytes: `10,140,038`
- expected extracted files: `2,123`
- expected extracted directories: `346`
- expected uncompressed bytes: `33,932,339`

## Evidence priority

For the current integration run, conclusions must be based on, in order:

1. the current RAR above;
2. any current licence/authorization document actually supplied for that source;
3. the current repository and live code paths;
4. newly executed build/test/runtime evidence.

Historical import reports, previous ZIP hashes, previous filenames, old classifications, old prompt notes and old audit conclusions are not evidence about the current RAR unless they are independently re-verified against the current artifact.

`IMPORT_ANALYSIS.json` is a historical record for the previous `OCADE_PRIMARY_LOGIC_RENAMED(1).zip` (SHA-256 `4b9590a1...`) and MUST NOT be treated as the current RAR's licence, provenance, defect or compatibility determination.

## Licence / authorization handling

Do not infer rights from renamed strings or from package metadata alone. Read the actual current licence/authorization document if one is supplied. If that document expressly grants the relevant modification, derivative-work, integration, commercial-use and redistribution rights, evaluate direct reuse under those granted terms while preserving any mandatory notices. If no such grant is actually available, do not invent one.

Package metadata such as `"license": "UNLICENSED"` may conflict with a separately supplied explicit licence grant; when that happens, flag the metadata mismatch and determine which document legally governs before changing metadata or shipping code. Do not use old audit language as a substitute for that review.

## Engineering rule

The integration goal is one canonical OCADE architecture. Extract and map the current source, compare each subsystem with current OCADE, keep the stronger implementation, migrate callers, remove weak duplicates after migration, and keep browser/native/server boundaries correct. Current executable evidence outranks historical commentary.
