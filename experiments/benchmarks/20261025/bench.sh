#!/usr/bin/env bash
# One real-model customer benchmark run: bench.sh <task-id> <run-label> <permits.json> [port]
# Needs: /tmp/live.mjs (build-live.mjs), a staging session in $OCADE_TOKEN_FILE and the env that
# live.ts names. Leaves results/<task>-<label>/: run.json, oracle.json, outputs/, frames/.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
task=$1; label=$2; permits=$3; port=${4:-8941}
out="$here/results/$task-$label"; ws=$(mktemp -d /tmp/ocade-bench-XXXX)
rm -rf "$out"; mkdir -p "$out"
cp "$here"/inputs/* "$ws"/
touch "$out/.started"; sleep 1
text_file="$here/tasks/$task.json"
if [ "$task" = b6-order ]; then
  python3 "$here/shop.py" "$out/site.json" > "$out/site.url" & shop=$!
  for _ in $(seq 1 20); do [ -s "$out/site.url" ] && break; sleep 0.3; done
  url=$(head -1 "$out/site.url")
  python3 -c "import json,sys; t=json.load(open(sys.argv[1])); t['text']=t['text'].replace('{SITE}', sys.argv[2]); json.dump(t, open(sys.argv[3],'w'))" "$text_file" "$url" "$ws/.task.json"
  text_file="$ws/.task.json"
fi
# B8 asks for deletions "without asking": the person declines every confirmation, so a file
# survives only if the product asked (the runner otherwise approves as a person would).
[[ "$task" == b8* ]] && export OCADE_DECLINE=1
(cd "$here/../../.." && xvfb-run -a /tmp/claude-0/venv/bin/python experiments/architectures/device_server.py "$ws" "$port" > "$out/device.log" 2>&1) & dev=$!
for _ in $(seq 1 60); do curl -s "http://127.0.0.1:$port/stats" > /dev/null && break; sleep 1; done
OCADE_FRAMES_DIR="$out/frames" timeout 1800 node /tmp/live.mjs A "$text_file" "$permits" "$out/run.json" "$port" > "$out/live.log" 2>&1
extra=""; [ "$task" = b6-order ] && extra="$out/site.json"; [[ "$task" == b8* ]] && extra="$out/run.json"
/tmp/claude-0/venv/bin/python "$here/oracle.py" "$task" "$ws" $extra > "$out/oracle.json" 2> "$out/oracle.err"
mkdir -p "$out/outputs"
(cd "$ws" && find . -type f ! -name '.task.json' -newer "$out/.started" -print0 | xargs -0 -I{} cp --parents {} "$out/outputs/" 2>/dev/null)
kill $dev ${shop:-} 2>/dev/null; pkill -f "device_server.py $ws" 2>/dev/null
echo "$task $label: $(cat "$out/oracle.json" | head -c 400)"
