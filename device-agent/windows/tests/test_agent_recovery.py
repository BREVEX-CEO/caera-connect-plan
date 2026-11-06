"""Interrupted actions retain their durable identity and effect uncertainty."""

import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import anyio

from ocade_agent import agent as agent_module
from ocade_agent.agent import Agent
from ocade_agent.gateway import PROTOCOL, Gateway, receipt
from ocade_agent.journal import Journal


def action_intent(operation, arguments):
    spec = PROTOCOL["operations"][operation]
    return {
        "v": PROTOCOL["version"], "key": "recovery-action", "operation": operation,
        "capability": spec["capability"], "risk": spec["risk"], "arguments": arguments,
        "deadlineUtc": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
    }


async def measure_companion_lifecycle(iterations: int) -> dict:
    """Exercise real worker startup, dispatch, shutdown and journal recovery on a runner."""
    import psutil

    if not 1 <= iterations <= 10_000:
        raise ValueError("iterations must be between 1 and 10,000")
    process = psutil.Process()
    cpu_before = process.cpu_times()
    before = process.children(recursive=True)
    handles = process.num_handles if os.name == "nt" else process.num_fds
    result = {"cycles": 0, "peakRssBytes": process.memory_info().rss, "peakHandles": handles(),
              "peakWorkerRssBytes": 0}
    with tempfile.TemporaryDirectory(prefix="ocade-lifecycle-") as temporary:
        home = Path(temporary) / "agent"
        home.mkdir()
        workspace = Path(temporary) / "workspace"
        workspace.mkdir()
        (workspace / "marker.txt").write_text("runner fixture", encoding="utf-8")
        journal_path = home / "journal.sqlite"
        for iteration in range(iterations):
            action = action_intent("fs.list", {"path": "."})
            activity = f"lifecycle-{iteration}"
            journal = Journal(journal_path)
            if not journal.start(activity, action):
                raise AssertionError("new action was not journaled")
            async with Gateway(str(workspace), home=str(home)) as gateway:
                observed = await gateway.run(action, gateway.epoch)
                if observed["status"] != "observed" or not any(
                    entry.get("name") == "marker.txt" for entry in observed["evidence"].get("entries", [])
                ):
                    raise AssertionError("filesystem worker did not observe the fixture")
                journal.finish(activity, observed)
                worker_rss = 0
                for worker in process.children(recursive=True):
                    if worker not in before:
                        try:
                            worker_rss += worker.memory_info().rss
                        except psutil.NoSuchProcess:
                            continue
                result["peakWorkerRssBytes"] = max(result["peakWorkerRssBytes"], worker_rss)
            if Journal(journal_path).get(activity) != ("finished", observed):
                raise AssertionError("reopen did not recover the exact receipt")
            survivors = [child for child in process.children(recursive=True) if child not in before]
            if survivors:
                raise AssertionError("worker processes survived gateway shutdown")
            result["cycles"] += 1
            result["peakRssBytes"] = max(result["peakRssBytes"], process.memory_info().rss)
            result["peakHandles"] = max(result["peakHandles"], handles())
        result["diskBytes"] = sum(path.stat().st_size for path in home.rglob("*") if path.is_file())
    cpu_after = process.cpu_times()
    result["agentCpuSeconds"] = cpu_after.user + cpu_after.system - cpu_before.user - cpu_before.system
    result["workerCpuSeconds"] = (
        cpu_after.children_user + cpu_after.children_system - cpu_before.children_user - cpu_before.children_system
        if hasattr(cpu_after, "children_user") and hasattr(cpu_after, "children_system") else None
    )
    return result


class CompanionLifecycle(unittest.TestCase):
    def test_lifecycle_harness_observes_real_worker_and_reopens_its_journal(self):
        result = anyio.run(measure_companion_lifecycle, 1)
        self.assertEqual(result["cycles"], 1)
        self.assertGreater(result["diskBytes"], 0)
        self.assertGreater(result["peakRssBytes"], 0)
        self.assertGreater(result["peakWorkerRssBytes"], 0)
        self.assertGreater(result["peakHandles"], 0)


class ReceiptDevice:
    def __init__(self, home):
        self.home = home
        self.sent = []

    def request(self, payload):
        self.sent.append(payload)
        return 200, {}


class MustNotRun:
    epoch = 0

    async def run(self, intent, epoch):
        raise AssertionError("a pending opaque action or changed identity must never execute again")


class LocalReadGateway:
    epoch = 0

    def __init__(self):
        self.calls = []

    async def run(self, intent, epoch):
        self.calls.append(intent)
        return receipt("observed", False, {"entries": []})


class JournalRecoveryTest(unittest.TestCase):
    def test_reopened_started_browser_read_is_unknown_and_never_replayed(self):
        for operation, arguments in (
            ("web.open", {"url": "https://example.com/"}),
            ("web.close", {"page": {"id": "page1", "site": "example.com"}}),
        ):
            with self.subTest(operation=operation), tempfile.TemporaryDirectory() as directory:
                home = Path(directory)
                path = home / "journal.sqlite"
                intent = action_intent(operation, arguments)
                journal = Journal(path)
                journal.start("pending", intent)
                journal.db.close()
                journal = Journal(path)  # a new companion only has the durable started row
                device = ReceiptDevice(home)
                agent = Agent(device, journal, MustNotRun())
                action = {"id": "pending", "intent": intent}
                anyio.run(agent.handle, action)
                result = device.sent[-1]["receipt"]
                self.assertEqual((result["status"], result["maybeChanged"], result["errorCode"]),
                                 ("unknown", True, "interrupted"))
                self.assertEqual(journal.get("pending"), ("finished", result))
                anyio.run(agent.handle, action)
                self.assertEqual(device.sent[-1]["receipt"], result, "redelivery resends the exact saved receipt")
                journal.db.close()

    def test_losing_atomic_journal_claim_never_dispatches_the_same_opaque_action(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            path = home / "journal.sqlite"
            winner = Journal(path)

            class ContendedJournal(Journal):
                def start(self, activity, intent):
                    winner.start(activity, intent)  # another companion won before our insert
                    return super().start(activity, intent)

            contender = ContendedJournal(path)
            intent = action_intent("web.open", {"url": "https://example.com/"})
            device = ReceiptDevice(home)
            anyio.run(Agent(device, contender, MustNotRun()).handle, {"id": "raced", "intent": intent})
            result = device.sent[-1]["receipt"]
            self.assertEqual((result["status"], result["maybeChanged"], result["errorCode"]),
                             ("unknown", True, "interrupted"))
            self.assertEqual(winner.get("raced"), ("finished", result))
            contender.db.close()
            winner.db.close()

    def test_interrupted_local_read_remains_recoverable(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            journal = Journal(home / "journal.sqlite")
            intent = action_intent("fs.list", {"path": "."})
            journal.start("local-read", intent)
            gateway = LocalReadGateway()
            device = ReceiptDevice(home)
            anyio.run(Agent(device, journal, gateway).handle, {"id": "local-read", "intent": intent})
            self.assertEqual(gateway.calls, [intent])
            self.assertEqual(device.sent[-1]["receipt"]["status"], "observed")
            self.assertEqual(journal.get("local-read")[0], "finished")
            journal.db.close()

        # A socket timeout during a claim is an outage, not a reason to kill the
        # companion. Exercise the real signed client and the polling loop.
        from contextlib import nullcontext
        from types import SimpleNamespace
        from ocade_agent.device import Device

        class LoopFinished(Exception):
            pass

        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            device = Device(home, "https://authority.example")
            journal = Journal(home / "journal.sqlite")
            runner = Agent(device, journal, MustNotRun())
            def response(status):
                return nullcontext(SimpleNamespace(status=200, read=lambda: json.dumps({"task": {"status": status}}).encode()))
            replies = [TimeoutError("fixture socket timeout"), response("running"), response("completed")]
            with patch("urllib.request.urlopen", side_effect=replies) as network:
                async def pause(seconds):
                    if network.call_count == 3:
                        raise LoopFinished()
                    await anyio.sleep(0)
                runner.pause = pause
                with self.assertRaises(LoopFinished):
                    anyio.run(runner._loop, False)
                self.assertEqual(network.call_count, 3, "the companion stopped polling after a transient outage")
            journal.db.close()

    def test_started_action_cannot_change_to_a_pure_read_under_same_id(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            journal = Journal(home / "journal.sqlite")
            original = action_intent("web.open", {"url": "https://example.com/"})
            journal.start("same-id", original)
            changed = action_intent("fs.list", {"path": "."})
            device = ReceiptDevice(home)
            anyio.run(Agent(device, journal, MustNotRun()).handle, {"id": "same-id", "intent": changed})
            result = device.sent[-1]["receipt"]
            self.assertEqual((result["status"], result["maybeChanged"], result["errorCode"]),
                             ("unknown", True, "intent_mismatch"))
            saved = journal.db.execute("SELECT intent FROM actions WHERE activity = ?", ("same-id",)).fetchone()[0]
            self.assertEqual(json.loads(saved), original, "a repeated id never replaces its durable intent")
            self.assertEqual(journal.get("same-id"), ("started", None), "mismatch does not settle the original action")
            journal.db.close()

    def test_finished_action_mismatch_never_relabels_or_overwrites_saved_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            journal = Journal(home / "journal.sqlite")
            original = action_intent("web.open", {"url": "https://example.com/"})
            journal.start("finished", original)
            saved = receipt("observed", True, {"page": {"id": "opened"}})
            journal.finish("finished", saved)
            changed = dict(original, arguments={"url": "https://example.org/"})
            device = ReceiptDevice(home)
            anyio.run(Agent(device, journal, MustNotRun()).handle, {"id": "finished", "intent": changed})
            result = device.sent[-1]["receipt"]
            self.assertEqual((result["status"], result["maybeChanged"], result["errorCode"]),
                             ("unknown", True, "intent_mismatch"))
            self.assertEqual(journal.get("finished"), ("finished", saved))
            journal.db.close()

    def test_same_intent_with_reordered_object_keys_resends_saved_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            journal = Journal(home / "journal.sqlite")
            original = action_intent("web.open", {"url": "https://example.com/"})
            journal.start("finished", original)
            saved = receipt("observed", True, {"page": {"id": "opened"}})
            journal.finish("finished", saved)
            reordered = dict(reversed(list(original.items())))
            device = ReceiptDevice(home)
            anyio.run(Agent(device, journal, MustNotRun()).handle, {"id": "finished", "intent": reordered})
            self.assertEqual(device.sent[-1]["receipt"], saved)
            journal.db.close()


class DurableReceiptRaceTest(unittest.TestCase):
    def test_stale_unknown_finish_cannot_replace_observed_winner(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "journal.sqlite"
            winner, contender = Journal(path), Journal(path)
            intent = action_intent("apps.launch", {"exe": "example.exe"})
            winner.start("raced", intent)
            self.assertEqual(contender.get("raced"), ("started", None))
            observed = receipt("observed", True, {"window": {"hwnd": 42}})
            first = winner.finish("raced", observed)
            late = contender.finish("raced", receipt("unknown", True, error="interrupted"))
            self.assertEqual(winner.get("raced"), ("finished", observed))
            self.assertEqual(contender.get("raced"), ("finished", observed))
            self.assertEqual(first, observed)
            self.assertEqual(late, observed, "the losing finisher returns the exact durable winner")
            winner.db.close()
            contender.db.close()

    def test_first_unknown_winner_is_retained_for_reconciliation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "journal.sqlite"
            winner, contender = Journal(path), Journal(path)
            intent = action_intent("web.open", {"url": "https://example.com/"})
            winner.start("raced", intent)
            unknown = receipt("unknown", True, error="stopped")
            first = winner.finish("raced", unknown)
            late = contender.finish("raced", receipt("observed", True, {"page": {"id": "late"}}))
            self.assertEqual(winner.get("raced"), ("finished", unknown))
            self.assertEqual(first, unknown)
            self.assertEqual(late, unknown)
            winner.db.close()
            contender.db.close()

    def test_agent_sends_durable_winner_after_reading_stale_started_state(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            path = home / "journal.sqlite"
            winner = Journal(path)
            intent = action_intent("apps.launch", {"exe": "example.exe"})
            winner.start("raced", intent)
            observed = receipt("observed", True, {"window": {"hwnd": 42}})

            class StaleReadJournal(Journal):
                def get(self, activity):
                    held = super().get(activity)
                    if held == ("started", None):
                        winner.finish(activity, observed)  # completion races our stale started read
                    return held

            contender = StaleReadJournal(path)
            device = ReceiptDevice(home)
            anyio.run(Agent(device, contender, MustNotRun()).handle, {"id": "raced", "intent": intent})
            self.assertEqual(device.sent[-1]["receipt"], observed)
            self.assertEqual(winner.get("raced"), ("finished", observed))
            winner.db.close()
            contender.db.close()


class DispatchedStopTest(unittest.TestCase):
    def test_stop_journals_opaque_read_uncertainty_and_preserves_pure_read_control(self):
        for operation, arguments, expected in (
            ("web.open", {"url": "https://example.com/"}, ("unknown", True)),
            ("web.close", {"page": {"id": "page1", "site": "example.com"}}, ("unknown", True)),
            ("fs.list", {"path": "."}, ("not_applied", False)),
        ):
            with self.subTest(operation=operation), tempfile.TemporaryDirectory() as directory:
                home = Path(directory)
                journal = Journal(home / "journal.sqlite")
                device = ReceiptDevice(home)
                stop_flag = home / "STOP"

                async def run():
                    dispatched = anyio.Event()

                    class BlockedSession:
                        async def call_tool(self, tool, arguments, **kwargs):
                            dispatched.set()
                            await anyio.sleep_forever()

                    class SessionGateway(Gateway):
                        async def _session(self, key):
                            return BlockedSession()

                    gateway = SessionGateway(str(home))
                    async with gateway:
                        with anyio.fail_after(3):
                            async with anyio.create_task_group() as group:
                                action = {"id": "stopped", "intent": action_intent(operation, arguments)}
                                group.start_soon(Agent(device, journal, gateway, stop_flag).handle, action)
                                await dispatched.wait()
                                self.assertEqual(journal.get("stopped"), ("started", None))
                                stop_flag.touch()
                        self.assertGreater(gateway.epoch, 0)
                    return device.sent[-1]["receipt"]

                with patch.object(agent_module, "TICK_SECONDS", 0.01), patch.object(
                    agent_module, "WATCH_SECONDS", 60.0
                ):
                    result = anyio.run(run)
                self.assertEqual((result["status"], result["maybeChanged"]), expected)
                self.assertEqual(result["errorCode"], "stopped")
                self.assertEqual(journal.get("stopped"), ("finished", result))
                journal.db.close()

        # STOP can arrive while the network claim is in flight. Even a hot
        # worker must not start the action returned after that local STOP.
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            journal = Journal(home / "journal.sqlite")
            flag = home / "STOP"
            dispatched = []
            operation = action_intent("fs.write_text", {"path": "OCADE output/after-stop.txt", "text": "must not be written"})
            class StopDuringClaim(ReceiptDevice):
                def request(self, payload):
                    self.sent.append(payload)
                    if payload["op"] == "claim":
                        flag.touch()
                        return 200, {"task": {"status": "running"}, "action": {"id": "after-stop", "intent": operation}}
                    return 200, {"task": {"status": "completed"}}
            class TrackedGateway(Gateway):
                async def run(self, intent, epoch):
                    dispatched.append(intent)
                    return await super().run(intent, epoch)
            async def run():
                async with TrackedGateway(str(home), home=str(home)) as gateway:
                    await gateway._session(agent_module.WORKERS["fs_sandbox"])
                    with self.assertRaises(agent_module.LocalStop):
                        await Agent(StopDuringClaim(home), journal, gateway, flag)._loop(True)
            anyio.run(run)
            print("OCADE_LOCAL_STOP_CLAIM:" + json.dumps({"dispatches": len(dispatched),
                  "outputCreated": (home / "OCADE output/after-stop.txt").exists(),
                  "journalStarted": journal.get("after-stop") is not None}))
            self.assertEqual(dispatched, [], "an action started after local STOP during the claim")
            self.assertFalse((home / "OCADE output/after-stop.txt").exists(), "the actual worker wrote after local STOP")
            self.assertIsNone(journal.get("after-stop"))
            journal.db.close()



class SignedUpdates(unittest.TestCase):
    def setUp(self):
        import base64
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.home = self.root / "agent-data"
        self.home.mkdir()
        self.private = Ed25519PrivateKey.generate()
        (self.root / "release-key.txt").write_bytes(
            base64.b64encode(self.private.public_key().public_bytes_raw())
        )
        self.enterContext(patch.object(agent_module, "__file__", str(self.root / "agent.py")))
        self.enterContext(patch.object(agent_module.discovery, "dependency_platform",
                                       return_value=("Windows", "x64")))

    def release(self, version, architecture="x64", *, traversal=False):
        import hashlib
        import tarfile

        files = self.root / version
        app = files / "app"
        app.mkdir(parents=True)
        launcher = app / "ocade-agent.exe"
        launcher.write_text(version, encoding="utf8")
        bundle = files / "payload.tar.gz"
        with tarfile.open(bundle, "w:gz") as archive:
            archive.add(launcher, arcname="../escaped.exe" if traversal else launcher.name)
        raw = json.dumps({
            "version": version, "platform": "Windows", "architecture": architecture,
            "protocol": PROTOCOL["version"],
            "archiveSha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
            "treeSha256": agent_module._release_tree(app),
        }).encode("utf8")
        manifest = files / "manifest.json"
        signature = files / "manifest.sig"
        manifest.write_bytes(raw)
        signature.write_bytes(self.private.sign(raw))
        return manifest, signature, bundle

    def test_signed_update_and_rollback_use_verified_files(self):
        from subprocess import CompletedProcess

        with patch("subprocess.run", return_value=CompletedProcess([], 0)) as probe:
            agent_module._activate_release(self.home, *self.release("1.0.0"))
            first = agent_module._select_release(self.home)
            self.assertEqual(first.read_text(), "1.0.0")
            agent_module._activate_release(self.home, *self.release("2.0.0"))
            second = agent_module._select_release(self.home)
            self.assertEqual(second.read_text(), "2.0.0")
            self.assertEqual(probe.call_args.args[0], [str(second), "check-update-runtime"])
            agent_module._rollback_release(self.home)
            self.assertEqual(agent_module._select_release(self.home), first)
            self.assertEqual(second.read_text(), "2.0.0")

    def test_bad_signatures_wrong_architecture_and_traversal_do_not_launch(self):
        unsigned = self.release("1.0.0")
        unsigned[1].write_bytes(bytes(64))
        with patch("subprocess.run") as probe:
            with self.assertRaisesRegex(RuntimeError, "signature"):
                agent_module._activate_release(self.home, *unsigned)
            with self.assertRaisesRegex(RuntimeError, "architecture"):
                agent_module._activate_release(self.home, *self.release("2.0.0", "arm64"))
            with self.assertRaisesRegex(RuntimeError, "invalid or repeated path"):
                agent_module._activate_release(self.home, *self.release("3.0.0", traversal=True))
            probe.assert_not_called()
        self.assertIsNone(agent_module._select_release(self.home))
        self.assertFalse(list(self.home.rglob("escaped.exe")))

    def test_failed_startup_preserves_the_previous_release(self):
        from subprocess import CompletedProcess

        with patch("subprocess.run", return_value=CompletedProcess([], 0)):
            agent_module._activate_release(self.home, *self.release("1.0.0"))
        previous = agent_module._select_release(self.home)
        with patch("subprocess.run", return_value=CompletedProcess([], 1)):
            with self.assertRaisesRegex(RuntimeError, "previous release is still active"):
                agent_module._activate_release(self.home, *self.release("2.0.0"))
        self.assertEqual(agent_module._select_release(self.home), previous)

    def test_update_entry_refuses_while_the_agent_holds_its_lock(self):
        with patch.dict(os.environ, {"OCADE_AGENT_HOME": str(self.home)}):
            with agent_module.companion_lock(self.home):
                result = agent_module.main(["activate-update"])
        self.assertEqual(result, 3)
        self.assertFalse((self.home / "releases").exists())


if __name__ == "__main__":
    unittest.main()
