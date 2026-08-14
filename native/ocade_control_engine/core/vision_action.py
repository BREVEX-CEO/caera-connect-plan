"""The Vision-Action loop: look, act, look again, and only then commit.

WHAT THIS ADDS THAT DID NOT EXIST
---------------------------------
`core.perception` could already FIND things three ways — the accessibility
tree, Windows OCR, and the vision model — and `click_target` could click a
coordinate. What nothing could do was the thing a person does without
thinking:

    look at the field -> click it -> type -> LOOK AGAIN -> see the text is
    really there -> only then press Enter.

Every path in the engine that typed through a pointer stopped one step early.
It clicked, it typed, and it pressed Enter, and if the click had landed on the
wrong control the text went somewhere nobody chose and the receipt still said
the characters had been sent. That is the exact shape of the WhatsApp failure:
an action that "succeeded" while the screen showed otherwise.

So the loop here is closed. `type_into` does not press Enter because it typed;
it presses Enter because it LOOKED AND SAW THE TEXT. When the read-back does
not show the text, the keystroke is not sent and the receipt says what was on
screen instead. A committed action that was never confirmed is worse than a
refusal, because only one of the two can be corrected.

WHY THIS IS NOT WIRED INTO EVERY ACTION IN THE ENGINE
-----------------------------------------------------
A screenshot plus OCR costs a few hundred milliseconds, and the vision model
costs seconds. Routing Notepad through it would make an instant, exact,
verifiable action ten times slower in exchange for a less reliable answer --
UI Automation reads the actual value out of the actual control, which is
better evidence than a photograph of it.

So the ladder is kept, and this closes the loop around it: rung one is UI
Automation and stays fast, and the pointer rungs below it are where the
screenshot verification earns its cost. `find_targets` already orders them.
The loop is what was missing, not the eyes.
"""

from __future__ import annotations

import difflib
import io
import time
from typing import Any

from core.perception import (
    DEFAULT_BRIDGE,
    PerceptionUnavailable,
    _capture,
    _norm,
    _ocr_lines,
    click_target,
    find_targets,
)

__all__ = [
    "VerificationFailed",
    "act_on_screen",
    "read_region",
    "text_landed",
    "type_into",
]


class VerificationFailed(RuntimeError):
    """The action ran but looking again did not show the expected result."""


# How many of the typed WORDS have to be found on screen before the result
# counts as confirmed.
#
# NOT 1.0, AND THE REASON IS THE OCR, NOT THE TYPING. Windows OCR reads a
# rendered proportional font from a screenshot: it joins words across kerning,
# drops thin punctuation and occasionally loses a word at a line wrap. Demanding
# every word would report failure on text that is plainly correct on screen --
# and a verifier that cries wolf gets switched off, which is worse than one that
# is slightly tolerant.
#
# 0.7 was chosen against the opposite risk, which is the one that actually
# occurred: unrelated prose must never pass. A screen of different English
# scores near zero on word recall no matter how similar its letters are, so
# there is a wide margin between "the wrong text" and this floor.
RECALL_FLOOR = 0.7

# How close one word has to be to another to count as the same word misread.
# Tight, because this is applied per word rather than across a whole string:
# a loose value here would let "will" match "well" and "from" match "form".
WORD_SIMILARITY = 0.75

# Padding around a field's bounds when reading it back. A text box's OCR bounds
# describe the TEXT, not the control, so the caret and any characters typed
# past the original label fall outside them.
_REGION_PAD = 8

# How long to wait for a window to actually come to the front, and how long to
# let it settle once there. This is about the POINTER: a click is absolute, so
# the coordinate has to belong to the intended window before it is used.
# Keyboard readiness is a separate problem and is solved by focusing the
# control, not by waiting -- see `_foreground`.
_FOCUS_TIMEOUT = 2.5
_FOCUS_SETTLE = 0.35

# Long text is verified on its opening characters. A composer wraps, scrolls
# and truncates what it displays, so the tail of a 400-character message is
# often genuinely not on screen -- and demanding it would fail a write that
# worked perfectly.
_VERIFY_PREFIX = 60


def _escape_send_keys(text: str) -> str:
    """Make arbitrary text safe for pywinauto's keystroke syntax.

    `{}()+^%~` are control characters there: a message containing "100% (yes)"
    types as a modifier soup rather than as itself. Each is wrapped in braces,
    which is that syntax's own escape.
    """
    out: list[str] = []
    for char in text:
        out.append("{" + char + "}" if char in "{}()+^%~[]" else char)
    return "".join(out)


def _capture_region(bounds: dict[str, Any]) -> bytes:
    """A PNG of one rectangle of the screen, in screen coordinates."""
    try:
        import mss  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise PerceptionUnavailable(
            "Reading part of the screen needs the 'mss' and 'pillow' packages, which "
            "are not installed in this Python environment."
        ) from error

    try:
        region = {
            "left": int(bounds["x"]) - _REGION_PAD,
            "top": int(bounds["y"]) - _REGION_PAD,
            "width": int(bounds["width"]) + _REGION_PAD * 2,
            "height": int(bounds["height"]) + _REGION_PAD * 2,
        }
    except (KeyError, TypeError, ValueError) as error:
        raise PerceptionUnavailable("Those bounds cannot be read.") from error

    if region["width"] <= 0 or region["height"] <= 0:
        raise PerceptionUnavailable("Those bounds have no area to read.")

    with mss.mss() as sct:
        raw = sct.grab(region)
        image = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def read_region(
    bounds: dict[str, Any] | None,
    hwnd: int | None = None,
    *,
    live: bool = False,
) -> str:
    """Read the text currently displayed in a rectangle, by looking at it.

    This is the "look again" half of the loop. It deliberately goes through a
    screenshot rather than asking the control for its value: the whole point is
    to confirm what is ON SCREEN, and a control that reports a value it is not
    displaying is one of the failures this is here to catch.

    `live=True` FORCES A FRESH CAPTURE AND IS NOT AN OPTIMISATION KNOB.
    A read that CONFIRMS an action must never be answered from a frame taken
    before that action -- it would confirm the past. Every verification path
    below passes it. The buffered path is for the other kind of question, the
    one asked before anything has happened: "what is on my screen".
    """
    if bounds:
        return " ".join(line["text"] for line in _ocr_lines(_capture_region(bounds))).strip()

    if not live:
        # The continuous buffer already has a recent frame nearly always, so
        # this costs an OCR pass rather than a capture plus an OCR pass -- and
        # nothing at all when the same frame was already read.
        from core.screen_buffer import buffer  # noqa: PLC0415

        frame = buffer.latest()
        if frame is not None and hwnd is None:
            return frame.text()

    return " ".join(line["text"] for line in _ocr_lines(_capture(hwnd)[0])).strip()


def text_landed(expected: str, observed: str) -> tuple[bool, float]:
    """Did `expected` actually appear in what was read back off the screen?

    WORD RECALL, NOT CHARACTER SIMILARITY, AND THAT IS A CORRECTION.
    ----------------------------------------------------------------
    The first version of this scored a character-level ratio and, when the
    observed text was longer than the expected text, slid a window across it
    and took the BEST match. On the first live run it returned True at 0.884
    for a screen that did not contain the typed text at all -- a Notepad window
    showing several paragraphs of unrelated English.

    That was not bad luck. Two stretches of lowercase English share so many
    letters and spaces that a 40-character window scores 0.6-0.7 against almost
    anything, and taking the maximum over a dozen windows reliably finds one
    that scores higher. The measure was searching for a coincidence, and long
    text always contains one.

    So the question asked here changed. Not "how similar are these two strings"
    but "are the WORDS I typed actually on the screen": each word of the
    expected text is looked for among the words that were read, allowing one
    fuzzy match per word for OCR noise. Unrelated prose fails immediately,
    because it does not contain the words -- whatever its letter statistics
    look like.
    """
    want = _norm(expected)[:_VERIFY_PREFIX]
    got = _norm(observed)
    if not want:
        return False, 0.0
    if not got:
        # An empty field is the failure this whole function exists to catch,
        # and it must never be softened by a score.
        return False, 0.0
    if want in got:
        return True, 1.0

    # Words carry the evidence; letters do not. Anything shorter than three
    # characters is dropped because "am", "is" and "a" appear in every screen
    # of English and would inflate the recall of a total mismatch.
    tokens = [w for w in want.split() if len(w) >= 3]
    if not tokens:
        # Too short to have words: containment was the only honest test, and it
        # has already failed.
        return False, 0.0

    seen = got.split()
    matched = 0
    for token in tokens:
        if token in seen:
            matched += 1
            continue
        # A long word found inside a run-together OCR line still counts; a
        # short one does not, because "the" is a substring of "there".
        if len(token) >= 6 and token in got:
            matched += 1
            continue
        # One fuzzy comparison per word, for the l/I and rn/m misreads that
        # Windows OCR makes on a rendered proportional font.
        if any(
            difflib.SequenceMatcher(None, token, word).ratio() >= WORD_SIMILARITY
            for word in seen
            if abs(len(word) - len(token)) <= 2
        ):
            matched += 1

    score = round(matched / len(tokens), 3)
    return score >= RECALL_FLOOR, score


def _foreground(hwnd: int | None) -> bool:
    """Bring the window forward and WAIT UNTIL IT REALLY IS, then settle.

    Two separate reasons, and the second was measured rather than anticipated.

    A pointer click is absolute: a coordinate belongs to whatever is on top of
    it, so clicking without this is how a click computed from a WhatsApp
    screenshot lands in the browser covering it.

    Being foreground is NOT the same as being ready to receive text, and this
    function deliberately does not pretend otherwise. Measured on a cold
    Notepad: with `GetForegroundWindow` returning this window for a full 1.2
    seconds, keystrokes sent to it still lost their first seven characters,
    and waiting longer did not help at all. A top-level window can be in front
    while no child control holds the keyboard.

    That is why every caller here gives focus to the CONTROL before typing --
    `type_into` clicks the field, or writes through the control's own value
    pattern. This makes the window visible and stable so a coordinate means
    what it says; it does not make the window ready to be typed into, and
    nothing that only polls the window ever could.
    """
    if not hwnd:
        return False
    try:
        from core.uia import force_foreground  # noqa: PLC0415

        force_foreground(hwnd)
    except Exception:  # noqa: BLE001, S110
        pass

    try:
        import win32gui  # noqa: PLC0415
    except Exception:  # noqa: BLE001
        time.sleep(_FOCUS_SETTLE)
        return False

    deadline = time.monotonic() + _FOCUS_TIMEOUT
    while time.monotonic() < deadline:
        try:
            if win32gui.GetForegroundWindow() == hwnd:
                # Foreground is not the same as ready for input: the caret and
                # the focused child control arrive a beat later.
                time.sleep(_FOCUS_SETTLE)
                return True
        except Exception:  # noqa: BLE001, S110
            break
        time.sleep(0.05)
    time.sleep(_FOCUS_SETTLE)
    return False


def _best_target(
    hwnd: int | None,
    what: str,
    *,
    allow_vision: bool | None,
    bridge: str,
) -> dict[str, Any]:
    found = find_targets(hwnd, what, allow_vision=allow_vision, bridge=bridge)
    targets = found.get("targets") or []
    if not targets:
        raise PerceptionUnavailable(
            f"Nothing on screen matched “{what}”. {found.get('detail') or ''}".strip()
        )
    target = dict(targets[0])
    target["_scan"] = {"source": found.get("source"), "tried": found.get("tried")}
    return target


def act_on_screen(
    hwnd: int | None,
    what: str,
    *,
    allow_vision: bool | None = None,
    bridge: str = DEFAULT_BRIDGE,
) -> dict[str, Any]:
    """Find something on screen and click it, then look to see what changed.

    The accessibility tree still wins when it can see the control: a target
    from UI Automation is operated by its own invoke pattern, which is exact,
    fast, and cannot land on a neighbour. Only when the tree is blind does this
    fall through to a pixel click.
    """
    _foreground(hwnd)
    target = _best_target(hwnd, what, allow_vision=allow_vision, bridge=bridge)

    if target.get("source") == "uia":
        from core.uia import act  # noqa: PLC0415

        before = read_region(None, hwnd, live=True)
        result = act(hwnd, target["ref"], "invoke", fingerprint=target.get("fingerprint"))
        time.sleep(0.35)
        after = read_region(None, hwnd, live=True)
        return {
            "what": what,
            "source": "uia",
            "pointerUsed": False,
            "changed": before != after,
            "verified": bool(result.get("verified", True)),
            "scan": target["_scan"],
            "detail": (
                f"Operated “{target.get('label')}” through the accessibility tree. "
                + ("The screen changed afterwards." if before != after else "The screen looks unchanged.")
            ),
        }

    outcome = click_target(target, hwnd=hwnd, observe=lambda: read_region(None, hwnd, live=True))
    outcome["what"] = what
    outcome["scan"] = target["_scan"]
    return outcome


def type_into(
    hwnd: int | None,
    field: str,
    text: str,
    *,
    submit: bool = False,
    allow_vision: bool | None = None,
    bridge: str = DEFAULT_BRIDGE,
    settle: float = 0.45,
) -> dict[str, Any]:
    """The whole loop: find the field, click it, type, LOOK, and only then commit.

    `submit=True` asks for Enter to be pressed afterwards. It is honoured ONLY
    when the read-back confirms the text is on screen. That conditional is the
    entire reason this function exists rather than a click followed by a type:
    pressing Enter is the irreversible half, and it must be earned by evidence
    rather than by the absence of an exception.
    """
    text = text or ""
    if not text.strip():
        raise ValueError("There is no text to type.")

    _foreground(hwnd)
    target = _best_target(hwnd, field, allow_vision=allow_vision, bridge=bridge)
    source = str(target.get("source") or "")

    # ---------------------------------------------------------------- act --
    if source == "uia":
        # The tree can see it, so write through the control rather than at the
        # screen. Faster, exact, and it cannot miss.
        from core.uia import act  # noqa: PLC0415

        act(hwnd, target["ref"], "set_text", text=text, fingerprint=target.get("fingerprint"))
        pointer_used = False
        how = "value_pattern"
    else:
        click_target(target, hwnd=hwnd)
        time.sleep(0.2)
        from pywinauto import keyboard  # noqa: PLC0415

        keyboard.send_keys(_escape_send_keys(text), with_spaces=True, pause=0.005)
        pointer_used = True
        how = "pointer_click_and_keystrokes"

    time.sleep(settle)

    # --------------------------------------------------------- look again --
    #
    # The field's own bounds when we have them, because a full-window read
    # picks up every other label on screen and a long enough page will contain
    # the typed words somewhere by coincidence.
    bounds = target.get("bounds") if source != "uia" else None
    try:
        observed = read_region(bounds, hwnd, live=True)
    except PerceptionUnavailable:
        # A read-back that cannot run is NOT a pass. Falling through to
        # "assume it worked" here would restore the exact behaviour this
        # module was written to remove.
        observed = ""
    landed, score = text_landed(text, observed)

    # ------------------------------------------------------------- commit --
    submitted = False
    if submit and landed:
        from pywinauto import keyboard  # noqa: PLC0415

        keyboard.send_keys("{ENTER}")
        time.sleep(settle)
        submitted = True

    detail = (
        f"Typed {len(text)} characters into “{target.get('label') or field}” via {how}, "
        f"then read the screen back and found the text (match {score})."
        if landed
        else (
            f"Typed {len(text)} characters via {how}, but reading the screen back did not "
            f"show them (match {score}). What the screen shows: “{observed[:120]}”."
        )
    )
    if submit:
        detail += (
            " Enter was pressed." if submitted else " Enter was NOT pressed, because the text was not confirmed."
        )

    return {
        "field": field,
        "source": source,
        "how": how,
        "pointerUsed": pointer_used,
        "typed": len(text),
        "readback": observed[:200],
        "match": score,
        "verified": landed,
        "submitted": submitted,
        "scan": target["_scan"],
        "detail": detail,
    }
