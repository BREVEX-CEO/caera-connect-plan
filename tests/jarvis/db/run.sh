#!/usr/bin/env bash
# Replays every migration into a fresh disposable database, then runs the JARVIS
# authority tests. Needs a local PostgreSQL 16+ reachable through PG* variables.
# Never point this at a hosted project: it creates and drops its own database.
set -euo pipefail
cd "$(dirname "$0")/../../.."
db="ocade_jarvis_test_$$"
psql -q -d postgres -c "CREATE DATABASE $db" >/dev/null
trap 'psql -q -d postgres -c "DROP DATABASE IF EXISTS $db WITH (FORCE)" >/dev/null' EXIT
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$db" "$@"; }
run -f tests/jarvis/db/supabase-stub.sql 2>/dev/null
for migration in supabase/migrations/*.sql; do
  run -f "$migration" >/dev/null 2>&1 || { echo "migration failed: $migration"; run -f "$migration"; exit 1; }
done
for test in tests/jarvis/db/*.test.sql; do
  run -f "$test"
  echo "PASS $test"
done
