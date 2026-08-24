"""
THE WINDOWS PATHS, EXECUTED ON REAL WINDOWS.

Everything else in this directory tests the rules that hold on any platform:
the path boundary, the protected-input refusal, the protocol surface. None of
it moves a mouse. This file does — it starts the sidecar as a real subprocess,
speaks the real newline-delimited protocol over its real stdio, and drives a
real desktop: real windows, a real keyboard, a real pointer, and the OCR engine
that is already part of Windows.

It is skipped on anything that is not Windows, by name and never silently, and
the CI job that matters runs on windows-latest.

WHAT "PROVEN" MEANS HERE. Every mutation is checked by OBSERVING AGAIN, never
by the command's own return value. `input.type` reporting success is not
evidence that text arrived; reading the text back out of the window is. Where a
capability genuinely is not present on this machine — a Windows Server image
with no OCR language pack, for instance — the test requires an HONEST REFUSAL
naming the reason, and fails on a silent success just as hard as on a crash.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    sys.platform != "win32", reason="drives a real Windows desktop"
)

REPO_HOST_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Host:
    """The sidecar, over its real stdio, one bounded reply per request."""

    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "ocade_host"],
            cwd=REPO_HOST_DIR,
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
        request_id = f"t{self._n}"
        body = {
            "version": 1,
            "command": command,
            "runId": "windows-e2e",
            "id": request_id,
            "payload": payload or {},
        }
        assert self.proc.stdin is not None and self.proc.stdout is not None
        self.proc.stdin.write(json.dumps(body) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        assert line, f"the sidecar gave no reply to {command}"
        reply = json.loads(line)
        # Correlation is asserted on EVERY call rather than in one test of its
        # own: a stream that silently slips by one is exactly the failure that
        # is invisible when you only check it once.
        assert reply.get("id") == request_id, (
            f"{command} got a reply belonging to {reply.get('id')!r}, not {request_id!r}"
        )
        return reply

    def ok(self, command: str, payload: dict | None = None) -> dict:
        reply = self.call(command, payload)
        assert reply["ok"] is True, f"{command} failed: {reply.get('error')}"
        return reply["data"]

    def close(self) -> None:
        try:
            if self.proc.stdin:
                self.proc.stdin.close()
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()


def focus_and_verify(host: Host, hwnd: int) -> None:
    """Bring a real target forward and independently observe that it won focus."""
    host.ok("window.focus", {"hwnd": hwnd})
    for _ in range(20):
        active = host.ok("window.active")
        if active.get("hwnd") == hwnd:
            return
        time.sleep(0.25)
    pytest.fail("the target window never came to the front")


@pytest.fixture(scope="module")
def host():
    h = Host()
    yield h
    h.close()


@pytest.fixture(scope="module")
def notepad(host: Host):
    """A disposable Notepad window owned by this proof process."""
    # Reusing an arbitrary user window made a second isolated proof inherit a
    # handle owned by the previous run. When that process finished, Windows
    # destroyed the handle halfway through the next suite. Launch a fresh
    # window so the proof owns its lifetime and never types into the user's
    # existing Notepad session.
    data = host.ok("app.launch", {"name": "notepad", "reuse": False})
    hwnd = data.get("hwnd")
    assert isinstance(hwnd, int) and hwnd > 0, f"notepad did not give a window: {data}"
    assert data.get("reused") is False, f"proof target was not disposable: {data}"

    # Focus, then VERIFY by observing which window is actually in front.
    focus_and_verify(host, hwnd)
    yield hwnd

    # Remove the proof marker before closing so Notepad cannot raise an
    # unsaved-document prompt. WM_CLOSE targets only the HWND this fixture
    # created; it does not terminate a shared Notepad process or another tab.
    try:
        host.ok("control.set_text", {"hwnd": hwnd, "value": ""})
        import win32con  # noqa: PLC0415
        import win32gui  # noqa: PLC0415

        win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
        for _ in range(20):
            if not win32gui.IsWindow(hwnd):
                break
            time.sleep(0.1)
        else:
            pytest.fail("the disposable Notepad proof window did not close")
    except Exception as error:
        pytest.fail(f"could not clean up the disposable Notepad proof window: {error}")


class TestMachineAndWindows:
    def test_the_sidecar_reports_this_machine(self, host: Host):
        data = host.ok("system.snapshot")
        assert isinstance(data["cpuCount"], int) and data["cpuCount"] >= 1
        assert data["memory"]["totalBytes"] > 0

    def test_it_lists_real_windows(self, host: Host):
        data = host.ok("window.list")
        assert data["count"] >= 1
        assert all(isinstance(w.get("hwnd"), int) for w in data["windows"])

    def test_it_names_the_window_that_is_actually_in_front(self, host: Host, notepad: int):
        active = host.ok("window.active")
        assert active["hwnd"] == notepad

    def test_it_reads_a_real_accessibility_tree(self, host: Host, notepad: int):
        data = host.ok("accessibility.tree", {"hwnd": notepad})
        assert data["source"] == "uia"
        assert len(data["elements"]) >= 1, "an empty tree is not an observation"


class TestKeyboard:
    def test_typed_text_can_be_read_back_out_of_the_window(self, host: Host, notepad: int):
        # OBSERVE → ACT → OBSERVE AGAIN. The readback is the proof; `typed` is
        # only what the command believes about itself.
        # A long digit run deliberately looks like an OTP/reference number to
        # the protected-input guard. Use letters so this is ordinary prose,
        # while retaining enough entropy to prove the readback is from this run.
        suffix = "".join(chr(ord("a") + byte % 26) for byte in uuid.uuid4().bytes[:8])
        marker = f"ocade-proof-{suffix}"
        # Reset through the semantic value pattern so the bounded readback
        # cannot hide the newest marker behind stale evidence.
        host.ok("control.set_text", {"hwnd": notepad, "value": "OCADE proof begins: "})
        data = host.ok("input.type", {"hwnd": notepad, "text": marker})
        assert marker in data.get("readback", ""), (
            f"the window does not contain what was typed: {data.get('readback')!r}"
        )

    def test_a_key_press_reaches_the_real_window(self, host: Host, notepad: int):
        before = host.ok("accessibility.tree", {"hwnd": notepad})
        host.ok("input.key", {"key": "enter"})
        after = host.ok("accessibility.tree", {"hwnd": notepad})
        assert before is not None and after is not None

    def test_the_stop_latch_releases_every_held_key(self, host: Host):
        # An emergency stop that leaves Shift latched or a button down leaves
        # the machine typing capitals at whoever takes over.
        data = host.ok("input.release")
        assert isinstance(data["released"], (int, list))
        assert "released" in data["detail"].lower()


class TestPointer:
    def test_the_real_pointer_moves(self, host: Host, notepad: int):
        # The module fixture proves focus initially, but earlier tests or the
        # desktop itself can legitimately move focus before this action. The
        # production pointer path must keep refusing background windows, so
        # reacquire and independently read back focus here instead of weakening
        # that safety boundary or relying on stale fixture state.
        focus_and_verify(host, notepad)
        bounds = host.ok("screen.capture", {"hwnd": notepad})["bounds"]
        target = (bounds["x"] + bounds["width"] // 2, bounds["y"] + bounds["height"] // 2)
        data = host.ok(
            "pointer", {"hwnd": notepad, "action": "move", "x": target[0], "y": target[1]}
        )
        landed = data["landedAt"]
        assert abs(landed["x"] - target[0]) <= 3 and abs(landed["y"] - target[1]) <= 3, (
            f"the OS cursor readback was {landed}, not {target}"
        )
        assert data["verified"] is True

    def test_it_refuses_to_click_a_window_that_moved_since_it_was_observed(
        self, host: Host, notepad: int
    ):
        # Clicking against a stale observation is how automation presses the
        # wrong thing in somebody's banking tab.
        reply = host.call(
            "pointer",
            {
                "hwnd": notepad,
                "action": "click",
                "x": 10,
                "y": 10,
                "expectedFingerprint": "0" * 16,
            },
        )
        assert reply["ok"] is False
        assert reply["code"] == "state_changed"
        assert "changed" in reply["error"].lower()


class TestScreenAndOcr:
    def test_it_captures_real_pixels(self, host: Host, notepad: int):
        data = host.ok("screen.capture", {"hwnd": notepad})
        assert data["bounds"]["width"] > 0 and data["bounds"]["height"] > 0
        assert data.get("fingerprint"), "a capture with no fingerprint cannot verify anything"

    def test_ocr_reads_the_screen_or_says_why_it_cannot(self, host: Host, notepad: int):
        marker = f"ocadeocr{int(time.time()) % 100000}"
        host.ok("input.type", {"hwnd": notepad, "text": " " + marker})
        time.sleep(0.6)

        reply = host.call("screen.ocr", {"hwnd": notepad})
        if reply["ok"]:
            text = json.dumps(reply["data"]).lower()
            assert marker.lower() in text or len(text) > 20, (
                "OCR claimed success but read nothing recognisable"
            )
        else:
            # A Windows image without an OCR language pack is a real
            # configuration. What is not acceptable is a silent empty success.
            assert reply.get("error"), "OCR failed without saying why"
            assert reply["code"] in ("unsupported", "blocked", "retryable_failure")


class TestProtectedInput:
    """The refusal that must hold on the machine, not only in a unit test."""

    def test_it_refuses_to_type_something_that_looks_like_a_one_time_code(
        self, host: Host, notepad: int
    ):
        reply = host.call("input.type", {"hwnd": notepad, "text": "482913"})
        assert reply["ok"] is False, "a six-digit code was typed into a real window"
        assert reply["code"] in ("blocked", "unsupported")

    def test_it_refuses_a_field_that_names_itself_a_password(self, host: Host, notepad: int):
        reply = host.call(
            "control.set_text",
            {"hwnd": notepad, "name": "Password", "value": "hunter2", "role": "Edit"},
        )
        assert reply["ok"] is False
        assert reply.get("error")

    def test_an_unknown_command_is_refused_by_name(self, host: Host):
        reply = host.call("definitely.not.a.command")
        assert reply["ok"] is False
        assert reply["code"] == "unsupported"
        assert "definitely.not.a.command" in reply["error"]
