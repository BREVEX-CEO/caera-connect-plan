"""A short run of the stability harness (191) on every gate, and its detectors' own checks."""

import unittest

from tests import stability


class Stability(unittest.TestCase):
    def test_a_short_run_is_steady_and_leaves_no_workers(self):
        report = stability.run(cycles=12)
        self.assertEqual(report["cycles"], 12, report)
        self.assertEqual(report["problems"], [], report)
        self.assertEqual(report["orphanWorkers"], [])
        self.assertGreater(report["last"]["children"], 0, "the workers were really running")

    def test_growth_is_measured_as_a_trend_not_a_single_jump(self):
        self.assertAlmostEqual(stability._slope([10, 20, 30, 40]), 10.0)
        self.assertAlmostEqual(stability._slope([10, 10, 10, 10]), 0.0)
        self.assertLess(abs(stability._slope([10, 90, 10, 10, 10, 10, 10, 10])), 10)


if __name__ == "__main__":
    unittest.main()
