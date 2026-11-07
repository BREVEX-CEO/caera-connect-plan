"""A name that resolves somewhere private by the time of the request is never fetched (D4).

Name resolution is simulated in-process; no real network or customer site is contacted.
"""

import os
import shutil
import socket
import unittest
from unittest.mock import patch

import anyio

BROWSER = os.environ.get("OCADE_BROWSER_EXECUTABLE") or shutil.which("chromium")


@unittest.skipUnless(BROWSER, "needs a Chromium executable")
class VerifierRebinding(unittest.TestCase):
    def test_a_name_rebound_to_a_private_address_is_refused_before_any_fetch(self):
        """The verifier resolves a name once, checks that answer, and connects only to it: a
        later private answer (DNS rebinding) is never used, and Chromium never fetches itself."""
        from playwright.async_api import Route

        from ocade_agent import verify_worker

        answers = iter(["93.184.216.34"])  # public at the first check, private ever after
        resolved, connected = [], []

        def resolve(host, *args, **kwargs):
            address = next(answers, "127.0.0.1")
            resolved.append((host, address))
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]

        real_connect = socket.socket.connect

        def connect(sock, address):
            # Windows builds its event loop's self-pipe from a loopback socket pair; that is not
            # the verifier's request (port 443), so it goes through.
            if isinstance(address, tuple) and address[1] != 443:
                return real_connect(sock, address)
            connected.append(address)
            raise ConnectionRefusedError("no real network in this test")

        fetched = []
        real_fetch = Route.fetch

        async def recorded(route, *args, **kwargs):
            fetched.append(route.request.url)
            return await real_fetch(route, *args, **kwargs)

        # Direct connections only: a configured proxy would resolve the name itself.
        environment = {name: value for name, value in os.environ.items()
                       if name.lower() not in ("http_proxy", "https_proxy", "all_proxy", "no_proxy")}
        environment |= {"OCADE_ALLOW_PRIVATE_WEB": "0", "OCADE_BROWSER_EXECUTABLE": BROWSER}
        with patch.dict(os.environ, environment, clear=True), patch.object(socket, "getaddrinfo", resolve), \
                patch.object(socket.socket, "connect", connect), patch.object(Route, "fetch", recorded):
            seen, facts = anyio.run(verify_worker._web_texts, "https://rebind.example.test/", ["text"])
        self.assertEqual(seen, {"text": None})
        self.assertEqual(facts.get("error"), "web_unreachable", facts)
        self.assertEqual(resolved, [("rebind.example.test", "93.184.216.34")], "the name is resolved once")
        self.assertEqual(connected, [("93.184.216.34", 443)], "only the checked address is contacted")
        self.assertEqual(fetched, [], "Chromium never fetches the page itself")

if __name__ == "__main__":
    unittest.main()
