"""What JARVIS saves opens in another office suite with the same numbers, text and slides
(PLAN Phase 17): LibreOffice recalculates the workbook itself, so a total is checked by an
engine that is not the one that wrote it."""
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ocade_computer import Computer  # noqa: E402
from test_sheets import FINISH_ORDERS, ORDERS, RATES, workbook  # noqa: E402

OFFICE = shutil.which("soffice")


def convert(path: Path, to: str) -> Path:
    """Open the file in LibreOffice and save it as `to`; a fresh profile keeps runs apart."""
    out = path.parent / "converted"
    profile = Path(tempfile.mkdtemp())
    try:
        subprocess.run([OFFICE, f"-env:UserInstallation={profile.as_uri()}", "--headless",
                        "--convert-to", to, "--outdir", str(out), str(path)],
                       check=True, capture_output=True, timeout=120)
    finally:
        shutil.rmtree(profile, True)
    return out / f"{path.stem}.{to.split(':')[0]}"


@unittest.skipUnless(OFFICE, "needs LibreOffice (BLOCKED_TESTS.md APP-17-01)")
class IndependentReopenTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, True)
        self.pc = Computer(str(self.root))

    def test_the_finished_workbook_calculates_the_same_totals_elsewhere(self):
        workbook(self.root / "orders.xlsx")
        copied = self.pc.run({"action": "file_copy", "path": "orders.xlsx", "to": "sales.xlsx"})
        self.assertEqual(copied["status"], "done", copied)
        out = self.pc.run({"action": "sheet_edit", "path": "sales.xlsx", "sheet": "Orders", "ops": [
            *FINISH_ORDERS, {"op": "chart", "kind": "column", "source": "E1:E7", "anchor": "H2"}]})
        self.assertEqual(out["status"], "done", out)
        rate = dict(RATES)
        revenue = [units * price for _, _, units, price in ORDERS]
        tax = [r * rate[region] for r, (region, *_) in zip(revenue, ORDERS)]
        rows = convert(self.root / "sales.xlsx", "csv").read_text().splitlines()
        self.assertEqual([float(row.split(",")[4]) for row in rows[1:7]], revenue)
        self.assertEqual(rows[7].split(",")[3:5], ["Total", str(sum(revenue))])
        self.assertAlmostEqual(float(rows[7].split(",")[5]), sum(tax), places=6)
        # The chart is a real chart object to the other suite, not a picture of one.
        resaved = convert(self.root / "sales.xlsx", "xlsx")
        self.assertTrue(any(n.startswith("xl/charts/chart") for n in zipfile.ZipFile(resaved).namelist()))

    def test_the_report_reads_the_same_elsewhere(self):
        out = self.pc.run({"action": "doc_edit", "path": "report.docx", "ops": [
            {"op": "append", "text": "Quarterly report", "style": "Title"},
            {"op": "append", "text": "Revenue grew 12% in every region."},
            {"op": "table", "rows": [["Region", "Revenue"], ["North", "120"]]},
            {"op": "replace", "find": "12%", "with": "14%"}]})
        self.assertEqual(out["status"], "done", out)
        text = convert(self.root / "report.docx", "txt:Text").read_text(encoding="utf-8-sig")
        self.assertIn("Quarterly report", text)
        self.assertIn("Revenue grew 14% in every region.", text)
        self.assertIn("North", text)

    def test_the_deck_has_the_same_slides_elsewhere(self):
        out = self.pc.run({"action": "deck_edit", "path": "cities.pptx", "ops": [
            {"op": "slide", "title": "Three cities", "layout": "title"},
            {"op": "slide", "title": "Population (millions)"},
            {"op": "chart", "kind": "column", "categories": ["Tokyo", "Delhi"],
             "series": [{"name": "2023", "values": [14.0, 11.0]}]}]})
        self.assertEqual(out["status"], "done", out)
        pdf = convert(self.root / "cities.pptx", "pdf")
        text = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True,
                              check=True).stdout
        self.assertEqual(text.count("\f"), 2)  # one page per slide
        self.assertIn("Three cities", text)
        self.assertIn("Population (millions)", text)

    def test_a_pdf_is_made_from_the_report_checked_and_undone(self):
        self.pc.run({"action": "doc_edit", "path": "report.docx", "ops": [
            {"op": "append", "text": "Client pack for Acme Traders", "style": "Title"},
            {"op": "append", "text": "Balance due on 31 October: 10,655.00"}]})
        out = self.pc.run({"action": "pdf_export", "from": "report.docx", "path": "report.pdf"})
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(out["pages"], 1)
        self.assertIn("Balance due on 31 October: 10,655.00", out["text"])
        # Never over an existing file, never outside the work folder.
        self.assertEqual(self.pc.run({"action": "pdf_export", "from": "report.docx",
                                      "path": "report.pdf"})["status"], "failed")
        self.assertEqual(self.pc.run({"action": "pdf_export", "from": "report.docx",
                                      "path": "../report.pdf"})["status"], "blocked")
        self.assertEqual(self.pc.run({"action": "undo"})["status"], "done")
        self.assertFalse((self.root / "report.pdf").exists())

    def test_stop_while_the_pdf_is_saved_leaves_no_pdf(self):
        workbook(self.root / "orders.xlsx")
        cancel = threading.Event()
        threading.Timer(0.3, cancel.set).start()
        out = self.pc.run({"action": "pdf_export", "from": "orders.xlsx", "path": "orders.pdf"},
                          cancel=cancel)
        self.assertTrue(out.get("stopped"), out)
        self.assertFalse((self.root / "orders.pdf").exists())

    def test_a_damaged_file_is_refused_and_left_as_it_was(self):
        for name, action in (("broken.xlsx", "sheet_edit"), ("broken.docx", "doc_edit"),
                             ("broken.pptx", "deck_edit")):
            path = self.root / name
            path.write_bytes(b"PK\x03\x04 not really an office file")
            ops = {"sheet_edit": [{"op": "set", "cell": "A1", "value": 1}],
                   "doc_edit": [{"op": "append", "text": "x"}],
                   "deck_edit": [{"op": "slide", "title": "x"}]}[action]
            out = self.pc.run({"action": action, "path": name, "ops": ops})
            self.assertEqual(out["status"], "failed", (name, out))
            self.assertEqual(path.read_bytes(), b"PK\x03\x04 not really an office file", name)


if __name__ == "__main__":
    unittest.main()
