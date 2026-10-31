import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anyio

from ocade_agent import agent as agent_module
from ocade_agent.agent import Agent
from ocade_agent.gateway import PROTOCOL, Gateway
from ocade_agent.journal import Journal

TESTS = str(Path(__file__).resolve().parent.parent)


class FakeDevice:
    def __init__(self):
        self.sent = []
        self.home = Path(tempfile.mkdtemp())

    def request(self, payload):
        self.sent.append(payload)
        return 200, {}


class FailingGateway:
    epoch = 0

    async def run(self, intent, epoch):
        raise AssertionError("an action with a journal entry must not run again")


class StoppedServer(FakeDevice):
    """The server answers every claim with: this device's task is no longer running."""

    def request(self, payload):
        self.sent.append(payload)
        if payload["op"] == "claim":
            return 200, {"task": {"id": "t", "status": "stopped"}, "action": None}
        return 200, {}


class JournalTest(unittest.TestCase):
    def setUp(self):
        self.journal = Journal(Path(tempfile.mkdtemp()) / "journal.sqlite")
        self.device = FakeDevice()
        self.agent = Agent(self.device, self.journal, FailingGateway())

    def test_finished_action_resends_its_receipt(self):
        receipt = {"status": "observed", "maybeChanged": True, "observedAtUtc": "2026-10-30T00:00:00.000Z", "evidence": {}}
        self.journal.start("a1", {"risk": "reversible_write"})
        self.journal.finish("a1", receipt)
        anyio.run(self.agent.handle, {"id": "a1", "intent": {"risk": "reversible_write"}})
        self.assertEqual(self.device.sent[-1]["receipt"], receipt)

    def test_interrupted_write_is_unknown_not_repeated(self):
        self.journal.start("a2", {"risk": "reversible_write"})
        anyio.run(self.agent.handle, {"id": "a2", "intent": {"risk": "reversible_write"}})
        sent = self.device.sent[-1]["receipt"]
        self.assertEqual((sent["status"], sent["maybeChanged"], sent["errorCode"]), ("unknown", True, "interrupted"))
        self.assertEqual(self.journal.get("a2")[0], "finished")


class StopInFlightTest(unittest.TestCase):
    def test_stop_cancels_a_running_write_and_reports_it_unknown(self):
        for warm in (False, True):  # STOP while the worker starts, and while its call runs
            with self.subTest(warm=warm):
                self.stop_in_flight(warm)

    def stop_in_flight(self, warm):
        workspace = Path(tempfile.mkdtemp())
        (workspace / ".fake_mode").write_text("hang")
        spec = PROTOCOL["operations"]["office.write_workbook"]
        intent = {
            "v": 1, "key": "write", "operation": "office.write_workbook",
            "capability": spec["capability"], "risk": spec["risk"],
            "arguments": {"path": "OCADE output/x.xlsx", "sheets": [{"name": "S", "rows": [[1]]}]},
            "deadlineUtc": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
        }
        device = StoppedServer()
        journal = Journal(workspace / "journal.sqlite")
        modules = {"fs_sandbox": "tests.fake_worker", "sys_core": "tests.fake_worker", "verifier": "ocade_agent.verify_worker"}
        gateway = Gateway(str(workspace), modules, extra_path=TESTS)
        agent_module.WATCH_SECONDS = 0.2
        started = time.monotonic()

        async def go():
            async with gateway:
                if warm:
                    await gateway._session("tests.fake_worker")
                await Agent(device, journal, gateway).handle({"id": "a3", "intent": intent})
                return dict(gateway._workers)

        try:
            workers_left = anyio.run(go)
        finally:
            agent_module.WATCH_SECONDS = 2.0
        self.assertLess(time.monotonic() - started, 15, "STOP must not wait for the hung step")
        sent = device.sent[-1]
        self.assertEqual(sent["op"], "receipt")
        self.assertEqual(
            (sent["receipt"]["status"], sent["receipt"]["maybeChanged"], sent["receipt"]["errorCode"]),
            ("unknown", True, "stopped"),
        )
        self.assertEqual(workers_left, {}, "the worker process was ended")
        self.assertGreater(gateway.epoch, 0, "the local fence moved")


if __name__ == "__main__":
    unittest.main()
