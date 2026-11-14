# Source research infrastructure: PARTIAL / BLOCKED

No exhaustive-reading completion is claimed. No real source section was marked
delivered or acknowledged, and comprehension is not measured.

The branch contains a sequential reader, lossless inventory/export, explicit
receipt/acknowledgment protocol, persistent findings, refresh with archived
snapshots, gated research decisions, materialization retries and Claude instructions.
Thirteen fixture tests passed, including interruption recovery, bounded large-file
Unicode/CRLF/BOM reconstruction, missing/duplicated/truncated content, changed files,
corrupt coverage, ignored/hidden files, nested pins and preserved findings. Their
synthetic acknowledgments do not apply to OCADE or external sources.

Independent reconciliation verifies all 243 original top-level Git pins and a
lossless archive of every original tree entry. The external trees contain 762,412
blob entries, 126,348 directory-tree entries and 15 nested gitlinks. OCADE's original
tree is included separately. The archive preserves exact paths, modes and Git OIDs;
it is not a substitute for a completed SHA-256/size/line inventory.

All 243 materialization targets were attempted. Recorded operations: 197 passed,
532 blocked. Of the top-level sparse/LFS/nested operations, 67/65/65 passed,
respectively. The machine's 7.9 GiB disk and 4.9 GiB temporary object-store volume
cannot hold the fully materialized corpus plus inventories. No original source file
was deleted. The full inventory scan was interrupted at disk exhaustion; its SQLite
transaction rolled back. The remaining interrupted database is preserved locally.
A capacity guard now prevents repeating that scan on this undersized volume.
The available trees include OCADE plus five initialized nested repositories:
249 repositories and 771,394 tracked file entries. The metadata floor estimate is
857,016,320 bytes; the volume had about 151 million bytes free before staging.
Downloads and future delivery receipts require additional space beyond that floor.

The current reader decodes UTF-8 and BOM-identified UTF-16/32 without extension or
size filtering. Binary/container formats and unknown encodings remain explicit
blocking exceptions. Verified extractors for those formats remain outstanding.
Materialization commands succeeding alone would not establish source coverage.

**Delivery proof: incomplete (zero real sections). Acknowledgment proof: incomplete
(zero Claude acknowledgments). The full readable-line denominator is not established.**
A larger persistent volume and format handlers are needed before complete research
can be performed. Preserve the entire workspace, `.source-research/` state and Git
object stores when migrating. Re-run materialization and then the documented
`session` command. No source-tree filtering, automatic acknowledgments, summary
substitution, exception waivers or fake completion flags are provided.
