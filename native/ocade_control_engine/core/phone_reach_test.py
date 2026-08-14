"""What a paired phone can actually reach.

A phone is lost, lent, and stolen in ways a desktop is not. Everything reachable
from one runs with nobody at the keyboard to see it happen, so the set has to be
small, deliberate, and enforced somewhere a new intent cannot quietly widen it.

These tests exist because the boundary was once real but unenforced: the socket
checked `REMOTE_COMMANDS`, then waved `remote.ask` through to be routed, and the
routed command was looked up in the full `HANDLERS` table without ever meeting
the allow-list again. Nothing dangerous was reachable, but only because no intent
happened to emit anything dangerous.
"""

from __future__ import annotations

import ast
import pathlib
import re

import pytest

from core.remote import REMOTE_COMMANDS

CORE = pathlib.Path(__file__).resolve().parent
INTENTS = CORE / "phone_intents.py"

# `system.volume`, `app.open` — a dotted lower-case identifier and nothing else.
COMMAND_SHAPE = re.compile(r"[a-z]+(?:\.[a-z_]+)+")


def _emitted_commands() -> set[str]:
    """Every command literal `phone_intents` can hand back.

    Parsed rather than executed. Importing and calling the router would only
    reveal the intents a test author thought to phrase, and the whole point is to
    catch the intent somebody adds later without reading this file.
    """
    tree = ast.parse(INTENTS.read_text(encoding="utf-8"))
    found: set[str] = set()
    for node in ast.walk(tree):
        # Intents are RETURNED as three-element `(command, arguments, doing)`
        # tuples. All three conditions matter: a bare `ast.Tuple` anywhere in the
        # file also matches regex alternations like `(?:compare)\s+(.{2,120})$`,
        # which is dotted, lower-case and space-free, and so sailed through a
        # looser check as a command name that does not exist.
        if not isinstance(node, ast.Return) or not isinstance(node.value, ast.Tuple):
            continue
        elements = node.value.elts
        if len(elements) != 3:
            continue
        first = elements[0]
        if isinstance(first, ast.Constant) and isinstance(first.value, str):
            if COMMAND_SHAPE.fullmatch(first.value):
                found.add(first.value)
    return found


def test_the_router_emits_something_at_all() -> None:
    """Guards every other test here from passing on an empty set."""
    assert len(_emitted_commands()) >= 10


def test_phone_reachable_commands_stay_inside_the_allow_list() -> None:
    """The boundary, enforced structurally.

    If this fails, someone added an intent for a command the allow-list does not
    name. The fix is a decision, not a rename: either the command genuinely
    belongs on a phone and goes into `REMOTE_COMMANDS` deliberately, or the
    intent should not exist.
    """
    escaped = sorted(_emitted_commands() - set(REMOTE_COMMANDS))
    assert not escaped, (
        f"these are reachable from a paired phone but are not on the allow-list: {escaped}"
    )


@pytest.mark.parametrize(
    "command",
    ["files", "file.delete", "folder.empty", "input.type", "screen.do", "message.to"],
)
def test_the_dangerous_commands_are_not_on_the_allow_list(command: str) -> None:
    """Deleting files and sending messages need a person present.

    Named explicitly rather than left to the subset check above, because the
    subset check only proves the two sets agree — it would pass just as happily
    if somebody widened the allow-list to include all of them.
    """
    assert command not in REMOTE_COMMANDS


def test_remote_ask_itself_is_not_dispatchable_as_an_intent() -> None:
    """No loops. A routed `remote.ask` would re-enter the router forever."""
    assert "remote.ask" not in _emitted_commands()
