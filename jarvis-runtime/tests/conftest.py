"""Tests never touch the OCADE installed on this computer.

Before this, the suite wrote and deleted the real login entry and, through the shared
single-instance port and the real home's exit token, told the real installed agent to exit.
"""
import os
import socket
import sys
import tempfile
from pathlib import Path

import atexit
import shutil

_home = tempfile.mkdtemp(prefix="ocade-test-home-")
os.environ["OCADE_JARVIS_HOME"] = _home
atexit.register(shutil.rmtree, _home, ignore_errors=True)  # F-179: no home left behind
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import ocade_agent  # noqa: E402

with socket.socket() as probe:  # a port nobody else is using, not the installed agent's
    probe.bind(("127.0.0.1", 0))
    ocade_agent.SINGLE_INSTANCE_PORT = probe.getsockname()[1]
ocade_agent.AUTOSTART_NAME = "OCADE-test"

import unittest  # noqa: E402

# Tests that drive a real screen, mouse, window or Office app run only in the final campaign.
live = unittest.skipUnless(os.environ.get("OCADE_LIVE_TESTS") == "1",
                           "live GUI/Office test: final campaign only (OCADE_LIVE_TESTS=1)")
