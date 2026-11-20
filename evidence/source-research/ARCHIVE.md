# Archived: `pinned-git-trees.jsonl.gz`

The 30 MB lossless Git-tree archive of the 243 pinned research repositories is not used by
any part of the OCADE product, its tests or its CI. With the owner's conditional approval
(20 Nov 2026) it was moved out of the working tree; nothing was deleted.

- Last present in commit `2b6aeecd02c875a49cb4b8d0ce322ac6d2849995`, path
  `evidence/source-research/pinned-git-trees.jsonl.gz`.
- SHA-256 `7c64c97834f450cf8fd3501498ea0bb3fc791a864bf5a8bd0b42f09786788b6a` (the value
  `git-tree-audit.json` records).
- `tools/source-research/audit_trees.py` restores it byte for byte from that commit before
  auditing. To restore it by hand:

```bash
git show 2b6aeecd02c875a49cb4b8d0ce322ac6d2849995:evidence/source-research/pinned-git-trees.jsonl.gz > evidence/source-research/pinned-git-trees.jsonl.gz
```
