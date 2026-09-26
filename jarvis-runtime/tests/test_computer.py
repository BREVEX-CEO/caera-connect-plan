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
        self.assertTrue(any(Path(self.home, ".local/share/Trash/files").iterdir()))
        self.assertEqual(self.pc.run({"action": "file_trash", "path": "."})["status"], "blocked")

    def test_permanent_deletion_needs_the_person(self):
        out = self.pc.run({"action": "file_delete", "path": "src"})
        self.assertEqual(out["status"], "needs_confirmation")
        self.pc.run({"action": "file_write", "path": "src/a.py", "content": "x"})
        self.assertEqual(self.pc.run({"action": "file_delete", "path": "src"}, confirmed=True)["status"], "done")
        self.assertFalse((self.root / "src").exists())

    def test_commands_run_in_the_workspace_and_cannot_write_outside_it(self):
        out = self.pc.run({"action": "run", "command": "pwd && echo built > out.txt"})
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(out["stdout"].strip().splitlines()[0], str(self.root))
        self.assertEqual((self.root / "out.txt").read_text().strip(), "built")
        if self.pc.sandbox == "bubblewrap":
            probe = Path(__file__).resolve().parent / "escaped-probe.txt"
            escape = self.pc.run({"action": "run", "command": f"echo x > {probe}"})
            self.assertEqual(escape["status"], "failed")
            self.assertFalse(probe.exists())
            self.pc.run({"action": "run", "command": f"echo x > {self.home}/escaped.txt"})
            self.assertFalse(Path(self.home, "escaped.txt").exists())
        self.assertEqual(self.pc.run({"action": "run", "command": "exit 3"})["exitCode"], 3)
        self.assertEqual(self.pc.run({"action": "run", "command": "ls", "cwd": ".."})["status"], "blocked")

    def test_a_runaway_command_is_stopped(self):
        old = ocade_computer.RUN_TIMEOUT_S
        ocade_computer.RUN_TIMEOUT_S = 1
        try:
            started = time.monotonic()
            out = self.pc.run({"action": "run", "command": "sleep 30"})
        finally:
            ocade_computer.RUN_TIMEOUT_S = old
        self.assertEqual(out["status"], "failed")
        self.assertLess(time.monotonic() - started, 10)

    def test_system_changes_wait_for_the_person(self):
        os.environ["OCADE_JARVIS_DRY_SYSTEM"] = "1"
        out = self.pc.run({"action": "system", "op": "restart"})
        self.assertEqual(out["status"], "needs_confirmation")
        self.assertIn("Would run", self.pc.run({"action": "system", "op": "restart"}, confirmed=True)["summary"])


class AppsTest(unittest.TestCase):
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


@unittest.skipUnless(os.environ.get("DISPLAY"), "needs a display (run under xvfb-run)")
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
        subprocess.run(["xdotool", "mousemove", "200", "200"], check=True)  # someone else's hand
        time.sleep(0.5)
        paused = self.pc.run({"action": "screen_keys", "keys": ["shift"]})
        self.assertEqual(paused["status"], "needs_confirmation")
        self.assertEqual(self.pc.run({"action": "screen_keys", "keys": ["shift"]},
                                     confirmed=True)["status"], "done")
        time.sleep(0.6)
        subprocess.run(["xdotool", "mousemove", "100", "100"], check=True)
        time.sleep(0.5)
        self.assertEqual(self.pc.run({"action": "screen_keys", "keys": ["shift"]},
                                     cowork=True)["status"], "done")


if __name__ == "__main__":
    unittest.main()
