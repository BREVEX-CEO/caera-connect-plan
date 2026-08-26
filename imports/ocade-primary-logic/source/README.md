# OCADE donor source staging directory

**Status: PENDING VERIFIED EXTRACTION**

This directory intentionally exists so the staging location is visible before the donor archive is materialized.

The uploaded archive is currently stored on branch `import/ocade-primary-logic-20260826` under `.incoming/`.

Do not treat this README as proof that the donor source has been extracted. The source is considered present only when all of the following exist and verify:

- `imports/ocade-primary-logic/source/src/`
- `imports/ocade-primary-logic/SOURCE_INVENTORY.json`
- `imports/ocade-primary-logic/IMPORT_RECEIPT.json`
- receipt `extractedFileCount` equals **2124**
- receipt `archiveSha256` equals `4b9590a17222ba460c26905daba7273076d0bb42163f5a8e6d9cda9076de2e49`

GitHub-hosted Actions jobs for this repository are currently failing before runner assignment, so extraction must be performed by the coding environment that takes over this branch. `START_HERE_CLAUDE_OPUS_5.md` contains the mandatory Phase 0 procedure.
