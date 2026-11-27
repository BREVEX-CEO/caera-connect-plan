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
from unittest import mock

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

    def test_native_exit_codes_and_later_shell_results_are_preserved(self):
        (self.root / "fail.py").write_text("raise SystemExit(3)\n")
        (self.root / "ok.py").write_text("print('native success')\n")
        python = f'& "{sys.executable}"' if WINDOWS else f'"{sys.executable}"'
        shell_error = "Write-Error 'shell failure'" if WINDOWS else "false"
        shell_success = "Write-Output 'shell success'" if WINDOWS else "echo 'shell success'"
        native, error, success = self.run_steps(
            {"command": f"{python} fail.py"},
            {"command": f"{python} ok.py; {shell_error}"},
            {"command": f"{python} fail.py; {shell_success}"},
        )
        self.assertEqual(native["evidence"]["exitCode"], 3, native)
        self.assertNotEqual(error["evidence"]["exitCode"], 0, error)
        self.assertEqual(success["evidence"]["exitCode"], 0, success)
        self.assertIn("shell success", success["evidence"]["stdout"])

    def test_commands_run_in_the_workspace_and_report_honestly(self):
        with mock.patch.dict(os.environ, {"OCADE_TEST_SECRET": "do-not-leak"}):
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

    def test_no_account_secret_reaches_a_command_whatever_it_is_called(self):
        """SHELL-003 for every kind of secret the companion's own environment can hold."""
        names = (
            "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GITHUB_TOKEN",
            "AWS_SECRET_ACCESS_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OCADE_DEVICE_PRIVATE_KEY",
            "DATABASE_URL", "MY_PASSWORD", "SESSION_COOKIE",
        )
        canaries = {name: f"canary-{name.lower()}-{os.urandom(6).hex()}" for name in names}
        with mock.patch.dict(os.environ, canaries):
            dump = (
                "Get-ChildItem Env: | ForEach-Object { $_.Name + '=' + $_.Value }" if WINDOWS else "env"
            )
            [result] = self.run_steps({"command": dump})
        self.assertEqual(result["evidence"]["exitCode"], 0, result)
        shown = result["evidence"]["stdout"]
        self.assertIn("OCADE_WORKSPACE", shown, "the dump must be the command's real environment")
        for name, value in canaries.items():
            self.assertNotIn(value, shown, f"{name}'s value reached the command")
            self.assertNotIn(name, shown, f"{name} reached the command")

    def test_a_proxy_login_reaches_only_the_browser_worker(self):
        """HTTPS_PROXY may be http://user:password@host: commands see the address, never the login."""
        from ocade_agent.gateway import without_proxy_login

        with self.subTest("the address without its login"):
            for given, wanted in (
                ("http://user:p%40ss@proxy.example:8080", "http://proxy.example:8080"),
                ("http://user@proxy.example", "http://proxy.example"),
                ("http://[::1]:3128", "http://[::1]:3128"),
                ("http://user:pw@[::1]:3128/path?q=1", "http://[::1]:3128/path?q=1"),
                ("http://127.0.0.1:43747", "http://127.0.0.1:43747"),
                ("http://:pw@", ""),
            ):
                self.assertEqual(without_proxy_login(given), wanted, given)
        secret = "proxy-canary-" + os.urandom(6).hex()
        with mock.patch.dict(os.environ, {"HTTPS_PROXY": f"http://person:{secret}@127.0.0.1:9"}):
            gateway = Gateway(str(self.root))
            commands = gateway._parameters("ocade_agent.command_worker").env
            browser = gateway._parameters("ocade_agent.web_worker").env
            [result] = self.run_steps({"command": "env" if not WINDOWS else
                                       "Get-ChildItem Env: | ForEach-Object { $_.Name + '=' + $_.Value }"})
        self.assertEqual(commands["HTTPS_PROXY"], "http://127.0.0.1:9")
        self.assertIn(secret, browser["HTTPS_PROXY"], "the browser worker keeps the login it needs")
        self.assertIn("HTTPS_PROXY=http://127.0.0.1:9", result["evidence"]["stdout"])
        self.assertNotIn(secret, result["evidence"]["stdout"])

    def test_no_worker_is_started_with_an_account_secret(self):
        """secrets_isolation for every worker the gateway starts, not only the command worker."""
        from ocade_agent.gateway import WORKERS

        names = ("SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY", "GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY",
                 "OCADE_DEVICE_PRIVATE_KEY", "DATABASE_URL", "MY_PASSWORD", "SESSION_COOKIE")
        canaries = {name: f"canary-{name.lower()}-{os.urandom(6).hex()}" for name in names}
        with mock.patch.dict(os.environ, canaries):
            gateway = Gateway(str(self.root))
            for module in sorted(set(WORKERS.values())):
                shown = " ".join(f"{k}={v}" for k, v in gateway._parameters(module).env.items())
                for name, value in canaries.items():
                    self.assertNotIn(name, shown, f"{name} reached {module}")
                    self.assertNotIn(value, shown, f"{name}'s value reached {module}")

    @unittest.skipUnless(WINDOWS, "needs a Windows desktop")
    def test_commands_and_jobs_hold_no_privileges(self):
        [privileges, groups] = self.run_steps({"command": "whoami /priv /fo csv"}, {"command": "whoami /groups /fo csv"})
        held = {row.split(",")[0].strip('"') for row in privileges["evidence"]["stdout"].splitlines()[1:] if row}
        self.assertEqual(held, {"SeChangeNotifyPrivilege"}, privileges)
        # Group membership is unchanged by design (sandbox.run_restricted); recorded as evidence.
        print("OCADE_RESTRICTED_GROUPS:", [row for row in groups["evidence"]["stdout"].splitlines()
                                           if "S-1-5-32-544" in row])

    @unittest.skipIf(WINDOWS, "a process that leaves its group is a POSIX case (Windows uses a job object)")
    def test_a_program_that_left_the_command_group_ends_with_a_timed_out_command(self):
        import psutil

        marker = self.root / "escaped.pid"
        script = f"setsid sh -c 'echo $$ > {marker}; exec sleep 300' >/dev/null 2>&1 < /dev/null & sleep 300"
        [result] = self.run_steps({"command": script, "timeoutSeconds": 2})
        self.assertTrue(result["evidence"]["timedOut"], result)
        pid = int(marker.read_text())
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and psutil.pid_exists(pid) and psutil.Process(pid).status() != psutil.STATUS_ZOMBIE:
            time.sleep(0.1)
        alive = psutil.pid_exists(pid) and psutil.Process(pid).status() != psutil.STATUS_ZOMBIE
        if alive:
            psutil.Process(pid).kill()
        self.assertFalse(alive, "a program that left the command's process group outlived the timeout")

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
