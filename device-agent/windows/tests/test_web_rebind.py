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
        from playwright.async_api import Route

        from ocade_agent import verify_worker

        answers = iter(["93.184.216.34"])  # public at the first check, private ever after

        def resolve(host, *args, **kwargs):
            address = next(answers, "127.0.0.1")
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]

        fetched = []
        real_fetch = Route.fetch

        async def recorded(route, *args, **kwargs):
            fetched.append(route.request.url)
            return await real_fetch(route, *args, **kwargs)

        environment = {"OCADE_ALLOW_PRIVATE_WEB": "0", "OCADE_BROWSER_EXECUTABLE": BROWSER}
        with patch.dict(os.environ, environment), patch.object(socket, "getaddrinfo", resolve), \
                patch.object(Route, "fetch", recorded):
            seen, facts = anyio.run(verify_worker._web_texts, "https://rebind.example.test/", ["text"])
        self.assertEqual(seen, {"text": None})
        self.assertEqual(facts.get("error"), "web_request_blocked", facts)
        self.assertEqual(fetched, [], "nothing may be requested from a rebound name")


if __name__ == "__main__":
    unittest.main()
