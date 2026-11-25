---
name: codemap
description: Locate OCADE code, tests and configuration using the repository index. Use for orientation or to refresh the file index and architecture overview.
---

Read the overview and search `CODEMAP.md` for the relevant directories and symbols. Open the real files to confirm ownership, behavior and tests. Use targeted Git or text search when the index is incomplete.

Run `python3 scripts/codemap.py` to regenerate the index. `--check` verifies the local commit and indexed content without rewriting; `--check --remote` additionally verifies the configured upstream HEAD without pulling. The generator preserves the overview between its markers. Update the overview when verified architecture or development commands change. Hooks refresh on session start, prompts, edit/command completion, before reading the map, and session stop. Do not commit the generated local map. Remote pushes produce a CodeMap artifact for the exact tested commit; synchronize safely before using remote source changes.
