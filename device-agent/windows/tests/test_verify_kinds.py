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

    def test_shell_scripts_parse_without_running(self):
        marker = self.root / "ran"
        (self.root / "ok.sh").write_text(f"echo hi > '{marker}'\n")
        (self.root / "bad.sh").write_text("for x in; do\n")
        ok, bad = check("file_parses", path="ok.sh"), check("file_parses", path="bad.sh")
        evidence = self.verify(ok, bad)
        expected = [None, None] if sys.platform == "win32" else [True, False]
        self.assertEqual([evidence["predicates"][ok["id"]], evidence["predicates"][bad["id"]]], expected)
        self.assertFalse(marker.exists())


if __name__ == "__main__":
    unittest.main()
