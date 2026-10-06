"""Release-blocking safety boundaries (Error Audit 01: JARVIS-023, 037, 038, 039, 051, 053).

Run: python -m pytest jarvis-runtime/tests/test_safety.py
Runs on Windows, macOS and Linux; nothing here needs a display or the network.
"""
import http.server
import json
import os
import socket
import sys
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import conftest  # noqa: E402,F401  test isolation for unittest runs too, not only pytest
import ocade_computer  # noqa: E402
import ocade_device  # noqa: E402
from ocade_computer import Computer  # noqa: E402
from ocade_egress import Blocked, EgressProxy, Policy, is_public  # noqa: E402


class FakeIdentity:
    def __init__(self, home: Path, reply):
        self.home = home
        self.meta = {"server": "https://ocade.test"}
        self.reply = reply
        self.bodies: list[dict] = []

    def exchange(self, body: dict) -> dict:
        self.bodies.append(json.loads(json.dumps(body)))
        return self.reply(body)

    def forget(self):
        pass


def _agent(home: Path, reply):
    identity = FakeIdentity(home, reply)
    agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=str(home))
    return agent, identity


class StopTest(unittest.TestCase):
    """JARVIS-023: STOP ends the action that is already running, from every surface."""

    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        self.command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        self.ended: list[float] = []

    def _slow_action(self, agent):
        def slow(action, confirmed, cowork, cancel):
            cancel.wait(30)  # a 30-second action unless cancelled
            self.ended.append(time.monotonic())
            return {"status": "failed" if cancel.is_set() else "done", "summary": "slow"}
        agent.computer.run = slow

    def _run(self, agent, seconds):
        runner = threading.Thread(target=agent.run)
        runner.start()
        return runner

    def test_tray_stop_cancels_the_running_action_at_once(self):
        sent = {"n": 0}

        def reply(body):
            sent["n"] += 1
            return {"commands": [self.command] if sent["n"] == 1 else [], "busy": True}

        agent, identity = _agent(self.home, reply)
        self._slow_action(agent)
        runner = self._run(agent, 0)
        time.sleep(2.5)
        stopped_at = time.monotonic()
        agent.stop_everything()  # the tray's STOP JARVIS
        time.sleep(1.5)
        agent.stop.set()
        runner.join(10)
        self.assertEqual(len(self.ended), 1)
        self.assertLess(self.ended[0] - stopped_at, 0.5)
        # The loop kept talking to OCADE while the action ran, and told it about STOP.
        self.assertTrue(any(b.get("running") == ["a1"] for b in identity.bodies))
        self.assertTrue(any(b.get("stop") for b in identity.bodies))
        # The action's result is delivered as not done.
        results = [r for b in identity.bodies for r in b["results"]]
        self.assertEqual([r["status"] for r in results], ["failed"])

    def test_stop_in_ocade_cancels_the_running_action(self):
        sent = {"n": 0}

        def reply(body):
            sent["n"] += 1
            if sent["n"] == 1:
                return {"commands": [self.command], "busy": True}
            # The web STOP (or Take Over) marked it: OCADE answers "cancel".
            return {"commands": [], "busy": False, "cancel": body.get("running", [])}

        agent, identity = _agent(self.home, reply)
        self._slow_action(agent)
        started = time.monotonic()
        runner = self._run(agent, 0)
        time.sleep(3.0)
        agent.stop.set()
        runner.join(10)
        self.assertEqual(len(self.ended), 1)
        self.assertLess(self.ended[0] - started, 2.5)  # cancelled on the next check, not after 30 s

    def test_stop_during_an_exchange_never_starts_what_it_returns(self):
        started = []
        agent = None

        def reply(body):
            if len(identity.bodies) == 1:
                agent.stop_everything()  # pressed while this exchange was on its way
                return {"commands": [self.command], "busy": True}
            return {"commands": [], "busy": False}

        agent, identity = _agent(self.home, reply)
        agent.computer.run = lambda *a: started.append(1) or {"status": "done", "summary": "x"}
        runner = self._run(agent, 0)
        time.sleep(1.5)
        agent.stop.set()
        runner.join(10)
        self.assertEqual(started, [])
        self.assertTrue(identity.bodies[1].get("stop"))
        self.assertEqual(identity.bodies[1]["results"],
                         [{"id": "a1", "status": "failed", "summary": "Stopped before it started"}])

    def test_a_stop_just_before_an_action_starts_reaches_that_action(self):
        agent, _ = _agent(self.home, lambda body: {"commands": []})
        self._slow_action(agent)
        agent.stop_everything()  # between the loop's admission check and the action's start
        active = agent._start(self.command)
        active["thread"].join(5)
        self.assertFalse(active["thread"].is_alive())
        self.assertEqual(active["outcome"][0]["status"], "failed")

    def test_losing_ocade_cancels_the_action_even_while_the_exchange_hangs(self):
        self.addCleanup(setattr, ocade_device, "CONTROL_LOSS_S", ocade_device.CONTROL_LOSS_S)
        ocade_device.CONTROL_LOSS_S = 0.5
        calls = {"n": 0}

        def reply(body):
            calls["n"] += 1
            if calls["n"] == 1:
                return {"commands": [self.command], "busy": True}
            time.sleep(4)  # OCADE out of reach, the request not yet timed out
            return {"commands": [], "busy": False}

        agent, _ = _agent(self.home, reply)
        self._slow_action(agent)
        started = time.monotonic()
        runner = self._run(agent, 0)
        time.sleep(3)
        agent.stop.set()
        runner.join(15)
        self.assertEqual(len(self.ended), 1)
        self.assertLess(self.ended[0] - started, 2.5)  # cancelled at the bound, not after the 4 s hang

    def test_the_agent_lets_go_of_what_it_owns_when_it_ends(self):
        agent, _ = _agent(self.home, lambda body: {"commands": []})
        proxy = agent.browsers.egress
        agent.stop.set()
        agent.run()
        self.assertFalse(proxy._thread.is_alive())
        with self.assertRaises(OSError):
            socket.create_connection(("127.0.0.1", proxy.server_address[1]), timeout=1)

    def test_only_one_action_runs_at_a_time(self):
        second = {**self.command, "id": "a2"}

        def reply(body):
            return {"commands": [self.command, second], "busy": True}

        agent, identity = _agent(self.home, reply)
        started = []

        def run(action, confirmed, cowork, cancel):
            started.append(1)
            cancel.wait(5)
            return {"status": "done", "summary": "x"}
        agent.computer.run = run
        runner = self._run(agent, 0)
        time.sleep(1.5)
        agent.stop.set()
        runner.join(10)
        self.assertEqual(len(started), 1)


class JournalTest(unittest.TestCase):
    """JARVIS-039: finished results are written atomically; damage is kept, not erased."""

    def test_journal_is_atomic_and_damage_is_preserved(self):
        home = Path(tempfile.mkdtemp())
        agent, _ = _agent(home, lambda body: {"commands": []})
        agent._keep_pending([{"id": "a1", "status": "done"}])
        self.assertEqual(agent._load_pending()[0]["id"], "a1")
        self.assertFalse((home / "pending.tmp").exists())
        (home / "pending.json").write_text('[{"id": "a1", "sta')
        self.assertEqual(agent._load_pending(), [])
        self.assertTrue((home / "pending.damaged").exists())


class TerminalTest(unittest.TestCase):
    """JARVIS-037/055: Linux confines commands in bubblewrap; Windows/macOS run one program directly."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp(), "workspace")
        self.root.mkdir()
        self.pc = Computer(str(self.root))

    def test_terminal_fails_closed_without_a_sandbox(self):
        self.pc.sandbox = None
        self.assertFalse(self.pc.capabilities()["terminal"])
        out = self.pc.run({"action": "run", "command": "echo escaped>..\\outside.txt"})
        self.assertEqual(out["status"], "blocked")
        self.assertFalse((self.root.parent / "outside.txt").exists())

    def test_windows_and_macos_run_one_program_without_a_shell(self):
        if ocade_computer.SYSTEM == "Linux":
            self.skipTest("Linux uses bubblewrap")
        self.assertEqual(self.pc.sandbox, "workspace")
        self.assertTrue(self.pc.capabilities()["terminal"])
        out = self.pc.run({"action": "run", "command": r"echo escaped>..\outside.txt"})
        self.assertEqual(out["status"], "blocked")
        self.assertFalse((self.root.parent / "outside.txt").exists())

    def test_unconfirmed_commands_have_no_network(self):
        argv, _ = self.pc._sandboxed("true", self.root, network=False)
        self.assertIn("--unshare-net", argv)
        self.assertIn("--clearenv", argv)
        argv, _ = self.pc._sandboxed("true", self.root, network=True)
        self.assertNotIn("--unshare-net", argv)

    def test_stop_kills_a_running_command(self):
        self.pc.sandbox = "bubblewrap"
        self.pc._sandboxed = lambda command, folder, network: (
            [sys.executable, "-c", "import time; time.sleep(30)"], {})
        cancel = threading.Event()
        threading.Timer(0.5, cancel.set).start()
        started = time.monotonic()
        out = self.pc.run({"action": "run", "command": "sleep"}, cancel=cancel)
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(out["status"], "failed")
        self.assertTrue(out["stopped"])


class WorkspaceWriteTest(unittest.TestCase):
    """JARVIS-051: nothing planted in the workspace can redirect a write outside it."""

    def test_planted_temp_symlink_cannot_redirect_a_write(self):
        base = Path(tempfile.mkdtemp())
        root = base / "workspace"
        root.mkdir()
        outside = base / "outside.txt"
        outside.write_text("SAFE")
        try:
            (root / ".victim.txt.ocade-tmp").symlink_to(outside)
        except OSError:
            self.skipTest("this account cannot create symlinks")
        pc = Computer(str(root))
        out = pc.run({"action": "file_write", "path": "victim.txt", "content": "ESCAPED"})
        self.assertEqual(out["status"], "done")
        self.assertEqual(outside.read_text(), "SAFE")
        self.assertEqual((root / "victim.txt").read_text(), "ESCAPED")
        self.assertFalse((root / "victim.txt").is_symlink())
        self.assertEqual([p.name for p in root.iterdir() if p.name.startswith(".ocade-")], [])

    @staticmethod
    def _link_folder(link: Path, to: Path) -> bool:
        try:  # a junction on Windows needs no privilege; a symlink elsewhere
            if sys.platform == "win32":
                import subprocess
                return subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(to)],
                                      capture_output=True).returncode == 0
            link.symlink_to(to, target_is_directory=True)
            return True
        except OSError:
            return False

    def test_a_folder_link_out_of_the_workspace_is_not_copied_or_downloaded_into(self):
        base = Path(tempfile.mkdtemp())
        root, outside = base / "workspace", base / "private"
        (root / "src").mkdir(parents=True)
        outside.mkdir()
        (outside / "secret.txt").write_text("PRIVATE")
        (root / "src" / "main.py").write_text("print(1)")
        if not self._link_folder(root / "src" / "private", outside):
            self.skipTest("this account cannot create folder links")
        pc = Computer(str(root))
        self.assertEqual(pc.run({"action": "file_copy", "path": "src", "to": "copy"})["status"], "done")
        self.assertTrue((root / "copy" / "main.py").is_file())
        self.assertFalse((root / "copy" / "private").exists())
        # A Downloads folder that is really a link elsewhere takes no download.
        self.assertTrue(self._link_folder(root / "Downloads", outside))
        out = ocade_device.Browsers(True, None).run(
            "isolated", {"action": "download", "url": "https://example.com/a.pdf"}, False, [],
            threading.Event(), root.resolve())
        self.assertEqual(out["status"], "blocked")

    def test_symlinked_destination_is_refused(self):
        base = Path(tempfile.mkdtemp())
        root = base / "workspace"
        root.mkdir()
        outside = base / "outside.txt"
        outside.write_text("SAFE")
        try:
            (root / "victim.txt").symlink_to(outside)
        except OSError:
            self.skipTest("this account cannot create symlinks")
        out = Computer(str(root)).run({"action": "file_write", "path": "victim.txt", "content": "X"})
        self.assertEqual(out["status"], "blocked")
        self.assertEqual(outside.read_text(), "SAFE")


class FakeGui:
    def __init__(self):
        self.window = "Editor"
        self.typed: list[str] = []

    def size(self):
        return (1920, 1080)

    def getActiveWindow(self):
        return type("W", (), {"title": self.window})()

    def write(self, text, interval=0):
        self.typed.append(text)

    def hotkey(self, *keys):
        self.typed.append("+".join(keys))

    def press(self, key):
        self.typed.append(key)

    def scroll(self, n):
        self.typed.append(f"scroll{n}")


class ScreenInputTest(unittest.TestCase):
    """JARVIS-038: typing, keys and scrolling land only on the screen they were planned for."""

    def setUp(self):
        self.gui = FakeGui()
        self.pc = Computer(None)
        self.pc._gui = lambda: self.gui
        self.pc.guard.start = lambda: True
        self.pc.observe = self._observe

    def _observe(self):
        self.pc._obs_seq += 1
        self.pc._observation = {"id": f"s{self.pc._obs_seq}", "geometry": self.pc._geometry(),
                                "scale": 1.0, "at": time.monotonic()}
        return {"observationId": f"s{self.pc._obs_seq}"}

    def test_type_keys_and_scroll_need_the_current_observation(self):
        for action in ({"action": "screen_type", "text": "hello"},
                       {"action": "screen_keys", "keys": ["ctrl", "s"]},
                       {"action": "screen_scroll", "direction": "down"}):
            self.assertEqual(self.pc.run(action)["status"], "stale", action)
        self.assertEqual(self.gui.typed, [])

    def test_a_window_change_before_typing_is_refused(self):
        obs = self._observe()["observationId"]
        self.gui.window = "Chat"  # a notification or another app took focus
        out = self.pc.run({"action": "screen_type", "text": "rm -rf", "observationId": obs})
        self.assertEqual(out["status"], "stale")
        self.assertEqual(self.gui.typed, [])

    def test_typing_stops_when_the_window_changes_midway(self):
        import ocade_computer
        self.addCleanup(setattr, ocade_computer, "PASTE_OVER", ocade_computer.PASTE_OVER)
        ocade_computer.PASTE_OVER = 10_000  # key-by-key typing, checked every chunk
        obs = self._observe()["observationId"]
        original = self.gui.write

        def write(text, interval=0):
            original(text)
            self.gui.window = "Chat"
        self.gui.write = write
        out = self.pc.run({"action": "screen_type", "text": "x" * 200, "observationId": obs})
        self.assertEqual(out["status"], "needs_confirmation")
        self.assertEqual(len(self.gui.typed), 1)

    def test_long_text_is_pasted_only_into_the_planned_window_and_the_clipboard_comes_back(self):
        import pyperclip
        board = ["mine"]  # a stand-in clipboard: the test never touches the person's real one
        self.addCleanup(setattr, pyperclip, "copy", pyperclip.copy)
        self.addCleanup(setattr, pyperclip, "paste", pyperclip.paste)
        pyperclip.copy, pyperclip.paste = (lambda text: board.__setitem__(0, text)), (lambda: board[0])
        obs = self._observe()["observationId"]
        out = self.pc.run({"action": "screen_type", "text": "y" * 200, "observationId": obs})
        self.assertEqual(out["status"], "done", out)
        self.assertEqual(self.gui.typed, ["ctrl+v"])
        self.assertEqual(pyperclip.paste(), "mine")
        obs = self._observe()["observationId"]
        self.gui.window = "Chat"
        out = self.pc.run({"action": "screen_type", "text": "z" * 200, "observationId": obs})
        self.assertEqual(out["status"], "stale")
        self.assertEqual(self.gui.typed, ["ctrl+v"])
        self.assertEqual(pyperclip.paste(), "mine")

    def test_stop_ends_typing(self):
        obs = self._observe()["observationId"]
        cancel = threading.Event()
        cancel.set()
        out = self.pc.run({"action": "screen_type", "text": "hello", "observationId": obs},
                          cancel=cancel)
        self.assertTrue(out.get("stopped"))
        self.assertEqual(self.gui.typed, [])

    def test_a_stopped_click_keys_or_scroll_never_happens(self):
        self.gui.click = lambda *a, **k: self.gui.typed.append("click")
        cancel = threading.Event()
        cancel.set()
        for action in ({"action": "screen_click", "x": 10, "y": 10},
                       {"action": "screen_keys", "keys": ["enter"]},
                       {"action": "screen_scroll", "direction": "down"}):
            obs = self._observe()["observationId"]
            out = self.pc.run({**action, "observationId": obs}, cancel=cancel)
            self.assertTrue(out.get("stopped"), action)
        self.assertEqual(self.gui.typed, [])

    def test_stop_while_the_target_is_checked_stops_the_click(self):
        self.gui.click = lambda *a, **k: self.gui.typed.append("click")
        cancel = threading.Event()
        self.addCleanup(setattr, Computer, "_gate", Computer.__dict__["_gate"])  # the staticmethod itself
        Computer._gate = staticmethod(lambda *a, **k: cancel.set())  # STOP lands mid-check
        obs = self._observe()["observationId"]
        out = self.pc.run({"action": "screen_click", "x": 10, "y": 10, "observationId": obs}, cancel=cancel)
        self.assertTrue(out.get("stopped"))
        self.assertEqual(self.gui.typed, [])

    def test_an_unreadable_target_is_asked_about_not_clicked(self):
        import ocade_accessibility
        import ocade_computer
        self.gui.click = lambda *a, **k: self.gui.typed.append("click")
        self.addCleanup(setattr, ocade_computer, "SYSTEM", ocade_computer.SYSTEM)
        self.addCleanup(setattr, ocade_accessibility, "gate_at", ocade_accessibility.gate_at)
        ocade_computer.SYSTEM = "Windows"

        def unreadable(*_a, **_k):
            raise RuntimeError("UI Automation could not read that window")
        ocade_accessibility.gate_at = unreadable
        obs = self._observe()["observationId"]
        out = self.pc.run({"action": "screen_click", "x": 10, "y": 10, "observationId": obs})
        self.assertEqual(out["status"], "needs_confirmation")
        self.assertEqual(self.gui.typed, [])
        obs = self._observe()["observationId"]
        out = self.pc.run({"action": "screen_click", "x": 10, "y": 10, "observationId": obs}, confirmed=True)
        self.assertEqual(out["status"], "done")  # the person said Continue: their decision
        self.assertEqual(self.gui.typed, ["click"])

    def test_the_same_window_moved_or_changed_under_the_point_is_stale(self):
        from PIL import Image
        self.gui.click = lambda *a, **k: self.gui.typed.append("click")
        window = type("W", (), {"title": "Editor", "left": 0, "top": 0, "width": 800, "height": 600})()
        self.gui.getActiveWindow = lambda: window
        obs = self._observe()["observationId"]
        window.left = 40  # same title, moved
        self.assertEqual(self.pc.run({"action": "screen_click", "x": 10, "y": 10,
                                      "observationId": obs})["status"], "stale")
        window.left = 0
        obs = self._observe()["observationId"]
        self.pc._observation["grey"] = Image.new("L", (1920, 1080), 255)  # what was seen: white
        self.addCleanup(setattr, Computer, "_changed_at", Computer._changed_at)
        seen = []
        Computer._changed_at = lambda pc, point, half=24: seen.append(point) or True  # now: different
        self.assertEqual(self.pc.run({"action": "screen_click", "x": 10, "y": 10,
                                      "observationId": obs})["status"], "stale")
        self.assertTrue(seen)
        self.assertEqual(self.gui.typed, [])

    def test_the_pixels_under_a_point_decide_whether_it_changed(self):
        from PIL import Image
        import mss
        self._observe()
        held = self.pc._observation
        held["geometry"].update(x=0, y=0)
        now = {"img": Image.new("RGB", (48, 48), (255, 255, 255))}

        class Grab:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def grab(self, box):
                image = now["img"]
                return type("Raw", (), {"size": image.size, "rgb": image.tobytes()})()
        self.addCleanup(setattr, mss, "MSS", getattr(mss, "MSS", None))
        mss.MSS = Grab
        held["grey"] = Image.new("L", (1920, 1080), 255)
        self.assertFalse(self.pc._changed_at((100, 100)))
        now["img"] = Image.new("RGB", (48, 48), (0, 0, 0))  # a popup appeared there
        self.assertTrue(self.pc._changed_at((100, 100)))


class EgressTest(unittest.TestCase):
    """JARVIS-053: the browser cannot be steered into the device's own network."""

    def test_address_classes(self):
        for address in ("127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254",
                        "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fc00::1",
                        "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "64:ff9b::7f00:1"):
            self.assertFalse(is_public(address), address)
        for address in ("8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "64:ff9b::808:808"):
            self.assertTrue(is_public(address), address)

    def test_the_refusal_is_a_complete_http_answer(self):
        from ocade_egress import BLOCKED_PAGE
        head, _, body = BLOCKED_PAGE.partition(b"\r\n\r\n")
        self.assertIn(f"Content-Length: {len(body)}".encode(), head)

    def test_names_resolving_to_private_addresses_are_refused(self):
        policy = Policy()
        for host in ("localhost", "127.0.0.1", "[::1]", "2130706433"):
            with self.assertRaises(Blocked, msg=host):
                policy.resolve(host, 80)
        self.assertIsNotNone(policy.blocked)

    def test_an_allowed_private_site_resolves(self):
        policy = Policy()
        policy.allowed = frozenset({"localhost"})
        self.assertTrue(set(policy.resolve("localhost", 80)) <= {"127.0.0.1", "::1"})

    def test_the_proxy_refuses_and_connects_only_to_checked_addresses(self):
        class Hello(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"private admin panel")

            def log_message(self, *_):
                pass

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Hello)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        port = server.server_address[1]
        proxy = EgressProxy()
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy.url}))
        try:
            with self.assertRaises(urllib.error.HTTPError) as refused:
                opener.open(f"http://127.0.0.1:{port}/", timeout=5)
            self.assertEqual(refused.exception.code, 403)
            with self.assertRaises(urllib.error.HTTPError):
                opener.open(f"http://localhost:{port}/", timeout=5)
            # The same page, once the person allowed that site, goes through.
            proxy.policy.allowed = frozenset({"localhost"})
            self.assertEqual(opener.open(f"http://localhost:{port}/", timeout=5).read(),
                             b"private admin panel")
            # HTTPS tunnels are checked the same way.
            with socket.create_connection(("127.0.0.1", proxy.server_address[1]), timeout=5) as s:
                s.sendall(b"CONNECT 10.0.0.1:443 HTTP/1.1\r\nHost: 10.0.0.1:443\r\n\r\n")
                self.assertIn(b"403", s.recv(100))
        finally:
            server.shutdown()
            proxy.shutdown()


if __name__ == "__main__":
    unittest.main()


class IdentityRecoveryTest(unittest.TestCase):
    """JARVIS-031: a damaged identity never silently becomes a second device."""

    def test_damaged_identity_refuses_to_enroll_again(self):
        from ocade_identity import Identity
        home = Path(tempfile.mkdtemp())
        (home / "device.json").write_text('{"deviceId": "d1", "appr')
        (home / "device.key").write_text("not a key")
        identity = Identity(home)
        self.assertTrue(identity.damaged)
        self.assertFalse(identity.connected)
        with self.assertRaises(RuntimeError):
            identity.enroll("https://ocade.test", "PC", "Windows")
        self.assertEqual((home / "device.key").read_text(), "not a key")  # nothing overwritten
        identity.forget()
        self.assertFalse(Identity(home).damaged)


class UninstallTest(unittest.TestCase):
    """JARVIS-032: uninstall stops the running agent before removing its key."""

    def test_uninstall_stops_the_running_agent_first(self):
        import ocade_agent
        guard = ocade_agent.single_instance()
        if guard is None:
            self.skipTest("an OCADE agent is running on this computer")
        order: list[str] = []

        def on_exit():
            order.append("stopped")
            guard.close()
        ocade_agent.serve_exit(guard, on_exit)
        home = Path(tempfile.mkdtemp())
        (home / "device.key").write_text("k")
        from unittest import mock
        with mock.patch.object(ocade_agent, "remove_autostart", lambda: None):
            ocade_agent.uninstall(home)
        self.assertEqual(order, ["stopped"])
        self.assertFalse(home.exists())

    def test_another_process_without_the_secret_cannot_end_the_agent(self):
        import socket
        import ocade_agent
        guard = ocade_agent.single_instance()
        if guard is None:
            self.skipTest("an OCADE agent is running on this computer")
        ended: list[str] = []
        ocade_agent.serve_exit(guard, lambda: ended.append("ended"))
        try:
            for word in (b"exit", b"exit 0000"):
                with socket.create_connection(("127.0.0.1", ocade_agent.SINGLE_INSTANCE_PORT), 2) as conn:
                    conn.sendall(word)
                    conn.settimeout(3)
                    self.assertEqual(conn.recv(8), b"")
            self.assertEqual(ended, [])
        finally:
            guard.close()

    def test_an_agent_that_does_not_answer_is_ended_and_nothing_starts_at_login(self):
        """
        Found on a real install: an agent still waiting to be connected did not
        answer "exit", so uninstalling left it running and starting at every login.
        """
        import ocade_agent
        guard = ocade_agent.single_instance()  # held, and nobody answers
        if guard is None:
            self.skipTest("an OCADE agent is running on this computer")
        order: list[str] = []

        def end() -> bool:
            order.append("ended")
            guard.close()
            return True
        home = Path(tempfile.mkdtemp())
        (home / "device.key").write_text("k")
        from unittest import mock
        with mock.patch.object(ocade_agent, "remove_autostart", lambda: order.append("no login entry")), \
                mock.patch.object(ocade_agent, "end_other_agents", end):
            ocade_agent.uninstall(home)
        self.assertEqual(order, ["no login entry", "ended"])
        self.assertFalse(home.exists())
