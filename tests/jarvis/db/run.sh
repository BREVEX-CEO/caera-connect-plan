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
if [[ "${OCADE_DB_ADVISORS:-}" == 1 ]]; then
  [[ "${GITHUB_ACTIONS:-}" == true && "${PGHOST:-}" == 127.0.0.1 && "${PGPORT:-}" == 5432 ]] || {
    echo "REFUSED: advisors require the disposable GitHub Actions database." >&2
    exit 2
  }
  npx --yes supabase@2.122.0 db advisors \
    --db-url "postgresql://postgres:jarvis_disposable_ci_only@127.0.0.1:5432/$db?sslmode=disable" \
    --type all --level warn --fail-on error
fi
if [[ "${OCADE_GENERATE_JARVIS_TYPES:-}" == 1 ]]; then
  [[ "${GITHUB_ACTIONS:-}" == true && "${PGHOST:-}" == 127.0.0.1 && "${PGPORT:-}" == 5432 ]] || {
    echo "REFUSED: binding generation requires the disposable GitHub Actions database." >&2
    exit 2
  }
  generated_types=$(mktemp "$RUNNER_TEMP/ocade-types.XXXXXX")
  (
    cd "$RUNNER_TEMP"
    npx --yes supabase@2.122.0 gen types --lang typescript --schema public \
      --db-url "postgresql://postgres:jarvis_disposable_ci_only@127.0.0.1:5432/$db?sslmode=disable"
  ) > "$generated_types"
  node --input-type=module - "$generated_types" <<'JS'
import { readFileSync } from "node:fs";
import prettier from "prettier";
import ts from "typescript";

const tree = ts.createSourceFile("generated.ts", readFileSync(process.argv[2], "utf8"), ts.ScriptTarget.Latest);
const database = tree.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === "Database");
const property = (type, name) => {
  const member = type?.members?.find((node) => ts.isPropertySignature(node) && node.name.text === name);
  if (!member) throw new Error("Generated Supabase shape is missing " + name);
  return member;
};
const schema = property(database?.type, "public").type;
const functions = property(schema, "Functions").type;
for (const name of ["jarvis_open_task", "jarvis_resume_task"]) {
  const declaration = property(functions, name).getText(tree);
  const formatted = await prettier.format("type Contract = {\n" + declaration + "\n}", {
    parser: "typescript", semi: false, trailingComma: "none", printWidth: 96,
  });
  const block = formatted.trimEnd().split("\n").slice(1, -1).map((line) => "    " + line).join("\n");
  console.log("OCADE_TYPES:" + JSON.stringify({ name, block }));
}
JS
  rm -f "$generated_types"
fi
failures=0
for test in tests/jarvis/db/*.test.sql; do
  if run -f "$test"; then
    echo "PASS $test"
  else
    echo "FAIL $test"
    failures=$((failures + 1))
  fi
done
if python3 tests/jarvis/db/claim-receipt-race.py "$db"; then
  echo "PASS task/receipt lock-order cases"
else
  echo "FAIL task/receipt lock-order cases"
  failures=$((failures + 1))
fi
if bash tests/jarvis/db/rollback-roundtrip.sh; then
  :
else
  echo "FAIL migration rollbacks"
  failures=$((failures + 1))
fi
if [ "$failures" -ne 0 ]; then
  echo "FAIL: $failures database test group(s)"
  exit 1
fi
