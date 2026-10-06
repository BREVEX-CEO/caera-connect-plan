"""The person's own browser, found and used without an add-on.

The attach test starts its OWN Chromium with remote debugging on (a stand-in
for the person's browser) and never touches a browser already running here.
"""
import functools
import http.server
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_existing_browser  # noqa: E402


def _port_file(folder: Path, port: int, path: str = "/devtools/browser/abc") -> None:
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "DevToolsActivePort").write_text(f"{port}\n{path}")


class PermissionPageTest(unittest.TestCase):
    """No developer settings for the person: JARVIS opens the browser's own permission page once."""

    def test_a_browser_that_does_not_allow_jarvis_is_handed_to_the_person_at_its_page(self):
        import unittest.mock
        import ocade_device
        browsers = ocade_device.Browsers(headless=True, cdp=None)
        with unittest.mock.patch.object(ocade_existing_browser, "find", return_value=None), \
                unittest.mock.patch.object(ocade_existing_browser, "open_default", return_value=False), \
                unittest.mock.patch.object(ocade_existing_browser, "open_setup", return_value="Chrome") as page:
            out = browsers.run("real", {"action": "observe"}, False, [], threading.Event())
        self.assertEqual(out["status"], "human_required")
        self.assertIn("Chrome needs your permission once", out["summary"])
        self.assertNotIn("chrome://", out["summary"])
        page.assert_called_once()


class DiscoveryTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.listener = socket.socket()
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen()
        self.port = self.listener.getsockname()[1]

    def tearDown(self):
        self.listener.close()

    def test_a_running_browser_is_found_on_loopback(self):
        _port_file(self.root / "chrome", self.port)
        found = ocade_existing_browser.find({"chrome": [self.root / "chrome"]})
        self.assertEqual(found, {"browser": "chrome",
                                 "endpoint": f"ws://127.0.0.1:{self.port}/devtools/browser/abc"})

    def test_a_file_left_by_a_closed_browser_is_ignored(self):
        closed = socket.socket()
        closed.bind(("127.0.0.1", 0))
        port = closed.getsockname()[1]
        closed.close()
        _port_file(self.root / "chrome", port)
        self.assertIsNone(ocade_existing_browser.find({"chrome": [self.root / "chrome"]}))

    def test_nothing_else_is_accepted(self):
        _port_file(self.root / "a", self.port, "/json/version")
        (self.root / "b").mkdir()
        (self.root / "b" / "DevToolsActivePort").write_text("not a port")
        self.assertIsNone(ocade_existing_browser.find(
            {"chrome": [self.root / "a", self.root / "b", self.root / "missing"]}))


def _chromium() -> str | None:
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            path = p.chromium.executable_path
        return path if Path(path).exists() else None
    except Exception:
        return None


@unittest.skipUnless(_chromium(), "needs Playwright Chromium")
class AttachTest(unittest.TestCase):
    """JARVIS works in a tab of its own inside an already-running browser, then leaves it as it was."""

    @classmethod
    def setUpClass(cls):
        cls.site = tempfile.mkdtemp()
        Path(cls.site, "index.html").write_text("<title>Mine</title><button>Hello</button>")
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=cls.site)
        http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.profile = Path(tempfile.mkdtemp())
        cls.browser = subprocess.Popen(
            [_chromium(), f"--user-data-dir={cls.profile}", "--remote-debugging-port=0",
             "--headless=new", "--no-first-run", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline and not (cls.profile / "DevToolsActivePort").exists():
            time.sleep(0.2)

    @classmethod
    def tearDownClass(cls):
        cls.browser.kill()
        cls.server.shutdown()

    def test_attach_observe_act_and_leave_the_persons_tabs_alone(self):
        from actions.browser_control import _BrowserSession
        found = ocade_existing_browser.find({"chrome": [self.profile]})
        self.assertIsNotNone(found, "the running browser was not found")
        session = _BrowserSession("chrome", mode="real", cdp_endpoint=found["endpoint"])
        session.start()
        url = f"http://127.0.0.1:{self.server.server_address[1]}/index.html"
        opened = session.run(session.act({"action": "open", "url": url}), timeout=60)
        self.assertEqual(opened["status"], "done", opened)
        observation = opened["observation"]
        self.assertEqual(observation["title"], "Mine")
        # The person's own tab is still there, and JARVIS's is a separate one.
        self.assertGreaterEqual(len(observation["tabs"]), 2)
        button = next(e for e in observation["elements"] if e["name"] == "Hello")
        clicked = session.run(session.act({"action": "click", "ref": button["ref"],
                                           "observationId": observation["observationId"]}), timeout=60)
        self.assertEqual(clicked["status"], "done", clicked)
        session.close()
        # Closing JARVIS's session never closes the person's browser.
        self.assertIsNone(self.browser.poll())

    def test_a_tab_of_the_persons_that_jarvis_switches_to_keeps_the_network_boundary(self):
        from actions.browser_control import _BrowserSession
        from ocade_egress import Policy
        found = ocade_existing_browser.find({"chrome": [self.profile]})
        egress = type("Egress", (), {"policy": Policy()})()
        session = _BrowserSession("chrome", mode="real", cdp_endpoint=found["endpoint"], egress=egress)
        session.start()
        url = f"http://127.0.0.1:{self.server.server_address[1]}/index.html"
        # JARVIS's own tab, then the person's first tab: both refuse a private address.
        for step in ({"action": "open", "url": url, "newTab": True},
                     {"action": "switch_tab", "index": 0},
                     {"action": "open", "url": url}):
            out = session.run(session.act(step), timeout=60)
        self.assertEqual(out["status"], "blocked", out)
        session.close()


@unittest.skipUnless(_chromium(), "needs Playwright Chromium")
class RestartTest(unittest.TestCase):
    """The person's browser restarts mid-task: the old connection is dropped and the next step reconnects."""

    def _start(self):
        browser = subprocess.Popen(
            [_chromium(), f"--user-data-dir={self.profile}", "--remote-debugging-port=0",
             "--headless=new", "--no-first-run", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline and not ocade_existing_browser.find({"chrome": [self.profile]}):
            time.sleep(0.2)
        return browser

    def test_reconnects_after_the_browser_restarts(self):
        import ocade_device
        self.profile = Path(tempfile.mkdtemp())
        original = ocade_existing_browser.find
        ocade_existing_browser.find = lambda dirs=None: original({"chrome": [self.profile]})
        browsers = ocade_device.Browsers(headless=True, cdp=None)
        try:
            first = self._start()
            cancel = threading.Event()
            ok = browsers.run("real", {"action": "observe"}, False, [], cancel)
            self.assertEqual(ok["status"], "done", ok)
            old = browsers.sessions["real"].cdp_endpoint
            first.kill()
            first.wait(10)
            (self.profile / "DevToolsActivePort").unlink(missing_ok=True)
            second = self._start()
            browsers._found = (-1e9, None)
            again = browsers.run("real", {"action": "observe"}, False, [], cancel)
            self.assertEqual(again["status"], "done", again)
            self.assertNotEqual(browsers.sessions["real"].cdp_endpoint, old)
            second.kill()
        finally:
            ocade_existing_browser.find = original
            browsers.close()


if __name__ == "__main__":
    unittest.main()
