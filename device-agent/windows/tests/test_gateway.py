"""Gateway + real workers, through the official MCP stdio transport (plan.md P05/P06/P09/P16).

The happy path drives the real actor and verifier processes on real files with a
real office engine (LibreOffice here; Excel/Word COM on Windows is UNTESTED).
Fakes are used only to make workers misbehave; they never stand in for output.
"""

import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anyio

from ocade_agent.engine import office_available
from ocade_agent.gateway import PROTOCOL, Gateway
from tests.fixtures import ledger_workbook

TESTS = str(Path(__file__).resolve().parent.parent)
HAS_ENGINE = office_available()  # the product's own discovery, as a customer's computer would use it


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
            for role in ("fs_sandbox", "sys_core", "verifier", "ui_bridge", "web_automation", "shell"):
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
    """Generic primitives on real files: read a workbook, write a computed one and a report,
    then the separate verifier re-reads what was saved. The steps are a test's, not a product route."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        ledger_workbook(self.root / "Q3 ledger.xlsx")
        self.out = "OCADE output/t1"

    def run_all(self, gateway, steps):
        async def go():
            async with gateway:
                return [await gateway.run(step, gateway.epoch) for step in steps]
        return anyio.run(go)

    def checks(self):
        return intent("verify.checks", {"checks": [
            {"id": "net", "description": "net difference", "kind": "workbook_cell_equals",
             "params": {"path": f"{self.out}/r.xlsx", "sheet": "R", "cell": "B4", "value": 31.5}},
            {"id": "wrong", "description": "a value that is not there", "kind": "workbook_cell_equals",
             "params": {"path": f"{self.out}/r.xlsx", "sheet": "R", "cell": "B4", "value": 41.5}},
            {"id": "pdf", "description": "report pdf", "kind": "file_contains",
             "params": {"path": f"{self.out}/r.pdf", "text": "Net difference"}},
        ]})

    @unittest.skipUnless(HAS_ENGINE, "needs a real office engine")
    def test_generic_office_primitives_pass_independent_verification(self):
        original = (self.root / "Q3 ledger.xlsx").read_bytes()
        read, book, report = self.run_all(Gateway(str(self.root)), [
            intent("fs.read_text", {"path": "Q3 ledger.xlsx"}),
            intent("office.write_workbook", {"path": f"{self.out}/r.xlsx", "sheets": [{"name": "R", "rows": [
                ["Ledger", 435.75], ["Bank", 467.25], ["", None], ["Net difference", "=B2-B1"]]}]}),
            intent("office.write_document", {"docx": f"{self.out}/r.docx", "pdf": f"{self.out}/r.pdf", "title": "Q3",
                                             "sections": [{"heading": "Summary", "paragraphs": ["Net difference 31.50"]}]}),
        ])
        for result in (read, book, report):
            self.assertEqual(result["status"], "observed", result)
        self.assertIn("INV-5", read["evidence"]["text"])
        self.assertIn(book["evidence"]["engine"], ("libreoffice", "excel"))
        [verified] = self.run_all(Gateway(str(self.root)), [self.checks()])
        # The formula was recalculated by a real engine: 467.25 - 435.75 = 31.5.
        self.assertEqual(verified["evidence"]["predicates"], {"net": True, "wrong": False, "pdf": True})
        self.assertEqual((self.root / "Q3 ledger.xlsx").read_bytes(), original)

        # The same write again cannot overwrite the deliverable.
        [again] = self.run_all(Gateway(str(self.root)), [intent("office.write_workbook", {
            "path": f"{self.out}/r.xlsx", "sheets": [{"name": "R", "rows": [[1]]}]})])
        self.assertEqual((again["status"], again["errorCode"]), ("not_applied", "output_exists"))

    def test_text_files_are_new_exact_and_verified(self):
        text = "Get-Service | Where-Object Status -eq 'Stopped'\r\nnaïve café — ✓\n"
        script = f"{self.out}/fix.ps1"
        wrote, again, program, outside, verified = self.run_all(Gateway(str(self.root)), [
            intent("fs.write_text", {"path": script, "text": text}),
            intent("fs.write_text", {"path": script, "text": "replaced"}),
            intent("fs.write_text", {"path": f"{self.out}/run.bat", "text": "del /q *"}),
            intent("fs.write_text", {"path": "Q3 ledger.csv", "text": "x"}),
            intent("verify.checks", {"checks": [
                {"id": "has", "description": "script", "kind": "file_contains", "params": {"path": script, "text": "naïve café"}},
                {"id": "not", "description": "absent", "kind": "file_contains", "params": {"path": script, "text": "Remove-Item"}},
                {"id": "case", "description": "case and spacing", "kind": "file_contains",
                 "params": {"path": script, "text": "NAÏVE   CAFÉ"}},
                {"id": "folder", "description": "a folder with files", "kind": "file_exists", "params": {"path": self.out}},
                {"id": "blank", "description": "only spaces", "kind": "file_contains", "params": {"path": script, "text": "   "}},
            ]}),
        ])
        self.assertEqual(wrote["status"], "observed", wrote)
        self.assertTrue(wrote["evidence"]["matches"])
        self.assertEqual((self.root / script).read_bytes(), text.encode("utf-8"))  # line endings kept exactly
        self.assertEqual(again["errorCode"], "output_exists")
        self.assertEqual((self.root / script).read_bytes(), text.encode("utf-8"))
        self.assertEqual(program["errorCode"], "unsupported_file_type")
        self.assertFalse((self.root / f"{self.out}/run.bat").exists())
        self.assertEqual(outside["errorCode"], "invalid_intent")  # originals live outside OCADE output
        self.assertEqual(verified["evidence"]["predicates"],
                         {"has": True, "not": False, "case": True, "folder": True, "blank": False})

    def test_repair_in_place_keeps_the_original_and_never_overwrites_a_newer_edit(self):
        (self.root / "tool.py").write_text("print('broken'\n")
        os.chmod(self.root / "tool.py", 0o755)
        [read] = self.run_all(Gateway(str(self.root)), [intent("fs.read_text", {"path": "tool.py"})])
        fixed = "print('fixed')\n"
        replaced, stale, own, binary = self.run_all(Gateway(str(self.root)), [
            intent("fs.replace_text", {"path": "tool.py", "text": fixed, "expectSha256": read["evidence"]["sha256"]}),
            intent("fs.replace_text", {"path": "tool.py", "text": "x", "expectSha256": read["evidence"]["sha256"]}),
            intent("fs.write_text", {"path": f"{self.out}/note.txt", "text": "mine"}),
            intent("fs.replace_text", {"path": "Q3 ledger.xlsx", "text": "x", "expectSha256": "0" * 64}),
        ])
        self.assertEqual(replaced["status"], "observed", replaced)
        self.assertTrue(replaced["evidence"]["matches"])
        self.assertEqual((self.root / "tool.py").read_text(), fixed)
        self.assertEqual((self.root / replaced["evidence"]["original"]).read_text(), "print('broken'\n")
        self.assertEqual(stale["errorCode"], "file_changed")  # the person's (or JARVIS's) newer version stays
        self.assertEqual((self.root / "tool.py").read_text(), fixed)
        self.assertEqual(binary["errorCode"], "unsupported_file_type")
        [inside] = self.run_all(Gateway(str(self.root)), [intent("fs.replace_text", {
            "path": f"{self.out}/note.txt", "text": "y", "expectSha256": own["evidence"]["sha256"]})])
        self.assertEqual(inside["errorCode"], "write_inside_output")
        if os.name == "posix":
            self.assertEqual(os.stat(self.root / "tool.py").st_mode & 0o777, 0o755)  # mode kept
            self.assertEqual(os.stat(self.root / f"{self.out}/note.txt").st_mode & 0o044, 0o044)  # not 0600

    def test_exact_edits_change_only_what_they_name(self):
        config = '{\n  "column": "total",\n  "output": "amber_summary.txt",\n}\n'
        (self.root / "settings.json").write_bytes(config.encode())  # exact bytes, no Windows newline translation
        (self.root / "run.sh").write_text("#!/bin/sh\necho hi\n")
        os.chmod(self.root / "run.sh", 0o644)
        read, listing = self.run_all(Gateway(str(self.root)), [
            intent("fs.read_text", {"path": "settings.json"}), intent("fs.list", {"path": "."})])
        digest = read["evidence"]["sha256"]
        edited, missing, twice = self.run_all(Gateway(str(self.root)), [
            intent("fs.edit_text", {"path": "settings.json", "expectSha256": digest, "edits": [
                {"find": '"total"', "replace": '"amount_total"'}, {"find": '.txt",\n}', "replace": '.txt"\n}'}]}),
            intent("fs.edit_text", {"path": "settings.json", "expectSha256": digest,
                                    "edits": [{"find": "nowhere", "replace": "x"}]}),
            intent("fs.edit_text", {"path": "settings.json", "expectSha256": digest,
                                    "edits": [{"find": '"', "replace": "'"}]}),
        ])
        self.assertEqual(edited["status"], "observed", edited)
        self.assertEqual(json.loads((self.root / "settings.json").read_text()),
                         {"column": "amount_total", "output": "amber_summary.txt"})  # the output name is untouched
        self.assertEqual(missing["errorCode"], "file_changed")  # the first edit already changed it
        self.assertEqual(twice["errorCode"], "file_changed")
        [fresh] = self.run_all(Gateway(str(self.root)), [intent("fs.read_text", {"path": "settings.json"})])
        nowhere, ambiguous = self.run_all(Gateway(str(self.root)), [
            intent("fs.edit_text", {"path": "settings.json", "expectSha256": fresh["evidence"]["sha256"],
                                    "edits": [{"find": "nowhere", "replace": "x"}]}),
            intent("fs.edit_text", {"path": "settings.json", "expectSha256": fresh["evidence"]["sha256"],
                                    "edits": [{"find": '"', "replace": "'"}]}),
        ])
        self.assertEqual((nowhere["errorCode"], ambiguous["errorCode"]), ("find_not_found", "find_not_unique"))
        if os.name == "posix":
            entries = {e["name"]: e for e in listing["evidence"]["entries"]}
            self.assertFalse(entries["run.sh"]["executable"])

    def test_any_plain_text_file_is_read_and_verified_by_content_not_by_name(self):
        (self.root / "export.sh").write_text("#!/bin/sh\ndate > reports/out.txt\n")
        (self.root / ".env.example").write_text("API_URL=https://api.example.test\n")
        (self.root / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR")
        script, dotfile, binary, verified = self.run_all(Gateway(str(self.root)), [
            intent("fs.read_text", {"path": "export.sh"}),
            intent("fs.read_text", {"path": ".env.example"}),
            intent("fs.read_text", {"path": "logo.png"}),
            intent("verify.checks", {"checks": [
                {"id": "sh", "description": "script", "kind": "file_contains", "params": {"path": "export.sh", "text": "reports/"}},
                {"id": "png", "description": "binary", "kind": "file_contains", "params": {"path": "logo.png", "text": "PNG"}},
            ]}),
        ])
        self.assertIn("reports/out.txt", script["evidence"]["text"])
        self.assertIn("API_URL", dotfile["evidence"]["text"])
        self.assertEqual(binary["errorCode"], "unsupported_file_type")
        self.assertEqual(verified["evidence"]["predicates"]["sh"], True)
        self.assertIsNone(verified["evidence"]["predicates"].get("png"))  # not observable, never a guess

    def test_system_facts_and_programs_are_read_without_running_them(self):
        import sys as _sys

        [facts] = self.run_all(Gateway(str(self.root)), [
            intent("system.inspect", {"programs": [Path(_sys.executable).name, "ocade-no-such-program-x9"]})])
        self.assertEqual(facts["status"], "observed", facts)
        evidence = facts["evidence"]
        self.assertGreater(evidence["freeBytes"], 0)
        self.assertTrue(evidence["machine"])
        self.assertTrue(evidence["programs"][Path(_sys.executable).name]["path"])
        self.assertIsNone(evidence["programs"]["ocade-no-such-program-x9"]["path"])

    def test_repairs_are_checked_by_parsing_never_by_running(self):
        files = {"good.json": '{"a": 1}', "bad.json": '{"a": 1,}', "good.py": "print('x')\n",
                 "bad.py": "def f(:\n", "run.py": "open('ran.txt', 'w').write('ran')\n",
                 "good.csv": "a,b\n1,2\n", "ragged.csv": "a,b\n1,2,3\n", "conf.toml": "x = 1\n", "notes.md": "# hi\n"}
        for name, text in files.items():
            (self.root / name).write_text(text)
        [verified] = self.run_all(Gateway(str(self.root)), [intent("verify.checks", {"checks": [
            {"id": name.replace(".", "_"), "description": name, "kind": "file_parses", "params": {"path": name}}
            for name in files]})])
        self.assertEqual(verified["evidence"]["predicates"], {
            "good_json": True, "bad_json": False, "good_py": True, "bad_py": False, "run_py": True,
            "good_csv": True, "ragged_csv": False, "conf_toml": True, "notes_md": None})
        self.assertIn("SyntaxError", verified["evidence"]["measured"]["bad_py"]["error"])  # why, for the repair
        self.assertFalse((self.root / "ran.txt").exists(), "parsing a script never runs it")

    def test_missing_outputs_are_not_passed(self):
        [verified] = self.run_all(Gateway(str(self.root)), [self.checks()])
        self.assertEqual(verified["evidence"]["predicates"], {"net": False, "wrong": False, "pdf": False})


class Multiplexing(unittest.TestCase):
    def test_concurrent_calls_to_different_workers_keep_their_own_answers(self):
        from PIL import Image

        root = Path(tempfile.mkdtemp())
        for index in range(4):
            Image.new("RGB", (100 + index, 50), (index * 40, 0, 0)).save(root / f"img{index}.png")

        async def go():
            results = {}
            async with Gateway(str(root)) as gateway:
                async with anyio.create_task_group() as group:
                    for index in range(4):
                        async def inspect(i=index):
                            results[f"media{i}"] = await gateway.run(
                                intent("media.inspect", {"path": f"img{i}.png"}), gateway.epoch)

                        async def listing(i=index):
                            results[f"list{i}"] = await gateway.run(intent("fs.list", {}), gateway.epoch)

                        group.start_soon(inspect)
                        group.start_soon(listing)
            return results

        results = anyio.run(go)
        for index in range(4):
            self.assertEqual(results[f"media{index}"]["evidence"]["width"], 100 + index)  # its own file, not another's
            self.assertEqual(len(results[f"list{index}"]["evidence"]["entries"]), 4)


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
        step = intent("office.write_workbook", {"path": "OCADE output/x.xlsx", "sheets": [{"name": "S", "rows": [[1]]}]})
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

    def test_a_receipt_always_fits_what_the_server_stores(self):
        result = self.one(intent("office.inspect_workbook", {"path": "book.xlsx"}), self.fake("big_preview"))
        self.assertEqual(result["status"], "observed", result)
        self.assertNotIn("preview", result)  # left out, so the receipt can still be recorded
        self.assertLess(len(json.dumps(result)), 60_000)

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
