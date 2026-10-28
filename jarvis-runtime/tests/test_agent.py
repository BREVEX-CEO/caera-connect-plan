"""The Device Agent lifecycle: one presence, autostart, uninstall, durable results, global Stop.

Run: python -m unittest discover -s jarvis-runtime/tests -p 'test_agent.py'
The tray itself needs a desktop session; its status and Pause/Resume logic are tested here.
"""
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import unittest.mock
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import conftest  # noqa: E402,F401  test isolation for unittest runs too, not only pytest
import ocade_agent  # noqa: E402
import ocade_device  # noqa: E402


class FakeIdentity:
    def __init__(self, home: Path, replies: list):
        self.home = home
        self.meta = {"server": "https://ocade.test", "deviceId": "d1"}
        self.replies = replies
        self.bodies: list[dict] = []

    def exchange(self, body: dict) -> dict:
        self.bodies.append(json.loads(json.dumps(body)))
        reply = self.replies.pop(0) if self.replies else {"commands": [], "busy": False}
        if isinstance(reply, Exception):
            raise reply
        return reply

    def forget(self):
        pass


def _release(guard) -> None:
    """Close a guard whose exit listener is waiting in accept(). On Linux a plain close leaves
    the port held while that thread waits; shutting it down first wakes it."""
    import socket
    try:
        guard.shutdown(socket.SHUT_RDWR)
    except OSError:
        pass
    guard.close()


class LifecycleTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        os.environ["XDG_CONFIG_HOME"] = str(self.home / "config")

    def test_only_one_presence_at_a_time(self):
        first = ocade_agent.single_instance()
        self.assertIsNotNone(first)
        self.assertIsNone(ocade_agent.single_instance())
        first.close()
        again = ocade_agent.single_instance()
        self.assertIsNotNone(again)
        again.close()

    def test_the_tray_says_when_it_starts_listening(self):
        # It said "Wake: ... with Background Mode" while Windows showed the microphone in use.
        class Agent:
            stop = threading.Event()
            state = {"background": False}

            def status(self):
                return "Ready"

        class Icon:
            title, rebuilt = "", 0

            def update_menu(self):
                Icon.rebuilt += 1

        presence = ocade_agent.Presence.__new__(ocade_agent.Presence)
        presence.agent, presence.icon = Agent(), Icon()
        ocade_agent.WAKE.update({"wake": "ready"})
        threading.Thread(target=presence._follow_status, daemon=True).start()
        time.sleep(1.5)
        Agent.state["background"] = True
        time.sleep(1.5)
        Agent.stop.set()
        self.assertEqual(Icon.rebuilt, 2)
        # Available and wanted is not listening: only live audio says so (F-160).
        self.assertEqual(ocade_agent._wake_words(Agent()), "Wake: waiting for a microphone")
        ocade_agent.WAKE["live"] = True
        self.assertEqual(ocade_agent._wake_words(Agent()), "Listening for “OCADE”")
        ocade_agent.WAKE.clear()
        ocade_agent.WAKE.update({"wake": "off"})

    def test_a_second_start_while_one_runs_is_not_a_failed_start(self):
        # Counted as a failed start of the running build, three of these rolled a good build back.
        import unittest.mock
        running = ocade_agent.single_instance()
        ocade_agent.serve_exit(running, lambda: None)  # a real agent answers on its port
        counted = []
        try:
            with unittest.mock.patch.object(ocade_agent, "install_root", lambda: self.home),                     unittest.mock.patch.object(ocade_agent.ocade_update, "launch_target",
                                               lambda root: counted.append(root)),                     unittest.mock.patch.object(sys, "argv", ["ocade-agent"]):
                ocade_agent.main()
        finally:
            _release(running)
        self.assertEqual(counted, [])

    def test_a_stranger_on_the_port_is_not_the_agent(self):
        """F-111: only an agent that greets as one counts as running."""
        import socket
        stranger = socket.socket()
        if os.name == "posix":  # as the agent does: an earlier test's closed port may still wait
            stranger.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        stranger.bind(("127.0.0.1", ocade_agent.SINGLE_INSTANCE_PORT))
        stranger.listen(5)
        token = ocade_agent.ocade_device.HOME / "exit.token"
        try:
            token.unlink(missing_ok=True)
            self.assertFalse(ocade_agent.already_running())
            # An agent from before the greeting is silent but left this account's token.
            token.parent.mkdir(parents=True, exist_ok=True)
            token.write_text("t")
            self.assertTrue(ocade_agent.already_running())
        finally:
            stranger.close()
        agent = ocade_agent.single_instance()
        ocade_agent.serve_exit(agent, lambda: None)
        try:
            self.assertTrue(ocade_agent.already_running())
        finally:
            _release(agent)

    def test_autostart_and_uninstall_leave_nothing_behind(self):
        ocade_agent.install_autostart()
        try:
            self.assertIn("ocade_agent.py", self._autostart_entry() or "")
            (self.home / "device.key").write_text("k")
            message = ocade_agent.uninstall(self.home)
        finally:
            ocade_agent.remove_autostart()  # never leave a login item behind on a real machine
        self.assertIsNone(self._autostart_entry())
        self.assertFalse(self.home.exists())
        self.assertIn("PC control, background tasks and wake features have stopped", message)
        self.assertNotIn("did not confirm", message)

    def test_uninstall_says_when_ocade_never_confirmed_the_disconnect(self):
        import unittest.mock

        class Refused:
            connected = True

            def __init__(self, home):
                pass

            def exchange(self, body):
                raise RuntimeError("The device was not disconnected.")

        with unittest.mock.patch.object(ocade_agent, "Identity", Refused), \
                unittest.mock.patch.object(ocade_agent, "remove_autostart", lambda: None), \
                unittest.mock.patch.object(ocade_agent, "stop_running_agent", lambda *a: True):
            (self.home / "device.key").write_text("k")
            message = ocade_agent.uninstall(self.home)
        self.assertFalse(self.home.exists())
        self.assertIn("remove it in OCADE Devices", message)

    def test_a_first_start_waits_offline_and_asks_again_only_when_the_person_says(self):
        shown, opened = [], []
        again = threading.Event()
        plan = [urllib.error.URLError("offline"), False, True]  # offline, not approved, approved

        class Waiting:
            def __init__(self, home):
                pass

            def enroll(self, server, name, system):
                if isinstance(plan[0], Exception):
                    raise plan.pop(0)
                return {"url": "https://ocade.test/connect", "fingerprint": "AAAA"}

            def wait_for_approval(self):
                return plan.pop(0)

            def forget(self):
                shown.append("forgot the unapproved key")

        def show(status, url):
            shown.append(status)
            if status == "Not connected":
                again.set()  # the person chooses "Connect this computer" in the tray

        identity = ocade_agent.await_connection("https://ocade.test", "PC", show, opened.append, again,
                                                can_ask_again=True, identity_at=Waiting, retry_s=0.01)
        self.assertIsInstance(identity, Waiting)
        self.assertEqual(shown, ["Offline", "Waiting to be connected", "forgot the unapproved key",
                                 "Not connected", "Waiting to be connected"])
        self.assertEqual(len(opened), 2)  # the page opens once per request, never by itself

        # With no tray to ask from, a refusal ends the agent: it never waits unseen for ever.
        plan[:] = [False]
        with self.assertRaises(SystemExit):
            ocade_agent.await_connection("https://ocade.test", "PC", show, opened.append, again,
                                         can_ask_again=False, identity_at=Waiting)

    @staticmethod
    def _autostart_entry():
        """The login item's command (Windows: the HKCU Run value), or None."""
        if sys.platform == "win32":
            import winreg
            try:
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                    r"Software\Microsoft\Windows\CurrentVersion\Run") as key:
                    return winreg.QueryValueEx(key, ocade_agent.AUTOSTART_NAME)[0]
            except FileNotFoundError:
                return None
        entry = ocade_agent.autostart_path()
        return entry.read_text() if entry.exists() else None

    def _agent(self, replies):
        identity = FakeIdentity(self.home, replies)
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=str(self.home))
        agent.browsers.run = lambda *_: {
            "status": "done", "summary": "ok"}
        return agent, identity

    def test_a_malformed_reply_neither_stops_the_agent_nor_loses_a_result(self):
        """BLOCKED_TESTS NET-03-01: what a broken proxy or server could send instead of a reply."""
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        later = {"id": "a2", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        agent, identity = self._agent([
            {"commands": [command], "busy": True},
            {"commands": "nonsense", "acks": "nonsense", "busy": True},    # wrong types
            urllib.error.URLError("the reply was not OCADE's"),            # how Identity reports HTML
            {"commands": [{"id": "x"}, later], "busy": True},              # a command with no action
            {"commands": [], "busy": False, "acks": [{"id": "a1", "outcome": "stored"}]},
        ])
        runner = threading.Thread(target=agent.run)
        runner.start()
        for _ in range(100):
            if any(r.get("id") == "a2" for b in identity.bodies for r in b.get("results", [])):
                break
            time.sleep(0.1)
        agent.stop.set()
        runner.join(10)
        self.assertFalse(runner.is_alive())
        sent = [r for b in identity.bodies for r in b.get("results", [])]
        self.assertIn("a1", [r["id"] for r in sent])   # sent again until a reply answers for it
        self.assertEqual(next(r for r in sent if r["id"] == "a2")["status"], "done")
        self.assertEqual(next(r for r in sent if r["id"] == "x")["status"], "failed")  # answered, not run

    def test_results_survive_a_lost_connection_and_a_restart(self):
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        agent, identity = self._agent([{"commands": [command], "busy": True},
                                       urllib.error.URLError("offline")])
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(1.0)
        agent.stop.set()
        runner.join(10)
        kept = json.loads((self.home / "pending.json").read_text())
        self.assertEqual([r["id"] for r in kept], ["a1"])
        # A new process (after a reboot) delivers them first.
        again, identity = self._agent([{"commands": [], "busy": False}])
        again.stop.set()
        self.assertEqual(again._load_pending()[0]["id"], "a1")

    def test_background_mode_asks_ocade_for_the_next_step_and_never_in_a_tight_loop(self):
        """The computer carries on: it asks, OCADE plans and queues; nothing is decided here."""
        agent, identity = self._agent([{"commands": [], "busy": True, "continue": "t1"}] * 4)
        asked = []

        def post(path, body, timeout=40):
            asked.append((path, body, timeout))
            return 200, {"state": "idle"}  # nothing could be planned

        identity.post = post
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(3.5)
        agent.stop.set()
        runner.join(10)
        self.assertEqual(asked, [("/api/jarvis/continue", {"taskId": "t1"}, ocade_device.CARRY_ON_TIMEOUT_S)])

    def test_an_action_to_run_comes_before_asking_for_another(self):
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        agent, identity = self._agent([{"commands": [command], "busy": True, "continue": "t1"}])
        asked = []
        identity.post = lambda *a, **k: (asked.append(a), (200, {"state": "queued"}))[1]
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(0.8)
        agent.stop.set()
        runner.join(10)
        self.assertEqual(asked, [])

    def test_stop_jarvis_reaches_ocade_once(self):
        agent, identity = self._agent([{"commands": [], "busy": True}] * 3)
        agent.stop_all.set()
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(2.5)
        agent.stop.set()
        runner.join(10)
        stops = [b.get("stop") for b in identity.bodies]
        self.assertEqual(stops[0], True)
        self.assertNotIn(True, stops[1:])

    def _long_action(self, agent):
        """A computer action that keeps working until its cancellation token is set."""
        seen = {"started": threading.Event(), "stopped_at": None}

        def run(action, confirmed, cancel):
            seen["started"].set()
            while not cancel.wait(0.05):
                pass
            seen["stopped_at"] = time.monotonic()
            return {"status": "failed", "summary": "Stopped before it finished", "stopped": True}

        agent.computer.run = run
        return seen

    def test_removing_the_device_stops_the_running_action_before_the_key_goes(self):
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        agent, identity = self._agent([{"commands": [command], "busy": True},
                                       {"commands": [], "busy": True}])
        seen = self._long_action(agent)
        forgot = {}

        def forget():
            forgot["at"] = time.monotonic()
            forgot["action_alive"] = any(t.name == "ocade-action" and t.is_alive()
                                         for t in threading.enumerate())

        identity.forget = forget
        runner = threading.Thread(target=agent.run)
        runner.start()
        self.assertTrue(seen["started"].wait(5))
        identity.replies.append(ocade_device.NotEnrolled())
        runner.join(15)
        self.assertFalse(runner.is_alive())
        self.assertIsNotNone(seen["stopped_at"], "the action kept running after removal")
        self.assertLessEqual(seen["stopped_at"], forgot["at"])
        self.assertFalse(forgot["action_alive"], "the key went while the action still ran")
        # Nothing is reported with the key gone, but what the action did is kept here (C08).
        self.assertFalse((self.home / "pending.json").exists())
        kept = json.loads((self.home / "unreported-results.json").read_text())
        self.assertEqual([r["id"] for r in kept], ["a1"])

    def _run_outbox_fast(self, agent):
        # The real exchange loop and journals run; installed-app discovery and polling
        # delays are unrelated to this transport regression and never touch a desktop.
        with unittest.mock.patch.object(ocade_device, "POLL_IDLE_SECONDS", 0), \
                unittest.mock.patch.dict(ocade_device._APPS, {"at": float("inf"), "list": []}), \
                unittest.mock.patch.object(agent.stop, "wait", return_value=False):
            return agent.run()

    @staticmethod
    def _outcomes(count, **extra):
        return [{"id": f"00000000-0000-4000-8000-{i:012d}", "status": "done",
                 "receipt": f"r-{i}", **extra} for i in range(count)]

    def test_recovered_outboxes_drain_within_the_server_batch_limit(self):
        for count in (0, 1, 20, 21, 100, 1000):
            with self.subTest(count=count):
                agent, identity = self._agent([])
                results = self._outcomes(count)
                self.assertTrue(agent._keep_pending(results))
                expected = {r["id"] for r in results}
                accepted = set()

                def exchange(body):
                    identity.bodies.append(json.loads(json.dumps(body)))
                    batch = body["results"]
                    self.assertLessEqual(len(batch), 20)
                    self.assertEqual(body["hasMoreResults"],
                                     len(expected - accepted) > len(batch))
                    self.assertTrue(all(r["id"] not in accepted for r in batch))
                    accepted.update(r["id"] for r in batch)
                    if accepted == expected:
                        agent.stop.set()
                    return {"commands": [], "busy": False,
                            "acks": [{**r, "outcome": "accepted"} for r in batch]}

                identity.exchange = exchange
                self.assertEqual(self._run_outbox_fast(agent), 0)
                self.assertEqual(accepted, expected)
                self.assertEqual(agent._read(agent.pending_path), [])
                self.assertEqual(len(identity.bodies), max(1, (count + 19) // 20))

    def test_lost_partial_and_unsolicited_answers_never_retire_unsent_results(self):
        agent, identity = self._agent([])
        results = self._outcomes(21)
        self.assertTrue(agent._keep_pending(results))

        def exchange(body):
            identity.bodies.append(json.loads(json.dumps(body)))
            self.assertLessEqual(len(body["results"]), 20)
            call = len(identity.bodies)
            if call == 1:
                raise urllib.error.URLError("reply lost")
            if call == 2:
                self.assertEqual(body["results"], identity.bodies[0]["results"])
                return {"commands": [], "busy": False, "acks": [
                    {"id": results[0]["id"], "receipt": "r-0", "outcome": "accepted"},
                    # This one was never transmitted in either exchange.
                    {"id": results[20]["id"], "receipt": "r-20", "outcome": "accepted"},
                    {"id": results[1]["id"], "receipt": "different", "outcome": "accepted"},
                    {"id": results[2]["id"], "receipt": "r-2", "outcome": "retry"},
                    {"id": [results[3]["id"]], "receipt": "r-3", "outcome": "accepted"},
                    {"id": results[4]["id"], "receipt": "r-4", "outcome": ["accepted"]},
                ]}
            self.assertEqual(call, 3)
            self.assertEqual(body["results"], results[1:])
            self.assertIn(results[20], agent._read(agent.pending_path))
            agent.stop.set()
            return {"commands": [], "busy": False, "acks": [
                {"id": r["id"], "receipt": r["receipt"], "outcome": "accepted"}
                for r in body["results"]]}

        identity.exchange = exchange
        self.assertEqual(self._run_outbox_fast(agent), 0)
        self.assertEqual(agent._read(agent.pending_path), [])

    def test_control_has_an_independent_small_envelope_even_with_an_oversized_result(self):
        for control, event in (("stop", "stop_all"), ("pause", "pause_asked"),
                               ("resume", "resume_asked")):
            with self.subTest(control=control):
                agent, identity = self._agent([])
                results = self._outcomes(21, detail="x" * 40_000)
                results[0]["detail"] = "x" * 700_000
                self.assertTrue(agent._keep_pending(results))
                getattr(agent, event).set()

                def exchange(body):
                    identity.bodies.append(json.loads(json.dumps(body)))
                    self.assertEqual(body, {"results": [], "running": [],
                                            "hasMoreResults": True, control: True})
                    agent.stop.set()
                    # Even a matching ACK cannot retire a result that control never sent.
                    return {"commands": [], "busy": False, "acks": [
                        {"id": r["id"], "receipt": r["receipt"], "outcome": "accepted"}
                        for r in results]}

                identity.exchange = exchange
                with unittest.mock.patch.object(agent.browsers, "capabilities",
                                                side_effect=AssertionError("control queried telemetry")):
                    self.assertEqual(self._run_outbox_fast(agent), 0)
                self.assertEqual(agent._read(agent.pending_path), results)

    def test_shutdown_stop_retains_the_complete_outbox_and_ignores_unsent_acks(self):
        agent, identity = self._agent([])
        results = self._outcomes(1000)
        self.assertTrue(agent._keep_pending(results))
        agent.stop_all.set()
        agent.stop.set()

        def exchange(body):
            identity.bodies.append(json.loads(json.dumps(body)))
            self.assertEqual(body, {"results": [], "running": [], "stop": True,
                                    "hasMoreResults": True})
            return {"acks": [{"id": r["id"], "receipt": r["receipt"], "outcome": "accepted"}
                             for r in results]}

        identity.exchange = exchange
        self.assertEqual(self._run_outbox_fast(agent), 0)
        self.assertEqual(len(identity.bodies), 1)
        self.assertEqual(agent._read(agent.pending_path), results)
        again, _ = self._agent([])
        self.assertEqual(again._load_pending(), results)

    def test_partially_drained_journal_restarts_with_the_same_receipts(self):
        agent, identity = self._agent([])
        results = self._outcomes(21)
        self.assertTrue(agent._keep_pending(results))

        def first(body):
            self.assertEqual(body["results"], results[:20])
            agent.stop.set()
            return {"commands": [], "busy": False, "acks": [
                {"id": r["id"], "receipt": r["receipt"], "outcome": "accepted"}
                for r in body["results"][:7]]}

        identity.exchange = first
        self.assertEqual(self._run_outbox_fast(agent), 0)
        self.assertEqual(agent._read(agent.pending_path), results[7:])
        again, identity = self._agent([])

        def resumed(body):
            self.assertEqual(body["results"], results[7:])
            again.stop.set()
            return {"commands": [], "busy": False, "acks": [
                {"id": r["id"], "receipt": r["receipt"], "outcome": "accepted"}
                for r in body["results"]]}

        identity.exchange = resumed
        self.assertEqual(self._run_outbox_fast(again), 0)
        self.assertEqual(again._read(again.pending_path), [])

    def test_complete_encoded_exchange_stays_within_the_server_text_limit(self):
        agent, identity = self._agent([])
        results = self._outcomes(3, detail="é" * 50_000)
        self.assertTrue(agent._keep_pending(results))
        accepted = set()

        def exchange(body):
            identity.bodies.append(json.loads(json.dumps(body)))
            self.assertLessEqual(len(json.dumps(body)), 600_000)
            self.assertEqual(len(body["results"]), 1)
            accepted.update(r["id"] for r in body["results"])
            if len(accepted) == 3:
                agent.stop.set()
            return {"commands": [], "busy": False, "acks": [
                {"id": r["id"], "receipt": r["receipt"], "outcome": "accepted"}
                for r in body["results"]]}

        identity.exchange = exchange
        self.assertEqual(self._run_outbox_fast(agent), 0)
        self.assertEqual(accepted, {r["id"] for r in results})

    def test_a_single_oversized_result_is_retained_and_never_claims_new_work(self):
        agent, identity = self._agent([])
        results = self._outcomes(1, detail="x" * 700_000)
        self.assertTrue(agent._keep_pending(results))

        def exchange(body):
            self.assertLessEqual(len(json.dumps(body)), 600_000)
            self.assertEqual(body["results"], [])
            self.assertTrue(body["hasMoreResults"])
            agent.stop.set()
            return {"commands": [], "busy": False}

        identity.exchange = exchange
        self.assertEqual(self._run_outbox_fast(agent), 0)
        self.assertTrue(agent.state["outbox_blocked"])
        self.assertEqual(agent._read(agent.pending_path), results)

    def test_only_results_ocade_answered_for_leave_the_journal(self):
        """C07/V04: only an answer for that id AND receipt, saying OCADE holds it, retires a
        result. No answer, retry, an unknown answer, another receipt, or no answers at all: kept."""
        ids = ("kept", "stopped", "lost", "again", "gone", "odd", "other")
        results = [{"id": i, "status": "done", "receipt": f"r-{i}"} for i in ids]
        reply = {"acks": [{"id": "kept", "receipt": "r-kept", "outcome": "accepted"},
                          {"id": "stopped", "receipt": "r-stopped", "outcome": "stopped"},
                          {"id": "again", "receipt": "r-again", "outcome": "retry"},
                          {"id": "gone", "receipt": "r-gone", "outcome": "unknown"},
                          {"id": "odd", "receipt": "r-odd", "outcome": "saved-maybe"},
                          {"id": "other", "receipt": "r-earlier", "outcome": "accepted"},
                          "not an answer"]}
        self.assertEqual([r["id"] for r in ocade_device.Agent._unanswered(results, reply)],
                         ["lost", "again", "odd", "other"])
        # A reply without answers (malformed, or cut short) retires nothing.
        self.assertEqual(ocade_device.Agent._unanswered(results, {"commands": []}), results)
        self.assertEqual(ocade_device.Agent._unanswered(results, {"acks": None}), results)

    def test_every_journalled_result_carries_its_own_receipt(self):
        agent, _ = self._agent([])
        results = [{"id": "a1", "status": "done"}, {"id": "a2", "status": "failed", "receipt": "mine"}]
        self.assertTrue(agent._keep_pending(results))
        kept = json.loads((self.home / "pending.json").read_text())
        self.assertEqual(kept[1]["receipt"], "mine")
        self.assertRegex(kept[0]["receipt"], r"^[0-9a-f]{32}$")

    def test_nothing_runs_while_the_journal_cannot_be_written(self):
        """V04: a step whose start cannot be recorded never runs; it is reported not run."""
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_write", "path": "x.txt",
                                                          "content": "x"}}
        agent, identity = self._agent([{"commands": [command], "busy": True},
                                       {"commands": [], "busy": False}])
        real_keep = ocade_device.Agent._keep

        def full_disk(path, items):
            if path.name == "running.json" and items:
                raise OSError(28, "No space left on device")
            return real_keep(path, items)
        with unittest.mock.patch.object(ocade_device.Agent, "_keep", staticmethod(full_disk)):
            runner = threading.Thread(target=agent.run)
            runner.start()
            time.sleep(1.5)
            agent.stop.set()
            runner.join(10)
        self.assertFalse((self.home / "x.txt").exists())
        sent = [r for body in identity.bodies for r in body.get("results", [])]
        self.assertTrue(sent and sent[0]["id"] == "a1" and sent[0]["status"] == "failed", sent)
        self.assertIn("did not run", sent[0]["summary"])

    def test_an_agent_process_killed_after_the_effect_reports_it_unknown_on_restart(self):
        """V04, a real process kill: the step wrote its file, the process died before its result
        reached the journal. On restart the step is reported unknown, never lost and never done."""
        import subprocess
        work = self.home / "work"
        work.mkdir()
        child = (
            "import json, sys, threading, time\n"
            f"sys.path.insert(0, {str(Path(__file__).resolve().parents[1])!r})\n"
            "import ocade_device\n"
            "from pathlib import Path\n"
            "class Identity:\n"
            f"    home = Path({str(self.home)!r})\n"
            "    meta = {'server': 'https://ocade.test', 'deviceId': 'd1'}\n"
            "    sent = 0\n"
            "    def exchange(self, body):\n"
            "        Identity.sent += 1\n"
            "        cmd = {'id': 'a1', 'taskId': 't1', 'action': {'action': 'file_write', 'path': 'x.txt', 'content': 'x'}}\n"
            "        return {'commands': [cmd] if Identity.sent == 1 else [], 'busy': True, 'acks': []}\n"
            "    def forget(self): pass\n"
            "agent = ocade_device.Agent(Identity(), headless=True, cdp=None, "
            f"workspace={str(work)!r})\n"
            "real = agent._keep_pending\n"
            "def slow(results):\n"
            "    if any(r.get('id') == 'a1' for r in results):\n"
            "        print('EFFECT-DONE', flush=True)\n"
            "        time.sleep(60)  # killed here: the result never reaches the journal\n"
            "    return real(results)\n"
            "agent._keep_pending = slow\n"
            "agent.run()\n")
        proc = subprocess.Popen([sys.executable, "-c", child], stdout=subprocess.PIPE, text=True,
                                env={**os.environ, "OCADE_JARVIS_HOME": str(self.home)})
        try:
            deadline = time.monotonic() + 30
            line = ""
            while "EFFECT-DONE" not in line and time.monotonic() < deadline:
                line = proc.stdout.readline()
            self.assertIn("EFFECT-DONE", line)
        finally:
            proc.kill()  # SIGKILL / TerminateProcess: no cleanup runs
            proc.wait(10)
            proc.stdout.close()
        self.assertEqual((work / "x.txt").read_text(), "x")  # the effect happened
        self.assertFalse((self.home / "pending.json").exists())  # its result was never kept
        again, _ = self._agent([])
        recovered = again._load_pending()
        self.assertEqual([(r["id"], r["status"], r["summary"]) for r in recovered],
                         [("a1", "failed", ocade_device.INTERRUPTED)])

    def test_a_crash_after_the_effect_keeps_the_step_as_unknown_until_its_result_is_kept(self):
        """V04: the running mark goes only once the journal holds what it became."""
        agent, _ = self._agent([])
        agent._keep(agent.intent_path, ["a1"])  # the agent died while a1 ran
        real_keep = ocade_device.Agent._keep

        def pending_fails(path, items):
            if path.name == "pending.json":
                raise OSError(13, "Permission denied")
            return real_keep(path, items)
        with unittest.mock.patch.object(ocade_device.Agent, "_keep", staticmethod(pending_fails)):
            results = agent._load_pending()
        self.assertEqual([r["id"] for r in results], ["a1"])
        self.assertEqual(json.loads(agent.intent_path.read_text()), ["a1"])  # not cleared
        again, _ = self._agent([])
        recovered = again._load_pending()
        self.assertEqual(recovered[0]["summary"], ocade_device.INTERRUPTED)
        self.assertFalse(again.intent_path.exists())

    def test_losing_ocade_during_an_action_stops_it(self):
        command = {"id": "a1", "taskId": "t1", "action": {"action": "file_list", "path": "."}}
        agent, identity = self._agent([{"commands": [command], "busy": True}]
                                      + [urllib.error.URLError("offline")] * 50)
        seen = self._long_action(agent)
        old, ocade_device.CONTROL_LOSS_S = ocade_device.CONTROL_LOSS_S, 0.5
        try:
            runner = threading.Thread(target=agent.run)
            runner.start()
            self.assertTrue(seen["started"].wait(5))
            deadline = time.monotonic() + 10
            while seen["stopped_at"] is None and time.monotonic() < deadline:
                time.sleep(0.1)
            agent.stop.set()
            runner.join(15)
        finally:
            ocade_device.CONTROL_LOSS_S = old
        self.assertIsNotNone(seen["stopped_at"], "the action continued without a control channel")

    def test_dormant_without_a_task(self):
        agent, identity = self._agent([])
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(2)
        agent.stop.set()
        runner.join(10)
        self.assertLessEqual(len(identity.bodies), 1)  # one quiet check, then waiting


class WakeTest(unittest.TestCase):
    def test_wake_is_unavailable_without_its_signed_model_and_opens_voice_when_heard(self):
        import unittest.mock
        import ocade_wake
        home = Path(tempfile.mkdtemp())
        with unittest.mock.patch.object(ocade_wake, "bundled", return_value=home / "missing"):
            self.assertEqual(ocade_wake.health()["wake"], "unavailable")
            self.assertFalse(ocade_wake.available(home))
            self.assertFalse(ocade_wake.listen(home, "https://ocade.test", threading.Event()))
        opened = []
        ocade_wake.webbrowser.open = opened.append
        ocade_wake.open_voice("https://ocade.test/")
        self.assertEqual(opened, ["https://ocade.test/ocade-jarvis?voice=1"])


class TrayStatusTest(unittest.TestCase):
    """The tray says one truthful word, and Pause/Resume reach OCADE exactly once."""

    def setUp(self):
        self.home = Path(tempfile.mkdtemp())

    def test_status_words(self):
        identity = FakeIdentity(self.home, [])
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=str(self.home))
        self.assertEqual(agent.status(), "Ready")
        agent.state.update(busy=True, task={"status": "running"})
        self.assertEqual(agent.status(), "Working")
        agent.state["task"] = {"status": "waiting"}
        self.assertEqual(agent.status(), "Waiting for you")
        agent.pause()
        self.assertEqual(agent.status(), "Paused")
        self.assertTrue(agent.cancel.is_set(), "pausing ends the step in progress")
        agent.resume()
        agent.state["offline"] = True
        self.assertEqual(agent.status(), "Offline")
        agent.stop_everything()
        self.assertEqual(agent.status(), "Stopping")

    def test_work_folder_is_chosen_once_and_remembered(self):
        identity = FakeIdentity(self.home, [])
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=None)
        self.assertFalse(agent.computer.capabilities()["files"])
        folder = self.home / "Projects"
        folder.mkdir()
        agent.set_workspace(str(folder))
        self.assertTrue(agent.computer.capabilities()["files"])
        again = ocade_device.Agent(identity, headless=True, cdp=None, workspace=None)
        self.assertEqual(again.computer.root, folder.resolve())
        for too_broad in (str(Path.home()), str(Path(folder.anchor))):
            with self.assertRaises(ValueError):
                agent.set_workspace(too_broad)

    def test_pause_then_resume_reach_ocade_once_each(self):
        identity = FakeIdentity(self.home, [{"commands": [], "busy": True}] * 6)
        agent = ocade_device.Agent(identity, headless=True, cdp=None, workspace=str(self.home))
        agent.pause()
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(1.5)
        agent.resume()
        time.sleep(1.5)
        agent.stop.set()
        runner.join(10)
        pauses = [b.get("pause") for b in identity.bodies]
        resumes = [b.get("resume") for b in identity.bodies]
        self.assertEqual(pauses.count(True), 1)
        self.assertEqual(resumes.count(True), 1)
        self.assertLess(pauses.index(True), resumes.index(True))


if __name__ == "__main__":
    unittest.main()


class RemovalSignalTest(unittest.TestCase):
    """Only OCADE saying 'not enrolled' makes a device forget itself; a wrong clock never does."""

    def _identity(self, answer):
        import ocade_identity
        identity = ocade_identity.Identity(Path(tempfile.mkdtemp()))
        identity.meta = {"deviceId": "d1", "rotatedAt": int(time.time()), "server": "https://ocade.test"}
        identity.post = lambda path, body, key=None: answer
        return identity, ocade_identity

    def test_answers(self):
        identity, module = self._identity((409, {"error": "clock_skew"}))
        with self.assertRaises(module.ClockSkew):
            identity.exchange({"results": []})
        for answer in ((409, {"error": "replayed"}), (401, {"error": "signature_invalid"}),
                       (500, {}), (503, {"error": "busy"})):
            identity, module = self._identity(answer)
            with self.assertRaises(urllib.error.URLError, msg=str(answer)):
                identity.exchange({"results": []})
        for error in ("device_not_enrolled", "enrollment_expired"):
            identity, module = self._identity((401, {"error": error}))
            with self.assertRaises(module.NotEnrolled):
                identity.exchange({"results": []})

    def test_a_wrong_clock_shows_in_the_tray_and_keeps_the_key(self):
        import ocade_identity
        agent = ocade_device.Agent(FakeIdentity(Path(tempfile.mkdtemp()), [ocade_identity.ClockSkew()] * 5),
                                   headless=True, cdp=None, workspace=None)
        runner = threading.Thread(target=agent.run)
        runner.start()
        time.sleep(1.5)
        self.assertEqual(agent.status(), "Check this computer's clock")
        agent.stop.set()
        runner.join(10)
        self.assertTrue(agent.state["connected"])


class RotationTest(unittest.TestCase):
    """A rotation whose answer was lost never strands the device."""

    def test_a_lost_rotation_answer_is_recovered_on_the_next_exchange(self):
        import ocade_identity
        identity = ocade_identity.Identity(Path(tempfile.mkdtemp()))
        identity.meta = {"deviceId": "d1", "rotatedAt": 0, "server": "https://ocade.test"}
        identity._save(ocade_identity.new_key())
        server = {"key": ocade_identity.public_text(identity.key), "lost": True}

        def post(path, body, key=None, **_):
            if ocade_identity.public_text(key or identity.key) != server["key"]:
                return 401, {"error": "signature_invalid"}
            if "rotate" in body:
                server["key"] = body["rotate"]["publicKey"]
                if server["lost"]:  # applied by OCADE, the answer lost on the way
                    server["lost"] = False
                    raise urllib.error.URLError("connection reset")
                return 200, {"rotated": True}
            return 200, {"deviceId": "d1", "protocol": ocade_identity.PROTOCOL["version"]}
        identity.post = post
        with self.assertRaises(urllib.error.URLError):
            identity.exchange({"results": []})
        # The next exchange (rotation still due) finds the key OCADE now holds.
        self.assertEqual(identity.exchange({"results": []})["deviceId"], "d1")
        self.assertEqual(ocade_identity.public_text(identity.key), server["key"])
        self.assertFalse(identity.next_path.exists())


class IconUploadTest(unittest.TestCase):
    """App icons never crowd out the control exchange, and count as sent only once stored
    (audit F02, F03)."""

    def test_a_large_catalog_rides_in_bounded_batches_and_a_bounded_whole(self):
        icons = {f"App {i:03}": "A" * 3172 for i in range(500)}
        batches = ocade_device.icon_batches(icons)
        self.assertTrue(all(len(json.dumps(b)) <= 61_000 for b in batches))
        self.assertLessEqual(sum(len(json.dumps(b)) for b in batches), 1_510_000)
        names = [name for batch in batches for name in batch]
        self.assertEqual(names, sorted(icons)[:len(names)])  # past the bound, left out in order
        self.assertEqual(ocade_device.icon_batches({}), [{}])

    def test_icons_wait_for_a_quiet_exchange_and_advance_only_when_acknowledged(self):
        upload = ocade_device.IconUpload()
        icons = {f"App {i:03}": "A" * 3172 for i in range(40)}
        busy = {"results": [{"id": "x"}], "frame": None}
        upload.attach(busy, icons)
        self.assertNotIn("appIcons", busy)  # a result is never delayed by icons
        sent = []
        for _ in range(10):
            body = {"results": [], "frame": None}
            upload.attach(body, icons)
            if "appIcons" not in body:
                break
            batch = body["appIconsBatch"]
            sent.append(batch["index"])
            upload.settled(body, {"appIconsStored": f"{batch['revision']}:{batch['index']}"})
        self.assertEqual(sent, list(range(len(ocade_device.icon_batches(icons)))))
        self.assertTrue(upload.sent)

    def test_a_batch_that_was_not_stored_is_sent_again(self):
        upload = ocade_device.IconUpload()
        icons = {"Word": "A" * 100}
        body = {"results": [], "frame": None}
        upload.attach(body, icons)
        upload.settled(body, {})  # stored nothing: no acknowledgement
        self.assertFalse(upload.sent)
        retry = {"results": [], "frame": None}
        upload.attach(retry, icons)
        self.assertNotIn("appIcons", retry)  # paused, not hammered
        upload.wait_until = 0
        upload.attach(retry, icons)
        self.assertEqual(retry["appIcons"], icons)
        upload.settled(retry, {"appIconsStored": f"{retry['appIconsBatch']['revision']}:0"})
        self.assertTrue(upload.sent)
        again = {"results": [], "frame": None}
        upload.attach(again, icons)
        self.assertNotIn("appIcons", again)  # unchanged icons are not resent
