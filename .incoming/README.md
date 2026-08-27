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
