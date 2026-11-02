"""Anonymous rendered web predicates against disposable HTTP fixtures, never customer sites.

The explicit private-web owner flag is confined to these tests. Assertions inspect
real HTTP requests, a real Chromium renderer, and the real MCP verifier worker.
Safety negatives call the lower worker boundary through the real, handshaken MCP
session; they do not relax the production Gateway/intent URL schema.
"""

import inspect
import json
import os
import shutil
import tempfile
import threading
import unittest
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit

import anyio

from ocade_agent.gateway import Gateway

BROWSER = os.environ.get("OCADE_BROWSER_EXECUTABLE") or shutil.which("chromium")


def check(url, text, key="required"):
    return {"id": key, "description": "The page visibly contains the requested text",
            "kind": "web_text_contains", "params": {"url": url, "text": text}}


@unittest.skipUnless(BROWSER, "needs a display and a Chromium executable")
class RenderedWebVerification(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.routes, self.received, self.servers = {}, [], []
        self.base = self.serve()

    def serve(self):
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                owner.received.append((self.server.server_port, "GET", self.path))
                result = owner.routes.get(urlsplit(self.path).path, (404, {}, "Not found"))
                if callable(result):
                    result = result(self)
                status, headers, body = result
                self.send_response(status)
                self.send_header("content-type", "text/html; charset=utf-8")
                for name, value in headers.items():
                    self.send_header(name, value)
                body = body.encode("utf-8")
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_POST(self):
                owner.received.append((self.server.server_port, "POST", self.path))
                self.send_response(204)
                self.end_headers()

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.servers.append(server)
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join, 3)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_port}"

    def run_checks(self, checks, private=True, executable=None):
        async def run():
            async with Gateway(self.folder.name, home=str(Path(self.folder.name) / "agent")) as gateway:
                session = await gateway._session("ocade_agent.verify_worker")
                with anyio.fail_after(90):
                    result = await session.call_tool("verify_checks", {"checks": checks},
                                                     read_timeout_seconds=95)
                self.assertFalse(result.is_error, result)
                evidence = result.structured_content or json.loads(result.content[0].text)
                return evidence["result"] if set(evidence) == {"result"} else evidence

        environment = {"OCADE_ALLOW_PRIVATE_WEB": "1" if private else "0",
                       "OCADE_BROWSER_EXECUTABLE": executable or BROWSER}
        with patch.dict(os.environ, environment):
            evidence = anyio.run(run)
        self.assertIn("predicates", evidence)
        return evidence

    def test_hidden_source_content_cannot_satisfy_a_rendered_page_check(self):
        tokens = {key: uuid.uuid4().hex for key in (
            "script", "style", "template", "hidden", "ancestor", "display", "visibility",
            "opacity", "parent_opacity", "javascript", "offscreen", "clipped", "visible")}
        self.routes["/page"] = (200, {}, f"""
            <!doctype html><html><head><style>
            .gone {{display:none}} .clip {{clip-path:inset(100%)}}
            .unused {{ --payload: "{tokens['style']}"; }}
            </style></head><body>
            <script>window.payload = "{tokens['script']}";</script>
            <template>{tokens['template']}</template>
            <p hidden>{tokens['hidden']}</p>
            <div hidden><p>{tokens['ancestor']}</p></div>
            <p class="gone">{tokens['display']}</p>
            <p style="visibility:hidden">{tokens['visibility']}</p>
            <p style="opacity:0">{tokens['opacity']}</p>
            <div style="opacity:0"><p>{tokens['parent_opacity']}</p></div>
            <p id="javascript">{tokens['javascript']}</p>
            <p style="position:absolute;left:-10000px">{tokens['offscreen']}</p>
            <p class="clip">{tokens['clipped']}</p>
            <p>{tokens['visible']}</p>
            <script>
            document.getElementById("javascript").style.display = "none";
            Element.prototype.checkVisibility = () => true;
            </script>
            </body></html>""")
        proposed = [check(self.base + "/page", token, key) for key, token in tokens.items()]
        predicates = {}
        for start in range(0, len(proposed), 10):
            predicates.update(self.run_checks(proposed[start:start + 10])["predicates"])
        self.assertIs(predicates.pop("visible"), True, predicates)
        for key, value in predicates.items():
            with self.subTest(hidden=key):
                self.assertIsNot(value, True, "hidden source text must not become proof")
        self.assertEqual(len([request for request in self.received if request[2] == "/page"]), 2,
                         "same-URL predicates in one call must share one fresh observation")

    def test_private_or_file_initial_urls_are_not_fetched(self):
        marker = uuid.uuid4().hex
        self.routes["/private"] = (200, {}, "<p>" + marker + "</p>")
        result = self.run_checks([check(self.base + "/private", marker)], private=False)
        self.assertIsNone(result["predicates"]["required"])
        self.assertEqual(self.received, [], "no private request may precede the refusal")
        customer_file = Path(self.folder.name) / (uuid.uuid4().hex + ".html")
        customer_file.write_text("<p>" + marker + "</p>", encoding="utf-8")
        result = self.run_checks([check(customer_file.as_uri(), marker)])
        self.assertIsNone(result["predicates"]["required"])
        self.assertEqual(customer_file.read_text(encoding="utf-8"), "<p>" + marker + "</p>")

    def test_redirects_are_checked_before_the_destination_receives_a_request(self):
        marker = uuid.uuid4().hex
        trap = self.serve()
        route = "/" + uuid.uuid4().hex
        self.routes[route] = (200, {}, "<p>" + marker + "</p>")
        for destination in (trap + route, "file:///" + uuid.uuid4().hex + ".html"):
            with self.subTest(destination=destination):
                self.routes["/redirect"] = (302, {"location": destination}, "")
                result = self.run_checks([check(self.base + "/redirect", marker)])
                self.assertIsNone(result["predicates"]["required"])
                self.assertFalse(any(request[2] == route for request in self.received),
                                 "a private/off-origin redirect must be blocked before its HTTP effect")

    def test_same_origin_redirects_and_visible_text_are_observable(self):
        marker = uuid.uuid4().hex
        self.routes["/redirect"] = (302, {"location": "/visible"}, "")
        self.routes["/visible"] = (200, {}, "<p>" + marker + "</p>")
        result = self.run_checks([check(self.base + "/redirect", marker)])
        self.assertIs(result["predicates"]["required"], True, result)

    def test_blocked_subresources_or_mutations_leave_the_predicate_unverified(self):
        marker = uuid.uuid4().hex
        trap = self.serve()
        route = "/" + uuid.uuid4().hex
        self.routes[route] = (200, {}, "<p>" + marker + "</p>")
        for resource in (
            '<link rel="stylesheet" href="' + trap + route + '">',
            '<script>fetch("' + self.base + route + '", {method:"POST"})</script>',
        ):
            with self.subTest(resource=resource):
                self.routes["/page"] = (200, {}, "<p>" + marker + "</p>" + resource)
                result = self.run_checks([check(self.base + "/page", marker)])
                self.assertIsNone(result["predicates"]["required"])
                self.assertFalse(any(request[2] == route for request in self.received),
                                 "the verifier must not perform a blocked request")

    def test_an_unavailable_browser_is_unverified_instead_of_a_source_text_pass(self):
        marker = uuid.uuid4().hex
        self.routes["/page"] = (200, {}, "<p>" + marker + "</p>")
        result = self.run_checks([check(self.base + "/page", marker)],
                                 executable=str(Path(self.folder.name) / "missing-browser"))
        self.assertIsNone(result["predicates"]["required"])

    def test_owned_browsers_close_after_observation_and_navigation_failure(self):
        from playwright.async_api import BrowserType
        from ocade_agent import verify_worker

        marker = uuid.uuid4().hex
        self.routes["/visible"] = (200, {}, "<p>" + marker + "</p>")
        self.routes["/error"] = (503, {}, "<p>" + marker + "</p>")
        launched = []
        launch = BrowserType.launch

        async def tracked(browser_type, *args, **kwargs):
            browser = await launch(browser_type, *args, **kwargs)
            launched.append(browser)
            return browser

        async def run():
            for route, expected in (("/visible", True), ("/error", None)):
                result = verify_worker.verify_checks([check(self.base + route, marker)])
                if inspect.isawaitable(result):
                    result = await result
                self.assertIs(result["predicates"]["required"], expected, result)

        with patch.dict(os.environ, {"OCADE_ALLOW_PRIVATE_WEB": "1", "OCADE_BROWSER_EXECUTABLE": BROWSER}), patch.object(
            BrowserType, "launch", tracked
        ):
            anyio.run(run)
        self.assertEqual(len(launched), 2)
        self.assertTrue(all(not browser.is_connected() for browser in launched),
                        "every owned verifier browser must disconnect on both paths")


if __name__ == "__main__":
    unittest.main()
