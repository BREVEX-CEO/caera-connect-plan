"""
OCADE JARVIS device runtime — the active entry point of the working engine.

It connects this machine to an OCADE account, then runs the actions a JARVIS
task queues for it. It holds no provider key and makes no model call:
intelligence stays in OCADE's Online authority, and this process only executes
and observes.

    python ocade_device.py connect --server https://ocade.in     # one click in OCADE, no codes
    python ocade_device.py run [--headless] [--real-browser-cdp http://127.0.0.1:9222]
    python ocade_device.py forget                                  # remove this device's key

`run` connects first when this machine is not connected yet. The device's own
key (see ocade_identity.py) is the only credential; removing the device in OCADE
ends its access at once and this process then deletes the local key.

`--real-browser-cdp` is the explicit on-device authorization for the user's own
browser (started by the user with --remote-debugging-port). Without it only the
isolated automation browser exists, whatever the account settings say.
"""
from __future__ import annotations

import argparse
import os
import platform
import sys
import time
import urllib.error
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ocade_identity import SOFTWARE_VERSION, Identity, NotEnrolled, UpdateRequired  # noqa: E402

HOME = Path(os.environ.get("OCADE_JARVIS_HOME", Path.home() / ".ocade_jarvis"))
POLL_IDLE_SECONDS = 1.0


def connect(server: str, name: str, open_browser: bool = True) -> Identity:
    identity = Identity(HOME)
    request = identity.enroll(server, name, platform.system()[:60])
    print(f"Confirm this computer in OCADE: {request['url']}", flush=True)
    print(f"It should show the fingerprint {request['fingerprint']}.", flush=True)
    if open_browser:
        webbrowser.open(request["url"])
    if not identity.wait_for_approval():
        identity.forget()
        raise SystemExit("The connection was not approved. Nothing was kept.")
    print(f"Connected as {name}.", flush=True)
    return identity


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
        try:
            return session.run(session.frame(), timeout=20) if session else None
        except Exception:  # a missed frame is only a missed picture
            return None


def run(headless: bool, cdp: str | None, server: str | None) -> int:
    identity = Identity(HOME)
    if not identity.connected:
        if not server:
            raise SystemExit("This computer is not connected. Run: ocade_device.py connect --server URL")
        identity = connect(server, platform.node()[:120] or "My computer")
    browsers = Browsers(headless, cdp)
    results: list[dict] = []
    frame: dict | None = None
    print(f"OCADE JARVIS device running for {identity.meta['server']}. Ctrl+C to stop.", flush=True)
    while True:
        try:
            reply = identity.exchange({"results": results, "frame": frame,
                                       "capabilities": browsers.capabilities(),
                                       "softwareVersion": SOFTWARE_VERSION})
        except NotEnrolled:
            identity.forget()
            print("This device is no longer connected. Its key was removed.", flush=True)
            return 2
        except UpdateRequired:
            print("OCADE needs a newer Device Agent. Nothing more runs until it updates.", flush=True)
            return 3
        except (urllib.error.URLError, TimeoutError, ConnectionError):
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
    c = sub.add_parser("connect")
    c.add_argument("--server", required=True)
    c.add_argument("--name", default=platform.node()[:120] or "My computer")
    c.add_argument("--no-browser", action="store_true", help="print the link instead of opening it")
    r = sub.add_parser("run")
    r.add_argument("--server", default=None, help="connect to this OCADE first if needed")
    r.add_argument("--headless", action="store_true")
    r.add_argument("--real-browser-cdp", default=None)
    sub.add_parser("forget")
    args = parser.parse_args()
    if args.command == "connect":
        connect(args.server, args.name, open_browser=not args.no_browser)
    elif args.command == "forget":
        Identity(HOME).forget()
        print("This computer's OCADE key was removed.")
    else:
        sys.exit(run(args.headless, args.real_browser_cdp, args.server))


if __name__ == "__main__":
    main()
