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

    def call(self, *intents):
        async def go():
            async with Gateway(str(self.root), home=str(self.home)) as gateway:
                return [await gateway.run(i, gateway.epoch) for i in intents]

        return anyio.run(go)

    def wait_for(self, job, states, seconds=30):
        deadline = time.monotonic() + seconds
        while True:
            now = jobs.status(str(self.home), job)
            if now["state"] in states or time.monotonic() > deadline:
                return now
            time.sleep(0.2)

    def test_a_job_outlives_the_call_and_the_agent_and_reports_how_it_ended(self):
        [started] = self.call(intent("job.start", {
            "command": py("import time; print('rendering'); time.sleep(3); print('done')")}))
        self.assertEqual(started["status"], "observed", started)
        job = started["evidence"]["jobId"]
        # The gateway and its workers are gone (as after an agent restart); a new one reattaches.
        [running] = self.call(intent("job.status", {"jobId": job}))
        self.assertEqual(running["evidence"]["state"], "running", running)
        finished = self.wait_for(job, ("finished",))
        self.assertEqual((finished["state"], finished["exitCode"]), ("finished", 0), finished)
        self.assertIn("done", finished["outputTail"])

    def test_deadline_cancel_and_stop_end_the_whole_tree(self):
        child = self.root / "child.pid"
        spawn = ("import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(120)']);"
                 f" open(r'{child}','w').write(str(p.pid)); time.sleep(120)")
        timed, cancelled, stopped = self.call(
            intent("job.start", {"command": py("import time; time.sleep(120)"), "timeoutSeconds": 10}),
            intent("job.start", {"command": py(spawn)}),
            intent("job.start", {"command": py("import time; time.sleep(120)")}),
        )
        ids = [r["evidence"]["jobId"] for r in (timed, cancelled, stopped)]
        deadline = time.monotonic() + 20
        while not child.exists() and time.monotonic() < deadline:
            time.sleep(0.1)
        grandchild = int(child.read_text())
        [ended] = self.call(intent("job.cancel", {"jobId": ids[1]}))
        self.assertEqual(ended["evidence"]["state"], "cancelled", ended)
        time.sleep(1)
        self.assertFalse(alive(grandchild), "a process the job started outlived its cancel")
        self.assertEqual(jobs.cancel_all(str(self.home)), [j for j in sorted(ids) if j in (ids[0], ids[2])])
        self.assertEqual(jobs.status(str(self.home), ids[2])["state"], "cancelled")
        self.assertIn(jobs.status(str(self.home), ids[0])["state"], ("cancelled", "timed_out"))

    def test_the_deadline_ends_a_job(self):
        [started] = self.call(intent("job.start", {"command": py("import time; time.sleep(120)"),
                                                   "timeoutSeconds": 10}))
        ended = self.wait_for(started["evidence"]["jobId"], ("timed_out",), seconds=40)
        self.assertEqual(ended["state"], "timed_out", ended)

    def test_a_job_whose_runner_vanished_is_lost_and_can_still_be_ended(self):
        [started] = self.call(intent("job.start", {"command": py("import time; time.sleep(120)")}))
        job = started["evidence"]["jobId"]
        pids = json.loads((jobs.folder(self.home) / job / "runner.json").read_text())
        if sys.platform == "win32":  # only the runner, not its command
            import subprocess

            subprocess.run(["taskkill", "/F", "/PID", str(pids["runner"])], capture_output=True)
        else:
            os.kill(pids["runner"], signal.SIGKILL)
        time.sleep(0.5)
        self.assertEqual(jobs.status(str(self.home), job)["state"], "lost")
        self.assertEqual(jobs.cancel(str(self.home), job)["state"], "cancelled")
        time.sleep(0.5)
        self.assertFalse(alive(pids["command"]))

    def test_shell_choice_and_unknown_jobs(self):
        other = "cmd" if sys.platform == "win32" else "bash"
        missing = "zsh" if sys.platform == "win32" else "cmd"
        chosen, refused, unknown = self.call(
            intent("shell.run", {"command": "echo picked", "shell": other}),
            intent("shell.run", {"command": "echo picked", "shell": missing}),
            intent("job.status", {"jobId": "0123456789abcdef"}),
        )
        self.assertEqual(chosen["status"], "observed", chosen)
        self.assertIn("picked", chosen["evidence"]["stdout"])
        self.assertEqual(refused["errorCode"], "shell_unavailable")
        self.assertEqual(unknown["errorCode"], "unknown_job")


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


if __name__ == "__main__":
    unittest.main()
