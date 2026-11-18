#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
state=$(git rev-parse --absolute-git-dir)/graphify
mkdir -p "$state"
exec 9>"$state/refresh.lock"
flock -w 660 9
bin=$state/venv/bin/graphify
if ! test -x "$bin"; then echo "Graphify missing: run sh scripts/setup-graphify.sh" >&2; exit 1; fi
export GRAPHIFY_OUT=graphify-out
unset GRAPHIFY_FORCE
out=graphify-out
backup=$state/checkpoint
restore() {
    for file in graph.json GRAPH_REPORT.md graph.html manifest.json .graphify_build_state.json; do
        if [ -f "$backup/$file" ]; then cp -p "$backup/$file" "$out/$file"; else rm -f "$out/$file"; fi
    done
}
mkdir -p "$out"
products() { sha256sum "$out/graph.json" "$out/GRAPH_REPORT.md" "$out/manifest.json" "$out/graph.html"; }
inputs=$(python3 scripts/graphify-fingerprint.py)
if [ ! -e "$state/unfinished" ] && [ ! -d "$backup" ] && [ -f "$state/fingerprint" ] &&
    [ "$inputs" = "$(cat "$state/fingerprint")" ] && products | cmp -s - "$state/products"; then
    echo 'Graphify inputs and products unchanged'
    exit 0
fi
if [ -d "$backup" ]; then restore; rm -r "$backup"; fi
rm -rf "$state/checkpoint.tmp"
mkdir "$state/checkpoint.tmp"
for file in graph.json GRAPH_REPORT.md graph.html manifest.json .graphify_build_state.json; do
    if [ -f "$out/$file" ]; then cp -p "$out/$file" "$state/checkpoint.tmp/"; fi
done
mv "$state/checkpoint.tmp" "$backup"
counts() { python3 scripts/graphify-health.py; }
old=$(counts 2>/dev/null) || old=0
set --
if [ "$old" = 0 ]; then
    rm -f "$out/graph.json" "$out/manifest.json" "$out/.graphify_build_state.json"
    set -- --force
fi
touch "$state/unfinished"
if timeout 600 "$bin" update . "$@" >>"$state/refresh.log" 2>&1 && new=$(counts) && [ "${new%% *}" -ge "$((${old%% *} / 2))" ]; then
    rm -r "$backup"
    if [ "$inputs" = "$(python3 scripts/graphify-fingerprint.py)" ]; then
        products > "$state/products"
        echo "$inputs" > "$state/fingerprint"
    else
        rm -f "$state/fingerprint"
    fi
    rm "$state/unfinished"
    echo "Graphify ready (nodes edges): $new"
else
    restore
    rm -r "$backup"
    echo "Graphify refresh failed; restored previous outputs. See $state/refresh.log" >&2
    exit 1
fi
