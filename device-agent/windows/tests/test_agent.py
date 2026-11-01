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


class ReceiptResponseDevice(FakeDevice):
    def __init__(self, statuses):
        super().__init__()
        self.statuses = iter(statuses)

    def request(self, payload):
        self.sent.append(payload)
        if payload["op"] == "receipt":
            return next(self.statuses), {}
        return 200, {}


class ReceiptDeliveryTest(unittest.TestCase):
    def setUp(self):
        self.journal = Journal(Path(tempfile.mkdtemp()) / "journal.sqlite")
        self.intent = {"risk": "reversible_write"}
        self.receipt = {
            "status": "observed", "maybeChanged": True,
            "observedAtUtc": "2026-10-30T00:00:00.000Z", "evidence": {},
        }
        self.journal.start("receipt-a", self.intent)
        self.journal.finish("receipt-a", self.receipt)
        self.action = {"id": "receipt-a", "intent": self.intent}

    def test_permanent_refusal_does_not_loop_or_repeat_effect(self):
        for status in (400, 403, 413, 422, 426):
            with self.subTest(status=status):
                device = ReceiptResponseDevice([status])
                agent = Agent(device, self.journal, FailingGateway())
                with self.assertRaisesRegex(ConnectionError, f"receipt_rejected_{status}"):
                    anyio.run(agent.handle, self.action)
                self.assertEqual(len(device.sent), 1)
                self.assertEqual(self.journal.get("receipt-a")[0], "finished")

    def test_transient_refusal_retries_only_the_saved_receipt(self):
        device = ReceiptResponseDevice([503, 502, 200])
        agent = Agent(device, self.journal, FailingGateway())
        previous = agent_module.RECEIPT_RETRY_DELAYS
        agent_module.RECEIPT_RETRY_DELAYS = (0, 0)
        try:
            anyio.run(agent.handle, self.action)
        finally:
            agent_module.RECEIPT_RETRY_DELAYS = previous
        self.assertEqual(len(device.sent), 3)
        self.assertTrue(all(sent["receipt"] == self.receipt for sent in device.sent))

    def test_transient_refusal_exhaustion_is_bounded_and_durable(self):
        device = ReceiptResponseDevice([503, 503, 503])
        agent = Agent(device, self.journal, FailingGateway())
        previous = agent_module.RECEIPT_RETRY_DELAYS
        agent_module.RECEIPT_RETRY_DELAYS = (0, 0)
        try:
            with self.assertRaisesRegex(ConnectionError, "receipt_delivery_unavailable_503"):
                anyio.run(agent.handle, self.action)
        finally:
            agent_module.RECEIPT_RETRY_DELAYS = previous
        self.assertEqual(len(device.sent), 3)
        self.assertEqual(self.journal.get("receipt-a")[0], "finished")


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
