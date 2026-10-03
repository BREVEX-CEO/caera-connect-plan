"""Tests never touch the OCADE installed on this computer.

Before this, the suite wrote and deleted the real login entry and, through the shared
single-instance port and the real home's exit token, told the real installed agent to exit.
"""
import os
import socket
import sys
import tempfile
from pathlib import Path

os.environ["OCADE_JARVIS_HOME"] = tempfile.mkdtemp(prefix="ocade-test-home-")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import ocade_agent  # noqa: E402

with socket.socket() as probe:  # a port nobody else is using, not the installed agent's
    probe.bind(("127.0.0.1", 0))
    ocade_agent.SINGLE_INSTANCE_PORT = probe.getsockname()[1]
ocade_agent.AUTOSTART_NAME = "OCADE-test"
