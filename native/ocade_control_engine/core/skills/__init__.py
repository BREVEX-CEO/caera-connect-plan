"""Per-application knowledge, kept OUT of the router and the bridge.

WHY A SKILL DIRECTORY AND NOT MORE ROUTER RULES
-----------------------------------------------
Everything OCADE does universally — UI Automation, the value pattern, window
focus — belongs in `core/uia.py` and knows no application names. That is the
right default and it covers most software.

Some applications need a SEQUENCE that only makes sense for them: File Explorer
has a list of items you double-click, WhatsApp has a search box that filters a
chat list. Encoding those as router regexes puts app knowledge in the one file
whose whole design is not to have any, and encoding them in the bridge makes a
2,000-line file longer every time somebody buys software.

So each application gets a module here, all of them satisfy `Skill`, and the
registry below is the only thing that knows which exist. Adding support for a
new program is a new file and one import — never an edit to the router.

WHAT A SKILL IS STILL NOT ALLOWED TO DO
----------------------------------------
Bypass the ladder. A skill composes `core.uia` calls: it may say "the chat list
is a DataGrid of DataItem rows", because that is a fact about WhatsApp, and it
may not reach for a pixel coordinate because the accessibility tree was
inconvenient. Every skill returns the same receipt shape as everything else,
with `verified` set from re-reading the screen.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Skill(Protocol):
    """What every application module must provide."""

    #: Human name, used in receipts and refusals.
    name: str

    def can_handle(self, app: str) -> bool:
        """Does this skill drive that application?"""
        ...

    def execute(self, command: str, hwnd: int | None, **kwargs: Any) -> dict[str, Any]:
        """Carry out one command against the application, and report it."""
        ...


def registry() -> list[Skill]:
    """Every installed skill, most specific first.

    Imported lazily and defensively: a skill whose dependencies are missing on
    this machine must not stop the others from loading, because a broken
    WhatsApp module is not a reason File Explorer stops working.
    """
    found: list[Skill] = []
    for module_name, attribute in (
        ("core.skills.explorer", "SKILL"),
        ("core.skills.youtube", "SKILL"),
    ):
        try:
            module = __import__(module_name, fromlist=[attribute])
            skill = getattr(module, attribute, None)
            if skill is not None:
                found.append(skill)
        except Exception:  # noqa: BLE001, S112
            continue
    return found


def find_skill(app: str) -> Skill | None:
    """The skill that claims this application, or None for the generic path."""
    for skill in registry():
        try:
            if skill.can_handle(app):
                return skill
        except Exception:  # noqa: BLE001, S112
            continue
    return None
