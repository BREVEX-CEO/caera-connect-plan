#!/usr/bin/env python3
"""VERIFY-07: is the independent verifier stable on controlled fixtures?

Runs the verifier's own test modules (real files, real workers, fixture pages) N times, each in a
fresh interpreter, and records every test's outcome per run. A test whose outcome differs between
runs is a flake: the verifier's verdict on it cannot be treated as definitive. Exit 1 when any test
flaked or any run failed, so a single green run never stands in for stable proof.

  python3 scripts/verifier-flake.py [--runs 10] [--out evidence/<folder>/verifier-flake.json]

Run from the repository root with the companion's requirements installed (as in CI).
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

MODULES = ["tests.test_verify_kinds", "tests.test_verify_web"]
# Prints one line per test: "<id> <outcome>", for a fresh interpreter to report to this parent.
PROBE = r"""
import sys, unittest
class R(unittest.TextTestResult):
    def addSuccess(self, t): super().addSuccess(t); print("@@", t.id(), "pass", flush=True)
    def addFailure(self, t, e): super().addFailure(t, e); print("@@", t.id(), "fail", flush=True)
    def addError(self, t, e): super().addError(t, e); print("@@", t.id(), "error", flush=True)
    def addSkip(self, t, r): super().addSkip(t, r); print("@@", t.id(), "skip", flush=True)
suite = unittest.defaultTestLoader.loadTestsFromNames(sys.argv[1:])
unittest.TextTestRunner(resultclass=R, stream=open("/dev/null" if sys.platform != "win32" else "NUL", "w")).run(suite)
"""


def one_run(cwd: Path) -> dict[str, str]:
    done = subprocess.run([sys.executable, "-c", PROBE, *MODULES], cwd=cwd, capture_output=True, text=True,
                          env=os.environ | {"PYTHONDONTWRITEBYTECODE": "1"})
    outcomes = {}
    for line in done.stdout.splitlines():
        if line.startswith("@@ "):
            _, test, outcome = line.split(" ")
            outcomes[test] = outcome
    if not outcomes:
        raise SystemExit(f"no test ran:\n{done.stderr[-2000:]}")
    return outcomes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--out")
    args = parser.parse_args()
    cwd = Path(__file__).resolve().parent.parent / "device-agent" / "windows"
    runs, started = [], time.time()
    for index in range(args.runs):
        runs.append(one_run(cwd))
        print(f"run {index + 1}/{args.runs}: {sum(o == 'pass' for o in runs[-1].values())} pass", flush=True)
    tests = sorted(set().union(*runs))
    per_test = {t: sorted({run.get(t, "missing") for run in runs}) for t in tests}
    flaky = {t: o for t, o in per_test.items() if len(o) > 1}
    failing = {t: o for t, o in per_test.items() if len(o) == 1 and o[0] in ("fail", "error", "missing")}
    report = {
        "runs": args.runs, "tests": len(tests), "seconds": round(time.time() - started, 1),
        "flaky": flaky, "flakeRate": round(len(flaky) / len(tests), 4), "alwaysFailing": failing,
        "alwaysSkipped": sorted(t for t, o in per_test.items() if o == ["skip"]),
        "python": sys.version.split()[0], "platform": sys.platform,
    }
    text = json.dumps(report, indent=2)
    print(text)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(text + "\n")
    return 1 if flaky or failing else 0


if __name__ == "__main__":
    sys.exit(main())
