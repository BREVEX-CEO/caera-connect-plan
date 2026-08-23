"""
THE SIDECAR, AS A REAL SUBPROCESS, ON WHATEVER PLATFORM THIS IS.

test_windows_control_e2e.py drives a real desktop and therefore only runs on
Windows. That leaves its PLUMBING — starting the process, framing requests,
correlating replies — executed nowhere else, so a mistake in the harness itself
would only be discovered on the one machine that is hardest to get at.

This file runs the same driver everywhere. It cannot move a mouse, and does not
pretend to. What it does prove, on any platform:

  * the sidecar starts and speaks the protocol over real stdio;
  * every reply carries the id of the request that asked for it;
  * a command the platform cannot perform is refused HONESTLY — with the
    `unsupported` code and a sentence naming what is missing, never a raw
    exception and never `retryable_failure`, which would tell an agent loop to
    retry forever something that cannot succeed until a package is installed;
  * the protected-input refusal holds here too, since it is not platform
    specific and there is no reason to test it only on Windows.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

import pytest

HOST_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Commands that need a real Windows desktop or an optional package. On a machine
# that has neither, each must REFUSE rather than crash — that refusal is the
# behaviour under test here.
PLATFORM_COMMANDS = [
    ("window.list", {}),
    ("window.active", {}),
    ("accessibility.tree", {"hwnd": 1}),
    ("screen.capture", {"hwnd": 1}),
    ("screen.ocr", {"hwnd": 1}),
    ("window.focus", {"hwnd": 1}),
    ("pointer", {"action": "move", "x": 1, "y": 1}),
    ("input.key", {"key": "enter"}),
]


class Sidecar:
    """The same driver shape the Windows suite uses, over real stdio."""

    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "ocade_host"],
            cwd=HOST_DIR,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )
        self._n = 0

    def call(self, command: str, payload: dict | None = None) -> dict:
        self._n += 1
        request_id = f"p{self._n}"
        assert self.proc.stdin is not None and self.proc.stdout is not None
        self.proc.stdin.write(
            json.dumps(
                {
                    "version": 1,
                    "command": command,
                    "runId": "protocol-e2e",
                    "id": request_id,
                    "payload": payload or {},
                }
            )
            + "\n"
        )
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        assert line, f"the sidecar gave no reply to {command}"
        reply = json.loads(line)
        assert reply.get("id") == request_id, (
            f"{command} got a reply belonging to {reply.get('id')!r}, not {request_id!r}"
        )
        return reply

    def close(self) -> None:
        try:
            if self.proc.stdin:
                self.proc.stdin.close()
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()


@pytest.fixture(scope="module")
def sidecar():
    s = Sidecar()
    yield s
    s.close()


class TestTheSidecarSpeaksItsProtocol:
    def test_it_starts_and_answers(self, sidecar: Sidecar):
        reply = sidecar.call("system.snapshot")
        assert reply["ok"] is True
        assert reply["data"]["cpuCount"] >= 1

    def test_every_reply_is_correlated(self, sidecar: Sidecar):
        # `call` asserts this on every request; doing it across a batch proves
        # the stream does not slip by one partway through.
        for command in ("system.snapshot", "system.snapshot", "system.snapshot"):
            assert sidecar.call(command)["ok"] is True

    def test_an_unknown_command_is_refused_by_name(self, sidecar: Sidecar):
        reply = sidecar.call("definitely.not.a.command")
        assert reply["ok"] is False
        assert reply["code"] == "unsupported"
        assert "definitely.not.a.command" in reply["error"]

    def test_a_malformed_line_does_not_kill_the_host(self, sidecar: Sidecar):
        assert sidecar.proc.stdin is not None and sidecar.proc.stdout is not None
        sidecar.proc.stdin.write("this is not json\n")
        sidecar.proc.stdin.flush()
        reply = json.loads(sidecar.proc.stdout.readline())
        assert reply["ok"] is False
        # And the host is still answering afterwards.
        assert sidecar.call("system.snapshot")["ok"] is True


class TestHonestUnavailability:
    """
    What a machine that cannot do something is required to say.

    This is the rule the whole sidecar is built around: unsupported features are
    implemented or honestly unavailable, never silently wrong and never
    disguised as a transient failure.
    """

    @pytest.mark.parametrize("command,payload", PLATFORM_COMMANDS)
    def test_it_refuses_or_succeeds_but_never_leaks_an_exception(
        self, sidecar: Sidecar, command: str, payload: dict
    ):
        reply = sidecar.call(command, payload)
        if reply["ok"]:
            return  # This machine really can do it. Nothing to refuse.

        assert reply.get("error"), f"{command} failed without saying why"
        # A bare Python exception name is not an explanation.
        assert not reply["error"].startswith(
            ("ModuleNotFoundError:", "ImportError:", "AttributeError:", "KeyError:")
        ), f"{command} leaked a raw exception: {reply['error']}"

    @pytest.mark.skipif(
        sys.platform == "win32", reason="on Windows these are expected to work, not to refuse"
    )
    @pytest.mark.parametrize("command,payload", PLATFORM_COMMANDS)
    def test_off_windows_it_says_unsupported_rather_than_retryable(
        self, sidecar: Sidecar, command: str, payload: dict
    ):
        # `retryable_failure` tells an agent loop to try again. A missing
        # platform or a missing package will not be there on the second attempt,
        # so that code would produce an infinite retry.
        reply = sidecar.call(command, payload)
        assert reply["ok"] is False
        assert reply["code"] == "unsupported", (
            f"{command} answered {reply['code']!r}: {reply.get('error')}"
        )
        assert reply["error"].endswith("."), "a refusal should read as a sentence"


class TestProtectedInputIsNotPlatformSpecific:
    def test_it_refuses_a_one_time_code(self, sidecar: Sidecar):
        reply = sidecar.call("input.type", {"hwnd": 1, "text": "482913"})
        assert reply["ok"] is False
        assert reply["code"] == "blocked"

    def test_it_refuses_a_field_named_password(self, sidecar: Sidecar):
        reply = sidecar.call(
            "control.set_text", {"hwnd": 1, "name": "Password", "value": "hunter2", "role": "Edit"}
        )
        assert reply["ok"] is False
        assert reply["code"] == "blocked"
        assert "field" in reply["error"].lower()
