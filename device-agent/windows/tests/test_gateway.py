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
        with (patch.object(sys, "platform", "win32"), patch.object(sys, "frozen", True, create=True),
              patch.object(sys, "executable", "C:/OCADE/ocade-agent-bg.exe")):
            # Exactly as run() calls it: the worker key is the role's module (the old test passed
            # roles, which hid that the installed companion could start no worker at all).
            for role in ("fs_sandbox", "sys_core", "verifier", "ui_bridge", "web_automation", "shell"):
                key = gateway._target({"operation": next(o for o, s in PROTOCOL["operations"].items()
                                                         if s["role"] == role), "arguments": {}},
                                      {"role": role})[0]
                params = gateway._parameters(key)
                self.assertEqual(params.args, ["worker", gateway.modules[role]])
                self.assertTrue(params.command.endswith("ocade-agent.exe"))


    def test_frozen_macos_dispatch_uses_the_bundle_executable(self):
        import sys
        from unittest.mock import patch

        gateway = Gateway("sandbox")
        executable = "/Applications/OCADE JARVIS.app/Contents/MacOS/ocade-agent"
        with (patch.object(sys, "platform", "darwin"), patch.object(sys, "frozen", True, create=True),
              patch.object(sys, "executable", executable)):
            params = gateway._parameters(gateway.modules["verifier"])
            self.assertEqual(params.command, executable)
            self.assertEqual(params.args, ["worker", gateway.modules["verifier"]])

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

    def test_prewarmed_workers_spare_the_first_step_its_start_up(self):
        """Started with the gateway (W2): the first file step does not pay worker start-up."""
        root = Path(tempfile.mkdtemp())

        async def first_step(prewarm):
            async with Gateway(str(root)) as gateway:
                if prewarm:
                    gateway.prewarm()
                    await gateway._workers["ocade_agent.office_worker"]["started"].wait()
                result = await gateway.run(intent("fs.list", {"path": "."}), gateway.epoch)
                return result["evidence"]["durationMs"], sorted(gateway._workers)

        cold, _ = anyio.run(first_step, False)
        warm, started = anyio.run(first_step, True)
        self.assertIn("ocade_agent.verify_worker", started)
        self.assertIn("ocade_agent.command_worker", started)
        self.assertLess(warm, cold / 2, (warm, cold))


class Journey(unittest.TestCase):
    """Generic primitives on real files: read a workbook, write a computed one and a report,
    then the separate verifier re-reads what was saved. The steps are a test's, not a product route."""

    def test_document_destinations_must_be_distinct_before_any_publication(self):
        """A valid-shaped duplicate destination must not leave a hidden partial DOCX."""
        import uuid
        output = "OCADE output/" + uuid.uuid4().hex + ".docx"
        async def run():
            async with Gateway(str(self.root)) as gateway:
                return await gateway.run(intent("office.write_document", {
                    "docx": output, "pdf": output, "title": "Synthetic alias check",
                    "sections": [{"heading": "A new document", "paragraphs": ["independent fixture"]}],
                }), gateway.epoch)
        receipt = anyio.run(run)
        self.assertFalse((self.root / output).exists(), "preflight must reject aliased outputs before publishing")
        self.assertEqual(receipt["status"], "not_applied", receipt)
        self.assertFalse(receipt["maybeChanged"], receipt)

    def test_a_refusal_before_writing_cannot_claim_a_possible_effect(self):
        async def run():
            async with Gateway(str(self.root)) as gateway:
                return await gateway.run(intent("fs.write_text", {"path": "OCADE output/../outside.txt", "text": "synthetic"}), gateway.epoch)
        receipt = anyio.run(run)
        self.assertEqual(receipt["status"], "not_applied", receipt)
        self.assertFalse(receipt["maybeChanged"], receipt)

    def test_verifier_preserves_workbook_scalar_types(self):
        """A boolean or text cell cannot prove a requested numeric result."""
        import uuid
        from openpyxl import Workbook

        filename = uuid.uuid4().hex + ".xlsx"
        book = Workbook()
        sheet = book.active
        sheet.title = "Values"
        for row in ((True,), (False,), ("1",), (1,), (1.003,)):
            sheet.append(row)
        book.save(self.root / filename)
        book.close()
        cases = [
            ("boolean_one", "A1", 1, False),
            ("boolean_zero", "A2", 0, False),
            ("text_is_not_number", "A3", 1, False),
            ("number_is_not_text", "A4", "1", False),
            ("exact_number", "A4", 1, True),
            ("exact_text", "A3", "1", True),
            ("numeric_tolerance", "A5", 1, True),
        ]
        checks = [
            {"id": key, "description": "The cell has the requested scalar value",
             "kind": "workbook_cell_equals",
             "params": {"path": filename, "sheet": "Values", "cell": cell, "value": expected}}
            for key, cell, expected, _ in cases
        ]
        async def run():
            async with Gateway(str(self.root)) as gateway:
                return await gateway.run(intent("verify.checks", {"checks": checks}), gateway.epoch)
        receipt = anyio.run(run)
        self.assertEqual(receipt["status"], "observed", receipt)
        for key, _, _, expected in cases:
            with self.subTest(case=key):
                self.assertEqual(receipt["evidence"]["predicates"][key], expected, receipt)

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

    def test_duplicate_verifier_ids_cannot_erase_a_failed_check(self):
        existing = os.urandom(8).hex() + ".txt"
        (self.root / existing).write_text("real file", encoding="utf-8")
        checks = [
            {"id": "same", "description": "absent", "kind": "file_exists",
             "params": {"path": os.urandom(8).hex() + ".txt"}},
            {"id": "same", "description": "present", "kind": "file_exists",
             "params": {"path": existing}},
        ]
        [result] = self.run_all(Gateway(str(self.root)), [intent("verify.checks", {"checks": checks})])
        self.assertEqual((result["status"], result.get("errorCode")), ("not_applied", "invalid_checks"))

    def test_repeated_repairs_keep_distinct_exact_originals(self):
        from unittest.mock import patch
        from ocade_agent import office_worker
        from ocade_agent.sandbox import sha256

        name = os.urandom(8).hex() + ".txt"
        target = self.root / name
        target.write_bytes(b"version one")
        with patch.object(office_worker, "WORKSPACE", str(self.root)), patch.object(
            office_worker.time, "strftime", return_value="same-clock-tick"
        ):
            first = office_worker._rewrite(name, sha256(target), lambda _: "version two")
            second = office_worker._rewrite(name, sha256(target), lambda _: "version three")
        self.assertNotEqual(first["original"], second["original"])
        self.assertEqual((self.root / first["original"]).read_bytes(), b"version one")
        self.assertEqual((self.root / second["original"]).read_bytes(), b"version two")
        self.assertEqual(target.read_bytes(), b"version three")

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

    def test_repair_preserves_an_unrelated_hidden_staging_name(self):
        name = os.urandom(8).hex() + ".py"
        target = self.root / name
        hidden = self.root / (".ocade-" + name)
        target.write_text("print('old')\n", encoding="utf-8")
        hidden.write_bytes(b"unrelated customer data")
        [read] = self.run_all(Gateway(str(self.root)), [intent("fs.read_text", {"path": name})])
        [result] = self.run_all(Gateway(str(self.root)), [intent("fs.edit_text", {
            "path": name, "expectSha256": read["evidence"]["sha256"],
            "edits": [{"find": "'old'", "replace": "'new'"}],
        })])
        self.assertEqual(result["status"], "observed", result)
        self.assertEqual(hidden.read_bytes(), b"unrelated customer data")
        self.assertEqual(target.read_text(encoding="utf-8"), "print('new')\n")

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



class ResultBoundary(unittest.TestCase):
    """Fake sessions isolate receipt classification after dispatch.

    Real MCP transport, browser, lease and native-app tests remain mandatory;
    these failures are not evidence that an application itself worked.
    """

    PURE_READS = (
        ("fs.list", {}, False),
        ("fs.read_text", {"path": "input.txt"}, False),
        ("office.inspect_workbook", {"path": "book.xlsx"}, False),
        ("system.inspect", {"programs": []}, False),
    )
    BROWSER_READS = (
        ("web.open", {"url": "https://example.com/"}, True),
        ("web.close", {"page": {"id": "boundary", "site": "example.com"}}, True),
    )
    WRITES = (
        ("fs.write_text", {"path": "OCADE output/boundary.txt", "text": "synthetic"}, True),
    )

    def setUp(self):
        workspace = tempfile.TemporaryDirectory()
        self.addCleanup(workspace.cleanup)
        self.workspace = workspace.name

    @staticmethod
    def result(payload, *, structured=False, is_error=False):
        from types import SimpleNamespace

        return SimpleNamespace(
            is_error=is_error,
            structured_content=payload if structured else None,
            content=[SimpleNamespace(text=json.dumps(payload))],
        )

    def dispatch(self, operation, arguments, result=None, *, failure=None, start_failure=None, external=None):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch

        dispatched = []

        async def call_tool(tool, provided, **_kwargs):
            dispatched.append((tool, provided))
            if failure is not None:
                raise failure
            return result

        gateway = Gateway(self.workspace, external=external)
        session = SimpleNamespace(call_tool=call_tool)

        async def run():
            async with gateway:
                with patch.object(
                    gateway, "_session", AsyncMock(return_value=session, side_effect=start_failure)
                ), patch.object(gateway, "_discard", AsyncMock()):
                    return await gateway.run(intent(operation, arguments), gateway.epoch)

        return anyio.run(run), dispatched

    def assert_classification(self, receipt, changed, code):
        self.assertEqual(
            (receipt["status"], receipt["maybeChanged"], receipt.get("errorCode")),
            ("unknown" if changed else "not_applied", changed, code),
            receipt,
        )

    def test_scalar_null_and_list_text_are_malformed_receipts(self):
        values = (None, 7, "text", [], ["entry"], [{"entry": 1}])
        for operation, arguments, changed in self.PURE_READS[:1] + self.WRITES:
            for payload in values:
                with self.subTest(operation=operation, payload=payload):
                    receipt, dispatched = self.dispatch(operation, arguments, self.result(payload))
                    self.assertEqual(len(dispatched), 1)
                    self.assert_classification(receipt, changed, "malformed_result")

    def test_unwrapped_scalar_null_and_list_are_malformed_receipts(self):
        values = (None, 7, "text", [], ["entry"], [{"entry": 1}])
        for operation, arguments, changed in self.PURE_READS[:1] + self.WRITES:
            for payload in values:
                for structured in (False, True):
                    with self.subTest(operation=operation, payload=payload, structured=structured):
                        receipt, dispatched = self.dispatch(
                            operation, arguments, self.result({"result": payload}, structured=structured)
                        )
                        self.assertEqual(len(dispatched), 1)
                        self.assert_classification(receipt, changed, "malformed_result")

    def test_dispatched_lifecycle_reads_preserve_uncertainty_on_failure(self):
        cases = (
            ("worker_lost", None, RuntimeError("transport ended after dispatch")),
            ("timeout", None, TimeoutError("dispatched call exceeded its bound")),
            ("tool_error", self.result({"message": "failed"}, is_error=True), None),
            ("malformed_result", self.result(None), None),
            ("malformed_result", self.result({"preview": "!"}), None),
            ("evidence_too_large", self.result({"note": "x" * 16_001}), None),
        )
        for operation, arguments, changed in self.PURE_READS + self.BROWSER_READS + self.WRITES:
            if (operation, arguments, changed) in self.BROWSER_READS:
                self.assertEqual(PROTOCOL["operations"][operation]["risk"], "read")
            for case_index, (code, result, failure) in enumerate(cases):
                with self.subTest(operation=operation, code=code, case=case_index):
                    receipt, dispatched = self.dispatch(
                        operation, arguments, result, failure=failure
                    )
                    self.assertEqual(len(dispatched), 1, "the failure occurred after tool dispatch")
                    self.assert_classification(receipt, changed, code)

    def test_worker_start_failure_proves_no_tool_was_dispatched(self):
        for operation, arguments, _changed in self.PURE_READS + self.BROWSER_READS + self.WRITES:
            with self.subTest(operation=operation):
                receipt, dispatched = self.dispatch(
                    operation, arguments, start_failure=RuntimeError("worker failed before dispatch")
                )
                self.assertEqual(dispatched, [])
                self.assert_classification(receipt, False, "worker_unavailable")

    def test_refusal_flags_distinguish_preflight_and_possible_effects(self):
        flags = ({}, {"maybeChanged": False}, {"maybeChanged": True},
                 {"maybeChanged": 0}, {"maybeChanged": 1},
                 {"maybeChanged": "false"}, {"maybeChanged": None})
        for operation, arguments, default_changed in self.PURE_READS[:1] + self.BROWSER_READS + self.WRITES:
            for flag in flags:
                with self.subTest(operation=operation, flag=flag):
                    receipt, dispatched = self.dispatch(
                        operation, arguments, self.result({"refused": "boundary_refusal", **flag})
                    )
                    self.assertEqual(len(dispatched), 1)
                    changed = default_changed if not flag else flag["maybeChanged"] is not False
                    self.assert_classification(receipt, changed, "boundary_refusal")

    def test_malformed_evidence_cannot_erase_an_explicit_or_invalid_change_admission(self):
        for marker in (True, 0, 1, "false", None):
            for content, code in (
                ({"preview": "!"}, "malformed_result"),
                ({"note": "x" * 16_001}, "evidence_too_large"),
                ({"message": "failed"}, "tool_error"),
            ):
                with self.subTest(marker=marker, code=code):
                    receipt, dispatched = self.dispatch(
                        "fs.list", {}, self.result(
                            {"maybeChanged": marker, **content}, is_error=code == "tool_error"
                        )
                    )
                    self.assertEqual(len(dispatched), 1)
                    expected_code = code if marker is True or code == "tool_error" else "malformed_result"
                    self.assert_classification(receipt, True, expected_code)

    def test_nonboolean_change_marker_cannot_become_an_observed_pure_read(self):
        for marker in (None, 0, 1, "yes", [], {}):
            with self.subTest(marker=marker):
                receipt, dispatched = self.dispatch(
                    "fs.list", {}, self.result({"entries": [], "maybeChanged": marker})
                )
                self.assertEqual(len(dispatched), 1)
                self.assert_classification(receipt, True, "malformed_result")

    def test_valid_object_observations_remain_usable(self):
        verification = (("verify.checks", {"checks": [
            {"id": "local", "description": "A file exists", "kind": "file_exists",
             "params": {"path": "input.txt"}}
        ]}, True),)
        for operation, arguments, possible in self.PURE_READS + self.BROWSER_READS + self.WRITES + verification:
            for marker in ({}, {"maybeChanged": False}, {"maybeChanged": True}):
                for structured, wrapped in ((False, False), (True, False), (False, True), (True, True)):
                    with self.subTest(operation=operation, marker=marker, structured=structured, wrapped=wrapped):
                        payload = {"observed": "synthetic boundary control", **marker}
                        receipt, dispatched = self.dispatch(
                            operation, arguments,
                            self.result({"result": payload} if wrapped else payload, structured=structured),
                        )
                        self.assertEqual(len(dispatched), 1)
                        self.assertEqual(receipt["status"], "observed", receipt)
                        self.assertEqual(receipt["evidence"]["observed"], payload["observed"])
                        self.assertIs(receipt["maybeChanged"], possible or marker.get("maybeChanged") is True)
                        self.assertNotIn("errorCode", receipt)

        # This approved-manifest fixture isolates classification; no external
        # executable or MCP server is started. Its returned text is untrusted.
        manifest = {"id": "boundary", "state": "trusted", "tools": [{
            "name": "inspect", "risk": "read",
            "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        }]}
        receipt, dispatched = self.dispatch(
            "mcp.read", {"server": "boundary", "tool": "inspect", "arguments": {}},
            self.result({"maybeChanged": False, "observed": "untrusted external text"}),
            external={"boundary": manifest},
        )
        self.assertEqual(dispatched, [("inspect", {})])
        self.assertEqual(PROTOCOL["operations"]["mcp.read"]["risk"], "read")
        self.assertEqual((receipt["status"], receipt["maybeChanged"]), ("observed", True))
        self.assertEqual(receipt["evidence"]["server"], "boundary")
        self.assertIn("untrusted external text", receipt["evidence"]["content"])
        self.assertNotIn("errorCode", receipt)


if __name__ == "__main__":
    unittest.main()
