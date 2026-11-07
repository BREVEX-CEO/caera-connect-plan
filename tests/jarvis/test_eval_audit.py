"""Evaluation bookkeeping must not confuse a repaired choice with the first choice."""

import importlib.util
import json
import io
import os
import random
import ssl
import sys
import urllib.error
import urllib.request
import zipfile
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("live_eval", Path(__file__).with_name("live_eval.py"))
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)


class EvaluationAudit(unittest.TestCase):
    def test_wrong_then_right_download_keeps_both_actual_choices(self):
        requests = ["/files/old.zip", "/files/new.zip", None]
        before = json.dumps(requests)
        selections = evaluation.target_selections(requests, "/files/new.zip")
        self.assertEqual([s["correct"] for s in selections], [False, True, None])
        self.assertEqual([s["selected"] for s in selections], ["/files/old.zip", "/files/new.zip", None])
        self.assertEqual(json.dumps(requests), before, "hidden expected targets must not enter observed requests")

    def test_each_checkpoint_is_a_complete_honest_partial_denominator(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary)
            rows = [{"pass": True, "category": "pass", "targetSelections": []}]
            evaluation.write_summary(out, 22, rows, "commit-under-test")
            first = json.loads((out / "summary.json").read_text())
            self.assertEqual((first["passed"], first["total"]), (1, 1))
            rows.append({"pass": False, "category": "gave_up", "targetSelections": [{"correct": False}]})
            evaluation.write_summary(out, 22, rows, "commit-under-test")
            second = json.loads((out / "summary.json").read_text())
            self.assertEqual((second["passed"], second["total"]), (1, 2))
            self.assertEqual(second["targetSelection"], {"observed": 1, "correct": 0, "unobservable": 0})
            self.assertEqual(second["commit"], "commit-under-test")


    def test_campaign_measures_are_percentiles_of_what_was_measured(self):
        rows = [{"pass": n < 8, "recoverySteps": 1 if n == 7 else 0, "elapsedMs": (n + 1) * 1000,
                 "modelCalls": n % 3 + 1, "plannerAutoRetries": 1 if n == 0 else 0, "interventions": n % 2,
                 "providerUsage": {"inputTokens": 100, "outputTokens": 10},
                 "targetSelections": [{"correct": n != 9}]} for n in range(10)]
        rows.append({"pass": False, "elapsedMs": None, "targetSelections": []})  # not measured
        result = evaluation.measures(rows)
        self.assertEqual(result["elapsedMs"], {"p50": 5000, "p95": 10000, "p99": 10000, "measured": 10})
        self.assertEqual(result["modelCallsPerTask"]["p50"], 2)
        self.assertEqual((result["plannerRetries"], result["wrongTargetIncidents"]), (1, 1))
        self.assertEqual(result["tokens"], {"input": 1000, "output": 100})
        self.assertEqual((result["verifiedSuccessRate"], result["firstAttemptSuccessRate"]), (round(8 / 11, 3), round(7 / 11, 3)))
        self.assertIsNone(evaluation.percentile([None, "x"], 50))

    def test_pass_requires_authority_proof_and_an_independent_clean_result(self):
        live = {"status": "completed", "checks": [{"id": "a", "state": "passed"}],
                "timing": {"verifiedAt": "2026-01-01T00:00:00Z"},
                "decisions": [{"status": "failed"}, {"status": "done"}]}
        self.assertTrue(evaluation.verified_outcome(live, True, [], []))
        self.assertFalse(evaluation.verified_outcome(live, False, [], []))
        self.assertFalse(evaluation.verified_outcome(live, True, ["source.txt"], []))
        self.assertFalse(evaluation.verified_outcome(live, True, [], [{"correct": False}]))
        self.assertFalse(evaluation.verified_outcome({**live, "status": "running"}, True, [], []))
        self.assertFalse(evaluation.verified_outcome({**live, "checks": []}, True, [], []))
        self.assertEqual(evaluation.recovery_steps(live), 1)

    def test_oracle_observes_live_output_before_teardown_without_sharing_answers(self):
        with tempfile.TemporaryDirectory() as temporary:
            ws = Path(temporary)
            source = r"""
import pathlib, sys, time
checkpoint = pathlib.Path(sys.argv[sys.argv.index('--oracle-checkpoint') + 1])
workspace = pathlib.Path(sys.argv[1])
(workspace / 'alive').write_text('running')
checkpoint.write_text('ready')
while not checkpoint.with_suffix('.done').exists():
    time.sleep(0.01)
(workspace / 'alive').unlink()
"""
            seen = []
            def oracle(workspace):
                seen.append((workspace / "alive").read_text())
                return True, "independently read"
            result = evaluation.run_with_oracle(
                [sys.executable, "-c", source, str(ws)], ws, oracle, evaluation.public_environment(), timeout=10)
            self.assertEqual(result, (True, "independently read"))
            self.assertEqual(seen, ["running"])
            self.assertFalse((ws / "alive").exists())

    def test_missing_checkpoint_cannot_fall_back_to_a_post_stop_oracle(self):
        with tempfile.TemporaryDirectory() as temporary:
            called = []
            result = evaluation.run_with_oracle(
                [sys.executable, "-c", "pass"], Path(temporary),
                lambda workspace: called.append(workspace), evaluation.public_environment(), timeout=10)
            self.assertFalse(result[0])
            self.assertIn("pre-STOP checkpoint", result[1])
            self.assertEqual(called, [])

    def test_release_fixture_serves_real_archives_and_a_checked_transport_ca(self):
        from unittest.mock import patch

        with tempfile.TemporaryDirectory() as temporary, patch.dict(os.environ, {
            "OCADE_BROWSER_EXECUTABLE": sys.executable,
        }):
            workspace = Path(temporary)
            request, grants, oracle = evaluation.release_pick(workspace, random.Random(73))
            try:
                base = request.split("from ", 1)[1].split(" into ", 1)[0]
                context = ssl.create_default_context(cafile=os.environ["NODE_EXTRA_CA_CERTS"])
                response = urllib.request.urlopen(base, context=context, timeout=5)
                with response:
                    page = response.read().decode()
                self.assertIn("Download", page)
                self.assertEqual(oracle.target_requests(), [])
                with self.assertRaises(urllib.error.HTTPError):
                    urllib.request.urlopen(base + "files/unobserved.zip", context=context, timeout=5)
                with urllib.request.urlopen(base + "files/" + oracle.target_name, context=context, timeout=5) as archive:
                    data = archive.read()
                self.assertEqual([entry["correct"] for entry in oracle.target_requests()], [False, True])
                with zipfile.ZipFile(io.BytesIO(data)) as parsed:
                    self.assertIsNone(parsed.testzip())
                    self.assertTrue(parsed.read("release.txt").strip())
                self.assertFalse(oracle(workspace)[0], "untouched fixture must fail")
                (workspace / oracle.target_name).write_bytes(data)
                self.assertTrue(oracle(workspace)[0])
                self.assertEqual(grants, ["browser", "site:127.0.0.1"])
            finally:
                oracle.cleanup()


if __name__ == "__main__":
    unittest.main()
