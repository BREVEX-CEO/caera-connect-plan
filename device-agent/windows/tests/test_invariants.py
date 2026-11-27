"""Security invariants of the companion that no other test pins by name (DESKTOP-08, BROWSER-03, BROWSER-08)."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent.parent


def run(code_args: list[str], home: str, **extra) -> subprocess.CompletedProcess:
    # No server, no credential and no proxy in the environment: only the home folder.
    env = {k: v for k, v in os.environ.items() if k.upper() not in ("HTTPS_PROXY", "HTTP_PROXY")}
    env.update({"OCADE_AGENT_HOME": home, "PYTHONPATH": str(PACKAGE_ROOT)})
    return subprocess.run([sys.executable, *code_args], cwd=PACKAGE_ROOT, env=env, capture_output=True,
                          text=True, timeout=60, **extra)


class LocalStop(unittest.TestCase):
    def test_stop_command_fences_the_agent_without_a_server_or_a_model(self):
        """DESKTOP-08: the person's local STOP is a file the agent obeys; creating it needs nothing remote."""
        with tempfile.TemporaryDirectory() as home:
            result = run(["-m", "ocade_agent", "stop"], home)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("STOP", result.stdout)
            self.assertTrue((Path(home) / "STOP").is_file(), "no local STOP flag was written")


class BrowserProfile(unittest.TestCase):
    def test_the_browser_profile_is_this_agents_own_folder_and_loads_no_extensions(self):
        """BROWSER-03 and BROWSER-08: JARVIS uses one dedicated profile under this device's agent home,
        not the person's own browser profile, and never asks the browser to load an extension."""
        with tempfile.TemporaryDirectory() as home:
            shown = run(["-c", "from ocade_agent import web_worker; print(web_worker.PROFILE)"], home)
            self.assertEqual(shown.returncode, 0, shown.stderr)
            profile = Path(shown.stdout.strip().splitlines()[-1])
            self.assertEqual(profile, Path(home) / "browser-profile")
        source = (PACKAGE_ROOT / "ocade_agent" / "web_worker.py").read_text(encoding="utf-8")
        self.assertNotIn("--load-extension", source)
        self.assertNotIn("--disable-extensions-except", source)
        self.assertNotIn("Chrome/User Data", source, "the person's own browser profile must never be named")


if __name__ == "__main__":
    unittest.main()
