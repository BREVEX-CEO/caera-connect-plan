"""The verifier is the only part of the Vision-Action loop that can lie.

Everything else in `vision_action` either works or raises: a screenshot fails
loudly, a missing target raises, a click that misses is still a click. The one
component that can be quietly, dangerously wrong is `text_landed` -- because a
false PASS there is what presses Enter on an empty box, and a false FAIL makes
people switch verification off.

So it is tested directly, on the two hazards in opposite directions, with no
screen involved.

Run:  python core/vision_action_test.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.vision_action import (  # noqa: E402
    RECALL_FLOOR,
    _escape_send_keys,
    text_landed,
)

FAILURES: list[str] = []


def check(name: str, got, want) -> None:
    if got == want:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name}: got {got!r}, wanted {want!r}")
        FAILURES.append(name)


def verdict(expected: str, observed: str) -> bool:
    return text_landed(expected, observed)[0]


print("an empty field never passes")
# THE HAZARD THAT MATTERS MOST. This is the WhatsApp failure exactly: the write
# reported success, the box was empty, and Enter went out anyway.
check("empty read-back", verdict("Hello there friend", ""), False)
check("whitespace read-back", verdict("Hello there friend", "   \n  "), False)
check("placeholder only", verdict("Hello there friend", "Type a message"), False)

print("somebody else's text never passes")
check(
    "unrelated content",
    verdict("Hello there friend", "Search results for pizza near me"),
    False,
)
check(
    "a different message in the box",
    verdict("will you be my new friend", "the quick brown fox jumped over"),
    False,
)

print("a whole screen of unrelated prose never passes")
# THE ONE THAT GOT THROUGH, TAKEN VERBATIM FROM THE FIRST LIVE RUN.
#
# Windows OCR read a Notepad window holding several paragraphs of a different
# document. The typed text was nowhere on that screen, and the original
# character-similarity check returned True at 0.884 -- because it slid a window
# across the observed text and kept the best coincidence it could find. Long
# English always contains one.
LIVE_MISREAD = (
    "_dl *Untitled - Notepad File Edit Format View Help Implement the follou/ing "
    "and create it or modify the codes and clearly make sure it works smcH)th and "
    "fast and connect and route all prol/4rly_ Don't tell me what is not done, and "
    "why you didn't do it i'LRKL is where the assistant stops a tcH)l and"
)
check(
    "long unrelated document",
    verdict("Hello, this is a test message", LIVE_MISREAD),
    False,
)
check(
    "long unrelated document, second phrasing",
    verdict("will you be my new friend I was created for testing", LIVE_MISREAD),
    False,
)

print("the text that IS there passes")
check("exact", verdict("Hello H, I am OCADE", "Hello H, I am OCADE"), True)
check(
    "surrounded by other interface text",
    verdict("Hello H, I am OCADE", "Yesterday  Hello H, I am OCADE  12:04 pm"),
    True,
)
check("case and spacing differ", verdict("Hello  There", "hello there"), True)

print("ordinary OCR noise still passes")
# Windows OCR reads a rendered proportional font: l/I, rn/m and thin
# punctuation are routinely misread. A verifier that fails on this is one
# people turn off, which leaves nothing verifying anything.
check(
    "l read as I",
    verdict("will you be my new friend", "wiII you be my new friend"),
    True,
)
check(
    "dropped punctuation",
    verdict("Hello, I am OCADE - your new friend", "Hello I am OCADE  your new friend"),
    True,
)

print("long text is judged on its opening, not its tail")
# A composer wraps and scrolls, so the end of a long message is genuinely not
# on screen. Demanding it would fail a write that worked.
long_text = "This is a long message about computers " * 6
check("long text, visible head", verdict(long_text, long_text[:70]), True)
check("long text, nothing visible", verdict(long_text, ""), False)

print("a short string is judged by containment only")
# "H" scores well against almost any string, so a ratio is meaningless here
# and containment is the only honest test.
check("short and present", verdict("H", "H  10:27 am"), True)
check("short and absent", verdict("H", "Meta ai"), False)

print("keystroke syntax is escaped, not interpreted")
# pywinauto reads {}()+^%~ as modifiers. Unescaped, "100% (yes)" types as a
# modifier soup instead of as itself.
check("percent", _escape_send_keys("100%"), "100{%}")
check("parentheses", _escape_send_keys("(yes)"), "{(}yes{)}")
check("braces", _escape_send_keys("a{b}"), "a{{}b{}}")
check("plain text untouched", _escape_send_keys("Hello there"), "Hello there")

print(f"\nrecall floor: {RECALL_FLOOR}")
if FAILURES:
    print(f"\n{len(FAILURES)} CHECK(S) FAILED: {', '.join(FAILURES)}")
    raise SystemExit(1)
print("\nALL CHECKS PASSED")
