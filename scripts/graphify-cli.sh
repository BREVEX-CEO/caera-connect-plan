#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export GRAPHIFY_OUT=graphify-out
exec "$(git rev-parse --absolute-git-dir)/graphify/venv/bin/graphify" "$@"
