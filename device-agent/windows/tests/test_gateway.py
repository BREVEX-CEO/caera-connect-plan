"""Gateway + real workers, through the official MCP stdio transport (plan.md P05/P06/P09/P16).

The happy path drives the real actor and verifier processes on real files with a
real office engine (LibreOffice here; Excel/Word COM on Windows is UNTESTED).
Fakes are used only to make workers misbehave; they never stand in for output.
"""

import shutil
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anyio
import openpyxl

from ocade_agent.gateway import PROTOCOL, Gateway
from tests.fixtures import ledger_workbook

TESTS = str(Path(__file__).resolve().parent.parent)
HAS_ENGINE = bool(shutil.which("soffice") or shutil.which("libreoffice"))


def intent(operation, arguments, minutes=10, **overrides):
    spec = PROTOCOL["operations"][operation]
    value = {
        "v": 1, "key": operation, "operation": operation, "capability": spec["capability"],
        "risk": spec["risk"], "arguments": arguments,
        "deadlineUtc": (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat().replace("+00:00", "Z"),
    }
    value.update(overrides)
    return value


class PackagingContract(unittest.TestCase):
    def test_frozen_worker_dispatch_uses_module_not_role(self):
        """Frozen Windows launch must pass a valid agent worker MODULE, not registry role."""
        import sys
        from unittest.mock import patch

        gateway = Gateway("sandbox")
        with patch.object(sys, "frozen", True, create=True), patch.object(sys, "executable", "C:/OCADE/ocade-agent-bg.exe"):
            for role in ("fs_sandbox", "sys_core", "verifier", "ui_bridge", "web_automation"):
                params = gateway._parameters(role)
                self.assertEqual(params.args, ["worker", gateway.modules[role]])
                self.assertTrue(params.command.endswith("ocade-agent.exe"))

    def test_observed_gateway_action_reports_monotonic_duration(self):
        """The duration field is per-action evidence, not fabricated end-to-end timing."""
        root = Path(tempfile.mkdtemp())
        async def run():
            async with Gateway(str(root)) as gateway:
                return await gateway.run(intent("fs.list", {"path": "."}), gateway.epoch)
        result = anyio.run(run)
        self.assertEqual(result["status"], "observed", result)
        self.assertIsInstance(result["evidence"]["durationMs"], (int, float))
        self.assertGreaterEqual(result["evidence"]["durationMs"], 0)


class Journey(unittest.TestCase):
    """Workbook -> reconciliation -> Word + PDF -> independent verification."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.case = ledger_workbook(self.root / "Q3 ledger.xlsx")
        self.out = "OCADE output/t1"

    def run_all(self, gateway, steps):
        async def go():
            async with gateway:
                return [await gateway.run(step, gateway.epoch) for step in steps]
        return anyio.run(go)

    def actor_steps(self):
        return [
            intent("office.inspect_workbook", {"path": "Q3 ledger.xlsx"}),
            intent("office.reconcile_workbook", {"source": "Q3 ledger.xlsx", "left": self.case["left"],
                                                  "right": self.case["right"], "output": f"{self.out}/r.xlsx"}),
            intent("office.write_report", {"workbook": f"{self.out}/r.xlsx", "docx": f"{self.out}/r.docx",
                                           "pdf": f"{self.out}/r.pdf", "title": "Q3 reconciliation"}),
        ]

    def verify_step(self, source_sha):
        return intent("verify.reconciliation_report", {
            "source": "Q3 ledger.xlsx", "sourceSha256": source_sha, "left": self.case["left"],
            "right": self.case["right"], "workbook": f"{self.out}/r.xlsx", "docx": f"{self.out}/r.docx",
            "pdf": f"{self.out}/r.pdf"})

    @unittest.skipUnless(HAS_ENGINE, "needs a real office engine")
    def test_real_journey_passes_independent_verification(self):
        original = (self.root / "Q3 ledger.xlsx").read_bytes()
        inspect, reconcile, report = self.run_all(Gateway(str(self.root)), self.actor_steps())
        for result in (inspect, reconcile, report):
            self.assertEqual(result["status"], "observed", result)
        self.assertEqual(reconcile["evidence"]["rows"], 5)
        self.assertEqual(report["evidence"]["exceptions"], 3)
        self.assertIn(reconcile["evidence"]["engine"], ("libreoffice", "excel"))

        [verified] = self.run_all(Gateway(str(self.root)), [self.verify_step(inspect["evidence"]["sha256"])])
        self.assertEqual(verified["status"], "observed", verified)
        self.assertEqual(verified["evidence"]["predicates"], {
            "original_unchanged": True, "rows_accounted": True, "totals_reconcile": True,
            "formulas_recalculated": True, "report_docx_sections": True, "report_pdf_renders": True})
        self.assertEqual(verified["evidence"]["sha256"]["workbook"], reconcile["evidence"]["sha256"])
        self.assertEqual((self.root / "Q3 ledger.xlsx").read_bytes(), original)

        # Running the same write again cannot overwrite the deliverable.
        [again] = self.run_all(Gateway(str(self.root)), [self.actor_steps()[1]])
        self.assertEqual((again["status"], again["errorCode"]), ("not_applied", "output_exists"))

        # Tampering after the fact is caught by the verifier, not trusted from the actor.
        book = openpyxl.load_workbook(self.root / self.out / "r.xlsx")
        sheet = book["Reconciliation"]
        sheet.cell(sheet.max_row, 4).value = 0  # a pasted number replaces the total formula
        book.save(self.root / self.out / "r.xlsx")
        with open(self.root / "Q3 ledger.xlsx", "ab") as stream:
            stream.write(b"\0")
        [tampered] = self.run_all(Gateway(str(self.root)), [self.verify_step(inspect["evidence"]["sha256"])])
        predicates = tampered["evidence"]["predicates"]
        self.assertFalse(predicates["original_unchanged"])
        self.assertFalse(predicates["totals_reconcile"])
        self.assertFalse(predicates["formulas_recalculated"])

    def test_missing_outputs_are_unverified_not_passed(self):
        [verified] = self.run_all(Gateway(str(self.root)), [self.verify_step("0" * 64)])
        predicates = verified["evidence"]["predicates"]
        self.assertFalse(predicates["original_unchanged"])
        for name in ("rows_accounted", "totals_reconcile", "report_docx_sections", "report_pdf_renders"):
            self.assertIsNone(predicates[name], name)


class Refusals(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        ledger_workbook(self.root / "book.xlsx")

    def one(self, step, gateway=None, epoch=None):
        gateway = gateway or Gateway(str(self.root))

        async def go():
            async with gateway:
                return await gateway.run(step, gateway.epoch if epoch is None else epoch)
        return anyio.run(go)

    def test_invalid_intents_never_reach_a_worker(self):
        cases = {
            "unknown operation": {**intent("fs.list", {}), "operation": "sys.run_shell"},
            "raised risk": intent("office.inspect_workbook", {"path": "book.xlsx"}, risk="reversible_write"),
            "other capability": intent("fs.list", {}, capability="terminal"),
            "extra argument": intent("office.inspect_workbook", {"path": "book.xlsx", "command": "del *"}),
            "wrong protocol": intent("fs.list", {}, v=2),
        }
        for name, step in cases.items():
            with self.subTest(name):
                self.assertEqual(self.one(step)["errorCode"], "invalid_intent")
        self.assertEqual(self.one(intent("fs.list", {}, minutes=-1))["errorCode"], "deadline_passed")

    def test_stop_epoch_fences_dispatch(self):
        gateway = Gateway(str(self.root))
        gateway.stop()
        self.assertEqual(self.one(intent("fs.list", {}), gateway, epoch=0)["errorCode"], "stopped")

    def test_outside_paths_are_refused_by_the_worker(self):
        result = self.one(intent("office.inspect_workbook", {"path": "../etc/passwd.xlsx"}))
        self.assertEqual((result["status"], result["errorCode"]), ("not_applied", "path_outside_workspace"))

    def fake(self, mode):
        (self.root / ".fake_mode").write_text(mode)
        modules = {"fs_sandbox": "tests.fake_worker", "sys_core": "tests.fake_worker", "verifier": "ocade_agent.verify_worker"}
        return Gateway(str(self.root), modules, extra_path=TESTS)

    def test_worker_offering_an_unlisted_tool_is_rejected(self):
        result = self.one(intent("fs.list", {}), self.fake("extra_tool"))
        self.assertEqual(result["errorCode"], "worker_rejected")

    def test_worker_dying_mid_write_is_unknown_and_maybe_changed(self):
        step = intent("office.reconcile_workbook", {"source": "book.xlsx", "left": {"sheet": "a", "key": "b", "amount": "c"},
                                                    "right": {"sheet": "a", "key": "b", "amount": "c"}, "output": "OCADE output/x.xlsx"})
        result = self.one(step, self.fake("crash"))
        self.assertEqual((result["status"], result["maybeChanged"]), ("unknown", True))
        read = self.one(intent("office.inspect_workbook", {"path": "book.xlsx"}), self.fake("crash"))
        self.assertEqual((read["status"], read["maybeChanged"]), ("not_applied", False))

    def test_hung_worker_times_out_at_the_deadline(self):
        step = intent("office.inspect_workbook", {"path": "book.xlsx"}, minutes=0.05)
        started = datetime.now()
        result = self.one(step, self.fake("hang"))
        self.assertLess((datetime.now() - started).total_seconds(), 20)
        self.assertEqual((result["status"], result["errorCode"]), ("not_applied", "timeout"))

    def test_a_long_call_within_its_bound_is_not_reported_lost(self):
        result = self.one(intent("office.inspect_workbook", {"path": "book.xlsx"}), self.fake("slow"))
        self.assertEqual(result["status"], "observed", result)
        self.assertGreater(result["evidence"]["durationMs"], 33_000)

    def test_stdout_noise_does_not_become_a_result(self):
        result = self.one(intent("fs.list", {}), self.fake("stdout_noise"))
        self.assertIn(result["status"], ("observed", "not_applied"))
        self.assertNotIn("not a protocol frame", str(result))


if __name__ == "__main__":
    unittest.main()
