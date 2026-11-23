# Verifier flake quantification (VERIFY-07), 23 November 2026

Command, from the repository root on branch `ocade/p00-p22-implementation` (Linux container,
Python 3.13, companion requirements plus reportlab and opentimelineio as in CI, Chromium 1243 on
Xvfb):

```bash
OCADE_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome \
  xvfb-run -a python scripts/verifier-flake.py --runs 10 \
  --out evidence/2026-11-23-verifier-flake/verifier-flake.json
```

Result: 10 runs of the 37 verifier tests (`tests.test_verify_kinds`, `tests.test_verify_web`), each
run in a fresh interpreter, 795.5 s in total. Every test had the same outcome in every run
(37 pass each time): 0 flaky tests, 0 always failing, 0 skipped. Another test suite ran on the
same machine during part of the campaign, so the runs were not on an idle machine.

Limits: Linux only. Windows and macOS repeat runs need the hosted runners or real computers.
