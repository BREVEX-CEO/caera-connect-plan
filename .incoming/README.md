# OCADE primary-logic archive staging

This folder is the isolated transfer point for the current user-supplied OCADE primary-logic archive.

Expected archive:

`OCADE_PRIMARY_LOGIC(1).rar`

Expected SHA-256:

`a1ce51f92447ada16a52631a2fdf61ec4d5ff24efa1e078beaa00b6b4741f467`

Archive inventory observed before upload:

- 2,123 files
- 346 directories
- 33,932,339 uncompressed bytes

Branch:

`import/ocade-primary-logic-20260826`

The previous ZIP has been removed. Do not place the archive on `main` and do not extract it over production `src/`.

Claude Code should extract this RAR in its coding environment, verify the hash and inventory, classify the source, repair unresolved imports/dependencies as appropriate, and integrate only through the existing OCADE architecture after tracing current authorities and routes. The extracted staging tree should remain under `imports/ocade-primary-logic/source/` until integration decisions are verified.
