#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
state=$(git rev-parse --absolute-git-dir)/graphify
echo "Graphify logs: $state"
sh scripts/graphify-cli.sh --version
test "$(git config --get core.hooksPath)" = .githooks
for hook in post-checkout post-commit post-merge post-rewrite; do test -x ".githooks/$hook"; done
test ! -e "$state/unfinished" || { echo 'Previous refresh incomplete or failed' >&2; exit 1; }
python3 scripts/graphify-health.py
echo 'OVERALL: OK'
