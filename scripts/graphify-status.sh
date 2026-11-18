#!/bin/sh
# Plain-English graphify health report. Always exits 0.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) && cd "$ROOT"
GRAPH=graphify-out/graph.json
INST=no; command -v graphify >/dev/null 2>&1 && INST=yes
HOOKS=no; [ "$(git config core.hooksPath 2>/dev/null)" = ".githooks" ] && HOOKS=yes
echo "graphify installed: $INST"
echo "git hooks path set: $HOOKS"
NODES=0
if [ -f "$GRAPH" ]; then
  COUNTS=$(python3 -c 'import json,sys; g=json.load(open(sys.argv[1])); print(len(g["nodes"]), len(g.get("links",g.get("edges",[]))))' "$GRAPH" 2>/dev/null) || COUNTS="0 0"
  NODES=${COUNTS% *}
  echo "graph exists: yes, nodes: $NODES, edges: ${COUNTS#* }, built: $(date -r "$GRAPH" '+%Y-%m-%d %H:%M:%S')"
else
  echo "graph exists: no, nodes: 0, edges: 0, built: never"
fi
LAST=$(tail -n 1 /tmp/graphify-session.log 2>/dev/null)
echo "last session-start run: ${LAST:-never}"
if [ "$NODES" -ge 100 ]; then echo "OVERALL: OK"; else echo "OVERALL: NEEDS ATTENTION"; fi
exit 0
