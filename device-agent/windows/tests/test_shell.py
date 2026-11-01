"""SHELL-001…006: a confirmed command through the real gateway and command worker, on this OS.

PowerShell on Windows, /bin/sh elsewhere. The commands are the test's; the product
never chooses or rewrites them. Effects are checked on disk, not taken from the receipt.
"""

import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

import anyio

from ocade_agent.gateway import Gateway
from tests.test_gateway import intent

WINDOWS = sys.platform == "win32"
# A child process that outlives its parent command unless the whole tree is ended.
LATE_WRITE = (
    "Start-Process -WindowStyle Hidden powershell -ArgumentList '-NoProfile','-Command',"
    "'Start-Sleep 4; Set-Content late.txt late'; Start-Sleep 30"
    if WINDOWS else "(sleep 4; echo late > late.txt) & sleep 30"
)


class Shell(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        (self.root / "input.txt").write_text("alpha\nbeta\n")

    def run_steps(self, *steps):
        async def go():
            async with Gateway(str(self.root)) as gateway:
                return [await gateway.run(intent("shell.run", args), gateway.epoch) for args in steps]

        return anyio.run(go)

    def test_commands_run_in_the_workspace_and_report_honestly(self):
        os.environ["OCADE_TEST_SECRET"] = "do-not-leak"
        try:
            if WINDOWS:
                listing, failing, secret, written = self.run_steps(
                    {"command": "(Get-Location).Path; Get-Content input.txt | Measure-Object -Line | % Lines"},
                    {"command": "Write-Error 'broken on purpose'; exit 3"},
                    {"command": "if ($env:OCADE_TEST_SECRET) { 'LEAKED' } else { 'clean' }"},
                    {"command": "Set-Content -Path fixed.txt -Value 'repaired'"},
                )
            else:
                listing, failing, secret, written = self.run_steps(
                    {"command": "pwd; wc -l < input.txt"},
                    {"command": "echo 'broken on purpose' >&2; exit 3"},
                    {"command": "if [ -n \"$OCADE_TEST_SECRET\" ]; then echo LEAKED; else echo clean; fi"},
                    {"command": "echo repaired > fixed.txt"},
                )
        finally:
            os.environ.pop("OCADE_TEST_SECRET")
        with self.subTest("SHELL-001 runs in the workspace folder"):
            self.assertEqual(listing["status"], "observed", listing)
            self.assertEqual(listing["evidence"]["exitCode"], 0)
            lines = listing["evidence"]["stdout"].split()
            self.assertEqual(os.path.realpath(lines[0]), os.path.realpath(self.root))
            self.assertEqual(lines[-1], "2")
        with self.subTest("SHELL-002 a failing command is observed with its exit code, not called success"):
            self.assertEqual((failing["status"], failing["evidence"]["exitCode"]), ("observed", 3))
            self.assertIn("broken on purpose", failing["evidence"]["stderr"])
            self.assertTrue(failing["maybeChanged"])
        with self.subTest("SHELL-003 the device owner's secrets are not in the command's environment"):
            self.assertEqual(secret["evidence"]["stdout"].strip(), "clean")
        with self.subTest("SHELL-004 its effect is real and checked on disk"):
            self.assertEqual((self.root / "fixed.txt").read_text().strip(), "repaired")

    def test_timeout_ends_the_whole_process_tree(self):
        [result] = self.run_steps({"command": LATE_WRITE, "timeoutSeconds": 2})
        self.assertEqual((result["evidence"]["timedOut"], result["evidence"]["exitCode"]), (True, None))
        time.sleep(5)
        self.assertFalse((self.root / "late.txt").exists(), "a child of a timed-out command kept running")

    @unittest.skipIf(WINDOWS, "Start-Process children do not inherit the command's output")
    def test_a_background_child_holding_the_output_does_not_hang_the_call(self):
        started = time.monotonic()
        held, detached = self.run_steps(
            {"command": "(sleep 4; echo late > late.txt) & echo started", "timeoutSeconds": 60},
            {"command": "nohup sh -c 'sleep 1; echo kept > kept.txt' >/dev/null 2>&1 & echo started"},
        )
        self.assertLess(time.monotonic() - started, 20)
        self.assertEqual((held["evidence"]["exitCode"], held["evidence"].get("outputHeldOpen")), (0, True))
        self.assertEqual(detached["evidence"].get("outputHeldOpen"), None)
        time.sleep(5)
        self.assertFalse((self.root / "late.txt").exists())  # ended with its command, as reported
        self.assertTrue((self.root / "kept.txt").exists())  # started detached: left running

    def test_stop_mid_command_ends_the_whole_process_tree(self):
        async def go():
            async with Gateway(str(self.root)) as gateway:
                with anyio.move_on_after(3):  # the person presses STOP while the command runs
                    await gateway.run(intent("shell.run", {"command": LATE_WRITE}), gateway.epoch)
                    return "finished"
                gateway.stop()
                return "stopped"

        started = time.monotonic()
        self.assertEqual(anyio.run(go), "stopped")
        self.assertLess(time.monotonic() - started, 15)
        time.sleep(5)
        self.assertFalse((self.root / "late.txt").exists(), "a command kept running after STOP")


if __name__ == "__main__":
    unittest.main()
