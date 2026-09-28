"""
The network boundary of JARVIS's isolated browser.

Every request the automation browser makes (pages, redirects, frames, images,
fetches, WebSockets) goes through this local proxy. The proxy resolves the name
itself, refuses when ANY address is not public (loopback, private, link-local,
carrier-grade NAT, multicast, reserved, IPv4-mapped IPv6 of those), and then
connects to exactly the address it checked, so a DNS answer that changes after
the check (rebinding) cannot reach the device's own network.

A private host is reachable only when the person allowed that site in OCADE;
the server sends those site scopes with each browser command.
"""
from __future__ import annotations

import ipaddress
import select
import socket
import socketserver
import threading
from urllib.parse import urlsplit

BLOCKED_PAGE = (b"HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nConnection: close\r\n"
                b"Content-Length: 55\r\n\r\nOCADE JARVIS does not open private network addresses.\n")


class Blocked(Exception):
    pass


def is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def scope_match(host: str, scopes: frozenset[str]) -> bool:
    labels = host.split(".")
    return any(".".join(labels[at:]) in scopes for at in range(len(labels)))


class Policy:
    def __init__(self) -> None:
        self.allowed: frozenset[str] = frozenset()
        self.blocked: str | None = None  # the last refusal, read by the action that caused it

    def resolve(self, host: str, port: int) -> list[str]:
        """The checked addresses to connect to, or Blocked."""
        host = host.strip("[]").lower().rstrip(".")
        try:
            infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except OSError as e:  # unresolvable names are simply unreachable, not a boundary hit
            raise Blocked(f"cannot resolve {host}") from e
        addresses = [info[4][0] for info in infos]
        if not addresses:
            raise Blocked(f"cannot resolve {host}")
        if all(is_public(a) for a in addresses) or scope_match(host, self.allowed):
            return list(dict.fromkeys(addresses))
        self.blocked = f"{host} is on a private network"
        raise Blocked(self.blocked)


class _Handler(socketserver.StreamRequestHandler):
    server: "EgressProxy"

    def handle(self) -> None:
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.connection.recv(65536)
            if not chunk or len(head) > 65536:
                return
            head += chunk
        header, _, rest = head.partition(b"\r\n\r\n")
        lines = header.decode("latin-1").split("\r\n")
        try:
            method, target, version = lines[0].split(" ", 2)
        except ValueError:
            return
        try:
            if method.upper() == "CONNECT":
                host, _, port = target.rpartition(":")
                upstream = self._open(host, int(port or 443))
                self.connection.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                if rest:
                    upstream.sendall(rest)
            else:
                url = urlsplit(target)
                if url.scheme != "http" or not url.hostname:
                    return
                upstream = self._open(url.hostname, url.port or 80)
                path = (url.path or "/") + (f"?{url.query}" if url.query else "")
                kept = [l for l in lines[1:] if not l.lower().startswith(("proxy-", "connection:"))]
                request = "\r\n".join([f"{method} {path} {version}", *kept, "Connection: close", "", ""])
                upstream.sendall(request.encode("latin-1") + rest)
        except (Blocked, OSError, ValueError):
            self.connection.sendall(BLOCKED_PAGE)
            return
        with upstream:
            _pipe(self.connection, upstream)

    def _open(self, host: str, port: int) -> socket.socket:
        error: OSError = OSError(f"cannot reach {host}")
        for address in self.server.policy.resolve(host, port):
            try:  # only ever an address that was checked
                return socket.create_connection((address, port), timeout=30)
            except OSError as e:
                error = e
        raise error


def _pipe(a: socket.socket, b: socket.socket) -> None:
    sockets = [a, b]
    while True:
        ready, _, broken = select.select(sockets, [], sockets, 120)
        if broken or not ready:
            return
        for s in ready:
            data = s.recv(65536)
            if not data:
                return
            (b if s is a else a).sendall(data)


class EgressProxy(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self) -> None:
        super().__init__(("127.0.0.1", 0), _Handler)
        self.policy = Policy()
        threading.Thread(target=self.serve_forever, daemon=True, name="ocade-egress").start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server_address[1]}"
