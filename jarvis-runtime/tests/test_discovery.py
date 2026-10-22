"""Discovery for the universal engine: any app's official surfaces, drives, files by name,
copies past the work folder, and sanitized local recipes."""
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import re
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
                    {"recovery": "use the API key from settings"}, {"route": r"open C:\Users\ann\secret.docx"},
                    {"route": r"open C:\Users\ann\report.docx"}, {"steps": ["open /home/ann/report.odt"]}):
            self.assertEqual(ocade_discovery.save_recipe({**good, **bad}, "11.2.0")["status"], "blocked", bad)
        self.assertEqual(ocade_discovery.save_recipe({"app": "Paint"}, None)["status"], "failed")

    def test_a_new_major_version_hides_old_recipes(self):
        recipe = {"app": "Paint", "route": "ribbon", "steps": [], "verify": "size reads 50%"}
        ocade_discovery.save_recipe(recipe, "11.2.0")
        same, older = ocade_discovery.recipes_for("paint", "11.9.1")
        self.assertEqual((len(same), older), (1, 0))
        same, older = ocade_discovery.recipes_for("Paint", "12.0.0")
        self.assertEqual((len(same), older), (0, 1))

    def test_a_recipe_declares_the_inputs_its_steps_use(self):
        """P10: typed inputs; a step naming an input nobody declared is refused."""
        recipe = {"app": "Paint", "route": "open {source}", "steps": ["resize {source} by {pct}"],
                  "verify": "size read back", "inputs": [{"name": "source", "kind": "file"},
                                                          {"name": "pct", "kind": "number"}]}
        self.assertEqual(ocade_discovery.save_recipe(recipe, "11.2.0")["status"], "done")
        self.assertEqual(ocade_discovery.recipes_for("Paint", "11.2.0")[0][0]["inputs"], recipe["inputs"])
        undeclared = {**recipe, "inputs": [{"name": "source", "kind": "file"}]}
        self.assertIn("pct", ocade_discovery.save_recipe(undeclared, "11.2.0")["summary"])
        self.assertEqual(ocade_discovery.save_recipe(
            {**recipe, "inputs": [{"name": "Source!", "kind": "file"}]}, "11.2.0")["status"], "failed")

    def test_a_recipe_that_keeps_failing_is_set_aside_until_one_works(self):
        """P10: a failed recipe is quarantined; it is never offered again as if it worked."""
        recipe = {"app": "Paint", "route": "ribbon", "steps": [], "verify": "size reads 50%"}
        ocade_discovery.save_recipe(recipe, "11.2.0")
        failed = {**recipe, "worked": False}
        ocade_discovery.save_recipe(failed, "11.2.0")
        self.assertEqual(len(ocade_discovery.recipes_for("Paint", "11.2.0")[0]), 1)  # once may be chance
        out = ocade_discovery.save_recipe(failed, "11.2.0")
        self.assertIn("set aside", out["summary"])
        self.assertEqual(ocade_discovery.recipes_for("Paint", "11.2.0"), ([], 1))
        ocade_discovery.save_recipe(recipe, "11.2.0")  # a way that works again
        self.assertEqual(len(ocade_discovery.recipes_for("Paint", "11.2.0")[0]), 1)
        self.assertIn("No recipe", ocade_discovery.save_recipe({**failed, "app": "Gimp"}, None)["summary"])


    def test_another_tasks_recipe_is_kept_beside_and_unknown_versions_stay_apart(self):
        """Audit E08: one recipe per way of doing a thing; an unknown version is its own line."""
        resize = {"app": "Paint", "route": "ribbon resize", "steps": [], "verify": "size reads 50%"}
        crop = {"app": "Paint", "route": "select then crop", "steps": [], "verify": "width reads 400"}
        ocade_discovery.save_recipe(resize, "11.2.0")
        ocade_discovery.save_recipe(crop, "11.2.0")
        routes = {r["route"] for r in ocade_discovery.recipes_for("Paint", "11.2.0")[0]}
        self.assertEqual(routes, {"ribbon resize", "select then crop"})
        ocade_discovery.save_recipe({**resize, "route": "menu resize"}, None)  # version unknown then
        self.assertNotIn("menu resize",
                         {r["route"] for r in ocade_discovery.recipes_for("Paint", "11.2.0")[0]})
        self.assertEqual([r["route"] for r in ocade_discovery.recipes_for("Paint", None)[0]],
                         ["menu resize"])


class CapabilityCacheTest(unittest.TestCase):
    """PLAN.md section F: an app's surfaces are found once per program build."""

    def setUp(self):
        ocade_discovery.HOME = Path(tempfile.mkdtemp())

    @unittest.skipUnless(sys.platform == "win32", "program discovery reads Windows executables")
    def test_found_once_per_build_and_again_when_the_program_changes(self):
        program = Path(tempfile.mkdtemp()) / "tool.exe"
        program.write_bytes(Path(sys.executable).read_bytes())
        looked = []
        with unittest.mock.patch.object(ocade_discovery, "_com_servers",
                                        lambda name: looked.append(name) or ["Tool.Application"]):
            app = {"name": "Tool", "launch": str(program)}
            first = ocade_discovery.app_info(app)
            again = ocade_discovery.app_info(app)
            self.assertEqual(len(looked), 1)
            self.assertEqual(again["automation"], first["automation"])
            os.utime(program, (1_000_000, 1_000_000))  # updated or reinstalled
            ocade_discovery.app_info(app)
            self.assertEqual(len(looked), 2)
        # A look cut short by STOP is never kept.
        cancel = threading.Event()
        cancel.set()
        ocade_discovery.HOME = Path(tempfile.mkdtemp())
        ocade_discovery.app_info(app, cancel)
        self.assertFalse((ocade_discovery.HOME / "capabilities.json").exists())


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
        startup = self.home / "AppData" / "Startup"
        startup.mkdir(parents=True)
        self.assertEqual(self.pc.run({**out, "to": str(startup), "name": "x.xlsx"}, confirmed=True)["status"],
                         "blocked")
        if sys.platform == "win32":
            self.assertEqual(self.pc.run({**out, "to": os.environ["SYSTEMROOT"], "name": "x.xlsx"},
                                         confirmed=True)["status"], "blocked")
        for name in ("nul", "CON.txt", "a.txt:hidden"):
            self.assertEqual(self.pc.run({"action": "file_import", "from": source, "to": name},
                                         confirmed=True)["status"], "blocked", name)
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


class SurfacesTest(unittest.TestCase):
    """Found on this computer: Magnify (System32) was offered printer scripts and driver
    folders, Skype for Business (Office16) Excel's Python folder, and "Files" from a
    three-app Store package was described as People."""

    def test_only_folders_that_belong_to_the_program(self):
        windows = Path(os.environ.get("SystemRoot", r"C:\Windows"))
        self.assertEqual(ocade_discovery._surfaces(windows / "System32", "magnify.exe"), [])
        shared = Path(tempfile.mkdtemp())
        for i in range(12):
            (shared / f"tool{i}.exe").write_bytes(b"")
        (shared / "plugins").mkdir()
        (shared / "excel_python_scripts").mkdir()
        self.assertEqual([Path(f).name for f in ocade_discovery._surfaces(shared, str(shared / "EXCEL.EXE"))],
                         ["excel_python_scripts"])
        self.assertEqual(ocade_discovery._surfaces(shared, str(shared / "lync.exe")), [])
        own = Path(tempfile.mkdtemp())
        (own / "app.exe").write_bytes(b"")
        (own / "plugins").mkdir()
        self.assertEqual([Path(f).name for f in ocade_discovery._surfaces(own, str(own / "app.exe"))], ["plugins"])

    def test_the_vendor_sdk_folder_and_its_readme_are_found_for_a_busy_program_folder(self):
        # Resolve: many helper programs beside Resolve.exe, its scripting SDK under ProgramData.
        base = Path(tempfile.mkdtemp())
        program = base / "pf" / "Vendor" / "Editor"
        program.mkdir(parents=True)
        for i in range(12):
            (program / f"helper{i}.exe").write_bytes(b"")
        sdk = base / "pd" / "Vendor" / "Editor" / "Support" / "Developer"
        (sdk / "Codec").mkdir(parents=True)
        (sdk / "Codec" / "README.txt").write_text("codec plugins")
        (sdk / "Scripting").mkdir()
        (sdk / "Scripting" / "README.txt").write_text("import EditorScript; app = EditorScript.scriptapp()")
        with unittest.mock.patch.dict(os.environ, {"ProgramFiles": str(base / "pf"), "ProgramData": str(base / "pd"),
                                                   "ProgramFiles(x86)": "", "APPDATA": "", "LOCALAPPDATA": ""}):
            found = ocade_discovery._surfaces(program, str(program / "Editor.exe"))
        self.assertIn(str(sdk), found)
        readmes = ocade_discovery._readme(str(sdk))["readmes"]
        self.assertIn("scriptapp", readmes[0]["start"])

    @unittest.skipUnless(sys.platform == "win32", "Store app packages and their paths are Windows only")
    def test_the_launched_app_of_a_package_not_the_first(self):
        package = Path(tempfile.mkdtemp())
        (package / "AppxManifest.xml").write_text(
            '<Package><Applications>'
            '<Application Id="People" Executable="People\\PeopleLauncher.exe" EntryPoint="x"/>'
            '<Application EntryPoint="y" Executable="Files\\FilesLauncher.exe" Id="Files"/>'
            '<Application Id="Web" StartPage="https://example.com"/>'
            '</Applications></Package>', encoding="utf-8")
        done = unittest.mock.Mock(stdout=str(package))
        with unittest.mock.patch("subprocess.run", return_value=done):
            program = ocade_discovery._package_program
            self.assertEqual(program("Microsoft.M365Companions_8wekyb3d8bbwe!Files"),
                             str(package / "Files" / "FilesLauncher.exe"))
            self.assertEqual(program("Microsoft.M365Companions_8wekyb3d8bbwe!People"),
                             str(package / "People" / "PeopleLauncher.exe"))
            self.assertIsNone(program("Microsoft.M365Companions_8wekyb3d8bbwe!Web"))
            self.assertIsNone(program("Microsoft.M365Companions_8wekyb3d8bbwe!Nope"))


if __name__ == "__main__":
    unittest.main()


class NoAppNameShortcutTest(unittest.TestCase):
    """PLAN Phase 11: apps are discovered and qualified, never special-cased by name. A string
    naming a particular product in the runtime's code is a shortcut that works for one app and
    fails silently for the next version or the next app."""

    APPS = re.compile(r"""["'](?:[^"'\n]*\b)?(notepad|winword|excel|powerpnt|outlook|mspaint|"""
                      r"""photoshop|chrome|msedge|firefox|vlc|spotify)(?:\.exe)?\b[^"'\n]*["']""",
                      re.IGNORECASE)

    def test_the_runtime_names_no_application_in_its_code(self):
        root = Path(__file__).resolve().parents[1]
        found = []
        for source in [*root.glob("ocade_*.py"), *root.glob("actions/*.py")]:
            for number, line in enumerate(source.read_text(encoding="utf-8").splitlines(), 1):
                code = line.split("#", 1)[0]
                if self.APPS.search(code) and not code.lstrip().startswith(('"""', "'''")):
                    found.append(f"{source.name}:{number}: {line.strip()[:120]}")
        self.assertEqual(found, [], "\n".join(found))


class CommandLineProgramTest(unittest.TestCase):
    def test_a_command_on_path_is_found_by_name_and_never_run(self):
        pc = Computer(tempfile.mkdtemp())
        found = pc.run({"action": "app_info", "name": "python3"})
        self.assertEqual(found["status"], "done", found)
        self.assertTrue(found["app"]["commandLine"])
        self.assertTrue(Path(found["app"]["program"]).is_file())
        for name in ("no-such-program-ocade", "../bin/sh", "sh; rm -rf /"):
            self.assertEqual(pc.run({"action": "app_info", "name": name})["status"], "failed", name)


@unittest.skipUnless(shutil.which("ffmpeg") and sys.platform != "win32", "needs ffmpeg off Windows")
class MediaPropertiesTest(unittest.TestCase):
    def test_a_video_reports_its_length_and_size(self):
        root = Path(tempfile.mkdtemp())
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=black:s=320x240:r=25:d=2",
                        str(root / "clip.mp4")], check=True)
        (root / "notes.txt").write_text("not media")
        pc = Computer(str(root))
        props = pc.run({"action": "file_info", "path": "clip.mp4"})["info"]["properties"]
        self.assertEqual((props["width"], props["height"], props["fps"]), (320, 240, 25))
        self.assertAlmostEqual(props["seconds"], 2, delta=0.1)
        self.assertNotIn("properties", pc.run({"action": "file_info", "path": "notes.txt"})["info"])

    def test_audio_loudness_and_true_peak_are_measured_when_asked(self):
        root = Path(tempfile.mkdtemp())
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
                        "-af", "volume=-12dB", str(root / "tone.m4a")], check=True)
        pc = Computer(str(root))
        plain = pc.run({"action": "file_info", "path": "tone.m4a"})["info"]["properties"]
        self.assertNotIn("truePeakDBTP", plain)  # seconds of work: only when asked
        props = pc.run({"action": "file_info", "path": "tone.m4a", "audio": True})["info"]["properties"]
        self.assertLess(props["truePeakDBTP"], -10)
        self.assertLess(props["loudnessLUFS"], -10)
