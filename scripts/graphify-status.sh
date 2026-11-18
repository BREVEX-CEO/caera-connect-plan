#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
state=$(git rev-parse --absolute-git-dir)/graphify
echo "Graphify logs: $state"
bin=$state/venv/bin/graphify
if ! test -x "$bin"; then
    echo 'Graphify executable is missing. Run sh scripts/setup-graphify.sh' >&2
    exit 1
fi
"$bin" --version
if [ "$(git config --get core.hooksPath || :)" != .githooks ]; then
    echo 'Repository Graphify hooks are not configured. See docs/graphify-setup.md.' >&2
    exit 1
fi
for hook in post-checkout post-commit post-merge post-rewrite; do test -x ".githooks/$hook"; done
test ! -e "$state/unfinished" || { echo 'Previous refresh incomplete or failed' >&2; exit 1; }
python3 scripts/graphify-health.py
echo 'OVERALL: OK'
