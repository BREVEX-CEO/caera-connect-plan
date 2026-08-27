#!/usr/bin/env bash
#
# THE GATE RUNNER.
#
# Written after a matrix run was reaped mid-test and reported nothing, because
# the previous runner had three faults that between them made a dead run look
# like a slow one:
#
#   1. `cmd 2>&1 | tail -8` reports tail's exit code, not the command's. A
#      failing gate whose last eight lines look calm passes.
#   2. Backgrounding the whole matrix and polling a log file means a reaped
#      process is indistinguishable from a long one, forever.
#   3. No timeout, so a hung subprocess hangs the run rather than failing it.
#
# So: every gate runs in the FOREGROUND under `timeout`, output goes through
# `tee` to a per-gate log with `pipefail` on so the real status survives the
# pipe, and a gate that runs out of time is reported as a timeout rather than
# as a failure — they need different fixes.
#
# Usage:
#   scripts/gates.sh                 every gate
#   scripts/gates.sh typecheck lint  only those
#   scripts/gates.sh --list          names and time limits
#
set -uo pipefail

LOG_DIR="${OCADE_GATE_LOGS:-.gate-logs}"
mkdir -p "$LOG_DIR"

# name : seconds : command
GATES=(
  "typecheck:600:npx tsc --noEmit -p tsconfig.json"
  "lint:600:npm run lint"
  "tests:900:npx vitest run --reporter=dot"
  "build:900:npm run build"
  "secrets:120:npm run audit:secrets"
  "integration:180:npm run integration:check"
  "download:300:npm run audit:download"
  "local-offline:1500:npm run audit:local-offline"
  "journey:900:npm run audit:journey"
  "routes:1200:npm run audit:routes:prod"
  "offline:900:npm run audit:offline:prod"
  "settings:900:npm run audit:settings"
  "worker:1200:npm run audit:worker"
  "extension:300:npm run extension:e2e"
)

if [[ "${1:-}" == "--list" ]]; then
  for gate in "${GATES[@]}"; do
    IFS=":" read -r name limit cmd <<<"$gate"
    printf '%-12s %5ss  %s\n' "$name" "$limit" "$cmd"
  done
  exit 0
fi

wanted=("$@")
failed=()
timedout=()
passed=()

for gate in "${GATES[@]}"; do
  IFS=":" read -r name limit cmd <<<"$gate"
  if ((${#wanted[@]})); then
    match=0
    for w in "${wanted[@]}"; do [[ "$w" == "$name" ]] && match=1; done
    ((match)) || continue
  fi

  log="$LOG_DIR/$name.log"
  results="$LOG_DIR/results.txt"
  started=$SECONDS
  printf '\n========== %s (limit %ss) ==========\n' "$name" "$limit"
  # `timeout` sends TERM then KILL, so a wedged child cannot outlive its gate.
  # pipefail is what makes the exit code below the COMMAND's rather than tee's.
  timeout --kill-after=30s "${limit}s" bash -c "$cmd" 2>&1 | tee "$log"
  status=${PIPESTATUS[0]}
  took=$((SECONDS - started))

  # RECORD THE VERDICT WHERE NOTHING CAN ERASE IT.
  #
  # Three gates start a server whose shutdown message ends with the terminal's
  # erase-line escape, and that wiped the PASS line printed immediately after
  # it. The exit codes were counted correctly and the transcript showed a gate
  # that apparently produced no verdict at all — which reads exactly like a
  # gate that died. Results now also go to a plain file that no escape sequence
  # can rewrite.
  if ((status == 0)); then
    verdict="PASS $name (${took}s)"
    passed+=("$name")
  elif ((status == 124 || status == 137)); then
    # 124 is timeout's own signal; 137 is the KILL that follows it.
    verdict="TIMEOUT $name after ${took}s — see $log"
    timedout+=("$name")
  else
    verdict="FAIL $name (exit $status, ${took}s) — see $log"
    failed+=("$name")
  fi
  printf '\n%s\n' "$verdict"
  printf '%s\n' "$verdict" >>"$results"
done

printf '\n================ SUMMARY ================\n'
printf 'passed:   %s\n' "${passed[*]:-none}"
printf 'failed:   %s\n' "${failed[*]:-none}"
printf 'timedout: %s\n' "${timedout[*]:-none}"
printf 'logs in %s, verdicts in %s/results.txt\n' "$LOG_DIR" "$LOG_DIR"

((${#failed[@]} + ${#timedout[@]} == 0))
