#!/bin/sh
# One-time setup for a collaborator: enable git hooks and build the graph. Always exits 0.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0
git config core.hooksPath .githooks
chmod +x .githooks/* scripts/graphify-*.sh scripts/setup-graphify.sh 2>/dev/null
command -v graphify >/dev/null 2>&1 || echo "graphify is not installed. Install it with: pip install graphifyy"
sh scripts/graphify-refresh.sh
exit 0
