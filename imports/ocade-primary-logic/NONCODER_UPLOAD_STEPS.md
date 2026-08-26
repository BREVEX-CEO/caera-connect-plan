# OCADE Primary Logic ZIP — No-Code Upload Steps

This is the only manual transfer step required because the ChatGPT GitHub connector can edit repository text but cannot attach a 10+ MB local binary ZIP directly to GitHub.

Everything after the ZIP is committed is automated by `.github/workflows/import-ocade-primary-logic.yml`.

## Do this in GitHub

1. Open the repository `BREVEX-CEO/caera-connect-plan`.
2. Switch the branch from `main` to `import/ocade-primary-logic-20260826`.
3. Open the folder `.incoming`.
4. Click **Add file** → **Upload files**.
5. Drag in the exact file `OCADE_PRIMARY_LOGIC_RENAMED(1).zip`.
6. At the bottom, commit directly to the current `import/ocade-primary-logic-20260826` branch.
7. Do not unzip the file yourself and do not upload it to `main`.
8. Open the repository **Actions** tab and select **Import OCADE primary logic archive**.
9. Wait for the run to finish green.
10. Refresh `imports/ocade-primary-logic/` on the import branch.

## What GitHub will do automatically

The workflow will:

- locate the one ZIP in `.incoming/`;
- calculate its SHA-256;
- reject an ambiguous/multiple-archive state;
- safely extract only paths under `OCADE_PRIMARY_LOGIC/`;
- reject absolute paths and `../` traversal;
- preserve the donor code under `imports/ocade-primary-logic/source/`;
- move stale legacy reference docs into `imports/ocade-primary-logic/provenance/legacy-docs/`;
- classify every extracted file;
- generate `SOURCE_INVENTORY.json` with path, bytes, SHA-256, category and integration disposition;
- generate `IMPORT_RECEIPT.json` with archive hash and import counts;
- remove the transfer ZIP from Git after extraction so the repository does not permanently carry both the archive and extracted duplicate;
- commit the extracted source back to the same import branch.

## Expected result

After the workflow succeeds, this folder must exist:

`imports/ocade-primary-logic/source/`

and contain more than 2,000 extracted files. The branch must also contain:

- `imports/ocade-primary-logic/IMPORT_RECEIPT.json`
- `imports/ocade-primary-logic/SOURCE_INVENTORY.json`

Do not merge this donor source into `main` just because extraction succeeded. It is a staging/reference tree. Claude should selectively port approved logic into OCADE-native modules and remove duplicates rather than registering the donor runtime wholesale.
