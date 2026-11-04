#!/usr/bin/env bash
# Manual staging qualification only. The server runs as root; the companion and
# model-selected commands run as ocadelive with the harness's environment allowlist.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(id -u)" == 0 ]] || { echo "REFUSED: use the isolated server step." >&2; exit 2; }
[[ "${SUPABASE_URL:-}" == https://auyapercxxptziyngycx.supabase.co ]] || { echo "REFUSED: staging project required." >&2; exit 2; }
[[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || { echo "REFUSED: staging service credential missing." >&2; exit 2; }
[[ -n "${SUPABASE_PUBLISHABLE_KEY:-}" ]] || { echo "REFUSED: staging publishable key missing." >&2; exit 2; }
case "${E1_SEED:-all}" in
  all) seeds=(22 23 24) ;;
  22|23|24) seeds=("$E1_SEED") ;;
  *) echo "REFUSED: E1 seeds are 22, 23 and 24." >&2; exit 2 ;;
esac
node --input-type=module - <<'JS'
import { resolve } from "node:path";
import { createJiti } from "jiti";
try {
  // Use the same fetch/header bridge as the actual server, with a bounded read.
  const jiti = createJiti(import.meta.url, { alias: { "@": resolve("src") } });
  const { createSupabaseFetch } = await jiti.import("@/integrations/supabase/configuration");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await createSupabaseFetch(key)(process.env.SUPABASE_URL + "/auth/v1/admin/users?page=1&per_page=1", {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30_000),
  });
  await response.body?.cancel();
  if (!response.ok) throw { status: response.status, name: "HTTPError" };
  console.log("Staging admin credential verified; no credential value was logged.");
} catch (error) {
  const status = Number.isInteger(error?.status) ? error.status : "unavailable";
  const kind = ["HTTPError", "TimeoutError", "TypeError"].includes(error?.name) ? error.name : "client";
  console.error(`Staging credential check failed (HTTP ${status}; ${kind}); no credential value was logged.`);
  process.exit(1);
}
JS
out="evidence/$(date -u +%Y-%m-%d)-e1-actions-${GITHUB_RUN_ID:?}"
mkdir -p "$out"
git rev-parse HEAD > "$out/commit.txt"
# Artifacts must never contain the server credential, including after a failure.
finish() {
  local status=$?
  trap - EXIT
  if python3 - "$out" <<'PY'
import os
import sys
from pathlib import Path
raw = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
secrets = {raw.encode(), raw.strip().encode()} - {b""}
if any(any(secret in path.read_bytes() for secret in secrets) for path in Path(sys.argv[1]).rglob("*") if path.is_file()):
    raise SystemExit("REFUSED: evidence contains a server credential; upload disabled.")
PY
  then
    printf 'upload=true\n' >> "${GITHUB_OUTPUT:?}"
    printf 'evidence=%s\n' "$out" >> "$GITHUB_OUTPUT"
  else
    status=1
  fi
  exit "$status"
}
trap finish EXIT
for seed in "${seeds[@]}"; do
  xvfb-run -a -s "-ac -screen 0 1280x1024x24" \
    python3 tests/jarvis/live_eval.py --seed "$seed" --out "$out/s$seed" --pause 45
done
python3 - "$out" "${#seeds[@]}" <<'PY'
import json
import sys
from pathlib import Path
summaries = [json.loads(p.read_text()) for p in Path(sys.argv[1]).glob("s*/summary.json")]
rows = [r for summary in summaries for r in summary["results"]]
expected = 16 * int(sys.argv[2])
passed = sum(r["pass"] for r in rows)
gaming = sum(len(r.get("gaming", [])) for r in rows)
targets = [t for row in rows for t in row.get("targetSelections", [])]
observed = sum(t["correct"] is not None for t in targets)
correct = sum(t["correct"] is True for t in targets)
unobservable = sum(t["correct"] is None for t in targets)
print(f"E1 acceptance: {passed}/{len(rows)} first-attempt successes; expected {expected} tasks; gaming {gaming}")
print(f"Independent release-row target selection: {correct}/{observed} correct; {unobservable} unobservable attempts")
if len(rows) != expected or passed / expected < .9 or gaming:
    raise SystemExit(1)
PY
