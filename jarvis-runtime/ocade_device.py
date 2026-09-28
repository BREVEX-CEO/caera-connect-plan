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
import json
import os
import platform
import sys
import threading
import time
import urllib.error
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ocade_computer import Computer, installed_apps  # noqa: E402
from ocade_identity import SOFTWARE_VERSION, Identity, NotEnrolled, UpdateRequired  # noqa: E402

BROWSER_ACTIONS = {"observe", "look", "open", "new_tab", "click", "type", "select", "press",
                   "scroll", "switch_tab", "close_tab", "back", "forward", "wait", "click_at"}
APPS_EVERY_S = 3600

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
        from ocade_egress import EgressProxy
        self.egress = EgressProxy()
        self._make = lambda mode: _BrowserSession(
            "chrome", mode=mode, headless=headless,
            executable=os.environ.get("OCADE_BROWSER_EXECUTABLE") or None, cdp_endpoint=cdp,
            egress=self.egress)
        self.cdp = cdp
        self.sessions: dict = {}

    def capabilities(self) -> dict:
        return {"browser_isolated": True, "browser_real": bool(self.cdp)}

    def run(self, mode: str, action: dict, confirmed: bool, sites: list[str],
            cancel: threading.Event) -> dict:
        if mode == "real" and not self.cdp:
            return {"status": "blocked",
                    "summary": "Your own browser is not authorized on this device"}
        self.egress.policy.allowed = frozenset(s.lower() for s in sites)
        session = self.sessions.get(mode)
        if session is None:
            session = self.sessions[mode] = self._make(mode)
            session.start()
        return session.run(session.act(action, confirmed), timeout=90, cancel=cancel)

    def frame(self, mode: str) -> str | None:
        session = self.sessions.get(mode)
        try:
            return session.run(session.frame(), timeout=20) if session else None
        except Exception:  # a missed frame is only a missed picture
            return None


class Agent:
    """
    The exchange loop, with the lifecycle the roadmap sets: busy while a task is
    open, dormant otherwise (one quiet check every few seconds), results kept on
    disk until OCADE has them, and an explicit global Stop.
    """

    DORMANT_S = 5.0

    def __init__(self, identity: Identity, headless: bool, cdp: str | None, workspace: str | None):
        self.identity = identity
        self.browsers = Browsers(headless, cdp)
        self.computer = Computer(workspace)
        self.stop = threading.Event()
        self.stop_all = threading.Event()
        # The cancellation token of the action running now; every STOP sets it
        # synchronously, before any network round trip.
        self.cancel = threading.Event()
        self.state = {"busy": False, "background": False, "connected": True, "update": False,
                      "task": None}
        self.pending_path = identity.home / "pending.json"

    def stop_everything(self) -> None:
        """STOP JARVIS on this computer: the running action now, the rest at OCADE."""
        self.cancel.set()
        self.stop_all.set()

    def _load_pending(self) -> list[dict]:
        # Results finished before a crash, a reboot or a lost connection still reach OCADE.
        try:
            return json.loads(self.pending_path.read_text())
        except FileNotFoundError:
            return []
        except (OSError, ValueError):
            # Kept for diagnosis rather than silently overwritten.
            self.pending_path.replace(self.pending_path.with_suffix(".damaged"))
            return []

    def _keep_pending(self, results: list[dict]) -> None:
        if results:
            tmp = self.pending_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(results))
            tmp.chmod(0o600)
            os.replace(tmp, self.pending_path)  # never a half-written journal
        else:
            self.pending_path.unlink(missing_ok=True)

    def run(self) -> int:
        results = self._load_pending()
        frame: dict | None = None
        apps_sent = 0.0
        found: dict = {}  # the app inventory, found off this loop (it can take seconds)
        finder: threading.Thread | None = None
        active: dict | None = None  # {"id", "thread", "outcome"} of the action running now
        while not self.stop.is_set():
            if active and not active["thread"].is_alive():
                outcome, live = active["outcome"]
                results.append(outcome)
                self._keep_pending(results)
                if live:
                    frame = {"taskId": active["taskId"], "jpeg": live}
                active = None
            body = {"results": results, "frame": frame,
                    "capabilities": {**self.browsers.capabilities(), **self.computer.capabilities()},
                    "softwareVersion": SOFTWARE_VERSION,
                    "running": [active["id"]] if active else []}
            if self.stop_all.is_set():
                body["stop"] = True
            due = not apps_sent or time.monotonic() - apps_sent > APPS_EVERY_S
            if due and "apps" in found:
                body["apps"] = found.pop("apps")
            elif due and (finder is None or not finder.is_alive()):
                finder = threading.Thread(
                    target=lambda: found.update(apps=[a["name"] for a in installed_apps()]),
                    daemon=True, name="ocade-apps")
                finder.start()
            try:
                reply = self.identity.exchange(body)
            except NotEnrolled:
                self.identity.forget()
                self.pending_path.unlink(missing_ok=True)
                self.state["connected"] = False
                print("This device is no longer connected. Its key was removed.", flush=True)
                return 2
            except UpdateRequired:
                self.state["update"] = True
                print("OCADE needs a newer Device Agent. Nothing more runs until it updates.", flush=True)
                return 3
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
                self._keep_pending(results)
                self.stop.wait(3 if not active else POLL_IDLE_SECONDS)
                continue
            self.state["reached"] = True
            if "apps" in body:
                apps_sent = time.monotonic()
            if body.get("stop"):
                self.stop_all.clear()
            self.state.update(busy=bool(reply.get("busy")), background=bool(reply.get("background")),
                              task=reply.get("task"))
            results, frame = [], None
            self._keep_pending(results)
            if active and active["id"] in reply.get("cancel", []):
                self.cancel.set()  # stopped in OCADE (web STOP, Take Over, task ended)
            # OCADE hands out work only while nothing runs; one action at a time
            # owns this computer, and this loop keeps listening for STOP meanwhile.
            commands = [] if active else reply.get("commands", [])[:1]
            if commands and not self.stop.is_set():
                active = self._start(commands[0])
            if active:
                active["thread"].join(POLL_IDLE_SECONDS)  # returns as soon as the action ends
            else:
                self.stop.wait(POLL_IDLE_SECONDS if self.state["busy"] else self.DORMANT_S)
        if active:
            self.cancel.set()
            active["thread"].join(5)
        return 0

    def _start(self, command: dict) -> dict:
        self.cancel = threading.Event()
        cancel = self.cancel
        active = {"id": command["id"], "taskId": command["taskId"],
                  "outcome": ({"id": command["id"], "status": "failed", "summary": "The action failed"}, None)}

        def work() -> None:
            active["outcome"] = self._execute(command, cancel)

        active["thread"] = threading.Thread(target=work, daemon=True, name="ocade-action")
        active["thread"].start()
        return active

    def _execute(self, command: dict, cancel: threading.Event | None = None) -> tuple[dict, str | None]:
        cancel = cancel or threading.Event()
        mode = command.get("mode", "isolated")
        action = command["action"]
        confirmed = bool(command.get("confirmed"))
        browser = action.get("action") in BROWSER_ACTIONS
        try:
            outcome = (self.browsers.run(mode, action, confirmed, command.get("sites", []), cancel)
                       if browser else
                       self.computer.run(action, confirmed, bool(command.get("cowork")), cancel))
        except Exception as e:  # a crashed action is reported, never retried blindly
            outcome = {"status": "failed", "summary": f"The action failed ({type(e).__name__})"}
        live = (outcome.get("observation") or {}).pop("frame", None) or (
            self.browsers.frame(mode) if browser else None)
        core = {k: outcome.pop(k) for k in ("status", "summary", "changed", "observation") if k in outcome}
        return {"id": command["id"], **core, **({"detail": outcome} if outcome else {})}, live


def run(headless: bool, cdp: str | None, server: str | None, workspace: str | None = None) -> int:
    identity = Identity(HOME)
    if not identity.connected:
        if not server:
            raise SystemExit("This computer is not connected. Run: ocade_device.py connect --server URL")
        identity = connect(server, platform.node()[:120] or "My computer")
    print(f"OCADE JARVIS device running for {identity.meta['server']}. Ctrl+C to stop.", flush=True)
    return Agent(identity, headless, cdp, workspace).run()


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
    r.add_argument("--workspace", default=None,
                   help="the one folder JARVIS may read, change and run commands in")
    sub.add_parser("forget")
    args = parser.parse_args()
    if args.command == "connect":
        connect(args.server, args.name, open_browser=not args.no_browser)
    elif args.command == "forget":
        Identity(HOME).forget()
        print("This computer's OCADE key was removed.")
    else:
        sys.exit(run(args.headless, args.real_browser_cdp, args.server, args.workspace))


if __name__ == "__main__":
    main()
