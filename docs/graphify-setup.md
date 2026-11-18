# Graphify setup

Graphify uses the version pinned in `.claude/skills/graphify/.graphify_version`
with its SQL parser extra. Install Python 3.11 or newer, uv or Python venv/pip,
util-linux `flock`, and GNU coreutils (`timeout` and `sha256sum`).

`sh scripts/setup-graphify.sh` installs into the current worktree's Git directory,
enables the four tracked Git hooks, and refreshes the ignored graph. Concurrent
installs and refreshes serialize. Unchanged inputs and outputs reuse the graph.
Failed updates restore the previous outputs. Run `sh scripts/graphify-status.sh`
to check health and locate `install.log` and `refresh.log`.

## Local Codex

Open the implementation checkout as a trusted project in a Codex client with
project hooks support. Run `/hooks` in the Codex CLI, review the repository's
`.codex/hooks.json` SessionStart hook, and trust it. Start or resume a session
to run the hook. The hook initializes Graphify synchronously, supplies graph-first
instructions to Codex, and surfaces setup failures in the session.

For an architecture question, run
`sh scripts/graphify-cli.sh query "Explain OCADE's complete system architecture"`
and read `graphify-out/GRAPH_REPORT.md` before scanning source. The wrapper
repairs a missing executable or an unusable repository graph on demand. The
Graphify skill is discoverable through `.agents/skills/graphify`.

## Codex Cloud

Open [Codex environment settings](https://chatgpt.com/codex/settings/environments).
Edit or create a reusable environment for `BREVEX-CEO/caera-connect-plan`.
Select `ocade/p00-p22-implementation` as the repository ref where offered,
and choose that branch when starting a Cloud task.
Set both the **Setup script** and the **Maintenance script** to:

```sh
set -eu
cd "$(git rev-parse --show-toplevel)"
if [ ! -f .codex/hooks.json ] || [ ! -f scripts/graphify-codex-start.sh ]; then
    echo 'Graphify configuration is missing from this checkout. Select ocade/p00-p22-implementation.' >&2
    exit 1
fi
sh scripts/setup-graphify.sh
```

Use a runtime with the dependencies listed above. The setup phase has internet
access. If agent-phase recovery needs to install packages, turn on **Agent
internet access** and allow PyPI (`pypi.org` and `files.pythonhosted.org`, or the
environment's configured package mirror). Save the environment and use **Reset
cache** if offered. Script changes also invalidate the cache.

Start a new task on the implementation branch. Check the setup log and run
`sh scripts/graphify-status.sh` before any manual initialization. Ask an
architecture question and confirm Codex queries the graph and reads the report.
Repeat in a new task with the cache populated to check the maintenance path.

Repository files define the setup behavior. The Cloud environment's repository,
task branch, scripts, network access, and cache are managed in Codex settings.
