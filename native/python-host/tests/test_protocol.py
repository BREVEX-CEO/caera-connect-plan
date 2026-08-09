"""The sidecar's refusals, tested as behaviour rather than as intent.

These cover the boundary, not the Windows APIs behind it. Enumerating a window
needs a window; refusing a credential does not, and the refusal is the part
that must hold on every machine.
"""

from __future__ import annotations

import io
import json

import pytest

from ocade_host.protocol import (
    MAX_REQUEST_BYTES,
    PROTOCOL_VERSION,
    Refusal,
    bounded_text,
    clamp_text,
    is_protected_text,
    parse,
    safe_id,
    serve,
)


class TestProtectedText:
    @pytest.mark.parametrize(
        "value",
        [
            "my password is hunter2",
            "the OTP is here",
            "card number please",
            "seed phrase",
            "1234",
            "verification code",
        ],
    )
    def test_credential_shapes_are_refused(self, value: str) -> None:
        assert is_protected_text(value) is True

    @pytest.mark.parametrize("value", ["Continue", "Save file", "", "Open the report"])
    def test_ordinary_text_is_allowed(self, value: str) -> None:
        assert is_protected_text(value) is False

    def test_a_short_word_matches_only_as_a_whole_token(self) -> None:
        # "pin" must not fire on "spinning" — a guard that cries wolf on
        # ordinary words is a guard people learn to work around.
        assert is_protected_text("spinning up the service") is False
        assert is_protected_text("enter your pin") is True

    def test_any_long_digit_run_counts(self) -> None:
        # Deliberately broad: a false positive costs a pause, a false negative
        # costs a credential.
        assert is_protected_text("reference 98765") is True


class TestBounds:
    def test_empty_and_oversized_text_is_refused(self) -> None:
        with pytest.raises(Refusal):
            bounded_text("", "value")
        with pytest.raises(Refusal):
            bounded_text("x" * 50, "value", 10)

    def test_non_string_is_refused(self) -> None:
        with pytest.raises(Refusal):
            bounded_text(123, "value")

    def test_identifiers_reject_path_and_shell_shapes(self) -> None:
        assert safe_id("session1", "sessionId") == "session1"
        for bad in ["../etc", "a b", "rm -rf", "", "a" * 400]:
            with pytest.raises(Refusal):
                safe_id(bad, "sessionId")

    def test_clamp_never_exceeds_its_ceiling(self) -> None:
        assert len(clamp_text("x" * 1000, 10)) == 10
        assert clamp_text(None) == ""


class TestParsing:
    def test_a_wrong_protocol_version_is_refused(self) -> None:
        with pytest.raises(Refusal):
            parse(json.dumps({"version": 99, "command": "window.list"}))

    def test_unreadable_json_is_refused_without_a_traceback(self) -> None:
        with pytest.raises(Refusal) as caught:
            parse("{not json")
        assert "readable" in caught.value.message

    def test_an_oversized_request_is_refused_before_it_is_parsed(self) -> None:
        with pytest.raises(Refusal):
            parse("x" * (MAX_REQUEST_BYTES + 10))

    def test_a_missing_payload_becomes_an_empty_object(self) -> None:
        request = parse(json.dumps({"version": PROTOCOL_VERSION, "command": "window.list"}))
        assert request.payload == {}
        assert request.command == "window.list"


class TestServeLoop:
    def _run(self, handlers, lines: list[str]) -> list[dict]:
        sink = io.StringIO()
        serve(handlers, io.StringIO("\n".join(lines) + "\n"), sink)
        return [json.loads(line) for line in sink.getvalue().splitlines() if line.strip()]

    def test_every_request_gets_exactly_one_reply(self) -> None:
        replies = self._run(
            {"ping": lambda _r: {"pong": True}},
            [json.dumps({"version": 1, "command": "ping"})] * 3,
        )
        assert len(replies) == 3
        assert all(reply["ok"] for reply in replies)

    def test_an_unknown_command_is_refused_rather_than_ignored(self) -> None:
        # Silence would strand the caller waiting for a reply that never comes.
        replies = self._run({}, [json.dumps({"version": 1, "command": "launch_missiles"})])
        assert replies[0]["ok"] is False
        assert replies[0]["code"] == "unsupported"

    def test_a_handler_that_raises_does_not_kill_the_host(self) -> None:
        def explode(_request):
            raise RuntimeError("boom")

        replies = self._run(
            {"boom": explode, "ping": lambda _r: {"pong": True}},
            [
                json.dumps({"version": 1, "command": "boom"}),
                json.dumps({"version": 1, "command": "ping"}),
            ],
        )
        assert replies[0]["ok"] is False
        assert replies[1]["ok"] is True

    def test_a_refusal_carries_its_reason(self) -> None:
        def refuse(_request):
            raise Refusal("That control is disabled.", "blocked")

        replies = self._run({"x": refuse}, [json.dumps({"version": 1, "command": "x"})])
        assert replies[0]["code"] == "blocked"
        assert replies[0]["error"] == "That control is disabled."


class TestCommandSurface:
    def test_the_command_table_grants_no_shell(self) -> None:
        from ocade_host.__main__ import HANDLERS

        for name in HANDLERS:
            assert not any(word in name for word in ("shell", "exec", "run", "eval", "command"))

    def test_there_is_no_permanent_delete(self) -> None:
        from ocade_host.__main__ import HANDLERS

        assert not any("delete" in name or "remove" in name for name in HANDLERS)
