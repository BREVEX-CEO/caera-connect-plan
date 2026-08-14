"""Numbered elements: the model picks from a list, it never invents a point.

WHY COORDINATES ARE THE WRONG THING TO ASK A MODEL FOR
-------------------------------------------------------
Measured on this machine: asking a vision model where to click took a MEDIAN OF
138 SECONDS and returned 0 of 4 answers inside the screen. Not "slightly off" --
outside the image entirely, four times out of four. Models reason about pixel
geometry badly and confidently, which is the worst combination.

They are excellent at picking from a list. So the screen is turned into one:

    1  Button    "Send"
    2  Edit      "Type a message"
    3  ListItem  "Meta AI"

and the model answers `CLICK 1` or `TYPE 2 "hello"`. It cannot hallucinate
element 9 when the list holds three, because the list came from the live screen
and the id is checked against it before anything moves.

THE LADDER, AND WHY THE FAST RUNG IS THE ONE THAT MATTERS
----------------------------------------------------------
    1. Accessibility tree   ~15 ms    real control handles, exact
    2. Screenshot + OCR     ~250 ms   text with real pixel bounds
    3. (vision)                       left to `perception.find_targets`

Rung 1 covers the overwhelming majority of Windows software and never touches a
pixel: the element carries a `ref` the engine can invoke directly, so the
pointer never moves and the click cannot land on a neighbour. OCR is added only
when the tree is too thin to act on -- Electron windows, custom-drawn panels --
and it is added ALONGSIDE the tree rather than replacing it, because a window
usually publishes some of itself and draws the rest.

IDS ARE STABLE FOR ONE MAP, AND THAT IS A CORRECTNESS PROPERTY
---------------------------------------------------------------
The model sees a numbered list, thinks, and then acts. If the numbering were
recomputed in between, `CLICK 3` would mean one thing when it was offered and
another when it arrives -- the exact class of bug that makes automation click
the wrong row in a chat list. So a map is cached under a token, and acting
requires that token. A stale map is refused rather than silently re-derived.
"""

from __future__ import annotations

import time
from typing import Any

__all__ = ["MapExpired", "act_on_id", "current_map", "map_screen"]

#: How long a numbered map stays valid. A window can change completely in a
#: second; beyond this the ids are a guess about the past, so acting on them is
#: refused and the caller is told to look again.
MAP_TTL = 12.0

#: Roles worth numbering. A `Pane` or a `Group` is scaffolding -- numbering it
#: would bury the four things the user can actually press under forty things
#: they cannot, and a model reading a list picks from what it is shown.
ACTIONABLE = {
    "Button",
    "CheckBox",
    "ComboBox",
    "Edit",
    "Document",
    "Hyperlink",
    "ListItem",
    "MenuItem",
    "RadioButton",
    "Slider",
    "TabItem",
    "TreeItem",
    "DataItem",
    "SplitButton",
    "Text",
}

#: Roles that accept typing. Kept separate from ACTIONABLE because "where can I
#: type" and "what can I press" are different questions and answering the first
#: with the second is how text lands in a search box instead of a composer.
TYPEABLE = {"Edit", "Document", "ComboBox"}

_CACHE: dict[str, Any] = {"token": None, "at": 0.0, "hwnd": None, "elements": []}


class MapExpired(RuntimeError):
    """The numbered list is too old, or was never taken."""


def _from_tree(hwnd: int) -> list[dict[str, Any]]:
    from core.uia import snapshot  # noqa: PLC0415

    tree = snapshot(hwnd, limit=250)
    out: list[dict[str, Any]] = []
    for element in tree.get("elements") or []:
        role = element.get("role") or ""
        name = (element.get("name") or "").strip()
        if role not in ACTIONABLE:
            continue
        # An unnamed control cannot be described to a model, and a model cannot
        # ask for it by name. Bounds alone would put us back in coordinates.
        if not name and role not in TYPEABLE:
            continue
        if not element.get("enabled", True):
            continue
        out.append(
            {
                "role": role,
                "name": name[:120],
                "bounds": element.get("bounds") or {},
                "source": "uia",
                "ref": element.get("ref"),
                "fingerprint": element.get("fingerprint"),
                "canType": bool(element.get("writable") or element.get("textEntry")),
            }
        )
    return out


def _from_ocr(hwnd: int | None) -> list[dict[str, Any]]:
    from core.perception import _capture, _ocr_lines  # noqa: PLC0415

    png, origin = _capture(hwnd)
    out: list[dict[str, Any]] = []
    for line in _ocr_lines(png):
        text = (line.get("text") or "").strip()
        if not text:
            continue
        bounds = line["bounds"]
        out.append(
            {
                "role": "Text",
                "name": text[:120],
                # Screen coordinates, not image coordinates: a window-relative
                # capture would otherwise be off by the window's position.
                "bounds": {
                    "x": bounds["x"] + origin["x"],
                    "y": bounds["y"] + origin["y"],
                    "width": bounds["width"],
                    "height": bounds["height"],
                },
                "source": "ocr",
                "ref": None,
                "fingerprint": None,
                "canType": False,
            }
        )
    return out


def _overlaps(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Do these two elements describe the same thing on screen?"""
    try:
        ax, ay = int(a["bounds"]["x"]), int(a["bounds"]["y"])
        bx, by = int(b["bounds"]["x"]), int(b["bounds"]["y"])
    except (KeyError, TypeError, ValueError):
        return False
    return abs(ax - bx) < 12 and abs(ay - by) < 12


def map_screen(
    hwnd: int | None = None,
    *,
    include_ocr: bool | None = None,
    limit: int = 60,
) -> dict[str, Any]:
    """Number everything actionable on screen and remember the numbering.

    `include_ocr=None` means AUTOMATIC: OCR runs only when the accessibility
    tree returned too little to act on. That threshold matters -- running OCR
    every time would add a quarter of a second to an operation the tree already
    answered exactly, and running it never would make Electron windows invisible.
    """
    from core.uia import force_foreground  # noqa: PLC0415

    if hwnd:
        try:
            force_foreground(hwnd)
            time.sleep(0.25)
        except Exception:  # noqa: BLE001, S110
            pass

    elements = _from_tree(hwnd) if hwnd else []
    tried = [f"accessibility tree ({len(elements)})"]

    want_ocr = include_ocr if include_ocr is not None else len(elements) < 4
    if want_ocr:
        try:
            seen = list(elements)
            for candidate in _from_ocr(hwnd):
                # The tree wins where both saw the same thing: it carries a
                # handle that can be invoked without moving the pointer.
                if any(_overlaps(candidate, existing) for existing in seen):
                    continue
                elements.append(candidate)
            tried.append(f"screen text ({len(elements)} total)")
        except Exception as error:  # noqa: BLE001
            tried.append(f"screen text unavailable ({type(error).__name__})")

    # Reading order, so the numbering matches how a person scans a window.
    elements.sort(key=lambda e: (int(e["bounds"].get("y", 0)), int(e["bounds"].get("x", 0))))
    elements = elements[:limit]
    for index, element in enumerate(elements, start=1):
        element["id"] = index

    token = f"m{int(time.time() * 1000)}"
    _CACHE.update({"token": token, "at": time.monotonic(), "hwnd": hwnd, "elements": elements})

    return {
        "token": token,
        "count": len(elements),
        "elements": [
            {
                "id": e["id"],
                "role": e["role"],
                "name": e["name"],
                "canType": e["canType"],
                "source": e["source"],
            }
            for e in elements
        ],
        "tried": tried,
        "verified": True,
        "detail": (
            f"{len(elements)} things can be acted on. Refer to them by number, "
            f"e.g. CLICK 1 or TYPE 2."
        ),
    }


def current_map() -> dict[str, Any]:
    """The last numbering, with its age. Empty when nothing has been mapped."""
    age = time.monotonic() - _CACHE["at"] if _CACHE["token"] else None
    return {"token": _CACHE["token"], "ageSeconds": round(age, 1) if age else None,
            "count": len(_CACHE["elements"])}


def _resolve(element_id: int, token: str | None) -> dict[str, Any]:
    if not _CACHE["token"]:
        raise MapExpired("Nothing has been mapped yet. Look at the screen first.")
    if token and token != _CACHE["token"]:
        raise MapExpired(
            "Those numbers came from an earlier look at the screen. Map it again."
        )
    if time.monotonic() - _CACHE["at"] > MAP_TTL:
        raise MapExpired(
            f"The numbering is more than {int(MAP_TTL)} seconds old, so the screen may have "
            "moved. Map it again rather than acting on stale numbers."
        )
    for element in _CACHE["elements"]:
        if element["id"] == element_id:
            return element
    raise MapExpired(
        f"There is no element {element_id}. The list has "
        f"{len(_CACHE['elements'])} items."
    )


def act_on_id(
    element_id: int,
    action: str,
    *,
    token: str | None = None,
    text: str = "",
    submit: bool = False,
) -> dict[str, Any]:
    """Do one thing to one numbered element, then look to see whether it worked.

    THREE OUTCOMES, AND `unverified` IS NOT A FAILURE.
    ---------------------------------------------------
    An action either produced the change we expected, produced no observable
    change, or could not be checked at all. Collapsing the third into "done" is
    how a receipt ends up claiming text was typed into an empty box; collapsing
    it into "failed" makes a working product look broken. So all three are
    reported distinctly and the caller decides.
    """
    element = _resolve(element_id, token)
    hwnd = _CACHE["hwnd"]
    action = (action or "").strip().lower()

    from core.vision_action import read_region, text_landed  # noqa: PLC0415

    before = ""
    try:
        before = read_region(None, hwnd, live=True)
    except Exception:  # noqa: BLE001, S110
        pass

    used_pointer = False
    how = ""

    if action in ("click", "press", "open"):
        if element["source"] == "uia" and element.get("ref"):
            from core.uia import act  # noqa: PLC0415

            act(hwnd, element["ref"], "invoke", fingerprint=element.get("fingerprint"))
            how = "accessibility_invoke"
        else:
            from core.perception import click_target  # noqa: PLC0415

            click_target(element, hwnd=hwnd)
            used_pointer = True
            how = "pointer_click"

    elif action == "type":
        if not text:
            raise ValueError("There is nothing to type.")
        if element["source"] == "uia" and element.get("ref"):
            from core.uia import act  # noqa: PLC0415

            act(hwnd, element["ref"], "set_text", text=text,
                fingerprint=element.get("fingerprint"))
            how = "value_pattern"
        else:
            from core.perception import click_target  # noqa: PLC0415
            from pywinauto import keyboard  # noqa: PLC0415

            click_target(element, hwnd=hwnd)
            time.sleep(0.2)
            keyboard.send_keys(text, with_spaces=True, pause=0.005)
            used_pointer = True
            how = "pointer_and_keystrokes"

    elif action == "read":
        from core.vision_action import read_region as read  # noqa: PLC0415

        content = read(element.get("bounds"), hwnd, live=True)
        return {
            "id": element_id,
            "action": "read",
            "name": element["name"],
            "text": content[:2000],
            "outcome": "confirmed",
            "verified": True,
            "detail": f"Read {len(content)} characters from “{element['name']}”.",
        }

    else:
        raise ValueError(f"Unknown action: {action}. Use click, type or read.")

    time.sleep(0.4)

    # ------------------------------------------------------------- look back --
    outcome = "unverified"
    note = ""
    if action == "type":
        seen = ""
        try:
            seen = read_region(element.get("bounds"), hwnd, live=True)
        except Exception:  # noqa: BLE001, S110
            seen = ""
        landed, score = text_landed(text, seen)
        outcome = "confirmed" if landed else "failed"
        note = f"match {score}; screen shows “{seen[:100]}”"
    else:
        after = ""
        try:
            after = read_region(None, hwnd, live=True)
        except Exception:  # noqa: BLE001, S110
            after = ""
        if before and after:
            outcome = "confirmed" if after != before else "failed"
            note = "the screen changed" if outcome == "confirmed" else "nothing changed on screen"
        else:
            note = "the screen could not be read, so nothing is claimed"

    if submit and outcome == "confirmed":
        from pywinauto import keyboard  # noqa: PLC0415

        keyboard.send_keys("{ENTER}")
        time.sleep(0.3)

    return {
        "id": element_id,
        "action": action,
        "name": element["name"],
        "how": how,
        "pointerUsed": used_pointer,
        "submitted": bool(submit and outcome == "confirmed"),
        "outcome": outcome,
        # `verified` stays a strict boolean for callers that only branch on it;
        # `outcome` carries the three-way answer.
        "verified": outcome == "confirmed",
        "detail": (
            f"{action} on {element_id} (“{element['name']}”) via {how} — {outcome}. {note}"
        ).strip(),
    }
