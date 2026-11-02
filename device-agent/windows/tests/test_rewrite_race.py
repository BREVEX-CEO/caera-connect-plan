"""An in-place repair never silently replaces a version the person saved meanwhile (D7).

The race is simulated deterministically: a save lands exactly when the writer moves files.
Disposable temporary folders only.
"""

import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ocade_agent import office_worker
from ocade_agent.sandbox import Refused


class RewriteRace(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.target = self.root / (os.urandom(6).hex() + ".py")
        self.target.write_text("print('old')\n", encoding="utf-8")
        self.read = hashlib.sha256(self.target.read_bytes()).hexdigest()
        workspace = patch.object(office_worker, "WORKSPACE", str(self.root))
        workspace.start()
        self.addCleanup(workspace.stop)

    def saving_during(self, name):
        """os.rename/os.replace that let the person's save land first, once, on the target."""
        real = getattr(os, name)
        saved = []

        def racing(src, dst, *args, **kwargs):
            touches = {os.fspath(src), os.fspath(dst)} & {str(self.target), self.target.name}
            if touches and not saved:
                self.target.write_text("print('person saved this')\n", encoding="utf-8")
                saved.append(True)
            return real(src, dst, *args, **kwargs)

        return patch.object(os, name, racing)

    def test_a_save_during_the_swap_is_kept_and_reported(self):
        with self.saving_during("rename"), self.saving_during("replace"):
            with self.assertRaises(Refused) as refused:
                office_worker._rewrite(self.target.name, self.read, lambda _: "print('repaired')\n")
        self.assertIn(refused.exception.code, ("file_changed", "file_changed_during_write"))
        self.assertEqual(self.target.read_text(encoding="utf-8"), "print('person saved this')\n")
        self.assertEqual([p.name for p in self.root.iterdir() if p.name.startswith(".ocade-")], [])

    def test_a_late_save_through_an_open_handle_wins_and_is_reported(self):
        real = {name: getattr(os, name) for name in ("link", "rename")}

        def publishing(name):
            def racing(src, dst, *args, **kwargs):
                if os.fspath(dst) == str(self.target) and ".ocade-" in os.fspath(src):
                    # The person's editor, holding the file it opened earlier, saves now.
                    Path(os.fspath(src) + ".was").write_text("print('late save')\n", encoding="utf-8")
                return real[name](src, dst, *args, **kwargs)
            return patch.object(os, name, racing)

        with publishing("link"), publishing("rename"):
            with self.assertRaises(Refused) as refused:
                office_worker._rewrite(self.target.name, self.read, lambda _: "print('repaired')\n")
        self.assertEqual(refused.exception.code, "file_changed_during_write")
        self.assertEqual(self.target.read_text(encoding="utf-8"), "print('late save')\n")
        self.assertEqual([p.name for p in self.root.iterdir() if p.name.startswith(".ocade-")], [])

    def test_without_a_race_the_repair_lands_and_the_original_is_kept(self):
        result = office_worker._rewrite(self.target.name, self.read, lambda _: "print('repaired')\n")
        self.assertEqual(self.target.read_text(encoding="utf-8"), "print('repaired')\n")
        self.assertEqual((self.root / result["original"]).read_text(encoding="utf-8"), "print('old')\n")
        self.assertEqual([p.name for p in self.root.iterdir() if p.name.startswith(".ocade-")], [])


if __name__ == "__main__":
    unittest.main()
