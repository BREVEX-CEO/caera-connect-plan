"""OCADE computer control: workspace scope, commands, confirmations, apps and the screen.

Run: xvfb-run -a python -m unittest discover -s jarvis-runtime/tests -p 'test_computer.py'
The screen tests need a display and skip without one.
"""
import importlib
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import unittest.mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import conftest  # noqa: E402,F401  test isolation for unittest runs too, not only pytest
import ocade_computer  # noqa: E402
from conftest import live  # noqa: E402
from ocade_computer import Computer  # noqa: E402


class WorkspaceTest(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp()
        os.environ["HOME"] = self.home  # the Trash lives in this throwaway home
        os.environ.pop("XDG_DATA_HOME", None)
        # send2trash finds its Trash once, on import: found again here for this home.
        for name in ("send2trash.plat_other", "send2trash"):
            if name in sys.modules:
                importlib.reload(sys.modules[name])
        self.root = Path(self.home, "project")
        self.root.mkdir()
        (self.root / "notes.md").write_text("hello")
        self.outside = Path(self.home, "secret.txt")
        self.outside.write_text("private")
        (self.root / "link").symlink_to(self.outside)
        self.pc = Computer(str(self.root))

    def test_paths_never_leave_the_workspace(self):
        for path in ("../secret.txt", str(self.outside), "link", "sub/../../secret.txt"):
            out = self.pc.run({"action": "file_read", "path": path})
            self.assertEqual(out["status"], "blocked", path)
        self.assertEqual(Computer(None).run({"action": "file_list", "path": "."})["status"], "blocked")

    def test_reads_writes_lists_and_prefers_the_trash(self):
        self.assertEqual(self.pc.run({"action": "file_read", "path": "notes.md"})["content"], "hello")
        self.assertEqual(self.pc.run({"action": "file_write", "path": "src/a.py",
                                      "content": "print(1)"})["status"], "done")
        self.assertEqual((self.root / "src/a.py").read_text(), "print(1)")
        names = [e["name"] for e in self.pc.run({"action": "file_list", "path": "."})["entries"]]
        self.assertIn("src", names)
        self.assertEqual(self.pc.run({"action": "file_trash", "path": "notes.md"})["status"], "done")
        self.assertFalse((self.root / "notes.md").exists())
        if sys.platform.startswith("linux"):  # elsewhere it is the system Recycle Bin / Trash
            self.assertTrue(any(Path(self.home, ".local/share/Trash/files").iterdir()))
        self.assertEqual(self.pc.run({"action": "file_trash", "path": "."})["status"], "blocked")

    def test_stop_while_a_change_is_prepared_changes_nothing(self):
        """C05: STOP arriving after the checks and the backup still lands before the effect."""
        stop = threading.Event()
        keep = self.pc._keep

        def slow_keep(path):  # the backup of a big file is where a STOP can arrive
            kept = keep(path)
            stop.set()
            return kept
        self.pc._keep = slow_keep
        out = self.pc.run({"action": "file_write", "path": "notes.md", "content": "new"}, cancel=stop)
        self.assertTrue(out.get("stopped"), out)
        self.assertEqual((self.root / "notes.md").read_text(), "hello")
        self.assertEqual([p.name for p in self.root.iterdir() if p.name.startswith(".ocade-")], [])
        stop.clear()
        real_inside = self.pc._inside

        def stop_on_target(raw, change=False):  # STOP while the move's two ends are checked
            if raw == "moved.md":
                stop.set()
            return real_inside(raw, change)
        self.pc._inside = stop_on_target
        out = self.pc.run({"action": "file_move", "path": "notes.md", "to": "moved.md"}, cancel=stop)
        self.assertTrue(out.get("stopped"), out)
        self.assertTrue((self.root / "notes.md").exists())
        self.assertFalse((self.root / "moved.md").exists())

    def test_permanent_deletion_needs_the_person(self):
        out = self.pc.run({"action": "file_delete", "path": "src"})
        self.assertEqual(out["status"], "needs_confirmation")
        self.pc.run({"action": "file_write", "path": "src/a.py", "content": "x"})
        self.assertEqual(self.pc.run({"action": "file_delete", "path": "src"}, confirmed=True)["status"], "done")
        self.assertFalse((self.root / "src").exists())

    def test_commands_run_in_the_workspace_and_cannot_write_outside_it(self):
        if self.pc.sandbox is None:
            self.assertEqual(self.pc.run({"action": "run", "command": "echo x"})["status"], "blocked")
            return
        if self.pc.sandbox == "workspace":
            self.skipTest("direct runner: see DirectCommandTest")
        (self.root / "link").unlink()  # a link makes the list incomplete; checked below
        out = self.pc.run({"action": "run", "command": "pwd && echo built > out.txt"})
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(out["stdout"].strip().splitlines()[0], str(self.root))
        self.assertEqual((self.root / "out.txt").read_text().strip(), "built")
        self.assertEqual(out["wrote"], ["out.txt"])  # what the command made is said (CAD-22-01)
        self.assertIs(out["wroteAll"], True)
        # A removed file counts as touched; a file the command never touched is not listed.
        (self.root / "keep.txt").write_text("k")
        gone = self.pc.run({"action": "run", "command": "rm out.txt"})
        self.assertEqual((gone["wrote"], gone["wroteAll"]), (["out.txt"], True))
        # A link could reach what the list cannot see: then the list is never called complete.
        (self.root / "alias").symlink_to(self.root / "keep.txt")
        self.assertNotIn("wroteAll", self.pc.run({"action": "run", "command": "true"}))
        probe = Path(__file__).resolve().parent / "escaped-probe.txt"
        escape = self.pc.run({"action": "run", "command": f"echo x > {probe}"})
        self.assertEqual(escape["status"], "failed")
        self.assertFalse(probe.exists())
        self.pc.run({"action": "run", "command": f"echo x > {self.home}/escaped.txt"})
        self.assertFalse(Path(self.home, "escaped.txt").exists())
        self.assertEqual(self.pc.run({"action": "run", "command": "exit 3"})["exitCode"], 3)
        self.assertEqual(self.pc.run({"action": "run", "command": "ls", "cwd": ".."})["status"], "blocked")

    def test_a_runaway_command_is_stopped(self):
        if self.pc.sandbox is None:
            self.skipTest("no terminal on this computer")
        (self.root / "forever.py").write_text("import time\nwhile True:\n    time.sleep(1)\n")
        command = "sleep 30" if self.pc.sandbox == "bubblewrap" else "python forever.py"
        old = ocade_computer.RUN_TIMEOUT_S
        ocade_computer.RUN_TIMEOUT_S = 1
        try:
            started = time.monotonic()
            out = self.pc.run({"action": "run", "command": command}, confirmed=True)
        finally:
            ocade_computer.RUN_TIMEOUT_S = old
        self.assertEqual(out["status"], "failed")
        self.assertLess(time.monotonic() - started, 10)


    def test_a_repositorys_own_settings_and_hooks_are_never_written(self):
        (self.root / ".git" / "hooks").mkdir(parents=True)
        (self.root / ".git" / "config").write_text("[core]\n")
        for action in ({"action": "file_write", "path": ".git/hooks/pre-commit", "content": "x"},
                       {"action": "file_write", "path": "sub/../.git/config", "content": "x"},
                       {"action": "file_mkdir", "path": ".GIT/hooks2"},
                       {"action": "file_move", "path": "notes.md", "to": ".git/hooks/post-checkout"},
                       {"action": "file_rename", "path": ".git/config", "name": "config.old"},
                       {"action": "file_trash", "path": ".git/config"}):
            self.assertEqual(self.pc.run(action)["status"], "blocked", action)
        self.assertEqual((self.root / ".git" / "config").read_text(), "[core]\n")
        self.assertEqual(self.pc.run({"action": "file_read", "path": ".git/config"})["status"], "done")

    def test_stop_ends_long_file_work(self):
        import threading
        stop = threading.Event()
        stop.set()
        for i in range(30):
            (self.root / "big" / f"d{i}").mkdir(parents=True)
            (self.root / "big" / f"d{i}" / "f.txt").write_text("x")
        found = self.pc.run({"action": "file_find", "path": ".", "name": "f"}, cancel=stop)
        self.assertTrue(found.get("stopped"), found)
        copied = self.pc.run({"action": "file_copy", "path": "big", "to": "big2"}, cancel=stop)
        self.assertTrue(copied.get("stopped"), copied)
        self.assertFalse((self.root / "big2").exists())

    def test_stop_ends_the_wait_for_an_app_list(self):
        import threading
        stop = threading.Event()
        threading.Timer(0.3, stop.set).start()
        ocade_computer._APPS.update(at=float("-inf"), list=[])
        with unittest.mock.patch.object(ocade_computer, "installed_apps",
                                        side_effect=lambda: time.sleep(5) or []):
            started = time.monotonic()
            out = self.pc.run({"action": "open_app", "name": "Nothing"}, cancel=stop)
        self.assertTrue(out.get("stopped"), out)
        self.assertLess(time.monotonic() - started, 2)

    def test_the_persons_input_pauses_what_takes_the_foreground(self):
        self.pc.guard.start = lambda: True
        self.pc.guard.user_input_at = time.monotonic()
        for action in ({"action": "open_app", "name": "Nothing"},
                       {"action": "window", "title": "Nothing"},
                       {"action": "sheet_edit", "path": "a.xlsx", "ops": []},
                       {"action": "doc_edit", "path": "a.docx", "ops": []}):
            self.assertEqual(self.pc.run(action)["status"], "needs_confirmation", action)
            # Continue (the person's confirmation of this step) lets it through, once.
            self.assertNotEqual(self.pc.run(action, confirmed=True)["status"], "needs_confirmation")
            self.pc.guard.user_input_at = time.monotonic()

    def test_system_changes_wait_for_the_person(self):
        os.environ["OCADE_JARVIS_DRY_SYSTEM"] = "1"
        out = self.pc.run({"action": "system", "op": "restart"})
        self.assertEqual(out["status"], "needs_confirmation")
        self.assertIn("Would run", self.pc.run({"action": "system", "op": "restart"}, confirmed=True)["summary"])


class UndoTest(unittest.TestCase):
    """Undo: act at once, remember how to reverse it, newest first."""

    def setUp(self):
        self.home = tempfile.mkdtemp()
        os.environ["OCADE_JARVIS_HOME"] = str(Path(self.home, "agent"))
        self.root = Path(self.home, "project")
        self.root.mkdir()
        (self.root / "notes.md").write_text("first")
        self.pc = Computer(str(self.root))

    def do(self, **action):
        out = self.pc.run(action)
        self.assertEqual(out["status"], "done", out)
        return out

    def test_a_copied_folder_the_person_changed_afterwards_is_never_undone_away(self):
        """V21: a folder's fingerprint was the word "folder", so undoing a folder copy trashed
        whatever the person had added to or edited inside it since."""
        (self.root / "src").mkdir()
        (self.root / "src" / "a.txt").write_text("one")
        for change in (lambda d: (d / "a.txt").write_text("edited by the person"),
                       lambda d: (d / "new.txt").write_text("added by the person"),
                       lambda d: (d / "a.txt").rename(d / "renamed.txt")):
            self.do(action="file_copy", path="src", to="copy")
            change(self.root / "copy")
            before = {p.name: p.read_text() for p in (self.root / "copy").iterdir()}
            out = self.pc.run({"action": "undo"})
            self.assertEqual(out["status"], "failed", out)
            self.assertIn("changed after", out["summary"])
            self.assertEqual({p.name: p.read_text() for p in (self.root / "copy").iterdir()}, before)
            shutil.rmtree(self.root / "copy")
        # Untouched since the copy: undo removes it as before.
        self.do(action="file_copy", path="src", to="copy")
        self.do(action="undo")
        self.assertFalse((self.root / "copy").exists())

    def test_every_file_change_is_reversed_newest_first(self):
        self.do(action="file_write", path="notes.md", content="second")  # an overwrite
        self.do(action="file_write", path="new.txt", content="x")        # a new file
        self.do(action="file_mkdir", path="drafts")
        self.do(action="file_move", path="notes.md", to="drafts")
        self.do(action="file_rename", path="drafts/notes.md", name="plan.md")
        self.do(action="file_copy", path="drafts/plan.md", to="copy.md")
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), ["copy.md", "drafts", "new.txt"])

        self.assertIn("copying", self.do(action="undo")["summary"])
        self.assertFalse((self.root / "copy.md").exists())
        self.do(action="undo")  # the rename
        self.assertTrue((self.root / "drafts/notes.md").is_file())
        self.do(action="undo")  # the move
        self.assertEqual((self.root / "notes.md").read_text(), "second")
        self.do(action="undo")  # the folder
        self.assertFalse((self.root / "drafts").exists())
        self.do(action="undo")  # the new file
        self.assertFalse((self.root / "new.txt").exists())
        self.assertEqual(self.do(action="undo")["remaining"], 0)  # the overwrite
        self.assertEqual((self.root / "notes.md").read_text(), "first")
        out = self.pc.run({"action": "undo"})
        self.assertEqual(out["status"], "failed")
        self.assertIn("nothing to undo", out["summary"])

    def test_an_undo_never_overwrites_what_appeared_since(self):
        self.do(action="file_move", path="notes.md", to="moved.md")
        (self.root / "notes.md").write_text("the person wrote this meanwhile")
        out = self.pc.run({"action": "undo"})
        self.assertEqual(out["status"], "failed")
        self.assertIn("nothing was overwritten", out["summary"])
        self.assertEqual((self.root / "notes.md").read_text(), "the person wrote this meanwhile")
        self.assertEqual((self.root / "moved.md").read_text(), "first")
        # Taken off the list: it is not tried again against files that moved on.
        self.assertIn("nothing to undo", self.pc.run({"action": "undo"})["summary"])

        self.do(action="file_mkdir", path="kept")
        (self.root / "kept/theirs.txt").write_text("x")
        self.assertIn("things in it", self.pc.run({"action": "undo"})["summary"])
        self.assertTrue((self.root / "kept/theirs.txt").is_file())

    def test_an_undo_never_loses_what_the_person_changed_afterwards(self):
        """C10: undo goes ahead only while the result is exactly what JARVIS left."""
        self.do(action="file_write", path="notes.md", content="jarvis")
        (self.root / "notes.md").write_text("jarvis, then the person's own line")
        out = self.pc.run({"action": "undo"})
        self.assertEqual(out["status"], "failed")
        self.assertIn("later changes are kept", out["summary"])
        self.assertEqual((self.root / "notes.md").read_text(), "jarvis, then the person's own line")

        self.do(action="file_write", path="made.txt", content="x")  # a file JARVIS made
        (self.root / "made.txt").write_text("now the person's")
        self.assertEqual(self.pc.run({"action": "undo"})["status"], "failed")
        self.assertTrue((self.root / "made.txt").is_file())

    def test_an_office_save_that_reads_back_differently_is_not_done(self):
        """C12: reopened and read back unlike what was saved is a failure, not success."""
        out = Computer._not_read_back({"ok": True, "reopenChecked": True, "savedAndReopened": False},
                                      "r.docx", "document")
        self.assertEqual(out["status"], "failed")
        self.assertIn("differs", out["summary"])
        self.assertIsNone(Computer._not_read_back({"reopenChecked": True, "savedAndReopened": True},
                                                  "r.docx", "document"))
        # The person's own open document is not closed to manufacture a reopen: read separately.
        self.assertIsNone(Computer._not_read_back({"reopenChecked": False, "savedAndReopened": False},
                                                  "r.docx", "document"))

    def test_only_the_recent_past_is_kept(self):
        for n in range(ocade_computer.UNDO_DEPTH + 3):
            self.do(action="file_mkdir", path=f"d{n}")
        for _ in range(ocade_computer.UNDO_DEPTH):
            self.do(action="undo")
        self.assertEqual(self.pc.run({"action": "undo"})["status"], "failed")
        self.assertEqual(sorted(p.name for p in self.root.iterdir() if p.is_dir()), ["d0", "d1", "d2"])


class SettingsTest(unittest.TestCase):
    """Computer settings and system status, through the system's own interfaces."""

    def test_status_reports_this_computer(self):
        out = Computer(None).run({"action": "system_status"})
        self.assertEqual(out["status"], "done", out)
        facts = out["system"]
        self.assertTrue(0 <= facts["memoryPercent"] <= 100 and facts["memoryTotalGb"] > 0)
        self.assertTrue(0 <= facts["diskPercent"] <= 100 and facts["processes"] > 1)

    def test_a_setting_is_checked_before_and_after_and_wrong_values_change_nothing(self):
        import ocade_settings
        state = {"volume": 40, "mute": False}
        with unittest.mock.patch.dict(ocade_settings._READ, {k: (lambda k=k: state[k]) for k in state}), \
                unittest.mock.patch.dict(ocade_settings._SET,
                                         {k: (lambda v, k=k: state.__setitem__(k, v)) for k in state}):
            pc = Computer(None)
            self.assertEqual(pc.run({"action": "setting", "name": "volume"})["value"], 40)
            out = pc.run({"action": "setting", "name": "volume", "level": 15})
            self.assertEqual((out["status"], out["before"], out["value"]), ("done", 40, 15))
            self.assertEqual(pc.run({"action": "setting", "name": "mute", "on": True})["value"], True)
            for wrong in ({"name": "volume", "on": True}, {"name": "mute", "level": 50},
                          {"name": "wifi", "on": False}, {"name": "volume", "level": "loud"}):
                self.assertEqual(pc.run({"action": "setting", **wrong})["status"], "failed", wrong)
            self.assertEqual(state, {"volume": 15, "mute": True})
            # A system that ignores the change is reported, not assumed.
            with unittest.mock.patch.dict(ocade_settings._SET, {"volume": lambda v: None}):
                out = pc.run({"action": "setting", "name": "volume", "level": 90})
            self.assertEqual(out["status"], "failed")
            self.assertIn("did not change", out["summary"])

    def test_a_failed_or_unreadable_answer_is_unknown_not_off(self):
        """F-163: a command that failed, or said something else, is not a verified "off"."""
        import ocade_settings
        self.assertIs(ocade_settings._flag("Mute: yes", "yes", "no"), True)
        self.assertIs(ocade_settings._flag("Mute: no", "yes", "no"), False)
        with self.assertRaises(ValueError):
            ocade_settings._flag("", "true", "false")
        with self.assertRaises(Exception):
            ocade_settings._out([sys.executable, "-c", "import sys; sys.exit(3)"])
        with unittest.mock.patch.dict(ocade_settings._READ, {"mute": lambda: ocade_settings._flag("", "yes", "no")}):
            self.assertIsNone(ocade_settings.read("mute"))
            self.assertEqual(ocade_settings.setting("mute")["status"], "failed")

    @unittest.skipUnless(sys.platform == "win32", "the real Windows audio endpoint")
    def test_the_real_volume_changes_and_is_put_back(self):
        pc = Computer(None)
        before = pc.run({"action": "setting", "name": "volume"})
        if before["status"] != "done":
            self.skipTest("no audio device on this computer")
        try:
            target = 30 if before["value"] != 30 else 35
            out = pc.run({"action": "setting", "name": "volume", "level": target})
            self.assertEqual((out["status"], out["value"], out["before"]), ("done", target, before["value"]), out)
        finally:
            back = pc.run({"action": "setting", "name": "volume", "level": before["value"]})
        self.assertEqual(back["value"], before["value"])


@unittest.skipUnless(Computer(tempfile.mkdtemp()).sandbox == "workspace",
                     "the direct runner is the Windows/macOS path")
class DirectCommandTest(unittest.TestCase):
    """Windows/macOS: one program, no shell, inside the workspace, killed as a tree on STOP."""

    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        self.root = self.home / "project"
        self.root.mkdir()
        self.pc = Computer(str(self.root))

    def run_(self, command, **kw):
        # The person confirmed it at OCADE, as every command here is.
        kw.setdefault("confirmed", True)
        return self.pc.run({"action": "run", "command": command, **kw.pop("extra", {})}, **kw)

    def test_a_development_command_runs_there_and_reports_its_output(self):
        (self.root / "calc.py").write_text("import os\nprint(21 * 2)\nprint(os.getcwd())\n")
        out = self.run_("python calc.py")
        self.assertEqual(out["status"], "done", out)
        lines = out["stdout"].split()
        self.assertEqual(lines[0], "42")
        self.assertEqual(Path(lines[1]).resolve(), self.root.resolve())
        self.assertEqual(out["isolation"], "workspace")
        (self.root / "fail.py").write_text("raise SystemExit(3)\n")
        self.assertEqual(self.run_("python fail.py")["exitCode"], 3)

    @unittest.skipUnless(sys.platform == "win32", "Windows program paths")
    def test_an_unquoted_program_path_with_spaces_is_one_program(self):
        # Found with DaVinci Resolve: "C:\Program Files\...\Resolve.exe -nogui" read as "C:\Program".
        tools = self.home / "My Tools"
        tools.mkdir()
        (tools / "tool.exe").write_bytes(b"MZ")
        ask = self.run_(f"{tools / 'tool.exe'} -nogui", confirmed=False)
        self.assertEqual(ask["status"], "needs_confirmation", ask)
        self.assertIn("tool.exe -nogui", ask["summary"])
        missing = self.run_(f"{self.home / 'No Such' / 'x.exe'} -nogui", confirmed=False)
        self.assertEqual(missing["status"], "failed", missing)
        self.assertIn("was not found", missing["summary"])

    @live
    @unittest.skipUnless(sys.platform == "win32", "a real screen")
    def test_a_screen_look_names_the_frame_clicks_are_given_in(self):
        obs = self.pc.run({"action": "screen"})["observation"]
        self.assertNotIn("screen", obs)
        self.assertLessEqual(obs["image"]["w"], 1280)
        outside = self.pc.run({"action": "screen_click", "x": obs["image"]["w"] + 5, "y": 5,
                               "observationId": obs["observationId"]}, confirmed=True)
        self.assertEqual(outside["status"], "failed", outside)

    @unittest.skipUnless(sys.platform == "win32", "Windows property system")
    def test_file_info_gives_a_media_files_own_length(self):
        # Found with DaVinci Resolve: a 12-second export was reported cut to 5; nothing could say.
        import wave
        with wave.open(str(self.root / "tone.wav"), "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(8000)
            out.writeframes(b"\x00\x00" * 12000)  # 1.5 seconds
        info = self.pc.run({"action": "file_info", "path": "tone.wav"})["info"]
        self.assertAlmostEqual(info["properties"]["seconds"], 1.5, places=1)
        self.assertEqual(info["properties"]["audioChannels"], 1)
        (self.root / "notes.txt").write_text("plain")
        self.assertNotIn("properties", self.pc.run({"action": "file_info", "path": "notes.txt"})["info"])

    def test_git_works_in_the_workspace(self):
        self.assertEqual(self.run_("git init")["status"], "done")
        status = self.run_("git status --short")
        self.assertEqual(status["status"], "done", status)

    def test_no_shell_no_escape(self):
        for command in ("python a.py && del x", "git log | more", "python a.py > ../out.txt",
                        "echo %USERPROFILE%", "python a.py; calc"):
            self.assertEqual(self.run_(command)["status"], "blocked", command)
        for command in ("python ../outside.py", f"python {self.home / 'outside.py'}",
                        "git -C .. status", "python sub/../../x.py"):
            self.assertEqual(self.run_(command)["status"], "blocked", command)
        self.assertEqual(self.run_("python a.py", extra={"cwd": ".."})["status"], "blocked")

    def test_the_tasks_own_work_runs_and_anything_else_waits_shown_whole(self):
        (self.root / "calc.py").write_text("print(42)\n")
        self.assertEqual(self.run_("python calc.py", confirmed=False)["stdout"].strip(), "42")
        self.assertEqual(self.run_("git init", confirmed=False)["status"], "done")
        for command in ('python -c "print(1)"', "powershell -Command Get-Date", "curl https://example.com"):
            out = self.run_(command, confirmed=False)
            self.assertEqual(out["status"], "needs_confirmation", command)
            self.assertEqual(out["summary"], f"Running {command}")
        # What can never run is refused before anyone is asked.
        self.assertEqual(self.run_("python ../x.py", confirmed=False)["status"], "blocked")
        self.assertEqual(self.run_("no-such-program-ocade")["status"], "failed")

    def test_a_program_found_in_the_work_folder_is_the_tasks_own_and_waits(self):
        planted = self.root / "git.exe"
        planted.write_bytes(b"MZ")
        with unittest.mock.patch.object(ocade_computer.shutil, "which", return_value=str(planted)):
            out = self.run_("git status", confirmed=False)
        self.assertEqual(out["status"], "needs_confirmation", out)

    def test_secrets_stay_out_of_the_command(self):
        os.environ["OCADE_TEST_API_KEY"] = "sk-should-not-leak"
        try:
            (self.root / "env.py").write_text("import os\nprint(os.environ.get('OCADE_TEST_API_KEY'))\n")
            self.assertEqual(self.run_("python env.py")["stdout"].strip(), "None")
        finally:
            os.environ.pop("OCADE_TEST_API_KEY")

    def test_stop_kills_the_whole_tree(self):
        (self.root / "parent.py").write_text(
            "import subprocess, sys, time\n"
            "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])\n"
            "open('child.pid', 'w').write(str(child.pid))\n"
            "time.sleep(60)\n")
        cancel = __import__("threading").Event()
        timer = __import__("threading").Timer(2.0, cancel.set)
        timer.start()
        started = time.monotonic()
        out = self.pc.run({"action": "run", "command": "python parent.py"}, cancel=cancel,
                          confirmed=True)
        self.assertTrue(out.get("stopped"), out)
        self.assertLess(time.monotonic() - started, 10)
        pid = int((self.root / "child.pid").read_text())
        time.sleep(0.5)
        if sys.platform == "win32":
            alive = str(pid) in subprocess.run(["tasklist", "/FI", f"PID eq {pid}"],
                                               capture_output=True, text=True).stdout
        else:
            try:
                os.kill(pid, 0)
                alive = True
            except OSError:
                alive = False
        self.assertFalse(alive, "the command's child kept running after STOP")


class AppsTest(unittest.TestCase):
    @unittest.skipUnless(sys.platform == "win32", "Windows Start apps")
    def test_windows_lists_store_apps_by_their_appsfolder_id(self):
        apps = ocade_computer.installed_apps()
        self.assertTrue(any(a.get("aumid") and "!" in a["launch"] for a in apps))

    @unittest.skipUnless(sys.platform.startswith("linux"), "Linux .desktop entries")
    def test_finds_installed_apps_and_launches_only_those(self):
        data = Path(tempfile.mkdtemp())
        marker = data / "launched"
        (data / "applications").mkdir()
        (data / "applications/proof.desktop").write_text(
            f"[Desktop Entry]\nType=Application\nName=Proof Editor\nExec=touch {marker} %F\n")
        (data / "applications/hidden.desktop").write_text(
            "[Desktop Entry]\nType=Application\nName=Hidden\nNoDisplay=true\nExec=true\n")
        os.environ["XDG_DATA_HOME"] = str(data)
        os.environ["XDG_DATA_DIRS"] = str(data / "none")
        pc = Computer(None)
        self.assertEqual(pc.run({"action": "apps"})["apps"], ["Proof Editor"])
        self.assertEqual(pc.run({"action": "open_app", "name": "proof editor"})["status"], "done")
        for _ in range(50):
            if marker.exists():
                break
            time.sleep(0.1)
        self.assertTrue(marker.exists())
        self.assertEqual(pc.run({"action": "open_app", "name": "Hidden"})["status"], "failed")


def _other_hand(x: int, y: int) -> None:
    """Mouse movement JARVIS did not make: the person's own hand."""
    if sys.platform.startswith("linux"):
        subprocess.run(["xdotool", "mousemove", str(x), str(y)], check=True)
    else:
        # SendInput, like a real mouse: SetCursorPos (pyautogui.moveTo) fires no input hook.
        from pynput.mouse import Controller
        mouse = Controller()
        px, py = mouse.position
        mouse.move(x - px, y - py)


@live
@unittest.skipUnless(os.environ.get("DISPLAY") or sys.platform in ("win32", "darwin"),
                     "needs a display (run under xvfb-run)")
class ScreenTest(unittest.TestCase):
    def setUp(self):
        self.pc = Computer(None)

    def test_click_needs_the_current_observation(self):
        first = self.pc.run({"action": "screen"})
        self.assertEqual(first["status"], "done")
        obs = first["observation"]
        self.assertTrue(obs["frame"])
        self.assertEqual(self.pc.run({"action": "screen_click", "x": 5, "y": 5,
                                      "observationId": "s999"})["status"], "stale")
        fresh = self.pc.run({"action": "screen"})["observation"]["observationId"]
        out = self.pc.run({"action": "screen_click", "x": 5, "y": 5, "observationId": fresh})
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(self.pc.run({"action": "screen_click", "x": 5, "y": 5,
                                      "observationId": fresh})["status"], "stale")

    def test_the_persons_input_pauses_until_continue(self):
        obs = self.pc.run({"action": "screen"})["observation"]["observationId"]
        self.pc.run({"action": "screen_click", "x": 3, "y": 3, "observationId": obs})  # starts the guard
        time.sleep(0.6)
        _other_hand(200, 200)
        time.sleep(0.5)
        look = lambda: self.pc.run({"action": "screen"})["observation"]["observationId"]  # noqa: E731
        keys = {"action": "screen_keys", "keys": ["shift"]}
        paused = self.pc.run({**keys, "observationId": look()})
        self.assertEqual(paused["status"], "needs_confirmation")
        self.assertEqual(self.pc.run({**keys, "observationId": look()}, confirmed=True)["status"], "done")
        time.sleep(0.6)
        _other_hand(100, 100)
        time.sleep(0.5)
        # The person's own input always pauses JARVIS's again.
        self.assertEqual(self.pc.run({**keys, "observationId": look()})["status"],
                         "needs_confirmation")


class NeverAppsTest(unittest.TestCase):
    """Audit E04: an app set to Never is not reached by a command, a window or Office either."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.pc = Computer(str(self.root))

    def test_a_command_starting_a_never_app_is_refused(self):
        program = Path(sys.executable).name
        self.pc.never = {program.lower(): "Python"}
        out = self.pc.run({"action": "run", "command": f"{program} -c print(1)"}, confirmed=True)
        self.assertEqual(out["status"], "blocked", out)
        self.assertIn("Python is set to Never", out["summary"])
        self.pc.never = {}
        self.assertNotIn("set to Never", str(self.pc.run({"action": "run", "command": f"{program} -c print(1)"})))

    def test_the_refusal_names_the_app_only_for_its_program(self):
        self.pc.never = {"editor.exe": "Editor"}
        self.assertIn("Editor", self.pc._never_refusal("C:/Apps/Editor.EXE")["summary"])
        self.assertIsNone(self.pc._never_refusal("C:/Apps/other.exe"))
        self.assertIsNone(self.pc._never_refusal(None))

    def test_no_never_apps_clears_what_was_set(self):
        self.pc.never = {"editor.exe": "Editor"}
        self.pc._never_names = {"editor"}
        self.pc.refuse_apps([])
        self.assertEqual(self.pc.never, {})


class AppNamesTest(unittest.TestCase):
    """Audit C07: apps are found by their own names in any script, and none is hidden by another."""

    def test_names_in_any_script_but_never_control_or_direction_characters(self):
        usable = ocade_computer.app_name_usable
        for name in ("Visual Studio Code", "हिन्दी नोट्स", "日本語エディタ", "Café Pro 2", "O’Reilly Reader"):
            self.assertTrue(usable(name), name)
        for name in ("", "x" * 81, "evil‮exe.txt", "bell", "tab	name", "zero​width"):
            self.assertFalse(usable(name), repr(name))

    def test_two_apps_with_one_name_are_both_listed(self):
        found: dict = {}
        ocade_computer._add_app(found, {"name": "Code", "launch": "a.lnk"}, "Editors")
        ocade_computer._add_app(found, {"name": "Code", "launch": "a.lnk"}, "Editors")  # the same app
        ocade_computer._add_app(found, {"name": "Code", "launch": "b.lnk"}, "Insiders")
        self.assertEqual(sorted(a["name"] for a in found.values()), ["Code", "Code (Insiders)"])


if __name__ == "__main__":
    unittest.main()


class CommandClassTest(unittest.TestCase):
    def test_the_same_cases_ocade_decides(self):
        import json
        cases = json.loads((Path(__file__).resolve().parent / "command_cases.json").read_text())
        for case in cases:
            self.assertEqual(ocade_computer.command_class(case["command"]), case["class"], case["command"])


class MultiMonitorTest(unittest.TestCase):
    """A point in the observed image maps onto the whole desktop, whatever monitor it is on."""

    def test_points_map_through_scale_and_origin(self):
        pc = Computer(None)
        pc._observation = {"id": "s1", "scale": 2.0, "at": time.monotonic(),
                           "geometry": {"x": -1920, "y": 0, "w": 3840, "h": 1080, "monitors": 2,
                                        "window": "x"}}
        self.assertEqual(pc._point(100, 50), (-1920 + 200, 100))    # on the left monitor
        self.assertEqual(pc._point(1500, 10), (-1920 + 3000, 20))   # on the primary
        self.assertIsNone(pc._point(1920, 10))                      # past the right edge
        self.assertIsNone(pc._point(-1, 10))
        self.assertIsNone(pc._point("x", 10))


@live
@unittest.skipUnless(sys.platform == "win32", "Windows window management")
class WindowTest(unittest.TestCase):
    def test_lists_windows_and_refuses_unknown_or_unconfirmed_close(self):
        pc = Computer(None)
        listed = pc.run({"action": "window_list"})
        self.assertEqual(listed["status"], "done")
        self.assertTrue(listed["windows"])
        self.assertEqual(pc.run({"action": "window", "title": "no-such-window-ocade"})["status"], "failed")
        front = next(w["title"] for w in listed["windows"] if w["front"])
        self.assertEqual(pc.run({"action": "window", "title": front, "state": "close"})["status"],
                         "needs_confirmation")


def _probe_form(title: str, buttons: list[str]) -> subprocess.Popen:
    """A throwaway Windows Forms window OCADE owns: buttons by name and a label that says which was pressed."""
    quote = lambda s: "'" + s.replace("'", "''") + "'"  # noqa: E731
    lines = ["Add-Type -AssemblyName System.Windows.Forms;",
             f"$f = New-Object Windows.Forms.Form; $f.Text = {quote(title)}; $f.Height = 120 + 60 * {len(buttons)};",
             "$l = New-Object Windows.Forms.Label; $l.Text = 'nothing pressed'; $l.Width = 300; $f.Controls.Add($l);"]
    for at, name in enumerate(buttons):
        lines.append(f"$b = New-Object Windows.Forms.Button; $b.Text = {quote(name)}; $b.Top = {30 + 60 * at};"
                     " $b.Width = 200; $b.Height = 50; $b.Add_Click({ $l.Text = 'pressed ' + $this.Text });"
                     " $f.Controls.Add($b);")
    lines.append("[Windows.Forms.Application]::Run($f)")
    return subprocess.Popen(["powershell", "-NoProfile", "-Command", "".join(lines)],
                            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


@live
@unittest.skipUnless(sys.platform == "win32" and Computer(None).capabilities()["accessibility"],
                     "Windows UI Automation")
class AccessibilityTest(unittest.TestCase):
    """Any app's own controls, by name and role, never pixels: a synthetic window with varied names."""

    def test_controls_are_found_and_pressed_by_name_whatever_the_name(self):
        names = ["Weiter", "次へ", "Envoyer le rapport", "प्रारूप सहेजें"]
        title = f"OCADE probe {os.getpid()}"
        form = _probe_form(title, names)
        pc = Computer(None)
        try:
            for _ in range(30):
                seen = pc.run({"action": "ui_inspect", "title": title})
                if seen["status"] == "done" and len(seen["observation"]["elements"]) >= len(names):
                    break
                time.sleep(0.5)
            obs = seen["observation"]
            for name in names:
                ref = next(e["ref"] for e in obs["elements"] if e["name"] == name)
                out = pc.run({"action": "ui_act", "ref": ref, "observationId": obs["observationId"],
                              "op": "invoke"})
                self.assertEqual(out["status"], "done", out)
                obs = out["observation"]
                self.assertIn(f"pressed {name}", [e["name"] for e in obs["elements"]])
            found = pc.run({"action": "ui_inspect", "title": title, "find": names[1]})
            self.assertEqual([e["name"] for e in found["observation"]["elements"]], [names[1]])
            stale = pc.run({"action": "ui_act", "ref": "a1", "observationId": "u0", "op": "invoke"})
            self.assertEqual(stale["status"], "stale")
        finally:
            form.kill()

    @unittest.skipUnless(sys.platform == "win32", "Windows UI Automation")
    def test_a_click_by_coordinates_meets_the_same_hard_rules(self):
        import ocade_accessibility
        import uiautomation as auto
        form = subprocess.Popen(["powershell", "-NoProfile", "-Command", (
            "Add-Type -AssemblyName System.Windows.Forms;"
            "$f = New-Object Windows.Forms.Form; $f.Text = 'OCADE gate probe';"
            "$p = New-Object Windows.Forms.Button; $p.Text = 'Pay now'; $p.Width = 200; $p.Height = 50;"
            "$n = New-Object Windows.Forms.Button; $n.Text = 'Next page'; $n.Top = 70; $n.Width = 200; $n.Height = 50;"
            "$f.Controls.Add($p); $f.Controls.Add($n); [Windows.Forms.Application]::Run($f)")],
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            window = auto.WindowControl(Name="OCADE gate probe", searchDepth=1)
            self.assertTrue(window.Exists(15, 0.3), "the probe window did not appear")

            def centre(name):
                box = window.ButtonControl(Name=name).BoundingRectangle
                return (box.left + box.right) // 2, (box.top + box.bottom) // 2

            self.assertEqual(ocade_accessibility.gate_at(*centre("Pay now"), False)["status"], "blocked")
            self.assertIsNone(ocade_accessibility.gate_at(*centre("Next page"), False))
            # Enter or Space presses the focused control as surely as a click does.
            window.SetActive()
            window.ButtonControl(Name="Pay now").SetFocus()
            self.assertEqual(ocade_accessibility.gate_at(None, None, False, press=True)["status"], "blocked")
            self.assertIsNone(ocade_accessibility.gate_at(None, None, False))
            pc = Computer(None)
            look = lambda: pc.run({"action": "screen"})["observation"]["observationId"]  # noqa: E731
            for keys in (["enter"], ["space"]):
                out = pc.run({"action": "screen_keys", "keys": keys, "observationId": look()},
                             confirmed=True)
                self.assertEqual(out["status"], "blocked", out)
            # A drag lets go on its drop point: dropping on a payment control is pressing it.
            obs = pc.run({"action": "screen"})["observation"]
            scale = obs["imageScale"]
            (nx, ny), (px, py) = centre("Next page"), centre("Pay now")
            click = pc.run({"action": "screen_click", "x": px * scale, "y": py * scale,
                            "observationId": obs["observationId"]}, confirmed=True)
            self.assertEqual(click["status"], "blocked", click)
            out = pc.run({"action": "screen_drag", "x": nx * scale, "y": ny * scale,
                          "toX": px * scale, "toY": py * scale,
                          "observationId": obs["observationId"]}, confirmed=True)
            self.assertEqual(out["status"], "blocked", out)
            # A password manager or a sign-in prompt is never read or operated, however it is reached.
            purchase, sensitive, _ = ocade_accessibility._gates()
            with unittest.mock.patch.object(ocade_accessibility, "_GATES",
                                            (purchase, sensitive, frozenset({"powershell.exe"}))):
                self.assertEqual(ocade_accessibility.gate_at(*centre("Next page"), False)["status"], "blocked")
                self.assertEqual(ocade_accessibility.gate_at(None, None, False)["status"], "blocked")
                self.assertEqual(ocade_accessibility.inspect("OCADE gate probe")["status"], "blocked")
            self.assertEqual(ocade_accessibility.inspect("OCADE gate probe")["status"], "done")
        finally:
            form.kill()


class FinalStopTest(unittest.TestCase):
    """P02: STOP that arrives while a target is being found reaches the effect itself."""

    def test_stop_during_app_lookup_never_launches(self):
        stop = threading.Event()
        pc = Computer(None)

        def found(name, cancel):
            stop.set()  # STOP pressed while the app list was being read
            return {"name": name, "launch": "x"}

        with unittest.mock.patch.object(Computer, "_app_named", staticmethod(found)), \
                unittest.mock.patch.object(ocade_computer, "_launch") as launch:
            out = pc._open_app("Anything", stop)
        self.assertTrue(out.get("stopped"), out)
        launch.assert_not_called()

    def test_stop_before_a_system_action_never_runs_it(self):
        stop = threading.Event()
        stop.set()
        pc = Computer(None)
        with unittest.mock.patch.dict(os.environ, {"OCADE_JARVIS_DRY_SYSTEM": ""}), \
                unittest.mock.patch.object(ocade_computer.subprocess, "Popen") as popen:
            out = pc._system("lock", True, stop)
        self.assertTrue(out.get("stopped") or out["status"] == "failed", out)
        popen.assert_not_called()


@live
@unittest.skipUnless(sys.platform == "win32" and Computer(None).capabilities()["accessibility"],
                     "Windows UI Automation")
class NativeAppTest(unittest.TestCase):
    """A real Windows app through JARVIS's own actions only: Notepad opened by name, text put in through
    its control, another app used in between, saved through the real Save As dialog, closed — and the
    file read back from disk. A STOP before an edit leaves the app untouched."""

    def _window(self, pc, title, timeout_s=30):
        seen = {}
        for _ in range(timeout_s * 2):
            seen = pc.run({"action": "ui_inspect", "title": title})
            if seen["status"] == "done" and seen["observation"]["elements"]:
                return seen["observation"]
            time.sleep(0.5)
        self.fail(f"no window titled {title!r}: {seen}")

    def _keys(self, pc, keys):
        look = pc.run({"action": "screen"})["observation"]["observationId"]
        return pc.run({"action": "screen_keys", "keys": keys, "observationId": look})

    def test_notepad_written_saved_through_its_dialog_and_read_back(self):
        pc = Computer(tempfile.mkdtemp())
        target = Path(tempfile.mkdtemp()) / f"ocade-note-{os.getpid()}.txt"
        words = f"Minutes {os.getpid()}: OCADE wrote this through Notepad's own controls."
        # Never beside somebody's own Notepad: on a person's computer it opens as a tab of their
        # window (the incident of 16 Oct). Disposable machines only.
        if any("notepad" in w["title"].lower() for w in pc.run({"action": "window_list"})["windows"]):
            self.skipTest("a Notepad window is already open here: this test never runs beside it")
        opened = pc.run({"action": "open_app", "name": "Notepad"})
        self.assertEqual(opened["status"], "done", opened)
        mine = opened.get("window") or "Notepad"
        form = None
        try:
            obs = self._window(pc, mine)
            editor = next(e for e in obs["elements"] if e["role"] in ("Edit", "Document"))
            # STOP first: nothing is typed.
            stop = threading.Event()
            stop.set()
            stopped = pc.run({"action": "ui_act", "ref": editor["ref"], "observationId": obs["observationId"],
                              "op": "set_value", "value": "must not appear"}, cancel=stop)
            self.assertTrue(stopped.get("stopped"), stopped)
            obs = self._window(pc, mine)
            editor = next(e for e in obs["elements"] if e["role"] in ("Edit", "Document"))
            out = pc.run({"action": "ui_act", "ref": editor["ref"], "observationId": obs["observationId"],
                          "op": "set_value", "value": words})
            self.assertEqual(out["status"], "done", out)

            # Another app in between, worked by name; Notepad keeps its text.
            other = f"OCADE second app {os.getpid()}"
            form = _probe_form(other, ["Next"])
            seen = self._window(pc, other)
            pressed = pc.run({"action": "ui_act", "op": "invoke", "observationId": seen["observationId"],
                              "ref": next(e["ref"] for e in seen["elements"] if e["name"] == "Next")})
            self.assertIn("pressed Next", [e["name"] for e in pressed["observation"]["elements"]])

            self.assertEqual(pc.run({"action": "window", "title": mine, "state": "focus"})["status"],
                             "done")
            self.assertEqual(self._keys(pc, ["ctrl", "s"])["status"], "done")
            dialog = self._window(pc, "Save As")
            name = next(e for e in dialog["elements"]
                        if e["role"] in ("Edit", "ComboBox") and "file name" in e["name"].lower())
            out = pc.run({"action": "ui_act", "ref": name["ref"], "observationId": dialog["observationId"],
                          "op": "set_value", "value": str(target)})
            # The real Save As box refuses every UI Automation write (0x80040200): one action
            # still puts the name in, through the keyboard, with nobody else using it.
            self.assertEqual(out["status"], "done", out)
            out["observation"] = out["observation"] or self._window(pc, "Save As")
            save = next(e for e in out["observation"]["elements"]
                        if e["role"] == "Button" and e["name"] == "Save")
            out = pc.run({"action": "ui_act", "ref": save["ref"],
                          "observationId": out["observation"]["observationId"], "op": "invoke"})
            # And its Save button refuses its invoke: one action still presses it, by a click.
            self.assertEqual(out["status"], "done", out)
            for _ in range(40):
                if target.exists() and target.stat().st_size:
                    break
                time.sleep(0.25)
            self.assertEqual(target.read_text(encoding="utf-8-sig").strip(), words)
            # Saved: the window now carries the file's name.
            self.assertEqual(self._window(pc, target.stem)["window"].count(target.stem), 1)
        finally:
            if form:
                form.kill()
            # Only the window this test opened, by its own title: never "Notepad" in general.
            closed = pc.run({"action": "window", "title": target.stem, "state": "close"}, confirmed=True)
            if closed["status"] != "done" and mine != "Notepad":
                pc.run({"action": "window", "title": mine, "state": "close"}, confirmed=True)


class DeliverTest(unittest.TestCase):
    """A finished file goes only to the address given, only at the size that was checked."""

    def setUp(self):
        import http.server
        self.root = Path(tempfile.mkdtemp())
        (self.root / "car.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"x" * 100)
        self.pc = Computer(str(self.root))
        got = self.got = {}

        class Door(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_PUT(self):
                got["type"] = self.headers["Content-Type"]
                got["body"] = self.rfile.read(int(self.headers["Content-Length"]))
                self.send_response(200)
                self.end_headers()

        self.server = http.server.HTTPServer(("127.0.0.1", 0), Door)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.shutdown)

    def deliver(self, **extra):
        return self.pc.run({"action": "file_deliver", "path": "car.png", "size": 108, **extra})

    def test_uploads_the_checked_file_as_what_its_bytes_are(self):
        url = f"http://127.0.0.1:{self.server.server_port}/up"
        # Only an https address, or this computer's own: plain http elsewhere or none is refused.
        for elsewhere in ("http://example.com/up", "http://127.0.0.1:1@example.com/up"):
            self.assertEqual(self.deliver(upload=elsewhere)["status"], "failed")
        self.assertEqual(self.deliver()["status"], "failed")
        self.assertEqual(self.deliver(upload=url, size=5)["status"], "failed")  # not the size checked
        out = self.deliver(upload=url)
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(self.got["type"], "image/png")
        self.assertEqual(self.got["body"], (self.root / "car.png").read_bytes())


class ModelPropertiesTest(unittest.TestCase):
    """An STL says how many triangles it holds; an empty export says 0 (CAD-22-01)."""

    def test_binary_and_text_models_and_an_empty_one(self):
        import struct
        root = Path(tempfile.mkdtemp())
        tri = struct.pack("<12fH", *([0.0] * 12), 0)
        (root / "two.stl").write_bytes(b"solid but binary".ljust(80, b" ") + struct.pack("<I", 2) + tri * 2)
        (root / "empty.stl").write_bytes(bytes(84))
        facet = "facet normal 0 0 1\n outer loop\n vertex 0 0 0\n endloop\nendfacet\n"
        (root / "text.stl").write_text("solid t\n" + facet * 3 + "endsolid t\n")
        props = {name: ocade_computer.file_properties(root / name) for name in ("two.stl", "empty.stl", "text.stl")}
        self.assertEqual(props, {"two.stl": {"triangles": 2}, "empty.stl": {"triangles": 0},
                                 "text.stl": {"triangles": 3}})


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "needs ffmpeg")
class VideoEditTest(unittest.TestCase):
    """An edit list becomes one finished video: the length, frame and loudness asked for,
    captions from the clips' own .srt where each part lands (item 2 / MEDIA-21-01)."""

    def test_renders_the_edit_with_cards_captions_and_measured_loudness(self):
        root = Path(tempfile.mkdtemp())
        for name, tone in (("a", 440), ("b", 660)):
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=640x360:r=25:d=8",
                            "-f", "lavfi", "-i", f"sine=f={tone}:d=8", "-shortest", str(root / f"{name}.mp4")],
                           check=True)
        (root / "a.srt").write_text("1\n00:00:02,000 --> 00:00:04,000\nRobots help people\n\n"
                                    "2\n00:00:06,000 --> 00:00:07,500\nNot in the cut\n")
        pc = Computer(str(root))
        edit = {"action": "video_edit", "path": "edit.mp4", "frame": "1280x720", "fps": 30, "length": 12,
                "opening": "AI: Robots", "closing": "Thanks", "cardSeconds": 2,
                "clips": [{"path": "a.mp4", "from": 1, "to": 5, "captions": "a.srt"},
                          {"path": "b.mp4", "from": 0, "to": 3}], "burnCaptions": True}
        out = pc.run(edit)
        self.assertEqual(out["status"], "done", out)
        props = out["properties"]
        self.assertAlmostEqual(props["seconds"], 12, delta=0.05)  # the last part was set to fit
        self.assertEqual((props["width"], props["height"], props["fps"]), (1280, 720, 30))
        self.assertLessEqual(props["truePeakDBTP"], -1)
        self.assertAlmostEqual(props["loudnessLUFS"], -14, delta=2)
        # The one cue inside the cut, moved to where it plays: after the 2 s title, 1 s into a.
        self.assertEqual(out["captions"], 1)
        self.assertEqual(out["wrote"], ["edit.mp4", "edit.srt"])  # both are the edit's files
        self.assertIn("00:00:03,000 --> 00:00:05,000\nRobots help people",
                      (root / "edit.srt").read_text())
        streams = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type",
                                  "-of", "csv=p=0", str(root / "edit.mp4")], capture_output=True,
                                 text=True).stdout.split()
        self.assertEqual(sorted(streams), ["audio", "subtitle", "video"])
        # Its own render is redone in place; never over a file it did not make, or a clip from
        # outside the work folder.
        self.assertEqual(pc.run({**edit, "length": 11})["properties"]["seconds"], 11)
        (root / "mine.mp4").write_bytes(b"the person's")
        self.assertEqual(pc.run({**edit, "path": "mine.mp4"})["status"], "failed")
        self.assertEqual((root / "mine.mp4").read_bytes(), b"the person's")
        outside = pc.run({**edit, "path": "x.mp4", "clips": [{"path": "../a.mp4", "from": 0, "to": 2}]})
        self.assertEqual(outside["status"], "blocked")
        self.assertFalse((root / "x.mp4").exists())
