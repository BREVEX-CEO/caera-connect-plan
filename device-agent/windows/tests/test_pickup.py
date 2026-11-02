"""While a task runs, the device asks again promptly; only an idle device backs off (D8)."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import anyio

from ocade_agent import agent as agent_module
from ocade_agent.agent import Agent
from ocade_agent.journal import Journal


class Planning:
    """The server is still planning for three polls, then the task finishes."""

    def __init__(self, polls_while_planning):
        self.left = polls_while_planning
        self.home = Path(tempfile.mkdtemp())

    def request(self, payload):
        if payload["op"] != "claim":
            return 200, {}
        self.left -= 1
        status = "running" if self.left >= 0 else "completed"
        return 200, {"task": {"id": "t", "status": status}, "action": None}


class Pickup(unittest.TestCase):
    def waits(self, device, until_idle):
        slept = []

        async def sleep(seconds):
            slept.append(seconds)
            if len(slept) > 12:
                raise KeyboardInterrupt  # an idle device would wait forever; the test needs a few
        home = Path(tempfile.mkdtemp())
        with patch.object(agent_module.anyio, "sleep", sleep), \
                patch.object(agent_module.discovery, "installed_apps", lambda: []), \
                patch.object(agent_module.discovery, "engines", lambda: []):
            from types import SimpleNamespace
            runner = Agent(device, Journal(home / "journal.sqlite"), SimpleNamespace(external={}))
            runner.stop_flag = home / "STOP"
            try:
                anyio.run(runner.run, until_idle)
            except KeyboardInterrupt:
                pass
        return slept

    def test_a_running_task_is_polled_without_backoff(self):
        slept = self.waits(Planning(polls_while_planning=6), until_idle=True)
        self.assertEqual(len(slept), 6)
        self.assertTrue(all(seconds <= agent_module.ACTIVE_POLL_SECONDS + 0.25 for seconds in slept), slept)

    def test_an_idle_device_backs_off_but_never_beyond_the_cap(self):
        slept = self.waits(Planning(polls_while_planning=0), until_idle=False)
        self.assertGreater(slept[-1], slept[0])
        self.assertTrue(all(seconds <= agent_module.IDLE_POLL_CAP + 1 for seconds in slept), slept)


if __name__ == "__main__":
    unittest.main()
