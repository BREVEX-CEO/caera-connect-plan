"""Run the companion suite and fail on any skip not allowed for this OS (plan.md 196).

    python -m tests.run_required "needs a Windows desktop" ...

Each argument is a skip reason this platform may report; anything else skipped means a
required prerequisite is missing, and the gate fails instead of passing quietly.
"""

import sys
import unittest

allowed = set(sys.argv[1:])
result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover("tests", top_level_dir="."))
unexpected = sorted({reason for _, reason in result.skipped} - allowed)
for reason in unexpected:
    print(f"REQUIRED TEST SKIPPED: {reason}", file=sys.stderr)
sys.exit(0 if result.wasSuccessful() and not unexpected else 1)
