# OCADE primary-logic archive staging

This folder is the isolated upload point for the next user-supplied OCADE primary-logic archive.

Expected archive name:

`OCADE_PRIMARY_LOGIC.rar`

Branch:

`import/ocade-primary-logic-20260826`

The previous RAR has been removed from HEAD. Keep this README so `.incoming/` remains browsable and does not become a 404 while the replacement archive is prepared.

Before re-uploading, the replacement archive should contain at its root:

- `LICENSE.md` — the current controlling licence/authorization for the source.
- `package.json` — its `license` field should point to that licence, for example `SEE LICENSE IN LICENSE.md`, instead of `UNLICENSED` if the rights holder has actually granted the stated rights.
- `NOTICE.md` — only where third-party/open-source notices are required.

The controlling licence must truthfully identify the rights holder/licensor and the licensed source, and explicitly state the rights actually granted for OCADE/CARCC CADANE. Historical audit notes are not a substitute for the current archive and current licence, but legally required attribution/provenance records must not be falsified or removed.

After the replacement archive is uploaded, verify its current hash and inventory before integration. Do not rely on the superseded archive hash recorded in earlier commits.

## The superseded archive, and where its provenance now lives

`OCADE_PRIMARY_LOGIC.rar` is no longer tracked in this product. `PLAN.md` §25
requires the raw archive to be removed from the final tracked product and from
releases **without rewriting history**, and that is exactly what has happened:
the file is gone from HEAD and untouched in the commits that carried it, which
is where a provenance record belongs.

What was removed is a ten-megabyte binary the product never reads. Nothing in
`src/` opens it, no test unpacks it, and the report generator works entirely
from the CSV ledger. What was NOT removed is everything the archive was for:

- `imports/ocade-primary-logic/OCADE_PRIMARY_LOGIC_DISPOSITION.jsonl` — one
  complete archive-hash-bound disposition for every one of the 2,126 files.
- `imports/ocade-primary-logic/INTEGRATION_MAP.csv` — the historical decision
  input retained as provenance.
- `imports/ocade-primary-logic/INTEGRATION_REPORT.md` — what was ported, and
  separately what production can actually reach, because a directory of
  imported code nothing imports is not integration.
- The licence and notice records the archive's terms require.

Identity of the archive as it stood when it was removed, so a future auditor
can confirm they are holding the same one:

- SHA-256: `fd831f6c817af1dbadcd6cbc67ec17cd11d0a8edb7e01343fa60766ff11b17cd`
- Size: 10,143,937 bytes
- File count: 2,126

The report generator reads the canonical JSONL ledger, not a raw archive. The
separate archive-refresh command requires an explicitly supplied disposable
extraction directory and never executes donor code.

`.incoming/*.rar` is ignored, so a replacement archive dropped here is not
committed by accident. Removing the file without that rule would leave the
requirement one `git add -A` away from coming undone.
