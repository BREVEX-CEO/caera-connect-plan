"""The idle-pickup nudge (W2) against a local Phoenix-protocol fake of Supabase Realtime.

The nudge only makes the device claim sooner: its content is never read, a flood costs no
more claims than polling, and a dropped connection reconnects and claims once.
"""

import json
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import anyio
from websockets.asyncio.server import serve

from ocade_agent import agent as agent_module
from ocade_agent.agent import Agent, Nudge
from ocade_agent.journal import Journal


class FakeRealtime:
    """Answers joins like Realtime and lets the test broadcast to, or drop, every subscriber."""

    def __init__(self, refuse=False):
        self.sockets, self.joins, self.refuse = [], 0, refuse

    async def handler(self, socket):
        self.sockets.append(socket)
        async for raw in socket:
            message = json.loads(raw)
            if message["event"] == "phx_join":
                self.joins += 1
                status = "error" if self.refuse else "ok"
                await socket.send(json.dumps({"ref": message["ref"], "topic": message["topic"],
                                              "event": "phx_reply", "payload": {"status": status}}))

    async def broadcast(self, topic, payload=None):
        for socket in list(self.sockets):
            await socket.send(json.dumps({"ref": None, "topic": f"realtime:{topic}", "event": "broadcast",
                                          "payload": {"event": "nudge", "payload": payload or {}}}))

    async def drop(self):
        for socket in list(self.sockets):
            await socket.close()
        self.sockets.clear()


async def started(fake):
    server = await serve(fake.handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    return server, {"url": f"ws://127.0.0.1:{port}/realtime/v1/websocket", "key": "k", "topic": "jarvis-t"}


async def until(condition, seconds=5.0):
    deadline = time.monotonic() + seconds
    while not condition():
        if time.monotonic() > deadline:
            raise AssertionError("condition not reached")
        await anyio.sleep(0.02)


class NudgeListener(unittest.TestCase):
    def test_broadcast_wakes_a_wait_and_reconnect_claims_once(self):
        async def scenario():
            fake = FakeRealtime()
            server, channel = await started(fake)
            nudge = Nudge()
            async with anyio.create_task_group() as group:
                group.start_soon(nudge.listen, channel)
                await until(lambda: nudge.connected)
                self.assertTrue(await nudge.wait(1.0), "joining fires once: work missed while away is claimed")
                self.assertFalse(await nudge.wait(0.2), "nothing more until a broadcast")
                await fake.broadcast("jarvis-t")
                started_at = time.monotonic()
                self.assertTrue(await nudge.wait(5.0))
                self.assertLess(time.monotonic() - started_at, 1.0)
                await fake.broadcast("someone-else")
                self.assertFalse(await nudge.wait(0.3), "another topic is ignored")
                await fake.drop()
                await until(lambda: fake.joins == 2, 10.0)
                self.assertTrue(await nudge.wait(2.0), "rejoining fires once")
                group.cancel_scope.cancel()
            server.close()

        anyio.run(scenario)

    def test_a_flood_of_empty_nudges_costs_no_more_than_the_burst(self):
        async def scenario():
            fake = FakeRealtime()
            server, channel = await started(fake)
            nudge = Nudge()
            async with anyio.create_task_group() as group:
                group.start_soon(nudge.listen, channel)
                await until(lambda: nudge.connected)
                wakes = 0
                for _ in range(100):
                    await fake.broadcast("jarvis-t", {"action": {"operation": "shell.run"}})
                    if await nudge.wait(0.05):
                        wakes += 1
                        nudge.spent(useful=False)  # what the agent does when its claim finds nothing
                self.assertLessEqual(wakes, agent_module.NUDGE_BURST)
                group.cancel_scope.cancel()
            server.close()

        anyio.run(scenario)

    def test_a_refused_join_leaves_the_device_polling(self):
        async def scenario():
            fake = FakeRealtime(refuse=True)
            server, channel = await started(fake)
            nudge = Nudge()
            async with anyio.create_task_group() as group:
                group.start_soon(nudge.listen, channel)
                await until(lambda: fake.joins >= 1)
                await anyio.sleep(0.2)
                self.assertFalse(nudge.connected)
                self.assertFalse(await nudge.wait(0.2))
                group.cancel_scope.cancel()
            server.close()

        anyio.run(scenario)


class IdlePickup(unittest.TestCase):
    """An idle device with the nudge picks new work up in well under a second, though it
    would otherwise not poll again for a minute; the nudge's content plays no part."""

    def test_idle_device_claims_promptly_when_nudged(self):
        async def scenario():
            fake = FakeRealtime()
            server, channel = await started(fake)
            claims = []

            class Device:
                home = Path(tempfile.mkdtemp())

                def request(self, payload):
                    if payload["op"] == "inventory":
                        return 200, {"inventory": "recorded", "nudge": channel}
                    claims.append(time.monotonic())
                    return 200, {"task": None, "action": None}

            home = Path(tempfile.mkdtemp())
            runner = Agent(Device(), Journal(home / "journal.sqlite"), SimpleNamespace(external={}, prewarm=lambda: None))
            runner.stop_flag = home / "STOP"
            with patch.object(agent_module.discovery, "installed_apps", lambda: []), \
                    patch.object(agent_module.discovery, "engines", lambda: []):
                async with anyio.create_task_group() as group:
                    group.start_soon(runner.run)
                    await until(lambda: runner.nudge is not None and runner.nudge.connected)
                    await anyio.sleep(1.0)
                    before = len(claims)
                    await fake.broadcast("jarvis-t", {"forged": "content is never read"})
                    sent = time.monotonic()
                    await until(lambda: len(claims) > before, 2.0)
                    self.assertLess(claims[before] - sent, 1.0)
                    group.cancel_scope.cancel()
            server.close()

        anyio.run(scenario)


if __name__ == "__main__":
    unittest.main()
