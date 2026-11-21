"""Run companion tests, failing on missing tests and unexpected skips (plan.md 196).

    python -m tests.run_required "needs a Windows desktop" ...
    python -m tests.run_required --tests tests.test_effect_scope

Positional arguments are exact skip reasons allowed on this platform. Selected
tests permit no skips unless a reason is explicitly supplied.
"""

import argparse
import faulthandler
import logging
import re
import sys
import unittest

# A hung suite fails with every thread's stack instead of running into the job's timeout.
HANG_SECONDS = 1500


class _AbandonedWorker(logging.Handler):
    """Names what a worker that survived the SDK's kill is doing (the hosted windows-2022 hang)."""

    def emit(self, record):
        found = re.search(r"process (\d+) is still alive", record.getMessage())
        if not found:
            return
        try:
            import psutil

            process = psutil.Process(int(found.group(1)))
            facts = process.as_dict(["name", "status", "cmdline", "num_threads", "ppid", "create_time"])
            facts["children"] = [(c.pid, c.name(), c.status()) for c in process.children(recursive=True)]
        except Exception as error:  # noqa: BLE001 - evidence only; the test still fails on its own
            facts = {"unavailable": repr(error)}
        print(f"OCADE_ABANDONED_WORKER:{facts}", file=sys.stderr, flush=True)


def run_required(suite, allowed=(), stream=None):
    """Count the loaded suite independently before execution; never pin its size."""
    expected = suite.countTestCases()
    result = unittest.TextTestRunner(verbosity=2, stream=stream).run(suite)
    unexpected = sorted({reason for _, reason in result.skipped} - set(allowed))
    for reason in unexpected:
        print(f"REQUIRED TEST SKIPPED: {reason}", file=stream or sys.stderr)
    if expected == 0 or result.testsRun != expected:
        print(f"REQUIRED TESTS MISSING: loaded {expected}, ran {result.testsRun}",
              file=stream or sys.stderr)
    return 0 if result.wasSuccessful() and expected > 0 and result.testsRun == expected and not unexpected else 1


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("allowed", nargs="*", help="exact allowed skip reasons")
    parser.add_argument("--tests", action="append", help="required test module, class or method; repeatable")
    args = parser.parse_args(argv)
    faulthandler.dump_traceback_later(HANG_SECONDS, exit=True)
    logging.getLogger("mcp.client.stdio").addHandler(_AbandonedWorker())
    loader = unittest.TestLoader()
    suite = (loader.loadTestsFromNames(args.tests) if args.tests
             else loader.discover("tests", top_level_dir="."))
    return run_required(suite, args.allowed)


if __name__ == "__main__":
    sys.exit(main())
