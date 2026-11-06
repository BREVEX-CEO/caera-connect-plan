"""Tracked jobs (W3, D18) and shell choice (D20) through the gateway and the real shell worker.

A job outlives a single call and an agent restart, ends at its deadline, on cancel and on
STOP together with everything it started, and is reported `lost` when nobody can say how it
ended. The commands are portable Python one-liners run through each OS's default shell.
"""

import json
import os
import signal
import sys
import tempfile
import time
import unittest
from pathlib import Path

import anyio

from ocade_agent import jobs
from ocade_agent.gateway import Gateway
from tests.test_gateway import intent


def py(code: str) -> str:
    """A command that runs `code` (no double quotes) with this Python in the default shell."""
    return f'& "{sys.executable}" -c "{code}"' if sys.platform == "win32" else f'"{sys.executable}" -c "{code}"'


def alive(pid: int) -> bool:
    return jobs._alive(pid)


class Jobs(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.home = Path(tempfile.mkdtemp())

    def call(self, *intents, then=None):
        """Run intents through one gateway; `then` runs while that gateway (the companion) lives."""
        async def go():
            async with Gateway(str(self.root), home=str(self.home)) as gateway:
                results = [await gateway.run(i, gateway.epoch) for i in intents]
                if then:
                    results.append(await anyio.to_thread.run_sync(then, *results))
                return results

        return anyio.run(go)

    def wait_for(self, job, states, seconds=30):
        deadline = time.monotonic() + seconds
        while True:
            now = jobs.status(str(self.home), job)
            if now["state"] in states or time.monotonic() > deadline:
                return now
            time.sleep(0.2)

    def test_a_job_outlives_the_call_and_reports_how_it_ended(self):
        code = "import time; print('rendering'); time.sleep(3); print('done')"
        started, finished = self.call(
            intent("job.start", {"command": py(code)}),
            then=lambda started: self.wait_for(started["evidence"]["jobId"], ("finished",)),
        )
        self.assertEqual(started["status"], "observed", started)
        self.assertEqual((finished["state"], finished["exitCode"]), ("finished", 0), finished)
        self.assertIn("done", finished["outputTail"])

    def test_after_an_agent_restart_a_job_is_reattached_or_reported_lost(self):
        [started] = self.call(intent("job.start", {"command": py("import time; time.sleep(4)")}))
        job = started["evidence"]["jobId"]
        # The gateway and its workers are gone, as after an agent restart.
        [after] = self.call(intent("job.status", {"jobId": job}))
        if sys.platform == "win32":  # ended with the companion's job object: never a silent orphan
            self.assertEqual(after["evidence"]["state"], "lost", after)
        else:
            self.assertEqual(after["evidence"]["state"], "running", after)
            self.assertEqual(self.wait_for(job, ("finished",))["exitCode"], 0)

    def test_cancel_and_stop_end_the_whole_tree(self):
        child = self.root / "child.pid"
        spawn = ("import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(120)']);"
                 f" open(r'{child}','w').write(str(p.pid)); time.sleep(120)")
        home = str(self.home)

        def while_running(cancelled, stopped):
            deadline = time.monotonic() + 20
            while not child.exists() and time.monotonic() < deadline:
                time.sleep(0.1)
            grandchild = int(child.read_text())
            ended = jobs.cancel(home, cancelled["evidence"]["jobId"])
            time.sleep(1)
            return ended, alive(grandchild), jobs.cancel_all(home), jobs.status(home, stopped["evidence"]["jobId"])

        cancelled, stopped, (ended, grandchild_alive, by_stop, after_stop) = self.call(
            intent("job.start", {"command": py(spawn)}),
            intent("job.start", {"command": py("import time; time.sleep(120)")}),
            then=while_running,
        )
        self.assertEqual(ended["state"], "cancelled", ended)
        self.assertFalse(grandchild_alive, "a process the job started outlived its cancel")
        self.assertEqual(by_stop, [stopped["evidence"]["jobId"]])
        self.assertEqual(after_stop["state"], "cancelled")

    def test_the_deadline_ends_a_job(self):
        started, ended = self.call(
            intent("job.start", {"command": py("import time; time.sleep(120)"), "timeoutSeconds": 10}),
            then=lambda started: self.wait_for(started["evidence"]["jobId"], ("timed_out",), seconds=40),
        )
        self.assertEqual(ended["state"], "timed_out", ended)

    def test_a_job_whose_runner_vanished_is_lost_and_can_still_be_ended(self):
        home = str(self.home)

        def runner_killed(started):
            job = started["evidence"]["jobId"]
            pids = json.loads((jobs.folder(home) / job / "runner.json").read_text())
            if sys.platform == "win32":  # only the runner, not its command
                import subprocess

                subprocess.run(["taskkill", "/F", "/PID", str(pids["runner"])], capture_output=True)
            else:
                os.kill(pids["runner"], signal.SIGKILL)
            time.sleep(0.5)
            lost = jobs.status(home, job)["state"]
            ended = jobs.cancel(home, job)["state"]
            time.sleep(0.5)
            return lost, ended, alive(pids["command"])

        _, (lost, ended, command_alive) = self.call(
            intent("job.start", {"command": py("import time; time.sleep(120)")}), then=runner_killed)
        self.assertEqual((lost, ended, command_alive), ("lost", "cancelled", False))

    def test_shell_choice_and_unknown_jobs(self):
        other = "cmd" if sys.platform == "win32" else "bash"
        missing = "zsh" if sys.platform == "win32" else "cmd"
        chosen, refused, unknown, started = self.call(
            intent("shell.run", {"command": "echo picked", "shell": other}),
            intent("shell.run", {"command": "echo picked", "shell": missing}),
            intent("job.status", {"jobId": "0123456789abcdef"}),
            intent("job.start", {"command": py("import time; time.sleep(120)")}),
        )
        self.assertEqual(chosen["status"], "observed", chosen)
        self.assertIn("picked", chosen["evidence"]["stdout"])
        self.assertEqual(refused["errorCode"], "shell_unavailable")
        self.assertEqual(unknown["errorCode"], "unknown_job")
        [cancelled] = self.call(intent("job.cancel", {"jobId": started["evidence"]["jobId"]}))
        self.assertEqual(cancelled["status"], "observed", cancelled)
        self.assertEqual(cancelled["evidence"]["state"], "cancelled")


class StopEndsJobs(unittest.TestCase):
    """The agent ends jobs when the server answers that nothing is running, never on an outage."""

    def run_agent(self, answer):
        from types import SimpleNamespace
        from unittest.mock import patch

        from ocade_agent import agent as agent_module
        from ocade_agent.agent import Agent
        from ocade_agent.journal import Journal

        home = Path(tempfile.mkdtemp())
        job = jobs.start(str(home), tempfile.mkdtemp(), py("import time; time.sleep(120)"), None, 600)["jobId"]

        class Device:
            def __init__(self):
                self.home = home

            def request(self, payload):
                return answer

        async def sleep(_):
            raise KeyboardInterrupt  # one pass of the loop is enough

        runner = Agent(Device(), Journal(home / "journal.sqlite"), SimpleNamespace(external={}, prewarm=lambda: None))
        with patch.object(agent_module.anyio, "sleep", sleep):
            try:
                anyio.run(runner._loop, True)
            except KeyboardInterrupt:
                pass
        state = jobs.status(str(home), job)["state"]
        jobs.cancel_all(str(home))
        return state

    def test_nothing_running_ends_jobs(self):
        self.assertEqual(self.run_agent((200, {"task": {"id": "t", "status": "stopped"}, "action": None})), "cancelled")

    def test_an_outage_ends_nothing(self):
        self.assertEqual(self.run_agent((503, {"error": "unavailable"})), "running")



class DependencyInstall(unittest.TestCase):
    def test_gateway_discovers_a_dependency_through_the_bundled_worker(self):
        async def go(root):
            async with Gateway(root, home=root) as gateway:
                return await gateway.run(intent("system.dependency", {"name": "python"}), gateway.epoch)

        with tempfile.TemporaryDirectory() as root:
            result = anyio.run(go, root)
        self.assertEqual(result["status"], "observed", result)
        self.assertEqual(result["evidence"]["name"], "python")
        self.assertIn(result["evidence"]["state"], ("detected", "manual_installation_required"))

    def test_interrupted_and_untrusted_downloads_never_publish(self):
        import hashlib
        import io
        from unittest.mock import patch

        from ocade_agent import command_worker, discovery, verify_worker

        binary = b"vendor fixture bytes"
        digest = hashlib.sha256(binary).hexdigest()
        with tempfile.TemporaryDirectory() as home:
            proposal = {
                "name": "node", "version": "9.9.9", "platform": "Windows",
                "architecture": "x64", "source": "https://vendor.example/node",
                "sha256": digest, "licence": "MIT", "scope": "current_user",
                "privileges": "none", "destination": "dependencies/node/9.9.9/x64/node.exe",
            }
            dest = Path(home) / proposal["destination"]
            with (patch.object(command_worker, "HOME", home),
                  patch.object(discovery, "dependency_proposal", return_value=proposal),
                  patch.dict(os.environ, {"OCADE_AGENT_HOME": home}),
                  patch.object(command_worker, "_dependency_source") as source):
                changed = command_worker.system_install_dependency(**(proposal | {"source": "https://other.example"}))
                self.assertEqual(changed["refused"], "dependency_proposal_changed")
                source.assert_not_called()
                source.side_effect = OSError("interrupted fixture")
                interrupted = command_worker.system_install_dependency(**proposal)
                self.assertEqual(interrupted["refused"], "dependency_download_failed")
                self.assertFalse(dest.exists())
                source.side_effect = None
                source.return_value = io.BytesIO(b"changed bytes")
                bad = command_worker.system_install_dependency(**proposal)
                self.assertEqual(bad["refused"], "dependency_integrity_failed")
                self.assertFalse(dest.exists())
                source.return_value = io.BytesIO(binary)
                installed = command_worker.system_install_dependency(**proposal)
                self.assertTrue(installed["installed"])
                self.assertEqual(dest.read_bytes(), binary)
                self.assertTrue(command_worker.system_install_dependency(**proposal)["reused"])

                from subprocess import CompletedProcess

                with patch("subprocess.run", return_value=CompletedProcess([], 0, b'["9.9.9","x64"]')) as run:
                    proved = verify_worker.verify_dependency(**proposal)
                    self.assertTrue(proved["verified"])
                    self.assertEqual(run.call_args.args[0][0], str(dest))
                    dest.write_bytes(b"replaced binary")
                    rejected = verify_worker.verify_dependency(**proposal)
                    self.assertEqual(rejected["refused"], "dependency_integrity_failed")
                    self.assertEqual(run.call_count, 1, "changed bytes must never execute")


if __name__ == "__main__":
    unittest.main()
