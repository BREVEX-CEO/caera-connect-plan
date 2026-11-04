#!/usr/bin/env bash
# D21: every migration after the task-authority baseline has a rollback that restores exactly
# what it replaced. One disposable database is migrated forward, recording its shape (every
# public function body, column and trigger) before each newer migration; a second, fully
# migrated one is rolled back one migration at a time and must match the recorded shape after
# every step. Then everything is re-applied forward. Never a hosted project.
set -euo pipefail
cd "$(dirname "$0")/../../.."
base="20261030120000"
a="ocade_rb_a_$$" b="ocade_rb_b_$$"
shapes=$(mktemp -d)
psql -q -d postgres -c "CREATE DATABASE $a" -c "CREATE DATABASE $b" >/dev/null
trap 'psql -q -d postgres -c "DROP DATABASE IF EXISTS $a WITH (FORCE)" -c "DROP DATABASE IF EXISTS $b WITH (FORCE)" >/dev/null; rm -rf "$shapes"' EXIT
run() { PGOPTIONS="-c client_min_messages=warning" psql -q -X -v ON_ERROR_STOP=1 -d "$1" -f "$2" >/dev/null; }
shape() {
  psql -Atq -d "$1" -c "SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' || md5(p.prosrc)
                          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' ORDER BY 1" \
                   -c "SELECT table_name || '.' || column_name FROM information_schema.columns
                        WHERE table_schema = 'public' ORDER BY 1" \
                   -c "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1"
}
for db in "$a" "$b"; do run "$db" tests/jarvis/db/supabase-stub.sql 2>/dev/null; done
newer=()
for migration in supabase/migrations/*.sql; do
  version=$(basename "$migration" | cut -d_ -f1)
  if [[ "$version" > "$base" ]]; then
    shape "$a" > "$shapes/${#newer[@]}"  # the shape this migration's rollback must restore
    newer+=("$migration")
  fi
  run "$a" "$migration"
  run "$b" "$migration"
done
for (( i=${#newer[@]}-1; i>=0; i-- )); do
  rollback="supabase/rollback/$(basename "${newer[$i]}" .sql)_rollback.sql"
  [[ -f "$rollback" ]] || { echo "FAIL: missing $rollback"; exit 1; }
  run "$b" "$rollback"
  if ! diff "$shapes/$i" <(shape "$b"); then
    echo "FAIL: $rollback does not restore the shape before its migration"; exit 1
  fi
done
for migration in "${newer[@]}"; do run "$b" "$migration"; done  # and forward again
echo "PASS ${#newer[@]} rollbacks each restore the shape before their migration and re-apply cleanly"
