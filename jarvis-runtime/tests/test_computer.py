"""OCADE computer control: workspace scope, commands, confirmations, apps and the screen.

Run: xvfb-run -a python -m unittest discover -s jarvis-runtime/tests -p 'test_computer.py'
The screen tests need a display and skip without one.
"""
import os
import subprocess
import sys
import tempfile
import time
import unittest
import unittest.mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_computer  # noqa: E402
from ocade_computer import Computer  # noqa: E402


class WorkspaceTest(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp()
        os.environ["HOME"] = self.home  # the Trash lives in this throwaway home
        os.environ.pop("XDG_DATA_HOME", None)
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
        out = self.pc.run({"action": "run", "command": "pwd && echo built > out.txt"})
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(out["stdout"].strip().splitlines()[0], str(self.root))
        self.assertEqual((self.root / "out.txt").read_text().strip(), "built")
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


    def test_system_changes_wait_for_the_person(self):
        os.environ["OCADE_JARVIS_DRY_SYSTEM"] = "1"
        out = self.pc.run({"action": "system", "op": "restart"})
        self.assertEqual(out["status"], "needs_confirmation")
        self.assertIn("Would run", self.pc.run({"action": "system", "op": "restart"}, confirmed=True)["summary"])


class UndoTest(unittest.TestCase):
    """Donor undo: act at once, remember how to reverse it, newest first."""

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

    def test_only_the_recent_past_is_kept(self):
        for n in range(ocade_computer.UNDO_DEPTH + 3):
            self.do(action="file_mkdir", path=f"d{n}")
        for _ in range(ocade_computer.UNDO_DEPTH):
            self.do(action="undo")
        self.assertEqual(self.pc.run({"action": "undo"})["status"], "failed")
        self.assertEqual(sorted(p.name for p in self.root.iterdir() if p.is_dir()), ["d0", "d1", "d2"])


class SettingsTest(unittest.TestCase):
    """Donor computer_settings and system_monitor, through the system's own interfaces."""

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

    def test_every_command_waits_for_the_person_shown_whole(self):
        # An interpreter runs whatever it is given: none runs unconfirmed here.
        (self.root / "calc.py").write_text("print(42)\n")
        for command in ("python calc.py", 'python -c "print(1)"', "git status"):
            out = self.run_(command, confirmed=False)
            self.assertEqual(out["status"], "needs_confirmation", command)
            self.assertEqual(out["summary"], f"Running {command}")
        # What can never run is refused before anyone is asked.
        self.assertEqual(self.run_("python ../x.py", confirmed=False)["status"], "blocked")
        self.assertEqual(self.run_("no-such-program-ocade")["status"], "failed")

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
        self.assertEqual(self.pc.run({**keys, "observationId": look()}, cowork=True)["status"], "done")


if __name__ == "__main__":
    unittest.main()


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


@unittest.skipUnless(sys.platform == "win32" and Computer(None).capabilities()["accessibility"],
                     "Windows UI Automation")
class AccessibilityTest(unittest.TestCase):
    """A native app driven by its controls, not by pixels: Windows Calculator."""

    def test_calculator_by_its_buttons(self):
        pc = Computer(None)
        pc.run({"action": "open_app", "name": "Calculator"})
        for _ in range(20):
            seen = pc.run({"action": "ui_inspect", "title": "Calculator"})
            if seen["status"] == "done" and any(e["name"] == "Seven" for e in seen["observation"]["elements"]):
                break
            time.sleep(0.5)
        obs = seen["observation"]
        try:
            for name in ("Clear", "Seven", "Multiply by", "Six", "Equals"):
                ref = next(e["ref"] for e in obs["elements"] if e["name"] == name)
                out = pc.run({"action": "ui_act", "ref": ref, "observationId": obs["observationId"],
                              "op": "invoke"})
                self.assertEqual(out["status"], "done", out)
                obs = out["observation"]
            self.assertIn("Display is 42", [e["name"] for e in obs["elements"]])
            found = pc.run({"action": "ui_inspect", "title": "Calculator", "find": "Seven"})
            self.assertEqual([e["name"] for e in found["observation"]["elements"]], ["Seven"])
            stale = pc.run({"action": "ui_act", "ref": "a1", "observationId": "u0", "op": "invoke"})
            self.assertEqual(stale["status"], "stale")
        finally:
            pc.run({"action": "window", "title": "Calculator", "state": "close"}, confirmed=True)

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
        finally:
            form.kill()
