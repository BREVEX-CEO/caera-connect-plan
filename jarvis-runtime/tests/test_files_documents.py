"""Donor-derived file operations and direct document reading, inside the workspace only."""
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
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
