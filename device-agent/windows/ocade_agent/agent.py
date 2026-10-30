"""The companion's loop: ask for work, run it through the gateway, report what happened.

    python -m ocade_agent enroll --server https://ocade.in --name "My PC"
    python -m ocade_agent run --server https://ocade.in --workspace "C:\\Users\\me\\Documents\\JARVIS"

Outbound only. While an action runs, the loop keeps asking the server about its
task; the moment the task is no longer running (STOP, revoke, owner pause) the
in-flight call is cancelled and its worker process ended. Ctrl+C is the local
STOP and needs no network or model.
"""

from __future__ import annotations

import argparse
import os
import platform
import random
import sys
from pathlib import Path

import anyio

from .device import Device
from .gateway import Gateway, receipt
from .journal import Journal

VERSION = "0.1.0"
WATCH_SECONDS = 2.0


def default_home() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~/.local/share")
    return Path(os.environ.get("OCADE_AGENT_HOME") or Path(base) / "OCADE" / "agent")


class Agent:
    def __init__(self, device: Device, journal: Journal, gateway: Gateway):
        self.device, self.journal, self.gateway = device, journal, gateway

    async def claim(self) -> dict:
        status, body = await anyio.to_thread.run_sync(self.device.request, {"op": "claim"})
        if status != 200:
            raise ConnectionError(body.get("error", str(status)))
        return body

    async def _run_watched(self, activity: str, intent: dict) -> dict:
        """Run one action; cancel it if the server says its task stopped meanwhile."""
        epoch = self.gateway.epoch
        outcome: dict = {}

        async with anyio.create_task_group() as group:

            async def work() -> None:
                outcome["receipt"] = await self.gateway.run(intent, epoch)
                group.cancel_scope.cancel()

            async def watch() -> None:
                while True:
                    await anyio.sleep(WATCH_SECONDS)
                    try:
                        state = await self.claim()
                    except ConnectionError:
                        continue  # offline: keep the already-authorized step, decide nothing new
                    action = state.get("action") or {}
                    if action.get("id") != activity:
                        self.gateway.stop()
                        group.cancel_scope.cancel()
                        return

            group.start_soon(work)
            group.start_soon(watch)

        if "receipt" in outcome:
            return outcome["receipt"]
        writes = intent.get("risk") != "read"
        return receipt("unknown" if writes else "not_applied", writes, error="stopped")

    async def handle(self, action: dict) -> None:
        activity, intent = action["id"], action["intent"]
        held = self.journal.get(activity)
        if held and held[0] == "finished":
            result = held[1]  # lost acknowledgement: resend, never re-run
        elif held and intent.get("risk") != "read":
            result = receipt("unknown", True, error="interrupted")
        else:
            self.journal.start(activity, intent)
            result = await self._run_watched(activity, intent)
        self.journal.finish(activity, result)
        while True:
            status, body = await anyio.to_thread.run_sync(
                self.device.request, {"op": "receipt", "activityId": activity, "receipt": result}
            )
            if status == 200 or status in (401, 409):
                return  # recorded, or the server has a final answer this receipt cannot change
            await anyio.sleep(2 + random.random() * 3)

    async def run(self, until_idle: bool = False) -> None:
        idle = 1.0
        while True:
            try:
                state = await self.claim()
            except ConnectionError as error:
                if str(error) in ("signature_invalid", "update_required"):
                    raise
                state = {}
            if state.get("action"):
                idle = 1.0
                await self.handle(state["action"])
                continue
            if until_idle and not (state.get("task") or {}).get("status") == "running":
                return
            await anyio.sleep(idle + random.random())
            idle = min(idle * 2, 30.0)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ocade_agent")
    parser.add_argument("command", choices=["enroll", "run"])
    parser.add_argument("--server", required=True)
    parser.add_argument("--name", default=platform.node() or "My computer")
    parser.add_argument("--workspace")
    parser.add_argument("--until-idle", action="store_true")
    args = parser.parse_args(argv)
    home = default_home()
    device = Device(home, args.server)
    if args.command == "enroll":
        enrolled = device.enroll(args.name, f"{platform.system()} {platform.release()}"[:60], VERSION)
        print(f"Pairing code: {enrolled['code']}  (type it in OCADE JARVIS within 10 minutes)")
        return 0
    if not args.workspace or not Path(args.workspace).is_dir():
        print("--workspace must be an existing folder you choose for JARVIS", file=sys.stderr)
        return 2
    gateway = Gateway(str(Path(args.workspace).resolve()))

    async def go() -> str | None:
        async with gateway:
            try:
                await Agent(device, Journal(home / "journal.sqlite"), gateway).run(args.until_idle)
            except ConnectionError as error:
                return str(error)
        return None

    try:
        refused = anyio.run(go)
        if refused:
            print(f"This computer is not paired with OCADE, or was removed ({refused}).", file=sys.stderr)
            return 3
    except KeyboardInterrupt:
        gateway.stop()
        print("Stopped.", file=sys.stderr)
    return 0
