"""The Device Agent lifecycle: one presence, autostart, uninstall, durable results, global Stop.

Run: python -m unittest discover -s jarvis-runtime/tests -p 'test_agent.py'
The tray itself needs a desktop session; its status and Pause/Resume logic are tested here.
"""
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_agent  # noqa: E402
import ocade_device  # noqa: E402


class FakeIdentity:
    def __init__(self, home: Path, replies: list):
        self.home = home
        self.meta = {"server": "https://ocade.test", "deviceId": "d1"}
        self.replies = replies
        self.bodies: list[dict] = []

    def exchange(self, body: dict) -> dict:
        self.bodies.append(json.loads(json.dumps(body)))
        reply = self.replies.pop(0) if self.replies else {"commands": [], "busy": False}
        if isinstance(reply, Exception):
            raise reply
        return reply

    def forget(self):
        pass


class LifecycleTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        os.environ["XDG_CONFIG_HOME"] = str(self.home / "config")

    def test_only_one_presence_at_a_time(self):
        first = ocade_agent.single_instance()
        self.assertIsNotNone(first)
        self.assertIsNone(ocade_agent.single_instance())
        first.close()
        again = ocade_agent.single_instance()
        self.assertIsNotNone(again)
        again.close()

    def test_autostart_and_uninstall_leave_nothing_behind(self):
        ocade_agent.install_autostart()
        try:
            self.assertIn("ocade_agent.py", self._autostart_entry() or "")
            (self.home / "device.key").write_text("k")
            message = ocade_agent.uninstall(self.home)
        finally:
            ocade_agent.remove_autostart()  # never leave a login item behind on a real machine
        self.assertIsNone(self._autostart_entry())
        self.assertFalse(self.home.exists())
        self.assertIn("PC control, background tasks and wake features have stopped", message)

    @staticmethod
    def _autostart_entry():
        """The login item's command (Windows: the HKCU Run value), or None."""
        if sys.platform == "win32":
            import winreg
            try:
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                    r"Software\Microsoft\Windows\CurrentVersion\Run") as key:
                    return winreg.QueryValueEx(key, "OCADE")[0]
            except FileNotFoundError:
                return None
        entry = ocade_agent.autostart_path()
        return entry.read_text() if entry.exists() else None

    def _agent(self, replies):
        identity = FakeIdentity(self.home, replies)
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=str(self.home))
        agent.browsers.run = lambda mode, action, confirmed, sites, cancel: {
            "status": "done", "summary": "ok"}
        return agent, identity

    def test_results_survive_a_lost_connection_and_a_restart(self):
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        agent, identity = self._agent([{"commands": [command], "busy": True},
                                       urllib.error.URLError("offline")])
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(1.0)
        agent.stop.set()
        runner.join(10)
        kept = json.loads((self.home / "pending.json").read_text())
        self.assertEqual([r["id"] for r in kept], ["a1"])
        # A new process (after a reboot) delivers them first.
        again, identity = self._agent([{"commands": [], "busy": False}])
        again.stop.set()
        self.assertEqual(again._load_pending()[0]["id"], "a1")

    def test_stop_jarvis_reaches_ocade_once(self):
        agent, identity = self._agent([{"commands": [], "busy": True}] * 3)
        agent.stop_all.set()
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(2.5)
        agent.stop.set()
        runner.join(10)
        stops = [b.get("stop") for b in identity.bodies]
        self.assertEqual(stops[0], True)
        self.assertNotIn(True, stops[1:])

    def _long_action(self, agent):
        """A computer action that keeps working until its cancellation token is set."""
        seen = {"started": threading.Event(), "stopped_at": None}

        def run(action, confirmed, cowork, cancel):
            seen["started"].set()
            while not cancel.wait(0.05):
                pass
            seen["stopped_at"] = time.monotonic()
            return {"status": "failed", "summary": "Stopped before it finished", "stopped": True}

        agent.computer.run = run
        return seen

    def test_removing_the_device_stops_the_running_action_before_the_key_goes(self):
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        agent, identity = self._agent([{"commands": [command], "busy": True},
                                       {"commands": [], "busy": True}])
        seen = self._long_action(agent)
        forgot = {}

        def forget():
            forgot["at"] = time.monotonic()
            forgot["action_alive"] = any(t.name == "ocade-action" and t.is_alive()
                                         for t in threading.enumerate())

        identity.forget = forget
        runner = threading.Thread(target=agent.run)
        runner.start()
        self.assertTrue(seen["started"].wait(5))
        identity.replies.append(ocade_device.NotEnrolled())
        runner.join(15)
        self.assertFalse(runner.is_alive())
        self.assertIsNotNone(seen["stopped_at"], "the action kept running after removal")
        self.assertLessEqual(seen["stopped_at"], forgot["at"])
        self.assertFalse(forgot["action_alive"], "the key went while the action still ran")
        self.assertFalse((self.home / "pending.json").exists())  # no late result survives

    def test_losing_ocade_during_an_action_stops_it(self):
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        agent, identity = self._agent([{"commands": [command], "busy": True}]
                                      + [urllib.error.URLError("offline")] * 50)
        seen = self._long_action(agent)
        old, ocade_device.CONTROL_LOSS_S = ocade_device.CONTROL_LOSS_S, 0.5
        try:
            runner = threading.Thread(target=agent.run)
            runner.start()
            self.assertTrue(seen["started"].wait(5))
            deadline = time.monotonic() + 10
            while seen["stopped_at"] is None and time.monotonic() < deadline:
                time.sleep(0.1)
            agent.stop.set()
            runner.join(15)
        finally:
            ocade_device.CONTROL_LOSS_S = old
        self.assertIsNotNone(seen["stopped_at"], "the action continued without a control channel")

    def test_dormant_without_a_task(self):
        agent, identity = self._agent([])
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(2)
        agent.stop.set()
        runner.join(10)
        self.assertLessEqual(len(identity.bodies), 1)  # one quiet check, then waiting


class WakeTest(unittest.TestCase):
    def test_hey_ocade_is_unavailable_without_its_local_model_and_opens_voice_when_heard(self):
        import ocade_wake
        home = Path(tempfile.mkdtemp())
        self.assertFalse(ocade_wake.available(home))
        self.assertFalse(ocade_wake.listen(home, "https://ocade.test", threading.Event()))
        opened = []
        ocade_wake.webbrowser.open = opened.append
        ocade_wake.open_voice("https://ocade.test/")
        self.assertEqual(opened, ["https://ocade.test/ocade-jarvis?voice=1"])


class TrayStatusTest(unittest.TestCase):
    """The tray says one truthful word, and Pause/Resume reach OCADE exactly once."""

    def setUp(self):
        self.home = Path(tempfile.mkdtemp())

    def test_status_words(self):
        identity = FakeIdentity(self.home, [])
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=str(self.home))
        self.assertEqual(agent.status(), "Ready")
        agent.state.update(busy=True, task={"status": "running"})
        self.assertEqual(agent.status(), "Working")
        agent.state["task"] = {"status": "waiting"}
        self.assertEqual(agent.status(), "Waiting for you")
        agent.pause()
        self.assertEqual(agent.status(), "Paused")
        self.assertTrue(agent.cancel.is_set(), "pausing ends the step in progress")
        agent.resume()
        agent.state["offline"] = True
        self.assertEqual(agent.status(), "Offline")
        agent.stop_everything()
        self.assertEqual(agent.status(), "Stopping")

    def test_work_folder_is_chosen_once_and_remembered(self):
        identity = FakeIdentity(self.home, [])
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=None)
        self.assertFalse(agent.computer.capabilities()["files"])
        folder = self.home / "Projects"
        folder.mkdir()
        agent.set_workspace(str(folder))
        self.assertTrue(agent.computer.capabilities()["files"])
        again = ocade_device.Agent(identity, headless=True, cdp=None, workspace=None)
        self.assertEqual(again.computer.root, folder.resolve())
        for too_broad in (str(Path.home()), str(Path(folder.anchor))):
            with self.assertRaises(ValueError):
                agent.set_workspace(too_broad)

    def test_pause_then_resume_reach_ocade_once_each(self):
        identity = FakeIdentity(self.home, [{"commands": [], "busy": True}] * 6)
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=str(self.home))
        agent.pause()
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(1.5)
        agent.resume()
        time.sleep(1.5)
        agent.stop.set()
        runner.join(10)
        pauses = [b.get("pause") for b in identity.bodies]
        resumes = [b.get("resume") for b in identity.bodies]
        self.assertEqual(pauses.count(True), 1)
        self.assertEqual(resumes.count(True), 1)
        self.assertLess(pauses.index(True), resumes.index(True))


if __name__ == "__main__":
    unittest.main()
