#!/bin/sh
# Safe graphify rebuild. Always exits 0. One rebuild at a time. Never keeps a tiny graph.
LOG=/tmp/graphify-refresh.log
LOCK=/tmp/graphify-refresh.lock
log() { printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$$" "$*" >> "$LOG"; }

command -v graphify >/dev/null 2>&1 || exit 0
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0

# Lock: drop a stale lock (older than 10 minutes), then try to take it.
[ -d "$LOCK" ] && find "$LOCK" -maxdepth 0 -mmin +10 -exec rm -rf {} + 2>/dev/null
if ! mkdir "$LOCK" 2>/dev/null; then
  log "skipped: another rebuild is already running"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM

GRAPH=graphify-out/graph.json
BACKUP=graphify-out/graph.json.bak
count_nodes() {
  [ -f "$1" ] && python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["nodes"]))' "$1" 2>/dev/null || echo 0
}

OLD=$(count_nodes "$GRAPH")
rm -f "$BACKUP"
[ -f "$GRAPH" ] && cp "$GRAPH" "$BACKUP"
log "rebuild started (old graph: $OLD nodes)"

GRAPHIFY_FORCE=1 timeout 600 graphify update . >> "$LOG" 2>&1
RC=$?
NEW=$(count_nodes "$GRAPH")

BAD=""
[ "$RC" -eq 124 ] && BAD="timed out after 600s"
[ -z "$BAD" ] && [ "$RC" -ne 0 ] && BAD="graphify failed (exit $RC)"
[ -z "$BAD" ] && [ "$NEW" -lt 100 ] && BAD="new graph has only $NEW nodes (minimum 100)"
[ -z "$BAD" ] && [ "$NEW" -lt $((OLD / 2)) ] && BAD="new graph has $NEW nodes, under half of old $OLD"

if [ -n "$BAD" ]; then
  if [ -f "$BACKUP" ]; then
    cp "$BACKUP" "$GRAPH"
    log "WARNING: $BAD - restored backup ($OLD nodes)"
  else
    rm -f "$GRAPH"
    log "WARNING: $BAD - no backup to restore, removed the bad graph"
  fi
else
  log "rebuild ok: $NEW nodes"
fi
exit 0
