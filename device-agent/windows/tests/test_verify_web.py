"""Anonymous rendered web predicates against disposable HTTP fixtures, never customer sites.

The explicit private-web owner flag is confined to these tests. Assertions inspect
real HTTP requests, a real Chromium renderer, and the real MCP verifier worker.
Safety negatives call the lower worker boundary through the real, handshaken MCP
session; they do not relax the production Gateway/intent URL schema.
"""

import gzip
import inspect
import json
import os
import shutil
import tempfile
import threading
import unittest
import uuid
import urllib.request
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
                content_type = next((value for name, value in headers.items()
                                     if name.lower() == "content-type"), "text/html; charset=utf-8")
                self.send_header("content-type", content_type)
                for name, value in headers.items():
                    if name.lower() != "content-type":
                        self.send_header(name, value)
                body = body.encode("utf-8") if isinstance(body, str) else body
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass  # Expected when the verifier rejects a response budget before its body.

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

    def assert_fixture_reachable(self, url, marker):
        before = len(self.received)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url, timeout=5) as response:
            self.assertIn(marker, response.read().decode("utf-8"))
        self.assertTrue(any(request[2] == urlsplit(url).path for request in self.received[before:]),
                        "the controlled trap must independently demonstrate that it is reachable")

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
        keys = ("script", "style", "template", "hidden", "ancestor", "display", "visibility",
                "opacity", "parent_opacity", "javascript", "offscreen", "clipped", "transparent",
                "text_fill", "contrast", "pseudo", "first_letter", "tiny", "faint", "dark_canvas", "visible")
        tokens = {key: uuid.uuid4().hex for key in keys}
        static = f"""
            <!doctype html><html><head><style>
            .gone {{display:none}} .unused {{ --payload: "{tokens['style']}"; }}
            </style></head><body>
            <template>{tokens['template']}</template>
            <p hidden>{tokens['hidden']}</p>
            <div hidden><p>{tokens['ancestor']}</p></div>
            <p class="gone">{tokens['display']}</p>
            <p style="visibility:hidden">{tokens['visibility']}</p>
            <p style="opacity:0">{tokens['opacity']}</p>
            <div style="opacity:0"><p>{tokens['parent_opacity']}</p></div>
            <p>{tokens['visible']}</p></body></html>"""
        self.routes["/static"] = (200, {}, static)
        basic = ("style", "template", "hidden", "ancestor", "display", "visibility", "opacity", "parent_opacity")
        predicates = self.run_checks(
            [check(self.base + "/static", tokens[key], key) for key in (*basic, "visible")])["predicates"]
        self.assertIs(predicates.pop("visible"), True, predicates)
        for key, value in predicates.items():
            with self.subTest(hidden=key):
                self.assertIsNot(value, True, "hidden source text must not become proof")
        self.assertEqual(len([request for request in self.received if request[2] == "/static"]), 1,
                         "same-URL predicates in one call must share one fresh observation")
        dynamic = (f'<p id="javascript">{tokens["javascript"]}</p><script>'
                   f'window.payload = "{tokens["script"]}";'
                   'document.getElementById("javascript").style.display = "none";'
                   'Element.prototype.checkVisibility = () => true;</script>')
        self.routes["/dynamic"] = (200, {}, dynamic)
        for key, value in self.run_checks(
                [check(self.base + "/dynamic", tokens[key], key)
                 for key in ("script", "javascript")])["predicates"].items():
            with self.subTest(dynamic=key):
                self.assertIsNone(value, "script-dependent pages remain unverified")
        complex_pages = {
            "offscreen": '<p style="position:absolute;left:-10000px">{}</p>',
            "clipped": '<p style="clip-path:inset(100%)">{}</p>',
            "transparent": '<p style="color:transparent">{}</p>',
            "text_fill": '<p style="-webkit-text-fill-color:transparent">{}</p>',
            "contrast": '<p style="color:white;background:white">{}</p>',
            "tiny": '<p style="font-size:0.1px">{}</p>',
            "faint": '<p style="color:#fefefe;background:white">{}</p>',
            "dark_canvas": '<style>:root{{color-scheme:dark}}p{{color:Canvas}}</style><p>{}</p>',
            "first_letter": '<style>p::first-letter{{color:transparent}}</style><p>{}</p>',
            "pseudo": '<style>p::after{{content:"";position:absolute;inset:0;background:white}}</style>'
                      '<p style="position:relative">{}</p>',
        }
        for key, body in complex_pages.items():
            route = "/" + key
            self.routes[route] = (200, {}, body.format(tokens[key]))
            with self.subTest(rendering=key):
                result = self.run_checks([check(self.base + route, tokens[key])])
                self.assertIsNot(result["predicates"]["required"], True,
                                 "unsupported or invisible painting must not become proof")

    def test_private_or_file_initial_urls_are_not_fetched(self):
        marker = uuid.uuid4().hex
        self.routes["/private"] = (200, {}, "<p>" + marker + "</p>")
        customer_file = Path(self.folder.name) / (uuid.uuid4().hex + ".html")
        customer_file.write_text("<p>" + marker + "</p>", encoding="utf-8")
        for url, private in ((self.base + "/private", False), (customer_file.as_uri(), True)):
            with self.subTest(url=url):
                before = len(self.received)
                result = self.run_checks([check(url, marker)], private=private)
                self.assertIsNone(result["predicates"]["required"])
                self.assertEqual(self.received[before:], [], "no forbidden URL may be fetched")
                self.assertEqual(customer_file.read_text(encoding="utf-8"), "<p>" + marker + "</p>")

    def test_redirects_are_checked_before_the_destination_receives_a_request(self):
        marker = uuid.uuid4().hex
        trap = self.serve()
        route = "/" + uuid.uuid4().hex
        self.routes[route] = (200, {}, "<p>" + marker + "</p>")
        customer_file = Path(self.folder.name) / (uuid.uuid4().hex + ".html")
        customer_file.write_text("<p>" + marker + "</p>", encoding="utf-8")
        self.assert_fixture_reachable(trap + route, marker)
        for destination in (trap + route, customer_file.as_uri()):
            with self.subTest(destination=destination):
                before = len(self.received)
                self.routes["/redirect"] = (302, {"location": destination}, "")
                result = self.run_checks([check(self.base + "/redirect", marker)])
                self.assertIsNone(result["predicates"]["required"])
                self.assertFalse(any(request[2] == route for request in self.received[before:]),
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
        for resource, destination in (
            ('<link rel="stylesheet" href="' + trap + route + '">', trap + route),
            ('<iframe src="' + self.base + route + '"></iframe>', self.base + route),
            ('<script>fetch("' + self.base + route + '", {method:"POST"})</script>', self.base + route),
        ):
            with self.subTest(resource=resource):
                self.assert_fixture_reachable(destination, marker)
                before = len(self.received)
                self.routes["/page"] = (200, {}, "<p>" + marker + "</p>" + resource)
                result = self.run_checks([check(self.base + "/page", marker)])
                self.assertIsNone(result["predicates"]["required"])
                self.assertFalse(any(request[2] == route for request in self.received[before:]),
                                 "the verifier must not perform a blocked request")

        oversized = "<p>" + marker + "</p>" + (" " * 2_000_100)
        decoded = "<p>" + marker + "</p>" + (" " * 5_000_000)
        links = "".join('<link rel="stylesheet" href="/style-' + str(index) + '">' for index in range(80))
        for index in range(80):
            self.routes["/style-" + str(index)] = (200, {"content-type": "text/css"}, "")
        for label, headers, body, limit in (
            ("declared", {}, oversized, "response_bytes"),
            ("decoded", {"content-encoding": "gzip"}, gzip.compress(decoded.encode("utf-8")), "decoded_bytes"),
            ("requests", {}, "<p>" + marker + "</p>" + links, "request_count"),
        ):
            with self.subTest(resource_limit=label):
                self.routes["/budget"] = (200, headers, body)
                result = self.run_checks([check(self.base + "/budget", marker)])
                self.assertIsNone(result["predicates"]["required"])
                self.assertEqual(result["measured"]["required"]["error"], "web_resource_limit", result)
                self.assertEqual(result["measured"]["required"]["resourceLimit"], limit, result)

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
