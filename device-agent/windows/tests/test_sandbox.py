import os
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from ocade_agent.sandbox import Refused, output_path, resolve, write_atomically


class SandboxTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        (self.root / "book.xlsx").write_bytes(b"original")
        self.outside = Path(tempfile.mkdtemp())

    def refuses(self, path, code="path_outside_workspace"):
        with self.assertRaises(Refused) as caught:
            resolve(self.root, path)
        self.assertEqual(caught.exception.code, code)

    def test_inside_paths_resolve(self):
        self.assertEqual(resolve(self.root, "book.xlsx"), self.root.resolve() / "book.xlsx")
        self.assertEqual(resolve(self.root, "./a/../book.xlsx".replace("a/../", "")), self.root.resolve() / "book.xlsx")

    def test_escapes_are_refused(self):
        for path in ["../x", "a/../../x", "/etc/passwd", "\\\\server\\share\\x", "C:\\Windows\\x",
                     "book.xlsx:secret", "CON", "nul.txt", "a\x00b", "trailing. ", "\\\\?\\C:\\x"]:
            with self.subTest(path=path):
                self.refuses(path)

    def test_unicode_and_long_names_are_ordinary_paths(self):
        """Names people really use (128): accents, CJK, emoji, right-to-left text and long names."""
        for name in ("Résumé – final.docx", "報告書 2026.xlsx", "budget 💶.txt", "تقرير.txt", "x" * 200 + ".txt"):
            with self.subTest(name=name[:20]):
                target = output_path(self.root, f"OCADE output/{name}")
                write_atomically(target, lambda tmp: tmp.write_text(name, encoding="utf-8"))
                self.assertEqual(resolve(self.root, f"OCADE output/{name}").read_text(encoding="utf-8"), name)

    def test_symlink_or_junction_escape_is_refused(self):
        os.symlink(self.outside, self.root / "link")
        self.refuses("link/secret.txt")

    def test_writes_only_new_files_under_output(self):
        with self.assertRaises(Refused) as caught:
            output_path(self.root, "book.xlsx")
        self.assertEqual(caught.exception.code, "write_outside_output")
        target = output_path(self.root, "OCADE output/t/report.docx")
        write_atomically(target, lambda tmp: tmp.write_bytes(b"new"))
        with self.assertRaises(Refused) as caught:
            output_path(self.root, "OCADE output/t/report.docx")
        self.assertEqual(caught.exception.code, "output_exists")
        self.assertEqual((self.root / "book.xlsx").read_bytes(), b"original")

    def test_concurrent_customer_file_is_never_replaced(self):
        target = output_path(self.root, "OCADE output/" + os.urandom(8).hex() + ".txt")
        exists = Path.exists

        def customer_writes_after_check(path):
            was_present = exists(path)
            if path == target and not was_present:
                path.write_bytes(b"customer work")
            return was_present

        # Deterministic interleaving: another writer creates the destination after
        # the last existence check, before publication. These are real files.
        with patch.object(Path, "exists", customer_writes_after_check):
            with self.assertRaises(Refused) as caught:
                write_atomically(target, lambda temporary: temporary.write_bytes(b"agent output"))
        self.assertEqual(caught.exception.code, "output_exists")
        self.assertEqual(target.read_bytes(), b"customer work")
        self.assertEqual(list(target.parent.glob(".ocade-*")), [])

    def test_interrupted_write_leaves_nothing(self):
        target = output_path(self.root, "OCADE output/t/half.xlsx")

        def crash(tmp):
            tmp.write_bytes(b"half")
            raise RuntimeError("power cut")

        with self.assertRaises(RuntimeError):
            write_atomically(target, crash)
        self.assertFalse(target.exists())
        self.assertEqual(list(target.parent.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
