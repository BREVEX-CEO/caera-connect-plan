#!/bin/sh
# Sets up graphify on a fresh machine or cloud session. Safe to re-run.
# Always exits 0 so it can never block a session or git action.
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

if ! command -v graphify >/dev/null 2>&1; then
    python3 -m pip install -q graphifyy >/dev/null 2>&1 || pipx install -q graphifyy >/dev/null 2>&1 || true
fi

git config core.hooksPath .githooks 2>/dev/null || true

if command -v graphify >/dev/null 2>&1; then
    GRAPHIFY_FORCE=1 graphify update . >/dev/null 2>&1 || echo "graphify: update failed (see graphify update . output)" >&2
else
    echo "graphify: not installed, skipping graph build" >&2
fi
exit 0
