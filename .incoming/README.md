# One-step OCADE archive drop

This folder exists only to transfer the user-supplied archive into the isolated import branch.

Upload the ZIP here with this **exact repository filename**:

`OCADE_PRIMARY_LOGIC_RENAMED.zip`

Branch:

`import/ocade-primary-logic-20260826`

When that file is committed, `.github/workflows/import-ocade-primary-logic.yml` automatically:

1. verifies the archive exists,
2. extracts it with the repository importer,
3. preserves the donor tree under `imports/ocade-primary-logic/source/`,
4. generates `SOURCE_INVENTORY.json` and `IMPORT_RECEIPT.json`,
5. keeps stale reference-only docs under provenance,
6. removes the transfer ZIP from Git history in the follow-up extraction commit,
7. commits and pushes the organized extracted tree back to the same import branch.

Do not place the archive on `main` and do not unzip it manually into production `src/`.
