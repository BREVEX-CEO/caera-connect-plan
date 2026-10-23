# DeepSeek Harness import inbox — NOT connected to OCADE yet

This is a **source intake area**, not a deployed agent, executable or production dependency. This import is expressly authorized as **new MIT-licensed upstream code**; it is **not** the retired donor content removed in October.

## Exact upstream version

- Repository: https://github.com/deepseek-ai/deepseek-harness
- Pinned upstream commit: `687f282e8625c6b8d11ff58211a90524be2e4317`
- **Download the pinned source ZIP:** https://github.com/deepseek-ai/deepseek-harness/archive/687f282e8625c6b8d11ff58211a90524be2e4317.zip
- License: MIT; include its original `LICENSE`, `SAFETY.md` and `THIRD_PARTY_NOTICES.md` and review licenses of reused components.
- Status: **NOT UPLOADED / NOT VERIFIED / NOT INTEGRATED** until the real ZIP and check results exist. The pinned root name is only a naming check, **not** a cryptographic signature.

## One upload location

1. Download the **pinned ZIP** above, not the moving `master` ZIP.
2. In GitHub, first select branch `ocade/p00-p22-implementation`; open [incoming/](incoming/), choose **Add file → Upload files**, and upload the archive with the filename **`deepseek-harness.zip`**.
3. **GitHub's website limits a single upload to 25 MiB.** If your ZIP is larger, do **not** split it, paste 16,000 extracted files into the repository, or spend on LFS. Leave the inbox empty; Claude can fetch that exact pinned upstream ZIP to a **local isolated workspace** when authorized, inspect it there and avoid adding a huge binary to Git history.
4. Inspect from a checked-out copy of OCADE: `python scripts/deepseek_import.py` (or specify `--archive /path/to/deepseek-harness.zip`). To explicitly unpack a ZIP with the correct pinned root name to the locally **ignored** quarantine area: `python scripts/deepseek_import.py --extract`.
5. The inspector checks path traversal, duplicate/case collisions, symlinks, limits, required source notices and package identity, and prints the ZIP SHA-256. It **does not** authenticate the publisher, review every dependency or run any upstream code. Verify the publisher/download source and archive hash before trusting it.
6. Give Claude access to the checked-out branch/source inbox. The engineering contract is [docs/integrations/deepseek-harness.md](../../docs/integrations/deepseek-harness.md); no separate chat prompt is required.

## Rules

- Never automatically run `npm install`, `pnpm install`, build scripts, arbitrary plugins or model-generated commands because a ZIP appeared.
- Do not replace OCADE's production planner, local Device Agent, authenticated permission authority, STOP, ownership, credential handling, task settlement or independently verified completion during import.
- This ZIP contains **software**, not model weights or DeepSeek reasoning. Using a DeepSeek AI model requires an authorized endpoint, secrets, quotas and costs review; OCADE's existing Gemini/High/Offline routes must not be silently changed.
- Full source copying is not the objective: keep only legally reusable, tested, dependency-complete components that deliver measured benefits. Preserve everything required by upstream and transitive licenses.
