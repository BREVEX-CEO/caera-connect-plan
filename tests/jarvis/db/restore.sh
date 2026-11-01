#!/usr/bin/env bash
# Full logical dump/restore of a fresh fixture database, inside this CI job's
# PostgreSQL service only. Never connects through PGHOST or to a hosted project.
set -euo pipefail
cd "$(dirname "$0")/../../.."

container="${OCADE_DISPOSABLE_POSTGRES_CONTAINER:-}"
if [[ "${GITHUB_ACTIONS:-}" != "true" || ! "$container" =~ ^[a-f0-9]{12,64}$ ||
      ! "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ || ! "${GITHUB_RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]]; then
  echo "REFUSED: a disposable GitHub Actions PostgreSQL service is required." >&2
  exit 2
fi
if [[ "$(docker inspect --format '{{.Config.Image}}' "$container")" != "postgres:16" ]]; then
  echo "REFUSED: unexpected PostgreSQL service image." >&2
  exit 2
fi

# Client and server come from the same image; no host-client version mismatch.
client() { docker exec --user postgres -i "$container" "$@"; }
source_db="ocade_restore_src_${GITHUB_RUN_ID}_${GITHUB_RUN_ATTEMPT}"
restored_db="ocade_restore_dst_${GITHUB_RUN_ID}_${GITHUB_RUN_ATTEMPT}"
corrupt_db="ocade_restore_bad_${GITHUB_RUN_ID}_${GITHUB_RUN_ATTEMPT}"
scratch="$(mktemp -d "${RUNNER_TEMP:?}/ocade-restore.XXXXXX")"
created=()
cleanup() {
  local status=$?
  trap - EXIT
  for db in "${created[@]}"; do
    client dropdb --force "$db" || status=1
  done
  rm -rf -- "$scratch"
  exit "$status"
}
trap cleanup EXIT

for db in "$source_db" "$restored_db" "$corrupt_db"; do
  client createdb "$db"
  created+=("$db") # Never drop a pre-existing database if creation failed.
done
run() { client psql -q -X -v ON_ERROR_STOP=1 -d "$source_db" "$@"; }
run < tests/jarvis/db/supabase-stub.sql > "$scratch/bootstrap.log" 2>&1
for migration in supabase/migrations/*.sql; do
  if ! run < "$migration" >> "$scratch/bootstrap.log" 2>&1; then
    echo "FAIL: restore-source migration $migration" >&2
    tail -n 20 "$scratch/bootstrap.log" >&2
    exit 1
  fi
done
# The existing authority suite leaves real synthetic accounts, grants, devices,
# journals and task outcomes in this disposable source database.
for test in tests/jarvis/db/*.test.sql; do
  run < "$test" > /dev/null
done

client pg_dump --version
client psql -At -d "$source_db" -c "SELECT version()"
client pg_dump --format=custom --no-owner "$source_db" > "$scratch/archive.dump"
test -s "$scratch/archive.dump"
started=$SECONDS
client pg_restore --exit-on-error --no-owner --dbname "$restored_db" < "$scratch/archive.dump"
elapsed=$((SECONDS - started))

for db in "$source_db" "$restored_db"; do
  # Strip only pg_dump's comments and random psql restriction nonce, retaining
  # all executable DDL, RLS, functions, constraints, indexes and ACL statements.
  client pg_dump --schema-only --no-owner --no-comments "$db" |
    sed -e '/^--/d' -e '/^\\restrict /d' -e '/^\\unrestrict /d' -e '/^$/d' > "$scratch/$db.schema"
  client psql -X -At -v ON_ERROR_STOP=1 -d "$db" < tests/jarvis/db/restore-fingerprint.sql > "$scratch/$db.data"
done
cmp "$scratch/$source_db.schema" "$scratch/$restored_db.schema"
cmp "$scratch/$source_db.data" "$scratch/$restored_db.data"
client psql -q -X -v ON_ERROR_STOP=1 -d "$restored_db" < tests/jarvis/db/restore-assertions.sql

# Negative control: a truncated archive must fail, never produce a green drill.
head -c 64 "$scratch/archive.dump" > "$scratch/broken.dump"
if client pg_restore --exit-on-error --no-owner --dbname "$corrupt_db" < "$scratch/broken.dump" > "$scratch/corrupt.log" 2>&1; then
  echo "FAIL: truncated archive was accepted." >&2
  exit 1
fi
archive_hash="$(sha256sum "$scratch/archive.dump" | cut -d ' ' -f 1)"
schema_hash="$(sha256sum "$scratch/$source_db.schema" | cut -d ' ' -f 1)"
data_hash="$(sha256sum "$scratch/$source_db.data" | cut -d ' ' -f 1)"
printf 'OCADE_RESTORE_EVIDENCE:{"sourceSha":"%s","archiveSha256":"%s","schemaSha256":"%s","dataSha256":"%s","restoreSeconds":%s,"truncatedArchiveRejected":true,"permissionChecks":"PASS","scope":"disposable PostgreSQL 16 with Supabase platform stubs"}\n' \
  "${GITHUB_SHA:?}" "$archive_hash" "$schema_hash" "$data_hash" "$elapsed"
