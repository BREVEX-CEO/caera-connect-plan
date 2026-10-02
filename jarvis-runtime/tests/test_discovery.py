"""Discovery for the universal engine: any app's official surfaces, drives, files by name,
copies past the work folder, and sanitized local recipes."""
import os
import sys
import tempfile
import threading
import unittest
import unittest.mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["OCADE_JARVIS_HOME"] = tempfile.mkdtemp()
import ocade_discovery  # noqa: E402
from ocade_computer import Computer, installed_apps  # noqa: E402


class RecipeTest(unittest.TestCase):
    def setUp(self):
        ocade_discovery.HOME = Path(tempfile.mkdtemp())

    def test_a_recipe_keeps_how_and_never_where_or_who(self):
        good = {"app": "Paint", "route": "File > Open by keyboard, then Resize from the Home ribbon",
                "steps": ["ctrl+o and type the file name", "Resize: percentage 50"], "verify": "Image size reads 50%"}
        self.assertEqual(ocade_discovery.save_recipe(good, "11.2.0")["status"], "done")
        for bad in ({"steps": ["click at (412, 300)"]}, {"steps": ["x=412 then y=300"]},
                    {"verify": "signed in as someone@example.com"}, {"route": "type the code 493021"},
                    {"recovery": "use the API key from settings"}, {"route": r"open C:\Users\ann\secret.docx"}):
            self.assertEqual(ocade_discovery.save_recipe({**good, **bad}, "11.2.0")["status"], "blocked", bad)
        self.assertEqual(ocade_discovery.save_recipe({"app": "Paint"}, None)["status"], "failed")

    def test_a_new_major_version_hides_old_recipes(self):
        recipe = {"app": "Paint", "route": "ribbon", "steps": [], "verify": "size reads 50%"}
        ocade_discovery.save_recipe(recipe, "11.2.0")
        same, older = ocade_discovery.recipes_for("paint", "11.9.1")
        self.assertEqual((len(same), older), (1, 0))
        same, older = ocade_discovery.recipes_for("Paint", "12.0.0")
        self.assertEqual((len(same), older), (0, 1))


class FilesTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        self.root = self.home / "work"
        self.root.mkdir()
        self.outside = self.home / "Documents"
        self.outside.mkdir()
        (self.outside / "report.xlsx").write_bytes(b"original")
        self.pc = Computer(str(self.root))

    def test_locate_finds_names_only_and_stops(self):
        with unittest.mock.patch.object(ocade_discovery, "_roots", return_value=[self.home]):
            found = ocade_discovery.locate("report", "xlsx", threading.Event())
            self.assertEqual([Path(f["path"]).name for f in found], ["report.xlsx"])
            self.assertNotIn("content", found[0])
            stop = threading.Event()
            stop.set()
            self.assertEqual(ocade_discovery.locate("", "", stop), [])

    def test_a_copy_comes_in_and_a_finished_copy_goes_out_never_over_a_file(self):
        source = str(self.outside / "report.xlsx")
        ask = self.pc.run({"action": "file_import", "from": source})
        self.assertEqual(ask["status"], "needs_confirmation")
        first = self.pc.run({"action": "file_import", "from": source}, confirmed=True)
        second = self.pc.run({"action": "file_import", "from": source}, confirmed=True)
        self.assertEqual((first["path"], second["path"]),
                         (os.path.join("imports", "report.xlsx"), os.path.join("imports", "report (2).xlsx")))
        (self.root / first["path"]).write_bytes(b"completed")
        self.assertEqual((self.outside / "report.xlsx").read_bytes(), b"original")
        out = {"action": "file_export", "path": first["path"], "to": str(self.outside),
               "name": "report - completed.xlsx"}
        self.assertEqual(self.pc.run(out)["status"], "needs_confirmation")
        self.assertEqual(self.pc.run(out, confirmed=True)["status"], "done")
        self.assertEqual((self.outside / "report - completed.xlsx").read_bytes(), b"completed")
        again = self.pc.run(out, confirmed=True)
        self.assertEqual(again["status"], "failed")
        self.assertIn("nothing was overwritten", again["summary"])
        clash = self.pc.run({**out, "name": "report.xlsx"}, confirmed=True)
        self.assertEqual(clash["status"], "failed")
        self.assertEqual((self.outside / "report.xlsx").read_bytes(), b"original")
        self.assertEqual(self.pc.run({**out, "name": "..\\x.xlsx"}, confirmed=True)["status"], "failed")
        # Only a work-folder file goes out.
        self.assertEqual(self.pc.run({**out, "path": "../Documents/report.xlsx"}, confirmed=True)["status"],
                         "blocked")
        self.assertEqual(self.pc.run({"action": "undo"})["status"], "done")
        self.assertFalse((self.outside / "report - completed.xlsx").exists())


@unittest.skipUnless(sys.platform == "win32", "Windows app registration")
class AppInfoTest(unittest.TestCase):
    def test_an_app_is_described_from_the_computer_itself(self):
        apps = installed_apps()
        app = next(a for a in apps if a["name"] == "Notepad")
        info = ocade_discovery.app_info(app)
        self.assertTrue(info["program"].lower().endswith(".exe"), info)
        self.assertRegex(info["version"] or "", r"^\d+\.\d+")
        drives = ocade_discovery.drives()
        self.assertTrue(any(d["kind"] == "fixed" for d in drives), drives)
        pc = Computer(tempfile.mkdtemp())
        out = pc.run({"action": "app_info", "name": "Notepad"})
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(pc.run({"action": "app_info", "name": "No Such App"})["status"], "failed")


if __name__ == "__main__":
    unittest.main()
