# One-step OCADE archive drop

This folder exists only to transfer the user-supplied OCADE primary-logic ZIP into the isolated import branch.

Upload **exactly one ZIP file** here. You can keep the current filename:

`OCADE_PRIMARY_LOGIC_RENAMED(1).zip`

Branch:

`import/ocade-primary-logic-20260826`

The archive is verified against its pinned SHA-256 before extraction. The controlled importer then:

1. detects the single ZIP in this folder,
2. verifies and hashes the archive,
3. extracts it with the repository importer,
4. preserves the donor tree under `imports/ocade-primary-logic/source/`,
5. generates `SOURCE_INVENTORY.json` and `IMPORT_RECEIPT.json`,
6. keeps reference-only legacy docs under provenance,
7. removes the transfer ZIP in the follow-up extraction commit,
8. commits and pushes the organized extracted tree back to the same import branch.

Do not place the archive on `main` and do not unzip it manually into production `src/`.

Extraction trigger refreshed after the uploaded archive was verified on 26 August 2026.
