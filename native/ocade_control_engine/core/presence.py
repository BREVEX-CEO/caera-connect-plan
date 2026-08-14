"""Speaking first: the morning briefing, proactive check-ins, topic watching.

WHAT MAKES THIS DIFFERENT FROM A NOTIFICATION
----------------------------------------------
A notification fires on a timer and says the same thing every time. Everything
here is built so that OCADE only opens its mouth when it has something the user
does not already know, and says it in a way that fits the moment.

Three rules run through the whole file:

  1. NOTHING REPEATS. A session summary is consumed when it is used. A watched
     topic only speaks when the headline actually changed. A proactive line
     rotates through focus areas so the same opener never lands twice.

  2. NOTHING INTERRUPTS TWICE. There is a cooldown, and it is generous —
     twenty minutes, not the five that makes an assistant feel like a manager.

  3. TIME OF DAY CHANGES THE WORDS. "Good morning" at eleven at night is the
     tell that nothing is really paying attention.

WHY THE BRIEFING FETCHES NEWS LAST
-----------------------------------
The greeting, the time and yesterday's recap are local and instant. News needs
the network and can take seconds or fail entirely. Assembling the local parts
first means an offline machine still gets a real briefing with an honest note
about the missing part, rather than an error where a greeting should be.
"""

from __future__ import annotations

import random
import time
from datetime import datetime
from typing import Any

from core import memory

#: How long after speaking before OCADE may speak unprompted again. Ten minutes
#: was tried and read as nagging; twenty is the difference between a colleague
#: and a manager.
PROACTIVE_COOLDOWN_MINUTES = 20.0

#: Focus areas, rotated so two consecutive check-ins are never the same shape.
_FOCUS = ("project", "topic", "recent", "wellbeing")

_LAST_SPOKE: dict[str, float] = {"at": 0.0, "focus": ""}


def part_of_day(now: datetime | None = None) -> str:
    hour = (now or datetime.now()).hour
    if hour < 5:
        return "night"
    if hour < 12:
        return "morning"
    if hour < 17:
        return "afternoon"
    if hour < 21:
        return "evening"
    return "night"


def greeting(now: datetime | None = None) -> str:
    """A greeting that matches the clock and how the user asked to be addressed.

    THE HONORIFIC WINS OVER THE NAME. Somebody who said "Sir" wants "Good
    morning, Sir" — using their first name instead quietly ignores the one
    preference they were explicitly asked for. When they gave no gender the
    name is used, and when they gave neither the greeting simply stands alone
    rather than inventing something.
    """
    part = part_of_day(now)
    opener = {
        "morning": "Good morning",
        "afternoon": "Good afternoon",
        "evening": "Good evening",
        "night": "Still up",
    }[part]
    said = memory.address()
    return f"{opener}, {said}." if said else f"{opener}."


# -------------------------------------------------------------- briefing --


def morning_briefing(*, with_news: bool = True, max_headlines: int = 3) -> dict[str, Any]:
    """Greet, say the time, recap yesterday, then fetch what is new.

    The recap CONSUMES the session summaries it uses, so tomorrow's briefing
    covers tomorrow rather than repeating today's.
    """
    now = datetime.now()
    lines: list[str] = [greeting(now)]
    lines.append(f"It is {now.strftime('%H:%M')} on {now.strftime('%A %d %B')}.")

    recap = memory.take_unused_sessions(limit=2)
    if recap:
        joined = " ".join(s["summary"].rstrip(".") + "." for s in recap)
        lines.append(f"Yesterday you were working on {joined}")

    active = memory.projects()[:2]
    if active:
        names = " and ".join(p["name"] for p in active)
        lines.append(f"Your open work is {names}.")

    headlines: list[dict[str, str]] = []
    news_note = ""
    if with_news:
        try:
            from actions.web_search import search  # noqa: PLC0415

            found = search("top news headlines today", max_results=max_headlines)
            if found["status"] == "online":
                headlines = [
                    {"title": row["title"], "url": row["url"]} for row in found["results"]
                ]
                if headlines:
                    lines.append("Today's headlines: " + "; ".join(h["title"] for h in headlines))
            elif found["status"] == "offline":
                news_note = found["note"]
                lines.append("No network, so no news this morning.")
        except Exception:  # noqa: BLE001
            news_note = "The news could not be fetched."

    text = " ".join(lines)
    return {
        "briefing": text,
        "partOfDay": part_of_day(now),
        "recapUsed": len(recap),
        "headlines": headlines,
        "note": news_note,
        "verified": True,
        "detail": text,
    }


# ------------------------------------------------------------- proactive --


def _cooled_down(minutes: float) -> bool:
    return (time.time() - _LAST_SPOKE["at"]) >= minutes * 60.0


def proactive_line(
    *,
    recent_topics: list[str] | None = None,
    cooldown_minutes: float = PROACTIVE_COOLDOWN_MINUTES,
    force: bool = False,
) -> dict[str, Any]:
    """Something worth saying unprompted, or nothing at all.

    RETURNING NOTHING IS THE COMMON CASE AND THE CORRECT ONE. An assistant that
    always has a line is an assistant nobody leaves running. This speaks when a
    watched topic moved, when a project has gone quiet, or when the
    conversation left a thread open — and otherwise stays shut.
    """
    if not force and not _cooled_down(cooldown_minutes):
        remaining = cooldown_minutes - (time.time() - _LAST_SPOKE["at"]) / 60.0
        return {
            "speak": False,
            "reason": "cooldown",
            "verified": True,
            "detail": f"Nothing to say yet; {remaining:.0f} minute(s) of quiet left.",
        }

    part = part_of_day()
    # Rotate, so the same opener never lands twice running.
    order = [f for f in _FOCUS if f != _LAST_SPOKE["focus"]]
    random.shuffle(order)

    for focus in order:
        line = _line_for(focus, part, recent_topics or [])
        if line:
            _LAST_SPOKE["at"] = time.time()
            _LAST_SPOKE["focus"] = focus
            return {
                "speak": True,
                "focus": focus,
                "partOfDay": part,
                "line": line,
                "verified": True,
                "detail": line,
            }

    return {
        "speak": False,
        "reason": "nothing worth saying",
        "verified": True,
        "detail": "OCADE has nothing useful to add right now.",
    }


def _line_for(focus: str, part: str, recent_topics: list[str]) -> str:
    who = memory.identity()
    name = who.get("userName") or ""

    if focus == "project":
        for project in memory.projects():
            quiet_days = (time.time() - project.get("last", 0)) / 86_400
            if 2 <= quiet_days <= 30:
                return (
                    f"You have not mentioned {project['name']} in "
                    f"{int(quiet_days)} days — is it still moving?"
                )
        return ""

    if focus == "topic":
        due = memory.due_monitors()
        if due:
            return f"I can check {due[0]['topic']} for you — nothing new has been looked at today."
        return ""

    if focus == "recent" and recent_topics:
        return f"Earlier you were on {recent_topics[0]}. Want to pick that back up?"

    if focus == "wellbeing":
        if part == "night":
            return f"It is late{', ' + name if name else ''}. Worth stopping soon?"
        if part == "morning":
            return "What is the first thing worth doing today?"
        return ""

    return ""


# -------------------------------------------------------------- monitors --


def check_monitors(*, limit: int = 3) -> dict[str, Any]:
    """Look for news on watched topics, and report only what CHANGED.

    Checked at most once a day per topic, and a topic whose headline has not
    moved says nothing. Both of those are what keep this from becoming a feed.
    """
    due = memory.due_monitors()[:limit]
    if not due:
        return {
            "checked": 0,
            "changes": [],
            "verified": True,
            "detail": "Nothing is due to be checked.",
        }

    try:
        from actions.web_search import search  # noqa: PLC0415
    except Exception:  # noqa: BLE001
        return {
            "checked": 0,
            "changes": [],
            "verified": False,
            "detail": "The search library is unavailable.",
        }

    changes: list[dict[str, str]] = []
    checked = 0
    for monitor in due:
        topic = monitor["topic"]
        found = search(f"{topic} news", max_results=1)
        if found["status"] == "offline":
            return {
                "checked": checked,
                "changes": changes,
                "offline": True,
                "verified": False,
                "detail": found["note"],
            }
        checked += 1
        if found["status"] != "online" or not found["results"]:
            memory.record_monitor_check(topic, "")
            continue
        headline = found["results"][0]["title"]
        if memory.record_monitor_check(topic, headline):
            changes.append({"topic": topic, "headline": headline, "url": found["results"][0]["url"]})

    return {
        "checked": checked,
        "changes": changes,
        "verified": True,
        "detail": (
            "; ".join(f"{c['topic']}: {c['headline']}" for c in changes)
            if changes
            else f"Checked {checked} topic(s); nothing new."
        ),
    }


# ---------------------------------------------------------------- weather --


def weather(city: str = "") -> dict[str, Any]:
    """Live weather for the user's city, remembered from identity."""
    place = city or memory.identity().get("city") or ""
    if not place:
        return {
            "verified": False,
            "detail": "OCADE does not know which city you are in. Tell it, and it will remember.",
        }
    try:
        from actions.web_search import search  # noqa: PLC0415

        found = search(f"weather in {place} today", max_results=2)
    except Exception as error:  # noqa: BLE001
        return {"verified": False, "detail": f"The weather could not be fetched ({error})."}

    if found["status"] == "offline":
        return {"city": place, "offline": True, "verified": False, "detail": found["note"]}
    if found["status"] != "online" or not found["results"]:
        return {"city": place, "verified": False, "detail": f"No weather found for {place}."}
    top = found["results"][0]
    return {
        "city": place,
        "summary": top["snippet"][:300],
        "source": top["url"],
        "verified": True,
        "detail": f"{place}: {top['snippet'][:200]}",
    }
