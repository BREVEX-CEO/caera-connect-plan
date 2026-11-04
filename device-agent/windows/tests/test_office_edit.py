"""In-place Word and Excel edits (W5, D19): the person's own document changes exactly where
asked, keeps its styles and structure, keeps an original, and never overwrites a newer save."""

import tempfile
import unittest
import zipfile
from pathlib import Path

import anyio
import openpyxl
from docx import Document

from ocade_agent.engine import office_available
from ocade_agent.gateway import Gateway
from ocade_agent.sandbox import sha256
from tests.test_gateway import intent


class OfficeEdits(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())

    def run_all(self, intents):
        async def go():
            async with Gateway(str(self.root)) as gateway:
                return [await gateway.run(i, gateway.epoch) for i in intents]

        return anyio.run(go)

    def test_a_word_document_changes_only_where_asked(self):
        document = Document()
        document.add_heading("Quarterly plan", level=1)
        paragraph = document.add_paragraph("Budget: ")
        paragraph.add_run("4,000 EUR").bold = True
        paragraph.add_run(" approved by Ana.")
        table = document.add_table(rows=1, cols=2)
        table.rows[0].cells[0].text, table.rows[0].cells[1].text = "Owner", "Ana"
        document.save(self.root / "plan.docx")
        before = sha256(self.root / "plan.docx")
        edited, stale, missing = self.run_all([
            intent("office.edit_document", {"path": "plan.docx", "expectSha256": before, "edits": [
                {"find": "4,000 EUR", "replace": "5,500 EUR"}, {"find": "Ana.", "replace": "Ben."}]}),
            intent("office.edit_document", {"path": "plan.docx", "expectSha256": before,
                                            "edits": [{"find": "Owner", "replace": "Lead"}]}),
            intent("office.edit_document", {"path": "plan.docx", "expectSha256": "0" * 64,
                                            "edits": [{"find": "nothing", "replace": "x"}]}),
        ])
        self.assertEqual(edited["status"], "observed", edited)
        self.assertTrue(edited["evidence"]["matches"])
        saved = Document(self.root / "plan.docx")
        self.assertEqual(saved.paragraphs[0].style.name, "Heading 1")
        self.assertEqual(saved.paragraphs[1].text, "Budget: 5,500 EUR approved by Ben.")
        self.assertTrue(saved.paragraphs[1].runs[1].bold, "the edited run keeps its formatting")
        self.assertEqual(saved.tables[0].rows[0].cells[1].text, "Ana", "an unrelated table cell is untouched")
        original = self.root / edited["evidence"]["original"]
        self.assertEqual(sha256(original), before)
        self.assertEqual(stale["errorCode"], "file_changed")  # a version changed since it was read
        self.assertEqual(missing["errorCode"], "file_changed")

    def test_find_must_be_unique_and_present(self):
        document = Document()
        document.add_paragraph("total total")
        document.save(self.root / "d.docx")
        digest = sha256(self.root / "d.docx")
        twice, absent = self.run_all([
            intent("office.edit_document", {"path": "d.docx", "expectSha256": digest,
                                            "edits": [{"find": "total", "replace": "sum"}]}),
            intent("office.edit_document", {"path": "d.docx", "expectSha256": digest,
                                            "edits": [{"find": "missing", "replace": "x"}]}),
        ])
        self.assertEqual((twice["errorCode"], absent["errorCode"]), ("find_not_unique", "find_not_found"))
        self.assertEqual(sha256(self.root / "d.docx"), digest)
        self.assertFalse((self.root / "OCADE output" / "originals").exists(), "no original for a refused edit")

    @unittest.skipUnless(office_available(), "needs a real office engine")
    def test_a_workbook_cell_and_formula_change_in_place(self):
        book = openpyxl.Workbook()
        sheet = book.active
        sheet.title = "Q3"
        sheet["A1"], sheet["A2"], sheet["A3"] = 10, 20, "=A1+A2"
        book.save(self.root / "q3.xlsx")
        before = sha256(self.root / "q3.xlsx")
        [edited] = self.run_all([intent("office.edit_workbook", {
            "path": "q3.xlsx", "expectSha256": before,
            "cells": [{"sheet": "Q3", "cell": "A2", "value": 32}, {"sheet": "Q3", "cell": "B1", "value": "=A3*2"}]})])
        self.assertEqual(edited["status"], "observed", edited)
        values = openpyxl.load_workbook(self.root / "q3.xlsx", data_only=True)["Q3"]
        self.assertEqual((values["A3"].value, values["B1"].value), (42, 84))
        self.assertEqual(sha256(self.root / edited["evidence"]["original"]), before)

    def test_a_workbook_with_charts_or_macros_is_refused_not_damaged(self):
        book = openpyxl.Workbook()
        book.active["A1"] = 1
        book.save(self.root / "chart.xlsx")
        with zipfile.ZipFile(self.root / "chart.xlsx", "a") as package:
            package.writestr("xl/charts/chart1.xml", "<chartSpace/>")
        digest = sha256(self.root / "chart.xlsx")
        [refused] = self.run_all([intent("office.edit_workbook", {
            "path": "chart.xlsx", "expectSha256": digest, "cells": [{"sheet": "Sheet", "cell": "A1", "value": 2}]})])
        self.assertEqual(refused["errorCode"], "workbook_features_not_preserved")
        self.assertEqual(sha256(self.root / "chart.xlsx"), digest)


if __name__ == "__main__":
    unittest.main()
