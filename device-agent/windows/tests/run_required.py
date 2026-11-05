"""Run companion tests, failing on missing tests and unexpected skips (plan.md 196).

    python -m tests.run_required "needs a Windows desktop" ...
    python -m tests.run_required --tests tests.test_effect_scope

Positional arguments are exact skip reasons allowed on this platform. Selected
tests permit no skips unless a reason is explicitly supplied.
"""

import argparse
import sys
import unittest


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
    loader = unittest.TestLoader()
    suite = (loader.loadTestsFromNames(args.tests) if args.tests
             else loader.discover("tests", top_level_dir="."))
    return run_required(suite, args.allowed)


if __name__ == "__main__":
    sys.exit(main())
