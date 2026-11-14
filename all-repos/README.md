# OCADE — 246 external source checkouts

This research-only directory provides a verified-inventory clone launcher. It does **not** vendor external projects into OCADE's tracked source or enable any third-party code at runtime.

## Download all available sources (Windows PowerShell, macOS, Linux, or Codex terminal)

From the OCADE repository root, with Git and Python 3.10+ installed:

```sh
python all-repos/clone_all.py
```

To test only three repositories or inspect the planned destinations:

```sh
python all-repos/clone_all.py --limit 3
python all-repos/clone_all.py --dry-run
```

- Every attempted source goes under `all-repos/checkouts/NNN-owner-repo/`, ignored by Git.
- The launcher uses shallow, blob-filtered Git clones; it **still checks out** sources, potentially using substantial disk space, network traffic and time. `GIT_LFS_SKIP_SMUDGE=1` skips large Git LFS downloads.
- Concurrency is limited to 2 by default. `--jobs 1` is gentler; the allowed range is 1–4.
- The command is resumable: re-running skips existing valid Git checkouts and retries failures. Its source SHA, errors, aliases and outcomes go to the ignored `checkouts/clone-status.json`.
- Entry 080 (`alibaba/UI-TARS`) clones canonical `bytedance/UI-TARS` while retaining the original catalog entry.
- Entry 187 (`All-Hands-AI/OpenHands`) is an alias of 078 (`OpenHands/OpenHands`) and is not downloaded twice.
- Other invalid, private, or renamed repositories are reported as failures, never silently replaced.
- Clones run **only when you execute the command**; committing these files does not launch an Actions job or download any repository.

Read-only research does not itself authorize combining or redistributing source with incompatible licences. Check individual source, asset and model licences before shipping anything.

## Contents

- `repos.txt` — all 246 requested URL entries, in original order
- `clone_all.py` — standard-library Python clone and resume utility
- `.gitignore` — keeps hundreds of external Git checkouts out of OCADE's Git history
