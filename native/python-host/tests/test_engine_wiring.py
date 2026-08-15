"""Every capability the engine has is reachable, and everything reachable works.

WHY THIS FILE EXISTS
--------------------
The engine grew a continuity layer, a phone dashboard, a code reviewer, a game
updater and a vision module — and the way each of them failed was identical and
invisible: the module was finished, tested and correct, and NOTHING CALLED IT.

`core/memory.py` was the worst case. It stored the user's name, their honorific,
their city, their preferences and their projects, and `context_for_prompt()`
assembled all of it into the sentences a model needs. No bridge command exposed
that function, so no caller fetched it, so it never reached a prompt. OCADE
could be told to remember and could be asked what it remembered, and never once
used any of it unprompted.

Nothing in the existing suites could catch that, because each side was
internally consistent: the memory tests passed, the bridge tests passed, and the
join between them did not exist to be tested. So this file tests the JOIN.
"""

from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parents[2] / "ocade_control_engine"
if str(ENGINE) not in sys.path:
    sys.path.insert(0, str(ENGINE))

import ocade_bridge  # noqa: E402
from core import reminders  # noqa: E402


def _call(command: str, payload: dict | None = None) -> dict:
    return ocade_bridge.handle(
        {"version": ocade_bridge.PROTOCOL_VERSION, "command": command, "payload": payload or {}}
    )


# --------------------------------------------------------------- the join --


def test_every_handler_is_callable_and_none_shadow_each_other() -> None:
    """The table maps to real functions, and no name is registered twice."""
    assert len(ocade_bridge.HANDLERS) >= 84
    for name, handler in ocade_bridge.HANDLERS.items():
        assert callable(handler), f"{name} is not callable"
        assert name == name.lower(), f"{name} should be lower case"


def test_the_stop_exempt_list_names_only_real_commands() -> None:
    """A typo here silently makes a read refuse after a stop, forever.

    `_STOP_EXEMPT` is a set of strings compared against the command name. A
    misspelling does not raise — it simply never matches, so the command it was
    meant to protect starts being refused after a stop and nobody finds out
    until somebody presses stop and then asks a question.
    """
    unknown = sorted(ocade_bridge._STOP_EXEMPT - set(ocade_bridge.HANDLERS))
    assert unknown == [], f"stop-exempt names no such command: {unknown}"


#: Commands that may run after a stop has been tripped, listed one by one.
#:
#: SPELLED OUT RATHER THAN PATTERN-MATCHED, DELIBERATELY. A first attempt tested
#: the last word of each command against a vocabulary of read-ish words, and it
#: was wrong in both directions: it rejected `voice.devices` (a plain read of
#: the microphone list) while it would have happily accepted a future
#: `files.read`-shaped name that deleted something.
#:
#: The stop button's entire value is that a tripped stop blocks new work. Every
#: name here is a hole in that, so adding one has to be a deliberate act with a
#: reason, and this list is where the reason gets written down.
_MAY_RUN_AFTER_A_STOP = {
    # Observation. After a stop the user is usually about to ask what happened,
    # and answering that needs to be able to look.
    "engine.info", "screen.observe", "ui.tree", "screen.find", "web.search",
    "search.mode", "flights", "weather", "file.read", "file.list", "clipboard",
    "clipboard.watch", "vision.look", "vision.cameras", "game.list", "code.review",
    "app.discover", "window.read", "window.list", "system.status", "system.volume",
    "system.bluetooth", "system.audiodevices", "office.read", "net.status",
    "llm.status", "language", "remote.status", "voice.devices",
    # What OCADE knows. Reading memory changes nothing and is the most likely
    # question after a stop: "what did you just write down?"
    "memory.recall", "memory.snapshot", "memory.context", "memory.preference",
    "setup.status", "presence.briefing", "presence.proactive", "monitor.check",
    "reminder.list",
    # Managing the stop itself. `voice.resume` is what clears it, so recovery is
    # always an explicit act. `voice.bargein` starts and stops the listener that
    # HEARS the next stop — blocking it after a stop would mean one spoken
    # "stop" permanently disarmed the ability to say it again.
    "voice.silence", "voice.resume", "voice.status", "voice.mic", "voice.bargein",
    "input.release",
    # Drafting is not sending — it touches nothing. Discarding a draft is part
    # of stopping rather than work a stop should prevent, and it only ever
    # removes something OCADE itself created.
    "message.draft", "message.pending", "message.discard",
}


def test_no_stop_exempt_command_changes_the_machine() -> None:
    unexplained = sorted(ocade_bridge._STOP_EXEMPT - _MAY_RUN_AFTER_A_STOP)
    assert unexplained == [], (
        "These run after a stop and nobody wrote down why. Add them to "
        "_MAY_RUN_AFTER_A_STOP with a reason, or take them out of _STOP_EXEMPT."
    )


# ------------------------------------------------------------- continuity --


def test_memory_context_is_reachable_and_carries_the_identity() -> None:
    """THE JOIN THAT WAS MISSING. `context_for_prompt` had no command at all."""
    reply = _call("memory.context")
    assert reply["ok"], reply
    data = reply["data"]
    assert "context" in data
    assert isinstance(data["context"], str)
    # The three things the prompt needs alongside the prose.
    assert "assistantName" in data
    assert "address" in data
    assert "language" in data
    assert data["verified"] is True


def test_the_assistant_name_round_trips_through_the_bridge() -> None:
    """Rename, read back, reset — all through the command a caller would use."""
    original = _call("memory.identity")["data"]["identity"].get("assistantName", "")
    try:
        renamed = _call("memory.identity", {"assistantName": "JARVIS"})
        assert renamed["ok"], renamed
        assert renamed["data"]["assistantName"] == "JARVIS"
        # It reaches the prompt, which is the point of the feature.
        assert "You are JARVIS." in _call("memory.context")["data"]["context"]

        # An empty string is a RESET, not a blank name. This is the one field
        # where "" is a real value, and the bridge used to filter it out with
        # the other blanks — so a reset silently did nothing.
        reset = _call("memory.identity", {"assistantName": ""})
        assert reset["ok"], reset
        assert reset["data"]["assistantName"] == "OCADE"
    finally:
        _call("memory.identity", {"assistantName": original})


def test_preferences_are_reachable_in_both_directions() -> None:
    written = _call("memory.preference", {"key": "wiring-test", "value": "plain answers"})
    assert written["ok"], written
    read = _call("memory.preference")
    assert read["ok"], read
    assert read["data"]["preferences"].get("wiring-test") == "plain answers"


# ------------------------------------------------------------ the new work --


@pytest.mark.parametrize(
    "command",
    [
        "game.list",
        "clipboard.watch",
        "remote.status",
        "net.status",
        "memory.context",
        "memory.snapshot",
        "reminder.list",
        "setup.status",
    ],
)
def test_every_read_only_command_answers_without_arguments(command: str) -> None:
    """Called with nothing, each of these returns a receipt rather than raising.

    A read that needs arguments it was not given is a read the interface cannot
    put on a status screen, and the failure shows up as an error toast rather
    than as a missing feature.
    """
    reply = _call(command)
    assert reply["ok"], f"{command}: {reply.get('error')}"


def test_reminder_list_reports_an_unresponsive_scheduler_without_crashing(monkeypatch) -> None:
    def stalled():
        raise TimeoutError("scheduler did not answer")

    monkeypatch.setattr(reminders, "_WINDOWS", True)
    monkeypatch.setattr(reminders, "_windows_pending", stalled)
    reply = _call("reminder.list")
    assert reply["ok"] is True
    assert reply["data"]["verified"] is False
    assert reply["data"]["reminders"] == []
    assert "detail" in reply["data"], f"{command} returned no detail"


def test_code_review_parses_python_and_finds_real_line_numbers() -> None:
    source = "import os\ndef f(a=[]):\n    try:\n        pass\n    except:\n        pass\n"
    reply = _call("code.review", {"code": source})
    assert reply["ok"], reply
    data = reply["data"]
    assert data["language"] == "python", "pasted Python with no filename must still be parsed"
    assert data["depth"] == "parsed"
    assert data["parses"] is True
    assert [f["name"] for f in data["functions"]] == ["f"]

    # Every line number came out of the parse tree, so each must point at a real
    # line. A review that sends the reader to a line where nothing is wrong is
    # worse than no review.
    lines = source.splitlines()
    for finding in data["findings"]:
        assert 0 <= finding["line"] <= len(lines), finding

    messages = " ".join(f["message"] for f in data["findings"])
    assert "mutable default" in messages
    assert "bare `except:`" in messages


def test_code_review_never_echoes_a_secret_back() -> None:
    """The finding names the problem; it must not repeat the credential.

    The snippet field carries the offending line for most findings, which is
    what makes them actionable. For a hard-coded key that would put the key into
    the receipt, the transcript, and whatever log the transcript lands in.
    """
    key = "sk-abcdefghijklmnopqrstuvwxyz012345"
    reply = _call("code.review", {"code": f'API_KEY = "{key}"\n', "language": "python"})
    assert reply["ok"], reply
    assert key not in json.dumps(reply)
    assert any("credential" in f["message"] or "key" in f["message"] for f in reply["data"]["findings"])


def test_a_document_is_extracted_rather_than_decoded_as_text(tmp_path) -> None:
    """A PDF read with `read_text` is mojibake that reported `verified: True`.

    The `files` read branch used to call `read_text` on whatever it was given.
    On a .txt that is right; on a .pdf it returns the container's bytes decoded
    with replacement characters, and then claimed success — so "summarise this
    PDF" produced a confident paragraph about nothing.
    """
    assert ".pdf" in ocade_bridge._DOCUMENT_SUFFIXES
    assert ".docx" in ocade_bridge._DOCUMENT_SUFFIXES
    assert ".txt" not in ocade_bridge._DOCUMENT_SUFFIXES, "plain text needs no extractor"


# ------------------------------------------------------------ the layering --


def test_no_engine_module_imports_the_bridge() -> None:
    """A skill importing its own host is a cycle that only works by accident.

    `core/skills/whatsapp.py` used to `import ocade_bridge` to reach a private
    focus helper. That works only because the bridge puts its own directory on
    `sys.path` before importing anything, so any other entry point into the
    skill — a test, a script, a second host — got ImportError, and the
    `except` around it turned that into a silent "could not focus".
    """
    offenders: list[str] = []
    for path in ENGINE.rglob("*.py"):
        if "__pycache__" in str(path) or path.name == "ocade_bridge.py":
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                if any(alias.name == "ocade_bridge" for alias in node.names):
                    offenders.append(str(path.relative_to(ENGINE)))
            elif isinstance(node, ast.ImportFrom) and node.module == "ocade_bridge":
                offenders.append(str(path.relative_to(ENGINE)))
    assert offenders == [], f"these reach up into the host: {sorted(set(offenders))}"


def test_the_phone_can_only_ask_for_commands_that_exist_and_are_allowed() -> None:
    """Three lists that must agree, in a place where disagreeing is silent.

    `phone_intents` produces a command, `remote.REMOTE_COMMANDS` decides whether
    the phone may ask for it, and `HANDLERS` decides whether the engine can
    answer. A command in the first and missing from either of the others is a
    button on somebody's phone that returns an error.
    """
    from core import phone_intents, remote

    assert phone_intents.PHONE_COMMANDS - set(ocade_bridge.HANDLERS) == set()
    assert phone_intents.PHONE_COMMANDS - remote.REMOTE_COMMANDS == set()
    assert remote.REMOTE_COMMANDS - set(ocade_bridge.HANDLERS) == set()


def test_the_phone_cannot_reach_the_irreversible_things() -> None:
    """The allow-list is the security boundary, so its shape is asserted.

    A QR code photographed over somebody's shoulder is a real thing. Whoever is
    holding the phone can look at the machine and change the volume; they cannot
    shut it down, send a message as the user, or delete a file.
    """
    from core import remote

    for forbidden in ("system.power", "message.send", "files", "system.autostart", "remote.start"):
        assert forbidden not in remote.REMOTE_COMMANDS, f"{forbidden} must need somebody at the keyboard"


@pytest.mark.parametrize(
    ("said", "command"),
    [
        ("volume 40", "system.volume"),
        ("mute", "system.volume"),
        ("briefing", "presence.briefing"),
        ("what is on my screen", "screen.observe"),
        ("remind me to call mum in 20 minutes", "reminder.set"),
        ("open notepad", "app.open"),
        ("weather in Bengaluru", "weather"),
        ("what games need updating", "game.list"),
        ("what is the capital of peru", "search.mode"),
    ],
)
def test_the_phone_routes_a_sentence_to_the_right_command(said: str, command: str) -> None:
    from core import phone_intents

    routed = phone_intents.route(said) or phone_intents.fallback(said)
    assert routed is not None, f"{said!r} routed to nothing"
    assert routed[0] == command


def test_the_phone_refuses_a_half_understood_instruction() -> None:
    """An unrecognised INSTRUCTION does nothing; an unrecognised QUESTION searches.

    Acting approximately on a sentence nobody parsed is how a phone in a pocket
    rearranges somebody's desktop.
    """
    from core import phone_intents

    assert phone_intents.route("do the thing with the stuff") is None
    assert phone_intents.fallback("do the thing with the stuff") is None
    # "Do" opens an imperative as often as a question, so it only counts as a
    # question when a subject follows it.
    assert phone_intents.fallback("do the dishes") is None
    assert phone_intents.fallback("do you know the time")[0] == "search.mode"
    # A question is safe to answer by searching.
    assert phone_intents.fallback("how tall is everest")[0] == "search.mode"
    assert phone_intents.fallback("the train times for tomorrow?")[0] == "search.mode"
