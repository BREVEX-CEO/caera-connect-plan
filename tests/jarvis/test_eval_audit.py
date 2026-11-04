"""Evaluation bookkeeping must not confuse a repaired choice with the first choice."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("live_eval", Path(__file__).with_name("live_eval.py"))
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)


class EvaluationAudit(unittest.TestCase):
    def test_wrong_then_right_download_keeps_both_actual_choices(self):
        live = {"decisions": [
            {"intent": {"operation": "web.download"}, "receipt": {"evidence": {"suggested": "old.zip"}}},
            {"intent": {"operation": "web.download"}, "receipt": {"evidence": {"suggested": "new.zip"}}},
            {"intent": {"operation": "web.read"}, "receipt": {"evidence": {"suggested": "new.zip"}}},
            {"intent": {"operation": "web.download"}, "receipt": {"errorCode": "selector_not_found"}},
        ]}
        before = json.dumps(live)
        selections = evaluation.target_selections(live, "new.zip")
        self.assertEqual([s["correct"] for s in selections], [False, True, None])
        self.assertEqual([s["selected"] for s in selections], ["old.zip", "new.zip", None])
        self.assertEqual(json.dumps(live), before, "hidden expected targets must not enter the model report")

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


if __name__ == "__main__":
    unittest.main()
