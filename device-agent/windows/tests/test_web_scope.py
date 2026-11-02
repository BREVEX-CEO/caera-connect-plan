"""Actor site-binding regressions through real MCP workers and controlled browsers.

The explicit private-web owner flag authorizes these disposable loopback fixtures.
It does not waive a page's fixed host binding. These tests can demonstrate an
off-site request-before-refusal; separate-profile direct-open controls prove the
actual browser transport reaches the trap. They do not independently prove a default-private
network bypass or qualify public DNS/CDN/WebRTC containment.
"""

import json
import os
import shutil
import ssl
import sys
import tempfile
import threading
import unittest
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlparse

import anyio

from ocade_agent.gateway import PROTOCOL, Gateway
from tests import web_fixture

BROWSER = os.environ.get("OCADE_BROWSER_EXECUTABLE") or shutil.which("chromium")
READY = bool(BROWSER and (sys.platform == "darwin" or web_fixture.WINDOWS_CI
                          or (sys.platform != "win32" and os.environ.get("DISPLAY"))))


def intent(operation, arguments):
    spec = PROTOCOL["operations"][operation]
    return {
        "v": 1, "key": uuid.uuid4().hex, "operation": operation,
        "capability": spec["capability"], "risk": spec["risk"], "arguments": arguments,
        "deadlineUtc": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
    }


class HttpTrap:
    """An independently reachable HTTP target, with factual request observations."""

    def __init__(self):
        self.token, self.path = uuid.uuid4().hex, "/" + uuid.uuid4().hex
        self.received, self.lock = [], threading.Lock()
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                with owner.lock:
                    owner.received.append({"method": "GET", "path": self.path,
                                           "host": self.headers.get("host", "")})
                body = ("<!doctype html><title>Trap</title><p>" + owner.token + "</p>").encode()
                self.send_response(200)
                self.send_header("content-type", "text/html; charset=utf-8")
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *_args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        # Different host from the actor fixture's 127.0.0.1 binding, not merely another port.
        self.url = f"http://localhost:{self.server.server_port}{self.path}"

    def observed(self):
        with self.lock:
            return [request.copy() for request in self.received if request["path"] == self.path]

    def baseline(self, case):
        before = len(self.observed())
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(self.url, timeout=5) as response:
            case.assertIn(self.token, response.read().decode("utf-8"))
        case.assertEqual(len(self.observed()), before + 1,
                         "the actual trap must independently demonstrate that it is reachable")

    def close(self):
        self.server.shutdown()
        self.thread.join(3)
        self.server.server_close()


@unittest.skipUnless(READY, "needs a display and a Chromium executable")
class ActorRequestScope(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.server, self.base, pin = web_fixture.serve()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.browser = web_fixture.browser_wrapper(BROWSER, pin)
        self.responses, self.primary_received = {}, []
        original = web_fixture.Handler.do_GET
        owner = self

        def respond(handler):
            route = urlparse(handler.path).path
            if route not in owner.responses:
                return original(handler)
            owner.primary_received.append({"path": route, "host": handler.headers.get("host", "")})
            body, content_type, status, headers = owner.responses[route]
            return handler._send(body, content_type, status, headers)

        interception = patch.object(web_fixture.Handler, "do_GET", respond)
        interception.start()
        self.addCleanup(interception.stop)

    def trap(self):
        trap = HttpTrap()
        self.addCleanup(trap.close)
        self.assertNotEqual(urlparse(self.base).hostname, urlparse(trap.url).hostname)
        trap.baseline(self)
        before = len(trap.observed())

        async def reachable(run):
            return await run("web.open", {"url": trap.url})

        control = self.run_steps(reachable, home=Path(self.folder.name) / "browser-reachability-control")
        self.assertEqual(control["status"], "observed", control)
        self.assertIn(trap.token, control["evidence"]["text"])
        self.assertEqual(len(trap.observed()), before + 1,
                         "the real browser transport must also demonstrate target reachability")
        return trap

    def page(self, body):
        route = "/" + uuid.uuid4().hex
        self.responses[route] = (("<!doctype html><title>Authorized fixture</title><body>"
                                 + body + "</body>").encode(),
                                 "text/html; charset=utf-8", 200, {})
        return self.base + route

    def run_steps(self, steps, home=None):
        async def run():
            agent_home = home or Path(self.folder.name) / "agent"
            async with Gateway(self.folder.name, home=str(agent_home)) as gateway:
                async def call(operation, arguments):
                    return await gateway.run(intent(operation, arguments), gateway.epoch)
                return await steps(call)

        with patch.dict(os.environ, {"OCADE_ALLOW_PRIVATE_WEB": "1",
                                     "OCADE_BROWSER_EXECUTABLE": self.browser}):
            return anyio.run(run)

    def assert_no_target_request(self, trap, before, receipt):
        observed = trap.observed()[before:]
        self.assertEqual(observed, [], "forbidden target received HTTP before refusal: "
                         + json.dumps({"requests": observed, "receipt": receipt}, default=str))

    def test_redirect_is_refused_before_an_unbound_host_receives_a_request(self):
        trap = self.trap()
        route = "/" + uuid.uuid4().hex
        self.responses[route] = (b"", "text/html; charset=utf-8", 302, {"location": trap.url})
        before = len(trap.observed())

        async def steps(run):
            return await run("web.open", {"url": self.base + route})

        receipt = self.run_steps(steps)
        self.assert_no_target_request(trap, before, receipt)
        self.assertNotEqual(receipt["status"], "observed", receipt)

    def test_same_site_redirects_are_followed_hop_by_hop(self):
        marker = uuid.uuid4().hex
        final = self.page("<p>" + marker + "</p>")
        middle = "/" + uuid.uuid4().hex
        first = "/" + uuid.uuid4().hex
        self.responses[middle] = (b"", "text/html; charset=utf-8", 302, {"location": final})
        self.responses[first] = (b"", "text/html; charset=utf-8", 302, {"location": middle})

        async def steps(run):
            return await run("web.open", {"url": self.base + first})

        receipt = self.run_steps(steps)
        self.assertEqual(receipt["status"], "observed", receipt)
        self.assertEqual(receipt["evidence"]["url"], final)
        self.assertIn(marker, receipt["evidence"]["text"])
        hops = [request["path"] for request in self.primary_received]
        self.assertEqual(hops, [first, middle, urlparse(final).path], "each hop is requested exactly once")

    def test_link_navigation_cannot_contact_a_host_outside_its_page_binding(self):
        trap = self.trap()
        url = self.page('<a href="' + trap.url + '">Open target</a>')
        before = len(trap.observed())

        async def steps(run):
            opened = await run("web.open", {"url": url})
            self.assertEqual(opened["status"], "observed", opened)
            evidence = opened["evidence"]
            link = next(control for control in evidence["controls"] if control.get("href") == trap.url)
            return await run("web.click", {"page": evidence["page"], "selector": link["selector"]})

        receipt = self.run_steps(steps)
        self.assert_no_target_request(trap, before, receipt)

    def test_popup_cannot_contact_an_unbound_host_before_it_is_closed(self):
        trap = self.trap()
        url = self.page('<a target="_blank" href="' + trap.url + '">Open target</a>')
        before = len(trap.observed())

        async def steps(run):
            opened = await run("web.open", {"url": url})
            self.assertEqual(opened["status"], "observed", opened)
            evidence = opened["evidence"]
            link = next(control for control in evidence["controls"] if control.get("href") == trap.url)
            return await run("web.click", {"page": evidence["page"], "selector": link["selector"]})

        receipt = self.run_steps(steps)
        self.assert_no_target_request(trap, before, receipt)

    def test_cross_host_subresources_remain_supported_in_an_allowed_fixture(self):
        marker = uuid.uuid4().hex
        route = "/" + uuid.uuid4().hex + ".js"
        self.responses[route] = (
            ('document.getElementById("resource-result").textContent=' + json.dumps(marker) + ";").encode(),
            "application/javascript", 200, {},
        )
        resource = self.base.replace("127.0.0.1", "localhost") + route
        self.assertNotEqual(urlparse(self.base).hostname, urlparse(resource).hostname)
        # The fixture's throwaway CA/SPKI is used only on this disposable test machine.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}),
                                            urllib.request.HTTPSHandler(context=ssl._create_unverified_context()))
        with opener.open(resource, timeout=5) as response:
            self.assertIn(marker, response.read().decode("utf-8"))
        self.assertTrue(any(request["path"] == route for request in self.primary_received))
        before = len([request for request in self.primary_received if request["path"] == route])
        url = self.page('<p id="resource-result">Waiting</p><script src="' + resource + '"></script>')

        async def steps(run):
            return await run("web.open", {"url": url})

        receipt = self.run_steps(steps)
        self.assertEqual(receipt["status"], "observed", receipt)
        self.assertIn(marker, receipt["evidence"]["text"])
        fetched = [request for request in self.primary_received if request["path"] == route][before:]
        self.assertEqual(len(fetched), 1, fetched)
        self.assertTrue(fetched[0]["host"].startswith("localhost:"), fetched)


if __name__ == "__main__":
    unittest.main()
