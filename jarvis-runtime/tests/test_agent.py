"""The Device Agent lifecycle: one presence, autostart, uninstall, durable results, global Stop.

Run: python -m unittest discover -s jarvis-runtime/tests -p 'test_agent.py'
The mini-control test needs Tk and a display (xvfb-run) and skips otherwise.
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
        entry = ocade_agent.autostart_path()
        self.assertIn("ocade_agent.py", entry.read_text())
        (self.home / "device.key").write_text("k")
        message = ocade_agent.uninstall(self.home)
        self.assertFalse(entry.exists())
        self.assertFalse(self.home.exists())
        self.assertIn("PC control, background tasks and wake features have stopped", message)

    def _agent(self, replies):
        identity = FakeIdentity(self.home, replies)
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=str(self.home))
        agent.browsers.run = lambda mode, action, confirmed: {"status": "done", "summary": "ok"}
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


def _tk():
    try:
        import tkinter  # noqa: F401
        return bool(os.environ.get("DISPLAY"))
    except ImportError:
        return False


@unittest.skipUnless(_tk(), "needs Tk and a display")
class MiniControlTest(unittest.TestCase):
    def test_appears_while_working_and_stops_jarvis(self):
        import ocade_mini

        class Presence:
            def __init__(self):
                self.agent = type("A", (), {})()
                self.agent.state = {"busy": False, "task": None}
                self.agent.stop = threading.Event()
                self.stopped = False

            def stop_jarvis(self):
                self.stopped = True

            def open_ocade(self):
                pass

            def exit(self):
                pass

        presence = Presence()
        mini = ocade_mini.Mini(presence, Path(tempfile.mkdtemp()))
        mini.root.update()
        self.assertEqual(mini.root.state(), "withdrawn")
        presence.agent.state = {"busy": True, "task": {"title": "Tidy notes", "step": 1, "steps": 3}}
        mini.tick()
        mini.root.update()
        self.assertEqual(mini.root.state(), "normal")
        self.assertIn("Step 2 of 3", mini.status_text())
        mini.stop.invoke()
        self.assertTrue(presence.stopped)
        presence.agent.stop.set()
        mini.tick()


if __name__ == "__main__":
    unittest.main()
