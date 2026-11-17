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

    def test_real_nudges_around_many_tasks_never_drain_the_burst(self):
        """Every task brings nudges whose claim finds no action (its next step not yet planned,
        its end): each still shows a change on the server, so none costs a token. Before, ten
        tasks emptied the bucket and the eleventh waited a minute (e2e timing suite, task 11)."""
        async def scenario():
            fake = FakeRealtime()
            server, channel = await started(fake)
            states, claims = [{"task": None, "action": None}], []

            class Device:
                home = Path(tempfile.mkdtemp())

                def request(self, payload):
                    if payload["op"] == "inventory":
                        return 200, {"inventory": "recorded", "nudge": channel}
                    claims.append(payload["op"])
                    return 200, states[-1]

            home = Path(tempfile.mkdtemp())
            runner = Agent(Device(), Journal(home / "journal.sqlite"), SimpleNamespace(external={}, prewarm=lambda: None))
            runner.stop_flag = home / "STOP"
            with patch.object(agent_module.discovery, "installed_apps", lambda: []), \
                    patch.object(agent_module.discovery, "engines", lambda: []):
                async with anyio.create_task_group() as group:
                    group.start_soon(runner.run)
                    await until(lambda: runner.nudge is not None and runner.nudge.connected)
                    await anyio.sleep(0.3)
                    for n in range(3 * int(agent_module.NUDGE_BURST)):
                        for status in ("waiting", "completed"):  # planned later, then finished
                            states.append({"task": {"id": f"t{n}", "status": status}, "action": None})
                            before = len(claims)
                            await fake.broadcast("jarvis-t")
                            await until(lambda: len(claims) > before, 2.0)
                    before = len(claims)
                    for _ in range(3 * int(agent_module.NUDGE_BURST)):  # forged: nothing changed
                        await fake.broadcast("jarvis-t")
                        await anyio.sleep(0.05)
                    self.assertLessEqual(len(claims) - before, agent_module.NUDGE_BURST)
                    group.cancel_scope.cancel()
            server.close()

        anyio.run(scenario)


class SessionMode(unittest.TestCase):
    """Plan v8 5.4: in session mode the companion ends after its idle period, never while a task
    runs or waits, nor while a job it started is unfinished."""

    def runner(self, states):
        class Device:
            home = Path(tempfile.mkdtemp())

            def request(self, payload):
                if payload["op"] == "inventory":
                    return 200, {"inventory": "recorded"}
                return 200, states.pop(0) if len(states) > 1 else states[0]

        home = Path(tempfile.mkdtemp())
        runner = Agent(Device(), Journal(home / "journal.sqlite"), SimpleNamespace(external={}, prewarm=lambda: None))
        runner.stop_flag = home / "STOP"
        runner.session_idle_seconds = 0.5
        return runner

    def ended_within(self, runner, seconds):
        async def scenario():
            with anyio.move_on_after(seconds) as scope:
                with patch.object(agent_module.discovery, "installed_apps", lambda: []), \
                        patch.object(agent_module.discovery, "engines", lambda: []):
                    await runner.run()
            return not scope.cancelled_caught

        return anyio.run(scenario)

    def test_an_idle_session_ends(self):
        self.assertTrue(self.ended_within(self.runner([{"task": None, "action": None}]), 6.0))

    def test_the_companion_ends_after_its_task_finishes_by_default(self):
        runner = self.runner([{"task": {"id": "t", "status": "running"}, "action": None},
                              {"task": {"id": "t", "status": "completed"}, "action": None}])
        runner.session_idle_seconds, runner.after_task_seconds = 3600, 0.2
        self.assertTrue(self.ended_within(runner, 6.0), "finished task: the session ends")
        self.assertTrue(runner.worked)

    def test_always_on_keeps_it_ready(self):
        runner = self.runner([{"task": {"id": "t", "status": "completed"}, "action": None}])
        runner.session_idle_seconds = runner.after_task_seconds = None
        self.assertFalse(self.ended_within(runner, 3.0))

    def test_a_waiting_task_or_an_unfinished_job_keeps_it(self):
        waiting = self.runner([{"task": {"id": "t", "status": "waiting"}, "action": None}])
        self.assertFalse(self.ended_within(waiting, 4.0))
        # No task in the answer (an outage): a job is never cancelled then, so it keeps the session.
        busy = self.runner([{"action": None}])
        job = agent_module.jobs.folder(str(busy.device.home)) / "abc123"
        job.mkdir(parents=True)
        (job / "spec.json").write_text("{}")
        self.assertFalse(self.ended_within(busy, 4.0))


if __name__ == "__main__":
    unittest.main()
