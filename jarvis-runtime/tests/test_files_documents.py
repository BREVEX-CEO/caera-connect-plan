"""File operations and direct document reading, inside the workspace only."""
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from conftest import live  # noqa: E402
from ocade_computer import Computer  # noqa: E402


def _docx(path: Path, paragraphs: list[str]) -> None:
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("word/document.xml",
                   f'<w:document xmlns:w="w"><w:body>{body}</w:body></w:document>')


def _pptx(path: Path, slides: list[str]) -> None:
    with zipfile.ZipFile(path, "w") as z:
        for i, text in enumerate(slides, 1):
            z.writestr(f"ppt/slides/slide{i}.xml",
                       f'<p:sld xmlns:a="a" xmlns:p="p"><a:p><a:r><a:t>{text}</a:t></a:r></a:p></p:sld>')


def _pdf(path: Path, text: str) -> None:
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>",
               b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
               b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
               b"/Resources << /Font << /F1 5 0 R >> >> >>",
               b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
               b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (len(objects) + 1, xref)
    path.write_bytes(bytes(out))


class FileOperationsTest(unittest.TestCase):
    def setUp(self):
        self.base = Path(tempfile.mkdtemp())
        self.root = self.base / "work"
        self.root.mkdir()
        (self.root / "a.txt").write_text("alpha")
        (self.root / "docs").mkdir()
        self.pc = Computer(str(self.root))

    def act(self, **action):
        return self.pc.run(action)

    def test_move_copy_rename_never_overwrite_and_stay_inside(self):
        self.assertEqual(self.act(action="file_copy", path="a.txt", to="docs")["status"], "done")
        self.assertEqual((self.root / "docs/a.txt").read_text(), "alpha")
        again = self.act(action="file_copy", path="a.txt", to="docs")
        self.assertEqual(again["status"], "failed")
        self.assertIn("nothing was overwritten", again["summary"])
        self.assertEqual(self.act(action="file_rename", path="a.txt", name="b.txt")["status"], "done")
        self.assertTrue((self.root / "b.txt").exists())
        self.assertEqual(self.act(action="file_rename", path="b.txt", name="../x.txt")["status"], "failed")
        self.assertEqual(self.act(action="file_move", path="b.txt", to="../b.txt")["status"], "blocked")
        self.assertEqual(self.act(action="file_move", path="docs", to="docs/inner")["status"], "failed")
        self.assertEqual(self.act(action="file_move", path="b.txt", to="docs/moved.txt")["status"], "done")
        self.assertEqual((self.root / "docs/moved.txt").read_text(), "alpha")
        self.assertFalse((self.base / "b.txt").exists())

    def test_find_info_and_mkdir(self):
        self.act(action="file_mkdir", path="reports/2026")
        (self.root / "reports/2026/q1.xlsx").write_bytes(b"x")
        found = self.act(action="file_find", path=".", extension="xlsx")
        self.assertEqual([e["path"].replace("\\", "/") for e in found["entries"]], ["reports/2026/q1.xlsx"])
        self.assertEqual(self.act(action="file_find", path=".", name="Q1")["entries"][0]["size"], 1)
        info = self.act(action="file_info", path="a.txt")["info"]
        self.assertEqual((info["name"], info["size"], info["folder"]), ("a.txt", 5, False))

    def test_documents_are_read_directly(self):
        _docx(self.root / "letter.docx", ["Dear team", "Budget &amp; plan"])
        _pptx(self.root / "deck.pptx", ["Intro", "Numbers"])
        _pdf(self.root / "report.pdf", "Quarterly revenue grew")
        letter = self.act(action="file_extract", path="letter.docx")
        self.assertEqual(letter["content"].split("\n")[:2], ["Dear team", "Budget & plan"])
        deck = self.act(action="file_extract", path="deck.pptx")
        self.assertEqual(deck["pages"], 2)
        self.assertIn("Slide 2:\nNumbers", deck["content"])
        pdf = self.act(action="file_extract", path="report.pdf")
        self.assertEqual(pdf["status"], "done", pdf)
        self.assertIn("Quarterly revenue grew", pdf["content"])
        (self.root / "broken.docx").write_text("not a zip")
        self.assertEqual(self.act(action="file_extract", path="broken.docx")["status"], "failed")
        self.assertEqual(self.act(action="file_extract", path="../outside.pdf")["status"], "blocked")


if __name__ == "__main__":
    unittest.main()


class WriteExactlyTest(unittest.TestCase):
    def test_line_endings_are_kept_exactly(self):
        root = Path(tempfile.mkdtemp())
        pc = Computer(str(root))
        pc.run({"action": "file_write", "path": "unix.sh", "content": "a\nb\n"})
        pc.run({"action": "file_write", "path": "dos.txt", "content": "a\r\nb\r\n"})
        self.assertEqual((root / "unix.sh").read_bytes(), b"a\nb\n")
        self.assertEqual((root / "dos.txt").read_bytes(), b"a\r\nb\r\n")


def _minimal_docx(path: Path, paragraphs: list[str]) -> None:
    """The smallest package Word opens: content types, the package relationship, the body."""
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr("word/document.xml",
                   '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                   f'<w:body>{body}</w:body></w:document>')


class WordValidationTest(unittest.TestCase):
    def test_refuses_what_word_should_not_get(self):
        import ocade_documents
        for ops in ([], [{"op": "macro"}], [{"op": "replace", "find": "", "with": "x"}],
                    [{"op": "append", "text": "x", "style": "Evil"}],
                    [{"op": "table", "rows": [["a", "b"], ["c"]]}]):
            with self.assertRaises(ocade_documents.DocumentError, msg=str(ops)):
                ocade_documents.validate_word(ops)


@live
class DeckTest(unittest.TestCase):
    """A presentation built as its own file: a title slide, bullets, a native chart with its data,
    an image from the work folder; reopened and read back; undo takes a new deck away."""

    def test_build_a_deck_with_a_chart_and_an_image(self):
        from PIL import Image
        root = Path(tempfile.mkdtemp())
        Image.new("RGB", (640, 360), (30, 90, 160)).save(root / "map.png")
        pc = Computer(str(root))
        out = pc.run({"action": "deck_edit", "path": "cities.pptx", "ops": [
            {"op": "slide", "title": "Three cities", "bullets": ["October 2026"], "layout": "title"},
            {"op": "slide", "title": "Findings", "bullets": ["Tokyo is largest", "Delhi grows fastest"],
             "notes": "Sources: Wikipedia"},
            {"op": "slide", "title": "Population (millions)"},
            {"op": "chart", "kind": "column", "title": "Population",
             "categories": ["Tokyo", "Delhi", "Shanghai"],
             "series": [{"name": "2023", "values": [14.0, 11.0, 24.9]}]},
            {"op": "slide", "title": "Where"},
            {"op": "image", "path": "map.png", "caption": "Map"},
        ]})
        self.assertEqual(out["status"], "done", out)
        read = out["read"]
        self.assertEqual(read["count"], 4)
        self.assertEqual(read["size"], [13.33, 7.5])
        self.assertEqual([s["title"] for s in read["slides"]],
                         ["Three cities", "Findings", "Population (millions)", "Where"])
        self.assertIn("Delhi grows fastest", read["slides"][1]["text"])
        self.assertEqual(read["slides"][1]["notes"], "Sources: Wikipedia")
        self.assertEqual(read["slides"][2]["charts"], ["COLUMN_CLUSTERED"])
        self.assertEqual(read["slides"][3]["pictures"], 1)
        from pptx import Presentation
        chart = next(sh.chart for sh in Presentation(str(root / "cities.pptx")).slides[2].shapes if sh.has_chart)
        self.assertEqual(list(chart.plots[0].categories), ["Tokyo", "Delhi", "Shanghai"])
        self.assertEqual(list(chart.series[0].values), [14.0, 11.0, 24.9])
        # Nothing outside the work folder goes in, and a chart needs numbers.
        self.assertEqual(pc.run({"action": "deck_edit", "path": "cities.pptx",
                                 "ops": [{"op": "image", "path": "../x.png"}]})["status"], "failed")
        self.assertEqual(pc.run({"action": "deck_edit", "path": "cities.pptx", "ops": [
            {"op": "chart", "kind": "pie", "categories": ["a"], "series": [{"values": ["x"]}]}]})["status"], "failed")
        self.assertEqual(pc.run({"action": "undo"})["status"], "done")
        self.assertFalse((root / "cities.pptx").exists())


@unittest.skipIf(__import__("ocade_sheets").automation_server(".docx"), "an app automates .docx here")
class DocxWithoutWordTest(unittest.TestCase):
    """No app automates Word documents (Linux, macOS without Office): the .docx is made and
    edited as its own file, reopened and read back, and undo takes a new one away."""

    def test_make_a_report_then_finish_it(self):
        root = Path(tempfile.mkdtemp())
        pc = Computer(str(root))
        made = pc.run({"action": "doc_edit", "path": "report.docx", "ops": [
            {"op": "append", "text": "Quarterly report", "style": "Title"},
            {"op": "append", "text": "Revenue", "style": "Heading 1"},
            {"op": "append", "text": "Revenue grew 12% in every region."},
            {"op": "table", "rows": [["Region", "Revenue"], ["North", "120"], ["South", "95"]]},
            {"op": "bold", "find": "12%"},
        ]})
        self.assertEqual(made["status"], "done", made)
        self.assertTrue(made["savedAndReopened"])
        read = made["read"]
        self.assertIn("Title|Quarterly report", read["headings"])
        self.assertIn("Heading 1|Revenue", read["headings"])
        self.assertEqual(read["tables"], 1)
        self.assertIn("North	120", read["text"])
        from docx import Document
        runs = Document(str(root / "report.docx")).paragraphs[2].runs
        self.assertEqual([(r.text, bool(r.bold)) for r in runs],
                         [("Revenue grew ", False), ("12%", True), (" in every region.", False)])
        # JARVIS's own new file is not the person's original: edited without overwrite.
        done = pc.run({"action": "doc_edit", "path": "report.docx",
                       "ops": [{"op": "replace", "find": "12%", "with": "14%"}]})
        self.assertEqual(done["status"], "done", done)
        self.assertIn("Revenue grew 14% in every region.", done["read"]["text"])
        missing = pc.run({"action": "doc_edit", "path": "report.docx",
                          "ops": [{"op": "bold", "find": "not there"}]})
        self.assertEqual(missing["status"], "failed")
        self.assertEqual(pc.run({"action": "undo"})["status"], "done")  # the 14% edit
        self.assertEqual(pc.run({"action": "undo"})["status"], "done")  # the new file
        self.assertFalse((root / "report.docx").exists())


@unittest.skipUnless(__import__("ocade_sheets").automation_server(".docx"), "needs an app that automates .docx")
class RealWordTest(unittest.TestCase):
    """A report finished in the person's Word: replaced, styled, formatted, a table, saved and reopened."""

    def test_finish_a_report_in_word(self):
        root = Path(tempfile.mkdtemp())
        _minimal_docx(root / "report.docx", ["Quarterly report DRAFT", "Revenue grew in every region.",
                                             "Contact: TBD"])
        pc = Computer(str(root))
        out = pc.run({"action": "doc_edit", "path": "report.docx", "_close": True, "overwrite": True, "ops": [
            {"op": "replace", "find": "DRAFT", "with": "Q3 2026"},
            {"op": "replace", "find": "TBD", "with": "finance@example.com"},
            {"op": "style", "find": "Quarterly report", "style": "Title"},
            {"op": "bold", "find": "every region"},
            {"op": "append", "text": "Regional results", "style": "Heading 1"},
            {"op": "table", "rows": [["Region", "Revenue"], ["North", "$3,800"], ["South", "$2,750"]]},
            {"op": "append", "text": "Prepared by JARVIS."},
        ]})
        self.assertEqual(out["status"], "done", out)
        self.assertTrue(out["savedAndReopened"])
        text = out["read"]["text"]
        self.assertIn("Quarterly report Q3 2026", text)
        self.assertIn("finance@example.com", text)
        self.assertNotIn("DRAFT", text)
        self.assertEqual(out["read"]["tables"], 1)
        headings = out["read"]["headings"]
        self.assertTrue(any(h.endswith("|Quarterly report Q3 2026") for h in headings), headings)
        self.assertTrue(any(h.endswith("|Regional results") for h in headings), headings)
        # The saved file itself carries the result, for any program that opens it next.
        import ocade_documents
        saved, _ = ocade_documents.extract_text(root / "report.docx", 30_000)
        self.assertIn("North", saved)
        self.assertIn("Prepared by JARVIS.", saved)


class CompareTest(unittest.TestCase):
    """P18: What changed, read from the original and the result themselves."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.pc = Computer(str(self.root))

    def test_workbooks_by_cell(self):
        from openpyxl import Workbook
        for name, total in (("before.xlsx", 10), ("after.xlsx", "=SUM(A1:A2)")):
            book = Workbook()
            book.active.title = "Orders"
            book.active["A1"], book.active["A3"] = 4, total
            book.save(self.root / name)
        out = self.pc.run({"action": "file_compare", "path": "before.xlsx", "to": "after.xlsx"})
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(out["changes"]["cells"],
                         [{"sheet": "Orders", "cell": "A3", "before": 10, "after": "=SUM(A1:A2)"}])

    def test_text_by_line_and_other_files_by_bytes(self):
        (self.root / "a.txt").write_text("one\ntwo\n")
        (self.root / "b.txt").write_text("one\n2\n")
        lines = self.pc.run({"action": "file_compare", "path": "a.txt", "to": "b.txt"})["changes"]
        self.assertEqual(lines["lines"], ["-two", "+2"])
        (self.root / "a.bin").write_bytes(b"\x00\x01")
        (self.root / "b.bin").write_bytes(b"\x00\x01")
        same = self.pc.run({"action": "file_compare", "path": "a.bin", "to": "b.bin"})["changes"]
        self.assertEqual((same["kind"], same["same"]), ("bytes", True))
        self.assertEqual(self.pc.run({"action": "file_compare", "path": "a.txt", "to": "../x"})["status"],
                         "blocked")

    def test_a_difference_past_the_compared_part_is_not_called_no_change(self):
        """C27: two long texts that differ only near the end."""
        body = "same line\n" * 25_000  # 250,000 characters
        (self.root / "long1.txt").write_text(body + "end A\n")
        (self.root / "long2.txt").write_text(body + "end B\n")
        out = self.pc.run({"action": "file_compare", "path": "long1.txt", "to": "long2.txt"})["changes"]
        self.assertEqual(out["lines"], [])
        self.assertIn("partial", out)
        self.assertTrue(out["differsLater"])


class DocxFidelityTest(unittest.TestCase):
    """V17: the file route kept no formatting it rebuilt, ignored matchCase and tables, compared
    only 20,000 characters, could not be stopped before its save, and saved in place."""

    def setUp(self):
        from docx import Document
        self.root = Path(tempfile.mkdtemp())
        doc = Document()
        para = doc.add_paragraph()
        para.add_run("Total: ")
        red = para.add_run("ACME Ltd")
        red.italic = True
        para.add_run(" owes 400.")
        table = doc.add_table(rows=1, cols=2)
        table.cell(0, 0).text = "Client"
        table.cell(0, 1).text = "acme ltd"
        doc.add_paragraph("x" * 25_000 + " END")
        doc.save(self.root / "invoice.docx")
        self.pc = Computer(str(self.root))

    def run_ops(self, *ops, **extra):
        return self.pc.run({"action": "doc_edit", "path": "invoice.docx", "overwrite": True,
                            "ops": list(ops), **extra})

    def test_replace_keeps_the_formatting_of_the_words_around_it(self):
        from docx import Document
        out = self.run_ops({"op": "replace", "find": "ACME Ltd", "with": "Acme Limited"})
        self.assertEqual(out["status"], "done", out)
        runs = Document(self.root / "invoice.docx").paragraphs[0].runs
        self.assertEqual([(r.text, bool(r.italic)) for r in runs],
                         [("Total: ", False), ("Acme Limited", True), (" owes 400.", False)])

    def test_bold_marks_only_its_words_and_keeps_the_rest(self):
        from docx import Document
        self.assertEqual(self.run_ops({"op": "bold", "find": "400"})["status"], "done")
        runs = Document(self.root / "invoice.docx").paragraphs[0].runs
        self.assertEqual("".join(r.text for r in runs), "Total: ACME Ltd owes 400.")
        self.assertEqual([r.text for r in runs if r.bold], ["400"])
        self.assertEqual([r.text for r in runs if r.italic], ["ACME Ltd"])

    def test_case_insensitive_replace_reaches_table_cells(self):
        from docx import Document
        out = self.run_ops({"op": "replace", "find": "ACME LTD", "with": "Acme Limited", "matchCase": False})
        self.assertEqual(out["status"], "done", out)
        doc = Document(self.root / "invoice.docx")
        self.assertIn("Acme Limited", doc.paragraphs[0].text)
        self.assertEqual(doc.tables[0].cell(0, 1).text, "Acme Limited")

    def test_text_past_twenty_thousand_characters_is_checked_too(self):
        out = self.run_ops({"op": "replace", "find": "END", "with": "FIN"})
        self.assertEqual(out["status"], "done", out)
        self.assertTrue(out.get("savedAndReopened"), out)
        from docx import Document
        self.assertTrue(Document(self.root / "invoice.docx").paragraphs[-1].text.endswith("FIN"))

    def test_stop_before_the_save_leaves_the_file_exactly_as_it_was(self):
        import threading
        import ocade_documents
        before = (self.root / "invoice.docx").read_bytes()
        cancel = threading.Event()
        real = ocade_documents._mark

        def stop_while_editing(*args, **kwargs):
            cancel.set()
            return real(*args, **kwargs)

        ocade_documents._mark = stop_while_editing
        try:
            out = ocade_documents.edit_docx_file(self.root / "invoice.docx", ocade_documents.validate_word(
                [{"op": "bold", "find": "400"}]), cancel)
        finally:
            ocade_documents._mark = real
        self.assertTrue(out.get("stopped"), out)
        self.assertEqual((self.root / "invoice.docx").read_bytes(), before)
        self.assertEqual([p.name for p in self.root.iterdir()], ["invoice.docx"])  # no temporary left


class DeckReopenTest(unittest.TestCase):
    def test_a_deck_is_reported_saved_only_when_its_reopened_slides_are_the_ones_asked_for(self):
        import threading
        import ocade_documents
        root = Path(tempfile.mkdtemp())
        out = ocade_documents.edit_deck(root / "d.pptx", [
            {"op": "slide", "title": "One", "bullets": ["a"]}, {"op": "slide", "title": "Two", "bullets": []}],
            root, threading.Event())
        self.assertTrue(out["savedAndReopened"], out)
        stopped = threading.Event()
        stopped.set()
        before = (root / "d.pptx").read_bytes()
        out = ocade_documents.edit_deck(root / "d.pptx", [{"op": "slide", "title": "Three", "bullets": []}],
                                        root, stopped)
        self.assertTrue(out.get("stopped"), out)
        self.assertEqual((root / "d.pptx").read_bytes(), before)

    def test_a_reopen_that_fails_after_the_save_is_reported_changed_with_undo(self):
        import ocade_documents
        root = Path(tempfile.mkdtemp())
        pc = Computer(str(root))
        self.assertEqual(pc.run({"action": "deck_edit", "path": "d.pptx", "ops": [
            {"op": "slide", "title": "One", "bullets": []}]})["status"], "done")
        before = (root / "d.pptx").read_bytes()
        real = ocade_documents.read_deck

        def broken(path):
            raise OSError("disk went away")

        ocade_documents.read_deck = broken
        try:
            out = pc.run({"action": "deck_edit", "path": "d.pptx", "ops": [
                {"op": "slide", "title": "Two", "bullets": []}]})
        finally:
            ocade_documents.read_deck = real
        self.assertEqual(out["status"], "failed", out)
        self.assertTrue(out["fileChanged"], out)
        self.assertNotEqual((root / "d.pptx").read_bytes(), before)
        self.assertEqual(pc.run({"action": "undo"})["status"], "done")
        self.assertEqual((root / "d.pptx").read_bytes(), before)

