"""The control engine's bridge, tested at the boundary OCADE depends on.

Each case below is a failure that happened during the live integration, or a
rule the integration depends on holding. They are tests rather than comments
because every one of them is invisible until it is wrong, and by then it is
wrong on somebody's real computer.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parents[2] / "ocade_control_engine"
BRIDGE = ENGINE / "ocade_bridge.py"

pytestmark = pytest.mark.skipif(not BRIDGE.is_file(), reason="control engine is not installed")


def _load():
    spec = importlib.util.spec_from_file_location("ocade_bridge", BRIDGE)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


bridge = _load()


class TestArgumentsAreNeverGuessed:
    """An absent argument is refused, never treated as an empty one.

    The whole family of "opened a blank search / typed nothing and said it had"
    bugs starts here.
    """

    @pytest.mark.parametrize("value", ["", "   ", None, 42, []])
    def test_a_missing_required_argument_is_refused(self, value) -> None:
        with pytest.raises(bridge.Refusal):
            bridge.need_text(value, "name")

    def test_a_real_value_is_trimmed_and_kept(self) -> None:
        assert bridge.need_text("  notepad  ", "name") == "notepad"

    def test_an_over_long_value_is_refused_rather_than_truncated(self) -> None:
        with pytest.raises(bridge.Refusal):
            bridge.need_text("x" * 50, "name", limit=10)


class TestCredentialsAreNeverTyped:
    @pytest.mark.parametrize(
        "text",
        [
            "my password is hunter2",
            "the OTP is 123456",
            "card number 4111111111111111",
            "seed phrase",
            "verification code",
        ],
    )
    def test_protected_shapes_are_detected(self, text: str) -> None:
        assert bridge.is_protected_text(text) is True

    def test_ordinary_text_is_not(self) -> None:
        assert bridge.is_protected_text("open the quarterly report") is False

    def test_typing_a_credential_is_refused_before_anything_happens(self) -> None:
        with pytest.raises(bridge.Refusal) as caught:
            bridge.type_text({"text": "my password is hunter2"})
        assert caught.value.code == "blocked"


class TestTheKeyboardVocabularyIsClosed:
    """`computer_control` will send any key it is handed. This will not."""

    def test_a_key_outside_the_set_is_refused(self) -> None:
        with pytest.raises(bridge.Refusal) as caught:
            bridge.press_key({"key": "printscreen"})
        assert caught.value.code == "unsupported"

    def test_the_windows_modifier_is_not_in_the_vocabulary(self) -> None:
        # Win+R is a command line one keystroke away.
        with pytest.raises(bridge.Refusal) as caught:
            bridge.press_key({"key": "r", "modifiers": ["win"]})
        assert caught.value.code == "unsupported"

    def test_alt_f4_is_refused_by_name(self) -> None:
        with pytest.raises(bridge.Refusal) as caught:
            bridge.press_key({"key": "f4", "modifiers": ["alt"]})
        assert caught.value.code == "blocked"

    def test_a_key_with_no_name_is_refused(self) -> None:
        with pytest.raises(bridge.Refusal):
            bridge.press_key({})


class TestPointerInputStaysInsideItsWindow:
    def test_an_unsupported_pointer_action_is_refused(self) -> None:
        with pytest.raises(bridge.Refusal) as caught:
            bridge.mouse({"action": "triple_click", "x": 1, "y": 1})
        assert caught.value.code == "unsupported"

    def test_a_pointer_action_without_coordinates_is_refused(self) -> None:
        with pytest.raises(bridge.Refusal):
            bridge.mouse({"action": "click"})


class TestWindowLayoutIsAClosedSet:
    def test_an_invented_layout_is_refused(self) -> None:
        with pytest.raises(bridge.Refusal) as caught:
            bridge.window_arrange({"layout": "diagonally"})
        assert caught.value.code == "unsupported"


class TestTheProtocol:
    def test_an_unknown_command_is_named_rather_than_attempted(self) -> None:
        reply = bridge.handle({"version": 1, "command": "shell.execute", "payload": {}})
        assert reply["ok"] is False
        assert reply["code"] == "unsupported"

    def test_a_wrong_protocol_version_is_refused(self) -> None:
        reply = bridge.handle({"version": 99, "command": "engine.info"})
        assert reply["ok"] is False

    def test_a_refusal_carries_a_code_and_a_sentence(self) -> None:
        reply = bridge.handle(
            {"version": 1, "command": "input.type", "payload": {"text": "my password is x"}}
        )
        assert reply["ok"] is False
        assert reply["code"] == "blocked"
        assert "password" in reply["error"].lower()

    def test_every_command_ocade_calls_is_registered(self) -> None:
        # A command OCADE's adapters reach for that is missing here is an
        # integration that silently falls back to the old executor forever.
        for command in (
            "engine.info",
            "app.open",
            "app.focus",
            "input.type",
            "input.key",
            "input.mouse",
            "input.release",
            "window.read",
            "window.list",
            "window.arrange",
            "files",
            "workspace",
            "screen.observe",
            "system.status",
        ):
            assert command in bridge.HANDLERS, command


class TestTheWorkspaceIsOneFolder:
    """Every path resolves inside OCADE's own folder or is refused."""

    def test_a_relative_escape_is_refused_rather_than_clamped(self) -> None:
        with pytest.raises(bridge.Refusal) as caught:
            bridge.workspace({"action": "write", "name": "../escaped.txt", "content": "no"})
        assert caught.value.code == "blocked"

    def test_an_absolute_path_is_refused(self) -> None:
        with pytest.raises(bridge.Refusal):
            bridge.workspace({"action": "write", "name": "C:/Windows/x.txt", "content": "no"})

    @pytest.mark.parametrize("name", ["run.bat", "go.ps1", "thing.exe", "x.vbs"])
    def test_files_the_system_would_run_are_refused(self, name: str) -> None:
        with pytest.raises(bridge.Refusal) as caught:
            bridge.workspace({"action": "write", "name": name, "content": "echo"})
        assert caught.value.code == "blocked"

    def test_a_credential_is_never_written_to_disk(self) -> None:
        with pytest.raises(bridge.Refusal):
            bridge.workspace({"action": "write", "name": "n.txt", "content": "my password is x"})

    def test_write_read_move_are_each_verified_against_the_filesystem(self) -> None:
        written = bridge.workspace(
            {"action": "write", "name": "regression.txt", "content": "verified by readback"}
        )
        assert written["verified"] is True
        assert bridge.workspace({"action": "read", "name": "regression.txt"})["content"] == (
            "verified by readback"
        )
        moved = bridge.workspace(
            {"action": "move", "from": "regression.txt", "to": "regression-moved.txt"}
        )
        assert moved["verified"] is True

    def test_reading_a_file_that_is_not_there_says_so(self) -> None:
        with pytest.raises(bridge.Refusal) as caught:
            bridge.workspace({"action": "read", "name": "definitely-absent.txt"})
        assert caught.value.code == "state_changed"

    def test_an_unsupported_action_is_refused(self) -> None:
        with pytest.raises(bridge.Refusal):
            bridge.workspace({"action": "shred", "name": "x.txt"})


class TestTheProtocolChannelStaysClean:
    """The engine's own `print()` output must never reach stdout.

    FOUND LIVE: `open_app` prints `[open_app] Launching: 'notepad' → ...`. That
    line would be read by OCADE as a malformed reply and desynchronise every
    request/response pair after it — and the `→` crashed outright on a piped
    cp1252 stdout, so the launch "failed" while succeeding.
    """

    def test_stdout_carries_only_json_even_when_the_engine_narrates(self) -> None:
        python = Path(sys.executable)
        proc = subprocess.run(
            [str(python), str(BRIDGE)],
            input='{"version":1,"command":"engine.info","payload":{}}\n',
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=180,
            cwd=str(ENGINE),
        )
        lines = [line for line in proc.stdout.splitlines() if line.strip()]
        assert lines, proc.stderr[-400:]
        for line in lines:
            # Every single line must parse. One stray print breaks the session.
            json.loads(line)
