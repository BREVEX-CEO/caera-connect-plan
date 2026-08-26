# OCADE primary logic RAR intake

Upload exactly one archive here with this filename:

`OCADE_PRIMARY_LOGIC.rar`

Expected SHA-256 for the 2026-08-26 owner-supplied archive:

`13f336cedd2ef983a70f4220f625437c06dde8eedb8a49a164f0d351822312ee`

Observed archive inventory before GitHub upload: 2,123 files, 346 directory entries, 33,932,069 uncompressed bytes.

Do not place extracted files directly into production `src/`. Claude Code must first extract into an isolated staging directory, inventory/compare responsibilities, then decide file-by-file whether existing OCADE code stays, is replaced, is adapted, or is deleted after replacement. Production Cloudflare/OAuth/public URLs are not part of this import and must remain unchanged unless a later verified implementation proves a change is mandatory.
