"""Parallel lanes (plan 14F.3): the companion runs every handed-out step at once, one per lane,
each lane in its own worker process; a lane whose step the server takes back stops alone; a
local STOP ends every lane, each with its own receipt."""

import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anyio

from ocade_agent import agent as agent_module
from ocade_agent.agent import Agent, handed_out, still_ours
from ocade_agent.gateway import PROTOCOL, Gateway, receipt
from ocade_agent.journal import Journal


def step(key):
    return {"risk": "read", "operation": "fs.list", "key": key}


class SlowGateway:
    """Each step takes 0.6 s; records when each started and ended, and in which lane."""

    epoch = 0

    def __init__(self, flag=None, after=None):
        self.spans, self.flag, self.after = {}, flag, after

    def stop(self):
        self.epoch += 1

    async def run(self, intent, epoch, lane=0):
        start = time.monotonic()
        if self.flag is not None and self.after == intent["key"]:
            self.flag.touch()
        await anyio.sleep(0.6)
        self.spans[intent["key"]] = (start, time.monotonic(), lane)
        return receipt("observed", False, {"entries": []})


class TwoLanes:
    """A server with two lanes: a1 then a2 in lane 0, b1 in lane 1."""

    def __init__(self, home):
        self.home, self.sent, self.done = home, [], set()

    def state(self):
        lanes = [["a1", "a2"], ["b1"]]
        actions = []
        for lane, keys in enumerate(lanes):
            head = next((k for k in keys if k not in self.done), None)
            if head:
                actions.append({"id": head, "intent": step(head), "lane": lane})
        status = "running" if actions else "completed"
        return {"task": {"id": "t", "status": status}, "actions": actions,
                "action": actions[0] if actions else None}

    def request(self, payload):
        self.sent.append(payload)
        if payload["op"] == "receipt":
            self.done.add(payload["activityId"])
        return 200, self.state()


class LanesTest(unittest.TestCase):
    def test_answers_are_read_old_and_new(self):
        self.assertEqual(handed_out({"action": {"id": "x", "intent": {}}}), [{"id": "x", "intent": {}}])
        self.assertEqual(still_ours({"actions": [{"id": "a"}], "running": ["b"]}), {"a", "b"})

    def test_steps_in_different_lanes_run_at_the_same_time_and_each_lane_in_order(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            device, gateway = TwoLanes(home), SlowGateway()
            started = time.monotonic()
            anyio.run(Agent(device, Journal(home / "j.sqlite"), gateway, home / "STOP")._loop, True)
            elapsed = time.monotonic() - started
            a1, a2, b1 = (gateway.spans[k] for k in ("a1", "a2", "b1"))
            self.assertLess(b1[0], a1[1], "lane 1 started while lane 0 was still running")
            self.assertGreaterEqual(a2[0], a1[1], "a lane keeps its order")
            self.assertEqual((a1[2], b1[2]), (0, 1), "each step ran in its own lane's worker")
            self.assertLess(elapsed, 1.7, f"three 0.6 s steps in two lanes took {elapsed:.2f} s")
            receipts = [p["activityId"] for p in device.sent if p["op"] == "receipt"]
            self.assertEqual(sorted(receipts), ["a1", "a2", "b1"])

    def test_local_stop_ends_every_lane_each_with_its_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            flag = home / "STOP"
            device = TwoLanes(home)

            class Blocking(SlowGateway):
                async def run(self, intent, epoch, lane=0):
                    flag.touch()
                    await anyio.sleep(30)

            with self.assertRaises(agent_module.LocalStop):
                anyio.run(Agent(device, Journal(home / "j.sqlite"), Blocking(), flag)._loop, False)
            receipts = {p["activityId"]: p["receipt"] for p in device.sent if p["op"] == "receipt"}
            self.assertEqual(set(receipts), {"a1", "b1"})
            self.assertTrue(all(r["errorCode"] == "stopped" for r in receipts.values()))


class BackgroundPermissionTest(unittest.TestCase):
    def test_each_answer_sets_or_clears_the_background_permission_for_the_workers(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            flag = home / "background-ui"
            flag.touch()

            class Device:
                def __init__(self):
                    self.home, self.answers = home, [{"backgroundAllowed": True, "task": None}, {"task": None}]

                def request(self, payload):
                    return 200, self.answers.pop(0)

            agent = Agent(Device(), Journal(home / "j.sqlite"), SlowGateway(), home / "STOP")
            self.assertFalse(flag.exists(), "off until an answer allows it")
            anyio.run(agent.claim)
            self.assertTrue(flag.exists())
            anyio.run(agent.claim)
            self.assertFalse(flag.exists(), "an answer without it turns it off")


class LaneWorkersTest(unittest.TestCase):
    def test_each_lane_has_its_own_worker_process(self):
        def intent(key):
            return {"v": PROTOCOL["version"], "key": key, "operation": "fs.list", "capability": "files",
                    "risk": "read", "arguments": {"path": "."},
                    "deadlineUtc": (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat().replace("+00:00", "Z")}

        with tempfile.TemporaryDirectory() as directory:
            async def go():
                async with Gateway(directory, home=directory) as gateway:
                    async with anyio.create_task_group() as group:
                        group.start_soon(gateway.run, intent("x"), gateway.epoch, 0)
                        group.start_soon(gateway.run, intent("y"), gateway.epoch, 2)
                    return sorted(gateway._workers)

            keys = anyio.run(go)
            self.assertIn("ocade_agent.office_worker", keys)
            self.assertIn("ocade_agent.office_worker#2", keys)


class BackgroundGateTest(unittest.TestCase):
    def test_patterns_skip_the_idle_wait_only_with_the_permission(self):
        from unittest import mock

        from ocade_agent import mac_worker, windows_worker

        for worker in (windows_worker, mac_worker):
            with self.subTest(worker=worker.__name__), tempfile.TemporaryDirectory() as directory:
                waited = []
                with mock.patch.dict("os.environ", {"OCADE_AGENT_HOME": directory}), \
                        mock.patch.object(worker, "_person_quiet", lambda waited=waited: waited.append(1)):
                    worker._quiet_unless_background()
                    (Path(directory) / "background-ui").touch()
                    worker._quiet_unless_background()
                self.assertEqual(waited, [1], "without the permission the step waits for the person")


if __name__ == "__main__":
    unittest.main()


