# OCADE primary-logic archive staging

This folder is the isolated transfer point for the current user-supplied OCADE primary-logic archive.

Expected archive:

`OCADE_PRIMARY_LOGIC.rar`

Verified archive identity:

- SHA-256: `a1ce51f92447ada16a52631a2fdf61ec4d5ff24efa1e078beaa00b6b4741f467`
- Git blob SHA-1: `c3121695459979b5ca77ac14e267488675fba7e4`
- Size: `10,140,038` bytes
- Expected extracted files from the user-supplied archive: `2,123`
- Expected extracted directories: `346`
- Expected uncompressed bytes: `33,932,339`

Branch:

`import/ocade-primary-logic-20260826`

The previous ZIP has been removed. Do not place the archive on `main` and do not extract it over production `src/`.

Claude Code must first reconcile this branch with the current `main`, then extract the RAR into a temporary directory in its coding environment, verify the SHA-256/inventory, stage the extracted tree under `imports/ocade-primary-logic/source/`, classify it, repair unresolved imports/dependencies as appropriate, and integrate only through the existing OCADE architecture after tracing current authorities and routes.

The archive is a source input, not proof that every contained module is production-safe or legally reusable. Preserve legally required copyright, licence, attribution and provenance notices. Do not use string renaming as a substitute for provenance or licensing review. If a particular module cannot be reused under the applicable rights, reproduce the required behavior with an independently implemented OCADE-native module instead.
