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


class DiagnoseTest(unittest.TestCase):
    def test_diagnosis_names_what_to_fix_and_reveals_nothing(self):
        home = Path(tempfile.mkdtemp())
        (home / "mcp").mkdir()
        (home / "mcp" / "broken.json").write_text("not json")
        (home / "device.json").write_text('{"deviceId": "d-1", "lastTimestamp": 1}')
        (home / "STOP").touch()
        checks = {c["check"]: c for c in agent_module.diagnose(home, "https://127.0.0.1:9", str(home / "gone"))}
        self.assertTrue(checks["paired"]["ok"])
        self.assertFalse(checks["workspace"]["ok"])
        self.assertFalse(checks["server"]["ok"])
        self.assertFalse(checks["stop"]["ok"])
        self.assertEqual(checks["mcp:broken.json"]["detail"], "manifest not used: invalid_manifest")
        workers = [c for name, c in checks.items() if name.startswith("worker:")]
        self.assertEqual(len(workers), len(set(agent_module.WORKERS.values())))
        self.assertTrue(all(c["ok"] for c in workers), workers)
        self.assertFalse((home / "device-key.bin").exists(), "diagnosing never creates or reads the key")


CHILD = """
import sys, anyio
sys.path[:0] = [{tests!r}]
from ocade_agent.agent import Agent
from ocade_agent.gateway import Gateway
from ocade_agent.journal import Journal
from pathlib import Path
from tests.test_agent import FakeDevice, hung_write

class StillRunning(FakeDevice):
    def request(self, payload):
        return 200, {{"action": {{"id": "k1"}}}}

workspace = Path({workspace!r})
gateway = Gateway(str(workspace), {{"fs_sandbox": "tests.fake_worker", "sys_core": "tests.fake_worker"}}, extra_path={tests!r})

async def go():
    async with gateway:
        await Agent(StillRunning(), Journal(workspace / "journal.sqlite"), gateway).handle({{"id": "k1", "intent": hung_write({due!r})}})

anyio.run(go)
"""


def hung_write(due):
    spec = PROTOCOL["operations"]["office.write_workbook"]
    return {
        "v": 1, "key": "write", "operation": "office.write_workbook",
        "capability": spec["capability"], "risk": spec["risk"],
        "arguments": {"path": "OCADE output/x.xlsx", "sheets": [{"name": "S", "rows": [[1]]}]},
        "deadlineUtc": due,
    }


class ProcessKillTest(unittest.TestCase):
    def test_a_companion_killed_mid_write_reports_unknown_after_restart_and_never_reruns(self):
        import subprocess
        import sys

        workspace = Path(tempfile.mkdtemp())
        (workspace / ".fake_mode").write_text("hang")
        # The server hands a restarted companion the identical stored intent, deadline included.
        due = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z")
        child = subprocess.Popen([sys.executable, "-c", CHILD.format(tests=TESTS, workspace=str(workspace), due=due)])
        journal_path = workspace / "journal.sqlite"
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline and not (journal_path.exists() and Journal(journal_path).get("k1")):
            time.sleep(0.2)
        time.sleep(1)  # the write is now dispatched to its worker
        child.kill()  # SIGKILL / TerminateProcess: no cleanup runs
        child.wait()
        self.assertEqual(Journal(journal_path).get("k1")[0], "started")

        device = FakeDevice()  # the restarted companion is handed the same action again
        anyio.run(Agent(device, Journal(journal_path), FailingGateway()).handle, {"id": "k1", "intent": hung_write(due)})
        sent = device.sent[-1]["receipt"]
        self.assertEqual((sent["status"], sent["maybeChanged"], sent["errorCode"]), ("unknown", True, "interrupted"))


if __name__ == "__main__":
    unittest.main()
