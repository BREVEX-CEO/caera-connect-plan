# graphify
- Before architecture questions, read `graphify-out/GRAPH_REPORT.md`.
- The graph auto-updates via git hooks (`.githooks/`) and at session start (`scripts/setup-graphify.sh`).
- If a graph looks stale or tiny, run `sh scripts/graphify-refresh.sh`. Never run `graphify update .` directly.
- Check health with `sh scripts/graphify-status.sh`.
- Full skill instructions: `.claude/skills/graphify/SKILL.md`. Trigger: `/graphify`.
