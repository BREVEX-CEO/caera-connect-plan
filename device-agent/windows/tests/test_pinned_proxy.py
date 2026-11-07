"""The actor browser's pinning proxy (D4): one resolution, checked answers only, no rebinding.

Everything runs on loopback with simulated name resolution; no real site is contacted.
"""

import asyncio
import base64
import os
import shutil
import socket
import tempfile
import unittest
from unittest.mock import patch

from ocade_agent.pinned_proxy import PinnedProxy

BROWSER = os.environ.get("OCADE_BROWSER_EXECUTABLE") or shutil.which("chromium")


async def _echo_server():
    connections = []

    async def echo(reader, writer):
        connections.append(writer.get_extra_info("peername"))
        while data := await reader.read(1024):
            writer.write(data)
            await writer.drain()
        writer.close()

    server = await asyncio.start_server(echo, "127.0.0.1", 0)
    return server, server.sockets[0].getsockname()[1], connections


def _auth(proxy):
    return "Basic " + base64.b64encode(f"{proxy.username}:{proxy.password}".encode()).decode()


async def _status(port, request: bytes) -> bytes:
    head, _, writer = await _ask(port, request)
    writer.close()
    return head


async def _ask(port, request: bytes) -> tuple[bytes, asyncio.StreamReader, asyncio.StreamWriter]:
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    writer.write(request)
    await writer.drain()
    head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 15)
    return head, reader, writer


class PinnedProxyTest(unittest.TestCase):
    def run_async(self, body):
        return asyncio.run(asyncio.wait_for(body(), 30))

    def test_refusals_without_any_connection(self):
        async def body():
            echo, echo_port, connections = await _echo_server()
            calls = []

            def resolve(host, port, **kwargs):
                calls.append(host)
                address = {"good.test": "127.0.0.1"}.get(host, "10.1.2.3")
                return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, port))]

            mixed = lambda host, port, **kwargs: [  # noqa: E731 - one allowed and one private answer
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", port)),
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.1.2.3", port))]
            proxy = PinnedProxy(lambda a: a == "127.0.0.1", frozenset({echo_port}), resolve=resolve)
            port = await proxy.start()
            mixed_proxy = PinnedProxy(lambda a: a == "127.0.0.1", frozenset({echo_port}), resolve=mixed)
            mixed_port = await mixed_proxy.start()
            auth = _auth(proxy).encode()
            answers = [
                await _status(port, f"CONNECT good.test:{echo_port} HTTP/1.1\r\n\r\n".encode()),
                await _status(port, b"CONNECT good.test:%d HTTP/1.1\r\nProxy-Authorization: Basic d3Jvbmc6d3Jvbmc=\r\n\r\n" % echo_port),
                await _status(port, b"GET http://good.test/ HTTP/1.1\r\nProxy-Authorization: " + auth + b"\r\n\r\n"),
                await _status(port, b"CONNECT good.test:1 HTTP/1.1\r\nProxy-Authorization: " + auth + b"\r\n\r\n"),
                await _status(port, b"CONNECT private.test:%d HTTP/1.1\r\nProxy-Authorization: " % echo_port + auth + b"\r\n\r\n"),
                await _status(mixed_port, b"CONNECT mixed.test:%d HTTP/1.1\r\nProxy-Authorization: " % echo_port
                            + _auth(mixed_proxy).encode() + b"\r\n\r\n"),
            ]
            await proxy.close(), await mixed_proxy.close()
            echo.close()
            return [a.split(b"\r\n")[0] for a in answers], connections, calls

        statuses, connections, calls = self.run_async(body)
        self.assertEqual(statuses, [b"HTTP/1.1 407 Proxy Authentication Required"] * 2 + [
            b"HTTP/1.1 405 Method Not Allowed", b"HTTP/1.1 403 Forbidden", b"HTTP/1.1 403 Forbidden",
            b"HTTP/1.1 403 Forbidden"])
        self.assertEqual(connections, [], "a refused request never reaches any address")
        self.assertEqual(calls, ["private.test"], "unauthenticated or wrong-port requests are not even resolved")

    def test_one_resolution_pins_the_tunnel_against_rebinding(self):
        async def body():
            echo, echo_port, connections = await _echo_server()
            answers = iter(["127.0.0.1"])  # allowed at the check, private ever after

            def resolve(host, port, **kwargs):
                return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (next(answers, "10.9.9.9"), port))]

            proxy = PinnedProxy(lambda a: a == "127.0.0.1", frozenset({echo_port}), resolve=resolve)
            port = await proxy.start()
            head, reader, writer = await _ask(
                port, f"CONNECT rebind.test:{echo_port} HTTP/1.1\r\nProxy-Authorization: {_auth(proxy)}\r\n\r\n".encode())
            writer.write(b"through the tunnel")
            await writer.drain()
            echoed = await asyncio.wait_for(reader.readexactly(18), 10)
            writer.close()
            second = await _status(
                port, f"CONNECT rebind.test:{echo_port} HTTP/1.1\r\nProxy-Authorization: {_auth(proxy)}\r\n\r\n".encode())
            await proxy.close()
            echo.close()
            return head.split(b"\r\n")[0], echoed, second.split(b"\r\n")[0], len(connections)

        first, echoed, second, connected = self.run_async(body)
        self.assertEqual(first, b"HTTP/1.1 200 Connection Established")
        self.assertEqual(echoed, b"through the tunnel")
        self.assertEqual(second, b"HTTP/1.1 403 Forbidden", "the rebound answer is refused")
        self.assertEqual(connected, 1)

    def test_the_computers_proxy_gets_only_checked_names(self):
        async def body():
            seen = []

            async def upstream(reader, writer):
                seen.append((await reader.readuntil(b"\r\n\r\n")).split(b"\r\n")[0])
                writer.write(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                await writer.drain()
                writer.close()

            server = await asyncio.start_server(upstream, "127.0.0.1", 0)
            upstream_port = server.sockets[0].getsockname()[1]
            resolve = lambda host, port, **kwargs: [  # noqa: E731
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ({"site.test": "203.0.113.7"}.get(host, "10.0.0.8"), port))]
            proxy = PinnedProxy(lambda a: a == "203.0.113.7", frozenset({443}), resolve=resolve,
                                upstream=f"http://127.0.0.1:{upstream_port}")
            port = await proxy.start()
            with patch.dict(os.environ, {"no_proxy": "", "NO_PROXY": ""}):
                head = await _status(
                    port, f"CONNECT site.test:443 HTTP/1.1\r\nProxy-Authorization: {_auth(proxy)}\r\n\r\n".encode())
                private = await _status(
                    port, f"CONNECT intranet.test:443 HTTP/1.1\r\nProxy-Authorization: {_auth(proxy)}\r\n\r\n".encode())
            await proxy.close()
            server.close()
            return seen, head.split(b"\r\n")[0], private.split(b"\r\n")[0]

        seen, status, private = self.run_async(body)
        self.assertEqual(seen, [b"CONNECT site.test:443 HTTP/1.1"], "a name that failed the check never reaches it")
        self.assertEqual(private, b"HTTP/1.1 403 Forbidden")
        self.assertEqual(status, b"HTTP/1.1 403 Forbidden", "a refused upstream tunnel is not reported as open")

    @unittest.skipUnless(BROWSER, "needs a Chromium executable")
    def test_chromium_reaches_a_site_only_through_the_authenticated_pin(self):
        from playwright.async_api import async_playwright

        from tests import web_fixture

        server, base, pin = web_fixture.serve()
        fixture_port = server.server_port
        chrome = web_fixture.browser_wrapper(BROWSER, pin)
        resolved = []

        def resolve(host, port, **kwargs):
            resolved.append(host)
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", port))]

        async def body():
            proxy = PinnedProxy(lambda a: a == "127.0.0.1", frozenset({fixture_port}), resolve=resolve)
            port = await proxy.start()
            async with async_playwright() as playwright:
                context = await playwright.chromium.launch_persistent_context(
                    tempfile.mkdtemp(), executable_path=chrome, headless=True,
                    args=["--disable-background-networking", "--disable-component-update"],
                    proxy={"server": f"http://127.0.0.1:{port}", "username": proxy.username,
                           "password": proxy.password})
                page = await context.new_page()
                await page.goto(f"https://fixture.test:{fixture_port}/", wait_until="domcontentloaded")
                text = await page.inner_text("body")
                await context.close()
            await proxy.close()
            return text

        try:
            text = asyncio.run(asyncio.wait_for(body(), 60))
        finally:
            server.shutdown()
        self.assertIn("OCADE fixture home", text)
        self.assertIn("fixture.test", resolved, "Chromium's connection was resolved by the pin, not by Chromium")


class BrowserLaunchUsesThePin(unittest.TestCase):
    def test_public_mode_launches_through_the_pin_and_cleans_it_up(self):
        import anyio

        from ocade_agent import web_worker

        captured = {}

        class Chromium:
            async def launch_persistent_context(self, **options):
                captured.update(options)
                raise RuntimeError("stop after capturing the launch options")

        class Playwright:
            chromium = Chromium()

            async def stop(self):
                pass

        class Starter:
            async def start(self):
                return Playwright()

        with patch.object(web_worker, "PRIVATE_ALLOWED", False), \
                patch.object(web_worker, "PROFILE", __import__("pathlib").Path(tempfile.mkdtemp()) / "profile"), \
                patch("playwright.async_api.async_playwright", lambda: Starter()):
            with self.assertRaises(RuntimeError):
                anyio.run(web_worker._context)
        proxy = captured.get("proxy", {})
        self.assertTrue(proxy.get("server", "").startswith("http://127.0.0.1:"), captured)
        self.assertTrue(proxy.get("username") and proxy.get("password"))
        self.assertNotIn("pin", web_worker._browser, "a failed launch closes the pin")


if __name__ == "__main__":
    unittest.main()
