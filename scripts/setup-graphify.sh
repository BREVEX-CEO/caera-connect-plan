#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
for tool in flock timeout sha256sum; do
    if ! command -v "$tool" >/dev/null; then
        echo "Graphify requires $tool. See docs/graphify-setup.md." >&2
        exit 1
    fi
done
if ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
    echo 'Graphify requires Python 3.11 or newer on PATH.' >&2
    exit 1
fi
state=$(git rev-parse --absolute-git-dir)/graphify
mkdir -p "$state"
exec 9>"$state/setup.lock"
flock -w 600 9
version=$(cat .claude/skills/graphify/.graphify_version)
if ! test -x "$state/venv/bin/graphify" ||
    ! "$state/venv/bin/python" -c 'import tree_sitter_sql,graphify,sys,importlib.metadata as m; sys.exit(m.version("graphifyy") != sys.argv[1])' "$version" ||
    ! "$state/venv/bin/graphify" --version >/dev/null 2>&1; then
    echo "Installing graphifyy==$version (see $state/install.log)"
    if ! (set -e
        if command -v uv >/dev/null; then
            uv venv --allow-existing "$state/venv" && uv pip install --reinstall-package graphifyy --python "$state/venv/bin/python" "graphifyy[sql]==$version"
        else
            python3 -m venv "$state/venv" && "$state/venv/bin/python" -m pip install --force-reinstall "graphifyy[sql]==$version"
        fi
    ) >"$state/install.log" 2>&1; then
        cat "$state/install.log" >&2
        exit 1
    fi
fi
hooks=$(git config --get core.hooksPath || :)
case "$hooks" in
    .githooks) ;;
    '') for hook in "$(git rev-parse --git-path hooks)"/*; do
            case "$hook" in *.sample) continue;; esac
            if [ -f "$hook" ] && [ -x "$hook" ]; then echo "Preserving active hook $hook; integrate .githooks first" >&2; exit 1; fi
        done
        git config --local core.hooksPath .githooks ;;
    *) echo "Preserving custom core.hooksPath=$hooks; integrate .githooks first" >&2; exit 1 ;;
esac
exec 9>&-
exec sh scripts/graphify-refresh.sh
