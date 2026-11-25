---
name: codemap
description: Query OCADE code, dependencies, calls, routes, database hints, tests and change impact through a single incremental index.
---

Use the short startup summary; do not read the complete CODEMAP.md. Query first:

- `python3 scripts/codemap.py --query "task or symbol" --budget 650`
- `python3 scripts/codemap.py --trace "symbol"` (calls and relationships)
- `python3 scripts/codemap.py --impact "path or symbol"` (bounded reverse dependencies)
- `python3 scripts/codemap.py --tests "path or symbol"` (candidate related tests)
- `python3 scripts/codemap.py --security "path or symbol"` (security hints)
- `python3 scripts/codemap.py --related "path or symbol"`
- `python3 scripts/codemap.py --diagnostics` (parse errors, unresolved imports and unindexed exports; verify against compiler/source)
- `python3 scripts/codemap.py --cycles` (static dependency cycle witnesses)
- `python3 scripts/codemap.py --unused` (TypeScript module-private function candidates)
- `python3 scripts/codemap.py --duplicates` (byte-identical parsed files)
- `python3 scripts/codemap.py --path "source" "target"` (directed file dependency path)

Each query refreshes changed files automatically and caps output by character budget; verify exact source lines before changes. Use targeted source search when necessary. Never treat inferred calls, migration hints, filename-based security hints or missing results as proof.

Run `python3 scripts/codemap.py --summary` for the short overview, `--stats` for cache activity, `--check` for full content freshness, and `--check --remote` for read-only upstream comparison. The TypeScript parser uses the project's existing installed TypeScript package; coverage is explicitly reported. Python AST needs no dependencies. No AI inference or new package installs. Never commit the generated map or internal cache.
