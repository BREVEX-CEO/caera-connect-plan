#!/usr/bin/env bash
# Linux pre-push gate. Bootstrap Node/npm, the locked Python runtime, Chromium,
# reportlab 4.5.1, opentimelineio 0.17.0, Xvfb, ffmpeg, LibreOffice and local
# PostgreSQL first. PG* must name a disposable local PostgreSQL server.
# CI uses the same two phases; no provider or hosted-project credentials needed.
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-all}"
case "$mode" in all|--core-only|--companion-only) ;; *) echo "Usage: $0 [--core-only|--companion-only]" >&2; exit 2 ;; esac
if [[ "$(uname -s)" != Linux ]]; then
  echo "REFUSED: this gate requires a disposable Linux environment." >&2
  exit 2
fi
if [[ "$mode" != --companion-only ]]; then
  case "${PGHOST:-}" in ""|localhost|127.0.0.1|::1|/var/run/postgresql) ;; *) echo "REFUSED: PostgreSQL must be local and disposable." >&2; exit 2 ;; esac
  export VITE_SUPABASE_URL=https://ci-placeholder.supabase.co
  export VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder
  npm run verify:full
  npm run jarvis:protocol-check
  npm run jarvis:no-hardcoded
  # Same scope as the push gate: the qualification timing campaign stays excluded.
  OCADE_CODING_GATE=1 node --experimental-strip-types --no-warnings --test tests/jarvis/*.test.ts tests/security/*.test.ts
  npm run test:jarvis-db
  npm run readiness
  npm run jarvis:traceability
  npm run licences:check
fi
if [[ "$mode" != --core-only ]]; then
  if [[ -z "${OCADE_BROWSER_EXECUTABLE:-}" ]]; then
    OCADE_BROWSER_EXECUTABLE="$(python3 -c 'from playwright.sync_api import sync_playwright; p=sync_playwright().start(); print(p.chromium.executable_path); p.stop()')"
    export OCADE_BROWSER_EXECUTABLE
  fi
  cd device-agent/windows
  xvfb-run -a python3 -m tests.run_required \
    "needs a Windows desktop" "needs Windows process handles" \
    "needs Windows UI Automation and COM" \
    "needs a Mac desktop with Accessibility granted" \
    "needs a display and OCADE_PUBLIC_WEB=1"
fi
