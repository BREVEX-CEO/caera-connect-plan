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
python3 - <<'PY'
import os
import urllib.error
import urllib.request
request = urllib.request.Request(os.environ["SUPABASE_URL"] + "/auth/v1/admin/users?page=1&per_page=1",
                                 headers={"apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                                          "Authorization": "Bearer " + os.environ["SUPABASE_SERVICE_ROLE_KEY"]})
try:
    with urllib.request.urlopen(request, timeout=30) as response:
        assert response.status == 200
except Exception:
    raise SystemExit("Staging credential check failed; no credential value was logged.") from None
PY
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
secret = os.environ["SUPABASE_SERVICE_ROLE_KEY"].encode()
if any(secret in path.read_bytes() for path in Path(sys.argv[1]).rglob("*") if path.is_file()):
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
print(f"E1 acceptance: {passed}/{len(rows)} first-attempt successes; expected {expected} tasks; gaming {gaming}")
if len(rows) != expected or passed / expected < .9 or gaming:
    raise SystemExit(1)
PY
