"""The actor browser's only way out: a loopback CONNECT proxy that pins each connection (D4).

The browser worker checks a URL's host before a request, but Chromium and Playwright would
resolve the name again when they connect, so a name could answer public to the check and
private to the connection (DNS rebinding), and a subresource redirect could reach an
unchecked host. Every browser connection therefore goes through this proxy instead: it
resolves the name once, refuses unless every answer is allowed, and connects only to a
checked address. TLS stays end to end between the browser and the site.

When the computer has its own HTTP proxy, the name is still checked here first, but the
tunnel is requested from that proxy by name: proxies commonly allow or inspect by host name
and refuse numeric targets, and on such a network the proxy is the boundary that resolves.

Only authenticated CONNECT to permitted ports is served; plain HTTP is refused. The
credentials are random per browser launch, so no other local program can use it.
"""

from __future__ import annotations

import asyncio
import base64
import hmac
import secrets
import socket
import urllib.request
from collections.abc import Callable
from urllib.parse import unquote, urlsplit

HEAD_LIMIT = 8192
CONNECT_TIMEOUT = 10


class PinnedProxy:
    def __init__(self, allow_address: Callable[[str], bool], ports: frozenset[int],
                 resolve: Callable = socket.getaddrinfo, upstream: str | None = None):
        self._allow, self._ports, self._resolve = allow_address, ports, resolve
        self._upstream = urlsplit(upstream if "://" in upstream else "http://" + upstream) if upstream else None
        self.username, self.password = secrets.token_hex(8), secrets.token_hex(16)
        self._expected = "Basic " + base64.b64encode(f"{self.username}:{self.password}".encode()).decode()
        self._server: asyncio.base_events.Server | None = None
        self.refused: list[str] = []  # hosts refused, newest last (bounded), for diagnosis

    async def start(self) -> int:
        self._server = await asyncio.start_server(self._serve, "127.0.0.1", 0)
        return self._server.sockets[0].getsockname()[1]

    async def close(self) -> None:
        if self._server is not None:
            self._server.close()
            self._server = None

    def _note(self, host: str) -> None:
        self.refused = (self.refused + [host])[-20:]

    async def _serve(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        upstream_writer = None
        try:
            head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 15)
            if len(head) > HEAD_LIMIT:
                return await _answer(writer, b"431 Request Header Fields Too Large")
            lines = head.decode("latin-1").split("\r\n")
            parts = lines[0].split(" ")
            headers = {k.strip().lower(): v.strip() for k, _, v in (line.partition(":") for line in lines[1:] if line)}
            if not hmac.compare_digest(headers.get("proxy-authorization", ""), self._expected):
                return await _answer(writer, b"407 Proxy Authentication Required",
                                     b'Proxy-Authenticate: Basic realm="ocade"\r\n')
            if len(parts) != 3 or parts[0] != "CONNECT":
                return await _answer(writer, b"405 Method Not Allowed")
            host, _, port_text = parts[1].rpartition(":")
            host = host.strip("[]").lower()
            if not host or not port_text.isdigit() or int(port_text) not in self._ports:
                self._note(host)
                return await _answer(writer, b"403 Forbidden")
            port = int(port_text)
            upstream = await asyncio.to_thread(self._connect, host, port)
            if upstream is None:
                self._note(host)
                return await _answer(writer, b"403 Forbidden")
            upstream_reader, upstream_writer = await asyncio.open_connection(sock=upstream)
            writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            await writer.drain()
            await asyncio.gather(_pipe(reader, upstream_writer), _pipe(upstream_reader, writer),
                                 return_exceptions=True)
        except (asyncio.IncompleteReadError, asyncio.LimitOverrunError, asyncio.TimeoutError,
                ConnectionError, OSError, UnicodeError):
            pass
        finally:
            for stream in (writer, upstream_writer):
                if stream is not None:
                    stream.close()

    def _connect(self, host: str, port: int) -> socket.socket | None:
        """One resolution; every answer must be allowed; connect only to those answers."""
        try:
            answers = list(dict.fromkeys(self._resolve(host, port, type=socket.SOCK_STREAM)))
        except OSError:
            return None
        if not answers or not all(self._allow(answer[4][0].split("%")[0]) for answer in answers):
            return None
        if self._upstream and not urllib.request.proxy_bypass(host):
            try:
                return _tunnel(self._upstream, host, port)
            except OSError:
                return None
        for family, kind, protocol, _, address in answers[:4]:
            try:
                sock = socket.socket(family, kind, protocol)
                sock.settimeout(CONNECT_TIMEOUT)
                try:
                    sock.connect(address)
                except OSError:
                    sock.close()
                    raise
                sock.settimeout(None)
                return sock
            except OSError:
                continue
        return None


def _tunnel(upstream, address: str, port: int) -> socket.socket:
    """CONNECT through the computer's own proxy to a name this proxy has already checked."""
    if upstream.scheme != "http" or not upstream.hostname:
        raise OSError("unsupported upstream proxy")
    sock = socket.create_connection((upstream.hostname, upstream.port or 80), timeout=CONNECT_TIMEOUT)
    try:
        target = f"[{address}]:{port}" if ":" in address else f"{address}:{port}"
        request = f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n"
        if upstream.username is not None:
            credential = unquote(upstream.username) + ":" + unquote(upstream.password or "")
            request += "Proxy-Authorization: Basic " + base64.b64encode(credential.encode()).decode() + "\r\n"
        sock.sendall((request + "\r\n").encode())
        reply = b""
        while b"\r\n\r\n" not in reply:
            chunk = sock.recv(4096)
            if not chunk or len(reply) > HEAD_LIMIT:
                raise OSError("upstream proxy closed")
            reply += chunk
        if reply.split(b" ", 2)[1:2] != [b"200"]:
            raise OSError("upstream proxy refused")
        sock.settimeout(None)
        return sock
    except BaseException:
        sock.close()
        raise


async def _answer(writer: asyncio.StreamWriter, status: bytes, extra: bytes = b"") -> None:
    writer.write(b"HTTP/1.1 " + status + b"\r\n" + extra + b"Content-Length: 0\r\nConnection: close\r\n\r\n")
    await writer.drain()


async def _pipe(source: asyncio.StreamReader, sink: asyncio.StreamWriter) -> None:
    try:
        while chunk := await source.read(65536):
            sink.write(chunk)
            await sink.drain()
    finally:
        sink.close()
