"""Regression controls for the shared required-test gate."""

import io
import unittest

from tests.run_required import run_required


class RequiredRunner(unittest.TestCase):
    def check_suite(self, suite, allowed=()):
        output = io.StringIO()
        status = run_required(suite, allowed, output)
        return status, output.getvalue()

    def test_added_tests_need_no_count_pin(self):
        for count in (1, 3):
            suite = unittest.TestSuite(unittest.FunctionTestCase(lambda: None) for _ in range(count))
            self.assertEqual(self.check_suite(suite)[0], 0)

    def test_empty_suite_fails(self):
        status, output = self.check_suite(unittest.TestSuite())
        self.assertEqual(status, 1)
        self.assertIn("REQUIRED TESTS MISSING", output)

    def test_missing_named_test_fails(self):
        suite = unittest.TestLoader().loadTestsFromName("tests.no_such_required_module")
        self.assertEqual(self.check_suite(suite)[0], 1)

    def test_unexpected_skip_fails_and_exact_allowed_reason_passes(self):
        def skip():
            raise unittest.SkipTest("missing prerequisite")
        for allowed, expected in (((), 1), (("missing",), 1), (("missing prerequisite",), 0)):
            suite = unittest.TestSuite([unittest.FunctionTestCase(skip)])
            self.assertEqual(self.check_suite(suite, allowed)[0], expected)

    def test_failed_test_still_fails(self):
        def fail():
            self.fail("synthetic regression")
        self.assertEqual(self.check_suite(unittest.TestSuite([unittest.FunctionTestCase(fail)]))[0], 1)

    def test_suite_that_does_not_execute_its_loaded_tests_fails(self):
        class IncompleteSuite(unittest.TestSuite):
            def run(self, result, debug=False):
                return result
        status, output = self.check_suite(IncompleteSuite([unittest.FunctionTestCase(lambda: None)]))
        self.assertEqual(status, 1)
        self.assertIn("loaded 1, ran 0", output)


if __name__ == "__main__":
    unittest.main()
