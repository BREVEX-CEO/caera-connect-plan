Graphify uses the version recorded in the tracked skill. On Linux install Python 3.11+
with venv/pip or uv, util-linux flock and GNU timeout. From the repository root run
`sh scripts/setup-graphify.sh`. It installs into the current worktree's Git
directory, enables the four tracked Git hooks and refreshes the ignored graph.
The hooks and Claude SessionStart run synchronously. Concurrent updates serialize.
Graphify checks its manifest and extracts changed files. Failed updates restore
the previous graph and report. Inspect `sh scripts/graphify-status.sh` and the
refresh.log or install.log in the directory it prints.

For Codex Cloud select BREVEX-CEO/caera-connect-plan and the task branch
ocade/p00-p22-implementation. Set **both setup and maintenance scripts** to:

```sh
set -eu
cd "$(git rev-parse --show-toplevel)"
git merge-base --is-ancestor 252334a HEAD
sh scripts/setup-graphify.sh
```

Enable package index access during installation. Rebuild the environment cache
and start a new task on the implementation branch. The ancestry check fails
visibly on an older checkout. It never switches branches. AGENTS.md also asks
Codex to initialize the current checkout when the agent starts.
