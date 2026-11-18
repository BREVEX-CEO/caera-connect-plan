#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export GRAPHIFY_OUT=graphify-out
state=$(git rev-parse --absolute-git-dir)/graphify
bin=$state/venv/bin/graphify

if ! test -x "$bin"; then
    sh scripts/setup-graphify.sh >&2
else
    case "${1:-}" in
        query|path|explain|section|affected|god-nodes)
            if [ -e "$state/unfinished" ] || [ -d "$state/checkpoint" ] ||
                ! python3 scripts/graphify-health.py >/dev/null 2>&1; then
                sh scripts/setup-graphify.sh >&2
            fi
            ;;
    esac
fi
exec "$bin" "$@"
