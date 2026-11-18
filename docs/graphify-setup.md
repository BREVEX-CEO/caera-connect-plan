# graphify setup (plain English)

graphify builds a map (graph) of the code so Claude can find things fast. It lives in `graphify-out/` and is never committed.

**What updates it automatically**
- Every git commit, merge and checkout (`.githooks/post-commit`, `post-merge`, `post-checkout`).
- Every new Claude Code session (SessionStart hook in `.claude/settings.json`, runs `scripts/setup-graphify.sh`, which installs graphify if missing and calls the wrapper).
- If the graph file is missing, the first Bash/Grep/Read/Glob Claude runs rebuilds it in the background (PreToolUse hook).

All of them call one script: `scripts/graphify-refresh.sh`. It runs one rebuild at a time, keeps a backup, and restores the backup if the new graph is tiny (under 100 nodes or under half the old size), times out (10 min), or fails. It always exits 0 so it can never break git or Claude. Log: `/tmp/graphify-refresh.log`.

**Check health:** `sh scripts/graphify-status.sh` (want `OVERALL: OK`).

**New collaborator:** `pip install graphifyy`, then `sh scripts/setup-graphify.sh` (turns on the git hooks and builds the graph).

**Graph looks tiny or stale?** Run `sh scripts/graphify-refresh.sh`, then read `/tmp/graphify-refresh.log` for warnings. A plain `graphify update .` refuses or shrinks results in some cases; the wrapper uses `GRAPHIFY_FORCE=1` (the official full-rebuild switch, same as `--force`). Last resort: delete `graphify-out/` and run the refresh again.
