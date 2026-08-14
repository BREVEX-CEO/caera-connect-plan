"""What OCADE still knows tomorrow.

THE DIFFERENCE BETWEEN A TOOL AND A PRESENCE IS THIS FILE.
----------------------------------------------------------
A tool starts from nothing every time you open it. A presence remembers that
you are building OCADE, that you asked about WhatsApp yesterday, that your name
is Haans and that you like being told things plainly. None of that is
intelligence — it is a JSON file that survives the process, read at the start of
a session and written at the end.

FOUR KINDS OF MEMORY, KEPT APART ON PURPOSE
--------------------------------------------
  identity    — who the user is and what the assistant is called. Small, hand
                edited, never expires.
  preferences — how they like things done. Also small, also permanent.
  projects    — what they are working on. Long-lived but not forever; a project
                nobody has mentioned in a month is not current context.
  sessions    — one or two sentences about each conversation. CONSUMED after
                use: a briefing that repeats yesterday's recap every morning
                for a week is worse than no recap at all.

The split matters because they expire differently. Collapsing them into one
"memory" blob means either the identity rots or the session summaries pile up
until the briefing is unreadable.

WHY A FILE AND NOT A DATABASE
------------------------------
It has to be inspectable and deletable by the person it is about. `memory.json`
in the user's own OCADE folder can be opened in Notepad, read, edited and
thrown away. That is a property worth more than query performance for a store
that holds a few hundred short strings.

NOTHING SENSITIVE IS WRITTEN. `remember` refuses anything that looks like a
credential, for the same reason the messaging path does: a memory file is
forever and a password in it is a password on disk in plain text.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

#: The user's own folder, not the install directory. OCADE may be reinstalled
#: or moved; what it knows about somebody should survive that.
MEMORY_DIR = Path.home() / ".ocade"
MEMORY_FILE = MEMORY_DIR / "memory.json"

#: A project nobody has mentioned in this long is history, not context.
PROJECT_TTL_DAYS = 45

#: Session summaries are consumed when used. This is only a backstop for
#: summaries nobody ever collected — an assistant that was not opened for a
#: fortnight should not open with a two-week backlog.
SESSION_TTL_DAYS = 14

_MAX_TEXT = 2_000
_MAX_ITEMS = 200

#: The same shapes the messaging gate refuses. A memory file is permanent and
#: readable; a one-time code in it outlives its usefulness by years.
_SECRET = re.compile(
    r"\b(?:password|passcode|passphrase|otp|one[- ]?time[- ]?code|cvv|cvc|pin|"
    r"api[_ ]?key|secret|token|seed phrase|private key)\b|\b\d{12,}\b",
    re.IGNORECASE,
)

_DEFAULT: dict[str, Any] = {
    "version": 1,
    #: `assistantName` is stored and empty by default; empty means DEFAULT_NAME.
    #: Storing "" rather than "OCADE" is what makes "reset it to the default" a
    #: real operation and keeps a rename from freezing the shipped name into
    #: every user's file forever.
    "identity": {"userName": "", "gender": "", "city": "", "language": "", "assistantName": ""},
    "preferences": {},
    "projects": [],
    "sessions": [],
    "monitors": [],
    "facts": [],
}


#: What the assistant is called when nobody has said otherwise.
#:
#: THE PRODUCT IS OCADE AND THE NAME IS WHAT USERS ARE GIVEN. What changed is
#: that they may now change it — "JARVIS" is the thing half the people who want
#: this product actually want to say — and the shape below is what keeps a
#: rename from turning the name into a placeholder:
#:
#:   * the DEFAULT is a constant, so an untouched install has an identity;
#:   * the OVERRIDE is stored empty, so clearing it returns to that identity;
#:   * every string that greets, logs or prompts calls `assistant_name()`,
#:     never the constant, so one rename reaches all of them on the next turn
#:     with no restart and no cache to invalidate.
DEFAULT_ASSISTANT_NAME = "OCADE"

#: Kept as a module attribute because the rest of the engine and its tests
#: refer to it. It is the DEFAULT, not the current name — read
#: `assistant_name()` for that.
ASSISTANT_NAME = DEFAULT_ASSISTANT_NAME

#: A name has to be sayable by the speech engine and short enough to open a
#: sentence with. Longer than this is a sentence, not a name.
_MAX_ASSISTANT_NAME = 32


def assistant_name() -> str:
    """What the assistant is called right now.

    Read from the file on every call rather than cached, which is the whole
    mechanism behind "takes effect on the very next turn": there is no copy of
    this anywhere to go stale.
    """
    stored = _clean(load()["identity"].get("assistantName"), _MAX_ASSISTANT_NAME)
    return stored or DEFAULT_ASSISTANT_NAME

#: How the user is addressed. "Sir" and "Mam" are the two the product uses;
#: anything else, including declining to say, gets no honorific at all rather
#: than a guess.
_HONORIFICS = {"male": "Sir", "female": "Mam"}


class MemoryRefused(RuntimeError):
    """Something will not be written, with a reason the user can act on."""


def _now() -> float:
    return time.time()


def _days(seconds: float) -> float:
    return seconds / 86_400.0


def load() -> dict[str, Any]:
    """The whole store, with missing keys filled in rather than crashing.

    A memory file the user hand-edited into invalid JSON must not stop OCADE
    from starting. It is renamed aside and a fresh one begins, because losing
    context is recoverable and refusing to boot is not.
    """
    if not MEMORY_FILE.is_file():
        return json.loads(json.dumps(_DEFAULT))
    try:
        raw = json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        try:
            MEMORY_FILE.rename(MEMORY_FILE.with_suffix(".broken.json"))
        except OSError:  # noqa: S110
            pass
        return json.loads(json.dumps(_DEFAULT))
    if not isinstance(raw, dict):
        return json.loads(json.dumps(_DEFAULT))
    merged = json.loads(json.dumps(_DEFAULT))
    for key, value in raw.items():
        if key in merged and isinstance(value, type(merged[key])):
            merged[key] = value
    # MIGRATION, RUN ON EVERY LOAD BECAUSE IT IS CHEAP AND IDEMPOTENT.
    #
    # A dict read wholesale from an older file has no `gender` key, so the
    # honorific silently never applies on an existing install; and one written
    # while the assistant name was fixed has no `assistantName`. Both are
    # reconciled here rather than left for the user to notice.
    for field in ("userName", "gender", "city", "language", "assistantName"):
        merged["identity"].setdefault(field, "")
    return merged


def save(store: dict[str, Any]) -> None:
    """Write atomically, so a crash mid-write cannot leave a truncated file."""
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    temporary = MEMORY_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(store, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(MEMORY_FILE)


def _clean(text: Any, limit: int = _MAX_TEXT) -> str:
    return " ".join(str(text or "").split())[:limit]


def _refuse_secrets(text: str) -> None:
    if _SECRET.search(text):
        raise MemoryRefused(
            "That looks like a password, code or key. OCADE does not write those "
            "to its memory file — it would still be there in plain text next year."
        )


# --------------------------------------------------------------- identity --


def identity() -> dict[str, Any]:
    return load()["identity"]


def honorific(gender: str = "") -> str:
    """"Sir", "Mam", or nothing at all.

    NOTHING IS A REAL ANSWER HERE. A user who has not said, or who said
    something these two words do not cover, is addressed by name or not at all
    — never by a guess. Getting this wrong is a small error repeated in every
    single sentence the assistant speaks, which makes it a large one.
    """
    key = _clean(gender or identity().get("gender"), 20).lower()
    return _HONORIFICS.get(key, "")


def address() -> str:
    """How to open a sentence: "Sir", "Mam", the user's name, or nothing."""
    return honorific() or _clean(identity().get("userName"), 60)


def set_identity(**fields: Any) -> dict[str, Any]:
    """Change who the user is, and what the assistant is called.

    Takes effect immediately because everything reads the file rather than a
    cached copy — telling OCADE your name, or renaming it to JARVIS, changes
    the very next sentence it speaks, with no restart.
    """
    store = load()
    allowed = {"userName", "gender", "city", "language", "assistantName"}
    unknown = set(fields) - allowed
    if unknown:
        raise MemoryRefused(f"Not something OCADE stores about you: {', '.join(sorted(unknown))}.")
    for key, value in fields.items():
        text = _clean(value, 120)
        _refuse_secrets(text)
        if key == "assistantName":
            # A NAME, NOT A SENTENCE. This string is spoken aloud, prepended to
            # the model's system prompt and shown in the interface, so a
            # paragraph pasted in here would be read out at every greeting and
            # would eat the prompt budget on every single turn.
            text = text[:_MAX_ASSISTANT_NAME].strip()
            if text and not any(character.isalnum() for character in text):
                raise MemoryRefused("An assistant name needs at least one letter or number.")
        if key == "gender":
            normalised = text.lower()
            # Mapped to the two the honorific covers; anything else is stored
            # as given and simply yields no honorific.
            if normalised in ("m", "man", "male", "he", "him", "sir"):
                text = "male"
            elif normalised in ("f", "woman", "female", "she", "her", "mam", "ma'am", "madam"):
                text = "female"
            else:
                text = normalised
        store["identity"][key] = text
    save(store)
    said = address()
    # Read back through `assistant_name()` rather than echoing what was passed
    # in: a cleared name has to report the default, and an over-long one has to
    # report what was actually stored.
    called = assistant_name()
    renamed = "assistantName" in fields
    return {
        "identity": store["identity"],
        "assistantName": called,
        "assistantRenamed": renamed,
        "honorific": honorific(),
        "verified": True,
        "detail": (
            f"From now on the assistant is called {called}."
            if renamed
            else (
                f"{called} will address you as {said}."
                if said
                else f"{called} has nothing to call you yet."
            )
        ),
    }


def needs_setup() -> dict[str, Any]:
    """Is this a first run that should ask who the user is?

    Asked ONCE, at the start, because an assistant that says "Sir" to somebody
    who is not one — or says nothing to somebody who wanted it — is wrong in
    every sentence until it is told. Two questions is a cheap way to never be
    wrong again.
    """
    who = identity()
    called = assistant_name()
    missing = [field for field in ("userName", "gender") if not who.get(field)]
    return {
        "needed": bool(missing),
        "missing": missing,
        "assistantName": called,
        "questions": {
            "userName": f"What should {called} call you?",
            "gender": f"And should {called} address you as Sir or Mam?",
        },
        "verified": True,
        "detail": (
            f"{called} still needs to know: {', '.join(missing)}."
            if missing
            else f"{called} knows who you are — {address()}."
        ),
    }


# ------------------------------------------------------------ preferences --


def set_preference(key: str, value: Any) -> dict[str, Any]:
    store = load()
    name = _clean(key, 60).lower()
    if not name:
        raise MemoryRefused("A preference needs a name.")
    text = _clean(value, 400)
    _refuse_secrets(text)
    store["preferences"][name] = text
    save(store)
    return {"preference": name, "value": text, "verified": True, "detail": f"Noted: {name}."}


def preferences() -> dict[str, Any]:
    return load()["preferences"]


# --------------------------------------------------------------- projects --


def note_project(name: str, note: str = "") -> dict[str, Any]:
    """Record, or touch, something the user is working on.

    Touching matters as much as recording: a project mentioned today is current
    whether or not anything new was said about it, and `last` is what keeps it
    out of the expiry sweep.
    """
    store = load()
    label = _clean(name, 120)
    if not label:
        raise MemoryRefused("A project needs a name.")
    text = _clean(note, 600)
    _refuse_secrets(f"{label} {text}")

    for project in store["projects"]:
        if project.get("name", "").lower() == label.lower():
            project["last"] = _now()
            if text:
                project["notes"] = ([*project.get("notes", []), text])[-8:]
            save(store)
            return {"project": label, "verified": True, "detail": f"Updated {label}."}

    store["projects"].append(
        {"name": label, "notes": [text] if text else [], "first": _now(), "last": _now()}
    )
    store["projects"] = store["projects"][-_MAX_ITEMS:]
    save(store)
    return {"project": label, "verified": True, "detail": f"Remembering {label}."}


def projects(active_only: bool = True) -> list[dict[str, Any]]:
    """What the user is working on, most recently touched first."""
    rows = load()["projects"]
    if active_only:
        rows = [p for p in rows if _days(_now() - p.get("last", 0)) <= PROJECT_TTL_DAYS]
    return sorted(rows, key=lambda p: p.get("last", 0), reverse=True)


# --------------------------------------------------------------- sessions --


def summarise_session(summary: str, *, topics: list[str] | None = None) -> dict[str, Any]:
    """Store one or two sentences about a conversation that has just ended."""
    store = load()
    text = _clean(summary, 600)
    if not text:
        raise MemoryRefused("There is nothing to remember about that session.")
    _refuse_secrets(text)
    store["sessions"].append(
        {
            "summary": text,
            "topics": [_clean(t, 60) for t in (topics or [])][:8],
            "at": _now(),
            "used": False,
        }
    )
    store["sessions"] = store["sessions"][-_MAX_ITEMS:]
    save(store)
    return {"stored": True, "verified": True, "detail": "Session summary saved."}


def take_unused_sessions(limit: int = 3) -> list[dict[str, Any]]:
    """The summaries not yet mentioned, MARKED AS USED as they are handed over.

    Consumed rather than merely read, and that is the whole design. A briefing
    that recaps the same conversation every morning for a week is noise, and it
    teaches the user to stop listening to the part of the briefing that is
    actually new.
    """
    store = load()
    cutoff = _now() - SESSION_TTL_DAYS * 86_400
    fresh = [s for s in store["sessions"] if not s.get("used") and s.get("at", 0) >= cutoff]
    taken = sorted(fresh, key=lambda s: s.get("at", 0), reverse=True)[:limit]
    marked = {id(s) for s in taken}
    for session in store["sessions"]:
        if id(session) in marked:
            session["used"] = True
    # Rebuild by value, because `id()` does not survive the round trip above
    # once the list has been re-read. Matching on timestamp is exact enough:
    # two summaries cannot share a float second in practice.
    stamps = {s.get("at") for s in taken}
    for session in store["sessions"]:
        if session.get("at") in stamps:
            session["used"] = True
    save(store)
    return taken


# ----------------------------------------------------------------- facts --


def remember(fact: str, *, tag: str = "") -> dict[str, Any]:
    """Anything else worth keeping, in the user's own words."""
    store = load()
    text = _clean(fact, 600)
    if not text:
        raise MemoryRefused("There is nothing to remember.")
    _refuse_secrets(text)
    store["facts"].append({"fact": text, "tag": _clean(tag, 40), "at": _now()})
    store["facts"] = store["facts"][-_MAX_ITEMS:]
    save(store)
    return {"remembered": text, "verified": True, "detail": f"Remembered: {text[:80]}"}


def recall(query: str = "", limit: int = 10) -> list[dict[str, Any]]:
    rows = load()["facts"]
    needle = _clean(query, 120).lower()
    if needle:
        rows = [f for f in rows if needle in f.get("fact", "").lower() or needle in f.get("tag", "")]
    return sorted(rows, key=lambda f: f.get("at", 0), reverse=True)[:limit]


def forget(query: str) -> dict[str, Any]:
    """Delete matching facts. The user's memory is theirs to erase."""
    store = load()
    needle = _clean(query, 120).lower()
    if not needle:
        raise MemoryRefused("Say what to forget.")
    before = len(store["facts"])
    store["facts"] = [f for f in store["facts"] if needle not in f.get("fact", "").lower()]
    removed = before - len(store["facts"])
    save(store)
    return {"removed": removed, "verified": True, "detail": f"Forgot {removed} thing(s)."}


# -------------------------------------------------------------- monitors --


def watch_topic(topic: str) -> dict[str, Any]:
    """Follow a subject. Checked once a day, never more."""
    store = load()
    label = _clean(topic, 120)
    if not label:
        raise MemoryRefused("There is no topic to watch.")
    if any(m.get("topic", "").lower() == label.lower() for m in store["monitors"]):
        return {"topic": label, "verified": True, "detail": f"Already watching {label}."}
    store["monitors"].append({"topic": label, "since": _now(), "lastChecked": 0, "lastSeen": ""})
    save(store)
    return {"topic": label, "verified": True, "detail": f"Watching {label}."}


def unwatch_topic(topic: str) -> dict[str, Any]:
    store = load()
    label = _clean(topic, 120).lower()
    before = len(store["monitors"])
    store["monitors"] = [m for m in store["monitors"] if m.get("topic", "").lower() != label]
    save(store)
    return {
        "removed": before - len(store["monitors"]),
        "verified": True,
        "detail": f"Stopped watching {topic}.",
    }


def monitors() -> list[dict[str, Any]]:
    return load()["monitors"]


def record_monitor_check(topic: str, headline: str) -> bool:
    """Store what was seen; return True when it is genuinely NEW.

    The comparison is against the last headline for that topic, so the same
    story never interrupts twice — which is the difference between a monitor
    and a nag.
    """
    store = load()
    changed = False
    for monitor in store["monitors"]:
        if monitor.get("topic", "").lower() != _clean(topic, 120).lower():
            continue
        seen = _clean(headline, 400)
        changed = bool(seen) and seen != monitor.get("lastSeen", "")
        monitor["lastChecked"] = _now()
        if changed:
            monitor["lastSeen"] = seen
    save(store)
    return changed


def due_monitors(min_hours: float = 24.0) -> list[dict[str, Any]]:
    """Topics not checked for a day. Nothing is checked more often than that."""
    return [
        m
        for m in load()["monitors"]
        if (_now() - m.get("lastChecked", 0)) >= min_hours * 3_600
    ]


# --------------------------------------------------------------- context --


def context_for_prompt(limit: int = 12) -> str:
    """Everything worth putting in front of the model, as plain sentences.

    Deliberately short. The point of memory is not to hand the model a
    dossier — a 3B model given two thousand words of history answers the
    history instead of the question.
    """
    store = load()
    lines: list[str] = []
    who = store["identity"]
    if who.get("userName"):
        lines.append(f"The user's name is {who['userName']}.")
    lines.append(f"You are {assistant_name()}.")
    said = honorific()
    if said:
        # Put in front of the model so it addresses the user the same way the
        # spoken greeting does — otherwise the voice says "Sir" and the text
        # says nothing, which reads as two different assistants.
        lines.append(f"Address them as {said}.")
    if who.get("city"):
        lines.append(f"They are in {who['city']}.")
    for key, value in list(store["preferences"].items())[:5]:
        lines.append(f"Preference — {key}: {value}")
    for project in projects()[:4]:
        note = project["notes"][-1] if project.get("notes") else ""
        lines.append(f"Project — {project['name']}" + (f": {note}" if note else ""))
    for fact in recall(limit=4):
        lines.append(f"Remembered — {fact['fact']}")
    return "\n".join(lines[:limit])


def snapshot() -> dict[str, Any]:
    """Everything OCADE knows, for the settings screen to show and edit."""
    store = load()
    return {
        "identity": store["identity"],
        # Resolved, so the settings screen can show the name in use without
        # having to know that an empty override means the default.
        "assistantName": assistant_name(),
        "defaultAssistantName": DEFAULT_ASSISTANT_NAME,
        "preferences": store["preferences"],
        "projects": projects(),
        "facts": recall(limit=25),
        "monitors": store["monitors"],
        "sessionsPending": sum(1 for s in store["sessions"] if not s.get("used")),
        "file": str(MEMORY_FILE),
        "verified": True,
        "detail": f"Memory lives at {MEMORY_FILE}.",
    }
