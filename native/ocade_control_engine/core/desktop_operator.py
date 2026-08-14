"""The operator layer: a normalised grid, instant text entry, and stagnation.

WHY EACH OF THESE EXISTS, IN THE ORDER THEY WERE FORCED ON US
--------------------------------------------------------------
Every piece here replaces something that was measured failing on this machine.

  THE GRID replaces raw pixels crossing a boundary. A coordinate found on a
  4K panel at 150% scaling and clicked on a 1080p secondary monitor lands
  somewhere else entirely, and the failure is invisible in a log full of
  plausible-looking numbers. Normalised 0-1000 coordinates are meaningful
  without knowing the display, and the conversion happens once, at the edge.

  PASTE replaces per-character typing. Measured directly: a 43-character
  message sent to a freshly opened Notepad arrived with its first six
  characters missing -- "Ln 1, Col 37" for 43 characters typed -- because a
  window that has just appeared drops keystrokes while it is still taking
  focus, and no amount of waiting fixed it. A paste is ONE input event. It
  either lands whole or does not land at all, and the second is detectable.

  THE STAGNATION LAW replaces hope. A click that changes nothing is a click
  that missed, and the only thing worse than missing is missing at the same
  coordinate three more times. The frame digest before and after an action
  answers "did anything happen" for free -- the buffer already hashes frames.

  OVERLAY CLEARING replaces confusion. A save dialog, an update prompt or a
  tooltip that has stolen focus makes every subsequent coordinate wrong, and
  the recovery is always the same two moves: Escape, then look again.

ON THE CLIPBOARD, WHICH IS NOT OURS
------------------------------------
Pasting means writing to a clipboard the user is also using. Whatever was
there is saved and put back, because losing somebody's copied text to an
automation step is a small betrayal that is very annoying and completely
avoidable.
"""

from __future__ import annotations

import time
from typing import Any

__all__ = [
    "GRID",
    "Stagnation",
    "clear_overlay",
    "from_grid",
    "launch_app",
    "marker",
    "paste_text",
    "to_grid",
]

#: The normalised coordinate space. Top-left (0, 0), bottom-right (1000, 1000).
GRID = 1000

#: How long to let a paste settle before reading the result back.
_PASTE_SETTLE = 0.25

#: Mean per-cell greyscale drift, out of 255, that counts as the screen having
#: really changed. Measured against the two things that must land on opposite
#: sides of it: an idle desktop carrying an animated canvas and a blinking
#: caret drifts under 1, and a window opening or a menu appearing drifts well
#: into double figures.
DRIFT_FLOOR = 1.2

#: Resolution of the thumbprint. 64 rather than 32 because three typed
#: characters had to be visible in it, and at 32 they were not.
SIGNATURE_SIZE = 64

#: How long to wait for the Run dialog to appear before typing into it.
_RUN_SETTLE = 0.45


# --------------------------------------------------------------- the grid --


def _desktop() -> dict[str, int]:
    """The full virtual desktop, which is what the grid is measured against."""
    import mss  # noqa: PLC0415

    with mss.mss() as sct:
        m = sct.monitors[0]
    return {"x": int(m["left"]), "y": int(m["top"]), "w": int(m["width"]), "h": int(m["height"])}


def to_grid(x: int, y: int) -> tuple[int, int]:
    """Pixels -> 0-1000. What a coordinate means, independent of the display."""
    d = _desktop()
    gx = round((x - d["x"]) / max(1, d["w"]) * GRID)
    gy = round((y - d["y"]) / max(1, d["h"]) * GRID)
    return max(0, min(GRID, gx)), max(0, min(GRID, gy))


def from_grid(gx: float, gy: float) -> tuple[int, int]:
    """0-1000 -> pixels, clamped to the desktop.

    Clamped rather than trusted: a model that answers 1400 on a 0-1000 scale
    has misunderstood the question, and clamping turns a click into the wrong
    place into a click at the edge, which is visibly wrong instead of subtly
    wrong. `_validate_point` in `perception` refuses out-of-bounds answers for
    the same reason.
    """
    d = _desktop()
    x = d["x"] + int(round(max(0.0, min(float(GRID), float(gx))) / GRID * d["w"]))
    y = d["y"] + int(round(max(0.0, min(float(GRID), float(gy))) / GRID * d["h"]))
    return x, y


# ------------------------------------------------------------- the marker --


def marker(action: str, **fields: Any) -> str:
    """One action, one line, no prose.

    THE AUTOMATION LOG IS NOT A CONVERSATION. A loop that parses its own
    narration eventually reads "I'll now click Save" as an instruction, and
    this repository already carries the scars: `announcesAnotherStep` and
    `ACT_NOW_NUDGE` in `tool-protocol.ts` exist because a small model kept
    describing actions instead of taking them.

    So the operator's own log is machine-shaped -- `CLICK x=412 y=680` -- and
    the sentences live in the receipt, which is a separate field read by
    people rather than by the loop.
    """
    parts = [action.upper()]
    for key, value in fields.items():
        if value is None:
            continue
        parts.append(f"{key}={value}")
    return " ".join(parts)


# -------------------------------------------------------------- the paste --


def _clipboard_get() -> str | None:
    import win32clipboard  # noqa: PLC0415

    try:
        win32clipboard.OpenClipboard()
        try:
            return win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
        except Exception:  # noqa: BLE001
            return None
        finally:
            win32clipboard.CloseClipboard()
    except Exception:  # noqa: BLE001
        return None


def _clipboard_set(text: str) -> bool:
    import win32clipboard  # noqa: PLC0415

    # The clipboard is a shared, single-owner resource and another process can
    # hold it open. Retried briefly rather than failing on the first collision.
    for _ in range(6):
        try:
            win32clipboard.OpenClipboard()
            try:
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32clipboard.CF_UNICODETEXT, text)
                return True
            finally:
                win32clipboard.CloseClipboard()
        except Exception:  # noqa: BLE001
            time.sleep(0.05)
    return False


def _focus_editable(hwnd: int, holder: dict[str, Any] | None = None) -> Any | None:
    """Give keyboard focus to the biggest editable control in a window.

    THIS IS NOT OPTIONAL AND THE FIRST VERSION LEARNED IT THE HARD WAY.
    `paste_text` was written to put text into "the focused control", and on a
    freshly opened Notepad it delivered ZERO of forty-three characters. The
    window was foreground; the EDIT CONTROL INSIDE IT WAS NOT FOCUSED, so the
    Ctrl+V went to a frame that does not handle it.

    Typing survives that state partially -- the same test got 17 of 43
    characters in, as focus settled mid-burst. A paste cannot: it is one event,
    so it either arrives or it does not, and an unfocused control means it does
    not. The property that makes paste reliable is exactly the property that
    makes it all-or-nothing.
    """
    try:
        from pywinauto import Application  # noqa: PLC0415

        app = Application(backend="uia").connect(handle=hwnd, timeout=2)
        # Parked in the caller's dict so this connection is not collected the
        # moment this function returns; a wrapper on a dead backend no-ops.
        if holder is not None:
            holder["app"] = app
        window = app.window(handle=hwnd)
        best, best_area = None, -1
        for child in window.descendants():
            try:
                if child.element_info.control_type not in ("Edit", "Document"):
                    continue
                rect = child.rectangle()
                area = max(0, rect.width()) * max(0, rect.height())
                if area > best_area:
                    best, best_area = child, area
            except Exception:  # noqa: BLE001, S112
                continue
        if best is None:
            return None
        best.set_focus()
        time.sleep(0.15)
        return best
    except Exception:  # noqa: BLE001
        return None


def paste_text(
    text: str,
    *,
    hwnd: int | None = None,
    submit: bool = False,
    restore: bool = True,
) -> dict[str, Any]:
    """Put text into a control in one event, optionally then Enter.

    Pass `hwnd` whenever the target is known. Without it this pastes into
    whatever currently holds the keyboard, which is correct only when the
    caller has just focused something itself -- see `_focus_editable` for what
    happens when nobody has.

    Returns what happened rather than raising, because the caller's next move
    -- verify, retry, fall back to keystrokes -- depends on which half failed.

    THE CLIPBOARD IS PUT BACK. Whatever the user had copied is restored after
    the paste, so an automation step does not quietly eat the thing they were
    about to paste themselves.
    """
    if not text:
        raise ValueError("There is nothing to paste.")

    previous = _clipboard_get() if restore else None
    if not _clipboard_set(text):
        return {
            "ok": False,
            "marker": marker("paste", chars=len(text), result="clipboard_locked"),
            "detail": "The clipboard could not be written; another program is holding it.",
        }

    from pywinauto import keyboard  # noqa: PLC0415

    holder: dict[str, Any] = {}
    focused = _focus_editable(hwnd, holder) if hwnd else None

    # THE PASTE GOES TO THE CONTROL, NOT TO THE GLOBAL INPUT QUEUE.
    #
    # Measured side by side on a cold Notepad, with the Edit control confirmed
    # focused and the clipboard confirmed holding the text:
    #
    #     keyboard.send_keys("^v")   -> ''          (nothing at all)
    #     control.type_keys("^v")    -> 'PASTE_PROBE_123'
    #
    # The global call routes through SendInput and was silently dropped; the
    # control-scoped call addresses the window by handle and arrives. This is
    # the same lesson `whatsapp.py` records for typing into a composer, and it
    # is why `focused` is the control itself rather than a label.
    #
    # The global path stays as the fallback for a caller that named no window,
    # where there is no handle to address.
    if focused is not None:
        focused.type_keys("^v")
    else:
        keyboard.send_keys("^v")
    time.sleep(_PASTE_SETTLE)

    # THE PASTE IS CHECKED, AND IT OFTEN HAS NOT WORKED.
    #
    # MEASURED, AFTER THREE WRONG DIAGNOSES. Ctrl+V into a freshly opened
    # Notepad delivers NOTHING on this machine -- through the global input
    # queue and through the control's own `type_keys`, with the control
    # confirmed focused and the clipboard confirmed holding the text. An
    # earlier probe appeared to show the control-scoped call working; it was
    # not reproducible, and only succeeded because a previous focus and a
    # previous failed paste had already warmed that window.
    #
    # So the clipboard is the FAST path, not the trusted one. What is actually
    # reliable here is the accessibility tree's own value write, which put 43
    # of 43 characters into the same cold window every time. Paste is tried
    # because when it works it is one instant event; the write catches it when
    # it does not, and the receipt says which one did the job.
    landed = False
    if focused is not None:
        try:
            landed = text[:40] in (focused.get_value() or "")
        except Exception:  # noqa: BLE001
            landed = False

    how = "clipboard_paste"
    if not landed and focused is not None:
        try:
            focused.set_text(text)
            time.sleep(0.15)
            landed = text[:40] in (focused.get_value() or "")
            how = "value_pattern"
        except Exception:  # noqa: BLE001
            how = "clipboard_paste_failed"

    if submit:
        if focused is not None:
            focused.type_keys("{ENTER}")
        else:
            keyboard.send_keys("{ENTER}")
        time.sleep(_PASTE_SETTLE)

    if restore and previous is not None:
        # Best effort. A failed restore must not turn a successful paste into a
        # reported failure -- the user's text is the smaller loss.
        _clipboard_set(previous)

    return {
        "ok": landed,
        "marker": marker("paste", chars=len(text), submit=submit, how=how, ok=int(landed)),
        "pasted": len(text),
        "submitted": submit,
        "focused": bool(focused),
        "how": how,
        "verified": landed,
        "clipboardRestored": bool(restore and previous is not None),
        "detail": (
            f"Put {len(text)} characters in via {how}, confirmed by reading the control back"
            + (" and pressed Enter." if submit else ".")
            if landed
            else f"Neither the clipboard nor the value pattern got the text in ({how})."
        ),
    }


# ------------------------------------------------------------- the launch --


def launch_app(name: str) -> dict[str, Any]:
    """Open something through the Run dialog: Win+R, name, Enter.

    NOT THE START MENU SEARCH. That path types into a box whose contents are
    ranked by a recommendation engine, so the top hit for "notes" can be a web
    result, a Store suggestion, or the thing you wanted -- and pressing Enter
    takes whichever it is today. Run has no ranking: it resolves against App
    Paths and PATH, or it fails loudly.

    `core.apps.resolve` is still better when it finds an executable, because it
    can say what it opened. This is the fallback for names that only the shell
    knows, and it is the one this directive asks for by name.
    """
    name = " ".join((name or "").split())
    if not name:
        raise ValueError("There is no application to open.")

    from pywinauto import keyboard  # noqa: PLC0415

    keyboard.send_keys("{VK_LWIN down}r{VK_LWIN up}")
    time.sleep(_RUN_SETTLE)
    # Pasted, not typed: the Run box is a freshly created window and is subject
    # to exactly the dropped-keystroke problem measured on a cold Notepad.
    put = paste_text(name, submit=True, restore=True)
    if not put["ok"]:
        # The clipboard was unavailable, so fall back to keystrokes rather than
        # leaving a Run dialog open and empty.
        keyboard.send_keys(name.replace("{", "{{}").replace("}", "{}}"), with_spaces=True)
        keyboard.send_keys("{ENTER}")

    return {
        "marker": marker("launch", app=name.replace(" ", "_"), via="win+r"),
        "app": name,
        "detail": f"Asked Windows to run “{name}”.",
    }


# --------------------------------------------------------- the two lenses --


class Stagnation:
    """Lens A and Lens B together: did the screen change, and who has focus?

    WHAT THE PIXEL LENS CAN AND CANNOT SEE. MEASURED, NOT ASSUMED.
    ---------------------------------------------------------------
        closing a window          drift 117.6   -> seen easily
        idle desktop, animating   drift   0.1   -> correctly ignored
        three characters typed    drift   0.0   -> INVISIBLE

    That last row is not a defect to be tuned away. Three characters occupy a
    fraction of one cell in a 64x64 thumbprint of a 1344x832 window; no
    threshold separates them from noise, and lowering the floor until they
    register would make a blinking caret count as progress.

    So this answers the question it is for -- "did my click do ANYTHING" --
    where the expected outcome is a window, a menu, a dialog or a navigation.
    It is the wrong instrument for "did my text arrive", and that question
    already has a better one: read the control back, or read the screen back
    with `vision_action.text_landed`. Using this for text would report success
    on an empty box.

    THE STAGNATION LAW, MADE CHEAP.
    A click that changes nothing missed. Detecting that needs a before and an
    after, and the continuous screen buffer already hashes every frame it
    captures -- so the check costs a comparison of two sixteen-byte digests
    rather than a screenshot and an OCR pass.

    Lens B is the window title. Pixels can be identical while focus has moved
    (a transparent overlay, a menu that draws nothing), and focus can be
    identical while the pixels changed completely. Neither lens alone is
    enough, so both are recorded and either changing counts as progress.
    """

    def __init__(self, hwnd: int | None = None) -> None:
        """`hwnd` scopes the check to one window, which is almost always right.

        WHY THE WHOLE DESKTOP IS THE WRONG THING TO WATCH.
        Measured: typing "XYZ" into Notepad moved a 32x32 thumbprint of the
        FULL desktop by 0.1 out of 255 -- indistinguishable from an idle
        screen, so a real action read as stagnant. Three characters are a few
        hundred pixels on a four-million-pixel desktop; the signal is genuinely
        below the noise at that scale, and no threshold separates them.

        Scoped to the window being driven, and sampled at 64x64, those same
        three characters are a measurable fraction of the frame. The desktop
        remains the fallback for an action with no window -- opening the Start
        menu, switching apps -- where a global change IS what is expected.
        """
        self.hwnd = hwnd
        self._digest: list[int] | None = None
        self._focus: str | None = None
        self._blocked: set[tuple[int, int]] = set()

    @staticmethod
    def _front() -> str:
        try:
            import win32gui  # noqa: PLC0415

            return win32gui.GetWindowText(win32gui.GetForegroundWindow())
        except Exception:  # noqa: BLE001
            return ""

    def _signature(self) -> list[int]:
        """A coarse greyscale thumbprint of the screen.

        AN EXACT HASH IS THE WRONG INSTRUMENT AND THE TEST PROVED IT.
        The first version compared the frame digest and reported PIXELS CHANGED
        on a completely idle screen -- correctly, because this machine has
        OCADE's own animated solar system on it, plus a blinking caret and a
        clock. Any of those moves a byte, and an exact hash cannot tell a
        blinking cursor from a dialog opening.

        Under that measure every action looks successful, which is the precise
        opposite of what the stagnation law is for: it exists to catch the
        action that did NOTHING. A detector that always says "changed" is worse
        than no detector, because it justifies retrying the same coordinate.

        So the screen is reduced to a 32x32 grey thumbprint and compared with a
        tolerance. A caret and a second-hand move a few levels in a couple of
        cells; a menu opening moves most of them.
        """
        import io as _io  # noqa: PLC0415

        from PIL import Image  # noqa: PLC0415

        from core.screen_buffer import buffer  # noqa: PLC0415

        frame = buffer.fresh()
        image = Image.open(_io.BytesIO(frame.data)).convert("L")

        if self.hwnd:
            try:
                import win32gui  # noqa: PLC0415

                left, top, right, bottom = win32gui.GetWindowRect(self.hwnd)
                box = (
                    max(0, left - frame.origin["x"]),
                    max(0, top - frame.origin["y"]),
                    min(image.width, right - frame.origin["x"]),
                    min(image.height, bottom - frame.origin["y"]),
                )
                if box[2] - box[0] > 8 and box[3] - box[1] > 8:
                    image = image.crop(box)
            except Exception:  # noqa: BLE001, S110
                pass

        return list(image.resize((SIGNATURE_SIZE, SIGNATURE_SIZE)).getdata())

    def observe(self) -> dict[str, Any]:
        """Record the screen and the focused window as they are right now."""
        self._digest = self._signature()
        self._focus = self._front()
        return {"focus": self._focus, "cells": len(self._digest)}

    def changed(self) -> dict[str, Any]:
        """Has anything moved since `observe`? Both lenses, reported separately."""
        now = self._signature()
        focus = self._front()
        drift = 0.0
        if self._digest is not None and len(self._digest) == len(now):
            total = sum(abs(a - b) for a, b in zip(self._digest, now))
            drift = total / len(now)
        pixels_moved = drift >= DRIFT_FLOOR
        focus_moved = self._focus is not None and focus != self._focus
        moved = bool(pixels_moved or focus_moved)
        return {
            "changed": moved,
            "pixelsChanged": pixels_moved,
            "drift": round(drift, 2),
            "focusChanged": focus_moved,
            "focus": focus,
            "marker": marker(
                "observe",
                changed=int(moved),
                pixels=int(pixels_moved),
                drift=round(drift, 1),
                focus=int(focus_moved),
            ),
        }

    def block(self, x: int, y: int) -> None:
        """Never try this exact point again; it has already done nothing."""
        self._blocked.add(from_grid(*to_grid(x, y)))

    def is_blocked(self, x: int, y: int) -> bool:
        return from_grid(*to_grid(x, y)) in self._blocked

    @property
    def blocked(self) -> list[tuple[int, int]]:
        return sorted(self._blocked)


def clear_overlay() -> dict[str, Any]:
    """Escape whatever has appeared in front, and say whether it worked.

    Escape only. Hunting for a close button means clicking a coordinate on a
    window that just appeared and has not been read -- which is how an
    automation loop agrees to a dialog it never looked at. Escape cancels; it
    does not confirm, and that asymmetry is why it is the only key used here.
    """
    from pywinauto import keyboard  # noqa: PLC0415

    import win32gui  # noqa: PLC0415

    watch = Stagnation(hwnd=win32gui.GetForegroundWindow() or None)
    watch.observe()
    before = watch._focus
    keyboard.send_keys("{ESC}")
    time.sleep(0.3)
    after = watch.changed()

    return {
        "marker": marker("escape", cleared=int(after["changed"])),
        "cleared": after["changed"],
        "focusBefore": before,
        "focusAfter": after["focus"],
        "detail": (
            f"Escape dismissed something; focus is now “{after['focus']}”."
            if after["changed"]
            else "Escape changed nothing, so there was probably no overlay."
        ),
    }
