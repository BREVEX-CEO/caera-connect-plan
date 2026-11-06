"""Verifier predicates for code repairs, editable workbooks and document structure (W5).

Each reads the saved file only and never runs it; each must refuse the near-miss a lazy
or gamed deliverable would produce (a typed-in total, bold text instead of a heading, a
script that still has Windows line endings).
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

import anyio
import openpyxl
from docx import Document

from ocade_agent.engine import office_available
from ocade_agent.gateway import Gateway
from tests.test_gateway import intent


def check(kind, **params):
    return {"id": f"{kind}_{len(params)}_{abs(hash(str(params))) % 10_000}", "kind": kind,
            "description": kind, "params": params}


class VerifierKinds(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())

    def verify(self, *checks):
        async def go():
            async with Gateway(str(self.root)) as gateway:
                return await gateway.run(intent("verify.checks", {"checks": list(checks)}), gateway.epoch)

        result = anyio.run(go)
        self.assertEqual(result["status"], "observed", result)
        return result["evidence"]

    def test_script_runnable_reads_the_script_and_never_runs_it(self):
        marker = self.root / "ran"
        body = f"#!/bin/sh\necho hi > '{marker}'\n"
        (self.root / "good.sh").write_text(body)
        os.chmod(self.root / "good.sh", 0o755)
        (self.root / "crlf.sh").write_bytes(body.replace("\n", "\r\n").encode())
        os.chmod(self.root / "crlf.sh", 0o755)
        (self.root / "plain.sh").write_text(body)
        os.chmod(self.root / "plain.sh", 0o644)
        (self.root / "broken.sh").write_text("#!/bin/sh\nif then fi (\n")
        os.chmod(self.root / "broken.sh", 0o755)
        checks = [check("script_runnable", path=name) for name in ("good.sh", "crlf.sh", "plain.sh", "broken.sh")]
        evidence = self.verify(*checks)
        found = [evidence["predicates"][c["id"]] for c in checks]
        if sys.platform == "win32":
            self.assertEqual(found, [None] * 4)  # Windows starts scripts by type: unobservable here
        else:
            self.assertEqual(found, [True, False, False, False])
            self.assertIn("line endings", evidence["measured"][checks[1]["id"]]["error"])
        self.assertFalse(marker.exists(), "the verifier ran the script")

    def test_workbook_formula_refuses_a_typed_in_result(self):
        book = openpyxl.Workbook()
        sheet = book.active
        sheet.title = "Totals"
        sheet["A1"], sheet["A2"], sheet["A3"], sheet["B3"] = 2, 3, "=A1+A2", 5
        book.save(self.root / "t.xlsx")
        # The saved result of a formula comes from a real spreadsheet engine when one recalculates;
        # without it openpyxl leaves no cached value, so the value comparison is only asserted
        # for the typed cell and the formula's presence.
        formula, typed = check("workbook_formula", path="t.xlsx", sheet="Totals", cell="A3"), \
            check("workbook_formula", path="t.xlsx", sheet="Totals", cell="B3", value=5)
        evidence = self.verify(formula, typed)
        self.assertTrue(evidence["predicates"][formula["id"]])
        self.assertFalse(evidence["predicates"][typed["id"]])
        self.assertIn("not a formula", evidence["measured"][typed["id"]]["error"])

    @unittest.skipUnless(office_available(), "needs a real office engine")
    def test_a_recalculated_formula_must_have_the_expected_result(self):
        async def go():
            async with Gateway(str(self.root)) as gateway:
                return await gateway.run(intent("office.write_workbook", {
                    "path": "OCADE output/sum.xlsx",
                    "sheets": [{"name": "Totals", "rows": [[2], [3], ["=A1+A2"]]}]}), gateway.epoch)

        written = anyio.run(go)
        self.assertEqual(written["status"], "observed", written)
        right = check("workbook_formula", path="OCADE output/sum.xlsx", sheet="Totals", cell="A3", value=5)
        wrong = check("workbook_formula", path="OCADE output/sum.xlsx", sheet="Totals", cell="A3", value=6)
        evidence = self.verify(right, wrong)
        self.assertEqual([evidence["predicates"][right["id"]], evidence["predicates"][wrong["id"]]], [True, False])

    def test_document_headings_are_real_headings(self):
        document = Document()
        document.add_heading("Quarterly summary", level=1)
        document.add_paragraph("Risks").runs[0].bold = True
        document.save(self.root / "r.docx")
        heading = check("document_headings", path="r.docx", headings=["quarterly SUMMARY"])
        bold = check("document_headings", path="r.docx", headings=["Risks"])
        evidence = self.verify(heading, bold)
        self.assertTrue(evidence["predicates"][heading["id"]])
        self.assertFalse(evidence["predicates"][bold["id"]])

    def test_a_local_service_must_answer_on_its_port(self):
        import threading
        from http.server import BaseHTTPRequestHandler, HTTPServer

        class Page(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"<h1>Team board</h1>")

            def log_message(self, *args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Page)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        port = server.server_address[1]
        try:
            up, wrong_text, closed = check("local_service_answers", port=port, text="team BOARD"), \
                check("local_service_answers", port=port, text="Inventory"), \
                check("local_service_answers", port=1025 if port != 1025 else 1026)
            evidence = self.verify(up, wrong_text, closed)
        finally:
            server.shutdown()
        self.assertEqual([evidence["predicates"][c["id"]] for c in (up, wrong_text, closed)], [True, False, False])

    def test_a_repaired_program_is_rerun_in_a_throwaway_copy(self):
        import sys

        python = f'"{sys.executable}"' if sys.platform != "win32" else f'& "{sys.executable}"'
        (self.root / "tool.py").write_text("open('made.txt', 'w').write('x'); print('total 42')\n")
        (self.root / "broken.py").write_text("raise SystemExit(3)\n")
        ok = check("command_succeeds", command=f"{python} tool.py", text="TOTAL 42")
        wrong_text = check("command_succeeds", command=f"{python} tool.py", text="total 41")
        failing = check("command_succeeds", command=f"{python} broken.py")
        evidence = self.verify(ok, wrong_text, failing)
        self.assertEqual([evidence["predicates"][c["id"]] for c in (ok, wrong_text, failing)], [True, False, False])
        self.assertEqual(evidence["measured"][failing["id"]]["exitCode"], 3)
        self.assertFalse((self.root / "made.txt").exists(), "verifying changed the person's folder")

    def test_a_native_success_cannot_mask_a_later_shell_error(self):
        python = f'& "{sys.executable}"' if sys.platform == "win32" else f'"{sys.executable}"'
        (self.root / "ok.py").write_text("print('native success')\n")
        error = "Write-Error 'shell failure'" if sys.platform == "win32" else "false"
        failed = check("command_succeeds", command=f"{python} ok.py; {error}")
        evidence = self.verify(failed)
        self.assertFalse(evidence["predicates"][failed["id"]], evidence)
        self.assertNotEqual(evidence["measured"][failed["id"]]["exitCode"], 0)

    def test_shell_scripts_parse_without_running(self):
        marker = self.root / "ran"
        (self.root / "ok.sh").write_text(f"echo hi > '{marker}'\n")
        (self.root / "bad.sh").write_text("for x in; do\n")
        ok, bad = check("file_parses", path="ok.sh"), check("file_parses", path="bad.sh")
        evidence = self.verify(ok, bad)
        expected = [None, None] if sys.platform == "win32" else [True, False]
        self.assertEqual([evidence["predicates"][ok["id"]], evidence["predicates"][bad["id"]]], expected)
        self.assertFalse(marker.exists())


    def test_direct_script_launch_requires_a_real_interpreter_and_complete_file(self):
        from ocade_agent import verify_worker
        from unittest.mock import patch

        with patch.object(verify_worker.sys, "platform", "linux"):
            for index, header in enumerate((
                "#!/no/such/interpreter",
                "#!/usr/bin/env no_such_ocade_interpreter",
                "#!/usr/bin/env python3\\nprint('not a newline')",
            )):
                path = self.root / f"bad{index}.py"
                path.write_text(header + "\nprint('body')\n")
                path.chmod(0o755)
                self.assertFalse(verify_worker._script_runnable(path, {}), header)
            oversized = self.root / "large.py"
            oversized.write_bytes(b"#!/usr/bin/env python3\n" + b"# padding\n" * 200_001 + b"if (\n")
            oversized.chmod(0o755)
            notes = {}
            self.assertIsNone(verify_worker._script_runnable(oversized, notes))
            self.assertIn("budget", notes["error"])
            self.assertIsNone(verify_worker._parses(oversized, {}))

    def test_file_supplied_shell_is_never_executed_by_the_verifier(self):
        from ocade_agent import verify_worker

        interpreter = self.root / "sh"
        marker = self.root / "interpreter-ran"
        interpreter.write_text(f"#!/bin/sh\ntouch '{marker}'\n")
        interpreter.chmod(0o755)
        script = self.root / "tool"
        script.write_text(f"#!{interpreter}\necho body\n")
        script.chmod(0o755)
        self.assertIsNone(verify_worker._script_runnable(script, {}))
        self.assertFalse(marker.exists())

    def test_saved_office_packages_parse_and_corrupt_packages_fail(self):
        from pptx import Presentation

        book = openpyxl.Workbook()
        book.active["A1"] = "=2+3"
        book.save(self.root / "sheet.xlsx")
        document = Document()
        document.add_heading("Saved heading", level=1)
        document.save(self.root / "note.docx")
        deck = Presentation()
        deck.slides.add_slide(deck.slide_layouts[0]).shapes.title.text = "Saved slide"
        deck.save(self.root / "deck.pptx")
        for name in ("bad.docx", "bad.xlsx", "bad.pptx", "bad.zip"):
            (self.root / name).write_bytes(b"not a package")
        names = ("sheet.xlsx", "note.docx", "deck.pptx", "bad.docx", "bad.xlsx", "bad.pptx", "bad.zip")
        checks = [check("file_parses", path=name) for name in names]
        evidence = self.verify(*checks)
        self.assertEqual([evidence["predicates"][item["id"]] for item in checks],
                         [True, True, True, False, False, False, False])

    def test_scene_metadata_cannot_make_a_uniform_saved_image_pass(self):
        import hashlib
        import json
        from PIL import Image, PngImagePlugin

        project = self.root / "scene.json"
        project.write_text(json.dumps({"camera": {"position": [0, 0, 4]}, "lights": [{"intensity": 1}],
                                       "materials": [{}], "parts": [{"shapes": [{}]}],
                                       "render": {"width": 16, "height": 16}}))
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text("ocade:project", "scene.json")
        metadata.add_text("ocade:project-sha256", hashlib.sha256(project.read_bytes()).hexdigest())
        Image.new("RGB", (16, 16), "gray").save(self.root / "flat.png", pnginfo=metadata)
        predicate = check("scene_render", path="flat.png")
        evidence = self.verify(predicate)
        self.assertFalse(evidence["predicates"][predicate["id"]])
        self.assertIn("uniform", evidence["measured"][predicate["id"]]["error"])



class SceneInterchange(unittest.TestCase):
    def test_real_mesh_positions_and_corrupt_binary_are_checked_independently(self):
        import json
        import math
        from ocade_agent.scene_gl import _mesh_document
        from ocade_agent.verify_worker import _gltf_mesh

        n = 13
        samples = [
            (math.dist((x / 3, y / 3, z / 3), (2, 2, 2)) - 1, 0)
            for z in range(n) for y in range(n) for x in range(n)
        ]
        mesh = _mesh_document(samples, n, [-2, -2, -2], [2, 2, 2],
                              [{"id": "blue", "color": [0.1, 0.2, 0.8]}])
        first = mesh["meshes"][0]["primitives"][0]
        self.assertEqual(first["material"], 0)
        positions = mesh["accessors"][first["attributes"]["POSITION"]]
        self.assertEqual(positions["min"], [-1, -1, -1])
        self.assertEqual(positions["max"], [1, 1, 1])
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "scene.gltf"
            path.write_text(json.dumps(mesh), encoding="utf8")
            observed = {}
            self.assertTrue(_gltf_mesh(path, observed), observed)
            self.assertGreater(observed["triangles"], 10)
            mesh["bufferViews"][0]["byteLength"] = 3
            path.write_text(json.dumps(mesh), encoding="utf8")
            self.assertFalse(_gltf_mesh(path, {}))

    def test_unbounded_geometry_cannot_be_exported_as_a_truncated_success(self):
        from ocade_agent.scene_gl import _mesh_document

        with self.assertRaisesRegex(ValueError, "bounds"):
            _mesh_document([(-1, 0)] * 27, 3, [-1, -1, -1], [1, 1, 1], [])


if __name__ == "__main__":
    unittest.main()
