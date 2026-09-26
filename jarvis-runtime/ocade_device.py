"""
OCADE JARVIS device runtime — the active entry point of the working engine.

It pairs this machine with an OCADE account, then runs the browser actions a
JARVIS task queues for it. It holds no provider key and makes no model call:
intelligence stays in OCADE's Online authority, and this process only executes
and observes.

    python ocade_device.py pair --server https://ocade.in --code ABCD-2345
    python ocade_device.py run [--headless] [--real-browser-cdp http://127.0.0.1:9222]

`--real-browser-cdp` is the explicit on-device authorization for the user's own
browser (started by the user with --remote-debugging-port). Without it only the
isolated automation browser exists, whatever the account settings say.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

HOME = Path(os.environ.get("OCADE_JARVIS_HOME", Path.home() / ".ocade_jarvis"))
CREDENTIAL = HOME / "device.json"
POLL_IDLE_SECONDS = 1.0


def _post(server: str, path: str, body: dict, token: str | None = None) -> dict:
    request = urllib.request.Request(
        server.rstrip("/") + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 **({"Authorization": f"Bearer {token}"} if token else {})},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.loads(response.read().decode() or "{}")


def pair(server: str, code: str, name: str) -> None:
    reply = _post(server, "/api/jarvis/pair",
                  {"code": code, "name": name, "platform": platform.system()[:60]})
    HOME.mkdir(parents=True, exist_ok=True)
    CREDENTIAL.write_text(json.dumps({"server": server, "token": reply["token"],
                                      "deviceId": reply["deviceId"]}))
    CREDENTIAL.chmod(0o600)
    print(f"Paired as {name}. Run: python ocade_device.py run")


class Browsers:
    """One isolated session, plus the user's real browser only when authorized here."""

    def __init__(self, headless: bool, cdp: str | None):
        from actions.browser_control import _BrowserSession
        self._make = lambda mode: _BrowserSession(
            "chrome", mode=mode, headless=headless,
            executable=os.environ.get("OCADE_BROWSER_EXECUTABLE") or None, cdp_endpoint=cdp)
        self.cdp = cdp
        self.sessions: dict = {}

    def capabilities(self) -> dict:
        # Only what this runtime can genuinely execute today.
        return {"browser_isolated": True, "browser_real": bool(self.cdp),
                "computer_control": False, "files": False, "screen": False}

    def run(self, mode: str, action: dict, confirmed: bool) -> dict:
        if mode == "real" and not self.cdp:
            return {"status": "blocked",
                    "summary": "Your own browser is not authorized on this device"}
        session = self.sessions.get(mode)
        if session is None:
            session = self.sessions[mode] = self._make(mode)
            session.start()
        return session.run(session.act(action, confirmed), timeout=90)

    def frame(self, mode: str) -> str | None:
        session = self.sessions.get(mode)
        return session.run(session.frame(), timeout=20) if session else None


def run(headless: bool, cdp: str | None) -> None:
    held = json.loads(CREDENTIAL.read_text())
    server, token = held["server"], held["token"]
    browsers = Browsers(headless, cdp)
    results: list[dict] = []
    frame: dict | None = None
    print(f"OCADE JARVIS device running for {server}. Ctrl+C to stop.")
    while True:
        try:
            reply = _post(server, "/api/jarvis/device",
                          {"results": results, "frame": frame,
                           "capabilities": browsers.capabilities()}, token)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                print("This device is no longer paired. Pair it again from OCADE JARVIS.")
                return
            time.sleep(3)
            continue
        except (urllib.error.URLError, TimeoutError):
            time.sleep(3)
            continue
        results, frame = [], None
        for command in reply.get("commands", []):
            mode = command.get("mode", "isolated")
            try:
                outcome = browsers.run(mode, command["action"], bool(command.get("confirmed")))
            except Exception as e:  # a crashed action is reported, never retried blindly
                outcome = {"status": "failed", "summary": f"The browser action failed: {str(e)[:160]}"}
            live = (outcome.get("observation") or {}).pop("frame", None) or browsers.frame(mode)
            results.append({"id": command["id"], **outcome})
            if live:
                frame = {"taskId": command["taskId"], "jpeg": live}
        if not reply.get("commands"):
            time.sleep(POLL_IDLE_SECONDS)


def main() -> None:
    parser = argparse.ArgumentParser(prog="ocade_device")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("pair")
    p.add_argument("--server", required=True)
    p.add_argument("--code", required=True)
    p.add_argument("--name", default=platform.node()[:120] or "My computer")
    r = sub.add_parser("run")
    r.add_argument("--headless", action="store_true")
    r.add_argument("--real-browser-cdp", default=None)
    args = parser.parse_args()
    if args.command == "pair":
        pair(args.server, args.code, args.name)
    else:
        run(args.headless, args.real_browser_cdp)


if __name__ == "__main__":
    main()
