"""Real-Chromium regression for OCADE structured browser control.

Run: OCADE_BROWSER_EXECUTABLE=/path/to/chromium python -m unittest discover jarvis-runtime/tests
"""
import functools
import http.server
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from actions.browser_control import _BrowserSession  # noqa: E402

PAGES = {
    "index.html": """<title>Home</title><h1>Home</h1>
      <a href="/next.html">Next page</a>
      <label>Search <input id="q"></label>
      <button onclick="document.getElementById('q').value='x'">Fill</button>
      <form onsubmit="event.preventDefault()"><input name="c" autocomplete="cc-number">
        <input type="password" name="pw"><button>Place order</button></form>
      <button id="del">Delete account</button>
      <button id="grow" onclick="this.textContent='Grown';">Grow</button>""",
    "next.html": "<title>Next</title><p>Arrived</p>",
    "captcha.html": "<title>Check</title><div class='g-recaptcha'></div><p>Verify you are human</p>",
    "otp.html": "<title>Code</title><input autocomplete='one-time-code'>",
}


class BrowserControlTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.mkdtemp()
        for name, html in PAGES.items():
            Path(cls.root, name).write_text(html)
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=cls.root)
        http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        os.environ["OCADE_JARVIS_HOME"] = tempfile.mkdtemp()
        cls.s = _BrowserSession("chrome", mode="isolated", headless=True,
                                executable=os.environ.get("OCADE_BROWSER_EXECUTABLE"))
        cls.s.start()

    @classmethod
    def tearDownClass(cls):
        cls.s.close()
        cls.server.shutdown()

    def act(self, action, confirmed=False):
        return self.s.run(self.s.act(action, confirmed), timeout=60)

    def home(self):
        out = self.act({"action": "open", "url": f"{self.base}/index.html"})
        self.assertEqual(out["status"], "done")
        return out["observation"]

    def ref(self, obs, name):
        return next(e["ref"] for e in obs["elements"] if e["name"] == name)

    def test_observes_semantic_elements(self):
        obs = self.home()
        names = {e["name"] for e in obs["elements"]}
        self.assertIn("Next page", names)
        self.assertEqual(obs["humanBoundary"], "password")
        self.assertTrue(obs["observationId"].startswith("o"))

    def test_click_by_identity_and_verifies_navigation(self):
        obs = self.home()
        out = self.act({"action": "click", "ref": self.ref(obs, "Next page"),
                        "observationId": obs["observationId"]})
        self.assertEqual(out["status"], "done")
        self.assertIn("url", out["changed"])
        self.assertTrue(out["observation"]["url"].endswith("/next.html"))

    def test_type_is_verified(self):
        obs = self.home()
        out = self.act({"action": "type", "ref": self.ref(obs, "Search"), "text": "hello",
                        "observationId": obs["observationId"]})
        self.assertEqual(out["status"], "done")
        field = next(e for e in out["observation"]["elements"] if e["name"] == "Search")
        self.assertEqual(field["value"], "hello")

    def test_stale_coordinates_are_refused_after_resize(self):
        obs = self.home()
        page = self.s._page
        self.s.run(page.set_viewport_size({"width": 700, "height": 600}))
        out = self.act({"action": "click_at", "x": 10, "y": 10,
                        "observationId": obs["observationId"]})
        self.assertEqual(out["status"], "stale")
        self.assertIn("resized", out["summary"])
        fresh = out["observation"]
        self.assertEqual(fresh["viewport"]["w"], 700)
        self.s.run(page.set_viewport_size({"width": 1280, "height": 800}))

    def test_stale_coordinates_are_refused_after_zoom_or_scroll(self):
        obs = self.home()
        self.s.run(self.s._page.evaluate("document.body.style.height='3000px'; scrollTo(0, 400)"))
        out = self.act({"action": "click_at", "x": 10, "y": 10,
                        "observationId": obs["observationId"]})
        self.assertEqual(out["status"], "stale")

    def test_fresh_coordinates_are_accepted(self):
        obs = self.act({"action": "open", "url": f"{self.base}/next.html"})["observation"]
        out = self.act({"action": "click_at", "x": 20, "y": 20,
                        "observationId": obs["observationId"]})
        self.assertEqual(out["status"], "done")

    def test_changed_element_identity_is_refused(self):
        obs = self.home()
        grow = self.ref(obs, "Grow")
        self.s.run(self.s._page.evaluate("document.getElementById('grow').textContent='Other'"))
        out = self.act({"action": "click", "ref": grow, "observationId": obs["observationId"]})
        self.assertEqual(out["status"], "stale")

    def test_old_observation_is_refused(self):
        first = self.home()
        self.act({"action": "observe"})
        out = self.act({"action": "click", "ref": self.ref(first, "Next page"),
                        "observationId": first["observationId"]})
        self.assertEqual(out["status"], "stale")

    def test_purchase_is_never_performed(self):
        obs = self.home()
        out = self.act({"action": "click", "ref": self.ref(obs, "Place order"),
                        "observationId": obs["observationId"]}, confirmed=True)
        self.assertEqual(out["status"], "blocked")

    def test_enter_on_a_purchase_form_is_blocked(self):
        obs = self.home()
        pw = next(e["ref"] for e in obs["elements"] if e.get("type") == "password")
        self.s.run(self.s._page.focus(f'[data-ocade-ref="{pw}"]'))
        out = self.act({"action": "press", "key": "Enter"}, confirmed=True)
        self.assertEqual(out["status"], "blocked")

    def test_sensitive_submission_needs_a_person(self):
        obs = self.home()
        action = {"action": "click", "ref": self.ref(obs, "Delete account"),
                  "observationId": obs["observationId"]}
        self.assertEqual(self.act(action)["status"], "needs_confirmation")
        self.assertEqual(self.act(action, confirmed=True)["status"], "done")

    def test_passwords_and_cards_stay_human(self):
        obs = self.home()
        pw = next(e["ref"] for e in obs["elements"] if e.get("type") == "password")
        card = next(e["ref"] for e in obs["elements"] if e.get("type") == "text" and e["name"] == "")
        oid = obs["observationId"]
        self.assertEqual(self.act({"action": "type", "ref": pw, "text": "x", "observationId": oid})["status"],
                         "human_required")
        self.assertEqual(self.act({"action": "type", "ref": card, "text": "4111", "observationId": oid})["status"],
                         "blocked")

    def test_human_security_boundaries_are_detected(self):
        out = self.act({"action": "open", "url": f"{self.base}/captcha.html"})
        self.assertEqual(out["observation"]["humanBoundary"], "captcha")
        out = self.act({"action": "open", "url": f"{self.base}/otp.html"})
        self.assertEqual(out["observation"]["humanBoundary"], "otp")

    def test_verification_pages_cannot_be_operated(self):
        obs = self.act({"action": "open", "url": f"{self.base}/captcha.html"})["observation"]
        out = self.act({"action": "click_at", "x": 20, "y": 20, "observationId": obs["observationId"]})
        self.assertEqual(out["status"], "human_required")
        self.assertEqual(self.act({"action": "press", "key": "Enter"})["status"], "human_required")

    def test_multiple_tabs(self):
        self.home()
        out = self.act({"action": "new_tab", "url": f"{self.base}/next.html"})
        tabs = out["observation"]["tabs"]
        self.assertGreaterEqual(len(tabs), 2)
        self.assertTrue(tabs[-1]["active"])
        back = self.act({"action": "switch_tab", "index": 0})
        self.assertTrue(back["observation"]["tabs"][0]["active"])
        self.act({"action": "switch_tab", "index": len(tabs) - 1})
        self.assertEqual(self.act({"action": "close_tab"})["status"], "done")

    def test_only_web_addresses_open(self):
        out = self.act({"action": "open", "url": "file:///etc/passwd"})
        self.assertEqual(out["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
