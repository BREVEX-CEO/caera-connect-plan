"""What a sentence typed on the phone means, in bridge commands.

WHY THIS EXISTS WHEN THERE IS ALREADY A ROUTER
-----------------------------------------------
OCADE's deterministic router lives in TypeScript and speaks TOOL names —
`system_volume`, `app_open`, `screen_observe` — because that is the vocabulary
the agent loop and the model share. The phone talks to the Python engine
directly over HTTP and never touches Node, so it speaks BRIDGE commands:
`system.volume`, `app.open`, `screen.observe`.

Two vocabularies is a real difference, not a duplication, and pretending
otherwise was the alternative: routing the phone through Node would mean the
desktop app has to be running and focused for a phone command to work, which
defeats the point of having a phone in the first place.

WHAT KEEPS THE TWO FROM DRIFTING
---------------------------------
This table is deliberately SMALL and it does not try to be the other router. It
covers the things somebody actually reaches for their phone to do — check the
machine, change the volume, get the briefing, set a reminder, ask a question —
and everything it does not recognise becomes a web search rather than a guess.
There is no branch here that invents an argument, and no rule that fires on a
partial match.

THE FALLBACK IS A SEARCH, NOT A REFUSAL
----------------------------------------
"what is the capital of peru" typed on a phone should answer, not say "OCADE did
not understand". Anything unmatched that looks like a question goes to
`search.mode`; anything unmatched that does not is refused plainly, because
acting on a half-understood instruction is how a phone ends up shutting a
computer down.
"""

from __future__ import annotations

import re
from typing import Any

#: The commands this table can produce. Every one is also in
#: `core.remote.REMOTE_COMMANDS` — the allow-list is what actually enforces the
#: boundary, and this set exists so a test can prove the two agree.
PHONE_COMMANDS = frozenset(
    {
        "system.status",
        "system.volume",
        "system.brightness",
        "system.media",
        "window.list",
        "window.arrange",
        "screen.observe",
        "presence.briefing",
        "presence.proactive",
        "monitor.check",
        "monitor.watch",
        "weather",
        "memory.snapshot",
        "memory.recall",
        "memory.remember",
        "reminder.list",
        "reminder.set",
        "app.open",
        "app.focus",
        "folder.open",
        "voice.speak",
        "voice.silence",
        "clipboard",
        "game.list",
        "search.mode",
        "web.search",
    }
)


def _clean(text: str) -> str:
    return " ".join((text or "").strip().split())


def _requires(value: str | None) -> str | None:
    """A captured argument, or None. Never an empty string.

    The same rule the TypeScript router learned the hard way: an absent
    argument treated as an empty one is how a blank search gets run and
    reported as a success.
    """
    if not value:
        return None
    cleaned = _clean(value).strip("\"'“”.,!?")
    return cleaned if cleaned and any(ch.isalnum() for ch in cleaned) else None


#: Folder names the phone may open, mapped to the shell folders the bridge
#: accepts. A closed set, exactly as on the desktop — the phone cannot compose
#: a path any more than the model can.
_FOLDERS = {
    "downloads": "Downloads",
    "documents": "Personal",
    "desktop": "Desktop",
    "pictures": "My Pictures",
    "photos": "My Pictures",
    "videos": "My Video",
    "music": "My Music",
}


def route(text: str) -> tuple[str, dict[str, Any], str] | None:
    """One sentence to (command, payload, what OCADE is doing).

    Returns None when the sentence is not an instruction this table covers; the
    caller decides whether that becomes a search or a refusal.
    """
    said = _clean(text)
    if not said:
        return None
    lower = said.lower()

    # -- stop, first and matched tightly ------------------------------------
    if re.fullmatch(r"(stop|silence|be quiet|shut up|quiet)\.?", lower):
        return "voice.silence", {}, "Stopping."

    # -- volume --------------------------------------------------------------
    level = re.fullmatch(r"(?:set\s+)?(?:the\s+)?(?:volume|sound)\s*(?:to|at|=)?\s*(\d{1,3})\s*%?", lower)
    if level and int(level.group(1)) <= 100:
        return "system.volume", {"action": "set", "level": int(level.group(1))}, f"Volume to {level.group(1)}%."
    if re.fullmatch(r"(mute|silence the (?:sound|audio|volume))\.?", lower):
        return "system.volume", {"action": "mute"}, "Muting."
    if re.fullmatch(r"unmute\.?", lower):
        return "system.volume", {"action": "unmute"}, "Unmuting."
    if re.search(r"\b(?:volume|sound)\s+up\b|\blouder\b", lower):
        return "system.volume", {"action": "step", "by": 10}, "Turning it up."
    if re.search(r"\b(?:volume|sound)\s+down\b|\bquieter\b", lower):
        return "system.volume", {"action": "step", "by": -10}, "Turning it down."

    # -- brightness ----------------------------------------------------------
    bright = re.fullmatch(r"(?:set\s+)?(?:the\s+)?brightness\s*(?:to|at|=)?\s*(\d{1,3})\s*%?", lower)
    if bright and int(bright.group(1)) <= 100:
        return (
            "system.brightness",
            {"action": "set", "percent": int(bright.group(1))},
            f"Brightness to {bright.group(1)}%.",
        )
    if re.fullmatch(r"(?:what(?:'?s| is) the )?brightness\??", lower):
        return "system.brightness", {"action": "get"}, "Reading the brightness."

    # -- media ---------------------------------------------------------------
    media = re.fullmatch(
        r"(?:(play|pause|resume|stop|next|skip|previous|back)\b)(?:\s+(?:the\s+)?(?:music|video|song|track|media|it))?\.?",
        lower,
    )
    if media:
        verb = media.group(1)
        action = {
            "play": "playpause",
            "pause": "playpause",
            "resume": "playpause",
            "stop": "stop",
            "next": "next",
            "skip": "next",
            "previous": "previous",
            "back": "previous",
        }[verb]
        return "system.media", {"action": action}, f"{verb.title()}."

    # -- observation ---------------------------------------------------------
    if re.search(r"\b(?:system status|how is (?:my|the) (?:pc|computer)|cpu|memory|ram|battery|disk space)\b", lower):
        return "system.status", {}, "Reading the computer."
    if re.search(r"\bon (?:my|the) screen\b|\bwhat (?:do|can) you see\b|\bread (?:my|the) screen\b", lower):
        return "screen.observe", {}, "Looking at the screen."
    if re.search(r"\b(?:open )?windows\b|\bwhat(?:'?s| is) open\b", lower) and re.search(
        r"\b(?:list|what|which|show)\b", lower
    ):
        return "window.list", {}, "Reading the open windows."
    if re.search(r"\bwhat(?:'?s| is) (?:on )?(?:my |the )?clipboard\b|\bclipboard\b", lower):
        return "clipboard", {}, "Reading the clipboard."
    # `updat` rather than `update`: "what games need UPDATING" is the way people
    # actually ask, and an exact-word match missed every one of them.
    if re.search(r"\bgames?\b", lower) and re.search(r"\b(?:updat\w*|installed|list|check)\b", lower):
        return "game.list", {}, "Checking your games."

    # -- continuity ----------------------------------------------------------
    if re.search(r"\bbriefing\b|\bcatch me up\b|\bgood morning\b|\bwhat did i do\b", lower):
        return "presence.briefing", {}, "Your briefing."
    if re.search(r"\banything (?:new|for me)\b|\bcheck (?:my )?topics\b|\bany news\b", lower):
        return "monitor.check", {}, "Checking your topics."
    if re.search(r"\bweather\b|\bforecast\b|\brain(?:ing)?\b|\btemperature outside\b", lower):
        city = _requires(re.search(r"\b(?:in|for|at)\s+([\w' -]{2,40})$", said, re.I).group(1)) if re.search(r"\b(?:in|for|at)\s+([\w' -]{2,40})$", said, re.I) else None
        return "weather", ({"city": city} if city else {}), "Checking the weather."
    if re.search(r"\bwhat do you (?:know|remember)\b|\byour memory\b", lower):
        return "memory.snapshot", {}, "What OCADE remembers."

    watch = re.search(r"\b(?:watch|follow|keep an eye on|track)\s+(.{2,80})$", said, re.I)
    if watch:
        topic = _requires(watch.group(1))
        if topic:
            return "monitor.watch", {"topic": topic}, f"Watching {topic}."

    remember = re.search(r"\bremember\s+(?:that\s+)?(.{3,300})$", said, re.I)
    if remember:
        fact = _requires(remember.group(1))
        if fact:
            return "memory.remember", {"fact": fact}, "Noted."

    # -- reminders -----------------------------------------------------------
    if re.search(r"\b(?:my )?reminders\b", lower) and re.search(r"\b(?:list|what|show)\b", lower):
        return "reminder.list", {}, "Your reminders."
    reminder = re.search(
        r"\bremind me (?:to\s+)?(.+?)\s+(in\s+\d{1,4}\s*\w+|at\s+\d{1,2}[:.]\d{2}\s*(?:am|pm)?|tomorrow\s+(?:at\s+)?\d{1,2}[:.]\d{2}\s*(?:am|pm)?)\.?$",
        said,
        re.I,
    )
    if reminder:
        message = _requires(reminder.group(1))
        when = _requires(reminder.group(2))
        if message and when:
            return "reminder.set", {"message": message, "when": when}, f"Reminder: {message}."

    # -- doing things --------------------------------------------------------
    folder = re.fullmatch(r"(?:open|show|go to)\s+(?:my\s+|the\s+)?(\w+)(?:\s+folder)?\.?", lower)
    if folder and folder.group(1) in _FOLDERS:
        return "folder.open", {"folder": _FOLDERS[folder.group(1)]}, f"Opening {folder.group(1)}."

    launch = re.fullmatch(r"(?:open|launch|start|run)\s+([\w.+ -]{2,40})\.?", said, re.I)
    if launch:
        name = _requires(launch.group(1))
        # A name, not a sentence — the same shape guard the desktop router
        # uses, because "open the file I mentioned earlier" is not an app.
        if name and len(name.split()) <= 3:
            return "app.open", {"name": name}, f"Opening {name}."

    focus = re.fullmatch(r"(?:switch to|focus|bring up|go to)\s+([\w.+ -]{2,40})\.?", said, re.I)
    if focus:
        name = _requires(focus.group(1))
        if name and len(name.split()) <= 3:
            return "app.focus", {"name": name}, f"Switching to {name}."

    arrange = re.search(r"\b(maximi[sz]e|left half|right half|cent(?:re|er))\b.*\bwindow\b|\bwindow\b.*\b(maximi[sz]e|left half|right half|cent(?:re|er))\b", lower)
    if arrange:
        word = (arrange.group(1) or arrange.group(2) or "").lower()
        layout = (
            "left" if word.startswith("left")
            else "right" if word.startswith("right")
            else "centre" if word.startswith("cent")
            else "maximise"
        )
        return "window.arrange", {"layout": layout}, "Moving the window."

    say = re.search(r"\b(?:say|speak|announce|tell them)\s+(.{2,300})$", said, re.I)
    if say:
        words = _requires(say.group(1))
        if words:
            return "voice.speak", {"text": words}, "Speaking."

    # -- searching -----------------------------------------------------------
    for pattern, mode in (
        (r"\b(?:news (?:about|on)|latest on)\s+(.{2,120})$", "news"),
        (r"\b(?:price of|how much is|cost of)\s+(.{2,120})$", "price"),
        (r"\b(?:compare)\s+(.{2,120})$", "compare"),
        (r"\b(?:research|study on|evidence for)\s+(.{2,120})$", "research"),
        (r"^(?:search|google|look up|find)\s+(?:for\s+)?(.{2,120})$", "search"),
    ):
        found = re.search(pattern, said, re.I)
        if found:
            query = _requires(found.group(1))
            if query:
                return "search.mode", {"query": query, "mode": mode}, f"Searching for “{query}”."

    return None


#: A sentence that is plainly a question, and so is safe to answer by searching
#: rather than refusing.
#:
#: THE AUXILIARIES NEEDED A SECOND WORD, AND WITHOUT ONE THIS OVER-MATCHED.
#: A flat list of openers put `do` in the same bucket as `what`, so "do the
#: thing with the stuff" — an imperative nobody parsed — was classified as a
#: question and silently web-searched. That is the failure this whole fallback
#: exists to avoid, arriving through the fallback itself.
#:
#: A wh-word opens a question on its own. An auxiliary only does when a subject
#: follows it ("do YOU know", "can I") or when the sentence ends in a question
#: mark. "Do the thing" has neither.
_QUESTION = re.compile(
    r"^(?:what|who|whom|whose|when|where|why|how|which)\b"
    r"|^(?:is|are|was|were|does|do|did|can|could|should|would|will|has|have|am)\s+"
    r"(?:i|you|we|they|he|she|it|there|that|this|my|your|the\s+\w+\s+(?:is|are))\b"
    r"|\?\s*$",
    re.I,
)


def fallback(text: str) -> tuple[str, dict[str, Any], str] | None:
    """What to do with a sentence the table did not recognise.

    A question gets answered from the web. Anything else gets nothing, because
    an unrecognised INSTRUCTION acted on approximately is how a phone in a
    pocket rearranges somebody's desktop.
    """
    said = _clean(text)
    if not said or not _QUESTION.search(said):
        return None
    return "search.mode", {"query": said, "mode": "search"}, "Looking that up."
