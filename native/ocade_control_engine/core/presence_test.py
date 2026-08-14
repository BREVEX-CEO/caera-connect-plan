"""The continuity layer, proven end to end against a real memory file.

    remember -> recall -> forget
    identity -> the assistant answers to a new name immediately
    project -> shows up in context
    session summary -> appears in tomorrow's briefing ONCE, then never again
    watch a topic -> checked at most daily, speaks only when it changed
    proactive -> stays quiet inside the cooldown

Run directly:  python core/presence_test.py
Also importable as a pytest module.

The memory file is redirected to a temporary path, so running this never
touches what OCADE actually knows about the user.
"""

from __future__ import annotations

import sys
import tempfile
import time
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1]
if str(ENGINE) not in sys.path:
    sys.path.insert(0, str(ENGINE))


def _isolate():
    """Point memory at a scratch file. The real one is never opened."""
    from core import memory

    scratch = Path(tempfile.mkdtemp(prefix="ocade-memory-")) / "memory.json"
    memory.MEMORY_DIR = scratch.parent
    memory.MEMORY_FILE = scratch
    return memory


def _rename_round_trip(memory) -> tuple[bool, bool]:
    """Rename the assistant, then clear it. Both halves have to work.

    A rename that cannot be undone is a one-way door: somebody who tries
    "JARVIS" and prefers the original has no way back short of editing JSON.
    So the reset is tested in the same breath as the rename.
    """
    memory.set_identity(assistantName="JARVIS")
    renamed = memory.assistant_name() == "JARVIS"
    memory.set_identity(assistantName="")
    reset = memory.assistant_name() == memory.DEFAULT_ASSISTANT_NAME
    return renamed, reset


def run() -> int:
    memory = _isolate()
    from core import presence

    failures: list[str] = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))
        if not ok:
            failures.append(label)

    print("\n[1] identity, honorific, and the assistant's own name")
    memory.set_identity(userName="Alex", gender="male", city="Bengaluru")
    who = memory.identity()
    check("the user is remembered", who["userName"] == "Alex")
    check("the default name is OCADE", memory.assistant_name() == "OCADE")
    renamed, reset = _rename_round_trip(memory)
    check("it can be renamed", renamed)
    check("and cleared back to the default", reset)
    check("greeting addresses them as Sir", "Sir" in presence.greeting(), presence.greeting())

    print("\n[2] facts: remember, recall, forget")
    memory.remember("OCADE ships as a Tauri desktop app", tag="ocade")
    memory.remember("Prefers plain answers over hedging", tag="style")
    check("recall finds it", len(memory.recall("tauri")) == 1)
    check("forget removes it", memory.forget("tauri")["removed"] == 1)
    check("it is gone", len(memory.recall("tauri")) == 0)

    print("\n[3] credentials are never written to a file that lives forever")
    refused = False
    try:
        memory.remember("my password is hunter2")
    except memory.MemoryRefused:
        refused = True
    check("a password is refused", refused)

    print("\n[4] projects feed the model's context")
    memory.note_project("OCADE", "WhatsApp skill and the continuity layer")
    context = memory.context_for_prompt()
    check("the project reaches the prompt", "OCADE" in context)
    check("so does how to address them", "Sir" in context, context.splitlines()[0] if context else "")

    print("\n[5] a session summary is used ONCE and then never repeats")
    memory.summarise_session("built the WhatsApp skill and got the H group working")
    first = presence.morning_briefing(with_news=False)
    check("the recap appears", "WhatsApp" in first["briefing"], first["briefing"][:110])
    second = presence.morning_briefing(with_news=False)
    check("it does not appear twice", "WhatsApp" not in second["briefing"])
    check("the briefing still greets", "Sir" in second["briefing"])

    print("\n[6] briefing is time-aware")
    check(
        "it names the part of day",
        first["partOfDay"] in ("morning", "afternoon", "evening", "night"),
        first["partOfDay"],
    )
    check("it states the time", ":" in first["briefing"])

    print("\n[7] topic watching")
    memory.watch_topic("local AI models")
    check("the topic is watched", len(memory.monitors()) == 1)
    check("it is due immediately", len(memory.due_monitors()) == 1)
    changed = memory.record_monitor_check("local AI models", "Qwen3 released")
    check("a first headline counts as new", changed)
    again = memory.record_monitor_check("local AI models", "Qwen3 released")
    check("the SAME headline does not interrupt twice", not again)
    check("and it is no longer due today", len(memory.due_monitors()) == 0)

    print("\n[8] proactive stays quiet unless it has something to say")
    forced = presence.proactive_line(recent_topics=["the WhatsApp skill"], force=True)
    check("it can speak when there is something", forced["speak"], forced.get("line", ""))
    quiet = presence.proactive_line(recent_topics=["the WhatsApp skill"])
    check("it respects the cooldown", not quiet["speak"], quiet.get("reason", ""))

    print(f"\n{'ALL CHECKS PASSED' if not failures else 'FAILED: ' + ', '.join(failures)}")
    return 0 if not failures else 1


# ---- pytest ---------------------------------------------------------------

def test_continuity_layer() -> None:
    assert run() == 0


if __name__ == "__main__":
    started = time.monotonic()
    code = run()
    print(f"({round(time.monotonic() - started, 1)}s)")
    raise SystemExit(code)


def test_the_assistant_can_be_renamed_and_reset() -> None:
    """OCADE is the default. The user may change it, and change it back."""
    memory = _isolate()
    from core import presence

    assert memory.DEFAULT_ASSISTANT_NAME == "OCADE"
    assert memory.assistant_name() == "OCADE"

    result = memory.set_identity(assistantName="JARVIS")
    assert result["assistantName"] == "JARVIS"
    assert memory.assistant_name() == "JARVIS"
    # THE POINT OF THE WHOLE FEATURE: it reaches the model on the NEXT turn,
    # with no restart, because the prompt is built from the file every time.
    assert "You are JARVIS." in memory.context_for_prompt()
    # And the spoken setup questions, which are built from the same read.
    assert "JARVIS" in memory.needs_setup()["questions"]["userName"]
    # The greeting keeps working through the rename — it addresses the USER,
    # and renaming the assistant must not disturb that.
    memory.set_identity(userName="Alex", gender="male")
    assert "Sir" in presence.greeting()

    # An empty string is a reset, not a blank name.
    memory.set_identity(assistantName="")
    assert memory.assistant_name() == "OCADE"

    # A name that is only punctuation is refused rather than stored, because
    # it would be spoken aloud at every greeting.
    refused = False
    try:
        memory.set_identity(assistantName="!!!")
    except memory.MemoryRefused:
        refused = True
    assert refused, "a name with no letters or numbers must be refused"


def test_gender_drives_the_honorific() -> None:
    """Sir / Mam, and nothing at all when it was never said."""
    memory = _isolate()
    from core import presence

    # Nothing said yet: no honorific, and setup still wants to ask.
    assert memory.honorific() == ""
    assert "gender" in memory.needs_setup()["missing"]

    memory.set_identity(userName="Alex", gender="male")
    assert memory.honorific() == "Sir"
    assert memory.address() == "Sir"
    assert "Sir" in presence.greeting()
    assert memory.needs_setup()["needed"] is False

    memory.set_identity(gender="female")
    assert memory.honorific() == "Mam"
    assert "Mam" in presence.greeting()

    # THE HONORIFIC BEATS THE NAME. Somebody who asked for "Sir" wants "Sir",
    # not their first name — ignoring it disregards the one preference they
    # were explicitly asked for.
    assert "Alex" not in presence.greeting()


def test_gender_synonyms_are_understood_and_the_rest_are_not_guessed() -> None:
    memory = _isolate()
    for said in ("m", "Male", "he", "sir"):
        memory.set_identity(gender=said)
        assert memory.honorific() == "Sir", said
    for said in ("f", "Female", "she", "madam"):
        memory.set_identity(gender=said)
        assert memory.honorific() == "Mam", said
    # Anything the two words do not cover gets NO honorific rather than a
    # coin flip, and falls back to the name.
    memory.set_identity(userName="Alex", gender="prefer not to say")
    assert memory.honorific() == ""
    assert memory.address() == "Alex"


def test_an_old_memory_file_is_migrated() -> None:
    """An install written before `gender` existed must not lose the honorific."""
    import json

    memory = _isolate()
    memory.MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    memory.MEMORY_FILE.write_text(
        json.dumps(
            {
                "version": 1,
                "identity": {
                    "userName": "Alex",
                    "assistantName": "MARK L",
                    "city": "Bengaluru",
                    "language": "",
                },
            }
        ),
        encoding="utf-8",
    )
    who = memory.identity()
    assert who["gender"] == "", "the new field must exist so the honorific can be set"
    # A name stored by an older build is HONOURED rather than discarded. It was
    # dropped on load while the name was fixed; now that renaming is supported,
    # throwing away the user's own choice on upgrade would be the bug.
    assert who["assistantName"] == "MARK L"
    assert memory.assistant_name() == "MARK L"
    assert who["userName"] == "Alex", "migration must not lose what was there"
